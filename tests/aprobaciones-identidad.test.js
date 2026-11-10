// @ts-check
/**
 * Spec 2026-11-06-aprobaciones-con-identidad (hallazgo C-03).
 * `forge aprobar` exige TTY real + código; el registro .sdd/aprobaciones.jsonl es firmado y encadenado;
 * `aprobado_por_delegacion` exige registro verificable; `step --force` exige motivo y deja evento firmado.
 *
 * El CLI real se prueba con spawn (sin TTY: tuberías). El camino CON terminal se prueba inyectando
 * las funciones de lectura/escritura en el módulo (no se puede abrir un TTY sin dependencias).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ErrorIdentidad, aprobarConIdentidad, buscarAprobacion, comprobarDelegaciones, confirmarConCodigo, eventoForzadoValido,
  exigirTerminal, firmarEvento, generarCodigo, hashDeArchivo, leerRegistro, motivoDeArgs, registrarAprobacion, sha256De,
} from '../core/aprobaciones-identidad.js';
import { EventLog } from '../core/event-log.js';
import { PipelineStateMachine } from '../core/state-machine.js';
import { InMemoryStateStore } from '../core/state-store.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(RAIZ, 'cli', 'index.js');
const QUIEN = { email: 'dueno@ejemplo.test', nombre: 'Dueño', usuarioSO: 'dueno' };

/** Proyecto temporal + estado del usuario aislado (FORGE_HOME). */
function proyecto() {
  const base = mkdtempSync(join(tmpdir(), 'forge-apro-id-'));
  const cwd = join(base, 'proy');
  mkdirSync(join(cwd, '.sdd', 'especificaciones'), { recursive: true });
  const env = { ...process.env, FORGE_HOME: join(base, 'home'), ANTHROPIC_API_KEY: '', FORGE_LLM_PROVIDER: 'stub' };
  delete env.FRAGUA_HOME;
  return { cwd, env };
}
const forge = (cwd, env, ...args) => {
  const r = spawnSync(process.execPath, [CLI, ...args], { cwd, env, encoding: 'utf8', timeout: 60_000, stdio: ['pipe', 'pipe', 'pipe'], input: '' });
  return { codigo: r.status, salida: `${r.stdout ?? ''}${r.stderr ?? ''}` };
};
const tty = { isTTY: true };

/** Ejecuta la aprobación con un terminal simulado en el que la persona teclea el código que ve. */
async function aprobarComoHumano(cwd, env, o = {}) {
  /** @type {string[]} */
  const pantalla = [];
  const r = await aprobarConIdentidad({
    cwd, env, tipo: 'delegacion', id: 'x/plan.md', artefacto: '.sdd/especificaciones/x/plan.md', sha256: sha256De('contenido'),
    stdin: tty, stdout: tty, identidad: () => QUIEN, escribir: (t) => pantalla.push(t),
    leerLinea: async () => /código: ([A-Z0-9]{6})/.exec(pantalla.join(''))?.[1] ?? '', ...o,
  });
  return { r, pantalla: pantalla.join('') };
}

function escribirEstadoSpec(cwd) {
  mkdirSync(join(cwd, '.sdd', 'especificaciones', 's1'), { recursive: true });
  writeFileSync(join(cwd, '.sdd', 'especificaciones', 's1', 'spec.md'), '# spec\n');
  writeFileSync(join(cwd, '.sdd', 'estado.json'), JSON.stringify({
    schemaVersion: '1.0', pipeline_step: 'spec', spec_activa: 's1', spec_aprobado: false, ultima_actualizacion: new Date().toISOString(),
  }));
}

