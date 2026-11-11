// @ts-check
/**
 * Plan docs/PLAN-AGNOSTICO.md, F2: agentes en el formato propio de cada herramienta, solo donde está confirmado.
 * Los formatos salen de la documentación oficial leída el 2026-11-11; no se probaron en una herramienta real.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { CLAVES_CON_AGENTE_NATIVO, FORMATOS_NATIVOS, agenteANativo, herramientasDe } from "../core/instalacion/agentes-nativos.js";
import { INTEGRACIONES } from "../core/instalacion/herramientas-destino.js";
import { AGENTES_SOLO_LECTURA } from "../core/evidencia/guardian-reglas.js";
import { separarCabecera } from "../core/instalacion/skills-de-comandos.js";
import { ROOT, forge } from "./instalacion-ayudas.js";

const agentes = readdirSync(join(ROOT, "agents")).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3));
const comandos = readdirSync(join(ROOT, "commands")).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3));
const opciones = { prefijo: "/", comandos };
const texto = (a) => readFileSync(join(ROOT, "agents", a + ".md"), "utf8");
const temporal = (p) => realpathSync(mkdtempSync(join(tmpdir(), p)));
// Fuente única de «solo lectura»: la lista del guardián (core/evidencia/guardian-reglas.js)
const SOLO_LECTURA = [...AGENTES_SOLO_LECTURA];
const ESCRIBE = ["Write", "Edit", "MultiEdit", "NotebookEdit"];

describe("tabla de formatos", () => {
  test("cada formato cita https y fecha, y es una integración del instalador sin carpeta compartida", () => {
    for (const [clave, f] of Object.entries(FORMATOS_NATIVOS)) {
      assert.ok(Object.hasOwn(INTEGRACIONES, clave), clave);
      assert.match(f.fuente, /^https:\/\//, clave);
      assert.match(f.consultado, /^2026-11-\d\d$/, clave);
      assert.ok(!f.carpeta.startsWith("/") && !f.carpeta.includes(".."), clave);
    }
    assert.deepEqual([...CLAVES_CON_AGENTE_NATIVO].sort(), ["codex", "copilot", "cursor", "gemini", "kiro", "opencode"]);
  });
  test("sin formato confirmado devuelve null (Windsurf, carpeta común, genérica, Claude)", () => {
    for (const c of ["windsurf", "agents", "generica", "claude"]) assert.equal(agenteANativo(c, "revisor", texto("revisor"), opciones), null, c);
  });
});

describe("agenteANativo", () => {
  test("Copilot: .agent.md con name, description y tools como alias documentados", () => {
    const r = /** @type {any} */ (agenteANativo("copilot", "revisor", texto("revisor"), opciones));
    assert.equal(r.ruta, ".github/agents/revisor.agent.md");
    const { campos } = separarCabecera(r.contenido);
    assert.equal(campos.get("name"), '"revisor"');
    assert.equal(campos.get("tools"), '["read","search","execute"]');
    assert.ok(!/^model:/m.test(r.contenido), "sin model: los valores no están documentados");
  });
  test("Cursor: readonly solo para los agentes sin herramientas de escritura", () => {
    for (const a of agentes) {
      const r = /** @type {any} */ (agenteANativo("cursor", a, texto(a), opciones));
      assert.match(r.contenido, new RegExp(`^readonly: ${SOLO_LECTURA.includes(a) ? "true" : "false"}$`, "m"), a);
      assert.match(r.contenido, /^model: inherit$/m);
    }
  });
  test("opencode: mode subagent y permisos edit/shell denegados cuando faltan las herramientas", () => {
    const lectura = /** @type {any} */ (agenteANativo("opencode", "revisor", texto("revisor"), opciones));
    assert.match(lectura.contenido, /mode: subagent/);
    assert.match(lectura.contenido, /action: edit\n\s+resource: "\*"\n\s+effect: deny/);
    const escribe = /** @type {any} */ (agenteANativo("opencode", "tester", texto("tester"), opciones));
    assert.ok(!/action: edit/.test(escribe.contenido));
  });
  test("Kiro: JSON válido con prompt; las herramientas se traducen a read, write y shell", () => {
    for (const a of agentes) {
      const r = /** @type {any} */ (agenteANativo("kiro", a, texto(a), opciones));
      const j = JSON.parse(r.contenido);
      assert.equal(j.name, a);
      assert.ok(j.prompt.length > 100, a);
      assert.ok(j.tools.every((/** @type {string} */ t) => ["read", "write", "shell"].includes(t)), a);
    }
  });
  test("Kiro y Copilot nunca dan MÁS herramientas que el agente original", () => {
    for (const a of SOLO_LECTURA) {
      const k = JSON.parse(/** @type {any} */ (agenteANativo("kiro", a, texto(a), opciones)).contenido);
      assert.ok(!k.tools.includes("write"), `kiro ${a}`);
      const c = /** @type {any} */ (agenteANativo("copilot", a, texto(a), opciones)).contenido;
      assert.ok(!/"edit"/.test(c), `copilot ${a}`);
    }
  });
  test("Gemini: solo genera agentes sin escritura, con herramientas confirmadas; el resto se omite con motivo", () => {
    for (const a of agentes) {
      const r = /** @type {any} */ (agenteANativo("gemini", a, texto(a), opciones));
      if (herramientasDe(separarCabecera(texto(a)).campos.get("tools")).some((h) => ["Write", "Edit", "MultiEdit"].includes(h))) {
        assert.match(r.omitido, /no están confirmados/, a);
      } else {
        assert.equal(r.ruta, `.gemini/agents/${a}.md`);
        const tools = [...r.contenido.matchAll(/^ {2}- (\S+)$/gm)].map((/** @type {RegExpMatchArray} */ m) => m[1]);
        assert.ok(tools.length > 0 && tools.every((t) => ["read_file", "grep_search", "run_shell_command"].includes(t)), a);
        assert.match(r.contenido, /^kind: local$/m);
      }
    }
  });
  test("Codex: TOML con los tres campos obligatorios; solo lectura va como instrucción", () => {
    for (const a of agentes) {
      const r = /** @type {any} */ (agenteANativo("codex", a, texto(a), opciones));
      assert.equal(r.ruta, `.codex/agents/${a}.toml`);
      assert.match(r.contenido, /^name = "/m);
      assert.match(r.contenido, /^description = "/m);
      assert.match(r.contenido, /^developer_instructions = ('''|""")\n/m);
      assert.equal(/solo lectura/.test(r.contenido), SOLO_LECTURA.includes(a), a);
    }
  });
  test("Codex: un cuerpo con ''' o barras se escapa en cadena básica", () => {
    const t = "---\nname: x\ndescription: d\ntools: [\"Read\"]\n---\nUsa ''' y \\n y \"\"\" aquí\n";
    const r = /** @type {any} */ (agenteANativo("codex", "x", t, opciones));
    assert.match(r.contenido, /developer_instructions = """\n/);
    assert.ok(r.contenido.includes('\\"\\"\\"') && r.contenido.includes("\\\\n"));
  });
  test("el cuerpo se adapta: sin «Claude Code» ni órdenes /sdd.x sin traducir", () => {
    for (const c of CLAVES_CON_AGENTE_NATIVO) {
      for (const a of agentes) {
        const r = /** @type {any} */ (agenteANativo(c, a, texto(a), { prefijo: "$", comandos }));
        if ("omitido" in r) continue;
        assert.ok(!/Claude Code|agent-memory\.js/.test(r.contenido), `${c}/${a}`);
      }
    }
  });
});

describe("forge init escribe los agentes nativos", () => {
  /** @type {Record<string, [string, string, number]>} */
  const esperado = {
    copilot: [".github/agents", ".agent.md", 14], cursor: [".cursor/agents", ".md", 14], codex: [".codex/agents", ".toml", 14],
    opencode: [".opencode/agents", ".md", 14], kiro: [".kiro/agents", ".json", 14], gemini: [".gemini/agents", ".md", 7],
  };
  for (const [clave, [carpeta, ext, n]] of Object.entries(esperado)) {
    test(`${clave}: ${n} agentes en ${carpeta}; una segunda pasada no avisa; un archivo ajeno no se pisa`, () => {
      const cwd = temporal("forge-an-"), home = temporal("forge-an-h-");
      const r = forge(cwd, home, "init", "--integracion", clave);
      assert.equal(r.status, 0, r.salida);
      const lista = readdirSync(join(cwd, ...carpeta.split("/"))).filter((x) => x.endsWith(ext));
      assert.equal(lista.length, n);
      assert.match(r.salida, new RegExp(`Agentes nativos de .*: ${n} en`));
      const r2 = forge(cwd, home, "update");
      assert.equal(r2.status, 0, r2.salida);
      assert.ok(!/no es de FORGE, no se pisa/.test(r2.salida), r2.salida);
    });
  }
  test("un archivo ajeno con el mismo nombre en una instalación nueva no se pisa", () => {
    const cwd = temporal("forge-an-"), home = temporal("forge-an-h-");
    mkdirSync(join(cwd, ".cursor", "agents"), { recursive: true });
    writeFileSync(join(cwd, ".cursor", "agents", "revisor.md"), "MIO\n");
    const r = forge(cwd, home, "init", "--integracion", "cursor");
    assert.equal(r.status, 0, r.salida);
    assert.equal(readFileSync(join(cwd, ".cursor", "agents", "revisor.md"), "utf8"), "MIO\n");
    assert.match(r.salida, /no es de FORGE, no se pisa/);
  });
  test("Windsurf y la genérica no generan agentes nativos y lo dicen", () => {
    const cwd = temporal("forge-an-"), home = temporal("forge-an-h-");
    const r = forge(cwd, home, "init", "--integracion", "windsurf");
    assert.equal(r.status, 0, r.salida);
    assert.match(r.salida, /Agentes nativos: no se generan/);
    assert.ok(!existsSync(join(cwd, ".windsurf", "agents")));
  });
});

describe("una sola fuente de «solo lectura»", () => {
  test("la lista del guardián nombra solo agentes que existen y es la que usa pre-tool-guard.js", () => {
    for (const a of SOLO_LECTURA) assert.ok(agentes.includes(a), `${a} no existe en agents/`);
    const guardian = readFileSync(join(ROOT, "claude-hooks", "pre-tool-guard.js"), "utf8");
    assert.ok(guardian.includes("new Set(AGENTES_SOLO_LECTURA)"), "el guardián importa la lista, no la duplica");
    assert.ok(!guardian.includes("'disenador-api'"), "el guardián no repite nombres de agentes");
  });
  test("ningún agente de solo lectura declara herramientas de escritura en su cabecera (14 agentes cruzados)", () => {
    assert.equal(agentes.length, 14);
    for (const a of agentes) {
      const declaradas = herramientasDe(separarCabecera(texto(a)).campos.get("tools"));
      if (SOLO_LECTURA.includes(a)) assert.deepEqual(declaradas.filter((h) => ESCRIBE.includes(h)), [], `${a} es de solo lectura pero declara escritura`);
    }
  });
  test("ningún formato nativo da herramientas de escritura a un agente de solo lectura, ni aunque la cabecera las declarara", () => {
    // Una cabecera que declara escritura no debe llegar a ningún destino: se compara con la misma cabecera sin ella
    for (const a of SOLO_LECTURA) {
      const conEscritura = texto(a).replace(/^tools:.*$/m, 'tools: ["Read", "Write", "Edit", "Grep", "Bash"]');
      const sinEscritura = texto(a).replace(/^tools:.*$/m, 'tools: ["Read", "Grep", "Bash"]');
      for (const clave of CLAVES_CON_AGENTE_NATIVO) {
        const r = agenteANativo(clave, a, conEscritura, opciones);
        const base = agenteANativo(clave, a, sinEscritura, opciones);
        assert.deepEqual(r, base, `${clave}/${a}: la escritura declarada no debe cambiar el resultado`);
        if (r && "contenido" in r && clave === "cursor") assert.match(r.contenido, /^readonly: true$/m, `${clave}/${a}`);
      }
    }
  });
});
