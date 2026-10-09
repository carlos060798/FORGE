// @ts-check
/**
 * Detección de «sin progreso» en el ciclo verificado (hallazgo H8 de
 * .sdd/especificaciones/2026-10-09-validacion-modelo-real/evidencia-2026-10-09.md).
 *
 * Unas pruebas rotas por sí mismas hacían que el ciclo repitiera hasta el tope de
 * iteraciones con la misma salida, pagando cada vez. Ahora, N ejecuciones fallidas
 * seguidas con la misma salida pausan la tarea con el motivo `sin_progreso`.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { huellaDeSalida, normalizarSalida } from "../core/ciclo/huella.js";
import { decidirRuta, sinProgreso } from "../core/ciclo/router.js";
import { estadoInicial, MOTIVOS, validarEstado } from "../core/ciclo/estado.js";
import { transicion } from "../core/ciclo/grafo.js";
import { leerConfigCiclo, POR_DEFECTO } from "../core/ciclo/config.js";
import { CicloVerificado } from "../core/ciclo/index.js";

const tmp = (p) => mkdtempSync(join(tmpdir(), p));

describe("normalizarSalida — quita lo que cambia entre dos ejecuciones iguales", () => {
  test("duraciones", () => {
    assert.equal(normalizarSalida("# duration_ms 123.4"), normalizarSalida("# duration_ms 98.7651"));
    assert.equal(normalizarSalida("1 failed in 0.12s"), normalizarSalida("1 failed in 3.40s"));
    assert.equal(normalizarSalida("✖ suma (1.2ms)"), normalizarSalida("✖ suma (0.8731ms)"));
    assert.equal(normalizarSalida("Ran 2 tests in 0.001s"), normalizarSalida("Ran 2 tests in 0.034s"));
    assert.equal(normalizarSalida("Time: 1.5 s"), normalizarSalida("Time: 2 s"));
  });

  test("marcas de tiempo", () => {
    assert.equal(normalizarSalida("2026-10-09T10:11:12.345Z error"), normalizarSalida("2026-10-09T23:59:01.001Z error"));
    assert.equal(normalizarSalida("[2026-10-09 10:11:12] error"), normalizarSalida("[2026-10-10 08:00:00] error"));
    assert.equal(normalizarSalida("10:11:12 error"), normalizarSalida("10:11:59 error"));
  });

  test("direcciones hexadecimales", () => {
    assert.equal(normalizarSalida("<Objeto at 0x7f3a9c0012b0>"), normalizarSalida("<Objeto at 0x10FE2A>"));
  });

  test("fin de línea y espacios finales", () => {
    assert.equal(normalizarSalida("a  \r\nb\r\n\r\n"), normalizarSalida("a\nb"));
  });

  test("no borra lo que sí distingue dos fallos", () => {
    assert.notEqual(normalizarSalida("# fail 2"), normalizarSalida("# fail 1"));
    assert.notEqual(normalizarSalida("esperaba 3, obtuve 4"), normalizarSalida("esperaba 3, obtuve 5"));
    assert.notEqual(normalizarSalida("SyntaxError en línea 10"), normalizarSalida("SyntaxError en línea 12"));
    assert.notEqual(normalizarSalida("ReferenceError: suma"), normalizarSalida("TypeError: suma"));
  });

  test("tolera entradas vacías o ausentes", () => {
    assert.equal(normalizarSalida(""), "");
    assert.equal(normalizarSalida(/** @type {any} */ (undefined)), "");
    assert.equal(normalizarSalida("  \n\r\n "), "");
  });
});

describe("huellaDeSalida", () => {
  test("es un sha256 estable ante duraciones y distinto ante otro fallo", () => {
    const a = huellaDeSalida("# fail 1\n# duration_ms 12.5\n", "Error en 0x1f\n");
    const b = huellaDeSalida("# fail 1\r\n# duration_ms 99.1\r\n", "Error en 0xabc\n");
    assert.match(a, /^[0-9a-f]{64}$/);
    assert.equal(a, b);
    assert.notEqual(a, huellaDeSalida("# fail 2\n# duration_ms 12.5\n", "Error en 0x1f\n"));
  });

  test("distingue la salida estándar de la de errores", () => {
    assert.notEqual(huellaDeSalida("x", ""), huellaDeSalida("", "x"));
  });

  test("una salida vacía tras normalizar no tiene huella", () => {
    assert.equal(huellaDeSalida("", ""), "");
    assert.equal(huellaDeSalida(" \n", "\r\n"), "");
    assert.equal(huellaDeSalida(/** @type {any} */ (undefined), /** @type {any} */ (null)), "");
  });
});

