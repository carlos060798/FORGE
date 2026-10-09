// @ts-check
/**
 * T027 / T035 — El motor del ciclo (ADR-01, ADR-18): el propio, sin dependencias.
 * LangGraph.js se retiró en 5.0.0; la preferencia `langgraph` sigue aceptándose, con un aviso.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { CicloVerificado } from "../core/ciclo/index.js";
import { leerConfigCiclo, POR_DEFECTO } from "../core/ciclo/config.js";
import { elegirMotor } from "../core/ciclo/motores/index.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const json = (o) => "```json\n" + JSON.stringify(o) + "\n```";
const TAREA = { id: "T1", agente: "desarrollador-backend", prompt: "Implementa suma", archivos: ["src/suma.js"] };
const USO = { inputTokens: 1000, outputTokens: 0, modelo: "claude-sonnet-4-6", proveedor: "anthropic" };

/** @param {string} grafo @param {any[]} ejecuciones */
function entorno(grafo, ejecuciones) {
  const cwd = mkdtempSync(join(tmpdir(), "forge-motores-"));
  mkdirSync(join(cwd, "src"));
  writeFileSync(join(cwd, "src", "suma.js"), "// original");
  const eventos = [];
  let llamadas = 0;
  let version = 0;
  const cola = [...ejecuciones];
  const opciones = {
    cwd, runId: "r1", testCmd: "npm test",
    config: { ...POR_DEFECTO, motor: { ...POR_DEFECTO.motor, grafo } },
    log: { append: (type, payload) => eventos.push({ type, payload }) },
    aliasDe: () => "sonnet",
    llamar: async ({ agente }) => {
      llamadas++;
      const salida = agente === "arquitecto" ? json({ pasos: [], archivosObjetivo: [] })
        : agente === "tester" ? json({ archivos: [{ ruta: "tests/suma.test.js", contenido: "// t" }] })
        : json({ archivos: [{ ruta: "src/suma.js", contenido: `// v${++version}` }] });
      return { ok: true, output: salida, ...USO };
    },
    runner: { test: async () => {
      const r = cola.shift();
      if (r === undefined) throw new Error("guion de ejecuciones agotado");
      return { stdout: "# pass 1\n", stderr: "", timedOut: false, infraError: false, durationMs: 1, ...r };
    } },
  };
  return { cwd, opciones, eventos, cola, llamadas: () => llamadas, ciclo: () => new CicloVerificado(opciones) };
}

const FALLA = { exitCode: 1 };
const PASA = { exitCode: 0 };

describe("elección del motor", () => {
  test("propio y auto dan el motor propio, sin avisar", async () => {
    for (const p of ["propio", "auto", undefined]) {
      const avisos = [];
      assert.equal((await elegirMotor(p, (a) => avisos.push(a))).nombre, "propio");
      assert.deepEqual(avisos, []);
    }
  });

  test("langgraph se acepta pero avisa de que se retiró y usa el propio", async () => {
    const avisos = [];
    const m = await elegirMotor("langgraph", (a) => avisos.push(a));
    assert.equal(m.nombre, "propio");
    assert.equal(avisos.length, 1);
    assert.match(avisos[0], /LangGraph\.js se retiró en 5\.0\.0/);
  });

  test("la configuración admite auto, propio y langgraph (en desuso), y rechaza otro valor", () => {
    const dir = mkdtempSync(join(tmpdir(), "forge-motores-cfg-"));
    mkdirSync(join(dir, ".sdd"));
    if (process.env.FORGE_MOTOR_GRAFO) return;
    assert.equal(leerConfigCiclo(dir).motor.grafo, "auto");
    writeFileSync(join(dir, ".sdd", "sdd.config.yaml"), "motor:\n  grafo: langgraph\n");
    assert.equal(leerConfigCiclo(dir).motor.grafo, "langgraph");
    writeFileSync(join(dir, ".sdd", "sdd.config.yaml"), "motor:\n  grafo: neuronal\n");
    assert.throws(() => leerConfigCiclo(dir), /motor\.grafo desconocido/);
  });

  test("LangGraph.js ya no es dependencia ni hay código que lo cargue", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    assert.ok(!pkg.optionalDependencies?.["@langchain/langgraph"]);
    assert.ok(!pkg.dependencies?.["@langchain/langgraph"]);
    assert.ok(!existsSync(join(ROOT, "core", "ciclo", "motores", "langgraph.js")));
  });
});

describe("motor propio", () => {
  test("corrige hasta pasar y registra cada nodo", async () => {
    const e = entorno("propio", [FALLA, FALLA, PASA]);
    const r = await e.ciclo().ejecutar(TAREA);
    assert.equal(r.motor, "propio");
    assert.equal(r.status, "completada");
    assert.equal(r.estado.iteracion, 2);
    assert.equal(readFileSync(join(e.cwd, "src", "suma.js"), "utf8"), "// v2");
    const nodos = e.eventos.filter((x) => x.type === "ciclo:nodo_completado").map((x) => x.payload.nodo);
    assert.deepEqual(nodos, ["planner", "retriever", "qa", "coder", "sandbox", "coder", "sandbox"]);
  });

  test("la preferencia langgraph de una configuración antigua funciona igual", async () => {
    const e = entorno("langgraph", [FALLA, PASA]);
    const r = await e.ciclo().ejecutar(TAREA);
    assert.equal(r.motor, "propio");
    assert.equal(r.status, "completada");
  });

  test("se pausa tras 5 fallos, no gasta sin decisión y abortar restaura", async () => {
    const e = entorno("propio", [FALLA, FALLA, FALLA, FALLA, FALLA, FALLA]);
    const r = await e.ciclo().ejecutar(TAREA);
    assert.equal(r.status, "en_revision");
    assert.equal(r.estado.revision?.motivo, "iteraciones");
    assert.equal(e.eventos.filter((x) => x.type === "task_paused").length, 1);

    const antes = e.llamadas();
    assert.equal((await e.ciclo().ejecutar(TAREA)).status, "en_revision");
    assert.equal(e.llamadas(), antes);

    const fin = await e.ciclo().ejecutar(TAREA, { decision: "abortar" });
    assert.equal(fin.status, "abortada");
    assert.equal(readFileSync(join(e.cwd, "src", "suma.js"), "utf8"), "// original");
  });

  test("continuar con más iteraciones sigue hasta pasar; más de 12 iteraciones no agotan el motor", async () => {
    const e = entorno("propio", [FALLA, ...Array(5).fill(FALLA), ...Array(11).fill(FALLA), PASA]);
    await e.ciclo().ejecutar(TAREA);
    const r = await e.ciclo().ejecutar(TAREA, { decision: "continuar", iteracionesExtra: 12 });
    assert.equal(r.status, "completada");
    assert.equal(r.estado.iteracion, 17);
  });

  test("un error dentro de un nodo se propaga y la tarea se reanuda sin repetir llamadas", async () => {
    const e = entorno("propio", [FALLA]);
    await assert.rejects(e.ciclo().ejecutar(TAREA), /guion de ejecuciones agotado/);
    const antes = e.llamadas();
    e.cola.push(PASA);
    const r = await e.ciclo().ejecutar(TAREA);
    assert.equal(r.status, "completada");
    assert.equal(e.llamadas(), antes);
  });
});
