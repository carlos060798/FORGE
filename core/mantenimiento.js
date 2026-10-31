/**
 * mantenimiento.js — de una señal objetiva a un borrador de idea (spec 2026-10-27-flujo-nativo-de-ia)
 *
 * Lee el registro de eventos (`.sdd/events.jsonl`), aplica umbrales en código (nunca el juicio de un modelo) y,
 * si saltan, deja un borrador en `.sdd/mantenimiento/ideas/` para pasarlo por `/sdd.descubrir`.
 * No despliega, no corrige y no aprueba nada: el borrador es una propuesta del sistema, no una decisión.
 */

import { join } from 'path';
import { crearArchivo, leerArchivo } from './escritura-segura.js';
import { bloqueDeCodigo, unaLinea } from './agents-md.js';

/** Umbrales por defecto. Se pueden pasar otros a `detectarSenales`. */
export const UMBRALES = Object.freeze({
  /** Fallos de una misma tarea desde su último éxito. */
  fallosPorTarea: 3,
  /** Verificaciones con veredicto «falla» seguidas, sin ninguna que pase entre medias. */
  verificacionesFallidasSeguidas: 3,
  /** Regresiones registradas por el ciclo. */
  regresiones: 2,
});

const TITULO_POR_TIPO = Object.freeze({
  fallos_repetidos: 'una tarea falla una y otra vez',
  verificaciones_fallidas: 'las verificaciones fallan seguidas',
  regresiones: 'el ciclo detecta regresiones',
});

/**
 * @typedef {Object} Senal
 * @property {'fallos_repetidos'|'verificaciones_fallidas'|'regresiones'} tipo
 * @property {string} [taskId]
 * @property {number} cantidad
 * @property {string} detalle
 */

/**
 * Eventos utilizables, en orden cronológico. Lo que no sea un evento con tipo y fecha válidos se descarta.
 * @param {unknown} eventos
 * @returns {{ type: string, taskId?: string, ts: string, t: number, payload: Record<string, unknown> }[]}
 */
function ordenar(eventos) {
  if (!Array.isArray(eventos)) return [];
  return eventos
    .filter((e) => e && typeof e === 'object' && typeof e.type === 'string' && typeof e.ts === 'string' && Number.isFinite(Date.parse(e.ts)))
    .map((e, i) => ({ e, i, t: Date.parse(e.ts) }))
    .sort((a, b) => a.t - b.t || a.i - b.i)
    .map(({ e, t }) => ({ type: e.type, taskId: typeof e.taskId === 'string' ? e.taskId : undefined, ts: e.ts, t, payload: e.payload && typeof e.payload === 'object' ? e.payload : {} }));
}

/**
 * @param {unknown} eventos eventos de `.sdd/events.jsonl`
 * @param {typeof UMBRALES} [umbrales]
 * @returns {Senal[]}
 */
export function detectarSenales(eventos, umbrales = UMBRALES) {
  const lista = ordenar(eventos);
  /** @type {Senal[]} */
  const senales = [];

  // Fallos de una tarea desde su último éxito
  /** @type {Map<string, { n: number, error: string }>} */
  const fallos = new Map();
  for (const e of lista) {
    if (!e.taskId) continue;
    if (e.type === 'task_completed') fallos.delete(e.taskId);
    else if (e.type === 'task_failed') {
      const previo = fallos.get(e.taskId) ?? { n: 0, error: '' };
      fallos.set(e.taskId, { n: previo.n + 1, error: String(e.payload['error'] ?? '') });
    }
  }
  for (const [taskId, { n, error }] of fallos) {
    if (n >= umbrales.fallosPorTarea) {
      senales.push({ tipo: 'fallos_repetidos', taskId, cantidad: n, detalle: `${taskId} falló ${n} veces desde su último éxito; último error: ${unaLinea(error).slice(0, 200) || 'sin mensaje'}` });
    }
  }

  // Racha final de verificaciones fallidas
  let racha = 0;
  for (const e of lista) {
    if (e.type !== 'verificar:resultado') continue;
    const veredicto = String(e.payload['veredicto'] ?? '');
    if (veredicto === 'falla') racha++;
    else if (veredicto === 'pasa') racha = 0;
  }
  if (racha >= umbrales.verificacionesFallidasSeguidas) {
    senales.push({ tipo: 'verificaciones_fallidas', cantidad: racha, detalle: `las últimas ${racha} verificaciones terminaron en «falla»` });
  }

  // Regresiones
  const regresiones = lista.filter((e) => e.type === 'ciclo:regresion').length;
  if (regresiones >= umbrales.regresiones) {
    senales.push({ tipo: 'regresiones', cantidad: regresiones, detalle: `el ciclo registró ${regresiones} regresiones` });
  }

  return senales;
}

