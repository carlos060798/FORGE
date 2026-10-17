/**
 * puertas/ejecutar.js — ejecución de las puertas declaradas, en el MISMO contenedor sin red que las pruebas
 *
 * Spec 2026-10-14-puertas-de-calidad-y-evidencia, fase B1 (spikes/varias-ejecuciones.md):
 *  - Cada puerta es un clon del `SandboxRunner` de las pruebas que cambia SOLO `testCmd` (patrón de
 *    `ejecutorConComando`, core/ciclo/mutacion.js): `argvRun` fija sin red, sin privilegios, sin capacidades
 *    y los límites; la puerta solo aporta un comando. Ningún campo de la puerta llega al contenedor.
 *  - EN SERIE y en el orden fijo de `CLAVES_PUERTAS`: dos construcciones simultáneas de la imagen competirían
 *    y cada contenedor ya pide su CPU.
 *  - Tiempo por puerta y tiempo TOTAL acotados (topes de ./config.js); salida acotada y redactada.
 *  - Clasificación por código de salida, nunca por el texto: pass / fail / timeout / infra_error con las reglas
 *    del enrutador (`clasificar`); 127 (herramienta ausente) se mira ANTES y es `no_ejecutable`: ni fallo de
 *    infraestructura ni éxito. `clasificar` no se toca (el ciclo sigue tratando 127 como hoy).
 *  - Nada de lo que no pasa es éxito (falla cerrado): `no_ejecutable`, `timeout`, `infra_error` y
 *    `no_ejecutada` (no se llegó a lanzar por tiempo total agotado o por un fallo previo de infraestructura).
 */

import { clasificar } from '../ciclo/router.js';
import { cola, redactar } from '../ciclo/redactar.js';
import { CLAVES_PUERTAS, MAX_PUERTAS } from './config.js';

/** Tope de la salida de cada puerta que entra en el resultado (el mismo que el de las pruebas). */
export const SALIDA_PUERTA_MAX = 8192;

/**
 * @typedef {'pass'|'fail'|'timeout'|'infra_error'|'no_ejecutable'|'no_ejecutada'} CategoriaPuerta
 * @typedef {{ nombre: string, comando: string, categoria: CategoriaPuerta, codigoSalida: number|null,
 *   duracionMs: number, salida: string, motivo: string|null }} ResultadoPuerta
 */

/**
 * Clon del ejecutor que solo cambia el comando (y, para las puertas, tiempo y tope de salida).
 * @param {any} runner @param {string} comando @param {string} nombre @param {number} timeoutMs @param {number} salidaMaxBytes
 */
function clonar(runner, comando, nombre, timeoutMs, salidaMaxBytes) {
  const o = runner?.o;
  if (!o || typeof runner.constructor !== 'function' || typeof o.runId !== 'string') throw new Error('el ejecutor de pruebas no permite ejecutar otro comando');
  return new runner.constructor({
    ...o, testCmd: comando, runId: `${o.runId}-puerta-${nombre}`, cli: runner.cli ?? o.cli,
    timeoutMs, salidaMaxBytes: Math.min(salidaMaxBytes, Number(o.salidaMaxBytes) || salidaMaxBytes),
  });
}

/**
 * @param {{ exitCode: number|null, infraError?: boolean, timedOut?: boolean }} r
 * @returns {Exclude<CategoriaPuerta, 'no_ejecutada'>}
 */
export function categoriaDePuerta(r) {
  // 127 = «executable file not found»: la herramienta no está en la imagen (sin red no se instala)
  if (!r.infraError && !r.timedOut && r.exitCode === 127) return 'no_ejecutable';
  return clasificar(/** @type {any} */ (r), { hayPruebas: true, pruebasIntactas: true });
}

/**
 * @param {{ puertas: { nombre: string, comando: string }[], topes: { timeout_s: number, timeout_total_s: number, salida_max_bytes: number },
 *   runner: any, cwd: string, ahora?: () => number }} o
 * @returns {Promise<{ resultados: ResultadoPuerta[] }>}
 */
