// @ts-check
/**
 * Tests para forge run y forge resume — verifica que el CLI los expone
 * correctamente delegando a core/engine-cli.js.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = resolve(__dirname, "..", "cli", "index.js");

describe("forge run — CLI delega a engine-cli.js", () => {
  test("forge run no imprime 'Comando desconocido'", () => {
    const dir = mkdtempSync(join(tmpdir(), "forge-run-"));
    mkdirSync(join(dir, ".sdd"), { recursive: true });

    const r = spawnSync(process.execPath, [CLI, "run"], { cwd: dir, encoding: "utf8" });

    assert.ok(!r.stderr.includes("Comando desconocido"), `stderr no debe decir Comando desconocido: ${r.stderr}`);
    assert.ok(!r.stdout.includes("Comando desconocido"), `stdout no debe decir Comando desconocido: ${r.stdout}`);
  });

  test("forge run sin tareas termina con mensaje de error útil (no crash)", () => {
    const dir = mkdtempSync(join(tmpdir(), "forge-run-notasks-"));
    mkdirSync(join(dir, ".sdd"), { recursive: true });

    const r = spawnSync(process.execPath, [CLI, "run"], { cwd: dir, encoding: "utf8" });

    // Puede salir con código 1 (error de negocio), pero no con excepción no capturada
    assert.ok(r.status === 0 || r.status === 1, `exit code inesperado: ${r.status}`);
    assert.ok(
      r.stdout.includes("tareas") || r.stdout.includes("plan") || r.stderr.includes("tareas"),
      "debe mencionar tareas o plan en la salida"
    );
  });

  test("forge run con --tasks apuntando a JSON válido inicia ejecución", () => {
    const dir = mkdtempSync(join(tmpdir(), "forge-run-tasks-"));
    mkdirSync(join(dir, ".sdd", "observabilidad"), { recursive: true });

    const tareas = [{
      id: "t001", titulo: "tarea de prueba", agente: "desarrollador-backend",
      estado: "pendiente", dependencias: [],
    }];
    const tareasPath = join(dir, ".sdd", "tareas.json");
    writeFileSync(tareasPath, JSON.stringify(tareas), "utf8");

    const r = spawnSync(
      process.execPath,
      [CLI, "run", "--tasks", tareasPath],
      { cwd: dir, encoding: "utf8", timeout: 10000 }
    );

    assert.ok(!r.stderr.includes("Comando desconocido"), r.stderr);
    // En modo stub (sin API key) debe ejecutar pero con output de stub
    assert.ok(r.status === 0 || r.status === 1, `exit inesperado: ${r.status} ${r.stderr}`);
  });
});

describe("forge resume — CLI delega a engine-cli.js", () => {
  test("forge resume no imprime 'Comando desconocido'", () => {
    const dir = mkdtempSync(join(tmpdir(), "forge-resume-"));
    mkdirSync(join(dir, ".sdd", "observabilidad"), { recursive: true });

    const r = spawnSync(process.execPath, [CLI, "resume"], { cwd: dir, encoding: "utf8" });

    assert.ok(!r.stderr.includes("Comando desconocido"), r.stderr);
    assert.ok(!r.stdout.includes("Comando desconocido"), r.stdout);
  });
});
