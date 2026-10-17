/**
 * puertas/config.js — lector ESTRICTO de la sección `puertas:` de `.sdd/sdd.config.yaml`
 *
 * Spec 2026-10-14-puertas-de-calidad-y-evidencia, fase B1 (spikes/configuracion-protegida.md y
 * spikes/varias-ejecuciones.md). El lector plano de `core/ciclo/config.js` tiene tres defectos que aquí no
 * se pueden permitir, porque el archivo lo escribe el proyecto (a veces ajeno) y decide un veredicto:
 *
 *  1. una clave desconocida se ignora SIN error  -> aquí es un error con su línea;
 *  2. un `#` pegado a texto trunca el valor en silencio (`--config a#b` -> `--config a`) -> aquí es un error,
 *     salvo que el valor entero vaya entre comillas;
 *  3. la comilla final se pierde (`tsc -p "a b"` -> `tsc -p "a b`)  -> aquí las comillas se quitan solo si
 *     envuelven TODO el valor.
 *
 * Reglas de diseño (Principio V: solo se aprieta):
 *  - El proyecto solo AÑADE exigencias: una clave por comando (`tipos`, `linter`, `seguridad`, `cobertura`).
 *    No existe clave para quitar, relajar o sustituir las pruebas, el aislamiento sin red, el rojo
 *    obligatorio, la redacción ni el tope de gasto; cualquier otra clave es un error.
 *  - Los topes de tiempo y de salida de cada puerta salen del ENTORNO del usuario (con techo); el proyecto
 *    solo puede BAJARLOS (si pide más, se ignora y se avisa).
 *  - El comando no pasa por un intérprete de órdenes: `dividirComando` (sin `&&`, `|`, `;`, redirecciones) y,
 *    además, un intérprete como primera palabra (`sh -c "a && b"`) se rechaza, porque la comilla lo
 *    colaría por la regla anterior.
 *  - Límite al número de puertas: `MAX_PUERTAS` (una por clave).
 *
 * `cobertura_minima` (spec CA-001-01) no existe en esta fase: no hay forma genérica de pasar un umbral a
 * cualquier herramienta, así que el umbral va dentro del comando de `cobertura` (spike varias-ejecuciones).
 */

import { existsSync, readFileSync, lstatSync } from 'node:fs';
import { join, basename } from 'node:path';
import { dividirComando } from '../sandbox/sandbox-runner.js';
import { leerVariableRestrictiva } from '../entorno.js';

/** Claves con un comando, en el ORDEN FIJO en que se ejecutan. */
export const CLAVES_PUERTAS = Object.freeze(['tipos', 'linter', 'seguridad', 'cobertura']);
/** Claves de tope que el proyecto solo puede bajar. */
export const CLAVES_TOPES = Object.freeze(['timeout_s', 'timeout_total_s', 'salida_max_bytes']);
/** Límite al número de puertas. */
export const MAX_PUERTAS = CLAVES_PUERTAS.length;

/** Techo absoluto de cada tope: ni el entorno del usuario lo supera. */
export const TECHOS_PUERTAS = Object.freeze({ timeout_s: 600, timeout_total_s: 900, salida_max_bytes: 1048576 });
/** Valor sin declarar nada. */
export const DEFECTOS_PUERTAS = Object.freeze({ timeout_s: 120, timeout_total_s: 300, salida_max_bytes: 262144 });

/** Sufijo de la variable del usuario (FRAGUA_/FORGE_ + sufijo) de cada tope. */
const VARIABLES = Object.freeze({ timeout_s: 'PUERTAS_TIMEOUT_S', timeout_total_s: 'PUERTAS_TIMEOUT_TOTAL_S', salida_max_bytes: 'PUERTAS_SALIDA_MAX_BYTES' });

const INTERPRETES = new Set(['sh', 'bash', 'zsh', 'dash', 'ash', 'ksh', 'fish', 'csh', 'tcsh', 'cmd', 'powershell', 'pwsh', 'busybox']);
export const ARCHIVO_CONFIG = '.sdd/sdd.config.yaml';

/**
 * @typedef {{ nombre: string, comando: string }} Puerta
 * @typedef {{ timeout_s: number, timeout_total_s: number, salida_max_bytes: number }} TopesPuertas
 * @typedef {{ ok: true, declarada: boolean, puertas: Puerta[], topes: TopesPuertas, avisos: string[] }
 *   | { ok: false, errores: string[] }} LecturaPuertas
 */

