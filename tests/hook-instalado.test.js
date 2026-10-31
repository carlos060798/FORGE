// @ts-check
/**
 * Spec 2026-10-27-flujo-nativo-de-ia: CA-002-03
 * El guardián instalado en un proyecto (`.claude/hooks/`, sin `core/`) sigue protegiendo la configuración de calidad.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("hook instalado en un proyecto", () => {
  test("shared/protegidos.js es una copia autónoma y el guardián instalado bloquea tsconfig.json", () => {
    const proyecto = mkdtempSync(join(tmpdir(), "hook-instalado-"));
    try {
      const init = spawnSync(process.execPath, [join(RAIZ, "cli", "index.js"), "init"], { cwd: proyecto, encoding: "utf8", timeout: 120_000 });
      assert.equal(init.status, 0, init.stdout + init.stderr);

      const copia = join(proyecto, ".claude", "hooks", "shared", "protegidos.js");
      assert.ok(existsSync(copia), "falta shared/protegidos.js");
      const texto = readFileSync(copia, "utf8");
      assert.doesNotMatch(texto, /from\s+['"]\.\.\/\.\.\/core/, "la copia no puede apuntar a core/, que no existe en el proyecto");
      assert.equal(texto, readFileSync(join(RAIZ, "core", "evidencia", "protegidos.js"), "utf8"), "debe ser la fuente");

      const hook = join(proyecto, ".claude", "hooks", "pre-tool-guard.js");
      const evento = (ruta) => JSON.stringify({ tool_name: "Write", tool_input: { file_path: ruta, content: "{}" } });
      const bloqueada = spawnSync(process.execPath, [hook], { cwd: proyecto, input: evento("tsconfig.json"), encoding: "utf8", timeout: 60_000 });
      assert.equal(bloqueada.status, 2, bloqueada.stderr);
      assert.match(bloqueada.stderr, /protegida/);
      const libre = spawnSync(process.execPath, [hook], { cwd: proyecto, input: evento("src/index.js"), encoding: "utf8", timeout: 60_000 });
      assert.equal(libre.status, 0, libre.stderr);
    } finally {
      rmSync(proyecto, { recursive: true, force: true });
    }
  });
});
