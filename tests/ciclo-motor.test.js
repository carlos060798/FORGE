// @ts-check
/**
 * T013 / T024 / T026 — Nodos, grafo y motor del ciclo verificado, con un
 * proveedor guionizado y un entorno aislado falso (sin modelos ni Docker).
 * Recorre los escenarios de la spec 2026-10-03-ciclo-verificado.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { CicloVerificado } from "../core/ciclo/index.js";
import { POR_DEFECTO } from "../core/ciclo/config.js";
import { transicion } from "../core/ciclo/grafo.js";
import { estadoInicial } from "../core/ciclo/estado.js";
import { cola, redactar } from "../core/ciclo/redactar.js";
import { ErrorHiloEnUso } from "../core/ciclo/checkpoint-archivos.js";
import { crearLlamador } from "../core/ciclo/index.js";

const TAREA = { id: "T1", agente: "desarrollador-backend", prompt: "Implementa suma(a, b)", archivos: ["src/suma.js"], cubre_cas: ["CA-001-01"] };

const json = (o) => "```json\n" + JSON.stringify(o) + "\n```";
const PLAN    = json({ pasos: ["escribir suma"], archivosObjetivo: ["src/suma.js"] });
const PRUEBAS = json({ archivos: [{ ruta: "tests/suma.test.js", contenido: "// prueba de suma" }] });
const impl    = (v) => json({ archivos: [{ ruta: "src/suma.js", contenido: `// versión ${v}` }] });

/** Consumo de una llamada: 10 000 tokens de entrada de sonnet = 0,03 USD */
const USO = { inputTokens: 10_000, outputTokens: 0, modelo: "claude-sonnet-4-6", proveedor: "anthropic" };

/**
 * Entorno de prueba: proyecto temporal, proveedor guionizado y runner falso.
 * @param {{ salidas?: Record<string, any[]>, ejecuciones?: any[], config?: any, uso?: any }} [o]
 *   `salidas`: por agente, las respuestas sucesivas (texto, o { error }).
 *   `ejecuciones`: resultados sucesivos del runner; el primero lo consume la
 *   comprobación de "rojo inicial" del nodo de pruebas.
 */
function entorno(o = {}) {
  const cwd = mkdtempSync(join(tmpdir(), "forge-motor-"));
  mkdirSync(join(cwd, "src"), { recursive: true });
  writeFileSync(join(cwd, "src", "suma.js"), "// original");

  const salidas = { arquitecto: [PLAN], tester: [PRUEBAS], "desarrollador-backend": [], ...o.salidas };
  const ejecuciones = [...(o.ejecuciones ?? [])];
  /** @type {{ agente: string, modeloAlias: string, userPrompt: string }[]} */
  const llamadas = [];
  /** @type {{ type: string, payload: any, meta: any }[]} */
  const eventos = [];
  let ejecutadas = 0;

  const opciones = {
    cwd, runId: "r1",
    config: { ...POR_DEFECTO, ...o.config, motor: { ...POR_DEFECTO.motor, grafo: process.env.FORGE_MOTOR_GRAFO ?? "propio", ...o.config?.motor }, presupuesto: { ...POR_DEFECTO.presupuesto, ...o.config?.presupuesto } },
    log: { append: (type, payload, meta) => eventos.push({ type, payload, meta }) },
    aliasDe: (agente) => (agente === "arquitecto" ? "opus" : "sonnet"),
    llamar: async (p) => {
      llamadas.push(p);
      const s = salidas[p.agente]?.shift();
      if (s === undefined) throw new Error(`guion agotado para ${p.agente}`);
      if (typeof s === "object") return { ok: false, ...s };
      return { ok: true, output: s, ...(o.uso ?? USO) };
    },
    runner: {
      test: async () => {
        ejecutadas++;
        const r = ejecuciones.shift();
        if (r === undefined) throw new Error("guion de ejecuciones agotado");
        return { stdout: "", stderr: "", timedOut: false, infraError: false, durationMs: 1, ...r };
      },
    },
    testCmd: "npm test",
  };
  return {
    cwd, llamadas, eventos, opciones,
    ciclo: () => new CicloVerificado(opciones),
    ejecutadas: () => ejecutadas,
    leer: (ruta) => readFileSync(join(cwd, ruta), "utf8"),
    tipos: () => eventos.map((e) => e.type),
  };
}

