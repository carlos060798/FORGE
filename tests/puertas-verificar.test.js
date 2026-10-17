// @ts-check
/**
 * Puertas declarables dentro de `forge verificar` (spec 2026-10-14-puertas-de-calidad-y-evidencia, fase B1),
 * con el Docker falso: el mismo código de cli/verificar.js, core/verificar y core/puertas, y el mismo SandboxRunner.
 * «El contenedor» de una puerta es `node -e ...` en la copia: así cada puerta decide su código de salida.
 * CA-001-xx, CA-002-01 a CA-002-05 y CA-002-07.
 */

import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE = join(RAIZ, "tests", "fixtures", "verificar-docker-falso.mjs");

const base = realpathSync(mkdtempSync(join(tmpdir(), "forge-puertas-test-")));
after(() => rmSync(base, { recursive: true, force: true }));
let n = 0;

const PASA = `import {test} from "node:test"; import assert from "node:assert"; test("ok", () => assert.equal(1, 1));`;
const FALLA = `import {test} from "node:test"; import assert from "node:assert"; test("mal", () => assert.equal(1, 2));`;
const SALE = (/** @type {number} */ c) => `node -e "process.exit(${c})"`;

/** Proyecto de Node con pruebas y, si se da, la sección `puertas:` de .sdd/sdd.config.yaml. @param {string[]} [puertas] @param {string} [pruebas] */
function proyecto(puertas, pruebas = PASA) {
  const dir = join(base, `p${++n}`, "proyecto");
  mkdirSync(join(dir, "tests"), { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "demo", type: "module", scripts: { test: "node --test" } }));
  writeFileSync(join(dir, "tests", "a.test.js"), pruebas);
  if (puertas) {
    mkdirSync(join(dir, ".sdd"), { recursive: true });
    writeFileSync(join(dir, ".sdd", "sdd.config.yaml"), ["puertas:", ...puertas.map((l) => "  " + l)].join("\n") + "\n");
  }
  return dir;
}

