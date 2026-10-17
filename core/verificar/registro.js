/**
 * verificar/registro.js — `--registrar`: evidencia en `.sdd/` (solo cuando se pide)
 *
 * Toda escritura pasa por core/escritura-segura.js: ningún componente de la ruta puede ser un enlace
 * ni salir del proyecto. El archivo por verificación se crea en exclusiva (`crearArchivo`, nunca
 * sobrescribe) con un id único, así dos verificaciones simultáneas no se pisan. El evento se añade a
 * `.sdd/events.jsonl` con una sola escritura en modo append (como `EventLog`): no se reescribe el
 * archivo entero, para no perder eventos que otro proceso escriba a la vez.
 */

import * as fs from 'fs';
import * as path from 'path';
import { randomBytes } from 'crypto';
import { crearArchivo, crearDirectorio, verificarRuta, ErrorEnlace } from '../escritura-segura.js';
import { registrarEncadenado } from '../evidencia/cadena.js';

/**
 * @param {string} cwd
 * @param {Record<string, any>} resultado  ya redactado
 * @param {{ env?: Record<string, string|undefined>, modelos?: unknown }} [opciones]
 * @returns {{ ok: true, id: string, archivo: string, eventos: string } | { ok: false, error: string }}
 */
export function registrarVerificacion(cwd, resultado, opciones = {}) {
  const raiz = path.resolve(cwd);
  const id = `${new Date().toISOString().replace(/[-:.]/g, '').replace('T', '-').slice(0, 19)}-${randomBytes(4).toString('hex')}`;
  const archivo = path.posix.join('.sdd', 'verificaciones', `${id}.json`);
  const eventos = path.posix.join('.sdd', 'events.jsonl');
  try {
    // Bloque `evidencia` (cadena de hashes + firma si hay clave local): core/evidencia/cadena.js
    registrarEncadenado(raiz, id, resultado, (informe) => crearArchivo(raiz, path.join(raiz, archivo), JSON.stringify(informe, null, 2) + '\n'), { env: opciones.env ?? process.env, modelos: opciones.modelos });

    const destino = verificarRuta(raiz, path.join(raiz, eventos));
    crearDirectorio(raiz, path.dirname(destino));
    let st = null;
    try { st = fs.lstatSync(destino); } catch { /* aún no existe */ }
    if (st && (st.isSymbolicLink() || !st.isFile())) throw new ErrorEnlace(destino, 'events.jsonl no es un archivo normal; no se escribe');
    const evento = {
      id: `${Date.now()}-${process.pid}`,
      type: 'verificar:resultado',
      ts: new Date().toISOString(),
      payload: {
        id, archivo,
        veredicto: resultado.veredicto, codigoSalida: resultado.codigoSalida, comando: resultado.comando,
        lenguaje: resultado.lenguaje, duracionMs: resultado.duracionMs,
        ...(resultado.mutacion ? { mutacion: {
          veredicto: resultado.mutacion.veredicto, probadas: resultado.mutacion.probadas,
          detectadas: resultado.mutacion.detectadas, puntuacion: resultado.mutacion.puntuacion,
          concluyente: resultado.mutacion.concluyente,
        } } : {}),
      },
    };
    fs.appendFileSync(destino, JSON.stringify(evento) + '\n', { encoding: 'utf8', flag: 'a' });
    return { ok: true, id, archivo, eventos };
  } catch (e) {
    return { ok: false, error: `No se pudo registrar la verificación: ${e instanceof Error ? e.message : String(e)}` };
  }
}
