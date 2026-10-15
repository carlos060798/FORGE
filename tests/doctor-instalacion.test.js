// @ts-check
/**
 * `forge doctor` informa de la integración y el perfil instalados (spec instalacion-agnostica, RF-06).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const CLI = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'cli', 'index.js');

function doctor(yaml) {
  const cwd = mkdtempSync(join(tmpdir(), 'forge-docinst-'));
  try {
    mkdirSync(join(cwd, '.sdd'), { recursive: true });
    if (yaml !== null) writeFileSync(join(cwd, '.sdd', 'sdd.config.yaml'), yaml);
    const e = { ...process.env };
    delete e.ANTHROPIC_API_KEY; delete e.CLAUDE_API_KEY;
    return spawnSync(process.execPath, [CLI, 'doctor'], { cwd, env: e, encoding: 'utf8', timeout: 100_000 }).stdout;
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

test('sin configuración guardada: dice claude y completo', () => {
  assert.match(doctor(null), /Integración: claude · perfil: completo \(sin configuración guardada\)/);
});

test('con integración y perfil guardados: los informa', () => {
  const s = doctor('instalacion:\n  integracion: "cursor"\n  perfil: "esencial"\n');
  assert.match(s, /Integración: cursor · perfil: esencial/);
});

test('con una clave inválida en el archivo: la avisa sin fiarse de ella', () => {
  const s = doctor('instalacion:\n  integracion: "nada"\n  perfil: "completo"\n');
  assert.match(s, /Integración desconocida/);
});
