// @ts-check
/**
 * Servidor MCP en las revisiones sin estado del protocolo (spec 2026-10-09-puesta-al-dia, HU-002).
 * Cubre CA-002-02, CA-002-03 y CA-002-04. El informe que justifica cada comportamiento está en
 * .sdd/especificaciones/2026-10-09-puesta-al-dia/spikes/mcp-revision-vigente.md
 *
 * El cliente de estas pruebas es uno mínimo escrito aquí, siguiendo la especificación. NO es
 * el cliente oficial: esa comprobación queda pendiente (ver verificacion.md).
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { PassThrough } from "node:stream";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { ERR, META, ServidorMcp, VERSIONES, VERSIONES_SIN_ESTADO } from "../core/mcp/protocolo.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(ROOT, "cli", "index.js");
const DOCKER = process.env.FORGE_TEST_DOCKER === "1" && spawnSync("docker", ["version", "--format", "{{.Server.Version}}"], { encoding: "utf8" }).status === 0;
const VIGENTE = "2026-07-28";

/** @type {import("../core/mcp/protocolo.js").Herramienta[]} */
const HERRAMIENTAS = [
  {
    name: "eco", description: "Devuelve el texto",
    inputSchema: { type: "object", properties: { texto: { type: "string", maxLength: 20 } }, required: ["texto"] },
    ejecutar: async ({ texto }) => ({ texto: `eco: ${texto}` }),
  },
  { name: "falla", description: "Error esperado", inputSchema: { type: "object", properties: {} }, ejecutar: async () => ({ texto: "no se pudo", error: true }) },
  {
    name: "lenta", description: "Espera", inputSchema: { type: "object", properties: { ms: { type: "string" } }, required: ["ms"] },
    ejecutar: async ({ ms }) => { await new Promise((r) => setTimeout(r, Number(ms))); return { texto: `lenta ${ms}` }; },
  },
];

/** @param {string[]} lineas @param {{ pausaMs?: number }} [o] pausa entre líneas, para que una llegue con la anterior en curso */
async function conversar(lineas, o = {}) {
  const entrada = new PassThrough();
  const salida = new PassThrough();
  const avisos = [];
  let crudo = "";
  salida.on("data", (d) => (crudo += d));
  const servidor = new ServidorMcp({ nombre: "prueba", version: "9.9.9", instrucciones: "hola", herramientas: HERRAMIENTAS, entrada, salida, avisar: (m) => avisos.push(m) });
  const fin = servidor.iniciar();
  for (const l of lineas) {
    entrada.write(l + "\n");
    if (o.pausaMs) await new Promise((r) => setTimeout(r, o.pausaMs));
  }
  entrada.end();
  await fin;
  return { respuestas: crudo.split("\n").filter(Boolean).map((l) => JSON.parse(l)), avisos, crudo };
}

/** `_meta` que la revisión sin estado exige en cada petición. */
const meta = (version = VIGENTE, extra = {}) => ({
  [META.VERSION]: version,
  [META.CAPACIDADES]: {},
  [META.CLIENTE]: { name: "t", version: "1" },
  ...extra,
});
const req = (id, method, params) => JSON.stringify({ jsonrpc: "2.0", id, method, ...(params === undefined ? {} : { params }) });
/** Petición sin estado: los parámetros más el `_meta` obligatorio. */
const mod = (id, method, params = {}, version = VIGENTE) => req(id, method, { ...params, _meta: meta(version) });
const SERVIDOR = { [META.SERVIDOR]: { name: "prueba", version: "9.9.9" } };

