// @ts-check
/**
 * Regresión de la tercera pasada de revisiones independientes (verificación y
 * seguridad, 2026-10-03). Cada test reproduce una entrada que se demostró dañina.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

import { clasificarRuta, validarRuta } from "../core/ciclo/protocolo-archivos.js";
import { Respaldo } from "../core/ciclo/respaldo.js";
import { cola, redactar } from "../core/ciclo/redactar.js";
import { claveDe } from "../core/ciclo/diario.js";
import { CicloVerificado, tareasSinTerminarEnElProyecto } from "../core/ciclo/index.js";
import { GuardadorArchivos } from "../core/ciclo/checkpoint-archivos.js";
import { estadoInicial } from "../core/ciclo/estado.js";
import { POR_DEFECTO } from "../core/ciclo/config.js";
import { recuperarPorArchivos } from "../core/recuperacion/recuperador-archivos.js";
import { SandboxRunner } from "../core/sandbox/sandbox-runner.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tmp = (p) => mkdtempSync(join(tmpdir(), p));
const escribir = (dir, ruta, contenido) => { mkdirSync(join(dir, ruta, ".."), { recursive: true }); writeFileSync(join(dir, ruta), contenido); };

describe("NUEVO-6 — la salida de las pruebas no puede bloquear el proceso al redactarla", () => {
  test("una línea de 1 MiB de caracteres de palabra se procesa en menos de 2 segundos", () => {
    const t0 = Date.now();
    const salida = cola("a".repeat(1024 * 1024));
    assert.ok(Date.now() - t0 < 2000, `tardó ${Date.now() - t0} ms`);
    assert.ok(salida.length <= 8192);
  });

  test("redactar sigue ocultando los valores con un nombre largo delante y con prefijos acotados", () => {
    const t0 = Date.now();
    redactar("x".repeat(200_000));
    assert.ok(Date.now() - t0 < 3000, `redactar tardó ${Date.now() - t0} ms`);
    assert.match(redactar("DB_PASSWORD=hunter2hunter2"), /REDACTADO/);
    assert.match(redactar('{"api_key": "abcdefgh"}'), /REDACTADO/);
  });

  test("un secreto al final de una salida enorme sigue redactado", () => {
    const salida = cola("ruido\n".repeat(100_000) + "TOKEN=supersecreto123\n");
    assert.ok(!salida.includes("supersecreto123"));
  });
});

describe("NUEVO-2 — credenciales de uso habitual no se leen ni se copian", () => {
  test("los nombres habituales están vetados y el código con nombre parecido no", () => {
    for (const ruta of [".pgpass", "a/.vault-token", ".dockercfg", ".boto", ".s3cfg", ".bash_history", "kubeconfig", "auth.json", "apikey.txt", "my_token.txt", "wallet.json", "firebase-adminsdk.json"]) {
      assert.equal(clasificarRuta(ruta), "ruta_vetada", ruta);
    }
    for (const ruta of ["src/tokenizer.js", "src/password.js", "src/auth/login.js", "lib/wallet.ts"]) {
      assert.equal(clasificarRuta(ruta), null, ruta);
    }
  });

  test("el recuperador no devuelve esos archivos aunque el planificador los pida", () => {
    const dir = tmp("forge-t3-");
    escribir(dir, ".pgpass", "host:5432:db:user:CLAVE-SECRETA");
    escribir(dir, "src/a.js", "export const a = 1;");
    const r = recuperarPorArchivos({ cwd: dir, tarea: { archivos: [".pgpass", "src/a.js"] }, plan: { archivosObjetivo: ["my_token.txt"] }, maxBytes: 10_000 });
    assert.ok(!r.texto.includes("CLAVE-SECRETA"));
    assert.ok(r.texto.includes("export const a"));
  });
});

describe("NUEVO-3 — un enlace de directorio no sirve para leer ni escribir lo vetado", () => {
  /** @param {string} dir */
  const enlazar = (dir, destino, nombre) => {
    try { symlinkSync(join(dir, destino), join(dir, nombre), "junction"); return true; } catch { return false; }
  };

  test("pub -> secrets: pub/app.config.json y pub/Makefile se rechazan como vetados, no como configuración", (t) => {
    const dir = tmp("forge-t3-");
    escribir(dir, "secrets/app.config.json", '{"db":"PASSWORD-DE-SECRETS"}');
    escribir(dir, "secrets/Makefile", "TOKEN=abc");
    if (!enlazar(dir, "secrets", "pub")) return t.skip("no se pueden crear enlaces de directorio aquí");
    for (const ruta of ["pub/app.config.json", "pub/Makefile"]) {
      assert.equal(/** @type {any} */ (validarRuta(dir, ruta)).motivo, "ruta_vetada", ruta);
    }
  });

  test("y el recuperador no los lee", (t) => {
    const dir = tmp("forge-t3-");
    escribir(dir, "secrets/app.config.json", '{"db":"PASSWORD-DE-SECRETS"}');
    if (!enlazar(dir, "secrets", "pub")) return t.skip("no se pueden crear enlaces de directorio aquí");
    const r = recuperarPorArchivos({ cwd: dir, tarea: { archivos: ["pub/app.config.json"] }, plan: {}, maxBytes: 10_000 });
    assert.ok(!r.texto.includes("PASSWORD-DE-SECRETS"));
  });
});

