// @ts-check
/**
 * OpenAI con herramientas (spec 2026-10-13-proveedores-agnosticos, F2): lo propio de este proveedor
 * que la batería común no cubre: gasto sin doble cuenta, punto compatible sin herramientas, centinela
 * de la clave y el ciclo por turnos de punta a punta contra un servidor falso de chat completions.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import http from 'node:http';

import { AgentRegistry } from '../core/agent-registry.js';
import { POR_DEFECTO } from '../core/ciclo/config.js';
import { CicloVerificado, crearLlamador } from '../core/ciclo/index.js';
import { costoDe } from '../core/ciclo/presupuesto.js';
import { OpenAIProvider } from '../core/llm-providers/index.js';
import { precioDe } from '../core/session-budget.js';
import { servidorFalso } from './fixtures/proveedores/servidor-falso.js';

const CENTINELA = 'sk-centinela-openai-no-debe-salir-7c2d41';
const HERRAMIENTAS = [{ nombre: 'leer', descripcion: 'Lee', esquema: { type: 'object', properties: {} } }];
const PETICION = { model: 'sonnet', systemPrompt: 's', herramientas: HERRAMIENTAS, mensajes: [{ rol: 'usuario', contenido: 'x' }] };

describe('admiteHerramientas (CA-002-02)', () => {
  test('solo con clave o con un fetch inyectado', () => {
    assert.equal(new OpenAIProvider({ api_key: '' }).admiteHerramientas, false);
    assert.equal(new OpenAIProvider({ api_key: 'sk-x' }).admiteHerramientas, true);
    assert.equal(new OpenAIProvider({ api_key: '', fetch: async () => ({}) }).admiteHerramientas, true);
  });

  test('sin clave no inventa una conversación', async () => {
    await assert.rejects(new OpenAIProvider({ api_key: '' }).conversar(/** @type {any} */ (PETICION)), /falta la clave/);
  });
});

describe('gasto: el contrato de caché de OpenAI (va dentro de prompt_tokens)', () => {
  test('entrada + lectura de caché = prompt_tokens; ni doble cuenta ni por debajo', async () => {
    const s = await servidorFalso('openai', [{ texto: 'ok', tokens: { prompt: 1000, completion: 50, cacheados: 800 } }]);
    try {
      const p = new OpenAIProvider({ api_key: CENTINELA, base_url: s.url });
      const r = await p.conversar(/** @type {any} */ (PETICION));
      assert.equal(r.inputTokens, 200);
      assert.equal(r.cacheReadTokens, 800);
      assert.equal(r.cacheCreationTokens, 0);

      const precio = precioDe('openai', 'gpt-4o-mini');
      const usd = costoDe({ proveedor: 'openai', modelo: 'gpt-4o-mini', inputTokens: r.inputTokens, outputTokens: r.outputTokens, cacheCreationTokens: r.cacheCreationTokens, cacheReadTokens: r.cacheReadTokens });
      const esperado = 200 * precio.input + 800 * 0.075e-6 + 50 * precio.output;   // la caché a su precio oficial (Cached input); nunca por debajo de él
      assert.ok(usd <= 1000 * precio.input + 50 * precio.output + 1e-12, 'ni más que todo a precio de entrada');
      assert.ok(Math.abs(usd - esperado) < 1e-12, `${usd} vs ${esperado}`);
    } finally { await s.cerrar(); }
  });

  test('una caché mayor que la entrada o sin recuento no hunde el gasto', async () => {
    const s = await servidorFalso('openai', [{ texto: 'ok', tokens: { prompt: 100, completion: 5, cacheados: 999 } }, { texto: 'ok', tokens: { prompt: 100, completion: 5 } }]);
    try {
      const p = new OpenAIProvider({ api_key: CENTINELA, base_url: s.url });
      const a = await p.conversar(/** @type {any} */ (PETICION));
      assert.equal(a.inputTokens + a.cacheReadTokens, 100);
      const b = await p.conversar(/** @type {any} */ (PETICION));
      assert.deepEqual([b.inputTokens, b.cacheReadTokens], [100, 0]);
    } finally { await s.cerrar(); }
  });
});

