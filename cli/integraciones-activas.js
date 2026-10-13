/**
 * integraciones-activas.js — ¿hay alguna integración activa? Sin importar nada de integraciones.
 *
 * Es la puerta de `forge doctor` y `forge status`: una lectura de texto de .sdd/sdd.config.yaml,
 * sin entorno ni red. Solo si devuelve true se importa (dinámicamente) el paquete de integraciones.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** @param {string} cwd */
export function integracionesActivas(cwd) {
  try {
    const t = readFileSync(join(cwd, '.sdd', 'sdd.config.yaml'), 'utf8');
    if (!/^integraciones\s*:/m.test(t)) return false;
    return /^ {2}(?:github|gitlab|jira)_modo\s*:\s*["']?(?!apagado\b)[a-z_]+/m.test(t);
  } catch {
    return false;
  }
}
