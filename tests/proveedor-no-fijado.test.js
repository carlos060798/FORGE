// @ts-check
/**
 * Spec 2026-11-12-proveedor-no-fijado (paso 3 del plan de cierre de la auditoría del 2026-11-11, hallazgo H4).
 * AGENTS.md: «NO fijar un proveedor de modelos en ningún módulo».
 * Pruebas escritas antes que el código (AGENTS.md, «Cómo se cambia algo»).
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { bus } from "../core/event-bus.js";
import { SessionBudget, PRECIO_DESCONOCIDO, PRECIOS_POR_PROVEEDOR } from "../core/session-budget.js";
import { esNivel } from "../core/llm-providers/niveles.js";
import { NIVELES_DEL_ASISTENTE, aplicarNivelAlYaml } from "../cli/comandos/instalar.js";
import { modeloValido } from "../cli/comandos/doctor.js";
import { ROOT } from "./instalacion-ayudas.js";

/** Un identificador de modelo de Claude escrito como cadena. */
const LITERAL_CLAUDE = /(['"`])claude-(?:opus|sonnet|haiku|fable|mythos)[\w.-]*\1/g;

/** Carpetas y archivos donde un proveedor o la tabla de precios conocen sus modelos: aquí sí corresponde. */
const EXCLUIDOS = ["core/llm-providers/", "core/precios.js"];

/**
 * Excepciones justificadas, `ruta → motivo`. La prueba falla si una entrada ya no se necesita.
 * Hoy no hay ninguna: todo lo demás debe resolverse por niveles neutrales o por la tabla de precios.
 * @type {Record<string, string>}
 */
const LISTA_BLANCA = {};

function archivosJs(dir) {
  const salida = [];
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) { if (nombre !== "node_modules") salida.push(...archivosJs(ruta)); } else if (nombre.endsWith(".js")) salida.push(ruta);
  }
  return salida;
}

/** @returns {Map<string, string[]>} ruta relativa → literales de Claude que contiene */
function literalesPorArchivo() {
  const mapa = new Map();
  for (const base of ["core", "cli"]) {
    for (const archivo of archivosJs(join(ROOT, base))) {
      const rel = relative(ROOT, archivo).split(sep).join("/");
      if (EXCLUIDOS.some((e) => rel === e || rel.startsWith(e))) continue;
      const hallados = [...readFileSync(archivo, "utf8").matchAll(LITERAL_CLAUDE)].map((m) => m[0]);
      if (hallados.length) mapa.set(rel, hallados);
    }
  }
  return mapa;
}

describe("HU-004: ningún módulo del motor ni de la CLI fija un modelo de Claude", () => {
  test("CA-004-01: fuera de los proveedores y de la tabla de precios no hay literales de modelos de Claude", () => {
    const hallados = literalesPorArchivo();
    const sinJustificar = [...hallados.entries()].filter(([ruta]) => !Object.hasOwn(LISTA_BLANCA, ruta));
    assert.deepEqual(sinJustificar, [], "Un módulo fija un modelo de Claude: resuélvelo con un nivel neutral (core/llm-providers/niveles.js) o con la tabla de precios (core/precios.js), o justifícalo en LISTA_BLANCA");
  });

  test("CA-004-02: cada entrada de la lista blanca tiene motivo y sigue haciendo falta", () => {
    const hallados = literalesPorArchivo();
    for (const [ruta, motivo] of Object.entries(LISTA_BLANCA)) {
      assert.ok(motivo.trim().length >= 20, `${ruta}: la justificación es demasiado corta`);
      assert.ok(hallados.has(ruta), `${ruta} ya no contiene ningún literal: quítalo de LISTA_BLANCA`);
    }
  });

  test("la regla sí detecta un literal (la prueba no es vacua)", () => {
    assert.equal([...`const m = 'claude-sonnet-4-6';`.matchAll(LITERAL_CLAUDE)].length, 1);
    assert.equal([...`// comentario sobre claude-sonnet-4-6 sin comillas`.matchAll(LITERAL_CLAUDE)].length, 0);
  });
});

describe("HU-001: el acumulador de gasto no depende de un modelo concreto", () => {
  test("CA-001-02: un modelo desconocido se valora al precio más caro conocido", async () => {
    const p = new SessionBudget(1000);
    await bus.emit("agent:result", { modelo: "modelo-que-no-existe-9", tokens_input: 1000, tokens_output: 1000 });
    const esperado = 1000 * PRECIO_DESCONOCIDO.input + 1000 * PRECIO_DESCONOCIDO.output;
    assert.ok(p.snapshot().costo_usd >= esperado - 1e-9, `${p.snapshot().costo_usd} < ${esperado}`);
  });

  test("CA-001-02: nunca marca menos que el modelo conocido más barato", async () => {
    const p = new SessionBudget(1000);
    await bus.emit("agent:result", { modelo: "otro-modelo-sin-precio", tokens_input: 1000, tokens_output: 1000 });
    const masBarato = Math.min(...Object.values(PRECIOS_POR_PROVEEDOR).flatMap((t) => Object.values(t)).map((x) => 1000 * x.input + 1000 * x.output));
    assert.ok(p.snapshot().costo_usd >= masBarato);
  });

  test("CA-001-03: un modelo conocido se valora con su propia tabla", async () => {
    const modelo = Object.keys(PRECIOS_POR_PROVEEDOR.openai)[0];
    const x = PRECIOS_POR_PROVEEDOR.openai[modelo];
    const p = new SessionBudget(1000);
    await bus.emit("agent:result", { modelo, tokens_input: 1000, tokens_output: 1000 });
    assert.ok(Math.abs(p.snapshot().costo_usd - (1000 * x.input + 1000 * x.output)) < 1e-6);
  });
});

