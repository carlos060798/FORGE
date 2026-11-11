/**
 * state-machine.js — Máquina de estados formal del pipeline FORGE
 */

/**
 * @typedef {'idea'|'discovery'|'ir'|'design'|'spec'|'plan'|'tasks'|'code'|'done'} PipelineStep
 */

/**
 * @typedef {Object} Transition
 * @property {PipelineStep} from
 * @property {PipelineStep} to
 * @property {(estado: object) => string|null} [guard]
 * @property {(estado: object) => object} [action]
 */

/**
 * @typedef {Object} TransitionResult
 * @property {boolean} ok
 * @property {PipelineStep} from
 * @property {PipelineStep} to
 * @property {string} [error]
 */

/** @type {Transition[]} */
const TRANSITIONS = [
  {
    from: 'idea',
    to: 'discovery',
    action: (e) => ({ ...e, pipeline_step: 'discovery', ultima_actualizacion: new Date().toISOString() }),
  },
  {
    from: 'discovery',
    to: 'ir',
    guard: (e) => {
      if (!e.ir_generado) return 'El IR aún no ha sido generado (ir_generado=false)';
      return null;
    },
    action: (e) => ({ ...e, pipeline_step: 'ir', ultima_actualizacion: new Date().toISOString() }),
  },
  {
    from: 'ir',
    to: 'design',
    guard: (e) => {
      if (!e.ir_path) return 'ir_path no registrado en el estado';
      return null;
    },
    action: (e) => ({ ...e, pipeline_step: 'design', ultima_actualizacion: new Date().toISOString() }),
  },
  {
    from: 'design',
    to: 'spec',
    guard: (e) => {
      if (!e.product_design_aprobado) return 'El product design aún no ha sido aprobado';
      return null;
    },
    action: (e) => ({ ...e, pipeline_step: 'spec', ultima_actualizacion: new Date().toISOString() }),
  },
  {
    from: 'spec',
    to: 'plan',
    guard: (e) => {
      // Los comandos SDD escriben `especificacion_activa`; el engine, `spec_activa`.
      if (!e.spec_activa && !e.especificacion_activa && !e.spec_draft_path) return 'No hay spec activa ni draft registrado';
      if (!e.spec_aprobado) return 'La spec debe aprobarse antes de planificar — ejecuta: forge aprobar spec';
      return null;
    },
    action: (e) => ({ ...e, pipeline_step: 'plan', ultima_actualizacion: new Date().toISOString() }),
  },
  {
    from: 'plan',
    to: 'tasks',
    guard: (e) => {
      if (!e.plan_activo) return 'No hay plan activo registrado';
      return null;
    },
    action: (e) => ({ ...e, pipeline_step: 'tasks', ultima_actualizacion: new Date().toISOString() }),
  },
  {
    from: 'tasks',
    to: 'code',
    action: (e) => ({ ...e, pipeline_step: 'code', ultima_actualizacion: new Date().toISOString() }),
  },
  {
    from: 'code',
    to: 'done',
    action: (e) => ({ ...e, pipeline_step: 'done', ultima_actualizacion: new Date().toISOString() }),
  },
];

/**
 * Los comandos /sdd.* registran la etapa en `fase_actual` con su propio
 * vocabulario. Cuando `pipeline_step` no existe, se traduce desde ahí.
 */
const DESDE_FASE = {
  descubrimiento: 'discovery',
  especificacion: 'spec',
  tareas_generadas: 'tasks',
  implementacion: 'code',
  implementacion_completa: 'done',
};

export class PipelineStateMachine {
  /**
   * @param {import('./state-store.js').FileSystemStateStore} store
   * @param {import('./event-log.js').EventLog} log
   */
  constructor(store, log) {
    this.store = store;
    this.log = log;
  }

  /** @returns {PipelineStep} */
  currentStep() {
    const estado = this.store.read();
    return estado.pipeline_step ?? DESDE_FASE[estado.fase_actual] ?? 'idea';
  }

