/**
 * mcp-completo-interruptor.test.js — el interruptor y la auditoría cubren también las herramientas del perfil completo (revisión M4)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { conInterruptorYAuditoria } from '../core/mcp/servidor.js';

const herramienta = (veces) => ({ name: 'leer_archivo', description: 'x', inputSchema: { type: 'object' }, async ejecutar() { veces.n++; return { texto: 'ok' }; } });

test('apagado: la herramienta no ejecuta y la llamada se audita sin valores de argumentos', async () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'mcpc-'));
  const estado = fs.mkdtempSync(path.join(os.tmpdir(), 'mcpe-'));
  try {
    const env = { FRAGUA_MCP_CICLO: 'apagado', FRAGUA_ESTADO_DIR: estado, FORGE_ESTADO_DIR: estado };
    const veces = { n: 0 };
    const [h] = conInterruptorYAuditoria([herramienta(veces)], { cwd, env });
    const r = await h.ejecutar({ ruta: 'secreto/valor.txt' });
    assert.equal(r.error, true);
    assert.match(r.texto, /apagada/);
    assert.equal(veces.n, 0);
  } finally { fs.rmSync(cwd, { recursive: true, force: true }); fs.rmSync(estado, { recursive: true, force: true }); }
});

test('encendido: ejecuta y devuelve lo mismo', async () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'mcpc-'));
  try {
    const veces = { n: 0 };
    const [h] = conInterruptorYAuditoria([herramienta(veces)], { cwd, env: {} });
    const r = await h.ejecutar({});
    assert.equal(r.texto, 'ok');
    assert.equal(veces.n, 1);
  } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
});
