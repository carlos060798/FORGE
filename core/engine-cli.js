/**
 * engine-cli.js — CLI del engine FORGE
 *
 * Uso:
 *   node core/engine-cli.js run    [--cwd <path>] [--tasks <json>] [--motor clasico|ciclo] [--force]
 *   node core/engine-cli.js resume [--cwd <path>] [--decision continuar|aceptar|abortar]
 *                                  [--iteraciones-extra <N>] [--presupuesto-extra <USD>]
 *
 * Códigos de salida: 0 completado · 1 fallo · 3 revisión humana pendiente · 4 aislamiento no disponible
 *   node core/engine-cli.js status [--cwd <path>]
 *   node core/engine-cli.js validate [--cwd <path>] [--spec <path>]
 */

import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

import { createStateStore } from './state-store.js';
import { PipelineStateMachine } from './state-machine.js';
import { EventLog } from './event-log.js';
import { createAgentRegistry } from './agent-registry.js';
import { Orchestrator } from './orchestrator.js';
import { detectStack } from './stack-detector.js';
import { runnerForStack } from './runners/index.js';
import { parseSpecMd, validateSpec, checkCoverage } from './spec.js';
import { sessionBudget } from './session-budget.js';
import { lineaRevision } from './precios.js';
import { circuitBreaker } from './execution-context.js';
import { cargarTareas, specActiva } from './tareas.js';
import { leerConfigCiclo, leerRutasProtegidas } from './ciclo/config.js';
import { CicloVerificado, crearLlamador, dirMotorBase, lineaAislamiento, lineasEstadoCiclo, nuevaSesion, sesionActual, tareasSinTerminarEnElProyecto, tienePuntosDeGuardado } from './ciclo/index.js';
import { adquirir, ErrorBloqueado } from './ciclo/candado.js';
import { DockerCli } from './sandbox/docker-cli.js';
import { SandboxRunner } from './sandbox/sandbox-runner.js';
import { comprobarProyecto } from './sandbox/preparar-imagen.js';

export const SALIDA = { OK: 0, FALLO: 1, REVISION: 3, SIN_AISLAMIENTO: 4 };
const DECISIONES = ['continuar', 'aceptar', 'abortar'];

// ── Colores de terminal ───────────────────────────────────────────────────────

const tty = process.stdout.isTTY;
const c = {
  verde:    (s) => tty ? `\x1b[0;32m${s}\x1b[0m` : s,
  amarillo: (s) => tty ? `\x1b[1;33m${s}\x1b[0m` : s,
  rojo:     (s) => tty ? `\x1b[0;31m${s}\x1b[0m` : s,
  azul:     (s) => tty ? `\x1b[0;34m${s}\x1b[0m` : s,
  gris:     (s) => tty ? `\x1b[0;90m${s}\x1b[0m` : s,
};

const ok   = (msg) => console.log(`${c.verde('✓')} ${msg}`);
const warn = (msg) => console.log(`${c.amarillo('⚠')}  ${msg}`);
const err  = (msg) => { console.error(`${c.rojo('✗')} ${msg}`); process.exit(1); };

/** Desde 5.0.0 el ciclo verificado es el modo por defecto: quien no pueda usarlo debe saber cómo salir de él. */
const SALIDA_CLASICA = 'Para ejecutar sin el ciclo, en tu equipo y sin aislamiento: --motor clasico (o motor.modo: clasico en sdd.config.yaml).';
const info = (msg) => console.log(`${c.azul('❯')} ${msg}`);
const dim  = (msg) => console.log(c.gris(msg));

// ── Parser de argumentos ──────────────────────────────────────────────────────

