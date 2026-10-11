// @ts-check
/**
 * Prueba de la batería de textos hostiles de las integraciones (spike S0.3).
 *
 * Comprueba solo el archivo de datos, no ningún comportamiento del sistema (aún no existe):
 *  - es JSON válido y un arreglo de al menos 30 casos;
 *  - cada caso tiene id, categoria, titulo, cuerpo y esperado, y los ids son únicos;
 *  - cubre las categorías mínimas pedidas;
 *  - ningún cuerpo contiene un secreto con formato conocido salvo los de categoría
 *    `secreto_ejemplo`, que además llevan la marca EJEMPLO/INVENTADO;
 *  - el archivo no lleva caracteres invisibles ni de control sin escapar (se escriben como \uXXXX).
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./helpers.js";
import { redactar } from "../core/ciclo/redactar.js";

const RUTA = join(ROOT, "tests", "fixtures", "integraciones", "hostiles.json");
const crudo = readFileSync(RUTA, "utf8");
/** @type {{id:string,categoria:string,titulo:string,cuerpo:string,esperado:string}[]} */
const casos = JSON.parse(crudo);

const CATEGORIAS_MINIMAS = [
  "orden_directa",
  "falsa_cabecera",
  "falso_cierre",
  "marcador_forge",
  "enlace_imagen",
  "bloque_codigo",
  "caracteres_control",
  "texto_largo",
  "secreto_ejemplo",
  "json_yaml",
  "alfabetos",
];

/** Formatos de secreto reales conocidos (heurística propia de la prueba, no la redacción del sistema). */
const FORMATOS_SECRETO = [
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{30,}\b/,
  /\bglpat-[A-Za-z0-9_-]{20,}\b/,
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/,
  /\bsk[-_](?:live|test|ant|proj)?[-_]?[A-Za-z0-9_-]{20,}\b/,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/,
  /\bAIza[0-9A-Za-z_-]{35}\b/,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bATATT[A-Za-z0-9_=-]{20,}/,
  /\bBearer\s+[A-Za-z0-9._~+/-]{20,}/,
  /\b[a-z][a-z0-9+.-]{0,30}:\/\/[^/\s:@]+:[^/\s@]+@/i,
];

/** Quita caracteres invisibles para que un secreto partido con ellos tampoco pase. */
function sinInvisibles(texto) {
  return texto.replace(/[­᠎​-‏‪-‮⁠-⁤﻿]/g, "");
}

describe("integraciones — batería hostil (estructura)", () => {
  test("es un arreglo con al menos 30 casos", () => {
    assert.ok(Array.isArray(casos));
    assert.ok(casos.length >= 30, `solo hay ${casos.length} casos`);
  });

  test("cada caso tiene los campos de texto no vacíos (cuerpo puede ser largo)", () => {
    for (const c of casos) {
      for (const campo of ["id", "categoria", "titulo", "cuerpo", "esperado"]) {
        assert.equal(typeof c[campo], "string", `${c.id ?? "?"}: ${campo} no es texto`);
        assert.ok(c[campo].length > 0, `${c.id ?? "?"}: ${campo} está vacío`);
      }
      assert.deepEqual(
        Object.keys(c).sort(),
        ["categoria", "cuerpo", "esperado", "id", "titulo"],
        `${c.id}: campos inesperados`
      );
    }
  });

  test("los ids son únicos", () => {
    const ids = casos.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  test("cubre las categorías mínimas", () => {
    const presentes = new Set(casos.map((c) => c.categoria));
    for (const cat of CATEGORIAS_MINIMAS) {
      assert.ok(presentes.has(cat), `falta la categoría ${cat}`);
    }
  });

  test("`esperado` describe una garantía, no una lista vacía de palabras", () => {
    for (const c of casos) {
      assert.ok(c.esperado.length >= 30, `${c.id}: esperado demasiado corto`);
    }
  });

  test("hay al menos un caso largo (más de 10 000 caracteres)", () => {
    assert.ok(casos.some((c) => c.categoria === "texto_largo" && c.cuerpo.length > 10000));
  });
});

describe("integraciones — batería hostil (sin secretos reales)", () => {
  test("ningún caso fuera de `secreto_ejemplo` contiene un formato de secreto conocido", () => {
    for (const c of casos) {
      if (c.categoria === "secreto_ejemplo") continue;
      const texto = sinInvisibles(`${c.titulo}\n${c.cuerpo}\n${c.esperado}`);
      for (const patron of FORMATOS_SECRETO) {
        assert.ok(!patron.test(texto), `${c.id} (${c.categoria}) contiene algo con formato ${patron}`);
      }
    }
  });

  test("los casos `secreto_ejemplo` están marcados como inventados", () => {
    const ejemplos = casos.filter((c) => c.categoria === "secreto_ejemplo");
    assert.ok(ejemplos.length >= 3);
    for (const c of ejemplos) {
      assert.match(c.cuerpo, /EJEMPLO|ejemplo|INVENTADO/, `${c.id}: sin marca de ejemplo`);
    }
  });

  test("la redacción actual cambia cada caso `secreto_ejemplo` (los valores tienen formato conocido)", () => {
    for (const c of casos.filter((x) => x.categoria === "secreto_ejemplo")) {
      assert.notEqual(redactar(c.cuerpo), c.cuerpo, `${c.id}: la redacción no lo reconoce`);
    }
  });
});

describe("integraciones — batería hostil (archivo)", () => {
  test("el archivo no contiene caracteres invisibles ni de control sin escapar", () => {
    // Permitidos: salto de línea y sangrado del JSON
    const prohibidos = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F­᠎​-‏‪-‮⁠-⁤⁦-⁩﻿]|[\u{E0000}-\u{E007F}]/u;
    assert.ok(!prohibidos.test(crudo), "hay un carácter invisible o de control literal en el archivo");
  });

  test("los caracteres invisibles de los casos existen una vez leído el JSON", () => {
    const rlo = casos.find((c) => c.categoria === "caracteres_control" && c.cuerpo.includes("‮"));
    assert.ok(rlo, "falta el caso RLO");
    assert.ok(casos.some((c) => c.cuerpo.includes("​")));
    assert.ok(casos.some((c) => c.cuerpo.startsWith("﻿")));
  });
});