describe("NUEVO-4 — el manifiesto del respaldo no se obedece sin validar", () => {
  test("una ruta que sale del proyecto invalida el manifiesto: no se borra ni se escribe nada fuera", () => {
    const base = tmp("forge-t3-");
    const cwd = join(base, "proyecto");
    mkdirSync(cwd);
    writeFileSync(join(base, "victima.txt"), "no me toques");
    const dirResp = join(base, "resp");
    mkdirSync(dirResp);
    writeFileSync(join(dirResp, "manifiesto.json"), JSON.stringify({ entradas: [{ ruta: "../victima.txt", existia: false }] }));
    assert.throws(() => new Respaldo(cwd, dirResp), /Manifiesto de respaldo inválido|invalido/);
    assert.equal(readFileSync(join(base, "victima.txt"), "utf8"), "no me toques");
  });

  test("tampoco rutas absolutas ni entradas mal formadas", () => {
    const base = tmp("forge-t3-");
    const cwd = join(base, "p");
    mkdirSync(cwd);
    for (const entrada of [{ ruta: join(base, "x.txt"), existia: false }, { ruta: "a.txt", existia: "si" }, { ruta: "", existia: false }, null]) {
      const dirResp = mkdtempSync(join(base, "r-"));
      writeFileSync(join(dirResp, "manifiesto.json"), JSON.stringify({ entradas: [entrada] }));
      assert.throws(() => new Respaldo(cwd, dirResp), /anifiesto/);
    }
  });

  test("un manifiesto propio con rutas normales sigue funcionando", () => {
    const base = tmp("forge-t3-");
    const cwd = join(base, "p");
    escribir(cwd, "src/a.js", "original");
    const r = new Respaldo(cwd, join(base, "resp"));
    r.registrar("src/a.js");
    writeFileSync(join(cwd, "src", "a.js"), "cambiado");
    assert.deepEqual(new Respaldo(cwd, join(base, "resp")).restaurar().restaurados, ["src/a.js"]);
    assert.equal(readFileSync(join(cwd, "src", "a.js"), "utf8"), "original");
  });
});

describe("NUEVO-5 — la copia de trabajo no reutiliza el nombre entre procesos", () => {
  test("dos ejecutores nuevos sobre la misma sesión eligen carpetas distintas", async () => {
    const dir = tmp("forge-t3-");
    const usadas = [];
    const cli = {
      disponible: async () => ({ ok: true, version: "x" }),
      run: async (argv) => { usadas.push(argv.find((a) => String(a).includes("staging")) ?? ""); return { exitCode: 0, stdout: "", stderr: "", timedOut: false, durationMs: 1 }; },
      barrer: async () => 0,
    };
    escribir(dir, "package.json", "{}");
    for (let i = 0; i < 2; i++) {
      const sbx = new SandboxRunner({ dirMotor: join(dir, ".sdd", "motor", "r1"), runId: "r1", lenguaje: "javascript", testCmd: "npm test", cli: /** @type {any} */ (cli), imagenBase: "node:20-alpine" });
      try { await sbx.test(dir); } catch { /* sin Docker real la imagen no se prepara: no importa aquí */ }
    }
    // Si la imagen no se pudo preparar no hay copia: el test solo exige que, cuando la hay, los nombres no coincidan
    assert.equal(new Set(usadas).size, usadas.length);
  });
});

