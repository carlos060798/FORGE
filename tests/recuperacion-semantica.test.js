// @ts-check
/**
 * Memoria semántica (S3): embedders, índice de vectores y recuperador semántico.
 * El embedder `hash` es léxico (comparte palabras, no significado): aquí se prueba el mecanismo,
 * no una calidad semántica que ese embedder no tiene. Ollama se prueba con un servidor simulado.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, existsSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import { crearEmbedder, embedderHash, embedderOllama, similitud, tokenizar } from "../core/recuperacion/embeddings.js";
import { IndiceVectorial, listarArchivosIndexables, partirEnTrozos } from "../core/recuperacion/indice-vectorial.js";
import { recuperarSemantico } from "../core/recuperacion/recuperador-semantico.js";
import { crearRecuperador } from "../core/recuperacion/recuperador.js";

const tmp = () => mkdtempSync(join(tmpdir(), "forge-sem-"));
const escribir = (dir, ruta, contenido) => { mkdirSync(dirname(join(dir, ruta)), { recursive: true }); writeFileSync(join(dir, ruta), contenido); };

/** Proyecto pequeño con temas distintos. */
function proyecto() {
  const dir = tmp();
  escribir(dir, "src/pagos.js", "// Cobros con tarjeta\nexport function cobrarTarjeta(importe, tarjeta) {\n  return pasarela.cobrar(importe, tarjeta);\n}\nexport function reembolsarPago(idPago) { return pasarela.reembolsar(idPago); }\n");
  escribir(dir, "src/usuarios.js", "export function crearUsuario(nombre, correo) {\n  return baseDatos.insertar('usuarios', { nombre, correo });\n}\nexport function borrarUsuario(id) { return baseDatos.borrar('usuarios', id); }\n");
  escribir(dir, "src/colores.css", ".boton { color: red; background: blue; }\n.tarjeta { border: 1px solid; }\n");
  escribir(dir, "README.md", "# Demo\nAplicación de ejemplo con pagos y usuarios.\n");
  return dir;
}

describe("embeddings", () => {
  test("tokenizar separa camelCase y snake_case", () => {
    assert.deepEqual(tokenizar("getUserName y get_user_name"), ["get", "user", "name", "get", "user", "name"]);
    assert.deepEqual(tokenizar("HTTPServer parse"), ["http", "server", "parse"]);
  });

  test("hash: vectores normalizados, deterministas y más parecidos cuando comparten palabras", async () => {
    const e = embedderHash();
    const [a, b, c] = await e.embed(["cobrar pago con tarjeta", "cobrarTarjeta pago", "borrar usuario de la base de datos"]);
    const [a2] = await e.embed(["cobrar pago con tarjeta"]);
    assert.deepEqual(a, a2);
    assert.ok(Math.abs(Math.sqrt(a.reduce((s, x) => s + x * x, 0)) - 1) < 1e-9);
    assert.ok(similitud(a, b) > similitud(a, c) + 0.1, `${similitud(a, b)} vs ${similitud(a, c)}`);
    assert.equal(e.nombre, "hash");
  });

  test("un texto sin palabras da un vector nulo sin fallar", async () => {
    const [v] = await embedderHash().embed(["!!! ... ---"]);
    assert.ok(v.every((x) => x === 0));
  });

  test("crearEmbedder: desconocido es un error claro", () => {
    assert.throws(() => crearEmbedder("magia"), /Embedder desconocido/);
  });

  test("ollama: manda el modelo y el texto a /api/embeddings y normaliza el vector", async () => {
    const llamadas = [];
    const fetchFalso = async (url, init) => { llamadas.push({ url, cuerpo: JSON.parse(init.body) }); return { ok: true, status: 200, json: async () => ({ embedding: [3, 4] }) }; };
    const e = embedderOllama({ host: "http://127.0.0.1:9999/", modelo: "m1", fetch: /** @type {any} */ (fetchFalso) });
    const [v] = await e.embed(["hola"]);
    assert.deepEqual(llamadas, [{ url: "http://127.0.0.1:9999/api/embeddings", cuerpo: { model: "m1", prompt: "hola" } }]);
    assert.deepEqual(v.map((x) => Math.round(x * 10) / 10), [0.6, 0.8]);
    assert.equal(e.nombre, "ollama:m1");
  });

  test("ollama: errores claros si no responde, devuelve un código de error o un vector inválido", async () => {
    const mk = (f) => embedderOllama({ fetch: /** @type {any} */ (f) });
    await assert.rejects(mk(async () => { throw new Error("ECONNREFUSED"); }).embed(["x"]), /Ollama no responde/);
    await assert.rejects(mk(async () => ({ ok: false, status: 404, json: async () => ({}) })).embed(["x"]), /404.*descargado/);
    await assert.rejects(mk(async () => ({ ok: true, status: 200, json: async () => ({ embedding: ["a"] }) })).embed(["x"]), /vector válido/);
    await assert.rejects(mk(async () => ({ ok: true, status: 200, json: async () => ({}) })).embed(["x"]), /vector válido/);
  });
});

