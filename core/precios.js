/**
 * precios.js — Lista incluida de modelos y precios (ADR-19)
 *
 * Único archivo de datos con los precios que FORGE usa para calcular el gasto
 * cuando el proyecto no indica otros en `precios:` de `.sdd/sdd.config.yaml`
 * (lo configurado manda sobre esta lista).
 *
 * Los precios se copian de la página oficial del proveedor el día de la
 * revisión, nunca de memoria. Al actualizar la tabla, cambia también REVISADA.
 *
 * Fuentes (Anthropic), consultadas el día de REVISADA:
 *   Precios:        https://platform.claude.com/docs/en/about-claude/pricing
 *   Identificadores y estado de cada modelo:
 *                   https://platform.claude.com/docs/en/about-claude/model-deprecations
 *   Modelos actuales: https://platform.claude.com/docs/en/about-claude/models/overview
 */

/** Fecha de la última revisión de la tabla contra la fuente oficial. */
export const REVISADA = '2026-10-09';

/** Página de la que se copiaron los precios de Anthropic. */
export const FUENTE = 'https://platform.claude.com/docs/en/about-claude/pricing';

/**
 * @typedef {object} PrecioModelo  USD por millón de tokens
 * @property {number} entrada
 * @property {number} salida
 * @property {number} [cache_escritura_5m]  escritura en la caché de 5 minutos
 * @property {number} [cache_escritura_1h]  escritura en la caché de 1 hora
 * @property {number} [cache_lectura]       lectura (acierto) de caché
 */

/**
 * Precios en USD por millón de tokens, por proveedor e identificador de modelo.
 * Los de caché los usa el libro de gasto del ciclo (spec 2026-10-09-puesta-al-dia):
 * escritura en la caché de 5 minutos y lectura, ver `preciosCache`.
 * @type {Record<string, Record<string, PrecioModelo>>}
 */
export const TABLA = {
  anthropic: {
    'claude-fable-5-1':           { entrada: 10,  salida: 50,  cache_escritura_5m: 12.5,  cache_escritura_1h: 20,  cache_lectura: 0.25 },
    'claude-mythos-5-1':          { entrada: 10,  salida: 50,  cache_escritura_5m: 12.5,  cache_escritura_1h: 20,  cache_lectura: 0.25 },
    'claude-fable-5':             { entrada: 10,  salida: 50,  cache_escritura_5m: 12.5,  cache_escritura_1h: 20,  cache_lectura: 1 },
    'claude-mythos-5':            { entrada: 10,  salida: 50,  cache_escritura_5m: 12.5,  cache_escritura_1h: 20,  cache_lectura: 1 },
    'claude-opus-5-5':            { entrada: 4,   salida: 20,  cache_escritura_5m: 5,     cache_escritura_1h: 8,   cache_lectura: 0.2 },
    'claude-opus-5':              { entrada: 5,   salida: 25,  cache_escritura_5m: 6.25,  cache_escritura_1h: 10,  cache_lectura: 0.5 },
    'claude-opus-4-8':            { entrada: 5,   salida: 25,  cache_escritura_5m: 6.25,  cache_escritura_1h: 10,  cache_lectura: 0.5 },
    'claude-opus-4-7':            { entrada: 5,   salida: 25,  cache_escritura_5m: 6.25,  cache_escritura_1h: 10,  cache_lectura: 0.5 },
    'claude-opus-4-6':            { entrada: 5,   salida: 25,  cache_escritura_5m: 6.25,  cache_escritura_1h: 10,  cache_lectura: 0.5 },
    'claude-opus-4-5-20251101':   { entrada: 5,   salida: 25,  cache_escritura_5m: 6.25,  cache_escritura_1h: 10,  cache_lectura: 0.5 },
    'claude-sonnet-5-5':          { entrada: 2,   salida: 10,  cache_escritura_5m: 2.5,   cache_escritura_1h: 4,   cache_lectura: 0.1 },
    'claude-sonnet-5':            { entrada: 2,   salida: 10,  cache_escritura_5m: 2.5,   cache_escritura_1h: 4,   cache_lectura: 0.2 },
    'claude-sonnet-4-6':          { entrada: 3,   salida: 15,  cache_escritura_5m: 3.75,  cache_escritura_1h: 6,   cache_lectura: 0.3 },
    // Sonnet 4.5: obsoleto desde el 2026-09-30, se retira el 2026-11-30
    'claude-sonnet-4-5-20250929': { entrada: 3,   salida: 15,  cache_escritura_5m: 3.75,  cache_escritura_1h: 6,   cache_lectura: 0.3 },
    // Haiku 5.5 cobra por tramos: estos precios valen para peticiones de hasta 100 000 tokens de
    // entrada. Por encima, la petición entera cuesta 0,50 / 2,50 (5 veces más) y FORGE NO lo
    // contempla: con el contexto por defecto del ciclo (65 536 bytes) no se alcanza ese tramo.
    'claude-haiku-5-5':           { entrada: 0.1, salida: 0.5, cache_escritura_5m: 0.125, cache_escritura_1h: 0.2, cache_lectura: 0.01 },
    // Haiku 4.5: activo, con retirada «no antes del 2026-10-15»
    'claude-haiku-4-5-20251001':  { entrada: 1,   salida: 5,   cache_escritura_5m: 1.25,  cache_escritura_1h: 2,   cache_lectura: 0.1 },
  },
  // OpenAI: SIN CONFIRMAR. Valores de referencia heredados, no contrastados con la tarifa
  // oficial en esta revisión. Quien use este proveedor debe fijar sus precios en `precios:`.
  openai: {
    'gpt-4o':      { entrada: 2.5,  salida: 10 },
    'gpt-4o-mini': { entrada: 0.15, salida: 0.6 },
  },
};

