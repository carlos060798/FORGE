// @ts-check
/**
 * Lo que se instala en otras herramientas cumple el estándar abierto de skills (https://agentskills.io/specification):
 * en la cabecera solo `name`, `description`, `license`, `compatibility`, `metadata` (texto a texto) y, opcional y
 * experimental, `allowed-tools` separado por espacios. Informe de investigación web del 2026-11-24 (criterios comunes a
 * todas las herramientas) y de agnosticismo (H-C1, H-C2). Criterios CA-004-01 a CA-004-04 de la spec
 * 2026-11-10-metodologia-agnostica.
 *
 * Las fuentes de `skills/` conservan campos propios de Claude Code (`model:`, `allowed-tools` con comas) y no se
 * tocan: se quitan al instalar fuera de Claude Code. Hasta ahora la prueba de lint solo recorría `skills-generadas/`,
 * no las 31 skills propias de `skills/`, que son las que llevan `model:`.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { PREFIJO_INVOCACION, adaptarSkill, agenteARol } from "../core/instalacion/adaptar-anfitrion.js";
import { CLAVES } from "../core/instalacion/herramientas-destino.js";
import { avisosDeSkill, separarCabecera, validarSkill } from "../core/instalacion/skills-de-comandos.js";
import { ROOT } from "./instalacion-ayudas.js";

const comandos = readdirSync(join(ROOT, "commands")).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3));
const agentes = readdirSync(join(ROOT, "agents")).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3));
const leerCarpeta = (dir) => new Map(readdirSync(join(ROOT, dir), { withFileTypes: true })
  .filter((e) => e.isDirectory()).map((e) => [e.name, readFileSync(join(ROOT, dir, e.name, "SKILL.md"), "utf8")]));
const propias = leerCarpeta("skills");
const generadas = leerCarpeta("skills-generadas");

const BASE = `---\nname: x\ndescription: "Hace algo."\n`;
const skill = (extra = "") => `${BASE}${extra}---\n\ncuerpo\n`;
const ESTRICTO = { estricto: true };

describe("adaptarSkill quita también `model:`", () => {
  test("quita `allowed-tools` y `model` de primer nivel y conserva name, description y metadata, incluso con claves iguales dentro de metadata", () => {
    const src = `${BASE}allowed-tools: Read, Bash\nmodel: haiku\nmetadata:\n  forge-modelo: "no se toca"\n  model: "ni esto"\n---\n\ncuerpo\n`;
    const cabecera = adaptarSkill(src, { prefijo: "/", comandos }).split("\n---\n")[0];
    assert.doesNotMatch(cabecera, /^allowed-tools:/m);
    assert.doesNotMatch(cabecera, /^model:/m);
    assert.match(cabecera, /^name: x$/m);
    assert.match(cabecera, /^description: "Hace algo\."$/m);
    assert.match(cabecera, /forge-modelo: "no se toca"/);
    assert.match(cabecera, /^ {2}model: "ni esto"$/m);
  });
  test("la fuente no cambia: adaptar no modifica el texto original", () => {
    const src = `${BASE}model: haiku\n---\n\ncuerpo\n`;
    adaptarSkill(src, { prefijo: "/", comandos });
    assert.match(src, /^model: haiku$/m);
  });
});

describe("validarSkill en modo estricto (lo que se instala fuera de Claude Code)", () => {
  test("una cabecera estándar completa es válida", () => {
    const md = skill(`license: MIT\ncompatibility: "Node 20 o superior"\nmetadata:\n  forge-comando: "sdd.x"\n  nivel: texto plano\nallowed-tools: Read Bash\n`);
    assert.deepEqual(validarSkill("x", md, ESTRICTO), []);
  });
  test("un campo de primer nivel fuera de estándar es error: model, id, nombre, version, handoffs", () => {
    for (const campo of ["model: haiku", "id: x", "nombre: x", "version: 1.0.0", "inputs: algo", "requisitos: algo"]) {
      const e = validarSkill("x", skill(campo + "\n"), ESTRICTO);
      assert.ok(e.some((m) => m.includes("fuera de estándar") && m.includes(`"${campo.split(":")[0]}"`)), `${campo}: ${JSON.stringify(e)}`);
    }
    assert.ok(validarSkill("x", skill("handoffs:\n  - comando: sdd.y\n"), ESTRICTO).some((m) => m.includes('"handoffs"')), "un bloque también cuenta");
  });
  test("`compatibility` de más de 500 caracteres es error; de 500, no", () => {
    assert.deepEqual(validarSkill("x", skill(`compatibility: "${"a".repeat(500)}"\n`), ESTRICTO), []);
    assert.ok(validarSkill("x", skill(`compatibility: "${"a".repeat(501)}"\n`), ESTRICTO).some((m) => /compatibility/.test(m)));
  });
  test("`metadata` solo admite texto: un número, un booleano, una lista o un valor vacío son error; un texto entre comillas no", () => {
    for (const valor of ["5", "true", "false", "null", "~", "1.5", "[a, b]", "{a: b}", ""]) {
      const e = validarSkill("x", skill(`metadata:\n  clave: ${valor}\n`), ESTRICTO);
      assert.ok(e.some((m) => m.includes("metadata.clave")), `«${valor}»: ${JSON.stringify(e)}`);
    }
    for (const valor of ['"5"', '"true"', "'texto'", "texto plano", "sdd.x, sdd.y"]) {
      assert.deepEqual(validarSkill("x", skill(`metadata:\n  clave: ${valor}\n`), ESTRICTO), [], valor);
    }
  });
  test("`allowed-tools` con comas sigue siendo error, en los dos modos", () => {
    const md = skill("allowed-tools: Read, Bash\n");
    assert.ok(validarSkill("x", md).some((m) => /allowed-tools/.test(m)));
    assert.ok(validarSkill("x", md, ESTRICTO).some((m) => /allowed-tools/.test(m)));
  });
  test("el modo por defecto (permisivo) sigue aceptando campos propios: las fuentes de Claude Code", () => {
    assert.deepEqual(validarSkill("x", skill("model: haiku\nid: x\n")), []);
  });
  test("las reglas de siempre siguen: nombre, carpeta y descripción", () => {
    assert.ok(validarSkill("otro", skill(), ESTRICTO).some((m) => /no coincide con la carpeta/.test(m)));
    assert.ok(validarSkill("x", "---\nname: x\n---\n", ESTRICTO).some((m) => /description/.test(m)));
  });
});

describe("avisosDeSkill: el cuerpo largo es un aviso, no un error", () => {
  test("más de 500 líneas avisa; 500 o menos, no", () => {
    const con = (n) => `${BASE}---\n${"línea\n".repeat(n)}`;
    assert.deepEqual(avisosDeSkill(con(500)), []);
    assert.equal(avisosDeSkill(con(501)).length, 1);
    assert.match(avisosDeSkill(con(501))[0], /501|500/);
  });
  test("ninguna de las 31 skills propias pasa del límite recomendado", () => {
    for (const [n, md] of propias) assert.deepEqual(avisosDeSkill(md), [], n);
  });
  // La especificación RECOMIENDA menos de 500 líneas (carga progresiva); no lo exige. Estas skills salen de comandos largos
  // y partirlos queda fuera de esta entrega. La lista fija las excepciones conocidas: una quinta hace fallar la prueba, y si
  // se acorta una hay que quitarla de aquí (docs/limitations.md lo recoge como límite).
  const LARGAS_CONOCIDAS = ["sdd-compliance", "sdd-constitucion", "sdd-implementar", "sdd-planificar"];
  test(`las skills generadas de comandos con más de 500 líneas son exactamente las conocidas: ${LARGAS_CONOCIDAS.join(", ")}`, () => {
    const largas = [...generadas].filter(([, md]) => avisosDeSkill(md).length > 0).map(([n]) => n).sort();
    assert.deepEqual(largas, LARGAS_CONOCIDAS);
  });
});

describe("lo instalado para cada herramienta que no es Claude Code cumple el estándar (skills propias, de comandos y roles)", () => {
  assert.equal(propias.size, 31, "hay 31 skills propias");
  assert.equal(agentes.length, 14);
  for (const clave of CLAVES.filter((c) => c !== "claude")) {
    test(`${clave}: ninguna cabecera instalada tiene campos fuera de estándar`, () => {
      const opciones = { prefijo: PREFIJO_INVOCACION[clave], comandos };
      for (const [nombre, md] of [...propias, ...generadas]) {
        const r = adaptarSkill(md, opciones);
        assert.deepEqual(validarSkill(nombre, r, ESTRICTO), [], nombre);
        assert.doesNotMatch(r.split("\n---\n")[0], /^model:/m, `${nombre}: conserva model`);
      }
      for (const a of agentes) {
        const rol = agenteARol(a, readFileSync(join(ROOT, "agents", a + ".md"), "utf8"), opciones);
        assert.deepEqual(validarSkill(rol.nombre, rol.skillMd, ESTRICTO), [], rol.nombre);
      }
    });
  }
  test("las 14 skills propias con `model:` en la fuente salen sin él, y las 31 conservan name y description", () => {
    let conModel = 0;
    for (const [nombre, md] of propias) {
      const src = separarCabecera(md).campos;
      const r = separarCabecera(adaptarSkill(md, { prefijo: "/", comandos })).campos;
      if (src.has("model")) conModel++;
      assert.equal(r.has("model"), false, nombre);
      assert.equal(r.get("name")?.replace(/["']/g, ""), nombre);
      assert.ok(r.get("description"), nombre);
    }
    assert.equal(conModel, 14, "las fuentes de Claude Code siguen llevando `model:`");
  });
});
