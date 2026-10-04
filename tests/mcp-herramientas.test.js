// @ts-check
/**
 * Las tres herramientas MCP (spec 2026-10-03-herramientas-mcp).
 * Cubre CA-001-01 a CA-001-04, CA-002-01 a CA-002-04 y CA-003-01 a CA-003-06.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PassThrough } from "node:stream";

import { crearHerramientas, MAX_ESCRITURA_BYTES, MAX_LECTURA_BYTES } from "../core/mcp/herramientas.js";
import { ServidorMcp } from "../core/mcp/protocolo.js";
import { validarRuta } from "../core/ciclo/protocolo-archivos.js";

const tmp = (p) => mkdtempSync(join(tmpdir(), p));
const escribir = (dir, ruta, contenido) => { mkdirSync(join(dir, ruta, ".."), { recursive: true }); writeFileSync(join(dir, ruta), contenido); };

/** @param {any} opciones */
function herramientas(opciones = {}) {
  const cwd = opciones.cwd ?? tmp("forge-mcp-");
  const lista = crearHerramientas({ cwd, ...opciones });
  const h = Object.fromEntries(lista.map((x) => [x.name, x]));
  return { cwd, h, lista };
}
const runnerFalso = (r = {}) => {
  const llamadas = [];
  return { llamadas, test: async (cwd) => { llamadas.push(cwd); return { exitCode: 0, stdout: "", stderr: "", timedOut: false, infraError: false, durationMs: 1200, ...r }; } };
};

describe("ejecutar_pruebas", () => {
  test("CA-001-01: devuelve el resultado, el código de salida y el final de la salida", async () => {
    const runner = runnerFalso({ exitCode: 0, stdout: "ok 1 - suma\n# pass 1" });
    const { h, cwd } = herramientas({ runner });
    const r = await h.ejecutar_pruebas.ejecutar({});
    assert.equal(r.error, undefined);
    assert.match(r.texto, /Las pruebas PASAN\./);
    assert.match(r.texto, /categoría: pass/);
    assert.match(r.texto, /código de salida: 0/);
    assert.match(r.texto, /# pass 1/);
    assert.deepEqual(runner.llamadas, [cwd]);
  });

  test("CA-001-01: fallo, tiempo agotado y fallo del entorno se distinguen; solo el último es un error de la herramienta", async () => {
    const casos = [
      [{ exitCode: 1 }, "FALLAN", "fail", undefined],
      [{ exitCode: null, timedOut: true }, "tiempo máximo", "timeout", undefined],
      [{ exitCode: null, infraError: true, stderr: "Docker caído" }, "no pudo ejecutar", "infra_error", true],
    ];
    for (const [r, frase, categoria, error] of casos) {
      const res = await herramientas({ runner: runnerFalso(r) }).h.ejecutar_pruebas.ejecutar({});
      assert.match(res.texto, new RegExp(frase));
      assert.match(res.texto, new RegExp(`categoría: ${categoria}`));
      assert.equal(res.error, error, categoria);
    }
  });

  test("CA-001-01: la salida no lleva secretos y se recorta al final", async () => {
    const stdout = "x".repeat(20_000) + "\nDB_PASSWORD=hunter2hunter2\nFINAL";
    const r = await herramientas({ runner: runnerFalso({ exitCode: 1, stdout }) }).h.ejecutar_pruebas.ejecutar({});
    assert.ok(!r.texto.includes("hunter2"));
    assert.match(r.texto, /FINAL/);
    assert.ok(Buffer.byteLength(r.texto) < 9000);
  });

  test("CA-001-02: sin entorno aislado devuelve un error y no ejecuta nada", async () => {
    let creado = 0;
    const { h } = herramientas({ crearRunner: async () => { creado++; throw new Error("Docker no está disponible: daemon caído"); } });
    const r = await h.ejecutar_pruebas.ejecutar({});
    assert.equal(r.error, true);
    assert.match(r.texto, /Docker no está disponible/);
    assert.equal(creado, 1);
    const sin = await herramientas({}).h.ejecutar_pruebas.ejecutar({});
    assert.equal(sin.error, true);
    assert.match(sin.texto, /No hay un entorno aislado/);
  });

  test("CA-001-03: dos ejecuciones simultáneas no se pisan; la segunda recibe «ocupado» y luego se puede volver a usar", async () => {
    let soltar;
    const bloqueado = new Promise((r) => (soltar = r));
    const runner = { test: async () => { await bloqueado; return { exitCode: 0, stdout: "", stderr: "", durationMs: 1 }; } };
    const { h } = herramientas({ runner });

    const primera = h.ejecutar_pruebas.ejecutar({});
    await new Promise((r) => setTimeout(r, 30));
    const segunda = await h.ejecutar_pruebas.ejecutar({});
    assert.equal(segunda.error, true);
    assert.match(segunda.texto, /ocupado/);

    soltar();
    assert.match((await primera).texto, /PASAN/);
    assert.match((await h.ejecutar_pruebas.ejecutar({})).texto, /PASAN/, "el candado se liberó");
  });

  test("CA-001-03: con un ciclo verificado en marcha (candado de proyecto de otro proceso vivo) responde «ocupado»", async () => {
    const { h, cwd } = herramientas({ runner: runnerFalso() });
    const vivo = spawn(process.execPath, ["-e", "setTimeout(() => {}, 30000)"], { stdio: "ignore" });
    try {
      escribir(cwd, ".sdd/motor/proyecto.lock", JSON.stringify({ pid: vivo.pid, ts: Date.now() }));
      const r = await h.ejecutar_pruebas.ejecutar({});
      assert.equal(r.error, true);
      assert.match(r.texto, /ocupado/);
      assert.match(r.texto, new RegExp(String(vivo.pid)));
    } finally {
      vivo.kill();
    }
  });

  test("CA-001-04: no acepta comandos: el esquema no tiene argumentos y el servidor rechaza cualquiera", async () => {
    const { lista } = herramientas({ runner: runnerFalso() });
    const t = lista.find((x) => x.name === "ejecutar_pruebas");
    assert.deepEqual(t?.inputSchema.properties, {});

    const entrada = new PassThrough(); const salida = new PassThrough(); let crudo = "";
    salida.on("data", (d) => (crudo += d));
    const fin = new ServidorMcp({ nombre: "p", version: "1", herramientas: lista, entrada, salida }).iniciar();
    entrada.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "ejecutar_pruebas", arguments: { comando: "rm -rf /" } } }) + "\n");
    entrada.end();
    await fin;
    const r = JSON.parse(crudo).result;
    assert.equal(r.isError, true);
    assert.match(r.content[0].text, /argumento desconocido: "comando"/);
  });
});

