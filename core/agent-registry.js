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
import { crearProvider, leerTimeoutLlmMs } from './llm-providers/index.js';
import { esNivel } from './llm-providers/niveles.js';

const DEFAULT_GLOBAL_TIMEOUT_MS = 120_000;

/** @param {number} ms @param {number} [intentos] */
const mensajeCortada = (ms, intentos = 1) => `la llamada superó el tiempo máximo (${Math.round(ms / 1000)} s) y se canceló${intentos > 1 ? ` (${intentos} intentos cancelados por tiempo; cada uno pudo cobrarse)` : ''}`;

/**
 * Tokens de entrada de una petición, por lo alto. Solo se usa cuando no hay consumo real (llamada
 * cancelada por tiempo o respuesta sin consumo válido): el proveedor pudo cobrarla.
 *
 * ASCII: tres caracteres por token. No se baja a 3,5: el código y el JSON, con muchos símbolos,
 * rondan 3 y una estimación que se queda corta deja el gasto por debajo de lo cobrado (Principio VIII).
 * Fuera de ASCII (CJK, emoji, acentos): la mitad de los bytes UTF-8 del tramo, porque un carácter CJK
 * ocupa 3 bytes y suele costar 1 o 2 tokens, y un emoji 4 bytes y 2 o 3 tokens.
 * @param {...unknown} textos
 */
export function estimarTokens(...textos) {
  let ascii = 0;
  let bytesNoAscii = 0;
  for (const t of textos) {
    const s = String(t ?? '');
    const resto = s.replace(/[\x00-\x7f]/g, '');
    ascii += s.length - resto.length;
    if (resto.length > 0) bytesNoAscii += Buffer.byteLength(resto, 'utf8');
  }
  return Math.ceil(ascii / 3) + Math.ceil(bytesNoAscii / 2);
}

/** Por encima de este tamaño de petición (caracteres) el tiempo por intento crece, 1 s por cada 1000. */
const CARACTERES_SIN_RECARGO = 30_000;

/**
 * Tiempo máximo de UN intento: el base, más un segundo por cada 1000 caracteres de petición por
 * encima de 30 000, sin pasar del triple del base. Determinista: depende solo del tamaño.
 * @param {number} baseMs @param {number} caracteres
 */
