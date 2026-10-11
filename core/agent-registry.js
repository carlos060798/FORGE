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

/** @param {number} ms */
const mensajeCortada = (ms) => `la llamada superó el tiempo máximo (${Math.round(ms / 1000)} s) y se canceló`;

/**
 * Tokens de entrada de una petición, por lo alto (tres caracteres por token). Solo se usa cuando una
 * llamada se cancela por tiempo: el proveedor pudo procesarla y no devolvió su consumo.
 * @param {...unknown} textos
 */
export function estimarTokens(...textos) {
  let caracteres = 0;
  for (const t of textos) caracteres += String(t ?? '').length;
  return Math.ceil(caracteres / 3);
}

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
   * @param {string} [apiKey]  - solo necesario para provider anthropic
   * @param {number} [globalTimeoutMs]
   * @param {string} [cwd]     - directorio del proyecto para leer sdd.config.yaml
   * @param {object} [provider] provider ya creado (por defecto, el configurado)
   */
  constructor(definition, apiKey, globalTimeoutMs, cwd, provider) {
    this.definition      = definition;
    this.globalTimeoutMs = globalTimeoutMs ?? DEFAULT_GLOBAL_TIMEOUT_MS;
    this.cwd             = cwd ?? process.cwd();
    // El provider se crea una vez y se reutiliza por instancia
    this._provider = provider ?? crearProvider({
      cwd: this.cwd,
      config: apiKey ? { api_key: apiKey } : {},
    });
  }

  async execute(ctx) {
    const start = Date.now();
    // Orden pensado para la caché de prompts (prefijo exacto): primero lo que se repite idéntico
    // entre llamadas (instrucciones del agente, objetivo y contrato de salida) y al final lo que
    // cambia (el estado). Un byte distinto al principio invalidaría todo lo que viene detrás.
    const systemParts = [this.definition.systemPrompt];
    if (this.definition.goal) systemParts.push(`\n## Objetivo\n${this.definition.goal}`);
    if (ctx.extraContext)     systemParts.push(`\n## Contexto adicional\n${ctx.extraContext}`);
    const systemFijo = systemParts.join('\n');
    if (ctx.forgeState)       systemParts.push(`\n## Estado FORGE actual\n\`\`\`json\n${ctx.forgeState}\n\`\`\``);
    const systemPrompt = systemParts.join('\n');

    const modelAlias = this.definition.model ?? 'sonnet';
    const modelId    = this._provider.resolveModelId(modelAlias);

    const effectiveTimeoutMs = this.definition.timeout_ms ?? this.globalTimeoutMs;
    const controller = new AbortController();
    let cortada = false;
    const timer = setTimeout(() => { cortada = true; controller.abort(); }, effectiveTimeoutMs);

    try {
      const result = await withRetry(
        () => this._provider.complete({
          model:        modelAlias,
          systemPrompt,
          // Parte fija del prompt de sistema (siempre un prefijo de systemPrompt): el proveedor
          // que tenga caché de prompts marca hasta aquí; los demás lo ignoran
          systemFijo,
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
        // Solo con un proveedor que informa de la caché de prompts
        ...(typeof result.cacheCreationTokens === 'number' || typeof result.cacheReadTokens === 'number'
          ? { cacheCreationTokens: result.cacheCreationTokens ?? 0, cacheReadTokens: result.cacheReadTokens ?? 0 }
          : {}),
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
        error:     cortada ? mensajeCortada(effectiveTimeoutMs) : msg,
        modelo:    modelId,
        provider:  this._provider.nombre,
        // El proveedor pudo recibir y cobrar la petición aunque aquí se cancelara la espera
        ...(cortada ? { abortada: true, tokensEstimados: estimarTokens(systemPrompt, ctx.userPrompt) } : {}),
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Un turno de una conversación con herramientas (ADR-21). Método aparte de `execute`: mismo
 * prompt de sistema, mismo tiempo máximo y mismos reintentos, pero con la lista de mensajes y
 * las herramientas en lugar de un único mensaje.
 * @this {LlmAgentAdapter}
 * @param {{ mensajes: any[], herramientas: any[], extraContext?: string }} ctx
 */
LlmAgentAdapter.prototype.conversar = async function conversar(ctx) {
  const start = Date.now();
  const systemParts = [this.definition.systemPrompt];
  if (this.definition.goal) systemParts.push(`\n## Objetivo\n${this.definition.goal}`);
  if (ctx.extraContext)     systemParts.push(`\n## Contexto adicional\n${ctx.extraContext}`);

  const modelAlias = this.definition.model ?? 'sonnet';
  const modelId    = this._provider.resolveModelId(modelAlias);
  const base       = { agentName: this.definition.name, modelo: modelId, provider: this._provider.nombre };
  if (this._provider.admiteHerramientas !== true) {
    return { ok: false, ...base, contenido: [], durationMs: 0, error: `El proveedor "${this._provider.nombre}" no admite conversaciones con herramientas.` };
  }

  const controller = new AbortController();
  const limiteMs = this.definition.timeout_ms ?? this.globalTimeoutMs;
  let cortada = false;
  const timer = setTimeout(() => { cortada = true; controller.abort(); }, limiteMs);
  try {
    const result = await withRetry(
      () => this._provider.conversar({
        model: modelAlias, systemPrompt: systemParts.join('\n'),
        mensajes: ctx.mensajes, herramientas: ctx.herramientas, maxTokens: 8192, signal: controller.signal,
      }),
      { maxAttempts: 3, backoffMs: 1000 },
    );
    return {
      ok: true, ...base, contenido: result.contenido, stopReason: result.stopReason,
      inputTokens: result.inputTokens, outputTokens: result.outputTokens,
      cacheCreationTokens: result.cacheCreationTokens, cacheReadTokens: result.cacheReadTokens,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      ok: false, ...base, contenido: [], durationMs: Date.now() - start,
      error: cortada ? mensajeCortada(limiteMs) : (err instanceof Error ? err.message : String(err)),
      ...(cortada ? { abortada: true, tokensEstimados: estimarTokens(systemParts.join('\n'), JSON.stringify(ctx.mensajes ?? []), JSON.stringify(ctx.herramientas ?? [])) } : {}),
    };
  } finally {
    clearTimeout(timer);
  }
};

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
