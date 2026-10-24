// @ts-check
/**
 * F3.4 de `2026-10-14-puertas-de-calidad-y-evidencia`: regresión del ciclo completo, con el Docker falso
 * (tests/fixtures/forge-docker-falso.mjs) y el modelo guionizado (tests/fixtures/ciclo-guionizado.mjs), por
 * el mismo `forge run` que usan los cortes reales.
 *
 *  - Sin sección `puertas:`, el ciclo termina igual que antes: los mismos nodos, las tres llamadas pagadas y
 *    nada detrás.
 *  - Con puertas que pasan, la tarea termina igual, y cada puerta corre tras las pruebas.
 *  - Con una puerta que falla, la tarea no se aprueba: el implementador vuelve a trabajar y, sin topes, la
 *    tarea queda en revisión humana.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { comprobarFinal, ejecutar, escenario, estadoDeTarea, eventos, gasto, lineas, LLAMADAS_DEL_CICLO, puntos } from "./fixtures/ciclo-guionizado.mjs";

const RUN = ["run", "--tasks", "tareas.json", "--motor", "ciclo"];
const NODOS_DE_UN_CICLO = ["planner", "retriever", "qa", "coder", "sandbox", "mutacion"];
const PASA = 'node -e "process.exit(0)"';
const FALLA = 'node -e "process.exit(1)"';

/**
 * Sustituye la configuración del escenario por otra con la sección `puertas:` (el motor, igual que escenario()).
 * @param {ReturnType<typeof escenario>} e @param {string[]} puertas @param {{ maxIteraciones?: number }} [o]
 */
function configurar(e, puertas, o = {}) {
  writeFileSync(join(e.dir, ".sdd", "sdd.config.yaml"), [
    "motor:", "  mutacion: informar", "  mutacion_max: 3", `  max_iteraciones: ${o.maxIteraciones ?? 5}`,
    "puertas:", ...puertas.map((p) => `  ${p}`),
  ].join("\n") + "\n");
}

describe("ciclo completo con puertas declaradas (F3.4)", () => {
  test("sin sección puertas: el ciclo termina como antes, con las tres llamadas pagadas y sin dejar nada detrás", async () => {
    const e = escenario();
    const r = await ejecutar(e, RUN);
    assert.equal(r.codigo, 0, r.salida);
    comprobarFinal(e);
    assert.deepEqual(puntos(e).map((p) => p.nodo), NODOS_DE_UN_CICLO);
    assert.equal(lineas(e.docker).filter((l) => l.orden === "run" && /puerta/.test(String(l.nombre))).length, 0, "sin puertas no corre ninguna");
  });

  test("puertas que pasan: la tarea termina igual, y cada puerta corre tras las pruebas", async () => {
    const e = escenario();
    configurar(e, [`tipos: ${PASA}`, `linter: ${PASA}`]);
    const r = await ejecutar(e, RUN);
    assert.equal(r.codigo, 0, r.salida);
    comprobarFinal(e);
    assert.deepEqual(puntos(e).map((p) => p.nodo), NODOS_DE_UN_CICLO);
    const puertas = lineas(e.docker).filter((l) => l.orden === "run" && /puerta/.test(String(l.nombre)));
    assert.equal(puertas.length, 2, JSON.stringify(puertas));
  });

  test("una puerta que falla: la tarea no se aprueba, el implementador vuelve a trabajar y la tarea queda en revisión", async () => {
    const e = escenario();
    configurar(e, [`tipos: ${FALLA}`], { maxIteraciones: 2 });
    const r = await ejecutar(e, RUN);
    assert.notEqual(r.codigo, 0, "no termina con éxito");
    assert.equal(estadoDeTarea(e), "en_revision", "una puerta que falla no aprueba la tarea: queda en revisión al agotar los intentos");
    // Dos ejecuciones fallidas (una por intento), cada una de la puerta, y el implementador escribió en cada una:
    // planificador, pruebas y dos implementaciones
    const ejecuciones = eventos(e).filter((ev) => ev.type === "ciclo:ejecucion");
    assert.deepEqual(ejecuciones.map((ev) => ev.payload.categoria), ["fail", "fail"]);
    assert.equal(gasto(e).length, LLAMADAS_DEL_CICLO + 1, `llamadas pagadas: ${JSON.stringify(gasto(e))}`);
  });
});
