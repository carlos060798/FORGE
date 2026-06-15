// @ts-check
/**
 * Tests de integridad de commands/*.md
 *
 * Qué verifica:
 *  1. Todos tienen frontmatter con `description`
 *  2. Los handoffs apuntan a comandos que existen
 *  3. sdd.ayuda.md menciona todos los comandos sdd.*.md
 *  4. sdd.md mapea todos los comandos sdd.*.md (excepto sdd.md y sdd.ayuda.md)
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { join, basename } from "node:path";
import { mdFiles, parseFrontmatter, readFile, stem, ROOT } from "./helpers.js";

const COMMANDS_DIR = "commands";
const commandFiles = mdFiles(COMMANDS_DIR);

// Nombres de comando sin extensión: "sdd.especificar", "sdd.release", etc.
const commandNames = new Set(commandFiles.map((f) => stem(f)));

// Commands que deben tener sección de validación de salida
const COMMANDS_WITH_VALIDATION = new Set([
  "sdd.especificar",
  "sdd.aclarar",
  "sdd.planificar",
  "sdd.tareas",
  "sdd.implementar",
]);

// ─── 1. Frontmatter mínimo ────────────────────────────────────────────────────

describe("commands — frontmatter", () => {
  for (const file of commandFiles) {
    const name = stem(file);

    test(`${name} tiene 'description' en frontmatter`, () => {
      const fm = parseFrontmatter(file);
      assert.ok(
        fm.description && String(fm.description).trim().length > 0,
        `${name}: falta 'description' en el frontmatter`
      );
    });

    test(`${name} tiene 'allowed-tools' en frontmatter`, () => {
      const fm = parseFrontmatter(file);
      assert.ok(
        fm["allowed-tools"],
        `${name}: falta 'allowed-tools' en el frontmatter`
      );
    });
  }
});

// ─── 2. Handoffs apuntan a comandos reales ───────────────────────────────────

describe("commands — handoffs", () => {
  for (const file of commandFiles) {
    const name = stem(file);
    const fm = parseFrontmatter(file);
    const handoffs = Array.isArray(fm.handoffs) ? fm.handoffs : [];

    for (const h of handoffs) {
      // h puede ser un objeto "etiqueta: X\ncomando: Y" o un string "sdd.X"
      const target = typeof h === "string" ? h : (h.comando ?? "");
      if (!target) continue;

      test(`${name}: handoff '${target}' apunta a un comando existente`, () => {
        assert.ok(
          commandNames.has(target),
          `${name}: handoff '${target}' no existe en commands/`
        );
      });
    }
  }
});

// ─── 3. sdd.ayuda menciona todos los comandos sdd.*.md ───────────────────────

describe("commands — sdd.ayuda.md es exhaustiva", () => {
  const ayudaPath = join(ROOT, COMMANDS_DIR, "sdd.ayuda.md");
  const ayudaContent = readFile(ayudaPath);

  // Solo los comandos sdd.*.md (excluye sdd.md porque es el hub sin nombre propio)
  const publicCommands = commandFiles.filter(
    (f) => stem(f).startsWith("sdd.") && stem(f) !== "sdd"
  );

  for (const file of publicCommands) {
    const name = stem(file); // "sdd.especificar"
    test(`sdd.ayuda.md menciona /${name}`, () => {
      assert.ok(
        ayudaContent.includes(`/${name}`),
        `sdd.ayuda.md no menciona /${name}`
      );
    });
  }
});

// ─── 4. Multi-Checkpoint — commands críticos tienen sección de validación ─────

describe("commands — validación de salida en commands críticos", () => {
  for (const file of commandFiles) {
    const name = stem(file);
    if (!COMMANDS_WITH_VALIDATION.has(name)) continue;

    test(`${name} tiene sección '## VALIDACIÓN DE SALIDA'`, () => {
      const content = readFile(file);
      assert.ok(
        content.includes("## VALIDACIÓN DE SALIDA"),
        `${name}: falta sección '## VALIDACIÓN DE SALIDA' (Multi-Checkpoint)`
      );
    });
  }
});

// ─── 5. sdd.md mapea todos los comandos sdd.*.md ─────────────────────────────

describe("commands — sdd.md enruta a todos los comandos", () => {
  const hubPath = join(ROOT, COMMANDS_DIR, "sdd.md");
  const hubContent = readFile(hubPath);

  const routableCommands = commandFiles.filter((f) => {
    const n = stem(f);
    // sdd.md y sdd.ayuda no necesitan ser enrutados por el hub
    return n.startsWith("sdd.") && n !== "sdd" && n !== "sdd.ayuda";
  });

  for (const file of routableCommands) {
    const name = stem(file);
    test(`sdd.md referencia /${name}`, () => {
      assert.ok(
        hubContent.includes(`/${name}`) || hubContent.includes(`\`${name}\``),
        `sdd.md no referencia /${name}`
      );
    });
  }
});
