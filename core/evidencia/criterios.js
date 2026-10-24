// @ts-check
/**
 * criterios.js — Matriz criterio de aceptación → pruebas (spec 2026-10-14-puertas-de-calidad-y-evidencia, HU-003).
 *
 * Solo lee archivos y compara texto: no llama a ningún modelo ni ejecuta nada (CA-003-03).
 * Un criterio «tiene prueba» cuando algún archivo de prueba de una tarea que lo cubre contiene su identificador.
 * Eso NO demuestra que la prueba compruebe el criterio, solo que alguien la enlazó (CA-003-05): la calidad
 * de la prueba la mide la mutación.
 */

import * as fs from 'fs';
import * as path from 'path';

/** Expresión fija de los identificadores de criterio (CA-003-01). */
const RE_CA = /\bCA-\d{3}-\d{2}\b/g;
/** Mismo patrón, anclado, para validar un identificador suelto. */
export const RE_CA_EXACTO = /^CA-\d{3}-\d{2}$/;

const TOPE_ARCHIVOS = 2000;
const TOPE_BYTES = 1024 * 1024;
const OMITIR = new Set(['node_modules', '.git', '.sdd', 'dist', 'build', 'coverage', '.venv', '__pycache__']);
const ES_PRUEBA = /(?:^|[\\/])(?:tests?|__tests__)[\\/]|\.(?:test|spec)\.[cm]?[jt]sx?$|(?:^|[\\/])test_[^\\/]*\.py$|_test\.py$/i;

export const LIMITE_DECLARADO = 'Que un archivo de prueba cite el identificador de un criterio no demuestra que la prueba lo compruebe: solo que alguien la enlazó. La calidad de la prueba la mide la mutación.';

/**
 * Identificadores `CA-xxx-yy` de una spec, sin repetidos y en orden de aparición.
 * @param {string} specMd
 * @returns {string[]}
 */
export function extraerCriterios(specMd) {
  return [...new Set(String(specMd).match(RE_CA) ?? [])];
}

/**
 * @typedef {{ id: string, estado: 'con_prueba' | 'sin_prueba' | 'sin_tarea', tareas: string[], archivos: string[] }} FilaCriterio
 * @typedef {{ criterios: FilaCriterio[], conPrueba: string[], sinPrueba: string[], sinTarea: string[], limite: string }} MatrizCriterios
 */

/**
 * @param {object} p
 * @param {string} p.specMd
 * @param {Array<{ id: string, cubre_cas?: string[], archivosDePrueba?: string[] }>} p.tareas
 *   `archivosDePrueba`: archivos de prueba de esa tarea (`estado.pruebas.archivos`); si falta, valen todos los de `archivos`.
 * @param {Array<{ ruta: string, contenido: string }>} p.archivos  archivos de prueba del proyecto
 * @returns {MatrizCriterios}
 */
export function calcularMatriz({ specMd, tareas, archivos }) {
  const porRuta = new Map(archivos.map((a) => [a.ruta, a.contenido]));
  /** @type {FilaCriterio[]} */
  const criterios = extraerCriterios(specMd).map((id) => {
    const cubren = tareas.filter((t) => (t.cubre_cas ?? []).includes(id));
    if (cubren.length === 0) return { id, estado: /** @type {const} */ ('sin_tarea'), tareas: [], archivos: [] };
    const citan = new Set();
    for (const t of cubren) {
      const rutas = t.archivosDePrueba ?? archivos.map((a) => a.ruta);
      for (const r of rutas) if (new RegExp(`\\b${id}\\b`).test(porRuta.get(r) ?? '')) citan.add(r);
    }
    return { id, estado: citan.size > 0 ? /** @type {const} */ ('con_prueba') : /** @type {const} */ ('sin_prueba'), tareas: cubren.map((t) => t.id), archivos: [...citan].sort() };
  });
  const de = (/** @type {FilaCriterio['estado']} */ e) => criterios.filter((c) => c.estado === e).map((c) => c.id);
  return { criterios, conPrueba: de('con_prueba'), sinPrueba: de('sin_prueba'), sinTarea: de('sin_tarea'), limite: LIMITE_DECLARADO };
}

