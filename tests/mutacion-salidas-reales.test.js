// @ts-check
/**
 * La medición por mutación decide si una alteración fue «detectada», «sobreviviente» o «no
 * concluyente» reconociendo la SALIDA del ejecutor de pruebas (core/ciclo/mutacion.js, ADR-20).
 *
 * Aquí esos patrones se comprueban contra salidas REALES: cada archivo de
 * `tests/fixtures/salidas-ejecutores/<ejecutor>/<situacion>.txt` es la salida (stdout, stderr y
 * código) de un proyecto mínimo ejecutado con el `SandboxRunner` de verdad, capturada con
 * `tests/fixtures/salidas-ejecutores/capturar.mjs`. No se editan a mano.
 *
 * Estos tests no usan Docker: leen las capturas y las pasan por las mismas funciones que usa
 * `medirMutacion` (`clasificar` del router y `juzgar`).
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { juzgar, senalDeFallo } from "../core/ciclo/mutacion.js";
import { clasificar } from "../core/ciclo/router.js";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "salidas-ejecutores");

/**
 * Lee una captura: cabecera `clave: valor`, y stdout y stderr entre separadores.
 * @param {string} ruta
 */
function leerCaptura(ruta) {
  const texto = readFileSync(ruta, "utf8");
  const iOut = texto.indexOf("\n=====STDOUT=====\n");
  const iErr = texto.lastIndexOf("\n=====STDERR=====\n");
  const iFin = texto.lastIndexOf("\n=====FIN=====\n");
  assert.ok(iOut > 0 && iErr > iOut && iFin > iErr, `captura mal formada: ${ruta}`);
  /** @type {Record<string, string>} */
  const cabecera = {};
  for (const linea of texto.slice(0, iOut).split("\n")) {
    const m = /^([a-z_]+): (.*)$/.exec(linea);
    if (m) cabecera[m[1]] = m[2];
  }
  const codigo = cabecera.codigo_salida === "null" ? null : Number(cabecera.codigo_salida);
  return {
    cabecera,
    /** La forma que devuelve `SandboxRunner.test` */
    ejecucion: {
      exitCode: codigo,
      stdout: texto.slice(iOut + "\n=====STDOUT=====\n".length, iErr),
      stderr: texto.slice(iErr + "\n=====STDERR=====\n".length, iFin),
      timedOut: cabecera.tiempo_agotado === "true",
      oomKilled: cabecera.memoria_agotada === "true",
      infraError: false,
    },
  };
}

/** Lo mismo que hace `medirMutacion` con cada ejecución: categoría por código de salida y veredicto por la salida. */
function veredictoDe(captura) {
  const categoria = clasificar(captura.ejecucion, { hayPruebas: true, pruebasIntactas: true });
  assert.notEqual(categoria, "infra_error", "una captura nunca es un fallo del entorno");
  return juzgar(captura.ejecucion, /** @type {any} */ (categoria), /** @type {any} */ (captura.cabecera.lenguaje));
}

/** Qué debe decir la medición de cada situación. */
const ESPERADO = {
  "pasa": "sobrevive",
  "asercion": "detectada",
  // N-02: una excepcion que no es de asercion (TypeError, panic) no demuestra que la prueba compruebe nada
  "excepcion-en-prueba": "no_concluyente",
  // N-02: el cable trampa que salta al llamar al codigo (Error/RuntimeError/panic propios) tampoco es una deteccion
  "guardia-en-llamada": "no_concluyente",
  "sintaxis": "no_concluyente",
  "importacion": "no_concluyente",
  "excepcion-al-cargar": "no_concluyente",
  "excepcion-al-cargar-con-salida": "no_concluyente",
  "error-de-tipos": "no_concluyente",
};
const OBLIGATORIAS = ["pasa", "asercion", "sintaxis", "importacion", "excepcion-al-cargar"];
/** Los ejecutores que nombra ADR-20, más las dos formas de TypeScript que se comprobaron. */
const EJECUTORES = ["pytest", "unittest", "jest", "jest-ts", "vitest", "node-test", "node-test-ts", "go-test"];

const situacionesDe = (ejecutor) => readdirSync(join(DIR, ejecutor)).filter((f) => f.endsWith(".txt")).map((f) => f.slice(0, -4)).sort();

