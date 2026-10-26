// @ts-check
/**
 * «Lo que no debe cambiar» (spec 2026-10-14-puertas-de-calidad-y-evidencia, HU-006, fase F7).
 * CA-006-01 a CA-006-05, con un ejecutor falso: sin Docker y sin modelo.
 */

import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { validarNoCambiar, comandoConArchivos, ejecutarNoCambiar, textoDeRegresion } from '../core/ciclo/regresion.js';
import { comprobarLineaBase, sandbox } from '../core/ciclo/nodos.js';
import { estadoInicial, validarEstado } from '../core/ciclo/estado.js';
import { aplicarArchivos, huella } from '../core/ciclo/protocolo-archivos.js';
import { normalizarTareas } from '../core/tareas.js';

const base = realpathSync(mkdtempSync(join(tmpdir(), 'forge-nocambiar-')));
after(() => rmSync(base, { recursive: true, force: true }));
let n = 0;

/** Proyecto con una prueba existente (`tests/legado.test.js`) y una que no es de prueba. */
function proyecto() {
  const cwd = join(base, `p${++n}`);
  mkdirSync(join(cwd, 'tests'), { recursive: true });
  mkdirSync(join(cwd, 'src'), { recursive: true });
  writeFileSync(join(cwd, 'tests', 'legado.test.js'), "import { test } from 'node:test';\ntest('existente', () => {});\n");
  writeFileSync(join(cwd, 'tests', 'vacio.test.js'), '// sin ninguna prueba\n');
  writeFileSync(join(cwd, 'src', 'legado.js'), 'export const x = 1;\n');
  writeFileSync(join(cwd, 'tests', 'nueva.test.js'), '// escrita por el agente de pruebas\n');
  return cwd;
}

/**
 * Ejecutor falso con la forma que usa `clonar`: `o` con `runId`, `constructor` y `test(cwd)`.
 * `suerte` decide el código de salida según el comando que se le pidió.
 * @param {(comando: string) => number} suerte
 */
function ejecutorFalso(suerte) {
  const llamadas = /** @type {string[]} */ ([]);
  class Falso {
    /** @param {any} o */
    constructor(o) { this.o = o; }
    async test() {
      llamadas.push(this.o.testCmd);
      const exitCode = suerte(this.o.testCmd);
      return { ok: exitCode === 0, exitCode, stdout: exitCode === 0 ? 'ok' : 'not ok 1 - legado', stderr: '', timedOut: false, infraError: false, oomKilled: false, durationMs: 5 };
    }
  }
  const runner = new Falso({ runId: 'r1', testCmd: 'node --test', timeoutMs: 1000 });
  return { runner, llamadas };
}

const deps = (/** @type {any} */ runner, testCmd = 'node --test') => ({ runner, testCmd, log: { append() {} } });
/** @param {string} cwd @param {any} tarea */
const estadoDe = (cwd, tarea) => {
  const e = estadoInicial({ id: 'T1', agente: 'desarrollador-backend', prompt: 'x', ...tarea }, { runId: 'r1', cwd });
  // La prueba que escribió el agente de pruebas, con su huella: sin ella el nodo no daría por encontradas pruebas
  e.pruebas = { archivos: [{ ruta: 'tests/nueva.test.js', sha256: huella(readFileSync(join(cwd, 'tests', 'nueva.test.js'))) }], comando: 'node --test' };
  return e;
};

