// @ts-check
/**
 * `forge mcp` como proceso real, por stdin/stdout (spec 2026-10-03-herramientas-mcp).
 * Cubre CA-001-02, CA-004-05, CA-004-06 y CA-005-01; con Docker, también CA-001-01 real.
 *
 * Variables opcionales:
 *   FORGE_TEST_DOCKER=1   ejecuta las pruebas de verdad en el entorno aislado
 *   FORGE_MCP_SDK=<dir>   carpeta donde está instalado @modelcontextprotocol/sdk (cliente oficial)
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(ROOT, "cli", "index.js");
const SDK = process.env.FORGE_MCP_SDK;
const DOCKER = process.env.FORGE_TEST_DOCKER === "1" && spawnSync("docker", ["version", "--format", "{{.Server.Version}}"], { encoding: "utf8" }).status === 0;

/** Un cliente mínimo: lanza `forge mcp` y conversa por líneas. */
function lanzar(proyecto, { args = ["mcp"], env = process.env, cwd } = {}) {
  const proc = spawn(process.execPath, [CLI, ...args], { cwd: cwd ?? proyecto, env, stdio: ["pipe", "pipe", "pipe"] });
  let buffer = ""; let stderr = ""; const lineas = []; const esperando = new Map();
  proc.stdout.on("data", (d) => {
    buffer += d;
    let i;
    while ((i = buffer.indexOf("\n")) !== -1) {
      const linea = buffer.slice(0, i); buffer = buffer.slice(i + 1);
      lineas.push(linea);
      try { const m = JSON.parse(linea); if (m.id !== undefined && esperando.has(m.id)) { esperando.get(m.id)(m); esperando.delete(m.id); } } catch { /* se detecta en las aserciones */ }
    }
  });
  proc.stderr.on("data", (d) => (stderr += d));
  let n = 0;
  return {
    lineas, stderr: () => stderr,
    pedir: (method, params) => new Promise((res, rej) => {
      const id = ++n;
      const t = setTimeout(() => rej(new Error(`sin respuesta a ${method}`)), 60_000);
      esperando.set(id, (m) => { clearTimeout(t); res(m); });
      proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, ...(params ? { params } : {}) }) + "\n");
    }),
    notificar: (method) => proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method }) + "\n"),
    cerrar: () => new Promise((res) => { proc.on("close", (code) => res(code)); proc.stdin.end(); }),
    matar: () => proc.kill(),
  };
}
const INIT = { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "prueba", version: "1" } };
const proyecto = (archivos = {}) => {
  const dir = mkdtempSync(join(tmpdir(), "forge-mcp-e2e-"));
  for (const [r, c] of Object.entries({ "package.json": JSON.stringify({ name: "demo", scripts: { test: "node --test" } }), ...archivos })) {
    mkdirSync(join(dir, r, ".."), { recursive: true }); writeFileSync(join(dir, r), c);
  }
  return dir;
};
const texto = (m) => m.result.content.map((c) => c.text).join("\n");

