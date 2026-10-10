// @ts-check
/**
 * Hallazgos de la revisión independiente de la fase 7 (ADR-20): H-02 a H-09.
 * (H-01 se prueba en tests/ciclo-rojo-obligatorio.test.js y tests/ciclo-sin-progreso.test.js.)
 *
 * Sin modelos ni claves. Casi todo usa un ejecutor falso; H-02 usa `node --test` de verdad sobre la
 * copia temporal (el mismo comando del proyecto de prueba) y H-03 tiene además un caso con Docker real
 * que solo corre con FORGE_TEST_DOCKER=1.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, statSync, utimesSync, writeFileSync, symlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

import {
  alteracionesDe, barrerMutacionesHuerfanas, generarAlteraciones, juzgar, medirMutacion, senalDeFallo, seleccionar, seleccionarPorArchivo,
} from "../core/ciclo/mutacion.js";
import { decidirTrasMutacion, detalleMedicionInsuficiente } from "../core/ciclo/router.js";
import { estadoInicial } from "../core/ciclo/estado.js";
import { transicion } from "../core/ciclo/grafo.js";
import { leerConfigCiclo, POR_DEFECTO } from "../core/ciclo/config.js";
import { crearCopia } from "../core/sandbox/staging.js";
import { DockerCli } from "../core/sandbox/docker-cli.js";
import { SandboxRunner } from "../core/sandbox/sandbox-runner.js";

const tmp = (p) => mkdtempSync(join(tmpdir(), p));

/** @param {string} cwd @param {Record<string, string>} archivos */
function escribir(cwd, archivos) {
  for (const [ruta, contenido] of Object.entries(archivos)) {
    mkdirSync(join(cwd, ruta, ".."), { recursive: true });
    writeFileSync(join(cwd, ruta), contenido);
  }
  return cwd;
}

const PASE = { exitCode: 0, stdout: "# tests 1\n# pass 1\n", stderr: "", timedOut: false, infraError: false, durationMs: 3 };
const FALLO_PRUEBA = {
  exitCode: 1, stdout: "TAP version 13\n# Subtest: suma\nnot ok 1 - suma\n  ---\n  failureType: 'testCodeFailure'\n  ...\n1..1\n# fail 1\n",
  stderr: "", timedOut: false, infraError: false, durationMs: 3,
};
/** El módulo no se cargó: node:test informa un «fallo» llamado como el archivo de pruebas. */
const FALLO_CARGA = {
  exitCode: 1, stdout: "TAP version 13\n# Subtest: suma.test.js\nnot ok 1 - suma.test.js\n  ---\n  failureType: 'testCodeFailure'\n  error: 'test failed'\n  ...\n1..1\n# fail 1\n",
  stderr: "Error: trampa\n    at file:///x/guardia.js:1:36\n", timedOut: false, infraError: false, durationMs: 3,
};

const IMPL = "export function suma(a, b) {\n  if (a < 0) {\n    return 0;\n  }\n  return a + b;\n}\n";
const proyecto = (extra = {}) => escribir(tmp("forge-mrev-"), { "package.json": "{\"type\":\"module\"}", "src/suma.js": IMPL, "tests/suma.test.js": "// nada\n", ...extra });

// ── H-02: un fallo al cargar el módulo no es una detección ───────────────────

