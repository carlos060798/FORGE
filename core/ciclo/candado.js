/**
 * candado.js — Candado entre procesos con archivo, atómico y con recuperación
 *
 * Se crea con un enlace duro desde un archivo ya completo: o existe entero con
 * el pid de su dueño, o no existe (no hay una ventana con el archivo vacío).
 * Un candado cuyo dueño ya no existe lo retira quien tenga antes la reclamacion (otro candado de corta vida).
 */

import * as fs from 'fs';
import * as path from 'path';

/** Un candado más viejo que esto se considera huérfano aunque su pid exista (pid reutilizado). */
const EDAD_MAXIMA_MS = 6 * 60 * 60 * 1000;

export class ErrorBloqueado extends Error {
  /** @param {string} que @param {number} pid */
  constructor(que, pid) {
    super(`${que} ya está en curso en otro proceso (pid ${pid}).`);
    this.name = 'ErrorBloqueado';
    this.pid = pid;
  }
}

function procesoVivo(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return /** @type {any} */ (e).code === 'EPERM'; }
}

/**
 * Lo que hay en el archivo del candado. En Windows, leer un archivo que otro proceso acaba de
 * crear o de retirar da ENOENT, EPERM o EBUSY: eso es «no sé» (ausente o transitorio), no «dañado».
 * @returns {{ tipo: 'ok', pid: number, ts: number } | { tipo: 'ausente' } | { tipo: 'transitorio' } | { tipo: 'danado' }}
 */
function leerEstado(archivo) {
  let texto;
  try {
    texto = fs.readFileSync(archivo, 'utf8');
  } catch (e) {
    const codigo = /** @type {any} */ (e).code;
    return codigo === 'ENOENT' ? { tipo: 'ausente' } : codigo === 'EPERM' || codigo === 'EBUSY' || codigo === 'EACCES' ? { tipo: 'transitorio' } : { tipo: 'danado' };
  }
  try {
    const { pid, ts } = JSON.parse(texto);
    return Number.isInteger(pid) && pid > 0 ? { tipo: 'ok', pid, ts: Number(ts) || 0 } : { tipo: 'danado' };
  } catch {
    return { tipo: 'danado' };
  }
}

/** @returns {{ pid: number, ts: number } | null} null si no se puede leer o está dañado */
function leer(archivo) {
  const e = leerEstado(archivo);
  return e.tipo === 'ok' ? { pid: e.pid, ts: e.ts } : null;
}

/** Espera sin ocupar la CPU, de forma sincrona (adquirir es sincrono). */
function esperar(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** Una reclamacion mas vieja que esto se da por abandonada (su proceso murio dentro). */
const EDAD_RECLAMACION_MS = 10_000;

/**
 * Candado de corta vida que protege la retirada de un candado huerfano.
 * @param {string} archivo
 * @returns {(() => void) | null} null si otro proceso la tiene
 */
function reclamar(archivo) {
  const rec = archivo + '.reclamar';
  const propio = `${rec}.${process.pid}.${Math.random().toString(36).slice(2)}`;
  fs.writeFileSync(propio, JSON.stringify({ pid: process.pid, ts: Date.now() }), 'utf8');
  try {
    try {
      fs.linkSync(propio, rec);
      return () => { const a = leer(rec); if (a?.pid === process.pid) { try { fs.unlinkSync(rec); } catch { /* ya no esta */ } } };
    } catch (e) {
      if (/** @type {any} */ (e).code !== 'EEXIST') throw e;
    }
    const otro = leer(rec);
    if (!otro || !procesoVivo(otro.pid) || Date.now() - otro.ts > EDAD_RECLAMACION_MS) {
      try { fs.unlinkSync(rec); } catch { /* otro lo retiro */ }
    }
    return null;
  } finally {
    try { fs.unlinkSync(propio); } catch { /* ya no esta */ }
  }
}

/**
 * @param {string} archivo  ruta del candado
 * @param {string} [que]    descripción para el mensaje de error
 * @returns {() => void}    función que lo libera
 */
export function adquirir(archivo, que = 'El recurso') {
  fs.mkdirSync(path.dirname(archivo), { recursive: true });
  const unico = `${archivo}.${process.pid}.${Math.random().toString(36).slice(2)}`;
  fs.writeFileSync(unico, JSON.stringify({ pid: process.pid, ts: Date.now() }), 'utf8');

  const soltar = () => {
    // Solo si sigue siendo nuestro: otro proceso pudo retirarlo por huérfano
    // Una lectura fallida de forma transitoria no puede dejar nuestro candado puesto: se reintenta
    for (let i = 0; i < 20; i++) {
      const actual = leerEstado(archivo);
      if (actual.tipo === 'transitorio') { esperar(5); continue; }
      if (actual.tipo === 'ok' && actual.pid === process.pid) { try { fs.unlinkSync(archivo); } catch { /* ya no está */ } }
      return;
    }
  };

  try {
    for (let intento = 0; intento < 60; intento++) {
      try {
        fs.linkSync(unico, archivo);
        return soltar;
      } catch (e) {
        if (/** @type {any} */ (e).code !== 'EEXIST') throw e;
      }

      const estado = leerEstado(archivo);
      // Ausente (lo acaban de retirar) o ilegible a ratos (Windows): no es un candado dañado ni huérfano.
      // Tratarlo así permitía retirar el candado vivo de otro proceso
      if (estado.tipo === 'ausente' || estado.tipo === 'transitorio') { esperar(2 + Math.floor(Math.random() * 8)); continue; }
      const dueno = estado.tipo === 'ok' ? { pid: estado.pid, ts: estado.ts } : null;
      // Una marca de tiempo futura no es de fiar (un candado ajeno la podria usar para no caducar nunca)
      const vivo  = dueno && procesoVivo(dueno.pid) && dueno.ts <= Date.now() + 60_000 && Date.now() - dueno.ts < EDAD_MAXIMA_MS;
      if (vivo) throw new ErrorBloqueado(que, /** @type {any} */ (dueno).pid);

      // Huerfano o dañado: solo quien tiene la reclamacion puede retirarlo. Sin ella, dos procesos
      // que lo retiran a la vez pueden llevarse por delante el candado que un tercero acaba de tomar
      const liberarReclamacion = reclamar(archivo);
      if (!liberarReclamacion) { esperar(15 + Math.floor(Math.random() * 25)); continue; }
      try {
        const estadoAhora = leerEstado(archivo);
        const ahora = estadoAhora.tipo === 'ok' ? { pid: estadoAhora.pid, ts: estadoAhora.ts } : null;
        // Dañado dos veces seguidas: se retira. Ausente o transitorio: no se toca
        const sigueHuerfano = !ahora ? estadoAhora.tipo === 'danado' && !dueno
          : ahora.pid === dueno?.pid && !(procesoVivo(ahora.pid) && ahora.ts <= Date.now() + 60_000 && Date.now() - ahora.ts < EDAD_MAXIMA_MS);
        if (sigueHuerfano) { try { fs.unlinkSync(archivo); } catch { /* ya no está */ } }
      } finally {
        liberarReclamacion();
      }
    }
    throw new Error(`No se pudo adquirir el candado de ${que}.`);
  } finally {
    try { fs.unlinkSync(unico); } catch { /* ya no está */ }
  }
}
