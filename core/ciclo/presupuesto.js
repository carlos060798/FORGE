/**
 * presupuesto.js — Libro de costos del ciclo verificado (ADR-06)
 *
 * Funciones puras sobre `EstadoCiclo.presupuesto`. Al vivir en el estado, el
 * gasto se guarda en cada punto de guardado y sobrevive a la reanudación.
 */

import { precioDe, PROVEEDORES_SIN_COSTO } from '../session-budget.js';

const ESCALON = { opus: 'sonnet', sonnet: 'haiku', haiku: 'haiku' };

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

/**
 * @param {import('./estado.js').Presupuesto} p
 * @param {{ proveedor: string, modelo: string, inputTokens?: number, outputTokens?: number }} llamada
 * @param {{ precioDesconocido?: { input: number, output: number } }} [opciones]
 * @returns {import('./estado.js').Presupuesto}
 */
export function registrar(p, llamada, opciones = {}) {
  const sinCosto = PROVEEDORES_SIN_COSTO.has(llamada.proveedor);
  const faltaConsumo = typeof llamada.inputTokens !== 'number' || typeof llamada.outputTokens !== 'number';
  if (faltaConsumo && !sinCosto) throw new ErrorConsumo(llamada.proveedor);

  const tokensIn  = llamada.inputTokens ?? 0;
  const tokensOut = llamada.outputTokens ?? 0;
  const precio    = precioDe(llamada.proveedor, llamada.modelo, opciones.precioDesconocido);

  const siguiente = {
    ...p,
    gastado_usd: p.gastado_usd + tokensIn * precio.input + tokensOut * precio.output,
    llamadas:    p.llamadas + 1,
    tokens_in:   p.tokens_in + tokensIn,
    tokens_out:  p.tokens_out + tokensOut,
  };
  siguiente.estado = estadoDe(siguiente);
  return siguiente;
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
