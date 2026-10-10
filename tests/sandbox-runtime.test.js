// @ts-check
/**
 * Aislamiento elegible: `sandbox.runtime` (spec 2026-10-09-puesta-al-dia, HU-004).
 * Cubre CA-004-01 a CA-004-05.
 *
 * Sin Docker: se compara el argv de la política y se guionizan las respuestas de la CLI.
 * Con FORGE_TEST_DOCKER=1 y el daemon en marcha: un runtime inexistente (debe negarse) y
 * `runc` (debe funcionar), contra Docker de verdad.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { argvRun, validarRuntime } from "../core/sandbox/politica.js";
import { DockerCli } from "../core/sandbox/docker-cli.js";
import { SandboxRunner } from "../core/sandbox/sandbox-runner.js";
import { POR_DEFECTO, leerConfigCiclo } from "../core/ciclo/config.js";
import { clasificar } from "../core/ciclo/router.js";
import { lineaAislamiento } from "../core/ciclo/index.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(ROOT, "cli", "index.js");
const BASE = { imagen: "node:22-alpine", nombre: "forge-sbx-r1-1", copia: "C:\\tmp\\copia", comando: ["npm", "test"] };
const valorDe = (argv, flag) => argv[argv.indexOf(flag) + 1];
const RUNTIMES = JSON.stringify({ "io.containerd.runc.v2": { path: "runc" }, runc: { path: "runc" }, runsc: { path: "/usr/bin/runsc" } });

/** Ejecutor falso: responde según el primer argumento y anota todas las llamadas. */
function ejecutorFalso(guion = {}) {
  /** @type {string[][]} */
  const llamadas = [];
  const base = { code: 0, stdout: "", stderr: "", timedOut: false };
  const porDefecto = { version: { ...base, stdout: "29.0.0\n" }, image: { ...base, code: 1 }, info: { ...base, stdout: RUNTIMES + "\n" } };
  /** @type {import("../core/sandbox/docker-cli.js").Ejecutor} */
  const ejecutar = async (args) => {
    llamadas.push(args);
    const r = guion[args[0]] ?? porDefecto[args[0]] ?? base;
    return { ...base, ...(typeof r === "function" ? r(args) : r) };
  };
  return { ejecutar, llamadas };
}

function proyecto(archivos = {}) {
  const cwd = mkdtempSync(join(tmpdir(), "forge-rt-"));
  for (const [ruta, contenido] of Object.entries(archivos)) {
    mkdirSync(join(cwd, ruta, ".."), { recursive: true });
    writeFileSync(join(cwd, ruta), contenido);
  }
  return cwd;
}
const conConfig = (yaml) => proyecto({ ".sdd/sdd.config.yaml": yaml });

describe("CA-004-01 — el mecanismo de aislamiento se indica en la configuración", () => {
  test("sin indicarlo, el valor es vacío: el de Docker por defecto", () => {
    assert.equal(POR_DEFECTO.sandbox.runtime, "");
    assert.equal(leerConfigCiclo(proyecto()).sandbox.runtime, "");
    assert.equal(leerConfigCiclo(conConfig("sandbox:\n  cpus: 2\n")).sandbox.runtime, "");
  });

  test("se lee de sandbox.runtime, con o sin comillas y con comentario", () => {
    assert.equal(leerConfigCiclo(conConfig("sandbox:\n  runtime: runsc\n")).sandbox.runtime, "runsc");
    assert.equal(leerConfigCiclo(conConfig('sandbox:\n  runtime: "io.containerd.runc.v2"   # el de siempre\n')).sandbox.runtime, "io.containerd.runc.v2");
    assert.equal(leerConfigCiclo(conConfig("sandbox:\n  runtime: kata-qemu\n  cpus: 2\n")).sandbox.cpus, 2, "las demás claves de la sección se siguen leyendo");
  });

  test("sin runtime, el argv es exactamente el de antes: no aparece --runtime", () => {
    assert.ok(!argvRun(BASE).includes("--runtime"));
    assert.deepEqual(argvRun({ ...BASE, runtime: "" }), argvRun(BASE));
    assert.deepEqual(argvRun({ ...BASE, runtime: undefined }), argvRun(BASE));
  });

  test("con runtime, se añade `--runtime <valor>` como dos argumentos separados", () => {
    const argv = argvRun({ ...BASE, runtime: "runsc" });
    assert.equal(valorDe(argv, "--runtime"), "runsc");
    assert.equal(argv.filter((a) => a === "--runtime").length, 1);
    assert.ok(argv.indexOf("--runtime") < argv.indexOf("--entrypoint"), "va entre las opciones de docker, antes de la imagen");
  });
});

