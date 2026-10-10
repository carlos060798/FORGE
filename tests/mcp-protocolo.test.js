// @ts-check
/**
 * Servidor MCP (spec 2026-10-03-herramientas-mcp): el protocolo, entero y en memoria.
 * Cubre CA-004-01, CA-004-02, CA-004-03, CA-004-04 y CA-004-05.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PassThrough } from "node:stream";

import { ERR, ServidorMcp, validarArgumentos, VERSIONES } from "../core/mcp/protocolo.js";

/** @type {import("../core/mcp/protocolo.js").Herramienta[]} */
const HERRAMIENTAS = [
  {
    name: "eco", description: "Devuelve el texto",
    inputSchema: { type: "object", properties: { texto: { type: "string", maxLength: 20 }, modo: { type: "string", enum: ["a", "b"] } }, required: ["texto"] },
    ejecutar: async ({ texto }) => ({ texto: `eco: ${texto}` }),
  },
  { name: "falla", description: "Error esperado", inputSchema: { type: "object", properties: {} }, ejecutar: async () => ({ texto: "no se pudo", error: true }) },
  { name: "revienta", description: "Lanza", inputSchema: { type: "object", properties: {} }, ejecutar: async () => { throw new Error("boom"); } },
  {
    name: "lenta", description: "Espera", inputSchema: { type: "object", properties: { ms: { type: "string" } }, required: ["ms"] },
    ejecutar: async ({ ms }) => { await new Promise((r) => setTimeout(r, Number(ms))); return { texto: `lenta ${ms}` }; },
  },
];

/**
 * Envía líneas al servidor, cierra la entrada y devuelve lo que escribió y lo que avisó.
 * @param {string[]} lineas
 */
async function conversar(lineas) {
  const entrada = new PassThrough();
  const salida = new PassThrough();
  const avisos = [];
  let crudo = "";
  salida.on("data", (d) => (crudo += d));
  const servidor = new ServidorMcp({ nombre: "prueba", version: "9.9.9", instrucciones: "hola", herramientas: HERRAMIENTAS, entrada, salida, avisar: (m) => avisos.push(m) });
  const fin = servidor.iniciar();
  for (const l of lineas) entrada.write(l + "\n");
  entrada.end();
  await fin;
  const respuestas = crudo.split("\n").filter(Boolean).map((l) => JSON.parse(l));
  return { respuestas, avisos, crudo };
}

const req = (id, method, params) => JSON.stringify({ jsonrpc: "2.0", id, method, ...(params === undefined ? {} : { params }) });
const INIT = (version = "2025-06-18") => req(1, "initialize", { protocolVersion: version, capabilities: {}, clientInfo: { name: "t", version: "1" } });

describe("CA-004-01 — inicializar, listar y llamar", () => {
  test("initialize devuelve capacidades de herramientas, datos del servidor e instrucciones", async () => {
    const { respuestas } = await conversar([INIT()]);
    assert.deepEqual(respuestas[0], {
      jsonrpc: "2.0", id: 1,
      result: { protocolVersion: "2025-06-18", capabilities: { tools: { listChanged: false } }, serverInfo: { name: "prueba", version: "9.9.9" }, instructions: "hola" },
    });
  });

  test("tools/list devuelve nombre, descripción y esquema de cada herramienta, sin exponer la función", async () => {
    const { respuestas } = await conversar([INIT(), JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }), req(2, "tools/list")]);
    const { tools } = respuestas[1].result;
    assert.deepEqual(tools.map((t) => t.name), ["eco", "falla", "revienta", "lenta"]);
    assert.deepEqual(Object.keys(tools[0]).sort(), ["description", "inputSchema", "name"]);
  });

  test("tools/call ejecuta la herramienta y devuelve el texto", async () => {
    const { respuestas } = await conversar([req(1, "tools/call", { name: "eco", arguments: { texto: "hola" } })]);
    assert.deepEqual(respuestas[0].result, { content: [{ type: "text", text: "eco: hola" }] });
  });

  test("ping responde con un objeto vacío", async () => {
    assert.deepEqual((await conversar([req(7, "ping")])).respuestas[0], { jsonrpc: "2.0", id: 7, result: {} });
  });

  test("los ids de texto y de número se devuelven tal cual, y las respuestas lentas no se mezclan", async () => {
    const { respuestas } = await conversar([
      req("a", "tools/call", { name: "lenta", arguments: { ms: "60" } }),
      req(2, "tools/call", { name: "lenta", arguments: { ms: "5" } }),
    ]);
    assert.deepEqual(respuestas.map((r) => r.id), [2, "a"], "la rápida termina antes");
    assert.equal(respuestas.find((r) => r.id === "a").result.content[0].text, "lenta 60");
  });

  test("líneas en blanco y finales de línea de Windows no molestan", async () => {
    const entrada = new PassThrough(); const salida = new PassThrough(); let crudo = "";
    salida.on("data", (d) => (crudo += d));
    const fin = new ServidorMcp({ nombre: "p", version: "1", herramientas: HERRAMIENTAS, entrada, salida }).iniciar();
    entrada.write("\r\n\r\n" + req(1, "ping") + "\r\n");
    entrada.end();
    await fin;
    assert.equal(JSON.parse(crudo).id, 1);
  });
});

