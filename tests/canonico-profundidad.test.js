// @ts-check
/**
 * E-2 de la revisión independiente 2: `canonico` es recursivo y un informe anidado a miles de niveles hacía
 * desbordar la pila con un RangeError genérico. Ahora rechaza la profundidad con un error claro.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { canonico } from '../core/estado-usuario.js';

describe('canonico: profundidad', () => {
  test('un objeto anidado a 3000 niveles se rechaza con un error claro, no con RangeError', () => {
    let o = /** @type {any} */ ({ x: 1 });
    for (let i = 0; i < 3000; i++) o = { n: o };
    assert.throws(() => canonico(o), (e) => e instanceof Error && !(e instanceof RangeError) && /demasiado anidado/.test(e.message));
  });

  test('una profundidad razonable sigue funcionando igual', () => {
    let o = /** @type {any} */ ({ x: 1 });
    for (let i = 0; i < 50; i++) o = { n: o };
    assert.equal(typeof canonico(o), 'string');
    assert.equal(canonico({ b: 1, a: [2, { c: 3 }] }), '{"a":[2,{"c":3}],"b":1}');
  });
});
