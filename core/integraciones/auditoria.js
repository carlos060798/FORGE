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
 * Los contadores (por sesión y por día) se guardan en el estado del USUARIO, fuera del árbol del proyecto
 * (`<estado>/sesiones/<sesion>.jsonl` y `<estado>/dias/<AAAA-MM-DD>.jsonl`; ver `estado-usuario.js`):
 * valen entre los comandos de `forge integraciones`, que son procesos distintos, y un repositorio no
 * puede reiniciarlos fabricando un `sesion.json` (H9). El interruptor por archivo sigue en el árbol:
 * solo puede APAGAR.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes } from 'node:crypto';
import { appendFileSync, lstatSync, readFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { crearDirectorio, crearArchivo, verificarRuta } from '../escritura-segura.js';
import { EventLog } from '../event-log.js';
import { redactar } from '../ciclo/redactar.js';
import { TOPE_POR_DEFECTO } from './config.js';
import { directorioDeEstado } from './estado-usuario.js';

/** Tope diario por proveedor: lo que no reinicia fabricar otro `sesion.json` (H9). Múltiplo del tope por sesión, con techo. */
export const topeDiarioDe = (/** @type {number} */ tope) => Math.min(tope * 5, 200);

/** Operaciones auditables; cada una es un tipo de evento `integracion:<operacion>`. */
export const OPERACIONES_AUDITADAS = Object.freeze(['leer_elemento', 'comentar', 'proponer_cambio', 'comprobar_alcance', 'publicar']);

const PROVEEDOR = /^[a-z][a-z0-9_-]{0,30}$/;

/** Auditorías con una operación en curso en el contexto asíncrono actual (para no contar dos veces). */
const almacenActivas = new AsyncLocalStorage();

export class ErrorIntegracionesApagadas extends Error {
  /** @param {'variable'|'archivo'} origen @param {boolean} [valorNoReconocido] */
  constructor(origen, valorNoReconocido = false) {
    super(origen === 'variable'
      ? (valorNoReconocido
        ? 'Las integraciones están apagadas por seguridad: el valor de FORGE_INTEGRACIONES no se reconoce (solo «normal» o «apagado»; ante la duda se apaga). No se hace ninguna operación; corrige el valor o quita la variable.'
        : 'Las integraciones están apagadas (FORGE_INTEGRACIONES=apagado). No se hace ninguna operación; para volver a activarlas, quita la variable.')
      : 'Las integraciones están apagadas (existe .sdd/integraciones/apagado). No se hace ninguna operación; para volver a activarlas, borra ese archivo o usa «forge integraciones encender».');
    this.name = 'ErrorIntegracionesApagadas';
    this.codigo = 'apagado';
    this.origen = origen;
  }
}

export class ErrorTopeIntegraciones extends Error {
  /** @param {string} proveedor @param {number} tope @param {'sesion'|'dia'} [ambito] */
  constructor(proveedor, tope, ambito = 'sesion') {
    super(`Se alcanzó el tope de ${tope} operaciones de ${proveedor} ${ambito === 'dia' ? 'hoy (tope diario)' : 'en esta sesión'}. Se detiene para que una persona revise lo hecho (forge integraciones estado); si es correcto, sube topes_operaciones_por_sesion en .sdd/sdd.config.yaml o empieza otra sesión.`);
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
 * La variable solo admite `apagado` y `normal`; sin definir (o vacía) vale como `normal`. Cualquier otro
 * valor (`off`, `0`, `1`, `true`, `apagada`…) APAGA por seguridad (fallo cerrado) y lo dice (R10).
 * @param {string} cwd
 * @param {Record<string, string|undefined>} [env]
 * @returns {{ apagado: boolean, origen?: 'variable'|'archivo', valorNoReconocido?: boolean, aviso?: string }}
 */
export function estadoInterruptor(cwd, env = process.env) {
  const v = String(env.FORGE_INTEGRACIONES ?? '').trim().toLowerCase();
  if (v === 'apagado') return { apagado: true, origen: 'variable' };
  if (v !== '' && v !== 'normal') {
    return {
      apagado: true, origen: 'variable', valorNoReconocido: true,
      aviso: 'FORGE_INTEGRACIONES tiene un valor que no se reconoce (solo «normal» o «apagado»): por seguridad las integraciones quedan APAGADAS. Corrige el valor o quita la variable.',
    };
  }
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
    // R6: la sesión por defecto es POR DÍA, no por proceso: cada invocación de la CLI es otro proceso
    this.sesion = String(sesion ?? `dia-${new Date().toISOString().slice(0, 10)}`).replace(/[^\w.-]/g, '_');
    this.eventos = eventLog ?? new EventLog(join(cwd, '.sdd'));
    this.topeDiario = topeDiarioDe(tope);
    /** @type {string|undefined} */
    this._dirEstado = undefined;
  }

  /** Directorio de estado del usuario (se crea al primer uso). */
  dirEstado() { return (this._dirEstado ??= directorioDeEstado(this.cwd, this.env)); }
  archivoSesion() { return join(this.dirEstado(), 'sesiones', `${this.sesion}.jsonl`); }
  archivoDia() { return join(this.dirEstado(), 'dias', `${new Date().toISOString().slice(0, 10)}.jsonl`); }

  /** Operaciones hechas en la sesión, por proveedor. @returns {Record<string, number>} */
  contadores() { return this._contar(this.archivoSesion()); }

  /** Operaciones hechas hoy (UTC), por proveedor. @returns {Record<string, number>} */
  contadoresDelDia() { return this._contar(this.archivoDia()); }

  /** @param {string} archivo @returns {Record<string, number>} */
  _contar(archivo) {
    /** @type {Record<string, number>} */
    const c = {};
    let texto = '';
    try { texto = readFileSync(verificarRuta(this.dirEstado(), archivo), 'utf8'); } catch { return c; }
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
    return {
      tope: this.tope, sesion: this.sesion, contadores: this.contadores(),
      topeDiario: this.topeDiario, contadoresDia: this.contadoresDelDia(),
      interruptor: estadoInterruptor(this.cwd, this.env),
    };
  }

  /** @param {string} proveedor @param {string} operacion @param {string} destino @param {string} resultado @param {number} duracionMs */
  _evento(proveedor, operacion, destino, resultado, duracionMs) {
    this.eventos.append(/** @type {any} */ (`integracion:${operacion}`), {
      proveedor, operacion, destino: campo(destino), resultado, duracionMs: Math.max(0, Math.round(duracionMs)),
    });
  }

  /**
   * R6. Cuenta ATÓMICAMENTE entre procesos: primero se añade una línea con identificador único (una
   * sola escritura con O_APPEND, que el sistema operativo serializa) y después se relee el archivo.
   * El orden de las líneas decide quién cabe: solo ejecutan las `tope` primeras de cada proveedor.
   * No hay «comprobar y luego contar», así que no hay carrera. Devuelve si esta operación cabe.
   * @param {string} proveedor @param {string} [archivo] @param {number} [limite]
   * @returns {boolean}
   */
  _reservar(proveedor, archivo = this.archivoSesion(), limite = this.tope) {
    crearDirectorio(this.dirEstado(), dirname(archivo));
    const ruta = verificarRuta(this.dirEstado(), archivo);
    const id = randomBytes(8).toString('hex');
    appendFileSync(ruta, JSON.stringify({ ts: new Date().toISOString(), proveedor, id }) + '\n', 'utf8');
    let posicion = 0;
    let texto = '';
    try { texto = readFileSync(ruta, 'utf8'); } catch { return false; }       // fallo cerrado
    for (const linea of texto.split('\n')) {
      if (!linea) continue;
      try {
        const o = JSON.parse(linea);
        if (o.id === id) return posicion < limite;
        if (String(o.proveedor) === proveedor) posicion++;
      } catch { /* línea cortada */ }
    }
    return false;                                                              // no aparece la propia línea: cerrado
  }

  /**
   * Comprueba el interruptor ahora. Los adaptadores lo llaman antes de CADA petición de escritura:
   * apagar detiene también lo que queda de una operación en curso (R9).
   * @throws {ErrorIntegracionesApagadas}
   */
  comprobarInterruptor() {
    const sw = estadoInterruptor(this.cwd, this.env);
    if (sw.apagado) {
      throw new ErrorIntegracionesApagadas(/** @type {'variable'|'archivo'} */ (sw.origen), sw.valorNoReconocido === true);
    }
  }

  /**
   * Ejecuta `accion` bajo el interruptor y el tope, y deja constancia.
   * @template T
   * @param {{ proveedor: string, operacion: string, destino: string, accion: () => Promise<T> }} o
   * @returns {Promise<T>}
   */
  async ejecutar({ proveedor, operacion, destino, accion }) {
    // Anidada en una operación de ESTA misma auditoría (la CLI envuelve la operación y el adaptador,
    // que exige auditoría, vuelve a pasar por ella): la exterior ya comprobó, contó y dejó constancia
    const activas = almacenActivas.getStore();
    if (activas?.has(this)) return accion();
    return almacenActivas.run(new Set([...(activas ?? []), this]), () => this._ejecutarPropia({ proveedor, operacion, destino, accion }));
  }

  /** @template T @param {{ proveedor: string, operacion: string, destino: string, accion: () => Promise<T> }} o @returns {Promise<T>} */
  async _ejecutarPropia({ proveedor, operacion, destino, accion }) {
    if (typeof proveedor !== 'string' || !PROVEEDOR.test(proveedor)) throw new TypeError('proveedor no válido');
    if (!(/** @type {readonly string[]} */ (OPERACIONES_AUDITADAS)).includes(operacion)) {
      throw new TypeError(`operación no auditable: ${campo(operacion)}. Las operaciones son un conjunto cerrado: ${OPERACIONES_AUDITADAS.join(', ')}`);
    }

    const sw = estadoInterruptor(this.cwd, this.env);
    if (sw.apagado) {
      this._evento(proveedor, operacion, destino, 'rechazado:apagado', 0);
      throw new ErrorIntegracionesApagadas(/** @type {'variable'|'archivo'} */ (sw.origen), sw.valorNoReconocido === true);
    }

    // Se cuenta antes de ejecutar: una ráfaga de fallos también tiene que cortarse. Si ya está en el tope
    // ni siquiera se añade línea; la reserva atómica cubre la carrera entre procesos (R6).
    if ((this.contadores()[proveedor] ?? 0) >= this.tope || !this._reservar(proveedor)) {
      this._evento(proveedor, operacion, destino, 'rechazado:tope_operaciones', 0);
      throw new ErrorTopeIntegraciones(proveedor, this.tope);
    }
    // Tope diario: no lo reinicia otro identificador de sesión (H9)
    if ((this.contadoresDelDia()[proveedor] ?? 0) >= this.topeDiario || !this._reservar(proveedor, this.archivoDia(), this.topeDiario)) {
      this._evento(proveedor, operacion, destino, 'rechazado:tope_operaciones', 0);
      throw new ErrorTopeIntegraciones(proveedor, this.topeDiario, 'dia');
    }

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
