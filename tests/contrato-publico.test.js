// @ts-check
/**
 * Contrato publico (spec 2026-10-14-contrato-publico): la suite FALLA si el codigo se aparta de los esquemas
 * de docs/contrato/, o si un esquema promete algo que el codigo ya no produce. Sin red; el Docker es el falso.
 */
import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { validar, comprobarEsquema } from "../core/contrato/validar.js";
import { crearResultado } from "../core/verificar/resultado.js";
import { estadoInicial, aplicar, validarEstado, CATEGORIAS, RESULTADOS, MOTIVOS } from "../core/ciclo/estado.js";
import { normalizarTareas } from "../core/tareas.js";
import { EventLog } from "../core/event-log.js";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE = join(RAIZ, "tests", "fixtures", "verificar-docker-falso.mjs");
const DIR_CONTRATO = join(RAIZ, "docs", "contrato");
const base = realpathSync(mkdtempSync(join(tmpdir(), "forge-contrato-")));
after(() => rmSync(base, { recursive: true, force: true }));

/** @param {string} nombre */
const esquema = (nombre) => JSON.parse(readFileSync(join(DIR_CONTRATO, `${nombre}.schema.json`), "utf8"));
const NOMBRES = ["resultado-verificar", "veredicto", "estado-ciclo", "estado-pipeline", "tarea", "tarea-entrada", "tarea-sdd", "evento"];

// ── Proyectos y ejecucion real de `forge verificar --json` con el Docker falso ────────────────────────────
const PASA = `import {test} from "node:test"; import assert from "node:assert"; test("ok", () => assert.equal(1, 1));`;
const FALLA = `import {test} from "node:test"; import assert from "node:assert"; test("mal", () => assert.equal(1, 2));`;
const FUENTE = ["export function suma(a, b) { return a + b; }", "export const LIMITE = 10;", "export function esGrande(n) { return n >= LIMITE; }", "export function mayor(a, b) { if (a > b) { return a; } return b; }", ""].join("\n");
const FUERTES = `import {test} from "node:test"; import assert from "node:assert";
import {suma, LIMITE, esGrande, mayor} from "../src/calc.js";
test("suma", () => { assert.equal(suma(2, 3), 5); assert.equal(suma(-1, 1), 0); });
test("limite", () => { assert.equal(LIMITE, 10); });
test("esGrande", () => { assert.equal(esGrande(10), true); assert.equal(esGrande(9), false); assert.equal(esGrande(11), true); });
test("mayor", () => { assert.equal(mayor(5, 2), 5); assert.equal(mayor(2, 5), 5); assert.equal(mayor(3, 3), 3); });
`;
const DEBILES = `import {test} from "node:test"; import assert from "node:assert";
import {suma, esGrande, mayor} from "../src/calc.js";
test("existe", () => { assert.equal(typeof suma, "function"); assert.equal(typeof esGrande, "function"); assert.equal(typeof mayor, "function"); });
`;
let n = 0;
/** @param {string} pruebas */
function proyecto(pruebas) {
  const dir = join(base, `p${++n}`, "proyecto");
  mkdirSync(join(dir, "tests"), { recursive: true });
  mkdirSync(join(dir, "src"), { recursive: true });
  mkdirSync(join(dir, ".sdd"), { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "demo", type: "module", scripts: { test: "node --test" } }));
  writeFileSync(join(dir, "src", "calc.js"), FUENTE);
  writeFileSync(join(dir, "tests", "calc.test.js"), pruebas);
  return dir;
}
/** @param {string} dir @param {string[]} args @param {Record<string, string>} [env] */
function verificarJson(dir, args, env = {}) {
  const temporal = join(dirname(dir), "tmp");
  mkdirSync(temporal, { recursive: true });
  const { NODE_TEST_CONTEXT: _o, ...heredado } = process.env;
  const r = spawnSync(process.execPath, [FIXTURE, "--cwd", dir, "--json", ...args], {
    encoding: "utf8", timeout: 240_000,
    env: { ...heredado, TEMP: temporal, TMP: temporal, TMPDIR: temporal, ANTHROPIC_API_KEY: "", OPENAI_API_KEY: "", ...env },
  });
  return { codigo: r.status, json: JSON.parse(r.stdout), bruto: r.stdout + r.stderr };
}

