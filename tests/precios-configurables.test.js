// @ts-check
/**
 * ADR-19 — Modelos y precios configurables, con tabla incluida y fechada.
 * Cubre CA-002-01 a CA-002-05 de la spec 2026-10-09-validacion-modelo-real.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { REVISADA, TABLA, lineaRevision, precioMasCaro } from "../core/precios.js";
import { precioDe, tienePrecio, PRECIO_DESCONOCIDO, PRECIOS_POR_PROVEEDOR, PROVEEDORES_SIN_COSTO } from "../core/session-budget.js";
import { leerConfigCiclo, leerSeccion } from "../core/ciclo/config.js";
import { registrar } from "../core/ciclo/presupuesto.js";
import { estadoInicial } from "../core/ciclo/estado.js";
import { planner } from "../core/ciclo/nodos.js";
import { crearProvider } from "../core/llm-providers/index.js";

const M = 1_000_000;

/** Proyecto temporal con el sdd.config.yaml indicado. */
function proyecto(yaml) {
  const cwd = mkdtempSync(join(tmpdir(), "forge-precios-"));
  if (yaml !== undefined) {
    mkdirSync(join(cwd, ".sdd"), { recursive: true });
    writeFileSync(join(cwd, ".sdd", "sdd.config.yaml"), yaml);
  }
  return cwd;
}

/** Ejecuta `fn` sin las variables de entorno que cambian el proveedor. */
function sinEntorno(fn) {
  const claves = ["FORGE_LLM_PROVIDER", "ANTHROPIC_API_KEY", "CLAUDE_API_KEY", "OPENAI_API_KEY", "OLLAMA_BASE_URL"];
  const previo = Object.fromEntries(claves.map((k) => [k, process.env[k]]));
  for (const k of claves) delete process.env[k];
  try { return fn(); } finally {
    for (const k of claves) if (previo[k] !== undefined) process.env[k] = previo[k];
  }
}

const presupuestoNuevo = () =>
  estadoInicial({ id: "T1", agente: "tester" }, { runId: "r", cwd: "/p", tope_usd: 100, umbral_degradacion_usd: 90 }).presupuesto;

describe("lector de secciones — claves con guiones, puntos y comillas", () => {
  test("lee identificadores de modelo como clave", () => {
    const s = leerSeccion("precios:\n  claude-sonnet-4-6_entrada: 3\n  gpt-4.1_salida: 8   # comentario\n  \"qwen2.5-coder:7b_entrada\": 0\notra:\n  x: 1\n", "precios");
    assert.deepEqual(s, { "claude-sonnet-4-6_entrada": "3", "gpt-4.1_salida": "8", "qwen2.5-coder:7b_entrada": "0" });
  });

  test("las claves simples se siguen leyendo igual", () => {
    assert.deepEqual(leerSeccion("motor:\n  modo: clasico\n  max_iteraciones: 3\n", "motor"), { modo: "clasico", max_iteraciones: "3" });
  });
});