/**
 * @param {string} crudo  lo que sigue a «clave:»
 * @returns {{ valor: string } | { error: string }}
 */
function valorDe(crudo) {
  const v = crudo.trim();
  if (v === '') return { error: 'no tiene valor' };
  const q = v[0];
  if (q === '"' || q === "'") {
    const fin = v.indexOf(q, 1);
    // Entre comillas el valor ENTERO (con o sin comentario detrás): se quitan solo esas dos
    if (fin !== -1 && /^(?:\s+#.*)?\s*$/.test(v.slice(fin + 1))) return { valor: v.slice(1, fin) };
    // Si la comilla cierra a mitad, es el argumento entrecomillado de un comando sin comillas de valor
  }
  const c = /\s#/.exec(v);
  const cuerpo = (c ? v.slice(0, c.index) : v).trim();
  if (cuerpo.includes('#')) {
    return { error: 'lleva un «#» pegado al texto: el lector lo truncaría en silencio. Separa el comentario con un espacio o pon el valor ENTERO entre comillas' };
  }
  if (cuerpo === '') return { error: 'no tiene valor' };
  return { valor: cuerpo };
}

/** @param {string} comando @returns {string|null} motivo de rechazo */
function motivoDeRechazo(comando) {
  let partes;
  try { partes = dividirComando(comando); } catch (e) { return e instanceof Error ? e.message : String(e); }
  if (partes[0] === 'npx') { partes.shift(); while (partes[0]?.startsWith('-')) partes.shift(); }
  if (partes.length === 0) return 'no hay comando';
  const programa = basename(partes[0].replace(/\\/g, '/')).toLowerCase().replace(/\.exe$/, '');
  if (INTERPRETES.has(programa)) return `usa «${partes[0]}», un intérprete de órdenes: una puerta ejecuta una herramienta, no un intérprete (con él se podría colar un encadenado entre comillas)`;
  return null;
}

/**
 * Lee la sección `puertas:` de un YAML ya cargado.
 * @param {string} yaml
 * @param {{ env?: Record<string, string|undefined> }} [o]
 * @returns {LecturaPuertas}
 */
export function leerPuertasDeYaml(yaml, o = {}) {
  const env = o.env ?? process.env;
  /** @type {string[]} */ const errores = [];
  /** @type {string[]} */ const avisos = [];
  const lineas = String(yaml ?? '').split(/\r?\n/);
  const en = (/** @type {number} */ i, /** @type {string} */ m) => `${ARCHIVO_CONFIG}, línea ${i + 1}: ${m}`;

  /** @type {Map<string, string>} */ const comandos = new Map();
  /** @type {Map<string, number>} */ const topesProyecto = new Map();
  let dentro = false;
  let secciones = 0;

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];
    const cabecera = /^puertas\s*:(.*)$/.exec(linea);
    if (cabecera) {
      secciones++;
      if (secciones > 1) { errores.push(en(i, 'la sección «puertas:» aparece más de una vez (dos veces o más)')); }
      const resto = cabecera[1].trim();
      if (resto !== '' && !resto.startsWith('#')) errores.push(en(i, 'la sección «puertas:» no admite un valor en la misma línea: pon una clave por línea, con dos espacios de sangría'));
      dentro = true;
      continue;
    }
    if (!dentro) continue;
    if (/^\S/.test(linea) && !linea.startsWith('#')) { dentro = false; continue; }
    if (linea.trim() === '' || /^\s*#/.test(linea)) continue;

    const m = /^([ \t]*)([\w.-]+)\s*:(.*)$/.exec(linea);
    if (!m) {
      errores.push(en(i, `línea no válida dentro de «puertas:» («${linea.trim().slice(0, 60)}»): se espera «clave: valor» con dos espacios de sangría`));
      continue;
    }
    if (m[1] !== '  ') {
      errores.push(en(i, `la clave «${m[2]}» tiene una sangría que no se admite: usa exactamente 2 espacios (con otra sangría se ignoraría sin avisar)`));
      continue;
    }
    const clave = m[2];
    const esComando = CLAVES_PUERTAS.includes(clave);
    const esTope = CLAVES_TOPES.includes(clave);
    if (!esComando && !esTope) {
      const extra = clave === 'cobertura_minima' ? ' El umbral mínimo de cobertura va dentro del comando de «cobertura» (la herramienta lo hace cumplir); no hay clave aparte.' : '';
      errores.push(en(i, `clave desconocida «${clave}» en «puertas:». Admitidas: ${CLAVES_PUERTAS.join(', ')} (un comando cada una) y ${CLAVES_TOPES.join(', ')} (solo para bajar un tope). Una puerta solo añade exigencias: no hay clave para quitar o aflojar las pruebas ni el aislamiento.${extra}`));
      continue;
    }
    if ((esComando && comandos.has(clave)) || (esTope && topesProyecto.has(clave))) {
      errores.push(en(i, `la clave «${clave}» aparece dos veces`));
      continue;
    }
    const v = valorDe(m[3]);
    if ('error' in v) {
      errores.push(en(i, v.error === 'no tiene valor' ? `«${clave}» sin ${esComando ? 'comando' : 'valor'}: no tiene valor` : `«${clave}» ${v.error}`));
      if (esComando) comandos.set(clave, '');
      else topesProyecto.set(clave, 0);
      continue;
    }
    if (esTope) {
      if (!/^\d+$/.test(v.valor) || Number(v.valor) < 1 || !Number.isSafeInteger(Number(v.valor))) {
        errores.push(en(i, `«${clave}» no es válido: «${v.valor}». Debe ser un entero ≥ 1`));
        topesProyecto.set(clave, 0);
      } else topesProyecto.set(clave, Number(v.valor));
      continue;
    }
    const rechazo = motivoDeRechazo(v.valor);
    if (rechazo) errores.push(en(i, `el comando de «${clave}» no se admite: ${rechazo}`));
    comandos.set(clave, v.valor);
  }

  if (errores.length > 0) return { ok: false, errores };

  // Topes: el entorno del usuario fija el valor (con techo); el proyecto solo puede bajarlo
  /** @type {any} */ const topes = {};
  for (const k of CLAVES_TOPES) {
    const techo = /** @type {any} */ (TECHOS_PUERTAS)[k];
    let valor = /** @type {any} */ (DEFECTOS_PUERTAS)[k];
    const delUsuario = leerVariableRestrictiva(/** @type {any} */ (VARIABLES)[k], env, undefined);
    if (delUsuario !== undefined && String(delUsuario).trim() !== '') {
      const t = String(delUsuario).trim();
      if (/^\d+$/.test(t) && Number(t) >= 1) valor = Math.min(Number(t), techo);
      else avisos.push(`La variable FRAGUA_${/** @type {any} */ (VARIABLES)[k]} («${t.slice(0, 40)}») no es un entero ≥ 1: se ignora.`);
    }
    const pedido = topesProyecto.get(k);
    if (pedido !== undefined) {
      if (pedido > valor) avisos.push(`${ARCHIVO_CONFIG} pide puertas.${k} = ${pedido}, por encima de ${valor}: se ignora. Un archivo del proyecto no puede subir un tope de las puertas (solo bajarlo); si es tu proyecto, define FRAGUA_${/** @type {any} */ (VARIABLES)[k]} en tu entorno.`);
      else valor = pedido;
    }
    topes[k] = valor;
  }

  /** @type {Puerta[]} */
  const puertas = CLAVES_PUERTAS.filter((k) => comandos.has(k)).map((k) => ({ nombre: k, comando: /** @type {string} */ (comandos.get(k)) }));
  if (puertas.length > MAX_PUERTAS) return { ok: false, errores: [`${ARCHIVO_CONFIG}: hay ${puertas.length} puertas y el límite es ${MAX_PUERTAS}.`] };
  return { ok: true, declarada: puertas.length > 0, puertas, topes: /** @type {TopesPuertas} */ (topes), avisos };
}

/**
 * Lee `puertas:` de `<cwd>/.sdd/sdd.config.yaml`. Sin archivo, no hay puertas.
 * @param {string} cwd
 * @param {{ env?: Record<string, string|undefined> }} [o]
 * @returns {LecturaPuertas}
 */
export function leerPuertas(cwd, o = {}) {
  const ruta = join(cwd, '.sdd', 'sdd.config.yaml');
  if (!existsSync(ruta)) return leerPuertasDeYaml('', o);
  try {
    if (!lstatSync(ruta).isFile()) return { ok: false, errores: [`${ARCHIVO_CONFIG} no es un archivo normal: no se lee.`] };
    return leerPuertasDeYaml(readFileSync(ruta, 'utf8'), o);
  } catch (e) {
    return { ok: false, errores: [`No se pudo leer ${ARCHIVO_CONFIG}: ${e instanceof Error ? e.message : String(e)}`] };
  }
}
