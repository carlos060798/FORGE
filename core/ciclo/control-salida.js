/**
 * control-salida.js — Revisa por CONTENIDO lo que el agente quiere escribir (spec 2026-10-14)
 *
 * `aplicarArchivos` es el único sitio donde se decide (ruta, rol y ahora contenido). Aquí:
 *
 *   - un SECRETO (formato conocido, valor con aspecto de secreto o clave privada) se RECHAZA. No se
 *     redacta: redactar cambiaría el programa y escondería el problema. El motivo no repite el valor;
 *     sólo dice el tipo y la línea.
 *   - un destino de red NUEVO en código, scripts o configuración pide revisión humana. La documentación
 *     y los comentarios no cuentan (el 62 % de las URL del corpus medido son documentación, spike
 *     destinos.md). «Nuevo» es respecto al mismo archivo antes de escribir y a la política del usuario.
 *   - falla cerrado: un contenido que no se puede analizar (binario, de más de 1 MiB) no se acepta.
 *   - el marcador de dato (<<<forge-dato:…) no es parte de ningún archivo: si el modelo lo copia, no se escribe.
 *
 * Son LISTAS, no un juicio: un secreto sin forma conocida pasa, y una URL construida a trozos
 * (`"ht"+"tps://"`) o leída del entorno no se ve. Es una capa; la contención real es el aislamiento.
 * Funciones puras, sin red, disco ni entorno.
 */

import * as path from 'path';
import { redactarFormatos } from './redactar.js';
import { destinoPermitido } from './politica-destinos.js';
import { MARCA_DATO } from './dato-no-confiable.js';

export const MAX_CONTENIDO_BYTES = 1024 * 1024;

/**
 * @typedef {{ ok: true, avisos: { tipo: 'ip', linea: number }[] }
 *   | { ok: false, tipo: 'secreto' | 'destino' | 'ilegible' | 'marcador_de_dato', regla: string, linea?: number, destino?: string }} ResultadoRevision
 */

const contar = (texto, trozo) => texto.split(trozo).length - 1;
const PREFIJO_MARCADOR = `<<<${MARCA_DATO}:`;

// ── secretos ─────────────────────────────────────────────────────────────────

/** ¿La redacción de esta línea quitó algo? (cada sustitución deja «[REDACTADO»). */
function hayRedaccion(linea) {
  const r = redactarFormatos(linea);
  return r !== linea && contar(r, '[REDACTADO') > contar(linea, '[REDACTADO');
}

/**
 * @param {string} contenido
 * @param {string | null} anterior
 * @returns {{ regla: string, linea?: number } | null}
 */
function buscarSecreto(contenido, anterior) {
  // Camino rápido: si la redacción no cambia nada, no hay nada que mirar
  const completo = redactarFormatos(contenido);
  if (completo === contenido || contar(completo, '[REDACTADO') <= contar(contenido, '[REDACTADO')) return null;

  const lineas = contenido.split(/\r?\n/);
  const previas = new Set(anterior === null ? [] : anterior.split(/\r?\n/));
  const conClave = contenido.includes('PRIVATE KEY-----') && !(anterior ?? '').includes('PRIVATE KEY-----');
  if (conClave && contar(redactarFormatos(contenido), '[REDACTADO: clave privada]') > 0) {
    const i = lineas.findIndex((l) => l.includes('PRIVATE KEY-----'));
    return { regla: 'clave_privada', linea: i + 1 };
  }
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    if (l === '' || previas.has(l)) continue;   // lo que ya estaba en el archivo no es obra del agente
    if (hayRedaccion(l)) return { regla: 'formato_o_valor', linea: i + 1 };
  }
  // Un patrón que cruza líneas: sólo cuenta si el archivo anterior estaba limpio
  if (anterior === null || redactarFormatos(anterior) === anterior) return { regla: 'formato_o_valor' };
  return null;
}

// ── destinos ─────────────────────────────────────────────────────────────────

const EXT_DOCUMENTACION = /\.(?:md|markdown|mdx|txt|rst|adoc|html?|csv|log)$/i;
const EXT_SCRIPT = /\.(?:sh|bash|zsh|fish|ps1|psm1|bat|cmd)$/i;
const EXT_CONFIG = /\.(?:json|jsonc|ya?ml|toml|ini|cfg|conf|properties|xml|tf|env|plist)$/i;
const NOMBRES_SCRIPT = /^(?:makefile|gnumakefile|dockerfile(?:\..*)?|.*\.dockerfile|jenkinsfile|vagrantfile)$/i;