const FALLA = { exitCode: 1, stderr: "AssertionError: 3 !== 4" };
const PASA  = { exitCode: 0 };

describe("escenario 1 — caso feliz", () => {
  test("la primera ejecución falla, la segunda pasa: completada en 2 iteraciones", async () => {
    const e = entorno({ salidas: { "desarrollador-backend": [impl(1), impl(2)] }, ejecuciones: [FALLA, FALLA, PASA] });
    const r = await e.ciclo().ejecutar(TAREA);

    assert.equal(r.status, "completada");
    assert.equal(r.estado.resultado, "exito");
    assert.equal(r.estado.iteracion, 2);
    assert.deepEqual(r.estado.ejecuciones.map((x) => x.categoria), ["fail", "pass"]);
    assert.equal(e.leer("src/suma.js"), "// versión 2");
    assert.equal(e.leer("tests/suma.test.js"), "// prueba de suma");
  });

  test("CA-002-01: las pruebas se escriben antes que la implementación", async () => {
    const e = entorno({ salidas: { "desarrollador-backend": [impl(1)] }, ejecuciones: [FALLA, PASA] });
    await e.ciclo().ejecutar(TAREA);
    assert.deepEqual(e.llamadas.map((l) => l.agente), ["arquitecto", "tester", "desarrollador-backend"]);
  });

  test("CA-001-02: el implementador recibe las pruebas y el resultado de la ejecución anterior", async () => {
    const e = entorno({ salidas: { "desarrollador-backend": [impl(1), impl(2)] }, ejecuciones: [FALLA, FALLA, PASA] });
    await e.ciclo().ejecutar(TAREA);
    const [primera, segunda] = e.llamadas.filter((l) => l.agente === "desarrollador-backend");
    assert.ok(primera.userPrompt.includes("// prueba de suma"));
    assert.ok(!primera.userPrompt.includes("ejecución anterior"));
    assert.ok(segunda.userPrompt.includes("AssertionError: 3 !== 4"));
  });

  test("CA-008-03: cada paso queda en el registro de eventos", async () => {
    const e = entorno({ salidas: { "desarrollador-backend": [impl(1)] }, ejecuciones: [FALLA, PASA] });
    await e.ciclo().ejecutar(TAREA);
    const nodos = e.eventos.filter((x) => x.type === "ciclo:nodo_completado").map((x) => x.payload.nodo);
    assert.deepEqual(nodos, ["planner", "retriever", "qa", "coder", "sandbox"]);
    assert.equal(e.eventos.filter((x) => x.type === "ciclo:ejecucion").length, 1);
    assert.ok(e.eventos.every((x) => x.meta?.taskId === "T1"));
  });

  test("CA-002-04: unas pruebas que pasan sin implementación generan un aviso, no un bloqueo", async () => {
    const e = entorno({ salidas: { "desarrollador-backend": [impl(1)] }, ejecuciones: [PASA, PASA] });
    const r = await e.ciclo().ejecutar(TAREA);
    assert.equal(r.status, "completada");
    assert.ok(e.eventos.some((x) => x.payload.aviso === "pruebas_no_fallan"));
  });
});

