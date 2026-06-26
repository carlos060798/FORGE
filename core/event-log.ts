/**
 * event-log.ts — Log de eventos append-only para el engine FORGE
 *
 * Permite reconstruir el estado de ejecución desde cero (replay determinista).
 * Es la base de `forge resume`: no depende del LLM para recuperar progreso.
 *
 * Formato: un objeto JSON por línea (JSONL) en .sdd/events.jsonl
 */

import * as fs from 'fs';
import * as path from 'path';

// ── Tipos de evento ───────────────────────────────────────────────────────────

export type EventType =
  | 'pipeline_step_changed'
  | 'task_started'
  | 'task_completed'
  | 'task_failed'
  | 'task_skipped'
  | 'agent_invoked'
  | 'agent_result'
  | 'runner_started'
  | 'runner_result'
  | 'spec_validated'
  | 'checkpoint_written'
  | 'resume_attempted'
  | 'custom';

export interface ForgeEvent {
  id: string;             // nanoid-style: timestamp + counter
  type: EventType;
  ts: string;             // ISO 8601
  /** Agente que generó el evento (si aplica) */
  agent?: string;
  /** Tarea asociada */
  taskId?: string;
  /** Paso del pipeline */
  pipelineStep?: string;
  /** Payload arbitrario del evento */
  payload: Record<string, unknown>;
  /** Message Envelope — trazabilidad de quién emite y quién recibe */
  envelope?: MessageEnvelope;
}

/** Envelope para trazabilidad de comunicaciones entre módulos/agentes */
export interface MessageEnvelope {
  from: string;   // quién emite: "orchestrator", "agente:arquitecto", "circuit-breaker", etc.
  to: string;     // quién recibe: "event-log", "session-budget", "pipeline", etc.
  retryCount?: number;
}

// ── EventLog ─────────────────────────────────────────────────────────────────

export class EventLog {
  private readonly logPath: string;
  private counter: number = 0;

  constructor(sddDir: string) {
    this.logPath = path.join(sddDir, 'events.jsonl');
    fs.mkdirSync(sddDir, { recursive: true });
  }

  /**
   * Append de un evento al log con envelope de trazabilidad.
   * Usar cuando se conoce quién emite y quién recibe.
   */
  appendEnvelope(
    type: EventType,
    payload: Record<string, unknown>,
    envelope: MessageEnvelope,
    meta: Partial<Omit<ForgeEvent, 'id' | 'type' | 'ts' | 'payload' | 'envelope'>> = {},
  ): ForgeEvent {
    return this.append(type, payload, { ...meta, envelope });
  }

  /** Append de un evento al log. Nunca sobreescribe, nunca falla silenciosamente. */
  append(type: EventType, payload: Record<string, unknown>, meta: Partial<Omit<ForgeEvent, 'id' | 'type' | 'ts' | 'payload'>> = {}): ForgeEvent {
    this.counter++;
    const event: ForgeEvent = {
      id: `${Date.now()}-${this.counter}`,
      type,
      ts: new Date().toISOString(),
      ...meta,
      payload,
    };

    const line = JSON.stringify(event) + '\n';
    fs.appendFileSync(this.logPath, line, 'utf8');
    return event;
  }

  /** Lee todos los eventos del log. Devuelve [] si el archivo no existe. */
  readAll(): ForgeEvent[] {
    if (!fs.existsSync(this.logPath)) return [];
    const content = fs.readFileSync(this.logPath, 'utf8');
    const events: ForgeEvent[] = [];
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        events.push(JSON.parse(trimmed) as ForgeEvent);
      } catch {
        // Línea corrupta — ignorar; el resto del log sigue siendo válido
      }
    }
    return events;
  }

  /**
   * Reproduce el log para reconstruir el estado de las tareas.
   * Devuelve un mapa taskId → último estado conocido.
   * Usado por `forge resume` para saber dónde retomar sin LLM.
   */
  replayTaskStates(): Map<string, { estado: string; completedAt?: string; error?: string }> {
    const states = new Map<string, { estado: string; completedAt?: string; error?: string }>();
    for (const event of this.readAll()) {
      if (!event.taskId) continue;
      switch (event.type) {
        case 'task_started':
          states.set(event.taskId, { estado: 'en_progreso' });
          break;
        case 'task_completed':
          states.set(event.taskId, { estado: 'completada', completedAt: event.ts });
          break;
        case 'task_failed':
          states.set(event.taskId, {
            estado: 'fallida',
            error: String(event.payload['error'] ?? ''),
          });
          break;
        case 'task_skipped':
          states.set(event.taskId, { estado: 'omitida' });
          break;
      }
    }
    return states;
  }

  /** Último evento de un tipo dado (útil para saber el pipeline_step actual). */
  lastOfType(type: EventType): ForgeEvent | undefined {
    const all = this.readAll();
    for (let i = all.length - 1; i >= 0; i--) {
      if (all[i].type === type) return all[i];
    }
    return undefined;
  }

  /** Devuelve el último pipeline_step registrado en el log. */
  lastPipelineStep(): string | undefined {
    const event = this.lastOfType('pipeline_step_changed');
    return event ? String(event.payload['step'] ?? '') : undefined;
  }

  /** Borra el log (solo para tests o reset explícito). */
  clear(): void {
    if (fs.existsSync(this.logPath)) fs.unlinkSync(this.logPath);
    this.counter = 0;
  }

  get path(): string {
    return this.logPath;
  }

  exists(): boolean {
    return fs.existsSync(this.logPath);
  }
}
