/**
 * verificar/mutacion.js — medición por mutación de `forge verificar --mutacion`
 *
 * Usa `medirMutacion` del ciclo (ADR-20) sin copiarla: spike S0.1 confirma que no necesita estado,
 * diario ni presupuesto; solo el `runner` (un SandboxRunner real, del que lee `runner.o`), los
 * topes `motor.*` y los archivos. Aquí solo se decide qué significa el resultado:
 *
 *  - `null` (nada que alterar), línea base que falla, `sinCobertura` y medición parcial (por tiempo o
 *    infraestructura) o con menos de `mutacion_min_concluyentes` alteraciones concluyentes son
 *    NO CONCLUYENTES: con `--mutacion-minima` el comando falla cerrado, nunca es éxito.
 *  - `tope_alteraciones` no es parcial en este sentido: es el muestreo normal (hay más candidatas que
 *    `mutacion_max`), igual que lo trata el enrutador del ciclo.
 */

import { redactar } from '../ciclo/redactar.js';

/** Se imprime siempre que se mide por mutación (docs/PROBLEMAS-CONOCIDOS.md). */
export const AVISO_ADVERSARIO =
  'Límite conocido: la puntuación mide si las pruebas detectan cambios accidentales; un adversario deliberado '
  + 'puede imitar la señal de aserción y obtener una puntuación alta sin probar nada (docs/PROBLEMAS-CONOCIDOS.md). '
  + 'No sustituye a la revisión humana de código no confiable.';

/** @typedef {'medida'|'cumple_el_minimo'|'bajo_el_minimo'|'no_concluyente'} VeredictoMutacion */

/**
 * @param {any} r  ResultadoMutacion o null
 * @param {{ minima?: number|null, minConcluyentes: number, archivos: string[], omitida?: string }} o
 */
export function juzgarMedicion(r, o) {
  const minima = typeof o.minima === 'number' ? o.minima : null;
  /** @type {string[]} */
  const motivos = [];
  if (r === null && o.omitida) {
    motivos.push(o.omitida);
  } else if (r === null) {
    motivos.push('no hay ningún cambio posible que medir en esos archivos (lenguaje no cubierto, código sin nada que alterar, archivos inexistentes o rechazados, o todo fuera de lo cambiado)');
  } else {
    if (r.lineaBase === 'infraestructura') motivos.push(`el entorno falló al ejecutar las pruebas sin alterar nada${r.detalleInfra ? `: ${String(r.detalleInfra).slice(-160)}` : ''}`);
    else if (r.lineaBase === 'falla') motivos.push('las pruebas fallan sin alterar nada (línea base): una alteración detectada no significaría nada');
    if (r.sinCobertura) motivos.push(`no se pudo medir la cobertura (${r.motivoSinCobertura ?? 'sin detalle'}): no se sabe si las pruebas ejecutan el código alterado`);
    if (r.parcial && r.motivoParcial === 'tiempo') motivos.push('la medición se cortó por tiempo');
    if (r.parcial && r.motivoParcial === 'infraestructura' && r.lineaBase === 'ok') motivos.push('la medición se interrumpió por un fallo del entorno');
    if (r.lineaBase === 'ok' && (r.probadas ?? 0) < o.minConcluyentes) {
      motivos.push(`solo ${r.probadas ?? 0} alteraciones concluyentes (el mínimo es ${o.minConcluyentes})${r.noConcluyentes ? `; ${r.noConcluyentes} se descartaron por no compilar, no cargar el módulo o fallar el entorno` : ''}`);
    }
    if (typeof r.puntuacion !== 'number' && motivos.length === 0) motivos.push('no hubo ninguna alteración concluyente');
  }
  const concluyente = motivos.length === 0;
  const puntuacion = r && typeof r.puntuacion === 'number' ? r.puntuacion : null;
  /** @type {VeredictoMutacion} */
  let veredicto;
  if (!concluyente) veredicto = 'no_concluyente';
  else if (minima === null) veredicto = 'medida';
  else veredicto = /** @type {number} */ (puntuacion) >= minima ? 'cumple_el_minimo' : 'bajo_el_minimo';

  const infra = r !== null && (r.lineaBase === 'infraestructura' || r.motivoParcial === 'infraestructura');
  return {
    solicitada: true,
    archivos: o.archivos,
    probadas: r?.probadas ?? 0,
    detectadas: r?.detectadas ?? 0,
    // Alteraciones concluyentes (detectadas + sobrevivientes): el denominador de la puntuación
    concluyentes: r?.probadas ?? 0,
    descartadas: r?.noConcluyentes ?? 0,
    puntuacion: concluyente ? puntuacion : null,
    puntuacionBruta: puntuacion,
    concluyente,
    veredicto,
    minima,
    minConcluyentes: o.minConcluyentes,
    motivos: motivos.map((m) => redactar(m)),
    parcial: r?.parcial === true,
    motivoParcial: r?.motivoParcial ?? null,
    sinCobertura: r?.sinCobertura === true,
    lineaBase: r?.lineaBase ?? 'no_medida',
    infraestructura: infra,
    candidatas: r?.candidatas ?? 0,
    fueraDeLoCambiado: r?.fueraDeLoCambiado ?? 0,
    rechazadas: (r?.rechazadas ?? []).slice(0, 20).map((x) => ({ ruta: redactar(String(x.ruta)), motivo: String(x.motivo) })),
    sobrevivientes: (r?.sobrevivientes ?? []).slice(0, 10).map((s) => ({
      ruta: redactar(String(s.ruta)), linea: s.linea, operador: s.operador,
      antes: redactar(String(s.antes ?? '')).slice(0, 120), despues: redactar(String(s.despues ?? '')).slice(0, 120),
    })),
    copiaSinBorrar: r?.copiaSinBorrar === true,
    aviso: AVISO_ADVERSARIO,
  };
}

/**
 * Mide y juzga. Importa la medición solo aquí (es pesada: acorn).
 * @param {{
 *   cwd: string, archivos: string[], runner: any,
 *   motor: { mutacion_max: number, mutacion_max_archivos: number, mutacion_min_concluyentes: number, mutacion_timeout_s: number },
 *   vetadas?: string[], originalDe?: (ruta: string) => string|null, minima?: number|null, dirTemporal?: string,
 * }} o
 */
export async function medir(o) {
  const { medirMutacion } = await import('../ciclo/mutacion.js');
  const r = await medirMutacion({
    cwd: o.cwd, archivos: o.archivos, runner: o.runner,
    max: o.motor.mutacion_max, maxArchivos: o.motor.mutacion_max_archivos,
    timeoutMs: o.motor.mutacion_timeout_s * 1000,
    vetadas: o.vetadas, originalDe: o.originalDe, dirTemporal: o.dirTemporal,
  });
  return juzgarMedicion(r, { minima: o.minima, minConcluyentes: o.motor.mutacion_min_concluyentes, archivos: o.archivos });
}
