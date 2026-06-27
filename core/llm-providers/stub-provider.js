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

import { LlmProvider } from './provider-interface.js';

export class StubProvider extends LlmProvider {
  get nombre() { return 'stub'; }

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
