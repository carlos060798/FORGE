// @ts-check
/**
 * Hallazgo H-2 de la revisión independiente (MEDIA): `precios:` del `.sdd/sdd.config.yaml` del proyecto
 * admitía 0 y ganaba sobre la tabla incluida, así que un repositorio ajeno podía hacer que el gasto de
 * un modelo de pago contara 0 y que el tope de gasto no se alcanzara nunca.
 * Regla: el proyecto puede SUBIR un precio de la tabla, nunca bajarlo; un cero para un modelo desconocido
 * solo vale si el usuario lo nombra en su entorno (FRAGUA_PRECIOS_CERO).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { leerConfigCiclo, limitarPreciosDelProyecto } from '../core/ciclo/config.js';
import { tablaPorToken } from '../core/precios.js';
import { costoDe } from '../core/ciclo/presupuesto.js';

const MODELO = Object.keys(tablaPorToken().anthropic)[0];
const LLAMADA = { proveedor: 'anthropic', modelo: MODELO, inputTokens: 1_000_000, outputTokens: 1_000_000 };

/** @param {string} yaml */
function proyecto(yaml) {
  const cwd = mkdtempSync(join(tmpdir(), 'forge-precios-'));
  mkdirSync(join(cwd, '.sdd'));
  writeFileSync(join(cwd, '.sdd', 'sdd.config.yaml'), yaml);
  return cwd;
}

async function silencioso(fn) {
  const w = console.warn; const avisos = [];
  console.warn = (...a) => avisos.push(a.join(' '));
  try { return await fn(avisos); } finally { console.warn = w; }
}

describe('limitarPreciosDelProyecto', () => {
  test('un precio por debajo de la tabla para un modelo incluido se sube al de la tabla', () => {
    const t = tablaPorToken().anthropic[MODELO];
    const r = limitarPreciosDelProyecto({ [MODELO]: { input: 0, output: 0 } }, { avisar: () => {}, env: {} });
    assert.equal(r[MODELO].input, t.input);
    assert.equal(r[MODELO].output, t.output);
  });

  test('un precio por encima de la tabla se respeta (el proyecto puede apretar)', () => {
    const t = tablaPorToken().anthropic[MODELO];
    const r = limitarPreciosDelProyecto({ [MODELO]: { input: t.input * 3, output: t.output * 3 } }, { avisar: () => {}, env: {} });
    assert.equal(r[MODELO].input, t.input * 3);
  });

  test('un modelo desconocido con precio 0 se descarta salvo que el usuario lo permita', () => {
    const avisos = [];
    const p = { 'modelo-propio': { input: 0, output: 0 } };
    assert.deepEqual(limitarPreciosDelProyecto(p, { avisar: (m) => avisos.push(m), env: {} }), {});
    assert.equal(avisos.length, 1);
    assert.match(avisos[0], /FRAGUA_PRECIOS_CERO/);
    const r = limitarPreciosDelProyecto(p, { avisar: () => {}, env: { FRAGUA_PRECIOS_CERO: 'otro, modelo-propio' } });
    assert.deepEqual(r['modelo-propio'], { input: 0, output: 0 });
  });

  test('un modelo desconocido con precio positivo se acepta', () => {
    const r = limitarPreciosDelProyecto({ nuevo: { input: 1e-6, output: 3e-6 } }, { avisar: () => {}, env: {} });
    assert.deepEqual(r.nuevo, { input: 1e-6, output: 3e-6 });
  });

  test('la variable acepta también el nombre antiguo', () => {
    const r = limitarPreciosDelProyecto({ m: { input: 0, output: 0 } }, { avisar: () => {}, env: { FORGE_PRECIOS_CERO: 'm' } });
    assert.ok(r.m);
  });
});

describe('de extremo a extremo: un repositorio con precio 0', () => {
  test('el gasto de un modelo de la tabla se cuenta con el precio de la tabla', async () => {
    const cwd = proyecto(`precios:\n  ${MODELO}_entrada: 0\n  ${MODELO}_salida: 0\n`);
    await silencioso(() => {
      const config = leerConfigCiclo(cwd);
      const sinProyecto = costoDe(LLAMADA, {});
      const conProyecto = costoDe(LLAMADA, { precios: config.precios });
      assert.ok(sinProyecto > 0, 'la tabla da un coste positivo');
      assert.equal(conProyecto, sinProyecto, 'el cero del proyecto no baja el coste');
    });
  });
});
