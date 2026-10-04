/**
 * servidor.js — API HTTP local para lanzar y decidir tareas del ciclo verificado
 * (spec 2026-10-03-api-http, ADR-13)
 *
 * No es el servidor del panel (ui/server.js): aquel es de solo lectura y responde con
 * `Access-Control-Allow-Origin: *`. Esta API ESCRIBE, así que:
 *   - solo escucha en 127.0.0.1;
 *   - exige un token (Authorization: Bearer) en toda petición;
 *   - rechaza cualquier petición con cabecera Origin (un navegador la envía; un cliente de línea de comandos no)
 *     y cualquier Host que no sea el propio, contra páginas web y contra DNS rebinding;
 *   - no emite cabeceras CORS ni atiende OPTIONS;
 *   - solo lanza el ciclo verificado (`--motor ciclo`): nunca el modo clásico, que ejecutaría en el equipo
 *     el código que escribió un modelo.
 *
 * Cada ejecución es un proceso `forge run|resume`, igual que desde la terminal.
 */

import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CicloVerificado, RESULTADOS_FINALES, sesionActual } from '../ciclo/index.js';
import { cola } from '../ciclo/redactar.js';
import { createStateStore } from '../state-store.js';
import { PipelineStateMachine } from '../state-machine.js';
import { EventLog } from '../event-log.js';

const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'cli', 'index.js');
const MAX_CUERPO = 64 * 1024;
const ID = /^\w[\w.-]{0,63}$/;
const DECISIONES = ['continuar', 'aceptar', 'abortar'];

