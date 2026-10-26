// @ts-check
/**
 * criterios.js — Matriz criterio de aceptación → pruebas (spec 2026-10-14-puertas-de-calidad-y-evidencia, HU-003).
 *
 * Solo lee archivos y compara texto: no llama a ningún modelo ni ejecuta nada (CA-003-03).
 * Un criterio «tiene prueba» cuando algún archivo de prueba cita su identificador. Fuera del ciclo no se sabe qué
 * pruebas escribió cada tarea, así que a nivel de proyecto cuenta CUALQUIER archivo de prueba del proyecto; el alcance
 * por tarea (`archivosDePrueba`) solo se aplica cuando la tarea declara `pruebas: [...]` en su estado de tareas. Y citar el identificador NO demuestra que la
 * prueba compruebe el criterio, solo que alguien la enlazó (CA-003-05): la calidad de la prueba la mide la mutación.
 */

import * as fs from 'fs';
import * as path from 'path';

/** Expresión fija de los identificadores de criterio (CA-003-01). */
const RE_CA = /\bCA-\d{3}-\d{2}\b/g;
/** Mismo patrón, anclado, para validar un identificador suelto. */
export const RE_CA_EXACTO = /^CA-\d{3}-\d{2}$/;
/** Un identificador completo dentro de un texto: sin letras, cifras ni guion pegados. */
const RE_CITA = /(?<![0-9A-Za-z-])CA-\d{3}-\d{2}(?![0-9A-Za-z-])/g;

export const TOPES = Object.freeze({
  archivosDePrueba: 2000,
  entradasVisitadas: 50_000,
  bytesPorArchivo: 1024 * 1024,
  bytesSpec: 1024 * 1024,
});
const OMITIR = new Set([
  'node_modules', '.git', '.sdd', 'dist', 'build', 'coverage', '.venv', 'venv', '__pycache__', 'vendor', 'target',
  '.next', '.tox', '.mypy_cache', '.pytest_cache', '.gradle', '.idea', 'out', 'site-packages',
]);
const ES_PRUEBA = /(?:^|[\\/])(?:tests?|__tests__)[\\/]|\.(?:test|spec)\.[cm]?[jt]sx?$|(?:^|[\\/])test_[^\\/]*\.py$|_test\.py$/i;

export const LIMITE_DECLARADO = 'Que un archivo de prueba cite el identificador de un criterio no demuestra que la prueba lo compruebe: solo que alguien la enlazó. A nivel de proyecto cuenta cualquier archivo de prueba, salvo que la tarea declare sus `pruebas`. La calidad de la prueba la mide la mutación.';

/**
 * Identificadores `CA-xxx-yy` de una spec, sin repetidos y en orden de aparición.
 * @param {string} specMd
 * @returns {string[]}
 */
export function extraerCriterios(specMd) {
  return [...new Set(String(specMd).match(RE_CA) ?? [])];
}

/**
 * Identificadores completos que cita un texto de prueba.
 * @param {string} texto
 * @returns {Set<string>}
 */
