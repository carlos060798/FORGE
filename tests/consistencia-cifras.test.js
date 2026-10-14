// @ts-check
/**
 * Consistencia de las cifras escritas en prosa con lo que hay en disco, y de la integración continua
 * con lo que dicen los documentos.
 *
 * Qué verifica:
 *  1. Las cifras de agentes, comandos y skills que aparecen en README.md, package.json,
 *     .claude-plugin/*.json, docs/introduction.md, docs/0-INDICE.md, docs/GLOSARIO.md,
 *     docs-site/assets/data.js y docs-site/index.html coinciden con agents/, commands/ y skills/.
 *     Si una cifra no coincide, se corrige el documento, no esta prueba.
 *  2. Las cifras que no son «el total» (agentes de solo lectura, agentes del preset lean, comandos
 *     principales del pipeline) coinciden con su fuente: el guardia de escritura, presets/lean.yaml
 *     y la lista numerada del glosario.
 *  3. Los enlaces relativos de docs/0-INDICE.md existen, con las mayúsculas exactas (en Linux
 *     Ejemplo-API-REST.md y EJEMPLO-API-REST.md son archivos distintos).
 *  4. .github/workflows/ci.yml: estructura, jobs `test`, `tipos`, `aislamiento` y `pruebas-docker`, y que
 *     los nombres de job que cita RELEASE-CHECKLIST.md existen. No ejecuta el flujo: eso solo ocurre en GitHub.
 *  5. VERSIONING.md y docs/servidor-mcp.md no dicen lo que el código desmiente.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve, dirname, sep } from "node:path";
import { mdFiles, skillNamesAll, stem, ROOT } from "./helpers.js";
import { PAQUETE, PAQUETE_ANTIGUO } from "../core/nombres.js";

const leer = (/** @type {string} */ ruta) => readFileSync(join(ROOT, ruta), "utf8").replace(/\r\n/g, "\n");

const AGENTES = mdFiles("agents").length;
const COMANDOS = mdFiles("commands").length;
const SKILLS = skillNamesAll().length;

// ─── Fuentes de las cifras que no son «el total» ───────────────────────────────

/** Agentes de solo lectura que impone el guardia de escritura. */
function agentesSoloLectura() {
  const src = leer("claude-hooks/pre-tool-guard.js");
  const m = /const READ_ONLY_AGENTS = new Set\(\[([\s\S]*?)\]\)/.exec(src);
  assert.ok(m, "no se encontró READ_ONLY_AGENTS en claude-hooks/pre-tool-guard.js");
  return [...m[1].matchAll(/'([a-z-]+)'/g)].map((x) => x[1]);
}

/** Agentes con `activo: true` en el preset lean. */
function agentesLean() {
  const t = leer("presets/lean.yaml");
  const seccion = t.split(/^agentes:/m)[1] ?? "";
  return [...seccion.matchAll(/^ {2}([\w-]+):\s*\n\s+activo: true/gm)].map((x) => x[1]);
}

const SOLO_LECTURA = agentesSoloLectura();
const LEAN = agentesLean();

// ─── 1. Cifras en prosa ───────────────────────────────────────────────────────

const ARCHIVOS_CON_CIFRAS = [
  "README.md",
  "package.json",
  ".claude-plugin/plugin.json",
  ".claude-plugin/marketplace.json",
  "docs/introduction.md",
  "docs/0-INDICE.md",
  "docs/GLOSARIO.md",
  "docs-site/assets/data.js",
  "docs-site/index.html",
];

/**
 * Qué cifra corresponde a una mención «N agentes / comandos / skills», según su contexto.
 * @param {'agentes'|'comandos'|'skills'} familia
 * @param {string} antes   texto justo antes
 * @param {string} despues texto justo después
 * @returns {{ esperado: number, que: string } | null}  null: no es una cifra comprobable (se ignora a propósito)
 */
