// @ts-check
/**
 * La política de destinos permitidos es una variable de política: se lee con la función única de entorno,
 * acepta las dos formas (FRAGUA_ y FORGE_) y, si difieren, no autoriza ningún destino extra.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leerPoliticaDestinos } from '../core/ciclo/politica-destinos.js';

test('solo la forma nueva', () => {
  assert.deepEqual(leerPoliticaDestinos({ FRAGUA_DESTINOS_PERMITIDOS: 'api.a.net, *.b.net' }).destinos_permitidos, ['api.a.net', '*.b.net']);
});

test('solo la forma antigua', () => {
  assert.deepEqual(leerPoliticaDestinos({ FORGE_DESTINOS_PERMITIDOS: 'api.a.net' }).destinos_permitidos, ['api.a.net']);
});

test('las dos iguales', () => {
  const e = { FRAGUA_DESTINOS_PERMITIDOS: 'api.a.net', FORGE_DESTINOS_PERMITIDOS: 'api.a.net' };
  assert.deepEqual(leerPoliticaDestinos(e).destinos_permitidos, ['api.a.net']);
});

test('las dos distintas: ningún destino extra (nunca gana la lista más amplia)', () => {
  const e = { FRAGUA_DESTINOS_PERMITIDOS: 'api.a.net', FORGE_DESTINOS_PERMITIDOS: 'api.a.net,evil.example' };
  assert.deepEqual(leerPoliticaDestinos(e).destinos_permitidos, []);
});

test('sin variable: lista vacía', () => {
  assert.deepEqual(leerPoliticaDestinos({}).destinos_permitidos, []);
});
