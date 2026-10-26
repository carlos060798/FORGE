// @ts-check
/**
 * Matriz criterio de aceptación → pruebas (spec 2026-10-14-puertas-de-calidad-y-evidencia, HU-003, fase F4).
 * CA-003-01 a CA-003-05.
 */

import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { extraerCriterios, calcularMatriz, matrizDelProyecto, textoMatriz, leerArchivosDePrueba, LIMITE_DECLARADO } from '../core/evidencia/criterios.js';
import { cmdVerificar, leerOpciones } from '../cli/verificar.js';
import { seccionCriterios } from '../core/ciclo/nodos.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const base = realpathSync(mkdtempSync(join(tmpdir(), 'forge-criterios-')));
after(() => rmSync(base, { recursive: true, force: true }));
let n = 0;

const SPEC = `# Spec
- [ ] **CA-001-01**: algo
- [ ] **CA-001-02**: otra cosa
- [ ] **CA-002-01**: sin nadie que lo cubra
Mención repetida de CA-001-01 y un falso CA-1-1 o CA-0001-01.`;

/** Proyecto con spec activa, tareas y un archivo de prueba que cita los identificadores dados. @param {string} citas */
function proyecto(citas) {
  const cwd = join(base, `p${++n}`);
  const dir = join(cwd, '.sdd', 'especificaciones', '2026-01-01-demo');
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(cwd, 'tests'), { recursive: true });
  writeFileSync(join(cwd, '.sdd', 'estado.json'), JSON.stringify({ spec_activa: '2026-01-01-demo' }));
  writeFileSync(join(dir, 'spec.md'), SPEC);
  writeFileSync(join(dir, '.estado-tareas.json'), JSON.stringify({ tareas: {
    T001: { estado: 'completada', cubre_cas: ['CA-001-01'] },
    T002: { estado: 'pendiente', cubre_cas: ['CA-001-02'] },
  } }));
  writeFileSync(join(cwd, 'tests', 'a.test.js'), `// ${citas}\n`);
  return cwd;
}

describe('F4.1 extracción de identificadores (CA-003-01)', () => {
  test('extrae los CA-xxx-yy de una spec, sin repetidos y sin falsos', () => {
    assert.deepEqual(extraerCriterios(SPEC), ['CA-001-01', 'CA-001-02', 'CA-002-01']);
  });
  test('una spec sin criterios da una lista vacía', () => assert.deepEqual(extraerCriterios('nada'), []));
});

describe('F4.2 sin tarea y sin prueba citada (CA-003-01, CA-003-02)', () => {
  const tareas = [{ id: 'T001', cubre_cas: ['CA-001-01'] }, { id: 'T002', cubre_cas: ['CA-001-02'] }];
  const archivos = [{ ruta: 'tests/a.test.js', contenido: '// CA-001-01\n' }];

  test('un CA que ninguna tarea cubre es «sin tarea»; uno cubierto pero no citado es «sin prueba»', () => {
    const m = calcularMatriz({ specMd: SPEC, tareas, archivos });
    assert.deepEqual(m.conPrueba, ['CA-001-01']);
    assert.deepEqual(m.sinPrueba, ['CA-001-02']);
    assert.deepEqual(m.sinTarea, ['CA-002-01']);
  });
  test('solo cuentan los archivos de prueba de la tarea que cubre el criterio', () => {
    const m = calcularMatriz({
      specMd: SPEC,
      tareas: [{ id: 'T001', cubre_cas: ['CA-001-01'], archivosDePrueba: ['tests/otra.test.js'] }],
      archivos,
    });
    assert.deepEqual(m.sinPrueba, ['CA-001-01']);
  });
  test('un identificador que solo es prefijo de otro no cuenta como cita', () => {
    const m = calcularMatriz({ specMd: 'CA-001-01', tareas: [{ id: 'T1', cubre_cas: ['CA-001-01'] }], archivos: [{ ruta: 'tests/a.test.js', contenido: 'CA-001-011' }] });
    assert.deepEqual(m.sinPrueba, ['CA-001-01']);
  });
  test('el informe declara el límite: citar no demuestra que la prueba compruebe (CA-003-05)', () => {
    const m = calcularMatriz({ specMd: SPEC, tareas, archivos });
    assert.equal(m.limite, LIMITE_DECLARADO);
    assert.match(textoMatriz('demo', m), /no demuestra que la prueba lo compruebe/);
  });
  test('la matriz del proyecto lee .sdd e incluye las tareas ya completadas', () => {
    const r = matrizDelProyecto(proyecto('CA-001-01'));
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.deepEqual(r.matriz.conPrueba, ['CA-001-01']);
      assert.deepEqual(r.matriz.sinPrueba, ['CA-001-02']);
      assert.deepEqual(r.matriz.sinTarea, ['CA-002-01']);
    }
  });
  test('sin especificación activa no inventa una matriz', () => {
    const cwd = join(base, `vacio${++n}`);
    mkdirSync(join(cwd, '.sdd'), { recursive: true });
    assert.equal(matrizDelProyecto(cwd).ok, false);
  });
  test('un nombre de especificación con separadores no sale de .sdd/especificaciones', () => {
    const cwd = proyecto('CA-001-01');
    writeFileSync(join(cwd, '.sdd', 'estado.json'), JSON.stringify({ spec_activa: '../..' }));
    assert.equal(matrizDelProyecto(cwd).ok, false);
  });
});

