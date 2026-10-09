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
  try { return fs.readFileSync(path.join(cwd, f), 'utf8').replace(/^﻿/, ''); } catch { return ''; }
}

/** Líneas sin comentarios ni espacios alrededor. @param {string} texto */
const lineas = (texto) => texto.split(/\r?\n/).map((l) => l.replace(/(^|\s)#.*$/, '').trim()).filter(Boolean);

/** ¿Alguna línea de requisito pide el paquete `pytest` (no `pytest-cov`, no `pytest_runner`)? @param {string} texto */
export function requierePytest(texto) {
  return lineas(texto).some((l) => /^pytest(\s*(\[|[<>=!~;@]|$))/i.test(l));
}

/** @param {string} cwd */
export function instalaPytest(cwd) {
  return requierePytest(leer(cwd, 'requirements.txt'));
}

/** @param {string} cwd */
export function usaPytest(cwd) {
  const existe = (f) => fs.existsSync(path.join(cwd, f));
  if (existe('pytest.ini') || existe('conftest.py')) return true;
  if (ARCHIVOS_DE_REQUISITOS.some((f) => requierePytest(leer(cwd, f)))) return true;
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
  return 'El proyecto se prueba con pytest, pero requirements.txt no lo instala: el entorno aislado solo instala '
    + 'lo que declara ese archivo y las pruebas fallarían siempre con «No module named pytest». '
    + 'Añade una línea `pytest` a requirements.txt (crea el archivo si no existe).';
}
