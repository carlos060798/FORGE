// @ts-check
/**
 * scripts/pruebas.mjs: la suite se reparte en rápida y lenta sin perder ni duplicar archivos.
 * Si tests/lentos.txt nombra un archivo que ya no existe, o se pierde un archivo al repartir,
 * `npm run test:rapido` + `npm run test:lento` dejarían de equivaler a `npm test`.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { clasificar } from "../scripts/pruebas.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("scripts/pruebas.mjs", () => {
  const { todos, lentos, rapidos, sobrantes } = clasificar(ROOT);

  test("descubre los mismos archivos que el script `test` de package.json", () => {
    assert.ok(todos.length > 100, `solo ${todos.length} archivos`);
    assert.ok(todos.every((a) => /^(tests\/(e2e\/|evals\/)?|__tests__\/)[^/]+\.test\.js$/.test(a)), "ruta fuera de los patrones de `npm test`");
    assert.ok(todos.includes("tests/pruebas-clasificacion.test.js"));
  });

  test("rápida + lenta = todo, sin solaparse", () => {
    assert.equal(rapidos.length + lentos.length, todos.length);
    assert.deepEqual([...new Set([...rapidos, ...lentos])].sort(), [...todos].sort());
    assert.equal(rapidos.filter((a) => lentos.includes(a)).length, 0);
  });

  test("tests/lentos.txt no nombra archivos que no existen ni repite ninguno", () => {
    assert.deepEqual(sobrantes, [], `tests/lentos.txt nombra archivos que no existen: ${sobrantes.join(", ")}`);
    assert.equal(new Set(lentos).size, lentos.length, "hay entradas repetidas en tests/lentos.txt");
  });

  test("la lista lenta no es vacía ni es casi toda la suite", () => {
    assert.ok(lentos.length >= 10, "una lista lenta vacía anula la separación");
    assert.ok(lentos.length < todos.length / 2, "si más de la mitad es lenta, la rápida deja de serlo");
  });
});
