// @ts-check
/**
 * F1.4 — Cliente HTTP mínimo (core/integraciones/http.js), contra un servidor node:http LOCAL.
 * Ninguna prueba toca la red: el servidor escucha en 127.0.0.1 y `fetch` global, cuando no se está
 * usando de verdad, queda sustituido por uno que lanza.
 */

import { test, describe, before, after, beforeEach, afterEach } from 'node:test';
import './fixtures/integraciones/entorno-usuario.mjs';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

import { ErrorHttpIntegracion, pedir } from '../core/integraciones/http.js';

const TOKEN = 'ghp_' + 'ZZtoken9876543210ABCDEFGHIJKLMNOPQRSTUV';

/** @type {import('node:http').Server} */
let servidor;
let puerto = 0;
/** @type {Array<{ url: string, metodo: string, cabeceras: Record<string, any>, cuerpo: string }>} */
let peticiones = [];
/** @type {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse, n: number) => void} */
let manejador = (_q, r) => { r.end('ok'); };
const realFetch = globalThis.fetch;
/** @type {string[]} */
let llamadasFetch = [];

const host = () => `127.0.0.1:${puerto}`;
const base = (extra = {}) => ({ host: host(), ruta: '/x', permitidos: [host()], _permitirLocal: true, timeoutMs: 3000, ...extra });
const sinEspera = { _esperar: async () => {} };

async function fallo(promesa) {
  try { await promesa; } catch (e) { return e; }
  assert.fail('debía fallar');
}

before(async () => {
  servidor = createServer((req, res) => {
    const trozos = [];
    req.on('data', (c) => trozos.push(c));
    req.on('end', () => {
      peticiones.push({ url: req.url ?? '', metodo: req.method ?? '', cabeceras: { ...req.headers }, cuerpo: Buffer.concat(trozos).toString('utf8') });
      manejador(req, res, peticiones.length);
    });
  });
  await new Promise((r) => servidor.listen(0, '127.0.0.1', () => r(undefined)));
  puerto = /** @type {any} */ (servidor.address()).port;
});

after(async () => {
  servidor.closeAllConnections();
  await new Promise((r) => servidor.close(() => r(undefined)));
});

beforeEach(() => {
  peticiones = [];
  llamadasFetch = [];
  manejador = (_q, r) => { r.end('ok'); };
  // Cualquier uso de fetch que no pase por una prueba deliberada es un fallo
  globalThis.fetch = /** @type {any} */ (async (url) => { llamadasFetch.push(String(url)); throw new Error('fetch bloqueado'); });
});
afterEach(() => { globalThis.fetch = realFetch; });

/** Usa el fetch real, para las pruebas que sí van al servidor local. */
const conRed = () => { globalThis.fetch = realFetch; };

describe('F1.4 http: destino', () => {
  test('un host que no está en la lista no hace ninguna llamada', async () => {
    const e = await fallo(pedir({ host: 'api.otro.example', ruta: '/x', permitidos: ['api.github.com'] }));
    assert.ok(e instanceof ErrorHttpIntegracion);
    assert.equal(e.codigo, 'host_no_permitido');
    assert.deepEqual(llamadasFetch, []);
  });

  test('sin la lista, o con una lista vacía, nada se permite', async () => {
    for (const permitidos of [undefined, []]) {
      const e = await fallo(pedir({ host: 'api.github.com', ruta: '/x', permitidos: /** @type {any} */ (permitidos) }));
      assert.equal(e.codigo, 'host_no_permitido');
    }
    assert.deepEqual(llamadasFetch, []);
  });

  test('el host no lleva esquema, ruta ni credenciales', async () => {
    for (const h of ['http://api.github.com', 'https://api.github.com', 'api.github.com/x', 'u:p@api.github.com', 'api.github.com?x', '']) {
      const e = await fallo(pedir({ host: h, ruta: '/x', permitidos: [h, 'api.github.com'] }));
      assert.ok(e instanceof ErrorHttpIntegracion, h);
      assert.ok(['esquema', 'host'].includes(e.codigo), `${h}: ${e.codigo}`);
    }
    assert.deepEqual(llamadasFetch, []);
  });

  test('HTTPS siempre: 127.0.0.1 y localhost se rechazan sin el interruptor interno', async () => {
    for (const h of ['127.0.0.1:8080', 'localhost:8080', '10.0.0.5', '[::1]:80']) {
      const e = await fallo(pedir({ host: h, ruta: '/x', permitidos: [h] }));
      assert.ok(e instanceof ErrorHttpIntegracion, h);
    }
    assert.deepEqual(llamadasFetch, []);
  });

  test('con el interruptor interno solo se admiten 127.0.0.1 y localhost', async () => {
    for (const h of ['10.0.0.5:80', '192.168.1.1', '169.254.169.254']) {
      const e = await fallo(pedir({ host: h, ruta: '/x', permitidos: [h], _permitirLocal: true }));
      assert.ok(e instanceof ErrorHttpIntegracion, h);
      assert.equal(e.codigo, 'host_no_permitido');
    }
    assert.deepEqual(llamadasFetch, []);
  });

  test('la ruta debe ser una ruta: sin esquema, saltos de línea ni espacios', async () => {
    for (const ruta of ['x', 'https://evil.example/x', '/a b', '/a\r\nHost: evil', '/a\\b', '']) {
      const e = await fallo(pedir(base({ ruta })));
      assert.equal(e.codigo, 'ruta', JSON.stringify(ruta));
    }
    assert.deepEqual(llamadasFetch, []);
  });

  test('métodos: solo GET, HEAD, POST, PUT y PATCH (nunca borrar)', async () => {
    for (const metodo of ['DELETE', 'TRACE', 'CONNECT', 'FOO']) {
      const e = await fallo(pedir(base({ metodo })));
      assert.equal(e.codigo, 'metodo');
    }
    assert.deepEqual(llamadasFetch, []);
  });

  test('una cabecera con salto de línea se rechaza', async () => {
    const e = await fallo(pedir(base({ cabeceras: { 'x-a': 'v\r\nX-Evil: 1' } })));
    assert.equal(e.codigo, 'cabecera');
  });
});

