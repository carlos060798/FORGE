// @ts-check
/**
 * F1.1 — Contrato del proveedor de trabajo (core/integraciones/puerto.js).
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { exigirProveedor, MODOS, OPERACIONES, PROVEEDORES, validarProveedor } from '../core/integraciones/puerto.js';

const falso = () => ({
  nombre: 'falso',
  leerElemento: async () => ({}),
  comentar: async () => ({ id: '1' }),
  proponerCambio: async () => ({ id: '2' }),
  comprobarAlcance: async () => ({ lectura: true, escritura: false, excede: false, verificable: true }),
});

describe('F1.1 puerto: contrato del proveedor', () => {
  test('un proveedor falso completo cumple el contrato', () => {
    const r = validarProveedor(falso());
    assert.deepEqual(r, { ok: true, faltan: [], genericas: [] });
    assert.doesNotThrow(() => exigirProveedor(falso()));
  });

  test('uno incompleto se rechaza y dice qué le falta', () => {
    const p = falso();
    delete /** @type {any} */ (p).proponerCambio;
    delete /** @type {any} */ (p).comprobarAlcance;
    const r = validarProveedor(p);
    assert.equal(r.ok, false);
    assert.deepEqual(r.faltan, ['proponerCambio', 'comprobarAlcance']);
    assert.throws(() => exigirProveedor(p), /proponerCambio, comprobarAlcance/);
  });

  test('sin nombre, o con un nombre raro, se rechaza', () => {
    assert.ok(validarProveedor({ ...falso(), nombre: undefined }).faltan.includes('nombre'));
    assert.ok(validarProveedor({ ...falso(), nombre: 'GitHub; rm -rf' }).faltan.includes('nombre'));
  });

  test('una operación es una función, no cualquier valor', () => {
    const r = validarProveedor({ ...falso(), comentar: 'si' });
    assert.deepEqual(r.faltan, ['comentar']);
  });

  test('nada que no sea un objeto', () => {
    for (const x of [null, undefined, 3, 'github']) assert.equal(validarProveedor(x).ok, false);
  });

  test('una operación genérica «llamar a la API» se rechaza, también si viene de un prototipo', () => {
    for (const nombre of ['llamar', 'request', 'fetch', 'api', 'ejecutar']) {
      const p = { ...falso(), [nombre]: async () => ({}) };
      const r = validarProveedor(p);
      assert.equal(r.ok, false, nombre);
      assert.deepEqual(r.genericas, [nombre]);
    }
    class Base { async request() { return 1; } }
    class Adaptador extends Base {
      nombre = 'heredado';
      async leerElemento() {} async comentar() {} async proponerCambio() {} async comprobarAlcance() {}
    }
    assert.deepEqual(validarProveedor(new Adaptador()).genericas, ['request']);
  });

  test('las constantes del contrato son cerradas', () => {
    assert.deepEqual([...OPERACIONES], ['leerElemento', 'comentar', 'proponerCambio', 'comprobarAlcance']);
    assert.deepEqual([...MODOS], ['apagado', 'solo_lectura', 'comentar', 'proponer']);
    assert.deepEqual([...PROVEEDORES], ['github', 'gitlab', 'jira']);
    assert.ok(Object.isFrozen(OPERACIONES) && Object.isFrozen(MODOS) && Object.isFrozen(PROVEEDORES));
  });
});