describe("NUEVO-7 — LangGraph no envía el estado a LangSmith", () => {
  test("al cargarlo se desactiva el trazado y se borra el destino", async (t) => {
    process.env.LANGSMITH_TRACING = "true";
    process.env.LANGSMITH_ENDPOINT = "http://127.0.0.1:9";
    try {
      const { cargar } = await import("../core/ciclo/motores/langgraph.js");
      try { await cargar(); } catch { /* no instalado: el trazado debe quedar apagado igualmente */ }
      assert.equal(process.env.LANGSMITH_TRACING, "false");
      assert.equal(process.env.LANGSMITH_ENDPOINT, undefined);
    } finally {
      delete process.env.LANGSMITH_TRACING; delete process.env.LANGSMITH_ENDPOINT;
    }
  });
});

// ── Reanudación ──────────────────────────────────────────────────────────────

const json = (o) => "```json\n" + JSON.stringify(o) + "\n```";
const PLAN = json({ pasos: [], archivosObjetivo: ["src/suma.js"] });
const PRUEBAS = json({ archivos: [{ ruta: "tests/suma.test.js", contenido: "// prueba" }] });
const impl = (v) => json({ archivos: [{ ruta: "src/suma.js", contenido: `// v${v}` }] });
const TAREA = { id: "T1", agente: "desarrollador-backend", prompt: "Implementa suma", archivos: ["src/suma.js"] };

function entorno({ uso, config = {}, ejecuciones = [] }) {
  const cwd = tmp("forge-t3-motor-");
  escribir(cwd, "src/suma.js", "// original");
  const guion = { arquitecto: [PLAN, PLAN], tester: [PRUEBAS, PRUEBAS], "desarrollador-backend": [impl(1)] };
  const cuerpo = [...ejecuciones];
  const llamadas = [];
  const opciones = {
    cwd, runId: "r1", testCmd: "npm test",
    config: { ...POR_DEFECTO, ...config, motor: { ...POR_DEFECTO.motor, grafo: "propio" }, presupuesto: { ...POR_DEFECTO.presupuesto, ...config.presupuesto } },
    log: { append: () => {} },
    aliasDe: () => "sonnet",
    llamar: async (p) => {
      llamadas.push(p);
      const s = guion[p.agente]?.shift();
      if (s === undefined) throw new Error(`guion agotado para ${p.agente}`);
      return { ok: true, output: s, ...uso };
    },
    runner: { test: async () => {
      const r = cuerpo.shift();
      if (r === undefined) throw new Error("guion de ejecuciones agotado");
      return { stdout: "# pass 1\n", stderr: "", timedOut: false, infraError: false, durationMs: 1, ...r };
    } },
  };
  return { cwd, opciones, llamadas, cuerpo, ciclo: () => new CicloVerificado(/** @type {any} */ (opciones)) };
}

describe("N1 y N2 — una respuesta ya pagada no se paga de nuevo", () => {
  test("N1: si la respuesta cruza el umbral de degradación, tras el corte no se repite la llamada", async () => {
    // Cada llamada cuesta 0,03; con umbral 0,05 la segunda (tester) cruza al estado degradado
    const uso = { inputTokens: 10_000, outputTokens: 0, modelo: "claude-sonnet-4-6", proveedor: "anthropic" };
    const e = entorno({ uso, config: { presupuesto: { tope_usd: 2, umbral_degradacion_usd: 0.05 } } });
    await assert.rejects(e.ciclo().ejecutar(TAREA), /guion de ejecuciones agotado/);
    assert.deepEqual(e.llamadas.map((l) => l.agente), ["arquitecto", "tester"]);

    e.cuerpo.push({ exitCode: 1 }, { exitCode: 0 });
    const r = await e.ciclo().ejecutar(TAREA);
    assert.equal(r.status, "completada");
    assert.deepEqual(e.llamadas.map((l) => l.agente), ["arquitecto", "tester", "desarrollador-backend"], "el tester no se pagó dos veces");
  });

  test("N2: la respuesta que agotó el tope se usa tras el corte en lugar de descartarse", async () => {
    // Tope 0,06: planner (0,03) + tester (0,03) lo agotan justo con la respuesta del tester
    const uso = { inputTokens: 10_000, outputTokens: 0, modelo: "claude-sonnet-4-6", proveedor: "anthropic" };
    const e = entorno({ uso, config: { presupuesto: { tope_usd: 0.06, umbral_degradacion_usd: 0.05 } } });
    await assert.rejects(e.ciclo().ejecutar(TAREA), /guion de ejecuciones agotado/);
    assert.deepEqual(e.llamadas.map((l) => l.agente), ["arquitecto", "tester"]);

    e.cuerpo.push({ exitCode: 1 });
    const r = await e.ciclo().ejecutar(TAREA);
    // El tester ya estaba pagado: se aplica. Lo siguiente (coder) sí necesita presupuesto y pide revisión
    assert.equal(e.llamadas.filter((l) => l.agente === "tester").length, 1, "el tester no se repitió");
    assert.equal(r.status, "en_revision");
    assert.equal(r.estado.revision?.motivo, "presupuesto");
    assert.ok(existsSync(join(e.cwd, "tests", "suma.test.js")), "las pruebas pagadas quedaron escritas");
  });

  test("la clave del diario no depende del modelo con el que se pidió", () => {
    assert.equal(
      claveDe({ agente: "tester", userPrompt: "x" }),
      claveDe(/** @type {any} */ ({ agente: "tester", modeloAlias: "haiku", proveedorLocal: true, userPrompt: "x" })),
    );
  });
});

