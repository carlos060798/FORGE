// @ts-check
/**
 * F2.4 y F2.6 — contrato común de los tres adaptadores (GitHub, GitLab, Jira).
 *
 * Cada adaptador se prueba por separado en su archivo; aquí se comprueba lo que NO puede diferir
 * entre plataformas, porque quien los usa (publicación, CLI, doctor) no sabe cuál tiene delante:
 *  - el elemento leído tiene la misma forma, sin campos de más;
 *  - un destino fuera de la lista se rechaza antes de cualquier petición;
 *  - comentar es idempotente por marcador: la segunda vez no escribe;
 *  - comprobarAlcance dice la verdad (nunca «comprobado» sin haberlo comprobado);
 *  - el token centinela no aparece en ningún error;
 *  - ninguna operación genérica.
 * Todo contra servidores falsos locales: ninguna petición sale del equipo.
 */

import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';

import { validarProveedor } from '../core/integraciones/puerto.js';
import { pedir } from '../core/integraciones/http.js';
import { crearProveedorGitHub } from '../core/integraciones/proveedores/github.js';
import { crearProveedorGitLab } from '../core/integraciones/proveedores/gitlab.js';
import { crearProveedorJira } from '../core/integraciones/proveedores/jira.js';
import { crearServidorGitHub } from './fixtures/integraciones/servidores/github.mjs';
import { crearServidorGitLab } from './fixtures/integraciones/servidores/gitlab.mjs';
import { adfParrafo, crearServidorJiraFalso } from './fixtures/integraciones/servidores/jira.mjs';

const TOKEN_GH = 'github_pat_' + 'CONTRATO9f8e7d6c5b4a39281706f5e4d3c2b1a0';
const TOKEN_GL = 'glpat-' + 'CONTRATO0123456789abcd';
const TOKEN_JIRA = 'ATATT3xFfGF0' + 'ZZcontratoJira9876543210abcdefXYZ';
const USUARIO_JIRA = 'forge-bot@ejemplo.com';
const sinEspera = (/** @type {any} */ o) => pedir({ ...o, _esperar: async () => {} });

/** Campos que cualquier elemento debe tener, y los únicos opcionales que se admiten además. */
const CAMPOS_COMUNES = ['proveedor', 'destino', 'referencia', 'titulo', 'cuerpo', 'etiquetas', 'comentarios'];
const CAMPOS_OPCIONALES = ['url', 'estado', 'autor', 'tipo', 'truncado'];

/** @type {Array<() => Promise<void>>} */
const cierres = [];
after(async () => { for (const c of cierres) await c(); });

/**
 * @returns {Promise<Array<{ nombre: string, token: string, prov: any, referencia: string, fuera: string, escrituras: () => number, peticiones: () => number, secretos: string[] }>>}
 */
async function montar() {
  const gh = await crearServidorGitHub({
    token: TOKEN_GH,
    repos: { 'org/repo': { ramas: { main: 'a'.repeat(40) }, incidencias: { 7: { title: 'Título', body: 'Cuerpo', user: { login: 'ana' }, labels: [{ name: 'bug' }] } } } },
  });
  cierres.push(() => gh.cerrar());
  const gl = await crearServidorGitLab({
    token: TOKEN_GL,
    proyectos: { 'empresa/web': { incidencias: { 7: { title: 'Título', description: 'Cuerpo', labels: ['bug'], notas: [{ id: 1, body: 'Hola', author: { username: 'ana' } }] } }, ramas: ['main'] } },
  });
  cierres.push(() => gl.cerrar());
  const ji = await crearServidorJiraFalso({
    usuario: USUARIO_JIRA, token: TOKEN_JIRA,
    tickets: { 'ABC-7': { summary: 'Título', description: adfParrafo('Cuerpo'), labels: ['bug'], comments: [{ id: '1', autor: 'Ana', body: adfParrafo('Hola') }] } },
  });
  cierres.push(() => ji.cerrar());

  return [
    {
      nombre: 'github', token: TOKEN_GH, referencia: 'org/repo#7', fuera: 'otra/cosa#1',
      prov: crearProveedorGitHub({ token: TOKEN_GH, destinos: ['org/repo'], baseUrl: gh.baseUrl }),
      escrituras: () => gh.escrituras().length, peticiones: () => gh.peticiones.length, secretos: [TOKEN_GH],
    },
    {
      nombre: 'gitlab', token: TOKEN_GL, referencia: 'empresa/web#7', fuera: 'empresa/otro#1',
      prov: crearProveedorGitLab({ token: TOKEN_GL, destinos: ['empresa/web'], baseUrl: gl.baseUrl, modo: 'comentar', _esperar: async () => {} }),
      escrituras: () => gl.escrituras().length, peticiones: () => gl.peticiones.length, secretos: [TOKEN_GL],
    },
    {
      nombre: 'jira', token: TOKEN_JIRA, referencia: 'ABC-7', fuera: 'XYZ-1',
      prov: crearProveedorJira({ sitio: 'ejemplo.atlassian.net', usuario: USUARIO_JIRA, token: TOKEN_JIRA, destinos: ['ABC'], baseUrl: ji.baseUrl, http: sinEspera }),
      escrituras: () => ji.peticiones.filter((p) => p.metodo !== 'GET').length, peticiones: () => ji.peticiones.length,
      secretos: [TOKEN_JIRA, USUARIO_JIRA, Buffer.from(`${USUARIO_JIRA}:${TOKEN_JIRA}`).toString('base64')],
    },
  ];
}

