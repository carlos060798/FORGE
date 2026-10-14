// @ts-check
/**
 * F1.2 — Configuración de integraciones (core/integraciones/config.js).
 * CA-004-01, CA-004-03, CA-004-04, CA-005-01 (parte de configuración).
 */

import { test, describe } from 'node:test';
import './fixtures/integraciones/entorno-usuario.mjs';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  destinoPermitido, ErrorConfigIntegraciones, interpretarIntegraciones, leerConfigIntegraciones, leerToken,
} from '../core/integraciones/config.js';
import { leerConfigCiclo } from '../core/ciclo/config.js';

/** Entorno que cuenta cada lectura (de cualquier clave). */
function entornoVigilado(valores = {}) {
  /** @type {string[]} */
  const lecturas = [];
  const env = new Proxy(valores, {
    get(t, k) { if (typeof k === 'string') lecturas.push(k); return Reflect.get(t, k); },
    has(t, k) { if (typeof k === 'string') lecturas.push(k); return Reflect.has(t, k); },
    ownKeys(t) { lecturas.push('(ownKeys)'); return Reflect.ownKeys(t); },
  });
  return { env, lecturas };
}

function proyecto(yaml) {
  const dir = mkdtempSync(join(tmpdir(), 'forge-integ-'));
  mkdirSync(join(dir, '.sdd'), { recursive: true });
  if (yaml !== null) writeFileSync(join(dir, '.sdd', 'sdd.config.yaml'), yaml, 'utf8');
  return dir;
}

const VALIDA = `motor:
  modo: ciclo
integraciones:
  github_modo: proponer
  github_token_env: FORGE_GITHUB_TOKEN
  github_destinos: org/repo, org/otro-repo   # lista cerrada
  gitlab_modo: solo_lectura
  gitlab_host: gitlab.empresa.com
  gitlab_token_env: FORGE_GITLAB_TOKEN
  gitlab_destinos: grupo/sub/proyecto
  jira_modo: comentar
  jira_sitio: ejemplo.atlassian.net
  jira_usuario_env: FORGE_JIRA_USUARIO
  jira_token_env: FORGE_JIRA_TOKEN
  jira_destinos: "ABC, XY_Z1"
  topes_operaciones_por_sesion: 7
presupuesto:
  tope_usd: 3
`;

/** Mensaje de error de la configuración, o falla el test. */
function problemas(yaml) {
  try { interpretarIntegraciones(yaml); } catch (e) {
    assert.ok(e instanceof ErrorConfigIntegraciones, `error inesperado: ${e}`);
    return { mensaje: e.message, lista: e.problemas };
  }
  assert.fail('debía rechazar la configuración');
}

const con = (lineas) => `integraciones:\n${lineas.map((l) => `  ${l}`).join('\n')}\n`;

describe('F1.2 config: sin sección o apagado, nada se lee', () => {
  test('sin archivo de configuración: todo apagado y cero lecturas del entorno', () => {
    const { env, lecturas } = entornoVigilado({ FORGE_GITHUB_TOKEN: 'x' });
    const cfg = leerConfigIntegraciones(proyecto(null), { env });
    assert.equal(cfg.presente, false);
    assert.equal(cfg.activa, false);
    for (const p of Object.values(cfg.proveedores)) assert.equal(p.modo, 'apagado');
    assert.equal(cfg.topes.operacionesPorSesion, 20);
    assert.deepEqual(lecturas, []);
  });

  test('archivo con otras secciones y sin integraciones: apagado', () => {
    const cfg = interpretarIntegraciones('motor:\n  modo: ciclo\n');
    assert.equal(cfg.presente, false);
    assert.equal(cfg.activa, false);
  });

  test('con todo apagado explícito, activa es false y el entorno no se toca', () => {
    const { lecturas } = entornoVigilado();
    const cfg = interpretarIntegraciones(con(['github_modo: apagado', 'gitlab_modo: apagado', 'jira_modo: apagado']));
    assert.equal(cfg.presente, true);
    assert.equal(cfg.activa, false);
    assert.deepEqual(lecturas, []);
  });

  test('un proveedor sin modo está apagado (el modo por defecto es apagado)', () => {
    const cfg = interpretarIntegraciones(con(['github_token_env: FORGE_GITHUB_TOKEN', 'github_destinos: org/repo']));
    assert.equal(cfg.proveedores.github.modo, 'apagado');
    assert.equal(cfg.activa, false);
    assert.match(cfg.avisos.join('\n'), /github_modo/);
  });

  test('leerConfigCiclo no cambia con o sin la sección (el lector existente no se rompe)', () => {
    const sin = leerConfigCiclo(proyecto('motor:\n  modo: ciclo\npresupuesto:\n  tope_usd: 3\n'));
    const con_ = leerConfigCiclo(proyecto(VALIDA));
    assert.deepEqual(con_, sin);
  });
});

