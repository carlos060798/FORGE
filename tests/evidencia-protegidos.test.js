/**
 * Configuración protegida frente al agente (spike configuracion-protegida.md). Módulo puro.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { clasificarConfiguracionProtegida, esConfiguracionProtegida, CONFIGURACION_PROTEGIDA } from '../core/evidencia/protegidos.js';

describe('configuración protegida', () => {
  test('tabla: los archivos que el spike encontró escribibles quedan protegidos', () => {
    const protegidos = [
      'tsconfig.json', 'tsconfig.base.json', 'src/tsconfig.json', 'tsconfig.build.json', 'jsconfig.json',
      'biome.json', 'biome.jsonc', 'tslint.json', 'mypy.ini', 'ruff.toml', 'pylintrc', '.pylintrc',
      'semgrep.yml', 'semgrep-reglas.yaml', 'bandit.yaml', 'codecov.yml', 'sonar-project.properties', 'deno.json', 'deno.jsonc',
    ];
    for (const r of protegidos) {
      const c = clasificarConfiguracionProtegida(r);
      assert.equal(c.protegida, true, r);
      assert.ok(c.herramienta, `${r} nombra su herramienta`);
    }
  });

  test('no protege lo que no es configuración de herramienta', () => {
    for (const r of ['src/index.js', 'README.md', 'tsconfig.txt', 'mi-tsconfig.json.bak', 'ruff.toml.md', 'src/biome/uso.js']) {
      assert.equal(esConfiguracionProtegida(r), false, r);
    }
  });

  test('mayúsculas y separadores de Windows no la esquivan', () => {
    assert.equal(esConfiguracionProtegida('SRC\\TSConfig.JSON'), true);
    assert.equal(esConfiguracionProtegida('a\\b\\Mypy.INI'), true);
    assert.equal(esConfiguracionProtegida('./a/../tsconfig.json'), true);
  });

  test('entrada hostil: lo que no es una ruta utilizable se trata como protegido, sin lanzar', () => {
    for (const r of [undefined, null, 42, {}, '', 'a\0b', 'x'.repeat(5000)]) {
      assert.equal(esConfiguracionProtegida(r), true, String(r).slice(0, 20));
    }
    assert.equal(esConfiguracionProtegida('../../tsconfig.json'), true, 'con .. sigue siendo tsconfig');
    assert.equal(esConfiguracionProtegida('../..'), false, 'un componente .. no es una configuración');
    const t0 = Date.now();
    esConfiguracionProtegida(`${'tsconfig'.repeat(500)}.txt`);
    assert.ok(Date.now() - t0 < 500, 'sin retroceso exponencial');
  });

  test('la lista está congelada', () => {
    assert.ok(Object.isFrozen(CONFIGURACION_PROTEGIDA));
  });
});
