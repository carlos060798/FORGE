// @ts-check
/**
 * Prueba estática (spec 2026-10-14-defensa-inyeccion-y-fuga, F2.6): todo sitio de `core/ciclo` y
 * `core/recuperacion` que lee del árbol del proyecto está REGISTRADO: o su contenido llega al modelo
 * delimitado como dato (`comoArchivo`), o no llega al modelo (huellas, comparaciones, medición).
 *
 * Si añades una lectura nueva y esta prueba falla, decide a qué lado cae y regístrala aquí. Si va al
 * modelo, delimítala con `comoArchivo`. No hace falta tocar nada más: es la lista que el spike
 * `puntos-de-entrada.md` entregó, convertida en una comprobación.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./helpers.js";

/** @typedef {'delimitado' | 'no_va_al_modelo'} Destino */

/** @type {Record<string, Destino>} */
const REGISTRO = {
  // herramientas del implementador por turnos
  "core/ciclo/herramientas-coder.js::crearHerramientasCoder": "no_va_al_modelo",   // BOM y texto actual, para comparar
  "core/ciclo/herramientas-coder.js::leer_archivo": "delimitado",
  "core/ciclo/herramientas-coder.js::listar": "delimitado",
  "core/ciclo/herramientas-coder.js::buscar": "delimitado",
  "core/ciclo/herramientas-coder.js::editar": "no_va_al_modelo",                   // lee para aplicar la sustitución
  "core/ciclo/herramientas-coder.js::estadoDeEscritura": "no_va_al_modelo",        // huellas
  // secciones del prompt
  "core/ciclo/nodos.js::seccionProyecto": "delimitado",
  "core/ciclo/nodos.js::seccionMapa": "delimitado",
  "core/ciclo/nodos.js::seccionImplementacionActual": "delimitado",
  "core/ciclo/nodos.js::leerPruebas": "delimitado",
  "core/ciclo/nodos.js::sandbox": "no_va_al_modelo",                               // detector de sospecha
  "core/ciclo/pruebas-confiables.js::textoDeArchivos": "delimitado",
  // recuperador: devuelve fragmentos; el ciclo los delimita en nodos.js (contextoComoDato)
  "core/recuperacion/recuperador-archivos.js::leerComoTexto": "no_va_al_modelo",   // lectura acotada; el llamador devuelve el fragmento
  "core/recuperacion/recuperador-archivos.js::recuperarPorArchivos": "delimitado",
  // escritura
  "core/ciclo/protocolo-archivos.js::textoAnterior": "no_va_al_modelo",            // para decidir qué es «nuevo»
  "core/ciclo/protocolo-archivos.js::huellasAlteradas": "no_va_al_modelo",
};

const ARCHIVOS = [
  "core/ciclo/nodos.js", "core/ciclo/turnos.js", "core/ciclo/pruebas-confiables.js", "core/ciclo/herramientas-coder.js",
  "core/ciclo/protocolo-archivos.js", "core/recuperacion/recuperador-archivos.js", "core/recuperacion/recuperador-semantico.js",
];
const LECTURA = /\b(?:readFileSync|leerComoTexto|listarArchivosIndexables|readdirSync|readSync)\(/;
const FUNCION_RAIZ = /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/;
const METODO = /^ {4}(?:async\s+)?(\w+)\([^)]*\)\s*\{\s*$/;

/** @returns {Set<string>} */
function lecturasEncontradas() {
  const salida = new Set();
  for (const archivo of ARCHIVOS) {
    const lineas = readFileSync(join(ROOT, archivo), "utf8").replace(/\r\n/g, "\n").split("\n");
    for (let i = 0; i < lineas.length; i++) {
      const l = lineas[i];
      if (!LECTURA.test(l) || /^\s*(?:\/\/|\*|import\b)/.test(l)) continue;
      // La definición de `leerComoTexto` o la importación no son lecturas nuevas
      let nombre = "(fuera de funciones)";
      for (let j = i; j >= 0; j--) {
        const m = FUNCION_RAIZ.exec(lineas[j]) ?? (archivo.endsWith("herramientas-coder.js") ? METODO.exec(lineas[j]) : null);
        if (m) { nombre = m[1]; break; }
      }
      salida.add(`${archivo}::${nombre}`);
    }
  }
  return salida;
}

describe("toda lectura del árbol hacia el modelo está registrada (F2.6)", () => {
  test("no hay lecturas sin registrar", () => {
    const sinRegistrar = [...lecturasEncontradas()].filter((k) => !(k in REGISTRO));
    assert.deepEqual(sinRegistrar, [], `lecturas nuevas sin registrar en tests/entradas-registradas.test.js: decide si van al modelo (y delimítalas con comoArchivo) o no: ${sinRegistrar.join(", ")}`);
  });

  test("el registro no tiene entradas que ya no existen", () => {
    const encontradas = lecturasEncontradas();
    const viejas = Object.keys(REGISTRO).filter((k) => !encontradas.has(k));
    assert.deepEqual(viejas, [], `entradas del registro que ya no leen nada: ${viejas.join(", ")}`);
  });

  test("los archivos que van al modelo usan comoArchivo", () => {
    const archivosDelimitados = new Set(Object.entries(REGISTRO).filter(([, d]) => d === "delimitado").map(([k]) => k.split("::")[0]));
    for (const archivo of archivosDelimitados) {
      // recuperador-archivos delimita en nodos.js: el recuperador devuelve fragmentos
      const donde = archivo.startsWith("core/recuperacion/") ? "core/ciclo/nodos.js" : archivo;
      assert.match(readFileSync(join(ROOT, donde), "utf8"), /comoArchivo\(/, `${donde} no usa comoArchivo`);
    }
  });

  test("el ciclo no usa el `texto` pegado del recuperador: usa los fragmentos (uno por bloque)", () => {
    const nodos = readFileSync(join(ROOT, "core/ciclo/nodos.js"), "utf8");
    assert.match(nodos, /texto: contextoComoDato\(r\)/);
    // El único sitio que llama al recuperador es textoDeContexto
    const llamadas = nodos.match(/deps\.recuperar\(/g) ?? [];
    assert.equal(llamadas.length, 1);
  });
});