export async function ejecutarPuertas(o) {
  const { puertas, topes, runner, cwd } = o;
  const ahora = o.ahora ?? Date.now;
  if (puertas.length > MAX_PUERTAS) throw new Error(`Hay ${puertas.length} puertas y el límite es ${MAX_PUERTAS}.`);
  const vistos = new Set();
  for (const p of puertas) {
    if (!CLAVES_PUERTAS.includes(p.nombre) || vistos.has(p.nombre)) throw new Error(`Puerta no válida o repetida: «${p.nombre}».`);
    vistos.add(p.nombre);
  }
  // Orden fijo, sea cual sea el de la lista recibida
  const ordenadas = [...puertas].sort((a, b) => CLAVES_PUERTAS.indexOf(a.nombre) - CLAVES_PUERTAS.indexOf(b.nombre));

  /** @type {ResultadoPuerta[]} */
  const resultados = [];
  let usadoMs = 0;
  const totalMs = topes.timeout_total_s * 1000;
  /** @type {string|null} */
  let corte = null;

  for (const p of ordenadas) {
    const base = { nombre: p.nombre, comando: redactar(p.comando) };
    const restante = totalMs - usadoMs;
    if (corte === null && restante <= 0) corte = 'se agotó el tiempo total de las puertas';
    if (corte !== null) {
      resultados.push({ ...base, categoria: 'no_ejecutada', codigoSalida: null, duracionMs: 0, salida: '', motivo: `no se lanzó: ${corte}` });
      continue;
    }
    const timeoutMs = Math.min(topes.timeout_s * 1000, restante, Number(runner?.o?.timeoutMs) || Infinity);
    const t0 = ahora();
    /** @type {any} */ let r;
    try {
      const clon = clonar(runner, p.comando, p.nombre, timeoutMs, topes.salida_max_bytes);
      r = await clon.test(cwd);
      if (Array.isArray(clon.copiasSinBorrar) && clon.copiasSinBorrar.length > 0 && Array.isArray(runner.copiasSinBorrar)) runner.copiasSinBorrar.push(...clon.copiasSinBorrar);
    } catch (e) {
      r = { exitCode: null, infraError: true, timedOut: false, stdout: '', stderr: e instanceof Error ? e.message : String(e), durationMs: 0 };
    }
    const dur = Math.max(0, ahora() - t0);
    usadoMs += dur;
    const categoria = categoriaDePuerta(r);
    const salida = cola([r.stdout, r.stderr].filter(Boolean).join('\n'), SALIDA_PUERTA_MAX);
    /** @type {string|null} */ let motivo = null;
    if (categoria === 'no_ejecutable') motivo = 'la herramienta no está en la imagen (código 127). Sin red no se instala: debe estar en las dependencias del proyecto.';
    else if (categoria === 'timeout') motivo = `superó el tiempo máximo (${Math.round(timeoutMs / 1000)} s)`;
    else if (categoria === 'infra_error') motivo = redactar(String(r.stderr ?? '').trim().split('\n').pop() || 'el entorno de ejecución falló');
    else if (categoria === 'fail') motivo = `terminó con código ${r.exitCode}`;
    resultados.push({
      ...base, categoria, codigoSalida: typeof r.exitCode === 'number' ? r.exitCode : null,
      duracionMs: Math.max(0, Math.round(Number(r.durationMs) || dur)), salida, motivo,
    });
    // El aislamiento falló: las demás fallarían igual; no se insiste
    if (categoria === 'infra_error') corte = 'una puerta anterior falló por infraestructura';
  }
  return { resultados };
}

/**
 * Veredicto que añaden las puertas, o null si todas pasan. Nada que no sea `pass` es éxito.
 * @param {ResultadoPuerta[]} resultados
 * @returns {{ veredicto: 'falla'|'infraestructura', motivo: string } | null}
 */
export function juzgarPuertas(resultados) {
  const malas = resultados.filter((r) => r.categoria !== 'pass');
  if (malas.length === 0) return null;
  const dice = (/** @type {ResultadoPuerta} */ r) => {
    switch (r.categoria) {
      case 'fail': return `«${r.nombre}» falla (código ${r.codigoSalida})`;
      case 'timeout': return `«${r.nombre}» superó el tiempo máximo`;
      case 'no_ejecutable': return `«${r.nombre}» es una puerta no ejecutable: la herramienta no está en la imagen (código 127)`;
      case 'infra_error': return `«${r.nombre}» no pudo ejecutarse por un fallo del aislamiento${r.motivo ? ` (${r.motivo})` : ''}`;
      default: return `«${r.nombre}» no llegó a ejecutarse${r.motivo ? ` (${r.motivo})` : ''}`;
    }
  };
  const veredicto = malas.some((r) => r.categoria === 'infra_error') ? 'infraestructura' : 'falla';
  return {
    veredicto,
    motivo: redactar(`Las pruebas pasan, pero no pasan todas las puertas: ${malas.map(dice).join('; ')}.`),
  };
}
