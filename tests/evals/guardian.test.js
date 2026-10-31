// @ts-check
/**
 * Spec 2026-10-27-flujo-nativo-de-ia: CA-004-01, CA-002-01
 * Evals de la barrera determinista (spec 2026-10-27-flujo-nativo-de-ia): una tabla de casos
 * (`casos-guardian.json`) contra el guardián real. Sin modelo, sin red, sin Docker.
 *
 * Cada incidente en el que el guardián dejó pasar algo, o bloqueó lo que no debía, se convierte en un caso nuevo
 * en la tabla: así un cambio en `claude-hooks/` no puede deshacerlo sin que se note.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const HOOK = join(__dir, "../../claude-hooks/pre-tool-guard.js");
/** @type {{ id: string, descripcion: string, evento: any, espera: 'bloquea'|'permite' }[]} */
const CASOS = JSON.parse(readFileSync(join(__dir, "casos-guardian.json"), "utf8"));

function ejecutar(evento) {
  const r = spawnSync(process.execPath, [HOOK], { input: JSON.stringify(evento), encoding: "utf8", timeout: 60_000 });
  return { codigo: r.status ?? -1, stderr: r.stderr ?? "" };
}

describe("evals — guardián", () => {
  test("la tabla es una tabla: ids únicos y resultado esperado válido", () => {
    assert.ok(CASOS.length >= 30, "mínimo 30 casos");
    assert.equal(new Set(CASOS.map((c) => c.id)).size, CASOS.length, "ids repetidos");
    for (const c of CASOS) assert.ok(c.espera === "bloquea" || c.espera === "permite", c.id);
  });

  test("hay casos de las dos clases (si no, la tabla no distingue nada)", () => {
    assert.ok(CASOS.some((c) => c.espera === "bloquea"));
    assert.ok(CASOS.some((c) => c.espera === "permite"));
  });

  for (const caso of CASOS) {
    test(`${caso.id}: ${caso.descripcion} → ${caso.espera}`, () => {
      const r = ejecutar(caso.evento);
      if (caso.espera === "bloquea") assert.equal(r.codigo, 2, `debía bloquear. stderr: ${r.stderr}`);
      else assert.equal(r.codigo, 0, `debía permitir. stderr: ${r.stderr}`);
    });
  }
});
