// @ts-check
/**
 * Correcciones de la revisión independiente de S3 (2026-10-05): candado, vetos por nombre,
 * evidencia de pruebas, embedder de Ollama, topes del índice y duplicados del recuperador.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";

import { clasificarRuta } from "../core/ciclo/protocolo-archivos.js";
import { detectarSospecha, hayEvidenciaDePruebas } from "../core/ciclo/sospecha.js";
import { embedderOllama, tokenizar } from "../core/recuperacion/embeddings.js";
import { comandoDePruebas } from "../core/sandbox/sandbox-runner.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const tmp = () => mkdtempSync(join(tmpdir(), "forge-rev-"));
const escribir = (dir, ruta, contenido) => { mkdirSync(dirname(join(dir, ruta)), { recursive: true }); writeFileSync(join(dir, ruta), contenido); };

describe("M1 — el candado no pierde la exclusión mutua sin candado huérfano", () => {
  test("12 procesos compitiendo no coinciden nunca dentro de la sección crítica", async () => {
    const dir = tmp();
    const candado = join(dir, "lock", "c.lock");
    const marca = join(dir, "marca.txt");
    const modulo = pathToFileURL(join(ROOT, "core", "ciclo", "candado.js")).href;
    const script = `
      import { adquirir } from ${JSON.stringify(modulo)};
      import * as fs from "node:fs";
      let solapes = 0, tomados = 0;
      for (let i = 0; i < 25; i++) {
        let soltar;
        try { soltar = adquirir(${JSON.stringify(candado)}, "x"); } catch { continue; }
        tomados++;
        fs.writeFileSync(${JSON.stringify(marca)}, String(process.pid));
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3);
        if (fs.readFileSync(${JSON.stringify(marca)}, "utf8") !== String(process.pid)) solapes++;
        soltar();
      }
      process.stdout.write(JSON.stringify({ solapes, tomados }));
    `;
    const salidas = await Promise.all(Array.from({ length: 12 }, () => new Promise((resolver) => {
      const h = spawn(process.execPath, ["--input-type=module", "-e", script], { stdio: ["ignore", "pipe", "inherit"] });
      let out = "";
      h.stdout.on("data", (d) => { out += d; });
      h.on("close", () => resolver(JSON.parse(out || '{"solapes":-1,"tomados":0}')));
    })));
    const solapes = /** @type {any[]} */ (salidas).reduce((s, x) => s + x.solapes, 0);
    const tomados = /** @type {any[]} */ (salidas).reduce((s, x) => s + x.tomados, 0);
    assert.equal(solapes, 0, "dos procesos tuvieron el candado a la vez");
    assert.ok(tomados > 0, "alguien tomó el candado");
  });
});

describe("M2 — los vetos por nombre no alcanzan a código legítimo", () => {
  test("código y documentos con 'secret', 'credentials' o 'key' en el nombre no se vetan", () => {
    for (const r of ["src/secretary.js", "src/secrets-manager.ts", "src/lib/credentials.js", "src/auth/credentials.service.ts",
      "src/utils/secretStore.ts", "tests/secrets.test.js", "pkg/secrets.go", "pkg/credentials_test.go",
      "src/client_secret_handler.py", "docs/credentials-guide.md", "src/hotkey.json", "src/monkey.json"]) {
      assert.notEqual(clasificarRuta(r), "ruta_vetada", r);
    }
  });
  test("los archivos de secretos de verdad siguen vetados", () => {
    for (const r of ["credentials.json", "config/credentials.yml", "aws/credentials", "secrets.json", "secrets.yaml", "client_secret.json",
      "client_secret_123.apps.googleusercontent.json", "config/secret.txt", "private.key", "server.pem", ".env", ".env.local",
      "gcp-key.json", "service-account.json", "secrets/a.js", "token.json", "password.txt"]) {
      assert.equal(clasificarRuta(r), "ruta_vetada", r);
    }
  });
});

