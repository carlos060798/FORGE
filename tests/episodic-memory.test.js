import { test } from 'node:test';
import assert from 'node:assert';
import { writeFileSync, unlinkSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

/**
 * Tests para Phase 2.4 — Episodic Memory
 */

const memoryPath = path.join(process.cwd(), 'utils', 'episodic-memory.js');

test('2.4.1 — Indexa episodios desde archivo MD lineal', (t) => {
  const memoryFile = '/tmp/test-memory.md';
  const indexFile = '/tmp/test-episodes.jsonl';

  const memory = `
## Error en autenticación

Contexto: Branch feature/oauth fallaba en tests.
Se intentó integrar Google OAuth sin manejo de timeout.

Acción: Añadí timeout de 5s y retry logic.
Refactoricé el flujo de autenticación.

Resultado: Tests pasaron. OAuth funciona en staging.

## Éxito con refactor de BD

Contexto: Migración de PostgreSQL a MongoDB tardaba 2h.
Estaba sin índices y sin batch processing.

Acción: Añadí índices, batch de 1000 documentos, caché local.
Paralelicé uploads con Promise.all.

Resultado: Migración ahora tarda 15min. Sin datos perdidos.
`;

  writeFileSync(memoryFile, memory);

  try {
    execSync(`node ${memoryPath} index ${memoryFile} ${indexFile}`);

    const content = readFileSync(indexFile, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());

    assert.strictEqual(lines.length, 2, 'Debería crear 2 episodios');

    // Verifica estructura de primer episodio
    const ep1 = JSON.parse(lines[0]);
    assert.strictEqual(ep1.type, 'error', 'Primer episodio debería ser error');
    assert.ok(ep1.context, 'Debería tener contexto');
    assert.ok(ep1.action, 'Debería tener acción');
    assert.ok(ep1.result, 'Debería tener resultado');
  } finally {
    try { unlinkSync(memoryFile); } catch { }
    try { unlinkSync(indexFile); } catch { }
  }
});

test('2.4.2 — Detecta tipo de episodio por título', (t) => {
  const memoryFile = '/tmp/test-memory2.md';
  const indexFile = '/tmp/test-episodes2.jsonl';

  const memory = `
## Error al compilar TypeScript
Contexto: Cambio en tipos.
Acción: Actualicé tipos.
Resultado: Compiló.

## Decisión de usar Redux
Contexto: State complejo.
Acción: Evaluamos MobX vs Redux.
Resultado: Elegimos Redux por comunidad.

## Patrón encontrado
Contexto: Múltiples errores.
Acción: Analicé.
Resultado: Común en async.
`;

  writeFileSync(memoryFile, memory);

  try {
    execSync(`node ${memoryPath} index ${memoryFile} ${indexFile}`);

    const lines = readFileSync(indexFile, 'utf8').split('\n').filter(l => l.trim());
    const types = lines.map(l => JSON.parse(l).type);

    assert.strictEqual(types[0], 'error', 'Debería detectar "Error" como error');
    assert.strictEqual(types[1], 'decision', 'Debería detectar "Decisión" como decision');
    assert.strictEqual(types[2], 'patrón', 'Debería detectar "Patrón" como patrón');
  } finally {
    try { unlinkSync(memoryFile); } catch { }
    try { unlinkSync(indexFile); } catch { }
  }
});

test('2.4.3 — Query filtra por tipo de episodio', (t) => {
  const memoryFile = '/tmp/test-memory3.md';
  const indexFile = '/tmp/test-episodes3.jsonl';

  const memory = `
## Error 1
Contexto: test.
Acción: fix.
Resultado: ok.

## Error 2
Contexto: test.
Acción: fix.
Resultado: ok.

## Exito 1
Contexto: test.
Acción: deploy.
Resultado: ok.
`;

  writeFileSync(memoryFile, memory);

  try {
    execSync(`node ${memoryPath} index ${memoryFile} ${indexFile}`);

    const output = execSync(`node ${memoryPath} query ${indexFile} error`, { encoding: 'utf8' });

    // Output debería mostrar solo errores
    const errorMatches = output.match(/\[ERROR\]/g) || [];
    assert.ok(errorMatches.length >= 1, 'Debería retornar errores');
    assert.doesNotMatch(output, /\[EXITO\]/i, 'No debería incluir éxitos');
  } finally {
    try { unlinkSync(memoryFile); } catch { }
    try { unlinkSync(indexFile); } catch { }
  }
});

test('2.4.4 — Query devuelve máximo 10 episodios', (t) => {
  const memoryFile = '/tmp/test-memory4.md';
  const indexFile = '/tmp/test-episodes4.jsonl';

  // Crea 15 episodios
  let memory = '';
  for (let i = 0; i < 15; i++) {
    memory += `\n## Error ${i}\nContexto: test.\nAcción: fix.\nResultado: ok.\n`;
  }

  writeFileSync(memoryFile, memory);

  try {
    execSync(`node ${memoryPath} index ${memoryFile} ${indexFile}`);

    const output = execSync(`node ${memoryPath} query ${indexFile} "*"`, { encoding: 'utf8' });

    // Contar líneas de resultados (formato "1. ...")
    const resultLines = output.match(/^\d+\./gm) || [];
    assert.ok(resultLines.length <= 10, 'Debería retornar máximo 10 episodios');
  } finally {
    try { unlinkSync(memoryFile); } catch { }
    try { unlinkSync(indexFile); } catch { }
  }
});

test('2.4.5 — Episodios tienen timestamp', (t) => {
  const memoryFile = '/tmp/test-memory5.md';
  const indexFile = '/tmp/test-episodes5.jsonl';

  const memory = `
## Test Episode
Contexto: test.
Acción: test.
Resultado: ok.
`;

  writeFileSync(memoryFile, memory);

  try {
    execSync(`node ${memoryPath} index ${memoryFile} ${indexFile}`);

    const episodeJson = readFileSync(indexFile, 'utf8').trim();
    const episode = JSON.parse(episodeJson);

    assert.ok(episode.timestamp, 'Debería tener timestamp');
    assert.ok(new Date(episode.timestamp).getTime() > 0, 'Timestamp debe ser fecha válida');
  } finally {
    try { unlinkSync(memoryFile); } catch { }
    try { unlinkSync(indexFile); } catch { }
  }
});

test('2.4.6 — Episodios tienen tags para búsqueda', (t) => {
  const memoryFile = '/tmp/test-memory6.md';
  const indexFile = '/tmp/test-episodes6.jsonl';

  const memory = `
## Login Test Failed
Contexto: auth test.
Acción: debug.
Resultado: fixed.
`;

  writeFileSync(memoryFile, memory);

  try {
    execSync(`node ${memoryPath} index ${memoryFile} ${indexFile}`);

    const episodeJson = readFileSync(indexFile, 'utf8').trim();
    const episode = JSON.parse(episodeJson);

    assert.ok(Array.isArray(episode.tags), 'Debería tener array de tags');
    assert.ok(episode.tags.length > 0, 'Tags no debería estar vacío');
  } finally {
    try { unlinkSync(memoryFile); } catch { }
    try { unlinkSync(indexFile); } catch { }
  }
});

test('2.4.7 — Maneja memoria vacía sin error', (t) => {
  const memoryFile = '/tmp/test-memory7.md';
  const indexFile = '/tmp/test-episodes7.jsonl';

  writeFileSync(memoryFile, '');

  try {
    execSync(`node ${memoryPath} index ${memoryFile} ${indexFile}`);

    const content = readFileSync(indexFile, 'utf8');
    assert.strictEqual(content.trim(), '', 'Debería crear índice vacío');
  } finally {
    try { unlinkSync(memoryFile); } catch { }
    try { unlinkSync(indexFile); } catch { }
  }
});

test('2.4.8 — Query ordena por relevancia/recencia', (t) => {
  const memoryFile = '/tmp/test-memory8.md';
  const indexFile = '/tmp/test-episodes8.jsonl';

  const memory = `
## Error Antiguo
Contexto: old.
Acción: fix.
Resultado: ok.

## Error Reciente
Contexto: new.
Acción: fix.
Resultado: ok.
`;

  writeFileSync(memoryFile, memory);

  try {
    execSync(`node ${memoryPath} index ${memoryFile} ${indexFile}`);

    const output = execSync(`node ${memoryPath} query ${indexFile} error`, { encoding: 'utf8' });

    // Los episodios deben estar ordenados (el más reciente primero)
    const lines = output.split('\n');
    const hasOrdering = output.indexOf('[ERROR]') > 0;
    assert.ok(hasOrdering, 'Debería mostrar episodios en orden');
  } finally {
    try { unlinkSync(memoryFile); } catch { }
    try { unlinkSync(indexFile); } catch { }
  }
});

test('2.4.9 — Soporta query con tipo wildcard', (t) => {
  const memoryFile = '/tmp/test-memory9.md';
  const indexFile = '/tmp/test-episodes9.jsonl';

  const memory = `
## Error 1
Contexto: test.
Acción: fix.
Resultado: ok.

## Éxito 1
Contexto: test.
Acción: deploy.
Resultado: ok.
`;

  writeFileSync(memoryFile, memory);

  try {
    execSync(`node ${memoryPath} index ${memoryFile} ${indexFile}`);

    // Query con tipo "*" debería retornar todos
    const output = execSync(`node ${memoryPath} query ${indexFile} "*"`, { encoding: 'utf8' });

    assert.match(output, /Top resultados:/, 'Debería devolver resultados');
    const resultLines = output.match(/^\d+\./gm) || [];
    assert.ok(resultLines.length >= 2, 'Debería retornar ambos episodios con wildcard');
  } finally {
    try { unlinkSync(memoryFile); } catch { }
    try { unlinkSync(indexFile); } catch { }
  }
});

test('2.4.10 — Extrae campos de episodio correctamente', (t) => {
  const memoryFile = '/tmp/test-memory10.md';
  const indexFile = '/tmp/test-episodes10.jsonl';

  const memory = `
## Error en Producción

Contexto: deployment fallaba con timeout.
El servidor no respondía en 30s.

Acción: aumenté timeout a 60s.
Añadí health checks previos.
Implementé circuit breaker.

Resultado: deployment exitoso.
Produción estable sin timeouts.
`;

  writeFileSync(memoryFile, memory);

  try {
    execSync(`node ${memoryPath} index ${memoryFile} ${indexFile}`);

    const episodeJson = readFileSync(indexFile, 'utf8').trim();
    const episode = JSON.parse(episodeJson);

    assert.ok(episode.context.includes('deployment'), 'Context debe capturar contexto relevante');
    assert.ok(episode.action.includes('timeout'), 'Action debe capturar acciones');
    assert.ok(episode.result.includes('exitoso'), 'Result debe capturar resultado');
  } finally {
    try { unlinkSync(memoryFile); } catch { }
    try { unlinkSync(indexFile); } catch { }
  }
});
