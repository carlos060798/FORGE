// @ts-check
/**
 * N-02 de la tercera revisión independiente (ADR-20): la medición por mutación filtra por cobertura
 * de la línea base, limita los archivos por medición y NO cuenta como evidencia (con `exigir`) una
 * medición sin cobertura.
 *
 * Sin modelos ni claves. Los casos «reales» usan `node --test` de verdad sobre la copia temporal.
 * Lo que NO arregla la cobertura (cables trampa dentro de una función que el código llama) queda
 * fijado en la última prueba para que nadie crea que está resuelto.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import {
  comandoConCobertura, medirMutacion, parsearCoberturaGo, parsearCoberturaNode, parsearCoberturaPython, MAX_ARCHIVOS,
} from "../core/ciclo/mutacion.js";
import { mutacion as nodoMutacion } from "../core/ciclo/pruebas-confiables.js";
import { decidirTrasMutacion, detalleMedicionInsuficiente } from "../core/ciclo/router.js";
import { leerConfigCiclo, POR_DEFECTO } from "../core/ciclo/config.js";
import { validarEstado } from "../core/ciclo/estado.js";
import { textoMutacion } from "../core/ciclo/index.js";

const tmp = (p) => mkdtempSync(join(tmpdir(), p));
const L = (...l) => l.join("\n") + "\n";

/** @param {string} cwd @param {Record<string, string>} archivos */
function escribir(cwd, archivos) {
  for (const [ruta, contenido] of Object.entries(archivos)) {
    mkdirSync(dirname(join(cwd, ruta)), { recursive: true });
    writeFileSync(join(cwd, ruta), contenido);
  }
  return cwd;
}

const PASE = { exitCode: 0, stdout: "# tests 1\n# pass 1\n", stderr: "", timedOut: false, infraError: false, durationMs: 3 };
const FALLO = { exitCode: 1, stdout: "TAP version 13\n# Subtest: x\nnot ok 1 - x\n  ---\n  failureType: 'testCodeFailure'\n  ...\n1..1\n# fail 1\n", stderr: "", timedOut: false, infraError: false, durationMs: 3 };

/** Informe de cobertura de node en formato de árbol (Node 24) y plano (Node 22). */
const NODE_ARBOL = L(
  "ℹ start of coverage report", "ℹ ----------------------------------------------------------",
  "ℹ file      | line % | branch % | funcs % | uncovered lines", "ℹ ----------------------------------------------------------",
  "ℹ src       |        |          |         | ", "ℹ  a.js     |  60.00 |    66.67 |   50.00 | 3-4 8-9", "ℹ  g        |        |          |         | ",
  "ℹ   g1.js   | 100.00 |   100.00 |  100.00 | ", "ℹ ----------------------------------------------------------",
  "ℹ all files |  63.64 |    80.00 |   66.67 | ", "ℹ end of coverage report",
);

/** Un ejecutor de prueba que ofrece cobertura y cuenta cuántas veces se le pidió. */
function ejecutorConCobertura({ ejecucion = PASE, informe, cobertura }) {
  const llamadas = { normal: 0, cobertura: 0 };
  const e = {
    llamadas,
    o: { lenguaje: "javascript", testCmd: "node --test", runId: "falso" },
    test: async () => { llamadas.normal++; return typeof ejecucion === "function" ? ejecucion() : { ...ejecucion }; },
    // La medición pide dos variantes del comando: con el reporter TAP fijado (lo de siempre) y con cobertura
    conComando: (comando) => (/--experimental-test-coverage/.test(comando)
      ? { test: async () => { llamadas.cobertura++; return cobertura ?? { exitCode: 0, stdout: informe, stderr: "", timedOut: false, infraError: false, durationMs: 1 }; } }
      : { test: (dir) => e.test(dir) }),
  };
  return e;
}

// ── Analizadores de informes ─────────────────────────────────────────────────

