// @ts-check
/**
 * Rojo obligatorio (spec 2026-10-09-pruebas-confiables, HU-001; ADR-20).
 *
 * Unas pruebas que pasan sin que exista la implementación no demuestran nada. Antes solo quedaba
 * un aviso; ahora el agente de pruebas lo intenta una vez más y, si vuelven a pasar, la tarea se
 * pausa con el motivo `pruebas_no_fallan` sin llamar al implementador.
 *
 * Proveedor y ejecutor guionizados: sin modelos ni Docker.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { CicloVerificado } from "../core/ciclo/index.js";
import { POR_DEFECTO } from "../core/ciclo/config.js";
import { estadoInicial, MOTIVOS, validarEstado } from "../core/ciclo/estado.js";
import { transicion } from "../core/ciclo/grafo.js";
import { normalizarTareas } from "../core/tareas.js";
import { aplicarArchivos, clasificarRuta, CARPETAS_CONFIGURACION, CONFIGURACION } from "../core/ciclo/protocolo-archivos.js";

const bloque = (ruta, contenido) => "```json\n" + JSON.stringify({ archivos: [{ ruta, contenido }] }) + "\n```";
const PLAN      = '{"pasos":["implementar"],"archivosObjetivo":["src/suma.js"]}';
const PRUEBAS_1 = bloque("tests/suma.test.js", "// primera versión: no comprueba nada\n");
const PRUEBAS_2 = bloque("tests/suma.test.js", "// segunda versión: importa suma y comprueba 2 + 2\n");
const PRUEBAS_3 = bloque("tests/suma.test.js", "// tercera versión\n");
const IMPL      = bloque("src/suma.js", "// implementación\n");
const TAREA     = { id: "T1", agente: "desarrollador-backend", prompt: "Implementa suma", archivos: ["src/suma.js"] };

const PASA  = { exitCode: 0, stdout: "# tests 1\n# pass 1\n" };
const FALLA = { exitCode: 1, stdout: "# tests 1\n# pass 0\n# fail 1\n", stderr: "Cannot find module '../src/suma.js'\n" };
const INFRA = { exitCode: null, infraError: true, stderr: "docker: el daemon no responde\n" };
/** Consumo de una llamada: 10 000 tokens de entrada de sonnet = 0,03 USD */
const USO = { inputTokens: 10_000, outputTokens: 0, modelo: "claude-sonnet-4-6", proveedor: "anthropic" };

/**
 * @param {{ ejecuciones: any[], tester?: any[], coder?: string[], testCmd?: string, presupuesto?: any }} o
 */
function entorno(o) {
  const cwd = mkdtempSync(join(tmpdir(), "forge-rojo-"));
  const cola = [...o.ejecuciones];
  const llamadas = [];
  const eventos = [];
  const guion = { arquitecto: [PLAN], tester: [...(o.tester ?? [PRUEBAS_1, PRUEBAS_2, PRUEBAS_3])], "desarrollador-backend": [...(o.coder ?? [IMPL])] };
  const opciones = {
    cwd, runId: "r1", testCmd: o.testCmd ?? "npm test",
    // La medición por mutación tiene sus tests en ciclo-mutacion.test.js: aquí se desactiva
    config: { ...POR_DEFECTO, motor: { ...POR_DEFECTO.motor, grafo: "propio", mutacion: "no" }, presupuesto: { ...POR_DEFECTO.presupuesto, ...o.presupuesto } },
    log: { append: (type, payload, meta) => eventos.push({ type, payload, meta }) },
    aliasDe: () => "sonnet",
    llamar: async (p) => {
      llamadas.push(p);
      const s = guion[p.agente]?.shift();
      if (s === undefined) throw new Error(`guion agotado para ${p.agente}`);
      if (typeof s === "object") return { ok: false, ...s };
      return { ok: true, output: s, ...USO };
    },
    runner: { test: async () => {
      const r = cola.shift();
      if (r === undefined) throw new Error("guion de ejecuciones agotado");
      return { stdout: "", stderr: "", timedOut: false, infraError: false, durationMs: 1, ...r };
    } },
  };
  return {
    cwd, llamadas, eventos, cola,
    agentes: () => llamadas.map((l) => l.agente),
    rojo: () => eventos.filter((e) => e.type === "ciclo:rojo").map((e) => e.payload.resultado),
    leer: (ruta) => readFileSync(join(cwd, ruta), "utf8"),
    ciclo: () => new CicloVerificado(/** @type {any} */ (opciones)),
  };
}