/** @type {Record<string, any>[]} */
const resultados = [];
/** @type {Record<string, any>[]} */
const registrados = [];
/** @type {Record<string, any>[]} */
const eventosRegistro = [];

describe("los esquemas son validos, versionados y estan dentro del subconjunto", () => {
  for (const nombre of NOMBRES) {
    test(nombre, () => {
      const e = esquema(nombre);
      comprobarEsquema(e);
      assert.match(e.$id, new RegExp(`^https://forge-sdd\\.dev/contrato/${nombre}/[0-9]+\\.[0-9]+$`));
    });
  }
  test("no hay esquemas de docs/contrato/ sin registrar en esta prueba", () => {
    const enDisco = readdirSync(DIR_CONTRATO).filter((f) => f.endsWith(".schema.json")).map((f) => f.replace(".schema.json", "")).sort();
    assert.deepEqual(enDisco, [...NOMBRES].sort());
  });
});

describe("resultado-verificar: la salida REAL de `forge verificar --json` valida", () => {
  const e = esquema("resultado-verificar");

  test("pasa, falla, sin_pruebas e infraestructura", () => {
    const casos = [
      ["pasa", verificarJson(proyecto(PASA), []), 0],
      ["falla", verificarJson(proyecto(FALLA), []), 1],
      ["sin_pruebas", verificarJson(proyecto(PASA), ["--comando", "python -m pytest"], { FALSO_CODIGO: "5" }), 1],
      ["infraestructura", verificarJson(proyecto(PASA), [], { FALSO_SIN_DOCKER: "1" }), 4],
    ];
    for (const [veredicto, r, codigo] of /** @type {any[]} */ (casos)) {
      assert.deepEqual(validar(e, r.json), [], `${veredicto}: ${r.bruto}`);
      assert.equal(r.json.veredicto, veredicto);
      assert.equal(r.json.codigoSalida, codigo);
      assert.equal(r.codigo, codigo, "el codigo de proceso coincide con codigoSalida");
      resultados.push(r.json);
    }
  });

  test("con --mutacion (pruebas fuertes y debiles) y con --registrar", () => {
    const dir = proyecto(FUERTES);
    const fuerte = verificarJson(dir, ["--mutacion", "--archivos", "src/calc.js", "--mutacion-minima", "0.6", "--registrar"], { FORGE_HOME: join(base, "home-evidencia") });
    assert.deepEqual(validar(e, fuerte.json), [], fuerte.bruto);
    assert.ok(fuerte.json.mutacion && fuerte.json.registro?.archivo, fuerte.bruto);
    resultados.push(fuerte.json);
    const debil = verificarJson(proyecto(DEBILES), ["--mutacion", "--archivos", "src/calc.js"]);
    assert.deepEqual(validar(e, debil.json), [], debil.bruto);
    assert.ok(debil.json.mutacion.sobrevivientes.length > 0);
    resultados.push(debil.json);
    // El archivo guardado lleva ademas `id` en la raiz; el evento va a .sdd/events.jsonl
    const guardado = JSON.parse(readFileSync(join(dir, fuerte.json.registro.archivo), "utf8"));
    assert.deepEqual(validar(e, guardado), [], "el archivo registrado");
    registrados.push(guardado);
    for (const l of readFileSync(join(dir, ".sdd", "events.jsonl"), "utf8").split("\n").filter(Boolean)) eventosRegistro.push(JSON.parse(l));
  });

  test("con puertas declaradas (bloque opcional 1.2): pasa, falla, sin ejecutar y registrado", () => {
    const conPuertas = (/** @type {string[]} */ lineas, /** @type {string} */ pruebas) => {
      const d = proyecto(pruebas);
      writeFileSync(join(d, ".sdd", "sdd.config.yaml"), ["puertas:", ...lineas.map((l) => "  " + l)].join("\n") + "\n");
      return d;
    };
    const SALE = (/** @type {number} */ c) => `node -e "process.exit(${c})"`;
    const dir = conPuertas([`tipos: ${SALE(0)}`, `linter: ${SALE(0)}`], PASA);
    const ok = verificarJson(dir, ["--registrar"], { FORGE_HOME: join(base, "home-puertas") });
    assert.deepEqual(validar(e, ok.json), [], ok.bruto);
    assert.equal(ok.codigo, 0, ok.bruto);
    assert.equal(ok.json.puertas.resultados.length, 2);
    resultados.push(ok.json);
    const guardado = JSON.parse(readFileSync(join(dir, ok.json.registro.archivo), "utf8"));
    assert.deepEqual(validar(e, guardado), [], "el archivo registrado con puertas");
    assert.equal(guardado.evidencia.puertas.length, 2);
    registrados.push(guardado);
    const rota = verificarJson(conPuertas([`seguridad: ${SALE(127)}`], PASA), []);
    assert.deepEqual(validar(e, rota.json), [], rota.bruto);
    assert.equal(rota.codigo, 1);
    assert.equal(rota.json.puertas.resultados[0].categoria, "no_ejecutable");
    resultados.push(rota.json);
    const sinEjecutar = verificarJson(conPuertas([`tipos: ${SALE(0)}`], FALLA), []);
    assert.deepEqual(validar(e, sinEjecutar.json), [], sinEjecutar.bruto);
    assert.equal(sinEjecutar.json.puertas.ejecutadas, false);
    resultados.push(sinEjecutar.json);
  });

  test("crearResultado de cada veredicto valida (sin proceso hijo)", () => {
    for (const veredicto of ["pasa", "falla", "sin_pruebas", "infraestructura"]) {
      assert.deepEqual(validar(e, crearResultado({ veredicto: /** @type {any} */ (veredicto) })), [], veredicto);
    }
  });

  test("inversa: toda propiedad opcional del esquema aparece en algun artefacto real", () => {
    const muestras = [...resultados, ...registrados];
    // No son reproducibles sin provocar fallos del disco o rechazos de archivos: se comprueban por su forma
    const excepciones = new Set(["$.registro.error", "$.mutacion.rechazadas[].ruta", "$.mutacion.rechazadas[].motivo"]);
    const sinVer = propiedadesSinVer(e, muestras, "$").filter((p) => !excepciones.has(p));
    assert.deepEqual(sinVer, [], "propiedades del esquema que el codigo ya no produce (o que ninguna muestra cubre)");
  });

  test("todo campo real esta en el esquema o marcado interno (un campo nuevo se detecta)", () => {
    const real = resultados[0];
    assert.deepEqual(validar(e, { ...real, traza: [] }), ["$: campo adicional traza"]);
    const m = resultados.find((r) => r.mutacion);
    assert.deepEqual(validar(e, { ...m, mutacion: { ...m?.mutacion, nuevo: 1 } }), ["$.mutacion: campo adicional nuevo"]);
    const { codigoSalida: _c, ...sin } = real;
    assert.match(validar(e, sin).join("|"), /codigoSalida: falta/);
    assert.match(validar(e, { ...real, veredicto: "pass" }).join("|"), /veredicto: fuera de enum/);
    assert.match(validar(e, { ...real, duracionMs: "1" }).join("|"), /duracionMs/);
    assert.match(validar(e, { ...real, formato: 2 }).join("|"), /formato/);
  });
});

