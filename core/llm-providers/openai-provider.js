/**
 * openai-provider.js — Provider para OpenAI y compatibles (Codex, Azure OpenAI,
 * cualquier endpoint compatible con la API de OpenAI)
 *
 * Modelos soportados (aliases FORGE → model ID):
 *   opus   → gpt-4o           (equivalente de máxima capacidad)
 *   sonnet → gpt-4o-mini      (equivalente de uso general)
 *   haiku  → gpt-4o-mini      (equivalente rápido/barato)
 *   — o cualquier model ID directo: "o3", "gpt-4-turbo", "codex-mini-latest"
 *
 * También soporta:
 *   - Azure OpenAI (base_url + api_version)
 *   - GitHub Models / Copilot (base_url: https://models.inference.ai.azure.com)
 *   - Cursor API (base_url personalizada)
 *   - Cualquier endpoint compatible con OpenAI
 *
 * Config en sdd.config.yaml:
 *   llm:
 *     provider: openai
 *     api_key: sk-...         # o variable OPENAI_API_KEY
 *     model: sonnet           # alias FORGE, o model ID directo
 *     base_url: https://...   # opcional — para endpoints compatibles
 *     api_version: 2024-02-01 # opcional — para Azure
 *
 * Conversación con herramientas (`conversar`, ADR-21): API de CHAT COMPLETIONS, no la de respuestas
 * (los modelos que exigen la de respuestas no sirven aquí). Fuente: spike
 * `.sdd/especificaciones/2026-10-13-proveedores-agnosticos/spikes/herramientas-por-proveedor.md`
 * (consultado el 2026-10-13). La referencia de chat completions devolvió 404 ese día: lo siguiente
 * está marcado «sin confirmar» en el spike y NO se ha probado contra OpenAI real, solo contra un
 * servidor falso: forma de `tools`, `tool_calls` y del mensaje `role: 'tool'` con `tool_call_id`;
 * `finish_reason` (`stop`, `length`, `tool_calls`, `content_filter`) y `message.refusal`;
 * `max_completion_tokens` (con reserva a `max_tokens`); `prompt_tokens_details.cached_tokens`;
 * y el formato de los errores HTTP. Confirmado: varias llamadas por turno y que `strict` es opcional.
 * No se usan `strict` ni `tool_choice`.
 */

import { LlmProvider } from './provider-interface.js';
import { modeloDeNivel } from './niveles.js';

const ALIASES = {
  opus:   'gpt-4o',
  sonnet: 'gpt-4o-mini',
  haiku:  'gpt-4o-mini',
};

/** `finish_reason` → motivo neutro (tabla fija). Lo desconocido es `otro`. */
const PARADAS = { tool_calls: 'herramientas', function_call: 'herramientas', stop: 'fin', length: 'max_tokens', content_filter: 'rechazo' };

/** El cuerpo de un error que dice que el servidor no admite herramientas [sin confirmar: el texto varía entre compatibles]. */
const RECHAZO_HERRAMIENTAS = /(tools?|functions?|tool_choice)[^.]{0,80}(not (?:supported|allowed|available)|unsupported|unrecognized|unknown|invalid)|(?:not support|unsupported|unrecognized|unknown)[^.]{0,80}(tools?|functions?)|does not support (?:tools|function)/i;

/** Estados HTTP con los que un servidor rechaza un campo de la petición (no la clave ni una caída). */
const ESTADOS_DE_CAMPO = new Set([400, 404, 405, 415, 422]);

/** Máximo de caracteres de un argumento no válido que se conserva en la conversación. */
const MAX_ARGUMENTOS_INVALIDOS = 2000;

/** Texto de `message.content`: cadena, o lista de partes con `text` en algunos compatibles. */
function textoDe(c) {
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.map((p) => (typeof p?.text === 'string' ? p.text : '')).join('');
  return '';
}

/**
 * Argumentos de una llamada → entrada neutra. Un JSON que no es un objeto, o que no se puede leer,
 * NO lanza: se devuelve el texto tal cual y el ejecutor de herramientas lo rechaza («la entrada
 * debe ser un objeto»), de modo que el modelo lo recibe como resultado con error (CA-002-04).
 * @param {unknown} crudos
 */
function entradaDe(crudos) {
  if (crudos === undefined || crudos === null || crudos === '') return {};
  if (typeof crudos === 'object' && !Array.isArray(crudos)) return crudos;   // un compatible que ya lo manda como objeto
  const texto = String(typeof crudos === 'string' ? crudos : JSON.stringify(crudos));
  try {
    const v = JSON.parse(texto);
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) return v;
  } catch { /* texto no válido: se devuelve abajo */ }
  return texto.slice(0, MAX_ARGUMENTOS_INVALIDOS);
}

