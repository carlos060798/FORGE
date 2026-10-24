// @ts-check
/**
 * Fase B2, F3.2 de `2026-10-14-puertas-de-calidad-y-evidencia` (RF-04, CA-001-04): el nodo `sandbox` con
 * puertas declaradas, y el grafo que decide después.
 *
 *  - Sin sección `puertas:`, el recorrido es el de hoy: ninguna puerta corre y el grafo va igual.
 *  - Con una puerta que falla, la tarea vuelve al implementador con la salida de la puerta (no a revisión
 *    humana); solo una herramienta ausente (127) pide revisión humana.
 *
 * El runner es falso (sin Docker): la clase que usa `clonar` (core/puertas/ejecutar.js) para cada puerta,
 * que decide su resultado por el comando. El grafo no necesita una arista nueva: la decisión de las puertas
 * vive dentro de `sandbox`, y la ruta la decide `decidirRuta`, igual que para las pruebas.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { sandbox, pedirRevision } from '../core/ciclo/nodos.js';
import { transicion, REVISION } from '../core/ciclo/grafo.js';
import { estadoInicial, aplicar } from '../core/ciclo/estado.js';
import { huella } from '../core/ciclo/protocolo-archivos.js';

const TAREA = { id: 'T1', agente: 'desarrollador-backend', prompt: 'Implementa suma(a, b)', archivos: ['src/suma.js'], cubre_cas: ['CA-001-01'] };
const TIPOS = 'tsc --noEmit';
const LINTER = 'eslint .';

/**
 * @param {{ puertas?: string[], resultados?: Record<string, Partial<{ exitCode: number|null, timedOut: boolean, infraError: boolean, stdout: string, stderr: string }>>, iteracion?: number }} [o]
 */
function entorno(o = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'forge-puertas-sandbox-'));
  mkdirSync(join(cwd, 'tests'), { recursive: true });
  const prueba = join(cwd, 'tests', 'suma.test.js');
  writeFileSync(prueba, '// prueba de suma');
  if (o.puertas) {
    mkdirSync(join(cwd, '.sdd'), { recursive: true });
    writeFileSync(join(cwd, '.sdd', 'sdd.config.yaml'), ['puertas:', ...o.puertas.map((l) => '  ' + l)].join('\n') + '\n');
  }
  /** @type {string[]} comandos que el runner ejecutó, en orden */
  const llamadas = [];
  const resultados = o.resultados ?? {};
  class RunnerFalso {
    /** @param {any} opciones */
    constructor(opciones) { this.o = opciones; }
    /** @returns {Promise<any>} */
    async test() {
      llamadas.push(this.o.testCmd);
      // Salida con pruebas ejecutadas y pasadas: sin ella, la detección de sospecha (core/ciclo/sospecha.js) rechaza el pase
      return { exitCode: 0, timedOut: false, infraError: false, stdout: '# tests 1\n# pass 1\n# fail 0\n', stderr: '', durationMs: 1, ...resultados[this.o.testCmd] };
    }
  }
  const estado = {
    ...estadoInicial(TAREA, { runId: 'r1', cwd }),
    pruebas: { comando: 'npm test', archivos: [{ ruta: 'tests/suma.test.js', sha256: huella(readFileSync(prueba)) }] },
    implementacion: { archivos: [] },
    ...(o.iteracion !== undefined ? { iteracion: o.iteracion } : {}),
  };
  const eventos = [];
  const deps = {
    runner: new RunnerFalso({ testCmd: 'npm test', runId: 'r1' }),
    log: { append: (/** @type {string} */ type, /** @type {any} */ payload, /** @type {any} */ meta) => eventos.push({ type, payload, meta }) },
  };
  return { estado, deps, llamadas, eventos };
}

/** Un nodo sandbox y la transición que sigue, sin medir mutación. */
async function ejecutarSandbox(e) {
  const parcial = await sandbox(e.estado, e.deps);
  const siguiente = aplicar(e.estado, parcial);
  return { parcial, siguiente, t: transicion('sandbox', siguiente, { mutacion: 'no' }) };
}

describe('sandbox sin sección puertas: el recorrido de hoy', () => {
  test('pruebas que pasan: ninguna puerta corre y el grafo termina en éxito', async () => {
    const e = entorno();
    const { parcial, t } = await ejecutarSandbox(e);
    assert.equal(parcial.ejecuciones[0].categoria, 'pass');
    assert.equal('puerta' in parcial.ejecuciones[0], false);
    assert.deepEqual(e.llamadas, ['npm test']);
    assert.equal(t.siguiente, null);
    assert.equal(t.parcial.resultado, 'exito');
  });

  test('pruebas que fallan: vuelve al implementador, como hoy', async () => {
    const e = entorno({ resultados: { 'npm test': { exitCode: 1, stderr: 'fallo' } } });
    const { parcial, t } = await ejecutarSandbox(e);
    assert.equal(parcial.ejecuciones[0].categoria, 'fail');
    assert.equal(t.siguiente, 'coder');
  });
});

