// @ts-check
/**
 * Robustez del gasto: tiempo por intento (H13), estimación de tokens (N-11), consumo no informado
 * bajo el tope (N-06) e intención anotada antes de llamar (H-10 de la fase 8).
 * Sin llamadas reales: los proveedores son dobles.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { LlmAgentAdapter, estimarTokens, tiempoPorIntento } from "../core/agent-registry.js";
import { leerTimeoutLlmMs } from "../core/llm-providers/index.js";
import { POR_DEFECTO } from "../core/ciclo/config.js";
import { CicloVerificado } from "../core/ciclo/index.js";

const tmp = () => mkdtempSync(join(tmpdir(), "forge-gasto-"));
const def = (extra = {}) => /** @type {any} */ ({ name: "x", systemPrompt: "s".repeat(300), model: "sonnet", timeout_ms: 40, ...extra });
const OK = { output: "hola", inputTokens: 10, outputTokens: 5 };

/** Proveedor que no responde en los primeros `colgadas` llamadas y después contesta. */
function proveedor(colgadas) {
  const estado = { llamadas: 0, señales: /** @type {AbortSignal[]} */ ([]) };
  return {
    estado,
    p: /** @type {any} */ ({
      nombre: "anthropic",
      resolveModelId: () => "claude-sonnet-4-6",
      complete: ({ signal }) => {
        estado.llamadas++;
        estado.señales.push(signal);
        if (estado.llamadas <= colgadas) {
          return new Promise((_, rechazar) => signal.addEventListener("abort", () => rechazar(new Error("Request was aborted."))));
        }
        return Promise.resolve(OK);
      },
    }),
  };
}

describe("H13 — tiempo máximo por intento", () => {
  test("tras cancelar un intento, el reintento usa una señal nueva y puede responder", async () => {
    const { p, estado } = proveedor(1);
    const a = new LlmAgentAdapter(def(), "k", undefined, tmp(), p);
    const r = /** @type {any} */ (await a.execute({ cwd: tmp(), userPrompt: "u".repeat(60) }));
    assert.equal(r.ok, true);
    assert.equal(estado.llamadas, 2);
    assert.equal(estado.señales[0].aborted, true);
    assert.equal(estado.señales[1].aborted, false, "el segundo intento no hereda la señal cancelada");
    assert.notEqual(estado.señales[0], estado.señales[1]);
    // el intento cancelado pudo cobrarse: se informa de su estimación
    assert.equal(r.intentosCancelados, 1);
    assert.equal(r.tokensEstimadosCancelados, estimarTokens("s".repeat(300), "u".repeat(60)) + estimarTokens("") * 0);
  });

  test("como mucho un reintento tras tiempo agotado, con las dos estimaciones acumuladas y el aviso", async () => {
    const { p, estado } = proveedor(99);
    const a = new LlmAgentAdapter(def(), "k", undefined, tmp(), p);
    const r = /** @type {any} */ (await a.execute({ cwd: tmp(), userPrompt: "u".repeat(60) }));
    assert.equal(estado.llamadas, 2);
    assert.equal(r.ok, false);
    assert.equal(r.abortada, true);
    assert.equal(r.intentosCancelados, 2);
    assert.equal(r.tokensEstimados, 2 * estimarTokens("s".repeat(300), "u".repeat(60)));
    assert.match(r.error, /2 intentos cancelados por tiempo/);
  });

  test("el tiempo total está acotado a dos intentos", async () => {
    const { p } = proveedor(99);
    const a = new LlmAgentAdapter(def({ timeout_ms: 100 }), "k", undefined, tmp(), p);
    const t0 = Date.now();
    await a.execute({ cwd: tmp(), userPrompt: "u" });
    const ms = Date.now() - t0;
    assert.ok(ms < 100 * 2 + 400, `tardó ${ms} ms`);
  });

  test("un fallo reintentable que no es por tiempo sigue reintentándose con la señal del intento", async () => {
    let n = 0;
    const p = /** @type {any} */ ({ nombre: "anthropic", resolveModelId: () => "m", complete: async () => { n++; if (n === 1) throw new Error("503 no disponible"); return OK; } });
    const a = new LlmAgentAdapter(def({ timeout_ms: 5000 }), "k", undefined, tmp(), p);
    const r = /** @type {any} */ (await a.execute({ cwd: tmp(), userPrompt: "u" }));
    assert.equal(r.ok, true);
    assert.equal(n, 2);
    assert.equal(r.intentosCancelados, undefined);
  });

  test("conversar usa el mismo esquema por intento", async () => {
    let n = 0;
    const p = /** @type {any} */ ({
      nombre: "anthropic", resolveModelId: () => "m", admiteHerramientas: true,
      conversar: ({ signal }) => {
        n++;
        if (n === 1) return new Promise((_, rej) => signal.addEventListener("abort", () => rej(new Error("abort"))));
        return Promise.resolve({ contenido: [], stopReason: "end_turn", inputTokens: 1, outputTokens: 1 });
      },
    });
    const a = new LlmAgentAdapter(def(), "k", undefined, tmp(), p);
    const r = /** @type {any} */ (await /** @type {any} */ (a).conversar({ mensajes: [{ role: "user", content: "hola" }], herramientas: [] }));
    assert.equal(r.ok, true);
    assert.equal(n, 2);
    assert.equal(r.intentosCancelados, 1);
    assert.ok(r.tokensEstimadosCancelados > 0);
  });

  test("el tiempo por intento crece con el tamaño de la petición, con tope del triple", () => {
    assert.equal(tiempoPorIntento(120_000, 1000), 120_000);
    assert.equal(tiempoPorIntento(120_000, 30_000), 120_000);
    assert.equal(tiempoPorIntento(120_000, 80_000), 170_000);
    assert.equal(tiempoPorIntento(120_000, 5_000_000), 360_000);
  });
});