// ── router ───────────────────────────────────────────────────────────────────

/** @param {[string, string|undefined][]} ejecuciones  pares [categoria, huellaSalida] */
function estado(ejecuciones, { max = 10, gasto = "ok" } = {}) {
  const e = estadoInicial({ id: "T1", agente: "desarrollador-backend" }, { runId: "r1", cwd: "/tmp/x", maxIteraciones: max });
  e.ejecuciones = ejecuciones.map(([categoria, huellaSalida], i) => /** @type {any} */ ({
    iteracion: i + 1, categoria, exitCode: categoria === "pass" ? 0 : 1, timedOut: categoria === "timeout", oomKilled: false,
    durationMs: 1, stdoutCola: "", stderrCola: "", ...(huellaSalida === undefined ? {} : { huellaSalida }),
  }));
  e.iteracion = ejecuciones.length;
  e.presupuesto.estado = /** @type {any} */ (gasto);
  return e;
}

const A = "a".repeat(64);
const B = "b".repeat(64);
const SIN_PROGRESO = { ruta: "revision_humana", motivo: "sin_progreso" };

describe("decidirRuta — sin progreso", () => {
  test("tres fallos seguidos con la misma huella → revisión por sin_progreso", () => {
    assert.deepEqual(decidirRuta(estado([["fail", A], ["fail", A], ["fail", A]])), SIN_PROGRESO);
    assert.deepEqual(decidirRuta(estado([["fail", B], ["fail", A], ["fail", A], ["fail", A]])), SIN_PROGRESO);
  });

  test("por defecto N es el de la configuración (3)", () => {
    assert.equal(POR_DEFECTO.motor.sin_progreso, 3);
    assert.deepEqual(decidirRuta(estado([["fail", A], ["fail", A]])), { ruta: "coder" });
  });

  test("dos iguales y una distinta → sigue el implementador", () => {
    assert.deepEqual(decidirRuta(estado([["fail", A], ["fail", A], ["fail", B]])), { ruta: "coder" });
    assert.deepEqual(decidirRuta(estado([["fail", B], ["fail", A], ["fail", A]])), { ruta: "coder" });
    assert.deepEqual(decidirRuta(estado([["fail", A], ["fail", B], ["fail", A]])), { ruta: "coder" });
  });

  test("un pase en la tercera es un éxito: el éxito se evalúa antes", () => {
    assert.deepEqual(decidirRuta(estado([["fail", A], ["fail", A], ["pass", A]])), { ruta: "fin_exito" });
  });

  test("con 0 se desactiva", () => {
    const e = estado([["fail", A], ["fail", A], ["fail", A], ["fail", A]]);
    assert.deepEqual(decidirRuta(e, { sinProgreso: 0 }), { ruta: "coder" });
  });

  test("N configurable", () => {
    assert.deepEqual(decidirRuta(estado([["fail", A], ["fail", A]]), { sinProgreso: 2 }), SIN_PROGRESO);
    assert.deepEqual(decidirRuta(estado([["fail", A], ["fail", A], ["fail", A]]), { sinProgreso: 4 }), { ruta: "coder" });
    assert.deepEqual(decidirRuta(estado([["fail", A]]), { sinProgreso: 1 }), SIN_PROGRESO);
  });

  test("la huella vacía o ausente no cuenta como sin progreso", () => {
    assert.deepEqual(decidirRuta(estado([["fail", ""], ["fail", ""], ["fail", ""]])), { ruta: "coder" });
    assert.deepEqual(decidirRuta(estado([["fail", undefined], ["fail", undefined], ["fail", undefined]])), { ruta: "coder" });
  });

  test("solo cuentan los fallos: un tiempo agotado entre medias rompe la racha", () => {
    assert.deepEqual(decidirRuta(estado([["fail", A], ["timeout", A], ["fail", A]])), { ruta: "coder" });
    assert.deepEqual(decidirRuta(estado([["timeout", A], ["timeout", A], ["timeout", A]])), { ruta: "coder" });
  });

  test("el presupuesto agotado manda; sin_progreso va antes que el tope de iteraciones", () => {
    /** @type {[string, string][]} */
    const tres = [["fail", A], ["fail", A], ["fail", A]];
    assert.deepEqual(decidirRuta(estado(tres, { gasto: "agotado" })), { ruta: "revision_humana", motivo: "presupuesto" });
    assert.deepEqual(decidirRuta(estado(tres, { max: 3 })), SIN_PROGRESO);
    assert.deepEqual(decidirRuta(estado([["fail", A], ["fail", A], ["fail", B]], { max: 3 })), { ruta: "revision_humana", motivo: "iteraciones" });
  });

  test("sinProgreso() es la misma comprobación, sin decidir ruta", () => {
    assert.equal(sinProgreso(estado([["fail", A], ["fail", A], ["fail", A]]), 3), true);
    assert.equal(sinProgreso(estado([["fail", A], ["fail", A]]), 3), false);
    assert.equal(sinProgreso(estado([["fail", A], ["fail", A], ["fail", A]]), 0), false);
    assert.equal(sinProgreso(estado([]), 3), false);
  });
});

