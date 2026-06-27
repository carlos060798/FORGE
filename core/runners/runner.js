/**
 * runner.js — Interfaz base para runners de lenguaje
 */

import { execSync } from 'child_process';
import * as path from 'path';

/**
 * @typedef {Object} RunnerResult
 * @property {boolean} ok
 * @property {number} exitCode
 * @property {string} stdout
 * @property {string} stderr
 * @property {number} durationMs
 */

/**
 * @typedef {Object} Runner
 * @property {(cwd: string) => RunnerResult} install
 * @property {(cwd: string, files?: string[]) => RunnerResult} test
 * @property {(cwd: string, files?: string[]) => RunnerResult} lint
 * @property {(cwd: string) => RunnerResult} build
 */

/**
 * @param {string} cmd
 * @param {string} cwd
 * @param {number} [timeoutMs]
 * @returns {RunnerResult}
 */
export function run(cmd, cwd, timeoutMs = 120_000) {
  const opts = {
    cwd,
    timeout: timeoutMs,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  };
  const t0 = Date.now();
  try {
    const stdout = execSync(cmd, opts);
    return { ok: true, exitCode: 0, stdout: stdout ?? '', stderr: '', durationMs: Date.now() - t0 };
  } catch (err) {
    return {
      ok: false,
      exitCode: err.status ?? 1,
      stdout: err.stdout ?? '',
      stderr: err.stderr ?? '',
      durationMs: Date.now() - t0,
    };
  }
}

/**
 * @param {string} cwd
 * @param {string[]} files
 * @returns {string[]}
 */
export function safeFiles(cwd, files) {
  return files
    .map(f => path.resolve(cwd, f))
    .filter(f => f.startsWith(path.resolve(cwd)))
    .map(f => path.relative(cwd, f));
}
