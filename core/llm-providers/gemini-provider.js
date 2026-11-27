/**
 * gemini-provider.js — Provider para Gemini (Google), por HTTP directo, sin SDK (ADR-27)
 *
 * Modelos por defecto (niveles FORGE → modelo; se pueden fijar en `modelos:` de sdd.config.yaml, ADR-19):
 *   alto      (opus)   → gemini-3.1-pro-preview
 *   medio     (sonnet) → gemini-3.6-flash
 *   economico (haiku)  → gemini-3.1-flash-lite
 *   — o cualquier identificador directo: "gemini-2.5-flash"
 * Los tres figuran con precio en core/precios.js (tabla oficial consultada el 2026-11-26).
 *
 * Config en sdd.config.yaml:
 *   llm:
 *     provider: gemini          # o «google»
 *     model: medio              # nivel de FORGE o identificador directo
 *   La clave va en el entorno: GEMINI_API_KEY (o GOOGLE_API_KEY). Una clave en el archivo del proyecto se ignora.
 *   GEMINI_BASE_URL (entorno del usuario) cambia el servidor.
 *
 * API: `POST {base}/v1beta/models/{modelo}:generateContent`, clave en la cabecera `x-goog-api-key`.
 * Fuentes (consultadas el 2026-11-26):
 *   https://aistudio.google.com/api-reference/generate-content   (partes, `finishReason`, `usageMetadata`)
 *   https://aistudio.google.com/docs/thought-signatures          (firma de pensamiento)
 *   https://docs.cloud.google.com/gemini-enterprise-agent-platform/reference/models/function-calling (nombres de función)
 *
 * SIN PROBAR CON LA API REAL: todo lo de abajo viene de la documentación y se prueba solo contra un servidor
 * falso. En particular, sin confirmar: la cabecera `x-goog-api-key` (la referencia muestra `?key=`), el campo
 * `parametersJsonSchema` para el esquema de las herramientas, el texto con que un modelo rechaza las herramientas,
 * y que los identificadores de modelo por defecto sirvan con una clave normal.
 *
 * Decisiones (ADR-27):
 *   - Ids: `functionCall.id` es opcional. Sin él se genera uno propio por respuesta; el id propio nunca se envía.
 *   - `thoughtSignature`: cada parte con firma sale como bloque `opaco` y vuelve en la misma parte; las llamadas
 *     paralelas se reenvían agrupadas. Una firma ausente no se inventa.
 *   - Nombres de herramienta: solo `[A-Za-z0-9_-]`, empiezan por letra o `_`, máximo 63; se traducen de ida y vuelta.
 *   - `promptTokenCount` INCLUYE la caché: se separa (como en OpenAI). La salida suma los tokens de razonamiento.
 */

import { LlmProvider } from './provider-interface.js';
import { modeloDeNivel } from './niveles.js';

const ALIASES = {
  opus:   'gemini-3.1-pro-preview',
  sonnet: 'gemini-3.6-flash',
  haiku:  'gemini-3.1-flash-lite',
};

const URL_POR_DEFECTO = 'https://generativelanguage.googleapis.com';

/** `finishReason` que significan «el modelo se negó o la respuesta se bloqueó». */
const RECHAZOS = new Set(['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION', 'IMAGE_SAFETY', 'IMAGE_PROHIBITED_CONTENT']);

/** Prefijo de los ids que genera este proveedor cuando la API no trae uno: nunca viajan de vuelta. */
const PREFIJO_ID_PROPIO = 'gemini-sin-id-';

/** Longitud máxima de un nombre de función (la documentación dice 64; un foro, 63: se toma lo más estricto). */
const MAX_NOMBRE = 63;

/** El cuerpo de un error que dice que el modelo no admite herramientas [sin confirmar: el texto varía]. */
const RECHAZO_HERRAMIENTAS = /(function calling|tools?|function declarations?)[^.]{0,80}(not (?:supported|enabled|allowed|available)|unsupported|unknown name)|(?:not support|unsupported)[^.]{0,80}(function calling|tools?)/i;

