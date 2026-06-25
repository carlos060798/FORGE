/**
 * go-runner.ts — Runner para proyectos Go
 */

import type { Runner, RunnerResult } from './runner.js';
import { run, safeFiles } from './runner.js';

export class GoRunner implements Runner {
  install(cwd: string): RunnerResult {
    return run('go mod download', cwd, 120_000);
  }

  test(cwd: string, files: string[] = []): RunnerResult {
    if (files.length > 0) {
      // Convierte rutas de archivo a paquetes Go (toma el directorio)
      const pkgs = [...new Set(safeFiles(cwd, files).map(f => {
        const parts = f.split('/');
        parts.pop();
        return './' + (parts.join('/') || '...');
      }))].join(' ');
      return run(`go test -v ${pkgs}`, cwd);
    }
    return run('go test ./...', cwd);
  }

  lint(cwd: string): RunnerResult {
    return run('golangci-lint run', cwd, 60_000);
  }

  build(cwd: string): RunnerResult {
    return run('go build ./...', cwd);
  }
}
