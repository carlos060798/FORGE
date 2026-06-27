// @ts-check
/**
 * Tests para ast-indexer.js y ast-query.js
 *
 * Verifica:
 *  1. Indexa exports de funciones correctamente
 *  2. Indexa imports con nombres nombrados
 *  3. Excluye node_modules y directorios excluidos
 *  4. ast-query filtra por tipo correctamente
 *  5. ast-query busca por término en nombre/archivo
 *  6. Archivos con sintaxis no soportada se omiten sin crashear
 *  7. limpiarTypeScript() — 10 casos avanzados de limpieza TS/JSX
 */

import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { limpiarTypeScript } from "../claude-hooks/ast-indexer.js";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const INDEXER = join(__dirname, "..", "claude-hooks", "ast-indexer.js");
const QUERY = join(__dirname, "..", "claude-hooks", "ast-query.js");

function runIndexer(args = [], cwd) {
  return spawnSync(process.execPath, [INDEXER, ...args], { cwd, encoding: "utf8" });
}

function runQuery(args = [], cwd) {
  return spawnSync(process.execPath, [QUERY, ...args], { cwd, encoding: "utf8" });
}

function cargarIndice(cwd) {
  const f = join(cwd, ".sdd", "arquitectura", "ast-index.jsonl");
  if (!existsSync(f)) return [];
  return readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

describe("ast-indexer — indexación de símbolos JS", () => {
  /** @type {string} */
  let tmpDir;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "forge-ast-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("indexa función exportada con firma correcta", () => {
    writeFileSync(
      join(tmpDir, "auth.js"),
      `export async function login(email, password) { return true; }\n`
    );
    const r = runIndexer(["auth.js"], tmpDir);
    assert.strictEqual(r.status, 0, `indexer falló: ${r.stderr}`);

    const simbolos = cargarIndice(tmpDir);
    const exportLogin = simbolos.find((s) => s.tipo === "export" && s.nombre === "login");
    assert.ok(exportLogin, "debe indexar el export 'login'");
    assert.ok(exportLogin.firma.includes("login"), "la firma debe incluir el nombre");
    assert.strictEqual(exportLogin.linea, 1, "debe registrar la línea correcta");
  });

  test("indexa import con nombres nombrados", () => {
    writeFileSync(
      join(tmpDir, "service.js"),
      `import { query, pool } from './db.js';\nexport function getUser(id) { return query(id); }\n`
    );
    const r = runIndexer(["service.js"], tmpDir);
    assert.strictEqual(r.status, 0, `indexer falló: ${r.stderr}`);

    const simbolos = cargarIndice(tmpDir);
    const imp = simbolos.find((s) => s.tipo === "import" && s.de === "./db.js");
    assert.ok(imp, "debe indexar el import de ./db.js");
    assert.ok(imp.nombres.includes("query"), "debe incluir 'query' en los nombres importados");
    assert.ok(imp.nombres.includes("pool"), "debe incluir 'pool' en los nombres importados");
  });

  test("excluye archivos en node_modules", () => {
    // Crear estructura con node_modules
    mkdirSync(join(tmpDir, "node_modules", "lodash"), { recursive: true });
    writeFileSync(
      join(tmpDir, "node_modules", "lodash", "index.js"),
      `export function cloneDeep(obj) { return obj; }\n`
    );
    writeFileSync(
      join(tmpDir, "index.js"),
      `export const app = 1;\n`
    );

    runIndexer([], tmpDir);
    const simbolos = cargarIndice(tmpDir);

    const enNodeModules = simbolos.some((s) => s.archivo.includes("node_modules"));
    assert.ok(!enNodeModules, "no debe indexar archivos en node_modules");
    const appSimbolo = simbolos.find((s) => s.nombre === "app");
    assert.ok(appSimbolo, "sí debe indexar archivos del proyecto");
  });

  test("archivos con sintaxis no soportada se omiten sin crashear", () => {
    writeFileSync(join(tmpDir, "valido.js"), `export const x = 1;\n`);
    // Sintaxis inválida en JS
    writeFileSync(join(tmpDir, "invalido.js"), `esto no es javascript válido ???\n`);

    const r = runIndexer([], tmpDir);
    assert.strictEqual(r.status, 0, "el indexer no debe crashear con archivos inválidos");
    assert.ok(r.stdout.includes("indexados"), "debe reportar archivos indexados");

    const simbolos = cargarIndice(tmpDir);
    const xSimbolo = simbolos.find((s) => s.nombre === "x");
    assert.ok(xSimbolo, "debe indexar el archivo válido a pesar del inválido");
  });
});

