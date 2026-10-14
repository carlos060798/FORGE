// @ts-check
/**
 * perfiles.js — Perfiles de instalación: qué comandos recibe una instalación.
 *
 * `esencial`: el camino principal (idea, especificación, plan, tareas, implementación, estado), 6 comandos.
 * `completo`: todos los comandos de `commands/`.
 *
 * El valor por defecto SIGUE siendo `completo`: pasar el de las instalaciones nuevas a `esencial` es
 * una decisión del dueño (spec, pregunta abierta 1) y es cambiar la constante de abajo.
 */

/** @type {Readonly<Record<string, { descripcion: string, comandos: readonly string[]|null }>>} */
export const PERFILES = Object.freeze({
  esencial: {
    descripcion: 'El camino principal: idea, especificación, plan, tareas, implementación y estado',
    comandos: Object.freeze(['forge', 'sdd.especificar', 'sdd.planificar', 'sdd.tareas', 'sdd.implementar', 'sdd.estado']),
  },
  completo: { descripcion: 'Todos los comandos', comandos: null },
});

export const PERFIL_POR_DEFECTO = 'completo';

export const NOMBRES_PERFIL = Object.freeze(Object.keys(PERFILES));

/**
 * @param {unknown} perfil
 * @returns {{ ok: true, perfil: string } | { ok: false, error: string }}
 */
export function resolverPerfil(perfil) {
  if (typeof perfil === 'string' && Object.hasOwn(PERFILES, perfil)) return { ok: true, perfil };
  return { ok: false, error: `Perfil desconocido: ${JSON.stringify(perfil)}. Los válidos son: ${NOMBRES_PERFIL.join(', ')}.` };
}

/**
 * ¿El comando (nombre de archivo sin `.md`, p. ej. `sdd.planificar`) entra en el perfil?
 * @param {string} perfil
 * @param {string} comando
 */
export function incluyeComando(perfil, comando) {
  const lista = PERFILES[perfil]?.comandos ?? null;
  return lista === null || lista.includes(comando);
}
