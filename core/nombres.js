/** Nombres del producto en un solo sitio: forma nueva y forma antigua (que sigue funcionando en 5.x). */
export const PRODUCTO = 'Fragua';
export const PRODUCTO_ANTIGUO = 'FORGE';
export const PAQUETE = 'fragua';
export const PAQUETE_ANTIGUO = 'forja-mvp';
export const ORDEN = 'fragua';
export const ORDENES_ANTIGUAS = Object.freeze(['forge', 'sdd-es']);
export const PREFIJO_VARIABLE = 'FRAGUA_';
export const PREFIJO_VARIABLE_ANTIGUO = 'FORGE_';

/**
 * Orden con la que se invocó el programa, a partir de process.argv[1]. Si no se reconoce (p. ej. `node cli/index.js`
 * o el shim de Windows, que apunta al mismo archivo) devuelve la nueva.
 * @param {string|undefined} argv1
 */
export function ordenInvocada(argv1) {
  const base = String(argv1 ?? '').split(/[\\/]/).pop().replace(/\.(cmd|ps1|exe|js|mjs)$/i, '').toLowerCase();
  if (base === ORDEN || ORDENES_ANTIGUAS.includes(base)) return base;
  return ORDEN;
}

/**
 * ¿Hay que avisar? Solo con la orden `forge`, salida interactiva, sin --json y fuera de procesos de prueba.
 * @param {string} orden @param {string[]} args @param {{isTTY?: boolean}} salida @param {Record<string,string|undefined>} env
 */
export function debeAvisarOrdenAntigua(orden, args, salida, env) {
  if (orden !== 'forge') return false;
  if (!salida || !salida.isTTY) return false;
  if (args.includes('--json') || args.includes('--version') || args.includes('-v')) return false;
  if (env.NODE_TEST_CONTEXT !== undefined) return false;
  return true;
}
