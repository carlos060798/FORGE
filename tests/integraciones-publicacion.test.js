// @ts-check
/**
 * F3.2 — `prepararPublicacion`: qué se publica sale del ESTADO del ciclo, nunca de archivos releídos
 * y recalculados (CA-003-02), con los archivos de CI, dependencias y configuración excluidos y
 * listados aparte (CA-003-03) y un texto fijo, redactado y acotado (CA-002-02, CA-002-03).
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { prepararPublicacion, leerEstadoDeTarea, motivoDeExclusion } from '../core/integraciones/publicacion.js';
import { proyectoConTarea, sha256 } from './fixtures/integraciones/estado-ciclo.mjs';

const REF = 'org/repo#7';
const base = (/** @type {any} */ p, /** @type {any} */ o = {}) => ({ cwd: p.cwd, tareaId: p.taskId, proveedor: 'github', referencia: REF, tipo: 'comentario', ...o });
const falla = (/** @type {() => any} */ f) => { try { f(); } catch (e) { return /** @type {any} */ (e); } return assert.fail('debía fallar'); };

describe('F3.2 — el estado del ciclo es la fuente', () => {
  test('encuentra el estado final de la tarea en la sesión del ciclo', () => {
    const p = proyectoConTarea();
    const r = leerEstadoDeTarea(p.cwd, 'T1');
    assert.equal(r.runId, p.runId);
    assert.equal(r.estado.taskId, 'T1');
    assert.equal(r.estado.resultado, 'exito');
  });

  test('sin sesion.json busca la tarea en las sesiones del proyecto', () => {
    const p = proyectoConTarea({ sesion: false });
    assert.equal(leerEstadoDeTarea(p.cwd, 'T1').runId, p.runId);
  });

  test('tarea inexistente, identificador con forma de ruta, o estado de otro proyecto: error claro', () => {
    const p = proyectoConTarea();
    assert.equal(falla(() => leerEstadoDeTarea(p.cwd, 'T9')).codigo, 'tarea_no_encontrada');
    for (const mala of ['../T1', 'T1/../../x', '', 'a b', 'T1\n']) {
      assert.equal(falla(() => leerEstadoDeTarea(p.cwd, mala)).codigo, 'tarea_no_valida', JSON.stringify(mala));
    }
    const q = proyectoConTarea({ estado: { cwd: join(p.cwd, '..', 'otro-proyecto') } });
    assert.equal(falla(() => leerEstadoDeTarea(q.cwd, 'T1')).codigo, 'estado_de_otro_proyecto');
  });

  test('solo se publica una tarea con resultado exito o aceptada_por_humano', () => {
    for (const resultado of /** @type {const} */ (['revision_pendiente', 'abortada', 'en_curso'])) {
      const p = proyectoConTarea({ resultado });
      assert.equal(falla(() => prepararPublicacion(base(p))).codigo, 'tarea_no_publicable', resultado);
      assert.equal(falla(() => prepararPublicacion(base(p, { tipo: 'propuesta' }))).codigo, 'tarea_no_publicable', resultado);
    }
    for (const resultado of /** @type {const} */ (['exito', 'aceptada_por_humano'])) {
      const p = proyectoConTarea({ resultado });
      assert.equal(prepararPublicacion(base(p)).contenido.tipo, 'comentario', resultado);
    }
  });
});

