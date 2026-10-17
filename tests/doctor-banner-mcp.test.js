// @ts-check
/** Banner de `fragua doctor` y de la ayuda con el nombre nuevo, y la línea del perfil MCP. */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = resolve(fileURLToPath(new URL('../cli/index.js', import.meta.url)));

function ejecutar(args, env = {}) {
  const proy = mkdtempSync(join(tmpdir(), 'fragua-doctor-'));
  try {
    const r = spawnSync(process.execPath, [CLI, ...args, ...(args[0] === 'doctor' ? ['--cwd', proy] : [])], {
      cwd: proy, encoding: 'utf8', timeout: 90_000,
      env: { ...process.env, FRAGUA_MCP_PERFIL: undefined, FORGE_MCP_PERFIL: undefined, FRAGUA_MCP_CICLO: undefined, FORGE_MCP_CICLO: undefined, ...env },
    });
    return r.stdout + r.stderr;
  } finally { rmSync(proy, { recursive: true, force: true }); }
}

describe('fragua doctor y ayuda con el nombre nuevo', () => {
  test('el banner y el título dicen Fragua, no FORGE ni SDD-ES', () => {
    const s = ejecutar(['doctor']);
    assert.match(s, /Fragua — Tu equipo técnico en Claude Code/);
    assert.match(s, /Diagnóstico de Fragua/);
    assert.doesNotMatch(s, /FORGE — Tu equipo|Diagnóstico de SDD-ES/);
  });

  test('la ayuda empieza por Fragua y conserva los nombres de los comandos', () => {
    const s = ejecutar(['help']);
    assert.match(s, /Fragua — CLI \(v/);
    assert.match(s, /npx (forge|fragua) init/);
  });

  test('doctor muestra el perfil MCP efectivo y los límites', () => {
    const s = ejecutar(['doctor'], { FRAGUA_MCP_PERFIL: 'verificacion', FRAGUA_MCP_CICLO: 'apagado', FRAGUA_MCP_POR_HORA: '7' });
    const linea = s.split('\n').find((l) => l.includes('MCP')) ?? '';
    assert.match(linea, /perfil verificacion/);
    assert.match(linea, /apagado/);
    assert.match(linea, /7\/hora/);
    assert.match(linea, /300 s/);
  });

  test('doctor con un perfil MCP desconocido lo dice sin romper', () => {
    const s = ejecutar(['doctor'], { FRAGUA_MCP_PERFIL: 'inventado' });
    assert.match(s, /MCP.*no válido/);
  });
});