describe('F1.4 http: peticiones', () => {
  test('GET: devuelve estado, cabeceras y texto; envía las cabeceras pedidas y un agente propio', async () => {
    conRed();
    manejador = (_q, r) => { r.setHeader('x-valor', 'a'); r.setHeader('content-type', 'application/json'); r.end('{"a":1}'); };
    const r = await pedir(base({ ruta: '/api/v1?x=1', cabeceras: { authorization: `Bearer ${TOKEN}`, accept: 'application/json' } }));
    assert.equal(r.estado, 200);
    assert.equal(r.ok, true);
    assert.equal(r.texto, '{"a":1}');
    assert.equal(r.cabeceras['x-valor'], 'a');
    assert.equal(peticiones[0].url, '/api/v1?x=1');
    assert.equal(peticiones[0].metodo, 'GET');
    assert.equal(peticiones[0].cabeceras.authorization, `Bearer ${TOKEN}`);
    assert.match(String(peticiones[0].cabeceras['user-agent']), /^forge-integraciones/);
  });

  test('POST con un objeto lo envía como JSON', async () => {
    conRed();
    const r = await pedir(base({ metodo: 'POST', cuerpo: { cuerpo: 'hola ñ' } }));
    assert.equal(r.estado, 200);
    assert.equal(peticiones[0].metodo, 'POST');
    assert.match(String(peticiones[0].cabeceras['content-type']), /application\/json/);
    assert.deepEqual(JSON.parse(peticiones[0].cuerpo), { cuerpo: 'hola ñ' });
  });

  test('un estado de error (404, 500) se devuelve, no se lanza, y no se reintenta', async () => {
    conRed();
    for (const estado of [404, 500, 401]) {
      peticiones = [];
      manejador = (_q, r) => { r.statusCode = estado; r.end('no'); };
      const r = await pedir(base(sinEspera));
      assert.equal(r.estado, estado);
      assert.equal(r.ok, false);
      assert.equal(peticiones.length, 1);
    }
  });
});