describe("H-02 — fallo de carga frente a fallo de prueba", () => {
  test("node:test (TAP y spec): una prueba con nombre propio que falla es un fallo de prueba; un «fallo» llamado como el archivo es un fallo de carga", () => {
    assert.equal(senalDeFallo("not ok 1 - suma devuelve 3\n", "javascript"), "prueba");
    assert.equal(senalDeFallo("    not ok 2 - dentro de un describe\n", "javascript"), "prueba");
    assert.equal(senalDeFallo("✖ suma devuelve 3 (2.2ms)\nℹ fail 1\n", "javascript"), "prueba");
    assert.notEqual(senalDeFallo("not ok 1 - tests/suma.test.js\n", "javascript"), "prueba");
    assert.notEqual(senalDeFallo("✖ suma.test.js (115.6ms)\nℹ fail 1\n", "javascript"), "prueba");
    assert.notEqual(senalDeFallo("✖ C:\\proy\\tests\\suma.test.mjs (9ms)\n", "javascript"), "prueba");
    // Sin ningún marcador reconocible: no se adivina
    assert.equal(senalDeFallo("algo falló\n", "javascript"), "sin_senal");
    assert.equal(senalDeFallo("", "javascript"), "sin_senal");
  });

  test("jest, vitest y errores de compilación de TypeScript", () => {
    assert.equal(senalDeFallo("  ● suma › devuelve 3\n\nTests:       1 failed, 2 passed, 3 total\n", "javascript"), "prueba");
    assert.equal(senalDeFallo(" FAIL  tests/suma.test.ts > suma > devuelve 3\n Tests  1 failed | 2 passed (3)\n", "typescript"), "prueba");
    assert.equal(senalDeFallo("  ● Test suite failed to run\n\n    Cannot find module '../src/x'\n", "javascript"), "no_carga");
    assert.equal(senalDeFallo(" FAIL  tests/suma.test.ts [ tests/suma.test.ts ]\nError: Failed to load url ../src/x\n Failed Suites 1\n", "typescript"), "no_carga");
    assert.equal(senalDeFallo("Test suite failed to run\n\nsrc/suma.ts:3:5 - error TS2322: Type 'string' is not assignable to type 'number'.\n", "typescript"), "no_compila");
    assert.equal(senalDeFallo("SyntaxError: Unexpected token ')'\n", "javascript"), "no_compila");
  });

  test("Python: SyntaxError e ImportError no son fallos de prueba; FAILED y FAIL: sí", () => {
    assert.equal(senalDeFallo("FAILED tests/test_suma.py::test_suma - assert 4 == 5\n=== 1 failed in 0.1s ===\n", "python"), "prueba");
    assert.equal(senalDeFallo("FAIL: test_suma (tests.test_suma.T)\nAssertionError\nFAILED (failures=1)\n", "python"), "prueba");
    assert.equal(senalDeFallo("ERROR: test_suma (tests.test_suma.T)\nTypeError: x\nFAILED (errors=1)\n", "python"), "prueba");
    assert.equal(senalDeFallo("ERROR collecting tests/test_suma.py\nE   SyntaxError: invalid syntax\n!!! Interrupted: 1 error during collection !!!\n", "python"), "no_compila");
    assert.equal(senalDeFallo("ERROR: tests.test_suma (unittest.loader._FailedTest.tests.test_suma)\nImportError: Failed to import test module: tests.test_suma\nFAILED (errors=1)\n", "python"), "no_carga");
    assert.equal(senalDeFallo("IndentationError: unexpected indent\n", "python"), "no_compila");
    assert.equal(senalDeFallo("boom\n", "python"), "sin_senal");
  });

  test("Go: [build failed] no es un fallo de prueba; --- FAIL y panic sí", () => {
    assert.equal(senalDeFallo("# demo\n./demo.go:6:7: duplicate case 2 in expression switch\nFAIL\tdemo [build failed]\n", "go"), "no_compila");
    assert.equal(senalDeFallo("--- FAIL: TestSuma (0.00s)\n    demo_test.go:9: quería 3\nFAIL\nFAIL\tdemo\t0.003s\n", "go"), "prueba");
    assert.equal(senalDeFallo("panic: runtime error: index out of range\ngoroutine 6 [running]:\nFAIL\tdemo\t0.004s\n", "go"), "prueba");
    assert.equal(senalDeFallo("FAIL\tdemo [setup failed]\n", "go"), "no_compila");
    assert.equal(senalDeFallo("FAIL\n", "go"), "sin_senal");
  });

  test("juzgar: pase = sobrevive; tiempo agotado = detectada; fallo sin señal = no concluyente; 137 y 139 = entorno", () => {
    assert.equal(juzgar(PASE, "pass", "javascript").veredicto, "sobrevive");
    assert.deepEqual(juzgar({ exitCode: null, timedOut: true }, "timeout", "javascript"), { veredicto: "detectada", motivo: "tiempo_agotado" });
    assert.deepEqual(juzgar(FALLO_PRUEBA, "fail", "javascript"), { veredicto: "detectada", motivo: "prueba_fallida" });
    assert.deepEqual(juzgar(FALLO_CARGA, "fail", "javascript"), { veredicto: "no_concluyente", motivo: "no_carga" });
    assert.deepEqual(juzgar({ exitCode: 1, stdout: "", stderr: "" }, "fail", "javascript"), { veredicto: "no_concluyente", motivo: "sin_senal" });
    assert.deepEqual(juzgar({ ...FALLO_PRUEBA, exitCode: 137 }, "fail", "javascript"), { veredicto: "no_concluyente", motivo: "entorno" });
    assert.deepEqual(juzgar({ ...FALLO_PRUEBA, exitCode: 139 }, "fail", "javascript"), { veredicto: "no_concluyente", motivo: "entorno" });
    assert.deepEqual(juzgar({ ...FALLO_PRUEBA, exitCode: 1, oomKilled: true }, "fail", "javascript"), { veredicto: "no_concluyente", motivo: "entorno" });
  });

  const hayNode = spawnSync(process.execPath, ["--version"]).status === 0;

  test("reproducción de la revisión: un archivo con cables trampa y pruebas sin aserciones ya NO infla la puntuación (node --test real)", { skip: !hayNode }, async () => {
    const trampas = Array.from({ length: 12 }, (_, i) => `export const K${i} = ${i + 1};\nif (K${i} !== ${i + 1}) throw new Error('trampa ${i}');`).join("\n") + "\n";
    const cwd = proyecto({
      "src/guardia.js": trampas,
      "tests/suma.test.js": "import { test } from 'node:test';\nimport { suma } from '../src/suma.js';\nimport '../src/guardia.js';\ntest('se puede llamar', () => { suma(1, 2); suma(-1, 2); });\n",
    });
    // El ejecutor del proyecto de prueba: node --test sobre la copia (lo que haría `npm test` dentro del contenedor)
    const runner = {
      test: async (dir) => {
        const { NODE_TEST_CONTEXT, ...env } = process.env; // sin esto el node hijo cree que es una prueba más del ejecutor padre
        void NODE_TEST_CONTEXT;
        const r = spawnSync(process.execPath, ["--test"], { cwd: dir, env, encoding: "utf8", timeout: 60_000 });
        return { exitCode: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "", timedOut: false, infraError: false, durationMs: 1 };
      },
    };
    const eventos = [];
    const r = await medirMutacion({ cwd, archivos: ["src/suma.js", "src/guardia.js"], runner, alProbar: (e) => eventos.push(e) });
    assert.ok(r);
    assert.equal(r.lineaBase, "ok");
    assert.equal(r.detectadas, 0, "unas pruebas sin aserciones no detectan nada: " + JSON.stringify(eventos.map((e) => [e.alteracion.ruta, e.resultado, e.motivo])));
    assert.equal(r.puntuacion, 0);
    assert.equal(r.probadas, 6, "las seis alteraciones concluyentes son las de suma.js: la reserva sustituyó a las descartadas " + JSON.stringify(r.sobrevivientes.map((s) => s.despues)));
    assert.ok(r.sobrevivientes.every((s) => s.ruta === "src/suma.js"));
    assert.ok(r.noConcluyentes >= 5, `las alteraciones de guardia.js son no concluyentes (${r.noConcluyentes})`);
    assert.ok(eventos.filter((e) => e.resultado === "no_concluyente").every((e) => e.alteracion.ruta === "src/guardia.js" && e.motivo === "no_carga" || e.motivo === "sin_senal"));
  });
});

