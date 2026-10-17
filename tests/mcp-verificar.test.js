// @ts-check
/**
 * Ciclo por MCP, fase 1 (spec 2026-10-14-ciclo-por-mcp): perfil `verificacion` y herramienta `verificar`.
 * El servidor y la herramienta son los reales; el único doble es el proceso `docker`
 * (tests/fixtures/mcp-verificar-docker-falso.mjs). El cliente habla MCP sin estado (2026-07-28) por tubería.
 */

import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync, realpathSync, symlinkSync, unlinkSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { validarArgumentos, META } from "../core/mcp/protocolo.js";
import { PERFILES, resolverPerfil } from "../core/mcp/perfiles.js";
import { leerLimites, estadoInterruptor } from "../core/mcp/limites.js";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE = join(RAIZ, "tests", "fixtures", "mcp-verificar-docker-falso.mjs");
const VIGILAR = join(RAIZ, "tests", "fixtures", "vigilar-red-y-claves.mjs");

const base = realpathSync(mkdtempSync(join(tmpdir(), "forge-mcp-verificar-")));
after(() => rmSync(base, { recursive: true, force: true }));
let n = 0;

const PASA = `import {test} from "node:test"; import assert from "node:assert"; test("ok", () => assert.equal(1, 1));`;
const FALLA = `import {test} from "node:test"; import assert from "node:assert"; test("mal", () => assert.equal(1, 2));`;

/** @param {string} cuerpo @param {Record<string, string>} [extra] */
function proyecto(cuerpo, extra = {}) {
  const dir = join(base, `p${++n}`, "proyecto");
  mkdirSync(join(dir, "tests"), { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "demo", type: "module", scripts: { test: "node --test" } }));
  writeFileSync(join(dir, "tests", "a.test.js"), cuerpo);
  for (const [r, c] of Object.entries(extra)) { mkdirSync(dirname(join(dir, r)), { recursive: true }); writeFileSync(join(dir, r), c); }
  return dir;
}

/**
 * Lanza el servidor y devuelve un cliente mínimo.
 * @param {string} dir
 * @param {{ env?: Record<string, string>, perfil?: string|null, nodeArgs?: string[], home?: string }} [o]
 */
function servidor(dir, o = {}) {
  const raiz = dirname(dir);
  const temporal = join(raiz, "tmp");
  mkdirSync(temporal, { recursive: true });
  const registro = join(raiz, "docker.jsonl");
  const home = o.home ?? join(raiz, "home");
  const { NODE_TEST_CONTEXT: _o, ...heredado } = process.env;
  const args = [...(o.nodeArgs ?? []), FIXTURE, "--cwd", dir];
  if (o.perfil !== null) args.push("--perfil", o.perfil ?? "verificacion");
  const proc = spawn(process.execPath, args, {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...heredado, TEMP: temporal, TMP: temporal, TMPDIR: temporal, FALSO_REGISTRO: registro, FRAGUA_HOME: home, ANTHROPIC_API_KEY: "", OPENAI_API_KEY: "", ...o.env },
  });
  let buffer = ""; let stderr = ""; let stdout = "";
  /** @type {Map<number, (m: any) => void>} */
  const esperando = new Map();
  proc.stdout.on("data", (d) => {
    stdout += d; buffer += d;
    let i;
    while ((i = buffer.indexOf("\n")) !== -1) {
      const linea = buffer.slice(0, i); buffer = buffer.slice(i + 1);
      try { const m = JSON.parse(linea); if (m.id !== undefined) esperando.get(m.id)?.(m); } catch { /* lo detectan las aserciones de stdout */ }
    }
  });
  proc.stderr.on("data", (d) => { stderr += d; });
  let id = 0;
  const meta = { [META.VERSION]: "2026-07-28", [META.CAPACIDADES]: {} };
  const c = {
    registro, home, stderr: () => stderr, stdout: () => stdout,
    docker: () => (existsSync(registro) ? readFileSync(registro, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []),
    /** @param {string} method @param {any} [params] */
    pedir(method, params = {}) {
      const mi = ++id;
      const p = new Promise((res, rej) => {
        const t = setTimeout(() => rej(new Error(`sin respuesta a ${method}`)), 60_000);
        t.unref();
        esperando.set(mi, (m) => { clearTimeout(t); res(m); });
      });
      proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: mi, method, params: { ...params, _meta: meta } }) + "\n");
      return Object.assign(p, { id: mi });
    },
    /** Petición de las revisiones CON saludo (sin `_meta`). @param {string} method @param {any} [params] */
    pedirConSaludo(method, params = {}) {
      const mi = ++id;
      const p = new Promise((res, rej) => {
        const t = setTimeout(() => rej(new Error(`sin respuesta a ${method}`)), 60_000);
        t.unref();
        esperando.set(mi, (m) => { clearTimeout(t); res(m); });
      });
      proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: mi, method, params }) + "\n");
      return Object.assign(p, { id: mi });
    },
    /** @param {string} name @param {any} [args] */
    llamar(name, args = {}) { return c.pedir("tools/call", { name, arguments: args }); },
    /** @param {number} requestId */
    cancelar(requestId) { proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/cancelled", params: { requestId } }) + "\n"); },
    cerrar: () => new Promise((res) => { proc.on("close", res); proc.stdin.end(); }),
  };
  return c;
}

