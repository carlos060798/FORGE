/**
 * E2E tests del pipeline FORGE — sin LLM, deterministas.
 *
 * Validan que la state machine real (core/) gestiona las transiciones
 * del pipeline correctamente usando directorios temporales con fixtures.
 * No llaman a ningún LLM ni agente externo.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync,
  rmSync,
} from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const CORE = join(ROOT, 'core');

// ── Helpers ────────────────────────────────────────────────────────────────────

function toFileURL(p) {
  return new URL('file:///' + p.replace(/\\/g, '/')).href;
}

async function cargarCore() {
  const [
    { FileSystemStateStore },
    { PipelineStateMachine },
    { EventLog },
  ] = await Promise.all([
    import(toFileURL(join(CORE, 'state-store.js'))),
    import(toFileURL(join(CORE, 'state-machine.js'))),
    import(toFileURL(join(CORE, 'event-log.js'))),
  ]);
  return { FileSystemStateStore, PipelineStateMachine, EventLog };
}

/** Crea un directorio temporal con estructura .sdd/ y estado inicial */
function crearDirTemporal(estadoInicial = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'forge-e2e-'));
  const sdd = join(dir, '.sdd');
  mkdirSync(sdd, { recursive: true });
  mkdirSync(join(sdd, 'observabilidad'), { recursive: true });

  const estado = {
    schemaVersion: '1.0',
    pipeline_step: 'idea',
    ir_generado: false,
    ir_path: null,
    spec_activa: null,
    spec_draft_path: null,
    product_design_aprobado: false,
    plan_activo: false,
    ultima_actualizacion: new Date().toISOString(),
    ...estadoInicial,
  };
  writeFileSync(join(sdd, 'estado.json'), JSON.stringify(estado, null, 2), 'utf8');
  return dir;
}