/** Máximo de caracteres de un cuerpo de error que se conserva en un mensaje. */
const MAX_ERROR = 200;

/**
 * Traductor de nombres de herramienta de UNA petición: el motor usa nombres como `fs.leer`; la API solo admite
 * letras, dígitos, `_` y `-`. Dos nombres que den el mismo resultado no se confunden (el segundo recibe un sufijo).
 */
function traductorDeNombres() {
  /** @type {Map<string, string>} original → adaptado */
  const ida = new Map();
  /** @type {Map<string, string>} adaptado → original */
  const vuelta = new Map();
  return {
    /** @param {string} original */
    adaptar(original) {
      const dado = ida.get(original);
      if (dado !== undefined) return dado;
      let base = String(original).replace(/[^A-Za-z0-9_-]/g, '_');
      if (!/^[A-Za-z_]/.test(base)) base = `_${base}`;
      base = base.slice(0, MAX_NOMBRE);
      let candidato = base;
      for (let n = 2; vuelta.has(candidato); n++) candidato = `${base.slice(0, MAX_NOMBRE - String(n).length - 1)}_${n}`;
      ida.set(original, candidato);
      vuelta.set(candidato, original);
      return candidato;
    },
    /** @param {string} adaptado */
    original: (adaptado) => vuelta.get(adaptado) ?? adaptado,
  };
}

/** Error de la API con el código HTTP en `status` (lo usan `doctor` y los reintentos). */
function errorHttp(mensaje, status) {
  return Object.assign(new Error(mensaje), { status });
}

/** Esquema de una herramienta sin las claves de JSON Schema que la API rechaza o malinterpreta. */
function limpiarEsquema(valor) {
  if (Array.isArray(valor)) return valor.map(limpiarEsquema);
  if (valor === null || typeof valor !== 'object') return valor;
  /** @type {Record<string, any>} */
  const salida = {};
  for (const [k, v] of Object.entries(valor)) {
    if (k === 'additionalProperties' || k === '$schema' || k === '$id') continue;
    salida[k] = limpiarEsquema(v);
  }
  return salida;
}

/** Texto de las partes de una respuesta, sin los resúmenes de pensamiento (`thought: true`). */
function textoDe(partes) {
  return partes.filter((x) => typeof x?.text === 'string' && x.thought !== true).map((x) => x.text).join('');
}

/**
 * Conversación neutra → `contents` de generateContent.
 * @param {any[]} mensajes @param {ReturnType<typeof traductorDeNombres>} nombres
 */