// ── CLI ──────────────────────────────────────────────────────────────────────

describe("NUEVO-1 y N8 — el modo clásico no ejecuta código del modelo; las decisiones no se aplican a ciegas", () => {
  const CLI = join(ROOT, "cli", "index.js");
  const forge = (dir, args) => spawnSync(process.execPath, [CLI, ...args], {
    cwd: dir, encoding: "utf8", env: { ...process.env, FORGE_LLM_PROVIDER: "stub", ANTHROPIC_API_KEY: "" },
  });

  function proyecto() {
    const dir = tmp("forge-t3-cli-");
    mkdirSync(join(dir, ".sdd"), { recursive: true });
    writeFileSync(join(dir, ".sdd", "estado.json"), JSON.stringify({ pipeline_step: "code" }));
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "demo", scripts: { test: "node -e \"require('fs').writeFileSync('PWNED_HOST.txt','x')\"" } }));
    writeFileSync(join(dir, "tareas.json"), JSON.stringify([{ id: "T1", agente: "arquitecto", prompt: "x" }]));
    return dir;
  }

  /** Deja T1 pausada en la sesión `runId`. */
  function pausar(dir, runId) {
    const g = new GuardadorArchivos(join(dir, ".sdd", "motor", runId));
    const e = estadoInicial({ id: "T1", agente: "arquitecto" }, { runId, cwd: dir });
    g.guardar(`${runId}:T1`, { nodo: "coder", siguiente: "revision_humana", estado: { ...e, resultado: "revision_pendiente", revision: { motivo: "iteraciones", reanudarEn: "coder" } } });
  }

  test("una sesión nueva no borra la memoria de una tarea pausada en otra anterior", () => {
    const dir = proyecto();
    pausar(dir, "run-vieja-1");
    // Una sesión posterior, vacía, es la que figura como actual
    mkdirSync(join(dir, ".sdd", "motor", "run-nueva-2"), { recursive: true });
    writeFileSync(join(dir, ".sdd", "motor", "sesion.json"), JSON.stringify({ runId: "run-nueva-2", modo: "ciclo", creada: "2026-01-02T00:00:00Z" }));

    assert.deepEqual(tareasSinTerminarEnElProyecto(dir), ["T1"]);
    const r = forge(dir, ["run", "--tasks", "tareas.json"]);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stderr, /sin terminar \(T1\)/);
    assert.ok(!existsSync(join(dir, "PWNED_HOST.txt")), "no se ejecutó npm test en el anfitrión");
  });

  test("N8: --decision sin ninguna tarea en revisión se rechaza en lugar de ignorarse", () => {
    const dir = proyecto();
    writeFileSync(join(dir, ".sdd", "events.jsonl"), JSON.stringify({ id: "0", type: "task_failed", ts: new Date().toISOString(), taskId: "T1", payload: { error: "x" } }) + "\n");
    const r = forge(dir, ["resume", "--decision", "abortar"]);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stderr, /ninguna tarea esperando una decisión/);
  });

  test("N8: --tarea sin valor se rechaza (antes valía para todas las pausadas, incluida abortar)", () => {
    const dir = proyecto();
    writeFileSync(join(dir, ".sdd", "estado-tareas.json"), JSON.stringify({ tareas: [{ id: "T1", agente: "arquitecto", prompt: "x" }] }));
    const lineas = [["task_started", {}], ["task_paused", { motivo: "iteraciones" }]]
      .map(([type, payload], i) => JSON.stringify({ id: `${i}`, type, ts: new Date().toISOString(), taskId: "T1", payload }));
    writeFileSync(join(dir, ".sdd", "events.jsonl"), lineas.join("\n") + "\n");
    const r = forge(dir, ["resume", "--decision", "abortar", "--tarea"]);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stderr, /--tarea necesita el identificador/);
  });
});