describe("leer_archivo", () => {
  test("CA-002-01: devuelve el contenido de un archivo del proyecto", async () => {
    const { h, cwd } = herramientas();
    escribir(cwd, "src/a.js", "const a = 1;\n");
    assert.deepEqual(await h.leer_archivo.ejecutar({ ruta: "src/a.js" }), { texto: "const a = 1;\n" });
  });

  test("CA-002-02: rechaza lo que sale del proyecto, lo vetado y los enlaces, con una razón", async () => {
    const { h, cwd } = herramientas();
    for (const f of [".env", "sub/.git/config", "secrets/token.txt", ".npmrc", "id_rsa", "config/credentials.json"]) escribir(cwd, f, "SECRETO");
    const casos = [
      ["../fuera.txt", /sale del proyecto/], ["/etc/passwd", /relativa/], ["C:\\Windows\\win.ini", /relativa/],
      [".env", /vetada/], ["sub/.git/config", /vetada/], ["secrets/token.txt", /vetada/], [".npmrc", /vetada/], ["id_rsa", /vetada/], ["config/credentials.json", /vetada/],
      [".GIT/config", /vetada/], [".git./config", /Windows/], ["CON", /Windows/],
    ];
    for (const [ruta, patron] of casos) {
      const r = await h.leer_archivo.ejecutar({ ruta });
      assert.equal(r.error, true, ruta);
      assert.match(r.texto, patron, ruta);
      assert.ok(!r.texto.includes("SECRETO"), ruta);
    }
  });

  test("CA-002-02: un enlace a un secreto no sirve para leerlo", async (t) => {
    const { h, cwd } = herramientas();
    escribir(cwd, ".env", "SECRETO");
    try { symlinkSync(join(cwd, ".env"), join(cwd, "inocente.txt"), "file"); } catch { t.skip("este sistema no permite enlaces de archivo"); return; }
    const r = await h.leer_archivo.ejecutar({ ruta: "inocente.txt" });
    assert.equal(r.error, true);
    assert.ok(!r.texto.includes("SECRETO"));
  });

  test("CA-002-03: un archivo grande se devuelve recortado y lo dice", async () => {
    const { h, cwd } = herramientas();
    escribir(cwd, "grande.txt", "a".repeat(MAX_LECTURA_BYTES + 5000));
    const r = await h.leer_archivo.ejecutar({ ruta: "grande.txt" });
    assert.equal(r.error, undefined);
    assert.match(r.texto, /\[archivo recortado: se muestran 262144 de 267144 bytes\]/);
    assert.ok(Buffer.byteLength(r.texto) < MAX_LECTURA_BYTES + 200);
  });

  test("CA-002-04: manifiestos y configuración se pueden leer aunque no se puedan escribir", async () => {
    const { h, cwd } = herramientas();
    escribir(cwd, "package.json", '{"name":"x"}');
    escribir(cwd, "jest.config.js", "module.exports = {};");
    escribir(cwd, ".github/workflows/ci.yml", "on: push");
    for (const [ruta, trozo] of [["package.json", '"name"'], ["jest.config.js", "module.exports"], [".github/workflows/ci.yml", "on: push"]]) {
      const r = await h.leer_archivo.ejecutar({ ruta });
      assert.equal(r.error, undefined, ruta);
      assert.ok(r.texto.includes(trozo), ruta);
    }
  });

  test("errores útiles: no existe, es una carpeta, es binario", async () => {
    const { h, cwd } = herramientas();
    mkdirSync(join(cwd, "carpeta"));
    writeFileSync(join(cwd, "bin.dat"), Buffer.from([1, 2, 0, 3]));
    assert.match((await h.leer_archivo.ejecutar({ ruta: "nada.txt" })).texto, /No existe/);
    assert.match((await h.leer_archivo.ejecutar({ ruta: "carpeta" })).texto, /no es un archivo/);
    assert.match((await h.leer_archivo.ejecutar({ ruta: "bin.dat" })).texto, /binario/);
  });
});

