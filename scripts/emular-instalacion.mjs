#!/usr/bin/env node
// @ts-check
/**
 * emular-instalacion.mjs — Emula `forge init --integracion <x> --con-hooks` en cada integración y comprueba
 * el resultado como lo haría la herramienta de destino. NO sustituye la prueba manual en la herramienta real
 * (docs/PLAN-AGNOSTICO.md, F5): comprueba lo que se puede comprobar sin ella.
 *
 *   node scripts/emular-instalacion.mjs [--json] [--solo clave,clave] [--proyecto js|python|ambos]
 *
 * Para cada integración (core/instalacion/herramientas-destino.js) y cada proyecto base (JavaScript con
 * package.json; Python con pyproject.toml y pytest) crea un proyecto temporal con un HOME falso, instala y mide:
 *   skills    cada SKILL.md cumple la spec abierta (name = carpeta, 1-64; description 1-1024; allowed-tools con espacios).
 *             En `claude` solo name y description: allowed-tools con comas es el formato propio de Claude Code.
 *   agentes   cada agente nativo se parsea en su formato (frontmatter, JSON o TOML) y los de solo lectura
 *             (AGENTES_SOLO_LECTURA, la lista del guardián) no reciben herramientas de escritura.
 *   hooks     el archivo de hooks es válido y su orden `fragua guardian evaluar --anfitrion X` se EJECUTA de verdad
 *             (con `fragua` simulado en el PATH): bloquea un push forzado y un .env (código 2) y deja pasar `ls`
 *             (código 0), con los eventos propios de esa herramienta. La memoria nunca bloquea. opencode: se
 *             carga el plugin y se comprueba que lanza o deja pasar.
 *   sintaxis  ninguna salida no-Claude conserva, fuera de la nota de anfitrión: allowed-tools en la cabecera,
 *             $CLAUDE_PLUGIN_ROOT, rutas .claude/<carpeta de instalación> ni `$sdd` dentro de un bloque bash.
 *             `Task(` y `TodoWrite` en cuerpos (pseudocódigo de los comandos) NO fallan: los cubre la nota de
 *             anfitrión; se cuentan como aviso.
 *   idempotencia  una segunda instalación sale con 0 y sin avisos de «no se pisa».
 *   confinamiento nada se escribió fuera del proyecto ni del HOME falso, y un archivo canario vecino no cambió.
 *   stack     `init` detecta el stack (AGENTS.md lleva `npm test` o `pytest`) y no añade package.json ni
 *             node_modules a un proyecto Python ni cambia el package.json de uno JavaScript.
 *
 * Node 20 o superior es necesario en la máquina aunque el proyecto sea Python: lo exigen la CLI `fragua` y los
 * hooks (el guardián se analiza en JavaScript y falla cerrado sin Node; docs/hooks.md). El proyecto en sí no
 * necesita nada de Node: la comprobación `stack` lo verifica.
 *
 * Salida: tabla (o JSON con --json). Código de salida 1 si alguna comprobación falla.
 */
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { INTEGRACIONES } from '../core/instalacion/herramientas-destino.js';
import { validarSkill } from '../core/instalacion/skills-de-comandos.js';
import { FORMATOS_NATIVOS } from '../core/instalacion/agentes-nativos.js';
import { PLANTILLAS_HOOKS } from '../core/instalacion/hooks-anfitrion.js';
import { AGENTES_SOLO_LECTURA } from '../core/evidencia/guardian-reglas.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(RAIZ, 'cli', 'index.js');
const CLAVES_COMP = ['skills', 'agentes', 'hooks', 'sintaxis', 'idempotencia', 'confinamiento', 'stack'];
const ESCRIBE = /^(write|edit|multiedit|notebookedit|replace|write_file|apply_patch)$/i;

// ─── Utilidades ──────────────────────────────────────────────────────────────

const ok = (detalle = '') => ({ estado: 'OK', detalle });
const falla = (detalle) => ({ estado: 'FALLA', detalle });
const na = (detalle = '') => ({ estado: 'NO APLICA', detalle });
const veredicto = (errores, detalleOk = '') => (errores.length ? falla(errores.slice(0, 6).join(' | ') + (errores.length > 6 ? ` (+${errores.length - 6})` : '')) : ok(detalleOk));

