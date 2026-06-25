/**
 * engine-cli.ts — CLI del engine FORGE
 *
 * Punto de entrada para el motor ejecutable. Los comandos /sdd.* existentes
 * siguen funcionando como siempre; este CLI es la fachada de código real.
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { createStateStore } from './state-store.js';
import { PipelineStateMachine } from './state-machine.js';
import { EventLog } from './event-log.js';
import { createAgentRegistry } from './agent-registry.js';
import { Orchestrator } from './orchestrator.js';
import { detectStack } from './stack-detector.js';
import { runnerForStack } from './runners/index.js';
import { parseSpecMd, validateSpec, checkCoverage } from './spec.js';
import type { Task } from './orchestrator.js';

// ── Colores de terminal ────────────────────────────────────────────────────────

const tty = process.stdout.isTTY;
const c = {
  verde: (s: string) => tty ? `\x1b[0;32m${s}\x1b[0m` : s,
  amarillo: (s: string) => tty ? `\x1b[1;33m${s}\x1b[0m` : s,
  rojo: (s: string) => tty ? `\x1b[0;31m${s}\x1b[0m` : s,
  azul: (s: string) => tty ? `\x1b[0;34m${s}\x1b[0m` : s,
  gris: (s: string) => tty ? `\x1b[0;90m${s}\x1b[0m` : s,
};

const ok  = (msg: string) => console.log(`${c.verde('✓')} ${msg}`);
const warn = (msg: string) => console.log(`${c.amarillo('⚠')}  ${msg}`);
const err  = (msg: string) => { console.error(`${c.rojo('✗')} ${msg}`); process.exit(1); };
const info = (msg: string) => console.log(`${c.azul('❯')} ${msg}`);
const dim  = (msg: string) => console.log(c.gris(msg));

// ── Parser de argumentos mínimo ────────────────────────────────────────────────

function parseArgs(argv: string[]): { command: string; flags: Record<string, string> } {
  const [, , command = 'status', ...rest] = argv;
  const flags: Record<string, string> = {};
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i]?.replace(/^--/, '');
    const val = rest[i + 1] ?? 'true';
    if (key) flags[key] = val;
  }
  return { command, flags };
}

// ── Fábrica de dependencias ────────────────────────────────────────────────────

function buildDeps(cwd: string) {
  const forgeRoot = path.resolve(__dirname ?? process.cwd(), '..');
  const sddDir = path.join(cwd, '.sdd');
  const store = createStateStore(cwd);
  const log = new EventLog(sddDir);
  const registry = createAgentRegistry(forgeRoot);
  const fsm = new PipelineStateMachine(store, log);
  const stack = detectStack(cwd);
  const runner = runnerForStack(stack, cwd);

  return { store, log, registry, fsm, stack, runner, sddDir };
}

// ── Comandos ───────────────────────────────────────────────────────────────────

async function cmdStatus(cwd: string): Promise<void> {
  const { store, log, fsm, stack } = buildDeps(cwd);
  const estado = store.read();
  const step = fsm.currentStep();
  const taskStates = log.replayTaskStates();
  const completed = [...taskStates.values()].filter(v => v.estado === 'completada').length;
  const total = taskStates.size;

  info(`Proyecto: ${cwd}`);
  console.log(`  Pipeline:   ${c.azul(step)}`);
  console.log(`  Stack:      ${stack.lenguaje} / ${stack.runtime}${stack.framework ? ` (${stack.framework})` : ''}`);
  console.log(`  Tareas:     ${completed}/${total} completadas`);
  if (estado.spec_activa) console.log(`  Spec:       ${estado.spec_activa}`);
  if (estado.ultima_actualizacion) dim(`  Actualizado: ${estado.ultima_actualizacion}`);

  const avail = fsm.availableTransitions();
  if (avail.length > 0) {
    dim(`  Próximo paso posible: ${avail.join(', ')}`);
  }
}

async function cmdResume(cwd: string): Promise<void> {
  const { log, fsm } = buildDeps(cwd);

  if (!log.exists()) {
    warn('No hay event log — nada que retomar. Usa "forge run" para iniciar.');
    return;
  }

  const taskStates = log.replayTaskStates();
  const pendientes = [...taskStates.entries()].filter(([, v]) => v.estado !== 'completada');
  const step = log.lastPipelineStep() ?? fsm.currentStep();

  info(`Retomando desde pipeline step: ${c.azul(step)}`);
  console.log(`  Tareas pendientes: ${pendientes.length}`);

  for (const [id, state] of pendientes) {
    const icon = state.estado === 'fallida' ? c.rojo('✗') : c.amarillo('○');
    console.log(`  ${icon} ${id} — ${state.estado}${state.error ? `: ${state.error.slice(0, 80)}` : ''}`);
  }

  if (pendientes.length === 0) {
    ok('Todas las tareas registradas están completadas.');
  } else {
    dim('  Ejecuta "forge run --tasks <json>" con las tareas pendientes para continuar.');
  }
}

async function cmdRun(cwd: string, flags: Record<string, string>): Promise<void> {
  const { store, log, registry, fsm, runner } = buildDeps(cwd);
  const apiKey = process.env['ANTHROPIC_API_KEY'];

  if (!apiKey) {
    warn('ANTHROPIC_API_KEY no está definida — el engine correrá en modo stub (sin LLM real).');
  }

  // Cargar tareas desde archivo JSON o flag --tasks
  let tasks: Task[] = [];
  if (flags['tasks']) {
    try {
      const raw = fs.existsSync(flags['tasks'])
        ? fs.readFileSync(flags['tasks'], 'utf8')
        : flags['tasks'];
      tasks = JSON.parse(raw) as Task[];
    } catch {
      err(`No se pudo parsear --tasks: ${flags['tasks']}`);
    }
  }

  if (tasks.length === 0) {
    // Intentar leer desde .sdd/estado-tareas.json
    const estadoTareasPath = path.join(cwd, '.sdd', 'estado-tareas.json');
    if (fs.existsSync(estadoTareasPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(estadoTareasPath, 'utf8')) as Record<string, unknown>;
        if (Array.isArray(raw['tareas'])) {
          tasks = raw['tareas'] as Task[];
        }
      } catch { /* ignorar */ }
    }
  }

  if (tasks.length === 0) {
    err('No hay tareas para ejecutar. Usa --tasks <archivo.json> o genera un plan primero con /sdd.planificar.');
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

async function cmdValidate(cwd: string, flags: Record<string, string>): Promise<void> {
  const estado = createStateStore(cwd).read();
  const specPath = flags['spec'] ?? (estado.spec_activa
    ? path.join(cwd, '.sdd', 'especificaciones', String(estado.spec_activa), 'spec.md')
    : null);

  if (!specPath || !fs.existsSync(specPath as string)) {
    err('No se encontró spec.md. Usa --spec <ruta> o activa una spec con /sdd.especificar.');
  }

  info(`Validando spec: ${specPath}`);
  const irId = String(estado.ir_path ?? 'unknown');
  const spec = parseSpecMd(specPath as string, irId);

  // Validación estructural
  const validation = validateSpec(spec);
  if (validation.errors.length > 0) {
    for (const e of validation.errors) console.log(`  ${c.rojo('✗')} ${e}`);
  }
  if (validation.warnings.length > 0) {
    for (const w of validation.warnings) console.log(`  ${c.amarillo('⚠')}  ${w}`);
  }
  if (validation.valid) {
    ok(`Spec válida: ${spec.requirements.length} requisitos`);
  } else {
    warn('Spec con errores — corrígelos antes de implementar.');
  }

  // Cobertura req→code
  const srcDir = path.join(cwd, 'src');
  if (fs.existsSync(srcDir)) {
    const coverage = checkCoverage(spec, srcDir);
    console.log('');
    info(`Cobertura de requisitos: ${coverage.coveragePercent}% (${coverage.covered.length}/${spec.requirements.length})`);
    dim(`  Archivos analizados: ${coverage.filesScanned}`);
    if (coverage.uncovered.length > 0) {
      console.log(`\n  Requisitos sin cobertura:`);
      for (const r of coverage.uncovered) {
        console.log(`  ${c.amarillo('○')} ${r.id} [${r.priority}]: ${r.text.slice(0, 80)}`);
      }
    }
  } else {
    dim('  src/ no existe — omitiendo verificación de cobertura.');
  }
}

// ── Entry point ────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { command, flags } = parseArgs(process.argv);
  const cwd = path.resolve(flags['cwd'] ?? process.cwd());

  switch (command) {
    case 'status':  return cmdStatus(cwd);
    case 'resume':  return cmdResume(cwd);
    case 'run':     return cmdRun(cwd, flags);
    case 'validate':return cmdValidate(cwd, flags);
    default:
      console.log(`Comandos disponibles: status | resume | run | validate`);
      console.log(`Uso: node core/engine-cli.js <comando> [--cwd <path>]`);
      process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
