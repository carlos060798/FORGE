// @ts-check
/**
 * F2.2 y F2.5 — Adaptador de GitLab (core/integraciones/proveedores/gitlab.js) contra un servidor
 * node:http LOCAL y falso (tests/fixtures/integraciones/servidores/gitlab.mjs). Ninguna prueba toca
 * la red ni usa credenciales reales; `fetch` global solo se usa contra 127.0.0.1.
 *
 * Aquí también va (saltada por defecto) la prueba opt-in contra una instancia real, que decide el
 * punto «sin confirmar» del parámetro `draft` (FORGE_TEST_INTEGRACIONES=1).
 */

import { BASE_LOCAL } from '../core/integraciones/pruebas-internas.js';
import { auditoriaDePrueba } from './fixtures/integraciones/auditoria-prueba.mjs';
import { test, describe, before, after, beforeEach } from 'node:test';
import './fixtures/integraciones/entorno-usuario.mjs';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { crearProveedorGitLab, ErrorGitLab } from '../core/integraciones/proveedores/gitlab.js';
import { validarProveedor, OPERACIONES } from '../core/integraciones/puerto.js';
import { AuditoriaIntegraciones } from '../core/integraciones/auditoria.js';
import { EventLog } from '../core/event-log.js';
import { crearServidorGitLab } from './fixtures/integraciones/servidores/gitlab.mjs';
import { ROOT } from './helpers.js';

// Valor centinela: tiene formato de token de GitLab para que `redactar` también lo reconozca
const TOKEN = 'glpat-' + 'SENTINELA0123456789abcd';
const HOSTILES = JSON.parse(readFileSync(join(ROOT, 'tests', 'fixtures', 'integraciones', 'hostiles.json'), 'utf8'));
const DESTINO = 'empresa/plataforma/servicios/api';       // dos niveles de subgrupo
const SIMPLE = 'empresa/web';
const enc = encodeURIComponent;

/** @type {Awaited<ReturnType<typeof crearServidorGitLab>>} */
let srv;
const realFetch = globalThis.fetch;
/** @type {string[]} */
let fetchRemotos = [];

before(async () => {
  srv = await crearServidorGitLab({
    token: TOKEN,
    proyectos: {
      [DESTINO]: {
        incidencias: {
          7: {
            title: 'Fallo al guardar', description: 'Pasos para reproducir', labels: ['bug', 'prioridad::alta'],
            notas: [
              { id: 1, body: 'Reproducido en 16.4', author: { username: 'ana' } },
              { id: 2, body: 'closed', system: true },
              { id: 3, body: 'changed title from **a** to **b**', system: true },
              { id: 4, body: 'Yo también', author: { username: 'luis' } },
            ],
          },
        },
        archivos: { 'src/existente.js': 'x' },
        ramas: ['main', 'release/1.0', 'forge/ya-existe'],
      },
      [SIMPLE]: { incidencias: { 1: { title: 't', description: null } }, ramas: ['main'] },
      'empresa/archivado': { archived: true, ramas: ['main'] },
    },
  });
  // Cualquier fetch que no vaya a 127.0.0.1 es un fallo
  globalThis.fetch = /** @type {any} */ (async (url, ...resto) => {
    const u = String(url instanceof URL ? url.href : url);
    if (!u.startsWith('http://127.0.0.1:')) { fetchRemotos.push(u); throw new Error('fetch bloqueado'); }
    return realFetch(url, ...resto);
  });
});
after(async () => { globalThis.fetch = realFetch; await srv.cerrar(); });
beforeEach(() => { srv.peticiones.length = 0; srv.limpiarFallos(); fetchRemotos = []; });

/** @param {Record<string, any>} [extra] */
const crear = (extra = {}) => crearProveedorGitLab({
  token: TOKEN, destinos: [DESTINO, SIMPLE, 'empresa/archivado'], [BASE_LOCAL]: srv.baseUrl, modo: 'proponer', auditoria: auditoriaDePrueba(), _esperar: async () => {}, ...extra,
});

async function fallo(promesa) {
  try { await promesa; } catch (e) { return e; }
  assert.fail('debía fallar');
}
const nuevaRama = (() => { let n = 0; return () => `forge/prueba-${++n}`; })();
const propuesta = (extra = {}) => ({
  destino: DESTINO, base: 'main', rama: nuevaRama(), archivos: [{ ruta: 'src/nuevo.js', contenido: 'export {};\n' }],
  titulo: 'Corrige el guardado', descripcion: 'Descripción.', marcador: 'tarea-1', ...extra,
});

describe('F2.2 GitLab: contrato del puerto', () => {
  test('cumple validarProveedor y no expone operaciones genéricas', () => {
    const p = crear();
    const r = validarProveedor(p);
    assert.deepEqual(r, { ok: true, faltan: [], genericas: [] });
    assert.equal(p.nombre, 'gitlab');
    for (const op of OPERACIONES) assert.equal(typeof p[op], 'function');
    assert.deepEqual(Object.keys(p).sort(), ['comentar', 'comprobarAlcance', 'leerElemento', 'nombre', 'proponerCambio']);
    assert.ok(Object.isFrozen(p));
  });

  test('rechaza una configuración inválida sin mostrar el token', () => {
    for (const mal of [{ token: '' }, { token: 'a\nb' }, { destinos: [] }, { destinos: ['sin-grupo'] }, { destinos: ['a/../b'] }, { modo: 'todo' }, { baseUrl: 'https://127.0.0.1:1' }, { baseUrl: 'http://evil.example' }, { baseUrl: 'http://127.0.0.1:1/x' }]) {
      assert.throws(() => crearProveedorGitLab({ modo: 'proponer', auditoria: auditoriaDePrueba(), token: TOKEN, destinos: [SIMPLE], [BASE_LOCAL]: srv.baseUrl, ...mal }), TypeError);
    }
    try { crearProveedorGitLab({ modo: 'proponer', auditoria: auditoriaDePrueba(), token: '', destinos: [SIMPLE], host: 'gitlab.com' }); } catch (e) { assert.ok(!String(e.message).includes(TOKEN)); }
    assert.throws(() => crearProveedorGitLab({ modo: 'proponer', auditoria: auditoriaDePrueba(), token: TOKEN, destinos: [SIMPLE] }), /host/);
  });
});

