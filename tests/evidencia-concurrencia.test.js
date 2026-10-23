// @ts-check
/**
 * E-1 de la revisión independiente 2: dos `--registrar` a la vez leían la misma cabeza y ambos añadían un
 * informe sobre ella: la cadena quedaba BIFURCADA sin reparación. Ahora el registro encadenado va bajo un
 * candado del proyecto, así que cada informe se encadena a la cabeza anterior real.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const HIJO = join(RAIZ, 'tests', 'fixtures', 'evidencia-registrar-hijo.mjs');
const cwd = mkdtempSync(join(tmpdir(), 'forge-e1-'));
const home = mkdtempSync(join(tmpdir(), 'forge-e1-home-'));
mkdirSync(join(cwd, '.sdd'), { recursive: true });
writeFileSync(join(cwd, '.sdd', 'sdd.config.yaml'), 'proyecto: x\n');

/** @param {number} duracion */
function lanzar(duracion) {
  return new Promise((ok) => {
    const p = spawn(process.execPath, [HIJO, cwd, String(duracion)], { env: { ...process.env, FORGE_HOME: home, FRAGUA_HOME: home } });
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', (c) => ok({ c, err }));
  });
}

test('E-1: dos registros simultáneos dejan una cadena íntegra, sin bifurcar', async () => {
  const [a, b] = await Promise.all([lanzar(1), lanzar(2)]);
  assert.equal(a.c, 0, a.err);
  assert.equal(b.c, 0, b.err);
  const { comprobarEvidencia } = await import('../core/evidencia/cadena.js');
  const r = comprobarEvidencia(cwd, { env: { FORGE_HOME: home, FRAGUA_HOME: home } });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  assert.equal(readdirSync(join(cwd, '.sdd', 'verificaciones')).filter((n) => n.endsWith('.json')).length, 10);
});
