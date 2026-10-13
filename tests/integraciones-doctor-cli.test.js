// @ts-check
/**
 * `forge doctor` sin integraciones activas no cambia su salida (HU-005, CA-005-03), y con una
 * activa añade solo su sección, sin red y sin imprimir tokens.
 */

import { test } from 'node:test';
import './fixtures/integraciones/entorno-usuario.mjs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const CLI = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'cli', 'index.js');

function doctor(yaml, env = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'forge-docli-'));
  mkdirSync(join(cwd, '.sdd'), { recursive: true });
  if (yaml !== null) writeFileSync(join(cwd, '.sdd', 'sdd.config.yaml'), yaml);
  const e = { ...process.env, ...env };
  delete e.ANTHROPIC_API_KEY; delete e.CLAUDE_API_KEY;
  const r = spawnSync(process.execPath, [CLI, 'doctor'], { cwd, env: e, encoding: 'utf8', timeout: 100_000 });
  return { salida: r.stdout, cwd };
}
/** Sin la ruta temporal ni lo que depende del proyecto. */
const normal = (/** @type {string} */ s) => s.split('\n').filter((l) => !/forge-docli-/.test(l)).join('\n');

test('doctor sin sección y con todo apagado dan la misma salida, sin nada de integraciones', () => {
  const a = doctor('motor:\n  modo: ciclo\n');
  const b = doctor('motor:\n  modo: ciclo\nintegraciones:\n  github_modo: apagado\n');
  assert.doesNotMatch(a.salida, /integraciones externas/i);
  assert.doesNotMatch(b.salida, /integraciones externas/i);
  // Los títulos de sección (deterministas) son exactamente los mismos y en el mismo orden
  const titulos = (/** @type {string} */ s) => s.split('\n').filter((l) => /Verificando|Diagnosticando|Instalación en/.test(l)).join('\n');
  assert.equal(titulos(a.salida), titulos(b.salida));
  assert.ok(titulos(a.salida).includes('aislamiento'));
});

test('con una integración activa añade su sección y no imprime el token', () => {
  const TOKEN = 'github_pat_' + 'DOCTORCLI9f8e7d6c5b4a39281706f5e4d3c2b1a0';
  const r = doctor('integraciones:\n  github_modo: solo_lectura\n  github_token_env: FORGE_GITHUB_TOKEN\n  github_destinos: org/repo\n', { FORGE_GITHUB_TOKEN: TOKEN });
  assert.match(r.salida, /Verificando integraciones externas/);
  assert.match(r.salida, /FORGE_GITHUB_TOKEN definida/);
  assert.ok(!r.salida.includes(TOKEN));
  assert.ok(normal(r.salida).length > 0);
});