/** @param {any} m */ const cuerpo = (m) => JSON.parse(m.result.content[0].text);
/** @param {any} m */ const textoDe = (m) => m.result.content.map((/** @type {any} */ x) => x.text).join("\n");
const esperar = (/** @type {number} */ ms) => new Promise((r) => setTimeout(r, ms));

async function conServidor(/** @type {string} */ dir, /** @type {Parameters<typeof servidor>[1]} */ o, /** @type {(c: ReturnType<typeof servidor>) => Promise<void>} */ f) {
  const c = servidor(dir, o);
  try { await f(c); } finally { await c.cerrar(); }
}

describe("validarArgumentos: arrays, números y booleanos (hallazgo del spike S0.1)", () => {
  const schema = {
    type: "object",
    properties: {
      lista: { type: "array", items: { type: "string", maxLength: 5 }, maxItems: 2, minItems: 1 },
      si: { type: "boolean" },
      num: { type: "integer", minimum: 1, maximum: 3 },
    },
    additionalProperties: false,
  };
  test("acepta lo válido", () => assert.equal(validarArgumentos(schema, { lista: ["a", "b"], si: true, num: 2 }), null));
  test("rechaza lo que no es array, el exceso, el vacío y los elementos que no son texto o son largos", () => {
    for (const lista of ["a", { 0: "a" }, ["a", "b", "c"], [], [1], [["a"]], ["abcdef"], [null]]) {
      assert.match(String(validarArgumentos(schema, { lista })), /lista/, JSON.stringify(lista));
    }
  });
  test("rechaza booleanos y números mal tipados o fuera de rango", () => {
    assert.match(String(validarArgumentos(schema, { si: "true" })), /si/);
    for (const num of ["1", 1.5, 0, 4, NaN, null]) assert.match(String(validarArgumentos(schema, { num })), /num/, String(num));
  });
});

describe("perfiles y límites: solo el entorno del usuario decide", () => {
  test("el perfil verificacion es exactamente [verificar]; el perfil por defecto conserva las tres de siempre", () => {
    assert.deepEqual([...PERFILES.verificacion], ["verificar"]);
    assert.deepEqual([...PERFILES.completo], ["ejecutar_pruebas", "leer_archivo", "escribir_archivo"]);
    assert.equal(resolverPerfil({ env: {} }).perfil, "completo");
    assert.equal(resolverPerfil({ argumento: "verificacion", env: {} }).perfil, "verificacion");
    assert.equal(resolverPerfil({ env: { FRAGUA_MCP_PERFIL: "verificacion" } }).perfil, "verificacion");
    assert.equal(resolverPerfil({ argumento: "completo", env: { FRAGUA_MCP_PERFIL: "verificacion" } }).perfil, "completo", "el argumento de arranque manda");
  });
  test("un perfil desconocido no arranca (falla cerrado)", () => {
    for (const p of ["todo", "VERIFICACION ", "", "__proto__", "constructor"]) {
      const r = resolverPerfil({ argumento: p, env: {} });
      assert.equal(r.ok, false, p);
    }
  });
  test("límites: valores por defecto, los del entorno y techos; lo inválido vuelve al defecto", () => {
    const d = leerLimites({});
    assert.deepEqual(d, { timeout_s: 300, salida_max_bytes: 16384, por_hora: 20, por_dia: 200 });
    assert.equal(leerLimites({ FRAGUA_MCP_TIMEOUT_S: "45" }).timeout_s, 45);
    assert.equal(leerLimites({ FRAGUA_MCP_TIMEOUT_S: "999999" }).timeout_s, 1800, "techo duro");
    for (const malo of ["0", "-3", "abc", "", "1e9x", "NaN", "Infinity"]) assert.equal(leerLimites({ FRAGUA_MCP_TIMEOUT_S: malo }).timeout_s, 300, malo);
  });
  test("interruptor: solo «normal»/sin definir/«activo» deja pasar; un valor desconocido apaga", () => {
    const dir = join(base, "estado-interruptor");
    for (const v of [undefined, "", "normal", "activo"]) assert.equal(estadoInterruptor({ FRAGUA_MCP_CICLO: v }, dir).apagado, false, String(v));
    for (const v of ["apagado", "off", "0", "false", "banana"]) assert.equal(estadoInterruptor({ FRAGUA_MCP_CICLO: v }, dir).apagado, true, v);
  });
});

