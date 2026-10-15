// @ts-check
/**
 * Spec 2026-10-13-instalacion-agnostica — F1 (tabla, `--integracion`, escritura segura, configuración,
 * mensaje) y F3 (perfiles). Con HOME falso: no toca el ~/.claude de quien corre las pruebas.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { CLAVES, INTEGRACIONES, resolverIntegracion, validarCarpetaSkills } from "../core/instalacion/herramientas-destino.js";
import { PERFILES, PERFIL_POR_DEFECTO, incluyeComando, resolverPerfil } from "../core/instalacion/perfiles.js";
import { forge, ROOT } from "./instalacion-ayudas.js";

const temporal = (p) => realpathSync(mkdtempSync(join(tmpdir(), p)));
const proyecto = () => { const d = temporal("forge-int-"); writeFileSync(join(d, "package.json"), JSON.stringify({ name: "demo", scripts: { test: "node --test" } })); return d; };
const lista = (d) => (existsSync(d) ? readdirSync(d).sort() : []);

describe("F1.1 — tabla de integraciones", () => {
  test("solo herramientas con carpeta confirmada; Zed y Goose no entran", () => {
    assert.deepEqual([...CLAVES].sort(), ["agents", "claude", "copilot", "cursor", "gemini", "generica", "kiro", "opencode", "windsurf"]);
    assert.ok(!CLAVES.includes("zed") && !CLAVES.includes("goose"));
  });
  test("cada fila cita su URL y su fecha de consulta", () => {
    for (const i of Object.values(INTEGRACIONES)) {
      assert.match(i.fuente, /^https:\/\//, i.clave);
      assert.match(i.consultado, /^2026-10-13$/, i.clave);
      assert.ok(i.invocacion && i.nombre);
    }
    assert.equal(INTEGRACIONES.windsurf.carpetaSkills, ".devin/skills");
    assert.equal(INTEGRACIONES.copilot.carpetaSkills, ".github/skills");
    assert.equal(INTEGRACIONES.claude.nativa, true);
    assert.equal(Object.values(INTEGRACIONES).filter((i) => i.nativa).length, 1);
  });
  test("clave desconocida se rechaza con la lista de válidas", () => {
    const r = resolverIntegracion("vim");
    assert.equal(r.ok, false);
    for (const k of CLAVES) assert.ok(/** @type {any} */ (r).error.includes(k));
    assert.equal(resolverIntegracion("__proto__").ok, false);
  });
  test("carpeta genérica: dentro del proyecto o de la personal; fuera, no", () => {
    const proyectoDir = resolve(tmpdir(), "p"), personal = resolve(tmpdir(), "h");
    const c = { proyecto: proyectoDir, personal };
    assert.equal(validarCarpetaSkills(".mis/skills", c).ok, true);
    assert.equal(validarCarpetaSkills(join(personal, ".x", "skills"), c).ok, true);
    assert.equal(validarCarpetaSkills("../fuera", c).ok, false);
    assert.equal(validarCarpetaSkills(resolve(tmpdir(), "otro", "skills"), c).ok, false);
    assert.equal(validarCarpetaSkills(".", c).ok, false);
    assert.equal(validarCarpetaSkills("", c).ok, false);
    assert.equal(validarCarpetaSkills(undefined, c).ok, false);
  });
});

