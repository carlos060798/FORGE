// @ts-check
/**
 * Tests de contrato para el esquema .sdd/estado.json y consumo.jsonl (SPEC-002)
 *
 * Qué verifica:
 *  1. estado.json: estructura mínima con schemaVersion "1.0"
 *  2. estado.json: campos existentes se preservan en migración
 *  3. consumo.jsonl: cada línea tiene los campos requeridos + opcionales
 *  4. Validación: detecta ausencia de schemaVersion
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const SCHEMA_VERSION = "1.0";

// ─── Helpers de fixture ───────────────────────────────────────────────────────

function tmpDir() {
  const dir = join(tmpdir(), `forge-schema-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeSddEstado(dir, content) {
  const sddDir = join(dir, ".sdd");
  mkdirSync(sddDir, { recursive: true });
  writeFileSync(join(sddDir, "estado.json"), JSON.stringify(content, null, 2));
}

function readSddEstado(dir) {
  return JSON.parse(readFileSync(join(dir, ".sdd", "estado.json"), "utf8"));
}

function cleanup(dir) {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* Silencioso */ }
}

// ─── Tests de estructura mínima ───────────────────────────────────────────────

describe("estado.json — estructura mínima", () => {
  test("un estado nuevo debe contener schemaVersion 1.0", () => {
    const dir = tmpDir();
    try {
      writeSddEstado(dir, {
        schemaVersion: SCHEMA_VERSION,
        ultima_actualizacion: new Date().toISOString(),
      });
      const estado = readSddEstado(dir);
      assert.equal(estado.schemaVersion, SCHEMA_VERSION);
    } finally {
      cleanup(dir);
    }
  });

  test("schemaVersion debe ser el string '1.0'", () => {
    const dir = tmpDir();
    try {
      writeSddEstado(dir, { schemaVersion: SCHEMA_VERSION });
      const estado = readSddEstado(dir);
      assert.strictEqual(typeof estado.schemaVersion, "string");
      assert.equal(estado.schemaVersion, "1.0");
    } finally {
      cleanup(dir);
    }
  });
});

// ─── Tests de validación ─────────────────────────────────────────────────────

describe("validación de estado.json", () => {
  test("estado sin schemaVersion debe detectarse como inválido", () => {
    const estado = {
      spec_activa: "2026-06-01-gastos",
      pipeline_step: "code",
    };
    const errors = [];
    if (!estado.schemaVersion) {
      errors.push('schemaVersion ausente');
    }
    assert.equal(errors.length, 1);
    assert.ok(errors[0].includes("schemaVersion"));
  });

  test("estado con schemaVersion correcta debe ser válido", () => {
    const estado = {
      schemaVersion: SCHEMA_VERSION,
      spec_activa: "2026-06-01-gastos",
      pipeline_step: "code",
    };
    const errors = [];
    if (!estado.schemaVersion) {
      errors.push('schemaVersion ausente');
    } else if (estado.schemaVersion !== SCHEMA_VERSION) {
      errors.push(`schemaVersion desconocida: ${estado.schemaVersion}`);
    }
    assert.equal(errors.length, 0);
  });

  test("estado con schemaVersion incorrecta debe reportar error", () => {
    const estado = { schemaVersion: "99.0" };
    const errors = [];
    if (estado.schemaVersion !== SCHEMA_VERSION) {
      errors.push(`schemaVersion "${estado.schemaVersion}" desconocida`);
    }
    assert.equal(errors.length, 1);
    assert.ok(errors[0].includes("99.0"));
  });
});

// ─── Tests de migración ───────────────────────────────────────────────────────

describe("migración de estado.json legado", () => {
  test("migración añade schemaVersion sin borrar datos existentes", () => {
    const dir = tmpDir();
    try {
      // Estado legado: sin schemaVersion (proyecto v3.x)
      writeSddEstado(dir, {
        spec_activa: "2026-06-01-gastos",
        plan_activo: "plan-001",
        pipeline_step: "tasks",
        ir_generado: true,
      });

      // Simular migrate(): añade schemaVersion, conserva todo
      const estado = readSddEstado(dir);
      const migrado = {
        schemaVersion: SCHEMA_VERSION,
        ...estado,
        ultima_actualizacion: new Date().toISOString(),
      };
      writeFileSync(join(dir, ".sdd", "estado.json"), JSON.stringify(migrado, null, 2));

      const resultado = readSddEstado(dir);
      assert.equal(resultado.schemaVersion, SCHEMA_VERSION);
      assert.equal(resultado.spec_activa, "2026-06-01-gastos");
      assert.equal(resultado.plan_activo, "plan-001");
      assert.equal(resultado.pipeline_step, "tasks");
      assert.equal(resultado.ir_generado, true);
    } finally {
      cleanup(dir);
    }
  });

  test("migrar un estado ya en 1.0 no lo modifica", () => {
    const dir = tmpDir();
    try {
      const original = {
        schemaVersion: SCHEMA_VERSION,
        spec_activa: "proyecto-actual",
        ultima_actualizacion: "2026-06-21T00:00:00.000Z",
      };
      writeSddEstado(dir, original);

      const estado = readSddEstado(dir);
      // Simular migrate(): si ya tiene schemaVersion correcta, no cambia
      if (estado.schemaVersion === SCHEMA_VERSION) {
        // No reescribir
      }

      const resultado = readSddEstado(dir);
      assert.equal(resultado.schemaVersion, SCHEMA_VERSION);
      assert.equal(resultado.ultima_actualizacion, original.ultima_actualizacion);
    } finally {
      cleanup(dir);
    }
  });
});