// ── H-02: reparto de la muestra por archivo ──────────────────────────────────

describe("H-02 — la muestra se reparte por archivo", () => {
  const cand = (ruta, n) => Array.from({ length: n }, (_, i) => ({ ruta, i }));

  test("un archivo con muchas alteraciones no se queda con la muestra", () => {
    const todas = [...cand("src/a.js", 54), ...cand("src/b.js", 6)];
    const elegidas = seleccionarPorArchivo(todas, 10);
    assert.equal(elegidas.length, 10);
    assert.equal(elegidas.filter((x) => x.ruta === "src/a.js").length, 5);
    assert.equal(elegidas.filter((x) => x.ruta === "src/b.js").length, 5);
  });

  test("lo que un archivo no usa pasa a los demás; la selección es determinista y de un solo archivo coincide con seleccionar", () => {
    const todas = [...cand("src/a.js", 30), ...cand("src/b.js", 2), ...cand("src/c.js", 30)];
    const e1 = seleccionarPorArchivo(todas, 10);
    assert.deepEqual(e1.map((x) => x.ruta).reduce((m, r) => ({ ...m, [r]: (m[r] ?? 0) + 1 }), {}), { "src/a.js": 4, "src/b.js": 2, "src/c.js": 4 });
    assert.deepEqual(seleccionarPorArchivo(JSON.parse(JSON.stringify(todas)), 10), e1);
    const uno = cand("src/a.js", 20);
    assert.deepEqual(seleccionarPorArchivo(uno, 7), seleccionar(uno, 7));
    assert.deepEqual(seleccionarPorArchivo(uno, 0), []);
    assert.equal(seleccionarPorArchivo(cand("x.js", 3), 10).length, 3);
  });
});

// ── H-03 y H-11: errores de compilación y muertes del entorno ────────────────