describe("H13 — llm.timeout_s", () => {
  function proyecto(llm) {
    const cwd = tmp();
    mkdirSync(join(cwd, ".sdd"));
    writeFileSync(join(cwd, ".sdd", "sdd.config.yaml"), `llm:\n${llm}\n`);
    return cwd;
  }
  test("sin la clave no hay valor propio (se usan 120 s)", () => {
    assert.equal(leerTimeoutLlmMs(tmp()), null);
    const a = new LlmAgentAdapter(def(), "k", undefined, tmp(), /** @type {any} */ (proveedor(0).p));
    assert.equal(a.globalTimeoutMs, 120_000);
  });
  test("se lee y se aplica", () => {
    const cwd = proyecto("  provider: stub\n  timeout_s: 45");
    assert.equal(leerTimeoutLlmMs(cwd), 45_000);
    const a = new LlmAgentAdapter(def({ timeout_ms: undefined }), "k", undefined, cwd, /** @type {any} */ (proveedor(0).p));
    assert.equal(a.globalTimeoutMs, 45_000);
  });
  test("un valor no válido se rechaza con un error claro", () => {
    for (const malo of ["0", "-5", "abc", "5000", "NaN", "1e3"]) {
      assert.throws(() => leerTimeoutLlmMs(proyecto(`  timeout_s: ${malo}`)), /llm\.timeout_s/, malo);
    }
  });
});

