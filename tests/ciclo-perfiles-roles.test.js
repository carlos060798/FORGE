// @ts-check
/**
 * Perfiles de los tres roles del ciclo verificado (spec 2026-10-14-perfiles-de-agente, HU-005; tareas F5.1 a F5.5).
 *   F5.1  arquitecto (rol planner): sin herramientas ni escritura; su salida es el plan.
 *   F5.2  tester (rol qa): escribe solo rutas de prueba.
 *   F5.3  implementador (rol coder): las cinco herramientas; no escribe pruebas, ni en bloque ni por turnos.
 *   F5.4  el rol de solo lectura no escribe por ninguna vía del ciclo.
 *   F5.5  un perfil irresoluble falla cerrado para cada rol: revisión antes de llamar a ningún modelo.
 * La regresión de los tres roles (archivos, huellas, llamadas y veredicto) está en tests/ciclo-regresion-verificada.test.js.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { ESQUEMAS_HERRAMIENTAS, crearHerramientasCoder } from "../core/ciclo/herramientas-coder.js";
import { perfilPorDefecto } from "../core/ciclo/perfiles.js";
import { aplicarArchivos } from "../core/ciclo/protocolo-archivos.js";
import { ROOT } from "./helpers.js";
import { EDITA, FALLA, PASA, TAREA, TERMINA, entorno, pide, tipos, uso } from "./helpers-perfiles.js";

const leer = (/** @type {string} */ dir, /** @type {string} */ ruta) => readFileSync(join(dir, ruta), "utf8");
const SALIDA_CON_ARCHIVOS_DEL_ARQUITECTO = '{"pasos":["x"],"archivosObjetivo":["src/a.js"],"archivos":[{"ruta":"src/hack.js","contenido":"export const h = 1;\\n"}]}';
const LLAMADAS = (/** @type {any} */ e, /** @type {string} */ agente) => e.llamadas.filter((/** @type {any} */ l) => l.agente === agente);

describe("F5.1 — arquitecto (rol planner): solo lectura", () => {
  test("su perfil no tiene herramientas, ni escritura, ni ejecución; el estado lo registra", async () => {
    const e = entorno({ turnos: [pide(EDITA), TERMINA], ejecuciones: [FALLA, PASA] });
    const r = await e.nuevoCiclo().ejecutar(TAREA);
    assert.equal(r.estado.resultado, "exito");
    const p = /** @type {any} */ (r.estado).perfiles.planner;
    assert.deepEqual(p.herramientas, []);
    assert.deepEqual(p.rutasEscribir, { clase: "ninguna", prefijos: [] });
    assert.equal(p.pruebasMax, 0, "no ejecuta pruebas");
  });

  test("al arquitecto se le llama sin herramientas: solo con un mensaje, no con una conversación", async () => {
    const e = entorno({ turnos: [pide(EDITA), TERMINA], ejecuciones: [FALLA, PASA] });
    await e.nuevoCiclo().ejecutar(TAREA);
    assert.equal(e.llamadas[0].agente, "arquitecto");
    assert.ok(!e.llamadas[0].parametros.includes("herramientas"), "la llamada al arquitecto no lleva herramientas");
    assert.equal(e.conversaciones.length, 2, "las dos respuestas con herramientas son del implementador, ninguna del arquitecto");
  });
});

describe("F5.2 — tester (rol qa): escribe solo rutas de prueba", () => {
  test("su perfil escribe solo pruebas, sin herramientas; igual que el rol qa de antes", async () => {
    const e = entorno({ turnos: [pide(EDITA), TERMINA], ejecuciones: [FALLA, PASA] });
    const r = await e.nuevoCiclo().ejecutar(TAREA);
    const p = /** @type {any} */ (r.estado).perfiles.qa;
    assert.deepEqual(p.herramientas, []);
    assert.equal(p.rutasEscribir.clase, "pruebas");
    assert.equal(p.rutasEscribir.prefijos, null, "sin restricción de carpeta: la regla de prueba de siempre");
  });

  test("si el tester propone también código, ese archivo no se escribe y queda anotado; la prueba sí", async () => {
    const MIXTA = '```json\n{"archivos":[{"ruta":"src/a.js","contenido":"hack\\n"},{"ruta":"tests/a.test.js","contenido":"import \'../src/a.js\';\\n"}]}\n```';
    const e = entorno({ motor: { implementador: "bloque" }, pruebas: [MIXTA], ejecuciones: [FALLA, PASA] });
    await e.nuevoCiclo().ejecutar(TAREA);
    assert.equal(leer(e.cwd, "src/a.js"), "export const a = 1;\n", "el código no cambió");
    assert.ok(existsSync(join(e.cwd, "tests/a.test.js")), "la prueba sí se escribió");
    assert.deepEqual(tipos(e, "ciclo:escritura_rechazada").map((/** @type {any} */ x) => x.payload.motivo), ["no_es_prueba"]);
  });
});

