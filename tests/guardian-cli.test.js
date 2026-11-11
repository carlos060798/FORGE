// @ts-check
/** Plan docs/PLAN-AGNOSTICO.md, F3: `fragua guardian evaluar` y `fragua memoria registrar`. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, existsSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CLI } from "./instalacion-ayudas.js";
import { agenteActivo } from "../claude-hooks/shared/entorno.js";

const cwd = realpathSync(mkdtempSync(join(tmpdir(), "forge-grd-")));
const limpio = { ...process.env };
for (const k of ["FRAGUA_AGENTE", "FORGE_AGENTE", "CLAUDE_AGENT_NAME"]) delete limpio[k];
function correr(args, entrada, env = {}) {
  const r = spawnSync(process.execPath, [CLI, ...args], { cwd, input: entrada, encoding: "utf8", env: { ...limpio, ...env }, timeout: 60_000 });
  return { codigo: r.status, err: r.stderr ?? "" };
}
const ev = (tool_name, tool_input) => JSON.stringify({ tool_name, tool_input });

describe("fragua guardian evaluar", () => {
  test("permite una acción inocua (0)", () => {
    assert.equal(correr(["guardian", "evaluar"], ev("Bash", { command: "ls" })).codigo, 0);
  });
  test("bloquea un comando destructivo (2) con mensaje", () => {
    const r = correr(["guardian", "evaluar"], ev("Bash", { command: "git reset --hard" }));
    assert.equal(r.codigo, 2);
    assert.ok(r.err.length > 0);
  });
  test("un evento que no es JSON es uso incorrecto (1)", () => {
    assert.equal(correr(["guardian", "evaluar"], "no json").codigo, 1);
  });
  test("subcomando desconocido: 1", () => {
    assert.equal(correr(["guardian", "x"], "").codigo, 1);
  });
  test("FRAGUA_AGENTE activa las guardas de solo lectura", () => {
    const e = ev("Write", { file_path: join(cwd, "a.txt"), content: "x" });
    assert.equal(correr(["guardian", "evaluar"], e, { FRAGUA_AGENTE: "arquitecto" }).codigo, 2);
    assert.equal(correr(["guardian", "evaluar"], e, { CLAUDE_AGENT_NAME: "arquitecto" }).codigo, 2, "respaldo CLAUDE_AGENT_NAME");
  });
});

describe("fragua memoria registrar", () => {
  test("acepta un evento PostToolUse y sale 0", () => {
    const e = JSON.stringify({ tool_name: "Write", tool_input: { file_path: join(cwd, "b.txt"), content: "x" }, tool_response: "ok" });
    assert.equal(correr(["memoria", "registrar"], e, { FRAGUA_AGENTE: "tester" }).codigo, 0);
  });
});

describe("agenteActivo", () => {
  test("prefiere FRAGUA_/FORGE_AGENTE, respalda en CLAUDE_AGENT_NAME y no elige ante conflicto", () => {
    assert.equal(agenteActivo({ FRAGUA_AGENTE: "a" }), "a");
    assert.equal(agenteActivo({ CLAUDE_AGENT_NAME: "b" }), "b");
    assert.equal(agenteActivo({ FRAGUA_AGENTE: "a", CLAUDE_AGENT_NAME: "b" }), "a");
    assert.equal(agenteActivo({ FRAGUA_AGENTE: "a", FORGE_AGENTE: "c", CLAUDE_AGENT_NAME: "b" }), "b");
    assert.equal(agenteActivo({}), "");
  });
});