describe("veredicto: vocabulario y mapa documentado", () => {
  const e = esquema("veredicto");
  test("los cuatro valores y ninguno mas", () => {
    for (const v of ["pasa", "falla", "sin_pruebas", "infraestructura"]) assert.deepEqual(validar(e, v), []);
    for (const v of ["pass", "fail", "timeout", "exito", ""]) assert.equal(validar(e, v).length, 1, v);
  });
  test("el mapa coincide con el codigo", () => {
    const mapa = e["x-mapa"];
    for (const [v, c] of Object.entries(mapa.veredicto_a_codigo_de_proceso)) {
      assert.equal(crearResultado({ veredicto: /** @type {any} */ (v) }).codigoSalida, c, v);
    }
    assert.deepEqual(Object.keys(mapa.categoria_del_ciclo_a_veredicto_aproximado).sort(), [...CATEGORIAS].sort());
    for (const v of Object.values(mapa.categoria_del_ciclo_a_veredicto_aproximado)) assert.deepEqual(validar(e, v), []);
  });
});

describe("estado-ciclo y tarea", () => {
  const e = esquema("estado-ciclo");
  const tarea = { id: "T1", agente: "desarrollador-backend", prompt: "Implementa suma", archivos: ["src/suma.js"], cubre_cas: ["CA-001-01"], criterioCmd: "npm test", parte_de_codigo_existente: true };
  const base0 = estadoInicial(tarea, { runId: "r1", cwd: "/tmp/p" });
  const hash = "a".repeat(64);

  test("el estado inicial real valida, y tambien con los opcionales y tras cada categoria", () => {
    assert.deepEqual(validar(e, base0), []);
    assert.deepEqual(validarEstado(base0), []);
    let s = base0;
    for (const categoria of CATEGORIAS) {
      s = aplicar(s, { iteracion: s.iteracion + 1, ejecuciones: [{ iteracion: s.iteracion + 1, categoria, exitCode: categoria === "pass" ? 0 : 1, timedOut: categoria === "timeout", oomKilled: false, durationMs: 5, stdoutCola: "", stderrCola: "", huellaSalida: hash, ...(categoria === "pass" ? { sospecha: ["x"] } : {}) }] });
      assert.deepEqual(validar(e, s), [], categoria);
      assert.deepEqual(validarEstado(s), []);
    }
    const lleno = { ...s,
      plan: { pasos: ["a"], archivosObjetivo: ["src/a.js"] },
      pruebas: { archivos: [{ ruta: "tests/a.test.js", sha256: hash }], comando: "npm test" },
      implementacion: { archivos: [{ ruta: "src/a.js", sha256: hash }] },
      rojo: { estado: "fallan", reintentado: false },
      mutacion: { probadas: 3, detectadas: 2, puntuacion: 0.66, parcial: false, sobrevivientes: [], refuerzos: 0 },
      revision: { motivo: "iteraciones", reanudarEn: "implementar", detalle: "d", decision: "aceptar", ts: "2026-10-17T00:00:00.000Z" },
      implementador: "turnos", turnos: 2, resultado: "revision_pendiente" };
    assert.deepEqual(validar(e, lleno), []);
    assert.deepEqual(validarEstado(lleno), []);
  });

  test("las listas de valores del esquema coinciden con las del codigo", () => {
    assert.deepEqual(e.properties.resultado.enum, RESULTADOS);
    assert.deepEqual(e.properties.revision.properties.motivo.enum, MOTIVOS);
    assert.deepEqual(e.properties.ejecuciones.items.properties.categoria.enum, CATEGORIAS);
  });

  test("un campo nuevo sin clasificar, una version desconocida y una categoria nueva se detectan", () => {
    assert.deepEqual(validar(e, { ...base0, traza: 1 }), ["$: campo adicional traza"]);
    assert.match(validar(e, { ...base0, schemaVersion: "2.0" }).join("|"), /schemaVersion/);
    assert.match(validar(e, { ...base0, resultado: "quizas" }).join("|"), /resultado/);
    assert.match(validar(e, { ...base0, tarea: { ...base0.tarea, extra: 1 } }).join("|"), /campo adicional extra/);
  });

  test("inversa: cada propiedad de primer nivel obligatoria la produce estadoInicial", () => {
    for (const r of e.required) assert.ok(r in base0, r);
    for (const k of Object.keys(base0)) assert.ok(k in e.properties, `campo real sin clasificar: ${k}`);
  });

  test("tarea normalizada valida en las tres variantes", () => {
    const t = esquema("tarea");
    assert.deepEqual(validar(t, base0.tarea), []);
    assert.deepEqual(validar(t, estadoInicial({ id: "T2", agente: "a", descripcion: "d" }, { runId: "r", cwd: "/x" }).tarea), []);
    assert.match(validar(t, { ...base0.tarea, prompt: "x" }).join("|"), /campo adicional prompt/);
  });

  test("las dos formas de entrada de tarea validan", () => {
    const motor = normalizarTareas({ tareas: [{ id: "T1", agente: "a", prompt: "p", dependencias: [] }] });
    for (const x of motor) assert.deepEqual(validar(esquema("tarea-entrada"), x), []);
    const sdd = { tareas: { T001: { estado: "pendiente", agente: "a", depende_de: [], cubre_cas: ["CA-1"] } } };
    assert.deepEqual(validar(esquema("tarea-sdd"), sdd), []);
    for (const x0 of normalizarTareas(sdd, "## T001 — Algo\ntexto\n")) {
      const x = JSON.parse(JSON.stringify(x0)); // el artefacto es el JSON: `modelo: undefined` no existe en disco
      assert.deepEqual(validar(esquema("tarea-entrada"), x), []);
      assert.ok(["id", "agente", "prompt", "dependencias", "cubre_cas"].every((c) => c in x));
    }
    assert.match(validar(esquema("tarea-entrada"), { agente: "a" }).join("|"), /id: falta/);
  });
});

