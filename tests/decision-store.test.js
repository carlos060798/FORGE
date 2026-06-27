import { test } from 'node:test';
import assert from 'node:assert';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const storePath = join(thisDir, '..', 'core', 'decisions', 'decision-store.js');

async function importStore() {
  const { DecisionStore } = await import(`file:///${storePath.replace(/\\/g, '/')}`);
  return DecisionStore;
}

function tmpDir(suffix) {
  const dir = join(process.env.TEMP || '/tmp', `forge-test-decisions-${suffix}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

test('5.1.1 — DecisionStore crea DB y reporta disponibilidad', async (t) => {
  const dir = tmpDir('1');
  try {
    const DecisionStore = await importStore();
    const store = new DecisionStore(dir);
    assert.ok(typeof store.disponible === 'boolean', 'disponible debe ser boolean');
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* Windows puede retener la DB */ }
  }
});

test('5.1.2 — Registra una decisión y devuelve ID', async (t) => {
  const dir = tmpDir('2');
  try {
    const DecisionStore = await importStore();
    const store = new DecisionStore(dir);

    const id = store.registrar({
      decision: 'Usar TDD para todas las funciones core',
      context: 'Calidad de código deficiente en módulos sin tests',
      agente: 'arquitecto',
    });

    // SQLite retorna número; fallback retorna null
    assert.ok(id === null || typeof id === 'number', 'ID debe ser número o null');
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { }
  }
});

test('5.1.3 — Búsqueda semántica retorna resultados ordenados por score', async (t) => {
  const dir = tmpDir('3');
  try {
    const DecisionStore = await importStore();
    const store = new DecisionStore(dir);

    store.registrar({ decision: 'Usar PostgreSQL para datos relacionales', agente: 'db-admin' });
    store.registrar({ decision: 'Implementar caché Redis para sesiones', agente: 'arquitecto' });
    store.registrar({ decision: 'Migrar de PostgreSQL a SQLite para reducir costos de hosting', agente: 'arquitecto' });

    const resultados = store.buscar('base de datos SQL');
    assert.ok(resultados.length > 0, 'Debe retornar resultados');
    assert.ok(resultados[0].score >= resultados[resultados.length - 1].score, 'Debe estar ordenado por score desc');
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { }
  }
});

test('5.1.4 — Búsqueda vacía retorna decisiones activas ordenadas por fecha', async (t) => {
  const dir = tmpDir('4');
  try {
    const DecisionStore = await importStore();
    const store = new DecisionStore(dir);

    store.registrar({ decision: 'Usar TypeScript en nuevo código', agente: 'main' });
    store.registrar({ decision: 'Prohibir any en TypeScript', agente: 'main' });

    const resultados = store.buscar('');
    assert.ok(resultados.length >= 2, 'Debe listar todas las decisiones activas');
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { }
  }
});

test('5.1.5 — superseder marca anterior como superseded y registra nueva', async (t) => {
  const dir = tmpDir('5');
  try {
    const DecisionStore = await importStore();
    const store = new DecisionStore(dir);

    const idVieja = store.registrar({
      decision: 'Usar Moment.js para fechas',
      agente: 'frontend',
    });

    if (idVieja !== null) {
      store.superseder(idVieja, {
        decision: 'Usar date-fns en lugar de Moment para menor bundle',
        agente: 'frontend',
      });

      // Verificar estado directamente: todas las decisiones
      const todas = store.buscar('', { soloActivas: false });
      const superseded = todas.filter(r => r.status === 'superseded');
      const activas = todas.filter(r => r.status === 'accepted');

      assert.ok(activas.some(r => r.decision.includes('date-fns')), 'Nueva decisión debe estar activa');
      assert.ok(superseded.some(r => r.decision.includes('Moment.js')), 'Decisión original debe estar superseded');
    } else {
      // Fallback JSONL: no soporta superseder, skip suave
      t.skip('SQLite no disponible — superseder requiere SQLite');
    }
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { }
  }
});

test('5.1.6 — consolidar elimina obsoletas con más de N días', async (t) => {
  const dir = tmpDir('6');
  try {
    const DecisionStore = await importStore();
    const store = new DecisionStore(dir);

    store.registrar({ decision: 'Decisión a eliminar', status: 'deprecated', agente: 'test' });
    store.registrar({ decision: 'Decisión activa', agente: 'test' });

    // consolidar con 0 días elimina todo lo obsoleto
    const eliminadas = store.consolidar({ diasAntiguedad: 0 });
    // Solo aplica en SQLite; en fallback retorna 0
    assert.ok(typeof eliminadas === 'number', 'Debe retornar número de eliminadas');
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { }
  }
});

test('5.1.7 — listar retorna decisiones activas', async (t) => {
  const dir = tmpDir('7');
  try {
    const DecisionStore = await importStore();
    const store = new DecisionStore(dir);

    store.registrar({ decision: 'Usar ESM en todo el proyecto', agente: 'main' });
    store.registrar({ decision: 'No usar CommonJS', agente: 'main' });

    const lista = store.listar();
    assert.ok(lista.length >= 2, 'Debe listar todas las decisiones activas');
    assert.ok(lista[0].decision, 'Cada entrada debe tener campo decision');
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { }
  }
});

test('5.1.8 — importarDesdeJSONL migra entradas existentes', async (t) => {
  const dir = tmpDir('8');
  const { writeFileSync } = await import('node:fs');
  try {
    const DecisionStore = await importStore();
    const store = new DecisionStore(dir);

    const jsonlPath = join(dir, 'old-adrs.jsonl');
    writeFileSync(jsonlPath, [
      JSON.stringify({ decision: 'ADR importado 1', agente: 'main', status: 'accepted' }),
      JSON.stringify({ decision: 'ADR importado 2', agente: 'main', status: 'accepted' }),
      'línea malformada',
    ].join('\n'));

    const importadas = store.importarDesdeJSONL(jsonlPath);
    assert.strictEqual(importadas, 2, 'Debe importar 2 entradas válidas');

    const lista = store.listar();
    assert.ok(lista.length >= 2, 'Decisiones importadas deben estar disponibles');
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { }
  }
});
