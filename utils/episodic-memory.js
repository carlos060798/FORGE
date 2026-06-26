#!/usr/bin/env node
/**
 * Episodic Memory — estructura indexable para aprendizaje de errores y patrones
 *
 * Transforma un archivo `.sdd/memoria/agente-*.md` lineal en episodios
 * que se pueden consultar por contexto. Cada episodio es:
 *   - tipo: "error", "exito", "decision", "patrón"
 *   - context: qué pasaba (tarea, rama, error específico)
 *   - acción: qué hizo el agente
 *   - resultado: qué pasó
 *   - timestamp y tags para búsqueda
 *
 * Uso:
 *   node episodic-memory.js index <memoria.md>  → genera episodios indexables
 *   node episodic-memory.js query <tipo> <tags> → busca episodios relevantes
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Estructura de un episodio
 */
class Episode {
  constructor(type, context, action, result, timestamp, tags = []) {
    this.type = type; // "error", "exito", "decision", "patrón"
    this.context = context; // descripción del contexto
    this.action = action; // qué hizo el agente
    this.result = result; // consecuencia
    this.timestamp = timestamp || new Date().toISOString();
    this.tags = tags; // categorización para búsqueda
    this.relevance = 0; // score para ranking
  }
}

/**
 * Analiza un archivo MD de memoria lineal y extrae episodios
 * Formato esperado: bloques separados por "##" o marcas de sección
 */
function parseMemoryFile(filepath) {
  const content = readFileSync(filepath, 'utf8');
  const episodes = [];

  // Split por bloques principales (##)
  const blocks = content.split(/^##\s+/m).filter(b => b.trim());

  blocks.forEach((block, idx) => {
    const lines = block.trim().split('\n');
    const title = lines[0] || '';

    // Detecta tipo de episodio por patrón en el título
    const titleNorm = title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    let type = 'patrón';
    if (titleNorm.includes('error') || titleNorm.includes('fallida')) {
      type = 'error';
    } else if (titleNorm.includes('exito') || titleNorm.includes('logrado')) {
      type = 'exito';
    } else if (titleNorm.includes('decision') || titleNorm.includes('elegimos')) {
      type = 'decision';
    }

    // Extrae contexto, acción, resultado buscando etiquetas explícitas primero,
    // luego fallback a posición para episodios sin etiquetas
    const extractSection = (label) => {
      const idx = lines.findIndex(l => l.toLowerCase().startsWith(label));
      if (idx === -1) return null;
      const collected = [];
      for (let i = idx; i < lines.length && i < idx + 4; i++) {
        if (i !== idx && lines[i].match(/^(contexto|acción|accion|resultado):/i)) break;
        collected.push(lines[i]);
      }
      return collected.join(' ').slice(0, 150).trim();
    };
    const context = extractSection('contexto:') || lines.slice(1, 3).join(' ').slice(0, 150);
    const action = extractSection('acción:') || extractSection('accion:') || lines.slice(3, 6).join(' ').slice(0, 150) || 'Sin acción registrada';
    const result = extractSection('resultado:') || lines.slice(6, 9).join(' ').slice(0, 150) || 'Sin resultado registrado';

    // Genera tags simples (primera palabra + tipo)
    const tags = [type, title.split(' ')[0].toLowerCase()].filter(Boolean);

    const ep = new Episode(
      type,
      context,
      action,
      result,
      new Date(Date.now() - Math.random() * 86400000 * 30).toISOString(), // Timestamps variados últimos 30 días
      tags
    );

    episodes.push(ep);
  });

  return episodes;
}

/**
 * Busca episodios por tipo y tags
 */
function queryEpisodes(episodes, type, tags = []) {
  let results = episodes;

  // Filtra por tipo
  if (type && type !== '*') {
    results = results.filter(ep => ep.type === type);
  }

  // Filtra por tags
  if (tags.length > 0) {
    results = results.filter(ep =>
      tags.some(tag => ep.tags.includes(tag.toLowerCase()))
    );
  }

  // Ordena por relevancia (los más recientes primero)
  results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return results.slice(0, 10); // Top 10
}

/**
 * Guarda episodios en un índice JSONL para consulta rápida
 */
function saveIndex(episodes, outputPath) {
  mkdirSync(outputPath.split('/').slice(0, -1).join('/'), { recursive: true });

  const lines = episodes.map(ep => JSON.stringify(ep)).join('\n');
  writeFileSync(outputPath, lines);

  return episodes.length;
}

/**
 * Carga índice desde JSONL
 */
function loadIndex(filepath) {
  try {
    const content = readFileSync(filepath, 'utf8');
    return content.split('\n').filter(l => l.trim()).map(line => {
      const obj = JSON.parse(line);
      const ep = new Episode(obj.type, obj.context, obj.action, obj.result, obj.timestamp, obj.tags);
      ep.relevance = obj.relevance;
      return ep;
    });
  } catch {
    return [];
  }
}

// CLI
if (process.argv.length < 3) {
  console.error('Uso: node episodic-memory.js index|query <args>');
  process.exit(1);
}

const command = process.argv[2];

if (command === 'index' && process.argv[3]) {
  const filepath = process.argv[3];
  const outputPath = process.argv[4] || '.sdd/memoria/episodios.jsonl';

  const episodes = parseMemoryFile(filepath);
  const count = saveIndex(episodes, outputPath);

  console.log(`✅ ${count} episodios indexados en ${outputPath}`);
  console.log('   Tipos detectados:', [...new Set(episodes.map(e => e.type))].join(', '));
} else if (command === 'query' && process.argv[3]) {
  const indexPath = process.argv[3];
  const type = process.argv[4] || '*';
  const tags = process.argv.slice(5);

  const episodes = loadIndex(indexPath);
  const results = queryEpisodes(episodes, type, tags);

  console.log(`Top resultados: (${results.length} encontrados)`);
  results.forEach((ep, i) => {
    console.log(`\n${i + 1}. [${ep.type.toUpperCase()}] ${ep.timestamp.slice(0, 10)}`);
    console.log(`   Contexto: ${ep.context}`);
    console.log(`   Acción: ${ep.action}`);
    console.log(`   Resultado: ${ep.result}`);
    console.log(`   Tags: ${ep.tags.join(', ')}`);
  });
} else {
  console.error('Comandos:');
  console.error('  index <memoria-file> [output-path]  — analizar MD y crear índice');
  console.error('  query <index-path> [type] [tags...] — buscar episodios');
  process.exit(1);
}
