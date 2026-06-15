#!/usr/bin/env node
/**
 * Delta Encoding — comprime cambios a archivos grandes usando diffs
 *
 * Transforma snapshots completos en diffs incrementales. Útil para
 * `agent-memory.js` y ledgers de cambios.
 *
 * Uso:
 *   node delta-encoding.js encode <prev.json> <current.json> → genera delta
 *   node delta-encoding.js decode <prev.json> <delta.json>  → aplica delta
 *
 * Beneficio: reduce tamaño en ~95% para modificaciones pequeñas sobre
 *           archivos grandes (memoria de agente, mapa de proyecto).
 */

import { readFileSync, writeFileSync } from 'node:fs';

/**
 * Computa diferencias entre dos objetos (línea-nivel)
 */
function computeDelta(prev, current) {
  const deltaOps = [];
  let lineNum = 0;

  // Para diffs simple: comparar línea a línea si son strings
  if (typeof prev === 'string' && typeof current === 'string') {
    const prevLines = prev.split('\n');
    const currLines = current.split('\n');

    // Algoritmo de Longest Common Subsequence (LCS) simplificado
    // Para producción, usar 'diff' o 'diff-match-patch'
    for (let i = 0; i < Math.max(prevLines.length, currLines.length); i++) {
      if (prevLines[i] !== currLines[i]) {
        deltaOps.push({
          op: 'replace',
          line: i,
          old: prevLines[i],
          new: currLines[i]
        });
      }
    }

    if (currLines.length > prevLines.length) {
      for (let i = prevLines.length; i < currLines.length; i++) {
        deltaOps.push({
          op: 'add',
          line: i,
          value: currLines[i]
        });
      }
    } else if (prevLines.length > currLines.length) {
      for (let i = currLines.length; i < prevLines.length; i++) {
        deltaOps.push({
          op: 'delete',
          line: i
        });
      }
    }
  } else if (typeof prev === 'object' && typeof current === 'object') {
    // Para objetos: delta de cambios de keys
    const allKeys = new Set([...Object.keys(prev || {}), ...Object.keys(current || {})]);

    allKeys.forEach(key => {
      const prevVal = prev[key];
      const currVal = current[key];

      if (JSON.stringify(prevVal) !== JSON.stringify(currVal)) {
        deltaOps.push({
          op: 'set',
          key,
          old: prevVal,
          new: currVal
        });
      }
    });
  }

  return {
    version: '1.0',
    timestamp: new Date().toISOString(),
    base_hash: hashObject(prev),
    operations: deltaOps,
    compressed_size_estimate: JSON.stringify(deltaOps).length,
    original_size_estimate: JSON.stringify(current).length
  };
}

/**
 * Aplica un delta a un snapshot anterior
 */
function applyDelta(prev, delta) {
  if (!delta.operations || delta.operations.length === 0) {
    return prev;
  }

  let result = prev;

  if (typeof prev === 'string') {
    let lines = prev.split('\n');

    // Procesa operaciones (orden importa)
    const deleteLines = delta.operations.filter(op => op.op === 'delete').sort((a, b) => b.line - a.line);
    const others = delta.operations.filter(op => op.op !== 'delete');

    // Primero borrar (de atrás hacia adelante para evitar cambios de índice)
    deleteLines.forEach(op => {
      lines.splice(op.line, 1);
    });

    // Luego reemplazar y añadir
    others.forEach(op => {
      if (op.op === 'replace') {
        lines[op.line] = op.new;
      } else if (op.op === 'add') {
        lines.splice(op.line, 0, op.value);
      }
    });

    result = lines.join('\n');
  } else if (typeof prev === 'object') {
    result = { ...prev };

    delta.operations.forEach(op => {
      if (op.op === 'set') {
        result[op.key] = op.new;
      }
    });
  }

  return result;
}

/**
 * Hash simple para validar integridad (no criptográfico, solo detección de cambios)
 */
function hashObject(obj) {
  const str = JSON.stringify(obj);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

// CLI
if (process.argv.length < 4) {
  console.error('Uso: node delta-encoding.js encode|decode <archivo1> <archivo2>');
  process.exit(1);
}

const command = process.argv[2];
const file1 = process.argv[3];
const file2 = process.argv[4];

if (command === 'encode') {
  const prev = JSON.parse(readFileSync(file1, 'utf8'));
  const current = JSON.parse(readFileSync(file2, 'utf8'));

  const delta = computeDelta(prev, current);

  console.log(JSON.stringify(delta, null, 2));
  console.log('\n📊 Compresión:');
  console.log(`   Original: ${delta.original_size_estimate} bytes`);
  console.log(`   Delta: ${delta.compressed_size_estimate} bytes`);
  console.log(`   Ratio: ${((delta.compressed_size_estimate / delta.original_size_estimate) * 100).toFixed(1)}%`);
  console.log(`   Operaciones: ${delta.operations.length}`);
} else if (command === 'decode') {
  const prev = JSON.parse(readFileSync(file1, 'utf8'));
  const delta = JSON.parse(readFileSync(file2, 'utf8'));

  const result = applyDelta(prev, delta);

  console.log(JSON.stringify(result, null, 2));
  console.log('\n✅ Delta aplicado. Hash base: ' + delta.base_hash);
} else {
  console.error('Comandos: encode <prev> <current> | decode <prev> <delta>');
  process.exit(1);
}
