/**
 * execution-context.ts — Niveles de confianza y circuit breaker para ejecución local
 *
 * Define tres niveles de confianza que controlan qué puede hacer el engine:
 *   sandbox   → sin red, 10s timeout, solo lectura fuera del cwd
 *   local     → con red, 60s timeout, escritura solo dentro del cwd
 *   confirmado → sin restricciones, 5min timeout
 *
 * Circuit breaker: si un agente falla N veces consecutivas, el contexto
 * baja automáticamente de nivel para proteger el entorno.
 *
 * Inspirado en el patrón Redis Sentinel adaptado a proceso local único.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { bus } from './event-bus.js';
import type { ForgeEvents } from './event-bus.js';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type ConfianzaNivel = 'sandbox' | 'local' | 'confirmado';

// ── Per-agent circuit breaker ─────────────────────────────────────────────────

export type AgentCBState = 'closed' | 'open' | 'half_open';

export interface AgentCircuitState {
  state: AgentCBState;
  failureCount: number;
  lastFailureTs?: number;
  openedAt?: number;
}

const HALF_OPEN_AFTER_MS = 30_000; // intentar de nuevo tras 30 s

export interface ExecutionContext {
  nivel: ConfianzaNivel;
  maxDuracionMs: number;
  permitirRed: boolean;
  permitirEscrituraFuera: boolean;
}

// ── Contextos predefinidos ────────────────────────────────────────────────────

export const CONTEXTOS: Record<ConfianzaNivel, ExecutionContext> = {
  sandbox: {
    nivel: 'sandbox',
    maxDuracionMs: 10_000,
    permitirRed: false,
    permitirEscrituraFuera: false,
  },
  local: {
    nivel: 'local',
    maxDuracionMs: 60_000,
    permitirRed: true,
    permitirEscrituraFuera: false,
  },
  confirmado: {
    nivel: 'confirmado',
    maxDuracionMs: 300_000,
    permitirRed: true,
    permitirEscrituraFuera: true,
  },
};

// ── Orden de niveles (para degradar/ascender) ─────────────────────────────────

const ORDEN: ConfianzaNivel[] = ['sandbox', 'local', 'confirmado'];

function degradar(nivel: ConfianzaNivel): ConfianzaNivel {
  const idx = ORDEN.indexOf(nivel);
  return idx > 0 ? ORDEN[idx - 1] : 'sandbox';
}

// ── CircuitBreaker ────────────────────────────────────────────────────────────

export interface CircuitBreakerOptions {
  maxFallosConsecutivos?: number;
  nivelInicial?: ConfianzaNivel;
}

export class CircuitBreaker {
  private nivelActual: ConfianzaNivel;
  private readonly maxFallos: number;
  private fallosPorAgente = new Map<string, number>();
  private readonly agentStates = new Map<string, AgentCircuitState>();

  constructor(options: CircuitBreakerOptions = {}) {
    this.nivelActual = options.nivelInicial ?? 'local';
    this.maxFallos   = options.maxFallosConsecutivos ?? 2;
    this.registrarListeners();
  }

  private registrarListeners(): void {
    bus.on<ForgeEvents['task:failed']>('task:failed', async ({ agente, error }) => {
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
          await bus.emit('pipeline:step', {
            step: `circuit_breaker:${this.nivelActual}`,
            anterior,
          });
        }
      }

      void error; // registrado en EventLog por el Orchestrator
    });

    bus.on<ForgeEvents['task:completed']>('task:completed', ({ agente }) => {
      // Reset de fallos consecutivos al completar con éxito
      this.fallosPorAgente.delete(agente);
      this.registrarExitoAgente(agente);
    });
  }

  get contextoActual(): ExecutionContext {
    return CONTEXTOS[this.nivelActual];
  }

  get nivel(): ConfianzaNivel {
    return this.nivelActual;
  }

  /** Fuerza un nivel (útil en tests o tras confirmación explícita del usuario). */
  forzarNivel(nivel: ConfianzaNivel): void {
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

  /** Devuelve cuántos fallos consecutivos lleva un agente. */
  fallosDeAgente(agente: string): number {
    return this.fallosPorAgente.get(agente) ?? 0;
  }

  // ── Per-agent circuit breaker ──────────────────────────────────────────────

  /** Estado del circuit breaker individual de un agente. */
  estadoAgente(agente: string): AgentCircuitState {
    return this.agentStates.get(agente) ?? { state: 'closed', failureCount: 0 };
  }

  /** Registra un fallo para el agente y actualiza su CB state. */
  registrarFalloAgente(agente: string): AgentCircuitState {
    const current = this.estadoAgente(agente);
    const failureCount = current.failureCount + 1;
    const now = Date.now();
    const next: AgentCircuitState = failureCount >= this.maxFallos
      ? { state: 'open', failureCount, lastFailureTs: now, openedAt: now }
      : { state: 'closed', failureCount, lastFailureTs: now };
    this.agentStates.set(agente, next);
    return next;
  }

  /** Registra un éxito: cierra el CB del agente. */
  registrarExitoAgente(agente: string): void {
    this.agentStates.set(agente, { state: 'closed', failureCount: 0 });
  }

  /**
   * ¿Puede el agente ejecutar?
   * - closed → sí
   * - open y han pasado HALF_OPEN_AFTER_MS → transiciona a half_open, permite un intento
   * - open y no han pasado → no
   * - half_open → permite (se espera que el resultado cierre o reabra)
   */
  puedeEjecutarAgente(agente: string): boolean {
    const s = this.estadoAgente(agente);
    if (s.state === 'closed') return true;
    if (s.state === 'half_open') return true;
    // open: comprobar si ya pasó el tiempo de enfriamiento
    if (s.openedAt && Date.now() - s.openedAt >= HALF_OPEN_AFTER_MS) {
      this.agentStates.set(agente, { ...s, state: 'half_open' });
      return true;
    }
    return false;
  }

  reset(): void {
    this.nivelActual = 'local';
    this.fallosPorAgente.clear();
    this.agentStates.clear();
  }
}

/** Instancia singleton del circuit breaker para el proceso actual. */
export const circuitBreaker = new CircuitBreaker();