describe("F1.3 — forge init --integracion", () => {
  test("clave desconocida: error con la lista y no escribe nada", () => {
    const cwd = proyecto(), home = temporal("forge-h-");
    const r = forge(cwd, home, "init", "--integracion", "vim");
    assert.notEqual(r.status, 0);
    assert.match(r.salida, /gemini/);
    assert.deepEqual(lista(cwd), ["package.json"]);
  });

  test("genérica: solo skills y AGENTS.md; sin comandos, agentes, hooks, settings ni CLAUDE.md", () => {
    const cwd = proyecto(), home = temporal("forge-h-");
    const r = forge(cwd, home, "init", "--integracion", "generica", "--carpeta-skills", ".mis/skills");
    assert.equal(r.status, 0, r.salida);
    assert.ok(existsSync(join(cwd, ".mis", "skills", "sdd-planificar", "SKILL.md")));
    assert.ok(existsSync(join(cwd, "AGENTS.md")));
    assert.ok(!existsSync(join(cwd, ".claude")), "no hay .claude");
    assert.ok(!existsSync(join(cwd, "CLAUDE.md")));
    // CA-001-05: dice qué instaló, qué no y cómo invocar
    assert.match(r.salida, /Instalado:/);
    assert.match(r.salida, /No instalado:/);
    assert.match(r.salida, /Cómo invocar:/);
  });

  test("genérica sin carpeta o con carpeta fuera del proyecto se rechaza sin escribir", () => {
    const cwd = proyecto(), home = temporal("forge-h-"), fuera = temporal("forge-fuera-");
    const a = forge(cwd, home, "init", "--integracion", "generica");
    assert.notEqual(a.status, 0);
    const b = forge(cwd, home, "init", "--integracion", "generica", "--carpeta-skills", fuera);
    assert.notEqual(b.status, 0);
    assert.deepEqual(lista(cwd), ["package.json"]);
    assert.deepEqual(lista(fuera), []);
  });

  test("--carpeta-skills con una integración que no es genérica se rechaza", () => {
    const cwd = proyecto(), home = temporal("forge-h-");
    assert.notEqual(forge(cwd, home, "init", "--integracion", "cursor", "--carpeta-skills", ".x").status, 0);
  });

  for (const [clave, carpeta] of [["agents", ".agents/skills"], ["copilot", ".github/skills"], ["cursor", ".cursor/skills"], ["gemini", ".gemini/skills"], ["windsurf", ".devin/skills"], ["opencode", ".opencode/skills"], ["kiro", ".kiro/skills"]]) {
    test(`${clave} instala en ${carpeta}`, () => {
      const cwd = proyecto(), home = temporal("forge-h-");
      const r = forge(cwd, home, "init", "--integracion", clave);
      assert.equal(r.status, 0, r.salida);
      assert.ok(existsSync(join(cwd, ...carpeta.split("/"), "forge", "SKILL.md")), "skill forge");
      assert.ok(readdirSync(join(cwd, ...carpeta.split("/"))).length > 39);
      assert.ok(!existsSync(join(cwd, ".claude")));
    });
  }

  test("--global solo con claude", () => {
    const cwd = proyecto(), home = temporal("forge-h-");
    const r = forge(cwd, home, "init", "--global", "--integracion", "cursor");
    assert.notEqual(r.status, 0);
    assert.deepEqual(lista(home), []);
  });
});

describe("F1.4 — escritura segura en los destinos nuevos", () => {
  test("una unión hacia fuera no se sigue: nada se escribe fuera y el comando no dice «listo»", () => {
    const cwd = proyecto(), home = temporal("forge-h-"), fuera = temporal("forge-fuera-");
    mkdirSync(join(cwd, ".cursor"));
    try { symlinkSync(fuera, join(cwd, ".cursor", "skills"), "junction"); } catch { return; }
    const r = forge(cwd, home, "init", "--integracion", "cursor");
    assert.notEqual(r.status, 0, r.salida);
    assert.deepEqual(lista(fuera), [], "nada escrito al otro lado");
  });

  test("un enlace duro hacia un archivo de fuera no se pisa", () => {
    const cwd = proyecto(), home = temporal("forge-h-"), fuera = temporal("forge-fuera-");
    const ajeno = join(fuera, "ajeno.md");
    writeFileSync(ajeno, "AJENO");
    const destino = join(cwd, ".kiro", "skills", "forge");
    mkdirSync(destino, { recursive: true });
    try { linkSync(ajeno, join(destino, "SKILL.md")); } catch { return; }
    forge(cwd, home, "init", "--integracion", "kiro");
    assert.equal(readFileSync(ajeno, "utf8"), "AJENO");
  });

  test("un archivo ajeno existente no se pisa sin avisar", () => {
    const cwd = proyecto(), home = temporal("forge-h-");
    const skill = join(cwd, ".gemini", "skills", "forge", "SKILL.md");
    mkdirSync(dirname(skill), { recursive: true });
    writeFileSync(skill, "---\nname: forge\ndescription: mía\n---\nMÍA\n");
    const r = forge(cwd, home, "init", "--integracion", "gemini");
    assert.equal(r.status, 0, r.salida);
    assert.match(readFileSync(skill, "utf8"), /MÍA/);
    assert.match(r.salida, /no se pisa/);
  });
});

