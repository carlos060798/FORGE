/**
 * node-runner.ts — Runner para proyectos Node.js / TypeScript
 *
 * Detecta el package manager (npm/pnpm/yarn/bun) y el test runner
 * (jest/vitest/mocha) a partir del StackInfo recibido del Orchestrator.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Runner, RunnerResult } from './runner.js';
import { run, safeFiles } from './runner.js';

export class NodeRunner implements Runner {
  private readonly installCmd: string;
  private readonly testCmd: string;
  private readonly lintCmd: string | null;
  private readonly buildCmd: string | null;

  constructor(opts: {
    installCmd?: string;
    testCmd?: string;
    lintCmd?: string | null;
    buildCmd?: string | null;
  } = {}) {
    this.installCmd = opts.installCmd ?? 'npm install';
    this.testCmd = opts.testCmd ?? 'npm test';
    this.lintCmd = opts.lintCmd ?? null;
    this.buildCmd = opts.buildCmd ?? null;
  }

  install(cwd: string): RunnerResult {
    return run(this.installCmd, cwd, 180_000);
  }

  test(cwd: string, files: string[] = []): RunnerResult {
    if (files.length > 0) {
      const safe = safeFiles(cwd, files).join(' ');
      // Vitest y Jest soportan --testPathPattern / findRelatedTests
      if (this.testCmd.includes('vitest')) {
        return run(`${this.testCmd} --reporter=verbose ${safe}`, cwd);
      }
      if (this.testCmd.includes('jest')) {
        return run(`${this.testCmd} --passWithNoTests --findRelatedTests ${safe}`, cwd);
      }
    }
    return run(this.testCmd, cwd);
  }

  lint(cwd: string, files: string[] = []): RunnerResult {
    if (!this.lintCmd) {
      return { ok: true, exitCode: 0, stdout: 'NO_LINTER', stderr: '', durationMs: 0 };
    }
    const target = files.length > 0 ? safeFiles(cwd, files).join(' ') : '.';
    return run(`${this.lintCmd} ${target}`, cwd);
  }

  build(cwd: string): RunnerResult {
    if (!this.buildCmd) {
      return { ok: true, exitCode: 0, stdout: 'NO_BUILD', stderr: '', durationMs: 0 };
    }
    return run(this.buildCmd, cwd, 300_000);
  }
}

/** Crea un NodeRunner leyendo directamente el package.json del proyecto */
export function createNodeRunner(cwd: string): NodeRunner {
  let pkg: Record<string, unknown> = {};
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
  } catch { /* no package.json — defaults razonables */ }

  const deps: Record<string, string> = {
    ...(pkg['dependencies'] as Record<string, string> ?? {}),
    ...(pkg['devDependencies'] as Record<string, string> ?? {}),
  };
  const scripts = (pkg['scripts'] as Record<string, string>) ?? {};

  const hasDep = (...names: string[]) => names.some(n => n in deps);

  const installCmd = fs.existsSync(path.join(cwd, 'pnpm-lock.yaml')) ? 'pnpm install'
    : fs.existsSync(path.join(cwd, 'yarn.lock')) ? 'yarn install'
    : fs.existsSync(path.join(cwd, 'bun.lockb')) ? 'bun install'
    : 'npm install';

  const testCmd = hasDep('vitest') ? 'npx vitest run'
    : hasDep('jest', '@jest/core') ? 'npx jest'
    : hasDep('mocha') ? 'npx mocha'
    : scripts['test'] ? 'npm test'
    : 'npm test';

  const lintCmd = hasDep('eslint') ? 'npx eslint'
    : hasDep('biome') ? 'npx biome check'
    : null;

  const buildCmd = scripts['build'] ? 'npm run build'
    : hasDep('typescript') ? 'npx tsc --noEmit'
    : null;

  return new NodeRunner({ installCmd, testCmd, lintCmd, buildCmd });
}
