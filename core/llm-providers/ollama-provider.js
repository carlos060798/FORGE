/**
 * ollama-provider.js — Provider para Ollama (modelos locales)
 *
 * Requiere Ollama corriendo en localhost (o base_url personalizada).
 * Compatible con cualquier modelo disponible en Ollama:
 *   llama3, mistral, deepseek-coder, qwen2.5-coder, codellama, phi3, etc.
 *
 * Aliases FORGE → modelos Ollama recomendados:
 *   opus   → deepseek-r1:14b  (razonamiento profundo, más lento)
 *   sonnet → qwen2.5-coder:7b (código general, balance velocidad/calidad)
 *   haiku  → llama3.2:3b      (tareas simples, muy rápido)
 *   — o cualquier model ID de Ollama directamente
 *
 * Config en sdd.config.yaml:
 *   llm:
 *     provider: ollama
 *     base_url: http://localhost:11434   # default
 *     model: sonnet                      # alias o nombre directo de Ollama
 *
 * Sin api_key — Ollama es local y no requiere autenticación por defecto.
 */

import { LlmProvider } from './provider-interface.js';

const ALIASES = {
  opus:   'deepseek-r1:14b',
  sonnet: 'qwen2.5-coder:7b',
  haiku:  'llama3.2:3b',
};

export class OllamaProvider extends LlmProvider {
  get nombre() { return 'ollama'; }

  constructor(config = {}) {
    super();
    this.baseUrl = config.base_url ?? process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
  }

  resolveModelId(alias) {
    return ALIASES[alias] ?? alias;
  }

  async complete({ model, systemPrompt, userPrompt, maxTokens = 8192, signal }) {
    const modelId = this.resolveModelId(model);
    const url = `${this.baseUrl.replace(/\/$/, '')}/api/chat`;

    const body = JSON.stringify({
      model: modelId,
      stream: false,
      options: { num_predict: maxTokens },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Ollama error ${res.status}: ${text.slice(0, 200)}`);
    }

    const json = await res.json();
    const output = json.message?.content ?? '';
    // Ollama devuelve eval_count (tokens generados) y prompt_eval_count
    return {
      output,
      inputTokens:  json.prompt_eval_count,
      outputTokens: json.eval_count,
    };
  }
}
