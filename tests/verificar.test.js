// @ts-check
/**
 * `forge verificar` (spec 2026-10-13-verificar-sin-modelo, F1 y F2), con el Docker falso.
 */

import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE = join(RAIZ, "tests", "fixtures", "verificar-docker-falso.mjs");
const VIGILAR = join(RAIZ, "tests", "fixtures", "vigilar-red-y-claves.mjs");
const CLI = join(RAIZ, "cli", "index.js");

const base = realpathSync(mkdtempSync(join(tmpdir(), "forge-verificar-test-")));
after(() => rmSync(base, { recursive: true, force: true }));
let n = 0;

/** Proyecto de Node con un archivo de pruebas. @param {string} cuerpo @param {{ sdd?: boolean }} [o] */
function proyecto(cuerpo, o = {}) {
  const dir = join(base, `p${++n}`, "proyecto");
  mkdirSync(join(dir, "tests"), { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "demo", type: "module", scripts: { test: "node --test" } }));
  writeFileSync(join(dir, "tests", "a.test.js"), cuerpo);
  if (o.sdd) mkdirSync(join(dir, ".sdd"), { recursive: true });
  return dir;
}

const PASA = `import {test} from "node:test"; import assert from "node:assert"; test("ok", () => assert.equal(1, 1));`;
const FALLA = `import {test} from "node:test"; import assert from "node:assert"; test("mal", () => assert.equal(1, 2));`;

/**
 * @param {string} dir @param {string[]} args @param {Record<string, string>} [env] @param {string[]} [nodeArgs]
 */
