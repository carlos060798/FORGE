/**
 * state-machine.ts — Máquina de estados formal del pipeline FORGE
 *
 * Reemplaza la tabla lineal PIPELINE_TRANSITIONS de project-memory.ts con
 * una FSM real: estados, eventos con guards, acciones y side-effects.
 *
 * La FSM no escribe estado directamente — recibe un StateStore y un EventLog
 * como dependencias (inversión de control).
 */

import type { StateStore } from './state-store.js';
import type { EventLog } from './event-log.js';
import type { ForgeEstado } from './project-memory.js';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type PipelineStep =
  | 'idea'
  | 'discovery'
  | 'ir'
  | 'design'
  | 'spec'
  | 'plan'
  | 'tasks'
  | 'code'
  | 'done';

export interface Transition {
  from: PipelineStep;
  to: PipelineStep;
  /** Guard: devuelve null si OK, o string de error si la transición está bloqueada */
  guard?: (estado: ForgeEstado) => string | null;
  /** Acción ejecutada en la transición (modifica el estado antes de persistirlo) */
  action?: (estado: ForgeEstado) => ForgeEstado;
}

export interface TransitionResult {
  ok: boolean;
  from: PipelineStep;
  to: PipelineStep;
  error?: string;
}

// ── Tabla de transiciones con guards ─────────────────────────────────────────

const TRANSITIONS: Transition[] = [
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

// ── PipelineStateMachine ──────────────────────────────────────────────────────

export class PipelineStateMachine {
  private readonly store: StateStore;
  private readonly log: EventLog;

  constructor(store: StateStore, log: EventLog) {
    this.store = store;
    this.log = log;
  }

  /** Paso actual del pipeline según el store. */
  currentStep(): PipelineStep {
    const estado = this.store.read();
    return (estado.pipeline_step as PipelineStep) ?? 'idea';
  }

  /**
   * Intenta avanzar al siguiente paso del pipeline.
   * Si hay un guard activo que no se cumple, devuelve error sin mutar el estado.
   * Si `force=true`, omite los guards (solo para recuperación manual).
   */
  advance(to: PipelineStep, force: boolean = false): TransitionResult {
    const from = this.currentStep();
    const transition = TRANSITIONS.find(t => t.from === from && t.to === to);

    if (!transition) {
      const validNextSteps = TRANSITIONS
        .filter(t => t.from === from)
        .map(t => t.to);
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

  /**
   * Fuerza un paso específico sin validar transiciones ni guards.
   * Solo para recuperación desde `forge resume` o tests.
   */
  forceStep(step: PipelineStep): void {
    const estado = this.store.read();
    this.store.write({
      ...estado,
      pipeline_step: step,
      ultima_actualizacion: new Date().toISOString(),
    });
    this.log.append('pipeline_step_changed', { step, forced: true }, { pipelineStep: step });
  }

  /** Devuelve qué pasos siguen disponibles desde el estado actual. */
  availableTransitions(): PipelineStep[] {
    const from = this.currentStep();
    return TRANSITIONS.filter(t => t.from === from).map(t => t.to);
  }

  /** Valida que el estado tenga los campos requeridos para el paso actual. */
  validateCurrentStep(): string[] {
    const step = this.currentStep();
    const estado = this.store.read();
    const errors: string[] = [];

    // Aplicar el guard de la PRÓXIMA transición como validación del paso actual
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
