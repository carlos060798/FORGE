/**
 * runners/index.js — Factory: StackInfo → Runner
 */

export { NodeRunner, createNodeRunner } from './node-runner.js';
export { PythonRunner, createPythonRunner } from './python-runner.js';
export { GoRunner } from './go-runner.js';
export { RustRunner } from './rust-runner.js';

import { createNodeRunner } from './node-runner.js';
import { createPythonRunner } from './python-runner.js';
import { GoRunner } from './go-runner.js';
import { RustRunner } from './rust-runner.js';

/**
 * @param {import('../stack-detector.js').StackInfo} stack
 * @param {string} cwd
 * @returns {import('./runner.js').Runner}
 */
export function runnerForStack(stack, cwd) {
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
      return createNodeRunner(cwd);
  }
}
