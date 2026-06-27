/**
 * event-log.js — Log de eventos append-only para el engine FORGE
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * @typedef {'pipeline_step_changed'|'task_started'|'task_completed'|'task_failed'|'task_skipped'|'agent_invoked'|'agent_result'|'runner_started'|'runner_result'|'spec_validated'|'checkpoint_written'|'resume_attempted'|'custom'} EventType
 */

/**
 * @typedef {Object} MessageEnvelope
 * @property {string} from
 * @property {string} to
 * @property {number} [retryCount]
 */

/**
 * @typedef {Object} ForgeEvent
 * @property {string} id
 * @property {EventType} type
 * @property {string} ts
 * @property {string} [agent]
 * @property {string} [taskId]
 * @property {string} [pipelineStep]
 * @property {Record<string, unknown>} payload
 * @property {MessageEnvelope} [envelope]
 */

export class EventLog {
  /** @param {string} sddDir */
  constructor(sddDir) {
    this.logPath = path.join(sddDir, 'events.jsonl');
    this.counter = 0;
    fs.mkdirSync(sddDir, { recursive: true });
  }

  /**
   * @param {EventType} type
   * @param {Record<string, unknown>} payload
   * @param {MessageEnvelope} envelope
   * @param {Partial<Omit<ForgeEvent, 'id'|'type'|'ts'|'payload'|'envelope'>>} [meta]
   * @returns {ForgeEvent}
   */
  appendEnvelope(type, payload, envelope, meta = {}) {
    return this.append(type, payload, { ...meta, envelope });
  }

  /**
   * @param {EventType} type
   * @param {Record<string, unknown>} payload
   * @param {Partial<Omit<ForgeEvent, 'id'|'type'|'ts'|'payload'>>} [meta]
   * @returns {ForgeEvent}
   */
  append(type, payload, meta = {}) {
    this.counter++;
    const event = {
      id: `${Date.now()}-${this.counter}`,
      type,
      ts: new Date().toISOString(),
      ...meta,
      payload,
    };
    fs.appendFileSync(this.logPath, JSON.stringify(event) + '\n', 'utf8');
    return event;
  }

  /** @returns {ForgeEvent[]} */
  readAll() {
    if (!fs.existsSync(this.logPath)) return [];
    const content = fs.readFileSync(this.logPath, 'utf8');
    const events = [];
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try { events.push(JSON.parse(trimmed)); } catch { /* línea corrupta */ }
    }
    return events;
  }

  /** @returns {Map<string, { estado: string, completedAt?: string, error?: string }>} */
  replayTaskStates() {
    const states = new Map();
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
          states.set(event.taskId, { estado: 'fallida', error: String(event.payload['error'] ?? '') });
          break;
        case 'task_skipped':
          states.set(event.taskId, { estado: 'omitida' });
          break;
      }
    }
    return states;
  }

  /**
   * @param {EventType} type
   * @returns {ForgeEvent|undefined}
   */
  lastOfType(type) {
    const all = this.readAll();
    for (let i = all.length - 1; i >= 0; i--) {
      if (all[i].type === type) return all[i];
    }
    return undefined;
  }

  /** @returns {string|undefined} */
  lastPipelineStep() {
    const event = this.lastOfType('pipeline_step_changed');
    return event ? String(event.payload['step'] ?? '') : undefined;
  }

  clear() {
    if (fs.existsSync(this.logPath)) fs.unlinkSync(this.logPath);
    this.counter = 0;
  }

  get path() { return this.logPath; }

  exists() { return fs.existsSync(this.logPath); }
}
