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

/** Proveedores que no facturan por token: modelos locales y stub de pruebas. */
export const PROVEEDORES_SIN_COSTO = new Set(['ollama', 'stub']);

/**
 * Precios por proveedor y modelo, en USD por token. Los de OpenAI son valores
 * de referencia: conviene revisarlos contra la tarifa vigente.
 */
export const PRECIOS_POR_PROVEEDOR = {
  anthropic: PRECIOS,
  openai: {
    'gpt-4o':      { input: 2.5  / 1_000_000, output: 10  / 1_000_000 },
    'gpt-4o-mini': { input: 0.15 / 1_000_000, output: 0.6 / 1_000_000 },
  },
};

/** Precio que se aplica a un modelo desconocido: el más caro de la tabla. */
export const PRECIO_DESCONOCIDO = PRECIOS['claude-opus-4-8'];

/**
 * @param {string} proveedor
 * @param {string} modelo
 * @param {{ input: number, output: number }} [desconocido]
 * @returns {{ input: number, output: number }}
 */
export function precioDe(proveedor, modelo, desconocido = PRECIO_DESCONOCIDO) {
  if (PROVEEDORES_SIN_COSTO.has(proveedor)) return { input: 0, output: 0 };
  return PRECIOS_POR_PROVEEDOR[proveedor]?.[modelo] ?? desconocido;
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
