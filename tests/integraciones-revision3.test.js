// @ts-check
/**
 * Revisión independiente 3 (quinta pasada): N3-01 clave atómica, N3-02 estado dentro del proyecto,
 * N3-03 leer no crea, N3-06 manifiestos nuevos. Todo local, sin red ni tokens.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { claveLocal, directorioDeEstado, existeEstado, rutaDeEstado } from '../core/integraciones/estado-usuario.js';
import { leerAlcance, listarNoAutenticados, listarPendientes } from '../core/integraciones/aprobacion.js';
import { clasificarManifiesto } from '../core/integraciones/rutas.js';

const AQUI = dirname(fileURLToPath(import.meta.url));
const temporal = (/** @type {string} */ p) => mkdtempSync(join(tmpdir(), `forge-r3-${p}-`));

describe('N3-01: la clave se crea completa o no aparece', () => {
  test('seis procesos a la vez obtienen la misma clave, sin error de «dañada»', async () => {
    const home = temporal('home');
    const proyecto = temporal('proy');
    const modulo = join(AQUI, '..', 'core', 'integraciones', 'estado-usuario.js');
    const codigo = `import(${JSON.stringify('file:///' + modulo.replace(/\\/g, '/'))}).then(m => { const d = m.directorioDeEstado(process.argv[1]); process.stdout.write(m.claveLocal(d).toString('hex')); });`;
    for (let ronda = 0; ronda < 5; ronda++) {
      const cwd = join(proyecto, `r${ronda}`);
      mkdirSync(cwd);
      const salidas = await Promise.all(Array.from({ length: 6 }, () => new Promise((resolver) => {
        const p = spawn(process.execPath, ['--input-type=module', '-e', codigo, cwd], { env: { ...process.env, FORGE_HOME: home } });
        let out = ''; let err = '';
        p.stdout.on('data', (d) => { out += d; });
        p.stderr.on('data', (d) => { err += d; });
        p.on('close', (c) => resolver({ c, out, err }));
      })));
      for (const s of /** @type {any[]} */ (salidas)) assert.equal(s.c, 0, s.err);
      assert.equal(new Set(/** @type {any[]} */ (salidas).map((s) => s.out)).size, 1, 'todas ven la misma clave');
    }
  });

  test('no quedan temporales junto a la clave', () => {
    const home = temporal('home');
    const cwd = temporal('proy');
    const dir = directorioDeEstado(cwd, { FORGE_HOME: home });
    claveLocal(dir);
    assert.deepEqual(readdirSync(dir).filter((n) => n.endsWith('.tmp')), []);
  });
});

describe('N3-02: el estado no puede caer dentro del proyecto', () => {
  test('FORGE_HOME dentro del proyecto se rechaza', () => {
    const cwd = temporal('proy');
    const dentro = join(cwd, '.estado');
    assert.throws(() => rutaDeEstado(cwd, { FORGE_HOME: dentro }), /DENTRO del proyecto/);
    assert.throws(() => directorioDeEstado(cwd, { FORGE_HOME: dentro }), /DENTRO del proyecto/);
    assert.equal(existsSync(dentro), false);
  });

  test('FORGE_HOME fuera del proyecto vale', () => {
    const cwd = temporal('proy');
    const fuera = temporal('fuera');
    assert.ok(rutaDeEstado(cwd, { FORGE_HOME: fuera }).startsWith(fuera));
  });
});

describe('N3-03: leer no crea estado', () => {
  test('listar y leer alcance sin estado no crean carpeta ni clave', () => {
    const home = temporal('home');
    const cwd = temporal('proy');
    const env = { FORGE_HOME: home };
    assert.equal(existeEstado(cwd, env), false);
    assert.deepEqual(listarPendientes(cwd, env), []);
    assert.deepEqual(leerAlcance(cwd, env), {});
    assert.deepEqual(listarNoAutenticados(cwd, env), []);
    assert.deepEqual(readdirSync(home), []);
  });
});

describe('N3-06: lanzadores y ganchos no se proponen sin aprobación por archivo', () => {
  for (const ruta of ['gradlew', 'mvnw', 'configure', 'build.rs', 'lefthook.yml', 'hooks/pre-commit', 'pre-commit', 'sub/gradlew.bat']) {
    test(ruta, () => assert.ok(clasificarManifiesto(ruta), `${ruta} debe clasificarse`));
  }
  test('un archivo normal no se clasifica', () => {
    assert.equal(clasificarManifiesto('src/util.js'), null);
    assert.equal(readFileSync(join(AQUI, '..', 'package.json'), 'utf8').length > 0, true);
  });
});
