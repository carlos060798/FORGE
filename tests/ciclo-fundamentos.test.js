// @ts-check
/**
 * Fase A del ciclo verificado (spec 2026-10-03-ciclo-verificado):
 * T003 estado, T004 configuración, T005 eventos, T007 argumentos del CLI.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { aplicar, estadoInicial, validarEstado } from "../core/ciclo/estado.js";
import { leerConfigCiclo, leerSeccion, POR_DEFECTO } from "../core/ciclo/config.js";
import { EventLog } from "../core/event-log.js";
import { parseArgs } from "../core/engine-cli.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function proyecto(yaml) {
  const dir = mkdtempSync(join(tmpdir(), "forge-ciclo-"));
  mkdirSync(join(dir, ".sdd"), { recursive: true });
  if (yaml !== undefined) writeFileSync(join(dir, ".sdd", "sdd.config.yaml"), yaml);
  return dir;
}

const TAREA = { id: "T018", agente: "desarrollador-backend", prompt: "## T018 — Router", cubre_cas: ["CA-001-01"] };

describe("T003 — EstadoCiclo", () => {
  test("estadoInicial produce un estado válido con los valores por defecto", () => {
    const e = estadoInicial(TAREA, { runId: "r1", cwd: "/proy" });
    assert.deepEqual(validarEstado(e), []);
    assert.equal(e.threadId, "r1:T018");
    assert.equal(e.maxIteraciones, 5);
    assert.equal(e.presupuesto.tope_usd, 2);
    assert.equal(e.presupuesto.umbral_degradacion_usd, 1.5);
    assert.equal(e.tarea.descripcion, "## T018 — Router");
    assert.deepEqual(e.tarea.cas, ["CA-001-01"]);
    assert.equal(e.resultado, "en_curso");
  });

  test("aplicar acumula ejecuciones y reemplaza el resto", () => {
    const e0 = estadoInicial(TAREA, { runId: "r1", cwd: "/proy" });
    const ej = { iteracion: 1, categoria: "fail", exitCode: 1, timedOut: false, oomKilled: false, durationMs: 5, stdoutCola: "", stderrCola: "" };
    const e1 = aplicar(e0, { ejecuciones: [/** @type {any} */ (ej)], iteracion: 1 });
    const e2 = aplicar(e1, { ejecuciones: [/** @type {any} */ ({ ...ej, iteracion: 2 })], iteracion: 2 });
    assert.equal(e2.ejecuciones.length, 2);
    assert.equal(e2.iteracion, 2);
    assert.equal(e0.ejecuciones.length, 0, "no muta el estado anterior");
  });

  test("validarEstado detecta valores fuera de catálogo", () => {
    const e = /** @type {any} */ (estadoInicial(TAREA, { runId: "r1", cwd: "/proy" }));
    e.resultado = "ganó";
    e.revision = { motivo: "capricho" };
    e.presupuesto.umbral_degradacion_usd = 9;
    e.ejecuciones = [{ categoria: "PASS" }];
    const errores = validarEstado(e);
    assert.equal(errores.length, 4, errores.join(" | "));
  });

  test("validarEstado rechaza lo que no es un objeto", () => {
    assert.equal(validarEstado(null).length, 1);
  });
});

