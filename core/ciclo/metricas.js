/**
 * metricas.js — indicadores del flujo (spec 2026-10-27-flujo-nativo-de-ia)
 *
 * Puro: agrega lo que ya registran `CicloVerificado.resumen()`, `.sdd/events.jsonl` y `LibroDeGasto.total()`.
 * «Primer intento» = tarea con resultado `exito` e iteración ≤ 1.
 */

/**
 * @typedef {Object} Metricas
 * @property {number} total tareas conocidas
 * @property {number} terminadas con éxito, aceptadas por una persona o abortadas
 * @property {number} exito
 * @property {number} exitoPrimerIntento
 * @property {number|null} tasaPrimerIntento sobre las terminadas; null si no hay ninguna
 * @property {number} reintentos suma de (iteración − 1)
 * @property {number} enRevision
 * @property {number} enCurso
 * @property {number} abortadas
 * @property {number|null} tiempoMedioMs de task_started a task_completed; null si no hay ninguna tarea medida
 * @property {number} tareasConTiempo
 * @property {{ usd: number, llamadas: number }|null} gasto
 */

/**
 * @param {{ tareas: any[], eventos: any[], gasto: any }} entrada
 * @returns {Metricas}
 */
export function calcularMetricas({ tareas, eventos, gasto }) {
  const lista = Array.isArray(tareas) ? tareas : [];
  const porResultado = (r) => lista.filter((t) => t && t.resultado === r);

  const exitos = porResultado('exito');
  const iteracionDe = (t) => (Number.isFinite(Number(t?.iteracion)) ? Number(t.iteracion) : null);
  const exitoPrimerIntento = exitos.filter((t) => { const i = iteracionDe(t); return i !== null && i <= 1; }).length;
  const aceptadas = porResultado('aceptada_por_humano').length;
  const abortadas = porResultado('abortada').length;
  const terminadas = exitos.length + aceptadas + abortadas;

  const reintentos = lista.reduce((n, t) => n + (t && t.resultado !== 'en_curso' ? Math.max(0, (iteracionDe(t) ?? 0) - 1) : 0), 0);

  // Tiempo por tarea: del último task_started al task_completed siguiente
  /** @type {Map<string, number>} */
  const inicios = new Map();
  /** @type {number[]} */
  const duraciones = [];
  for (const e of Array.isArray(eventos) ? eventos : []) {
    if (!e || typeof e.taskId !== 'string' || !e.taskId) continue;
    const t = Date.parse(e.ts);
    if (!Number.isFinite(t)) continue;
    if (e.type === 'task_started') inicios.set(e.taskId, t);
    else if (e.type === 'task_completed' && inicios.has(e.taskId)) {
      duraciones.push(Math.max(0, t - /** @type {number} */ (inicios.get(e.taskId))));
      inicios.delete(e.taskId);
    }
  }

  return {
    total: lista.length,
    terminadas,
    exito: exitos.length + aceptadas,
    exitoPrimerIntento,
    tasaPrimerIntento: terminadas === 0 ? null : exitoPrimerIntento / terminadas,
    reintentos,
    enRevision: porResultado('revision_pendiente').length,
    enCurso: porResultado('en_curso').length,
    abortadas,
    tiempoMedioMs: duraciones.length === 0 ? null : duraciones.reduce((a, b) => a + b, 0) / duraciones.length,
    tareasConTiempo: duraciones.length,
    gasto: gasto && Number.isFinite(gasto.usd) && gasto.usd >= 0 && Number.isFinite(gasto.llamadas) && gasto.llamadas >= 0 ? { usd: gasto.usd, llamadas: gasto.llamadas } : null,
  };
}

/** @param {number|null} ms */
function textoDuracion(ms) {
  if (ms === null) return 'sin medir';
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

/**
 * Líneas para `forge status`. Vacío si no hay tareas.
 * @param {Metricas} m
 * @returns {string[]}
 */
export function lineasMetricas(m) {
  if (m.total === 0) return [];
  const tasa = m.tasaPrimerIntento === null
    ? 'sin tareas terminadas'
    : `${m.exitoPrimerIntento} de ${m.terminadas} (${Math.round(m.tasaPrimerIntento * 100)} %)`;
  return [
    '  Indicadores del flujo',
    `    éxito al primer intento: ${tasa}`,
    `    reintentos: ${m.reintentos} · en revisión: ${m.enRevision} · abortadas: ${m.abortadas}`,
    `    tiempo medio por tarea: ${textoDuracion(m.tiempoMedioMs)}${m.tareasConTiempo > 0 ? ` (${m.tareasConTiempo} medidas)` : ''}`,
  ];
}
