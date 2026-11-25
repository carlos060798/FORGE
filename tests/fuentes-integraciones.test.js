// @ts-check
/**
 * Las fuentes de la tabla de integraciones apuntan a la página vigente, no a una URL que redirige (informe de
 * investigación web del 2026-11-24, leído de nuevo ese día). Criterios CA-005-01 y CA-005-02 de la spec 2026-11-10-metodologia-agnostica.
 *  - Codex: `developers.openai.com/codex/skills` redirige (308) a `learn.chatgpt.com/docs/build-skills`; la carpeta
 *    `.agents/skills`, la invocación `$nombre` o `/skills` y `name` + `description` obligatorios se comprobaron allí.
 *  - Windsurf: `docs.windsurf.com/windsurf/cascade/skills` redirige (307) a `docs.devin.ai/desktop/cascade/skills`, que documenta
 *    `/nombre` (no `@nombre`) y no menciona Cascade: la sintaxis `@nombre` que Fragua genera NO está confirmada.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { INTEGRACIONES } from "../core/instalacion/herramientas-destino.js";

describe("fuentes de la tabla de integraciones", () => {
  test("Codex y la carpeta común apuntan a la página vigente de Codex, con la fecha en que se releyó", () => {
    for (const clave of ["codex", "agents"]) {
      assert.equal(INTEGRACIONES[clave].fuente, "https://learn.chatgpt.com/docs/build-skills", clave);
      assert.equal(INTEGRACIONES[clave].consultado, "2026-11-24", clave);
    }
  });
  test("ninguna fuente apunta a una URL que se sabe que redirige", () => {
    for (const [clave, i] of Object.entries(INTEGRACIONES)) {
      assert.doesNotMatch(i.fuente ?? "", /developers\.openai\.com\/codex|docs\.windsurf\.com/, clave);
    }
  });
  test("Windsurf apunta a la documentación vigente y dice que `@nombre` no está confirmado", () => {
    assert.equal(INTEGRACIONES.windsurf.fuente, "https://docs.devin.ai/desktop/cascade/skills");
    assert.equal(INTEGRACIONES.windsurf.consultado, "2026-11-24");
    assert.match(INTEGRACIONES.windsurf.invocacion, /sin confirmar/i);
    assert.match(INTEGRACIONES.windsurf.invocacion, /\/<nombre>/);
  });
  test("la carpeta de skills de Codex y de Windsurf no cambia con la relectura", () => {
    assert.equal(INTEGRACIONES.codex.carpetaSkills, ".agents/skills");
    assert.equal(INTEGRACIONES.agents.carpetaSkills, ".agents/skills");
    assert.equal(INTEGRACIONES.windsurf.carpetaSkills, ".devin/skills");
  });
});
