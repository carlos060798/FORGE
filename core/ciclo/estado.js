/**
 * estado.js — Esquema, valores por defecto y validación del estado del ciclo verificado
 */

export const SCHEMA_VERSION = '1.0';

export const CATEGORIAS    = ['pass', 'fail', 'timeout', 'infra_error'];
export const MOTIVOS       = ['iteraciones', 'presupuesto', 'infraestructura', 'dependencias', 'salida_invalida', 'exito_sospechoso', 'sin_progreso'];
export const RESULTADOS    = ['en_curso', 'exito', 'revision_pendiente', 'aceptada_por_humano', 'abortada'];
export const ESTADOS_GASTO = ['ok', 'degradado', 'agotado'];

/**
 * @typedef {Object} Ejecucion
 * @property {number} iteracion
 * @property {'pass'|'fail'|'timeout'|'infra_error'} categoria
 * @property {number|null} exitCode
 * @property {boolean} timedOut
 * @property {boolean} oomKilled
 * @property {number} durationMs
 * @property {string[]} [sospecha]  motivos por los que un `pass` no se da por bueno (core/ciclo/sospecha.js)
 * @property {string} [huellaSalida]  sha256 de la salida normalizada (core/ciclo/huella.js); vacía si no hubo salida
 * @property {string} stdoutCola
 * @property {string} stderrCola
 */

/**
 * @typedef {Object} Presupuesto
 * @property {number} tope_usd
 * @property {number} umbral_degradacion_usd
 * @property {number} gastado_usd
 * @property {'ok'|'degradado'|'agotado'} estado
 * @property {number} llamadas
 * @property {number} tokens_in
 * @property {number} tokens_out
 */

/**
 * @typedef {Object} EstadoCiclo
 * @property {string} schemaVersion
 * @property {string} runId
 * @property {string} threadId
 * @property {string} taskId
 * @property {string} cwd
 * @property {{id: string, descripcion: string, agente: string, archivos: string[], cas: string[], criterioCmd?: string}} tarea
 * @property {{pasos: string[], archivosObjetivo: string[]}|null} plan
 * @property {{fragmentos: {ruta: string, origen: string, bytes: number}[], bytesTotales: number, truncado: boolean}} contexto
 * @property {{archivos: {ruta: string, sha256: string}[], comando: string}} pruebas
 * @property {{archivos: {ruta: string, sha256: string}[]}} implementacion
 * @property {Ejecucion[]} ejecuciones
 * @property {number} iteracion
 * @property {number} maxIteraciones
 * @property {Presupuesto} presupuesto
 * @property {{motivo: string, reanudarEn: string, detalle?: string, decision?: string, ts?: string}|null} revision
 * @property {'en_curso'|'exito'|'revision_pendiente'|'aceptada_por_humano'|'abortada'} resultado
 * @property {'bloque'|'turnos'} [implementador]  modo con el que el implementador trabaja en este hilo (ADR-21); lo fija su primer intento
 * @property {number} [turnos]  turnos del implementador respondidos en esta tarea (solo en modo turnos)
 */

/**
 * @param {{id: string, prompt?: string, descripcion?: string, agente: string, archivos?: string[], cubre_cas?: string[], cas?: string[], criterioCmd?: string}} tarea
 * @param {{runId: string, cwd: string, maxIteraciones?: number, tope_usd?: number, umbral_degradacion_usd?: number}} opciones
 * @returns {EstadoCiclo}
 */
