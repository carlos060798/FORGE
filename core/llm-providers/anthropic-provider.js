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
    /** Caché de prompts: `llm.cache` (por defecto true) */
    this.cache = cacheActiva(config.cache);
    /**
     * Solo para pruebas: fábrica del cliente del SDK, `({ apiKey }) => cliente`. Sin ella se
     * carga `@anthropic-ai/sdk` como siempre.
     * @type {((opciones: { apiKey: string }) => any) | undefined}
     */
    this.crearCliente = typeof config.crearCliente === 'function' ? config.crearCliente : undefined;
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