describe("F1.5 / F3 — integración y perfil en la configuración, respetados en update", () => {
  test("init guarda integración y perfil; update sin opciones los respeta", () => {
    const cwd = proyecto(), home = temporal("forge-h-");
    assert.equal(forge(cwd, home, "init", "--integracion", "cursor", "--perfil", "esencial").status, 0);
    const yaml = readFileSync(join(cwd, ".sdd", "sdd.config.yaml"), "utf8");
    assert.match(yaml, /^instalacion:\n {2}integracion: "cursor"\n {2}perfil: "esencial"/m);

    const carpeta = join(cwd, ".cursor", "skills");
    assert.equal(lista(carpeta).filter((n) => n.startsWith("sdd-")).length, 5, "esencial: forge + 5 sdd-*");
    assert.ok(existsSync(join(carpeta, "forge", "SKILL.md")));
    writeFileSync(join(carpeta, "sdd-estado", "SKILL.md"), "VIEJO");
    const r = forge(cwd, home, "update");
    assert.equal(r.status, 0, r.salida);
    assert.match(readFileSync(join(carpeta, "sdd-estado", "SKILL.md"), "utf8"), /^---\r?\nname: sdd-estado/);
    assert.ok(!existsSync(join(cwd, ".claude")), "update no cambió de integración");
    assert.ok(!existsSync(join(carpeta, "sdd-qa")), "update no cambió de perfil");
  });

  test("una instalación existente (sin sección) sigue siendo completa tras update", () => {
    const cwd = proyecto(), home = temporal("forge-h-");
    assert.equal(forge(cwd, home, "init").status, 0);
    const antes = lista(join(cwd, ".claude", "commands"));
    assert.ok(antes.length >= 39);
    assert.doesNotMatch(readFileSync(join(cwd, ".sdd", "sdd.config.yaml"), "utf8"), /^instalacion:/m);
    assert.equal(forge(cwd, home, "update").status, 0);
    assert.deepEqual(lista(join(cwd, ".claude", "commands")), antes);
    assert.doesNotMatch(readFileSync(join(cwd, ".sdd", "sdd.config.yaml"), "utf8"), /^instalacion:/m);
  });
});

describe("F3 — perfiles", () => {
  test("esencial tiene como máximo seis comandos, todos existentes; completo, todos", () => {
    const esencial = /** @type {readonly string[]} */ (PERFILES.esencial.comandos);
    assert.ok(esencial.length <= 6 && esencial.length >= 1);
    for (const c of esencial) assert.ok(existsSync(join(ROOT, "commands", `${c}.md`)), c);
    assert.equal(PERFILES.completo.comandos, null);
    assert.equal(incluyeComando("completo", "sdd.qa"), true);
    assert.equal(incluyeComando("esencial", "sdd.qa"), false);
    assert.equal(incluyeComando("esencial", "sdd.planificar"), true);
  });
  test("el valor por defecto sigue siendo completo (decisión del dueño pendiente)", () => {
    assert.equal(PERFIL_POR_DEFECTO, "completo");
    assert.equal(resolverPerfil("raro").ok, false);
  });
  test("claude + esencial instala solo esos comandos; sin --perfil, todos", () => {
    const cwd = proyecto(), home = temporal("forge-h-");
    assert.equal(forge(cwd, home, "init", "--perfil", "esencial").status, 0);
    assert.deepEqual(lista(join(cwd, ".claude", "commands")), ["forge.md", "sdd.especificar.md", "sdd.estado.md", "sdd.implementar.md", "sdd.planificar.md", "sdd.tareas.md"]);
    assert.ok(existsSync(join(cwd, ".claude", "settings.json")));
  });
  test("perfil desconocido se rechaza sin escribir", () => {
    const cwd = proyecto(), home = temporal("forge-h-");
    assert.notEqual(forge(cwd, home, "init", "--perfil", "mini").status, 0);
    assert.deepEqual(lista(cwd), ["package.json"]);
  });
  test("forge config set instalacion.perfil cambia el perfil y update lo aplica", () => {
    const cwd = proyecto(), home = temporal("forge-h-");
    assert.equal(forge(cwd, home, "init", "--perfil", "esencial").status, 0);
    assert.equal(forge(cwd, home, "config", "set", "instalacion.perfil", "completo").status, 0);
    assert.equal(forge(cwd, home, "update").status, 0);
    assert.ok(existsSync(join(cwd, ".claude", "commands", "sdd.qa.md")));
  });
});
