// @ts-check
/**
 * capturar.mjs — Captura la salida REAL de cada ejecutor de pruebas en el entorno aislado.
 *
 * Para cada ejecutor crea un proyecto mínimo en una carpeta temporal (fuera del repositorio), lo
 * ejecuta con el `SandboxRunner` de siempre (sin red, raíz de solo lectura, usuario sin privilegios)
 * en varias situaciones y guarda stdout, stderr y código de salida en
 * `tests/fixtures/salidas-ejecutores/<ejecutor>/<situacion>.txt`.
 *
 * Esos archivos son la evidencia que usa `tests/mutacion-salidas-reales.test.js`: NO se editan a
 * mano. Para regenerarlos (hace falta Docker con red para preparar las imágenes):
 *
 *   node tests/fixtures/salidas-ejecutores/capturar.mjs            # todos
 *   node tests/fixtures/salidas-ejecutores/capturar.mjs jest vitest # solo esos
 *
 * No usa modelos ni claves. En cada situación solo cambia el CÓDIGO BAJO PRUEBA; las pruebas son
 * las mismas, igual que en la medición por mutación.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { DockerCli } from "../../../core/sandbox/docker-cli.js";
import { SandboxRunner } from "../../../core/sandbox/sandbox-runner.js";
import { IMAGENES_BASE } from "../../../core/sandbox/preparar-imagen.js";

const AQUI = dirname(fileURLToPath(import.meta.url));
const lineas = (...l) => l.join("\n") + "\n";

/** Qué se espera de cada situación (lo comprueba el test, no este script). */
export const SITUACIONES = {
  "pasa": "las pruebas pasan",
  "asercion": "una prueba con nombre falla por una aserción",
  "sintaxis": "error de sintaxis en el código bajo prueba",
  "importacion": "el código bajo prueba importa un módulo que no existe",
  "excepcion-al-cargar": "el código bajo prueba lanza una excepción al cargarse (cable trampa)",
  "excepcion-en-prueba": "una prueba con nombre falla por una excepción dentro de la prueba (el código devuelve nulo)",
  "excepcion-al-cargar-con-salida": "como excepcion-al-cargar, pero el código escribe en la consola antes de lanzar",
  "error-de-tipos": "el código bajo prueba no pasa la comprobación de tipos (devuelve null donde se declara number)",
};

// ── Python ───────────────────────────────────────────────────────────────────

const PY = {
  suma: ["def suma(a, b):", "    return a + b"],
  esPar: ["def es_par(n):", "    return n % 2 == 0"],
  formatea: ["def formatea(n):", "    return \"n=\" + str(n)"],
};
const py = (cambios = {}, cabecera = []) => lineas(...cabecera, ...(cambios.suma ?? PY.suma), "", "", ...PY.esPar, "", "", ...(cambios.formatea ?? PY.formatea));
const PY_SITUACIONES = {
  "pasa": py(),
  "asercion": py({ suma: ["def suma(a, b):", "    return a - b"] }),
  "sintaxis": py({ suma: ["def suma(a, b):", "    return a +"] }),
  "importacion": py({}, ["import modulo_que_no_existe", "", ""]),
  "excepcion-al-cargar": py({}, ["LIMITE = 11", "if LIMITE != 10:", "    raise RuntimeError(\"trampa\")", "", ""]),
  "excepcion-en-prueba": py({ formatea: ["def formatea(n):", "    return None"] }),
  "excepcion-al-cargar-con-salida": py({}, ["print(\"cargando calc\")", "LIMITE = 11", "if LIMITE != 10:", "    raise RuntimeError(\"trampa\")", "", ""]),
};

// ── JavaScript y TypeScript ──────────────────────────────────────────────────