describe('F7.1 campo opcional de la tarea y su validación (CA-006-01, CA-006-05)', () => {
  test('la tarea conserva no_cambiar y el estado resultante es válido', () => {
    const t = normalizarTareas({ tareas: { T001: { estado: 'pendiente', agente: 'a', no_cambiar: ['tests/legado.test.js'] } } }, '## T001 — x');
    assert.deepEqual(t[0].no_cambiar, ['tests/legado.test.js']);
    const e = estadoInicial(t[0], { runId: 'r', cwd: '/x' });
    assert.deepEqual(e.tarea.no_cambiar, ['tests/legado.test.js']);
    assert.deepEqual(validarEstado(e), []);
  });
  test('sin el campo, nada cambia', () => {
    const e = estadoDe(proyecto(), {});
    assert.equal('no_cambiar' in e.tarea, false);
    assert.deepEqual(validarEstado(e), []);
  });
  test('una declaración válida da las rutas en posix', () => {
    const r = validarNoCambiar(proyecto(), ['tests/legado.test.js', 'tests/legado.test.js']);
    assert.deepEqual(r, { ok: true, rutas: ['tests/legado.test.js'] });
  });
  test('vacía, inexistente, que no es de prueba, absoluta, con «..», con caracteres de shell o enlace: se rechaza con mensaje', () => {
    const cwd = proyecto();
    const rechazadas = [[], 'tests/legado.test.js', ['tests/no-existe.test.js'], ['src/legado.js'], ['/etc/passwd'], ['../x.test.js'],
      ['tests/a.test.js; rm -rf'], ['tests/$(x).test.js'], [''], [5], Array.from({ length: 21 }, (_, i) => `tests/${i}.test.js`)];
    for (const d of rechazadas) {
      const r = validarNoCambiar(cwd, d);
      assert.equal(r.ok, false, JSON.stringify(d));
      assert.match(/** @type {any} */ (r).error, /no_cambiar/);
    }
    try {
      symlinkSync(join(cwd, 'tests', 'legado.test.js'), join(cwd, 'tests', 'enlace.test.js'));
      assert.equal(validarNoCambiar(cwd, ['tests/enlace.test.js']).ok, false);
    } catch { /* sin permiso para enlaces simbólicos en este equipo */ }
  });
  test('el comando lleva las rutas tras «--» con npm y a secas con node', () => {
    assert.equal(comandoConArchivos('npm test', ['tests/a.test.js']), 'npm test -- tests/a.test.js');
    assert.equal(comandoConArchivos('node --test', ['tests/a.test.js', 'tests/b.test.js']), 'node --test tests/a.test.js tests/b.test.js');
    assert.throws(() => comandoConArchivos('npm test && x', ['tests/a.test.js']), /operador de shell/);
  });
});

describe('F7.2 línea base verde antes de implementar (CA-006-02, CA-006-05)', () => {
  test('en verde: sigue y lo anota; no se vuelve a ejecutar si ya está anotado', async () => {
    const cwd = proyecto();
    const { runner, llamadas } = ejecutorFalso(() => 0);
    const e = estadoDe(cwd, { no_cambiar: ['tests/legado.test.js'] });
    assert.deepEqual(await comprobarLineaBase(e, deps(runner)), { revision: false, verde: true });
    assert.deepEqual(llamadas, ['node --test tests/legado.test.js']);
    const ya = { ...e, regresion: { base: /** @type {const} */ ('verde') } };
    assert.deepEqual(await comprobarLineaBase(ya, deps(runner)), { revision: false, verde: false });
    assert.equal(llamadas.length, 1);
  });
  test('si ya fallan: revisión humana con la salida, sin implementar', async () => {
    const cwd = proyecto();
    const { runner } = ejecutorFalso(() => 1);
    const r = await comprobarLineaBase(estadoDe(cwd, { no_cambiar: ['tests/legado.test.js'] }), deps(runner));
    assert.ok('parcial' in r);
    const p = /** @type {any} */ (r).parcial;
    assert.equal(p.revision.motivo, 'regresion');
    assert.equal(p.revision.reanudarEn, 'coder');
    assert.match(p.revision.detalle, /línea base verde/);
    assert.match(p.revision.detalle, /tests\/legado\.test\.js/);
    assert.equal(p.resultado, 'revision_pendiente');
  });
  test('una declaración vacía o con rutas inexistentes pide revisión, no sigue en silencio', async () => {
    const { runner, llamadas } = ejecutorFalso(() => 0);
    for (const d of [[], ['tests/no-existe.test.js']]) {
      const r = await comprobarLineaBase(estadoDe(proyecto(), { no_cambiar: d }), deps(runner));
      assert.equal(/** @type {any} */ (r).parcial.revision.motivo, 'regresion');
    }
    assert.equal(llamadas.length, 0, 'no se ejecutó nada con una declaración inválida');
  });
  test('sin no_cambiar no ejecuta nada', async () => {
    const { runner, llamadas } = ejecutorFalso(() => 0);
    assert.deepEqual(await comprobarLineaBase(estadoDe(proyecto(), {}), deps(runner)), { revision: false, verde: false });
    assert.equal(llamadas.length, 0);
  });
  test('un fallo del entorno no es una línea base verde', async () => {
    const cwd = proyecto();
    class Roto { constructor(/** @type {any} */ o) { this.o = o; } async test() { throw new Error('docker caído'); } }
    const r = await ejecutarNoCambiar({ runner: new Roto({ runId: 'r', testCmd: 'node --test' }), cwd, testCmd: 'node --test', rutas: ['tests/legado.test.js'], fase: 'base' });
    assert.equal(r.categoria, 'infra_error');
  });
});

