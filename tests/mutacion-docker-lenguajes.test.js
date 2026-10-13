// @ts-check
/**
 * Medición por mutación COMPLETA con Docker real en Python y en TypeScript (ADR-20).
 * Solo corre con FORGE_TEST_DOCKER=1 y el daemon en marcha; en cualquier otro caso se salta.
 *
 * Para cada forma de ejecutar las pruebas que el ciclo soporta de verdad se mide el mismo módulo
 * dos veces: con pruebas fuertes (deben detectar casi todo) y con pruebas que llaman al código sin
 * comprobar nada (deben detectar 0: la puntuación no se infla).
 *
 * TypeScript: el ciclo no compila ni transforma nada por su cuenta. Ejecuta el comando de pruebas
 * que da `core/stack-detector.js` sobre la imagen `node:22-alpine` con las dependencias de
 * `package.json`. Aquí se comprueban las tres formas que funcionan en el entorno aislado:
 *   - `npx vitest run`  (dependencia `vitest`): transforma TypeScript sin comprobar tipos;
 *   - `npm test` con `node --test` sobre archivos `.ts`, sin dependencias: Node 22.18 o posterior
 *     quita los tipos al cargar (solo sintaxis «borrable», importaciones con la extensión `.ts`);
 *   - `npx jest` con `ts-jest`: comprueba tipos, así que una alteración que rompe un tipo no compila
 *     y queda como no concluyente.
 *
 * Sin modelos ni claves. Las imágenes se preparan con red la primera vez (minutos).
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import { medirMutacion } from "../core/ciclo/mutacion.js";
import { POR_DEFECTO } from "../core/ciclo/config.js";
import { CicloVerificado } from "../core/ciclo/index.js";
import { detectStack } from "../core/stack-detector.js";
import { DockerCli } from "../core/sandbox/docker-cli.js";
import { SandboxRunner } from "../core/sandbox/sandbox-runner.js";

const cli = new DockerCli();
const dockerActivo = process.env.FORGE_TEST_DOCKER === "1" && (await cli.disponible()).ok;
const L = (...l) => l.join("\n") + "\n";

/** @param {Record<string, string>} archivos */
function proyecto(archivos) {
  const cwd = mkdtempSync(join(tmpdir(), "forge-mut-leng-"));
  for (const [ruta, contenido] of Object.entries(archivos)) {
    mkdirSync(dirname(join(cwd, ruta)), { recursive: true });
    writeFileSync(join(cwd, ruta), contenido);
  }
  return cwd;
}

/** Huella de todos los archivos de una carpeta (ruta → sha256), sin la carpeta `.sdd`. */
function huellas(dir, rel = "") {
  /** @type {Record<string, string>} */
  const mapa = {};
  for (const nombre of readdirSync(join(dir, rel)).sort()) {
    if (rel === "" && nombre === ".sdd") continue;
    const hijo = rel ? `${rel}/${nombre}` : nombre;
    if (statSync(join(dir, hijo)).isDirectory()) Object.assign(mapa, huellas(dir, hijo));
    else mapa[hijo] = createHash("sha256").update(readFileSync(join(dir, hijo))).digest("hex");
  }
  return mapa;
}

// ── El módulo que se mide: 13 alteraciones posibles en los dos lenguajes ─────

const PY = L(
  "def clasificar(n):", "    if n < 0:", "        return \"negativo\"", "    if n == 0:", "        return \"cero\"", "    return \"positivo\"", "", "",
  "def limitar(valor, maximo):", "    if valor > maximo:", "        return maximo", "    return valor",
);
const PY_FUERTES = L(
  "from clasificar import clasificar, limitar", "", "",
  "def test_negativo():", "    assert clasificar(-1) == \"negativo\"", "    assert clasificar(-0.5) == \"negativo\"", "", "",
  "def test_cero():", "    assert clasificar(0) == \"cero\"", "", "",
  "def test_positivo():", "    assert clasificar(1) == \"positivo\"", "    assert clasificar(0.5) == \"positivo\"", "", "",
  "def test_limitar():", "    assert limitar(5, 3) == 3", "    assert limitar(3, 3) == 3", "    assert limitar(2, 3) == 2",
);
const PY_SIN_ASERCIONES = L(
  "from clasificar import clasificar, limitar", "", "",
  "def test_se_puede_llamar():", "    clasificar(-1)", "    clasificar(0)", "    clasificar(1)", "    limitar(5, 3)", "    limitar(2, 3)",
);

