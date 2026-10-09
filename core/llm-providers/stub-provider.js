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

import { readFileSync } from 'node:fs';
import { LlmProvider } from './provider-interface.js';

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
   */
  constructor(config = {}) {
    super();
    let guion = config.guion ?? null;
    if (!guion && process.env.FORGE_STUB_GUION) {
      guion = JSON.parse(readFileSync(process.env.FORGE_STUB_GUION, 'utf8'));
      if (!Array.isArray(guion)) throw new Error('FORGE_STUB_GUION debe contener una lista de respuestas.');
    }
    this._guion = Array.isArray(guion) ? [...guion] : guion;
    /** Peticiones recibidas por `conversar`, para que un test las inspeccione. */
    this.conversaciones = [];
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

  async complete({ userPrompt }) {
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
