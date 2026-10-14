// @ts-check
/**
 * Spec 2026-10-13-instalacion-agnostica, F2: cada comando de `commands/` es una skill válida
 * (spike S0.2), la divergencia comando↔skill se detecta y `npm pack` lleva las skills generadas.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { comandoASkill, nombreDeSkill, separarCabecera, validarSkill } from "../core/instalacion/skills-de-comandos.js";
import { calcular, divergencias } from "../scripts/generar-skills.mjs";
import { ROOT } from "./instalacion-ayudas.js";

const comandos = readdirSync(join(ROOT, "commands")).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3));

describe("F2.1 — comando → skill", () => {
  test("nombres: minúsculas, números y guiones, sin acentos", () => {
    assert.equal(nombreDeSkill("sdd.diseñar"), "sdd-disenar");
    assert.equal(nombreDeSkill("sdd"), "sdd");
    assert.equal(nombreDeSkill("sdd.crear-mcp"), "sdd-crear-mcp");
  });

  test("todos los comandos producen un SKILL.md válido con name igual a la carpeta", () => {
    const { skills, errores } = calcular();
    assert.equal(skills.size, comandos.length, "una skill por comando, sin colisiones");
    assert.deepEqual(errores, {});
    for (const [nombre, md] of skills) {
      assert.deepEqual(validarSkill(nombre, md), [], nombre);
      const { campos } = separarCabecera(md);
      assert.equal(campos.get("name"), nombre);
    }
  });

  test("allowed-tools pasa de comas a espacios; handoffs y aliases van a metadata y se avisa", () => {
    const plan = comandoASkill("sdd.planificar", readFileSync(join(ROOT, "commands", "sdd.planificar.md"), "utf8"));
    assert.match(plan.skillMd, /^allowed-tools: Read Write Edit Bash Task$/m);
    assert.match(plan.skillMd, /forge-handoffs: "sdd\.planificar, sdd\.tareas, sdd\.analizar"/);
    assert.ok(plan.avisos.some((a) => a.startsWith("handoffs")));
    const comp = comandoASkill("sdd.comprimir", readFileSync(join(ROOT, "commands", "sdd.comprimir.md"), "utf8"));
    assert.match(comp.skillMd, /forge-aliases: "compress, ahorrar, tokens-lite"/);
  });

  test("el cuerpo del comando se conserva sin cambios", () => {
    for (const c of comandos) {
      const original = separarCabecera(readFileSync(join(ROOT, "commands", c + ".md"), "utf8")).cuerpo.replace(/^\n+/, "");
      const skill = separarCabecera(comandoASkill(c, readFileSync(join(ROOT, "commands", c + ".md"), "utf8")).skillMd).cuerpo.replace(/^\n+/, "");
      assert.equal(skill, original, c);
    }
  });

  test("description de más de 1024 caracteres se recorta con aviso", () => {
    const r = comandoASkill("x", `---\ndescription: ${"a".repeat(1500)}\n---\ncuerpo\n`);
    assert.deepEqual(validarSkill("x", r.skillMd), []);
    assert.ok(r.avisos.some((a) => /recortada/.test(a)));
  });

  test("un comando sin description es un error, no una skill silenciosa", () => {
    assert.ok(comandoASkill("x", "---\nallowed-tools: Read\n---\ncuerpo").errores.length > 0);
  });
});

describe("F2.2 — divergencia comando ↔ skill", () => {
  test("las skills generadas del repositorio están al día", () => {
    assert.deepEqual(divergencias(), []);
  });

  test("modificar una copia del comando se detecta", () => {
    const copia = realpathSync(mkdtempSync(join(tmpdir(), "forge-div-")));
    cpSync(join(ROOT, "commands"), join(copia, "commands"), { recursive: true });
    cpSync(join(ROOT, "skills-generadas"), join(copia, "skills-generadas"), { recursive: true });
    assert.deepEqual(divergencias(copia), []);
    const f = join(copia, "commands", "sdd.estado.md");
    writeFileSync(f, readFileSync(f, "utf8") + "\nLínea nueva\n");
    assert.deepEqual(divergencias(copia), ["sdd-estado/SKILL.md difiere del comando"]);
  });
});

describe("F2.3 — paquete", () => {
  test("npm pack --dry-run contiene las skills generadas", () => {
    const r = spawnSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], { cwd: ROOT, encoding: "utf8", shell: true, timeout: 120_000 });
    assert.equal(r.status, 0, r.stderr);
    const rutas = JSON.parse(r.stdout)[0].files.map((/** @type {any} */ f) => f.path);
    for (const c of comandos) {
      assert.ok(rutas.includes(`skills-generadas/${nombreDeSkill(c)}/SKILL.md`), c);
    }
  });
});
