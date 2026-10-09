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
import { ServidorMcp } from './protocolo.js';

const INSTRUCCIONES = [
  'Herramientas de FORGE sobre un proyecto.',
  'Usa ejecutar_pruebas para comprobar tu trabajo: corre en un contenedor aislado y no ejecuta nada en el equipo del usuario.',
  'escribir_archivo rechaza lo vetado y lo que requiere revisión humana (dependencias, configuración ejecutable): no insistas, díselo al usuario.',
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
  const [{ DockerCli }, { SandboxRunner }, { comprobarProyecto }, { detectStack }, { leerConfigCiclo }] = await Promise.all([
    import('../sandbox/docker-cli.js'),
    import('../sandbox/sandbox-runner.js'),
    import('../sandbox/preparar-imagen.js'),
    import('../stack-detector.js'),
    import('../ciclo/config.js'),
  ]);

  const stack = detectStack(cwd);
  const problema = comprobarProyecto(cwd, stack.lenguaje, stack.test_cmd);
  if (problema) throw new Error(problema);

  const cli = new DockerCli();
  const disp = await cli.disponible();
  if (disp.ok === false) {
    throw new Error(`${disp.error}. Las pruebas no se ejecutan fuera del entorno aislado: arranca Docker y vuelve a intentarlo.`);
  }

  const config = leerConfigCiclo(cwd);
  const runId = `mcp-${Date.now()}`;
  return new SandboxRunner({
    runId, cli,
    dirMotor: path.join(cwd, '.sdd', 'motor', runId),
    lenguaje: stack.lenguaje, testCmd: stack.test_cmd,
    limites: { cpus: config.sandbox.cpus, memoria: config.sandbox.memoria, pids: config.sandbox.pids },
    timeoutMs: config.sandbox.timeout_s * 1000,
    salidaMaxBytes: config.sandbox.salida_max_bytes,
  });
}

/**
 * @param {{ cwd?: string, entrada?: import('stream').Readable, salida?: import('stream').Writable }} [opciones]
 * @returns {Promise<void>} se resuelve cuando el cliente cierra la conexión
 */
export function iniciarServidor(opciones = {}) {
  const cwd = path.resolve(opciones.cwd ?? process.cwd());
  const servidor = new ServidorMcp({
    nombre: 'forge',
    version: versionDelPaquete(),
    instrucciones: INSTRUCCIONES,
    herramientas: crearHerramientas({ cwd, crearRunner: () => crearRunnerDocker(cwd) }),
    entrada: opciones.entrada ?? process.stdin,
    salida: opciones.salida ?? process.stdout,
    avisar: (m) => process.stderr.write(`[forge mcp] ${m}\n`),
  });
  return servidor.iniciar();
}
