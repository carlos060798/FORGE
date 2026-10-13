// @ts-check
/**
 * F5.1, F5.2, F5.3 y los cierres de HU-005 y de la idempotencia entre procesos — integraciones de
 * extremo a extremo con servidores FALSOS locales y el ciclo guionizado REAL (CicloVerificado con
 * modelo y runner simulados). Ninguna petición sale del equipo; todos los tokens son centinelas.
 *
 *  F5.1  Ningún centinela (token, usuario de Jira, Base64 de la cabecera Basic) aparece en prompts,
 *        eventos, puntos de guardado, diario, libro de gasto, .sdd/integraciones, salidas del CLI ni
 *        mensajes de error de los casos de fallo (CA-004-05).
 *  F5.2  Ningún camino lleva del modelo a una operación de red (RF-001, RF-002): estática, dinámica
 *        (fetch interceptado y herramientas inventadas) y el servidor MCP propio.
 *  F5.3  Las 52 entradas hostiles de extremo a extremo producen el MISMO resultado del ciclo que un
 *        cuerpo limpio (CA-001-03, CA-001-04).
 *  d)    HU-005: sin sección o con todo apagado, `forge run` es idéntico a una versión sin el módulo.
 *  e)    Dos `forge integraciones aprobar` simultáneos no duplican la publicación.
 */

import { test, describe, after } from 'node:test';
import { ENTORNO_USUARIO, conHuella } from './fixtures/integraciones/entorno-usuario.mjs';
import { leerPendiente, vistaPrevia } from '../core/integraciones/aprobacion.js';
import { directorioDeEstado } from '../core/integraciones/estado-usuario.js';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { BASE_LOCAL } from '../core/integraciones/pruebas-internas.js';
import { ejecutarIntegraciones, idDeEntrada } from '../cli/integraciones.js';
import { crearProveedorGitHub } from '../core/integraciones/proveedores/github.js';
import { crearProveedorGitLab } from '../core/integraciones/proveedores/gitlab.js';
import { crearProveedorJira } from '../core/integraciones/proveedores/jira.js';
import { pedir } from '../core/integraciones/http.js';
import { CicloVerificado } from '../core/ciclo/index.js';
import { POR_DEFECTO } from '../core/ciclo/config.js';
import { EventLog } from '../core/event-log.js';
import { comprobarConversacion } from '../core/llm-providers/stub-provider.js';
import { ESQUEMAS_HERRAMIENTAS } from '../core/ciclo/herramientas-coder.js';
import { crearServidorGitHub } from './fixtures/integraciones/servidores/github.mjs';
import { crearServidorGitLab } from './fixtures/integraciones/servidores/gitlab.mjs';
import { adfParrafo, crearServidorJiraFalso } from './fixtures/integraciones/servidores/jira.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(RAIZ, 'cli', 'index.js');
const PRECARGA = pathToFileURL(join(RAIZ, 'tests', 'fixtures', 'integraciones-traza', 'precarga.mjs')).href;
const SIN_MODULO = pathToFileURL(join(RAIZ, 'tests', 'fixtures', 'integraciones-traza', 'sin-modulo.mjs')).href;
const HIJO_APROBAR = join(RAIZ, 'tests', 'fixtures', 'integraciones', 'aprobar-hijo.mjs');
/** @type {Array<{id:string,categoria:string,titulo:string,cuerpo:string,esperado:string}>} */
const HOSTILES = JSON.parse(readFileSync(join(RAIZ, 'tests', 'fixtures', 'integraciones', 'hostiles.json'), 'utf8'));

// ── Centinelas con formato reconocible ──────────────────────────────────────────────────────
const TOKEN_GH = 'github_pat_' + 'E2ECENTINELA0a1b2c3d4e5f60718293a4b5c6d7e8f9';
const TOKEN_GL = 'glpat-' + 'E2ECENTINELA01234567';
const TOKEN_JI = 'ATATT3xFfGF0' + 'E2ECentinelaJira0123456789abcdefXYZ';
const USUARIO = 'centinela-e2e-f51@ejemplo.com';
const VARIABLES = { ...ENTORNO_USUARIO, FORGE_GITHUB_TOKEN: TOKEN_GH, FORGE_GITLAB_TOKEN: TOKEN_GL, FORGE_JIRA_USUARIO: USUARIO, FORGE_JIRA_TOKEN: TOKEN_JI, FORGE_INTEGRACIONES_HOSTS: 'gitlab.empresa.com,ejemplo.atlassian.net' };

/** Base64 de una cadena en las tres alineaciones posibles dentro de un texto mayor (sin los bordes inseguros). @param {string} s */
function variantesBase64(s) {
  const salida = new Set();
  for (let relleno = 0; relleno < 3; relleno++) {
    const b = Buffer.from('x'.repeat(relleno) + s, 'utf8').toString('base64').replace(/=+$/, '');
    const inicio = Math.ceil((relleno * 8) / 6);
    // se descartan los dos últimos caracteres: dependen de lo que venga detrás
    salida.add(b.slice(inicio + 1, Math.max(inicio + 1, b.length - 2)));
  }
  return [...salida].filter((v) => v.length >= 12);
}
const BUSCADOS = [...new Set([
  TOKEN_GH, TOKEN_GL, TOKEN_JI, USUARIO,
  Buffer.from(`${USUARIO}:${TOKEN_JI}`).toString('base64'),
  ...variantesBase64(`${USUARIO}:${TOKEN_JI}`), ...variantesBase64(TOKEN_JI), ...variantesBase64(TOKEN_GH), ...variantesBase64(TOKEN_GL), ...variantesBase64(USUARIO),
  'E2ECENTINELA', 'E2ECentinelaJira', 'centinela-e2e-f51',
])];

/** @param {string} texto @returns {string[]} los centinelas que contiene */
const centinelasEn = (texto) => BUSCADOS.filter((s) => texto.includes(s));

/** Todos los archivos bajo `dir` (rutas relativas, con `/`). @param {string} dir */
function archivosDe(dir) {
  /** @type {string[]} */ const salida = [];
  const rec = (/** @type {string} */ d) => {
    if (!existsSync(d)) return;
    for (const n of readdirSync(d)) {
      const x = join(d, n);
      if (statSync(x).isDirectory()) rec(x); else salida.push(relative(dir, x).split('\\').join('/'));
    }
  };
  rec(dir);
  return salida.sort();
}

