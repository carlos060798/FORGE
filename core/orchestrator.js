/**
 * orchestrator.js — Motor central de ejecución del pipeline FORGE
 */

import { LlmAgentAdapter } from './agent-registry.js';
import { bus } from './event-bus.js';
import { sessionBudget } from './session-budget.js';
import { circuitBreaker } from './execution-context.js';

const CODE_AGENTS = new Set(['desarrollador-backend', 'desarrollador-frontend', 'tester']);

export class Orchestrator {
  /**
   * @param {import('./agent-registry.js').AgentRegistry} registry
   * @param {import('./state-machine.js').PipelineStateMachine} stateMachine
   * @param {import('./event-log.js').EventLog} log
   * @param {import('./state-store.js').FileSystemStateStore} store
   * @param {{ cwd: string, parallelThreshold?: number, stopOnFailure?: boolean, runner?: import('./runners/runner.js').Runner }} options
   */
  constructor(registry, stateMachine, log, store, options) {
    this.registry     = registry;
    this.stateMachine = stateMachine;
    this.log          = log;
    this.store        = store;
    this.options = {
      parallelThreshold: 3,
      stopOnFailure: true,
      runner: undefined,
      ...options,
    };
  }

  async run(tasks, apiKey) {
    const startTime = Date.now();
    const completedTasks = [];
    const failedTasks = [];

    const knownStates = this.log.replayTaskStates();
    const completed = new Set(
      [...knownStates.entries()]
        .filter(([, v]) => v.estado === 'completada')
        .map(([id]) => id)
    );

    const levels = this._topologicalLevels(tasks);

    for (const level of levels) {
      const pending = level.filter(t => !completed.has(t.id));
      if (pending.length === 0) continue;

      const levelResults = pending.length >= this.options.parallelThreshold
        ? await this._runParallel(pending, apiKey)
        : await this._runSequential(pending, apiKey);

      for (const result of levelResults) {
        if (result.status === 'completada') {
          completedTasks.push(result);
          completed.add(result.taskId);
        } else if (result.status === 'fallida') {
          failedTasks.push(result);
          if (!this._taskIsOptional(result.taskId, tasks) && this.options.stopOnFailure) {
            return { ok: false, completedTasks, failedTasks, totalDurationMs: Date.now() - startTime };
          }
        }
      }
    }

    return { ok: failedTasks.length === 0, completedTasks, failedTasks, totalDurationMs: Date.now() - startTime };
  }

  async runReviewParallel(reviewerNames, sharedPrompt, apiKey) {
    const tasks = reviewerNames.map((agente, i) => ({
      id: `REVIEW-${String(i).padStart(3, '0')}`,
      agente,
      prompt: sharedPrompt,
    }));
    return this._runParallel(tasks, apiKey);
  }