// ── Candado con varios procesos ─────────────────────────────────────────────

describe("NUEVO-8 — un candado huérfano lo toma un único proceso aunque compitan tres", () => {
  const modulo = pathToFileURL(join(ROOT, "core", "ciclo", "candado.js")).href;
  /** Cada proceso intenta tomar el candado; si lo toma, lo retiene hasta que el padre le diga que suelte. */
  const hijo = (archivo) => spawn(process.execPath, ["--input-type=module", "-e", `
    import { adquirir } from ${JSON.stringify(modulo)};
    let soltar = null;
    try { soltar = adquirir(${JSON.stringify(archivo)}, "x"); process.stdout.write("OK\\n"); } catch { process.stdout.write("BLOQ\\n"); }
    process.stdin.once("data", () => { try { soltar?.(); } catch {} process.exit(0); });
  `], { stdio: ["pipe", "pipe", "inherit"] });

  test("en 12 rondas con 3 procesos nunca hay dos dueños a la vez", async () => {
    const dir = tmp("forge-t3-candado-");
    for (let ronda = 0; ronda < 12; ronda++) {
      const archivo = join(dir, `c${ronda}.lock`);
      writeFileSync(archivo, JSON.stringify({ pid: 2 ** 22 - 1 - ronda, ts: Date.now() })); // pid inexistente: huérfano
      const procesos = [hijo(archivo), hijo(archivo), hijo(archivo)];
      const respuestas = await Promise.all(procesos.map((p) => new Promise((res) => p.stdout.once("data", (d) => res(String(d).trim())))));
      assert.ok(respuestas.filter((r) => r === "OK").length <= 1, `ronda ${ronda}: ${respuestas.join("/")}`);
      assert.ok(respuestas.includes("OK"), `ronda ${ronda}: nadie lo tomó (${respuestas.join("/")})`);
      for (const p of procesos) { p.stdin.write("x"); }
      await Promise.all(procesos.map((p) => new Promise((res) => p.once("exit", res))));
    }
  });
});

// ── NUEVO-9 y N6 ─────────────────────────────────────────────────────────────

describe("NUEVO-9 — glob robusto y rutas protegidas de la configuración", () => {
  test("patrones mal formados no lanzan y `**/` repetido no es exponencial", async () => {
    const { globARegex, coincide } = await import("../core/glob.js");
    for (const p of ["a}", "{a", "*.{js,ts", "a,b", "}{", "{,}"]) assert.doesNotThrow(() => globARegex(p), p);
    assert.equal(coincide("a,b", "a,b"), true);
    assert.equal(coincide("x.ts", "*.{js,ts}"), true);
    const t0 = Date.now();
    coincide("a/".repeat(40) + "y", "**/**/**/**/**/**/**/**/**/**/x");
    assert.ok(Date.now() - t0 < 500, `tardó ${Date.now() - t0} ms`);
    assert.equal(coincide("x", "a".repeat(300)), false, "un patrón enorme no coincide con nada");
  });

  test("leerRutasProtegidas lee la lista de la sección protecciones y nada más", async () => {
    const { leerRutasProtegidas } = await import("../core/ciclo/config.js");
    const dir = tmp("forge-t3-");
    assert.deepEqual(leerRutasProtegidas(dir), []);
    escribir(dir, ".sdd/sdd.config.yaml", 'motor:\n  no_tocar_archivos:\n    - "no-es-esta"\nprotecciones:\n  no_tocar_archivos:\n    - "src/legacy/**"\n    - \'*.pem\' # comentario\n    - **/db.js\n  otra: 1\n    - "tampoco"\n');
    assert.deepEqual(leerRutasProtegidas(dir), ["src/legacy/**", "*.pem", "**/db.js"]);
  });

  test("las rutas protegidas impiden escribir y leer esos archivos", () => {
    const dir = tmp("forge-t3-");
    escribir(dir, "src/legacy/a.js", "secreto de negocio");
    assert.equal(/** @type {any} */ (validarRuta(dir, "src/legacy/a.js", { vetadas: ["src/legacy/**"] })).motivo, "ruta_vetada");
    assert.equal(validarRuta(dir, "src/nuevo.js", { vetadas: ["src/legacy/**"] }).ok, true);
    const r = recuperarPorArchivos({ cwd: dir, tarea: { archivos: ["src/legacy/a.js"] }, plan: {}, maxBytes: 10_000, vetadas: ["src/legacy/**"] });
    assert.ok(!r.texto.includes("secreto de negocio"));
  });
});