/** @param {'cjs'|'esm'|'ts'} forma */
function js(forma, cambios = {}, cabecera = []) {
  const ts = forma === "ts";
  const exp = forma === "cjs" ? "" : "export ";
  const suma = cambios.suma ?? `  return a + b;`;
  const formatea = cambios.formatea ?? `  return 'n=' + String(n);`;
  return lineas(
    ...cabecera,
    `${exp}function suma(a${ts ? ": number" : ""}, b${ts ? ": number" : ""})${ts ? ": number" : ""} {`, suma, "}", "",
    `${exp}function esPar(n${ts ? ": number" : ""})${ts ? ": boolean" : ""} {`, "  return n % 2 === 0;", "}", "",
    `${exp}function formatea(n${ts ? ": number" : ""})${ts ? ": string" : ""} {`, formatea, "}",
    ...(forma === "cjs" ? ["", "module.exports = { suma, esPar, formatea };"] : []),
  );
}
/** @param {'cjs'|'esm'|'ts'} forma  @param {{ tipos?: boolean, nulo?: string }} [extra] */
function jsSituaciones(forma, extra = {}) {
  const importar = forma === "cjs" ? ["const { nada } = require('./no-existe');", "const copia = nada;", ""] : ["import { nada } from './no-existe" + (extra.nulo ?? "") + "';", "export const copia = nada;", ""];
  const trampa = ["const LIMITE = 11;", "if (LIMITE !== 10) throw new Error('trampa');", ""];
  /** @type {Record<string, string>} */
  const s = {
    "pasa": js(forma),
    "asercion": js(forma, { suma: "  return a - b;" }),
    "sintaxis": js(forma, { suma: "  return a + ;" }),
    "importacion": js(forma, {}, importar),
    "excepcion-al-cargar": js(forma, {}, trampa),
    "excepcion-en-prueba": js(forma, { formatea: forma === "ts" ? "  return null as any;" : "  return null;" }),
    "excepcion-al-cargar-con-salida": js(forma, {}, ["console.log('cargando calc');", ...trampa]),
  };
  if (extra.tipos) s["error-de-tipos"] = js(forma, { suma: "  return null;" });
  return s;
}

const PRUEBAS_JEST = (importacion) => lineas(
  importacion, "",
  "describe('calc', () => {",
  "  test('suma dos numeros', () => {", "    expect(suma(2, 2)).toBe(4);", "  });",
  "  test('esPar reconoce los pares', () => {", "    expect(esPar(4)).toBe(true);", "  });",
  "  test('formatea un numero', () => {", "    expect(formatea(3).toUpperCase()).toBe('N=3');", "  });",
  "});",
);
const PRUEBAS_NODE = (importacion) => lineas(
  "import { test } from 'node:test';", "import assert from 'node:assert/strict';", importacion, "",
  "test('suma dos numeros', () => {", "  assert.equal(suma(2, 2), 4);", "});",
  "test('esPar reconoce los pares', () => {", "  assert.equal(esPar(4), true);", "});",
  "test('formatea un numero', () => {", "  assert.equal(formatea(3).toUpperCase(), 'N=3');", "});",
);
const TSCONFIG = JSON.stringify({ compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "Bundler", strict: true, noEmit: true, allowImportingTsExtensions: true }, include: ["src", "tests"] }, null, 2) + "\n";

// ── Go ───────────────────────────────────────────────────────────────────────

