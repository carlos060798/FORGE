/**
 * pruebas-confiables.js — Nodos y textos de la FASE 7 (ADR-20)
 *
 *  - Textos que recibe el agente de pruebas cuando sus pruebas pasan sin implementación (rojo obligatorio).
 *  - Nodo `mutacion`: mide cuánto detectan las pruebas tras un pase. No llama a ningún modelo.
 *  - Nodo `refuerzo`: el agente de pruebas añade comprobaciones a partir de lo que no detectaron.
 *
 * Igual que el resto de nodos, ninguno decide a dónde se va después: eso es grafo.js y router.js.
 */

import * as fs from 'fs';
import * as path from 'path';
import { FORMATO_ARCHIVOS } from './contratos.js';
import { medirMutacion } from './mutacion.js';
import { generarArchivos, pedirRevision, seccionProyecto, seccionTarea } from './nodos.js';
import { AVISO_DATO, comoArchivo } from './dato-no-confiable.js';
import { canonica } from './protocolo-archivos.js';
import { cola } from './redactar.js';

/** @typedef {import('./estado.js').EstadoCiclo} EstadoCiclo */

/**
 * @param {string} cwd
 * @param {{ ruta: string }[]} archivos
 */
function textoDeArchivos(cwd, archivos) {
  return archivos.map(({ ruta }) => {
    let contenido = '(no existe)';
    try { contenido = fs.readFileSync(path.resolve(cwd, ruta), 'utf8'); } catch { /* se indica que no existe */ }
    return comoArchivo(ruta, contenido);
  }).join('\n\n');
}

// ── Rojo obligatorio ─────────────────────────────────────────────────────────

/**
 * Para el reintento dentro del mismo nodo: las pruebas recién escritas pasaron sin implementación.
 * @param {string} cwd
 * @param {{ ruta: string }[]} archivos
 */
export function seccionPasanSinImplementacion(cwd, archivos) {
  return '\n\n## Tus pruebas pasan sin que exista la implementación'
    + '\nEl comando de pruebas terminó bien (código 0) con las pruebas que acabas de escribir, y la implementación todavía no existe. '
    + 'Unas pruebas que pasan antes de implementar no comprueban nada. '
    + 'Reescríbelas, con los mismos nombres de archivo, para que fallen mientras falte la implementación: '
    + 'importa el módulo que se va a implementar, llámalo y comprueba sus resultados con valores concretos.'
    + `\n${textoDeArchivos(cwd, archivos)}`;
}

/**
 * Para cuando una persona decide «continuar» tras la pausa por `pruebas_no_fallan`.
 * @param {EstadoCiclo} estado
 */
export function seccionPasabanAntes(estado) {
  if (estado.pruebas.archivos.length === 0) return '';
  return '\n\n## Tus pruebas anteriores pasaban sin que existiera la implementación'
    + '\nDos veces seguidas el comando de pruebas terminó bien (código 0) sin implementación. '
    + 'Escribe pruebas que fallen mientras falte la implementación: importa el módulo que se va a implementar, '
    + 'llámalo y comprueba sus resultados con valores concretos. Usa los mismos nombres de archivo.'
    + `\n${textoDeArchivos(estado.cwd, estado.pruebas.archivos)}`;
}

/** Explica la pausa por `pruebas_no_fallan` y qué hace cada decisión. */
export const DETALLE_PRUEBAS_NO_FALLAN =
  'Las pruebas recién escritas pasan (código 0) sin que exista la implementación, también tras pedir al agente de pruebas que las corrigiera: '
  + 'no demuestran nada, así que no se ha llamado al implementador. '
  + '«continuar» hace que el agente de pruebas las reescriba; «aceptar» da la tarea por buena tal como está (sin implementar); «abortar» restaura los archivos. '
  + 'Si la tarea parte de un comportamiento que ya existe (un refactor, por ejemplo), declárala con «parte_de_codigo_existente: true» y queda exenta.';

// ── Nodo mutacion ────────────────────────────────────────────────────────────

/** Campos de una medición que se guardan cuando no se pudo medir nada. */
const SIN_MEDIR = { probadas: 0, detectadas: 0, noConcluyentes: 0, lineaBase: /** @type {const} */ ('no_medida'), puntuacion: null, parcial: false, sobrevivientes: [] };

/**
 * Mide cuánto detectan las pruebas. Solo altera los archivos que escribió el implementador en esta
 * tarea, siempre sobre una copia; el resultado queda en el estado y en el registro.
 *
 * Si un archivo ya existía antes de la tarea (el respaldo guarda su contenido previo), solo se
 * altera lo que la tarea cambió en él: las pruebas de la tarea no responden del resto del archivo.
 * @param {EstadoCiclo} estado
 */