describe("N6 — las copias de trabajo residuales se barren al arrancar", () => {
  test("barrerCopias borra las carpetas de staging anteriores y devuelve las que no pudo", () => {
    const dir = tmp("forge-t3-");
    const motor = join(dir, ".sdd", "motor", "r1");
    escribir(motor, "staging/1/a.js", "x");
    escribir(motor, "staging/otra/b.js", "y");
    const sbx = new SandboxRunner({ dirMotor: motor, runId: "r1", lenguaje: "javascript", testCmd: "npm test", cli: /** @type {any} */ ({}), imagenBase: "node:20-alpine" });
    assert.deepEqual(sbx.barrerCopias(), []);
    assert.ok(!existsSync(join(motor, "staging", "1")) && !existsSync(join(motor, "staging", "otra")));
    assert.deepEqual(new SandboxRunner({ dirMotor: join(dir, "nada"), runId: "r1", lenguaje: "javascript", testCmd: "x", cli: /** @type {any} */ ({}), imagenBase: "n" }).barrerCopias(), []);
  });
});

// ── Cuarta revisión (seguridad): H1–H10 ──────────────────────────────────────

describe("H1 — la lista de rutas protegidas no se ignora en silencio", () => {
  const leer = async (yaml) => {
    const { leerRutasProtegidas } = await import("../core/ciclo/config.js");
    const dir = tmp("forge-t4-");
    escribir(dir, ".sdd/sdd.config.yaml", yaml);
    return leerRutasProtegidas(dir);
  };
  test("lista en línea, BOM, comentarios en la columna 0 y claves entre comillas", async () => {
    assert.deepEqual(await leer('protecciones:\n  no_tocar_archivos: ["src/secreto/**", \'*.pem\']\n'), ["src/secreto/**", "*.pem"]);
    assert.deepEqual(await leer('\uFEFFprotecciones:\n  no_tocar_archivos:\n    - "a/**"\n'), ["a/**"]);
    assert.deepEqual(await leer('protecciones:\n# nota\n  no_tocar_archivos:\n    - "a/**"\n# otra nota\n    - "src/secreto/**"\n'), ["a/**", "src/secreto/**"]);
    assert.deepEqual(await leer('"protecciones":\n  "no_tocar_archivos":\n    - "a/**"\n'), ["a/**"]);
  });
  test("si la lista está declarada y no se entiende, falla en lugar de dejar rutas sin proteger", async () => {
    await assert.rejects(leer('protecciones:\n  no_tocar_archivos: src/secreto/**\n    - algo\n'), /No se pudo leer protecciones\.no_tocar_archivos/);
    await assert.rejects(leer('proteccion:\n  no_tocar_archivos:\n    - "a"\n'), /No se pudo leer/);
    assert.deepEqual(await leer("protecciones:\n  no_tocar_archivos: []\n"), []);
  });
});

describe("H2 y H10 — la API no deja pasar flags ni rutas peligrosas", async () => {
  const { validarTareas } = await import("../core/api/servidor.js");
  test("un id de tarea no puede empezar por guion ni ser . o ..", () => {
    for (const id of ["--force", "-x", ".", "..", ".git"]) {
      assert.match(String(validarTareas([{ id, agente: "a", prompt: "x" }])), /id/, id);
    }
    assert.equal(validarTareas([{ id: "T1.2-a", agente: "a", prompt: "x" }]), null);
  });
  test("archivos con rutas absolutas o .. se rechazan", () => {
    for (const a of ["../../etc/passwd", "C:\\x", "/etc/passwd", "a/../../b", "D:x"]) {
      assert.match(String(validarTareas([{ id: "T1", agente: "a", prompt: "x", archivos: [a] }])), /archivos/, a);
    }
    assert.equal(validarTareas([{ id: "T1", agente: "a", prompt: "x", archivos: ["src/a.js"] }]), null);
  });
});

