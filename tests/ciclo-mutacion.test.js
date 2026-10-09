// @ts-check
/**
 * Medición de las pruebas por mutación propia (spec 2026-10-09-pruebas-confiables, HU-002 y HU-003; ADR-20).
 *
 * Sin modelos. Los tests de la medición usan un ejecutor falso que decide leyendo los archivos de
 * la copia que recibe, así que recorren la copia y la alteración de verdad. El último bloque usa
 * Docker real y solo corre con FORGE_TEST_DOCKER=1.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

import {
  alteracionesDe, aplicarAlteracion, enmascarar, generarAlteraciones, lenguajeDe, medirMutacion, puntuar, seleccionar,
} from "../core/ciclo/mutacion.js";
import { decidirTrasMutacion, detallePruebasDebiles } from "../core/ciclo/router.js";
import { estadoInicial, MOTIVOS, validarEstado } from "../core/ciclo/estado.js";
import { transicion } from "../core/ciclo/grafo.js";
import { leerConfigCiclo, POR_DEFECTO } from "../core/ciclo/config.js";
import { CicloVerificado, lineasEstadoCiclo, textoMutacion } from "../core/ciclo/index.js";
import { NODOS } from "../core/ciclo/nodos.js";
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

/** Huella de todos los archivos de una carpeta (ruta → sha256), sin la carpeta `.sdd`. */
function huellas(dir, rel = "") {
  /** @type {Record<string, string>} */
  const mapa = {};
  for (const nombre of readdirSync(join(dir, rel)).sort()) {
    if (rel === "" && nombre === ".sdd") continue;
    const hijo = rel ? `${rel}/${nombre}` : nombre;
    if (statSync(join(dir, hijo)).isDirectory()) Object.assign(mapa, huellas(dir, hijo));
    else mapa[hijo] = createHash("sha256").update(readFileSync(join(dir, hijo))).digest("hex");
  }
  return mapa;
}

const resumen = (alteraciones) => alteraciones.map((a) => `${a.linea}:${a.operador}:${a.despues}`);
const operadores = (alteraciones) => alteraciones.map((a) => a.operador);

// ── Generación ───────────────────────────────────────────────────────────────

describe("generarAlteraciones — JavaScript con acorn", () => {
  const SUMA = "export function suma(a, b) {\n  if (a < 0) {\n    return 0;\n  }\n  return a + b;\n}\n";

  test("los cuatro operadores, por orden de posición, con línea y texto antes y después", () => {
    const a = generarAlteraciones("src/suma.js", SUMA);
    assert.deepEqual(resumen(a), [
      "2:condicion:if (!(a < 0)) {",
      "2:comparacion:if (a >= 0) {",
      "2:constante:if (a < 1) {",
      "3:constante:return 1;",
      "3:retorno:return null;",
      "5:retorno:return null;",
    ]);
    assert.equal(a[0].ruta, "src/suma.js");
    assert.equal(a[1].antes, "if (a < 0) {");
    for (const x of a) assert.notEqual(aplicarAlteracion(SUMA, x), SUMA, "toda alteración cambia el código");
  });

  test("invierte cada comparación por su contraria", () => {
    const pares = { "<": ">=", ">=": "<", ">": "<=", "<=": ">", "===": "!==", "!==": "===", "==": "!=", "!=": "==" };
    for (const [op, contrario] of Object.entries(pares)) {
      const a = generarAlteraciones("x.js", `const r = a ${op} b;\n`).filter((x) => x.operador === "comparacion");
      assert.equal(a.length, 1, op);
      assert.equal(a[0].despues, `const r = a ${contrario} b;`, op);
    }
  });

  test("constantes: n → n+1, 0 → 1 y los booleanos se invierten", () => {
    const a = generarAlteraciones("x.js", "const a = 0;\nconst b = 41;\nconst c = true;\nconst d = false;\nconst e = 1.5;\n");
    assert.deepEqual(resumen(a), ["1:constante:const a = 1;", "2:constante:const b = 42;", "3:constante:const c = false;", "4:constante:const d = true;", "5:constante:const e = 2.5;"]);
  });

  test("niega la condición de if, while y do-while", () => {
    const a = generarAlteraciones("x.js", "while (i) { i--; }\ndo { i++; } while (seguir);\nif (a && b) f();\n").filter((x) => x.operador === "condicion");
    assert.deepEqual(a.map((x) => x.despues), ["while (!(i)) { i--; }", "do { i++; } while (!(seguir));", "if (!(a && b)) f();"]);
  });

  test("sustituye el valor devuelto, también el de una función flecha sin llaves", () => {
    const a = generarAlteraciones("x.js", "const f = (a, b) => a + b;\nfunction g() { return null; }\nfunction h() { return x; }\nfunction i() { return; }\n")
      .filter((x) => x.operador === "retorno");
    assert.deepEqual(a.map((x) => x.despues), ["const f = (a, b) => null;", "function g() { return 1; }", "function h() { return null; }"]);
  });

  test("dos operadores que proponen el mismo cambio dan una sola alteración", () => {
    // Invertir el booleano devuelto es a la vez «constante» y «retorno»: se prueba una vez
    assert.deepEqual(resumen(generarAlteraciones("x.js", "function h() { return true; }\n")), ["1:constante:function h() { return false; }"]);
  });

  test("nunca altera nada dentro de una cadena, una plantilla, una expresión regular o un comentario", () => {
    const codigo = [
      "// si a < 0 devuelve 1 y true",
      "/* return 5 > 3 */",
      "const texto = 'a < b, 7 y true';",
      "const plantilla = `x === 9 ${nombre}`;",
      "const re = /a<b|1==2/;",
      "const clave = { 0: valor, 'b': otro };",
    ].join("\n") + "\n";
    assert.deepEqual(generarAlteraciones("x.js", codigo), []);
  });

  test("el código alterado sigue siendo JavaScript válido", async () => {
    const { parse } = await import("acorn");
    for (const a of generarAlteraciones("src/suma.js", SUMA)) {
      assert.doesNotThrow(() => parse(aplicarAlteracion(SUMA, a), { ecmaVersion: "latest", sourceType: "module" }), a.despues);
    }
  });

  test("CommonJS también se analiza", () => {
    assert.deepEqual(operadores(generarAlteraciones("x.cjs", "module.exports = function (a) { return a > 2; };\n")), ["retorno", "comparacion", "constante"]);
  });

  test("JavaScript que no se puede analizar no se altera a ciegas", () => {
    assert.deepEqual(generarAlteraciones("x.js", "function ( {\n  return 1 < 2;\n"), []);
    assert.deepEqual(generarAlteraciones("x.jsx", "const A = () => <div>{1 < 2}</div>;\n"), []);
  });

  test("archivos vacíos o de un lenguaje no cubierto no dan ninguna alteración", () => {
    assert.deepEqual(generarAlteraciones("x.js", ""), []);
    assert.deepEqual(generarAlteraciones("x.rb", "return 1 < 2\n"), []);
    assert.deepEqual(generarAlteraciones("README.md", "si 1 < 2\n"), []);
    assert.equal(lenguajeDe("a/b.MJS"), "javascript");
    assert.equal(lenguajeDe("a.tsx"), "typescript");
    assert.equal(lenguajeDe("a.py"), "python");
    assert.equal(lenguajeDe("a.go"), "go");
    assert.equal(lenguajeDe("Makefile"), null);
  });
});

describe("generarAlteraciones — TypeScript", () => {
  test("si acorn lo entiende (sin tipos) se usa el árbol", () => {
    assert.deepEqual(resumen(generarAlteraciones("x.ts", "export const mayor = (a, b) => a > b;\n")), ["1:retorno:export const mayor = (a, b) => null;", "1:comparacion:export const mayor = (a, b) => a <= b;"]);
  });

  test("con tipos se usan patrones de texto, sin tocar genéricos, flechas, cadenas ni comentarios", () => {
    const codigo = [
      "import { x } from './x';",
      "interface Caja<T> { valor: T; total: 3 }",
      "export function limite(n: number, mapa: Map<string, number>): number {",
      "  // si n < 0 devuelve 99",
      "  const texto: string = 'n > 5 es true';",
      "  if (n < 0) {",
      "    return 0;",
      "  }",
      "  const doble = (v: number): number => v * 2;",
      "  return doble(n);",
      "}",
    ].join("\n") + "\n";
    assert.deepEqual(resumen(generarAlteraciones("x.ts", codigo)), [
      "6:condicion:if (!(n < 0)) {",
      "6:comparacion:if (n >= 0) {",
      "6:constante:if (n < 1) {",
      "7:constante:return 1;",
      "7:retorno:return null;",
      "9:constante:const doble = (v: number): number => v * 3;",
      "10:retorno:return null;",
    ]);
  });
});