describe("escenario 2 — tope de iteraciones y revisión humana", () => {
  const cincoFallos = () => entorno({
    salidas: { "desarrollador-backend": [1, 2, 3, 4, 5].map(impl) },
    ejecuciones: [FALLA, FALLA, FALLA, FALLA, FALLA, FALLA],
  });

  test("CA-005-01: tras 5 ejecuciones fallidas se pausa indicando el motivo", async () => {
    const e = cincoFallos();
    const r = await e.ciclo().ejecutar(TAREA);
    assert.equal(r.status, "en_revision");
    assert.equal(r.estado.iteracion, 5);
    assert.deepEqual(r.estado.revision, { motivo: "iteraciones", reanudarEn: "coder" });
    assert.deepEqual(e.eventos.filter((x) => x.type === "task_paused").map((x) => x.payload.motivo), ["iteraciones"]);
  });

  test("CA-005-03: sin decisión, volver a ejecutar no llama a nadie ni ejecuta nada", async () => {
    const e = cincoFallos();
    await e.ciclo().ejecutar(TAREA);
    const [llamadas, ejecutadas] = [e.llamadas.length, e.ejecutadas()];
    const r = await e.ciclo().ejecutar(TAREA);
    assert.equal(r.status, "en_revision");
    assert.equal(r.reanudada, true);
    assert.equal(e.llamadas.length, llamadas);
    assert.equal(e.ejecutadas(), ejecutadas);
  });

  test("CA-005-04: abortar restaura lo modificado y borra lo creado", async () => {
    const e = cincoFallos();
    await e.ciclo().ejecutar(TAREA);
    assert.equal(e.leer("src/suma.js"), "// versión 5");

    const r = await e.ciclo().ejecutar(TAREA, { decision: "abortar" });
    assert.equal(r.status, "abortada");
    assert.equal(e.leer("src/suma.js"), "// original");
    assert.ok(!existsSync(join(e.cwd, "tests", "suma.test.js")));
  });

  test("CA-005-02: aceptar termina la tarea dejando constancia de que no pasó las pruebas", async () => {
    const e = cincoFallos();
    await e.ciclo().ejecutar(TAREA);
    const r = await e.ciclo().ejecutar(TAREA, { decision: "aceptar" });
    assert.equal(r.status, "completada");
    assert.equal(r.estado.resultado, "aceptada_por_humano");
    assert.equal(r.estado.ejecuciones.at(-1)?.categoria, "fail");
    assert.equal(e.leer("src/suma.js"), "// versión 5");
  });

  test("CA-005-02: continuar con más iteraciones sigue desde el implementador", async () => {
    const e = cincoFallos();
    await e.ciclo().ejecutar(TAREA);
    e.opciones.llamar = async (p) => { e.llamadas.push(p); return { ok: true, output: impl(6), ...USO }; };
    e.opciones.runner.test = async () => ({ exitCode: 0, stdout: "", stderr: "", timedOut: false, infraError: false, durationMs: 1 });

    const r = await e.ciclo().ejecutar(TAREA, { decision: "continuar", iteracionesExtra: 2 });
    assert.equal(r.status, "completada");
    assert.equal(r.estado.iteracion, 6);
    assert.equal(r.estado.maxIteraciones, 7);
    assert.equal(r.estado.revision, null);
  });

  test("continuar sin ampliar el tope que hizo parar es un error y no gasta nada", async () => {
    const e = cincoFallos();
    await e.ciclo().ejecutar(TAREA);
    const antes = e.llamadas.length;
    await assert.rejects(e.ciclo().ejecutar(TAREA, { decision: "continuar" }), /iteraciones-extra/);
    await assert.rejects(e.ciclo().ejecutar(TAREA, { decision: "quizas" }), /Decisión no válida/);
    assert.equal(e.llamadas.length, antes);
    assert.equal((await e.ciclo().ejecutar(TAREA)).status, "en_revision", "la revisión sigue pendiente");
  });
});

describe("escenario 3 — éxito en la última iteración", () => {
  test("CA-001-03: pasar en la quinta ejecución es éxito, sin revisión", async () => {
    const e = entorno({ salidas: { "desarrollador-backend": [1, 2, 3, 4, 5].map(impl) }, ejecuciones: [FALLA, FALLA, FALLA, FALLA, FALLA, PASA] });
    const r = await e.ciclo().ejecutar(TAREA);
    assert.equal(r.status, "completada");
    assert.equal(r.estado.iteracion, 5);
    assert.equal(r.estado.revision, null);
  });
});

