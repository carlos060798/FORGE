/**
 * presupuesto.js — Libro de costos del ciclo verificado (ADR-06)
 *
 * Funciones puras sobre `EstadoCiclo.presupuesto`. Al vivir en el estado, el
 * gasto se guarda en cada punto de guardado y sobrevive a la reanudación.
 */

import { esRecuentoValido, precioCompletoDe, tienePrecio, PROVEEDORES_SIN_COSTO } from '../session-budget.js';

const ESCALON = { opus: 'sonnet', sonnet: 'haiku', haiku: 'haiku' };
export const NIVELES = ['haiku', 'sonnet', 'opus'];

/**
 * Limita el nivel de modelo que pide un agente (`motor.nivel_maximo`). Un identificador
 * directo de modelo, que no es un nivel, no se toca.
 * @param {string} alias
 * @param {string} [maximo]  haiku | sonnet | opus
 */
export function limitarNivel(alias, maximo) {
  const a = NIVELES.indexOf(alias);
  const m = NIVELES.indexOf(String(maximo ?? ''));
  return a !== -1 && m !== -1 && a > m ? NIVELES[m] : alias;
}

export class ErrorConsumo extends Error {
  /** @param {string} proveedor */
  constructor(proveedor) {
    super(`El proveedor "${proveedor}" respondió sin datos de consumo; no se puede contabilizar el gasto.`);
    this.name = 'ErrorConsumo';
  }
}

/**
 * @param {{ tope_usd: number, umbral_degradacion_usd: number, gastado_usd: number }} p
 * @returns {'ok'|'degradado'|'agotado'}
 */
export function estadoDe(p) {
  if (p.gastado_usd >= p.tope_usd) return 'agotado';
  if (p.gastado_usd >= p.umbral_degradacion_usd) return 'degradado';
  return 'ok';
}

/**
 * Comprobación previa a cada llamada: con el presupuesto agotado no se inicia ninguna.
 * @param {import('./estado.js').Presupuesto} p
 */
export function puedeLlamar(p) {
  return p.estado !== 'agotado';
}

/** Tokens de caché de una respuesta: un proveedor que no los informa cuenta cero. */
const entero = (n) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0);

/**
 * Costo en USD de una llamada, cada tipo de token a su precio (CA-001-02). En la API de
 * Anthropic `input_tokens` NO incluye los tokens de caché: son tres cantidades que se suman.
 * @param {{ proveedor: string, modelo: string, inputTokens?: number, outputTokens?: number, cacheCreationTokens?: number, cacheReadTokens?: number }} llamada
 * @param {{ precioDesconocido?: { input: number, output: number }, precios?: Record<string, { input: number, output: number, cacheWrite?: number, cacheRead?: number }> }} [opciones]
 * @returns {number}
 */
export function costoDe(llamada, opciones = {}) {
  if (PROVEEDORES_SIN_COSTO.has(llamada.proveedor)) return 0;
  // Entrada y salida inválidas (NaN, negativas, no finitas, decimales) son consumo no informado:
  // fallar cerrado, porque sumarlas haría bajar el gasto o dejarlo en NaN (revisión H-03)
  if (!esRecuentoValido(llamada.inputTokens) || !esRecuentoValido(llamada.outputTokens)) throw new ErrorConsumo(llamada.proveedor);
  const precio = precioCompletoDe(llamada.proveedor, llamada.modelo, opciones.precioDesconocido, opciones.precios);
  const usd = llamada.inputTokens * precio.input
    + llamada.outputTokens * precio.output
    + entero(llamada.cacheCreationTokens) * precio.cacheWrite
    + entero(llamada.cacheReadTokens) * precio.cacheRead;
  // Último cerrojo: un precio roto no puede hacer que el gasto baje ni valga NaN
  if (!Number.isFinite(usd) || usd < 0) throw new ErrorConsumo(llamada.proveedor);
  return usd;
}

