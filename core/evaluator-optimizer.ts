/**
 * evaluator-optimizer.ts — Ciclo Evaluador-Optimizador como código real
 *
 * Convierte el bloque de texto de sdd.implementar.md (líneas 345-372) en
 * un bucle while(score < 8 && intentos < 3) real y trazable.
 *
 * Solo se aplica a agentes del Grupo OPUS (arquitecto, crítico, seguridad,
 * asesor-datos, revisor) — los de Grupo SONNET/HAIKU no entran al ciclo.
 *
 * El evaluador siempre es el agente "revisor"; el implementador es quien
 * generó el output que se va a evaluar.
 */

import type { Agent, AgentContext, AgentResult } from './agent-registry.js';
import type { EventLog } from './event-log.js';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface CriterioAceptacion {
  id: string;        // e.g. "CA-001"
  descripcion: string;
}

export interface EvaluacionIteracion {
  iteracion: number;
  score: number;              // promedio 0-10
  scoresPorCA: Record<string, number>;
  feedback: string;
  aprobado: boolean;
}

export interface EvaluatorOptimizerResult {
  aprobado: boolean;
  iteraciones: number;
  outputFinal: string;
  historial: EvaluacionIteracion[];
  scoreFinal: number;
  error?: string;
}

// ── Agentes del Grupo OPUS (únicos que activan el ciclo) ─────────────────────

export const GRUPO_OPUS = new Set([
  'arquitecto',
  'architecture-designer',
  'critico',
  'seguridad',
  'asesor-datos',
  'revisor',
]);

export function requiereEvaluador(agenteNombre: string): boolean {
  return GRUPO_OPUS.has(agenteNombre);
}

// ── EvaluatorOptimizer ────────────────────────────────────────────────────────

export class EvaluatorOptimizer {
  private readonly implementador: Agent;
  private readonly evaluador: Agent;
  private readonly log: EventLog;
  private readonly maxIteraciones: number;
  private readonly umbral: number;

  constructor(
    implementador: Agent,
    evaluador: Agent,
    log: EventLog,
    options: { maxIteraciones?: number; umbral?: number } = {},
  ) {
    this.implementador = implementador;
    this.evaluador = evaluador;
    this.log = log;
    this.maxIteraciones = options.maxIteraciones ?? 3;
    this.umbral = options.umbral ?? 8;
  }

