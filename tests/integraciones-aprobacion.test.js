// @ts-check
/**
 * F3.1, F3.3 y F3.4 — La cola de pendientes y la aprobación (core/integraciones/aprobacion.js).
 * CA-002-01, CA-002-04, CA-002-05, CA-003-04, CA-005-04, CA-006-03, CA-006-04.
 *
 * Contra el servidor falso de GitHub (127.0.0.1): ninguna petición sale del equipo.
 */

import { BASE_LOCAL } from '../core/integraciones/pruebas-internas.js';
import { test, describe, after } from 'node:test';
import './fixtures/integraciones/entorno-usuario.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  ErrorAprobacion, aprobar as aprobarLib, crearPendiente, huellaDeContenido, huellaDePublicacion, leerPendiente, listarNoAutenticados, listarPendientes, rechazar, sesionDeIntegraciones, vistaPrevia,
  escribirAlcance, leerAlcance,
} from '../core/integraciones/aprobacion.js';
import { prepararPublicacion } from '../core/integraciones/publicacion.js';
import { claveLocal, directorioDeEstado, firmar } from '../core/integraciones/estado-usuario.js';
import { AuditoriaIntegraciones, ErrorIntegracionesApagadas, ErrorTopeIntegraciones, apagar, encender } from '../core/integraciones/auditoria.js';
import { interpretarIntegraciones } from '../core/integraciones/config.js';
import { crearProveedorGitHub } from '../core/integraciones/proveedores/github.js';
import { crearServidorGitHub } from './fixtures/integraciones/servidores/github.mjs';
import { proyectoConTarea } from './fixtures/integraciones/estado-ciclo.mjs';

const TOKEN = 'github_pat_' + 'APROBACION9f8e7d6c5b4a39281706f5e4d3c2b1a0';
const cierres = /** @type {Array<() => Promise<void>>} */ ([]);
after(async () => { for (const c of cierres) await c(); });

const yaml = (modo = 'proponer', destinos = 'org/repo') => `integraciones:\n  github_modo: ${modo}\n  github_token_env: FORGE_GITHUB_TOKEN\n  github_destinos: ${destinos}\n`;

/** Un proyecto con tarea terminada, un servidor falso y todo lo que `aprobar` necesita. */
async function entorno({ modo = 'proponer', archivos = /** @type {Record<string, string>|undefined} */ (undefined), fallos = /** @type {any[]} */ ([]), tope = 20, escribirToken = true } = {}) {
  const p = proyectoConTarea(archivos ? { archivos } : {});
  const gh = await crearServidorGitHub({
    token: TOKEN,
    repos: { 'org/repo': { ramas: { main: 'a'.repeat(40) }, incidencias: { 7: { title: 'Fallo', body: 'Cuerpo', user: { login: 'ana' } } } } },
    fallos,
  });
  cierres.push(() => gh.cerrar());
  const config = interpretarIntegraciones(yaml(modo));
  const auditoria = new AuditoriaIntegraciones({ cwd: p.cwd, tope, sesion: 'prueba', env: process.env });
  const llamadasAFabrica = { n: 0 };
  const opciones = {
    config, auditoria,
    crearProveedor: (/** @type {any} */ cfg) => {
      llamadasAFabrica.n++;
      if (!escribirToken) throw new ErrorAprobacion('sin_credencial', 'La variable FORGE_GITHUB_TOKEN no está definida.');
      return crearProveedorGitHub({ token: TOKEN, destinos: cfg.destinos, modo: cfg.modo, auditoria, [BASE_LOCAL]: gh.baseUrl });
    },
    secretos: [TOKEN],
  };
  return { ...p, gh, config, auditoria, opciones, llamadasAFabrica };
}

/**
 * `aprobar` exige la huella (revisión 2, H1): como la persona, estas pruebas la toman de la vista previa
 * salvo que la prueba pase una.
 */
const aprobar = (/** @type {string} */ cwd, /** @type {string} */ id, /** @type {any} */ o) => {
  let opciones = o;
  if (o.huella === undefined) { try { opciones = { ...o, huella: vistaPrevia(cwd, id).huella }; } catch { /* sin pendiente legible: que falle aprobar */ } }
  return aprobarLib(cwd, id, opciones);
};

