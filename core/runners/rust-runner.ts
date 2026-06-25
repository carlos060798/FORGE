/**
 * rust-runner.ts — Runner para proyectos Rust
 */

import type { Runner, RunnerResult } from './runner.js';
import { run } from './runner.js';

export class RustRunner implements Runner {
  install(cwd: string): RunnerResult {
    return run('cargo fetch', cwd, 120_000);
  }

  test(cwd: string): RunnerResult {
    return run('cargo test', cwd, 300_000);
  }

  lint(cwd: string): RunnerResult {
    return run('cargo clippy -- -D warnings', cwd);
  }

  build(cwd: string): RunnerResult {
    return run('cargo build --release', cwd, 600_000);
  }
}