  /**
   * Ejecuta el ciclo completo para una tarea.
   *
   * @param ctx      Contexto del agente implementador (prompt de la tarea)
   * @param criterios Criterios de aceptación que el evaluador puntuará
   * @param taskId   ID de la tarea (para el event log)
   */
  async run(
    ctx: AgentContext,
    criterios: CriterioAceptacion[],
    taskId: string,
  ): Promise<EvaluatorOptimizerResult> {
    const historial: EvaluacionIteracion[] = [];
    let outputActual = '';
    let feedbackAnterior = '';

    for (let i = 1; i <= this.maxIteraciones; i++) {
      // ── Paso 1: El implementador genera (o mejora) el output ─────────────
      const promptImpl = feedbackAnterior
        ? this.buildMejorPrompt(ctx.userPrompt, outputActual, feedbackAnterior)
        : ctx.userPrompt;

      this.log.append('agent_invoked', {
        taskId,
        agente: this.implementador.definition.name,
        iteracion: i,
        fase: 'implementacion',
      }, { taskId, agent: this.implementador.definition.name });

      const implResult: AgentResult = await this.implementador.execute({
        ...ctx,
        userPrompt: promptImpl,
      });

      if (!implResult.ok) {
        return {
          aprobado: false,
          iteraciones: i,
          outputFinal: '',
          historial,
          scoreFinal: 0,
          error: `Implementador falló en iteración ${i}: ${implResult.error}`,
        };
      }

      outputActual = implResult.output;

      // ── Paso 2: El evaluador (revisor) puntúa el output ──────────────────
      const evalPrompt = this.buildEvalPrompt(outputActual, criterios, ctx.userPrompt);

      this.log.append('agent_invoked', {
        taskId,
        agente: this.evaluador.definition.name,
        iteracion: i,
        fase: 'evaluacion',
      }, { taskId, agent: this.evaluador.definition.name });

      const evalResult: AgentResult = await this.evaluador.execute({
        ...ctx,
        userPrompt: evalPrompt,
      });

      if (!evalResult.ok) {
        // Si el evaluador falla, usamos score 0 para que reintente
        historial.push({ iteracion: i, score: 0, scoresPorCA: {}, feedback: 'Evaluador falló', aprobado: false });
        continue;
      }

      // ── Paso 3: Parsear la respuesta del evaluador ────────────────────────
      const evaluacion = this.parseEvaluacion(evalResult.output, criterios, i);
      historial.push(evaluacion);

      this.log.append('custom', {
        taskId,
        tipo: 'evaluacion',
        iteracion: i,
        score: evaluacion.score,
        aprobado: evaluacion.aprobado,
      }, { taskId });

      // ── Paso 4: Decidir si continuar o terminar ───────────────────────────
      if (evaluacion.aprobado) {
        return {
          aprobado: true,
          iteraciones: i,
          outputFinal: outputActual,
          historial,
          scoreFinal: evaluacion.score,
        };
      }

      feedbackAnterior = evaluacion.feedback;
    }

    // Sin aprobación tras maxIteraciones
    const scoreFinal = historial[historial.length - 1]?.score ?? 0;
    const causas = historial[historial.length - 1]
      ? Object.entries(historial[historial.length - 1].scoresPorCA)
          .filter(([, s]) => s < this.umbral)
          .map(([id, s]) => `${id}: ${s}/10`)
          .join(', ')
      : 'sin evaluación';

    return {
      aprobado: false,
      iteraciones: this.maxIteraciones,
      outputFinal: outputActual,
      historial,
      scoreFinal,
      error: `Score ${scoreFinal}/10 tras ${this.maxIteraciones} iteraciones (umbral: ${this.umbral}). CAs no aprobados: ${causas}`,
    };
  }

  // ── Constructores de prompts ───────────────────────────────────────────────

  private buildEvalPrompt(output: string, criterios: CriterioAceptacion[], tareaOriginal: string): string {
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
  "feedback": "<feedback concreto y accionable para mejorar el output, máx 3 párrafos>"
}
\`\`\`

No incluyas texto fuera del bloque JSON.`;
  }

  private buildMejorPrompt(tareaOriginal: string, outputAnterior: string, feedback: string): string {
    return `${tareaOriginal}

## Tu intento anterior (mejorar basándote en el feedback)
${outputAnterior}

## Feedback del revisor
${feedback}

Incorpora el feedback y genera una versión mejorada. No repitas el intento anterior sin cambios.`;
  }

  // ── Parser de la respuesta del evaluador ──────────────────────────────────

  private parseEvaluacion(
    evalOutput: string,
    criterios: CriterioAceptacion[],
    iteracion: number,
  ): EvaluacionIteracion {
    // Extraer bloque JSON de la respuesta
    const jsonMatch = evalOutput.match(/```json\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : evalOutput;

    try {
      const parsed = JSON.parse(jsonStr) as {
        scores: Record<string, number>;
        feedback: string;
      };

      const scoresPorCA: Record<string, number> = {};
      for (const ca of criterios) {
        const raw = parsed.scores?.[ca.id];
        scoresPorCA[ca.id] = typeof raw === 'number' ? Math.min(10, Math.max(0, raw)) : 5;
      }

      const valores = Object.values(scoresPorCA);
      const score = valores.length > 0
        ? Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 10) / 10
        : 0;

      return {
        iteracion,
        score,
        scoresPorCA,
        feedback: String(parsed.feedback ?? ''),
        aprobado: score >= this.umbral,
      };
    } catch {
      // Si el JSON no parsea, score conservador de 5
      return {
        iteracion,
        score: 5,
        scoresPorCA: Object.fromEntries(criterios.map(ca => [ca.id, 5])),
        feedback: evalOutput.slice(0, 500),
        aprobado: false,
      };
    }
  }
}
