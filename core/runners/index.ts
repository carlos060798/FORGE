/**
 * runners/index.ts — Factory: StackInfo → Runner
 *
 * Punto de entrada único. El Orchestrator importa solo esto;
 * no necesita saber qué runner existe para cada lenguaje.
 */

export type { Runner, RunnerResult } from './runner.js';
export { NodeRunner, createNodeRunner } from './node-runner.js';
export { PythonRunner, createPythonRunner } from './python-runner.js';
export { GoRunner } from './go-runner.js';
export { RustRunner } from './rust-runner.js';

import type { StackInfo } from '../stack-detector.js';
import type { Runner } from './runner.js';
import { createNodeRunner } from './node-runner.js';
import { createPythonRunner } from './python-runner.js';
import { GoRunner } from './go-runner.js';
import { RustRunner } from './rust-runner.js';

export function runnerForStack(stack: StackInfo, cwd: string): Runner {
  switch (stack.lenguaje) {
    case 'typescript':
    case 'javascript':
      return createNodeRunner(cwd);
    case 'python':
      return createPythonRunner(cwd);
    case 'go':
      return new GoRunner();
    case 'rust':
      return new RustRunner();
    default:
      // Fallback: intenta npm test, falla silenciosamente
      return createNodeRunner(cwd);
  }
}
