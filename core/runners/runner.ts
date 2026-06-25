/**
 * runner.ts — Interfaz base para runners de lenguaje
 *
 * Cada runner sabe cómo instalar, testear, lintear y buildear
 * para su lenguaje. El Orchestrator usa RunnerResult para decidir
 * si una tarea pasó o falló, sin parsear texto de prompts.
 */

import { execSync, ExecSyncOptions } from 'child_process';
import * as path from 'path';

export interface RunnerResult {
  ok: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface Runner {
  install(cwd: string): RunnerResult;
  test(cwd: string, files?: string[]): RunnerResult;
  lint(cwd: string, files?: string[]): RunnerResult;
  build(cwd: string): RunnerResult;
}

// ── Utilidad compartida ───────────────────────────────────────────────────────

export function run(
  cmd: string,
  cwd: string,
  timeoutMs = 120_000
): RunnerResult {
  const opts: ExecSyncOptions = {
    cwd,
    timeout: timeoutMs,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  };
  const t0 = Date.now();
  try {
    const stdout = execSync(cmd, opts) as unknown as string;
    return { ok: true, exitCode: 0, stdout: stdout ?? '', stderr: '', durationMs: Date.now() - t0 };
  } catch (err: unknown) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return {
      ok: false,
      exitCode: e.status ?? 1,
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
      durationMs: Date.now() - t0,
    };
  }
}

/** Filtra solo los archivos que pertenecen al cwd para evitar path traversal */
export function safeFiles(cwd: string, files: string[]): string[] {
  return files
    .map(f => path.resolve(cwd, f))
    .filter(f => f.startsWith(path.resolve(cwd)))
    .map(f => path.relative(cwd, f));
}
