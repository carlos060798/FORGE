/**
 * session-budget.js — Acumulador de costo de tokens por sesión
 */

import { bus } from './event-bus.js';
import { precioMasCaro, tablaPorToken } from './precios.js';

// Los precios viven en core/precios.js (ADR-19): aquí solo se leen
const TABLA_POR_TOKEN = tablaPorToken();
const PRECIOS = TABLA_POR_TOKEN.anthropic;

function precioParaModelo(modelo) {
  return PRECIOS[modelo] ?? PRECIOS['claude-sonnet-4-6'];
}

/** Proveedores que no facturan por token: modelos locales y stub de pruebas. */
export const PROVEEDORES_SIN_COSTO = new Set(['ollama', 'stub']);

/** Precios de la lista incluida por proveedor y modelo, en USD por token (datos: core/precios.js). */
export const PRECIOS_POR_PROVEEDOR = TABLA_POR_TOKEN;

/** Precio que se aplica a un modelo desconocido: el más caro de la lista incluida. */
export const PRECIO_DESCONOCIDO = precioMasCaro();

/**
 * ¿Hay un precio para este modelo, en la configuración del proyecto o en la lista incluida?
 * Los proveedores sin costo siempre lo tienen (cero).
 * @param {string} proveedor
 * @param {string} modelo
 * @param {Record<string, { input: number, output: number }>} [configurados]  `precios:` del proyecto, en USD por token
 */
export function tienePrecio(proveedor, modelo, configurados = {}) {
  return PROVEEDORES_SIN_COSTO.has(proveedor)
    || Object.hasOwn(configurados, modelo)
    || Object.hasOwn(PRECIOS_POR_PROVEEDOR[proveedor] ?? {}, modelo);
}

/**
 * Orden: proveedor sin costo → precio configurado en el proyecto → lista incluida →
 * precio de modelo desconocido (el más caro conocido, contando lo configurado).
 * @param {string} proveedor
 * @param {string} modelo
 * @param {{ input: number, output: number }} [desconocido]
 * @param {Record<string, { input: number, output: number }>} [configurados]  `precios:` del proyecto, en USD por token
 * @returns {{ input: number, output: number }}
 */
export function precioDe(proveedor, modelo, desconocido, configurados = {}) {
  if (PROVEEDORES_SIN_COSTO.has(proveedor)) return { input: 0, output: 0 };
  if (Object.hasOwn(configurados, modelo)) return configurados[modelo];
  const incluidos = PRECIOS_POR_PROVEEDOR[proveedor] ?? {};
  if (Object.hasOwn(incluidos, modelo)) return incluidos[modelo];
  return desconocido ?? precioMasCaro(configurados);
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
