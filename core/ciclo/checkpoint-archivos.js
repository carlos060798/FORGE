/**
 * checkpoint-archivos.js — Puntos de guardado del ciclo en archivos (ADR-04)
 *
 * Un archivo JSON por transición en <dirMotor>/checkpoints/<hilo>/NNNNNN.json,
 * escrito con archivo temporal y renombrado. Cada punto lleva la huella de su
 * estado: un archivo truncado o editado se detecta y se usa el anterior válido.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { adquirir, ErrorBloqueado } from './candado.js';
import { validarEstado } from './estado.js';

export class ErrorHiloEnUso extends Error {
  /** @param {string} threadId @param {number} pid */
  constructor(threadId, pid) {
    super(`La tarea "${threadId}" ya está en curso en otro proceso (pid ${pid}).`);
    this.name = 'ErrorHiloEnUso';
    this.pid = pid;
  }
}

const huella = (texto) => createHash('sha256').update(texto).digest('hex');

/**
 * Los identificadores de hilo llevan ":" (runId:taskId), inválido en nombres de
 * archivo de Windows. Se añade una huella corta: "a/b" y "a_b" no deben compartir carpeta.
 */
const nombreSeguro = (threadId) => `${threadId.replace(/[^\w.-]/g, '_')}-${huella(threadId).slice(0, 8)}`;

export class GuardadorArchivos {
  /**
   * @param {string} dirMotor  normalmente <cwd>/.sdd/motor/<runId>
   */
  constructor(dirMotor) {
    this.dir = path.join(dirMotor, 'checkpoints');
    /** @type {((threadId: string) => void) | null} se llama tras guardar cada punto */
    this.alGuardar = null;
  }

  /** @param {string} threadId */
  dirHilo(threadId) {
    return path.join(this.dir, nombreSeguro(threadId));
  }

  /** @param {string} threadId @returns {string[]} nombres de archivo, del más antiguo al más reciente */
  _archivos(threadId) {
    const dir = this.dirHilo(threadId);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter((f) => /^\d{6}\.json$/.test(f)).sort();
  }

  /**
   * @param {string} threadId
   * @param {{ nodo: string, siguiente: string|null, estado: import('./estado.js').EstadoCiclo }} punto
   *   `nodo`: el que acaba de terminar; `siguiente`: el que toca ejecutar al reanudar (null si el ciclo terminó).
   * @returns {number} número de secuencia
   */
  guardar(threadId, punto) {
    const dir = this.dirHilo(threadId);
    fs.mkdirSync(dir, { recursive: true });

    const previos = this._archivos(threadId);
    const seq     = previos.length ? Number(previos[previos.length - 1].slice(0, 6)) + 1 : 1;
    const estado  = JSON.stringify(punto.estado);
    const cuerpo  = JSON.stringify({
      seq, ts: new Date().toISOString(), nodo: punto.nodo, siguiente: punto.siguiente, sha256: huella(estado), estado: punto.estado,
    });

    const destino = path.join(dir, String(seq).padStart(6, '0') + '.json');
    const tmp     = destino + '.tmp';
    fs.writeFileSync(tmp, cuerpo, 'utf8');
    fs.renameSync(tmp, destino);
    this.alGuardar?.(threadId);
    return seq;
  }

  /**
   * Último punto de guardado válido del hilo.
   * @param {string} threadId
   * @returns {{ punto: { seq: number, ts: string, nodo: string, siguiente: string|null, estado: import('./estado.js').EstadoCiclo } | null, descartados: { archivo: string, motivo: string }[] }}
   */
  ultimo(threadId) {
    const descartados = [];
    const archivos = this._archivos(threadId);

    for (let i = archivos.length - 1; i >= 0; i--) {
      const archivo = archivos[i];
      let punto;
      try {
        punto = JSON.parse(fs.readFileSync(path.join(this.dirHilo(threadId), archivo), 'utf8'));
      } catch {
        descartados.push({ archivo, motivo: 'no es JSON válido' });
        continue;
      }
      if (huella(JSON.stringify(punto.estado)) !== punto.sha256) {
        descartados.push({ archivo, motivo: 'la huella no coincide con el contenido' });
        continue;
      }
      const errores = validarEstado(punto.estado);
      if (errores.length > 0) {
        descartados.push({ archivo, motivo: errores[0] });
        continue;
      }
      return { punto, descartados };
    }
    return { punto: null, descartados };
  }

  /**
   * Bloquea el hilo para este proceso. Un bloqueo de un proceso que ya no existe se retira.
   * @param {string} threadId
   * @returns {() => void} función que libera el bloqueo
   */
  bloquear(threadId) {
    try {
      return adquirir(path.join(this.dirHilo(threadId), 'en-curso.lock'), `La tarea "${threadId}"`);
    } catch (e) {
      if (e instanceof ErrorBloqueado) throw new ErrorHiloEnUso(threadId, e.pid);
      throw e;
    }
  }
}
