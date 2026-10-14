// @ts-check
/**
 * F4.2 — Diagnóstico de las integraciones (core/integraciones/doctor.js). CA-004-02, Escenario 3.
 *
 * Por proveedor activo: variable definida (sin su valor), host y HTTPS, modo y destinos, y alcance.
 * El alcance solo se comprueba donde la plataforma lo permite (GitLab con token personal, y solo con
 * `red: true`); en GitHub y Jira se dice que no se puede y se muestra el alcance declarado.
 */

import { BASE_LOCAL } from '../core/integraciones/pruebas-internas.js';
import { test, describe, after } from 'node:test';
import './fixtures/integraciones/entorno-usuario.mjs';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { diagnosticarIntegraciones } from '../core/integraciones/doctor.js';
import { leerAlcance, ErrorAprobacion, huellaDePublicacion } from '../core/integraciones/aprobacion.js';
import { claveLocal, directorioDeEstado, firmar } from '../core/integraciones/estado-usuario.js';
import { apagar } from '../core/integraciones/auditoria.js';
import { crearProveedorGitHub } from '../core/integraciones/proveedores/github.js';
import { crearProveedorGitLab } from '../core/integraciones/proveedores/gitlab.js';
import { crearProveedorJira } from '../core/integraciones/proveedores/jira.js';
import { leerToken, leerUsuario } from '../core/integraciones/config.js';
import { crearServidorGitHub } from './fixtures/integraciones/servidores/github.mjs';
import { crearServidorGitLab } from './fixtures/integraciones/servidores/gitlab.mjs';
import { crearServidorJiraFalso } from './fixtures/integraciones/servidores/jira.mjs';
import { escribirConfig } from './fixtures/integraciones/estado-ciclo.mjs';

const TOKEN_GH = 'github_pat_' + 'DOCTORa9f8e7d6c5b4a39281706f5e4d3c2b1a0';
const TOKEN_GL = 'glpat-' + 'DOCTOR0123456789abcdef';
/** Hosts que el USUARIO autoriza (R1): sin esto, ni GitLab autoalojado ni ningún Jira reciben credenciales. */
const HOSTS = { FORGE_INTEGRACIONES_HOSTS: 'gitlab.empresa.com,ejemplo.atlassian.net' };
const TOKEN_JI = 'ATATT3xFfGF0' + 'ZZdoctorJira9876543210abcdefXYZ';
const USUARIO = 'forge-bot@ejemplo.com';
const U = { FORGE_HOME: process.env.FORGE_HOME, FORGE_INTEGRACIONES_ESCRITURA: 'github,gitlab,jira' };

const cierres = /** @type {Array<() => Promise<void>>} */ ([]);
after(async () => { for (const c of cierres) await c(); });

function proyecto(yaml) {
  const cwd = mkdtempSync(join(tmpdir(), 'forge-doctor-'));
  if (yaml !== null) escribirConfig(cwd, yaml);
  else mkdirSync(join(cwd, '.sdd'), { recursive: true });
  return cwd;
}

/** Entorno que anota qué variables se leyen. */
function entornoVigilado(valores) {
  /** @type {string[]} */
  const lecturas = [];
  const env = new Proxy(valores, {
    get(t, k) { if (typeof k === 'string') lecturas.push(k); return Reflect.get(t, k); },
    has(t, k) { if (typeof k === 'string') lecturas.push(k); return Reflect.has(t, k); },
    ownKeys(t) { lecturas.push('(ownKeys)'); return Reflect.ownKeys(t); },
  });
  return { env, lecturas };
}

const texto = (r) => r.lineas.map((l) => l.texto).join('\n');

