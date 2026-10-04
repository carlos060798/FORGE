// @ts-check
/**
 * T010 / T020 — Protocolo de archivos y confinamiento de escrituras (ADR-07).
 * Cubre CA-002-02 y CA-008-05.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  aplicarArchivos, esRutaDePrueba, extraerBloque, huella, huellasAlteradas, validarRuta,
} from "../core/ciclo/protocolo-archivos.js";
import { coincide } from "../core/glob.js";

/** Crea <tmp>/base/proy y devuelve la ruta del proyecto. */
function proyecto() {
  const base = mkdtempSync(join(tmpdir(), "forge-proto-"));
  const dir = join(base, "proy");
  mkdirSync(dir);
  return { base, dir };
}

describe("extraerBloque", () => {
  test("lee un bloque JSON cercado entre texto", () => {
    const r = extraerBloque('Aquí va:\n```json\n{"archivos":[{"ruta":"src/a.js","contenido":"x"}]}\n```\nListo.');
    assert.deepEqual(r, { ok: true, archivos: [{ ruta: "src/a.js", contenido: "x" }] });
  });

  test("lee JSON sin cerca", () => {
    const r = extraerBloque('{"archivos":[{"ruta":"a.js","contenido":"}"}]}');
    assert.equal(r.ok, true);
  });

  test("descarta campos sobrantes de cada archivo", () => {
    const r = extraerBloque('{"archivos":[{"ruta":"a.js","contenido":"x","modo":"777"}]}');
    assert.deepEqual(r.ok && r.archivos[0], { ruta: "a.js", contenido: "x" });
  });

  test("informa de por qué no puede interpretar la salida", () => {
    assert.match(String(/** @type {any} */ (extraerBloque("no hay nada")).error), /no contiene/);
    assert.match(String(/** @type {any} */ (extraerBloque("{ roto")).error), /no contiene|inválido/);
    assert.match(String(/** @type {any} */ (extraerBloque('{"otra":1}')).error), /archivos/);
    assert.match(String(/** @type {any} */ (extraerBloque('{"archivos":[{"ruta":"a"}]}')).error), /ruta.*contenido/);
    assert.match(String(/** @type {any} */ (extraerBloque('{"archivos":[{"ruta":"","contenido":"x"}]}')).error), /ruta.*contenido/);
  });
});

describe("validarRuta — confinamiento", () => {
  const { dir } = proyecto();
  const motivo = (ruta, o) => /** @type {any} */ (validarRuta(dir, ruta, o)).motivo;

  test("acepta una ruta relativa dentro del proyecto y la normaliza", () => {
    const r = validarRuta(dir, "src/./sub/../a.js");
    assert.equal(r.ok && r.rutaPosix, "src/a.js");
  });

  test("rechaza traversal", () => {
    assert.equal(motivo("../fuera.js"), "fuera_del_proyecto");
    assert.equal(motivo("src/../../fuera.js"), "fuera_del_proyecto");
  });

  test("rechaza la carpeta vecina con prefijo igual", () => {
    assert.equal(motivo("../proy-malo/x.js"), "fuera_del_proyecto");
  });

  test("rechaza rutas absolutas en cualquier formato", () => {
    assert.equal(motivo(join(dir, "a.js")), "ruta_absoluta");
    assert.equal(motivo("/etc/passwd"), "ruta_absoluta");
    assert.equal(motivo("C:\\Windows\\x.dll"), "ruta_absoluta");
    assert.equal(motivo("\\\\servidor\\recurso\\x"), "ruta_absoluta");
  });

  test("rechaza la raíz del proyecto", () => {
    assert.equal(motivo("."), "fuera_del_proyecto");
  });

  test("rechaza rutas vetadas", () => {
    for (const ruta of [".git/config", ".sdd/estado.json", ".env", ".env.local", "config/.env.prod", "claves/servidor.pem", "secrets/token.txt", "node_modules/x/index.js"]) {
      assert.equal(motivo(ruta), "ruta_vetada", ruta);
    }
  });

  test("admite vetos adicionales de la configuración", () => {
    assert.equal(motivo("infra/prod.tfvars", { vetadas: ["**/*.tfvars"] }), "ruta_vetada");
    assert.equal(motivo("docs/credentials.md", { vetadas: ["**/credentials*"] }), "ruta_vetada");
  });

  test("CA-008-05: un manifiesto de dependencias exige revisión", () => {
    for (const ruta of ["package.json", "api/package.json", "requirements.txt", "pyproject.toml"]) {
      assert.equal(motivo(ruta), "dependencias", ruta);
    }
  });

  test("un enlace simbólico no sirve para salir del proyecto", (t) => {
    const { base, dir: d } = proyecto();
    const fuera = join(base, "fuera");
    mkdirSync(fuera);
    try {
      symlinkSync(fuera, join(d, "enlace"), "junction");
    } catch {
      t.skip("este sistema no permite crear enlaces");
      return;
    }
    assert.equal(/** @type {any} */ (validarRuta(d, "enlace/x.js")).motivo, "fuera_del_proyecto");
  });
});

