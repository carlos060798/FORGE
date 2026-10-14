/**
 * resultado.js — Forma estable del resultado de `forge verificar` (spec 2026-10-13-verificar-sin-modelo)
 *
 * El veredicto lo da el código de salida de las pruebas y reglas fijas, nunca un modelo (Principio VI).
 * Toda cadena que sale hacia fuera (comando, salida de las pruebas, avisos) se redacta antes.
 */

import { cola, redactar } from '../ciclo/redactar.js';

/** Versión del formato del objeto; sube si cambia algún campo. */
export const FORMATO = 1;

/** Tope de la salida de las pruebas que se incluye en el resultado. */
export const SALIDA_MAX_BYTES = 8192;

/** @typedef {'pasa'|'falla'|'sin_pruebas'|'infraestructura'} Veredicto */

/** Mismos códigos que `forge run` (core/engine-cli.js SALIDA). */
export const CODIGOS = { OK: 0, FALLO: 1, SIN_AISLAMIENTO: 4 };

/** @type {Record<Veredicto, number>} */
const CODIGO_POR_VEREDICTO = {
  pasa: CODIGOS.OK,
  falla: CODIGOS.FALLO,
  sin_pruebas: CODIGOS.FALLO,        // cero pruebas ejecutadas no es éxito
  infraestructura: CODIGOS.SIN_AISLAMIENTO,
};

/**
 * @param {Veredicto} veredicto
 * @returns {number} código de salida del proceso
 */
export function codigoDeSalida(veredicto) {
  return CODIGO_POR_VEREDICTO[veredicto] ?? CODIGOS.FALLO;
}

/**
 * @param {{
 *   veredicto: Veredicto,
 *   motivo?: string|null,
 *   codigoPruebas?: number|null,
 *   comando?: string|null,
 *   lenguaje?: string|null,
 *   imagen?: string|null,
 *   duracionMs?: number,
 *   cortePorTiempo?: boolean,
 *   cortePorMemoria?: boolean,
 *   salida?: string,
 *   avisos?: string[],
 * }} datos
 */
export function crearResultado(datos) {
  const veredicto = datos.veredicto;
  return {
    formato: FORMATO,
    veredicto,
    codigoSalida: codigoDeSalida(veredicto),
    // El motivo puede venir de la salida de un proceso (stderr): se redacta como todo lo que sale
    motivo: datos.motivo == null ? null : redactar(String(datos.motivo)),
    codigoPruebas: datos.codigoPruebas ?? null,
    comando: datos.comando == null ? null : redactar(datos.comando),
    lenguaje: datos.lenguaje ?? null,
    imagen: datos.imagen ?? null,
    duracionMs: Math.max(0, Math.round(datos.duracionMs ?? 0)),
    cortePorTiempo: datos.cortePorTiempo === true,
    cortePorMemoria: datos.cortePorMemoria === true,
    // `cola` redacta ANTES de recortar: un secreto partido por el recorte no pasa
    salida: cola(datos.salida ?? '', SALIDA_MAX_BYTES),
    avisos: (datos.avisos ?? []).map((a) => redactar(String(a))),
  };
}

/**
 * Texto para una persona. No decide nada: solo muestra el resultado.
 * @param {ReturnType<typeof crearResultado>} r
 */
export function textoDelResultado(r) {
  const titulo = {
    pasa: 'PASA: las pruebas pasan en el contenedor aislado.',
    falla: 'FALLA: las pruebas no pasan.',
    sin_pruebas: 'SIN PRUEBAS: no se ejecutó ninguna prueba (no cuenta como éxito).',
    infraestructura: 'INFRAESTRUCTURA: no se pudo ejecutar el aislamiento; no se ejecutó nada en tu equipo.',
  }[r.veredicto];
  const l = [titulo];
  if (r.motivo) l.push(`Motivo: ${r.motivo}`);
  if (r.comando) l.push(`Comando: ${r.comando}`);
  if (r.lenguaje) l.push(`Lenguaje: ${r.lenguaje}${r.imagen ? ` · imagen: ${r.imagen}` : ''}`);
  if (r.codigoPruebas !== null) l.push(`Código de salida de las pruebas: ${r.codigoPruebas} · ${r.duracionMs} ms`);
  if (r.cortePorTiempo) l.push('Las pruebas se cortaron por tiempo.');
  if (r.cortePorMemoria) l.push('Las pruebas se cortaron por memoria.');
  for (const a of r.avisos) l.push(`Aviso: ${a}`);
  if (r.salida) l.push('--- salida de las pruebas (acotada y redactada) ---', r.salida.trimEnd());
  return l.join('\n');
}
