// @ts-check
/**
 * Las skills cuyo núcleo es un script de Claude Code (`claude-hooks/`) no se instalan en otras herramientas, y los
 * identificadores de modelo de Claude de los comandos pasan a niveles neutrales (informe de agnosticismo del 2026-11-24,
 * H-B3 y H-B4). Criterios CA-004-05 y CA-004-06 de la spec 2026-11-10-metodologia-agnostica.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { SKILLS_SOLO_CLAUDE, adaptarCuerpo, notaDeAnfitrion } from "../core/instalacion/adaptar-anfitrion.js";
import { ROOT, forge } from "./instalacion-ayudas.js";

const temporal = (p) => realpathSync(mkdtempSync(join(tmpdir(), p)));
const LISTA = ["cache-audit", "compresion-tokens", "effort-router", "indexar-proyecto", "sdd-crear-agente"];

describe("SKILLS_SOLO_CLAUDE", () => {
  test("es exactamente la lista conocida", () => assert.deepEqual([...SKILLS_SOLO_CLAUDE].sort(), LISTA));
  test("cada nombre existe como skill propia o generada", () => {
    for (const n of SKILLS_SOLO_CLAUDE) {
      assert.ok(existsSync(join(ROOT, "skills", n, "SKILL.md")) || existsSync(join(ROOT, "skills-generadas", n, "SKILL.md")), n);
    }
  });
});

describe("instalar para otra herramienta", () => {
  for (const clave of ["codex", "cursor"]) {
    test(`${clave}: no instala esas skills, las nombra en el resumen y no deja scripts de claude-hooks`, () => {
      const cwd = temporal("forge-sc-"); const home = temporal("forge-sc-h-");
      try {
        const r = forge(cwd, home, "init", "--integracion", clave);
        assert.match(r.salida, /solo de Claude Code/i);
        const raiz = join(cwd, clave === "cursor" ? ".cursor" : ".agents", "skills");
        const instaladas = readdirSync(raiz);
        for (const n of LISTA) assert.ok(!instaladas.includes(n), `${n} no debe instalarse`);
        for (const n of instaladas) {
          const md = readFileSync(join(raiz, n, "SKILL.md"), "utf8");
          assert.doesNotMatch(md, /claude-(opus|sonnet|haiku)-\d/, n);
        }
      } finally { rmSync(cwd, { recursive: true, force: true }); rmSync(home, { recursive: true, force: true }); }
    });
  }
  test("con Claude Code se instalan todas", () => {
    const cwd = temporal("forge-sc-"); const home = temporal("forge-sc-h-");
    try {
      forge(cwd, home, "init");
      for (const n of LISTA.filter((x) => x !== "sdd-crear-agente")) assert.ok(existsSync(join(cwd, ".claude", "skills", n, "SKILL.md")), n);
    } finally { rmSync(cwd, { recursive: true, force: true }); rmSync(home, { recursive: true, force: true }); }
  });
});

describe("adaptarCuerpo: identificadores de modelo", () => {
  const ad = (t) => adaptarCuerpo(t, { prefijo: "", comandos: [] });
  test("los ids de Claude pasan a niveles neutrales", () => {
    assert.equal(ad("usa claude-opus-4-8"), "usa «alto»");
    assert.equal(ad("claude-sonnet-4-6"), "«medio»");
    assert.equal(ad("claude-haiku-4-5-20251001"), "«economico»");
  });
  test("no se come la puntuación que sigue al id", () => {
    assert.equal(ad("usa claude-sonnet-4-5. Luego sigue"), "usa «medio». Luego sigue");
    assert.equal(ad("(claude-opus-4-8), y más"), "(«alto»), y más");
  });
  test("texto sin ids no cambia", () => assert.equal(ad("modelo medio"), "modelo medio"));
});

describe("referencias a skills que no se instalan", () => {
  test("deploy-vercel es neutral (usa el MCP de la herramienta) y sigue instalándose", () => {
    assert.ok(!SKILLS_SOLO_CLAUDE.includes("deploy-vercel"));
  });
  test("la nota de anfitrión nombra las skills ausentes y dice que se salten", () => {
    const n = notaDeAnfitrion("$");
    for (const x of SKILLS_SOLO_CLAUDE) assert.ok(n.includes(x), x);
    assert.match(n, /no se instalan/i);
  });
});
