#!/usr/bin/env node
/**
 * Ejecuta la suite completa, solo la rápida, solo la lenta o solo la cuarentena.
 *
 *   node scripts/pruebas.mjs [todo|rapido|lento|cuarentena] [opciones de node --test…]
 *
 * Los archivos lentos se listan en tests/lentos.txt; `todo` es lo que ejecuta `npm test`.
 * Los archivos en cuarentena (tests/cuarentena.txt; spec 2026-11-09-ci-verde-y-cuarentena, ADR-23) se
 * EXCLUYEN de todo, rapido y lento, y solo corren con el modo `cuarentena` (job de CI no bloqueante).
 * Cada entrada de cuarentena lleva incidencia, fecha y motivo; caduca a los DIAS_CADUCIDAD días; hay un tope.
 * No se mueve ningún archivo: las especificaciones citan las pruebas por su ruta.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Las carpetas de la suite (antes, los globs del script `test` de package.json). */
const CARPETAS = ['tests', 'tests/e2e', 'tests/evals', '__tests__'];

export const MODOS = Object.freeze(['todo', 'rapido', 'lento', 'cuarentena']);
/** Días que una entrada de cuarentena vale antes de tener que renovarse (CA-001-04). */
export const DIAS_CADUCIDAD = 30;
/** Entradas simultáneas como mucho (CA-001-05). */
export const MAX_CUARENTENA = 5;

/**
 * @typedef {{ archivo: string, incidencia: string, fecha: string, motivo: string, linea: number }} EntradaCuarentena
 */

/**
 * Lee el texto de tests/cuarentena.txt. Formato por línea: `ruta | #incidencia | AAAA-MM-DD | motivo`.
 * Comentarios con `#` al principio y líneas vacías se ignoran. No toca el disco.
 * @param {string} texto
 * @param {Date} [hoy]
 * @returns {{ entradas: EntradaCuarentena[], errores: string[] }}
 */
export function parsearCuarentena(texto, hoy = new Date()) {
  /** @type {EntradaCuarentena[]} */
  const entradas = [];
  /** @type {string[]} */
  const errores = [];
  const vistas = new Set();
  const lineas = texto.split(/\r?\n/);
  for (let i = 0; i < lineas.length; i++) {
    const cruda = lineas[i].trim();
    if (!cruda || cruda.startsWith('#')) continue;
    const n = i + 1;
    const campos = cruda.split('|').map((c) => c.trim());
    if (campos.length !== 4) {
      errores.push(`línea ${n}: hacen falta 4 campos separados por «|» (ruta | #incidencia | AAAA-MM-DD | motivo), hay ${campos.length}`);
      continue;
    }
    const [archivo, incidencia, fecha, motivo] = campos;
    if (!/^#\d+$/.test(incidencia)) { errores.push(`línea ${n}: la incidencia debe ser «#» y dígitos (ej. #12), no «${incidencia}»`); continue; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(Date.parse(`${fecha}T00:00:00Z`)) || new Date(`${fecha}T00:00:00Z`).toISOString().slice(0, 10) !== fecha) {
      errores.push(`línea ${n}: la fecha debe ser AAAA-MM-DD válida, no «${fecha}»`); continue;
    }
    if (!motivo) { errores.push(`línea ${n}: falta el motivo`); continue; }
    if (vistas.has(archivo)) { errores.push(`línea ${n}: ${archivo} está repetido`); continue; }
    const dias = Math.floor((Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()) - Date.parse(`${fecha}T00:00:00Z`)) / 86_400_000);
    if (dias < 0) { errores.push(`línea ${n}: la fecha ${fecha} de ${archivo} es futura`); continue; }
    if (dias > DIAS_CADUCIDAD) { errores.push(`línea ${n}: ${archivo} entró en cuarentena el ${fecha}, hace ${dias} días: caducada (máximo ${DIAS_CADUCIDAD}); renueva la fecha tras revisar la incidencia ${incidencia}, o sácala`); continue; }
    vistas.add(archivo);
    entradas.push({ archivo, incidencia, fecha, motivo, linea: n });
  }
  if (entradas.length > MAX_CUARENTENA) errores.push(`hay ${entradas.length} pruebas en cuarentena y el tope (máximo) es ${MAX_CUARENTENA}: arregla alguna antes de apartar otra`);
  return { entradas, errores };
}