describe("H-03/H-11 — las alteraciones que no compilan no cuentan como detectadas", () => {
  test("con salida de go test: [build failed] queda fuera del denominador y se sustituye por otra alteración", async () => {
    const GO = "package demo\n\nfunc F(n int) string {\n\tswitch n {\n\tcase 1:\n\t\treturn \"a\"\n\tcase 2:\n\t\treturn \"b\"\n\t}\n\tif n > 10 {\n\t\treturn \"c\"\n\t}\n\treturn \"d\"\n}\n";
    const cwd = escribir(tmp("forge-mrev-go-"), { "go.mod": "module demo\n\ngo 1.23\n", "demo.go": GO, "demo_test.go": "package demo\n" });
    const alteraciones = generarAlteraciones("demo.go", GO);
    const compilaMal = (despues) => /case 2:\n\t\treturn "a"|case 2:\s*$/.test(despues);
    let n = 0;
    const runner = {
      test: async (dir) => {
        n++;
        if (n === 1) return { ...PASE };
        const src = (await import("node:fs")).readFileSync(join(dir, "demo.go"), "utf8");
        // «case 1» → «case 2» duplica un case: no compila. Cualquier otro cambio compila y las pruebas (sin aserciones) pasan
        if (/case 2:\n\t\treturn "a"/.test(src)) return { exitCode: 1, stdout: "FAIL\tdemo [build failed]\n", stderr: "# demo\n./demo.go:7:7: duplicate case 2 in expression switch\n", timedOut: false, infraError: false, durationMs: 1 };
        return { ...PASE };
      },
    };
    assert.ok(alteraciones.some((a) => a.despues === "case 2:"), "el generador propone case 1 → case 2");
    void compilaMal;
    const r = await medirMutacion({ cwd, archivos: ["demo.go"], runner });
    assert.ok(r);
    assert.equal(r.detectadas, 0, "unas pruebas sin aserciones no detectan nada");
    assert.equal(r.puntuacion, 0);
    assert.equal(r.noConcluyentes, 1, "case 1 → case 2 no compila");
    assert.equal(r.probadas, alteraciones.length - 1);
  });

  test("137 y 139 en una alteración: no concluyente, la medición sigue; en la línea base: entorno, no se mide", async () => {
    const cwd = proyecto();
    const guion = [{ ...PASE }, { ...FALLO_PRUEBA, exitCode: 137 }, { ...FALLO_PRUEBA, exitCode: 139 }, { ...FALLO_PRUEBA }, { ...PASE }, { ...FALLO_PRUEBA }, { ...PASE }];
    const eventos = [];
    const r = await medirMutacion({ cwd, archivos: ["src/suma.js"], runner: { test: async () => guion.shift() }, alProbar: (e) => eventos.push(e) });
    assert.equal(r?.noConcluyentes, 2);
    assert.equal(r?.probadas, 4);
    assert.equal(r?.detectadas, 2);
    assert.deepEqual(eventos.slice(0, 2).map((e) => [e.resultado, e.motivo]), [["no_concluyente", "entorno"], ["no_concluyente", "entorno"]]);

    let llamadas = 0;
    const base137 = await medirMutacion({ cwd, archivos: ["src/suma.js"], runner: { test: async () => { llamadas++; return { ...FALLO_PRUEBA, exitCode: 137 }; } } });
    assert.equal(llamadas, 1, "no se alteró nada");
    assert.equal(base137?.lineaBase, "infraestructura");
    assert.equal(base137?.motivoParcial, "infraestructura");
    assert.equal(base137?.probadas, 0);
  });

  test("un tiempo agotado cuenta como detectada solo si el ejecutor lo clasifica como tiempo de pruebas; un error del entorno no", async () => {
    const cwd = proyecto();
    const guion = [{ ...PASE }, { exitCode: null, timedOut: true, stdout: "", stderr: "" }, { exitCode: null, timedOut: true, infraError: true, stdout: "", stderr: "docker se colgó" }];
    const r = await medirMutacion({ cwd, archivos: ["src/suma.js"], runner: { test: async () => guion.shift() } });
    assert.equal(r?.detectadas, 1, "el primero es un tiempo agotado de las pruebas");
    assert.equal(r?.probadas, 1);
    assert.equal(r?.motivoParcial, "infraestructura", "el segundo es del entorno: corta la medición y no cuenta");
  });
});

// ── H-04: exigir no pasa con una medición vacía o casi vacía ─────────────────