describe('punto compatible sin herramientas (CA-002-03)', () => {
  test('error claro, deja de declararlas y no reenvía la petición', async () => {
    const s = await servidorFalso('openai', [{ http: 400, mensaje: 'tools is not supported for this model' }]);
    try {
      const p = new OpenAIProvider({ api_key: CENTINELA, base_url: s.url });
      assert.equal(p.admiteHerramientas, true);
      await assert.rejects(p.conversar(/** @type {any} */ (PETICION)), /no admite herramientas en chat completions/);
      assert.equal(p.admiteHerramientas, false, 'el ciclo usará el modo de bloque');
      assert.equal(s.peticiones.length, 1);
      await assert.rejects(p.conversar(/** @type {any} */ (PETICION)), /no admite herramientas/);
      assert.equal(s.peticiones.length, 1, 'no vuelve a llamar');
      // complete sigue funcionando en ese servidor
    } finally { await s.cerrar(); }
  });

  test('un 401 o un 500 no se confunde con «sin herramientas»', async () => {
    for (const http_ of [401, 500]) {
      const s = await servidorFalso('openai', [{ http: http_, mensaje: 'tools unsupported (no es el motivo)' }]);
      try {
        const p = new OpenAIProvider({ api_key: CENTINELA, base_url: s.url });
        await assert.rejects(p.conversar(/** @type {any} */ (PETICION)), new RegExp(`OpenAI error ${http_}`));
        assert.equal(p.admiteHerramientas, true);
      } finally { await s.cerrar(); }
    }
  });

  test('límite de salida: max_completion_tokens y, si el compatible no lo conoce, max_tokens una vez', async () => {
    const s = await servidorFalso('openai', [{ http: 400, mensaje: "Unrecognized request argument: max_completion_tokens" }, { texto: 'ok' }]);
    try {
      const p = new OpenAIProvider({ api_key: CENTINELA, base_url: s.url });
      const r = await p.conversar(/** @type {any} */ ({ ...PETICION, maxTokens: 321 }));
      assert.equal(r.stopReason, 'fin');
      assert.equal(s.peticiones[0].cuerpo.max_completion_tokens, 321);
      assert.equal(s.peticiones[1].cuerpo.max_tokens, 321);
      assert.equal('max_completion_tokens' in s.peticiones[1].cuerpo, false);
    } finally { await s.cerrar(); }
  });

  test('sin herramientas en la petición no envía `tools` y no usa la API de respuestas', async () => {
    const s = await servidorFalso('openai', [{ texto: 'ok' }]);
    try {
      const p = new OpenAIProvider({ api_key: CENTINELA, base_url: s.url });
      await p.conversar(/** @type {any} */ ({ ...PETICION, herramientas: [] }));
      assert.equal('tools' in s.peticiones[0].cuerpo, false);
      assert.match(String(s.peticiones[0].url), /\/chat\/completions$/);
      assert.ok(!JSON.stringify(s.peticiones[0].cuerpo).includes('strict'));
    } finally { await s.cerrar(); }
  });
});

describe('centinela de la clave (CA-002-06)', () => {
  test('un servidor que repite la clave en su error no la filtra', async () => {
    const s = await servidorFalso('openai', [{ http: 401, mensaje: `Incorrect API key provided: ${CENTINELA}.` }]);
    try {
      const p = new OpenAIProvider({ api_key: CENTINELA, base_url: s.url });
      for (const llamada of [() => p.conversar(/** @type {any} */ (PETICION)), () => p.complete({ model: 'sonnet', systemPrompt: 's', userPrompt: 'u' })]) {
        const e = await llamada().then(() => null, (x) => x);
        assert.ok(e instanceof Error);
        assert.ok(!String(e.message).includes(CENTINELA), e.message);
        assert.ok(!String(e.message).includes('centinela-openai'), e.message);
      }
      // La clave solo viaja en Authorization
      assert.equal(s.peticiones[0].headers.authorization, `Bearer ${CENTINELA}`);
      assert.ok(!JSON.stringify(s.peticiones[0].cuerpo).includes(CENTINELA));
    } finally { await s.cerrar(); }
  });

  test('una redirección no lleva la clave a otro servidor (redirect: error)', async () => {
    /** @type {http.IncomingHttpHeaders[]} */
    const ajeno = [];
    const destino = http.createServer((req, res) => { ajeno.push(req.headers); res.end('{}'); });
    await new Promise((r) => destino.listen(0, '127.0.0.1', () => r(undefined)));
    const redirige = http.createServer((_req, res) => { res.statusCode = 307; res.setHeader('location', `http://127.0.0.1:${/** @type {any} */ (destino.address()).port}/x`); res.end(); });
    await new Promise((r) => redirige.listen(0, '127.0.0.1', () => r(undefined)));
    try {
      const p = new OpenAIProvider({ api_key: CENTINELA, base_url: `http://127.0.0.1:${/** @type {any} */ (redirige.address()).port}/v1` });
      await assert.rejects(p.conversar(/** @type {any} */ (PETICION)));
      assert.equal(ajeno.length, 0);
    } finally { redirige.closeAllConnections?.(); destino.closeAllConnections?.(); redirige.close(); destino.close(); }
  });
});

