/**
 * recuperador-archivos.js — Contexto por archivos, sin índice previo (ADR-08)
 *
 * Reúne, por este orden: los archivos que declara la tarea, los archivos
 * objetivo del plan y las líneas de la spec que citan los criterios cubiertos.
 * El texto entregado, cabeceras y aviso incluidos, nunca supera `maxBytes`.
 *
 * Lo que el plan pide leer lo decide un modelo: se aplican las mismas reglas
 * que para escribir (nada de fuera del proyecto, nada vetado, enlaces
 * simbólicos resueltos). Los manifiestos y la configuración sí se pueden leer.
 */

import * as fs from 'fs';
import * as path from 'path';
import { validarRuta } from '../ciclo/protocolo-archivos.js';

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
 * @param {{
 *   cwd: string,
 *   tarea: { archivos?: string[], cas?: string[] },
 *   plan?: { archivosObjetivo?: string[] } | null,
 *   maxBytes: number,
 *   specPath?: string,
 *   vetadas?: string[],
 * }} entrada
 * @returns {{ contexto: { fragmentos: { ruta: string, origen: string, bytes: number }[], bytesTotales: number, truncado: boolean }, texto: string }}
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
    vistos.add(rutaPosix);
    candidatos.push({ ruta: rutaPosix, origen, contenido: fs.readFileSync(abs, 'utf8') });
  };

  for (const ruta of tarea.archivos ?? [])        anadirArchivo(ruta, 'tarea');
  for (const ruta of plan?.archivosObjetivo ?? []) anadirArchivo(ruta, 'plan');

  const cas = tarea.cas ?? [];
  if (specPath && cas.length > 0 && fs.existsSync(specPath)) {
    const lineas = fs.readFileSync(specPath, 'utf8').split(/\r?\n/).filter((l) => cas.some((ca) => l.includes(ca)));
    if (lineas.length > 0) candidatos.push({ ruta: 'spec.md', origen: 'spec', contenido: lineas.join('\n') });
  }

  const cabecera = (c, primero) => `${primero ? '' : '\n\n'}### ${c.ruta} (${c.origen})\n`;

  // Primero se intenta sin recortar nada
  const completo = candidatos.map((c, i) => cabecera(c, i === 0) + c.contenido).join('');
  if (bytes(completo) <= maxBytes) {
    return {
      contexto: {
        fragmentos: candidatos.map((c) => ({ ruta: c.ruta, origen: c.origen, bytes: bytes(c.contenido) })),
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
    fragmentos.push({ ruta: c.ruta, origen: c.origen, bytes: bytes(contenido) });
  }
  texto = bytes(texto) <= maxBytes - bytes(AVISO) ? texto + AVISO : recortar(texto, maxBytes);

  return { contexto: { fragmentos, bytesTotales: bytes(texto), truncado: true }, texto };
}
