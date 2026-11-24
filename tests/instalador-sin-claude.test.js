// @ts-check
/**
 * El instalador no habla de Claude Code cuando se instala para otra herramienta (informe de agnosticismo del 2026-11-24,
 * ALTO-3 / H8): rótulo neutro, línea «Modo» sin la carpeta `.claude`, sin el aviso de que la CLI de Claude no está en el PATH,
 * y una ayuda que no manda «abre Claude Code» a quien usa Codex o Cursor.
 * Criterio CA-003-08 de la spec 2026-11-11-guardian-fuera-de-claude-code.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { forge } from "./instalacion-ayudas.js";

const temporal = (p) => realpathSync(mkdtempSync(join(tmpdir(), p)));

/** @param {string[]} args */
function instalar(args) {
  const cwd = temporal("forge-isc-");
  const home = temporal("forge-isc-home-");
  try { return forge(cwd, home, ...args).salida; } finally { rmSync(cwd, { recursive: true, force: true }); rmSync(home, { recursive: true, force: true }); }
}

describe("init para otra herramienta no habla de Claude Code", () => {
  for (const [clave, nombre] of [["codex", "Codex CLI"], ["cursor", "Cursor"], ["gemini", "Gemini CLI"], ["kiro", "Kiro"]]) {
    test(`${clave}: rótulo neutro, «Modo» con la herramienta y sin el aviso de la CLI de Claude`, () => {
      const s = instalar(["init", "--integracion", clave]);
      assert.match(s, /Fragua — Desarrollo guiado por especificaciones/);
      assert.match(s, new RegExp(`Modo: PROYECTO \\(${nombre}\\)`));
      assert.doesNotMatch(s, /Tu equipo técnico en Claude Code/);
      assert.doesNotMatch(s, /Claude Code CLI no detectado/);
      assert.doesNotMatch(s, /Modo: PROYECTO \([^)]*\.claude\)/);
    });
  }
  test("con Claude Code (sin opciones) se conserva la carpeta .claude en «Modo»", () => {
    const s = instalar(["init"]);
    assert.match(s, /Fragua — Desarrollo guiado por especificaciones/);
    assert.match(s, /Modo: PROYECTO \([^)]*\.claude\)/);
  });
});

describe("la ayuda no manda a abrir Claude Code a todo el mundo", () => {
  const ayuda = () => instalar(["help"]);
  test("explica el flujo para Claude Code y para otras herramientas", () => {
    const s = ayuda();
    assert.doesNotMatch(s, /Tras instalar, abre Claude Code y escribe/);
    assert.match(s, /\/forge "describe tu idea aquí"/);
    assert.match(s, /Codex/);
    assert.match(s, /USO-EN-OTRAS-HERRAMIENTAS/);
  });
});