function verificar(dir, args, env = {}, nodeArgs = []) {
  const temporal = join(dirname(dir), "tmp");
  mkdirSync(temporal, { recursive: true });
  const registro = join(dirname(dir), "docker.jsonl");
  const { NODE_TEST_CONTEXT: _o, ...heredado } = process.env;
  const r = spawnSync(process.execPath, [...nodeArgs, FIXTURE, "--cwd", dir, ...args], {
    encoding: "utf8", timeout: 120_000,
    env: { ...heredado, TEMP: temporal, TMP: temporal, TMPDIR: temporal, FALSO_REGISTRO: registro, ANTHROPIC_API_KEY: "", OPENAI_API_KEY: "", ...env },
  });
  const lineas = existsSync(registro) ? readFileSync(registro, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
  return { codigo: r.status, salida: r.stdout, errores: r.stderr, temporal, docker: lineas, runs: lineas.filter((l) => l.orden === "run") };
}

describe("forge verificar: los cuatro veredictos y sus códigos", () => {
  test("pasa: código 0, JSON con la forma fija, y el proyecto queda intacto", () => {
    const dir = proyecto(PASA);
    const antes = readdirSync(dir).sort();
    const r = verificar(dir, ["--json"]);
    assert.equal(r.codigo, 0, r.salida + r.errores);
    const j = JSON.parse(r.salida);
    assert.equal(j.formato, 1);
    assert.equal(j.veredicto, "pasa");
    assert.equal(j.codigoSalida, 0);
    assert.equal(j.codigoPruebas, 0);
    assert.equal(j.lenguaje, "javascript");
    assert.match(j.comando, /npm test|node --test/);
    for (const campo of ["imagen", "duracionMs", "cortePorTiempo", "cortePorMemoria", "salida", "avisos"]) assert.ok(campo in j, campo);
    assert.equal(r.runs.length, 1);
    assert.deepEqual(readdirSync(dir).sort(), antes, "no se creó nada en el proyecto");
  });

  test("falla: código 1", () => {
    const r = verificar(proyecto(FALLA), ["--json"]);
    assert.equal(r.codigo, 1, r.salida);
    const j = JSON.parse(r.salida);
    assert.equal(j.veredicto, "falla");
    assert.notEqual(j.codigoPruebas, 0);
  });

  test("cero pruebas ejecutadas (código 5 con pytest) no es éxito: código 1", () => {
    const dir = proyecto(PASA);
    writeFileSync(join(dir, "requirements.txt"), "pytest\n");
    writeFileSync(join(dir, "package.json"), "{}");
    writeFileSync(join(dir, "x.py"), "");
    // sin package.json reconocible el detector elige Python
    rmSync(join(dir, "package.json"));
    const r = verificar(dir, ["--json", "--comando", "python -m pytest"], { FALSO_CODIGO: "5" });
    assert.equal(r.codigo, 1, r.salida + r.errores);
    assert.equal(JSON.parse(r.salida).veredicto, "sin_pruebas");
  });

  test("sin Docker: código 4, nada se ejecuta y no hay forma de saltarlo", () => {
    const dir = proyecto(PASA);
    const r = verificar(dir, ["--json"], { FALSO_SIN_DOCKER: "1" });
    assert.equal(r.codigo, 4, r.salida + r.errores);
    const j = JSON.parse(r.salida);
    assert.equal(j.veredicto, "infraestructura");
    assert.match(j.motivo, /Docker/);
    assert.equal(r.runs.length, 0);
    // No existe ninguna opción para ejecutar sin aislamiento
    for (const opcion of ["--sin-aislamiento", "--local", "--sin-docker", "--no-sandbox"]) {
      const o = verificar(dir, [opcion], { FALSO_SIN_DOCKER: "1" });
      assert.equal(o.codigo, 1, opcion);
      assert.match(o.errores, /Opción desconocida/);
      assert.equal(o.runs.length, 0);
    }
  });
});

describe("forge verificar: entrada", () => {
  test("lenguaje no admitido: código 1 y no ejecuta nada", () => {
    const dir = join(base, `p${++n}`, "proyecto");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "Cargo.toml"), "[package]\nname=\"x\"\n");
    const r = verificar(dir, ["--json"]);
    assert.equal(r.codigo, 1, r.salida + r.errores);
    assert.equal(JSON.parse(r.salida).veredicto, "falla");
    assert.equal(r.runs.length, 0);
  });

  test("--comando se ejecuta sin intérprete de órdenes: un operador se rechaza sin ejecutar nada", () => {
    const r = verificar(proyecto(PASA), ["--json", "--comando", "node --test && echo hola"]);
    assert.equal(r.codigo, 1);
    assert.match(JSON.parse(r.salida).motivo, /operador de shell "&&"/);
    assert.equal(r.runs.length, 0);
  });

  test("--comando válido sustituye al detectado", () => {
    const r = verificar(proyecto(PASA), ["--json", "--comando", "node --test"]);
    assert.equal(r.codigo, 0, r.salida);
    assert.equal(JSON.parse(r.salida).comando, "node --test");
  });

  test("opciones de fases posteriores se rechazan con un mensaje claro", () => {
    const r = verificar(proyecto(PASA), ["--mutacion"]);
    assert.equal(r.codigo, 1);
    assert.match(r.errores, /todavía no está disponible/);
    assert.equal(r.runs.length, 0);
  });
});

describe("forge verificar: aislamiento del proyecto y del ciclo", () => {
  test("proyecto sin .sdd/ (y con él): no se crea nada dentro, y no queda nada en el temporal", () => {
    for (const sdd of [false, true]) {
      const dir = proyecto(PASA, { sdd });
      const antes = JSON.stringify(readdirSync(dir).sort()) + (sdd ? JSON.stringify(readdirSync(join(dir, ".sdd"))) : "");
      const r = verificar(dir, ["--json"]);
      assert.equal(r.codigo, 0, r.salida + r.errores);
      const despues = JSON.stringify(readdirSync(dir).sort()) + (sdd ? JSON.stringify(readdirSync(join(dir, ".sdd"))) : "");
      assert.equal(despues, antes);
      assert.deepEqual(readdirSync(r.temporal).filter((x) => x.startsWith("forge-verificar-")), [], "el temporal quedó limpio");
      // La copia que vio «el contenedor» está fuera del proyecto
      assert.ok(r.runs.every((x) => !String(x.copia).startsWith(dir)), String(r.runs[0]?.copia));
    }
  });

  test("el proyectoId del barrido no es el del ciclo del mismo proyecto (no mata contenedores ajenos)", () => {
    const dir = proyecto(PASA, { sdd: true });
    const r = verificar(dir, ["--json"]);
    const idCiclo = createHash("sha256").update(resolve(dir)).digest("hex").slice(0, 12);
    const filtros = r.docker.filter((l) => l.orden === "ps").flatMap((l) => l.args).filter((a) => String(a).includes(".proyecto="));
    assert.ok(filtros.length > 0, "el barrido filtra por proyecto");
    for (const f of filtros) assert.ok(!String(f).includes(idCiclo), `${f} comparte el id del ciclo`);
  });
});

