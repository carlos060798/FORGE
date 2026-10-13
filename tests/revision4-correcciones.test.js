// @ts-check
/**
 * Cuarta revisión independiente (revision-independiente-4.md): N4-03, N4-04, N4-05, N4-07, N4-08 y N4-09.
 *
 *   N4-03  redacción por valor: secretos en código sí, código legítimo no
 *   N4-04  el cuerpo de una clave privada no llega al modelo por tramo, sin END ni con `buscar`
 *   N4-05  un archivo con BOM conserva el BOM al editarse y el diario lo reconoce
 *   N4-07  los temporales huérfanos de `escribirArchivo` se barren
 *   N4-08  `import`, `export` y `runner` escriben por `escritura-segura`, y nada en cli/ escribe directo
 *   N4-09  `editar` acepta el literal `[REDACTADO` cuando el archivo ya lo tiene
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { crearHerramientasCoder } from "../core/ciclo/herramientas-coder.js";
import { redactarFormatos } from "../core/ciclo/redactar.js";
import { Respaldo } from "../core/ciclo/respaldo.js";
import { escribirArchivo, EDAD_TEMPORAL_HUERFANO_MS } from "../core/escritura-segura.js";
import { cmdImport } from "../cli/import.js";
import { cmdExport } from "../cli/export.js";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const sha = (t) => createHash("sha256").update(t).digest("hex");

function entorno() {
  const base = mkdtempSync(join(tmpdir(), "forge-rev4-"));
  const dir = join(base, "proy");
  mkdirSync(dir);
  const h = crearHerramientasCoder(/** @type {any} */ ({
    cwd: dir, vetadas: [], pruebas: [], respaldo: new Respaldo(dir, join(base, "respaldo")), taskId: "T1",
    log: { append: () => {} },
    runner: { test: async () => ({ exitCode: 0, stdout: "", stderr: "", timedOut: false, infraError: false }) },
  }));
  const poner = (ruta, contenido) => { mkdirSync(dirname(join(dir, ruta)), { recursive: true }); writeFileSync(join(dir, ruta), contenido); };
  return { base, dir, h, poner, usar: (n, e = {}) => h.ejecutar(n, e) };
}

// ── N4-03 ───────────────────────────────────────────────────────────────────────
/** [línea, el secreto que no debe llegar al modelo] */
const SECRETOS = [
  ['const password = "Zq8!kLm2#xP9vR";', "Zq8!kLm2#xP9vR"],
  ['apiKey: "7f3a9c2e1b8d4f6a0c5e7b9d1a3f5c7e",', "7f3a9c2e1b8d4f6a0c5e7b9d1a3f5c7e"],
  ["client_secret = 'Tq9#mLp2$vX8zKw4'", "Tq9#mLp2$vX8zKw4"],
  ['cadena = "host=db.interno port=5432 user=app password=Zq8kLm2xP9"', "Zq8kLm2xP9"],
  ["Server=db;Database=ventas;Uid=sa;Pwd=Zq8!kLm2;", "Zq8!kLm2"],
  ['"dbPass": "Zq8!kLm2#xP9vR"', "Zq8!kLm2#xP9vR"],
  ['"client_secret": "GOCSPX-aBcD3fGhIjKlMnOpQrStUvWx"', "GOCSPX-aBcD3fGhIjKlMnOpQrStUvWx"],
  ['TOKEN = "xapp-1-A0123456789-1234567890-abcdef0123456789abcdef"', "xapp-1-A0123456789-1234567890-abcdef0123456789abcdef"],
  ["export DB_PASSWORD=Zq8!kLm2#xP9vR", "Zq8!kLm2#xP9vR"],
  ['authToken = "Zq8kLm2xP9vRtY7u"', "Zq8kLm2xP9vRtY7u"],
  ['const dbPassword = "Zq8!kLm2#xP9vR"', "Zq8!kLm2#xP9vR"],
  ["secret_token: 0123456789abcdef0123456789abcdef01234567", "0123456789abcdef0123456789abcdef01234567"],
  ['headers = {"Authorization": "Basic dXNlcjpwYXNzd29yZDEyMw=="}', "dXNlcjpwYXNzd29yZDEyMw=="],
  ["curl -H 'Authorization: Basic dXNlcjpwYXNzd29yZDEyMw==' https://x", "dXNlcjpwYXNzd29yZDEyMw=="],
  ["REDIS_URL=redis://:Zq8kLm2xP9@cache:6379/0", "Zq8kLm2xP9"],
  ['pwd := "Zq8!kLm2#xP9vR"', "Zq8!kLm2#xP9vR"],
  ["db_password: 'N7#vB2$kQ9!xLm4'", "N7#vB2$kQ9!xLm4"],
  ['conn = "postgres://app:Zq8kLm2xP9@db/ventas"', "Zq8kLm2xP9"],
  ['config.api_key = "aB3dE5gH7jK9mN1pQ3sT"', "aB3dE5gH7jK9mN1pQ3sT"],
  ["Host=db;User Id=sa;Password=Zq8!kLm2xP;Encrypt=true", "Zq8!kLm2xP"],
];

