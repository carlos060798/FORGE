/**
 * stub-provider.js — Provider de stub para tests y CI sin LLM
 *
 * Devuelve respuestas deterministas sin llamar a ningún LLM.
 * Útil para:
 *   - Tests unitarios y E2E
 *   - CI/CD que no tiene acceso a API keys
 *   - Desarrollo local rápido sin consumir tokens
 *
 * Config en sdd.config.yaml:
 *   llm:
 *     provider: stub
 *
 * O activar vía variable de entorno:
 *   FORGE_LLM_PROVIDER=stub npx forge step ir
 */

import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { LlmProvider } from './provider-interface.js';
import { leerVariable } from '../entorno.js';

/**
 * Las reglas que exige una API real: empieza el usuario, los roles alternan y cada herramienta pedida
 * recibe su resultado en el mensaje siguiente, con los resultados antes que cualquier texto.
 * @param {any[]} mensajes
 */
export function comprobarConversacion(mensajes) {
  if (!Array.isArray(mensajes) || mensajes.length === 0 || mensajes[0].rol !== 'usuario') throw new Error('stub: la conversación debe empezar con un mensaje del usuario');
  for (let i = 0; i < mensajes.length; i++) {
    const m = mensajes[i];
    if (i > 0 && m.rol === mensajes[i - 1].rol) throw new Error(`stub: dos mensajes seguidos de "${m.rol}" (posición ${i})`);
    const bloques = Array.isArray(m.contenido) ? m.contenido : [];
    const anterior = i > 0 && Array.isArray(mensajes[i - 1].contenido) ? mensajes[i - 1].contenido : [];
    const pedidas = m.rol === 'usuario' ? anterior.filter((b) => b.tipo === 'uso_herramienta').map((b) => b.id) : [];
    const resultados = bloques.filter((b) => b.tipo === 'resultado_herramienta');
    if (m.rol === 'asistente' && resultados.length > 0) throw new Error('stub: un resultado de herramienta solo puede ir en un mensaje del usuario');
    if (JSON.stringify(resultados.map((b) => b.idUso)) !== JSON.stringify(pedidas)) {
      throw new Error(`stub: los resultados de herramienta del mensaje ${i} no corresponden a las herramientas pedidas`);
    }
    if (bloques.slice(0, resultados.length).some((b) => b.tipo !== 'resultado_herramienta')) throw new Error('stub: los resultados de herramienta deben ir primero');
  }
  if (mensajes[mensajes.length - 1].rol !== 'usuario') throw new Error('stub: la conversación debe terminar con un mensaje del usuario');
}

export class StubProvider extends LlmProvider {
  get nombre() { return 'stub'; }

  /**
   * @param {{ guion?: any[] | ((peticion: any, n: number) => any) }} [config]
   *   `guion`: respuestas de `conversar`, en orden (o una función que las produce). Cada una:
   *   { contenido: Bloque[], stopReason?, inputTokens?, outputTokens? }. Sin guion, el proveedor de
   *   pruebas no admite herramientas. `FORGE_STUB_GUION` puede apuntar a un archivo JSON con la lista.
   *   Además (`config` o un objeto en ese archivo): `completar`, reglas para `complete`; `registro`,
   *   archivo donde se anota cada llamada; `registrarPrompts`, para guardar también los prompts; y
   *   `conversar`, el guion de conversación cuando el archivo es un objeto.
   */
  constructor(config = {}) {
    super();
    const c = /** @type {any} */ (config);
    let guion = c.guion ?? null;
    // Reglas para `complete` (ver `_regla`), archivo de registro y si este guarda los prompts
    let completar = c.completar ?? null;
    let registro = c.registro ?? null;
    let registrarPrompts = c.registrarPrompts === true;
    const archivoGuion = leerVariable('STUB_GUION');
    if (!guion && !completar && archivoGuion) {
      const leido = JSON.parse(readFileSync(archivoGuion, 'utf8'));
      // Una lista es el guion de conversación de siempre; un objeto lleva además las reglas de `complete`
      const objeto = leido && typeof leido === 'object' && !Array.isArray(leido);
      guion = objeto ? leido.conversar ?? null : leido;
      if (objeto) { completar = leido.completar ?? null; registro = leido.registro ?? null; registrarPrompts = leido.registrarPrompts === true; }
      if (guion !== null && !Array.isArray(guion)) throw new Error('FORGE_STUB_GUION debe contener una lista de respuestas.');
      if (completar !== null && !Array.isArray(completar)) throw new Error('FORGE_STUB_GUION: "completar" debe ser una lista de reglas { si, salida }.');
    }
    this._guion = Array.isArray(guion) ? [...guion] : guion;
    /**
     * Reglas de `complete`: [{ si: expresión regular, salida, demoraMs?, hasta?, inputTokens?, outputTokens? }].
     * Responde la primera cuya `si` coincide con el prompt de sistema o con el del usuario. No hay
     * orden ni se gastan: un proceso que reanuda tras un corte recibe lo mismo que el que se cortó.
     * @type {{ si?: string, salida?: string, demoraMs?: number, hasta?: string, inputTokens?: number, outputTokens?: number }[] | null}
     */
    this._completar = Array.isArray(completar) ? completar : null;
    /** Archivo JSONL donde se anota el inicio y el fin de cada llamada atendida por una regla. */
    this._registro = typeof registro === 'string' && registro ? registro : null;
    this._registrarPrompts = registrarPrompts;
    /** Peticiones recibidas por `conversar`, para que un test las inspeccione. */
    this.conversaciones = [];
  }