/** Dónde vive un pendiente: en el estado del USUARIO, no en el árbol del proyecto. */
const rutaPend = (/** @type {string} */ cwd, /** @type {string} */ id) => join(directorioDeEstado(cwd), 'pendientes', `${id}.json`);

/** Reescribe un pendiente CON firma válida (un error o un cambio de reglas de FORGE, no un atacante). */
function reescribirFirmado(/** @type {string} */ cwd, /** @type {string} */ id, /** @type {(j: any) => void} */ f) {
  const ruta = rutaPend(cwd, id);
  const j = JSON.parse(readFileSync(ruta, 'utf8'));
  delete j.hmac;
  f(j);
  j.hmac = firmar(claveLocal(directorioDeEstado(cwd)), j);
  writeFileSync(ruta, JSON.stringify(j));
}

/** Prepara y deja en cola. */
function encolar(e, o = {}) {
  const preparada = prepararPublicacion({ cwd: e.cwd, tareaId: e.taskId, proveedor: 'github', referencia: 'org/repo#7', ...o });
  return crearPendiente(e.cwd, preparada).pendiente;
}

const falla = async (/** @type {Promise<any>} */ pr) => { try { await pr; } catch (x) { return /** @type {any} */ (x); } return assert.fail('debía fallar'); };

/** Resumen de todos los archivos bajo una carpeta (ruta → sha256). */
function foto(dir) {
  /** @type {Record<string, string>} */
  const r = {};
  const rec = (d) => {
    for (const n of readdirSync(d)) {
      const ruta = join(d, n);
      if (statSync(ruta).isDirectory()) rec(ruta); else r[ruta] = createHash('sha256').update(readFileSync(ruta)).digest('hex');
    }
  };
  try { rec(dir); } catch { /* no existe */ }
  return r;
}

describe('F3.1 — la cola de pendientes', () => {
  test('el pendiente tiene exactamente la forma acordada, firmado, y vive en el estado del usuario (no en el árbol)', async () => {
    const e = await entorno();
    const p = encolar(e, { tipo: 'comentario' });
    assert.match(p.id, /^github-[0-9a-f]{12}$/);
    const enDisco = JSON.parse(readFileSync(rutaPend(e.cwd, p.id), 'utf8'));
    assert.equal(existsSync(join(e.cwd, '.sdd', 'integraciones', 'pendientes')), false, 'nada en el árbol del proyecto');
    assert.deepEqual(Object.keys(enDisco).sort(), ['contenido', 'creado', 'destino', 'estado', 'hmac', 'huella', 'id', 'operacion', 'proveedor', 'referencia']);
    assert.match(enDisco.hmac, /^[0-9a-f]{64}$/);
    assert.equal(enDisco.estado, 'pendiente');
    assert.equal(enDisco.proveedor, 'github');
    assert.equal(enDisco.operacion, 'comentar');
    assert.equal(enDisco.destino, 'org/repo');
    assert.equal(enDisco.referencia, 'org/repo#7');
    assert.equal(enDisco.huella, huellaDePublicacion(enDisco), 'la huella cubre proveedor, operación, destino, referencia y contenido');
    assert.match(enDisco.creado, /^\d{4}-\d{2}-\d{2}T/);
  });

  test('preparar dos veces lo mismo no crea otro pendiente', async () => {
    const e = await entorno();
    const a = encolar(e);
    const preparada = prepararPublicacion({ cwd: e.cwd, tareaId: e.taskId, proveedor: 'github', referencia: 'org/repo#7' });
    const b = crearPendiente(e.cwd, preparada);
    assert.equal(b.nuevo, false);
    assert.equal(b.pendiente.id, a.id);
    assert.equal(listarPendientes(e.cwd).length, 1);
  });

  test('la huella del contenido no depende del orden de las claves', () => {
    assert.equal(huellaDeContenido({ a: 1, b: { c: 2, d: 3 } }), huellaDeContenido({ b: { d: 3, c: 2 }, a: 1 }));
    assert.notEqual(huellaDeContenido({ a: 1 }), huellaDeContenido({ a: 2 }));
  });

  test('identificadores con forma de ruta o inexistentes se rechazan, y un archivo roto se dice', async () => {
    const e = await entorno();
    for (const malo of ['../x', 'a/b', '', 'A B', 'x'.repeat(200)]) {
      assert.equal((await falla(aprobar(e.cwd, malo, e.opciones))).codigo, 'id_no_valido', JSON.stringify(malo));
    }
    assert.equal((await falla(aprobar(e.cwd, 'github-000000000000', e.opciones))).codigo, 'pendiente_no_encontrado');
    mkdirSync(join(directorioDeEstado(e.cwd), 'pendientes'), { recursive: true });
    writeFileSync(join(directorioDeEstado(e.cwd), 'pendientes', 'roto.json'), '{ no es json');
    assert.equal((await falla(aprobar(e.cwd, 'roto', e.opciones))).codigo, 'pendiente_corrupto');
    assert.equal(e.gh.peticiones.length, 0);
  });
});

