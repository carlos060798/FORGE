// @ts-check
/**
 * F2.1 — Adaptador de GitHub (core/integraciones/proveedores/github.js), contra un servidor
 * node:http LOCAL (tests/fixtures/integraciones/servidores/github.mjs). Ninguna prueba toca la red
 * ni usa credenciales reales: el token es un centinela inventado.
 * Cubre también partes de F2.4 (forma común del elemento) y F2.6 (idempotencia por marcador).
 */

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { exigirProveedor, validarProveedor } from '../core/integraciones/puerto.js';
import { AuditoriaIntegraciones, ErrorTopeIntegraciones } from '../core/integraciones/auditoria.js';
import { ErrorHttpIntegracion } from '../core/integraciones/http.js';
import {
  crearProveedorGitHub, ErrorGitHub, MAX_ARCHIVOS, MAX_PAGINAS, MAX_TEXTO,
} from '../core/integraciones/proveedores/github.js';
import { crearServidorGitHub } from './fixtures/integraciones/servidores/github.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const TOKEN = 'github_pat_' + 'CENTINELA9f8e7d6c5b4a39281706f5e4d3c2b1a0';
const SHA_BASE = 'a'.repeat(40);
const HOSTILES = JSON.parse(readFileSync(join(AQUI, 'fixtures', 'integraciones', 'hostiles.json'), 'utf8'));

/** @type {Array<() => Promise<void>>} */
let limpieza = [];
afterEach(async () => {
  for (const f of limpieza.splice(0)) await f();
});

/**
 * @param {Parameters<typeof crearServidorGitHub>[0]} [opSrv]
 * @param {Partial<Parameters<typeof crearProveedorGitHub>[0]>} [opProv]
 */
async function entorno(opSrv, opProv = {}) {
  const srv = await crearServidorGitHub({
    token: TOKEN,
    repos: { 'org/repo': { ramas: { main: SHA_BASE }, incidencias: { 7: { title: 'Título de prueba', body: 'Cuerpo de prueba', user: { login: 'ana' }, labels: [{ name: 'bug' }] } } } },
    ...(opSrv ?? {}),
  });
  limpieza.push(() => srv.cerrar());
  const prov = crearProveedorGitHub({ token: TOKEN, destinos: ['org/repo'], baseUrl: srv.baseUrl, ...opProv });
  return { srv, prov };
}

async function fallo(promesa) {
  try { await promesa; } catch (e) { return e; }
  assert.fail('debía fallar');
}

/** Todo lo que un error expone, serializado: mensaje, pila, propiedades propias y causa. */
function volcado(e) {
  const partes = [String(e?.message), String(e?.stack), String(e?.name)];
  for (const k of Object.getOwnPropertyNames(e ?? {})) partes.push(`${k}=${String(e[k])}`);
  try { partes.push(JSON.stringify(e)); } catch { /* circular */ }
  if (e?.cause) partes.push(volcado(e.cause));
  return partes.join('\n');
}

const PROPUESTA = (extra = {}) => ({
  destino: 'org/repo', base: 'main', rama: 'forge/forge-0001', titulo: 'forge-0001: cambio de prueba',
  descripcion: 'Descripción de prueba', marcador: 'forge-0001',
  archivos: [{ ruta: 'src/a.js', contenido: 'export const a = 1;\n' }, { ruta: 'docs/nota.md', contenido: '# Nota\n' }],
  ...extra,
});

// ── Contrato ────────────────────────────────────────────────────────────────────────────────

describe('F2.1 github: contrato del puerto y construcción', () => {
  test('pasa validarProveedor, sin operaciones genéricas, y está congelado', () => {
    const p = crearProveedorGitHub({ token: TOKEN, destinos: ['org/repo'] });
    const r = validarProveedor(p);
    assert.deepEqual(r, { ok: true, faltan: [], genericas: [] });
    assert.equal(exigirProveedor(p).nombre, 'github');
    assert.ok(Object.isFrozen(p));
    assert.deepEqual(Object.keys(p).sort(), ['comentar', 'comprobarAlcance', 'leerElemento', 'nombre', 'proponerCambio']);
  });

  test('rechaza token vacío, destinos vacíos o con comodín, y bases distintas de api.github.com o local', () => {
    const ok = { token: TOKEN, destinos: ['org/repo'] };
    assert.throws(() => crearProveedorGitHub({ ...ok, token: '' }), TypeError);
    assert.throws(() => crearProveedorGitHub({ ...ok, token: 'a\nb' }), TypeError);
    assert.throws(() => crearProveedorGitHub({ ...ok, destinos: [] }), TypeError);
    assert.throws(() => crearProveedorGitHub({ ...ok, destinos: ['org/*'] }), TypeError);
    assert.throws(() => crearProveedorGitHub({ ...ok, destinos: ['org'] }), TypeError);
    for (const baseUrl of ['https://ghe.empresa.com', 'http://api.github.com', 'https://api.github.com/x', 'https://u:p@api.github.com', 'http://10.0.0.1', 'basura']) {
      const e = (() => { try { crearProveedorGitHub({ ...ok, baseUrl }); } catch (x) { return x; } })();
      assert.ok(e instanceof TypeError, baseUrl);
      assert.ok(!String(e.message).includes('empresa') && !String(e.message).includes('u:p'), 'el mensaje no repite la URL');
    }
    assert.doesNotThrow(() => crearProveedorGitHub({ ...ok, baseUrl: 'https://api.github.com' }));
  });

  test('comprobarAlcance devuelve «no_comprobable» y no hace ninguna petición', async () => {
    const { srv, prov } = await entorno();
    const r = await prov.comprobarAlcance();
    assert.equal(r.estado, 'no_comprobable');
    assert.equal(typeof r.motivo, 'string');
    assert.deepEqual(Object.keys(r).sort(), ['estado', 'motivo']);
    assert.ok(!r.motivo.includes(TOKEN));
    assert.equal(srv.peticiones.length, 0);
  });
});

// ── Destino y referencia: antes de cualquier petición ──────────────────────────────────────

