/**
 * complexity-reader.js — Lee la complejidad estimada del IR para el model router
 *
 * Uso:
 *   node core/complexity-reader.js <spec-dir>
 *   # Imprime: alta | media | baja
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * @param {string} specDir
 * @returns {{ complejidad: 'alta'|'media'|'baja', irFresco: boolean, razon: string }}
 */
export function readComplexity(specDir) {
  const irPath   = path.join(specDir, 'ir.json');
  const specPath = path.join(specDir, 'spec.md');

  if (!fs.existsSync(irPath)) {
    return { complejidad: 'alta', irFresco: false, razon: 'ir.json no existe — usando alta (conservador)' };
  }

  if (fs.existsSync(specPath)) {
    const irMtime   = fs.statSync(irPath).mtimeMs;
    const specMtime = fs.statSync(specPath).mtimeMs;
    if (specMtime > irMtime) {
      return { complejidad: 'alta', irFresco: false, razon: 'spec.md es más nueva que ir.json — usando alta (conservador)' };
    }
  }

  try {
    const ir = JSON.parse(fs.readFileSync(irPath, 'utf8'));
    const raw = ir?.estimated_complexity ?? ir?.product?.estimated_complexity ?? '';
    const complejidad = _normalizeComplejidad(raw);
    return { complejidad, irFresco: true, razon: `ir.json fresco — complejidad: ${complejidad}` };
  } catch {
    return { complejidad: 'alta', irFresco: false, razon: 'ir.json no es JSON válido — usando alta' };
  }
}

function _normalizeComplejidad(raw) {
  const v = raw.toLowerCase().trim();
  if (v === 'low'  || v === 'baja')  return 'baja';
  if (v === 'medium' || v === 'media') return 'media';
  return 'alta';
}

// ── CLI directo ───────────────────────────────────────────────────────────────

if (process.argv[1] && path.basename(process.argv[1]).startsWith('complexity-reader')) {
  const specDir = process.argv[2] ?? process.cwd();
  const result = readComplexity(specDir);
  console.log(result.complejidad);
  if (!result.irFresco) process.stderr.write(`⚠️  ${result.razon}\n`);
}