export function parseArgs(argv) {
  const [,, command = 'status', ...rest] = argv;
  const flags = {};
  for (let i = 0; i < rest.length; i++) {
    if (!rest[i].startsWith('--')) continue;
    const key  = rest[i].slice(2);
    const next = rest[i + 1];
    // Un flag seguido de otro flag (o al final) es booleano: no consume el siguiente
    if (next === undefined || next.startsWith('--')) {
      flags[key] = 'true';
    } else {
      flags[key] = next;
      i++;
    }
  }
  return { command, flags };
}

// ── Fábrica de dependencias ───────────────────────────────────────────────────

function buildDeps(cwd) {
  const forgeRoot = path.resolve(__dirname, '..');
  const sddDir    = path.join(cwd, '.sdd');
  const store     = createStateStore(cwd);
  const log       = new EventLog(sddDir);
  const registry  = createAgentRegistry(forgeRoot);
  const fsm       = new PipelineStateMachine(store, log);
  const stack     = detectStack(cwd);
  const runner    = runnerForStack(stack, cwd);
  return { store, log, registry, fsm, stack, runner, sddDir };
}

/**
 * Prepara el ciclo verificado si el modo es "ciclo"; devuelve null en modo clásico.
 * @param {boolean} nueva       true en `forge run` (sesión y presupuesto nuevos); false en `forge resume`
 * @param {string[]} [taskIds]  tareas que se van a lanzar: en `resume`, las que tengan puntos de guardado
 *                              del ciclo se reanudan con el ciclo aunque no se pida
 */
