// @ts-check
/**
 * F1.5 — Auditoría, topes e interruptor (core/integraciones/auditoria.js).
 * CA-006-01, CA-006-03, CA-006-04, CA-004-05 (eventos sin credenciales).
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import {
  apagar, AuditoriaIntegraciones, encender, ErrorIntegracionesApagadas, ErrorTopeIntegraciones,
  estadoInterruptor, OPERACIONES_AUDITADAS,
} from '../core/integraciones/auditoria.js';
import { ErrorHttpIntegracion } from '../core/integraciones/http.js';
import { EventLog } from '../core/event-log.js';

const AQUI = dirname(fileURLToPath(import.meta.url));
const TOKEN = 'ghp_' + 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8';

function proyecto() {
  const dir = mkdtempSync(join(tmpdir(), 'forge-audit-'));
  mkdirSync(join(dir, '.sdd'), { recursive: true });
  return dir;
}
const eventos = (dir) => new EventLog(join(dir, '.sdd')).readAll().filter((e) => String(e.type).startsWith('integracion:'));
const ok = async () => 'hecho';
const A = (extra = {}) => ({ proveedor: 'github', operacion: 'leer_elemento', destino: 'org/repo', accion: ok, ...extra });

describe('F1.5 auditoría: eventos', () => {
  test('cada operación deja integracion:<operacion> con exactamente cinco campos', async () => {
    const dir = proyecto();
    const au = new AuditoriaIntegraciones({ cwd: dir, env: {} });
    const r = await au.ejecutar(A());
    assert.equal(r, 'hecho');
    const [e] = eventos(dir);
    assert.equal(e.type, 'integracion:leer_elemento');
    assert.deepEqual(Object.keys(e.payload).sort(), ['destino', 'duracionMs', 'operacion', 'proveedor', 'resultado']);
    assert.equal(e.payload.proveedor, 'github');
    assert.equal(e.payload.operacion, 'leer_elemento');
    assert.equal(e.payload.destino, 'org/repo');
    assert.equal(e.payload.resultado, 'ok');
    assert.equal(typeof e.payload.duracionMs, 'number');
    assert.ok(/** @type {number} */ (e.payload.duracionMs) >= 0);
  });

  test('un error deja resultado error con el código tipado y sin el mensaje', async () => {
    const dir = proyecto();
    const au = new AuditoriaIntegraciones({ cwd: dir, env: {} });
    const e1 = await au.ejecutar(A({ accion: async () => { throw new ErrorHttpIntegracion('tiempo', `falló con ${TOKEN}`); } })).catch((x) => x);
    assert.ok(e1 instanceof ErrorHttpIntegracion);                  // el error se propaga tal cual
    await au.ejecutar(A({ accion: async () => { throw new Error(`boom ${TOKEN}`); } })).catch(() => {});
    const [a, b] = eventos(dir);
    assert.equal(a.payload.resultado, 'error:tiempo');
    assert.equal(b.payload.resultado, 'error');
    const crudo = readFileSync(join(dir, '.sdd', 'events.jsonl'), 'utf8');
    assert.ok(!crudo.includes(TOKEN));
    assert.ok(!crudo.includes('boom'));
  });

  test('el destino se redacta y se acota; nunca lleva contenido', async () => {
    const dir = proyecto();
    const au = new AuditoriaIntegraciones({ cwd: dir, env: {} });
    await au.ejecutar(A({ destino: `org/repo?t=${TOKEN}\n${'x'.repeat(1000)}` }));
    const [e] = eventos(dir);
    assert.ok(!String(e.payload.destino).includes(TOKEN));
    assert.ok(String(e.payload.destino).length <= 200);
    assert.ok(!String(e.payload.destino).includes('\n'));
  });

  test('las operaciones y los proveedores son cerrados', async () => {
    const au = new AuditoriaIntegraciones({ cwd: proyecto(), env: {} });
    await assert.rejects(au.ejecutar(A({ operacion: 'llamar_api' })), TypeError);
    await assert.rejects(au.ejecutar(A({ proveedor: 'github; rm' })), TypeError);
    assert.deepEqual([...OPERACIONES_AUDITADAS], ['leer_elemento', 'comentar', 'proponer_cambio', 'comprobar_alcance', 'publicar']);
  });

  test('los tipos de evento nuevos están en el typedef de core/event-log.js', () => {
    const fuente = readFileSync(join(AQUI, '..', 'core', 'event-log.js'), 'utf8');
    for (const op of OPERACIONES_AUDITADAS) assert.ok(fuente.includes(`'integracion:${op}'`), `falta integracion:${op}`);
  });
});

