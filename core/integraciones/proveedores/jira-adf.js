/**
 * jira-adf.js — Conversor mínimo entre ADF (Atlassian Document Format) y texto plano
 *
 * Un documento ADF lo escribe cualquiera con acceso al ticket: es una ENTRADA HOSTIL, igual que
 * el texto plano, y además tiene forma de árbol. Reglas:
 *
 *   - sin dependencias, sin red, sin entorno, sin disco: funciones puras;
 *   - `adfATexto` NUNCA lanza por una forma inesperada: devuelve lo que pueda, y recorta con
 *     TOPES de profundidad, de número de nodos y de bytes de salida. El recorrido no recurre más
 *     allá de `maxProfundidad` (acotada a un máximo duro), de modo que una profundidad de 10 000 o
 *     un objeto cíclico construido a mano no pueden agotar la pila;
 *   - bloques de código y citas se convierten en TEXTO; nada se ejecuta ni se interpreta;
 *   - menciones, emojis, enlaces y tarjetas pasan a texto inerte (URL con esquema «hxxp[:]//»),
 *     y los adjuntos (media) no se resuelven: solo queda una nota;
 *   - los nodos desconocidos se ignoran, conservando el texto de sus hijos;
 *   - `textoAAdf` produce SOLO nodos `doc`, `paragraph` y `text`, sin marcas, enlaces, menciones
 *     ni nada activo, sea cual sea el texto de entrada.
 */

/** Topes por defecto de `adfATexto`. */
export const TOPES_ADF = Object.freeze({ maxNodos: 5000, maxProfundidad: 40, maxBytes: 65536 });
/** Techos duros: ni siquiera una petición explícita los supera. */
const DURO = Object.freeze({ maxNodos: 100000, maxProfundidad: 100, maxBytes: 1024 * 1024 });
/** Tope por defecto de `textoAAdf`. */
export const MAX_BYTES_TEXTO_ADF = 16384;

const NOTA_RECORTE = '\n[… contenido recortado por los topes de tamaño]';

const INLINE = new Set(['text', 'hardBreak', 'mention', 'emoji', 'inlineCard', 'status', 'date', 'mediaInline', 'placeholder']);

// Controles (salvo \n y \t), formato (ancho cero, bidi, BOM, etiquetas Unicode), uso privado,
// sustitutos sueltos y no asignados: lo mismo que quita confianza.js.
const INVISIBLES = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}\u3164\u2800\u034F\u115F\u1160\uFFA0\u180E]/gu;

/**
 * Cada tramo de espacios que contiene un salto de línea pasa a ser UN espacio; los demás se conservan.
 * Es lo que hacía una expresión regular de espacios, salto y espacios, que con muchos espacios seguidos
 * es cuadrática (R2a): aquí es un solo recorrido lineal.
 * @param {string} t
 */
function colapsarSaltos(t) {
  if (!t.includes('\n')) return t;
  let salida = '';
  let i = 0;
  const n = t.length;
  while (i < n) {
    if (!/\s/.test(t[i])) {
      let j = i + 1;
      while (j < n && !/\s/.test(t[j])) j++;
      salida += t.slice(i, j);
      i = j;
      continue;
    }
    let j = i;
    let hayNl = false;
    while (j < n && /\s/.test(t[j])) { if (t[j] === '\n') hayNl = true; j++; }
    salida += hayNl ? ' ' : t.slice(i, j);
    i = j;
  }
  return salida;
}

