/**
 * rust-runner.js — Runner para proyectos Rust
 */

import { run } from './runner.js';

export class RustRunner {
  install(cwd) { return run('cargo fetch', cwd, 120_000); }
  test(cwd)    { return run('cargo test', cwd, 300_000); }
  lint(cwd)    { return run('cargo clippy -- -D warnings', cwd); }
  build(cwd)   { return run('cargo build --release', cwd, 600_000); }
}
