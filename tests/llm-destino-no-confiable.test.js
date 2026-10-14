// @ts-check
/**
 * El archivo del proyecto no puede dirigir la clave ni el contenido a un servidor ajeno
 * (hallazgo de los spikes de `2026-10-13-proveedores-agnosticos`, S0.3).
 *
 * Antes: `.sdd/sdd.config.yaml` fijaba `base_url` y `api_key`, y ganaban al entorno; un repositorio
 * ajeno con `provider: openai` y `base_url: https://servidor-ajeno` recibía `OPENAI_API_KEY` del
 * usuario en la cabecera Authorization. Aquí un servidor local hace de «servidor ajeno» y la clave
 * es un centinela.
 */

import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { crearProvider, destinoDeModeloPermitido, sanearConfigDelProyecto, VARIABLE_HOSTS_LLM } from '../core/llm-providers/index.js';

const CENTINELA = 'sk-centinela-no-debe-salir-9f3a1c';

/** Proyecto con la configuración hostil de la prueba. */
function proyecto(yaml) {
  const cwd = mkdtempSync(join(tmpdir(), 'forge-llm-dest-'));
  mkdirSync(join(cwd, '.sdd'));
  writeFileSync(join(cwd, '.sdd', 'sdd.config.yaml'), yaml);
  return cwd;
}

/** Servidor que registra lo que recibe. */
function servidor() {
  /** @type {{ headers: http.IncomingHttpHeaders, url?: string }[]} */
  const recibido = [];
  const srv = http.createServer((req, res) => {
    recibido.push({ headers: req.headers, url: req.url });
    req.resume();
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ choices: [{ message: { content: 'ok' } }], message: { content: 'ok' } }));
  });
  return new Promise((resolver) => srv.listen(0, '127.0.0.1', () => resolver({
    srv, recibido, puerto: /** @type {any} */ (srv.address()).port,
  })));
}

/** Ejecuta con variables de entorno fijadas y las restaura. */
async function conEntorno(vars, fn) {
  const antes = {};
  for (const k of Object.keys(vars)) { antes[k] = process.env[k]; if (vars[k] === undefined) delete process.env[k]; else process.env[k] = vars[k]; }
  const avisos = [];
  const w = console.warn; console.warn = (...a) => avisos.push(a.join(' '));
  try { return await fn(avisos); } finally {
    console.warn = w;
    for (const k of Object.keys(antes)) { if (antes[k] === undefined) delete process.env[k]; else process.env[k] = antes[k]; }
  }
}

describe('destinoDeModeloPermitido', () => {
  test('la propia máquina vale; un servidor ajeno no, salvo que el usuario lo nombre', () => {
    assert.equal(destinoDeModeloPermitido('http://localhost:11434', {}), true);
    assert.equal(destinoDeModeloPermitido('http://127.0.0.1:1234/v1', {}), true);
    assert.equal(destinoDeModeloPermitido('https://ajeno.example/v1', {}), false);
    assert.equal(destinoDeModeloPermitido('https://ajeno.example/v1', { [VARIABLE_HOSTS_LLM]: 'otro.example' }), false);
    assert.equal(destinoDeModeloPermitido('https://ajeno.example/v1', { [VARIABLE_HOSTS_LLM]: 'Ajeno.Example' }), true);
    assert.equal(destinoDeModeloPermitido('https://ajeno.example:8443/v1', { [VARIABLE_HOSTS_LLM]: 'ajeno.example:8443' }), true);
  });

  test('HTTP hacia fuera, credenciales en la URL y esquemas raros se rechazan siempre', () => {
    const env = { [VARIABLE_HOSTS_LLM]: 'ajeno.example' };
    assert.equal(destinoDeModeloPermitido('http://ajeno.example/v1', env), false);
    assert.equal(destinoDeModeloPermitido('https://u:p@ajeno.example/v1', env), false);
    assert.equal(destinoDeModeloPermitido('ftp://ajeno.example', env), false);
    assert.equal(destinoDeModeloPermitido('file:///etc/passwd', env), false);
    assert.equal(destinoDeModeloPermitido('no es una url', env), false);
  });
});

describe('sanearConfigDelProyecto', () => {
  test('quita credenciales y direcciones no permitidas, y avisa de cada una', () => {
    const avisos = [];
    const r = sanearConfigDelProyecto(
      { provider: 'openai', api_key: 'sk-x', api_version: '2024-02-01', base_url: 'https://ajeno.example/v1', cache: 'false' },
      {}, (m) => avisos.push(m));
    assert.deepEqual(r, { provider: 'openai', cache: 'false' });
    assert.equal(avisos.length, 3);
    assert.ok(avisos.some((m) => m.includes('api_key')));
    assert.ok(avisos.some((m) => m.includes('base_url')));
  });

  test('una dirección permitida por el usuario se conserva', () => {
    const r = sanearConfigDelProyecto({ base_url: 'https://mio.example/v1' }, { [VARIABLE_HOSTS_LLM]: 'mio.example' }, () => {});
    assert.equal(r.base_url, 'https://mio.example/v1');
  });

  test('un provider con dirección ajena se descarta', () => {
    const r = sanearConfigDelProyecto({ provider: 'https://ajeno.example' }, {}, () => {});
    assert.equal(r.provider, undefined);
  });
});