describe("generarAlteraciones — Python por patrones", () => {
  const CODIGO = [
    "import os",
    "def limite(n):",
    "    \"\"\"Devuelve 0 si n < 0, si no n + 1.\"\"\"",
    "    # si n < 0 devuelve 5",
    "    texto = 'n > 3 y True'",
    "    if n < 0:",
    "        return 0",
    "    while n >= 10:",
    "        n = n - 10",
    "    activo = True",
    "    return n",
  ].join("\n") + "\n";

  test("los cuatro operadores, sin tocar cadenas, documentación ni comentarios", () => {
    assert.deepEqual(resumen(generarAlteraciones("src/limite.py", CODIGO)), [
      "6:condicion:if not (n < 0):",
      "6:comparacion:if n >= 0:",
      "6:constante:if n < 1:",
      "7:constante:return 1",
      "7:retorno:return None",
      "8:condicion:while not (n >= 10):",
      "8:comparacion:while n < 10:",
      "8:constante:while n >= 11:",
      "9:constante:n = n - 11",
      "10:constante:activo = False",
      "11:retorno:return None",
    ]);
  });

  test("return None pasa a devolver otra cosa y los booleanos se invierten una sola vez", () => {
    assert.deepEqual(resumen(generarAlteraciones("x.py", "def f():\n    return None\ndef g():\n    return True\n")), ["2:retorno:return 1", "4:constante:return False"]);
  });

  test("es conservador: no toca decimales, hexadecimales, nombres con cifras ni un return partido en varias líneas", () => {
    assert.deepEqual(generarAlteraciones("x.py", "x1 = 0x1F\ny = 1.5\nz = 1_000\n"), []);
    assert.deepEqual(operadores(generarAlteraciones("x.py", "def f():\n    return (\n        a\n    )\n")), []);
  });
});

describe("generarAlteraciones — Go por patrones", () => {
  const CODIGO = [
    "package limite",
    "",
    "import \"fmt\"",
    "",
    "// Limite devuelve 0 si n < 0",
    "func Limite(n int) int {",
    "\tmsg := \"n > 3\"",
    "\traw := `a == b y 7`",
    "\tif n < 0 {",
    "\t\treturn 0",
    "\t}",
    "\tfor n >= 10 {",
    "\t\tn -= 10",
    "\t}",
    "\tif v, ok := m[n]; ok {",
    "\t\tfmt.Println(v, msg, raw)",
    "\t}",
    "\treturn n",
    "}",
    "",
    "func EsPar(n int) bool {",
    "\treturn true",
    "}",
  ].join("\n") + "\n";

  test("comparaciones, constantes, condiciones y booleanos devueltos; un return de otro tipo no se toca", () => {
    assert.deepEqual(resumen(generarAlteraciones("limite.go", CODIGO)), [
      "9:condicion:if !(n < 0) {",
      "9:comparacion:if n >= 0 {",
      "9:constante:if n < 1 {",
      "10:constante:return 1",
      "12:condicion:for !(n >= 10) {",
      "12:comparacion:for n < 10 {",
      "12:constante:for n >= 11 {",
      "13:constante:n -= 11",
      "15:condicion:if v, ok := m[n]; !(ok) {",
      "22:constante:return false",
    ]);
  });

  test("un bucle con range o con tres partes no es una condición", () => {
    const a = generarAlteraciones("x.go", "package x\nfunc f(xs []int) {\n\tfor i := 0; i < 3; i++ {\n\t}\n\tfor _, x := range xs {\n\t}\n}\n");
    assert.ok(!operadores(a).includes("condicion"));
  });
});

describe("enmascarar", () => {
  test("conserva la longitud y los saltos de línea", () => {
    for (const [lenguaje, codigo] of /** @type {[any, string][]} */ ([
      ["python", "a = 'x < 1'  # 2 > 1\nb = \"\"\"tres\nlíneas 9\"\"\"\n"],
      ["go", "a := \"x < 1\" // 2 > 1\nb := `cruda\n9`\n/* bloque\n7 */\n"],
      ["typescript", "const a = 'x < 1'; // 2 > 1\nconst b = `p ${q} 9`;\n"],
    ])) {
      const tapado = enmascarar(codigo, lenguaje);
      assert.equal(tapado.length, codigo.length, lenguaje);
      assert.equal(tapado.split("\n").length, codigo.split("\n").length, lenguaje);
      assert.doesNotMatch(tapado, /[<>]|\d/, lenguaje);
    }
  });

  test("una cadena sin cerrar no pasa de su línea", () => {
    assert.match(enmascarar("a = 'sin cerrar\nb = 1 < 2\n", "python"), /b = 1 < 2/);
  });
});

// ── Selección ────────────────────────────────────────────────────────────────

describe("selección determinista", () => {
  test("por debajo del tope se toman todas, en su orden", () => {
    assert.deepEqual(seleccionar([1, 2, 3], 10), [1, 2, 3]);
    assert.deepEqual(seleccionar([], 10), []);
  });

  test("por encima del tope, salto uniforme sobre toda la lista", () => {
    const veinte = Array.from({ length: 20 }, (_, i) => i);
    assert.deepEqual(seleccionar(veinte, 5), [0, 4, 8, 12, 16]);
    assert.deepEqual(seleccionar(veinte, 10), [0, 2, 4, 6, 8, 10, 12, 14, 16, 18]);
    assert.deepEqual(seleccionar([0, 1, 2, 3, 4, 5, 6], 3), [0, 2, 4]);
    assert.equal(new Set(seleccionar(Array.from({ length: 13 }, (_, i) => i), 10)).size, 10, "sin repetidas");
    assert.deepEqual(seleccionar(veinte, 0), []);
  });

  test("los archivos se ordenan por ruta: el orden de entrada no cambia el resultado", () => {
    const a = { ruta: "src/a.js", contenido: "export const a = () => 1;\n" };
    const b = { ruta: "src/b.js", contenido: "export const b = (x) => x > 2;\n" };
    const uno = alteracionesDe([a, b]);
    const dos = alteracionesDe([b, a]);
    assert.deepEqual(uno, dos);
    assert.deepEqual(uno.map((x) => x.ruta), ["src/a.js", "src/a.js", "src/b.js", "src/b.js", "src/b.js"]);
  });

  test("CA-002-06: la misma entrada produce las mismas alteraciones", () => {
    const archivos = [{ ruta: "src/x.js", contenido: "export function f(a) {\n  if (a > 3) { return a - 1; }\n  return a === 0 ? 10 : 20;\n}\n" }];
    const primera = seleccionar(alteracionesDe(archivos), 4);
    const segunda = seleccionar(alteracionesDe(JSON.parse(JSON.stringify(archivos))), 4);
    assert.deepEqual(primera, segunda);
    assert.equal(primera.length, 4);
  });

  test("puntuar: detectadas entre probadas; sin ninguna probada no hay puntuación", () => {
    assert.equal(puntuar(10, 7), 0.7);
    assert.equal(puntuar(3, 3), 1);
    assert.equal(puntuar(0, 0), null);
  });
});

// ── Medición con un ejecutor falso que lee la copia ──────────────────────────

const IMPL = "export function suma(a, b) {\n  if (a < 0) {\n    return 0;\n  }\n  return a + b;\n}\n";
const IMPL_V2 = "// v2\n" + IMPL;
const BUENAS = [IMPL, IMPL_V2];
const PASE  = { exitCode: 0, stdout: "# tests 1\n# pass 1\n", stderr: "", timedOut: false, infraError: false, durationMs: 3 };
const FALLO = { exitCode: 1, stdout: "# tests 1\n# pass 0\n# fail 1\n", stderr: "AssertionError\n", timedOut: false, infraError: false, durationMs: 3 };

/**
 * Ejecutor falso: decide leyendo los archivos de la carpeta que recibe, como haría una ejecución real.
 *   - sin `src/suma.js`: falla (no hay implementación);
 *   - pruebas con «REQ:<texto>»: fallan si la implementación no contiene ese texto;
 *   - pruebas con «FUERTE»: fallan con cualquier implementación alterada;
 *   - pruebas con «MEDIA»: solo notan que falte `return a + b`;
 *   - el resto pasa siempre (pruebas débiles).
 */
function ejecutorFalso() {
  /** @type {{ dir: string, src: string|null }[]} */
  const vistas = [];
  return {
    vistas,
    test: async (dir) => {
      const rutaSrc = join(dir, "src", "suma.js");
      const src = existsSync(rutaSrc) ? readFileSync(rutaSrc, "utf8") : null;
      vistas.push({ dir, src });
      if (src === null) return { ...FALLO };
      const dirTests = join(dir, "tests");
      const pruebas = existsSync(dirTests) ? readdirSync(dirTests).map((f) => readFileSync(join(dirTests, f), "utf8")).join("\n") : "";
      const req = /REQ:(\S+)/.exec(pruebas);
      if (req && !src.includes(req[1])) return { ...FALLO };
      if (pruebas.includes("FUERTE") && !BUENAS.includes(src)) return { ...FALLO };
      if (pruebas.includes("MEDIA") && !src.includes("return a + b")) return { ...FALLO };
      return { ...PASE };
    },
  };
}

function proyecto(pruebas = "// FUERTE\n", extra = {}) {
  return escribir(tmp("forge-mut-"), { "package.json": "{\"type\":\"module\"}", "src/suma.js": IMPL, "tests/suma.test.js": pruebas, ...extra });
}

