// @ts-check
/**
 * El tope de gasto protege al usuario: un `.sdd/sdd.config.yaml` de un repositorio ajeno puede BAJARLO
 * pero no subirlo por encima del valor por defecto (hallazgo de la spec `2026-10-14-ciclo-por-mcp`).
 * Antes: sin la variable de entorno, `presupuesto.tope_usd: 100000` del archivo mandaba sin límite.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { leerConfigCiclo, TOPE_POR_DEFECTO_USD } from '../core/ciclo/config.js';

/** @param {string} yaml */
function proyecto(yaml) {
  const cwd = mkdtempSync(join(tmpdir(), 'forge-tope-'));
  mkdirSync(join(cwd, '.sdd'));
  writeFileSync(join(cwd, '.sdd', 'sdd.config.yaml'), yaml);
  return cwd;
}

/** Ejecuta con las dos variables del tope fijadas (o ausentes) y las restaura; recoge los avisos. */
async function conEntorno(vars, fn) {
  const nombres = ['FRAGUA_BUDGET_USD', 'FORGE_BUDGET_USD'];
  const antes = Object.fromEntries(nombres.map((k) => [k, process.env[k]]));
  for (const k of nombres) delete process.env[k];
  for (const [k, v] of Object.entries(vars)) process.env[k] = v;
  const avisos = [];
  const w = console.warn; console.warn = (...a) => avisos.push(a.join(' '));
  try { return await fn(avisos); } finally {
    console.warn = w;
    for (const k of nombres) { if (antes[k] === undefined) delete process.env[k]; else process.env[k] = antes[k]; }
  }
}

describe('tope de gasto declarado por el proyecto', () => {
  test('un archivo del proyecto no puede subirlo por encima del valor por defecto', async () => {
    const cwd = proyecto('presupuesto:\n  tope_usd: 100000\n');
    await conEntorno({}, (avisos) => {
      assert.equal(leerConfigCiclo(cwd).presupuesto.tope_usd, TOPE_POR_DEFECTO_USD);
      assert.ok(avisos.some((a) => a.includes('tope_usd') && a.includes('FRAGUA_BUDGET_USD')), 'avisa y dice cómo subirlo');
    });
  });

  test('puede bajarlo', async () => {
    const cwd = proyecto('presupuesto:\n  tope_usd: 0.5\n');
    await conEntorno({}, () => {
      assert.equal(leerConfigCiclo(cwd).presupuesto.tope_usd, 0.5);
    });
  });

  test('puede dejarlo igual al valor por defecto', async () => {
    const cwd = proyecto(`presupuesto:\n  tope_usd: ${TOPE_POR_DEFECTO_USD}\n`);
    await conEntorno({}, (avisos) => {
      assert.equal(leerConfigCiclo(cwd).presupuesto.tope_usd, TOPE_POR_DEFECTO_USD);
      assert.equal(avisos.length, 0);
    });
  });

  test('el usuario sí puede subirlo desde su entorno, con cualquiera de los dos nombres', async () => {
    const cwd = proyecto('presupuesto:\n  tope_usd: 100000\n');
    await conEntorno({ FRAGUA_BUDGET_USD: '25' }, () => {
      assert.equal(leerConfigCiclo(cwd).presupuesto.tope_usd, 25);
    });
    await conEntorno({ FORGE_BUDGET_USD: '10' }, () => {
      assert.equal(leerConfigCiclo(cwd).presupuesto.tope_usd, 10);
    });
  });

  test('el entorno del usuario manda sobre el archivo también hacia abajo', async () => {
    const cwd = proyecto('presupuesto:\n  tope_usd: 1.5\n');
    await conEntorno({ FRAGUA_BUDGET_USD: '0.25' }, () => {
      assert.equal(leerConfigCiclo(cwd).presupuesto.tope_usd, 0.25);
    });
  });

  test('el umbral de degradación nunca supera al tope', async () => {
    const cwd = proyecto('presupuesto:\n  tope_usd: 100000\n  umbral_degradacion_usd: 90000\n');
    await conEntorno({}, () => {
      const c = leerConfigCiclo(cwd).presupuesto;
      assert.ok(c.umbral_degradacion_usd <= c.tope_usd);
    });
  });
});