describe("H-04 — mínimo de alteraciones concluyentes", () => {
  const e = (mutacion) => {
    const est = estadoInicial({ id: "T1", agente: "desarrollador-backend" }, { runId: "r1", cwd: "/tmp/x" });
    est.mutacion = /** @type {any} */ ({ probadas: 10, detectadas: 10, noConcluyentes: 0, puntuacion: 1, parcial: false, sobrevivientes: [], refuerzos: 0, ...mutacion });
    return est;
  };
  const exigir = { modo: "exigir", minima: 0.6, minConcluyentes: 3 };
  const POCAS = { ruta: "revision_humana", motivo: "pruebas_debiles", insuficiente: true };

  test("exigir: 1/1 (100 %) con la medición cortada por el entorno → revisión por infraestructura, no éxito", () => {
    assert.deepEqual(decidirTrasMutacion(e({ probadas: 1, detectadas: 1, puntuacion: 1, parcial: true, motivoParcial: "infraestructura" }), exigir), { ruta: "revision_humana", motivo: "infraestructura" });
  });
  test("exigir: puntuación null con motivoParcial «tiempo» → revisión por medición insuficiente, no éxito", () => {
    assert.deepEqual(decidirTrasMutacion(e({ probadas: 0, detectadas: 0, puntuacion: null, parcial: true, motivoParcial: "tiempo" }), exigir), POCAS);
  });
  test("exigir: menos alteraciones concluyentes que el mínimo → revisión, aunque la puntuación sea 100 %", () => {
    assert.deepEqual(decidirTrasMutacion(e({ probadas: 2, detectadas: 2, puntuacion: 1 }), exigir), POCAS);
    assert.deepEqual(decidirTrasMutacion(e({ probadas: 3, detectadas: 3, puntuacion: 1 }), exigir), { ruta: "fin_exito" });
    assert.deepEqual(decidirTrasMutacion(e({ probadas: 2, detectadas: 2, puntuacion: 1 }), { ...exigir, minConcluyentes: 2 }), { ruta: "fin_exito" });
  });
  test("exigir: nada que alterar (omitida) → revisión; línea base que falla → infraestructura", () => {
    assert.deepEqual(decidirTrasMutacion(e({ probadas: 0, detectadas: 0, puntuacion: null, omitida: "lenguaje no cubierto" }), exigir), POCAS);
    assert.deepEqual(decidirTrasMutacion(e({ probadas: 0, detectadas: 0, puntuacion: null, parcial: true, motivoParcial: "linea_base" }), exigir), { ruta: "revision_humana", motivo: "infraestructura" });
  });
  test("informar y no: nunca cambian el resultado", () => {
    for (const modo of ["informar", "no"]) {
      assert.deepEqual(decidirTrasMutacion(e({ probadas: 0, puntuacion: null, omitida: "x" }), { ...exigir, modo }), { ruta: "fin_exito" });
      assert.deepEqual(decidirTrasMutacion(e({ probadas: 1, puntuacion: 0 }), { ...exigir, modo }), { ruta: "fin_exito" });
    }
  });
  test("con muestra suficiente todo sigue como antes (refuerzo y revisión por pruebas_debiles)", () => {
    assert.deepEqual(decidirTrasMutacion(e({ puntuacion: 0.5 }), exigir), { ruta: "refuerzo" });
    assert.deepEqual(decidirTrasMutacion(e({ puntuacion: 0.5, refuerzos: 1 }), exigir), { ruta: "revision_humana", motivo: "pruebas_debiles" });
  });

  test("el grafo pide revisión con el detalle claro: el mínimo, las descartadas y qué hace cada decisión", () => {
    const est = e({ probadas: 1, detectadas: 1, noConcluyentes: 4, puntuacion: 1 });
    const t = transicion("mutacion", est, { mutacion: "exigir", mutacionMinima: 0.6, mutacionMinConcluyentes: 3 });
    assert.equal(t.siguiente, "revision_humana");
    const rev = /** @type {any} */ (t.parcial.revision);
    assert.equal(rev.motivo, "pruebas_debiles");
    assert.equal(rev.reanudarEn, "mutacion");
    assert.match(rev.detalle, /solo 1 alteraciones concluyentes \(el mínimo es 3\)/);
    assert.match(rev.detalle, /4 se descartaron/);
    assert.match(detalleMedicionInsuficiente(/** @type {any} */ ({ omitida: "no hay nada" }), 3), /no se pudo medir nada: no hay nada/);
    // Con informar el mismo estado termina en éxito
    assert.deepEqual(transicion("mutacion", est, { mutacion: "informar" }), { siguiente: null, parcial: { resultado: "exito" } });
  });

  test("la línea base que falla se explica a la persona", () => {
    const est = e({ probadas: 0, detectadas: 0, puntuacion: null, parcial: true, motivoParcial: "linea_base", detalleInfra: "código 1 sin alterar nada" });
    const rev = /** @type {any} */ (transicion("mutacion", est, { mutacion: "exigir" }).parcial.revision);
    assert.equal(rev.motivo, "infraestructura");
    assert.match(rev.detalle, /copia sin alterar/);
  });

  test("configuración: motor.mutacion_min_concluyentes vale 3 por defecto, se lee y se valida", () => {
    const conYaml = (yaml) => { const cwd = tmp("forge-mrev-cfg-"); escribir(cwd, { ".sdd/sdd.config.yaml": yaml }); return cwd; };
    assert.equal(POR_DEFECTO.motor.mutacion_min_concluyentes, 3);
    assert.equal(leerConfigCiclo(tmp("forge-mrev-cfg-")).motor.mutacion_min_concluyentes, 3);
    assert.equal(leerConfigCiclo(conYaml("motor:\n  mutacion_min_concluyentes: 5\n")).motor.mutacion_min_concluyentes, 5);
    for (const v of ["0", "-1", "2.5", "pocas"]) assert.throws(() => leerConfigCiclo(conYaml(`motor:\n  mutacion_min_concluyentes: ${v}\n`)), /motor\.mutacion_min_concluyentes/, v);
  });

  test("el tiempo se cuenta desde que la copia está lista, no desde antes de copiar", async () => {
    const cwd = proyecto();
    const dirTemporal = tmp("forge-mrev-t-");
    let primera = true;
    let copiaLista = null;
    const r = await medirMutacion({
      cwd, archivos: ["src/suma.js"], dirTemporal, runner: { test: async () => ({ ...PASE }) },
      ahora: () => {
        if (primera) {
          primera = false;
          const [madre] = readdirSync(dirTemporal);
          copiaLista = existsSync(join(dirTemporal, madre, "copia", "src", "suma.js"));
        }
        return 0;
      },
    });
    assert.ok(r);
    assert.equal(copiaLista, true, "el reloj arranca con la copia ya creada");
  });
});

// ── H-05: línea base ─────────────────────────────────────────────────────────