const POR_MILLON = 1_000_000;

/**
 * @param {{ entrada: number, salida: number }} p  USD por millón de tokens
 * @returns {{ input: number, output: number }}    USD por token
 */
export function porToken(p) {
  return { input: p.entrada / POR_MILLON, output: p.salida / POR_MILLON };
}

/**
 * La tabla incluida en USD por token, con la forma que usa el libro de costos.
 * @returns {Record<string, Record<string, { input: number, output: number }>>}
 */
export function tablaPorToken() {
  /** @type {Record<string, Record<string, { input: number, output: number }>>} */
  const salida = {};
  for (const [proveedor, modelos] of Object.entries(TABLA)) {
    salida[proveedor] = {};
    for (const [id, p] of Object.entries(modelos)) salida[proveedor][id] = porToken(p);
  }
  return salida;
}

/**
 * El precio más alto conocido: el que se aplica a un modelo sin precio. Cuenta
 * la tabla incluida y lo que el proyecto haya configurado. Entrada y salida se
 * toman por separado, para no cobrar nunca por debajo de ningún modelo conocido.
 * @param {Record<string, { input: number, output: number }>} [configurados]  USD por token
 * @returns {{ input: number, output: number }}
 */
export function precioMasCaro(configurados = {}) {
  const todos = [...Object.values(tablaPorToken()).flatMap((m) => Object.values(m)), ...Object.values(configurados)];
  return {
    input:  Math.max(...todos.map((p) => p.input)),
    output: Math.max(...todos.map((p) => p.output)),
  };
}

/**
 * Multiplicador documentado de la escritura en la caché de 5 minutos sobre el precio de
 * entrada. Se usa cuando un modelo no trae su precio de caché: cobrar la escritura al precio
 * de entrada sería cobrar MENOS de lo que cobra el proveedor.
 * Fuente: https://platform.claude.com/docs/en/build-with-claude/prompt-caching
 * («5-minute cache write tokens are 1.25 times the base input tokens price»).
 */
export const MULTIPLICADOR_ESCRITURA_5M = 1.25;

/**
 * Precios de caché de la lista incluida para un modelo, en USD por token: escritura en la
 * caché de 5 minutos (la que usa FORGE) y lectura. `null` si el modelo no los trae.
 * @param {string} proveedor
 * @param {string} modelo
 * @returns {{ escritura: number, lectura: number } | null}
 */
export function preciosCache(proveedor, modelo) {
  const p = Object.hasOwn(TABLA[proveedor] ?? {}, modelo) ? TABLA[proveedor][modelo] : null;
  if (!p || typeof p.cache_escritura_5m !== 'number' || typeof p.cache_lectura !== 'number') return null;
  return { escritura: p.cache_escritura_5m / POR_MILLON, lectura: p.cache_lectura / POR_MILLON };
}

/**
 * Precio al que se cobran los tokens de caché cuando no se conoce uno propio: la lectura al
 * precio de entrada normal (nunca por debajo de lo que cobra el proveedor, que la rebaja) y
 * la escritura al de entrada por el multiplicador documentado.
 * @param {number} entradaPorToken
 * @returns {{ escritura: number, lectura: number }}
 */
export function preciosCachePorDefecto(entradaPorToken) {
  return { escritura: entradaPorToken * MULTIPLICADOR_ESCRITURA_5M, lectura: entradaPorToken };
}

/** Línea que muestran `forge status` y `forge doctor`. */
export function lineaRevision() {
  return `Tabla de precios revisada el ${REVISADA} (${FUENTE}). Corrige o añade precios en precios: de sdd.config.yaml`;
}
