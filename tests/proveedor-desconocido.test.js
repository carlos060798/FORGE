// @ts-check
/**
 * Un nombre de proveedor que no se reconoce es un error, no un salto silencioso a Anthropic (informe de agnosticismo del
 * 2026-11-24, MEDIO-4). Constitución: «NO degradar en silencio: si el proveedor no está disponible, se informa y se detiene»
 * y «NO fijar un proveedor de modelos». Hasta ahora, `llm.provider: opnai` (o `FORGE_LLM_PROVIDER=mistral`, que no está
 * soportado; `gemini` sí lo está desde ADR-27) avisaba por consola y seguía con Anthropic: enviaba el código y los prompts del usuario a un proveedor que no
 * eligió. Criterios CA-004-04 y CA-004-05 de la spec 2026-11-12-proveedor-no-fijado.
 */
import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { ErrorProveedorDesconocido, crearProvider } from "../core/llm-providers/index.js";

const CLI = join(resolve(dirname(fileURLToPath(import.meta.url)), ".."), "cli", "index.js");
const VARIABLES = ["FORGE_LLM_PROVIDER", "FRAGUA_LLM_PROVIDER", "ANTHROPIC_API_KEY", "CLAUDE_API_KEY", "OPENAI_API_KEY", "OLLAMA_BASE_URL", "OPENAI_BASE_URL"];
let guardado = {};
let cwd = "";

beforeEach(() => {
  guardado = Object.fromEntries(VARIABLES.map((v) => [v, process.env[v]]));
  for (const v of VARIABLES) delete process.env[v];
  cwd = realpathSync(mkdtempSync(join(tmpdir(), "forge-prov-")));
});
afterEach(() => {
  for (const v of VARIABLES) { if (guardado[v] === undefined) delete process.env[v]; else process.env[v] = guardado[v]; }
  rmSync(cwd, { recursive: true, force: true });
});

const aviso = (/** @type {Error} */ e) => String(e.message);

describe("crearProvider: un nombre desconocido se detiene", () => {
  test("`config.provider` desconocido lanza un error que lo nombra y lista los válidos", () => {
    assert.throws(() => crearProvider({ cwd, config: { provider: "opnai" } }), (e) => {
      const m = aviso(/** @type {Error} */ (e));
      return /desconocido/i.test(m) && m.includes('"opnai"') && /anthropic/.test(m) && /openai/.test(m) && /ollama/.test(m) && /stub/.test(m);
    });
  });
  test("el mensaje dice por qué no se usa otro proveedor y cómo corregirlo", () => {
    assert.throws(() => crearProvider({ cwd, config: { provider: "mistral" } }), (e) => {
      const m = aviso(/** @type {Error} */ (e));
      return /no (se )?usa(rá)? otro|en vez de usar otro|no elegiste|no elegido/i.test(m) && /LLM_PROVIDER/.test(m) && /sdd\.config\.yaml/.test(m);
    });
  });
  test("el error es de una clase propia, con el nombre recibido: nadie decide buscando texto en el mensaje", () => {
    try { crearProvider({ cwd, config: { provider: "opnai" } }); assert.fail("debía lanzar"); } catch (e) {
      assert.ok(e instanceof ErrorProveedorDesconocido);
      assert.ok(e instanceof Error);
      assert.equal(/** @type {any} */ (e).nombre, "opnai");
      assert.equal(/** @type {any} */ (e).code, "proveedor_desconocido");
    }
  });
  test("fijado con FORGE_LLM_PROVIDER también se detiene, aunque haya una clave de Anthropic", () => {
    process.env.FORGE_LLM_PROVIDER = "opnai";
    process.env.ANTHROPIC_API_KEY = "sk-ant-x";
    assert.throws(() => crearProvider({ cwd }), /"opnai"/);
  });
  test("fijado en el sdd.config.yaml del proyecto también se detiene", () => {
    mkdirSync(join(cwd, ".sdd"), { recursive: true });
    writeFileSync(join(cwd, ".sdd", "sdd.config.yaml"), "llm:\n  provider: nada\n");
    process.env.ANTHROPIC_API_KEY = "sk-ant-x";
    assert.throws(() => crearProvider({ cwd }), /"nada"/);
  });
  test("no avisa por consola «Usando anthropic» ni construye un proveedor de Anthropic", (t) => {
    const avisos = [];
    t.mock.method(console, "warn", (...a) => { avisos.push(a.join(" ")); });
    let construido = null;
    try { construido = crearProvider({ cwd, config: { provider: "opnai" } }); } catch { /* se espera */ }
    assert.equal(construido, null);
    assert.deepEqual(avisos.filter((a) => /Usando anthropic/.test(a)), []);
  });
});