describe('sin integraciones activas no hace nada', () => {
  for (const [nombre, yaml] of [
    ['sin archivo de configuración', null],
    ['sin sección', 'motor:\n  modo: ciclo\n'],
    ['con todo apagado', 'integraciones:\n  github_modo: apagado\n  gitlab_modo: apagado\n  jira_modo: apagado\n'],
  ]) {
    test(nombre, async () => {
      const { env, lecturas } = entornoVigilado({ ...U, FORGE_GITHUB_TOKEN: TOKEN_GH });
      const r = await diagnosticarIntegraciones({ cwd: proyecto(yaml), env, red: true,
        crearProveedor: () => { throw new Error('no debe construirse nada'); } });
      assert.equal(r.activo, false);
      assert.deepEqual(r.lineas, []);
      assert.equal(r.problemas, 0);
      assert.deepEqual(lecturas, [], 'ni una lectura del entorno');
    });
  }
});

describe('GitHub: el alcance no se puede comprobar y se dice', () => {
  const YAML = 'integraciones:\n  github_modo: comentar\n  github_token_env: FORGE_GITHUB_TOKEN\n  github_destinos: org/repo, org/otro\n  github_alcance: Issues: lectura y escritura; Pull requests: escritura; solo org/repo\n';

  test('variable definida (sin valor), host HTTPS, modo, destinos, «no comprobable» y el alcance declarado', async () => {
    const gh = await crearServidorGitHub({ token: TOKEN_GH, repos: {} });
    cierres.push(() => gh.cerrar());
    const cwd = proyecto(YAML);
    const r = await diagnosticarIntegraciones({
      cwd, env: { ...U, FORGE_GITHUB_TOKEN: TOKEN_GH },
      crearProveedor: (cfg) => crearProveedorGitHub({ token: /** @type {string} */ (leerToken(cfg, { FORGE_GITHUB_TOKEN: TOKEN_GH })), destinos: cfg.destinos, modo: cfg.modo, [BASE_LOCAL]: gh.baseUrl }),
    });
    const t = texto(r);
    assert.equal(r.activo, true);
    assert.match(t, /github/i);
    assert.match(t, /FORGE_GITHUB_TOKEN.*definida/);
    assert.ok(!t.includes(TOKEN_GH), 'nunca el token');
    assert.match(t, /api\.github\.com/);
    assert.match(t, /HTTPS/);
    assert.match(t, /modo.*comentar/i);
    assert.match(t, /org\/repo.*org\/otro|2 destinos/);
    assert.match(t, /no se puede comprobar|no comprobable/i);
    assert.match(t, /Issues: lectura y escritura; Pull requests: escritura; solo org\/repo/);
    assert.match(t, /revís|revisa/i);
    assert.equal(r.problemas, 0);
    assert.equal(gh.peticiones.length, 0, 'GitHub: ninguna petición');
  });

  test('variable sin definir: lo dice con el NOMBRE y cuenta un problema', async () => {
    const r = await diagnosticarIntegraciones({ cwd: proyecto(YAML), env: { FORGE_HOME: process.env.FORGE_HOME, FORGE_INTEGRACIONES_ESCRITURA: process.env.FORGE_INTEGRACIONES_ESCRITURA }, crearProveedor: () => { throw new ErrorAprobacion('sin_credencial', 'x'); } });
    const t = texto(r);
    assert.match(t, /FORGE_GITHUB_TOKEN.*no está definida/);
    assert.ok(r.problemas >= 1);
    assert.ok(r.lineas.some((l) => l.nivel === 'aviso' || l.nivel === 'error'));
  });

  test('sin alcance declarado lo dice y pide declararlo', async () => {
    const cwd = proyecto('integraciones:\n  github_modo: solo_lectura\n  github_token_env: FORGE_GITHUB_TOKEN\n  github_destinos: org/repo\n');
    const r = await diagnosticarIntegraciones({ cwd, env: { ...U, FORGE_GITHUB_TOKEN: TOKEN_GH }, crearProveedor: () => crearProveedorGitHub({ token: TOKEN_GH, destinos: ['org/repo'], modo: 'solo_lectura' }) });
    assert.match(texto(r), /github_alcance/);
  });
});