describe("informes de cobertura", () => {
  test("node: árbol (spec) y plano (TAP, con «# »); un archivo sin informe no aparece", () => {
    const arbol = parsearCoberturaNode(NODE_ARBOL);
    assert.deepEqual([...(arbol?.keys() ?? [])].sort(), ["src/a.js", "src/g/g1.js"]);
    assert.deepEqual([...(arbol?.get("src/a.js")?.sin ?? [])], [3, 4, 8, 9]);
    assert.equal(arbol?.get("src/g/g1.js")?.sin?.size, 0);

    const plano = parsearCoberturaNode(L(
      "# start of coverage report", "# file             | line % | branch % | funcs % | uncovered lines", "# src/a.js         |  60.00 |    66.67 |   50.00 | 3-4 8",
      "# lib/util.js       | 100.00 |   100.00 |  100.00 | ", "# all files        |  80.00 |    80.00 |   80.00 | ", "# end of coverage report",
    ));
    assert.deepEqual([...(plano?.keys() ?? [])].sort(), ["lib/util.js", "src/a.js"]);
    assert.deepEqual([...(plano?.get("src/a.js")?.sin ?? [])], [3, 4, 8]);
  });

  test("node: sin informe → null (no se inventa cobertura)", () => {
    assert.equal(parsearCoberturaNode("# tests 1\n# pass 1\n"), null);
    assert.equal(parsearCoberturaNode(""), null);
  });

  test("python: tabla de «coverage report -m»", () => {
    const m = parsearCoberturaPython(L(
      "..", "Name              Stmts   Miss  Cover   Missing", "-----------------------------------------------",
      "clasificar.py        12      3    75%   4, 7-8", "tests/test_clasificar.py     9      0   100%", "-----------------------------------------------", "TOTAL                21      3    86%",
    ));
    assert.deepEqual([...(m?.get("clasificar.py")?.sin ?? [])], [4, 7, 8]);
    assert.equal(m?.get("tests/test_clasificar.py")?.sin?.size, 0);
    assert.equal(parsearCoberturaPython("1 passed in 0.01s\n"), null);
  });

  test("go: perfil de cobertura; una línea está ejecutada si alguna de sus partes lo está; la ruta pierde el módulo", () => {
    const m = parsearCoberturaGo(L(
      "ok  \texemplo.com/demo\t0.003s", "mode: set",
      "exemplo.com/demo/clasif.go:5.20,7.2 1 1", "exemplo.com/demo/clasif.go:8.2,9.3 1 0", "exemplo.com/demo/otro.go:3.10,4.2 1 0",
    ), "exemplo.com/demo");
    assert.deepEqual([...(m?.get("clasif.go")?.ej ?? [])], [5, 6, 7]);
    assert.equal(m?.get("otro.go")?.ej?.size, 0);
    assert.equal(parsearCoberturaGo("ok  \tx\t0.1s\n"), null);
  });
});

describe("comandoConCobertura — solo lo que el ejecutor ya trae", () => {
  test("node --test, también por un script de package.json", () => {
    assert.deepEqual(comandoConCobertura({ lenguaje: "javascript", testCmd: "node --test" }), { formato: "node", comando: "node --test --test-reporter=tap --experimental-test-coverage" });
    assert.deepEqual(comandoConCobertura({ lenguaje: "typescript", testCmd: "npm test", packageJson: '{"scripts":{"test":"node --test tests/"}}' }),
      { formato: "node", comando: "node --test --test-reporter=tap --experimental-test-coverage tests/" });
  });
  test("jest, vitest y scripts que no son node --test: sin cobertura, con el motivo", () => {
    for (const testCmd of ["npx vitest run", "npx jest"]) {
      const c = comandoConCobertura({ lenguaje: "typescript", testCmd });
      assert.ok("motivo" in c && /no ofrece cobertura/.test(c.motivo), testCmd);
    }
    assert.ok("motivo" in comandoConCobertura({ lenguaje: "javascript", testCmd: "npm test", packageJson: '{"scripts":{"test":"jest"}}' }));
    assert.ok("motivo" in comandoConCobertura({ lenguaje: "javascript", testCmd: "npm test", packageJson: null }));
  });
  test("go test y Python (pytest o unittest, con el módulo coverage)", () => {
    assert.deepEqual(comandoConCobertura({ lenguaje: "go", testCmd: "go test ./..." }), { formato: "go", comando: "go test -coverprofile=/dev/stdout ./..." });
    const py = comandoConCobertura({ lenguaje: "python", testCmd: "python -m pytest -q" });
    assert.ok("comando" in py && py.formato === "python" && /^python -c "import sys,coverage;.*import pytest;.*" -q$/.test(py.comando), JSON.stringify(py));
    assert.ok("comando" in comandoConCobertura({ lenguaje: "python", testCmd: "python -m unittest discover" }));
    assert.ok("motivo" in comandoConCobertura({ lenguaje: "python", testCmd: "python run_tests.py" }));
  });
});

