/**
 * docker-cli.js — Envoltorio de la CLI de Docker para el entorno aislado (ADR-02)
 *
 * Lanza `docker` con spawn y argumentos en array, sin shell. El ejecutor es
 * inyectable: los tests guionizan sus respuestas sin necesitar Docker.
 */

import { spawn } from 'node:child_process';
import { ETIQUETA } from './politica.js';

/**
 * @typedef {Object} ResultadoProceso
 * @property {number|null} code    null si el proceso no llegó a arrancar o se le mató
 * @property {string} stdout
 * @property {string} stderr
 * @property {boolean} timedOut
 * @property {string} [error]      fallo al lanzar el proceso (p. ej. docker no instalado)
 */

/**
 * @typedef {(args: string[], opciones?: { timeoutMs?: number, maxBytes?: number }) => Promise<ResultadoProceso>} Ejecutor
 */

/** Conserva los últimos `max` bytes: el final de la salida es donde están los errores. */
function acumulador(max) {
  /** @type {Buffer[]} */
  let trozos = [];
  let total = 0;
  return {
    /** @param {Buffer} d */
    add(d) {
      trozos.push(d);
      total += d.length;
      while (total - trozos[0].length >= max) total -= /** @type {Buffer} */ (trozos.shift()).length;
    },
    texto() {
      const todo = Buffer.concat(trozos);
      return (todo.length > max ? todo.subarray(todo.length - max) : todo).toString('utf8');
    },
  };
}

/**
 * @param {string} bin
 * @returns {Ejecutor}
 */
export function crearEjecutor(bin = 'docker') {
  return (args, opciones = {}) => new Promise((resolve) => {
    const max = opciones.maxBytes ?? 1_048_576;
    const out = acumulador(max);
    const err = acumulador(max);
    let timedOut = false;
    let timer;

    const p = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    p.stdout.on('data', (d) => out.add(d));
    p.stderr.on('data', (d) => err.add(d));
    if (opciones.timeoutMs) timer = setTimeout(() => { timedOut = true; p.kill(); }, opciones.timeoutMs);

    p.on('error', (e) => {
      clearTimeout(timer);
      resolve({ code: null, stdout: out.texto(), stderr: err.texto(), timedOut, error: e.message });
    });
    p.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout: out.texto(), stderr: err.texto(), timedOut });
    });
  });
}

export class DockerCli {
  /** @param {{ ejecutar?: Ejecutor }} [opciones] */
  constructor(opciones = {}) {
    this.ejecutar = opciones.ejecutar ?? crearEjecutor();
  }

  /** @returns {Promise<{ ok: true, version: string } | { ok: false, error: string }>} */
  async disponible() {
    const r = await this.ejecutar(['version', '--format', '{{.Server.Version}}'], { timeoutMs: 15_000 });
    if (r.code === 0 && r.stdout.trim()) return { ok: true, version: r.stdout.trim() };
    const detalle = r.error ?? (r.timedOut ? 'el daemon no respondió a tiempo' : r.stderr.trim().split('\n').pop() ?? '');
    return { ok: false, error: `Docker no está disponible: ${detalle}` };
  }

  /**
   * Ejecuta un contenedor. Si supera el tiempo, lo mata por nombre y lo elimina.
   *
   * @param {string[]} argv     argumentos de `docker run` (ver politica.js)
   * @param {{ nombre: string, timeoutMs: number, salidaMaxBytes?: number }} opciones
   * @returns {Promise<{ exitCode: number|null, stdout: string, stderr: string, timedOut: boolean, infraError: boolean, oomKilled: boolean, durationMs: number }>}
   */
  async run(argv, opciones) {
    const t0 = Date.now();
    const r  = await this.ejecutar(argv, { timeoutMs: opciones.timeoutMs, maxBytes: opciones.salidaMaxBytes });

    if (r.timedOut) {
      // El proceso cliente ya murió, pero el contenedor puede seguir vivo
      await this.ejecutar(['kill', opciones.nombre], { timeoutMs: 15_000 });
      await this.ejecutar(['rm', '-f', opciones.nombre], { timeoutMs: 15_000 });
    }

    return {
      exitCode:   r.timedOut ? null : r.code,
      stdout:     r.stdout,
      stderr:     r.stderr,
      timedOut:   r.timedOut,
      // No se pudo lanzar docker, o docker no pudo crear el contenedor (125)
      infraError: Boolean(r.error) || (!r.timedOut && (r.code === null || r.code === 125)),
      // 137 = SIGKILL. Sin tiempo agotado, lo más probable es el límite de memoria.
      oomKilled:  !r.timedOut && r.code === 137,
      durationMs: Date.now() - t0,
    };
  }

  /**
   * Construye una imagen a partir de un contexto que solo contiene manifiestos (ADR-03).
   * @param {string} etiqueta
   * @param {string} contexto  carpeta con el Dockerfile
   * @returns {Promise<{ ok: boolean, error: string }>}
   */
  async build(etiqueta, contexto) {
    const r = await this.ejecutar(['build', '-q', '-t', etiqueta, '--label', 'forge.sandbox.imagen=1', contexto], { timeoutMs: 600_000 });
    return { ok: r.code === 0, error: r.error ?? r.stderr.trim().split(/\r?\n/).slice(-3).join(' | ') };
  }

  /** @param {string} imagen @returns {Promise<boolean>} */
  async existeImagen(imagen) {
    const r = await this.ejecutar(['image', 'inspect', '--format', '{{.Id}}', imagen], { timeoutMs: 15_000 });
    return r.code === 0;
  }

  /**
   * Elimina los contenedores de aislamiento que hayan quedado de ejecuciones anteriores.
   * Con `etiqueta` se limita a los de un proyecto: sin ella mataría también los
   * de otras sesiones de FORGE que estén corriendo en el mismo equipo.
   * @param {string} [etiqueta]
   * @returns {Promise<number>} cuántos eliminó
   */
  async barrerHuerfanos(etiqueta = ETIQUETA) {
    const ps = await this.ejecutar(['ps', '-aq', '--filter', `label=${etiqueta}`], { timeoutMs: 15_000 });
    const ids = ps.code === 0 ? ps.stdout.split(/\s+/).filter(Boolean) : [];
    if (ids.length === 0) return 0;
    await this.ejecutar(['rm', '-f', ...ids], { timeoutMs: 30_000 });
    return ids.length;
  }
}
