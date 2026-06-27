/**
 * evaluator-optimizer.js — Ciclo Evaluador-Optimizador como código real
 */

import { execSync } from 'child_process';
import { detectStack } from './stack-detector.js';

export const GRUPO_OPUS = new Set([
  'arquitecto', 'architecture-designer', 'critico', 'seguridad', 'asesor-datos', 'revisor',
]);

export const GRUPO_DISENO = new Set([
  'product-designer', 'architecture-designer', 'desarrollador-frontend',
]);

/** @param {string} agenteNombre @returns {boolean} */
export function requiereRubricVisual(agenteNombre) {
  return GRUPO_DISENO.has(agenteNombre);
}

export const RUBRIC_VISUAL = [
  { id: 'RV-01', descripcion: 'La paleta de colores coincide con el design token definido (primario, secundario, neutros)' },
  { id: 'RV-02', descripcion: 'La tipografía usa la familia y escala de tamaños correctas (h1-h6, body, caption)' },
  { id: 'RV-03', descripcion: 'Los espaciados (padding/margin/gap) siguen la escala de 4px base' },
  { id: 'RV-04', descripcion: 'Los componentes interactivos tienen estado hover, focus y disabled visibles' },
  { id: 'RV-05', descripcion: 'El contraste de texto cumple WCAG AA (≥4.5:1 para texto normal, ≥3:1 para grande)' },
  { id: 'RV-06', descripcion: 'Los iconos son consistentes en estilo, tamaño y peso visual' },
  { id: 'RV-07', descripcion: 'El layout usa grid o flex de forma coherente sin posicionamiento absoluto arbitrario' },
  { id: 'RV-08', descripcion: 'Los bordes, sombras y radios son consistentes con el design system' },
  { id: 'RV-09', descripcion: 'Los componentes son responsivos y no se rompen en mobile (≤375px) ni desktop (≥1280px)' },
  { id: 'RV-10', descripcion: 'Las animaciones y transiciones son suaves (≤300ms ease) y no distraen' },
  { id: 'RV-11', descripcion: 'El flujo de usuario principal es completo y no tiene pantallas rotas o estados vacíos sin diseño' },
  { id: 'RV-12', descripcion: 'El output es coherente con el DESIGN.md del proyecto (si existe)' },
];

/** @param {number} checksAprobados @returns {number} */
export function calcularScoreVisual(checksAprobados) {
  return Math.round((checksAprobados / RUBRIC_VISUAL.length) * 10 * 10) / 10;
}

/** @param {string} agenteNombre @returns {boolean} */
export function requiereEvaluador(agenteNombre) {
  return GRUPO_OPUS.has(agenteNombre);
}

function _ejecutarTestsSuite(cwd) {
  try {
    const stack = detectStack(cwd);
    const cmd = stack?.test_cmd;
    if (!cmd) return { ok: true, salida: 'Sin test_cmd detectado — se omite verificación', duracionMs: 0 };
    const inicio = Date.now();
    execSync(cmd, { cwd, stdio: 'pipe', timeout: 120_000 });
    return { ok: true, salida: 'Tests pasando ✓', duracionMs: Date.now() - inicio };
  } catch (err) {
    const salida = err instanceof Error ? err.message.slice(0, 500) : String(err);
    return { ok: false, salida, duracionMs: 0 };
  }
}

export class EvaluatorOptimizer {
  constructor(implementador, evaluador, log, options = {}) {
    this.implementador   = implementador;
    this.evaluador       = evaluador;
    this.log             = log;
    this.maxIteraciones  = options.maxIteraciones ?? 3;
    this.umbral          = options.umbral ?? 8;
  }

