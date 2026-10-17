/**
 * perfiles.js — Qué herramientas expone `forge mcp` (spec 2026-10-14-ciclo-por-mcp, HU-002)
 *
 * Un perfil es una LISTA CERRADA de nombres escrita en el código. Lo que no está en la lista no existe
 * para el cliente: no se lista y, si lo llama, recibe «herramienta desconocida».
 *
 * Quién elige el perfil: el argumento de arranque (`--perfil`) o la variable `FRAGUA_MCP_PERFIL` del
 * entorno del USUARIO. Este módulo no lee ningún archivo del proyecto, así que un repositorio no puede
 * ampliar (ni cambiar) el perfil; lo que el proyecto pueda "reducir" queda fuera de esta entrega.
 * Un perfil desconocido no arranca el servidor (falla cerrado).
 */

import { leerVariableRestrictiva } from '../entorno.js';

/** Perfil por defecto: el contrato de siempre de `forge mcp` (un agente de dentro del proyecto). */
export const PERFIL_POR_DEFECTO = 'completo';

/** @type {Readonly<Record<string, readonly string[]>>} */
export const PERFILES = Object.freeze({
  completo: Object.freeze(['ejecutar_pruebas', 'leer_archivo', 'escribir_archivo']),
  // Delegación por otra herramienta: solo verificar. Sin lectura, sin escritura, sin gasto.
  verificacion: Object.freeze(['verificar']),
});

/**
 * @param {{ argumento?: string|null, env?: Record<string, string|undefined> }} [o]
 * @returns {{ ok: true, perfil: string, herramientas: readonly string[] } | { ok: false, error: string }}
 */
export function resolverPerfil(o = {}) {
  const env = o.env ?? process.env;
  // El argumento de arranque manda; si no hay, la variable del usuario; un conflicto entre FRAGUA_ y FORGE_ no elige
  const delEntorno = leerVariableRestrictiva('MCP_PERFIL', env, '\u0000conflicto');
  const pedido = o.argumento !== undefined && o.argumento !== null ? o.argumento : delEntorno;
  // Solo «no se pidió nada» vale el perfil por defecto; un valor vacío o raro NO se interpreta como "el de siempre"
  const nombre = pedido === undefined ? PERFIL_POR_DEFECTO : pedido;
  if (typeof nombre !== 'string' || !Object.hasOwn(PERFILES, nombre)) {
    return { ok: false, error: `Perfil MCP no válido: ${JSON.stringify(nombre)}. Los que existen: ${Object.keys(PERFILES).join(', ')}. El servidor no arranca con un perfil que no conoce.` };
  }
  return { ok: true, perfil: nombre, herramientas: PERFILES[nombre] };
}

/**
 * Deja solo las herramientas del perfil y comprueba que sean EXACTAMENTE las de la lista (ni una más
 * ni una menos): una herramienta añadida por descuido a un perfil estrecho rompe el arranque.
 * @template {{ name: string }} T
 * @param {T[]} herramientas
 * @param {string} perfil
 * @returns {T[]}
 */
export function aplicarPerfil(herramientas, perfil) {
  const lista = PERFILES[perfil];
  if (!lista) throw new Error(`Perfil MCP desconocido: ${perfil}`);
  const dentro = herramientas.filter((h) => lista.includes(h.name));
  const nombres = dentro.map((h) => h.name).sort().join(',');
  if (nombres !== [...lista].sort().join(',')) {
    throw new Error(`El perfil "${perfil}" exige exactamente [${lista.join(', ')}] y se construyó [${nombres}].`);
  }
  return dentro;
}