describe('GitLab: alcance real con token personal, solo con red explícita', () => {
  const yaml = (modo) => `integraciones:\n  gitlab_modo: ${modo}\n  gitlab_host: gitlab.empresa.com\n  gitlab_token_env: FORGE_GITLAB_TOKEN\n  gitlab_destinos: empresa/web\n`;
  const montar = async (modo, ambitos, extra = {}) => {
    const gl = await crearServidorGitLab({ token: TOKEN_GL, proyectos: { 'empresa/web': {} }, ambitos, ...extra });
    cierres.push(() => gl.cerrar());
    const cwd = proyecto(yaml(modo));
    const opciones = {
      cwd, env: { ...U, FORGE_GITLAB_TOKEN: TOKEN_GL, ...HOSTS },
      crearProveedor: (/** @type {any} */ cfg) => crearProveedorGitLab({ token: /** @type {string} */ (leerToken(cfg, { FORGE_GITLAB_TOKEN: TOKEN_GL, ...HOSTS })), destinos: cfg.destinos, modo: cfg.modo, [BASE_LOCAL]: gl.baseUrl }),
    };
    return { gl, cwd, opciones };
  };

  test('sin --red no sale a la red y explica cómo comprobarlo', async () => {
    const { gl, opciones } = await montar('solo_lectura', ['api']);
    const r = await diagnosticarIntegraciones({ ...opciones, red: false });
    assert.equal(gl.peticiones.length, 0);
    assert.match(texto(r), /integraciones-red/);
    assert.match(texto(r), /sin red|no se comprobó|no se comprueba/i);
  });

  test('token con «api» y modo solo_lectura: avisa del exceso, bloquea la escritura y lo dice', async () => {
    const { gl, cwd, opciones } = await montar('solo_lectura', ['api']);
    const r = await diagnosticarIntegraciones({ ...opciones, red: true });
    const t = texto(r);
    assert.equal(gl.peticiones.length, 1);
    assert.equal(gl.peticiones[0].ruta, '/api/v4/personal_access_tokens/self');
    assert.match(t, /excede|de más|más de lo necesario/i);
    assert.match(t, /read_api/);
    assert.match(t, /bloque/i);
    assert.ok(r.problemas >= 1);
    assert.equal(leerAlcance(cwd).gitlab.bloqueaEscritura, true);
    assert.deepEqual(r.bloqueos, ['gitlab']);
    assert.ok(!t.includes(TOKEN_GL));
  });

  test('token con exactamente lo necesario: sin exceso, y desbloquea lo que estuviera bloqueado', async () => {
    const { cwd, opciones } = await montar('comentar', ['api']);
    await diagnosticarIntegraciones({ ...opciones, red: true });
    assert.equal(leerAlcance(cwd).gitlab.bloqueaEscritura, false);
    assert.equal(leerAlcance(cwd).gitlab.exceso, false);
  });

  test('token con ámbitos de más para escribir (api + sudo): bloquea', async () => {
    const { cwd, opciones } = await montar('proponer', ['api', 'sudo']);
    const r = await diagnosticarIntegraciones({ ...opciones, red: true });
    assert.equal(leerAlcance(cwd).gitlab.bloqueaEscritura, true);
    assert.deepEqual(r.bloqueos, ['gitlab']);
  });

  test('token read_api con modo comentar: no excede pero es insuficiente, y lo dice', async () => {
    const { cwd, opciones } = await montar('comentar', ['read_api']);
    const r = await diagnosticarIntegraciones({ ...opciones, red: true });
    assert.match(texto(r), /insuficiente|no basta|falta/i);
    assert.equal(leerAlcance(cwd).gitlab?.bloqueaEscritura, false);
  });

  test('token de proyecto (no hay /self): «no comprobable», sin bloquear', async () => {
    const { cwd, opciones } = await montar('comentar', ['api'], { tipoToken: 'proyecto' });
    const r = await diagnosticarIntegraciones({ ...opciones, red: true });
    assert.match(texto(r), /no se puede comprobar|no comprobable/i);
    assert.equal(leerAlcance(cwd).gitlab, undefined);
  });

  test('la plataforma caída o con otro error: aviso, no excepción', async () => {
    const { gl, opciones } = await montar('comentar', ['api']);
    gl.fallar(() => true, 500, { message: 'boom' });
    const r = await diagnosticarIntegraciones({ ...opciones, red: true });
    assert.match(texto(r), /no se pudo comprobar/i);
    assert.ok(r.problemas >= 1);
  });

  test('con el interruptor apagado no se hace ninguna petición ni siquiera con --red', async () => {
    const { gl, cwd, opciones } = await montar('comentar', ['api']);
    apagar(cwd);
    const r = await diagnosticarIntegraciones({ ...opciones, red: true });
    assert.equal(gl.peticiones.length, 0);
    assert.match(texto(r), /apagad/i);
  });
});