describe("N-11 — estimación de tokens", () => {
  test("ASCII: tres caracteres por token, por lo alto", () => {
    assert.equal(estimarTokens("a".repeat(300)), 100);
    assert.equal(estimarTokens("abc", "def"), 2);
    assert.equal(estimarTokens(""), 0);
  });
  test("CJK: la mitad de los bytes UTF-8 (3 bytes por carácter)", () => {
    // 100 caracteres CJK = 300 bytes = 150 tokens (antes se estimaban 34)
    assert.equal(estimarTokens("漢".repeat(100)), 150);
  });
  test("emoji: 4 bytes por emoji, dos tokens cada uno", () => {
    assert.equal(estimarTokens("😀".repeat(10)), 20);
  });
  test("mezcla: cada tramo con su regla", () => {
    // 30 ASCII = 10; 10 CJK = 30 bytes = 15
    assert.equal(estimarTokens("a".repeat(30) + "漢".repeat(10)), 25);
    // la suma es por texto y no por carácter suelto: dos textos de un carácter ASCII caben en 1 token cada uno
    assert.equal(estimarTokens("a", "b"), 1);
  });
  test("una estimación con no ASCII nunca queda por debajo de la de solo caracteres", () => {
    for (const t of ["日本語のテキスト".repeat(20), "héllo wörld ñandú ".repeat(30), "🙂🙃".repeat(50)]) {
      assert.ok(estimarTokens(t) >= Math.ceil(t.length / 3), t.slice(0, 8));
    }
  });
});

