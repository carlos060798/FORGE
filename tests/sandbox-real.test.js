// @ts-check
/**
 * T034 — Aislamiento con Docker real. Solo corre con FORGE_TEST_DOCKER=1 y el
 * daemon en marcha; en cualquier otro caso se salta.
 * Cubre CA-003-01 a CA-003-06 y CA-003-09 contra un contenedor de verdad.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { DockerCli } from "../core/sandbox/docker-cli.js";
import { ETIQUETA } from "../core/sandbox/politica.js";
import { SandboxRunner } from "../core/sandbox/sandbox-runner.js";
import { clasificar } from "../core/ciclo/router.js";

const cli = new DockerCli();
const activo = process.env.FORGE_TEST_DOCKER === "1" && (await cli.disponible()).ok;
const OK = { hayPruebas: true, pruebasIntactas: true };

/** Proyecto Node sin dependencias cuyo test es el script dado. */
function proyecto(script, extra = {}) {
  const cwd = mkdtempSync(join(tmpdir(), "forge-real-"));
  const archivos = {
    "package.json": JSON.stringify({ name: "demo", type: "module", scripts: { test: "node --test" } }),
    "tests/demo.test.js": `import { test } from 'node:test';\nimport assert from 'node:assert/strict';\n${script}\n`,
    ...extra,
  };
  for (const [ruta, contenido] of Object.entries(archivos)) {
    mkdirSync(join(cwd, ruta, ".."), { recursive: true });
    writeFileSync(join(cwd, ruta), contenido);
  }
  return cwd;
}

let n = 0;
const runner = (cwd, extra = {}) => new SandboxRunner({
  runId: `real-${process.pid}-${++n}`, dirMotor: join(cwd, ".sdd", "motor", "r"), lenguaje: "javascript", testCmd: "npm test", cli, ...extra,
});

