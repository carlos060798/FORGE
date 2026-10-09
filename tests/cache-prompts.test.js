// @ts-check
/**
 * Caché de prompts (spec 2026-10-09-puesta-al-dia, HU-001). Cubre CA-001-01 a CA-001-05.
 *
 * Todo con un cliente falso del SDK: ningún test llama a un modelo. Lo que estos tests
 * NO pueden demostrar es el ahorro real (hace falta un modelo de pago): comprueban que la
 * petición lleva la marca, que cada tipo de token se cobra a su precio y que el libro
 * de gasto lo registra.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AnthropicProvider, cacheActiva, sistemaConCache } from "../core/llm-providers/anthropic-provider.js";
import { StubProvider, crearProvider } from "../core/llm-providers/index.js";
import { AgentRegistry, LlmAgentAdapter } from "../core/agent-registry.js";
import { MULTIPLICADOR_ESCRITURA_5M, TABLA, preciosCache } from "../core/precios.js";
import { precioCompletoDe } from "../core/session-budget.js";
import { costoDe, registrar } from "../core/ciclo/presupuesto.js";
import { estadoInicial, validarEstado } from "../core/ciclo/estado.js";
import { LibroDeGasto } from "../core/ciclo/diario.js";
import { CicloVerificado, crearLlamador, lineasEstadoCiclo } from "../core/ciclo/index.js";
import { POR_DEFECTO, leerConfigCiclo } from "../core/ciclo/config.js";

const M = 1_000_000;
const CACHE = { type: "ephemeral" };

/**
 * Cliente falso del SDK. Anota cada petición y responde con el `usage` que toque.
 * Con `simularCache`, se comporta como la caché real para el prompt de sistema: la primera
 * vez que ve un prefijo marcado lo «guarda» y las siguientes lo «reutiliza».
 * @param {{ usage?: object, simularCache?: boolean, tokensPorCaracter?: number }} [o]
 */
function clienteFalso(o = {}) {
  /** @type {any[]} */
  const peticiones = [];
  const guardados = new Set();
  const tokens = (/** @type {string} */ t) => Math.ceil(t.length * (o.tokensPorCaracter ?? 1));
  const cliente = {
    messages: {
      create: async (/** @type {any} */ cuerpo, /** @type {any} */ opciones) => {
        peticiones.push({ cuerpo, opciones });
        let usage = o.usage ?? { input_tokens: 100, output_tokens: 20 };
        if (o.simularCache) {
          const usuario = tokens(cuerpo.messages[0].content);
          if (typeof cuerpo.system === "string") {
            usage = { input_tokens: tokens(cuerpo.system) + usuario, output_tokens: 20, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };
          } else {
            const corte = cuerpo.system.findLastIndex((/** @type {any} */ b) => b.cache_control);
            const prefijo = cuerpo.system.slice(0, corte + 1).map((/** @type {any} */ b) => b.text).join("");
            const resto = cuerpo.system.slice(corte + 1).map((/** @type {any} */ b) => b.text).join("");
            const clave = `${cuerpo.model}\n${prefijo}`;
            const acierto = guardados.has(clave);
            guardados.add(clave);
            usage = {
              input_tokens: tokens(resto) + usuario, output_tokens: 20,
              cache_creation_input_tokens: acierto ? 0 : tokens(prefijo),
              cache_read_input_tokens: acierto ? tokens(prefijo) : 0,
            };
          }
        }
        return { content: [{ type: "text", text: "hola" }, { type: "thinking", thinking: "x" }, { type: "text", text: "mundo" }], usage };
      },
    },
  };
  return { cliente, peticiones };
}

/** @param {object} [config] @param {object} [o] */
function proveedorFalso(config = {}, o = {}) {
  const falso = clienteFalso(o);
  /** @type {any[]} */
  const creados = [];
  const proveedor = new AnthropicProvider({ api_key: "clave-de-prueba", ...config, crearCliente: (/** @type {any} */ op) => { creados.push(op); return falso.cliente; } });
  return { proveedor, creados, ...falso };
}

const presupuestoNuevo = () =>
  estadoInicial({ id: "T1", agente: "tester" }, { runId: "r", cwd: "/p", tope_usd: 100, umbral_degradacion_usd: 90 }).presupuesto;

