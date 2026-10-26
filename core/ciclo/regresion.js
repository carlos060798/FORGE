// @ts-check
/**
 * regresion.js — «Lo que no debe cambiar» (spec 2026-10-14-puertas-de-calidad-y-evidencia, HU-006, fase F7).
 *
 * Una tarea puede declarar `no_cambiar`: pruebas que ya existen y deben pasar ANTES y DESPUÉS del cambio.
 *  - Antes de implementar se ejecutan en el contenedor; si ya fallan, la tarea pide revisión humana (CA-006-02).
 *  - Tras implementar se vuelven a ejecutar; si alguna falla, la ejecución es `fail` con motivo «regresión» (CA-006-03).
 *  - Esos archivos son inmutables para el implementador, como las pruebas de la tarea (CA-006-04).
 *  - Una declaración vacía o con rutas inexistentes se rechaza con un mensaje claro (CA-006-05).
 *
 * Solo se admiten rutas de archivos de prueba existentes dentro del proyecto, con caracteres seguros: la ruta se
 * añade al comando de pruebas del proyecto, así que nada que el repositorio escriba aquí puede ser un comando.
 * El veredicto lo decide el código de salida, no el texto (Principio VI).
 */

import * as fs from 'fs';
import * as path from 'path';
import { categoriaDePuerta, clonar } from '../puertas/ejecutar.js';
import { cola, redactar } from './redactar.js';
import { canonica, esRutaDePrueba, validarRuta } from './protocolo-archivos.js';
import { dividirComando } from '../sandbox/sandbox-runner.js';

