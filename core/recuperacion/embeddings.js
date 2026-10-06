/**
 * embeddings.js — Funciones que convierten texto en vectores (memoria semántica, S3)
 *
 * Un embedder es `{ nombre, dimensiones, embed(textos: string[]) => Promise<number[][]> }`.
 * Los vectores devueltos están normalizados (norma 1): la similitud es un producto escalar.
 *
 * Hay dos:
 *  - `hash`: local, sin red y sin dependencias. Es **léxico**, no semántico: dos textos se
 *    parecen si comparten palabras (se separan camelCase y snake_case), no si significan lo
 *    mismo. Sirve para encontrar código relacionado por nombres, y es lo único que se puede
 *    probar sin un servicio. No debe presentarse como «embeddings reales».
 *  - `ollama`: llama a un servidor de Ollama local (`/api/embeddings`). Los vectores sí son
 *    semánticos. Las peticiones solo van a la dirección indicada (por defecto 127.0.0.1).
 */

const DIMENSIONES_HASH = 256;

/** FNV-1a de 32 bits. */
function fnv1a(texto) {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Palabras en minúscula; `getUserName` y `get_user_name` dan lo mismo. */
export function tokenizar(texto) {
  return texto
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9áéíóúñü]+/)
    .filter((t) => t.length >= 2 && t.length <= 40);
}

/** @param {number[]} v */
function normalizar(v) {
  let s = 0;
  for (const x of v) s += x * x;
  const n = Math.sqrt(s);
  return n === 0 ? v : v.map((x) => x / n);
}

/** @returns {{ nombre: string, dimensiones: number, embed: (textos: string[]) => Promise<number[][]> }} */
export function embedderHash() {
  return {
    nombre: 'hash',
    dimensiones: DIMENSIONES_HASH,
    async embed(textos) {
      return textos.map((texto) => {
        const v = new Array(DIMENSIONES_HASH).fill(0);
        const frecuencias = new Map();
        const tokens = tokenizar(texto);
        for (const t of tokens) frecuencias.set(t, (frecuencias.get(t) ?? 0) + 1);
        // Pares de palabras seguidas: dan algo de orden sin crecer
        for (let i = 0; i + 1 < tokens.length; i++) {
          const par = tokens[i] + '_' + tokens[i + 1];
          frecuencias.set(par, (frecuencias.get(par) ?? 0) + 0.5);
        }
        for (const [t, f] of frecuencias) {
          const h = fnv1a(t);
          const signo = (h & 0x80000000) === 0 ? 1 : -1;
          v[h % DIMENSIONES_HASH] += signo * (1 + Math.log(f + 0.5));
        }
        return normalizar(v);
      });
    },
  };
}

/**
 * @param {{ modelo?: string, host?: string, fetch?: typeof fetch, timeoutMs?: number }} [opciones]
 */
export function embedderOllama(opciones = {}) {
  const host = (opciones.host ?? process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434').replace(/\/+$/, '');
  const modelo = opciones.modelo ?? 'nomic-embed-text';
  const peticion = opciones.fetch ?? fetch;
  return {
    nombre: 'ollama:' + modelo,
    dimensiones: 0,   // lo fija el modelo; el índice lo anota con el primer vector
    async embed(textos) {
      const salida = [];
      for (const prompt of textos) {
        const ctl = new AbortController();
        const reloj = setTimeout(() => ctl.abort(), opciones.timeoutMs ?? 30_000);
        let r;
        try {
          r = await peticion(host + '/api/embeddings', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: modelo, prompt }), signal: ctl.signal,
          });
        } catch (e) {
          throw new Error('Ollama no responde en ' + host + ': ' + (e instanceof Error ? e.message : e));
        } finally {
          clearTimeout(reloj);
        }
        if (!r.ok) throw new Error('Ollama devolvió ' + r.status + ' para el modelo ' + modelo + ' (¿está descargado?)');
        const json = /** @type {any} */ (await r.json());
        if (!Array.isArray(json.embedding) || json.embedding.length === 0 || json.embedding.some((x) => typeof x !== 'number')) {
          throw new Error('Ollama no devolvió un vector válido');
        }
        salida.push(normalizar(json.embedding));
      }
      return salida;
    },
  };
}

/**
 * @param {string} [nombre]  'hash' (por defecto) o 'ollama'
 * @param {{ modelo?: string, host?: string, fetch?: typeof fetch }} [opciones]
 */
export function crearEmbedder(nombre = 'hash', opciones = {}) {
  if (nombre === 'hash') return embedderHash();
  if (nombre === 'ollama') return embedderOllama(opciones);
  throw new Error('Embedder desconocido: "' + nombre + '". Disponibles: hash, ollama');
}

/** Similitud del coseno de dos vectores ya normalizados. */
export function similitud(a, b) {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}