async function prepararCiclo(cwd, flags, deps, apiKey, nueva, taskIds = []) {
  const previa = sesionActual(cwd);
  const conPuntos = !nueva && previa?.modo === 'ciclo' && taskIds.some((id) => tienePuntosDeGuardado(cwd, previa.runId, id));

  // Relanzar en modo clásico una tarea del ciclo ejecutaría en el equipo, sin aislamiento, lo que escribió un modelo
  if (conPuntos && flags['motor'] === 'clasico' && flags['force'] !== 'true') {
    err('Hay tareas empezadas con el ciclo verificado. Relanzarlas en modo clásico ejecutaría en tu equipo, sin aislamiento, código que escribió un modelo. Usa --motor ciclo, o --force si lo asumes.');
  }
  const modo   = flags['motor'] ?? (conPuntos ? 'ciclo' : undefined);
  const config = leerConfigCiclo(cwd, { motor: modo });
  if (config.motor.modo !== 'ciclo') {
    // Ejecutar las pruebas del proyecto en el equipo debe pedirse en el momento: no puede venir solo de un
    // archivo del repositorio (quien clona un proyecto ajeno creería que se ejecuta aislado)
    if (flags['motor'] !== 'clasico') {
      err('sdd.config.yaml pide motor.modo: clasico, que ejecuta las pruebas del proyecto EN TU EQUIPO, sin aislamiento. Por seguridad hay que pedirlo en la orden: añade --motor clasico, o quita esa línea para usar el modo aislado.');
    }
    console.error(`${c.amarillo?.('⚠') ?? '⚠'} Modo clásico (--motor clasico): las pruebas de tu proyecto se ejecutan en tu equipo, sin aislamiento.`);
    return null;
  }

  // Todo lo que puede fallar antes de gastar o de cambiar nada, primero
  const etapa = deps.fsm.currentStep();
  const avanza = etapa === 'tasks' && deps.fsm.availableTransitions().includes('code');
  if (etapa !== 'code' && !avanza && flags['force'] !== 'true') {
    err(`El ciclo verificado solo se ejecuta en la etapa "code" (etapa actual: "${etapa}"). Avanza con "forge step code" o añade --force. ${SALIDA_CLASICA}`);
  }

  const problema = comprobarProyecto(cwd, deps.stack.lenguaje, deps.stack.test_cmd);
  if (problema) err(`${problema} ${SALIDA_CLASICA}`);

  const cli  = new DockerCli();
  const disp = await cli.disponible();
  if (disp.ok === false) {
    console.error(`${c.rojo('✗')} ${disp.error}`);
    console.error('  El ciclo verificado no ejecuta código generado fuera del entorno aislado.');
    console.error('  Arranca Docker y vuelve a intentarlo.');
    console.error('  ' + SALIDA_CLASICA);
    process.exit(SALIDA.SIN_AISLAMIENTO);
  }

  // Un mecanismo de aislamiento pedido que Docker no tiene: mismo desenlace que «sin aislamiento».
  // Nunca se usa el de por defecto en su lugar.
  if (config.sandbox.runtime) {
    const rt = await cli.runtimeDisponible(config.sandbox.runtime);
    if (rt.ok === false) {
      console.error(`${c.rojo('✗')} ${rt.error}`);
      console.error('  El ciclo verificado no empieza con un aislamiento distinto del que pediste.');
      console.error('  Instala ese mecanismo en Docker, o quita sandbox.runtime de .sdd/sdd.config.yaml para usar el de Docker por defecto.');
      process.exit(SALIDA.SIN_AISLAMIENTO);
    }
  }

  // Un solo ciclo por proyecto: dos a la vez compartirían la copia, el gasto y el barrido de contenedores
  let liberar;
  try {
    liberar = adquirir(path.join(dirMotorBase(cwd), 'proyecto.lock'), 'El ciclo verificado de este proyecto');
  } catch (e) {
    if (e instanceof ErrorBloqueado) err(e.message);
    throw e;
  }
  process.on('exit', liberar);

  // De "tareas generadas" a "construcción" no hay ninguna condición: se avanza solo, ya sin riesgo de salir con error
  if (avanza && deps.fsm.advance('code').ok) info('Etapa del proyecto: tasks → code');

  const sesion   = nueva || !previa ? nuevaSesion(cwd) : previa;
  const dirMotor = path.join(dirMotorBase(cwd), sesion.runId);
  const sandbox  = new SandboxRunner({
    runId: sesion.runId, dirMotor, cli,
    lenguaje: deps.stack.lenguaje, testCmd: deps.stack.test_cmd,
    descargarBase: true,   // la primera vez en un equipo, la imagen base se descarga (con red) en lugar de fallar
    limites: { cpus: config.sandbox.cpus, memoria: config.sandbox.memoria, pids: config.sandbox.pids },
    timeoutMs: config.sandbox.timeout_s * 1000,
    salidaMaxBytes: config.sandbox.salida_max_bytes,
    runtime: config.sandbox.runtime,
  });
  const barridos = await sandbox.barrerHuerfanos();
  if (barridos > 0) warn(`Se eliminaron ${barridos} contenedor(es) de una ejecución anterior.`);
  const copiasSinBorrar = sandbox.barrerCopias();
  if (copiasSinBorrar.length > 0) warn(`No se pudieron borrar ${copiasSinBorrar.length} copia(s) de trabajo de ejecuciones anteriores; bórralas a mano: ${copiasSinBorrar.join(', ')}`);

  const spec  = specActiva(deps.store.read());
  const ciclo = new CicloVerificado({
    cwd, runId: sesion.runId, config, log: deps.log,
    ...crearLlamador(deps.registry, apiKey, cwd),
    runner: sandbox, testCmd: deps.stack.test_cmd,
    vetadas: leerRutasProtegidas(cwd),
    specPath: spec ? path.join(cwd, '.sdd', 'especificaciones', String(spec), 'spec.md') : undefined,
  });
  info(`Motor: ciclo verificado · sesión ${sesion.runId} · tope $${(ciclo.libro.tope() ?? config.presupuesto.tope_usd).toFixed(2)} · Docker ${disp.version} · aislamiento: ${config.sandbox.runtime || 'el de Docker por defecto'}`);
  return { ciclo, config, dirMotor };
}