describe('F2.1 github: destino y referencia', () => {
  test('un destino fuera de la lista no hace NINGUNA petición, en las tres operaciones', async () => {
    const { srv, prov } = await entorno({ token: TOKEN, repos: { 'otra/cosa': { incidencias: { 1: { title: 't' } } } } });
    const e1 = await fallo(prov.leerElemento('otra/cosa#1'));
    const e2 = await fallo(prov.comentar('otra/cosa#1', 'hola', { marcador: 'm1' }));
    const e3 = await fallo(prov.proponerCambio(PROPUESTA({ destino: 'otra/cosa' })));
    for (const e of [e1, e2, e3]) {
      assert.ok(e instanceof ErrorGitHub);
      assert.equal(e.codigo, 'destino_no_permitido');
    }
    assert.equal(srv.peticiones.length, 0);
  });

  test('la comparación de destino es exacta (sin prefijos ni comodines) e insensible a mayúsculas', async () => {
    const { srv, prov } = await entorno();
    for (const ref of ['org/repo-extra#7', 'org/rep#7', 'organizacion/repo#7']) {
      assert.equal((await fallo(prov.leerElemento(ref))).codigo, 'destino_no_permitido', ref);
    }
    assert.equal(srv.peticiones.length, 0);
    const el = await prov.leerElemento('ORG/Repo#7');
    assert.equal(el.titulo, 'Título de prueba');
  });

  test('referencias mal formadas se rechazan sin red', async () => {
    const { srv, prov } = await entorno();
    const malas = ['', 'org/repo', 'org/repo#', 'org/repo#0', 'org/repo#-1', 'org/repo#01', 'org/repo#7/../x', 'org/repo#7?x=1', 'org/repo#7#8',
      '../x/y#1', 'org/../x#1', 'org/repo #7', 'org/repo#7\n', 'org/repo%2F#7', 'a'.repeat(300) + '/repo#1', 'org/repo#12345678901', 'org\\repo#7', 'https://github.com/org/repo/issues/7'];
    for (const r of malas) {
      const e = await fallo(prov.leerElemento(r));
      assert.equal(e.codigo, 'referencia_no_valida', JSON.stringify(r));
    }
    for (const r of [undefined, null, 7, {}, []]) {
      assert.equal((await fallo(prov.leerElemento(/** @type {any} */ (r)))).codigo, 'referencia_no_valida');
    }
    assert.equal(srv.peticiones.length, 0);
  });
});

// ── Leer ────────────────────────────────────────────────────────────────────────────────────