// ---------------------------------------------------------------------------------------------
// El ciclo por turnos de punta a punta (CA-002-05)
// ---------------------------------------------------------------------------------------------

const PASA = { exitCode: 0, stdout: '# tests 1\n# pass 1\n' };
const FALLA = { exitCode: 1, stdout: '# tests 1\n# fail 1\n' };
const PLAN = '{"pasos":["cambiar la constante"],"archivosObjetivo":["src/a.js"]}';
const PRUEBAS = '```json\n{"archivos":[{"ruta":"tests/a.test.js","contenido":"import \'../src/a.js\';\\n"}]}\n```';
const BLOQUE = '```json\n{"archivos":[{"ruta":"src/a.js","contenido":"export const a = 3;\\n"}]}\n```';
const TAREA = { id: 'T1', agente: 'desarrollador-backend', prompt: 'Cambia a a 2', archivos: ['src/a.js'] };

/** Un proyecto, un registro de agentes y un ciclo cuyo proveedor es OpenAI contra el servidor falso. */
function montar(escenarios, { ejecuciones, config = {} } = /** @type {any} */ ({})) {
  return servidorFalso('openai', escenarios).then((srv) => {
    const cwd = mkdtempSync(join(tmpdir(), 'forge-openai-'));
    mkdirSync(join(cwd, 'src'), { recursive: true });
    writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'p', type: 'module', scripts: { test: 'node --test' } }));
    writeFileSync(join(cwd, 'src', 'a.js'), 'export const a = 1;\n');
    mkdirSync(join(cwd, '.sdd', 'motor'), { recursive: true });
    writeFileSync(join(cwd, '.sdd', 'motor', 'sesion.json'), JSON.stringify({ runId: 'r1', modo: 'ciclo', creada: '2026-10-14T00:00:00Z' }));

    const registro = new AgentRegistry();
    for (const name of ['arquitecto', 'tester', 'desarrollador-backend']) registro.register({ name, model: 'sonnet', systemPrompt: `Eres ${name}.`, goal: 'Objetivo' });
    const proveedor = new OpenAIProvider({ api_key: CENTINELA, base_url: srv.url });
    const ll = crearLlamador(registro, undefined, cwd, { proveedor });
    /** @type {any[]} */
    const eventos = [];
    const cola = [...(ejecuciones ?? [])];
    const ciclo = new CicloVerificado(/** @type {any} */ ({
      cwd, runId: 'r1', testCmd: 'npm test',
      config: { ...POR_DEFECTO, motor: { ...POR_DEFECTO.motor, grafo: 'propio', mutacion: 'no', implementador: 'turnos' }, presupuesto: { ...POR_DEFECTO.presupuesto }, ...config },
      log: { append: (/** @type {string} */ type, /** @type {any} */ payload, /** @type {any} */ meta) => eventos.push({ type, payload, meta }) },
      aliasDe: ll.aliasDe, llamar: ll.llamar, conversar: ll.conversar, admiteHerramientas: ll.admiteHerramientas,
      runner: { test: async () => ({ stdout: '', stderr: '', timedOut: false, infraError: false, durationMs: 1, ...cola.shift() }) },
    }));
    return { srv, cwd, ciclo, eventos, proveedor };
  });
}

/** Todo el texto de un directorio, para buscar la clave. */
function textoDeDirectorio(dir) {
  let t = '';
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    t += statSync(p).isDirectory() ? textoDeDirectorio(p) : readFileSync(p, 'utf8');
  }
  return t;
}

