// @ts-check
/**
 * Tests de integridad de agents/*.md
 *
 * Qué verifica:
 *  1. Todos tienen frontmatter con description, model, tools
 *  2. model es uno de los valores válidos (opus | sonnet | haiku)
 *  3. Los agentes READ-ONLY no declaran Write en tools
 *  4. Todos tienen al menos una sección "## Skills obligatorios" o "## Cuándo"
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mdFiles, parseFrontmatter, readFile, stem } from "./helpers.js";

const AGENTS_DIR = "agents";
const agentFiles = mdFiles(AGENTS_DIR);

const VALID_MODELS = new Set(["opus", "sonnet", "haiku"]);

// Agentes que son READ-ONLY por diseño (no deben tener Write en tools)
const READ_ONLY_AGENTS = new Set([
  "arquitecto",
  "revisor",
  "critico",
  "seguridad",
  "asesor-datos",
  "investigador",
]);

// ─── 1. Frontmatter mínimo ────────────────────────────────────────────────────

describe("agents — frontmatter", () => {
  for (const file of agentFiles) {
    const name = stem(file);

    test(`${name} tiene 'description'`, () => {
      const fm = parseFrontmatter(file);
      assert.ok(
        fm.description && String(fm.description).trim().length > 0,
        `${name}: falta 'description'`
      );
    });

    test(`${name} tiene 'model'`, () => {
      const fm = parseFrontmatter(file);
      assert.ok(fm.model, `${name}: falta 'model'`);
    });

    test(`${name} tiene 'tools'`, () => {
      const fm = parseFrontmatter(file);
      assert.ok(fm.tools, `${name}: falta declaración 'tools'`);
    });
  }
});

// ─── 2. Modelo válido ─────────────────────────────────────────────────────────

describe("agents — model válido", () => {
  for (const file of agentFiles) {
    const name = stem(file);
    test(`${name}: model es opus | sonnet | haiku`, () => {
      const fm = parseFrontmatter(file);
      assert.ok(
        VALID_MODELS.has(String(fm.model)),
        `${name}: model='${fm.model}' no es válido (opus|sonnet|haiku)`
      );
    });
  }
});

// ─── 3. Agentes READ-ONLY no declaran Write ───────────────────────────────────

describe("agents — READ-ONLY no tienen Write en tools", () => {
  for (const file of agentFiles) {
    const name = stem(file);
    if (!READ_ONLY_AGENTS.has(name)) continue;

    test(`${name} (READ-ONLY) no declara Write en tools`, () => {
      const fm = parseFrontmatter(file);
      const tools = String(fm.tools || "");
      assert.ok(
        !tools.includes("Write"),
        `${name}: es READ-ONLY pero declara 'Write' en tools: '${tools}'`
      );
    });
  }
});

// ─── 4. Estructura mínima del cuerpo ─────────────────────────────────────────

describe("agents — estructura del cuerpo", () => {
  for (const file of agentFiles) {
    const name = stem(file);
    const content = readFile(file);

    test(`${name} tiene sección '## Skills obligatorios' o '## Cuándo'`, () => {
      const hasSkills = content.includes("## Skills obligatorios");
      const hasCuando = content.includes("## Cuándo");
      assert.ok(
        hasSkills || hasCuando,
        `${name}: falta sección '## Skills obligatorios' o '## Cuándo te'`
      );
    });

    test(`${name} tiene sección '## Lo que NO haces'`, () => {
      assert.ok(
        content.includes("## Lo que NO haces"),
        `${name}: falta sección '## Lo que NO haces'`
      );
    });
  }
});

// ─── 5. RAG por capas — los Skills obligatorios tienen carga estructurada ────

describe("agents — RAG por capas en Skills obligatorios", () => {
  for (const file of agentFiles) {
    const name = stem(file);
    const content = readFile(file);

    // Solo agentes que tienen la sección Skills obligatorios
    if (!content.includes("## Skills obligatorios")) continue;

    test(`${name} tiene CAPA 0 (estado.json) en Skills obligatorios`, () => {
      assert.ok(
        content.includes("estado.json"),
        `${name}: Skills obligatorios no carga estado.json (CAPA 0)`
      );
    });

    test(`${name} tiene CAPA 1 (spec activa) en Skills obligatorios`, () => {
      assert.ok(
        content.includes("SPEC_ID") || content.includes("contexto-descubrimiento"),
        `${name}: Skills obligatorios no carga la spec activa (CAPA 1)`
      );
    });
  }
});
