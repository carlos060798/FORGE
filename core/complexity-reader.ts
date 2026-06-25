/**
 * complexity-reader.ts — Lee la complejidad estimada del IR para el model router
 *
 * Reemplaza el bloque `node -e "...ir.json...estimated_complexity..."` de
 * sdd.implementar.md (paso 3.8 / PASO 4).
 *
 * Compara mtime de ir.json vs spec.md: si spec es más nueva, devuelve "alta"
 * (conservador) para evitar routing incorrecto con un IR desactualizado.
 *
 * Uso desde CLI:
 *   node core/complexity-reader.js <spec-dir>
 *   # Imprime: alta | media | baja
 */

import * as fs from 'fs';
import * as path from 'path';

export type Complejidad = 'alta' | 'media' | 'baja';

export interface ComplexityResult {
  complejidad: Complejidad;
  irFresco: boolean;
  razon: string;
}

export function readComplexity(specDir: string): ComplexityResult {
  const irPath = path.join(specDir, 'ir.json');
  const specPath = path.join(specDir, 'spec.md');

  if (!fs.existsSync(irPath)) {
    return { complejidad: 'alta', irFresco: false, razon: 'ir.json no existe — usando alta (conservador)' };
  }

  // Verificar frescura: spec más nueva que IR → IR desactualizado
  if (fs.existsSync(specPath)) {
    const irMtime = fs.statSync(irPath).mtimeMs;
    const specMtime = fs.statSync(specPath).mtimeMs;
    if (specMtime > irMtime) {
      return {
        complejidad: 'alta',
        irFresco: false,
        razon: 'spec.md es más nueva que ir.json — usando alta (conservador)',
      };
    }
  }

  // Leer complejidad del IR
  try {
    const ir = JSON.parse(fs.readFileSync(irPath, 'utf8'));
    const raw: string = ir?.estimated_complexity ?? ir?.product?.estimated_complexity ?? '';
    const complejidad = normalizeComplejidad(raw);
    return {
      complejidad,
      irFresco: true,
      razon: `ir.json fresco — complejidad: ${complejidad}`,
    };
  } catch {
    return { complejidad: 'alta', irFresco: false, razon: 'ir.json no es JSON válido — usando alta' };
  }
}

function normalizeComplejidad(raw: string): Complejidad {
  const v = raw.toLowerCase().trim();
  if (v === 'low' || v === 'baja') return 'baja';
  if (v === 'medium' || v === 'media') return 'media';
  return 'alta'; // conservador por defecto
}

// ── CLI directo ───────────────────────────────────────────────────────────────

if (process.argv[1] && path.basename(process.argv[1]).startsWith('complexity-reader')) {
  const specDir = process.argv[2] ?? process.cwd();
  const result = readComplexity(specDir);
  console.log(result.complejidad);
  if (!result.irFresco) {
    process.stderr.write(`⚠️  ${result.razon}\n`);
  }
}