describe("H-05 — la copia sin alterar tiene que pasar antes de medir", () => {
  test("si la línea base falla, no se altera nada y no se declara todo «detectado»", async () => {
    const cwd = proyecto();
    let llamadas = 0;
    const eventos = [];
    const r = await medirMutacion({ cwd, archivos: ["src/suma.js"], runner: { test: async () => { llamadas++; return { ...FALLO_PRUEBA }; } }, alProbar: (e) => eventos.push(e) });
    assert.equal(llamadas, 1, "solo la línea base");
    assert.equal(r?.lineaBase, "falla");
    assert.equal(r?.motivoParcial, "linea_base");
    assert.equal(r?.parcial, true);
    assert.equal(r?.probadas, 0);
    assert.equal(r?.detectadas, 0);
    assert.equal(r?.puntuacion, null);
    assert.match(String(r?.detalleInfra), /código 1 sin alterar nada/);
    assert.deepEqual(eventos, []);
  });

  test("una línea base que se agota de tiempo tampoco vale", async () => {
    const r = await medirMutacion({ cwd: proyecto(), archivos: ["src/suma.js"], runner: { test: async () => ({ exitCode: null, timedOut: true, stdout: "", stderr: "" }) } });
    assert.equal(r?.lineaBase, "falla");
    assert.match(String(r?.detalleInfra), /tiempo agotado/);
  });

  test("con la línea base en verde la medición sigue su curso", async () => {
    const guion = [{ ...PASE }, ...Array(6).fill({ ...FALLO_PRUEBA })];
    const r = await medirMutacion({ cwd: proyecto(), archivos: ["src/suma.js"], runner: { test: async () => guion.shift() } });
    assert.equal(r?.lineaBase, "ok");
    assert.equal(r?.puntuacion, 1);
  });

  test("una alteración no concluyente se sustituye por otra de la reserva, en orden fijo", async () => {
    const cwd = proyecto();
    const guion = [{ ...PASE }, { ...FALLO_CARGA }, { ...FALLO_CARGA }, { ...FALLO_PRUEBA }, { ...PASE }, { ...FALLO_PRUEBA }];
    const eventos = [];
    const r = await medirMutacion({ cwd, archivos: ["src/suma.js"], runner: { test: async () => guion.shift() }, max: 3, alProbar: (e) => eventos.push(e) });
    assert.equal(r?.noConcluyentes, 2);
    assert.equal(r?.probadas, 3);
    assert.equal(r?.detectadas, 2);
    assert.equal(eventos.length, 5);
    assert.equal(r?.parcial, true);
    assert.equal(r?.motivoParcial, "tope_alteraciones", "quedó sin probar una alteración posible");
    const otra = await medirMutacion({ cwd, archivos: ["src/suma.js"], runner: { test: async () => ({ ...PASE }) }, max: 3 });
    assert.equal(otra?.probadas, 3);
  });

  test("un avance guardado con el formato anterior (sin veredicto) no se reutiliza", async () => {
    const cwd = proyecto();
    let guardado = null;
    const avance = { leer: () => guardado, guardar: (d) => { guardado = JSON.parse(JSON.stringify(d)); } };
    await medirMutacion({ cwd, archivos: ["src/suma.js"], runner: { test: async () => ({ ...PASE }) }, avance });
    guardado = { clave: guardado.clave, hechas: guardado.hechas.map(({ categoria, durationMs }) => ({ categoria, durationMs })) };
    let llamadas = 0;
    await medirMutacion({ cwd, archivos: ["src/suma.js"], runner: { test: async () => { llamadas++; return { ...PASE }; } }, avance });
    assert.equal(llamadas, 7, "línea base y seis alteraciones");
  });
});

// ── H-06: permisos y copias huérfanas ────────────────────────────────────────

describe("H-06 — copia privada y barrido de huérfanas", () => {
  const HACE_UN_DIA = () => new Date(Date.now() - 24 * 3600 * 1000);

  /** @param {string} base @param {string} nombre @param {{ marca?: boolean, antigua?: boolean }} o */
  function carpeta(base, nombre, { marca = true, antigua = true } = {}) {
    const dir = join(base, nombre);
    mkdirSync(join(dir, "copia"), { recursive: true });
    writeFileSync(join(dir, "copia", "a.js"), "x");
    if (marca) writeFileSync(join(dir, ".forge-mutacion"), "1\n");
    if (antigua) utimesSync(dir, HACE_UN_DIA(), HACE_UN_DIA());
    return dir;
  }

  test("borra solo las carpetas de FORGE: con marca, nombre exacto y antiguas; no toca nada más", () => {
    const base = tmp("forge-mrev-barrer-");
    const huerfana = carpeta(base, "forge-mutacion-abc123");
    const sinMarca = carpeta(base, "forge-mutacion-def456", { marca: false });
    const reciente = carpeta(base, "forge-mutacion-ghi789", { antigua: false });
    const ajena = carpeta(base, "otra-herramienta-abc123");
    const nombreRaro = carpeta(base, "forge-mutacion-uno");
    const fichero = join(base, "forge-mutacion-fil123");
    writeFileSync(fichero, "no soy una carpeta");

    assert.equal(barrerMutacionesHuerfanas(base), 1);
    assert.equal(existsSync(huerfana), false);
    for (const d of [sinMarca, reciente, ajena, nombreRaro, fichero]) assert.equal(existsSync(d), true, d);
    assert.equal(barrerMutacionesHuerfanas(join(base, "no-existe")), 0, "una carpeta que no existe no es un error");
  });

  test("un enlace con nombre de copia no se sigue ni se borra", () => {
    const base = tmp("forge-mrev-barrer-");
    const fuera = tmp("forge-mrev-fuera-");
    writeFileSync(join(fuera, ".forge-mutacion"), "1\n");
    writeFileSync(join(fuera, "importante.txt"), "no borrar");
    try { symlinkSync(fuera, join(base, "forge-mutacion-lnk123"), "junction"); } catch { return; /* sin permiso para enlaces */ }
    assert.equal(barrerMutacionesHuerfanas(base, { antiguedadMs: 0 }), 0);
    assert.equal(existsSync(join(fuera, "importante.txt")), true);
  });

  test("medirMutacion barre las huérfanas antiguas al empezar y lo informa", async () => {
    const dirTemporal = tmp("forge-mrev-barrer-");
    const huerfana = carpeta(dirTemporal, "forge-mutacion-zzz999");
    const r = await medirMutacion({ cwd: proyecto(), archivos: ["src/suma.js"], runner: { test: async () => ({ ...PASE }) }, dirTemporal });
    assert.equal(existsSync(huerfana), false);
    assert.equal(r?.huerfanasBorradas, 1);
    assert.deepEqual(readdirSync(dirTemporal), [], "y la copia propia también se borra");
  });

  test("la copia vive dentro de una carpeta marcada como de FORGE", async () => {
    const dirTemporal = tmp("forge-mrev-marca-");
    const vistas = [];
    await medirMutacion({ cwd: proyecto(), archivos: ["src/suma.js"], dirTemporal, runner: { test: async (dir) => { vistas.push(dir); return { ...PASE }; } } });
    const madre = resolve(vistas[0], "..");
    assert.match(madre, /forge-mutacion-[A-Za-z0-9]{6}$/);
    assert.equal(resolve(madre, ".."), resolve(dirTemporal));
  });

  test("crearCopia privada copia lo mismo; en POSIX deja 0700 para directorios y sin permisos de grupo ni de otros en los archivos", { skip: process.platform === "win32" && "los permisos POSIX no aplican en Windows" }, () => {
    const cwd = escribir(tmp("forge-mrev-perm-"), { "src/a.js": "x", "notas.txt": "y" });
    const destino = join(tmp("forge-mrev-perm-d-"), "copia");
    const { copiados } = crearCopia(cwd, destino, { privada: true });
    assert.equal(copiados, 2);
    assert.equal(statSync(destino).mode & 0o777, 0o700);
    assert.equal(statSync(join(destino, "src")).mode & 0o777, 0o700);
    assert.equal(statSync(join(destino, "src", "a.js")).mode & 0o077, 0);
    const abierta = join(tmp("forge-mrev-perm-d-"), "copia");
    crearCopia(cwd, abierta);
    assert.equal(statSync(abierta).mode & 0o777, 0o777, "la copia del contenedor sigue abierta: sin cambios");
  });
});

