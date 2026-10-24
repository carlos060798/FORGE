// @ts-check
/**
 * F3.3 de `2026-10-14-puertas-de-calidad-y-evidencia`: el motivo `puerta` de la revisión y el texto de la
 * puerta en una ejecución, reconocidos por `validarEstado` (core/ciclo/estado.js) y reanudables en `sandbox`.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { MOTIVOS, estadoInicial, validarEstado } from '../core/ciclo/estado.js';
import { transicion, REVISION } from '../core/ciclo/grafo.js';

const base = () => estadoInicial({ id: 'T1', agente: 'desarrollador-backend', prompt: 'p' }, { runId: 'r1', cwd: process.cwd() });

describe('motivo puerta', () => {
  test('MOTIVOS admite «puerta»', () => {
    assert.ok(MOTIVOS.includes('puerta'));
  });

  test('una revisión con motivo puerta es un estado válido', () => {
    const e = { ...base(), revision: { motivo: 'puerta', reanudarEn: 'sandbox', detalle: 'La puerta linter no es ejecutable.' }, resultado: 'revision_pendiente' };
    assert.deepEqual(validarEstado(e), []);
  });

  test('una ejecución con el motivo de la puerta que falla (texto) es un estado válido', () => {
    const ejecucion = { iteracion: 1, categoria: 'fail', exitCode: 2, timedOut: false, oomKilled: false, durationMs: 5, stdoutCola: 'TS2322', stderrCola: '', huellaSalida: 'abc', puerta: 'Las pruebas pasan, pero no pasan todas las puertas: «tipos» falla (código 2).' };
    assert.deepEqual(validarEstado({ ...base(), ejecuciones: [ejecucion], iteracion: 1 }), []);
  });

  test('el motivo de una ejecución de puerta debe ser un texto', () => {
    const ejecucion = { iteracion: 1, categoria: 'fail', exitCode: 2, timedOut: false, oomKilled: false, durationMs: 5, stdoutCola: '', stderrCola: '', puerta: 42 };
    const errores = validarEstado({ ...base(), ejecuciones: [ejecucion], iteracion: 1 });
    assert.ok(errores.some((e) => /puerta/.test(e)), errores.join('; '));
  });

  test('un motivo de revisión desconocido sigue siendo un error', () => {
    const e = { ...base(), revision: { motivo: 'puerta_rota', reanudarEn: 'sandbox' }, resultado: 'revision_pendiente' };
    assert.ok(validarEstado(e).some((x) => /motivo de revisión desconocido/.test(x)));
  });

  test('«continuar» tras una revisión por puerta vuelve al sandbox, que vuelve a ejecutar las puertas', () => {
    const e = { ...base(), revision: { motivo: 'puerta', reanudarEn: 'sandbox', decision: 'continuar' }, resultado: 'revision_pendiente' };
    const t = transicion(REVISION, e);
    assert.equal(t.siguiente, 'sandbox');
  });
});
