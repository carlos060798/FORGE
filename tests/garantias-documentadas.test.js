// @ts-check
/**
 * Garantías documentadas (spec 2026-10-14-defensa-inyeccion-y-fuga, CA-004-01 a CA-004-04).
 * docs/GARANTIAS-Y-LIMITES.md no puede prometer más de lo que una prueba sostiene:
 *   - cada fila de «Qué se garantiza» enlaza al menos una prueba, y esa prueba existe con ese nombre;
 *   - cada referencia archivo:línea apunta a un archivo y a una línea que existen;
 *   - la sección de límites existe y dice lo que no se hizo (S0.4 sin ejecutar, sin revisión independiente);
 *   - no se cita ninguna lista de riesgos de OWASP que no se haya podido verificar.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./helpers.js";

const doc = readFileSync(join(ROOT, "docs", "GARANTIAS-Y-LIMITES.md"), "utf8").replace(/\r\n/g, "\n");
const garantias = doc.split("\n").filter((l) => /^\| G\d+ \|/.test(l));

describe("docs/GARANTIAS-Y-LIMITES.md", () => {
  test("hay garantías y cada una tiene al menos una prueba enlazada", () => {
    assert.ok(garantias.length >= 15, `hay ${garantias.length} garantías`);
    for (const fila of garantias) {
      const pruebas = [...fila.matchAll(/`(tests\/[^`]+\.test\.js)`\s*«([^»]+)»/g)];
      assert.ok(pruebas.length >= 1, `sin prueba enlazada: ${fila.slice(0, 80)}`);
    }
  });

  test("cada prueba enlazada existe con ese nombre", () => {
    for (const fila of garantias) {
      for (const [, archivo, nombre] of fila.matchAll(/`(tests\/[^`]+\.test\.js)`\s*«([^»]+)»/g)) {
        const ruta = join(ROOT, archivo);
        assert.ok(existsSync(ruta), `${archivo} no existe`);
        const fuente = readFileSync(ruta, "utf8");
        assert.ok(fuente.includes(nombre), `${archivo} ya no contiene la prueba «${nombre}»`);
      }
    }
  });

  test("las referencias archivo:línea apuntan a líneas que existen", () => {
    const refs = [...doc.matchAll(/`((?:core|tests|cli)\/[\w./-]+\.js):(\d+(?:,\d+)*)`/g)];
    assert.ok(refs.length >= 10);
    for (const [, archivo, lineas] of refs) {
      const ruta = join(ROOT, archivo);
      assert.ok(existsSync(ruta), `${archivo} no existe`);
      const total = readFileSync(ruta, "utf8").split("\n").length;
      for (const n of lineas.split(",").map(Number)) assert.ok(n >= 1 && n <= total, `${archivo}:${n} fuera de rango (${total} líneas)`);
    }
  });

  test("los límites constan y dicen lo que NO se hizo", () => {
    const limites = doc.slice(doc.indexOf("## Qué NO se garantiza"));
    assert.ok(limites.length > 500);
    assert.match(limites, /no se ejecutó/);
    assert.match(limites, /S0\.4/);
    assert.match(limites, /revisión independiente/);
    assert.match(limites, /falsos negativos en secretos/);
    assert.match(limites, /falsos negativos en destinos/);
    assert.match(limites, /un solo proyecto/);
  });

  test("no cita riesgos de OWASP numerados (la lista no se ha podido verificar)", () => {
    assert.doesNotMatch(doc, /\bASI\d{2}\b/);
    assert.doesNotMatch(doc, /Top 10[^.\n]*(?:riesgo|risk)s?\s*#?\d/i);
    assert.match(doc, /no se ha podido leer/);
  });

  test("la garantía se formula como contención, no como detección", () => {
    assert.match(doc, /contención, no de detección/);
  });
});
