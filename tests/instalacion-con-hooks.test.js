// @ts-check
/**
 * `forge update` recuerda `--con-hooks` (sección `instalacion` de .sdd/sdd.config.yaml) y `--sin-hooks` lo desactiva.
 * Plan docs/PLAN-AGNOSTICO.md, F3.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { PLANTILLAS_HOOKS } from "../core/instalacion/hooks-anfitrion.js";
import { forge } from "./instalacion-ayudas.js";

const temporal = (p) => realpathSync(mkdtempSync(join(tmpdir(), p)));
const yamlDe = (cwd) => readFileSync(join(cwd, ".sdd", "sdd.config.yaml"), "utf8");
const rutaHook = (cwd, a) => join(cwd, ...PLANTILLAS_HOOKS[a].ruta.split("/"));

describe("con_hooks se guarda y update lo recuerda", () => {
  test("init --con-hooks guarda con_hooks: true; update sin opciones lo conserva y no avisa de error", () => {
    const cwd = temporal("forge-ch-"), home = temporal("forge-ch-h-");
    assert.equal(forge(cwd, home, "init", "--integracion", "cursor", "--con-hooks").status, 0);
    assert.match(yamlDe(cwd), /^instalacion:\n(?: {2}.*\n)*? {2}con_hooks: true$/m);
    const antes = readFileSync(rutaHook(cwd, "cursor"), "utf8");
    const r = forge(cwd, home, "update");
    assert.equal(r.status, 0, r.salida);
    assert.equal(readFileSync(rutaHook(cwd, "cursor"), "utf8"), antes);
    assert.ok(!/no se modifica/.test(r.salida), r.salida);
    assert.match(r.salida, /ya registrado/);
    assert.match(yamlDe(cwd), /con_hooks: true/, "update sin opciones no lo pierde");
  });

  test("update reinstala el hook si se borró y la instalación lo pedía", () => {
    const cwd = temporal("forge-ch-"), home = temporal("forge-ch-h-");
    assert.equal(forge(cwd, home, "init", "--integracion", "codex", "--con-hooks").status, 0);
    rmSync(rutaHook(cwd, "codex"));
    const r = forge(cwd, home, "update");
    assert.equal(r.status, 0, r.salida);
    assert.ok(existsSync(rutaHook(cwd, "codex")));
  });

  test("sin --con-hooks no se guarda nada ni update escribe hooks", () => {
    const cwd = temporal("forge-ch-"), home = temporal("forge-ch-h-");
    assert.equal(forge(cwd, home, "init", "--integracion", "cursor").status, 0);
    assert.ok(!/con_hooks/.test(yamlDe(cwd)));
    assert.equal(forge(cwd, home, "update").status, 0);
    assert.ok(!existsSync(rutaHook(cwd, "cursor")));
  });

  test("--sin-hooks desactiva lo guardado y update lo respeta; el archivo existente no se borra", () => {
    const cwd = temporal("forge-ch-"), home = temporal("forge-ch-h-");
    assert.equal(forge(cwd, home, "init", "--integracion", "gemini", "--con-hooks").status, 0);
    const r = forge(cwd, home, "update", "--sin-hooks");
    assert.equal(r.status, 0, r.salida);
    assert.ok(!/con_hooks/.test(yamlDe(cwd)));
    assert.ok(existsSync(rutaHook(cwd, "gemini")), "no se borra lo ya escrito");
    const r2 = forge(cwd, home, "update");
    assert.equal(r2.status, 0, r2.salida);
    assert.ok(!/con_hooks/.test(yamlDe(cwd)));
  });

  test("--con-hooks y --sin-hooks juntos se rechazan antes de escribir", () => {
    const cwd = temporal("forge-ch-"), home = temporal("forge-ch-h-");
    const r = forge(cwd, home, "init", "--integracion", "cursor", "--con-hooks", "--sin-hooks");
    assert.notEqual(r.status, 0);
    assert.match(r.salida, /se excluyen/);
    assert.ok(!existsSync(join(cwd, ".cursor")));
  });
});

describe("el proyecto solo puede activar el registro, no elegir rutas", () => {
  test("con_hooks: true en un proyecto hostil escribe únicamente la ruta de la plantilla", () => {
    const cwd = temporal("forge-ch-"), home = temporal("forge-ch-h-");
    assert.equal(forge(cwd, home, "init", "--integracion", "cursor").status, 0);
    const yaml = yamlDe(cwd).replace(/^instalacion:\n/m, 'instalacion:\n  con_hooks: true\n  ruta_hook: "../fuera/hooks.json"\n');
    writeFileSync(join(cwd, ".sdd", "sdd.config.yaml"), yaml);
    const r = forge(cwd, home, "update");
    assert.equal(r.status, 0, r.salida);
    assert.ok(existsSync(rutaHook(cwd, "cursor")));
    assert.ok(!existsSync(join(cwd, "..", "fuera")));
  });
  test("un archivo propio del usuario en la ruta del hook no se pisa en update", () => {
    const cwd = temporal("forge-ch-"), home = temporal("forge-ch-h-");
    assert.equal(forge(cwd, home, "init", "--integracion", "cursor", "--con-hooks").status, 0);
    writeFileSync(rutaHook(cwd, "cursor"), '{"mio":true}\n');
    const r = forge(cwd, home, "update");
    assert.equal(r.status, 0, r.salida);
    assert.equal(readFileSync(rutaHook(cwd, "cursor"), "utf8"), '{"mio":true}\n');
    assert.match(r.salida, /no se modifica/);
  });
});
