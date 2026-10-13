/**
 * pytest-deteccion.js — ¿Se prueba este proyecto Python con pytest, y lo instalará el entorno aislado?
 *
 * Dos preguntas distintas, que la revisión independiente del 2026-10-09 (hallazgo R1) encontró
 * mezcladas: el detector elegía pytest por una subcadena en seis archivos, pero la imagen del
 * entorno aislado solo instala lo que declara `requirements.txt`. Resultado: se elegía pytest,
 * no estaba instalado y el ciclo gastaba todas las iteraciones en «No module named pytest».
 *
 *  - `usaPytest`: señales de que el proyecto quiere pytest. Se leen líneas reales, no subcadenas:
 *    un comentario «# no usar pytest» o un `exclude = .pytest_cache` no cuentan.
 *  - `instalaPytest`: `requirements.txt` tiene una línea de requisito cuyo paquete es exactamente
 *    `pytest`. Es lo único que garantiza que la imagen lo tendrá.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const ARCHIVOS_DE_REQUISITOS = ['requirements.txt', 'requirements-dev.txt', 'requirements-test.txt', 'dev-requirements.txt'];

/** @param {string} cwd @param {string} f */
function leer(cwd, f) {
  let b;
  try { b = fs.readFileSync(path.join(cwd, f)); } catch { return ''; }
  // `pip freeze > requirements.txt` en PowerShell 5.1 escribe UTF-16 con BOM
  if (b.length >= 2 && b[0] === 0xff && b[1] === 0xfe) return b.subarray(2).toString('utf16le');
  if (b.length >= 2 && b[0] === 0xfe && b[1] === 0xff) return Buffer.from(b.subarray(2)).swap16().toString('utf16le');
  return b.toString('utf8').replace(/^﻿/, '');
}