const go = (cambios = {}, imports = [], extra = []) => lineas(
  "package demo", "", ...(imports.length ? [`import (`, ...imports.map((i) => `\t"${i}"`), ")", ""] : ["import \"strconv\"", ""]),
  ...extra,
  "func Suma(a, b int) int {", cambios.suma ?? "\treturn a + b", "}", "",
  "func EsPar(n int) bool {", "\treturn n%2 == 0", "}", "",
  "func Formatea(n int) *string {", ...(cambios.formatea ?? ["\ts := \"n=\" + strconv.Itoa(n)", "\treturn &s"]), "}",
);
const GO_SITUACIONES = {
  "pasa": go(),
  "asercion": go({ suma: "\treturn a - b" }),
  "sintaxis": go({ suma: "\treturn a +" }),
  "importacion": go({}, ["strconv", "demo/noexiste"], ["var _ = noexiste.Nada", ""]),
  "excepcion-al-cargar": go({}, [], ["const limite = 11", "", "func init() {", "\tif limite != 10 {", "\t\tpanic(\"trampa\")", "\t}", "}", ""]),
  "excepcion-en-prueba": go({ formatea: ["\t_ = strconv.Itoa(n)", "\treturn nil"] }),
};
const GO_PRUEBAS = lineas(
  "package demo", "", "import \"testing\"", "",
  "func TestSuma(t *testing.T) {", "\tif Suma(2, 2) != 4 {", "\t\tt.Fatal(\"suma\")", "\t}", "}", "",
  "func TestEsPar(t *testing.T) {", "\tif !EsPar(4) {", "\t\tt.Fatal(\"par\")", "\t}", "}", "",
  "func TestFormatea(t *testing.T) {", "\tif *Formatea(3) != \"n=3\" {", "\t\tt.Fatal(\"formatea\")", "\t}", "}",
);

// ── Ejecutores ───────────────────────────────────────────────────────────────

/**
 * @typedef {{ lenguaje: string, lenguajeFuente: string, testCmd: string, versiones: string[], fuente: string,
 *   base: Record<string, string>, situaciones: Record<string, string>, nota?: string }} Ejecutor
 * `lenguaje` es el del proyecto (elige la imagen); `lenguajeFuente`, el del archivo que la medición alteraría
 * (elige los patrones de `senalDeFallo`); `testCmd`, el que da `core/stack-detector.js` para ese proyecto.
 */

