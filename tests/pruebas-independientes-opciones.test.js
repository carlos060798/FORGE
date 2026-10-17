// @ts-check
/**
 * F6.1 (spec 2026-10-13-proveedores-agnosticos, CA-006-01): opciones de
 * scripts/pruebas-independientes.mjs como funciones puras. No se ejecuta el modo real.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { analizarOpciones, entornoDelCiclo, configDeModelos, descripcionDeProveedor } from '../scripts/opciones-independientes.mjs';
import { leerModelos } from '../core/ciclo/config.js';

const ok = (/** @type {string[]} */ a, /** @type {Record<string,string>} */ env = {}) => {
  const r = analizarOpciones(a, env);
  assert.ok(r.ok, r.ok ? '' : r.error);
  return r.opciones;
};
const mal = (/** @type {string[]} */ a, /** @type {Record<string,string>} */ env = {}) => {
  const r = analizarOpciones(a, env);
  assert.ok(!r.ok, 'debía fallar');
  return r.ok ? '' : r.error;
};

describe('comportamiento de siempre', () => {
  test('sin argumentos: humo, stub, tope 0.30, nivel haiku, todos los proyectos', () => {
    const o = ok([]);
    assert.deepEqual([o.modelo, o.proveedor, o.tope, o.nivel, o.proyectos], ['humo', 'stub', 0.3, 'haiku', null]);
  });
  test('real sin --proveedor es anthropic y exige su clave', () => {
    assert.match(mal(['--modelo', 'real']), /ANTHROPIC_API_KEY/);
    assert.equal(ok(['--modelo', 'real'], { ANTHROPIC_API_KEY: 'k' }).proveedor, 'anthropic');
  });
  test('validaciones previas', () => {
    assert.match(mal(['--modelo', 'x']), /humo o real/);
    assert.match(mal(['--tope', '9']), /entre 0 y 5/);
    assert.match(mal(['--nivel', 'mini']), /haiku, sonnet u opus/);
  });
  test('proyectos y banderas', () => {
    const o = ok(['--proyectos', 'a, b', '--conservar', '--desde-repo', '--salida', 'x']);
    assert.deepEqual([o.proyectos, o.conservar, o.desdeRepo, o.salida], [['a', 'b'], true, true, 'x']);
  });
});

describe('--proveedor', () => {
  test('rechaza uno desconocido', () => assert.match(mal(['--proveedor', 'gemini']), /anthropic, openai, ollama, stub/));
  test('humo solo con stub: ni claves ni gasto', () => {
    assert.match(mal(['--proveedor', 'openai']), /humo/);
    assert.equal(ok(['--proveedor', 'stub']).proveedor, 'stub');
  });
  test('real con stub no tiene sentido', () => assert.match(mal(['--modelo', 'real', '--proveedor', 'stub']), /stub/));
  test('real con openai exige OPENAI_API_KEY (no la de Anthropic)', () => {
    assert.match(mal(['--modelo', 'real', '--proveedor', 'openai'], { ANTHROPIC_API_KEY: 'k' }), /OPENAI_API_KEY/);
    assert.equal(ok(['--modelo', 'real', '--proveedor', 'openai'], { OPENAI_API_KEY: 'k' }).proveedor, 'openai');
  });
  test('real con ollama no necesita clave, pero sí tope válido', () => {
    assert.equal(ok(['--modelo', 'real', '--proveedor', 'ollama']).proveedor, 'ollama');
    assert.match(mal(['--modelo', 'real', '--proveedor', 'ollama', '--tope', '0']), /tope/);
  });
  test('la clave nunca por la línea de comandos', () => {
    for (const a of [['--clave', 'sk-x'], ['--api-key=sk-x'], ['--key', 'sk-x'], ['--token', 'x']]) {
      assert.match(mal(['--modelo', 'real', '--proveedor', 'openai', ...a], { OPENAI_API_KEY: 'k' }), /entorno/);
    }
  });
  test('el mensaje de error no contiene el valor de la clave', () => {
    assert.ok(!mal(['--modelo', 'real', '--proveedor', 'openai'], { ANTHROPIC_API_KEY: 'sk-secreta-123' }).includes('sk-secreta-123'));
  });
});

describe('--modelo-alto/medio/economico', () => {
  test('se aceptan y se guardan por nivel', () => {
    const o = ok(['--modelo-alto', 'gpt-5.5', '--modelo-economico', 'llama3:8b']);
    assert.deepEqual(o.modelos, { alto: 'gpt-5.5', economico: 'llama3:8b' });
  });
  test('sin valor, con caracteres peligrosos o con forma de clave: error', () => {
    assert.match(mal(['--modelo-alto']), /necesita/);
    assert.match(mal(['--modelo-medio', 'a\nb: c']), /válido/);
    assert.match(mal(['--modelo-medio', 'sk-abc']), /válido/);
  });
  test('configDeModelos genera un YAML que el ciclo lee', () => {
    const y = configDeModelos({ alto: 'gpt-5.5', economico: 'llama3:8b' });
    assert.ok(y);
    assert.deepEqual(leerModelos(y), { alto: 'gpt-5.5', economico: 'llama3:8b' });
    assert.equal(configDeModelos({}), null);
  });
});

describe('entorno del ciclo', () => {
  const base = { ANTHROPIC_API_KEY: 'a', OPENAI_API_KEY: 'o', PATH: 'p' };
  test('humo: stub, sin ninguna clave, gasto mínimo', () => {
    const e = entornoDelCiclo(ok([]), base);
    assert.deepEqual([e.FORGE_LLM_PROVIDER, e.ANTHROPIC_API_KEY, e.OPENAI_API_KEY, e.FORGE_BUDGET_USD, e.PATH], ['stub', undefined, undefined, '0.05', 'p']);
  });
  test('real con openai: solo su clave, tope y nivel', () => {
    const e = entornoDelCiclo(ok(['--modelo', 'real', '--proveedor', 'openai', '--tope', '0.5', '--nivel', 'sonnet'], base), base);
    assert.deepEqual([e.FORGE_LLM_PROVIDER, e.OPENAI_API_KEY, e.ANTHROPIC_API_KEY, e.FORGE_BUDGET_USD, e.FORGE_NIVEL_MAXIMO], ['openai', 'o', undefined, '0.5', 'sonnet']);
  });
  test('no modifica el entorno de entrada', () => {
    entornoDelCiclo(ok([]), base);
    assert.equal(base.ANTHROPIC_API_KEY, 'a');
  });
  test('el informe describe proveedor y modelos', () => {
    assert.equal(descripcionDeProveedor(ok(['--modelo-alto', 'x1'])), 'stub (alto=x1)');
    assert.match(descripcionDeProveedor(ok([])), /por defecto del proveedor/);
  });
});