describe("escenario 4 — presupuesto", () => {
  // 100 000 tokens de sonnet por llamada = 0,30 USD
  const CARO = { inputTokens: 100_000, outputTokens: 0, modelo: "claude-sonnet-4-6", proveedor: "anthropic" };

  test("CA-004-02: agotado el tope no se inicia ninguna llamada más y se pide revisión", async () => {
    // tope 1,00: planner 0,30 · qa 0,60 · coder 0,90 · coder 1,20 → agotado tras fallar
    const e = entorno({
      uso: CARO, config: { presupuesto: { tope_usd: 1, umbral_degradacion_usd: 0.8 } },
      salidas: { "desarrollador-backend": [impl(1), impl(2), impl(3)] }, ejecuciones: [FALLA, FALLA, FALLA],
    });
    const r = await e.ciclo().ejecutar(TAREA);
    assert.equal(r.status, "en_revision");
    assert.equal(r.estado.revision?.motivo, "presupuesto");
    assert.equal(r.estado.presupuesto.estado, "agotado");
    assert.equal(e.llamadas.length, 4, "no hubo una quinta llamada");
    assert.equal(r.estado.iteracion, 2);
  });

  test("CA-004-01: al cruzar el umbral se degrada el modelo y queda registrado", async () => {
    const e = entorno({
      uso: CARO, config: { presupuesto: { tope_usd: 5, umbral_degradacion_usd: 0.5 } },
      salidas: { "desarrollador-backend": [impl(1), impl(2)] }, ejecuciones: [FALLA, FALLA, PASA],
    });
    await e.ciclo().ejecutar(TAREA);
    assert.deepEqual(e.llamadas.map((l) => l.modeloAlias), ["opus", "sonnet", "haiku", "haiku"]);
    assert.equal(e.eventos.filter((x) => x.type === "ciclo:presupuesto_degradado").length, 1);
  });

  test("con degradar_a local, tras el umbral se pide el proveedor local conservando el modelo", async () => {
    const e = entorno({
      uso: CARO, config: { presupuesto: { tope_usd: 5, umbral_degradacion_usd: 0.5, degradar_a: "local" } },
      salidas: { "desarrollador-backend": [impl(1)] }, ejecuciones: [FALLA, PASA],
    });
    await e.ciclo().ejecutar(TAREA);
    assert.deepEqual(e.llamadas.map((l) => [l.modeloAlias, Boolean(l.proveedorLocal)]), [["opus", false], ["sonnet", false], ["sonnet", true]]);
  });

  test("con el presupuesto agotado tras implementar, las pruebas se ejecutan igualmente y un pase es éxito", async () => {
    const e = entorno({
      uso: CARO, config: { presupuesto: { tope_usd: 0.85, umbral_degradacion_usd: 0.8 } },
      salidas: { "desarrollador-backend": [impl(1)] }, ejecuciones: [FALLA, PASA],
    });
    const r = await e.ciclo().ejecutar(TAREA);
    assert.equal(r.estado.presupuesto.estado, "agotado");
    assert.equal(r.status, "completada");
  });

  test("continuar exige ampliar el presupuesto y, ampliado, sigue", async () => {
    const e = entorno({
      uso: CARO, config: { presupuesto: { tope_usd: 1, umbral_degradacion_usd: 0.8 } },
      salidas: { "desarrollador-backend": [impl(1), impl(2), impl(3)] }, ejecuciones: [FALLA, FALLA, FALLA, PASA],
    });
    await e.ciclo().ejecutar(TAREA);
    await assert.rejects(e.ciclo().ejecutar(TAREA, { decision: "continuar" }), /presupuesto-extra/);
    const r = await e.ciclo().ejecutar(TAREA, { decision: "continuar", presupuestoExtra: 2 });
    assert.equal(r.status, "completada");
    assert.equal(r.estado.presupuesto.tope_usd, 3);
  });

  test("CA-004-03: el gasto de la sesión pasa de una tarea a la siguiente", async () => {
    const e = entorno({
      salidas: { arquitecto: [PLAN, PLAN], tester: [PRUEBAS, PRUEBAS], "desarrollador-backend": [impl(1), impl(2)] },
      ejecuciones: [FALLA, PASA, FALLA, PASA],
    });
    const a = await e.ciclo().ejecutar(TAREA);
    const b = await e.ciclo().ejecutar({ ...TAREA, id: "T2" });
    assert.equal(a.estado.presupuesto.llamadas, 3);
    assert.equal(b.estado.presupuesto.llamadas, 6);
    assert.ok(Math.abs(b.estado.presupuesto.gastado_usd - 0.18) < 1e-9);
  });

  test("CA-004-05: un proveedor real que no informa del consumo lleva a revisión, no a gasto cero", async () => {
    const e = entorno({ uso: { modelo: "claude-sonnet-4-6", proveedor: "anthropic" } });
    const r = await e.ciclo().ejecutar(TAREA);
    assert.equal(r.status, "en_revision");
    assert.equal(r.estado.revision?.motivo, "infraestructura");
    assert.match(String(r.estado.revision?.detalle), /sin datos de consumo/);
  });
});

