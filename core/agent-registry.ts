/**
 * agent-registry.ts — Carga los agents/*.md como objetos tipados y provee
 * un LlmAgentAdapter que los invoca vía Anthropic SDK.
 *
 * Los 14 agentes siguen siendo la fuente de verdad (agents/*.md);
 * el registry los lee, nunca los reescribe.
 */

import * as fs from 'fs';
import * as path from 'path';

// ── Tipos públicos ────────────────────────────────────────────────────────────

export interface AgentDefinition {
  /** Nombre del agente (slug del frontmatter, e.g. "desarrollador-backend") */
  name: string;
  description: string;
  model: 'opus' | 'sonnet' | 'haiku';
  tools: string[];
  goal?: string;
  backstory?: string;
  /** Cuerpo Markdown sin el bloque YAML de frontmatter */
  systemPrompt: string;
  /** Ruta absoluta al archivo .md */
  filePath: string;
}

export interface AgentContext {
  /** Directorio de trabajo del proyecto del usuario */
  cwd: string;
  /** Prompt con la tarea concreta que el agente debe ejecutar */
  userPrompt: string;
  /** Estado FORGE actual (serializado como string para el system prompt) */
  forgeState?: string;
  /** Tokens de contexto adicional inyectados antes del userPrompt */
  extraContext?: string;
}

export interface AgentResult {
  ok: boolean;
  agentName: string;
  /** Texto de respuesta del LLM */
  output: string;
  /** Tokens consumidos (disponible si el SDK los expone) */
  inputTokens?: number;
  outputTokens?: number;
  durationMs: number;
  error?: string;
}

export interface Agent {
  readonly definition: AgentDefinition;
  execute(ctx: AgentContext): Promise<AgentResult>;
}

// ── Parser de frontmatter YAML mínimo ────────────────────────────────────────
// Evita depender de una librería externa; solo parsea los campos que nos interesan.