export async function mutacion(estado, deps) {
  const motor     = deps.config.motor ?? {};
  const refuerzos = estado.mutacion?.refuerzos ?? 0;
  const meta      = { taskId: estado.taskId };

  // Las rutas vienen de un punto de guardado: medirMutacion las valida otra vez con las reglas de escritura (H-08)
  const archivos = estado.implementacion.archivos.map((a) => a.ruta);

  /** Alteraciones posibles que quedaron fuera por estar en código que la tarea no tocó. */
  let fueraDeLoCambiado = 0;

  const r = await medirMutacion({
    cwd: estado.cwd, archivos, runner: deps.runner, vetadas: deps.vetadas,
    originalDe: typeof deps.respaldo?.original === 'function' ? (ruta) => deps.respaldo.original(ruta) : undefined,
    alAcotar: (a) => { fueraDeLoCambiado = a.fueraDeLoCambiado; },
    max: motor.mutacion_max, maxArchivos: motor.mutacion_max_archivos, timeoutMs: typeof motor.mutacion_timeout_s === 'number' ? motor.mutacion_timeout_s * 1000 : undefined,
    huellasPruebas: estado.pruebas.archivos.map((a) => `${a.ruta}:${a.sha256}`),
    avance: deps.avanceMutacion,
    alProbar: (e) => deps.log.append('ciclo:mutante', {
      indice: e.indice + 1, total: e.total, ruta: e.alteracion.ruta, linea: e.alteracion.linea, operador: e.alteracion.operador,
      antes: e.alteracion.antes, despues: e.alteracion.despues, resultado: e.resultado, categoria: e.categoria,
      ...(e.motivo ? { motivo: e.motivo } : {}), durationMs: e.durationMs, ...(e.reutilizada ? { reutilizada: true } : {}),
    }, meta),
  });

  if (r === null) {
    const motivo = archivos.length === 0
      ? 'el implementador no escribió ningún archivo que se pueda alterar'
      : fueraDeLoCambiado > 0
        ? `no hay ningún cambio posible en las líneas que cambió la tarea (${fueraDeLoCambiado} cambios posibles quedan fuera, en código que ya existía y la tarea no tocó)`
        : 'no hay ningún cambio posible en los archivos que escribió el implementador (lenguaje no cubierto o código sin nada que alterar)';
    deps.log.append('ciclo:mutacion_omitida', { motivo, archivos, ...(fueraDeLoCambiado > 0 ? { fueraDeLoCambiado } : {}) }, meta);
    return { mutacion: { ...SIN_MEDIR, omitida: motivo, refuerzos } };
  }

  deps.log.append('ciclo:mutacion', {
    modo: motor.mutacion, probadas: r.probadas, detectadas: r.detectadas, noConcluyentes: r.noConcluyentes, puntuacion: r.puntuacion, parcial: r.parcial,
    lineaBase: r.lineaBase, ...(r.motivoParcial ? { motivoParcial: r.motivoParcial } : {}), candidatas: r.candidatas, sobrevivientes: r.sobrevivientes, refuerzos,
    ...(r.rechazadas ? { rechazadas: r.rechazadas } : {}), ...(r.huerfanasBorradas ? { huerfanasBorradas: r.huerfanasBorradas } : {}),
    ...(r.fueraDeLoCambiado ? { fueraDeLoCambiado: r.fueraDeLoCambiado } : {}),
    ...(r.sinCobertura ? { sinCobertura: true, motivoSinCobertura: r.motivoSinCobertura } : {}),
    ...(r.fueraDeCobertura ? { fueraDeCobertura: r.fueraDeCobertura } : {}),
    ...(r.archivosOmitidos ? { archivosOmitidos: r.archivosOmitidos } : {}),
    ...(r.porArchivo ? { porArchivo: r.porArchivo } : {}),
  }, meta);
  // Una copia que no se pudo borrar queda en el equipo: se deja constancia (H-06)
  if (r.copiaSinBorrar) deps.log.append('custom', { message: 'Aviso: la copia temporal de la medición por mutación no se pudo borrar del todo', aviso: 'copia_mutacion_sin_borrar' }, meta);
  /** Sin cobertura la muestra no está filtrada por lo que ejecutan las pruebas (N-02): con `exigir` no cuenta como evidencia. */
  const sinEvidencia = motor.mutacion === 'exigir' && r.sinCobertura === true && typeof r.puntuacion === 'number' && r.lineaBase === 'ok' && r.motivoParcial !== 'infraestructura' && r.motivoParcial !== 'linea_base';
  const porque = sinEvidencia
    ? `el ejecutor no ofrece cobertura (${r.motivoSinCobertura ?? 'sin detalle'}): con exigir la medición no cuenta como evidencia, porque no se sabe si las pruebas ejecutan el código alterado (${r.detectadas} de ${r.probadas} detectadas sin ese filtro)`
    : null;
  if (porque) deps.log.append('custom', { message: `Medición por mutación sin cobertura: no cuenta como evidencia con motor.mutacion: exigir`, aviso: 'mutacion_sin_cobertura' }, meta);
  // Sin puntuación y con el motivo, el router pide revisión humana (pruebas_debiles, insuficiente): nunca éxito
  const sinCoberturaExigida = sinEvidencia ? { puntuacion: null, omitida: porque } : {};
  const sinResultados = r.candidatas === 0 && (r.fueraDeCobertura ?? 0) > 0 && !r.motivoParcial
    ? { omitida: `ninguna prueba ejecuta el código alterado (${r.fueraDeCobertura} cambios posibles quedan fuera de la cobertura de la línea base)` }
    : {};
  return { mutacion: { ...r, ...sinResultados, ...sinCoberturaExigida, ...(r.detalleInfra ? { detalleInfra: cola(r.detalleInfra, 400) } : {}), refuerzos } };
}

