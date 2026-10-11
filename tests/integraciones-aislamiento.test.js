// @ts-check
/**
 * F1.6 y F1.7 — Quien no usa las integraciones no nota nada (HU-005, CA-005-01..03).
 *
 * Tres pruebas distintas y complementarias de que ningún módulo de core/integraciones/ se carga ni
 * se usa si no hay sección o está todo apagado:
 *
 *  1. ESTÁTICA: ningún archivo del producto fuera de core/integraciones/ y cli/integraciones.js
 *     menciona esos módulos en un import, un import() o un require. Es la garantía por construcción.
 *  2. EN EJECUCIÓN: procesos hijos arrancan los puntos de entrada reales (CLI, motor, servidor MCP,
 *     API HTTP) con una precarga que (a) sustituye `fetch` por uno que lanza y lo registra, (b)
 *     registra cualquier lectura de variables con pinta de credenciales y (c) instala un gancho de
 *     resolución de módulos que registra todo lo que se resuelve de core/integraciones/. El gancho
 *     ve lo que se importa DE VERDAD, también con import() dinámico, que es lo que una lista
 *     estática no puede garantizar. Con un control positivo: el mismo mecanismo SÍ detecta cuando
 *     se importa un módulo de integraciones y se lee un token.
 *  3. SUITE: un subconjunto del ciclo, ya existente y sin cambios, se ejecuta bajo la misma precarga
 *     y debe quedar en verde sin una sola llamada a fetch ni lectura de tokens (F1.7).
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PRECARGA = pathToFileURL(join(RAIZ, 'tests', 'fixtures', 'integraciones-traza', 'precarga.mjs')).href;
const CLI = join(RAIZ, 'cli', 'index.js');
const aUrl = (...partes) => pathToFileURL(join(RAIZ, ...partes)).href;

// ── 1. Estática ─────────────────────────────────────────────────────────────────────────────

/** @param {string} dir @param {string[]} salida */
function archivosJs(dir, salida = []) {
  for (const nombre of readdirSync(dir)) {
    if (nombre === 'node_modules' || nombre === '.git' || nombre === '.claude') continue;
    const ruta = join(dir, nombre);
    const st = statSync(ruta);
    if (st.isDirectory()) archivosJs(ruta, salida);
    else if (/\.(?:js|mjs|cjs)$/.test(nombre)) salida.push(ruta);
  }
  return salida;
}