describe('sandbox con puertas declaradas', () => {
  test('puertas que pasan: el mismo recorrido que sin puertas, y las puertas corren tras las pruebas, en orden fijo', async () => {
    const e = entorno({ puertas: [`linter: ${LINTER}`, `tipos: ${TIPOS}`] });
    const { parcial, t } = await ejecutarSandbox(e);
    assert.equal(parcial.ejecuciones[0].categoria, 'pass');
    assert.equal('puerta' in parcial.ejecuciones[0], false);
    assert.deepEqual(e.llamadas, ['npm test', TIPOS, LINTER]);
    assert.equal(t.siguiente, null);
    assert.equal(t.parcial.resultado, 'exito');
  });

  test('una puerta que falla: la tarea vuelve al implementador con la salida de la puerta, sin revisión humana', async () => {
    const e = entorno({
      puertas: [`tipos: ${TIPOS}`],
      resultados: { [TIPOS]: { exitCode: 2, stdout: 'src/suma.js(1,1): error TS2322: Type string is not assignable' } },
    });
    const { parcial, t } = await ejecutarSandbox(e);
    const ejecucion = parcial.ejecuciones[0];
    assert.equal(ejecucion.categoria, 'fail');
    assert.match(ejecucion.puerta, /tipos/);
    assert.match(ejecucion.stdoutCola, /TS2322/, 'el implementador ve la salida de la puerta, no la de las pruebas');
    assert.equal(parcial.revision, undefined, 'una puerta que falla no pide revisión');
    assert.equal(t.siguiente, 'coder');
  });

  test('una puerta que falla cuenta como iteración', async () => {
    const e = entorno({ puertas: [`tipos: ${TIPOS}`], resultados: { [TIPOS]: { exitCode: 2 } } });
    const { parcial } = await ejecutarSandbox(e);
    assert.equal(parcial.iteracion, 1);
  });

  test('sin topes restantes, una puerta que falla pide revisión por iteraciones, como cualquier fallo', async () => {
    const e = entorno({ puertas: [`tipos: ${TIPOS}`], resultados: { [TIPOS]: { exitCode: 2 } }, iteracion: 4 });
    const { t } = await ejecutarSandbox(e);
    assert.equal(t.siguiente, REVISION);
  });

  test('una herramienta ausente (127) pide revisión humana y no reintenta', async () => {
    const e = entorno({ puertas: [`linter: ${LINTER}`], resultados: { [LINTER]: { exitCode: 127 } } });
    const { parcial, t } = await ejecutarSandbox(e);
    assert.equal(parcial.revision.motivo, 'puerta');
    assert.equal(parcial.resultado, 'revision_pendiente');
    assert.equal(t.siguiente, REVISION);
    assert.match(parcial.ejecuciones[0].puerta, /linter/);
  });

  test('una puerta que se agota por tiempo no es aprobación: vuelve al implementador', async () => {
    const e = entorno({ puertas: [`tipos: ${TIPOS}`], resultados: { [TIPOS]: { exitCode: null, timedOut: true } } });
    const { parcial, t } = await ejecutarSandbox(e);
    assert.equal(parcial.ejecuciones[0].categoria, 'fail');
    assert.equal(t.siguiente, 'coder');
  });

  test('una puerta de infraestructura (125) tampoco es aprobación', async () => {
    const e = entorno({ puertas: [`tipos: ${TIPOS}`], resultados: { [TIPOS]: { exitCode: 125 } } });
    const { parcial } = await ejecutarSandbox(e);
    assert.equal(parcial.ejecuciones[0].categoria, 'fail');
  });

  test('con dos puertas, una que falla y otra en 127: revisión humana, y el motivo nombra las dos', async () => {
    const e = entorno({
      puertas: [`tipos: ${TIPOS}`, `linter: ${LINTER}`],
      resultados: { [TIPOS]: { exitCode: 2 }, [LINTER]: { exitCode: 127 } },
    });
    const { parcial } = await ejecutarSandbox(e);
    assert.equal(parcial.revision.motivo, 'puerta');
    assert.match(parcial.revision.detalle, /linter/);
  });
});