describe("CA-002-02 — un cliente de la revisión sin estado se conecta sin saludo", () => {
  test("la revisión vigente publicada es la que se anuncia, y las de saludo siguen aparte", () => {
    assert.deepEqual(VERSIONES_SIN_ESTADO, [VIGENTE]);
    assert.ok(!VERSIONES.includes(VIGENTE), "la revisión sin estado no se negocia con initialize");
  });

  test("server/discover: versiones, capacidades, identidad, instrucciones y pistas de caché", async () => {
    const { respuestas } = await conversar([mod("d-1", "server/discover")]);
    assert.deepEqual(respuestas[0], {
      jsonrpc: "2.0", id: "d-1",
      result: {
        resultType: "complete",
        supportedVersions: [VIGENTE],
        capabilities: { tools: { listChanged: false } },
        instructions: "hola",
        ttlMs: 300000,
        cacheScope: "public",
        _meta: SERVIDOR,
      },
    });
  });

  test("tools/list sin saludo previo: herramientas, resultType y pistas de caché", async () => {
    const { respuestas } = await conversar([mod(1, "tools/list")]);
    const r = respuestas[0].result;
    assert.equal(r.resultType, "complete");
    assert.deepEqual(r.tools.map((t) => t.name), ["eco", "falla", "lenta"]);
    assert.deepEqual(Object.keys(r.tools[0]).sort(), ["description", "inputSchema", "name"]);
    assert.ok(Number.isInteger(r.ttlMs) && r.ttlMs >= 0);
    assert.equal(r.cacheScope, "public");
    assert.deepEqual(r._meta, SERVIDOR);
  });

  test("la lista sale siempre en el mismo orden", async () => {
    const { respuestas } = await conversar([mod(1, "tools/list"), mod(2, "tools/list")]);
    assert.deepEqual(respuestas[0].result.tools, respuestas[1].result.tools);
  });

  test("tools/call: el resultado lleva resultType y la identidad del servidor", async () => {
    const { respuestas } = await conversar([mod(1, "tools/call", { name: "eco", arguments: { texto: "hola" } })]);
    assert.deepEqual(respuestas[0].result, { resultType: "complete", content: [{ type: "text", text: "eco: hola" }], _meta: SERVIDOR });
  });

  test("los errores de la herramienta siguen siendo resultados con isError", async () => {
    const { respuestas } = await conversar([
      mod(1, "tools/call", { name: "falla", arguments: {} }),
      mod(2, "tools/call", { name: "eco", arguments: {} }),
    ]);
    const de = (id) => respuestas.find((r) => r.id === id).result;
    assert.equal(de(1).isError, true);
    assert.equal(de(1).resultType, "complete");
    assert.equal(de(2).isError, true);
    assert.match(de(2).content[0].text, /falta el argumento "texto"/);
  });

  test("herramienta desconocida: -32602, como pide la revisión", async () => {
    const { respuestas } = await conversar([mod(1, "tools/call", { name: "no_existe", arguments: {} })]);
    assert.equal(respuestas[0].error.code, ERR.PARAMS);
  });

  test("cada petición se atiende sola: ninguna depende de una anterior ni deja estado", async () => {
    const sola = await conversar([mod(1, "tools/call", { name: "eco", arguments: { texto: "a" } })]);
    const trasOtras = await conversar([mod(7, "server/discover"), mod(8, "tools/list"), req(9, "initialize", { protocolVersion: "2025-06-18" }), mod(1, "tools/call", { name: "eco", arguments: { texto: "a" } })]);
    assert.deepEqual(trasOtras.respuestas.find((r) => r.id === 1), sola.respuestas[0]);
  });

  test("lo que la revisión retiró no existe para un cliente sin estado: ping y logging/setLevel", async () => {
    const { respuestas } = await conversar([mod(1, "ping"), mod(2, "logging/setLevel", { level: "debug" })]);
    assert.deepEqual(respuestas.map((r) => r.error.code), [ERR.METODO, ERR.METODO]);
    assert.equal(respuestas.length, 2);
  });

  test("falta un campo obligatorio de _meta: -32602, también en server/discover", async () => {
    const { respuestas } = await conversar([
      req(1, "server/discover"),
      req(2, "server/discover", { _meta: { [META.VERSION]: VIGENTE } }),
      req(3, "tools/list", { _meta: { [META.VERSION]: VIGENTE, [META.CAPACIDADES]: "todas" } }),
      req(4, "tools/list", { _meta: { [META.VERSION]: 20260728, [META.CAPACIDADES]: {} } }),
    ]);
    assert.deepEqual(respuestas.map((r) => r.error?.code), [ERR.PARAMS, ERR.PARAMS, ERR.PARAMS, ERR.PARAMS]);
    assert.deepEqual(respuestas.map((r) => r.id).sort(), [1, 2, 3, 4]);
    assert.match(respuestas[0].error.message, /protocolVersion/);
  });

  test("una petición cancelada no recibe ningún mensaje más; las demás, sí", async () => {
    const { respuestas } = await conversar([
      mod("lenta-1", "tools/call", { name: "lenta", arguments: { ms: "120" } }),
      JSON.stringify({ jsonrpc: "2.0", method: "notifications/cancelled", params: { requestId: "lenta-1" } }),
      mod(2, "tools/call", { name: "eco", arguments: { texto: "sigo" } }),
    ], { pausaMs: 20 });
    assert.deepEqual(respuestas.map((r) => r.id), [2]);
  });

  test("subscriptions/listen: se acepta con el filtro vacío (no hay avisos que dar) y queda abierta sin respuesta", async () => {
    const { respuestas } = await conversar([
      mod("s-1", "subscriptions/listen", { notifications: { toolsListChanged: true, resourceSubscriptions: ["file:///x"] } }),
      mod(2, "tools/call", { name: "eco", arguments: { texto: "sigo" } }),
      JSON.stringify({ jsonrpc: "2.0", method: "notifications/cancelled", params: { requestId: "s-1" } }),
    ], { pausaMs: 10 });
    assert.deepEqual(respuestas[0], {
      jsonrpc: "2.0", method: "notifications/subscriptions/acknowledged",
      params: { _meta: { "io.modelcontextprotocol/subscriptionId": "s-1" }, notifications: {} },
    });
    assert.deepEqual(respuestas.filter((r) => r.id !== undefined).map((r) => r.id), [2], "la suscripción no recibe respuesta; las demás peticiones, sí");
    assert.equal(respuestas.length, 2, "ni avisos de cambio ni mensajes tras cancelarla");
  });

  test("una suscripción abierta no impide que el servidor termine al cerrarse la entrada", async () => {
    const { respuestas } = await conversar([mod(1, "subscriptions/listen", { notifications: {} })]);
    assert.equal(respuestas.length, 1);
  });

  test("por la salida solo salen mensajes del protocolo, uno por línea y sin saltos dentro", async () => {
    const { crudo } = await conversar([mod(1, "server/discover"), mod(2, "tools/call", { name: "eco", arguments: { texto: "a\nb" } }), "{no es json"]);
    const lineas = crudo.split("\n").filter(Boolean);
    assert.equal(lineas.length, 3);
    for (const linea of lineas) assert.equal(JSON.parse(linea).jsonrpc, "2.0");
  });
});

