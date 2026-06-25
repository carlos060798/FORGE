/**
 * python-runner.ts — Runner para proyectos Python
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Runner, RunnerResult } from './runner.js';
import { run, safeFiles } from './runner.js';

export class PythonRunner implements Runner {
  private readonly installCmd: string;
  private readonly testCmd: string;
  private readonly lintCmd: string | null;

  constructor(opts: {
    installCmd?: string;
    testCmd?: string;
    lintCmd?: string | null;
  } = {}) {
    this.installCmd = opts.installCmd ?? 'pip install -r requirements.txt';
    this.testCmd = opts.testCmd ?? 'python -m pytest';
    this.lintCmd = opts.lintCmd ?? null;
  }

  install(cwd: string): RunnerResult {
    return run(this.installCmd, cwd, 180_000);
  }

  test(cwd: string, files: string[] = []): RunnerResult {
    if (files.length > 0) {
      const safe = safeFiles(cwd, files).join(' ');
      return run(`${this.testCmd} ${safe} -q`, cwd);
    }
    return run(`${this.testCmd} -q`, cwd);
  }

  lint(cwd: string, files: string[] = []): RunnerResult {
    if (!this.lintCmd) {
      return { ok: true, exitCode: 0, stdout: 'NO_LINTER', stderr: '', durationMs: 0 };
    }
    const target = files.length > 0 ? safeFiles(cwd, files).join(' ') : '.';
    return run(`${this.lintCmd} ${target}`, cwd);
  }

  build(_cwd: string): RunnerResult {
    // Python no tiene build step canónico
    return { ok: true, exitCode: 0, stdout: 'NO_BUILD', stderr: '', durationMs: 0 };
  }
}

export function createPythonRunner(cwd: string): PythonRunner {
  const toml = (() => {
    try { return fs.readFileSync(path.join(cwd, 'pyproject.toml'), 'utf8'); } catch { return ''; }
  })();
  const req = fs.existsSync(path.join(cwd, 'requirements.txt'));

  const installCmd = fs.existsSync(path.join(cwd, 'poetry.lock')) ? 'poetry install'
    : fs.existsSync(path.join(cwd, 'Pipfile')) ? 'pipenv install'
    : req ? 'pip install -r requirements.txt'
    : 'pip install -e .';

  const testCmd = toml.includes('pytest') || fs.existsSync(path.join(cwd, 'pytest.ini'))
    ? 'python -m pytest'
    : 'python -m unittest discover';

  const lintCmd = toml.includes('ruff') ? 'ruff check'
    : toml.includes('flake8') || fs.existsSync(path.join(cwd, '.flake8')) ? 'flake8'
    : null;

  return new PythonRunner({ installCmd, testCmd, lintCmd });
}
