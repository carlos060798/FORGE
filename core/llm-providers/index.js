/**
 * index.js — Registry de LLM providers para FORGE
 *
 * Orden de resolución del provider:
 *   1. Variable de entorno FORGE_LLM_PROVIDER
 *   2. Campo llm.provider en sdd.config.yaml
 *   3. Detección automática por variables de entorno disponibles
 *   4. Fallback: anthropic (comportamiento previo)
 *
 * Providers disponibles:
 *   anthropic  — Claude (Anthropic API)
 *   openai     — GPT-4o / Codex / Azure OpenAI / GitHub Models / Cursor
 *   ollama     — Modelos locales (llama3, mistral, deepseek, qwen, etc.)
 *   stub       — Tests y CI sin LLM
 *
 * Ejemplo sdd.config.yaml:
 *   llm:
 *     provider: ollama
 *     base_url: http://localhost:11434
 *     model: sonnet
 *
 *   llm:
 *     provider: openai
 *     api_key: sk-...
 *     model: gpt-4o
 *     base_url: https://models.inference.ai.azure.com   # GitHub Models
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { AnthropicProvider } from './anthropic-provider.js';
import { OpenAIProvider }    from './openai-provider.js';
import { OllamaProvider }    from './ollama-provider.js';
import { StubProvider }      from './stub-provider.js';

/** Lee la sección llm: de sdd.config.yaml de forma simple (sin parser YAML completo) */
function leerConfigLlm(cwd) {
  const configPath = join(cwd, '.sdd', 'sdd.config.yaml');
  if (!existsSync(configPath)) return {};
  const yaml = readFileSync(configPath, 'utf8');

  const config = {};
  let enSeccionLlm = false;

  for (const line of yaml.split('\n')) {
    if (/^llm\s*:/.test(line)) { enSeccionLlm = true; continue; }
    // Salir de la sección si encontramos otra clave de primer nivel
    if (enSeccionLlm && /^\S/.test(line) && !/^#/.test(line)) { enSeccionLlm = false; }
    if (!enSeccionLlm) continue;

    const m = line.match(/^\s{2,}(\w+)\s*:\s*(.+)/);
    if (m) config[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return config;
}

/**
 * Detecta el mejor provider disponible según variables de entorno.
 * Se usa cuando no hay config explícita.
 */
function detectarProvider() {
  if (process.env.FORGE_LLM_PROVIDER) return process.env.FORGE_LLM_PROVIDER;
  if (process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY) return 'anthropic';
  if (process.env.OPENAI_API_KEY)    return 'openai';
  if (process.env.OLLAMA_BASE_URL)   return 'ollama';
  // Intentar Ollama local silenciosamente (común en entornos de desarrollo)
  return 'anthropic'; // fallback histórico
}

/**
 * Crea y devuelve el provider configurado.
 * @param {{ cwd?: string, config?: object }} opts
 * @returns {import('./provider-interface.js').LlmProvider}
 */
export function crearProvider(opts = {}) {
  const cwd        = opts.cwd ?? process.cwd();
  const configYaml = leerConfigLlm(cwd);
  const config     = { ...configYaml, ...opts.config };

  const nombreProvider = (
    process.env.FORGE_LLM_PROVIDER ??
    config.provider ??
    detectarProvider()
  ).toLowerCase();

  switch (nombreProvider) {
    case 'anthropic':
    case 'claude':
      return new AnthropicProvider(config);

    case 'openai':
    case 'gpt':
    case 'codex':
    case 'azure':
    case 'github-models':
    case 'cursor':
      return new OpenAIProvider(config);

    case 'ollama':
    case 'local':
    case 'deepseek':
    case 'llama':
      return new OllamaProvider(config);

    case 'stub':
    case 'test':
      return new StubProvider();

    default:
      // Nombre desconocido: intentar como base_url de Ollama si parece URL
      if (nombreProvider.startsWith('http')) {
        return new OllamaProvider({ base_url: nombreProvider, ...config });
      }
      console.warn(`[FORGE] Provider desconocido: "${nombreProvider}". Usando anthropic.`);
      return new AnthropicProvider(config);
  }
}

export { AnthropicProvider, OpenAIProvider, OllamaProvider, StubProvider };
