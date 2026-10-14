#!/usr/bin/env node
// @ts-check
/**
 * generar-skills.mjs — Genera `skills-generadas/<nombre>/SKILL.md` desde `commands/*.md`.
 *
 *   node scripts/generar-skills.mjs              escribe las skills (corre antes de empaquetar)
 *   node scripts/generar-skills.mjs --verificar  no escribe; sale 1 si lo que hay en disco diverge
 *
 * Fuente única: los comandos. Las skills generadas no se editan a mano.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generarSkills } from '../core/instalacion/skills-de-comandos.js';

export const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const CARPETA_GENERADAS = 'skills-generadas';

/**
 * @param {string} [raiz]
 * @returns {{ skills: Map<string,string>, avisos: Record<string,string[]>, errores: Record<string,string[]> }}
 */
export function calcular(raiz = RAIZ) {
  const dir = join(raiz, 'commands');
  const comandos = readdirSync(dir).filter((f) => f.endsWith('.md')).sort()
    .map((f) => ({ comando: f.slice(0, -3), texto: readFileSync(join(dir, f), 'utf8') }));
  return generarSkills(comandos);
}

/**
 * Diferencias entre lo generado en memoria y lo que hay en disco.
 * @param {string} [raiz]
 * @returns {string[]}
 */
export function divergencias(raiz = RAIZ) {
  const { skills } = calcular(raiz);
  const destino = join(raiz, CARPETA_GENERADAS);
  const dif = [];
  for (const [nombre, md] of skills) {
    const archivo = join(destino, nombre, 'SKILL.md');
    if (!existsSync(archivo)) dif.push(`falta ${nombre}/SKILL.md`);
    else if (readFileSync(archivo, 'utf8') !== md) dif.push(`${nombre}/SKILL.md difiere del comando`);
  }
  if (existsSync(destino)) {
    for (const e of readdirSync(destino, { withFileTypes: true })) {
      if (e.isDirectory() && !skills.has(e.name)) dif.push(`${e.name}/ no corresponde a ningún comando`);
    }
  }
  return dif;
}

function main() {
  const verificar = process.argv.includes('--verificar');
  const { skills, avisos, errores } = calcular();
  const malos = Object.entries(errores);
  if (malos.length) {
    for (const [c, e] of malos) console.error(`ERROR ${c}: ${e.join('; ')}`);
    process.exit(1);
  }
  if (verificar) {
    const dif = divergencias();
    for (const d of dif) console.error(`DIVERGE ${d}`);
    if (dif.length) { console.error('Ejecuta: node scripts/generar-skills.mjs'); process.exit(1); }
    console.log(`${skills.size} skills al día`);
    return;
  }
  const destino = join(RAIZ, CARPETA_GENERADAS);
  rmSync(destino, { recursive: true, force: true });
  for (const [nombre, md] of skills) {
    mkdirSync(join(destino, nombre), { recursive: true });
    writeFileSync(join(destino, nombre, 'SKILL.md'), md);
  }
  const conAviso = Object.keys(avisos).length;
  console.log(`${skills.size} skills generadas en ${CARPETA_GENERADAS}/ (${conAviso} con avisos de conversión)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