describe('Jira: el límite de los tokens con ámbitos', () => {
  const YAML = 'integraciones:\n  jira_modo: comentar\n  jira_sitio: ejemplo.atlassian.net\n  jira_usuario_env: FORGE_JIRA_USUARIO\n  jira_token_env: FORGE_JIRA_TOKEN\n  jira_destinos: ABC\n  jira_alcance: token de API clásico, sin ámbitos; usuario de servicio con permiso de comentar en ABC\n';

  test('variables del usuario y del token, «no comprobable», alcance declarado y aviso del límite', async () => {
    const ji = await crearServidorJiraFalso({ usuario: USUARIO, token: TOKEN_JI, tickets: {} });
    cierres.push(() => ji.cerrar());
    const env = { ...U, FORGE_JIRA_USUARIO: USUARIO, FORGE_JIRA_TOKEN: TOKEN_JI, ...HOSTS };
    const r = await diagnosticarIntegraciones({
      cwd: proyecto(YAML), env,
      crearProveedor: (cfg) => crearProveedorJira({ sitio: cfg.host, usuario: /** @type {string} */ (leerUsuario(cfg, env)), token: /** @type {string} */ (leerToken(cfg, env)), destinos: cfg.destinos, modo: cfg.modo, [BASE_LOCAL]: ji.baseUrl }),
    });
    const t = texto(r);
    assert.match(t, /FORGE_JIRA_USUARIO.*definida/);
    assert.match(t, /FORGE_JIRA_TOKEN.*definida/);
    assert.match(t, /ejemplo\.atlassian\.net/);
    assert.match(t, /no se puede comprobar|no comprobable/i);
    assert.match(t, /token de API clásico, sin ámbitos/);
    assert.match(t, /sin ámbitos|ámbitos/i);
    assert.match(t, /proponer.*comentar|solicitudes de cambio/i);
    assert.ok(!t.includes(TOKEN_JI) && !t.includes(USUARIO));
    assert.equal(ji.peticiones.length, 0, 'Jira: ninguna petición');
  });

  test('si el alcance declarado habla de ámbitos, avisa con más fuerza de que no está soportado', async () => {
    const cwd = proyecto(YAML.replace('token de API clásico, sin ámbitos', 'token con ámbitos write:jira-work'));
    const env = { ...U, FORGE_JIRA_USUARIO: USUARIO, FORGE_JIRA_TOKEN: TOKEN_JI, ...HOSTS };
    const r = await diagnosticarIntegraciones({ cwd, env, crearProveedor: () => { throw new ErrorAprobacion('sin_credencial', 'x'); } });
    assert.ok(r.lineas.some((l) => l.nivel === 'aviso' && /ámbitos/i.test(l.texto) && /no (está )?soportad/i.test(l.texto)));
    assert.ok(r.problemas >= 1);
  });
});