describe("escenarios 5 y 6 — fallos de dependencias externas", () => {
  test("CA-005-05: un fallo del entorno aislado no consume iteraciones y va a revisión", async () => {
    const e = entorno({ salidas: { "desarrollador-backend": [impl(1)] }, ejecuciones: [FALLA, { exitCode: null, infraError: true, stderr: "Docker no está disponible" }] });
    const r = await e.ciclo().ejecutar(TAREA);
    assert.equal(r.status, "en_revision");
    assert.deepEqual(r.estado.revision, { motivo: "infraestructura", reanudarEn: "sandbox", detalle: "Docker no está disponible" });
    assert.equal(r.estado.iteracion, 0);
  });

  test("tras arreglar el entorno, continuar repite la ejecución sin volver a llamar al implementador", async () => {
    const e = entorno({ salidas: { "desarrollador-backend": [impl(1)] }, ejecuciones: [FALLA, { exitCode: null, infraError: true }, PASA] });
    await e.ciclo().ejecutar(TAREA);
    const antes = e.llamadas.length;
    const r = await e.ciclo().ejecutar(TAREA, { decision: "continuar" });
    assert.equal(r.status, "completada");
    assert.equal(r.estado.iteracion, 1);
    assert.equal(e.llamadas.length, antes);
  });

  test("el proveedor de modelos caído lleva a revisión y no cuenta como iteración", async () => {
    const e = entorno({ salidas: { "desarrollador-backend": [{ error: "503 Service Unavailable" }] }, ejecuciones: [FALLA] });
    const r = await e.ciclo().ejecutar(TAREA);
    assert.equal(r.status, "en_revision");
    assert.equal(r.estado.revision?.motivo, "infraestructura");
    assert.equal(r.estado.revision?.reanudarEn, "coder");
    assert.equal(r.estado.iteracion, 0);
  });
});

describe("escenario 9 — interrupción y reanudación", () => {
  test("CA-006-01: tras un corte se continúa en el nodo pendiente sin repetir llamadas ya hechas", async () => {
    const e = entorno({ salidas: { "desarrollador-backend": [impl(1)] }, ejecuciones: [FALLA] });
    // El proceso "muere" al ejecutar las pruebas de la primera implementación
    await assert.rejects(e.ciclo().ejecutar(TAREA), /guion de ejecuciones agotado/);
    assert.equal(e.llamadas.length, 3);

    e.opciones.runner.test = async () => ({ exitCode: 0, stdout: "", stderr: "", timedOut: false, infraError: false, durationMs: 1 });
    const r = await e.ciclo().ejecutar(TAREA);
    assert.equal(r.status, "completada");
    assert.equal(r.reanudada, true);
    assert.equal(e.llamadas.length, 3, "planner, qa y coder no se repiten");
    assert.equal(r.estado.iteracion, 1);
  });

  test("una tarea ya terminada no se vuelve a ejecutar", async () => {
    const e = entorno({ salidas: { "desarrollador-backend": [impl(1)] }, ejecuciones: [FALLA, PASA] });
    await e.ciclo().ejecutar(TAREA);
    const r = await e.ciclo().ejecutar(TAREA);
    assert.equal(r.status, "completada");
    assert.equal(e.llamadas.length, 3);
  });

  test("CA-006-03: una tarea en curso en otro proceso no se puede ejecutar a la vez", async () => {
    const e = entorno({ salidas: { "desarrollador-backend": [impl(1)] }, ejecuciones: [FALLA, PASA] });
    const c = e.ciclo();
    const liberar = c.guardador.bloquear("r1:T1");
    await assert.rejects(c.ejecutar(TAREA), ErrorHiloEnUso);
    liberar();
    assert.equal((await c.ejecutar(TAREA)).status, "completada");
  });

  test("CA-004-04: el gasto y el estado de cada tarea se pueden consultar en cualquier momento", async () => {
    const e = entorno({ salidas: { "desarrollador-backend": [impl(1)] }, ejecuciones: [FALLA, PASA] });
    await e.ciclo().ejecutar(TAREA);
    const [t] = e.ciclo().resumen();
    assert.equal(t.taskId, "T1");
    assert.equal(t.resultado, "exito");
    assert.equal(t.iteracion, 1);
    assert.equal(t.siguiente, null);
    assert.ok(Math.abs(t.presupuesto.gastado_usd - 0.09) < 1e-9);
  });
});

