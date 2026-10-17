// @ts-check
/**
 * Hallazgo H-1 de `2026-10-14-defensa-inyeccion-y-fuga/revision-independiente-1.md` (ALTA): el punto de
 * guardado y `sesion.json` viven en `.sdd/motor/**`, dentro del proyecto, con una huella sha256 que no es
 * una firma. Un repositorio hostil podía traer un estado fabricado (con su huella calculada) y, al
 * reanudar, subir el tope de gasto, saltar nodos o apuntar a rutas ajenas.
 * Ahora el estado lleva un sello HMAC con una clave del usuario (fuera del proyecto) y sin él se ignora.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { GuardadorArchivos } from '../core/ciclo/checkpoint-archivos.js';
import { estadoInicial } from '../core/ciclo/estado.js';
import { nuevaSesion, sesionActual } from '../core/ciclo/index.js';
import { sellar, selloValido, sesionSellada } from '../core/ciclo/sello.js';

const huella = (t) => createHash('sha256').update(t).digest('hex');

function proyecto() {
  const cwd = mkdtempSync(join(tmpdir(), 'forge-sello-'));
  mkdirSync(join(cwd, '.sdd', 'motor', 'r1'), { recursive: true });
  return cwd;
}

/** Estado mínimo válido del ciclo. */
function estado(cwd, extra = {}) {
  const e = estadoInicial({ id: 'T1', agente: 'desarrollador-backend', descripcion: 'x', prompt: 'x' }, {
    runId: 'r1', cwd, maxIteraciones: 3, tope_usd: 2, umbral_degradacion_usd: 1.5,
  });
  return { ...e, ...extra };
}

/** Escribe a mano un punto «fabricado por un repositorio»: huella correcta, sin sello (o con uno inventado). */
function fabricar(guardador, hilo, est, sello) {
  const dir = guardador.dirHilo(hilo);
  mkdirSync(dir, { recursive: true });
  const cuerpo = JSON.stringify(est);
  const punto = { seq: 1, ts: new Date().toISOString(), nodo: 'fin', siguiente: null, sha256: huella(cuerpo), estado: est, ...(sello === undefined ? {} : { sello }) };
  writeFileSync(join(dir, '000001.json'), JSON.stringify(punto));
}

