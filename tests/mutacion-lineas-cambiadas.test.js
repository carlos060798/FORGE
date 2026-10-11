// @ts-check
/**
 * La medición por mutación se limita a lo que la tarea cambió (ADR-20, hallazgo de la ejecución con
 * modelo real del 2026-10-10).
 *
 * En una tarea que cambió UNA función de un archivo ya existente de 1812 líneas, la medición dio
 * 1072 candidatas y 1/10 detectadas: nueve de las diez alteraciones cayeron en funciones que la
 * tarea no tocó y que sus pruebas no tienen por qué cubrir. Cuando el archivo ya existía antes de
 * la tarea, las candidatas se limitan a las líneas que la tarea cambió o añadió (y, si `acorn`
 * entiende el archivo, a la función que las contiene).
 *
 * Sin modelos ni Docker: el ejecutor es falso y decide leyendo la copia que recibe.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { alcanceDeLaTarea, alteracionesDe, lineasCambiadas, medirMutacion } from "../core/ciclo/mutacion.js";
import { Respaldo } from "../core/ciclo/respaldo.js";
import { POR_DEFECTO } from "../core/ciclo/config.js";
import { CicloVerificado } from "../core/ciclo/index.js";
import { validarEstado } from "../core/ciclo/estado.js";

const tmp = (p) => mkdtempSync(join(tmpdir(), p));
const L = (...l) => l.join("\n") + "\n";

/** @param {string} cwd @param {Record<string, string>} archivos */
function escribir(cwd, archivos) {
  for (const [ruta, contenido] of Object.entries(archivos)) {
    mkdirSync(join(cwd, ruta, ".."), { recursive: true });
    writeFileSync(join(cwd, ruta), contenido);
  }
  return cwd;
}

// ── Un archivo grande que ya existía, como el del hallazgo ───────────────────

const N_FUNCIONES = 151;
/** Doce líneas por función: 151 funciones ≈ 1812 líneas. */
const funcion = (i, cuerpo) => [
  `export function regla${i}(valor) {`,
  `  const bruto = valor * ${i + 16} + 2;`,
  `  if (bruto > ${i + 100}) {`,
  `    return bruto - ${i + 1};`,
  `  }`,
  ...(cuerpo ?? [`  if (valor === ${i}) {`, `    return 0;`, `  }`]),
  `  const ajuste = bruto < 5;`,
  `  return ajuste ? 1 : bruto;`,
  `}`,
  ``,
];
const archivoGrande = (cambios = {}) => Array.from({ length: N_FUNCIONES }, (_, i) => funcion(i, cambios[i])).flat().join("\n") + "\n";
const ORIGINAL = archivoGrande();
const TOCADA = 70;
/** La tarea cambia el centro de una sola función (tres líneas por cuatro). */
const NUEVO = archivoGrande({ [TOCADA]: [`  if (valor === ${TOCADA} || valor < 0) {`, `    return -1;`, `  }`, `  const extra = valor > 1000;`] });
/** Líneas (desde 1) de la función `regla70` en la versión nueva. */
const rangoTocada = (() => {
  const lineas = NUEVO.split("\n");
  const inicio = lineas.indexOf(`export function regla${TOCADA}(valor) {`) + 1;
  const fin = lineas.indexOf("}", inicio) + 1;
  return { inicio, fin };
})();

const PASE  = { exitCode: 0, stdout: "# tests 1\n# pass 1\n", stderr: "", timedOut: false, infraError: false, durationMs: 3 };
const FALLO = { exitCode: 1, stdout: "TAP version 13\n# Subtest: regla\nnot ok 1 - regla\n  ---\n  failureType: 'testCodeFailure'\n  ...\n1..1\n# tests 1\n# pass 0\n# fail 1\n", stderr: "AssertionError\n", timedOut: false, infraError: false, durationMs: 3 };

/**
 * Pruebas de la tarea: solo cubren la función que la tarea cambió. Detectan cualquier alteración
 * dentro de ella y ninguna fuera, que es lo que harían unas pruebas buenas de esa tarea.
 * @param {string} ruta  archivo de implementación @param {string} esperado  contenido correcto
 */