/** Las tareas de la sesión se guardan con ella: `forge resume` las necesita aunque vinieran de --tasks. */
function tareasDeSesion(cwd) {
  const sesion = sesionActual(cwd);
  if (!sesion) return [];
  try {
    return JSON.parse(fs.readFileSync(path.join(dirMotorBase(cwd), sesion.runId, 'tareas.json'), 'utf8'));
  } catch {
    return [];
  }
}

const MOTIVOS_LEGIBLES = {
  iteraciones:     'se alcanzó el máximo de ejecuciones sin que las pruebas pasen',
  presupuesto:     'se alcanzó el tope de gasto de la sesión',
  infraestructura: 'el entorno de ejecución o el proveedor de modelos falló',
  dependencias:    'el implementador propone cambiar las dependencias del proyecto',
  salida_invalida: 'un agente no devolvió una salida utilizable',
  exito_sospechoso: 'las pruebas pasan, pero hay señales de que no demuestran nada (mira el detalle)',
  sin_progreso:    'las pruebas fallan igual varias veces seguidas: puede que estén rotas (mira el detalle)',
};

/** Explica por qué se pausó cada tarea y qué puede decidir la persona. No gasta nada. */
function informarRevision(pausadas) {
  console.log('');
  warn(`${pausadas.length} tarea(s) esperan tu decisión:`);
  for (const t of pausadas) {
    console.log(`  ${c.amarillo('⏸')} ${t.taskId}: ${MOTIVOS_LEGIBLES[t.motivo] ?? t.motivo}`);
    if (t.detalle) dim(`     ${t.detalle}`);
  }
  console.log('\n  Opciones:');
  console.log('    forge resume --decision continuar [--iteraciones-extra N] [--presupuesto-extra USD]');
  console.log('    forge resume --decision aceptar     (dar la tarea por buena tal como está)');
  console.log('    forge resume --decision abortar     (restaurar los archivos al estado previo)');
  dim('  Mientras no decidas, no se gasta nada.');
}

// ── Comandos ──────────────────────────────────────────────────────────────────

async function cmdStatus(cwd) {
  const { store, log, fsm, stack } = buildDeps(cwd);
  const estado     = store.read();
  const step       = fsm.currentStep();
  const taskStates = log.replayTaskStates();
  const completed  = [...taskStates.values()].filter(v => v.estado === 'completada').length;
  const total      = taskStates.size;

  info(`Proyecto: ${cwd}`);
  console.log(`  Pipeline:   ${c.azul(step)}`);
  console.log(`  Stack:      ${stack.lenguaje} / ${stack.runtime}${stack.framework ? ` (${stack.framework})` : ''}`);
  console.log(`  Tareas:     ${completed}/${total} completadas`);
  const spec = specActiva(estado);
  if (spec) console.log(`  Spec:       ${spec}`);
  if (estado.ultima_actualizacion) dim(`  Actualizado: ${estado.ultima_actualizacion}`);

  const avail = fsm.availableTransitions();
  if (avail.length > 0) dim(`  Próximo paso posible: ${avail.join(', ')}`);

  console.log(`\n💰 Presupuesto sesión: ${sessionBudget.resumen()}`);
  console.log(`   ${lineaRevision()}`);
  console.log(`🔒 Circuit breaker:   ${circuitBreaker.nivel}`);
  console.log(`📦 ${lineaAislamiento(cwd)}`);

  const lineas = lineasEstadoCiclo(cwd);
  if (lineas.length > 0) console.log('\n' + lineas.join('\n'));
}