/** @param {string} t */
const limpiar = (t) => t.replace(INVISIBLES, (c) => (c === '\n' || c === '\t' ? c : ''));
/** Una línea, sin invisibles, acotada en caracteres. @param {unknown} v @param {number} max */
const linea = (v, max) => (typeof v === 'string' ? limpiar(v).replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** Esquema inerte: la URL deja de ser destino y pasa a ser texto. @param {unknown} u */
function inerte(u) {
  if (typeof u !== 'string') return '';
  let t = limpiar(u).replace(/\s+/g, '').slice(0, 500);
  t = t.replace(/\b([a-z][a-z0-9+.-]{1,15}):\/\//gi, (_m, e) => `${e.replace(/^http/i, 'hxxp')}[:]//`);
  t = t.replace(/^(javascript|vbscript|data|file|blob|mailto|about):/i, '$1[:]');
  return t;
}

const esObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * @typedef {Object} OpcionesAdfATexto
 * @property {number} [maxNodos]        nodos visitados como máximo
 * @property {number} [maxProfundidad]  niveles de anidamiento que se recorren
 * @property {number} [maxBytes]        bytes UTF-8 de la salida
 */

/** @param {unknown} v @param {number} def @param {number} tope */
function entero(v, def, tope) {
  return Number.isInteger(v) && /** @type {number} */ (v) > 0 ? Math.min(/** @type {number} */ (v), tope) : def;
}

/**
 * Recorta a `maxBytes` sin partir un carácter.
 * @param {string} texto @param {number} maxBytes
 */
function cortarBytes(texto, maxBytes) {
  if (texto.length * 3 <= maxBytes || Buffer.byteLength(texto, 'utf8') <= maxBytes) return texto;
  const b = Buffer.from(texto, 'utf8');
  let fin = Math.max(0, maxBytes);
  while (fin > 0 && (b[fin] & 0xC0) === 0x80) fin--;
  return b.subarray(0, fin).toString('utf8');
}

/**
 * Convierte un documento ADF en texto plano. No lanza nunca.
 * @param {unknown} doc
 * @param {OpcionesAdfATexto} [opciones]
 * @returns {string}
 */
export function adfATexto(doc, opciones = {}) {
  try {
    const o = esObjeto(opciones) ? opciones : {};
    const maxNodos = entero(o.maxNodos, TOPES_ADF.maxNodos, DURO.maxNodos);
    const maxProfundidad = entero(o.maxProfundidad, TOPES_ADF.maxProfundidad, DURO.maxProfundidad);
    const maxBytes = entero(o.maxBytes, TOPES_ADF.maxBytes, DURO.maxBytes);
    const ctx = { nodos: 0, maxNodos, maxProfundidad, restante: maxBytes, truncado: false };
    if (!esObjeto(doc)) return '';
    const texto = nodo(doc, 0, ctx);
    const salida = ctx.truncado ? cortarBytes(texto, Math.max(0, maxBytes - Buffer.byteLength(NOTA_RECORTE, 'utf8'))) + NOTA_RECORTE : cortarBytes(texto, maxBytes);
    return salida;
  } catch {
    // Defensa en profundidad: ninguna forma rara debe propagar una excepción
    return '';
  }
}

/**
 * @typedef {{ nodos: number, maxNodos: number, maxProfundidad: number, restante: number, truncado: boolean }} Ctx
 */

/**
 * Gasta presupuesto de bytes con `texto` y lo devuelve recortado si no cabe.
 * @param {string} texto @param {Ctx} ctx
 */
function gastar(texto, ctx) {
  if (ctx.restante <= 0) { ctx.truncado = true; return ''; }
  const t = cortarBytes(texto, ctx.restante);
  if (t.length < texto.length) ctx.truncado = true;
  ctx.restante -= Buffer.byteLength(t, 'utf8');
  return t;
}

/**
 * Hijos de un nodo, unidos: los inline seguidos sin separador y los bloques por saltos de línea.
 * @param {any} n @param {number} prof @param {Ctx} ctx
 */
function hijos(n, prof, ctx) {
  const c = n.content;
  if (!Array.isArray(c)) return '';
  let salida = '';
  let anteriorInline = null;
  for (let i = 0; i < c.length; i++) {
    if (ctx.truncado && (ctx.restante <= 0 || ctx.nodos >= ctx.maxNodos)) break;
    const h = c[i];
    if (!esObjeto(h)) continue;
    const tipo = typeof h.type === 'string' ? h.type : '';
    const esInline = INLINE.has(tipo);
    const t = nodo(h, prof + 1, ctx);
    if (anteriorInline !== null && !(anteriorInline && esInline)) salida += '\n';
    salida += t;
    anteriorInline = esInline;
  }
  return salida;
}

/** @param {string} t @param {string} prefijo @param {string} [primero] */
function prefijar(t, prefijo, primero = prefijo) {
  return t.split('\n').map((l, i) => (i === 0 ? primero : prefijo) + l).join('\n');
}

/**
 * Texto de un nodo. Recursivo, pero la recursión está acotada por `maxProfundidad`.
 * @param {any} n @param {number} prof @param {Ctx} ctx
 * @returns {string}
 */
function nodo(n, prof, ctx) {
  if (ctx.truncado && ctx.restante <= 0) return '';
  if (prof > ctx.maxProfundidad) { ctx.truncado = true; return ''; }
  if (ctx.nodos >= ctx.maxNodos) { ctx.truncado = true; return ''; }
  ctx.nodos++;

  const tipo = typeof n.type === 'string' ? n.type : '';
  const attrs = esObjeto(n.attrs) ? n.attrs : {};

  switch (tipo) {
    case 'text': {
      if (typeof n.text !== 'string') return '';
      let t = limpiar(n.text.length > ctx.restante * 4 + 64 ? n.text.slice(0, ctx.restante * 4 + 64) : n.text);
      if (Array.isArray(n.marks)) {
        for (const m of n.marks.slice(0, 20)) {
          if (esObjeto(m) && m.type === 'link' && esObjeto(m.attrs)) {
            const h = inerte(m.attrs.href);
            if (h) { t += ` (${h})`; break; }
          }
        }
      }
      return gastar(t, ctx);
    }
    case 'hardBreak': return '\n';
    case 'mention': return gastar(`@${linea(attrs.text, 60).replace(/^@/, '') || 'usuario'}`, ctx);
    case 'emoji': return gastar(linea(attrs.text, 40) || linea(attrs.shortName, 40), ctx);
    case 'status': return gastar(`[${linea(attrs.text, 60)}]`, ctx);
    case 'date': {
      const ms = Number(attrs.timestamp);
      const d = Number.isFinite(ms) ? new Date(ms) : null;
      return gastar(d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : '', ctx);
    }
    case 'inlineCard': case 'blockCard': case 'embedCard': {
      const u = inerte(attrs.url);
      return gastar(u ? `[enlace: ${u}]` : '[enlace]', ctx);
    }
    case 'media': case 'mediaInline': case 'mediaSingle': case 'mediaGroup': case 'mediaCard':
      // Los adjuntos no se resuelven ni se siguen; ni siquiera se recorren sus hijos
      return gastar('[adjunto omitido]', ctx);
    case 'rule': return '---';
    case 'paragraph': case 'heading': case 'caption':
      return hijos(n, prof, ctx);
    case 'codeBlock': {
      const partes = [];
      if (Array.isArray(n.content)) {
        for (const h of n.content.slice(0, ctx.maxNodos)) {
          if (ctx.nodos >= ctx.maxNodos) { ctx.truncado = true; break; }
          ctx.nodos++;
          if (esObjeto(h) && h.type === 'text' && typeof h.text === 'string') partes.push(gastar(limpiar(h.text.slice(0, ctx.restante * 4 + 64)), ctx));
          if (ctx.restante <= 0) break;
        }
      }
      const lenguaje = typeof attrs.language === 'string' && /^[A-Za-z0-9_+#-]{1,20}$/.test(attrs.language) ? attrs.language : '';
      return '```' + lenguaje + '\n' + partes.join('') + '\n```';
    }
    case 'blockquote': return prefijar(hijos(n, prof, ctx), '> ');
    case 'bulletList': case 'orderedList': case 'taskList': {
      const items = Array.isArray(n.content) ? n.content : [];
      const inicio = tipo === 'orderedList' && Number.isInteger(attrs.order) && attrs.order >= 0 && attrs.order < 1e6 ? attrs.order : 1;
      const lineas = [];
      let k = 0;
      for (const it of items) {
        if (ctx.truncado && (ctx.restante <= 0 || ctx.nodos >= ctx.maxNodos)) break;
        if (!esObjeto(it)) continue;
        const cuerpo = nodo(it, prof + 1, ctx);
        const marca = tipo === 'bulletList' ? '- ' : tipo === 'orderedList' ? `${inicio + k}. ` : '';
        lineas.push(marca ? prefijar(cuerpo, ' '.repeat(marca.length), marca) : cuerpo);
        k++;
      }
      return lineas.join('\n');
    }
    case 'taskItem': {
      const marca = attrs.state === 'DONE' ? '[x] ' : '[ ] ';
      return prefijar(hijos(n, prof, ctx), '    ', marca);
    }
    case 'table': {
      const filas = Array.isArray(n.content) ? n.content : [];
      const out = [];
      for (const f of filas) {
        if (ctx.truncado && (ctx.restante <= 0 || ctx.nodos >= ctx.maxNodos)) break;
        if (!esObjeto(f)) continue;
        out.push(nodo(f, prof + 1, ctx));
      }
      return out.join('\n');
    }
    case 'tableRow': {
      const celdas = Array.isArray(n.content) ? n.content : [];
      const out = [];
      for (const c of celdas) {
        if (ctx.truncado && (ctx.restante <= 0 || ctx.nodos >= ctx.maxNodos)) break;
        if (!esObjeto(c)) continue;
        out.push(colapsarSaltos(nodo(c, prof + 1, ctx)).trim());
      }
      return out.join(' | ');
    }
    case 'expand': case 'nestedExpand': {
      const titulo = linea(attrs.title, 120);
      const c = hijos(n, prof, ctx);
      return titulo ? `${titulo}\n${c}` : c;
    }
    default:
      // doc, listItem, tableCell, tableHeader, panel, y TODO nodo desconocido: se ignora el nodo y
      // se conserva el texto de sus hijos
      return hijos(n, prof, ctx);
  }
}

/**
 * Convierte texto plano en un documento ADF mínimo y válido: versión 1, tipo `doc`, un párrafo
 * por línea y el texto en nodos `text` sin marcas. Lo que parezca un enlace, una mención o
 * formato queda como texto literal. Acotado en bytes (con una nota al final si recorta).
 * @param {unknown} texto
 * @param {{ maxBytes?: number }} [opciones]
 * @returns {{ type: 'doc', version: 1, content: Array<{ type: 'paragraph', content: Array<{ type: 'text', text: string }> }> }}
 */
export function textoAAdf(texto, opciones = {}) {
  const maxBytes = entero(esObjeto(opciones) ? opciones.maxBytes : undefined, MAX_BYTES_TEXTO_ADF, DURO.maxBytes);
  let t = typeof texto === 'string' ? texto : '';
  // Acota el trabajo antes de empezar
  if (t.length > maxBytes * 4 + 64) t = t.slice(0, maxBytes * 4 + 64);
  t = limpiar(t.replace(/\r\n?|[\u2028\u2029\u0085]/g, '\n'));
  if (Buffer.byteLength(t, 'utf8') > maxBytes) {
    const nota = '\n[… recortado]';
    t = cortarBytes(t, Math.max(0, maxBytes - Buffer.byteLength(nota, 'utf8'))) + nota;
  }
  const content = t.split('\n').map((l) => ({ type: /** @type {'paragraph'} */ ('paragraph'), content: l === '' ? [] : [{ type: /** @type {'text'} */ ('text'), text: l }] }));
  return { type: 'doc', version: 1, content };
}
