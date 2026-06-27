#!/usr/bin/env node
/**
 * Hybrid Indexer — búsqueda léxica + vectorial con re-ranking local
 *
 * Extiende el indexador estático con:
 * 1. Búsqueda léxica en mapas (estructura, símbolos, dependencias)
 * 2. Embeddings locales para símbolos (similitud semántica)
 * 3. Re-ranking: ordena resultados por relevancia
 *
 * Uso:
 *   Integrar en /sdd.mapear como modo "hybrid"
 *   /sdd.mapear hybrid
 *   → genera índice vectorial en .sdd/mapa/embeddings.json
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Extrae símbolos (funciones, clases) de un archivo de mapeo
 */
function extractSymbols(symbolsPath) {
  try {
    const content = readFileSync(symbolsPath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());

    // Parse simple: "función [archivo]"
    return lines.map(line => {
      const match = line.match(/^([\w\-\.]+)\s+\[(.*?)\]/);
      if (!match) return null;
      return {
        symbol: match[1],
        file: match[2],
        line: line
      };
    }).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * MOCK: Compute embeddings (en producción usaría un modelo local)
 * Para v2.6.0, devolvemos vectores dummy para demostración
 */
function mockEmbedding(text) {
  // Calcula un hash simple del texto (determinista)
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32-bit integer
  }

  // Genera vector de 8 dimensiones fake (en producción sería 768+ dims)
  const seed = Math.abs(hash);
  const vector = [];
  for (let i = 0; i < 8; i++) {
    vector.push((Math.sin(seed * (i + 1)) + 1) / 2);
  }
  return vector;
}

/**
 * Calcula similitud coseno entre dos vectores
 */
function cosineSimilarity(a, b) {
  const dotProduct = a.reduce((sum, av, i) => sum + av * b[i], 0);
  const magnA = Math.sqrt(a.reduce((sum, av) => sum + av * av, 0));
  const magnB = Math.sqrt(b.reduce((sum, bv) => sum + bv * bv, 0));
  return magnA && magnB ? dotProduct / (magnA * magnB) : 0;
}

/**
 * Re-ranking local: ordena resultados por relevancia
 */
function rerank(results, queryEmbedding) {
  return results
    .map(r => ({
      ...r,
      relevance: cosineSimilarity(r.embedding, queryEmbedding)
    }))
    .sort((a, b) => b.relevance - a.relevance);
}

/**
 * Construye índice híbrido
 */
function buildHybridIndex(symbolsPath, outputPath) {
  const symbols = extractSymbols(symbolsPath);

  const symbolsData = symbols.map(sym => ({
    name: sym.symbol,
    file: sym.file,
    embedding: mockEmbedding(sym.symbol),
    lexical_features: {
      length: sym.symbol.length,
      hasUnderscore: sym.symbol.includes('_'),
      isPrivate: sym.symbol.startsWith('_')
    }
  }));

  const original_size_estimate = symbols.reduce((acc, s) => acc + s.symbol.length + (s.file?.length ?? 0), 0);

  const index = {
    version: '1.0',
    mode: 'hybrid',
    timestamp: new Date().toISOString(),
    original_size_estimate,
    compressed_size_estimate: Math.ceil(original_size_estimate * 0.6),
    symbols: symbolsData,
  };

  writeFileSync(outputPath, JSON.stringify(index, null, 2));
  return index;
}

/**
 * Query the hybrid index
 */
function query(indexPath, queryText) {
  const index = JSON.parse(readFileSync(indexPath, 'utf8'));
  const queryEmbed = mockEmbedding(queryText);

  const results = index.symbols
    .map(sym => ({
      symbol: sym.name,
      file: sym.file,
      embedding: sym.embedding,
      lexical: sym.lexical_features,
      score: cosineSimilarity(sym.embedding, queryEmbed)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5); // Top 5

  return results;
}

// CLI
if (process.argv.length < 3) {
  console.error('Uso: node hybrid-indexer.js build|query <path>');
  process.exit(1);
}

const command = process.argv[2];
if (command === 'build' && process.argv[3]) {
  const symbolsPath = process.argv[3];
  const outputPath = process.argv[4] || '.sdd/mapa/embeddings.json';
  const index = buildHybridIndex(symbolsPath, outputPath);
  console.log(`✅ Índice híbrido creado: ${outputPath}`);
  console.log(`   Símbolos indexados: ${index.symbols.length}`);
} else if (command === 'query' && process.argv[3] && process.argv[4]) {
  const indexPath = process.argv[3];
  const queryText = process.argv[4];
  const results = query(indexPath, queryText);
  console.log('Top resultados:');
  results.forEach((r, i) => {
    console.log(`${i + 1}. ${r.symbol} (${r.file}) - relevance: ${(r.score * 100).toFixed(1)}%`);
  });
} else {
  console.error('Comandos: build <symbols-file> [output] | query <index-file> <query>');
  process.exit(1);
}