/** Código legítimo que NO se debe tocar */
const LEGITIMO = [
  "const token = jwt.sign({ id: user.id }, SECRETO, { expiresIn: '1h' });",
  "auth: true,",
  "max_tokens: 4096,",
  'author: "Equipo",',
  "def conectar(usuario, password=None):",
  "password = input()",
  "const tokens = texto.split(' ');",
  "const password = process.env.DB_PASSWORD;",
  'token_url: "https://auth.example.com/oauth/token",',
  'secret_key = os.environ["SECRET_KEY"]',
  "if (password === confirmPassword) {",
  'const secretName = "my_secret_key_value_name";',
  'token_type: "bearer_token_v2_default",',
  "conexion = connect(host=h, password=pw, timeout=3)",
  "headers.Authorization = `Bearer ${token}`;",
  'const passwordInput = document.getElementById("password-input-field");',
  "const apiKey = config.apiKey ?? getApiKeyFromVault();",
  'message: "Token expirado, vuelve a iniciar sesión por favor",',
  "password_hash = bcrypt.hashpw(pw.encode(), bcrypt.gensalt())",
  'ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")',
];

describe("N4-03 — redacción por valor", () => {
  test("20 secretos realistas: ninguno llega al modelo", () => {
    assert.equal(SECRETOS.length, 20);
    for (const [linea, secreto] of SECRETOS) {
      const r = redactarFormatos(linea);
      assert.ok(!r.includes(secreto), `llega: ${linea}  =>  ${r}`);
      assert.match(r, /\[REDACTADO/, linea);
    }
  });

  test("20 líneas de código legítimo: no se altera ninguna", () => {
    assert.equal(LEGITIMO.length, 20);
    for (const linea of LEGITIMO) assert.equal(redactarFormatos(linea), linea);
  });

  test("lo mismo por leer_archivo y buscar: se redacta el valor y se conserva el nombre", async () => {
    const e = entorno();
    e.poner("src/config.js", SECRETOS.map(([l]) => l).join("\n") + "\n");
    const leido = (await e.usar("leer_archivo", { ruta: "src/config.js" })).texto;
    for (const [, secreto] of SECRETOS) assert.ok(!leido.includes(secreto), secreto);
    assert.match(leido, /const password = "\[REDACTADO\]"/);
    const hallado = (await e.usar("buscar", { texto: "password" })).texto;
    assert.ok(!hallado.includes("Zq8!kLm2#xP9vR"));
  });

  test("una edición buscar/reemplazar basada en un fragmento legítimo sigue funcionando", async () => {
    const e = entorno();
    e.poner("src/auth.js", [
      "const token = jwt.sign({ id: user.id }, SECRETO, { expiresIn: '1h' });",
      'const password = "Zq8!kLm2#xP9vR";',
      "function salir() { return token; }",
      "",
    ].join("\n"));
    const leido = (await e.usar("leer_archivo", { ruta: "src/auth.js" })).texto;
    assert.match(leido, /const token = jwt\.sign\(\{ id: user\.id \}, SECRETO, \{ expiresIn: '1h' \}\);/, "el código legítimo llega tal cual");
    const r = await e.usar("editar", {
      ruta: "src/auth.js",
      buscar: "const token = jwt.sign({ id: user.id }, SECRETO, { expiresIn: '1h' });",
      reemplazar: "const token = jwt.sign({ id: user.id }, SECRETO, { expiresIn: '2h' });",
    });
    assert.equal(r.error, false, r.texto);
    const final = readFileSync(join(e.dir, "src/auth.js"), "utf8");
    assert.match(final, /expiresIn: '2h'/);
    assert.match(final, /Zq8!kLm2#xP9vR/, "lo que no se editó queda intacto");
  });

  test("cifra de la revisión: de los 24 secretos de d-secretos.mjs, los que pasan", () => {
    // Las 17 líneas que la revisión dio por no cubiertas, con los mismos nombres de variable y formas
    const reportadas = [
      'const password = "Zq8!kLm2#xP9vR"', 'apiKey: "7f3a9c2e1b8d4f6a0c5e7b9d1a3f5c7e"', "client_secret = 'Tq9#mLp2$vX8zKw4'",
      "host=db.interno port=5432 user=app password=Zq8kLm2xP9", "Server=db;Database=ventas;Uid=sa;Pwd=Zq8!kLm2;",
      '"dbPass": "Zq8!kLm2#xP9vR"', '"client_secret": "GOCSPX-aBcD3fGhIjKlMnOpQrStUvWx"',
      'TOKEN = "xapp-1-A0123456789-1234567890-abcdef0123456789abcdef"', "export DB_PASSWORD=Zq8!kLm2#xP9vR",
      'authToken = "Zq8kLm2xP9vRtY7u"', 'const dbPassword = "Zq8!kLm2#xP9vR"', "token = 0123456789abcdef0123456789abcdef01234567",
      "Authorization: Basic dXNlcjpwYXNzd29yZDEyMw==", "redis://:Zq8kLm2xP9@cache:6379",
      '"password": "Zq8!kLm2#xP9vR"', "secret = 'Zq8!kLm2#xP9vR'", 'api_key="aB3dE5gH7jK9mN1pQ3sT"',
    ];
    const pasan = reportadas.filter((l) => redactarFormatos(l) === l);
    assert.equal(reportadas.length, 17);
    assert.deepEqual(pasan, [], "ninguna de las 17 que pasaban vuelve a pasar");
  });
});

// ── N4-04 ───────────────────────────────────────────────────────────────────────
const CUERPO = Array.from({ length: 20 }, (_, i) => `MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC${String(i).padStart(2, "0")}aBcDeFgHiJkLmNoPqRsTuVwXyZ`);

describe("N4-04 — el cuerpo de una clave privada no llega al modelo", () => {
  const completo = ["// claves", "const x = 1;", "-----BEGIN PRIVATE KEY-----", ...CUERPO, "-----END PRIVATE KEY-----", "const y = 2;", ""].join("\n");

  test("lectura por tramo dentro del bloque", async () => {
    const e = entorno();
    e.poner("llave.js", completo);
    const r = await e.usar("leer_archivo", { ruta: "llave.js", desde: 5, hasta: 8 });
    assert.equal(r.error, false);
    assert.ok(!/MIIEvQIBADAN/.test(r.texto), r.texto);
    assert.match(r.texto, /REDACTADO: clave privada/);
    // el resto del archivo sigue visible
    const resto = await e.usar("leer_archivo", { ruta: "llave.js", desde: 24 });
    assert.match(resto.texto, /const y = 2;/);
  });

  test("bloque sin END: se oculta el cuerpo y no se come el código siguiente", async () => {
    const e = entorno();
    e.poner("llave.js", ["const a = 1;", "-----BEGIN RSA PRIVATE KEY-----", ...CUERPO.slice(0, 5), "", "function importante() {}", ""].join("\n"));
    const r = await e.usar("leer_archivo", { ruta: "llave.js", desde: 3, hasta: 7 });
    assert.ok(!/MIIEvQIBADAN/.test(r.texto), r.texto);
    const todo = await e.usar("leer_archivo", { ruta: "llave.js" });
    assert.ok(!/MIIEvQIBADAN/.test(todo.texto));
    assert.match(todo.texto, /function importante\(\) \{\}/);
  });

  test("buscar por una línea del cuerpo no la devuelve", async () => {
    const e = entorno();
    e.poner("llave.js", completo);
    e.poner("otro.js", `const copia = "${CUERPO[3]}";\n`);
    const r = await e.usar("buscar", { texto: "MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC03" });
    assert.ok(!r.texto.includes("llave.js:"), r.texto);
    const normal = await e.usar("buscar", { texto: "const y = 2;" });
    assert.match(normal.texto, /llave\.js:\d+: const y = 2;/);
  });

  test("clave cifrada con cabeceras Proc-Type/DEK-Info", async () => {
    const e = entorno();
    e.poner("k.pem", ["-----BEGIN RSA PRIVATE KEY-----", "Proc-Type: 4,ENCRYPTED", "DEK-Info: AES-128-CBC,0123456789ABCDEF", "", ...CUERPO.slice(0, 3), "-----END RSA PRIVATE KEY-----", ""].join("\n"));
    const r = await e.usar("leer_archivo", { ruta: "k.pem", desde: 4, hasta: 7 });
    assert.ok(!/MIIEvQIBADAN/.test(r.texto), r.texto);
  });
});

// ── N4-05 ───────────────────────────────────────────────────────────────────────
describe("N4-05 — BOM", () => {
  test("editar conserva el BOM y estadoDeEscritura predice la huella real", async () => {
    const e = entorno();
    const original = "﻿const a = 1;\nconst b = 2;\n";
    e.poner("bom.js", original);
    const entrada = { ruta: "bom.js", buscar: "const b = 2;", reemplazar: "const b = 3;" };
    const previo = e.h.estadoDeEscritura("editar", entrada);
    const r = await e.usar("editar", entrada);
    assert.equal(r.error, false, r.texto);
    const bytes = readFileSync(join(e.dir, "bom.js"));
    assert.deepEqual([...bytes.subarray(0, 3)], [0xEF, 0xBB, 0xBF], "el BOM sigue ahí");
    assert.equal(sha(bytes), previo?.despues, "lo predicho es lo escrito (si no, tras un corte se informaría «no se sabe»)");
  });

  test("reemplazar el archivo entero con contenido sin BOM lo conserva, y se predice igual", async () => {
    const e = entorno();
    e.poner("bom.js", "﻿viejo\n");
    const entrada = { ruta: "bom.js", contenido: "nuevo\n" };
    const previo = e.h.estadoDeEscritura("editar", entrada);
    assert.equal((await e.usar("editar", entrada)).error, false);
    const bytes = readFileSync(join(e.dir, "bom.js"));
    assert.deepEqual([...bytes.subarray(0, 3)], [0xEF, 0xBB, 0xBF]);
    assert.equal(sha(bytes), previo?.despues);
  });

  test("un archivo sin BOM no gana uno", async () => {
    const e = entorno();
    e.poner("a.js", "x\n");
    await e.usar("editar", { ruta: "a.js", contenido: "y\n" });
    assert.equal(readFileSync(join(e.dir, "a.js"), "utf8"), "y\n");
  });
});

// ── N4-07 ───────────────────────────────────────────────────────────────────────
describe("N4-07 — temporales huérfanos", () => {
  test("barre solo los propios, de nombre exacto, de más de una hora y del mismo directorio", () => {
    const dir = mkdtempSync(join(tmpdir(), "forge-tmp-"));
    mkdirSync(join(dir, "sub"));
    const viejo = new Date(Date.now() - EDAD_TEMPORAL_HUERFANO_MS - 5 * 60 * 1000);
    const caso = (nombre, antiguo) => {
      writeFileSync(join(dir, nombre), "resto");
      if (antiguo) utimesSync(join(dir, nombre), viejo, viejo);
    };
    caso("a.txt", false);
    caso("a.txt.forge-tmp-4242-deadbeef", true);          // huérfano: se barre
    caso("b.md.forge-tmp-77-0123abcd", true);             // huérfano de otro archivo, mismo directorio: se barre
    caso("a.txt.forge-tmp-4242-cafebabe", false);         // reciente: puede ser de otro proceso vivo
    caso("a.txt.forge-tmp-x-deadbeef", true);             // nombre no exacto
    caso("a.txt.forge-tmp-1-deadbeef.bak", true);         // nombre no exacto
    caso("notas.tmp", true);
    writeFileSync(join(dir, "sub", "c.txt.forge-tmp-1-deadbeef"), "otro directorio");
    utimesSync(join(dir, "sub", "c.txt.forge-tmp-1-deadbeef"), viejo, viejo);

    escribirArchivo(dir, join(dir, "a.txt"), "nuevo");

    const quedan = readdirSync(dir).sort();
    assert.deepEqual(quedan, ["a.txt", "a.txt.forge-tmp-1-deadbeef.bak", "a.txt.forge-tmp-4242-cafebabe", "a.txt.forge-tmp-x-deadbeef", "notas.tmp", "sub"]);
    assert.equal(readFileSync(join(dir, "a.txt"), "utf8"), "nuevo");
    assert.ok(existsSync(join(dir, "sub", "c.txt.forge-tmp-1-deadbeef")), "no toca otros directorios");
    rmSync(dir, { recursive: true, force: true });
  });
});

// ── N4-08 ───────────────────────────────────────────────────────────────────────
function union(destino, enlace) {
  try { symlinkSync(destino, enlace, "junction"); return true; } catch { return false; }
}

describe("N4-08 — import/export no escriben a través de enlaces", () => {
  const silencio = async (fn) => {
    const log = console.log; const warn = console.warn;
    console.log = () => {}; console.warn = () => {};
    try { return await fn(); } finally { console.log = log; console.warn = warn; }
  };
  const openspec = JSON.stringify({ openspec_version: "1.0", product: { name: "X", type: "other", tagline: "", value_proposition: "", target_users: "" } });

  test("import: .sdd es una unión hacia fuera: no escribe fuera y falla", async (t) => {
    const base = mkdtempSync(join(tmpdir(), "forge-imp-"));
    const cwd = join(base, "proy"); const fuera = join(base, "fuera");
    mkdirSync(cwd); mkdirSync(fuera);
    writeFileSync(join(base, "spec.json"), openspec);
    if (!union(fuera, join(cwd, ".sdd"))) return t.skip("este sistema no permite crear uniones de directorio");
    await assert.rejects(silencio(() => cmdImport(["--from=openspec", `--file=${join(base, "spec.json")}`], cwd)), /enlace|unión|fuera/i);
    assert.deepEqual(readdirSync(fuera), []);
  });

  test("import: .sdd/ir.json es un enlace colgante (unión a una carpeta borrada): no escribe", async (t) => {
    const base = mkdtempSync(join(tmpdir(), "forge-imp-"));
    const cwd = join(base, "proy"); const hueco = join(base, "hueco");
    mkdirSync(cwd); mkdirSync(hueco);
    writeFileSync(join(base, "spec.json"), openspec);
    if (!union(hueco, join(cwd, ".sdd"))) return t.skip("este sistema no permite crear uniones de directorio");
    rmSync(hueco, { recursive: true });
    await assert.rejects(silencio(() => cmdImport(["--from=openspec", `--file=${join(base, "spec.json")}`], cwd)), /enlace|unión|fuera|no existe/i);
    assert.ok(!existsSync(hueco), "no recreó el destino del enlace");
  });

  test("import normal: escribe .sdd/ir.json y estado.json dentro del proyecto", async () => {
    const base = mkdtempSync(join(tmpdir(), "forge-imp-"));
    const cwd = join(base, "proy");
    mkdirSync(cwd);
    writeFileSync(join(base, "spec.json"), openspec);
    await silencio(() => cmdImport(["--from=openspec", `--file=${join(base, "spec.json")}`], cwd));
    assert.ok(existsSync(join(cwd, ".sdd", "ir.json")));
    assert.ok(existsSync(join(cwd, ".sdd", "estado.json")));
  });

  test("export: la carpeta de salida dentro del proyecto es una unión hacia fuera: no escribe fuera", async (t) => {
    const base = mkdtempSync(join(tmpdir(), "forge-exp-"));
    const cwd = join(base, "proy"); const fuera = join(base, "fuera");
    mkdirSync(cwd); mkdirSync(fuera);
    if (!union(fuera, join(cwd, "salida"))) return t.skip("este sistema no permite crear uniones de directorio");
    await assert.rejects(silencio(() => cmdExport(["--format=openspec", "--out=salida"], cwd)), /enlace|unión|fuera/i);
    assert.deepEqual(readdirSync(fuera), []);
  });

  test("export normal: escribe openspec.json en la carpeta pedida", async () => {
    const base = mkdtempSync(join(tmpdir(), "forge-exp-"));
    const cwd = join(base, "proy");
    mkdirSync(cwd);
    await silencio(() => cmdExport(["--format=openspec", "--out=salida"], cwd));
    assert.ok(existsSync(join(cwd, "salida", "openspec.json")));
  });
});

describe("N4-08 — estática: cli/ no escribe archivos directamente", () => {
  // Lista explícita de los módulos de cli/ que pueden escribir sin `escritura-segura`: ninguno
  const PERMITIDOS = /** @type {string[]} */ ([]);
  const PROHIBIDO = /\b(writeFileSync|appendFileSync|copyFileSync|renameSync|cpSync)\b/;

  test("ningún módulo de cli/ usa writeFileSync, appendFileSync, copyFileSync, renameSync ni cpSync", () => {
    const carpeta = join(RAIZ, "cli");
    const infractores = [];
    for (const nombre of readdirSync(carpeta).filter((n) => n.endsWith(".js"))) {
      if (PERMITIDOS.includes(nombre)) continue;
      const sinComentarios = readFileSync(join(carpeta, nombre), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
      if (PROHIBIDO.test(sinComentarios)) infractores.push(nombre);
    }
    assert.deepEqual(infractores, [], "escribe directo: usa core/escritura-segura.js");
  });

  test("la lista de permitidos es pequeña y existe", () => {
    assert.ok(PERMITIDOS.length <= 2);
    for (const n of PERMITIDOS) assert.ok(existsSync(join(RAIZ, "cli", n)));
  });
});

// ── N4-09 ───────────────────────────────────────────────────────────────────────
describe("N4-09 — el literal [REDACTADO en un archivo que ya lo tiene", () => {
  test("se puede editar una línea que contiene el marcador", async () => {
    const e = entorno();
    e.poner("redactor.js", 'const marca = "[REDACTADO]";\nconst otra = 1;\n');
    const r = await e.usar("editar", { ruta: "redactor.js", buscar: 'const marca = "[REDACTADO]";', reemplazar: 'const marca = "[REDACTADO: valor]";' });
    assert.equal(r.error, false, r.texto);
    assert.match(readFileSync(join(e.dir, "redactor.js"), "utf8"), /\[REDACTADO: valor\]/);
  });

  test("sigue rechazando el marcador que el archivo no tiene", async () => {
    const e = entorno();
    e.poner("c.js", 'const clave = "Zq8!kLm2#xP9vR";\n');
    const antes = readFileSync(join(e.dir, "c.js"), "utf8");
    for (const entrada of [
      { ruta: "c.js", buscar: 'const clave = "[REDACTADO]";', reemplazar: "const clave = 1;" },
      { ruta: "c.js", buscar: "const clave", reemplazar: 'const clave = "[REDACTADO]"; //' },
      { ruta: "c.js", contenido: 'const clave = "[REDACTADO]";\n' },
      { ruta: "nuevo.js", contenido: 'x = "[REDACTADO]"\n' },
    ]) {
      const r = await e.usar("editar", entrada);
      assert.equal(r.error, true);
      assert.match(r.texto, /REDACTADO/);
    }
    assert.equal(readFileSync(join(e.dir, "c.js"), "utf8"), antes);
  });

  test("no se añaden marcadores nuevos aunque el archivo ya tenga uno", async () => {
    const e = entorno();
    e.poner("r.js", 'const m = "[REDACTADO]";\nconst z = 0;\n');
    const r = await e.usar("editar", { ruta: "r.js", buscar: "const z = 0;", reemplazar: 'const z = "[REDACTADO]";' });
    assert.equal(r.error, true);
  });
});