describe("superficie mínima y fija", () => {
  test("tools/list expone solo `verificar`, con un único argumento opcional que es una lista de rutas", async () => {
    await conServidor(proyecto(PASA), {}, async (c) => {
      const r = /** @type {any} */ (await c.pedir("tools/list"));
      assert.deepEqual(r.result.tools.map((/** @type {any} */ t) => t.name), ["verificar"]);
      const esquema = r.result.tools[0].inputSchema;
      assert.deepEqual(Object.keys(esquema.properties), ["mutacion_archivos"]);
      assert.equal(esquema.additionalProperties, false);
      assert.equal(esquema.properties.mutacion_archivos.type, "array");
      assert.ok(!esquema.required || esquema.required.length === 0);
      for (const prohibido of ["comando", "cwd", "desde", "ruta", "contenido", "tope", "modelo"]) assert.ok(!(prohibido in esquema.properties), prohibido);
    });
  });

  test("las herramientas que escriben, leen o gastan no existen aunque el cliente conozca su nombre", async () => {
    const dir = proyecto(PASA);
    await conServidor(dir, {}, async (c) => {
      for (const nombre of ["escribir_archivo", "leer_archivo", "ejecutar_pruebas", "proponer_ciclo", "aprobar", "publicar", "__proto__", "constructor"]) {
        const r = /** @type {any} */ (await c.llamar(nombre, { ruta: "x", contenido: "y" }));
        assert.ok(r.error, nombre);
        assert.match(r.error.message, /desconocida/, nombre);
      }
      assert.equal(c.docker().filter((l) => l.orden === "run").length, 0);
      assert.deepEqual(readdirSync(dir).sort(), ["package.json", "tests"], "nada escrito en el proyecto");
    });
  });

  test("`forge mcp --perfil <desconocido>` sale con 1 sin arrancar; con --perfil verificacion lista solo verificar", () => {
    const cli = join(RAIZ, "cli", "index.js");
    const dir = proyecto(PASA);
    const mal = spawnSync(process.execPath, [cli, "mcp", "--cwd", dir, "--perfil", "todo"], { encoding: "utf8", input: "", timeout: 30_000 });
    assert.equal(mal.status, 1);
    assert.match(mal.stderr, /Perfil MCP no válido/);
    assert.equal(mal.stdout, "");
    const entrada = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: { _meta: { [META.VERSION]: "2026-07-28", [META.CAPACIDADES]: {} } } }) + "\n";
    const bien = spawnSync(process.execPath, [cli, "mcp", "--cwd", dir, "--perfil", "verificacion"], { encoding: "utf8", input: entrada, timeout: 30_000 });
    assert.deepEqual(JSON.parse(bien.stdout.trim()).result.tools.map((/** @type {any} */ t) => t.name), ["verificar"]);
  });

  test("sin --perfil el servidor conserva sus tres herramientas de siempre", async () => {
    await conServidor(proyecto(PASA), { perfil: null }, async (c) => {
      const r = /** @type {any} */ (await c.pedir("tools/list"));
      assert.deepEqual(r.result.tools.map((/** @type {any} */ t) => t.name), ["ejecutar_pruebas", "leer_archivo", "escribir_archivo"]);
    });
  });
});