describe('F3.1 — vista previa', () => {
  test('muestra el texto EXACTO, el destino, la cuenta (sin token) y los archivos, sin escribir nada', async () => {
    const e = await entorno();
    const p = encolar(e, { tipo: 'propuesta' });
    const antes = foto(join(e.cwd, '.sdd', 'integraciones'));
    const v = vistaPrevia(e.cwd, p.id, { config: e.config });
    assert.equal(v.texto, p.contenido.descripcion);
    assert.equal(v.destino, 'org/repo');
    assert.equal(v.referencia, 'org/repo#7');
    assert.equal(v.operacion, 'proponer_cambio');
    assert.equal(v.cuenta.proveedor, 'github');
    assert.equal(v.cuenta.modo, 'proponer');
    assert.equal(v.cuenta.variable, 'FORGE_GITHUB_TOKEN');
    assert.deepEqual(v.archivos.map((a) => a.ruta), ['src/calc.js']);
    assert.equal(v.rama, p.contenido.rama);
    assert.equal(v.base, 'main');
    assert.equal(v.integro, true);
    assert.ok(!JSON.stringify(v).includes(TOKEN));
    assert.deepEqual(foto(join(e.cwd, '.sdd', 'integraciones')), antes, 'la vista previa no escribe');
    assert.equal(e.gh.peticiones.length, 0);
  });

  test('un comentario muestra el texto y el identificador', async () => {
    const e = await entorno();
    const p = encolar(e);
    const v = vistaPrevia(e.cwd, p.id, { config: e.config });
    assert.equal(v.texto, p.contenido.texto);
    assert.equal(v.marcador, p.contenido.marcador);
    assert.deepEqual(v.archivos, []);
  });

  test('un pendiente modificado a mano (sin la clave) no se autentica: ni vista ni aprobación', async () => {
    const e = await entorno();
    const p = encolar(e);
    const ruta = rutaPend(e.cwd, p.id);
    const j = JSON.parse(readFileSync(ruta, 'utf8'));
    j.contenido.texto += '\nAÑADIDO A MANO';
    writeFileSync(ruta, JSON.stringify(j));
    assert.equal((await falla(Promise.resolve().then(() => vistaPrevia(e.cwd, p.id, { config: e.config })))).codigo, 'pendiente_no_autenticado');
    assert.equal((await falla(aprobar(e.cwd, p.id, e.opciones))).codigo, 'pendiente_no_autenticado');
    assert.deepEqual(listarNoAutenticados(e.cwd), [{ id: p.id, origen: 'usuario' }]);
    assert.equal(e.gh.peticiones.length, 0);
  });

  test('con firma válida pero contenido que no es el de su huella, la vista avisa (integro: false)', async () => {
    const e = await entorno();
    const p = encolar(e);
    reescribirFirmado(e.cwd, p.id, (j) => { j.contenido.texto += '\nAÑADIDO'; });
    const v = vistaPrevia(e.cwd, p.id, { config: e.config });
    assert.equal(v.integro, false);
    assert.ok(v.advertencias.some((a) => /huella/i.test(a)));
  });
});

