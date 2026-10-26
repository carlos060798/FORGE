// @ts-check
/**
 * argumentos.js — Argumentos de `fragua mcp` (revisión independiente 2026-10-25, M1).
 *
 * Acepta `--perfil <x>` y `--perfil=<x>` (y lo mismo con `--cwd`). Cualquier otro argumento es un error: un argumento mal
 * escrito no puede ampliar en silencio lo que se expone (antes `--perfil=verificacion` se ignoraba y arrancaba el perfil
 * completo).
 */

const CON_VALOR = new Set(['cwd', 'perfil']);

/**
 * @param {string[]} argv  argumentos tras `mcp`
 * @returns {{ ok: true, cwd?: string, perfil?: string } | { ok: false, error: string }}
 */
export function leerArgumentosMcp(argv) {
  /** @type {{ cwd?: string, perfil?: string }} */
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) return { ok: false, error: `Argumento inesperado: "${a}". Uso: fragua mcp [--cwd <carpeta>] [--perfil <nombre>]` };
    const eq = a.indexOf('=');
    const nombre = a.slice(2, eq === -1 ? undefined : eq);
    if (!CON_VALOR.has(nombre)) return { ok: false, error: `Opción desconocida: --${nombre}. Uso: fragua mcp [--cwd <carpeta>] [--perfil <nombre>]` };
    const valor = eq === -1 ? argv[++i] : a.slice(eq + 1);
    if (valor === undefined || valor === '' || valor.startsWith('--')) return { ok: false, error: `La opción --${nombre} necesita un valor.` };
    if (o[/** @type {'cwd'|'perfil'} */ (nombre)] !== undefined) return { ok: false, error: `La opción --${nombre} se repite.` };
    o[/** @type {'cwd'|'perfil'} */ (nombre)] = valor;
  }
  return { ok: true, ...o };
}