describe('F2.2 GitLab: leerElemento', () => {
  test('subgrupos anidados: la ruta del proyecto va con %2F y devuelve el tipo del puerto', async () => {
    const e = await crear().leerElemento(`${DESTINO}#7`);
    assert.deepEqual(Object.keys(e).sort(), ['comentarios', 'cuerpo', 'destino', 'etiquetas', 'proveedor', 'referencia', 'titulo', 'url']);
    assert.equal(e.proveedor, 'gitlab');
    assert.equal(e.destino, DESTINO);
    assert.equal(e.referencia, `${DESTINO}#7`);
    assert.equal(e.titulo, 'Fallo al guardar');
    assert.equal(e.cuerpo, 'Pasos para reproducir');
    assert.deepEqual(e.etiquetas, ['bug', 'prioridad::alta']);
    assert.match(String(e.url), /^http:\/\/127\.0\.0\.1:\d+\//);
    const rutas = srv.peticiones.map((p) => p.ruta);
    assert.ok(rutas.every((r) => r.startsWith(`/api/v4/projects/empresa%2Fplataforma%2Fservicios%2Fapi/`)), rutas.join('\n'));
    assert.ok(srv.peticiones.every((p) => p.metodo === 'GET'));
  });

  test('filtra las notas de sistema y conserva las de personas, con su autor', async () => {
    const e = await crear().leerElemento(`${DESTINO}#7`);
    assert.deepEqual(e.comentarios, [
      { autor: 'ana', cuerpo: 'Reproducido en 16.4' },
      { autor: 'luis', cuerpo: 'Yo también' },
    ]);
  });

  test('el token solo viaja en la cabecera PRIVATE-TOKEN, nunca en la ruta ni en el cuerpo', async () => {
    await crear().leerElemento(`${SIMPLE}#1`);
    for (const p of srv.peticiones) {
      assert.equal(p.cabeceras['private-token'], TOKEN);
      assert.ok(!p.ruta.includes(TOKEN));
      assert.ok(!JSON.stringify(p.cuerpo ?? '').includes(TOKEN));
    }
  });

  test('descripción nula se normaliza a texto vacío', async () => {
    const e = await crear().leerElemento(`${SIMPLE}#1`);
    assert.equal(e.cuerpo, '');
    assert.deepEqual(e.etiquetas, []);
  });

  test('pagina las notas y se detiene en el tope de páginas', async () => {
    const notas = Array.from({ length: 720 }, (_, i) => ({ id: 100 + i, body: `nota ${i}`, author: { username: 'u' } }));
    const s2 = await crearServidorGitLab({ token: TOKEN, porPagina: 100, proyectos: { [SIMPLE]: { incidencias: { 3: { title: 't', description: '', notas } } } } });
    try {
      const p = crearProveedorGitLab({ modo: 'proponer', auditoria: auditoriaDePrueba(), token: TOKEN, destinos: [SIMPLE], [BASE_LOCAL]: s2.baseUrl, _esperar: async () => {} });
      const e = await p.leerElemento(`${SIMPLE}#3`);
      assert.equal(e.comentarios.length, 500, 'tope de 5 páginas de 100');
      assert.equal(e.comentarios[0].cuerpo, 'nota 0');
      const paginas = s2.peticiones.filter((x) => x.ruta.includes('/notes?')).length;
      assert.equal(paginas, 5);
    } finally { await s2.cerrar(); }
  });

  test('con pocas notas lee todas las páginas', async () => {
    const notas = Array.from({ length: 250 }, (_, i) => ({ id: 100 + i, body: `n${i}` }));
    const s2 = await crearServidorGitLab({ token: TOKEN, porPagina: 100, proyectos: { [SIMPLE]: { incidencias: { 3: { title: 't', description: '', notas } } } } });
    try {
      const p = crearProveedorGitLab({ modo: 'proponer', auditoria: auditoriaDePrueba(), token: TOKEN, destinos: [SIMPLE], [BASE_LOCAL]: s2.baseUrl });
      assert.equal((await p.leerElemento(`${SIMPLE}#3`)).comentarios.length, 250);
    } finally { await s2.cerrar(); }
  });

  test('una paginación que apunta a otra página que la siguiente es un error tipado', async () => {
    srv.fallar((m, r) => m === 'GET' && r.includes('/notes?'), 200, [{ id: 1, body: 'x', system: false }], { 'x-next-page': '9' });
    const e = await fallo(crear().leerElemento(`${SIMPLE}#1`));
    assert.ok(e instanceof ErrorGitLab);
    assert.equal(e.codigo, 'forma');
  });

  test('los 52 casos hostiles como título, cuerpo y nota: se devuelven tal cual y no se ejecutan', async () => {
    assert.equal(HOSTILES.length, 52);
    const s2 = await crearServidorGitLab({ token: TOKEN, proyectos: { [SIMPLE]: { incidencias: {} } } });
    try {
      const p = crearProveedorGitLab({ modo: 'proponer', auditoria: auditoriaDePrueba(), token: TOKEN, destinos: [SIMPLE], [BASE_LOCAL]: s2.baseUrl, maxBytes: 4 * 1024 * 1024 });
      let n = 0;
      for (const c of HOSTILES) {
        n++;
        // Un servidor por caso sería lento: se reinstala la incidencia en el estado interno
        s2.proyecto(SIMPLE).incidencias.set(n, { title: c.titulo, description: c.cuerpo, labels: ['x'], notas: [{ id: 1, body: c.cuerpo, author: { username: 'mal' } }, { id: 2, body: c.cuerpo, system: true }] });
        const antes = s2.peticiones.length;
        const e = await p.leerElemento(`${SIMPLE}#${n}`);
        assert.equal(e.titulo, c.titulo, c.id);
        assert.equal(e.cuerpo, c.cuerpo, c.id);
        assert.equal(e.comentarios.length, 1, c.id);
        assert.equal(e.comentarios[0].cuerpo, c.cuerpo, c.id);
        // Solo las dos lecturas previstas, todas a rutas del proyecto: el texto no cambia nada
        const nuevas = s2.peticiones.slice(antes);
        assert.equal(nuevas.length, 2, c.id);
        assert.ok(nuevas.every((x) => x.metodo === 'GET' && x.ruta.startsWith('/api/v4/projects/empresa%2Fweb/issues/')), c.id);
      }
      assert.equal(n, HOSTILES.length);
      assert.deepEqual(fetchRemotos, []);
    } finally { await s2.cerrar(); }
  });

  test('referencias no válidas: error tipado y cero peticiones', async () => {
    const p = crear();
    const malas = [
      '', 'empresa/web', 'empresa/web#', 'empresa/web#0', 'empresa/web#01', 'empresa/web#-1', 'empresa/web#1x', 'empresa/web#1/../../x',
      'empresa/../web#1', '../empresa/web#1', 'empresa//web#1', '/empresa/web#1', 'empresa/web#1\nHost: x', 'empresa/web #1',
      'empresa%2Fweb#1', 'empresa/web?x=1#1', 'empresa/we b#1', 'empresa/web#1234567890', `${'a/'.repeat(25)}b#1`, 'https://gitlab.com/empresa/web#1',
      '.hidden/web#1', 'empresa/.git#1', 'empresa/web#1;DROP', 7, null, undefined, {}, ['empresa/web#1'],
    ];
    for (const r of malas) {
      const e = await fallo(p.leerElemento(/** @type {any} */ (r)));
      assert.ok(e instanceof ErrorGitLab, String(r));
      assert.equal(e.codigo, 'referencia', String(r));
    }
    assert.equal(srv.peticiones.length, 0);
  });

  test('destino fuera de la lista: cero peticiones, también con otra mayúscula y con prefijos', async () => {
    const p = crear();
    for (const r of ['otro/proyecto#1', 'empresa/web/extra#1', 'empresa#1', 'empresa/plataforma#1', `${DESTINO}/mas#1`]) {
      const e = await fallo(p.leerElemento(r));
      assert.ok(e instanceof ErrorGitLab, r);
      assert.ok(['destino', 'referencia'].includes(e.codigo), r);
    }
    assert.equal(srv.peticiones.length, 0);
    // GitLab no distingue mayúsculas en las rutas: se acepta y se usa la forma de la lista
    const e = await p.leerElemento('EMPRESA/Web#1');
    assert.equal(e.destino, SIMPLE);
  });

  test('con el modo apagado no hay peticiones', async () => {
    const p = crear({ modo: 'apagado' });
    for (const op of [() => p.leerElemento(`${SIMPLE}#1`), () => p.comprobarAlcance(), () => p.comentar(`${SIMPLE}#1`, 'x', { marcador: 'a' })]) {
      const e = await fallo(op());
      assert.equal(e.codigo, 'modo');
    }
    assert.equal(srv.peticiones.length, 0);
  });

  test('formas inesperadas de la incidencia y de las notas: error tipado y claro', async () => {
    const formas = [
      [(m, r) => m === 'GET' && /issues\/1$/.test(r), 200, { iid: 99, title: 'x' }],                 // iid distinto
      [(m, r) => m === 'GET' && /issues\/1$/.test(r), 200, ['no', 'objeto']],
      [(m, r) => m === 'GET' && /issues\/1$/.test(r), 200, { iid: 1, title: 5 }],
      [(m, r) => m === 'GET' && /issues\/1$/.test(r), 200, { iid: 1, title: 't', description: 5 }],
      [(m, r) => m === 'GET' && /issues\/1$/.test(r), 200, { iid: 1, title: 't', labels: [1] }],
      [(m, r) => m === 'GET' && /notes\?/.test(r), 200, { no: 'lista' }],
      [(m, r) => m === 'GET' && /notes\?/.test(r), 200, [{ id: 1, body: 7 }]],
      [(m, r) => m === 'GET' && /notes\?/.test(r), 200, ['texto']],
    ];
    for (const [coincide, estado, cuerpo] of formas) {
      srv.limpiarFallos();
      srv.fallar(/** @type {any} */ (coincide), estado, cuerpo);
      const e = await fallo(crear().leerElemento(`${SIMPLE}#1`));
      assert.ok(e instanceof ErrorGitLab);
      assert.equal(e.codigo, 'forma', JSON.stringify(cuerpo));
    }
    srv.limpiarFallos();
    srv.fallar((m, r) => /issues\/1$/.test(r), 200, undefined, {}, '<html>no es json</html>');
    assert.equal((await fallo(crear().leerElemento(`${SIMPLE}#1`))).codigo, 'forma');
  });

  test('estados HTTP de error: tipados, sin copiar el cuerpo de la respuesta', async () => {
    for (const [estado, codigo] of [[401, 'no_autorizado'], [403, 'prohibido'], [404, 'no_encontrado'], [500, 'respuesta_http']]) {
      srv.limpiarFallos();
      srv.fallar((m, r) => /issues\/1$/.test(r), /** @type {number} */ (estado), { message: `SECRETO-DEL-CUERPO ${TOKEN}` });
      const e = await fallo(crear().leerElemento(`${SIMPLE}#1`));
      assert.equal(e.codigo, codigo);
      assert.ok(!e.message.includes('SECRETO-DEL-CUERPO'));
      assert.ok(!e.message.includes(TOKEN));
    }
  });

  test('una respuesta enorme se corta por el tope de http.js', async () => {
    srv.fallar((m, r) => /issues\/1$/.test(r), 200, undefined, {}, JSON.stringify({ iid: 1, title: 't', description: 'x'.repeat(300000) }));
    const e = await fallo(crear({ maxBytes: 100000 }).leerElemento(`${SIMPLE}#1`));
    assert.equal(e.codigo, 'tamano');
  });
});

describe('F2.5 GitLab: comentar', () => {
  test('publica con el marcador oculto y es idempotente', async () => {
    const p = crear();
    const a = await p.comentar(`${DESTINO}#7`, 'Terminé la tarea.', { marcador: 'forge-0001' });
    assert.equal(a.yaExistia, false);
    assert.match(a.id, /^\d+$/);
    const cuerpo = srv.escrituras()[0].cuerpo.body;
    assert.equal(cuerpo, 'Terminé la tarea.\n\n<!-- forge:forge-0001 -->');
    assert.equal(srv.escrituras().length, 1);

    const b = await p.comentar(`${DESTINO}#7`, 'Terminé la tarea.', { marcador: 'forge-0001' });
    assert.equal(b.yaExistia, true);
    assert.equal(b.id, a.id);
    assert.equal(srv.escrituras().length, 1, 'la segunda vez no escribe');

    const c = await p.comentar(`${DESTINO}#7`, 'Otra cosa.', { marcador: 'forge-0002' });
    assert.equal(c.yaExistia, false);
    assert.equal(srv.escrituras().length, 2);
  });

  test('busca antes de publicar: lee las notas y solo entonces escribe', async () => {
    await crear().comentar(`${SIMPLE}#1`, 'hola', { marcador: 'orden-1' });
    const orden = srv.peticiones.map((p) => p.metodo);
    // R7: primero la cuenta propia (GET /user), después las notas y, solo entonces, la escritura
    assert.deepEqual(orden, ['GET', 'GET', 'POST']);
    assert.ok(srv.peticiones[0].ruta.endsWith('/api/v4/user'));
  });

  test('el marcador es obligatorio y tiene forma acotada; el texto también', async () => {
    const p = crear();
    for (const m of [undefined, '', 'a b', '--> x <!--', 'a'.repeat(65), '<!-- forge:x -->', 5]) {
      const e = await fallo(p.comentar(`${SIMPLE}#1`, 'ok', /** @type {any} */ ({ marcador: m })));
      assert.equal(e.codigo, 'marcador');
    }
    for (const t of ['', '   ', 'x'.repeat(60001), 'a\u0000b', 'trae <!-- forge:otro --> dentro', `lleva el ${TOKEN}`, 5, null]) {
      const e = await fallo(p.comentar(`${SIMPLE}#1`, /** @type {any} */ (t), { marcador: 'ok' }));
      assert.equal(e.codigo, 'texto');
    }
    assert.equal(srv.peticiones.length, 0);
  });

  test('con el modo solo_lectura no escribe', async () => {
    const e = await fallo(crear({ modo: 'solo_lectura' }).comentar(`${SIMPLE}#1`, 'x', { marcador: 'a' }));
    assert.equal(e.codigo, 'modo');
    assert.equal(srv.peticiones.length, 0);
  });

  test('destino fuera de la lista: cero peticiones', async () => {
    const e = await fallo(crear().comentar('otro/proyecto#1', 'x', { marcador: 'a' }));
    assert.equal(e.codigo, 'destino');
    assert.equal(srv.peticiones.length, 0);
  });

  test('si no se pueden revisar todas las notas, no publica (evita el duplicado)', async () => {
    const notas = Array.from({ length: 600 }, (_, i) => ({ id: 100 + i, body: `n${i}` }));
    const s2 = await crearServidorGitLab({ token: TOKEN, porPagina: 100, proyectos: { [SIMPLE]: { incidencias: { 3: { title: 't', description: '', notas } } } } });
    try {
      const p = crearProveedorGitLab({ modo: 'proponer', auditoria: auditoriaDePrueba(), token: TOKEN, destinos: [SIMPLE], [BASE_LOCAL]: s2.baseUrl, modo: 'comentar' });
      const e = await fallo(p.comentar(`${SIMPLE}#3`, 'x', { marcador: 'a' }));
      assert.equal(e.codigo, 'tope_paginas');
      assert.equal(s2.escrituras().length, 0);
    } finally { await s2.cerrar(); }
  });

  test('una nota de sistema con el marcador no cuenta como publicada', async () => {
    srv.proyecto(SIMPLE).incidencias.get(1).notas = [{ id: 50, body: 'x <!-- forge:sis-1 -->', system: true }];
    const r = await crear().comentar(`${SIMPLE}#1`, 'hola', { marcador: 'sis-1' });
    assert.equal(r.yaExistia, false);
  });
});

describe('F2.2 GitLab: proponerCambio', () => {
  test('rama nueva, commit y solicitud en borrador con título prefijado «Draft: »', async () => {
    const prop = propuesta({ archivos: [{ ruta: 'src/existente.js', contenido: 'cambia' }, { ruta: 'docs/nuevo.md', contenido: '# nuevo\n' }] });
    const r = await crear().proponerCambio(prop);
    assert.equal(r.borrador, true);
    assert.equal(r.rama, prop.rama);
    assert.match(r.id, /^\d+$/);

    const proy = srv.proyecto(DESTINO);
    assert.ok(proy.ramas.has(prop.rama));
    assert.equal(proy.commits.at(-1).branch, prop.rama);
    assert.deepEqual(proy.commits.at(-1).actions.map((a) => [a.action, a.file_path]), [['update', 'src/existente.js'], ['create', 'docs/nuevo.md']]);
    const mr = proy.mrs.at(-1);
    assert.equal(mr.title, 'Draft: Corrige el guardado');
    assert.equal(mr.source_branch, prop.rama);
    assert.equal(mr.target_branch, 'main');
    assert.match(mr.description, /<!-- forge:tarea-1 -->$/);

    // Sin métodos destructivos, sin nada en la base
    assert.ok(srv.peticiones.every((p) => ['GET', 'HEAD', 'POST'].includes(p.metodo)));
    const escrito = srv.escrituras().map((p) => `${p.metodo} ${p.ruta.replace(/^.*projects\/[^/]+/, '')}`);
    assert.deepEqual(escrito, ['POST /repository/branches', 'POST /repository/commits', 'POST /merge_requests']);
    assert.equal(srv.escrituras()[1].cuerpo.branch, prop.rama);
    assert.ok(srv.escrituras().every((p) => !JSON.stringify(p.cuerpo).includes(TOKEN)));
    // Ninguna escritura va a la base: la rama destino del commit es la nueva
    assert.notEqual(srv.escrituras()[1].cuerpo.branch, 'main');
  });

  test('todas las lecturas ocurren antes de la primera escritura', async () => {
    await crear().proponerCambio(propuesta({ archivos: [{ ruta: 'a.txt', contenido: 'a' }, { ruta: 'b.txt', contenido: 'b' }] }));
    const metodos = srv.peticiones.map((p) => p.metodo);
    const primera = metodos.indexOf('POST');
    assert.ok(primera > 0);
    assert.ok(metodos.slice(0, primera).every((m) => m === 'GET' || m === 'HEAD'));
    assert.deepEqual(metodos.slice(primera), ['POST', 'POST', 'POST']);
  });

  test('título que ya trae un prefijo de borrador: no se duplica', async () => {
    for (const t of ['Draft: Algo', 'draft:Algo', '[Draft] Algo', '(Draft) Algo', 'WIP: Algo', 'Algo']) {
      const prop = propuesta({ titulo: t });
      await crear().proponerCambio(prop);
      assert.equal(srv.proyecto(DESTINO).mrs.at(-1).title, 'Draft: Algo', t);
    }
  });

  test('descripción vacía: solo el marcador', async () => {
    await crear().proponerCambio(propuesta({ descripcion: undefined }));
    assert.equal(srv.proyecto(DESTINO).mrs.at(-1).description, '<!-- forge:tarea-1 -->');
  });

  test('base con barra (release/1.0): la ruta la codifica', async () => {
    const prop = propuesta({ base: 'release/1.0' });
    srv.proyecto(DESTINO).ramas.add('release/1.0');
    await crear().proponerCambio(prop);
    assert.ok(srv.peticiones.some((p) => p.ruta.includes('/repository/branches/release%2F1.0')));
    assert.equal(srv.proyecto(DESTINO).mrs.at(-1).target_branch, 'release/1.0');
  });

  test('rama que ya existe: falla sin tocarla y sin escribir nada', async () => {
    const antes = JSON.stringify([...srv.proyecto(DESTINO).ramas]);
    const e = await fallo(crear().proponerCambio(propuesta({ rama: 'forge/ya-existe' })));
    assert.equal(e.codigo, 'rama_existe');
    assert.equal(srv.escrituras().length, 0);
    assert.equal(JSON.stringify([...srv.proyecto(DESTINO).ramas]), antes);
  });

  test('carrera: la rama aparece entre la lectura y la creación; no se escribe en ella', async () => {
    const rama = nuevaRama();
    srv.fallar((m, r) => m === 'POST' && r.endsWith('/repository/branches'), 400, { message: 'Branch already exists' });
    const e = await fallo(crear().proponerCambio(propuesta({ rama })));
    assert.equal(e.codigo, 'rama_existe');
    assert.equal(srv.escrituras().filter((p) => p.ruta.includes('/commits')).length, 0);
  });

  test('prefijo no permitido o nombre malformado: cero peticiones', async () => {
    const malas = ['main', 'master', 'feature/x', 'Forge/x', 'forge', 'forge/', 'forge/../main', 'forge//x', 'forge/a/b', 'forge/x y', 'forge/x\n', ' forge/x',
      'forge/-x', 'forge/x..y', 'forge/x.lock', 'refs/heads/forge/x', 'forge/' + 'a'.repeat(81), '', null, 5, undefined];
    for (const rama of malas) {
      const e = await fallo(crear().proponerCambio(propuesta({ rama })));
      assert.equal(e.codigo, 'rama', JSON.stringify(rama));
    }
    assert.equal(srv.peticiones.length, 0);
  });

  test('base inválida o inexistente', async () => {
    for (const base of ['', '..', 'a..b', '-x', 'a b', 'a/', null, 'x@{1}']) {
      const e = await fallo(crear().proponerCambio(propuesta({ base })));
      assert.equal(e.codigo, 'base', JSON.stringify(base));
    }
    assert.equal(srv.peticiones.length, 0);
    const e = await fallo(crear().proponerCambio(propuesta({ base: 'no-existe' })));
    assert.equal(e.codigo, 'base_inexistente');
    assert.equal(srv.escrituras().length, 0);
  });

  test('rutas maliciosas: rechazadas antes de la red', async () => {
    const rutas = ['../x', 'a/../../x', '/etc/passwd', 'C:/x', 'a\\b', '.git/config', 'a/.GIT/hooks', 'a//b', './a', 'a/./b', 'a/', '', 'a\u0000b', 'a\nb', 'a\u202Eb',
      'a\u200Bb', 'a/b ', ' a', 'a/b.', 'x'.repeat(256), 5, null];
    for (const ruta of rutas) {
      const e = await fallo(crear().proponerCambio(propuesta({ archivos: [{ ruta, contenido: 'x' }] })));
      assert.equal(e.codigo, 'ruta', JSON.stringify(ruta));
    }
    assert.equal(srv.peticiones.length, 0);
  });

  test('topes de número, tamaño y duplicados', async () => {
    const f = (n) => Array.from({ length: n }, (_, i) => ({ ruta: `d/${i}.txt`, contenido: 'x' }));
    assert.equal((await fallo(crear().proponerCambio(propuesta({ archivos: f(21) })))).codigo, 'archivos');
    assert.equal((await fallo(crear().proponerCambio(propuesta({ archivos: [] })))).codigo, 'archivos');
    assert.equal((await fallo(crear().proponerCambio(propuesta({ archivos: 'x' })))).codigo, 'archivos');
    assert.equal((await fallo(crear().proponerCambio(propuesta({ archivos: [{ ruta: 'a', contenido: 5 }] })))).codigo, 'archivos');
    assert.equal((await fallo(crear().proponerCambio(propuesta({ archivos: [{ ruta: 'a', contenido: 'x'.repeat(256 * 1024 + 1) }] })))).codigo, 'tamano');
    const cinco = Array.from({ length: 5 }, (_, i) => ({ ruta: `g/${i}`, contenido: 'x'.repeat(250 * 1024) }));
    assert.equal((await fallo(crear().proponerCambio(propuesta({ archivos: cinco })))).codigo, 'tamano');
    assert.equal((await fallo(crear().proponerCambio(propuesta({ archivos: [{ ruta: 'A.txt', contenido: 'x' }, { ruta: 'a.TXT', contenido: 'y' }] })))).codigo, 'ruta');
    assert.equal((await fallo(crear().proponerCambio(propuesta({ archivos: [{ ruta: 'a', contenido: 'a\u0000' }] })))).codigo, 'archivos');
    assert.equal(srv.peticiones.length, 0);
  });

  test('título, descripción, marcador y token en el contenido', async () => {
    for (const titulo of ['', '   ', 'a\nb', 'x'.repeat(201), 'Draft:', 5]) {
      assert.equal((await fallo(crear().proponerCambio(propuesta({ titulo })))).codigo, 'titulo', JSON.stringify(titulo));
    }
    for (const d of ['x'.repeat(60001), '<!-- forge:otro -->', 5]) {
      assert.equal((await fallo(crear().proponerCambio(propuesta({ descripcion: d })))).codigo, 'texto');
    }
    assert.equal((await fallo(crear().proponerCambio(propuesta({ marcador: undefined })))).codigo, 'marcador');
    assert.equal((await fallo(crear().proponerCambio(propuesta({ archivos: [{ ruta: 'a', contenido: `k=${TOKEN}` }] })))).codigo, 'texto');
    assert.equal(srv.peticiones.length, 0);
  });

  test('modo distinto de proponer, y destino fuera de la lista: cero peticiones', async () => {
    for (const modo of ['apagado', 'solo_lectura', 'comentar']) {
      assert.equal((await fallo(crear({ modo }).proponerCambio(propuesta()))).codigo, 'modo');
    }
    assert.equal((await fallo(crear().proponerCambio(propuesta({ destino: 'otro/proyecto' })))).codigo, 'destino');
    assert.equal((await fallo(crear().proponerCambio(propuesta({ destino: 'empresa' })))).codigo, 'destino');
    assert.equal(srv.peticiones.length, 0);
  });

  test('proyecto archivado: no crea nada', async () => {
    const e = await fallo(crear().proponerCambio(propuesta({ destino: 'empresa/archivado' })));
    assert.equal(e.codigo, 'proyecto_archivado');
    assert.equal(srv.escrituras().length, 0);
  });

  test('fallo a mitad (el commit): la rama queda, no se borra y el error lo dice', async () => {
    const prop = propuesta();
    srv.fallar((m, r) => m === 'POST' && r.endsWith('/repository/commits'), 500, { message: 'boom' });
    const e = await fallo(crear().proponerCambio(prop));
    assert.ok(e instanceof ErrorGitLab);
    assert.equal(e.codigo, 'parcial');
    assert.equal(/** @type {any} */ (e).rama, prop.rama);
    assert.equal(/** @type {any} */ (e).etapa, 'el commit');
    assert.match(e.message, new RegExp(`${prop.rama}.*No se borra`));
    assert.ok(srv.proyecto(DESTINO).ramas.has(prop.rama), 'la rama sigue ahí');
    assert.ok(srv.peticiones.every((p) => p.metodo !== 'DELETE'));
    assert.equal(srv.proyecto(DESTINO).mrs.filter((m) => m.source_branch === prop.rama).length, 0);
  });

  test('fallo a mitad (la solicitud de fusión): también se informa sin borrar', async () => {
    const prop = propuesta();
    srv.fallar((m, r) => m === 'POST' && r.endsWith('/merge_requests'), 422, { message: 'x' });
    const e = await fallo(crear().proponerCambio(prop));
    assert.equal(e.codigo, 'parcial');
    assert.equal(/** @type {any} */ (e).etapa, 'la solicitud de fusión');
    assert.ok(srv.proyecto(DESTINO).ramas.has(prop.rama));
  });

  test('si GitLab no la marca como borrador, no se afirma que lo sea', async () => {
    const s2 = await crearServidorGitLab({ token: TOKEN, respetarDraft: false, proyectos: { [SIMPLE]: {} } });
    try {
      const p = crearProveedorGitLab({ modo: 'proponer', auditoria: auditoriaDePrueba(), token: TOKEN, destinos: [SIMPLE], [BASE_LOCAL]: s2.baseUrl, modo: 'proponer' });
      const e = await fallo(p.proponerCambio({ destino: SIMPLE, base: 'main', rama: 'forge/nd', archivos: [{ ruta: 'a', contenido: 'a' }], titulo: 't', marcador: 'm' }));
      assert.equal(e.codigo, 'no_borrador');
      assert.deepEqual(s2.escrituras().map((x) => x.metodo), ['POST', 'POST', 'POST']);
    } finally { await s2.cerrar(); }
  });

  test('parametroBorrador: añade draft además del prefijo, solo si se pide', async () => {
    await crear().proponerCambio(propuesta());
    assert.ok(!('draft' in srv.escrituras().at(-1).cuerpo));
    srv.peticiones.length = 0;
    await crear({ parametroBorrador: 'draft' }).proponerCambio(propuesta());
    const cuerpo = srv.escrituras().at(-1).cuerpo;
    assert.equal(cuerpo.draft, true);
    assert.match(cuerpo.title, /^Draft: /);
  });

  test('no hay operación de fusionar, cerrar ni borrar', () => {
    const p = /** @type {any} */ (crear());
    for (const n of ['fusionar', 'merge', 'cerrar', 'borrar', 'eliminar', 'delete', 'push', 'actualizarRama']) assert.equal(p[n], undefined);
  });
});

describe('F2.5 GitLab: comprobarAlcance', () => {
  /** @param {string[]} ambitos @param {Record<string, any>} [extra] */
  async function conAmbitos(ambitos, extra = {}) {
    const s2 = await crearServidorGitLab({ token: TOKEN, ambitos, proyectos: {}, ...extra });
    return s2;
  }

  test('token con ámbito api: en comentar/proponer no hay exceso; en solo_lectura sí', async () => {
    const s2 = await conAmbitos(['api']);
    try {
      const mk = (modo) => crearProveedorGitLab({ modo: 'proponer', auditoria: auditoriaDePrueba(), token: TOKEN, destinos: [SIMPLE], [BASE_LOCAL]: s2.baseUrl, modo });
      for (const modo of ['comentar', 'proponer']) {
        assert.deepEqual(await mk(modo).comprobarAlcance(), { estado: 'comprobado', ambitos: ['api'], exceso: false, suficiente: true });
      }
      assert.deepEqual(await mk('solo_lectura').comprobarAlcance(), { estado: 'comprobado', ambitos: ['api'], exceso: true, suficiente: true });
      assert.ok(s2.peticiones.every((p) => p.metodo === 'GET' && p.ruta === '/api/v4/personal_access_tokens/self'));
    } finally { await s2.cerrar(); }
  });

  test('token con read_api: sin exceso en solo_lectura; insuficiente para comentar', async () => {
    const s2 = await conAmbitos(['read_api']);
    try {
      const mk = (modo) => crearProveedorGitLab({ modo: 'proponer', auditoria: auditoriaDePrueba(), token: TOKEN, destinos: [SIMPLE], [BASE_LOCAL]: s2.baseUrl, modo });
      assert.deepEqual(await mk('solo_lectura').comprobarAlcance(), { estado: 'comprobado', ambitos: ['read_api'], exceso: false, suficiente: true });
      const c = await mk('comentar').comprobarAlcance();
      assert.deepEqual(c, { estado: 'comprobado', ambitos: ['read_api'], exceso: true, suficiente: false });
    } finally { await s2.cerrar(); }
  });

  test('ámbitos de más (api + read_user + sudo) cuentan como exceso', async () => {
    const s2 = await conAmbitos(['api', 'read_user', 'sudo']);
    try {
      const r = await crearProveedorGitLab({ modo: 'proponer', auditoria: auditoriaDePrueba(), token: TOKEN, destinos: [SIMPLE], [BASE_LOCAL]: s2.baseUrl, modo: 'proponer' }).comprobarAlcance();
      assert.deepEqual(r, { estado: 'comprobado', ambitos: ['api', 'read_user', 'sudo'], exceso: true, suficiente: true });
    } finally { await s2.cerrar(); }
  });

  test('404 (token de proyecto) y 401: no_comprobable, sin fallar ni copiar el cuerpo', async () => {
    const s2 = await conAmbitos(['api'], { tipoToken: 'proyecto' });
    try {
      const p = crearProveedorGitLab({ modo: 'proponer', auditoria: auditoriaDePrueba(), token: TOKEN, destinos: [SIMPLE], [BASE_LOCAL]: s2.baseUrl, modo: 'comentar' });
      const r = await p.comprobarAlcance();
      assert.equal(r.estado, 'no_comprobable');
      assert.match(/** @type {any} */ (r).motivo, /404/);
      s2.fallar(() => true, 401, { message: `401 ${TOKEN}` });
      const r2 = await p.comprobarAlcance();
      assert.equal(r2.estado, 'no_comprobable');
      assert.ok(!JSON.stringify(r2).includes(TOKEN));
    } finally { await s2.cerrar(); }
  });

  test('otros estados y formas raras: error tipado', async () => {
    const s2 = await conAmbitos(['api']);
    try {
      const p = crearProveedorGitLab({ modo: 'proponer', auditoria: auditoriaDePrueba(), token: TOKEN, destinos: [SIMPLE], [BASE_LOCAL]: s2.baseUrl, modo: 'comentar', _esperar: async () => {} });
      s2.fallar(() => true, 403, {});
      assert.equal((await fallo(p.comprobarAlcance())).codigo, 'prohibido');
      s2.limpiarFallos();
      for (const cuerpo of [{ scopes: 'api' }, { scopes: [1] }, { scopes: ['API; x'] }, [], {}]) {
        s2.limpiarFallos();
        s2.fallar(() => true, 200, cuerpo);
        assert.equal((await fallo(p.comprobarAlcance())).codigo, 'forma', JSON.stringify(cuerpo));
      }
    } finally { await s2.cerrar(); }
  });
});

describe('F2.2 GitLab: el token no aparece en ningún sitio', () => {
  test('ni en errores, ni en valores devueltos, ni en eventos de auditoría', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'forge-gitlab-'));
    mkdirSync(join(dir, '.sdd'), { recursive: true });
    const auditoria = new AuditoriaIntegraciones({ cwd: dir, env: process.env, sesion: 'gl' });
    const p = crear({ auditoria });
    /** @type {string[]} */
    const salidas = [];
    const intentar = async (f) => { try { salidas.push(JSON.stringify(await f())); } catch (e) { salidas.push(`${e.name}: ${e.message} ${JSON.stringify(e)}`); } };

    await intentar(() => p.leerElemento(`${DESTINO}#7`));
    await intentar(() => p.comentar(`${DESTINO}#7`, 'hola', { marcador: 'auditado' }));
    await intentar(() => p.proponerCambio(propuesta()));
    await intentar(() => p.comprobarAlcance());
    await intentar(() => p.leerElemento('malo'));
    await intentar(() => p.leerElemento(`${DESTINO}#99`));                       // 404
    srv.fallar((m, r) => r.includes('/issues/7'), 500, { message: TOKEN });
    await intentar(() => p.leerElemento(`${DESTINO}#7`));
    srv.limpiarFallos();
    // Un http inyectado cuyo error arrastra el token: el adaptador lo enmascara
    const hostil = crear({ http: async () => { throw new Error(`fallo con ${TOKEN} en la cabecera`); } });
    await intentar(() => hostil.leerElemento(`${SIMPLE}#1`));
    // Token inválido: el servidor responde 401
    const malo = crearProveedorGitLab({ modo: 'proponer', auditoria: auditoriaDePrueba(), token: TOKEN + 'x', destinos: [SIMPLE], [BASE_LOCAL]: srv.baseUrl });
    await intentar(() => malo.leerElemento(`${SIMPLE}#1`));

    assert.ok(salidas.length === 9);
    for (const s of salidas) assert.ok(!s.includes(TOKEN), s.slice(0, 200));
    const crudo = readFileSync(join(dir, '.sdd', 'events.jsonl'), 'utf8');
    assert.ok(!crudo.includes(TOKEN));
    const eventos = new EventLog(join(dir, '.sdd')).readAll().filter((e) => String(e.type).startsWith('integracion:'));
    // Una operación auditada por llamada, con el proveedor y sin contenido
    const tipos = eventos.map((e) => e.type);
    assert.ok(tipos.includes('integracion:leer_elemento'));
    assert.ok(tipos.includes('integracion:comentar'));
    assert.ok(tipos.includes('integracion:proponer_cambio'));
    assert.ok(tipos.includes('integracion:comprobar_alcance'));
    for (const e of eventos) {
      assert.deepEqual(Object.keys(e.payload).sort(), ['destino', 'duracionMs', 'operacion', 'proveedor', 'resultado']);
      assert.equal(e.payload.proveedor, 'gitlab');
    }
    // El error de una referencia mala no consume operación (se rechaza antes de la auditoría)
    assert.equal(eventos.filter((e) => e.payload.destino === 'malo').length, 0);
  });

  test('con el interruptor apagado, la auditoría detiene la operación y no hay peticiones', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'forge-gitlab-off-'));
    mkdirSync(join(dir, '.sdd'), { recursive: true });
    const auditoria = new AuditoriaIntegraciones({ cwd: dir, env: { FORGE_INTEGRACIONES: 'apagado' } });
    const e = await fallo(crear({ auditoria }).leerElemento(`${SIMPLE}#1`));
    assert.equal(e.codigo, 'apagado');
    assert.equal(srv.peticiones.length, 0);
  });

  test('un token con formato peligroso en el host o la ruta no puede filtrarse por la URL', async () => {
    // El host solo puede ser el de la configuración; una referencia con el token dentro no pasa la regex
    const e = await fallo(crear().leerElemento(`${SIMPLE}#1?private_token=${TOKEN}`));
    assert.equal(e.codigo, 'referencia');
    assert.ok(!e.message.includes(TOKEN));
    assert.equal(srv.peticiones.length, 0);
  });
});

