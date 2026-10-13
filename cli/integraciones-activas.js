/**
 * integraciones-activas.js — ¿hay alguna integración activa? Sin importar nada de integraciones.
 *
 * Es la puerta de `forge doctor` y `forge status`: una lectura de texto de .sdd/sdd.config.yaml,
 * sin entorno ni red. Solo si devuelve true se importa (dinámicamente) el paquete de integraciones.
 *
 * Tolera lo que producen Notepad y PowerShell 5.1 (H7): BOM UTF-8, UTF-16 con BOM (LE y BE) y finales
 * CRLF. El lector completo (`core/integraciones/config.js`) decodifica igual, así que la puerta y la
 * configuración no pueden discrepar.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** @param {Buffer} b */
function decodificar(b) {
  if (b.length >= 2 && b[0] === 0xff && b[1] === 0xfe) return b.subarray(2).toString('utf16le');
  if (b.length >= 2 && b[0] === 0xfe && b[1] === 0xff) {
    const s = Buffer.from(b.subarray(2));
    s.swap16();
    return s.toString('utf16le');
  }
  const t = b.toString('utf8');
  return t.charCodeAt(0) === 0xfeff ? t.slice(1) : t;
}

/** @param {string} cwd */
export function integracionesActivas(cwd) {
  try {
    const t = decodificar(readFileSync(join(cwd, '.sdd', 'sdd.config.yaml'))).split('\r\n').join('\n').split('\r').join('\n');
    if (!/^integraciones[ \t]*:/m.test(t)) return false;
    return /^[ \t]{2}(?:github|gitlab|jira)_modo[ \t]*:[ \t]*["']?(?!apagado\b)[a-z_]+/m.test(t);
  } catch {
    return false;
  }
}
