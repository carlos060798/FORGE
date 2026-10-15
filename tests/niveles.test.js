// @ts-check
/**
 * Spec 2026-10-13-proveedores-agnosticos, F5 (CA-005-01, CA-005-02, CA-005-03): niveles neutrales
 * `alto|medio|economico` y alias `opus|sonnet|haiku` como equivalentes. La prueba central compara
 * las decisiones (degradación por presupuesto, nivel máximo, modelo resuelto) con los dos juegos.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { NIVELES, ALIAS_HEREDADOS, nivelDe, esNivel, limitarNivel, nivelInferior, modeloDeNivel } from '../core/llm-providers/niveles.js';
import { limitarNivel as limitarDePresupuesto, modeloEfectivo } from '../core/ciclo/presupuesto.js';
import { leerConfigCiclo, leerModelos } from '../core/ciclo/config.js';
import { AnthropicProvider, OllamaProvider, OpenAIProvider } from '../core/llm-providers/index.js';
import { AgentRegistry } from '../core/agent-registry.js';

const HEREDADO = ['haiku', 'sonnet', 'opus'];
const NEUTRAL = ['economico', 'medio', 'alto'];
/** Un nombre neutral → su alias heredado y al revés: la tabla de equivalencias. */
const aHeredado = (n) => HEREDADO[NEUTRAL.indexOf(n)];
const aNeutral = (n) => NEUTRAL[HEREDADO.indexOf(n)];

describe('niveles.js: una sola lista', () => {
  test('tres niveles de menor a mayor y los alias equivalentes', () => {
    assert.deepEqual([...NIVELES], NEUTRAL);
    assert.deepEqual(ALIAS_HEREDADOS, { haiku: 'economico', sonnet: 'medio', opus: 'alto' });
    for (const n of [...NEUTRAL, ...HEREDADO]) assert.equal(esNivel(n), true, n);
    for (const n of ['gpt-4o', 'claude-opus-4-8', '', 'ALTO', undefined]) assert.equal(esNivel(n), false, String(n));
    assert.equal(nivelDe('opus'), 'alto');
  });
});

describe('CA-005-03: las mismas decisiones con los dos juegos de nombres', () => {
  test('nivel máximo: para todo par (agente, máximo) el resultado es el mismo nivel', () => {
    for (const agente of NEUTRAL) {
      for (const maximo of NEUTRAL) {
        const n = limitarNivel(agente, maximo);
        const h = limitarNivel(aHeredado(agente), aHeredado(maximo));
        assert.equal(nivelDe(n), nivelDe(h), `${agente}/${maximo}`);
        // cada juego conserva sus nombres
        assert.ok(NEUTRAL.includes(n), n);
        assert.ok(HEREDADO.includes(h), h);
        // y se mezclan: agente heredado con máximo neutral
        assert.equal(nivelDe(limitarNivel(aHeredado(agente), maximo)), nivelDe(n));
        assert.equal(nivelDe(limitarDePresupuesto(agente, aHeredado(maximo))), nivelDe(n));
      }
    }
    // lo que no es un nivel no se toca
    assert.equal(limitarNivel('gpt-4o', 'economico'), 'gpt-4o');
    assert.equal(limitarNivel('alto', 'gpt-4o'), 'alto');
  });

  test('degradación por presupuesto: escalón por escalón igual en los dos juegos', () => {
    const degradado = /** @type {any} */ ({ estado: 'degradado' });
    for (const agente of NEUTRAL) {
      const n = modeloEfectivo(agente, degradado);
      const h = modeloEfectivo(aHeredado(agente), degradado);
      assert.equal(nivelDe(n.alias), nivelDe(h.alias), agente);
      assert.equal(n.degradado, h.degradado, agente);
      assert.equal(n.proveedorLocal, h.proveedorLocal);
      assert.equal(nivelInferior(agente), n.alias);
    }
    assert.deepEqual(modeloEfectivo('alto', degradado), { alias: 'medio', proveedorLocal: false, degradado: true });
    assert.deepEqual(modeloEfectivo('opus', degradado), { alias: 'sonnet', proveedorLocal: false, degradado: true });
    assert.deepEqual(modeloEfectivo('economico', degradado), { alias: 'economico', proveedorLocal: false, degradado: false });
    assert.deepEqual(modeloEfectivo('haiku', degradado), { alias: 'haiku', proveedorLocal: false, degradado: false });
    assert.equal(modeloEfectivo('gpt-4o', degradado).degradado, false);
    // sin degradar nada cambia; con `local` se va a Ollama conservando el nombre
    assert.equal(modeloEfectivo('alto', /** @type {any} */ ({ estado: 'ok' })).alias, 'alto');
    assert.deepEqual(modeloEfectivo('alto', degradado, 'local'), { alias: 'alto', proveedorLocal: true, degradado: true });
  });

  test('modelo resuelto por cada proveedor: igual con nombres neutrales y heredados', () => {
    const proveedores = [new AnthropicProvider({ api_key: 'x' }), new OpenAIProvider({ api_key: 'x' }), new OllamaProvider({ base_url: 'http://localhost:1' })];
    for (const p of proveedores) {
      for (const n of NEUTRAL) assert.equal(p.resolveModelId(n), p.resolveModelId(aHeredado(n)), `${p.nombre}/${n}`);
    }
    // identificadores directos intactos
    assert.equal(proveedores[1].resolveModelId('gpt-4.1'), 'gpt-4.1');
  });

  test('modelos: fijado con un juego de nombres vale para el otro; el nombre exacto manda', () => {
    const conHeredado = new OpenAIProvider({ api_key: 'x', modelos: { opus: 'mi-grande' } });
    const conNeutral = new OpenAIProvider({ api_key: 'x', modelos: { alto: 'mi-grande' } });
    for (const p of [conHeredado, conNeutral]) {
      assert.equal(p.resolveModelId('alto'), 'mi-grande');
      assert.equal(p.resolveModelId('opus'), 'mi-grande');
      assert.equal(p.resolveModelId('medio'), 'gpt-4o-mini');
    }
    const ambos = new OpenAIProvider({ api_key: 'x', modelos: { opus: 'a', alto: 'b' } });
    assert.equal(ambos.resolveModelId('opus'), 'a');
    assert.equal(ambos.resolveModelId('alto'), 'b');
    assert.equal(modeloDeNivel('economico', {}, { haiku: 'h' }), 'h');
  });
});