describe('puntos de guardado', () => {
  test('uno legítimo (escrito por el propio guardador) se recupera', () => {
    const cwd = proyecto();
    const g = new GuardadorArchivos(join(cwd, '.sdd', 'motor', 'r1'));
    g.guardar('r1:T1', { nodo: 'planner', siguiente: 'qa', estado: estado(cwd) });
    const { punto, descartados } = g.ultimo('r1:T1');
    assert.ok(punto, JSON.stringify(descartados));
    assert.equal(punto.nodo, 'planner');
  });

  test('ATAQUE: un punto fabricado con huella correcta pero sin sello se ignora', () => {
    const cwd = proyecto();
    const g = new GuardadorArchivos(join(cwd, '.sdd', 'motor', 'r1'));
    fabricar(g, 'r1:T1', estado(cwd, { presupuesto: { ...estado(cwd).presupuesto, tope_usd: 1_000_000 } }));
    const { punto, descartados } = g.ultimo('r1:T1');
    assert.equal(punto, null, 'no se carga el estado fabricado');
    assert.match(descartados[0].motivo, /sin sello válido/);
  });

  test('ATAQUE: un sello inventado tampoco vale', () => {
    const cwd = proyecto();
    const g = new GuardadorArchivos(join(cwd, '.sdd', 'motor', 'r1'));
    fabricar(g, 'r1:T1', estado(cwd), 'a'.repeat(64));
    assert.equal(g.ultimo('r1:T1').punto, null);
  });

  test('ATAQUE: cambiar el estado de un punto legítimo (huella recalculada) invalida el sello', () => {
    const cwd = proyecto();
    const g = new GuardadorArchivos(join(cwd, '.sdd', 'motor', 'r1'));
    g.guardar('r1:T1', { nodo: 'planner', siguiente: 'qa', estado: estado(cwd) });
    const archivo = join(g.dirHilo('r1:T1'), '000001.json');
    const p = JSON.parse(readFileSync(archivo, 'utf8'));
    p.estado.presupuesto.tope_usd = 999999;
    p.sha256 = huella(JSON.stringify(p.estado));          // el atacante recalcula la huella
    writeFileSync(archivo, JSON.stringify(p));
    assert.equal(g.ultimo('r1:T1').punto, null);
  });

  test('ATAQUE: cambiar a qué nodo se salta (siguiente) invalida el sello', () => {
    const cwd = proyecto();
    const g = new GuardadorArchivos(join(cwd, '.sdd', 'motor', 'r1'));
    g.guardar('r1:T1', { nodo: 'planner', siguiente: 'qa', estado: estado(cwd) });
    const archivo = join(g.dirHilo('r1:T1'), '000001.json');
    const p = JSON.parse(readFileSync(archivo, 'utf8'));
    p.siguiente = null;
    writeFileSync(archivo, JSON.stringify(p));
    assert.equal(g.ultimo('r1:T1').punto, null);
  });

  test('un punto legítimo copiado a otro hilo no vale (el sello liga el hilo)', () => {
    const cwd = proyecto();
    const g = new GuardadorArchivos(join(cwd, '.sdd', 'motor', 'r1'));
    g.guardar('r1:T1', { nodo: 'planner', siguiente: 'qa', estado: estado(cwd) });
    const origen = join(g.dirHilo('r1:T1'), '000001.json');
    const destino = g.dirHilo('r1:T2');
    mkdirSync(destino, { recursive: true });
    writeFileSync(join(destino, '000001.json'), readFileSync(origen));
    assert.equal(g.ultimo('r1:T2').punto, null);
    assert.ok(g.ultimo('r1:T1').punto);
  });

  test('si el último punto es ajeno se usa el anterior legítimo', () => {
    const cwd = proyecto();
    const g = new GuardadorArchivos(join(cwd, '.sdd', 'motor', 'r1'));
    g.guardar('r1:T1', { nodo: 'planner', siguiente: 'qa', estado: estado(cwd) });
    const dir = g.dirHilo('r1:T1');
    const cuerpo = JSON.stringify(estado(cwd));
    writeFileSync(join(dir, '000002.json'), JSON.stringify({ seq: 2, ts: 'x', nodo: 'fin', siguiente: null, sha256: huella(cuerpo), estado: estado(cwd) }));
    const { punto, descartados } = g.ultimo('r1:T1');
    assert.equal(punto?.nodo, 'planner', 'vuelve al legítimo');
    assert.equal(descartados.length, 1);
  });
});

describe('sesion.json', () => {
  test('la que crea nuevaSesion se lee', () => {
    const cwd = proyecto();
    const s = nuevaSesion(cwd);
    assert.equal(sesionActual(cwd)?.runId, s.runId);
  });

  test('ATAQUE: un sesion.json traído por el repositorio (sin sello) no cuenta', () => {
    const cwd = proyecto();
    writeFileSync(join(cwd, '.sdd', 'motor', 'sesion.json'), JSON.stringify({ runId: 'r1', modo: 'ciclo', creada: '2026-01-01T00:00:00Z' }));
    assert.equal(sesionActual(cwd), null);
  });

  test('ATAQUE: con un sello inventado o cambiando el runId tampoco', () => {
    const cwd = proyecto();
    writeFileSync(join(cwd, '.sdd', 'motor', 'sesion.json'), JSON.stringify({ runId: 'r1', modo: 'ciclo', creada: 'x', sello: 'b'.repeat(64) }));
    assert.equal(sesionActual(cwd), null);
    const buena = sesionSellada({ runId: 'r1', modo: 'ciclo', creada: 'x' });
    writeFileSync(join(cwd, '.sdd', 'motor', 'sesion.json'), JSON.stringify({ ...buena, runId: 'r2' }));
    assert.equal(sesionActual(cwd), null);
  });

  test('el sello de la sesión no se devuelve a quien la lee', () => {
    const cwd = proyecto();
    nuevaSesion(cwd);
    assert.equal(/** @type {any} */ (sesionActual(cwd)).sello, undefined);
  });
});

