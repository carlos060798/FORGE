/**
 * http.js — Cliente HTTP mínimo para las integraciones, sobre `fetch` de Node
 *
 * Lo usan los adaptadores de proveedor (fase F2) y nada más. Reglas, todas comprobadas ANTES de
 * abrir una conexión salvo las que dependen de la respuesta:
 *
 *   - solo `https:`. El único modo de hablar con un servidor local es el interruptor interno
 *     `_permitirLocal`, que las pruebas usan con un servidor de node:http y que solo admite
 *     `127.0.0.1` y `localhost`. No hay otra forma de llegar a una dirección IP o a un host local;
 *   - el host debe estar en la lista `permitidos` (la de la configuración), escrito sin esquema;
 *   - `redirect: 'manual'`. Una redirección solo se sigue (una vez) si va a la MISMA ruta de un host
 *     permitido, con el mismo esquema, y para un método de solo lectura; al cambiar de host se
 *     descartan las credenciales. Cualquier otra se rechaza sin copiar su destino al mensaje;
 *   - la respuesta se lee con un tope de bytes y la lectura se cancela al superarlo;
 *   - tiempo máximo por intento, que cubre también la lectura del cuerpo;
 *   - reintento acotado (máx. 2) con espera SOLO para 429 y 503, respetando `Retry-After` con tope. Una
 *     escritura (POST/PUT/PATCH) no se reintenta tras un 503 salvo `idempotente: true` (R11);
 *   - nunca borra: DELETE no existe aquí;
 *   - el valor de una credencial no aparece en ningún error: todo mensaje se enmascara con los
 *     valores de las cabeceras enviadas y se pasa por `redactar`.
 *
 * No resuelve DNS por su cuenta: un nombre de la lista que apunte a una dirección interna llegaría
 * hasta allí (límite conocido, ver verificacion.md).
 */

import { redactar } from '../ciclo/redactar.js';
import { motivoHostVetado } from './hosts.js';

const METODOS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH']);
const REDIRECCIONES = new Set([301, 302, 303, 307, 308]);
const REINTENTABLES = new Set([429, 503]);
const MAX_REINTENTOS = 2;
const MAX_RUTA = 2048;
const AGENTE = 'forge-integraciones/1';

export class ErrorHttpIntegracion extends Error {
  /**
   * @param {'host'|'esquema'|'host_no_permitido'|'ruta'|'metodo'|'cabecera'|'redireccion'|'tamano'|'tiempo'|'red'} codigo
   * @param {string} mensaje  ya enmascarado
   */
  constructor(codigo, mensaje) {
    super(mensaje);
    this.name = 'ErrorHttpIntegracion';
    this.codigo = codigo;
  }
}

/**
 * @typedef {Object} RespuestaHttp
 * @property {number} estado
 * @property {boolean} ok
 * @property {Record<string, string>} cabeceras  nombres en minúsculas
 * @property {string} texto
 * @property {number} intentos
 */

/**
 * @typedef {Object} OpcionesPedir
 * @property {string} host                      sin esquema; con :puerto solo si hace falta
 * @property {string} ruta                      empieza por «/»; puede llevar consulta
 * @property {string} [metodo]
 * @property {Record<string, string>} [cabeceras]
 * @property {string | object} [cuerpo]         un objeto se envía como JSON
 * @property {string[]} permitidos
 * @property {number} [maxBytes]                tope de la respuesta (1 MiB por defecto)
 * @property {number} [timeoutMs]               por intento (15 s por defecto)
 * @property {number} [maxEsperaMs]             tope de la espera por Retry-After (10 s por defecto)
 * @property {boolean} [idempotente]           la escritura es idempotente: se puede repetir tras un 503
 * @property {boolean} [_permitirLocal]         solo pruebas: admite 127.0.0.1 y localhost, por http
 * @property {(ms: number) => Promise<void>} [_esperar]  solo pruebas
 */

// ── Enmascarado ─────────────────────────────────────────────────────────────────────────────

/**
 * Valores que no deben aparecer nunca: cada valor de cabecera, y de «Bearer x» / «Basic x» / «token x»
 * el propio `x` y, para Basic, lo decodificado y su parte tras los dos puntos.
 * @param {Record<string, string>} cabeceras
 */
