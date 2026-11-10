// @ts-check
/**
 * Tests para el guard spec→plan con aprobación humana.
 * Verifica que spec_aprobado es obligatorio antes de planificar.
 */

import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

describe("Guard spec→plan — requiere spec_aprobado", () => {
  let core;

  before(async () => {
    const smMod = await import(pathToFileURL(join(ROOT, "core", "state-machine.js")).href);
    const ssMod = await import(pathToFileURL(join(ROOT, "core", "state-store.js")).href);
    const elMod = await import(pathToFileURL(join(ROOT, "core", "event-log.js")).href);
    core = { PipelineStateMachine: smMod.PipelineStateMachine, InMemoryStateStore: ssMod.InMemoryStateStore, EventLog: elMod.EventLog };
  });

  function buildFSM(estadoInicial) {
    const store = new core.InMemoryStateStore();
    store.write({ schemaVersion: "1.0", ultima_actualizacion: new Date().toISOString(), ...estadoInicial });
    const tmpObs = mkdtempSync(join(tmpdir(), "forge-apro-"));
    mkdirSync(join(tmpObs, "observabilidad"), { recursive: true });
    const log = new core.EventLog(join(tmpObs, "observabilidad"));
    return new core.PipelineStateMachine(store, log);
  }

  test("spec→plan bloqueado sin spec_aprobado (con spec_activa)", () => {
    const fsm = buildFSM({ pipeline_step: "spec", spec_activa: "spec-001", spec_aprobado: false });
    const r = fsm.advance("plan");
    assert.ok(!r.ok, "debe fallar sin spec_aprobado");
    assert.match(r.error, /aprobarse|aprobado/i, "mensaje debe mencionar aprobación");
  });

  test("spec→plan bloqueado si spec_aprobado no existe en el estado", () => {
    const fsm = buildFSM({ pipeline_step: "spec", spec_activa: "spec-001" });
    const r = fsm.advance("plan");
    assert.ok(!r.ok, "debe fallar si spec_aprobado es undefined");
  });

  test("spec→plan permitido con spec_activa + spec_aprobado: true", () => {
    const fsm = buildFSM({ pipeline_step: "spec", spec_activa: "spec-001", spec_aprobado: true });
    const r = fsm.advance("plan");
    assert.ok(r.ok, `debe avanzar con spec_aprobado=true: ${r.error}`);
    assert.equal(r.to, "plan");
  });

  test("spec→plan permitido con spec_draft_path + spec_aprobado: true", () => {
    const fsm = buildFSM({ pipeline_step: "spec", spec_draft_path: ".sdd/spec.md", spec_aprobado: true });
    const r = fsm.advance("plan");
    assert.ok(r.ok, `spec_draft_path + spec_aprobado debe desbloquear: ${r.error}`);
  });

  test("spec→plan bloqueado sin spec_activa aunque spec_aprobado=true", () => {
    const fsm = buildFSM({ pipeline_step: "spec", spec_aprobado: true });
    const r = fsm.advance("plan");
    assert.ok(!r.ok, "falta spec_activa o spec_draft_path — debe fallar");
    assert.match(r.error, /spec activa|draft/i);
  });
});

describe("forge aprobar spec — CLI", () => {
  test("avisa cuando no existe .sdd/estado.json", () => {
    const dir = mkdtempSync(join(tmpdir(), "forge-cli-aprobar-"));
    const r = spawnSync(process.execPath, [join(ROOT, "cli", "index.js"), "aprobar", "spec"],
      { cwd: dir, encoding: "utf8" });
    assert.ok(r.stdout.includes("estado.json") || r.stderr.includes("estado.json"),
      "debe mencionar estado.json");
  });

  test("sin terminal real NO escribe spec_aprobado (C-03; el camino con TTY se prueba en aprobaciones-identidad.test.js)", () => {
    const dir = mkdtempSync(join(tmpdir(), "forge-cli-aprobar-ok-"));
    mkdirSync(join(dir, ".sdd"), { recursive: true });
    writeFileSync(join(dir, ".sdd", "estado.json"), JSON.stringify({
      schemaVersion: "1.0",
      pipeline_step: "spec",
      spec_activa: "spec-test-001",
      spec_aprobado: false,
      ultima_actualizacion: new Date().toISOString(),
    }), "utf8");
    mkdirSync(join(dir, ".sdd", "especificaciones", "spec-test-001"), { recursive: true });
    writeFileSync(join(dir, ".sdd", "especificaciones", "spec-test-001", "spec.md"), "# spec\n", "utf8");

    const r = spawnSync(process.execPath, [join(ROOT, "cli", "index.js"), "aprobar", "spec"],
      { cwd: dir, encoding: "utf8", input: "" });

    assert.notEqual(r.status, 0, "sin TTY debe fallar");
    assert.match(r.stderr + r.stdout, /terminal interactivo real/);
    const estadoFinal = JSON.parse(readFileSync(join(dir, ".sdd", "estado.json"), "utf8"));
    assert.equal(estadoFinal.spec_aprobado, false, "spec_aprobado no debe cambiar sin terminal");
  });

  test("una spec con spec_aprobado: true pero sin registro firmado no se da por aprobada (hay que aprobarla de nuevo)", () => {
    const dir = mkdtempSync(join(tmpdir(), "forge-cli-aprobar-idem-"));
    mkdirSync(join(dir, ".sdd", "especificaciones", "spec-001"), { recursive: true });
    writeFileSync(join(dir, ".sdd", "especificaciones", "spec-001", "spec.md"), "# spec\n", "utf8");
    writeFileSync(join(dir, ".sdd", "estado.json"), JSON.stringify({
      schemaVersion: "1.0", pipeline_step: "spec",
      spec_activa: "spec-001", spec_aprobado: true,
      ultima_actualizacion: new Date().toISOString(),
    }), "utf8");

    const r = spawnSync(process.execPath, [join(ROOT, "cli", "index.js"), "aprobar", "spec"],
      { cwd: dir, encoding: "utf8", input: "" });
    assert.notEqual(r.status, 0, "sin terminal real no puede dejar el registro");
    assert.ok(!r.stdout.includes("ya está aprobada"), "no debe darla por buena sin registro verificable");
  });

  test("avisa si no hay spec_activa ni spec_draft_path", () => {
    const dir = mkdtempSync(join(tmpdir(), "forge-cli-aprobar-nospec-"));
    mkdirSync(join(dir, ".sdd"), { recursive: true });
    writeFileSync(join(dir, ".sdd", "estado.json"), JSON.stringify({
      schemaVersion: "1.0", pipeline_step: "design",
      ultima_actualizacion: new Date().toISOString(),
    }), "utf8");

    const r = spawnSync(process.execPath, [join(ROOT, "cli", "index.js"), "aprobar", "spec"],
      { cwd: dir, encoding: "utf8" });
    assert.ok(r.stdout.includes("No hay spec") || r.stdout.includes("spec activa"),
      "debe avisar que no hay spec");
  });
});