// ── H-08 y H-09: rutas y secretos ────────────────────────────────────────────

describe("H-08 — medirMutacion valida las rutas por sí misma", () => {
  test("una ruta con «..», absoluta o vetada no se lee ni se escribe fuera de la copia", async () => {
    const padre = tmp("forge-mrev-padre-");
    const cwd = join(padre, "proy");
    escribir(cwd, { "package.json": "{}", "src/suma.js": IMPL, ".env": "export const SECRETO = 1;\n" });
    escribir(padre, { "fuera/objetivo.js": "export const x = 1;\n" });
    const dirTemporal = tmp("forge-mrev-tmp-");
    let llamadas = 0;
    const runner = { test: async () => { llamadas++; return { ...PASE }; } };

    const nada = await medirMutacion({ cwd, archivos: ["../fuera/objetivo.js", resolve(padre, "fuera/objetivo.js"), ".env", "C:\\Windows\\x.js"], runner, dirTemporal });
    assert.equal(nada, null, "ninguna ruta válida: nada que medir");
    assert.equal(llamadas, 0);
    assert.deepEqual(readdirSync(dirTemporal), [], "no se creó nada fuera de la copia");

    const mixto = await medirMutacion({ cwd, archivos: ["../fuera/objetivo.js", "src/suma.js"], runner, dirTemporal });
    assert.ok(mixto);
    assert.ok(mixto.rechazadas?.some((x) => x.ruta === "../fuera/objetivo.js"), JSON.stringify(mixto.rechazadas));
    assert.ok(mixto.sobrevivientes.every((s) => s.ruta === "src/suma.js"));
    assert.equal(existsSync(join(dirTemporal, "fuera")), false);
    assert.equal(existsSync(join(padre, "fuera", "objetivo.js")), true);
  });

  test("un archivo vetado que sí está en la lista de la tarea no se altera", async () => {
    const cwd = escribir(tmp("forge-mrev-vet-"), { "package.json": "{}", "src/suma.js": IMPL, "src/privado.js": "export const k = (a) => a > 1;\n" });
    const r = await medirMutacion({ cwd, archivos: ["src/suma.js", "src/privado.js"], vetadas: ["src/privado.js"], runner: { test: async () => ({ ...PASE }) } });
    assert.ok(r?.sobrevivientes.every((s) => s.ruta === "src/suma.js"));
    assert.ok(r?.rechazadas?.some((x) => x.ruta === "src/privado.js"));
  });
});