describe("H3 y H4 — el respaldo y el barrido no tocan lo vetado ni siguen enlaces", () => {
  test("un manifiesto con entradas dentro de .git se rechaza", () => {
    const base = tmp("forge-t4-");
    const cwd = join(base, "p");
    mkdirSync(cwd);
    for (const ruta of [".git/hooks/pre-commit", ".git/HEAD", "sub/.git/config", ".sdd/estado.json", ".env"]) {
      const d = mkdtempSync(join(base, "r-"));
      writeFileSync(join(d, "manifiesto.json"), JSON.stringify({ entradas: [{ ruta, existia: false }] }));
      assert.throws(() => new Respaldo(cwd, d), /Manifiesto de respaldo inválido|invalido|inv/, ruta);
    }
  });
  test("una junction hacia fuera del proyecto en una entrada se rechaza", (t) => {
    const base = tmp("forge-t4-");
    const cwd = join(base, "p"); const fuera = join(base, "fuera");
    mkdirSync(cwd); mkdirSync(fuera);
    writeFileSync(join(fuera, "victima.txt"), "no");
    try { symlinkSync(fuera, join(cwd, "enlace"), "junction"); } catch { return t.skip("sin enlaces"); }
    const d = mkdtempSync(join(base, "r-"));
    writeFileSync(join(d, "manifiesto.json"), JSON.stringify({ entradas: [{ ruta: "enlace/victima.txt", existia: false }] }));
    assert.throws(() => new Respaldo(cwd, d), /anifiesto/);
    assert.ok(existsSync(join(fuera, "victima.txt")));
  });
  test("barrerCopias no vacía el destino si staging es un enlace", (t) => {
    const base = tmp("forge-t4-");
    const motor = join(base, "motor"); const fuera = join(base, "fuera");
    mkdirSync(motor); mkdirSync(join(fuera, "a"), { recursive: true });
    writeFileSync(join(fuera, "a", "x.txt"), "no");
    try { symlinkSync(fuera, join(motor, "staging"), "junction"); } catch { return t.skip("sin enlaces"); }
    const sbx = new SandboxRunner({ dirMotor: motor, runId: "r1", lenguaje: "javascript", testCmd: "npm test", cli: /** @type {any} */ ({}), imagenBase: "n" });
    assert.equal(sbx.barrerCopias().length, 1, "se informa y no se toca");
    assert.ok(existsSync(join(fuera, "a", "x.txt")));
  });
});

describe("H5, H6 y H8 — coste acotado y candado con marca de tiempo futura", () => {
  test("`*a*a*a*a*a*a*b` contra una cadena larga no es exponencial", async () => {
    const { coincide } = await import("../core/glob.js");
    const t0 = Date.now();
    coincide("a".repeat(1500), "*a*a*a*a*a*a*a*a*a*b");
    assert.ok(Date.now() - t0 < 500, `tardó ${Date.now() - t0} ms`);
  });
  test("una URL hostil larga se redacta en tiempo acotado", () => {
    for (const s of ["a-".repeat(32768), "a.a.".repeat(16384), "pass".repeat(16384)]) {
      const t0 = Date.now();
      cola(s);
      assert.ok(Date.now() - t0 < 700, `tardó ${Date.now() - t0} ms`);
    }
  });
  test("un candado con pid vivo y ts futuro se retira", async () => {
    const { adquirir } = await import("../core/ciclo/candado.js");
    const dir = tmp("forge-t4-");
    const archivo = join(dir, "c.lock");
    writeFileSync(archivo, JSON.stringify({ pid: process.pid, ts: Date.now() + 10 * 24 * 3600 * 1000 }));
    adquirir(archivo, "x")();
  });
});