function parseFrontmatter(raw: string): { meta: Record<string, unknown>; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };

  const yamlBlock = match[1];
  const body = match[2];
  const meta: Record<string, unknown> = {};

  for (const line of yamlBlock.split('\n')) {
    const colon = line.indexOf(':');
    if (colon < 1) continue;
    const key = line.slice(0, colon).trim();
    let value: string = line.slice(colon + 1).trim();

    // Array inline: ["a", "b"] → string[]
    if (value.startsWith('[')) {
      try {
        meta[key] = JSON.parse(value.replace(/'/g, '"'));
      } catch {
        meta[key] = value;
      }
      continue;
    }
    // Quitar comillas simples/dobles
    value = value.replace(/^["']|["']$/g, '');
    meta[key] = value;
  }

  return { meta, body };
}

function normalizeModel(raw: unknown): AgentDefinition['model'] {
  const s = String(raw ?? '').toLowerCase();
  if (s.includes('opus')) return 'opus';
  if (s.includes('haiku')) return 'haiku';
  return 'sonnet';
}

// ── AgentRegistry ─────────────────────────────────────────────────────────────

export class AgentRegistry {
  private readonly agents: Map<string, AgentDefinition> = new Map();

  /**
   * Carga todos los agents/*.md del directorio dado.
   * @param agentsDir Ruta absoluta a la carpeta agents/
   */
  load(agentsDir: string): void {
    if (!fs.existsSync(agentsDir)) {
      throw new Error(`agents/ no encontrado: ${agentsDir}`);
    }

    const files = fs.readdirSync(agentsDir)
      .filter(f => f.endsWith('.md'))
      .sort();

    for (const file of files) {
      const filePath = path.join(agentsDir, file);
      const raw = fs.readFileSync(filePath, 'utf8');
      const { meta, body } = parseFrontmatter(raw);

      const name = String(meta['name'] ?? path.basename(file, '.md'));
      const def: AgentDefinition = {
        name,
        description: String(meta['description'] ?? ''),
        model: normalizeModel(meta['model']),
        tools: Array.isArray(meta['tools']) ? meta['tools'] as string[] : [],
        goal: meta['goal'] ? String(meta['goal']) : undefined,
        backstory: meta['backstory'] ? String(meta['backstory']) : undefined,
        systemPrompt: body.trim(),
        filePath,
      };

      this.agents.set(name, def);
    }
  }

  get(name: string): AgentDefinition | undefined {
    return this.agents.get(name);
  }

  getOrThrow(name: string): AgentDefinition {
    const def = this.agents.get(name);
    if (!def) throw new Error(`Agente no encontrado: "${name}". Registrados: ${[...this.agents.keys()].join(', ')}`);
    return def;
  }

  list(): AgentDefinition[] {
    return [...this.agents.values()];
  }

  has(name: string): boolean {
    return this.agents.has(name);
  }

  /** Registra un agente dinámicamente (plugin system, Fase 3) */
  register(def: AgentDefinition): void {
    this.agents.set(def.name, def);
  }
}

// ── LlmAgentAdapter ───────────────────────────────────────────────────────────
// Implementación real cuando el SDK está disponible; stub cuando no.

export class LlmAgentAdapter implements Agent {
  readonly definition: AgentDefinition;
  private readonly apiKey: string;

  constructor(definition: AgentDefinition, apiKey?: string) {
    this.definition = definition;
    this.apiKey = apiKey ?? process.env['ANTHROPIC_API_KEY'] ?? '';
  }

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();

    // Construir el system prompt completo
    const systemParts: string[] = [this.definition.systemPrompt];
    if (this.definition.goal) {
      systemParts.push(`\n## Objetivo\n${this.definition.goal}`);
    }
    if (ctx.forgeState) {
      systemParts.push(`\n## Estado FORGE actual\n\`\`\`json\n${ctx.forgeState}\n\`\`\``);
    }
    if (ctx.extraContext) {
      systemParts.push(`\n## Contexto adicional\n${ctx.extraContext}`);
    }
    const systemPrompt = systemParts.join('\n');

    // Seleccionar model ID correcto
    const modelId = this.resolveModelId(this.definition.model);

    try {
      // Intento dinámico de importar el SDK — sin hacerlo una dependencia dura
      // para que el módulo compile aunque el SDK no esté instalado localmente.
      const sdkModule = await import('@anthropic-ai/sdk').catch(() => null);

      if (!sdkModule || !this.apiKey) {
        // Modo stub: devuelve una respuesta vacía trazable (útil en tests sin API key)
        return {
          ok: true,
          agentName: this.definition.name,
          output: `[stub] Agente "${this.definition.name}" ejecutado sin API key. Prompt: ${ctx.userPrompt.slice(0, 100)}`,
          durationMs: Date.now() - start,
        };
      }

      const client = new sdkModule.default({ apiKey: this.apiKey });
      const response = await client.messages.create({
        model: modelId,
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: 'user', content: ctx.userPrompt }],
      });

      const textBlocks = response.content.filter((b: { type: string }) => b.type === 'text');
      const output = textBlocks.map((b: { text: string }) => b.text).join('\n');

      return {
        ok: true,
        agentName: this.definition.name,
        output,
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens,
        durationMs: Date.now() - start,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        agentName: this.definition.name,
        output: '',
        durationMs: Date.now() - start,
        error: msg,
      };
    }
  }

  private resolveModelId(model: AgentDefinition['model']): string {
    switch (model) {
      case 'opus':    return 'claude-opus-4-8';
      case 'haiku':   return 'claude-haiku-4-5-20251001';
      case 'sonnet':
      default:        return 'claude-sonnet-4-6';
    }
  }
}

// ── Factory convenience ───────────────────────────────────────────────────────

/**
 * Carga el registry desde el directorio del proyecto y devuelve
 * una función que crea adaptadores listos para usar.
 */
export function createAgentRegistry(forgeRoot: string): AgentRegistry {
  const registry = new AgentRegistry();
  registry.load(path.join(forgeRoot, 'agents'));
  return registry;
}

export function createAgent(def: AgentDefinition, apiKey?: string): Agent {
  return new LlmAgentAdapter(def, apiKey);
}
