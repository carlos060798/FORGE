// @ts-check
/**
 * T011 / T021 / T022 / T023 — Aislamiento sin necesitar Docker: se comprueba el
 * argv que genera la política y se guionizan las respuestas de la CLI.
 * Cubre CA-003-01, CA-003-03, CA-003-04, CA-003-05, CA-003-06, CA-003-07, CA-003-09.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { argvRun, ETIQUETA, nombreContenedor } from "../core/sandbox/politica.js";
import { crearEjecutor, DockerCli } from "../core/sandbox/docker-cli.js";
import { dockerfile, ErrorPreparacion, prepararImagen } from "../core/sandbox/preparar-imagen.js";
import { comandoDePruebas, SandboxRunner } from "../core/sandbox/sandbox-runner.js";
import { clasificar } from "../core/ciclo/router.js";

const BASE = { imagen: "node:22-alpine", nombre: "forge-sbx-r1-1", copia: "C:\\tmp\\copia", comando: ["npm", "test"] };
const valorDe = (argv, flag) => argv[argv.indexOf(flag) + 1];

/**
 * Ejecutor falso: responde según el primer argumento y anota todas las llamadas.
 * @param {Record<string, any>} guion  por subcomando: un resultado o una función (args) => resultado
 */
function ejecutorFalso(guion = {}) {
  /** @type {string[][]} */
  const llamadas = [];
  const base = { code: 0, stdout: "", stderr: "", timedOut: false };
  const porDefecto = { version: { ...base, stdout: "29.0.0\n" }, image: { ...base, code: 1 } };
  /** @type {import("../core/sandbox/docker-cli.js").Ejecutor} */
  const ejecutar = async (args) => {
    llamadas.push(args);
    const r = guion[args[0]] ?? porDefecto[args[0]] ?? base;
    return { ...base, ...(typeof r === "function" ? r(args) : r) };
  };
  return { ejecutar, llamadas };
}

function proyecto(archivos = {}) {
  const cwd = mkdtempSync(join(tmpdir(), "forge-sbx-"));
  for (const [ruta, contenido] of Object.entries(archivos)) {
    mkdirSync(join(cwd, ruta, ".."), { recursive: true });
    writeFileSync(join(cwd, ruta), contenido);
  }
  return cwd;
}

