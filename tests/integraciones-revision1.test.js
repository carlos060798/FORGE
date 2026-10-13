// @ts-check
/**
 * Revisión independiente 1 (seguridad) de integraciones externas: una prueba por hallazgo R1 a R15.
 * Cada bloque reproduce lo que la revisión demostró (`revision-independiente-1.md`) y comprueba que
 * ya no ocurre. Todo es local: servidores de node:http en 127.0.0.1 o un `http` inyectado; ninguna
 * llamada de red real ni credenciales reales. Los caracteres invisibles se construyen con códigos
 * (`String.fromCharCode`) para que el archivo no lleve ninguno literal.
 */

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { interpretarIntegraciones, leerToken, leerUsuario, ErrorConfigIntegraciones, hostAutorizado, motivoVariableNoPermitida } from '../core/integraciones/config.js';
import { ErrorHostNoAutorizado, exigirHostAutorizado, hostsDelUsuario, motivoHostVetado } from '../core/integraciones/hosts.js';
import { motivoRutaVetada } from '../core/integraciones/rutas.js';
import { AuditoriaIntegraciones, ErrorIntegracionesApagadas, apagar, estadoInterruptor } from '../core/integraciones/auditoria.js';
import { diagnosticarIntegraciones } from '../core/integraciones/doctor.js';
import { pedir, ErrorHttpIntegracion } from '../core/integraciones/http.js';
import { comoDato } from '../core/integraciones/confianza.js';
import { adfATexto } from '../core/integraciones/proveedores/jira-adf.js';
import { redactar, redactarFormatos } from '../core/ciclo/redactar.js';
import { crearProveedorGitHub } from '../core/integraciones/proveedores/github.js';
import { crearProveedorGitLab } from '../core/integraciones/proveedores/gitlab.js';
import { crearProveedorJira } from '../core/integraciones/proveedores/jira.js';
import { BASE_LOCAL } from '../core/integraciones/pruebas-internas.js';
import { derivarMarcador } from '../core/integraciones/marcador.js';
import { auditoriaDePrueba } from './fixtures/integraciones/auditoria-prueba.mjs';
import { crearServidorGitHub } from './fixtures/integraciones/servidores/github.mjs';
import { crearServidorGitLab } from './fixtures/integraciones/servidores/gitlab.mjs';
import { crearServidorJiraFalso, adfParrafo } from './fixtures/integraciones/servidores/jira.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..');
const c = (n) => String.fromCharCode(n);
const ZW = c(0x200b);          // ancho cero
const BIDI = c(0x202e);        // sobrescritura de derecha a izquierda
const RELLENO = c(0x3164);     // relleno hangul
const BRAILLE = c(0x2800);     // braille en blanco
const CGJ = c(0x034f);         // combining grapheme joiner
const COMBINANTE = c(0x0301);  // acento combinante
const ANCHO = c(0xff0e);       // punto de ancho completo

const TOKEN_GH = 'github_pat_' + 'REVISION1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d';
const TOKEN_GL = 'glpat-' + 'REVISION1234567890abcdef';
const TOKEN_JI = 'jira-token-' + 'REVISION1234567890';
const USUARIO = 'servicio@ejemplo.test';

/** @type {Array<() => Promise<void>|void>} */
const limpieza = [];
afterEach(async () => { for (const f of limpieza.splice(0)) await f(); });

const sinEspera = (/** @type {any} */ o) => pedir({ ...o, _esperar: async () => {} });

function proyecto(yaml = '') {
  const dir = mkdtempSync(join(tmpdir(), 'forge-rev1-'));
  mkdirSync(join(dir, '.sdd'), { recursive: true });
  if (yaml) writeFileSync(join(dir, '.sdd', 'sdd.config.yaml'), yaml);
  return dir;
}

/** Entorno que anota qué claves se leen. */
function entornoVigilado(base) {
  /** @type {string[]} */ const lecturas = [];
  const env = new Proxy(base, { get(t, k) { if (typeof k === 'string') lecturas.push(k); return Reflect.get(t, k); } });
  return { env: /** @type {Record<string, string|undefined>} */ (env), lecturas };
}

async function fallo(promesa) {
  try { await promesa; } catch (e) { return /** @type {any} */ (e); }
  return assert.fail('debía fallar');
}

/** `http` que cuenta y no hace nada: ninguna operación rechazada debe llegar aquí. */
function httpContador() {
  const llamadas = [];
  const http = async (/** @type {any} */ o) => { llamadas.push(o); throw new Error('no debía haber petición'); };
  return { http, llamadas };
}

