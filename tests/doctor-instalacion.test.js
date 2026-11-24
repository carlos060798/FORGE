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

function doctor(yaml, { path } = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'forge-docinst-'));
  try {
    mkdirSync(join(cwd, '.sdd'), { recursive: true });
    if (yaml !== null) writeFileSync(join(cwd, '.sdd', 'sdd.config.yaml'), yaml);
    const e = { ...process.env };
    delete e.ANTHROPIC_API_KEY; delete e.CLAUDE_API_KEY;
    if (path !== undefined) { e.PATH = path; e.Path = path; }
    return spawnSync(process.execPath, [CLI, 'doctor'], { cwd, env: e, encoding: 'utf8', timeout: 100_000 }).stdout;
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

/** Un PATH con una carpeta que solo contiene `fragua` (y `fragua.cmd`), para simular que la orden está instalada. */
function pathConFragua() {
  const dir = mkdtempSync(join(tmpdir(), 'forge-path-'));
  writeFileSync(join(dir, 'fragua'), '#!/bin/sh\n');
  writeFileSync(join(dir, 'fragua.cmd'), '@echo off\n');
  return dir;
}

test('sin configuración guardada: dice claude y esencial (perfil por defecto, ADR-24)', () => {
  assert.match(doctor(null), /Integración: claude · perfil: esencial \(sin configuración guardada\)/);
});

test('con integración y perfil guardados: los informa', () => {
  const s = doctor('instalacion:\n  integracion: "cursor"\n  perfil: "esencial"\n');
  assert.match(s, /Integración: cursor · perfil: esencial/);
});

test('con una clave inválida en el archivo: la avisa sin fiarse de ella', () => {
  const s = doctor('instalacion:\n  integracion: "nada"\n  perfil: "completo"\n');
  assert.match(s, /Integración desconocida/);
});

// Auditoría 2026-11-11: los hooks de otras herramientas ejecutan `fragua` por el PATH; si falta, Cursor bloquea
// todo y Codex, Gemini y Windsurf dejan pasar todo sin avisar. `doctor` lo tiene que decir.
test('con hooks instalados y sin `fragua` en el PATH: avisa de que el guardián no funcionará', () => {
  const s = doctor('instalacion:\n  integracion: "codex"\n  perfil: "esencial"\n  con_hooks: true\n', { path: tmpdir() });
  assert.match(s, /fragua.*no está en el PATH/i);
  assert.match(s, /npm install -g/);
});

test('con hooks instalados y `fragua` en el PATH: lo confirma', () => {
  const dir = pathConFragua();
  try {
    const s = doctor('instalacion:\n  integracion: "cursor"\n  perfil: "esencial"\n  con_hooks: true\n', { path: dir });
    assert.match(s, /`fragua` en el PATH/);
    assert.doesNotMatch(s, /no está en el PATH/i);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('sin hooks instalados no se comprueba el PATH', () => {
  const s = doctor('instalacion:\n  integracion: "codex"\n  perfil: "esencial"\n', { path: tmpdir() });
  assert.doesNotMatch(s, /no está en el PATH/i);
});