describe('F2.1 github: leerElemento', () => {
  test('incidencia sin comentarios: una sola petición y forma normalizada, sin campos de más', async () => {
    const { srv, prov } = await entorno();
    const el = await prov.leerElemento('org/repo#7');
    assert.deepEqual(el, {
      proveedor: 'github', destino: 'org/repo', referencia: 'org/repo#7', titulo: 'Título de prueba', cuerpo: 'Cuerpo de prueba',
      etiquetas: ['bug'], comentarios: [], url: 'https://github.com/org/repo/issues/7', estado: 'open', autor: 'ana', tipo: 'incidencia',
    });
    assert.equal(srv.peticiones.length, 1);
    const [p] = srv.peticiones;
    assert.equal(p.metodo, 'GET');
    assert.equal(p.cabeceras.authorization, `Bearer ${TOKEN}`);
    assert.equal(p.cabeceras.accept, 'application/vnd.github+json');
    assert.ok(!JSON.stringify(el).includes(TOKEN));
  });

  test('con comentarios: los trae, normaliza autor ausente y cuerpo nulo', async () => {
    const { srv, prov } = await entorno({
      token: TOKEN,
      repos: { 'org/repo': { incidencias: { 7: { title: 't', body: null, labels: ['a', { name: 'b' }], user: null } }, comentarios: { 7: [{ body: 'uno', user: { login: 'bea' } }, { body: null, user: null }] } } },
    });
    const el = await prov.leerElemento('org/repo#7');
    assert.equal(el.cuerpo, '');
    assert.equal(el.autor, 'desconocido');
    assert.deepEqual(el.etiquetas, ['a', 'b']);
    assert.deepEqual(el.comentarios, [{ autor: 'bea', cuerpo: 'uno' }, { autor: 'desconocido', cuerpo: '' }]);
    assert.equal(srv.peticiones.length, 2);
    assert.equal(srv.peticiones[1].url, '/repos/org/repo/issues/7/comments?per_page=100&page=1');
  });

  test('pagina por número de página (250 comentarios = 3 páginas) y nunca sigue el enlace Link', async () => {
    const lista = Array.from({ length: 250 }, (_, i) => ({ body: `c${i}`, user: { login: 'u' } }));
    const { srv, prov } = await entorno({ token: TOKEN, repos: { 'org/repo': { incidencias: { 7: { title: 't' } }, comentarios: { 7: lista } } } });
    const el = await prov.leerElemento('org/repo#7');
    assert.equal(el.comentarios.length, 250);
    assert.equal(el.comentarios[249].cuerpo, 'c249');
    assert.equal(el.truncado, undefined);
    assert.deepEqual(srv.peticiones.slice(1).map((p) => p.url), [1, 2, 3].map((n) => `/repos/org/repo/issues/7/comments?per_page=100&page=${n}`));
  });

  test('con más páginas que el tope, corta y lo marca como truncado', async () => {
    const lista = Array.from({ length: (MAX_PAGINAS + 2) * 100 }, (_, i) => ({ body: `c${i}`, user: { login: 'u' } }));
    const { srv, prov } = await entorno({ token: TOKEN, repos: { 'org/repo': { incidencias: { 7: { title: 't' } }, comentarios: { 7: lista } } } });
    const el = await prov.leerElemento('org/repo#7');
    assert.equal(el.truncado, true);
    assert.equal(el.comentarios.length, MAX_PAGINAS * 100);
    assert.equal(srv.peticiones.length, 1 + MAX_PAGINAS);
  });

  test('con más bytes que el tope acumulado, corta y lo marca como truncado', async () => {
    // 9 KiB × 100 = ~900 KiB por página (bajo el tope por respuesta); 3 páginas superan los 2 MiB
    const lista = Array.from({ length: 300 }, (_, i) => ({ body: `${i}:` + 'x'.repeat(9 * 1024), user: { login: 'u' } }));
    const { srv, prov } = await entorno({ token: TOKEN, repos: { 'org/repo': { incidencias: { 7: { title: 't' } }, comentarios: { 7: lista } } } });
    const el = await prov.leerElemento('org/repo#7');
    assert.equal(el.truncado, true);
    assert.equal(el.comentarios.length, 200);
    assert.equal(srv.peticiones.length, 1 + 3);
  });

  test('una página de comentarios que supera el tope por respuesta es un error de tamaño', async () => {
    const lista = Array.from({ length: 100 }, () => ({ body: 'x'.repeat(300 * 1024), user: { login: 'u' } }));
    const { prov } = await entorno({ token: TOKEN, repos: { 'org/repo': { incidencias: { 7: { title: 't' } }, comentarios: { 7: lista } } } });
    const e = await fallo(prov.leerElemento('org/repo#7'));
    assert.ok(e instanceof ErrorHttpIntegracion);
    assert.equal(e.codigo, 'tamano');
  });

  test('una incidencia que es una solicitud de cambio se marca como tal', async () => {
    const { prov } = await entorno({ token: TOKEN, repos: { 'org/repo': { incidencias: { 9: { title: 'PR', body: 'b', pull_request: { url: 'https://api.github.com/x' } } } } } });
    const el = await prov.leerElemento('org/repo#9');
    assert.equal(el.tipo, 'solicitud_de_cambio');
    assert.equal(el.url, 'https://github.com/org/repo/pull/9');
  });

  test('no sigue enlaces de la respuesta: la URL devuelta se construye con la referencia validada', async () => {
    const { srv, prov } = await entorno({ token: TOKEN, repos: { 'org/repo': { incidencias: { 7: { title: 't', html_url: 'https://evil.example/x', url: 'https://evil.example/api', body: '![i](https://evil.example/p.png) https://evil.example' } } } } });
    const el = await prov.leerElemento('org/repo#7');
    assert.equal(el.url, 'https://github.com/org/repo/issues/7');
    assert.ok(srv.peticiones.every((p) => p.url.startsWith('/repos/org/repo/')));
  });

  test('forma inesperada de la respuesta: error tipado, nunca undefined', async () => {
    const casos = [
      { title: 5 }, { title: 't', state: 7 }, { title: 't', body: { x: 1 } }, { title: 't', labels: 'bug' }, { title: 't', labels: [{ nombre: 'x' }] },
      { title: 't', number: 8 },
    ];
    for (const incidencia of casos) {
      const { prov } = await entorno({ token: TOKEN, repos: { 'org/repo': { incidencias: { 7: incidencia } } } });
      const e = await fallo(prov.leerElemento('org/repo#7'));
      assert.ok(e instanceof ErrorGitHub, JSON.stringify(incidencia));
      assert.equal(e.codigo, 'respuesta_invalida', JSON.stringify(incidencia));
    }
    // Un comentario sin id o con cuerpo no textual
    const { prov } = await entorno({ token: TOKEN, repos: { 'org/repo': { incidencias: { 7: { title: 't' } }, comentarios: { 7: [{ body: 12 }] } } } });
    assert.equal((await fallo(prov.leerElemento('org/repo#7'))).codigo, 'respuesta_invalida');
  });

  test('JSON inválido y respuesta que no es un objeto: error tipado', async () => {
    const a = await entorno({ token: TOKEN, repos: { 'org/repo': { incidencias: { 7: { title: 't' } } } }, fallos: [{ patron: /issues\/7$/, estado: 200, cuerpo: '{no es json' }] });
    assert.equal((await fallo(a.prov.leerElemento('org/repo#7'))).codigo, 'respuesta_invalida');
    const b = await entorno({ token: TOKEN, repos: { 'org/repo': { incidencias: { 7: { title: 't' } } } }, fallos: [{ patron: /issues\/7$/, estado: 200, cuerpo: '[1,2]' }] });
    assert.equal((await fallo(b.prov.leerElemento('org/repo#7'))).codigo, 'respuesta_invalida');
    const c = await entorno({ token: TOKEN, repos: { 'org/repo': { incidencias: { 7: { title: 't' } } } }, fallos: [{ patron: /issues\/7$/, estado: 200, cuerpo: 'null' }] });
    assert.equal((await fallo(c.prov.leerElemento('org/repo#7'))).codigo, 'respuesta_invalida');
  });

  test('una respuesta enorme se corta por el tope de bytes', async () => {
    const enorme = JSON.stringify({ number: 7, title: 't', state: 'open', body: 'x'.repeat(3 * 1024 * 1024) });
    const { prov } = await entorno({ token: TOKEN, repos: { 'org/repo': { incidencias: { 7: { title: 't' } } } }, fallos: [{ patron: /issues\/7$/, estado: 200, cuerpo: enorme }] });
    const e = await fallo(prov.leerElemento('org/repo#7'));
    assert.ok(e instanceof ErrorHttpIntegracion);
    assert.equal(e.codigo, 'tamano');
  });
});