/** Líneas sin comentarios ni espacios alrededor. @param {string} texto */
const lineas = (texto) => texto.split(/\r?\n/).map((l) => l.replace(/(^|\s)#.*$/, '').trim()).filter(Boolean);

/**
 * ¿Alguna línea de requisito pide pytest, o un plugin que lo trae como dependencia (pytest-cov,
 * pytest-django, pytest-asyncio…)? pytest-runner no: es un complemento de setuptools que no
 * depende de pytest. Un comentario no cuenta.
 * @param {string} texto
 */
export function requierePytest(texto) {
  return lineasRequisitos(texto).some((l) => {
    if (/^pytest[-_.]runner(\s*(\[|[<>=!~;@]|$))/i.test(l)) return false;
    // Un fragmento `#egg=pytest` (enlace VCS o `-e ruta#egg=pytest`) nombra el paquete que se instala
    if (/#egg=pytest(?![-_.]?runner)([-_.][a-z0-9][a-z0-9._-]*)?(\[[^\]]*\])?(?:&|\s|$)/i.test(l)) return true;
    return /^pytest([-_.][a-z0-9][a-z0-9._-]*)?(\s*(\[|[<>=!~;@]|$))/i.test(l);
  });
}

/**
 * Líneas de un archivo de requisitos como las lee pip: una línea que acaba en `\` se une con la
 * siguiente (los comentarios no se unen), luego se quitan comentarios y espacios.
 * @param {string} texto
 */
export function lineasRequisitos(texto) {
  /** @type {string[]} */
  const unidas = [];
  let acumulado = '';
  for (const cruda of texto.split(/\r?\n/)) {
    if (acumulado === '' && /^\s*#/.test(cruda)) continue;
    if (/\\$/.test(cruda)) { acumulado += cruda.slice(0, -1) + ' '; continue; }
    unidas.push(acumulado + cruda);
    acumulado = '';
  }
  if (acumulado) unidas.push(acumulado);
  return unidas.map((l) => l.replace(/(^|\s)#.*$/, '').trim()).filter(Boolean);
}

/** Archivos que un requisito incluye (`-r`, `--requirement`, `-c`, `--constraint`). @param {string} texto */
export function inclusiones(texto) {
  /** @type {{ archivo: string, tipo: 'r'|'c' }[]} */
  const r = [];
  for (const l of lineasRequisitos(texto)) {
    const m = /^(?:-([rc])\s*|--(requirement|constraint)(?:\s+|=))(\S.*)$/.exec(l);
    if (m) r.push({ archivo: m[3].trim().replace(/^["']|["']$/g, ''), tipo: m[1] === 'c' || m[2] === 'constraint' ? 'c' : 'r' });
  }
  return r;
}

const PROFUNDIDAD_MAXIMA = 3;
const TOPE_BYTES = 256 * 1024;

/**
 * Lee un archivo de requisitos y los que incluye con `-r`/`-c`, SOLO dentro del proyecto: sin
 * enlaces simbólicos, sin rutas que salgan de él, sin URL, con tope de profundidad y de tamaño.
 * @param {string} cwd @param {string} archivo @param {number} [profundidad] @param {Set<string>} [vistos]
 * @returns {string[]} textos de cada archivo leído
 */
function leerConInclusiones(cwd, archivo, profundidad = 0, vistos = new Set()) {
  let raiz;
  let rel;
  try {
    raiz = fs.realpathSync(cwd);
    const ruta = path.resolve(raiz, archivo);
    rel = path.relative(raiz, ruta);
    if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return [];
    // sin enlaces: ni el archivo ni ningún directorio del camino
    let actual = raiz;
    for (const parte of rel.split(path.sep)) {
      actual = path.join(actual, parte);
      if (fs.lstatSync(actual).isSymbolicLink()) return [];
    }
    const st = fs.lstatSync(ruta);
    if (!st.isFile() || st.size > TOPE_BYTES) return [];
  } catch { return []; }
  if (vistos.has(rel)) return [];
  vistos.add(rel);
  const texto = leer(raiz, rel);
  const salida = [texto];
  if (profundidad >= PROFUNDIDAD_MAXIMA) return salida;
  for (const { archivo: otro } of inclusiones(texto)) {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(otro)) continue;
    salida.push(...leerConInclusiones(raiz, path.join(path.dirname(rel), otro), profundidad + 1, vistos));
  }
  return salida;
}

/**
 * ¿Instalará la imagen pytest? La imagen del entorno aislado copia SOLO `requirements.txt` y ejecuta
 * `pip install -r requirements.txt` (core/sandbox/preparar-imagen.js): un `-r otro.txt` dentro de él
 * no se resuelve en la imagen (el archivo no se copia). Por eso aquí NO se siguen las inclusiones:
 * pytest tiene que figurar en el propio requirements.txt.
 * @param {string} cwd
 */
export function instalaPytest(cwd) {
  return requierePytest(leer(cwd, 'requirements.txt'));
}

/**
 * Archivos que `requirements.txt` incluye con `-r`/`-c`: la imagen no los copia.
 * @param {string} cwd
 */
export function inclusionesNoResueltas(cwd) {
  return inclusiones(leer(cwd, 'requirements.txt')).map((i) => i.archivo);
}

/** @param {string} cwd */
export function usaPytest(cwd) {
  const existe = (f) => fs.existsSync(path.join(cwd, f));
  if (existe('pytest.ini') || existe('conftest.py')) return true;
  // Se siguen `-r`/`-c` dentro del proyecto (con tope de profundidad y sin enlaces)
  if (ARCHIVOS_DE_REQUISITOS.some((f) => leerConInclusiones(cwd, f).some(requierePytest))) return true;
  if (lineas(leer(cwd, 'setup.cfg')).some((l) => /^\[tool:pytest\]$/i.test(l))) return true;
  if (lineas(leer(cwd, 'tox.ini')).some((l) => /^\[pytest\]$/i.test(l))) return true;
  // pyproject.toml: una sección de configuración de pytest o una dependencia llamada pytest
  return lineas(leer(cwd, 'pyproject.toml')).some((l) => /^\[tool\.pytest\b/i.test(l) || /^["']?pytest(["'\s<>=!~\[,]|$)/i.test(l) || /^pytest\s*=/.test(l));
}

/**
 * Motivo por el que el ciclo no debe empezar, o null. Se comprueba antes de gastar.
 * @param {string} cwd
 * @param {string} [testCmd]
 */
export function problemaConPytest(cwd, testCmd = '') {
  if (!/pytest/.test(testCmd) || instalaPytest(cwd)) return null;
  const incluidos = inclusionesNoResueltas(cwd);
  if (incluidos.length > 0) {
    return 'El proyecto se prueba con pytest, pero requirements.txt no lo instala directamente y la imagen del entorno '
      + `aislado solo copia requirements.txt: ${incluidos.map((a) => `«${a}»`).join(', ')} (incluido con -r/-c) no se resuelve en la imagen, `
      + 'así que pytest no llegará (y pip fallaría al construirla). Escribe las dependencias, incluida una línea `pytest`, en el propio requirements.txt.';
  }
  return 'El proyecto se prueba con pytest, pero requirements.txt no lo instala: el entorno aislado solo instala '
    + 'lo que declara ese archivo y las pruebas fallarían siempre con «No module named pytest». '
    + 'Añade una línea `pytest` a requirements.txt (crea el archivo si no existe).';
}