describe("aplicarArchivos — roles", () => {
  test("qa solo puede escribir pruebas", () => {
    const { dir } = proyecto();
    const r = aplicarArchivos(dir, [
      { ruta: "tests/suma.test.js", contenido: "t" },
      { ruta: "src/suma.js", contenido: "trampa" },
    ], { rol: "qa" });
    assert.deepEqual(r.escritos.map((e) => e.ruta), ["tests/suma.test.js"]);
    assert.deepEqual(r.rechazados, [{ ruta: "src/suma.js", motivo: "no_es_prueba" }]);
    assert.ok(!existsSync(join(dir, "src", "suma.js")));
  });

  test("CA-002-02: el implementador no puede modificar ni crear pruebas", () => {
    const { dir } = proyecto();
    const qa = aplicarArchivos(dir, [{ ruta: "tests/suma.test.js", contenido: "original" }], { rol: "qa" });
    const r = aplicarArchivos(dir, [
      { ruta: "src/suma.js", contenido: "impl" },
      { ruta: "tests/suma.test.js", contenido: "assert(true)" },
      { ruta: "tests/otra.test.js", contenido: "assert(true)" },
    ], { rol: "coder", pruebas: qa.escritos.map((e) => e.ruta) });

    assert.deepEqual(r.escritos.map((e) => e.ruta), ["src/suma.js"]);
    assert.deepEqual(r.rechazados.map((x) => x.motivo), ["prueba_inmutable", "prueba_inmutable"]);
    assert.equal(readFileSync(join(dir, "tests", "suma.test.js"), "utf8"), "original");
    assert.ok(!existsSync(join(dir, "tests", "otra.test.js")));
  });

  test("CA-008-05: un cambio de manifiesto no se aplica y se señala", () => {
    const { dir } = proyecto();
    writeFileSync(join(dir, "package.json"), '{"name":"x"}');
    const r = aplicarArchivos(dir, [
      { ruta: "src/a.js", contenido: "a" },
      { ruta: "package.json", contenido: '{"dependencies":{"malo":"*"}}' },
    ], { rol: "coder" });
    assert.equal(r.requiereRevision, true);
    assert.equal(readFileSync(join(dir, "package.json"), "utf8"), '{"name":"x"}');
    assert.deepEqual(r.escritos.map((e) => e.ruta), ["src/a.js"]);
  });

  test("nada sale del proyecto aunque el lote mezcle rutas válidas y maliciosas", () => {
    const { base, dir } = proyecto();
    const r = aplicarArchivos(dir, [
      { ruta: "../proy-malo/x.js", contenido: "x" },
      { ruta: "../../x.js", contenido: "x" },
      { ruta: ".git/hooks/pre-commit", contenido: "x" },
      { ruta: "src/ok.js", contenido: "ok" },
    ], { rol: "coder" });
    assert.equal(r.escritos.length, 1);
    assert.equal(r.rechazados.length, 3);
    assert.ok(!existsSync(join(base, "proy-malo")));
    assert.ok(!existsSync(join(dir, ".git")));
    assert.equal(r.requiereRevision, false);
  });

  test("crea las carpetas intermedias y registra la huella del contenido", () => {
    const { dir } = proyecto();
    const r = aplicarArchivos(dir, [{ ruta: "src/a/b/c.js", contenido: "hola" }], { rol: "coder" });
    assert.equal(r.escritos[0].sha256, huella("hola"));
    assert.equal(readFileSync(join(dir, "src", "a", "b", "c.js"), "utf8"), "hola");
  });
});

describe("huellasAlteradas", () => {
  test("detecta un archivo modificado y uno borrado", () => {
    const { dir } = proyecto();
    const { escritos } = aplicarArchivos(dir, [
      { ruta: "tests/a.test.js", contenido: "a" },
      { ruta: "tests/b.test.js", contenido: "b" },
    ], { rol: "qa" });
    assert.deepEqual(huellasAlteradas(dir, escritos), []);

    writeFileSync(join(dir, "tests", "a.test.js"), "cambiado");
    assert.deepEqual(huellasAlteradas(dir, escritos), ["tests/a.test.js"]);
    assert.deepEqual(huellasAlteradas(dir, [{ ruta: "tests/no-existe.test.js", sha256: "x" }]), ["tests/no-existe.test.js"]);
  });
});