describe('forge aprobar: exige terminal real', () => {
  test('sin TTY rechaza con código != 0, mensaje claro y sin aprobar nada', () => {
    const { cwd, env } = proyecto();
    escribirEstadoSpec(cwd);
    const r = forge(cwd, env, 'aprobar', 'spec');
    assert.notEqual(r.codigo, 0, r.salida);
    assert.match(r.salida, /terminal interactivo real/);
    assert.equal(JSON.parse(readFileSync(join(cwd, '.sdd', 'estado.json'), 'utf8')).spec_aprobado, false);
    assert.throws(() => readFileSync(join(cwd, '.sdd', 'aprobaciones.jsonl')), /ENOENT/);
  });

  test('`--sin-tty` y cualquier otra opción NO existen', () => {
    const { cwd, env } = proyecto();
    escribirEstadoSpec(cwd);
    for (const flag of ['--sin-tty', '--yes', '--force']) {
      const r = forge(cwd, env, 'aprobar', 'spec', flag);
      assert.notEqual(r.codigo, 0, `${flag}: ${r.salida}`);
      assert.match(r.salida, /Opción desconocida/);
    }
    assert.equal(JSON.parse(readFileSync(join(cwd, '.sdd', 'estado.json'), 'utf8')).spec_aprobado, false);
    assert.doesNotMatch(readFileSync(join(RAIZ, 'core', 'aprobaciones-identidad.js'), 'utf8'), /'--sin-tty'|"--sin-tty"/);
  });

  test('delegacion sin TTY también se rechaza', () => {
    const { cwd, env } = proyecto();
    mkdirSync(join(cwd, '.sdd', 'especificaciones', 'x'), { recursive: true });
    writeFileSync(join(cwd, '.sdd', 'especificaciones', 'x', 'plan.md'), '---\nestado: aprobado_por_delegacion\n---\n');
    const r = forge(cwd, env, 'aprobar', 'delegacion', 'x/plan.md');
    assert.notEqual(r.codigo, 0, r.salida);
    assert.match(r.salida, /terminal interactivo real/);
  });

  test('exigirTerminal: ambos flujos deben ser TTY', () => {
    assert.throws(() => exigirTerminal({ isTTY: false }, tty), (e) => e instanceof ErrorIdentidad && e.codigo === 'sin_tty');
    assert.throws(() => exigirTerminal(tty, {}), /terminal/);
    assert.doesNotThrow(() => exigirTerminal(tty, tty));
  });
});

describe('código de un solo uso (lectura inyectada)', () => {
  test('el código es distinto cada vez y de 6 caracteres sin ambigüedades', () => {
    const a = new Set(Array.from({ length: 20 }, () => generarCodigo()));
    assert.ok(a.size > 15);
    for (const c of a) assert.match(c, /^[A-HJ-NP-Z2-9]{6}$/);
  });

  test('un código incorrecto no aprueba ni registra nada', async () => {
    const { cwd, env } = proyecto();
    await assert.rejects(aprobarComoHumano(cwd, env, { leerLinea: async () => 'NOPE12' }), (e) => e.codigo === 'codigo_incorrecto');
    assert.equal(leerRegistro(cwd, env).existe, false);
  });

  test('una respuesta vacía o el cierre del flujo tampoco', async () => {
    const { cwd, env } = proyecto();
    await assert.rejects(confirmarConCodigo({ escribir: () => {}, leerLinea: async () => '', codigo: 'ABC234' }), /no coincide/);
    await assert.rejects(aprobarComoHumano(cwd, env, { leerLinea: async () => { throw new ErrorIdentidad('sin_respuesta', 'sin respuesta'); } }), /sin respuesta/);
  });

  test('sin TTY en el módulo se rechaza antes de mostrar código', async () => {
    const { cwd, env } = proyecto();
    /** @type {string[]} */ const pantalla = [];
    await assert.rejects(aprobarConIdentidad({
      cwd, env, tipo: 'spec', id: 's', artefacto: 'a', sha256: sha256De('a'), stdin: { isTTY: false }, stdout: tty,
      leerLinea: async () => 'x', escribir: (t) => pantalla.push(t),
    }), (e) => e.codigo === 'sin_tty');
    assert.equal(pantalla.length, 0);
  });
});

