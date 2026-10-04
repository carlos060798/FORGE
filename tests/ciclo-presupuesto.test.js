// @ts-check
/**
 * T009 / T017 / T019 — Libro de costos del ciclo verificado (ADR-06).
 * Cubre CA-004-01, CA-004-02, CA-004-03, CA-004-05.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { ampliar, ErrorConsumo, estadoDe, modeloEfectivo, puedeLlamar, registrar } from "../core/ciclo/presupuesto.js";
import { estadoInicial } from "../core/ciclo/estado.js";
import { precioDe, PRECIO_DESCONOCIDO, sessionBudget } from "../core/session-budget.js";

const nuevo = (tope = 2, umbral = 1.5) =>
  estadoInicial({ id: "T1", agente: "tester" }, { runId: "r", cwd: "/p", tope_usd: tope, umbral_degradacion_usd: umbral }).presupuesto;

// 100 000 tokens de entrada de opus = 1,50 USD
const OPUS = { proveedor: "anthropic", modelo: "claude-opus-4-8" };

describe("precioDe — tabla por proveedor", () => {
  test("anthropic usa su tabla", () => {
    assert.equal(precioDe("anthropic", "claude-sonnet-4-6").input, 3 / 1_000_000);
  });

  test("los proveedores locales y el stub no cuestan", () => {
    assert.deepEqual(precioDe("ollama", "qwen2.5-coder:7b"), { input: 0, output: 0 });
    assert.deepEqual(precioDe("stub", "stub-sonnet"), { input: 0, output: 0 });
  });

  test("un modelo desconocido se cobra al precio conservador, no al de sonnet", () => {
    assert.deepEqual(precioDe("anthropic", "claude-inexistente"), PRECIO_DESCONOCIDO);
    assert.deepEqual(precioDe("proveedor-nuevo", "x"), PRECIO_DESCONOCIDO);
  });

  test("el precio desconocido es configurable", () => {
    assert.deepEqual(precioDe("openai", "x", { input: 1, output: 2 }), { input: 1, output: 2 });
  });

  test("el acumulador de sesión existente conserva su interfaz", () => {
    assert.equal(typeof sessionBudget.resumen(), "string");
    assert.ok("costo_usd" in sessionBudget.snapshot());
  });
});

describe("registrar — transiciones de estado", () => {
  test("acumula gasto, llamadas y tokens sin mutar el original", () => {
    const p0 = nuevo();
    const p1 = registrar(p0, { ...OPUS, inputTokens: 10_000, outputTokens: 1_000 });
    assert.equal(p0.gastado_usd, 0);
    assert.ok(Math.abs(p1.gastado_usd - 0.225) < 1e-9);
    assert.equal(p1.llamadas, 1);
    assert.equal(p1.tokens_in, 10_000);
    assert.equal(p1.tokens_out, 1_000);
    assert.equal(p1.estado, "ok");
  });

  test("CA-004-01: al alcanzar el umbral pasa a degradado", () => {
    const p = registrar(nuevo(), { ...OPUS, inputTokens: 100_000, outputTokens: 0 });
    assert.equal(p.estado, "degradado");
    assert.equal(puedeLlamar(p), true);
  });

  test("CA-004-02: al alcanzar el tope pasa a agotado y no se puede llamar", () => {
    let p = registrar(nuevo(), { ...OPUS, inputTokens: 100_000, outputTokens: 0 });
    p = registrar(p, { ...OPUS, inputTokens: 40_000, outputTokens: 0 });
    assert.equal(p.estado, "agotado");
    assert.equal(puedeLlamar(p), false);
  });

  test("CA-004-03: el gasto vive en el objeto y sobrevive a serializarlo", () => {
    const p = registrar(nuevo(), { ...OPUS, inputTokens: 100_000, outputTokens: 0 });
    const restaurado = JSON.parse(JSON.stringify(p));
    const q = registrar(restaurado, { ...OPUS, inputTokens: 40_000, outputTokens: 0 });
    assert.equal(q.llamadas, 2);
    assert.equal(q.estado, "agotado");
  });

  test("CA-004-05: un proveedor real sin datos de consumo es un error", () => {
    assert.throws(() => registrar(nuevo(), { ...OPUS }), ErrorConsumo);
    assert.throws(() => registrar(nuevo(), { ...OPUS, inputTokens: 5 }), ErrorConsumo);
  });

  test("un proveedor local sin datos de consumo cuenta como gasto cero", () => {
    const p = registrar(nuevo(), { proveedor: "ollama", modelo: "llama3.2:3b" });
    assert.equal(p.gastado_usd, 0);
    assert.equal(p.llamadas, 1);
  });

  test("estadoDe usa límites inclusivos", () => {
    assert.equal(estadoDe({ tope_usd: 2, umbral_degradacion_usd: 1.5, gastado_usd: 1.4999 }), "ok");
    assert.equal(estadoDe({ tope_usd: 2, umbral_degradacion_usd: 1.5, gastado_usd: 1.5 }), "degradado");
    assert.equal(estadoDe({ tope_usd: 2, umbral_degradacion_usd: 1.5, gastado_usd: 2 }), "agotado");
  });
});

describe("ampliar — tras una revisión humana", () => {
  test("ampliar el tope reabre un presupuesto agotado", () => {
    let p = registrar(nuevo(), { ...OPUS, inputTokens: 140_000, outputTokens: 0 });
    assert.equal(p.estado, "agotado");
    p = ampliar(p, 1);
    assert.equal(p.tope_usd, 3);
    assert.equal(p.estado, "degradado");
  });

  test("un extra negativo no reduce el tope", () => {
    assert.equal(ampliar(nuevo(), -5).tope_usd, 2);
  });
});

describe("modeloEfectivo — degradación", () => {
  const degradado = { ...nuevo(), estado: /** @type {const} */ ("degradado") };

  test("sin degradación se usa el alias del agente", () => {
    assert.deepEqual(modeloEfectivo("opus", nuevo()), { alias: "opus", proveedorLocal: false, degradado: false });
  });

  test("degradado baja un escalón", () => {
    assert.equal(modeloEfectivo("opus", degradado).alias, "sonnet");
    assert.equal(modeloEfectivo("sonnet", degradado).alias, "haiku");
  });

  test("haiku no puede bajar más", () => {
    assert.deepEqual(modeloEfectivo("haiku", degradado), { alias: "haiku", proveedorLocal: false, degradado: false });
  });

  test("con degradar_a local se pide el proveedor local", () => {
    assert.deepEqual(modeloEfectivo("opus", degradado, "local"), { alias: "opus", proveedorLocal: true, degradado: true });
  });

  test("un identificador de modelo directo se respeta", () => {
    assert.equal(modeloEfectivo("gpt-4o", degradado).alias, "gpt-4o");
  });
});
