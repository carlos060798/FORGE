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

function aMensajeApi(m) {
  return {
    role: m.rol === 'asistente' ? 'assistant' : 'user',
    content: typeof m.contenido === 'string' ? m.contenido : m.contenido.map(aBloqueApi),
  };
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
    const res = await client.messages.create(
      {
        model: this.resolveModelId(model),
        max_tokens: maxTokens,
        system: systemPrompt,
        tools: herramientas.map((h) => ({ name: h.nombre, description: h.descripcion, input_schema: h.esquema })),
        messages: mensajes.map(aMensajeApi),
      },
      { signal }
    );
    return {
      contenido: (res.content ?? []).map(deBloqueApi),
      stopReason: PARADAS[res.stop_reason] ?? 'otro',
      inputTokens: res.usage?.input_tokens,
      outputTokens: res.usage?.output_tokens,
    };
  }

  resolveModelId(alias) {
    return this.modelos[alias] ?? MODELOS[alias] ?? alias;
  }

  async complete({ model, systemPrompt, userPrompt, maxTokens = 8192, signal }) {
    const sdk = await import('@anthropic-ai/sdk').catch(() => null);
    if (!sdk || !this.apiKey) {
      return { output: `[stub-anthropic] sin SDK o API key. Prompt: ${userPrompt.slice(0, 80)}` };
    }

    const client = new sdk.default({ apiKey: this.apiKey });
    const res = await client.messages.create(
      {
        model: this.resolveModelId(model),
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      },
      { signal }
    );

    const output = res.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
    return { output, inputTokens: res.usage?.input_tokens, outputTokens: res.usage?.output_tokens };
  }
}
