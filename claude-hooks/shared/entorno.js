/**
 * Lectura de variables de entorno con los dos prefijos: FRAGUA_<sufijo> (nuevo) y FORGE_<sufijo> (antiguo).
 *
 * Reglas (seguridad): solo una definida -> esa; las dos iguales -> ese valor; las dos distintas -> LANZA un
 * error que nombra las dos (jamás elige una). Una variable definida pero vacía cuenta como definida.
 * Solo se lee del entorno que se recibe (el del usuario), nunca de un archivo del proyecto.
 *
 * Vive en claude-hooks/shared porque los hooks se copian solos a los proyectos; core/entorno.js lo reexporta.
 */
export const PREFIJO_NUEVO = 'FRAGUA_';
export const PREFIJO_ANTIGUO = 'FORGE_';
export const PREFIJOS = Object.freeze([PREFIJO_NUEVO, PREFIJO_ANTIGUO]);

export class ErrorVariableEnConflicto extends Error {
  /** @param {string} nuevo @param {string} antiguo */
  constructor(nuevo, antiguo) {
    super(`Las variables ${nuevo} y ${antiguo} están definidas con valores distintos: no se elige ninguna. Deja solo una (o pon el mismo valor en las dos).`);
    this.name = 'ErrorVariableEnConflicto';
    this.code = 'variable_en_conflicto';
    this.variables = [nuevo, antiguo];
  }
}

/**
 * @param {string} sufijo  p. ej. 'BUDGET_USD'
 * @param {Record<string, string|undefined>} [env]
 * @returns {string|undefined}
 */
export function leerVariable(sufijo, env = process.env) {
  const n = `${PREFIJO_NUEVO}${sufijo}`;
  const a = `${PREFIJO_ANTIGUO}${sufijo}`;
  const vn = env[n];
  const va = env[a];
  if (vn === undefined) return va;
  if (va === undefined) return vn;
  if (String(vn).trim() !== String(va).trim()) throw new ErrorVariableEnConflicto(n, a);
  return vn;
}

/**
 * Como `leerVariable`, pero ante conflicto devuelve `restrictivo` (lo más cerrado) en vez de lanzar.
 * Para listas e interruptores de política, donde nunca debe ganar la opción más permisiva.
 * @param {string} sufijo
 * @param {Record<string, string|undefined>} env
 * @param {string|undefined} restrictivo
 */
export function leerVariableRestrictiva(sufijo, env = process.env, restrictivo = '') {
  try {
    return leerVariable(sufijo, env);
  } catch (e) {
    if (e instanceof ErrorVariableEnConflicto) return restrictivo;
    throw e;
  }
}

/** Copia de `env` sin las dos formas de una variable (para procesos hijos). */
export function sinVariable(sufijo, env = process.env) {
  const copia = { ...env };
  for (const p of PREFIJOS) delete copia[`${p}${sufijo}`];
  return copia;
}