// ── Filtro por cobertura y tope de archivos (ejecutor falso) ─────────────────

describe("medirMutacion — cobertura de la línea base", () => {
  const SRC = L("export function a(x) {", "  if (x > 1) {", "    return 1;", "  }", "  return 2;", "}", "export function nunca(y) {", "  return y + 5;", "}");

  test("las alteraciones en líneas que ninguna prueba ejecuta, y en archivos que ninguna carga, no entran en la muestra", async () => {
    const cwd = escribir(tmp("forge-mcob-"), { "src/a.js": SRC, "src/huerfano.js": "export const h = (n) => n + 1;\n" });
    const informe = L("ℹ start of coverage report", "ℹ file | line % | branch % | funcs % | uncovered lines", "ℹ src/a.js | 60.00 | 50.00 | 50.00 | 7-9", "ℹ end of coverage report");
    const runner = ejecutorConCobertura({ informe });
    const sinFiltro = await medirMutacion({ cwd, archivos: ["src/a.js", "src/huerfano.js"], runner, cobertura: null, max: 50 });
    assert.equal(sinFiltro?.sinCobertura, true);
    const eventos = [];
    const r = await medirMutacion({ cwd, archivos: ["src/a.js", "src/huerfano.js"], runner, max: 50, alProbar: (e) => eventos.push(e) });
    assert.ok(r && sinFiltro);
    assert.equal(r.sinCobertura, undefined);
    assert.ok(r.fueraDeCobertura && r.fueraDeCobertura > 0);
    assert.equal(r.candidatas + r.fueraDeCobertura, sinFiltro.candidatas);
    assert.ok(eventos.length > 0);
    assert.ok(eventos.every((e) => e.alteracion.ruta === "src/a.js" && e.alteracion.linea < 7), "nada en src/huerfano.js ni en las líneas 7 a 9");
    assert.equal(runner.llamadas.cobertura, 1, "la cobertura se pide una vez");
  });

  test("si ninguna prueba ejecuta nada de lo alterado: sin candidatas, lineaBase ok, no es «omitida»", async () => {
    const cwd = escribir(tmp("forge-mcob-"), { "src/a.js": SRC });
    const runner = ejecutorConCobertura({ informe: L("ℹ start of coverage report", "ℹ file | line % | branch % | funcs % | uncovered lines", "ℹ src/otra.js | 100.00 | 100.00 | 100.00 | ", "ℹ end of coverage report") });
    const r = await medirMutacion({ cwd, archivos: ["src/a.js"], runner });
    assert.ok(r);
    assert.equal(r.candidatas, 0);
    assert.equal(r.probadas, 0);
    assert.equal(r.puntuacion, null);
    assert.equal(r.lineaBase, "ok");
    assert.ok((r.fueraDeCobertura ?? 0) > 0);
  });

  test("sin cobertura (el ejecutor no la ofrece): el comportamiento de antes y sinCobertura: true", async () => {
    const cwd = escribir(tmp("forge-mcob-"), { "src/a.js": SRC });
    const runner = { test: async () => ({ ...PASE }) };   // un ejecutor cualquiera: no sabe ejecutar otro comando
    const r = await medirMutacion({ cwd, archivos: ["src/a.js"], runner, max: 50 });
    assert.ok(r);
    assert.equal(r.sinCobertura, true);
    assert.match(r.motivoSinCobertura ?? "", /no permite ejecutar otro comando|no hay comando/);
    assert.ok(r.candidatas > 3);
    assert.equal(r.fueraDeCobertura, undefined);
  });

  test("el comando con cobertura falla (p. ej. coverage no está en la imagen): sinCobertura con el motivo, y la medición sigue", async () => {
    const cwd = escribir(tmp("forge-mcob-"), { "src/a.js": SRC });
    const runner = ejecutorConCobertura({ cobertura: { exitCode: 1, stdout: "", stderr: "ModuleNotFoundError: No module named 'coverage'\n", timedOut: false, infraError: false, durationMs: 1 } });
    const r = await medirMutacion({ cwd, archivos: ["src/a.js"], runner, max: 50 });
    assert.ok(r);
    assert.equal(r.sinCobertura, true);
    assert.match(r.motivoSinCobertura ?? "", /coverage/);
    assert.ok(r.probadas > 0, "se midió como antes");
  });

  test("tope de archivos: por defecto 5, los de más líneas cambiadas; el resto se anota como omitido", async () => {
    assert.equal(MAX_ARCHIVOS, 5);
    assert.equal(POR_DEFECTO.motor.mutacion_max_archivos, 5);
    // f1 con 1 cambio posible, f2 con 2, ... f8 con 8 (una línea cada uno: «return n + k»)
    const archivos = {};
    for (let n = 1; n <= 8; n++) archivos[`src/f${n}.js`] = Array.from({ length: n }, (_, k) => `export const v${k} = ${k + 1};`).join("\n") + "\n";
    const cwd = escribir(tmp("forge-mcob-"), archivos);
    const lista = Object.keys(archivos);
    const r = await medirMutacion({ cwd, archivos: lista, runner: { test: async () => ({ ...PASE }) }, max: 100, cobertura: null });
    assert.ok(r);
    assert.deepEqual(r.archivosOmitidos?.map((x) => x.ruta).sort(), ["src/f1.js", "src/f2.js", "src/f3.js"]);
    assert.deepEqual(r.porArchivo?.map((x) => x.ruta), ["src/f4.js", "src/f5.js", "src/f6.js", "src/f7.js", "src/f8.js"]);
    assert.equal(r.candidatas, 4 + 5 + 6 + 7 + 8);
    // y configurable
    const r2 = await medirMutacion({ cwd, archivos: lista, runner: { test: async () => ({ ...PASE }) }, max: 100, cobertura: null, maxArchivos: 2 });
    assert.deepEqual(r2?.porArchivo?.map((x) => x.ruta), ["src/f7.js", "src/f8.js"]);
  });

  test("al reanudar con el mismo avance no se repite la cobertura ni lo ya probado", async () => {
    const cwd = escribir(tmp("forge-mcob-"), { "src/a.js": SRC });
    const informe = L("ℹ start of coverage report", "ℹ file | line % | branch % | funcs % | uncovered lines", "ℹ src/a.js | 60.00 | 50.00 | 50.00 | 7-9", "ℹ end of coverage report");
    let guardado = null;
    const avance = { leer: () => guardado, guardar: (d) => { guardado = JSON.parse(JSON.stringify(d)); } };
    let i1 = 0;
    const primero = ejecutorConCobertura({ informe, ejecucion: () => (i1++ === 0 ? { ...PASE } : { ...FALLO }) });
    const r1 = await medirMutacion({ cwd, archivos: ["src/a.js"], runner: primero, avance, max: 4 });
    assert.equal(r1?.probadas, 4);
    assert.equal(primero.llamadas.cobertura, 1);

    const segundo = ejecutorConCobertura({ informe, ejecucion: () => ({ ...FALLO }) });   // si llegara a ejecutarse, la línea base fallaría
    const r2 = await medirMutacion({ cwd, archivos: ["src/a.js"], runner: segundo, avance, max: 4 });
    assert.equal(r2?.probadas, 4);
    assert.equal(segundo.llamadas.cobertura, 0, "la cobertura vino del avance");
    assert.equal(segundo.llamadas.normal, 0, "nada que repetir: ni siquiera la línea base");
  });
});