describe("CA-004-03 — todas las restricciones se mantienen con cualquier mecanismo", () => {
  test("el argv con runtime es el de sin runtime más esos dos argumentos, ni uno menos", () => {
    for (const extra of [{}, { limites: { cpus: 2, memoria: "1g", pids: 64 }, env: { HOME: "/tmp" }, proyectoId: "p1", tmpfsMb: 128, dirTrabajo: "/deps/work" }]) {
      const sin = argvRun({ ...BASE, ...extra });
      const con = argvRun({ ...BASE, ...extra, runtime: "runsc" });
      const i = con.indexOf("--runtime");
      assert.deepEqual([...con.slice(0, i), ...con.slice(i + 2)], sin);
    }
  });

  test("sin red, sin privilegios, con límites, raíz de solo lectura y sin descargas, también con runtime", () => {
    const argv = argvRun({ ...BASE, runtime: "kata-runtime" });
    assert.equal(valorDe(argv, "--network"), "none");
    assert.equal(valorDe(argv, "--user"), "1000:1000");
    assert.equal(valorDe(argv, "--cap-drop"), "ALL");
    assert.equal(valorDe(argv, "--security-opt"), "no-new-privileges");
    assert.equal(valorDe(argv, "--cpus"), "1");
    assert.equal(valorDe(argv, "--memory"), "512m");
    assert.equal(valorDe(argv, "--memory-swap"), "512m");
    assert.equal(valorDe(argv, "--pids-limit"), "256");
    assert.equal(valorDe(argv, "--pull"), "never");
    assert.ok(argv.includes("--read-only") && argv.includes("--rm"));
    assert.equal(valorDe(argv, "--tmpfs"), "/tmp:rw,noexec,nosuid,size=64m");
    assert.equal(argv.filter((a) => a === "--mount").length, 1);
    assert.ok(!argv.includes("--privileged"));
  });

  test("el ejecutor de pruebas pasa el runtime a la política sin perder nada", async () => {
    const cwd = proyecto({ "package.json": "{}" });
    const f = ejecutorFalso({ run: { code: 0 } });
    const r = await new SandboxRunner({ runId: "r1", dirMotor: join(cwd, ".sdd", "motor", "r1"), lenguaje: "javascript", testCmd: "npm test", cli: new DockerCli(f), runtime: "runsc" }).test(cwd);
    assert.equal(r.ok, true);
    const argv = f.llamadas.find((l) => l[0] === "run") ?? [];
    assert.equal(valorDe(argv, "--runtime"), "runsc");
    assert.equal(valorDe(argv, "--network"), "none");
    assert.equal(valorDe(argv, "--cap-drop"), "ALL");
  });
});

describe("CA-004-04 — un valor que pudiera interpretarse como opciones se rechaza", () => {
  const MALOS = ["-v", "--privileged", "-", "runc --privileged", "runc;rm", "a/b", "a\\b", "a,b", "a=b", "a:b", "ru nc", " runc", "runc\n", "$(x)", "ñ", "a\tb"];

  test("valores válidos", () => {
    for (const v of ["runc", "runsc", "kata-runtime", "io.containerd.runc.v2", "crun_1", "0x", ".oculto", "_a"]) assert.equal(validarRuntime(v), v);
    for (const vacio of ["", undefined, null]) assert.equal(validarRuntime(vacio), "");
  });

  test("la validación rechaza guion inicial, espacios, separadores y cualquier otro carácter", () => {
    for (const malo of MALOS) assert.throws(() => validarRuntime(malo), /sandbox\.runtime no válido/, JSON.stringify(malo));
    for (const noTexto of [5, true, {}, ["runc"]]) assert.throws(() => validarRuntime(noTexto), /sandbox\.runtime no válido/);
  });

  test("la política no construye un argv con un runtime no válido", () => {
    for (const malo of MALOS) assert.throws(() => argvRun({ ...BASE, runtime: malo }), /sandbox\.runtime no válido/, JSON.stringify(malo));
  });

  test("la configuración no se lee: el error nombra la clave", () => {
    for (const malo of ["--privileged", "-v", "runc --privileged", "a/b", "a=b"]) {
      assert.throws(() => leerConfigCiclo(conConfig(`sandbox:\n  runtime: ${malo}\n`)), /sandbox\.runtime no válido/, malo);
    }
    assert.throws(() => leerConfigCiclo(conConfig('sandbox:\n  runtime: "--net=host"\n')), /sandbox\.runtime no válido/);
  });

  test("el ejecutor de pruebas tampoco se crea con un runtime no válido", () => {
    assert.throws(() => new SandboxRunner({ runId: "r1", dirMotor: join(tmpdir(), "x", ".sdd", "motor", "r1"), lenguaje: "javascript", testCmd: "npm test", runtime: "--privileged" }), /sandbox\.runtime no válido/);
  });
});