describe('F1.2 config: sección válida', () => {
  test('se leen los tres proveedores, los destinos y el tope', () => {
    const cfg = interpretarIntegraciones(VALIDA);
    assert.equal(cfg.presente, true);
    assert.equal(cfg.activa, true);
    assert.deepEqual(cfg.proveedores.github, {
      nombre: 'github', modo: 'proponer', host: 'api.github.com', tokenEnv: 'FORGE_GITHUB_TOKEN', destinos: ['org/repo', 'org/otro-repo'],
    });
    assert.equal(cfg.proveedores.gitlab.host, 'gitlab.empresa.com');
    assert.deepEqual(cfg.proveedores.gitlab.destinos, ['grupo/sub/proyecto']);
    assert.equal(cfg.proveedores.jira.host, 'ejemplo.atlassian.net');
    assert.equal(cfg.proveedores.jira.usuarioEnv, 'FORGE_JIRA_USUARIO');
    assert.deepEqual(cfg.proveedores.jira.destinos, ['ABC', 'XY_Z1']);
    assert.equal(cfg.topes.operacionesPorSesion, 7);
  });

  test('leerConfigIntegraciones lee el archivo del proyecto; del entorno solo la política del usuario, nunca un token', () => {
    const { env, lecturas } = entornoVigilado({ FORGE_GITHUB_TOKEN: 'x' });
    const cfg = leerConfigIntegraciones(proyecto(VALIDA), { env });
    assert.equal(cfg.activa, true);
    assert.deepEqual([...lecturas].sort(), ['FORGE_INTEGRACIONES_DESTINOS', 'FORGE_INTEGRACIONES_ESCRITURA', 'FRAGUA_INTEGRACIONES_DESTINOS', 'FRAGUA_INTEGRACIONES_ESCRITURA']);
  });

  test('gitlab sin host usa gitlab.com; un puerto escrito de forma explícita se admite', () => {
    const a = interpretarIntegraciones(con(['gitlab_modo: solo_lectura', 'gitlab_token_env: FORGE_T', 'gitlab_destinos: g/p']));
    assert.equal(a.proveedores.gitlab.host, 'gitlab.com');
    const b = interpretarIntegraciones(con(['gitlab_modo: solo_lectura', 'gitlab_host: git.empresa.com:443', 'gitlab_token_env: FORGE_T', 'gitlab_destinos: g/p']));
    assert.equal(b.proveedores.gitlab.host, 'git.empresa.com:443');
  });

  test('el tope por defecto es 20', () => {
    const cfg = interpretarIntegraciones(con(['github_modo: apagado']));
    assert.equal(cfg.topes.operacionesPorSesion, 20);
  });
});