describe("estado-pipeline: el .sdd/estado.json REAL del repositorio valida", () => {
  test("decision con evidencia: el real no tiene schemaVersion; core/schemas/estado.schema.json (que lo exige) no lo valida", () => {
    const real = JSON.parse(readFileSync(join(RAIZ, ".sdd", "estado.json"), "utf8"));
    assert.deepEqual(validar(esquema("estado-pipeline"), real), []);
    assert.equal("schemaVersion" in real, false, "si ya lo lleva, revisa docs/contrato/LEEME.md");
    const viejo = JSON.parse(readFileSync(join(RAIZ, "core", "schemas", "estado.schema.json"), "utf8"));
    assert.ok(viejo.required.includes("schemaVersion"), "hallazgo documentado: el esquema antiguo exige un campo que el archivo real no tiene");
    assert.match(validar(esquema("estado-pipeline"), { ...real, pipeline_step: "volar" }).join("|"), /pipeline_step/);
  });
});

describe("evento: el sobre y los dos archivos", () => {
  const e = esquema("evento");
  const tipos = JSON.parse(readFileSync(join(DIR_CONTRATO, "tipos-evento.json"), "utf8"));

  test("un evento real de EventLog.append de cada tipo declarado valida", () => {
    const dir = mkdtempSync(join(base, "ev-"));
    const log = new EventLog(dir);
    for (const t of Object.keys(tipos.tipos).filter((x) => x !== "verificar:resultado")) {
      const ev = log.append(/** @type {any} */ (t), { cualquier: { cosa: 1 } }, { taskId: "T1", agent: "a" });
      assert.deepEqual(validar(e, ev), [], t);
    }
    const leidos = log.readAll();
    assert.equal(leidos.length, Object.keys(tipos.tipos).length - 1);
    for (const l of leidos) assert.deepEqual(validar(e, l), []);
  });

  test("el evento verificar:resultado REAL (escrito a mano, id distinto) valida", () => {
    const ev = eventosRegistro.find((x) => x.type === "verificar:resultado");
    assert.ok(ev, "se registro un evento");
    assert.deepEqual(validar(e, ev), []);
    for (const c of tipos.tipos["verificar:resultado"].payload) assert.ok(c in ev.payload, c);
  });

  test("el payload es libre; el sobre no admite campos nuevos ni tipos mal formados", () => {
    const ok = { id: "1-1", type: "custom", ts: "2026-10-17T00:00:00.000Z", payload: {} };
    assert.deepEqual(validar(e, { ...ok, payload: { a: { b: [1] } } }), []);
    assert.match(validar(e, { ...ok, extra: 1 }).join("|"), /campo adicional extra/);
    assert.match(validar(e, { ...ok, type: "Tipo Raro" }).join("|"), /patrón/);
    assert.match(validar(e, { id: "1", type: "custom", ts: "x" }).join("|"), /payload: falta/);
  });

  test("todo tipo que el codigo emite esta declarado en tipos-evento.json y en el typedef (los 3 que faltaban)", () => {
    const fuente = readFileSync(join(RAIZ, "core", "event-log.js"), "utf8");
    const typedef = /@typedef \{([^}]*)\} EventType/.exec(fuente)?.[1] ?? "";
    const enTypedef = new Set([...typedef.matchAll(/'([^']+)'/g)].map((m) => m[1]));
    const emitidos = new Set(["ciclo:llamada_huerfana", "ciclo:consumo_estimado", "verificar:resultado"]);
    for (const dirBase of ["core", "cli"]) for (const f of listar(join(RAIZ, dirBase))) {
      const txt = readFileSync(f, "utf8");
      for (const m of txt.matchAll(/\.append\(\s*'([a-z_]+(?::[a-z_]+)?)'/g)) emitidos.add(m[1]);
      for (const m of txt.matchAll(/type:\s*'(verificar:[a-z_]+)'/g)) emitidos.add(m[1]);
    }
    for (const t of emitidos) {
      assert.ok(t in tipos.tipos, `tipo emitido sin declarar en docs/contrato/tipos-evento.json: ${t}`);
      assert.ok(enTypedef.has(t), `tipo emitido sin declarar en el typedef EventType: ${t}`);
    }
    for (const t of enTypedef) assert.ok(t in tipos.tipos, `typedef sin declarar en tipos-evento.json: ${t}`);
    assert.deepEqual(Object.keys(tipos.archivos).sort(), ["observabilidad", "principal"]);
  });
});

describe("copia congelada: un esquema publicado no cambia sin subir su version", () => {
  test("cada esquema es identico a tests/fixtures/contrato/v1/ o lleva otro $id", () => {
    const dirCongelado = join(RAIZ, "tests", "fixtures", "contrato", "v1");
    for (const nombre of NOMBRES) {
      const actual = esquema(nombre);
      const rutaCongelada = join(dirCongelado, `${nombre}.schema.json`);
      assert.ok(existsSync(rutaCongelada), `falta la copia congelada de ${nombre}`);
      const congelado = JSON.parse(readFileSync(rutaCongelada, "utf8"));
      if (actual.$id === congelado.$id) assert.deepEqual(actual, congelado, `${nombre} cambio sin subir la version de $id (y sin congelar la nueva: ver docs/contrato/LEEME.md)`);
    }
  });
});

/** @param {string} dir @returns {string[]} */
function listar(dir) {
  /** @type {string[]} */
  const out = [];
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    if (d.name === "node_modules") continue;
    const p = join(dir, d.name);
    if (d.isDirectory()) out.push(...listar(p));
    else if (d.name.endsWith(".js")) out.push(p);
  }
  return out;
}

/**
 * Propiedades declaradas en el esquema que ninguna muestra contiene (recursivo por objetos y listas).
 * @param {any} s @param {any[]} muestras @param {string} ruta @returns {string[]}
 */
function propiedadesSinVer(s, muestras, ruta) {
  /** @type {string[]} */
  const faltan = [];
  const objetos = muestras.filter((m) => m !== null && typeof m === "object" && !Array.isArray(m));
  for (const [k, sub] of Object.entries(s.properties ?? {})) {
    const valores = objetos.filter((o) => k in o).map((o) => o[k]);
    if (valores.length === 0) { faltan.push(`${ruta}.${k}`); continue; }
    faltan.push(...propiedadesSinVer(sub, valores, `${ruta}.${k}`));
  }
  if (s.items) {
    const elementos = muestras.filter(Array.isArray).flat();
    if (elementos.length > 0) faltan.push(...propiedadesSinVer(s.items, elementos, `${ruta}[]`));
  }
  return faltan;
}