describe("CA-004-02 — si el mecanismo indicado no está disponible, no se ejecuta nada", () => {
  const runner = (f, cwd, runtime) => new SandboxRunner({ runId: "r1", dirMotor: join(cwd, ".sdd", "motor", "r1"), lenguaje: "javascript", testCmd: "npm test", cli: new DockerCli(f), runtime });

  test("DockerCli pregunta a Docker qué runtimes conoce", async () => {
    const f = ejecutorFalso();
    assert.deepEqual(await new DockerCli(f).runtimeDisponible("runsc"), { ok: true, conocidos: ["io.containerd.runc.v2", "runc", "runsc"] });
    assert.deepEqual(f.llamadas, [["info", "--format", "{{json .Runtimes}}"]]);
  });

  test("uno que no conoce: el error nombra el runtime y lista los que sí hay", async () => {
    const r = await new DockerCli(ejecutorFalso()).runtimeDisponible("kata-fc");
    assert.equal(r.ok, false);
    assert.match(/** @type {any} */ (r).error, /"kata-fc"/);
    assert.match(/** @type {any} */ (r).error, /sandbox\.runtime/);
    assert.match(/** @type {any} */ (r).error, /runc, runsc/);
  });

  test("el nombre debe coincidir entero: un prefijo o una mayúscula no valen", async () => {
    const cli = new DockerCli(ejecutorFalso());
    for (const casi of ["run", "RUNC", "runc.v2", "io.containerd.runc"]) assert.equal((await cli.runtimeDisponible(casi)).ok, false, casi);
  });

  test("si no se puede saber (daemon caído, respuesta ilegible, tiempo agotado), la respuesta es no", async () => {
    for (const info of [{ code: 1, stderr: "Cannot connect to the Docker daemon" }, { stdout: "no es json" }, { stdout: "null" }, { stdout: '["runc"]' }, { stdout: "" }, { code: null, timedOut: true }, { code: null, error: "spawn docker ENOENT" }]) {
      const r = await new DockerCli(ejecutorFalso({ info })).runtimeDisponible("runc");
      assert.equal(r.ok, false, JSON.stringify(info));
      assert.match(/** @type {any} */ (r).error, /"runc"/);
    }
  });

  test("el ejecutor de pruebas devuelve error de infraestructura y no lanza ningún contenedor ni prepara imagen", async () => {
    const cwd = proyecto({ "package.json": "{}" });
    const f = ejecutorFalso();
    const r = await runner(f, cwd, "no-instalado").test(cwd);
    assert.equal(r.infraError, true);
    assert.equal(r.ok, false);
    assert.equal(r.exitCode, null);
    assert.match(r.stderr, /"no-instalado"/);
    assert.deepEqual(f.llamadas.map((l) => l[0]), ["version", "info"], "ni build ni run");
    assert.equal(clasificar(r, { hayPruebas: true, pruebasIntactas: true }), "infra_error", "el ciclo lo trata como infraestructura, no como pruebas que fallan");
  });

  test("nunca cae al mecanismo por defecto: ni en la primera ejecución ni en las siguientes", async () => {
    const cwd = proyecto({ "package.json": "{}" });
    const f = ejecutorFalso();
    const sr = runner(f, cwd, "no-instalado");
    await sr.test(cwd);
    await sr.test(cwd);
    assert.ok(!f.llamadas.some((l) => l[0] === "run"), "no se ejecutó nada con otro aislamiento");
    assert.equal(f.llamadas.filter((l) => l[0] === "info").length, 2, "un no se vuelve a preguntar; no se recuerda");
  });

  test("con el mecanismo disponible se pregunta una sola vez por sesión", async () => {
    const cwd = proyecto({ "package.json": "{}" });
    const f = ejecutorFalso({ run: { code: 0 } });
    const sr = runner(f, cwd, "runsc");
    await sr.test(cwd);
    await sr.test(cwd);
    assert.equal(f.llamadas.filter((l) => l[0] === "info").length, 1);
    assert.equal(f.llamadas.filter((l) => l[0] === "run").length, 2);
  });

  test("sin runtime configurado no se pregunta nada a Docker sobre runtimes", async () => {
    const cwd = proyecto({ "package.json": "{}" });
    const f = ejecutorFalso({ run: { code: 0 } });
    await runner(f, cwd, undefined).test(cwd);
    assert.ok(!f.llamadas.some((l) => l[0] === "info"));
  });

});

