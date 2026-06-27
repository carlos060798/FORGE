/**
 * node-runner.js — Runner para proyectos Node.js / TypeScript
 */

import * as fs from 'fs';
import * as path from 'path';
import { run, safeFiles } from './runner.js';

export class NodeRunner {
  constructor(opts = {}) {
    this.installCmd = opts.installCmd ?? 'npm install';
    this.testCmd    = opts.testCmd    ?? 'npm test';
    this.lintCmd    = opts.lintCmd    ?? null;
    this.buildCmd   = opts.buildCmd   ?? null;
  }

  /** @param {string} cwd */
  install(cwd) { return run(this.installCmd, cwd, 180_000); }

  /**
   * @param {string} cwd
   * @param {string[]} [files]
   */
  test(cwd, files = []) {
    if (files.length > 0) {
      const safe = safeFiles(cwd, files).join(' ');
      if (this.testCmd.includes('vitest')) {
        return run(`${this.testCmd} --reporter=verbose ${safe}`, cwd);
      }
      if (this.testCmd.includes('jest')) {
        return run(`${this.testCmd} --passWithNoTests --findRelatedTests ${safe}`, cwd);
      }
    }
    return run(this.testCmd, cwd);
  }

  /**
   * @param {string} cwd
   * @param {string[]} [files]
   */
  lint(cwd, files = []) {
    if (!this.lintCmd) {
      return { ok: true, exitCode: 0, stdout: 'NO_LINTER', stderr: '', durationMs: 0 };
    }
    const target = files.length > 0 ? safeFiles(cwd, files).join(' ') : '.';
    return run(`${this.lintCmd} ${target}`, cwd);
  }

  /** @param {string} cwd */
  build(cwd) {
    if (!this.buildCmd) {
      return { ok: true, exitCode: 0, stdout: 'NO_BUILD', stderr: '', durationMs: 0 };
    }
    return run(this.buildCmd, cwd, 300_000);
  }
}

/** @param {string} cwd @returns {NodeRunner} */
export function createNodeRunner(cwd) {
  let pkg = {};
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
  } catch { /* no package.json */ }

  const deps = {
    ...(pkg['dependencies'] ?? {}),
    ...(pkg['devDependencies'] ?? {}),
  };
  const scripts = pkg['scripts'] ?? {};
  const hasDep = (...names) => names.some(n => n in deps);

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
