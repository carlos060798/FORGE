/**
 * propio.js — Motor del ciclo sin dependencias (ADR-01)
 *
 * Ejecuta el grafo nodo a nodo y guarda un punto tras cada uno. Si el proceso
 * se corta, al reanudar solo se repite el nodo que estaba en curso. Se detiene
 * ante una revisión humana hasta recibir una decisión.
 */

import { aplicar } from '../estado.js';
import { REVISION, transicion } from '../grafo.js';
import { NODOS } from '../nodos.js';

/**
 * @param {{
 *   estado: import('../estado.js').EstadoCiclo,
 *   desde: string|null,
 *   deps: any,
 *   guardador: import('../checkpoint-archivos.js').GuardadorArchivos,
 *   decision?: { decision: string, iteracionesExtra?: number, presupuestoExtra?: number },
 *   nodos?: Record<string, Function>,
 * }} entrada
 * @returns {Promise<import('../estado.js').EstadoCiclo>}
 */
export async function ejecutarGrafo(entrada) {
  const { deps, guardador } = entrada;
  const nodos  = entrada.nodos ?? NODOS;
  let estado   = entrada.estado;
  let nodo     = entrada.desde;
  let decision = entrada.decision;

  // Una decisión guardada para "la próxima revisión" se aplicaría a una que aún no ha ocurrido
  if (decision && nodo !== REVISION) {
    throw new Error('Hay una decisión pero la tarea no está esperándola: no se aplica.');
  }

  while (nodo) {
    if (nodo === REVISION && !decision) {
      // Sin decisión no se hace nada más: ni llamadas ni ejecuciones (CA-005-03)
      deps.log.append('task_paused', { motivo: estado.revision?.motivo, detalle: estado.revision?.detalle }, { taskId: estado.taskId });
      return estado;
    }

    const t0 = Date.now();
    const parcial = await nodos[nodo](estado, deps, nodo === REVISION ? decision : undefined);
    if (nodo === REVISION) decision = undefined;   // una decisión vale para una sola revisión
    estado = aplicar(estado, parcial);

    const t = transicion(nodo, estado);
    estado  = aplicar(estado, t.parcial);

    guardador.guardar(estado.threadId, { nodo, siguiente: t.siguiente, estado });
    deps.log.append('ciclo:nodo_completado', { nodo, siguiente: t.siguiente, iteracion: estado.iteracion, durationMs: Date.now() - t0 }, { taskId: estado.taskId });
    nodo = t.siguiente;
  }
  return estado;
}
