// @ts-check
/**
 * F4.4 y F4.5 (spec 2026-10-13-proveedores-agnosticos): tabla de OpenAI revisada contra la
 * tarifa oficial (2026-10-17) y coste de los tokens de caché de otros proveedores.
 * Cubre CA-004-04 y CA-004-05.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { TABLA, REVISADA_OPENAI, preciosCache } from '../core/precios.js';
import { costoDe, registrar } from '../core/ciclo/presupuesto.js';
import { OpenAIProvider } from '../core/llm-providers/index.js';
import { servidorFalso } from './fixtures/proveedores/servidor-falso.js';

// [entrada, caché, salida] USD por millón, copiados de https://developers.openai.com/api/docs/pricing (2026-10-17)
const OFICIAL = {
  'gpt-4o': [2.5, 1.25, 10], 'gpt-4o-mini': [0.15, 0.075, 0.6],
  'gpt-4.1': [2, 0.5, 8], 'gpt-4.1-mini': [0.4, 0.1, 1.6], 'gpt-4.1-nano': [0.1, 0.025, 0.4],
  'gpt-5.4': [2.5, 0.25, 15], 'gpt-5.4-mini': [0.75, 0.075, 4.5], 'gpt-5.4-nano': [0.2, 0.02, 1.25],
  'gpt-5.5': [5, 0.5, 30], 'gpt-5.6-sol': [4, 0.4, 20], 'gpt-5.6-terra': [2, 0.2, 12], 'gpt-5.6-luna': [0.2, 0.02, 1.2],
  'gpt-6-astra': [10, 1, 50], 'gpt-6.1-sol': [2, 0.1, 10], 'gpt-6-sol': [2, 0.2, 10], 'gpt-6-luna': [0.1, 0.01, 0.5],
};
const cerca = (/** @type {number} */ a, /** @type {number} */ b) => assert.ok(Math.abs(a - b) < 1e-12, `${a} != ${b}`);
const base = { proveedor: 'openai', inputTokens: 0, outputTokens: 0 };

describe('F4.4 tabla de OpenAI', () => {
  test('fecha de revisión actualizada', () => assert.equal(REVISADA_OPENAI, '2026-10-17'));
  test('solo lo confirmado, y sin modelos «-pro»', () => {
    assert.deepEqual(Object.keys(TABLA.openai).sort(), Object.keys(OFICIAL).sort());
  });
  for (const [m, [i, c, o]] of Object.entries(OFICIAL)) {
    test(`${m}: precio y coste`, () => {
      assert.deepEqual(TABLA.openai[m], { entrada: i, salida: o, cache_lectura: c });
      cerca(costoDe({ ...base, modelo: m, inputTokens: 1_000_000, outputTokens: 1_000_000 }), i + o);
    });
  }
});

describe('F4.5 caché de otros proveedores', () => {
  test('OpenAI real: entrada + caché = prompt_tokens y coste exacto con precio de caché', async () => {
    const s = await servidorFalso('openai', [{ texto: 'ok', tokens: { prompt: 1000, completion: 0, cacheados: 600 } }]);
    try {
      const p = new OpenAIProvider({ api_key: 'sk-x', base_url: s.url });
      const r = /** @type {any} */ (await p.conversar(/** @type {any} */ ({ model: 'gpt-4.1', systemPrompt: 's', mensajes: [{ rol: 'usuario', contenido: 'x' }] })));
      assert.equal(r.inputTokens + r.cacheReadTokens, 1000);
      const usd = costoDe({ ...base, modelo: 'gpt-4.1', inputTokens: r.inputTokens, outputTokens: r.outputTokens, cacheReadTokens: r.cacheReadTokens });
      cerca(usd, (400 * 2 + 600 * 0.5) / 1e6);
      assert.ok(usd <= 1000 * 2 / 1e6 + 1e-15, 'nunca más que todo a precio de entrada');
    } finally { await s.cerrar(); }
  });

  test('con el precio de caché oficial: ni por debajo de él ni por encima de la entrada', () => {
    for (const [m, [i, c]] of Object.entries(OFICIAL)) {
      const usd = costoDe({ ...base, modelo: m, cacheReadTokens: 1_000_000 });
      assert.ok(usd >= c - 1e-12 && usd <= i + 1e-12, m);
    }
  });

  test('sin precio de caché propio se cobra al de entrada', () => {
    cerca(costoDe({ ...base, modelo: 'gpt-4o', cacheReadTokens: 1_000_000 }, { precios: { 'gpt-4o': { input: 3e-6, output: 1e-5 } } }), 3);
    assert.ok(costoDe({ ...base, modelo: 'gpt-nuevo', cacheReadTokens: 1_000_000 }) >= 10 - 1e-12, 'desconocido: el más caro');
  });

  test('el precio de caché del proyecto manda sobre la tabla', () => {
    cerca(costoDe({ ...base, modelo: 'gpt-4.1', cacheReadTokens: 1_000_000 }, { precios: { 'gpt-4.1': { input: 2e-6, output: 8e-6, cacheRead: 0.7e-6 } } }), 0.7);
  });

  test('preciosCache: lectura propia y escritura = entrada x 1,25', () => {
    const p = preciosCache('openai', 'gpt-4.1');
    assert.ok(p);
    cerca(p.lectura, 0.5e-6);
    cerca(p.escritura, 2.5e-6);
    assert.equal(preciosCache('openai', 'no-existe'), null);
  });

  test('Ollama declarado a cero: la caché que informe tampoco cuesta; sin declarar, nunca por debajo', () => {
    const l = { proveedor: 'ollama', modelo: 'llama3', inputTokens: 5000, outputTokens: 500, cacheReadTokens: 100, cacheCreationTokens: 100 };
    assert.equal(costoDe(l, { precios: { llama3: { input: 0, output: 0 } } }), 0);
    assert.ok(costoDe(l) > 0, 'sin precio declarado se cuenta al más caro conocido (CA-004-01)');
  });

  test('el presupuesto acumula la lectura aparte de tokens_in', () => {
    const p0 = /** @type {any} */ ({ tope_usd: 10, umbral_degradacion_usd: 8, gastado_usd: 0, estado: 'ok', llamadas: 0, tokens_in: 0, tokens_out: 0 });
    const p = /** @type {any} */ (registrar(p0, { ...base, modelo: 'gpt-4.1', inputTokens: 400, cacheReadTokens: 600 }));
    assert.equal(p.tokens_in, 400);
    assert.equal(p.tokens_cache_lectura, 600);
  });
});