export function idsCitados(texto) {
  return new Set(String(texto).match(RE_CITA) ?? []);
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
 * @param {Array<{ ruta: string, contenido?: string, ids?: Set<string> }>} p.archivos  archivos de prueba del proyecto
 *   (con `ids` ya calculados, o con `contenido` para calcularlos aquí)
 * @returns {MatrizCriterios}
 */
export function calcularMatriz({ specMd, tareas, archivos }) {
  const citas = new Map(archivos.map((a) => [a.ruta, a.ids ?? idsCitados(a.contenido ?? '')]));
  /** @type {FilaCriterio[]} */
  const criterios = extraerCriterios(specMd).map((id) => {
    const cubren = tareas.filter((t) => (t.cubre_cas ?? []).includes(id));
    if (cubren.length === 0) return { id, estado: /** @type {const} */ ('sin_tarea'), tareas: [], archivos: [] };
    const citan = new Set();
    for (const t of cubren) {
      const rutas = t.archivosDePrueba ?? archivos.map((a) => a.ruta);
      for (const r of rutas) if (citas.get(r)?.has(id)) citan.add(r);
    }
    return { id, estado: citan.size > 0 ? /** @type {const} */ ('con_prueba') : /** @type {const} */ ('sin_prueba'), tareas: cubren.map((t) => t.id), archivos: [...citan].sort() };
  });
  const de = (/** @type {FilaCriterio['estado']} */ e) => criterios.filter((c) => c.estado === e).map((c) => c.id);
  return { criterios, conPrueba: de('con_prueba'), sinPrueba: de('sin_prueba'), sinTarea: de('sin_tarea'), limite: LIMITE_DECLARADO };
}

/**
 * Archivos de prueba del proyecto y los identificadores que citan. Acotado en archivos aceptados, entradas
 * visitadas y tamaño; no retiene el contenido (solo los ids) y no sigue enlaces ni junctions.
 * @param {string} cwd
 * @param {{ maxEntradas?: number, maxArchivos?: number, maxBytes?: number }} [limites]
 * @returns {Array<{ ruta: string, ids: Set<string> }>}
 */
export function leerArchivosDePrueba(cwd, limites = {}) {
  const maxEntradas = limites.maxEntradas ?? TOPES.entradasVisitadas;
  const maxArchivos = limites.maxArchivos ?? TOPES.archivosDePrueba;
  const maxBytes = limites.maxBytes ?? TOPES.bytesPorArchivo;
  /** @type {Array<{ ruta: string, ids: Set<string> }>} */
  const salida = [];
  let visitadas = 0;
  /** @param {string} dir */
  const recorrer = (dir) => {
    if (salida.length >= maxArchivos || visitadas >= maxEntradas) return;
    let entradas;
    try { entradas = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entradas) {
      if (salida.length >= maxArchivos || ++visitadas > maxEntradas) return;
      if (e.isSymbolicLink()) continue;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) { if (!OMITIR.has(e.name)) recorrer(abs); continue; }
      const rel = path.relative(cwd, abs).split(path.sep).join('/');
      if (!e.isFile() || !ES_PRUEBA.test(rel)) continue;
      try {
        if (fs.statSync(abs).size > maxBytes) continue;
        salida.push({ ruta: rel, ids: idsCitados(fs.readFileSync(abs, 'utf8')) });
      } catch { /* ilegible: se ignora */ }
    }
  };
  recorrer(cwd);
  return salida;
}

/**
 * Lee un archivo de texto de `.sdd/` sin seguir enlaces, solo si es un archivo normal y no pasa del tope.
 * @param {string} ruta
 * @returns {string|null}
 */
function leerTextoSdd(ruta) {
  try {
    const st = fs.lstatSync(ruta);
    if (!st.isFile() || st.size > TOPES.bytesSpec) return null;
    return fs.readFileSync(ruta, 'utf8');
  } catch { return null; }
}

/** @param {string} ruta */
function leerJsonSdd(ruta) {
  const t = leerTextoSdd(ruta);
  if (t === null) return null;
  try { return JSON.parse(t); } catch { return null; }
}

/**
 * Tareas con sus `cubre_cas` de un JSON de estado de tareas: el formato del engine (lista) o el de /sdd.tareas (mapa).
 * Una tarea puede declarar además `pruebas`: sus archivos de prueba (rutas relativas); si lo hace, solo esos cuentan para
 * sus criterios. Incluye también las ya cerradas. Ignora lo que no tenga la forma esperada.
 * @param {any} crudo
 * @returns {Array<{ id: string, cubre_cas: string[], pruebas?: string[] }>}
 */