describe('F2.1 github: texto hostil (los 52 casos de hostiles.json)', () => {
  test('título, cuerpo, comentario y autor hostiles vuelven tal cual y no cambian ninguna ruta', async () => {
    assert.equal(HOSTILES.length, 52);
    const incidencias = {};
    const comentarios = {};
    HOSTILES.forEach((h, i) => {
      const n = i + 1;
      incidencias[n] = { title: h.titulo, body: h.cuerpo, user: { login: h.titulo.slice(0, 30) }, labels: [{ name: h.titulo }] };
      comentarios[n] = [{ body: h.cuerpo, user: { login: h.cuerpo.slice(0, 30) } }];
    });
    const { srv, prov } = await entorno({ token: TOKEN, repos: { 'org/repo': { incidencias, comentarios } } });
    for (let i = 0; i < HOSTILES.length; i++) {
      const h = HOSTILES[i];
      const el = await prov.leerElemento(`org/repo#${i + 1}`);
      assert.equal(el.titulo, h.titulo, h.id);
      assert.equal(el.cuerpo, h.cuerpo, h.id);
      assert.equal(el.comentarios[0].cuerpo, h.cuerpo, h.id);
      assert.equal(el.etiquetas[0], h.titulo, h.id);
      assert.equal(el.url, `https://github.com/org/repo/issues/${i + 1}`);
      assert.equal(typeof el.autor, 'string');
    }
    // 52 incidencias × 2 peticiones, todas a rutas que dependen solo de la referencia validada
    assert.equal(srv.peticiones.length, 104);
    for (const p of srv.peticiones) {
      assert.equal(p.metodo, 'GET');
      assert.match(p.url, /^\/repos\/org\/repo\/issues\/\d{1,2}(?:\/comments\?per_page=100&page=1)?$/);
      assert.ok(!Object.values(p.cabeceras).some((v) => /ignora|DATO-NO-CONFIABLE/i.test(String(v))));
    }
  });

  test('un texto hostil como comentario a publicar solo viaja en el cuerpo JSON, no en la ruta', async () => {
    const { srv, prov } = await entorno();
    const hostil = HOSTILES[0].cuerpo + '\n../../../admin\n%2e%2e/';
    await prov.comentar('org/repo#7', hostil, { marcador: 'h1' });
    const post = srv.peticiones.find((p) => p.metodo === 'POST');
    assert.equal(post?.url, '/repos/org/repo/issues/7/comments');
    assert.equal(post?.cuerpo.body, `${hostil}\n\n<!-- forge:h1 -->`);
  });
});

// ── Comentar (F2.6) ─────────────────────────────────────────────────────────────────────────