describe("verificar: delega en core/verificar y devuelve el veredicto", () => {
  test("pasa: JSON con formato 1, sin tocar el proyecto, un solo contenedor", async () => {
    const dir = proyecto(PASA);
    const antes = readdirSync(dir).sort();
    await conServidor(dir, {}, async (c) => {
      const r = /** @type {any} */ (await c.llamar("verificar"));
      assert.ok(!r.result.isError, textoDe(r));
      const j = cuerpo(r);
      assert.equal(j.formato, 1);
      assert.equal(j.veredicto, "pasa");
      assert.equal(j.codigoSalida, 0);
      assert.equal(c.docker().filter((l) => l.orden === "run").length, 1);
    });
    assert.ok(readdirSync(dir).every((f) => antes.includes(f) || f === ".sdd"), "no aparece nada nuevo salvo el candado en .sdd");
  });

  test("falla: el veredicto va en el cuerpo y no es éxito", async () => {
    await conServidor(proyecto(FALLA), {}, async (c) => {
      const j = cuerpo(await c.llamar("verificar"));
      assert.equal(j.veredicto, "falla");
      assert.notEqual(j.codigoSalida, 0);
    });
  });

  test("cero pruebas ejecutadas no aparece como éxito", async () => {
    const dir = proyecto(PASA);
    unlinkSync(join(dir, "tests", "a.test.js"));
    await conServidor(dir, {}, async (c) => {
      const j = cuerpo(await c.llamar("verificar"));
      assert.notEqual(j.veredicto, "pasa", JSON.stringify(j));
    });
  });

  test("mutacion_archivos válidos llegan a verificar como mutación; el proyecto no se modifica", async () => {
    const dir = proyecto(
      `import {test} from "node:test"; import assert from "node:assert"; import {suma} from "../src/s.js"; test("s", () => assert.equal(suma(2, 3), 5));`,
      { "src/s.js": "export function suma(a, b) { return a + b; }\n" },
    );
    await conServidor(dir, {}, async (c) => {
      const j = cuerpo(await c.llamar("verificar", { mutacion_archivos: ["src/s.js"] }));
      assert.equal(j.veredicto, "pasa", JSON.stringify(j));
      assert.ok(j.mutacion && typeof j.mutacion === "object", "se pidió y se midió la mutación");
    });
    assert.equal(readFileSync(join(dir, "src", "s.js"), "utf8"), "export function suma(a, b) { return a + b; }\n");
  });

  test("sin Docker: error de herramienta, veredicto de infraestructura y ningún contenedor", async () => {
    await conServidor(proyecto(PASA), { env: { FALSO_SIN_DOCKER: "1" } }, async (c) => {
      const r = /** @type {any} */ (await c.llamar("verificar"));
      assert.equal(r.result.isError, true);
      assert.equal(cuerpo(r).veredicto, "infraestructura");
      assert.equal(c.docker().filter((l) => l.orden === "run").length, 0);
    });
  });

  test("nunca descarga ni construye imágenes por orden de un cliente", async () => {
    const { protegerCli } = await import("../core/mcp/herramientas-verificar.js");
    const { DockerCli } = await import("../core/sandbox/docker-cli.js");
    /** @type {string[][]} */
    const vistas = [];
    const cli = new DockerCli({ ejecutar: async (a) => { vistas.push(a); return { code: 0, stdout: "", stderr: "", timedOut: false }; } });
    const p = protegerCli(cli);
    for (const orden of [["pull", "-q", "node:20"], ["build", "-q", "-t", "x", "."]]) {
      const r = await p.cli.ejecutar(orden, {});
      assert.notEqual(r.code, 0, orden[0]);
    }
    assert.deepEqual(vistas, [], "ni pull ni build llegaron a Docker");
    const ok = await p.cli.ejecutar(["image", "inspect", "x"], {});
    assert.equal(ok.code, 0);
  });
});