describe("argvRun — política de aislamiento", () => {
  const argv = argvRun(BASE);

  test("CA-003-01: sin red", () => assert.equal(valorDe(argv, "--network"), "none"));

  test("CA-003-03: sin privilegios", () => {
    assert.equal(valorDe(argv, "--user"), "1000:1000");
    assert.equal(valorDe(argv, "--cap-drop"), "ALL");
    assert.equal(valorDe(argv, "--security-opt"), "no-new-privileges");
    assert.ok(!argv.includes("--privileged"));
  });

  test("CA-003-05: límites de CPU, memoria y procesos, sin intercambio adicional", () => {
    assert.equal(valorDe(argv, "--cpus"), "1");
    assert.equal(valorDe(argv, "--memory"), "512m");
    assert.equal(valorDe(argv, "--memory-swap"), "512m");
    assert.equal(valorDe(argv, "--pids-limit"), "256");
  });

  test("raíz de solo lectura, /tmp sin ejecución y una sola carpeta montada", () => {
    assert.ok(argv.includes("--read-only"));
    assert.equal(valorDe(argv, "--tmpfs"), "/tmp:rw,noexec,nosuid,size=64m");
    assert.equal(argv.filter((a) => a === "--mount").length, 1);
    assert.equal(argv.filter((a) => a === "-v").length, 0);
    assert.equal(valorDe(argv, "--mount"), "type=bind,source=C:\\tmp\\copia,target=/work");
    assert.equal(valorDe(argv, "-w"), "/work");
  });

  test("CA-003-06: se elimina al terminar y lleva nombre y etiqueta para poder barrerlo", () => {
    assert.ok(argv.includes("--rm"));
    assert.equal(valorDe(argv, "--name"), "forge-sbx-r1-1");
    assert.equal(valorDe(argv, "--label"), ETIQUETA);
  });

  test("endurecimiento adicional: nada se descarga, límites de ficheros y de tamaño de archivo", () => {
    assert.equal(valorDe(argv, "--pull"), "never");
    const ulimits = argv.map((a, i) => (a === "--ulimit" ? argv[i + 1] : null)).filter(Boolean);
    assert.deepEqual(ulimits, ["nofile=1024:1024", "fsize=104857600"]);
  });

  test("una ruta con coma no puede colar opciones en --mount, y una con dos puntos es válida", () => {
    assert.throws(() => argvRun({ ...BASE, copia: "/tmp/a,readonly=false" }), /comas/);
    assert.throws(() => argvRun({ ...BASE, copia: "/tmp/a\nb" }), /comas|saltos/);
    assert.equal(valorDe(argvRun({ ...BASE, copia: "/home/u/proy:x" }), "--mount"), "type=bind,source=/home/u/proy:x,target=/work");
  });

  test("el ejecutable va como entrypoint y sus argumentos tras la imagen", () => {
    assert.equal(valorDe(argv, "--entrypoint"), "npm");
    assert.deepEqual(argv.slice(argv.indexOf("node:22-alpine")), ["node:22-alpine", "test"]);
  });

  test("los límites, el directorio y el entorno son configurables", () => {
    const a = argvRun({ ...BASE, limites: { memoria: "1g", pids: 64 }, dirTrabajo: "/deps/work", env: { HOME: "/tmp" } });
    assert.equal(valorDe(a, "--memory"), "1g");
    assert.equal(valorDe(a, "--memory-swap"), "1g");
    assert.equal(valorDe(a, "--pids-limit"), "64");
    assert.equal(valorDe(a, "--cpus"), "1");
    assert.equal(valorDe(a, "-w"), "/deps/work");
    assert.equal(valorDe(a, "-e"), "HOME=/tmp");
  });

  test("rechaza valores que docker interpretaría como opciones", () => {
    assert.throws(() => argvRun({ ...BASE, imagen: "--privileged" }), /imagen inválido/);
    assert.throws(() => argvRun({ ...BASE, nombre: "-v" }), /nombre inválido/);
    assert.throws(() => argvRun({ ...BASE, comando: ["--net=host"] }), /comando inválido/);
    assert.throws(() => argvRun({ ...BASE, comando: [] }), /comando vacío/);
    assert.throws(() => argvRun({ ...BASE, env: { "A=B --privileged": "x" } }), /entorno inválida/);
  });

  test("con proyectoId añade la etiqueta del proyecto, que acota el barrido de huérfanos", () => {
    const a = argvRun({ ...BASE, proyectoId: "abc 123" });
    assert.ok(a.includes("forge.proyecto=abc_123"));
    assert.equal(a.filter((x) => x === "--label").length, 2);
    assert.equal(argvRun(BASE).filter((x) => x === "--label").length, 1);
  });

  test("nombreContenedor limpia el identificador de la sesión", () => {
    assert.equal(nombreContenedor("run:1/x y", 3), "forge-sbx-run_1_x_y-3");
  });
});

describe("DockerCli — con ejecutor guionizado", () => {
  const OPC = { nombre: "forge-sbx-r1-1", timeoutMs: 1000 };
  const OK = { hayPruebas: true, pruebasIntactas: true };

  test("códigos de salida de las pruebas", async () => {
    for (const [code, categoria] of /** @type {const} */ ([[0, "pass"], [1, "fail"], [137, "fail"], [125, "infra_error"], [126, "infra_error"], [127, "infra_error"]])) {
      const cli = new DockerCli(ejecutorFalso({ run: { code } }));
      const r = await cli.run(["run"], OPC);
      assert.equal(r.exitCode, code);
      assert.equal(clasificar(r, OK), categoria, `código ${code}`);
    }
  });

  test("137 sin tiempo agotado se marca como memoria agotada", async () => {
    const r = await new DockerCli(ejecutorFalso({ run: { code: 137 } })).run(["run"], OPC);
    assert.equal(r.oomKilled, true);
    assert.equal(r.infraError, false);
  });

  test("CA-003-04: al agotar el tiempo mata y elimina el contenedor por nombre", async () => {
    const f = ejecutorFalso({ run: { code: null, timedOut: true } });
    const r = await new DockerCli(f).run(["run"], OPC);
    assert.equal(r.timedOut, true);
    assert.equal(r.exitCode, null);
    assert.equal(r.oomKilled, false);
    assert.deepEqual(f.llamadas.slice(1), [["kill", "forge-sbx-r1-1"], ["rm", "-f", "forge-sbx-r1-1"]]);
    assert.equal(clasificar(r, OK), "timeout");
  });

  test("CA-003-07: docker no instalado es un error de infraestructura", async () => {
    const r = await new DockerCli(ejecutorFalso({ run: { code: null, error: "spawn docker ENOENT" } })).run(["run"], OPC);
    assert.equal(r.infraError, true);
    assert.equal(clasificar(r, OK), "infra_error");
  });

  test("disponible informa del motivo cuando el daemon no responde", async () => {
    const caido = await new DockerCli(ejecutorFalso({ version: { code: 1, stderr: "failed to connect to the docker API" } })).disponible();
    assert.deepEqual(caido, { ok: false, error: "Docker no está disponible: failed to connect to the docker API" });
    const ausente = await new DockerCli(ejecutorFalso({ version: { code: null, error: "spawn docker ENOENT" } })).disponible();
    assert.equal(ausente.ok, false);
    assert.deepEqual(await new DockerCli(ejecutorFalso()).disponible(), { ok: true, version: "29.0.0" });
  });

  test("CA-003-06: barrerHuerfanos elimina por etiqueta", async () => {
    const f = ejecutorFalso({ ps: { stdout: "abc123\ndef456\n" } });
    assert.equal(await new DockerCli(f).barrerHuerfanos(), 2);
    assert.deepEqual(f.llamadas, [["ps", "-aq", "--filter", `label=${ETIQUETA}`], ["rm", "-f", "abc123", "def456"]]);
    assert.equal(await new DockerCli(ejecutorFalso()).barrerHuerfanos(), 0);
  });

  test("el ejecutor real conserva el final de la salida y respeta el tiempo máximo", async () => {
    const node = crearEjecutor(process.execPath);
    const largo = await node(["-e", "process.stdout.write('a'.repeat(5000) + 'FINAL')"], { maxBytes: 100 });
    assert.equal(largo.stdout.length, 100);
    assert.ok(largo.stdout.endsWith("FINAL"));

    const lento = await node(["-e", "setTimeout(() => {}, 30000)"], { timeoutMs: 300 });
    assert.equal(lento.timedOut, true);

    const ausente = await crearEjecutor("ejecutable-que-no-existe-xyz")(["x"]);
    assert.equal(ausente.code, null);
    assert.ok(ausente.error);
  });
});

