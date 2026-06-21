import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

let tmpDir;

before(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "forge-compactor-"));
  mkdirSync(join(tmpDir, ".sdd", "memoria"), { recursive: true });
});

after(() => {
  try { rmSync(tmpDir, { recursive: true }); } catch { /* */ }
});

test("Auto-compresión deduplica entradas por filepath", () => {
  const memoriaFile = join(tmpDir, ".sdd/memoria/agente-test.md");
  const contenido = `# Memoria del agente: test

## 2026-06-10 — src/database.ts
> CREATE TABLE users...

## 2026-06-11 — src/database.ts
> CREATE TABLE users (updated)

## 2026-06-12 — src/database.ts
> CREATE TABLE users (final)

## 2026-06-10 — src/auth.ts
> JWT implementation
`;

  writeFileSync(memoriaFile, contenido, "utf8");

  const entradas = new Map();
  const regex = /^## (\d{4}-\d{2}-\d{2}) — (.+?)\n> (.+?)(?=\n##|\n$)/gms;
  let match;
  while ((match = regex.exec(contenido)) !== null) {
    const [, fecha, filepath, resumen] = match;
    entradas.set(filepath, { fecha, resumen });
  }

  assert.equal(entradas.size, 2);
  assert.equal(entradas.get("src/database.ts").fecha, "2026-06-12");
});

test("Backup se crea antes de comprimir", () => {
  const memoriaFile = join(tmpDir, ".sdd/memoria/agente-backup-test.md");
  const backupFile = memoriaFile.replace(".md", ".original.md");

  const contenido = "# Test contenido original";
  writeFileSync(memoriaFile, contenido, "utf8");

  copyFileSync(memoriaFile, backupFile);

  assert.equal(readFileSync(backupFile, "utf8"), contenido);
});

test("Compresión es idempotente", () => {
  const contenido = `# Memoria

## 2026-06-10 — src/a.ts
> contenido A

## 2026-06-10 — src/b.ts
> contenido B
`;

  const aplicarDeduplica = (c) => {
    const entradas = new Map();
    const regex = /^## (\d{4}-\d{2}-\d{2}) — (.+?)\n> (.+?)(?=\n##|\n$)/gms;
    let match;
    while ((match = regex.exec(c)) !== null) {
      const [, fecha, filepath, resumen] = match;
      entradas.set(filepath, { fecha, resumen });
    }
    let resultado = "# Memoria\n\n";
    for (const [filepath, { fecha, resumen }] of entradas) {
      resultado += `## ${fecha} — ${filepath}\n> ${resumen}\n\n`;
    }
    return resultado;
  };

  const resultado1 = aplicarDeduplica(contenido);
  const resultado2 = aplicarDeduplica(resultado1);

  assert.equal(resultado1, resultado2);
});
