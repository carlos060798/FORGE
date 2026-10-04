// @ts-check
/**
 * T027 / T035 — Los dos motores del ciclo (ADR-01): el propio y LangGraph.js.
 * Deben comportarse igual y poder reanudar lo que empezó el otro.
 * Las pruebas de LangGraph se saltan si la dependencia opcional no se puede cargar.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { CicloVerificado } from "../core/ciclo/index.js";
import { leerConfigCiclo, POR_DEFECTO } from "../core/ciclo/config.js";
import { elegirMotor } from "../core/ciclo/motores/index.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const hayLangGraph = (await elegirMotor("langgraph")).nombre === "langgraph";
const SIN_LG = !hayLangGraph && "LangGraph.js no está instalado o esta versión de Node no lo admite";

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
  test("propio siempre está disponible", async () => {
    assert.equal((await elegirMotor("propio")).nombre, "propio");
  });

  test("auto usa LangGraph.js si se puede cargar y, si no, el propio sin avisar", async () => {
    const avisos = [];
    const m = await elegirMotor("auto", (a) => avisos.push(a));
    assert.equal(m.nombre, hayLangGraph ? "langgraph" : "propio");
    assert.deepEqual(avisos, []);
  });

  test("la configuración admite auto, langgraph y propio, y rechaza otro valor", () => {
    const dir = mkdtempSync(join(tmpdir(), "forge-motores-cfg-"));
    mkdirSync(join(dir, ".sdd"));
    assert.equal(leerConfigCiclo(dir).motor.grafo, process.env.FORGE_MOTOR_GRAFO ?? "auto");
    writeFileSync(join(dir, ".sdd", "sdd.config.yaml"), "motor:\n  grafo: neuronal\n");
    if (!process.env.FORGE_MOTOR_GRAFO) assert.throws(() => leerConfigCiclo(dir), /motor\.grafo desconocido/);
  });
});

for (const grafo of ["propio", "langgraph"]) {
  describe(`motor ${grafo}`, { skip: grafo === "langgraph" && SIN_LG }, () => {
    test("corrige hasta pasar y registra cada nodo", async () => {
      const e = entorno(grafo, [FALLA, FALLA, PASA]);
      const r = await e.ciclo().ejecutar(TAREA);
      assert.equal(r.motor, grafo);
      assert.equal(r.status, "completada");
      assert.equal(r.estado.iteracion, 2);
      assert.equal(readFileSync(join(e.cwd, "src", "suma.js"), "utf8"), "// v2");
      const nodos = e.eventos.filter((x) => x.type === "ciclo:nodo_completado").map((x) => x.payload.nodo);
      assert.deepEqual(nodos, ["planner", "retriever", "qa", "coder", "sandbox", "coder", "sandbox"]);
    });

    test("se pausa tras 5 fallos, no gasta sin decisión y abortar restaura", async () => {
      const e = entorno(grafo, [FALLA, FALLA, FALLA, FALLA, FALLA, FALLA]);
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
      const e = entorno(grafo, [FALLA, ...Array(5).fill(FALLA), ...Array(11).fill(FALLA), PASA]);
      await e.ciclo().ejecutar(TAREA);
      const r = await e.ciclo().ejecutar(TAREA, { decision: "continuar", iteracionesExtra: 12 });
      assert.equal(r.status, "completada");
      assert.equal(r.estado.iteracion, 17);
    });

    test("un error dentro de un nodo se propaga y la tarea se reanuda sin repetir llamadas", async () => {
      const e = entorno(grafo, [FALLA]);
      await assert.rejects(e.ciclo().ejecutar(TAREA), /guion de ejecuciones agotado/);
      const antes = e.llamadas();
      e.cola.push(PASA);
      const r = await e.ciclo().ejecutar(TAREA);
      assert.equal(r.status, "completada");
      assert.equal(e.llamadas(), antes);
    });
  });
}

describe("los dos motores comparten puntos de guardado", { skip: SIN_LG }, () => {
  for (const [primero, segundo] of [["propio", "langgraph"], ["langgraph", "propio"]]) {
    test(`una tarea pausada con ${primero} se reanuda con ${segundo}`, async () => {
      const e = entorno(primero, [FALLA, FALLA, FALLA, FALLA, FALLA, FALLA, PASA]);
      assert.equal((await e.ciclo().ejecutar(TAREA)).status, "en_revision");

      e.opciones.config = { ...POR_DEFECTO, motor: { ...POR_DEFECTO.motor, grafo: segundo } };
      const r = await e.ciclo().ejecutar(TAREA, { decision: "continuar", iteracionesExtra: 1 });
      assert.equal(r.motor, segundo);
      assert.equal(r.status, "completada");
      assert.equal(r.estado.iteracion, 6);
    });
  }
});

describe("la suite completa del ciclo pasa con LangGraph.js", { skip: SIN_LG }, () => {
  test("tests/ciclo-motor.test.js y tests/e2e/ciclo-flow.test.js con FORGE_MOTOR_GRAFO=langgraph", () => {
    // Node marca a sus procesos hijos de prueba con NODE_TEST_CONTEXT; un `node --test` anidado que lo
    // hereda no ejecuta nada y sale con 0. Sin quitarlo, este test pasaría siempre.
    const env = { ...process.env, FORGE_MOTOR_GRAFO: "langgraph", FORGE_TEST_DOCKER: "" };
    delete env.NODE_TEST_CONTEXT;

    const r = spawnSync(process.execPath, ["--test", "tests/ciclo-motor.test.js", "tests/e2e/ciclo-flow.test.js"], { cwd: ROOT, encoding: "utf8", env });
    // Node 20 imprime TAP ("# tests 47") y Node 22 el formato spec; se aceptan los dos
    const cifra = (nombre) => Number(new RegExp("^(?:ℹ|#) " + nombre + " (\\d+)", "m").exec(r.stdout)?.[1] ?? 0);
    const total = cifra("tests");
    const pasan = cifra("pass");
    assert.ok(total >= 40, `la suite anidada no se ejecutó (tests: ${total})`);
    assert.equal(r.status, 0, r.stdout.split("\n").filter((l) => /✖|not ok|fail /.test(l)).join("\n"));
    assert.ok(pasan >= 40, `pasan ${pasan}`);
  });
});
