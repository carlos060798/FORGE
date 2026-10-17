// @ts-check
/**
 * H-5: la carpeta de estado existente debe ser del propio usuario (revisión independiente 1).
 * En un sistema compartido otro usuario podría haberla creado antes; en POSIX se comprueban uid y
 * modo; en Windows no hay uid y se comprueba que no sea enlace ni unión.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { comprobarPropietarioDelEstado, directorioDeEstado, rutaDeEstado } from '../core/estado-usuario.js';

const carpeta = (/** @type {object} */ o) => ({ isDirectory: () => true, isSymbolicLink: () => false, uid: 1000, mode: 0o40700, ...o });

describe('comprobarPropietarioDelEstado (pura)', () => {
  test('POSIX: carpeta ajena (otro uid) se rechaza', () => {
    assert.throws(() => comprobarPropietarioDelEstado(carpeta({ uid: 0 }), 1000, 'linux'), /no es tuya/);
  });
  test('POSIX: permisos de grupo u otros se rechazan', () => {
    assert.throws(() => comprobarPropietarioDelEstado(carpeta({ mode: 0o40750 }), 1000, 'linux'), /permisos/);
    assert.throws(() => comprobarPropietarioDelEstado(carpeta({ mode: 0o40707 }), 1000, 'darwin'), /permisos/);
  });
  test('POSIX: propia y 0700 vale', () => {
    assert.doesNotThrow(() => comprobarPropietarioDelEstado(carpeta({}), 1000, 'linux'));
  });
  test('Windows: no hay uid; solo se exige que sea una carpeta normal', () => {
    assert.doesNotThrow(() => comprobarPropietarioDelEstado(carpeta({ uid: 0, mode: 0o40777 }), undefined, 'win32'));
    assert.throws(() => comprobarPropietarioDelEstado(carpeta({ isSymbolicLink: () => true }), undefined, 'win32'), /carpeta normal/);
    assert.throws(() => comprobarPropietarioDelEstado(carpeta({ isDirectory: () => false }), undefined, 'win32'), /carpeta normal/);
  });
});

describe('directorioDeEstado con una carpeta preexistente', () => {
  test('un enlace o unión puesto en el lugar de la carpeta se rechaza', (t) => {
    const raiz = mkdtempSync(join(tmpdir(), 'fragua-prop-'));
    const proyecto = mkdtempSync(join(tmpdir(), 'fragua-prop-proy-'));
    const otro = mkdtempSync(join(tmpdir(), 'fragua-prop-otro-'));
    t.after(() => { for (const d of [raiz, proyecto, otro]) rmSync(d, { recursive: true, force: true }); });
    const env = { FRAGUA_HOME: raiz };
    const dir = rutaDeEstado(proyecto, env);
    mkdirSync(join(raiz, 'integraciones'), { recursive: true });
    try { symlinkSync(otro, dir, process.platform === 'win32' ? 'junction' : 'dir'); } catch (e) { return t.skip(`no se pudo crear el enlace: ${/** @type {Error} */ (e).message}`); }
    assert.throws(() => directorioDeEstado(proyecto, env), /carpeta normal|no se usa/);
  });

  test('POSIX: una carpeta propia con modo abierto se corrige a 0700 y se acepta', (t) => {
    if (process.platform === 'win32') return t.skip('Windows no tiene modo POSIX ni uid: su protección es la ACL heredada de %LOCALAPPDATA%');
    const raiz = mkdtempSync(join(tmpdir(), 'fragua-prop-'));
    const proyecto = mkdtempSync(join(tmpdir(), 'fragua-prop-proy-'));
    t.after(() => { for (const d of [raiz, proyecto]) rmSync(d, { recursive: true, force: true }); });
    const env = { FRAGUA_HOME: raiz };
    const dir = directorioDeEstado(proyecto, env);
    chmodSync(dir, 0o755);
    assert.equal(directorioDeEstado(proyecto, env), dir);
  });
});
