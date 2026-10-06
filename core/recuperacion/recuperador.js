/**
 * recuperador.js — Puerto de recuperación de contexto para el ciclo (ADR-08)
 *
 * Un recuperador es una función:
 *   ({ cwd, tarea, plan, maxBytes, specPath? }) => {
 *     contexto: { fragmentos: [{ ruta, origen, bytes }], bytesTotales, truncado },
 *     texto: string   // lo que se entrega al agente
 *   }
 *
 * La implementación por defecto reúne contexto por archivos, sin índice previo.
 * `semantico` añade los trozos del repositorio más parecidos a la tarea (índice de vectores).
 * Un recuperador puede devolver el resultado directamente o una promesa.
 */

import { recuperarPorArchivos } from './recuperador-archivos.js';
import { recuperarSemantico } from './recuperador-semantico.js';

/** @type {Map<string, Function>} */
const REGISTRO = new Map(/** @type {[string, Function][]} */ ([['archivos', recuperarPorArchivos], ['semantico', recuperarSemantico]]));

/**
 * @param {string} nombre
 * @param {Function} recuperador
 */
export function registrarRecuperador(nombre, recuperador) {
  if (typeof recuperador !== 'function') throw new Error('Un recuperador debe ser una función');
  REGISTRO.set(nombre, recuperador);
}

/**
 * @param {string} [nombre]
 * @returns {Function}
 */
export function crearRecuperador(nombre = 'archivos') {
  const recuperador = REGISTRO.get(nombre);
  if (!recuperador) {
    throw new Error(`Recuperador desconocido: "${nombre}". Disponibles: ${[...REGISTRO.keys()].join(', ')}`);
  }
  return recuperador;
}