// ════════════════════════════════════════════════════════════════════════════════════════════
describe('R1 el repositorio hostil no elige variable ni host', () => {
  const REVISION = 'integraciones:\n  gitlab_modo: solo_lectura\n  gitlab_host: gitlab.evil.example\n  gitlab_token_env: AWS_SECRET_ACCESS_KEY\n  gitlab_destinos: grupo/proyecto\n  jira_modo: solo_lectura\n  jira_sitio: atacante.atlassian.net\n  jira_usuario_env: USERNAME\n  jira_token_env: ANTHROPIC_API_KEY\n  jira_destinos: ABC\n';

  test('la configuración exacta de la revisión ya no se acepta', () => {
    const e = assert.throws(() => interpretarIntegraciones(REVISION), (x) => x instanceof ErrorConfigIntegraciones);
    void e;
    try { interpretarIntegraciones(REVISION); } catch (x) {
      const t = /** @type {any} */ (x).message;
      assert.match(t, /gitlab_token_env/);
      assert.match(t, /jira_token_env/);
      assert.match(t, /jira_usuario_env/);
      assert.match(t, /FORGE_/);
    }
  });

  test('(a) solo FORGE_ + mayúsculas, dígitos y «_»; nada de variables ajenas ni reservadas', () => {
    const malos = ['AWS_SECRET_ACCESS_KEY', 'ANTHROPIC_API_KEY', 'PATH', 'USERNAME', 'HOME', 'forge_github_token', 'FORGE_github', 'FORGE-X', 'FORGE_', 'XFORGE_TOKEN',
      'FORGE_BUDGET_USD', 'FORGE_BUDGET_BLOCK_USD', 'FORGE_LLM_PROVIDER', 'FORGE_API_TOKEN', 'FORGE_INTEGRACIONES', 'FORGE_INTEGRACIONES_HOSTS', 'FORGE_NIVEL_MAXIMO', 'FORGE_UI_PORT'];
    for (const nombre of malos) {
      assert.notEqual(motivoVariableNoPermitida(nombre), null, nombre);
      assert.throws(() => interpretarIntegraciones(`integraciones:\n  github_modo: solo_lectura\n  github_token_env: ${nombre}\n  github_destinos: org/repo\n`), ErrorConfigIntegraciones, nombre);
      assert.throws(() => interpretarIntegraciones(`integraciones:\n  jira_modo: solo_lectura\n  jira_sitio: a.atlassian.net\n  jira_usuario_env: ${nombre}\n  jira_token_env: FORGE_JIRA_TOKEN\n  jira_destinos: ABC\n`), ErrorConfigIntegraciones, nombre);
    }
    for (const bueno of ['FORGE_GITHUB_TOKEN', 'FORGE_GITLAB_TOKEN_2', 'FORGE_MI_EMPRESA_JIRA_USUARIO']) {
      assert.equal(motivoVariableNoPermitida(bueno), null, bueno);
    }
  });

  test('(a) una configuración construida a mano tampoco puede leer una variable ajena', () => {
    const cfg = { nombre: /** @type {'github'} */ ('github'), modo: /** @type {'comentar'} */ ('comentar'), host: 'api.github.com', tokenEnv: 'AWS_SECRET_ACCESS_KEY', destinos: ['o/r'] };
    const { env, lecturas } = entornoVigilado({ AWS_SECRET_ACCESS_KEY: 'secreto-de-aws-0123456789' });
    assert.throws(() => leerToken(cfg, env), /FORGE_/);
    assert.ok(!lecturas.includes('AWS_SECRET_ACCESS_KEY'));
  });

  test('(b) un host autoalojado o un Jira que el usuario no autorizó: error claro, sin leer el token', () => {
    const cfg = interpretarIntegraciones('integraciones:\n  gitlab_modo: solo_lectura\n  gitlab_host: gitlab.evil.example\n  gitlab_token_env: FORGE_GITLAB_TOKEN\n  gitlab_destinos: g/p\n'
      + '  jira_modo: solo_lectura\n  jira_sitio: atacante.atlassian.net\n  jira_usuario_env: FORGE_JIRA_USUARIO\n  jira_token_env: FORGE_JIRA_TOKEN\n  jira_destinos: ABC\n');
    for (const [prov, variables] of /** @type {const} */ ([['gitlab', ['FORGE_GITLAB_TOKEN']], ['jira', ['FORGE_JIRA_TOKEN', 'FORGE_JIRA_USUARIO']]])) {
      const { env, lecturas } = entornoVigilado({ FORGE_GITLAB_TOKEN: 'x'.repeat(20), FORGE_JIRA_TOKEN: 'y'.repeat(20), FORGE_JIRA_USUARIO: 'a@b.c' });
      const e = assert.throws(() => leerToken(cfg.proveedores[prov], env), (x) => x instanceof ErrorHostNoAutorizado);
      void e;
      try { leerToken(cfg.proveedores[prov], env); } catch (x) {
        const m = /** @type {any} */ (x).message;
        assert.match(m, /FORGE_INTEGRACIONES_HOSTS/, 'dice qué definir');
        assert.match(m, /No se hizo ninguna petición ni se leyó ningún token/);
      }
      for (const v of variables) assert.ok(!lecturas.includes(v), `no se leyó ${v}`);
      assert.throws(() => leerUsuario(cfg.proveedores[prov], env), ErrorHostNoAutorizado);
    }
  });

  test('(b) con el host en FORGE_INTEGRACIONES_HOSTS (comparación exacta) sí se lee', () => {
    const cfg = interpretarIntegraciones('integraciones:\n  gitlab_modo: solo_lectura\n  gitlab_host: gitlab.empresa.com\n  gitlab_token_env: FORGE_GITLAB_TOKEN\n  gitlab_destinos: g/p\n');
    const env = { FORGE_GITLAB_TOKEN: 'glpat-valor-de-prueba-0123', FORGE_INTEGRACIONES_HOSTS: 'otro.example, GitLab.Empresa.com ,' };
    assert.equal(leerToken(cfg.proveedores.gitlab, env), 'glpat-valor-de-prueba-0123');
    assert.deepEqual(hostsDelUsuario(env), ['otro.example', 'gitlab.empresa.com']);
    // Ni sufijos, ni prefijos, ni subdominios, ni otro puerto
    for (const lista of ['empresa.com', 'x.gitlab.empresa.com', 'gitlab.empresa.com.evil.test', '*.empresa.com', 'gitlab.empresa.co']) {
      assert.throws(() => exigirHostAutorizado('gitlab', 'gitlab.empresa.com', { FORGE_INTEGRACIONES_HOSTS: lista }), ErrorHostNoAutorizado, lista);
    }
    // El proyecto no puede autorizarse a sí mismo: no hay clave de configuración para eso
    assert.throws(() => interpretarIntegraciones('integraciones:\n  gitlab_modo: solo_lectura\n  gitlab_hosts_autorizados: x.example\n  gitlab_token_env: FORGE_GITLAB_TOKEN\n  gitlab_destinos: g/p\n'), ErrorConfigIntegraciones);
  });

  test('(b) los hosts de defecto no necesitan la lista; GitHub nunca admite otro', () => {
    assert.equal(exigirHostAutorizado('github', 'api.github.com', {}), 'api.github.com');
    assert.equal(exigirHostAutorizado('gitlab', 'gitlab.com', {}), 'gitlab.com');
    assert.throws(() => exigirHostAutorizado('github', 'ghe.empresa.com', { FORGE_INTEGRACIONES_HOSTS: 'ghe.empresa.com' }), ErrorHostNoAutorizado);
    assert.throws(() => exigirHostAutorizado('jira', 'ejemplo.atlassian.net', {}), ErrorHostNoAutorizado);
    assert.equal(exigirHostAutorizado('jira', 'ejemplo.atlassian.net', { FORGE_INTEGRACIONES_HOSTS: 'ejemplo.atlassian.net' }), 'ejemplo.atlassian.net');
    // Jira solo admite *.atlassian.net, aunque esté en la lista
    assert.throws(() => exigirHostAutorizado('jira', 'jira.empresa.com', { FORGE_INTEGRACIONES_HOSTS: 'jira.empresa.com' }), ErrorHostNoAutorizado);
  });

  test('(c) localhost, *.localhost, *.internal, *.local, IP, metadata.* y puertos ≠ 443: siempre, también en la lista', () => {
    const vetados = ['localhost', 'foo.localhost', 'metadata.google.internal', 'servicio.internal', 'impresora.local', '127.0.0.1', '10.0.0.5', '169.254.169.254',
      '2130706433', '0x7f.1', 'metadata.cloud.example', 'metadata', 'gitlab.com:22', 'gitlab.empresa.com:8443', 'gitlab.empresa.com:80', '[::1]'];
    for (const h of vetados) {
      assert.notEqual(motivoHostVetado(h), null, h);
      assert.throws(() => exigirHostAutorizado('gitlab', h, { FORGE_INTEGRACIONES_HOSTS: h }), ErrorHostNoAutorizado, h);
      assert.throws(() => interpretarIntegraciones(`integraciones:\n  gitlab_modo: solo_lectura\n  gitlab_host: ${h}\n  gitlab_token_env: FORGE_GITLAB_TOKEN\n  gitlab_destinos: g/p\n`), ErrorConfigIntegraciones, h);
    }
    assert.equal(motivoHostVetado('gitlab.empresa.com:443'), null);
    assert.equal(motivoHostVetado('gitlab.empresa.com'), null);
    // También el cliente HTTP, sin ninguna lista de por medio
    for (const h of ['servicio.internal', 'impresora.local', 'metadata.cloud.example', 'gitlab.com:22']) {
      const e = assert.rejects(() => pedir({ host: h, ruta: '/x', permitidos: [h] }), (x) => x instanceof ErrorHttpIntegracion && x.codigo === 'host_no_permitido');
      void e;
    }
  });

  test('(d) el adaptador no se construye con un host sin validar y solo habla con el host exacto', async () => {
    const aud = auditoriaDePrueba();
    const base = { token: TOKEN_GL, destinos: ['g/p'], modo: /** @type {const} */ ('solo_lectura'), auditoria: aud };
    assert.throws(() => crearProveedorGitLab({ ...base, host: 'gitlab.evil.example', env: {} }), ErrorHostNoAutorizado);
    assert.throws(() => crearProveedorGitLab({ ...base, host: 'gitlab.empresa.com:8443', env: { FORGE_INTEGRACIONES_HOSTS: 'gitlab.empresa.com:8443' } }), ErrorHostNoAutorizado);
    assert.throws(() => crearProveedorJira({ modo: 'comentar', sitio: 'atacante.atlassian.net', usuario: USUARIO, token: TOKEN_JI, destinos: ['ABC'], auditoria: aud, env: {} }), /no está autorizado|host_no_autorizado/);

    const vistos = [];
    const http = async (/** @type {any} */ o) => { vistos.push(o); return { estado: 200, ok: true, cabeceras: {}, texto: JSON.stringify({ iid: 1, title: 't', description: null, labels: [] }), intentos: 1 }; };
    const gl = crearProveedorGitLab({ ...base, host: 'gitlab.empresa.com', env: { FORGE_INTEGRACIONES_HOSTS: 'gitlab.empresa.com' }, http });
    await gl.leerElemento('g/p#1').catch(() => {});
    assert.ok(vistos.length > 0);
    for (const v of vistos) {
      assert.equal(v.host, 'gitlab.empresa.com');
      assert.deepEqual(v.permitidos, ['gitlab.empresa.com']);
    }
  });

  test('(e) forge doctor muestra FORGE_INTEGRACIONES_HOSTS y los nombres de variable, y no lee el token de un host sin autorizar', async () => {
    const yaml = 'integraciones:\n  gitlab_modo: solo_lectura\n  gitlab_host: gitlab.empresa.com\n  gitlab_token_env: FORGE_GITLAB_TOKEN\n  gitlab_destinos: empresa/web\n  gitlab_alcance: read_api\n';
    const cwd = proyecto(yaml);
    const sin = entornoVigilado({ FORGE_GITLAB_TOKEN: TOKEN_GL });
    const r1 = await diagnosticarIntegraciones({ cwd, env: sin.env });
    const t1 = r1.lineas.map((l) => l.texto).join('\n');
    assert.match(t1, /FORGE_INTEGRACIONES_HOSTS/);
    assert.match(t1, /\(no definida\)/);
    assert.match(t1, /FORGE_GITLAB_TOKEN/);
    assert.ok(r1.problemas >= 1);
    assert.match(t1, /gitlab\.empresa\.com.*no está autorizado/s);
    assert.ok(!sin.lecturas.includes('FORGE_GITLAB_TOKEN'), 'no se leyó el token');
    assert.ok(!t1.includes(TOKEN_GL));

    const con = { FORGE_GITLAB_TOKEN: TOKEN_GL, FORGE_INTEGRACIONES_HOSTS: 'gitlab.empresa.com' };
    const r2 = await diagnosticarIntegraciones({ cwd, env: con });
    const t2 = r2.lineas.map((l) => l.texto).join('\n');
    assert.match(t2, /FORGE_INTEGRACIONES_HOSTS.*gitlab\.empresa\.com/);
    assert.match(t2, /autorizado por FORGE_INTEGRACIONES_HOSTS/);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
describe('R2 denegación de servicio por CPU', () => {
  const LIMITE_MS = 500;
  const MIB = 1024 * 1024;
  /** @param {() => void} fn */
  const tiempo = (fn) => { const t0 = performance.now(); fn(); return performance.now() - t0; };

  test('(a) adfATexto: una celda de tabla con 1 MiB de espacios', () => {
    const doc = (texto) => ({ type: 'doc', content: [{ type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: texto }] }] }] }] }] });
    for (const texto of [' '.repeat(MIB), ('a' + ' '.repeat(2000) + '\n').repeat(500), '\n' + ' '.repeat(MIB / 2) + '\n' + ' '.repeat(MIB / 2)]) {
      const ms = tiempo(() => adfATexto(doc(texto), { maxBytes: MIB }));
      assert.ok(ms < LIMITE_MS, `adfATexto tardó ${Math.round(ms)} ms`);
    }
    // El comportamiento no cambió: un salto con espacios alrededor es un solo espacio
    assert.equal(adfATexto(doc('uno  \n  dos\n\ntres   cuatro')), 'uno dos tres   cuatro');
  });

  test('(b) comoDato: imágenes y enlaces markdown, etiquetas HTML y campos repetidos', () => {
    for (const unidad of ['![a](', '[a](', '<a ', '![', '<img ', '[a][', '](']) {
      const s = unidad.repeat(Math.ceil(MIB / unidad.length));
      const ms = tiempo(() => comoDato({ cuerpo: s, comentarios: Array(30).fill(s) }));
      assert.ok(ms < LIMITE_MS, `comoDato con ${JSON.stringify(unidad)} tardó ${Math.round(ms)} ms`);
      const ms2 = tiempo(() => comoDato({ cuerpo: s }, { maxBytes: MIB }));
      assert.ok(ms2 < LIMITE_MS, `comoDato (1 MiB) con ${JSON.stringify(unidad)} tardó ${Math.round(ms2)} ms`);
    }
    // Lo legítimo sigue convirtiéndose en texto inerte
    const t = comoDato({ cuerpo: 'ver ![logo](https://x.example/a.png) y [doc](https://x.example/d) <img src=x>' });
    assert.match(t, /\[imagen: logo\]/);
    assert.match(t, /doc \(hxxps\[:\]\/\/x\.example\/d\)/);
    assert.ok(!/<img/i.test(t));
  });

  test('(c) redactar y redactarFormatos: BEGIN de clave privada repetido', () => {
    for (const unidad of ['-----BEGIN PRIVATE KEY-----', '-----BEGIN RSA PRIVATE KEY-----\n', '-----BEGIN ', '-----END ', '-----BEGIN PRIVATE KEY-----x-----END ']) {
      const s = unidad.repeat(Math.ceil(MIB / unidad.length));
      for (const f of [redactar, redactarFormatos]) {
        const ms = tiempo(() => f(s));
        assert.ok(ms < LIMITE_MS, `${f.name} con ${JSON.stringify(unidad.slice(0, 20))} tardó ${Math.round(ms)} ms`);
      }
    }
    // Y sigue redactando bloques completos, cortados y varios
    const bloque = '-----BEGIN RSA PRIVATE KEY-----\nMIIabc\n-----END RSA PRIVATE KEY-----';
    assert.equal(redactar(`a ${bloque} b ${bloque} c`), 'a [REDACTADO: clave privada] b [REDACTADO: clave privada] c');
    assert.equal(redactar('x -----BEGIN PRIVATE KEY-----\nMII'), 'x [REDACTADO: clave privada]');
    assert.equal(redactarFormatos('x -----BEGIN PRIVATE KEY-----\nMII'), 'x -----BEGIN PRIVATE KEY-----\nMII');
  });

  test('todas las expresiones de core/integraciones y de redactar con una entrada patológica de 256 KiB', () => {
    const TAM = 256 * 1024;
    const unidades = ['a', ' ', '\n', '\t', '![a](', '[a](', '<a ', '<', '[', '-----BEGIN ', '-----BEGIN PRIVATE KEY-----', 'token=', 'token: ', 'Authorization: Bearer ',
      'https://u:', '://', '"password":"', 'ghp_', 'eyJ', 'sk-', 'AccountKey=', 'password="a ', "pwd='", '> ', '#', '---', '<<<', '<!--', 'javascript:', 'www.', 'a.', ZW, 'a' + ZW, RELLENO, 'a' + COMBINANTE];
    for (const u of unidades) {
      const s = u.repeat(Math.ceil(TAM / u.length)).slice(0, TAM);
      const nombre = JSON.stringify(u);
      const por = {
        redactar: () => redactar(s),
        redactarFormatos: () => redactarFormatos(s),
        comoDato: () => comoDato({ cuerpo: s, comentarios: [s, s], titulo: s, referencia: s }),
        adfATexto: () => adfATexto({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] }, { maxBytes: MIB }),
      };
      for (const [n, f] of Object.entries(por)) {
        const ms = tiempo(f);
        assert.ok(ms < LIMITE_MS, `${n} con ${nombre} tardó ${Math.round(ms)} ms`);
      }
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
describe('R3 y R8 rutas vetadas de proponerCambio: una lista común', () => {
  const VETADAS = [
    '.github/workflows/ci.yml', '.GITHUB/Workflows/CI.yml', '.github/actions/x/action.yml', '.github/CODEOWNERS', '.github/dependabot.yml', 'sub/.github/x.yml',
    '.gitlab/CODEOWNERS', '.gitlab/issue_templates/a.md', '.gitlab-ci.yml', '.GITLAB-CI.YAML', '.gitlab-ci.yaml', 'Jenkinsfile', 'sub/jenkinsfile', '.circleci/config.yml',
    'azure-pipelines.yml', '.travis.yml', 'bitbucket-pipelines.yml', '.gitmodules', 'a/.gitmodules', '.gitattributes', '.gitignore', 'src/.gitignore',
    'CODEOWNERS', 'docs/CODEOWNERS', 'a/b/codeowners', '.husky/pre-commit',
    '.git/config', 'a/.git/hooks/x', '.GIT/config', '.git', '.git /config', '.git./config', '.git ', `.git${ZW}/config`, `.git${ZW}`, 'GIT~1/config', 'a/git~1/x', `${ANCHO}git/config`,
    `a/${BIDI}gpj.exe`, `a/b${ZW}c`, `a/${RELLENO}b`, `a/${BRAILLE}b`, `a/${CGJ}b`, 'a/\u0001b', 'a/\u007fb',
    'CON', 'con', 'a/NUL.txt', 'PRN', 'AUX.md', 'COM1', 'lpt9.log', 'a/CLOCK$',
    'a:b', 'c:/x', 'C:\\x', 'a:stream', '.git::$INDEX_ALLOCATION', 'a\\b', '..\\x', '/etc/passwd', 'a/../b', '../x', './x', 'a/./b', 'a//b', 'dir/', '', 'x.', 'a/x ', ' x', 'a/ x',
    'x'.repeat(256),
  ];
  const LEGITIMAS = ['src/a.js', 'docs/nota.md', 'README.md', 'a..b/leeme.md', 'src/ñandú.md', 'github/x.md', 'docs/gitlab-ci.md', 'CODEOWNERS.md', 'app/consola.js', 'src/connect.js', 'Jenkinsfile.md'];

  test('el módulo común rechaza cada variante y deja pasar lo legítimo', () => {
    for (const r of VETADAS) assert.notEqual(motivoRutaVetada(r), null, JSON.stringify(r));
    for (const r of LEGITIMAS) assert.equal(motivoRutaVetada(r), null, r);
  });

  test('los dos adaptadores usan el mismo módulo y rechazan cada variante sin red', async () => {
    const srcGh = readFileSync(join(RAIZ, 'core', 'integraciones', 'proveedores', 'github.js'), 'utf8');
    const srcGl = readFileSync(join(RAIZ, 'core', 'integraciones', 'proveedores', 'gitlab.js'), 'utf8');
    assert.match(srcGh, /from '\.\.\/rutas\.js'/);
    assert.match(srcGl, /from '\.\.\/rutas\.js'/);

    const { http, llamadas } = httpContador();
    const gh = crearProveedorGitHub({ token: TOKEN_GH, destinos: ['org/repo'], modo: 'proponer', auditoria: auditoriaDePrueba(), http });
    const gl = crearProveedorGitLab({ token: TOKEN_GL, destinos: ['g/p'], modo: 'proponer', auditoria: auditoriaDePrueba(), host: 'gitlab.com', http });
    for (const ruta of VETADAS) {
      const base = { base: 'main', rama: 'forge/x', archivos: [{ ruta, contenido: 'x' }], titulo: 'T', marcador: 'm' };
      const e1 = await fallo(gh.proponerCambio({ ...base, destino: 'org/repo' }));
      assert.equal(e1.codigo, 'ruta_archivo_no_valida', `GitHub ${JSON.stringify(ruta)}`);
      const e2 = await fallo(gl.proponerCambio({ ...base, destino: 'g/p' }));
      assert.equal(e2.codigo, 'ruta', `GitLab ${JSON.stringify(ruta)}`);
    }
    assert.equal(llamadas.length, 0, 'ninguna petición');
  });

  test('la lista no se puede reducir desde la configuración', () => {
    // No hay ninguna clave de configuración que toque rutas: cualquiera es «clave desconocida»
    for (const clave of ['github_rutas_permitidas', 'rutas_vetadas', 'gitlab_rutas_vetadas']) {
      assert.throws(() => interpretarIntegraciones(`integraciones:\n  github_modo: solo_lectura\n  ${clave}: .github\n`), ErrorConfigIntegraciones);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
describe('R4 y R5 modo obligatorio y auditoría que falla cerrada', () => {
  test('el modo es obligatorio en los tres adaptadores', () => {
    const { http } = httpContador();
    assert.throws(() => crearProveedorGitHub({ token: TOKEN_GH, destinos: ['o/r'], http }), TypeError);
    assert.throws(() => crearProveedorGitLab({ token: TOKEN_GL, destinos: ['g/p'], host: 'gitlab.com', http }), TypeError);
    assert.throws(() => crearProveedorJira({ sitio: 'a.atlassian.net', usuario: USUARIO, token: TOKEN_JI, destinos: ['ABC'], http, env: { FORGE_INTEGRACIONES_HOSTS: 'a.atlassian.net' } }), /modo/);
    for (const mal of ['todo', 'escribir', '', null, 5]) {
      assert.throws(() => crearProveedorGitHub({ token: TOKEN_GH, destinos: ['o/r'], modo: /** @type {any} */ (mal), http }), TypeError);
    }
  });

  test('cada operación exige su modo mínimo (GitHub, GitLab y Jira), sin red', async () => {
    const { http, llamadas } = httpContador();
    const env = { FORGE_INTEGRACIONES_HOSTS: 'gitlab.empresa.com,a.atlassian.net' };
    const mk = (modo) => ({
      gh: crearProveedorGitHub({ token: TOKEN_GH, destinos: ['o/r'], modo, auditoria: auditoriaDePrueba(), http }),
      gl: crearProveedorGitLab({ token: TOKEN_GL, destinos: ['g/p'], modo, auditoria: auditoriaDePrueba(), host: 'gitlab.empresa.com', env, http }),
      ji: crearProveedorJira({ sitio: 'a.atlassian.net', usuario: USUARIO, token: TOKEN_JI, destinos: ['ABC'], modo, auditoria: auditoriaDePrueba(), env, http }),
    });
    const prop = { base: 'main', rama: 'forge/x', archivos: [{ ruta: 'src/a.js', contenido: 'x' }], titulo: 'T', marcador: 'm' };

    const ap = mk('apagado');
    for (const [n, p, ref] of [['gh', ap.gh, 'o/r#1'], ['gl', ap.gl, 'g/p#1'], ['ji', ap.ji, 'ABC-1']]) {
      assert.equal((await fallo(p.leerElemento(ref))).codigo, n === 'gh' ? 'modo' : 'modo', `${n} leer apagado`);
    }
    const sl = mk('solo_lectura');
    for (const [n, p, ref] of [['gh', sl.gh, 'o/r#1'], ['gl', sl.gl, 'g/p#1'], ['ji', sl.ji, 'ABC-1']]) {
      assert.equal((await fallo(p.comentar(ref, 'hola', { marcador: 'm' }))).codigo, 'modo', `${n} comentar en solo_lectura`);
    }
    assert.equal((await fallo(sl.gh.proponerCambio({ ...prop, destino: 'o/r' }))).codigo, 'modo');
    assert.equal((await fallo(sl.gl.proponerCambio({ ...prop, destino: 'g/p' }))).codigo, 'modo');
    const co = mk('comentar');
    assert.equal((await fallo(co.gh.proponerCambio({ ...prop, destino: 'o/r' }))).codigo, 'modo');
    assert.equal((await fallo(co.gl.proponerCambio({ ...prop, destino: 'g/p' }))).codigo, 'modo');
    assert.equal(llamadas.length, 0, 'ninguna petición');
  });

  test('sin auditoría, escribir falla cerrado y leer no escribe nada', async () => {
    const { http, llamadas } = httpContador();
    const env = { FORGE_INTEGRACIONES_HOSTS: 'gitlab.empresa.com,a.atlassian.net' };
    const gh = crearProveedorGitHub({ token: TOKEN_GH, destinos: ['o/r'], modo: 'proponer', http });
    const gl = crearProveedorGitLab({ token: TOKEN_GL, destinos: ['g/p'], modo: 'proponer', host: 'gitlab.empresa.com', env, http });
    const ji = crearProveedorJira({ sitio: 'a.atlassian.net', usuario: USUARIO, token: TOKEN_JI, destinos: ['ABC'], modo: 'proponer', env, http });
    for (const [p, ref] of /** @type {const} */ ([[gh, 'o/r#1'], [gl, 'g/p#1'], [ji, 'ABC-1']])) {
      assert.equal((await fallo(p.comentar(ref, 'hola', { marcador: 'm' }))).codigo, 'auditoria_obligatoria');
    }
    const prop = { base: 'main', rama: 'forge/x', archivos: [{ ruta: 'src/a.js', contenido: 'x' }], titulo: 'T', marcador: 'm' };
    assert.equal((await fallo(gh.proponerCambio({ ...prop, destino: 'o/r' }))).codigo, 'auditoria_obligatoria');
    assert.equal((await fallo(gl.proponerCambio({ ...prop, destino: 'g/p' }))).codigo, 'auditoria_obligatoria');
    assert.equal(llamadas.length, 0, 'ninguna petición de escritura (ni de lectura previa)');
  });

  test('con el archivo de apagado puesto y un adaptador creado sin auditoría, comentar ya no llega al POST', async () => {
    const srv = await crearServidorGitHub({ token: TOKEN_GH, repos: { 'org/repo': { incidencias: { 1: { title: 't' } } } } });
    limpieza.push(() => srv.cerrar());
    const cwd = proyecto();
    apagar(cwd);
    const p = crearProveedorGitHub({ token: TOKEN_GH, destinos: ['org/repo'], modo: 'comentar', [BASE_LOCAL]: srv.baseUrl });
    const e = await fallo(p.comentar('org/repo#1', 'hola', { marcador: 'm1' }));
    assert.equal(e.codigo, 'auditoria_obligatoria');
    assert.equal(srv.peticiones.length, 0);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
describe('R6 tope por sesión atómico entre procesos', () => {
  test('la sesión por defecto es por día, no por proceso', () => {
    const a = new AuditoriaIntegraciones({ cwd: proyecto(), env: {} });
    assert.match(a.sesion, /^dia-\d{4}-\d{2}-\d{2}$/);
  });

  test('8 procesos hijos a la vez, tope 3: se ejecutan exactamente 3', async () => {
    const cwd = proyecto();
    const salida = mkdtempSync(join(tmpdir(), 'forge-rev1-sal-'));
    const guion = join(salida, 'hijo.mjs');
    const url = pathToFileURL(join(RAIZ, 'core', 'integraciones', 'auditoria.js')).href;
    writeFileSync(guion, `
      import { writeFileSync } from 'node:fs';
      import { join } from 'node:path';
      const { AuditoriaIntegraciones } = await import(${JSON.stringify(url)});
      const [cwd, salida, id, arranque] = process.argv.slice(2);
      const a = new AuditoriaIntegraciones({ cwd, tope: 3, sesion: 'carrera', env: {} });
      while (Date.now() < Number(arranque)) { /* barrera por reloj */ }
      for (let i = 0; i < 3; i++) {
        try {
          await a.ejecutar({ proveedor: 'github', operacion: 'comentar', destino: 'o/r', accion: async () => { writeFileSync(join(salida, 'ok-' + id + '-' + i), '1'); } });
        } catch { /* tope */ }
      }
    `);
    const arranque = String(Date.now() + 2500);
    const hijos = Array.from({ length: 8 }, (_, i) => new Promise((res, rej) => {
      const h = spawn(process.execPath, [guion, cwd, salida, String(i), arranque], { stdio: 'ignore' });
      h.on('exit', (code) => (code === 0 ? res(undefined) : rej(new Error(`hijo ${i} salió con ${code}`))));
      h.on('error', rej);
    }));
    await Promise.all(hijos);
    const ejecutadas = readdirSync(salida).filter((f) => f.startsWith('ok-'));
    assert.equal(ejecutadas.length, 3, `se ejecutaron ${ejecutadas.length}`);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
describe('R7 el marcador suplantable', () => {
  test('GitHub: un comentario ajeno con el marcador no suprime la publicación ni se devuelve como propio', async () => {
    const srv = await crearServidorGitHub({
      token: TOKEN_GH,
      repos: { 'org/repo': { incidencias: { 1: { title: 't' } }, comentarios: { 1: [{ body: 'x\n\n<!-- forge:tarea-123 -->', user: { login: 'atacante' } }] } } },
    });
    limpieza.push(() => srv.cerrar());
    const p = crearProveedorGitHub({ token: TOKEN_GH, destinos: ['org/repo'], modo: 'comentar', auditoria: auditoriaDePrueba(), [BASE_LOCAL]: srv.baseUrl });
    const r = await p.comentar('org/repo#1', 'resultado', { marcador: 'tarea-123' });
    assert.equal(r.existente, false);
    assert.notEqual(r.id, String(srv.repo('org/repo').comentarios.get(1)[0].id));
    const posts = srv.escrituras();
    assert.equal(posts.length, 1);
    assert.ok(posts[0].cuerpo.body.includes(`<!-- forge:${derivarMarcador('tarea-123')} -->`));
    // La segunda vez, el comentario propio (marcador derivado) sí vale: no se duplica
    const r2 = await p.comentar('org/repo#1', 'resultado', { marcador: 'tarea-123' });
    assert.equal(r2.existente, true);
    assert.equal(r2.id, r.id);
    assert.equal(srv.escrituras().length, 1);
  });

  test('GitHub: sin poder comprobar la cuenta, publica de todos modos y no da por válido el de otro autor', async () => {
    const srv = await crearServidorGitHub({
      token: TOKEN_GH, usuario: null,
      repos: { 'org/repo': { incidencias: { 1: { title: 't' } }, comentarios: { 1: [{ body: 'y\n\n<!-- forge:t1 -->', user: { login: 'forge-bot' } }] } } },
    });
    limpieza.push(() => srv.cerrar());
    const p = crearProveedorGitHub({ token: TOKEN_GH, destinos: ['org/repo'], modo: 'comentar', auditoria: auditoriaDePrueba(), [BASE_LOCAL]: srv.baseUrl });
    const r = await p.comentar('org/repo#1', 'texto', { marcador: 't1' });
    assert.equal(r.existente, false);
    assert.equal(srv.escrituras().length, 1);
  });

  test('GitHub: el texto saliente no puede traer un marcador propio', async () => {
    const { http, llamadas } = httpContador();
    const p = crearProveedorGitHub({ token: TOKEN_GH, destinos: ['o/r'], modo: 'comentar', auditoria: auditoriaDePrueba(), http });
    const e = await fallo(p.comentar('o/r#1', 'hola <!-- forge:otra-tarea -->', { marcador: 'm' }));
    assert.equal(e.codigo, 'texto_no_valido');
    assert.equal(llamadas.length, 0);
  });

  test('GitLab: una nota ajena (también citada) con el marcador no suprime la publicación', async () => {
    const srv = await crearServidorGitLab({
      token: TOKEN_GL,
      proyectos: { 'empresa/web': { incidencias: { 1: { title: 't', description: null, notas: [{ id: 5, body: '> cita <!-- forge:tarea-123 -->', author: { username: 'atacante' } }] } } } },
    });
    limpieza.push(() => srv.cerrar());
    const p = crearProveedorGitLab({ token: TOKEN_GL, destinos: ['empresa/web'], modo: 'comentar', auditoria: auditoriaDePrueba(), host: 'gitlab.com', [BASE_LOCAL]: srv.baseUrl, _esperar: async () => {} });
    const r = await p.comentar('empresa/web#1', 'resultado', { marcador: 'tarea-123' });
    assert.equal(r.yaExistia, false);
    assert.notEqual(r.id, '5');
    assert.equal(srv.escrituras().length, 1);
    const r2 = await p.comentar('empresa/web#1', 'resultado', { marcador: 'tarea-123' });
    assert.equal(r2.yaExistia, true);
    assert.equal(r2.id, r.id);
    assert.equal(srv.escrituras().length, 1);
  });

  test('Jira: un comentario ajeno con FORGE-ID no suprime la publicación; el texto no puede traer FORGE-ID', async () => {
    const srv = await crearServidorJiraFalso({
      usuario: USUARIO, token: TOKEN_JI,
      tickets: { 'ABC-1': { summary: 's', description: null, comments: [{ id: '900', autor: 'Atacante', cuenta: 'cuenta-atacante', body: adfParrafo('FORGE-ID: tarea-123') }] } },
    });
    limpieza.push(() => srv.cerrar());
    const mk = () => crearProveedorJira({ modo: 'comentar', auditoria: auditoriaDePrueba(), sitio: 'ejemplo.atlassian.net', usuario: USUARIO, token: TOKEN_JI, destinos: ['ABC'], [BASE_LOCAL]: srv.baseUrl, http: sinEspera });
    const p = mk();
    const r = await p.comentar('ABC-1', 'resultado', { marcador: 'tarea-123' });
    assert.equal(r.yaExistia, false);
    assert.notEqual(r.id, '900');
    assert.equal(srv.peticiones.filter((x) => x.metodo === 'POST').length, 1);
    const r2 = await p.comentar('ABC-1', 'resultado', { marcador: 'tarea-123' });
    assert.equal(r2.yaExistia, true);
    assert.equal(r2.id, r.id);
    const e = await fallo(p.comentar('ABC-1', 'hola\nFORGE-ID: otra-tarea', { marcador: 'm2' }));
    assert.equal(e.codigo, 'texto_no_valido');
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
describe('R9 apagar detiene proponerCambio entre peticiones', () => {
  test('GitHub: el interruptor se mira antes de CADA petición de escritura', async () => {
    const srv = await crearServidorGitHub({ token: TOKEN_GH, repos: { 'org/repo': { ramas: { main: 'a'.repeat(40) }, incidencias: {} } } });
    limpieza.push(() => srv.cerrar());
    const cwd = proyecto();
    const auditoria = new AuditoriaIntegraciones({ cwd, tope: 50, sesion: 'r9', env: {} });
    let n = 0;
    const http = (/** @type {any} */ o) => { n++; if (n === 2) apagar(cwd); return pedir(o); };
    const p = crearProveedorGitHub({ token: TOKEN_GH, destinos: ['org/repo'], modo: 'proponer', auditoria, http, [BASE_LOCAL]: srv.baseUrl });
    const e = await fallo(p.proponerCambio({
      destino: 'org/repo', base: 'main', rama: 'forge/r9', titulo: 'T', marcador: 'm9', archivos: [{ ruta: 'src/a.js', contenido: 'x' }],
    }));
    assert.ok(e instanceof ErrorIntegracionesApagadas, String(e?.message));
    assert.equal(srv.escrituras().length, 0, 'no se creó ni un blob, ni la rama, ni la solicitud');
    assert.equal(srv.repo('org/repo').solicitudes.length, 0);
  });

  test('GitLab: lo mismo antes de crear la rama', async () => {
    const srv = await crearServidorGitLab({ token: TOKEN_GL, proyectos: { 'empresa/web': { ramas: ['main'] } } });
    limpieza.push(() => srv.cerrar());
    const cwd = proyecto();
    const auditoria = new AuditoriaIntegraciones({ cwd, tope: 50, sesion: 'r9', env: {} });
    let n = 0;
    const http = (/** @type {any} */ o) => { n++; if (n === 3) apagar(cwd); return pedir(o); };
    const p = crearProveedorGitLab({ token: TOKEN_GL, destinos: ['empresa/web'], modo: 'proponer', auditoria, host: 'gitlab.com', http, [BASE_LOCAL]: srv.baseUrl });
    const e = await fallo(p.proponerCambio({
      destino: 'empresa/web', base: 'main', rama: 'forge/r9', titulo: 'T', marcador: 'm9', archivos: [{ ruta: 'src/a.js', contenido: 'x' }],
    }));
    assert.ok(e instanceof ErrorIntegracionesApagadas, String(e?.message));
    assert.equal(srv.escrituras().length, 0);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
describe('R10 FORGE_INTEGRACIONES falla cerrado', () => {
  test('solo «normal» (o sin definir) deja pasar; cualquier otro valor apaga y avisa', async () => {
    const cwd = proyecto();
    for (const v of [undefined, '', '  ', 'normal', 'NORMAL']) {
      assert.equal(estadoInterruptor(cwd, { FORGE_INTEGRACIONES: v }).apagado, false, String(v));
    }
    for (const v of ['apagado', 'APAGADO', 'off', '0', '1', 'true', 'apagada', 'desactivado', 'encendido', 'si']) {
      const s = estadoInterruptor(cwd, { FORGE_INTEGRACIONES: v });
      assert.equal(s.apagado, true, v);
      assert.equal(s.origen, 'variable');
      if (v.toLowerCase() !== 'apagado') {
        assert.equal(s.valorNoReconocido, true);
        assert.match(String(s.aviso), /no se reconoce/);
      }
    }
    const a = new AuditoriaIntegraciones({ cwd, env: { FORGE_INTEGRACIONES: 'off' } });
    let ejecutada = false;
    const e = await fallo(a.ejecutar({ proveedor: 'github', operacion: 'comentar', destino: 'o/r', accion: async () => { ejecutada = true; } }));
    assert.ok(e instanceof ErrorIntegracionesApagadas);
    assert.match(e.message, /no se reconoce/);
    assert.equal(ejecutada, false);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
describe('R11 una escritura no se reintenta tras un 503', () => {
  /** @param {number} estado */
  async function servidor503() {
    let peticiones = 0;
    const s = createServer((req, res) => {
      peticiones++;
      req.resume();
      res.writeHead(503, { 'retry-after': '0', 'content-type': 'text/plain' });
      res.end('no');
    });
    await new Promise((r) => s.listen(0, '127.0.0.1', () => r(undefined)));
    limpieza.push(() => new Promise((r) => { s.closeAllConnections(); s.close(() => r(undefined)); }));
    const puerto = /** @type {any} */ (s.address()).port;
    return { host: `127.0.0.1:${puerto}`, contar: () => peticiones };
  }

  test('POST: una sola petición; GET: se reintenta; POST idempotente declarado: se reintenta', async () => {
    const s = await servidor503();
    const base = { host: s.host, ruta: '/x', permitidos: [s.host], _permitirLocal: true, _esperar: async () => {} };
    const p = await pedir({ ...base, metodo: 'POST', cuerpo: { a: 1 } });
    assert.equal(p.estado, 503);
    assert.equal(s.contar(), 1);
    const g = await pedir({ ...base, metodo: 'GET' });
    assert.equal(g.estado, 503);
    assert.equal(s.contar(), 1 + 3);
    const i = await pedir({ ...base, metodo: 'POST', cuerpo: { a: 1 }, idempotente: true });
    assert.equal(i.estado, 503);
    assert.equal(s.contar(), 1 + 3 + 3);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
describe('R12 baseUrl local solo con el interruptor interno', () => {
  test('la opción pública baseUrl ya no existe, en ningún adaptador', () => {
    const { http } = httpContador();
    const env = { FORGE_INTEGRACIONES_HOSTS: 'a.atlassian.net' };
    for (const baseUrl of ['http://127.0.0.1:9', 'http://localhost:9', 'https://api.github.com']) {
      assert.throws(() => crearProveedorGitHub({ token: TOKEN_GH, destinos: ['o/r'], modo: 'comentar', http, ...{ baseUrl } }), TypeError);
      assert.throws(() => crearProveedorGitLab({ token: TOKEN_GL, destinos: ['g/p'], modo: 'comentar', host: 'gitlab.com', http, ...{ baseUrl } }), TypeError);
      assert.throws(() => crearProveedorJira({ sitio: 'a.atlassian.net', usuario: USUARIO, token: TOKEN_JI, destinos: ['ABC'], modo: 'comentar', http, env, ...{ baseUrl } }), /baseUrl/);
    }
  });

  test('el interruptor interno solo admite 127.0.0.1 o localhost por http, sin credenciales ni ruta', () => {
    const { http } = httpContador();
    for (const mala of ['https://127.0.0.1:9', 'http://evil.example', 'http://127.0.0.1:9/x', 'http://u:p@127.0.0.1:9', 'basura']) {
      assert.throws(() => crearProveedorGitHub({ token: TOKEN_GH, destinos: ['o/r'], modo: 'comentar', http, [BASE_LOCAL]: mala }), TypeError, mala);
    }
    assert.doesNotThrow(() => crearProveedorGitHub({ token: TOKEN_GH, destinos: ['o/r'], modo: 'comentar', http, [BASE_LOCAL]: 'http://127.0.0.1:9' }));
  });

  test('ni la CLI ni la configuración tienen forma de pasar una base local', () => {
    const cli = readFileSync(join(RAIZ, 'cli', 'integraciones.js'), 'utf8');
    assert.ok(!/pruebas-internas|BASE_LOCAL|baseUrl/.test(cli));
    assert.throws(() => interpretarIntegraciones('integraciones:\n  github_modo: solo_lectura\n  github_base_url: http://127.0.0.1:1\n'), ErrorConfigIntegraciones);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
describe('R13 y R14 invisibles de relleno y títulos', () => {
  test('redactar une el token también con U+3164, U+2800 y U+034F, y otros rellenos', () => {
    const token = 'ghp_' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8';
    for (const relleno of [RELLENO, BRAILLE, CGJ, ZW, c(0x115f), c(0xffa0), c(0x180e), c(0x061c), c(0x200f)]) {
      const partido = token.slice(0, 10) + relleno + token.slice(10);
      for (const f of [redactar, redactarFormatos]) {
        const r = f(`valor ${partido} fin`);
        assert.ok(r.includes('[REDACTADO]'), `${f.name} con U+${relleno.charCodeAt(0).toString(16)}`);
        assert.ok(!r.includes('A1b2C3d4'), 'el token no sale');
      }
      const d = comoDato({ cuerpo: `valor ${partido} fin`, comentarios: [`otro ${partido}`], titulo: partido });
      assert.ok(!d.includes('A1b2C3d4E5'), `comoDato con U+${relleno.charCodeAt(0).toString(16)}`);
    }
    // Una marca combinante entre caracteres del token (la revisión usó U+0301)
    const conMarca = token.slice(0, 12) + COMBINANTE + token.slice(12);
    assert.ok(!comoDato({ cuerpo: conMarca }).includes('A1b2C3d4E5'));
    // Y el texto normal con acentos no cambia
    assert.match(redactar('canción y árbol'), /canción y árbol/);
  });

  test('confianza quita los rellenos de un texto de un tercero', () => {
    const d = comoDato({ cuerpo: `a${RELLENO}b${BRAILLE}c${CGJ}d` });
    assert.match(d, /abcd/);
  });

  test('el título con bidi o ancho cero se rechaza antes de la red (GitHub y GitLab)', async () => {
    const { http, llamadas } = httpContador();
    const gh = crearProveedorGitHub({ token: TOKEN_GH, destinos: ['o/r'], modo: 'proponer', auditoria: auditoriaDePrueba(), http });
    const gl = crearProveedorGitLab({ token: TOKEN_GL, destinos: ['g/p'], modo: 'proponer', auditoria: auditoriaDePrueba(), host: 'gitlab.com', http });
    for (const titulo of [`x${BIDI}`, `x${ZW}y`, `x${RELLENO}`, `x${c(0x2066)}y`, 'a\nb']) {
      const base = { base: 'main', rama: 'forge/x', archivos: [{ ruta: 'src/a.js', contenido: 'x' }], titulo, marcador: 'm' };
      assert.equal((await fallo(gh.proponerCambio({ ...base, destino: 'o/r' }))).codigo, 'titulo_no_valido');
      assert.equal((await fallo(gl.proponerCambio({ ...base, destino: 'g/p' }))).codigo, 'titulo');
    }
    assert.equal(llamadas.length, 0);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
describe('R15 la ruta no se normaliza a otra', () => {
  test('%2e, %5c, «//», «.» y «..» se rechazan; %2F de GitLab sigue valiendo', async () => {
    let ultima = '';
    const s = createServer((req, res) => { ultima = req.url ?? ''; req.resume(); res.writeHead(200, { 'content-type': 'application/json' }); res.end('{}'); });
    await new Promise((r) => s.listen(0, '127.0.0.1', () => r(undefined)));
    limpieza.push(() => new Promise((r) => { s.closeAllConnections(); s.close(() => r(undefined)); }));
    const host = `127.0.0.1:${/** @type {any} */ (s.address()).port}`;
    for (const ruta of ['/a/%2e%2e/%2e%2e/echo', '/a/%2E%2E/x', '//evil/x', '/a//b', '/a/../b', '/a/./b', '/a%5cb', '/a/%2e/b']) {
      const e = await fallo(pedir({ host, ruta, permitidos: [host], _permitirLocal: true }));
      assert.ok(e instanceof ErrorHttpIntegracion && e.codigo === 'ruta', ruta);
    }
    const ok = await pedir({ host, ruta: '/api/v4/projects/grupo%2Fproyecto/issues/1?per_page=100', permitidos: [host], _permitirLocal: true });
    assert.equal(ok.estado, 200);
    assert.equal(ultima, '/api/v4/projects/grupo%2Fproyecto/issues/1?per_page=100');
  });
});
