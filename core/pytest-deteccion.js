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
  return lineas(texto).some((l) => {
    if (/^pytest[-_.]runner(\s*(\[|[<>=!~;@]|$))/i.test(l)) return false;
    return /^pytest([-_.][a-z0-9][a-z0-9._-]*)?(\s*(\[|[<>=!~;@]|$))/i.test(l);
  });
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
