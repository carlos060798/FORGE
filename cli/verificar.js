/**
 * cli/verificar.js — `forge verificar [--cwd <dir>] [--comando "<pruebas>"] [--json] [--registrar]
 *                      [--mutacion (--archivos <a,b> | --desde <ref>) [--mutacion-minima <0..1>]]`
 *
 * Códigos de salida (los de `forge run`): 0 pasa · 1 falla, cero pruebas o mutación bajo el mínimo / no
 * concluyente (solo con --mutacion-minima) · 4 sin Docker o infraestructura.
 * No existe ninguna opción para ejecutar sin aislamiento. No llama a ningún modelo.
 */

import * as fs from 'fs';
import * as path from 'path';

const CON_VALOR = new Set(['cwd', 'comando', 'archivos', 'desde', 'mutacion-minima']);
const BOOLEANAS = new Set(['json', 'mutacion', 'registrar']);
const USO = 'Uso: forge verificar [--cwd <dir>] [--comando "<pruebas>"] [--json] [--registrar] [--mutacion (--archivos <a,b> | --desde <ref>) [--mutacion-minima <0..1>]]';
const NUMERO_0_1 = /^(?:0(?:\.\d+)?|1(?:\.0+)?|\.\d+)$/;

/**
 * @typedef {{ cwd?: string, comando?: string, json: boolean, registrar: boolean,
 *   mutacion?: { archivos?: string[], desde?: string, minima?: number } }} OpcionesCli
 */

/**
 * @param {string[]} argv
 * @returns {OpcionesCli | { error: string }}
 */
export function leerOpciones(argv) {
  /** @type {Record<string, string>} */
  const v = {};
  /** @type {Set<string>} */
  const activas = new Set();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) return { error: `Argumento inesperado: "${a}". ${USO}` };
    const eq = a.indexOf('=');
    const nombre = a.slice(2, eq === -1 ? undefined : eq);
    if (BOOLEANAS.has(nombre)) { activas.add(nombre); continue; }
    if (!CON_VALOR.has(nombre)) return { error: `Opción desconocida: --${nombre}. ${USO}` };
    const valor = eq === -1 ? argv[++i] : a.slice(eq + 1);
    if (valor === undefined || valor === '') return { error: `La opción --${nombre} necesita un valor.` };
    v[nombre] = valor;
  }
  /** @type {OpcionesCli} */
  const o = { json: activas.has('json'), registrar: activas.has('registrar') };
  if (v.cwd !== undefined) o.cwd = v.cwd;
  if (v.comando !== undefined) o.comando = v.comando;

  const sueltas = ['archivos', 'desde', 'mutacion-minima'].filter((n) => v[n] !== undefined);
  if (!activas.has('mutacion')) {
    if (sueltas.length > 0) return { error: `--${sueltas[0]} solo tiene sentido con --mutacion.` };
    return o;
  }
  if (v.archivos === undefined && v.desde === undefined) {
    return { error: '--mutacion necesita saber qué medir: indica los archivos con --archivos <a,b> o los cambiados desde una referencia de git con --desde <ref>. No se muta el proyecto entero.' };
  }
  /** @type {{ archivos?: string[], desde?: string, minima?: number }} */
  const m = {};
  if (v.archivos !== undefined) {
    const lista = v.archivos.split(',').map((x) => x.trim()).filter(Boolean);
    if (lista.length === 0) return { error: '--archivos necesita al menos una ruta (separadas por comas).' };
    m.archivos = lista;
  }
  if (v.desde !== undefined) m.desde = v.desde;
  if (v['mutacion-minima'] !== undefined) {
    const t = v['mutacion-minima'];
    if (!NUMERO_0_1.test(t)) return { error: `--mutacion-minima no válido: "${t}". Debe ser un número entre 0 y 1 (0.6 es el 60 %).` };
    m.minima = Number(t);
  }
  o.mutacion = m;
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
  const r = await verificar({ cwd, comando: o.comando, cli: deps.cli, mutacion: o.mutacion, registrar: o.registrar });
  salida(o.json ? JSON.stringify(r) : textoDelResultado(r));
  return r.codigoSalida;
}