describe("capturas reales — están completas y dicen de dónde salen", () => {
  test("hay una carpeta por ejecutor, y ninguna de más", () => {
    const carpetas = readdirSync(DIR, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
    assert.deepEqual(carpetas, [...EJECUTORES].sort());
  });

  for (const ejecutor of EJECUTORES) {
    test(`${ejecutor}: tiene las cinco situaciones, con versión del ejecutor e imagen en la cabecera`, () => {
      assert.ok(existsSync(join(DIR, ejecutor)), `falta la carpeta ${ejecutor}`);
      const situaciones = situacionesDe(ejecutor);
      for (const s of OBLIGATORIAS) assert.ok(situaciones.includes(s), `falta ${ejecutor}/${s}.txt`);
      for (const s of situaciones) {
        assert.ok(s in ESPERADO, `situación desconocida: ${ejecutor}/${s}`);
        const { cabecera, ejecucion } = leerCaptura(join(DIR, ejecutor, `${s}.txt`));
        assert.equal(cabecera.ejecutor, ejecutor);
        assert.equal(cabecera.situacion, s);
        assert.match(cabecera.version ?? "", /\d+\.\d+/, `${ejecutor}/${s}: sin versión`);
        assert.match(cabecera.imagen ?? "", /^\S+ \(base \S+; sha256:[0-9a-f]{64}\)$/, `${ejecutor}/${s}: sin imagen`);
        assert.ok(cabecera.comando, `${ejecutor}/${s}: sin comando`);
        assert.ok(["javascript", "typescript", "python", "go"].includes(cabecera.lenguaje), `${ejecutor}/${s}: lenguaje`);
        assert.ok(Number.isInteger(ejecucion.exitCode), `${ejecutor}/${s}: sin código de salida`);
        assert.equal(ejecucion.timedOut, false);
        assert.ok((ejecucion.stdout + ejecucion.stderr).trim().length > 0, `${ejecutor}/${s}: salida vacía`);
        // El código de salida es el que da sentido a la situación: 0 solo cuando las pruebas pasan
        assert.equal(ejecucion.exitCode === 0, s === "pasa", `${ejecutor}/${s}: código ${ejecucion.exitCode}`);
      }
    });
  }
});

describe("capturas reales — veredicto de la medición por mutación", () => {
  for (const ejecutor of EJECUTORES) {
    if (!existsSync(join(DIR, ejecutor))) continue;
    describe(ejecutor, () => {
      for (const situacion of situacionesDe(ejecutor)) {
        const esperado = ESPERADO[situacion];
        test(`${situacion} → ${esperado}`, () => {
          const captura = leerCaptura(join(DIR, ejecutor, `${situacion}.txt`));
          const juicio = veredictoDe(captura);
          assert.equal(juicio.veredicto, esperado,
            `${ejecutor}/${situacion} (${captura.cabecera.version}): se juzgó «${juicio.veredicto}» (${juicio.motivo ?? "sin motivo"})`);
          if (esperado === "detectada") assert.equal(juicio.motivo, "prueba_fallida");
          // Un error del código (no compila, no carga) se reconoce como tal: «sin señal» significaría que el
          // ejecutor falló y la salida no se entendió
          if (esperado === "no_concluyente") assert.ok(juicio.motivo === "no_compila" || juicio.motivo === "no_carga" || (/^(?:excepcion-en-prueba|guardia-en-llamada)$/.test(situacion) && juicio.motivo === "excepcion_no_asercion"),`${ejecutor}/${situacion}: motivo «${juicio.motivo}»`);
        });
      }
    });
  }
});

describe("capturas reales — motivo de lo no concluyente", () => {
  // No cambia la puntuación (las dos quedan fuera del denominador), pero es lo que lee quien revisa el registro
  /** @type {[string, string, string][]} */
  const casos = [
    ["pytest", "sintaxis", "no_compila"], ["pytest", "importacion", "no_carga"], ["pytest", "excepcion-al-cargar", "no_carga"],
    ["unittest", "sintaxis", "no_compila"], ["unittest", "importacion", "no_carga"], ["unittest", "excepcion-al-cargar", "no_carga"],
    ["jest", "sintaxis", "no_compila"], ["jest", "importacion", "no_carga"], ["jest", "excepcion-al-cargar", "no_carga"],
    ["jest-ts", "sintaxis", "no_compila"], ["jest-ts", "error-de-tipos", "no_compila"], ["jest-ts", "excepcion-al-cargar", "no_compila"],   // ts-jest rechaza el cable trampa por tipos (TS2367) antes de ejecutarlo
    ["vitest", "sintaxis", "no_compila"], ["vitest", "importacion", "no_carga"], ["vitest", "excepcion-al-cargar", "no_carga"],
    ["node-test", "sintaxis", "no_compila"], ["node-test", "importacion", "no_carga"], ["node-test", "excepcion-al-cargar", "no_carga"],
    ["node-test-ts", "sintaxis", "no_compila"], ["node-test-ts", "importacion", "no_carga"], ["node-test-ts", "excepcion-al-cargar", "no_carga"],
    ["go-test", "sintaxis", "no_compila"], ["go-test", "importacion", "no_compila"], ["go-test", "excepcion-al-cargar", "no_carga"],
    // N-02: lo que antes era «detectada» por cualquier excepcion; solo la asercion cuenta
    ...EJECUTORES.map((e) => /** @type {[string, string, string]} */ ([e, "excepcion-en-prueba", "excepcion_no_asercion"])),
    ...EJECUTORES.map((e) => /** @type {[string, string, string]} */ ([e, "guardia-en-llamada", "excepcion_no_asercion"])),
    // y las aserciones siguen siendo fallo de prueba
    ...EJECUTORES.map((e) => /** @type {[string, string, string]} */ ([e, "asercion", "prueba"])),
  ];
  for (const [ejecutor, situacion, motivo] of casos) {
    test(`${ejecutor}/${situacion} → ${motivo}`, () => {
      const { ejecucion, cabecera } = leerCaptura(join(DIR, ejecutor, `${situacion}.txt`));
      assert.equal(senalDeFallo(`${ejecucion.stdout}\n${ejecucion.stderr}`, /** @type {any} */ (cabecera.lenguaje)), motivo);
    });
  }
});
