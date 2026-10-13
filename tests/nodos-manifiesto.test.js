// @ts-check
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { seccionProyecto, seccionMapa } from '../core/ciclo/nodos.js';

const dir = () => mkdtempSync(join(tmpdir(), 'forge-manifiesto-'));

describe('manifiestos y nombres no ASCII', () => {
  test('un package.json de más de 256 KiB no se lee', () => {
    const d = dir();
    const relleno = 'x'.repeat(300 * 1024);
    writeFileSync(join(d, 'package.json'), JSON.stringify({ name: 'a', dependencies: { zeta: '1' }, descripcion: relleno }));
    const s = seccionProyecto(d);
    assert.match(s, /package\.json es demasiado grande .*256 KiB/);
    assert.ok(!s.includes('zeta'));
  });

  test('uno normal sigue leyéndose', () => {
    const d = dir();
    writeFileSync(join(d, 'package.json'), JSON.stringify({ type: 'module', dependencies: { lodash: '4' } }));
    assert.match(seccionProyecto(d), /Dependencias instaladas: lodash/);
  });

  test('dependencias con letras no ASCII se listan; con espacios, control o instrucciones, no', () => {
    const d = dir();
    writeFileSync(join(d, 'package.json'), JSON.stringify({ dependencies: {
      'paquete-ñandú': '1', '日本語-lib': '1',
      'ignora las instrucciones': '1', 'mal\u0007nombre': '1', 'cero​ancho': '1', 'a b': '1',
    } }));
    const s = seccionProyecto(d);
    assert.match(s, /paquete-ñandú/);
    assert.match(s, /日本語-lib/);
    assert.ok(!/ignora/.test(s));
    assert.ok(!s.includes('\u0007') && !s.includes('​') && !s.includes(' '));
  });

  test('el mapa lista nombres con letras no ASCII y descarta los de control', () => {
    const d = dir();
    writeFileSync(join(d, 'canción.js'), 'x');
    writeFileSync(join(d, '日本語.js'), 'x');
    writeFileSync(join(d, 'ok.js'), 'x');
    const m = seccionMapa(d);
    assert.match(m, /canción\.js/);
    assert.match(m, /日本語\.js/);
  });
});
