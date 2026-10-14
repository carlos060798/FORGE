// @ts-check
/**
 * `forge verificar --mutacion`, `--desde`, `--mutacion-minima` y `--registrar` (spec 2026-10-13-verificar-sin-modelo, F3 y F4),
 * con el Docker falso (tests/fixtures/verificar-docker-falso.mjs).
 */

import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync, realpathSync, symlinkSync } from "node:fs";
import { spawn, spawnSync, execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE = join(RAIZ, "tests", "fixtures", "verificar-docker-falso.mjs");

const base = realpathSync(mkdtempSync(join(tmpdir(), "forge-verificar-mut-")));
after(() => rmSync(base, { recursive: true, force: true }));
let n = 0;

const FUENTE = [
  "export function suma(a, b) { return a + b; }",
  "export const LIMITE = 10;",
  "export function esGrande(n) { return n >= LIMITE; }",
  "export function mayor(a, b) { if (a > b) { return a; } return b; }",
  "",
].join("\n");

const PRUEBAS_FUERTES = `import {test} from "node:test"; import assert from "node:assert";
import {suma, LIMITE, esGrande, mayor} from "../src/calc.js";
test("suma", () => { assert.equal(suma(2, 3), 5); assert.equal(suma(-1, 1), 0); });
test("limite", () => { assert.equal(LIMITE, 10); });
test("esGrande", () => { assert.equal(esGrande(10), true); assert.equal(esGrande(9), false); assert.equal(esGrande(11), true); });
test("mayor", () => { assert.equal(mayor(5, 2), 5); assert.equal(mayor(2, 5), 5); assert.equal(mayor(3, 3), 3); });
`;
const PRUEBAS_DEBILES = `import {test} from "node:test"; import assert from "node:assert";
import {suma, esGrande, mayor} from "../src/calc.js";
test("existe", () => { assert.equal(typeof suma, "function"); assert.equal(typeof esGrande, "function"); assert.equal(typeof mayor, "function"); });
`;

/** @param {string} pruebas @param {{ sdd?: boolean, fuente?: string }} [o] */
function proyecto(pruebas, o = {}) {
  const dir = join(base, `p${++n}`, "proyecto");
  mkdirSync(join(dir, "tests"), { recursive: true });
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "demo", type: "module", scripts: { test: "node --test" } }));
  writeFileSync(join(dir, "src", "calc.js"), o.fuente ?? FUENTE);
  writeFileSync(join(dir, "tests", "calc.test.js"), pruebas);
  if (o.sdd) mkdirSync(join(dir, ".sdd"), { recursive: true });
  return dir;
}

/** @param {string} dir @param {string[]} args @param {Record<string, string>} [env] */
function entorno(dir, args, env = {}) {
  const temporal = join(dirname(dir), "tmp");
  mkdirSync(temporal, { recursive: true });
  const registro = join(dirname(dir), `docker-${Math.random().toString(36).slice(2)}.jsonl`);
  const { NODE_TEST_CONTEXT: _o, ...heredado } = process.env;
  const e = { ...heredado, TEMP: temporal, TMP: temporal, TMPDIR: temporal, FALSO_REGISTRO: registro, ANTHROPIC_API_KEY: "", OPENAI_API_KEY: "", ...env };
  return { temporal, registro, e, argv: [FIXTURE, "--cwd", dir, ...args] };
}