describe('registro .sdd/aprobaciones.jsonl', () => {
  test('guarda quién, cuándo, qué y el hash; verifica firma y cadena', async () => {
    const { cwd, env } = proyecto();
    const ahora = new Date('2026-11-06T10:00:00.000Z');
    const { r, pantalla } = await aprobarComoHumano(cwd, env, { ahora });
    assert.match(pantalla, new RegExp(sha256De('contenido')));
    assert.equal(r.quien.email, QUIEN.email);
    assert.equal(r.cuando, '2026-11-06T10:00:00.000Z');
    assert.equal(r.id, 'x/plan.md');
    assert.equal(r.sha256, sha256De('contenido'));
    await aprobarComoHumano(cwd, env, { id: 'y/plan.md' });
    const l = leerRegistro(cwd, env);
    assert.deepEqual(l.errores, []);
    assert.equal(l.registros.length, 2);
    assert.equal(l.registros[1].anterior, l.registros[0].hmac);
    assert.ok(buscarAprobacion(cwd, { id: 'x/plan.md', sha256: sha256De('contenido') }, env));
    assert.equal(buscarAprobacion(cwd, { id: 'x/plan.md', sha256: sha256De('otro') }, env), null);
  });

  test('editar una línea, o quitar la primera, se detecta; no se añade encima de un registro roto', async () => {
    const { cwd, env } = proyecto();
    await aprobarComoHumano(cwd, env);
    await aprobarComoHumano(cwd, env, { id: 'y/plan.md' });
    const ruta = join(cwd, '.sdd', 'aprobaciones.jsonl');
    const original = readFileSync(ruta, 'utf8');
    writeFileSync(ruta, original.replace('dueno@ejemplo.test', 'otro@ejemplo.test'));
    assert.match(leerRegistro(cwd, env).errores.join(' '), /firma no vale/);
    assert.equal(buscarAprobacion(cwd, { id: 'y/plan.md', sha256: sha256De('contenido') }, env), null, 'con el registro roto no vale ninguna');
    writeFileSync(ruta, original.split('\n').slice(1).join('\n'));
    assert.match(leerRegistro(cwd, env).errores.join(' '), /cadena/);
    assert.throws(() => registrarAprobacion(cwd, { tipo: 'spec', id: 'z', artefacto: 'z', sha256: sha256De('z'), quien: QUIEN }, { env }), (e) => e.codigo === 'registro_roto');
  });

  test('una línea fabricada sin la clave no vale', async () => {
    const { cwd, env } = proyecto();
    await aprobarComoHumano(cwd, env);
    appendFileSync(join(cwd, '.sdd', 'aprobaciones.jsonl'), `${JSON.stringify({ version: 1, tipo: 'delegacion', id: 'f/plan.md', artefacto: 'f', sha256: sha256De('f'), quien: QUIEN, cuando: new Date().toISOString(), anterior: null, hmac: 'a'.repeat(64) })}\n`);
    assert.ok(leerRegistro(cwd, env).errores.length > 0);
  });

  test('sin la clave de este usuario el registro existente no se puede verificar', () => {
    const { cwd, env } = proyecto();
    writeFileSync(join(cwd, '.sdd', 'aprobaciones.jsonl'), '{"a":1}\n');
    const l = leerRegistro(cwd, env);
    assert.match(l.errores.join(' '), /no tiene clave local/);
  });
});