describe('crearProvider con un proyecto hostil', () => {
  const abiertos = [];
  after(() => { for (const s of abiertos) s.close(); });

  test('OpenAI: la clave del usuario NO llega al servidor que fija el proyecto', async () => {
    const s = await servidor(); abiertos.push(s.srv);
    const cwd = proyecto(`llm:\n  provider: openai\n  base_url: http://ajeno.invalid:${s.puerto}/v1\n`);
    // El nombre no resuelve: aunque ignorara la comprobación, la conexión fallaría; por eso el
    // servidor espía está en 127.0.0.1 y el proyecto apunta a él con otro nombre en la segunda prueba
    await conEntorno({ OPENAI_API_KEY: CENTINELA, FORGE_LLM_PROVIDER: undefined, OPENAI_BASE_URL: undefined }, async (avisos) => {
      const p = crearProvider({ cwd });
      assert.equal(p.baseUrl, 'https://api.openai.com/v1', 'volvió al servidor oficial');
      assert.ok(avisos.some((a) => a.includes('base_url')));
    });
    assert.equal(s.recibido.length, 0);
  });

  test('OpenAI: ni siquiera una dirección «local» del proyecto con la clave del entorno la recibe si es de otro puerto del usuario', async () => {
    // Una dirección local SÍ está permitida (la propia máquina); la clave va allí, por diseño: es la
    // máquina del usuario. Lo que debe cumplirse es que la clave sea la del ENTORNO, nunca la del archivo
    const s = await servidor(); abiertos.push(s.srv);
    const cwd = proyecto(`llm:\n  provider: openai\n  api_key: sk-del-repositorio\n  base_url: http://127.0.0.1:${s.puerto}/v1\n`);
    await conEntorno({ OPENAI_API_KEY: CENTINELA, FORGE_LLM_PROVIDER: undefined, OPENAI_BASE_URL: undefined }, async () => {
      const p = crearProvider({ cwd });
      assert.equal(p.apiKey, CENTINELA, 'la clave es la del entorno, no la del archivo');
      await p.complete({ model: 'sonnet', systemPrompt: 's', userPrompt: 'u' });
    });
    assert.equal(s.recibido.length, 1);
    assert.equal(s.recibido[0].headers.authorization, `Bearer ${CENTINELA}`);
  });

  test('Ollama: una dirección ajena en provider o en base_url se descarta', async () => {
    const cwd = proyecto('llm:\n  provider: http://ajeno.example:11434\n');
    await conEntorno({ FORGE_LLM_PROVIDER: undefined, ANTHROPIC_API_KEY: undefined, OPENAI_API_KEY: undefined, OLLAMA_BASE_URL: undefined }, async (avisos) => {
      const p = crearProvider({ cwd });
      assert.notEqual(p.nombre, 'ollama', 'no se creó un proveedor hacia la dirección ajena');
      assert.ok(avisos.some((a) => a.includes('llm.provider')));
    });
  });

  test('el usuario sí puede apuntar a su propio servidor, por el entorno', async () => {
    const cwd = proyecto('llm:\n  provider: openai\n');
    await conEntorno({ OPENAI_API_KEY: CENTINELA, OPENAI_BASE_URL: 'https://mio.example/v1', FORGE_LLM_PROVIDER: undefined }, async () => {
      assert.equal(crearProvider({ cwd }).baseUrl, 'https://mio.example/v1');
    });
  });

  test('una redirección del servidor no lleva la clave a otro host', async () => {
    const destino = await servidor(); abiertos.push(destino.srv);
    const redir = http.createServer((req, res) => { res.statusCode = 307; res.setHeader('location', `http://127.0.0.1:${destino.puerto}/robo`); res.end(); req.resume(); });
    await new Promise((r) => redir.listen(0, '127.0.0.1', r));
    abiertos.push(redir);
    const p = await conEntorno({ OPENAI_API_KEY: CENTINELA, OPENAI_BASE_URL: `http://127.0.0.1:${/** @type {any} */ (redir.address()).port}/v1`, FORGE_LLM_PROVIDER: 'openai' },
      async () => crearProvider({ cwd: proyecto('') }));
    await assert.rejects(p.complete({ model: 'sonnet', systemPrompt: 's', userPrompt: 'u' }));
    assert.equal(destino.recibido.length, 0, 'la clave no llegó al destino de la redirección');
  });
});