describe("HU-002: doctor valida con los niveles neutrales", () => {
  test("CA-002-01: niveles neutrales, alias heredados y modelos de cualquier tabla de precios son válidos", () => {
    for (const v of ["alto", "medio", "economico", "opus", "sonnet", "haiku"]) assert.equal(modeloValido(v), true, v);
    for (const proveedor of Object.keys(PRECIOS_POR_PROVEEDOR)) {
      for (const modelo of Object.keys(PRECIOS_POR_PROVEEDOR[proveedor])) assert.equal(modeloValido(modelo), true, modelo);
    }
    assert.equal(modeloValido("gpt-4o"), true);
  });

  test("CA-002-02: un valor que no es ninguno de ellos no es válido", () => {
    for (const v of ["inventado-9", "", "claude", "SONNET "]) assert.equal(modeloValido(v), false, JSON.stringify(v));
  });
});

describe("HU-003: el asistente guiado ofrece niveles neutrales", () => {
  const YAML = [
    "agentes:",
    "  arquitecto:",
    "    modelo: opus  # decisiones difíciles",
    "  tester:",
    "    modelo: sonnet",
    "  documentador:",
    "    modelo: haiku",
    "  otro:",
    "    modelo: gpt-4o   # identificador directo",
    "  neutro:",
    "    modelo: alto",
    "",
  ].join("\n");

  test("CA-003-01: los niveles que ofrece son neutrales y ninguno es un modelo", () => {
    assert.deepEqual([...NIVELES_DEL_ASISTENTE], ["alto", "medio", "economico"]);
    for (const n of NIVELES_DEL_ASISTENTE) { assert.ok(esNivel(n), n); assert.ok(!/claude/i.test(n), n); }
  });

  test("CA-003-02: `alto` no cambia nada", () => {
    assert.equal(aplicarNivelAlYaml(YAML, "alto"), YAML);
  });

  test("CA-003-02: `medio` baja lo que está por encima, conserva el juego de nombres y los comentarios", () => {
    const r = aplicarNivelAlYaml(YAML, "medio");
    assert.match(r, /modelo: sonnet {2}# decisiones difíciles/);
    assert.match(r, /modelo: sonnet\n/);
    assert.match(r, /modelo: haiku\n/);
    assert.match(r, /modelo: medio\n/, "un nivel neutral se baja con nombre neutral");
    assert.match(r, /modelo: gpt-4o {3}# identificador directo/, "un identificador directo no se toca");
  });

  test("CA-003-02: `economico` lo baja todo lo que es un nivel", () => {
    const r = aplicarNivelAlYaml(YAML, "economico");
    assert.equal((r.match(/modelo: haiku/g) ?? []).length, 3);
    assert.match(r, /modelo: economico\n/);
    assert.match(r, /modelo: gpt-4o/);
  });

  test("CA-003-02: sobre la configuración de ejemplo real, `economico` no deja ningún nivel por encima", () => {
    const real = readFileSync(join(ROOT, "configuracion-ejemplo", "sdd.config.yaml"), "utf8");
    const r = aplicarNivelAlYaml(real, "economico");
    const valores = [...r.matchAll(/^\s*modelo:\s*([\w.-]+)/gm)].map((m) => m[1]).filter(esNivel);
    assert.ok(valores.length > 0);
    assert.ok(valores.every((v) => v === "haiku" || v === "economico"), valores.join(","));
  });

  test("un nivel desconocido no cambia nada", () => {
    assert.equal(aplicarNivelAlYaml(YAML, "supremo"), YAML);
  });
});

describe("probar-modelo no supone Anthropic", async () => {
  const { probarModelo } = await import("../core/probar-modelo.js");
  const { proveedorPorCredenciales } = await import("../core/llm-providers/index.js");
  const SIN_CREDENCIALES = { ANTHROPIC_API_KEY: "", CLAUDE_API_KEY: "", OPENAI_API_KEY: "", OLLAMA_BASE_URL: "", FORGE_LLM_PROVIDER: "", FRAGUA_LLM_PROVIDER: "" };

  test("las credenciales sugieren el proveedor, con Anthropic primero", () => {
    assert.equal(proveedorPorCredenciales({}), null);
    assert.equal(proveedorPorCredenciales({ OPENAI_API_KEY: "x" }), "openai");
    assert.equal(proveedorPorCredenciales({ OLLAMA_BASE_URL: "http://localhost:11434" }), "ollama");
    assert.equal(proveedorPorCredenciales({ ANTHROPIC_API_KEY: "a", OPENAI_API_KEY: "o" }), "anthropic");
  });

  test("sin ninguna credencial se niega, pidiendo la de cualquier proveedor", async () => {
    const r = await probarModelo({ env: SIN_CREDENCIALES, tope: 99 });
    assert.equal(r.ok, false);
    assert.match(String(r.motivoNoEjecutada), /ningún proveedor de modelos real/);
    assert.match(String(r.motivoNoEjecutada), /OPENAI_API_KEY/);
  });

  test("con solo OPENAI_API_KEY u Ollama supera la guarda de proveedor (llega a validar el tope)", async () => {
    for (const env of [{ ...SIN_CREDENCIALES, OPENAI_API_KEY: "sk-x" }, { ...SIN_CREDENCIALES, OLLAMA_BASE_URL: "http://localhost:11434" }]) {
      const r = await probarModelo({ env, tope: 99 });
      assert.equal(r.ok, false);
      assert.match(String(r.motivoNoEjecutada), /tope debe ser/, "no debe quedarse en «no hay proveedor»");
    }
  });
});