// ── Con exigir: sin cobertura no es evidencia ────────────────────────────────

describe("nodo mutacion — sin cobertura, exigir pide revisión humana", () => {
  const IMPL = L("export function suma(a, b) {", "  if (a < 0) {", "    return 0;", "  }", "  return a + b;", "}");

  async function medir(motor, runner) {
    const cwd = escribir(tmp("forge-mcob-"), { "src/suma.js": IMPL });
    const eventos = [];
    const estado = /** @type {any} */ ({ taskId: "T1", cwd, implementacion: { archivos: [{ ruta: "src/suma.js" }] }, pruebas: { archivos: [] }, mutacion: null });
    const deps = /** @type {any} */ ({ config: { motor }, runner, vetadas: [], log: { append: (type, payload) => eventos.push({ type, payload }) } });
    const r = await nodoMutacion(estado, deps);
    return { m: r.mutacion, eventos, estado: { ...estado, mutacion: r.mutacion } };
  }

  test("exigir sin cobertura aunque todo se detecte: decide revisión humana con el detalle claro", async () => {
    let n = 0;
    const runner = { test: async () => (n++ === 0 ? { ...PASE } : { ...FALLO }) };
    const { m, estado, eventos } = await medir({ ...POR_DEFECTO.motor, mutacion: "exigir", mutacion_max: 4 }, runner);
    assert.ok(m && m.probadas >= 3 && m.detectadas === m.probadas, "con la puntuación de antes sería éxito");
    assert.equal(m.sinCobertura, true);
    assert.equal(m.puntuacion, null);
    assert.deepEqual(validarEstado({ ...estadoMinimo(), mutacion: m }).filter((e) => /mutacion/.test(e)), []);
    const d = decidirTrasMutacion(/** @type {any} */ (estado), { modo: "exigir" });
    assert.deepEqual(d, { ruta: "revision_humana", motivo: "pruebas_debiles", insuficiente: true });
    const detalle = detalleMedicionInsuficiente(m, 3);
    assert.match(detalle, /no ofrece cobertura/);
    assert.match(detalle, /no cuenta como evidencia/);
    assert.ok(eventos.some((e) => e.type === "custom" && e.payload.aviso === "mutacion_sin_cobertura"));
    const ev = eventos.find((e) => e.type === "ciclo:mutacion");
    assert.equal(ev?.payload.sinCobertura, true);
    assert.match(textoMutacion(m), /SIN COBERTURA/);
  });

  test("informar sin cobertura: la puntuación se informa, marcada sinCobertura, y nunca cambia el resultado", async () => {
    let n = 0;
    const runner = { test: async () => (n++ === 0 ? { ...PASE } : { ...FALLO }) };
    const { m, estado } = await medir({ ...POR_DEFECTO.motor, mutacion: "informar" }, runner);
    assert.ok(m && typeof m.puntuacion === "number");
    assert.equal(m.sinCobertura, true);
    assert.deepEqual(decidirTrasMutacion(/** @type {any} */ (estado), { modo: "informar" }), { ruta: "fin_exito" });
    assert.match(textoMutacion(m), /SIN COBERTURA/);
  });

  test("exigir con cobertura: la puntuación vale, como antes", async () => {
    let n = 0;
    const informe = L("ℹ start of coverage report", "ℹ file | line % | branch % | funcs % | uncovered lines", "ℹ src/suma.js | 100.00 | 100.00 | 100.00 | ", "ℹ end of coverage report");
    const base = ejecutorConCobertura({ informe });
    base.test = async () => (n++ === 0 ? { ...PASE } : { ...FALLO });
    const { m, estado } = await medir({ ...POR_DEFECTO.motor, mutacion: "exigir", mutacion_max: 4 }, base);
    assert.ok(m && m.puntuacion === 1 && !m.sinCobertura);
    assert.deepEqual(decidirTrasMutacion(/** @type {any} */ (estado), { modo: "exigir" }), { ruta: "fin_exito" });
  });
});