describe("H9 — un punto de guardado dañado no abre el modo clásico", () => {
  test("una carpeta de hilo sin ningún punto válido cuenta como tarea sin terminar", () => {
    const dir = tmp("forge-t4-");
    const runId = "run-x-1";
    const g = new GuardadorArchivos(join(dir, ".sdd", "motor", runId));
    const e = estadoInicial({ id: "T1", agente: "arquitecto" }, { runId, cwd: dir });
    g.guardar(`${runId}:T1`, { nodo: "coder", siguiente: "revision_humana", estado: { ...e, resultado: "revision_pendiente", revision: { motivo: "iteraciones", reanudarEn: "coder" } } });
    assert.deepEqual(tareasSinTerminarEnElProyecto(dir), ["T1"]);
    // Se corrompe el único punto
    const carpeta = join(g.dir, readdirSync(g.dir)[0]);
    for (const f of readdirSync(carpeta)) writeFileSync(join(carpeta, f), "{corrupto");
    const r = tareasSinTerminarEnElProyecto(dir);
    assert.equal(r.length, 1);
    assert.match(r[0], /dañado/);
  });
});

// ── Éxito sospechoso ─────────────────────────────────────────────────────────

describe("éxito sospechoso — un código 0 no se da por bueno sin evidencia", () => {
  test("detectarSospecha: evidencia de ejecutores conocidos y salidas forzadas", async () => {
    const { detectarSospecha, hayEvidenciaDePruebas } = await import("../core/ciclo/sospecha.js");
    for (const salida of ["# tests 2\n# pass 2\n# fail 0", "ℹ pass 3", "Tests:       1 failed, 4 passed, 5 total", "===== 3 passed in 0.1s =====", "  4 passing (12ms)", "ok 1 - suma"]) {
      assert.ok(hayEvidenciaDePruebas(salida), salida);
    }
    for (const salida of ["", "ok", "hecho", "# tests 0\n# pass 0", "0 passed", "no tests found"]) {
      assert.ok(!hayEvidenciaDePruebas(salida), JSON.stringify(salida));
    }
    assert.deepEqual(detectarSospecha({ stdout: "# pass 1", archivos: [{ ruta: "src/a.js", contenido: "export const a = 1;\nif (x) process.exit(1);" }] }), [], "dentro de un bloque no se marca");
    const m = detectarSospecha({ stdout: "# pass 1", archivos: [{ ruta: "src/a.js", contenido: "process.exit(0);\nexport const a = 1;" }, { ruta: "src/b.py", contenido: "import sys\nsys.exit(0)\n" }] });
    assert.equal(m.length, 2);
  });

  test("una salida sin ninguna prueba pasada pausa para revisión en lugar de dar éxito, y la persona puede aceptarla", async () => {
    const e = entorno({ uso: { inputTokens: 1000, outputTokens: 0, modelo: "claude-sonnet-4-6", proveedor: "anthropic" }, ejecuciones: [{ exitCode: 1 }, { exitCode: 0, stdout: "hecho" }] });
    const r = await e.ciclo().ejecutar(TAREA);
    assert.equal(r.status, "en_revision");
    assert.equal(r.estado.revision?.motivo, "exito_sospechoso");
    assert.match(String(r.estado.revision?.detalle), /ninguna prueba ejecutada y pasada/);

    const r2 = await e.ciclo().ejecutar(TAREA, { decision: "aceptar" });
    assert.equal(r2.estado.resultado, "aceptada_por_humano");
  });

  test("un implementador que corta el proceso al cargarse no da éxito", async () => {
    const e = entorno({ uso: { inputTokens: 1000, outputTokens: 0, modelo: "claude-sonnet-4-6", proveedor: "anthropic" }, ejecuciones: [{ exitCode: 1 }, { exitCode: 0 }] });
    // El implementador devuelve código que sale al importarse; el ejecutor (simulado) informa de una prueba pasada
    const guion = e.opciones;
    const original = guion.llamar;
    guion.llamar = async (p) => (p.agente === "desarrollador-backend"
      ? { ok: true, output: json({ archivos: [{ ruta: "src/suma.js", contenido: "process.exit(0);\nexport const suma = (a, b) => a - b;" }] }), inputTokens: 1000, outputTokens: 0, modelo: "claude-sonnet-4-6", proveedor: "anthropic" }
      : original(p));
    const r = await e.ciclo().ejecutar(TAREA);
    assert.equal(r.status, "en_revision");
    assert.equal(r.estado.revision?.motivo, "exito_sospechoso");
    assert.match(String(r.estado.revision?.detalle), /src\/suma\.js corta el proceso/);
  });
});
