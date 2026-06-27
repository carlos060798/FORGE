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

export class AnthropicProvider extends LlmProvider {
  get nombre() { return 'anthropic'; }

  constructor(config = {}) {
    super();
    this.apiKey = config.api_key ?? process.env.ANTHROPIC_API_KEY ?? process.env.CLAUDE_API_KEY ?? '';
  }

  resolveModelId(alias) {
    return MODELOS[alias] ?? alias;
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