describe("argumentos hostiles: no se sale del proyecto ni se ejecuta nada", () => {
  test("campos que no existen se rechazan antes de tocar Docker", async () => {
    await conServidor(proyecto(PASA), {}, async (c) => {
      for (const args of [
        { comando: "rm -rf /" }, { cwd: "C:\\Windows" }, { desde: "--upload-pack=calc" }, { ruta: "x" },
        { mutacion_archivos: "src/a.js" }, { mutacion_archivos: [1] }, { mutacion_archivos: [] }, { mutacion_archivos: { 0: "a.js" } },
        { mutacion_archivos: ["a.js", "b.js", "c.js", "d.js", "e.js", "f.js"] }, { mutacion_archivos: ["x".repeat(2000)] },
      ]) {
        const r = /** @type {any} */ (await c.llamar("verificar", args));
        assert.equal(r.result.isError, true, JSON.stringify(args).slice(0, 60));
      }
      assert.equal(c.docker().length, 0, "ninguna orden a Docker");
    });
  });

  test("rutas hostiles de `mutacion_archivos`: .., absolutas, UNC, unidades, vetadas, inexistentes, enlaces, órdenes embebidas", async () => {
    const dir = proyecto(PASA, { "src/ok.js": "export const a = 1;\n" });
    const fuera = join(dirname(dir), "secreto.js");
    writeFileSync(fuera, "export const s = 1;\n");
    let hayEnlace = true;
    try { symlinkSync(fuera, join(dir, "src", "enlace.js")); } catch { hayEnlace = false; }
    await conServidor(dir, {}, async (c) => {
      const malas = [
        "../secreto.js", "src/../../secreto.js", "..\\secreto.js", fuera, "/etc/passwd", "C:\\Windows\\win.ini", "C:win.ini",
        "\\\\servidor\\recurso\\x.js", "//servidor/recurso/x.js", ".git/config", ".sdd/estado.json", "node_modules/x/index.js",
        "src/no-existe.js", "src", "src/ok.js; rm -rf /", "src/ok.js && calc", "$(calc).js", "src/ok.js ", "src/ok.js.", "src/ok.js:flujo",
      ];
      if (hayEnlace) malas.push("src/enlace.js");
      for (const ruta of malas) {
        const r = /** @type {any} */ (await c.llamar("verificar", { mutacion_archivos: ["src/ok.js", ruta] }));
        assert.equal(r.result.isError, true, ruta);
        assert.equal(cuerpo(r).veredicto, "no_ejecutada", ruta);
      }
      assert.equal(c.docker().length, 0, "nada llegó a Docker con una ruta hostil");
    });
  });

  test("el texto no confiable no cambia el comando: se ejecuta el del proyecto, en el contenedor, y nada en el anfitrión", async () => {
    const marca = join(base, `marca-${++n}`);
    const dir = proyecto(PASA, { "tests/b.test.js": PASA });
    await conServidor(dir, {}, async (c) => {
      const r = /** @type {any} */ (await c.llamar("verificar", { comando: `node -e "require('fs').writeFileSync('${marca}','x')"` }));
      assert.equal(r.result.isError, true);
    });
    assert.ok(!existsSync(marca));
  });
});

