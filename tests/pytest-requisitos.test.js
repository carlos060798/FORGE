// @ts-check
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { requierePytest, usaPytest, instalaPytest, problemaConPytest, inclusiones } from '../core/pytest-deteccion.js';
import { comprobarProyecto } from '../core/sandbox/preparar-imagen.js';

const proyecto = (archivos) => {
  const d = mkdtempSync(join(tmpdir(), 'forge-pytest-'));
  for (const [n, c] of Object.entries(archivos)) {
    mkdirSync(join(d, n, '..'), { recursive: true });
    writeFileSync(join(d, n), c);
  }
  return d;
};

describe('requisitos de pytest (N4)', () => {
  test('continuación de línea y fragmento #egg=', () => {
    assert.equal(requierePytest('pytest \\\n  >=8\n'), true);
    assert.equal(requierePytest('requests \\\n  pytest\n'), false, 'la continuación es parte de la misma línea');
    assert.equal(requierePytest('-e git+https://x/y.git#egg=pytest\n'), true);
    assert.equal(requierePytest('git+https://x/y.git#egg=pytest-cov&subdirectory=a\n'), true);
    assert.equal(requierePytest('git+https://x/y.git#egg=pytest-runner\n'), false);
    assert.equal(requierePytest('git+https://x/y.git#egg=otro\n'), false);
    assert.equal(requierePytest('# pytest \\\nrequests\n'), false, 'un comentario no se une');
  });

  test('inclusiones -r y -c', () => {
    assert.deepEqual(inclusiones('-r base.txt\n--requirement=otro.txt\n-c cons.txt\nrequests\n').map((i) => i.archivo), ['base.txt', 'otro.txt', 'cons.txt']);
  });

  test('usaPytest sigue -r dentro del proyecto, con tope de profundidad', () => {
    const d = proyecto({ 'requirements-dev.txt': '-r base.txt\n', 'base.txt': 'pytest\n' });
    assert.equal(usaPytest(d), true);
    const hondo = proyecto({ 'requirements-dev.txt': '-r a.txt\n', 'a.txt': '-r b.txt\n', 'b.txt': '-r c.txt\n', 'c.txt': '-r d.txt\n', 'd.txt': '-r e.txt\n', 'e.txt': 'pytest\n' });
    assert.equal(usaPytest(hondo), false, 'más allá de la profundidad máxima no se sigue');
    const ciclo = proyecto({ 'requirements-dev.txt': '-r a.txt\n', 'a.txt': '-r requirements-dev.txt\n' });
    assert.equal(usaPytest(ciclo), false);
  });

  test('no sigue rutas que salen del proyecto ni enlaces', () => {
    const fuera = proyecto({ 'otro.txt': 'pytest\n' });
    const d = proyecto({ 'requirements-dev.txt': `-r ../${fuera.split(/[\\/]/).pop()}/otro.txt\n-r ${join(fuera, 'otro.txt').replace(/\\/g, '/')}\n` });
    assert.equal(usaPytest(d), false);
    let enlace = true;
    const e = proyecto({ 'requirements-dev.txt': '-r enlace.txt\n' });
    try { symlinkSync(join(fuera, 'otro.txt'), join(e, 'enlace.txt')); } catch { enlace = false; }
    if (enlace) assert.equal(usaPytest(e), false, 'un enlace simbólico no se sigue');
  });

  test('instalaPytest = lo que instala la imagen: un -r no se resuelve y la comprobación previa lo dice', () => {
    const d = proyecto({ 'requirements.txt': '-r base.txt\n', 'base.txt': 'pytest\n' });
    assert.equal(instalaPytest(d), false);
    const p = problemaConPytest(d, 'pytest -q');
    assert.match(p ?? '', /base\.txt.*no se resuelve en la imagen.*pytest no llegará/);
    assert.match(comprobarProyecto(d, 'python', 'pytest -q') ?? '', /pytest no llegará/);
    // con pytest en el propio requirements.txt, todo bien
    const ok = proyecto({ 'requirements.txt': 'pytest \\\n  >=8\n' });
    assert.equal(instalaPytest(ok), true);
    assert.equal(problemaConPytest(ok, 'pytest -q'), null);
  });
});
