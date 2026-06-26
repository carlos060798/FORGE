/**
 * orchestrator.ts — Motor central de ejecución del pipeline FORGE
 *
 * Posee el grafo de dependencias entre tareas y controla la ejecución
 * secuencial → paralela. Reemplaza el pseudocódigo Promise.all de
 * sdd.implementar.md (líneas 183-235) con código real.
 *
 * Relación con otros módulos:
 *   - AgentRegistry → obtiene la definición de cada agente
 *   - LlmAgentAdapter → invoca al LLM con el system prompt del agente
 *   - Runner → ejecuta tests/lint/build tras cada tarea de código
 *   - PipelineStateMachine → avanza el pipeline cuando corresponde
 *   - EventLog → persiste cada evento (task_started, task_completed, …)
 *   - StateStore → lee y escribe el ForgeEstado
 */

import type { AgentRegistry, Agent, AgentContext, AgentDefinition } from './agent-registry.js';
import { LlmAgentAdapter } from './agent-registry.js';
import type { Runner } from './runners/runner.js';
import type { PipelineStateMachine } from './state-machine.js';
import type { EventLog } from './event-log.js';
import type { StateStore } from './state-store.js';
import { bus } from './event-bus.js';
import { sessionBudget } from './session-budget.js';
import { circuitBreaker } from './execution-context.js';

// ── Tipos de tarea ─────────────────────────────────────────────────────────────

export type TaskStatus = 'pendiente' | 'en_progreso' | 'completada' | 'fallida' | 'omitida';

export interface Task {
  id: string;                    // e.g. "T001"
  agente: string;                // nombre del agente (key en AgentRegistry)
  prompt: string;                // prompt de la tarea concreta
  /** IDs de tareas que deben completarse antes de esta */
  dependencias?: string[];
  /** Si true, los errores no detienen el pipeline */
  opcional?: boolean;
  /** Contexto extra inyectado en el AgentContext */
  extraContext?: string;
}

export interface TaskResult {
  taskId: string;
  agente: string;
  status: TaskStatus;
  output: string;
  durationMs: number;
  error?: string;
  /** Resultado del runner tras la tarea (si aplica) */
  runnerResult?: { ok: boolean; stdout: string; stderr: string };
}

export interface OrchestratorResult {
  ok: boolean;
  completedTasks: TaskResult[];
  failedTasks: TaskResult[];
  totalDurationMs: number;
}

// ── Configuración del Orchestrator ────────────────────────────────────────────

export interface OrchestratorOptions {
  /** Directorio de trabajo del proyecto del usuario */
  cwd: string;
  /** Umbral de paralelismo: ejecutar en paralelo si hay ≥N tareas independientes */
  parallelThreshold?: number;
  /** Si true, detener el pipeline al primer fallo no-opcional */
  stopOnFailure?: boolean;
  /** Runner de lenguaje para ejecutar tests tras tareas de código */
  runner?: Runner;
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

export class Orchestrator {
  private readonly registry: AgentRegistry;
  private readonly stateMachine: PipelineStateMachine;
  private readonly log: EventLog;
  private readonly store: StateStore;
  private readonly options: Required<OrchestratorOptions>;

  constructor(
    registry: AgentRegistry,
    stateMachine: PipelineStateMachine,
    log: EventLog,
    store: StateStore,
    options: OrchestratorOptions,
  ) {
    this.registry = registry;
    this.stateMachine = stateMachine;
    this.log = log;
    this.store = store;
    this.options = {
      parallelThreshold: 3,
      stopOnFailure: true,
      runner: undefined as unknown as Runner,
      ...options,
    };
  }

  /**
   * Ejecuta un conjunto de tareas respetando el grafo de dependencias.
   * Las tareas independientes se agrupan y se envían en paralelo cuando
   * el grupo tiene ≥ parallelThreshold elementos.
   */
  async run(tasks: Task[], apiKey?: string): Promise<OrchestratorResult> {
    const startTime = Date.now();
    const completedTasks: TaskResult[] = [];
    const failedTasks: TaskResult[] = [];

    // Reconstruir el estado desde el event-log (para resume)
    const knownStates = this.log.replayTaskStates();
    const completed = new Set<string>(
      [...knownStates.entries()]
        .filter(([, v]) => v.estado === 'completada')
        .map(([id]) => id)
    );

    // Ordenar tareas en niveles topológicos (BFS sobre el grafo de dependencias)
    const levels = this.topologicalLevels(tasks);

    for (const level of levels) {
      // Filtrar tareas ya completadas (resume logic)
      const pending = level.filter(t => !completed.has(t.id));
      if (pending.length === 0) continue;

      let levelResults: TaskResult[];

      if (pending.length >= this.options.parallelThreshold) {
        levelResults = await this.runParallel(pending, apiKey);
      } else {
        levelResults = await this.runSequential(pending, apiKey);
      }

      for (const result of levelResults) {
        if (result.status === 'completada') {
          completedTasks.push(result);
          completed.add(result.taskId);
        } else if (result.status === 'fallida') {
          failedTasks.push(result);
          if (!this.taskIsOptional(result.taskId, tasks) && this.options.stopOnFailure) {
            return {
              ok: false,
              completedTasks,
              failedTasks,
              totalDurationMs: Date.now() - startTime,
            };
          }
        }
      }
    }

    return {
      ok: failedTasks.length === 0,
      completedTasks,
      failedTasks,
      totalDurationMs: Date.now() - startTime,
    };
  }

