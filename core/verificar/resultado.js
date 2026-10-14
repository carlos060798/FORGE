/**
 * resultado.js — Forma estable del resultado de `forge verificar` (spec 2026-10-13-verificar-sin-modelo)
 *
 * El veredicto lo da el código de salida de las pruebas y reglas fijas, nunca un modelo (Principio VI).
 * Toda cadena que sale hacia fuera (comando, salida de las pruebas, avisos) se redacta antes.
 */

import { cola, redactar } from '../ciclo/redactar.js';
import { AVISO_ADVERSARIO } from './mutacion.js';

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
 *   mutacion?: Record<string, any>|null,
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
    // null si no se pidió --mutacion; con --mutacion es siempre un objeto (core/verificar/mutacion.js)
    mutacion: datos.mutacion ?? null,
    // Con --registrar: { id, archivo } o { error }; null si no se pidió
    registro: /** @type {null | { id?: string, archivo?: string, error?: string }} */ (null),
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
  if (r.mutacion) l.push(...textoDeMutacion(r.mutacion));
  if (r.registro) l.push(r.registro.error ? `Registro: NO se pudo registrar: ${r.registro.error}` : `Registro: ${r.registro.archivo}`);
  if (r.salida) l.push('--- salida de las pruebas (acotada y redactada) ---', r.salida.trimEnd());
  return l.join('\n');
}

/** @param {Record<string, any>} m */
function textoDeMutacion(m) {
  const pct = (/** @type {number} */ x) => `${Math.round(x * 100)} %`;
  const etiqueta = /** @type {Record<string, string>} */ ({
    medida: 'medida', cumple_el_minimo: 'CUMPLE el mínimo', bajo_el_minimo: 'BAJO el mínimo',
    no_concluyente: 'NO CONCLUYENTE (no cuenta como éxito)',
  })[m.veredicto] ?? m.veredicto;
  const detalle = m.concluyente && m.puntuacion !== null ? ` · detecta ${m.detectadas} de ${m.probadas} (${pct(m.puntuacion)})` : '';
  const minima = m.minima !== null ? ` · mínimo ${pct(m.minima)}` : '';
  const l = [`Mutación: ${etiqueta}${detalle}${minima}`];
  if (m.archivos?.length) l.push(`  Archivos: ${m.archivos.join(', ')}`);
  for (const x of m.motivos ?? []) l.push(`  No concluyente: ${x}`);
  for (const x of m.rechazadas ?? []) l.push(`  Rechazado: ${x.ruta} (${x.motivo})`);
  for (const s of m.sobrevivientes ?? []) l.push(`  Sin detectar: ${s.ruta}:${s.linea} (${s.operador}) «${s.antes}» → «${s.despues}»`);
  l.push(`  ${AVISO_ADVERSARIO}`);
  return l;
}