function ejecutorDeLaTarea(ruta, esperado, { inicio, fin }) {
  const dentro = (texto) => texto.split("\n").slice(inicio - 1, fin).join("\n");
  /** @type {string[]} */
  const vistas = [];
  return {
    vistas,
    test: async (dir) => {
      const abs = join(dir, ruta);
      if (!existsSync(abs)) return { ...FALLO };
      const src = readFileSync(abs, "utf8");
      vistas.push(src);
      return dentro(src) === dentro(esperado) ? { ...PASE } : { ...FALLO };
    },
  };
}

// ── Comparación de líneas ────────────────────────────────────────────────────

describe("lineasCambiadas — comparación de líneas propia, determinista y sin dependencias", () => {
  test("dos textos iguales no tienen líneas cambiadas", () => {
    assert.deepEqual(lineasCambiadas("a\nb\nc\n", "a\nb\nc\n"), []);
    assert.deepEqual(lineasCambiadas("", ""), []);
  });

  test("una línea modificada, una añadida y una quitada", () => {
    assert.deepEqual(lineasCambiadas("a\nb\nc\n", "a\nB\nc\n"), [2]);
    assert.deepEqual(lineasCambiadas("a\nc\n", "a\nb\nc\n"), [2]);
    assert.deepEqual(lineasCambiadas("a\nb\nc\n", "a\nc\n"), [], "quitar una línea no cambia ninguna de las que quedan");
    assert.deepEqual(lineasCambiadas("a\nb\n", "x\na\nb\ny\n"), [1, 4]);
    assert.deepEqual(lineasCambiadas("", "a\nb\n"), [1, 2], "desde un archivo vacío, todo es nuevo");
  });

  test("las líneas repetidas (llaves, líneas en blanco) no confunden la comparación", () => {
    const antes = L("function a() {", "  return 1;", "}", "", "function b() {", "  return 2;", "}", "", "function c() {", "  return 3;", "}");
    const despues = L("function a() {", "  return 1;", "}", "", "function b() {", "  if (x) {", "    return 5;", "  }", "  return 2;", "}", "", "function c() {", "  return 3;", "}");
    assert.deepEqual(lineasCambiadas(antes, despues), [6, 7, 8]);
  });

  test("los finales de línea de Windows no cuentan como cambio", () => {
    assert.deepEqual(lineasCambiadas("a\r\nb\r\nc\r\n", "a\nB\nc\n"), [2]);
    assert.deepEqual(lineasCambiadas("a\nb\n", "a\r\nb\r\n"), []);
  });

  test("en el archivo del hallazgo solo salen las líneas de la función tocada", () => {
    const cambiadas = lineasCambiadas(ORIGINAL, NUEVO);
    assert.equal(cambiadas.length, 3, JSON.stringify(cambiadas));
    assert.ok(cambiadas.every((l) => l > rangoTocada.inicio && l < rangoTocada.fin), JSON.stringify(cambiadas));
    assert.deepEqual(lineasCambiadas(ORIGINAL, NUEVO), cambiadas, "la misma entrada da el mismo resultado");
  });

  test("coincide con una subsecuencia común máxima de referencia en 300 casos generados", () => {
    // Generador fijo (no usa Math.random): los mismos casos en cada ejecución
    let semilla = 12345;
    const azar = (n) => { semilla = (semilla * 1103515245 + 12345) % 2147483648; return semilla % n; };
    /** Longitud de la subsecuencia común máxima, por la tabla de toda la vida. */
    const lcs = (a, b) => {
      const t = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
      for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) t[i][j] = a[i - 1] === b[j - 1] ? t[i - 1][j - 1] + 1 : Math.max(t[i - 1][j], t[i][j - 1]);
      return t[a.length][b.length];
    };
    for (let caso = 0; caso < 300; caso++) {
      const a = Array.from({ length: azar(14) }, () => "l" + azar(4));
      const b = Array.from({ length: azar(14) }, () => "l" + azar(4));
      const cambiadas = lineasCambiadas(a.join("\n"), b.join("\n"));
      const nB = b.length === 0 ? 1 : b.length;   // "" es una línea vacía
      const nA = a.length === 0 ? [""] : a;
      const esperado = nB - lcs(nA, b.length === 0 ? [""] : b);
      assert.equal(cambiadas.length, esperado, `caso ${caso}: ${JSON.stringify(a)} → ${JSON.stringify(b)} dio ${JSON.stringify(cambiadas)}`);
      // Lo que no se marca como cambiado es, en orden, una subsecuencia de la versión original
      const iguales = (b.length === 0 ? [""] : b).filter((_, i) => !cambiadas.includes(i + 1));
      let k = 0;
      for (const linea of nA) if (k < iguales.length && linea === iguales[k]) k++;
      assert.equal(k, iguales.length, `caso ${caso}: lo no cambiado no es una subsecuencia del original`);
    }
  });

  test("un archivo enorme reescrito casi entero no cuelga: lo que no se puede comparar cuenta como cambiado", () => {
    const antes = Array.from({ length: 9000 }, (_, i) => `const a${i} = ${i};`).join("\n");
    const despues = "// igual\n" + Array.from({ length: 9000 }, (_, i) => `const b${i} = ${i};`).join("\n") + "\n// igual";
    const t0 = Date.now();
    const cambiadas = lineasCambiadas("// igual\n" + antes + "\n// igual", despues);
    assert.ok(Date.now() - t0 < 5000, "tarda menos de 5 s");
    assert.equal(cambiadas.length, 9000);
    assert.equal(cambiadas[0], 2);
    assert.equal(cambiadas.at(-1), 9001);
  });
});

