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
 *
 * Los niveles opus/sonnet/haiku se pueden fijar por proyecto (ADR-19):
 *   modelos:
 *     sonnet: claude-sonnet-5-5
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { AnthropicProvider } from './anthropic-provider.js';
import { OpenAIProvider }    from './openai-provider.js';
import { OllamaProvider }    from './ollama-provider.js';
import { StubProvider }      from './stub-provider.js';
import { leerModelosDe }     from '../ciclo/config.js';
import { leerVariable, leerVariableRestrictiva } from '../entorno.js';

/** Lee la sección llm: de sdd.config.yaml de forma simple (sin parser YAML completo) */
function leerConfigLlm(cwd) {
  const configPath = join(cwd, '.sdd', 'sdd.config.yaml');
  if (!existsSync(configPath)) return {};
  const yaml = readFileSync(configPath, 'utf8');

  const config = {};
  let enSeccionLlm = false;

  for (const line of yaml.split('\n')) {
    if (/^llm\s*:/.test(line)) {
      // Estilo de flujo (`llm: { cache: false }`): este lector no lo entiende y lo ignoraría sin
      // avisar, dejando la caché activa aunque el usuario la apagó (revisión H-07)
      if (/^llm\s*:\s*[{\[|>]/.test(line)) throw new Error('.sdd/sdd.config.yaml: la sección "llm:" debe escribirse como un bloque (una clave por línea, con sangría de 2 o más espacios), no entre llaves ni en una línea.');
      enSeccionLlm = true; continue;
    }
    // Salir de la sección si encontramos otra clave de primer nivel
    if (enSeccionLlm && /^\S/.test(line) && !/^#/.test(line)) { enSeccionLlm = false; }
    if (!enSeccionLlm) continue;

    if (/^\s*(?:#.*)?$/.test(line)) continue;
    // Una sangría de un espacio o con tabulaciones no la lee este analizador: antes se ignoraba la
    // clave en silencio; ahora se rechaza con un error claro (revisión H-07)
    if (/^\t/.test(line) || /^ [^ \t]/.test(line) || /^ +\t/.test(line)) {
      throw new Error(`.sdd/sdd.config.yaml: la línea "${line.trim()}" de la sección "llm:" tiene una sangría que no se admite; usa 2 o más espacios (sin tabulaciones).`);
    }
    const m = line.match(/^\s{2,}(\w+)\s*:\s*(.+)/);
    if (m) config[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return config;
}

/** Variable del ENTORNO DEL USUARIO con los servidores de modelo que acepta además de los oficiales. */
export const VARIABLE_HOSTS_LLM = 'FORGE_LLM_HOSTS';

const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * ¿Puede un archivo del PROYECTO dirigir las llamadas al modelo a esta dirección?
 * El proyecto es no confiable (puede ser un repositorio ajeno): una dirección suya recibiría la clave
 * del usuario y el contenido del proyecto. Solo vale si es la máquina local, o si el USUARIO la
 * nombró en su entorno (`FORGE_LLM_HOSTS`, lista separada por comas de host o host:puerto), y solo
 * por HTTPS (HTTP únicamente hacia la propia máquina).
 * @param {string} direccion
 * @param {Record<string, string|undefined>} [env]
 * @returns {boolean}
 */
export function destinoDeModeloPermitido(direccion, env = process.env) {
  let u;
  try { u = new URL(direccion); } catch { return false; }
  if (u.username || u.password) return false;
  const local = LOOPBACK.has(u.hostname.toLowerCase());
  if (u.protocol === 'http:') return local;
  if (u.protocol !== 'https:') return false;
  if (local) return true;
  const permitidos = String(leerVariableRestrictiva('LLM_HOSTS', env, '') ?? '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  return permitidos.includes(u.hostname.toLowerCase()) || permitidos.includes(u.host.toLowerCase());
}

const R_AVISO_ENTORNO = (url, variable) => '[FORGE] .sdd/sdd.config.yaml: «llm.base_url» (' + url + ') se ignora: tu entorno fija ' + variable + ' y manda sobre el archivo del proyecto.';
const R_AVISO_LOOPBACK = (url) => '[FORGE] .sdd/sdd.config.yaml: «llm.base_url» (' + url + ') se ignora: es una dirección de tu propia máquina que el proyecto fija y que tú no pediste; con un proveedor remoto recibiría tu clave. Si es tuya, define OPENAI_BASE_URL en tu entorno o añade ese host:puerto a ' + VARIABLE_HOSTS_LLM + '.';

/** ¿Es una dirección de la propia máquina? */
function esLoopback(direccion) {
  try { return LOOPBACK.has(new URL(direccion).hostname.toLowerCase()); } catch { return false; }
}

/** ¿Nombró el usuario este host (o host:puerto) en su entorno? */
function usuarioNombroElHost(direccion, env) {
  try {
    const u = new URL(direccion);
    const lista = String(leerVariableRestrictiva('LLM_HOSTS', env, '') ?? '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
    return lista.includes(u.host.toLowerCase()) || lista.includes(u.hostname.toLowerCase());
  } catch { return false; }
}

/** ¿El proveedor elegido es local y no usa clave (Ollama y compatibles)? */
function proveedorSinClave(proveedorDelProyecto, env) {
  const nombre = String(leerVariable('LLM_PROVIDER', env) ?? proveedorDelProyecto ?? '').toLowerCase();
  return ['ollama', 'local', 'deepseek', 'llama'].includes(nombre) || nombre.startsWith('http');
}

/**
 * Quita de lo leído del archivo del proyecto todo lo que decidiría a dónde va la clave o el contenido:
 * credenciales (solo valen por el entorno del usuario) y direcciones no permitidas. Avisa de cada cosa.
 * @param {Record<string, string>} config
 * @param {Record<string, string|undefined>} [env]
 * @param {(m: string) => void} [avisar]
 */
export function sanearConfigDelProyecto(config, env = process.env, avisar = (m) => console.warn(m)) {
  const limpia = { ...config };
  for (const clave of ['api_key', 'api_version']) {
    if (clave in limpia) {
      delete limpia[clave];
      avisar(`[FORGE] .sdd/sdd.config.yaml: «llm.${clave}» se ignora. Una credencial no puede venir de un archivo del proyecto; defínela en tu entorno (ANTHROPIC_API_KEY, OPENAI_API_KEY).`);
    }
  }
  // H-4: lo que el USUARIO fija en su entorno manda siempre sobre el archivo del proyecto
  if ('base_url' in limpia) {
    const sinClave = proveedorSinClave(limpia.provider, env);
    const delUsuario = env[sinClave ? 'OLLAMA_BASE_URL' : 'OPENAI_BASE_URL'];
    if (delUsuario) {
      avisar(R_AVISO_ENTORNO(limpia.base_url, sinClave ? 'OLLAMA_BASE_URL' : 'OPENAI_BASE_URL'));
      delete limpia.base_url;
    } else if (!sinClave && esLoopback(limpia.base_url) && !usuarioNombroElHost(limpia.base_url, env)) {
      // Un proveedor remoto envía su clave en cada llamada: el proyecto no puede mandarla a un
      // puerto de la propia máquina que el usuario no pidió (otro servicio local podría leerla)
      avisar(R_AVISO_LOOPBACK(limpia.base_url));
      delete limpia.base_url;
    }
  }
  if ('base_url' in limpia && !destinoDeModeloPermitido(limpia.base_url, env)) {
    avisar(`[FORGE] .sdd/sdd.config.yaml: «llm.base_url» (${limpia.base_url}) se ignora: el proyecto no puede dirigir las llamadas al modelo a un servidor que tú no hayas permitido. Si es tuyo, añade su host a ${VARIABLE_HOSTS_LLM} en tu entorno, o define OPENAI_BASE_URL / OLLAMA_BASE_URL.`);
    delete limpia.base_url;
  }
  if (typeof limpia.provider === 'string' && /^https?:/i.test(limpia.provider.trim()) && !destinoDeModeloPermitido(limpia.provider.trim(), env)) {
    avisar(`[FORGE] .sdd/sdd.config.yaml: «llm.provider» con una dirección (${limpia.provider}) se ignora por el mismo motivo.`);
    delete limpia.provider;
  }
  return limpia;
}

/**
 * Tiempo máximo por intento de una llamada (`llm.timeout_s`, en segundos), en milisegundos.
 * Sin la clave, `null` (el llamador usa 120 s). Un valor que no sea un número entre 1 y 3600 es un error.
 * @param {string} [cwd]
 * @returns {number|null}
 */
export function leerTimeoutLlmMs(cwd = process.cwd()) {
  const crudo = leerConfigLlm(cwd).timeout_s;
  if (crudo === undefined) return null;
  const n = Number(crudo);
  if (!/^\d+(\.\d+)?$/.test(String(crudo)) || !Number.isFinite(n) || n < 1 || n > 3600) {
    throw new Error(`.sdd/sdd.config.yaml: llm.timeout_s debe ser un número de segundos entre 1 y 3600 (recibido "${crudo}").`);
  }
  return Math.round(n * 1000);
}

/**
 * Detecta el mejor provider disponible según variables de entorno.
 * Se usa cuando no hay config explícita.
 */
function detectarProvider() {
  const delEntorno = leerVariable('LLM_PROVIDER');
  if (delEntorno) return delEntorno;
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
  const configYaml = sanearConfigDelProyecto(leerConfigLlm(cwd));
  // ADR-19: los niveles (opus/sonnet/haiku) que indique `modelos:` del proyecto mandan
  // sobre los que trae cada proveedor
  const modelos    = { ...leerModelosDe(cwd), ...opts.config?.modelos };
  const config     = { ...configYaml, ...opts.config, modelos };

  const nombreProvider = (
    leerVariable('LLM_PROVIDER') ??
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
      return new StubProvider(config);

    default:
      // Nombre desconocido: intentar como base_url de Ollama si parece URL
      if (nombreProvider.startsWith('http')) {
        // Llega aquí desde FORGE_LLM_PROVIDER (el usuario) o desde opts.config (el llamador): el
        // archivo del proyecto ya no puede traer una dirección sin permiso (sanearConfigDelProyecto)
        return new OllamaProvider({ base_url: nombreProvider, ...config });
      }
      console.warn(`[FORGE] Provider desconocido: "${nombreProvider}". Usando anthropic.`);
      return new AnthropicProvider(config);
  }
}

export { AnthropicProvider, OpenAIProvider, OllamaProvider, StubProvider };