describe('F1.4 http: redirecciones', () => {
  test('una redirección a otro host se rechaza', async () => {
    conRed();
    manejador = (_q, r) => { r.statusCode = 302; r.setHeader('location', 'https://evil.example/robar'); r.end(); };
    const e = await fallo(pedir(base()));
    assert.equal(e.codigo, 'redireccion');
    assert.equal(peticiones.length, 1);
    assert.ok(!e.message.includes('robar'), 'la URL de destino no se copia al mensaje');
  });

  test('una redirección a otra ruta del mismo host se rechaza', async () => {
    conRed();
    manejador = (_q, r) => { r.statusCode = 301; r.setHeader('location', '/otra'); r.end(); };
    const e = await fallo(pedir(base()));
    assert.equal(e.codigo, 'redireccion');
  });

  test('una redirección sin Location o con una URL imposible se rechaza', async () => {
    conRed();
    manejador = (_q, r) => { r.statusCode = 302; r.end(); };
    assert.equal((await fallo(pedir(base()))).codigo, 'redireccion');
    manejador = (_q, r) => { r.statusCode = 302; r.setHeader('location', 'http://[::'); r.end(); };
    assert.equal((await fallo(pedir(base()))).codigo, 'redireccion');
  });

  test('una redirección a la misma ruta de un host permitido se sigue una vez, sin enviar credenciales a otro host', async () => {
    conRed();
    const otro = `localhost:${puerto}`;
    manejador = (q, r, n) => {
      if (n === 1) { r.statusCode = 307; r.setHeader('location', `http://${otro}/x?paso=2`); r.end(); } else { r.end('segundo'); }
    };
    const r = await pedir(base({ permitidos: [host(), otro], cabeceras: { authorization: 'Bearer secreto-12345' } }));
    assert.equal(r.texto, 'segundo');
    assert.equal(peticiones.length, 2);
    assert.equal(peticiones[0].cabeceras.authorization, 'Bearer secreto-12345');
    assert.equal(peticiones[1].cabeceras.authorization, undefined);
  });

  test('misma ruta, mismo host: se sigue; pero no más de una vez', async () => {
    conRed();
    manejador = (_q, r) => { r.statusCode = 307; r.setHeader('location', '/x?otra=1'); r.end(); };
    const e = await fallo(pedir(base()));
    assert.equal(e.codigo, 'redireccion');
    assert.equal(peticiones.length, 2);
  });

  test('un POST redirigido no se repite en silencio', async () => {
    conRed();
    manejador = (_q, r) => { r.statusCode = 307; r.setHeader('location', '/x?v=1'); r.end(); };
    const e = await fallo(pedir(base({ metodo: 'POST', cuerpo: 'a' })));
    assert.equal(e.codigo, 'redireccion');
    assert.equal(peticiones.length, 1);
  });
});

describe('F1.4 http: tope de tamaño y tiempo', () => {
  test('una respuesta que supera el tope se corta y se cancela la lectura', async () => {
    conRed();
    let cerrada = false;
    manejador = (_q, r) => {
      r.on('close', () => { cerrada = true; });
      r.write('x'.repeat(2000));
      const t = setInterval(() => { if (!r.writableEnded && !r.destroyed) r.write('x'.repeat(65536)); else clearInterval(t); }, 5);
    };
    const e = await fallo(pedir(base({ maxBytes: 1000 })));
    assert.equal(e.codigo, 'tamano');
    await new Promise((r) => setTimeout(r, 200));
    assert.equal(cerrada, true, 'el servidor debe ver la conexión cerrada');
  });

  test('un Content-Length mayor que el tope se rechaza antes de leer', async () => {
    conRed();
    manejador = (_q, r) => { r.setHeader('content-length', '5000000'); r.write('x'); r.destroy(); };
    const e = await fallo(pedir(base({ maxBytes: 1000 })));
    assert.ok(['tamano', 'red'].includes(e.codigo));
  });

  test('una respuesta justo en el tope se acepta', async () => {
    conRed();
    manejador = (_q, r) => { r.end('y'.repeat(1000)); };
    const r = await pedir(base({ maxBytes: 1000 }));
    assert.equal(r.texto.length, 1000);
  });

  test('el tiempo agotado corta la petición', async () => {
    conRed();
    manejador = () => { /* no responde */ };
    const t0 = Date.now();
    const e = await fallo(pedir(base({ timeoutMs: 150 })));
    assert.equal(e.codigo, 'tiempo');
    assert.ok(Date.now() - t0 < 2000);
  });

  test('el tiempo también cubre una respuesta que se queda a medias', async () => {
    conRed();
    manejador = (_q, r) => { r.write('parcial'); };
    const e = await fallo(pedir(base({ timeoutMs: 200 })));
    assert.equal(e.codigo, 'tiempo');
  });
});