async function cmdResume(cwd, flags = {}) {
  const deps = buildDeps(cwd);
  const { log, fsm, store, registry, runner } = deps;
  const apiKey = process.env['ANTHROPIC_API_KEY'];

  if (!log.exists()) {
    warn('No hay event log — nada que retomar. Usa "forge run" para iniciar.');
    return;
  }

  const taskStates = log.replayTaskStates();
  const pendientes = [...taskStates.entries()].filter(([, v]) => v.estado !== 'completada');
  const step       = log.lastPipelineStep() ?? fsm.currentStep();

  info(`Retomando desde pipeline step: ${c.azul(step)}`);
  console.log(`  Tareas pendientes: ${pendientes.length}`);

  for (const [id, state] of pendientes) {
    const icon = state.estado === 'fallida' ? c.rojo('✗') : c.amarillo('○');
    console.log(`  ${icon} ${id} — ${state.estado}${state.error ? `: ${state.error.slice(0, 80)}` : ''}`);
  }

  if (pendientes.length === 0) { ok('Todas las tareas registradas están completadas.'); return; }

  // Tareas del ciclo verificado que esperan una decisión humana
  const enRevision = pendientes.filter(([, v]) => v.estado === 'en_revision');
  let decision;
  /** Pausadas a las que no se ha dado decisión: se informa de ellas, sin gastar nada */
  let sinDecision = enRevision.map(([taskId, v]) => ({ taskId, motivo: v.motivo }));
  if (enRevision.length === 0 && flags['decision']) {
    err('No hay ninguna tarea esperando una decisión; --decision no se aplica.');
  }
  if (enRevision.length > 0 && flags['decision']) {
    if (!DECISIONES.includes(flags['decision'])) {
      err(`Decisión no válida: "${flags['decision']}". Opciones: ${DECISIONES.join(', ')}`);
    }
    // --tarea limita la decisión a una; sin él vale para todas las que esperan
    if (flags['tarea'] === 'true') err('--tarea necesita el identificador de la tarea (por ejemplo --tarea T1).');
    const ids = flags['tarea'] ? [flags['tarea']] : enRevision.map(([id]) => id);
    const desconocidas = ids.filter((id) => !enRevision.some(([i]) => i === id));
    if (desconocidas.length > 0) err(`No hay ninguna tarea en revisión llamada: ${desconocidas.join(', ')}`);
    decision = {
      decision: flags['decision'],
      taskIds: ids,
      iteracionesExtra: Number(flags['iteraciones-extra']) || undefined,
      presupuestoExtra: Number(flags['presupuesto-extra']) || undefined,
    };
    sinDecision = sinDecision.filter((t) => !ids.includes(t.taskId));
  }

  const completed = new Set(
    [...taskStates.entries()].filter(([, v]) => v.estado === 'completada').map(([id]) => id)
  );
  const tareasARelanzar = pendientes
    .filter(([id, v]) => v.estado === 'fallida' || v.estado === 'en_progreso' || (decision?.taskIds.includes(id) && v.estado === 'en_revision'))
    .map(([id]) => id)
    .filter(id => !completed.has(id));

  if (tareasARelanzar.length === 0) {
    if (sinDecision.length > 0) {
      informarRevision(sinDecision);
      process.exit(SALIDA.REVISION);
    }
    dim('  Ejecuta "forge run --tasks <json>" con las tareas pendientes para continuar.');
    return;
  }

  let { tareas: todasLasTareas } = cargarTareas(cwd, store.read());
  if (!todasLasTareas.some(t => tareasARelanzar.includes(t.id))) todasLasTareas = tareasDeSesion(cwd);

  const tareasParaCorrer = todasLasTareas.filter(t => tareasARelanzar.includes(t.id));
  if (tareasParaCorrer.length === 0) {
    warn('No se encontraron definiciones de tareas en .sdd/estado-tareas.json ni en la spec activa.');
    return;
  }

  console.log(`\n🔄 Relanzando ${tareasParaCorrer.length} tarea(s) fallidas/interrumpidas...`);

  const motor = await prepararCiclo(cwd, flags, deps, apiKey, false, tareasParaCorrer.map((t) => t.id));
  if (!motor && flags['force'] !== 'true') {
    // Mismo riesgo que en `run`: otra tarea del ciclo pausada tiene codigo de un modelo en el proyecto
    const sinTerminar = tareasSinTerminarEnElProyecto(cwd);
    if (sinTerminar.length > 0) {
      err(`Hay tareas del ciclo verificado sin terminar (${sinTerminar.join(', ')}). El modo clásico ejecutaría en tu equipo, sin aislamiento, código que escribió un modelo. Usa --motor ciclo, o --force si lo asumes.`);
    }
  }
  const orch  = new Orchestrator(registry, fsm, log, store, { cwd, parallelThreshold: 3, stopOnFailure: false, runner, ciclo: motor?.ciclo, decision });
  let result;
  try {
    result = await orch.run(tareasParaCorrer, apiKey);
  } catch (e) {
    err(e instanceof Error ? e.message : String(e));
  }

  console.log('');
  const pausadas = [
    ...sinDecision,
    ...(result.pausedTasks ?? []).map(t => ({ taskId: t.taskId, motivo: t.ciclo?.revision?.motivo, detalle: t.ciclo?.revision?.detalle })),
  ];
  for (const t of result.failedTasks) {
    console.log(`  ${c.rojo('✗')} ${t.taskId} (${t.agente}): ${t.error?.slice(0, 120) ?? 'sin detalle'}`);
  }
  if (pausadas.length > 0) {
    informarRevision(pausadas);
    process.exit(SALIDA.REVISION);
  }
  for (const t of result.abortedTasks ?? []) console.log(`  ${c.amarillo('⏹')} ${t.taskId}: ${t.error}`);
  if (result.ok) {
    ok(`Resume completado: ${result.completedTasks.length} tareas en ${(result.totalDurationMs / 1000).toFixed(1)}s`);
  } else {
    warn(`${result.failedTasks.length} tareas aún fallidas.`);
    process.exit(1);
  }
}

