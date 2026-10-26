// @ts-check
/**
 * Argumentos de `fragua mcp` (revisión independiente 2026-10-25, M1): un argumento mal escrito no amplía lo expuesto.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerArgumentosMcp } from '../core/mcp/argumentos.js';

const CLI = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'cli', 'index.js');

test('acepta la forma con espacio y la forma con «=»', () => {
  assert.deepEqual(leerArgumentosMcp(['--perfil', 'verificacion', '--cwd', '/p']), { ok: true, perfil: 'verificacion', cwd: '/p' });
  assert.deepEqual(leerArgumentosMcp(['--perfil=verificacion', '--cwd=/p']), { ok: true, perfil: 'verificacion', cwd: '/p' });
  assert.deepEqual(leerArgumentosMcp([]), { ok: true });
});

test('rechaza lo desconocido, lo repetido y lo que no trae valor', () => {
  for (const malo of [['--perfl', 'verificacion'], ['verificacion'], ['--perfil'], ['--perfil='], ['--perfil', '--cwd', '/p'], ['--perfil=a', '--perfil=b'], ['--cwd']]) {
    assert.equal(leerArgumentosMcp(malo).ok, false, JSON.stringify(malo));
  }
});

test('el proceso real: «--perfil=verificacion» expone solo verificar y un argumento mal escrito no arranca', () => {
  const pedir = (/** @type {string[]} */ args) => spawnSync(process.execPath, [CLI, 'mcp', ...args], {
    input: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } } }) + '\n'
      + JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n'
      + JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }) + '\n',
    encoding: 'utf8', timeout: 60_000,
  });
  const ok = pedir(['--perfil=verificacion']);
  const lista = ok.stdout.split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((m) => m.id === 2);
  assert.deepEqual(lista.result.tools.map((/** @type {any} */ t) => t.name), ['verificar']);
  const mal = pedir(['--perfl=verificacion']);
  assert.equal(mal.status, 1);
  assert.equal(mal.stdout, '');
  assert.match(mal.stderr, /Opción desconocida/);
});