describe('F1.4 http: reintentos', () => {
  test('429 con Retry-After corto: espera lo pedido y reintenta', async () => {
    conRed();
    const esperas = [];
    manejador = (_q, r, n) => {
      if (n === 1) { r.statusCode = 429; r.setHeader('retry-after', '2'); r.end(); } else r.end('ya');
    };
    const r = await pedir(base({ _esperar: async (ms) => { esperas.push(ms); } }));
    assert.equal(r.texto, 'ya');
    assert.deepEqual(esperas, [2000]);
    assert.equal(peticiones.length, 2);
  });

  test('503 sin Retry-After: espera acotada y como mucho 2 reintentos', async () => {
    conRed();
    const esperas = [];
    manejador = (_q, r) => { r.statusCode = 503; r.end(); };
    const r = await pedir(base({ _esperar: async (ms) => { esperas.push(ms); } }));
    assert.equal(r.estado, 503);
    assert.equal(peticiones.length, 3);
    assert.equal(esperas.length, 2);
    for (const ms of esperas) assert.ok(ms > 0 && ms <= 10000);
  });

  test('Retry-After más largo que el tope: no se espera ni se reintenta; se devuelve el 429', async () => {
    conRed();
    const esperas = [];
    manejador = (_q, r) => { r.statusCode = 429; r.setHeader('retry-after', '3600'); r.end(); };
    const r = await pedir(base({ _esperar: async (ms) => { esperas.push(ms); } }));
    assert.equal(r.estado, 429);
    assert.equal(peticiones.length, 1);
    assert.deepEqual(esperas, []);
  });

  test('Retry-After como fecha HTTP se respeta, con el tope', async () => {
    conRed();
    const esperas = [];
    manejador = (_q, r, n) => {
      if (n === 1) { r.statusCode = 429; r.setHeader('retry-after', new Date(Date.now() + 3000).toUTCString()); r.end(); } else r.end('ok');
    };
    await pedir(base({ _esperar: async (ms) => { esperas.push(ms); } }));
    assert.equal(esperas.length, 1);
    assert.ok(esperas[0] > 0 && esperas[0] <= 4000);
  });

  test('los errores de red y de tamaño no se reintentan', async () => {
    conRed();
    manejador = (_q, r) => { r.destroy(); };
    const e = await fallo(pedir(base(sinEspera)));
    assert.equal(e.codigo, 'red');
    assert.equal(peticiones.length, 1);
  });
});

describe('F1.4 http: el token no aparece en errores', () => {
  const secretos = [TOKEN, 'Bearer ' + TOKEN, Buffer.from(`ana@ejemplo.org:${TOKEN}`).toString('base64')];

  function sinSecreto(texto) {
    for (const s of secretos) assert.ok(!texto.includes(s), `aparece ${s.slice(0, 8)}…`);
    assert.ok(!texto.includes(TOKEN.slice(4, 24)));
  }

  test('error de red', async () => {
    conRed();
    manejador = (_q, r) => { r.destroy(); };
    const e = await fallo(pedir(base({ cabeceras: { authorization: `Bearer ${TOKEN}` } })));
    sinSecreto(e.message);
    sinSecreto(JSON.stringify(e, Object.getOwnPropertyNames(e)));
    sinSecreto(String(e.stack));
  });

  test('un fetch cuyo error nombra el token', async () => {
    for (const cab of [`Bearer ${TOKEN}`, `Basic ${Buffer.from(`ana@ejemplo.org:${TOKEN}`).toString('base64')}`, TOKEN]) {
      globalThis.fetch = /** @type {any} */ (async () => { throw new Error(`conexión rechazada con ${cab} y ${TOKEN}`); });
      const e = await fallo(pedir(base({ cabeceras: { authorization: cab } })));
      assert.ok(e instanceof ErrorHttpIntegracion);
      sinSecreto(e.message);
      sinSecreto(JSON.stringify(e, Object.getOwnPropertyNames(e)));
      assert.ok(e.cause === undefined || !String(/** @type {any} */ (e.cause).message ?? e.cause).includes(TOKEN));
    }
  });

  test('un token con formato conocido que no iba en las cabeceras también sale redactado', async () => {
    const otro = 'glpat-' + 'abcdefghijklmnopqrstuvwxyz';
    globalThis.fetch = /** @type {any} */ (async () => { throw new Error(`falló ${otro}`); });
    const e = await fallo(pedir(base()));
    assert.ok(!e.message.includes(otro));
  });

  test('errores de validación y de redirección', async () => {
    conRed();
    manejador = (_q, r) => { r.statusCode = 302; r.setHeader('location', `https://evil.example/?t=${TOKEN}`); r.end(); };
    const e = await fallo(pedir(base({ cabeceras: { authorization: `Bearer ${TOKEN}` } })));
    sinSecreto(e.message);
    const e2 = await fallo(pedir({ host: `evil-${TOKEN}.example`, ruta: '/x', permitidos: ['api.github.com'], cabeceras: { authorization: `Bearer ${TOKEN}` } }));
    sinSecreto(e2.message);
  });
});