/** Archivos de un árbol, rutas relativas con `/`. */
function archivos(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  const rec = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) rec(p); else out.push(relative(dir, p).replaceAll('\\', '/'));
    }
  };
  rec(dir);
  return out.sort();
}

const hash = (ruta) => createHash('sha256').update(readFileSync(ruta)).digest('hex');

/** Ejecuta `forge ...` sin bloquear el bucle de eventos. */
function correr(args, cwd, env) {
  return new Promise((res) => {
    const p = spawn(process.execPath, [CLI, ...args], { cwd, env, windowsHide: true });
    let salida = '';
    p.stdout.on('data', (d) => { salida += d; });
    p.stderr.on('data', (d) => { salida += d; });
    const t = setTimeout(() => p.kill(), 180_000);
    p.on('close', (codigo) => { clearTimeout(t); res({ codigo, salida }); });
  });
}

/** Entorno con HOME falso y `fragua` simulado (apunta a este árbol) en el PATH. */
function entornoDe(home, bin) {
  const env = { ...process.env, HOME: home, USERPROFILE: home, FORGE_LLM_PROVIDER: 'stub', ANTHROPIC_API_KEY: '', CLAUDE_API_KEY: '', FRAGUA_AGENTE: '', FORGE_AGENTE: '', CLAUDE_AGENT_NAME: '' };
  const clavePath = Object.keys(env).find((k) => k.toLowerCase() === 'path') ?? 'PATH';
  env[clavePath] = bin + (process.platform === 'win32' ? ';' : ':') + (env[clavePath] ?? '');
  return env;
}

function crearShim(bin) {
  mkdirSync(bin, { recursive: true });
  if (process.platform === 'win32') {
    writeFileSync(join(bin, 'fragua.cmd'), `@echo off\r\nnode "${CLI}" %*\r\n`);
  } else {
    const f = join(bin, 'fragua');
    writeFileSync(f, `#!/bin/sh\nexec node "${CLI}" "$@"\n`);
    chmodSync(f, 0o755);
  }
}

// ─── Proyectos base ──────────────────────────────────────────────────────────

const PROYECTOS = {
  js: {
    nombre: 'JavaScript',
    crear(dir) {
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'demo-js', version: '1.0.0', scripts: { test: 'node --test' } }, null, 2) + '\n');
      mkdirSync(join(dir, 'tests'), { recursive: true });
      writeFileSync(join(dir, 'tests', 'a.test.js'), "import test from 'node:test';\ntest('ok', () => {});\n");
    },
    esperaPruebas: /npm (run )?test|node --test/,
  },
  python: {
    nombre: 'Python',
    crear(dir) {
      writeFileSync(join(dir, 'pyproject.toml'), '[project]\nname = "demo-py"\nversion = "0.1.0"\n\n[tool.pytest.ini_options]\ntestpaths = ["tests"]\n');
      mkdirSync(join(dir, 'tests'), { recursive: true });
      writeFileSync(join(dir, 'tests', 'test_x.py'), 'def test_ok():\n    assert True\n');
    },
    esperaPruebas: /pytest/,
  },
};

// ─── Parsers mínimos (sin dependencias) ──────────────────────────────────────