/** @type {Record<string, Ejecutor>} */
export const EJECUTORES = {
  "pytest": {
    lenguaje: "python", lenguajeFuente: "python", testCmd: "python -m pytest", versiones: ["python -m pytest --version", "python --version"],
    fuente: "calc.py",
    base: {
      "requirements.txt": "pytest==9.1.1\n",
      "tests/test_calc.py": lineas("from calc import suma, es_par, formatea", "", "",
        "def test_suma():", "    assert suma(2, 2) == 4", "", "",
        "def test_es_par():", "    assert es_par(4) is True", "", "",
        "def test_formatea():", "    assert formatea(3).upper() == \"N=3\""),
    },
    situaciones: PY_SITUACIONES,
  },
  "unittest": {
    lenguaje: "python", lenguajeFuente: "python", testCmd: "python -m unittest discover", versiones: ["python --version"],
    fuente: "calc.py",
    base: {
      "test_calc.py": lineas("import unittest", "", "from calc import suma, es_par, formatea", "", "",
        "class CalcTest(unittest.TestCase):",
        "    def test_suma(self):", "        self.assertEqual(suma(2, 2), 4)", "",
        "    def test_es_par(self):", "        self.assertIs(es_par(4), True)", "",
        "    def test_formatea(self):", "        self.assertEqual(formatea(3).upper(), \"N=3\")"),
    },
    situaciones: PY_SITUACIONES,
  },
  "jest": {
    lenguaje: "javascript", lenguajeFuente: "javascript", testCmd: "npx jest", versiones: ["npx jest --version", "node --version"],
    fuente: "src/calc.js",
    base: {
      "package.json": JSON.stringify({ name: "demo", private: true, devDependencies: { jest: "30.5.2" } }, null, 2) + "\n",
      "tests/calc.test.js": PRUEBAS_JEST("const { suma, esPar, formatea } = require('../src/calc');"),
    },
    situaciones: jsSituaciones("cjs"),
  },
  "jest-ts": {
    lenguaje: "typescript", lenguajeFuente: "typescript", testCmd: "npx jest", versiones: ["npx jest --version", "npx tsc --version", "node --version"],
    fuente: "src/calc.ts",
    nota: "jest con ts-jest 29.4.14 (comprueba tipos al transformar)",
    base: {
      "package.json": JSON.stringify({ name: "demo", private: true, jest: { preset: "ts-jest", testEnvironment: "node" }, devDependencies: { jest: "30.5.2", "ts-jest": "29.4.14", typescript: "5.9.3", "@types/jest": "30.0.0" } }, null, 2) + "\n",
      "tsconfig.json": JSON.stringify({ compilerOptions: { target: "ES2022", module: "CommonJS", strict: true, esModuleInterop: true, types: ["jest"] }, include: ["src", "tests"] }, null, 2) + "\n",
      "tests/calc.test.ts": PRUEBAS_JEST("import { suma, esPar, formatea } from '../src/calc';"),
    },
    situaciones: jsSituaciones("ts", { tipos: true }),
  },
  "vitest": {
    lenguaje: "typescript", lenguajeFuente: "typescript", testCmd: "npx vitest run", versiones: ["npx vitest --version", "npx vite --version"],
    fuente: "src/calc.ts",
    base: {
      "package.json": JSON.stringify({ name: "demo", private: true, type: "module", devDependencies: { vitest: "5.0.3", vite: "8.3.4" } }, null, 2) + "\n",
      "tsconfig.json": TSCONFIG,
      "tests/calc.test.ts": PRUEBAS_JEST("import { describe, test, expect } from 'vitest';\nimport { suma, esPar, formatea } from '../src/calc';"),
    },
    situaciones: jsSituaciones("ts"),
  },
  "node-test-ts": {
    lenguaje: "typescript", lenguajeFuente: "typescript", testCmd: "npm test", versiones: ["node --version"],
    fuente: "src/calc.ts",
    nota: "node --test sobre archivos .ts: Node quita los tipos al cargar (sin comprobarlos); sin dependencias",
    base: {
      "package.json": JSON.stringify({ name: "demo", private: true, type: "module", scripts: { test: "node --test" } }, null, 2) + "\n",
      "tsconfig.json": TSCONFIG,
      "tests/calc.test.ts": PRUEBAS_NODE("import { suma, esPar, formatea } from '../src/calc.ts';"),
    },
    situaciones: jsSituaciones("ts", { nulo: ".ts" }),
  },
  "node-test": {
    lenguaje: "javascript", lenguajeFuente: "javascript", testCmd: "npm test", versiones: ["node --version"],
    fuente: "src/calc.js",
    base: {
      "package.json": JSON.stringify({ name: "demo", private: true, type: "module", scripts: { test: "node --test" } }, null, 2) + "\n",
      "tests/calc.test.js": PRUEBAS_NODE("import { suma, esPar, formatea } from '../src/calc.js';"),
    },
    situaciones: jsSituaciones("esm", { nulo: ".js" }),
  },
  "go-test": {
    lenguaje: "go", lenguajeFuente: "go", testCmd: "go test ./...", versiones: ["go version"],
    fuente: "calc.go",
    base: { "go.mod": "module demo\n\ngo 1.23\n", "calc_test.go": GO_PRUEBAS },
    situaciones: GO_SITUACIONES,
  },
};

// ── Captura ──────────────────────────────────────────────────────────────────

export const SEP_STDOUT = "=====STDOUT=====";
export const SEP_STDERR = "=====STDERR=====";
export const SEP_FIN = "=====FIN=====";

function escribir(dir, archivos) {
  for (const [ruta, contenido] of Object.entries(archivos)) {
    mkdirSync(dirname(join(dir, ruta)), { recursive: true });
    writeFileSync(join(dir, ruta), contenido);
  }
}

