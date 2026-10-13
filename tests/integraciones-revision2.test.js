// @ts-check
/**
 * Revisión independiente 2 (seguridad de la publicación con aprobación y del CLI): una prueba por
 * hallazgo H1 a H12 y el punto pendiente de `forge doctor` (`revision-independiente-2.md`).
 *
 * Causa raíz de H1, H2, H3, H8 y H9: la cola, el alcance, la sesión y el modo/los destinos estaban en el
 * árbol del proyecto, que controla quien escribió el repositorio. Aquí cada prueba reproduce lo que la
 * revisión hizo y comprueba que ya no ocurre. Todo es local: servidor falso de GitHub en 127.0.0.1,
 * ninguna llamada de red real, ningún token real (centinelas). El estado del usuario va a un directorio
 * temporal propio de cada prueba (FORGE_HOME). Esta prueba NO fija FORGE_INTEGRACIONES_ESCRITURA en el
 * proceso: cada entorno lo declara (o no) explícitamente.
 */

import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ejecutarIntegraciones, idDeEntrada, lineasEstado, paraTerminal } from '../cli/integraciones.js';
import { integracionesActivas } from '../cli/integraciones-activas.js';
import {
  escribirAlcance, huellaDePublicacion, leerAlcance, leerPendiente, listarNoAutenticados, listarPendientes,
} from '../core/integraciones/aprobacion.js';
import { AuditoriaIntegraciones, ErrorTopeIntegraciones } from '../core/integraciones/auditoria.js';
import { aplicarPoliticaDelUsuario, interpretarIntegraciones, leerConfigIntegraciones } from '../core/integraciones/config.js';
import { diagnosticarIntegraciones } from '../core/integraciones/doctor.js';
import { claveLocal, directorioDeEstado, firmar, raizDeEstado } from '../core/integraciones/estado-usuario.js';
import { archivoPublicable, motivoDeExclusion, neutralizar, prepararPublicacion } from '../core/integraciones/publicacion.js';
import { BASE_LOCAL } from '../core/integraciones/pruebas-internas.js';
import { clasificarManifiesto } from '../core/integraciones/rutas.js';
import { crearProveedorGitHub } from '../core/integraciones/proveedores/github.js';
import { crearServidorGitHub } from './fixtures/integraciones/servidores/github.mjs';
import { proyectoConTarea, sha256 } from './fixtures/integraciones/estado-ciclo.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const HIJO_APROBAR = join(AQUI, 'fixtures', 'integraciones', 'aprobar-hijo.mjs');
const TOKEN = 'github_pat_' + 'REVISION2a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8';
const YAML = 'integraciones:\n  github_modo: proponer\n  github_token_env: FORGE_GITHUB_TOKEN\n  github_destinos: org/repo\n';
const c = (/** @type {number} */ n) => String.fromCharCode(n);
const ESC = c(0x1b);
const BEL = c(0x07);

const cierres = /** @type {Array<() => Promise<void>>} */ ([]);
after(async () => { for (const f of cierres) await f(); });

/**
 * Un proyecto con una tarea terminada, un servidor de GitHub falso y un entorno de usuario aislado.
 * @param {{ yaml?: string, archivos?: Record<string, string>, escritura?: string|null, destinos?: string, fallos?: any[] }} [o]
 */
async function montar(o = {}) {
  const p = proyectoConTarea(o.archivos ? { archivos: o.archivos } : {});
  writeFileSync(join(p.cwd, '.sdd', 'sdd.config.yaml'), o.yaml ?? YAML);
  const gh = await crearServidorGitHub({
    token: TOKEN, fallos: o.fallos ?? [],
    repos: { 'org/repo': { ramas: { main: 'a'.repeat(40) }, incidencias: { 7: { title: 'Fallo', body: 'Cuerpo', user: { login: 'ana' } } } } },
  });
  cierres.push(() => gh.cerrar());
  /** @type {Record<string, string>} */
  const env = { FORGE_HOME: mkdtempSync(join(tmpdir(), 'forge-rev2-home-')), FORGE_GITHUB_TOKEN: TOKEN };
  if (o.escritura !== null) env.FORGE_INTEGRACIONES_ESCRITURA = o.escritura ?? 'github';
  if (o.destinos !== undefined) env.FORGE_INTEGRACIONES_DESTINOS = o.destinos;
  const fabrica = (/** @type {any} */ cfg, /** @type {any} */ { token, auditoria }) => crearProveedorGitHub({ token, destinos: cfg.destinos, modo: cfg.modo, auditoria, [BASE_LOCAL]: gh.baseUrl });
  /** @type {string[]} */ const sal = [];
  /** @type {string[]} */ const er = [];
  const cli = async (/** @type {string[]} */ ...args) => {
    sal.length = 0; er.length = 0;
    const codigo = await ejecutarIntegraciones([...args, '--cwd', p.cwd], { env, fabrica, salida: (l) => sal.push(l), error: (l) => er.push(l) });
    return { codigo, salida: sal.join('\n'), error: er.join('\n'), todo: `${sal.join('\n')}\n${er.join('\n')}` };
  };
  /** Prepara el pendiente real con `publicar` y devuelve su id. @param {string[]} [extra] */
  const publicar = async (extra = []) => {
    const r = await cli('publicar', p.taskId, '--proveedor', 'github', '--referencia', 'org/repo#7', ...extra);
    assert.equal(r.codigo, 0, r.todo);
    const id = /github-[0-9a-f]{12}/.exec(r.salida)?.[0] ?? '';
    assert.ok(id, r.salida);
    return id;
  };
  const dirEstado = () => directorioDeEstado(p.cwd, env);
  /**
   * Deja en la cola del usuario un pendiente FIRMADO con la clave local (lo que haría FORGE, o lo que
   * un atacante con la clave haría: no es el caso de la amenaza, sirve para probar las comprobaciones).
   * @param {Record<string, any>} x
   */
  const sellar = (x) => {
    const o2 = { estado: 'pendiente', creado: '2026-10-13T00:00:00.000Z', ...x };
    if (o2.huella === undefined) o2.huella = huellaDePublicacion(o2);
    mkdirSync(join(dirEstado(), 'pendientes'), { recursive: true });
    writeFileSync(join(dirEstado(), 'pendientes', `${o2.id}.json`), JSON.stringify({ ...o2, hmac: firmar(claveLocal(dirEstado()), o2) }));
    return o2;
  };
  return { ...p, gh, env, cli, publicar, dirEstado, sellar, fabrica };
}

