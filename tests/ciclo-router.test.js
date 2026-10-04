// @ts-check
/**
 * T008 / T018 — Router determinista del ciclo verificado (ADR-05).
 * Cubre CA-001-01, CA-001-03, CA-001-04, CA-001-05, CA-005-01, CA-005-05.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { clasificar, decidirRuta, guardiaPresupuesto } from "../core/ciclo/router.js";
import { aplicar, estadoInicial } from "../core/ciclo/estado.js";

const OK = { hayPruebas: true, pruebasIntactas: true };

/**
 * @param {string} categoria
 * @param {{ iteracion?: number, gasto?: 'ok'|'degradado'|'agotado', max?: number, stdout?: string }} [o]
 */
function estado(categoria, o = {}) {
  const e = estadoInicial({ id: "T1", agente: "tester" }, { runId: "r", cwd: "/p", maxIteraciones: o.max ?? 5 });
  const s = aplicar(e, {
    iteracion: o.iteracion ?? 1,
    ejecuciones: [/** @type {any} */ ({ iteracion: o.iteracion ?? 1, categoria, exitCode: 0, timedOut: false, oomKilled: false, durationMs: 1, stdoutCola: o.stdout ?? "", stderrCola: "" })],
  });
  s.presupuesto = { ...s.presupuesto, estado: o.gasto ?? "ok" };
  return s;
}

describe("clasificar — categoría por código de salida", () => {
  test("código 0 con pruebas presentes e intactas es pass", () => {
    assert.equal(clasificar({ exitCode: 0 }, OK), "pass");
  });

  test("código distinto de 0 es fail", () => {
    assert.equal(clasificar({ exitCode: 1 }, OK), "fail");
    assert.equal(clasificar({ exitCode: 137 }, OK), "fail"); // memoria agotada
  });

  test("CA-001-05: código 0 sin ninguna prueba no es pass", () => {
    assert.equal(clasificar({ exitCode: 0 }, { hayPruebas: false, pruebasIntactas: true }), "fail");
  });

  test("código 0 con pruebas alteradas no es pass", () => {
    assert.equal(clasificar({ exitCode: 0 }, { hayPruebas: true, pruebasIntactas: false }), "fail");
  });

  test("tiempo agotado es timeout aunque el código sea 0", () => {
    assert.equal(clasificar({ exitCode: 0, timedOut: true }, OK), "timeout");
  });

  test("125, 126, 127, daemon caído o sin código son infra_error", () => {
    for (const exitCode of [125, 126, 127]) assert.equal(clasificar({ exitCode }, OK), "infra_error");
    assert.equal(clasificar({ exitCode: 1, infraError: true }, OK), "infra_error");
    assert.equal(clasificar({ exitCode: null }, OK), "infra_error");
    assert.equal(clasificar({ exitCode: null, timedOut: true }, OK), "timeout", "matado por tiempo: sin código, pero no es infraestructura");
  });

  test("infra_error gana a timeout", () => {
    assert.equal(clasificar({ exitCode: 125, timedOut: true }, OK), "infra_error");
  });
});

