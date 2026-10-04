/**
 * grafo.js — Aristas del ciclo verificado, sin framework (ADR-01)
 *
 *   planner → retriever → qa → coder → sandbox ─┬─ pass ──────────────▶ fin (éxito)
 *                                  ▲            ├─ fail, quedan topes ─▶ coder
 *                                  └────────────┘
 *                                               └─ tope / gasto / entorno ─▶ revision_humana
 *
 * `transicion` es pura: dado el nodo que acaba de terminar y el estado
 * resultante, dice cuál es el siguiente y qué cambia en el estado.
 */

import { pedirRevision } from './nodos.js';
import { decidirRuta, guardiaPresupuesto } from './router.js';

export const INICIO = 'planner';
export const REVISION = 'revision_humana';

/** Nodo al que se vuelve tras una revisión, según qué la provocó en el router. */
const REANUDAR = { iteraciones: 'coder', presupuesto: 'coder', infraestructura: 'sandbox', exito_sospechoso: 'coder' };

/**
 * @param {string} nodo                                    nodo que acaba de terminar
 * @param {import('./estado.js').EstadoCiclo} estado       estado tras aplicar su resultado
 * @returns {{ siguiente: string|null, parcial: Partial<import('./estado.js').EstadoCiclo> }}
 */
export function transicion(nodo, estado) {
  if (nodo === REVISION) {
    const { decision, reanudarEn } = estado.revision ?? {};
    if (decision === 'continuar') return { siguiente: reanudarEn ?? 'coder', parcial: { revision: null } };
    return { siguiente: null, parcial: {} };   // aceptar o abortar: el resultado ya lo fijó el nodo
  }

  // Un nodo que no puede continuar deja una revisión pendiente
  if (estado.revision && !estado.revision.decision) return { siguiente: REVISION, parcial: {} };

  switch (nodo) {
    case 'planner': return conGuardia(estado, 'retriever');
    case 'retriever': return { siguiente: 'qa', parcial: {} };
    case 'qa': return conGuardia(estado, 'coder');
    // Tras implementar siempre se ejecutan las pruebas: no cuesta dinero, y si
    // pasan, el trabajo ya pagado termina en éxito aunque el presupuesto se agote.
    case 'coder': return { siguiente: 'sandbox', parcial: {} };
    case 'sandbox': {
      const r = decidirRuta(estado);
      if (r.ruta === 'fin_exito') return { siguiente: null, parcial: { resultado: 'exito' } };
      if (r.ruta === 'coder') return { siguiente: 'coder', parcial: {} };
      // Si el entorno falló, la persona necesita saber por qué: va en la revisión
      const ultima  = estado.ejecuciones[estado.ejecuciones.length - 1];
      const detalle = r.motivo === 'infraestructura' && ultima?.stderrCola ? ultima.stderrCola.slice(-400)
        : r.motivo === 'exito_sospechoso' ? `Las pruebas pasan (código 0), pero: ${(ultima?.sospecha ?? []).join('; ')}. Revisa el resultado y acéptalo si es correcto.`
        : undefined;
      return { siguiente: REVISION, parcial: pedirRevision(r.motivo, REANUDAR[r.motivo], detalle) };
    }
    default:
      throw new Error(`grafo: nodo desconocido "${nodo}"`);
  }
}

function conGuardia(estado, siguiente) {
  const r = guardiaPresupuesto(estado, siguiente);
  if (r.ruta === REVISION) return { siguiente: REVISION, parcial: pedirRevision('presupuesto', siguiente) };
  return { siguiente, parcial: {} };
}
