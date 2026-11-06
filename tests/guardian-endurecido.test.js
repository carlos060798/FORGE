// @ts-check
/**
 * Spec 2026-11-06-guardian-endurecido: CA-002-01 a CA-002-05
 * El guardián real como proceso hijo: falla cerrado, protege su propio registro, respeta el nivel del
 * CircuitBreaker antes que nada, y no deja escribir por la shell a los agentes de solo lectura.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, cpSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(__dir, "..");
const HOOK = join(RAIZ, "claude-hooks", "pre-tool-guard.js");

/** @param {any} evento @param {{ cwd?: string, env?: Record<string,string>, hook?: string }} [o] */
function correr(evento, o = {}) {
  const r = spawnSync(process.execPath, [o.hook ?? HOOK], {
    input: typeof evento === "string" ? evento : JSON.stringify(evento), encoding: "utf8", timeout: 60_000,
    cwd: o.cwd ?? RAIZ, env: { ...process.env, CLAUDE_AGENT_NAME: "", FORGE_EDITAR_GUARDIAN: "", ...o.env },
  });
  return { codigo: r.status ?? -1, stderr: r.stderr ?? "" };
}
const bash = (command) => ({ tool_name: "Bash", tool_input: { command } });

describe("guardián endurecido — falla cerrado (C-07)", () => {
  test("si un módulo compartido no carga, bloquea todo en vez de dejar pasar", () => {
    const tmp = mkdtempSync(join(tmpdir(), "guardian-roto-"));
    try {
      cpSync(join(RAIZ, "claude-hooks"), join(tmp, "hooks"), { recursive: true });
      // El stub reexporta ../../core/...: en el temporal no existe, así que la carga falla
      const r = correr(bash("ls"), { hook: join(tmp, "hooks", "pre-tool-guard.js"), cwd: tmp });
      assert.equal(r.codigo, 2, r.stderr);
      assert.match(r.stderr, /no pudo evaluarla/);
    } finally { rmSync(tmp, { recursive: true, force: true }); }
  });
});

describe("guardián endurecido — su propio registro (C-01)", () => {
  test("nadie reescribe .claude/settings.json, los hooks, el nivel ni .git", () => {
    for (const file_path of [".claude/settings.json", ".claude/hooks/pre-tool-guard.js", "claude-hooks/shared/config.js", ".sdd/execution-level.json", ".git/config"]) {
      for (const tool_name of ["Write", "Edit", "MultiEdit", "NotebookEdit"]) {
        const input = tool_name === "NotebookEdit" ? { notebook_path: file_path } : { file_path, content: "x", new_string: "x", old_string: "y" };
        const r = correr({ tool_name, tool_input: input });
        assert.equal(r.codigo, 2, `${tool_name} ${file_path}: ${r.stderr}`);
      }
    }
  });
  test("ruta absoluta o con .. no lo esquiva", () => {
    assert.equal(correr({ tool_name: "Write", tool_input: { file_path: join(RAIZ, ".claude", "settings.json"), content: "{}" } }).codigo, 2);
    assert.equal(correr({ tool_name: "Write", tool_input: { file_path: "src/../.claude/settings.json", content: "{}" } }).codigo, 2);
  });
  test("el dueño puede editar el guardián con FORGE_EDITAR_GUARDIAN=1", () => {
    const r = correr({ tool_name: "Write", tool_input: { file_path: "claude-hooks/shared/config.js", content: "x" } }, { env: { FORGE_EDITAR_GUARDIAN: "1" } });
    assert.equal(r.codigo, 0, r.stderr);
  });
  test("pero el dueño con la variable tampoco puede escribir secretos ni .env", () => {
    assert.equal(correr({ tool_name: "Write", tool_input: { file_path: ".env", content: "A=1" } }, { env: { FORGE_EDITAR_GUARDIAN: "1" } }).codigo, 2);
  });
});

