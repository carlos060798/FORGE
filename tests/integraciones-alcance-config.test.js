// @ts-check
/**
 * F4.2 — `<proveedor>_alcance`: el alcance declarado del token, texto libre acotado (plan.md §10).
 * GitHub y Jira no permiten consultar el alcance de un token; el proyecto lo declara y `doctor` lo muestra.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { ErrorConfigIntegraciones, interpretarIntegraciones } from '../core/integraciones/config.js';

const base = 'integraciones:\n  github_modo: comentar\n  github_token_env: FORGE_GITHUB_TOKEN\n  github_destinos: org/repo\n';

describe('F4.2 — <proveedor>_alcance', () => {
  test('se lee tal cual y queda en la configuración del proveedor', () => {
    const c = interpretarIntegraciones(`${base}  github_alcance: Issues: read/write; Pull requests: write; repositorio org/repo\n`);
    assert.equal(c.proveedores.github.alcance, 'Issues: read/write; Pull requests: write; repositorio org/repo');
    assert.equal(c.proveedores.gitlab.alcance, undefined);
  });

  test('es opcional y puede darse también con el proveedor apagado', () => {
    assert.equal(interpretarIntegraciones(base).proveedores.github.alcance, undefined);
    const c = interpretarIntegraciones('integraciones:\n  jira_alcance: solo comentar\n');
    assert.equal(c.proveedores.jira.alcance, 'solo comentar');
    assert.equal(c.activa, false);
  });

  test('un texto demasiado largo, o que parece contener un secreto, se rechaza sin imprimirlo', () => {
    const secreto = 'ghp_' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8';
    for (const valor of ['x'.repeat(201), `token de ${secreto}`]) {
      /** @type {any} */
      let e;
      try { interpretarIntegraciones(`${base}  github_alcance: ${valor}\n`); } catch (x) { e = x; }
      assert.ok(e instanceof ErrorConfigIntegraciones, valor.slice(0, 20));
      assert.match(e.message, /github_alcance/);
      assert.ok(!e.message.includes(secreto), 'no repite el valor');
    }
  });

  test('una clave desconocida lista también las nuevas claves válidas', () => {
    /** @type {any} */
    let e;
    try { interpretarIntegraciones('integraciones:\n  github_rol: x\n'); } catch (x) { e = x; }
    assert.ok(e instanceof ErrorConfigIntegraciones);
    assert.match(e.message, /github_alcance/);
    assert.match(e.message, /gitlab_alcance/);
    assert.match(e.message, /jira_alcance/);
  });
});