describe("F5.3 — implementador (rol coder): cinco herramientas, sin escribir pruebas", () => {
  test("su perfil tiene las cinco herramientas de siempre y escritura fuera de las pruebas", async () => {
    const e = entorno({ turnos: [pide(EDITA), TERMINA], ejecuciones: [FALLA, PASA] });
    const r = await e.nuevoCiclo().ejecutar(TAREA);
    const p = /** @type {any} */ (r.estado).perfiles.coder;
    assert.deepEqual(p.herramientas, ESQUEMAS_HERRAMIENTAS.map((h) => h.nombre));
    assert.equal(p.rutasEscribir.clase, "no_pruebas");
  });

  test("en bloque no reescribe las pruebas del tester: se rechaza como prueba inmutable", async () => {
    const e = entorno({ motor: { implementador: "bloque" }, bloque: ['```json\n{"archivos":[{"ruta":"tests/a.test.js","contenido":"// cambiado\\n"}]}\n```'], ejecuciones: [FALLA] });
    const r = await e.nuevoCiclo().ejecutar(TAREA);
    assert.equal(r.estado.revision?.motivo, "salida_invalida");
    assert.deepEqual(tipos(e, "ciclo:escritura_rechazada").map((/** @type {any} */ x) => x.payload.motivo), ["prueba_inmutable"]);
    assert.ok(!leer(e.cwd, "tests/a.test.js").includes("// cambiado"), "la prueba no cambió");
  });

  test("por turnos, editar sobre una prueba se rechaza y queda anotado en el diario", async () => {
    const e = entorno({
      turnos: [pide(uso("editar", { ruta: "tests/a.test.js", contenido: "// cambiado\n" })), TERMINA],
      ejecuciones: [FALLA, PASA],
    });
    await e.nuevoCiclo().ejecutar(TAREA);
    assert.ok(!leer(e.cwd, "tests/a.test.js").includes("// cambiado"), "la prueba no cambió");
    const anotado = tipos(e, "ciclo:herramienta").find((/** @type {any} */ ev) => ev.payload.herramienta === "editar");
    assert.equal(anotado?.payload.ok, false);
  });
});