// ── Alcance: líneas cambiadas más la función que las contiene ────────────────

describe("alcanceDeLaTarea — líneas cambiadas y, si acorn entiende el archivo, la función que las contiene", () => {
  test("JavaScript: un cambio dentro de una función alcanza a toda la función y a ninguna otra", () => {
    const alcance = alcanceDeLaTarea("src/reglas.js", ORIGINAL, NUEVO);
    const esperado = [];
    for (let l = rangoTocada.inicio; l <= rangoTocada.fin; l++) esperado.push(l);
    assert.deepEqual(alcance, esperado);
  });

  test("JavaScript: un cambio fuera de toda función alcanza solo a su línea", () => {
    const antes = L("export const LIMITE = 10;", "export const NOMBRE = 'a';", "", "export function f(a) {", "  return a > LIMITE;", "}");
    const despues = antes.replace("LIMITE = 10", "LIMITE = 20");
    assert.deepEqual(alcanceDeLaTarea("src/x.js", antes, despues), [1]);
  });

  test("JavaScript: una función flecha pequeña en la línea cambiada no encoge el alcance", () => {
    const antes = L("export function procesa(xs) {", "  const limpias = xs.filter((x) => x > 0);", "  const dobles = limpias.map((x) => x * 2);", "  return dobles.length > 3;", "}", "", "export function otra(a) {", "  return a < 1;", "}");
    const despues = antes.replace("x * 2", "x * 3");
    assert.deepEqual(alcanceDeLaTarea("src/x.js", antes, despues), [1, 2, 3, 4, 5]);
  });

  test("JavaScript: un método de una clase es su propio alcance", () => {
    const antes = L("export class Caja {", "  abrir(n) {", "    return n > 1;", "  }", "", "  cerrar(n) {", "    if (n === 0) {", "      return false;", "    }", "    return true;", "  }", "}");
    const despues = antes.replace("n === 0", "n === 2");
    assert.deepEqual(alcanceDeLaTarea("src/caja.js", antes, despues), [6, 7, 8, 9, 10, 11]);
  });

  test("JavaScript: quitar una línea de una función alcanza a esa función", () => {
    const antes = L("export function f(a) {", "  if (a < 0) {", "    return 0;", "  }", "  return a + 1;", "}", "", "export function g(a) {", "  return a > 2;", "}");
    const despues = L("export function f(a) {", "  return a + 1;", "}", "", "export function g(a) {", "  return a > 2;", "}");
    assert.deepEqual(lineasCambiadas(antes, despues), []);
    assert.deepEqual(alcanceDeLaTarea("src/x.js", antes, despues), [1, 2, 3]);
  });

  test("Python, Go y TypeScript con tipos: sin análisis sintáctico, solo las líneas cambiadas", () => {
    const pyAntes = L("def a(n):", "    if n > 1:", "        return 1", "    return 0", "", "", "def b(n):", "    return n == 2");
    assert.deepEqual(alcanceDeLaTarea("m.py", pyAntes, pyAntes.replace("n > 1", "n > 5")), [2]);
    const goAntes = L("package demo", "", "func A(n int) bool {", "\tif n > 1 {", "\t\treturn true", "\t}", "\treturn false", "}");
    assert.deepEqual(alcanceDeLaTarea("demo.go", goAntes, goAntes.replace("n > 1", "n > 5")), [4]);
    const tsAntes = L("export function a(n: number): boolean {", "  if (n > 1) {", "    return true;", "  }", "  return false;", "}");
    assert.deepEqual(alcanceDeLaTarea("a.ts", tsAntes, tsAntes.replace("n > 1", "n > 5")), [2]);
  });

  test("TypeScript sin sintaxis de tipos sí se analiza: alcanza a la función", () => {
    const antes = L("export function a(n) {", "  if (n > 1) {", "    return true;", "  }", "  return false;", "}", "", "export const b = 3;");
    assert.deepEqual(alcanceDeLaTarea("a.ts", antes, antes.replace("n > 1", "n > 5")), [1, 2, 3, 4, 5, 6]);
  });

  test("sin cambios no hay alcance", () => {
    assert.deepEqual(alcanceDeLaTarea("src/reglas.js", ORIGINAL, ORIGINAL), []);
  });
});