describe("salidas de agentes", () => {
  test("una salida que no se puede interpretar se reintenta una vez", async () => {
    const e = entorno({ salidas: { "desarrollador-backend": ["Claro, aquí tienes el código...", impl(1)] }, ejecuciones: [FALLA, PASA] });
    const r = await e.ciclo().ejecutar(TAREA);
    assert.equal(r.status, "completada");
    const segunda = e.llamadas.filter((l) => l.agente === "desarrollador-backend")[1];
    assert.ok(segunda.userPrompt.includes("no se pudo interpretar"));
  });

  test("dos salidas inválidas seguidas llevan a revisión sin gastar iteraciones", async () => {
    const e = entorno({ salidas: { tester: ["no sé", "sigo sin saber"] } });
    const r = await e.ciclo().ejecutar(TAREA);
    assert.equal(r.status, "en_revision");
    assert.equal(r.estado.revision?.motivo, "salida_invalida");
    assert.equal(r.estado.revision?.reanudarEn, "qa");
    assert.equal(e.ejecutadas(), 0);
  });

  test("un plan que no se puede interpretar no detiene el ciclo", async () => {
    const e = entorno({ salidas: { arquitecto: ["haz lo que veas"], "desarrollador-backend": [impl(1)] }, ejecuciones: [FALLA, PASA] });
    const r = await e.ciclo().ejecutar(TAREA);
    assert.equal(r.status, "completada");
    assert.deepEqual(r.estado.plan, { pasos: [], archivosObjetivo: ["src/suma.js"] });
  });

  test("CA-002-02: el implementador no puede reescribir las pruebas; queda registrado", async () => {
    const trampa = json({ archivos: [{ ruta: "src/suma.js", contenido: "// v1" }, { ruta: "tests/suma.test.js", contenido: "// siempre pasa" }] });
    const e = entorno({ salidas: { "desarrollador-backend": [trampa] }, ejecuciones: [FALLA, PASA] });
    await e.ciclo().ejecutar(TAREA);
    assert.equal(e.leer("tests/suma.test.js"), "// prueba de suma");
    const rechazo = e.eventos.find((x) => x.type === "ciclo:escritura_rechazada");
    assert.deepEqual(rechazo?.payload, { nodo: "coder", ruta: "tests/suma.test.js", motivo: "prueba_inmutable" });
  });

  test("CA-002-03: si las pruebas cambian en disco, la ejecución no se realiza", async () => {
    const e = entorno({ salidas: { "desarrollador-backend": [impl(1)] }, ejecuciones: [FALLA] });
    const original = e.opciones.llamar;
    e.opciones.llamar = async (p) => {
      if (p.agente === "desarrollador-backend") writeFileSync(join(e.cwd, "tests", "suma.test.js"), "// manipulada");
      return original(p);
    };
    const r = await e.ciclo().ejecutar(TAREA);
    assert.equal(r.status, "en_revision");
    assert.match(String(r.estado.revision?.detalle), /Las pruebas cambiaron/);
    assert.equal(e.ejecutadas(), 1, "solo la comprobación inicial; la manipulada no se ejecuta");
  });

  test("CA-008-05: un cambio de dependencias no se aplica y lleva a revisión", async () => {
    const conDeps = json({ archivos: [{ ruta: "src/suma.js", contenido: "// v1" }, { ruta: "package.json", contenido: '{"dependencies":{"x":"*"}}' }] });
    const e = entorno({ salidas: { "desarrollador-backend": [conDeps] }, ejecuciones: [FALLA] });
    const r = await e.ciclo().ejecutar(TAREA);
    assert.equal(r.status, "en_revision");
    assert.equal(r.estado.revision?.motivo, "dependencias");
    assert.ok(!existsSync(join(e.cwd, "package.json")));
    assert.equal(e.leer("src/suma.js"), "// v1");
  });

  test("el agente de pruebas no puede escribir código que no sea de prueba", async () => {
    const mezcla = json({ archivos: [{ ruta: "tests/suma.test.js", contenido: "// t" }, { ruta: "src/suma.js", contenido: "// del tester" }] });
    const e = entorno({ salidas: { tester: [mezcla], "desarrollador-backend": [impl(1)] }, ejecuciones: [FALLA, PASA] });
    const r = await e.ciclo().ejecutar(TAREA);
    assert.deepEqual(r.estado.pruebas.archivos.map((a) => a.ruta), ["tests/suma.test.js"]);
    assert.ok(e.eventos.some((x) => x.type === "ciclo:escritura_rechazada" && x.payload.motivo === "no_es_prueba"));
  });
});