async function capturar(nombre, soloSituaciones) {
  const e = EJECUTORES[nombre];
  const cli = new DockerCli();
  const cwd = mkdtempSync(join(tmpdir(), `forge-captura-${nombre}-`));
  let n = 0;
  const runner = (testCmd) => new SandboxRunner({
    runId: `cap-${nombre}-${process.pid}-${++n}`, dirMotor: join(cwd, ".sdd", "motor", "r"), lenguaje: e.lenguaje, testCmd, cli,
    timeoutMs: 300_000, descargarBase: true,
  });
  try {
    escribir(cwd, { ...e.base, [e.fuente]: e.situaciones.pasa });

    const versiones = [];
    let imagen = "";
    for (const cmd of e.versiones) {
      const sr = runner(cmd);
      const r = await sr.test(cwd);
      if (r.infraError) throw new Error(`${nombre}: no se pudo ejecutar «${cmd}»: ${r.stderr}`);
      imagen = sr.ultimaImagen?.imagen ?? imagen;
      versiones.push(`${r.stdout}\n${r.stderr}`.trim().split(/\r?\n/).filter(Boolean).pop() ?? "?");
    }
    const id = (await cli.ejecutar(["image", "inspect", "--format", "{{.Id}}", imagen])).stdout.trim();

    for (const [situacion, fuente] of Object.entries(e.situaciones)) {
      if (soloSituaciones.length && !soloSituaciones.includes(situacion)) continue;
      escribir(cwd, { [e.fuente]: fuente });
      const r = await runner(e.testCmd).test(cwd);
      if (r.infraError) throw new Error(`${nombre}/${situacion}: fallo del entorno: ${r.stderr}`);
      const cabecera = [
        "# Salida real de un ejecutor de pruebas en el entorno aislado de FORGE. NO editar a mano:",
        "# se regenera con `node tests/fixtures/salidas-ejecutores/capturar.mjs`.",
        `ejecutor: ${nombre}`,
        `situacion: ${situacion}`,
        `descripcion: ${SITUACIONES[situacion]}`,
        `version: ${versiones.join(" · ")}`,
        ...(e.nota ? [`nota: ${e.nota}`] : []),
        `imagen: ${imagen} (base ${IMAGENES_BASE[e.lenguaje]}; ${id})`,
        `comando: ${e.testCmd}`,
        `lenguaje: ${e.lenguajeFuente}`,
        `archivo_alterado: ${e.fuente}`,
        `fecha: ${new Date().toISOString().slice(0, 10)}`,
        `codigo_salida: ${r.exitCode}`,
        `tiempo_agotado: ${r.timedOut}`,
        `memoria_agotada: ${r.oomKilled}`,
        `duracion_ms: ${r.durationMs}`,
      ];
      const texto = `${cabecera.join("\n")}\n${SEP_STDOUT}\n${r.stdout}\n${SEP_STDERR}\n${r.stderr}\n${SEP_FIN}\n`;
      const destino = join(AQUI, nombre, `${situacion}.txt`);
      mkdirSync(dirname(destino), { recursive: true });
      writeFileSync(destino, texto);
      console.log(`${nombre}/${situacion}: código ${r.exitCode} · ${r.durationMs} ms · ${r.stdout.length + r.stderr.length} caracteres`);
    }
  } finally {
    rmSync(cwd, { recursive: true, force: true, maxRetries: 2 });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const nombres = args.filter((a) => a in EJECUTORES);
  const situaciones = args.filter((a) => a in SITUACIONES);
  const desconocidos = args.filter((a) => !(a in EJECUTORES) && !(a in SITUACIONES));
  if (desconocidos.length) { console.error(`No conozco: ${desconocidos.join(", ")}. Ejecutores: ${Object.keys(EJECUTORES).join(", ")}`); process.exit(2); }
  let fallos = 0;
  for (const nombre of nombres.length ? nombres : Object.keys(EJECUTORES)) {
    try { await capturar(nombre, situaciones); } catch (err) { fallos++; console.error(`ERROR ${err instanceof Error ? err.message : err}`); }
  }
  process.exit(fallos ? 1 : 0);
}