describe("M3 — evidencia de pruebas de más ejecutores", () => {
  test("unittest, go cacheado, rspec, jasmine, phpunit y maven cuentan como pruebas pasadas", () => {
    for (const salida of [
      "Ran 3 tests in 0.001s\n\nOK", "ok  \tdemo/pkg\t(cached)", "3 examples, 0 failures", "5 specs, 0 failures",
      "OK (4 tests, 9 assertions)", "Tests run: 6, Failures: 0, Errors: 0, Skipped: 0",
    ]) assert.ok(hayEvidenciaDePruebas(salida), salida);
  });
  test("sin pruebas ejecutadas sigue siendo sospechoso", () => {
    for (const salida of ["", "ok", "Ran 0 tests in 0.000s\n\nOK", "0 examples, 0 failures", "Tests run: 0, Failures: 0"]) {
      assert.ok(!hayEvidenciaDePruebas(salida), salida);
    }
    assert.equal(detectarSospecha({ stdout: "Ran 2 tests in 0.1s\n\nOK" }).length, 0);
  });
});

describe("M4 — el embedder de Ollama", () => {
  /** @param {(req: any, res: any) => void} manejar */
  const servidor = async (manejar) => {
    const s = createServer(manejar);
    await new Promise((r) => s.listen(0, "127.0.0.1", () => r(undefined)));
    return { s, url: "http://127.0.0.1:" + /** @type {any} */ (s.address()).port };
  };

  test("no sigue redirecciones: el contenido no sale a otra dirección", async () => {
    let recibido = "";
    const b = await servidor((req, res) => { req.on("data", (d) => { recibido += d; }); req.on("end", () => { res.end('{"embedding":[1,0]}'); }); });
    const a = await servidor((req, res) => { res.writeHead(307, { Location: b.url + "/api/embeddings" }); res.end(); });
    try {
      await assert.rejects(embedderOllama({ host: a.url, timeoutMs: 2000 }).embed(["CODIGO SECRETO"]));
      assert.equal(recibido, "", "el segundo servidor no debe recibir nada");
    } finally { a.s.close(); b.s.close(); }
  });

  test("el plazo cubre también el cuerpo de la respuesta", async () => {
    const a = await servidor((req, res) => { res.writeHead(200, { "Content-Type": "application/json" }); res.write('{"embedding":[1,'); });
    try {
      const t0 = Date.now();
      await assert.rejects(embedderOllama({ host: a.url, timeoutMs: 600 }).embed(["x"]));
      assert.ok(Date.now() - t0 < 4000, "no debe quedarse esperando");
    } finally { a.s.closeAllConnections?.(); a.s.close(); }
  });

  test("rechaza vectores y respuestas desmesurados", async () => {
    const a = await servidor((req, res) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ embedding: new Array(20000).fill(0.5) })); });
    try {
      await assert.rejects(embedderOllama({ host: a.url }).embed(["x"]), /demasiad/i);
    } finally { a.s.close(); }
  });

  test("acepta OLLAMA_HOST sin esquema y no deja contraseñas en el aviso", async () => {
    const a = await servidor((req, res) => { res.setHeader("Content-Type", "application/json"); res.end('{"embedding":[3,4]}'); });
    try {
      const v = await embedderOllama({ host: a.url.replace("http://", "") }).embed(["x"]);
      assert.deepEqual(v[0].map((n) => Math.round(n * 10) / 10), [0.6, 0.8]);
    } finally { a.s.close(); }
    await assert.rejects(embedderOllama({ host: "http://usuario:clave123@127.0.0.1:1", timeoutMs: 500 }).embed(["x"]), (e) => !/clave123/.test(String(e.message)));
  });
});

describe("B1 — la tokenización está acotada", () => {
  test("una cadena enorme no cuelga el proceso", () => {
    const t0 = Date.now();
    tokenizar("A".repeat(200_000) + "!");
    tokenizar("AB".repeat(100_000));
    assert.ok(Date.now() - t0 < 1500, "tardó " + (Date.now() - t0) + " ms");
  });
});

describe("B5 — comando de pruebas con opciones de npx", () => {
  test("--no-install y -y se quitan junto a npx", () => {
    assert.deepEqual(comandoDePruebas("npx --no-install jest --ci"), ["jest", "--ci"]);
    assert.deepEqual(comandoDePruebas("npx -y vitest run"), ["vitest", "run"]);
    assert.deepEqual(comandoDePruebas("npm test"), ["npm", "test"]);
  });
});