/** Frontmatter YAML simple: { campos, cuerpo } o lanza. Los valores entre comillas o corchetes deben ser JSON válido. */
function parsearFrontmatter(texto) {
  const t = texto.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(t);
  if (!m) throw new Error('sin frontmatter');
  const campos = {};
  for (const linea of m[1].split('\n')) {
    const k = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(linea);
    if (!k) continue;
    let v = k[2].trim();
    if (/^["[{]/.test(v)) { try { v = JSON.parse(v); } catch { throw new Error(`valor no válido en «${k[1]}»`); } }
    campos[k[1]] = v;
  }
  return { campos, bloque: m[1], cuerpo: t.slice(m[0].length) };
}

/** TOML mínimo: `clave = "cadena"`, `'''multilínea'''` y `"""multilínea"""`. Lanza si algo no cierra. */
function parsearToml(texto) {
  const t = texto.replace(/\r\n/g, '\n');
  const out = {};
  let i = 0;
  while (i < t.length) {
    const fin = t.indexOf('\n', i);
    const linea = t.slice(i, fin === -1 ? t.length : fin);
    if (/^\s*(#.*)?$/.test(linea)) { i = fin === -1 ? t.length : fin + 1; continue; }
    const m = /^([A-Za-z_][\w-]*)\s*=\s*(.*)$/.exec(linea);
    if (!m) throw new Error(`línea no entendida: ${linea.slice(0, 40)}`);
    const resto = m[2];
    if (resto.startsWith("'''") || resto.startsWith('"""')) {
      const comilla = resto.slice(0, 3);
      const desde = t.indexOf(comilla, i + linea.indexOf('=')) + 3;
      let hasta = desde;
      for (;;) {
        hasta = t.indexOf(comilla, hasta);
        if (hasta === -1) throw new Error(`cadena multilínea sin cerrar en «${m[1]}»`);
        if (comilla === '"""' && t[hasta - 1] === '\\') { hasta += 1; continue; }
        break;
      }
      out[m[1]] = t.slice(desde, hasta);
      const sigue = t.indexOf('\n', hasta);
      i = sigue === -1 ? t.length : sigue + 1;
      continue;
    }
    try { out[m[1]] = JSON.parse(resto); } catch { throw new Error(`valor no válido en «${m[1]}»`); }
    i = fin === -1 ? t.length : fin + 1;
  }
  return out;
}

// ─── Comprobaciones ──────────────────────────────────────────────────────────

const carpetaSkillsDe = (clave) => (clave === 'generica' ? '.emulacion/skills' : INTEGRACIONES[clave].carpetaSkills);

function comprobarSkills(clave, proyecto, nAgentes) {
  const dir = join(proyecto, ...carpetaSkillsDe(clave).split('/'));
  const errores = [];
  const carpetas = existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) : [];
  if (carpetas.length === 0) return falla(`no hay skills en ${carpetaSkillsDe(clave)}`);
  let n = 0;
  for (const c of carpetas) {
    const f = join(dir, c, 'SKILL.md');
    if (!existsSync(f)) { errores.push(`${c}: sin SKILL.md`); continue; }
    n++;
    const md = readFileSync(f, 'utf8');
    if (clave === 'claude') {
      const m = /^---\n([\s\S]*?)\n---/.exec(md.replace(/\r\n/g, '\n'));
      const nombre = m && /^name:\s*(.+)$/m.exec(m[1])?.[1]?.trim().replace(/^["']|["']$/g, '');
      if (!m || !nombre || !/^description:\s*\S/m.test(m[1])) errores.push(`${c}: falta name o description`);
      else if (nombre !== c) errores.push(`${c}: name «${nombre}» ≠ carpeta`);
    } else {
      for (const e of validarSkill(c, md)) errores.push(`${c}: ${e}`);
    }
  }
  if (clave !== 'claude') {
    const roles = carpetas.filter((c) => c.startsWith('rol-')).length;
    if (roles !== nAgentes) errores.push(`roles rol-*: ${roles} de ${nAgentes}`);
    if (!carpetas.includes('forge')) errores.push('falta la skill forge');
  }
  return veredicto(errores, `${n} skills`);
}

function comprobarAgentes(clave, proyecto, nombresAgentes) {
  const lista = [...nombresAgentes];
  if (clave === 'claude') {
    const dir = join(proyecto, '.claude', 'agents');
    const errores = [];
    for (const a of AGENTES_SOLO_LECTURA) {
      const f = join(dir, a + '.md');
      if (!existsSync(f)) { errores.push(`${a}: no instalado`); continue; }
      const tools = /^tools:\s*(.*)$/m.exec(readFileSync(f, 'utf8'))?.[1] ?? '';
      if (/\b(Write|Edit|MultiEdit|NotebookEdit)\b/.test(tools)) errores.push(`${a}: solo lectura con ${tools}`);
    }
    return veredicto(errores, `${readdirSync(dir).length} agentes (formato Claude Code)`);
  }
  const formato = FORMATOS_NATIVOS[clave];
  if (!formato) return na('sin formato nativo confirmado');
  const dir = join(proyecto, ...formato.carpeta.split('/'));
  const fs = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(formato.extension)) : [];
  const errores = [];
  const minimo = clave === 'gemini' ? 6 : lista.length;
  if (fs.length < minimo) errores.push(`${fs.length} agentes nativos; se esperaban ${minimo === lista.length ? lista.length : 'al menos ' + minimo}`);
  for (const f of fs) {
    const nombre = f.slice(0, -formato.extension.length);
    const texto = readFileSync(join(dir, f), 'utf8');
    const soloLectura = AGENTES_SOLO_LECTURA.includes(nombre);
    try {
      if (clave === 'kiro') {
        const o = JSON.parse(texto);
        if (!o.name || !o.description || !o.prompt) errores.push(`${f}: faltan name, description o prompt`);
        if (soloLectura && (!Array.isArray(o.tools) || o.tools.some((t) => ESCRIBE.test(t)))) errores.push(`${f}: solo lectura con tools ${JSON.stringify(o.tools)}`);
      } else if (clave === 'codex') {
        const o = parsearToml(texto);
        if (!o.name || !o.description || !o.developer_instructions) errores.push(`${f}: faltan name, description o developer_instructions`);
        if (soloLectura && !/solo lectura/i.test(String(o.developer_instructions))) errores.push(`${f}: solo lectura sin la instrucción`);
      } else {
        const { campos, bloque, cuerpo } = parsearFrontmatter(texto);
        if (clave !== 'opencode' && !campos.name) errores.push(`${f}: sin name`);
        if (!campos.description) errores.push(`${f}: sin description`);
        if (!cuerpo.trim()) errores.push(`${f}: sin instrucciones`);
        if (soloLectura) {
          if (clave === 'copilot' && (!Array.isArray(campos.tools) || campos.tools.includes('edit'))) errores.push(`${f}: solo lectura con tools ${JSON.stringify(campos.tools)}`);
          if (clave === 'cursor' && campos.readonly !== 'true') errores.push(`${f}: solo lectura sin readonly: true`);
          if (clave === 'opencode' && !/action: edit\s+resource: "\*"\s+effect: deny/.test(bloque)) errores.push(`${f}: solo lectura sin permiso edit denegado`);
          if (clave === 'gemini' && /write|edit|replace/i.test(bloque)) errores.push(`${f}: solo lectura con herramienta de escritura`);
        }
      }
    } catch (e) { errores.push(`${f}: ${e.message}`); }
  }
  return veredicto(errores, `${fs.length} agentes ${formato.extension}`);
}

/** Órdenes `fragua ...` de un archivo de hooks JSON. */
function ordenesDe(obj, acc = new Set()) {
  if (typeof obj === 'string') { if (/^fragua (guardian|memoria) /.test(obj)) acc.add(obj); }
  else if (obj && typeof obj === 'object') for (const v of Object.values(obj)) ordenesDe(v, acc);
  return acc;
}

/** Eventos propios de cada herramienta: peligrosos (deben dar 2) e inocuo (debe dar 0). */
const EVENTOS = {
  cursor: {
    peligrosos: [{ hook_event_name: 'beforeShellExecution', command: 'git push --force origin main', cwd: '.' }, { hook_event_name: 'beforeReadFile', file_path: '.env' }],
    inocuo: { hook_event_name: 'beforeShellExecution', command: 'ls', cwd: '.' },
  },
  copilot: {
    peligrosos: [{ toolName: 'bash', toolArgs: { command: 'git push --force origin main' } }, { toolName: 'view', toolArgs: { path: '.env' } }],
    inocuo: { toolName: 'bash', toolArgs: { command: 'ls' } },
  },
  gemini: {
    peligrosos: [{ tool_name: 'run_shell_command', tool_input: { command: 'git push --force origin main' } }, { tool_name: 'write_file', tool_input: { file_path: '.env', content: 'X=1' } }],
    inocuo: { tool_name: 'run_shell_command', tool_input: { command: 'ls' } },
  },
  codex: {
    peligrosos: [{ tool_name: 'Bash', tool_input: { command: 'git push --force origin main' } }, { tool_name: 'apply_patch', tool_input: { command: '*** Begin Patch\n*** Update File: .env\n+X=1\n*** End Patch' } }],
    inocuo: { tool_name: 'Bash', tool_input: { command: 'ls' } },
  },
  windsurf: {
    // Cobertura parcial declarada: solo terminal
    peligrosos: [{ hook_event_name: 'PreToolUse', tool_name: 'exec', tool_input: { command: 'git push --force origin main' } }],
    inocuo: { hook_event_name: 'PreToolUse', tool_name: 'exec', tool_input: { command: 'ls' } },
  },
};

const ejecutar = (orden, evento, cwd, env) => spawnSync(orden, { cwd, env, input: typeof evento === 'string' ? evento : JSON.stringify(evento), encoding: 'utf8', shell: true, timeout: 60_000 });

async function comprobarHooks(clave, proyecto, env) {
  if (clave === 'claude') {
    const hook = join(proyecto, '.claude', 'hooks', 'pre-tool-guard.js');
    if (!existsSync(hook)) return falla('falta .claude/hooks/pre-tool-guard.js');
    const errores = [];
    const corre = (ev) => spawnSync(process.execPath, [hook], { cwd: proyecto, env, input: JSON.stringify(ev), encoding: 'utf8', timeout: 60_000 }).status;
    if (corre({ tool_name: 'Bash', tool_input: { command: 'git push --force origin main' } }) !== 2) errores.push('push forzado no bloqueado');
    if (corre({ tool_name: 'Write', tool_input: { file_path: '.env', content: 'X=1' } }) !== 2) errores.push('.env no bloqueado');
    if (corre({ tool_name: 'Bash', tool_input: { command: 'ls' } }) !== 0) errores.push('ls bloqueado');
    if (!existsSync(join(proyecto, '.claude', 'settings.json'))) errores.push('falta settings.json');
    return veredicto(errores, 'hooks de Claude Code');
  }
  const plantilla = PLANTILLAS_HOOKS[clave];
  if (!plantilla) return na('sin adaptador de hook');
  const ruta = join(proyecto, ...plantilla.ruta.split('/'));
  if (!existsSync(ruta)) return falla(`falta ${plantilla.ruta}`);
  const errores = [];

  if (clave === 'opencode') {
    // Se carga el plugin tal como lo cargaría opencode (módulo ESM) y se llama a su hook
    const copia = join(dirname(proyecto), 'plugin-opencode.mjs');
    writeFileSync(copia, readFileSync(ruta, 'utf8'));
    const clavePath = Object.keys(env).find((k) => k.toLowerCase() === 'path') ?? 'PATH';
    const antes = { path: process.env[clavePath], cwd: process.cwd() };
    process.env[clavePath] = env[clavePath];
    process.chdir(proyecto);
    try {
      const mod = await import(pathToFileURL(copia).href + '?t=' + Date.now());
      const hook = (await mod.FraguaGuardian())['tool.execute.before'];
      let lanzo = false;
      try { await hook({ tool: 'read' }, { args: { filePath: '.env' } }); } catch { lanzo = true; }
      if (!lanzo) errores.push('read .env no se bloqueó');
      try { await hook({ tool: 'read' }, { args: { filePath: 'README.md' } }); } catch (e) { errores.push(`read README.md bloqueado: ${String(e.message).slice(0, 60)}`); }
    } catch (e) { errores.push(`el plugin no carga: ${e.message}`); }
    finally { process.chdir(antes.cwd); process.env[clavePath] = antes.path; }
    return veredicto(errores, 'plugin carga, bloquea read .env, deja pasar README.md (cobertura parcial)');
  }

  let obj;
  try { obj = JSON.parse(readFileSync(ruta, 'utf8')); } catch (e) { return falla(`${plantilla.ruta} no es JSON válido: ${e.message}`); }
  const ordenes = [...ordenesDe(obj)];
  const guardian = ordenes.filter((o) => o.includes(`guardian evaluar --anfitrion ${clave}`));
  if (guardian.length === 0) return falla(`${plantilla.ruta} no llama a «fragua guardian evaluar --anfitrion ${clave}»`);
  const ev = EVENTOS[clave];
  const orden = guardian[0];
  for (const p of ev.peligrosos) {
    const r = ejecutar(orden, p, proyecto, env);
    if (r.status !== 2) errores.push(`peligroso ${JSON.stringify(p).slice(0, 60)}: código ${r.status} (esperado 2)`);
  }
  const bien = ejecutar(orden, ev.inocuo, proyecto, env);
  if (bien.status !== 0) errores.push(`inocuo: código ${bien.status} (esperado 0)`);
  const memoria = ordenes.filter((o) => o.includes('memoria registrar'));
  for (const o of new Set(memoria)) {
    const r = ejecutar(o, '{no es json', proyecto, env);
    if (r.status !== 0) errores.push(`memoria bloqueó (código ${r.status}); nunca debe`);
  }
  return veredicto(errores, `${guardian.length ? 'guardián' : ''}${memoria.length ? ' + memoria' : ''} ejecutado(s): bloquea y deja pasar`);
}

/** Texto sin la nota de anfitrión. */
const sinNota = (t) => t.replace(/^> \*\*Nota de anfitrión[\s\S]*?\n\n/m, '');

function comprobarSintaxis(clave, proyecto) {
  if (clave === 'claude') return na('es el formato propio de Claude Code');
  const rutas = [];
  const dirSkills = join(proyecto, ...carpetaSkillsDe(clave).split('/'));
  for (const f of archivos(dirSkills)) rutas.push(join(dirSkills, f));
  const nativo = FORMATOS_NATIVOS[clave];
  if (nativo) for (const f of archivos(join(proyecto, ...nativo.carpeta.split('/')))) rutas.push(join(proyecto, ...nativo.carpeta.split('/'), f));
  const errores = [];
  let avisos = 0;
  for (const f of rutas) {
    if (!/\.(md|toml|json)$/.test(f)) continue;
    const rel = relative(proyecto, f).replaceAll('\\', '/');
    const texto = sinNota(readFileSync(f, 'utf8').replace(/\r\n/g, '\n'));
    const cab = /^---\n([\s\S]*?)\n---/.exec(texto)?.[1] ?? '';
    if (/^allowed-tools:/m.test(cab)) errores.push(`${rel}: allowed-tools en la cabecera`);
    if (/\$CLAUDE_PLUGIN_ROOT/.test(texto)) errores.push(`${rel}: $CLAUDE_PLUGIN_ROOT`);
    if (/\.claude\/(skills|commands|agents|hooks|settings)/.test(texto)) errores.push(`${rel}: ruta .claude/ de instalación`);
    for (const bloque of texto.matchAll(/```(?:bash|sh|shell)\n([\s\S]*?)```/g)) {
      if (/\$sdd[-\w]*/.test(bloque[1])) errores.push(`${rel}: $sdd dentro de un bloque bash`);
    }
    if (/Task\(|TodoWrite/.test(texto)) avisos++;
  }
  return veredicto(errores, `${rutas.length} archivos; ${avisos} con Task(/TodoWrite en cuerpos (cubiertos por la nota)`);
}

// ─── Una celda: integración × proyecto ───────────────────────────────────────

async function emular(clave, tipo, nombresAgentes) {
  const base = realpathSync(mkdtempSync(join(tmpdir(), `emular-${clave}-${tipo}-`)));
  const proyecto = join(base, 'proyecto'), home = join(base, 'home'), bin = join(base, 'bin'), vecino = join(base, 'vecino');
  for (const d of [proyecto, home, vecino]) mkdirSync(d, { recursive: true });
  writeFileSync(join(vecino, 'canario.txt'), 'no tocar');
  crearShim(bin);
  PROYECTOS[tipo].crear(proyecto);
  const env = entornoDe(home, bin);
  const pkgAntes = existsSync(join(proyecto, 'package.json')) ? hash(join(proyecto, 'package.json')) : null;
  const args = ['init', '--integracion', clave, '--con-hooks', ...(clave === 'generica' ? ['--carpeta-skills', '.emulacion/skills'] : [])];
  const res = { integracion: clave, proyecto: tipo, comprobaciones: {} };
  const c = res.comprobaciones;

  const r1 = await correr(args, proyecto, env);
  if (r1.codigo !== 0) {
    for (const k of CLAVES_COMP) c[k] = falla(`init salió con ${r1.codigo}: ${r1.salida.split('\n').filter(Boolean).slice(-2).join(' / ').slice(0, 160)}`);
    rmSync(base, { recursive: true, force: true });
    return res;
  }
  c.skills = comprobarSkills(clave, proyecto, nombresAgentes.length);
  c.agentes = comprobarAgentes(clave, proyecto, nombresAgentes);
  c.hooks = await comprobarHooks(clave, proyecto, env);
  c.sintaxis = comprobarSintaxis(clave, proyecto);

  // Stack
  const eStack = [];
  const agentsMd = existsSync(join(proyecto, 'AGENTS.md')) ? readFileSync(join(proyecto, 'AGENTS.md'), 'utf8') : '';
  if (!agentsMd) eStack.push('no se generó AGENTS.md');
  else if (!PROYECTOS[tipo].esperaPruebas.test(agentsMd)) eStack.push(`AGENTS.md no lleva el comando de pruebas esperado (${PROYECTOS[tipo].esperaPruebas})`);
  if (tipo === 'python') {
    if (existsSync(join(proyecto, 'package.json'))) eStack.push('init creó un package.json en un proyecto Python');
    if (existsSync(join(proyecto, 'node_modules'))) eStack.push('init creó node_modules en un proyecto Python');
  } else if (pkgAntes !== hash(join(proyecto, 'package.json'))) eStack.push('init modificó el package.json del proyecto');
  c.stack = veredicto(eStack, tipo === 'python' ? 'detecta pytest; sin archivos de Node en el proyecto' : 'detecta npm test; package.json intacto');

  // Idempotencia
  const r2 = await correr(args, proyecto, env);
  const eIdem = [];
  if (r2.codigo !== 0) eIdem.push(`segunda pasada con código ${r2.codigo}`);
  const avisosPisar = r2.salida.split('\n').filter((l) => /no se pisa|ya existe y no es de FORGE/i.test(l));
  if (avisosPisar.length) eIdem.push(`${avisosPisar.length} avisos «no se pisa»: ${avisosPisar[0].trim().slice(0, 100)}`);
  c.idempotencia = veredicto(eIdem, 'segunda pasada limpia');

  // Confinamiento
  const eConf = [];
  const hijos = readdirSync(base).sort().join(',');
  if (hijos !== 'bin,home,proyecto,vecino' && hijos !== 'bin,home,plugin-opencode.mjs,proyecto,vecino') eConf.push(`aparecieron entradas en la raíz temporal: ${hijos}`);
  if (readFileSync(join(vecino, 'canario.txt'), 'utf8') !== 'no tocar' || archivos(vecino).length !== 1) eConf.push('el vecino cambió');
  const escritosEnHome = archivos(home);
  c.confinamiento = veredicto(eConf, `HOME falso: ${escritosEnHome.length} archivos; vecino intacto`);

  rmSync(base, { recursive: true, force: true });
  return res;
}

// ─── Principal ───────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const valor = (n) => { const i = args.indexOf(n); return i === -1 ? null : args[i + 1]; };
  const solo = valor('--solo')?.split(',') ?? null;
  const proy = valor('--proyecto') ?? 'ambos';
  const tipos = proy === 'ambos' ? ['js', 'python'] : [proy];
  if (tipos.some((t) => !PROYECTOS[t])) { console.error('--proyecto debe ser js, python o ambos'); process.exit(2); }
  const claves = Object.keys(INTEGRACIONES).filter((c) => !solo || solo.includes(c));
  const nombresAgentes = readdirSync(join(RAIZ, 'agents')).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3));

  const trabajos = claves.flatMap((c) => tipos.map((t) => ({ c, t })));
  const resultados = new Array(trabajos.length);
  let siguiente = 0;
  const trabajador = async () => {
    for (;;) {
      const i = siguiente++;
      if (i >= trabajos.length) return;
      resultados[i] = await emular(trabajos[i].c, trabajos[i].t, nombresAgentes);
    }
  };
  await Promise.all(Array.from({ length: 3 }, trabajador));

  const fallos = resultados.flatMap((r) => Object.entries(r.comprobaciones).filter(([, v]) => v.estado === 'FALLA').map(([k, v]) => ({ integracion: r.integracion, proyecto: r.proyecto, comprobacion: k, detalle: v.detalle })));
  if (json) {
    console.log(JSON.stringify({ resultados, fallos }, null, 2));
  } else {
    const ancho = (s, n) => String(s).padEnd(n);
    console.log(ancho('integración', 12) + ancho('proyecto', 11) + CLAVES_COMP.map((k) => ancho(k, 14)).join(''));
    for (const r of resultados) {
      console.log(ancho(r.integracion, 12) + ancho(PROYECTOS[r.proyecto].nombre, 11) + CLAVES_COMP.map((k) => ancho(r.comprobaciones[k]?.estado ?? '?', 14)).join(''));
    }
    if (fallos.length) {
      console.log('\nFallos:');
      for (const f of fallos) console.log(`- ${f.integracion}/${f.proyecto}/${f.comprobacion}: ${f.detalle}`);
    }
    console.log(`\n${resultados.length} instalaciones emuladas, ${fallos.length} comprobaciones con FALLA.`);
    console.log('Esto emula la instalación; no sustituye la prueba manual en cada herramienta real.');
  }
  process.exit(fallos.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