describe("medirMutacion", () => {
  test("CA-002-01 y CA-002-03: prueba cada alteración y da puntuación y sobrevivientes con archivo y línea", async () => {
    const cwd = proyecto("// MEDIA\n");
    const runner = ejecutorFalso();
    const r = await medirMutacion({ cwd, archivos: ["src/suma.js"], runner });
    assert.ok(r);
    assert.equal(r.probadas, 6);
    assert.equal(r.detectadas, 1);
    assert.equal(r.puntuacion, 1 / 6);
    assert.equal(r.parcial, false);
    assert.equal(r.candidatas, 6);
    assert.deepEqual(r.sobrevivientes.map((s) => `${s.ruta}:${s.linea}:${s.operador}`), [
      "src/suma.js:2:condicion", "src/suma.js:2:comparacion", "src/suma.js:2:constante", "src/suma.js:3:constante", "src/suma.js:3:retorno",
    ]);
    assert.deepEqual(Object.keys(r.sobrevivientes[0]).sort(), ["antes", "despues", "linea", "operador", "ruta"]);
    assert.equal(r.sobrevivientes[1].antes, "if (a < 0) {");
    assert.equal(r.sobrevivientes[1].despues, "if (a >= 0) {");
    assert.equal(runner.vistas.length, 6, "una ejecución por alteración");
    assert.equal(new Set(runner.vistas.map((v) => v.src)).size, 6, "cada ejecución vio una alteración distinta");
    assert.ok(runner.vistas.every((v) => v.src !== IMPL), "ninguna ejecución vio el código sin alterar");
  });

  test("unas pruebas fuertes detectan todas; unas débiles, ninguna", async () => {
    const fuerte = await medirMutacion({ cwd: proyecto("// FUERTE\n"), archivos: ["src/suma.js"], runner: ejecutorFalso() });
    assert.equal(fuerte?.puntuacion, 1);
    assert.deepEqual(fuerte?.sobrevivientes, []);
    const debil = await medirMutacion({ cwd: proyecto("// nada\n"), archivos: ["src/suma.js"], runner: ejecutorFalso() });
    assert.equal(debil?.puntuacion, 0);
    assert.equal(debil?.sobrevivientes.length, 6);
  });

  test("CA-002-02: el proyecto real queda idéntico (por huellas) y las pruebas se ejecutan sobre una copia que se borra", async () => {
    const cwd = proyecto("// MEDIA\n", { ".env": "SECRETO=1\n", "docs/nota.md": "hola\n" });
    const antes = huellas(cwd);
    const dirTemporal = tmp("forge-mut-tmp-");
    const runner = ejecutorFalso();
    const secretos = [];
    const original = runner.test;
    runner.test = async (dir) => { secretos.push(existsSync(join(dir, ".env"))); return original(dir); };

    await medirMutacion({ cwd, archivos: ["src/suma.js"], runner, dirTemporal });

    assert.deepEqual(huellas(cwd), antes, "ningún archivo del proyecto cambió");
    assert.equal(readFileSync(join(cwd, "src/suma.js"), "utf8"), IMPL);
    assert.ok(runner.vistas.every((v) => resolve(v.dir) !== resolve(cwd)), "nunca se ejecuta sobre el proyecto real");
    assert.ok(runner.vistas.every((v) => resolve(v.dir).startsWith(resolve(dirTemporal))), "siempre sobre la copia temporal");
    assert.deepEqual(secretos, Array(6).fill(false), "la copia respeta los vetos: los secretos no entran");
    assert.deepEqual(readdirSync(dirTemporal), [], "la copia se borra al terminar");
  });

  test("la copia se borra y el proyecto queda intacto también si el ejecutor lanza un error", async () => {
    const cwd = proyecto();
    const antes = huellas(cwd);
    const dirTemporal = tmp("forge-mut-tmp-");
    let n = 0;
    const runner = { test: async () => { if (++n === 2) throw new Error("se cayó el ejecutor"); return { ...FALLO }; } };
    await assert.rejects(medirMutacion({ cwd, archivos: ["src/suma.js"], runner, dirTemporal }), /se cayó el ejecutor/);
    assert.deepEqual(readdirSync(dirTemporal), []);
    assert.deepEqual(huellas(cwd), antes);
  });

  test("detectada es fallo o tiempo agotado; un pase es un sobreviviente", async () => {
    const guion = [{ ...FALLO }, { exitCode: null, timedOut: true, stdout: "", stderr: "" }, { ...PASE }, { ...FALLO, exitCode: 2 }, { ...PASE }, { ...FALLO }];
    const r = await medirMutacion({ cwd: proyecto(), archivos: ["src/suma.js"], runner: { test: async () => guion.shift() } });
    assert.equal(r?.probadas, 6);
    assert.equal(r?.detectadas, 4);
    assert.equal(r?.sobrevivientes.length, 2);
    assert.equal(r?.parcial, false);
  });

  test("un fallo del entorno no cuenta ni a favor ni en contra: detiene la medición y la marca parcial", async () => {
    const guion = [{ ...FALLO }, { ...PASE }, { exitCode: 125, stdout: "", stderr: "docker: no responde\n" }];
    const eventos = [];
    const r = await medirMutacion({ cwd: proyecto(), archivos: ["src/suma.js"], runner: { test: async () => guion.shift() }, alProbar: (e) => eventos.push(e) });
    assert.equal(r?.probadas, 2);
    assert.equal(r?.detectadas, 1);
    assert.equal(r?.puntuacion, 0.5);
    assert.equal(r?.parcial, true);
    assert.equal(r?.motivoParcial, "infraestructura");
    assert.match(String(r?.detalleInfra), /no responde/);
    assert.equal(r?.sobrevivientes.length, 1);
    assert.deepEqual(eventos.map((e) => e.resultado), ["detectada", "sobrevive", "sin_resultado"]);

    const nada = await medirMutacion({ cwd: proyecto(), archivos: ["src/suma.js"], runner: { test: async () => ({ exitCode: null, infraError: true, stderr: "sin Docker" }) } });
    assert.equal(nada?.probadas, 0);
    assert.equal(nada?.puntuacion, null, "sin ninguna alteración probada no se inventa una puntuación");
    assert.equal(nada?.parcial, true);
  });

  test("CA-002-04: tope de alteraciones → parcial, con salto uniforme", async () => {
    const eventos = [];
    const r = await medirMutacion({ cwd: proyecto("// FUERTE\n"), archivos: ["src/suma.js"], runner: ejecutorFalso(), max: 3, alProbar: (e) => eventos.push(e) });
    assert.equal(r?.probadas, 3);
    assert.equal(r?.candidatas, 6);
    assert.equal(r?.parcial, true);
    assert.equal(r?.motivoParcial, "tope_alteraciones");
    assert.deepEqual(eventos.map((e) => `${e.alteracion.linea}:${e.alteracion.operador}`), ["2:condicion", "2:constante", "3:retorno"]);
    assert.deepEqual(eventos.map((e) => [e.indice, e.total]), [[0, 3], [1, 3], [2, 3]]);
  });

  test("CA-002-04: tope de tiempo → se detiene y la puntuación es parcial", async () => {
    let reloj = 0;
    const runner = { test: async () => { reloj += 40_000; return { ...FALLO }; } };
    const r = await medirMutacion({ cwd: proyecto(), archivos: ["src/suma.js"], runner, timeoutMs: 100_000, ahora: () => reloj });
    assert.equal(r?.probadas, 3, "a los 120 s ya no se empieza otra");
    assert.equal(r?.puntuacion, 1);
    assert.equal(r?.parcial, true);
    assert.equal(r?.motivoParcial, "tiempo");
  });

  test("CA-002-05: sin ninguna alteración posible devuelve null y no ejecuta nada", async () => {
    const runner = ejecutorFalso();
    assert.equal(await medirMutacion({ cwd: proyecto(), archivos: [], runner }), null);
    assert.equal(await medirMutacion({ cwd: proyecto(), archivos: ["no-existe.js"], runner }), null);
    const cwd = escribir(tmp("forge-mut-"), { "src/datos.json": "{\"a\": 1}", "src/vacio.js": "// nada que alterar\n", "src/x.rb": "1 < 2\n" });
    assert.equal(await medirMutacion({ cwd, archivos: ["src/datos.json", "src/vacio.js", "src/x.rb"], runner }), null);
    assert.equal(runner.vistas.length, 0);
  });

  test("solo se alteran los archivos indicados (los que escribió el implementador)", async () => {
    const cwd = proyecto("// nada\n", { "src/otro.js": "export const otro = (a) => a > 1;\n" });
    const eventos = [];
    await medirMutacion({ cwd, archivos: ["src/suma.js"], runner: ejecutorFalso(), alProbar: (e) => eventos.push(e) });
    assert.deepEqual([...new Set(eventos.map((e) => e.alteracion.ruta))], ["src/suma.js"]);
  });

  test("RF-005: con un avance guardado no se repiten las alteraciones ya probadas", async () => {
    const cwd = proyecto("// MEDIA\n");
    let guardado = null;
    const avance = { leer: () => guardado, guardar: (d) => { guardado = JSON.parse(JSON.stringify(d)); } };

    // Primera pasada: el proceso «se corta» en la cuarta ejecución
    let n = 0;
    const base = ejecutorFalso();
    const cortado = { test: async (dir) => { if (++n === 4) throw new Error("corte"); return base.test(dir); } };
    await assert.rejects(medirMutacion({ cwd, archivos: ["src/suma.js"], runner: cortado, avance }), /corte/);
    assert.equal(guardado.hechas.length, 3);

    // Reanudación: solo se ejecutan las tres que faltaban y el resultado es el de una medición entera
    const runner = ejecutorFalso();
    const eventos = [];
    const r = await medirMutacion({ cwd, archivos: ["src/suma.js"], runner, avance, alProbar: (e) => eventos.push(e) });
    assert.equal(runner.vistas.length, 3);
    assert.equal(r?.probadas, 6);
    assert.equal(r?.detectadas, 1);
    assert.deepEqual(eventos.map((e) => e.reutilizada), [true, true, true, false, false, false]);
    const entera = await medirMutacion({ cwd, archivos: ["src/suma.js"], runner: ejecutorFalso() });
    assert.deepEqual(r, entera);
  });

  test("un avance de otro código o de otras pruebas no se reutiliza", async () => {
    const cwd = proyecto("// MEDIA\n");
    let guardado = null;
    const avance = { leer: () => guardado, guardar: (d) => { guardado = JSON.parse(JSON.stringify(d)); } };
    await medirMutacion({ cwd, archivos: ["src/suma.js"], runner: ejecutorFalso(), avance, huellasPruebas: ["t:1"] });

    const otrasPruebas = ejecutorFalso();
    await medirMutacion({ cwd, archivos: ["src/suma.js"], runner: otrasPruebas, avance, huellasPruebas: ["t:2"] });
    assert.equal(otrasPruebas.vistas.length, 6);

    writeFileSync(join(cwd, "src/suma.js"), IMPL_V2);
    const otroCodigo = ejecutorFalso();
    await medirMutacion({ cwd, archivos: ["src/suma.js"], runner: otroCodigo, avance, huellasPruebas: ["t:2"] });
    assert.equal(otroCodigo.vistas.length, 6);
  });
});

