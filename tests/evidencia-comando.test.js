/**
 * `forge verificar --comprobar-evidencia`: solo lectura, códigos de salida y rechazo de combinaciones.
 */
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, rmSync, realpathSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cmdVerificar, leerOpciones } from '../cli/verificar.js';
import { registrarVerificacion } from '../core/verificar/registro.js';
import { crearResultado } from '../core/verificar/resultado.js';

/** @type {string[]} */ const temporales = [];
const temp = (/** @type {string} */ p) => { const d = realpathSync(mkdtempSync(join(tmpdir(), `evid-${p}-`))); temporales.push(d); return d; };
after(() => { for (const d of temporales) { try { rmSync(d, { recursive: true, force: true }); } catch { /* ya no está */ } } });

/** Ejecuta con FORGE_HOME temporal y recoge salida. */
async function correr(/** @type {string[]} */ argv, /** @type {string} */ home) {
  const previo = process.env.FORGE_HOME;
  process.env.FORGE_HOME = home;
  /** @type {string[]} */ const out = []; /** @type {string[]} */ const err = [];
  try {
    const codigo = await cmdVerificar(argv, { salida: (t) => out.push(t), errores: (t) => err.push(t) });
    return { codigo, out: out.join('\n'), err: err.join('\n') };
  } finally {
    if (previo === undefined) delete process.env.FORGE_HOME; else process.env.FORGE_HOME = previo;
  }
}

describe('verificar --comprobar-evidencia', () => {
  test('las opciones: se acepta sola o con --cwd/--json; no se combina con nada que ejecute', () => {
    assert.deepEqual(leerOpciones(['--comprobar-evidencia', '--cwd', 'x', '--json']), { json: true, registrar: false, cwd: 'x', comprobarEvidencia: true });
    for (const extra of [['--registrar'], ['--mutacion', '--archivos', 'a'], ['--comando', 'npm test'], ['--desde', 'HEAD']]) {
      const r = leerOpciones(['--comprobar-evidencia', ...extra]);
      assert.ok('error' in r, extra.join(' '));
    }
  });

  test('cadena íntegra: salida 0 y texto; cadena rota: salida 1 con dónde se rompe', async () => {
    const dir = temp('cli'); const home = temp('home');
    const env = { FORGE_HOME: home };
    const ids = [1, 2, 3].map(() => /** @type {any} */ (registrarVerificacion(dir, crearResultado({ veredicto: 'pasa' }), { env })).id);
    let r = await correr(['--comprobar-evidencia', '--cwd', dir], home);
    assert.equal(r.codigo, 0, r.out + r.err);
    assert.match(r.out, /íntegra y firmada \(3 informe/);
    assert.match(r.out, /coincide/);

    const ruta = join(dir, '.sdd', 'verificaciones', `${ids[1]}.json`);
    const j = JSON.parse(readFileSync(ruta, 'utf8')); j.veredicto = 'falla'; writeFileSync(ruta, JSON.stringify(j));
    r = await correr(['--comprobar-evidencia', '--cwd', dir, '--json'], home);
    assert.equal(r.codigo, 1);
    const c = JSON.parse(r.out);
    assert.equal(c.ok, false);
    assert.equal(c.rotura.id, ids[1]);
    assert.equal(c.rotura.tipo, 'alterado');
  });

  test('es de solo lectura: no escribe nada en el proyecto ni crea estado de usuario', async () => {
    const dir = temp('ro'); const home = join(temp('h'), 'nuevo');
    const antes = readdirSync(dir);
    const r = await correr(['--comprobar-evidencia', '--cwd', dir], home);
    assert.equal(r.codigo, 0);
    assert.match(r.out, /sin informes encadenados/);
    assert.deepEqual(readdirSync(dir), antes);
    assert.equal(existsSync(home), false);
  });
});