describe('aprobado_por_delegacion exige registro verificable', () => {
  const plan = (cwd, extra = '') => {
    mkdirSync(join(cwd, '.sdd', 'especificaciones', 'x'), { recursive: true });
    const ruta = join(cwd, '.sdd', 'especificaciones', 'x', 'plan.md');
    writeFileSync(ruta, `---\nspec_id: x\nestado: aprobado_por_delegacion\n---\n# Plan${extra}\n`);
    return ruta;
  };

  test('sin registro: no vale', () => {
    const { cwd, env } = proyecto();
    plan(cwd);
    const c = comprobarDelegaciones(cwd, env);
    assert.equal(c.ok, false);
    assert.match(c.delegaciones[0].motivo ?? '', /forge aprobar delegacion x\/plan\.md/);
  });

  test('con registro de la persona y el mismo hash: vale; si el archivo cambia, deja de valer', async () => {
    const { cwd, env } = proyecto();
    const ruta = plan(cwd);
    await aprobarComoHumano(cwd, env, { id: 'x/plan.md', artefacto: '.sdd/especificaciones/x/plan.md', sha256: hashDeArchivo(cwd, ruta) ?? '' });
    assert.equal(comprobarDelegaciones(cwd, env).ok, true);
    writeFileSync(ruta, `${readFileSync(ruta, 'utf8')}cambio\n`);
    const c = comprobarDelegaciones(cwd, env);
    assert.equal(c.ok, false);
    assert.match(c.delegaciones[0].motivo ?? '', /cambió/);
  });

  test('otros estados no se tocan y un registro manipulado invalida', async () => {
    const { cwd, env } = proyecto();
    const ruta = plan(cwd);
    mkdirSync(join(cwd, '.sdd', 'especificaciones', 'y'), { recursive: true });
    writeFileSync(join(cwd, '.sdd', 'especificaciones', 'y', 'spec.md'), '---\nestado: aprobada\n---\n');
    await aprobarComoHumano(cwd, env, { id: 'x/plan.md', sha256: hashDeArchivo(cwd, ruta) ?? '' });
    assert.equal(comprobarDelegaciones(cwd, env).delegaciones.length, 1);
    const reg = join(cwd, '.sdd', 'aprobaciones.jsonl');
    writeFileSync(reg, readFileSync(reg, 'utf8').replace('dueno@', 'otro@'));
    assert.equal(comprobarDelegaciones(cwd, env).ok, false);
  });

  test('forge verificar --comprobar-aprobaciones: código 1 sin registro, 0 si no hay delegaciones', () => {
    const { cwd, env } = proyecto();
    assert.equal(forge(cwd, env, 'verificar', '--comprobar-aprobaciones').codigo, 0);
    plan(cwd);
    const r = forge(cwd, env, 'verificar', '--comprobar-aprobaciones');
    assert.equal(r.codigo, 1, r.salida);
    assert.match(r.salida, /x\/plan\.md/);
  });
});

