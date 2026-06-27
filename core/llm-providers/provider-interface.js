/**
 * provider-interface.js — Interfaz base para providers de LLM
 *
 * Cualquier provider debe implementar:
 *   - complete(params) → { output, inputTokens, outputTokens }
 *   - resolveModelId(alias) → string (el model ID real del provider)
 *   - nombre → string
 *
 * params = { model, systemPrompt, userPrompt, maxTokens, signal }
 */

export class LlmProvider {
  get nombre() { throw new Error('nombre no implementado'); }

  /** @returns {Promise<{output: string, inputTokens?: number, outputTokens?: number}>} */
  async complete(_params) { throw new Error('complete() no implementado'); }

  /** @param {string} alias — 'opus'|'sonnet'|'haiku' u otro alias del provider */
  resolveModelId(alias) { return alias; }
}