describe("aislamiento con Docker real", { skip: !activo && "requiere FORGE_TEST_DOCKER=1 y Docker en marcha" }, () => {
  test("unas pruebas que pasan dan código 0 y categoría pass", async () => {
    const cwd = proyecto("test('suma', () => assert.equal(1 + 1, 2));");
    const r = await runner(cwd).test(cwd);
    assert.equal(r.exitCode, 0, r.stdout + r.stderr);
    assert.equal(clasificar(r, OK), "pass");
  });

  test("unas pruebas que fallan dan código distinto de 0 y categoría fail", async () => {
    const cwd = proyecto("test('suma', () => assert.equal(1 + 1, 3));");
    const r = await runner(cwd).test(cwd);
    assert.notEqual(r.exitCode, 0);
    assert.equal(r.infraError, false);
    assert.equal(clasificar(r, OK), "fail");
  });

  test("CA-003-01: el código en ejecución no tiene red", async () => {
    const cwd = proyecto("test('red', async () => { await assert.rejects(fetch('https://example.com')); });");
    const r = await runner(cwd).test(cwd);
    assert.equal(r.exitCode, 0, r.stdout + r.stderr);
  });

  test("CA-003-02 y CA-003-03: sin privilegios, raíz de solo lectura y el proyecto real intacto", async () => {
    const cwd = proyecto(`
      import fs from 'node:fs';
      test('aislado', () => {
        assert.equal(process.getuid(), 1000);
        assert.throws(() => fs.writeFileSync('/etc/x', 'x'), /EROFS/);
        assert.throws(() => fs.writeFileSync('/deps/x', 'x'));
        fs.writeFileSync('escrito-en-la-copia.txt', 'x');
        assert.ok(!fs.existsSync('.env'), 'los secretos no entran en la copia');
      });`, { ".env": "SECRETO=1" });
    const r = await runner(cwd).test(cwd);
    assert.equal(r.exitCode, 0, r.stdout + r.stderr);
    assert.ok(!existsSync(join(cwd, "escrito-en-la-copia.txt")), "lo escrito en el contenedor no llega al proyecto real");
    assert.deepEqual(readdirSync(cwd).sort(), [".env", ".sdd", "package.json", "tests"]);
  });

  test("CA-003-04: al superar el tiempo máximo se detiene y se clasifica como tiempo agotado", async () => {
    const cwd = proyecto("test('lento', async () => { await new Promise((r) => setTimeout(r, 60000)); });");
    const r = await runner(cwd, { timeoutMs: 6000 }).test(cwd);
    assert.equal(r.timedOut, true);
    assert.equal(clasificar(r, OK), "timeout");
  });

  test("CA-003-05: al superar la memoria se detiene sin afectar al anfitrión", async () => {
    const cwd = proyecto("test('memoria', () => { const a = []; for (;;) a.push(Buffer.alloc(50e6, 1)); });");
    const r = await runner(cwd, { limites: { memoria: "128m" } }).test(cwd);
    assert.notEqual(r.exitCode, 0);
    assert.equal(r.infraError, false);
    assert.equal(clasificar(r, OK), "fail");
  });

  test("CA-003-09: las dependencias declaradas están disponibles sin red", async () => {
    const cwd = proyecto("import leftPad from 'left-pad';\ntest('dep', () => assert.equal(leftPad('a', 3, '0'), '00a'));");
    writeFileSync(join(cwd, "package.json"), JSON.stringify({ name: "demo", type: "module", scripts: { test: "node --test" }, dependencies: { "left-pad": "1.3.0" } }));
    const sr = runner(cwd);
    const r = await sr.test(cwd);
    assert.equal(r.exitCode, 0, r.stdout + r.stderr);
    assert.match(String(sr.ultimaImagen?.imagen), /^forge-sbx:node-/);
  });

  test("Python: las dependencias de requirements.txt están disponibles sin red y el código de salida decide", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "forge-real-py-"));
    const lineas = (...l) => l.join("\n") + "\n";
    writeFileSync(join(cwd, "requirements.txt"), lineas("pytest==8.3.4"));
    writeFileSync(join(cwd, "pytest.ini"), lineas("[pytest]"));
    writeFileSync(join(cwd, "suma.py"), lineas("def suma(a, b):", "    return a + b"));
    writeFileSync(join(cwd, "test_suma.py"), lineas(
      "import socket",
      "import pytest",
      "from suma import suma",
      "",
      "def test_suma():",
      "    assert suma(2, 2) == 4",
      "",
      "def test_sin_red():",
      "    with pytest.raises(OSError):",
      "        socket.create_connection(('example.com', 80), timeout=3)",
    ));
    const py = () => runner(cwd, { lenguaje: "python", testCmd: "python -m pytest -q -p no:cacheprovider" });

    const sr = py();
    const pasa = await sr.test(cwd);
    assert.equal(pasa.exitCode, 0, pasa.stdout + pasa.stderr);
    assert.match(String(sr.ultimaImagen?.imagen), /^forge-sbx:python-/);

    writeFileSync(join(cwd, "suma.py"), lineas("def suma(a, b):", "    return a - b"));
    const falla = await py().test(cwd);
    assert.equal(falla.exitCode, 1, falla.stdout + falla.stderr);
    assert.equal(clasificar(falla, OK), "fail");
  });

  test("M1: una prueba que crea enlaces dentro de la copia no rompe las ejecuciones siguientes", async () => {
    const cwd = proyecto(`
      import fs from 'node:fs';
      test('enlaces', () => { fs.symlinkSync('..', 'x'); fs.symlinkSync('/etc/passwd', 'p'); fs.symlinkSync('x', 'bucle'); });`);
    const sr = runner(cwd);
    const a = await sr.test(cwd);
    assert.equal(a.exitCode, 0, a.stdout + a.stderr);
    const b = await sr.test(cwd);                       // antes lanzaba "El sistema no tiene acceso al archivo"
    assert.equal(b.infraError, false, b.stderr);
    assert.equal(b.exitCode, 0, b.stdout + b.stderr);
    assert.deepEqual(readdirSync(cwd).sort(), [".sdd", "package.json", "tests"], "el proyecto real no se tocó");
  });

  test("CA-003-06: no queda ningún contenedor de estas ejecuciones", async () => {
    // Solo los de este archivo: otros tests pueden tener contenedores vivos a la vez
    const ps = await cli.ejecutar(["ps", "-aq", "--filter", `label=${ETIQUETA}`, "--filter", `name=forge-sbx-real-${process.pid}-`]);
    assert.equal(ps.stdout.trim(), "");
  });

  test("el barrido de huérfanos solo afecta a los contenedores del mismo proyecto", async () => {
    const ajeno = `forge-sbx-ajeno-${process.pid}`;
    await cli.ejecutar(["run", "-d", "--rm", "--name", ajeno, "--label", ETIQUETA, "--label", "forge.proyecto=otro-proyecto", "--entrypoint", "sleep", "node:22-alpine", "30"]);
    try {
      const cwd = proyecto("test('x', () => {});");
      assert.equal(await runner(cwd).barrerHuerfanos(), 0);
      const vivo = await cli.ejecutar(["ps", "-q", "--filter", `name=${ajeno}`]);
      assert.notEqual(vivo.stdout.trim(), "", "el contenedor de otro proyecto sigue vivo");
    } finally {
      await cli.ejecutar(["rm", "-f", ajeno]);
    }
  });
});