describe('step --force: motivo obligatorio y evento firmado', () => {
  const montar = () => {
    const p = proyecto();
    writeFileSync(join(p.cwd, '.sdd', 'estado.json'), JSON.stringify({
      schemaVersion: '1.0', pipeline_step: 'spec', spec_activa: 's1', spec_aprobado: false, ultima_actualizacion: new Date().toISOString(),
    }));
    return p;
  };
  const paso = (cwd) => JSON.parse(readFileSync(join(cwd, '.sdd', 'estado.json'), 'utf8')).pipeline_step;

  test('sin motivo: no avanza y sale con código != 0', () => {
    const { cwd, env } = montar();
    const r = forge(cwd, env, 'step', 'plan', '--force');
    assert.notEqual(r.codigo, 0, r.salida);
    assert.match(r.salida, /motivo/);
    assert.equal(paso(cwd), 'spec');
    const corto = forge(cwd, env, 'step', 'plan', '--force', '--motivo', 'ya');
    assert.notEqual(corto.codigo, 0);
    assert.equal(paso(cwd), 'spec');
  });

  test('con motivo: avanza y deja un evento firmado verificable; alterarlo lo invalida', () => {
    const { cwd, env } = montar();
    const r = forge(cwd, env, 'step', 'plan', '--force', '--motivo', 'recuperación tras corrupción de estado');
    assert.equal(r.codigo, 0, r.salida);
    assert.equal(paso(cwd), 'plan');
    const eventos = readFileSync(join(cwd, '.sdd', 'observabilidad', 'events.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    const e = eventos.find((x) => x.type === 'pipeline_step_forzado');
    assert.ok(e, 'hay evento pipeline_step_forzado');
    assert.equal(e.payload.motivo, 'recuperación tras corrupción de estado');
    assert.equal(e.payload.from, 'spec');
    assert.equal(e.payload.to, undefined);
    assert.equal(e.payload.step, 'plan');
    assert.ok(e.payload.quien.usuarioSO);
    assert.equal(eventoForzadoValido(cwd, e, env), true);
    assert.equal(eventoForzadoValido(cwd, { payload: { ...e.payload, motivo: 'otro motivo cualquiera' } }, env), false);
    assert.equal(eventoForzadoValido(cwd, { payload: { ...e.payload, firma: undefined } }, env), false);
  });

  test('advance(force) sin motivo o sin firma no salta los guards (unidad)', () => {
    const store = new InMemoryStateStore();
    store.write({ schemaVersion: '1.0', pipeline_step: 'spec', spec_activa: 's', ultima_actualizacion: 'x' });
    const dir = mkdtempSync(join(tmpdir(), 'forge-apro-fsm-'));
    const fsm = new PipelineStateMachine(store, new EventLog(dir));
    assert.equal(fsm.advance('plan', true).ok, false);
    assert.equal(fsm.advance('plan', true, { motivo: 'motivo largo suficiente' }).ok, false);
    assert.equal(fsm.currentStep(), 'spec');
    assert.equal(fsm.advance('plan', true, { motivo: 'motivo largo suficiente', firmar: () => 'f' }).ok, true);
    assert.equal(fsm.advance('tasks', false).ok, false, 'sin force los guards siguen aplicando');
  });

  test('motivoDeArgs lee ambas formas', () => {
    assert.equal(motivoDeArgs(['plan', '--force', '--motivo', ' porque sí ']), 'porque sí');
    assert.equal(motivoDeArgs(['--motivo=abc def']), 'abc def');
    assert.equal(motivoDeArgs(['--force']), null);
    assert.equal(motivoDeArgs(['--motivo']), null);
  });

  test('firmarEvento es determinista por clave y payload', () => {
    const { cwd, env } = proyecto();
    assert.equal(firmarEvento(cwd, { a: 1 }, env), firmarEvento(cwd, { a: 1 }, env));
    assert.notEqual(firmarEvento(cwd, { a: 1 }, env), firmarEvento(cwd, { a: 2 }, env));
  });
});

describe('puerta real de la spec (REVERIFICACION C-03): spec_aprobado a mano no basta', () => {
  /** Proyecto en la etapa «spec» con spec_aprobado: true escrito directamente en estado.json. */
  function enSpec() {
    const { cwd, env } = proyecto();
    const dir = join(cwd, '.sdd', 'especificaciones', 'spec-1');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'spec.md'), '# spec uno\n', 'utf8');
    writeFileSync(join(cwd, '.sdd', 'estado.json'), JSON.stringify({
      schemaVersion: '1.0', pipeline_step: 'spec', spec_activa: 'spec-1', spec_aprobado: true, ultima_actualizacion: new Date().toISOString(),
    }), 'utf8');
    return { cwd, env, rutaSpec: join(dir, 'spec.md') };
  }

  test('forge step plan se rechaza si el booleano está a true pero no hay registro firmado', () => {
    const { cwd, env } = enSpec();
    const r = forge(cwd, env, 'step', 'plan');
    assert.notEqual(r.codigo, 0, r.salida);
    assert.match(r.salida, /aprobación registrada y vigente/);
  });

  test('con el registro firmado del hash vigente, avanza', () => {
    const { cwd, env, rutaSpec } = enSpec();
    registrarAprobacion(cwd, { tipo: 'spec', id: 'spec-1', artefacto: '.sdd/especificaciones/spec-1/spec.md', sha256: hashDeArchivo(cwd, rutaSpec), quien: QUIEN }, { env });
    const r = forge(cwd, env, 'step', 'plan');
    assert.equal(r.codigo, 0, r.salida);
  });

  test('si la spec cambia después de aprobarse, vuelve a rechazarse', () => {
    const { cwd, env, rutaSpec } = enSpec();
    registrarAprobacion(cwd, { tipo: 'spec', id: 'spec-1', artefacto: '.sdd/especificaciones/spec-1/spec.md', sha256: hashDeArchivo(cwd, rutaSpec), quien: QUIEN }, { env });
    writeFileSync(rutaSpec, '# spec uno, modificada después de aprobar\n', 'utf8');
    const r = forge(cwd, env, 'step', 'plan');
    assert.notEqual(r.codigo, 0, r.salida);
  });

  test('forge aprobar spec ya no da por buena una spec «aprobada» sin registro: pide aprobarla de nuevo', () => {
    const { cwd, env } = enSpec();
    const r = forge(cwd, env, 'aprobar', 'spec');
    assert.notEqual(r.codigo, 0, 'sin terminal real no puede aprobar');
    assert.doesNotMatch(r.salida, /ya está aprobada/);
    assert.match(r.salida, /terminal interactivo real/);
  });
});
