// @ts-check
/**
 * Spec 2026-10-13-proveedores-agnosticos, F4 (resto): CA-004-01 (coste cero solo por declaración
 * explícita: Ollama cuenta cero únicamente si su destino es de la propia máquina) y CA-004-03
 * (`presupuesto.sin_precio: avisar | rechazar`).
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { leerConfigCiclo } from '../core/ciclo/config.js';
import { costoDe, avisoSinPrecio } from '../core/ciclo/presupuesto.js';
import { CicloVerificado } from '../core/ciclo/index.js';
import { olvidarDestinos } from '../core/session-budget.js';
import { precioMasCaro } from '../core/precios.js';
import { OllamaProvider, StubProvider } from '../core/llm-providers/index.js';

const LLAMADA = { proveedor: 'ollama', modelo: 'qwen2.5-coder:7b', inputTokens: 1000, outputTokens: 100 };

function configDesde(yaml) {
  const cwd = mkdtempSync(join(tmpdir(), 'forge-destino-'));
  mkdirSync(join(cwd, '.sdd'));
  writeFileSync(join(cwd, '.sdd', 'sdd.config.yaml'), yaml);
  return leerConfigCiclo(cwd);
}

describe('CA-004-01: Ollama es gratis solo si es de la propia máquina o se declara', () => {
  beforeEach(() => olvidarDestinos());

  test('base_url de loopback: cuenta cero (localhost, 127.0.0.1, ::1)', () => {
    for (const url of ['http://localhost:11434', 'http://127.0.0.1:11434', 'http://[::1]:11434']) {
      olvidarDestinos();
      new OllamaProvider({ base_url: url });
      assert.equal(costoDe(LLAMADA), 0, url);
      assert.equal(avisoSinPrecio(LLAMADA, {}), null, `${url}: no avisa`);
    }
  });

  test('remoto sin declarar: al precio más caro conocido, y avisa una vez', () => {
    new OllamaProvider({ base_url: 'https://ollama.ejemplo.com' });
    const caro = precioMasCaro();
    const usd = costoDe(LLAMADA);
    assert.ok(Math.abs(usd - (1000 * caro.input + 100 * caro.output)) < 1e-12);
    const config = { precios: {} };
    const a = avisoSinPrecio(LLAMADA, config);
    assert.ok(a);
    assert.match(a.aviso, /qwen2\.5-coder:7b_entrada/);
    assert.equal(avisoSinPrecio(LLAMADA, config), null, 'una vez por sesión');
  });

  test('remoto con precios: a cero declarado: cuenta cero y no avisa', () => {
    new OllamaProvider({ base_url: 'https://ollama.ejemplo.com' });
    const precios = { 'qwen2.5-coder:7b': { input: 0, output: 0 } };
    assert.equal(costoDe(LLAMADA, { precios }), 0);
    assert.equal(avisoSinPrecio(LLAMADA, { precios }), null);
  });

  test('basta un destino remoto en la sesión para contar: falla cerrado', () => {
    new OllamaProvider({ base_url: 'http://localhost:11434' });
    new OllamaProvider({ base_url: 'https://ollama.ejemplo.com' });
    assert.ok(costoDe(LLAMADA) > 0);
  });

  test('el proveedor stub sigue en cero (es de pruebas)', () => {
    new StubProvider();
    assert.equal(costoDe({ ...LLAMADA, proveedor: 'stub', modelo: 'stub-sonnet' }), 0);
  });
});

describe('CA-004-03: presupuesto.sin_precio', () => {
  test('por defecto es avisar; acepta rechazar; un valor desconocido falla', () => {
    assert.equal(configDesde('').presupuesto.sin_precio, 'avisar');
    assert.equal(configDesde('presupuesto:\n  sin_precio: rechazar\n').presupuesto.sin_precio, 'rechazar');
    assert.throws(() => configDesde('presupuesto:\n  sin_precio: ignorar\n'), /sin_precio desconocido/);
  });

  /** @param {string} sinPrecio @param {Record<string, any>} [precios] */
  function ciclo(sinPrecio, precios = {}) {
    const c = Object.create(CicloVerificado.prototype);
    c.o = {
      config: { presupuesto: { sin_precio: sinPrecio }, precios },
      destino: () => ({ proveedor: 'openai', modelo: 'gpt-nuevo' }),
    };
    return c;
  }

  test('avisar: no rechaza nada (comportamiento actual)', () => {
    assert.equal(ciclo('avisar')._rechazoSinPrecio({ modeloAlias: 'sonnet' }), null);
  });

  test('rechazar: una llamada a un modelo sin precio no se hace y dice qué claves faltan', () => {
    const r = ciclo('rechazar')._rechazoSinPrecio({ modeloAlias: 'sonnet' });
    assert.equal(r.ok, false);
    assert.match(r.error, /gpt-nuevo_entrada/);
    assert.match(r.error, /sin_precio/);
  });

  test('rechazar: con el precio declarado, o con precio conocido, sigue llamando', () => {
    assert.equal(ciclo('rechazar', { 'gpt-nuevo': { input: 1e-6, output: 2e-6 } })._rechazoSinPrecio({}), null);
    const c = ciclo('rechazar');
    c.o.destino = () => ({ proveedor: 'anthropic', modelo: 'claude-sonnet-4-6' });
    assert.equal(c._rechazoSinPrecio({}), null);
  });
});