describe("crearProvider: lo que sí es válido sigue funcionando", () => {
  test("los proveedores y sus alias se reconocen", () => {
    const esperado = { anthropic: "anthropic", claude: "anthropic", openai: "openai", gpt: "openai", ollama: "ollama", local: "ollama", stub: "stub", test: "stub", gemini: "gemini", google: "gemini" };
    for (const [nombre, final] of Object.entries(esperado)) {
      assert.equal(crearProvider({ cwd, config: { provider: nombre } }).nombre, final, nombre);
    }
  });
  test("una URL http(s) sigue siendo un Ollama en esa dirección", () => {
    assert.equal(crearProvider({ cwd, config: { provider: "http://127.0.0.1:11434" } }).nombre, "ollama");
  });
  test("sin ninguna señal el respaldo histórico sigue siendo Anthropic (nadie eligió otro)", () => {
    assert.equal(crearProvider({ cwd }).nombre, "anthropic");
  });
  test("el resto de alias de OpenAI y Ollama no se confunden con «desconocido»", () => {
    for (const nombre of ["codex", "azure", "github-models", "cursor", "deepseek", "llama"]) {
      try { crearProvider({ cwd, config: { provider: nombre } }); } catch (e) { assert.doesNotMatch(aviso(/** @type {Error} */ (e)), /desconocido/i, nombre); }
    }
  });
});

describe("por la CLI", () => {
  /**
   * Ejecuta `fragua <args>` en un proyecto temporal con una tarea mínima y el proveedor `opnai`, que no existe.
   * @param {string[]} args @param {Record<string,string>} [env]
   */
  function ejecutar(args, env = { FORGE_LLM_PROVIDER: "opnai", ANTHROPIC_API_KEY: "sk-ant-falsa" }) {
    const proyecto = realpathSync(mkdtempSync(join(tmpdir(), "forge-prov-cli-")));
    const home = realpathSync(mkdtempSync(join(tmpdir(), "forge-prov-home-")));
    try {
      mkdirSync(join(proyecto, ".sdd"), { recursive: true });
      writeFileSync(join(proyecto, "package.json"), JSON.stringify({ name: "p", scripts: { test: "node --test" } }));
      writeFileSync(join(proyecto, "tareas.json"), JSON.stringify([{ id: "T1", agente: "desarrollador-backend", prompt: "x" }]));
      writeFileSync(join(proyecto, ".sdd", "estado.json"), JSON.stringify({ pipeline_step: "code" }));
      const e = { ...process.env, HOME: home, USERPROFILE: home };
      for (const v of VARIABLES) delete e[v];
      const r = spawnSync(process.execPath, [CLI, ...args], { cwd: proyecto, env: { ...e, ...env }, encoding: "utf8", timeout: 100_000 });
      return { codigo: r.status, salida: (r.stdout ?? "") + (r.stderr ?? "") };
    } finally { rmSync(proyecto, { recursive: true, force: true }); rmSync(home, { recursive: true, force: true }); }
  }
  test("doctor con un proveedor desconocido lo dice, con los válidos, en vez de usar Anthropic", () => {
    const s = ejecutar(["doctor"]).salida;
    assert.match(s, /desconocido/i);
    assert.match(s, /"opnai"/);
    assert.doesNotMatch(s, /Usando anthropic/);
  });
  test("run con el ciclo verificado se detiene con el error de configuración, antes que el aviso de Docker y sin volcado de pila", () => {
    const r = ejecutar(["run", "--motor", "ciclo", "--tasks", "tareas.json"]);
    assert.equal(r.codigo, 1, r.salida);
    assert.match(r.salida, /Proveedor de modelos desconocido: "opnai"/);
    assert.doesNotMatch(r.salida, /Docker no está disponible/);
    assert.doesNotMatch(r.salida, /\n\s+at .*\.js:\d+/, "sin traza de pila");
  });
  test("run con el motor clásico se detiene igual, con salida 1 y el mismo mensaje", () => {
    const r = ejecutar(["run", "--motor", "clasico", "--tasks", "tareas.json"]);
    assert.equal(r.codigo, 1, r.salida);
    assert.match(r.salida, /Proveedor de modelos desconocido: "opnai"/);
    assert.doesNotMatch(r.salida, /\n\s+at .*\.js:\d+/, "sin traza de pila");
  });
  test("resume se detiene igual", () => {
    const r = ejecutar(["resume"]);
    assert.equal(r.codigo, 1, r.salida);
    assert.match(r.salida, /Proveedor de modelos desconocido: "opnai"/);
  });
  test("con el proveedor de pruebas, run no cambia: no se queja del proveedor", () => {
    const r = ejecutar(["run", "--motor", "ciclo", "--tasks", "tareas.json"], { FORGE_LLM_PROVIDER: "stub" });
    assert.doesNotMatch(r.salida, /Proveedor de modelos desconocido/);
  });
});
