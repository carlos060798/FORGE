/**
 * session-budget.ts — Acumulador de costo de tokens por sesión
 *
 * Escucha el bus de eventos 'agent:result' y acumula tokens consumidos.
 * Si se supera el umbral configurable, emite 'budget:warning' para que
 * pre-tool-guard.js pueda bloquear agentes de tier OPUS.
 *
 * Precios USD por millón de tokens (actualizar si Anthropic cambia tarifas):
 *   Opus 4.8:   $15 input / $75 output
 *   Sonnet 4.6: $3 input  / $15 output
 *   Haiku 4.5:  $0.8 input / $4 output
 */

import { bus } from './event-bus.js';
import type { ForgeEvents } from './event-bus.js';

// ── Precios por modelo (USD / token) ─────────────────────────────────────────

const PRECIOS: Record<string, { input: number; output: number }> = {
  'claude-opus-4-8':           { input: 15 / 1_000_000, output: 75 / 1_000_000 },
  'claude-sonnet-4-6':         { input: 3  / 1_000_000, output: 15 / 1_000_000 },
  'claude-haiku-4-5-20251001': { input: 0.8 / 1_000_000, output: 4  / 1_000_000 },
};

function precioParaModelo(modelo: string) {
  return PRECIOS[modelo] ?? PRECIOS['claude-sonnet-4-6'];
}

// ── SessionBudget ─────────────────────────────────────────────────────────────

export interface BudgetSnapshot {
  tokens_input: number;
  tokens_output: number;
  costo_usd: number;
  llamadas: number;
  alertas_emitidas: number;
}

export class SessionBudget {
  private tokens_input = 0;
  private tokens_output = 0;
  private costo_usd = 0;
  private llamadas = 0;
  private alertas_emitidas = 0;
  private readonly umbral_usd: number;

  constructor(umbral_usd = 1.0) {
    this.umbral_usd = umbral_usd;
    this.registrarListener();
  }

  private registrarListener(): void {
    bus.on<ForgeEvents['agent:result']>('agent:result', async (payload) => {
      const precio = precioParaModelo(payload.modelo);
      const costo = payload.tokens_input * precio.input
                  + payload.tokens_output * precio.output;

      this.tokens_input  += payload.tokens_input;
      this.tokens_output += payload.tokens_output;
      this.costo_usd     += costo;
      this.llamadas++;

      if (this.costo_usd >= this.umbral_usd) {
        this.alertas_emitidas++;
        await bus.emit('budget:warning', {
          tokens_acumulados: this.tokens_input + this.tokens_output,
          costo_usd: this.costo_usd,
          umbral_usd: this.umbral_usd,
        });
      }
    });
  }

  snapshot(): BudgetSnapshot {
    return {
      tokens_input: this.tokens_input,
      tokens_output: this.tokens_output,
      costo_usd: Math.round(this.costo_usd * 1_000_000) / 1_000_000,
      llamadas: this.llamadas,
      alertas_emitidas: this.alertas_emitidas,
    };
  }

  reset(): void {
    this.tokens_input = 0;
    this.tokens_output = 0;
    this.costo_usd = 0;
    this.llamadas = 0;
    this.alertas_emitidas = 0;
  }

  /** Formatea el snapshot como string legible para logs. */
  resumen(): string {
    const s = this.snapshot();
    return `[budget] ${s.llamadas} llamadas · ${s.tokens_input + s.tokens_output} tokens · $${s.costo_usd.toFixed(4)} USD`;
  }
}

/** Instancia de sesión lista para importar. */
export const sessionBudget = new SessionBudget(
  Number(process.env['FORGE_BUDGET_USD'] ?? 1.0),
);