describe("B2-B4 — índice y recuperador", () => {
  test("B4: un archivo nombrado con otras mayúsculas no sale dos veces", async () => {
    const { recuperarSemantico } = await import("../core/recuperacion/recuperador-semantico.js");
    const dir = tmp();
    escribir(dir, "src/main.js", "// Cobros con tarjeta\nexport function cobrarTarjeta() { return 1; }\n");
    escribir(dir, "src/otro.js", "// Reembolso de pagos con tarjeta\nexport function reembolsarPago() { return 2; }\n");
    const r = await recuperarSemantico({
      cwd: dir, maxBytes: 20_000,
      tarea: { descripcion: "cobrar con tarjeta y reembolsar", archivos: ["SRC/MAIN.JS"] }, plan: { pasos: [] },
    });
    const principal = r.contexto.fragmentos.filter((f) => f.ruta.toLowerCase() === "src/main.js");
    assert.equal(principal.length, 1, JSON.stringify(r.contexto.fragmentos));
  });

  test("B4: los trozos solapados de un mismo archivo no repiten líneas", async () => {
    const { IndiceVectorial } = await import("../core/recuperacion/indice-vectorial.js");
    const { embedderHash } = await import("../core/recuperacion/embeddings.js");
    const dir = tmp();
    escribir(dir, "a.js", Array.from({ length: 100 }, (_, i) => `export const tarjetaPago${i} = ${i};`).join("\n"));
    const idx = new IndiceVectorial({ cwd: dir, embedder: embedderHash() });
    await idx.actualizar();
    const hallados = await idx.buscar("tarjeta pago", { k: 8, minimo: 0 });
    for (let i = 0; i < hallados.length; i++) for (let j = i + 1; j < hallados.length; j++) {
      const a = hallados[i], b = hallados[j];
      assert.ok(a.ruta !== b.ruta || a.fin < b.ini || b.fin < a.ini, `solape ${a.ini}-${a.fin} / ${b.ini}-${b.fin}`);
    }
  });

  test("B3: buscar no lee un archivo que creció por encima del tope", async () => {
    const { IndiceVectorial } = await import("../core/recuperacion/indice-vectorial.js");
    const { embedderHash } = await import("../core/recuperacion/embeddings.js");
    const dir = tmp();
    escribir(dir, "a.js", "export const tarjetaPago = 1;\n");
    const idx = new IndiceVectorial({ cwd: dir, embedder: embedderHash() });
    await idx.actualizar();
    writeFileSync(join(dir, "a.js"), "export const tarjetaPago = 1;\n" + "// x\n".repeat(60_000));
    assert.deepEqual(await idx.buscar("tarjeta pago", { minimo: 0 }), []);
  });
});

describe("B5 — respaldo", () => {
  test("acepta rutas que empiezan por '..' sin ser el directorio padre", async () => {
    const { Respaldo } = await import("../core/ciclo/respaldo.js");
    const dir = tmp();
    const rd = join(dir, ".sdd", "motor", "r", "respaldo", "t");
    escribir(dir, "..foo.js", "x");
    const r = new Respaldo(dir, rd);
    r.registrar("..foo.js");
    assert.doesNotThrow(() => new Respaldo(dir, rd));
  });

  test("restaurar sigue con el resto si falta una copia", async () => {
    const { Respaldo } = await import("../core/ciclo/respaldo.js");
    const { rmSync } = await import("node:fs");
    const dir = tmp();
    const rd = join(dir, ".sdd", "motor", "r", "respaldo", "t");
    escribir(dir, "a.js", "A"); escribir(dir, "b.js", "B");
    const r = new Respaldo(dir, rd);
    r.registrar("a.js"); r.registrar("b.js");
    writeFileSync(join(dir, "a.js"), "A2"); writeFileSync(join(dir, "b.js"), "B2");
    rmSync(join(rd, "archivos", "a.js"));
    const res = r.restaurar();
    assert.deepEqual(res.fallidos, ["a.js"]);
    assert.equal(readFileSync(join(dir, "b.js"), "utf8"), "B");
  });
});