describe("CA-004-02 — versiones del protocolo", () => {
  for (const v of VERSIONES) {
    test(`responde con la versión pedida: ${v}`, async () => {
      assert.equal((await conversar([INIT(v)])).respuestas[0].result.protocolVersion, v);
    });
  }

  test("una versión que no soporta se contesta con 2025-06-18, como antes de la fase 9 (CA-002-03)", async () => {
    for (const pedida of ["2099-01-01", "1999-01-01", undefined, 5]) {
      const { respuestas } = await conversar([req(1, "initialize", { protocolVersion: pedida })]);
      assert.equal(respuestas[0].result.protocolVersion, "2025-06-18");
    }
  });
});

describe("CA-004-03 — peticiones mal formadas", () => {
  test("JSON no válido: error de análisis con id nulo, y el servidor sigue", async () => {
    const { respuestas } = await conversar(["{esto no es json", req(2, "ping")]);
    assert.deepEqual(respuestas[0], { jsonrpc: "2.0", id: null, error: { code: ERR.PARSE, message: "JSON no válido" } });
    assert.equal(respuestas[1].id, 2);
  });

  test("mensajes agrupados: se rechazan (el protocolo los retiró)", async () => {
    const { respuestas } = await conversar([JSON.stringify([{ jsonrpc: "2.0", id: 1, method: "ping" }])]);
    assert.equal(respuestas[0].error.code, ERR.PETICION);
  });

  test("método desconocido con id: -32601; como notificación: sin respuesta", async () => {
    const { respuestas } = await conversar([req(1, "no/existe"), JSON.stringify({ jsonrpc: "2.0", method: "no/existe" }), req(3, "ping")]);
    assert.equal(respuestas.length, 2);
    assert.equal(respuestas[0].error.code, ERR.METODO);
    assert.equal(respuestas[1].id, 3);
  });

  test("las notificaciones nunca reciben respuesta", async () => {
    const { crudo } = await conversar([JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }), JSON.stringify({ jsonrpc: "2.0", method: "notifications/cancelled", params: { requestId: 1 } })]);
    assert.equal(crudo, "");
  });

  test("objetos que no son JSON-RPC, o con un id inválido: -32600", async () => {
    const { respuestas } = await conversar([JSON.stringify({ hola: 1 }), JSON.stringify({ jsonrpc: "2.0", id: { x: 1 }, method: "ping" }), JSON.stringify({ jsonrpc: "1.0", id: 1, method: "ping" }), "42", "null"]);
    assert.deepEqual(respuestas.map((r) => r.error?.code), [ERR.PETICION, ERR.PETICION, ERR.PETICION, ERR.PETICION, ERR.PETICION]);
  });

  test("una respuesta del cliente (el servidor no hace peticiones) se ignora", async () => {
    const { crudo } = await conversar([JSON.stringify({ jsonrpc: "2.0", id: 9, result: {} })]);
    assert.equal(crudo, "");
  });

  test("herramienta inexistente o sin nombre: -32602", async () => {
    const { respuestas } = await conversar([req(1, "tools/call", { name: "nada" }), req(2, "tools/call", {}), req(3, "tools/call")]);
    assert.deepEqual(respuestas.map((r) => r.error.code), [ERR.PARAMS, ERR.PARAMS, ERR.PARAMS]);
    assert.match(respuestas[0].error.message, /Herramienta desconocida: nada/);
  });

  test("una línea de más de 10 MB se descarta con un error y el servidor sigue vivo", async () => {
    const { respuestas } = await conversar(["x".repeat(10 * 1024 * 1024 + 10), req(2, "ping")]);
    assert.equal(respuestas[0].error.code, ERR.PETICION);
    assert.equal(respuestas[1].id, 2);
  });
});