const TS = L(
  "export function clasificar(n: number): string {", "  if (n < 0) {", "    return 'negativo';", "  }", "  if (n === 0) {", "    return 'cero';", "  }", "  return 'positivo';", "}", "",
  "export function limitar(valor: number, maximo: number): number {", "  if (valor > maximo) {", "    return maximo;", "  }", "  return valor;", "}",
);
/** @param {string} cabecera  importaciones @param {'expect'|'assert'} estilo */
const tsFuertes = (cabecera, estilo) => {
  const igual = (a, b) => (estilo === "expect" ? `expect(${a}).toBe(${b});` : `assert.equal(${a}, ${b});`);
  return L(
    cabecera, "",
    `test('negativo', () => { ${igual("clasificar(-1)", "'negativo'")} ${igual("clasificar(-0.5)", "'negativo'")} });`,
    `test('cero', () => { ${igual("clasificar(0)", "'cero'")} });`,
    `test('positivo', () => { ${igual("clasificar(1)", "'positivo'")} ${igual("clasificar(0.5)", "'positivo'")} });`,
    `test('limitar', () => { ${igual("limitar(5, 3)", "3")} ${igual("limitar(3, 3)", "3")} ${igual("limitar(2, 3)", "2")} });`,
  );
};
const tsSinAserciones = (cabecera) => L(cabecera, "", "test('se puede llamar', () => { clasificar(-1); clasificar(0); clasificar(1); limitar(5, 3); limitar(2, 3); });");

const TSCONFIG = JSON.stringify({ compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "Bundler", strict: true, noEmit: true, allowImportingTsExtensions: true }, include: ["src", "tests"] }, null, 2) + "\n";
const VITEST = "import { test, expect } from 'vitest';\nimport { clasificar, limitar } from '../src/clasificar';";
const NODE_TEST = "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { clasificar, limitar } from '../src/clasificar.ts';";
const JEST_TS = "import { clasificar, limitar } from '../src/clasificar';";

/**
 * @typedef {{ nombre: string, lenguaje: string, testCmd: string, fuente: string, base: Record<string, string>,
 *   pruebas: string, fuertes: string, sinAserciones: string, noConcluyentes?: number, porque?: string }} Caso
 * `noConcluyentes`: cuántas de las 13 alteraciones no compilan con ese ejecutor (por defecto, ninguna).
 */
/** @type {Caso[]} */
const CASOS = [
  {
    nombre: "Python con pytest", lenguaje: "python", testCmd: "python -m pytest", fuente: "clasificar.py",
    base: { "requirements.txt": "pytest==9.1.1\n", "clasificar.py": PY },
    pruebas: "tests/test_clasificar.py", fuertes: PY_FUERTES, sinAserciones: PY_SIN_ASERCIONES,
  },
  {
    nombre: "Python con pytest y coverage", lenguaje: "python", testCmd: "python -m pytest", fuente: "clasificar.py",
    base: { "requirements.txt": "pytest==9.1.1\ncoverage>=7\n", "clasificar.py": PY },
    pruebas: "tests/test_clasificar.py", fuertes: PY_FUERTES, sinAserciones: PY_SIN_ASERCIONES, conCobertura: true,
  },
  {
    nombre: "TypeScript con vitest", lenguaje: "typescript", testCmd: "npx vitest run", fuente: "src/clasificar.ts",
    base: { "package.json": JSON.stringify({ name: "demo", private: true, type: "module", devDependencies: { vitest: "5.0.3", vite: "8.3.4" } }, null, 2) + "\n", "tsconfig.json": TSCONFIG, "src/clasificar.ts": TS },
    pruebas: "tests/clasificar.test.ts", fuertes: tsFuertes(VITEST, "expect"), sinAserciones: tsSinAserciones(VITEST),
  },
  {
    nombre: "TypeScript con node --test (npm test, sin dependencias)", lenguaje: "typescript", testCmd: "npm test", fuente: "src/clasificar.ts",
    base: { "package.json": JSON.stringify({ name: "demo", private: true, type: "module", scripts: { test: "node --test" } }, null, 2) + "\n", "tsconfig.json": TSCONFIG, "src/clasificar.ts": TS },
    pruebas: "tests/clasificar.test.ts", fuertes: tsFuertes(NODE_TEST, "assert"), sinAserciones: tsSinAserciones(NODE_TEST),
    conCobertura: true,
  },
  {
    nombre: "TypeScript con jest y ts-jest", lenguaje: "typescript", testCmd: "npx jest", fuente: "src/clasificar.ts",
    base: {
      "package.json": JSON.stringify({ name: "demo", private: true, jest: { preset: "ts-jest", testEnvironment: "node" }, devDependencies: { jest: "30.5.2", "ts-jest": "29.4.14", typescript: "5.9.3", "@types/jest": "30.0.0" } }, null, 2) + "\n",
      "tsconfig.json": JSON.stringify({ compilerOptions: { target: "ES2022", module: "CommonJS", strict: true, esModuleInterop: true, types: ["jest"] }, include: ["src", "tests"] }, null, 2) + "\n",
      "src/clasificar.ts": TS,
    },
    pruebas: "tests/clasificar.test.ts", fuertes: tsFuertes(JEST_TS, "expect"), sinAserciones: tsSinAserciones(JEST_TS),
    // `return null` donde se declara string o number: ts-jest lo rechaza al transformar (error TS2322)
    noConcluyentes: 5, porque: "las 5 alteraciones «return null» no pasan la comprobación de tipos",
  },
];

