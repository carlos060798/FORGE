#!/usr/bin/env node
/**
 * Ejecuta la suite completa, solo la rápida o solo la lenta.
 *
 *   node scripts/pruebas.mjs [todo|rapido|lento] [opciones de node --test…]
 *
 * Los archivos lentos se listan en tests/lentos.txt; `todo` equivale a `npm test`.
 * No se mueve ningún archivo: las especificaciones citan las pruebas por su ruta.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Las mismas carpetas que el script `test` de package.json. */
const CARPETAS = ['tests', 'tests/e2e', 'tests/evals', '__tests__'];

/**
 * @param {string} raiz
 * @returns {{ todos: string[], lentos: string[], rapidos: string[], sobrantes: string[] }}
 *   `sobrantes`: entradas de tests/lentos.txt que no corresponden a ningún archivo.
 */
export function clasificar(raiz) {
  /** @type {string[]} */
  const todos = [];
  for (const carpeta of CARPETAS) {
    const dir = join(raiz, carpeta);
    if (!existsSync(dir)) continue;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isFile() && e.name.endsWith('.test.js')) todos.push(`${carpeta}/${e.name}`);
    }
  }
  todos.sort();

  const lista = join(raiz, 'tests', 'lentos.txt');
  const declarados = existsSync(lista)
    ? readFileSync(lista, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
    : [];
  const existentes = new Set(todos);
  const lentos = declarados.filter((a) => existentes.has(a));
  const sobrantes = declarados.filter((a) => !existentes.has(a));
  const esLento = new Set(lentos);
  const rapidos = todos.filter((a) => !esLento.has(a));
  return { todos, lentos, rapidos, sobrantes };
}

function main() {
  const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const [modo = 'todo', ...extra] = process.argv.slice(2);
  if (!['todo', 'rapido', 'lento'].includes(modo)) {
    console.error(`Modo desconocido «${modo}». Usa: todo, rapido o lento.`);
    process.exit(2);
  }
  const { todos, lentos, rapidos, sobrantes } = clasificar(raiz);
  if (sobrantes.length) {
    console.error(`tests/lentos.txt nombra archivos que no existen: ${sobrantes.join(', ')}`);
    process.exit(2);
  }
  const archivos = modo === 'rapido' ? rapidos : modo === 'lento' ? lentos : todos;
  console.log(`[pruebas] modo ${modo}: ${archivos.length} archivos (${rapidos.length} rápidos, ${lentos.length} lentos)`);
  const r = spawnSync(process.execPath, ['--test', ...extra, ...archivos], { cwd: raiz, stdio: 'inherit' });
  process.exit(r.status ?? 1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