/** Archivos de `.sdd/` que contienen algún centinela (con el contenido leído como texto y como binario). @param {string} cwd */
function filtracionesEnSdd(cwd) {
  /** @type {string[]} */ const hallazgos = [];
  // El árbol del proyecto Y el estado del usuario (cola, contadores, alcance): ningún secreto en ninguno
  for (const sdd of [join(cwd, '.sdd'), directorioDeEstado(cwd)]) for (const f of archivosDe(sdd)) {
    const buf = readFileSync(join(sdd, f));
    const dentro = centinelasEn(buf.toString('utf8')).concat(centinelasEn(buf.toString('latin1')));
    if (dentro.length > 0) hallazgos.push(`${f}: ${[...new Set(dentro)].map((s) => s.slice(0, 14)).join(',')}`);
  }
  return hallazgos;
}

const cierres = /** @type {Array<() => Promise<void>>} */ ([]);
after(async () => { for (const c of cierres) await c(); });

// ── Entorno: tres servidores falsos, proyecto y CLI en-proceso ───────────────────────────────
const YAML = `integraciones:
  github_modo: proponer
  github_token_env: FORGE_GITHUB_TOKEN
  github_destinos: org/repo
  gitlab_modo: proponer
  gitlab_host: gitlab.empresa.com
  gitlab_token_env: FORGE_GITLAB_TOKEN
  gitlab_destinos: empresa/web
  jira_modo: comentar
  jira_sitio: ejemplo.atlassian.net
  jira_usuario_env: FORGE_JIRA_USUARIO
  jira_token_env: FORGE_JIRA_TOKEN
  jira_destinos: ABC
`;

/**
 * @param {Object} [o]
 * @param {string} [o.yaml]
 * @param {string} [o.ghToken]   token que acepta el servidor de GitHub (distinto del del entorno = token inválido)
 * @param {string} [o.glToken]
 * @param {string} [o.jiToken]
 * @param {Record<string, any>} [o.ghIncidencias]
 * @param {Record<string, any>} [o.glIncidencias]
 * @param {Record<string, any>} [o.jiTickets]
 * @param {any[]} [o.ghFallos]
 * @param {number|false} [o.ghEscrituraDenegada]
 */
async function montar(o = {}) {
  const gh = await crearServidorGitHub({
    token: o.ghToken ?? TOKEN_GH, fallos: o.ghFallos ?? [], escrituraDenegada: o.ghEscrituraDenegada ?? false,
    repos: { 'org/repo': { ramas: { main: 'a'.repeat(40) }, incidencias: o.ghIncidencias ?? { 7: { title: 'Sumar dos números', body: 'Que la función sume.', user: { login: 'ana' }, labels: [{ name: 'bug' }] } } } },
  });
  const gl = await crearServidorGitLab({
    token: o.glToken ?? TOKEN_GL,
    proyectos: { 'empresa/web': { ramas: ['main'], incidencias: o.glIncidencias ?? { 7: { title: 'Sumar', description: 'Que la función sume.', labels: ['bug'], notas: [] } } } },
  });
  const ji = await crearServidorJiraFalso({
    usuario: USUARIO, token: o.jiToken ?? TOKEN_JI,
    tickets: o.jiTickets ?? { 'ABC-7': { summary: 'Sumar', description: adfParrafo('Que la función sume.'), labels: ['bug'], comments: [] } },
  });
  cierres.push(() => gh.cerrar(), () => gl.cerrar(), () => ji.cerrar());
  const cwd = mkdtempSync(join(tmpdir(), 'forge-e2e-'));
  mkdirSync(join(cwd, '.sdd'), { recursive: true });
  writeFileSync(join(cwd, '.sdd', 'sdd.config.yaml'), o.yaml ?? YAML);
  const sinEspera = (/** @type {any} */ x) => pedir({ ...x, _esperar: async () => {} });
  const fabrica = (/** @type {any} */ cfg, /** @type {any} */ { token, usuario, auditoria }) => {
    if (cfg.nombre === 'github') return crearProveedorGitHub({ token, destinos: cfg.destinos, modo: cfg.modo, auditoria, [BASE_LOCAL]: gh.baseUrl });
    if (cfg.nombre === 'gitlab') return /** @type {any} */ (crearProveedorGitLab({ token, destinos: cfg.destinos, modo: cfg.modo, auditoria, [BASE_LOCAL]: gl.baseUrl, _esperar: async () => {} }));
    return /** @type {any} */ (crearProveedorJira({ sitio: cfg.host, usuario, token, destinos: cfg.destinos, modo: cfg.modo, auditoria, [BASE_LOCAL]: ji.baseUrl, http: sinEspera }));
  };
  /** Todo lo que el CLI imprimió, por stdout y stderr, en toda la vida de este entorno. */
  const impreso = { salida: '', error: '' };
  const cli = async (/** @type {string[]} */ ...args) => {
    /** @type {string[]} */ const sal = [];
    /** @type {string[]} */ const er = [];
    const codigo = await ejecutarIntegraciones([...(await conHuella(cwd, args, VARIABLES)), '--cwd', cwd], { env: VARIABLES, fabrica, salida: (l) => sal.push(l), error: (l) => er.push(l) });
    impreso.salida += `${sal.join('\n')}\n`;
    impreso.error += `${er.join('\n')}\n`;
    return { codigo, salida: sal.join('\n'), error: er.join('\n'), todo: `${sal.join('\n')}\n${er.join('\n')}` };
  };
  return { gh, gl, ji, cwd, cli, impreso };
}

/**
 * El ciclo guionizado real, con el implementador por turnos. `ciclo` y `capturas` permiten revisar todo
 * lo que se envió al «modelo». `fetch` global queda interceptado mientras corre el ciclo.
 * @param {string} cwd
 * @param {{ id: string, agente: string, prompt: string, archivos?: string[] }} tarea
 * @param {Object} [o]
 * @param {any[]} [o.turnos]   respuestas de `conversar`; por defecto: buscar, editar, ejecutar pruebas, terminar
 * @param {Array<{exitCode:number, stdout?:string}>} [o.ejecuciones]
 */
