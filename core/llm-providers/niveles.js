/**
 * niveles.js — Niveles de modelo neutrales a proveedor (spec 2026-10-13-proveedores-agnosticos, F5)
 *
 * Una sola fuente de verdad de los niveles. `alto`, `medio` y `economico` son los nombres neutrales;
 * `opus`, `sonnet` y `haiku` valen como alias equivalentes (sin aviso de obsolescencia en esta entrega).
 *
 * Los dos juegos de nombres se comportan igual en la degradación por presupuesto y en el nivel máximo:
 * el resultado conserva el juego de nombres de la entrada (`opus` baja a `sonnet`, `alto` a `medio`).
 */

/** De más barato a más caro. */
export const NIVELES = /** @type {const} */ (['economico', 'medio', 'alto']);

/** Alias heredados → nivel neutral. */
export const ALIAS_HEREDADOS = /** @type {Record<string, string>} */ ({ haiku: 'economico', sonnet: 'medio', opus: 'alto' });

const HEREDADO_DE = /** @type {Record<string, string>} */ ({ economico: 'haiku', medio: 'sonnet', alto: 'opus' });

/** Todos los nombres que se aceptan como nivel, en los dos juegos. */
export const NOMBRES_DE_NIVEL = [...NIVELES, ...Object.keys(ALIAS_HEREDADOS)];

/**
 * Nivel neutral de un nombre (`alto`, `opus`...), o `null` si no es un nivel (un identificador directo de modelo).
 * @param {unknown} nombre
 * @returns {'economico'|'medio'|'alto'|null}
 */
export function nivelDe(nombre) {
  const n = String(nombre ?? '').trim();
  if (/** @type {readonly string[]} */ (NIVELES).includes(n)) return /** @type {any} */ (n);
  return /** @type {any} */ (Object.hasOwn(ALIAS_HEREDADOS, n) ? ALIAS_HEREDADOS[n] : null);
}

/** ¿Es un nombre de nivel, en cualquiera de los dos juegos? */
export const esNivel = (nombre) => nivelDe(nombre) !== null;

/** Posición de menor a mayor (0 económico, 2 alto), o -1 si no es un nivel. */
export const rango = (nombre) => { const n = nivelDe(nombre); return n === null ? -1 : NIVELES.indexOf(n); };

/**
 * Nombre de `nivel` en el mismo juego de nombres que `modelo` (heredado si `modelo` es opus/sonnet/haiku).
 * @param {string} modelo @param {'economico'|'medio'|'alto'} nivel
 */
function enJuegoDe(modelo, nivel) {
  return Object.hasOwn(ALIAS_HEREDADOS, String(modelo).trim()) ? HEREDADO_DE[nivel] : nivel;
}

/**
 * Limita el nivel que pide un agente (`motor.nivel_maximo`). Un identificador directo de modelo,
 * que no es un nivel, no se toca. Con dos niveles iguales no cambia nada.
 * @param {string} alias @param {string} [maximo]
 */
export function limitarNivel(alias, maximo) {
  const a = rango(alias);
  const m = rango(maximo);
  if (a === -1 || m === -1 || a <= m) return alias;
  return enJuegoDe(alias, NIVELES[m]);
}

/**
 * El nivel siguiente hacia abajo (degradación por presupuesto). El más barato se queda donde está;
 * lo que no es un nivel, también.
 * @param {string} alias
 */
export function nivelInferior(alias) {
  const a = rango(alias);
  if (a <= 0) return alias;
  return enJuegoDe(alias, NIVELES[a - 1]);
}

/**
 * Modelo de un nivel: lo fijado en `modelos:` (con el nombre pedido, o con el de su otro juego) y, si
 * no, el de la tabla del proveedor, que está escrita con los nombres heredados. Lo que no es un nivel
 * es ya un identificador de modelo y se devuelve tal cual.
 * @param {string} alias
 * @param {Record<string, string>} modelos     `modelos:` del proyecto
 * @param {Record<string, string>} porDefecto  tabla del proveedor, por nombre heredado
 */
export function modeloDeNivel(alias, modelos = {}, porDefecto = {}) {
  const nivel = nivelDe(alias);
  if (nivel === null) return alias;
  const heredado = HEREDADO_DE[nivel];
  return modelos[alias] ?? modelos[nivel] ?? modelos[heredado] ?? porDefecto[heredado] ?? porDefecto[nivel] ?? alias;
}

/**
 * Líneas para `forge doctor`: a qué modelo resuelve cada nivel en cada proveedor (CA-005-04).
 * Sin red: solo pregunta a cada proveedor por `resolveModelId`.
 * @param {{ nombre: string, resolveModelId: (alias: string) => string }[]} proveedores
 */
export function lineasDeNiveles(proveedores) {
  return proveedores.map((p) => `  ${p.nombre}: ` + NIVELES.slice().reverse()
    .map((n) => `${n} (${HEREDADO_DE[n]}) → ${p.resolveModelId(n)}`).join(' · '));
}
