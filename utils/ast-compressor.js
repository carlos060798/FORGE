#!/usr/bin/env node
/**
 * AST Compressor — reduce código a esqueleto estructural
 *
 * Convierte código completo a una representación comprimida que mantiene:
 * - Firmas de funciones/clases
 * - Estructura de argumentos
 * - Tipos (si están presentes)
 *
 * Elimina:
 * - Cuerpos de funciones
 * - Comentarios
 * - Espacios en blanco
 *
 * Uso:
 *   node ast-compressor.js <archivo.ts>
 *   → imprime esqueleto a stdout
 *
 * Beneficio: reduce tokens en ~70% para código grande (>500 líneas)
 */

import { readFileSync } from 'node:fs';
import { extname } from 'node:path';

/**
 * Comprime código JavaScript/TypeScript a esqueleto estructural
 */
function compressJS(code) {
  const lines = code.split('\n').filter(line => line.trim() !== '');
  const skeleton = [];
  let depth = 0;
  let inFunction = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip comentarios
    if (trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;

    // Detecta firmas de función/clase
    if (/^(export\s+)?(async\s+)?(function|class|interface|type|const.*=\s*\(|const.*=\s*\{)/i.test(trimmed)) {
      skeleton.push(trimmed.slice(0, 100)); // Límite 100 chars
      inFunction = true;
      continue;
    }

    // Detecta argumentos y tipos
    if (/:\s*\w+[<>\[\]]*(\s*[=,]|$)/.test(trimmed)) {
      skeleton.push(trimmed.slice(0, 80));
      continue;
    }

    // Detecta imports/exports
    if (/^(import|export)/.test(trimmed)) {
      skeleton.push(trimmed);
    }
  }

  return skeleton.join('\n');
}

/**
 * Comprime código Python a esqueleto
 */
function compressPython(code) {
  const lines = code.split('\n').filter(line => line.trim() !== '');
  const skeleton = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip comentarios
    if (trimmed.startsWith('#')) continue;

    // Detecta definiciones
    if (/^(def|class|async def|@)/.test(trimmed)) {
      skeleton.push(trimmed.slice(0, 100));
    }

    // Detecta imports
    if (/^(import|from)/.test(trimmed)) {
      skeleton.push(trimmed);
    }
  }

  return skeleton.join('\n');
}

/**
 * Comprime según extensión
 */
function compress(filepath) {
  const code = readFileSync(filepath, 'utf8');
  const ext = extname(filepath).toLowerCase();

  if (['.js', '.ts', '.tsx', '.jsx'].includes(ext)) {
    return compressJS(code);
  } else if (['.py'].includes(ext)) {
    return compressPython(code);
  } else {
    return code; // Sin compresión para tipos desconocidos
  }
}

// CLI
if (process.argv.length < 3) {
  console.error('Uso: node ast-compressor.js <archivo>');
  process.exit(1);
}

const filepath = process.argv[2];
const compressed = compress(filepath);
console.log(compressed);
