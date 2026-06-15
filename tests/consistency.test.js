// @ts-check
/**
 * Tests de consistencia cruzada entre archivos del framework.
 *
 * Qué verifica:
 *  1. Cada agente en sdd.config.yaml de ejemplo coincide con agents/
 *  2. sdd.ayuda.md lista los mismos agentes que agents/
 *  3. Los skills referenciados en agentes existen en skills/
 *  4. Plantillas requeridas existen en plantillas/
 *  5. Los docs referenciados en sdd.ayuda.md existen en docs/
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { mdFiles, yamlFiles, readFile, stem, ROOT, skillNamesAll } from "./helpers.js";

const agentNames = mdFiles("agents").map((f) => stem(f));
// Incluye skills planas (.md) y en formato carpeta (SKILL.md)
const skillNames = skillNamesAll();

// ─── 1. sdd.config.yaml de ejemplo tiene todos los agentes ───────────────────

describe("consistency — sdd.config.yaml ↔ agents/", () => {
  const configPath = join(ROOT, "configuracion-ejemplo", "sdd.config.yaml");
  const configContent = readFile(configPath);

  for (const agent of agentNames) {
    test(`sdd.config.yaml menciona agente '${agent}'`, () => {
      assert.ok(
        configContent.includes(`${agent}:`),
        `sdd.config.yaml no tiene entrada para el agente '${agent}'`
      );
    });
  }
});

// ─── 2. sdd.ayuda.md lista todos los agentes ─────────────────────────────────

describe("consistency — sdd.ayuda.md ↔ agents/", () => {
  const ayudaContent = readFile(join(ROOT, "commands", "sdd.ayuda.md"));

  for (const agent of agentNames) {
    test(`sdd.ayuda.md menciona agente '${agent}'`, () => {
      assert.ok(
        ayudaContent.includes(agent),
        `sdd.ayuda.md no menciona el agente '${agent}'`
      );
    });
  }
});

// ─── 3. Skills referenciados en agentes existen ───────────────────────────────

describe("consistency — skills referenciados en agentes existen", () => {
  // Los agentes referencian skills con: @skill/nombre o cat .../skills/nombre.md
  // Buscamos menciones de skills/X.md en el cuerpo de cada agente
  const agentFiles = mdFiles("agents");

  for (const file of agentFiles) {
    const agentName = stem(file);
    const content = readFile(file);

    // Extraer referencias del tipo "skills/nombre-skill.md"
    const refs = [...content.matchAll(/skills\/([a-z-]+)\.md/g)].map(
      (m) => m[1]
    );

    for (const ref of refs) {
      test(`${agentName}: skill referenciado '${ref}' existe en skills/`, () => {
        assert.ok(
          skillNames.includes(ref),
          `${agentName}: referencia a skills/${ref}.md pero ese archivo no existe`
        );
      });
    }
  }
});

// ─── 4. Plantillas requeridas existen ────────────────────────────────────────

describe("consistency — plantillas requeridas existen", () => {
  const REQUIRED_TEMPLATES = [
    "especificacion",
    "plan",
    "tareas",
    "constitucion",
    "checklist-especificacion",
    "analisis",
    "snapshot",
    "glosario",
    "decision-arquitectura",
  ];

  const templateFiles = mdFiles("plantillas").map((f) => stem(f));

  for (const t of REQUIRED_TEMPLATES) {
    test(`existe plantillas/${t}.md`, () => {
      assert.ok(
        templateFiles.includes(t),
        `falta plantilla requerida: plantillas/${t}.md`
      );
    });
  }
});

// ─── 5. Constitutional AI — skill existe y es referenciado ───────────────────

describe("consistency — skill constitucion-constraint existe y se referencia", () => {
  test("existe skills/constitucion-constraint.md", () => {
    assert.ok(
      skillNames.includes("constitucion-constraint"),
      "falta skills/constitucion-constraint.md (Constitutional AI skill)"
    );
  });

  test("sdd.planificar.md referencia el skill constitucion-constraint", () => {
    const content = readFile(join(ROOT, "commands", "sdd.planificar.md"));
    assert.ok(
      content.includes("constitucion-constraint"),
      "sdd.planificar.md no referencia el skill 'constitucion-constraint'"
    );
  });

  test("arquitecto.md referencia el skill constitucion-constraint", () => {
    const content = readFile(join(ROOT, "agents", "arquitecto.md"));
    assert.ok(
      content.includes("constitucion-constraint"),
      "arquitecto.md no referencia el skill 'constitucion-constraint'"
    );
  });
});

// ─── 6. Docs referenciados en sdd.ayuda.md existen ───────────────────────────

describe("consistency — docs/ referenciados en sdd.ayuda.md existen", () => {
  const ayudaContent = readFile(join(ROOT, "commands", "sdd.ayuda.md"));

  // Extraer menciones del tipo docs/ARCHIVO.md
  const refs = [...ayudaContent.matchAll(/docs\/([A-Z]+\.md)/g)].map(
    (m) => m[1]
  );

  for (const ref of refs) {
    test(`docs/${ref} existe`, () => {
      const fullPath = join(ROOT, "docs", ref);
      assert.ok(
        existsSync(fullPath),
        `sdd.ayuda.md referencia docs/${ref} pero ese archivo no existe`
      );
    });
  }
});

// ─── 7. Guard de drift: plugin.json ↔ archivos reales ─────────────────────────
// Evita que .claude-plugin/plugin.json se desincronice de commands/agents/skills.
// (Causa raíz del fallo histórico: commands/ se movió y nadie lo detectó.)

describe("consistency — plugin.json ↔ commands/agents/skills reales", () => {
  const plugin = JSON.parse(
    readFileSync(join(ROOT, ".claude-plugin", "plugin.json"), "utf8")
  );

  const commandNames = mdFiles("commands").map((f) => stem(f));

  // 7a. Todo comando en disco está declarado en plugin.json
  for (const cmd of commandNames) {
    test(`plugin.json declara el comando '${cmd}'`, () => {
      assert.ok(
        plugin.commands.includes(cmd),
        `commands/${cmd}.md existe pero no está en plugin.json (commands)`
      );
    });
  }

  // 7b. Todo comando declarado en plugin.json existe en disco
  for (const cmd of plugin.commands) {
    test(`comando declarado '${cmd}' existe en commands/`, () => {
      assert.ok(
        commandNames.includes(cmd),
        `plugin.json declara '${cmd}' pero no existe commands/${cmd}.md`
      );
    });
  }

  // 7c. Todo agente en disco está declarado en plugin.json
  for (const agent of agentNames) {
    test(`plugin.json declara el agente '${agent}'`, () => {
      assert.ok(
        plugin.agents.includes(agent),
        `agents/${agent}.md existe pero no está en plugin.json (agents)`
      );
    });
  }

  // 7d. Toda skill (plana o carpeta) en disco está declarada en plugin.json
  for (const skill of skillNames) {
    test(`plugin.json declara la skill '${skill}'`, () => {
      assert.ok(
        plugin.skills.includes(skill),
        `skills/${skill} existe pero no está en plugin.json (skills)`
      );
    });
  }
});