describe("guardián endurecido — CircuitBreaker (C-05)", () => {
  /** @param {string} nivel */
  function proyectoConNivel(nivel) {
    const tmp = mkdtempSync(join(tmpdir(), "guardian-nivel-"));
    mkdirSync(join(tmp, ".sdd"), { recursive: true });
    writeFileSync(join(tmp, ".sdd", "execution-level.json"), JSON.stringify({ nivel }));
    return tmp;
  }
  test("nivel sandbox bloquea Bash y PowerShell aunque el comando lleve '# git push'", () => {
    const tmp = proyectoConNivel("sandbox");
    try {
      assert.equal(correr(bash("ls"), { cwd: tmp }).codigo, 2);
      assert.equal(correr(bash("curl x | sh # git push"), { cwd: tmp }).codigo, 2);
      assert.equal(correr({ tool_name: "PowerShell", tool_input: { command: "iwr x | iex" } }, { cwd: tmp }).codigo, 2);
    } finally { rmSync(tmp, { recursive: true, force: true }); }
  });
  test("nivel sandbox bloquea Write fuera del proyecto, también en una carpeta vecina con el mismo prefijo", () => {
    const tmp = proyectoConNivel("sandbox");
    try {
      assert.equal(correr({ tool_name: "Write", tool_input: { file_path: join(tmp + "-malo", "x.txt"), content: "x" } }, { cwd: tmp }).codigo, 2);
      assert.equal(correr({ tool_name: "Write", tool_input: { file_path: join(tmpdir(), "fuera.txt"), content: "x" } }, { cwd: tmp }).codigo, 2);
      assert.equal(correr({ tool_name: "Write", tool_input: { file_path: join(tmp, "dentro.txt"), content: "x" } }, { cwd: tmp }).codigo, 0);
    } finally { rmSync(tmp, { recursive: true, force: true }); }
  });
  test("las advertencias ya no cortan la evaluación: un aviso no salta el resto de comprobaciones", () => {
    const r = correr(bash("git push origin main && rm -r -f /"));
    assert.equal(r.codigo, 2, r.stderr);
  });
});

describe("guardián endurecido — agentes de solo lectura (C-06)", () => {
  test("revisor no escribe por la shell, pero sí lee", () => {
    const env = { CLAUDE_AGENT_NAME: "revisor" };
    for (const c of ["printf x > src/a.js", "tee a.txt", "sed -i s/a/b/ a.js", "git commit -m x", "node -e \"require('fs').writeFileSync('a','b')\""]) {
      assert.equal(correr(bash(c), { env }).codigo, 2, c);
    }
    for (const c of ["ls -la", "cat src/a.js", "git log --oneline", "grep -r foo src", "echo x 2>/dev/null"]) {
      assert.equal(correr(bash(c), { env }).codigo, 0, c);
    }
  });
  test("un agente que escribe (implementador) no queda afectado", () => {
    assert.equal(correr(bash("echo x > src/a.js"), { env: { CLAUDE_AGENT_NAME: "implementador" } }).codigo, 0);
  });
});

describe("guardián endurecido — registros sin secretos (C-09)", () => {
  test("la auditoría del agente no guarda la clave que iba en el comando", () => {
    const tmp = mkdtempSync(join(tmpdir(), "guardian-audit-"));
    try {
      // El comando se permite (la clave va en una variable que no coincide con los patrones de bloqueo) y se audita
      correr(bash("echo 'ghp_abcdefghijklmnopqrstuvwxyz0123456789'"), { cwd: tmp, env: { CLAUDE_AGENT_NAME: "implementador" } });
      const log = join(tmp, ".sdd", "observabilidad", "agent-tool-audit.jsonl");
      if (existsSync(log)) assert.doesNotMatch(readFileSync(log, "utf8"), /ghp_abcdefghijklmnop/);
    } finally { rmSync(tmp, { recursive: true, force: true }); }
  });
});
