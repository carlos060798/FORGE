// @ts-check
/**
 * S0 CA-004-01 (ADR-16): la guarda de escritura lee los ADR aceptados de .sdd/arquitectura,
 * pero solo los términos de la sección "## Patrones prohibidos".
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";

const HOOK = join(dirname(fileURLToPath(import.meta.url)), "../claude-hooks/pre-tool-guard.js");

function proyecto(adrs) {
  const dir = mkdtempSync(join(tmpdir(), "forge-guarda-"));
  mkdirSync(join(dir, ".sdd", "arquitectura"), { recursive: true });
  for (const [nombre, texto] of Object.entries(adrs)) writeFileSync(join(dir, ".sdd", "arquitectura", nombre), texto);
  return dir;
}
function escribir(cwd, file_path, content) {
  const r = spawnSync(process.execPath, [HOOK], {
    cwd, input: JSON.stringify({ tool_name: "Write", tool_input: { file_path, content } }),
    encoding: "utf8", env: { ...process.env, CLAUDE_AGENT_NAME: "" }, timeout: 5000,
  });
  return { codigo: r.status, stderr: r.stderr ?? "" };
}

const ADR = (estado, cuerpo) => `# ADR-99: x\n\n> Estado: ${estado}\n> Fecha: 2026-10-05\n\n${cuerpo}`;

describe("guarda de ADR en .sdd/arquitectura", () => {
  test("bloquea un término declarado en 'Patrones prohibidos' de un ADR aceptado", () => {
    const dir = proyecto({ "ADR-99-x.md": ADR("aceptada", "## Contexto\n\nbla\n\n## Patrones prohibidos\n\n- `dockerode`\n- `moment`\n\n## Consecuencias\n\nok\n") });
    const r = escribir(dir, join(dir, "src", "a.js"), "const d = require('dockerode');");
    assert.equal(r.codigo, 2);
    assert.match(r.stderr, /dockerode/);
    assert.equal(escribir(dir, join(dir, "src", "b.js"), "const x = 1;").codigo, 0);
  });

  test("no deduce nada del texto libre: 'evitar X' en el contexto no bloquea", () => {
    const dir = proyecto({ "ADR-99-x.md": ADR("aceptada", "## Contexto\n\nHay que evitar dockerode y NO usar sqlite.\n\n## Decisión\n\nevitar express\n") });
    assert.equal(escribir(dir, join(dir, "a.js"), "dockerode sqlite express").codigo, 0);
  });

  test("un ADR propuesto u obsoleto no bloquea", () => {
    for (const estado of ["propuesta", "obsoleta", "reemplazada-por-ADR-02"]) {
      const dir = proyecto({ "ADR-99-x.md": ADR(estado, "## Patrones prohibidos\n\n- `dockerode`\n") });
      assert.equal(escribir(dir, join(dir, "a.js"), "dockerode").codigo, 0, estado);
    }
  });

  test("la sección termina en el siguiente encabezado", () => {
    const dir = proyecto({ "ADR-99-x.md": ADR("aceptada", "## Patrones prohibidos\n\n- `moment`\n\n## Alternativas\n\n- `luxon`\n") });
    assert.equal(escribir(dir, join(dir, "a.js"), "luxon").codigo, 0);
    assert.equal(escribir(dir, join(dir, "a.js"), "moment").codigo, 2);
  });

  test("funciona con saltos de línea de Windows y al final del archivo", () => {
    const dir = proyecto({ "ADR-99-x.md": ADR("aceptada", "## Patrones prohibidos\r\n\r\n- `moment`").replace(/\n/g, "\r\n") });
    assert.equal(escribir(dir, join(dir, "a.js"), "moment").codigo, 2);
  });

  test("los artefactos de .sdd/ pueden nombrar el término sin bloquearse", () => {
    const dir = proyecto({ "ADR-99-x.md": ADR("aceptada", "## Patrones prohibidos\n\n- `dockerode`\n") });
    assert.equal(escribir(dir, join(dir, ".sdd", "arquitectura", "ADR-98-y.md"), "No usamos dockerode").codigo, 0);
  });

  test("términos demasiado cortos se ignoran y un proyecto sin ADR no cambia", () => {
    const dir = proyecto({ "ADR-99-x.md": ADR("aceptada", "## Patrones prohibidos\n\n- `a`\n") });
    assert.equal(escribir(dir, join(dir, "a.js"), "a b c").codigo, 0);
    assert.equal(escribir(mkdtempSync(join(tmpdir(), "forge-vacio-")), "a.js", "dockerode").codigo, 0);
  });
});
