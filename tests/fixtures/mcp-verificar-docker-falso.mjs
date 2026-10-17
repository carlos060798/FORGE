// @ts-check
/**
 * `forge mcp` (perfil verificacion) con un Docker falso: el servidor, el protocolo y la herramienta son los
 * reales; lo único falso es el proceso `docker`. «El contenedor» es `node --test` en la copia.
 *
 * Argumentos: --cwd <dir> --perfil <nombre>
 * Variables:
 *   FALSO_REGISTRO       JSONL con cada llamada a «docker» (orden, argumentos, nombre del contenedor)
 *   FALSO_SIN_DOCKER=1   `docker version` falla
 *   FALSO_COLGAR=1       `docker run` no termina hasta que llega `kill`/`rm` con su nombre (código 137)
 *   FALSO_SALIDA_GRANDE  bytes de salida estándar que escribe el contenedor (sustituye a node --test)
 */

import { appendFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { iniciarServidor } from "../../core/mcp/servidor.js";
import { DockerCli } from "../../core/sandbox/docker-cli.js";

const registro = process.env.FALSO_REGISTRO;
const anotar = (/** @type {Record<string, unknown>} */ e) => { if (registro) appendFileSync(registro, JSON.stringify({ pid: process.pid, ...e }) + "\n", "utf8"); };
/** @type {Map<string, (r: any) => void>} */
const colgados = new Map();

/** @type {import("../../core/sandbox/docker-cli.js").Ejecutor} */
const ejecutar = (args) => new Promise((resolver) => {
  const base = { code: 0, stdout: "", stderr: "", timedOut: false };
  if (args[0] !== "run") {
    anotar({ orden: args[0], args });
    const objetivo = args[args.length - 1];
    if ((args[0] === "kill" || args[0] === "rm") && colgados.has(objetivo)) {
      colgados.get(objetivo)?.({ ...base, code: 137 });
      colgados.delete(objetivo);
    }
    if (args[0] === "version" && process.env.FALSO_SIN_DOCKER === "1") return resolver({ ...base, code: 1, stderr: "Cannot connect to the Docker daemon" });
    return resolver({ ...base, stdout: args[0] === "version" ? "0.0.0-falso\n" : "" });
  }
  const montaje = String(args[args.indexOf("--mount") + 1]);
  const copia = /source=(.*),target=/.exec(montaje)?.[1] ?? "";
  const nombre = String(args[args.indexOf("--name") + 1]);
  anotar({ orden: "run", copia, nombre });
  if (process.env.FALSO_COLGAR === "1") { colgados.set(nombre, resolver); return; }
  if (process.env.FALSO_SALIDA_GRANDE) return resolver({ ...base, code: 0, stdout: "x".repeat(Number(process.env.FALSO_SALIDA_GRANDE)) });
  const { NODE_TEST_CONTEXT: _omitida, ...env } = process.env;
  const ie = args.indexOf("--entrypoint");
  const restoNode = ie !== -1 && args[ie + 1] === "node" ? args.slice(ie + 3) : ["--test"];
  const p = spawn(process.execPath, restoNode, { cwd: copia, env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  let stdout = "";
  let stderr = "";
  p.stdout.on("data", (d) => { stdout += d; });
  p.stderr.on("data", (d) => { stderr += d; });
  p.on("error", (e) => resolver({ ...base, code: null, error: e.message }));
  p.on("close", (code) => resolver({ ...base, code, stdout, stderr }));
});

const arg = (/** @type {string} */ n) => { const i = process.argv.indexOf(n); return i === -1 ? undefined : process.argv[i + 1]; };
await iniciarServidor({ cwd: arg("--cwd"), perfil: arg("--perfil"), cli: new DockerCli({ ejecutar }) });