export function tiempoPorIntento(baseMs, caracteres) {
  const recargo = Math.floor(Math.max(0, caracteres - CARACTERES_SIN_RECARGO) / 1000) * 1000;
  return Math.min(baseMs + recargo, baseMs * 3);
}

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw, avisos: [] };

  const meta = {};
  /** Lo que este lector descarta o aplana sin que el significado de una cabecera válida cambie (spec perfiles-de-agente). */
  const avisos = [];
  const lineas = match[1].split('\n');
  for (let i = 0; i < lineas.length; i++) {
    const line = lineas[i];
    const colon = line.indexOf(':');
    if (colon < 1) {
      if (/^\s+-\s/.test(line) || /^-\s/.test(line)) avisos.push(`línea ${i + 2}: un elemento de lista YAML («- ...») se ignora; este lector solo admite listas en una línea, como tools: ["Read","Grep"]`);
      continue;
    }
    const key = line.slice(0, colon).trim();
    let value = line.slice(colon + 1).trim();
    // Una clave con sangría pertenece a un bloque anidado, que este lector no entiende: se aplana y puede pisar una de primer nivel
    if (/^\s/.test(line)) avisos.push(`línea ${i + 2}: la clave "${key}" está anidada; este lector la trata como de primer nivel y podría pisar otra`);
    if (value.startsWith('[')) {
      try { meta[key] = JSON.parse(value.replace(/'/g, '"')); } catch {
        meta[key] = value;
        avisos.push(`línea ${i + 2}: "${key}" no es una lista válida (¿faltan las comillas? Usa ${key}: ["Read","Grep"]); se ignora`);
      }
      continue;
    }
    value = value.replace(/^["']|["']$/g, '');
    meta[key] = value;
    if (key === 'tools' && value !== '') avisos.push(`línea ${i + 2}: "tools" debe ser una lista entre corchetes, como tools: ["Read","Grep"]; se ignora`);
    if (key === 'tools' && value === '') avisos.push(`línea ${i + 2}: "tools" está vacío o es una lista YAML con guiones; se ignora. Usa tools: ["Read","Grep"]`);
  }
  return { meta, body: match[2], avisos };
}

/**
 * Lo que el lector de cabeceras descarta o aplana en silencio. Vacío si la cabecera es del formato admitido.
 * @param {string} raw contenido completo de un agents/*.md
 * @returns {string[]}
 */
export function avisosDeCabecera(raw) {
  return parseFrontmatter(raw).avisos;
}

/**
 * Cabecera `model:` de un agente. Un nivel (alto|medio|economico u opus|sonnet|haiku) se conserva con
 * el nombre escrito; un identificador que contiene opus/haiku/sonnet se reduce a ese alias; un
 * identificador directo de otro proveedor se deja tal cual (antes se degradaba a sonnet); sin valor, sonnet.
 */
function normalizeModel(raw) {
  const original = String(raw ?? '').trim();
  const s = original.toLowerCase();
  if (s === '') return 'sonnet';
  if (esNivel(s)) return s;
  if (s.includes('opus'))  return 'opus';
  if (s.includes('haiku')) return 'haiku';
  if (s.includes('sonnet')) return 'sonnet';
  return original;
}

export class AgentRegistry {
  constructor() {
    this.agents = new Map();
    /** @type {{ archivo: string, aviso: string }[]} */
    this.avisos = [];
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
      const { meta, body, avisos } = parseFrontmatter(raw);
      for (const aviso of avisos) {
        this.avisos.push({ archivo: file, aviso });
        console.warn(`[Fragua] agents/${file}: ${aviso}`);
      }
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

/**
 * Ejecuta `intento` con tiempo máximo POR INTENTO, cada uno con su propio AbortController (la señal
 * de un intento cancelado no sirve para el siguiente). El tiempo total queda acotado a dos intentos.
 * Una cancelación por tiempo se reintenta como mucho una vez; cada intento cancelado pudo cobrarse,
 * así que se estima su entrada con `estimarEntrada` y se devuelve acumulada.
 * @param {(signal: AbortSignal) => Promise<any>} intento
 * @param {{ porIntentoMs: number, estimarEntrada: () => number, maxIntentos?: number, backoffMs?: number }} o
 * @returns {Promise<any>}
 */
async function conReintentos(intento, { porIntentoMs, estimarEntrada, maxIntentos = 3, backoffMs = 1000 }) {
  const inicio = Date.now();
  const totalMs = porIntentoMs * 2;
  let canceladas = 0;
  let tokensCancelados = 0;
  /** @type {unknown} */ let error;
  let ultimaCortada = false;
  for (let n = 1; n <= maxIntentos; n++) {
    const restante = totalMs - (Date.now() - inicio);
    // El único reintento tras un tiempo agotado tiene su intento completo; los demás reintentos
    // (429, 503...) comparten el tiempo total, para que la espera no se multiplique
    if (n > 1 && !ultimaCortada && restante <= 0) break;
    const controller = new AbortController();
    let cortada = false;
    const limite = ultimaCortada ? porIntentoMs : Math.max(1, Math.min(porIntentoMs, restante));
    const timer = setTimeout(() => { cortada = true; controller.abort(); }, limite);
    let espera = 0;
    try {
      const result = await intento(controller.signal);
      return { ok: true, result, canceladas, tokensCancelados };
    } catch (err) {
      error = err;
      ultimaCortada = cortada;
      if (cortada) {
        canceladas++;
        tokensCancelados += estimarEntrada();
        if (canceladas > 1) break;          // un solo reintento tras tiempo agotado
      } else {
        if (!isRetryable(err) || n === maxIntentos) break;
        espera = backoffMs * n;
      }
    } finally {
      clearTimeout(timer);
    }
    if (espera > 0) await new Promise(r => setTimeout(r, espera));
  }
  return { ok: false, error, ultimaCortada, canceladas, tokensCancelados };
}

/** Campos que acompañan a un resultado cuando hubo intentos cancelados por tiempo. */
function datosCancelados(c) {
  return c.canceladas > 0
    ? { abortada: true, tokensEstimados: c.tokensCancelados, intentosCancelados: c.canceladas }
    : {};
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
    this.cwd             = cwd ?? process.cwd();
    // `llm.timeout_s` de sdd.config.yaml (validado); sin él, 120 s
    this.globalTimeoutMs = globalTimeoutMs ?? leerTimeoutLlmMs(this.cwd) ?? DEFAULT_GLOBAL_TIMEOUT_MS;
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

    const porIntentoMs = tiempoPorIntento(this.definition.timeout_ms ?? this.globalTimeoutMs, String(systemPrompt).length + String(ctx.userPrompt ?? '').length);
    const estimarEntrada = () => estimarTokens(systemPrompt, ctx.userPrompt);

    const c = await conReintentos(
      (signal) => this._provider.complete({
        model:        modelAlias,
        systemPrompt,
        // Parte fija del prompt de sistema (siempre un prefijo de systemPrompt): el proveedor
        // que tenga caché de prompts marca hasta aquí; los demás lo ignoran
        systemFijo,
        userPrompt:   ctx.userPrompt,
        maxTokens:    8192,
        signal,
      }),
      { porIntentoMs, estimarEntrada },
    );

    if (c.ok) {
      const result = c.result;
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
        // Estimación de la entrada, para anotar el gasto si el proveedor no informa del consumo (N-06)
        tokensEntradaEstimados: estimarEntrada(),
        // Intentos previos cancelados por tiempo: pudieron cobrarse aunque este saliera bien
        ...(c.canceladas > 0 ? { intentosCancelados: c.canceladas, tokensEstimadosCancelados: c.tokensCancelados } : {}),
      };
    }
    const msg = c.error instanceof Error ? c.error.message : String(c.error);
    return {
      ok:        false,
      agentName: this.definition.name,
      output:    '',
      durationMs: Date.now() - start,
      error:     c.ultimaCortada ? mensajeCortada(porIntentoMs, c.canceladas) : msg,
      modelo:    modelId,
      provider:  this._provider.nombre,
      // El proveedor pudo recibir y cobrar cada intento aunque aquí se cancelara la espera
      ...datosCancelados(c),
    };
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

  const systemPrompt = systemParts.join('\n');
  const mensajesJson = JSON.stringify(ctx.mensajes ?? []);
  const herramientasJson = JSON.stringify(ctx.herramientas ?? []);
  const estimarEntrada = () => estimarTokens(systemPrompt, mensajesJson, herramientasJson);
  const porIntentoMs = tiempoPorIntento(
    this.definition.timeout_ms ?? this.globalTimeoutMs,
    systemPrompt.length + mensajesJson.length + herramientasJson.length,
  );
  const c = await conReintentos(
    (signal) => this._provider.conversar({
      model: modelAlias, systemPrompt,
      mensajes: ctx.mensajes, herramientas: ctx.herramientas, maxTokens: 8192, signal,
    }),
    { porIntentoMs, estimarEntrada },
  );
  if (c.ok) {
    const result = c.result;
    return {
      ok: true, ...base, contenido: result.contenido, stopReason: result.stopReason,
      inputTokens: result.inputTokens, outputTokens: result.outputTokens,
      cacheCreationTokens: result.cacheCreationTokens, cacheReadTokens: result.cacheReadTokens,
      durationMs: Date.now() - start,
      tokensEntradaEstimados: estimarEntrada(),
      ...(c.canceladas > 0 ? { intentosCancelados: c.canceladas, tokensEstimadosCancelados: c.tokensCancelados } : {}),
    };
  }
  return {
    ok: false, ...base, contenido: [], durationMs: Date.now() - start,
    error: c.ultimaCortada ? mensajeCortada(porIntentoMs, c.canceladas) : (c.error instanceof Error ? c.error.message : String(c.error)),
    ...datosCancelados(c),
  };
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
