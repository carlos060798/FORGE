// @ts-check
/**
 * El `AGENTS.md` que `init` deja en un proyecto instalado para otra herramienta no habla en jerga de Claude Code y explica
 * el flujo de Fragua en esa herramienta y lo que NO está activo (informe de agnosticismo del 2026-11-24, BAJO-1 / H10).
 * Criterios CA-002-06 y CA-002-07 de la spec 2026-11-10-metodologia-agnostica. Con Claude Code el archivo no cambia.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { adaptarAgentsMd } from "../core/instalacion/adaptar-anfitrion.js";
import { ROOT, forge } from "./instalacion-ayudas.js";

const comandos = readdirSync(join(ROOT, "commands")).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3));
const PLANTILLA = "# AGENTS.md — x\n\n<!-- Cuando la tenga (/sdd.constitucion), vuelve a ejecutar `forge init`. -->\n\n## Cómo ejecutar las pruebas\n\n```\nnpm test\n```\n\n## Cómo se cambia algo\n\n1. Todo cambio empieza por una especificación.\n";
const opciones = (extra = {}) => ({ integracion: { clave: "codex", nombre: "Codex CLI" }, prefijo: "$", comandos, conHooks: false, ...extra });
const BLOQUE = /## Flujo Fragua en esta herramienta \(([^)]+)\)/;

describe("adaptarAgentsMd (pura)", () => {
  test("pasa las órdenes /sdd.x a la forma de la herramienta y conserva el resto del texto", () => {
    const r = adaptarAgentsMd(PLANTILLA, opciones());
    assert.match(r, /\$sdd-constitucion/);
    assert.doesNotMatch(r, /\/sdd\./);
    assert.match(r, /## Cómo ejecutar las pruebas\n\n```\nnpm test\n```/);
    assert.match(r, /1\. Todo cambio empieza por una especificación\./);
  });
  test("añade el bloque con el nombre de la herramienta y el flujo con su sintaxis", () => {
    const r = adaptarAgentsMd(PLANTILLA, opciones());
    assert.equal(BLOQUE.exec(r)?.[1], "Codex CLI");
    for (const s of ["$forge", "$sdd-especificar", "$sdd-planificar", "$sdd-tareas", "$sdd-implementar", "$sdd-estado"]) assert.ok(r.includes(s), s);
    assert.match(r, /rol-revisor/);
    assert.match(r, /fragua aprobar spec/);
    assert.match(r, /\.sdd\/docs\/ANFITRIONES\.md/);
    assert.match(r, /no está probada/i);
  });
  test("la sintaxis cambia con la herramienta: `/` en Cursor, `@` en Windsurf, el nombre de la skill sin prefijo en Gemini", () => {
    assert.match(adaptarAgentsMd(PLANTILLA, opciones({ integracion: { clave: "cursor", nombre: "Cursor" }, prefijo: "/" })), /\/forge\b/);
    assert.match(adaptarAgentsMd(PLANTILLA, opciones({ integracion: { clave: "windsurf", nombre: "Windsurf" }, prefijo: "@" })), /@forge\b/);
    const g = adaptarAgentsMd(PLANTILLA, opciones({ integracion: { clave: "gemini", nombre: "Gemini CLI" }, prefijo: "" }));
    assert.match(g, /la skill `forge`/);
    assert.doesNotMatch(g, /[$@]forge\b/);
  });
  test("sin hooks dice que el guardián no está instalado y cómo registrarlo", () => {
    const r = adaptarAgentsMd(PLANTILLA, opciones());
    assert.match(r, /guardián .*no está instalado/is);
    assert.match(r, /--integracion codex --con-hooks/);
    assert.doesNotMatch(r, /\.codex\/hooks\.json/);
  });
  test("con hooks dice dónde están registrados y que es una red de seguridad, no un límite", () => {
    const r = adaptarAgentsMd(PLANTILLA, opciones({ conHooks: true }));
    assert.match(r, /\.codex\/hooks\.json/);
    assert.match(r, /red de seguridad/i);
    assert.doesNotMatch(r, /guardián .*no está instalado/is);
  });
  test("con hooks pedidos en una herramienta sin adaptador (Kiro) lo dice, sin inventar un archivo", () => {
    const r = adaptarAgentsMd(PLANTILLA, opciones({ integracion: { clave: "kiro", nombre: "Kiro" }, prefijo: "/", conHooks: true }));
    assert.match(r, /no tiene adaptador de hook/i);
    assert.doesNotMatch(r, /hooks\.json/);
  });
  test("dice lo que no corre fuera de Claude Code y lo que sí funciona en cualquier herramienta", () => {
    const r = adaptarAgentsMd(PLANTILLA, opciones());
    assert.match(r, /FRAGUA_AGENTE/);
    assert.match(r, /solo lectura/);
    assert.match(r, /fragua run/);
    assert.match(r, /fragua verificar/);
  });
  test("es determinista (init lo compara con el archivo existente para decir «ya está al día»)", () => {
    assert.equal(adaptarAgentsMd(PLANTILLA, opciones()), adaptarAgentsMd(PLANTILLA, opciones()));
  });
});

describe("init para otra herramienta deja un AGENTS.md que explica el flujo en ella", () => {
  const temporal = (p) => realpathSync(mkdtempSync(join(tmpdir(), p)));
  /** @param {string[]} args @param {{ dos?: boolean }} [o] */
  function instalar(args, { dos = false } = {}) {
    const cwd = temporal("forge-agm-"), home = temporal("forge-agm-home-");
    try {
      const primera = forge(cwd, home, "init", ...args);
      const segunda = dos ? forge(cwd, home, "init", ...args) : null;
      const leer = (r) => (existsSync(join(cwd, r)) ? readFileSync(join(cwd, r), "utf8") : null);
      return { salida: primera.salida, segunda: segunda?.salida ?? "", agents: leer("AGENTS.md") ?? "", propuesta: existsSync(join(cwd, ".sdd", "AGENTS.propuesto.md")) };
    } finally { rmSync(cwd, { recursive: true, force: true }); rmSync(home, { recursive: true, force: true }); }
  }

  test("codex: AGENTS.md con el bloque, la sintaxis `$` y sin órdenes /sdd.x", () => {
    const r = instalar(["--integracion", "codex"]);
    assert.equal(BLOQUE.exec(r.agents)?.[1], "Codex CLI");
    assert.match(r.agents, /\$forge/);
    assert.doesNotMatch(r.agents, /\/sdd\./);
    assert.match(r.agents, /\$sdd-constitucion/);
  });
  test("codex con --con-hooks: el bloque dice dónde está el hook", () => {
    const r = instalar(["--integracion", "codex", "--con-hooks"]);
    assert.match(r.agents, /\.codex\/hooks\.json/);
  });
  test("cursor y gemini: la sintaxis de cada una", () => {
    assert.match(instalar(["--integracion", "cursor"]).agents, /\/forge\b/);
    assert.match(instalar(["--integracion", "gemini"]).agents, /la skill `forge`/);
  });
  test("repetir la instalación dice «ya está al día» y no deja una propuesta", () => {
    const r = instalar(["--integracion", "codex"], { dos: true });
    assert.match(r.segunda, /AGENTS\.md ya está al día/);
    assert.equal(r.propuesta, false);
  });
  test("con Claude Code (sin opciones) el AGENTS.md no cambia: sin bloque y con la orden /sdd.constitucion de siempre", () => {
    const r = instalar([]);
    assert.doesNotMatch(r.agents, BLOQUE);
    assert.match(r.agents, /\/sdd\.constitucion/);
  });
});