  /**
   * Ejecuta una revisión paralela estilo B3 de sdd.implementar.md:
   * revisor + crítico + seguridad sobre el mismo diff/context.
   */
  async runReviewParallel(
    reviewerNames: string[],
    sharedPrompt: string,
    apiKey?: string,
  ): Promise<TaskResult[]> {
    const tasks: Task[] = reviewerNames.map((agente, i) => ({
      id: `REVIEW-${String(i).padStart(3, '0')}`,
      agente,
      prompt: sharedPrompt,
    }));
    return this.runParallel(tasks, apiKey);
  }

  // ── Ejecución paralela ──────────────────────────────────────────────────────

  private async runParallel(tasks: Task[], apiKey?: string): Promise<TaskResult[]> {
    this.log.append('custom', { message: `Iniciando ${tasks.length} tareas en paralelo`, taskIds: tasks.map(t => t.id) });
    const promises = tasks.map(t => this.executeTask(t, apiKey));
    const results = await Promise.allSettled(promises);
    return results.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      const task = tasks[i];
      return {
        taskId: task.id,
        agente: task.agente,
        status: 'fallida' as const,
        output: '',
        error: r.reason?.message ?? 'Error no capturado en ejecución paralela',
        durationMs: 0,
      } satisfies TaskResult;
    });
  }

  // ── Ejecución secuencial ────────────────────────────────────────────────────

  private async runSequential(tasks: Task[], apiKey?: string): Promise<TaskResult[]> {
    const results: TaskResult[] = [];
    for (const task of tasks) {
      const result = await this.executeTask(task, apiKey);
      results.push(result);
      if (result.status === 'fallida' && !task.opcional && this.options.stopOnFailure) {
        break;
      }
    }
    return results;
  }

  // ── Ejecución de una tarea individual ──────────────────────────────────────

  private async executeTask(task: Task, apiKey?: string): Promise<TaskResult> {
    const start = Date.now();

    if (circuitBreaker.nivel === 'sandbox') {
      const resultado: TaskResult = {
        taskId: task.id,
        agente: task.agente,
        status: 'omitida',
        output: '',
        error: `CircuitBreaker activo (nivel sandbox) — tarea omitida automáticamente. Resuelve los errores anteriores y ejecuta /sdd.estado para resetear.`,
        durationMs: 0,
      };
      await bus.emit('task:failed', { taskId: task.id, agente: task.agente, error: resultado.error! });
      return resultado;
    }

    this.log.append('task_started', { taskId: task.id, agente: task.agente }, { taskId: task.id, agent: task.agente });

    // Obtener la definición del agente
    const def = this.registry.get(task.agente);
    if (!def) {
      const error = `Agente desconocido: "${task.agente}"`;
      this.log.append('task_failed', { taskId: task.id, error }, { taskId: task.id });
      await bus.emit('task:failed', { taskId: task.id, agente: task.agente, error });
      return { taskId: task.id, agente: task.agente, status: 'fallida', output: '', durationMs: Date.now() - start, error };
    }

    // Construir el contexto del agente
    const estado = this.store.read();
    const ctx: AgentContext = {
      cwd: this.options.cwd,
      userPrompt: task.prompt,
      forgeState: JSON.stringify(estado, null, 2),
      extraContext: task.extraContext,
    };

    // Invocar el agente
    const agent: Agent = new LlmAgentAdapter(def, apiKey);
    this.log.append('agent_invoked', { agente: task.agente, taskId: task.id }, { taskId: task.id, agent: task.agente });

    const agentResult = await agent.execute(ctx);
    this.log.append('agent_result', {
      taskId: task.id,
      ok: agentResult.ok,
      inputTokens: agentResult.inputTokens,
      outputTokens: agentResult.outputTokens,
    }, { taskId: task.id, agent: task.agente });
    await bus.emit('agent:result', {
      agente: task.agente,
      taskId: task.id,
      tokens_input: agentResult.inputTokens ?? 0,
      tokens_output: agentResult.outputTokens ?? 0,
      modelo: agentResult.modelo ?? 'claude-sonnet-4-6',
      durationMs: agentResult.durationMs ?? 0,
      ok: agentResult.ok,
    });

    if (!agentResult.ok) {
      const error = agentResult.error ?? 'El agente falló sin mensaje de error';
      this.log.append('task_failed', { taskId: task.id, error }, { taskId: task.id });
      await bus.emit('task:failed', { taskId: task.id, agente: task.agente, error });
      return { taskId: task.id, agente: task.agente, status: 'fallida', output: '', durationMs: Date.now() - start, error };
    }

    // Ejecutar runner (tests/lint) si hay uno disponible y la tarea es de código
    let runnerResult: TaskResult['runnerResult'];
    if (this.options.runner && this.isCodeTask(task, def)) {
      const rr = await this.runTests();
      runnerResult = { ok: rr.ok, stdout: rr.stdout, stderr: rr.stderr };
      this.log.append('runner_result', { taskId: task.id, ok: rr.ok, exitCode: rr.exitCode }, { taskId: task.id });

      if (!rr.ok) {
        this.log.append('task_failed', { taskId: task.id, reason: 'runner_failed' }, { taskId: task.id });
        await bus.emit('task:failed', { taskId: task.id, agente: task.agente, error: `Runner falló: ${rr.stderr.slice(0, 300)}` });
        return {
          taskId: task.id, agente: task.agente, status: 'fallida',
          output: agentResult.output, durationMs: Date.now() - start,
          error: `Runner falló: ${rr.stderr.slice(0, 300)}`, runnerResult,
        };
      }
    }

    this.log.append('task_completed', { taskId: task.id }, { taskId: task.id });
    await bus.emit('task:completed', { taskId: task.id, agente: task.agente, durationMs: agentResult.durationMs ?? 0 });
    return {
      taskId: task.id,
      agente: task.agente,
      status: 'completada',
      output: agentResult.output,
      durationMs: Date.now() - start,
      runnerResult,
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /**
   * Organiza las tareas en niveles topológicos (Kahn's algorithm).
   * Las tareas del mismo nivel pueden ejecutarse en paralelo.
   */
  private topologicalLevels(tasks: Task[]): Task[][] {
    const taskMap = new Map<string, Task>(tasks.map(t => [t.id, t]));
    const inDegree = new Map<string, number>(tasks.map(t => [t.id, 0]));

    // Calcular grado de entrada
    for (const task of tasks) {
      for (const dep of task.dependencias ?? []) {
        if (taskMap.has(dep)) {
          inDegree.set(task.id, (inDegree.get(task.id) ?? 0) + 1);
        }
      }
    }

    const levels: Task[][] = [];
    let remaining = new Set<string>(tasks.map(t => t.id));

    while (remaining.size > 0) {
      // Tareas sin dependencias pendientes
      const ready = [...remaining].filter(id => (inDegree.get(id) ?? 0) === 0);

      if (ready.length === 0) {
        // Ciclo detectado — añadir las restantes como un nivel para no bloquearse
        levels.push([...remaining].map(id => taskMap.get(id)!));
        break;
      }

      levels.push(ready.map(id => taskMap.get(id)!));

      // Reducir el in-degree de las tareas que dependen de las que ya procesamos
      for (const doneId of ready) {
        remaining.delete(doneId);
        for (const task of tasks) {
          if ((task.dependencias ?? []).includes(doneId)) {
            inDegree.set(task.id, Math.max(0, (inDegree.get(task.id) ?? 1) - 1));
          }
        }
      }
    }

    return levels;
  }

  private taskIsOptional(taskId: string, tasks: Task[]): boolean {
    return tasks.find(t => t.id === taskId)?.opcional ?? false;
  }

  private isCodeTask(task: Task, agent: AgentDefinition | undefined): boolean {
    // Si el agente declara explícitamente is_code_agent, úsalo
    if (agent?.is_code_agent !== undefined) return agent.is_code_agent;
    // Fallback: lista curada (sin architecture-designer que es diseño, no código)
    const CODE_AGENTS = new Set(['desarrollador-backend', 'desarrollador-frontend', 'tester']);
    return CODE_AGENTS.has(task.agente);
  }

  private async runTests(): Promise<{ ok: boolean; exitCode: number; stdout: string; stderr: string }> {
    try {
      const result = this.options.runner.test(this.options.cwd);
      this.log.append('runner_started', { command: 'test', cwd: this.options.cwd });
      return result;
    } catch (err) {
      return { ok: false, exitCode: 1, stdout: '', stderr: String(err) };
    }
  }
}