describe("estado y grafo", () => {
  test("sin_progreso es un motivo de revisión válido", () => {
    assert.ok(MOTIVOS.includes("sin_progreso"));
    const e = estado([["fail", A]]);
    e.revision = { motivo: "sin_progreso", reanudarEn: "qa" };
    e.resultado = "revision_pendiente";
    assert.deepEqual(validarEstado(e), []);
  });

  test("validarEstado rechaza una huella que no es texto", () => {
    const e = estado([["fail", A]]);
    /** @type {any} */ (e.ejecuciones[0]).huellaSalida = 7;
    assert.match(validarEstado(e).join("\n"), /huellaSalida/);
  });

  test("la revisión reanuda en qa y explica qué hace cada decisión", () => {
    const t = transicion("sandbox", estado([["fail", A], ["fail", A], ["fail", A]]));
    assert.equal(t.siguiente, "revision_humana");
    assert.equal(t.parcial.resultado, "revision_pendiente");
    assert.equal(t.parcial.revision?.motivo, "sin_progreso");
    assert.equal(t.parcial.revision?.reanudarEn, "qa");
    const detalle = String(t.parcial.revision?.detalle);
    assert.match(detalle, /idéntica 3 veces/);
    assert.match(detalle, /pruebas estén rotas/);
    assert.match(detalle, /continuar/);
    assert.match(detalle, /aceptar/);
    assert.match(detalle, /abortar/);
  });

  test("transicion respeta el N que se le pasa", () => {
    const e = estado([["fail", A], ["fail", A], ["fail", A]]);
    assert.equal(transicion("sandbox", e, { sinProgreso: 0 }).siguiente, "coder");
    const dos = transicion("sandbox", estado([["fail", A], ["fail", A]]), { sinProgreso: 2 });
    assert.match(String(dos.parcial.revision?.detalle), /idéntica 2 veces/);
  });
});

describe("configuración — motor.sin_progreso", () => {
  function proyecto(yaml) {
    const cwd = tmp("forge-sp-cfg-");
    mkdirSync(join(cwd, ".sdd"), { recursive: true });
    writeFileSync(join(cwd, ".sdd", "sdd.config.yaml"), yaml);
    return cwd;
  }

  test("por defecto 3; se lee del archivo; 0 lo desactiva", () => {
    assert.equal(leerConfigCiclo(tmp("forge-sp-cfg-")).motor.sin_progreso, 3);
    assert.equal(leerConfigCiclo(proyecto("motor:\n  sin_progreso: 5\n")).motor.sin_progreso, 5);
    assert.equal(leerConfigCiclo(proyecto("motor:\n  sin_progreso: 0   # desactivado\n")).motor.sin_progreso, 0);
  });

  test("rechaza valores que no son un entero ≥ 0", () => {
    for (const valor of ["-1", "2.5", "tres"]) {
      assert.throws(() => leerConfigCiclo(proyecto(`motor:\n  sin_progreso: ${valor}\n`)), /motor\.sin_progreso/, valor);
    }
  });
});

