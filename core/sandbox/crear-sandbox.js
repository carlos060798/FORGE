/**
 * crear-sandbox.js — Comprobaciones previas y construcción del SandboxRunner (compartido)
 *
 * Lo usan `forge run` (core/engine-cli.js) y `forge verificar` (core/verificar). Es la extracción
 * sin cambios de comportamiento de lo que hacía `prepararCiclo`: quien llama decide cómo mostrar
 * cada causa y con qué código de salida termina.
 */

import { DockerCli } from './docker-cli.js';
import { SandboxRunner } from './sandbox-runner.js';
import { comprobarProyecto } from './preparar-imagen.js';
import { runtimePermitido } from './politica.js';

/**
 * Todo lo que puede fallar antes de ejecutar nada: proyecto, mecanismo de aislamiento y Docker.
 * `salida`: 1 si el problema es del proyecto, 4 si falta el aislamiento.
 *
 * @param {{ cwd: string, lenguaje: string, testCmd: string, runtime?: string, cli?: DockerCli }} o
 * @returns {Promise<{ ok: true, cli: DockerCli, version: string }
 *   | { ok: false, causa: 'proyecto'|'runtime_no_permitido'|'docker'|'runtime_docker', error: string, salida: 1|4 }>}
 */
export async function comprobarEntorno(o) {
  const problema = comprobarProyecto(o.cwd, o.lenguaje, o.testCmd);
  if (problema) return { ok: false, causa: 'proyecto', error: problema, salida: 1 };

  // El runtime lo escribe el archivo del proyecto: debe estar autorizado por el usuario (H-05)
  const permitido = runtimePermitido(o.runtime);
  if (permitido.ok === false) return { ok: false, causa: 'runtime_no_permitido', error: permitido.error, salida: 4 };

  const cli = o.cli ?? new DockerCli();
  const disp = await cli.disponible();
  if (disp.ok === false) return { ok: false, causa: 'docker', error: disp.error, salida: 4 };

  // Un mecanismo de aislamiento pedido que Docker no tiene: nunca se usa el de por defecto en su lugar
  if (o.runtime) {
    const rt = await cli.runtimeDisponible(o.runtime);
    if (rt.ok === false) return { ok: false, causa: 'runtime_docker', error: rt.error, salida: 4 };
  }
  return { ok: true, cli, version: disp.version };
}

/**
 * @param {{ runId: string, dirMotor: string, cli: DockerCli, lenguaje: string, testCmd: string,
 *   sandbox: { cpus: number, memoria: string, pids: number, timeout_s: number, salida_max_bytes: number, runtime?: string } }} o
 */
export function construirSandbox(o) {
  return new SandboxRunner({
    runId: o.runId, dirMotor: o.dirMotor, cli: o.cli,
    lenguaje: o.lenguaje, testCmd: o.testCmd,
    descargarBase: true,   // la primera vez en un equipo, la imagen base se descarga (con red) en lugar de fallar
    limites: { cpus: o.sandbox.cpus, memoria: o.sandbox.memoria, pids: o.sandbox.pids },
    timeoutMs: o.sandbox.timeout_s * 1000,
    salidaMaxBytes: o.sandbox.salida_max_bytes,
    runtime: o.sandbox.runtime,
  });
}