describe('F3.3 — aprobar', () => {
  test('un comentario aprobado se publica una vez, con su marcador, y el pendiente queda publicado', async () => {
    const e = await entorno();
    const p = encolar(e);
    const r = await aprobar(e.cwd, p.id, e.opciones);
    assert.equal(r.ok, true);
    assert.equal(r.estado, 'publicado');
    assert.equal(r.yaPublicado, false);
    const comentarios = e.gh.repo('org/repo').comentarios.get(7);
    assert.equal(comentarios.length, 1);
    assert.ok(comentarios[0].body.startsWith(p.contenido.texto));
    assert.ok(comentarios[0].body.includes(`<!-- forge:${p.contenido.marcador} -->`));
    const guardado = leerPendiente(e.cwd, p.id);
    assert.equal(guardado.estado, 'publicado');
    assert.equal(guardado.resultado.id, String(comentarios[0].id));
    assert.match(guardado.aprobadoEn, /^\d{4}-/);
  });

  test('aprobar dos veces no duplica y no llama a la plataforma la segunda vez (CA-002-04)', async () => {
    const e = await entorno();
    const p = encolar(e);
    const r1 = await aprobar(e.cwd, p.id, e.opciones);
    const peticiones = e.gh.peticiones.length;
    const fabricas = e.llamadasAFabrica.n;
    const ops = e.auditoria.contadores().github;
    const r2 = await aprobar(e.cwd, p.id, e.opciones);
    assert.equal(r2.yaPublicado, true);
    assert.deepEqual(r2.resultado, r1.resultado);
    assert.equal(e.gh.peticiones.length, peticiones, 'ni una petición más');
    assert.equal(e.llamadasAFabrica.n, fabricas, 'ni siquiera se construyó el proveedor (no se leyó el token)');
    assert.equal(e.auditoria.contadores().github, ops, 'no consume tope');
    assert.equal(e.gh.repo('org/repo').comentarios.get(7).length, 1);
  });

  test('una propuesta crea rama forge/ y solicitud en borrador con exactamente los archivos del estado', async () => {
    const e = await entorno({ archivos: { 'src/a.js': 'export const a = 1;\n', 'src/b.js': 'export const b = 2;\n', 'package.json': '{"name":"x"}\n' } });
    const p = encolar(e, { tipo: 'propuesta' });
    const r = await aprobar(e.cwd, p.id, e.opciones);
    assert.equal(r.ok, true);
    assert.equal(r.resultado.borrador, true);
    assert.match(r.resultado.rama, /^forge\/tarea-t1-/);
    const repo = e.gh.repo('org/repo');
    assert.ok(repo.ramas.has(r.resultado.rama));
    assert.equal(repo.ramas.get('main'), 'a'.repeat(40), 'la base intacta');
    assert.equal(repo.solicitudes.length, 1);
    assert.equal(repo.solicitudes[0].draft, true);
    assert.equal(repo.solicitudes[0].base.ref, 'main');
    const subidos = [...repo.blobs.values()].sort();
    assert.deepEqual(subidos, ['export const a = 1;\n', 'export const b = 2;\n']);
    assert.match(repo.solicitudes[0].body, /package\.json \(dependencias\)/);
    assert.equal(e.gh.escrituras().some((x) => ['PUT', 'PATCH', 'DELETE'].includes(x.metodo)), false);
  });

  test('modo insuficiente: rechazado ANTES de cualquier red, con el modo que hace falta (CA-002-05)', async () => {
    const e1 = await entorno({ modo: 'solo_lectura' });
    const p1 = encolar(e1);
    const x1 = await falla(aprobar(e1.cwd, p1.id, e1.opciones));
    assert.equal(x1.codigo, 'modo_insuficiente');
    assert.match(x1.message, /github_modo/);
    assert.match(x1.message, /comentar/);
    assert.equal(e1.gh.peticiones.length, 0);
    assert.equal(e1.llamadasAFabrica.n, 0, 'no se leyó el token');
    assert.equal(leerPendiente(e1.cwd, p1.id).estado, 'pendiente');

    const e2 = await entorno({ modo: 'comentar' });
    const p2 = encolar(e2, { tipo: 'propuesta' });
    const x2 = await falla(aprobar(e2.cwd, p2.id, e2.opciones));
    assert.equal(x2.codigo, 'modo_insuficiente');
    assert.match(x2.message, /proponer/);
    assert.equal(e2.gh.peticiones.length, 0);

    const e3 = await entorno({ modo: 'apagado' });
    const p3 = encolar(e3);
    assert.equal((await falla(aprobar(e3.cwd, p3.id, e3.opciones))).codigo, 'proveedor_apagado');
    assert.equal(e3.gh.peticiones.length, 0);
  });

  test('el modo «proponer» también permite comentar', async () => {
    const e = await entorno({ modo: 'proponer' });
    const r = await aprobar(e.cwd, encolar(e).id, e.opciones);
    assert.equal(r.estado, 'publicado');
  });

  test('un destino que ya no está en la lista se rechaza sin red', async () => {
    const e = await entorno();
    const p = encolar(e);
    const config = interpretarIntegraciones(yaml('proponer', 'org/otro'));
    const x = await falla(aprobar(e.cwd, p.id, { ...e.opciones, config }));
    assert.equal(x.codigo, 'destino_no_permitido');
    assert.equal(e.gh.peticiones.length, 0);
  });

  test('contenido cambiado después de la vista previa: rechazado, sin red, y el pendiente queda rechazado', async () => {
    const e = await entorno();
    const p = encolar(e);
    vistaPrevia(e.cwd, p.id, { config: e.config });
    reescribirFirmado(e.cwd, p.id, (j) => { j.contenido.texto = 'Texto distinto al que se aprobó'; });
    const x = await falla(aprobar(e.cwd, p.id, e.opciones));
    assert.equal(x.codigo, 'contenido_cambiado');
    assert.equal(e.gh.peticiones.length, 0);
    assert.equal(leerPendiente(e.cwd, p.id).estado, 'rechazado');
    assert.equal((await falla(aprobar(e.cwd, p.id, e.opciones))).codigo, 'rechazado');
  });

  test('--huella: si no es la de lo que se vio, no se publica', async () => {
    const e = await entorno();
    const p = encolar(e);
    const x = await falla(aprobar(e.cwd, p.id, { ...e.opciones, huella: '0'.repeat(12) }));
    assert.equal(x.codigo, 'huella_distinta');
    assert.equal(e.gh.peticiones.length, 0);
    const corta = vistaPrevia(e.cwd, p.id, { config: e.config }).huella.slice(0, 12);
    assert.equal((await aprobar(e.cwd, p.id, { ...e.opciones, huella: corta })).estado, 'publicado');
  });

  test('--huella demasiado corta para identificar nada se rechaza', async () => {
    const e = await entorno();
    const p = encolar(e);
    assert.equal((await falla(aprobar(e.cwd, p.id, { ...e.opciones, huella: 'abc' }))).codigo, 'huella_no_valida');
    assert.equal((await falla(aprobar(e.cwd, p.id, { ...e.opciones, huella: 'abcdef012345'.slice(0, 11) }))).codigo, 'huella_no_valida');
    assert.equal(e.gh.peticiones.length, 0);
  });

  test('un texto que ya no sale limpio de la redacción (pendiente manipulado y re-huellado) no se publica', async () => {
    const e = await entorno();
    const p = encolar(e);
    reescribirFirmado(e.cwd, p.id, (j) => {
      j.contenido.texto += '\nclave: ghp_' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8';
      j.huella = huellaDePublicacion(j);
    });
    const x = await falla(aprobar(e.cwd, p.id, e.opciones));
    assert.equal(x.codigo, 'contenido_no_redactado');
    assert.equal(e.gh.peticiones.length, 0);
  });

  test('interruptor apagado: ni lo aprobado se publica; al encender, sí (CA-006-03)', async () => {
    const e = await entorno();
    const p = encolar(e);
    apagar(e.cwd);
    const x = await falla(aprobar(e.cwd, p.id, e.opciones));
    assert.ok(x instanceof ErrorIntegracionesApagadas);
    assert.equal(e.gh.peticiones.length, 0);
    assert.equal(e.llamadasAFabrica.n, 0, 'apagado: no se lee el token');
    assert.equal(leerPendiente(e.cwd, p.id).estado, 'pendiente');
    encender(e.cwd);
    assert.equal((await aprobar(e.cwd, p.id, e.opciones)).estado, 'publicado');
  });

  test('tope de operaciones: corta antes de la red y pide revisión humana (CA-006-04)', async () => {
    const e = await entorno({ tope: 1 });
    await e.auditoria.ejecutar({ proveedor: 'github', operacion: 'leer_elemento', destino: 'org/repo', accion: async () => 1 });
    const p = encolar(e);
    const x = await falla(aprobar(e.cwd, p.id, e.opciones));
    assert.ok(x instanceof ErrorTopeIntegraciones);
    assert.equal(x.requiereRevisionHumana, true);
    assert.equal(e.gh.peticiones.length, 0);
    assert.equal(leerPendiente(e.cwd, p.id).estado, 'pendiente');
  });

  test('sin credencial: no se publica, no se marca fallido y no consume tope', async () => {
    const e = await entorno({ escribirToken: false });
    const p = encolar(e);
    const x = await falla(aprobar(e.cwd, p.id, e.opciones));
    assert.equal(x.codigo, 'sin_credencial');
    assert.equal(leerPendiente(e.cwd, p.id).estado, 'pendiente');
    assert.equal(e.auditoria.contadores().github ?? 0, 0);
    assert.equal(e.gh.peticiones.length, 0);
  });

  test('un alcance del token que excede bloquea la escritura hasta que se corrija', async () => {
    const e = await entorno();
    const p = encolar(e);
    escribirAlcance(e.cwd, 'github', { exceso: true, ambitos: ['api', 'sudo'], suficiente: true, motivo: 'tiene ámbitos de más' });
    assert.equal(leerAlcance(e.cwd).github.bloqueaEscritura, true);
    const x = await falla(aprobar(e.cwd, p.id, e.opciones));
    assert.equal(x.codigo, 'alcance_excedido');
    assert.match(x.message, /doctor/);
    assert.equal(e.gh.peticiones.length, 0);
    escribirAlcance(e.cwd, 'github', { exceso: false, ambitos: ['api'], suficiente: true });
    assert.equal((await aprobar(e.cwd, p.id, e.opciones)).estado, 'publicado');
  });
});

