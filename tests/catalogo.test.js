// @ts-check
/**
 * Validador del catálogo: cabeceras de skills, agentes y comandos
 * (oleadas C1 y C2 de docs/ADECUACION-DEL-CATALOGO.md).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AgentRegistry, avisosDeCabecera } from '../core/agent-registry.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ALIAS = ['opus', 'sonnet', 'haiku'];

/** @param {string} p */
const rel = (p) => path.relative(RAIZ, p).replace(/\\/g, '/');

/**
 * @param {string} archivo
 * @returns {Record<string, string>}
 */
function cabecera(archivo) {
  const t = fs.readFileSync(archivo, 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---/.exec(t);
  assert.ok(m, `${rel(archivo)}: falta la cabecera YAML (regla: toda pieza del catálogo empieza con ---)`);
  /** @type {Record<string, string>} */
  const c = {};
  /** @type {string | null} */
  let ultima = null;
  for (const l of m[1].split('\n')) {
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(l);
    if (kv) {
      ultima = kv[1];
      c[ultima] = kv[2].trim().replace(/^["']|["']$/g, '');
    } else if (ultima && /^\s+\S/.test(l)) {
      c[ultima] = (c[ultima] + ' ' + l.trim()).trim();
    }
  }
  return c;
}

/** @param {string} dir */
const md = (dir) =>
  fs.readdirSync(path.join(RAIZ, dir)).filter((f) => f.endsWith('.md')).sort().map((f) => path.join(RAIZ, dir, f));

function skills() {
  const dir = path.join(RAIZ, 'skills');
  /** @type {{nombre: string, archivo: string}[]} */
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.isDirectory()) {
      const f = path.join(dir, e.name, 'SKILL.md');
      if (fs.existsSync(f)) out.push({ nombre: e.name, archivo: f });
    } else if (e.name.endsWith('.md')) {
      out.push({ nombre: e.name.replace(/\.md$/, ''), archivo: path.join(dir, e.name) });
    }
  }
  return out;
}

test('catálogo: hay skills, agentes y comandos que validar', () => {
  assert.ok(skills().length > 0 && md('agents').length > 0 && md('commands').length > 0);
});

for (const s of skills()) {
  test(`skill ${s.nombre}: cabecera válida`, () => {
    const c = cabecera(s.archivo);
    const f = rel(s.archivo);
    assert.equal(c.name, s.nombre, `${f}: regla "name igual al nombre de la carpeta" (name=${c.name})`);
    assert.match(c.name || '', /^[a-z0-9-]{1,64}$/, `${f}: regla "name en minúsculas, números y guiones, ≤64"`);
    const d = c.description || '';
    assert.ok(d.length >= 80 && d.length <= 1024, `${f}: regla "description entre 80 y 1024 caracteres" (tiene ${d.length})`);
    if (c.model !== undefined) {
      assert.ok(ALIAS.includes(c.model), `${f}: regla "model solo alias opus|sonnet|haiku o ausente" (model=${c.model})`);
    }
    assert.ok(c['allowed-tools'] && c['allowed-tools'].trim(), `${f}: regla "allowed-tools explícito y no vacío"`);
  });
}

for (const f of md('agents')) {
  test(`agente ${rel(f)}: cabecera válida`, () => {
    const c = cabecera(f);
    assert.equal(c.name, path.basename(f, '.md'), `${rel(f)}: regla "name igual al archivo" (name=${c.name})`);
    assert.ok((c.description || '').length > 0, `${rel(f)}: regla "description presente"`);
    assert.ok(ALIAS.includes(c.model), `${rel(f)}: regla "model alias opus|sonnet|haiku" (model=${c.model})`);
    assert.ok(c.tools && !/^\[\s*\]$/.test(c.tools), `${rel(f)}: regla "tools no vacío"`);
  });
  test(`agente ${rel(f)}: el lector del motor no descarta ni aplana nada de la cabecera`, () => {
    // `tools: [Read, Grep]` sin comillas o con guiones se leía como [] sin aviso (spec perfiles-de-agente, spike S0.2)
    assert.deepEqual(avisosDeCabecera(fs.readFileSync(f, 'utf8')), [], `${rel(f)}: regla "cabecera del formato que lee el motor"`);
  });
}

test('el lector avisa de lo que antes descartaba sin decir nada, y no cambia el significado de una cabecera válida', () => {
  const con = (lineas) => `---\nname: x\ndescription: d\nmodel: sonnet\n${lineas}\n---\ncuerpo\n`;
  assert.deepEqual(avisosDeCabecera(con('tools: ["Read","Grep"]')), []);
  assert.deepEqual(avisosDeCabecera(con("tools: ['Read']")), []);
  assert.match(avisosDeCabecera(con('tools: [Read, Grep]'))[0], /no es una lista válida/);
  assert.match(avisosDeCabecera(con('tools: Read, Grep'))[0], /lista entre corchetes/);
  assert.ok(avisosDeCabecera(con('tools:\n  - Read\n  - Write')).length >= 2);
  assert.match(avisosDeCabecera(con('perfil:\n  model: haiku'))[0], /anidada/);

  const dir = fs.mkdtempSync(path.join(fs.realpathSync(process.env.TEMP ?? '/tmp'), 'forge-cab-'));
  fs.writeFileSync(path.join(dir, 'x.md'), con('tools: [Read, Grep]'));
  const aviso = console.warn;
  /** @type {string[]} */ const dicho = [];
  console.warn = (m) => { dicho.push(String(m)); };
  try {
    const r = new AgentRegistry();
    r.load(dir);
    assert.deepEqual(r.get('x')?.tools, [], 'el significado no cambia: sigue descartándose');
    assert.equal(r.avisos.length, 1);
  } finally { console.warn = aviso; }
  assert.match(dicho[0], /x\.md.*no es una lista válida/);
});

for (const f of md('commands')) {
  test(`comando ${rel(f)}: cabecera válida`, () => {
    const c = cabecera(f);
    assert.ok((c.description || '').length > 0, `${rel(f)}: regla "description presente"`);
    assert.ok(c['allowed-tools'] && c['allowed-tools'].trim(), `${rel(f)}: regla "allowed-tools presente"`);
  });
}

test('fronteras: revisor/crítico y arquitecto/architecture-designer declaran su límite', () => {
  /** @param {string} n */
  const d = (n) => cabecera(path.join(RAIZ, 'agents', n + '.md')).description;
  assert.match(d('revisor'), /después de construir/i, 'agents/revisor.md: falta el límite "después de construir"');
  assert.match(d('revisor'), /crítico/i, 'agents/revisor.md: debe remitir a crítico');
  assert.match(d('critico'), /antes de construir/i, 'agents/critico.md: falta el límite "antes de construir"');
  assert.match(d('critico'), /revisor/i, 'agents/critico.md: debe remitir a revisor');
  assert.match(d('arquitecto'), /ciclo verificado/i, 'agents/arquitecto.md: falta "ciclo verificado"');
  assert.match(d('arquitecto'), /architecture-designer/, 'agents/arquitecto.md: debe remitir a architecture-designer');
  assert.match(d('architecture-designer'), /arquitecto/, 'agents/architecture-designer.md: debe remitir a arquitecto');
});
