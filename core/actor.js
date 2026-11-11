// @ts-check
/**
 * actor.js — Quién hace algo: persona, agente o ejecución de CI.
 *
 * Fase 1 del plan de equipos (spec 2026-11-10-equipos-y-ciclo-en-ci): los eventos, el libro de gasto y la
 * decisión de revisión anotan `quien`. Es lo que el entorno DECLARA, no una identidad verificada: no sustituye
 * a la firma de las aprobaciones (core/aprobaciones-identidad.js) ni se usa para decidir permisos.
 *
 * La identidad del agente sale de `agenteActivo` (core/entorno.js, el único punto que lee las variables
 * de Fragua y de Forge). La CI se detecta solo con `CI`: no se leen variables de GitHub porque la fixture de aislamiento las trata
 * como tokens; el identificador de la ejecución llegará con `run --ci`, con su propia decisión.
 * Con un agente dentro de CI manda el agente y se conserva `ci: true`.
 */
import { userInfo } from 'node:os';
import { agenteActivo } from './entorno.js';

/**
 * @typedef {Object} Actor
 * @property {'persona'|'agente'|'ci'} tipo
 * @property {string} id
 * @property {true} [ci]  la ejecución ocurre en integración continua
 */

const MAX_ID = 200;

/** @param {unknown} v @returns {string} */
const limpio = (v) => String(v ?? '').replace(/[\p{Cc}\p{Cf}]/gu, '').trim().slice(0, MAX_ID);

/** @type {string|undefined} */
let usuarioSO;
function usuarioDelSistema() {
  if (usuarioSO === undefined) {
    try { usuarioSO = limpio(userInfo().username) || 'desconocido'; } catch { usuarioSO = 'desconocido'; }
  }
  return usuarioSO;
}

/**
 * @param {Record<string, string|undefined>} [env]
 * @returns {Actor}
 */
export function actorActual(env = process.env) {
  const agente = limpio(agenteActivo(env));
  const enCi = env.CI === 'true' || env.CI === '1';
  if (agente) return enCi ? { tipo: 'agente', id: agente, ci: true } : { tipo: 'agente', id: agente };
  if (enCi) return { tipo: 'ci', id: 'ci', ci: true };
  return { tipo: 'persona', id: usuarioDelSistema() };
}
