/**
 * auditoria.js — Auditoría, topes e interruptor de las integraciones
 *
 * Todo lo que una integración hace en una plataforma pasa por `AuditoriaIntegraciones.ejecutar`:
 *
 *   1. comprueba el INTERRUPTOR (variable `FORGE_INTEGRACIONES=apagado` o el archivo
 *      `.sdd/integraciones/apagado`). Se mira en cada operación, también en las ya aprobadas y
 *      todavía no publicadas: apagar detiene lo que venga después, no lo que ya salió;
 *   2. comprueba el TOPE de operaciones por sesión y por proveedor (por defecto 20), con el mismo
 *      espíritu que el tope de gasto: al superarlo lanza un error tipado que pide revisión humana;
 *   3. ejecuta, mide, y deja un evento `integracion:<operacion>` con EXACTAMENTE
 *      `{ proveedor, operacion, destino, resultado, duracionMs }`: ni contenido ni credenciales ni el
 *      mensaje de un error (solo su código tipado).
 *
 * El contador de la sesión se guarda en `.sdd/integraciones/sesiones/<sesion>.jsonl` para que valga
 * entre los comandos de `forge integraciones`, que son procesos distintos.
 */

import { appendFileSync, lstatSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { crearDirectorio, crearArchivo, verificarRuta } from '../escritura-segura.js';
import { EventLog } from '../event-log.js';
import { redactar } from '../ciclo/redactar.js';
import { TOPE_POR_DEFECTO } from './config.js';

/** Operaciones auditables; cada una es un tipo de evento `integracion:<operacion>`. */
export const OPERACIONES_AUDITADAS = Object.freeze(['leer_elemento', 'comentar', 'proponer_cambio', 'comprobar_alcance', 'publicar']);

const PROVEEDOR = /^[a-z][a-z0-9_-]{0,30}$/;

export class ErrorIntegracionesApagadas extends Error {
  /** @param {'variable'|'archivo'} origen */
  constructor(origen) {
    super(origen === 'variable'
      ? 'Las integraciones están apagadas (FORGE_INTEGRACIONES=apagado). No se hace ninguna operación; para volver a activarlas, quita la variable.'
      : 'Las integraciones están apagadas (existe .sdd/integraciones/apagado). No se hace ninguna operación; para volver a activarlas, borra ese archivo o usa «forge integraciones encender».');
    this.name = 'ErrorIntegracionesApagadas';
    this.codigo = 'apagado';
    this.origen = origen;
  }
}

export class ErrorTopeIntegraciones extends Error {
  /** @param {string} proveedor @param {number} tope */
  constructor(proveedor, tope) {
    super(`Se alcanzó el tope de ${tope} operaciones de ${proveedor} en esta sesión. Se detiene para que una persona revise lo hecho (forge integraciones estado); si es correcto, sube topes_operaciones_por_sesion en .sdd/sdd.config.yaml o empieza otra sesión.`);
    this.name = 'ErrorTopeIntegraciones';
    this.codigo = 'tope_operaciones';
    this.requiereRevisionHumana = true;
    this.proveedor = proveedor;
    this.tope = tope;
  }
}

const DIR = (cwd) => join(cwd, '.sdd', 'integraciones');
const ARCHIVO_APAGADO = (cwd) => join(DIR(cwd), 'apagado');

/**
 * ¿Están apagadas las integraciones? Mira la variable (la ÚNICA que lee este módulo) y el archivo.
 * @param {string} cwd
 * @param {Record<string, string|undefined>} [env]
 * @returns {{ apagado: boolean, origen?: 'variable'|'archivo' }}
 */
export function estadoInterruptor(cwd, env = process.env) {
  if (String(env.FORGE_INTEGRACIONES ?? '').trim().toLowerCase() === 'apagado') return { apagado: true, origen: 'variable' };
  try {
    lstatSync(ARCHIVO_APAGADO(cwd));            // lstat: un enlace también cuenta como presente
    return { apagado: true, origen: 'archivo' };
  } catch { /* no existe */ }
  return { apagado: false };
}

/** Crea el archivo de apagado. @param {string} cwd */
export function apagar(cwd) {
  crearDirectorio(cwd, DIR(cwd));
  crearArchivo(cwd, ARCHIVO_APAGADO(cwd), `apagado ${new Date().toISOString()}\n`);
}

/** Quita el archivo de apagado (no toca la variable de entorno). @param {string} cwd */
export function encender(cwd) {
  const ruta = verificarRuta(cwd, ARCHIVO_APAGADO(cwd));
  try { unlinkSync(ruta); } catch (e) { if (/** @type {any} */ (e).code !== 'ENOENT') throw e; }
}

/** Texto de un campo del evento: redactado, de una línea y acotado. @param {unknown} v */
function campo(v) {
  return redactar(String(v ?? '')).replace(/[\u0000-\u001F\u007F-\u009F\u2028\u2029]/g, ' ').slice(0, 200);
}

export class AuditoriaIntegraciones {
  /**
   * @param {{ cwd: string, tope?: number, sesion?: string, eventLog?: EventLog, env?: Record<string, string|undefined> }} o
   */
  constructor({ cwd, tope = TOPE_POR_DEFECTO, sesion, eventLog, env = process.env }) {
    if (!Number.isInteger(tope) || tope < 1) throw new RangeError('El tope de operaciones debe ser un entero ≥ 1');
    this.cwd = cwd;
    this.tope = tope;
    this.env = env;
    this.sesion = String(sesion ?? `proceso-${process.pid}-${Date.now().toString(36)}`).replace(/[^\w.-]/g, '_');
    this.eventos = eventLog ?? new EventLog(join(cwd, '.sdd'));
    this.archivoSesion = join(DIR(cwd), 'sesiones', `${this.sesion}.jsonl`);
  }

  /** Operaciones hechas en la sesión, por proveedor. @returns {Record<string, number>} */
  contadores() {
    /** @type {Record<string, number>} */
    const c = {};
    let texto = '';
    try { texto = readFileSync(verificarRuta(this.cwd, this.archivoSesion), 'utf8'); } catch { return c; }
    for (const linea of texto.split('\n')) {
      if (!linea) continue;
      try {
        const p = String(JSON.parse(linea).proveedor);
        c[p] = (c[p] ?? 0) + 1;
      } catch { /* línea cortada */ }
    }
    return c;
  }

  estado() {
    return { tope: this.tope, sesion: this.sesion, contadores: this.contadores(), interruptor: estadoInterruptor(this.cwd, this.env) };
  }

  /** @param {string} proveedor @param {string} operacion @param {string} destino @param {string} resultado @param {number} duracionMs */
  _evento(proveedor, operacion, destino, resultado, duracionMs) {
    this.eventos.append(/** @type {any} */ (`integracion:${operacion}`), {
      proveedor, operacion, destino: campo(destino), resultado, duracionMs: Math.max(0, Math.round(duracionMs)),
    });
  }

  _contar(proveedor) {
    crearDirectorio(this.cwd, join(DIR(this.cwd), 'sesiones'));
    const ruta = verificarRuta(this.cwd, this.archivoSesion);
    appendFileSync(ruta, JSON.stringify({ ts: new Date().toISOString(), proveedor }) + '\n', 'utf8');
  }

  /**
   * Ejecuta `accion` bajo el interruptor y el tope, y deja constancia.
   * @template T
   * @param {{ proveedor: string, operacion: string, destino: string, accion: () => Promise<T> }} o
   * @returns {Promise<T>}
   */
  async ejecutar({ proveedor, operacion, destino, accion }) {
    if (typeof proveedor !== 'string' || !PROVEEDOR.test(proveedor)) throw new TypeError('proveedor no válido');
    if (!(/** @type {readonly string[]} */ (OPERACIONES_AUDITADAS)).includes(operacion)) {
      throw new TypeError(`operación no auditable: ${campo(operacion)}. Las operaciones son un conjunto cerrado: ${OPERACIONES_AUDITADAS.join(', ')}`);
    }

    const sw = estadoInterruptor(this.cwd, this.env);
    if (sw.apagado) {
      this._evento(proveedor, operacion, destino, 'rechazado:apagado', 0);
      throw new ErrorIntegracionesApagadas(/** @type {'variable'|'archivo'} */ (sw.origen));
    }

    if ((this.contadores()[proveedor] ?? 0) >= this.tope) {
      this._evento(proveedor, operacion, destino, 'rechazado:tope_operaciones', 0);
      throw new ErrorTopeIntegraciones(proveedor, this.tope);
    }
    // Se cuenta antes de ejecutar: una ráfaga de fallos también tiene que cortarse
    this._contar(proveedor);

    const t0 = Date.now();
    try {
      const r = await accion();
      this._evento(proveedor, operacion, destino, 'ok', Date.now() - t0);
      return r;
    } catch (e) {
      const codigo = /** @type {any} */ (e)?.codigo;
      const sufijo = typeof codigo === 'string' && /^[a-z_]{1,30}$/.test(codigo) ? `:${codigo}` : '';
      this._evento(proveedor, operacion, destino, `error${sufijo}`, Date.now() - t0);
      throw e;
    }
  }
}