function proyecto(yaml) {
  const cwd = mkdtempSync(join(tmpdir(), "forge-cache-"));
  if (yaml !== undefined) {
    mkdirSync(join(cwd, ".sdd"), { recursive: true });
    writeFileSync(join(cwd, ".sdd", "sdd.config.yaml"), yaml);
  }
  return cwd;
}

/** Ejecuta `fn` sin las variables de entorno que cambian el proveedor. */
async function sinEntorno(fn) {
  const claves = ["FORGE_LLM_PROVIDER", "ANTHROPIC_API_KEY", "CLAUDE_API_KEY", "OPENAI_API_KEY", "OLLAMA_BASE_URL"];
  const previo = Object.fromEntries(claves.map((k) => [k, process.env[k]]));
  for (const k of claves) delete process.env[k];
  try { return await fn(); } finally {
    for (const k of claves) if (previo[k] !== undefined) process.env[k] = previo[k];
  }
}

describe("CA-001-01 — la parte fija de la llamada se marca como reutilizable", () => {
  test("el prompt de sistema va como un bloque de texto con cache_control efímero", async () => {
    const { proveedor, peticiones, creados } = proveedorFalso();
    await proveedor.complete({ model: "sonnet", systemPrompt: "Eres un implementador.", userPrompt: "tarea 1" });
    assert.deepEqual(peticiones[0].cuerpo.system, [{ type: "text", text: "Eres un implementador.", cache_control: CACHE }]);
    assert.deepEqual(peticiones[0].cuerpo.messages, [{ role: "user", content: "tarea 1" }], "el mensaje del usuario no cambia");
    assert.deepEqual(creados, [{ apiKey: "clave-de-prueba" }]);
  });

  test("con una parte variable al final, el corte queda justo antes: lo variable no rompe el prefijo", async () => {
    const { proveedor, peticiones } = proveedorFalso();
    await proveedor.complete({ model: "sonnet", systemPrompt: "FIJO\nestado: 1", systemFijo: "FIJO", userPrompt: "x" });
    assert.deepEqual(peticiones[0].cuerpo.system, [
      { type: "text", text: "FIJO", cache_control: CACHE },
      { type: "text", text: "\nestado: 1" },
    ]);
  });

  test("una parte fija que no es prefijo del prompt se ignora: se marca el prompt entero", () => {
    assert.deepEqual(sistemaConCache("abc", "zzz"), [{ type: "text", text: "abc", cache_control: CACHE }]);
    assert.deepEqual(sistemaConCache("abc", "abc"), [{ type: "text", text: "abc", cache_control: CACHE }]);
    assert.equal(sistemaConCache("", "x"), "", "un prompt vacío no se convierte en un bloque vacío");
  });

  test("devuelve los tokens de caché además de los de entrada y salida", async () => {
    const { proveedor } = proveedorFalso({}, { usage: { input_tokens: 7, output_tokens: 3, cache_creation_input_tokens: 900, cache_read_input_tokens: 1200 } });
    const r = await proveedor.complete({ model: "sonnet", systemPrompt: "s", userPrompt: "u" });
    assert.deepEqual(r, { output: "hola\nmundo", inputTokens: 7, outputTokens: 3, cacheCreationTokens: 900, cacheReadTokens: 1200 });
  });

  test("si la respuesta no trae contadores de caché (o son null), cuentan cero", async () => {
    for (const usage of [{ input_tokens: 7, output_tokens: 3 }, { input_tokens: 7, output_tokens: 3, cache_creation_input_tokens: null, cache_read_input_tokens: null }]) {
      const { proveedor } = proveedorFalso({}, { usage });
      const r = await proveedor.complete({ model: "sonnet", systemPrompt: "s", userPrompt: "u" });
      assert.equal(r.cacheCreationTokens, 0);
      assert.equal(r.cacheReadTokens, 0);
    }
  });

  test("la señal de cancelación y el modelo del nivel siguen llegando al SDK", async () => {
    const { proveedor, peticiones } = proveedorFalso({ modelos: { sonnet: "claude-sonnet-5-5" } });
    const señal = new AbortController().signal;
    await proveedor.complete({ model: "sonnet", systemPrompt: "s", userPrompt: "u", maxTokens: 50, signal: señal });
    assert.equal(peticiones[0].cuerpo.model, "claude-sonnet-5-5");
    assert.equal(peticiones[0].cuerpo.max_tokens, 50);
    assert.equal(peticiones[0].opciones.signal, señal);
  });

  test("sin inyectar cliente, el comportamiento por defecto no cambia: sin clave responde el aviso de siempre", async () => {
    await sinEntorno(async () => {
      const r = await new AnthropicProvider({}).complete({ model: "sonnet", systemPrompt: "s", userPrompt: "hola" });
      assert.deepEqual(r, { output: "[stub-anthropic] sin SDK o API key. Prompt: hola" });
    });
  });
});

