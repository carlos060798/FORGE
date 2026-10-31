/**
 * shared/protegidos.js — configuración de calidad que un agente no reescribe.
 *
 * En el repo reexporta la fuente única (core/evidencia/protegidos.js). Al instalar los hooks en un proyecto,
 * `cli/index.js` sustituye este archivo por una copia de esa fuente, porque `.claude/hooks/` no tiene `core/`.
 * El módulo original no tiene dependencias, así que la copia funciona sola.
 */
export * from "../../core/evidencia/protegidos.js";