/** Conversación neutra → mensajes de chat completions. Un bloque `opaco` es de otro proveedor: se ignora. */
function aMensajesApi(systemPrompt, mensajes) {
  /** @type {any[]} */
  const salida = [{ role: 'system', content: systemPrompt }];
  for (const m of mensajes) {
    if (typeof m.contenido === 'string') {
      salida.push({ role: m.rol === 'asistente' ? 'assistant' : 'user', content: m.contenido });
      continue;
    }
    const bloques = m.contenido ?? [];
    for (const b of bloques) {
      if (!['texto', 'uso_herramienta', 'resultado_herramienta', 'opaco'].includes(b?.tipo)) throw new Error(`Bloque de conversación desconocido: "${b?.tipo}"`);
    }
    const textos = bloques.filter((b) => b.tipo === 'texto').map((b) => b.texto).join('\n');
    if (m.rol === 'asistente') {
      const usos = bloques.filter((b) => b.tipo === 'uso_herramienta');
      salida.push({
        role: 'assistant',
        content: textos === '' && usos.length > 0 ? null : textos,
        // Los argumentos van siempre como JSON válido (un texto no válido que devolvimos antes, entrecomillado)
        ...(usos.length > 0 ? { tool_calls: usos.map((u) => ({ id: u.id, type: 'function', function: { name: u.nombre, arguments: JSON.stringify(u.entrada ?? {}) } })) } : {}),
      });
    } else {
      // Un mensaje `tool` por resultado, en orden y antes que cualquier texto del usuario.
      // Este formato no tiene `is_error`: el error se antepone al contenido.
      for (const b of bloques.filter((x) => x.tipo === 'resultado_herramienta')) {
        salida.push({ role: 'tool', tool_call_id: b.idUso, content: (b.esError ? 'ERROR: ' : '') + String(b.contenido ?? '') });
      }
      if (textos !== '') salida.push({ role: 'user', content: textos });
    }
  }
  return salida;
}

export class OpenAIProvider extends LlmProvider {
  get nombre() { return 'openai'; }

  /**
   * ADR-21: admite herramientas si tiene con qué llamar (una clave o un `fetch` inyectado) y el
   * servidor no las ha rechazado ya en esta sesión; entonces el ciclo avisa y usa el modo de bloque.
   */
  get admiteHerramientas() { return Boolean((this.apiKey || this._fetch) && !this._sinHerramientas); }

  constructor(config = {}) {
    super();
    /** Niveles fijados en `modelos:` de sdd.config.yaml: mandan sobre los de este archivo (ADR-19) */
    this.modelos = config.modelos ?? {};
    this.apiKey  = config.api_key  ?? process.env.OPENAI_API_KEY ?? '';
    this.baseUrl = config.base_url ?? process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';
    this.apiVersion = config.api_version ?? null;
    /** Solo para pruebas: un `fetch` inyectado cuenta como «con qué llamar» (como el cliente del SDK en Anthropic). */
    this._fetch = typeof config.fetch === 'function' ? config.fetch : null;
    /** El servidor rechazó las herramientas: se recuerda durante la sesión */
    this._sinHerramientas = false;
    /** Campo del límite de salida de `conversar`; pasa a `max_tokens` si el servidor rechaza el nuevo */
    this._campoLimite = 'max_completion_tokens';
  }

  resolveModelId(alias) {
    return modeloDeNivel(alias, this.modelos, ALIASES);
  }

  /** Quita la clave (y lo que parece una) de un texto que va a un error o a un registro. */
  _redactar(texto) {
    let t = String(texto ?? '');
    if (this.apiKey) t = t.split(this.apiKey).join('[clave]');
    return t.replace(/\bsk-[A-Za-z0-9_-]{8,}/g, '[clave]');
  }