describe("T004 — configuración del ciclo", () => {
  test("sin archivo de configuración, el modo es clasico", () => {
    const c = leerConfigCiclo(proyecto());
    assert.deepEqual(c, POR_DEFECTO);
    assert.equal(c.motor.modo, "clasico");
  });

  test("lee las tres secciones y convierte los números", () => {
    const dir = proyecto([
      "llm:",
      "  provider: stub",
      "motor:",
      "  modo: ciclo        # activado",
      "  max_iteraciones: 3",
      "sandbox:",
      "  memoria: 1g",
      "  timeout_s: 30",
      "presupuesto:",
      '  tope_usd: "5.00"',
      "  umbral_degradacion_usd: 4",
      "calidad:",
      "  max_iteraciones: 99",
    ].join("\n"));
    const c = leerConfigCiclo(dir);
    assert.equal(c.motor.modo, "ciclo");
    assert.equal(c.motor.max_iteraciones, 3);
    assert.equal(c.motor.contexto_max_bytes, 65536);
    assert.equal(c.sandbox.memoria, "1g");
    assert.equal(c.sandbox.timeout_s, 30);
    assert.equal(c.presupuesto.tope_usd, 5);
    assert.equal(c.presupuesto.umbral_degradacion_usd, 4);
  });

  test("el flag de línea de comandos manda sobre el archivo", () => {
    assert.equal(leerConfigCiclo(proyecto("motor:\n  modo: clasico\n"), { motor: "ciclo" }).motor.modo, "ciclo");
  });

  test("un modo desconocido es un error, no un valor silencioso", () => {
    assert.throws(() => leerConfigCiclo(proyecto("motor:\n  modo: turbo\n")), /motor\.modo desconocido/);
  });

  test("el umbral nunca supera el tope", () => {
    const c = leerConfigCiclo(proyecto("presupuesto:\n  tope_usd: 1\n"));
    assert.equal(c.presupuesto.umbral_degradacion_usd, 1);
  });

  test("leerSeccion acepta finales de línea de Windows", () => {
    assert.deepEqual(leerSeccion("motor:\r\n  modo: ciclo\r\notra:\r\n  x: 1\r\n", "motor"), { modo: "ciclo" });
  });

  test("la configuración de ejemplo declara las tres secciones con el modo clasico", () => {
    const yaml = readFileSync(join(ROOT, "configuracion-ejemplo", "sdd.config.yaml"), "utf8");
    assert.equal(leerSeccion(yaml, "motor").modo, "clasico");
    assert.equal(leerSeccion(yaml, "sandbox").timeout_s, "120");
    assert.equal(leerSeccion(yaml, "presupuesto").tope_usd, "2.00");
  });
});

describe("T005 — eventos del ciclo", () => {
  test("task_paused deja la tarea en revisión con su motivo", () => {
    const log = new EventLog(join(proyecto(), ".sdd"));
    log.append("task_started", { taskId: "T1" }, { taskId: "T1" });
    log.append("ciclo:nodo_completado", { nodo: "coder" }, { taskId: "T1" });
    log.append("task_paused", { motivo: "iteraciones" }, { taskId: "T1" });
    assert.deepEqual(log.replayTaskStates().get("T1"), { estado: "en_revision", motivo: "iteraciones" });
  });

  test("una tarea reanudada y completada deja de estar en revisión", () => {
    const log = new EventLog(join(proyecto(), ".sdd"));
    log.append("task_paused", { motivo: "presupuesto" }, { taskId: "T1" });
    log.append("ciclo:revision_decidida", { decision: "continuar" }, { taskId: "T1" });
    log.append("task_started", {}, { taskId: "T1" });
    log.append("task_completed", {}, { taskId: "T1" });
    assert.equal(log.replayTaskStates().get("T1")?.estado, "completada");
  });

  test("los eventos del ciclo no alteran el estado de la tarea por sí solos", () => {
    const log = new EventLog(join(proyecto(), ".sdd"));
    log.append("task_started", {}, { taskId: "T1" });
    log.append("ciclo:ejecucion", { categoria: "fail" }, { taskId: "T1" });
    log.append("ciclo:presupuesto_degradado", {}, { taskId: "T1" });
    assert.equal(log.replayTaskStates().get("T1")?.estado, "en_progreso");
  });
});

describe("T007 — parseArgs", () => {
  const args = (...a) => parseArgs(["node", "engine-cli.js", ...a]);

  test("pares clave-valor como hasta ahora", () => {
    assert.deepEqual(args("run", "--cwd", "/p", "--tasks", "t.json"), { command: "run", flags: { cwd: "/p", tasks: "t.json" } });
  });

  test("un flag sin valor no se come al siguiente", () => {
    assert.deepEqual(args("run", "--force", "--motor", "ciclo").flags, { force: "true", motor: "ciclo" });
  });

  test("un flag sin valor al final vale true", () => {
    assert.deepEqual(args("resume", "--decision", "abortar", "--force").flags, { decision: "abortar", force: "true" });
  });

  test("sin argumentos, el comando es status", () => {
    assert.deepEqual(args(), { command: "status", flags: {} });
  });
});
