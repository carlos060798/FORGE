/**
 * anthropic-provider.js — Provider para Claude (Anthropic API)
 *
 * Modelos soportados:
 *   opus   → claude-opus-4-8
 *   sonnet → claude-sonnet-4-6  (default)
 *   haiku  → claude-haiku-4-5-20251001
 *
 * Config en sdd.config.yaml:
 *   llm:
 *     provider: anthropic
 *     api_key: sk-ant-...   # o variable ANTHROPIC_API_KEY
 *     model: sonnet
 *     cache: true           # caché de prompts (por defecto true); false no envía cache_control
 *
 * Caché de prompts (spec 2026-10-09-puesta-al-dia, HU-001). Documentación oficial consultada
 * el 2026-10-09: https://platform.claude.com/docs/en/build-with-claude/prompt-caching
 *   - Forma: el prompt de sistema va como lista de bloques y el último bloque de la parte fija
 *     lleva `cache_control: { type: 'ephemeral' }` (caché de 5 minutos, la de por defecto).
 *   - `usage.input_tokens` NO incluye los tokens de caché: el total de entrada es
 *     cache_read_input_tokens + cache_creation_input_tokens + input_tokens.
 *   - Precio: la escritura (5 min) cuesta 1,25 veces la entrada; la lectura, 0,1 veces
 *     (menos en algunos modelos). Los precios por modelo están en core/precios.js.
 *   - Tamaño mínimo cacheable, en tokens: 512 en Claude Fable 5.1, Mythos 5.1, Opus 5.5,
 *     Opus 5, Sonnet 5.5, Fable 5, Mythos 5 y Haiku 5.5; 1024 en Opus 4.8, Sonnet 5 y
 *     Sonnet 4.6; 2048 en Opus 4.7; 4096 en Opus 4.6, Opus 4.5 y Haiku 4.5. Un prefijo más
 *     corto no da error: sencillamente no se guarda (los dos contadores de caché llegan a 0).
 */

import { LlmProvider } from './provider-interface.js';

const MODELOS = {
  opus:   'claude-opus-4-8',
  sonnet: 'claude-sonnet-4-6',
  haiku:  'claude-haiku-4-5-20251001',
};

/** `stop_reason` de la API → motivo neutro del contrato de proveedor. */
const PARADAS = { tool_use: 'herramientas', end_turn: 'fin', stop_sequence: 'fin', max_tokens: 'max_tokens', refusal: 'rechazo' };

/** Bloque neutro → bloque de la API de mensajes. */
function aBloqueApi(b) {
  switch (b?.tipo) {
    case 'texto': return { type: 'text', text: b.texto };
    case 'uso_herramienta': return { type: 'tool_use', id: b.id, name: b.nombre, input: b.entrada ?? {} };
    case 'resultado_herramienta':
      return { type: 'tool_result', tool_use_id: b.idUso, content: b.contenido, ...(b.esError ? { is_error: true } : {}) };
    case 'opaco': return b.crudo;
    default: throw new Error(`Bloque de conversación desconocido: "${b?.tipo}"`);
  }
}

/** Bloque de la API → bloque neutro. Lo que no se conoce (p. ej. razonamiento) se conserva para devolverlo intacto. */
function deBloqueApi(b) {
  if (b?.type === 'text') return { tipo: 'texto', texto: b.text };
  if (b?.type === 'tool_use') return { tipo: 'uso_herramienta', id: b.id, nombre: b.name, entrada: b.input ?? {} };
  return { tipo: 'opaco', crudo: b };
}

/**
 * Marca como reutilizable el último bloque del último mensaje (se copia: no se altera lo recibido).
 * Un mensaje de texto simple se convierte en un bloque de texto para poder llevar la marca.
 * @param {{ role: string, content: any }[]} messages  se modifica el último elemento
 */
export function marcarFinDeConversacion(messages) {
  const ultimo = messages[messages.length - 1];
  if (!ultimo) return;
  const bloques = typeof ultimo.content === 'string'
    ? (ultimo.content === '' ? [] : [{ type: 'text', text: ultimo.content }])
    : [...ultimo.content];
  if (bloques.length === 0) return;
  const fin = bloques[bloques.length - 1];
  // Solo los bloques que la API admite con marca; un bloque opaco (p. ej. razonamiento) se deja como está
  if (!fin || !['text', 'tool_result', 'tool_use'].includes(fin.type)) return;
  bloques[bloques.length - 1] = { ...fin, cache_control: { type: 'ephemeral' } };
  messages[messages.length - 1] = { ...ultimo, content: bloques };
}

function aMensajeApi(m) {
  return {
    role: m.rol === 'asistente' ? 'assistant' : 'user',
    content: typeof m.contenido === 'string' ? m.contenido : m.contenido.map(aBloqueApi),
  };
}

/**
 * `llm.cache` de sdd.config.yaml: activa por defecto. Un valor que no sea true ni false se
 * rechaza: adivinar aquí cambiaría el gasto sin que nadie lo hubiera pedido.
 * @param {unknown} valor
 * @returns {boolean}
 */