const ESPECIFICADORES = /(?:\bimport\s*(?:[\w*${}\s,]+\s*from\s*)?|\bexport\s*(?:\*|\{[^}]*\})\s*from\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)(['"`])([^'"`]+)\1/g;

describe('F1.6 carga perezosa: prueba estática', () => {
  test('ningún archivo del producto, salvo el propio paquete y su CLI, importa core/integraciones/', () => {
    const permitidos = new Set([join(RAIZ, 'cli', 'integraciones.js')]);
    const propios = join(RAIZ, 'core', 'integraciones') + sep;
    /** @type {string[]} */
    const infractores = [];
    let revisados = 0;
    for (const base of ['cli', 'core', 'utils', 'bin', 'scripts', 'mcp-figma', 'ui']) {
      let archivos = [];
      try { archivos = archivosJs(join(RAIZ, base)); } catch { continue; }
      for (const f of archivos) {
        if (f.startsWith(propios) || permitidos.has(f)) continue;
        revisados++;
        const texto = readFileSync(f, 'utf8');
        for (const m of texto.matchAll(ESPECIFICADORES)) {
          if (/integraciones(?:\/|\.js|$)/.test(m[2])) infractores.push(`${relative(RAIZ, f)} -> ${m[2]}`);
        }
      }
    }
    assert.ok(revisados > 50, `solo se revisaron ${revisados} archivos: el recorrido no funciona`);
    assert.deepEqual(infractores, []);
  });

  test('el propio paquete solo depende de módulos de Node y de módulos internos conocidos (sin dependencias nuevas)', () => {
    const dir = join(RAIZ, 'core', 'integraciones');
    const internos = new Set(['../ciclo/redactar.js', '../ciclo/config.js', '../escritura-segura.js', '../event-log.js']);
    for (const f of archivosJs(dir)) {
      const texto = readFileSync(f, 'utf8');
      for (const m of texto.matchAll(ESPECIFICADORES)) {
        const e = m[2];
        // Los adaptadores de proveedores/ solo pueden usar el núcleo hermano (puerto, http, …)
        const enProveedores = f.includes(`${sep}proveedores${sep}`);
        const nucleo = enProveedores && /^\.\.\/(?:puerto|config|confianza|http|auditoria)\.js$/.test(e);
        const ok = e.startsWith('node:') || /^\.\/[\w-]+\.js$/.test(e) || internos.has(e) || nucleo;
        assert.ok(ok, `${relative(RAIZ, f)} importa «${e}»`);
      }
    }
  });

  test('los módulos de integraciones no leen process.env por su cuenta, salvo parámetros por defecto', () => {
    const dir = join(RAIZ, 'core', 'integraciones');
    for (const f of archivosJs(dir)) {
      const lineas = readFileSync(f, 'utf8').split('\n');
      lineas.forEach((l, i) => {
        if (!/process\.env/.test(l)) return;
        const esDefecto = /env\s*=\s*process\.env/.test(l) || /^\s*(\*|\/\/)/.test(l);
        assert.ok(esDefecto, `${relative(RAIZ, f)}:${i + 1} lee process.env fuera de un parámetro por defecto: ${l.trim()}`);
      });
    }
  });
});

// ── 2. En ejecución ─────────────────────────────────────────────────────────────────────────

/**
 * Ejecuta un hijo con la precarga y devuelve su salida y la traza.
 * @param {string[]} argumentos  argumentos de node
 * @param {{ input?: string, cwd?: string, env?: Record<string, string>, timeout?: number }} [o]
 */
function conTraza(argumentos, o = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'forge-traza-'));
  const traza = join(dir, 'traza.jsonl');
  writeFileSync(traza, '');
  const r = spawnSync(process.execPath, ['--import', PRECARGA, ...argumentos], {
    cwd: o.cwd ?? RAIZ,
    input: o.input ?? '',
    encoding: 'utf8',
    timeout: o.timeout ?? 120_000,
    env: { ...process.env, FORGE_TRAZA_INTEGRACIONES: traza, ...(o.env ?? {}) },
  });
  const lineas = readFileSync(traza, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  return { r, traza: lineas, dir };
}

function proyecto(yaml) {
  const dir = mkdtempSync(join(tmpdir(), 'forge-aisl-'));
  mkdirSync(join(dir, '.sdd'), { recursive: true });
  if (yaml !== null) writeFileSync(join(dir, '.sdd', 'sdd.config.yaml'), yaml, 'utf8');
  return dir;
}

const APAGADO = 'integraciones:\n  github_modo: apagado\n  gitlab_modo: apagado\n  jira_modo: apagado\n';

describe('F1.6 carga perezosa: prueba en ejecución', () => {
  test('control positivo: el mecanismo detecta un módulo de integraciones, un fetch y la lectura de un token', () => {
    const dir = mkdtempSync(join(tmpdir(), 'forge-ctl-'));
    const guion = join(dir, 'control.mjs');
    writeFileSync(guion, `
      await import(${JSON.stringify(aUrl('core', 'integraciones', 'puerto.js'))});
      void process.env.FORGE_GITHUB_TOKEN;
      try { await fetch('https://api.github.com/'); } catch {}
    `);
    const { r, traza } = conTraza([guion]);
    assert.equal(r.status, 0, r.stderr);
    const tipos = new Set(traza.map((t) => t.tipo));
    assert.deepEqual([...tipos].sort(), ['env', 'fetch', 'modulo']);
    assert.ok(traza.some((t) => t.tipo === 'modulo' && /core\/integraciones\/puerto\.js$/.test(t.dato)));
  });

  test('importar los puntos de entrada (CLI, motor, MCP, API) no carga nada de integraciones', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'forge-imp-'));
    const guion = join(dir, 'entradas.mjs');
    const proy = proyecto(APAGADO);
    writeFileSync(guion, `
      process.argv[1] = ${JSON.stringify(join(dir, 'otro.js'))};          // que engine-cli no se ejecute como principal
      await import(${JSON.stringify(aUrl('core', 'engine-cli.js'))});
      await import(${JSON.stringify(aUrl('core', 'mcp', 'servidor.js'))});
      await import(${JSON.stringify(aUrl('core', 'mcp', 'herramientas.js'))});
      const api = await import(${JSON.stringify(aUrl('core', 'api', 'servidor.js'))});
      const s = api.crearServidorApi({ cwd: ${JSON.stringify(proy)} });
      await s.escuchar(0);
      await s.cerrar();
      await import(${JSON.stringify(aUrl('core', 'ciclo', 'index.js'))});
      await import(${JSON.stringify(aUrl('core', 'ciclo', 'config.js'))});
      console.log('listo');
    `);
    const { r, traza } = conTraza([guion]);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stdout, /listo/);
    assert.deepEqual(traza, []);
  });

  for (const [nombre, config] of [['sin sección de integraciones', 'motor:\n  modo: ciclo\n'], ['con todo apagado', `motor:\n  modo: ciclo\n${APAGADO}`], ['sin archivo de configuración', null]]) {
    test(`forge (CLI real) ${nombre}: help, doctor y run no cargan integraciones ni tocan la red ni los tokens`, () => {
      const proy = proyecto(/** @type {any} */ (config));
      // Variables con pinta de credenciales presentes en el entorno del hijo: si algo las leyera, quedaría anotado
      const env = { FORGE_GITHUB_TOKEN: 'valor-de-prueba-no-real', GITLAB_TOKEN: 'valor-de-prueba-no-real', JIRA_API_TOKEN: 'valor-de-prueba-no-real' };
      const todas = [];
      for (const args of [['help'], ['doctor', '--cwd', proy], ['run', '--cwd', proy], ['status', '--cwd', proy]]) {
        const { r, traza } = conTraza([CLI, ...args], { cwd: proy, env, timeout: 90_000 });
        assert.ok(r.error === undefined, `${args[0]}: ${r.error}`);
        todas.push(...traza.map((t) => ({ ...t, orden: args[0] })));
      }
      assert.deepEqual(todas, []);
    });
  }

  test('el servidor MCP propio arranca y termina sin cargar integraciones', () => {
    const proy = proyecto(APAGADO);
    const peticion = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 't', version: '0' } } }) + '\n'
      + JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }) + '\n';
    const { r, traza } = conTraza([CLI, 'mcp', '--cwd', proy], { input: peticion, cwd: proy, timeout: 60_000 });
    assert.ok(r.error === undefined, String(r.error));
    assert.match(r.stdout, /"id":2/);
    assert.deepEqual(traza, []);
  });

  test('el motor (core/engine-cli.js run) arranca sin cargar integraciones', () => {
    const proy = proyecto(APAGADO);
    const { r, traza } = conTraza([join(RAIZ, 'core', 'engine-cli.js'), 'run', '--cwd', proy], { cwd: proy, timeout: 90_000 });
    assert.ok(r.error === undefined, String(r.error));
    assert.deepEqual(traza, []);
  });
});

