/**
 * execution-context.js — Niveles de confianza y circuit breaker para ejecución local
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { bus } from './event-bus.js';

/**
 * @typedef {'sandbox'|'local'|'confirmado'} ConfianzaNivel
 * @typedef {'closed'|'open'|'half_open'} AgentCBState
 */

/**
 * @typedef {Object} AgentCircuitState
 * @property {AgentCBState} state
 * @property {number} failureCount
 * @property {number} [lastFailureTs]
 * @property {number} [openedAt]
 */

/**
 * @typedef {Object} ExecutionContext
 * @property {ConfianzaNivel} nivel
 * @property {number} maxDuracionMs
 * @property {boolean} permitirRed
 * @property {boolean} permitirEscrituraFuera
 */

export const CONTEXTOS = {
  sandbox:    { nivel: 'sandbox',    maxDuracionMs: 10_000,  permitirRed: false, permitirEscrituraFuera: false },
  local:      { nivel: 'local',      maxDuracionMs: 60_000,  permitirRed: true,  permitirEscrituraFuera: false },
  confirmado: { nivel: 'confirmado', maxDuracionMs: 300_000, permitirRed: true,  permitirEscrituraFuera: true  },
};

const ORDEN = ['sandbox', 'local', 'confirmado'];
const HALF_OPEN_AFTER_MS = 30_000;

/** @param {ConfianzaNivel} nivel @returns {ConfianzaNivel} */
function degradar(nivel) {
  const idx = ORDEN.indexOf(nivel);
  return idx > 0 ? ORDEN[idx - 1] : 'sandbox';
}

export class CircuitBreaker {
  constructor(options = {}) {
    this.nivelActual = options.nivelInicial ?? 'local';
    this.maxFallos   = options.maxFallosConsecutivos ?? 2;
    this.fallosPorAgente = new Map();
    this.agentStates = new Map();
    this._registrarListeners();
  }

  _registrarListeners() {
    bus.on('task:failed', async ({ agente, error }) => {
      const fallos = (this.fallosPorAgente.get(agente) ?? 0) + 1;
      this.fallosPorAgente.set(agente, fallos);
      this.registrarFalloAgente(agente);

      if (fallos >= this.maxFallos) {
        const anterior = this.nivelActual;
        this.nivelActual = degradar(this.nivelActual);
        try {
          const sddDir = join(process.cwd(), '.sdd');
          mkdirSync(sddDir, { recursive: true });
          writeFileSync(
            join(sddDir, 'execution-level.json'),
            JSON.stringify({ nivel: this.nivelActual, ts: new Date().toISOString() }),
            'utf8'
          );
        } catch { /* no interrumpir el flujo */ }

        if (anterior !== this.nivelActual) {
          process.stderr.write(
            `[forge/circuit-breaker] Agente "${agente}" falló ${fallos} veces. ` +
            `Nivel degradado: ${anterior} → ${this.nivelActual}\n`
          );
          await bus.emit('pipeline:step', { step: `circuit_breaker:${this.nivelActual}`, anterior });
        }
      }
      void error;
    });

    bus.on('task:completed', ({ agente }) => {
      this.fallosPorAgente.delete(agente);
      this.registrarExitoAgente(agente);
    });
  }

  get contextoActual() { return CONTEXTOS[this.nivelActual]; }
  get nivel() { return this.nivelActual; }

  /** @param {ConfianzaNivel} nivel */
  forzarNivel(nivel) {
    this.nivelActual = nivel;
    this.fallosPorAgente.clear();
    try {
      const sddDir = join(process.cwd(), '.sdd');
      mkdirSync(sddDir, { recursive: true });
      writeFileSync(
        join(sddDir, 'execution-level.json'),
        JSON.stringify({ nivel: this.nivelActual, ts: new Date().toISOString() }),
        'utf8'
      );
    } catch { /* no interrumpir el flujo */ }
  }

  /** @param {string} agente @returns {number} */
  fallosDeAgente(agente) {
    return this.fallosPorAgente.get(agente) ?? 0;
  }

  /** @param {string} agente @returns {AgentCircuitState} */
  estadoAgente(agente) {
    return this.agentStates.get(agente) ?? { state: 'closed', failureCount: 0 };
  }

  /** @param {string} agente @returns {AgentCircuitState} */
  registrarFalloAgente(agente) {
    const current = this.estadoAgente(agente);
    const failureCount = current.failureCount + 1;
    const now = Date.now();
    const next = failureCount >= this.maxFallos
      ? { state: 'open', failureCount, lastFailureTs: now, openedAt: now }
      : { state: 'closed', failureCount, lastFailureTs: now };
    this.agentStates.set(agente, next);
    return next;
  }

  /** @param {string} agente */
  registrarExitoAgente(agente) {
    this.agentStates.set(agente, { state: 'closed', failureCount: 0 });
  }

  /** @param {string} agente @returns {boolean} */
  puedeEjecutarAgente(agente) {
    const s = this.estadoAgente(agente);
    if (s.state === 'closed') return true;
    if (s.state === 'half_open') return true;
    if (s.openedAt && Date.now() - s.openedAt >= HALF_OPEN_AFTER_MS) {
      this.agentStates.set(agente, { ...s, state: 'half_open' });
      return true;
    }
    return false;
  }

  reset() {
    this.nivelActual = 'local';
    this.fallosPorAgente.clear();
    this.agentStates.clear();
  }
}

export const circuitBreaker = new CircuitBreaker();
