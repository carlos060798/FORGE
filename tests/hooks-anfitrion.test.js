// @ts-check
/**
 * Plan docs/PLAN-AGNOSTICO.md, F3: el guardián de Fragua registrado en los hooks de Cursor, Copilot, Gemini y Codex.
 * Los eventos de prueba siguen los campos documentados (spike S0.2, 2026-11-10); no son capturas de una herramienta real.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { ANFITRIONES_CON_HOOK, PLANTILLAS_HOOKS, ordenDeGuardian, rutasDeParche, traducirEvento } from "../core/instalacion/hooks-anfitrion.js";
import { INTEGRACIONES } from "../core/instalacion/herramientas-destino.js";
import { CLI, ROOT, forge } from "./instalacion-ayudas.js";

const temporal = (p) => realpathSync(mkdtempSync(join(tmpdir(), p)));

/** Ejecuta `forge guardian evaluar --anfitrion <x>` con el evento por la entrada estándar. */
function evaluar(anfitrion, evento, cwd = temporal("forge-hk-")) {
  const env = { ...process.env, FORGE_LLM_PROVIDER: "stub", FRAGUA_AGENTE: "", FORGE_AGENTE: "", CLAUDE_AGENT_NAME: "" };
  const r = spawnSync(process.execPath, [CLI, "guardian", "evaluar", "--anfitrion", anfitrion], { cwd, env, input: JSON.stringify(evento), encoding: "utf8", timeout: 60_000 });
  return { codigo: r.status, salida: (r.stdout ?? "") + (r.stderr ?? "") };
}

describe("traducirEvento", () => {
  test("Cursor: shell, lectura y herramienta genérica", () => {
    assert.deepEqual(traducirEvento("cursor", { hook_event_name: "beforeShellExecution", command: "ls", cwd: "." }), [{ tool_name: "Bash", tool_input: { command: "ls" } }]);
    assert.deepEqual(traducirEvento("cursor", { hook_event_name: "beforeReadFile", file_path: "/p/.env" }), [{ tool_name: "Read", tool_input: { file_path: "/p/.env" } }]);
    const g = traducirEvento("cursor", { hook_event_name: "preToolUse", tool_name: "Write", tool_input: { file_path: "a.js", content: "x" } });
    assert.equal(g[0].tool_name, "Write");
    assert.equal(g[0].tool_input.file_path, "a.js");
  });
  test("Copilot: acepta camelCase (toolName/toolArgs) y PascalCase (tool_name/tool_input)", () => {
    const a = traducirEvento("copilot", { toolName: "bash", toolArgs: JSON.stringify({ command: "rm -rf /" }) });
    assert.deepEqual(a, [{ tool_name: "Bash", tool_input: { command: "rm -rf /" } }]);
    const b = traducirEvento("copilot", { hook_event_name: "PreToolUse", tool_name: "edit", tool_input: { path: "x.js", new_string: "y" } });
    assert.equal(b[0].tool_name, "Edit");
    assert.equal(b[0].tool_input.file_path, "x.js");
  });
  test("Gemini: nombres de herramienta propios pasan a los del contrato", () => {
    assert.equal(traducirEvento("gemini", { tool_name: "run_shell_command", tool_input: { command: "ls" } })[0].tool_name, "Bash");
    assert.equal(traducirEvento("gemini", { tool_name: "write_file", tool_input: { file_path: "a", content: "b" } })[0].tool_name, "Write");
    assert.equal(traducirEvento("gemini", { tool_name: "mcp_x_y", tool_input: {} })[0].tool_name, "mcp_x_y", "lo desconocido pasa tal cual");
  });
  test("Codex: apply_patch da un evento de escritura por archivo del parche", () => {
    const parche = "*** Begin Patch\n*** Add File: a.js\n+1\n*** Update File: src/b.js\n@@\n-1\n+2\n*** Delete File: c.js\n*** End Patch";
    assert.deepEqual(rutasDeParche(parche), ["a.js", "src/b.js", "c.js"]);
    const ev = traducirEvento("codex", { tool_name: "apply_patch", tool_input: { command: parche } });
    assert.deepEqual(ev.map((e) => e.tool_input.file_path), ["a.js", "src/b.js", "c.js"]);
    assert.ok(ev.every((e) => e.tool_name === "Write"));
    assert.deepEqual(traducirEvento("codex", { tool_name: "Bash", tool_input: { command: "ls" } }), [{ tool_name: "Bash", tool_input: { command: "ls" } }]);
  });
});