describe("CA-001-01 — si las pruebas pasan sin implementación, el agente de pruebas lo intenta una vez más", () => {
  test("recibe el resultado y sus pruebas; si la segunda versión falla, el ciclo sigue", async () => {
    const e = entorno({ ejecuciones: [PASA, FALLA, PASA] });
    const r = await e.ciclo().ejecutar(TAREA);

    assert.equal(r.estado.resultado, "exito");
    assert.deepEqual(e.agentes(), ["arquitecto", "tester", "tester", "desarrollador-backend"]);
    assert.equal(e.cola.length, 0);

    const [primera, segunda] = e.llamadas.filter((l) => l.agente === "tester");
    assert.doesNotMatch(primera.userPrompt, /pasan sin que exista la implementación/);
    assert.match(segunda.userPrompt, /Tus pruebas pasan sin que exista la implementación/);
    assert.match(segunda.userPrompt, /código 0/);
    assert.match(segunda.userPrompt, /primera versión: no comprueba nada/, "recibe las pruebas que escribió");
    assert.match(segunda.userPrompt, /Implementa suma/, "y sigue recibiendo la tarea");

    assert.equal(e.leer("tests/suma.test.js"), "// segunda versión: importa suma y comprueba 2 + 2\n");
    assert.deepEqual(r.estado.rojo, { estado: "fallan", reintentado: true });
    assert.deepEqual(e.rojo(), ["pasan", "fallan"]);
    assert.deepEqual(validarEstado(r.estado), []);
  });

  test("las huellas guardadas son las de la versión corregida: el implementador no puede tocarlas", async () => {
    const e = entorno({ ejecuciones: [PASA, FALLA, PASA] });
    const r = await e.ciclo().ejecutar(TAREA);
    assert.equal(r.estado.pruebas.archivos.length, 1);
    assert.equal(r.estado.pruebas.archivos[0].ruta, "tests/suma.test.js");
    const implementador = e.llamadas.find((l) => l.agente === "desarrollador-backend");
    assert.match(implementador.userPrompt, /segunda versión/);
    assert.doesNotMatch(implementador.userPrompt, /primera versión/);
  });

  test("si el reintento escribe otro archivo, se conservan las huellas de los dos", async () => {
    const e = entorno({ ejecuciones: [PASA, FALLA, PASA], tester: [PRUEBAS_1, bloque("tests/suma-resultados.test.js", "// nuevas\n")] });
    const r = await e.ciclo().ejecutar(TAREA);
    assert.deepEqual(r.estado.pruebas.archivos.map((a) => a.ruta), ["tests/suma.test.js", "tests/suma-resultados.test.js"]);
  });

  test("unas pruebas que fallan a la primera no provocan ningún reintento", async () => {
    const e = entorno({ ejecuciones: [FALLA, PASA] });
    const r = await e.ciclo().ejecutar(TAREA);
    assert.equal(r.estado.resultado, "exito");
    assert.deepEqual(e.agentes(), ["arquitecto", "tester", "desarrollador-backend"]);
    assert.deepEqual(r.estado.rojo, { estado: "fallan", reintentado: false });
    assert.deepEqual(e.rojo(), ["fallan"]);
  });

  test("agotar el tiempo sin implementación también es rojo", async () => {
    const e = entorno({ ejecuciones: [{ exitCode: null, timedOut: true }, PASA] });
    const r = await e.ciclo().ejecutar(TAREA);
    assert.equal(r.estado.resultado, "exito");
    assert.equal(r.estado.rojo?.estado, "fallan");
    assert.deepEqual(e.agentes(), ["arquitecto", "tester", "desarrollador-backend"]);
  });
});