describe("CA-004-05 — la consulta de estado y el diagnóstico muestran el mecanismo en uso", () => {
  test("la línea de estado nombra el runtime configurado, o dice que es el de por defecto", () => {
    assert.match(lineaAislamiento(conConfig("sandbox:\n  runtime: runsc\n")), /"runsc" \(sandbox\.runtime\)/);
    assert.match(lineaAislamiento(proyecto()), /por defecto/);
    assert.match(lineaAislamiento(conConfig("sandbox:\n  runtime: --privileged\n")), /no válida.*sandbox\.runtime/);
  });

  test("`forge status` muestra el mecanismo de aislamiento", () => {
    const dir = conConfig("sandbox:\n  runtime: runsc\n");
    writeFileSync(join(dir, ".sdd", "estado.json"), JSON.stringify({ pipeline_step: "code" }));
    const r = spawnSync(process.execPath, [CLI, "status"], { cwd: dir, encoding: "utf8", env: { ...process.env, FORGE_LLM_PROVIDER: "stub" } });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /Aislamiento: Docker con el mecanismo "runsc"/);
  });

  test("`forge doctor` muestra el mecanismo de aislamiento (sin Docker en el PATH: lo dice, no se cuelga)", () => {
    const dir = conConfig("sandbox:\n  runtime: runsc\n");
    const env = { ...process.env, FORGE_LLM_PROVIDER: "stub", ANTHROPIC_API_KEY: "", FORGE_RUNTIMES_PERMITIDOS: "runsc" };
    for (const k of Object.keys(env)) if (/^path$/i.test(k)) delete env[k];
    env.PATH = dirname(process.execPath);
    const r = spawnSync(process.execPath, [CLI, "doctor"], { cwd: dir, encoding: "utf8", env, timeout: 120_000 });
    assert.match(r.stdout, /Mecanismo de aislamiento pedido: "runsc" \(sandbox\.runtime\)/, r.stdout + r.stderr);
    const porDefecto = spawnSync(process.execPath, [CLI, "doctor"], { cwd: proyecto(), encoding: "utf8", env, timeout: 120_000 });
    assert.match(porDefecto.stdout, /Mecanismo de aislamiento: el de Docker por defecto/, porDefecto.stdout + porDefecto.stderr);
  });
});

// ─── Docker real ──────────────────────────────────────────────────────────────

const cli = new DockerCli();
const activo = process.env.FORGE_TEST_DOCKER === "1" && (await cli.disponible()).ok;

/** Proyecto Node sin dependencias cuyo test es el script dado. */
function proyectoReal(script) {
  return proyecto({
    "package.json": JSON.stringify({ name: "demo", type: "module", scripts: { test: "node --test" } }),
    "tests/demo.test.js": `import { test } from 'node:test';\nimport assert from 'node:assert/strict';\n${script}\n`,
  });
}
let n = 0;
const runnerReal = (cwd, runtime) => new SandboxRunner({
  runId: `rt-${process.pid}-${++n}`, dirMotor: join(cwd, ".sdd", "motor", "r"), lenguaje: "javascript", testCmd: "npm test", cli, runtime,
});

