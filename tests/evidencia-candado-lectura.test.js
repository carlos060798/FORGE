// @ts-check
/**
 * F6.7 de `2026-10-14-puertas-de-calidad-y-evidencia`: la lectura de la cabeza de la cadena (`comprobarEvidencia`)
 * va bajo el mismo candado de proyecto que el registro (`registrarEncadenado`). Sin él, una lectura entre
 * «informe escrito» y «cabeza guardada» vería una cadena desfasada que no existe en el disco.
 */
import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

import { comprobarEvidencia } from "../core/evidencia/cadena.js";

const base = realpathSync(mkdtempSync(join(tmpdir(), "forge-candado-lectura-")));
after(() => rmSync(base, { recursive: true, force: true }));
let n = 0;

/** Un proyecto con su carpeta de informes (sin informes: lo que importa aquí es el candado, no la cadena). */
function proyecto() {
  const dir = join(base, `p${++n}`);
  mkdirSync(join(dir, ".sdd", "verificaciones"), { recursive: true });
  return dir;
}

/** Espera (síncrona, sin reloj fino) a que exista un archivo. */
function esperarArchivo(ruta, limiteMs = 10_000) {
  const t0 = Date.now();
  while (!existsSync(ruta)) {
    if (Date.now() - t0 > limiteMs) throw new Error(`no apareció ${ruta}`);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
  }
}

describe("comprobarEvidencia bajo el candado del registro (F6.7)", () => {
  test("una comprobación espera a un registro en curso (candado vivo de otro proceso) antes de leer", async () => {
    const dir = proyecto();
    const cerrojo = join(resolve(dir), ".sdd", "verificaciones", "registro.lock");
    const centinela = join(base, `centinela-${n}`);
    const script = join(base, `hijo-${n}.mjs`);
    writeFileSync(script, [
      `import { adquirir } from ${JSON.stringify(pathToFileURL(resolve("core", "ciclo", "candado.js")).href)};`,
      "import { writeFileSync } from 'node:fs';",
      "const liberar = adquirir(process.argv[2], 'Registro simulado');",
      "writeFileSync(process.argv[3], 'ok');",
      "await new Promise((r) => setTimeout(r, 1500));",
      "liberar();",
    ].join("\n") + "\n");

    const hijo = spawn(process.execPath, [script, cerrojo, centinela], { stdio: "ignore", windowsHide: true });
    const terminado = new Promise((res) => hijo.on("close", res));
    try {
      esperarArchivo(centinela);                       // el hijo ya tiene el candado puesto
      const t0 = Date.now();
      const r = comprobarEvidencia(dir);
      const esperado = Date.now() - t0;
      assert.ok(esperado >= 500, `la comprobación leyó sin esperar al registro (${esperado} ms)`);
      assert.equal(r.informes, 0);
    } finally {
      await terminado;
    }
    assert.equal(existsSync(cerrojo), false, "no queda el candado puesto");
  });

  test("un candado de un proceso muerto no bloquea la comprobación", () => {
    const dir = proyecto();
    const cerrojo = join(dir, ".sdd", "verificaciones", "registro.lock");
    writeFileSync(cerrojo, JSON.stringify({ pid: 999_999_999, ts: 0 }));
    const t0 = Date.now();
    const r = comprobarEvidencia(dir);
    assert.ok(Date.now() - t0 < 5000, "no debe esperar a un candado huérfano");
    assert.equal(r.informes, 0);
  });

  test("sin carpeta de informes, comprobar no crea nada en el proyecto (sigue siendo solo lectura)", () => {
    const dir = join(base, `sin-sdd-${++n}`);
    mkdirSync(dir);
    const r = comprobarEvidencia(dir);
    assert.equal(r.informes, 0);
    assert.equal(existsSync(join(dir, ".sdd")), false);
  });
});