async function cmdRun(cwd, flags) {
  const deps = buildDeps(cwd);
  const { store, log, registry, fsm, runner } = deps;
  const apiKey = process.env['ANTHROPIC_API_KEY'];

  if (!apiKey) warn('ANTHROPIC_API_KEY no está definida — el engine correrá en modo stub.');

  let tasks = [];
  if (flags['tasks']) {
    try {
      const raw = fs.existsSync(flags['tasks'])
        ? fs.readFileSync(flags['tasks'], 'utf8')
        : flags['tasks'];
      tasks = JSON.parse(raw);
    } catch {
      err(`No se pudo parsear --tasks: ${flags['tasks']}`);
    }
  }

  if (tasks.length === 0) {
    const cargadas = cargarTareas(cwd, store.read());
    tasks = cargadas.tareas;
    if (cargadas.origen) dim(`  Tareas leídas de ${path.relative(cwd, cargadas.origen)}`);
  }

  if (tasks.length === 0) {
    err('No hay tareas para ejecutar. Usa --tasks <archivo.json> o genera las tareas con /sdd.tareas.');
  }

  const motor = await prepararCiclo(cwd, flags, deps, apiKey, true);
  if (!motor && flags['force'] !== 'true') {
    // Una sesión del ciclo sin terminar deja código de un modelo en el proyecto: el modo clásico
    // lo ejecutaría en tu equipo, sin aislamiento
    const sinTerminar = tareasSinTerminarEnElProyecto(cwd);
    if (sinTerminar.length > 0) {
      err(`Hay tareas del ciclo verificado sin terminar (${sinTerminar.join(', ')}). El modo clásico ejecutaría en tu equipo, sin aislamiento, código que escribió un modelo. Usa --motor ciclo y forge resume, o --force si lo asumes.`);
    }
  }
  if (motor) {
    fs.mkdirSync(motor.dirMotor, { recursive: true });
    fs.writeFileSync(path.join(motor.dirMotor, 'tareas.json'), JSON.stringify(tasks, null, 2), 'utf8');
  }
  const orch = new Orchestrator(registry, fsm, log, store, {
    cwd,
    parallelThreshold: Number(flags['parallel-threshold'] ?? 3),
    stopOnFailure: flags['stop-on-failure'] !== 'false',
    runner,
    ciclo: motor?.ciclo,
  });

  info(`Ejecutando ${tasks.length} tareas en ${cwd}`);
  let result;
  try {
    result = await orch.run(tasks, apiKey);
  } catch (e) {
    err(e instanceof Error ? e.message : String(e));
  }

  console.log('');
  if (result.pausedTasks?.length > 0) {
    informarRevision(result.pausedTasks.map(t => ({ taskId: t.taskId, motivo: t.ciclo?.revision?.motivo, detalle: t.ciclo?.revision?.detalle })));
    process.exit(SALIDA.REVISION);
  }
  for (const t of result.abortedTasks ?? []) console.log(`  ${c.amarillo('⏹')} ${t.taskId}: ${t.error}`);
  if (result.ok) {
    ok(`Pipeline completado: ${result.completedTasks.length} tareas en ${(result.totalDurationMs / 1000).toFixed(1)}s`);
  } else {
    for (const t of result.failedTasks) {
      console.log(`  ${c.rojo('✗')} ${t.taskId} (${t.agente}): ${t.error?.slice(0, 120) ?? 'sin detalle'}`);
    }
    warn(`${result.failedTasks.length} tareas fallidas. Usa "forge resume" para retomar.`);
    process.exit(1);
  }
}