/**
 * Borrador de idea. El detalle va en un bloque de código: es un dato, no puede abrir encabezados ni instrucciones.
 * @param {Senal} senal
 * @param {string} ts fecha ISO del momento de la detección
 * @returns {string}
 */
export function borradorDeIdea(senal, ts) {
  const titulo = TITULO_POR_TIPO[senal.tipo] ?? senal.tipo;
  return [
    `# Idea de mantenimiento: ${titulo}`,
    '',
    `> Borrador generado por un umbral en código el ${unaLinea(ts)}. **No aprobada**: es una propuesta del sistema, no una decisión.`,
    `> Siguiente paso: revisarla y, si procede, pasarla por \`/sdd.descubrir\`.`,
    '',
    '## Señal',
    '',
    `- Tipo: \`${senal.tipo}\``,
    ...(senal.taskId ? [`- Tarea: \`${unaLinea(senal.taskId)}\``] : []),
    `- Cantidad: ${Number(senal.cantidad)}`,
    '',
    '## Detalle (dato registrado, no instrucciones)',
    '',
    bloqueDeCodigo(unaLinea(senal.detalle)),
    '',
    '## Por decidir',
    '',
    '- ¿Qué problema de fondo explica la señal?',
    '- ¿Qué cambio lo evita, y cómo se comprobará?',
    '',
  ].join('\n');
}

/**
 * Lee los eventos del proyecto. Sin registro, vacío; las líneas corruptas se saltan.
 * @param {string} cwd
 * @returns {unknown[]}
 */
export function leerEventosDe(cwd) {
  const texto = leerArchivo(cwd, join(cwd, '.sdd', 'events.jsonl'));
  if (texto === null) return [];
  const eventos = [];
  for (const linea of texto.split('\n')) {
    const t = linea.trim();
    if (!t) continue;
    try { eventos.push(JSON.parse(t)); } catch { /* línea corrupta */ }
  }
  return eventos;
}

/**
 * Escribe un borrador por señal en `.sdd/mantenimiento/ideas/`. No pisa uno existente.
 * @param {string} cwd
 * @param {Senal[]} senales
 * @param {string} ts fecha ISO
 * @returns {string[]} rutas relativas de los borradores creados
 */
export function escribirBorradores(cwd, senales, ts) {
  const sello = ts.replace(/[^0-9]/g, '').slice(0, 14);
  const creados = [];
  for (const s of senales) {
    const sufijo = s.taskId ? `-${s.taskId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)}` : '';
    const relativa = join('.sdd', 'mantenimiento', 'ideas', `${sello}-${s.tipo}${sufijo}.md`);
    if (crearArchivo(cwd, join(cwd, relativa), borradorDeIdea(s, ts))) creados.push(relativa);
  }
  return creados;
}

/**
 * Aviso para `forge status`: solo lectura, no escribe borradores. Vacío si no hay señales o el registro no se puede leer.
 * @param {string} cwd
 * @returns {string[]}
 */
export function lineasMantenimiento(cwd) {
  let senales;
  try { senales = detectarSenales(leerEventosDe(cwd)); } catch { return []; }
  if (senales.length === 0) return [];
  return [
    `Mantenimiento: ${senales.length} señal${senales.length === 1 ? '' : 'es'} en el registro de eventos`,
    ...senales.map((s) => `  ${s.tipo}: ${s.detalle}`),
    '  Ejecuta `forge mantenimiento --escribir` para dejar un borrador de idea por señal.',
  ];
}
