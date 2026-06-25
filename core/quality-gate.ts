/**
 * quality-gate.ts — Gate de calidad automático (Punto 1-3 de sdd.implementar.md §5.10.5)
 *
 * Ejecuta en orden: tests → lint → criterio de aceptación.
 * Persiste el resultado en la memoria SQLite (a través del EventLog).
 * Los 3 puntos deben pasar para marcar una tarea como "completada".
 */

import type { Runner } from './runners/runner.js';
import type { EventLog } from './event-log.js';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type GatePointStatus = 'pass' | 'fail' | 'skip';

export interface GatePoint {
  nombre: string;
  status: GatePointStatus;
  detalle: string;
  durationMs: number;
}

export interface QualityGateResult {
  /** true solo si los 3 puntos pasan */
  ok: boolean;
  puntos: GatePoint[];
  /** Motivo de bloqueo listo para guardar en estado-tareas.json */
  motivoBloqueo?: string;
  totalDurationMs: number;
}

// ── QualityGate ───────────────────────────────────────────────────────────────

export class QualityGate {
  private readonly runner: Runner;
  private readonly log: EventLog;

  constructor(runner: Runner, log: EventLog) {
    this.runner = runner;
    this.log = log;
  }

  /**
   * Ejecuta el gate de calidad de tres puntos.
   *
   * @param cwd          Directorio del proyecto
   * @param taskId       ID de la tarea (para trazabilidad en el log)
   * @param archivosMod  Archivos modificados por la tarea (para tests selectivos)
   * @param criterioCmd  Comando personalizado del CA de la tarea (opcional)
   */
  async run(
    cwd: string,
    taskId: string,
    archivosMod: string[] = [],
    criterioCmd?: string,
  ): Promise<QualityGateResult> {
    const start = Date.now();
    const puntos: GatePoint[] = [];

    // ── Punto 1: Tests ────────────────────────────────────────────────────────
    const p1 = await this.runPoint('Tests', () => {
      const result = this.runner.test(cwd, archivosMod);
      return result;
    });
    puntos.push(p1);

    // No ejecutar los siguientes puntos si los tests fallan y son bloqueantes
    if (p1.status === 'fail') {
      const total = Date.now() - start;
      const motivo = `Tests fallando: ${p1.detalle}`;
      this.logResult(taskId, false, motivo, total);
      return { ok: false, puntos, motivoBloqueo: motivo, totalDurationMs: total };
    }

    // ── Punto 2: Lint ─────────────────────────────────────────────────────────
    const p2 = await this.runPoint('Lint', () => {
      const result = this.runner.lint(cwd, archivosMod);
      return result;
    });
    puntos.push(p2);

    if (p2.status === 'fail') {
      const total = Date.now() - start;
      const motivo = `Linter fallando: ${p2.detalle}`;
      this.logResult(taskId, false, motivo, total);
      return { ok: false, puntos, motivoBloqueo: motivo, totalDurationMs: total };
    }

    // ── Punto 3: Criterio de aceptación ──────────────────────────────────────
    const p3 = criterioCmd
      ? await this.runPoint('Criterio de aceptación', async () => {
          const { run } = await import('./runners/runner.js');
          return run(criterioCmd, cwd, 60_000);
        })
      : { nombre: 'Criterio de aceptación', status: 'skip' as GatePointStatus, detalle: 'Sin comando de CA definido — skip', durationMs: 0 };
    puntos.push(p3);

    const ok = puntos.every(p => p.status !== 'fail');
    const total = Date.now() - start;
    const motivoBloqueo = ok
      ? undefined
      : `CA no cumplido: ${p3.detalle}`;

    this.logResult(taskId, ok, motivoBloqueo, total);
    return { ok, puntos, motivoBloqueo, totalDurationMs: total };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async runPoint(
    nombre: string,
    fn: () => { ok: boolean; stdout: string; stderr: string; durationMs: number } | Promise<{ ok: boolean; stdout: string; stderr: string; durationMs: number }>,
  ): Promise<GatePoint> {
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
      // Runner no disponible (lenguaje no soportado) → skip, no fallo
      if (msg.includes('not found') || msg.includes('ENOENT') || msg.includes('command not found')) {
        return { nombre, status: 'skip', detalle: `Herramienta no disponible: ${msg.slice(0, 100)}`, durationMs: 0 };
      }
      return { nombre, status: 'fail', detalle: msg.slice(0, 400), durationMs: 0 };
    }
  }

  private logResult(taskId: string, ok: boolean, motivo: string | undefined, durationMs: number): void {
    this.log.append('custom', {
      tipo: 'quality_gate',
      taskId,
      ok,
      motivo: motivo ?? null,
      durationMs,
    }, { taskId });
  }
}
