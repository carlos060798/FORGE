/**
 * router.js — Decisiones deterministas del ciclo verificado (ADR-05)
 *
 * Funciones puras. La decisión depende del código de salida y del estado de
 * control, nunca del texto de la salida ni de un modelo. De la salida solo se
 * compara su huella con la de las ejecuciones anteriores (igual o distinta).
 */

import { POR_DEFECTO } from './config.js';

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
 * ¿Las últimas `n` ejecuciones fallaron con la misma salida? Si el implementador cambia el
 * código y la salida no cambia, lo más probable es que el fallo no esté en su mano: unas
 * pruebas que no cargan, por ejemplo, que él no puede tocar (hallazgo H8).
 * Una huella vacía (ejecución sin salida) no cuenta: no hay nada que comparar.
 *
 * @param {import('./estado.js').EstadoCiclo} estado
 * @param {number} n  0 desactiva la detección
 */
export function sinProgreso(estado, n) {
  if (!Number.isInteger(n) || n < 1 || estado.ejecuciones.length < n) return false;
  const ultimas = estado.ejecuciones.slice(-n);
  const huella  = ultimas[0].huellaSalida;
  if (typeof huella !== 'string' || huella === '') return false;
  return ultimas.every((e) => e.categoria === 'fail' && e.huellaSalida === huella);
}

/** @param {number} n */
export const detalleSinProgreso = (n) =>
  `La salida de las pruebas fue idéntica ${n} veces seguidas aunque la implementación cambió: `
  + 'puede que las pruebas estén rotas por sí mismas (no cargan, o piden algo imposible) y el implementador no puede tocarlas. '
  + '«continuar» hace que el agente de pruebas las reescriba; «aceptar» da la tarea por buena tal como está; '
  + '«abortar» restaura los archivos.';

/**
 * Siguiente paso tras ejecutar las pruebas. El éxito se evalúa antes que los
 * topes: un pase en la última iteración permitida es un éxito.
 *
 * @param {import('./estado.js').EstadoCiclo} estado
 * @param {{ sinProgreso?: number }} [opciones]  `sinProgreso`: motor.sin_progreso (0 lo desactiva)
 * @returns {{ ruta: 'fin_exito' } | { ruta: 'coder' } | { ruta: 'revision_humana', motivo: 'infraestructura'|'presupuesto'|'iteraciones'|'exito_sospechoso'|'sin_progreso' }}
 */
export function decidirRuta(estado, opciones = {}) {
  const ultima = estado.ejecuciones[estado.ejecuciones.length - 1];
  if (!ultima) throw new Error('decidirRuta: no hay ninguna ejecución registrada');

  if (ultima.categoria === 'infra_error')          return { ruta: 'revision_humana', motivo: 'infraestructura' };
  if (ultima.categoria === 'pass' && ultima.sospecha?.length) return { ruta: 'revision_humana', motivo: 'exito_sospechoso' };
  if (ultima.categoria === 'pass')                 return { ruta: 'fin_exito' };
  if (estado.presupuesto.estado === 'agotado')     return { ruta: 'revision_humana', motivo: 'presupuesto' };
  // Antes que el tope de iteraciones: si coinciden, esta es la causa que la persona necesita conocer
  if (sinProgreso(estado, opciones.sinProgreso ?? POR_DEFECTO.motor.sin_progreso)) return { ruta: 'revision_humana', motivo: 'sin_progreso' };
  if (estado.iteracion >= estado.maxIteraciones)   return { ruta: 'revision_humana', motivo: 'iteraciones' };
  return { ruta: 'coder' };
}