function esperadoPara(familia, antes, despues) {
  const a = antes.toLowerCase();
  const d = despues.toLowerCase();
  if (familia === "agentes") {
    if (/^\W*(activos|active)\b/.test(d) || /\bactiva\s*\W*$/.test(a)) return { esperado: LEAN.length, que: "agentes activos del preset lean" };
    if (/^\W*(read-only|bloquead|blocked)/.test(d) || /are strictly read-only/.test(d + " " + a)) return { esperado: SOLO_LECTURA.length, que: "agentes de solo lectura del guardia" };
    if (/^\W*can write/.test(d)) return { esperado: AGENTES - SOLO_LECTURA.length, que: "agentes que pueden escribir" };
    if (/^\W*restantes/.test(d)) return null;
    return { esperado: AGENTES, que: "agentes en agents/" };
  }
  if (familia === "comandos") {
    // «8 comandos principales / del pipeline»: son los de la lista numerada del glosario, no el total.
    if (/^\W*(principales|del pipeline)/.test(d) || /\bde los\s*$/.test(a)) return { esperado: comandosPrincipales().length, que: "comandos principales del glosario" };
    return { esperado: COMANDOS, que: "comandos en commands/" };
  }
  return { esperado: SKILLS, que: "skills en skills/" };
}

/** Los comandos de la lista numerada que sigue a «Los 8 comandos principales» del glosario. */
function comandosPrincipales() {
  const t = leer("docs/GLOSARIO.md");
  const i = t.indexOf("comandos principales que avanzan el pipeline linealmente");
  assert.ok(i >= 0, "el glosario ya no tiene la lista de comandos principales");
  const bloque = t.slice(i).split("\n").slice(1);
  /** @type {string[]} */
  const lista = [];
  for (const l of bloque) {
    const m = /^\d+\.\s+`\/(sdd\.[^`]+)`/.exec(l);
    if (m) lista.push(m[1]);
    else if (lista.length > 0) break;
  }
  return lista;
}

describe("cifras en prosa — documentos y manifiestos contra el disco", () => {
  test("las cifras de referencia no son cero", () => {
    assert.ok(AGENTES > 0 && COMANDOS > 0 && SKILLS > 0 && SOLO_LECTURA.length > 0 && LEAN.length > 0);
  });

  const re = /(\d+)(?:\*{0,2})\s+(agentes|agents|comandos|commands|skills)\b/gi;

  for (const archivo of ARCHIVOS_CON_CIFRAS) {
    test(`${archivo}: cada «N agentes/comandos/skills» coincide con el disco`, () => {
      const t = leer(archivo);
      let comprobadas = 0;
      /** @type {string[]} */
      const errores = [];
      for (const m of t.matchAll(re)) {
        const n = Number(m[1]);
        const palabra = m[2].toLowerCase();
        const familia = /** @type {'agentes'|'comandos'|'skills'} */ (
          palabra.startsWith("agent") ? "agentes" : palabra.startsWith("command") || palabra === "comandos" ? "comandos" : "skills"
        );
        const idx = /** @type {number} */ (m.index);
        const antes = t.slice(Math.max(0, idx - 30), idx).replace(/\s+/g, " ");
        const despues = t.slice(idx + m[0].length, idx + m[0].length + 40).replace(/\s+/g, " ");
        const exp = esperadoPara(familia, antes, despues);
        if (!exp) continue;
        comprobadas++;
        if (n !== exp.esperado) {
          errores.push(`«${m[0]}» (...${antes}[${m[0]}]${despues}...): en el disco hay ${exp.esperado} (${exp.que})`);
        }
      }
      assert.deepEqual(errores, [], `Cifras desfasadas en ${archivo}. Corrige el documento:\n${errores.join("\n")}`);
      assert.ok(comprobadas > 0 || archivo === "docs/0-INDICE.md", `${archivo} ya no menciona ninguna cifra: ¿se movió?`);
    });
  }
});

describe("cifras en prosa — las que no son el total", () => {
  test("el glosario lista tantos comandos principales como dice y todos existen", () => {
    const lista = comandosPrincipales();
    assert.equal(lista.length, 8, "el glosario dice «8 comandos principales»");
    const comandos = mdFiles("commands").map((f) => stem(f));
    for (const c of lista) assert.ok(comandos.includes(c), `el glosario lista /${c}, pero no existe commands/${c}.md`);
  });

  test("el glosario reparte los agentes totales entre agentes que existen", () => {
    const t = leer("docs/GLOSARIO.md");
    const i = t.indexOf("FORGE tiene **");
    assert.ok(i >= 0);
    const bloque = t.slice(i).split("\n\n")[0];
    const total = Number(/FORGE tiene \*\*(\d+) agentes totales\*\*/.exec(bloque)?.[1]);
    assert.equal(total, AGENTES);
    const existentes = mdFiles("agents").map((f) => stem(f));
    /** @type {string[]} */
    const nombres = [];
    let sumaGrupos = 0;
    for (const l of bloque.split("\n")) {
      const m = /^- (\d+) [^:]+:\s*(.+)$/.exec(l);
      if (!m) continue;
      const grupo = m[2].split(",").map((s) => s.trim()).filter(Boolean);
      assert.equal(grupo.length, Number(m[1]), `«${l}»: dice ${m[1]} y lista ${grupo.length}`);
      sumaGrupos += grupo.length;
      nombres.push(...grupo);
    }
    assert.equal(sumaGrupos, total, "los grupos del glosario no suman el total");
    for (const n of nombres) assert.ok(existentes.includes(n), `el glosario cita el agente «${n}», que no existe en agents/`);
    assert.equal(new Set(nombres).size, nombres.length, "un agente aparece en dos grupos del glosario");
  });

  test("los agentes de solo lectura del guardia existen", () => {
    const existentes = mdFiles("agents").map((f) => stem(f));
    for (const a of SOLO_LECTURA) assert.ok(existentes.includes(a), `READ_ONLY_AGENTS nombra «${a}», que no existe en agents/`);
  });

  test("data.js reparte los agentes entre solo lectura y escritura sin que sobre ni falte", () => {
    const t = leer("docs-site/assets/data.js");
    const lectura = Number(/(\d+) agents are strictly read-only/.exec(t)?.[1]);
    const escritura = Number(/(\d+) agents can write files/.exec(t)?.[1]);
    assert.equal(lectura, SOLO_LECTURA.length);
    assert.equal(escritura, AGENTES - SOLO_LECTURA.length);
    assert.equal(lectura + escritura, AGENTES);
  });

  test("la descripción del paquete y la de plugin.json dan las mismas cifras", () => {
    const pkg = JSON.parse(leer("package.json")).description;
    const plugin = JSON.parse(leer(".claude-plugin/plugin.json")).description;
    for (const [texto, nombre] of /** @type {const} */ ([[pkg, "package.json"], [plugin, ".claude-plugin/plugin.json"]])) {
      assert.match(texto, new RegExp(`\\b${AGENTES} agentes\\b`), `${nombre}: agentes`);
      assert.match(texto, new RegExp(`\\b${COMANDOS} comandos\\b`), `${nombre}: comandos`);
      assert.match(texto, new RegExp(`\\b${SKILLS} skills\\b`), `${nombre}: skills`);
    }
  });
});

// ─── 3. Enlaces del índice ────────────────────────────────────────────────────

/** ¿Existe la ruta con las mayúsculas exactas, componente a componente? (existsSync no basta en Windows y macOS) */
function existeExacta(/** @type {string} */ ruta) {
  const abs = resolve(ruta);
  const partes = abs.split(sep);
  let cur = partes[0] + sep;
  for (let i = 1; i < partes.length; i++) {
    if (!partes[i]) continue;
    let nombres;
    try { nombres = readdirSync(cur); } catch { return false; }
    if (!nombres.includes(partes[i])) return false;
    cur = join(cur, partes[i]);
  }
  return true;
}

describe("índices — enlaces relativos que existen, con sus mayúsculas", () => {
  for (const indice of ["docs/0-INDICE.md", "README.md", "docs/GLOSARIO.md", "docs/introduction.md"]) {
    test(`${indice}: ningún enlace apunta a un archivo que no existe`, () => {
      const t = leer(indice);
      /** @type {string[]} */
      const rotos = [];
      for (const m of t.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
        const destino = m[1];
        if (/^[a-z][a-z0-9+.-]*:/i.test(destino)) continue; // http:, https:, mailto:
        const ruta = resolve(dirname(join(ROOT, indice)), decodeURI(destino));
        if (!existeExacta(ruta)) rotos.push(destino);
      }
      assert.deepEqual(rotos, [], `${indice} enlaza a archivos que no existen (o con otras mayúsculas): ${rotos.join(", ")}`);
    });
  }

  test("docs/integraciones-externas.md existe, está en el índice y no pisa a docs/INTEGRACIONES.md", () => {
    assert.ok(existeExacta(join(ROOT, "docs", "integraciones-externas.md")));
    assert.ok(existeExacta(join(ROOT, "docs", "INTEGRACIONES.md")));
    assert.match(leer("docs/0-INDICE.md"), /\]\(integraciones-externas\.md\)/);
  });
});

// ─── 4. Integración continua ──────────────────────────────────────────────────

const WORKFLOW = leer(".github/workflows/ci.yml");

/** Jobs de un workflow: id, nombre y texto del bloque. Lector mínimo, sin dependencias. */
function jobsDe(/** @type {string} */ yaml) {
  const lineas = yaml.split("\n");
  const inicio = lineas.findIndex((l) => /^jobs:\s*$/.test(l));
  assert.ok(inicio >= 0, "ci.yml no tiene `jobs:`");
  /** @type {Array<{ id: string, nombre: string, texto: string }>} */
  const jobs = [];
  /** @type {{ id: string, lineas: string[] } | null} */
  let actual = null;
  for (const l of lineas.slice(inicio + 1)) {
    if (/^\S/.test(l)) break; // otra clave de primer nivel
    const m = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(l);
    if (m) {
      if (actual) jobs.push({ id: actual.id, nombre: nombreDe(actual.lineas), texto: actual.lineas.join("\n") });
      actual = { id: m[1], lineas: [] };
    } else if (actual) actual.lineas.push(l);
  }
  if (actual) jobs.push({ id: actual.id, nombre: nombreDe(actual.lineas), texto: actual.lineas.join("\n") });
  return jobs;
}
function nombreDe(/** @type {string[]} */ lineas) {
  const m = lineas.map((l) => /^ {4}name:\s*(.+?)\s*$/.exec(l)).find(Boolean);
  return m ? m[1] : "";
}

/** Archivos de pruebas que piden Docker real: la misma búsqueda que hace el job `pruebas-docker`. */
function archivosConDocker() {
  /** @type {string[]} */
  const salida = [];
  const recorrer = (/** @type {string} */ dir) => {
    for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) recorrer(rel);
      else if (e.name.endsWith(".test.js") && readFileSync(join(ROOT, rel), "utf8").includes("FORGE_TEST_DOCKER")) salida.push(rel);
    }
  };
  recorrer("tests");
  return salida.sort();
}

describe("integración continua — ci.yml", () => {
  const jobs = jobsDe(WORKFLOW);
  const porId = (/** @type {string} */ id) => {
    const j = jobs.find((x) => x.id === id);
    assert.ok(j, `ci.yml no tiene el job «${id}»`);
    return j;
  };

  test("estructura básica: sin tabuladores, sangría par, claves de primer nivel y runs-on/steps en cada job", () => {
    assert.ok(!WORKFLOW.includes("\t"), "ci.yml tiene tabuladores: YAML no los admite como sangría");
    for (const [i, l] of WORKFLOW.split("\n").entries()) {
      if (l.trim() === "" || /^\s*#/.test(l)) continue;
      const sangria = /^ */.exec(l)?.[0].length ?? 0;
      // Los bloques `run: |` pueden tener sangría impar solo dentro del script; aquí todos son pares.
      assert.equal(sangria % 2, 0, `línea ${i + 1}: sangría impar`);
    }
    assert.match(WORKFLOW, /^name: CI$/m);
    assert.match(WORKFLOW, /^on:\s*$/m);
    assert.match(WORKFLOW, /^jobs:\s*$/m);
    for (const j of jobs) {
      assert.match(j.texto, /^ {4}runs-on: /m, `${j.id}: sin runs-on`);
      assert.match(j.texto, /^ {4}steps:\s*$/m, `${j.id}: sin steps`);
      assert.match(j.texto, /^ {4}timeout-minutes: \d+$/m, `${j.id}: sin timeout-minutes (un job colgado consumiría la cuota)`);
      assert.ok(/^ {6}- name: /m.test(j.texto), `${j.id}: pasos sin nombre`);
    }
  });

  test("hay exactamente los jobs test, tipos, aislamiento y pruebas-docker", () => {
    assert.deepEqual(jobs.map((j) => j.id).sort(), ["aislamiento", "pruebas-docker", "test", "tipos"]);
  });

  test("test: la suite completa en la matriz de Node 20 y 22, sin Docker real", () => {
    const j = porId("test");
    assert.match(j.texto, /node-version: \[20, 22\]/);
    assert.match(j.texto, /^ {8}run: npm test$/m, "el job test debe ejecutar `npm test` completo");
    assert.match(j.texto, /FORGE_TEST_DOCKER: "0"/);
    assert.doesNotMatch(j.texto, /FORGE_TEST_DOCKER: "1"/);
  });

  test("tipos: npm run typecheck en Node 22", () => {
    const j = porId("tipos");
    assert.match(j.texto, /node-version: 22\b/);
    assert.match(j.texto, /run: npm run typecheck$/m);
  });

  test("aislamiento: la suite de aislamiento y la comprobación de contenedores residuales", () => {
    const j = porId("aislamiento");
    assert.match(j.texto, /node --test tests\/sandbox-real\.test\.js/);
    assert.match(j.texto, /FORGE_TEST_DOCKER: "1"/);
    assert.match(j.texto, /label=forge\.sandbox=1/);
  });

  test("pruebas-docker: descubre con grep los archivos con FORGE_TEST_DOCKER y los ejecuta con tiempo máximo", () => {
    const j = porId("pruebas-docker");
    assert.match(j.texto, /grep -rl FORGE_TEST_DOCKER tests --include='\*\.test\.js'/);
    assert.match(j.texto, /node --test --test-concurrency=1 \$archivos/);
    assert.match(j.texto, /FORGE_TEST_DOCKER: "1"/);
    const minutos = Number(/timeout-minutes: (\d+)/.exec(j.texto)?.[1]);
    assert.ok(minutos >= 20 && minutos <= 120, `timeout-minutes ${minutos} fuera de lo razonable (20 a 120)`);
  });

  test("los archivos con Docker real están dentro de lo que ejecuta npm test y su lista no está vacía", () => {
    const archivos = archivosConDocker();
    assert.ok(archivos.length >= 10, `solo ${archivos.length} archivos mencionan FORGE_TEST_DOCKER`);
    const script = JSON.parse(leer("package.json")).scripts.test;
    for (const a of archivos) {
      assert.match(a, /^tests\/(e2e\/)?[^/]+\.test\.js$/, `${a}: npm test (${script}) no lo ejecutaría`);
      if (a.startsWith("tests/e2e/")) assert.match(script, /tests\/e2e\/\*\.test\.js/);
      else assert.match(script, /tests\/\*\.test\.js/);
    }
    // El job de aislamiento sigue siendo un subconjunto de lo que ejecuta pruebas-docker
    assert.ok(archivos.includes("tests/sandbox-real.test.js"));
  });

  test("los nombres de job que cita RELEASE-CHECKLIST.md existen en ci.yml", () => {
    const lista = leer("RELEASE-CHECKLIST.md");
    const ids = jobs.map((j) => j.id);
    // Tres jobs que el documento tiene que nombrar entre comillas invertidas...
    for (const c of ["tipos", "aislamiento", "pruebas-docker"]) assert.ok(lista.includes(`\`${c}\``), `RELEASE-CHECKLIST.md ya no cita el job «${c}»`);
    // ...y todo lo que se presente como «el job `x`» tiene que existir
    for (const m of lista.matchAll(/\bjobs?\s+`([a-z][a-z0-9-]*)`/g)) {
      assert.ok(ids.includes(m[1]), `RELEASE-CHECKLIST.md cita el job «${m[1]}», que no está en ci.yml (${ids.join(", ")})`);
    }
    // Los nombres visibles de las comprobaciones de B1
    const nombres = ["Tests (Node 20)", "Tests (Node 22)", "Tipos (Node 22)", "Aislamiento con Docker real", "Pruebas con Docker real"];
    const reales = jobs.map((j) => j.nombre.replace("${{ matrix.node-version }}", "").trim());
    assert.ok(reales.includes("Tests (Node )"), "el nombre del job test debe llevar la versión de la matriz");
    for (const n of nombres) {
      assert.ok(lista.includes(n), `RELEASE-CHECKLIST.md ya no nombra la comprobación «${n}»`);
      if (n.startsWith("Tests (Node")) continue;
      assert.ok(jobs.some((j) => j.nombre === n), `ci.yml no tiene un job llamado «${n}»`);
    }
  });
});