  /**
   * @param {PipelineStep} to
   * @param {boolean} [force]  salta los guards; exige `opciones.motivo` y deja un evento firmado
   * @param {{ motivo?: string, quien?: Record<string, unknown>, firmar?: (payload: Record<string, unknown>) => string, verificarSpec?: (estado: Record<string, any>) => string|null }} [opciones]  `verificarSpec`: obligatorio para spec → plan sin `force`
   * @returns {TransitionResult}
   */
  advance(to, force = false, opciones = {}) {
    const from = this.currentStep();
    const transition = TRANSITIONS.find(t => t.from === from && t.to === to);

    if (!transition) {
      const validNextSteps = TRANSITIONS.filter(t => t.from === from).map(t => t.to);
      return {
        ok: false,
        from,
        to,
        error: `Transición inválida: ${from} → ${to}. Transiciones válidas desde ${from}: [${validNextSteps.join(', ')}]`,
      };
    }

    const estado = this.store.read();

    if (!force && transition.guard) {
      const guardError = transition.guard(estado);
      if (guardError) {
        return { ok: false, from, to, error: `Guard bloqueó la transición: ${guardError}` };
      }
      // spec → plan: además del booleano, el registro firmado de la aprobación. Lo aporta quien llama (con su cwd) y es
      // OBLIGATORIO: sin verificador la transición falla cerrada, para que ningún llamador futuro llegue a `plan` solo con
      // el booleano de estado.json (revisión independiente 2026-11-10, hallazgo 2; spec aprobaciones-con-identidad, CA-006-01).
      if (from === 'spec' && to === 'plan') {
        if (typeof opciones.verificarSpec !== 'function') {
          return { ok: false, from, to, error: 'Guard bloqueó la transición: spec → plan exige comprobar el registro firmado de la aprobación y quien llama no aportó el verificador (opciones.verificarSpec). Usa `forge step plan`.' };
        }
        const motivoSpec = opciones.verificarSpec(estado);
        if (motivoSpec) return { ok: false, from, to, error: `Guard bloqueó la transición: ${motivoSpec}` };
      }
    }

    // --force: motivo obligatorio y evento firmado ANTES de escribir el estado (spec 2026-11-06-aprobaciones-con-identidad).
    // Sin motivo o sin forma de firmar no se salta nada.
    if (force) {
      const motivo = String(opciones.motivo ?? '').trim();
      if (motivo.length < 10) {
        return { ok: false, from, to, error: 'Forzar una transición exige un motivo de al menos 10 caracteres (forge step <paso> --force --motivo "por qué")' };
      }
      if (typeof opciones.firmar !== 'function') {
        return { ok: false, from, to, error: 'Forzar una transición exige poder firmar el evento; no se fuerza nada.' };
      }
      const datos = { step: to, from, motivo: motivo.slice(0, 500), quien: opciones.quien ?? null, cuando: new Date().toISOString() };
      this.log.append('pipeline_step_forzado', { ...datos, firma: opciones.firmar(datos) }, { pipelineStep: to });
    }

    const nuevoEstado = transition.action ? transition.action(estado) : { ...estado, pipeline_step: to };
    this.store.write(nuevoEstado);
    this.log.append('pipeline_step_changed', { step: to, from, force }, { pipelineStep: to });

    return { ok: true, from, to };
  }

  /** @param {PipelineStep} step */
  forceStep(step) {
    const estado = this.store.read();
    this.store.write({ ...estado, pipeline_step: step, ultima_actualizacion: new Date().toISOString() });
    this.log.append('pipeline_step_changed', { step, forced: true }, { pipelineStep: step });
  }

  /** @returns {PipelineStep[]} */
  availableTransitions() {
    const from = this.currentStep();
    return TRANSITIONS.filter(t => t.from === from).map(t => t.to);
  }

  /** @returns {string[]} */
  validateCurrentStep() {
    const step = this.currentStep();
    const estado = this.store.read();
    const errors = [];
    const nextTransitions = TRANSITIONS.filter(t => t.from === step);
    for (const t of nextTransitions) {
      if (t.guard) {
        const err = t.guard(estado);
        if (err) errors.push(err);
      }
    }
    return errors;
  }
}
