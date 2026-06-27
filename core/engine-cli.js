/**
 * engine-cli.js — CLI del engine FORGE
 *
 * Uso:
 *   node core/engine-cli.js run    [--cwd <path>] [--tasks <json>]
 *   node core/engine-cli.js resume [--cwd <path>]
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
import { circuitBreaker } from './execution-context.js';

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
const info = (msg) => console.log(`${c.azul('❯')} ${msg}`);
const dim  = (msg) => console.log(c.gris(msg));

// ── Parser de argumentos ──────────────────────────────────────────────────────

function parseArgs(argv) {
  const [,, command = 'status', ...rest] = argv;
  const flags = {};
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i]?.replace(/^--/, '');
    const val = rest[i + 1] ?? 'true';
    if (key) flags[key] = val;
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
  if (estado.spec_activa) console.log(`  Spec:       ${estado.spec_activa}`);
  if (estado.ultima_actualizacion) dim(`  Actualizado: ${estado.ultima_actualizacion}`);

  const avail = fsm.availableTransitions();
  if (avail.length > 0) dim(`  Próximo paso posible: ${avail.join(', ')}`);

  console.log(`\n💰 Presupuesto sesión: ${sessionBudget.resumen()}`);
  console.log(`🔒 Circuit breaker:   ${circuitBreaker.nivel}`);
}

async function cmdResume(cwd) {
  const { log, fsm, store, registry, runner } = buildDeps(cwd);
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

  const completed = new Set(
    [...taskStates.entries()].filter(([, v]) => v.estado === 'completada').map(([id]) => id)
  );
  const tareasARelanzar = pendientes
    .filter(([, v]) => v.estado === 'fallida' || v.estado === 'en_progreso')
    .map(([id]) => id)
    .filter(id => !completed.has(id));

  if (tareasARelanzar.length === 0) {
    dim('  Ejecuta "forge run --tasks <json>" con las tareas pendientes para continuar.');
    return;
  }

  let todasLasTareas = [];
  const estadoTareasPath = path.join(cwd, '.sdd', 'estado-tareas.json');
  if (fs.existsSync(estadoTareasPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(estadoTareasPath, 'utf8'));
      if (Array.isArray(raw['tareas'])) todasLasTareas = raw['tareas'];
    } catch { /* ignorar */ }
  }

  const tareasParaCorrer = todasLasTareas.filter(t => tareasARelanzar.includes(t.id));
  if (tareasParaCorrer.length === 0) {
    warn('No se encontraron definiciones de tareas en .sdd/estado-tareas.json.');
    return;
  }

  console.log(`\n🔄 Relanzando ${tareasParaCorrer.length} tarea(s) fallidas/interrumpidas...`);

  const orch = new Orchestrator(registry, fsm, log, store, { cwd, parallelThreshold: 3, stopOnFailure: false, runner });
  const result = await orch.run(tareasParaCorrer, apiKey);

  console.log('');
  if (result.ok) {
    ok(`Resume completado: ${result.completedTasks.length} tareas en ${(result.totalDurationMs / 1000).toFixed(1)}s`);
  } else {
    for (const t of result.failedTasks) {
      console.log(`  ${c.rojo('✗')} ${t.taskId} (${t.agente}): ${t.error?.slice(0, 120) ?? 'sin detalle'}`);
    }
    warn(`${result.failedTasks.length} tareas aún fallidas.`);
    process.exit(1);
  }
}

async function cmdRun(cwd, flags) {
  const { store, log, registry, fsm, runner } = buildDeps(cwd);
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
    const estadoTareasPath = path.join(cwd, '.sdd', 'estado-tareas.json');
    if (fs.existsSync(estadoTareasPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(estadoTareasPath, 'utf8'));
        if (Array.isArray(raw['tareas'])) tasks = raw['tareas'];
      } catch { /* ignorar */ }
    }
  }

  if (tasks.length === 0) {
    err('No hay tareas para ejecutar. Usa --tasks <archivo.json> o genera un plan con /sdd.planificar.');
  }

  const orch = new Orchestrator(registry, fsm, log, store, {
    cwd,
    parallelThreshold: Number(flags['parallel-threshold'] ?? 3),
    stopOnFailure: flags['stop-on-failure'] !== 'false',
    runner,
  });

  info(`Ejecutando ${tasks.length} tareas en ${cwd}`);
  const result = await orch.run(tasks, apiKey);

  console.log('');
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
  const specPath = flags['spec'] ?? (estado.spec_activa
    ? path.join(cwd, '.sdd', 'especificaciones', String(estado.spec_activa), 'spec.md')
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

  switch (command) {
    case 'status':   return cmdStatus(cwd);
    case 'resume':   return cmdResume(cwd);
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
