// @ts-check
/**
 * Cabecera `tools:` de agents/*.md (spec 2026-10-14-perfiles-de-agente, CA-001-03 y CA-001-02; tarea F2.2).
 * `tools:` es una SOLICITUD, no una concesión: el ciclo no la impone. El lector la interpreta igual que antes
 * para las cabeceras válidas, y avisa de lo que descarta en vez de perderlo en silencio.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { AgentRegistry, avisosDeCabecera } from "../core/agent-registry.js";
import { ROOT } from "./helpers.js";

/** @param {string} cabecera @param {string} [cuerpo] */
const agente = (cabecera, cuerpo = "Cuerpo del agente.") => `---\n${cabecera}\n---\n${cuerpo}\n`;

/** Carga un agente de prueba con el registro real y devuelve el registro. Silencia el aviso por consola. */
function cargar(/** @type {string} */ contenido) {
  const dir = mkdtempSync(join(tmpdir(), "forge-cabecera-"));
  writeFileSync(join(dir, "x.md"), contenido, "utf8");
  const registro = new AgentRegistry();
  const warn = console.warn;
  console.warn = () => {};
  try { registro.load(dir); } finally { console.warn = warn; }
  return registro;
}

describe("tools: como solicitud, con aviso de lo que se descarta", () => {
  test("la lista entre corchetes con comillas es válida: sin aviso y con el mismo significado", () => {
    const raw = agente('name: x\ndescription: prueba\ntools: ["Read", "Grep"]');
    assert.deepEqual(avisosDeCabecera(raw), []);
    const reg = cargar(raw);
    assert.deepEqual(reg.get("x")?.tools, ["Read", "Grep"]);
    assert.deepEqual(reg.avisos, []);
  });

  test("las comillas simples siguen valiendo: sin aviso", () => {
    const raw = agente("name: x\ntools: ['Read']");
    assert.deepEqual(avisosDeCabecera(raw), []);
    assert.deepEqual(cargar(raw).get("x")?.tools, ["Read"]);
  });

  test("tools sin comillas se avisa con su línea y la clave; la lista queda vacía como antes", () => {
    const raw = agente("name: x\ntools: [Read, Grep]");
    const avisos = avisosDeCabecera(raw);
    assert.equal(avisos.length, 1, avisos.join(" | "));
    assert.match(avisos[0], /línea 3/);
    assert.match(avisos[0], /"tools"/);
    const reg = cargar(raw);
    assert.deepEqual(reg.get("x")?.tools, []);
    assert.equal(reg.avisos.length, 1);
    assert.equal(reg.avisos[0].archivo, "x.md", "el aviso nombra el archivo");
  });

  test("tools como lista YAML con guiones se avisa (no se pierde sin decirlo)", () => {
    const raw = agente("name: x\ntools:\n  - Read\n  - Write");
    const avisos = avisosDeCabecera(raw);
    assert.ok(avisos.some((a) => /"tools"/.test(a)), avisos.join(" | "));
    assert.ok(avisos.some((a) => /elemento de lista/.test(a)), avisos.join(" | "));
    assert.deepEqual(cargar(raw).get("x")?.tools, []);
  });

  test("una clave con sangría (bloque anidado) se avisa, porque este lector la aplana", () => {
    const raw = agente('name: x\nmodel: opus\nperfil:\n  model: haiku\n  tools: ["Write"]');
    const avisos = avisosDeCabecera(raw);
    assert.ok(avisos.some((a) => /anidada/.test(a) && /línea 5/.test(a)), avisos.join(" | "));
  });

  test("las cabeceras de los agentes del plugin no producen avisos", () => {
    const dir = join(ROOT, "agents");
    const archivos = readdirSync(dir).filter((f) => f.endsWith(".md"));
    assert.ok(archivos.length >= 14, `hay ${archivos.length} agentes`);
    for (const f of archivos) {
      const avisos = avisosDeCabecera(readFileSync(join(dir, f), "utf8"));
      assert.deepEqual(avisos, [], `${f}: ${avisos.join(" | ")}`);
    }
  });
});