// ── Router, estado y configuración ───────────────────────────────────────────

/** @param {Partial<import("../core/ciclo/estado.js").Mutacion>|null} mutacion */
function estadoCon(mutacion, { gasto = "ok" } = {}) {
  const e = estadoInicial({ id: "T1", agente: "desarrollador-backend" }, { runId: "r1", cwd: "/tmp/x" });
  e.ejecuciones = [/** @type {any} */ ({ iteracion: 1, categoria: "pass", exitCode: 0, timedOut: false, oomKilled: false, durationMs: 1, stdoutCola: "", stderrCola: "" })];
  e.iteracion = 1;
  e.presupuesto.estado = /** @type {any} */ (gasto);
  e.mutacion = mutacion === null ? null : /** @type {any} */ ({ probadas: 10, detectadas: 5, puntuacion: 0.5, parcial: false, sobrevivientes: [], refuerzos: 0, ...mutacion });
  return e;
}
const SOBREVIVIENTE = { ruta: "src/suma.js", linea: 2, operador: "comparacion", antes: "if (a < 0) {", despues: "if (a >= 0) {" };

describe("decidirTrasMutacion — tabla de verdad (CA-003-07)", () => {
  const EXITO = { ruta: "fin_exito" };
  const exigir = { modo: "exigir", minima: 0.6 };

  test("con «informar» y con «no» la puntuación nunca cambia el resultado", () => {
    for (const modo of ["informar", "no"]) {
      assert.deepEqual(decidirTrasMutacion(estadoCon({ puntuacion: 0 }), { modo, minima: 0.6 }), EXITO);
      assert.deepEqual(decidirTrasMutacion(estadoCon({ puntuacion: 0, refuerzos: 1 }), { modo, minima: 0.6 }), EXITO);
      assert.deepEqual(decidirTrasMutacion(estadoCon({ puntuacion: null, motivoParcial: "infraestructura" }), { modo, minima: 0.6 }), EXITO);
    }
  });

  test("por defecto el modo es «informar» y el mínimo 0.6", () => {
    assert.equal(POR_DEFECTO.motor.mutacion, "informar");
    assert.equal(POR_DEFECTO.motor.mutacion_minima, 0.6);
    assert.deepEqual(decidirTrasMutacion(estadoCon({ puntuacion: 0 })), EXITO);
    assert.deepEqual(decidirTrasMutacion(estadoCon({ puntuacion: 0.59 }), { modo: "exigir" }), { ruta: "refuerzo" });
    assert.deepEqual(decidirTrasMutacion(estadoCon({ puntuacion: 0.6 }), { modo: "exigir" }), EXITO);
  });

  test("exigir: en el mínimo o por encima, éxito (con o sin refuerzo previo)", () => {
    assert.deepEqual(decidirTrasMutacion(estadoCon({ puntuacion: 0.6 }), exigir), EXITO);
    assert.deepEqual(decidirTrasMutacion(estadoCon({ puntuacion: 1, refuerzos: 1 }), exigir), EXITO);
  });

  test("exigir: bajo el mínimo y sin refuerzo → refuerzo; con un refuerzo ya hecho → revisión por pruebas_debiles", () => {
    assert.deepEqual(decidirTrasMutacion(estadoCon({ puntuacion: 0.5 }), exigir), { ruta: "refuerzo" });
    assert.deepEqual(decidirTrasMutacion(estadoCon({ puntuacion: 0.5, refuerzos: 1 }), exigir), { ruta: "revision_humana", motivo: "pruebas_debiles" });
    assert.deepEqual(decidirTrasMutacion(estadoCon({ puntuacion: 0, refuerzos: 2 }), exigir), { ruta: "revision_humana", motivo: "pruebas_debiles" });
  });

  test("exigir: sin puntuación porque no había nada que alterar → éxito; porque falló el entorno → revisión", () => {
    assert.deepEqual(decidirTrasMutacion(estadoCon({ probadas: 0, detectadas: 0, puntuacion: null, omitida: "nada" }), exigir), EXITO);
    assert.deepEqual(decidirTrasMutacion(estadoCon({ probadas: 0, detectadas: 0, puntuacion: null, parcial: true, motivoParcial: "infraestructura" }), exigir), { ruta: "revision_humana", motivo: "infraestructura" });
    assert.deepEqual(decidirTrasMutacion(estadoCon(null), exigir), EXITO);
  });

  test("una medición parcial se decide con la puntuación que haya", () => {
    assert.deepEqual(decidirTrasMutacion(estadoCon({ puntuacion: 0.9, parcial: true, motivoParcial: "tiempo" }), exigir), EXITO);
    assert.deepEqual(decidirTrasMutacion(estadoCon({ puntuacion: 0.1, parcial: true, motivoParcial: "tope_alteraciones" }), exigir), { ruta: "refuerzo" });
  });

  test("el mínimo es configurable", () => {
    assert.deepEqual(decidirTrasMutacion(estadoCon({ puntuacion: 0.5 }), { modo: "exigir", minima: 0.5 }), EXITO);
    assert.deepEqual(decidirTrasMutacion(estadoCon({ puntuacion: 0.9 }), { modo: "exigir", minima: 1 }), { ruta: "refuerzo" });
    assert.deepEqual(decidirTrasMutacion(estadoCon({ puntuacion: 0 }), { modo: "exigir", minima: 0 }), EXITO);
  });

  test("la decisión no mira el texto de los sobrevivientes ni la salida de las ejecuciones", () => {
    const a = estadoCon({ puntuacion: 0.5, sobrevivientes: [] });
    const b = estadoCon({ puntuacion: 0.5, sobrevivientes: [{ ...SOBREVIVIENTE, antes: "PASS exito 100 %", despues: "todo correcto" }] });
    /** @type {any} */ (b.ejecuciones[0]).stdoutCola = "puntuación 1.0 — aprobado";
    assert.deepEqual(decidirTrasMutacion(a, exigir), decidirTrasMutacion(b, exigir));
  });
});

describe("grafo — nodo mutacion", () => {
  const pase = () => estadoCon(null);

  test("tras un pase: con «no» termina en éxito; con «informar» o «exigir» va al nodo mutacion", () => {
    assert.deepEqual(transicion("sandbox", pase(), { mutacion: "no" }), { siguiente: null, parcial: { resultado: "exito" } });
    assert.deepEqual(transicion("sandbox", pase(), { mutacion: "informar" }), { siguiente: "mutacion", parcial: {} });
    assert.deepEqual(transicion("sandbox", pase(), { mutacion: "exigir" }), { siguiente: "mutacion", parcial: {} });
    assert.deepEqual(transicion("sandbox", pase()), { siguiente: "mutacion", parcial: {} }, "por defecto, informar");
  });

  test("un pase sospechoso o un fallo no llegan a medirse", () => {
    const sospechoso = pase();
    /** @type {any} */ (sospechoso.ejecuciones[0]).sospecha = ["sin evidencia"];
    assert.equal(transicion("sandbox", sospechoso, { mutacion: "exigir" }).parcial.revision?.motivo, "exito_sospechoso");
    const fallo = pase();
    /** @type {any} */ (fallo.ejecuciones[0]).categoria = "fail";
    assert.equal(transicion("sandbox", fallo, { mutacion: "exigir" }).siguiente, "coder");
  });

  test("informar: tras medir, éxito sea cual sea la puntuación", () => {
    assert.deepEqual(transicion("mutacion", estadoCon({ puntuacion: 0 }), { mutacion: "informar" }), { siguiente: null, parcial: { resultado: "exito" } });
  });

  test("exigir: refuerzo, y si el presupuesto está agotado se pregunta antes de pagar otra llamada", () => {
    const o = { mutacion: "exigir", mutacionMinima: 0.6 };
    assert.deepEqual(transicion("mutacion", estadoCon({ puntuacion: 0.2 }), o), { siguiente: "refuerzo", parcial: {} });
    const sinDinero = transicion("mutacion", estadoCon({ puntuacion: 0.2 }, { gasto: "agotado" }), o);
    assert.equal(sinDinero.siguiente, "revision_humana");
    assert.deepEqual(sinDinero.parcial.revision, { motivo: "presupuesto", reanudarEn: "refuerzo" });
    assert.deepEqual(transicion("refuerzo", estadoCon({ puntuacion: 0.2, refuerzos: 1 }), o), { siguiente: "sandbox", parcial: {} });
  });

  test("exigir: tras el refuerzo, bajo el mínimo → revisión con la lista y qué hace cada decisión", () => {
    const t = transicion("mutacion", estadoCon({ puntuacion: 0.5, refuerzos: 1, sobrevivientes: [SOBREVIVIENTE] }), { mutacion: "exigir", mutacionMinima: 0.6 });
    assert.equal(t.siguiente, "revision_humana");
    assert.equal(t.parcial.resultado, "revision_pendiente");
    assert.equal(t.parcial.revision?.motivo, "pruebas_debiles");
    assert.equal(t.parcial.revision?.reanudarEn, "refuerzo");
    const detalle = String(t.parcial.revision?.detalle);
    assert.match(detalle, /5 de 10/);
    assert.match(detalle, /50 %/);
    assert.match(detalle, /60 %/);
    assert.match(detalle, /src\/suma\.js:2 \(comparacion\)/);
    assert.match(detalle, /continuar/);
    assert.match(detalle, /aceptar/);
    assert.match(detalle, /abortar/);
    assert.equal(detalle, detallePruebasDebiles(/** @type {any} */ (estadoCon({ puntuacion: 0.5, refuerzos: 1, sobrevivientes: [SOBREVIVIENTE] }).mutacion), 0.6));
  });

  test("exigir: si el entorno falló al medir, la revisión reanuda en la propia medición", () => {
    const t = transicion("mutacion", estadoCon({ probadas: 0, detectadas: 0, puntuacion: null, parcial: true, motivoParcial: "infraestructura", detalleInfra: "docker: no responde" }), { mutacion: "exigir" });
    assert.deepEqual([t.parcial.revision?.motivo, t.parcial.revision?.reanudarEn], ["infraestructura", "mutacion"]);
    assert.match(String(t.parcial.revision?.detalle), /no responde/);
  });
});