describe("ast-query — consulta del índice", () => {
  /** @type {string} */
  let tmpDir;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "forge-ast-query-"));
    // Crear un proyecto con varios archivos
    writeFileSync(
      join(tmpDir, "auth.js"),
      `import { hash } from './crypto.js';\nexport async function login(user, pass) {}\nexport function logout() {}\n`
    );
    writeFileSync(
      join(tmpDir, "db.js"),
      `export function query(sql, params) {}\nexport const pool = null;\n`
    );
    writeFileSync(
      join(tmpDir, "crypto.js"),
      `export function hash(input) {}\n`
    );
    runIndexer([], tmpDir);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("filtra exports de un archivo específico", () => {
    const r = runQuery(["--archivo", "auth.js", "--tipo", "exports"], tmpDir);
    assert.strictEqual(r.status, 0, `query falló: ${r.stderr}`);
    assert.ok(r.stdout.includes("login"), "debe incluir 'login'");
    assert.ok(r.stdout.includes("logout"), "debe incluir 'logout'");
    assert.ok(!r.stdout.includes("query"), "no debe incluir símbolos de db.js");
  });

  test("busca por término en nombre de símbolo", () => {
    const r = runQuery(["--buscar", "hash"], tmpDir);
    assert.strictEqual(r.status, 0, `query falló: ${r.stderr}`);
    assert.ok(r.stdout.includes("hash"), "debe encontrar la función 'hash'");
  });

  test("--stats devuelve contadores sin error", () => {
    const r = runQuery(["--stats"], tmpDir);
    assert.strictEqual(r.status, 0, `stats falló: ${r.stderr}`);
    assert.ok(r.stdout.includes("Símbolos totales"), "debe mostrar total de símbolos");
    assert.ok(r.stdout.includes("Archivos indexados"), "debe mostrar archivos indexados");
  });

  test("sin índice devuelve mensaje útil con exit 0", () => {
    // Directorio sin índice
    const sinIndice = mkdtempSync(join(tmpdir(), "forge-noindex-"));
    try {
      const r = runQuery(["--buscar", "foo"], sinIndice);
      assert.strictEqual(r.status, 0, "debe salir con código 0 aunque no haya índice");
      assert.ok(r.stderr.includes("ast-indexer"), "debe sugerir ejecutar ast-indexer");
    } finally {
      rmSync(sinIndice, { recursive: true, force: true });
    }
  });
});

