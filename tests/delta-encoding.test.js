import { test } from 'node:test';
import assert from 'node:assert';
import { writeFileSync, unlinkSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

/**
 * Tests para Phase 2.5 — Delta Encoding
 */

const deltaPath = path.join(process.cwd(), 'utils', 'delta-encoding.js');

test('2.5.1 — Codifica delta entre dos objetos JSON', (t) => {
  const prevFile = '/tmp/prev.json';
  const currFile = '/tmp/curr.json';

  const prev = { name: 'Alice', age: 30, email: 'alice@example.com' };
  const curr = { name: 'Alice', age: 31, email: 'alice@newdomain.com' };

  writeFileSync(prevFile, JSON.stringify(prev));
  writeFileSync(currFile, JSON.stringify(curr));

  try {
    const output = execSync(`node ${deltaPath} encode ${prevFile} ${currFile}`, { encoding: 'utf8' });

    // Verifica que la salida sea un delta JSON válido
    const delta = JSON.parse(output.match(/\{[\s\S]*\}/)[0]);

    assert.ok(delta.operations, 'Delta debe tener operations');
    assert.ok(delta.operations.length > 0, 'Debe haber cambios');
    assert.ok(delta.base_hash, 'Debe tener base_hash');

    // Debería haber 2 operaciones (age y email cambiaron)
    const setOps = delta.operations.filter(op => op.op === 'set');
    assert.ok(setOps.length >= 2, 'Debería haber al menos 2 operaciones');
  } finally {
    try { unlinkSync(prevFile); } catch { }
    try { unlinkSync(currFile); } catch { }
  }
});

test('2.5.2 — Comprime deltas significativamente', (t) => {
  const prevFile = '/tmp/prev2.json';
  const currFile = '/tmp/curr2.json';

  const prev = { data: 'a'.repeat(1000), id: 1, name: 'test' };
  const curr = { data: 'a'.repeat(1000), id: 1, name: 'test-updated' };

  writeFileSync(prevFile, JSON.stringify(prev));
  writeFileSync(currFile, JSON.stringify(curr));

  try {
    const output = execSync(`node ${deltaPath} encode ${prevFile} ${currFile}`, { encoding: 'utf8' });

    // Extrae información de compresión
    const compressionLine = output.split('\n').find(l => l.includes('Ratio:'));
    assert.ok(compressionLine, 'Debería mostrar ratio de compresión');

    // El delta debe ser mucho más pequeño que el archivo completo
    const prevSize = JSON.stringify(prev).length;
    const deltaSize = (output.match(/\{[\s\S]*\}/) || [''])[0].length;

    const ratio = (deltaSize / prevSize) * 100;
    assert.ok(ratio < 50, `Compresión debería ser >50%, obtuvo ${ratio.toFixed(1)}%`);
  } finally {
    try { unlinkSync(prevFile); } catch { }
    try { unlinkSync(currFile); } catch { }
  }
});

test('2.5.3 — Aplica delta correctamente al archivo anterior', (t) => {
  const prevFile = '/tmp/prev3.json';
  const deltaFile = '/tmp/delta3.json';

  const prev = { name: 'Bob', count: 5 };
  const delta = {
    base_hash: 'abc123',
    operations: [
      { op: 'set', key: 'name', old: 'Bob', new: 'Bobby' },
      { op: 'set', key: 'count', old: 5, new: 6 }
    ]
  };

  writeFileSync(prevFile, JSON.stringify(prev));
  writeFileSync(deltaFile, JSON.stringify(delta));

  try {
    const output = execSync(`node ${deltaPath} decode ${prevFile} ${deltaFile}`, { encoding: 'utf8' });

    const result = JSON.parse(output.match(/\{[\s\S]*\}/)[0]);

    assert.strictEqual(result.name, 'Bobby', 'name debe actualizarse');
    assert.strictEqual(result.count, 6, 'count debe actualizarse');
  } finally {
    try { unlinkSync(prevFile); } catch { }
    try { unlinkSync(deltaFile); } catch { }
  }
});

test('2.5.4 — Detecta cambios de campo', (t) => {
  const prevFile = '/tmp/prev4.json';
  const currFile = '/tmp/curr4.json';

  const prev = { x: 1, y: 2, z: 3 };
  const curr = { x: 1, y: 20, z: 3 };

  writeFileSync(prevFile, JSON.stringify(prev));
  writeFileSync(currFile, JSON.stringify(curr));

  try {
    const output = execSync(`node ${deltaPath} encode ${prevFile} ${currFile}`, { encoding: 'utf8' });

    const delta = JSON.parse(output.match(/\{[\s\S]*\}/)[0]);

    // Solo debe haber una operación (y cambió)
    assert.strictEqual(delta.operations.length, 1, 'Solo y debe cambiar');
    assert.strictEqual(delta.operations[0].key, 'y', 'La operación debe ser para key "y"');
  } finally {
    try { unlinkSync(prevFile); } catch { }
    try { unlinkSync(currFile); } catch { }
  }
});

test('2.5.5 — Maneja archivos sin cambios', (t) => {
  const prevFile = '/tmp/prev5.json';
  const currFile = '/tmp/curr5.json';

  const data = { unchanged: true };

  writeFileSync(prevFile, JSON.stringify(data));
  writeFileSync(currFile, JSON.stringify(data));

  try {
    const output = execSync(`node ${deltaPath} encode ${prevFile} ${currFile}`, { encoding: 'utf8' });

    const delta = JSON.parse(output.match(/\{[\s\S]*\}/)[0]);

    assert.strictEqual(delta.operations.length, 0, 'No debería haber cambios');
  } finally {
    try { unlinkSync(prevFile); } catch { }
    try { unlinkSync(currFile); } catch { }
  }
});

test('2.5.6 — Soporta múltiples tipos de cambios', (t) => {
  const prevFile = '/tmp/prev6.json';
  const currFile = '/tmp/curr6.json';

  const prev = {
    id: 1,
    name: 'Alice',
    scores: [10, 20, 30]
  };

  const curr = {
    id: 1,
    name: 'Alice Updated',
    scores: [10, 20, 35],
    newField: 'added'
  };

  writeFileSync(prevFile, JSON.stringify(prev));
  writeFileSync(currFile, JSON.stringify(curr));

  try {
    const output = execSync(`node ${deltaPath} encode ${prevFile} ${currFile}`, { encoding: 'utf8' });

    const delta = JSON.parse(output.match(/\{[\s\S]*\}/)[0]);

    // Debe detectar cambios en name, scores y nuevo newField
    const changeCount = delta.operations.length;
    assert.ok(changeCount >= 2, 'Debería detectar múltiples cambios');
  } finally {
    try { unlinkSync(prevFile); } catch { }
    try { unlinkSync(currFile); } catch { }
  }
});

test('2.5.7 — Valida base hash para integridad', (t) => {
  const prevFile = '/tmp/prev7.json';
  const currFile = '/tmp/curr7.json';

  const prev = { value: 42 };
  const curr = { value: 43 };

  writeFileSync(prevFile, JSON.stringify(prev));
  writeFileSync(currFile, JSON.stringify(curr));

  try {
    const output = execSync(`node ${deltaPath} encode ${prevFile} ${currFile}`, { encoding: 'utf8' });

    const delta = JSON.parse(output.match(/\{[\s\S]*\}/)[0]);

    assert.ok(delta.base_hash, 'Debe calcular base_hash');
    assert.ok(typeof delta.base_hash === 'string', 'base_hash debe ser string');
    assert.ok(delta.base_hash.length > 0, 'base_hash no debería estar vacío');
  } finally {
    try { unlinkSync(prevFile); } catch { }
    try { unlinkSync(currFile); } catch { }
  }
});

test('2.5.8 — Maneja objetos anidados', (t) => {
  const prevFile = '/tmp/prev8.json';
  const currFile = '/tmp/curr8.json';

  const prev = { user: { name: 'Alice', profile: { bio: 'Dev' } } };
  const curr = { user: { name: 'Alice', profile: { bio: 'Dev Updated' } } };

  writeFileSync(prevFile, JSON.stringify(prev));
  writeFileSync(currFile, JSON.stringify(curr));

  try {
    const output = execSync(`node ${deltaPath} encode ${prevFile} ${currFile}`, { encoding: 'utf8' });

    const delta = JSON.parse(output.match(/\{[\s\S]*\}/)[0]);

    // Aunque el cambio está anidado, el delta debe detectarlo
    assert.ok(delta.operations.length > 0, 'Debería detectar cambios anidados');
  } finally {
    try { unlinkSync(prevFile); } catch { }
    try { unlinkSync(currFile); } catch { }
  }
});

test('2.5.9 — Roundtrip: encode luego decode recupera el original', (t) => {
  const prevFile = '/tmp/prev9.json';
  const currFile = '/tmp/curr9.json';
  const deltaFile = '/tmp/delta9.json';

  const prev = { a: 1, b: 'test', c: [1, 2, 3] };
  const curr = { a: 2, b: 'updated', c: [1, 2, 4], d: 'new' };

  writeFileSync(prevFile, JSON.stringify(prev));
  writeFileSync(currFile, JSON.stringify(curr));

  try {
    // Encode
    const encodeOutput = execSync(`node ${deltaPath} encode ${prevFile} ${currFile}`, { encoding: 'utf8' });
    const delta = JSON.parse(encodeOutput.match(/\{[\s\S]*\}/)[0]);
    writeFileSync(deltaFile, JSON.stringify(delta));

    // Decode
    const decodeOutput = execSync(`node ${deltaPath} decode ${prevFile} ${deltaFile}`, { encoding: 'utf8' });
    const recovered = JSON.parse(decodeOutput.match(/\{[\s\S]*\}/)[0]);

    // Debe ser idéntico al curr
    assert.deepStrictEqual(recovered, curr, 'Roundtrip debería recuperar el valor exacto');
  } finally {
    try { unlinkSync(prevFile); } catch { }
    try { unlinkSync(currFile); } catch { }
    try { unlinkSync(deltaFile); } catch { }
  }
});

test('2.5.10 — CLI muestra información de compresión', (t) => {
  const prevFile = '/tmp/prev10.json';
  const currFile = '/tmp/curr10.json';

  const prev = { largeData: 'x'.repeat(500) };
  const curr = { largeData: 'x'.repeat(500), change: 'small' };

  writeFileSync(prevFile, JSON.stringify(prev));
  writeFileSync(currFile, JSON.stringify(curr));

  try {
    const output = execSync(`node ${deltaPath} encode ${prevFile} ${currFile}`, { encoding: 'utf8' });

    assert.match(output, /📊 Compresión:/, 'Debería mostrar estadísticas');
    assert.match(output, /Original:/, 'Debería mostrar tamaño original');
    assert.match(output, /Delta:/, 'Debería mostrar tamaño delta');
    assert.match(output, /Ratio:/, 'Debería mostrar ratio');
    assert.match(output, /Operaciones:/, 'Debería mostrar número de operaciones');
  } finally {
    try { unlinkSync(prevFile); } catch { }
    try { unlinkSync(currFile); } catch { }
  }
});
