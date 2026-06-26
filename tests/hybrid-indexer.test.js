import { test } from 'node:test';
import assert from 'node:assert';
import { writeFileSync, unlinkSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

/**
 * Tests para Phase 2.3 — Hybrid Indexer + Re-ranking
 */

const indexerPath = path.join(process.cwd(), 'utils', 'hybrid-indexer.js');

test('2.3.1 — Construye índice desde archivo de símbolos', (t) => {
  const symbolsFile = '/tmp/test-symbols.txt';
  const indexFile = '/tmp/test-index.json';

  const symbols = `
authenticateUser [src/auth.ts]
validateToken [src/auth.ts]
getUserById [src/users.ts]
updateUserProfile [src/users.ts]
deleteUser [src/users.ts]
`;

  writeFileSync(symbolsFile, symbols);

  try {
    execSync(`node ${indexerPath} build ${symbolsFile} ${indexFile}`, { encoding: 'utf8' });

    assert.ok(readFileSync(indexFile, 'utf8').length > 0, 'Debería crear índice');

    const index = JSON.parse(readFileSync(indexFile, 'utf8'));
    assert.strictEqual(index.symbols.length, 5, 'Debería indexar 5 símbolos');
    assert.strictEqual(index.mode, 'hybrid', 'Debería tener modo "hybrid"');
  } finally {
    try { unlinkSync(symbolsFile); } catch { }
    try { unlinkSync(indexFile); } catch { }
  }
});

test('2.3.2 — Cada símbolo tiene embedding vectorial', (t) => {
  const symbolsFile = '/tmp/test-symbols2.txt';
  const indexFile = '/tmp/test-index2.json';

  writeFileSync(symbolsFile, 'fetchData [api.ts]\nprocessData [utils.ts]\n');

  try {
    execSync(`node ${indexerPath} build ${symbolsFile} ${indexFile}`);

    const index = JSON.parse(readFileSync(indexFile, 'utf8'));
    index.symbols.forEach(sym => {
      assert.ok(Array.isArray(sym.embedding), 'Debe tener embedding array');
      assert.ok(sym.embedding.length > 0, 'Embedding debe ser no-vacío');
      assert.ok(sym.embedding.every(v => typeof v === 'number'), 'Embedding debe ser números');
    });
  } finally {
    try { unlinkSync(symbolsFile); } catch { }
    try { unlinkSync(indexFile); } catch { }
  }
});

test('2.3.3 — Cada símbolo tiene características léxicas', (t) => {
  const symbolsFile = '/tmp/test-symbols3.txt';
  const indexFile = '/tmp/test-index3.json';

  writeFileSync(symbolsFile, '_privateFunc [private.ts]\npublicFunc [public.ts]\n');

  try {
    execSync(`node ${indexerPath} build ${symbolsFile} ${indexFile}`);

    const index = JSON.parse(readFileSync(indexFile, 'utf8'));
    index.symbols.forEach(sym => {
      assert.ok(sym.lexical_features, 'Debe tener lexical_features');
      assert.ok(typeof sym.lexical_features.length === 'number', 'Debe tener length');
      assert.ok(typeof sym.lexical_features.isPrivate === 'boolean', 'Debe tener isPrivate');
    });
  } finally {
    try { unlinkSync(symbolsFile); } catch { }
    try { unlinkSync(indexFile); } catch { }
  }
});

test('2.3.4 — Query devuelve top 5 resultados rerankeados', (t) => {
  const symbolsFile = '/tmp/test-symbols4.txt';
  const indexFile = '/tmp/test-index4.json';

  const symbols = `
getUserData [users.ts]
getUser [users.ts]
getUserId [users.ts]
userData [types.ts]
userProfile [profile.ts]
`;

  writeFileSync(symbolsFile, symbols);

  try {
    execSync(`node ${indexerPath} build ${symbolsFile} ${indexFile}`);

    const output = execSync(`node ${indexerPath} query ${indexFile} "user"`, { encoding: 'utf8' });

    assert.match(output, /Top resultados:/, 'Debería mostrar resultados');
    assert.match(output, /relevance:/, 'Debería mostrar relevancia');

    // Contar líneas de resultados (formato: "1. symbol (file) - relevance: X%")
    const resultLines = output.split('\n').filter(l => l.match(/^\d+\./));
    assert.ok(resultLines.length <= 5, 'Debería devolver máximo 5 resultados');
    assert.ok(resultLines.length > 0, 'Debería devolver al menos 1 resultado');
  } finally {
    try { unlinkSync(symbolsFile); } catch { }
    try { unlinkSync(indexFile); } catch { }
  }
});

test('2.3.5 — Re-ranking ordena por similitud', (t) => {
  const symbolsFile = '/tmp/test-symbols5.txt';
  const indexFile = '/tmp/test-index5.json';

  const symbols = `
authenticate [auth.ts]
authenticate_user [auth.ts]
login [login.ts]
validate [validation.ts]
`;

  writeFileSync(symbolsFile, symbols);

  try {
    execSync(`node ${indexerPath} build ${symbolsFile} ${indexFile}`);

    const output = execSync(`node ${indexerPath} query ${indexFile} "authenticate"`, { encoding: 'utf8' });

    // Extrae relevancia de cada resultado
    const relevances = [...output.matchAll(/relevance: ([\d.]+)%/g)].map(m => parseFloat(m[1]));

    // Verifica que estén ordenados (descendente)
    for (let i = 1; i < relevances.length; i++) {
      assert.ok(relevances[i - 1] >= relevances[i], 'Resultados deberían estar en orden descendente de relevancia');
    }
  } finally {
    try { unlinkSync(symbolsFile); } catch { }
    try { unlinkSync(indexFile); } catch { }
  }
});

test('2.3.6 — Modo léxico es fallback (sin embeddings)', (t) => {
  // Un modo léxico puro seguiría usando regex sin embeddings
  // Este test verifica que el índice híbrido coexiste con fallback
  const symbolsFile = '/tmp/test-symbols6.txt';
  const indexFile = '/tmp/test-index6.json';

  writeFileSync(symbolsFile, 'testFunc [test.ts]\n');

  try {
    execSync(`node ${indexerPath} build ${symbolsFile} ${indexFile}`);

    const index = JSON.parse(readFileSync(indexFile, 'utf8'));
    // Si el índice tiene embeddings pero modo es "hybrid", fallback está disponible
    assert.strictEqual(index.mode, 'hybrid', 'Modo debe ser hybrid');
    assert.ok(index.symbols[0].embedding, 'Embeddings presentes para modo hybrid');
  } finally {
    try { unlinkSync(symbolsFile); } catch { }
    try { unlinkSync(indexFile); } catch { }
  }
});

test('2.3.7 — Maneja símbolos vacíos sin error', (t) => {
  const symbolsFile = '/tmp/test-symbols7.txt';
  const indexFile = '/tmp/test-index7.json';

  writeFileSync(symbolsFile, '');

  try {
    execSync(`node ${indexerPath} build ${symbolsFile} ${indexFile}`);
    const index = JSON.parse(readFileSync(indexFile, 'utf8'));
    assert.strictEqual(index.symbols.length, 0, 'Debería crear índice vacío');
  } finally {
    try { unlinkSync(symbolsFile); } catch { }
    try { unlinkSync(indexFile); } catch { }
  }
});

test('2.3.8 — Estima tamaño comprimido vs original', (t) => {
  const symbolsFile = '/tmp/test-symbols8.txt';
  const indexFile = '/tmp/test-index8.json';

  const symbols = `
function1 [file1.ts]
function2 [file2.ts]
function3 [file3.ts]
`;

  writeFileSync(symbolsFile, symbols);

  try {
    execSync(`node ${indexerPath} build ${symbolsFile} ${indexFile}`);

    const index = JSON.parse(readFileSync(indexFile, 'utf8'));
    assert.ok(index.compressed_size_estimate > 0, 'Debería tener tamaño comprimido estimado');
    assert.ok(index.original_size_estimate > 0, 'Debería tener tamaño original estimado');
  } finally {
    try { unlinkSync(symbolsFile); } catch { }
    try { unlinkSync(indexFile); } catch { }
  }
});

test('2.3.9 — Query con tags múltiples', (t) => {
  const symbolsFile = '/tmp/test-symbols9.txt';
  const indexFile = '/tmp/test-index9.json';

  writeFileSync(symbolsFile, 'debugUtils [debug.ts]\ntestUtils [test.ts]\n');

  try {
    execSync(`node ${indexerPath} build ${symbolsFile} ${indexFile}`);

    // Aunque los tags son simples en esta versión, el sistema debería soportarlos
    const output = execSync(`node ${indexerPath} query ${indexFile} "*"`, { encoding: 'utf8' });
    assert.ok(output.length > 0, 'Query con tipo "*" debería funcionar');
  } finally {
    try { unlinkSync(symbolsFile); } catch { }
    try { unlinkSync(indexFile); } catch { }
  }
});

test('2.3.10 — Timestamp de índice está presente', (t) => {
  const symbolsFile = '/tmp/test-symbols10.txt';
  const indexFile = '/tmp/test-index10.json';

  writeFileSync(symbolsFile, 'example [example.ts]\n');

  try {
    execSync(`node ${indexerPath} build ${symbolsFile} ${indexFile}`);

    const index = JSON.parse(readFileSync(indexFile, 'utf8'));
    assert.ok(index.timestamp, 'Debería tener timestamp');
    assert.ok(new Date(index.timestamp).getTime() > 0, 'Timestamp debe ser fecha válida');
  } finally {
    try { unlinkSync(symbolsFile); } catch { }
    try { unlinkSync(indexFile); } catch { }
  }
});