// ── ciclo completo ───────────────────────────────────────────────────────────

describe("ciclo completo — unas pruebas rotas no gastan todas las iteraciones", () => {
  const PLAN = '{"pasos":["implementar"],"archivosObjetivo":["src/suma.js"]}';
  const PRUEBAS = '```json\n{"archivos":[{"ruta":"tests/suma.test.js","contenido":"const { suma } = require(\\"../src/suma.js\\");\\n"}]}\n```';
  const PRUEBAS_2 = '```json\n{"archivos":[{"ruta":"tests/suma.test.js","contenido":"import { suma } from \\"../src/suma.js\\";\\n"}]}\n```';
  const IMPL = '```json\n{"archivos":[{"ruta":"src/suma.js","contenido":"export const suma = (a, b) => a + b;\\n"}]}\n```';
  const TAREA = { id: "T1", agente: "desarrollador-backend", prompt: "Implementa suma", archivos: ["src/suma.js"] };
  /** La misma salida que se vio en la ejecución real: el archivo de pruebas no carga. Solo cambia la duración. */
  const rota = (ms) => ({
    exitCode: 1,
    stdout: `✖ tests/suma.test.js (${ms}ms)\n# tests 1\n# pass 0\n# fail 1\n# duration_ms ${ms * 2}\n`,
    stderr: "ReferenceError: require is not defined in ES module scope\n",
  });
  const PASE = { exitCode: 0, stdout: "# tests 1\n# pass 1\n" };

  function entorno({ ejecuciones, motor = {} }) {
    const cwd = tmp("forge-sp-ciclo-");
    const cola = [...ejecuciones];
    const llamadas = [];
    const eventos = [];
    const guion = { arquitecto: [PLAN], tester: [PRUEBAS, PRUEBAS_2], "desarrollador-backend": [IMPL, IMPL, IMPL, IMPL, IMPL, IMPL] };
    const opciones = {
      cwd, runId: "r1", testCmd: "npm test",
      config: { ...POR_DEFECTO, motor: { ...POR_DEFECTO.motor, grafo: "propio", ...motor } },
      log: { append: (type, payload, meta) => eventos.push({ type, payload, meta }) },
      aliasDe: () => "sonnet",
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
  const agentes = (e) => e.llamadas.map((l) => l.agente);

  test("tres salidas idénticas pausan la tarea en la tercera iteración, no en la quinta", async () => {
    // La primera ejecución es la comprobación del nodo qa; las tres siguientes, las del ciclo
    const e = entorno({ ejecuciones: [rota(1.1), rota(1.2), rota(7.9), rota(3.3)] });
    const r = await e.ciclo.ejecutar(TAREA);

    assert.equal(r.status, "en_revision");
    assert.equal(r.estado.resultado, "revision_pendiente");
    assert.equal(r.estado.revision?.motivo, "sin_progreso");
    assert.equal(r.estado.revision?.reanudarEn, "qa");
    assert.match(String(r.estado.revision?.detalle), /idéntica 3 veces/);
    assert.equal(r.estado.iteracion, 3);
    assert.equal(r.estado.maxIteraciones, 5);
    assert.deepEqual(agentes(e), ["arquitecto", "tester", "desarrollador-backend", "desarrollador-backend", "desarrollador-backend"]);
    assert.equal(e.cola.length, 0);

    const huellas = r.estado.ejecuciones.map((x) => x.huellaSalida);
    assert.equal(huellas.length, 3);
    assert.match(String(huellas[0]), /^[0-9a-f]{64}$/);
    assert.equal(new Set(huellas).size, 1, "las duraciones no cambian la huella");
    assert.deepEqual(validarEstado(r.estado), []);
    const pausa = e.eventos.find((ev) => ev.type === "task_paused");
    assert.equal(pausa?.payload.motivo, "sin_progreso");
  });

  test("«continuar» hace que el agente de pruebas las reescriba, sabiendo por qué, y el ciclo termina", async () => {
    const e = entorno({ ejecuciones: [rota(1), rota(2), rota(3), rota(4), { exitCode: 1, stderr: "Cannot find module\n" }, PASE] });
    await e.ciclo.ejecutar(TAREA);
    const r = await e.ciclo.ejecutar(TAREA, { decision: "continuar" });

    assert.equal(r.estado.resultado, "exito");
    assert.equal(r.estado.revision, null);
    assert.equal(r.estado.iteracion, 4);
    assert.deepEqual(agentes(e).slice(5), ["tester", "desarrollador-backend"]);
    const peticiones = e.llamadas.filter((l) => l.agente === "tester").map((l) => l.userPrompt);
    assert.match(peticiones[1], /require is not defined/, "el agente de pruebas recibe la salida que se repitió");
    assert.match(peticiones[1], /const \{ suma \} = require/, "y las pruebas que escribió");
    assert.doesNotMatch(peticiones[0], /require is not defined/);
  });

  test("«aceptar» da la tarea por buena y «abortar» restaura", async () => {
    const a = entorno({ ejecuciones: [rota(1), rota(2), rota(3), rota(4)] });
    await a.ciclo.ejecutar(TAREA);
    assert.equal((await a.ciclo.ejecutar(TAREA, { decision: "aceptar" })).estado.resultado, "aceptada_por_humano");

    const b = entorno({ ejecuciones: [rota(1), rota(2), rota(3), rota(4)] });
    await b.ciclo.ejecutar(TAREA);
    assert.equal((await b.ciclo.ejecutar(TAREA, { decision: "abortar" })).estado.resultado, "abortada");
  });

  test("si coincide con el tope de iteraciones, «continuar» exige ampliarlas: no regala una ejecución", async () => {
    const e = entorno({ motor: { max_iteraciones: 3 }, ejecuciones: [rota(1), rota(2), rota(3), rota(4), { exitCode: 1 }, PASE] });
    const r = await e.ciclo.ejecutar(TAREA);
    assert.equal(r.estado.revision?.motivo, "sin_progreso", "se explica la causa, no solo el tope");
    await assert.rejects(() => e.ciclo.ejecutar(TAREA, { decision: "continuar" }), /--iteraciones-extra/);
    assert.equal(e.llamadas.length, 5, "una decisión rechazada no gasta");

    const seguido = await e.ciclo.ejecutar(TAREA, { decision: "continuar", iteracionesExtra: 2 });
    assert.equal(seguido.estado.resultado, "exito");
    assert.equal(seguido.estado.iteracion, 4);
  });

  test("si la salida cambia, el implementador sigue hasta el tope de iteraciones", async () => {
    const otra = { exitCode: 1, stdout: "# fail 1\n", stderr: "AssertionError: 3 !== 4\n" };
    const e = entorno({ ejecuciones: [rota(1), rota(2), rota(3), otra, rota(4), rota(5)] });
    const r = await e.ciclo.ejecutar(TAREA);
    assert.equal(r.estado.revision?.motivo, "iteraciones");
    assert.equal(r.estado.iteracion, 5);
  });

  test("con motor.sin_progreso: 0 se llega al tope de iteraciones como antes", async () => {
    const e = entorno({ motor: { sin_progreso: 0 }, ejecuciones: [rota(1), rota(2), rota(3), rota(4), rota(5), rota(6)] });
    const r = await e.ciclo.ejecutar(TAREA);
    assert.equal(r.estado.revision?.motivo, "iteraciones");
    assert.equal(r.estado.revision?.reanudarEn, "coder");
    assert.equal(r.estado.iteracion, 5);
  });

  test("una salida vacía repetida no cuenta: no hay nada que comparar", async () => {
    const vacia = { exitCode: 1 };
    const e = entorno({ ejecuciones: [vacia, vacia, vacia, vacia, vacia, vacia] });
    const r = await e.ciclo.ejecutar(TAREA);
    assert.equal(r.estado.revision?.motivo, "iteraciones");
    assert.equal(r.estado.ejecuciones[0].huellaSalida, "");
  });
});