describe("CA-001-02 — si siguen pasando, revisión humana con motivo propio y sin implementador", () => {
  test("pasan dos veces: la tarea se pausa con pruebas_no_fallan, reanudando en qa", async () => {
    const e = entorno({ ejecuciones: [PASA, PASA] });
    const r = await e.ciclo().ejecutar(TAREA);

    assert.equal(r.status, "en_revision");
    assert.equal(r.estado.resultado, "revision_pendiente");
    assert.equal(r.estado.revision?.motivo, "pruebas_no_fallan");
    assert.equal(r.estado.revision?.reanudarEn, "qa");
    const detalle = String(r.estado.revision?.detalle);
    assert.match(detalle, /pasan \(código 0\) sin que exista la implementación/);
    assert.match(detalle, /no se ha llamado al implementador/);
    assert.match(detalle, /continuar/);
    assert.match(detalle, /aceptar/);
    assert.match(detalle, /abortar/);
    assert.match(detalle, /parte_de_codigo_existente/);

    assert.deepEqual(e.agentes(), ["arquitecto", "tester", "tester"], "el implementador no se ejecuta");
    assert.ok(!existsSync(join(e.cwd, "src", "suma.js")), "no se escribió ninguna implementación");
    assert.equal(e.cola.length, 0, "solo las dos comprobaciones");
    assert.equal(r.estado.iteracion, 0);
    assert.deepEqual(r.estado.ejecuciones, []);
    assert.deepEqual(r.estado.rojo, { estado: "pasan", reintentado: true });
    assert.deepEqual(e.rojo(), ["pasan", "pasan"]);
    assert.deepEqual(validarEstado(r.estado), []);
    assert.equal(e.eventos.find((x) => x.type === "task_paused")?.payload.motivo, "pruebas_no_fallan");
  });

  test("escenario 2: mientras nadie decide, no se gasta nada", async () => {
    const e = entorno({ ejecuciones: [PASA, PASA] });
    await e.ciclo().ejecutar(TAREA);
    const r = await e.ciclo().ejecutar(TAREA);
    assert.equal(r.estado.revision?.motivo, "pruebas_no_fallan");
    assert.equal(e.llamadas.length, 3);
  });

  test("«continuar» hace que el agente de pruebas las reescriba sabiendo qué pasó", async () => {
    const e = entorno({ ejecuciones: [PASA, PASA, FALLA, PASA] });
    await e.ciclo().ejecutar(TAREA);
    const r = await e.ciclo().ejecutar(TAREA, { decision: "continuar" });

    assert.equal(r.estado.resultado, "exito");
    assert.deepEqual(e.agentes(), ["arquitecto", "tester", "tester", "tester", "desarrollador-backend"]);
    const tercera = e.llamadas[3];
    assert.match(tercera.userPrompt, /Tus pruebas anteriores pasaban sin que existiera la implementación/);
    assert.match(tercera.userPrompt, /segunda versión/, "recibe las últimas pruebas que escribió");
    assert.doesNotMatch(tercera.userPrompt, /El ejecutor no encontró tus pruebas/);
    assert.equal(e.leer("tests/suma.test.js"), "// tercera versión\n");
    assert.deepEqual(r.estado.rojo, { estado: "fallan", reintentado: false });
  });

  test("«aceptar» da la tarea por buena y «abortar» retira las pruebas", async () => {
    const a = entorno({ ejecuciones: [PASA, PASA] });
    await a.ciclo().ejecutar(TAREA);
    assert.equal((await a.ciclo().ejecutar(TAREA, { decision: "aceptar" })).estado.resultado, "aceptada_por_humano");

    const b = entorno({ ejecuciones: [PASA, PASA] });
    await b.ciclo().ejecutar(TAREA);
    assert.equal((await b.ciclo().ejecutar(TAREA, { decision: "abortar" })).estado.resultado, "abortada");
    assert.ok(!existsSync(join(b.cwd, "tests", "suma.test.js")));
  });

  test("pruebas_no_fallan es un motivo de revisión válido", () => {
    assert.ok(MOTIVOS.includes("pruebas_no_fallan"));
    const e = estadoInicial(TAREA, { runId: "r1", cwd: "/tmp/x" });
    e.revision = { motivo: "pruebas_no_fallan", reanudarEn: "qa" };
    e.resultado = "revision_pendiente";
    e.rojo = { estado: "pasan", reintentado: true };
    assert.deepEqual(validarEstado(e), []);
    // El grafo lleva a revisión sin pasar por el implementador
    assert.equal(transicion("qa", e).siguiente, "revision_humana");
    e.rojo = /** @type {any} */ ({ estado: "verde" });
    assert.match(validarEstado(e).join("\n"), /estado del rojo desconocido/);
  });
});

