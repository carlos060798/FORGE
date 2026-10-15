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
import { modeloDeNivel } from './niveles.js';
import { registrarDestino } from '../session-budget.js';

const ALIASES = {
  opus:   'deepseek-r1:14b',
  sonnet: 'qwen2.5-coder:7b',
  haiku:  'llama3.2:3b',
};

const MAX_ARGUMENTOS_INVALIDOS = 2000;

/** `arguments` → entrada neutra. Lo que no es un objeto se devuelve como texto y la herramienta lo rechaza. */
function entradaDe(crudos) {
  if (crudos === undefined || crudos === null || crudos === '') return {};
  if (typeof crudos === 'object' && !Array.isArray(crudos)) return crudos;
  const texto = typeof crudos === 'string' ? crudos : JSON.stringify(crudos);
  try {
    const v = JSON.parse(texto);
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) return v;
  } catch { /* texto no válido */ }
  return texto.slice(0, MAX_ARGUMENTOS_INVALIDOS);
}

/** Conversación neutra → mensajes de /api/chat. `opaco` es de otro proveedor: se ignora. */
function aMensajesApi(systemPrompt, mensajes) {
  /** @type {any[]} */
  const salida = [{ role: 'system', content: systemPrompt }];
  /** @type {Map<string, string>} idUso → nombre de la herramienta (el mensaje `tool` lleva el nombre) */
  const nombres = new Map();
  for (const m of mensajes) {
    if (typeof m.contenido === 'string') {
      salida.push({ role: m.rol === 'asistente' ? 'assistant' : 'user', content: m.contenido });
      continue;
    }
    const bloques = m.contenido ?? [];
    for (const b of bloques) {
      if (!['texto', 'uso_herramienta', 'resultado_herramienta', 'opaco'].includes(b?.tipo)) throw new Error(`Bloque de conversación desconocido: "${b?.tipo}"`);
    }
    const textos = bloques.filter((b) => b.tipo === 'texto').map((b) => b.texto).join('\n');
    if (m.rol === 'asistente') {
      const usos = bloques.filter((b) => b.tipo === 'uso_herramienta');
      for (const u of usos) nombres.set(u.id, u.nombre);
      salida.push({
        role: 'assistant',
        content: textos,
        ...(usos.length > 0 ? { tool_calls: usos.map((u) => ({ function: { name: u.nombre, arguments: u.entrada && typeof u.entrada === 'object' ? u.entrada : {} } })) } : {}),
      });
    } else {
      for (const b of bloques.filter((x) => x.tipo === 'resultado_herramienta')) {
        salida.push({ role: 'tool', tool_name: nombres.get(b.idUso) ?? '', content: (b.esError ? 'ERROR: ' : '') + String(b.contenido ?? '') });
      }
      if (textos !== '') salida.push({ role: 'user', content: textos });
    }
  }
  return salida;
}

export class OllamaProvider extends LlmProvider {
  get nombre() { return 'ollama'; }

  /**
   * ADR-21: conversa con herramientas (API /api/chat de Ollama) salvo que el modelo ya las haya
   * rechazado en esta sesión; entonces el ciclo avisa y usa el modo de bloque (CA-003-02).
   */
  get admiteHerramientas() { return !this._sinHerramientas; }

  constructor(config = {}) {
    super();
    /** Niveles fijados en `modelos:` de sdd.config.yaml: mandan sobre los de este archivo (ADR-19) */
    this.modelos = config.modelos ?? {};
    this.baseUrl = config.base_url ?? process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
    /** El modelo rechazó las herramientas (primer error): se recuerda durante la sesión */
    this._sinHerramientas = false;
    // CA-004-01: el coste cero lo da un destino de la propia máquina, no el nombre del proveedor
    registrarDestino('ollama', this.baseUrl);
  }

  /**
   * Un turno de conversación con herramientas. Forma según el spike herramientas-por-proveedor.md:
   * `arguments` es un objeto, no hay `id` (se sintetiza, determinista), `stream` es true por defecto
   * (se pide false) y la parada es por presencia de `tool_calls`.
   * @param {{ model: string, systemPrompt: string, mensajes: any[], herramientas: any[], maxTokens?: number, signal?: AbortSignal }} params
   */
  async conversar({ model, systemPrompt, mensajes, herramientas, maxTokens = 8192, signal }) {
    if (this._sinHerramientas) {
      throw new Error(`El modelo de Ollama en ${this.baseUrl} no admite herramientas (lo rechazó antes): el ciclo usa el modo de bloque.`);
    }
    const cuerpo = /** @type {Record<string, any>} */ ({
      model: this.resolveModelId(model),
      stream: false,
      options: { num_predict: maxTokens },
      messages: aMensajesApi(systemPrompt, mensajes),
    });
    if (herramientas?.length) {
      cuerpo.tools = herramientas.map((h) => ({ type: 'function', function: { name: h.nombre, description: h.descripcion, parameters: h.esquema } }));
    }
    const res = await fetch(`${this.baseUrl.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal,
      redirect: 'error',
    });
    if (!res.ok) {
      const texto = await res.text().catch(() => '');
      if (cuerpo.tools && res.status === 400 && /does not support tools|tools? (?:is |are )?not supported|support.{0,20}tools/i.test(texto)) {
        this._sinHerramientas = true;
        throw new Error(`El modelo de Ollama no admite herramientas (HTTP 400): ${texto.slice(0, 200)}. El ciclo usará el modo de bloque.`);
      }
      throw new Error(`Ollama error ${res.status}: ${texto.slice(0, 200)}`);
    }
    /** @type {any} */
    const json = await res.json();
    const mensaje = json?.message ?? {};
    const contenido = [];
    if (typeof mensaje.content === 'string' && mensaje.content !== '') contenido.push({ tipo: 'texto', texto: mensaje.content });
    const llamadas = Array.isArray(mensaje.tool_calls) ? mensaje.tool_calls : [];
    // Turno = asistentes previos en la conversación: el mismo historial da los mismos ids
    const turno = mensajes.filter((m) => m.rol === 'asistente').length;
    llamadas.forEach((l, i) => {
      contenido.push({ tipo: 'uso_herramienta', id: `ollama-${turno}-${i}`, nombre: String(l?.function?.name ?? ''), entrada: entradaDe(l?.function?.arguments) });
    });
    let stopReason = json?.done_reason === 'length' ? 'max_tokens' : json?.done_reason === 'stop' || json?.done_reason === undefined ? 'fin' : 'otro';
    if (llamadas.length > 0 && stopReason !== 'max_tokens') stopReason = 'herramientas';
    return {
      contenido,
      stopReason,
      inputTokens: json?.prompt_eval_count,
      outputTokens: json?.eval_count,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
    };
  }

  resolveModelId(alias) {
    return modeloDeNivel(alias, this.modelos, ALIASES);
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
      redirect: 'error',
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Ollama error ${res.status}: ${text.slice(0, 200)}`);
    }

    /** @type {{ message?: { content?: string }, prompt_eval_count?: number, eval_count?: number }} */
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