describe("sandbox.runtime con Docker real", { skip: !activo && "requiere FORGE_TEST_DOCKER=1 y Docker en marcha" }, () => {
  test("Docker conoce runc y no conoce un runtime inventado", async () => {
    assert.equal((await cli.runtimeDisponible("runc")).ok, true);
    const r = await cli.runtimeDisponible("forge-runtime-que-no-existe");
    assert.equal(r.ok, false);
    assert.match(/** @type {any} */ (r).error, /forge-runtime-que-no-existe/);
  });

  test("CA-004-02 real: con un runtime inexistente se niega; no ejecuta las pruebas ni cae al de por defecto", async () => {
    const cwd = proyectoReal("test('suma', () => assert.equal(1 + 1, 2));");
    const r = await runnerReal(cwd, "forge-runtime-que-no-existe").test(cwd);
    assert.equal(r.infraError, true, r.stdout + r.stderr);
    assert.equal(r.ok, false);
    assert.equal(r.exitCode, null);
    assert.match(r.stderr, /forge-runtime-que-no-existe/);
    assert.ok(!existsSync(join(cwd, ".sdd", "motor", "r", "staging")), "ni siquiera se preparó una copia de trabajo");
  });

  test("CA-004-01 real: con runc las pruebas se ejecutan y pasan", async () => {
    const cwd = proyectoReal("test('suma', () => assert.equal(1 + 1, 2));");
    const r = await runnerReal(cwd, "runc").test(cwd);
    assert.equal(r.exitCode, 0, r.stdout + r.stderr);
    assert.equal(r.ok, true);
  });

  test("CA-004-03 real: con runc el código sigue sin red y sin poder escribir fuera de /tmp y de su copia", async () => {
    const cwd = proyectoReal([
      "import { writeFileSync } from 'node:fs';",
      "test('red', async () => { await assert.rejects(fetch('https://example.com')); });",
      "test('raíz de solo lectura', () => { assert.throws(() => writeFileSync('/etc/forge-prueba', 'x')); });",
      "test('sin privilegios', () => { assert.notEqual(process.getuid(), 0); });",
    ].join("\n"));
    const r = await runnerReal(cwd, "runc").test(cwd);
    assert.equal(r.exitCode, 0, r.stdout + r.stderr);
  });

  test("CA-004-02 real, por la CLI: `forge run` con un runtime inexistente termina con el código 4 y nombra el runtime", () => {
    const dir = proyecto({
      ".sdd/sdd.config.yaml": "sandbox:\n  runtime: forge-runtime-que-no-existe\n",
      ".sdd/estado.json": JSON.stringify({ pipeline_step: "code" }),
      ".sdd/estado-tareas.json": JSON.stringify({ tareas: [{ id: "T1", agente: "arquitecto", prompt: "Tarea T1" }] }),
      "package.json": JSON.stringify({ name: "demo", scripts: { test: "node --test" } }),
    });
    const r = spawnSync(process.execPath, [CLI, "run"], { cwd: dir, encoding: "utf8", env: { ...process.env, FORGE_LLM_PROVIDER: "stub", ANTHROPIC_API_KEY: "", FORGE_RUNTIMES_PERMITIDOS: "forge-runtime-que-no-existe" }, timeout: 120_000 });
    assert.equal(r.status, 4, r.stdout + r.stderr);
    assert.match(r.stderr, /forge-runtime-que-no-existe/);
    assert.match(r.stderr, /no empieza con un aislamiento distinto/);
    assert.ok(!existsSync(join(dir, ".sdd", "events.jsonl")), "no se ejecutó ninguna tarea");
    assert.ok(!existsSync(join(dir, ".sdd", "motor")), "no se creó sesión ni se gastó nada");
  });

  test("`forge doctor` real: avisa de un runtime inexistente y acepta runc", () => {
    const env = { ...process.env, FORGE_LLM_PROVIDER: "stub", ANTHROPIC_API_KEY: "", FORGE_RUNTIMES_PERMITIDOS: "forge-runtime-que-no-existe" };
    const malo = spawnSync(process.execPath, [CLI, "doctor"], { cwd: conConfig("sandbox:\n  runtime: forge-runtime-que-no-existe\n"), encoding: "utf8", env, timeout: 120_000 });
    assert.match(malo.stdout, /"forge-runtime-que-no-existe" \(sandbox\.runtime\) no está disponible/, malo.stdout + malo.stderr);
    const bueno = spawnSync(process.execPath, [CLI, "doctor"], { cwd: conConfig("sandbox:\n  runtime: runc\n"), encoding: "utf8", env, timeout: 120_000 });
    assert.match(bueno.stdout, /Mecanismo de aislamiento: "runc" \(sandbox\.runtime\) ✓ \(Docker /, bueno.stdout + bueno.stderr);
  });
});