export const MAX_NO_CAMBIAR = 20;
const RUTA_SEGURA = /^[A-Za-z0-9_][A-Za-z0-9_./-]{0,199}$/;
/** Una declaración de prueba reconocible en JS/TS, Python, Go o Java. */
const RE_PRUEBA_DECLARADA = /(?:^|[^\w.])(?:test|it|describe|suite)(?:\.\w+)*\s*\(|^\s*(?:async\s+)?def\s+test_|^\s*func\s+Test\w*\s*\(|@Test\b/m;
/** Banderas que hacen que un ejecutor salga con 0 sin haber ejecutado ninguna prueba. */
const BANDERAS_VACIAS = /^--(?:passWithNoTests|pass-with-no-tests|no-error-on-unmatched-pattern|allow-empty|allowEmpty)$/;
export const NOMBRE_REGRESION = 'regresion';
const SALIDA_MAX = 8192;

/**
 * @param {string} cwd
 * @param {unknown} lista  valor de `no_cambiar` tal como lo declara la tarea
 * @returns {{ ok: true, rutas: string[] } | { ok: false, error: string }}
 */
export function validarNoCambiar(cwd, lista) {
  if (!Array.isArray(lista) || lista.length === 0) {
    return { ok: false, error: 'no_cambiar debe ser una lista de textos con al menos un archivo de prueba existente; una declaración vacía o que no es una lista de textos no se acepta en silencio.' };
  }
  if (lista.length > MAX_NO_CAMBIAR) return { ok: false, error: `no_cambiar admite como máximo ${MAX_NO_CAMBIAR} archivos (hay ${lista.length}).` };
  /** @type {string[]} */ const rutas = [];
  for (const r of lista) {
    if (typeof r !== 'string' || !RUTA_SEGURA.test(r) || r.split('/').includes('..')) {
      return { ok: false, error: `no_cambiar: «${redactar(String(r)).slice(0, 80)}» no es una ruta relativa válida (solo letras, cifras, «_», «.», «-» y «/»).` };
    }
    const v = validarRuta(cwd, r);
    if (v.ok === false) return { ok: false, error: `no_cambiar: «${r}» no es una ruta permitida (${v.motivo}).` };
    let esArchivo = false;
    try { esArchivo = fs.statSync(v.absoluta).isFile(); } catch { /* no existe */ }
    if (!esArchivo) return { ok: false, error: `no_cambiar: «${r}» no existe en el proyecto.` };
    if (!esRutaDePrueba(v.rutaPosix)) return { ok: false, error: `no_cambiar: «${r}» no es un archivo de prueba.` };
    // Una ruta que pasa por un enlace dentro del proyecto sería un alias: el implementador podría escribir el destino real
    try {
      const real = path.relative(fs.realpathSync(cwd), fs.realpathSync(v.absoluta)).split(path.sep).join('/');
      if (canonica(real) !== canonica(v.rutaPosix)) return { ok: false, error: `no_cambiar: «${r}» pasa por un enlace (apunta a «${real}»); declara la ruta real.` };
    } catch { return { ok: false, error: `no_cambiar: «${r}» no se pudo resolver.` }; }
    // Un archivo sin ninguna prueba reconocible sale con 0 sin comprobar nada: no vale como línea base
    let texto = '';
    try { if (fs.statSync(v.absoluta).size <= 1024 * 1024) texto = fs.readFileSync(v.absoluta, 'utf8'); } catch { /* ilegible */ }
    if (!RE_PRUEBA_DECLARADA.test(texto)) return { ok: false, error: `no_cambiar: «${r}» no contiene ninguna prueba reconocible (test(), it(), def test_…, func Test…): no comprobaría nada.` };
    if (!rutas.includes(v.rutaPosix)) rutas.push(v.rutaPosix);
  }
  return { ok: true, rutas };
}

/**
 * El comando de pruebas del proyecto con las rutas añadidas. Con `npm`, `pnpm` o `yarn` las rutas van tras `--`, para que
 * lleguen al ejecutor y no al gestor de paquetes. Los operadores de shell los rechaza `dividirComando`, como en el ciclo.
 * @param {string} testCmd @param {string[]} rutas
 * @returns {string}
 */
export function comandoConArchivos(testCmd, rutas) {
  const partes = dividirComando(testCmd);
  // Se vuelve a serializar a texto: una parte vacía desaparecería y la siguiente se comería la ruta (`-k ''`)
  if (partes.some((p) => p === '')) throw new Error('El comando de pruebas tiene un argumento vacío: no se puede añadir de forma segura la lista de no_cambiar.');
  const vacia = partes.find((p) => BANDERAS_VACIAS.test(p));
  if (vacia) throw new Error(`El comando de pruebas lleva ${vacia}: con esa bandera salir con 0 no prueba que se ejecutara nada, así que no vale para no_cambiar.`);
  if (['npm', 'pnpm', 'yarn'].includes(partes[0]) && !partes.includes('--')) partes.push('--');
  return [...partes, ...rutas].map((p) => (/\s/.test(p) ? `"${p}"` : p)).join(' ');
}

/**
 * Ejecuta las pruebas declaradas en el mismo contenedor sin red que las pruebas de la tarea (un clon del ejecutor que
 * solo cambia el comando). Nunca lanza: un fallo del entorno es `infra_error`.
 * @param {{ runner: any, cwd: string, testCmd: string, rutas: string[], fase: 'base'|'regresion' }} o
 * @returns {Promise<{ nombre: string, categoria: string, exitCode: number|null, salida: string, rutas: string[] }>}
 */
export async function ejecutarNoCambiar(o) {
  /** @type {any} */ let r;
  try {
    const comando = comandoConArchivos(o.testCmd, o.rutas);
    const timeoutMs = Number(o.runner?.o?.timeoutMs) || 120_000;
    const clon = clonar(o.runner, comando, `${NOMBRE_REGRESION}-${o.fase}`, timeoutMs, SALIDA_MAX);
    r = await clon.test(o.cwd);
    if (Array.isArray(clon.copiasSinBorrar) && clon.copiasSinBorrar.length > 0 && Array.isArray(o.runner.copiasSinBorrar)) o.runner.copiasSinBorrar.push(...clon.copiasSinBorrar);
  } catch (e) {
    r = { exitCode: null, infraError: true, timedOut: false, stdout: '', stderr: e instanceof Error ? e.message : String(e) };
  }
  // Como en las puertas: 127 (herramienta ausente) es `no_ejecutable` y pide revisión; cualquier otro código distinto de 0 no es éxito
  const categoria = categoriaDePuerta(r);
  const salida = cola([r.stdout, r.stderr].filter(Boolean).join('\n'), SALIDA_MAX);
  return { nombre: NOMBRE_REGRESION, categoria, exitCode: typeof r.exitCode === 'number' ? r.exitCode : null, salida, rutas: o.rutas };
}

/**
 * Texto de lo que se rompió, para quien implementa (regresión) o quien revisa (línea base).
 * @param {{ categoria: string, exitCode: number|null, salida: string, rutas: string[] }} r
 * @param {'base'|'regresion'} fase
 */
export function textoDeRegresion(r, fase) {
  const cabecera = fase === 'base'
    ? `Antes de implementar, las pruebas de no_cambiar ya no pasan (${r.categoria}${r.exitCode !== null ? `, código ${r.exitCode}` : ''}). No se parte de una línea base verde.`
    : `Regresión: tras el cambio, las pruebas de no_cambiar no pasan (${r.categoria}${r.exitCode !== null ? `, código ${r.exitCode}` : ''}).`;
  return `${cabecera}\nArchivos declarados: ${r.rutas.join(', ')}\n${r.salida}`.trim();
}