function aContenidosApi(mensajes, nombres) {
  // Nombre original y origen del id de cada llamada: el resultado necesita el nombre de la función, que no está en él
  /** @type {Map<string, { nombre: string, idApi: boolean }>} */
  const llamadas = new Map();
  for (const m of mensajes) {
    if (m.rol !== 'asistente' || !Array.isArray(m.contenido)) continue;
    for (const b of m.contenido) if (b?.tipo === 'uso_herramienta') llamadas.set(b.id, { nombre: String(b.nombre), idApi: !String(b.id).startsWith(PREFIJO_ID_PROPIO) });
  }

  /** @type {any[]} */
  const salida = [];
  for (const m of mensajes) {
    const rol = m.rol === 'asistente' ? 'model' : 'user';
    if (typeof m.contenido === 'string') {
      if (m.contenido !== '') salida.push({ role: rol, parts: [{ text: m.contenido }] });
      continue;
    }
    const bloques = m.contenido ?? [];
    for (const b of bloques) {
      if (!['texto', 'uso_herramienta', 'resultado_herramienta', 'opaco'].includes(b?.tipo)) throw new Error(`Bloque de conversación desconocido: "${b?.tipo}"`);
    }
    /** @type {any[]} */
    const partes = [];
    if (m.rol === 'asistente') {
      /** @type {string|null} */
      let firma = null;
      for (const b of bloques) {
        if (b.tipo === 'opaco') {
          // Solo los de Gemini; los de otro proveedor se ignoran
          if (b.crudo?.proveedor !== 'gemini') continue;
          if (b.crudo.parte) partes.push(b.crudo.parte);
          else if (typeof b.crudo.firma === 'string') firma = b.crudo.firma;
        } else if (b.tipo === 'texto') {
          partes.push({ text: b.texto, ...(firma ? { thoughtSignature: firma } : {}) });
          firma = null;
        } else if (b.tipo === 'uso_herramienta') {
          const entrada = b.entrada !== null && typeof b.entrada === 'object' && !Array.isArray(b.entrada) ? b.entrada : {};
          const idApi = !String(b.id).startsWith(PREFIJO_ID_PROPIO);
          partes.push({
            functionCall: { ...(idApi ? { id: b.id } : {}), name: nombres.adaptar(String(b.nombre)), args: entrada },
            ...(firma ? { thoughtSignature: firma } : {}),
          });
          firma = null;
        }
      }
    } else {
      // Todas las respuestas de herramienta juntas, en orden y antes que cualquier texto (intercalarlas con las llamadas da un 400)
      for (const b of bloques.filter((x) => x.tipo === 'resultado_herramienta')) {
        const origen = llamadas.get(b.idUso);
        const texto = String(b.contenido ?? '');
        partes.push({
          functionResponse: {
            ...(origen?.idApi ? { id: b.idUso } : {}),
            name: nombres.adaptar(origen?.nombre ?? 'desconocida'),
            response: b.esError ? { error: texto } : { output: texto },
          },
        });
      }
      for (const b of bloques.filter((x) => x.tipo === 'texto')) partes.push({ text: b.texto });
    }
    if (partes.length > 0) salida.push({ role: rol, parts: partes });
  }
  return salida;
}

export class GeminiProvider extends LlmProvider {
  get nombre() { return 'gemini'; }

  /** ADR-21: admite herramientas si tiene con qué llamar (clave o `fetch` inyectado) y el modelo no las ha rechazado ya. */
  get admiteHerramientas() { return Boolean((this.apiKey || this._fetch) && !this._sinHerramientas); }

  constructor(config = {}) {
    super();
    /** Niveles fijados en `modelos:` de sdd.config.yaml: mandan sobre los de este archivo (ADR-19) */
    this.modelos = config.modelos ?? {};
    this.apiKey  = config.api_key ?? process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '';
    this.baseUrl = config.base_url ?? process.env.GEMINI_BASE_URL ?? URL_POR_DEFECTO;
    /** Solo para pruebas: un `fetch` inyectado cuenta como «con qué llamar». */
    this._fetch = typeof config.fetch === 'function' ? config.fetch : null;
    /** El servidor rechazó las herramientas: se recuerda durante la sesión */
    this._sinHerramientas = false;
  }

  resolveModelId(alias) {
    return modeloDeNivel(alias, this.modelos, ALIASES);
  }

  /** Quita la clave (y lo que parece una) de un texto que va a un error o a un registro. */
  _redactar(texto) {
    let t = String(texto ?? '');
    if (this.apiKey) t = t.split(this.apiKey).join('[clave]');
    return t.replace(/\bAIza[A-Za-z0-9_-]{16,}/g, '[clave]');
  }

