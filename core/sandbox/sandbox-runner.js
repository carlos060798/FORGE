/**
 * sandbox-runner.js — Ejecuta las pruebas del proyecto en un contenedor aislado (ADR-02)
 *
 * Nunca ejecuta nada en el equipo anfitrión: si Docker no está disponible o la
 * imagen no se puede preparar, devuelve un resultado con `infraError`.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createHash, randomBytes } from 'crypto';
import { DockerCli } from './docker-cli.js';
import { argvRun, etiquetaProyecto, nombreContenedor } from './politica.js';
import { crearCopia, eliminarCopia } from './staging.js';
import { DIR_TRABAJO, ErrorPreparacion, prepararImagen } from './preparar-imagen.js';

/** El contenedor tiene la raíz de solo lectura: todo lo que se escriba va a /tmp. */
const ENTORNO = {
  HOME: '/tmp',
  npm_config_cache: '/tmp/.npm',
  npm_config_update_notifier: 'false',
  PYTHONDONTWRITEBYTECODE: '1',
  CI: 'true',
};

/**
 * Convierte el comando de pruebas detectado en ejecutable y argumentos.
 * `npx x` pasa a `x`: los binarios de las dependencias están en el PATH de la
 * imagen preparada, y sin red npx no podría descargar nada.
 * @param {string} testCmd
 * @returns {string[]}
 */
export function comandoDePruebas(testCmd) {
  const partes = testCmd.trim().split(/\s+/).filter(Boolean);
  if (partes[0] === 'npx') partes.shift();
  if (partes.length === 0) throw new Error('No hay comando de pruebas');
  return partes;
}

/**
 * @param {{ exitCode: number|null, stdout?: string, stderr: string, infraError?: boolean, timedOut?: boolean, oomKilled?: boolean, durationMs?: number }} parcial
 */
function resultado(parcial) {
  return {
    ok: parcial.exitCode === 0 && !parcial.timedOut && !parcial.infraError,
    exitCode: parcial.exitCode,
    stdout: parcial.stdout ?? '',
    stderr: parcial.stderr,
    timedOut: parcial.timedOut ?? false,
    infraError: parcial.infraError ?? false,
    oomKilled: parcial.oomKilled ?? false,
    durationMs: parcial.durationMs ?? 0,
  };
}

export class SandboxRunner {
  /**
   * `dirMotor` es la carpeta de la sesión: `<cwd>/.sdd/motor/<runId>`.
   *
   * @param {{
   *   runId: string,
   *   dirMotor: string,
   *   lenguaje: string,
   *   testCmd: string,
   *   cli?: DockerCli,
   *   limites?: { cpus?: number, memoria?: string, pids?: number },
   *   timeoutMs?: number,
   *   salidaMaxBytes?: number,
   *   imagenBase?: string,
   *   excluir?: string[],
   * }} opciones
   */
  constructor(opciones) {
    this.o   = opciones;
    this.cli = opciones.cli ?? new DockerCli();
    this.n   = 0;
    /** @type {string[]} copias que no se pudieron borrar */
    this.copiasSinBorrar = [];
    // dirMotor es <proyecto>/.sdd/motor/<runId>: el proyecto identifica a sus contenedores
    this.proyectoId = createHash('sha256').update(path.resolve(opciones.dirMotor, '..', '..', '..')).digest('hex').slice(0, 12);
    /** @type {{ imagen: string, construida: boolean, huella: string|null } | null} */
    this.ultimaImagen = null;
  }

  /**
   * @param {string} cwd  proyecto real; el contenedor solo ve una copia
   */
  async test(cwd) {
    const t0 = Date.now();

    const disp = await this.cli.disponible();
    if (disp.ok === false) return resultado({ exitCode: null, stderr: disp.error, infraError: true });

    let imagen;
    try {
      this.ultimaImagen = await prepararImagen({
        cwd, lenguaje: this.o.lenguaje, cli: this.cli, base: this.o.imagenBase,
        dirConstruccion: path.join(this.o.dirMotor, 'construccion'),
      });
      imagen = this.ultimaImagen.imagen;
    } catch (e) {
      if (e instanceof ErrorPreparacion) return resultado({ exitCode: null, stderr: e.message, infraError: true, durationMs: Date.now() - t0 });
      throw e;
    }

    const nombre = nombreContenedor(this.o.runId, ++this.n);
    // Una carpeta por ejecución: el código de pruebas pudo dejar en la anterior algo que el
    // anfitrión no consigue borrar, y eso no debe impedir las siguientes
    // y el nombre incluye proceso y azar: un `resume` posterior empieza con el contador a cero
    const copia  = path.resolve(this.o.dirMotor, 'staging', `${process.pid}-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}-${this.n}`);
    try {
      try {
        crearCopia(cwd, copia, { excluir: this.o.excluir });
      } catch (e) {
        return resultado({ exitCode: null, stderr: `No se pudo preparar la copia de trabajo: ${e instanceof Error ? e.message : e}`, infraError: true, durationMs: Date.now() - t0 });
      }
      const argv = argvRun({
        imagen, nombre, copia,
        comando: comandoDePruebas(this.o.testCmd),
        limites: this.o.limites,
        dirTrabajo: DIR_TRABAJO,
        env: ENTORNO,
        proyectoId: this.proyectoId,
      });
      const r = await this.cli.run(argv, {
        nombre,
        timeoutMs: this.o.timeoutMs ?? 120_000,
        salidaMaxBytes: this.o.salidaMaxBytes,
      });
      return resultado({ ...r, durationMs: Date.now() - t0 });
    } finally {
      // Si no se puede borrar (p. ej. enlaces creados por las pruebas) se avisa en la salida, sin romper la sesión
      if (!eliminarCopia(copia)) this.copiasSinBorrar.push(copia);
    }
  }

  /**
   * Borra las copias de trabajo que dejaron ejecuciones anteriores (con el candado de proyecto
   * tomado nadie más las usa). Devuelve las que no se pudieron borrar.
   * @returns {string[]}
   */
  barrerCopias() {
    const base = path.resolve(this.o.dirMotor, 'staging');
    let nombres = [];
    // Si staging es un enlace (p. ej. una junction), listarlo vaciaria su destino: no se toca
    try { if (fs.lstatSync(base).isSymbolicLink()) return [base]; } catch { return []; }
    try { nombres = fs.readdirSync(base); } catch { return []; }
    const restantes = [];
    for (const n of nombres) {
      const dir = path.join(base, n);
      if (!eliminarCopia(dir)) restantes.push(dir);
    }
    return restantes;
  }

  /** Elimina los contenedores que hayan quedado de ejecuciones anteriores de este proyecto. */
  barrerHuerfanos() {
    return this.cli.barrerHuerfanos(etiquetaProyecto(this.proyectoId));
  }
}