describe('F3.2 — el comentario', () => {
  test('plantilla fija con los datos del estado y el marcador de idempotencia', () => {
    const p = proyectoConTarea({ estado: { mutacion: { probadas: 9, detectadas: 8, puntuacion: 8 / 9, parcial: false, sobrevivientes: [], refuerzos: 0 } } });
    const r = prepararPublicacion(base(p));
    assert.equal(r.operacion, 'comentar');
    assert.equal(r.destino, 'org/repo');
    assert.equal(r.referencia, REF);
    const t = r.contenido.texto;
    assert.match(t, /tarea «T1»/);
    assert.match(t, /pruebas en verde/);
    assert.match(t, /2 de 5/);
    assert.match(t, /0\.0123 USD/);
    assert.match(t, /4 llamadas/);
    assert.match(t, /8 de 9 alteraciones detectadas \(89 %\)/);
    assert.match(t, /src\/calc\.js/);
    assert.match(t, new RegExp(`${sha256('export const suma = (a, b) => a + b;\n').slice(0, 12)}`));
    assert.match(t, /Generado por FORGE/);
    assert.match(r.contenido.marcador, /^tarea-T1-[0-9a-f]{10}$/);
    assert.ok(t.includes(r.contenido.marcador), 'el identificador figura en el texto');
  });

  test('nunca incluye salida de pruebas, rutas absolutas ni la ruta del proyecto', () => {
    const p = proyectoConTarea();
    const t = prepararPublicacion(base(p)).contenido.texto;
    assert.doesNotMatch(t, /SALIDA-DE-PRUEBAS-NO-DEBE-SALIR/);
    assert.ok(!t.includes(p.cwd) && !t.includes(p.cwd.replaceAll('\\', '/')), 'sin la ruta del proyecto');
    assert.doesNotMatch(t, /[A-Za-z]:[\\/]|\/(?:home|Users|tmp|var)\//);
  });

  test('la ruta de un archivo con aspecto de ruta absoluta no entra en el texto', () => {
    const p = proyectoConTarea({ estado: { implementacion: { archivos: [{ ruta: 'C:\\Users\\yo\\x.js', sha256: 'a'.repeat(64) }, { ruta: '/etc/passwd', sha256: 'b'.repeat(64) }, { ruta: 'src/ok.js', sha256: 'c'.repeat(64) }] } } });
    const t = prepararPublicacion(base(p)).contenido.texto;
    assert.doesNotMatch(t, /Users|passwd/);
    assert.match(t, /src\/ok\.js/);
  });

  test('un secreto con formato conocido en cualquier dato del estado sale redactado', () => {
    const secreto = 'ghp_' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8';
    const p = proyectoConTarea({ archivos: { [`src/${secreto}.js`]: 'x\n' } });
    const t = prepararPublicacion(base(p)).contenido.texto;
    assert.ok(!t.includes(secreto));
  });

  test('es determinista y el marcador cambia si cambia el resultado publicado', () => {
    const p = proyectoConTarea();
    const a = prepararPublicacion(base(p));
    const b = prepararPublicacion(base(p));
    assert.deepEqual(a.contenido, b.contenido);
    const q = proyectoConTarea({ archivos: { 'src/calc.js': 'export const suma = (a, b) => b + a;\n' } });
    assert.notEqual(prepararPublicacion(base(q)).contenido.marcador, a.contenido.marcador);
    assert.notEqual(prepararPublicacion(base(p, { referencia: 'org/repo#8' })).contenido.marcador, a.contenido.marcador);
  });

  test('no relee el disco: el texto es el mismo aunque el archivo haya cambiado después', () => {
    const p = proyectoConTarea();
    const antes = prepararPublicacion(base(p)).contenido;
    writeFileSync(join(p.cwd, 'src', 'calc.js'), 'export const suma = () => 0;\n');
    assert.deepEqual(prepararPublicacion(base(p)).contenido, antes);
  });

  test('con muchos archivos el texto queda acotado y lo dice', () => {
    const archivos = Object.fromEntries(Array.from({ length: 120 }, (_, i) => [`src/m${i}.js`, `export const n${i} = ${i};\n`]));
    const t = prepararPublicacion(base(proyectoConTarea({ archivos }))).contenido.texto;
    assert.ok(Buffer.byteLength(t, 'utf8') <= 6000, `${Buffer.byteLength(t, 'utf8')} bytes`);
    assert.match(t, /y \d+ más/);
  });

  test('tarea aceptada por una persona: lo dice y no la presenta como pruebas en verde', () => {
    const t = prepararPublicacion(base(proyectoConTarea({ resultado: 'aceptada_por_humano' }))).contenido.texto;
    assert.match(t, /aceptad[ao] por una persona/);
    assert.doesNotMatch(t, /pruebas en verde/);
  });
});

describe('F3.2 — referencia y destino', () => {
  test('el destino se deduce de la referencia y, si se da, tiene que coincidir', () => {
    const p = proyectoConTarea();
    assert.equal(prepararPublicacion(base(p, { destino: 'org/repo' })).destino, 'org/repo');
    assert.equal(falla(() => prepararPublicacion(base(p, { destino: 'org/otro' }))).codigo, 'destino_no_coincide');
    assert.equal(prepararPublicacion(base(p, { proveedor: 'jira', referencia: 'ABC-7' })).destino, 'ABC');
    assert.equal(prepararPublicacion(base(p, { proveedor: 'gitlab', referencia: 'grupo/sub/proy#3' })).destino, 'grupo/sub/proy');
  });

  test('referencias, proveedores y tipos con forma de ataque se rechazan', () => {
    const p = proyectoConTarea();
    for (const referencia of ['', '../x#1', 'org/repo', 'org/repo#0', 'org/repo#1\nmás', 'ABC-1']) {
      assert.equal(falla(() => prepararPublicacion(base(p, { referencia }))).codigo, 'referencia_no_valida', JSON.stringify(referencia));
    }
    assert.equal(falla(() => prepararPublicacion(base(p, { proveedor: 'bitbucket' }))).codigo, 'proveedor_no_valido');
    assert.equal(falla(() => prepararPublicacion(base(p, { tipo: 'fusionar' }))).codigo, 'tipo_no_valido');
  });

  test('Jira no tiene solicitudes de cambio: una propuesta se rechaza con el camino correcto', () => {
    const e = falla(() => prepararPublicacion(base(proyectoConTarea(), { proveedor: 'jira', referencia: 'ABC-7', tipo: 'propuesta' })));
    assert.equal(e.codigo, 'operacion_no_soportada');
    assert.match(e.message, /comentario/);
  });
});

describe('F3.2 — la propuesta', () => {
  test('lleva exactamente los archivos del estado cuya huella en disco coincide', () => {
    const p = proyectoConTarea({ archivos: { 'src/a.js': 'export const a = 1;\n', 'src/b.js': 'export const b = 2;\n' } });
    const r = prepararPublicacion(base(p, { tipo: 'propuesta' }));
    assert.equal(r.operacion, 'proponer_cambio');
    const c = r.contenido;
    assert.equal(c.tipo, 'propuesta');
    assert.deepEqual(c.archivos.map((a) => a.ruta).sort(), ['src/a.js', 'src/b.js']);
    for (const a of c.archivos) assert.equal(a.sha256, sha256(a.contenido));
    assert.match(c.rama, /^forge\/tarea-t1-[0-9a-f]{8}$/);
    assert.equal(c.base, 'main');
    assert.match(c.titulo, /T1/);
    assert.deepEqual(c.excluidos, []);
  });

  test('un archivo del proyecto que el estado no registró no se publica', () => {
    const p = proyectoConTarea({ archivos: { 'src/a.js': 'a\n' }, soloEnDisco: { 'src/extra.js': 'extra\n' } });
    const c = prepararPublicacion(base(p, { tipo: 'propuesta' })).contenido;
    assert.deepEqual(c.archivos.map((a) => a.ruta), ['src/a.js']);
  });

  test('si la huella en disco difiere de la del estado: error claro y nada que publicar', () => {
    const p = proyectoConTarea({ archivos: { 'src/a.js': 'export const a = 1;\n', 'src/b.js': 'b\n' } });
    writeFileSync(join(p.cwd, 'src', 'a.js'), 'export const a = 999;\n');
    const e = falla(() => prepararPublicacion(base(p, { tipo: 'propuesta' })));
    assert.equal(e.codigo, 'huella_distinta');
    assert.match(e.message, /src\/a\.js/);
    assert.doesNotMatch(e.message, /999/);
  });

  test('un archivo del estado que ya no existe también es un error', () => {
    const p = proyectoConTarea({ archivos: { 'src/a.js': 'a\n' } });
    unlinkSync(join(p.cwd, 'src', 'a.js'));
    assert.equal(falla(() => prepararPublicacion(base(p, { tipo: 'propuesta' }))).codigo, 'huella_distinta');
  });

  test('CI, dependencias, configuración y vetados se excluyen y se listan aparte con su motivo', () => {
    const archivos = {
      'src/ok.js': 'export const ok = 1;\n',
      'package.json': '{"name":"x"}\n',
      'vitest.config.js': 'export default {};\n',
      '.github/workflows/ci.yml': 'on: push\n',
      'sub/.github/workflows/otro.yml': 'on: push\n',
      '.gitlab-ci.yml': 'script: [ls]\n',
      '.gitlab/merge_request_templates/x.md': 'x\n',
      'Jenkinsfile': 'pipeline {}\n',
      '.circleci/config.yml': 'version: 2.1\n',
      'azure-pipelines.yml': 'trigger: none\n',
      'Dockerfile': 'FROM scratch\n',
      '.env.local': 'A=1\n',
      'requirements.txt': 'pytest\n',
    };
    const r = prepararPublicacion(base(proyectoConTarea({ archivos }), { tipo: 'propuesta' }));
    assert.deepEqual(r.contenido.archivos.map((a) => a.ruta), ['src/ok.js']);
    const motivo = Object.fromEntries(r.contenido.excluidos.map((e) => [e.ruta, e.motivo]));
    assert.equal(motivo['package.json'], 'dependencias');
    assert.equal(motivo['requirements.txt'], 'dependencias');
    assert.equal(motivo['vitest.config.js'], 'configuracion');
    assert.equal(motivo['Dockerfile'], 'configuracion');
    assert.equal(motivo['.env.local'], 'ruta_vetada');
    for (const ci of ['.github/workflows/ci.yml', 'sub/.github/workflows/otro.yml', '.gitlab-ci.yml', '.gitlab/merge_request_templates/x.md', 'Jenkinsfile', '.circleci/config.yml', 'azure-pipelines.yml']) {
      assert.equal(motivo[ci], 'ci', ci);
    }
    assert.equal(r.contenido.excluidos.length, 12);
    // Y la descripción de la propuesta las lista como pendientes de aprobación expresa por archivo
    const d = r.contenido.descripcion;
    assert.match(d, /aprobación expresa/);
    assert.match(d, /\.gitlab-ci\.yml/);
    assert.match(d, /package\.json/);
  });

  test('los archivos excluidos no obligan a que su huella en disco coincida (no se publican)', () => {
    const p = proyectoConTarea({ archivos: { 'src/ok.js': 'ok\n', 'package.json': '{}\n' } });
    writeFileSync(join(p.cwd, 'package.json'), '{"cambiado":true}\n');
    const r = prepararPublicacion(base(p, { tipo: 'propuesta' }));
    assert.deepEqual(r.contenido.archivos.map((a) => a.ruta), ['src/ok.js']);
  });

  test('un archivo con un formato de secreto conocido no se publica', () => {
    const secreto = 'ghp_' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8';
    const p = proyectoConTarea({ archivos: { 'src/ok.js': 'ok\n', 'src/cliente.js': `export const t = '${secreto}';\n` } });
    const r = prepararPublicacion(base(p, { tipo: 'propuesta' }));
    assert.deepEqual(r.contenido.archivos.map((a) => a.ruta), ['src/ok.js']);
    assert.deepEqual(r.contenido.excluidos, [{ ruta: 'src/cliente.js', motivo: 'secreto_en_contenido' }]);
    assert.ok(!JSON.stringify(r).includes(secreto));
  });

  test('rutas absolutas o que salen del proyecto en el estado se excluyen, no se leen', () => {
    const p = proyectoConTarea({ archivos: { 'src/ok.js': 'ok\n' }, estado: { implementacion: { archivos: [{ ruta: 'src/ok.js', sha256: sha256('ok\n') }, { ruta: '../fuera.js', sha256: 'a'.repeat(64) }, { ruta: '/etc/hosts', sha256: 'b'.repeat(64) }] } } });
    const r = prepararPublicacion(base(p, { tipo: 'propuesta' }));
    assert.deepEqual(r.contenido.archivos.map((a) => a.ruta), ['src/ok.js']);
    assert.deepEqual(r.contenido.excluidos.map((e) => e.motivo), ['ruta_no_valida', 'ruta_no_valida']);
  });

  test('si todo queda excluido no hay propuesta', () => {
    const p = proyectoConTarea({ archivos: { 'package.json': '{}\n', '.github/workflows/ci.yml': 'on: push\n' } });
    const e = falla(() => prepararPublicacion(base(p, { tipo: 'propuesta' })));
    assert.equal(e.codigo, 'sin_archivos');
    assert.match(e.message, /package\.json/);
  });

  test('la rama base se valida y se puede elegir', () => {
    const p = proyectoConTarea();
    assert.equal(prepararPublicacion(base(p, { tipo: 'propuesta', base: 'develop' })).contenido.base, 'develop');
    for (const mala of ['../main', 'a b', '-x', 'main\nmás']) {
      assert.equal(falla(() => prepararPublicacion(base(p, { tipo: 'propuesta', base: mala }))).codigo, 'base_no_valida', JSON.stringify(mala));
    }
  });
});

describe('motivoDeExclusion', () => {
  test('clasifica rutas sin leer nada', () => {
    assert.equal(motivoDeExclusion('src/a.js'), null);
    assert.equal(motivoDeExclusion('docs/guia.md'), null);
    assert.equal(motivoDeExclusion('.github/CODEOWNERS'), 'ci');
    assert.equal(motivoDeExclusion('JENKINSFILE'), 'ci');
    assert.equal(motivoDeExclusion('go.mod'), 'dependencias');
    assert.equal(motivoDeExclusion('.husky/pre-commit'), 'configuracion');
    assert.equal(motivoDeExclusion('.git/config'), 'ruta_vetada');
  });
});