  /**
   * Un POST a /chat/completions. `redirect: 'error'`: una redirección no puede llevar la clave a otro servidor.
   * @param {Record<string, any>} cuerpo @param {AbortSignal} [signal]
   */
  async _post(cuerpo, signal) {
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` };
    if (this.apiVersion) headers['api-version'] = this.apiVersion;
    const url = `${this.baseUrl.replace(/\/$/, '')}/chat/completions`;
    const llamar = this._fetch ?? fetch;
    try {
      return await llamar(url, { method: 'POST', headers, body: JSON.stringify(cuerpo), signal, redirect: 'error' });
    } catch (e) {
      // El mensaje de un fallo de red no debe llevar la clave
      if (e instanceof Error && e.message !== this._redactar(e.message)) throw new Error(this._redactar(e.message));
      throw e;
    }
  }

  /**
   * Un turno de conversación con herramientas (API de chat completions). Método aparte de `complete`.
   * @param {{ model: string, systemPrompt: string, mensajes: any[], herramientas: any[], maxTokens?: number, signal?: AbortSignal }} params
   */
  async conversar({ model, systemPrompt, mensajes, herramientas, maxTokens = 8192, signal }) {
    if (!this.admiteHerramientas) {
      throw new Error(this._sinHerramientas
        ? `El servidor de OpenAI en ${this._redactar(this.baseUrl)} no admite herramientas (lo rechazó antes): el ciclo usa el modo de bloque.`
        : 'El proveedor "openai" no admite conversaciones con herramientas: falta la clave de API.');
    }
    const cuerpo = /** @type {Record<string, any>} */ ({
      model: this.resolveModelId(model),
      messages: aMensajesApi(systemPrompt, mensajes),
    });
    // Una lista vacía de herramientas se rechaza en la API [sin confirmar]: se omite
    if (herramientas?.length) {
      cuerpo.tools = herramientas.map((h) => ({ type: 'function', function: { name: h.nombre, description: h.descripcion, parameters: h.esquema } }));
    }

    let res;
    for (let intento = 0; intento < 2; intento++) {
      delete cuerpo.max_tokens; delete cuerpo.max_completion_tokens;
      cuerpo[this._campoLimite] = maxTokens;
      res = await this._post(cuerpo, signal);
      if (res.ok) break;
      const texto = await res.text().catch(() => '');
      // Un compatible que no conoce `max_completion_tokens`: se reintenta una vez con `max_tokens`
      if (intento === 0 && this._campoLimite === 'max_completion_tokens' && ESTADOS_DE_CAMPO.has(res.status) && /max_completion_tokens/i.test(texto)) {
        this._campoLimite = 'max_tokens';
        continue;
      }
      if (cuerpo.tools && ESTADOS_DE_CAMPO.has(res.status) && RECHAZO_HERRAMIENTAS.test(texto)) {
        this._sinHerramientas = true;
        throw new Error(`El servidor de OpenAI (${this._redactar(this.baseUrl)}) no admite herramientas en chat completions (HTTP ${res.status}): ${this._redactar(texto).slice(0, 200)}. El ciclo usará el modo de bloque.`);
      }
      throw new Error(`OpenAI error ${res.status}: ${this._redactar(texto).slice(0, 200)}`);
    }

    /** @type {any} */
    const json = await /** @type {Response} */ (res).json();
    const eleccion = json?.choices?.[0];
    const mensaje = eleccion?.message ?? {};
    const contenido = [];
    const texto = textoDe(mensaje.content);
    const rechazo = typeof mensaje.refusal === 'string' && mensaje.refusal !== '' ? mensaje.refusal : null;
    if (texto) contenido.push({ tipo: 'texto', texto });
    else if (rechazo) contenido.push({ tipo: 'texto', texto: rechazo });
    const llamadas = Array.isArray(mensaje.tool_calls) ? mensaje.tool_calls : [];
    llamadas.forEach((l, i) => {
      contenido.push({
        tipo: 'uso_herramienta',
        // Un compatible sin id: uno sintético, único dentro de la respuesta
        id: typeof l?.id === 'string' && l.id !== '' ? l.id : `openai-${Date.now().toString(36)}-${i}`,
        nombre: String(l?.function?.name ?? ''),
        entrada: entradaDe(l?.function?.arguments),
      });
    });

    let stopReason = PARADAS[eleccion?.finish_reason] ?? 'otro';
    if (rechazo) stopReason = 'rechazo';
    // Llamadas con «stop» o un motivo desconocido (algunos compatibles) siguen siendo un turno con herramientas;
    // con «length» los argumentos pueden venir truncados: se queda en `max_tokens` y el ciclo no las ejecuta
    else if (llamadas.length > 0 && stopReason !== 'max_tokens' && stopReason !== 'rechazo') stopReason = 'herramientas';

    // `prompt_tokens` INCLUYE los tokens de caché (al revés que en Anthropic): se separan para que el
    // libro de gasto no cuente dos veces ni por debajo. entrada + lectura de caché = prompt_tokens.
    // La lectura se cobra al precio de entrada (lo que no baja de lo que cobra el proveedor).
    const usage = json?.usage ?? {};
    const prompt = usage.prompt_tokens;
    const crudo = usage.prompt_tokens_details?.cached_tokens;
    const cacheados = Number.isInteger(crudo) && crudo > 0 && Number.isInteger(prompt) ? Math.min(crudo, prompt) : 0;
    return {
      contenido,
      stopReason,
      inputTokens: Number.isInteger(prompt) ? prompt - cacheados : prompt,
      outputTokens: usage.completion_tokens,
      cacheCreationTokens: 0,
      cacheReadTokens: cacheados,
    };
  }

  async complete({ model, systemPrompt, userPrompt, maxTokens = 8192, signal }) {
    const modelId = this.resolveModelId(model);

    const res = await this._post({
      model: modelId,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
    }, signal);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      // El cuerpo del error puede repetir la clave: se redacta antes de lanzarlo
      throw new Error(`OpenAI error ${res.status}: ${this._redactar(text).slice(0, 200)}`);
    }

    /** @type {{ choices?: { message?: { content?: string } }[], usage?: { prompt_tokens?: number, completion_tokens?: number } }} */
    const json = await res.json();
    const output = json.choices?.[0]?.message?.content ?? '';
    const usage  = json.usage ?? {};
    return {
      output,
      inputTokens:  usage.prompt_tokens,
      outputTokens: usage.completion_tokens,
    };
  }
}