describe("limpiarTypeScript() — limpieza de sintaxis TS/JSX", () => {
  // Caso 1: decoradores de clase
  test("elimina decorador de clase con argumentos", () => {
    const entrada = `@Component({ selector: 'app' })\nclass AppComponent {}`;
    const resultado = limpiarTypeScript(entrada);
    assert.ok(!resultado.includes("@Component"), "debe eliminar el decorador @Component");
    assert.ok(resultado.includes("class AppComponent"), "debe conservar la declaración de clase");
  });

  // Caso 2: modificadores de constructor
  test("elimina modificadores private/public/protected en parámetros de constructor", () => {
    const entrada = `constructor(private name: string, public age: number) {}`;
    const resultado = limpiarTypeScript(entrada);
    assert.ok(!resultado.includes("private"), "debe eliminar 'private'");
    assert.ok(!resultado.includes("public"), "debe eliminar 'public'");
    assert.ok(resultado.includes("name"), "debe conservar el nombre del parámetro");
    assert.ok(resultado.includes("age"), "debe conservar el nombre del parámetro age");
  });

  // Caso 3: satisfies operator
  test("elimina el operador satisfies", () => {
    const entrada = `const x = {} satisfies Config`;
    const resultado = limpiarTypeScript(entrada);
    assert.ok(!resultado.includes("satisfies"), "debe eliminar 'satisfies'");
    assert.ok(!resultado.includes("Config"), "debe eliminar el tipo después de satisfies");
    assert.ok(resultado.includes("const x = {}"), "debe conservar la asignación");
  });

  // Caso 4: JSX básico
  test("convierte JSX básico en null /* JSX */", () => {
    const entrada = `return <Button onClick={fn} />`;
    const resultado = limpiarTypeScript(entrada);
    assert.ok(!resultado.includes("<Button"), "debe eliminar la etiqueta JSX <Button");
    assert.ok(resultado.includes("null /* JSX */"), "debe reemplazar JSX por null /* JSX */");
  });

  // Caso 5: genéricos anidados
  // La función elimina genéricos planos en una pasada; los anidados quedan parcialmente limpios.
  // Lo importante es que el genérico interno <number> desaparezca y el identificador Map se conserve.
  test("elimina el genérico interno y conserva el identificador en genéricos anidados", () => {
    const entrada = `const m: Map<string, Array<number>> = new Map();`;
    const resultado = limpiarTypeScript(entrada);
    assert.ok(!resultado.includes("<number>"), "debe eliminar el genérico interno <number>");
    assert.ok(resultado.includes("Map"), "debe conservar el identificador Map");
  });

  // Caso 6: union types en parámetros
  test("elimina union types en parámetros de función", () => {
    const entrada = `function f(x: string | number) {}`;
    const resultado = limpiarTypeScript(entrada);
    assert.ok(!resultado.includes(": string"), "debe eliminar la anotación de tipo string");
    assert.ok(!resultado.includes("| number"), "debe eliminar el union type number");
    assert.ok(resultado.includes("(x)"), "debe conservar el parámetro x sin tipo");
  });

  // Caso 7: declare statements
  test("elimina declare statements", () => {
    const entrada = `declare module 'foo' {}\ndeclare const bar: string;\nexport const ok = 1;`;
    const resultado = limpiarTypeScript(entrada);
    assert.ok(!resultado.includes("declare"), "debe eliminar todos los 'declare'");
    assert.ok(resultado.includes("export const ok"), "debe conservar el export normal");
  });

  // Caso 8: tipos de retorno de función
  test("elimina el tipo de retorno de función", () => {
    const entrada = `function f(): Promise<void> {`;
    const resultado = limpiarTypeScript(entrada);
    assert.ok(!resultado.includes(": Promise"), "debe eliminar el tipo de retorno");
    assert.ok(resultado.includes("function f()"), "debe conservar la firma de la función");
    assert.ok(resultado.includes("{"), "debe conservar la llave de apertura");
  });

  // Caso 9: as cast encadenado
  test("elimina as casts incluyendo cadenas como 'as unknown as string'", () => {
    const entrada = `const v = value as unknown as string;`;
    const resultado = limpiarTypeScript(entrada);
    assert.ok(!resultado.includes(" as "), "debe eliminar todos los casts 'as'");
    assert.ok(resultado.includes("value"), "debe conservar el identificador original");
  });

  // Caso 10: interface multilínea con genéricos
  test("reemplaza interface multilínea con genéricos por /* interface */", () => {
    const entrada = `interface Repo<T> {\n  find(): T\n}`;
    const resultado = limpiarTypeScript(entrada);
    assert.ok(!resultado.includes("interface Repo"), "debe eliminar la declaración de interface");
    assert.ok(resultado.includes("/* interface */"), "debe reemplazar por comentario /* interface */");
  });
});
