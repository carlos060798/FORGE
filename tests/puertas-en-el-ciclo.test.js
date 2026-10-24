// @ts-check
/**
 * Fase B2 de `2026-10-14-puertas-de-calidad-y-evidencia` (F3.1, RF-03): la decisión de las puertas tras las
 * pruebas. Función pura: no ejecuta nada. El vocabulario de categorías es el que devuelve `ejecutarPuertas`
 * (`pass`, `fail`, `timeout`, `infra_error`, `no_ejecutable`, `no_ejecutada`).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { decidirTrasPuertas } from '../core/puertas/ciclo.js';
import { CLAVES_PUERTAS } from '../core/puertas/config.js';

const PASA = { nombre: 'tipos', categoria: 'pass', exitCode: 0 };
const FALLA = { nombre: 'tipos', categoria: 'fail', exitCode: 2 };
const NO_EJECUTABLE = { nombre: 'linter', categoria: 'no_ejecutable', exitCode: 127 };

describe('decidirTrasPuertas', () => {
  test('pruebas que pasan y todas las puertas pasan: la tarea sigue adelante', () => {
    const d = decidirTrasPuertas({ resultados: [PASA] });
    assert.equal(d.pasa, true);
    assert.equal(d.motivo, null);
  });

  test('una puerta que falla impide dar la tarea por buena, y dice cuál', () => {
    const d = decidirTrasPuertas({ resultados: [PASA, FALLA] });
    assert.equal(d.pasa, false);
    assert.match(d.motivo, /tipos/);
  });

  test('una herramienta ausente (127) NO se toma por aprobación ni por fallo silencioso: se revisa', () => {
    const d = decidirTrasPuertas({ resultados: [NO_EJECUTABLE] });
    assert.equal(d.pasa, false);
    assert.equal(d.revision, true, 'requiere una persona, no un reintento automático');
    assert.match(d.motivo, /no ejecutable|no está/);
  });

  test('sin puertas declaradas no cambia nada', () => {
    const d = decidirTrasPuertas({ resultados: [] });
    assert.equal(d.pasa, true);
  });

  test('el vocabulario es el de ejecutarPuertas: varias puertas en «pass» son aprobación', () => {
    const d = decidirTrasPuertas({ resultados: [
      { nombre: 'seguridad', categoria: 'pass', exitCode: 0 },
      { nombre: 'cobertura', categoria: 'pass', exitCode: 0 },
    ] });
    assert.equal(d.pasa, true);
    assert.equal(d.motivo, null);
  });

  test('varias puertas: basta una que no pase; el motivo nombra las que no pasan y no las que pasan', () => {
    const d = decidirTrasPuertas({ resultados: [
      { nombre: 'tipos', categoria: 'pass', exitCode: 0 },
      { nombre: 'linter', categoria: 'fail', exitCode: 1 },
      { nombre: 'seguridad', categoria: 'fail', exitCode: 3 },
    ] });
    assert.equal(d.pasa, false);
    assert.match(d.motivo, /linter/);
    assert.match(d.motivo, /seguridad/);
    assert.doesNotMatch(d.motivo, /tipos/);
  });

  test('el motivo nombra las puertas en el orden fijo de CLAVES_PUERTAS, sea cual sea el de la entrada', () => {
    const d = decidirTrasPuertas({ resultados: [
      { nombre: 'cobertura', categoria: 'fail', exitCode: 1 },
      { nombre: 'tipos', categoria: 'fail', exitCode: 1 },
    ] });
    assert.deepEqual(CLAVES_PUERTAS.slice(0, 1), ['tipos']);
    assert.ok(d.motivo.indexOf('tipos') < d.motivo.indexOf('cobertura'), d.motivo);
  });

  test('timeout, infra_error y no_ejecutada nunca son aprobación', () => {
    for (const categoria of ['timeout', 'infra_error', 'no_ejecutada']) {
      const d = decidirTrasPuertas({ resultados: [{ nombre: 'tipos', categoria, exitCode: null }] });
      assert.equal(d.pasa, false, categoria);
    }
  });

  test('con una herramienta ausente y otra que falla, se pide revisión humana (hay un 127)', () => {
    const d = decidirTrasPuertas({ resultados: [NO_EJECUTABLE, FALLA] });
    assert.equal(d.pasa, false);
    assert.equal(d.revision, true);
    assert.match(d.motivo, /linter/);
  });

  test('un fallo que no es 127 nunca pide revisión humana: vuelve al implementador', () => {
    for (const categoria of ['fail', 'timeout', 'infra_error']) {
      const d = decidirTrasPuertas({ resultados: [{ nombre: 'tipos', categoria, exitCode: 1 }] });
      assert.equal(d.revision, false, categoria);
    }
  });
});