// ── medirMutacion con el contenido original ──────────────────────────────────

describe("medirMutacion — con el original de un archivo que ya existía", () => {
  const proyecto = () => escribir(tmp("forge-mlin-"), { "package.json": "{\"type\":\"module\"}", "src/reglas.js": NUEVO, "tests/reglas.test.js": "// de la tarea\n" });

  test("reproducción del hallazgo: sin el original, la muestra cae en código ajeno a la tarea y la puntuación se hunde", async () => {
    const cwd = proyecto();
    const eventos = [];
    const r = await medirMutacion({ cwd, archivos: ["src/reglas.js"], runner: ejecutorDeLaTarea("src/reglas.js", NUEVO, rangoTocada), alProbar: (e) => eventos.push(e) });
    assert.ok(r);
    assert.ok(r.candidatas > 1000, `candidatas: ${r.candidatas}`);
    assert.equal(r.probadas, 10);
    assert.ok(r.puntuacion !== null && r.puntuacion <= 0.1, `puntuación: ${r.puntuacion}`);
    assert.ok(eventos.filter((e) => e.alteracion.linea < rangoTocada.inicio || e.alteracion.linea > rangoTocada.fin).length >= 9, "casi toda la muestra cae fuera de la función que cambió la tarea");
  });

  test("con el original, TODAS las alteraciones probadas caen dentro de lo que cambió la tarea", async () => {
    const cwd = proyecto();
    const eventos = [];
    /** @type {any[]} */
    const acotados = [];
    const todas = alteracionesDe([{ ruta: "src/reglas.js", contenido: NUEVO }]).length;
    const r = await medirMutacion({
      cwd, archivos: ["src/reglas.js"], runner: ejecutorDeLaTarea("src/reglas.js", NUEVO, rangoTocada),
      originalDe: (ruta) => (ruta === "src/reglas.js" ? ORIGINAL : null),
      alProbar: (e) => eventos.push(e), alAcotar: (a) => acotados.push(a),
    });
    assert.ok(r);
    assert.ok(eventos.length > 0);
    for (const e of eventos) {
      assert.ok(e.alteracion.linea >= rangoTocada.inicio && e.alteracion.linea <= rangoTocada.fin,
        `la alteración de la línea ${e.alteracion.linea} cae fuera de ${rangoTocada.inicio}–${rangoTocada.fin}`);
    }
    assert.ok(r.candidatas < 30, `candidatas: ${r.candidatas}`);
    assert.equal(r.fueraDeLoCambiado, todas - r.candidatas, "dice cuántas candidatas quedaron fuera");
    assert.ok((r.fueraDeLoCambiado ?? 0) > 1000);
    assert.equal(r.puntuacion, 1, "las pruebas de la tarea detectan todo lo que se altera dentro de lo que cambió");
    assert.equal(r.probadas, Math.min(10, r.candidatas));
    assert.deepEqual(acotados, [{ candidatas: r.candidatas, fueraDeLoCambiado: r.fueraDeLoCambiado, archivos: [{ ruta: "src/reglas.js", lineas: rangoTocada.fin - rangoTocada.inicio + 1 }] }]);
  });

  test("la misma entrada da la misma medición", async () => {
    const medir = async () => {
      const eventos = [];
      await medirMutacion({ cwd: proyecto(), archivos: ["src/reglas.js"], runner: ejecutorDeLaTarea("src/reglas.js", NUEVO, rangoTocada), originalDe: () => ORIGINAL, alProbar: (e) => eventos.push([e.alteracion.linea, e.alteracion.operador, e.alteracion.despues, e.resultado]) });
      return eventos;
    };
    assert.deepEqual(await medir(), await medir());
  });

  test("un archivo nuevo (sin original) se altera entero, como siempre", async () => {
    const cwd = proyecto();
    const todas = alteracionesDe([{ ruta: "src/reglas.js", contenido: NUEVO }]).length;
    for (const originalDe of [() => null, () => undefined, () => { throw new Error("respaldo ilegible"); }]) {
      const r = await medirMutacion({ cwd, archivos: ["src/reglas.js"], runner: ejecutorDeLaTarea("src/reglas.js", NUEVO, rangoTocada), originalDe: /** @type {any} */ (originalDe), max: 3 });
      assert.ok(r);
      assert.equal(r.candidatas, todas);
      assert.equal(r.fueraDeLoCambiado, undefined);
    }
  });

  test("un archivo nuevo y otro que ya existía: cada uno con su alcance", async () => {
    const cwd = proyecto();
    const nuevo = L("export function nueva(a) {", "  if (a > 3) {", "    return 1;", "  }", "  return 0;", "}");
    escribir(cwd, { "src/nueva.js": nuevo });
    const eventos = [];
    const r = await medirMutacion({
      cwd, archivos: ["src/reglas.js", "src/nueva.js"], runner: { test: async () => ({ ...PASE }) }, max: 40,
      originalDe: (ruta) => (ruta === "src/reglas.js" ? ORIGINAL : null), alProbar: (e) => eventos.push(e),
    });
    assert.ok(r);
    const deNueva = eventos.filter((e) => e.alteracion.ruta === "src/nueva.js").length;
    assert.equal(deNueva, alteracionesDe([{ ruta: "src/nueva.js", contenido: nuevo }]).length, "el archivo nuevo se altera entero");
    assert.ok(eventos.filter((e) => e.alteracion.ruta === "src/reglas.js").every((e) => e.alteracion.linea >= rangoTocada.inicio && e.alteracion.linea <= rangoTocada.fin));
  });

  test("si lo que cambió la tarea no tiene nada que alterar, no se mide (null) y se dice cuántas quedaron fuera", async () => {
    const cwd = proyecto();
    // La tarea solo añadió un comentario
    const conComentario = NUEVO.replace("export function regla3(valor) {", "// regla tres\nexport function regla3(valor) {");
    escribir(cwd, { "src/reglas.js": conComentario });
    /** @type {any[]} */
    const acotados = [];
    let ejecuciones = 0;
    const r = await medirMutacion({ cwd, archivos: ["src/reglas.js"], runner: { test: async () => { ejecuciones++; return { ...PASE }; } }, originalDe: () => NUEVO, alAcotar: (a) => acotados.push(a) });
    assert.equal(r, null);
    assert.equal(ejecuciones, 0, "sin nada que alterar no se ejecuta nada");
    assert.equal(acotados.length, 1);
    assert.equal(acotados[0].candidatas, 0);
    assert.ok(acotados[0].fueraDeLoCambiado > 1000);
  });

  test("el mismo contenido que antes de la tarea no da ninguna candidata", async () => {
    const r = await medirMutacion({ cwd: proyecto(), archivos: ["src/reglas.js"], runner: { test: async () => ({ ...PASE }) }, originalDe: () => NUEVO });
    assert.equal(r, null);
  });

  test("Python: solo las líneas cambiadas", async () => {
    const antes = L("def a(n):", "    if n > 1:", "        return 1", "    return 0", "", "", "def b(n):", "    if n == 2:", "        return 7", "    return 3");
    const despues = antes.replace("n == 2", "n == 4");
    const cwd = escribir(tmp("forge-mlin-py-"), { "m.py": despues, "test_m.py": "# nada\n" });
    const eventos = [];
    const r = await medirMutacion({ cwd, archivos: ["m.py"], runner: { test: async () => ({ ...PASE }) }, originalDe: () => antes, alProbar: (e) => eventos.push(e) });
    assert.ok(r);
    assert.deepEqual([...new Set(eventos.map((e) => e.alteracion.linea))], [8]);
    assert.ok((r.fueraDeLoCambiado ?? 0) >= 5);
  });
});

