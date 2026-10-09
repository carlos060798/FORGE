/**
 * tareas.js — Carga de tareas para el engine desde los dos formatos existentes
 *
 *   .sdd/estado-tareas.json
 *     { tareas: [ { id, agente, prompt, dependencias } ] }      (formato del engine)
 *
 *   .sdd/especificaciones/{ID}/.estado-tareas.json
 *     { tareas: { T001: { estado, agente, depende_de, cubre_cas } } }
 *     (formato que genera /sdd.tareas; el enunciado vive en tareas.md)
 */

import * as fs from 'fs';
import * as path from 'path';

const ESTADOS_CERRADOS = new Set(['completada', 'omitida']);

/**
 * Los comandos SDD escriben `especificacion_activa`; el engine escribía `spec_activa`.
 * @param {object} estado
 * @returns {string|null}
 */
export function specActiva(estado) {
  return estado?.spec_activa ?? estado?.especificacion_activa ?? null;
}

/**
 * Extrae el texto de cada sección `## T001 — Nombre` de un tareas.md.
 * @param {string} md
 * @returns {Map<string, string>}
 */
export function seccionesDeTareas(md) {
  const secciones = new Map();
  const partes = md.split(/^(?=## T\d+\b)/m);
  for (const parte of partes) {
    const m = parte.match(/^## (T\d+)\b/);
    if (!m) continue;
    // Una sección de tarea termina en el siguiente encabezado de nivel 2
    const fin = parte.slice(3).search(/^## /m);
    secciones.set(m[1], (fin === -1 ? parte : parte.slice(0, fin + 3)).trim());
  }
  return secciones;
}

/**
 * @param {object} raw            contenido del JSON de estado de tareas
 * @param {string} [tareasMd]     contenido de tareas.md, si existe
 * @returns {object[]}            tareas en el formato del engine
 */
export function normalizarTareas(raw, tareasMd = '') {
  const tareas = raw?.tareas;
  if (Array.isArray(tareas)) return tareas;
  if (!tareas || typeof tareas !== 'object') return [];

  const secciones = seccionesDeTareas(tareasMd);
  return Object.entries(tareas)
    .filter(([, t]) => !ESTADOS_CERRADOS.has(t?.estado))
    .map(([id, t]) => ({
      id,
      agente:       t.agente,
      modelo:       t.modelo,
      prompt:       secciones.get(id) ?? `Tarea ${id}`,
      dependencias: t.depende_de ?? t.dependencias ?? [],
      cubre_cas:    t.cubre_cas ?? [],
      // Exención del rojo obligatorio (ADR-20): la tarea parte de un comportamiento que ya existe
      ...(t.parte_de_codigo_existente === true ? { parte_de_codigo_existente: true } : {}),
    }));
}

function leerJson(ruta) {
  try { return JSON.parse(fs.readFileSync(ruta, 'utf8')); } catch { return null; }
}

/**
 * @param {string} cwd
 * @param {object} estado  contenido de .sdd/estado.json
 * @returns {{ tareas: object[], origen: string|null }}
 */
export function cargarTareas(cwd, estado) {
  const global = path.join(cwd, '.sdd', 'estado-tareas.json');
  if (fs.existsSync(global)) {
    const tareas = normalizarTareas(leerJson(global));
    if (tareas.length > 0) return { tareas, origen: global };
  }

  const spec = specActiva(estado);
  if (spec) {
    const dir     = path.join(cwd, '.sdd', 'especificaciones', String(spec));
    const porSpec = path.join(dir, '.estado-tareas.json');
    if (fs.existsSync(porSpec)) {
      const mdPath = path.join(dir, 'tareas.md');
      const md     = fs.existsSync(mdPath) ? fs.readFileSync(mdPath, 'utf8') : '';
      const tareas = normalizarTareas(leerJson(porSpec), md);
      if (tareas.length > 0) return { tareas, origen: porSpec };
    }
  }

  return { tareas: [], origen: null };
}
