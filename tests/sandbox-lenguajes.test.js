// @ts-check
/**
 * Más lenguajes en el sandbox: Go, y un divisor de comandos que entiende comillas.
 * Los tests con Docker real (FORGE_TEST_DOCKER=1) ejecutan `go test` aislado, sin red y con la raíz de solo lectura.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import { dividirComando, comandoDePruebas, SandboxRunner } from "../core/sandbox/sandbox-runner.js";
import { comprobarProyecto, dockerfile, lenguajeCubierto, IMAGENES_BASE } from "../core/sandbox/preparar-imagen.js";
import { clasificarRuta, esRutaDePrueba } from "../core/ciclo/protocolo-archivos.js";
import { DockerCli } from "../core/sandbox/docker-cli.js";

const tmp = () => mkdtempSync(join(tmpdir(), "forge-lang-"));
const escribir = (dir, ruta, contenido) => { mkdirSync(dirname(join(dir, ruta)), { recursive: true }); writeFileSync(join(dir, ruta), contenido); };

describe("dividirComando", () => {
  test("respeta comillas simples y dobles", () => {
    assert.deepEqual(dividirComando("npm test -- --grep \"a b\""), ["npm", "test", "--", "--grep", "a b"]);
    assert.deepEqual(dividirComando("pytest -k 'suma and resta' -q"), ["pytest", "-k", "suma and resta", "-q"]);
    assert.deepEqual(dividirComando("  go   test ./...  "), ["go", "test", "./..."]);
    assert.deepEqual(dividirComando("echo ''"), ["echo", ""]);
    assert.deepEqual(dividirComando("a\tb"), ["a", "b"]);
  });
  test("una comilla sin cerrar o un operador de shell son un error claro", () => {
    assert.throws(() => dividirComando("npm test --grep \"a"), /comilla sin cerrar/);
    for (const op of ["&&", "||", "|", ";", "&", ">", ">>", "<"]) {
      assert.throws(() => dividirComando("npm test " + op + " npm run lint"), /operador de shell/, op);
    }
    // Dentro de comillas es un texto, no un operador
    assert.deepEqual(dividirComando("node -e \"a && b\""), ["node", "-e", "a && b"]);
  });
  test("comandoDePruebas sigue quitando npx y exigiendo algo", () => {
    assert.deepEqual(comandoDePruebas("npx vitest run"), ["vitest", "run"]);
    assert.throws(() => comandoDePruebas("   "), /No hay comando de pruebas/);
  });
});

describe("Go: configuración", () => {
  test("está cubierto y usa su imagen base", () => {
    assert.ok(lenguajeCubierto("go"));
    assert.equal(IMAGENES_BASE.go, "golang:1.23-alpine");
    assert.ok(!lenguajeCubierto("rust"));
  });
  test("sin go.mod se avisa antes de gastar; con go.mod no hay problema", () => {
    const dir = tmp();
    assert.match(String(comprobarProyecto(dir, "go")), /go\.mod/);
    escribir(dir, "go.mod", "module demo\n\ngo 1.23\n");
    assert.equal(comprobarProyecto(dir, "go"), null);
    assert.match(String(comprobarProyecto(dir, "rust")), /JavaScript\/TypeScript, Python y Go/);
  });
  test("el Dockerfile descarga los módulos con red y nada más; la ejecución es sin red", () => {
    const t = dockerfile("go", "golang:1.23-alpine", ["go.mod", "go.sum"]);
    assert.match(t, /^FROM golang:1\.23-alpine/);
    assert.match(t, /COPY go\.mod go\.sum \.\//);
    assert.match(t, /ENV GOMODCACHE=\/deps\/gomod GOTOOLCHAIN=local/);
    assert.match(t, /RUN go mod download/);
    assert.ok(!/COPY \./.test(t.replace("COPY go.mod go.sum ./", "")), "no copia código del proyecto");
  });
  test("go.mod y go.sum exigen revisión humana y *_test.go es una prueba", () => {
    for (const r of ["go.mod", "go.sum", "sub/go.work", "go.work.sum"]) assert.equal(clasificarRuta(r), "dependencias", r);
    assert.equal(clasificarRuta("cmd/main.go"), null);
    assert.ok(esRutaDePrueba("pkg/suma_test.go") && esRutaDePrueba("suma_test.go"));
    assert.ok(!esRutaDePrueba("pkg/suma.go") && !esRutaDePrueba("pkg/testing.go"));
  });
  test("el runner de Go pasa las variables de Go por -e y respeta una comilla sin cerrar como fallo de infraestructura", async () => {
    const dir = tmp();
    escribir(dir, "go.mod", "module demo\n\ngo 1.23\n");
    const llamadas = [];
    const base = { code: 0, stdout: "", stderr: "", timedOut: false };
    const cli = new DockerCli({ ejecutar: async (args) => { llamadas.push(args); return args[0] === "version" ? { ...base, stdout: "29.0.0" } : { ...base }; } });
    const sr = new SandboxRunner({ runId: "r1", dirMotor: join(dir, ".sdd", "motor", "r1"), lenguaje: "go", testCmd: "go test ./...", cli });
    const r = await sr.test(dir);
    assert.equal(r.ok, true);
    const run = llamadas.find((a) => a[0] === "run");
    assert.ok(run, "se lanzó el contenedor");
    const texto = run.join(" ");
    for (const v of ["GOPROXY=off", "GOCACHE=/tmp/gocache", "CGO_ENABLED=0", "GOTOOLCHAIN=local"]) assert.ok(texto.includes(v), v);
    assert.ok(texto.includes("--network none"));

    const malo = new SandboxRunner({ runId: "r2", dirMotor: join(dir, ".sdd", "motor", "r2"), lenguaje: "go", testCmd: "go test \"./...", cli });
    const r2 = await malo.test(dir);
    assert.equal(r2.ok, false);
    assert.equal(r2.infraError, true);
    assert.match(r2.stderr, /comilla sin cerrar/);
  });
});

describe("Go con Docker real", { skip: process.env.FORGE_TEST_DOCKER !== "1" && "requiere FORGE_TEST_DOCKER=1 y Docker en marcha" }, () => {
  const usar = (dir, testCmd = "go test ./...") => new SandboxRunner({ runId: "go1", dirMotor: join(dir, ".sdd", "motor", "go1"), lenguaje: "go", testCmd, timeoutMs: 240_000 });

  test("sin dependencias: pasa cuando el código es correcto y falla cuando no", async () => {
    const dir = tmp();
    escribir(dir, "go.mod", "module demo\n\ngo 1.23\n");
    escribir(dir, "suma.go", "package demo\n\nfunc Suma(a, b int) int { return a + b }\n");
    escribir(dir, "suma_test.go", "package demo\n\nimport \"testing\"\n\nfunc TestSuma(t *testing.T) {\n\tif Suma(1, 2) != 3 {\n\t\tt.Fatal(\"mal\")\n\t}\n}\n");
    const sr = usar(dir);
    const bien = await sr.test(dir);
    assert.equal(bien.ok, true, bien.stderr + bien.stdout);
    assert.match(bien.stdout, /ok\s+demo/);

    escribir(dir, "suma.go", "package demo\n\nfunc Suma(a, b int) int { return a - b }\n");
    const mal = await sr.test(dir);
    assert.equal(mal.ok, false);
    assert.equal(mal.exitCode, 1);
    assert.match(mal.stdout + mal.stderr, /FAIL/);
  });

  test("con una dependencia: se descarga al preparar la imagen y las pruebas corren sin red", async () => {
    const dir = tmp();
    escribir(dir, "go.mod", "module demo\n\ngo 1.23\n\nrequire github.com/google/uuid v1.6.0\n");
    escribir(dir, "go.sum", "github.com/google/uuid v1.6.0 h1:NIvaJDMOsjHA8n1jAhLSgzrAzy1Hgr+hNrb57e+94F0=\ngithub.com/google/uuid v1.6.0/go.mod h1:TIyPZe4MgqvfeYDBFedMoGGpEw/LqOeaOT+nhxU+yHo=\n");
    escribir(dir, "id.go", "package demo\n\nimport \"github.com/google/uuid\"\n\nfunc Nuevo() string { return uuid.NewString() }\n");
    escribir(dir, "id_test.go", "package demo\n\nimport \"testing\"\n\nfunc TestNuevo(t *testing.T) {\n\tif len(Nuevo()) != 36 {\n\t\tt.Fatal(\"mal\")\n\t}\n}\n");
    const sr = usar(dir);
    const r = await sr.test(dir);
    assert.equal(r.ok, true, r.stderr + r.stdout);
    assert.match(String(sr.ultimaImagen?.imagen), /^forge-sbx:go-/);
  });

  test("el código de pruebas no tiene red ni puede escribir en la raíz", async () => {
    const dir = tmp();
    escribir(dir, "go.mod", "module demo\n\ngo 1.23\n");
    escribir(dir, "red_test.go", [
      "package demo", "", "import (", "\t\"net\"", "\t\"os\"", "\t\"testing\"", "\t\"time\"", ")", "",
      "func TestAislado(t *testing.T) {",
      "\tif c, err := net.DialTimeout(\"tcp\", \"1.1.1.1:53\", 2*time.Second); err == nil {",
      "\t\tc.Close()", "\t\tt.Fatal(\"hay red\")", "\t}",
      "\tif err := os.WriteFile(\"/usr/escrito\", []byte(\"x\"), 0o644); err == nil {",
      "\t\tt.Fatal(\"se pudo escribir en la raíz\")", "\t}",
      "}", "",
    ].join("\n"));
    const r = await usar(dir).test(dir);
    assert.equal(r.ok, true, r.stderr + r.stdout);
  });
});
