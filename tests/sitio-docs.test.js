// @ts-check
/**
 * El sitio publicado (docs-site/) no puede contradecir el código ni quedarse en una versión anterior.
 * Fase 0 del plan docs/informes/PLAN-DOCUMENTACION-PUBLICA.md. Cuando la fase 1 genere el sitio desde docs/,
 * esta prueba se adapta a la nueva fuente: sus comprobaciones (términos, enlaces, scripts) siguen valiendo.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const leer = (/** @type {string} */ rel) => readFileSync(join(ROOT, rel), "utf8");

const { UI, GROUP_ORDER, PAGES } = new Function(`${leer("docs-site/assets/data.js")}; return { UI, GROUP_ORDER, PAGES };`)();
const INDEX = leer("docs-site/index.html");
const ids = Object.keys(PAGES);
const VERSION = JSON.parse(leer("package.json")).version;

describe("docs-site: estructura", () => {
  test("hay páginas y todas tienen título y contenido en español e inglés, en una sección válida", () => {
    assert.ok(ids.length >= 15, `solo ${ids.length} páginas`);
    for (const id of ids) {
      assert.ok(GROUP_ORDER.includes(PAGES[id].seccion), `${id}: sección «${PAGES[id].seccion}» no está en GROUP_ORDER`);
      for (const l of ["es", "en"]) {
        assert.ok(PAGES[id][l]?.titulo, `${id}.${l}: sin título`);
        assert.ok(String(PAGES[id][l]?.html ?? "").length > 200, `${id}.${l}: sin contenido`);
      }
    }
  });

  test("no hay fragmentos HTML sueltos en assets/ que ninguna página use", () => {
    assert.ok(!existsSync(join(ROOT, "docs-site", "assets", "pages")), "docs-site/assets/pages/ debería estar vacío o no existir");
  });

  test("las anclas internas (#id) apuntan a páginas que existen", () => {
    for (const id of ids) for (const l of ["es", "en"]) {
      for (const m of PAGES[id][l].html.matchAll(/href="#([\w-]+)"/g)) {
        assert.ok(PAGES[m[1]], `${id}.${l}: enlace a #${m[1]}, que no es una página`);
      }
    }
  });
});

describe("docs-site: contenido al día", () => {
  const todoEs = ids.map((i) => PAGES[i].es.html).join("\n");
  const todoEn = ids.map((i) => PAGES[i].en.html).join("\n");

  test("la versión del sitio es la del paquete", () => {
    assert.equal(UI.es.brand_tag, `v${VERSION}`);
    assert.equal(UI.en.brand_tag, `v${VERSION}`);
    assert.ok(INDEX.includes(VERSION), "index.html no menciona la versión del paquete");
  });

  test("el producto se llama Fragua en el chrome del sitio", () => {
    assert.match(UI.es.footer_text, /Fragua/);
    assert.match(INDEX, /<title>Fragua/);
    assert.match(INDEX, /class="brand-name">Fragua/);
  });

  test("lo que distingue a la 5.0 está en el sitio, en los dos idiomas: ciclo verificado y Docker", () => {
    assert.match(todoEs, /ciclo verificado/i);
    assert.match(todoEs, /Docker/);
    assert.match(todoEn, /verified cycle/i);
    assert.match(todoEn, /Docker/);
    assert.ok(PAGES["ciclo-verificado"], "falta la página del ciclo verificado");
  });

  test("dice que es pre-beta y que no está publicado en npm, y no vende «Producción»", () => {
    assert.match(todoEs, /pre-beta/i);
    assert.match(todoEs, /no (está|es)tá publicad/i);
    assert.doesNotMatch(todoEs + todoEn, /✅ Producción/);
  });

  test("describe el perfil esencial y el preset lean que instala `init` por defecto", () => {
    assert.match(PAGES.instalacion.es.html, /esencial/);
    assert.match(PAGES.instalacion.es.html, /lean/);
  });

  test("el requisito de Node es el del paquete (≥ 20), no una versión anterior", () => {
    const engines = JSON.parse(leer("package.json")).engines.node;
    assert.match(engines, />=\s*20/);
    assert.doesNotMatch(todoEs, /Node(\.js)?\s*(≥|>=)\s*18/);
  });
});

describe("docs-site: enlaces y scripts", () => {
  test("cada enlace a un archivo del repositorio en GitHub apunta a algo que existe", () => {
    const todo = ids.map((i) => PAGES[i].es.html + PAGES[i].en.html).join("\n") + INDEX;
    const rutas = new Set();
    for (const m of todo.matchAll(/https:\/\/github\.com\/carlos060798\/FORGE\/(?:blob|tree)\/main\/([^"'\s<>)#]+)/g)) rutas.add(m[1]);
    assert.ok(rutas.size >= 5, `solo ${rutas.size} enlaces a archivos del repositorio`);
    for (const r of rutas) assert.ok(existsSync(join(ROOT, r)), `el sitio enlaza a ${r}, que no existe en el repositorio`);
  });

  test("ningún script externo se carga sin versión fija y sin hash de integridad", () => {
    for (const m of INDEX.matchAll(/<script[^>]+src="(https?:[^"]+)"[^>]*>/g)) {
      assert.match(m[0], /integrity="sha(256|384|512)-/, `script externo sin integridad: ${m[1]}`);
      assert.match(m[1], /@\d+\.\d+\.\d+/, `script externo sin versión exacta: ${m[1]}`);
    }
  });

  test("sin JavaScript hay un resumen con enlaces al repositorio", () => {
    assert.match(INDEX, /<noscript>[\s\S]*github\.com\/carlos060798\/FORGE[\s\S]*<\/noscript>/);
  });

  test("informe: proporción del inglés frente al español (no falla; deja constancia)", (t) => {
    const es = ids.reduce((a, i) => a + PAGES[i].es.html.length, 0);
    const en = ids.reduce((a, i) => a + PAGES[i].en.html.length, 0);
    t.diagnostic(`inglés/español: ${Math.round((en / es) * 100)} % (${en} / ${es} caracteres de HTML)`);
    assert.ok(en > 0);
  });
});