let n = 0;
/** @param {Caso} caso @param {string} cwd */
const runnerDe = (caso, cwd) => new SandboxRunner({
  runId: `mleng-${process.pid}-${++n}`, dirMotor: join(cwd, ".sdd", "motor", "r"), lenguaje: caso.lenguaje, testCmd: caso.testCmd, cli, descargarBase: true,
});

describe("medición por mutación con Docker real — Python y TypeScript", { skip: !dockerActivo && "requiere FORGE_TEST_DOCKER=1 y Docker en marcha" }, () => {
  for (const caso of CASOS) {
    describe(caso.nombre, () => {
      /** @param {string} textoPruebas */
      async function medir(textoPruebas) {
        const cwd = proyecto({ ...caso.base, [caso.pruebas]: textoPruebas });
        // El comando y el lenguaje son los que el ciclo elegiría para este proyecto
        const stack = detectStack(cwd);
        assert.equal(stack.lenguaje, caso.lenguaje);
        assert.equal(stack.test_cmd, caso.testCmd);
        const runner = runnerDe(caso, cwd);
        const base = await runner.test(cwd);
        assert.equal(base.exitCode, 0, `las pruebas deben pasar sin alterar nada:\n${base.stdout}\n${base.stderr}`);
        const antes = huellas(cwd);
        /** @type {any[]} */
        const eventos = [];
        const t0 = Date.now();
        // Sin tope de tiempo práctico: se quiere la medición entera para saber cuánto tarda
        const r = await medirMutacion({ cwd, archivos: [caso.fuente], runner, timeoutMs: 1_800_000, alProbar: (e) => eventos.push(e) });
        const ms = Date.now() - t0;
        assert.ok(r, "hay alteraciones posibles");
        assert.deepEqual(huellas(cwd), antes, "el proyecto real queda idéntico");
        assert.deepEqual(runner.copiasSinBorrar, []);
        const detalle = JSON.stringify(eventos.map((e) => [e.alteracion.linea, e.alteracion.despues, e.resultado, e.motivo ?? ""]));
        return { r, ms, base, eventos, detalle };
      }

      test("pruebas fuertes: puntuación alta", async () => {
        const { r, ms, base, eventos, detalle } = await medir(caso.fuertes);
        assert.equal(r.lineaBase, "ok");
        assert.equal(r.candidatas, 13);
        assert.equal(r.noConcluyentes, caso.noConcluyentes ?? 0, `${caso.porque ?? "todas las alteraciones compilan y cargan"}: ${detalle}`);
        assert.ok(eventos.filter((e) => e.resultado === "no_concluyente").every((e) => e.motivo === "no_compila"), detalle);
        assert.ok(r.probadas >= 8, `concluyentes: ${r.probadas} · ${detalle}`);
        assert.ok(r.puntuacion !== null && r.puntuacion >= 0.9, `puntuación ${r.puntuacion}: ${JSON.stringify(r.sobrevivientes)}`);
        assert.ok(eventos.filter((e) => e.resultado === "detectada").every((e) => e.motivo === "prueba_fallida"), detalle);
        const ejecuciones = eventos.length + 1;
        // N-02: con node --test (y con coverage, si la imagen lo tiene) la medición filtra por cobertura; con vitest y jest queda sin ella
        console.log(`  ${caso.nombre} · cobertura: ${r.sinCobertura ? `SIN COBERTURA (${r.motivoSinCobertura})` : `sí, ${r.fueraDeCobertura ?? 0} fuera de cobertura, ${r.candidatas} candidatas`}`);
        if (caso.conCobertura) assert.equal(r.sinCobertura, undefined, `debía haber cobertura: ${r.motivoSinCobertura}`);
        console.log(`  ${caso.nombre} · pruebas fuertes: ${r.detectadas}/${r.probadas} detectadas (${Math.round((r.puntuacion ?? 0) * 100)} %), ${r.noConcluyentes} no concluyentes`
          + ` · medición ${ms} ms (${ejecuciones} ejecuciones, ${Math.round(ms / ejecuciones)} ms cada una) · una ejecución suelta ${base.durationMs} ms`);
      });

      test("pruebas sin aserciones: 0 detectadas, la puntuación no se infla", async () => {
        const { r, ms, eventos, detalle } = await medir(caso.sinAserciones);
        assert.equal(r.lineaBase, "ok");
        assert.equal(r.detectadas, 0, detalle);
        assert.equal(r.puntuacion, 0, detalle);
        assert.equal(r.noConcluyentes, caso.noConcluyentes ?? 0, detalle);
        assert.ok(r.probadas >= 8, `concluyentes: ${r.probadas} · ${detalle}`);
        assert.equal(r.sobrevivientes.length, r.probadas);
        console.log(`  ${caso.nombre} · sin aserciones: ${r.detectadas}/${r.probadas} detectadas, ${r.noConcluyentes} no concluyentes · medición ${ms} ms (${eventos.length + 1} ejecuciones)`);
      });
    });
  }

  test("Python, ciclo completo en modo informar: la tarea termina en éxito con su puntuación, y el tiempo que añade la medición", async () => {
    const cwd = proyecto({ "requirements.txt": "pytest==9.1.1\n" });
    const bloque = (ruta, contenido) => "```json\n" + JSON.stringify({ archivos: [{ ruta, contenido }] }) + "\n```";
    /** @type {any[]} */
    const eventos = [];
    const guion = {
      arquitecto: ['{"pasos":["implementar"],"archivosObjetivo":["clasificar.py"]}'],
      tester: [bloque("tests/test_clasificar.py", PY_FUERTES)],
      "desarrollador-backend": [bloque("clasificar.py", PY)],
    };
    const runner = new SandboxRunner({ runId: `mlengc-${process.pid}`, dirMotor: join(cwd, ".sdd", "motor", "r1"), lenguaje: "python", testCmd: "python -m pytest", cli });
    const ciclo = new CicloVerificado(/** @type {any} */ ({
      cwd, runId: "r1", testCmd: "python -m pytest", runner,
      config: { ...POR_DEFECTO, motor: { ...POR_DEFECTO.motor, grafo: "propio" } },
      log: { append: (type, payload, meta) => eventos.push({ type, payload, meta }) },
      aliasDe: () => "sonnet",
      llamar: async (p) => ({ ok: true, output: guion[p.agente].shift(), inputTokens: 1, outputTokens: 1, modelo: "claude-sonnet-4-6", proveedor: "anthropic" }),
    }));
    const t0 = Date.now();
    const r = await ciclo.ejecutar({ id: "T1", agente: "desarrollador-backend", prompt: "Implementa clasificar(n) y limitar(valor, maximo)", archivos: ["clasificar.py"] });
    const total = Date.now() - t0;

    assert.equal(r.estado.resultado, "exito", JSON.stringify(r.estado.revision));
    assert.equal(r.estado.rojo?.estado, "fallan", "sin implementación las pruebas fallan de verdad");
    assert.equal(r.estado.mutacion?.probadas, 10, "el tope por defecto: 10 de las 13 posibles");
    assert.equal(r.estado.mutacion?.puntuacion, 1, JSON.stringify(r.estado.mutacion?.sobrevivientes));
    assert.equal(r.estado.mutacion?.noConcluyentes, 0);
    assert.equal(r.estado.mutacion?.fueraDeLoCambiado, undefined, "el archivo es nuevo: se altera entero");
    assert.equal(readFileSync(join(cwd, "clasificar.py"), "utf8"), PY);
    const nodo = (nombre) => eventos.find((x) => x.type === "ciclo:nodo_completado" && x.payload.nodo === nombre)?.payload.durationMs;
    console.log(`  Python, ciclo con Docker real: tarea entera ${total} ms · nodo sandbox ${nodo("sandbox")} ms · nodo mutacion ${nodo("mutacion")} ms (línea base + 10 alteraciones)`);
  });
});
