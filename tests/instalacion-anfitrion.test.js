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

describe("adaptarCuerpo: no rompe código ni markdown (revisión del paquete R)", () => {
  const FENCE = "`".repeat(3);
  const bloque = (linea) => `${FENCE}bash\n${linea}\n${FENCE}`;

  test("con prefijo $ un bloque de código no lleva $sdd-x (se expandiría como variable de shell)", () => {
    const t = adaptarCuerpo(bloque('echo "ERROR: ejecuta /sdd.constitucion primero"'), { prefijo: "$", comandos });
    assert.match(t, /ejecuta sdd-constitucion primero/);
    assert.ok(!/\$sdd/.test(t), t);
  });
  test("con prefijo vacío un bloque no lleva comillas invertidas (ejecutarían una sustitución de comando)", () => {
    const t = adaptarCuerpo(bloque('echo "ERROR: ejecuta /sdd.constitucion primero"'), { prefijo: "", comandos });
    assert.match(t, /echo "ERROR: ejecuta sdd-constitucion primero"/);
    assert.ok(!/la skill `/.test(t), t);
  });
  test("con prefijo / o @ el bloque conserva / o usa el nombre desnudo, nunca @", () => {
    assert.match(adaptarCuerpo(bloque("ejecuta /sdd.estado"), { prefijo: "/", comandos }), /ejecuta \/sdd-estado/);
    assert.match(adaptarCuerpo(bloque("ejecuta /sdd.estado"), { prefijo: "@", comandos }), /ejecuta sdd-estado/);
  });
  test("un span en línea no anida comillas invertidas con prefijo vacío y conserva el prefijo con los demás", () => {
    assert.equal(adaptarCuerpo("alias de `/sdd.comprimir aplicar`", { prefijo: "", comandos }), "alias de `sdd-comprimir aplicar`");
    assert.equal(adaptarCuerpo("alias de `/sdd.comprimir aplicar`", { prefijo: "$", comandos }), "alias de `$sdd-comprimir aplicar`");
    assert.equal(adaptarCuerpo("alias de `/sdd.comprimir aplicar`", { prefijo: "@", comandos }), "alias de `@sdd-comprimir aplicar`");
  });
  test("la prosa sí usa la referencia de la herramienta", () => {
    assert.equal(adaptarCuerpo("Pasa a /sdd.tareas ahora", { prefijo: "@", comandos }), "Pasa a @sdd-tareas ahora");
    assert.equal(adaptarCuerpo("Pasa a /sdd.tareas ahora", { prefijo: "", comandos }), "Pasa a la skill `sdd-tareas` ahora");
  });
  test("no toca rutas, URLs, correos ni /forge/subcarpeta", () => {
    const sinCambios = [
      "ver https://ejemplo.com/forge y https://ejemplo.com/sdd.estado",
      "ruta /forge/FORGE/docs y docs/forge",
      "escribe a equipo@forge.dev",
      "archivo /forge.config.json y .claude/commands/sdd.estado.md",
      "variable $CLAUDE_PLUGIN_ROOT y ~/.claude/skills",
    ];
    for (const prefijo of ["$", "@", "/", ""]) for (const s of sinCambios) assert.equal(adaptarCuerpo(s, { prefijo, comandos }), s.replace(/Claude Code/g, "tu herramienta de código"), `${prefijo}: ${s}`);
  });
  test("«Claude Code» se reemplaza en prosa pero las rutas .claude/ y las variables CLAUDE_* se conservan", () => {
    const t = adaptarCuerpo("En Claude Code usa .claude/settings.json y CLAUDE_AGENT_NAME", { prefijo: "$", comandos });
    assert.equal(t, "En tu herramienta de código usa .claude/settings.json y CLAUDE_AGENT_NAME");
  });
  test("ninguna skill instalada para otra herramienta tiene $sdd/$forge ni backticks de referencia dentro de un bloque", () => {
    const { skills } = require_generar();
    const fence = new RegExp("`{3}[\\s\\S]*?`{3}", "g");
    for (const [prefijo, mala] of [["$", /\$(?:sdd-|forge\b)/], ["", /la skill `/], ["@", /@(?:sdd-|forge\b)/]]) {
      for (const [nombre, md] of skills) {
        const r = adaptarSkill(md, { prefijo, comandos });
        for (const b of r.replace(NOTA, "").match(fence) ?? []) assert.ok(!mala.test(b), `${nombre} (prefijo "${prefijo}"): ${b.match(mala)?.[0]}`);
      }
    }
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
