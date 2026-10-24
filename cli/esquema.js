/**
 * cli/esquema.js — `fragua esquema [nombre]`: muestra los esquemas del contrato público (solo lectura).
 *
 * Sin nombre lista los esquemas y su versión; con nombre imprime el esquema en JSON. Lee `docs/contrato/` del
 * paquete (va en `files` de package.json), no el proyecto: un repositorio ajeno no puede cambiar lo que se muestra.
 * Spec 2026-10-14-contrato-publico, CA-001-07.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'contrato');
const SUFIJO = '.schema.json';
const NOMBRE_VALIDO = /^[a-z][a-z0-9-]*$/;

/** @returns {{ nombre: string, id: string }[]} */
function listar() {
  return fs.readdirSync(DIR).filter((f) => f.endsWith(SUFIJO)).sort().map((f) => {
    const nombre = f.slice(0, -SUFIJO.length);
    const id = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')).$id ?? '';
    return { nombre, id };
  });
}

/**
 * @param {string[]} argv  argumentos tras `esquema`
 * @param {{ salida?: (t: string) => void, errores?: (t: string) => void }} [deps]
 * @returns {number} código de salida
 */
export function cmdEsquema(argv, deps = {}) {
  const salida = deps.salida ?? ((t) => process.stdout.write(t + '\n'));
  const errores = deps.errores ?? ((t) => process.stderr.write(t + '\n'));
  if (argv.length > 1) { errores('✗ Uso: fragua esquema [nombre]'); return 1; }
  const todos = listar();
  if (argv.length === 0) {
    salida(todos.map((e) => `${e.nombre.padEnd(22)} ${e.id}`).join('\n'));
    return 0;
  }
  const [nombre] = argv;
  // La lista cerrada manda: el nombre nunca forma una ruta
  if (!NOMBRE_VALIDO.test(nombre) || !todos.some((e) => e.nombre === nombre)) {
    errores(`✗ Esquema desconocido: ${JSON.stringify(nombre)}. Los que existen: ${todos.map((e) => e.nombre).join(', ')}.`);
    return 1;
  }
  salida(fs.readFileSync(path.join(DIR, nombre + SUFIJO), 'utf8').trimEnd());
  return 0;
}
