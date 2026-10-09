/**
 * provider-interface.js — Interfaz base para providers de LLM
 *
 * Cualquier provider debe implementar:
 *   - complete(params) → { output, inputTokens, outputTokens }
 *     Un proveedor con caché de prompts añade cacheCreationTokens y cacheReadTokens
 *     (tokens guardados y reutilizados; inputTokens no los incluye)
 *   - resolveModelId(alias) → string (el model ID real del provider)
 *   - nombre → string
 *
 * params = { model, systemPrompt, userPrompt, maxTokens, signal }
 *   Opcional: systemFijo, la parte de systemPrompt que se repite idéntica entre llamadas
 *   (siempre un prefijo suyo). Quien no tenga caché de prompts lo ignora.
 */

export class LlmProvider {
  get nombre() { throw new Error('nombre no implementado'); }

  /** @returns {Promise<{output: string, inputTokens?: number, outputTokens?: number, cacheCreationTokens?: number, cacheReadTokens?: number}>} */
  async complete(_params) { throw new Error('complete() no implementado'); }

  /** @param {string} alias — 'opus'|'sonnet'|'haiku' u otro alias del provider */
  resolveModelId(alias) { return alias; }
}