describe('sello', () => {
  test('sellar y comprobar; cualquier cambio invalida', () => {
    const s = sellar({ a: 1, b: 'x' });
    assert.equal(selloValido({ a: 1, b: 'x' }, s), true);
    assert.equal(selloValido({ a: 2, b: 'x' }, s), false);
    assert.equal(selloValido({ a: 1, b: 'x' }, undefined), false);
    assert.equal(selloValido({ a: 1, b: 'x' }, 'no-es-hex'), false);
  });
  test('no queda ningún archivo de clave dentro del proyecto', () => {
    const cwd = proyecto();
    nuevaSesion(cwd);
    const raiz = readdirSync(cwd, { recursive: true }).map(String);
    assert.ok(!raiz.some((r) => /(^|[\\/])clave$/.test(r)), 'la clave vive en el estado del usuario, no en el proyecto');
  });
});

describe('revisión 2: secuencia, forma y tamaño del punto', () => {
  test('S-1: copiar un punto legítimo a un número de secuencia mayor no reabre una iteración antigua', () => {
    const cwd = proyecto();
    const g = new GuardadorArchivos(join(cwd, '.sdd', 'motor', 'r1'));
    g.guardar('r1:T1', { nodo: 'planner', siguiente: 'qa', estado: estado(cwd) });
    g.guardar('r1:T1', { nodo: 'qa', siguiente: 'coder', estado: estado(cwd) });
    const dir = g.dirHilo('r1:T1');
    // El atacante copia el punto 1 (sello legítimo) encima de un número mayor
    writeFileSync(join(dir, '000009.json'), readFileSync(join(dir, '000001.json')));
    const { punto, descartados } = g.ultimo('r1:T1');
    assert.equal(punto?.seq, 2, 'el último válido sigue siendo el 2');
    assert.ok(descartados.some((d) => d.archivo === '000009.json' && /secuencia/.test(d.motivo)));
  });

  test('S-2: un archivo cuyo JSON es null (o un número, o una lista) se salta sin lanzar', () => {
    const cwd = proyecto();
    const g = new GuardadorArchivos(join(cwd, '.sdd', 'motor', 'r1'));
    g.guardar('r1:T1', { nodo: 'planner', siguiente: 'qa', estado: estado(cwd) });
    const dir = g.dirHilo('r1:T1');
    for (const [n, contenido] of [['000002.json', 'null'], ['000003.json', '42'], ['000004.json', '[]']]) writeFileSync(join(dir, n), contenido);
    const r = g.ultimo('r1:T1');
    assert.equal(r.punto?.seq, 1, 'vuelve al punto válido anterior');
    assert.equal(r.descartados.length, 3);
  });

  test('S-3: un punto enorme no se lee', () => {
    const cwd = proyecto();
    const g = new GuardadorArchivos(join(cwd, '.sdd', 'motor', 'r1'));
    g.guardar('r1:T1', { nodo: 'planner', siguiente: 'qa', estado: estado(cwd) });
    const dir = g.dirHilo('r1:T1');
    writeFileSync(join(dir, '000002.json'), Buffer.alloc(17 * 1024 * 1024, 0x20));
    const r = g.ultimo('r1:T1');
    assert.equal(r.punto?.seq, 1);
    assert.ok(r.descartados.some((d) => /demasiado grande/.test(d.motivo)));
  });
});