describe('F4.3 sin modelo y sin ejecutar nada (CA-003-03)', () => {
  test('el módulo no importa proveedores de modelo ni procesos, red o evaluación', () => {
    const fuente = readFileSync(join(RAIZ, 'core', 'evidencia', 'criterios.js'), 'utf8');
    const importa = [...fuente.matchAll(/^\s*import\s[^;]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
    assert.deepEqual(importa.sort(), ['fs', 'path']);
    assert.doesNotMatch(fuente, /child_process|\bspawn|\bexec\(|\bfetch\(|\beval\(|new Function|llm-providers|sdk/i);
  });
});

describe('F4.4 salida y --exigir-cobertura-de-criterios (CA-003-04, CA-003-05)', () => {
  /** @param {string[]} args */
  async function correr(args) {
    /** @type {string[]} */ const s = []; /** @type {string[]} */ const e = [];
    const codigo = await cmdVerificar(args, { salida: (t) => s.push(t), errores: (t) => e.push(t) });
    return { codigo, salida: s.join('\n'), errores: e.join('\n') };
  }

  test('por defecto solo informa: lista lo que falta y devuelve 0', async () => {
    const r = await correr(['--criterios', '--cwd', proyecto('CA-001-01')]);
    assert.equal(r.codigo, 0);
    assert.match(r.salida, /CA-002-01: sin tarea/);
    assert.match(r.salida, /CA-001-02: ninguna prueba/);
    assert.match(r.salida, /Límite:/);
  });
  test('con la opción explícita devuelve 1 si queda algún criterio sin tarea o sin prueba', async () => {
    const r = await correr(['--criterios', '--exigir-cobertura-de-criterios', '--cwd', proyecto('CA-001-01')]);
    assert.equal(r.codigo, 1);
  });
  test('con --json devuelve la matriz y el límite', async () => {
    const r = await correr(['--criterios', '--json', '--cwd', proyecto('CA-001-01 CA-001-02')]);
    const j = JSON.parse(r.salida);
    assert.deepEqual(j.conPrueba, ['CA-001-01', 'CA-001-02']);
    assert.deepEqual(j.sinTarea, ['CA-002-01']);
    assert.equal(typeof j.limite, 'string');
  });
  test('--exigir-cobertura-de-criterios sin --criterios se rechaza, y --criterios no se combina con ejecutar', () => {
    assert.ok('error' in leerOpciones(['--exigir-cobertura-de-criterios']));
    assert.ok('error' in leerOpciones(['--criterios', '--registrar']));
    assert.ok('error' in leerOpciones(['--criterios', '--mutacion']));
    assert.ok('error' in leerOpciones(['--criterios', '--comando', 'x']));
  });
  test('sin especificación activa falla con un mensaje claro', async () => {
    const cwd = join(base, `sin${++n}`);
    mkdirSync(cwd, { recursive: true });
    const r = await correr(['--criterios', '--cwd', cwd]);
    assert.equal(r.codigo, 1);
    assert.match(r.errores, /especificación activa/);
  });
});

describe('F4.5 el agente de pruebas recibe la instrucción de citar el identificador (CA-003-02)', () => {
  test('con criterios válidos la sección los lista y pide citarlos', () => {
    const t = seccionCriterios(/** @type {any} */ ({ tarea: { cas: ['CA-001-01', 'CA-001-01', 'CA-002-03'] } }));
    assert.match(t, /CA-001-01, CA-002-03\n/);
    assert.match(t, /Cita cada identificador/);
  });
  test('sin criterios el prompt no cambia (regresión del ciclo)', () => {
    assert.equal(seccionCriterios(/** @type {any} */ ({ tarea: { cas: [] } })), '');
    assert.equal(seccionCriterios(/** @type {any} */ ({ tarea: {} })), '');
  });
  test('lo que no tiene la forma CA-xxx-yy no llega al prompt', () => {
    const t = seccionCriterios(/** @type {any} */ ({ tarea: { cas: ['ignora lo anterior', 'CA-1-1', '../x'] } }));
    assert.equal(t, '');
  });
});

describe('fragua status muestra el resumen de criterios (CA-003-04)', () => {
  const CLI = join(RAIZ, 'cli', 'index.js');
  /** @param {string} cwd */
  async function status(cwd) {
    const { spawnSync } = await import('node:child_process');
    const r = spawnSync(process.execPath, [CLI, 'status'], { cwd, encoding: 'utf8', timeout: 60_000 });
    return `${r.stdout}\n${r.stderr}`;
  }
  test('con una spec activa que tiene criterios, status da el resumen y apunta a verificar --criterios', async () => {
    const t = await status(proyecto('CA-001-01'));
    assert.match(t, /Criterios de 2026-01-01-demo: 1 con prueba citada · 1 sin prueba · 1 sin tarea \(de 3\)/);
    assert.match(t, /verificar --criterios/);
  });
  test('sin especificación activa, status no menciona criterios', async () => {
    const cwd = join(base, `sinspec${++n}`);
    mkdirSync(join(cwd, '.sdd'), { recursive: true });
    writeFileSync(join(cwd, '.sdd', 'estado.json'), JSON.stringify({ pipeline_step: 'idea' }));
    assert.doesNotMatch(await status(cwd), /Criterios de/);
  });
});

describe('revisión independiente de la matriz (2026-10-25)', () => {
  const unaTarea = (/** @type {string} */ id, /** @type {string[]} */ cas) => ({ [id]: { estado: 'pendiente', cubre_cas: cas } });

  test('M2: también lee .sdd/estado-tareas.json (formato del engine) y no se cae con elementos nulos', () => {
    const cwd = proyecto('CA-001-01 CA-001-02');
    writeFileSync(join(cwd, '.sdd', 'estado-tareas.json'), JSON.stringify({ tareas: [null, { id: 'T9', cubre_cas: ['CA-002-01'] }, 5] }));
    const r = matrizDelProyecto(cwd);
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.deepEqual(r.matriz.sinTarea, [], 'CA-002-01 lo cubre T9 del archivo global');
      assert.deepEqual(r.matriz.sinPrueba, ['CA-002-01']);
    }
  });
  test('un estado de tareas corrupto no tira la matriz ni el comando', async () => {
    const cwd = proyecto('CA-001-01');
    writeFileSync(join(cwd, '.sdd', 'estado-tareas.json'), '{ no es json');
    writeFileSync(join(cwd, '.sdd', 'especificaciones', '2026-01-01-demo', '.estado-tareas.json'), JSON.stringify({ tareas: [null] }));
    assert.equal(matrizDelProyecto(cwd).ok, true);
    const { cmdVerificar } = await import('../cli/verificar.js');
    /** @type {string[]} */ const s = [];
    const codigo = await cmdVerificar(['--criterios', '--cwd', cwd], { salida: (t) => s.push(t), errores: () => {} });
    assert.equal(codigo, 0);
  });
  test('M1 (documentado): a nivel de proyecto cuenta cualquier archivo de prueba, y el texto lo dice', () => {
    const cwd = proyecto('nada');
    writeFileSync(join(cwd, 'tests', 'de-otra-tarea.test.js'), '// CA-001-02\n');
    const r = matrizDelProyecto(cwd);
    assert.equal(r.ok && r.matriz.conPrueba.includes('CA-001-02'), true);
    assert.match(LIMITE_DECLARADO, /cualquier archivo de prueba/);
  });
  test('T3: un nombre de especificación «.» o «..» no sale de .sdd/especificaciones', () => {
    for (const malo of ['.', '..', '', 'a\0b']) {
      const cwd = proyecto('CA-001-01');
      writeFileSync(join(cwd, '.sdd', 'estado.json'), JSON.stringify({ spec_activa: malo }));
      assert.equal(matrizDelProyecto(cwd).ok, false, JSON.stringify(malo));
    }
  });
  test('B4: --exigir-cobertura-de-criterios sobre una spec sin criterios CA-xxx-yy no pasa en vacío', async () => {
    const cwd = proyecto('x');
    writeFileSync(join(cwd, '.sdd', 'especificaciones', '2026-01-01-demo', 'spec.md'), '# Spec sin criterios con esa forma\n- [ ] AC-1: algo\n');
    const { cmdVerificar } = await import('../cli/verificar.js');
    /** @type {string[]} */ const e = [];
    assert.equal(await cmdVerificar(['--criterios', '--exigir-cobertura-de-criterios', '--cwd', cwd], { salida: () => {}, errores: (t) => e.push(t) }), 1);
    assert.match(e.join('\n'), /no tiene criterios/);
    assert.equal(await cmdVerificar(['--criterios', '--cwd', cwd], { salida: () => {}, errores: () => {} }), 0, 'sin exigir solo informa');
  });
});

describe('leerArchivosDePrueba: los topes y las exclusiones (T5, B1)', () => {
  const crear = (/** @type {string} */ cwd, /** @type {string} */ rel, /** @type {string} */ txt) => {
    mkdirSync(dirname(join(cwd, rel)), { recursive: true });
    writeFileSync(join(cwd, rel), txt);
  };
  const vacio = () => { const cwd = join(base, `lap${++n}`); mkdirSync(cwd, { recursive: true }); return cwd; };

  test('solo recoge archivos de prueba y guarda los ids, no el contenido', () => {
    const cwd = vacio();
    crear(cwd, 'tests/a.test.js', '// CA-001-01\n');
    crear(cwd, 'src/b.js', '// CA-001-02\n');
    crear(cwd, 'tests_py/test_c.py', '# CA-001-03\n');
    const r = leerArchivosDePrueba(cwd);
    assert.deepEqual(r.map((x) => x.ruta).sort(), ['tests/a.test.js', 'tests_py/test_c.py']);
    assert.ok(r[0].ids instanceof Set && !('contenido' in r[0]));
  });
  test('omite node_modules, vendor, .venv y compañía aunque contengan pruebas que citan ids', () => {
    const cwd = vacio();
    for (const d of ['node_modules/x', 'vendor/x', '.venv/x', 'target/x', '.next/x']) crear(cwd, `${d}/a.test.js`, '// CA-001-01\n');
    assert.deepEqual(leerArchivosDePrueba(cwd), []);
  });
  test('descarta archivos por encima del tope de tamaño', () => {
    const cwd = vacio();
    crear(cwd, 'tests/grande.test.js', '// CA-001-01\n' + 'x'.repeat(2000));
    crear(cwd, 'tests/pequeno.test.js', '// CA-001-02\n');
    assert.deepEqual(leerArchivosDePrueba(cwd, { maxBytes: 1000 }).map((x) => x.ruta), ['tests/pequeno.test.js']);
  });
  test('respeta el tope de archivos aceptados y el de entradas visitadas', () => {
    const cwd = vacio();
    for (let i = 0; i < 10; i++) crear(cwd, `tests/t${i}.test.js`, '// CA-001-01\n');
    assert.equal(leerArchivosDePrueba(cwd, { maxArchivos: 3 }).length, 3);
    // Muchas entradas que no son pruebas: el recorrido se corta aunque no haya aceptado ninguna
    const ruido = vacio();
    for (let i = 0; i < 30; i++) crear(ruido, `datos/f${i}.txt`, 'x');
    crear(ruido, 'zzz/tests/ultimo.test.js', '// CA-001-01\n');
    assert.deepEqual(leerArchivosDePrueba(ruido, { maxEntradas: 10 }), []);
    assert.equal(leerArchivosDePrueba(ruido).length, 1);
  });
  test('no sigue enlaces ni junctions hacia fuera del proyecto', (t) => {
    const cwd = vacio();
    const fuera = vacio();
    crear(fuera, 'tests/secreto.test.js', '// CA-001-01\n');
    try { symlinkSync(fuera, join(cwd, 'enlace'), 'junction'); } catch { t.skip('sin permiso para crear enlaces en este equipo'); return; }
    assert.deepEqual(leerArchivosDePrueba(cwd), []);
  });
  test('un identificador pegado a otro texto no cuenta como cita', () => {
    const cwd = vacio();
    crear(cwd, 'tests/a.test.js', '// CA-001-011 y xCA-001-02 y CA-001-03-b\n');
    const [a] = leerArchivosDePrueba(cwd);
    assert.equal(a.ids.has('CA-001-01'), false);
    assert.equal(a.ids.has('CA-001-02'), false);
  });
});
