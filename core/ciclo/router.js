/**
 * router.js — Decisiones deterministas del ciclo verificado (ADR-05)
 *
 * Funciones puras. La decisión depende del código de salida y del estado de
 * control, nunca del texto de la salida ni de un modelo.
 */

/** Códigos con los que el runtime de contenedores indica que no pudo ejecutar. */
const CODIGOS_INFRA = new Set([125, 126, 127]);

/**
 * @param {{ exitCode: number|null, timedOut?: boolean, infraError?: boolean }} resultado
 * @param {{ hayPruebas: boolean, pruebasIntactas: boolean }} pruebas
 * @returns {'pass'|'fail'|'timeout'|'infra_error'}
 */
export function clasificar(resultado, pruebas) {
  if (resultado.infraError || (resultado.exitCode !== null && CODIGOS_INFRA.has(resultado.exitCode))) {
    return 'infra_error';
  }
  // Un contenedor matado por tiempo no deja código de salida: no es un fallo del entorno
  if (resultado.timedOut) return 'timeout';
  if (resultado.exitCode === null) return 'infra_error';
  // Sin pruebas, o con pruebas alteradas, un código 0 no demuestra nada
  if (resultado.exitCode === 0 && pruebas.hayPruebas && pruebas.pruebasIntactas) return 'pass';
  return 'fail';
}

/**
 * ¿El ejecutor terminó sin encontrar ninguna prueba? pytest y unittest (Python ≥3.12) lo indican con
 * el código de salida 5. No es un fallo de la implementación: ninguna versión del código lo arregla,
 * así que no debe gastar iteraciones (hallazgo H2 de la validación con modelo real).
 * La decisión depende del código de salida y del comando configurado, no del texto de la salida.
 *
 * @param {{ exitCode: number|null, timedOut?: boolean, infraError?: boolean }} resultado
 * @param {string} [comando]  comando de pruebas del proyecto
 */
export function sinPruebasEjecutadas(resultado, comando = '') {
  if (resultado.infraError || resultado.timedOut || resultado.exitCode !== 5) return false;
  return /(^|[\s/\\])(pytest|py\.test)(\s|$)|-m\s+(pytest|unittest)\b/.test(comando);
}

/** @param {string} comando */
export const detalleSinPruebas = (comando) =>
  `El comando de pruebas (${comando}) terminó sin encontrar ninguna prueba (código 5). `
  + 'No es un fallo de la implementación. Comprueba que el comando encuentra los archivos de prueba '
  + '(con unittest hace falta tests/__init__.py o «discover -s tests»; con pytest, revisa testpaths). '
  + 'Si continúas, el agente de pruebas las vuelve a escribir.';

/**
 * Siguiente paso tras ejecutar las pruebas. El éxito se evalúa antes que los
 * topes: un pase en la última iteración permitida es un éxito.
 *
 * @param {import('./estado.js').EstadoCiclo} estado
 * @returns {{ ruta: 'fin_exito' } | { ruta: 'coder' } | { ruta: 'revision_humana', motivo: 'infraestructura'|'presupuesto'|'iteraciones'|'exito_sospechoso' }}
 */
export function decidirRuta(estado) {
  const ultima = estado.ejecuciones[estado.ejecuciones.length - 1];
  if (!ultima) throw new Error('decidirRuta: no hay ninguna ejecución registrada');

  if (ultima.categoria === 'infra_error')          return { ruta: 'revision_humana', motivo: 'infraestructura' };
  if (ultima.categoria === 'pass' && ultima.sospecha?.length) return { ruta: 'revision_humana', motivo: 'exito_sospechoso' };
  if (ultima.categoria === 'pass')                 return { ruta: 'fin_exito' };
  if (estado.presupuesto.estado === 'agotado')     return { ruta: 'revision_humana', motivo: 'presupuesto' };
  if (estado.iteracion >= estado.maxIteraciones)   return { ruta: 'revision_humana', motivo: 'iteraciones' };
  return { ruta: 'coder' };
}

/**
 * Tras un nodo que llama a un modelo: no se sigue si el presupuesto se agotó.
 *
 * @template {string} T
 * @param {import('./estado.js').EstadoCiclo} estado
 * @param {T} siguiente
 * @returns {{ ruta: T } | { ruta: 'revision_humana', motivo: 'presupuesto' }}
 */
export function guardiaPresupuesto(estado, siguiente) {
  if (estado.presupuesto.estado === 'agotado') return { ruta: 'revision_humana', motivo: 'presupuesto' };
  return { ruta: siguiente };
}