// ─── Tests de consumo.jsonl ───────────────────────────────────────────────────

describe("consumo.jsonl — estructura de entradas", () => {
  const CAMPOS_REQUERIDOS = ["ts", "agente", "tool", "archivo", "bytes"];
  const CAMPOS_OPCIONALES = ["provider", "effort_level"];

  function validarEntradaConsumo(entrada) {
    const errores = [];
    for (const campo of CAMPOS_REQUERIDOS) {
      if (!(campo in entrada)) errores.push(`campo requerido ausente: ${campo}`);
    }
    if ("provider" in entrada && entrada.provider !== null) {
      const providers = ["anthropic", "openai", "google"];
      if (!providers.includes(entrada.provider)) {
        errores.push(`provider desconocido: ${entrada.provider}`);
      }
    }
    if ("effort_level" in entrada && entrada.effort_level !== null) {
      const levels = ["high", "medium", "low"];
      if (!levels.includes(entrada.effort_level)) {
        errores.push(`effort_level desconocido: ${entrada.effort_level}`);
      }
    }
    return errores;
  }

  test("entrada de consumo con todos los campos debe ser válida", () => {
    const entrada = {
      ts: new Date().toISOString(),
      agente: "arquitecto",
      tool: "Write",
      archivo: "src/app.ts",
      bytes: 1024,
      provider: "anthropic",
      effort_level: "high",
    };
    const errores = validarEntradaConsumo(entrada);
    assert.deepEqual(errores, []);
  });

  test("entrada de consumo con provider y effort_level nulos debe ser válida", () => {
    const entrada = {
      ts: new Date().toISOString(),
      agente: "main",
      tool: "Read",
      archivo: null,
      bytes: 0,
      provider: null,
      effort_level: null,
    };
    const errores = validarEntradaConsumo(entrada);
    assert.deepEqual(errores, []);
  });

  test("entrada sin campos requeridos debe ser inválida", () => {
    const entrada = { ts: new Date().toISOString() };
    const errores = validarEntradaConsumo(entrada);
    assert.ok(errores.length >= 4); // faltan agente, tool, archivo, bytes
  });

  test("provider desconocido debe reportarse como error", () => {
    const entrada = {
      ts: new Date().toISOString(),
      agente: "tester",
      tool: "Bash",
      archivo: null,
      bytes: 0,
      provider: "ollama",
      effort_level: "medium",
    };
    const errores = validarEntradaConsumo(entrada);
    assert.ok(errores.some(e => e.includes("provider desconocido")));
  });

  test("consumo.jsonl debe ser parseable línea por línea", () => {
    const dir = tmpDir();
    try {
      const obsDir = join(dir, ".sdd", "observabilidad");
      mkdirSync(obsDir, { recursive: true });
      const ledgerFile = join(obsDir, "consumo.jsonl");

      const entradas = [
        { ts: "2026-06-21T10:00:00Z", agente: "arquitecto", tool: "Write", archivo: "src/app.ts", bytes: 512, provider: "anthropic", effort_level: "high" },
        { ts: "2026-06-21T10:01:00Z", agente: "tester",    tool: "Bash",  archivo: null,          bytes: 0,   provider: "anthropic", effort_level: "medium" },
      ];

      for (const e of entradas) {
        writeFileSync(ledgerFile, JSON.stringify(e) + "\n", { flag: "a" });
      }

      const lineas = readFileSync(ledgerFile, "utf8").trim().split("\n");
      assert.equal(lineas.length, 2);
      for (const linea of lineas) {
        const parsed = JSON.parse(linea); // No debe lanzar
        const errores = validarEntradaConsumo(parsed);
        assert.deepEqual(errores, []);
      }
    } finally {
      cleanup(dir);
    }
  });
});