// ── 3. Suite ────────────────────────────────────────────────────────────────────────────────

describe('F1.7 aislamiento HU-005: la suite del ciclo, sin cambios, con fetch interceptado', () => {
  test('el ciclo queda en verde, sin fetch ni lectura de tokens ni módulos de integraciones', () => {
    const archivos = ['ciclo-motor', 'ciclo-datos', 'ciclo-presupuesto', 'ciclo-router', 'ciclo-fundamentos'].map((n) => join(RAIZ, 'tests', `${n}.test.js`));
    const dir = mkdtempSync(join(tmpdir(), 'forge-suite-'));
    const traza = join(dir, 'traza.jsonl');
    writeFileSync(traza, '');
    // Dentro de un proceso de node --test, NODE_TEST_CONTEXT haría que el hijo no imprima el informe
    const entorno = { ...process.env };
    delete entorno.NODE_TEST_CONTEXT;
    const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...archivos], {
      cwd: RAIZ,
      encoding: 'utf8',
      timeout: 280_000,
      env: {
        ...entorno,
        FORGE_TRAZA_INTEGRACIONES: traza,
        NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=${PRECARGA}`.trim(),
      },
    });
    assert.equal(r.status, 0, `la suite del ciclo falló:\n${(r.stdout ?? '').split('\n').filter((l) => /✖|fail/.test(l)).slice(0, 20).join('\n')}`);
    assert.match(r.stdout, /# fail 0/);
    const lineas = readFileSync(traza, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    // Una prueba YA existente de los proveedores de modelos intenta a propósito un puerto cerrado
    // (127.0.0.1:9) para comprobar su manejo del error de conexión: es el único fetch tolerado.
    const ajenas = lineas.filter((l) => !(l.tipo === 'fetch' && l.dato.startsWith('http://127.0.0.1:9/')));
    assert.deepEqual(ajenas, []);
  });
});
