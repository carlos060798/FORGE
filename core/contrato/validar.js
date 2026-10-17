// @ts-check
/**
 * validar.js — Validador de un SUBCONJUNTO de JSON Schema, sin dependencias
 * (spec 2026-10-14-contrato-publico; informe spikes/subconjunto-json-schema.md).
 *
 * Es cerrado: una palabra clave que no conoce LANZA (un esquema con algo fuera del subconjunto no se
 * valida «a medias»). `format` es solo anotación: NO se valida (`date-time` incluido).
 * Lo usan las pruebas de contrato y herramientas de solo lectura; NO se ejecuta en caliente en `verificar`.
 */

const ANOTACIONES = new Set(['$schema', '$id', 'title', 'description', 'default', 'format', 'x-interno', 'examples']);
const VALIDAS = new Set([
  'type', 'properties', 'required', 'additionalProperties', 'items', 'enum', 'const',
  'minimum', 'maximum', 'minLength', 'maxLength', 'minItems', 'maxItems', 'pattern',
]);
const TIPOS = new Set(['string', 'number', 'integer', 'boolean', 'object', 'array', 'null']);

/** Tope de errores devueltos y de longitud de cadena sobre la que se aplica `pattern` (anti-ReDoS). */
export const MAX_ERRORES = 20;
const MAX_CADENA_PATRON = 65536;

/**
 * Lanza si el esquema usa algo fuera del subconjunto.
 * @param {any} esquema
 * @param {string} [ruta]
 */
export function comprobarEsquema(esquema, ruta = '$') {
  if (typeof esquema === 'boolean') return;
  if (esquema === null || typeof esquema !== 'object' || Array.isArray(esquema)) throw new Error(`esquema inválido en ${ruta}`);
  for (const k of Object.keys(esquema)) {
    if (!VALIDAS.has(k) && !ANOTACIONES.has(k) && !k.startsWith('x-')) throw new Error(`palabra clave no soportada: ${k} en ${ruta}`);
  }
  for (const t of [].concat(esquema.type ?? [])) {
    if (!TIPOS.has(t)) throw new Error(`tipo no soportado: ${t} en ${ruta}`);
  }
  if ('items' in esquema) {
    if (Array.isArray(esquema.items)) throw new Error(`items en forma de lista no soportado en ${ruta}`);
    comprobarEsquema(esquema.items, `${ruta}[]`);
  }
  for (const [n, s] of Object.entries(esquema.properties ?? {})) comprobarEsquema(s, `${ruta}.${n}`);
  if (esquema.additionalProperties && typeof esquema.additionalProperties === 'object') comprobarEsquema(esquema.additionalProperties, `${ruta}.*`);
  if (typeof esquema.pattern === 'string') new RegExp(esquema.pattern);
}

/** @param {any} v @param {string} t */
function esDeTipo(v, t) {
  switch (t) {
    case 'string': return typeof v === 'string';
    case 'number': return typeof v === 'number' && Number.isFinite(v);
    case 'integer': return Number.isInteger(v);
    case 'boolean': return typeof v === 'boolean';
    case 'null': return v === null;
    case 'array': return Array.isArray(v);
    case 'object': return v !== null && typeof v === 'object' && !Array.isArray(v);
    default: return false;
  }
}

/** @param {any} a @param {any} b */
const iguales = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * @param {any} esquema
 * @param {any} valor
 * @returns {string[]} errores con ruta (vacío = válido); lanza si el esquema usa algo no soportado
 */
export function validar(esquema, valor) {
  comprobarEsquema(esquema);
  /** @type {string[]} */
  const errores = [];
  visitar(esquema, valor, '$', errores);
  return errores.slice(0, MAX_ERRORES + 1);
}

/** @param {any} s @param {any} v @param {string} ruta @param {string[]} out */
function visitar(s, v, ruta, out) {
  if (out.length > MAX_ERRORES) return;
  if (s === true) return;
  if (s === false) { out.push(`${ruta}: no admitido`); return; }
  if (s.type !== undefined) {
    const tipos = [].concat(s.type);
    if (!tipos.some((t) => esDeTipo(v, t))) { out.push(`${ruta}: tipo ${tipos.join('|')} esperado`); return; }
  }
  if (s.enum && !s.enum.some((/** @type {any} */ x) => iguales(x, v))) out.push(`${ruta}: fuera de enum`);
  if ('const' in s && !iguales(s.const, v)) out.push(`${ruta}: debe ser ${JSON.stringify(s.const)}`);
  if (typeof v === 'number') {
    if (s.minimum !== undefined && v < s.minimum) out.push(`${ruta}: menor que ${s.minimum}`);
    if (s.maximum !== undefined && v > s.maximum) out.push(`${ruta}: mayor que ${s.maximum}`);
  }
  if (typeof v === 'string') {
    if (s.minLength !== undefined && v.length < s.minLength) out.push(`${ruta}: más corta que ${s.minLength}`);
    if (s.maxLength !== undefined && v.length > s.maxLength) out.push(`${ruta}: más larga que ${s.maxLength}`);
    if (s.pattern !== undefined) {
      if (v.length > MAX_CADENA_PATRON) out.push(`${ruta}: cadena demasiado larga para comprobar el patrón`);
      else if (!new RegExp(s.pattern).test(v)) out.push(`${ruta}: no cumple el patrón`);
    }
  }
  if (Array.isArray(v)) {
    if (s.minItems !== undefined && v.length < s.minItems) out.push(`${ruta}: menos de ${s.minItems} elementos`);
    if (s.maxItems !== undefined && v.length > s.maxItems) out.push(`${ruta}: más de ${s.maxItems} elementos`);
    if (s.items !== undefined) v.forEach((x, i) => visitar(s.items, x, `${ruta}[${i}]`, out));
  }
  if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
    // Solo propiedades PROPIAS: con `in`, un campo llamado «constructor» o «toString» se tomaría por declarado
    for (const r of s.required ?? []) if (!Object.hasOwn(v, r)) out.push(`${ruta}.${r}: falta (obligatorio)`);
    const props = s.properties ?? {};
    for (const [k, x] of Object.entries(v)) {
      if (Object.hasOwn(props, k)) visitar(props[k], x, `${ruta}.${k}`, out);
      else if (s.additionalProperties === false) out.push(`${ruta}: campo adicional ${k}`);
      else if (s.additionalProperties && typeof s.additionalProperties === 'object') visitar(s.additionalProperties, x, `${ruta}.${k}`, out);
    }
  }
}