function secretosDe(cabeceras) {
  const s = new Set();
  const anadir = (v) => { if (typeof v === 'string' && v.length >= 4) s.add(v); };
  for (const [nombre, valor] of Object.entries(cabeceras)) {
    if (typeof valor !== 'string') continue;
    if (/^(user-agent|accept|content-type|accept-language|x-github-api-version)$/i.test(nombre)) continue;
    anadir(valor);
    const m = /^\s*(?:bearer|basic|token|negotiate)\s+(.+)$/i.exec(valor);
    if (m) {
      anadir(m[1].trim());
      try {
        const dec = Buffer.from(m[1].trim(), 'base64').toString('utf8');
        if (/^[\x20-\x7E]+$/.test(dec) && dec.includes(':')) {
          anadir(dec);
          for (const parte of dec.split(':')) anadir(parte);
        }
      } catch { /* no era base64 */ }
    }
  }
  return [...s].sort((a, b) => b.length - a.length);
}

/**
 * @param {unknown} texto @param {string[]} secretos
 */
function enmascarar(texto, secretos) {
  let t = String(texto ?? '');
  for (const s of secretos) t = t.split(s).join('[REDACTADO]');
  return redactar(t).slice(0, 300);
}

// ── Validación ──────────────────────────────────────────────────────────────────────────────

const HOST_VALIDO = /^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?(?::\d{1,5})?$/i;
const ESQUEMA = /^[a-z][a-z0-9+.-]*:\/\//i;
const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;

/**
 * @param {unknown} host @param {Set<string>} permit @param {boolean} permitirLocal @param {string[]} secretos
 * @returns {{ host: string, nombre: string, esquema: 'https:'|'http:' }}
 */
function validarHost(host, permit, permitirLocal, secretos) {
  const e = (c, m) => new ErrorHttpIntegracion(c, enmascarar(m, secretos));
  if (typeof host !== 'string' || host === '') throw e('host', 'host vacío o no es texto');
  if (ESQUEMA.test(host)) throw e('esquema', `el host se escribe sin esquema (siempre HTTPS): «${host}»`);
  if (!HOST_VALIDO.test(host)) throw e('host', `host no válido: «${host}»`);
  const h = host.toLowerCase();
  if (!permit.has(h)) throw e('host_no_permitido', `el host «${h}» no está en la lista de permitidos`);
  const nombre = h.replace(/:\d+$/, '');
  const puerto = /:(\d+)$/.exec(h)?.[1];
  if (puerto !== undefined && (Number(puerto) < 1 || Number(puerto) > 65535)) throw e('host', `puerto no válido en «${h}»`);
  const local = nombre === '127.0.0.1' || nombre === 'localhost';
  if (local) {
    if (!permitirLocal) throw e('host_no_permitido', `«${h}» es un host local y solo se admite HTTPS hacia hosts públicos`);
    return { host: h, nombre, esquema: 'http:' };
  }
  if (IPV4.test(nombre) || nombre.includes(':')) throw e('host_no_permitido', `«${h}» es una dirección IP; se usan nombres de host`);
  // R1: vetos que no dependen de ninguna lista (red interna, metadatos, puertos distintos de 443)
  const vetado = motivoHostVetado(h);
  if (vetado !== null) throw e('host_no_permitido', `«${h}» no se admite: ${vetado}`);
  if (permitirLocal) throw e('host_no_permitido', `con el interruptor local solo se admiten 127.0.0.1 y localhost: «${h}»`);
  return { host: h, nombre, esquema: 'https:' };
}