function estadoMinimo() {
  return /** @type {any} */ ({
    schemaVersion: "1", runId: "r", threadId: "t", taskId: "T1", cwd: ".", tarea: { id: "T1", descripcion: "", agente: "a", archivos: [], cas: [] }, plan: null,
    contexto: { fragmentos: [], bytesTotales: 0, truncado: false }, pruebas: { archivos: [], comando: "" }, implementacion: { archivos: [] },
    iteracion: 1, maxIteraciones: 3, resultado: "en_curso", revision: null,
    presupuesto: { estado: "ok", gastadoUsd: 0, topeUsd: 1 },
  });
}

// ── Configuración ────────────────────────────────────────────────────────────

describe("motor.mutacion_max_archivos", () => {
  const conYaml = (yaml) => {
    const cwd = escribir(tmp("forge-mcob-cfg-"), { ".sdd/sdd.config.yaml": yaml });
    return cwd;
  };
  test("por defecto 5, configurable, y un valor no válido impide empezar", () => {
    assert.equal(leerConfigCiclo(conYaml("motor:\n  mutacion: informar\n")).motor.mutacion_max_archivos, 5);
    assert.equal(leerConfigCiclo(conYaml("motor:\n  mutacion_max_archivos: 3\n")).motor.mutacion_max_archivos, 3);
    for (const v of ["0", "-1", "2.5", "varios"]) assert.throws(() => leerConfigCiclo(conYaml(`motor:\n  mutacion_max_archivos: ${v}\n`)), /motor\.mutacion_max_archivos/, v);
  });
});

