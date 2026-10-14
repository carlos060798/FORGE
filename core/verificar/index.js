/**
 * verificar/index.js — `forge verificar`: veredicto aislado sobre el código y las pruebas que ya existen
 *
 * Sin modelo y sin gasto: este módulo NO importa proveedores de modelo, integraciones ni lee claves
 * (lo vigila tests/verificar.test.js). Compone piezas del ciclo sin copiarlas: detectores de lenguaje,
 * `comprobarEntorno`/`construirSandbox` (compartidos con `forge run`), `SandboxRunner`, las reglas
 * del enrutador y la redacción.
 *
 * Carpeta de sesión: SIEMPRE fuera del proyecto, en el temporal del sistema, derivada del hash del
 * cwd (`<tmp>/forge-verificar-<hash>/.sdd/motor/<runId>`). Así (spike S0.1) el `proyectoId` del
 * sandbox es propio de las verificaciones de ese proyecto y su barrido de huérfanos no mata los
 * contenedores del ciclo ni de otro proyecto, y no se crea nada dentro de un proyecto ajeno.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createHash, randomBytes } from 'crypto';
import { detectStack } from '../stack-detector.js';
import { leerConfigCiclo } from '../ciclo/config.js';
import { clasificar, sinPruebasEjecutadas } from '../ciclo/router.js';
import { adquirir, ErrorBloqueado } from '../ciclo/candado.js';
import { dividirComando } from '../sandbox/sandbox-runner.js';
import { comprobarEntorno, construirSandbox } from '../sandbox/crear-sandbox.js';
import { crearResultado } from './resultado.js';

/**
 * Carpeta propia de las verificaciones de un proyecto, en el temporal del sistema.
 * @param {string} cwd  ruta absoluta del proyecto
 * @param {string} [temporal]
 */
export function carpetaDeVerificacion(cwd, temporal = os.tmpdir()) {
  const hash = createHash('sha256').update(path.resolve(cwd)).digest('hex').slice(0, 16);
  return path.join(temporal, `forge-verificar-${hash}`);
}

/**
 * @param {{ cwd?: string, comando?: string, cli?: import('../sandbox/docker-cli.js').DockerCli, temporal?: string }} [opciones]
 * @returns {Promise<ReturnType<typeof crearResultado>>}
 */
export async function verificar(opciones = {}) {
  const t0 = Date.now();
  const cwd = path.resolve(opciones.cwd ?? process.cwd());
  /** @type {string[]} */
  const avisos = [];

  const config = leerConfigCiclo(cwd);
  const stack = detectStack(cwd);
  const lenguaje = stack.lenguaje;
  const comando = (opciones.comando ?? stack.test_cmd ?? '').trim();
  const rechazo = (/** @type {string} */ motivo) => crearResultado({
    veredicto: 'falla', motivo, comando: comando || null, lenguaje, duracionMs: Date.now() - t0, avisos,
  });

  if (!comando) return rechazo('No hay comando de pruebas: el proyecto no declara ninguno que se reconozca. Indícalo con --comando "<comando>".');
  // Sin intérprete de órdenes: un operador (&&, |, ;, >, <) es un error claro, y no se ejecuta nada
  try { dividirComando(comando); } catch (e) { return rechazo(e instanceof Error ? e.message : String(e)); }

  const entorno = await comprobarEntorno({ cwd, lenguaje, testCmd: comando, runtime: config.sandbox.runtime, cli: opciones.cli });
  if (entorno.ok === false) {
    return crearResultado({
      veredicto: entorno.salida === 1 ? 'falla' : 'infraestructura',
      motivo: entorno.error, comando, lenguaje, duracionMs: Date.now() - t0, avisos,
    });
  }

  const raiz = carpetaDeVerificacion(cwd, opciones.temporal);
  const runId = `verificar-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
  const dirMotor = path.join(raiz, '.sdd', 'motor', runId);

  // Una verificación a la vez por proyecto: comparten el barrido de contenedores huérfanos
  let liberar;
  try {
    liberar = adquirir(path.join(raiz, 'verificar.lock'), 'La verificación de este proyecto');
  } catch (e) {
    if (e instanceof ErrorBloqueado) {
      return crearResultado({ veredicto: 'infraestructura', motivo: e.message, comando, lenguaje, duracionMs: Date.now() - t0, avisos });
    }
    throw e;
  }

  const sandbox = construirSandbox({ runId, dirMotor, cli: entorno.cli, lenguaje, testCmd: comando, sandbox: config.sandbox });
  try {
    const barridos = await sandbox.barrerHuerfanos();
    if (barridos > 0) avisos.push(`Se eliminaron ${barridos} contenedor(es) de una verificación anterior.`);
    const sinBorrar = sandbox.barrerCopias();
    // Carga diferida: restos.js arrastra la medición por mutación, que aquí no se necesita para empezar
    const { barrerMutacionesDeProcesosMuertos } = await import('../ciclo/restos.js');
    barrerMutacionesDeProcesosMuertos();
    if (sinBorrar.length > 0) avisos.push(`No se pudieron borrar ${sinBorrar.length} copia(s) de trabajo anteriores: ${sinBorrar.join(', ')}`);

    const r = await sandbox.test(cwd);
    const pruebas = { hayPruebas: true, pruebasIntactas: true };
    const categoria = clasificar(r, pruebas);
    /** @type {import('./resultado.js').Veredicto} */
    let veredicto;
    let motivo = null;
    if (categoria === 'infra_error') {
      veredicto = 'infraestructura';
      motivo = r.stderr ? String(r.stderr).trim().split('\n').pop() ?? null : 'el entorno de ejecución falló';
    } else if (sinPruebasEjecutadas(r, comando)) {
      veredicto = 'sin_pruebas';
      motivo = 'El comando terminó sin encontrar ninguna prueba (código 5).';
    } else if (categoria === 'pass') {
      veredicto = 'pasa';
    } else {
      veredicto = 'falla';
      if (categoria === 'timeout') motivo = 'Las pruebas superaron el tiempo máximo.';
    }

    if (sandbox.copiasSinBorrar.length > 0) avisos.push(`No se pudieron borrar ${sandbox.copiasSinBorrar.length} copia(s) de trabajo: ${sandbox.copiasSinBorrar.join(', ')}`);
    return crearResultado({
      veredicto, motivo,
      codigoPruebas: r.exitCode,
      comando, lenguaje,
      imagen: sandbox.ultimaImagen?.imagen ?? null,
      duracionMs: Date.now() - t0,
      cortePorTiempo: r.timedOut,
      cortePorMemoria: r.oomKilled,
      salida: [r.stdout, r.stderr].filter(Boolean).join('\n'),
      avisos,
    });
  } finally {
    liberar();
    // Sin restos en el temporal: la sesión se borra; la carpeta del proyecto solo si quedó vacía
    if (sandbox.copiasSinBorrar.length === 0) {
      try { fs.rmSync(dirMotor, { recursive: true, force: true }); } catch { /* se barre en la próxima */ }
      for (const d of [path.dirname(dirMotor), path.dirname(path.dirname(dirMotor)), raiz]) {
        try { fs.rmdirSync(d); } catch { break; }
      }
    }
  }
}