async function cmdValidate(cwd, flags) {
  const estado   = createStateStore(cwd).read();
  const activa   = specActiva(estado);
  const specPath = flags['spec'] ?? (activa
    ? path.join(cwd, '.sdd', 'especificaciones', String(activa), 'spec.md')
    : null);

  if (!specPath || !fs.existsSync(specPath)) {
    err('No se encontró spec.md. Usa --spec <ruta> o activa una spec con /sdd.especificar.');
  }

  info(`Validando spec: ${specPath}`);
  const irId = String(estado.ir_path ?? 'unknown');
  const spec = parseSpecMd(specPath, irId);

  const validation = validateSpec(spec);
  for (const e of validation.errors)   console.log(`  ${c.rojo('✗')} ${e}`);
  for (const w of validation.warnings) console.log(`  ${c.amarillo('⚠')}  ${w}`);
  if (validation.valid) {
    ok(`Spec válida: ${spec.requirements.length} requisitos`);
  } else {
    warn('Spec con errores — corrígelos antes de implementar.');
  }

  const srcDir = path.join(cwd, 'src');
  if (fs.existsSync(srcDir)) {
    const coverage = checkCoverage(spec, srcDir);
    console.log('');
    info(`Cobertura de requisitos: ${coverage.coveragePercent}% (${coverage.covered.length}/${spec.requirements.length})`);
    dim(`  Archivos analizados: ${coverage.filesScanned}`);
    if (coverage.uncovered.length > 0) {
      console.log('\n  Requisitos sin cobertura:');
      for (const r of coverage.uncovered) {
        console.log(`  ${c.amarillo('○')} ${r.id} [${r.priority}]: ${r.text.slice(0, 80)}`);
      }
    }
  } else {
    dim('  src/ no existe — omitiendo verificación de cobertura.');
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main() {
  const { command, flags } = parseArgs(process.argv);
  const cwd = path.resolve(flags['cwd'] ?? process.cwd());
  circuitBreaker.cwd = cwd;

  switch (command) {
    case 'status':   return cmdStatus(cwd);
    case 'resume':   return cmdResume(cwd, flags);
    case 'run':      return cmdRun(cwd, flags);
    case 'validate': return cmdValidate(cwd, flags);
    default:
      console.log('Comandos disponibles: status | resume | run | validate');
      console.log('Uso: node core/engine-cli.js <comando> [--cwd <path>]');
      process.exit(1);
  }
}

export { main };

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(e => { console.error(e); process.exit(1); });
}