describe('F7.3 regresión tras el cambio (CA-006-03)', () => {
  /** Estado listo para el nodo sandbox: sin pruebas propias que comprobar. */
  const listo = (/** @type {string} */ cwd, /** @type {any} */ extra = {}) => ({ ...estadoDe(cwd, { no_cambiar: ['tests/legado.test.js'], ...extra }), regresion: { base: /** @type {const} */ ('verde') } });

  test('las pruebas de la tarea pasan y lo declarado también: la ejecución es pass', async () => {
    const { runner, llamadas } = ejecutorFalso(() => 0);
    const p = await sandbox(listo(proyecto()), deps(runner));
    assert.equal(p.ejecuciones[0].categoria, 'pass');
    assert.equal(llamadas.filter((c) => /legado/.test(c)).length, 1);
  });
  test('las pruebas de la tarea pasan, pero lo declarado se rompe: fail con motivo regresión y la lista', async () => {
    const { runner } = ejecutorFalso((c) => (/legado/.test(c) ? 1 : 0));
    const p = await sandbox(listo(proyecto()), deps(runner));
    const ej = p.ejecuciones[0];
    assert.equal(ej.categoria, 'fail');
    assert.match(ej.puerta, /Regresión/);
    assert.match(ej.puerta, /tests\/legado\.test\.js/);
    assert.match(ej.stdoutCola, /regresion/);
    assert.equal(p.revision, undefined, 'vuelve al implementador, no pide revisión');
  });
  test('si las pruebas de la tarea fallan, la regresión no se ejecuta', async () => {
    const { runner, llamadas } = ejecutorFalso((c) => (/legado/.test(c) ? 0 : 1));
    const p = await sandbox(listo(proyecto()), deps(runner));
    assert.equal(p.ejecuciones[0].categoria, 'fail');
    assert.equal(llamadas.filter((c) => /legado/.test(c)).length, 0);
  });
  test('un archivo declarado que desaparece tras implementar tampoco es éxito', async () => {
    const cwd = proyecto();
    const { runner } = ejecutorFalso(() => 0);
    rmSync(join(cwd, 'tests', 'legado.test.js'));
    const p = await sandbox(listo(cwd), deps(runner));
    assert.equal(p.ejecuciones[0].categoria, 'fail');
    assert.match(p.ejecuciones[0].puerta, /Regresión/);
  });
  test('sin no_cambiar el nodo se comporta como antes', async () => {
    const { runner, llamadas } = ejecutorFalso(() => 0);
    const p = await sandbox(estadoDe(proyecto(), {}), deps(runner));
    assert.equal(p.ejecuciones[0].categoria, 'pass');
    assert.equal(llamadas.length, 1);
  });
  test('el texto de la regresión nombra la fase y los archivos', () => {
    const t = textoDeRegresion({ categoria: 'fail', exitCode: 1, salida: 'x', rutas: ['a.test.js'] }, 'regresion');
    assert.match(t, /Regresión/);
    assert.match(t, /a\.test\.js/);
  });
});