describe("CA-001-01 — el orden del prompt de sistema: lo fijo primero", () => {
  /** Proveedor que solo anota lo que recibe. */
  function espia(respuesta = { output: "ok", inputTokens: 1, outputTokens: 1 }) {
    /** @type {any[]} */
    const vistas = [];
    return { vistas, nombre: "anthropic", resolveModelId: (/** @type {string} */ a) => `id-${a}`, complete: async (/** @type {any} */ p) => { vistas.push(p); return respuesta; } };
  }
  const DEF = { name: "implementador", model: "sonnet", systemPrompt: "INSTRUCCIONES", goal: "META" };

  test("instrucciones, objetivo y contrato van antes que el estado, que es lo único que cambia", async () => {
    const p = espia();
    const adaptador = new LlmAgentAdapter(DEF, undefined, undefined, process.cwd(), p);
    await adaptador.execute({ userPrompt: "u", extraContext: "CONTRATO", forgeState: '{"n":1}' });
    const { systemPrompt, systemFijo } = p.vistas[0];
    assert.ok(systemPrompt.indexOf("INSTRUCCIONES") < systemPrompt.indexOf("META"));
    assert.ok(systemPrompt.indexOf("META") < systemPrompt.indexOf("CONTRATO"));
    assert.ok(systemPrompt.indexOf("CONTRATO") < systemPrompt.indexOf('{"n":1}'), "el estado va al final");
    assert.ok(systemPrompt.startsWith(systemFijo), "la parte fija es un prefijo exacto");
    assert.ok(!systemFijo.includes('{"n":1}'), "la parte fija no contiene el estado");
  });

  test("dos llamadas con distinto estado y distinta petición comparten la misma parte fija, byte a byte", async () => {
    const p = espia();
    const adaptador = new LlmAgentAdapter(DEF, undefined, undefined, process.cwd(), p);
    await adaptador.execute({ userPrompt: "iteración 1", extraContext: "CONTRATO", forgeState: '{"n":1}' });
    await adaptador.execute({ userPrompt: "iteración 2: falló X", extraContext: "CONTRATO", forgeState: '{"n":2}' });
    assert.equal(p.vistas[0].systemFijo, p.vistas[1].systemFijo);
    assert.notEqual(p.vistas[0].systemPrompt, p.vistas[1].systemPrompt);
  });

  test("en el ciclo no hay estado: el prompt de sistema entero es la parte fija", async () => {
    const p = espia();
    const registro = new AgentRegistry();
    registro.register(DEF);
    const { llamar } = crearLlamador(registro, undefined, process.cwd(), { proveedor: p });
    await llamar({ agente: "implementador", modeloAlias: "sonnet", userPrompt: "u1", extraContext: "CONTRATO" });
    await llamar({ agente: "implementador", modeloAlias: "sonnet", userPrompt: "u2 distinto", extraContext: "CONTRATO" });
    assert.equal(p.vistas[0].systemPrompt, p.vistas[0].systemFijo);
    assert.equal(p.vistas[0].systemPrompt, p.vistas[1].systemPrompt, "nada variable entra en el prompt de sistema");
  });

  test("los tokens de caché viajan por el adaptador y por el llamador del ciclo", async () => {
    const p = espia({ output: "ok", inputTokens: 5, outputTokens: 2, cacheCreationTokens: 0, cacheReadTokens: 800 });
    const registro = new AgentRegistry();
    registro.register(DEF);
    const r = await crearLlamador(registro, undefined, process.cwd(), { proveedor: p }).llamar({ agente: "implementador", modeloAlias: "sonnet", userPrompt: "u" });
    assert.deepEqual(
      { in: r.inputTokens, out: r.outputTokens, escritura: r.cacheCreationTokens, lectura: r.cacheReadTokens, modelo: r.modelo, proveedor: r.proveedor },
      { in: 5, out: 2, escritura: 0, lectura: 800, modelo: "id-sonnet", proveedor: "anthropic" },
    );
  });
});

