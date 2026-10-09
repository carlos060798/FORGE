/**
 * provider-interface.js — Interfaz base para providers de LLM
 *
 * Cualquier provider debe implementar:
 *   - complete(params) → { output, inputTokens, outputTokens }
 *   - resolveModelId(alias) → string (el model ID real del provider)
 *   - nombre → string
 *
 * params = { model, systemPrompt, userPrompt, maxTokens, signal }
 *
 * Opcional (ADR-21, implementador por turnos):
 *   - admiteHerramientas → boolean (por defecto, false)
 *   - conversar({ model, systemPrompt, mensajes, herramientas, maxTokens, signal })
 *       → { contenido: Bloque[], stopReason, inputTokens, outputTokens }
 *
 * La conversación usa una forma neutra, igual para todos los proveedores:
 *   mensajes     [{ rol: 'usuario' | 'asistente', contenido: string | Bloque[] }]
 *   herramientas [{ nombre, descripcion, esquema }]   (esquema: JSON Schema de la entrada)
 *   Bloque       { tipo: 'texto', texto }
 *              | { tipo: 'uso_herramienta', id, nombre, entrada }            (lo pide el modelo)
 *              | { tipo: 'resultado_herramienta', idUso, contenido, esError } (lo devuelve el motor)
 *              | { tipo: 'opaco', crudo }   (un bloque propio del proveedor que hay que devolverle tal cual)
 *   stopReason   'herramientas' | 'fin' | 'max_tokens' | 'rechazo' | 'otro'
 */

export class LlmProvider {
  get nombre() { throw new Error('nombre no implementado'); }

  /** @returns {Promise<{output: string, inputTokens?: number, outputTokens?: number}>} */
  async complete(_params) { throw new Error('complete() no implementado'); }

  /** ¿Sabe este proveedor conversar con herramientas? Quien no lo declare, no: el ciclo usa el modo de bloque. */
  get admiteHerramientas() { return false; }

  /**
   * Un turno de una conversación con herramientas. Solo existe si `admiteHerramientas` es true.
   * @param {{ model: string, systemPrompt: string, mensajes: any[], herramientas: any[], maxTokens?: number, signal?: AbortSignal }} _params
   * @returns {Promise<{ contenido: any[], stopReason: string, inputTokens?: number, outputTokens?: number }>}
   */
  async conversar(_params) { throw new Error(`El proveedor "${this.nombre}" no admite conversaciones con herramientas.`); }

  /** @param {string} alias — 'opus'|'sonnet'|'haiku' u otro alias del provider */
  resolveModelId(alias) { return alias; }
}