describe('el resto de la información', () => {
  test('una configuración no válida se informa como problema sin imprimir el valor', async () => {
    const literal = 'ghp_' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8';
    const cwd = proyecto(`integraciones:\n  github_modo: comentar\n  github_token_env: ${literal}\n  github_destinos: org/repo\n`);
    const r = await diagnosticarIntegraciones({ cwd, env: { FORGE_HOME: process.env.FORGE_HOME, FORGE_INTEGRACIONES_ESCRITURA: process.env.FORGE_INTEGRACIONES_ESCRITURA }, crearProveedor: () => { throw new Error('no'); } });
    assert.equal(r.activo, true);
    assert.ok(r.problemas >= 1);
    assert.match(texto(r), /no válida|token_env/);
    assert.ok(!texto(r).includes(literal));
  });

  test('muestra el interruptor, el tope y las publicaciones pendientes y fallidas', async () => {
    const cwd = proyecto('integraciones:\n  github_modo: comentar\n  github_token_env: FORGE_GITHUB_TOKEN\n  github_destinos: org/repo\n  topes_operaciones_por_sesion: 7\n');
    const dirP = join(directorioDeEstado(cwd), 'pendientes');
    mkdirSync(dirP, { recursive: true });
    const base = { proveedor: 'github', operacion: 'comentar', destino: 'org/repo', referencia: 'org/repo#1', contenido: { tipo: 'comentario', texto: 'x', marcador: 'm' }, creado: '2026-10-11T00:00:00.000Z' };
    const firmado = (extra) => { const o = { ...base, ...extra }; o.huella = huellaDePublicacion(o); return JSON.stringify({ ...o, hmac: firmar(claveLocal(directorioDeEstado(cwd)), o) }); };
    writeFileSync(join(dirP, 'p1.json'), firmado({ id: 'p1', estado: 'pendiente' }));
    writeFileSync(join(dirP, 'p2.json'), firmado({ id: 'p2', estado: 'fallido', error: { codigo: 'x', mensaje: 'y', ts: 'z' } }));
    const r = await diagnosticarIntegraciones({ cwd, env: { ...U, FORGE_GITHUB_TOKEN: TOKEN_GH }, crearProveedor: () => crearProveedorGitHub({ token: TOKEN_GH, destinos: ['org/repo'], modo: 'solo_lectura' }) });
    const t = texto(r);
    assert.match(t, /tope.*7/i);
    assert.match(t, /1 pendiente/i);
    assert.match(t, /1 fallid/i);
    assert.match(t, /encendid|activ/i);
  });

  test('solo se lee el entorno de los proveedores activos', async () => {
    const { env, lecturas } = entornoVigilado({ ...U, FORGE_GITHUB_TOKEN: TOKEN_GH, FORGE_GITLAB_TOKEN: TOKEN_GL, FORGE_JIRA_TOKEN: TOKEN_JI, ...HOSTS });
    const cwd = proyecto('integraciones:\n  github_modo: solo_lectura\n  github_token_env: FORGE_GITHUB_TOKEN\n  github_destinos: org/repo\n  gitlab_modo: apagado\n  gitlab_token_env: FORGE_GITLAB_TOKEN\n');
    await diagnosticarIntegraciones({ cwd, env, crearProveedor: () => crearProveedorGitHub({ token: TOKEN_GH, destinos: ['org/repo'], modo: 'solo_lectura' }) });
    const permitidas = ['FORGE_GITHUB_TOKEN', 'FORGE_INTEGRACIONES', 'FORGE_INTEGRACIONES_HOSTS', 'FORGE_INTEGRACIONES_ESCRITURA', 'FORGE_INTEGRACIONES_DESTINOS', 'FORGE_HOME', 'LOCALAPPDATA'].flatMap((k) => (k.startsWith('FORGE_') ? [k, k.replace('FORGE_', 'FRAGUA_')] : [k]));
    assert.ok(lecturas.every((k) => permitidas.includes(k)), `se leyó: ${lecturas.join(', ')}`);
    assert.ok(!lecturas.includes('FORGE_GITLAB_TOKEN'));
  });
});
