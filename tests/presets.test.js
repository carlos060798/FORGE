// @ts-check
/**
 * Tests de integridad de presets/*.yaml
 *
 * Qué verifica:
 *  1. Cada preset declara todos los agentes que existen en agents/
 *  2. Cada agente en el preset tiene 'activo' (boolean) y 'modelo'
 *  3. Los modelos son válidos (opus | sonnet | haiku)
 *  4. Todos los presets tienen sección 'calidad' con los campos esperados
 *  5. Los tres presets requeridos existen (lean, startup, enterprise)
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, basename, extname } from "node:path";
import { yamlFiles, mdFiles, stem, ROOT } from "./helpers.js";

const PRESETS_DIR = "presets";
const AGENTS_DIR = "agents";

const presetFiles = yamlFiles(PRESETS_DIR);
const agentNames = mdFiles(AGENTS_DIR).map((f) => stem(f));

const VALID_MODELS = new Set(["opus", "sonnet", "haiku"]);
const REQUIRED_PRESETS = ["lean", "startup", "enterprise"];
const REQUIRED_CALIDAD_KEYS = [
  "cobertura_tests_minima",
  "permitir_warnings_lint",
  "longitud_funcion_maxima",
];

/**
 * Parser mínimo de YAML plano para presets.
 * Lee clave:valor con indentación — no soporta listas complejas.
 * @param {string} filePath
 * @returns {Record<string, any>}
 */
function parsePresetYaml(filePath) {
  const lines = readFileSync(filePath, "utf8").split("\n");
  const result = /** @type {Record<string, any>} */ ({});
  let section = "";
  let subsection = "";

  for (const rawLine of lines) {
    // Saltar comentarios y líneas vacías
    if (rawLine.trim().startsWith("#") || rawLine.trim() === "") continue;

    const indent = rawLine.search(/\S/);
    const line = rawLine.trim();

    // Sección de nivel 0 (sin indentación)
    if (indent === 0 && line.endsWith(":")) {
      section = line.slice(0, -1);
      result[section] = result[section] || {};
      subsection = "";
      continue;
    }

    // Subsección de nivel 1 (2 espacios)
    if (indent === 2 && line.endsWith(":")) {
      subsection = line.slice(0, -1);
      if (section) {
        result[section][subsection] = result[section][subsection] || {};
      }
      continue;
    }

    // Clave:valor en subsección (4 espacios)
    if (indent === 4 && section && subsection) {
      const m = line.match(/^([a-zA-Z_-]+):\s*(.*)$/);
      if (m) {
        const [, k, v] = m;
        let val = v.trim().split("#")[0].trim(); // quitar comentarios inline
        result[section][subsection][k] =
          val === "true" ? true : val === "false" ? false : isNaN(Number(val)) ? val : Number(val);
      }
      continue;
    }

    // Clave:valor en sección de nivel 1 (2 espacios sin subsección)
    if (indent === 2 && section && !line.endsWith(":")) {
      const m = line.match(/^([a-zA-Z_-]+):\s*(.*)$/);
      if (m && typeof result[section] === "object") {
        const [, k, v] = m;
        let val = v.trim().split("#")[0].trim();
        result[section][k] =
          val === "true" ? true : val === "false" ? false : isNaN(Number(val)) ? val : Number(val);
      }
    }
  }

  return result;
}

// ─── 1. Los tres presets requeridos existen ───────────────────────────────────

describe("presets — archivos requeridos", () => {
  const presetNames = presetFiles.map((f) => stem(f));

  for (const required of REQUIRED_PRESETS) {
    test(`existe presets/${required}.yaml`, () => {
      assert.ok(
        presetNames.includes(required),
        `falta presets/${required}.yaml`
      );
    });
  }
});

// ─── 2. Cada preset declara todos los agentes ─────────────────────────────────

describe("presets — cobertura de agentes", () => {
  for (const file of presetFiles) {
    const name = stem(file);
    const data = parsePresetYaml(file);
    const agentesSection = data.agentes || {};

    for (const agentName of agentNames) {
      test(`${name}: declara agente '${agentName}'`, () => {
        assert.ok(
          agentName in agentesSection,
          `preset ${name}: no declara el agente '${agentName}'`
        );
      });
    }
  }
});

// ─── 3. Cada agente en el preset tiene activo + modelo válido ─────────────────

describe("presets — validez de configuración de agentes", () => {
  for (const file of presetFiles) {
    const name = stem(file);
    const data = parsePresetYaml(file);
    const agentesSection = data.agentes || {};

    for (const [agentName, cfg] of Object.entries(agentesSection)) {
      test(`${name}/${agentName}: tiene campo 'activo'`, () => {
        assert.ok(
          "activo" in cfg,
          `${name}/${agentName}: falta 'activo'`
        );
      });

      // 'modelo' solo requerido cuando activo: true
      if (cfg.activo === true) {
        test(`${name}/${agentName} (activo): modelo válido`, () => {
          assert.ok(
            VALID_MODELS.has(String(cfg.modelo)),
            `${name}/${agentName}: modelo='${cfg.modelo}' no es válido`
          );
        });
      }
    }
  }
});

// ─── 4. Sección calidad con campos mínimos ────────────────────────────────────

describe("presets — sección calidad", () => {
  for (const file of presetFiles) {
    const name = stem(file);
    const data = parsePresetYaml(file);
    const calidad = data.calidad || {};

    for (const key of REQUIRED_CALIDAD_KEYS) {
      test(`${name}/calidad: tiene '${key}'`, () => {
        assert.ok(
          key in calidad,
          `preset ${name}: falta calidad.${key}`
        );
      });
    }
  }
});