function tareasDe(crudo) {
  const t = crudo?.tareas;
  /** @type {Array<[string, any]>} */
  const pares = Array.isArray(t) ? t.map((x) => [String(x?.id), x]) : Object.entries(t && typeof t === 'object' ? t : {});
  return pares
    .filter(([id, x]) => id !== 'undefined' && x && typeof x === 'object')
    .map(([id, x]) => ({
      id,
      cubre_cas: (Array.isArray(x.cubre_cas) ? x.cubre_cas : Array.isArray(x.cas) ? x.cas : []).filter((c) => typeof c === 'string'),
      ...(Array.isArray(x.pruebas) ? { pruebas: x.pruebas.filter((r) => typeof r === 'string' && r.length > 0 && r.length <= 512).map((r) => r.split('\\').join('/')) } : {}),
    }));
}

/**
 * Matriz de la especificación activa de un proyecto, leyendo `.sdd/`. Lee las dos fuentes de tareas que usa el ciclo
 * (`.sdd/estado-tareas.json` y el de la especificación) y las junta. Nunca lanza.
 * @param {string} cwd
 * @returns {{ ok: true, spec: string, matriz: MatrizCriterios } | { ok: false, motivo: string }}
 */
export function matrizDelProyecto(cwd) {
  try {
    const estado = leerJsonSdd(path.join(cwd, '.sdd', 'estado.json'));
    const spec = estado?.spec_activa ?? estado?.especificacion_activa ?? null;
    if (!spec || typeof spec !== 'string' || /[\\/\0]|^\.\.?$/.test(spec)) return { ok: false, motivo: 'No hay una especificación activa en .sdd/estado.json.' };
    const dir = path.join(cwd, '.sdd', 'especificaciones', spec);
    const specMd = leerTextoSdd(path.join(dir, 'spec.md'));
    if (specMd === null) return { ok: false, motivo: `No se pudo leer .sdd/especificaciones/${spec}/spec.md.` };
    /** @type {Map<string, { cas: Set<string>, pruebas?: Set<string> }>} */
    const porTarea = new Map();
    for (const origen of [leerJsonSdd(path.join(cwd, '.sdd', 'estado-tareas.json')), leerJsonSdd(path.join(dir, '.estado-tareas.json'))]) {
      for (const t of tareasDe(origen)) {
        const previa = porTarea.get(t.id);
        const pruebas = t.pruebas || previa?.pruebas ? new Set([...(previa?.pruebas ?? []), ...(t.pruebas ?? [])]) : undefined;
        porTarea.set(t.id, { cas: new Set([...(previa?.cas ?? []), ...t.cubre_cas]), ...(pruebas ? { pruebas } : {}) });
      }
    }
    const tareas = [...porTarea].map(([id, v]) => ({ id, cubre_cas: [...v.cas], ...(v.pruebas ? { archivosDePrueba: [...v.pruebas] } : {}) }));
    return { ok: true, spec, matriz: calcularMatriz({ specMd, tareas, archivos: leerArchivosDePrueba(cwd) }) };
  } catch (e) {
    return { ok: false, motivo: `No se pudo calcular la matriz: ${e instanceof Error ? e.message.slice(0, 200) : 'error desconocido'}.` };
  }
}

/**
 * @param {string} spec
 * @param {MatrizCriterios} m
 */
export function textoMatriz(spec, m) {
  const total = m.criterios.length;
  if (total === 0) return `La especificación ${spec} no tiene criterios con la forma CA-xxx-yy (tres cifras, guion, dos cifras): no hay nada que cruzar.\nLímite: ${m.limite}`;
  const l = [`Criterios de aceptación de ${spec}: ${m.conPrueba.length} con prueba citada, ${m.sinPrueba.length} sin prueba, ${m.sinTarea.length} sin tarea (de ${total}).`];
  for (const id of m.sinTarea) l.push(`  ✗ ${id}: sin tarea que lo cubra`);
  for (const id of m.sinPrueba) l.push(`  ✗ ${id}: ninguna prueba del proyecto cita el identificador`);
  l.push(`Límite: ${m.limite}`);
  return l.join('\n');
}
