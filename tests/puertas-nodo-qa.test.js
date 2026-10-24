// @ts-check
/**
 * Fase B2: el nodo de QA, tras una ejecución `pass`, pasa por las puertas declaradas (si las hay). Una puerta
 * que falla deja la tarea en `revision_humana` aunque las pruebas pasen. Sin puertas, el comportamiento es el
 * de siempre (la prueba de regresión la cubre ciclo-hallazgos).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejecucionQaConPuertas } from '../core/puertas/ciclo.js';

test('pruebas que pasan + puerta que falla: no se aprueba y se pide revisión', async () => {
  const r = await ejecucionQaConPuertas({
    categoria: 'pass',
    puertas: async () => [{ nombre: 'tipos', categoria: 'falla', exitCode: 2 }],
  });
  assert.equal(r.categoria, 'fail');
  // Una puerta que falla no es una revisión humana: el ciclo puede reintentar. Solo la herramienta ausente la pide.
  assert.equal(r.revision, false);
  assert.match(r.motivo, /tipos/);
});

test('pruebas que pasan + puertas que pasan: se aprueba', async () => {
  const r = await ejecucionQaConPuertas({ categoria: 'pass', puertas: async () => [{ nombre: 'tipos', categoria: 'pasa', exitCode: 0 }] });
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
