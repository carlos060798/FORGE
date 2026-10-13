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
    assert.match(texto, /node:22-alpine presente/);
    assert.match(texto, /python:3\.12-slim no está en el equipo: se descargará/);
    assert.ok(r.lineas.every((l) => !l.problema));
  });

  test('no disponible: un problema y sin consultar imágenes', async () => {
    let consultadas = 0;
    const docker = { disponible: async () => ({ ok: false, error: 'Docker no está disponible: daemon caído' }), existeImagen: async () => { consultadas++; return true; } };
    const r = await diagnosticarDocker({ docker });
    assert.equal(r.ok, false);
    assert.equal(consultadas, 0);
    assert.equal(r.lineas.length, 1);
    assert.equal(r.lineas[0].problema, true);
    assert.match(r.lineas[0].texto, /daemon caído.*obligatorio/);
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
