// @ts-check
/**
 * Empaquetado del paquete npm (evaluación 2026-10-09): lo que los comandos y skills del plugin mandan
 * ejecutar tiene que viajar en el paquete, y el nombre del comando tiene que existir.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const CLI = join(ROOT, "cli", "index.js");

/** @param {string} dir @returns {string[]} */
function archivosMd(dir) {
  const salida = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) salida.push(...archivosMd(p));
    else if (e.name.endsWith(".md")) salida.push(p);
  }
  return salida;
}

/** ¿La ruta (relativa a la raíz del paquete) entra en `files`? */
function seEmpaqueta(ruta) {
  const incluida = pkg.files.some((f) => !f.startsWith("!") && (f.endsWith("/") ? ruta.startsWith(f) : ruta === f));
  const excluida = pkg.files.some((f) => f.startsWith("!") && ruta === f.slice(1));
  return incluida && !excluida;
}

describe("empaquetado", () => {
  test("todo lo que figura en `files` existe", () => {
    for (const f of pkg.files.filter((x) => !x.startsWith("!"))) {
      assert.ok(existsSync(join(ROOT, f)), `package.json lista "${f}" y no existe`);
    }
  });

  test("las rutas `node <archivo>` de los comandos y skills viajan en el paquete", () => {
    const sinResolver = [];
    for (const dir of ["commands", "skills", "agents"]) {
      for (const md of archivosMd(join(ROOT, dir))) {
        const texto = readFileSync(md, "utf8");
        for (const m of texto.matchAll(/(?:^|[\s`(])node\s+((?:utils|core|cli|bin|scripts|claude-hooks)\/[\w./-]+\.(?:js|mjs|cjs))/gm)) {
          const ruta = m[1];
          if (!existsSync(join(ROOT, ruta)) || !seEmpaqueta(ruta)) sinResolver.push(`${relative(ROOT, md)} → node ${ruta}`);
        }
      }
    }
    assert.deepEqual(sinResolver, [], "estos comandos fallarían en un proyecto con el paquete instalado");
  });

  test("las rutas relativas a utils/ ya no se mandan ejecutar desde los comandos", () => {
    for (const md of [join(ROOT, "commands", "sdd.adr.md"), join(ROOT, "skills", "adr-indexer", "SKILL.md")]) {
      assert.ok(!/node utils\//.test(readFileSync(md, "utf8")), md);
      assert.match(readFileSync(md, "utf8"), /forge adr /);
    }
  });

  test("scripts/test-bus.mjs no se publica y utils/ sí", () => {
    assert.ok(!seEmpaqueta("scripts/test-bus.mjs"));
    assert.ok(seEmpaqueta("utils/adr-parser.js"));
  });

  test("`forge adr` escanea un proyecto y `forge help` y `forge run --help` muestran la ayuda", () => {
    const dir = mkdtempSync(join(tmpdir(), "forge-adr-"));
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src", "a.js"), "// ADR: {\"decision\": \"usar archivos\", \"context\": \"simple\"}\nexport const a = 1;\n");
    const r = spawnSync(process.execPath, [CLI, "adr", dir, "src/**/*.js"], { encoding: "utf8", cwd: dir });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout + r.stderr, /usar archivos|ADR/i);

    for (const args of [["help"], ["run", "--help"]]) {
      const h = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", cwd: dir });
      assert.equal(h.status, 0, args.join(" ") + ": " + h.stderr);
      assert.match(h.stdout, /forge adr/);
    }
  });

  test("el paquete se instala con el nombre y el comando documentados", () => {
    assert.equal(pkg.name, "forja-mvp");
    assert.ok(pkg.bin.forge);
    assert.ok(statSync(join(ROOT, pkg.bin.forge)).isFile());
    assert.match(readFileSync(join(ROOT, pkg.bin.forge), "utf8"), /^#!\/usr\/bin\/env node/);
    assert.match(readFileSync(join(ROOT, "README.md"), "utf8"), /npm install -g forja-mvp/);
  });
});
