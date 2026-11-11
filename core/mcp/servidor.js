/**
 * servidor.js — Arranque del servidor MCP de FORGE (`forge mcp`)
 *
 * Hay que configurarlo en el cliente MCP, por ejemplo en `.mcp.json`:
 *
 *   { "mcpServers": { "forge": { "command": "npx", "args": ["forge", "mcp"] } } }
 *
 * Habla por stdin y stdout. Todo aviso va a stderr.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { crearHerramientas } from './herramientas.js';
import { crearHerramientaVerificar } from './herramientas-verificar.js';
import { crearHerramientaGuardian } from './herramientas-guardian.js';
import { aplicarPerfil, resolverPerfil } from './perfiles.js';
import { ServidorMcp } from './protocolo.js';
import { directorioDeEstado } from '../estado-usuario.js';
import { auditar, estadoInterruptor } from './limites.js';

const INSTRUCCIONES = [
  'Herramientas de FORGE sobre un proyecto.',
  'Usa ejecutar_pruebas para comprobar tu trabajo: corre en un contenedor aislado y no ejecuta nada en el equipo del usuario.',
  'escribir_archivo rechaza lo vetado y lo que requiere revisión humana (dependencias, configuración ejecutable): no insistas, díselo al usuario.',
].join(' ');

const INSTRUCCIONES_VERIFICACION = [
  'Fragua: una sola herramienta, verificar.',
  'Ejecuta las pruebas del proyecto en un contenedor aislado y devuelve un veredicto (pasa, falla, sin_pruebas, infraestructura).',
  'Solo "pasa" es éxito: cero pruebas ejecutadas no lo es. No escribe, no publica, no gasta y no acepta comandos.',
  'Si responde ocupado, apagado, cupo o tiempo, díselo al usuario: no insistas en bucle.',
].join(' ');

const INSTRUCCIONES_GUARDIAN = [
  'Fragua: una sola herramienta, guardian_evaluar.',
  'Es CONSULTIVA: te dice si el guardián permitiría o bloquearía una acción antes de hacerla, pero nada te obliga a llamarla y no impide nada por sí sola.',
  'Si responde bloquear, no hagas la acción y díselo al usuario. No lee ni escribe archivos, no ejecuta comandos, no gasta.',
].join(' ');

function versionDelPaquete() {
  try {
    const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
    return JSON.parse(fs.readFileSync(path.join(raiz, 'package.json'), 'utf8')).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * Entorno aislado por defecto: Docker, con el comando de pruebas que detecta FORGE.
 * Se crea al primer uso, así que listar herramientas o leer archivos no exige Docker.
 * @param {string} cwd
 */
async function crearRunnerDocker(cwd) {
  const [{ DockerCli }, { SandboxRunner }, { comprobarProyecto }, { detectStack }, { leerConfigCiclo }, { runtimePermitido }] = await Promise.all([
    import('../sandbox/docker-cli.js'),
    import('../sandbox/sandbox-runner.js'),
    import('../sandbox/preparar-imagen.js'),
    import('../stack-detector.js'),
    import('../ciclo/config.js'),
    import('../sandbox/politica.js'),
  ]);

  const stack = detectStack(cwd);
  const problema = comprobarProyecto(cwd, stack.lenguaje, stack.test_cmd);
  if (problema) throw new Error(problema);

  const config = leerConfigCiclo(cwd);
  const permitido = runtimePermitido(config.sandbox.runtime);
  if (permitido.ok === false) throw new Error(`${permitido.error}. Las pruebas no se ejecutan con un aislamiento que no autorizaste.`);

  const cli = new DockerCli();
  const disp = await cli.disponible();
  if (disp.ok === false) {
    throw new Error(`${disp.error}. Las pruebas no se ejecutan fuera del entorno aislado: arranca Docker y vuelve a intentarlo.`);
  }

  // El mismo mecanismo de aislamiento que el ciclo, y la misma regla: si falta, no se ejecuta
  if (config.sandbox.runtime) {
    const rt = await cli.runtimeDisponible(config.sandbox.runtime);
    if (rt.ok === false) throw new Error(`${rt.error}. Las pruebas no se ejecutan con un aislamiento distinto del pedido.`);
  }
  const runId = `mcp-${Date.now()}`;
  return new SandboxRunner({
    runId, cli,
    dirMotor: path.join(cwd, '.sdd', 'motor', runId),
    lenguaje: stack.lenguaje, testCmd: stack.test_cmd,
    limites: { cpus: config.sandbox.cpus, memoria: config.sandbox.memoria, pids: config.sandbox.pids },
    timeoutMs: config.sandbox.timeout_s * 1000,
    salidaMaxBytes: config.sandbox.salida_max_bytes,
    runtime: config.sandbox.runtime,
  });
}