describe('CA-005-01 y CA-005-02: dónde se aceptan', () => {
  /** @param {string} yaml */
  function config(yaml, env = {}) {
    const cwd = mkdtempSync(join(tmpdir(), 'forge-niveles-'));
    mkdirSync(join(cwd, '.sdd'));
    writeFileSync(join(cwd, '.sdd', 'sdd.config.yaml'), yaml);
    const previos = {};
    for (const [k, v] of Object.entries(env)) { previos[k] = process.env[k]; process.env[k] = v; }
    try { return leerConfigCiclo(cwd); } finally {
      for (const [k, v] of Object.entries(previos)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
      rmSync(cwd, { recursive: true, force: true });
    }
  }

  test('motor.nivel_maximo y modelos: aceptan los dos juegos; uno desconocido sigue fallando', () => {
    for (const n of [...NEUTRAL, ...HEREDADO]) {
      assert.equal(config(`motor:\n  nivel_maximo: ${n}\n`).motor.nivel_maximo, n);
    }
    assert.deepEqual(leerModelos('modelos:\n  alto: a\n  medio: b\n  economico: c\n  opus: d\n'), { alto: 'a', medio: 'b', economico: 'c', opus: 'd' });
    assert.throws(() => config('motor:\n  nivel_maximo: gigante\n'), /nivel_maximo desconocido/);
    assert.throws(() => leerModelos('modelos:\n  gigante: x\n'), /no es un nivel/);
  });

  test('FORGE_NIVEL_MAXIMO y FRAGUA_NIVEL_MAXIMO aceptan niveles neutrales', () => {
    assert.equal(config('', { FORGE_NIVEL_MAXIMO: 'medio' }).motor.nivel_maximo, 'medio');
    assert.equal(config('', { FRAGUA_NIVEL_MAXIMO: 'economico' }).motor.nivel_maximo, 'economico');
    assert.equal(config('', { FORGE_NIVEL_MAXIMO: 'sonnet' }).motor.nivel_maximo, 'sonnet');
  });

  test('cabecera de agentes: nivel neutral o heredado se conserva; un ID directo no se degrada a sonnet', () => {
    const dir = mkdtempSync(join(tmpdir(), 'forge-agentes-'));
    try {
      const modelos = { a1: 'alto', a2: 'economico', a3: 'opus', a4: 'gpt-4o', a5: 'claude-haiku-4-5-20251001', a6: 'medio' };
      for (const [nombre, model] of Object.entries(modelos)) {
        writeFileSync(join(dir, `${nombre}.md`), `---\nname: ${nombre}\ndescription: x\nmodel: ${model}\n---\nEres ${nombre}.\n`);
      }
      const r = new AgentRegistry();
      r.load(dir);
      assert.equal(r.get('a1')?.model, 'alto');
      assert.equal(r.get('a2')?.model, 'economico');
      assert.equal(r.get('a3')?.model, 'opus');
      assert.equal(r.get('a4')?.model, 'gpt-4o');
      assert.equal(r.get('a5')?.model, 'haiku');
      assert.equal(r.get('a6')?.model, 'medio');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

void aNeutral;
