/**
 * Renombrar a Fragua, F2 y F3: nombres en un solo sitio y variables FRAGUA_* / FORGE_*.
 * Cubre CA-001-03/04, CA-003-01..05. Ninguna combinación de los dos nombres puede ampliar un permiso.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerVariable, leerVariableRestrictiva, sinVariable, ErrorVariableEnConflicto } from '../core/entorno.js';
import * as N from '../core/nombres.js';
import { estadoInterruptor } from '../core/integraciones/auditoria.js';
import { hostsDelUsuario } from '../core/integraciones/hosts.js';
import { runtimePermitido } from '../core/sandbox/politica.js';
import { aplicarPoliticaDelUsuario, interpretarIntegraciones, leerToken, motivoVariableNoPermitida, NOMBRE_VARIABLE } from '../core/integraciones/config.js';
import { rutaDeEstado } from '../core/integraciones/estado-usuario.js';
import { leerConfigCiclo } from '../core/ciclo/config.js';

const RAIZ = join(fileURLToPath(import.meta.url), '..', '..');

describe('F3.1 leerVariable', () => {
  test('solo antigua, solo nueva, iguales: devuelve el valor', () => {
    assert.equal(leerVariable('X', { FORGE_X: 'a' }), 'a');
    assert.equal(leerVariable('X', { FRAGUA_X: 'b' }), 'b');
    assert.equal(leerVariable('X', { FRAGUA_X: 'c', FORGE_X: 'c' }), 'c');
    assert.equal(leerVariable('X', {}), undefined);
  });
  test('distintas: lanza un error que nombra las dos y no filtra los valores', () => {
    assert.throws(() => leerVariable('X', { FRAGUA_X: 'secreto1', FORGE_X: 'secreto2' }), (e) => {
      assert.ok(e instanceof ErrorVariableEnConflicto);
      assert.match(e.message, /FRAGUA_X/); assert.match(e.message, /FORGE_X/);
      assert.ok(!/secreto/.test(e.message));
      return true;
    });
  });
  test('una vacía y otra con valor también es conflicto', () => {
    assert.throws(() => leerVariable('X', { FRAGUA_X: '', FORGE_X: 'y' }), ErrorVariableEnConflicto);
  });
  test('sinVariable quita las dos formas', () => {
    assert.deepEqual(sinVariable('API_TOKEN', { FRAGUA_API_TOKEN: 'a', FORGE_API_TOKEN: 'b', PATH: 'p' }), { PATH: 'p' });
  });
});

describe('F3.3 política: ningún par de nombres amplía permisos', () => {
  const CWD = RAIZ;
  test('INTEGRACIONES: conflicto apaga; normal/apagado mezclados apagan; un nombre apagado apaga', () => {
    assert.equal(estadoInterruptor(CWD, { FRAGUA_INTEGRACIONES: 'normal', FORGE_INTEGRACIONES: 'apagado' }).apagado, true);
    assert.equal(estadoInterruptor(CWD, { FRAGUA_INTEGRACIONES: 'apagado', FORGE_INTEGRACIONES: 'normal' }).apagado, true);
    assert.equal(estadoInterruptor(CWD, { FRAGUA_INTEGRACIONES: 'apagado' }).apagado, true);
    assert.equal(estadoInterruptor(CWD, { FORGE_INTEGRACIONES: 'apagado' }).apagado, true);
    assert.equal(estadoInterruptor(CWD, { FRAGUA_INTEGRACIONES: 'apagado', FORGE_INTEGRACIONES: 'apagado' }).apagado, true);
    assert.equal(estadoInterruptor(CWD, { FRAGUA_INTEGRACIONES: 'normal', FORGE_INTEGRACIONES: 'apagada' }).apagado, true);
  });

  const cfg = interpretarIntegraciones('integraciones:\n  github_modo: proponer\n  github_token_env: FRAGUA_GITHUB_TOKEN\n  github_destinos: org/repo\n');
  test('INTEGRACIONES_ESCRITURA: con conflicto no se concede escritura (las listas no se unen)', () => {
    const base = cfg;
    const r = aplicarPoliticaDelUsuario(base, { FRAGUA_INTEGRACIONES_ESCRITURA: 'github', FORGE_INTEGRACIONES_ESCRITURA: 'gitlab' });
    for (const p of Object.values(r.proveedores)) assert.ok(p.modo === 'solo_lectura' || p.modo === 'apagado' || p.modo === base.proveedores[p.nombre].modo === false);
    assert.notEqual(r.proveedores.github?.modo, 'proponer');
    const sola = aplicarPoliticaDelUsuario(base, { FRAGUA_INTEGRACIONES_ESCRITURA: 'github' });
    assert.equal(sola.proveedores.github.modo, base.proveedores.github.modo);
  });
  test('INTEGRACIONES_DESTINOS: con conflicto no queda ningún destino permitido', () => {
    const r = aplicarPoliticaDelUsuario(cfg, { FRAGUA_INTEGRACIONES_DESTINOS: 'a/a', FORGE_INTEGRACIONES_DESTINOS: 'org/repo' });
    assert.deepEqual(r.proveedores.github.destinos, []);
  });
  test('INTEGRACIONES_HOSTS: con conflicto no se autoriza ningún host', () => {
    assert.deepEqual(hostsDelUsuario({ FRAGUA_INTEGRACIONES_HOSTS: 'a.empresa.com', FORGE_INTEGRACIONES_HOSTS: 'b.empresa.com' }), []);
    assert.deepEqual(hostsDelUsuario({ FRAGUA_INTEGRACIONES_HOSTS: 'a.empresa.com' }), ['a.empresa.com']);
    assert.deepEqual(hostsDelUsuario({ FORGE_INTEGRACIONES_HOSTS: 'a.empresa.com' }), ['a.empresa.com']);
  });
  test('RUNTIMES_PERMITIDOS: con conflicto no se añade ningún runtime', () => {
    assert.equal(runtimePermitido('kata', {}).ok, false);
    assert.equal(runtimePermitido('kata', { FRAGUA_RUNTIMES_PERMITIDOS: 'kata' }).ok, true);
    assert.equal(runtimePermitido('kata', { FORGE_RUNTIMES_PERMITIDOS: 'kata' }).ok, true);
    assert.equal(runtimePermitido('kata', { FRAGUA_RUNTIMES_PERMITIDOS: 'kata', FORGE_RUNTIMES_PERMITIDOS: 'runsc' }).ok, false);
    assert.equal(runtimePermitido('runsc', { FRAGUA_RUNTIMES_PERMITIDOS: 'kata', FORGE_RUNTIMES_PERMITIDOS: 'runsc' }).ok, false);
  });
  test('HOME: con conflicto, error (no se elige dónde está la clave)', () => {
    assert.throws(() => rutaDeEstado(RAIZ, { FRAGUA_HOME: join(RAIZ, '..', 'a'), FORGE_HOME: join(RAIZ, '..', 'b') }), /FRAGUA_HOME/);
  });
  test('NIVEL_MAXIMO, BUDGET_USD e IMPLEMENTADOR: con conflicto, error que nombra las dos', () => {
    for (const s of ['NIVEL_MAXIMO', 'BUDGET_USD', 'IMPLEMENTADOR']) {
      const guardado = { n: process.env[`FRAGUA_${s}`], a: process.env[`FORGE_${s}`] };
      process.env[`FRAGUA_${s}`] = '1'; process.env[`FORGE_${s}`] = '2';
      try {
        assert.throws(() => leerConfigCiclo(RAIZ), new RegExp(`FRAGUA_${s}.*FORGE_${s}`));
      } finally {
        for (const [k, v] of [[`FRAGUA_${s}`, guardado.n], [`FORGE_${s}`, guardado.a]]) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
      }
    }
  });
  test('LLM_HOSTS, LLM_PROVIDER, API_TOKEN: conflicto restrictivo o error', async () => {
    const { destinoDeModeloPermitido } = await import('../core/llm-providers/index.js');
    assert.equal(destinoDeModeloPermitido('https://a.x.com', { FRAGUA_LLM_HOSTS: 'a.x.com' }), true);
    assert.equal(destinoDeModeloPermitido('https://a.x.com', { FORGE_LLM_HOSTS: 'a.x.com' }), true);
    assert.equal(destinoDeModeloPermitido('https://a.x.com', { FRAGUA_LLM_HOSTS: 'a.x.com', FORGE_LLM_HOSTS: 'b.x.com' }), false);
    assert.throws(() => leerVariable('LLM_PROVIDER', { FRAGUA_LLM_PROVIDER: 'stub', FORGE_LLM_PROVIDER: 'anthropic' }), ErrorVariableEnConflicto);
    assert.throws(() => leerVariable('API_TOKEN', { FRAGUA_API_TOKEN: 'a', FORGE_API_TOKEN: 'b' }), ErrorVariableEnConflicto);
    assert.equal(leerVariableRestrictiva('LLM_HOSTS', { FRAGUA_LLM_HOSTS: 'a', FORGE_LLM_HOSTS: 'b' }, ''), '');
  });
});

describe('F3.4 *_token_env', () => {
  test('acepta los prefijos FRAGUA_ y FORGE_ y ningún otro; reserva las dos formas', () => {
    assert.equal(motivoVariableNoPermitida('FRAGUA_GITHUB_TOKEN'), null);
    assert.equal(motivoVariableNoPermitida('FORGE_GITHUB_TOKEN'), null);
    for (const malo of ['PATH', 'GITHUB_TOKEN', 'FORJA_X', 'fragua_x', 'FRAGUA', 'FRAGUA_API_TOKEN', 'FORGE_API_TOKEN', 'FRAGUA_HOME', 'FRAGUA_INTEGRACIONES_HOSTS', 'FRAGUA_LLM_PROVIDER']) {
      assert.notEqual(motivoVariableNoPermitida(malo), null, malo);
    }
    assert.ok(NOMBRE_VARIABLE.test('FRAGUA_X'));
  });
  test('leerToken lee ambas formas y falla ante valores distintos', () => {
    const c = interpretarIntegraciones('integraciones:\n  github_modo: solo_lectura\n  github_token_env: FRAGUA_GITHUB_TOKEN\n  github_destinos: org/repo\n');
    assert.equal(leerToken(c.proveedores.github, { FORGE_GITHUB_TOKEN: 't' }), 't');
    assert.throws(() => leerToken(c.proveedores.github, { FORGE_GITHUB_TOKEN: 't', FRAGUA_GITHUB_TOKEN: 'u' }), ErrorVariableEnConflicto);
  });
});

describe('F3.2 prueba estática: ninguna lectura directa fuera de core/entorno.js', () => {
  const EXCLUIDAS = new Set(['node_modules', '.git', '.claude', 'tests', '__tests__', 'docs', 'docs-site']);
  function* js(dir) {
    for (const n of readdirSync(dir)) {
      if (EXCLUIDAS.has(n)) continue;
      const p = join(dir, n);
      if (statSync(p).isDirectory()) yield* js(p);
      else if (/\.(m?js)$/.test(n)) yield p;
    }
  }
  const PERMITIDOS = new Set(['core/entorno.js', 'claude-hooks/shared/entorno.js']);
  const DIRECTA = /process\.env\s*(?:\.|\[\s*['"`])\s*(?:FORGE|FRAGUA)_|\benv\s*\.\s*(?:FORGE|FRAGUA)_|\benv\s*\[\s*['"`](?:FORGE|FRAGUA)_|\{\s*(?:FORGE|FRAGUA)_[A-Z_]+\s*(?::[^}]*)?\}\s*=\s*(?:process\.)?env\b|\benv\s*\[\s*(?:VARIABLE_|nombre\b)/;
  test('no queda ninguna', () => {
    const malas = [];
    for (const f of js(RAIZ)) {
      const rel = relative(RAIZ, f).split(sep).join('/');
      if (PERMITIDOS.has(rel)) continue;
      readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
        if (/^\s*(\/\/|\*)/.test(l)) return;
        if (DIRECTA.test(l)) malas.push(`${rel}:${i + 1}: ${l.trim().slice(0, 100)}`);
      });
    }
    assert.deepEqual(malas, []);
  });
});

describe('F3.5 proyecto hostil', () => {
  test('el archivo del proyecto no puede fijar ninguna de las dos formas: solo cuenta el entorno recibido', () => {
    const c = interpretarIntegraciones('FRAGUA_INTEGRACIONES_ESCRITURA: github\nFORGE_INTEGRACIONES_ESCRITURA: github\nintegraciones:\n  github_modo: proponer\n  github_token_env: FRAGUA_GITHUB_TOKEN\n  github_destinos: org/repo\n');
    const r = aplicarPoliticaDelUsuario(c, {});
    assert.notEqual(r.proveedores.github?.modo, 'proponer');
  });
});

describe('F2 nombres', () => {
  test('formas nueva y antigua en un solo sitio', () => {
    assert.equal(N.ORDEN, 'fragua');
    assert.deepEqual([...N.ORDENES_ANTIGUAS], ['forge', 'sdd-es']);
    assert.equal(N.PREFIJO_VARIABLE, 'FRAGUA_');
    assert.equal(N.PREFIJO_VARIABLE_ANTIGUO, 'FORGE_');
  });
  test('ordenInvocada reconoce la orden del argv', () => {
    assert.equal(N.ordenInvocada('/usr/bin/forge'), 'forge');
    assert.equal(N.ordenInvocada('C:\\x\\fragua.cmd'), 'fragua');
    assert.equal(N.ordenInvocada('/n/sdd-es'), 'sdd-es');
    assert.equal(N.ordenInvocada('/p/cli/index.js'), 'fragua');
  });
  test('el aviso solo con forge, TTY, sin --json y fuera de pruebas', () => {
    const tty = { isTTY: true };
    assert.equal(N.debeAvisarOrdenAntigua('forge', ['init'], tty, {}), true);
    assert.equal(N.debeAvisarOrdenAntigua('forge', ['status', '--json'], tty, {}), false);
    assert.equal(N.debeAvisarOrdenAntigua('forge', ['init'], { isTTY: false }, {}), false);
    assert.equal(N.debeAvisarOrdenAntigua('fragua', ['init'], tty, {}), false);
    assert.equal(N.debeAvisarOrdenAntigua('forge', ['init'], tty, { NODE_TEST_CONTEXT: 'child-v8' }), false);
  });
});
