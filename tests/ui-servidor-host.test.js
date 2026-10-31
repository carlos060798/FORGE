// @ts-check
/**
 * Servidor del dashboard (ui/server.js): solo atiende a quien se dirige a él por loopback.
 * Sin CORS abierto y con Host validado, una página web ajena no puede leer .sdd/ de la persona
 * (ni por fetch con CORS ni por reasignación de DNS).
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SERVIDOR = join(ROOT, "ui", "server.js");

/** @returns {Promise<{ estado: number | undefined, cabeceras: http.IncomingHttpHeaders, texto: string }>} */
function pedir(puerto, { ruta = "/estado", cabeceras = {} } = {}) {
  return new Promise((res, rej) => {
    const req = http.request({ host: '127.0.0.1', port: puerto, path: ruta, method: 'GET', headers: cabeceras }, (r) => {
      let texto = '';
      r.setEncoding('utf8');
      r.on('data', (d) => { texto += d; });
      r.on('end', () => res({ estado: r.statusCode, cabeceras: r.headers, texto }));
    });
    req.on('error', rej);
    req.end();
  });
}

describe('ui/server.js: frontera de red', () => {
  /** @type {import('node:child_process').ChildProcess} */
  let proc;
  let puerto = 0;
  let dir = '';

  before(async () => {
    dir = mkdtempSync(join(tmpdir(), 'forge-ui-'));
    mkdirSync(join(dir, '.sdd'), { recursive: true });
    writeFileSync(join(dir, '.sdd', 'estado.json'), JSON.stringify({ secreto: 'dato-privado' }));
    proc = spawn(process.execPath, [SERVIDOR, '0'], { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    puerto = await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('El servidor de la interfaz no arrancó')), 15000);
      let salida = '';
      proc.stdout?.on('data', (d) => {
        salida += String(d);
        const m = /localhost:(\d+)/.exec(salida);
        if (m) { clearTimeout(t); res(Number(m[1])); }
      });
      proc.on('exit', () => { clearTimeout(t); rej(new Error('El servidor de la interfaz terminó antes de arrancar: ' + salida)); });
    });
  });

  after(() => {
    proc?.kill();
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* en Windows el proceso puede tardar en soltar la carpeta */ }
  });

  test('con Host de loopback responde y no abre CORS', async () => {
    const r = await pedir(puerto, { cabeceras: { Host: `127.0.0.1:${puerto}` } });
    assert.equal(r.estado, 200);
    assert.equal(r.cabeceras['access-control-allow-origin'], undefined);
  });

  test('con Host de un dominio ajeno (reasignación de DNS) responde 403 y no filtra datos', async () => {
    const r = await pedir(puerto, { cabeceras: { Host: `evil.example:${puerto}` } });
    assert.equal(r.estado, 403);
    assert.ok(!r.texto.includes('dato-privado'));
  });

  test('con Origin de otra página responde 403', async () => {
    const r = await pedir(puerto, { cabeceras: { Host: `127.0.0.1:${puerto}`, Origin: 'https://evil.example' } });
    assert.equal(r.estado, 403);
    assert.ok(!r.texto.includes('dato-privado'));
  });

  test('el flujo de eventos tampoco abre CORS', async () => {
    const cab = await new Promise((res, rej) => {
      const req = http.request({ host: '127.0.0.1', port: puerto, path: '/events', headers: { Host: `localhost:${puerto}` } }, (r) => {
        res(r.headers);
        r.destroy();
      });
      req.on('error', rej);
      req.end();
    });
    assert.equal(cab['access-control-allow-origin'], undefined);
  });
});