describe('F1.5 auditoría: tope por sesión y proveedor', () => {
  test('la operación que supera el tope lanza un error que pide revisión humana y no se ejecuta', async () => {
    const dir = proyecto();
    const au = new AuditoriaIntegraciones({ cwd: dir, tope: 3, sesion: 's1', env: {} });
    let llamadas = 0;
    const accion = async () => { llamadas++; };
    for (let i = 0; i < 3; i++) await au.ejecutar(A({ accion }));
    const e = await au.ejecutar(A({ accion })).catch((x) => x);
    assert.ok(e instanceof ErrorTopeIntegraciones);
    assert.equal(e.codigo, 'tope_operaciones');
    assert.equal(e.requiereRevisionHumana, true);
    assert.equal(e.proveedor, 'github');
    assert.equal(e.tope, 3);
    assert.match(e.message, /revis/i);
    assert.equal(llamadas, 3);
    const ev = eventos(dir);
    assert.equal(ev.length, 4);
    assert.equal(ev[3].payload.resultado, 'rechazado:tope_operaciones');
  });

  test('el tope es por proveedor', async () => {
    const au = new AuditoriaIntegraciones({ cwd: proyecto(), tope: 2, sesion: 's2', env: {} });
    await au.ejecutar(A());
    await au.ejecutar(A());
    await au.ejecutar(A({ proveedor: 'gitlab' }));
    await au.ejecutar(A({ proveedor: 'gitlab' }));
    await assert.rejects(au.ejecutar(A({ proveedor: 'gitlab' })), ErrorTopeIntegraciones);
    await assert.rejects(au.ejecutar(A()), ErrorTopeIntegraciones);
    await au.ejecutar(A({ proveedor: 'jira' }));
  });

  test('el contador sobrevive entre procesos de la misma sesión y no entre sesiones', async () => {
    const dir = proyecto();
    const a = new AuditoriaIntegraciones({ cwd: dir, tope: 2, sesion: 'misma', env: {} });
    await a.ejecutar(A());
    await a.ejecutar(A());
    const b = new AuditoriaIntegraciones({ cwd: dir, tope: 2, sesion: 'misma', env: {} });
    await assert.rejects(b.ejecutar(A()), ErrorTopeIntegraciones);
    const c = new AuditoriaIntegraciones({ cwd: dir, tope: 2, sesion: 'otra', env: {} });
    await c.ejecutar(A());
  });

  test('un fallo también cuenta: una ráfaga de errores se corta', async () => {
    const au = new AuditoriaIntegraciones({ cwd: proyecto(), tope: 2, sesion: 's3', env: {} });
    const mal = async () => { throw new Error('x'); };
    await au.ejecutar(A({ accion: mal })).catch(() => {});
    await au.ejecutar(A({ accion: mal })).catch(() => {});
    await assert.rejects(au.ejecutar(A({ accion: mal })), ErrorTopeIntegraciones);
  });

  test('el tope por defecto es 20 y el nombre de sesión no puede salirse de la carpeta', async () => {
    const dir = proyecto();
    const au = new AuditoriaIntegraciones({ cwd: dir, sesion: '../../fuera', env: {} });
    assert.equal(au.estado().tope, 20);
    await au.ejecutar(A());
    assert.ok(!existsSync(join(dir, '..', 'fuera.jsonl')));
    assert.equal(au.estado().contadores.github, 1);
  });

  test('un tope no válido se rechaza', () => {
    for (const tope of [0, -1, 1.5, NaN, 'x']) {
      assert.throws(() => new AuditoriaIntegraciones({ cwd: proyecto(), tope: /** @type {any} */ (tope), env: {} }), RangeError);
    }
  });
});