describe("CA-001-03 — una tarea que parte de código existente queda exenta", () => {
  const EXENTA = { ...TAREA, parte_de_codigo_existente: true };

  test("no hay reintento ni pausa, y la exención queda anotada en el registro", async () => {
    const e = entorno({ ejecuciones: [PASA, PASA] });
    const r = await e.ciclo().ejecutar(EXENTA);

    assert.equal(r.estado.resultado, "exito");
    assert.deepEqual(e.agentes(), ["arquitecto", "tester", "desarrollador-backend"]);
    assert.deepEqual(r.estado.rojo, { estado: "exenta", reintentado: false });
    const evento = e.eventos.find((x) => x.type === "ciclo:rojo");
    assert.equal(evento?.payload.resultado, "exenta");
    assert.match(evento?.payload.motivo, /parte_de_codigo_existente/);
    assert.equal(evento?.meta.taskId, "T1");
    assert.ok(e.eventos.some((x) => x.payload.aviso === "pruebas_no_fallan"), "el aviso de siempre se conserva");
  });

  test("si sus pruebas fallan, no hace falta la exención y no se anota", async () => {
    const e = entorno({ ejecuciones: [FALLA, PASA] });
    const r = await e.ciclo().ejecutar(EXENTA);
    assert.equal(r.estado.rojo?.estado, "fallan");
    assert.deepEqual(e.rojo(), ["fallan"]);
  });

  test("el campo se propaga de la tarea al estado, y solo si es exactamente true", () => {
    const base = { runId: "r1", cwd: "/tmp/x" };
    assert.equal(estadoInicial(EXENTA, base).tarea.parte_de_codigo_existente, true);
    assert.ok(!("parte_de_codigo_existente" in estadoInicial(TAREA, base).tarea));
    assert.ok(!("parte_de_codigo_existente" in estadoInicial(/** @type {any} */ ({ ...TAREA, parte_de_codigo_existente: "sí" }), base).tarea));
    assert.ok(!("parte_de_codigo_existente" in estadoInicial({ ...TAREA, parte_de_codigo_existente: false }, base).tarea));
  });

  test("normalizarTareas conserva el campo de las tareas que genera /sdd.tareas", () => {
    const tareas = normalizarTareas({ tareas: {
      T001: { estado: "pendiente", agente: "desarrollador-backend", parte_de_codigo_existente: true },
      T002: { estado: "pendiente", agente: "desarrollador-backend" },
    } });
    assert.equal(tareas[0].parte_de_codigo_existente, true);
    assert.ok(!("parte_de_codigo_existente" in tareas[1]));
  });
});

