// @ts-check
/**
 * scripts/pruebas.mjs: la suite se reparte en rápida, lenta y cuarentena sin perder ni duplicar archivos.
 * Si tests/lentos.txt o tests/cuarentena.txt nombran un archivo que ya no existe, o se pierde un archivo al
 * repartir, `npm run test:rapido` + `npm run test:lento` + `npm run test:cuarentena` dejarían de equivaler a la suite.
 *
 * Cuarentena (spec 2026-11-09-ci-verde-y-cuarentena, ADR-23): cada entrada lleva incidencia, fecha y motivo;
 * caduca a los 30 días; como mucho 5 a la vez. CA-001-01, CA-001-02, CA-001-03, CA-001-04, CA-001-05.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { clasificar, parsearCuarentena, DIAS_CADUCIDAD, MAX_CUARENTENA, MODOS } from "../scripts/pruebas.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("scripts/pruebas.mjs", () => {
  const { todos, lentos, rapidos, cuarentena, sobrantes, sobrantesCuarentena, erroresCuarentena } = clasificar(ROOT);

  test("descubre los archivos de prueba de las carpetas de la suite", () => {
    assert.ok(todos.length > 100, `solo ${todos.length} archivos`);
    assert.ok(todos.every((a) => /^(tests\/(e2e\/|evals\/)?|__tests__\/)[^/]+\.test\.js$/.test(a)), "ruta fuera de los patrones de la suite");
    assert.ok(todos.includes("tests/pruebas-clasificacion.test.js"));
  });

  test("rápida + lenta + cuarentena = todo, sin solaparse (CA-001-03)", () => {
    assert.equal(rapidos.length + lentos.length + cuarentena.length, todos.length);
    assert.deepEqual([...new Set([...rapidos, ...lentos, ...cuarentena])].sort(), [...todos].sort());
    assert.equal(rapidos.filter((a) => lentos.includes(a)).length, 0);
    assert.equal(rapidos.filter((a) => cuarentena.includes(a)).length, 0);
    assert.equal(lentos.filter((a) => cuarentena.includes(a)).length, 0);
  });

  test("tests/lentos.txt no nombra archivos que no existen ni repite ninguno", () => {
    assert.deepEqual(sobrantes, [], `tests/lentos.txt nombra archivos que no existen: ${sobrantes.join(", ")}`);
    assert.equal(new Set(lentos).size, lentos.length, "hay entradas repetidas en tests/lentos.txt");
  });

  test("la lista lenta no es vacía ni es casi toda la suite", () => {
    assert.ok(lentos.length >= 10, "una lista lenta vacía anula la separación");
    assert.ok(lentos.length < todos.length / 2, "si más de la mitad es lenta, la rápida deja de serlo");
  });

  test("tests/cuarentena.txt del repositorio: formato válido, sin caducadas, sin inexistentes y dentro del tope (CA-001-01, 04, 05)", () => {
    assert.deepEqual(erroresCuarentena, [], `tests/cuarentena.txt tiene errores:\n${erroresCuarentena.join("\n")}`);
    assert.deepEqual(sobrantesCuarentena, [], `tests/cuarentena.txt nombra archivos que no existen: ${sobrantesCuarentena.join(", ")}`);
    assert.ok(cuarentena.length <= MAX_CUARENTENA, `${cuarentena.length} pruebas en cuarentena; el tope es ${MAX_CUARENTENA}`);
  });

  test("los modos son todo, rapido, lento y cuarentena (CA-001-02)", () => {
    assert.deepEqual([...MODOS].sort(), ["cuarentena", "lento", "rapido", "todo"]);
    assert.equal(DIAS_CADUCIDAD, 30);
    assert.equal(MAX_CUARENTENA, 5);
  });
});

describe("parsearCuarentena: el formato de tests/cuarentena.txt", () => {
  const HOY = new Date("2026-11-09T12:00:00Z");

  test("archivo vacío o solo comentarios: válido y sin entradas (CA-001-04)", () => {
    assert.deepEqual(parsearCuarentena("", HOY), { entradas: [], errores: [] });
    assert.deepEqual(parsearCuarentena("# formato: ruta | #issue | fecha | motivo\n\n   \n", HOY), { entradas: [], errores: [] });
  });

  test("una entrada bien formada se lee con sus cuatro campos (CA-001-01)", () => {
    const { entradas, errores } = parsearCuarentena("tests/x.test.js | #12 | 2026-11-01 | falla bajo carga\n", HOY);
    assert.deepEqual(errores, []);
    assert.deepEqual(entradas, [{ archivo: "tests/x.test.js", incidencia: "#12", fecha: "2026-11-01", motivo: "falla bajo carga", linea: 1 }]);
  });

  test("sin incidencia, sin fecha, fecha inválida o sin motivo: error que dice la línea (CA-001-01)", () => {
    const casos = [
      "tests/x.test.js | 2026-11-01 | motivo",            // faltan campos
      "tests/x.test.js | 12 | 2026-11-01 | motivo",       // incidencia sin #
      "tests/x.test.js | #12 | 1 nov 2026 | motivo",      // fecha no ISO
      "tests/x.test.js | #12 | 2026-13-40 | motivo",      // fecha imposible
      "tests/x.test.js | #12 | 2026-11-01 |   ",          // motivo vacío
      "tests/x.test.js | #12 | 2026-11-01 | a | b",       // campos de más
    ];
    for (const c of casos) {
      const { entradas, errores } = parsearCuarentena(c + "\n", HOY);
      assert.equal(entradas.length, 0, c);
      assert.equal(errores.length, 1, c);
      assert.match(errores[0], /línea 1/, c);
    }
  });

  test("una entrada con más de 30 días caduca y es un error que nombra el archivo y la fecha (CA-001-04)", () => {
    const limite = `tests/x.test.js | #12 | 2026-10-10 | a\n`;   // 30 días exactos: válida
    assert.deepEqual(parsearCuarentena(limite, HOY).errores, []);
    const caducada = `tests/x.test.js | #12 | 2026-10-09 | a\n`; // 31 días: caducada
    const r = parsearCuarentena(caducada, HOY);
    assert.equal(r.errores.length, 1);
    assert.match(r.errores[0], /caduc/);
    assert.match(r.errores[0], /tests\/x\.test\.js/);
    assert.match(r.errores[0], /2026-10-09/);
  });

  test("una fecha futura no vale (no se puede «renovar» por adelantado)", () => {
    const r = parsearCuarentena("tests/x.test.js | #12 | 2026-12-01 | a\n", HOY);
    assert.equal(r.errores.length, 1);
    assert.match(r.errores[0], /futur/);
  });

  test("más de cinco entradas: error de tope (CA-001-05)", () => {
    const seis = Array.from({ length: 6 }, (_, i) => `tests/x${i}.test.js | #1 | 2026-11-01 | a`).join("\n") + "\n";
    const r = parsearCuarentena(seis, HOY);
    assert.ok(r.errores.some((e) => /tope|máximo/.test(e)), r.errores.join("\n"));
  });

  test("una ruta repetida es un error", () => {
    const r = parsearCuarentena("tests/x.test.js | #1 | 2026-11-01 | a\ntests/x.test.js | #2 | 2026-11-02 | b\n", HOY);
    assert.ok(r.errores.some((e) => /repetid/.test(e)), r.errores.join("\n"));
  });
});

describe("clasificar con un árbol de pruebas sintético", () => {
  /** Raíz temporal con tests/a..e, lentos = c, cuarentena = e. */
  function arbol(cuarentenaTxt) {
    const raiz = mkdtempSync(join(tmpdir(), "fragua-clasificar-"));
    mkdirSync(join(raiz, "tests"), { recursive: true });
    for (const n of ["a", "b", "c", "d", "e"]) writeFileSync(join(raiz, "tests", `${n}.test.js`), "", "utf8");
    writeFileSync(join(raiz, "tests", "lentos.txt"), "tests/c.test.js\n", "utf8");
    if (cuarentenaTxt !== null) writeFileSync(join(raiz, "tests", "cuarentena.txt"), cuarentenaTxt, "utf8");
    return raiz;
  }
  const HOY = new Date("2026-11-09T12:00:00Z");

  test("la cuarentena se excluye de todo, rapido y lento, y aparece en su propia lista (CA-001-02)", () => {
    const raiz = arbol("tests/e.test.js | #7 | 2026-11-08 | tiempo límite bajo carga\n");
    try {
      const r = clasificar(raiz, HOY);
      assert.deepEqual(r.cuarentena, ["tests/e.test.js"]);
      assert.deepEqual(r.todos, ["tests/a.test.js", "tests/b.test.js", "tests/c.test.js", "tests/d.test.js"]);
      assert.deepEqual(r.lentos, ["tests/c.test.js"]);
      assert.deepEqual(r.rapidos, ["tests/a.test.js", "tests/b.test.js", "tests/d.test.js"]);
      assert.deepEqual(r.erroresCuarentena, []);
    } finally { rmSync(raiz, { recursive: true, force: true }); }
  });

  test("sin tests/cuarentena.txt no cambia nada: cuarentena vacía", () => {
    const raiz = arbol(null);
    try {
      const r = clasificar(raiz, HOY);
      assert.deepEqual(r.cuarentena, []);
      assert.equal(r.todos.length, 5);
    } finally { rmSync(raiz, { recursive: true, force: true }); }
  });

  test("una entrada que nombra un archivo inexistente va a sobrantesCuarentena (CA-001-02)", () => {
    const raiz = arbol("tests/zz.test.js | #7 | 2026-11-08 | x\n");
    try {
      const r = clasificar(raiz, HOY);
      assert.deepEqual(r.sobrantesCuarentena, ["tests/zz.test.js"]);
      assert.deepEqual(r.cuarentena, []);
      assert.equal(r.todos.length, 5, "un archivo inexistente no quita nada de la suite");
    } finally { rmSync(raiz, { recursive: true, force: true }); }
  });

  test("un archivo en lentos.txt y en cuarentena.txt a la vez: la cuarentena manda y no está en lentos", () => {
    const raiz = arbol("tests/c.test.js | #7 | 2026-11-08 | x\n");
    try {
      const r = clasificar(raiz, HOY);
      assert.deepEqual(r.cuarentena, ["tests/c.test.js"]);
      assert.deepEqual(r.lentos, []);
      assert.ok(!r.todos.includes("tests/c.test.js"));
    } finally { rmSync(raiz, { recursive: true, force: true }); }
  });
});
