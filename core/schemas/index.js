/**
 * core/schemas/index.js — Exporta y valida los esquemas de artefactos FORGE
 *
 * Los esquemas son el contrato público del framework: definen los artefactos
 * que viajan entre hosts (Claude Code, terminal, otras consolas).
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const SCHEMA_VERSION = '1.0';

export const SCHEMAS = {
  ir:     join(__dirname, 'ir.schema.json'),
  estado: join(__dirname, 'estado.schema.json'),
  adr:    join(__dirname, 'adr.schema.json'),
};

/**
 * Carga un esquema por nombre.
 * @param {'ir'|'estado'|'adr'} nombre
 * @returns {object} JSON Schema
 */
export function loadSchema(nombre) {
  const path = SCHEMAS[nombre];
  if (!path || !existsSync(path)) throw new Error(`Esquema desconocido: "${nombre}"`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

/**
 * Valida un artefacto contra su esquema sin dependencias externas.
 * Validación mínima: verifica campos required y tipos básicos.
 *
 * @param {'ir'|'estado'|'adr'} nombre
 * @param {object} artefacto
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateArtefacto(nombre, artefacto) {
  const schema = loadSchema(nombre);
  const errors = [];

  if (typeof artefacto !== 'object' || artefacto === null) {
    return { valid: false, errors: ['El artefacto debe ser un objeto JSON'] };
  }

  // Verificar schemaVersion
  if (schema.properties?.schemaVersion?.const) {
    if (artefacto.schemaVersion !== schema.properties.schemaVersion.const) {
      errors.push(`schemaVersion debe ser "${schema.properties.schemaVersion.const}", recibido: "${artefacto.schemaVersion}"`);
    }
  }

  // Verificar campos required
  for (const campo of (schema.required ?? [])) {
    if (!(campo in artefacto)) {
      errors.push(`Campo requerido ausente: "${campo}"`);
    }
  }

  // Verificar enums de primer nivel
  for (const [campo, def] of Object.entries(schema.properties ?? {})) {
    if (def.enum && campo in artefacto) {
      if (!def.enum.includes(artefacto[campo])) {
        errors.push(`"${campo}" debe ser uno de: ${def.enum.join(', ')}. Recibido: "${artefacto[campo]}"`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