describe('F7.4 el implementador no puede modificar lo declarado (CA-006-04)', () => {
  test('aplicarArchivos con las rutas declaradas entre las inmutables rechaza escribirlas', () => {
    const cwd = proyecto();
    const r = aplicarArchivos(cwd, [{ ruta: 'tests/legado.test.js', contenido: '// roto\n' }, { ruta: 'src/nuevo.js', contenido: 'export const y = 2;\n' }], {
      rol: 'coder', pruebas: ['tests/legado.test.js'], politicaDestinos: [],
    });
    assert.deepEqual(r.rechazados.map((x) => [x.ruta, x.motivo]), [['tests/legado.test.js', 'prueba_inmutable']]);
    assert.deepEqual(r.escritos.map((x) => x.ruta), ['src/nuevo.js']);
  });
});

describe('revisión independiente de no_cambiar (2026-10-25)', () => {
  test('M1: el agente de pruebas tampoco puede reescribir lo declarado', () => {
    const cwd = proyecto();
    const r = aplicarArchivos(cwd, [{ ruta: 'tests/legado.test.js', contenido: "test('ok', () => {});\n" }, { ruta: 'tests/otra.test.js', contenido: "test('otra', () => {});\n" }], {
      rol: 'qa', pruebas: ['tests/legado.test.js'], politicaDestinos: [],
    });
    assert.deepEqual(r.rechazados.map((x) => [x.ruta, x.motivo]), [['tests/legado.test.js', 'prueba_inmutable']]);
    assert.deepEqual(r.escritos.map((x) => x.ruta), ['tests/otra.test.js']);
    // Sin declarar nada, el agente de pruebas escribe donde quiera, como siempre
    const libre = aplicarArchivos(cwd, [{ ruta: 'tests/legado.test.js', contenido: "test('ok', () => {});\n" }], { rol: 'qa', pruebas: [], politicaDestinos: [] });
    assert.equal(libre.escritos.length, 1);
  });
  test('M2: un archivo sin ninguna prueba reconocible no vale como línea base', () => {
    const r = validarNoCambiar(proyecto(), ['tests/vacio.test.js']);
    assert.equal(r.ok, false);
    assert.match(/** @type {any} */ (r).error, /ninguna prueba reconocible/);
  });
  test('M2: una bandera que hace salir con 0 sin ejecutar nada se rechaza', async () => {
    for (const cmd of ['npx jest --passWithNoTests', 'pytest --pass-with-no-tests', 'npx mocha --allow-empty']) {
      assert.throws(() => comandoConArchivos(cmd, ['tests/a.test.js']), /no vale para no_cambiar/);
    }
    const { runner } = ejecutorFalso(() => 0);
    const r = await ejecutarNoCambiar({ runner, cwd: proyecto(), testCmd: 'npx jest --passWithNoTests', rutas: ['tests/legado.test.js'], fase: 'base' });
    assert.notEqual(r.categoria, 'pass');
  });
  test('B3: un argumento vacío en el comando de pruebas se rechaza en vez de comerse la ruta', () => {
    assert.throws(() => comandoConArchivos("pytest -k ''", ['tests/a.test.py']), /argumento vacío/);
  });
  test('B4: herramienta ausente (127) es no_ejecutable y pide revisión, no gasta iteraciones del implementador', async () => {
    const { runner } = ejecutorFalso(() => 127);
    const r = await ejecutarNoCambiar({ runner, cwd: proyecto(), testCmd: 'node --test', rutas: ['tests/legado.test.js'], fase: 'regresion' });
    assert.equal(r.categoria, 'no_ejecutable');
    const { decidirTrasPuertas } = await import('../core/puertas/ciclo.js');
    assert.equal(decidirTrasPuertas({ resultados: [r] }).revision, true);
  });
  test('B1: una ruta que pasa por un enlace dentro del proyecto se rechaza', () => {
    const cwd = proyecto();
    mkdirSync(join(cwd, 'real'), { recursive: true });
    writeFileSync(join(cwd, 'real', 'x.test.js'), "test('x', () => {});\n");
    try { symlinkSync(join(cwd, 'real'), join(cwd, 'tests', 'lnk'), 'junction'); } catch { return; /* sin permiso para enlaces */ }
    const r = validarNoCambiar(cwd, ['tests/lnk/x.test.js']);
    assert.equal(r.ok, false);
    assert.match(/** @type {any} */ (r).error, /enlace/);
  });
});