// ── Respaldo: contenido previo a la tarea ────────────────────────────────────

describe("Respaldo.original — lo que había antes de la tarea", () => {
  test("devuelve el contenido previo de un archivo que existía, y null de uno nuevo o no registrado", () => {
    const cwd = escribir(tmp("forge-mlin-resp-"), { "src/a.js": "export const a = 1;\n" });
    const respaldo = new Respaldo(cwd, join(cwd, ".sdd", "motor", "r1", "respaldo", "T1"));
    respaldo.registrar("src/a.js");
    respaldo.registrar("src/nuevo.js");
    escribir(cwd, { "src/a.js": "export const a = 2;\n", "src/nuevo.js": "export const n = 1;\n" });
    assert.equal(respaldo.original("src/a.js"), "export const a = 1;\n");
    assert.equal(respaldo.original("src/nuevo.js"), null);
    assert.equal(respaldo.original("src/otro.js"), null);
    assert.equal(respaldo.original("SRC/A.JS"), "export const a = 1;\n", "la ruta se compara como al registrar");
    // Una segunda escritura no cambia lo que se considera original
    respaldo.registrar("src/a.js");
    assert.equal(respaldo.original("src/a.js"), "export const a = 1;\n");
  });

  test("otro proceso (reanudación) lee el mismo original desde el manifiesto", () => {
    const cwd = escribir(tmp("forge-mlin-resp-"), { "src/a.js": "uno\n" });
    const dir = join(cwd, ".sdd", "motor", "r1", "respaldo", "T1");
    new Respaldo(cwd, dir).registrar("src/a.js");
    escribir(cwd, { "src/a.js": "dos\n" });
    assert.equal(new Respaldo(cwd, dir).original("src/a.js"), "uno\n");
  });

  test("si la copia del respaldo falta, no lanza: devuelve null (se alterará el archivo entero)", () => {
    const cwd = escribir(tmp("forge-mlin-resp-"), { "src/a.js": "uno\n" });
    const dir = join(cwd, ".sdd", "motor", "r1", "respaldo", "T1");
    const respaldo = new Respaldo(cwd, dir);
    respaldo.registrar("src/a.js");
    writeFileSync(join(dir, "archivos", "src", "a.js"), "");
    assert.equal(respaldo.original("src/a.js"), "");
    escribir(dir, { "manifiesto.json": JSON.stringify({ entradas: [{ ruta: "src/b.js", existia: true }] }) });
    assert.equal(new Respaldo(cwd, dir).original("src/b.js"), null);
  });
});