/** @param {string} a @param {string} b */
function igual(a, b) {
  const x = Buffer.from(a); const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Lanzador por defecto: un proceso `forge ...` en el proyecto.
 * @param {string} cwd @param {string[]} args
 * @returns {{ terminada: Promise<{ codigo: number|null, salida: string }> }}
 */
export function lanzarCli(cwd, args) {
  const proc = spawn(process.execPath, [CLI, ...args, '--cwd', cwd], { cwd, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let salida = '';
  const juntar = (d) => { salida = (salida + d).slice(-64 * 1024); };
  proc.stdout.on('data', juntar);
  proc.stderr.on('data', juntar);
  const terminada = new Promise((resolver) => {
    proc.on('error', (e) => resolver({ codigo: null, salida: salida + `\n${e.message}` }));
    proc.on('close', (codigo) => resolver({ codigo, salida }));
  });
  return { terminada };
}

/** Valida la lista de tareas que llega por HTTP; devuelve un texto con el problema, o null. */
export function validarTareas(tareas) {
  if (!Array.isArray(tareas) || tareas.length === 0 || tareas.length > 200) return '"tareas" debe ser una lista de 1 a 200 tareas';
  const ids = new Set();
  for (const t of tareas) {
    if (!t || typeof t !== 'object' || Array.isArray(t)) return 'cada tarea debe ser un objeto';
    if (typeof t.id !== 'string' || !ID.test(t.id)) return 'el id de una tarea debe ser texto de letras, números, punto y guion (1-64)';
    if (ids.has(t.id)) return `id repetido: ${t.id}`;
    ids.add(t.id);
    if (typeof t.agente !== 'string' || !/^[\w-]{1,64}$/.test(t.agente)) return `la tarea ${t.id} necesita "agente"`;
    if (typeof t.prompt !== 'string' || t.prompt.length === 0 || t.prompt.length > 20_000) return `la tarea ${t.id} necesita "prompt" de hasta 20000 caracteres`;
    if (t.archivos?.some?.((x) => typeof x === 'string' && (path.isAbsolute(x) || /^[a-zA-Z]:/.test(x) || x.split(/[\\/]/).includes('..')))) return `"archivos" de ${t.id} no admite rutas absolutas ni ".."`;
    for (const campo of ['dependencias', 'archivos']) {
      if (t[campo] !== undefined && (!Array.isArray(t[campo]) || t[campo].length > 100 || t[campo].some((x) => typeof x !== 'string' || x.length > 512))) return `"${campo}" de ${t.id} debe ser una lista de textos`;
    }
    const extra = Object.keys(t).filter((k) => !['id', 'agente', 'prompt', 'dependencias', 'archivos'].includes(k));
    if (extra.length > 0) return `campos desconocidos en ${t.id}: ${extra.join(', ')}`;
  }
  return null;
}

/**
 * @param {{ cwd: string, token?: string, lanzar?: typeof lanzarCli }} opciones
 */
export function crearServidorApi(opciones) {
  const cwd = path.resolve(opciones.cwd);
  const token = opciones.token ?? randomBytes(32).toString('hex');
  const lanzar = opciones.lanzar ?? lanzarCli;
  /** @type {Map<string, any>} */
  const ejecuciones = new Map();
  let activa = null;
  let permitidos = new Set();
  let n = 0;

  const responder = (res, estado, cuerpo) => {
    res.writeHead(estado, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(JSON.stringify(cuerpo));
  };
  const fallo = (res, estado, mensaje) => responder(res, estado, { error: mensaje });

  async function leerJson(req) {
    if (!/^application\/json\b/i.test(req.headers['content-type'] ?? '')) return { error: [415, 'El Content-Type debe ser application/json'] };
    let total = 0; const trozos = [];
    for await (const t of req) {
      total += t.length;
      if (total > MAX_CUERPO) return { error: [413, `El cuerpo supera ${MAX_CUERPO / 1024} KB`] };
      trozos.push(t);
    }
    try { return { valor: JSON.parse(Buffer.concat(trozos).toString('utf8') || '{}') }; } catch { return { error: [400, 'JSON no válido'] }; }
  }

  function iniciar(tipo, args, extra = {}, alTerminar = () => {}) {
    if (activa) return null;
    const id = `e${++n}-${randomBytes(4).toString('hex')}`;
    const registro = { id, tipo, estado: 'en_curso', codigoSalida: null, salida: '', iniciada: new Date().toISOString(), terminada: null, ...extra };
    ejecuciones.set(id, registro);
    activa = id;
    lanzar(cwd, args).terminada.then(({ codigo, salida }) => {
      registro.estado = 'terminada';
      registro.codigoSalida = codigo;
      registro.salida = cola(salida, 8192);
      registro.terminada = new Date().toISOString();
    }).catch((e) => {
      registro.estado = 'terminada';
      registro.salida = `Error al lanzar: ${e instanceof Error ? e.message : e}`;
      registro.terminada = new Date().toISOString();
    }).finally(() => { alTerminar(); if (activa === id) activa = null; });
    return registro;
  }

  function estadoDelProyecto() {
    const store = createStateStore(cwd);
    const fsm = new PipelineStateMachine(store, new EventLog(path.join(cwd, '.sdd')));
    const sesion = sesionActual(cwd);
    let tareas = []; let gasto = null;
    if (sesion) {
      const ciclo = new CicloVerificado(/** @type {any} */ ({ cwd, runId: sesion.runId }));
      tareas = ciclo.resumen().map((t) => ({
        id: t.taskId, iteracion: t.iteracion, maxIteraciones: t.maxIteraciones,
        situacion: RESULTADOS_FINALES.includes(t.resultado) ? t.resultado : (t.revision && !t.revision.decision ? 'espera_decision' : 'en_curso'),
        motivoRevision: t.revision && !t.revision.decision ? t.revision.motivo : null,
        detalleRevision: t.revision && !t.revision.decision ? (t.revision.detalle ?? null) : null,
      }));
      const g = ciclo.libro.total();
      gasto = { gastado_usd: Number(g.usd.toFixed(6)), tope_usd: ciclo.libro.tope(), llamadas: g.llamadas };
    }
    return { etapa: fsm.currentStep(), sesion: sesion?.runId ?? null, tareas, gasto, ejecucion: activa };
  }

  async function manejar(req, res) {
    // 1. Quién llama: solo clientes que no son un navegador y que se dirigen a nosotros
    if (req.headers.origin !== undefined) return fallo(res, 403, 'Se rechazan las peticiones con cabecera Origin (navegadores)');
    if (!permitidos.has(String(req.headers.host ?? '').toLowerCase())) return fallo(res, 403, 'Host no permitido');

    // 2. Autenticación, antes de decir si la ruta existe
    const m = /^Bearer (\S+)$/.exec(String(req.headers.authorization ?? ''));
    if (!m || !igual(m[1], token)) {
      res.setHeader('WWW-Authenticate', 'Bearer');
      return fallo(res, 401, 'Falta el token o no es válido');
    }

    const url = new URL(req.url ?? '/', 'http://localhost');
    const ruta = url.pathname.replace(/\/+$/, '') || '/';
    const metodo = req.method ?? 'GET';

    if (ruta === '/v1/estado') {
      if (metodo !== 'GET') return fallo(res, 405, 'Método no permitido');
      return responder(res, 200, estadoDelProyecto());
    }

    const g = /^\/v1\/ejecuciones\/([\w.-]+)$/.exec(ruta);
    if (g) {
      if (metodo !== 'GET') return fallo(res, 405, 'Método no permitido');
      const e = ejecuciones.get(g[1]);
      return e ? responder(res, 200, e) : fallo(res, 404, 'No existe esa ejecución');
    }

    if (ruta === '/v1/ejecuciones') {
      if (metodo !== 'POST') return fallo(res, 405, 'Método no permitido');
      const cuerpo = await leerJson(req);
      if (cuerpo.error) return fallo(res, ...cuerpo.error);
      const body = cuerpo.valor;
      if (body === null || typeof body !== 'object' || Array.isArray(body)) return fallo(res, 400, 'El cuerpo debe ser un objeto');
      const desconocidos = Object.keys(body).filter((k) => k !== 'tareas');
      if (desconocidos.length > 0) return fallo(res, 400, `Campos desconocidos: ${desconocidos.join(', ')} (el modo es siempre "ciclo")`);

      const args = ['run', '--motor', 'ciclo'];
      if (body.tareas !== undefined) {
        const problema = validarTareas(body.tareas);
        if (problema) return fallo(res, 400, problema);
        const dir = path.join(cwd, '.sdd', 'motor', 'api');
        fs.mkdirSync(dir, { recursive: true });
        const archivo = path.join(dir, `tareas-${Date.now()}-${randomBytes(3).toString('hex')}.json`);
        fs.writeFileSync(archivo, JSON.stringify(body.tareas), 'utf8');
        args.push('--tasks', archivo);
        const e = iniciar('run', args, {}, () => { try { fs.unlinkSync(archivo); } catch { /* ya no esta */ } });
        return e ? responder(res, 202, e) : (fs.rmSync(archivo, { force: true }), fallo(res, 409, `Ya hay una ejecución en curso (${activa})`));
      }
      const e = iniciar('run', args);
      return e ? responder(res, 202, e) : fallo(res, 409, `Ya hay una ejecución en curso (${activa})`);
    }

    if (ruta === '/v1/decisiones') {
      if (metodo !== 'POST') return fallo(res, 405, 'Método no permitido');
      const cuerpo = await leerJson(req);
      if (cuerpo.error) return fallo(res, ...cuerpo.error);
      const b = cuerpo.valor;
      if (b === null || typeof b !== 'object' || Array.isArray(b)) return fallo(res, 400, 'El cuerpo debe ser un objeto');
      const desconocidos = Object.keys(b).filter((k) => !['decision', 'tarea', 'iteracionesExtra', 'presupuestoExtra'].includes(k));
      if (desconocidos.length > 0) return fallo(res, 400, `Campos desconocidos: ${desconocidos.join(', ')}`);
      if (!DECISIONES.includes(b.decision)) return fallo(res, 400, `"decision" debe ser una de: ${DECISIONES.join(', ')}`);
      if (b.tarea !== undefined && (typeof b.tarea !== 'string' || !ID.test(b.tarea))) return fallo(res, 400, '"tarea" no es un identificador válido');
      for (const campo of ['iteracionesExtra', 'presupuestoExtra']) {
        if (b[campo] !== undefined && (typeof b[campo] !== 'number' || !Number.isFinite(b[campo]) || b[campo] < 0 || b[campo] > 1000)) return fallo(res, 400, `"${campo}" debe ser un número entre 0 y 1000`);
      }
      const args = ['resume', '--motor', 'ciclo', '--decision', b.decision];
      if (b.tarea) args.push('--tarea', b.tarea);
      if (b.iteracionesExtra) args.push('--iteraciones-extra', String(b.iteracionesExtra));
      if (b.presupuestoExtra) args.push('--presupuesto-extra', String(b.presupuestoExtra));
      const e = iniciar('decision', args, { decision: b.decision, tarea: b.tarea ?? null });
      return e ? responder(res, 202, e) : fallo(res, 409, `Ya hay una ejecución en curso (${activa})`);
    }

    return fallo(res, 404, 'No existe');
  }

  const server = createServer((req, res) => {
    manejar(req, res).catch((e) => {
      process.stderr.write(`[forge api] error interno: ${e instanceof Error ? e.stack : e}\n`);
      if (!res.headersSent) fallo(res, 500, 'Error interno'); else res.end();
    });
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 10_000;
  server.maxHeadersCount = 50;

  /** @param {number} [puerto] 0 = uno libre */
  const escuchar = (puerto = 3002) => new Promise((resolver, rechazar) => {
    server.once('error', rechazar);
    server.listen(puerto, '127.0.0.1', () => {
      const p = /** @type {import('node:net').AddressInfo} */ (server.address()).port;
      permitidos = new Set([`127.0.0.1:${p}`, `localhost:${p}`]);
      resolver({ puerto: p, url: `http://127.0.0.1:${p}` });
    });
  });

  return { server, token, escuchar, ejecuciones, cerrar: () => new Promise((r) => server.close(() => r(undefined))) };
}
