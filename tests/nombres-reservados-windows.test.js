// @ts-check
/**
 * H-9 de la revisión independiente (BAJA): en Windows, además de CON, PRN, AUX, NUL, COM1-9 y LPT1-9,
 * son dispositivos reservados `COM¹`, `COM²`, `COM³`, `LPT¹`, `LPT²` y `LPT³` (con superíndices), y se
 * aplican aunque lleven extensión (`COM¹.txt`). Las listas del protocolo del ciclo y del módulo de rutas de
 * las integraciones deben rechazarlos igual que a COM1.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { validarRuta } from '../core/ciclo/protocolo-archivos.js';
import { motivoRutaVetada } from '../core/integraciones/rutas.js';

const RESERVADOS = ['COM1', 'LPT9.log', 'COM¹', 'com².txt', 'COM³', 'LPT¹', 'lpt².md', 'sub/LPT³.js', 'CON', 'nul.txt'];
const LEGITIMOS = ['src/comun.js', 'lib/lpt.js', 'docs/com.md', 'src/console.js', 'a/COMM.js'];

describe('nombres de dispositivo reservados de Windows', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'forge-reservados-'));

  test('el protocolo del ciclo los rechaza', () => {
    for (const r of RESERVADOS) {
      const v = validarRuta(cwd, r);
      assert.equal(v.ok, false, `${JSON.stringify(r)} debe rechazarse`);
    }
  });

  test('el protocolo del ciclo deja pasar nombres parecidos pero legítimos', () => {
    for (const r of LEGITIMOS) assert.equal(validarRuta(cwd, r).ok, true, r);
  });

  test('el módulo de rutas de las integraciones los rechaza', () => {
    for (const r of RESERVADOS) assert.notEqual(motivoRutaVetada(r), null, `${JSON.stringify(r)} debe rechazarse`);
  });

  test('el módulo de rutas de las integraciones deja pasar los legítimos', () => {
    for (const r of LEGITIMOS) assert.equal(motivoRutaVetada(r), null, r);
  });
});