  async _runParallel(tasks, apiKey) {
    this.log.append('custom', { message: `Iniciando ${tasks.length} tareas en paralelo`, taskIds: tasks.map(t => t.id) });
    const results = await Promise.allSettled(tasks.map(t => this._executeTask(t, apiKey)));
    return results.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      const task = tasks[i];
      return { taskId: task.id, agente: task.agente, status: 'fallida', output: '', error: r.reason?.message ?? 'Error no capturado', durationMs: 0 };
    });
  }

  async _runSequential(tasks, apiKey) {
    const results = [];
    for (const task of tasks) {
      const result = await this._executeTask(task, apiKey);
      results.push(result);
      if (result.status === 'fallida' && !task.opcional && this.options.stopOnFailure) break;
    }
    return results;
  }

  async _executeTask(task, apiKey) {
    const start = Date.now();

    if (circuitBreaker.nivel === 'sandbox') {
      const error = 'CircuitBreaker activo (nivel sandbox) — tarea omitida. Resuelve los errores anteriores.';
      await bus.emit('task:failed', { taskId: task.id, agente: task.agente, error });
      return { taskId: task.id, agente: task.agente, status: 'omitida', output: '', error, durationMs: 0 };
    }

    if (!circuitBreaker.puedeEjecutarAgente(task.agente)) {
      const cbState = circuitBreaker.estadoAgente(task.agente);
      const error = `Agente "${task.agente}" en circuit breaker (${cbState.state}) — omitido.`;
      await bus.emit('task:failed', { taskId: task.id, agente: task.agente, error });
      return { taskId: task.id, agente: task.agente, status: 'omitida', output: '', error, durationMs: 0 };
    }

    this.log.appendEnvelope(
      'task_started',
      { taskId: task.id, agente: task.agente },
      { from: 'orchestrator', to: `agente:${task.agente}` },
      { taskId: task.id, agent: task.agente },
    );

    const def = this.registry.get(task.agente);
    if (!def) {
      const error = `Agente desconocido: "${task.agente}"`;
      this.log.append('task_failed', { taskId: task.id, error }, { taskId: task.id });
      await bus.emit('task:failed', { taskId: task.id, agente: task.agente, error });
      return { taskId: task.id, agente: task.agente, status: 'fallida', output: '', durationMs: Date.now() - start, error };
    }

    const estado = this.store.read();
    const ctx = {
      cwd: this.options.cwd,
      userPrompt: task.prompt,
      forgeState: JSON.stringify(estado, null, 2),
      extraContext: task.extraContext,
    };

    const agent = new LlmAgentAdapter(def, apiKey);
    this.log.append('agent_invoked', { agente: task.agente, taskId: task.id }, { taskId: task.id, agent: task.agente });

    const agentResult = await agent.execute(ctx);
    this.log.append('agent_result', { taskId: task.id, ok: agentResult.ok, inputTokens: agentResult.inputTokens, outputTokens: agentResult.outputTokens }, { taskId: task.id, agent: task.agente });
    await bus.emit('agent:result', {
      agente: task.agente, taskId: task.id,
      tokens_input: agentResult.inputTokens ?? 0, tokens_output: agentResult.outputTokens ?? 0,
      modelo: agentResult.modelo ?? 'claude-sonnet-4-6', durationMs: agentResult.durationMs ?? 0,
      ok: agentResult.ok,
    });

    if (!agentResult.ok) {
      const error = agentResult.error ?? 'El agente falló sin mensaje de error';
      this.log.append('task_failed', { taskId: task.id, error }, { taskId: task.id });
      await bus.emit('task:failed', { taskId: task.id, agente: task.agente, error });
      return { taskId: task.id, agente: task.agente, status: 'fallida', output: '', durationMs: Date.now() - start, error };
    }

    let runnerResult;
    if (this.options.runner && this._isCodeTask(task, def)) {
      const rr = await this._runTests();
      runnerResult = { ok: rr.ok, stdout: rr.stdout, stderr: rr.stderr };
      this.log.append('runner_result', { taskId: task.id, ok: rr.ok, exitCode: rr.exitCode }, { taskId: task.id });

      if (!rr.ok) {
        this.log.append('task_failed', { taskId: task.id, reason: 'runner_failed' }, { taskId: task.id });
        await bus.emit('task:failed', { taskId: task.id, agente: task.agente, error: `Runner falló: ${rr.stderr.slice(0, 300)}` });
        return { taskId: task.id, agente: task.agente, status: 'fallida', output: agentResult.output, durationMs: Date.now() - start, error: `Runner falló: ${rr.stderr.slice(0, 300)}`, runnerResult };
      }
    }

    this.log.appendEnvelope('task_completed', { taskId: task.id }, { from: `agente:${task.agente}`, to: 'pipeline' }, { taskId: task.id });
    await bus.emit('task:completed', { taskId: task.id, agente: task.agente, durationMs: agentResult.durationMs ?? 0 });
    return { taskId: task.id, agente: task.agente, status: 'completada', output: agentResult.output, durationMs: Date.now() - start, runnerResult };
  }

  _topologicalLevels(tasks) {
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const inDegree = new Map(tasks.map(t => [t.id, 0]));

    for (const task of tasks) {
      for (const dep of task.dependencias ?? []) {
        if (taskMap.has(dep)) {
          inDegree.set(task.id, (inDegree.get(task.id) ?? 0) + 1);
        }
      }
    }

    const levels = [];
    let remaining = new Set(tasks.map(t => t.id));

    while (remaining.size > 0) {
      const ready = [...remaining].filter(id => (inDegree.get(id) ?? 0) === 0);
      if (ready.length === 0) {
        levels.push([...remaining].map(id => taskMap.get(id)));
        break;
      }
      levels.push(ready.map(id => taskMap.get(id)));
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

  _taskIsOptional(taskId, tasks) {
    return tasks.find(t => t.id === taskId)?.opcional ?? false;
  }

  _isCodeTask(task, agent) {
    if (agent?.is_code_agent !== undefined) return agent.is_code_agent;
    return CODE_AGENTS.has(task.agente);
  }

  async _runTests() {
    try {
      const result = await this.options.runner.test(this.options.cwd);
      this.log.append('runner_started', { command: 'test', cwd: this.options.cwd });
      return result;
    } catch (err) {
      return { ok: false, exitCode: 1, stdout: '', stderr: String(err) };
    }
  }
}