describe("plantillas", () => {
  test("cada anfitrión con hook tiene una plantilla de JSON válido que llama a la orden", () => {
    for (const a of ANFITRIONES_CON_HOOK) {
      const p = PLANTILLAS_HOOKS[a];
      assert.ok(p, a);
      const texto = p.contenido(ordenDeGuardian(a));
      assert.doesNotThrow(() => JSON.parse(texto), a);
      assert.ok(texto.includes(`fragua guardian evaluar --anfitrion ${a}`), a);
      assert.ok(!/\.\./.test(p.ruta) && !p.ruta.startsWith("/"), `${a}: ruta dentro del proyecto`);
    }
  });
  test("Cursor falla cerrado; Gemini y Codex declaran que fallan abierto", () => {
    assert.match(PLANTILLAS_HOOKS.cursor.contenido("x"), /"failClosed": true/);
    assert.match(PLANTILLAS_HOOKS.gemini.nota, /ABIERTO/);
    assert.match(PLANTILLAS_HOOKS.codex.nota, /ABIERTO/);
  });
  test("cada anfitrión con hook es una integración del instalador", () => {
    for (const a of ANFITRIONES_CON_HOOK) assert.ok(Object.hasOwn(INTEGRACIONES, a), a);
  });
});

describe("fragua guardian evaluar --anfitrion", () => {
  test("bloquea un push forzado y deja pasar un ls, en Cursor", () => {
    assert.equal(evaluar("cursor", { hook_event_name: "beforeShellExecution", command: "git push --force origin main", cwd: "." }).codigo, 2);
    assert.equal(evaluar("cursor", { hook_event_name: "beforeShellExecution", command: "ls", cwd: "." }).codigo, 0);
  });
  test("bloquea escribir .env mediante un parche de Codex", () => {
    const r = evaluar("codex", { tool_name: "apply_patch", tool_input: { command: "*** Begin Patch\n*** Update File: .env\n+X=1\n*** End Patch" } });
    assert.equal(r.codigo, 2, r.salida);
  });
  test("bloquea leer .env en Gemini y en Copilot", () => {
    assert.equal(evaluar("gemini", { tool_name: "read_file", tool_input: { file_path: ".env" } }).codigo, 2);
    assert.equal(evaluar("copilot", { toolName: "view", toolArgs: { path: ".env" } }).codigo, 2);
  });
  test("un evento que no es JSON falla cerrado y un anfitrión desconocido es uso incorrecto", () => {
    const env = { ...process.env, FORGE_LLM_PROVIDER: "stub" };
    const mal = spawnSync(process.execPath, [CLI, "guardian", "evaluar", "--anfitrion", "cursor"], { env, input: "{no", encoding: "utf8", timeout: 60_000 });
    assert.equal(mal.status, 2);
    const raro = spawnSync(process.execPath, [CLI, "guardian", "evaluar", "--anfitrion", "nada"], { env, input: "{}", encoding: "utf8", timeout: 60_000 });
    assert.equal(raro.status, 1);
  });
});

describe("forge init --con-hooks", () => {
  test("sin la opción no se escribe ningún hook", () => {
    const cwd = temporal("forge-hk-"), home = temporal("forge-hk-h-");
    assert.equal(forge(cwd, home, "init", "--integracion", "cursor").status, 0);
    assert.ok(!existsSync(join(cwd, ".cursor", "hooks.json")));
  });
  test("con la opción se crea el archivo de cada herramienta, y no se pisa uno existente", () => {
    for (const a of ANFITRIONES_CON_HOOK) {
      const cwd = temporal("forge-hk-"), home = temporal("forge-hk-h-");
      const r = forge(cwd, home, "init", "--integracion", a, "--con-hooks");
      assert.equal(r.status, 0, r.salida);
      const ruta = join(cwd, ...PLANTILLAS_HOOKS[a].ruta.split("/"));
      assert.ok(existsSync(ruta), `${a}: ${PLANTILLAS_HOOKS[a].ruta}`);
      assert.match(readFileSync(ruta, "utf8"), new RegExp(`--anfitrion ${a}`));
      // Un archivo propio del usuario no se toca
      writeFileSync(ruta, '{"mio":true}\n');
      const r2 = forge(cwd, home, "init", "--integracion", a, "--con-hooks");
      assert.equal(r2.status, 0, r2.salida);
      assert.equal(readFileSync(ruta, "utf8"), '{"mio":true}\n', `${a}: no se pisa`);
      assert.match(r2.salida, /no se modifica/);
    }
  });
  test("una herramienta sin adaptador avisa y no escribe nada", () => {
    const cwd = temporal("forge-hk-"), home = temporal("forge-hk-h-");
    const r = forge(cwd, home, "init", "--integracion", "kiro", "--con-hooks");
    assert.equal(r.status, 0, r.salida);
    assert.match(r.salida, /no tiene adaptador de hook/);
  });
});