const COMENTARIO = (/** @type {string} */ texto) => ({
  id: 'github-aaaaaaaaaaaa', proveedor: 'github', operacion: 'comentar', destino: 'org/repo', referencia: 'org/repo#7',
  contenido: { tipo: 'comentario', marcador: 'tarea-X-1', texto },
});

// ════════════════════════════════════════════════════════════════════════════════════════════
describe('H1 la cola no se puede fabricar desde el repositorio', () => {
  test('el pendiente fabricado en el árbol del proyecto (con su huella calculada) no se aprueba ni publica', async () => {
    const m = await montar();
    const p = COMENTARIO('@victima ' + '\n/close\n/assign @atacante\nFixes org/otro#9\n![x](https://evil.example/p.png)');
    const huella = huellaDePublicacion(p);
    const dir = join(m.cwd, '.sdd', 'integraciones', 'pendientes');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${p.id}.json`), JSON.stringify({ ...p, estado: 'pendiente', creado: '2026-10-13T00:00:00.000Z', huella, huellaContenido: huella }));
    // sin --huella, con --huella, con el prefijo: ninguna publica
    for (const extra of [[], ['--huella', huella], ['--huella', huella.slice(0, 12)]]) {
      const r = await m.cli('aprobar', p.id, ...extra);
      assert.equal(r.codigo, 1, r.todo);
      assert.match(r.error, /no autoriza nada|no está autenticado/);
    }
    assert.equal(m.gh.peticiones.length, 0, 'el servidor no recibió nada');
    const lista = await m.cli('pendientes');
    assert.match(lista.salida, /no autenticado/);
    assert.match(lista.salida, /forge integraciones publicar/);
    assert.deepEqual(listarNoAutenticados(m.cwd, m.env), [{ id: p.id, origen: 'arbol' }]);
    assert.deepEqual(listarPendientes(m.cwd, m.env), []);
  });

  test('un archivo en la cola del usuario sin la clave (HMAC inventado, o ninguno) tampoco se aprueba', async () => {
    const m = await montar();
    const p = { ...COMENTARIO('texto del atacante'), estado: 'pendiente', creado: '2026-10-13T00:00:00.000Z' };
    const huella = huellaDePublicacion(p);
    mkdirSync(join(m.dirEstado(), 'pendientes'), { recursive: true });
    for (const hmac of [undefined, 'f'.repeat(64), '0'.repeat(64), 'no-es-hex']) {
      writeFileSync(join(m.dirEstado(), 'pendientes', `${p.id}.json`), JSON.stringify({ ...p, huella, ...(hmac ? { hmac } : {}) }));
      const r = await m.cli('aprobar', p.id, '--huella', huella);
      assert.equal(r.codigo, 1, r.todo);
      assert.match(r.error, /no está autenticado/);
    }
    assert.equal(m.gh.peticiones.length, 0);
  });

  test('la clave local vive en el directorio del usuario, 32 bytes, y nunca en el árbol del proyecto', async () => {
    const m = await montar();
    await m.publicar();
    const clave = readFileSync(join(m.dirEstado(), 'clave'), 'utf8').trim();
    assert.match(clave, /^[0-9a-f]{64}$/);
    assert.ok(m.dirEstado().startsWith(raizDeEstado(m.env)));
    assert.ok(!m.dirEstado().startsWith(m.cwd), 'el estado no está dentro del proyecto');
    const walk = (/** @type {string} */ d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
    for (const f of walk(join(m.cwd, '.sdd'))) assert.ok(!readFileSync(f, 'latin1').includes(clave), `la clave está en ${f}`);
  });

  test('un archivo fabricado «ya publicado» no silencia una publicación real con el mismo identificador', async () => {
    const m = await montar();
    const real = await m.publicar();
    // el atacante deja en el árbol un «publicado» con ese id
    const dir = join(m.cwd, '.sdd', 'integraciones', 'pendientes');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${real}.json`), JSON.stringify({ ...COMENTARIO('x'), id: real, estado: 'publicado', resultado: { id: '1', yaExistia: false } }));
    const v = await m.cli('vista', real);
    assert.equal(v.codigo, 0, v.todo);
    const h = /Huella:\s+([0-9a-f]{64})/.exec(v.salida)?.[1] ?? '';
    const r = await m.cli('aprobar', real, '--huella', h);
    assert.equal(r.codigo, 0, r.todo);
    assert.equal(m.gh.escrituras().length >= 1, true, 'la publicación real salió');
  });

  test('aprobar SIN --huella: imprime la vista previa y el comando completo, sale con 2 y no publica', async () => {
    const m = await montar();
    const id = await m.publicar();
    const r = await m.cli('aprobar', id);
    assert.equal(r.codigo, 2, r.todo);
    assert.match(r.salida, /texto exacto/);
    assert.match(r.salida, /FORGE · resultado de la tarea/);
    assert.match(r.salida, /org\/repo#7/);
    assert.match(r.salida, /Cuenta:\s+github, modo proponer/);
    const h = /Huella:\s+([0-9a-f]{64})/.exec(r.salida)?.[1] ?? '';
    assert.match(r.error, new RegExp(`forge integraciones aprobar ${id} --huella ${h}`));
    assert.equal(m.gh.peticiones.length, 0);
    // ... y con la huella COMPLETA o con un prefijo de 12 publica; uno más corto es un uso incorrecto
    const corto = await m.cli('aprobar', id, '--huella', h.slice(0, 11));
    assert.equal(corto.codigo, 2);
    assert.equal(m.gh.peticiones.length, 0);
    const ok = await m.cli('aprobar', id, '--huella', h.slice(0, 12));
    assert.equal(ok.codigo, 0, ok.todo);
    assert.match(ok.salida, /texto exacto/, 'también muestra lo que publica');
    assert.match(ok.salida, /Publicada/);
  });

  test('una propuesta muestra, al aprobar, cada archivo con su huella', async () => {
    const m = await montar({ archivos: { 'src/suma.js': 'export const suma = (a, b) => a + b;\n' } });
    const id = await m.publicar(['--tipo', 'propuesta']);
    const r = await m.cli('aprobar', id);
    assert.equal(r.codigo, 2);
    assert.match(r.salida, /src\/suma\.js\s+\d+ bytes\s+sha256 [0-9a-f]{64}/);
    assert.match(r.salida, /rama forge\//);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
describe('H2 aprobar aplica las mismas exclusiones y el mismo saneado que preparar', () => {
  const ARCHIVOS = ['package.json', '.npmrc', '.env', 'Makefile', '.vscode/tasks.json', 'scripts/postinstall.sh', 'setup.py', 'pyproject.toml', 'go.mod', 'Cargo.toml', 'docs/CODEOWNERS', '.husky/pre-commit', '.GitHub/workflows/x.yml'];

  test('un pendiente con firma válida que lleva manifiestos, configuración o CI no se publica', async () => {
    for (const ruta of ARCHIVOS) {
      const m = await montar();
      const contenido = 'x\n';
      const x = m.sellar({
        id: 'github-bbbbbbbbbbbb', proveedor: 'github', operacion: 'proponer_cambio', destino: 'org/repo', referencia: 'org/repo#7',
        contenido: { tipo: 'propuesta', marcador: 'tarea-y-1', rama: 'forge/tarea-y', base: 'main', titulo: 'FORGE: tarea y', descripcion: 'cambio', archivos: [{ ruta, contenido, sha256: sha256(contenido) }], excluidos: [] },
      });
      const r = await m.cli('aprobar', x.id, '--huella', x.huella);
      assert.equal(r.codigo, 1, `${ruta}: ${r.todo}`);
      assert.match(r.error, /no se puede publicar/, ruta);
      assert.equal(m.gh.peticiones.length, 0, `${ruta}: llegó algo a la plataforma`);
    }
  });

  test('el sha256 de cada archivo tiene que ser el de su contenido', async () => {
    const m = await montar();
    const x = m.sellar({
      id: 'github-cccccccccccc', proveedor: 'github', operacion: 'proponer_cambio', destino: 'org/repo', referencia: 'org/repo#7',
      contenido: { tipo: 'propuesta', marcador: 'tarea-y-2', rama: 'forge/tarea-y', base: 'main', titulo: 'FORGE: tarea y', descripcion: 'cambio', archivos: [{ ruta: 'src/a.js', contenido: 'export const a = 1;\n', sha256: 'x'.repeat(64) }], excluidos: [] },
    });
    const r = await m.cli('aprobar', x.id, '--huella', x.huella);
    assert.equal(r.codigo, 1);
    assert.match(r.error, /sha256_no_coincide/);
    assert.equal(m.gh.peticiones.length, 0);
  });

  test('un archivo con un secreto por formato, o un texto sin redactar, no se publica', async () => {
    const m = await montar();
    const secreto = 'const t = "ghp_' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8";\n';
    const base = { proveedor: 'github', operacion: 'proponer_cambio', destino: 'org/repo', referencia: 'org/repo#7' };
    const archivo = (/** @type {string} */ contenido) => ({ ruta: 'src/a.js', contenido, sha256: sha256(contenido) });
    const propuesta = (/** @type {any} */ extra) => ({ tipo: 'propuesta', marcador: 'tarea-y-3', rama: 'forge/tarea-y', base: 'main', titulo: 'FORGE: tarea y', descripcion: 'cambio', archivos: [archivo('export const a = 1;\n')], excluidos: [], ...extra });
    const casos = [
      { contenido: propuesta({ archivos: [archivo(secreto)] }), esperado: /secreto_en_contenido/ },
      { contenido: propuesta({ descripcion: 'clave: ghp_' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8' }), esperado: /forma de secreto/ },
      { contenido: propuesta({ titulo: 'FORGE ' + 'ghp_' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8' }), esperado: /forma de secreto/ },
      { contenido: propuesta({ descripcion: 'hola\n/close\n' }), esperado: /empieza por «\/»/ },
    ];
    let n = 0;
    for (const k of casos) {
      const x = m.sellar({ ...base, id: `github-dddddddddd${String(n++).padStart(2, '0')}`, contenido: k.contenido });
      const r = await m.cli('aprobar', x.id, '--huella', x.huella);
      assert.equal(r.codigo, 1, r.todo);
      assert.match(r.error, k.esperado);
    }
    assert.equal(m.gh.peticiones.length, 0);
  });

  test('la clasificación: manifiestos, configuración y scripts son «excluidos por defecto» al preparar', () => {
    const esperado = /** @type {Record<string, string>} */ ({
      'package.json': 'dependencias', 'sub/package.json': 'dependencias', 'setup.py': 'dependencias', 'pyproject.toml': 'dependencias', 'go.mod': 'dependencias',
      'Cargo.toml': 'dependencias', 'pom.xml': 'dependencias', 'Gemfile': 'dependencias',
      '.npmrc': 'ruta_vetada', '.env': 'ruta_vetada', '.env.local': 'ruta_vetada',
      'Makefile': 'configuracion', '.vscode/tasks.json': 'configuracion', 'scripts/postinstall.sh': 'configuracion', 'tools/build.py': 'configuracion',
      'install.ps1': 'configuracion', 'run.bat': 'configuracion', 'Dockerfile': 'configuracion', 'justfile': 'configuracion',
      '.github/workflows/x.yml': 'ci', 'Jenkinsfile': 'ci',
    });
    for (const [ruta, motivo] of Object.entries(esperado)) assert.equal(motivoDeExclusion(ruta), motivo, ruta);
    for (const ok of ['src/index.js', 'lib/a/b.ts', 'docs/guia.md', 'test/a.test.js']) assert.equal(motivoDeExclusion(ok), null, ok);
    assert.equal(clasificarManifiesto('scripts/x.js'), 'configuracion');
    // una sola función para preparar y para aprobar
    assert.deepEqual(archivoPublicable('src/a.js', 'x\n', sha256('x\n')), { publicable: true });
    assert.equal(/** @type {any} */ (archivoPublicable('package.json', 'x\n', sha256('x\n'))).motivo, 'dependencias');
    assert.equal(/** @type {any} */ (archivoPublicable('src/a.js', 'x\n', 'mal')).motivo, 'sha256_no_coincide');
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
describe('H3 la huella cubre proveedor, operación, destino, referencia y contenido', () => {
  test('cambiar el destino o la referencia cambia la huella; no se publica en otro sitio', async () => {
    const m = await montar({ yaml: `${YAML.replace('org/repo', 'org/repo, org/otro')}` });
    const id = await m.publicar();
    const original = leerPendiente(m.cwd, id, m.env);
    const h0 = original.huella;
    // 1) destino y referencia a otro repositorio (coherentes entre sí), huella vieja, FIRMA válida
    const otro = { ...original, destino: 'org/otro', referencia: 'org/otro#7' };
    assert.notEqual(huellaDePublicacion(otro), h0);
    const { hmac: _h, ...sinFirma } = /** @type {any} */ (otro);
    writeFileSync(join(m.dirEstado(), 'pendientes', `${id}.json`), JSON.stringify({ ...sinFirma, hmac: firmar(claveLocal(m.dirEstado()), sinFirma) }));
    const r = await m.cli('aprobar', id, '--huella', h0.slice(0, 12));
    assert.equal(r.codigo, 1, r.todo);
    assert.match(r.error, /cambió después de prepararlo|huella no coincide/);
    assert.equal(m.gh.peticiones.length, 0);
  });

  test('destino distinto de la referencia, y operación que no corresponde al tipo, son incoherentes', async () => {
    const m = await montar({ yaml: `${YAML.replace('org/repo', 'org/repo, org/otro')}` });
    const casos = [
      { destino: 'org/repo', referencia: 'org/otro#7' },
      { operacion: 'proponer_cambio' },                  // contenido.tipo sigue siendo «comentario»
      { proveedor: 'jira' },                             // la referencia no es de Jira
    ];
    let n = 0;
    for (const cambio of casos) {
      const x = m.sellar({ ...COMENTARIO('texto'), id: `github-eeeeeeeeee${String(n++).padStart(2, '0')}`, ...cambio });
      const r = await m.cli('aprobar', x.id, '--huella', x.huella);
      assert.equal(r.codigo, 1, JSON.stringify(cambio) + r.todo);
      assert.match(r.error, /no es coherente/, JSON.stringify(cambio));
    }
    assert.equal(m.gh.peticiones.length, 0);
  });

  test('la huella que muestra la vista es la de todo: cambia con cualquiera de los cinco campos', () => {
    const p = { ...COMENTARIO('t') };
    const h = huellaDePublicacion(p);
    for (const cambio of [{ proveedor: 'gitlab' }, { operacion: 'proponer_cambio' }, { destino: 'a/b' }, { referencia: 'org/repo#8' }, { contenido: { ...p.contenido, texto: 'u' } }]) {
      assert.notEqual(huellaDePublicacion({ ...p, ...cambio }), h, JSON.stringify(cambio));
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
describe('H4 dos aprobar simultáneos del mismo id publican una sola vez (candado en la cola del usuario)', () => {
  /** @param {any} m @param {string} id @param {string} huella */
  function lanzar(m, id, huella) {
    const arranque = String(Date.now() + 2500);
    const entorno = { ...process.env, ...m.env };
    delete entorno.NODE_TEST_CONTEXT;
    return Promise.all([0, 1].map(() => new Promise((ok, mal) => {
      const h = spawn(process.execPath, [HIJO_APROBAR, m.cwd, m.gh.baseUrl, id, arranque, '150', huella], { env: entorno, stdio: ['ignore', 'pipe', 'pipe'] });
      let out = ''; let er = '';
      h.stdout.on('data', (d) => { out += d; });
      h.stderr.on('data', (d) => { er += d; });
      h.on('error', mal);
      h.on('exit', (code) => { try { ok({ salida: JSON.parse(out.trim().split('\n').pop() ?? ''), code, er }); } catch (e) { mal(new Error(`hijo: ${out} ${er} ${e}`)); } });
    })));
  }

  test('dos procesos reales: como mucho una escritura efectiva (3 rondas)', async () => {
    for (let ronda = 0; ronda < 3; ronda++) {
      const m = await montar();
      const id = await m.publicar();
      const huella = leerPendiente(m.cwd, id, m.env).huella;
      const r = /** @type {any[]} */ (await lanzar(m, id, huella));
      const comentarios = (m.gh.repo('org/repo').comentarios.get(7) ?? []).length;
      assert.equal(comentarios, 1, `ronda ${ronda}: ${comentarios} comentarios`);
      assert.equal(r.filter((x) => x.salida.codigo === 0).length >= 1, true, JSON.stringify(r.map((x) => x.salida)));
      for (const x of r) if (x.salida.codigo !== 0) assert.match(x.salida.error, /Otro proceso está aprobando|ya está|publicad/i);
      assert.equal(leerPendiente(m.cwd, id, m.env).estado, 'publicado');
    }
  });

  test('el candado vive en el estado del usuario, no en el árbol, y no queda puesto', async () => {
    const m = await montar();
    const id = await m.publicar();
    const huella = leerPendiente(m.cwd, id, m.env).huella;
    assert.equal((await m.cli('aprobar', id, '--huella', huella)).codigo, 0);
    assert.equal(existsSync(join(m.dirEstado(), 'pendientes', `${id}.lock`)), false);
    assert.equal(existsSync(join(m.cwd, '.sdd', 'integraciones', 'pendientes')), false);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
describe('H5 el texto no confiable no activa nada en la plataforma', () => {
  const ACTIVO = /(?:\b(?:close[sd]?|fix(?:es|ed)?|resolve[sd]?)\b[:\s]+(?:#\d|[\w.-]+\/[\w.-]+#\d|https?:|GH-\d))|(?:^|[^\w])@[\w-]+|#\d+|^\s*\/[a-z]/im;
  const NOMBRES = ['docs/closes #12.md', 'fixes org/otro#9/x.md', 'src/@org/equipo/x.js', 'a/![img](x.png).md', 'src/Resolves #1.js', 'docs/fixed GH-77.md', 'x/~user/y.md', 'x/Closes $1.md'];

  test('nombres de archivo con closes/fixes/@/# no llegan activos a la descripción ni al comentario', () => {
    const archivos = Object.fromEntries(NOMBRES.map((n) => [n, 'x\n']));
    const p = proyectoConTarea({ archivos });
    for (const tipo of /** @type {const} */ (['propuesta', 'comentario'])) {
      const r = prepararPublicacion({ cwd: p.cwd, tareaId: p.taskId, proveedor: 'github', referencia: 'org/repo#7', tipo });
      const cuerpo = r.contenido.tipo === 'propuesta' ? `${r.contenido.descripcion}\n${r.contenido.titulo}` : r.contenido.texto;
      assert.doesNotMatch(cuerpo, ACTIVO, `${tipo}: ${cuerpo}`);
      assert.ok(cuerpo.includes('closes'), 'el nombre sigue legible');
    }
  });

  test('ninguna línea del cuerpo empieza por «/», y la plantilla no admite texto libre del modelo', () => {
    assert.equal(neutralizar('/close'), '∕close');
    assert.doesNotMatch(neutralizar('@org/equipo #12 closes https://x/issues/1'), /@|#|:\/\//);
    // El estado del ciclo (validado al cargarlo) no admite texto libre en estos campos; la plantilla es fija
    const p = proyectoConTarea({ archivos: { 'src/a.js': 'x\n' }, resultado: 'aceptada_por_humano' });
    const r = prepararPublicacion({ cwd: p.cwd, tareaId: p.taskId, proveedor: 'github', referencia: 'org/repo#7', tipo: 'comentario' });
    const texto = /** @type {any} */ (r.contenido).texto;
    for (const l of texto.split('\n')) assert.doesNotMatch(l, /^\s*\//, l);
    assert.doesNotMatch(texto, /@todos|\/close/);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
describe('H6 nada de lo que viene de archivos del proyecto escapa a la terminal', () => {
  const MALO = (/** @type {string} */ t) => /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/.test(t);

  test('paraTerminal retira ESC, BEL y controles, y conserva saltos de línea y tabuladores', () => {
    const t = paraTerminal(`a${ESC}]0;PWNED${BEL}${ESC}[2Jb\n\tc${c(0x9b)}31m${c(0x2028)}d`);
    assert.equal(MALO(t), false);
    assert.ok(t.includes('\n\t'));
    assert.equal(t.includes(c(0x2028)), false);
  });

  test('pendientes, vista, estado y forge status: ESC y BEL del texto, de la ruta y del marcador salen neutralizados', async () => {
    const m = await montar();
    const texto = `${ESC}]0;PWNED${BEL}${ESC}[2Jtests en verde`;
    const x = m.sellar({
      id: 'github-ffffffffffff', proveedor: 'github', operacion: 'proponer_cambio', destino: 'org/repo', referencia: 'org/repo#7',
      contenido: { tipo: 'propuesta', marcador: 'tarea-z-1', rama: 'forge/tarea-z', base: 'main', titulo: `FORGE ${ESC}[31mROJO`, descripcion: texto, archivos: [{ ruta: `src/${ESC}[2Ja.js`, contenido: `${ESC}[2J\n`, sha256: sha256(`${ESC}[2J\n`) }], excluidos: [{ ruta: `x${BEL}y`, motivo: 'ci' }] },
    });
    for (const args of [['pendientes'], ['vista', x.id], ['vista', x.id, '--archivos'], ['estado'], ['aprobar', x.id]]) {
      const r = await m.cli(...args);
      assert.equal(MALO(r.todo), false, `${args.join(' ')}: ${JSON.stringify(r.todo.slice(0, 200))}`);
    }
    assert.equal(MALO(lineasEstado(m.cwd, m.env).join('\n')), false);
  });

  test('un campo con forma inválida (fecha, código de error) hace corrupto el pendiente: no se usa', async () => {
    const m = await montar();
    for (const [n, cambio] of [['1', { creado: `${ESC}]0;x${BEL}` }], ['2', { error: { codigo: `${ESC}[31mROJO`, mensaje: 'm', ts: 't' } }]]) {
      const x = m.sellar({ ...COMENTARIO('t'), id: `github-1111111111${n}${n}`, ...cambio });
      const r = await m.cli('vista', x.id);
      assert.equal(r.codigo, 1);
      assert.match(r.error, /forma esperada/);
      assert.equal(MALO(r.todo), false);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
describe('H7 forge doctor/status ven la sección con BOM y con CRLF', () => {
  const TXT = 'integraciones:\n  github_modo: comentar\n  github_token_env: FORGE_GITHUB_TOKEN\n  github_destinos: org/repo\n';
  const codificaciones = /** @type {Record<string, Buffer>} */ ({
    'UTF-8 sin BOM': Buffer.from(TXT, 'utf8'),
    'UTF-8 con BOM': Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(TXT, 'utf8')]),
    'CRLF': Buffer.from(TXT.split('\n').join('\r\n'), 'utf8'),
    'UTF-8 con BOM y CRLF': Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(TXT.split('\n').join('\r\n'), 'utf8')]),
    'UTF-16 LE con BOM': Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(TXT, 'utf16le')]),
    'UTF-16 LE con BOM y CRLF': Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(TXT.split('\n').join('\r\n'), 'utf16le')]),
    'UTF-16 BE con BOM': (() => { const b = Buffer.from(TXT, 'utf16le'); b.swap16(); return Buffer.concat([Buffer.from([0xfe, 0xff]), b]); })(),
  });

  for (const [nombre, bytes] of Object.entries(codificaciones)) {
    test(`${nombre}: la puerta y el lector completo coinciden`, () => {
      const cwd = mkdtempSync(join(tmpdir(), 'forge-rev2-bom-'));
      mkdirSync(join(cwd, '.sdd'), { recursive: true });
      writeFileSync(join(cwd, '.sdd', 'sdd.config.yaml'), bytes);
      assert.equal(integracionesActivas(cwd), true, 'integracionesActivas');
      const cfg = leerConfigIntegraciones(cwd, { env: { FORGE_INTEGRACIONES_ESCRITURA: 'github' } });
      assert.equal(cfg.activa, true);
      assert.equal(cfg.proveedores.github.modo, 'comentar');
      assert.deepEqual(cfg.proveedores.github.destinos, ['org/repo']);
    });
  }

  test('con la sección apagada o ausente la puerta sigue cerrada (también con BOM)', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'forge-rev2-bom-'));
    mkdirSync(join(cwd, '.sdd'), { recursive: true });
    writeFileSync(join(cwd, '.sdd', 'sdd.config.yaml'), Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('integraciones:\r\n  github_modo: apagado\r\n', 'utf8')]));
    assert.equal(integracionesActivas(cwd), false);
    writeFileSync(join(cwd, '.sdd', 'sdd.config.yaml'), Buffer.from('motor:\r\n  modo: ciclo\r\n'));
    assert.equal(integracionesActivas(cwd), false);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
describe('H8 el repositorio no puede ampliar permisos: modo de escritura y destinos los pone el usuario', () => {
  test('sin FORGE_INTEGRACIONES_ESCRITURA el modo efectivo es solo_lectura aunque el proyecto pida proponer', async () => {
    const m = await montar({ escritura: null });
    const cfg = leerConfigIntegraciones(m.cwd, { env: m.env });
    assert.equal(cfg.proveedores.github.modo, 'solo_lectura');
    assert.equal(cfg.proveedores.github.modoDelProyecto, 'proponer');
    const r = await m.cli('publicar', m.taskId, '--proveedor', 'github', '--referencia', 'org/repo#7');
    assert.equal(r.codigo, 1);
    assert.match(r.error, /FORGE_INTEGRACIONES_ESCRITURA=github/);
    assert.match(r.error, /no puede conceder escritura/);
    assert.equal(listarPendientes(m.cwd, m.env).length, 0);
    assert.equal(m.gh.peticiones.length, 0);
    // leer (solo lectura) sigue funcionando
    const l = await m.cli('leer', 'github', 'org/repo#7');
    assert.equal(l.codigo, 0, l.todo);
  });

  test('forge doctor y forge integraciones estado lo dicen', async () => {
    const m = await montar({ escritura: null });
    const d = await diagnosticarIntegraciones({ cwd: m.cwd, env: m.env, crearProveedor: () => { throw new Error('no'); } });
    const t = d.lineas.map((l) => l.texto).join('\n');
    assert.match(t, /el proyecto pide el modo «proponer»/);
    assert.match(t, /EFECTIVO es «solo_lectura»/);
    assert.match(t, /FORGE_INTEGRACIONES_ESCRITURA/);
    const e = lineasEstado(m.cwd, m.env).join('\n');
    assert.match(e, /modo solo_lectura \(el proyecto pide proponer/);
  });

  test('comparación exacta de la lista: otro proveedor, otra capitalización o un prefijo no conceden nada', async () => {
    for (const valor of ['gitlab', 'jira', 'GitHub', 'GITHUB', 'git', 'githubx', 'github-', '']) {
      const cfg = aplicarPoliticaDelUsuario(interpretarIntegraciones(YAML), { FORGE_INTEGRACIONES_ESCRITURA: valor });
      assert.equal(cfg.proveedores.github.modo, 'solo_lectura', JSON.stringify(valor));
    }
    for (const valor of ['github', ' github ', 'gitlab,github', 'jira, github']) {
      const cfg = aplicarPoliticaDelUsuario(interpretarIntegraciones(YAML), { FORGE_INTEGRACIONES_ESCRITURA: valor });
      assert.equal(cfg.proveedores.github.modo, 'proponer', JSON.stringify(valor));
    }
  });

  test('un pendiente ya preparado no se aprueba si el usuario retira la escritura', async () => {
    const m = await montar();
    const id = await m.publicar();
    const huella = leerPendiente(m.cwd, id, m.env).huella;
    const sinEscritura = { ...m.env };
    delete sinEscritura.FORGE_INTEGRACIONES_ESCRITURA;
    /** @type {string[]} */ const er = [];
    const codigo = await ejecutarIntegraciones(['aprobar', id, '--huella', huella, '--cwd', m.cwd], { env: sinEscritura, fabrica: m.fabrica, salida: () => {}, error: (l) => er.push(l) });
    assert.equal(codigo, 1);
    assert.match(er.join('\n'), /modo efectivo es «solo_lectura»/);
    assert.equal(m.gh.peticiones.length, 0);
  });

  test('FORGE_INTEGRACIONES_DESTINOS: un destino fuera de la lista del usuario se rechaza aunque el proyecto lo liste', async () => {
    const m = await montar({ destinos: 'org/otro' });
    const cfg = leerConfigIntegraciones(m.cwd, { env: m.env });
    assert.deepEqual(cfg.proveedores.github.destinos, []);
    const r = await m.cli('publicar', m.taskId, '--proveedor', 'github', '--referencia', 'org/repo#7');
    assert.equal(r.codigo, 1);
    assert.match(r.error, /no está en github_destinos/);
    const l = await m.cli('leer', 'github', 'org/repo#7');
    assert.equal(l.codigo, 1);
    assert.equal(m.gh.peticiones.length, 0);
    // ... y con el destino en la lista del usuario, vale
    const bien = await montar({ destinos: 'org/repo, org/otro' });
    const id = await bien.publicar();
    assert.ok(id);
  });

  test('un pendiente preparado antes se rechaza al aprobar si el destino sale de la lista del usuario', async () => {
    const m = await montar();
    const id = await m.publicar();
    const huella = leerPendiente(m.cwd, id, m.env).huella;
    /** @type {string[]} */ const er = [];
    const codigo = await ejecutarIntegraciones(['aprobar', id, '--huella', huella, '--cwd', m.cwd], { env: { ...m.env, FORGE_INTEGRACIONES_DESTINOS: 'org/otro' }, fabrica: m.fabrica, salida: () => {}, error: (l) => er.push(l) });
    assert.equal(codigo, 1);
    assert.match(er.join('\n'), /FORGE_INTEGRACIONES_DESTINOS|no está permitido|destinos/);
    assert.equal(m.gh.peticiones.length, 0);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
describe('H9 el bloqueo por alcance y los topes no los reinicia el repositorio', () => {
  test('vaciar o fabricar .sdd/integraciones/alcance.json no levanta el bloqueo; editar el del usuario tampoco', async () => {
    const m = await montar();
    const id = await m.publicar();
    const huella = leerPendiente(m.cwd, id, m.env).huella;
    escribirAlcance(m.cwd, 'github', { exceso: true, ambitos: ['api', 'sudo'], motivo: 'de más' }, m.env);
    // el repositorio escribe en el árbol: no cuenta
    mkdirSync(join(m.cwd, '.sdd', 'integraciones'), { recursive: true });
    writeFileSync(join(m.cwd, '.sdd', 'integraciones', 'alcance.json'), '{}');
    assert.equal(leerAlcance(m.cwd, m.env).github.bloqueaEscritura, true);
    const r = await m.cli('aprobar', id, '--huella', huella);
    assert.equal(r.codigo, 1);
    assert.match(r.error, /más alcance del necesario/);
    // y si alguien vacía el archivo del usuario, falla CERRADO (bloquea todo hasta volver a comprobar)
    writeFileSync(join(m.dirEstado(), 'alcance.json'), '{}');
    const a = leerAlcance(m.cwd, m.env);
    assert.equal(a.github.bloqueaEscritura, true);
    assert.equal(a.github.noAutenticado, true);
    const r2 = await m.cli('aprobar', id, '--huella', huella);
    assert.equal(r2.codigo, 1);
    assert.equal(m.gh.peticiones.length, 0);
  });

  test('el tope por sesión no se reinicia fabricando sesion.json: queda el tope diario, fuera del árbol', async () => {
    const m = await montar();
    let hechas = 0;
    /** @type {any} */ let corte = null;
    for (let i = 0; i < 12; i++) {
      // cada intento «inventa» otra sesión, como un sesion.json fabricado con otro runId
      const a = new AuditoriaIntegraciones({ cwd: m.cwd, tope: 1, sesion: `run-inventado-${i}`, env: m.env });
      try { await a.ejecutar({ proveedor: 'github', operacion: 'comentar', destino: 'org/repo', accion: async () => 'ok' }); hechas++; } catch (e) { corte = e; break; }
    }
    assert.equal(hechas, 5, 'tope diario = 5 × el de sesión');
    assert.ok(corte instanceof ErrorTopeIntegraciones);
    assert.match(corte.message, /hoy \(tope diario\)/);
    // y los contadores no están en el árbol del proyecto
    assert.equal(existsSync(join(m.cwd, '.sdd', 'integraciones', 'sesiones')), false);
    assert.ok(existsSync(join(m.dirEstado(), 'dias')));
  });

  test('con el mismo identificador de sesión el tope por sesión sigue cortando', async () => {
    const m = await montar();
    const a = new AuditoriaIntegraciones({ cwd: m.cwd, tope: 2, sesion: 'misma', env: m.env });
    const hacer = () => a.ejecutar({ proveedor: 'github', operacion: 'comentar', destino: 'org/repo', accion: async () => 'ok' });
    await hacer(); await hacer();
    await assert.rejects(hacer, (e) => e instanceof ErrorTopeIntegraciones && !/tope diario/.test(e.message));
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
describe('H10 lo que el adaptador rechaza siempre no se prepara', () => {
  test('docs/CODEOWNERS y .husky/ se excluyen al preparar, no al llegar al adaptador', () => {
    const p = proyectoConTarea({ archivos: { 'src/a.js': 'x\n', 'docs/CODEOWNERS': '* @atacante\n', '.husky/pre-commit': 'curl x | sh\n', 'sub/CODEOWNERS': '* @a\n' } });
    const r = prepararPublicacion({ cwd: p.cwd, tareaId: p.taskId, proveedor: 'github', referencia: 'org/repo#7', tipo: 'propuesta' });
    const c = /** @type {any} */ (r.contenido);
    assert.deepEqual(c.archivos.map((/** @type {any} */ a) => a.ruta), ['src/a.js']);
    const excl = Object.fromEntries(c.excluidos.map((/** @type {any} */ e) => [e.ruta, e.motivo]));
    assert.ok(excl['docs/CODEOWNERS'], JSON.stringify(excl));
    assert.ok(excl['sub/CODEOWNERS']);
    assert.ok(excl['.husky/pre-commit']);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
describe('H11 el identificador de la tarea de `leer` no colisiona', () => {
  test('referencias distintas que daban el mismo slug dan identificadores distintos', () => {
    assert.notEqual(idDeEntrada('gitlab', 'a/b-c#1'), idDeEntrada('gitlab', 'a/b/c#1'));
    assert.notEqual(idDeEntrada('github', 'org/re-po#7'), idDeEntrada('github', 'org/re.po#7'));
    assert.equal(idDeEntrada('github', 'org/repo#7'), idDeEntrada('github', 'org/repo#7'), 'estable');
    assert.match(idDeEntrada('github', 'org/repo#7'), /^github-org-repo-7-[0-9a-f]{8}$/);
    assert.match(idDeEntrada('github', 'org/repo#7'), /^\w[\w.-]*$/, 'sigue siendo un identificador de tarea válido');
  });

  test('`leer` guarda la entrada con ese identificador', async () => {
    const m = await montar();
    const r = await m.cli('leer', 'github', 'org/repo#7');
    assert.equal(r.codigo, 0, r.todo);
    const id = idDeEntrada('github', 'org/repo#7');
    assert.ok(existsSync(join(m.cwd, '.sdd', 'integraciones', 'entrada', `${id}.json`)));
    const tareas = JSON.parse(readFileSync(join(m.cwd, '.sdd', 'integraciones', 'entrada', `${id}.tareas.json`), 'utf8'));
    assert.equal(tareas[0].id, id);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
describe('H12 los usos incorrectos salen con código 2', () => {
  test('identificador de pendiente con forma inválida', async () => {
    const m = await montar();
    for (const malo of ['../../etc/passwd', '..', 'a/../x', 'A', 'x'.repeat(80)]) {
      for (const sub of ['aprobar', 'vista', 'rechazar']) {
        const r = await m.cli(sub, malo);
        assert.equal(r.codigo, 2, `${sub} ${malo}: ${r.todo}`);
      }
    }
  });

  test('una huella con forma inválida es un uso incorrecto; un id inexistente sigue siendo un rechazo (1)', async () => {
    const m = await montar();
    const id = await m.publicar();
    assert.equal((await m.cli('aprobar', id, '--huella', 'zzzzzzzzzzzzzz')).codigo, 2);
    assert.equal((await m.cli('aprobar', 'github-000000000000', '--huella', 'a'.repeat(12))).codigo, 1);
    assert.equal(m.gh.peticiones.length, 0);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
describe('Pendiente del revisor: forge doctor y FORGE_GITHUB_TOKEN sin sección', () => {
  test('el módulo de integraciones no lee el entorno sin sección o con todo apagado', async () => {
    for (const yaml of [null, 'motor:\n  modo: ciclo\n', 'integraciones:\n  github_modo: apagado\n  github_token_env: FORGE_GITHUB_TOKEN\n']) {
      const cwd = mkdtempSync(join(tmpdir(), 'forge-rev2-doc-'));
      mkdirSync(join(cwd, '.sdd'), { recursive: true });
      if (yaml !== null) writeFileSync(join(cwd, '.sdd', 'sdd.config.yaml'), yaml);
      /** @type {string[]} */ const lecturas = [];
      const env = new Proxy({ FORGE_GITHUB_TOKEN: TOKEN }, {
        get(t, k) { if (typeof k === 'string') lecturas.push(k); return Reflect.get(t, k); },
        has(t, k) { if (typeof k === 'string') lecturas.push(k); return Reflect.has(t, k); },
        ownKeys(t) { lecturas.push('(ownKeys)'); return Reflect.ownKeys(t); },
      });
      const r = await diagnosticarIntegraciones({ cwd, env: /** @type {any} */ (env) });
      assert.equal(r.activo, false);
      assert.deepEqual(lecturas, []);
      assert.equal(integracionesActivas(cwd), false);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
describe('migración: lo que había en el árbol no se aprueba nunca', () => {
  test('un pendiente antiguo del árbol se lista «no autenticado» y dice cómo recrearlo', async () => {
    const m = await montar();
    const real = await m.publicar();
    const antiguo = leerPendiente(m.cwd, real, m.env);
    const dir = join(m.cwd, '.sdd', 'integraciones', 'pendientes');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'github-0123456789ab.json'), JSON.stringify({ ...antiguo, id: 'github-0123456789ab', huellaContenido: 'a'.repeat(64) }));
    const l = await m.cli('pendientes');
    assert.match(l.salida, /github-0123456789ab\s+no autenticado \(archivo del árbol del proyecto/);
    assert.match(l.salida, /forge integraciones publicar <tarea>/);
    assert.match(l.salida, new RegExp(`${real}\\s+pendiente`), 'el real sigue ahí');
    const r = await m.cli('aprobar', 'github-0123456789ab', '--huella', antiguo.huella);
    assert.equal(r.codigo, 1);
    assert.match(r.error, /no se aprueba nunca/);
    assert.equal(m.gh.peticiones.length, 0);
  });
});