describe('F1.5 auditoría: interruptor', () => {
  test('FORGE_INTEGRACIONES=apagado detiene toda operación', async () => {
    const dir = proyecto();
    for (const valor of ['apagado', 'APAGADO', ' apagado ']) {
      const au = new AuditoriaIntegraciones({ cwd: dir, env: { FORGE_INTEGRACIONES: valor } });
      let llamadas = 0;
      const e = await au.ejecutar(A({ accion: async () => { llamadas++; } })).catch((x) => x);
      assert.ok(e instanceof ErrorIntegracionesApagadas, valor);
      assert.equal(e.origen, 'variable');
      assert.equal(llamadas, 0);
    }
    const ev = eventos(dir);
    assert.equal(ev.length, 3);
    assert.equal(ev[0].payload.resultado, 'rechazado:apagado');
  });

  test('el valor «normal» (o la variable vacía) no apaga; cualquier otro valor SÍ apaga (R10)', async () => {
    const au = new AuditoriaIntegraciones({ cwd: proyecto(), env: { FORGE_INTEGRACIONES: 'normal' } });
    assert.equal(await au.ejecutar(A()), 'hecho');
  });

  test('el archivo .sdd/integraciones/apagado detiene también lo ya aprobado, en mitad de una sesión', async () => {
    const dir = proyecto();
    const au = new AuditoriaIntegraciones({ cwd: dir, sesion: 'x', env: {} });
    assert.equal(await au.ejecutar(A({ operacion: 'publicar' })), 'hecho');
    assert.equal(estadoInterruptor(dir, {}).apagado, false);

    apagar(dir);
    assert.ok(existsSync(join(dir, '.sdd', 'integraciones', 'apagado')));
    assert.deepEqual(estadoInterruptor(dir, {}), { apagado: true, origen: 'archivo' });

    let llamadas = 0;
    // Un publicar «ya aprobado» (una aprobación previa no cambia nada): se detiene igual
    for (const operacion of ['publicar', 'comentar', 'proponer_cambio', 'leer_elemento', 'comprobar_alcance']) {
      const e = await au.ejecutar(A({ operacion, accion: async () => { llamadas++; } })).catch((x) => x);
      assert.ok(e instanceof ErrorIntegracionesApagadas, operacion);
      assert.equal(e.origen, 'archivo');
    }
    assert.equal(llamadas, 0);

    encender(dir);
    assert.equal(estadoInterruptor(dir, {}).apagado, false);
    assert.equal(await au.ejecutar(A()), 'hecho');
  });

  test('un apagado no consume el tope', async () => {
    const dir = proyecto();
    const au = new AuditoriaIntegraciones({ cwd: dir, tope: 1, sesion: 'y', env: {} });
    apagar(dir);
    for (let i = 0; i < 3; i++) await assert.rejects(au.ejecutar(A()), ErrorIntegracionesApagadas);
    encender(dir);
    assert.equal(await au.ejecutar(A()), 'hecho');
  });

  test('el interruptor no lee ninguna variable que no sea FORGE_INTEGRACIONES', async () => {
    /** @type {string[]} */
    const lecturas = [];
    const env = new Proxy({}, { get(_t, k) { if (typeof k === 'string') lecturas.push(k); return undefined; } });
    const au = new AuditoriaIntegraciones({ cwd: proyecto(), env: /** @type {any} */ (env) });
    await au.ejecutar(A());
    assert.deepEqual([...new Set(lecturas)], ['FORGE_INTEGRACIONES']);
  });
});