describe("CA-004-04 — los errores de una herramienta son resultados con isError", () => {
  test("un error esperado de la herramienta", async () => {
    const { respuestas } = await conversar([req(1, "tools/call", { name: "falla", arguments: {} })]);
    assert.deepEqual(respuestas[0].result, { content: [{ type: "text", text: "no se pudo" }], isError: true });
  });

  test("argumentos mal formados: resultado con error que dice qué corregir, no un error de protocolo", async () => {
    const casos = [
      [{}, /falta el argumento "texto"/], [{ texto: 5 }, /debe ser texto/], [{ texto: "x", extra: 1 }, /argumento desconocido: "extra"/],
      [{ texto: "x".repeat(21) }, /supera el máximo de 20/], [{ texto: "x", modo: "z" }, /uno de: a, b/],
    ];
    for (const [args, patron] of casos) {
      const { respuestas } = await conversar([req(1, "tools/call", { name: "eco", arguments: args })]);
      assert.equal(respuestas[0].error, undefined);
      assert.equal(respuestas[0].result.isError, true);
      assert.match(respuestas[0].result.content[0].text, patron);
    }
    const nulos = await conversar([req(1, "tools/call", { name: "eco", arguments: null }), req(2, "tools/call", { name: "eco", arguments: [] })]);
    assert.ok(nulos.respuestas.every((r) => r.result.isError));
  });

  test("una herramienta que lanza se convierte en error de la herramienta y el servidor sigue", async () => {
    const { respuestas, avisos } = await conversar([req(1, "tools/call", { name: "revienta", arguments: {} }), req(2, "ping")]);
    const porId = (id) => respuestas.find((r) => r.id === id);   // el ping, más rápido, responde antes
    assert.equal(porId(1).result.isError, true);
    assert.match(porId(1).result.content[0].text, /La herramienta falló: boom/);
    assert.deepEqual(porId(2).result, {});
    assert.ok(avisos.some((a) => a.includes("revienta")), "el detalle va a los avisos");
  });
});

describe("CA-004-05 — por la salida solo salen mensajes del protocolo", () => {
  test("con errores, fallos y avisos, cada línea de la salida es JSON-RPC y los avisos van aparte", async () => {
    const { crudo, avisos } = await conversar([
      "{roto", INIT(), req(2, "tools/call", { name: "revienta", arguments: {} }), req(3, "no/existe"), "x".repeat(10 * 1024 * 1024 + 10),
    ]);
    const lineas = crudo.split("\n").filter(Boolean);
    assert.ok(lineas.length >= 5);
    for (const l of lineas) {
      const m = JSON.parse(l);
      assert.equal(m.jsonrpc, "2.0");
    }
    assert.ok(avisos.length >= 2);
    // El mensaje de una herramienta que falla sí viaja (ayuda al agente a corregir); la traza, nunca
    assert.ok(!/\bat .*\.js:\d+/.test(crudo), "las trazas no viajan al cliente");
  });
});

describe("validarArgumentos", () => {
  const schema = { type: "object", properties: { a: { type: "string" } }, required: ["a"] };
  test("acepta lo válido y describe lo que no", () => {
    assert.equal(validarArgumentos(schema, { a: "x" }), null);
    assert.match(String(validarArgumentos(schema, undefined)), /falta el argumento "a"/);
    assert.equal(validarArgumentos({ type: "object", properties: {} }, undefined), null);
  });
});
