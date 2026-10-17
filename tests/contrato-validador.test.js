// @ts-check
/**
 * Validador de subconjunto de JSON Schema (spec 2026-10-14-contrato-publico, F1).
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { validar, comprobarEsquema } from "../core/contrato/validar.js";

describe("validar: palabras clave del subconjunto", () => {
  test("type simple, union e integer", () => {
    assert.deepEqual(validar({ type: "string" }, "a"), []);
    assert.equal(validar({ type: "string" }, 1).length, 1);
    assert.deepEqual(validar({ type: ["number", "null"] }, null), []);
    assert.equal(validar({ type: "integer" }, 1.5).length, 1);
    assert.equal(validar({ type: "object" }, []).length, 1);
    assert.equal(validar({ type: "array" }, {}).length, 1);
    assert.equal(validar({ type: "number" }, NaN).length, 1);
  });
  test("required, properties y additionalProperties", () => {
    const e = { type: "object", required: ["a"], properties: { a: { type: "string" } }, additionalProperties: false };
    assert.deepEqual(validar(e, { a: "x" }), []);
    assert.match(validar(e, {}).join("|"), /\$\.a: falta/);
    assert.match(validar(e, { a: "x", b: 1 }).join("|"), /campo adicional b/);
    assert.match(validar(e, { a: 1 }).join("|"), /\$\.a/);
    const abierto = { type: "object", additionalProperties: { type: "number" } };
    assert.deepEqual(validar(abierto, { z: 1 }), []);
    assert.equal(validar(abierto, { z: "s" }).length, 1);
  });
  test("enum, const, minimum, maximum", () => {
    assert.equal(validar({ enum: ["a", "b"] }, "c").length, 1);
    assert.deepEqual(validar({ enum: ["a", null] }, null), []);
    assert.equal(validar({ const: 1 }, 2).length, 1);
    assert.equal(validar({ type: "number", minimum: 0 }, -1).length, 1);
    assert.equal(validar({ type: "number", maximum: 1 }, 2).length, 1);
  });
  test("items, minItems, maxItems, minLength, maxLength, pattern", () => {
    assert.match(validar({ type: "array", items: { type: "string" } }, ["a", 2]).join("|"), /\$\[1\]/);
    assert.equal(validar({ type: "array", minItems: 1 }, []).length, 1);
    assert.equal(validar({ type: "array", maxItems: 1 }, [1, 2]).length, 1);
    assert.equal(validar({ type: "string", minLength: 2 }, "a").length, 1);
    assert.equal(validar({ type: "string", maxLength: 2 }, "abc").length, 1);
    assert.deepEqual(validar({ type: "string", pattern: "^[0-9]+$" }, "123"), []);
    assert.equal(validar({ type: "string", pattern: "^[0-9]+$" }, "12a").length, 1);
  });
  test("anidamiento de tres niveles con ruta en el error", () => {
    const e = { type: "object", properties: { a: { type: "object", properties: { b: { type: "array", items: { type: "object", required: ["c"] } } } } } };
    assert.match(validar(e, { a: { b: [{ c: 1 }, {}] } }).join("|"), /\$\.a\.b\[1\]\.c/);
  });
  test("anotaciones y x-interno se ignoran; el tope de errores se respeta", () => {
    assert.deepEqual(validar({ $schema: "x", $id: "y", title: "t", description: "d", default: 1, format: "date-time", "x-interno": true, type: "string" }, "no-fecha"), []);
    assert.ok(validar({ type: "array", items: { type: "string" } }, Array(100).fill(1)).length <= 21);
  });
  test("pattern: una cadena enorme no se evalua (acotado)", () => {
    assert.match(validar({ type: "string", pattern: "a" }, "b".repeat(70000)).join("|"), /demasiado larga/);
  });
});

describe("validar: el esquema se rechaza si usa algo fuera del subconjunto", () => {
  for (const k of ["oneOf", "anyOf", "allOf", "not", "$ref", "patternProperties", "uniqueItems", "if", "prefixItems", "dependentRequired"]) {
    test(`palabra clave no soportada: ${k}`, () => {
      assert.throws(() => validar({ type: "object", [k]: {} }, {}), /palabra clave no soportada/);
      assert.throws(() => comprobarEsquema({ properties: { a: { [k]: 1 } } }), new RegExp(k.replace("$", "\\$")));
    });
  }
  test("tipo desconocido y items en forma de lista", () => {
    assert.throws(() => validar({ type: "decimal" }, 1), /tipo no soportado/);
    assert.throws(() => comprobarEsquema({ items: [{ type: "string" }] }), /items/);
  });
});

describe("validar: solo cuentan las propiedades propias", () => {
  const esquema = { type: "object", properties: { a: { type: "string" } }, additionalProperties: false };

  test("un campo llamado como una propiedad heredada de Object NO se toma por declarado", () => {
    for (const k of ["constructor", "toString", "hasOwnProperty", "valueOf"]) {
      const errores = validar(esquema, JSON.parse(`{"a":"x","${k}":1}`));
      assert.ok(errores.some((e) => e.includes(`campo adicional ${k}`)), `${k} debe señalarse como adicional`);
    }
  });

  test("__proto__ como clave de datos tampoco se cuela", () => {
    const errores = validar(esquema, JSON.parse('{"a":"x","__proto__":{"b":1}}'));
    assert.ok(errores.some((e) => e.includes("campo adicional __proto__")));
  });

  test("required no se da por cumplido con una propiedad heredada", () => {
    const errores = validar({ type: "object", required: ["toString"] }, {});
    assert.ok(errores.some((e) => e.includes("falta (obligatorio)")));
  });

  test("un campo declarado con ese nombre sí se valida", () => {
    const e = { type: "object", properties: { constructor: { type: "integer" } }, additionalProperties: false };
    assert.deepEqual(validar(e, JSON.parse('{"constructor":3}')), []);
    assert.ok(validar(e, JSON.parse('{"constructor":"x"}')).length > 0);
  });
});
