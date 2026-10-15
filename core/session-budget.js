/**
 * session-budget.js — Acumulador de costo de tokens por sesión
 */

import { bus } from './event-bus.js';
import { precioMasCaro, preciosCache, preciosCachePorDefecto, tablaPorToken } from './precios.js';
import { leerVariableRestrictiva } from './entorno.js';

// Los precios viven en core/precios.js (ADR-19): aquí solo se leen
const TABLA_POR_TOKEN = tablaPorToken();
const PRECIOS = TABLA_POR_TOKEN.anthropic;

function precioParaModelo(modelo) {
  return PRECIOS[modelo] ?? PRECIOS['claude-sonnet-4-6'];
}

/**
 * Coste cero solo por declaración explícita (spec proveedores-agnosticos, CA-004-01), nunca por el
 * nombre del proveedor. Hay tres formas de declararlo:
 *   - `precios:` del proyecto con el modelo a cero (lo resuelve `precioDe`, como cualquier precio);
 *   - un proveedor Ollama cuyo `base_url` es de la propia máquina (loopback): lo registra su constructor;
 *   - el proveedor `stub`, que es de pruebas y no llama a ningún servicio.
 * Contra un Ollama remoto sin declarar se cuenta al precio más caro conocido, con aviso.
 */
const PROVEEDORES_DE_PRUEBAS = new Set(['stub']);

/** Destino de cada proveedor de modelos locales visto en esta sesión. Un destino remoto manda sobre uno local. */
const DESTINOS = new Map();

/**
 * ¿Es una URL de la propia máquina (localhost, 127.0.0.0/8, ::1)?
 * @param {string} url
 */
export function esDestinoLocal(url) {
  let host;
  try { host = new URL(String(url)).hostname.toLowerCase(); } catch { return false; }
  host = host.replace(/^\[|\]$/g, '');
  return host === 'localhost' || host === '::1' || /^127(\.\d{1,3}){3}$/.test(host);
}

/**
 * Un proveedor registra a dónde llama. Solo un destino local deja el proveedor sin coste; basta uno
 * remoto en la sesión para que se cuente (falla cerrado: nunca se cuenta de menos).
 * @param {string} proveedor
 * @param {string} baseUrl
 */
export function registrarDestino(proveedor, baseUrl) {
  if (!esDestinoLocal(baseUrl)) DESTINOS.set(proveedor, 'remoto');
  else if (DESTINOS.get(proveedor) !== 'remoto') DESTINOS.set(proveedor, 'local');
}

/** Solo para pruebas. */
export function olvidarDestinos() { DESTINOS.clear(); }

/**
 * ¿Cuenta este proveedor cero por sí mismo (sin mirar `precios:`)? Solo el stub y un Ollama local registrado.
 * @param {string} proveedor
 */
export function esSinCosto(proveedor) {
  return PROVEEDORES_DE_PRUEBAS.has(proveedor) || DESTINOS.get(proveedor) === 'local';
}

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
 * Un proveedor sin costo declarado (stub, Ollama local) siempre lo tiene (cero).
 * @param {string} proveedor
 * @param {string} modelo
 * @param {Record<string, { input: number, output: number }>} [configurados]  `precios:` del proyecto, en USD por token
 */
export function tienePrecio(proveedor, modelo, configurados = {}) {
  return esSinCosto(proveedor)
    || Object.hasOwn(configurados, modelo)
    || Object.hasOwn(PRECIOS_POR_PROVEEDOR[proveedor] ?? {}, modelo);
}

/**
 * Orden: precio configurado en el proyecto → proveedor sin costo declarado → lista incluida →
 * precio de modelo desconocido (el más caro conocido, contando lo configurado).
 * @param {string} proveedor
 * @param {string} modelo
 * @param {{ input: number, output: number }} [desconocido]
 * @param {Record<string, { input: number, output: number }>} [configurados]  `precios:` del proyecto, en USD por token
 * @returns {{ input: number, output: number }}
 */
export function precioDe(proveedor, modelo, desconocido, configurados = {}) {
  if (Object.hasOwn(configurados, modelo)) return configurados[modelo];
  if (esSinCosto(proveedor)) return { input: 0, output: 0 };
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
  const defecto = preciosCachePorDefecto(base.input);
  if (Object.hasOwn(configurados, modelo)) {
    const cfg = configurados[modelo];
    return { input: base.input, output: base.output, cacheWrite: cfg.cacheWrite ?? defecto.escritura, cacheRead: cfg.cacheRead ?? defecto.lectura };
  }
  if (esSinCosto(proveedor)) return { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };
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
  Number(leerVariableRestrictiva('BUDGET_USD', process.env, '0') ?? 1.0),
);