// ── Ciclo completo: el nodo `mutacion` usa el respaldo ───────────────────────

describe("ciclo completo — una tarea que cambia una función de un archivo grande que ya existía", () => {
  const bloque = (ruta, contenido) => "```json\n" + JSON.stringify({ archivos: [{ ruta, contenido }] }) + "\n```";
  const TAREA = { id: "T1", agente: "desarrollador-backend", prompt: "Cambia regla70", archivos: ["src/reglas.js"] };

  /** @param {{ coder: string, motor?: any }} o */
  function entorno(o) {
    const cwd = escribir(tmp("forge-mlin-ciclo-"), { "package.json": "{\"type\":\"module\"}", "src/reglas.js": ORIGINAL });
    const eventos = [];
    const guion = {
      arquitecto: ['{"pasos":["implementar"],"archivosObjetivo":["src/reglas.js"]}'],
      tester: [bloque("tests/reglas.test.js", "// de la tarea\n")],
      "desarrollador-backend": [bloque("src/reglas.js", o.coder)],
    };
    const opciones = {
      cwd, runId: "r1", testCmd: "npm test",
      config: { ...POR_DEFECTO, motor: { ...POR_DEFECTO.motor, grafo: "propio", ...o.motor } },
      log: { append: (type, payload, meta) => eventos.push({ type, payload, meta }) },
      aliasDe: () => "sonnet",
      llamar: async (p) => {
        const s = guion[p.agente]?.shift();
        if (s === undefined) throw new Error(`guion agotado para ${p.agente}`);
        return { ok: true, output: s, inputTokens: 100, outputTokens: 10, modelo: "claude-sonnet-4-6", proveedor: "anthropic" };
      },
      // Con el archivo original (antes de implementar) las pruebas de la tarea fallan: rojo de verdad
      runner: ejecutorDeLaTarea("src/reglas.js", NUEVO, rangoTocada),
    };
    return { cwd, eventos, ciclo: () => new CicloVerificado(/** @type {any} */ (opciones)) };
  }

  test("la medición se limita a la función cambiada: puntuación alta, y el registro dice cuántas candidatas quedaron fuera", async () => {
    const e = entorno({ coder: NUEVO, motor: { mutacion: "exigir" } });
    const r = await e.ciclo().ejecutar(TAREA);

    assert.equal(r.estado.resultado, "exito", JSON.stringify(r.estado.revision));
    assert.equal(r.estado.rojo?.estado, "fallan");
    assert.equal(r.estado.mutacion?.puntuacion, 1);
    assert.ok((r.estado.mutacion?.fueraDeLoCambiado ?? 0) > 1000);
    assert.deepEqual(validarEstado(r.estado), []);

    const mutantes = e.eventos.filter((x) => x.type === "ciclo:mutante");
    assert.ok(mutantes.length > 0);
    assert.ok(mutantes.every((x) => x.payload.linea >= rangoTocada.inicio && x.payload.linea <= rangoTocada.fin), "ningún cambio probado cae en código que la tarea no tocó");
    const resumen = e.eventos.find((x) => x.type === "ciclo:mutacion");
    assert.equal(resumen?.payload.fueraDeLoCambiado, r.estado.mutacion?.fueraDeLoCambiado);
    assert.equal(resumen?.payload.candidatas, r.estado.mutacion?.candidatas);
    assert.equal(readFileSync(join(e.cwd, "src/reglas.js"), "utf8"), NUEVO, "el proyecto real no queda alterado");
  });

  test("si la tarea solo añade algo que no se puede alterar, la medición se omite y lo explica", async () => {
    const soloComentario = ORIGINAL.replace(`export function regla${TOCADA}(valor) {`, `// regla setenta\nexport function regla${TOCADA}(valor) {`);
    const cwd = escribir(tmp("forge-mlin-ciclo-"), { "package.json": "{\"type\":\"module\"}", "src/reglas.js": ORIGINAL });
    const eventos = [];
    const guion = {
      arquitecto: ['{"pasos":["implementar"],"archivosObjetivo":["src/reglas.js"]}'],
      tester: [bloque("tests/reglas.test.js", "// de la tarea\n")],
      "desarrollador-backend": [bloque("src/reglas.js", soloComentario)],
    };
    const ciclo = new CicloVerificado(/** @type {any} */ ({
      cwd, runId: "r1", testCmd: "npm test",
      config: { ...POR_DEFECTO, motor: { ...POR_DEFECTO.motor, grafo: "propio" } },
      log: { append: (type, payload, meta) => eventos.push({ type, payload, meta }) },
      aliasDe: () => "sonnet",
      llamar: async (p) => ({ ok: true, output: guion[p.agente].shift(), inputTokens: 1, outputTokens: 1, modelo: "claude-sonnet-4-6", proveedor: "anthropic" }),
      // Falla sin el comentario (rojo) y pasa con él
      runner: { test: async (dir) => (readFileSync(join(dir, "src/reglas.js"), "utf8").includes("// regla setenta") ? { ...PASE } : { ...FALLO }) },
    }));
    const r = await ciclo.ejecutar(TAREA);
    assert.equal(r.estado.resultado, "exito", JSON.stringify(r.estado.revision));
    assert.match(String(r.estado.mutacion?.omitida), /líneas que cambió la tarea/);
    const omitida = eventos.find((x) => x.type === "ciclo:mutacion_omitida");
    assert.ok(omitida, "queda anotado que no se midió");
    assert.ok(omitida.payload.fueraDeLoCambiado > 1000);
    assert.equal(eventos.filter((x) => x.type === "ciclo:mutante").length, 0);
  });
});
