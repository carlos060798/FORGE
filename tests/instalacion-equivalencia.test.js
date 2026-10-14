// @ts-check
/**
 * Spec 2026-10-13-instalacion-agnostica, F1.2 / CA-002-01: la «foto» del árbol que producen
 * `forge init` y `forge update` SIN opciones. Se tomó ANTES de tocar `cli/index.js` y debe seguir
 * idéntica: sin opción, sin cambio.
 *
 * La foto es de rutas (no de contenidos): los contenidos de commands/, agents/, skills/ y
 * claude-hooks/ se comparan con su origen en el plugin, para que añadir un comando no rompa la foto.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(ROOT, "cli", "index.js");

/** Rutas estables fuera de las cuatro carpetas copiadas del plugin (foto tomada antes del cambio). */
const FOTO_ESTABLE = [
  ".claude/settings.json",
  ".claudeignore",
  ".sdd/hooks/README.md",
  ".sdd/sdd.config.yaml",
  "AGENTS.md",
  "CLAUDE.md",
  "package.json",
];

const temporal = (p) => realpathSync(mkdtempSync(join(tmpdir(), p)));

/** Ejecuta `forge <args>` con un HOME falso en un proyecto nuevo. */
export function forge(cwd, home, ...args) {
  const env = { ...process.env, HOME: home, USERPROFILE: home, FORGE_LLM_PROVIDER: "stub", ANTHROPIC_API_KEY: "", CLAUDE_API_KEY: "" };
  const r = spawnSync(process.execPath, [CLI, ...args], { cwd, env, encoding: "utf8", timeout: 180_000 });
  return { status: r.status, salida: (r.stdout ?? "") + (r.stderr ?? "") };
}

function proyecto() {
  const d = temporal("forge-eq-");
  writeFileSync(join(d, "package.json"), JSON.stringify({ name: "demo", scripts: { test: "node --test" } }));
  return d;
}

/** Todas las rutas de archivo bajo `dir`, relativas y con `/`. */
function arbol(dir, base = dir) {
  /** @type {string[]} */ const out = [];
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...arbol(p, base)); else out.push(relative(base, p).replaceAll("\\", "/"));
  }
  return out.sort();
}

function esperadoDeClaude() {
  const lista = [];
  for (const f of readdirSync(join(ROOT, "commands"))) if (f.endsWith(".md")) lista.push(`.claude/commands/${f}`);
  for (const f of readdirSync(join(ROOT, "agents"))) if (f.endsWith(".md")) lista.push(`.claude/agents/${f}`);
  for (const e of readdirSync(join(ROOT, "skills"), { withFileTypes: true })) {
    if (e.isFile() && e.name.endsWith(".md")) lista.push(`.claude/skills/${e.name}`);
    else if (e.isDirectory()) for (const r of arbol(join(ROOT, "skills", e.name))) lista.push(`.claude/skills/${e.name}/${r}`);
  }
  for (const e of readdirSync(join(ROOT, "claude-hooks"), { withFileTypes: true })) {
    if (e.isDirectory()) for (const r of arbol(join(ROOT, "claude-hooks", e.name))) lista.push(`.claude/hooks/${e.name}/${r}`);
    else if (/\.(js|sh)$/.test(e.name)) lista.push(`.claude/hooks/${e.name}`);
  }
  return lista;
}

describe("CA-002-01 — forge init/update sin opciones: el árbol no cambia", () => {
  for (const args of [[], ["--integracion", "claude"], ["--integracion", "claude", "--perfil", "completo"]]) {
    test(`init + update ${JSON.stringify(args)} producen el árbol de la foto`, () => {
      const home = temporal("forge-eq-home-"), cwd = proyecto();
      const r1 = forge(cwd, home, "init", ...args);
      assert.equal(r1.status, 0, r1.salida);
      const r2 = forge(cwd, home, "update", ...args);
      assert.equal(r2.status, 0, r2.salida);

      const todas = arbol(cwd);
      const claude = todas.filter((r) => /^\.claude\/(commands|agents|skills|hooks)\//.test(r));
      assert.deepEqual(claude, esperadoDeClaude().sort(), "las cuatro carpetas de .claude coinciden con el plugin");
      const estables = todas.filter((r) => !/^\.claude\/(commands|agents|skills|hooks)\//.test(r) && !r.startsWith(".sdd/docs/") && !r.startsWith(".sdd/plantillas/"));
      assert.deepEqual(estables, FOTO_ESTABLE);
      // contenido: los comandos copiados son los del plugin, byte a byte
      for (const f of readdirSync(join(ROOT, "commands")).filter((x) => x.endsWith(".md"))) {
        assert.equal(readFileSync(join(cwd, ".claude", "commands", f), "utf8"), readFileSync(join(ROOT, "commands", f), "utf8"));
      }
      // sin opciones no hay carpetas de otras herramientas
      for (const otra of [".agents", ".github", ".cursor", ".gemini", ".devin", ".opencode", ".kiro"]) assert.ok(!existsSync(join(cwd, otra)), otra);
    });
  }
});