describe("CA-001-04 — un fallo del entorno en esta comprobación es un fallo de infraestructura", () => {
  test("no cuenta como «fallan» ni como «pasan»: se pausa sin llamar al implementador", async () => {
    const e = entorno({ ejecuciones: [INFRA] });
    const r = await e.ciclo().ejecutar(TAREA);

    assert.equal(r.estado.resultado, "revision_pendiente");
    assert.equal(r.estado.revision?.motivo, "infraestructura");
    assert.equal(r.estado.revision?.reanudarEn, "qa");
    assert.match(String(r.estado.revision?.detalle), /el daemon no responde/);
    assert.match(String(r.estado.revision?.detalle), /sin volver a pedir las pruebas/);
    assert.deepEqual(e.agentes(), ["arquitecto", "tester"]);
    assert.deepEqual(r.estado.rojo, { estado: "sin_comprobar", reintentado: false });
    assert.deepEqual(e.rojo(), ["sin_comprobar"]);
    assert.deepEqual(validarEstado(r.estado), []);
  });

  test("los códigos 125 a 127 del runtime también son del entorno", async () => {
    for (const exitCode of [125, 126, 127]) {
      const e = entorno({ ejecuciones: [{ exitCode, stderr: "docker: error" }] });
      const r = await e.ciclo().ejecutar(TAREA);
      assert.equal(r.estado.revision?.motivo, "infraestructura", String(exitCode));
      assert.equal(r.estado.rojo?.estado, "sin_comprobar", String(exitCode));
    }
  });

  test("«continuar» repite la comprobación sin volver a pagar las pruebas", async () => {
    const e = entorno({ ejecuciones: [INFRA, FALLA, PASA] });
    await e.ciclo().ejecutar(TAREA);
    const r = await e.ciclo().ejecutar(TAREA, { decision: "continuar" });
    assert.equal(r.estado.resultado, "exito");
    assert.deepEqual(e.agentes(), ["arquitecto", "tester", "desarrollador-backend"], "el agente de pruebas no se llama otra vez");
    assert.equal(r.estado.rojo?.estado, "fallan");
  });

  test("tras el fallo del entorno la regla sigue siendo la misma: si pasan, un reintento; si vuelven a pasar, pausa", async () => {
    const e = entorno({ ejecuciones: [INFRA, PASA, PASA] });
    await e.ciclo().ejecutar(TAREA);
    const r = await e.ciclo().ejecutar(TAREA, { decision: "continuar" });
    assert.equal(r.estado.revision?.motivo, "pruebas_no_fallan");
    assert.deepEqual(e.agentes(), ["arquitecto", "tester", "tester"]);
  });

  test("si el entorno falla en la comprobación del reintento, al continuar no se regala otro reintento", async () => {
    const e = entorno({ ejecuciones: [PASA, INFRA, PASA] });
    const pausa = await e.ciclo().ejecutar(TAREA);
    assert.deepEqual(pausa.estado.rojo, { estado: "sin_comprobar", reintentado: true });
    const r = await e.ciclo().ejecutar(TAREA, { decision: "continuar" });
    assert.equal(r.estado.revision?.motivo, "pruebas_no_fallan");
    assert.deepEqual(e.agentes(), ["arquitecto", "tester", "tester"]);
  });

  test("si las pruebas cambiaron en disco durante la pausa, se piden de nuevo", async () => {
    const e = entorno({ ejecuciones: [INFRA, FALLA, PASA] });
    await e.ciclo().ejecutar(TAREA);
    writeFileSync(join(e.cwd, "tests", "suma.test.js"), "// tocada a mano\n");
    const r = await e.ciclo().ejecutar(TAREA, { decision: "continuar" });
    assert.equal(r.estado.resultado, "exito");
    assert.deepEqual(e.agentes(), ["arquitecto", "tester", "tester", "desarrollador-backend"]);
  });

  test("que el ejecutor no encuentre ninguna prueba (código 5 con pytest) sigue tratándose como antes", async () => {
    const e = entorno({ ejecuciones: [{ exitCode: 5 }], testCmd: "python -m pytest" });
    const r = await e.ciclo().ejecutar(TAREA);
    assert.equal(r.estado.revision?.motivo, "infraestructura");
    assert.match(String(r.estado.revision?.detalle), /sin encontrar ninguna prueba/);
    assert.equal(r.estado.rojo, null);
  });
});

