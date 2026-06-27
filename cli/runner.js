/**
 * cli/runner.js — Runner portable del pipeline FORGE sin LLM
 *
 * Usa la PipelineStateMachine del core/ compilado para gestionar
 * el estado del pipeline de forma determinista. Las transiciones
 * que requieren LLM se delegan al adaptador del host (Claude Code,
 * otro agente, o artefactos Spec Kit). El runner solo controla lo
 * que puede hacerse sin modelo: leer estado, validar transiciones,
 * forzar avances manuales, y exportar el estado como Spec Kit.
 *
 * Comandos:
 *   forge status          → estado actual + transiciones disponibles
 *   forge step <paso>     → avanzar al paso indicado (con guards)
 *   forge step <paso> --force → forzar sin guards (recuperación)
 *   forge state           → volcar estado.json formateado
 *   forge validate        → validar que el paso actual cumple precondiciones
 *   forge reset           → resetear pipeline a 'idea'
 */

import {
  existsSync, mkdirSync, readFileSync, writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

// ── Carga lazy del core compilado ─────────────────────────────────────────────
// Usamos import() dinámico para que el runner funcione aunque dist/ no exista
// (graceful degradation si el TS no se ha compilado).

function toFileURL(p) {
  // En Windows, import() necesita file:// para rutas absolutas
  return new URL('file:///' + p.replace(/\\/g, '/')).href;
}

async function cargarCore(cwd) {
  // Buscar dist/core/ relativo al CWD o relativo a este archivo (instalación global)
  const distDir  = join(cwd, 'dist', 'core');
  const selfDir  = resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'), '..', '..', 'dist', 'core');
  const base = existsSync(distDir) ? distDir : existsSync(selfDir) ? selfDir : null;

  if (!base) {
    throw new Error(
      'dist/core/ no encontrado. Compila primero con: npx tsc\n'
      + 'O instala desde el paquete publicado.'
    );
  }

  const [
    { FileSystemStateStore },
    { PipelineStateMachine },
    { EventLog },
  ] = await Promise.all([
    import(toFileURL(join(base, 'state-store.js'))),
    import(toFileURL(join(base, 'state-machine.js'))),
    import(toFileURL(join(base, 'event-log.js'))),
  ]);

  return { FileSystemStateStore, PipelineStateMachine, EventLog };
}

// ── Helpers visuales ─────────────────────────────────────────────────────────

const COLORES = {
  verde:    (s) => `\x1b[32m${s}\x1b[0m`,
  amarillo: (s) => `\x1b[33m${s}\x1b[0m`,
  rojo:     (s) => `\x1b[31m${s}\x1b[0m`,
  cyan:     (s) => `\x1b[36m${s}\x1b[0m`,
  negrita:  (s) => `\x1b[1m${s}\x1b[0m`,
  gris:     (s) => `\x1b[90m${s}\x1b[0m`,
};

const STEP_ICONS = {
  idea:      '💡',
  discovery: '🔍',
  ir:        '📋',
  design:    '🎨',
  spec:      '📝',
  plan:      '🏗️',
  tasks:     '✅',
  code:      '💻',
  done:      '🚀',
};

const STEP_LABELS = {
  idea:      'Idea inicial',
  discovery: 'Descubrimiento',
  ir:        'Requisitos interpretados (IR)',
  design:    'Diseño del producto',
  spec:      'Especificación técnica',
  plan:      'Plan de arquitectura',
  tasks:     'Tareas generadas',
  code:      'Implementación',
  done:      'Completado',
};

const STEPS_PIPELINE = ['idea', 'discovery', 'ir', 'design', 'spec', 'plan', 'tasks', 'code', 'done'];

function dibujarPipeline(stepActual) {
  const idx = STEPS_PIPELINE.indexOf(stepActual);
  const partes = STEPS_PIPELINE.map((s, i) => {
    const icono = STEP_ICONS[s];
    if (i < idx)  return COLORES.verde(`${icono} ${s}`);
    if (i === idx) return COLORES.negrita(COLORES.cyan(`${icono} ${s} ◄`));
    return COLORES.gris(`${icono} ${s}`);
  });
  return partes.join('  →  ');
}

// ── Subcomandos ───────────────────────────────────────────────────────────────

async function cmdStatus(cwd) {
  const { FileSystemStateStore, PipelineStateMachine, EventLog } = await cargarCore(cwd);
  const store = new FileSystemStateStore(join(cwd, '.sdd'));
  const log   = new EventLog(join(cwd, '.sdd', 'observabilidad'));
  const fsm   = new PipelineStateMachine(store, log);

  const step  = fsm.currentStep();
  const next  = fsm.availableTransitions();
  const warns = fsm.validateCurrentStep();
  const estado = store.read();

  console.log('');
  console.log(COLORES.negrita('FORGE — Estado del pipeline'));
  console.log('');
  console.log(dibujarPipeline(step));
  console.log('');
  console.log(`Paso actual:    ${COLORES.cyan(step)} — ${STEP_LABELS[step] ?? step}`);
  console.log(`Actualizado:    ${estado.ultima_actualizacion ?? COLORES.gris('n/a')}`);
  console.log('');

  if (next.length > 0) {
    console.log(`Siguiente paso: ${next.map(s => COLORES.verde(s)).join(' | ')}`);
    console.log(`  → forge step ${next[0]}`);
  } else {
    console.log(COLORES.verde('Pipeline completado ✓'));
  }

  if (warns.length > 0) {
    console.log('');
    console.log(COLORES.amarillo('⚠️  Precondiciones pendientes:'));
    warns.forEach(w => console.log(`   • ${w}`));
  }

  // Resumen de artefactos presentes
  const artefactos = [
    ['.sdd/ir.json',          'IR generado'],
    ['.sdd/estado.json',      'Estado persistido'],
    ['.sdd/arquitectura',     'Plan/ADRs'],
    ['.sdd/observabilidad',   'Observabilidad'],
  ];
  const presentes = artefactos.filter(([p]) => existsSync(join(cwd, p)));
  if (presentes.length > 0) {
    console.log('');
    console.log('Artefactos: ' + presentes.map(([, l]) => COLORES.verde(l)).join(' · '));
  }

  console.log('');
}

async function cmdStep(args, cwd) {
  const paso   = args[0];
  const force  = args.includes('--force');

  if (!paso) {
    console.error('✗ Uso: forge step <paso> [--force]');
    console.error('  Pasos válidos: ' + STEPS_PIPELINE.join(', '));
    process.exit(1);
  }

  if (!STEPS_PIPELINE.includes(paso)) {
    console.error(`✗ Paso desconocido: "${paso}". Válidos: ${STEPS_PIPELINE.join(', ')}`);
    process.exit(1);
  }

  const { FileSystemStateStore, PipelineStateMachine, EventLog } = await cargarCore(cwd);
  const store = new FileSystemStateStore(join(cwd, '.sdd'));
  const log   = new EventLog(join(cwd, '.sdd', 'observabilidad'));
  const fsm   = new PipelineStateMachine(store, log);

  const desde = fsm.currentStep();

  if (desde === paso) {
    console.log(COLORES.amarillo(`Ya estás en el paso "${paso}". No hay cambio.`));
    return;
  }

  const resultado = fsm.advance(paso, force);

  if (!resultado.ok) {
    console.error(`✗ ${resultado.error}`);
    if (!force) {
      console.error(`  Para forzar la transición: forge step ${paso} --force`);
    }
    process.exit(1);
  }

  console.log(`${COLORES.verde('✓')} Pipeline avanzado: ${COLORES.cyan(desde)} → ${COLORES.verde(paso)}`);
  console.log(`  ${STEP_LABELS[paso]}`);
  if (force) console.log(COLORES.amarillo('  (modo --force: guards omitidos)'));

  const next = fsm.availableTransitions();
  if (next.length > 0) {
    console.log(`  Siguiente: forge step ${next[0]}`);
  }
}

async function cmdState(args, cwd) {
  const sddPath = join(cwd, '.sdd', 'estado.json');
  if (!existsSync(sddPath)) {
    console.error('✗ estado.json no encontrado. Ejecuta: forge init');
    process.exit(1);
  }
  const estado = JSON.parse(readFileSync(sddPath, 'utf8'));
  console.log(JSON.stringify(estado, null, 2));
}

async function cmdValidate(cwd) {
  const { FileSystemStateStore, PipelineStateMachine, EventLog } = await cargarCore(cwd);
  const store = new FileSystemStateStore(join(cwd, '.sdd'));
  const log   = new EventLog(join(cwd, '.sdd', 'observabilidad'));
  const fsm   = new PipelineStateMachine(store, log);

  const step  = fsm.currentStep();
  const warns = fsm.validateCurrentStep();

  if (warns.length === 0) {
    console.log(COLORES.verde(`✓ Paso "${step}" cumple todas las precondiciones`));
    process.exit(0);
  } else {
    console.error(COLORES.rojo(`✗ Paso "${step}" tiene ${warns.length} precondición(es) incumplida(s):`));
    warns.forEach(w => console.error(`  • ${w}`));
    process.exit(1);
  }
}

async function cmdReset(args, cwd) {
  const force = args.includes('--force');
  if (!force) {
    console.error('✗ forge reset requiere --force por seguridad.');
    console.error('  forge reset --force  → resetea el pipeline a "idea" sin borrar .sdd/');
    process.exit(1);
  }

  const { FileSystemStateStore, PipelineStateMachine, EventLog } = await cargarCore(cwd);
  const store = new FileSystemStateStore(join(cwd, '.sdd'));
  const log   = new EventLog(join(cwd, '.sdd', 'observabilidad'));
  const fsm   = new PipelineStateMachine(store, log);

  const desde = fsm.currentStep();
  fsm.forceStep('idea');
  console.log(COLORES.amarillo(`Pipeline reseteado: ${desde} → idea`));
  console.log('Los artefactos .sdd/ se conservan. Usa forge status para verificar.');
}

// ── Punto de entrada ──────────────────────────────────────────────────────────

export async function runForgeCommand(subcomando, args, cwd = process.cwd()) {
  try {
    switch (subcomando) {
      case 'status':   await cmdStatus(cwd);         break;
      case 'step':     await cmdStep(args, cwd);     break;
      case 'state':    await cmdState(args, cwd);    break;
      case 'validate': await cmdValidate(cwd);       break;
      case 'reset':    await cmdReset(args, cwd);    break;
      default:
        console.error(`✗ Subcomando desconocido: "${subcomando}"`);
        process.exit(1);
    }
  } catch (e) {
    console.error(`✗ Error: ${e.message}`);
    process.exit(1);
  }
}
