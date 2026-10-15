// @ts-check
/**
 * Hallazgo H-1 de la revisión independiente (ALTA): un repositorio podía traer `.sdd/motor/sesion.json` y
 * `.sdd/motor/<runId>/tope.json` con un `tope_usd` enorme; `libro.tope()` lo devolvía y el ciclo lo usaba
 * como tope ampliado «por una persona», esquivando el límite de gasto.
 * Ahora el tope ampliado va firmado con la clave local del usuario (fuera del proyecto) y se ignora sin ella.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LibroDeGasto } from '../core/ciclo/diario.js';
import { sesionActual } from '../core/ciclo/index.js';

const anteriores = {};
const NOMBRES = ['FRAGUA_HOME', 'FORGE_HOME'];

before(() => {
  // Estado del usuario en una carpeta propia de la prueba: no toca el de quien la ejecuta
  for (const n of NOMBRES) { anteriores[n] = process.env[n]; delete process.env[n]; }
  process.env.FORGE_HOME = mkdtempSync(join(tmpdir(), 'forge-tope-home-'));
});
after(() => {
  for (const n of NOMBRES) { if (anteriores[n] === undefined) delete process.env[n]; else process.env[n] = anteriores[n]; }
});

/** Proyecto con `.sdd/motor/<runId>/` y el libro de esa sesión. */
function sesion(runId = 'ciclo-abc123') {
  const cwd = mkdtempSync(join(tmpdir(), 'forge-tope-proy-'));
  const dirMotor = join(cwd, '.sdd', 'motor', runId);
  mkdirSync(dirMotor, { recursive: true });
  return { cwd, dirMotor, libro: new LibroDeGasto(dirMotor), runId };
}

describe('tope ampliado del libro de gasto', () => {
  test('un tope.json traído por el proyecto, sin firma, se ignora', () => {
    const s = sesion();
    writeFileSync(join(s.dirMotor, 'tope.json'), JSON.stringify({ tope_usd: 1_000_000 }));
    assert.equal(s.libro.tope(), null);
  });

  test('con una firma inventada o de otra sesión tampoco vale', () => {
    const s = sesion();
    s.libro.guardarTope(5);                                    // genera la clave local
    const otra = sesion('ciclo-otra');
    const bueno = JSON.parse(readFileSync(join(s.dirMotor, 'tope.json'), 'utf8'));
    writeFileSync(join(otra.dirMotor, 'tope.json'), JSON.stringify({ tope_usd: 1_000_000, firma: bueno.firma }));
    assert.equal(otra.libro.tope(), null, 'la firma de otra sesión y otro valor no sirve');
    writeFileSync(join(s.dirMotor, 'tope.json'), JSON.stringify({ tope_usd: 1_000_000, firma: 'a'.repeat(64) }));
    assert.equal(s.libro.tope(), null);
  });

  test('cambiar el valor de un tope legítimo invalida la firma', () => {
    const s = sesion();
    s.libro.guardarTope(5);
    const d = JSON.parse(readFileSync(join(s.dirMotor, 'tope.json'), 'utf8'));
    writeFileSync(join(s.dirMotor, 'tope.json'), JSON.stringify({ ...d, tope_usd: 500 }));
    assert.equal(s.libro.tope(), null);
  });

  test('el tope que guarda el propio usuario sí se respeta', () => {
    const s = sesion();
    s.libro.guardarTope(7.5);
    assert.equal(s.libro.tope(), 7.5);
    assert.equal(new LibroDeGasto(s.dirMotor).tope(), 7.5, 'otra instancia (reanudar) lo lee igual');
  });

  test('leer sin haber guardado nunca no crea estado del usuario', () => {
    const s = sesion();
    const antes = existsSync(process.env.FORGE_HOME ?? '');
    assert.equal(s.libro.tope(), null);
    assert.equal(existsSync(process.env.FORGE_HOME ?? ''), antes);
  });

  test('valores no numéricos o negativos se ignoran', () => {
    const s = sesion();
    for (const v of ['NaN', -3, 0, 'mucho', null]) {
      writeFileSync(join(s.dirMotor, 'tope.json'), JSON.stringify({ tope_usd: v, firma: 'b'.repeat(64) }));
      assert.equal(s.libro.tope(), null, String(v));
    }
  });
});

describe('sesion.json del proyecto', () => {
  test('un sesion.json ajeno sigue sin poder apuntar fuera de .sdd/motor', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'forge-tope-proy-'));
    mkdirSync(join(cwd, '.sdd', 'motor'), { recursive: true });
    writeFileSync(join(cwd, '.sdd', 'motor', 'sesion.json'), JSON.stringify({ runId: '../../fuera' }));
    assert.equal(sesionActual(cwd), null);
  });
});
