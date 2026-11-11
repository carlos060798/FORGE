// @ts-check
/**
 * Spec 2026-11-11-correcciones-de-precision: lo que `export` declara es la versión real del paquete, y el tipo
 * `ForgeEstado` declara todo lo que el esquema público del estado declara.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { cmdExport } from "../cli/export.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VERSION = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;

const sinSalida = async (/** @type {() => Promise<any>} */ fn) => {
  const log = console.log, warn = console.warn;
  console.log = () => {}; console.warn = () => {};
  try { return await fn(); } finally { console.log = log; console.warn = warn; }
};

function proyectoVacio() {
  const cwd = join(mkdtempSync(join(tmpdir(), "fragua-prec-")), "proy");
  mkdirSync(cwd);
  return cwd;
}

describe("export estampa la versión real del paquete", () => {
  test("CA-001-01: openspec.json lleva forge_version igual a la de package.json", async () => {
    const cwd = proyectoVacio();
    await sinSalida(() => cmdExport(["--format=openspec", "--out=salida"], cwd));
    const doc = JSON.parse(readFileSync(join(cwd, "salida", "openspec.json"), "utf8"));
    assert.equal(doc.forge_version, VERSION);
  });

  test("CA-001-02: los Markdown de speckit dicen FORGE v<versión> y nunca v4.0.0", async () => {
    const cwd = proyectoVacio();
    await sinSalida(() => cmdExport(["--format=speckit", "--out=salida"], cwd));
    let sellos = 0;
    for (const f of ["spec.md", "plan.md", "tasks.md"]) {
      const ruta = join(cwd, "salida", f);
      if (!existsSync(ruta)) continue;
      const texto = readFileSync(ruta, "utf8");
      assert.doesNotMatch(texto, /v4\.0\.0/, `${f} estampa v4.0.0`);
      if (texto.includes(`FORGE v${VERSION}`)) sellos++;
    }
    assert.ok(sellos >= 1, "ningún Markdown exportado lleva el sello con la versión real");
  });

  test("CA-001-03: import.js no declara una constante de versión sin uso", () => {
    const fuente = readFileSync(join(ROOT, "cli", "import.js"), "utf8");
    assert.doesNotMatch(fuente, /const FORGE_VERSION\s*=/);
  });
});

describe("el tipo ForgeEstado cubre el esquema público del estado", () => {
  test("CA-002-01: toda propiedad de estado-pipeline aparece como @property de ForgeEstado", () => {
    const esquema = JSON.parse(readFileSync(join(ROOT, "docs", "contrato", "estado-pipeline.schema.json"), "utf8"));
    const fuente = readFileSync(join(ROOT, "core", "project-memory.js"), "utf8");
    const bloque = /@typedef \{Object\} ForgeEstado([\s\S]*?)\*\//.exec(fuente)?.[1] ?? "";
    const declaradas = new Set([...bloque.matchAll(/@property \{[^}]+\} \[?(\w+)\]?/g)].map((m) => m[1]));
    const faltan = Object.keys(esquema.properties).filter((p) => !declaradas.has(p));
    assert.deepEqual(faltan, [], `ForgeEstado no declara: ${faltan.join(", ")}`);
  });
});