export function estadoInicial(tarea, opciones) {
  return {
    schemaVersion: SCHEMA_VERSION,
    runId:    opciones.runId,
    threadId: `${opciones.runId}:${tarea.id}`,
    taskId:   tarea.id,
    cwd:      opciones.cwd,
    tarea: {
      id:          tarea.id,
      descripcion: tarea.descripcion ?? tarea.prompt ?? '',
      agente:      tarea.agente,
      archivos:    tarea.archivos ?? [],
      cas:         tarea.cas ?? tarea.cubre_cas ?? [],
      ...(tarea.criterioCmd ? { criterioCmd: tarea.criterioCmd } : {}),
    },
    plan: null,
    contexto: { fragmentos: [], bytesTotales: 0, truncado: false },
    pruebas: { archivos: [], comando: '' },
    implementacion: { archivos: [] },
    ejecuciones: [],
    iteracion: 0,
    maxIteraciones: opciones.maxIteraciones ?? 5,
    presupuesto: {
      tope_usd:               opciones.tope_usd ?? 2.0,
      umbral_degradacion_usd: opciones.umbral_degradacion_usd ?? 1.5,
      gastado_usd: 0,
      estado: 'ok',
      llamadas: 0,
      tokens_in: 0,
      tokens_out: 0,
    },
    revision: null,
    resultado: 'en_curso',
  };
}

/**
 * Aplica la actualización parcial que devuelve un nodo.
 * `ejecuciones` se acumula; el resto de campos se reemplaza.
 * @param {EstadoCiclo} estado
 * @param {Partial<EstadoCiclo>} parcial
 * @returns {EstadoCiclo}
 */
export function aplicar(estado, parcial) {
  const siguiente = { ...estado, ...parcial };
  if (parcial.ejecuciones) {
    siguiente.ejecuciones = estado.ejecuciones.concat(parcial.ejecuciones);
  }
  return siguiente;
}

/**
 * @param {unknown} estado
 * @returns {string[]} errores; vacío si el estado es válido
 */
export function validarEstado(estado) {
  const errores = [];
  const e = /** @type {any} */ (estado);
  if (!e || typeof e !== 'object') return ['el estado no es un objeto'];

  if (e.schemaVersion !== SCHEMA_VERSION) errores.push(`schemaVersion desconocida: ${e.schemaVersion}`);
  for (const campo of ['runId', 'threadId', 'taskId', 'cwd']) {
    if (typeof e[campo] !== 'string' || e[campo] === '') errores.push(`${campo} debe ser un texto no vacío`);
  }
  if (!e.tarea || typeof e.tarea.id !== 'string') errores.push('tarea.id ausente');
  if (!Array.isArray(e.ejecuciones)) errores.push('ejecuciones debe ser una lista');
  else for (const ej of e.ejecuciones) {
    if (!CATEGORIAS.includes(ej?.categoria)) errores.push(`categoría de ejecución desconocida: ${ej?.categoria}`);
    // Opcional: los puntos de guardado anteriores a la detección de «sin progreso» no la llevan
    if (ej?.huellaSalida !== undefined && typeof ej.huellaSalida !== 'string') errores.push('huellaSalida de una ejecución debe ser un texto');
  }
  if (!Number.isInteger(e.iteracion) || e.iteracion < 0) errores.push('iteracion debe ser un entero ≥ 0');
  if (!Number.isInteger(e.maxIteraciones) || e.maxIteraciones < 1) errores.push('maxIteraciones debe ser un entero ≥ 1');
  if (!RESULTADOS.includes(e.resultado)) errores.push(`resultado desconocido: ${e.resultado}`);
  if (e.revision !== null && !MOTIVOS.includes(e.revision?.motivo)) errores.push(`motivo de revisión desconocido: ${e.revision?.motivo}`);

  const p = e.presupuesto;
  if (!p || typeof p !== 'object') errores.push('presupuesto ausente');
  else {
    if (!ESTADOS_GASTO.includes(p.estado)) errores.push(`estado de presupuesto desconocido: ${p.estado}`);
    for (const campo of ['tope_usd', 'umbral_degradacion_usd', 'gastado_usd']) {
      if (typeof p[campo] !== 'number' || p[campo] < 0) errores.push(`presupuesto.${campo} debe ser un número ≥ 0`);
    }
    if (p.umbral_degradacion_usd > p.tope_usd) errores.push('el umbral de degradación supera el tope');
  }
  return errores;
}
