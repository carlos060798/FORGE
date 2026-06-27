// @ts-check
/**
 * Tests para Orchestrator._runTests() — verifica que await resuelve
 * el resultado del runner en lugar de devolver una Promise sin resolver.
 */

import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

describe("Orchestrator._runTests() — await correcto", () => {
  let Orchestrator;
  let EventLog;

  before(async () => {
    const mod = await import(pathToFileURL(join(ROOT, "core", "orchestrator.js")).href);
    Orchestrator = mod.Orchestrator;
    const logMod = await import(pathToFileURL(join(ROOT, "core", "event-log.js")).href);
    EventLog = logMod.EventLog;
  });

  function buildOrch(cwd, runner) {
    const log = new EventLog(join(cwd, ".sdd", "observabilidad"));
    // Orchestrator(registry, stateMachine, log, store, options)
    return new Orchestrator(null, null, log, null, { cwd, runner });
  }

  test("resuelve el resultado del runner async (no devuelve Promise)", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "forge-orch-"));
    mkdirSync(join(cwd, ".sdd", "observabilidad"), { recursive: true });

    const fakeRunner = { test: async () => ({ ok: true, exitCode: 0, stdout: "ok", stderr: "" }) };
    const orch = buildOrch(cwd, fakeRunner);

    const result = await orch._runTests();

    assert.ok(!(result instanceof Promise), "_runTests debe devolver el resultado, no una Promise");
    assert.equal(result.ok, true, "resultado.ok debe ser true");
    assert.equal(result.exitCode, 0);
  });

  test("maneja runner que falla sin lanzar excepción al llamador", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "forge-orch-fail-"));
    mkdirSync(join(cwd, ".sdd", "observabilidad"), { recursive: true });

    const fakeRunnerFail = { test: async () => { throw new Error("test suite crashed"); } };
    const orch = buildOrch(cwd, fakeRunnerFail);

    const result = await orch._runTests();

    assert.equal(result.ok, false, "debe capturar el error y devolver ok:false");
    assert.ok(result.stderr.includes("test suite crashed"), "mensaje de error en stderr");
  });

  test("runner síncrono también funciona (compatibilidad)", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "forge-orch-sync-"));
    mkdirSync(join(cwd, ".sdd", "observabilidad"), { recursive: true });

    const fakeRunnerSync = { test: () => ({ ok: true, exitCode: 0, stdout: "sync-ok", stderr: "" }) };
    const orch = buildOrch(cwd, fakeRunnerSync);

    const result = await orch._runTests();
    assert.equal(result.ok, true);
  });
});