describe("llamador por defecto", () => {
  const registry = /** @type {any} */ ({ get: (n) => (n === "tester" ? { name: n, systemPrompt: "", model: "haiku" } : undefined) });

  test("usa el alias de modelo del agente y rechaza agentes desconocidos", async () => {
    const l = crearLlamador(registry, undefined, tmpdir());
    assert.equal(l.aliasDe("tester"), "haiku");
    assert.equal(l.aliasDe("inventado"), "sonnet");
    assert.deepEqual(await l.llamar({ agente: "inventado", modeloAlias: "sonnet", userPrompt: "x" }), { ok: false, error: 'Agente desconocido: "inventado"' });
  });

  test("con proveedorLocal llama a Ollama, no al proveedor configurado", async () => {
    const previa = process.env.OLLAMA_BASE_URL;
    process.env.OLLAMA_BASE_URL = "http://127.0.0.1:9"; // puerto cerrado: basta con ver a quién se llamó
    try {
      const r = await crearLlamador(registry, undefined, tmpdir()).llamar({ agente: "tester", modeloAlias: "haiku", userPrompt: "x", proveedorLocal: true });
      assert.equal(r.proveedor, "ollama");
      assert.equal(r.ok, false);
    } finally {
      if (previa === undefined) delete process.env.OLLAMA_BASE_URL; else process.env.OLLAMA_BASE_URL = previa;
    }
  });
});

describe("grafo y redacción", () => {
  test("transicion rechaza un nodo desconocido", () => {
    const e = estadoInicial(TAREA, { runId: "r", cwd: "/p" });
    assert.throws(() => transicion("inventado", e), /nodo desconocido/);
    assert.deepEqual(transicion("retriever", e), { siguiente: "qa", parcial: {} });
  });

  test("la salida que llega a eventos y prompts no lleva secretos ni crece sin límite", () => {
    const limpio = redactar("API_KEY=abcdef123456 token: 'zzzzzzzzzz' sk-abcdefghijklmnopqrstuvwx Bearer abcdefghijklmnopqrstuvwxyz");
    assert.ok(!/abcdef123456|zzzzzzzzzz|sk-abc|Bearer abc/.test(limpio), limpio);
    assert.ok(limpio.includes("API_KEY=[REDACTADO]"));
    assert.equal(redactar("AssertionError: 3 !== 4"), "AssertionError: 3 !== 4");

    const larga = cola("x".repeat(20_000) + "FINAL", 100);
    assert.equal(larga.length, 100);
    assert.ok(larga.endsWith("FINAL"));
  });
});