/** @param {unknown} ruta @param {string[]} secretos */
function validarRuta(ruta, secretos) {
  if (typeof ruta !== 'string' || !ruta.startsWith('/') || ruta.length > MAX_RUTA || /[\s\\\u0000-\u001F\u007F]/.test(ruta)) {
    throw new ErrorHttpIntegracion('ruta', enmascarar('la ruta debe empezar por «/», sin espacios, saltos de línea ni «\\»', secretos));
  }
  // R15: nada que la URL normalice a otra ruta del mismo host (puntos codificados, «//», «.» y «..»)
  const camino = ruta.split(/[?#]/)[0];
  if (/%2e|%5c/i.test(camino) || camino.includes('//') || camino.split('/').some((s) => s === '.' || s === '..')) {
    throw new ErrorHttpIntegracion('ruta', enmascarar('la ruta lleva secuencias que la URL normalizaría a otra ruta (%2e, %5c, «//», «.» o «..»)', secretos));
  }
  return ruta;
}

/** @param {Record<string, string>} cabeceras @param {string[]} secretos */
function validarCabeceras(cabeceras, secretos) {
  /** @type {Record<string, string>} */
  const limpias = {};
  for (const [k, v] of Object.entries(cabeceras ?? {})) {
    if (!/^[A-Za-z0-9-]{1,64}$/.test(k) || typeof v !== 'string' || /[\u0000-\u001F\u007F]/.test(v)) {
      throw new ErrorHttpIntegracion('cabecera', enmascarar(`cabecera no válida: «${k}»`, secretos));
    }
    limpias[k.toLowerCase()] = v;
  }
  return limpias;
}

// ── Petición ────────────────────────────────────────────────────────────────────────────────

/** @param {string|null} valor @param {number} tope @returns {number|null} ms, o null si supera el tope; NaN si no se entiende */
function esperaIndicada(valor, tope) {
  if (valor === null || valor === undefined || valor.trim() === '') return NaN;
  const v = valor.trim();
  let ms = NaN;
  if (/^\d+$/.test(v)) ms = Number(v) * 1000;
  else {
    const f = Date.parse(v);
    if (Number.isFinite(f)) ms = Math.max(0, f - Date.now());
  }
  if (!Number.isFinite(ms)) return NaN;
  return ms > tope ? null : ms;
}

/**
 * Un intento (con, como mucho, una redirección permitida).
 * @returns {Promise<{ estado: number, cabeceras: Record<string, string>, texto: string }>}
 */
async function intentar(ctx) {
  const { objetivo, metodo, cabeceras, cuerpo, permit, permitirLocal, maxBytes, timeoutMs, secretos } = ctx;
  const e = (c, m) => new ErrorHttpIntegracion(c, enmascarar(m, secretos));
  const ctl = new AbortController();
  const temporizador = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    let url = objetivo;
    let cab = cabeceras;
    for (let salto = 0; ; salto++) {
      let resp;
      try {
        resp = await fetch(url, { method: metodo, headers: cab, body: cuerpo, redirect: 'manual', signal: ctl.signal });
      } catch (err) {
        if (ctl.signal.aborted) throw e('tiempo', `se agotó el tiempo (${timeoutMs} ms) esperando a ${url.host}`);
        throw e('red', `fallo de red con ${url.host}: ${/** @type {any} */ (err)?.name ?? 'Error'}: ${/** @type {any} */ (err)?.message ?? err}`);
      }

      if (REDIRECCIONES.has(resp.status)) {
        try { await resp.body?.cancel(); } catch { /* ya cerrado */ }
        const destino = redireccionPermitida(resp.headers.get('location'), url, metodo, permit, permitirLocal);
        if (typeof destino === 'string') throw e('redireccion', destino);
        if (salto >= 1) throw e('redireccion', 'más de una redirección seguida');
        if (destino.host !== url.host) {
          // Otro host (aunque esté en la lista): ninguna credencial viaja con él
          cab = Object.fromEntries(Object.entries(cab).filter(([k]) => !/^(authorization|cookie|proxy-authorization|x-.*token.*|private-token)$/i.test(k)));
        }
        url = destino;
        continue;
      }

      const largo = resp.headers.get('content-length');
      if (largo !== null && /^\d+$/.test(largo) && Number(largo) > maxBytes) {
        try { await resp.body?.cancel(); } catch { /* ya cerrado */ }
        throw e('tamano', `la respuesta de ${url.host} anuncia ${largo} bytes; el tope es ${maxBytes}`);
      }

      /** @type {Uint8Array[]} */
      const trozos = [];
      let total = 0;
      if (resp.body) {
        const lector = resp.body.getReader();
        try {
          for (;;) {
            const { done, value } = await lector.read();
            if (done) break;
            total += value.byteLength;
            if (total > maxBytes) {
              try { await lector.cancel(); } catch { /* ya cerrado */ }
              throw e('tamano', `la respuesta de ${url.host} supera el tope de ${maxBytes} bytes; se cortó la lectura`);
            }
            trozos.push(value);
          }
        } catch (err) {
          if (err instanceof ErrorHttpIntegracion) throw err;
          if (ctl.signal.aborted) throw e('tiempo', `se agotó el tiempo (${timeoutMs} ms) leyendo la respuesta de ${url.host}`);
          throw e('red', `fallo de red leyendo la respuesta de ${url.host}: ${/** @type {any} */ (err)?.name ?? 'Error'}`);
        }
      }
      const texto = new TextDecoder('utf-8').decode(Buffer.concat(trozos));
      /** @type {Record<string, string>} */
      const hs = {};
      resp.headers.forEach((v, k) => { hs[k.toLowerCase()] = v; });
      return { estado: resp.status, cabeceras: hs, texto };
    }
  } finally {
    clearTimeout(temporizador);
  }
}

/**
 * @returns {URL | string}  la URL a seguir, o el motivo (sin la URL) del rechazo
 */
function redireccionPermitida(location, actual, metodo, permit, permitirLocal) {
  if (!location) return 'redirección sin destino';
  if (metodo !== 'GET' && metodo !== 'HEAD') return `redirección en una petición ${metodo}: no se repite`;
  let destino;
  try { destino = new URL(location, actual); } catch { return 'redirección con un destino no válido'; }
  if (destino.protocol !== actual.protocol) return 'redirección a otro esquema';
  if (destino.username || destino.password) return 'redirección con credenciales en la URL';
  if (!permit.has(destino.host.toLowerCase())) return `redirección a un host que no está en la lista (${destino.hostname})`;
  if (destino.hostname === 'localhost' || destino.hostname === '127.0.0.1') {
    if (!permitirLocal) return 'redirección a un host local';
  }
  if (destino.pathname !== actual.pathname) return 'redirección a otra ruta: no se sigue';
  return destino;
}

/**
 * Hace una petición a un host permitido. Lanza `ErrorHttpIntegracion` (con `codigo`) ante cualquier
 * violación de las reglas del encabezado. Un estado HTTP de error (404, 500…) NO lanza: se devuelve.
 * @param {OpcionesPedir} o
 * @returns {Promise<RespuestaHttp>}
 */
export async function pedir(o) {
  const cabecerasEntrada = o.cabeceras && typeof o.cabeceras === 'object' ? o.cabeceras : {};
  const secretos = secretosDe(cabecerasEntrada);
  const e = (c, m) => new ErrorHttpIntegracion(c, enmascarar(m, secretos));

  const metodo = String(o.metodo ?? 'GET').toUpperCase();
  if (!METODOS.has(metodo)) throw e('metodo', `método no permitido: ${metodo}`);

  const permit = new Set((Array.isArray(o.permitidos) ? o.permitidos : []).filter((x) => typeof x === 'string').map((x) => x.toLowerCase()));
  const permitirLocal = o._permitirLocal === true;
  const h = validarHost(o.host, permit, permitirLocal, secretos);
  const ruta = validarRuta(o.ruta, secretos);
  const cabeceras = validarCabeceras(cabecerasEntrada, secretos);

  /** @type {URL} */
  let objetivo;
  try { objetivo = new URL(`${h.esquema}//${h.host}${ruta}`); } catch { throw e('ruta', 'la URL resultante no es válida'); }
  if (objetivo.hostname !== h.nombre || objetivo.username || objetivo.password || objetivo.protocol !== h.esquema) {
    throw e('host', 'el host y la ruta no forman una URL de ese host');
  }

  /** @type {string|undefined} */
  let cuerpo;
  if (o.cuerpo !== undefined && o.cuerpo !== null) {
    if (typeof o.cuerpo === 'string') cuerpo = o.cuerpo;
    else {
      cuerpo = JSON.stringify(o.cuerpo);
      if (!('content-type' in cabeceras)) cabeceras['content-type'] = 'application/json; charset=utf-8';
    }
  }
  if (!('user-agent' in cabeceras)) cabeceras['user-agent'] = AGENTE;

  const maxBytes = Number.isFinite(o.maxBytes) && /** @type {number} */ (o.maxBytes) > 0 ? /** @type {number} */ (o.maxBytes) : 1024 * 1024;
  const timeoutMs = Number.isFinite(o.timeoutMs) && /** @type {number} */ (o.timeoutMs) > 0 ? /** @type {number} */ (o.timeoutMs) : 15000;
  const maxEsperaMs = Number.isFinite(o.maxEsperaMs) && /** @type {number} */ (o.maxEsperaMs) >= 0 ? /** @type {number} */ (o.maxEsperaMs) : 10000;
  const esperar = o._esperar ?? ((ms) => new Promise((r) => setTimeout(r, ms)));

  for (let intento = 0; ; intento++) {
    const r = await intentar({ objetivo, metodo, cabeceras, cuerpo, permit, permitirLocal, maxBytes, timeoutMs, secretos });
    // R11: una escritura no se repite tras un 503 (la plataforma pudo aplicarla): solo si quien llama
    // garantiza que es idempotente (`idempotente: true`). Un 429 sí se reintenta: no se procesó.
    const esEscritura = metodo !== 'GET' && metodo !== 'HEAD';
    const reintentable = REINTENTABLES.has(r.estado) && !(esEscritura && r.estado === 503 && o.idempotente !== true);
    if (reintentable && intento < MAX_REINTENTOS) {
      let espera = esperaIndicada(r.cabeceras['retry-after'] ?? null, maxEsperaMs);
      if (espera === null) {
        // El servidor pide esperar más de lo que se tolera: no se insiste y se informa del estado
        return { estado: r.estado, ok: false, cabeceras: r.cabeceras, texto: r.texto, intentos: intento + 1 };
      }
      if (Number.isNaN(espera)) espera = Math.min(maxEsperaMs, 500 * 2 ** intento);
      await esperar(espera);
      continue;
    }
    return { estado: r.estado, ok: r.estado >= 200 && r.estado < 300, cabeceras: r.cabeceras, texto: r.texto, intentos: intento + 1 };
  }
}
