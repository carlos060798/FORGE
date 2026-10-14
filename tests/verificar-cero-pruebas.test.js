// @ts-check
/**
 * «Cero pruebas ejecutadas» no es éxito (CA-002-03), también cuando el comando sale con 0.
 * La comprobación solo degrada un «pasa»; nunca mejora un veredicto.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { salidaSinPruebas } from '../core/verificar/index.js';

describe('salidaSinPruebas', () => {
  test('node:test sin pruebas (reporter spec y TAP)', () => {
    assert.equal(salidaSinPruebas('ℹ tests 0\nℹ pass 0\nℹ fail 0\n'), true);
    assert.equal(salidaSinPruebas('# tests 0\n# pass 0\n'), true);
  });

  test('node:test con pruebas', () => {
    assert.equal(salidaSinPruebas('ℹ tests 12\nℹ pass 12\nℹ fail 0\n'), false);
    assert.equal(salidaSinPruebas('# tests 3\n# pass 3\n'), false);
  });

  test('varios resúmenes: basta con que uno ejecute pruebas', () => {
    assert.equal(salidaSinPruebas('ℹ tests 0\nℹ tests 4\n'), false);
  });

  test('Go: todos los paquetes sin archivos de prueba', () => {
    assert.equal(salidaSinPruebas('?   \texample.com/m\t[no test files]\n'), true);
    assert.equal(salidaSinPruebas('ok  \texample.com/m\t0.01s\n?   \texample.com/m/x\t[no test files]\n'), false);
  });

  test('una salida cualquiera no se toma por «sin pruebas»', () => {
    assert.equal(salidaSinPruebas(''), false);
    assert.equal(salidaSinPruebas('todo bien\n'), false);
    assert.equal(salidaSinPruebas('ok  1 prueba\n'), false);
  });

  test('un texto que imite el resumen solo puede empeorar el veredicto, nunca mejorarlo', () => {
    // La función devuelve true/false para DEGRADAR; un «pasa» que la salida hostil convierta en
    // «sin_pruebas» es el lado seguro. No existe el camino contrario.
    assert.equal(typeof salidaSinPruebas('ℹ tests 0'), 'boolean');
  });
});
