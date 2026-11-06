// @ts-check
/**
 * Spec 2026-10-27-flujo-nativo-de-ia: CA-006-01, CA-006-02
 * Métricas del flujo (spec 2026-10-27-flujo-nativo-de-ia): éxito al primer intento, reintentos, tiempo por tarea y gasto.
 * Puras: reciben lo que ya registran `CicloVerificado.resumen()`, `.sdd/events.jsonl` y `LibroDeGasto.total()`.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { calcularMetricas, lineasMetricas } from "../core/ciclo/metricas.js";

const tarea = (taskId, resultado, iteracion) => ({ taskId, resultado, iteracion });
const ev = (type, taskId, ts) => ({ id: `${taskId}-${type}`, type, taskId, ts, payload: {} });

describe("ciclo/metricas — calcularMetricas", () => {
  test("sin datos todo es cero y la tasa es null, no 0", () => {
    const m = calcularMetricas({ tareas: [], eventos: [], gasto: null });
    assert.equal(m.total, 0);
    assert.equal(m.tasaPrimerIntento, null);
    assert.equal(m.tiempoMedioMs, null);
    assert.equal(m.gasto, null);
  });

  test("éxito al primer intento: solo cuenta 'exito' con iteración ≤ 1", () => {
    const m = calcularMetricas({
      tareas: [tarea("T1", "exito", 1), tarea("T2", "exito", 3), tarea("T3", "exito", 0), tarea("T4", "abortada", 2)],
      eventos: [], gasto: null,
    });
    assert.equal(m.terminadas, 4);
    assert.equal(m.exito, 3);
    assert.equal(m.exitoPrimerIntento, 2);
    assert.equal(m.tasaPrimerIntento, 0.5);
    assert.equal(m.abortadas, 1);
  });

  test("las tareas en curso o en revisión no entran en la tasa", () => {
    const m = calcularMetricas({
      tareas: [tarea("T1", "exito", 1), tarea("T2", "en_curso", 1), tarea("T3", "revision_pendiente", 2)],
      eventos: [], gasto: null,
    });
    assert.equal(m.terminadas, 1);
    assert.equal(m.enRevision, 1);
    assert.equal(m.enCurso, 1);
    assert.equal(m.tasaPrimerIntento, 1);
  });

  test("reintentos: suma de (iteración − 1) sin bajar de cero", () => {
    const m = calcularMetricas({ tareas: [tarea("T1", "exito", 3), tarea("T2", "exito", 1), tarea("T3", "exito", 0)], eventos: [], gasto: null });
    assert.equal(m.reintentos, 2);
  });

  test("tiempo medio: de task_started a task_completed de la misma tarea; ignora lo incompleto", () => {
    const m = calcularMetricas({
      tareas: [],
      eventos: [
        ev("task_started", "T1", "2026-10-27T10:00:00.000Z"), ev("task_completed", "T1", "2026-10-27T10:00:10.000Z"),
        ev("task_started", "T2", "2026-10-27T10:00:00.000Z"), ev("task_completed", "T2", "2026-10-27T10:00:30.000Z"),
        ev("task_started", "T3", "2026-10-27T10:00:00.000Z"),
        ev("task_completed", "T4", "2026-10-27T10:00:00.000Z"),
        ev("task_started", "T5", "no es una fecha"), ev("task_completed", "T5", "2026-10-27T10:00:00.000Z"),
      ],
      gasto: null,
    });
    assert.equal(m.tiempoMedioMs, 20_000);
    assert.equal(m.tareasConTiempo, 2);
  });

  test("una tarea reiniciada usa el último task_started", () => {
    const m = calcularMetricas({
      tareas: [],
      eventos: [
        ev("task_started", "T1", "2026-10-27T10:00:00.000Z"),
        ev("task_started", "T1", "2026-10-27T10:05:00.000Z"), ev("task_completed", "T1", "2026-10-27T10:05:04.000Z"),
      ],
      gasto: null,
    });
    assert.equal(m.tiempoMedioMs, 4_000);
  });

  test("el gasto se copia tal cual", () => {
    const m = calcularMetricas({ tareas: [], eventos: [], gasto: { usd: 0.25, llamadas: 7 } });
    assert.deepEqual(m.gasto, { usd: 0.25, llamadas: 7 });
  });

  test("entradas hostiles no lanzan", () => {
    const m = calcularMetricas({ tareas: [null, {}, { taskId: 1 }], eventos: [null, {}, { type: "task_started" }], gasto: "x" });
    assert.equal(m.total, 3);
    assert.equal(m.gasto, null);
  });
});

describe("ciclo/metricas — lineasMetricas", () => {
  test("sin tareas no muestra nada", () => {
    assert.deepEqual(lineasMetricas(calcularMetricas({ tareas: [], eventos: [], gasto: null })), []);
  });

  test("muestra tasa, reintentos y tiempo, y dice cuando no hay tiempo medido", () => {
    const texto = lineasMetricas(calcularMetricas({ tareas: [tarea("T1", "exito", 1), tarea("T2", "exito", 2)], eventos: [], gasto: null })).join("\n");
    assert.match(texto, /primer intento: 1 de 2 \(50 %\)/);
    assert.match(texto, /reintentos: 1/);
    assert.match(texto, /tiempo medio por tarea: sin medir/);
  });
});

describe("ciclo/metricas — valores no numéricos (revisión independiente)", () => {
  test("una iteración ausente o infinita no rompe los totales", () => {
    const m = calcularMetricas({ tareas: [{ taskId: "A", resultado: "exito" }, { taskId: "B", resultado: "exito", iteracion: Infinity }, tarea("C", "exito", 2)], eventos: [], gasto: { usd: NaN, llamadas: 1 } });
    assert.ok(Number.isFinite(m.reintentos));
    assert.equal(m.reintentos, 1);
    assert.equal(m.gasto, null);
  });
});
