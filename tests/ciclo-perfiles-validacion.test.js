// @ts-check
/**
 * Validación del perfil del proyecto (spec 2026-10-14-perfiles-de-agente, CA-001-02; tarea F2.1).
 * Una clave desconocida, una herramienta que no existe o un valor mal formado en la sección `perfiles:` de
 * `.sdd/sdd.config.yaml` es un error que nombra el archivo y la clave. No se ignora en silencio.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { ErrorPerfil, perfilPorDefecto, resolverPerfil } from "../core/ciclo/perfiles.js";

/** Un proyecto con `.sdd/sdd.config.yaml` = `yaml`. Sin `yaml`, el proyecto no tiene archivo de configuración. */
function proyecto(/** @type {string|null} */ yaml) {
  const cwd = mkdtempSync(join(tmpdir(), "forge-perfil-validacion-"));
  if (yaml !== null) {
    mkdirSync(join(cwd, ".sdd"), { recursive: true });
    writeFileSync(join(cwd, ".sdd", "sdd.config.yaml"), yaml, "utf8");
  }
  return cwd;
}

/** @param {() => unknown} f @returns {string} el mensaje del error que lanza f */
function errorDe(f) {
  try { f(); } catch (e) {
    assert.ok(e instanceof ErrorPerfil, `debía ser ErrorPerfil: ${String(e)}`);
    return /** @type {Error} */ (e).message;
  }
  assert.fail("debía fallar");
}

describe("F2.1 — perfil del proyecto válido", () => {
  test("un perfil bien formado se resuelve sin errores y aprieta lo que pide", () => {
    const cwd = proyecto("perfiles:\n  coder_herramientas: leer_archivo,listar,editar\n  coder_pasos_max: 5\n");
    const { perfil, avisos } = resolverPerfil("coder", { cwd });
    assert.deepEqual(perfil.herramientas, ["leer_archivo", "listar", "editar"]);
    assert.equal(perfil.pasosMax, 5);
    assert.deepEqual(avisos, []);
  });

  test("sin archivo de configuración no hay capa de proyecto: el perfil es el de siempre", () => {
    const { perfil } = resolverPerfil("coder", { cwd: proyecto(null) });
    assert.deepEqual(perfil, perfilPorDefecto("coder"));
  });
});

describe("F2.1 — errores del perfil del proyecto: nombran archivo y clave", () => {
  test("clave desconocida: el mensaje dice el archivo, la clave y lo que sí existe", () => {
    const m = errorDe(() => resolverPerfil("coder", { cwd: proyecto("perfiles:\n  coder_herramientsa: editar\n") }));
    assert.match(m, /\.sdd\/sdd\.config\.yaml/);
    assert.match(m, /perfiles\.coder_herramientsa/);
    assert.match(m, /clave desconocida/);
  });

  test("herramienta inexistente: el mensaje dice el archivo, la clave y el nombre que no existe", () => {
    const m = errorDe(() => resolverPerfil("coder", { cwd: proyecto("perfiles:\n  coder_herramientas: leer_archivo,Bash\n") }));
    assert.match(m, /\.sdd\/sdd\.config\.yaml/);
    assert.match(m, /perfiles\.coder_herramientas/);
    assert.match(m, /"Bash"/);
    assert.match(m, /leer_archivo, listar, buscar, editar, ejecutar_pruebas/, "dice cuáles existen");
  });

  test("valor mal formado (pasos_max no es un entero): el mensaje dice el archivo, la clave y el valor", () => {
    const m = errorDe(() => resolverPerfil("coder", { cwd: proyecto("perfiles:\n  coder_pasos_max: muchos\n") }));
    assert.match(m, /\.sdd\/sdd\.config\.yaml/);
    assert.match(m, /perfiles\.coder_pasos_max/);
    assert.match(m, /"muchos"/);
  });

  test("valor mal formado en rutas_escribir (absoluta): archivo y clave", () => {
    const m = errorDe(() => resolverPerfil("coder", { cwd: proyecto("perfiles:\n  coder_rutas_escribir: /etc/\n") }));
    assert.match(m, /\.sdd\/sdd\.config\.yaml/);
    assert.match(m, /perfiles\.coder_rutas_escribir/);
  });

  test("los errores de la capa del usuario nombran la variable de entorno, no el archivo", () => {
    const m = errorDe(() => resolverPerfil("coder", { cwd: proyecto(null), usuario: { pasos_max: "muchos" } }));
    assert.match(m, /FRAGUA_PERFIL_CODER_PASOS_MAX/);
    assert.doesNotMatch(m, /sdd\.config\.yaml/);
  });
});

import * as fsM2 from 'node:fs';
import * as osM2 from 'node:os';
import * as pathM2 from 'node:path';
import { leerPerfilesDeProyecto as leerPerfilesM2 } from '../core/ciclo/perfiles.js';

test('M2: una cabecera «perfiles:» con sangría se rechaza en vez de ignorarse', () => {
  const dir = fsM2.mkdtempSync(pathM2.join(osM2.tmpdir(), 'perf-'));
  try {
    fsM2.mkdirSync(pathM2.join(dir, '.sdd'));
    fsM2.writeFileSync(pathM2.join(dir, '.sdd', 'sdd.config.yaml'), 'motor:\n  x: 1\n  perfiles:\n    coder_herramientas: leer_archivo\n');
    assert.throws(() => leerPerfilesM2(dir), /sangría/);
    fsM2.writeFileSync(pathM2.join(dir, '.sdd', 'sdd.config.yaml'), 'perfiles:\n  coder_herramientas: leer_archivo\n');
    assert.deepEqual(leerPerfilesM2(dir), { coder: { herramientas: 'leer_archivo' } });
  } finally { fsM2.rmSync(dir, { recursive: true, force: true }); }
});
