// @ts-check
/**
 * Plan docs/PLAN-AGNOSTICO.md, F1 y F2: comandos, skills y agentes llegan a otras herramientas
 * sin sintaxis exclusiva de Claude Code, y cada agente se instala como un rol.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { PREFIJO_INVOCACION, adaptarCuerpo, adaptarSkill, agenteARol, nivelDeModelo, notaDeAnfitrion } from "../core/instalacion/adaptar-anfitrion.js";
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

describe("pseudocódigo de Claude Code fuera de Claude (paquete I)", () => {
  test("Task, TodoWrite y /effort se reescriben sin cambiar cómo se ejecuta un bloque bash", () => {
    const entrada = [
      "Usa `TodoWrite` para mostrar el avance.",
      "```js",
      'revisores.map(r => Task(r.agente, r.prompt))',
      "```",
      "```bash",
      "/effort high    # más razonamiento",
      "echo hecho",
      "```",
      "Escribe `/effort xhigh` en Claude Code antes de seguir. Ruta docs/effort-router intacta.",
    ].join("\n");
    const t = adaptarCuerpo(entrada, { prefijo: "$", comandos });
    assert.ok(!/Task\(|TodoWrite|\/effort/.test(t.replace("docs/effort-router", "")), t);
    assert.match(t, /delegar_a_rol\(r\.agente, r\.prompt\)/);
    assert.match(t, /mostrar_lista_de_tareas/);
    assert.match(t, /^# esfuerzo «high»: ajústalo en tu herramienta/m);
    assert.match(t, /^echo hecho$/m, "las demás líneas del bloque no cambian");
    assert.match(t, /el esfuerzo «xhigh» de tu herramienta/);
    assert.match(t, /docs\/effort-router/);
  });
  test("las skills adaptadas de todos los comandos no conservan Task(/TodoWrite// effort fuera de la nota", () => {
    const { skills } = require_generar();
    for (const [nombre, md] of skills) {
      const r = adaptarSkill(md, { prefijo: "$", comandos }).replace(NOTA, "");
      assert.ok(!/\bTask\(|\bTodoWrite\b|(?<![\w./-])\/effort\s/.test(r), `${nombre}: queda pseudocódigo de Claude Code`);
    }
  });
  test("Claude Code no cambia: la adaptación solo se aplica a otras herramientas (el instalador no la usa para claude)", () => {
    const md = readFileSync(join(ROOT, "commands", "sdd.implementar.md"), "utf8");
    assert.match(md, /Task\(/);
    assert.match(md, /TodoWrite/);
  });
  test("la nota de anfitrión explica el pseudocódigo y los scripts claude-hooks", () => {
    const nota = notaDeAnfitrion("$");
    assert.match(nota, /delegar_a_rol/);
    assert.match(nota, /mostrar_lista_de_tareas/);
    assert.match(nota, /claude-hooks/);
  });
});

describe("resumen de la instalación y .claudeignore (paquete I)", () => {
  test("sin --con-hooks dice que no hay hooks; con --con-hooks dice cuál se registró y no afirma que falten", () => {
    const cwd = realpathSync(mkdtempSync(join(tmpdir(), "forge-i-"))), home = realpathSync(mkdtempSync(join(tmpdir(), "forge-i-h-")));
    const sin = forge(cwd, home, "init", "--integracion", "cursor");
    assert.equal(sin.status, 0, sin.salida);
    assert.match(sin.salida, /No instalado: hooks \(guardián, memoria de agentes\)/);
    const cwd2 = realpathSync(mkdtempSync(join(tmpdir(), "forge-i-"))), home2 = realpathSync(mkdtempSync(join(tmpdir(), "forge-i-h-")));
    const con = forge(cwd2, home2, "init", "--integracion", "cursor", "--con-hooks");
    assert.equal(con.status, 0, con.salida);
    assert.match(con.salida, /Hooks registrados en \.cursor\/hooks\.json/);
    assert.ok(!/No instalado: hooks \(guardián/.test(con.salida), con.salida);
    assert.match(con.salida, /context-manager/);
  });
  test(".claudeignore solo se crea con la integración claude; el README de hooks se crea siempre", () => {
    const cwd = realpathSync(mkdtempSync(join(tmpdir(), "forge-i-"))), home = realpathSync(mkdtempSync(join(tmpdir(), "forge-i-h-")));
    assert.equal(forge(cwd, home, "init", "--integracion", "codex").status, 0);
    assert.ok(!existsSync(join(cwd, ".claudeignore")), "codex no recibe .claudeignore");
    assert.ok(existsSync(join(cwd, ".sdd", "hooks", "README.md")));
    const cwd2 = realpathSync(mkdtempSync(join(tmpdir(), "forge-i-"))), home2 = realpathSync(mkdtempSync(join(tmpdir(), "forge-i-h-")));
    assert.equal(forge(cwd2, home2, "init").status, 0);
    assert.ok(existsSync(join(cwd2, ".claudeignore")), "claude sí");
  });
});