/** @returns {'documentacion' | 'script' | 'configuracion' | 'codigo'} */
function tipoDeArchivo(rutaPosix) {
  const base = path.posix.basename(rutaPosix);
  if (EXT_DOCUMENTACION.test(base)) return 'documentacion';
  if (EXT_SCRIPT.test(base) || NOMBRES_SCRIPT.test(base)) return 'script';
  if (EXT_CONFIG.test(base) || /^\.env(?:\..*)?$/i.test(base)) return 'configuracion';
  return 'codigo';
}

const ESQUEMAS = '(?:https?|wss?|ftps?|sftp|ssh|git|tcp|udp|mqtts?|amqps?|rediss?|postgres(?:ql)?|mysql|mongodb(?:\\+srv)?|grpcs?)';
const RE_URL = new RegExp(`\\b${ESQUEMAS}://(?:[^/\\s'"\`@]*@)?(\\[[0-9a-fA-F:]+\\]|[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?)`, 'gi');

/** Espacios de nombres y esquemas que aparecen en configuración sin ser un destino. */
const ESPACIOS_DE_NOMBRES = new Set([
  'www.w3.org', 'json-schema.org', 'schemas.microsoft.com', 'schemas.xmlsoap.org', 'xmlns.com', 'purl.org',
  'ns.adobe.com', 'schema.org', 'docs.oasis-open.org', 'maven.apache.org', 'www.springframework.org',
  'java.sun.com', 'www.sitemaps.org', 'xml.apache.org', 'www.apple.com',
]);

