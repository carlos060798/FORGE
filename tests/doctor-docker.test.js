// @ts-check
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { diagnosticarDocker } from '../core/sandbox/diagnostico.js';
import { DockerCli } from '../core/sandbox/docker-cli.js';

describe('forge doctor: Docker siempre comprobado', () => {
  test('disponible: versión, tiempo e imágenes base', async () => {
    let t = 1000;
    const docker = { disponible: async () => { t += 120; return /** @type {const} */ ({ ok: true, version: '27.1.0' }); }, existeImagen: async (i) => i.startsWith('node') };
    const r = await diagnosticarDocker({ docker, ahora: () => t });
    assert.equal(r.ok, true);
    assert.equal(r.ms, 120);
    const texto = r.lineas.map((l) => l.texto).join('\n');
    assert.match(texto, /Docker 27\.1\.0 disponible .*120 ms/);
    assert.match(texto, /node:22-alpine@sha256:[0-9a-f]{64} presente/);
    assert.match(texto, /python:3\.12-slim@sha256:[0-9a-f]{64} no está en el equipo: se descargará/);
    assert.ok(r.lineas.every((l) => !l.problema));
  });

  test('no disponible: un problema y sin consultar imágenes', async () => {
    let consultadas = 0;
    const docker = { disponible: async () => ({ ok: false, error: 'Docker no está disponible: daemon caído' }), existeImagen: async () => { consultadas++; return true; } };
    const r = await diagnosticarDocker({ docker });
    assert.equal(r.ok, false);
    assert.equal(consultadas, 0);
    assert.equal(r.lineas.length, 2, 'el error y la acción (CA-002-02)');
    assert.equal(r.lineas[0].problema, true);
    assert.match(r.lineas[0].texto, /daemon caído.*obligatorio/);
    assert.equal(r.causa, 'no_arrancado');
  });

  test('un Docker que no contesta no cuelga: ejecutor inyectado con tiempo agotado', async () => {
    const llamadas = [];
    const cli = new DockerCli({ timeoutConsultaMs: 50, ejecutar: async (args, o) => { llamadas.push(o?.timeoutMs); return { code: null, stdout: '', stderr: '', timedOut: true }; } });
    const r = await diagnosticarDocker({ docker: cli });
    assert.equal(r.ok, false);
    assert.match(r.lineas[0].texto, /no contestó a tiempo/);
    assert.deepEqual(llamadas, [50, 50]);
  });

  test('respuesta lenta: avisa sin contarlo como problema', async () => {
    let t = 0;
    const docker = { disponible: async () => { t += 3000; return /** @type {const} */ ({ ok: true, version: '26.0.0' }); }, existeImagen: async () => true };
    const r = await diagnosticarDocker({ docker, ahora: () => t });
    assert.ok(r.lineas.some((l) => l.nivel === 'aviso' && /tardó 3000 ms/.test(l.texto) && !l.problema));
  });
});

describe('forge doctor: no instalado frente a no arrancado, y el siguiente paso (spec 2026-11-09-puerta-de-entrada-solo-dev)', () => {
  test('CA-002-02: el ejecutable no existe → no_instalado, con acción de instalar (Windows: Docker Desktop)', async () => {
    const { clasificarFalloDocker } = await import('../core/sandbox/diagnostico.js');
    for (const e of ['Docker no está disponible: spawn docker ENOENT', "Docker no está disponible: 'docker' is not recognized as an internal or external command", 'Docker no está disponible: docker: command not found']) {
      const r = clasificarFalloDocker(e, 'win32');
      assert.equal(r.causa, 'no_instalado', e);
      assert.match(r.accion, /Docker Desktop/);
    }
    assert.doesNotMatch(clasificarFalloDocker('spawn docker ENOENT', 'linux').accion, /docker-desktop/);
  });

  test('CA-002-02: el demonio no responde → no_arrancado, con «abre Docker Desktop» en Windows', async () => {
    const { clasificarFalloDocker } = await import('../core/sandbox/diagnostico.js');
    const win = 'Docker no está disponible: error during connect: open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.';
    const r = clasificarFalloDocker(win, 'win32');
    assert.equal(r.causa, 'no_arrancado');
    assert.match(r.accion, /abre Docker Desktop/);
    const lin = clasificarFalloDocker('Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?', 'linux');
    assert.equal(lin.causa, 'no_arrancado');
    assert.match(lin.accion, /systemctl start docker/);
  });

  test('CA-002-02: el diagnóstico añade la acción como segunda línea y devuelve la causa', async () => {
    const docker = { disponible: async () => ({ ok: false, error: 'Docker no está disponible: error during connect: open //./pipe/dockerDesktopLinuxEngine' }), existeImagen: async () => true };
    const r = await diagnosticarDocker({ docker, plataforma: 'win32' });
    assert.equal(r.ok, false);
    assert.equal(r.causa, 'no_arrancado');
    assert.equal(r.lineas.length, 2);
    assert.equal(r.lineas[0].problema, true);
    assert.match(r.lineas[1].texto, /Solución: .*abre Docker Desktop/);
    assert.ok(!r.lineas[1].problema, 'la acción no cuenta como segundo problema');
  });

  test('tiempo agotado: causa «otro» y la acción nombra --motor clasico', async () => {
    const { clasificarFalloDocker } = await import('../core/sandbox/diagnostico.js');
    const r = clasificarFalloDocker('Docker no contestó a tiempo (5000 ms)', 'linux');
    assert.equal(r.causa, 'otro');
    assert.match(r.accion, /--motor clasico/);
  });

  test('CA-002-01: el siguiente paso nombra los cinco comandos en orden, y sin Docker añade --motor clasico', async () => {
    const { textoSiguientePaso } = await import('../core/sandbox/diagnostico.js');
    const con = textoSiguientePaso({ dockerOk: true }).join('\n');
    const orden = ['/sdd.especificar', '/sdd.planificar', '/sdd.tareas', '/sdd.implementar', '/sdd.estado'];
    let pos = -1;
    for (const c of orden) { const i = con.indexOf(c); assert.ok(i > pos, `${c} en orden`); pos = i; }
    assert.doesNotMatch(con, /--motor clasico/);
    assert.match(con, /PRIMEROS-15-MINUTOS\.md/);
    const sin = textoSiguientePaso({ dockerOk: false }).join('\n');
    assert.match(sin, /--motor clasico/);
    assert.match(sin, /código 4/);
  });
});
