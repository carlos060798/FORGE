/**
 * motores/index.js — Motor que ejecuta el grafo del ciclo (ADR-01, ADR-18)
 *
 * Desde 5.0.0 hay un único motor, el propio, sin dependencias. LangGraph.js se retiró: las
 * preferencias `auto` y `propio` dan el propio, y `langgraph` (de una configuración antigua)
 * también, con un aviso.
 */

import { ejecutarGrafo } from './propio.js';

export const MOTORES = ['auto', 'langgraph', 'propio'];

/**
 * @param {string} [preferencia]
 * @param {(mensaje: string) => void} [avisar]
 * @returns {Promise<{ nombre: 'propio', ejecutar: typeof ejecutarGrafo }>}
 */
export async function elegirMotor(preferencia = 'auto', avisar = () => {}) {
  if (preferencia === 'langgraph') {
    avisar('LangGraph.js se retiró en 5.0.0 (ADR-18): se usa el motor propio, que hace lo mismo. Quita motor.grafo: langgraph de la configuración.');
  }
  return { nombre: 'propio', ejecutar: ejecutarGrafo };
}