describe('F3.4 — la plataforma falla (CA-005-04)', () => {
  test('queda en «fallido», reintentable, y el estado del ciclo y la tarea no se tocan', async () => {
    const e = await entorno({ fallos: [{ metodo: 'POST', patron: /\/comments$/, estado: 500, cuerpo: `{"message":"boom ${TOKEN}"}`, veces: 1 }] });
    const p = encolar(e);
    const motor = foto(join(e.cwd, '.sdd', 'motor'));
    const proyecto = foto(join(e.cwd, 'src'));

    const r = await aprobar(e.cwd, p.id, e.opciones);
    assert.equal(r.ok, false);
    assert.equal(r.estado, 'fallido');
    assert.match(r.error.codigo, /^[a-z_]+$/);
    assert.ok(!JSON.stringify(r).includes(TOKEN), 'el cuerpo de la plataforma no entra en el error');
    const g = leerPendiente(e.cwd, p.id);
    assert.equal(g.estado, 'fallido');
    assert.ok(g.error.codigo);
    assert.ok(!JSON.stringify(g).includes(TOKEN));
    assert.equal(e.gh.repo('org/repo').comentarios.get(7), undefined, 'no se escribió nada');
    assert.deepEqual(foto(join(e.cwd, '.sdd', 'motor')), motor, 'el estado del ciclo no se tocó');
    assert.deepEqual(foto(join(e.cwd, 'src')), proyecto, 'los archivos de la tarea no se tocaron');

    // Reintento: la plataforma ya responde
    const r2 = await aprobar(e.cwd, p.id, e.opciones);
    assert.equal(r2.ok, true);
    assert.equal(r2.estado, 'publicado');
    assert.equal(e.gh.repo('org/repo').comentarios.get(7).length, 1);
    assert.equal(leerPendiente(e.cwd, p.id).error, undefined, 'el error de un intento anterior ya no figura');
  });

  test('una caída a mitad de una propuesta deja la rama y lo dice; el reintento no escribe en ella', async () => {
    const e = await entorno({ fallos: [{ metodo: 'POST', patron: /\/pulls$/, estado: 500, veces: 1 }] });
    const p = encolar(e, { tipo: 'propuesta' });
    const r = await aprobar(e.cwd, p.id, e.opciones);
    assert.equal(r.estado, 'fallido');
    assert.equal(r.error.codigo, 'parcial');
    assert.match(r.error.mensaje, /rama/i);
    const escrituras = e.gh.escrituras().length;
    const r2 = await aprobar(e.cwd, p.id, e.opciones);
    assert.equal(r2.estado, 'fallido');
    assert.equal(r2.error.codigo, 'rama_existe');
    assert.equal(e.gh.escrituras().length, escrituras, 'el reintento no escribió nada');
  });

  test('el interruptor y el tope no son fallos de la plataforma: el pendiente no pasa a «fallido»', async () => {
    const e = await entorno();
    const p = encolar(e);
    apagar(e.cwd);
    await falla(aprobar(e.cwd, p.id, e.opciones));
    assert.notEqual(leerPendiente(e.cwd, p.id).estado, 'fallido');
  });
});

