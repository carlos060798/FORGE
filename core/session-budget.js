/**
 * session-budget.js — Acumulador de costo de tokens por sesión
 */

import { bus } from './event-bus.js';

const PRECIOS = {
  'claude-opus-4-8':           { input: 15 / 1_000_000, output: 75 / 1_000_000 },
  'claude-sonnet-4-6':         { input: 3  / 1_000_000, output: 15 / 1_000_000 },
  'claude-haiku-4-5-20251001': { input: 0.8 / 1_000_000, output: 4  / 1_000_000 },
};

function precioParaModelo(modelo) {
  return PRECIOS[modelo] ?? PRECIOS['claude-sonnet-4-6'];
}

export class SessionBudget {
  /** @param {number} [umbral_usd] */
  constructor(umbral_usd = 1.0) {
    this.tokens_input = 0;
    this.tokens_output = 0;
    this.costo_usd = 0;
    this.llamadas = 0;
    this.alertas_emitidas = 0;
    this.umbral_usd = umbral_usd;
    this._registrarListener();
  }

  _registrarListener() {
    bus.on('agent:result', async (payload) => {
      const precio = precioParaModelo(payload.modelo);
      const costo = payload.tokens_input * precio.input + payload.tokens_output * precio.output;
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

  snapshot() {
    return {
      tokens_input: this.tokens_input,
      tokens_output: this.tokens_output,
      costo_usd: Math.round(this.costo_usd * 1_000_000) / 1_000_000,
      llamadas: this.llamadas,
      alertas_emitidas: this.alertas_emitidas,
    };
  }

  reset() {
    this.tokens_input = 0;
    this.tokens_output = 0;
    this.costo_usd = 0;
    this.llamadas = 0;
    this.alertas_emitidas = 0;
  }

  resumen() {
    const s = this.snapshot();
    return `[budget] ${s.llamadas} llamadas · ${s.tokens_input + s.tokens_output} tokens · $${s.costo_usd.toFixed(4)} USD`;
  }
}

export const sessionBudget = new SessionBudget(
  Number(process.env['FORGE_BUDGET_USD'] ?? 1.0),
);