describe("CA-001-02 y CA-001-03 — cada tipo de token a su precio", () => {
  const SONNET = { proveedor: "anthropic", modelo: "claude-sonnet-4-6" };   // 3 / 15 / 3,75 / 0,30 por millón

  test("la lista incluida da los precios de escritura (5 min) y de lectura de cada modelo de Anthropic", () => {
    assert.deepEqual(preciosCache("anthropic", "claude-sonnet-4-6"), { escritura: 3.75 / M, lectura: 0.3 / M });
    assert.deepEqual(preciosCache("anthropic", "claude-opus-5-5"), { escritura: 5 / M, lectura: 0.2 / M });
    assert.equal(preciosCache("anthropic", "modelo-inventado"), null);
    assert.equal(preciosCache("openai", "gpt-4o"), null, "un modelo sin precios de caché en la lista");
    for (const id of Object.keys(TABLA.anthropic)) assert.ok(preciosCache("anthropic", id), id);
  });

  test("el costo suma entrada normal, escritura, lectura y salida, cada una a su precio", () => {
    const usd = costoDe({ ...SONNET, inputTokens: 1000, outputTokens: 500, cacheCreationTokens: 2000, cacheReadTokens: 4000 });
    assert.ok(Math.abs(usd - (1000 * 3 + 500 * 15 + 2000 * 3.75 + 4000 * 0.3) / M) < 1e-12);
  });

  test("registrar acumula el gasto y los tokens de cada tipo", () => {
    let p = registrar(presupuestoNuevo(), { ...SONNET, inputTokens: 100, outputTokens: 10, cacheCreationTokens: 2000, cacheReadTokens: 0 });
    p = registrar(p, { ...SONNET, inputTokens: 120, outputTokens: 10, cacheCreationTokens: 0, cacheReadTokens: 2000 });
    assert.equal(p.tokens_in, 220, "tokens_in sigue siendo la entrada a precio normal");
    assert.equal(/** @type {any} */ (p).tokens_cache_escritura, 2000);
    assert.equal(/** @type {any} */ (p).tokens_cache_lectura, 2000);
    assert.ok(Math.abs(p.gastado_usd - (220 * 3 + 20 * 15 + 2000 * 3.75 + 2000 * 0.3) / M) < 1e-12);
    assert.deepEqual(validarEstado({ ...estadoInicial({ id: "T1", agente: "a" }, { runId: "r", cwd: "/p" }), presupuesto: p }), [], "el estado con los campos nuevos sigue siendo válido");
  });

  test("sin tokens de caché el presupuesto conserva exactamente su forma de antes", () => {
    const antes = presupuestoNuevo();
    const p = registrar(antes, { ...SONNET, inputTokens: 100, outputTokens: 10 });
    assert.deepEqual(Object.keys(p).sort(), Object.keys(antes).sort());
    assert.ok(Math.abs(p.gastado_usd - (100 * 3 + 10 * 15) / M) < 1e-12);
    const q = registrar(antes, { ...SONNET, inputTokens: 100, outputTokens: 10, cacheCreationTokens: 0, cacheReadTokens: 0 });
    assert.deepEqual(q, p, "ceros de caché: mismo resultado que sin informar");
  });

  test("un modelo sin precios de caché: la lectura al precio de entrada y la escritura a 1,25 veces", () => {
    const precio = precioCompletoDe("openai", "gpt-4o");
    assert.equal(precio.cacheRead, precio.input);
    assert.equal(precio.cacheWrite, precio.input * MULTIPLICADOR_ESCRITURA_5M);
  });

  test("un modelo desconocido cobra la caché sobre el precio de entrada más caro conocido", () => {
    const caro = Math.max(...Object.values(TABLA.anthropic).map((p) => p.entrada)) / M;
    const precio = precioCompletoDe("anthropic", "claude-del-futuro");
    assert.equal(precio.input, caro);
    assert.equal(precio.cacheRead, caro);
    assert.equal(precio.cacheWrite, caro * MULTIPLICADOR_ESCRITURA_5M);
  });

  test("un precio fijado en el proyecto sin precios de caché: se cobra sobre ese precio de entrada, no sobre la lista", () => {
    const precios = { "claude-sonnet-4-6": { input: 6 / M, output: 30 / M } };
    assert.deepEqual(precioCompletoDe("anthropic", "claude-sonnet-4-6", undefined, precios), { input: 6 / M, output: 30 / M, cacheWrite: 7.5 / M, cacheRead: 6 / M });
  });

  test("nunca se registra menos de lo que cobra el proveedor: ningún precio de caché queda por debajo de la lista", () => {
    for (const [proveedor, modelos] of Object.entries(TABLA)) {
      for (const [id, p] of Object.entries(modelos)) {
        const precio = precioCompletoDe(proveedor, id);
        assert.ok(precio.cacheWrite >= (p.cache_escritura_5m ?? p.entrada) / M - 1e-15, `${id} escritura`);
        assert.ok(precio.cacheRead >= (p.cache_lectura ?? p.entrada) / M - 1e-15, `${id} lectura`);
        assert.ok(precio.cacheWrite >= precio.input, `${id}: guardar nunca es más barato que la entrada normal`);
      }
    }
  });

  test("los proveedores sin costo siguen costando cero", () => {
    assert.equal(costoDe({ proveedor: "ollama", modelo: "x", inputTokens: 10, outputTokens: 10, cacheCreationTokens: 10, cacheReadTokens: 10 }), 0);
  });

  test("precios de caché propios en sdd.config.yaml: opcionales y validados", () => {
    const base = "precios:\n  mi-modelo_entrada: 2\n  mi-modelo_salida: 8\n";
    const cwd = proyecto(base + "  mi-modelo_cache_escritura: 2.5\n  mi-modelo_cache_lectura: 0.2\n");
    const { precios } = leerConfigCiclo(cwd);
    assert.deepEqual(precios["mi-modelo"], { input: 2 / M, output: 8 / M, cacheWrite: 2.5 / M, cacheRead: 0.2 / M });
    assert.deepEqual(precioCompletoDe("anthropic", "mi-modelo", undefined, precios), { input: 2 / M, output: 8 / M, cacheWrite: 2.5 / M, cacheRead: 0.2 / M });
    assert.deepEqual(leerConfigCiclo(proyecto(base)).precios["mi-modelo"], { input: 2 / M, output: 8 / M }, "sin ellos, nada cambia");
    assert.throws(() => leerConfigCiclo(proyecto(base + "  mi-modelo_cache_lectura: barato\n")), /mi-modelo_cache_lectura/);
    assert.throws(() => leerConfigCiclo(proyecto("precios:\n  mi-modelo_cache_lectura: 0.2\n")), /mi-modelo_entrada/, "un precio de caché sin entrada ni salida no basta");
  });
});