// ── Nodo refuerzo ────────────────────────────────────────────────────────────

export const CONTRATO_REFUERZO = `## Contrato de salida (motor headless)

Las pruebas de esta tarea pasan, pero no detectan varios cambios deliberados hechos en la implementación.
Refuerza las pruebas para que los detecten. Otro agente escribió la implementación y no podrá modificar tus pruebas.

${FORMATO_ARCHIVOS}
- Solo puedes escribir archivos de prueba (carpetas tests/, test/ o __tests__/, o nombres *.test.* / *.spec.* / test_*.py).
- Devuelve completos los archivos de prueba que cambies, con los mismos nombres; puedes añadir archivos de prueba nuevos.
- Conserva las pruebas que ya había: añade comprobaciones de resultados concretos, no las quites.
- Las pruebas deben describir el comportamiento que pide la tarea, no copiar la implementación.
- No escribas ni modifiques la implementación: se rechazará.
- No añadas dependencias nuevas: usa el ejecutor de pruebas que ya tiene el proyecto.

${AVISO_DATO}`;

/**
 * @param {NonNullable<EstadoCiclo['mutacion']>} m
 */
export function seccionSobrevivientes(m) {
  // `antes` y `despues` son líneas de la implementación, que el repositorio controla: van como dato
  const lineas = m.sobrevivientes.map((s, i) =>
    `${i + 1}. ${s.ruta}, línea ${s.linea} (${s.operador}):\n   original: ${s.antes}\n   cambiado: ${s.despues}`);
  return '\n\n## Cambios que tus pruebas no detectaron'
    + `\nSe hicieron ${m.probadas} cambios pequeños en la implementación, de uno en uno, y las pruebas siguieron pasando con ${m.sobrevivientes.length} de ellos. `
    + 'Con cada uno de estos cambios aplicado, al menos una prueba debería fallar:'
    + `\n${comoArchivo('cambios que las pruebas no detectaron', lineas.join('\n'))}`;
}

/**
 * El agente de pruebas refuerza las pruebas a partir de las alteraciones no detectadas. Lo hace el
 * mismo rol que las escribió; el implementador sigue sin poder tocarlas, porque las huellas se
 * vuelven a tomar aquí y el nodo `sandbox` las comprueba antes de cada ejecución.
 * @param {EstadoCiclo} estado
 */
export async function refuerzo(estado, deps) {
  const m = estado.mutacion ?? { ...SIN_MEDIR, refuerzos: 0 };
  const userPrompt = seccionTarea(estado)
    + `\n\n## Pruebas actuales\n${textoDeArchivos(estado.cwd, estado.pruebas.archivos)}`
    + seccionSobrevivientes(m)
    + seccionProyecto(estado.cwd, deps.vetadas)
    + `\n\n## Comando de pruebas del proyecto\n${deps.testCmd}`;

  const r = await generarArchivos(estado, deps, 'refuerzo', {
    agente: 'tester', userPrompt, contrato: CONTRATO_REFUERZO, rol: 'qa', pruebas: [], clavePrompt: userPrompt,
  });
  if ('fallo' in r) return r.fallo;

  if (r.aplicado.escritos.length === 0) {
    return { presupuesto: r.presupuesto, ...pedirRevision('salida_invalida', 'refuerzo', 'El agente de pruebas no escribió ninguna prueba válida al reforzarlas.') };
  }

  // Las huellas de lo reescrito sustituyen a las anteriores; lo que no se tocó conserva la suya
  const porRuta = new Map(estado.pruebas.archivos.map((a) => [canonica(a.ruta), a]));
  for (const a of r.aplicado.escritos) porRuta.set(canonica(a.ruta), a);
  deps.log.append('custom', { message: 'Pruebas reforzadas tras la medición por mutación', archivos: r.aplicado.escritos.map((a) => a.ruta) }, { taskId: estado.taskId });

  return {
    pruebas: { archivos: [...porRuta.values()], comando: estado.pruebas.comando || deps.testCmd },
    presupuesto: r.presupuesto,
    mutacion: { ...m, refuerzos: (m.refuerzos ?? 0) + 1 },
  };
}