describe("esRutaDePrueba y coincide", () => {
  test("reconoce las convenciones de JavaScript y Python", () => {
    for (const r of ["tests/a.js", "test/a.py", "src/__tests__/a.ts", "src/a.test.ts", "src/a.spec.jsx", "pkg/test_a.py", "pkg/a_test.py"]) {
      assert.ok(esRutaDePrueba(r), r);
    }
    for (const r of ["src/a.js", "src/contest.js", "src/testigo.py", "latest/a.js"]) {
      assert.ok(!esRutaDePrueba(r), r);
    }
  });

  test("un patrón sin barra se compara con el nombre del archivo", () => {
    assert.ok(coincide("a/b/.env.local", ".env*"));
    assert.ok(!coincide("a/b/x.env", ".env*"));
    assert.ok(coincide("secrets/a/b.txt", "secrets/**"));
    assert.ok(!coincide("src/secrets.js", "secrets/**"));
  });
});

describe("seguridad — rutas que en Windows y macOS apuntan a otro archivo (T038)", () => {
  function proyectoConGit() {
    const { dir } = proyecto();
    mkdirSync(join(dir, ".git"));
    writeFileSync(join(dir, ".git", "config"), "original");
    mkdirSync(join(dir, "tests"));
    writeFileSync(join(dir, "tests", "a.test.js"), "prueba original");
    writeFileSync(join(dir, "package.json"), "{}");
    return dir;
  }
  const motivo = (dir, ruta) => /** @type {any} */ (validarRuta(dir, ruta)).motivo;

  test("las mayúsculas no sirven para saltarse una ruta vetada o un manifiesto", () => {
    const dir = proyectoConGit();
    assert.equal(motivo(dir, ".GIT/config"), "ruta_vetada");
    assert.equal(motivo(dir, ".Sdd/estado.json"), "ruta_vetada");
    assert.equal(motivo(dir, ".ENV"), "ruta_vetada");
    assert.equal(motivo(dir, "Node_Modules/x/index.js"), "ruta_vetada");
    assert.equal(motivo(dir, "PACKAGE.JSON"), "dependencias");
    assert.equal(motivo(dir, "api/Requirements.TXT"), "dependencias");
  });

  test("se rechazan puntos y espacios finales, flujos alternativos, nombres cortos y dispositivos", () => {
    const dir = proyectoConGit();
    for (const ruta of [".git./config", ".git /config", "package.json.", "tests/a.test.js.", "tests/a.test.js::$DATA", "src/a.js:oculto", "GIT~1/config", "CON", "src/nul.js", "src/a?.js", "src/a\u0001.js"]) {
      assert.equal(motivo(dir, ruta), "ruta_no_portable", JSON.stringify(ruta));
    }
  });

  test("el implementador no puede pisar una prueba cambiando las mayúsculas", () => {
    const dir = proyectoConGit();
    const r = aplicarArchivos(dir, [
      { ruta: "Tests/A.TEST.JS", contenido: "trampa" },
      { ruta: "TESTS/otra.Test.js", contenido: "trampa" },
      { ruta: ".GIT/config", contenido: "PWNED" },
      { ruta: "PACKAGE.JSON", contenido: '{"scripts":{"test":"true"}}' },
    ], { rol: "coder", pruebas: ["tests/a.test.js"] });

    assert.deepEqual(r.escritos, []);
    assert.deepEqual(r.rechazados.map((x) => x.motivo), ["prueba_inmutable", "prueba_inmutable", "ruta_vetada", "dependencias"]);
    assert.equal(readFileSync(join(dir, "tests", "a.test.js"), "utf8"), "prueba original");
    assert.equal(readFileSync(join(dir, ".git", "config"), "utf8"), "original");
    assert.equal(readFileSync(join(dir, "package.json"), "utf8"), "{}");
  });

  test("tampoco se entregan a un modelo credenciales ni la configuración de Claude Code", () => {
    const dir = proyectoConGit();
    for (const ruta of ["config/credentials.json", "src/client_secret.json", ".aws/credentials", ".ssh/id_rsa", ".claude/settings.json", "certs/servidor.P12"]) {
      assert.equal(motivo(dir, ruta), "ruta_vetada", ruta);
    }
  });

  test("los nombres normales con puntos, guiones y acentos siguen aceptándose", () => {
    const dir = proyectoConGit();
    for (const ruta of ["src/mi-módulo.v2.js", "src/a.b.c/índice.ts", "docs/LÉEME.md", "src/console.js", "src/auxiliar.py"]) {
      assert.equal(validarRuta(dir, ruta).ok, true, ruta);
    }
  });
});