describe("límites del servidor (del entorno del usuario, no del repositorio)", () => {
  test("tope de tamaño de la salida: el JSON sigue siendo válido y cabe", async () => {
    await conServidor(proyecto(PASA), { env: { FALSO_SALIDA_GRANDE: "300000", FRAGUA_MCP_SALIDA_MAX_BYTES: "2048" } }, async (c) => {
      const r = /** @type {any} */ (await c.llamar("verificar"));
      const t = textoDe(r);
      assert.ok(Buffer.byteLength(t) <= 2048, `tamaño ${Buffer.byteLength(t)}`);
      assert.ok(JSON.parse(t).veredicto);
    });
  });

  test("tiempo máximo: corta, mata el contenedor y la siguiente llamada ya no está ocupada", async () => {
    const dir = proyecto(PASA, { ".sdd/sdd.config.yaml": "sandbox:\n  timeout_s: 99999\n" });
    await conServidor(dir, { env: { FALSO_COLGAR: "1", FRAGUA_MCP_TIMEOUT_S: "1" } }, async (c) => {
      const t0 = Date.now();
      const r = /** @type {any} */ (await c.llamar("verificar"));
      assert.ok(Date.now() - t0 < 20_000, "no esperó al timeout del archivo del proyecto");
      assert.equal(r.result.isError, true);
      assert.equal(cuerpo(r).codigo, "tiempo");
      const run = c.docker().find((l) => l.orden === "run");
      assert.ok(run);
      assert.ok(c.docker().some((l) => l.orden === "rm" && l.args.includes(run.nombre)), "se eliminó el contenedor por nombre");
    });
  });

  test("cancelación del cliente: detiene el contenedor (kill y rm por nombre) y no responde a la petición cancelada", async () => {
    await conServidor(proyecto(PASA), { env: { FALSO_COLGAR: "1", FRAGUA_MCP_TIMEOUT_S: "120" } }, async (c) => {
      const p = c.llamar("verificar");
      let respondio = false;
      p.then(() => { respondio = true; }, () => {});
      for (let i = 0; i < 100 && !c.docker().some((l) => l.orden === "run"); i++) await esperar(100);
      const run = c.docker().find((l) => l.orden === "run");
      assert.ok(run, "el contenedor arrancó");
      c.cancelar(p.id);
      for (let i = 0; i < 100 && !c.docker().some((l) => l.orden === "rm" && l.args.includes(run.nombre)); i++) await esperar(100);
      assert.ok(c.docker().some((l) => l.orden === "rm" && l.args.includes(run.nombre)), "el contenedor se eliminó tras cancelar");
      assert.equal(respondio, false);
    });
  });

  test("LÍMITE CONOCIDO: con el saludo `initialize` la cancelación no llega a la herramienta; solo corta el tiempo máximo", async () => {
    await conServidor(proyecto(PASA), { env: { FALSO_COLGAR: "1", FRAGUA_MCP_TIMEOUT_S: "4" } }, async (c) => {
      await c.pedirConSaludo("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } });
      const p = c.pedirConSaludo("tools/call", { name: "verificar", arguments: {} });
      for (let i = 0; i < 100 && !c.docker().some((l) => l.orden === "run"); i++) await esperar(100);
      const run = c.docker().find((l) => l.orden === "run");
      assert.ok(run);
      c.cancelar(p.id);
      await esperar(1500);
      assert.ok(!c.docker().some((l) => l.orden === "rm" && l.args.includes(run.nombre)), "la cancelación no detuvo el contenedor (límite documentado)");
      const r = /** @type {any} */ (await p);
      assert.equal(cuerpo(r).codigo, "tiempo", "terminó por el tiempo máximo del servidor");
      assert.ok(c.docker().some((l) => l.orden === "rm" && l.args.includes(run.nombre)));
    });
  });

  test("una verificación a la vez: la segunda llamada recibe «ocupado» y no se encola", async () => {
    await conServidor(proyecto(PASA), { env: { FALSO_COLGAR: "1", FRAGUA_MCP_TIMEOUT_S: "2" } }, async (c) => {
      const primera = c.llamar("verificar");
      for (let i = 0; i < 100 && !c.docker().some((l) => l.orden === "run"); i++) await esperar(100);
      const segunda = /** @type {any} */ (await c.llamar("verificar"));
      assert.equal(segunda.result.isError, true);
      assert.equal(cuerpo(segunda).codigo, "ocupado");
      assert.equal(c.docker().filter((l) => l.orden === "run").length, 1);
      await primera;
    });
  });

  test("cupo por hora, persistente en el estado del usuario: sobrevive a reiniciar el servidor", async () => {
    const dir = proyecto(PASA);
    const env = { FRAGUA_MCP_POR_HORA: "2" };
    await conServidor(dir, { env }, async (c) => {
      assert.equal(cuerpo(await c.llamar("verificar")).veredicto, "pasa");
      assert.equal(cuerpo(await c.llamar("verificar")).veredicto, "pasa");
    });
    await conServidor(dir, { env }, async (c) => {
      const r = /** @type {any} */ (await c.llamar("verificar"));
      assert.equal(r.result.isError, true);
      assert.equal(cuerpo(r).codigo, "cupo");
      assert.equal(c.docker().filter((l) => l.orden === "run").length, 2, "la tercera no llegó a Docker");
    });
  });

  test("un contador manipulado falla cerrado: sin contador válido no se ejecuta", async () => {
    const dir = proyecto(PASA);
    await conServidor(dir, {}, async (c) => { await c.llamar("verificar"); });
    const raiz = join(dirname(dir), "home");
    const hallado = [];
    const buscar = (/** @type {string} */ d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) buscar(p); else if (e.name === "cupos.json") hallado.push(p); } };
    buscar(raiz);
    assert.equal(hallado.length, 1, "el contador está en el estado del usuario, fuera del proyecto");
    const j = JSON.parse(readFileSync(hallado[0], "utf8"));
    j.dias.n = 0; j.horas.n = 0;
    writeFileSync(hallado[0], JSON.stringify(j));
    await conServidor(dir, {}, async (c) => {
      const antes = c.docker().filter((l) => l.orden === "run").length;
      const r = /** @type {any} */ (await c.llamar("verificar"));
      assert.equal(r.result.isError, true);
      assert.equal(cuerpo(r).codigo, "contador_invalido");
      assert.equal(c.docker().filter((l) => l.orden === "run").length, antes, "no se lanzó otro contenedor");
    });
  });

  test("interruptor: apagado, o un valor que no se reconoce, apaga toda herramienta", async () => {
    for (const v of ["apagado", "banana"]) {
      await conServidor(proyecto(PASA), { env: { FRAGUA_MCP_CICLO: v } }, async (c) => {
        const r = /** @type {any} */ (await c.llamar("verificar"));
        assert.equal(r.result.isError, true, v);
        assert.equal(cuerpo(r).codigo, "apagado", v);
        assert.equal(c.docker().length, 0);
      });
    }
  });

  test("cada llamada deja una línea de auditoría en el estado del usuario, con argumentos acotados", async () => {
    const dir = proyecto(PASA);
    await conServidor(dir, {}, async (c) => {
      await c.llamar("verificar");
      await c.llamar("verificar", { mutacion_archivos: ["../fuera.js"] });
    });
    const archivo = join(dirname(dir), "home");
    const encontrados = [];
    const buscar = (/** @type {string} */ d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) buscar(p); else if (e.name === "auditoria.jsonl") encontrados.push(p); } };
    buscar(archivo);
    assert.equal(encontrados.length, 1);
    const lineas = readFileSync(encontrados[0], "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
    assert.equal(lineas.length, 2);
    assert.equal(lineas[0].herramienta, "verificar");
    assert.equal(lineas[0].veredicto, "pasa");
    assert.equal(lineas[1].veredicto, "no_ejecutada");
  });
});