// ── node --test de verdad: el caso de la revisión ────────────────────────────

/** Ejecutor local: `node --test` sobre la copia que le da la medición; la variante con cobertura la pide el propio medidor. */
function ejecutorNodeReal() {
  const correr = (args) => async (dir) => {
    const { NODE_TEST_CONTEXT, ...env } = process.env;   // sin esto el node hijo cree que es una prueba más del ejecutor padre
    const r = spawnSync(process.execPath, ["--test", ...args], { cwd: dir, encoding: "utf8", timeout: 60_000, env });
    return { exitCode: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "", timedOut: false, infraError: false, durationMs: 0 };
  };
  return {
    o: { lenguaje: "javascript", testCmd: "node --test", runId: "real" },
    test: correr([]),
    // Siempre con el reporter TAP fijado (N4-06); la variante con cobertura, además, la cobertura
    conComando: (comando) => {
      assert.match(comando, /^node --test --test-reporter=tap( --experimental-test-coverage)?$/);
      return { test: correr(comando.split(" ").slice(1)) };
    },
  };
}

describe("node --test real", () => {
  test("lo que ninguna prueba ejecuta (archivo sin cargar, función sin llamar) no cuenta; lo ejecutado sí", async () => {
    const cwd = escribir(tmp("forge-mcob-real-"), {
      "package.json": "{\"type\":\"module\"}",
      "src/calculo.js": L("export function mayor(a, b) {", "  if (a > b) {", "    return a;", "  }", "  return b;", "}", "", "export function sinProbar(n) {", "  if (n > 100) {", "    return 100;", "  }", "  return n;", "}"),
      "src/huerfano.js": L("export function nadie(x) {", "  return x > 3 ? 1 : 0;", "}"),
      "tests/calculo.test.js": L("import { test } from 'node:test';", "import assert from 'node:assert/strict';", "import { mayor } from '../src/calculo.js';",
        "test('mayor', () => { assert.equal(mayor(2, 1), 2); assert.equal(mayor(1, 2), 2); });"),
    });
    const eventos = [];
    const r = await medirMutacion({ cwd, archivos: ["src/calculo.js", "src/huerfano.js"], runner: ejecutorNodeReal(), max: 50, alProbar: (e) => eventos.push(e) });
    assert.ok(r);
    assert.equal(r.sinCobertura, undefined, r.motivoSinCobertura);
    assert.ok((r.fueraDeCobertura ?? 0) >= 4, `fuera de cobertura: ${r.fueraDeCobertura}`);
    assert.ok(eventos.length > 0 && eventos.every((e) => e.alteracion.ruta === "src/calculo.js" && e.alteracion.linea <= 6), JSON.stringify(eventos.map((e) => [e.alteracion.ruta, e.alteracion.linea])));
    assert.equal(r.puntuacion, 1, JSON.stringify(r.sobrevivientes));
  });

  /** El caso de la revisión: `suma()` llama `comprobar()`, que llama a nueve archivos de una línea con `if (K !== N) throw`. Pruebas sin aserciones. */
  function proyectoDeGuardias() {
    const archivos = { "package.json": "{\"type\":\"module\"}" };
    const importes = [];
    const llamadas = [];
    for (let n = 1; n <= 9; n++) {
      archivos[`src/g/g${n}.js`] = `const K = ${n};\nexport function c${n}() { if (K !== ${n}) throw new Error('guardia ${n}'); }\n`;
      importes.push(`import { c${n} } from './g/g${n}.js';`);
      llamadas.push(`c${n}();`);
    }
    archivos["src/comprobar.js"] = `${importes.join("\n")}\nexport function comprobar() {\n  ${llamadas.join(" ")}\n}\n`;
    archivos["src/suma.js"] = L("import { comprobar } from './comprobar.js';", "export function suma(a, b) {", "  comprobar();", "  return a + b;", "}");
    archivos["tests/suma.test.js"] = L("import { test } from 'node:test';", "import { suma } from '../src/suma.js';", "test('suma se puede llamar', () => { suma(1, 2); });");
    return { cwd: escribir(tmp("forge-mcob-n02-"), archivos), archivos: ["src/suma.js", "src/comprobar.js", ...Array.from({ length: 9 }, (_, i) => `src/g/g${i + 1}.js`)] };
  }

  test("N-02: cables trampa dentro de funciones llamadas por el código — la muestra respeta el tope de archivos; la puntuación SIGUE inflada (límite documentado)", async () => {
    const { cwd, archivos } = proyectoDeGuardias();
    const r = await medirMutacion({ cwd, archivos, runner: ejecutorNodeReal(), max: 10 });
    assert.ok(r);
    assert.equal(r.sinCobertura, undefined, r.motivoSinCobertura);
    // Lo que la corrección sí consigue: como mucho 5 archivos, los demás quedan anotados
    assert.equal(r.porArchivo?.length, 5);
    assert.equal(r.archivosOmitidos?.length, 5, "diez archivos con algo que alterar (comprobar.js no tiene nada): cinco medidos y cinco omitidos");
    assert.ok(r.porArchivo?.some((x) => x.ruta === "src/suma.js" && x.detectadas === 0), "el cálculo real (suma.js) NO está comprobado por ninguna prueba: 0 detectadas");
    // Lo que NO consigue: las guardias están cubiertas (se ejecutan) y su fallo es un fallo de prueba real
    assert.ok((r.puntuacion ?? 0) >= 0.8, `puntuación ${r.puntuacion}: la cobertura no distingue ejecutar de comprobar`);
    // El único dato honesto está en el reparto: todo lo detectado sale de archivos de guardia
    const detectadasEnGuardias = (r.porArchivo ?? []).filter((x) => x.ruta.startsWith("src/g/")).reduce((s, x) => s + x.detectadas, 0);
    assert.equal(detectadasEnGuardias, r.detectadas);
  });
});