describe("CA-002-01: modelos y precios de la configuración mandan sobre la lista incluida", () => {
  const YAML = [
    "modelos:",
    "  sonnet: claude-sonnet-5-5",
    "  haiku: modelo-nuevo-1.0",
    "precios:",
    "  claude-sonnet-4-6_entrada: 4.5",
    "  claude-sonnet-4-6_salida: 20",
    "  modelo-nuevo-1.0_entrada: 0.25",
    "  modelo-nuevo-1.0_salida: 1.5",
    "",
  ].join("\n");

  test("leerConfigCiclo entrega modelos y precios (USD por token)", () => {
    const cwd = proyecto(YAML);
    try {
      const config = leerConfigCiclo(cwd);
      assert.deepEqual(config.modelos, { sonnet: "claude-sonnet-5-5", haiku: "modelo-nuevo-1.0" });
      assert.deepEqual(config.precios["claude-sonnet-4-6"], { input: 4.5 / M, output: 20 / M });
      assert.deepEqual(config.precios["modelo-nuevo-1.0"], { input: 0.25 / M, output: 1.5 / M });
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  });

  test("el precio configurado sustituye al de la tabla y da precio a un modelo que no estaba", () => {
    const cwd = proyecto(YAML);
    try {
      const { precios } = leerConfigCiclo(cwd);
      assert.deepEqual(precioDe("anthropic", "claude-sonnet-4-6", undefined, precios), { input: 4.5 / M, output: 20 / M });
      assert.deepEqual(precioDe("anthropic", "modelo-nuevo-1.0", undefined, precios), { input: 0.25 / M, output: 1.5 / M });
      assert.equal(tienePrecio("anthropic", "modelo-nuevo-1.0", precios), true);
      // Lo no configurado sigue saliendo de la tabla
      assert.deepEqual(precioDe("anthropic", "claude-opus-4-8", undefined, precios), precioDe("anthropic", "claude-opus-4-8"));
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  });

  test("el libro de costos cobra con el precio configurado", () => {
    const precios = { "claude-sonnet-4-6": { input: 4.5 / M, output: 20 / M } };
    const p = registrar(presupuestoNuevo(), { proveedor: "anthropic", modelo: "claude-sonnet-4-6", inputTokens: 1_000_000, outputTokens: 100_000 }, { precios });
    assert.ok(Math.abs(p.gastado_usd - 6.5) < 1e-9);
  });

  test("los niveles configurados llegan a los proveedores", () => {
    const cwd = proyecto(YAML);
    try {
      sinEntorno(() => {
        const anthropic = crearProvider({ cwd, config: { provider: "anthropic" } });
        assert.equal(anthropic.resolveModelId("sonnet"), "claude-sonnet-5-5");
        assert.equal(anthropic.resolveModelId("haiku"), "modelo-nuevo-1.0");
        assert.equal(anthropic.resolveModelId("opus"), "claude-opus-4-8", "un nivel sin configurar conserva el de la lista");
        assert.equal(anthropic.resolveModelId("claude-x"), "claude-x", "un identificador directo no se toca");
        assert.equal(crearProvider({ cwd, config: { provider: "openai" } }).resolveModelId("sonnet"), "claude-sonnet-5-5");
        assert.equal(crearProvider({ cwd, config: { provider: "ollama" } }).resolveModelId("haiku"), "modelo-nuevo-1.0");
      });
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  });

  test("un nivel desconocido en modelos: impide empezar y nombra la clave", () => {
    const cwd = proyecto("modelos:\n  sonet: claude-sonnet-5-5\n");
    try {
      assert.throws(() => leerConfigCiclo(cwd), /modelos\.sonet/);
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  });
});

describe("CA-002-02: la lista incluida lleva fecha de revisión", () => {
  test("REVISADA es una fecha AAAA-MM-DD válida", () => {
    assert.match(REVISADA, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(Number.isFinite(Date.parse(REVISADA)));
  });

  test("la línea que muestran status y doctor contiene la fecha", () => {
    assert.ok(lineaRevision().includes(REVISADA));
  });

  test("cada precio de la tabla es un número no negativo con entrada y salida", () => {
    for (const [proveedor, modelos] of Object.entries(TABLA)) {
      for (const [id, p] of Object.entries(modelos)) {
        for (const campo of ["entrada", "salida"]) {
          assert.ok(typeof p[campo] === "number" && p[campo] >= 0, `${proveedor}/${id}.${campo}`);
        }
      }
    }
  });

  test("forge status y forge doctor imprimen la línea de revisión", () => {
    const raiz = new URL("..", import.meta.url);
    assert.match(readFileSync(new URL("core/engine-cli.js", raiz), "utf8"), /lineaRevision\(\)/);
    assert.match(readFileSync(new URL("cli/index.js", raiz), "utf8"), /lineaRevision\(\)/);
  });
});

describe("CA-002-03: un modelo sin precio se cobra al más caro conocido y deja aviso", () => {
  test("precio más alto conocido, también contando lo configurado", () => {
    const caro = precioMasCaro();
    for (const modelos of Object.values(PRECIOS_POR_PROVEEDOR)) {
      for (const p of Object.values(modelos)) {
        assert.ok(p.input <= caro.input && p.output <= caro.output);
      }
    }
    assert.deepEqual(PRECIO_DESCONOCIDO, caro);
    assert.deepEqual(precioDe("anthropic", "claude-del-futuro"), caro);
    assert.equal(tienePrecio("anthropic", "claude-del-futuro"), false);

    const precios = { "modelo-carisimo": { input: 500 / M, output: 900 / M } };
    assert.deepEqual(precioDe("anthropic", "claude-del-futuro", undefined, precios), { input: 500 / M, output: 900 / M });
  });

  /** deps mínimos para ejecutar el nodo planner con una respuesta fija. */
  function depsCon(respuesta, config = {}) {
    const eventos = [];
    return {
      eventos,
      deps: {
        aliasDe: () => "sonnet",
        llamar: async () => ({ ok: true, output: "{}", ...respuesta }),
        log: { append: (type, payload, meta) => eventos.push({ type, payload, meta }) },
        config: { motor: { nivel_maximo: "opus" }, presupuesto: { degradar_a: "escalon" }, precios: {}, ...config },
      },
    };
  }
  const estado = () => estadoInicial({ id: "T1", agente: "tester", descripcion: "x", archivos: [] }, { runId: "r", cwd: "/p", tope_usd: 100, umbral_degradacion_usd: 90 });

  test("el ciclo registra un evento con el nombre del modelo", async () => {
    const { deps, eventos } = depsCon({ proveedor: "anthropic", modelo: "claude-del-futuro", inputTokens: 1000, outputTokens: 100 });
    const r = await planner(estado(), deps);
    const avisos = eventos.filter((e) => e.type === "ciclo:precio_desconocido");
    assert.equal(avisos.length, 1);
    assert.equal(avisos[0].payload.modelo, "claude-del-futuro");
    assert.equal(avisos[0].payload.proveedor, "anthropic");
    assert.equal(avisos[0].meta.taskId, "T1");
    const caro = precioMasCaro();
    assert.ok(Math.abs(r.presupuesto.gastado_usd - (1000 * caro.input + 100 * caro.output)) < 1e-12);
  });

  test("un modelo con precio (de la tabla o configurado) no deja aviso, ni uno local", async () => {
    for (const [respuesta, config] of [
      [{ proveedor: "anthropic", modelo: "claude-sonnet-4-6", inputTokens: 10, outputTokens: 10 }, {}],
      [{ proveedor: "anthropic", modelo: "claude-del-futuro", inputTokens: 10, outputTokens: 10 }, { precios: { "claude-del-futuro": { input: 1 / M, output: 2 / M } } }],
      [{ proveedor: "ollama", modelo: "llama3.2:3b", inputTokens: 10, outputTokens: 10 }, {}],
      [{ proveedor: "stub", modelo: "stub-sonnet", inputTokens: 0, outputTokens: 0 }, {}],
    ]) {
      const { deps, eventos } = depsCon(respuesta, config);
      await planner(estado(), deps);
      assert.equal(eventos.filter((e) => e.type === "ciclo:precio_desconocido").length, 0, JSON.stringify(respuesta));
    }
  });
});

describe("CA-002-04: un precio no numérico o negativo impide empezar el ciclo", () => {
  for (const [nombre, linea, clave] of [
    ["no numérico", "  claude-sonnet-4-6_entrada: barato\n  claude-sonnet-4-6_salida: 15\n", "precios.claude-sonnet-4-6_entrada"],
    ["negativo", "  claude-sonnet-4-6_entrada: 3\n  claude-sonnet-4-6_salida: -15\n", "precios.claude-sonnet-4-6_salida"],
    ["sin valor", "  claude-sonnet-4-6_entrada:\n  claude-sonnet-4-6_salida: 15\n", "precios.claude-sonnet-4-6_entrada"],
    ["sin su pareja", "  claude-sonnet-4-6_entrada: 3\n", "precios.claude-sonnet-4-6_salida"],
    ["clave sin sufijo", "  claude-sonnet-4-6: 3\n", "precios.claude-sonnet-4-6"],
  ]) {
    test(`${nombre}: el error nombra ${clave}`, () => {
      const cwd = proyecto(`precios:\n${linea}`);
      try {
        assert.throws(() => leerConfigCiclo(cwd), (e) => e instanceof Error && e.message.includes(clave));
      } finally { rmSync(cwd, { recursive: true, force: true }); }
    });
  }

  test("un precio 0 es válido", () => {
    const cwd = proyecto("precios:\n  local-x_entrada: 0\n  local-x_salida: 0\n");
    try {
      assert.deepEqual(leerConfigCiclo(cwd).precios["local-x"], { input: 0, output: 0 });
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  });
});

describe("CA-002-05: sin nada indicado, el comportamiento es el de la lista incluida", () => {
  test("sin archivo de configuración no hay modelos ni precios propios", () => {
    const cwd = proyecto(undefined);
    try {
      const config = leerConfigCiclo(cwd);
      assert.deepEqual(config.modelos, {});
      assert.deepEqual(config.precios, {});
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  });

  test("los niveles por defecto de cada proveedor no cambian", () => {
    const cwd = proyecto("llm:\n  model: sonnet\n");
    try {
      sinEntorno(() => {
        const a = crearProvider({ cwd, config: { provider: "anthropic" } });
        assert.deepEqual(["opus", "sonnet", "haiku"].map((n) => a.resolveModelId(n)), ["claude-opus-4-8", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"]);
        const o = crearProvider({ cwd, config: { provider: "openai" } });
        assert.deepEqual(["opus", "sonnet", "haiku"].map((n) => o.resolveModelId(n)), ["gpt-4o", "gpt-4o-mini", "gpt-4o-mini"]);
        const l = crearProvider({ cwd, config: { provider: "ollama" } });
        assert.deepEqual(["opus", "sonnet", "haiku"].map((n) => l.resolveModelId(n)), ["deepseek-r1:14b", "qwen2.5-coder:7b", "llama3.2:3b"]);
        assert.equal(crearProvider({ cwd, config: { provider: "stub" } }).resolveModelId("sonnet"), "stub-sonnet");
      });
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  });

  test("los precios salen de la tabla incluida, en USD por token", () => {
    for (const [proveedor, modelos] of Object.entries(TABLA)) {
      for (const [id, p] of Object.entries(modelos)) {
        assert.deepEqual(precioDe(proveedor, id), { input: p.entrada / M, output: p.salida / M });
        assert.equal(tienePrecio(proveedor, id), true);
      }
    }
    assert.deepEqual(precioDe("anthropic", "claude-sonnet-4-6"), { input: 3 / M, output: 15 / M });
  });

  test("los proveedores sin costo siguen sin costar", () => {
    assert.ok(PROVEEDORES_SIN_COSTO.has("ollama") && PROVEEDORES_SIN_COSTO.has("stub"));
    assert.deepEqual(precioDe("stub", "stub-sonnet"), { input: 0, output: 0 });
    assert.equal(tienePrecio("ollama", "lo-que-sea"), true);
  });
});