/** Lee estado.json de un directorio temporal */
function leerEstado(dir) {
  return JSON.parse(readFileSync(join(dir, '.sdd', 'estado.json'), 'utf8'));
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('E2E pipeline — transición inicial idea → discovery', () => {
  let core, dir;

  before(async () => {
    core = await cargarCore();
    dir = crearDirTemporal();
  });

  after(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  test('estado inicial es "idea"', () => {
    const { FileSystemStateStore, PipelineStateMachine, EventLog } = core;
    const store = new FileSystemStateStore(join(dir, '.sdd'));
    const log   = new EventLog(join(dir, '.sdd', 'observabilidad'));
    const fsm   = new PipelineStateMachine(store, log);

    assert.equal(fsm.currentStep(), 'idea');
  });

  test('idea → discovery sin guards — avanza correctamente', () => {
    const { FileSystemStateStore, PipelineStateMachine, EventLog } = core;
    const store = new FileSystemStateStore(join(dir, '.sdd'));
    const log   = new EventLog(join(dir, '.sdd', 'observabilidad'));
    const fsm   = new PipelineStateMachine(store, log);

    const resultado = fsm.advance('discovery');

    assert.ok(resultado.ok, `La transición falló: ${resultado.error}`);
    assert.equal(resultado.from, 'idea');
    assert.equal(resultado.to, 'discovery');
  });

  test('estado.json refleja el nuevo paso después de la transición', () => {
    const estado = leerEstado(dir);
    assert.equal(estado.pipeline_step, 'discovery');
    assert.ok(estado.ultima_actualizacion, 'ultima_actualizacion debe actualizarse');
  });

  test('availableTransitions retorna "ir" desde discovery', () => {
    const { FileSystemStateStore, PipelineStateMachine, EventLog } = core;
    const store = new FileSystemStateStore(join(dir, '.sdd'));
    const log   = new EventLog(join(dir, '.sdd', 'observabilidad'));
    const fsm   = new PipelineStateMachine(store, log);

    const next = fsm.availableTransitions();
    assert.ok(Array.isArray(next), 'availableTransitions debe retornar array');
    assert.ok(next.includes('ir'), `"ir" debe estar en las transiciones disponibles: ${next}`);
  });
});

describe('E2E pipeline — guard discovery → ir (requiere ir_generado)', () => {
  let core, dir;

  before(async () => {
    core = await cargarCore();
    // Empieza en discovery, sin ir_generado
    dir = crearDirTemporal({ pipeline_step: 'discovery', ir_generado: false });
  });

  after(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  test('discovery → ir falla sin ir_generado=true', () => {
    const { FileSystemStateStore, PipelineStateMachine, EventLog } = core;
    const store = new FileSystemStateStore(join(dir, '.sdd'));
    const log   = new EventLog(join(dir, '.sdd', 'observabilidad'));
    const fsm   = new PipelineStateMachine(store, log);

    const resultado = fsm.advance('ir');

    assert.ok(!resultado.ok, 'La transición debería fallar sin ir_generado');
    assert.ok(resultado.error, 'Debe incluir mensaje de error');
    assert.match(resultado.error, /ir_generado/i, 'El error menciona ir_generado');
  });

  test('estado no cambia cuando el guard falla', () => {
    const estado = leerEstado(dir);
    assert.equal(estado.pipeline_step, 'discovery', 'El paso no debe cambiar cuando el guard falla');
  });

  test('discovery → ir avanza con ir_generado=true', () => {
    // Simular que el LLM generó el IR: actualizamos estado.json
    const estadoActual = leerEstado(dir);
    const estadoActualizado = {
      ...estadoActual,
      ir_generado: true,
      ir_path: '.sdd/ir.json',
    };
    writeFileSync(join(dir, '.sdd', 'estado.json'), JSON.stringify(estadoActualizado, null, 2));

    const { FileSystemStateStore, PipelineStateMachine, EventLog } = core;
    const store = new FileSystemStateStore(join(dir, '.sdd'));
    const log   = new EventLog(join(dir, '.sdd', 'observabilidad'));
    const fsm   = new PipelineStateMachine(store, log);

    const resultado = fsm.advance('ir');

    assert.ok(resultado.ok, `La transición falló inesperadamente: ${resultado.error}`);
    assert.equal(leerEstado(dir).pipeline_step, 'ir');
  });
});

describe('E2E pipeline — force bypasa guards', () => {
  let core, dir;

  before(async () => {
    core = await cargarCore();
    dir = crearDirTemporal({ pipeline_step: 'discovery', ir_generado: false });
  });

  after(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  test('discovery → ir con --force avanza aunque ir_generado=false', () => {
    const { FileSystemStateStore, PipelineStateMachine, EventLog } = core;
    const store = new FileSystemStateStore(join(dir, '.sdd'));
    const log   = new EventLog(join(dir, '.sdd', 'observabilidad'));
    const fsm   = new PipelineStateMachine(store, log);

    const resultado = fsm.advance('ir', true); // force=true

    assert.ok(resultado.ok, `Force falló inesperadamente: ${resultado.error}`);
    assert.equal(leerEstado(dir).pipeline_step, 'ir');
  });
});

describe('E2E pipeline — flujo completo idea → spec sin LLM', () => {
  let core, dir;

  before(async () => {
    core = await cargarCore();
    dir = crearDirTemporal();
  });

  after(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  test('idea → discovery → ir → design → spec con guards cumplidos', () => {
    const { FileSystemStateStore, PipelineStateMachine, EventLog } = core;

    // Paso 1: idea → discovery (sin guards)
    {
      const store = new FileSystemStateStore(join(dir, '.sdd'));
      const fsm   = new PipelineStateMachine(store, new EventLog(join(dir, '.sdd', 'observabilidad')));
      const r = fsm.advance('discovery');
      assert.ok(r.ok, `idea→discovery falló: ${r.error}`);
    }

    // Paso 2: simular que LLM generó el IR
    {
      const e = leerEstado(dir);
      writeFileSync(join(dir, '.sdd', 'estado.json'), JSON.stringify(
        { ...e, ir_generado: true, ir_path: '.sdd/ir.json' }, null, 2
      ));
    }

    // Paso 3: discovery → ir (guard: ir_generado)
    {
      const store = new FileSystemStateStore(join(dir, '.sdd'));
      const fsm   = new PipelineStateMachine(store, new EventLog(join(dir, '.sdd', 'observabilidad')));
      const r = fsm.advance('ir');
      assert.ok(r.ok, `discovery→ir falló: ${r.error}`);
    }

    // Paso 4: simular aprobación del diseño
    {
      const e = leerEstado(dir);
      writeFileSync(join(dir, '.sdd', 'estado.json'), JSON.stringify(
        { ...e, product_design_aprobado: true }, null, 2
      ));
    }

    // Paso 5: ir → design (guard: ir_path)
    {
      const store = new FileSystemStateStore(join(dir, '.sdd'));
      const fsm   = new PipelineStateMachine(store, new EventLog(join(dir, '.sdd', 'observabilidad')));
      const r = fsm.advance('design');
      assert.ok(r.ok, `ir→design falló: ${r.error}`);
    }

    // Paso 6: design → spec (guard: product_design_aprobado)
    {
      const store = new FileSystemStateStore(join(dir, '.sdd'));
      const fsm   = new PipelineStateMachine(store, new EventLog(join(dir, '.sdd', 'observabilidad')));
      const r = fsm.advance('spec');
      assert.ok(r.ok, `design→spec falló: ${r.error}`);
    }

    const estadoFinal = leerEstado(dir);
    assert.equal(estadoFinal.pipeline_step, 'spec');
  });
});

describe('E2E pipeline — forceStep y reset', () => {
  let core, dir;

  before(async () => {
    core = await cargarCore();
    dir = crearDirTemporal({ pipeline_step: 'code' });
  });

  after(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  test('forceStep salta directamente a cualquier paso', () => {
    const { FileSystemStateStore, PipelineStateMachine, EventLog } = core;
    const store = new FileSystemStateStore(join(dir, '.sdd'));
    const fsm   = new PipelineStateMachine(store, new EventLog(join(dir, '.sdd', 'observabilidad')));

    fsm.forceStep('idea');

    assert.equal(leerEstado(dir).pipeline_step, 'idea');
  });

  test('después de forceStep("idea"), currentStep retorna "idea"', () => {
    const { FileSystemStateStore, PipelineStateMachine, EventLog } = core;
    const store = new FileSystemStateStore(join(dir, '.sdd'));
    const fsm   = new PipelineStateMachine(store, new EventLog(join(dir, '.sdd', 'observabilidad')));

    assert.equal(fsm.currentStep(), 'idea');
  });
});

describe('E2E pipeline — validateCurrentStep', () => {
  let core, dir;

  before(async () => {
    core = await cargarCore();
    // En discovery sin ir_generado: debería reportar precondición pendiente
    dir = crearDirTemporal({ pipeline_step: 'discovery', ir_generado: false });
  });

  after(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  test('validateCurrentStep retorna array (vacío o con strings)', () => {
    const { FileSystemStateStore, PipelineStateMachine, EventLog } = core;
    const store = new FileSystemStateStore(join(dir, '.sdd'));
    const fsm   = new PipelineStateMachine(store, new EventLog(join(dir, '.sdd', 'observabilidad')));

    const warns = fsm.validateCurrentStep();

    assert.ok(Array.isArray(warns), 'validateCurrentStep debe retornar array');
  });

  test('validateCurrentStep en "idea" retorna vacío (no hay precondiciones)', () => {
    const ideaDir = crearDirTemporal({ pipeline_step: 'idea' });
    try {
      const { FileSystemStateStore, PipelineStateMachine, EventLog } = core;
      const store = new FileSystemStateStore(join(ideaDir, '.sdd'));
      const fsm   = new PipelineStateMachine(store, new EventLog(join(ideaDir, '.sdd', 'observabilidad')));

      const warns = fsm.validateCurrentStep();
      assert.equal(warns.length, 0, `"idea" no debería tener precondiciones: ${warns}`);
    } finally {
      rmSync(ideaDir, { recursive: true, force: true });
    }
  });
});

describe('E2E pipeline — transición a paso inválido', () => {
  let core, dir;

  before(async () => {
    core = await cargarCore();
    dir = crearDirTemporal({ pipeline_step: 'idea' });
  });

  after(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  test('avanzar a un paso no adyacente falla sin --force', () => {
    const { FileSystemStateStore, PipelineStateMachine, EventLog } = core;
    const store = new FileSystemStateStore(join(dir, '.sdd'));
    const fsm   = new PipelineStateMachine(store, new EventLog(join(dir, '.sdd', 'observabilidad')));

    // Intentar saltar de idea directamente a code (saltándose todo el pipeline)
    const resultado = fsm.advance('code');

    assert.ok(!resultado.ok, 'Saltar de idea a code sin guards debería fallar');
  });
});
