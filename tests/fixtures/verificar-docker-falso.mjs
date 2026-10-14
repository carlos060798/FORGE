// @ts-check
/**
 * `forge verificar` con un Docker falso: el mismo código de cli/verificar.js y core/verificar, y el mismo
 * SandboxRunner. Lo único que cambia es el proceso `docker`: «el contenedor» es `node --test` en la copia.
 * Solo sirve con proyectos de prueba cuyo código escribe el propio test.
 *
 * Variables:
 *   FALSO_REGISTRO       archivo JSONL donde se anota cada llamada a «docker»
 *   FALSO_SIN_DOCKER=1   `docker version` falla (Docker no disponible)
 *   FALSO_CODIGO         el contenedor termina con este código sin ejecutar nada (p. ej. 5)
 *   FALSO_SALIDA         texto que el contenedor escribe en la salida estándar con FALSO_CODIGO
 */

import { appendFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { cmdVerificar } from "../../cli/verificar.js";
import { DockerCli } from "../../core/sandbox/docker-cli.js";

const registro = process.env.FALSO_REGISTRO;
const anotar = (/** @type {Record<string, unknown>} */ e) => { if (registro) appendFileSync(registro, JSON.stringify({ pid: process.pid, ...e }) + "\n", "utf8"); };

/** @type {import("../../core/sandbox/docker-cli.js").Ejecutor} */
const ejecutar = (args) => new Promise((resolver) => {
  const base = { code: 0, stdout: "", stderr: "", timedOut: false };
  if (args[0] !== "run") {
    anotar({ orden: args[0], args });
    if (args[0] === "version" && process.env.FALSO_SIN_DOCKER === "1") return resolver({ ...base, code: 1, stderr: "Cannot connect to the Docker daemon" });
    return resolver({ ...base, stdout: args[0] === "version" ? "0.0.0-falso\n" : "" });
  }
  const montaje = String(args[args.indexOf("--mount") + 1]);
  const copia = /source=(.*),target=/.exec(montaje)?.[1] ?? "";
  anotar({ orden: "run", copia, nombre: args[args.indexOf("--name") + 1] });
  if (process.env.FALSO_CODIGO !== undefined) {
    return resolver({ ...base, code: Number(process.env.FALSO_CODIGO), stdout: process.env.FALSO_SALIDA ?? "" });
  }
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

cmdVerificar(process.argv.slice(2), { cli: new DockerCli({ ejecutar }) })
  .then((codigo) => { process.exitCode = codigo; })
  .catch((e) => { console.error(e); process.exitCode = 70; });