/**
 * Siguiente paso tras medir las pruebas por mutación (ADR-20). Depende solo de la puntuación, del
 * mínimo y del estado de control (cuántos refuerzos se han hecho): nunca del texto de una salida
 * ni de un modelo (Principio VI).
 *
 *  - Solo el modo `exigir` puede cambiar la ruta; con `informar` la medición nunca cambia el resultado.
 *  - Una medición que no vale NUNCA da éxito silencioso en `exigir` (H-04): sin nada que alterar,
 *    con menos de `minConcluyentes` alteraciones concluyentes, o interrumpida por el entorno o con
 *    una línea base que falla, pide revisión humana. El motivo es `infraestructura` si fue el
 *    entorno (o la línea base) y `pruebas_debiles` si no se pudo medir lo bastante; `insuficiente`
 *    distingue este último caso del de una puntuación baja.
 *  - Bajo el mínimo con muestra suficiente: un refuerzo de las pruebas, una sola vez; después, una persona decide.
 *
 * @param {import('./estado.js').EstadoCiclo} estado
 * @param {{ modo?: string, minima?: number, minConcluyentes?: number }} [opciones]  motor.mutacion, motor.mutacion_minima y motor.mutacion_min_concluyentes
 * @returns {{ ruta: 'fin_exito' } | { ruta: 'refuerzo' } | { ruta: 'revision_humana', motivo: 'pruebas_debiles'|'infraestructura', insuficiente?: boolean }}
 */
export function decidirTrasMutacion(estado, opciones = {}) {
  const modo   = opciones.modo ?? POR_DEFECTO.motor.mutacion;
  const minima = opciones.minima ?? POR_DEFECTO.motor.mutacion_minima;
  const minConcluyentes = opciones.minConcluyentes ?? POR_DEFECTO.motor.mutacion_min_concluyentes;
  const m = estado.mutacion;
  if (modo !== 'exigir' || !m) return { ruta: 'fin_exito' };
  if (m.motivoParcial === 'infraestructura' || m.motivoParcial === 'linea_base') return { ruta: 'revision_humana', motivo: 'infraestructura' };
  // Nada que alterar, o muy poco: una puntuación sobre una muestra vacía no demuestra nada
  if (typeof m.puntuacion !== 'number' || (m.probadas ?? 0) < minConcluyentes) {
    return { ruta: 'revision_humana', motivo: 'pruebas_debiles', insuficiente: true };
  }
  if (m.puntuacion >= minima) return { ruta: 'fin_exito' };
  if ((m.refuerzos ?? 0) === 0) return { ruta: 'refuerzo' };
  return { ruta: 'revision_humana', motivo: 'pruebas_debiles' };
}

/** @param {number} fraccion */
export const porcentaje = (fraccion) => `${Math.round(fraccion * 100)} %`;

/**
 * Por qué la medición no basta para exigir nada: explicación para la persona que decide.
 * @param {NonNullable<import('./estado.js').EstadoCiclo['mutacion']>} m
 * @param {number} minConcluyentes
 */
export function detalleMedicionInsuficiente(m, minConcluyentes) {
  const porque = m.omitida
    ? `no se pudo medir nada: ${m.omitida}`
    : `solo ${m.probadas ?? 0} alteraciones concluyentes (el mínimo es ${minConcluyentes})`
      + `${m.noConcluyentes ? `; ${m.noConcluyentes} se descartaron por no compilar, no cargar el módulo o fallar el entorno` : ''}`
      + `${m.motivoParcial === 'tiempo' ? '; la medición se cortó por tiempo' : ''}`;
  return `Las pruebas pasan, pero con motor.mutacion: exigir la medición no vale: ${porque}. `
    + 'Con tan pocas alteraciones una puntuación no demuestra que las pruebas detecten cambios, y no se da por buena en silencio. '
    + '«continuar» repite la medición; «aceptar» da la tarea por buena tal como está; «abortar» restaura los archivos.';
}

/**
 * @param {NonNullable<import('./estado.js').EstadoCiclo['mutacion']>} m
 * @param {number} minima
 */
export function detallePruebasDebiles(m, minima) {
  const lista = m.sobrevivientes.slice(0, 10)
    .map((s) => `${s.ruta}:${s.linea} (${s.operador}) «${s.antes}» → «${s.despues}»`).join('; ');
  return `Las pruebas pasan, pero solo detectan ${m.detectadas} de ${m.probadas} cambios deliberados en el código `
    + `(${porcentaje(m.puntuacion ?? 0)}; el mínimo es ${porcentaje(minima)})${m.parcial ? ', medición parcial' : ''}, también tras reforzarlas una vez. `
    + `Cambios que no detectan: ${lista || '(ninguno listado)'}. `
    + 'Un cambio puede no alterar el comportamiento y no ser detectable: decide tú. '
    + '«continuar» pide otro refuerzo al agente de pruebas; «aceptar» da la tarea por buena tal como está; «abortar» restaura los archivos.';
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