// ── N4-06: la medición fija el reporter TAP y exige el resumen del ejecutor ──

describe("N4-06 — el módulo bajo prueba no puede suplantar un fallo de prueba", () => {
  test("un módulo que imprime la salida del reporter spec y falla al cargar: nada se cuenta como detectado", async () => {
    const falsa = "test at tests/suma.test.js:3:1\\n✖ suma devuelve el total (0.5ms)\\nℹ fail 1";
    const cwd = escribir(tmp("forge-mcob-tap-"), {
      "package.json": "{\"type\":\"module\"}",
      "src/suma.js": L("export function suma(a, b) {", "  return a + b;", "}"),
      "src/guardia.js": L(
        "import { suma } from './suma.js';",
        `if (suma(1, 1) !== 2) { console.log("${falsa}"); process.exitCode = 1; }`,
        "export const ok = true;",
      ),
      "tests/suma.test.js": L("import { test } from 'node:test';", "import '../src/guardia.js';", "import { suma } from '../src/suma.js';", "test('se puede llamar', () => { suma(1, 2); });"),
    });
    const r = await medirMutacion({ cwd, archivos: ["src/suma.js", "src/guardia.js"], runner: ejecutorNodeRealSpec(), max: 10 });
    assert.ok(r);
    assert.equal(r.detectadas, 0, JSON.stringify(r));
    assert.equal(r.puntuacion === null || r.puntuacion === 0, true);
  });

  test("el reconocimiento por texto ya no acepta el reporter spec ni un resumen que no cuadra", async () => {
    const { senalDeFallo } = await import("../core/ciclo/mutacion.js");
    assert.equal(senalDeFallo("test at tests/suma.test.js:3:1\n✖ suma devuelve el total (0.5ms)\nℹ fail 1\n", "javascript"), "sin_senal");
    const bloque = "not ok 1 - suma\n  ---\n  duration_ms: 1\n  failureType: 'testCodeFailure'\n  ...\n";
    assert.equal(senalDeFallo(bloque, "javascript"), "sin_senal");
    assert.equal(senalDeFallo(`${bloque}1..1\n# fail 1\n`, "javascript"), "prueba");
  });
});

