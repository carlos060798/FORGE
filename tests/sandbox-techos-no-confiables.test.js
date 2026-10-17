// @ts-check
/**
 * Hallazgo de los spikes de `2026-10-14-puertas-de-calidad-y-evidencia`: `sandbox.cpus`, `memoria`, `pids`,
 * `timeout_s` y `salida_max_bytes` los fijaba el `.sdd/sdd.config.yaml` del proyecto sin ningún techo
 * (se aceptaban 64 CPU, 64 GB y 99999 s). Un repositorio ajeno podía agotar el equipo.
 * Regla: el proyecto puede BAJAR los recursos, no subirlos por encima de un techo; el usuario los sube
 * desde su entorno.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { leerConfigCiclo, limitarSandboxDelProyecto, memoriaEnMb, POR_DEFECTO, TECHOS_SANDBOX } from '../core/ciclo/config.js';

const NOMBRES = ['FRAGUA_SANDBOX_CPUS', 'FORGE_SANDBOX_CPUS', 'FRAGUA_SANDBOX_MEMORIA', 'FORGE_SANDBOX_MEMORIA', 'FRAGUA_SANDBOX_TIMEOUT_S', 'FORGE_SANDBOX_TIMEOUT_S'];

/** @param {string} yaml */
function proyecto(yaml) {
  const cwd = mkdtempSync(join(tmpdir(), 'forge-sandbox-'));
  mkdirSync(join(cwd, '.sdd'));
  writeFileSync(join(cwd, '.sdd', 'sdd.config.yaml'), yaml);
  return cwd;
}

/** Ejecuta sin las variables del usuario (o con las dadas), recogiendo los avisos. */
async function conEntorno(vars, fn) {
  const antes = Object.fromEntries(NOMBRES.map((k) => [k, process.env[k]]));
  for (const k of NOMBRES) delete process.env[k];
  Object.assign(process.env, vars);
  const avisos = [];
  const w = console.warn; console.warn = (...a) => avisos.push(a.join(' '));
  try { return await fn(avisos); } finally {
    console.warn = w;
    for (const k of NOMBRES) { if (antes[k] === undefined) delete process.env[k]; else process.env[k] = antes[k]; }
  }
}

describe('memoriaEnMb', () => {
  test('entiende k, m, g y bytes; rechaza lo demás', () => {
    assert.equal(memoriaEnMb('512m'), 512);
    assert.equal(memoriaEnMb('2g'), 2048);
    assert.equal(memoriaEnMb('2G'), 2048);
    assert.equal(memoriaEnMb('1024k'), 1);
    assert.equal(memoriaEnMb('1048576'), 1);
    for (const mal of ['', 'mucho', '-1g', '1.5.2g', '--privileged']) assert.equal(memoriaEnMb(mal), null, mal);
  });
});

describe('techos del sandbox declarados por el proyecto', () => {
  test('64 CPU, 64 GB, 99999 s y 100000 procesos se recortan al techo, con aviso', async () => {
    const cwd = proyecto('sandbox:\n  cpus: 64\n  memoria: 64g\n  pids: 100000\n  timeout_s: 99999\n  salida_max_bytes: 999999999\n');
    await conEntorno({}, (avisos) => {
      const s = leerConfigCiclo(cwd).sandbox;
      assert.equal(s.cpus, TECHOS_SANDBOX.cpus);
      assert.equal(memoriaEnMb(s.memoria), TECHOS_SANDBOX.memoria_mb);
      assert.equal(s.pids, TECHOS_SANDBOX.pids);
      assert.equal(s.timeout_s, TECHOS_SANDBOX.timeout_s);
      assert.equal(s.salida_max_bytes, TECHOS_SANDBOX.salida_max_bytes);
      assert.ok(avisos.length >= 5, 'avisa de cada recorte');
      assert.ok(avisos.some((a) => a.includes('FRAGUA_SANDBOX_CPUS')), 'dice cómo subirlo');
    });
  });

  test('el proyecto puede bajar los recursos', async () => {
    const cwd = proyecto('sandbox:\n  cpus: 0.5\n  memoria: 256m\n  timeout_s: 30\n');
    await conEntorno({}, (avisos) => {
      const s = leerConfigCiclo(cwd).sandbox;
      assert.equal(s.cpus, 0.5);
      assert.equal(s.memoria, '256m');
      assert.equal(s.timeout_s, 30);
      assert.equal(avisos.length, 0);
    });
  });

  test('un valor dentro del techo pero por encima del defecto se respeta (proyectos que necesitan más)', async () => {
    const cwd = proyecto('sandbox:\n  memoria: 2g\n  timeout_s: 600\n');
    await conEntorno({}, () => {
      const s = leerConfigCiclo(cwd).sandbox;
      assert.equal(s.memoria, '2g');
      assert.equal(s.timeout_s, 600);
    });
  });

  test('valores que no se entienden vuelven al defecto con aviso', async () => {
    const cwd = proyecto('sandbox:\n  memoria: --privileged\n  cpus: 0\n');
    await conEntorno({}, (avisos) => {
      const s = leerConfigCiclo(cwd).sandbox;
      assert.equal(s.memoria, POR_DEFECTO.sandbox.memoria);
      assert.equal(s.cpus, POR_DEFECTO.sandbox.cpus);
      assert.ok(avisos.length >= 2);
    });
  });

  test('el usuario sí puede subirlos desde su entorno, con cualquiera de los dos nombres', async () => {
    const cwd = proyecto('sandbox:\n  cpus: 64\n  memoria: 64g\n');
    await conEntorno({ FRAGUA_SANDBOX_CPUS: '8' }, () => {
      assert.equal(leerConfigCiclo(cwd).sandbox.cpus, 8);
    });
    await conEntorno({ FORGE_SANDBOX_MEMORIA: '16g' }, () => {
      assert.equal(leerConfigCiclo(cwd).sandbox.memoria, '16g');
    });
  });

  test('un valor de entorno que no es un número positivo no sustituye al del archivo', () => {
    const s = limitarSandboxDelProyecto({ ...POR_DEFECTO.sandbox, cpus: 2 }, { avisar: () => {}, env: { FRAGUA_SANDBOX_CPUS: 'muchas' } });
    assert.equal(s.cpus, 2);
  });
});
