// @ts-check
/**
 * Fase B2 de `2026-10-14-puertas-de-calidad-y-evidencia`: una puerta que falla impide que la tarea pase,
 * aunque las pruebas pasen, y su resultado queda registrado como un evento del ciclo.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { decidirTrasPuertas } from '../core/puertas/ciclo.js';

const PASA = { nombre: 'tipos', categoria: 'pasa', exitCode: 0 };
const FALLA = { nombre: 'tipos', categoria: 'falla', exitCode: 2 };
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
});