/** Un ejecutor que, si la medición no le impone el reporter TAP, usa el spec (el de Node sin TTY). */
function ejecutorNodeRealSpec() {
  const correr = (args) => async (dir) => {
    const { NODE_TEST_CONTEXT, ...env } = process.env;
    const r = spawnSync(process.execPath, ["--test", ...args], { cwd: dir, encoding: "utf8", timeout: 60_000, env });
    return { exitCode: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "", timedOut: false, infraError: false, durationMs: 0 };
  };
  return {
    o: { lenguaje: "javascript", testCmd: "node --test --test-reporter=spec", runId: "real-spec" },
    test: correr(["--test-reporter=spec"]),
    conComando: (comando) => ({ test: correr(comando.split(" ").slice(2)) }),
  };
}

// ── N4-10: la estimación de una llamada cancelada tiene cota ────────────────

describe("N4-10 — tokensEstimados acotado", () => {
  test("1e300, MAX_SAFE_INTEGER y más de 2 000 000 no tocan el presupuesto; una estimación razonable sí", async () => {
    const { trasAbortada, MAX_TOKENS_ESTIMADOS } = await import("../core/ciclo/presupuesto.js");
    assert.equal(MAX_TOKENS_ESTIMADOS, 2_000_000);
    const p = { tope_usd: 1, gastado_usd: 0, llamadas: 0, tokens_in: 0, tokens_out: 0, estado: "ok" };
    const r = (tokensEstimados) => ({ abortada: true, tokensEstimados, proveedor: "anthropic", modelo: "claude-sonnet-4-6" });
    const opciones = { precios: { "claude-sonnet-4-6": { input: 3, output: 15 } } };
    for (const malo of [1e300, Number.MAX_SAFE_INTEGER, MAX_TOKENS_ESTIMADOS + 1, -1, 1.5, Infinity, NaN, "99999999"]) {
      assert.deepEqual(trasAbortada(/** @type {any} */ (p), r(malo), opciones), p, String(malo));
    }
    const ok = trasAbortada(/** @type {any} */ (p), r(1000), opciones);
    assert.equal(ok.tokens_in, 1000);
    assert.equal(ok.llamadas, 1);
  });
});