/**
 * Los tokens de caché (`cacheCreationTokens`, `cacheReadTokens`) son opcionales: solo los
 * informa un proveedor con caché de prompts. Cuando llegan, el presupuesto gana los campos
 * `tokens_cache_escritura` y `tokens_cache_lectura`; sin ellos, su forma no cambia.
 * @param {import('./estado.js').Presupuesto} p
 * @param {{ proveedor: string, modelo: string, inputTokens?: number, outputTokens?: number, cacheCreationTokens?: number, cacheReadTokens?: number }} llamada
 * @param {{ precioDesconocido?: { input: number, output: number }, precios?: Record<string, { input: number, output: number }> }} [opciones]
 *        `precios`: los de `precios:` del proyecto (USD por token); mandan sobre la lista incluida
 * @returns {import('./estado.js').Presupuesto}
 */
export function registrar(p, llamada, opciones = {}) {
  const sinCosto = PROVEEDORES_SIN_COSTO.has(llamada.proveedor);
  const faltaConsumo = !esRecuentoValido(llamada.inputTokens) || !esRecuentoValido(llamada.outputTokens);
  if (faltaConsumo && !sinCosto) throw new ErrorConsumo(llamada.proveedor);

  // Un proveedor sin costo que informe algo inválido cuenta cero tokens: el acumulador no se corrompe
  const tokensIn  = esRecuentoValido(llamada.inputTokens) ? llamada.inputTokens : 0;
  const tokensOut = esRecuentoValido(llamada.outputTokens) ? llamada.outputTokens : 0;
  const cacheEscritura = entero(llamada.cacheCreationTokens);
  const cacheLectura   = entero(llamada.cacheReadTokens);
  const hayCache = cacheEscritura > 0 || cacheLectura > 0 || 'tokens_cache_escritura' in p || 'tokens_cache_lectura' in p;

  const siguiente = {
    ...p,
    gastado_usd: p.gastado_usd + costoDe(llamada, opciones),
    llamadas:    p.llamadas + 1,
    tokens_in:   p.tokens_in + tokensIn,
    tokens_out:  p.tokens_out + tokensOut,
    ...(hayCache ? {
      tokens_cache_escritura: (/** @type {any} */ (p).tokens_cache_escritura ?? 0) + cacheEscritura,
      tokens_cache_lectura:   (/** @type {any} */ (p).tokens_cache_lectura ?? 0) + cacheLectura,
    } : {}),
  };
  siguiente.estado = estadoDe(siguiente);
  return siguiente;
}

/**
 * ¿Se cobró esta llamada al precio de modelo desconocido? El ciclo deja entonces un aviso
 * con el nombre del modelo (ADR-19): cobrar de más en silencio esconde una tabla anticuada.
 * @param {{ proveedor: string, modelo: string }} llamada
 * @param {Record<string, { input: number, output: number }>} [precios]  `precios:` del proyecto
 */
export function sinPrecioConocido(llamada, precios) {
  return !tienePrecio(llamada.proveedor, llamada.modelo, precios);
}

/**
 * Amplía el tope tras una revisión humana (`--presupuesto-extra`).
 * @param {import('./estado.js').Presupuesto} p
 * @param {number} extraUsd
 * @returns {import('./estado.js').Presupuesto}
 */
export function ampliar(p, extraUsd) {
  const siguiente = { ...p, tope_usd: p.tope_usd + Math.max(0, extraUsd) };
  siguiente.estado = estadoDe(siguiente);
  return siguiente;
}

/**
 * Modelo que debe usar la siguiente llamada.
 * @param {string} alias                       alias del agente (opus | sonnet | haiku | id directo)
 * @param {import('./estado.js').Presupuesto} p
 * @param {'escalon'|'local'} [degradarA]
 * @returns {{ alias: string, proveedorLocal: boolean, degradado: boolean }}
 */
export function modeloEfectivo(alias, p, degradarA = 'escalon') {
  if (p.estado !== 'degradado') return { alias, proveedorLocal: false, degradado: false };
  if (degradarA === 'local')    return { alias, proveedorLocal: true, degradado: true };
  const siguiente = ESCALON[alias] ?? alias;
  return { alias: siguiente, proveedorLocal: false, degradado: siguiente !== alias };
}
