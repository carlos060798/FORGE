// @ts-check
/**
 * `fragua doctor` muestra el perfil MCP efectivo y avisa de uno no válido
 * (spec 2026-10-14-ciclo-por-mcp, F1.8, CA-002-05). Solo lee el entorno del usuario.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'cli', 'index.js');

/** @param {Record<string, string>} variables */
function doctor(variables) {
  const cwd = realpathSync(mkdtempSync(join(tmpdir(), 'forge-doctor-mcp-')));
  try {
    const { FRAGUA_MCP_PERFIL: _a, FORGE_MCP_PERFIL: _b, ...entorno } = process.env;
    const r = spawnSync(process.execPath, [CLI, 'doctor'], { cwd, env: { ...entorno, ...variables }, encoding: 'utf8', timeout: 120_000 });
    return `${r.stdout}\n${r.stderr}`;
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

test('doctor muestra el perfil verificacion con sus herramientas y límites', () => {
  const t = doctor({ FRAGUA_MCP_PERFIL: 'verificacion' });
  assert.match(t, /MCP: perfil verificacion \(verificar\)/);
  assert.match(t, /por llamada/);
});

test('doctor muestra el perfil por defecto si no se pidió ninguno', () => {
  assert.match(doctor({}), /MCP: perfil completo \(ejecutar_pruebas, leer_archivo, escribir_archivo\)/);
});

test('doctor avisa de un perfil no válido en lugar de aceptarlo', () => {
  const t = doctor({ FRAGUA_MCP_PERFIL: 'otro' });
  assert.match(t, /MCP: perfil no válido en FRAGUA_MCP_PERFIL/);
  assert.doesNotMatch(t, /MCP: perfil otro/);
});
