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
 */

import { LlmProvider } from './provider-interface.js';

const ALIASES = {
  opus:   'gpt-4o',
  sonnet: 'gpt-4o-mini',
  haiku:  'gpt-4o-mini',
};

export class OpenAIProvider extends LlmProvider {
  get nombre() { return 'openai'; }

  constructor(config = {}) {
    super();
    this.apiKey  = config.api_key  ?? process.env.OPENAI_API_KEY ?? '';
    this.baseUrl = config.base_url ?? process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';
    this.apiVersion = config.api_version ?? null;
  }

  resolveModelId(alias) {
    return ALIASES[alias] ?? alias;
  }

  async complete({ model, systemPrompt, userPrompt, maxTokens = 8192, signal }) {
    const modelId = this.resolveModelId(model);

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };
    if (this.apiVersion) headers['api-version'] = this.apiVersion;

    const body = JSON.stringify({
      model: modelId,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
    });

    const url = `${this.baseUrl.replace(/\/$/, '')}/chat/completions`;
    const res = await fetch(url, { method: 'POST', headers, body, signal });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`OpenAI error ${res.status}: ${text.slice(0, 200)}`);
    }

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