describe("forge mcp — proceso real", () => {
  test("CA-005-01: arranca sobre el directorio actual y también sobre el indicado con --cwd", async () => {
    const dir = proyecto({ "src/a.js": "hola" });
    for (const opciones of [{ args: ["mcp"], cwd: dir }, { args: ["mcp", "--cwd", dir], cwd: tmpdir() }]) {
      const c = lanzar(dir, opciones);
      const init = await c.pedir("initialize", INIT);
      assert.equal(init.result.serverInfo.name, "forge");
      c.notificar("notifications/initialized");
      const r = await c.pedir("tools/call", { name: "leer_archivo", arguments: { ruta: "src/a.js" } });
      assert.equal(texto(r), "hola");
      assert.equal(await c.cerrar(), 0);
    }
  });

  test("CA-004-05: por stdout solo salen mensajes del protocolo, incluso ante entradas hostiles", async () => {
    const dir = proyecto();
    const c = lanzar(dir);
    await c.pedir("initialize", INIT);
    await c.pedir("tools/call", { name: "leer_archivo", arguments: { ruta: "../fuera" } });
    await c.pedir("metodo/inexistente");
    await c.cerrar();
    assert.ok(c.lineas.length >= 3);
    for (const l of c.lineas) assert.equal(JSON.parse(l).jsonrpc, "2.0", l);
  });

  test("CA-001-02: sin Docker devuelve un error y NO ejecuta las pruebas en el anfitrión", async () => {
    const marca = "EJECUTADO_EN_EL_ANFITRION.txt";
    const dir = proyecto({
      "tests/a.test.js": `require('node:fs').writeFileSync(${JSON.stringify(join(tmpdir(), "forge-mcp-marca-" + process.pid))}, 'x'); require('node:test')('x', () => {});`,
      [marca]: "no ejecutado",
    });
    const env = { ...process.env };
    for (const k of Object.keys(env)) if (/^path$/i.test(k)) delete env[k];
    env.PATH = dirname(process.execPath);                   // node sí, docker no

    const c = lanzar(dir, { env });
    await c.pedir("initialize", INIT);
    const r = await c.pedir("tools/call", { name: "ejecutar_pruebas", arguments: {} });
    assert.equal(r.result.isError, true);
    assert.match(texto(r), /Docker no está disponible/);
    assert.match(texto(r), /no se ejecutan fuera del entorno aislado/);
    assert.ok(!existsSync(join(tmpdir(), "forge-mcp-marca-" + process.pid)), "las pruebas se ejecutaron en el anfitrión");
    // y el servidor sigue vivo
    assert.equal((await c.pedir("ping")).result !== undefined, true);
    await c.cerrar();
  });

  test("escribir y leer a través del proceso real, con rechazos legibles", async () => {
    const dir = proyecto();
    const c = lanzar(dir);
    await c.pedir("initialize", INIT);
    assert.equal((await c.pedir("tools/call", { name: "escribir_archivo", arguments: { ruta: "src/a.js", contenido: "v1" } })).result.isError, undefined);
    assert.equal(readFileSync(join(dir, "src", "a.js"), "utf8"), "v1");
    const mal = await c.pedir("tools/call", { name: "escribir_archivo", arguments: { ruta: "sub/.git/config", contenido: "x" } });
    assert.equal(mal.result.isError, true);
    assert.match(texto(mal), /vetada/);
    assert.ok(!existsSync(join(dir, "sub")));
    await c.cerrar();
  });

  test("CA-001-01 real: un agente corrige el código y las pruebas pasan en el entorno aislado", { skip: !DOCKER && "requiere FORGE_TEST_DOCKER=1 y Docker en marcha" }, async () => {
    const dir = proyecto({
      "src/suma.js": "module.exports = (a, b) => a - b;\n",
      "tests/suma.test.js": "const test = require('node:test'); const assert = require('node:assert'); const suma = require('../src/suma.js');\ntest('suma', () => assert.strictEqual(suma(2, 2), 4));\n",
    });
    const c = lanzar(dir);
    await c.pedir("initialize", INIT);
    const falla = await c.pedir("tools/call", { name: "ejecutar_pruebas", arguments: {} });
    assert.match(texto(falla), /Las pruebas FALLAN/, texto(falla));
    assert.equal(falla.result.isError, undefined);

    await c.pedir("tools/call", { name: "escribir_archivo", arguments: { ruta: "src/suma.js", contenido: "module.exports = (a, b) => a + b;\n" } });
    const pasa = await c.pedir("tools/call", { name: "ejecutar_pruebas", arguments: {} });
    assert.match(texto(pasa), /Las pruebas PASAN/, texto(pasa));
    await c.cerrar();
  });
});

describe("CA-004-06 — cliente oficial del protocolo", { skip: !SDK && "requiere FORGE_MCP_SDK con @modelcontextprotocol/sdk instalado" }, () => {
  test("inicializa, lista y llama a las tres herramientas", () => {
    const dir = proyecto({ "src/a.js": "hola" });
    const guion = `
      import { Client } from '@modelcontextprotocol/sdk/client/index.js';
      import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
      const t = new StdioClientTransport({ command: process.execPath, args: [${JSON.stringify(CLI)}, 'mcp', '--cwd', ${JSON.stringify(dir)}] });
      const c = new Client({ name: 'oficial', version: '1' }, { capabilities: {} });
      await c.connect(t);
      const R = { nombres: (await c.listTools()).tools.map((x) => x.name) };
      R.leer = (await c.callTool({ name: 'leer_archivo', arguments: { ruta: 'src/a.js' } })).content[0].text;
      R.vetada = Boolean((await c.callTool({ name: 'leer_archivo', arguments: { ruta: '.env' } })).isError);
      R.escribir = Boolean((await c.callTool({ name: 'escribir_archivo', arguments: { ruta: 'src/b.js', contenido: 'x' } })).isError);
      R.dependencias = Boolean((await c.callTool({ name: 'escribir_archivo', arguments: { ruta: 'package.json', contenido: '{}' } })).isError);
      try { await c.callTool({ name: 'no_existe', arguments: {} }); R.inexistente = 'sin error'; } catch (e) { R.inexistente = e.code; }
      await c.ping();
      await c.close();
      console.log(JSON.stringify(R));
    `;
    const r = spawnSync(process.execPath, ["--input-type=module", "-e", guion], { cwd: SDK, encoding: "utf8", timeout: 60_000 });
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(JSON.parse(r.stdout.trim().split("\n").pop() ?? "{}"), {
      nombres: ["ejecutar_pruebas", "leer_archivo", "escribir_archivo"], leer: "hola", vetada: true, escribir: false, dependencias: true, inexistente: -32602,
    });
  });
});