/**
 * Código de salida cuando la lista a ejecutar queda vacía. Solo la cuarentena puede estar vacía (hoy lo está).
 * En los demás modos una lista vacía significa que el descubrimiento falló (carpeta renombrada, directorio de
 * trabajo distinto): salir con 0 dejaría `npm test` y la CI en verde sin ejecutar nada.
 * @param {string} modo
 * @returns {0|1}
 */
export function codigoSiNadaQueEjecutar(modo) {
  return modo === 'cuarentena' ? 0 : 1;
}

/**
 * @param {string} raiz
 * @param {Date} [hoy]
 * @returns {{ todos: string[], lentos: string[], rapidos: string[], cuarentena: string[], sobrantes: string[], sobrantesCuarentena: string[], erroresCuarentena: string[] }}
 *   `todos`, `lentos` y `rapidos` YA excluyen la cuarentena. `sobrantes`: entradas de tests/lentos.txt que no
 *   corresponden a ningún archivo; `sobrantesCuarentena`: lo mismo para tests/cuarentena.txt.
 */
export function clasificar(raiz, hoy = new Date()) {
  /** @type {string[]} */
  const descubiertos = [];
  for (const carpeta of CARPETAS) {
    const dir = join(raiz, carpeta);
    if (!existsSync(dir)) continue;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isFile() && e.name.endsWith('.test.js')) descubiertos.push(`${carpeta}/${e.name}`);
    }
  }
  descubiertos.sort();
  const existentes = new Set(descubiertos);

  const rutaCuarentena = join(raiz, 'tests', 'cuarentena.txt');
  const { entradas, errores: erroresCuarentena } = existsSync(rutaCuarentena) ? parsearCuarentena(readFileSync(rutaCuarentena, 'utf8'), hoy) : { entradas: [], errores: [] };
  const cuarentena = entradas.map((e) => e.archivo).filter((a) => existentes.has(a));
  const sobrantesCuarentena = entradas.map((e) => e.archivo).filter((a) => !existentes.has(a));
  const enCuarentena = new Set(cuarentena);
  const todos = descubiertos.filter((a) => !enCuarentena.has(a));

  const lista = join(raiz, 'tests', 'lentos.txt');
  const declarados = existsSync(lista)
    ? readFileSync(lista, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
    : [];
  const lentos = declarados.filter((a) => existentes.has(a) && !enCuarentena.has(a));
  const sobrantes = declarados.filter((a) => !existentes.has(a));
  const esLento = new Set(lentos);
  const rapidos = todos.filter((a) => !esLento.has(a));
  return { todos, lentos, rapidos, cuarentena, sobrantes, sobrantesCuarentena, erroresCuarentena };
}

function main() {
  const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const [modo = 'todo', ...extra] = process.argv.slice(2);
  if (!MODOS.includes(modo)) {
    console.error(`Modo desconocido «${modo}». Usa: ${MODOS.join(', ')}.`);
    process.exit(2);
  }
  const { todos, lentos, rapidos, cuarentena, sobrantes, sobrantesCuarentena, erroresCuarentena } = clasificar(raiz);
  if (sobrantes.length) {
    console.error(`tests/lentos.txt nombra archivos que no existen: ${sobrantes.join(', ')}`);
    process.exit(2);
  }
  if (sobrantesCuarentena.length) {
    console.error(`tests/cuarentena.txt nombra archivos que no existen: ${sobrantesCuarentena.join(', ')}`);
    process.exit(2);
  }
  if (erroresCuarentena.length) {
    console.error(`tests/cuarentena.txt tiene errores:\n  ${erroresCuarentena.join('\n  ')}`);
    process.exit(2);
  }
  const archivos = modo === 'rapido' ? rapidos : modo === 'lento' ? lentos : modo === 'cuarentena' ? cuarentena : todos;
  console.log(`[pruebas] modo ${modo}: ${archivos.length} archivos (${rapidos.length} rápidos, ${lentos.length} lentos, ${cuarentena.length} en cuarentena)`);
  if (archivos.length === 0) {
    const codigo = codigoSiNadaQueEjecutar(modo);
    (codigo === 0 ? console.log : console.error)(`[pruebas] nada que ejecutar en el modo ${modo}${codigo === 0 ? '.' : ': el descubrimiento no encontró ningún archivo de prueba (¿carpeta renombrada o directorio de trabajo distinto?)'}`);
    process.exit(codigo);
  }
  const r = spawnSync(process.execPath, ['--test', ...extra, ...archivos], { cwd: raiz, stdio: 'inherit' });
  process.exit(r.status ?? 1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