  /** @param {Record<string, unknown>} entrada */
  _anotar(entrada) {
    if (this._registro) appendFileSync(this._registro, JSON.stringify({ ts: Date.now(), pid: process.pid, ...entrada }) + '\n', 'utf8');
  }

  /**
   * Atiende `complete` con las reglas del guion. null si ninguna coincide.
   * @param {string} systemPrompt @param {string} userPrompt
   */
  async _regla(systemPrompt, userPrompt) {
    const texto = `${systemPrompt}\n${userPrompt}`;
    const i = (this._completar ?? []).findIndex((r) => new RegExp(String(r.si ?? ''), 's').test(texto));
    if (i === -1) return null;
    const regla = /** @type {NonNullable<typeof this._completar>} */ (this._completar)[i];
    const huella = createHash('sha256').update(texto).digest('hex').slice(0, 16);
    this._anotar({ fase: 'inicio', regla: i, huella, ...(this._registrarPrompts ? { systemPrompt, userPrompt } : {}) });
    // La demora deja una ventana en la que un test puede cortar el proceso con la llamada en curso
    if (Number(regla.demoraMs) > 0) await new Promise((r) => setTimeout(r, Number(regla.demoraMs)));
    // `hasta`: la llamada no responde mientras no exista ese archivo (el test decide cuándo, sin depender del reloj)
    while (typeof regla.hasta === 'string' && regla.hasta && !existsSync(regla.hasta)) await new Promise((r) => setTimeout(r, 25));
    this._anotar({ fase: 'fin', regla: i, huella });
    return { output: String(regla.salida ?? ''), inputTokens: regla.inputTokens ?? 0, outputTokens: regla.outputTokens ?? 0 };
  }

  /** ADR-21: solo con un guion de conversación. */
  get admiteHerramientas() { return this._guion !== null; }

  /** Devuelve la siguiente respuesta del guion. Comprueba que la conversación recibida está bien formada. */
  async conversar(peticion) {
    if (this._guion === null) return super.conversar(peticion);
    comprobarConversacion(peticion.mensajes);
    this.conversaciones.push(JSON.parse(JSON.stringify({ ...peticion, signal: undefined })));
    const n = this.conversaciones.length;
    const r = typeof this._guion === 'function' ? await this._guion(peticion, n) : this._guion.shift();
    if (!r) throw new Error(`stub: guion de conversación agotado en el turno ${n}`);
    const contenido = r.contenido ?? [];
    return {
      contenido,
      stopReason: r.stopReason ?? (contenido.some((b) => b.tipo === 'uso_herramienta') ? 'herramientas' : 'fin'),
      inputTokens: r.inputTokens ?? 0,
      outputTokens: r.outputTokens ?? 0,
    };
  }

  resolveModelId(alias) { return `stub-${alias}`; }

  async complete({ systemPrompt = '', userPrompt = '' }) {
    if (this._completar) {
      const guionizada = await this._regla(String(systemPrompt), String(userPrompt));
      if (guionizada) return guionizada;
    }
    // Respuesta mínima válida para cada tipo de artefacto detectado por el prompt
    if (/ir\.json|requirements|IR/i.test(userPrompt)) {
      return {
        output: JSON.stringify({
          id: 'stub-ir', confidence: 0.9,
          product: { name: 'Stub Project', type: 'api' },
          features: { core: ['Feature stub'] },
          requires_clarification: false,
          questions_for_user: [],
        }),
        inputTokens: 0, outputTokens: 0,
      };
    }
    if (/spec\.md|especificaci/i.test(userPrompt)) {
      return {
        output: '# Spec stub\n\n## REQ-001\nRequisito stub generado por StubProvider.',
        inputTokens: 0, outputTokens: 0,
      };
    }
    return {
      output: `[stub] Respuesta generada para: ${userPrompt.slice(0, 60)}...`,
      inputTokens: 0,
      outputTokens: 0,
    };
  }
}