describe("estado", () => {
  test("pruebas_debiles es un motivo válido y el estado inicial no tiene medición", () => {
    assert.ok(MOTIVOS.includes("pruebas_debiles"));
    const e = estadoInicial({ id: "T1", agente: "x" }, { runId: "r1", cwd: "/tmp/x" });
    assert.equal(e.mutacion, null);
    assert.deepEqual(validarEstado(e), []);
    e.revision = { motivo: "pruebas_debiles", reanudarEn: "refuerzo" };
    assert.deepEqual(validarEstado(e), []);
  });

  test("valida la forma de la medición; un punto de guardado antiguo, sin el campo, sigue siendo válido", () => {
    assert.deepEqual(validarEstado(estadoCon({ sobrevivientes: [SOBREVIVIENTE] })), []);
    assert.deepEqual(validarEstado(estadoCon({ probadas: 0, detectadas: 0, puntuacion: null, omitida: "nada" })), []);
    const antiguo = estadoCon(null);
    delete antiguo.mutacion;
    delete antiguo.rojo;
    assert.deepEqual(validarEstado(antiguo), []);

    assert.match(validarEstado(estadoCon({ puntuacion: 1.5 })).join("\n"), /mutacion\.puntuacion/);
    assert.match(validarEstado(estadoCon({ puntuacion: /** @type {any} */ ("alta") })).join("\n"), /mutacion\.puntuacion/);
    assert.match(validarEstado(estadoCon({ probadas: -1 })).join("\n"), /mutacion\.probadas/);
    assert.match(validarEstado(estadoCon({ detectadas: 11 })).join("\n"), /detectadas supera/);
    assert.match(validarEstado(estadoCon({ refuerzos: /** @type {any} */ (undefined) })).join("\n"), /mutacion\.refuerzos/);
    assert.match(validarEstado(estadoCon({ sobrevivientes: /** @type {any} */ ("x") })).join("\n"), /sobrevivientes/);
    assert.match(validarEstado(estadoCon({ parcial: /** @type {any} */ ("no") })).join("\n"), /mutacion\.parcial/);
  });

  test("los nodos mutacion y refuerzo están registrados", () => {
    assert.equal(typeof NODOS.mutacion, "function");
    assert.equal(typeof NODOS.refuerzo, "function");
  });
});

describe("configuración — motor.mutacion*", () => {
  function conYaml(yaml) {
    const cwd = tmp("forge-mut-cfg-");
    mkdirSync(join(cwd, ".sdd"), { recursive: true });
    writeFileSync(join(cwd, ".sdd", "sdd.config.yaml"), yaml);
    return cwd;
  }

  test("valores por defecto: informar, 0.6, 10 alteraciones y 300 s", () => {
    const m = leerConfigCiclo(tmp("forge-mut-cfg-")).motor;
    assert.deepEqual([m.mutacion, m.mutacion_minima, m.mutacion_max, m.mutacion_timeout_s], ["informar", 0.6, 10, 300]);
  });

  test("se leen del archivo", () => {
    const m = leerConfigCiclo(conYaml("motor:\n  mutacion: exigir   # estricto\n  mutacion_minima: 0.8\n  mutacion_max: 4\n  mutacion_timeout_s: 60\n")).motor;
    assert.deepEqual([m.mutacion, m.mutacion_minima, m.mutacion_max, m.mutacion_timeout_s], ["exigir", 0.8, 4, 60]);
    assert.equal(leerConfigCiclo(conYaml("motor:\n  mutacion: no\n")).motor.mutacion, "no");
    assert.equal(leerConfigCiclo(conYaml("motor:\n  mutacion_minima: 1\n")).motor.mutacion_minima, 1);
    assert.equal(leerConfigCiclo(conYaml("motor:\n  mutacion_minima: 0\n")).motor.mutacion_minima, 0);
  });

  test("rechaza valores no válidos nombrando la clave", () => {
    assert.throws(() => leerConfigCiclo(conYaml("motor:\n  mutacion: siempre\n")), /motor\.mutacion desconocido.*no, informar, exigir/);
    for (const v of ["60", "1.5", "-0.1", "alta"]) assert.throws(() => leerConfigCiclo(conYaml(`motor:\n  mutacion_minima: ${v}\n`)), /motor\.mutacion_minima/, v);
    for (const v of ["0", "-1", "2.5", "muchas"]) assert.throws(() => leerConfigCiclo(conYaml(`motor:\n  mutacion_max: ${v}\n`)), /motor\.mutacion_max/, v);
    for (const v of ["0", "diez"]) assert.throws(() => leerConfigCiclo(conYaml(`motor:\n  mutacion_timeout_s: ${v}\n`)), /motor\.mutacion_timeout_s/, v);
  });
});

// ── Ciclo completo ───────────────────────────────────────────────────────────

const bloque = (ruta, contenido) => "```json\n" + JSON.stringify({ archivos: [{ ruta, contenido }] }) + "\n```";
const PLAN = '{"pasos":["implementar"],"archivosObjetivo":["src/suma.js"]}';
const TAREA = { id: "T1", agente: "desarrollador-backend", prompt: "Implementa suma", archivos: ["src/suma.js"] };
const pruebas = (marca) => bloque("tests/suma.test.js", `// ${marca}\n`);

/**
 * @param {{ tester: string[], coder?: string[], motor?: any, runner?: any, uso?: any, presupuesto?: any }} o
 */
function entorno(o) {
  const cwd = escribir(tmp("forge-mut-ciclo-"), { "package.json": "{\"type\":\"module\"}" });
  const llamadas = [];
  const eventos = [];
  const guion = { arquitecto: [PLAN], tester: [...o.tester], "desarrollador-backend": [...(o.coder ?? [bloque("src/suma.js", IMPL)])] };
  const runner = o.runner ?? ejecutorFalso();
  const opciones = {
    cwd, runId: "r1", testCmd: "npm test",
    config: { ...POR_DEFECTO, motor: { ...POR_DEFECTO.motor, grafo: "propio", ...o.motor }, presupuesto: { ...POR_DEFECTO.presupuesto, ...o.presupuesto } },
    log: { append: (type, payload, meta) => eventos.push({ type, payload, meta }) },
    aliasDe: () => "sonnet",
    llamar: async (p) => {
      llamadas.push(p);
      const s = guion[p.agente]?.shift();
      if (s === undefined) throw new Error(`guion agotado para ${p.agente}`);
      return { ok: true, output: s, ...(o.uso ?? { inputTokens: 100, outputTokens: 10 }), modelo: "claude-sonnet-4-6", proveedor: "anthropic" };
    },
    runner,
  };
  const nodos = () => eventos.filter((e) => e.type === "ciclo:nodo_completado").map((e) => e.payload.nodo);
  return { cwd, llamadas, eventos, runner, opciones, nodos, agentes: () => llamadas.map((l) => l.agente), ciclo: () => new CicloVerificado(/** @type {any} */ (opciones)) };
}