describe("CA-001-05 — el intento adicional cuenta para el tope de gasto", () => {
  test("la llamada del reintento se suma al gasto de la sesión", async () => {
    const e = entorno({ ejecuciones: [PASA, FALLA, PASA] });
    const ciclo = e.ciclo();
    const r = await ciclo.ejecutar(TAREA);
    // arquitecto + tester + tester (reintento) + implementador = 4 llamadas de 0,03 USD
    assert.equal(r.estado.presupuesto.llamadas, 4);
    assert.ok(Math.abs(r.estado.presupuesto.gastado_usd - 0.12) < 1e-9);
    assert.equal(ciclo.libro.total().llamadas, 4);
  });

  test("con el presupuesto agotado el reintento no se inicia: se pregunta antes de gastar", async () => {
    // Tope de 0,06 USD: caben el arquitecto y el agente de pruebas; el reintento ya no
    const e = entorno({ ejecuciones: [PASA, FALLA, PASA], presupuesto: { tope_usd: 0.06, umbral_degradacion_usd: 0.06 } });
    const r = await e.ciclo().ejecutar(TAREA);
    assert.equal(r.estado.revision?.motivo, "presupuesto");
    assert.equal(r.estado.revision?.reanudarEn, "qa");
    assert.equal(e.llamadas.length, 2);
    assert.deepEqual(r.estado.rojo, { estado: "pasan", reintentado: false });
    assert.deepEqual(validarEstado(r.estado), []);

    // Al ampliar, el agente de pruebas sabe que las anteriores pasaban
    const seguido = await e.ciclo().ejecutar(TAREA, { decision: "continuar", presupuestoExtra: 1 });
    assert.equal(seguido.estado.resultado, "exito");
    assert.match(e.llamadas[2].userPrompt, /Tus pruebas anteriores pasaban sin que existiera la implementación/);
  });

  test("si el reintento no devuelve ninguna prueba válida, se pide revisión por salida inválida", async () => {
    const e = entorno({ ejecuciones: [PASA], tester: [PRUEBAS_1, bloque("src/suma.js", "// no es una prueba\n")] });
    const r = await e.ciclo().ejecutar(TAREA);
    assert.equal(r.estado.revision?.motivo, "salida_invalida");
    assert.deepEqual(e.agentes(), ["arquitecto", "tester", "tester"]);
    assert.ok(!existsSync(join(e.cwd, "src", "suma.js")));
  });

  test("si el proveedor falla en el reintento, se pausa por infraestructura sin llamar al implementador", async () => {
    const e = entorno({ ejecuciones: [PASA], tester: [PRUEBAS_1, { error: "503 del proveedor" }] });
    const r = await e.ciclo().ejecutar(TAREA);
    assert.equal(r.estado.revision?.motivo, "infraestructura");
    assert.match(String(r.estado.revision?.detalle), /503 del proveedor/);
    assert.deepEqual(e.agentes(), ["arquitecto", "tester", "tester"]);
  });
});

describe("reanudación tras un corte", () => {
  test("un corte entre el reintento y su comprobación no paga dos veces ninguna llamada", async () => {
    const e = entorno({ ejecuciones: [PASA] });
    await assert.rejects(e.ciclo().ejecutar(TAREA), /guion de ejecuciones agotado/);
    assert.deepEqual(e.agentes(), ["arquitecto", "tester", "tester"]);

    // Al reanudar se repite el nodo qa entero: las dos respuestas salen del diario
    e.cola.push(PASA, FALLA, PASA);
    const r = await e.ciclo().ejecutar(TAREA);
    assert.equal(r.estado.resultado, "exito");
    assert.deepEqual(e.agentes(), ["arquitecto", "tester", "tester", "desarrollador-backend"]);
    assert.equal(r.estado.presupuesto.llamadas, 4);
  });
});

// ── HU-004: menos vías para anular las pruebas ───────────────────────────────

