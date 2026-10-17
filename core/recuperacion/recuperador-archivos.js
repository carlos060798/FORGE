/**
 * recuperador-archivos.js — Contexto por archivos, sin índice previo (ADR-08)
 *
 * Reúne, por este orden: los archivos que declara la tarea, los archivos
 * objetivo del plan y las líneas de la spec que citan los criterios cubiertos.
 * El texto entregado, cabeceras y aviso incluidos, nunca supera `maxBytes`.
 *
 * Devuelve además cada fragmento por separado (`contexto.fragmentos[i].contenido`): quien arma el
 * prompt los delimita uno a uno como dato no confiable (core/ciclo/dato-no-confiable.js). El `texto`
 * pegado se conserva por compatibilidad, pero NO debe ir a un prompt tal cual (spec 2026-10-14).
 *
 * Lo que el plan pide leer lo decide un modelo: se aplican las mismas reglas
 * que para escribir (nada de fuera del proyecto, nada vetado, enlaces
 * simbólicos resueltos). Los manifiestos y la configuración sí se pueden leer.
 */

import * as fs from 'fs';
import * as path from 'path';
import { validarRuta } from '../ciclo/protocolo-archivos.js';
import { etiquetaSegura } from '../ciclo/dato-no-confiable.js';

const AVISO = '\n\n[contexto recortado al tamaño máximo]';
export const bytes = (t) => Buffer.byteLength(t, 'utf8');

/** Recorta por bytes sin dejar un carácter UTF-8 partido al final. */
export function recortar(texto, max) {
  if (max <= 0) return '';
  const buffer = Buffer.from(texto, 'utf8');
  if (buffer.length <= max) return texto;
  return buffer.subarray(0, max).toString('utf8').replace(/�+$/, '');
}

/**
 * Lee como texto el principio de un archivo: como mucho `maxBytes` (más no cabe en el contexto), de modo que
 * uno de 50 MB no se lee entero. Devuelve null si parece binario (algún byte cero, o muchos bytes que no son UTF-8).
 * @param {string} abs @param {number} maxBytes
 * @returns {string|null}
 */
export function leerComoTexto(abs, maxBytes) {
  const tope = Math.max(1024, maxBytes);
  const fd = fs.openSync(abs, 'r');
  try {
    const buf = Buffer.alloc(tope);
    const n = fs.readSync(fd, buf, 0, tope, 0);
    const parte = buf.subarray(0, n);
    if (parte.includes(0)) return null;
    // Con el archivo cortado, el último carácter puede quedar partido: no cuenta como byte inválido
    const texto = parte.toString('utf8').replace(/�$/, '');
    const invalidos = (texto.match(/�/g) ?? []).length;
    if (invalidos > 0 && invalidos / Math.max(1, texto.length) > 0.01) return null;
    return texto;
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * @param {{
 *   cwd: string,
 *   tarea: { archivos?: string[], cas?: string[] },
 *   plan?: { archivosObjetivo?: string[] } | null,
 *   maxBytes: number,
 *   specPath?: string,
 *   vetadas?: string[],
 * }} entrada
 * @returns {{ contexto: { fragmentos: { ruta: string, origen: string, bytes: number, contenido: string, rotulo: string }[], bytesTotales: number, truncado: boolean, aviso?: string }, texto: string }}
 */
export function recuperarPorArchivos(entrada) {
  const { cwd, tarea, plan, maxBytes, specPath } = entrada;

  /** @type {{ ruta: string, origen: string, contenido: string }[]} */
  const candidatos = [];
  const vistos = new Set();

  const anadirArchivo = (ruta, origen) => {
    const v = validarRuta(cwd, ruta, { vetadas: entrada.vetadas });
    let rutaPosix = null;
    if (v.ok === false) {
      if (v.motivo === 'dependencias' || v.motivo === 'configuracion') {
        // No se pueden escribir sin revisión, pero sí leer: no contienen secretos (están vetados aparte)
        rutaPosix = path.relative(path.resolve(cwd), path.resolve(cwd, ruta)).split(path.sep).join('/');
        // Se lee la ruta real: si llega por un enlace, las reglas ya se aplicaron a las dos
        // (validarRuta devuelve vetada si el destino lo es), asi que aqui el enlace es interno y seguro
      }
    } else {
      rutaPosix = v.rutaPosix;
    }
    if (!rutaPosix || vistos.has(rutaPosix)) return;

    const abs = path.resolve(cwd, rutaPosix);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return;
    const contenido = leerComoTexto(abs, maxBytes);
    if (contenido === null) return;   // binario: no es contexto para un modelo
    vistos.add(rutaPosix);
    candidatos.push({ ruta: rutaPosix, origen, contenido });
  };

  for (const ruta of tarea.archivos ?? [])        anadirArchivo(ruta, 'tarea');
  for (const ruta of plan?.archivosObjetivo ?? []) anadirArchivo(ruta, 'plan');

  const cas = tarea.cas ?? [];
  if (specPath && cas.length > 0 && fs.existsSync(specPath)) {
    const lineas = fs.readFileSync(specPath, 'utf8').split(/\r?\n/).filter((l) => cas.some((ca) => l.includes(ca)));
    if (lineas.length > 0) candidatos.push({ ruta: 'spec.md', origen: 'spec', contenido: lineas.join('\n') });
  }

  // El nombre va en el prompt: control, invisibles, cambios de dirección o saltos de línea no pueden entrar (se pone «?»)
  const etiqueta = (ruta) => ruta.replace(/(?:[^\p{L}\p{N}\p{M}\p{Extended_Pictographic}_@.+\-/ ()[\]]|[︀-️ㅤᅟᅠ᠎⠀ﾠ])/gu, '?');
  const cabecera = (c, primero) => `${primero ? '' : '\n\n'}### ${etiqueta(c.ruta)} (${c.origen})\n`;

  // Primero se intenta sin recortar nada
  const completo = candidatos.map((c, i) => cabecera(c, i === 0) + c.contenido).join('');
  if (bytes(completo) <= maxBytes) {
    return {
      contexto: {
        fragmentos: candidatos.map((c) => ({ ruta: c.ruta, origen: c.origen, bytes: bytes(c.contenido), contenido: c.contenido, rotulo: `${etiquetaSegura(c.ruta)} (${c.origen})` })),
        bytesTotales: bytes(completo),
        truncado: false,
      },
      texto: completo,
    };
  }

  // No cabe: se llena hasta el tope, reservando sitio para el aviso
  const presupuesto = maxBytes - bytes(AVISO);
  const fragmentos = [];
  let texto = '';
  for (const c of candidatos) {
    const cab = cabecera(c, texto === '');
    const restante = presupuesto - bytes(texto) - bytes(cab);
    if (restante <= 0) break;
    const contenido = recortar(c.contenido, restante);
    texto += cab + contenido;
    fragmentos.push({ ruta: c.ruta, origen: c.origen, bytes: bytes(contenido), contenido, rotulo: `${etiquetaSegura(c.ruta)} (${c.origen})` });
  }
  texto = bytes(texto) <= maxBytes - bytes(AVISO) ? texto + AVISO : recortar(texto, maxBytes);

  return { contexto: { fragmentos, bytesTotales: bytes(texto), truncado: true }, texto };
}