describe('F1.2 config: rechazos', () => {
  test('modo desconocido', () => {
    const r = problemas(con(['github_modo: escribir']));
    assert.match(r.mensaje, /github_modo/);
    assert.match(r.mensaje, /apagado, solo_lectura, comentar, proponer/);
  });

  test('destinos con comodín', () => {
    for (const d of ['org/*', '*', 'org/rep?', 'org/{a,b}', '*/repo', 'org/[ab]']) {
      const r = problemas(con(['github_modo: solo_lectura', 'github_token_env: T', `github_destinos: ${d}`]));
      assert.match(r.mensaje, /github_destinos/, d);
    }
    problemas(con(['jira_modo: solo_lectura', 'jira_sitio: a.atlassian.net', 'jira_usuario_env: U', 'jira_token_env: T', 'jira_destinos: AB*']));
  });

  test('formato de destino por proveedor', () => {
    const base = (prov, extra, destino) => con([`${prov}_modo: solo_lectura`, `${prov}_token_env: T`, ...extra, `${prov}_destinos: ${destino}`]);
    for (const d of ['org', 'org/repo/extra', 'org/..', '../x', '-org/repo']) problemas(base('github', [], d));
    for (const d of ['solo', 'grupo/../x', 'grupo//p']) problemas(base('gitlab', [], d));
    const jira = ['jira_sitio: a.atlassian.net', 'jira_usuario_env: U'];
    for (const d of ['abc', 'A', '1AB', 'AB-12', 'org/repo']) problemas(base('jira', jira, d));
  });

  test('hosts: sin esquema, sin ruta, sin credenciales; HTTPS siempre', () => {
    const malos = ['https://gitlab.com', 'http://gitlab.com', 'gitlab.com/api', 'user@gitlab.com', 'gitlab.com?x=1', 'gitlab.com:abc', 'gitlab.com:0', '10.0.0.5', 'localhost', 'gitlab', 'git lab.com', '[::1]', 'ftp://gitlab.com'];
    for (const h of malos) {
      const r = problemas(con(['gitlab_modo: solo_lectura', `gitlab_host: ${h}`, 'gitlab_token_env: T', 'gitlab_destinos: g/p']));
      assert.match(r.mensaje, /gitlab_host/, h);
    }
    const r = problemas(con(['gitlab_modo: solo_lectura', 'gitlab_host: http://gitlab.com', 'gitlab_token_env: T', 'gitlab_destinos: g/p']));
    assert.match(r.mensaje, /HTTPS/);
  });

  test('jira_sitio debe ser un sitio de Jira Cloud', () => {
    const r = problemas(con(['jira_modo: solo_lectura', 'jira_sitio: jira.empresa.com', 'jira_usuario_env: U', 'jira_token_env: T', 'jira_destinos: ABC']));
    assert.match(r.mensaje, /jira_sitio/);
  });

  test('un valor de *_token_env que parece un token literal impide empezar y NO se imprime', () => {
    const literales = [
      'ghp_' + 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8',
      'github_pat_' + '11ABCDEFG0abcdefghijklmnopqrstuvwxyz0123456789',
      'glpat-' + 'abcdefghijklmnopqrstuvwx',
      'sk-ant-' + 'abcdefghijklmnopqrstuvwxyz0123',
      'AKIA' + 'ABCDEFGHIJKLMNOP',
      'Xk3pQ9zT7mWv2LrB8nYc5HdJ4sFa1GuE',
    ];
    for (const literal of literales) {
      const yaml = con(['github_modo: solo_lectura', `github_token_env: ${literal}`, 'github_destinos: org/repo']);
      const r = problemas(yaml);
      assert.match(r.mensaje, /github_token_env/);
      assert.match(r.mensaje, /token literal/);
      assert.ok(!r.mensaje.includes(literal), 'el mensaje no puede llevar el valor');
      for (const p of r.lista) assert.ok(!p.includes(literal));
      assert.ok(!r.mensaje.includes(literal.slice(0, 12)), 'ni siquiera un trozo');
    }
    // También con el modo apagado: un token en un archivo del proyecto es un error igual
    problemas(con(['jira_modo: apagado', 'jira_token_env: ghp_' + 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8']));
  });

  test('un nombre de variable con caracteres no válidos tampoco se imprime', () => {
    const r = problemas(con(['github_modo: solo_lectura', 'github_token_env: mi token con espacios!', 'github_destinos: org/repo']));
    assert.match(r.mensaje, /github_token_env/);
    assert.ok(!r.mensaje.includes('mi token con espacios'));
  });

  test('claves desconocidas dentro de la sección son un error, no se ignoran', () => {
    const r = problemas(con(['github_mode: solo_lectura']));
    assert.match(r.mensaje, /github_mode/);
    problemas(con(['gitlab_modo: apagado', 'proveedor_extra: x']));
    problemas(con(['topes: 3']));
  });

  test('anidamiento, claves sin valor, duplicados y valor en línea', () => {
    const anidado = problemas('integraciones:\n  github:\n    modo: solo_lectura\n');
    assert.match(anidado.mensaje, /línea 2|línea 3/);
    problemas(con(['github_modo:']));
    problemas(con(['github_modo: apagado', 'github_modo: proponer']));
    problemas('integraciones: {github_modo: apagado}\n');
    problemas('integraciones:\n    github_modo: apagado\n');
  });

  test('un proveedor activo exige destinos y token_env (no hay «todos»)', () => {
    let r = problemas(con(['github_modo: solo_lectura', 'github_token_env: T']));
    assert.match(r.mensaje, /github_destinos/);
    r = problemas(con(['github_modo: solo_lectura', 'github_destinos: org/repo']));
    assert.match(r.mensaje, /github_token_env/);
    r = problemas(con(['jira_modo: solo_lectura', 'jira_sitio: a.atlassian.net', 'jira_token_env: T', 'jira_destinos: ABC']));
    assert.match(r.mensaje, /jira_usuario_env/);
    r = problemas(con(['jira_modo: solo_lectura', 'jira_usuario_env: U', 'jira_token_env: T', 'jira_destinos: ABC']));
    assert.match(r.mensaje, /jira_sitio/);
  });

  test('topes: entero positivo y razonable', () => {
    for (const v of ['0', '-1', 'abc', '1.5', '100000']) {
      const r = problemas(con(['github_modo: apagado', `topes_operaciones_por_sesion: ${v}`]));
      assert.match(r.mensaje, /topes_operaciones_por_sesion/);
    }
  });

  test('se informan todos los problemas a la vez', () => {
    const r = problemas(con(['github_modo: escribir', 'gitlab_host: http://x.com', 'jira_modo: nada']));
    assert.ok(r.lista.length >= 3);
  });

  test('el valor de un modo mal escrito no se imprime sin límite ni sin redactar', () => {
    const raro = 'ghp_' + 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8';
    const r = problemas(con([`github_modo: ${raro}`]));
    assert.ok(!r.mensaje.includes(raro));
  });
});

describe('F1.2 config: credenciales y destinos', () => {
  test('leerToken lee solo la variable nombrada, y solo si el proveedor está activo', () => {
    const cfg = interpretarIntegraciones(VALIDA);
    const { env, lecturas } = entornoVigilado({ FORGE_GITHUB_TOKEN: 'valor-secreto', OTRA: 'no', FORGE_INTEGRACIONES_HOSTS: 'gitlab.empresa.com' });
    assert.equal(leerToken(cfg.proveedores.github, env), 'valor-secreto');
    assert.deepEqual([...lecturas].sort(), ['FORGE_GITHUB_TOKEN', 'FRAGUA_GITHUB_TOKEN']);   // las dos formas del nombre, y ninguna otra
    assert.equal(leerToken(cfg.proveedores.gitlab, env), null);   // variable no definida
    const apagado = interpretarIntegraciones(con(['github_modo: apagado', 'github_token_env: FORGE_GITHUB_TOKEN']));
    const v2 = entornoVigilado({ FORGE_GITHUB_TOKEN: 'valor-secreto' });
    assert.throws(() => leerToken(apagado.proveedores.github, v2.env), /apagada/);
    assert.deepEqual(v2.lecturas, []);
  });

  test('un token vacío o de solo espacios cuenta como no definido', () => {
    const cfg = interpretarIntegraciones(VALIDA);
    assert.equal(leerToken(cfg.proveedores.github, { FORGE_GITHUB_TOKEN: '   ' }), null);
  });

  test('destinoPermitido compara con la lista exacta, sin comodines ni prefijos', () => {
    const cfg = interpretarIntegraciones(VALIDA);
    assert.equal(destinoPermitido(cfg.proveedores.github, 'org/repo'), true);
    assert.equal(destinoPermitido(cfg.proveedores.github, 'ORG/Repo'), true);       // GitHub no distingue mayúsculas
    assert.equal(destinoPermitido(cfg.proveedores.github, 'org/repo-malo'), false);
    assert.equal(destinoPermitido(cfg.proveedores.github, 'org/repo/../x'), false);
    assert.equal(destinoPermitido(cfg.proveedores.github, 'org'), false);
    assert.equal(destinoPermitido(cfg.proveedores.jira, 'ABC'), true);
    assert.equal(destinoPermitido(cfg.proveedores.jira, 'abc'), false);
    assert.equal(destinoPermitido(cfg.proveedores.gitlab, 'grupo/sub/proyecto'), true);
    const apagado = interpretarIntegraciones(con(['github_modo: apagado', 'github_destinos: org/repo']));
    assert.equal(destinoPermitido(apagado.proveedores.github, 'org/repo'), false);   // apagado: nada es destino
  });
});