/**
 * Archivos de prueba del proyecto, acotados en número y tamaño. No sigue enlaces simbólicos.
 * @param {string} cwd
 * @returns {Array<{ ruta: string, contenido: string }>}
 */
export function leerArchivosDePrueba(cwd) {
  /** @type {Array<{ ruta: string, contenido: string }>} */
  const salida = [];
  /** @param {string} dir */
  const recorrer = (dir) => {
    if (salida.length >= TOPE_ARCHIVOS) return;
    let entradas;
    try { entradas = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entradas) {
      if (salida.length >= TOPE_ARCHIVOS) return;
      if (e.isSymbolicLink()) continue;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) { if (!OMITIR.has(e.name)) recorrer(abs); continue; }
      const rel = path.relative(cwd, abs).split(path.sep).join('/');
      if (!e.isFile() || !ES_PRUEBA.test(rel)) continue;
      try {
        if (fs.statSync(abs).size > TOPE_BYTES) continue;
        salida.push({ ruta: rel, contenido: fs.readFileSync(abs, 'utf8') });
      } catch { /* ilegible: se ignora */ }
    }
  };
  recorrer(cwd);
  return salida;
}

/**
 * Matriz de la especificación activa de un proyecto, leyendo `.sdd/`. Incluye también las tareas ya cerradas.
 * @param {string} cwd
 * @returns {{ ok: true, spec: string, matriz: MatrizCriterios } | { ok: false, motivo: string }}
 */
export function matrizDelProyecto(cwd) {
  const leerJson = (/** @type {string} */ r) => { try { return JSON.parse(fs.readFileSync(r, 'utf8')); } catch { return null; } };
  const estado = leerJson(path.join(cwd, '.sdd', 'estado.json'));
  const spec = estado?.spec_activa ?? estado?.especificacion_activa ?? null;
  if (!spec || typeof spec !== 'string' || /[\\/]|^\.\.?$/.test(spec)) return { ok: false, motivo: 'No hay una especificación activa en .sdd/estado.json.' };
  const dir = path.join(cwd, '.sdd', 'especificaciones', spec);
  let specMd;
  try { specMd = fs.readFileSync(path.join(dir, 'spec.md'), 'utf8'); } catch { return { ok: false, motivo: `No se pudo leer .sdd/especificaciones/${spec}/spec.md.` }; }
  const crudo = leerJson(path.join(dir, '.estado-tareas.json'));
  const mapa = crudo?.tareas;
  const tareas = Array.isArray(mapa)
    ? mapa.map((/** @type {any} */ t) => ({ id: String(t.id), cubre_cas: Array.isArray(t.cubre_cas) ? t.cubre_cas : [] }))
    : Object.entries(mapa && typeof mapa === 'object' ? mapa : {}).map(([id, t]) => ({ id, cubre_cas: Array.isArray(/** @type {any} */ (t)?.cubre_cas) ? /** @type {any} */ (t).cubre_cas : [] }));
  return { ok: true, spec, matriz: calcularMatriz({ specMd, tareas, archivos: leerArchivosDePrueba(cwd) }) };
}

/**
 * @param {string} spec
 * @param {MatrizCriterios} m
 */
export function textoMatriz(spec, m) {
  const total = m.criterios.length;
  const l = [`Criterios de aceptación de ${spec}: ${m.conPrueba.length} con prueba citada, ${m.sinPrueba.length} sin prueba, ${m.sinTarea.length} sin tarea (de ${total}).`];
  for (const id of m.sinTarea) l.push(`  ✗ ${id}: sin tarea que lo cubra`);
  for (const id of m.sinPrueba) l.push(`  ✗ ${id}: ninguna prueba de sus tareas cita el identificador`);
  l.push(`Límite: ${m.limite}`);
  return l.join('\n');
}
