#!/usr/bin/env node
// @ts-check
/**
 * inventario-agentes.mjs — inventario reproducible de agentes, skills y comandos.
 *
 * Lee SOLO las cabeceras (frontmatter) de `agents/*.md`, `skills/<n>/SKILL.md` (y `skills/*.md` planas)
 * y `commands/*.md`; no ejecuta nada ni cambia nada. Sirve para ver de un vistazo qué hay, con qué
 * herramientas y modelo, y qué cabeceras faltan, y para que `docs/INVENTARIO-AGENTES-Y-SKILLS.md` no se
 * escriba a mano.
 *
 *   node scripts/inventario-agentes.mjs            tablas en Markdown por la salida estándar
 *   node scripts/inventario-agentes.mjs --json     lo mismo como JSON
 */

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Cabecera YAML sencilla (clave: valor, listas en línea o con guiones). Suficiente para estos archivos.
 * @param {string} texto
 * @returns {{ cabecera: Record<string, any>, cuerpo: string }}
 */
export function leerCabecera(texto) {
  const t = texto.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(t);
  if (!m) return { cabecera: {}, cuerpo: t };
  /** @type {Record<string, any>} */
  const cab = {};
  let ultima = null;
  for (const linea of m[1].split('\n')) {
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(linea);
    if (kv) {
      ultima = kv[1];
      let v = kv[2].trim();
      if (v === '' ) { cab[ultima] = []; continue; }
      if (/^\[.*\]$/.test(v)) {
        cab[ultima] = v.slice(1, -1).split(',').map((x) => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
      } else {
        cab[ultima] = v.replace(/^["']|["']$/g, '');
      }
    } else if (ultima && /^\s*-\s+/.test(linea) && Array.isArray(cab[ultima])) {
      cab[ultima].push(linea.replace(/^\s*-\s+/, '').trim());
    }
  }
  return { cabecera: cab, cuerpo: m[2] };
}

/** @param {string} p */
const leer = (p) => readFileSync(p, 'utf8');

/** @param {any} v */
const lista = (v) => (Array.isArray(v) ? v : typeof v === 'string' && v ? v.split(/[,\s]+/).filter(Boolean) : []);

function agentes() {
  const dir = join(RAIZ, 'agents');
  return readdirSync(dir).filter((f) => f.endsWith('.md')).sort().map((f) => {
    const { cabecera: c, cuerpo } = leerCabecera(leer(join(dir, f)));
    return {
      archivo: f, nombre: c.name ?? f.replace(/\.md$/, ''), descripcion: c.description ?? '',
      modelo: c.model ?? '', herramientas: lista(c.tools), meta: c.goal ? 'sí' : 'no',
      lineas: cuerpo.split('\n').length,
    };
  });
}

function skills() {
  const dir = join(RAIZ, 'skills');
  const salida = [];
  for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    let ruta = null;
    if (e.isDirectory() && existsSync(join(dir, e.name, 'SKILL.md'))) ruta = join(dir, e.name, 'SKILL.md');
    else if (e.isFile() && e.name.endsWith('.md')) ruta = join(dir, e.name);
    if (!ruta) continue;
    const { cabecera: c, cuerpo } = leerCabecera(leer(ruta));
    const carpeta = e.isDirectory() ? join(dir, e.name) : null;
    salida.push({
      carpeta: e.name.replace(/\.md$/, ''), nombre: c.name ?? '', descripcion: c.description ?? '',
      modelo: c.model ?? '', herramientas: lista(c['allowed-tools']),
      recursos: carpeta ? readdirSync(carpeta).filter((x) => x !== 'SKILL.md').length : 0,
      lineas: cuerpo.split('\n').length,
    });
  }
  return salida;
}

function comandos() {
  const dir = join(RAIZ, 'commands');
  return readdirSync(dir).filter((f) => f.endsWith('.md')).sort().map((f) => {
    const { cabecera: c, cuerpo } = leerCabecera(leer(join(dir, f)));
    return {
      comando: f.replace(/\.md$/, ''), descripcion: c.description ?? '',
      herramientas: lista(c['allowed-tools']), handoffs: Array.isArray(c.handoffs) ? c.handoffs.length : 0,
      lineas: cuerpo.split('\n').length,
    };
  });
}

/** @param {string} s @param {number} n */
const corto = (s, n = 90) => { const x = String(s).replace(/\s+/g, ' ').replace(/\|/g, '/'); return x.length > n ? `${x.slice(0, n - 1)}…` : x; };

function tablas() {
  const A = agentes(); const S = skills(); const C = comandos();
  const l = [];
  l.push(`## Agentes (${A.length})`, '', '| Agente | Modelo | Herramientas | Meta | Líneas | Descripción |', '|---|---|---|---|---|---|');
  for (const a of A) l.push(`| ${a.nombre} | ${a.modelo || '—'} | ${a.herramientas.join(', ') || '—'} | ${a.meta} | ${a.lineas} | ${corto(a.descripcion)} |`);
  l.push('', `## Skills (${S.length})`, '', '| Skill | Modelo | Herramientas | Recursos | Líneas | Descripción |', '|---|---|---|---|---|---|');
  for (const s of S) l.push(`| ${s.carpeta} | ${s.modelo || '—'} | ${s.herramientas.join(', ') || '—'} | ${s.recursos} | ${s.lineas} | ${corto(s.descripcion)} |`);
  l.push('', `## Comandos (${C.length})`, '', '| Comando | Herramientas | Handoffs | Líneas | Descripción |', '|---|---|---|---|---|');
  for (const c of C) l.push(`| ${c.comando} | ${c.herramientas.join(', ') || '—'} | ${c.handoffs} | ${c.lineas} | ${corto(c.descripcion)} |`);
  return { A, S, C, md: l.join('\n') };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { A, S, C, md } = tablas();
  if (process.argv.includes('--json')) process.stdout.write(`${JSON.stringify({ agentes: A, skills: S, comandos: C }, null, 2)}\n`);
  else process.stdout.write(`${md}\n`);
}
