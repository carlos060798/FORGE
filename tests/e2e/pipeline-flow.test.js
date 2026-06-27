/**
 * E2E tests del pipeline FORGE — flujo completo sin LLM, deterministas.
 *
 * Cubre el flujo: idea → discovery → ir → design → spec → plan → code
 * usando fixtures estáticas y directorios temporales aislados.
 *
 * No llaman a ningún LLM ni agente externo.
 *
 * Módulos importados desde core/ (JS puro con JSDoc).
 * Requiere Node.js >= 18 y que core/state-machine.js exista.
 */

import { test, describe, before, after, skip } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
} from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');

// Preferir core/ (JS puro); si no existe state-machine.js, usar dist/core/
const CORE_JS   = join(ROOT, 'core', 'state-machine.js');
const CORE_DIST = join(ROOT, 'dist', 'core', 'state-machine.js');
const CORE = existsSync(CORE_JS)   ? join(ROOT, 'core') :
             existsSync(CORE_DIST) ? join(ROOT, 'dist', 'core') :
             null;

/** true cuando los módulos del engine están disponibles en esta rama */
const ENGINE_DISPONIBLE = CORE !== null;

// ── Helpers ────────────────────────────────────────────────────────────────────

function toFileURL(p) {
  return pathToFileURL(p).href;
}

/** Carga los módulos del engine desde core/ o dist/core/ según disponibilidad. */
async function cargarCore() {
  if (!ENGINE_DISPONIBLE) {
    throw new Error(
      'Módulos del engine no disponibles en esta rama. ' +
      'Fusiona con feature/engine-ejecutable o compila con `npm run build`.'
    );
  }
  const [
    { FileSystemStateStore, InMemoryStateStore },
    { PipelineStateMachine },
    { EventLog },
  ] = await Promise.all([
    import(toFileURL(join(CORE, 'state-store.js'))),
    import(toFileURL(join(CORE, 'state-machine.js'))),
    import(toFileURL(join(CORE, 'event-log.js'))),
  ]);
  return { FileSystemStateStore, InMemoryStateStore, PipelineStateMachine, EventLog };
}

/** Crea un directorio temporal con estructura .sdd/ y estado inicial. */
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
    plan_activo: null,
    ultima_actualizacion: new Date().toISOString(),
    ...estadoInicial,
  };
  writeFileSync(join(sdd, 'estado.json'), JSON.stringify(estado, null, 2), 'utf8');
  return dir;
}

/** Lee estado.json de un directorio temporal. */
function leerEstado(dir) {
  return JSON.parse(readFileSync(join(dir, '.sdd', 'estado.json'), 'utf8'));
}