describe('F2.1/F2.6 github: comentar es idempotente', () => {
  test('publica una vez con el marcador oculto al final; la segunda llamada no publica', async () => {
    const { srv, prov } = await entorno();
    const a = await prov.comentar('org/repo#7', 'FORGE terminó forge-0001.', { marcador: 'forge-0001' });
    assert.equal(a.existente, false);
    assert.match(a.url, /^https:\/\/github\.com\/org\/repo\/issues\/7#issuecomment-\d+$/);
    const posts = () => srv.peticiones.filter((p) => p.metodo === 'POST');
    assert.equal(posts().length, 1);
    assert.equal(posts()[0].cuerpo.body, 'FORGE terminó forge-0001.\n\n<!-- forge:forge-0001 -->');

    const b = await prov.comentar('org/repo#7', 'FORGE terminó forge-0001.', { marcador: 'forge-0001' });
    assert.equal(b.existente, true);
    assert.equal(b.id, a.id);
    assert.equal(posts().length, 1, 'la segunda llamada no publica');
    // El marcador no depende del texto: otro texto con el mismo marcador tampoco publica
    const c = await prov.comentar('org/repo#7', 'otro texto', { marcador: 'forge-0001' });
    assert.equal(c.existente, true);
    assert.equal(posts().length, 1);
    // Otro marcador sí publica
    const d = await prov.comentar('org/repo#7', 'segundo', { marcador: 'forge-0002' });
    assert.equal(d.existente, false);
    assert.equal(posts().length, 2);
  });

  test('encuentra el marcador en una página posterior', async () => {
    const lista = Array.from({ length: 130 }, (_, i) => ({ body: `c${i}`, user: { login: 'u' } }));
    lista.push({ body: 'ya publicado\n\n<!-- forge:fx -->', user: { login: 'bot' } });
    const { srv, prov } = await entorno({ token: TOKEN, repos: { 'org/repo': { incidencias: { 7: { title: 't' } }, comentarios: { 7: lista } } } });
    const r = await prov.comentar('org/repo#7', 'x', { marcador: 'fx' });
    assert.equal(r.existente, true);
    assert.equal(srv.escrituras().length, 0);
  });

  test('un marcador citado a mitad de un comentario ajeno no cuenta', async () => {
    const lista = [{ body: 'cita: <!-- forge:fx --> y sigue el texto', user: { login: 'otro' } }];
    const { srv, prov } = await entorno({ token: TOKEN, repos: { 'org/repo': { incidencias: { 7: { title: 't' } }, comentarios: { 7: lista } } } });
    const r = await prov.comentar('org/repo#7', 'x', { marcador: 'fx' });
    assert.equal(r.existente, false);
    assert.equal(srv.escrituras().length, 1);
  });

  test('si no se pueden ver todos los comentarios, no publica (podría duplicar)', async () => {
    const lista = Array.from({ length: (MAX_PAGINAS + 1) * 100 }, (_, i) => ({ body: `c${i}`, user: { login: 'u' } }));
    const { srv, prov } = await entorno({ token: TOKEN, repos: { 'org/repo': { incidencias: { 7: { title: 't' } }, comentarios: { 7: lista } } } });
    const e = await fallo(prov.comentar('org/repo#7', 'x', { marcador: 'fx' }));
    assert.equal(e.codigo, 'idempotencia_no_comprobable');
    assert.equal(srv.escrituras().length, 0);
  });

  test('texto demasiado largo, vacío o marcador inválido: sin red', async () => {
    const { srv, prov } = await entorno();
    const largo = 'x'.repeat(MAX_TEXTO);   // con el marcador pasa del tope
    assert.equal((await fallo(prov.comentar('org/repo#7', largo, { marcador: 'm' }))).codigo, 'texto_demasiado_largo');
    assert.equal((await fallo(prov.comentar('org/repo#7', '   ', { marcador: 'm' }))).codigo, 'texto_no_valido');
    for (const marcador of [undefined, '', 'a b', '-->', 'x'.repeat(65), 'a\nb', '<!--']) {
      assert.equal((await fallo(prov.comentar('org/repo#7', 'hola', { marcador: /** @type {any} */ (marcador) }))).codigo, 'marcador_no_valido');
    }
    assert.equal((await fallo(prov.comentar('org/repo#7', 'hola', /** @type {any} */ (undefined)))).codigo, 'marcador_no_valido');
    assert.equal(srv.peticiones.length, 0);
    // El tope exacto sí pasa
    const justo = 'x'.repeat(MAX_TEXTO - '\n\n<!-- forge:m -->'.length);
    await prov.comentar('org/repo#7', justo, { marcador: 'm' });
    assert.equal(srv.escrituras().length, 1);
  });

  test('sin permiso de escritura: el error no distingue «sin permiso» de «no existe»', async () => {
    for (const estado of [403, 404]) {
      const { srv, prov } = await entorno({ token: TOKEN, escrituraDenegada: estado });
      const e = await fallo(prov.comentar('org/repo#7', 'hola', { marcador: 'm' }));
      assert.equal(e.codigo, 'sin_permiso_o_no_existe');
      assert.equal(e.estado, estado);
      assert.equal(srv.repo('org/repo').comentarios.get(7), undefined);
    }
  });
});

// ── Proponer cambio ─────────────────────────────────────────────────────────────────────────

describe('F2.1 github: proponerCambio', () => {
  test('rama nueva con prefijo forge/, commits y solicitud en borrador; primero todo lecturas', async () => {
    const { srv, prov } = await entorno();
    const r = await prov.proponerCambio(PROPUESTA());
    assert.deepEqual(r, { id: '100', url: 'https://github.com/org/repo/pull/100', borrador: true, rama: 'forge/forge-0001' });

    const repo = srv.repo('org/repo');
    assert.equal(repo.ramas.get('main'), SHA_BASE, 'la base no se tocó');
    assert.ok(repo.ramas.has('forge/forge-0001'));
    const commit = repo.commits.get(repo.ramas.get('forge/forge-0001'));
    assert.deepEqual(commit.parents, [SHA_BASE]);
    assert.match(commit.message, /^forge-0001: cambio de prueba\n\nforge:forge-0001$/);
    const arbol = repo.arboles.get(commit.tree);
    assert.deepEqual(arbol.map((e) => e.path), ['src/a.js', 'docs/nota.md']);
    assert.ok(arbol.every((e) => e.mode === '100644' && e.type === 'blob'));
    assert.equal(repo.blobs.get(arbol[0].sha), 'export const a = 1;\n');

    const pr = repo.solicitudes[0];
    assert.equal(pr.draft, true);
    assert.equal(pr.head.ref, 'forge/forge-0001');
    assert.equal(pr.base.ref, 'main');
    assert.equal(pr.body, 'Descripción de prueba\n\n<!-- forge:forge-0001 -->');

    // Orden: todas las lecturas van antes de la primera escritura, y la referencia va después del commit
    const metodos = srv.peticiones.map((p) => p.metodo);
    const primeraEscritura = metodos.indexOf('POST');
    assert.ok(primeraEscritura > 0);
    assert.ok(metodos.slice(0, primeraEscritura).every((m) => m === 'GET'));
    assert.ok(metodos.slice(primeraEscritura).every((m) => m === 'POST'));
    const rutas = srv.escrituras().map((p) => p.ruta.replace('/repos/org/repo', ''));
    assert.deepEqual(rutas, ['/git/blobs', '/git/blobs', '/git/trees', '/git/commits', '/git/refs', '/pulls']);
    assert.ok(srv.peticiones.every((p) => ['GET', 'POST'].includes(p.metodo)), 'nunca PATCH, PUT ni DELETE');
  });

  test('una rama base con «/» se codifica segmento a segmento', async () => {
    const { srv, prov } = await entorno({ token: TOKEN, repos: { 'org/repo': { ramas: { 'release/1.0': SHA_BASE, main: SHA_BASE } } } });
    await prov.proponerCambio(PROPUESTA({ base: 'release/1.0' }));
    assert.ok(srv.peticiones.some((p) => p.url === '/repos/org/repo/git/ref/heads/release/1.0'));
    assert.equal(srv.repo('org/repo').solicitudes[0].base.ref, 'release/1.0');
  });

  test('si la rama ya existe: error y CERO escrituras, sin tocarla', async () => {
    const previo = 'b'.repeat(40);
    const { srv, prov } = await entorno({ token: TOKEN, repos: { 'org/repo': { ramas: { main: SHA_BASE, 'forge/forge-0001': previo } } } });
    const e = await fallo(prov.proponerCambio(PROPUESTA()));
    assert.equal(e.codigo, 'rama_existe');
    assert.equal(srv.escrituras().length, 0);
    assert.equal(srv.repo('org/repo').ramas.get('forge/forge-0001'), previo);
  });

  test('una segunda propuesta idéntica falla (rama_existe) sin escribir más', async () => {
    const { srv, prov } = await entorno();
    await prov.proponerCambio(PROPUESTA());
    const antes = srv.escrituras().length;
    const e = await fallo(prov.proponerCambio(PROPUESTA()));
    assert.equal(e.codigo, 'rama_existe');
    assert.equal(srv.escrituras().length, antes);
  });

  test('prefijo no permitido o nombre de rama dudoso: rechazo sin red', async () => {
    const { srv, prov } = await entorno();
    for (const rama of ['main', 'feature/x', 'FORGE/x', 'forge', 'forge/', 'forgex/y', 'refs/heads/forge/x', 'forge/a/b', 'forge/../main', 'forge/x y', 'forge/x\n', 'forge/.x', 'forge/x.lock', 'forge/-x', 'forge/x@{1}', 'forge/' + 'a'.repeat(120)]) {
      const e = await fallo(prov.proponerCambio(PROPUESTA({ rama })));
      assert.ok(['prefijo_rama', 'rama_no_valida'].includes(e.codigo), `${JSON.stringify(rama)} → ${e.codigo}`);
    }
    assert.equal((await fallo(prov.proponerCambio(PROPUESTA({ rama: undefined })))).codigo, 'prefijo_rama');
    assert.equal(srv.peticiones.length, 0);
  });

  test('base inválida: rechazo sin red', async () => {
    const { srv, prov } = await entorno();
    for (const base of ['', 'main\n', '../x', 'a b', 'x'.repeat(250), undefined]) {
      const e = await fallo(prov.proponerCambio(PROPUESTA({ base })));
      assert.equal(e.codigo, 'base_no_valida', JSON.stringify(base));
    }
    assert.equal(srv.peticiones.length, 0);
  });

  test('rutas de archivo maliciosas: rechazo sin red', async () => {
    const { srv, prov } = await entorno();
    const malas = ['../x', 'a/../../x', '/etc/passwd', '\\windows\\x', 'C:\\x', 'c:/x', '.git/config', 'sub/.git/hooks/x', '.GIT/x', '.git', 'a\u0000b', 'a\nb', 'a\u007Fb',
      '.github/workflows/ci.yml', '.GITHUB/workflows/x.yml', 'a//b', './x', 'a/./b', 'dir/', '', 'a\\..\\b', 'x'.repeat(300)];
    for (const ruta of malas) {
      const e = await fallo(prov.proponerCambio(PROPUESTA({ archivos: [{ ruta, contenido: 'x' }] })));
      assert.equal(e.codigo, 'ruta_archivo_no_valida', JSON.stringify(ruta));
    }
    assert.equal(srv.peticiones.length, 0);
    // Los nombres legítimos parecidos pasan
    await prov.proponerCambio(PROPUESTA({ archivos: [{ ruta: '.github/CODEOWNERS', contenido: 'x' }, { ruta: 'a..b/.gitignore', contenido: 'x' }, { ruta: 'src/ñandú.md', contenido: 'x' }] }));
    assert.equal(srv.repo('org/repo').solicitudes.length, 1);
  });

  test('límites de archivos: ninguno, demasiados, duplicados, sin texto, demasiado grande', async () => {
    const { srv, prov } = await entorno();
    const f = (n) => Array.from({ length: n }, (_, i) => ({ ruta: `f${i}.txt`, contenido: 'x' }));
    for (const archivos of [[], f(MAX_ARCHIVOS + 1), [{ ruta: 'a', contenido: 'x' }, { ruta: 'A', contenido: 'y' }], [{ ruta: 'a', contenido: 5 }], [{ ruta: 'a', contenido: 'x'.repeat(1024 * 1024 + 1) }], 'no', [null]]) {
      const e = await fallo(prov.proponerCambio(PROPUESTA({ archivos: /** @type {any} */ (archivos) })));
      assert.equal(e.codigo, 'archivos_no_validos');
    }
    assert.equal(srv.peticiones.length, 0);
  });

  test('título y descripción: sin saltos de línea en el título, tope de tamaño, marcador obligatorio', async () => {
    const { srv, prov } = await entorno();
    assert.equal((await fallo(prov.proponerCambio(PROPUESTA({ titulo: 'a\nb' })))).codigo, 'titulo_no_valido');
    assert.equal((await fallo(prov.proponerCambio(PROPUESTA({ titulo: '' })))).codigo, 'titulo_no_valido');
    assert.equal((await fallo(prov.proponerCambio(PROPUESTA({ descripcion: 'x'.repeat(MAX_TEXTO) })))).codigo, 'texto_demasiado_largo');
    assert.equal((await fallo(prov.proponerCambio(PROPUESTA({ marcador: undefined })))).codigo, 'marcador_no_valido');
    assert.equal(srv.peticiones.length, 0);
  });

  test('sin permiso al leer (404 o 403): error «sin permiso o no existe» y cero escrituras', async () => {
    for (const estado of [404, 403]) {
      const { srv, prov } = await entorno({ token: TOKEN, fallos: [{ metodo: 'GET', patron: /^GET \/repos\/org\/repo$/, estado }] });
      const e = await fallo(prov.proponerCambio(PROPUESTA()));
      assert.equal(e.codigo, 'sin_permiso_o_no_existe');
      assert.equal(e.estado, estado);
      assert.equal(srv.escrituras().length, 0);
    }
    // La rama base no se puede leer
    const { srv, prov } = await entorno({ token: TOKEN, fallos: [{ metodo: 'GET', patron: /git\/ref\/heads\/main$/, estado: 404 }] });
    assert.equal((await fallo(prov.proponerCambio(PROPUESTA()))).codigo, 'sin_permiso_o_no_existe');
    assert.equal(srv.escrituras().length, 0);
  });

  test('sin permiso de escritura (404 y 403): no queda ninguna rama ni solicitud', async () => {
    for (const estado of [404, 403]) {
      const { srv, prov } = await entorno({ token: TOKEN, escrituraDenegada: estado });
      const e = await fallo(prov.proponerCambio(PROPUESTA()));
      assert.equal(e.codigo, 'sin_permiso_o_no_existe');
      assert.deepEqual([...srv.repo('org/repo').ramas.keys()], ['main']);
      assert.equal(srv.repo('org/repo').solicitudes.length, 0);
      // Falló en la primera escritura: no hubo más
      assert.equal(srv.escrituras().length, 1);
    }
  });

  test('un repositorio archivado se rechaza antes de escribir', async () => {
    const { srv, prov } = await entorno({ token: TOKEN, repos: { 'org/repo': { archivado: true, ramas: { main: SHA_BASE } } } });
    assert.equal((await fallo(prov.proponerCambio(PROPUESTA()))).codigo, 'repositorio_archivado');
    assert.equal(srv.escrituras().length, 0);
  });

  test('fallo a mitad, DESPUÉS de crear la rama: la rama queda, no se borra y el error la nombra', async () => {
    const { srv, prov } = await entorno({ token: TOKEN, fallos: [{ metodo: 'POST', patron: /\/pulls$/, estado: 422, cuerpo: JSON.stringify({ message: 'Draft pull requests are not supported in this repository' }) }] });
    const e = await fallo(prov.proponerCambio(PROPUESTA()));
    assert.equal(e.codigo, 'parcial');
    assert.equal(e.rama, 'forge/forge-0001');
    assert.equal(e.causa, 'rechazado_por_plataforma');
    assert.match(e.message, /forge\/forge-0001/);
    assert.match(e.message, /no borra/i);
    assert.ok(srv.repo('org/repo').ramas.has('forge/forge-0001'), 'la rama sigue ahí');
    assert.equal(srv.repo('org/repo').ramas.get('main'), SHA_BASE);
    assert.ok(srv.peticiones.every((p) => p.metodo === 'GET' || p.metodo === 'POST'), 'nunca DELETE ni PATCH');
    assert.ok(!volcado(e).includes('Draft pull requests'), 'no repite el texto de la plataforma');
  });

  test('fallo ANTES de crear la rama (commit): no queda ninguna rama', async () => {
    const { srv, prov } = await entorno({ token: TOKEN, fallos: [{ metodo: 'POST', patron: /git\/commits$/, estado: 500 }] });
    const e = await fallo(prov.proponerCambio(PROPUESTA()));
    assert.equal(e.codigo, 'error_plataforma');
    assert.deepEqual([...srv.repo('org/repo').ramas.keys()], ['main']);
    assert.ok(!srv.peticiones.some((p) => p.ruta.endsWith('/git/refs')));
  });

  test('si GitHub no confirma el borrador en la respuesta, no se afirma borrador', async () => {
    const { prov } = await entorno({ token: TOKEN, fallos: [{ metodo: 'POST', patron: /\/pulls$/, estado: 201, cuerpo: JSON.stringify({ number: 5, state: 'open' }) }] });
    const r = await prov.proponerCambio(PROPUESTA());
    assert.equal(r.borrador, false);
    assert.equal(r.id, '5');
  });

  test('respuesta con forma inesperada al crear: error tipado', async () => {
    const { srv, prov } = await entorno({ token: TOKEN, fallos: [{ metodo: 'POST', patron: /git\/blobs$/, estado: 201, cuerpo: JSON.stringify({ sha: 'no-es-un-sha' }) }] });
    assert.equal((await fallo(prov.proponerCambio(PROPUESTA()))).codigo, 'respuesta_invalida');
    assert.deepEqual([...srv.repo('org/repo').ramas.keys()], ['main']);
  });
});

// ── Token, errores, ritmo ───────────────────────────────────────────────────────────────────

describe('F2.1 github: el token nunca aparece', () => {
  test('ni en errores, ni en lo devuelto, ni en eventos de auditoría, aunque la plataforma lo repita', async () => {
    const eco = JSON.stringify({ message: `Bad credentials ${TOKEN} Bearer ${TOKEN}`, token: TOKEN });
    const dir = mkdtempSync(join(tmpdir(), 'forge-gh-'));
    mkdirSync(join(dir, '.sdd'), { recursive: true });
    const auditoria = new AuditoriaIntegraciones({ cwd: dir, env: {}, tope: 100 });
    const { srv, prov } = await entorno({
      token: TOKEN,
      fallos: [
        { metodo: 'GET', patron: /issues\/1$/, estado: 500, cuerpo: eco },
        { metodo: 'GET', patron: /issues\/2$/, estado: 404, cuerpo: eco },
        { metodo: 'GET', patron: /issues\/3$/, estado: 200, cuerpo: `no json ${TOKEN}` },
        { metodo: 'GET', patron: /issues\/4$/, estado: 403, cuerpo: eco },
        { metodo: 'GET', patron: /issues\/5$/, estado: 401, cuerpo: eco },
        { metodo: 'GET', patron: /issues\/6$/, estado: 301, cabeceras: { location: `https://evil.example/?t=${TOKEN}` } },
        { metodo: 'POST', patron: /\/pulls$/, estado: 422, cuerpo: eco },
      ],
    }, { auditoria });
    const errores = [];
    for (const n of [1, 2, 3, 4, 5, 6]) errores.push(await fallo(prov.leerElemento(`org/repo#${n}`)));
    errores.push(await fallo(prov.leerElemento('org/otro#1')));
    errores.push(await fallo(prov.proponerCambio(PROPUESTA())));
    errores.push(await fallo(prov.proponerCambio(PROPUESTA({ rama: 'main' }))));
    errores.push(await fallo(prov.comentar('org/repo#1', TOKEN + ' mal', { marcador: 'a b' })));
    for (const e of errores) {
      const v = volcado(e);
      assert.ok(!v.includes(TOKEN), `el token aparece en: ${e.codigo ?? e.name}`);
      assert.ok(!/Bearer\s/i.test(v.replace(/Bearer\s*\[REDACTADO\]/g, '')) || !v.includes(TOKEN));
    }
    // Un resultado correcto tampoco lo lleva
    const ok = await prov.leerElemento('org/repo#7');
    assert.ok(!JSON.stringify(ok).includes(TOKEN));
    // Ni los archivos de eventos y de sesión del proyecto
    const raiz = join(dir, '.sdd');
    const archivos = [];
    (function rec(d) { for (const n of readdirSync(d)) { const r = join(d, n); statSync(r).isDirectory() ? rec(r) : archivos.push(r); } })(raiz);
    assert.ok(archivos.length > 0, 'la auditoría dejó archivos');
    for (const f of archivos) assert.ok(!readFileSync(f, 'utf8').includes(TOKEN), f);
    assert.ok(srv.peticiones.length > 0);
  });

  test('el token solo viaja en la cabecera Authorization (nunca en ruta, consulta ni cuerpo)', async () => {
    const { srv, prov } = await entorno();
    await prov.leerElemento('org/repo#7');
    await prov.comentar('org/repo#7', 'hola', { marcador: 'm' });
    await prov.proponerCambio(PROPUESTA());
    for (const p of srv.peticiones) {
      assert.equal(p.cabeceras.authorization, `Bearer ${TOKEN}`);
      assert.ok(!p.url.includes(TOKEN));
      assert.ok(!p.textoCuerpo.includes(TOKEN));
      for (const [k, v] of Object.entries(p.cabeceras)) if (k !== 'authorization') assert.ok(!String(v).includes(TOKEN), k);
    }
  });
});

describe('F2.1 github: errores de plataforma y ritmo', () => {
  test('401, 404, 410, 422 y 500 se traducen a códigos tipados sin usar el cuerpo', async () => {
    const esperado = { 401: 'credencial_invalida', 404: 'sin_permiso_o_no_existe', 410: 'no_disponible', 422: 'rechazado_por_plataforma', 500: 'error_plataforma', 409: 'conflicto' };
    for (const [estado, codigo] of Object.entries(esperado)) {
      const { prov } = await entorno({ token: TOKEN, fallos: [{ patron: /issues\/7$/, estado: Number(estado), cuerpo: '{"message":"TEXTO-DE-LA-PLATAFORMA"}' }] });
      const e = await fallo(prov.leerElemento('org/repo#7'));
      assert.equal(e.codigo, codigo, String(estado));
      assert.equal(e.estado, Number(estado));
      assert.ok(!volcado(e).includes('TEXTO-DE-LA-PLATAFORMA'));
    }
  });

  test('429 con Retry-After se respeta y reintenta (el núcleo); 403 con Retry-After es límite de ritmo sin reintentar', async () => {
    const a = await entorno({ token: TOKEN, repos: { 'org/repo': { incidencias: { 7: { title: 't' } } } }, fallos: [{ patron: /issues\/7$/, estado: 429, cabeceras: { 'retry-after': '0' }, veces: 1 }] });
    const el = await a.prov.leerElemento('org/repo#7');
    assert.equal(el.titulo, 't');
    assert.equal(a.srv.peticiones.length, 2);

    const b = await entorno({ token: TOKEN, fallos: [{ patron: /issues\/7$/, estado: 403, cabeceras: { 'retry-after': '30', 'x-ratelimit-remaining': '0' } }] });
    const e = await fallo(b.prov.leerElemento('org/repo#7'));
    assert.equal(e.codigo, 'limite_ritmo');
    assert.equal(b.srv.peticiones.length, 1);
  });

  test('un token rechazado por la plataforma (401) da un error claro', async () => {
    const srv = await crearServidorGitHub({ token: 'otro-token-distinto', repos: { 'org/repo': { incidencias: { 7: { title: 't' } } } } });
    limpieza.push(() => srv.cerrar());
    const prov = crearProveedorGitHub({ token: TOKEN, destinos: ['org/repo'], baseUrl: srv.baseUrl });
    const e = await fallo(prov.leerElemento('org/repo#7'));
    assert.equal(e.codigo, 'credencial_invalida');
  });
});

// ── Auditoría ───────────────────────────────────────────────────────────────────────────────

describe('F2.1 github: auditoría (opcional)', () => {
  test('cada operación deja su evento y el tope corta antes de la red', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'forge-gh-'));
    mkdirSync(join(dir, '.sdd'), { recursive: true });
    const auditoria = new AuditoriaIntegraciones({ cwd: dir, env: {}, tope: 2 });
    const { srv, prov } = await entorno(undefined, { auditoria });
    await prov.leerElemento('org/repo#7');
    await prov.comentar('org/repo#7', 'hola', { marcador: 'm' });
    const antes = srv.peticiones.length;
    const e = await fallo(prov.leerElemento('org/repo#7'));
    assert.ok(e instanceof ErrorTopeIntegraciones);
    assert.equal(srv.peticiones.length, antes);
    const { EventLog } = await import('../core/event-log.js');
    const evs = new EventLog(join(dir, '.sdd')).readAll().filter((x) => String(x.type).startsWith('integracion:'));
    assert.deepEqual(evs.map((x) => x.type), ['integracion:leer_elemento', 'integracion:comentar', 'integracion:leer_elemento']);
    assert.equal(evs[0].payload.proveedor, 'github');
    assert.equal(evs[0].payload.destino, 'org/repo');
    assert.equal(evs[2].payload.resultado, 'rechazado:tope_operaciones');
  });

  test('con el interruptor apagado no hay ninguna petición', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'forge-gh-'));
    mkdirSync(join(dir, '.sdd'), { recursive: true });
    const auditoria = new AuditoriaIntegraciones({ cwd: dir, env: { FORGE_INTEGRACIONES: 'apagado' } });
    const { srv, prov } = await entorno(undefined, { auditoria });
    await fallo(prov.leerElemento('org/repo#7'));
    await fallo(prov.proponerCambio(PROPUESTA()));
    assert.equal(srv.peticiones.length, 0);
  });

  test('un error de plataforma deja el código tipado en el evento, no el mensaje', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'forge-gh-'));
    mkdirSync(join(dir, '.sdd'), { recursive: true });
    const auditoria = new AuditoriaIntegraciones({ cwd: dir, env: {} });
    const { prov } = await entorno({ token: TOKEN, escrituraDenegada: 403 }, { auditoria });
    await fallo(prov.comentar('org/repo#7', 'hola', { marcador: 'm' }));
    const { EventLog } = await import('../core/event-log.js');
    const [ev] = new EventLog(join(dir, '.sdd')).readAll().filter((x) => String(x.type) === 'integracion:comentar');
    assert.equal(ev.payload.resultado, 'error:sin_permiso_o_no_existe');
  });
});