describe('ciclo por turnos contra un servidor falso de chat completions (CA-002-05)', () => {
  test('lee, recibe un argumento mal formado como error, edita, prueba y termina; la clave no sale', async () => {
    const m = await montar([
      { texto: PLAN, tokens: { prompt: 100, completion: 10 } },
      { texto: PRUEBAS, tokens: { prompt: 100, completion: 10 } },
      // Turno 1: argumentos que no son JSON
      { usos: [{ id: 'c1', nombre: 'buscar', argumentosCrudos: '{"texto": "a' }], tokens: { prompt: 500, completion: 20, cacheados: 0 } },
      // Turno 2: dos herramientas en un turno: edita y prueba
      { usos: [{ id: 'c2', nombre: 'editar', entrada: { ruta: 'src/a.js', contenido: 'export const a = 2;\n' } }, { id: 'c3', nombre: 'ejecutar_pruebas', entrada: {} }], tokens: { prompt: 600, completion: 30, cacheados: 400 } },
      { texto: 'He terminado.', tokens: { prompt: 700, completion: 8, cacheados: 600 } },
    ], { ejecuciones: [FALLA, PASA, PASA] });
    try {
      const r = await m.ciclo.ejecutar(TAREA);
      assert.equal(r.estado.resultado, 'exito', JSON.stringify(m.eventos.filter((e) => /revision|error/i.test(e.type))));
      assert.equal(/** @type {any} */ (r.estado).implementador, 'turnos');
      assert.equal(readFileSync(join(m.cwd, 'src', 'a.js'), 'utf8'), 'export const a = 2;\n');

      // Dos llamadas de un solo mensaje y tres turnos; el implementador no usó el modo de bloque
      const cuerpos = m.srv.peticiones.map((p) => p.cuerpo);
      assert.equal(cuerpos.length, 5);
      assert.equal(cuerpos.filter((c) => c.tools).length, 3);

      // El argumento mal formado volvió al modelo como resultado de herramienta con error
      const turno2 = cuerpos[3].messages;
      const tool1 = turno2.find((x) => x.role === 'tool' && x.tool_call_id === 'c1');
      assert.ok(tool1, 'hay un mensaje tool para la llamada mal formada');
      assert.match(tool1.content, /^ERROR: /);
      // Las dos llamadas del turno 2 vuelven en orden, cada una con su id
      const ultimos = cuerpos[4].messages.filter((x) => x.role === 'tool').map((x) => x.tool_call_id);
      assert.deepEqual(ultimos, ['c1', 'c2', 'c3']);

      // Gasto: tokens a `presupuesto`, la caché dentro de prompt_tokens sin contarse dos veces
      const p = r.estado.presupuesto;
      const precio = precioDe('openai', 'gpt-4o-mini');
      const prompt = 100 + 100 + 500 + 600 + 700;
      const completion = 10 + 10 + 20 + 30 + 8;
      const cacheados = 400 + 600;   // dentro de prompt_tokens; se cobran a 0,075 USD por millón (Cached input de gpt-4o-mini)
      assert.ok(Math.abs(p.gastado_usd - ((prompt - cacheados) * precio.input + cacheados * 0.075e-6 + completion * precio.output)) < 1e-9, `${p.gastado_usd}`);
      assert.equal(p.llamadas, 5);

      // Centinela: ni en los registros, ni en el estado en disco, ni en lo que viajó en cuerpos
      assert.ok(!JSON.stringify(m.eventos).includes(CENTINELA));
      assert.ok(!textoDeDirectorio(join(m.cwd, '.sdd')).includes(CENTINELA));
      assert.ok(!JSON.stringify(cuerpos).includes(CENTINELA));
      assert.ok(m.srv.peticiones.every((x) => x.headers.authorization === `Bearer ${CENTINELA}`));
    } finally { await m.srv.cerrar(); }
  });

  test('un punto compatible que rechaza las herramientas: aviso y modo de bloque; la tarea termina', async () => {
    const m = await montar([
      { texto: PLAN },
      { texto: PRUEBAS },
      { http: 400, mensaje: 'This model does not support tools' },
      { texto: BLOQUE },
    ], { ejecuciones: [FALLA, PASA] });
    try {
      const r = await m.ciclo.ejecutar(TAREA);
      assert.equal(r.estado.resultado, 'exito', JSON.stringify(m.eventos.filter((e) => /sin_herramientas|revision/.test(e.type)).map((e) => e.payload)));
      assert.equal(/** @type {any} */ (r.estado).implementador, 'bloque');
      assert.equal(readFileSync(join(m.cwd, 'src', 'a.js'), 'utf8'), 'export const a = 3;\n');
      assert.ok(m.eventos.some((e) => e.type === 'ciclo:implementador_sin_herramientas'), 'avisa');
      assert.equal(m.proveedor.admiteHerramientas, false);
      assert.ok(!JSON.stringify(m.eventos).includes(CENTINELA));
    } finally { await m.srv.cerrar(); }
  });
});