describe("CA-001-02 — el libro de gasto distingue los tres tipos de entrada", () => {
  /** @param {(peticion: any) => Promise<any>} llamar */
  function ciclo(llamar) {
    const cwd = proyecto();
    return { cwd, ciclo: new CicloVerificado(/** @type {any} */ ({ cwd, runId: "r1", config: POR_DEFECTO, log: { append() {} }, llamar })) };
  }
  const lineas = (/** @type {CicloVerificado} */ c) => readFileSync(c.libro.archivo, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));

  test("cada línea de gasto.jsonl lleva la entrada normal, lo guardado, lo reutilizado y su costo", async () => {
    const respuesta = { ok: true, output: "x", proveedor: "anthropic", modelo: "claude-sonnet-4-6", inputTokens: 100, outputTokens: 10, cacheCreationTokens: 0, cacheReadTokens: 2000 };
    const { ciclo: c } = ciclo(async () => respuesta);
    await c._llamador("r1:T1", "T1")({ agente: "a", userPrompt: "u" });
    const [linea] = lineas(c);
    assert.deepEqual(
      { in: linea.inputTokens, out: linea.outputTokens, escritura: linea.cacheCreationTokens, lectura: linea.cacheReadTokens },
      { in: 100, out: 10, escritura: 0, lectura: 2000 },
    );
    assert.ok(Math.abs(linea.usd - (100 * 3 + 10 * 15 + 2000 * 0.3) / M) < 1e-12);
    assert.deepEqual(c.libro.total(), { usd: linea.usd, llamadas: 1, tokens_in: 100, tokens_out: 10, tokens_cache_escritura: 0, tokens_cache_lectura: 2000 });
  });

  test("el gasto del libro y el del presupuesto del estado coinciden", async () => {
    const respuesta = { ok: true, output: "x", proveedor: "anthropic", modelo: "claude-opus-5-5", inputTokens: 300, outputTokens: 40, cacheCreationTokens: 1500, cacheReadTokens: 700 };
    const { ciclo: c } = ciclo(async () => respuesta);
    await c._llamador("r1:T1", "T1")({ agente: "a", userPrompt: "u" });
    const p = registrar(presupuestoNuevo(), respuesta);
    assert.ok(Math.abs(c.libro.total().usd - p.gastado_usd) < 1e-15);
    const ajustado = c._ajustarGasto(presupuestoNuevo());
    assert.equal(ajustado.tokens_cache_escritura, 1500);
    assert.equal(ajustado.tokens_cache_lectura, 700);
  });

  test("`forge status` muestra los tokens reutilizados cuando los hay", () => {
    const libro = new LibroDeGasto(proyecto());
    libro.anotar({ taskId: "T1", usd: 0.01, inputTokens: 10, outputTokens: 2, cacheCreationTokens: 500, cacheReadTokens: 0 });
    libro.anotar({ taskId: "T1", usd: 0.001, inputTokens: 12, outputTokens: 2, cacheCreationTokens: 0, cacheReadTokens: 500 });
    assert.deepEqual(libro.total(), { usd: 0.011, llamadas: 2, tokens_in: 22, tokens_out: 4, tokens_cache_escritura: 500, tokens_cache_lectura: 500 });
    assert.deepEqual(lineasEstadoCiclo(proyecto()), [], "sin sesión no hay nada que mostrar");
  });

  test("Escenario 1 (con caché SIMULADA): tres iteraciones; la segunda y la tercera registran entrada a precio reducido", async () => {
    // El cliente falso imita la regla de la caché (prefijo exacto por modelo). No es el proveedor real:
    // demuestra la contabilidad, no el ahorro. Ver verificacion.md.
    const { proveedor } = proveedorFalso({ modelos: { sonnet: "claude-sonnet-5-5" } }, { simularCache: true });
    const registro = new AgentRegistry();
    registro.register({ name: "implementador", model: "sonnet", systemPrompt: "I".repeat(3000) });
    const { llamar } = crearLlamador(registro, undefined, process.cwd(), { proveedor });
    const { ciclo: c } = ciclo(llamar);
    const pedir = c._llamador("r1:T1", "T1");
    for (const n of [1, 2, 3]) {
      await pedir({ agente: "implementador", modeloAlias: "sonnet", userPrompt: `iteración ${n}: `.padEnd(400, "x"), extraContext: "C".repeat(1000) });
    }
    const [l1, l2, l3] = lineas(c);
    assert.ok(l1.cacheCreationTokens > 4000 && l1.cacheReadTokens === 0, "la primera guarda");
    for (const l of [l2, l3]) {
      assert.equal(l.cacheCreationTokens, 0);
      assert.equal(l.cacheReadTokens, l1.cacheCreationTokens, "las siguientes reutilizan lo guardado");
      assert.equal(l.inputTokens, 400, "a precio normal solo queda la petición");
      assert.ok(l.usd < l1.usd);
    }
    // Sin caché las tres pagarían toda la entrada a precio normal (2 USD por millón en este modelo)
    const entradaSinCache = 3 * (l1.cacheCreationTokens + 400) * 2 / M;
    const entradaConCache = [l1, l2, l3].reduce((s, l) => s + l.inputTokens * 2 / M + l.cacheCreationTokens * 2.5 / M + l.cacheReadTokens * 0.1 / M, 0);
    assert.ok(entradaConCache < entradaSinCache * 0.7, "con estos tamaños simulados, más de un 30 % menos de gasto de entrada");
  });
});

