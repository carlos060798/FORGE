// @ts-check
/**
 * La referencia de la CLI (docs/referencia-cli.md) y el despacho de cli/index.js dicen lo mismo.
 *
 * Qué verifica (sin ejecutar el CLI, solo leyendo texto):
 *  1. Todo `case "..."` del switch de `main()` en cli/index.js aparece como encabezado de tercer nivel
 *     en docs/referencia-cli.md (en un encabezado puede haber varios nombres en `código`: alias).
 *  2. Todo nombre en `código` de un encabezado de tercer nivel del documento existe en ese switch.
 *  3. El documento lleva su cabecera Diátaxis y la fecha/commit de revisión.
 * `case undefined` (sin argumentos: muestra la ayuda) no es un subcomando y se excluye.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./helpers.js";

const leer = (/** @type {string} */ ruta) => readFileSync(join(ROOT, ruta), "utf8").replace(/\r\n/g, "\n");

/** Etiquetas `case "x":` del switch dentro de `async function main()`. */
function casosDelDespacho() {
  const src = leer("cli/index.js");
  const inicio = src.indexOf("async function main()");
  assert.ok(inicio !== -1, "no se encontró `async function main()` en cli/index.js");
  const cuerpo = src.slice(inicio);
  const sw = cuerpo.indexOf("switch (comando)");
  assert.ok(sw !== -1, "no se encontró `switch (comando)` en main()");
  const nombres = new Set();
  for (const m of cuerpo.slice(sw).matchAll(/^\s{4}case\s+(?:"([^"]+)"|'([^']+)')\s*:/gm)) nombres.add(m[1] ?? m[2]);
  return nombres;
}

/** Nombres en `código` de los encabezados `### ...` de la sección «## Subcomandos» del documento. */
function encabezadosDelDocumento() {
  const doc = leer("docs/referencia-cli.md");
  const ini = doc.search(/^## Subcomandos$/m);
  assert.ok(ini !== -1, "falta la sección «## Subcomandos» en docs/referencia-cli.md");
  const resto = doc.slice(ini + 1);
  const fin = resto.search(/^## /m);
  const seccion = fin === -1 ? resto : resto.slice(0, fin);
  const nombres = new Set();
  for (const linea of seccion.split("\n")) {
    if (!/^### /.test(linea)) continue;
    for (const m of linea.matchAll(/`([^`]+)`/g)) nombres.add(m[1]);
  }
  return nombres;
}

describe("referencia de la CLI frente a cli/index.js", () => {
  const casos = casosDelDespacho();
  const encabezados = encabezadosDelDocumento();

  test("el despacho tiene subcomandos (la extracción funciona)", () => {
    assert.ok(casos.size >= 25, `se extrajeron solo ${casos.size} casos: ${[...casos].join(", ")}`);
    assert.ok(casos.has("init") && casos.has("verificar") && casos.has("run"));
  });

  test("todo subcomando que despacha cli/index.js está documentado", () => {
    const sinDocumentar = [...casos].filter((c) => !encabezados.has(c));
    assert.deepEqual(sinDocumentar, [], `faltan en docs/referencia-cli.md (encabezado «### \`nombre\`»): ${sinDocumentar.join(", ")}`);
  });

  test("todo encabezado de subcomando del documento existe en el despacho", () => {
    const inexistentes = [...encabezados].filter((e) => !casos.has(e));
    assert.deepEqual(inexistentes, [], `documentados pero no despachados por cli/index.js: ${inexistentes.join(", ")}`);
  });

  test("el documento declara su tipo y su revisión", () => {
    const doc = leer("docs/referencia-cli.md");
    assert.match(doc, /^> Tipo: Referencia$/m);
    assert.match(doc, /^> Última revisión: \d{4}-\d{2}-\d{2} contra el commit [0-9a-f]{7,}$/m);
  });
});
