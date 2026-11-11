// @ts-check
/**
 * Hallazgo H4 de docs/informes/EVALUACION-AGNOSTICISMO.md: el motor no debe suponer Anthropic.
 * Quien usa OpenAI u Ollama no tiene por qué definir ANTHROPIC_API_KEY ni ver avisos que no le tocan;
 * quien usa Anthropic ve exactamente lo de siempre.
 */
import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { resolverClave } from "../core/engine-cli.js";
import { SessionBudget, PRECIOS_POR_PROVEEDOR } from "../core/session-budget.js";
import { bus } from "../core/event-bus.js";

const VARIABLES = ["FORGE_LLM_PROVIDER", "FRAGUA_LLM_PROVIDER", "ANTHROPIC_API_KEY", "CLAUDE_API_KEY", "OPENAI_API_KEY", "OLLAMA_BASE_URL", "OPENAI_BASE_URL"];
let guardado = {};
let cwd = "";

beforeEach(() => {
  guardado = Object.fromEntries(VARIABLES.map((v) => [v, process.env[v]]));
  for (const v of VARIABLES) delete process.env[v];
  cwd = realpathSync(mkdtempSync(join(tmpdir(), "forge-motor-")));
});
afterEach(() => {
  for (const v of VARIABLES) { if (guardado[v] === undefined) delete process.env[v]; else process.env[v] = guardado[v]; }
});

describe("resolverClave: la clave y el aviso salen del proveedor que se usa", () => {
  test("Anthropic con clave: la pasa y no avisa (como siempre)", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-x";
    assert.deepEqual(resolverClave(cwd), { apiKey: "sk-ant-x", aviso: null });
  });
  test("sin ninguna variable, el proveedor por defecto sigue siendo Anthropic y el aviso es el de siempre", () => {
    const r = resolverClave(cwd);
    assert.equal(r.apiKey, undefined);
    assert.equal(r.aviso, "ANTHROPIC_API_KEY no está definida — el engine correrá en modo stub.");
  });
  test("solo OPENAI_API_KEY: sin aviso de Anthropic y sin clave de Anthropic", () => {
    process.env.OPENAI_API_KEY = "sk-openai";
    const r = resolverClave(cwd);
    assert.equal(r.aviso, null);
    assert.equal(r.apiKey, undefined);
  });
  test("OpenAI elegido y sin su clave: avisa de OPENAI_API_KEY, no de Anthropic", () => {
    process.env.FORGE_LLM_PROVIDER = "openai";
    const r = resolverClave(cwd);
    assert.match(String(r.aviso), /OPENAI_API_KEY/);
    assert.ok(!/ANTHROPIC/.test(String(r.aviso)));
  });
  test("Ollama y el proveedor de pruebas no necesitan clave ni avisan", () => {
    process.env.FORGE_LLM_PROVIDER = "ollama";
    assert.deepEqual(resolverClave(cwd), { apiKey: undefined, aviso: null });
    process.env.FORGE_LLM_PROVIDER = "stub";
    assert.deepEqual(resolverClave(cwd), { apiKey: undefined, aviso: null });
  });
  test("con OpenAI elegido, una ANTHROPIC_API_KEY presente no se pasa como clave", () => {
    process.env.FORGE_LLM_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "sk-openai";
    process.env.ANTHROPIC_API_KEY = "sk-ant-x";
    assert.deepEqual(resolverClave(cwd), { apiKey: undefined, aviso: null });
  });
});

describe("acumulador de gasto: modelos de otros proveedores", () => {
  test("un modelo de OpenAI se cobra con la tabla de OpenAI, no con el precio de Sonnet", async () => {
    const modelo = Object.keys(PRECIOS_POR_PROVEEDOR.openai)[0];
    const p = PRECIOS_POR_PROVEEDOR.openai[modelo];
    const presupuesto = new SessionBudget(1000);
    await bus.emit("agent:result", { modelo, tokens_input: 1000, tokens_output: 1000 });
    const esperado = 1000 * p.input + 1000 * p.output;
    assert.ok(Math.abs(presupuesto.snapshot().costo_usd - esperado) < 1e-5, `${presupuesto.snapshot().costo_usd} vs ${esperado}`);
  });
  test("un modelo de Anthropic sigue cobrándose igual", async () => {
    const p = PRECIOS_POR_PROVEEDOR.anthropic["claude-sonnet-4-6"];
    const presupuesto = new SessionBudget(1000);
    await bus.emit("agent:result", { modelo: "claude-sonnet-4-6", tokens_input: 1000, tokens_output: 1000 });
    assert.ok(Math.abs(presupuesto.snapshot().costo_usd - (1000 * p.input + 1000 * p.output)) < 1e-5);
  });
});