export function cacheActiva(valor) {
  if (valor === undefined || valor === null || valor === true) return true;
  if (valor === false) return false;
  const texto = String(valor).replace(/\s+#.*$/, '').trim().replace(/^["']|["']$/g, '').toLowerCase();
  if (texto === '' || texto === 'true') return true;
  if (texto === 'false') return false;
  throw new Error(`llm.cache no válido en .sdd/sdd.config.yaml: "${valor}". Valores válidos: true, false`);
}

/**
 * Prompt de sistema con la parte fija marcada como reutilizable. La parte fija es
 * `systemFijo` si es un prefijo de `systemPrompt`; si no se indica, el prompt entero.
 * Lo variable queda en un segundo bloque, después del punto de corte, para no romper el prefijo.
 * @param {string} systemPrompt
 * @param {string} [systemFijo]
 * @returns {string | { type: 'text', text: string, cache_control?: { type: 'ephemeral' } }[]}
 */
export function sistemaConCache(systemPrompt, systemFijo) {
  if (typeof systemPrompt !== 'string' || systemPrompt === '') return systemPrompt;
  const fijo = typeof systemFijo === 'string' && systemFijo !== '' && systemPrompt.startsWith(systemFijo) ? systemFijo : systemPrompt;
  const resto = systemPrompt.slice(fijo.length);
  return [
    { type: 'text', text: fijo, cache_control: { type: 'ephemeral' } },
    ...(resto ? [{ type: /** @type {'text'} */ ('text'), text: resto }] : []),
  ];
}

export class AnthropicProvider extends LlmProvider {
  get nombre() { return 'anthropic'; }

  constructor(config = {}) {
    super();
    /** Niveles fijados en `modelos:` de sdd.config.yaml: mandan sobre los de este archivo (ADR-19) */
    this.modelos = config.modelos ?? {};
    this.apiKey = config.api_key ?? process.env.ANTHROPIC_API_KEY ?? process.env.CLAUDE_API_KEY ?? '';
    /** Cliente del SDK inyectado (tests): un objeto con `messages.create(params, opciones)`. Solo lo usa `conversar`. */
    this._clienteSdk = config.clienteSdk ?? null;
    /** Caché de prompts: `llm.cache` (por defecto true) */
    this.cache = cacheActiva(config.cache);
    /**
     * Solo para pruebas: fábrica del cliente del SDK, `({ apiKey }) => cliente`. Sin ella se
     * carga `@anthropic-ai/sdk` como siempre.
     * @type {((opciones: { apiKey: string }) => any) | undefined}
     */
    this.crearCliente = typeof config.crearCliente === 'function' ? config.crearCliente : undefined;
  }

  /** ADR-21: admite herramientas si tiene con qué llamar (una clave o un cliente inyectado). */
  get admiteHerramientas() { return Boolean(this._clienteSdk || this.apiKey); }

  /**
   * Un turno de conversación con herramientas (API de mensajes: `tools`, bloques `tool_use` y `tool_result`).
   * No comparte código con `complete`: es un método aparte para no alterar las llamadas de un solo mensaje.
   * @param {{ model: string, systemPrompt: string, mensajes: any[], herramientas: any[], maxTokens?: number, signal?: AbortSignal }} params
   */
  async conversar({ model, systemPrompt, mensajes, herramientas, maxTokens = 8192, signal }) {
    let client = this._clienteSdk;
    if (!client) {
      const sdk = await import('@anthropic-ai/sdk').catch(() => null);
      // Aquí no hay respuesta de relleno: una conversación inventada acabaría escribiendo archivos
      if (!sdk || !this.apiKey) throw new Error('Anthropic: falta el SDK o la clave de API; no se puede conversar con herramientas.');
      client = new sdk.default({ apiKey: this.apiKey });
    }
    const messages = mensajes.map(aMensajeApi);
    // Cada turno reenvía la conversación entera. Con la caché activa se marcan dos puntos de corte:
    // el prompt de sistema (fijo en toda la tarea) y el final de la conversación, de modo que el turno
    // siguiente lea de la caché todo lo anterior y solo pague a precio normal lo nuevo.
    if (this.cache) marcarFinDeConversacion(messages);
    const res = await client.messages.create(
      {
        model: this.resolveModelId(model),
        max_tokens: maxTokens,
        system: this.cache ? sistemaConCache(systemPrompt) : systemPrompt,
        tools: herramientas.map((h) => ({ name: h.nombre, description: h.descripcion, input_schema: h.esquema })),
        messages,
      },
      { signal }
    );
    return {
      contenido: (res.content ?? []).map(deBloqueApi),
      stopReason: PARADAS[res.stop_reason] ?? 'otro',
      // input_tokens NO incluye los tokens de caché: son tres cantidades aparte
      inputTokens: res.usage?.input_tokens,
      outputTokens: res.usage?.output_tokens,
      cacheCreationTokens: res.usage?.cache_creation_input_tokens ?? 0,
      cacheReadTokens: res.usage?.cache_read_input_tokens ?? 0,
    };
  }

  resolveModelId(alias) {
    return this.modelos[alias] ?? MODELOS[alias] ?? alias;
  }

  async complete({ model, systemPrompt, systemFijo, userPrompt, maxTokens = 8192, signal }) {
    let client;
    if (this.crearCliente) {
      client = this.crearCliente({ apiKey: this.apiKey });
    } else {
      const sdk = await import('@anthropic-ai/sdk').catch(() => null);
      if (!sdk || !this.apiKey) {
        return { output: `[stub-anthropic] sin SDK o API key. Prompt: ${userPrompt.slice(0, 80)}` };
      }
      client = new sdk.default({ apiKey: this.apiKey });
    }

    const res = await client.messages.create(
      {
        model: this.resolveModelId(model),
        max_tokens: maxTokens,
        // Con la caché desactivada la petición es la de siempre: sin cache_control
        system: this.cache ? sistemaConCache(systemPrompt, systemFijo) : systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      },
      { signal }
    );

    const output = res.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
    return {
      output,
      // input_tokens NO incluye los tokens de caché: son tres cantidades aparte
      inputTokens: res.usage?.input_tokens,
      outputTokens: res.usage?.output_tokens,
      cacheCreationTokens: res.usage?.cache_creation_input_tokens ?? 0,
      cacheReadTokens: res.usage?.cache_read_input_tokens ?? 0,
    };
  }
}