/** @param {string} dir @param {string[]} args @param {Record<string, string>} [env] */
function verificar(dir, args, env = {}) {
  const temporal = join(dirname(dir), "tmp");
  mkdirSync(temporal, { recursive: true });
  const registro = join(dirname(dir), "docker.jsonl");
  const { NODE_TEST_CONTEXT: _o, ...heredado } = process.env;
  const r = spawnSync(process.execPath, [FIXTURE, "--cwd", dir, ...args], {
    encoding: "utf8", timeout: 120_000,
    env: { ...heredado, TEMP: temporal, TMP: temporal, TMPDIR: temporal, FALSO_REGISTRO: registro, FORGE_HOME: join(dirname(dir), "home"), ANTHROPIC_API_KEY: "", OPENAI_API_KEY: "", ...env },
  });
  const lineas = existsSync(registro) ? readFileSync(registro, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
  const runs = lineas.filter((l) => l.orden === "run");
  /** @type {any} */ let j = null;
  try { j = JSON.parse(r.stdout); } catch { /* salida de texto */ }
  return { codigo: r.status, salida: r.stdout, errores: r.stderr, runs, j };
}

describe("forge verificar con puertas: los veredictos", () => {
  test("una puerta que pasa: código 0, la puerta consta en el resultado y corrió tras las pruebas", () => {
    const dir = proyecto([`linter: ${SALE(0)}`]);
    const r = verificar(dir, ["--json"]);
    assert.equal(r.codigo, 0, r.salida + r.errores);
    assert.equal(r.j.veredicto, "pasa");
    assert.equal(r.j.formato, 1);
    assert.equal(r.runs.length, 2, "pruebas + una puerta");
    assert.equal(r.j.puertas.ejecutadas, true);
    assert.deepEqual(r.j.puertas.resultados.map((/** @type {any} */ x) => [x.nombre, x.categoria, x.codigoSalida]), [["linter", "pass", 0]]);
    assert.deepEqual(r.j.puertas.declaradas.map((/** @type {any} */ x) => x.nombre), ["linter"]);
  });

  test("una puerta que falla con las pruebas en verde: «falla» por esa puerta, código 1", () => {
    const dir = proyecto([`tipos: ${SALE(0)}`, `linter: ${SALE(3)}`]);
    const r = verificar(dir, ["--json"]);
    assert.equal(r.codigo, 1, r.salida + r.errores);
    assert.equal(r.j.veredicto, "falla");
    assert.equal(r.j.codigoPruebas, 0, "las pruebas pasaron");
    assert.match(r.j.motivo, /«linter»/);
    assert.deepEqual(r.j.puertas.resultados.map((/** @type {any} */ x) => x.categoria), ["pass", "fail"]);
    assert.equal(r.j.puertas.resultados[1].codigoSalida, 3);
  });

  test("herramienta ausente (127): «no ejecutable», no es éxito ni fallo de infraestructura", () => {
    const r = verificar(proyecto([`seguridad: ${SALE(127)}`]), ["--json"]);
    assert.equal(r.codigo, 1, r.salida + r.errores);
    assert.equal(r.j.veredicto, "falla");
    assert.equal(r.j.puertas.resultados[0].categoria, "no_ejecutable");
    assert.match(r.j.motivo, /no ejecutable/);
  });

  test("tiempo agotado: «falla» con la puerta en timeout", () => {
    const r = verificar(proyecto([`linter: node -e "agotar"`]), ["--json"], { FALSO_AGOTAR: "agotar" });
    assert.equal(r.codigo, 1, r.salida + r.errores);
    assert.equal(r.j.veredicto, "falla");
    assert.equal(r.j.puertas.resultados[0].categoria, "timeout");
  });

  test("fallo del aislamiento en una puerta (código 125): infraestructura, código 4", () => {
    const r = verificar(proyecto([`linter: ${SALE(125)}`]), ["--json"]);
    assert.equal(r.codigo, 4, r.salida + r.errores);
    assert.equal(r.j.veredicto, "infraestructura");
  });

  test("las puertas solo corren si las pruebas PASAN", () => {
    const r = verificar(proyecto([`linter: ${SALE(0)}`], FALLA), ["--json"]);
    assert.equal(r.codigo, 1);
    assert.equal(r.runs.length, 1, "solo las pruebas");
    assert.equal(r.j.puertas.ejecutadas, false);
    assert.deepEqual(r.j.puertas.resultados, []);
    assert.match(r.j.puertas.motivo, /pruebas no pasan/);
  });

  test("EN SERIE y en orden fijo aunque el archivo las declare al revés", () => {
    const dir = proyecto([`cobertura: ${SALE(0)}`, `seguridad: ${SALE(0)}`, `linter: ${SALE(0)}`, `tipos: ${SALE(0)}`]);
    const r = verificar(dir, ["--json"]);
    assert.equal(r.codigo, 0, r.salida + r.errores);
    const orden = r.runs.slice(1).map((/** @type {any} */ x) => /puerta-(\w+)-/.exec(x.nombre)?.[1]);
    assert.deepEqual(orden, ["tipos", "linter", "seguridad", "cobertura"]);
    assert.deepEqual(r.j.puertas.resultados.map((/** @type {any} */ x) => x.nombre), ["tipos", "linter", "seguridad", "cobertura"]);
  });

  test("la salida de la puerta se redacta (un secreto no sale en el JSON)", () => {
    const secreto = "sk-ant-api03-" + "Zq8kLm2xP9".repeat(5);
    const dir = proyecto([`seguridad: node -e "console.log('${secreto}'); process.exit(1)"`]);
    const r = verificar(dir, ["--json"]);
    assert.equal(r.codigo, 1);
    assert.ok(!r.salida.includes(secreto));
    assert.match(r.j.puertas.resultados[0].salida, /REDACTADO|\*\*\*|redact/i);
  });

  test("--comando cambia las pruebas, no las puertas: siguen exigiéndose", () => {
    const r = verificar(proyecto([`linter: ${SALE(2)}`]), ["--json", "--comando", "node --test"]);
    assert.equal(r.codigo, 1);
    assert.match(r.j.motivo, /«linter»/);
  });
});

describe("forge verificar con puertas: lo que NO se acepta (nada se ejecuta)", () => {
  /** @param {string[]} lineas @param {RegExp} patron */
  function rechaza(lineas, patron) {
    const r = verificar(proyecto(lineas), ["--json"]);
    assert.equal(r.codigo, 1, r.salida + r.errores);
    assert.equal(r.j.veredicto, "falla");
    assert.match(r.j.motivo, patron);
    assert.equal(r.runs.length, 0, "no se ejecutó nada");
    return r;
  }

  test("comando con operador de shell", () => { rechaza([`linter: eslint . && ls`], /línea 2.*operador de shell/); });
  test("clave desconocida", () => { rechaza([`tipos: ${SALE(0)}`, `pruebas: false`], /línea 3.*«pruebas»/); });
  test("`#` pegado al comando", () => { rechaza([`linter: node -e process.exit(0)#x`], /línea 2.*#/); });
  test("comilla sin cerrar", () => { rechaza([`linter: node -e "process.exit(0)`], /comilla/); });
  test("un intérprete de órdenes como comando", () => { rechaza([`linter: sh -c "exit 0 && exit 0"`], /intérprete/); });
  test("el proyecto no puede quitar ni aflojar una garantía fija", () => {
    for (const clave of ["pruebas", "red", "network", "rojo", "tope_usd", "runtime", "omitir_pruebas"]) rechaza([`${clave}: true`], /desconocida/);
  });

  test("con comilla final legítima el comando SÍ se ejecuta entero", () => {
    const r = verificar(proyecto([`tipos: node -e "process.exit(0)"`]), ["--json"]);
    assert.equal(r.codigo, 0, r.salida + r.errores);
    assert.equal(r.j.puertas.resultados[0].categoria, "pass");
  });

  test("el proyecto puede BAJAR un tope pero no subirlo", () => {
    const sube = verificar(proyecto([`tipos: ${SALE(0)}`, "timeout_s: 99999", "salida_max_bytes: 999999999"]), ["--json"]);
    assert.equal(sube.codigo, 0, sube.salida + sube.errores);
    assert.equal(sube.j.puertas.topes.timeout_s, 120);
    assert.equal(sube.j.puertas.topes.salida_max_bytes, 262144);
    assert.ok(sube.j.avisos.some((/** @type {string} */ a) => /no puede subir/.test(a)));
    const baja = verificar(proyecto([`tipos: ${SALE(0)}`, "timeout_s: 30"]), ["--json"]);
    assert.equal(baja.j.puertas.topes.timeout_s, 30);
  });

  test("el entorno del usuario fija los topes, con techo", () => {
    const r = verificar(proyecto([`tipos: ${SALE(0)}`]), ["--json"], { FRAGUA_PUERTAS_TIMEOUT_S: "5000", FRAGUA_PUERTAS_TIMEOUT_TOTAL_S: "40" });
    assert.equal(r.j.puertas.topes.timeout_s, 600);
    assert.equal(r.j.puertas.topes.timeout_total_s, 40);
  });

  test("no existe forma de saltarlas desde la línea de comandos", () => {
    const dir = proyecto([`linter: ${SALE(1)}`]);
    for (const opcion of ["--sin-puertas", "--no-puertas", "--puertas=no", "--omitir-puertas", "--sin-linter"]) {
      const r = verificar(dir, [opcion]);
      assert.equal(r.codigo, 1, opcion);
      assert.match(r.errores, /Opción desconocida/);
      assert.equal(r.runs.length, 0);
    }
    for (const [k, v] of [["FRAGUA_SIN_PUERTAS", "1"], ["FRAGUA_PUERTAS", "0"], ["FORGE_PUERTAS_DESACTIVAR", "1"]]) {
      const r = verificar(dir, ["--json"], { [k]: v });
      assert.equal(r.codigo, 1, k);
      assert.equal(r.j.veredicto, "falla");
    }
  });
});

describe("forge verificar sin puertas: igual que hoy (CA-001-04)", () => {
  test("sin sección no aparece `puertas` en el JSON y solo corren las pruebas", () => {
    const dir = proyecto();
    const antes = readdirSync(dir).sort();
    const r = verificar(dir, ["--json"]);
    assert.equal(r.codigo, 0, r.salida + r.errores);
    assert.ok(!("puertas" in r.j));
    assert.equal(r.runs.length, 1);
    assert.deepEqual(readdirSync(dir).sort(), antes);
  });

  test("sección vacía o solo con comentarios: lo mismo", () => {
    const dir = proyecto(["# nada por ahora"]);
    const r = verificar(dir, ["--json"]);
    assert.equal(r.codigo, 0);
    assert.ok(!("puertas" in r.j));
  });
});

describe("forge verificar con puertas: evidencia registrada", () => {
  test("--registrar guarda las puertas en el resultado y en el bloque `evidencia`, dentro del hash", () => {
    const dir = proyecto([`tipos: ${SALE(0)}`, `linter: ${SALE(0)}`]);
    const r = verificar(dir, ["--json", "--registrar"]);
    assert.equal(r.codigo, 0, r.salida + r.errores);
    const archivo = join(dir, r.j.registro.archivo);
    const informe = JSON.parse(readFileSync(archivo, "utf8"));
    assert.deepEqual(informe.puertas.resultados.map((/** @type {any} */ x) => x.nombre), ["tipos", "linter"]);
    assert.deepEqual(informe.evidencia.puertas.map((/** @type {any} */ x) => [x.nombre, x.categoria, x.codigoSalida]), [["tipos", "pass", 0], ["linter", "pass", 0]]);
    // Retocar una puerta del informe rompe la cadena
    const c = verificar(dir, ["--comprobar-evidencia", "--json"]);
    assert.equal(c.codigo, 0, c.salida + c.errores);
    informe.puertas.resultados[0].categoria = "fail";
    writeFileSync(archivo, JSON.stringify(informe, null, 2) + "\n");
    const roto = verificar(dir, ["--comprobar-evidencia", "--json"]);
    assert.equal(roto.codigo, 1, roto.salida);
  });
});