describe("índice vectorial", () => {
  test("lista solo texto del proyecto: sin carpetas vetadas, secretos, binarios, enormes ni enlaces", (t) => {
    const dir = proyecto();
    escribir(dir, "node_modules/lib/index.js", "export const x = 1;");
    escribir(dir, ".git/config", "[core]");
    escribir(dir, ".env", "TOKEN=secreto");
    escribir(dir, "config.env", "A=1");
    escribir(dir, "src/imagen.png", "no es texto");
    escribir(dir, "src/grande.js", "x".repeat(300 * 1024));
    escribir(dir, "package-lock.json", "{}");
    escribir(dir, "dist/salida.js", "export const y = 2;");
    const fuera = tmp(); escribir(fuera, "secreto.js", "export const SECRETO_AJENO = 1;");
    let enlace = true;
    try { symlinkSync(fuera, join(dir, "enlace"), "junction"); } catch { enlace = false; }
    const rutas = listarArchivosIndexables(dir).map((a) => a.ruta).sort();
    assert.deepEqual(rutas, ["README.md", "src/colores.css", "src/pagos.js", "src/usuarios.js"]);
    if (!enlace) t.diagnostic("sin enlaces: no se probó el salto de enlaces");
  });

  test("partirEnTrozos solapa y cubre todo el archivo", () => {
    const texto = Array.from({ length: 100 }, (_, i) => "linea " + (i + 1)).join("\n");
    const trozos = partirEnTrozos(texto);
    assert.equal(trozos[0].ini, 1);
    assert.equal(trozos[trozos.length - 1].fin, 100);
    assert.ok(trozos.every((t) => t.fin - t.ini + 1 <= 40));
    assert.deepEqual(partirEnTrozos("\n\n  \n"), []);
  });

  test("actualizar es incremental y buscar encuentra el archivo del tema", async () => {
    const dir = proyecto();
    const indice = new IndiceVectorial({ cwd: dir, embedder: embedderHash() });
    const r1 = await indice.actualizar();
    assert.deepEqual([r1.archivos, r1.reindexados], [4, 4]);
    assert.ok(existsSync(join(dir, ".sdd", "indice", "hash.json")));

    const otro = new IndiceVectorial({ cwd: dir, embedder: embedderHash() });   // carga el índice guardado
    assert.equal((await otro.actualizar()).reindexados, 0);

    const hallados = await otro.buscar("cobrar un pago con tarjeta y reembolsar", { k: 2 });
    assert.equal(hallados[0].ruta, "src/pagos.js");
    assert.match(hallados[0].texto, /cobrarTarjeta/);

    // Un archivo modificado se vuelve a vectorizar; uno borrado sale del índice
    escribir(dir, "src/usuarios.js", "export const cambiado = true;\n");
    utimesSync(join(dir, "src/usuarios.js"), new Date(), new Date(Date.now() + 5000));
    assert.equal((await otro.actualizar()).reindexados, 1);
    const { unlinkSync } = await import("node:fs");
    unlinkSync(join(dir, "src/colores.css"));
    assert.equal((await otro.actualizar()).archivos, 3);
  });

  test("un índice de otro embedder o dañado se reconstruye en lugar de usarse", async () => {
    const dir = proyecto();
    await new IndiceVectorial({ cwd: dir, embedder: embedderHash() }).actualizar();
    writeFileSync(join(dir, ".sdd", "indice", "hash.json"), "{corrupto");
    const r = await new IndiceVectorial({ cwd: dir, embedder: embedderHash() }).actualizar();
    assert.equal(r.reindexados, 4);
  });
});

