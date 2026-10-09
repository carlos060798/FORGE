/**
 * grafo.js — Aristas del ciclo verificado, sin framework (ADR-01)
 *
 *   planner → retriever → qa → coder → sandbox ─┬─ pass ──────────────▶ mutacion ─┬─▶ fin (éxito)
 *                                  ▲            ├─ fail, quedan topes ─▶ coder     ├─ exigir y bajo el mínimo ─▶ refuerzo ─▶ sandbox
 *                                  └────────────┘                                  └─ sigue bajo el mínimo ───▶ revision_humana
 *                                               └─ tope / gasto / entorno / sin progreso ─▶ revision_humana
 *
 * Con `motor.mutacion: no` el nodo `mutacion` no existe: un pase termina en éxito, como antes de ADR-20.
 * `qa` puede acabar en revisión sin pasar por `coder` si sus pruebas no fallan sin implementación.
 *
 * `transicion` es pura: dado el nodo que acaba de terminar y el estado
 * resultante, dice cuál es el siguiente y qué cambia en el estado.
 */

import { pedirRevision } from './nodos.js';
import { decidirRuta, decidirTrasMutacion, detallePruebasDebiles, detalleSinProgreso, guardiaPresupuesto } from './router.js';
import { POR_DEFECTO } from './config.js';

export const INICIO = 'planner';
export const REVISION = 'revision_humana';

/**
 * Nodo al que se vuelve tras una revisión, según qué la provocó en el router.
 * Sin progreso vuelve al agente de pruebas: repetir con el implementador daría la misma salida.
 */
const REANUDAR = { iteraciones: 'coder', presupuesto: 'coder', infraestructura: 'sandbox', exito_sospechoso: 'coder', sin_progreso: 'qa', pruebas_no_fallan: 'qa', pruebas_debiles: 'refuerzo' };

/**
 * @param {string} nodo                                    nodo que acaba de terminar
 * @param {import('./estado.js').EstadoCiclo} estado       estado tras aplicar su resultado
 * @param {{ sinProgreso?: number, mutacion?: string, mutacionMinima?: number }} [opciones]
 *   `sinProgreso`: motor.sin_progreso; `mutacion`: motor.mutacion (no | informar | exigir); `mutacionMinima`: motor.mutacion_minima
 * @returns {{ siguiente: string|null, parcial: Partial<import('./estado.js').EstadoCiclo> }}
 */
export function transicion(nodo, estado, opciones = {}) {
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
      const sinProgreso = opciones.sinProgreso ?? POR_DEFECTO.motor.sin_progreso;
      const r = decidirRuta(estado, { sinProgreso });
      if (r.ruta === 'fin_exito') {
        // Antes de dar el pase por bueno se mide cuánto detectan las pruebas, salvo que esté desactivado
        const modo = opciones.mutacion ?? POR_DEFECTO.motor.mutacion;
        return modo === 'no' ? { siguiente: null, parcial: { resultado: 'exito' } } : { siguiente: 'mutacion', parcial: {} };
      }
      if (r.ruta === 'coder') return { siguiente: 'coder', parcial: {} };
      // Si el entorno falló, la persona necesita saber por qué: va en la revisión
      const ultima  = estado.ejecuciones[estado.ejecuciones.length - 1];
      const detalle = r.motivo === 'infraestructura' && ultima?.stderrCola ? ultima.stderrCola.slice(-400)
        : r.motivo === 'exito_sospechoso' ? `Las pruebas pasan (código 0), pero: ${(ultima?.sospecha ?? []).join('; ')}. Revisa el resultado y acéptalo si es correcto.`
        : r.motivo === 'sin_progreso' ? detalleSinProgreso(sinProgreso)
        : undefined;
      return { siguiente: REVISION, parcial: pedirRevision(r.motivo, REANUDAR[r.motivo], detalle) };
    }
    case 'mutacion': {
      const minima = opciones.mutacionMinima ?? POR_DEFECTO.motor.mutacion_minima;
      const r = decidirTrasMutacion(estado, { modo: opciones.mutacion, minima });
      if (r.ruta === 'fin_exito') return { siguiente: null, parcial: { resultado: 'exito' } };
      // El refuerzo llama a un modelo: no se inicia con el presupuesto agotado
      if (r.ruta === 'refuerzo') return conGuardia(estado, 'refuerzo');
      if (r.motivo === 'infraestructura') {
        return { siguiente: REVISION, parcial: pedirRevision('infraestructura', 'mutacion',
          `Las pruebas pasan, pero el entorno falló al medir cuánto detectan: ${estado.mutacion?.detalleInfra || 'sin detalle'}. «continuar» repite la medición; «aceptar» da la tarea por buena sin medir.`) };
      }
      return { siguiente: REVISION, parcial: pedirRevision(r.motivo, REANUDAR[r.motivo], detallePruebasDebiles(/** @type {any} */ (estado.mutacion), minima)) };
    }
    // Las pruebas reforzadas se ejecutan contra la implementación (no cuesta dinero): si fallan, vuelve el implementador
    case 'refuerzo': return { siguiente: 'sandbox', parcial: {} };
    default:
      throw new Error(`grafo: nodo desconocido "${nodo}"`);
  }
}

function conGuardia(estado, siguiente) {
  const r = guardiaPresupuesto(estado, siguiente);
  if (r.ruta === REVISION) return { siguiente: REVISION, parcial: pedirRevision('presupuesto', siguiente) };
  return { siguiente, parcial: {} };
}