async function correrCiclo(cwd, tarea, o = {}) {
  const runId = 'run-20261013000000-1';
  writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'p', type: 'module', scripts: { test: 'node --test' } }));
  mkdirSync(join(cwd, '.sdd', 'motor'), { recursive: true });
  writeFileSync(join(cwd, '.sdd', 'motor', 'sesion.json'), JSON.stringify({ runId, modo: 'ciclo', creada: '2026-10-13T00:00:00Z' }));
  const bloque = (/** @type {string} */ ruta, /** @type {string} */ contenido) => '```json\n' + JSON.stringify({ archivos: [{ ruta, contenido }] }) + '\n```';
  const guion = {
    arquitecto: [JSON.stringify({ pasos: ['implementar la suma'], archivosObjetivo: ['src/suma.js'] })],
    tester: [bloque('tests/suma.test.js', "import { test } from 'node:test';\ntest('suma', () => {});\n")],
  };
  let n = 0;
  const uso = (/** @type {string} */ nombre, /** @type {any} */ entrada = {}) => ({ tipo: 'uso_herramienta', id: `uso_${++n}`, nombre, entrada });
  const turnos = [...(o.turnos ?? [
    { contenido: [{ tipo: 'texto', texto: 'Miro.' }, uso('buscar', { texto: 'suma' })] },
    { contenido: [{ tipo: 'texto', texto: 'Escribo.' }, uso('editar', { ruta: 'src/suma.js', contenido: 'export const suma = (a, b) => a + b;\n' })] },
    { contenido: [{ tipo: 'texto', texto: 'Pruebo.' }, uso('ejecutar_pruebas')] },
    { contenido: [{ tipo: 'texto', texto: 'Terminé.' }] },
  ])];
  const cola = [...(o.ejecuciones ?? [{ exitCode: 1, stdout: '# tests 1\n# fail 1\n' }, { exitCode: 0, stdout: '# tests 1\n# pass 1\n' }, { exitCode: 0, stdout: '# tests 1\n# pass 1\n' }])];
  const registro = new EventLog(join(cwd, '.sdd'));
  /** @type {any[]} */ const eventos = [];
  /** @type {string[]} */ const capturas = [];
  /** @type {any[]} */ const conversaciones = [];
  const ciclo = new CicloVerificado(/** @type {any} */ ({
    cwd, runId, testCmd: 'npm test',
    config: { ...POR_DEFECTO, motor: { ...POR_DEFECTO.motor, grafo: 'propio', mutacion: 'no', implementador: 'turnos' } },
    log: { append: (/** @type {any} */ t, /** @type {any} */ p, /** @type {any} */ m) => { eventos.push({ type: t, payload: p }); return registro.append(t, p, m); } },
    aliasDe: () => 'sonnet',
    llamar: async (/** @type {any} */ p) => {
      capturas.push(JSON.stringify(p));
      const s = /** @type {any} */ (guion)[p.agente]?.shift();
      if (s === undefined) throw new Error(`guion agotado para ${p.agente}`);
      return { ok: true, output: s, inputTokens: 100, outputTokens: 10, modelo: 'claude-sonnet-4-6', proveedor: 'anthropic' };
    },
    admiteHerramientas: () => true,
    conversar: async (/** @type {any} */ p) => {
      comprobarConversacion(p.mensajes);
      capturas.push(JSON.stringify(p));
      conversaciones.push(JSON.parse(JSON.stringify(p)));
      const r = turnos.shift();
      if (r === undefined) throw new Error('guion de turnos agotado');
      return { ok: true, stopReason: r.contenido.some((/** @type {any} */ b) => b.tipo === 'uso_herramienta') ? 'herramientas' : 'fin', inputTokens: 1000, outputTokens: 50, modelo: 'claude-sonnet-4-6', proveedor: 'anthropic', ...r };
    },
    runner: { test: async () => {
      const r = cola.shift();
      if (r === undefined) throw new Error('guion de ejecuciones agotado');
      return { stdout: '', stderr: '', timedOut: false, infraError: false, durationMs: 1, ...r };
    } },
  }));
  const realFetch = globalThis.fetch;
  /** @type {string[]} */ const fetchIntentos = [];
  globalThis.fetch = /** @type {any} */ (async (/** @type {any} */ e) => { fetchIntentos.push(String(e?.url ?? e)); throw new Error('fetch bloqueado durante el ciclo'); });
  try {
    const r = await ciclo.ejecutar(tarea);
    return { r, ciclo, eventos, capturas, conversaciones, fetchIntentos };
  } finally {
    globalThis.fetch = realFetch;
  }
}

/** @param {string} cwd @param {string} nombre */
const leerTareas = (cwd, nombre) => JSON.parse(readFileSync(join(cwd, '.sdd', 'integraciones', 'entrada', `${nombre}.tareas.json`), 'utf8'));

const REFS = /** @type {const} */ ({
  github: { ref: 'org/repo#7', entrada: idDeEntrada('github', 'org/repo#7'), patron: /github-[0-9a-f]{12}/ },
  gitlab: { ref: 'empresa/web#7', entrada: idDeEntrada('gitlab', 'empresa/web#7'), patron: /gitlab-[0-9a-f]{12}/ },
  jira: { ref: 'ABC-7', entrada: idDeEntrada('jira', 'ABC-7'), patron: /jira-[0-9a-f]{12}/ },
});

/**
 * leer → tareas → ciclo → publicar → vista → aprobar para un proveedor. Devuelve todo lo observable.
 * @param {Awaited<ReturnType<typeof montar>>} m
 * @param {'github'|'gitlab'|'jira'} proveedor
 */