describe("CA-002-04 — una revisión desconocida recibe una respuesta clara con las admitidas", () => {
  test("sin estado: error -32022 con la versión pedida y la lista de las que sirven para reintentar", async () => {
    for (const metodo of ["server/discover", "tools/list", "tools/call"]) {
      const { respuestas } = await conversar([mod(1, metodo, { name: "eco", arguments: { texto: "x" } }, "2099-01-01")]);
      assert.equal(respuestas[0].error.code, -32022, metodo);
      assert.deepEqual(respuestas[0].error.data, { supported: [VIGENTE], requested: "2099-01-01" }, metodo);
      for (const v of [...VERSIONES_SIN_ESTADO, ...VERSIONES]) assert.ok(respuestas[0].error.message.includes(v), `el mensaje nombra ${v}`);
    }
  });

  test("una revisión de saludo pedida sin saludo también se rechaza: no se atiende a medias", async () => {
    const { respuestas } = await conversar([mod(1, "tools/call", { name: "eco", arguments: { texto: "x" } }, "2025-06-18")]);
    assert.equal(respuestas[0].error.code, ERR.VERSION);
    assert.match(respuestas[0].error.message, /initialize/);
  });

  test("tras el rechazo, el cliente reintenta con una versión de la lista y funciona", async () => {
    const primero = await conversar([mod(1, "tools/list", {}, "2030-01-01")]);
    const admitida = primero.respuestas[0].error.data.supported[0];
    const segundo = await conversar([mod(2, "tools/list", {}, admitida)]);
    assert.equal(segundo.respuestas[0].result.tools.length, 3);
  });

  test("con saludo: una versión desconocida se contesta con la más reciente de las de saludo", async () => {
    const { respuestas } = await conversar([req(1, "initialize", { protocolVersion: VIGENTE, capabilities: {}, clientInfo: { name: "t", version: "1" } })]);
    assert.equal(respuestas[0].result.protocolVersion, VERSIONES[0]);
  });
});

