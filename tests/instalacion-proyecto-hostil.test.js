// @ts-check
/**
 * Revisión independiente (hallazgo MEDIA): un archivo del proyecto no puede dirigir la instalación a
 * escribir en la carpeta personal del usuario.
 *
 * Antes: `instalacion.carpeta_skills` de `.sdd/sdd.config.yaml` (no confiable) con una ruta absoluta bajo
 * el HOME hacía que `forge update` escribiera allí, sin proteger archivos ajenos y con el HOME entero
 * como raíz de escritura.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { validarCarpetaSkills } from "../core/instalacion/herramientas-destino.js";
import { forge } from "./instalacion-ayudas.js";

const temporal = (p) => realpathSync(mkdtempSync(join(tmpdir(), p)));

/** Proyecto «ajeno» cuya configuración fija una carpeta de skills. */
function proyectoHostil(carpeta) {
  const d = temporal("forge-hostil-");
  writeFileSync(join(d, "package.json"), JSON.stringify({ name: "ajeno", scripts: { test: "node --test" } }));
  mkdirSync(join(d, ".sdd"));
  writeFileSync(join(d, ".sdd", "sdd.config.yaml"), `instalacion:\n  integracion: generica\n  perfil: completo\n  carpeta_skills: ${JSON.stringify(carpeta)}\n`);
  return d;
}

describe("validarCarpetaSkills con soloProyecto", () => {
  const proyecto = temporal("forge-p-");
  const personal = temporal("forge-h-");
  const c = { proyecto, personal };

  test("dentro del proyecto vale siempre", () => {
    assert.equal(validarCarpetaSkills(".mis/skills", { ...c, soloProyecto: true }).ok, true);
  });

  test("bajo la carpeta personal: vale desde la línea de comandos, no desde el archivo del proyecto", () => {
    const destino = join(personal, ".claude", "skills");
    assert.equal(validarCarpetaSkills(destino, c).ok, true);
    const r = validarCarpetaSkills(destino, { ...c, soloProyecto: true });
    assert.equal(r.ok, false);
    assert.match(/** @type {any} */ (r).error, /un archivo del proyecto no puede dirigir/);
  });

  test("la raíz de escritura es la propia carpeta, no toda la carpeta personal", () => {
    const destino = join(personal, ".tool", "skills");
    const r = /** @type {any} */ (validarCarpetaSkills(destino, c));
    assert.equal(r.ok, true);
    assert.equal(r.raiz, destino);
    assert.notEqual(r.raiz, personal);
  });
});

describe("forge update con una carpeta de skills hostil guardada en el proyecto", () => {
  test("no escribe en la carpeta personal y lo dice", () => {
    const home = temporal("forge-home-");
    const destino = join(home, ".ssh");
    mkdirSync(destino);
    const cwd = proyectoHostil(destino);
    const r = forge(cwd, home, "update");
    assert.notEqual(r.status, 0, r.salida);
    assert.match(r.salida, /fuera del proyecto|no puede dirigir/);
    assert.deepEqual(readdirSync(destino), [], "no se escribió nada en la carpeta personal");
  });

  test("tampoco con el init: la configuración del proyecto no concede la escritura", () => {
    const home = temporal("forge-home-");
    const destino = join(home, ".claude", "skills");
    mkdirSync(destino, { recursive: true });
    const cwd = proyectoHostil(destino);
    const r = forge(cwd, home, "init");
    assert.notEqual(r.status, 0, r.salida);
    assert.deepEqual(readdirSync(destino), []);
  });

  test("el usuario sí puede pedirlo expresamente con --carpeta-skills", () => {
    const home = temporal("forge-home-");
    const destino = join(home, ".mi-herramienta", "skills");
    const cwd = temporal("forge-limpio-");
    writeFileSync(join(cwd, "package.json"), JSON.stringify({ name: "mio", scripts: { test: "node --test" } }));
    const r = forge(cwd, home, "init", "--integracion", "generica", "--carpeta-skills", destino);
    assert.equal(r.status, 0, r.salida);
    assert.ok(existsSync(destino) && readdirSync(destino).length > 0);
  });
});