/**
 * Interruptor y auditoría para las herramientas del perfil `completo` (revisión M4): antes solo `verificar` los tenía.
 * Si el usuario apaga el servidor (FRAGUA_MCP_CICLO o el archivo de apagado) ninguna herramienta ejecuta, y cada llamada
 * deja una línea en la auditoría del usuario: herramienta, nombres de los argumentos (nunca sus valores), error o no.
 * @param {import('./protocolo.js').Herramienta[]} herramientas
 * @param {{ cwd: string, env?: Record<string, string|undefined> }} o
 * @returns {import('./protocolo.js').Herramienta[]}
 */
export function conInterruptorYAuditoria(herramientas, o) {
  const env = o.env ?? process.env;
  /** @type {string|null} */
  let dirEstado = null;
  try { dirEstado = directorioDeEstado(o.cwd, env); } catch { dirEstado = null; }
  return herramientas.map((h) => ({
    ...h,
    async ejecutar(args, senal) {
      const t0 = Date.now();
      const apagado = estadoInterruptor(env, dirEstado);
      if (apagado.apagado) {
        if (dirEstado) auditar(dirEstado, { herramienta: h.name, argumentos: Object.keys(args ?? {}), veredicto: 'apagado', duracionMs: 0 });
        return { texto: `La herramienta está apagada: ${apagado.motivo}.`, error: true };
      }
      const r = await h.ejecutar(args, senal);
      if (dirEstado) auditar(dirEstado, { herramienta: h.name, argumentos: Object.keys(args ?? {}), veredicto: r?.error ? 'error' : 'ok', duracionMs: Date.now() - t0 });
      return r;
    },
  }));
}

/**
 * @param {{ cwd?: string, perfil?: string, env?: Record<string, string|undefined>, cli?: import('../sandbox/docker-cli.js').DockerCli,
 *   entrada?: import('stream').Readable, salida?: import('stream').Writable }} [opciones]
 * @returns {Promise<void>} se resuelve cuando el cliente cierra la conexión
 */
export function iniciarServidor(opciones = {}) {
  const cwd = path.resolve(opciones.cwd ?? process.cwd());
  // El perfil lo elige el usuario (argumento de arranque o su entorno); un nombre desconocido no arranca
  const p = resolverPerfil({ argumento: opciones.perfil, env: opciones.env });
  if (p.ok === false) return Promise.reject(new Error(p.error));
  const perfil = p.perfil;
  const herramientas = perfil === 'verificacion'
    ? [crearHerramientaVerificar({ cwd, env: opciones.env, cli: opciones.cli })]
    : perfil === 'guardian'
      ? conInterruptorYAuditoria([crearHerramientaGuardian({ cwd, env: opciones.env })], { cwd, env: opciones.env })
      : conInterruptorYAuditoria(crearHerramientas({ cwd, crearRunner: () => crearRunnerDocker(cwd) }), { cwd, env: opciones.env });
  const servidor = new ServidorMcp({
    nombre: 'forge',
    version: versionDelPaquete(),
    instrucciones: perfil === 'verificacion' ? INSTRUCCIONES_VERIFICACION : perfil === 'guardian' ? INSTRUCCIONES_GUARDIAN : INSTRUCCIONES,
    herramientas: aplicarPerfil(herramientas, perfil),
    entrada: opciones.entrada ?? process.stdin,
    salida: opciones.salida ?? process.stdout,
    avisar: (m) => process.stderr.write(`[forge mcp] ${m}\n`),
  });
  return servidor.iniciar();
}