  /**
   * Un POST a `:generateContent`. La clave va en una cabecera, nunca en la URL. `redirect: 'error'`: una redirección
   * no puede llevar la clave a otro servidor.
   * @param {string} modelId @param {Record<string, any>} cuerpo @param {AbortSignal} [signal]
   */
  async _post(modelId, cuerpo, signal) {
    const id = String(modelId).replace(/^models\//, '');
    const url = `${this.baseUrl.replace(/\/$/, '')}/v1beta/models/${encodeURIComponent(id)}:generateContent`;
    const headers = { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey };
    const llamar = this._fetch ?? fetch;
    try {
      return await llamar(url, { method: 'POST', headers, body: JSON.stringify(cuerpo), signal, redirect: 'error' });
    } catch (e) {
      // El mensaje de un fallo de red no debe llevar la clave
      if (e instanceof Error && e.message !== this._redactar(e.message)) throw new Error(this._redactar(e.message));
      throw e;
    }
  }

  /** Cuerpo del error de la API → texto corto y sin clave. */
  async _errorDe(res) {
    const texto = await res.text().catch(() => '');
    let mensaje = texto;
    try { mensaje = JSON.parse(texto)?.error?.message ?? texto; } catch { /* no era JSON */ }
    return this._redactar(mensaje).slice(0, MAX_ERROR);
  }

  /**
   * Un turno de conversación con herramientas (generateContent). Método aparte de `complete`.
   * @param {{ model: string, systemPrompt: string, mensajes: any[], herramientas: any[], maxTokens?: number, signal?: AbortSignal }} params
   */
  async conversar({ model, systemPrompt, mensajes, herramientas, maxTokens = 8192, signal }) {
    if (!this.admiteHerramientas) {
      throw new Error(this._sinHerramientas
        ? `El modelo de Gemini en ${this._redactar(this.baseUrl)} no admite herramientas (lo rechazó antes): el ciclo usa el modo de bloque.`
        : 'El proveedor "gemini" no admite conversaciones con herramientas: falta la clave de API (GEMINI_API_KEY o GOOGLE_API_KEY).');
    }
    const nombres = traductorDeNombres();
    const cuerpo = /** @type {Record<string, any>} */ ({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: aContenidosApi(mensajes, nombres),
      generationConfig: { maxOutputTokens: maxTokens },
    });
    // Una lista vacía de herramientas se rechaza en la API [sin confirmar]: se omite
    if (herramientas?.length) {
      cuerpo.tools = [{
        functionDeclarations: herramientas.map((h) => ({
          name: nombres.adaptar(String(h.nombre)),
          description: h.descripcion,
          ...(h.esquema ? { parametersJsonSchema: limpiarEsquema(h.esquema) } : {}),
        })),
      }];
    }

    const res = await this._post(this.resolveModelId(model), cuerpo, signal);
    if (!res.ok) {
      const detalle = await this._errorDe(res);
      if (cuerpo.tools && (res.status === 400 || res.status === 404) && RECHAZO_HERRAMIENTAS.test(detalle)) {
        this._sinHerramientas = true;
        throw new Error(`El modelo de Gemini (${this._redactar(this.baseUrl)}) no admite herramientas (HTTP ${res.status}): ${detalle}. El ciclo usará el modo de bloque.`);
      }
      throw errorHttp(`Gemini error ${res.status}: ${detalle}`, res.status);
    }

    /** @type {any} */
    const json = await res.json();
    const candidato = json?.candidates?.[0];
    const partes = Array.isArray(candidato?.content?.parts) ? candidato.content.parts : [];
    const marca = Date.now().toString(36);
    const contenido = [];
    let hayLlamadas = false;
    let n = 0;
    for (const x of partes) {
      const firma = typeof x?.thoughtSignature === 'string' && x.thoughtSignature !== '' ? x.thoughtSignature : null;
      if (x?.functionCall) {
        hayLlamadas = true;
        if (firma) contenido.push({ tipo: 'opaco', crudo: { proveedor: 'gemini', firma } });
        const llamada = x.functionCall;
        contenido.push({
          tipo: 'uso_herramienta',
          // Sin id de la API: uno propio, único dentro de la respuesta
          id: typeof llamada.id === 'string' && llamada.id !== '' ? llamada.id : `${PREFIJO_ID_PROPIO}${marca}-${n++}`,
          nombre: nombres.original(String(llamada.name ?? '')),
          entrada: llamada.args !== null && typeof llamada.args === 'object' && !Array.isArray(llamada.args) ? llamada.args : {},
        });
      } else if (typeof x?.text === 'string' && x.thought !== true && x.text !== '') {
        if (firma) contenido.push({ tipo: 'opaco', crudo: { proveedor: 'gemini', firma } });
        contenido.push({ tipo: 'texto', texto: x.text });
      } else if (firma || x?.thought === true) {
        // Una parte sin texto ni llamada (o un resumen de pensamiento) que lleva firma: se guarda entera si hay firma
        if (firma) contenido.push({ tipo: 'opaco', crudo: { proveedor: 'gemini', parte: x } });
      }
    }

    const motivo = typeof candidato?.finishReason === 'string' ? candidato.finishReason : '';
    let stopReason;
    if (json?.promptFeedback?.blockReason || RECHAZOS.has(motivo)) stopReason = 'rechazo';
    else if (motivo === 'MAX_TOKENS') stopReason = 'max_tokens';
    else if (motivo === 'STOP') stopReason = 'fin';
    else stopReason = 'otro';
    // Gemini termina con «STOP» también cuando pide herramientas; con «MAX_TOKENS» los argumentos pueden venir truncados:
    // se queda en `max_tokens` y el ciclo no las ejecuta
    if (hayLlamadas && stopReason !== 'max_tokens' && stopReason !== 'rechazo') stopReason = 'herramientas';

    return { contenido, stopReason, ...this._tokens(json?.usageMetadata) };
  }

  /**
   * `promptTokenCount` INCLUYE los tokens de caché (al revés que en Anthropic): se separan para que el libro de gasto no
   * cuente dos veces. Los tokens de razonamiento se cobran como salida y los de herramientas del servidor como entrada.
   * @param {any} u
   */
  _tokens(u = {}) {
    const entero = (x) => (Number.isInteger(x) && x > 0 ? x : 0);
    const prompt = u?.promptTokenCount;
    const cacheados = Number.isInteger(prompt) ? Math.min(entero(u?.cachedContentTokenCount), prompt) : 0;
    const candidatos = u?.candidatesTokenCount;
    return {
      inputTokens: Number.isInteger(prompt) ? prompt - cacheados + entero(u?.toolUsePromptTokenCount) : undefined,
      outputTokens: Number.isInteger(candidatos) ? candidatos + entero(u?.thoughtsTokenCount) : undefined,
      cacheCreationTokens: 0,
      cacheReadTokens: cacheados,
    };
  }

  async complete({ model, systemPrompt, userPrompt, maxTokens = 8192, signal }) {
    const res = await this._post(this.resolveModelId(model), {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: { maxOutputTokens: maxTokens },
    }, signal);

    if (!res.ok) throw errorHttp(`Gemini error ${res.status}: ${await this._errorDe(res)}`, res.status);

    /** @type {any} */
    const json = await res.json();
    // Un prompt bloqueado no trae candidatos: devolver un texto vacío lo haría pasar por una respuesta
    if (json?.promptFeedback?.blockReason && !json?.candidates?.length) {
      throw new Error(`Gemini bloqueó la petición (${json.promptFeedback.blockReason}).`);
    }
    const partes = json?.candidates?.[0]?.content?.parts;
    const output = Array.isArray(partes) ? textoDe(partes) : '';
    const parada = json?.candidates?.[0]?.finishReason;
    // Sin texto, una parada que no es normal (SAFETY, RECITATION, MAX_TOKENS…) es un error: una respuesta vacía no puede pasar por válida
    if (output === '' && parada && parada !== 'STOP') throw Object.assign(new Error(`Gemini no devolvió texto (${parada}).`), { motivoParada: parada });
    return { output, ...this._tokens(json?.usageMetadata) };
  }
}
