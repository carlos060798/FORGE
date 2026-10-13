// @ts-check
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { leerConfigCiclo } from '../core/ciclo/config.js';

function proyecto(yaml) {
  const d = mkdtempSync(join(tmpdir(), 'forge-sangria-'));
  mkdirSync(join(d, '.sdd'));
  writeFileSync(join(d, '.sdd', 'sdd.config.yaml'), yaml);
  return d;
}

describe('sangría de la configuración', () => {
  for (const [nombre, linea] of [['cuatro espacios', '    mutacion: no'], ['un espacio', ' mutacion: no'], ['tabulación', '\tmutacion: no'], ['tres espacios', '   mutacion: no']]) {
    test(`rechaza una clave conocida con ${nombre}`, () => {
      const d = proyecto(`motor:\n  modo: ciclo\n${linea}\n`);
      assert.throws(() => leerConfigCiclo(d), (e) => /motor\.mutacion/.test(e.message) && /línea 3/.test(e.message));
    });
  }
  test('otras secciones: sandbox, presupuesto, modelos y precios', () => {
    assert.throws(() => leerConfigCiclo(proyecto('sandbox:\n    cpus: 2\n')), /sandbox\.cpus/);
    assert.throws(() => leerConfigCiclo(proyecto('presupuesto:\n   tope_usd: 1\n')), /presupuesto\.tope_usd/);
    assert.throws(() => leerConfigCiclo(proyecto('modelos:\n    opus: x\n')), /modelos\.opus/);
    assert.throws(() => leerConfigCiclo(proyecto('precios:\n    mi-modelo_entrada: 3\n')), /precios\.mi-modelo_entrada/);
  });
  test('sin falsos positivos: comentarios, listas, valores con dos puntos, claves desconocidas', () => {
    const d = proyecto([
      'motor:',
      '  modo: ciclo',
      '    # mutacion: no',
      '  # otra: cosa',
      '    - mutacion: no',
      '  grafo: auto   # modo: x',
      'sandbox:',
      '  memoria: 512m',
      '  runtime: ""',
      '    clave_desconocida: 1',
      'otra:',
      '    mutacion: no',
      'protecciones:',
      '  no_tocar_archivos:',
      '    - "a:b"',
      '',
    ].join('\n'));
    const c = leerConfigCiclo(d);
    assert.equal(c.motor.mutacion, 'informar');
    assert.equal(c.motor.modo, 'ciclo');
  });
  test('una configuración válida se lee igual', () => {
    const c = leerConfigCiclo(proyecto('motor:\n  mutacion: exigir\n  max_iteraciones: 7\n'));
    assert.equal(c.motor.mutacion, 'exigir');
    assert.equal(c.motor.max_iteraciones, 7);
  });
});
