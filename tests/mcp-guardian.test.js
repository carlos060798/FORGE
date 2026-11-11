// @ts-check
/**
 * Herramienta MCP `guardian_evaluar` (plan docs/PLAN-AGNOSTICO.md, F3): consultiva, en un perfil propio `guardian`.
 * `completo` y `verificacion` no cambian (lo fijan tests/mcp-verificar.test.js y tests/doctor-mcp-perfil.test.js).
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { PERFILES, aplicarPerfil, resolverPerfil } from "../core/mcp/perfiles.js";
import { crearHerramientaGuardian } from "../core/mcp/herramientas-guardian.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(ROOT, "cli", "index.js");
const temporal = () => realpathSync(mkdtempSync(join(tmpdir(), "forge-mcp-g-")));
const ENV = { FRAGUA_AGENTE: "", FORGE_AGENTE: "", CLAUDE_AGENT_NAME: "" };
const cuerpo = (r) => JSON.parse(r.texto);

describe("perfil guardian", () => {
  test("expone solo guardian_evaluar; completo y verificacion no cambian", () => {
    assert.deepEqual([...PERFILES.guardian], ["guardian_evaluar"]);
    assert.deepEqual([...PERFILES.completo], ["ejecutar_pruebas", "leer_archivo", "escribir_archivo"]);
    assert.deepEqual([...PERFILES.verificacion], ["verificar"]);
    assert.equal(resolverPerfil({ argumento: "guardian", env: {} }).perfil, "guardian");
  });
  test("aplicarPerfil exige exactamente esa herramienta", () => {
    const h = crearHerramientaGuardian({ cwd: temporal(), env: ENV });
    assert.equal(aplicarPerfil([h], "guardian").length, 1);
    assert.deepEqual(aplicarPerfil([h, { ...h, name: "otra" }], "guardian").map((x) => x.name), ["guardian_evaluar"], "lo que no está en la lista no se expone");
    assert.throws(() => aplicarPerfil([{ ...h, name: "otra" }], "guardian"), /exige exactamente/);
  });
});

describe("guardian_evaluar", () => {
  const herramienta = () => crearHerramientaGuardian({ cwd: temporal(), env: ENV });

  test("la descripción dice que es consultiva y no una barrera", () => {
    const d = herramienta().description;
    assert.match(d, /CONSULTIVA/);
    assert.match(d, /no es una barrera/);
    assert.match(d, /no gasta/);
  });
  test("el esquema es cerrado: sin agente, sin cwd, campos acotados", () => {
    const e = herramienta().inputSchema;
    assert.equal(e.additionalProperties, false);
    assert.deepEqual(Object.keys(e.properties).sort(), ["tool_input", "tool_name"]);
    assert.equal(e.properties.tool_input.additionalProperties, false);
    assert.ok(e.properties.tool_input.properties.content.maxLength > 0);
    assert.ok(e.properties.tool_input.properties.command.maxLength > 0);
  });
  test("permite un comando inocente y bloquea un push forzado, con motivo", async () => {
    const h = herramienta();
    const ok = cuerpo(await h.ejecutar({ tool_name: "Bash", tool_input: { command: "ls" } }));
    assert.equal(ok.decision, "permitir");
    const no = await h.ejecutar({ tool_name: "Bash", tool_input: { command: "git push --force origin main" } });
    assert.equal(no.error, false, "bloquear es una respuesta válida, no un fallo de la herramienta");
    assert.equal(cuerpo(no).decision, "bloquear");
    assert.equal(cuerpo(no).codigo, 2);
    assert.match(cuerpo(no).motivo, /push/);
  });
  test("bloquea leer y escribir secretos", async () => {
    const h = herramienta();
    assert.equal(cuerpo(await h.ejecutar({ tool_name: "Read", tool_input: { file_path: ".env" } })).decision, "bloquear");
    assert.equal(cuerpo(await h.ejecutar({ tool_name: "Write", tool_input: { file_path: ".env", content: "X=1" } })).decision, "bloquear");
  });
  test("rechaza lo que no es del contrato sin evaluar nada", async () => {
    const h = herramienta();
    for (const args of [
      { tool_name: "Teleport", tool_input: {} },
      { tool_name: "Bash", tool_input: { command: 5 } },
      { tool_name: "Bash", tool_input: { agente: "x", command: "ls" } },
      { tool_name: "Bash", tool_input: { command: "a\0b" } },
      { tool_name: "Bash", tool_input: [] },
      { tool_name: "Bash" },
    ]) {
      const r = await h.ejecutar(args);
      assert.equal(r.error, true, JSON.stringify(args));
      assert.equal(cuerpo(r).decision, "no_evaluada");
    }
  });
  test("si el guardián no se puede ejecutar, no permite (falla cerrado)", async () => {
    const h = crearHerramientaGuardian({ cwd: temporal(), env: ENV, ejecutarHook: () => ({ codigo: 2, stderr: "FORGE detuvo esta acción: falta el guardián" }) });
    const r = cuerpo(await h.ejecutar({ tool_name: "Bash", tool_input: { command: "ls" } }));
    assert.equal(r.decision, "bloquear");
    const raro = crearHerramientaGuardian({ cwd: temporal(), env: ENV, ejecutarHook: () => ({ codigo: 7, stderr: "" }) });
    assert.equal(cuerpo(await raro.ejecutar({ tool_name: "Bash", tool_input: { command: "ls" } })).decision, "bloquear", "cualquier código distinto de 0 no permite");
  });
  test("el motivo se acota", async () => {
    const h = crearHerramientaGuardian({ cwd: temporal(), env: ENV, ejecutarHook: () => ({ codigo: 2, stderr: "x".repeat(50_000) }) });
    assert.ok(cuerpo(await h.ejecutar({ tool_name: "Bash", tool_input: { command: "ls" } })).motivo.length <= 2000);
  });
  test("la identidad sale del entorno del usuario: un agente de solo lectura no puede escribir", async () => {
    const h = crearHerramientaGuardian({ cwd: temporal(), env: { CLAUDE_AGENT_NAME: "", FRAGUA_AGENTE: "revisor" } });
    const r = cuerpo(await h.ejecutar({ tool_name: "Write", tool_input: { file_path: "src/a.js", content: "x" } }));
    assert.equal(r.decision, "bloquear");
  });
});

describe("fragua mcp --perfil guardian (proceso real)", () => {
  /** @param {object[]} mensajes @param {string[]} args */
  function conversar(mensajes, args = ["mcp", "--perfil", "guardian"]) {
    return new Promise((res, rej) => {
      const proc = spawn(process.execPath, [CLI, ...args], { cwd: temporal(), env: { ...process.env, ...ENV, FRAGUA_ESTADO_DIR: temporal(), FORGE_ESTADO_DIR: temporal() }, stdio: ["pipe", "pipe", "pipe"] });
      let salida = "";
      const t = setTimeout(() => { proc.kill(); rej(new Error("sin respuesta")); }, 60_000);
      proc.stdout.on("data", (d) => (salida += d));
      proc.on("close", () => { clearTimeout(t); res(salida.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l))); });
      for (const m of mensajes) proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", ...m }) + "\n");
      proc.stdin.end();
    });
  }
  const INIT = { id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "prueba", version: "1" } } };

  test("lista solo guardian_evaluar y bloquea un push forzado", async () => {
    const r = await conversar([
      INIT,
      { method: "notifications/initialized" },
      { id: 2, method: "tools/list" },
      { id: 3, method: "tools/call", params: { name: "guardian_evaluar", arguments: { tool_name: "Bash", tool_input: { command: "git push --force origin main" } } } },
      { id: 4, method: "tools/call", params: { name: "verificar", arguments: {} } },
    ]);
    const porId = (id) => r.find((m) => m.id === id);
    assert.match(porId(1).result.instructions, /CONSULTIVA/);
    assert.deepEqual(porId(2).result.tools.map((t) => t.name), ["guardian_evaluar"]);
    assert.equal(JSON.parse(porId(3).result.content[0].text).decision, "bloquear");
    assert.ok(porId(4).error || porId(4).result?.isError, "las herramientas de otros perfiles no existen aquí");
  });
  test("un perfil desconocido no arranca", async () => {
    const r = await conversar([INIT], ["mcp", "--perfil", "guardia"]).catch(() => []);
    assert.ok(!r.some((m) => m.result?.serverInfo), "no responde initialize");
  });
});
