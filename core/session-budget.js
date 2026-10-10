/**
 * session-budget.js — Acumulador de costo de tokens por sesión
 */

import { bus } from './event-bus.js';
import { precioMasCaro, preciosCache, preciosCachePorDefecto, tablaPorToken } from './precios.js';

// Los precios viven en core/precios.js (ADR-19): aquí solo se leen
const TABLA_POR_TOKEN = tablaPorToken();
const PRECIOS = TABLA_POR_TOKEN.anthropic;

function precioParaModelo(modelo) {
  return PRECIOS[modelo] ?? PRECIOS['claude-sonnet-4-6'];
}

/** Proveedores que no facturan por token: modelos locales y stub de pruebas. */
export const PROVEEDORES_SIN_COSTO = new Set(['ollama', 'stub']);

/**
 * ¿Es un recuento de tokens que se puede contabilizar? Un entero finito y no negativo. Todo lo
 * demás (NaN, Infinity, negativos, decimales, texto) es consumo no informado: si se sumara, el
 * gasto podría bajar o ser NaN y el tope (Principio VIII) no saltaría nunca (revisión H-03).
 * @param {unknown} n
 * @returns {n is number}
 */
export function esRecuentoValido(n) {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0;
}

/** Recuento de tokens de caché o de un acumulador: lo inválido cuenta cero (nunca resta). */
const recuento = (n) => (esRecuentoValido(n) ? n : 0);

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

/**
 * Los cuatro precios de una llamada, en USD por token: entrada, salida, escritura de caché
 * y lectura de caché (spec 2026-10-09-puesta-al-dia, CA-001-02 y CA-001-03).
 *
 * Orden para los de caché: los que indique el proyecto (`<id>_cache_escritura` y
 * `<id>_cache_lectura` en `precios:`) → los de la lista incluida, si el precio de entrada
 * también sale de ella → el precio de entrada (lectura) y el de entrada × 1,25 (escritura).
 * Así un modelo sin precios de caché nunca se cobra por debajo de lo que cobra el proveedor.
 * @param {string} proveedor
 * @param {string} modelo
 * @param {{ input: number, output: number }} [desconocido]
 * @param {Record<string, { input: number, output: number, cacheWrite?: number, cacheRead?: number }>} [configurados]
 * @returns {{ input: number, output: number, cacheWrite: number, cacheRead: number }}
 */
export function precioCompletoDe(proveedor, modelo, desconocido, configurados = {}) {
  const base = precioDe(proveedor, modelo, desconocido, configurados);
  if (PROVEEDORES_SIN_COSTO.has(proveedor)) return { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };
  const defecto = preciosCachePorDefecto(base.input);
  if (Object.hasOwn(configurados, modelo)) {
    const cfg = configurados[modelo];
    return { input: base.input, output: base.output, cacheWrite: cfg.cacheWrite ?? defecto.escritura, cacheRead: cfg.cacheRead ?? defecto.lectura };
  }
  const incluidos = preciosCache(proveedor, modelo);
  return {
    input: base.input, output: base.output,
    cacheWrite: incluidos?.escritura ?? defecto.escritura,
    cacheRead:  incluidos?.lectura ?? defecto.lectura,
  };
}

export class SessionBudget {
  /**
   * @param {number} [umbral_usd]
   * @param {{ precios?: Record<string, { input: number, output: number, cacheWrite?: number, cacheRead?: number }> }} [opciones]
   */
  constructor(umbral_usd = 1.0, opciones = {}) {
    /** `precios:` del proyecto (USD por token); mandan sobre la lista incluida, como en el ciclo */
    this.precios = opciones.precios ?? {};
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
      // Esto es una alerta, no el tope, pero un acumulador que baja o vale NaN no avisa nunca:
      // lo que no es un recuento válido cuenta cero
      const entrada = recuento(payload.tokens_input);
      const salida = recuento(payload.tokens_output);
      // Con precio configurado en el proyecto se usan sus cuatro precios; si no, los de la lista incluida
      const configurado = Object.hasOwn(this.precios, payload.modelo) ? precioCompletoDe('anthropic', payload.modelo, undefined, this.precios) : null;
      const precio = configurado ?? precioParaModelo(payload.modelo);
      // Con caché de prompts parte de la entrada llega aparte (guardada o reutilizada): si no se
      // contara, este acumulador registraría menos de lo que cobra el proveedor
      const cache = configurado ? { escritura: configurado.cacheWrite, lectura: configurado.cacheRead } : (preciosCache('anthropic', payload.modelo) ?? preciosCachePorDefecto(precio.input));
      const costo = entrada * precio.input + salida * precio.output
        + recuento(payload.tokens_cache_escritura) * cache.escritura
        + recuento(payload.tokens_cache_lectura) * cache.lectura;
      this.tokens_input  += entrada;
      this.tokens_output += salida;
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
