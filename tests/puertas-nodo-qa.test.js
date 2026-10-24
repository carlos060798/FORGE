// @ts-check
/**
 * Fase B2: el nodo de QA, tras una ejecución `pass`, pasa por las puertas declaradas (si las hay). Una puerta
 * que falla hace que la ejecución cuente como `fail` (la tarea vuelve al implementador con la salida de la
 * puerta); solo una herramienta ausente (127) pide revisión humana. Sin puertas, el comportamiento es el de
 * siempre (la prueba de regresión la cubre ciclo-hallazgos).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejecucionQaConPuertas } from '../core/puertas/ciclo.js';

test('pruebas que pasan + puerta que falla: no se aprueba, y no es una revisión humana', async () => {
  const r = await ejecucionQaConPuertas({
    categoria: 'pass',
    puertas: async () => [{ nombre: 'tipos', categoria: 'fail', exitCode: 2 }],
  });
  assert.equal(r.categoria, 'fail');
  // Una puerta que falla no es una revisión humana: el ciclo puede reintentar. Solo la herramienta ausente la pide.
  assert.equal(r.revision, false);
  assert.match(r.motivo, /tipos/);
});

test('pruebas que pasan + puertas que pasan: se aprueba', async () => {
  const r = await ejecucionQaConPuertas({ categoria: 'pass', puertas: async () => [{ nombre: 'tipos', categoria: 'pass', exitCode: 0 }] });
  assert.equal(r.categoria, 'pass');
  assert.equal(r.revision, false);
});

test('sin puertas declaradas no cambia la categoría', async () => {
  const r = await ejecucionQaConPuertas({ categoria: 'pass', puertas: null });
  assert.equal(r.categoria, 'pass');
});

test('si las pruebas no pasaron, las puertas ni se ejecutan', async () => {
  let llamadas = 0;
  const r = await ejecucionQaConPuertas({ categoria: 'fail', puertas: async () => { llamadas++; return []; } });
  assert.equal(r.categoria, 'fail');
  assert.equal(llamadas, 0);
});

test('una puerta ausente (127) pide revisión humana aunque las pruebas pasen', async () => {
  const r = await ejecucionQaConPuertas({
    categoria: 'pass',
    puertas: async () => [{ nombre: 'linter', categoria: 'no_ejecutable', exitCode: 127 }],
  });
  assert.equal(r.categoria, 'fail');
  assert.equal(r.revision, true);
  assert.match(r.motivo, /linter/);
});

test('varias puertas: una que falla impide la aprobación aunque las demás pasen', async () => {
  const r = await ejecucionQaConPuertas({
    categoria: 'pass',
    puertas: async () => [
      { nombre: 'tipos', categoria: 'pass', exitCode: 0 },
      { nombre: 'linter', categoria: 'fail', exitCode: 1 },
      { nombre: 'seguridad', categoria: 'pass', exitCode: 0 },
    ],
  });
  assert.equal(r.categoria, 'fail');
  assert.match(r.motivo, /linter/);
  assert.doesNotMatch(r.motivo, /tipos|seguridad/);
});

test('la salida de la puerta que falla viaja con la decisión, para que el implementador la vea', async () => {
  const r = await ejecucionQaConPuertas({
    categoria: 'pass',
    puertas: async () => [{ nombre: 'tipos', categoria: 'fail', exitCode: 2, salida: 'src/suma.js(1,1): error TS2322' }],
  });
  assert.equal(r.categoria, 'fail');
  assert.match(r.salida, /TS2322/);
});
