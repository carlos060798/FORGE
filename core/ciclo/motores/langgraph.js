/**
 * langgraph.js — Motor del ciclo sobre LangGraph.js (ADR-01)
 *
 * LangGraph ejecuta el grafo: los nodos y las aristas condicionales. Los nodos,
 * el router y los puntos de guardado son los mismos que usa el motor propio,
 * así que una tarea empezada con un motor se puede reanudar con el otro.
 *
 * LangGraph.js es una dependencia opcional (su núcleo exige Node ≥20): se
 * carga de forma perezosa y, si no está, se usa el motor propio.
 */

import { aplicar } from '../estado.js';
import { REVISION, transicion } from '../grafo.js';
import { NODOS } from '../nodos.js';

const PAQUETE = '@langchain/langgraph';

/** @type {any} */
let lg = null;

/** Carga LangGraph.js. Lanza si no está instalado o la versión de Node no lo admite. */
export async function cargar() {
  // El nombre va en una constante: es una dependencia opcional y la comprobación de tipos
  // no debe exigir que esté instalada
  if (!lg) {
    // LangGraph envia el estado completo del grafo (prompts, contenido de archivos, salidas de pruebas)
    // a LangSmith si el usuario tiene el trazado activo por otro proyecto: aqui nunca debe salir
    process.env.LANGSMITH_TRACING = 'false';
    process.env.LANGCHAIN_TRACING_V2 = 'false';
    process.env.LANGCHAIN_TRACING = 'false';
    for (const v of ['LANGSMITH_ENDPOINT', 'LANGCHAIN_ENDPOINT']) delete process.env[v];
    lg = await import(PAQUETE);
  }
  return lg;
}

/**
 * Misma interfaz que `ejecutarGrafo` del motor propio.
 *
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
export async function ejecutarGrafoLangGraph(entrada) {
  const { StateGraph, Annotation, START, END } = await cargar();
  const { deps, guardador } = entrada;
  const nodos = entrada.nodos ?? NODOS;
  if (!entrada.desde) return entrada.estado;
  if (entrada.decision && entrada.desde !== REVISION) {
    throw new Error('Hay una decisión pero la tarea no está esperándola: no se aplica.');
  }

  // Sin decisión no se hace nada: ni llamadas ni ejecuciones (CA-005-03)
  const pausar = (estado) => {
    deps.log.append('task_paused', { motivo: estado.revision?.motivo, detalle: estado.revision?.detalle }, { taskId: estado.taskId });
  };
  if (entrada.desde === REVISION && !entrada.decision) {
    pausar(entrada.estado);
    return entrada.estado;
  }

  const ultimo = (_anterior, nuevo) => nuevo;
  const Canal = Annotation.Root({
    estado:    Annotation({ reducer: ultimo }),
    siguiente: Annotation({ reducer: ultimo, default: () => null }),
    decision:  Annotation({ reducer: ultimo, default: () => undefined }),
  });

  const grafo = new StateGraph(Canal);
  const nombres = Object.keys(nodos);

  for (const nombre of nombres) {
    grafo.addNode(nombre, async (canal) => {
      const t0 = Date.now();
      const parcial = await nodos[nombre](canal.estado, deps, nombre === REVISION ? canal.decision : undefined);
      let estado = aplicar(canal.estado, parcial);

      const t = transicion(nombre, estado);
      estado  = aplicar(estado, t.parcial);

      guardador.guardar(estado.threadId, { nodo: nombre, siguiente: t.siguiente, estado });
      deps.log.append('ciclo:nodo_completado', { nodo: nombre, siguiente: t.siguiente, iteracion: estado.iteracion, durationMs: Date.now() - t0, motor: 'langgraph' }, { taskId: estado.taskId });

      // Una decisión vale para una sola revisión
      return { estado, siguiente: t.siguiente, decision: nombre === REVISION ? undefined : canal.decision };
    });
  }

  // Tras cada nodo se va a donde diga `transicion`. Una revisión sin decisión termina la ejecución.
  const destinos = Object.fromEntries([...nombres.map((n) => [n, n]), ['fin', END]]);
  const ruta = (canal) => (!canal.siguiente || (canal.siguiente === REVISION && !canal.decision) ? 'fin' : canal.siguiente);

  grafo.addConditionalEdges(START, (canal) => canal.siguiente, destinos);
  for (const nombre of nombres) grafo.addConditionalEdges(nombre, ruta, destinos);

  const final = await grafo.compile().invoke(
    { estado: entrada.estado, siguiente: entrada.desde, decision: entrada.decision },
    // Cuatro nodos de arranque, dos por iteración (también las que añada una decisión) y margen
    { recursionLimit: 50 + 2 * (entrada.estado.maxIteraciones + (entrada.decision?.iteracionesExtra ?? 0)) },
  );

  if (final.siguiente === REVISION) pausar(final.estado);
  return final.estado;
}
