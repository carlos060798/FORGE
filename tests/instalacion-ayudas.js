// @ts-check
// Ayudas de las pruebas de instalación (no es una prueba: no termina en .test.js).
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const CLI = join(ROOT, "cli", "index.js");

/** Ejecuta `forge <args>` con un HOME falso. */
export function forge(cwd, home, ...args) {
  const env = { ...process.env, HOME: home, USERPROFILE: home, FORGE_LLM_PROVIDER: "stub", ANTHROPIC_API_KEY: "", CLAUDE_API_KEY: "" };
  const r = spawnSync(process.execPath, [CLI, ...args], { cwd, env, encoding: "utf8", timeout: 180_000 });
  return { status: r.status, salida: (r.stdout ?? "") + (r.stderr ?? "") };
}