describe("CA-002-03 — los clientes de las revisiones con saludo siguen funcionando igual", () => {
  const init = (v) => req(1, "initialize", { protocolVersion: v, capabilities: {}, clientInfo: { name: "t", version: "1" } });

  test("se siguen aceptando las tres que ya se aceptaban, y además 2025-11-25", () => {
    for (const v of ["2025-06-18", "2025-03-26", "2024-11-05", "2025-11-25"]) assert.ok(VERSIONES.includes(v), v);
  });

  for (const v of ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"]) {
    test(`${v}: saludo, lista y llamada con exactamente la forma de antes (sin resultType ni _meta)`, async () => {
      const { respuestas } = await conversar([
        init(v),
        JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
        req(2, "tools/list"),
        req(3, "tools/call", { name: "eco", arguments: { texto: "hola" } }),
        req(4, "ping"),
      ]);
      const de = (id) => respuestas.find((r) => r.id === id).result;
      assert.equal(respuestas.length, 4, "la notificación no recibe respuesta");
      assert.deepEqual(de(1), { protocolVersion: v, capabilities: { tools: { listChanged: false } }, serverInfo: { name: "prueba", version: "9.9.9" }, instructions: "hola" });
      assert.deepEqual(Object.keys(de(2)), ["tools"]);
      assert.deepEqual(de(3), { content: [{ type: "text", text: "eco: hola" }] });
      assert.deepEqual(de(4), {});
    });
  }

  test("un `_meta` corriente (p. ej. progressToken) no convierte la petición en una sin estado", async () => {
    const { respuestas } = await conversar([req(1, "tools/call", { name: "eco", arguments: { texto: "hola" }, _meta: { progressToken: "p1" } })]);
    assert.deepEqual(respuestas[0].result, { content: [{ type: "text", text: "eco: hola" }] });
  });

  test("una cancelación con saludo no cambia nada: la respuesta llega como siempre", async () => {
    const { respuestas } = await conversar([
      init("2025-06-18"),
      req(2, "tools/call", { name: "lenta", arguments: { ms: "60" } }),
      JSON.stringify({ jsonrpc: "2.0", method: "notifications/cancelled", params: { requestId: 2 } }),
    ], { pausaMs: 10 });
    assert.deepEqual(respuestas.map((r) => r.id).sort(), [1, 2]);
  });

  test("las dos épocas conviven en el mismo proceso", async () => {
    const { respuestas } = await conversar([init("2025-06-18"), mod(2, "tools/list"), req(3, "tools/list")]);
    assert.equal(respuestas.find((r) => r.id === 2).result.resultType, "complete");
    assert.equal(respuestas.find((r) => r.id === 3).result.resultType, undefined);
  });

  test("la sonda de compatibilidad: un cliente de las dos épocas pregunta con server/discover y no cae a initialize", async () => {
    // stdio, «Backward Compatibility»: DiscoverResult o un error moderno reconocido = servidor moderno
    const ok = await conversar([mod(1, "server/discover")]);
    assert.ok(Array.isArray(ok.respuestas[0].result.supportedVersions));
    const otra = await conversar([mod(1, "server/discover", {}, "2031-01-01")]);
    assert.equal(otra.respuestas[0].error.code, -32022);
  });
});

// ─── Proceso real ─────────────────────────────────────────────────────────────

