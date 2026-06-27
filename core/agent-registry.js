/**
 * agent-registry.js — Carga agents/*.md como objetos tipados e invoca al LLM
 *
 * El provider de LLM se resuelve en orden:
 *   1. FORGE_LLM_PROVIDER env var
 *   2. llm.provider en .sdd/sdd.config.yaml
 *   3. Detección automática por env vars (ANTHROPIC_API_KEY, OPENAI_API_KEY, etc.)
 *   4. Fallback: anthropic
 */

import * as fs from 'fs';
import * as path from 'path';
import { crearProvider } from './llm-providers/index.js';

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
  /**
   * @param {object} definition
   * @param {string} [apiKey]  — solo necesario para provider anthropic
   * @param {number} [globalTimeoutMs]
   * @param {string} [cwd]     — directorio del proyecto para leer sdd.config.yaml
   */
  constructor(definition, apiKey, globalTimeoutMs, cwd) {
    this.definition      = definition;
    this.globalTimeoutMs = globalTimeoutMs ?? DEFAULT_GLOBAL_TIMEOUT_MS;
    this.cwd             = cwd ?? process.cwd();
    // El provider se crea una vez y se reutiliza por instancia
    this._provider = crearProvider({
      cwd: this.cwd,
      config: apiKey ? { api_key: apiKey } : {},
    });
  }

  async execute(ctx) {
    const start = Date.now();
    const systemParts = [this.definition.systemPrompt];
    if (this.definition.goal) systemParts.push(`\n## Objetivo\n${this.definition.goal}`);
    if (ctx.forgeState)       systemParts.push(`\n## Estado FORGE actual\n\`\`\`json\n${ctx.forgeState}\n\`\`\``);
    if (ctx.extraContext)     systemParts.push(`\n## Contexto adicional\n${ctx.extraContext}`);
    const systemPrompt = systemParts.join('\n');

    const modelAlias = this.definition.model ?? 'sonnet';
    const modelId    = this._provider.resolveModelId(modelAlias);

    const effectiveTimeoutMs = this.definition.timeout_ms ?? this.globalTimeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), effectiveTimeoutMs);

    try {
      const result = await withRetry(
        () => this._provider.complete({
          model:        modelAlias,
          systemPrompt,
          userPrompt:   ctx.userPrompt,
          maxTokens:    8192,
          signal:       controller.signal,
        }),
        { maxAttempts: 3, backoffMs: 1000 },
      );

      return {
        ok:           true,
        agentName:    this.definition.name,
        output:       result.output,
        inputTokens:  result.inputTokens,
        outputTokens: result.outputTokens,
        durationMs:   Date.now() - start,
        modelo:       modelId,
        provider:     this._provider.nombre,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok:        false,
        agentName: this.definition.name,
        output:    '',
        durationMs: Date.now() - start,
        error:     msg,
        modelo:    modelId,
        provider:  this._provider.nombre,
      };
    } finally {
      clearTimeout(timer);
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