describe("recuperador semántico", () => {
  const entrada = (dir, extra = {}) => ({
    cwd: dir, maxBytes: 20_000,
    tarea: { descripcion: "Añadir reembolso de un pago con tarjeta", archivos: ["src/usuarios.js"] },
    plan: { pasos: ["revisar cobrarTarjeta"], archivosObjetivo: [] },
    ...extra,
  });

  test("entrega primero los archivos de la tarea y después los trozos parecidos, sin repetir archivos", async () => {
    const dir = proyecto();
    const r = await recuperarSemantico(entrada(dir));
    assert.deepEqual(r.contexto.fragmentos.map((f) => [f.ruta, f.origen]).slice(0, 2), [["src/usuarios.js", "tarea"], ["src/pagos.js", "semantico"]]);
    assert.match(r.texto, /### src\/pagos\.js:1-\d+ \(semantico, similitud 0\.\d\d\)/);
    assert.equal(r.contexto.fragmentos.filter((f) => f.ruta === "src/usuarios.js").length, 1);
  });

  test("nunca supera el tope de bytes, con cualquier tope", async () => {
    const dir = proyecto();
    for (const maxBytes of [0, 50, 200, 400, 777, 1500, 5000, 20_000]) {
      const r = await recuperarSemantico(entrada(dir, { maxBytes }));
      assert.ok(Buffer.byteLength(r.texto, "utf8") <= maxBytes, `${maxBytes}: ${Buffer.byteLength(r.texto, "utf8")}`);
      assert.ok(r.contexto.bytesTotales <= maxBytes);
    }
  });

  test("no devuelve lo vetado aunque coincida con la consulta", async () => {
    const dir = proyecto();
    escribir(dir, ".env", "PAGO_TARJETA_REEMBOLSO=clave-super-secreta");
    escribir(dir, "secrets/pagos.js", "export const claveTarjetaPago = 'clave-super-secreta';");
    const r = await recuperarSemantico(entrada(dir));
    assert.ok(!r.texto.includes("clave-super-secreta"));
  });

  test("si el embedder falla, entrega el contexto por archivos y lo avisa", async () => {
    const dir = proyecto();
    const roto = { nombre: "roto", embed: async () => { throw new Error("servicio caído"); } };
    const r = await recuperarSemantico(entrada(dir, { embedder: roto }));
    assert.match(String(r.contexto.aviso), /Búsqueda semántica no disponible: servicio caído/);
    assert.deepEqual(r.contexto.fragmentos.map((f) => f.ruta), ["src/usuarios.js"]);
  });

  test("sin descripción de tarea ni plan no busca nada", async () => {
    const dir = proyecto();
    const r = await recuperarSemantico({ cwd: dir, maxBytes: 5000, tarea: { archivos: ["src/pagos.js"] } });
    assert.deepEqual(r.contexto.fragmentos.map((f) => f.origen), ["tarea"]);
  });

  test("está registrado como «semantico» y como «archivos»", () => {
    assert.equal(crearRecuperador("semantico"), recuperarSemantico);
    assert.throws(() => crearRecuperador("vectores"), /Disponibles: archivos, semantico/);
  });
});

describe("configuración", () => {
  test("motor.embeddings desconocido es un error claro al leer la configuración", async () => {
    const { leerConfigCiclo } = await import("../core/ciclo/config.js");
    const dir = tmp();
    escribir(dir, ".sdd/sdd.config.yaml", "motor:\n  recuperador: semantico\n  embeddings: magia\n");
    assert.throws(() => leerConfigCiclo(dir), /motor\.embeddings desconocido: "magia"/);
    escribir(dir, ".sdd/sdd.config.yaml", "motor:\n  recuperador: semantico\n  embeddings: ollama\n  embeddings_modelo: mxbai-embed-large\n");
    const c = leerConfigCiclo(dir);
    assert.deepEqual([c.motor.recuperador, c.motor.embeddings, c.motor.embeddings_modelo], ["semantico", "ollama", "mxbai-embed-large"]);
    assert.equal(leerConfigCiclo(tmp()).motor.embeddings, "hash");
  });
});

describe("un índice manipulado no abre lo vetado", () => {
  test("entradas con rutas fuera del proyecto, vetadas o mal formadas no se devuelven", async () => {
    const base = tmp();
    const dir = join(base, "p");
    mkdirSync(dir);
    escribir(dir, "src/pagos.js", "export function cobrarTarjeta() {}\n");
    escribir(dir, ".env", "CLAVE_TARJETA=super-secreta\n");
    escribir(base, "fuera.txt", "SECRETO_FUERA cobrar tarjeta\n");
    const embedder = embedderHash();
    await new IndiceVectorial({ cwd: dir, embedder }).actualizar();

    // Un tercero reescribe el índice: copia el vector de un trozo legítimo en rutas peligrosas
    const archivo = join(dir, ".sdd", "indice", "hash.json");
    const datos = JSON.parse(readFileSync(archivo, "utf8"));
    const vec = datos.archivos["src/pagos.js"].trozos[0].vec;
    for (const ruta of [".env", "../fuera.txt", "secrets/clave.js", ".git/config"]) datos.archivos[ruta] = { size: 1, mtimeMs: 1, trozos: [{ ini: 1, fin: 1, vec }] };
    datos.archivos["mal.js"] = { size: 1, mtimeMs: 1, trozos: "no es una lista" };
    writeFileSync(archivo, JSON.stringify(datos));

    const indice = new IndiceVectorial({ cwd: dir, embedder });
    assert.ok(!("mal.js" in indice.datos.archivos), "la entrada mal formada se descarta al cargar");
    const hallados = await indice.buscar("cobrar tarjeta", { k: 10, minimo: 0 });
    assert.deepEqual(hallados.map((h) => h.ruta), ["src/pagos.js"]);
    assert.ok(hallados.every((h) => !h.texto.includes("super-secreta") && !h.texto.includes("SECRETO_FUERA")));
  });
});
