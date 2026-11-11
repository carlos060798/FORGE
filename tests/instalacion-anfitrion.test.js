// @ts-check
/**
 * Plan docs/PLAN-AGNOSTICO.md, F1 y F2: comandos, skills y agentes llegan a otras herramientas
 * sin sintaxis exclusiva de Claude Code, y cada agente se instala como un rol.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { PREFIJO_INVOCACION, adaptarCuerpo, adaptarSkill, agenteARol, nivelDeModelo } from "../core/instalacion/adaptar-anfitrion.js";
import { CLAVES } from "../core/instalacion/herramientas-destino.js";
import { separarCabecera, validarSkill } from "../core/instalacion/skills-de-comandos.js";
import { ROOT, forge } from "./instalacion-ayudas.js";

const comandos = readdirSync(join(ROOT, "commands")).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3));
const agentes = readdirSync(join(ROOT, "agents")).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3));
const NOTA = /^> \*\*Nota de anfitrión[\s\S]*?\n\n/m;

describe("adaptarCuerpo", () => {
  test("cambia /sdd.x por la invocación de la herramienta y respeta rutas y archivos", () => {
    const entrada = "Ejecuta /sdd.planificar y /forge. Lee .sdd/sdd.config.yaml, sdd.config y docs/sdd.planificar.md.";
    assert.equal(adaptarCuerpo(entrada, { prefijo: "$", comandos }),
      "Ejecuta $sdd-planificar y $forge. Lee .sdd/sdd.config.yaml, sdd.config y docs/sdd.planificar.md.");
    assert.match(adaptarCuerpo("usa /sdd.diseñar ya", { prefijo: "", comandos }), /la skill `sdd-disenar` ya/);
  });
  test("«Claude Code» pasa a un nombre neutral y la frase del hook de memoria se sustituye", () => {
    const t = adaptarCuerpo("Corre en Claude Code. Al final, el hook `agent-memory.js` registrará tus cambios automáticamente. Sigue.", { prefijo: "/", comandos });
    assert.ok(!/Claude Code|agent-memory/.test(t));
    assert.match(t, /no hay hook de memoria/);
    assert.match(t, /Sigue\./);
  });
});

describe("adaptarSkill", () => {
  test("quita allowed-tools, antepone la nota y conserva el resto de la cabecera", () => {
    const md = "---\nname: sdd-x\ndescription: \"d\"\nallowed-tools: Read Task\nmetadata:\n  forge-comando: \"sdd.x\"\n---\n\nCuerpo con Task(\"a\", p).\n";
    const r = adaptarSkill(md, { prefijo: "/", comandos });
    assert.ok(!/allowed-tools/.test(r));
    assert.match(r, /forge-comando/);
    assert.match(r, NOTA);
    assert.deepEqual(validarSkill("sdd-x", r), []);
  });
});

describe("agenteARol", () => {
  test("los niveles de modelo pasan al vocabulario neutral", () => {
    assert.equal(nivelDeModelo("opus"), "alto");
    assert.equal(nivelDeModelo("sonnet"), "medio");
    assert.equal(nivelDeModelo("haiku"), "economico");
  });
  test("cada agente da una skill rol-* válida con nivel y herramientas", () => {
    assert.equal(agentes.length, 14);
    for (const a of agentes) {
      const r = agenteARol(a, readFileSync(join(ROOT, "agents", a + ".md"), "utf8"), { prefijo: "", comandos });
      assert.deepEqual(r.errores, [], a);
      assert.deepEqual(validarSkill(r.nombre, r.skillMd), [], a);
      assert.match(r.nombre, /^rol-/);
      assert.match(r.skillMd, /forge-nivel: "(alto|medio|economico)"/);
      assert.ok(!/agent-memory\.js|Claude Code/.test(r.skillMd), `${a}: sin referencias al anfitrión`);
    }
  });
});

describe("lo generado para cada herramienta que no es Claude Code", () => {
  const otras = CLAVES.filter((c) => c !== "claude");
  test("hay un prefijo declarado para cada integración", () => {
    for (const c of CLAVES) assert.ok(Object.hasOwn(PREFIJO_INVOCACION, c), c);
  });
  for (const clave of otras) {
    test(`${clave}: todos los comandos y skills propias salen válidos y sin sintaxis ajena`, () => {
      const opciones = { prefijo: PREFIJO_INVOCACION[clave], comandos };
      const { skills } = require_generar();
      for (const [nombre, md] of skills) {
        const r = adaptarSkill(md, opciones);
        assert.deepEqual(validarSkill(nombre, r), [], nombre);
        const sinNota = r.replace(NOTA, "");
        assert.ok(!/allowed-tools/.test(r.split("\n---\n")[0]), `${nombre}: la cabecera conserva allowed-tools`);
        assert.ok(!/Claude Code/.test(sinNota), `${nombre}: sigue nombrando Claude Code`);
        const punteadas = comandos.filter((c) => c.includes(".")).map((c) => c.split(".").join(String.raw`\.`)).join("|");
        const resto = new RegExp(String.raw`(?<![\w./-])/(${punteadas})(?![\w-]|\.\w)`);
        assert.ok(!resto.test(sinNota), `${nombre}: quedan órdenes /sdd.x`);
        assert.ok(separarCabecera(r).campos.get("name"));
      }
    });
  }
});

/** Las skills generadas de los comandos, como las deja `scripts/generar-skills.mjs`. */
function require_generar() {
  const skills = new Map();
  for (const e of readdirSync(join(ROOT, "skills-generadas"), { withFileTypes: true })) {
    if (e.isDirectory()) skills.set(e.name, readFileSync(join(ROOT, "skills-generadas", e.name, "SKILL.md"), "utf8"));
  }
  return { skills };
}

describe("instalación real", () => {
  test("init --integracion cursor instala 14 roles y los comandos con la sintaxis de Cursor", () => {
    const cwd = realpathSync(mkdtempSync(join(tmpdir(), "forge-anf-"))), home = realpathSync(mkdtempSync(join(tmpdir(), "forge-anf-h-")));
    const r = forge(cwd, home, "init", "--integracion", "cursor");
    assert.equal(r.status, 0, r.salida);
    const carpeta = join(cwd, ".cursor", "skills");
    const roles = readdirSync(carpeta).filter((n) => n.startsWith("rol-"));
    assert.equal(roles.length, 14);
    const plan = readFileSync(join(carpeta, "sdd-planificar", "SKILL.md"), "utf8");
    assert.match(plan, /Nota de anfitrión/);
    assert.ok(!/allowed-tools/.test(plan));
    assert.match(r.salida, /14 roles/);
    // Segunda pasada idéntica: no avisa de archivos ajenos ni cambia nada
    const r2 = forge(cwd, home, "init", "--integracion", "cursor");
    assert.equal(r2.status, 0, r2.salida);
    assert.ok(!/no se pisa/.test(r2.salida), r2.salida);
  });
});
