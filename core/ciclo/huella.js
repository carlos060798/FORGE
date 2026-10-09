/**
 * huella.js — Huella de la salida de una ejecución de pruebas
 *
 * Sirve para saber si dos ejecuciones fallaron «igual» (hallazgo H8: unas pruebas
 * rotas por sí mismas daban la misma salida iteración tras iteración). La huella es
 * un sha256 de la salida sin lo que cambia entre dos ejecuciones idénticas:
 * duraciones, marcas de tiempo y direcciones de memoria.
 *
 * Funciones puras. Con la huella solo se compara igualdad: el router nunca
 * interpreta el texto de la salida (ADR-05).
 */

import { createHash } from 'node:crypto';

/**
 * Cada patrón: [expresión, sustitución]. El orden importa: las fechas antes que las
 * duraciones, para que «10:11:12» no se lea como una cifra con unidad.
 * @type {[RegExp, string][]}
 */
const PATRONES = [
  // Marcas de tiempo: 2026-10-09T10:11:12.345Z, 2026-10-09 10:11:12, 10:11:12
  [/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d{1,9})?(?:Z|[+-]\d{2}:?\d{2})?/g, '<fecha>'],
  [/\b\d{2}:\d{2}:\d{2}(?:[.,]\d{1,9})?/g, '<hora>'],
  // Direcciones de memoria: <Objeto at 0x7f3a9c0012b0>
  [/\b0x[0-9a-fA-F]+\b/g, '<dir>'],
  // node:test: «# duration_ms 123.4», «duration_ms: 123.4»
  [/\bduration_ms:?\s+\d+(?:\.\d+)?/g, 'duration_ms <t>'],
  // Cifra con unidad de tiempo: «in 0.12s», «(1.2ms)», «Ran 2 tests in 0.001s», «Time: 2 s»
  [/\b\d+(?:\.\d+)?\s?(?:ms|µs|us|ns|s|secs?|seconds?|seg|segundos?|min)\b/g, '<t>'],
];

/**
 * Salida sin lo que varía entre dos ejecuciones iguales. Lo demás se conserva tal cual:
 * un número de línea, un recuento de fallos o un valor esperado distintos son progreso.
 * @param {string} texto
 * @returns {string}
 */
export function normalizarSalida(texto) {
  let limpio = String(texto ?? '').replace(/\r\n?/g, '\n');
  for (const [patron, sustitucion] of PATRONES) limpio = limpio.replace(patron, sustitucion);
  return limpio.replace(/[ \t]+$/gm, '').trim();
}

/**
 * sha256 de la salida normalizada. Cadena vacía si no queda nada que comparar: dos
 * ejecuciones sin salida no demuestran que el fallo sea el mismo.
 * @param {string} stdout
 * @param {string} stderr
 * @returns {string}
 */
export function huellaDeSalida(stdout, stderr) {
  const salida  = normalizarSalida(stdout);
  const errores = normalizarSalida(stderr);
  if (salida === '' && errores === '') return '';
  return createHash('sha256').update(salida).update('\0').update(errores).digest('hex');
}