const fallo = async (/** @type {Promise<any>} */ p) => { try { await p; } catch (e) { return e; } return assert.fail('debía fallar'); };
const volcado = (/** @type {any} */ e) => [String(e?.message), String(e?.stack), JSON.stringify(e, Object.getOwnPropertyNames(e ?? {}))].join('\n');

describe('F2.4 — contrato común de los tres adaptadores', () => {
  test('los tres cumplen el puerto y ninguno expone una operación genérica', async () => {
    for (const c of await montar()) {
      assert.deepEqual(validarProveedor(c.prov), { ok: true, faltan: [], genericas: [] }, c.nombre);
      assert.equal(c.prov.nombre, c.nombre);
    }
  });

  test('el elemento leído tiene los mismos campos comunes y solo los opcionales admitidos', async () => {
    for (const c of await montar()) {
      const el = await c.prov.leerElemento(c.referencia);
      for (const k of CAMPOS_COMUNES) assert.ok(k in el, `${c.nombre}: falta «${k}»`);
      for (const k of Object.keys(el)) assert.ok([...CAMPOS_COMUNES, ...CAMPOS_OPCIONALES].includes(k), `${c.nombre}: campo de más «${k}»`);
      assert.equal(el.proveedor, c.nombre);
      assert.equal(typeof el.titulo, 'string');
      assert.equal(typeof el.cuerpo, 'string');
      assert.ok(Array.isArray(el.etiquetas) && el.etiquetas.every((/** @type {any} */ e) => typeof e === 'string'));
      assert.ok(Array.isArray(el.comentarios));
      for (const co of el.comentarios) {
        assert.deepEqual(Object.keys(co).sort(), ['autor', 'cuerpo'], `${c.nombre}: forma del comentario`);
      }
    }
  });

  test('un destino fuera de la lista se rechaza sin una sola petición', async () => {
    for (const c of await montar()) {
      const antes = c.peticiones();
      const e = await fallo(c.prov.leerElemento(c.fuera));
      assert.ok(e instanceof Error, c.nombre);
      assert.equal(c.peticiones(), antes, `${c.nombre}: hizo peticiones antes de validar el destino`);
    }
  });

  test('una referencia con forma de ataque se rechaza sin peticiones', async () => {
    const malas = ['../../etc/passwd', 'org/repo#1/../../x', 'a b#1', 'org/repo#1; DROP', '', '#', 'x'.repeat(500), 'org/repo#-1', 'ABC-1\n'];
    for (const c of await montar()) {
      const antes = c.peticiones();
      for (const m of malas) await fallo(c.prov.leerElemento(m));
      assert.equal(c.peticiones(), antes, `${c.nombre}: una referencia malformada llegó a la red`);
    }
  });
});

describe('F2.6 — idempotencia de comentar en los tres', () => {
  test('la segunda publicación con el mismo marcador no escribe nada', async () => {
    for (const c of await montar()) {
      const r1 = await c.prov.comentar(c.referencia, 'Resultado de la tarea', { marcador: 'tarea-abc123' });
      assert.ok(r1 && r1.id !== undefined, `${c.nombre}: sin id`);
      const escritas = c.escrituras();
      assert.ok(escritas >= 1, `${c.nombre}: la primera publicación no escribió`);
      const r2 = await c.prov.comentar(c.referencia, 'Resultado de la tarea', { marcador: 'tarea-abc123' });
      assert.equal(c.escrituras(), escritas, `${c.nombre}: la segunda publicación escribió otra vez`);
      assert.equal(String(r2.id), String(r1.id), `${c.nombre}: devolvió otro identificador`);
    }
  });

  test('un marcador distinto sí publica', async () => {
    for (const c of await montar()) {
      await c.prov.comentar(c.referencia, 'Uno', { marcador: 'tarea-uno' });
      const antes = c.escrituras();
      await c.prov.comentar(c.referencia, 'Dos', { marcador: 'tarea-dos' });
      assert.equal(c.escrituras(), antes + 1, c.nombre);
    }
  });
});

describe('comprobarAlcance no promete lo que no sabe', () => {
  test('GitHub y Jira dicen «no comprobable» sin hacer ninguna petición', async () => {
    const todos = await montar();
    for (const c of todos.filter((x) => x.nombre !== 'gitlab')) {
      const antes = c.peticiones();
      const a = await c.prov.comprobarAlcance();
      assert.equal(a.estado === 'no_comprobable' || a.verificable === false, true, `${c.nombre}: ${JSON.stringify(a)}`);
      assert.equal(c.peticiones(), antes, `${c.nombre}: consultó la red para algo que no se puede saber`);
    }
  });
});

describe('ningún error de ninguna operación lleva credenciales', () => {
  test('el error de una operación rechazada no contiene el token ni nada derivado', async () => {
    const todos = await montar();
    // Se provoca un error en cada uno (destino fuera de la lista) y se mira todo lo que el error expone
    for (const c of todos) {
      const e = await fallo(c.prov.leerElemento(c.fuera));
      const v = volcado(e);
      for (const s of c.secretos) assert.ok(!v.includes(s), `${c.nombre}: el error contiene un secreto`);
    }
  });
});