describe("escribir_archivo", () => {
  test("CA-003-01: escribe un archivo permitido y devuelve su huella", async () => {
    const { h, cwd } = herramientas();
    const r = await h.escribir_archivo.ejecutar({ ruta: "src/nuevo/a.js", contenido: "hola" });
    assert.equal(r.error, undefined);
    assert.match(r.texto, /Escrito: src\/nuevo\/a\.js/);
    assert.match(r.texto, /sha256: [0-9a-f]{64}/);
    assert.equal(readFileSync(join(cwd, "src", "nuevo", "a.js"), "utf8"), "hola");
  });

  test("CA-003-02: rechaza las mismas rutas que el ciclo (una sola implementación de las reglas)", async () => {
    const { h, cwd } = herramientas();
    const rutas = [
      "../fuera.js", "/etc/x", "sub/.git/config", ".git", ".GIT/config", ".git./config", "a.js::$DATA", "GIT~1/x", "CON", ".sdd/estado.json", ".claude/settings.json",
      "node_modules/x/i.js", ".env", ".npmrc", "id_rsa", "deploy/.ssh/id_rsa", "terraform.tfstate", "gcp-key.json", "config/secrets/prod.json",
    ];
    for (const ruta of rutas) {
      const mcp = await h.escribir_archivo.ejecutar({ ruta, contenido: "x" });
      const ciclo = validarRuta(cwd, ruta);
      assert.equal(mcp.error, true, `${ruta} se escribió por MCP`);
      assert.equal(ciclo.ok, false, `${ruta} lo acepta el ciclo`);
      assert.ok(!existsSync(join(cwd, ruta)), `${ruta} existe en disco`);
    }
    assert.ok(!existsSync(join(cwd, "sub")) && !existsSync(join(cwd, ".git")));
  });

  test("CA-003-02: un enlace a .git no sirve para escribir dentro del repositorio", async (t) => {
    const { h, cwd } = herramientas();
    mkdirSync(join(cwd, ".git", "hooks"), { recursive: true });
    try { symlinkSync(join(cwd, ".git"), join(cwd, "g"), "junction"); } catch { t.skip("no se pueden crear enlaces"); return; }
    const r = await h.escribir_archivo.ejecutar({ ruta: "g/hooks/pre-commit", contenido: "#!/bin/sh" });
    assert.equal(r.error, true);
    assert.ok(!existsSync(join(cwd, ".git", "hooks", "pre-commit")));
  });

  test("CA-003-03: dependencias y configuración ejecutable no se aplican y piden revisión humana", async () => {
    const { h, cwd } = herramientas();
    for (const ruta of ["package.json", "requirements.txt", ".husky/pre-commit", ".github/workflows/ci.yml", "conftest.py", "jest.config.js", "Makefile"]) {
      const r = await h.escribir_archivo.ejecutar({ ruta, contenido: "x" });
      assert.equal(r.error, true, ruta);
      assert.match(r.texto, /revisión humana/, ruta);
      assert.match(r.texto, /Pide a una persona/, ruta);
      assert.ok(!existsSync(join(cwd, ruta)), ruta);
    }
  });

  test("CA-003-04: el rol de implementación no escribe pruebas, y el de pruebas solo pruebas", async () => {
    const { h, cwd } = herramientas();
    for (const ruta of ["tests/a.test.js", "test.js", "foo_test.js", "tests.py", "tests/helper.js"]) {
      const r = await h.escribir_archivo.ejecutar({ ruta, contenido: "x" });
      assert.equal(r.error, true, ruta);
      assert.match(r.texto, /no se pueden escribir archivos de prueba/, ruta);
    }
    assert.equal((await h.escribir_archivo.ejecutar({ ruta: "tests/a.test.js", contenido: "x", rol: "pruebas" })).error, undefined);
    assert.ok(existsSync(join(cwd, "tests", "a.test.js")));

    const codigo = await h.escribir_archivo.ejecutar({ ruta: "src/a.js", contenido: "x", rol: "pruebas" });
    assert.equal(codigo.error, true);
    assert.match(codigo.texto, /solo se pueden escribir archivos de prueba/);
  });

  test("CA-003-05: guarda un respaldo del contenido anterior antes de la primera escritura", async () => {
    const cwd = tmp("forge-mcp-");
    const dirMotor = join(cwd, ".sdd", "motor", "mcp-prueba");
    escribir(cwd, "src/a.js", "ORIGINAL");
    const { h } = herramientas({ cwd, dirMotor });
    await h.escribir_archivo.ejecutar({ ruta: "src/a.js", contenido: "v1" });
    await h.escribir_archivo.ejecutar({ ruta: "src/a.js", contenido: "v2" });
    assert.equal(readFileSync(join(cwd, "src", "a.js"), "utf8"), "v2");
    assert.equal(readFileSync(join(dirMotor, "respaldo", "mcp", "archivos", "src", "a.js"), "utf8"), "ORIGINAL", "solo cuenta la primera escritura");
  });

  test("CA-003-06: rechaza contenidos mayores que el tope", async () => {
    const { h, cwd } = herramientas();
    const r = await h.escribir_archivo.ejecutar({ ruta: "grande.js", contenido: "é".repeat(MAX_ESCRITURA_BYTES / 2 + 10) });
    assert.equal(r.error, true);
    assert.match(r.texto, /supera el máximo/);
    assert.ok(!existsSync(join(cwd, "grande.js")));
  });

  test("una ruta que es un directorio se rechaza sin lanzar", async () => {
    const { h, cwd } = herramientas();
    mkdirSync(join(cwd, "src"));
    const r = await h.escribir_archivo.ejecutar({ ruta: "src", contenido: "x" });
    assert.equal(r.error, true);
    assert.match(r.texto, /directorio/);
  });
});
