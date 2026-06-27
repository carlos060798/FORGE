/**
 * go-runner.js — Runner para proyectos Go
 */

import { run, safeFiles } from './runner.js';

export class GoRunner {
  install(cwd) { return run('go mod download', cwd, 120_000); }

  test(cwd, files = []) {
    if (files.length > 0) {
      const pkgs = [...new Set(safeFiles(cwd, files).map(f => {
        const parts = f.split('/');
        parts.pop();
        return './' + (parts.join('/') || '...');
      }))].join(' ');
      return run(`go test -v ${pkgs}`, cwd);
    }
    return run('go test ./...', cwd);
  }

  lint(cwd) { return run('golangci-lint run', cwd, 60_000); }
  build(cwd) { return run('go build ./...', cwd); }
}
