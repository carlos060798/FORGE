// @ts-check
/**
 * Red de seguridad de release.
 *
 * Estos tests existen para que los bugs bloqueantes detectados en v2.6.0 NO
 * vuelvan a colarse. Cada bloque corresponde a un bug real:
 *
 *  1. La plantilla settings.json que copia el CLI debe existir donde el CLI la busca.
 *  2. El mapper ejecutable referenciado por /sdd.construir debe existir y cargar.
 *  3. Ningún comando debe invocar rutas inexistentes tipo `node sdd-lite/...`.
 *  4. Cada comando declarado en plugin.json debe tener su archivo .md.
 *  5. La clave del MCP usada en los comandos debe coincidir con .mcp.json.
 *  6. Los archivos listados en package.json `files[]` deben existir.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, mdFiles, readFile } from "./helpers.js";

// ─── 1. Plantilla settings.json donde el CLI la busca ────────────────────────

describe("release-safety — plantilla settings.json del CLI", () => {
  const cli = readFile(join(ROOT, "cli", "index.js"));

  test("cli/index.js busca settings.json en una ruta que existe", () => {
    // Reconstruye la ruta del join(...) de copiarSettings()
    const m = cli.match(/join\(PLUGIN_DIR,\s*([^)]+),\s*"settings\.json"\)/);
    assert.ok(m, "No se encontró el join() de la plantilla settings.json en el CLI");
    const segmentos = m[1]
      .split(",")
      .map((s) => s.trim().replace(/^["']|["']$/g, ""));
    const ruta = join(ROOT, ...segmentos, "settings.json");
    assert.ok(
      existsSync(ruta),
      `El CLI copia settings.json desde ${ruta} pero ese archivo no existe`
    );
  });
});

// ─── 2. Mapper ejecutable de /sdd.construir ──────────────────────────────────

describe("release-safety — mapper IR→spec", () => {
  test("core/ir-to-spec-mapper.js existe y exporta mapIRToSpec", async () => {
    const ruta = join(ROOT, "core", "ir-to-spec-mapper.js");
    assert.ok(existsSync(ruta), "Falta core/ir-to-spec-mapper.js (lo usa /sdd.construir)");
    const mod = await import("../core/ir-to-spec-mapper.js");
    assert.equal(typeof mod.mapIRToSpec, "function", "El mapper no exporta mapIRToSpec");
  });
});

// ─── 3. Ningún comando invoca rutas `sdd-lite/...` ejecutables ───────────────

describe("release-safety — comandos sin rutas ejecutables rotas", () => {
  for (const file of mdFiles("commands")) {
    test(`${file.split(/[\\/]/).pop()} no ejecuta 'node sdd-lite/...'`, () => {
      const c = readFileSync(file, "utf8");
      assert.ok(
        !/node\s+sdd-lite\//.test(c),
        "Referencia a 'node sdd-lite/...' (carpeta inexistente). Usa $CLAUDE_PLUGIN_ROOT/core/"
      );
    });
  }
});

// ─── 4. Cada comando de plugin.json tiene su .md ─────────────────────────────

describe("release-safety — plugin.json ↔ commands/", () => {
  const plugin = JSON.parse(readFile(join(ROOT, ".claude-plugin", "plugin.json")));
  for (const cmd of plugin.commands || []) {
    test(`comando '${cmd}' tiene archivo en commands/`, () => {
      const ruta = join(ROOT, "commands", `${cmd}.md`);
      assert.ok(
        existsSync(ruta),
        `plugin.json declara '${cmd}' pero no existe commands/${cmd}.md`
      );
    });
  }
});

// ─── 5. Nombre del MCP coherente entre comandos y .mcp.json ──────────────────

describe("release-safety — clave del MCP coherente", () => {
  const mcp = JSON.parse(readFile(join(ROOT, ".mcp.json")));
  const claves = Object.keys(mcp.mcpServers || {});

  test("sdd.qa.md referencia una clave de MCP declarada en .mcp.json", () => {
    const qa = readFile(join(ROOT, "commands", "sdd.qa.md"));
    const m = qa.match(/mcpServers\.([a-zA-Z0-9_-]+)/);
    if (!m) return; // no referencia ninguna: nada que validar
    assert.ok(
      claves.includes(m[1]),
      `sdd.qa.md usa mcpServers.${m[1]} pero .mcp.json declara: ${claves.join(", ")}`
    );
  });
});

// ─── 6. files[] de package.json existen ──────────────────────────────────────

describe("release-safety — package.json files[] existen", () => {
  const pkg = JSON.parse(readFile(join(ROOT, "package.json")));
  for (const entry of pkg.files || []) {
    test(`files[] incluye '${entry}' y existe`, () => {
      const ruta = join(ROOT, entry.replace(/\/$/, ""));
      assert.ok(existsSync(ruta), `package.json files[] lista '${entry}' pero no existe`);
    });
  }
});