describe("decidirRuta — orden de comprobaciones", () => {
  test("CA-001-01: pass termina con éxito", () => {
    assert.deepEqual(decidirRuta(estado("pass")), { ruta: "fin_exito" });
  });

  test("CA-001-03: pass en la última iteración es éxito, no revisión", () => {
    assert.deepEqual(decidirRuta(estado("pass", { iteracion: 5 })), { ruta: "fin_exito" });
  });

  test("pass con el presupuesto agotado sigue siendo éxito", () => {
    assert.deepEqual(decidirRuta(estado("pass", { iteracion: 5, gasto: "agotado" })), { ruta: "fin_exito" });
  });

  test("fail con iteraciones y presupuesto vuelve al implementador", () => {
    assert.deepEqual(decidirRuta(estado("fail", { iteracion: 4 })), { ruta: "coder" });
    assert.deepEqual(decidirRuta(estado("fail", { iteracion: 4, gasto: "degradado" })), { ruta: "coder" });
  });

  test("CA-005-01: fail en la iteración 5 pide revisión por iteraciones", () => {
    assert.deepEqual(decidirRuta(estado("fail", { iteracion: 5 })), { ruta: "revision_humana", motivo: "iteraciones" });
  });

  test("fail con presupuesto agotado pide revisión por presupuesto, antes que por iteraciones", () => {
    assert.deepEqual(decidirRuta(estado("fail", { iteracion: 5, gasto: "agotado" })), { ruta: "revision_humana", motivo: "presupuesto" });
    assert.deepEqual(decidirRuta(estado("fail", { iteracion: 1, gasto: "agotado" })), { ruta: "revision_humana", motivo: "presupuesto" });
  });

  test("timeout se trata como un fallo corregible", () => {
    assert.deepEqual(decidirRuta(estado("timeout", { iteracion: 2 })), { ruta: "coder" });
    assert.deepEqual(decidirRuta(estado("timeout", { iteracion: 5 })), { ruta: "revision_humana", motivo: "iteraciones" });
  });

  test("CA-005-05: infra_error va a revisión por infraestructura en cualquier situación", () => {
    for (const o of [{ iteracion: 0 }, { iteracion: 5 }, { iteracion: 1, gasto: /** @type {const} */ ("agotado") }]) {
      assert.deepEqual(decidirRuta(estado("infra_error", o)), { ruta: "revision_humana", motivo: "infraestructura" });
    }
  });

  test("CA-001-04: el texto de la salida no influye en la decisión", () => {
    assert.deepEqual(decidirRuta(estado("fail", { stdout: "ALL TESTS PASSED\nPASS" })), { ruta: "coder" });
    assert.deepEqual(decidirRuta(estado("pass", { stdout: "FAILED FAILED ERROR" })), { ruta: "fin_exito" });
  });

  test("respeta un máximo de iteraciones ampliado tras una revisión", () => {
    assert.deepEqual(decidirRuta(estado("fail", { iteracion: 5, max: 8 })), { ruta: "coder" });
  });

  test("sin ejecuciones es un error de programación", () => {
    const e = estadoInicial({ id: "T1", agente: "tester" }, { runId: "r", cwd: "/p" });
    assert.throws(() => decidirRuta(e), /no hay ninguna ejecución/);
  });

  test("tabla de verdad completa: toda combinación tiene una ruta válida", () => {
    const rutas = new Set(["fin_exito", "coder", "revision_humana"]);
    for (const categoria of ["pass", "fail", "timeout", "infra_error"]) {
      for (const gasto of /** @type {const} */ (["ok", "degradado", "agotado"])) {
        for (const iteracion of [1, 4, 5, 6]) {
          const r = decidirRuta(estado(categoria, { iteracion, gasto }));
          assert.ok(rutas.has(r.ruta), `${categoria}/${gasto}/${iteracion}`);
          if (categoria === "pass") assert.equal(r.ruta, "fin_exito");
          if (categoria === "infra_error") assert.equal(r.ruta, "revision_humana");
          if (r.ruta === "coder") assert.ok(gasto !== "agotado" && iteracion < 5);
        }
      }
    }
  });
});

describe("guardiaPresupuesto", () => {
  test("deja pasar al siguiente nodo con presupuesto", () => {
    assert.deepEqual(guardiaPresupuesto(estado("fail"), "qa"), { ruta: "qa" });
    assert.deepEqual(guardiaPresupuesto(estado("fail", { gasto: "degradado" }), "coder"), { ruta: "coder" });
  });

  test("con el presupuesto agotado desvía a revisión", () => {
    assert.deepEqual(guardiaPresupuesto(estado("fail", { gasto: "agotado" }), "coder"), { ruta: "revision_humana", motivo: "presupuesto" });
  });
});