  async run(ctx, criterios, taskId) {
    const historial = [];
    let outputActual = '';
    let feedbackAnterior = '';

    for (let i = 1; i <= this.maxIteraciones; i++) {
      const promptImpl = feedbackAnterior
        ? this._buildMejorPrompt(ctx.userPrompt, outputActual, feedbackAnterior)
        : ctx.userPrompt;

      this.log.append('agent_invoked', { taskId, agente: this.implementador.definition.name, iteracion: i, fase: 'implementacion' }, { taskId, agent: this.implementador.definition.name });

      const implResult = await this.implementador.execute({ ...ctx, userPrompt: promptImpl });

      if (!implResult.ok) {
        return { aprobado: false, iteraciones: i, outputFinal: '', historial, scoreFinal: 0, error: `Implementador falló en iteración ${i}: ${implResult.error}` };
      }

      outputActual = implResult.output;

      const evalPrompt = this._buildEvalPrompt(outputActual, criterios, ctx.userPrompt);
      this.log.append('agent_invoked', { taskId, agente: this.evaluador.definition.name, iteracion: i, fase: 'evaluacion' }, { taskId, agent: this.evaluador.definition.name });

      const evalResult = await this.evaluador.execute({ ...ctx, userPrompt: evalPrompt });

      if (!evalResult.ok) {
        historial.push({ iteracion: i, score: 0, scoresPorCA: {}, feedback: 'Evaluador falló', aprobado: false });
        continue;
      }

      const evaluacionLLM = this._parseEvaluacion(evalResult.output, criterios, i);
      const scoreTexto = evaluacionLLM.score;
      const resultadoTests = _ejecutarTestsSuite(process.cwd());
      const scoreFinal = resultadoTests.ok
        ? Math.round((scoreTexto * 0.4 + 10 * 0.6) * 10) / 10
        : Math.round(scoreTexto * 0.4 * 10) / 10;

      let { feedback } = evaluacionLLM;
      if (!resultadoTests.ok) feedback += `\n\n⚠ Tests fallando:\n${resultadoTests.salida}`;

      const evaluacion = { ...evaluacionLLM, score: scoreFinal, feedback, aprobado: scoreFinal >= this.umbral };
      historial.push(evaluacion);
      this.log.append('custom', { taskId, tipo: 'evaluacion', iteracion: i, score: scoreFinal, scoreTexto, testsOk: resultadoTests.ok, aprobado: evaluacion.aprobado }, { taskId });

      if (evaluacion.aprobado) {
        return { aprobado: true, iteraciones: i, outputFinal: outputActual, historial, scoreFinal };
      }
      feedbackAnterior = evaluacion.feedback;
    }

    const scoreFinal = historial[historial.length - 1]?.score ?? 0;
    const causas = historial[historial.length - 1]
      ? Object.entries(historial[historial.length - 1].scoresPorCA)
          .filter(([, s]) => s < this.umbral)
          .map(([id, s]) => `${id}: ${s}/10`)
          .join(', ')
      : 'sin evaluación';

    return { aprobado: false, iteraciones: this.maxIteraciones, outputFinal: outputActual, historial, scoreFinal, error: `Score ${scoreFinal}/10 tras ${this.maxIteraciones} iteraciones (umbral: ${this.umbral}). CAs no aprobados: ${causas}` };
  }

  _buildEvalPrompt(output, criterios, tareaOriginal) {
    const listaCA = criterios.map(ca => `- ${ca.id}: ${ca.descripcion}`).join('\n');
    return `Eres el agente Revisor de FORGE. Evalúa el siguiente output generado por un agente implementador.

## Tarea original
${tareaOriginal}

## Output a evaluar
${output}

## Criterios de aceptación (CA)
${listaCA}

## Instrucciones de evaluación
Para cada CA asigna un score de 0 a 10. Responde EXACTAMENTE en este formato JSON:

\`\`\`json
{
  "scores": {
${criterios.map(ca => `    "${ca.id}": <número 0-10>`).join(',\n')}
  },
  "feedback": "<feedback concreto y accionable, máx 3 párrafos>"
}
\`\`\`

No incluyas texto fuera del bloque JSON.`;
  }

  _buildMejorPrompt(tareaOriginal, outputAnterior, feedback) {
    return `${tareaOriginal}

## Tu intento anterior (mejorar basándote en el feedback)
${outputAnterior}

## Feedback del revisor
${feedback}

Incorpora el feedback y genera una versión mejorada. No repitas el intento anterior sin cambios.`;
  }

  _parseEvaluacion(evalOutput, criterios, iteracion) {
    const jsonMatch = evalOutput.match(/```json\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : evalOutput;
    try {
      const parsed = JSON.parse(jsonStr);
      const scoresPorCA = {};
      for (const ca of criterios) {
        const raw = parsed.scores?.[ca.id];
        scoresPorCA[ca.id] = typeof raw === 'number' ? Math.min(10, Math.max(0, raw)) : 5;
      }
      const valores = Object.values(scoresPorCA);
      const score = valores.length > 0
        ? Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 10) / 10
        : 0;
      return { iteracion, score, scoresPorCA, feedback: String(parsed.feedback ?? ''), aprobado: score >= this.umbral };
    } catch {
      return { iteracion, score: 5, scoresPorCA: Object.fromEntries(criterios.map(ca => [ca.id, 5])), feedback: evalOutput.slice(0, 500), aprobado: false };
    }
  }
}
