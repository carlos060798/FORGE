// @ts-check
/**
 * Éxito sospechoso por cuenta de pruebas (ADR-18): lo que el agente de pruebas escribió frente a
 * lo que informa el ejecutor. Detecta un corte a mitad de la ejecución aunque la llamada esté escondida.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { contarPruebasDeclaradas, contarPruebasInformadas, detectarSospecha } from "../core/ciclo/sospecha.js";

const js = (n) => ({ ruta: "tests/a.test.js", contenido: Array.from({ length: n }, (_, i) => `test("caso ${i}", () => {});`).join("\n") });

describe("pruebas declaradas", () => {
  test("cuenta test, it, def test_ y func Test", () => {
    assert.equal(contarPruebasDeclaradas([js(3)]), 3);
    assert.equal(contarPruebasDeclaradas([{ ruta: "t.js", contenido: "describe('x', () => {\n  it('a', () => {});\n  it.skip('b', () => {});\n});" }]), 2);
    assert.equal(contarPruebasDeclaradas([{ ruta: "t.py", contenido: "def test_a():\n  pass\nasync def test_b():\n  pass\ndef helper():\n  pass\n" }]), 2);
    assert.equal(contarPruebasDeclaradas([{ ruta: "a_test.go", contenido: "func TestA(t *testing.T) {}\nfunc TestB(t *testing.T) {}\nfunc helper() {}\n" }]), 2);
    assert.equal(contarPruebasDeclaradas([]), 0);
  });
});

describe("pruebas informadas", () => {
  test("lee el resumen de node:test, jest, unittest, pytest y mocha", () => {
    assert.equal(contarPruebasInformadas("ℹ tests 12\nℹ pass 12"), 12);
    assert.equal(contarPruebasInformadas("# tests 7\n# pass 7"), 7);
    assert.equal(contarPruebasInformadas("Tests:       1 failed, 4 passed, 5 total"), 5);
    assert.equal(contarPruebasInformadas("Ran 3 tests in 0.001s\n\nOK"), 3);
    assert.equal(contarPruebasInformadas("==== 3 passed, 1 skipped in 0.12s ===="), 4);
    assert.equal(contarPruebasInformadas("  5 passing (12ms)\n  1 failing"), 6);
    assert.equal(contarPruebasInformadas("ok  \tdemo\t0.003s"), null);
    assert.equal(contarPruebasInformadas(""), null);
  });
});

describe("detectarSospecha con la cuenta de pruebas", () => {
  const salida = (n) => `ℹ tests ${n}\nℹ pass ${n}\nℹ fail 0`;

  test("una ejecución que informa de menos pruebas de las escritas es sospechosa, aunque el corte esté escondido", () => {
    const escondido = { ruta: "src/a.js", contenido: "export function f() {\n  if (globalThis.x) {\n    process.exit(0);\n  }\n}\n" };
    const m = detectarSospecha({ stdout: salida(1), pruebas: [js(4)], archivos: [escondido] });
    assert.equal(m.length, 1);
    assert.match(m[0], /escribió 4 pruebas y la salida informa de 1/);
  });

  test("las mismas pruebas, o más (parametrizadas), no son sospechosas", () => {
    assert.deepEqual(detectarSospecha({ stdout: salida(4), pruebas: [js(4)] }), []);
    assert.deepEqual(detectarSospecha({ stdout: salida(9), pruebas: [js(4)] }), []);
  });

  test("si el ejecutor no da una cuenta legible, no se opina sobre ella", () => {
    assert.deepEqual(detectarSospecha({ stdout: "ok  \tdemo\t0.003s", pruebas: [{ ruta: "a_test.go", contenido: "func TestA(t *testing.T) {}\nfunc TestB(t *testing.T) {}\n" }] }), []);
  });

  test("sin pruebas declaradas no se compara nada", () => {
    assert.deepEqual(detectarSospecha({ stdout: salida(1), pruebas: [] }), []);
  });
});