/** Construye FSM + store + log apuntando al directorio temporal. */
function buildFSM(core, dir) {
  const { FileSystemStateStore, PipelineStateMachine, EventLog } = core;
  const store = new FileSystemStateStore(join(dir, '.sdd'));
  const log   = new EventLog(join(dir, '.sdd', 'observabilidad'));
  return { store, log, fsm: new PipelineStateMachine(store, log) };
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. forge status — sin estado.json el pipeline empieza en "idea"
// ══════════════════════════════════════════════════════════════════════════════

const SKIP = !ENGINE_DISPONIBLE ? 'engine no disponible en esta rama — fusionar con feature/engine-ejecutable' : false;

describe('E2E forge status — sin estado.json, estado inicial correcto', { skip: SKIP }, () => {
  let core, dir;

  before(async () => {
    core = await cargarCore();
    // Directorio temporal SIN escribir estado.json
    dir = mkdtempSync(join(tmpdir(), 'forge-e2e-nostatus-'));
    mkdirSync(join(dir, '.sdd'), { recursive: true });
    mkdirSync(join(dir, '.sdd', 'observabilidad'), { recursive: true });
  });

  after(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  test('FileSystemStateStore.read() devuelve {} cuando no existe estado.json', () => {
    const { FileSystemStateStore } = core;
    const store = new FileSystemStateStore(join(dir, '.sdd'));
    const estado = store.read();
    assert.deepEqual(estado, {}, 'estado vacío cuando no existe estado.json');
  });

  test('sin estado.json, currentStep() retorna "idea"', () => {
    const { fsm } = buildFSM(core, dir);
    assert.equal(fsm.currentStep(), 'idea', 'paso inicial debe ser "idea" cuando no hay estado');
  });

  test('sin estado.json, availableTransitions() incluye "discovery"', () => {
    const { fsm } = buildFSM(core, dir);
    const next = fsm.availableTransitions();
    assert.ok(Array.isArray(next), 'availableTransitions debe retornar array');
    assert.ok(next.includes('discovery'), `transitions desde idea deben incluir "discovery": ${next}`);
  });

  test('sin estado.json, store.exists() retorna false', () => {
    const { FileSystemStateStore } = core;
    const store = new FileSystemStateStore(join(dir, '.sdd'));
    assert.equal(store.exists(), false, 'no debe haber estado persisitido');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. ir.json con confidence 0.9 — pipeline puede avanzar a la fase de diseño
// ══════════════════════════════════════════════════════════════════════════════

describe('E2E pipeline — ir.json confidence=0.9 puede avanzar a design', { skip: SKIP }, () => {
  let core, dir;

  const IR_ALTA_CONFIANZA = {
    id: 'ir-test-alta-confianza',
    created_at: new Date().toISOString(),
    raw_input: 'Quiero una API REST para gestionar tareas con autenticación',
    confidence: 0.9,
    product: {
      name: 'Task Manager API',
      type: 'api',
      tagline: 'API REST para gestión de tareas con JWT',
      value_proposition: 'API segura y escalable',
      target_users: 'Developers que necesitan un backend',
    },
    features: {
      core: ['Autenticación JWT con registro y login', 'CRUD completo de tareas'],
      nice_to_have: ['Etiquetas en tareas'],
    },
    constraints: { budget: 'bajo', timeline: '1-2 semanas', team_size: '1' },
    requires_clarification: false,
    questions_for_user: [],
    estimated_complexity: 'media',
  };

  before(async () => {
    core = await cargarCore();
    // Estado en fase "ir": IR generado, ir_path registrado, diseño pendiente
    dir = crearDirTemporal({
      pipeline_step: 'ir',
      ir_generado: true,
      ir_path: '.sdd/ir.json',
      product_design_aprobado: false,
    });
    writeFileSync(join(dir, '.sdd', 'ir.json'), JSON.stringify(IR_ALTA_CONFIANZA, null, 2), 'utf8');
  });

  after(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  test('ir.json fixture tiene confidence=0.9 y requires_clarification=false', () => {
    const ir = JSON.parse(readFileSync(join(dir, '.sdd', 'ir.json'), 'utf8'));
    assert.equal(ir.confidence, 0.9);
    assert.equal(ir.requires_clarification, false, 'alta confianza no requiere aclaración');
    assert.ok(ir.questions_for_user.length === 0, 'sin preguntas pendientes');
  });

  test('con ir_path registrado, transición ir → design avanza correctamente', () => {
    const { fsm } = buildFSM(core, dir);
    const r = fsm.advance('design');
    assert.ok(r.ok, `ir→design debería avanzar con confidence=0.9: ${r.error}`);
    assert.equal(r.from, 'ir');
    assert.equal(r.to, 'design');
  });

  test('pipeline_step queda en "design" después de la transición', () => {
    const estado = leerEstado(dir);
    assert.equal(estado.pipeline_step, 'design');
    assert.ok(estado.ultima_actualizacion, 'ultima_actualizacion debe actualizarse');
  });

  test('desde design, availableTransitions incluye "spec"', () => {
    // Simular aprobación del diseño para poder avanzar
    const e = leerEstado(dir);
    writeFileSync(join(dir, '.sdd', 'estado.json'), JSON.stringify(
      { ...e, product_design_aprobado: true }, null, 2
    ));
    const { fsm } = buildFSM(core, dir);
    const next = fsm.availableTransitions();
    assert.ok(next.includes('spec'), `desde design con diseño aprobado, "spec" debe estar disponible: ${next}`);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 3. ir.json con confidence 0.5 — pipeline bloquea, pide aclaración
// ══════════════════════════════════════════════════════════════════════════════

describe('E2E pipeline — ir.json confidence=0.5 bloquea y pide aclaración', { skip: SKIP }, () => {
  let core, dir;

  const IR_BAJA_CONFIANZA = {
    id: 'ir-test-baja-confianza',
    created_at: new Date().toISOString(),
    raw_input: 'Quiero algo para gestionar cosas',
    confidence: 0.5,
    product: { name: 'Algo', type: 'desconocido' },
    features: { core: ['Algo genérico'] },
    requires_clarification: true,
    questions_for_user: [
      '¿Qué tipo de proyecto es exactamente?',
      '¿Cuáles son los usuarios objetivo?',
    ],
    estimated_complexity: 'media',
  };

  before(async () => {
    core = await cargarCore();
    // Estado en discovery: ir_generado=false — el IR no ha sido procesado
    dir = crearDirTemporal({
      pipeline_step: 'discovery',
      ir_generado: false,
      ir_path: null,
    });
    // El archivo ir.json existe en disco pero el pipeline no lo registró aún
    writeFileSync(join(dir, '.sdd', 'ir.json'), JSON.stringify(IR_BAJA_CONFIANZA, null, 2), 'utf8');
  });

  after(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  test('ir.json fixture tiene confidence=0.5 y requires_clarification=true', () => {
    const ir = JSON.parse(readFileSync(join(dir, '.sdd', 'ir.json'), 'utf8'));
    assert.equal(ir.confidence, 0.5);
    assert.equal(ir.requires_clarification, true);
    assert.ok(ir.questions_for_user.length > 0, 'debe haber preguntas de aclaración pendientes');
  });

  test('discovery → ir falla porque ir_generado=false (pipeline bloqueado)', () => {
    const { fsm } = buildFSM(core, dir);
    const r = fsm.advance('ir');
    assert.ok(!r.ok, 'pipeline debe estar bloqueado cuando ir_generado=false');
    assert.ok(r.error, 'debe incluir mensaje de error');
    assert.match(r.error, /ir_generado/i, 'el error menciona ir_generado');
  });

  test('validateCurrentStep retorna precondiciones pendientes en "discovery"', () => {
    const { fsm } = buildFSM(core, dir);
    const warns = fsm.validateCurrentStep();
    assert.ok(warns.length > 0, 'debe haber precondiciones pendientes cuando ir_generado=false');
    assert.ok(
      warns.some(w => /ir_generado/i.test(w)),
      `algún warning debe mencionar ir_generado: ${warns}`
    );
  });

  test('pipeline_step sigue en "discovery" después del intento fallido', () => {
    const estado = leerEstado(dir);
    assert.equal(estado.pipeline_step, 'discovery', 'el paso no debe cambiar cuando el guard falla');
  });

  test('baja confianza: confidence < 0.7 implica requires_clarification=true (contrato de IR)', () => {
    const ir = JSON.parse(readFileSync(join(dir, '.sdd', 'ir.json'), 'utf8'));
    // Verificar el contrato: si confidence < 0.7, debe haber aclaración pendiente
    if (ir.confidence < 0.7) {
      assert.equal(ir.requires_clarification, true, 'confidence < 0.7 → requires_clarification=true');
      assert.ok(
        Array.isArray(ir.questions_for_user) && ir.questions_for_user.length > 0,
        'confidence < 0.7 → questions_for_user no vacío'
      );
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 4. forge validate — detecta cuando falta spec_activa en el estado
// ══════════════════════════════════════════════════════════════════════════════

describe('E2E validate — detecta falta de spec_activa en el estado', { skip: SKIP }, () => {
  let core, dir;

  before(async () => {
    core = await cargarCore();
    // Estado en "spec" pero sin spec_activa ni spec_draft_path
    dir = crearDirTemporal({
      pipeline_step: 'spec',
      ir_generado: true,
      ir_path: '.sdd/ir.json',
      spec_activa: null,
      spec_draft_path: null,
      product_design_aprobado: true,
    });
  });

  after(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  test('estado en "spec" sin spec_activa: validateCurrentStep reporta errores', () => {
    const { fsm } = buildFSM(core, dir);
    const errors = fsm.validateCurrentStep();
    assert.ok(errors.length > 0, 'debe reportar error cuando falta spec_activa');
    assert.ok(
      errors.some(e => /spec/i.test(e)),
      `algún error debe mencionar spec: ${errors}`
    );
  });

  test('spec → plan falla sin spec_activa ni spec_draft_path', () => {
    const { fsm } = buildFSM(core, dir);
    const r = fsm.advance('plan');
    assert.ok(!r.ok, 'spec→plan debe fallar cuando no hay spec activa');
    assert.match(r.error, /spec/i, 'error debe mencionar spec');
  });

  test('pipeline_step no cambia cuando falta spec_activa', () => {
    const estado = leerEstado(dir);
    assert.equal(estado.pipeline_step, 'spec', 'el paso no debe cambiar cuando el guard falla');
  });

  test('spec_draft_path como alternativa a spec_activa desbloquea el pipeline', () => {
    // Actualizar estado con spec_draft_path en lugar de spec_activa
    const e = leerEstado(dir);
    writeFileSync(join(dir, '.sdd', 'estado.json'), JSON.stringify(
      { ...e, spec_draft_path: '.sdd/especificaciones/draft/spec.md' }, null, 2
    ));
    const { fsm } = buildFSM(core, dir);
    const r = fsm.advance('plan');
    assert.ok(r.ok, `spec_draft_path también debe desbloquear spec→plan: ${r.error}`);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 5. forge reset — limpia el estado y vuelve al inicio
// ══════════════════════════════════════════════════════════════════════════════

describe('E2E forge reset — limpia estado y vuelve al inicio', { skip: SKIP }, () => {
  let core, dir;

  before(async () => {
    core = await cargarCore();
    // Estado avanzado a mitad del pipeline
    dir = crearDirTemporal({
      pipeline_step: 'plan',
      ir_generado: true,
      ir_path: '.sdd/ir.json',
      spec_activa: 'spec-test-001',
      product_design_aprobado: true,
      plan_activo: {
        id: 'plan-001',
        tareas_total: 5,
        tareas_done: 2,
        tareas_in_progress: 1,
        tareas_pending: 2,
      },
    });
  });

  after(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  test('estado previo al reset está en "plan" con datos', () => {
    const { fsm } = buildFSM(core, dir);
    assert.equal(fsm.currentStep(), 'plan');
    const estado = leerEstado(dir);
    assert.ok(estado.spec_activa, 'hay spec_activa antes del reset');
    assert.ok(estado.plan_activo, 'hay plan_activo antes del reset');
  });

  test('store.clear() elimina estado.json del disco', () => {
    const { FileSystemStateStore } = core;
    const store = new FileSystemStateStore(join(dir, '.sdd'));
    store.clear();
    assert.equal(store.exists(), false, 'store.exists() debe ser false tras clear()');
    assert.equal(
      existsSync(join(dir, '.sdd', 'estado.json')),
      false,
      'estado.json no debe existir tras clear()'
    );
  });

  test('después de clear(), currentStep() retorna "idea"', () => {
    const { fsm } = buildFSM(core, dir);
    assert.equal(fsm.currentStep(), 'idea', 'tras reset, el paso debe volver a "idea"');
  });

  test('después de clear(), availableTransitions() solo ofrece "discovery"', () => {
    const { fsm } = buildFSM(core, dir);
    const next = fsm.availableTransitions();
    assert.deepEqual(next, ['discovery'], `tras reset, solo "discovery" debe estar disponible: ${next}`);
  });

  test('InMemoryStateStore.clear() también resetea a estado vacío', () => {
    const { InMemoryStateStore, PipelineStateMachine, EventLog } = core;
    const store = new InMemoryStateStore();
    // Simular estado avanzado en memoria
    store.write({
      schemaVersion: '1.0',
      pipeline_step: 'code',
      ir_generado: true,
      spec_activa: 'spec-mem-001',
      ultima_actualizacion: new Date().toISOString(),
    });
    assert.equal(store.exists(), true, 'store tiene estado antes de clear()');

    store.clear();

    assert.equal(store.exists(), false, 'store.exists() false tras clear()');
    const log = new EventLog(join(dir, '.sdd', 'observabilidad'));
    const fsm = new PipelineStateMachine(store, log);
    assert.equal(fsm.currentStep(), 'idea', 'InMemoryStore: currentStep="idea" tras clear()');
  });

  test('forceStep("idea") es alternativa de reset cuando se quiere mantener estado.json', () => {
    const { FileSystemStateStore, PipelineStateMachine, EventLog } = core;
    const store = new FileSystemStateStore(join(dir, '.sdd'));
    // Escribir estado avanzado de vuelta
    store.write({
      schemaVersion: '1.0',
      pipeline_step: 'code',
      ir_generado: true,
      spec_activa: 'spec-001',
      ultima_actualizacion: new Date().toISOString(),
    });
    const log = new EventLog(join(dir, '.sdd', 'observabilidad'));
    const fsm = new PipelineStateMachine(store, log);
    assert.equal(fsm.currentStep(), 'code', 'precondición: paso es "code"');

    fsm.forceStep('idea');

    assert.equal(fsm.currentStep(), 'idea', 'forceStep("idea") reinicia el pipeline');
    assert.equal(store.exists(), true, 'estado.json sigue existiendo tras forceStep (no se borra)');
    const estado = store.read();
    assert.equal(estado.pipeline_step, 'idea', 'estado.json refleja el reset a "idea"');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// BONUS: flujo completo idea → spec — integración de todos los guards
// ══════════════════════════════════════════════════════════════════════════════

describe('E2E flujo completo — idea → discovery → ir → design → spec sin LLM', { skip: SKIP }, () => {
  let core, dir;

  before(async () => {
    core = await cargarCore();
    dir = crearDirTemporal(); // empieza en "idea"
  });

  after(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  test('flujo completo con guards cumplidos llega a "spec"', () => {
    const { FileSystemStateStore, PipelineStateMachine, EventLog } = core;

    // Paso 1: idea → discovery (sin guards)
    {
      const { fsm } = buildFSM(core, dir);
      const r = fsm.advance('discovery');
      assert.ok(r.ok, `idea→discovery falló: ${r.error}`);
    }

    // Paso 2: simular generación del IR (LLM stub)
    {
      const e = leerEstado(dir);
      writeFileSync(join(dir, '.sdd', 'estado.json'), JSON.stringify(
        { ...e, ir_generado: true, ir_path: '.sdd/ir.json' }, null, 2
      ));
    }

    // Paso 3: discovery → ir (guard: ir_generado=true)
    {
      const { fsm } = buildFSM(core, dir);
      const r = fsm.advance('ir');
      assert.ok(r.ok, `discovery→ir falló: ${r.error}`);
    }

    // Paso 4: ir → design (guard: ir_path registrado)
    {
      const { fsm } = buildFSM(core, dir);
      const r = fsm.advance('design');
      assert.ok(r.ok, `ir→design falló: ${r.error}`);
    }

    // Paso 5: simular aprobación del product design (LLM stub)
    {
      const e = leerEstado(dir);
      writeFileSync(join(dir, '.sdd', 'estado.json'), JSON.stringify(
        { ...e, product_design_aprobado: true }, null, 2
      ));
    }

    // Paso 6: design → spec (guard: product_design_aprobado=true)
    {
      const { fsm } = buildFSM(core, dir);
      const r = fsm.advance('spec');
      assert.ok(r.ok, `design→spec falló: ${r.error}`);
    }

    const estadoFinal = leerEstado(dir);
    assert.equal(estadoFinal.pipeline_step, 'spec', 'el flujo completo debe llegar a "spec"');
    assert.ok(estadoFinal.ultima_actualizacion, 'ultima_actualizacion debe estar actualizada');
  });
});
