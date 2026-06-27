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
      if (!e.spec_activa && !e.spec_draft_path) return 'No hay spec activa ni draft registrado';
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
    return estado.pipeline_step ?? 'idea';
  }

  /**
   * @param {PipelineStep} to
   * @param {boolean} [force]
   * @returns {TransitionResult}
   */
  advance(to, force = false) {
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