// ─── 5. Frases que el código desmiente ────────────────────────────────────────

describe("documentos — frases que ya no son ciertas", () => {
  test("VERSIONING.md no usa el nombre antiguo del paquete en órdenes de npm", () => {
    const t = leer("VERSIONING.md");
    const pkg = JSON.parse(leer("package.json"));
    assert.equal(pkg.name, PAQUETE);
    assert.doesNotMatch(t, /npm (view|info|install|dist-tags ls|deprecate|unpublish) sdd-es/);
    assert.doesNotMatch(t, /npx sdd-es/);
    assert.doesNotMatch(t, /"name": "sdd-es"/);
    assert.ok(t.includes(PAQUETE) || t.includes(PAQUETE_ANTIGUO), "VERSIONING.md nombra el paquete");
  });

  test("docs/servidor-mcp.md cubre los mismos lenguajes que el ciclo, Go incluido", () => {
    const t = leer("docs/servidor-mcp.md");
    assert.match(t, /JavaScript\/TypeScript, Python o Go/);
    const prep = leer("core/sandbox/preparar-imagen.js");
    assert.match(prep, /JavaScript\/TypeScript, Python y Go/);
  });

  test("docs/PROBLEMAS-CONOCIDOS.md y MIGRACION-5.0.md llevan una fecha de 2026-10-12 o posterior", () => {
    assert.match(leer("docs/PROBLEMAS-CONOCIDOS.md"), /Fecha: \*\*2026-10-(1[2-9]|[23]\d)\*\*/);
    assert.match(leer("docs/MIGRACION-5.0.md"), /\(2026-10-(1[2-9]|[23]\d); /);
  });

  test("docs/ciclo-verificado.md no repite los pasos 3 y 4 de «Qué hace con cada tarea»", () => {
    const t = leer("docs/ciclo-verificado.md");
    const i = t.indexOf("## Qué hace con cada tarea");
    const j = t.indexOf("## Pruebas confiables");
    const numeros = [...t.slice(i, j).matchAll(/^(\d+)\. /gm)].map((m) => Number(m[1]));
    assert.deepEqual(numeros, numeros.map((_, k) => k + 1), `la lista numerada no es 1..n: ${numeros.join(",")}`);
  });

  test("CHANGELOG.md 4.3.0 no dice a la vez «sin revisión independiente» y «verificación independiente» de la API", () => {
    const t = leer("CHANGELOG.md");
    const i = t.indexOf("### API HTTP local");
    const j = t.indexOf("### Seguridad", i);
    assert.doesNotMatch(t.slice(i, j), /\*\*Sin revisión independiente ni de seguridad\*\*/);
  });

  test("README.md y package.json declaran la misma versión que el CHANGELOG", () => {
    const v = JSON.parse(leer("package.json")).version;
    assert.match(leer("CHANGELOG.md"), new RegExp(`^## \\[${v.replace(/\./g, "\\.")}\\]`, "m"));
    assert.ok(leer("README.md").includes(`versión-${v}-`) || leer("README.md").includes(`versi%C3%B3n-${v}-`));
    assert.ok(existsSync(join(ROOT, ".claude-plugin", "plugin.json")));
  });
});