describe("forge verificar: sin modelo, sin claves, sin red", () => {
  test("estática: el comando no alcanza proveedores de modelo, integraciones ni el motor del ciclo", () => {
    const visto = new Set();
    const pendientes = [join(RAIZ, "cli", "verificar.js"), join(RAIZ, "core", "verificar", "index.js"), join(RAIZ, "core", "verificar", "resultado.js")];
    while (pendientes.length) {
      const f = /** @type {string} */ (pendientes.pop());
      if (visto.has(f)) continue;
      visto.add(f);
      const texto = readFileSync(f, "utf8");
      for (const m of texto.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)['"](\.{1,2}\/[^'"]+)['"]/g)) {
        const destino = resolve(dirname(f), m[1]);
        if (existsSync(destino)) pendientes.push(destino);
      }
    }
    const rutas = [...visto].map((f) => f.slice(RAIZ.length).replace(/\\/g, "/"));
    for (const r of rutas) {
      assert.ok(!/llm-providers|integraciones|orchestrator|engine-cli|ciclo\/index\.js|nodos\.js|api\//.test(r), `importa ${r}`);
    }
    for (const f of [...visto].filter((x) => /[\/](verificar)[\/]|cli[\/]verificar.js$/.test(x))) {
      const texto = readFileSync(f, "utf8");
      assert.ok(!/ANTHROPIC_API_KEY|OPENAI_API_KEY|API_KEY|@anthropic-ai/.test(texto.replace(/\/\*[\s\S]*?\*\//g, "")), `${f} menciona claves`);
    }
  });

  test("cli/index.js no importa el comando al arrancar: solo dentro del case", () => {
    const texto = readFileSync(CLI, "utf8");
    assert.ok(!/^import .*verificar/m.test(texto));
    assert.match(texto, /case "verificar": \{[\s\S]*?await import\("\.\/verificar\.js"\)/);
  });

  test("en ejecución: ni fetch ni lectura de claves, aunque el entorno las tenga", () => {
    const dir = proyecto(PASA);
    const vigilancia = join(dirname(dir), "vigilancia.jsonl");
    const r = verificar(dir, ["--json"], {
      FORGE_VIGILANCIA: vigilancia, ANTHROPIC_API_KEY: "sk-ant-api03-" + "A".repeat(40), OPENAI_API_KEY: "sk-" + "B".repeat(40),
    }, ["--import", pathToFileURL(VIGILAR).href]);
    assert.equal(r.codigo, 0, r.salida + r.errores);
    const visto = existsSync(vigilancia) ? readFileSync(vigilancia, "utf8") : "";
    assert.equal(visto, "", `se vigiló actividad: ${visto}`);
  });

  test("la salida de las pruebas se redacta: un secreto centinela no sale ni en texto ni en JSON", () => {
    const centinela = "sk-ant-api03-" + "Zq8kLm2xP9".repeat(5);
    const dir = proyecto(`import {test} from "node:test"; test("imprime", () => { console.log("clave=${centinela}"); throw new Error("fallo con ${centinela}"); });`);
    const j = verificar(dir, ["--json"]);
    assert.equal(j.codigo, 1);
    assert.ok(!j.salida.includes(centinela), "JSON");
    assert.ok(!j.salida.includes("Zq8kLm2xP9Zq8kLm2xP9"));
    assert.match(JSON.parse(j.salida).salida, /REDACTADO/);
    const t = verificar(dir, []);
    assert.ok(!t.salida.includes(centinela), "texto");
    assert.ok(!t.salida.includes("Zq8kLm2xP9Zq8kLm2xP9"));
  });

  test("la salida de las pruebas está acotada", () => {
    const dir = proyecto(`import {test} from "node:test"; test("mucho", () => { console.log("x".repeat(60000)); });`);
    const j = JSON.parse(verificar(dir, ["--json"]).salida);
    assert.ok(Buffer.byteLength(j.salida) <= 8192 + 4);
  });
});
