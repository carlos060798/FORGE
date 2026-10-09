// @ts-check
/**
 * Regresión de los hallazgos de las primeras ejecuciones con un modelo real
 * (.sdd/especificaciones/2026-10-09-validacion-modelo-real/evidencia-2026-10-09.md).
 *
 *  H1  Un proyecto Python con pytest en requirements.txt se probaba con unittest y no encontraba pruebas.
 *  H2  «Ninguna prueba ejecutada» gastaba todas las iteraciones como si fuera culpa del implementador.
 *  H3  El implementador devolvía también las pruebas.
 *  H4  No se podía limitar el nivel de modelo sin editar los agentes.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { detectStack } from "../core/stack-detector.js";
import { createPythonRunner } from "../core/runners/python-runner.js";
import { clasificar, sinPruebasEjecutadas } from "../core/ciclo/router.js";
import { limitarNivel } from "../core/ciclo/presupuesto.js";
import { leerConfigCiclo, POR_DEFECTO } from "../core/ciclo/config.js";
import { CONTRATO_CODER, CONTRATO_QA } from "../core/ciclo/contratos.js";
import { seccionProyecto } from "../core/ciclo/nodos.js";
import { CicloVerificado } from "../core/ciclo/index.js";

const tmp = (p) => mkdtempSync(join(tmpdir(), p));
const escribir = (dir, ruta, contenido) => { mkdirSync(join(dir, ruta, ".."), { recursive: true }); writeFileSync(join(dir, ruta), contenido); };

describe("H1 — pytest declarado fuera de pyproject.toml", () => {
  for (const [archivo, contenido] of [
    ["requirements.txt", "requests\npytest>=8\n"],
    ["requirements-dev.txt", "pytest\n"],
    ["setup.cfg", "[tool:pytest]\ntestpaths = tests\n"],
    ["tox.ini", "[pytest]\n"],
    ["conftest.py", ""],
  ]) {
    test(`${archivo} con pytest → python -m pytest`, () => {
      const cwd = tmp("forge-vmr-py-");
      escribir(cwd, "requirements.txt", "requests\n");
      escribir(cwd, archivo, contenido);
      assert.equal(detectStack(cwd).test_cmd, "python -m pytest");
      assert.equal(createPythonRunner(cwd).testCmd, "python -m pytest");
    });
  }

  test("sin ninguna mención de pytest se mantiene unittest", () => {
    const cwd = tmp("forge-vmr-py-");
    escribir(cwd, "requirements.txt", "requests\n");
    assert.equal(detectStack(cwd).test_cmd, "python -m unittest discover");
    assert.equal(createPythonRunner(cwd).testCmd, "python -m unittest discover");
  });
});

describe("H2 — ninguna prueba ejecutada no es un fallo del implementador", () => {
  test("código 5 con pytest o unittest: sin pruebas; con otros comandos o códigos, no", () => {
    assert.equal(sinPruebasEjecutadas({ exitCode: 5 }, "python -m pytest"), true);
    assert.equal(sinPruebasEjecutadas({ exitCode: 5 }, "python -m unittest discover"), true);
    assert.equal(sinPruebasEjecutadas({ exitCode: 5 }, "pytest -q"), true);
    assert.equal(sinPruebasEjecutadas({ exitCode: 5 }, "npm test"), false, "en otros ejecutores el 5 no significa eso");
    assert.equal(sinPruebasEjecutadas({ exitCode: 5 }, "go test ./..."), false);
    assert.equal(sinPruebasEjecutadas({ exitCode: 1 }, "python -m pytest"), false);
    assert.equal(sinPruebasEjecutadas({ exitCode: 2 }, "python -m pytest"), false, "un error de importación es rojo legítimo");
    assert.equal(sinPruebasEjecutadas({ exitCode: 5, timedOut: true }, "python -m pytest"), false);
    assert.equal(sinPruebasEjecutadas({ exitCode: 5, infraError: true }, "python -m pytest"), false);
    // La clasificación general no cambia
    assert.equal(clasificar({ exitCode: 5 }, { hayPruebas: true, pruebasIntactas: true }), "fail");
  });

  const PLAN = '{"pasos":["implementar"],"archivosObjetivo":["src/romanos.py"]}';
  const PRUEBAS = '```json\n{"archivos":[{"ruta":"tests/test_romanos.py","contenido":"def test_uno():\\n    assert True\\n"}]}\n```';
  const IMPL = '```json\n{"archivos":[{"ruta":"src/romanos.py","contenido":"def a_romano(n):\\n    return \\"I\\"\\n"}]}\n```';
  const TAREA = { id: "T1", agente: "desarrollador-backend", prompt: "Implementa a_romano", archivos: ["src/romanos.py"] };

  function entorno({ ejecuciones, testCmd = "python -m unittest discover", motor = {}, alias = "sonnet" }) {
    const cwd = tmp("forge-vmr-ciclo-");
    const cola = [...ejecuciones];
    const llamadas = [];
    const eventos = [];
    const guion = { arquitecto: [PLAN], tester: [PRUEBAS], "desarrollador-backend": [IMPL, IMPL, IMPL, IMPL, IMPL] };
    const opciones = {
      cwd, runId: "r1", testCmd,
      config: { ...POR_DEFECTO, motor: { ...POR_DEFECTO.motor, grafo: "propio", ...motor } },
      log: { append: (type, payload, meta) => eventos.push({ type, payload, meta }) },
      aliasDe: () => alias,
      llamar: async (p) => {
        llamadas.push(p);
        const s = guion[p.agente]?.shift();
        if (s === undefined) throw new Error(`guion agotado para ${p.agente}`);
        return { ok: true, output: s, inputTokens: 100, outputTokens: 10, modelo: "claude-sonnet-4-6", proveedor: "anthropic" };
      },
      runner: { test: async () => {
        const r = cola.shift();
        if (r === undefined) throw new Error("guion de ejecuciones agotado");
        return { stdout: "", stderr: "", timedOut: false, infraError: false, durationMs: 1, ...r };
      } },
    };
    return { llamadas, eventos, cola, ciclo: new CicloVerificado(/** @type {any} */ (opciones)) };
  }

  test("si las pruebas recién escritas no se encuentran, se pide revisión antes de pagar al implementador", async () => {
    const e = entorno({ ejecuciones: [{ exitCode: 5, stderr: "Ran 0 tests in 0.000s\n\nNO TESTS RAN\n" }] });
    const r = await e.ciclo.ejecutar(TAREA);
    assert.equal(r.estado.resultado, "revision_pendiente");
    assert.equal(r.estado.revision?.motivo, "infraestructura");
    assert.equal(r.estado.revision?.reanudarEn, "qa");
    assert.match(String(r.estado.revision?.detalle), /sin encontrar ninguna prueba/);
    assert.deepEqual(e.llamadas.map((l) => l.agente), ["arquitecto", "tester"], "el implementador no se llamó");
    assert.equal(r.estado.iteracion, 0);
  });

  test("si ocurre al ejecutar tras implementar, no consume iteraciones ni vuelve al implementador", async () => {
    // qa ve un rojo legítimo (error de importación, código 1) y la ejecución real no encuentra pruebas
    const e = entorno({ ejecuciones: [{ exitCode: 1 }, { exitCode: 5 }] });
    const r = await e.ciclo.ejecutar(TAREA);
    assert.equal(r.estado.resultado, "revision_pendiente");
    assert.equal(r.estado.revision?.motivo, "infraestructura");
    assert.equal(r.estado.iteracion, 0, "no cuenta como iteración");
    assert.equal(e.llamadas.filter((l) => l.agente === "desarrollador-backend").length, 1, "una sola llamada al implementador, no cinco");
    assert.equal(e.cola.length, 0);
    assert.ok(e.eventos.some((ev) => ev.type === "ciclo:ejecucion" && ev.payload.categoria === "sin_pruebas"));
  });

  test("un código 5 de otro ejecutor sigue siendo un fallo normal", async () => {
    const e = entorno({ testCmd: "npm test", ejecuciones: [{ exitCode: 1 }, { exitCode: 5 }, { exitCode: 0, stdout: "# tests 1\n# pass 1\n" }] });
    const r = await e.ciclo.ejecutar(TAREA);
    assert.equal(r.estado.resultado, "exito");
    assert.equal(r.estado.iteracion, 2);
  });

  describe("H4 — nivel máximo de modelo", () => {
    test("limitarNivel baja los niveles altos y no toca identificadores directos", () => {
      assert.equal(limitarNivel("opus", "haiku"), "haiku");
      assert.equal(limitarNivel("sonnet", "haiku"), "haiku");
      assert.equal(limitarNivel("opus", "sonnet"), "sonnet");
      assert.equal(limitarNivel("haiku", "sonnet"), "haiku", "nunca sube");
      assert.equal(limitarNivel("opus", "opus"), "opus");
      assert.equal(limitarNivel("opus", undefined), "opus");
      assert.equal(limitarNivel("mi-modelo-propio", "haiku"), "mi-modelo-propio");
    });

    test("con motor.nivel_maximo: haiku, todos los agentes se llaman con haiku", async () => {
      const e = entorno({ testCmd: "npm test", alias: "opus", motor: { nivel_maximo: "haiku" }, ejecuciones: [{ exitCode: 1 }, { exitCode: 0, stdout: "# tests 1\n# pass 1\n" }] });
      const r = await e.ciclo.ejecutar(TAREA);
      assert.equal(r.estado.resultado, "exito");
      assert.deepEqual([...new Set(e.llamadas.map((l) => l.modeloAlias))], ["haiku"]);
    });

    test("sin configurarlo, se respeta el nivel de cada agente", async () => {
      const e = entorno({ testCmd: "npm test", alias: "opus", ejecuciones: [{ exitCode: 1 }, { exitCode: 0, stdout: "# tests 1\n# pass 1\n" }] });
      await e.ciclo.ejecutar(TAREA);
      assert.deepEqual([...new Set(e.llamadas.map((l) => l.modeloAlias))], ["opus"]);
    });

    test("se lee de sdd.config.yaml y de FORGE_NIVEL_MAXIMO; un valor desconocido es un error claro", () => {
      const cwd = tmp("forge-vmr-cfg-");
      assert.equal(leerConfigCiclo(cwd).motor.nivel_maximo, "opus");
      escribir(cwd, ".sdd/sdd.config.yaml", "motor:\n  nivel_maximo: sonnet\n");
      assert.equal(leerConfigCiclo(cwd).motor.nivel_maximo, "sonnet");

      const previo = process.env.FORGE_NIVEL_MAXIMO;
      try {
        process.env.FORGE_NIVEL_MAXIMO = "haiku";
        assert.equal(leerConfigCiclo(cwd).motor.nivel_maximo, "haiku", "la variable de entorno manda");
        process.env.FORGE_NIVEL_MAXIMO = "gigante";
        assert.throws(() => leerConfigCiclo(cwd), /nivel_maximo desconocido/);
      } finally {
        if (previo === undefined) delete process.env.FORGE_NIVEL_MAXIMO; else process.env.FORGE_NIVEL_MAXIMO = previo;
      }
    });
  });
});