describe("H-09 — antes y despues pasan por redactar", () => {
  const SECRETO = "sk-ant-api03-ABCDEFGHIJKLMNOPQRSTUVWX";

  test("un secreto escrito a mano en el código no sale en las alteraciones ni en el evento", async () => {
    const codigo = `export function f(clave) {\n  if (clave === "${SECRETO}") {\n    return 1;\n  }\n  return 0;\n}\n`;
    const alteraciones = generarAlteraciones("src/f.js", codigo);
    assert.ok(alteraciones.length > 0);
    for (const a of alteraciones) assert.ok(!a.antes.includes(SECRETO) && !a.despues.includes(SECRETO), `${a.antes} | ${a.despues}`);

    const cwd = escribir(tmp("forge-mrev-sec-"), { "package.json": "{}", "src/f.js": codigo });
    const eventos = [];
    const r = await medirMutacion({ cwd, archivos: ["src/f.js"], runner: { test: async () => ({ ...PASE }) }, alProbar: (e) => eventos.push(e) });
    assert.ok(r && r.sobrevivientes.length > 0);
    assert.ok(!JSON.stringify(r).includes(SECRETO));
    assert.ok(!JSON.stringify(eventos.map((e) => [e.alteracion.antes, e.alteracion.despues])).includes(SECRETO));
  });

  test("se redacta antes de recortar: un secreto que cae en el límite de la línea no queda a medias", () => {
    const linea = `const x = 1; // ${"a".repeat(125)} ${SECRETO} fin`;
    const a = alteracionesDe([{ ruta: "src/f.js", contenido: linea + "\n" }]);
    assert.ok(a.length > 0);
    for (const x of a) assert.ok(!/sk-ant/.test(x.antes + x.despues), x.antes);
  });
});

// ── H-03: Docker real (el ejemplo de la revisión) ────────────────────────────

const cli = new DockerCli();
const dockerActivo = process.env.FORGE_TEST_DOCKER === "1" && (await cli.disponible()).ok;

describe("H-03 con Docker real — Go", { skip: !dockerActivo && "requiere FORGE_TEST_DOCKER=1 y Docker en marcha" }, () => {
  const DEMO = [
    "package demo", "",
    "func Clasificar(n int) string {", "\tswitch n {", "\tcase 1:", "\t\treturn \"uno\"", "\tcase 2:", "\t\treturn \"dos\"", "\t}",
    "\tif n > 10 {", "\t\treturn \"grande\"", "\t}", "\treturn \"otro\"", "}", "",
    "func Tope() byte {", "\tvar b byte = 255", "\treturn b", "}", "",
  ].join("\n");
  // Una prueba que llama a las funciones y no comprueba nada
  const SIN_ASERCIONES = "package demo\n\nimport \"testing\"\n\nfunc TestSePuedeLlamar(t *testing.T) {\n\tClasificar(1)\n\tClasificar(20)\n\tTope()\n}\n";
  const CON_ASERCIONES = "package demo\n\nimport \"testing\"\n\nfunc TestResultados(t *testing.T) {\n"
    + "\tif Clasificar(1) != \"uno\" || Clasificar(2) != \"dos\" || Clasificar(3) != \"otro\" || Clasificar(11) != \"grande\" || Clasificar(10) != \"otro\" {\n\t\tt.Fatal(\"clasificar\")\n\t}\n"
    + "\tif Tope() != 255 {\n\t\tt.Fatal(\"tope\")\n\t}\n}\n";

  function montar(pruebas) {
    const cwd = escribir(tmp("forge-mrev-go-real-"), { "go.mod": "module demo\n\ngo 1.23\n", "demo.go": DEMO, "demo_test.go": pruebas });
    const runner = new SandboxRunner({ runId: `mrev-${process.pid}-${Date.now().toString(36)}`, dirMotor: join(cwd, ".sdd", "motor", "r"), lenguaje: "go", testCmd: "go test ./...", timeoutMs: 240_000, cli });
    return { cwd, runner };
  }

  test("pruebas sin aserciones: los errores de compilación (case duplicado, byte desbordado) NO cuentan como detectados", async () => {
    const { cwd, runner } = montar(SIN_ASERCIONES);
    const base = await runner.test(cwd);
    assert.equal(base.exitCode, 0, base.stdout + base.stderr);
    const eventos = [];
    const r = await medirMutacion({ cwd, archivos: ["demo.go"], runner, alProbar: (e) => eventos.push(e) });
    assert.ok(r);
    const resumen = JSON.stringify(eventos.map((e) => [e.alteracion.despues, e.resultado, e.motivo]));
    assert.equal(r.lineaBase, "ok");
    assert.equal(r.detectadas, 0, resumen);
    assert.equal(r.puntuacion, 0, resumen);
    assert.ok(r.noConcluyentes >= 2, "case 1 → case 2 (duplicado) y 255 → 256 (desborda) no compilan: " + resumen);
    assert.ok(eventos.filter((e) => e.resultado === "no_concluyente").every((e) => e.motivo === "no_compila"), resumen);
    assert.deepEqual(runner.copiasSinBorrar, []);
    console.log(`  Go real, pruebas sin aserciones: ${r.detectadas}/${r.probadas} concluyentes, ${r.noConcluyentes} no concluyentes (antes de la corrección: 2/6 = 33 %)`);
  });

  test("pruebas con aserciones: detectan todas las alteraciones que compilan", async () => {
    const { cwd, runner } = montar(CON_ASERCIONES);
    const r = await medirMutacion({ cwd, archivos: ["demo.go"], runner });
    assert.ok(r);
    assert.equal(r.lineaBase, "ok");
    assert.ok(r.probadas >= 3);
    assert.equal(r.puntuacion, 1, JSON.stringify(r.sobrevivientes));
    assert.ok(r.noConcluyentes >= 2);
  });
});
