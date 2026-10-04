/**
 * motores/index.js — Elección del motor que ejecuta el grafo del ciclo (ADR-01)
 *
 *   auto      → LangGraph.js si está instalado y se puede cargar; si no, el propio
 *   langgraph → LangGraph.js; si no se puede cargar, avisa y usa el propio
 *   propio    → el motor sin dependencias
 */

import { ejecutarGrafo } from './propio.js';

export const MOTORES = ['auto', 'langgraph', 'propio'];

/**
 * @param {string} [preferencia]
 * @param {(mensaje: string) => void} [avisar]
 * @returns {Promise<{ nombre: 'langgraph'|'propio', ejecutar: typeof ejecutarGrafo }>}
 */
export async function elegirMotor(preferencia = 'auto', avisar = () => {}) {
  if (preferencia !== 'propio') {
    try {
      const m = await import('./langgraph.js');
      await m.cargar();
      return { nombre: 'langgraph', ejecutar: m.ejecutarGrafoLangGraph };
    } catch (e) {
      // En "auto" es lo esperado cuando la dependencia opcional no está: no se avisa
      if (preferencia === 'langgraph') {
        avisar(`LangGraph.js no está disponible (${e instanceof Error ? e.message.split('\n')[0] : e}). Se usa el motor propio.`);
      }
    }
  }
  return { nombre: 'propio', ejecutar: ejecutarGrafo };
}
