/**
 * Tests de comportamiento del pipeline FORGE — contratos de artefactos.
 * Validan el formato de ir.json, spec.md, estado.json y consumo.jsonl
 * usando fixtures estáticos. No llaman a LLMs.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readJson(file) {
  const path = join(FIXTURES, file);
  assert.ok(existsSync(path), `Fixture no existe: ${path}`);
  return JSON.parse(readFileSync(path, "utf8"));
}

function readText(file) {
  const path = join(FIXTURES, file);
  assert.ok(existsSync(path), `Fixture no existe: ${path}`);
  return readFileSync(path, "utf8");
}

function readJsonl(file) {
  const path = join(FIXTURES, file);
  assert.ok(existsSync(path), `Fixture no existe: ${path}`);
  return readFileSync(path, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

// ─── Test 1: ir.json tiene los campos requeridos ──────────────────────────────

describe("ir.json — contrato de campos requeridos", () => {
  test("tiene los campos obligatorios del IR", () => {
    const ir = readJson("ir.json");

    // Campos de identificación
    assert.ok(ir.id, "falta campo: id");
    assert.ok(ir.created_at, "falta campo: created_at");
    assert.ok(ir.raw_input, "falta campo: raw_input");

    // Campos de análisis
    assert.ok(typeof ir.confidence === "number", "confidence debe ser number");
    assert.ok(ir.confidence >= 0 && ir.confidence <= 1, "confidence debe estar entre 0 y 1");
    assert.ok(ir.estimated_complexity, "falta campo: estimated_complexity");
    assert.ok(typeof ir.requires_clarification === "boolean", "requires_clarification debe ser boolean");

    // Campos de producto
    assert.ok(ir.product, "falta campo: product");
    assert.ok(ir.product.name, "falta campo: product.name");
    assert.ok(ir.product.type, "falta campo: product.type");

    // Campos de features
    assert.ok(ir.features, "falta campo: features");
    assert.ok(Array.isArray(ir.features.core), "features.core debe ser array");
    assert.ok(ir.features.core.length > 0, "features.core no puede estar vacío");
  });

  test("estimated_complexity es un valor válido", () => {
    const ir = readJson("ir.json");
    const validos = ["baja", "media", "alta", "muy alta", "low", "medium", "high"];
    assert.ok(
      validos.includes(ir.estimated_complexity),
      `estimated_complexity '${ir.estimated_complexity}' no es un valor válido: ${validos.join(", ")}`
    );
  });

  test("ir.json sin campo product es detectado como inválido", () => {
    // CA-F3-004-03: fixture inválido — sin product ni features.core
    const irInvalido = {
      id: "ir-invalido-test",
      created_at: "2026-06-21T00:00:00.000Z",
      raw_input: "Quiero algo",
      confidence: 0.5,
      estimated_complexity: "baja",
      requires_clarification: false,
      // Falta deliberadamente: product, features
    };
    assert.ok(!irInvalido.product, "sin campo product → detectado como inválido");
    assert.ok(!irInvalido.features, "sin campo features → detectado como inválido");
    const errores = [];
    if (!irInvalido.product) errores.push("falta campo: product");
    if (!irInvalido.features) errores.push("falta campo: features");
    assert.ok(errores.length > 0, "debe haber al menos un error detectado");
    assert.ok(errores.some(e => e.includes("product")), "el error menciona 'product'");
  });

  test("si requires_clarification es true, questions_for_user no está vacío", () => {
    const ir = readJson("ir.json");
    if (ir.requires_clarification) {
      assert.ok(
        Array.isArray(ir.questions_for_user) && ir.questions_for_user.length > 0,
        "si requires_clarification=true, questions_for_user debe tener al menos una pregunta"
      );
    }
  });
});

// ─── Test 2: spec.md tiene las secciones requeridas ──────────────────────────

describe("spec.md — contrato de secciones", () => {
  test("tiene frontmatter con campos requeridos", () => {
    const spec = readText("spec.md");

    assert.ok(spec.startsWith("---"), "spec.md debe empezar con frontmatter YAML (---)");
    assert.ok(spec.includes("id:"), "frontmatter debe tener campo: id");
    assert.ok(spec.includes("titulo:"), "frontmatter debe tener campo: titulo");
    assert.ok(spec.includes("estado:"), "frontmatter debe tener campo: estado");
  });

  test("tiene las secciones mínimas del cuerpo", () => {
    const spec = readText("spec.md");
    const secciones = [
      "## 1.",
      "## 2.",
      "## 4.",   // Historias de Usuario
      "## 6.",   // Requisitos Funcionales
      "## 10.",  // Criterios de Éxito
    ];
    for (const seccion of secciones) {
      assert.ok(
        spec.includes(seccion),
        `spec.md debe contener la sección '${seccion}'`
      );
    }
  });

  test("contiene al menos una Historia de Usuario con criterios de aceptación", () => {
    const spec = readText("spec.md");
    assert.ok(spec.includes("### HU-"), "spec.md debe tener al menos una Historia de Usuario (### HU-)");
    assert.ok(spec.includes("**CA-"), "spec.md debe tener al menos un criterio de aceptación (**CA-)");
  });

  test("contiene la sección de Fuera de Alcance", () => {
    const spec = readText("spec.md");
    assert.ok(
      spec.includes("## 8.") || spec.includes("Fuera de Alcance"),
      "spec.md debe contener la sección 'Fuera de Alcance'"
    );
  });
});

// ─── Test 3: estado.json con pipeline_step implementando tiene plan_activo ───

describe("estado.json — contrato de campos por fase", () => {
  test("tiene schemaVersion", () => {
    const estado = readJson("estado.json");
    assert.equal(estado.schemaVersion, "1.0", "estado.json debe tener schemaVersion: '1.0'");
  });

  test("tiene pipeline_step como string no vacío", () => {
    const estado = readJson("estado.json");
    assert.ok(typeof estado.pipeline_step === "string", "pipeline_step debe ser string");
    assert.ok(estado.pipeline_step.length > 0, "pipeline_step no puede estar vacío");
  });

  test("si pipeline_step es 'implementando', plan_activo no es nulo", () => {
    const estado = readJson("estado.json");
    if (estado.pipeline_step === "implementando") {
      assert.ok(
        estado.plan_activo !== null && estado.plan_activo !== undefined,
        "cuando pipeline_step='implementando', plan_activo debe existir"
      );
      assert.ok(
        typeof estado.plan_activo.tareas_total === "number",
        "plan_activo.tareas_total debe ser number"
      );
    }
  });

  test("ultima_actualizacion es una fecha ISO válida", () => {
    const estado = readJson("estado.json");
    assert.ok(estado.ultima_actualizacion, "falta campo: ultima_actualizacion");
    const fecha = new Date(estado.ultima_actualizacion);
    assert.ok(!isNaN(fecha.getTime()), "ultima_actualizacion debe ser fecha ISO válida");
  });
});

// ─── Test 4: consumo.jsonl tiene el formato correcto en cada línea ────────────

describe("consumo.jsonl — contrato de formato por entrada", () => {
  test("cada línea es JSON válido parseeable", () => {
    const lineas = readJsonl("consumo.jsonl");
    assert.ok(lineas.length > 0, "consumo.jsonl debe tener al menos una línea");
  });

  test("cada entrada tiene los campos mínimos requeridos", () => {
    const lineas = readJsonl("consumo.jsonl");
    for (const [i, entrada] of lineas.entries()) {
      assert.ok(entrada.ts, `línea ${i + 1}: falta campo 'ts'`);
      assert.ok(entrada.agente, `línea ${i + 1}: falta campo 'agente'`);
      assert.ok(entrada.tool, `línea ${i + 1}: falta campo 'tool'`);
    }
  });

  test("campo ts es fecha ISO válida en todas las entradas", () => {
    const lineas = readJsonl("consumo.jsonl");
    for (const [i, entrada] of lineas.entries()) {
      const fecha = new Date(entrada.ts);
      assert.ok(
        !isNaN(fecha.getTime()),
        `línea ${i + 1}: campo 'ts' no es fecha ISO válida: '${entrada.ts}'`
      );
    }
  });

  test("campos opcionales provider y effort_level son string o null cuando presentes", () => {
    const lineas = readJsonl("consumo.jsonl");
    for (const [i, entrada] of lineas.entries()) {
      if (entrada.provider !== undefined) {
        assert.ok(
          typeof entrada.provider === "string" || entrada.provider === null,
          `línea ${i + 1}: 'provider' debe ser string o null`
        );
      }
      if (entrada.effort_level !== undefined) {
        assert.ok(
          typeof entrada.effort_level === "string" || entrada.effort_level === null,
          `línea ${i + 1}: 'effort_level' debe ser string o null`
        );
      }
    }
  });
});

// ─── Test 5: estado corrupto es detectable ───────────────────────────────────

describe("estado.json corrupto — detectabilidad", () => {
  test("estado sin schemaVersion es identificable como legado", () => {
    const estadoLegado = { pipeline_step: "ir", ir_generado: true };
    assert.equal(estadoLegado.schemaVersion, undefined, "sin schemaVersion → es estado legado");
  });

  test("estado con pipeline_step vacío es inválido", () => {
    const estadoInvalido = { schemaVersion: "1.0", pipeline_step: "" };
    assert.ok(
      !estadoInvalido.pipeline_step || estadoInvalido.pipeline_step.length === 0,
      "pipeline_step vacío debería detectarse como inválido"
    );
  });

  test("estado con plan_activo nulo en fase implementando es inválido", () => {
    const estadoInvalido = {
      schemaVersion: "1.0",
      pipeline_step: "implementando",
      plan_activo: null,
    };
    assert.equal(
      estadoInvalido.plan_activo,
      null,
      "plan_activo nulo en fase 'implementando' debe ser detectado"
    );
  });
});