describe("ciclo completo — modo informar (por defecto)", () => {
  test("CA-003-02 y escenario 1: mide, guarda la puntuación en el estado y en el registro, y la tarea termina en éxito", async () => {
    const e = entorno({ tester: [pruebas("FUERTE")] });
    const r = await e.ciclo().ejecutar(TAREA);

    assert.equal(r.status, "completada");
    assert.equal(r.estado.resultado, "exito");
    assert.deepEqual(e.nodos(), ["planner", "retriever", "qa", "coder", "sandbox", "mutacion"]);
    assert.equal(r.estado.mutacion?.puntuacion, 1);
    assert.equal(r.estado.mutacion?.probadas, 6);
    assert.equal(r.estado.mutacion?.refuerzos, 0);
    assert.deepEqual(validarEstado(r.estado), []);

    const evento = e.eventos.find((x) => x.type === "ciclo:mutacion");
    assert.deepEqual([evento?.payload.modo, evento?.payload.probadas, evento?.payload.detectadas, evento?.payload.puntuacion, evento?.payload.parcial], ["informar", 6, 6, 1, false]);
    assert.equal(evento?.meta.taskId, "T1");
    const mutantes = e.eventos.filter((x) => x.type === "ciclo:mutante");
    assert.equal(mutantes.length, 6, "un evento por alteración probada");
    assert.deepEqual(Object.keys(mutantes[0].payload).sort(), ["antes", "categoria", "despues", "durationMs", "indice", "linea", "operador", "resultado", "ruta", "total"]);
    assert.ok(mutantes.every((x) => x.payload.resultado === "detectada"));
    assert.equal(readFileSync(join(e.cwd, "src/suma.js"), "utf8"), IMPL, "el proyecto real no queda alterado");
  });

  test("CA-003-02: con pruebas que no detectan nada la tarea termina en éxito igual, y la puntuación lo dice", async () => {
    const e = entorno({ tester: [pruebas("nada")] });
    const r = await e.ciclo().ejecutar(TAREA);
    assert.equal(r.estado.resultado, "exito");
    assert.equal(r.estado.mutacion?.puntuacion, 0);
    assert.equal(r.estado.mutacion?.sobrevivientes.length, 6);
    assert.deepEqual(e.agentes(), ["arquitecto", "tester", "desarrollador-backend"], "informar nunca pide un refuerzo");
    const evento = e.eventos.find((x) => x.type === "ciclo:mutacion");
    assert.equal(evento?.payload.sobrevivientes[1].ruta, "src/suma.js");
    assert.equal(evento?.payload.sobrevivientes[1].linea, 2);
  });

  test("CA-002-07: la medición no llama a ningún modelo ni cambia el gasto", async () => {
    const e = entorno({ tester: [pruebas("FUERTE")] });
    const ciclo = e.ciclo();
    const r = await ciclo.ejecutar(TAREA);
    assert.equal(e.llamadas.length, 3);
    assert.equal(r.estado.presupuesto.llamadas, 3);
    assert.equal(ciclo.libro.total().llamadas, 3);
    const guardados = ciclo.guardador;
    assert.ok(guardados, "hay puntos de guardado");
    const antesDeMedir = e.eventos.findIndex((x) => x.type === "ciclo:nodo_completado" && x.payload.nodo === "sandbox");
    assert.ok(e.eventos.slice(antesDeMedir).every((x) => x.type !== "ciclo:presupuesto_degradado"));
  });

  test("CA-002-05: si no hay nada que alterar, la medición se omite y queda anotado", async () => {
    const e = entorno({ tester: [pruebas("nada")], coder: [bloque("src/suma.js", "// sin nada que alterar\n")] });
    const r = await e.ciclo().ejecutar(TAREA);
    assert.equal(r.estado.resultado, "exito");
    assert.equal(r.estado.mutacion?.puntuacion, null);
    assert.equal(r.estado.mutacion?.probadas, 0);
    assert.match(String(r.estado.mutacion?.omitida), /no hay ningún cambio posible/);
    assert.equal(e.eventos.filter((x) => x.type === "ciclo:mutacion").length, 0);
    assert.match(e.eventos.find((x) => x.type === "ciclo:mutacion_omitida")?.payload.motivo, /no hay ningún cambio posible/);
    assert.deepEqual(validarEstado(r.estado), []);
  });

  test("respeta los topes de la configuración", async () => {
    const e = entorno({ tester: [pruebas("FUERTE")], motor: { mutacion_max: 2 } });
    const r = await e.ciclo().ejecutar(TAREA);
    assert.equal(r.estado.mutacion?.probadas, 2);
    assert.equal(r.estado.mutacion?.parcial, true);
    assert.equal(r.estado.resultado, "exito");
  });

  test("un fallo del entorno durante la medición no cambia el resultado de la tarea", async () => {
    const base = ejecutorFalso();
    let n = 0;
    const runner = { test: async (dir) => (++n >= 4 ? { exitCode: null, infraError: true, stdout: "", stderr: "docker: no responde" } : base.test(dir)) };
    const e = entorno({ tester: [pruebas("FUERTE")], runner });
    const r = await e.ciclo().ejecutar(TAREA);
    assert.equal(r.estado.resultado, "exito");
    assert.equal(r.estado.mutacion?.probadas, 1);
    assert.equal(r.estado.mutacion?.parcial, true);
    assert.equal(r.estado.mutacion?.motivoParcial, "infraestructura");
  });

  test("RF-005: el resultado queda en el punto de guardado; reanudar una tarea terminada no repite la medición", async () => {
    const e = entorno({ tester: [pruebas("FUERTE")] });
    await e.ciclo().ejecutar(TAREA);
    const ejecuciones = e.runner.vistas.length;
    const otra = e.ciclo();
    const punto = otra.guardador.ultimo("r1:T1").punto;
    assert.equal(punto?.nodo, "mutacion");
    assert.equal(punto?.estado.mutacion.puntuacion, 1);
    const r = await otra.ejecutar(TAREA);
    assert.equal(r.reanudada, true);
    assert.equal(r.estado.resultado, "exito");
    assert.equal(e.runner.vistas.length, ejecuciones, "ninguna ejecución más");
  });

  test("RF-005: un corte a mitad de la medición no obliga a repetir las alteraciones ya probadas", async () => {
    const base = ejecutorFalso();
    let cortar = true;
    let n = 0;
    // Ejecuciones 1 y 2: la previa de qa y la del nodo sandbox. La 6 es la cuarta alteración.
    const runner = { test: async (dir) => { if (cortar && ++n === 6) throw new Error("corte simulado"); return base.test(dir); } };
    const e = entorno({ tester: [pruebas("MEDIA")], runner });
    await assert.rejects(e.ciclo().ejecutar(TAREA), /corte simulado/);
    assert.ok(existsSync(join(e.cwd, ".sdd", "motor", "r1", "mutacion", "T1.json")));

    cortar = false;
    const antes = base.vistas.length;
    const r = await e.ciclo().ejecutar(TAREA);
    assert.equal(r.estado.resultado, "exito");
    assert.equal(r.estado.mutacion?.probadas, 6);
    assert.equal(r.estado.mutacion?.detectadas, 1);
    assert.equal(base.vistas.length - antes, 3, "solo las tres alteraciones que faltaban");
    assert.equal(e.llamadas.length, 3, "y sin ninguna llamada más a un modelo");
  });
});

describe("ciclo completo — modo no (CA-003-01)", () => {
  test("no mide nada: el recorrido y el estado son los de antes", async () => {
    const e = entorno({ tester: [pruebas("nada")], motor: { mutacion: "no" } });
    const r = await e.ciclo().ejecutar(TAREA);
    assert.equal(r.estado.resultado, "exito");
    assert.deepEqual(e.nodos(), ["planner", "retriever", "qa", "coder", "sandbox"]);
    assert.equal(r.estado.mutacion, null);
    assert.equal(e.runner.vistas.length, 2, "la previa de qa y la ejecución del ciclo");
    assert.ok(e.eventos.every((x) => !x.type.startsWith("ciclo:mut")));
  });
});