describe("H6 — los agentes reciben el tipo de módulos del proyecto", () => {
  test("un proyecto de módulos ES lo dice y prohíbe require", () => {
    const cwd = tmp("forge-vmr-proy-");
    escribir(cwd, "package.json", JSON.stringify({ type: "module", scripts: { test: "node --test" } }));
    const s = seccionProyecto(cwd);
    assert.match(s, /## Proyecto/);
    assert.match(s, /módulos ES/);
    assert.match(s, /Script de pruebas: node --test/);
    assert.match(s, /Sin dependencias instaladas/);
  });

  test("un proyecto CommonJS lo dice, con sus dependencias por nombre y sin versiones ni otros campos", () => {
    const cwd = tmp("forge-vmr-proy-");
    escribir(cwd, "package.json", JSON.stringify({ name: "x", config: { token: "NO-DEBE-SALIR" }, dependencies: { express: "^4" }, devDependencies: { jest: "^29" } }));
    const s = seccionProyecto(cwd);
    assert.match(s, /CommonJS/);
    assert.match(s, /express, jest/);
    assert.doesNotMatch(s, /NO-DEBE-SALIR|\^4/);
  });

  test("sin manifiesto, o con uno ilegible, no añade nada", () => {
    const cwd = tmp("forge-vmr-proy-");
    assert.equal(seccionProyecto(cwd), "");
    escribir(cwd, "package.json", "{ roto");
    assert.equal(seccionProyecto(cwd), "");
  });

  test("el contrato del agente de pruebas remite a esa sección y prohíbe escribir la implementación", () => {
    assert.match(CONTRATO_QA, /sección «Proyecto»/);
    assert.match(CONTRATO_QA, /No escribas la implementación/);
  });
});

describe("H6 y H7 — lo que reciben los agentes en el ciclo", () => {
  const bloque = (ruta, contenido) => "```json\n" + JSON.stringify({ archivos: [{ ruta, contenido }] }) + "\n```";
  const PLAN = JSON.stringify({ pasos: ["implementar"], archivosObjetivo: [] });
  const PRUEBAS = bloque("tests/calc.test.js", 'import { test } from "node:test";\ntest("x", () => {});\n');
  const impl = (n) => bloque("src/calc.js", `export const version = ${n};\n`);

  test("el agente de pruebas y el implementador reciben la sección Proyecto; el implementador, además, su versión anterior", async () => {
    const cwd = tmp("forge-vmr-h7-");
    escribir(cwd, "package.json", JSON.stringify({ type: "module", scripts: { test: "node --test" } }));
    const llamadas = [];
    const guion = { arquitecto: [PLAN], tester: [PRUEBAS], "desarrollador-backend": [impl(1), impl(2)] };
    const cola = [{ exitCode: 1 }, { exitCode: 1, stdout: "# fail 1\n" }, { exitCode: 0, stdout: "# tests 1\n# pass 1\n" }];
    const ciclo = new CicloVerificado(/** @type {any} */ ({
      cwd, runId: "r1", testCmd: "npm test",
      config: { ...POR_DEFECTO, motor: { ...POR_DEFECTO.motor, grafo: "propio" } },
      log: { append: () => {} },
      aliasDe: () => "sonnet",
      llamar: async (p) => { llamadas.push(p); return { ok: true, output: guion[p.agente].shift(), inputTokens: 1, outputTokens: 1, modelo: "claude-sonnet-4-6", proveedor: "anthropic" }; },
      runner: { test: async () => ({ stdout: "", stderr: "", timedOut: false, infraError: false, durationMs: 1, ...cola.shift() }) },
    }));
    const r = await ciclo.ejecutar({ id: "T1", agente: "desarrollador-backend", prompt: "Implementa calc" });
    assert.equal(r.estado.resultado, "exito");

    const [, tester, coder1, coder2] = llamadas;
    assert.match(tester.userPrompt, /## Proyecto[\s\S]*módulos ES/);
    assert.match(coder1.userPrompt, /## Proyecto[\s\S]*módulos ES/);
    assert.doesNotMatch(coder1.userPrompt, /Tu implementación actual/, "en el primer intento no hay versión anterior");
    assert.match(coder2.userPrompt, /## Tu implementación actual[\s\S]*### src\/calc\.js\nexport const version = 1;/);
  });
});

describe("H3 — el contrato del implementador", () => {
  test("pide no devolver los archivos de prueba", () => {
    assert.match(CONTRATO_CODER, /No incluyas en tu respuesta los archivos de prueba/);
  });
});