describe("ciclo — consumo no informado, tope e intención", () => {
  const TAREA = { id: "T1", agente: "desarrollador-backend", prompt: "Implementa x" };
  const SIN_PRUEBAS = { exitCode: 1, stdout: "", stderr: "", timedOut: false, infraError: false, durationMs: 1 };

  function entorno(llamar, config = {}, cwdDado) {
    const cwd = cwdDado ?? tmp();
    writeFileSync(join(cwd, "package.json"), JSON.stringify({ type: "module", scripts: { test: "node --test" } }));
    /** @type {{ type: string, payload: any }[]} */
    const eventos = [];
    const ciclo = new CicloVerificado(/** @type {any} */ ({
      cwd, runId: "r1", testCmd: "npm test",
      config: { ...POR_DEFECTO, motor: { ...POR_DEFECTO.motor, grafo: "propio", mutacion: "no" }, ...config },
      log: { append: (type, payload) => eventos.push({ type, payload }) },
      aliasDe: () => "sonnet",
      llamar,
      runner: { test: async () => SIN_PRUEBAS },
    }));
    return { cwd, eventos, ciclo };
  }

  test("N-06: 7 `continuar` seguidos tras un consumo no informado topan con el presupuesto, sin pagar sin fin", async () => {
    let reales = 0;
    const llamar = async () => { reales++; return { ok: true, output: "texto sin bloque", modelo: "claude-sonnet-4-6", proveedor: "anthropic", inputTokens: undefined, outputTokens: undefined }; };
    const e = entorno(llamar, { presupuesto: { tope_usd: 0.004, umbral_degradacion_usd: 0.003, degradar_a: "escalon" } });
    let r = await e.ciclo.ejecutar(TAREA);
    assert.equal(r.estado.revision?.motivo, "infraestructura", "la primera vez se pausa por consumo no informado");
    assert.ok(e.ciclo.libro.total().usd > 0, "la llamada quedó anotada con una estimación, no en cero");
    // Con el tope alcanzado, `continuar` ya no se acepta («el presupuesto sigue agotado») y no paga nada
    let rechazadas = 0;
    for (let i = 0; i < 7; i++) {
      try {
        r = await e.ciclo.ejecutar(TAREA, { decision: "continuar" });
      } catch (err) {
        assert.match(String(/** @type {Error} */ (err).message), /presupuesto sigue agotado/);
        rechazadas++;
      }
    }
    assert.ok(rechazadas > 0, "el tope acabó mordiendo");
    assert.ok(reales < 8, `llamadas reales ${reales}`);
    assert.ok(e.ciclo.libro.total().usd >= 0.004, "el gasto anotado llega al tope");

    const lineas = readFileSync(join(e.cwd, ".sdd", "motor", "r1", "gasto.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    assert.ok(lineas.every((l) => l.estimado === true));
    assert.ok(e.eventos.some((ev) => ev.type === "ciclo:consumo_estimado"));
  });

  test("N-06: un consumo válido no se marca como estimado", async () => {
    const llamar = async () => ({ ok: true, output: "x", modelo: "claude-sonnet-4-6", proveedor: "anthropic", inputTokens: 100, outputTokens: 50 });
    const e = entorno(llamar);
    await e.ciclo.ejecutar(TAREA);
    const lineas = readFileSync(join(e.cwd, ".sdd", "motor", "r1", "gasto.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    assert.ok(lineas.length > 0);
    assert.ok(lineas.every((l) => l.estimado === undefined));
    assert.ok(!e.eventos.some((ev) => ev.type === "ciclo:consumo_estimado"));
  });

  test("N-06: un proveedor sin costo (local) sin consumo sigue contando cero", async () => {
    const llamar = async () => ({ ok: true, output: "x", modelo: "llama3", proveedor: "ollama" });
    const e = entorno(llamar);
    await e.ciclo.ejecutar(TAREA);
    assert.equal(e.ciclo.libro.total().usd, 0);
    assert.ok(!e.eventos.some((ev) => ev.type === "ciclo:consumo_estimado"));
  });

  test("intentos cancelados antes de una respuesta correcta se anotan como estimación", async () => {
    const llamar = async () => ({ ok: true, output: "x", modelo: "claude-sonnet-4-6", proveedor: "anthropic", inputTokens: 100, outputTokens: 50, intentosCancelados: 1, tokensEstimadosCancelados: 3000 });
    const e = entorno(llamar);
    await e.ciclo.ejecutar(TAREA);
    const lineas = readFileSync(join(e.cwd, ".sdd", "motor", "r1", "gasto.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    assert.ok(lineas.some((l) => l.estimado === true && l.inputTokens === 3000));
    assert.ok(e.eventos.some((ev) => ev.type === "ciclo:llamada_abortada"));
  });

  test("H-10: una llamada en vuelo cuando se corta el proceso se cuenta como estimación al reanudar", async () => {
    // Primera ejecución: el proceso «muere» (la llamada lanza) con la petición ya enviada
    const cwd = tmp();
    const corta = async () => { throw new Error("corte simulado"); };
    const e1 = entorno(corta, {}, cwd);
    await assert.rejects(() => e1.ciclo.ejecutar(TAREA), /corte simulado/);
    assert.equal(e1.ciclo.libro.total().llamadas, 0, "la respuesta nunca llegó: no hay nada anotado todavía");

    // Segunda: reanuda y llama de nuevo; el libro ya contiene la estimación de la que pudo cobrarse
    const ok = async () => ({ ok: true, output: "x", modelo: "claude-sonnet-4-6", proveedor: "anthropic", inputTokens: 100, outputTokens: 50 });
    const e2 = entorno(ok, {}, cwd);
    await e2.ciclo.ejecutar(TAREA);
    const lineas = readFileSync(join(cwd, ".sdd", "motor", "r1", "gasto.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    assert.equal(lineas.filter((l) => l.estimado === true).length, 1);
    assert.ok(e2.eventos.some((ev) => ev.type === "ciclo:llamada_huerfana"));
  });

  test("H-10: una llamada que terminó con un error del proveedor no se cuenta como huérfana", async () => {
    const cwd = tmp();
    const falla = async () => ({ ok: false, error: "503 no disponible", modelo: "m", proveedor: "anthropic" });
    await entorno(falla, {}, cwd).ciclo.ejecutar(TAREA);
    const ok = async () => ({ ok: true, output: "x", modelo: "claude-sonnet-4-6", proveedor: "anthropic", inputTokens: 100, outputTokens: 50 });
    const e2 = entorno(ok, {}, cwd);
    await e2.ciclo.ejecutar(TAREA, { decision: "continuar" });
    assert.ok(!e2.eventos.some((ev) => ev.type === "ciclo:llamada_huerfana"));
  });
});