// ── Opt-in: lo «sin confirmar» solo se puede comprobar con una cuenta real ─────────────────────

const REAL = process.env.FORGE_PRUEBA_GITHUB_REAL === '1'
  && process.env.FORGE_PRUEBA_GITHUB_TOKEN && process.env.FORGE_PRUEBA_GITHUB_DESTINO && process.env.FORGE_PRUEBA_GITHUB_INCIDENCIA;

describe('F2.1 github: contra GitHub real (opt-in; se salta sin FORGE_PRUEBA_GITHUB_REAL=1)', { skip: !REAL && 'requiere cuenta de prueba real; ver verificacion.md' }, () => {
  test('lee la incidencia, comenta una vez y abre una solicitud en borrador (cuerpos de Git Data y campo draft sin confirmar)', async () => {
    const destino = /** @type {string} */ (process.env.FORGE_PRUEBA_GITHUB_DESTINO);
    const prov = crearProveedorGitHub({ token: /** @type {string} */ (process.env.FORGE_PRUEBA_GITHUB_TOKEN), destinos: [destino] });
    const ref = `${destino}#${process.env.FORGE_PRUEBA_GITHUB_INCIDENCIA}`;
    const el = await prov.leerElemento(ref);
    assert.equal(typeof el.titulo, 'string');
    const id = `prueba-${Date.now().toString(36)}`;
    const c1 = await prov.comentar(ref, 'Prueba de FORGE (se puede borrar).', { marcador: id });
    const c2 = await prov.comentar(ref, 'Prueba de FORGE (se puede borrar).', { marcador: id });
    assert.equal(c2.id, c1.id);
    const r = await prov.proponerCambio({
      destino, base: process.env.FORGE_PRUEBA_GITHUB_BASE ?? 'main', rama: `forge/${id}`, titulo: `FORGE prueba ${id}`,
      descripcion: 'Prueba del adaptador. Se puede cerrar y borrar la rama a mano.', marcador: id,
      archivos: [{ ruta: `forge-prueba/${id}.md`, contenido: '# prueba\n' }],
    });
    assert.equal(r.borrador, true);
  });
});