/** @param {string} registro */
const leerRegistro = (registro) => (existsSync(registro) ? readFileSync(registro, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);

/** @param {string} dir @param {string[]} args @param {Record<string, string>} [env] */
function verificar(dir, args, env = {}) {
  const x = entorno(dir, args, env);
  const r = spawnSync(process.execPath, x.argv, { encoding: "utf8", timeout: 240_000, env: x.e });
  const docker = leerRegistro(x.registro);
  return { codigo: r.status, salida: r.stdout, errores: r.stderr, temporal: x.temporal, runs: docker.filter((l) => l.orden === "run") };
}

/** @param {string} dir @param {string[]} args */
function verificarAsync(dir, args) {
  const x = entorno(dir, args);
  return new Promise((res) => {
    const p = spawn(process.execPath, x.argv, { env: x.e, stdio: ["ignore", "pipe", "pipe"] });
    let salida = ""; let errores = "";
    p.stdout.on("data", (d) => { salida += d; });
    p.stderr.on("data", (d) => { errores += d; });
    p.on("close", (codigo) => res({ codigo, salida, errores, temporal: x.temporal }));
  });
}

describe("verificar --mutacion: opciones", () => {
  test("sin --archivos ni --desde se rechaza explicando las dos, sin ejecutar nada", () => {
    const r = verificar(proyecto(PRUEBAS_FUERTES), ["--mutacion"]);
    assert.equal(r.codigo, 1);
    assert.match(r.errores, /--archivos/);
    assert.match(r.errores, /--desde/);
    assert.match(r.errores, /No se muta el proyecto entero/);
    assert.equal(r.runs.length, 0);
  });

  test("--archivos/--desde/--mutacion-minima sin --mutacion y valores inválidos se rechazan", () => {
    const dir = proyecto(PRUEBAS_FUERTES);
    for (const args of [["--archivos", "src/calc.js"], ["--mutacion-minima", "0.5"], ["--mutacion", "--archivos", "a", "--mutacion-minima", "1.5"], ["--mutacion", "--archivos", "a", "--mutacion-minima", "abc"]]) {
      const r = verificar(dir, args);
      assert.equal(r.codigo, 1, args.join(" "));
      assert.equal(r.runs.length, 0);
    }
  });
});

describe("verificar --mutacion --archivos", () => {
  test("pruebas fuertes: detección alta, concluyente, aviso del adversario y código 0 con el mínimo", () => {
    const dir = proyecto(PRUEBAS_FUERTES);
    const r = verificar(dir, ["--json", "--mutacion", "--archivos", "src/calc.js", "--mutacion-minima", "0.6"]);
    assert.equal(r.codigo, 0, r.salida + r.errores);
    const j = JSON.parse(r.salida);
    assert.equal(j.veredicto, "pasa");
    const m = j.mutacion;
    assert.equal(m.solicitada, true);
    assert.ok(m.probadas >= 3, `probadas ${m.probadas}`);
    assert.equal(m.concluyente, true, JSON.stringify(m.motivos));
    assert.equal(m.concluyentes, m.probadas);
    assert.ok(m.puntuacion >= 0.6, `puntuación ${m.puntuacion}`);
    assert.equal(m.veredicto, "cumple_el_minimo");
    assert.match(m.aviso, /adversario deliberado/);
    const texto = verificar(dir, ["--mutacion", "--archivos", "src/calc.js"]);
    assert.match(texto.salida, /adversario deliberado/);
    assert.match(texto.salida, /Mutación: medida/);
    assert.equal(texto.codigo, 0);
  });

  test("pruebas débiles: sin --mutacion-minima solo se informa (0); con ella, código 1 y veredicto falla", () => {
    const dir = proyecto(PRUEBAS_DEBILES);
    const informa = verificar(dir, ["--json", "--mutacion", "--archivos", "src/calc.js"]);
    assert.equal(informa.codigo, 0, informa.salida);
    const mi = JSON.parse(informa.salida).mutacion;
    assert.ok(mi.puntuacion < 0.6, `puntuación ${mi.puntuacion}`);
    assert.equal(mi.veredicto, "medida");
    assert.ok(mi.sobrevivientes.length > 0);

    const exige = verificar(dir, ["--json", "--mutacion", "--archivos", "src/calc.js", "--mutacion-minima", "0.6"]);
    assert.equal(exige.codigo, 1, exige.salida);
    const j = JSON.parse(exige.salida);
    assert.equal(j.veredicto, "falla");
    assert.equal(j.codigoSalida, 1);
    assert.equal(j.mutacion.veredicto, "bajo_el_minimo");
    assert.match(j.motivo, /mínimo es 60 %/);
  });

  test("no concluyente (nada que alterar, o archivo inexistente): con el mínimo falla cerrado; sin él se informa", () => {
    const dir = proyecto(PRUEBAS_FUERTES);
    writeFileSync(join(dir, "NOTAS.md"), "# nada\n");
    for (const archivo of ["NOTAS.md", "src/no-existe.js"]) {
      const exige = verificar(dir, ["--json", "--mutacion", "--archivos", archivo, "--mutacion-minima", "0.1"]);
      assert.equal(exige.codigo, 1, archivo + exige.salida);
      const j = JSON.parse(exige.salida);
      assert.equal(j.mutacion.veredicto, "no_concluyente");
      assert.equal(j.mutacion.puntuacion, null);
      assert.equal(j.veredicto, "falla");
      const informa = verificar(dir, ["--json", "--mutacion", "--archivos", archivo]);
      assert.equal(informa.codigo, 0);
      assert.equal(JSON.parse(informa.salida).mutacion.concluyente, false);
    }
  });

  test("pocas alteraciones concluyentes (por debajo de mutacion_min_concluyentes) es no concluyente", () => {
    const dir = proyecto(PRUEBAS_FUERTES, { fuente: "export function suma(a, b) { return a + b; }\nexport const LIMITE = 10;\nexport function esGrande(n) { return n >= LIMITE; }\nexport function mayor(a, b) { if (a > b) { return a; } return b; }\n" });
    mkdirSync(join(dir, ".sdd"), { recursive: true });
    writeFileSync(join(dir, ".sdd", "sdd.config.yaml"), "motor:\n  mutacion_min_concluyentes: 50\n");
    const r = verificar(dir, ["--json", "--mutacion", "--archivos", "src/calc.js", "--mutacion-minima", "0.5"]);
    assert.equal(r.codigo, 1, r.salida + r.errores);
    const j = JSON.parse(r.salida);
    assert.equal(j.mutacion.veredicto, "no_concluyente");
    assert.match(j.mutacion.motivos.join(" "), /alteraciones concluyentes \(el mínimo es 50\)/);
  });

  test("las rutas fuera del proyecto se rechazan y no se muta nada fuera", () => {
    const dir = proyecto(PRUEBAS_FUERTES);
    const fuera = join(dirname(dir), "ajeno.js");
    writeFileSync(fuera, "export const x = 1 + 2;\n");
    const r = verificar(dir, ["--json", "--mutacion", "--archivos", "../ajeno.js", "--mutacion-minima", "0.5"]);
    assert.equal(r.codigo, 1);
    assert.equal(JSON.parse(r.salida).mutacion.veredicto, "no_concluyente");
    assert.equal(readFileSync(fuera, "utf8"), "export const x = 1 + 2;\n");
  });

  test("si las pruebas fallan no se mide: la mutación consta como no medida", () => {
    const dir = proyecto(PRUEBAS_FUERTES.replace("assert.equal(LIMITE, 10)", "assert.equal(LIMITE, 11)"));
    const r = verificar(dir, ["--json", "--mutacion", "--archivos", "src/calc.js"]);
    assert.equal(r.codigo, 1);
    const j = JSON.parse(r.salida);
    assert.equal(j.veredicto, "falla");
    assert.equal(j.mutacion.veredicto, "no_concluyente");
    assert.match(j.mutacion.motivos.join(" "), /no se midió/);
  });
});

describe("verificar --mutacion --desde", () => {
  const GIT = ["-c", "user.email=t@t", "-c", "user.name=t", "-c", "commit.gpgsign=false"];
  const git = (/** @type {string} */ d, /** @type {string[]} */ a) => execFileSync("git", [...GIT, ...a], { cwd: d, stdio: "ignore" });

  test("solo se mide lo cambiado desde la referencia y el repositorio hostil no ejecuta nada", () => {
    const dir = proyecto(PRUEBAS_FUERTES);
    git(dir, ["init", "-q"]); git(dir, ["add", "-A"]); git(dir, ["commit", "-q", "-m", "base"]); git(dir, ["tag", "base"]);
    // Cambio: una función nueva en calc.js y un archivo nuevo
    writeFileSync(join(dir, "src", "calc.js"), FUENTE + "export function doble(n) { return n * 2; }\n");
    writeFileSync(join(dir, "src", "otro.js"), "export function resta(a, b) { return a - b; }\nexport const CERO = 0;\n");
    writeFileSync(join(dir, "tests", "calc.test.js"), PRUEBAS_FUERTES + `import {doble} from "../src/calc.js"; import {resta, CERO} from "../src/otro.js";
test("doble", () => { assert.equal(doble(4), 8); assert.equal(doble(0), 0); });
test("resta", () => { assert.equal(resta(5, 3), 2); assert.equal(CERO, 0); });
`.replace(/^import \{test\}.*\n/, ""));
    // Configuración hostil añadida después del commit
    const guardia = join(base, `g${n}`);
    mkdirSync(guardia);
    const script = join(guardia, "c.sh").replace(/\\/g, "/");
    writeFileSync(script, '#!/bin/sh\necho x > "$(dirname "$0")/PWNED-$1"\ncase "$1" in clean) cat;; esac\n');
    const cfg = join(dir, ".git", "config");
    writeFileSync(cfg, readFileSync(cfg, "utf8") + `[core]\n\tfsmonitor = sh "${script}" fsmonitor\n[filter "evil"]\n\tclean = sh "${script}" clean\n`);
    writeFileSync(join(dir, ".gitattributes"), "*.js filter=evil\n");

    const r = verificar(dir, ["--json", "--mutacion", "--desde", "base", "--mutacion-minima", "0.5"]);
    assert.equal(r.codigo, 0, r.salida + r.errores);
    const j = JSON.parse(r.salida);
    assert.equal(j.mutacion.concluyente, true, JSON.stringify(j.mutacion.motivos));
    assert.ok(j.avisos.some((/** @type {string} */ a) => /--desde base/.test(a)));
    assert.ok(j.mutacion.fueraDeLoCambiado > 0, "el código que ya existía y no cambió queda fuera");
    assert.deepEqual(readdirSync(guardia).filter((f) => f.startsWith("PWNED")), [], "git no ejecutó nada del repositorio");
  });

  test("referencia inexistente: error claro, código 1, nada se ejecuta", () => {
    const dir = proyecto(PRUEBAS_FUERTES);
    const r = verificar(dir, ["--json", "--mutacion", "--desde", "no-existe"]);
    assert.equal(r.codigo, 1);
    assert.match(JSON.parse(r.salida).motivo, /--archivos/);
    assert.equal(r.runs.length, 0);
  });

  test("con --archivos y --desde a la vez manda --archivos", () => {
    const dir = proyecto(PRUEBAS_FUERTES);
    const r = verificar(dir, ["--json", "--mutacion", "--archivos", "src/calc.js", "--desde", "no-existe"]);
    assert.equal(r.codigo, 0, r.salida);
    assert.deepEqual(JSON.parse(r.salida).mutacion.archivos, ["src/calc.js"]);
  });
});

describe("verificar --registrar", () => {
  test("sin la opción no aparece nada en el proyecto; con ella, evento y archivo", () => {
    const dir = proyecto(PRUEBAS_FUERTES, { sdd: true });
    const antes = JSON.stringify(readdirSync(join(dir, ".sdd")));
    const sin = verificar(dir, ["--json"]);
    assert.equal(sin.codigo, 0);
    assert.equal(JSON.stringify(readdirSync(join(dir, ".sdd"))), antes);
    assert.equal(JSON.parse(sin.salida).registro, null);

    const con = verificar(dir, ["--json", "--registrar", "--mutacion", "--archivos", "src/calc.js"]);
    assert.equal(con.codigo, 0, con.salida + con.errores);
    const j = JSON.parse(con.salida);
    assert.ok(j.registro?.id && j.registro.archivo);
    const archivo = JSON.parse(readFileSync(join(dir, j.registro.archivo), "utf8"));
    assert.equal(archivo.id, j.registro.id);
    assert.equal(archivo.veredicto, "pasa");
    assert.ok(archivo.mutacion);
    const eventos = readFileSync(join(dir, ".sdd", "events.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
    assert.equal(eventos.length, 1);
    assert.equal(eventos[0].type, "verificar:resultado");
    assert.equal(eventos[0].payload.id, j.registro.id);
    assert.equal(eventos[0].payload.mutacion.concluyente, true);
  });

  test("se registra también sin .sdd/ previo, y un carpeta de evidencia que es un enlace no se escribe", () => {
    const dir = proyecto(PRUEBAS_FUERTES);
    const r = verificar(dir, ["--json", "--registrar"]);
    assert.equal(r.codigo, 0, r.salida);
    assert.ok(existsSync(join(dir, ".sdd", "events.jsonl")));

    // Una unión (enlace de directorio) donde debería estar la carpeta de evidencia: no se escribe a través de ella
    const dir2 = proyecto(PRUEBAS_FUERTES, { sdd: true });
    const objetivo = join(dirname(dir2), "robado");
    mkdirSync(objetivo);
    symlinkSync(objetivo, join(dir2, ".sdd", "verificaciones"), "junction");
    const r2 = verificar(dir2, ["--json", "--registrar"]);
    assert.deepEqual(readdirSync(objetivo), [], "no se escribió a través del enlace");
    assert.ok(JSON.parse(r2.salida).registro.error);
    assert.equal(r2.codigo, 1, "pidió evidencia y no quedó: no es un éxito");
  });

  test("el archivo registrado va redactado (un secreto de la salida no llega al disco)", () => {
    const secreto = "sk-ant-api03-" + "Z".repeat(40);
    const dir = proyecto(`import {test} from "node:test"; test("ok", () => { console.log("clave ${secreto}"); });`);
    const r = verificar(dir, ["--json", "--registrar"]);
    assert.equal(r.codigo, 0, r.salida);
    const j = JSON.parse(r.salida);
    const crudo = readFileSync(join(dir, j.registro.archivo), "utf8") + readFileSync(join(dir, ".sdd", "events.jsonl"), "utf8");
    assert.ok(!crudo.includes(secreto));
  });
});

describe("verificar: dos verificaciones simultáneas del mismo proyecto", () => {
  test("no se pisan: cada una termina con un resultado válido, sin restos y con registros distintos", async () => {
    const dir = proyecto(PRUEBAS_FUERTES, { sdd: true });
    const a = verificarAsync(dir, ["--json", "--registrar"]);
    const b = verificarAsync(dir, ["--json", "--registrar"]);
    const [ra, rb] = /** @type {any[]} */ (await Promise.all([a, b]));
    const ok = [];
    for (const r of [ra, rb]) {
      const j = JSON.parse(r.salida);
      if (j.veredicto === "pasa") { assert.equal(r.codigo, 0); ok.push(j); }
      else {
        // La otra encontró el candado del proyecto: se rechaza con claridad, sin tocar nada
        assert.equal(j.veredicto, "infraestructura", r.salida);
        assert.equal(r.codigo, 4);
        assert.match(j.motivo, /ya está en curso/);
      }
    }
    assert.ok(ok.length >= 1, "al menos una terminó");
    const archivos = readdirSync(join(dir, ".sdd", "verificaciones"));
    assert.equal(archivos.length, 2, "ambas dejaron su registro, con ids distintos");
    const eventos = readFileSync(join(dir, ".sdd", "events.jsonl"), "utf8").split("\n").filter(Boolean);
    assert.equal(eventos.length, 2);
    for (const l of eventos) JSON.parse(l);
    assert.deepEqual(readdirSync(ra.temporal).filter((x) => x.startsWith("forge-verificar-")), [], "el temporal quedó limpio");
  });
});