describe('rechazar', () => {
  test('un pendiente rechazado no se publica; uno publicado no se puede rechazar', async () => {
    const e = await entorno();
    const p = encolar(e);
    const r = rechazar(e.cwd, p.id, 'no procede');
    assert.equal(r.estado, 'rechazado');
    assert.equal(leerPendiente(e.cwd, p.id).motivo, 'no procede');
    assert.equal((await falla(aprobar(e.cwd, p.id, e.opciones))).codigo, 'rechazado');
    assert.equal(e.gh.peticiones.length, 0);

    // Volver a preparar lo mismo lo reabre como pendiente nuevo
    const otra = encolar(e);
    assert.equal(otra.id, p.id);
    assert.equal(leerPendiente(e.cwd, p.id).estado, 'pendiente');
    await aprobar(e.cwd, p.id, e.opciones);
    assert.equal((await falla(Promise.resolve().then(() => rechazar(e.cwd, p.id)))).codigo, 'ya_publicado');
  });
});

describe('identificador de sesión del contador (punto 5)', () => {
  test('usa el runId de la sesión del ciclo si existe', () => {
    const p = proyectoConTarea({ runId: 'run-20261011120000-777' });
    assert.equal(sesionDeIntegraciones(p.cwd), 'run-20261011120000-777');
  });

  test('sin sesión del ciclo, uno por día (UTC)', () => {
    const p = proyectoConTarea({ sesion: false });
    assert.equal(sesionDeIntegraciones(p.cwd, new Date('2026-10-11T23:59:59Z')), 'dia-2026-10-11');
    assert.equal(sesionDeIntegraciones(p.cwd, new Date('2026-10-12T00:00:01Z')), 'dia-2026-10-12');
  });

  test('un sesion.json con un runId que no es un identificador válido se ignora', () => {
    const p = proyectoConTarea({ sesion: false });
    mkdirSync(join(p.cwd, '.sdd', 'motor'), { recursive: true });
    writeFileSync(join(p.cwd, '.sdd', 'motor', 'sesion.json'), JSON.stringify({ runId: '../../fuera' }));
    assert.match(sesionDeIntegraciones(p.cwd, new Date('2026-10-11T00:00:00Z')), /^dia-2026-10-11$/);
  });
});