/** Llamadas de red en código. */
const RE_LLAMADA_RED = /\b(?:fetch|axios|got|superagent|ky|requests?|urllib\d?|urlopen|httpx|aiohttp|http\.(?:get|post|put|request|newrequest|client)|https\.(?:get|request)|net\.(?:connect|createconnection)|createconnection|socket\.connect|websocket|eventsource|xmlhttprequest|httpclient|webclient|restclient|resttemplate|reqwest|curl_init|file_get_contents|open-uri|net::http|dial(?:context)?)\b/i;
/** Comandos de red en scripts. */
const RE_COMANDO_RED = /\b(?:curl|wget|nc|ncat|netcat|ssh|scp|sftp|rsync|telnet|ftp|invoke-webrequest|invoke-restmethod|iwr|irm|git\s+clone|git\s+remote\s+add|git\s+fetch|git\s+pull|git\s+push)\b/i;
const RE_COMANDO_DE_HOST = /\b(ssh|sftp|telnet|nc|ncat|netcat)\s+((?:-\S+\s+(?:\d+\s+)?)*)([^\s|;&<>"']+)/i;
const RE_COMANDO_DE_COPIA = /\b(?:scp|rsync)\b[^\n]*?\s(?:[\w.-]+@)?([A-Za-z0-9][A-Za-z0-9.-]*):[^\s:]/i;

function esLineaDeComentario(linea, tipo) {
  const t = linea.trim();
  if (t === '') return true;
  if (tipo === 'codigo') return /^(?:\/\/|\/\*|\*|#(?!!)|--|;|%)/.test(t) && !/^#\s*include\b/.test(t);
  if (tipo === 'script') return /^(?:#(?!!)|rem\b|::|\/\/)/i.test(t);
  return /^(?:#|;|\/\/|<!--)/.test(t);   // configuración
}

function esReservado(host) {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h === '::1' || h === '0.0.0.0') return true;
  if (/^127\.\d+\.\d+\.\d+$/.test(h)) return true;
  if (/(?:^|\.)(?:example|test|invalid)$/.test(h)) return true;
  if (/(?:^|\.)example\.(?:com|org|net)$/.test(h)) return true;
  return ESPACIOS_DE_NOMBRES.has(h);
}

/** @returns {number[][]} */
function ipv4(texto) {
  /** @type {number[][]} */
  const salida = [];
  for (const m of texto.matchAll(/(?<![\d.])(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?![\d.]|\w)/g)) {
    const o = [m[1], m[2], m[3], m[4]].map(Number);
    if (o.some((n) => n > 255)) continue;
    salida.push(o);
  }
  return salida;
}
/** @param {number[]} octetos */
const esIpPublica = ([a, b]) => !(a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224);

/** Hosts de las URL con esquema de un texto. */
function hostsDeUrl(texto) {
  const hosts = [];
  for (const m of texto.matchAll(RE_URL)) hosts.push(m[1].toLowerCase());
  return hosts;
}

/**
 * Destinos que una línea de código/script/configuración contacta.
 * @param {string} linea @param {string} previa  línea anterior (una llamada puede partirse en dos)
 * @param {'script'|'configuracion'|'codigo'} tipo
 */
function destinosDeLinea(linea, previa, tipo) {
  /** @type {string[]} */
  const hosts = [];
  if (tipo === 'configuracion') return hostsDeUrl(linea);
  if (tipo === 'script') {
    if (!RE_COMANDO_RED.test(linea) || /^\s*(?:echo|printf|write-host|write-output)\b/i.test(linea)) return [];
    hosts.push(...hostsDeUrl(linea));
    const h = RE_COMANDO_DE_HOST.exec(linea);
    if (h) hosts.push(h[3].replace(/^[^@]*@/, '').replace(/:\d+$/, '').replace(/:.*$/, '').toLowerCase());
    const c = RE_COMANDO_DE_COPIA.exec(linea);
    if (c) hosts.push(c[1].toLowerCase());
    return hosts.filter((x) => x !== '' && !x.startsWith('-') && !/^\d+$/.test(x) && !x.startsWith('$'));
  }
  // código: una URL con esquema en una línea que llama a la red (o la sigue de cerca)
  if (RE_LLAMADA_RED.test(linea) || RE_LLAMADA_RED.test(previa)) {
    hosts.push(...hostsDeUrl(linea));
    if (/\b(?:connect|dial|createconnection|socket)\b/i.test(linea)) {
      for (const m of linea.matchAll(/["']((?:[a-z0-9-]+\.)+[a-z]{2,})["']/gi)) hosts.push(m[1].toLowerCase());
    }
  }
  return hosts;
}

/**
 * @param {string} rutaPosix @param {string} contenido @param {string | null} anterior
 * @param {string[]} permitidos
 * @returns {{ destino?: { host: string, linea: number }, avisos: { tipo: 'ip', linea: number }[] }}
 */
function buscarDestinos(rutaPosix, contenido, anterior, permitidos) {
  const tipo = tipoDeArchivo(rutaPosix);
  if (tipo === 'documentacion') return { avisos: [] };
  const conocidos = new Set(anterior === null ? [] : [...hostsDeUrl(anterior), ...ipv4(anterior).map((o) => o.join('.'))]);
  const lineas = contenido.split(/\r?\n/);
  const avisos = [];
  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];
    if (esLineaDeComentario(linea, tipo)) continue;
    for (const host of destinosDeLinea(linea, i > 0 ? lineas[i - 1] : '', tipo)) {
      if (esReservado(host) || conocidos.has(host) || destinoPermitido(host, permitidos)) continue;
      return { destino: { host: host.slice(0, 100), linea: i + 1 }, avisos };
    }
    for (const o of ipv4(linea)) {
      const ip = o.join('.');
      if (esIpPublica(o) && !conocidos.has(ip) && !destinoPermitido(ip, permitidos)) avisos.push({ tipo: /** @type {const} */ ('ip'), linea: i + 1 });
    }
  }
  return { avisos };
}

// ── API ──────────────────────────────────────────────────────────────────────

/**
 * @param {string} rutaPosix      ruta relativa ya validada
 * @param {string} contenido      lo que el agente quiere escribir
 * @param {string | null} anterior  lo que había en ese archivo (null si no existía o no se pudo leer)
 * @param {{ destinos_permitidos?: string[] }} [politica]  política del usuario, fuera del árbol
 * @returns {ResultadoRevision}
 */
export function revisarContenido(rutaPosix, contenido, anterior, politica = {}) {
  if (typeof contenido !== 'string') return { ok: false, tipo: 'ilegible', regla: 'no_es_texto' };
  if (contenido.includes('\u0000')) return { ok: false, tipo: 'ilegible', regla: 'binario' };
  if (Buffer.byteLength(contenido, 'utf8') > MAX_CONTENIDO_BYTES) return { ok: false, tipo: 'ilegible', regla: 'demasiado_grande' };

  if (contar(contenido, PREFIJO_MARCADOR) > contar(anterior ?? '', PREFIJO_MARCADOR)) {
    return { ok: false, tipo: 'marcador_de_dato', regla: 'marcador_copiado' };
  }

  const secreto = buscarSecreto(contenido, anterior);
  if (secreto) return { ok: false, tipo: 'secreto', regla: secreto.regla, ...(secreto.linea !== undefined ? { linea: secreto.linea } : {}) };

  const d = buscarDestinos(rutaPosix, contenido, anterior, politica.destinos_permitidos ?? []);
  if (d.destino) return { ok: false, tipo: 'destino', regla: 'R1', linea: d.destino.linea, destino: d.destino.host };
  return { ok: true, avisos: d.avisos };
}