describe("prepararImagen — dependencias sin red (ADR-03)", () => {
  const dirConstruccion = () => join(mkdtempSync(join(tmpdir(), "forge-build-")), "ctx");

  test("sin dependencias declaradas se usa la imagen base y no se construye nada", async () => {
    const f = ejecutorFalso();
    const cwd = proyecto({ "package.json": '{"name":"x","scripts":{"test":"node --test"}}' });
    const r = await prepararImagen({ cwd, lenguaje: "javascript", cli: new DockerCli(f), dirConstruccion: dirConstruccion() });
    assert.deepEqual(r, { imagen: "node:22-alpine", construida: false, huella: null });
    assert.deepEqual(f.llamadas, []);
  });

  test("CA-003-09: con dependencias construye una imagen cuyo contexto solo lleva manifiestos", async () => {
    let contexto = [];
    const f = ejecutorFalso({ build: (args) => { contexto = require_readdir(args[args.length - 1]); return {}; } });
    const cwd = proyecto({
      "package.json": '{"devDependencies":{"vitest":"^2"}}', "package-lock.json": "{}",
      "src/a.js": "codigo", ".env": "SECRETO=1",
    });
    const dir = dirConstruccion();
    const r = await prepararImagen({ cwd, lenguaje: "javascript", cli: new DockerCli(f), dirConstruccion: dir });
    assert.match(r.imagen, /^forge-sbx:node-[0-9a-f]{16}$/);
    assert.equal(r.construida, true);
    assert.deepEqual(contexto.sort(), ["Dockerfile", "package-lock.json", "package.json"]);
    assert.ok(!existsSync(dir), "el contexto se elimina al terminar");
  });

  test("la imagen ya construida se reutiliza; cambiar un manifiesto cambia la etiqueta", async () => {
    const cwd = proyecto({ "requirements.txt": "pytest==8.0\n" });
    const f = ejecutorFalso({ image: { code: 0 } });
    const a = await prepararImagen({ cwd, lenguaje: "python", cli: new DockerCli(f), dirConstruccion: dirConstruccion() });
    assert.equal(a.construida, false);
    assert.ok(!f.llamadas.some((l) => l[0] === "build"));

    writeFileSync(join(cwd, "requirements.txt"), "pytest==8.1\n");
    const b = await prepararImagen({ cwd, lenguaje: "python", cli: new DockerCli(f), dirConstruccion: dirConstruccion() });
    assert.match(a.imagen, /^forge-sbx:python-/);
    assert.notEqual(a.imagen, b.imagen);
  });

  test("un fallo de construcción y un lenguaje no cubierto son errores de preparación", async () => {
    const cwd = proyecto({ "requirements.txt": "paquete-que-no-existe\n" });
    const cli = new DockerCli(ejecutorFalso({ build: { code: 1, stderr: "ERROR: No matching distribution" } }));
    await assert.rejects(prepararImagen({ cwd, lenguaje: "python", cli, dirConstruccion: dirConstruccion() }), ErrorPreparacion);
    await assert.rejects(prepararImagen({ cwd, lenguaje: "rust", cli, dirConstruccion: dirConstruccion() }), /no cubre todavía/);
  });

  test("el Dockerfile instala sin scripts de instalación y deja los binarios en el PATH", () => {
    const d = dockerfile("javascript", "node:22-alpine", ["package.json", "package-lock.json"]);
    assert.ok(d.includes("RUN npm ci --ignore-scripts"));
    assert.ok(d.includes("ENV PATH=/deps/node_modules/.bin:$PATH"));
    assert.ok(dockerfile("javascript", "node:22-alpine", ["package.json"]).includes("RUN npm install --ignore-scripts"));
    assert.ok(dockerfile("python", "python:3.12-slim", ["requirements.txt"]).includes("pip install --no-cache-dir"));
  });
});