describe("F5.4 — el rol de solo lectura no escribe por ninguna vía", () => {
  test("bloque: un arquitecto que propone archivos en su salida no escribe ninguno", async () => {
    const e = entorno({ motor: { implementador: "bloque" }, ejecuciones: [FALLA, PASA] });
    e.guion.arquitecto = [SALIDA_CON_ARCHIVOS_DEL_ARQUITECTO];
    const r = await e.nuevoCiclo().ejecutar(TAREA);
    assert.equal(r.estado.resultado, "exito");
    assert.ok(!existsSync(join(e.cwd, "src/hack.js")), "el arquitecto no escribió");
    assert.equal(e.eventos.filter((/** @type {any} */ ev) => ev.payload?.ruta === "src/hack.js").length, 0);
  });

  test("editar: con un perfil sin herramientas, la llamada se rechaza y no toca el disco", async () => {
    const cwd = entorno().cwd;
    const h = crearHerramientasCoder({ cwd, respaldo: { registrar() {} }, runner: { test: async () => ({ exitCode: 0 }) }, log: { append() {} }, politicaDestinos: [], perfil: { herramientas: [], rutasEscribir: [] } });
    assert.deepEqual(h.esquemas, [], "sin herramientas no hay esquemas");
    const r = await h.ejecutar("editar", { ruta: "src/a.js", contenido: "hack\n" });
    assert.equal(r.error, true);
    assert.equal(leer(cwd, "src/a.js"), "export const a = 1;\n");
  });

  test("aplicarArchivos: un perfil con rutas escribibles vacías no deja escribir nada, a ningún rol", () => {
    // Cada rol rechaza primero lo que su regla de siempre no le deja; lo que sí le dejaría, lo rechaza el perfil
    const casos = /** @type {const} */ ([
      { rol: "qa", ruta: "tests/nuevo.test.js", motivo: "fuera_de_perfil" },
      { rol: "qa", ruta: "src/nuevo.js", motivo: "no_es_prueba" },
      { rol: "coder", ruta: "src/nuevo.js", motivo: "fuera_de_perfil" },
      { rol: "coder", ruta: "tests/nuevo.test.js", motivo: "prueba_inmutable" },
    ]);
    for (const { rol, ruta, motivo } of casos) {
      const cwd = entorno().cwd;
      const r = aplicarArchivos(cwd, [{ ruta, contenido: "1\n" }], { rol, rutasEscribir: [], politicaDestinos: [] });
      assert.deepEqual(r.escritos, [], `${rol} ${ruta}`);
      assert.deepEqual(r.rechazados.map((/** @type {any} */ x) => x.motivo), [motivo], `${rol} ${ruta}`);
      assert.equal(existsSync(join(cwd, ruta)), false);
    }
  });

  test("integraciones: ningún módulo de cli/ ni de core/integraciones escribe con aplicarArchivos (la vía del ciclo)", () => {
    const raiz = ROOT;
    /** @param {string} dir @returns {string[]} */
    const fuentes = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? fuentes(join(dir, d.name)) : d.name.endsWith(".js") ? [join(dir, d.name)] : []));
    const usan = [...fuentes(join(raiz, "cli")), ...fuentes(join(raiz, "core", "integraciones"))].filter((f) => /\baplicarArchivos\b/.test(readFileSync(f, "utf8")));
    assert.deepEqual(usan, [], "una integración que escribe por la vía del ciclo rompería el perfil del rol de solo lectura");
    assert.deepEqual(perfilPorDefecto("planner").herramientas, [], "el rol de solo lectura no ofrece ninguna herramienta");
  });
});

describe("F5.5 — un perfil irresoluble falla cerrado, para cada rol", () => {
  const CASOS = /** @type {const} */ ([
    { rol: "planner", clave: "planner_herramientsa", agente: "arquitecto" },
    { rol: "qa", clave: "qa_pasos_maxx", agente: "tester" },
    { rol: "coder", clave: "coder_herramientsa", agente: "desarrollador-backend" },
  ]);
  for (const { rol, clave, agente } of CASOS) {
    test(`${rol}: clave mal escrita → revisión por perfil y ningún modelo se llama`, async () => {
      const e = entorno({ yaml: `perfiles:\n  ${clave}: editar\n`, ejecuciones: [FALLA, PASA] });
      const r = await e.nuevoCiclo().ejecutar(TAREA);
      assert.equal(r.estado.resultado, "revision_pendiente");
      assert.equal(r.estado.revision?.motivo, "perfil");
      assert.match(String(r.estado.revision?.detalle), new RegExp(`perfiles\\.${clave}`));
      assert.match(String(r.estado.revision?.detalle), /\.sdd\/sdd\.config\.yaml/);
      // La sección entera se valida antes que nada: ni el planificador ni el rol afectado gastan una llamada
      assert.equal(LLAMADAS(e, agente).length, 0, `ningún modelo del rol ${rol} se llamó`);
      assert.equal(e.llamadas.length, 0, "ninguna llamada a ningún modelo");
    });
  }

  test("un perfil irresoluble nunca cae al máximo: el perfil guardado no aparece y no se escribe nada", async () => {
    const e = entorno({ yaml: "perfiles:\n  coder_herramientsa: editar\n", motor: { implementador: "bloque" }, ejecuciones: [FALLA, PASA] });
    const r = await e.nuevoCiclo().ejecutar(TAREA);
    assert.equal(r.estado.revision?.motivo, "perfil");
    assert.equal(/** @type {any} */ (r.estado).perfiles?.coder, undefined);
    assert.ok(!existsSync(join(e.cwd, "src/nuevo.js")));
  });
});