describe("CA-001-03 — el acumulador del modo clásico tampoco registra de menos", () => {
  test("los tokens de caché se suman al costo de la sesión, a su precio; sin ellos, el costo es el de antes", async () => {
    const { SessionBudget } = await import("../core/session-budget.js");
    const { bus } = await import("../core/event-bus.js");
    const acumulador = new SessionBudget(1000);
    const base = { agente: "a", taskId: "T1", modelo: "claude-sonnet-4-6", durationMs: 1, ok: true };
    await bus.emit("agent:result", { ...base, tokens_input: 1000, tokens_output: 100 });
    const sinCache = acumulador.snapshot().costo_usd;
    assert.ok(Math.abs(sinCache - (1000 * 3 + 100 * 15) / M) < 1e-9);
    await bus.emit("agent:result", { ...base, tokens_input: 0, tokens_output: 0, tokens_cache_escritura: 2000, tokens_cache_lectura: 4000 });
    assert.ok(Math.abs(acumulador.snapshot().costo_usd - sinCache - (2000 * 3.75 + 4000 * 0.3) / M) < 1e-9);
    assert.deepEqual(Object.keys(acumulador.snapshot()).sort(), ["alertas_emitidas", "costo_usd", "llamadas", "tokens_input", "tokens_output"], "la forma del resumen no cambia");
  });
});

