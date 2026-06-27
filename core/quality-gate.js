/**
 * quality-gate.js — Gate de calidad automático (tests → lint → criterio de aceptación)
 */

export class QualityGate {
  /**
   * @param {import('./runners/runner.js').Runner} runner
   * @param {import('./event-log.js').EventLog} log
   */
  constructor(runner, log) {
    this.runner = runner;
    this.log = log;
  }

  /**
   * @param {string} cwd
   * @param {string} taskId
   * @param {string[]} [archivosMod]
   * @param {string} [criterioCmd]
   */
  async run(cwd, taskId, archivosMod = [], criterioCmd) {
    const start = Date.now();
    const puntos = [];

    const p1 = await this._runPoint('Tests', () => this.runner.test(cwd, archivosMod));
    puntos.push(p1);

    if (p1.status === 'fail') {
      const total = Date.now() - start;
      const motivo = `Tests fallando: ${p1.detalle}`;
      this._logResult(taskId, false, motivo, total);
      return { ok: false, puntos, motivoBloqueo: motivo, totalDurationMs: total };
    }

    const p2 = await this._runPoint('Lint', () => this.runner.lint(cwd, archivosMod));
    puntos.push(p2);

    if (p2.status === 'fail') {
      const total = Date.now() - start;
      const motivo = `Linter fallando: ${p2.detalle}`;
      this._logResult(taskId, false, motivo, total);
      return { ok: false, puntos, motivoBloqueo: motivo, totalDurationMs: total };
    }

    const p3 = criterioCmd
      ? await this._runPoint('Criterio de aceptación', async () => {
          const { run } = await import('./runners/runner.js');
          return run(criterioCmd, cwd, 60_000);
        })
      : { nombre: 'Criterio de aceptación', status: 'skip', detalle: 'Sin comando de CA definido — skip', durationMs: 0 };
    puntos.push(p3);

    const ok = puntos.every(p => p.status !== 'fail');
    const total = Date.now() - start;
    const motivoBloqueo = ok ? undefined : `CA no cumplido: ${p3.detalle}`;
    this._logResult(taskId, ok, motivoBloqueo, total);
    return { ok, puntos, motivoBloqueo, totalDurationMs: total };
  }

  async _runPoint(nombre, fn) {
    try {
      const result = await fn();
      return {
        nombre,
        status: result.ok ? 'pass' : 'fail',
        detalle: result.ok
          ? result.stdout.slice(0, 200).trim()
          : (result.stderr || result.stdout).slice(0, 400).trim(),
        durationMs: result.durationMs,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('not found') || msg.includes('ENOENT') || msg.includes('command not found')) {
        return { nombre, status: 'skip', detalle: `Herramienta no disponible: ${msg.slice(0, 100)}`, durationMs: 0 };
      }
      return { nombre, status: 'fail', detalle: msg.slice(0, 400), durationMs: 0 };
    }
  }

  _logResult(taskId, ok, motivo, durationMs) {
    this.log.append('custom', { tipo: 'quality_gate', taskId, ok, motivo: motivo ?? null, durationMs }, { taskId });
  }
}
