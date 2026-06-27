/**
 * agent-registry.js — Carga agents/*.md como objetos tipados e invoca al LLM
 */

import * as fs from 'fs';
import * as path from 'path';

const DEFAULT_GLOBAL_TIMEOUT_MS = 120_000;

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };

  const meta = {};
  for (const line of match[1].split('\n')) {
    const colon = line.indexOf(':');
    if (colon < 1) continue;
    const key = line.slice(0, colon).trim();
    let value = line.slice(colon + 1).trim();
    if (value.startsWith('[')) {
      try { meta[key] = JSON.parse(value.replace(/'/g, '"')); } catch { meta[key] = value; }
      continue;
    }
    value = value.replace(/^["']|["']$/g, '');
    meta[key] = value;
  }
  return { meta, body: match[2] };
}

function normalizeModel(raw) {
  const s = String(raw ?? '').toLowerCase();
  if (s.includes('opus'))  return 'opus';
  if (s.includes('haiku')) return 'haiku';
  return 'sonnet';
}

export class AgentRegistry {
  constructor() {
    this.agents = new Map();
  }

  /** @param {string} agentsDir */
  load(agentsDir) {
    if (!fs.existsSync(agentsDir)) {
      throw new Error(`agents/ no encontrado: ${agentsDir}`);
    }
    const files = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md')).sort();
    for (const file of files) {
      const filePath = path.join(agentsDir, file);
      const raw = fs.readFileSync(filePath, 'utf8');
      const { meta, body } = parseFrontmatter(raw);
      const name = String(meta['name'] ?? path.basename(file, '.md'));
      this.agents.set(name, {
        name,
        description: String(meta['description'] ?? ''),
        model: normalizeModel(meta['model']),
        tools: Array.isArray(meta['tools']) ? meta['tools'] : [],
        goal: meta['goal'] ? String(meta['goal']) : undefined,
        backstory: meta['backstory'] ? String(meta['backstory']) : undefined,
        systemPrompt: body.trim(),
        filePath,
      });
    }
  }

  get(name)         { return this.agents.get(name); }
  getOrThrow(name)  {
    const def = this.agents.get(name);
    if (!def) throw new Error(`Agente no encontrado: "${name}". Registrados: ${[...this.agents.keys()].join(', ')}`);
    return def;
  }
  list()            { return [...this.agents.values()]; }
  has(name)         { return this.agents.has(name); }
  register(def)     { this.agents.set(def.name, def); }
}

async function withRetry(fn, opts = {}) {
  const { maxAttempts = 3, backoffMs = 1000, retryOn } = opts;
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const shouldRetry = retryOn ? retryOn(err) : isRetryable(err);
      if (!shouldRetry || attempt === maxAttempts) throw err;
      await new Promise(r => setTimeout(r, backoffMs * attempt));
    }
  }
  throw lastError;
}

function isRetryable(err) {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return msg.includes('429') || msg.includes('rate limit') ||
           msg.includes('timeout') || msg.includes('econnreset') ||
           msg.includes('enotfound') || msg.includes('503');
  }
  return false;
}

export class LlmAgentAdapter {
  constructor(definition, apiKey, globalTimeoutMs) {
    this.definition = definition;
    this.apiKey = apiKey ?? process.env['ANTHROPIC_API_KEY'] ?? '';
    this.globalTimeoutMs = globalTimeoutMs ?? DEFAULT_GLOBAL_TIMEOUT_MS;
  }

  async execute(ctx) {
    const start = Date.now();
    const systemParts = [this.definition.systemPrompt];
    if (this.definition.goal) systemParts.push(`\n## Objetivo\n${this.definition.goal}`);
    if (ctx.forgeState)       systemParts.push(`\n## Estado FORGE actual\n\`\`\`json\n${ctx.forgeState}\n\`\`\``);
    if (ctx.extraContext)     systemParts.push(`\n## Contexto adicional\n${ctx.extraContext}`);
    const systemPrompt = systemParts.join('\n');
    const modelId = this._resolveModelId(this.definition.model);

    try {
      const sdkModule = await (import('@anthropic-ai/sdk').catch(() => null));

      if (!sdkModule || !this.apiKey) {
        return {
          ok: true,
          agentName: this.definition.name,
          output: `[stub] Agente "${this.definition.name}" ejecutado sin API key. Prompt: ${ctx.userPrompt.slice(0, 100)}`,
          durationMs: Date.now() - start,
          modelo: modelId,
        };
      }

      const effectiveTimeoutMs = this.definition.timeout_ms ?? this.globalTimeoutMs;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), effectiveTimeoutMs);

      const client = new sdkModule.default({ apiKey: this.apiKey });
      let response;
      try {
        const params = {
          model: modelId,
          max_tokens: 8192,
          system: systemPrompt,
          messages: [{ role: 'user', content: ctx.userPrompt }],
        };
        response = await withRetry(
          () => client.messages.create(params, { signal: controller.signal }),
          { maxAttempts: 3, backoffMs: 1000 },
        );
      } finally {
        clearTimeout(timer);
      }

      const textBlocks = response.content.filter(b => b.type === 'text');
      const output = textBlocks.map(b => b.text).join('\n');

      return {
        ok: true,
        agentName: this.definition.name,
        output,
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens,
        durationMs: Date.now() - start,
        modelo: modelId,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, agentName: this.definition.name, output: '', durationMs: Date.now() - start, error: msg, modelo: modelId };
    }
  }

  _resolveModelId(model) {
    switch (model) {
      case 'opus':  return 'claude-opus-4-8';
      case 'haiku': return 'claude-haiku-4-5-20251001';
      default:      return 'claude-sonnet-4-6';
    }
  }
}

/** @param {string} forgeRoot @returns {AgentRegistry} */
export function createAgentRegistry(forgeRoot) {
  const registry = new AgentRegistry();
  registry.load(path.join(forgeRoot, 'agents'));
  return registry;
}

/** @param {object} def @param {string} [apiKey] */
export function createAgent(def, apiKey) {
  return new LlmAgentAdapter(def, apiKey);
}
