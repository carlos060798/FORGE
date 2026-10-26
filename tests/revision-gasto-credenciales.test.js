// @ts-check
/**
 * Hallazgos altos de la revisión independiente de gasto y credenciales (2026-10-25).
 *  A-1  `precios:` de un sdd.config.yaml hostil no puede contaminar Object.prototype.
 *  A-2  La clave de Anthropic no viaja a otro proveedor (OpenAI, Gemini por el endpoint compatible, Ollama).
 */
import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { leerPrecios } from '../core/ciclo/config.js';
import { crearProvider } from '../core/llm-providers/index.js';

describe('A-1: la tabla de precios del proyecto no contamina el prototipo', () => {
  afterEach(() => {
    // Por si una versión rota llegara a contaminar: no dejar el proceso de pruebas sucio
    delete (/** @type {any} */ (Object.prototype)).input;
    delete (/** @type {any} */ (Object.prototype)).output;
    delete (/** @type {any} */ (Object.prototype)).cacheRead;
  });

  for (const id of ['__proto__', 'constructor', 'prototype']) {
    test(`«${id}» como identificador de modelo se rechaza y no toca Object.prototype`, () => {
      const yaml = `precios:\n  ${id}_entrada: 0\n  ${id}_salida: 0\n  ${id}_cache_lectura: 0\n`;
      assert.throws(() => leerPrecios(yaml), /no puede ser un identificador de modelo/);
      assert.equal(/** @type {any} */ ({}).input, undefined);
      assert.equal(/** @type {any} */ ({}).output, undefined);
      assert.equal(/** @type {any} */ ({}).cacheRead, undefined);
    });
  }

  test('un modelo normal sigue leyéndose igual', () => {
    const p = leerPrecios('precios:\n  gemini-3.5-flash_entrada: 0.3\n  gemini-3.5-flash_salida: 2.5\n');
    assert.deepEqual(p['gemini-3.5-flash'], { input: 0.3 / 1_000_000, output: 2.5 / 1_000_000 });
  });
});

describe('A-2: la clave de Anthropic no se envía a otro proveedor', () => {
  const ANTES = { ...process.env };
  afterEach(() => {
    for (const k of ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY', 'OPENAI_API_KEY', 'OPENAI_BASE_URL', 'FORGE_LLM_PROVIDER', 'FRAGUA_LLM_PROVIDER']) {
      if (ANTES[k] === undefined) delete process.env[k]; else process.env[k] = ANTES[k];
    }
  });

  test('con el proveedor openai, la clave de OpenAI manda aunque el llamador pase la de Anthropic', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-CLAVE-DE-ANTHROPIC';
    process.env.OPENAI_API_KEY = 'clave-del-proveedor-compatible';
    process.env.OPENAI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai';
    process.env.FORGE_LLM_PROVIDER = 'openai';
    const p = /** @type {any} */ (crearProvider({ cwd: process.cwd(), config: { api_key: process.env.ANTHROPIC_API_KEY } }));
    assert.equal(p.apiKey, 'clave-del-proveedor-compatible');
    assert.notEqual(p.apiKey, 'sk-ant-CLAVE-DE-ANTHROPIC');
  });

  test('sin clave del otro proveedor no se rellena con la de Anthropic', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-CLAVE-DE-ANTHROPIC';
    delete process.env.OPENAI_API_KEY;
    process.env.FORGE_LLM_PROVIDER = 'openai';
    const p = /** @type {any} */ (crearProvider({ cwd: process.cwd(), config: { api_key: process.env.ANTHROPIC_API_KEY } }));
    assert.notEqual(p.apiKey, 'sk-ant-CLAVE-DE-ANTHROPIC');
  });

  test('con Anthropic la clave sigue pasando', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-CLAVE-DE-ANTHROPIC';
    process.env.FORGE_LLM_PROVIDER = 'anthropic';
    const p = /** @type {any} */ (crearProvider({ cwd: process.cwd(), config: { api_key: process.env.ANTHROPIC_API_KEY } }));
    assert.ok(p, 'se crea el proveedor de Anthropic');
  });

  test('una clave que un llamador pasa a propósito a otro proveedor (no es la de Anthropic) se respeta', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-CLAVE-DE-ANTHROPIC';
    process.env.FORGE_LLM_PROVIDER = 'openai';
    const p = /** @type {any} */ (crearProvider({ cwd: process.cwd(), config: { api_key: 'clave-explicita-de-otro' } }));
    assert.equal(p.apiKey, 'clave-explicita-de-otro');
  });
});

describe('M-2 de verificar: la salida acotada no lleva secuencias de terminal', () => {
  test('cola() sustituye ESC, OSC y controles bidi; conserva saltos de línea y tabulador', async () => {
    const { cola } = await import('../core/ciclo/redactar.js');
    const esc = String.fromCharCode(27);
    const bel = String.fromCharCode(7);
    const hostil = `${esc}[2J${esc}[HPASA: todo bien${esc}]52;c;SGVsbG8=${bel}\r\nlinea\tcon tab\nsuelto\rfin ‮evil`;
    const r = cola(hostil);
    assert.ok(!r.includes(esc) && !r.includes(bel) && !r.includes('‮'), JSON.stringify(r));
    assert.match(r, /linea\tcon tab\nsuelto\nfin/);
    assert.ok(r.includes('\r\n'));
  });
  test('un texto normal no cambia', async () => {
    const { cola } = await import('../core/ciclo/redactar.js');
    assert.equal(cola('ok 1 - suma\n# tests 3\n'), 'ok 1 - suma\n# tests 3\n');
    assert.equal(cola('acentos ñ ü 日本語 ✓'), 'acentos ñ ü 日本語 ✓');
  });
});

describe('M-1: un precio casi cero de un modelo desconocido se trata como cero', () => {
  test('1e-30 se descarta; uno normal se conserva; con FRAGUA_PRECIOS_CERO se acepta', async () => {
    const { limitarPreciosDelProyecto } = await import('../core/ciclo/config.js');
    const r = limitarPreciosDelProyecto({ 'x-raro': { input: 1e-30, output: 1e-30 }, 'y-ok': { input: 1e-6, output: 2e-6 } }, { avisar: () => {}, env: {} });
    assert.equal(r['x-raro'], undefined);
    assert.ok(r['y-ok']);
    const r2 = limitarPreciosDelProyecto({ 'x-raro': { input: 1e-30, output: 1e-30 } }, { avisar: () => {}, env: { FRAGUA_PRECIOS_CERO: 'x-raro' } });
    assert.ok(r2['x-raro']);
  });
});