describe("CA-001-04 — con un proveedor que no lo permite, nada cambia", () => {
  test("el proveedor de pruebas no devuelve campos de caché", async () => {
    const r = await new StubProvider().complete({ model: "sonnet", systemPrompt: "s", systemFijo: "s", userPrompt: "hola" });
    assert.deepEqual(Object.keys(r).sort(), ["inputTokens", "output", "outputTokens"]);
  });

  test("sin campos de caché, el adaptador, el llamador y el libro conservan su forma de antes", async () => {
    const proveedor = { nombre: "openai", resolveModelId: () => "gpt-4o", complete: async () => ({ output: "ok", inputTokens: 10, outputTokens: 2 }) };
    const registro = new AgentRegistry();
    registro.register({ name: "a", model: "sonnet", systemPrompt: "s" });
    const { llamar } = crearLlamador(registro, undefined, process.cwd(), { proveedor });
    const r = await llamar({ agente: "a", modeloAlias: "sonnet", userPrompt: "u" });
    assert.ok(!("cacheCreationTokens" in r) && !("cacheReadTokens" in r));

    const cwd = proyecto();
    const c = new CicloVerificado(/** @type {any} */ ({ cwd, runId: "r1", config: POR_DEFECTO, log: { append() {} }, llamar }));
    await c._llamador("r1:T1", "T1")({ agente: "a", modeloAlias: "sonnet", userPrompt: "u" });
    const linea = JSON.parse(readFileSync(c.libro.archivo, "utf8").trim());
    assert.deepEqual(Object.keys(linea).sort(), ["inputTokens", "outputTokens", "taskId", "ts", "usd"]);
    assert.ok(Math.abs(linea.usd - (10 * 2.5 + 2 * 10) / M) < 1e-12);
    assert.deepEqual(Object.keys(c.libro.total()).sort(), ["llamadas", "tokens_in", "tokens_out", "usd"]);
  });
});

describe("CA-001-05 — la reutilización se puede desactivar", () => {
  test("con llm.cache: false la petición es la de siempre: el prompt de sistema como texto, sin cache_control", async () => {
    for (const valor of [false, "false", "False", "false   # sin caché"]) {
      const { proveedor, peticiones } = proveedorFalso({ cache: valor });
      await proveedor.complete({ model: "sonnet", systemPrompt: "FIJO\nvariable", systemFijo: "FIJO", userPrompt: "u" });
      assert.equal(peticiones[0].cuerpo.system, "FIJO\nvariable", String(valor));
      assert.ok(!JSON.stringify(peticiones[0].cuerpo).includes("cache_control"));
    }
  });

  test("por defecto está activa, y true también la activa", () => {
    for (const valor of [undefined, null, true, "true", ""]) assert.equal(cacheActiva(valor), true, String(valor));
    assert.equal(new AnthropicProvider({}).cache, true);
  });

  test("un valor que no es true ni false se rechaza nombrando la clave", () => {
    assert.throws(() => cacheActiva("quizas"), /llm\.cache/);
    assert.throws(() => new AnthropicProvider({ cache: "1h" }), /llm\.cache/);
  });

  test("se lee de la sección llm: de sdd.config.yaml", async () => {
    await sinEntorno(async () => {
      const apagada = crearProvider({ cwd: proyecto("llm:\n  provider: anthropic\n  cache: false\n") });
      assert.equal(/** @type {any} */ (apagada).cache, false);
      const porDefecto = crearProvider({ cwd: proyecto("llm:\n  provider: anthropic\n") });
      assert.equal(/** @type {any} */ (porDefecto).cache, true);
    });
  });
});
