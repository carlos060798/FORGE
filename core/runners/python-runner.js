/**
 * python-runner.js — Runner para proyectos Python
 */

import * as fs from 'fs';
import * as path from 'path';
import { run, safeFiles } from './runner.js';

export class PythonRunner {
  constructor(opts = {}) {
    this.installCmd = opts.installCmd ?? 'pip install -r requirements.txt';
    this.testCmd    = opts.testCmd    ?? 'python -m pytest';
    this.lintCmd    = opts.lintCmd    ?? null;
  }

  install(cwd) { return run(this.installCmd, cwd, 180_000); }

  test(cwd, files = []) {
    if (files.length > 0) {
      const safe = safeFiles(cwd, files).join(' ');
      return run(`${this.testCmd} ${safe} -q`, cwd);
    }
    return run(`${this.testCmd} -q`, cwd);
  }

  lint(cwd, files = []) {
    if (!this.lintCmd) return { ok: true, exitCode: 0, stdout: 'NO_LINTER', stderr: '', durationMs: 0 };
    const target = files.length > 0 ? safeFiles(cwd, files).join(' ') : '.';
    return run(`${this.lintCmd} ${target}`, cwd);
  }

  build(_cwd) { return { ok: true, exitCode: 0, stdout: 'NO_BUILD', stderr: '', durationMs: 0 }; }
}

/** @param {string} cwd @returns {PythonRunner} */
export function createPythonRunner(cwd) {
  const toml = (() => { try { return fs.readFileSync(path.join(cwd, 'pyproject.toml'), 'utf8'); } catch { return ''; } })();
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