describe("sin modelo, sin red, sin claves, sin puertos", () => {
  test("el servidor del perfil no llama a fetch ni lee variables con aspecto de clave; stdout solo lleva protocolo", async () => {
    const vigilancia = join(base, `vigilancia-${++n}.jsonl`);
    await conServidor(proyecto(PASA), {
      nodeArgs: ["--import", pathToFileURL(VIGILAR).href],
      env: { FORGE_VIGILANCIA: vigilancia, ANTHROPIC_API_KEY: "sk-ant-centinela-no-leer", OPENAI_API_KEY: "sk-centinela-no-leer" },
    }, async (c) => {
      await c.pedir("tools/list");
      assert.equal(cuerpo(await c.llamar("verificar")).veredicto, "pasa");
      for (const linea of c.stdout().split("\n").filter(Boolean)) JSON.parse(linea);
      assert.ok(!c.stdout().includes("centinela"));
    });
    assert.ok(!existsSync(vigilancia) || readFileSync(vigilancia, "utf8").trim() === "", existsSync(vigilancia) ? readFileSync(vigilancia, "utf8") : "");
  });

  test("estático: los módulos nuevos no importan proveedores de modelo, integraciones ni claves, ni abren sockets", () => {
    for (const f of ["perfiles.js", "limites.js", "herramientas-verificar.js"]) {
      const src = readFileSync(join(RAIZ, "core", "mcp", f), "utf8");
      const imports = [...src.matchAll(/(?:from\s+|import\s*\()\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
      for (const i of imports) assert.ok(!/llm-providers|integraciones|proveedores|contrato/.test(i), `${f} importa ${i}`);
      assert.ok(!/node:(?:net|http|https|dgram|tls)|from ['"](?:net|http|https|dgram|tls)['"]/.test(src), `${f} usa red`);
      assert.ok(!/API_?KEY|process\.env\.[A-Z_]*TOKEN/i.test(src), `${f} nombra claves`);
    }
  });
});