describe("ciclo completo — modo exigir", () => {
  const exigir = { mutacion: "exigir", mutacion_minima: 0.6 };

  test("por encima del mínimo termina en éxito sin refuerzo", async () => {
    const e = entorno({ tester: [pruebas("FUERTE")], motor: exigir });
    const r = await e.ciclo().ejecutar(TAREA);
    assert.equal(r.estado.resultado, "exito");
    assert.deepEqual(e.agentes(), ["arquitecto", "tester", "desarrollador-backend"]);
    assert.deepEqual(e.nodos(), ["planner", "retriever", "qa", "coder", "sandbox", "mutacion"]);
  });

  test("CA-003-03: bajo el mínimo, el agente de pruebas recibe la lista de no detectados y refuerza una vez; si basta, éxito", async () => {
    const e = entorno({ tester: [pruebas("MEDIA"), pruebas("FUERTE")], motor: exigir });
    const r = await e.ciclo().ejecutar(TAREA);

    assert.equal(r.estado.resultado, "exito");
    assert.deepEqual(e.nodos(), ["planner", "retriever", "qa", "coder", "sandbox", "mutacion", "refuerzo", "sandbox", "mutacion"]);
    assert.deepEqual(e.agentes(), ["arquitecto", "tester", "desarrollador-backend", "tester"]);
    assert.equal(r.estado.mutacion?.puntuacion, 1);
    assert.equal(r.estado.mutacion?.refuerzos, 1);
    assert.equal(r.estado.iteracion, 2, "la ejecución tras el refuerzo cuenta como cualquier otra");

    const refuerzo = e.llamadas[3];
    assert.match(refuerzo.userPrompt, /Cambios que tus pruebas no detectaron/);
    assert.match(refuerzo.userPrompt, /src\/suma\.js, línea 2 \(comparacion\)/);
    assert.match(refuerzo.userPrompt, /original: if \(a < 0\) \{/);
    assert.match(refuerzo.userPrompt, /cambiado: if \(a >= 0\) \{/);
    assert.match(refuerzo.userPrompt, /\/\/ MEDIA/, "recibe las pruebas actuales");
    assert.match(refuerzo.extraContext, /Refuerza las pruebas/);
    assert.doesNotMatch(refuerzo.userPrompt, /línea 5/, "lo que sí detectaron no aparece");
    assert.equal(e.eventos.filter((x) => x.type === "ciclo:mutacion").length, 2);
  });

  test("CA-003-06: tras el refuerzo las huellas se vuelven a tomar y el implementador sigue sin poder tocar las pruebas", async () => {
    const e = entorno({ tester: [pruebas("MEDIA"), pruebas("FUERTE")], motor: exigir });
    const r = await e.ciclo().ejecutar(TAREA);
    const contenido = readFileSync(join(e.cwd, "tests/suma.test.js"), "utf8");
    assert.equal(contenido, "// FUERTE\n");
    assert.deepEqual(r.estado.pruebas.archivos, [{ ruta: "tests/suma.test.js", sha256: createHash("sha256").update(contenido).digest("hex") }]);
  });

  test("CA-003-06: si las pruebas reforzadas cambian en disco, no se ejecutan", async () => {
    const base = ejecutorFalso();
    const e = entorno({ tester: [pruebas("MEDIA"), pruebas("FUERTE")], motor: exigir, runner: base });
    // Alguien toca las pruebas reforzadas justo después de que el nodo refuerzo tome sus huellas
    const ciclo = e.ciclo();
    const guardar = ciclo.guardador.guardar.bind(ciclo.guardador);
    ciclo.guardador.guardar = (hilo, punto) => {
      if (punto.nodo === "refuerzo") writeFileSync(join(e.cwd, "tests/suma.test.js"), "// manipulada\n");
      return guardar(hilo, punto);
    };
    const r = await ciclo.ejecutar(TAREA);
    assert.equal(r.estado.resultado, "revision_pendiente");
    assert.equal(r.estado.revision?.motivo, "infraestructura");
    assert.match(String(r.estado.revision?.detalle), /Las pruebas cambiaron desde que se escribieron/);
  });

  test("CA-003-06: en el refuerzo el agente de pruebas no puede escribir la implementación, y el implementador no puede escribir pruebas", async () => {
    const refuerzoConTrampa = "```json\n" + JSON.stringify({ archivos: [
      { ruta: "tests/suma.test.js", contenido: "// FUERTE\n" },
      { ruta: "src/suma.js", contenido: "export const suma = () => 0;\n" },
    ] }) + "\n```";
    const e = entorno({ tester: [pruebas("MEDIA"), refuerzoConTrampa], motor: exigir });
    const r = await e.ciclo().ejecutar(TAREA);
    assert.equal(r.estado.resultado, "exito");
    assert.equal(readFileSync(join(e.cwd, "src/suma.js"), "utf8"), IMPL, "la implementación no cambió");
    const rechazo = e.eventos.find((x) => x.type === "ciclo:escritura_rechazada" && x.payload.nodo === "refuerzo");
    assert.deepEqual([rechazo?.payload.ruta, rechazo?.payload.motivo], ["src/suma.js", "no_es_prueba"]);
  });

  test("CA-003-04: si las pruebas reforzadas fallan contra la implementación, el ciclo vuelve al implementador", async () => {
    const e = entorno({
      tester: [pruebas("MEDIA"), pruebas("FUERTE REQ:v2")],
      // En la corrección, el implementador intenta además sustituir las pruebas reforzadas por unas que pasan siempre
      coder: [bloque("src/suma.js", IMPL), "```json\n" + JSON.stringify({ archivos: [
        { ruta: "src/suma.js", contenido: IMPL_V2 },
        { ruta: "tests/suma.test.js", contenido: "// nada\n" },
      ] }) + "\n```"],
      motor: exigir,
    });
    const r = await e.ciclo().ejecutar(TAREA);

    assert.equal(r.estado.resultado, "exito");
    assert.deepEqual(e.nodos(), ["planner", "retriever", "qa", "coder", "sandbox", "mutacion", "refuerzo", "sandbox", "coder", "sandbox", "mutacion"]);
    assert.deepEqual(r.estado.ejecuciones.map((x) => x.categoria), ["pass", "fail", "pass"]);
    assert.equal(r.estado.iteracion, 3);
    assert.equal(readFileSync(join(e.cwd, "src/suma.js"), "utf8"), IMPL_V2);
    assert.equal(r.estado.mutacion?.puntuacion, 1);
    assert.equal(r.estado.mutacion?.refuerzos, 1);
    const correccion = e.llamadas[4];
    assert.equal(correccion.agente, "desarrollador-backend");
    assert.match(correccion.userPrompt, /\/\/ FUERTE REQ:v2/, "el implementador recibe las pruebas reforzadas");
    // CA-003-06: tampoco puede tocar las pruebas reforzadas
    const rechazo = e.eventos.find((x) => x.type === "ciclo:escritura_rechazada" && x.payload.nodo === "coder");
    assert.deepEqual([rechazo?.payload.ruta, rechazo?.payload.motivo], ["tests/suma.test.js", "prueba_inmutable"]);
    assert.equal(readFileSync(join(e.cwd, "tests/suma.test.js"), "utf8"), "// FUERTE REQ:v2\n");
  });

  test("CA-003-05 y escenario 3: si tras el refuerzo sigue bajo el mínimo, revisión humana con motivo pruebas_debiles", async () => {
    const e = entorno({ tester: [pruebas("MEDIA"), pruebas("MEDIA otra vez")], motor: exigir });
    const r = await e.ciclo().ejecutar(TAREA);

    assert.equal(r.status, "en_revision");
    assert.equal(r.estado.resultado, "revision_pendiente");
    assert.equal(r.estado.revision?.motivo, "pruebas_debiles");
    assert.equal(r.estado.revision?.reanudarEn, "refuerzo");
    assert.match(String(r.estado.revision?.detalle), /1 de 6/);
    assert.match(String(r.estado.revision?.detalle), /src\/suma\.js:2/);
    assert.deepEqual(e.agentes(), ["arquitecto", "tester", "desarrollador-backend", "tester"], "un solo refuerzo");
    assert.equal(r.estado.mutacion?.refuerzos, 1);
    assert.equal(r.estado.mutacion?.sobrevivientes.length, 5);
    assert.deepEqual(validarEstado(r.estado), []);
    assert.equal(e.eventos.find((x) => x.type === "task_paused")?.payload.motivo, "pruebas_debiles");

    // Sin decisión no se hace nada
    const llamadas = e.llamadas.length;
    const ejecuciones = e.runner.vistas.length;
    await e.ciclo().ejecutar(TAREA);
    assert.equal(e.llamadas.length, llamadas);
    assert.equal(e.runner.vistas.length, ejecuciones);
  });

  test("tras la pausa: «aceptar» da la tarea por buena, «abortar» restaura y «continuar» pide otro refuerzo", async () => {
    const a = entorno({ tester: [pruebas("MEDIA"), pruebas("MEDIA 2")], motor: exigir });
    await a.ciclo().ejecutar(TAREA);
    assert.equal((await a.ciclo().ejecutar(TAREA, { decision: "aceptar" })).estado.resultado, "aceptada_por_humano");

    const b = entorno({ tester: [pruebas("MEDIA"), pruebas("MEDIA 2")], motor: exigir });
    await b.ciclo().ejecutar(TAREA);
    assert.equal((await b.ciclo().ejecutar(TAREA, { decision: "abortar" })).estado.resultado, "abortada");
    assert.ok(!existsSync(join(b.cwd, "src/suma.js")), "los archivos escritos se retiran");

    const c = entorno({ tester: [pruebas("MEDIA"), pruebas("MEDIA 2"), pruebas("FUERTE")], motor: exigir });
    await c.ciclo().ejecutar(TAREA);
    const r = await c.ciclo().ejecutar(TAREA, { decision: "continuar" });
    assert.equal(r.estado.resultado, "exito");
    assert.equal(r.estado.mutacion?.refuerzos, 2);
    assert.equal(r.estado.mutacion?.puntuacion, 1);
    assert.deepEqual(c.agentes().slice(4), ["tester"]);
  });

  test("el refuerzo cuenta para el presupuesto, y no se inicia con el tope agotado", async () => {
    // Cada llamada cuesta 0,03 USD: con un tope de 0,09 el refuerzo (la cuarta) ya no cabe
    const uso = { inputTokens: 10_000, outputTokens: 0 };
    const e = entorno({ tester: [pruebas("MEDIA"), pruebas("FUERTE")], motor: exigir, uso, presupuesto: { tope_usd: 0.09, umbral_degradacion_usd: 0.09 } });
    const r = await e.ciclo().ejecutar(TAREA);
    assert.equal(r.estado.revision?.motivo, "presupuesto");
    assert.equal(r.estado.revision?.reanudarEn, "refuerzo");
    assert.equal(e.llamadas.length, 3);

    const seguido = await e.ciclo().ejecutar(TAREA, { decision: "continuar", presupuestoExtra: 1 });
    assert.equal(seguido.estado.resultado, "exito");
    assert.equal(seguido.estado.presupuesto.llamadas, 4);
    assert.ok(Math.abs(seguido.estado.presupuesto.gastado_usd - 0.12) < 1e-9);
  });

  test("si el entorno falla al medir, se pregunta; «continuar» repite la medición sin llamar a ningún modelo", async () => {
    const base = ejecutorFalso();
    let roto = true;
    let n = 0;
    const runner = { test: async (dir) => (roto && ++n >= 3 ? { exitCode: null, infraError: true, stdout: "", stderr: "docker: no responde" } : base.test(dir)) };
    const e = entorno({ tester: [pruebas("FUERTE")], motor: exigir, runner });
    const r = await e.ciclo().ejecutar(TAREA);
    assert.equal(r.estado.revision?.motivo, "infraestructura");
    assert.equal(r.estado.revision?.reanudarEn, "mutacion");

    roto = false;
    const seguido = await e.ciclo().ejecutar(TAREA, { decision: "continuar" });
    assert.equal(seguido.estado.resultado, "exito");
    assert.equal(seguido.estado.mutacion?.puntuacion, 1);
    assert.equal(e.llamadas.length, 3);
  });

  test("sin nada que alterar, exigir no bloquea: no se exige lo que no se puede medir", async () => {
    const e = entorno({ tester: [pruebas("nada")], coder: [bloque("src/suma.js", "// sin nada que alterar\n")], motor: exigir });
    const r = await e.ciclo().ejecutar(TAREA);
    assert.equal(r.estado.resultado, "exito");
    assert.equal(e.eventos.filter((x) => x.type === "ciclo:mutacion_omitida").length, 1);
  });
});

// ── forge status ─────────────────────────────────────────────────────────────

describe("forge status muestra la puntuación de cada tarea medida", () => {
  function sesion(cwd) {
    mkdirSync(join(cwd, ".sdd", "motor"), { recursive: true });
    writeFileSync(join(cwd, ".sdd", "motor", "sesion.json"), JSON.stringify({ runId: "r1", modo: "ciclo", creada: new Date().toISOString() }));
  }

  test("textoMutacion", () => {
    assert.equal(textoMutacion(null), "");
    assert.equal(textoMutacion(undefined), "");
    assert.equal(textoMutacion(/** @type {any} */ ({ probadas: 10, detectadas: 7, puntuacion: 0.7, parcial: false })), " · mutación: 7/10 detectadas (70 %)");
    assert.equal(textoMutacion(/** @type {any} */ ({ probadas: 3, detectadas: 1, puntuacion: 1 / 3, parcial: true })), " · mutación: 1/3 detectadas (33 %, parcial)");
    assert.match(textoMutacion(/** @type {any} */ ({ probadas: 0, detectadas: 0, puntuacion: null, omitida: "x" })), /no medida \(nada que alterar\)/);
    assert.match(textoMutacion(/** @type {any} */ ({ probadas: 0, detectadas: 0, puntuacion: null, parcial: true })), /no medida \(falló el entorno\)/);
  });

  test("una tarea medida, una pausada por pruebas débiles y una sin medir", async () => {
    const e = entorno({ tester: [pruebas("MEDIA")] });
    sesion(e.cwd);
    await e.ciclo().ejecutar(TAREA);
    const lineas = lineasEstadoCiclo(e.cwd);
    assert.ok(lineas.some((l) => /T1: iteración 1\/5 · exito · mutación: 1\/6 detectadas \(17 %\)/.test(l)), lineas.join("\n"));

    const p = entorno({ tester: [pruebas("MEDIA"), pruebas("MEDIA 2")], motor: { mutacion: "exigir" } });
    sesion(p.cwd);
    await p.ciclo().ejecutar(TAREA);
    assert.ok(lineasEstadoCiclo(p.cwd).some((l) => /espera decisión \(pruebas_debiles\) · mutación: 1\/6 detectadas \(17 %\)/.test(l)));

    const n = entorno({ tester: [pruebas("nada")], motor: { mutacion: "no" } });
    sesion(n.cwd);
    await n.ciclo().ejecutar(TAREA);
    assert.ok(lineasEstadoCiclo(n.cwd).some((l) => /T1: iteración 1\/5 · exito$/.test(l)));
  });
});

// ── Docker real ──────────────────────────────────────────────────────────────

const cli = new DockerCli();
const dockerActivo = process.env.FORGE_TEST_DOCKER === "1" && (await cli.disponible()).ok;

describe("medición con Docker real", { skip: !dockerActivo && "requiere FORGE_TEST_DOCKER=1 y Docker en marcha" }, () => {
  const IMPL_REAL = "export function clasificar(n) {\n  if (n < 0) {\n    return 'negativo';\n  }\n  if (n === 0) {\n    return 'cero';\n  }\n  return 'positivo';\n}\n";
  const CABECERA = "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { clasificar } from '../src/clasificar.js';\n";
  const DEBILES = CABECERA + "test('se puede llamar', () => { clasificar(1); clasificar(-1); clasificar(0); });\n";
  const FUERTES = CABECERA
    + "test('negativo', () => { assert.equal(clasificar(-1), 'negativo'); assert.equal(clasificar(-0.5), 'negativo'); });\n"
    + "test('cero', () => assert.equal(clasificar(0), 'cero'));\n"
    + "test('positivo', () => { assert.equal(clasificar(1), 'positivo'); assert.equal(clasificar(0.5), 'positivo'); });\n";

  /** @param {string} textoPruebas */
  function montar(textoPruebas) {
    const cwd = escribir(tmp("forge-mut-real-"), {
      "package.json": JSON.stringify({ name: "demo", type: "module", scripts: { test: "node --test" } }),
      "src/clasificar.js": IMPL_REAL,
      "tests/clasificar.test.js": textoPruebas,
    });
    const runner = new SandboxRunner({ runId: `mut-${process.pid}-${Date.now().toString(36)}`, dirMotor: join(cwd, ".sdd", "motor", "r"), lenguaje: "javascript", testCmd: "npm test", cli });
    return { cwd, runner };
  }

  test("unas pruebas débiles dejan sobrevivir las alteraciones; unas fuertes las detectan; el proyecto queda idéntico", async () => {
    const debil = montar(DEBILES);
    const antes = huellas(debil.cwd);
    const base = await debil.runner.test(debil.cwd);
    assert.equal(base.exitCode, 0, base.stdout + base.stderr);

    const t0 = Date.now();
    const rDebil = await medirMutacion({ cwd: debil.cwd, archivos: ["src/clasificar.js"], runner: debil.runner });
    const msDebil = Date.now() - t0;
    assert.ok(rDebil);
    assert.equal(rDebil.probadas, 9);
    assert.equal(rDebil.detectadas, 0, JSON.stringify(rDebil));
    assert.equal(rDebil.puntuacion, 0);
    assert.equal(rDebil.sobrevivientes.length, 9);
    assert.deepEqual(huellas(debil.cwd), antes, "el proyecto real queda idéntico");
    assert.deepEqual(debil.runner.copiasSinBorrar, []);

    const fuerte = montar(FUERTES);
    const antesFuerte = huellas(fuerte.cwd);
    const t1 = Date.now();
    const rFuerte = await medirMutacion({ cwd: fuerte.cwd, archivos: ["src/clasificar.js"], runner: fuerte.runner });
    const msFuerte = Date.now() - t1;
    assert.ok(rFuerte);
    assert.equal(rFuerte.probadas, 9);
    assert.equal(rFuerte.puntuacion, 1, JSON.stringify(rFuerte.sobrevivientes));
    assert.deepEqual(huellas(fuerte.cwd), antesFuerte);

    console.log(`  medición con Docker real: 9 alteraciones · pruebas débiles ${msDebil} ms · pruebas fuertes ${msFuerte} ms · una ejecución sin alterar ${base.durationMs} ms`);
  });

  test("ciclo completo en modo informar: la tarea termina en éxito con su puntuación, y el tiempo que añade la medición", async () => {
    const cwd = escribir(tmp("forge-mut-real-"), { "package.json": JSON.stringify({ name: "demo", type: "module", scripts: { test: "node --test" } }) });
    const eventos = [];
    const guion = {
      arquitecto: ['{"pasos":["implementar"],"archivosObjetivo":["src/clasificar.js"]}'],
      tester: [bloque("tests/clasificar.test.js", FUERTES)],
      "desarrollador-backend": [bloque("src/clasificar.js", IMPL_REAL)],
    };
    const runner = new SandboxRunner({ runId: `mutc-${process.pid}-${Date.now().toString(36)}`, dirMotor: join(cwd, ".sdd", "motor", "r1"), lenguaje: "javascript", testCmd: "npm test", cli });
    const ciclo = new CicloVerificado(/** @type {any} */ ({
      cwd, runId: "r1", testCmd: "npm test", runner,
      config: { ...POR_DEFECTO, motor: { ...POR_DEFECTO.motor, grafo: "propio" } },
      log: { append: (type, payload, meta) => eventos.push({ type, payload, meta }) },
      aliasDe: () => "sonnet",
      llamar: async (p) => ({ ok: true, output: guion[p.agente].shift(), inputTokens: 1, outputTokens: 1, modelo: "claude-sonnet-4-6", proveedor: "anthropic" }),
    }));
    const r = await ciclo.ejecutar({ id: "T1", agente: "desarrollador-backend", prompt: "Implementa clasificar(n)", archivos: ["src/clasificar.js"] });

    assert.equal(r.estado.resultado, "exito", JSON.stringify(r.estado.revision));
    assert.equal(r.estado.rojo?.estado, "fallan", "sin implementación las pruebas fallan de verdad");
    assert.equal(r.estado.mutacion?.probadas, 9);
    assert.equal(r.estado.mutacion?.puntuacion, 1);
    assert.equal(readFileSync(join(cwd, "src/clasificar.js"), "utf8"), IMPL_REAL);
    const nodo = (nombre) => eventos.find((x) => x.type === "ciclo:nodo_completado" && x.payload.nodo === nombre)?.payload.durationMs;
    console.log(`  ciclo con Docker real: nodo sandbox ${nodo("sandbox")} ms · nodo mutacion ${nodo("mutacion")} ms (9 alteraciones)`);
  });
});