// ── Prueba OPT-IN contra una instancia real ──────────────────────────────────────────────────
//
// Decide el punto «sin confirmar» de contratos-respuesta.md §2.4: si basta el prefijo `Draft: ` del
// título o hay que enviar además `draft` / `work_in_progress`. Escribe de verdad (una rama `forge/…`
// y una solicitud en borrador) en un PROYECTO DE PRUEBA; no borra nada. Para ejecutarla:
//   FORGE_TEST_INTEGRACIONES=1 FORGE_TEST_GITLAB_HOST=gitlab.ejemplo.com \
//   FORGE_TEST_GITLAB_TOKEN=... FORGE_TEST_GITLAB_PROYECTO=grupo/proyecto-de-prueba [FORGE_TEST_GITLAB_BASE=main]
const REAL = process.env.FORGE_TEST_INTEGRACIONES === '1'
  && !!process.env.FORGE_TEST_GITLAB_HOST && !!process.env.FORGE_TEST_GITLAB_TOKEN && !!process.env.FORGE_TEST_GITLAB_PROYECTO;

describe('F2.2 GitLab: instancia real (opt-in, FORGE_TEST_INTEGRACIONES=1)', { skip: REAL ? false : 'opt-in: define FORGE_TEST_INTEGRACIONES=1 y FORGE_TEST_GITLAB_{HOST,TOKEN,PROYECTO}' }, () => {
  const real = () => crearProveedorGitLab({
    token: /** @type {string} */ (process.env.FORGE_TEST_GITLAB_TOKEN),
    host: process.env.FORGE_TEST_GITLAB_HOST,
    destinos: [/** @type {string} */ (process.env.FORGE_TEST_GITLAB_PROYECTO)],
    modo: 'proponer',
  });

  test('el prefijo «Draft: » solo basta para que la solicitud sea borrador (si falla, hay que enviar draft)', async () => {
    const id = `${Date.now().toString(36)}`;
    const r = await real().proponerCambio({
      destino: /** @type {string} */ (process.env.FORGE_TEST_GITLAB_PROYECTO),
      base: process.env.FORGE_TEST_GITLAB_BASE ?? 'main',
      rama: `forge/prueba-${id}`,
      archivos: [{ ruta: `forge-prueba/${id}.txt`, contenido: 'prueba de FORGE\n' }],
      titulo: `Prueba de FORGE ${id}`,
      descripcion: 'Creada por la prueba opt-in; se puede cerrar y borrar.',
      marcador: `prueba-${id}`,
    });
    assert.equal(r.borrador, true, 'GitLab no marcó como borrador con solo el prefijo: usar parametroBorrador');
  });

  test('comprobarAlcance con el token real', async () => {
    const r = await real().comprobarAlcance();
    assert.ok(['comprobado', 'no_comprobable'].includes(r.estado));
  });
});