function lanzar(cwd) {
  const proc = spawn(process.execPath, [CLI, "mcp"], { cwd, stdio: ["pipe", "pipe", "pipe"] });
  let buffer = ""; const lineas = []; const esperando = new Map();
  proc.stdout.on("data", (d) => {
    buffer += d;
    let i;
    while ((i = buffer.indexOf("\n")) !== -1) {
      const linea = buffer.slice(0, i); buffer = buffer.slice(i + 1);
      lineas.push(linea);
      try { const m = JSON.parse(linea); if (m.id !== undefined && esperando.has(m.id)) { esperando.get(m.id)(m); esperando.delete(m.id); } } catch { /* se detecta en las aserciones */ }
    }
  });
  let n = 0;
  return {
    lineas,
    /** Petición sin estado: siempre con su `_meta`. */
    pedir: (method, params = {}) => new Promise((res, rej) => {
      const id = ++n;
      const t = setTimeout(() => rej(new Error(`sin respuesta a ${method}`)), 120_000);
      esperando.set(id, (m) => { clearTimeout(t); res(m); });
      proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params: { ...params, _meta: meta() } }) + "\n");
    }),
    cerrar: () => new Promise((res) => { proc.on("close", (code) => res(code)); proc.stdin.end(); }),
  };
}

const proyecto = (archivos = {}) => {
  const dir = mkdtempSync(join(tmpdir(), "forge-mcp-se-"));
  for (const [r, c] of Object.entries({ "package.json": JSON.stringify({ name: "demo", scripts: { test: "node --test" } }), ...archivos })) {
    mkdirSync(join(dir, r, ".."), { recursive: true }); writeFileSync(join(dir, r), c);
  }
  return dir;
};
const texto = (m) => m.result.content.map((c) => c.text).join("\n");

describe("CA-002-02 — `forge mcp` real, sin saludo", () => {
  test("descubre, lista las tres herramientas y usa las de leer y escribir", async () => {
    const dir = proyecto({ "src/a.js": "hola" });
    const c = lanzar(dir);
    const d = await c.pedir("server/discover");
    assert.deepEqual(d.result.supportedVersions, [VIGENTE]);
    assert.equal(d.result._meta[META.SERVIDOR].name, "forge");

    const lista = await c.pedir("tools/list");
    assert.deepEqual(lista.result.tools.map((t) => t.name).sort(), ["ejecutar_pruebas", "escribir_archivo", "leer_archivo"]);

    assert.equal(texto(await c.pedir("tools/call", { name: "leer_archivo", arguments: { ruta: "src/a.js" } })), "hola");
    const escrito = await c.pedir("tools/call", { name: "escribir_archivo", arguments: { ruta: "src/b.js", contenido: "v1" } });
    assert.equal(escrito.result.isError, undefined);
    assert.equal(escrito.result.resultType, "complete");
    assert.equal(readFileSync(join(dir, "src", "b.js"), "utf8"), "v1");

    const vetada = await c.pedir("tools/call", { name: "escribir_archivo", arguments: { ruta: "sub/.git/config", contenido: "x" } });
    assert.equal(vetada.result.isError, true);
    assert.ok(!existsSync(join(dir, "sub")), "los rechazos son los mismos en las dos épocas");

    assert.equal(await c.cerrar(), 0, "al cerrar la entrada el servidor termina");
    for (const linea of c.lineas) assert.equal(JSON.parse(linea).jsonrpc, "2.0");
  });

  test("la tercera herramienta, ejecutar_pruebas, en el entorno aislado", { skip: !DOCKER && "requiere FORGE_TEST_DOCKER=1 y Docker en marcha" }, async () => {
    const dir = proyecto({
      "src/suma.js": "module.exports = (a, b) => a + b;\n",
      "tests/suma.test.js": "const test = require('node:test'); const assert = require('node:assert'); const suma = require('../src/suma.js');\ntest('suma', () => assert.strictEqual(suma(2, 2), 4));\n",
    });
    const c = lanzar(dir);
    const r = await c.pedir("tools/call", { name: "ejecutar_pruebas", arguments: {} });
    assert.match(texto(r), /Las pruebas PASAN/, texto(r));
    assert.equal(r.result.resultType, "complete");
    await c.cerrar();
  });
});
