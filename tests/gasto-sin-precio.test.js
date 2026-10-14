// @ts-check
/**
 * Spec 2026-10-13-proveedores-agnosticos, F4 (lo barato): coste cero explícito y aviso de modelo sin
 * precio, una vez por sesión y diciendo qué clave de `precios:` falta. El comportamiento por defecto
 * no cambia: un modelo sin precio se sigue contando al más caro conocido.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { leerConfigCiclo } from '../core/ciclo/config.js';
import { planner } from '../core/ciclo/nodos.js';
import { estadoInicial } from '../core/ciclo/estado.js';
import { costoDe } from '../core/ciclo/presupuesto.js';
import { precioMasCaro } from '../core/precios.js';

const M = 1_000_000;

function configDesde(yaml) {
  const cwd = mkdtempSync(join(tmpdir(), 'forge-sinprecio-'));
  mkdirSync(join(cwd, '.sdd'));
  writeFileSync(join(cwd, '.sdd', 'sdd.config.yaml'), yaml);
  return leerConfigCiclo(cwd);
}

const estado = () => estadoInicial({ id: 'T1', agente: 'tester', descripcion: 'x', archivos: [] }, { runId: 'r', cwd: '/p', tope_usd: 100, umbral_degradacion_usd: 90 });

/** deps mínimos del nodo planner con una respuesta fija; `config` es el mismo objeto en toda la sesión. */
function sesion(respuesta, config = {}) {
  /** @type {any[]} */
  const eventos = [];
  const cfg = { motor: { nivel_maximo: 'opus' }, presupuesto: { degradar_a: 'escalon' }, precios: {}, ...config };
  return {
    eventos,
    deps: {
      aliasDe: () => 'sonnet',
      llamar: async () => ({ ok: true, output: '{}', ...respuesta }),
      log: { append: (type, payload, meta) => eventos.push({ type, payload, meta }) },
      config: cfg,
    },
  };
}

describe('CA-004-01: coste cero, solo por declaración explícita en precios:', () => {
  test('cero explícito en precios: el modelo cuesta cero y no deja aviso', async () => {
    const config = configDesde('precios:\n  mi-modelo-propio_entrada: 0\n  mi-modelo-propio_salida: 0\n');
    assert.deepEqual(config.precios['mi-modelo-propio'], { input: 0, output: 0 });
    const llamada = { proveedor: 'openai', modelo: 'mi-modelo-propio', inputTokens: 5000, outputTokens: 900 };
    assert.equal(costoDe(llamada, { precios: config.precios }), 0);

    const { deps, eventos } = sesion({ proveedor: 'openai', modelo: 'mi-modelo-propio', inputTokens: 5000, outputTokens: 900 }, { precios: config.precios });
    const r = await planner(estado(), deps);
    assert.equal(r.presupuesto.gastado_usd, 0);
    assert.equal(eventos.filter((e) => e.type === 'ciclo:precio_desconocido').length, 0);
  });

  test('nunca implícito por el nombre del proveedor: el mismo modelo, sin declarar, se cuenta al más caro', () => {
    const caro = precioMasCaro();
    for (const proveedor of ['openai', 'anthropic', 'compatible-ajeno']) {
      const usd = costoDe({ proveedor, modelo: 'modelo-local-de-otro', inputTokens: 1000, outputTokens: 100 });
      assert.ok(Math.abs(usd - (1000 * caro.input + 100 * caro.output)) < 1e-12, proveedor);
    }
  });
});

describe('CA-004-02: aviso de modelo sin precio, una vez por sesión, con la clave que falta', () => {
  test('un aviso por modelo y sesión; dice qué claves de precios: añadir; sigue contando al más caro', async () => {
    const { deps, eventos } = sesion({ proveedor: 'openai', modelo: 'gpt-nuevo', inputTokens: 1000, outputTokens: 100 });
    const r1 = await planner(estado(), deps);
    await planner(estado(), deps);
    await planner(estado(), deps);

    const avisos = eventos.filter((e) => e.type === 'ciclo:precio_desconocido');
    assert.equal(avisos.length, 1, 'una vez por sesión');
    assert.equal(avisos[0].payload.modelo, 'gpt-nuevo');
    assert.match(avisos[0].payload.aviso, /gpt-nuevo_entrada/);
    assert.match(avisos[0].payload.aviso, /gpt-nuevo_salida/);
    assert.match(avisos[0].payload.aviso, /precios:/);
    assert.deepEqual(avisos[0].payload.claves, ['gpt-nuevo_entrada', 'gpt-nuevo_salida']);

    const caro = precioMasCaro();
    assert.ok(Math.abs(r1.presupuesto.gastado_usd - (1000 * caro.input + 100 * caro.output)) < 1e-12, 'comportamiento por defecto intacto');
  });

  test('otro modelo sin precio avisa por separado; otra sesión (otra configuración) avisa de nuevo', async () => {
    const config = { precios: {} };
    const a = sesion({ proveedor: 'openai', modelo: 'modelo-a', inputTokens: 1, outputTokens: 1 }, config);
    const b = sesion({ proveedor: 'openai', modelo: 'modelo-b', inputTokens: 1, outputTokens: 1 }, config);
    await planner(estado(), a.deps);
    await planner(estado(), b.deps);
    assert.equal(a.eventos.filter((e) => e.type === 'ciclo:precio_desconocido').length, 1);
    assert.equal(b.eventos.filter((e) => e.type === 'ciclo:precio_desconocido').length, 1);

    const otra = sesion({ proveedor: 'openai', modelo: 'modelo-a', inputTokens: 1, outputTokens: 1 });
    await planner(estado(), otra.deps);
    assert.equal(otra.eventos.filter((e) => e.type === 'ciclo:precio_desconocido').length, 1);
    void M;
  });
});