describe("SandboxRunner — con ejecutor guionizado", () => {
  const runner = (f, cwd, extra = {}) => new SandboxRunner({
    runId: "r1", dirMotor: join(cwd, ".sdd", "motor", "r1"), lenguaje: "javascript", testCmd: "npm test", cli: new DockerCli(f), ...extra,
  });

  test("monta una copia, nunca el proyecto, y la elimina al terminar", async () => {
    const cwd = proyecto({ "package.json": "{}", "src/a.js": "a", ".env": "SECRETO=1" });
    let enCopia = [];
    const montada = (args) => args[args.indexOf("--mount") + 1].replace(/^type=bind,source=/, "").replace(/,target=.*$/, "");
    const f = ejecutorFalso({ run: (args) => { enCopia = require_readdir(montada(args)); return { code: 0 }; } });
    const r = await runner(f, cwd).test(cwd);

    assert.equal(r.ok, true);
    assert.deepEqual(enCopia.sort(), ["package.json", "src"]);
    const argv = f.llamadas.find((l) => l[0] === "run") ?? [];
    assert.ok(montada(argv) !== cwd, "no debe montar el proyecto real");
    assert.equal(valorDe(argv, "-w"), "/deps/work");
    assert.equal(valorDe(argv, "--network"), "none");
    assert.ok(!existsSync(join(cwd, ".sdd", "motor", "r1", "staging", "1")));
  });

  test("CA-003-07: sin Docker no ejecuta nada y devuelve error de infraestructura", async () => {
    const cwd = proyecto({ "package.json": "{}" });
    const f = ejecutorFalso({ version: { code: 1, stderr: "daemon caído" } });
    const r = await runner(f, cwd).test(cwd);
    assert.equal(r.infraError, true);
    assert.equal(r.ok, false);
    assert.equal(r.exitCode, null);
    assert.deepEqual(f.llamadas.map((l) => l[0]), ["version"]);
  });

  test("un lenguaje no cubierto es error de infraestructura, no un fallo de las pruebas", async () => {
    const cwd = proyecto({ "go.mod": "module x" });
    const f = ejecutorFalso();
    const r = await runner(f, cwd, { lenguaje: "rust", testCmd: "cargo test" }).test(cwd);
    assert.equal(r.infraError, true);
    assert.ok(!f.llamadas.some((l) => l[0] === "run"));
  });

  test("la copia se elimina aunque la ejecución falle, y cada ejecución lleva un nombre distinto", async () => {
    const cwd = proyecto({ "package.json": "{}" });
    const f = ejecutorFalso({ run: { code: 1, stderr: "1 failing" } });
    const sr = runner(f, cwd);
    const r1 = await sr.test(cwd);
    await sr.test(cwd);
    assert.equal(r1.ok, false);
    assert.equal(r1.exitCode, 1);
    assert.ok(!existsSync(join(cwd, ".sdd", "motor", "r1", "staging", "1")));
    assert.ok(!existsSync(join(cwd, ".sdd", "motor", "r1", "staging", "2")));
    const nombres = f.llamadas.filter((l) => l[0] === "run").map((l) => valorDe(l, "--name"));
    assert.deepEqual(nombres, ["forge-sbx-r1-1", "forge-sbx-r1-2"]);
  });

  test("comandoDePruebas quita npx y separa en argumentos", () => {
    assert.deepEqual(comandoDePruebas("npx vitest run"), ["vitest", "run"]);
    assert.deepEqual(comandoDePruebas("npm test"), ["npm", "test"]);
    assert.deepEqual(comandoDePruebas("python -m pytest"), ["python", "-m", "pytest"]);
    assert.throws(() => comandoDePruebas("  "), /No hay comando/);
  });
});

import { readdirSync } from "node:fs";
function require_readdir(dir) { return readdirSync(dir); }
