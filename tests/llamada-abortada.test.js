// @ts-check
/**
 * Una llamada al modelo cancelada por tiempo pudo llegar al proveedor y cobrarse.
 * Visto con un modelo real el 2026-10-10: tras una llamada cancelada a los 120 s, la siguiente
 * leyó de la caché de prompts lo que solo pudo haber escrito la cancelada. El gasto de la sesión
 * no puede quedar por debajo de lo que el proveedor cobra (Principio VIII).
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { LlmAgentAdapter, estimarTokens } from "../core/agent-registry.js";
import { POR_DEFECTO } from "../core/ciclo/config.js";
import { CicloVerificado } from "../core/ciclo/index.js";

const tmp = () => mkdtempSync(join(tmpdir(), "forge-abortada-"));
const proveedorQueNoResponde = {
  nombre: "anthropic",
  resolveModelId: () => "claude-sonnet-4-6",
  complete: ({ signal }) => new Promise((_, rechazar) => signal.addEventListener("abort", () => rechazar(new Error("Request was aborted.")))),
};

describe("adaptador — una llamada cancelada por tiempo se distingue de cualquier otro fallo", () => {
  test("al agotar el tiempo devuelve abortada, con una estimación por lo alto de los tokens de entrada", async () => {
    const adaptador = new LlmAgentAdapter(/** @type {any} */ ({ name: "x", systemPrompt: "s".repeat(300), model: "sonnet", timeout_ms: 30 }), "k", undefined, tmp(), /** @type {any} */ (proveedorQueNoResponde));
    const r = /** @type {any} */ (await adaptador.execute(/** @type {any} */ ({ cwd: tmp(), userPrompt: "u".repeat(600) })));
    assert.equal(r.ok, false);
    assert.equal(r.abortada, true);
    assert.match(r.error, /superó el tiempo máximo .* y se canceló/);
    assert.ok(r.tokensEstimados >= 300, `estimación ${r.tokensEstimados}`);
    assert.equal(r.modelo, "claude-sonnet-4-6");
    assert.equal(r.provider, "anthropic");
  });

  test("un fallo que no es por tiempo no se marca como abortada", async () => {
    const proveedor = { ...proveedorQueNoResponde, complete: async () => { throw new Error("400 petición inválida"); } };
    const adaptador = new LlmAgentAdapter(/** @type {any} */ ({ name: "x", systemPrompt: "s", model: "sonnet", timeout_ms: 5000 }), "k", undefined, tmp(), /** @type {any} */ (proveedor));
    const r = /** @type {any} */ (await adaptador.execute(/** @type {any} */ ({ cwd: tmp(), userPrompt: "u" })));
    assert.equal(r.ok, false);
    assert.equal(r.abortada, undefined);
    assert.match(r.error, /400/);
  });

  test("la estimación va por lo alto: tres caracteres por token", () => {
    assert.equal(estimarTokens("abc", "def"), 2);
    assert.equal(estimarTokens("a"), 1);
    assert.equal(estimarTokens("", null, undefined), 0);
  });
});

describe("ciclo — el gasto de una llamada cancelada no desaparece", () => {
  function entorno(respuesta) {
    const cwd = tmp();
    writeFileSync(join(cwd, "package.json"), JSON.stringify({ type: "module", scripts: { test: "node --test" } }));
    /** @type {{ type: string, payload: any }[]} */
    const eventos = [];
    const ciclo = new CicloVerificado(/** @type {any} */ ({
      cwd, runId: "r1", testCmd: "npm test",
      config: { ...POR_DEFECTO, motor: { ...POR_DEFECTO.motor, grafo: "propio", mutacion: "no" } },
      log: { append: (type, payload) => eventos.push({ type, payload }) },
      aliasDe: () => "sonnet",
      llamar: async () => respuesta,
      runner: { test: async () => ({ exitCode: 1, stdout: "", stderr: "", timedOut: false, infraError: false, durationMs: 1 }) },
    }));
    return { cwd, eventos, ciclo };
  }
  const TAREA = { id: "T1", agente: "desarrollador-backend", prompt: "Implementa x" };

  test("se pausa por infraestructura, avisa de que pudo cobrarse y anota la estimación de la entrada", async () => {
    const e = entorno({ ok: false, abortada: true, tokensEstimados: 3000, modelo: "claude-sonnet-4-6", proveedor: "anthropic", error: "la llamada superó el tiempo máximo (120 s) y se canceló" });
    const r = await e.ciclo.ejecutar(TAREA);
    assert.equal(r.estado.resultado, "revision_pendiente");
    assert.equal(r.estado.revision?.motivo, "infraestructura");
    assert.match(String(r.estado.revision?.detalle), /pudo procesarla y cobrarla/);

    const total = e.ciclo.libro.total();
    assert.equal(total.llamadas, 1);
    assert.ok(Math.abs(total.usd - 3000 * 3 / 1e6) < 1e-12, `usd ${total.usd}`);
    assert.equal(total.tokens_in, 3000);
    assert.equal(total.tokens_out, 0);

    const aviso = e.eventos.find((ev) => ev.type === "ciclo:llamada_abortada");
    assert.equal(aviso?.payload.tokensEstimados, 3000);
    assert.equal(aviso?.payload.modelo, "claude-sonnet-4-6");

    const dirMotor = join(e.cwd, ".sdd", "motor", "r1");
    const linea = JSON.parse(readFileSync(join(dirMotor, "gasto.jsonl"), "utf8").trim().split("\n")[0]);
    assert.equal(linea.estimado, true, "queda marcado como estimación, no como consumo informado");
    assert.ok(readdirSync(dirMotor).includes("gasto.jsonl"));
  });

  test("al continuar, el gasto estimado sigue contando para el tope de la sesión", async () => {
    const e = entorno({ ok: false, abortada: true, tokensEstimados: 3000, modelo: "claude-sonnet-4-6", proveedor: "anthropic", error: "cancelada" });
    await e.ciclo.ejecutar(TAREA);
    const r = await e.ciclo.ejecutar(TAREA, { decision: "continuar" });
    assert.equal(e.ciclo.libro.total().llamadas, 2);
    assert.ok(r.estado.presupuesto.gastado_usd >= 2 * 3000 * 3 / 1e6 - 1e-12, `gastado ${r.estado.presupuesto.gastado_usd}`);
  });

  test("un fallo del proveedor que no es por tiempo no anota gasto", async () => {
    const e = entorno({ ok: false, error: "503 servicio no disponible", modelo: "claude-sonnet-4-6", proveedor: "anthropic" });
    const r = await e.ciclo.ejecutar(TAREA);
    assert.equal(r.estado.revision?.motivo, "infraestructura");
    assert.doesNotMatch(String(r.estado.revision?.detalle), /pudo procesarla/);
    assert.equal(e.ciclo.libro.total().llamadas, 0);
    assert.ok(!e.eventos.some((ev) => ev.type === "ciclo:llamada_abortada"));
  });
});
