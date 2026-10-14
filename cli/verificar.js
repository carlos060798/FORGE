/**
 * cli/verificar.js — `forge verificar [--cwd <dir>] [--comando "<pruebas>"] [--json]`
 *
 * Códigos de salida (los de `forge run`): 0 pasa · 1 falla o cero pruebas · 4 sin Docker o infraestructura.
 * No existe ninguna opción para ejecutar sin aislamiento. No llama a ningún modelo.
 */

import * as fs from 'fs';
import * as path from 'path';

const CON_VALOR = new Set(['cwd', 'comando']);
const BOOLEANAS = new Set(['json']);
const PENDIENTES = new Set(['mutacion', 'archivos', 'desde', 'mutacion-minima', 'registrar']);

/**
 * @param {string[]} argv
 * @returns {{ cwd?: string, comando?: string, json: boolean } | { error: string }}
 */
export function leerOpciones(argv) {
  /** @type {{ cwd?: string, comando?: string, json: boolean }} */
  const o = { json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) return { error: `Argumento inesperado: "${a}". Uso: forge verificar [--cwd <dir>] [--comando "<pruebas>"] [--json]` };
    const eq = a.indexOf('=');
    const nombre = a.slice(2, eq === -1 ? undefined : eq);
    if (PENDIENTES.has(nombre)) return { error: `La opción --${nombre} todavía no está disponible en esta versión de forge verificar.` };
    if (BOOLEANAS.has(nombre)) { o.json = true; continue; }
    if (!CON_VALOR.has(nombre)) return { error: `Opción desconocida: --${nombre}. Uso: forge verificar [--cwd <dir>] [--comando "<pruebas>"] [--json]` };
    const valor = eq === -1 ? argv[++i] : a.slice(eq + 1);
    if (valor === undefined || valor === '') return { error: `La opción --${nombre} necesita un valor.` };
    if (nombre === 'cwd') o.cwd = valor; else o.comando = valor;
  }
  return o;
}

/**
 * @param {string[]} argv  argumentos tras `verificar`
 * @param {{ cli?: import('../core/sandbox/docker-cli.js').DockerCli, salida?: (t: string) => void, errores?: (t: string) => void }} [deps]
 * @returns {Promise<number>} código de salida
 */
export async function cmdVerificar(argv, deps = {}) {
  const salida = deps.salida ?? ((t) => process.stdout.write(t + '\n'));
  const errores = deps.errores ?? ((t) => process.stderr.write(t + '\n'));
  const o = leerOpciones(argv);
  if ('error' in o) { errores(`✗ ${o.error}`); return 1; }

  const cwd = path.resolve(o.cwd ?? process.cwd());
  if (!fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) { errores(`✗ --cwd no es una carpeta: ${cwd}`); return 1; }

  // Carga diferida: ni el comando ni sus dependencias se cargan hasta aquí
  const { verificar } = await import('../core/verificar/index.js');
  const { textoDelResultado } = await import('../core/verificar/resultado.js');
  const r = await verificar({ cwd, comando: o.comando, cli: deps.cli });
  salida(o.json ? JSON.stringify(r) : textoDelResultado(r));
  return r.codigoSalida;
}