async function recorrer(m, proveedor) {
  const { ref, entrada, patron } = REFS[proveedor];
  const l = await m.cli('leer', proveedor, ref);
  assert.equal(l.codigo, 0, l.todo);
  const tarea = leerTareas(m.cwd, entrada)[0];
  const c = await correrCiclo(m.cwd, tarea);
  assert.equal(c.r.estado.resultado, 'exito');
  const tipo = proveedor === 'jira' ? [] : ['--tipo', 'propuesta'];
  const p = await m.cli('publicar', tarea.id, '--proveedor', proveedor, '--referencia', ref, ...tipo);
  assert.equal(p.codigo, 0, p.todo);
  const id = patron.exec(p.salida)?.[0] ?? '';
  assert.ok(id);
  const v = await m.cli('vista', id, '--archivos');
  assert.equal(v.codigo, 0, v.todo);
  const a = await m.cli('aprobar', id);
  assert.equal(a.codigo, 0, a.todo);
  return { l, p, v, a, c, id, tarea };
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
describe('F5.1 no filtración: ningún centinela en ningún rincón del recorrido (CA-004-05)', () => {
  test('control positivo: el buscador encuentra el token, el usuario y el Base64 de la cabecera Basic donde estén', () => {
    const d = mkdtempSync(join(tmpdir(), 'forge-e2e-ctl-'));
    mkdirSync(join(d, '.sdd', 'x'), { recursive: true });
    const basic = `Authorization: Basic ${Buffer.from(`${USUARIO}:${TOKEN_JI}`).toString('base64')}`;
    writeFileSync(join(d, '.sdd', 'x', 'a.json'), JSON.stringify({ cabecera: basic }));
    writeFileSync(join(d, '.sdd', 'b.txt'), `ruido ${TOKEN_GH} ruido`);
    writeFileSync(join(d, '.sdd', 'c.txt'), `${Buffer.from(`id=${TOKEN_GL}`).toString('base64')}`);
    writeFileSync(join(d, '.sdd', 'limpio.txt'), 'nada que ver');
    const f = filtracionesEnSdd(d).map((x) => x.split(':')[0]).sort();
    assert.deepEqual(f, ['b.txt', 'c.txt', 'x/a.json']);
  });

  for (const proveedor of /** @type {const} */ (['github', 'gitlab', 'jira'])) {
    test(`${proveedor}: leer → archivo de tareas → ciclo real → publicar → vista → aprobar, sin una sola aparición`, async () => {
      const m = await montar();
      const x = await recorrer(m, proveedor);

      // El token SÍ viajó por el cable (si no, la prueba sería vacua) ...
      const servidor = /** @type {any} */ ({ github: m.gh, gitlab: m.gl, jira: m.ji })[proveedor];
      const cabeceras = JSON.stringify(servidor.peticiones.map((q) => q.cabeceras));
      assert.ok(centinelasEn(cabeceras).length > 0 || /Basic /.test(cabeceras), 'el servidor falso no recibió la credencial');
      // ... y escribió de verdad en la plataforma falsa
      assert.ok((servidor.escrituras ? servidor.escrituras() : servidor.peticiones.filter((q) => q.metodo !== 'GET')).length >= 1);

      // Lo que se envió a los agentes: cada userPrompt, cada extraContext, cada mensaje y herramienta
      assert.ok(x.c.capturas.length >= 3, 'el ciclo hizo llamadas');
      assert.ok(x.c.capturas.some((t) => t.includes('DATO-NO-CONFIABLE')), 'el dato delimitado sí llegó al ciclo');
      for (const t of x.c.capturas) assert.deepEqual(centinelasEn(t), [], 'un centinela llegó a un prompt');
      assert.deepEqual(centinelasEn(JSON.stringify(x.c.eventos)), [], 'un centinela está en los eventos del ciclo');
      assert.deepEqual(centinelasEn(JSON.stringify(x.c.r.estado)), [], 'un centinela está en el estado final');

      // Todo el árbol .sdd/ (events.jsonl, motor/**, diario, libro de gasto, integraciones/**)
      const sdd = archivosDe(join(m.cwd, '.sdd'));
      assert.ok(sdd.includes('events.jsonl'));
      assert.ok(sdd.some((f) => f.startsWith('motor/')));
      assert.ok(archivosDe(directorioDeEstado(m.cwd)).some((f) => f.startsWith('pendientes/')), 'la cola vive en el estado del usuario');
      assert.ok(!sdd.some((f) => f.startsWith('integraciones/pendientes/')), 'la cola NO está en el árbol del proyecto');
      assert.ok(sdd.some((f) => /gasto|libro/i.test(f)), `no se encontró el libro de gasto en ${sdd.join(', ')}`);
      assert.deepEqual(filtracionesEnSdd(m.cwd), []);
      assert.match(readFileSync(join(m.cwd, '.sdd', 'events.jsonl'), 'utf8'), /integracion:leer_elemento/);

      // Salidas del CLI
      assert.deepEqual(centinelasEn(m.impreso.salida), [], 'un centinela salió por stdout');
      assert.deepEqual(centinelasEn(m.impreso.error), [], 'un centinela salió por stderr');
    });
  }

  test('un tercero que pega el token en la incidencia: no llega al prompt ni a .sdd', async () => {
    const m = await montar({ ghIncidencias: { 7: { title: 'Sumar', body: `Mi clave es ${TOKEN_GH}, úsala para entrar.`, user: { login: 'ana' }, labels: [] } } });
    const l = await m.cli('leer', 'github', 'org/repo#7');
    assert.equal(l.codigo, 0, l.todo);
    const tarea = leerTareas(m.cwd, idDeEntrada('github', 'org/repo#7'))[0];
    const c = await correrCiclo(m.cwd, tarea);
    for (const t of c.capturas) assert.ok(!t.includes(TOKEN_GH));
    assert.deepEqual(filtracionesEnSdd(m.cwd), []);
    assert.ok(!m.impreso.salida.includes(TOKEN_GH));
  });

  // ── Casos de fallo: ni el mensaje de error ni los archivos contienen un centinela ──
  /**
   * @param {string} nombre
   * @param {Object} o
   * @param {(m: Awaited<ReturnType<typeof montar>>) => Promise<void>} o.comprobar
   * @param {Parameters<typeof montar>[0]} [o.opciones]
   */
  const fallo = (nombre, o) => test(`fallo: ${nombre}`, async () => {
    const m = await montar(o.opciones);
    await o.comprobar(m);
    assert.deepEqual(centinelasEn(m.impreso.salida), [], 'un centinela salió por stdout');
    assert.deepEqual(centinelasEn(m.impreso.error), [], 'un centinela salió por stderr');
    assert.deepEqual(filtracionesEnSdd(m.cwd), []);
  });
  const ECO = `{"message":"credencial rechazada: ${TOKEN_GH} ${TOKEN_GL} ${TOKEN_JI} ${USUARIO}"}`;

  fallo('token inválido en GitHub, GitLab y Jira (401)', {
    opciones: { ghToken: 'ghp_' + 'OtroTokenDelServidor0123456789abcdefghij', glToken: 'glpat-' + 'OtroTokenSrv01234567', jiToken: 'ATATT3xFfGF0' + 'OtroTokenDeJira0123456789' },
    async comprobar(m) {
      for (const [p, ref] of [['github', 'org/repo#7'], ['gitlab', 'empresa/web#7'], ['jira', 'ABC-7']]) {
        const r = await m.cli('leer', p, ref);
        assert.equal(r.codigo, 1, `${p}: ${r.todo}`);
      }
      assert.ok(m.gh.peticiones.length + m.gl.peticiones.length + m.ji.peticiones.length >= 3, 'las peticiones sí llegaron y fueron rechazadas');
    },
  });

  fallo('destino fuera de la lista (sin red)', {
    async comprobar(m) {
      for (const [p, ref] of [['github', 'otra/cosa#1'], ['gitlab', 'otro/proyecto#1'], ['jira', 'ZZZ-1']]) {
        const r = await m.cli('leer', p, ref);
        assert.equal(r.codigo, 1, `${p}: ${r.todo}`);
        assert.match(r.error, /no está en/);
      }
      assert.equal(m.gh.peticiones.length + m.gl.peticiones.length + m.ji.peticiones.length, 0);
    },
  });

  fallo('500 de las tres plataformas al leer, con el token en el cuerpo de la respuesta', {
    opciones: { ghFallos: [{ metodo: 'GET', patron: /./, estado: 500, cuerpo: ECO }] },
    async comprobar(m) {
      m.gl.fallar(() => true, 500, undefined, undefined, ECO);
      m.ji.forzar = () => ({ estado: 500, texto: ECO });
      for (const [p, ref] of [['github', 'org/repo#7'], ['gitlab', 'empresa/web#7'], ['jira', 'ABC-7']]) {
        const r = await m.cli('leer', p, ref);
        assert.equal(r.codigo, 1, `${p}: ${r.todo}`);
      }
    },
  });

  fallo('403 de GitHub al leer y al escribir, con el token en el cuerpo', {
    opciones: { ghFallos: [{ metodo: 'GET', patron: /issues\/9$/, estado: 403, cuerpo: ECO }] },
    async comprobar(m) {
      const r = await m.cli('leer', 'github', 'org/repo#9');
      assert.equal(r.codigo, 1, r.todo);
      // y al escribir: se lee bien, se prepara y la plataforma deniega con 403 y el eco del token
      await m.cli('leer', 'github', 'org/repo#7');
      const tarea = leerTareas(m.cwd, idDeEntrada('github', 'org/repo#7'))[0];
      await correrCiclo(m.cwd, tarea);
      const p = await m.cli('publicar', tarea.id, '--proveedor', 'github', '--referencia', 'org/repo#7');
      const id = /github-[0-9a-f]{12}/.exec(p.salida)?.[0] ?? '';
      m.gh.estado.fallos.push({ metodo: 'POST', patron: /./, estado: 403, cuerpo: ECO });
      const a = await m.cli('aprobar', id);
      assert.equal(a.codigo, 1, a.todo);
      assert.match(a.error, /reintentable/);
    },
  });

  fallo('plataforma caída (503) en GitHub y Jira al aprobar: pendiente fallido y reintentable', {
    async comprobar(m) {
      for (const proveedor of /** @type {const} */ (['github', 'jira'])) {
        const { ref, entrada, patron } = REFS[proveedor];
        await m.cli('leer', proveedor, ref);
        const tarea = leerTareas(m.cwd, entrada)[0];
        await correrCiclo(m.cwd, tarea);
        const p = await m.cli('publicar', tarea.id, '--proveedor', proveedor, '--referencia', ref);
        const id = patron.exec(p.salida)?.[0] ?? '';
        if (proveedor === 'github') m.gh.estado.fallos.push({ metodo: 'POST', patron: /./, estado: 503, cuerpo: ECO, cabeceras: { 'retry-after': '0' }, veces: 4 });
        else m.ji.forzar = ({ metodo }) => (metodo === 'POST' ? { estado: 503, texto: ECO } : undefined);
        const a = await m.cli('aprobar', id);
        assert.equal(a.codigo, 1, `${proveedor}: ${a.todo}`);
        assert.match((await m.cli('pendientes')).salida, /fallido/);
      }
    },
  });

  test('un proceso real de `forge integraciones` con destino fuera de la lista: stdout, stderr y ni un fetch', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'forge-e2e-real-'));
    mkdirSync(join(cwd, '.sdd'), { recursive: true });
    writeFileSync(join(cwd, '.sdd', 'sdd.config.yaml'), YAML);
    const traza = join(cwd, 'traza.jsonl');
    writeFileSync(traza, '');
    const entorno = { ...process.env, ...VARIABLES, FORGE_TRAZA_INTEGRACIONES: traza };
    delete entorno.NODE_TEST_CONTEXT;
    const r = spawnSync(process.execPath, ['--import', PRECARGA, CLI, 'integraciones', 'leer', 'github', 'otra/cosa#1', '--cwd', cwd], { cwd, encoding: 'utf8', env: entorno, timeout: 60_000 });
    assert.equal(r.status, 1, r.stderr + r.stdout);
    assert.match(r.stderr, /no está en github_destinos/);
    assert.deepEqual(centinelasEn(r.stdout + r.stderr), []);
    assert.deepEqual(filtracionesEnSdd(cwd), []);
    const lineas = readFileSync(traza, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    assert.deepEqual(lineas.filter((l) => l.tipo === 'fetch'), [], 'no hubo ninguna petición');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
describe('F5.2 ningún camino lleva del modelo a una operación de red (RF-001, RF-002)', () => {
  test('(a) estática: agentes, contratos, herramientas del implementador y herramientas MCP no tocan el módulo ni la red', () => {
    const objetivos = [
      ...readdirSync(join(RAIZ, 'agents')).filter((f) => f.endsWith('.md')).map((f) => join('agents', f)),
      join('core', 'ciclo', 'contratos.js'),
      join('core', 'ciclo', 'herramientas-coder.js'),
      join('core', 'ciclo', 'turnos.js'),
      join('core', 'mcp', 'herramientas.js'),
      join('core', 'mcp', 'servidor.js'),
    ];
    assert.ok(objetivos.length >= 19);
    const PROHIBIDO = [
      ['módulo de integraciones', /core\/integraciones|cli\/integraciones|forge integraciones|from\s+['"][^'"]*integraciones/],
      ['fetch(', /\bfetch\s*\(/],
      ['https:// de plataformas', /https?:\/\/[^\s)"'`]*(?:github|gitlab|atlassian)/i],
      ['variables de token de plataforma', /FORGE_(?:GITHUB|GITLAB|JIRA)[A-Z_]*|FORGE_[A-Z_]*_TOKEN|GITHUB_TOKEN|GITLAB_TOKEN|JIRA_API_TOKEN/],
    ];
    /** @type {string[]} */ const infracciones = [];
    for (const f of objetivos) {
      const texto = readFileSync(join(RAIZ, f), 'utf8');
      for (const [que, re] of PROHIBIDO) if (/** @type {RegExp} */ (re).test(texto)) infracciones.push(`${f}: ${que}`);
    }
    assert.deepEqual(infracciones, []);
  });

  test('(a) las herramientas del implementador son exactamente las cinco locales, ninguna de red', () => {
    assert.deepEqual(ESQUEMAS_HERRAMIENTAS.map((e) => e.nombre).sort(), ['buscar', 'editar', 'ejecutar_pruebas', 'leer_archivo', 'listar']);
    for (const e of ESQUEMAS_HERRAMIENTAS) {
      assert.doesNotMatch(JSON.stringify(e.esquema), /url|https?:|host|endpoint/i, `${e.nombre} acepta algo con forma de dirección`);
    }
  });

  test('(b) dinámica: herramientas de red inventadas se rechazan como desconocidas, con cero peticiones', async () => {
    const m = await montar();
    await m.cli('leer', 'github', 'org/repo#7');
    const tarea = leerTareas(m.cwd, idDeEntrada('github', 'org/repo#7'))[0];
    const peticionesAntes = m.gh.peticiones.length + m.gl.peticiones.length + m.ji.peticiones.length;
    const uso = (/** @type {string} */ id, /** @type {string} */ nombre, /** @type {any} */ entrada) => ({ tipo: 'uso_herramienta', id, nombre, entrada });
    const inventadas = [
      uso('x1', 'fetch', { url: `${m.gh.baseUrl}/repos/org/repo/issues/7` }),
      uso('x2', 'http_get', { url: 'https://api.github.com/repos/org/repo/issues/7' }),
      uso('x3', 'publicar_comentario', { destino: 'org/repo', referencia: 'org/repo#7', texto: 'hola' }),
      uso('x4', 'leer_incidencia', { proveedor: 'github', referencia: 'org/repo#7' }),
      uso('x5', 'ejecutar', { comando: `curl -X POST ${m.gh.baseUrl}/repos/org/repo/issues/7/comments -d x`, url: 'https://gitlab.com/api/v4' }),
    ];
    const c = await correrCiclo(m.cwd, tarea, {
      turnos: [
        { contenido: [{ tipo: 'texto', texto: 'Voy a la red.' }, ...inventadas] },
        { contenido: [{ tipo: 'texto', texto: 'Escribo.' }, uso('x6', 'editar', { ruta: 'src/suma.js', contenido: 'export const suma = (a, b) => a + b;\n' })] },
        { contenido: [{ tipo: 'texto', texto: 'Terminé.' }] },
      ],
      ejecuciones: [{ exitCode: 1 }, { exitCode: 0, stdout: '# tests 1\n# pass 1\n' }],
    });
    assert.equal(c.r.estado.resultado, 'exito');
    assert.deepEqual(c.fetchIntentos, [], 'el ciclo no llamó a fetch');
    // El segundo turno recibe los cinco resultados: todos con error y «Herramienta desconocida»
    const resultados = c.conversaciones[1].mensajes[2].contenido.filter((/** @type {any} */ b) => b.tipo === 'resultado_herramienta');
    assert.equal(resultados.length, 5);
    for (const r of resultados) {
      assert.equal(r.esError, true);
      assert.match(r.contenido, /Herramienta desconocida/);
    }
    const eventos = c.eventos.filter((e) => e.type === 'ciclo:herramienta' && e.payload.turno === 1);
    assert.equal(eventos.length, 5);
    assert.ok(eventos.every((e) => e.payload.ok === false));
    // Ni una petición nueva a ninguna plataforma falsa
    assert.equal(m.gh.peticiones.length + m.gl.peticiones.length + m.ji.peticiones.length, peticionesAntes);
    assert.equal(m.gh.escrituras().length, 0);
  });

  test('(c) el servidor MCP propio solo expone sus tres herramientas, ninguna de integraciones', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'forge-e2e-mcp-'));
    mkdirSync(join(cwd, '.sdd'), { recursive: true });
    writeFileSync(join(cwd, '.sdd', 'sdd.config.yaml'), YAML);
    const entrada = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 't', version: '0' } } }) + '\n'
      + JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }) + '\n';
    const entorno = { ...process.env, ...VARIABLES };
    delete entorno.NODE_TEST_CONTEXT;
    const r = spawnSync(process.execPath, [CLI, 'mcp', '--cwd', cwd], { cwd, input: entrada, encoding: 'utf8', env: entorno, timeout: 60_000 });
    assert.ok(r.error === undefined, String(r.error));
    const respuesta = r.stdout.split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((x) => x.id === 2);
    const nombres = respuesta.result.tools.map((/** @type {any} */ t) => t.name).sort();
    assert.deepEqual(nombres, ['ejecutar_pruebas', 'escribir_archivo', 'leer_archivo']);
    assert.doesNotMatch(JSON.stringify(respuesta), /integracion|FORGE_[A-Z_]*TOKEN|atlassian|"(?:github|gitlab|jira)/i);
    // Y llamar a una operación de integraciones por este canal es un error de protocolo
    const intento = spawnSync(process.execPath, [CLI, 'mcp', '--cwd', cwd], {
      cwd, encoding: 'utf8', env: entorno, timeout: 60_000,
      input: `${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 't', version: '0' } } })}\n`
        + `${JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'integraciones_leer', arguments: { proveedor: 'github', referencia: 'org/repo#7' } } })}\n`,
    });
    const r3 = intento.stdout.split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((x) => x.id === 3);
    assert.ok(r3.error, JSON.stringify(r3));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
describe('F5.3 batería hostil de extremo a extremo: el resultado del ciclo es el del cuerpo limpio (CA-001-03, CA-001-04)', () => {
  /**
   * Todo lo que importa del resultado de una ejecución, para compararlo entre control y hostil.
   * @param {Awaited<ReturnType<typeof correrCiclo>>} c
   * @param {string} cwd
   */
  function resumen(c, cwd) {
    const cuenta = (/** @type {string} */ t) => c.eventos.filter((e) => e.type === t).length;
    const archivos = Object.fromEntries(archivosDe(cwd)
      .filter((f) => !f.startsWith('.sdd/') && !f.startsWith('node_modules/') && f !== 'package.json')
      .map((f) => [f, createHash('sha256').update(readFileSync(join(cwd, f))).digest('hex')]));
    const porTipo = Object.fromEntries([...new Set(c.eventos.map((e) => e.type))].sort().map((t) => [t, cuenta(t)]));
    return {
      resultado: c.r.estado.resultado,
      iteraciones: c.r.estado.iteracion,
      implementacion: c.r.estado.implementacion.archivos,
      archivosEnDisco: archivos,
      gastoEstado: c.r.estado.presupuesto.gastado_usd,
      gastoLibro: c.ciclo.libro.total(),
      llamadas: c.r.estado.presupuesto.llamadas,
      eventosPorTipo: porTipo,
      escrituraRechazada: cuenta('ciclo:escritura_rechazada'),
      lecturaRechazada: cuenta('ciclo:lectura_rechazada'),
      herramientasFallidas: c.eventos.filter((e) => e.type === 'ciclo:herramienta' && e.payload.ok === false).length,
      rutasVetadas: c.eventos.filter((e) => e.payload?.motivo === 'ruta_vetada').length,
      ejecuciones: c.r.estado.ejecuciones.map((x) => x.categoria),
      fetchIntentos: c.fetchIntentos.length,
    };
  }

  test('52 entradas hostiles contra un servidor GitHub falso: leer → ciclo → mismo resultado que con el cuerpo limpio', async () => {
    assert.equal(HOSTILES.length, 52);
    const incidencias = { 1: { title: 'Sumar dos números', body: 'Haz que la función suma devuelva la suma de a y b.', user: { login: 'ana' }, labels: [{ name: 'bug' }] } };
    HOSTILES.forEach((h, i) => { /** @type {any} */ (incidencias)[i + 2] = { title: h.titulo, body: h.cuerpo, user: { login: 'tercero' }, labels: [{ name: 'bug' }] }; });
    const m = await montar({ ghIncidencias: incidencias });

    /** @param {number} numero @param {string} etiqueta */
    async function ejecutar(numero, etiqueta) {
      // un proyecto limpio por caso: misma sesión, misma tarea, mismo guion
      const caso = await montar2(m, numero);
      const antes = m.gh.peticiones.length;
      const l = await caso.cli('leer', 'github', `org/repo#${numero}`);
      assert.equal(l.codigo, 0, `${etiqueta}: ${l.todo.slice(0, 300)}`);
      const lecturas = m.gh.peticiones.length - antes;
      const tarea = leerTareas(caso.cwd, idDeEntrada('github', `org/repo#${numero}`))[0];
      assert.match(tarea.prompt, /<<<DATO-NO-CONFIABLE:[0-9a-f]{24} inicio>>>/, `${etiqueta}: el dato no quedó delimitado`);
      const c = await correrCiclo(caso.cwd, { ...tarea, id: 'T1' });
      const peticionesTrasCiclo = m.gh.peticiones.length - antes;
      return { resumen: resumen(c, caso.cwd), lecturas, peticionesDuranteCiclo: peticionesTrasCiclo - lecturas, c, cwd: caso.cwd };
    }
    /** Un proyecto nuevo que reutiliza los servidores de `m` (sin levantar otros). */
    async function montar2(/** @type {typeof m} */ base, /** @type {number} */ n) {
      const cwd = mkdtempSync(join(tmpdir(), `forge-e2e-h${n}-`));
      mkdirSync(join(cwd, '.sdd'), { recursive: true });
      writeFileSync(join(cwd, '.sdd', 'sdd.config.yaml'), YAML);
      const fabrica = (/** @type {any} */ cfg, /** @type {any} */ { token, auditoria }) => crearProveedorGitHub({ token, destinos: cfg.destinos, modo: cfg.modo, auditoria, [BASE_LOCAL]: base.gh.baseUrl });
      const cli = async (/** @type {string[]} */ ...args) => {
        /** @type {string[]} */ const s = []; /** @type {string[]} */ const e = [];
        const codigo = await ejecutarIntegraciones([...(await conHuella(cwd, args, VARIABLES)), '--cwd', cwd], { env: VARIABLES, fabrica: /** @type {any} */ (fabrica), salida: (x) => s.push(x), error: (x) => e.push(x) });
        return { codigo, salida: s.join('\n'), error: e.join('\n'), todo: `${s.join('\n')}\n${e.join('\n')}` };
      };
      return { cwd, cli };
    }

    const control = await ejecutar(1, 'control');
    assert.equal(control.resumen.resultado, 'exito');
    assert.equal(control.resumen.fetchIntentos, 0);
    assert.equal(control.peticionesDuranteCiclo, 0);
    assert.equal(control.resumen.escrituraRechazada, 0);
    assert.equal(control.resumen.lecturaRechazada, 0);

    /** @type {Array<{ id: string, diferencias: string[] }>} */
    const hallazgos = [];
    for (let i = 0; i < HOSTILES.length; i++) {
      const h = HOSTILES[i];
      const r = await ejecutar(i + 2, h.id);
      /** @type {string[]} */ const dif = [];
      for (const k of /** @type {Array<keyof typeof control.resumen>} */ (Object.keys(control.resumen))) {
        if (JSON.stringify(r.resumen[k]) !== JSON.stringify(control.resumen[k])) dif.push(`${k}: control=${JSON.stringify(control.resumen[k])} hostil=${JSON.stringify(r.resumen[k])}`);
      }
      if (r.lecturas !== control.lecturas) dif.push(`peticiones de lectura: control=${control.lecturas} hostil=${r.lecturas}`);
      if (r.peticionesDuranteCiclo !== 0) dif.push(`peticiones de red durante el ciclo: ${r.peticionesDuranteCiclo}`);
      if (r.resumen.lecturaRechazada !== 0 || r.resumen.rutasVetadas !== 0) dif.push('lectura de ruta vetada');
      // El texto hostil estuvo de verdad en el prompt, como dato: si no, la comparación sería vacua
      assert.ok(r.c.capturas.some((t) => t.includes('DATO-NO-CONFIABLE')), `${h.id}: el dato no llegó al ciclo`);
      // Nada hostil pasó a ningún archivo del proyecto fuera de lo que escribió el guion
      if (dif.length > 0) hallazgos.push({ id: h.id, diferencias: dif });
    }
    assert.deepEqual(hallazgos, [], `HALLAZGO: ${hallazgos.length} caso(s) hacen diferir el resultado del ciclo`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
describe('HU-005 con la integración ausente o apagada, `forge run` no nota nada', () => {
  const APAGADO = 'integraciones:\n  github_modo: apagado\n  gitlab_modo: apagado\n  jira_modo: apagado\n';

  /** @param {string|null} extra YAML añadido a `.sdd/sdd.config.yaml` (null: sin archivo) */
  function proyecto(extra) {
    const dir = mkdtempSync(join(tmpdir(), 'forge-e2e-hu5-'));
    mkdirSync(join(dir, '.sdd'), { recursive: true });
    writeFileSync(join(dir, '.sdd', 'estado.json'), JSON.stringify({ pipeline_step: 'code' }));
    if (extra !== null) writeFileSync(join(dir, '.sdd', 'sdd.config.yaml'), `motor:\n  modo: clasico\n${extra}`);
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'demo', scripts: { test: 'node --test' } }));
    writeFileSync(join(dir, 'tareas.json'), JSON.stringify([{ id: 'T1', agente: 'arquitecto', prompt: 'Planifica la suma' }, { id: 'T2', agente: 'tester', prompt: 'Escribe las pruebas de la suma' }]));
    return dir;
  }

  /**
   * `forge run --motor clasico` con el proveedor de pruebas (sin Docker, sin modelo real).
   * @param {string} dir @param {string[]} imports URLs de precargas
   */
  function correr(dir, imports) {
    const traza = join(dir, '..', `traza-${Math.random().toString(36).slice(2)}.jsonl`);
    writeFileSync(traza, '');
    const entorno = { ...process.env, ...VARIABLES, FORGE_LLM_PROVIDER: 'stub', ANTHROPIC_API_KEY: '', FORGE_TRAZA_INTEGRACIONES: traza };
    delete entorno.NODE_TEST_CONTEXT;
    const r = spawnSync(process.execPath, [...imports.flatMap((i) => ['--import', i]), CLI, 'run', '--motor', 'clasico', '--tasks', 'tareas.json'], { cwd: dir, encoding: 'utf8', env: entorno, timeout: 120_000 });
    const normal = (/** @type {string} */ t) => t.split(dir.split('\\').join('\\\\')).join('<DIR>').split(dir).join('<DIR>').split(dir.split('\\').join('/')).join('<DIR>').replace(/\d+(?:\.\d+)?s\b/g, '<T>s');
    const eventos = existsSync(join(dir, '.sdd', 'events.jsonl'))
      ? readFileSync(join(dir, '.sdd', 'events.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => { const e = JSON.parse(l); delete e.id; delete e.ts; return normal(JSON.stringify(e)); })
      : [];
    const arbol = archivosDe(dir).filter((f) => f !== 'tareas.json' && f !== '.sdd/sdd.config.yaml');
    const lineas = readFileSync(traza, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    return { estado: r.status, salida: normal(r.stdout), error: normal(r.stderr), eventos, arbol, traza: lineas };
  }

  test('sin sección y con todo apagado: cero fetch, ninguna variable de token leída, ningún módulo cargado, salida idéntica a la versión sin el módulo', () => {
    const sinModulo = correr(proyecto(''), [SIN_MODULO, PRECARGA]);
    const sinSeccion = correr(proyecto(''), [PRECARGA]);
    const apagado = correr(proyecto(APAGADO), [PRECARGA]);
    const sinArchivo = correr(proyecto(null), [PRECARGA]);

    assert.equal(sinModulo.estado, 0, sinModulo.error + sinModulo.salida);
    assert.match(sinModulo.salida, /Pipeline completado: 2 tareas/);
    for (const [nombre, x] of /** @type {const} */ ([['sin sección', sinSeccion], ['todo apagado', apagado], ['sin archivo', sinArchivo]])) {
      assert.deepEqual(x.traza, [], `${nombre}: la traza (fetch, tokens, módulos) debe estar vacía`);
      assert.equal(x.estado, sinModulo.estado, nombre);
      assert.equal(x.salida, sinModulo.salida, `${nombre}: stdout distinto`);
      assert.equal(x.error, sinModulo.error, `${nombre}: stderr distinto`);
      assert.deepEqual(x.eventos, sinModulo.eventos, `${nombre}: eventos distintos`);
      assert.deepEqual(x.arbol, sinModulo.arbol, `${nombre}: archivos creados distintos`);
    }
    assert.ok(!sinModulo.arbol.some((f) => f.includes('integraciones')), 'no se creó nada de integraciones');
  });

  test('control positivo: con la integración activa y un servidor local, la misma precarga SÍ detecta módulo y lectura de token', () => {
    const dir = mkdtempSync(join(tmpdir(), 'forge-e2e-ctl5-'));
    const guion = join(dir, 'control.mjs');
    writeFileSync(guion, `
      await import(${JSON.stringify(pathToFileURL(join(RAIZ, 'core', 'integraciones', 'puerto.js')).href)});
      void process.env.FORGE_GITHUB_TOKEN;
    `);
    const traza = join(dir, 'traza.jsonl');
    writeFileSync(traza, '');
    const r = spawnSync(process.execPath, ['--import', PRECARGA, guion], { encoding: 'utf8', env: { ...process.env, FORGE_TRAZA_INTEGRACIONES: traza }, timeout: 60_000 });
    assert.equal(r.status, 0, r.stderr);
    const tipos = readFileSync(traza, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l).tipo).sort();
    assert.deepEqual([...new Set(tipos)], ['env', 'modulo']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
describe('idempotencia entre procesos: dos `aprobar` simultáneos del mismo id', () => {
  /** Una publicación pendiente de comentario en GitHub, lista para aprobar. */
  async function pendiente() {
    const m = await montar();
    await m.cli('leer', 'github', 'org/repo#7');
    const tarea = leerTareas(m.cwd, idDeEntrada('github', 'org/repo#7'))[0];
    const c = await correrCiclo(m.cwd, tarea);
    assert.equal(c.r.estado.resultado, 'exito');
    const p = await m.cli('publicar', tarea.id, '--proveedor', 'github', '--referencia', 'org/repo#7');
    const id = /github-[0-9a-f]{12}/.exec(p.salida)?.[0] ?? '';
    assert.ok(id);
    return { m, id };
  }

  /** @param {string} cwd @param {string} baseUrl @param {string} id @param {number} n */
  function lanzar(cwd, baseUrl, id, n) {
    const arranque = String(Date.now() + 2500);
    const entorno = { ...process.env, ...VARIABLES };
    delete entorno.NODE_TEST_CONTEXT;
    return Promise.all(Array.from({ length: n }, () => new Promise((ok, mal) => {
      const h = spawn(process.execPath, [HIJO_APROBAR, cwd, baseUrl, id, arranque, '150', vistaPrevia(cwd, id).huella], { env: entorno, stdio: ['ignore', 'pipe', 'pipe'] });
      let out = ''; let er = '';
      h.stdout.on('data', (d) => { out += d; });
      h.stderr.on('data', (d) => { er += d; });
      h.on('error', mal);
      h.on('exit', (code) => {
        try { ok({ salida: code === 0 ? JSON.parse(out.trim().split('\n').pop() ?? '') : null, code, er }); } catch (e) { mal(new Error(`hijo: ${out} ${er} ${e}`)); }
      });
    })));
  }

  test('como mucho una escritura efectiva; el otro proceso devuelve lo ya publicado o falla limpio (4 rondas)', async () => {
    for (let ronda = 0; ronda < 4; ronda++) {
      const { m, id } = await pendiente();
      const r = /** @type {any[]} */ (await lanzar(m.cwd, m.gh.baseUrl, id, 2));
      const escrituras = m.gh.escrituras();
      assert.ok(escrituras.length <= 1, `ronda ${ronda}: ${escrituras.length} escrituras efectivas en la plataforma: ${escrituras.map((e) => `${e.metodo} ${e.ruta}`).join(' | ')}`);
      const comentarios = (m.gh.repo('org/repo').comentarios.get(7) ?? []).length;
      assert.ok(comentarios <= 1, `ronda ${ronda}: ${comentarios} comentarios en la incidencia`);
      assert.equal(r.filter((x) => x.salida.codigo === 0).length >= 1, true, `ronda ${ronda}: ninguno publicó: ${JSON.stringify(r.map((x) => x.salida))}`);
      for (const x of r) {
        if (x.salida.codigo !== 0) assert.match(x.salida.error, /Otro proceso está aprobando|ya está|publicad/i, `ronda ${ronda}: fallo no limpio: ${x.salida.error}`);
        assert.deepEqual(centinelasEn(x.salida.salida + x.salida.error + x.er), []);
      }
      // El estado final es coherente: publicada, una sola vez
      const final = leerPendiente(m.cwd, id);
      assert.equal(final.estado, 'publicado');
      // y un tercer aprobar no escribe nada
      const antes = m.gh.escrituras().length;
      const otra = await m.cli('aprobar', id);
      assert.equal(otra.codigo, 0);
      assert.equal(m.gh.escrituras().length, antes);
    }
  });
});