describe("CA-004-01 — los archivos que el ejecutor de pruebas carga solo exigen revisión humana", () => {
  test("jest.setup.*, vitest.workspace.*, karma.conf.* y __mocks__/ se clasifican como configuración, a cualquier profundidad", () => {
    for (const ruta of [
      "jest.setup.js", "jest.setup.ts", "jest.setup.mjs", "packages/api/jest.setup.cjs", "JEST.SETUP.JS",
      "vitest.workspace.ts", "vitest.workspace.js", "vitest.workspace.json", "apps/web/vitest.workspace.mts",
      "karma.conf.js", "karma.conf.cjs", "karma.conf.ts", "front/karma.conf.js",
      "__mocks__/fs.js", "src/__mocks__/api.js", "src/servicios/__mocks__/cliente.ts", "tests/__mocks__/axios.js", "__MOCKS__/fs.js",
    ]) {
      assert.equal(clasificarRuta(ruta), "configuracion", ruta);
    }
    for (const patron of ["jest.setup.*", "vitest.workspace.*", "karma.conf.*"]) assert.ok(CONFIGURACION.includes(patron), patron);
    assert.deepEqual(CARPETAS_CONFIGURACION, ["__mocks__"]);
  });

  test("no arrastra archivos normales con nombres parecidos", () => {
    for (const ruta of ["src/jest.setupHelper.js", "src/setup.js", "src/karma.js", "src/vitest.js", "src/mocks/api.js", "src/__mocks__.js", "src/mis__mocks__/a.js", "docs/karma.md"]) {
      assert.equal(clasificarRuta(ruta), null, ruta);
    }
  });

  test("propuestos por el implementador no se escriben y marcan que hace falta revisión", () => {
    const cwd = mkdtempSync(join(tmpdir(), "forge-hu004-"));
    const propuestos = ["jest.setup.js", "vitest.workspace.ts", "karma.conf.js", "src/__mocks__/suma.js"];
    const r = aplicarArchivos(cwd, [{ ruta: "src/suma.js", contenido: "x" }, ...propuestos.map((ruta) => ({ ruta, contenido: "jest.mock('./suma')" }))], { rol: "coder" });
    assert.deepEqual(r.escritos.map((a) => a.ruta), ["src/suma.js"]);
    assert.deepEqual(r.rechazados, propuestos.map((ruta) => ({ ruta, motivo: "configuracion" })));
    assert.equal(r.requiereRevision, true);
    for (const ruta of propuestos) assert.ok(!existsSync(join(cwd, ruta)), ruta);
  });

  test("tampoco los escribe el agente de pruebas, aunque estén dentro de tests/", () => {
    const cwd = mkdtempSync(join(tmpdir(), "forge-hu004-"));
    const r = aplicarArchivos(cwd, [{ ruta: "tests/__mocks__/suma.js", contenido: "x" }, { ruta: "tests/suma.test.js", contenido: "x" }], { rol: "qa" });
    assert.deepEqual(r.escritos.map((a) => a.ruta), ["tests/suma.test.js"]);
    assert.deepEqual(r.rechazados, [{ ruta: "tests/__mocks__/suma.js", motivo: "configuracion" }]);
  });

  test("ciclo completo: si el implementador propone jest.setup.js, la tarea se pausa y el archivo no existe", async () => {
    const propuesta = "```json\n" + JSON.stringify({ archivos: [
      { ruta: "src/suma.js", contenido: "// implementación\n" },
      { ruta: "jest.setup.js", contenido: "globalThis.test = () => {};\n" },
    ] }) + "\n```";
    const e = entorno({ ejecuciones: [FALLA], coder: [propuesta] });
    const r = await e.ciclo().ejecutar(TAREA);
    assert.equal(r.estado.resultado, "revision_pendiente");
    assert.equal(r.estado.revision?.motivo, "dependencias");
    assert.match(String(r.estado.revision?.detalle), /jest\.setup\.js/);
    assert.ok(!existsSync(join(e.cwd, "jest.setup.js")));
    assert.equal(e.cola.length, 0, "las pruebas no llegan a ejecutarse con la propuesta");
  });
});
