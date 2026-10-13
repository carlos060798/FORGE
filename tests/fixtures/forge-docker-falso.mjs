// @ts-check
/**
 * `forge run` / `forge resume` con un Docker falso, para matarlo de verdad sin necesitar Docker.
 *
 * Es el mismo código que ejecuta la orden `forge` (core/engine-cli.js: sesión, candado de proyecto,
 * barridos, orquestador, ciclo, puntos de guardado, diario y libro de gasto) y el mismo ejecutor de
 * pruebas (SandboxRunner: copia de trabajo, política, limpieza). Lo único que cambia es el proceso
 * `docker`: aquí «el contenedor» es `node --test` lanzado en la copia de trabajo.
 *
 * Solo sirve con proyectos de prueba cuyo código escribe el propio test: lo que en producción
 * correría aislado, aquí corre en el equipo.
 *
 * Uso: node forge-docker-falso.mjs run|resume [opciones de forge]
 * Variables:
 *   FALSO_REGISTRO           archivo JSONL donde se anota cada llamada a «docker»
 *   FALSO_PARAR_EN_EJECUCION N: la ejecución número N de este proceso no termina nunca (el test lo mata ahí)
 *   FALSO_DEMORA_MS          espera antes de cada ejecución (para que dos procesos coincidan)
 */

import { appendFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { main } from "../../core/engine-cli.js";
import { DockerCli } from "../../core/sandbox/docker-cli.js";

const registro = process.env.FALSO_REGISTRO;
const pararEn = Number(process.env.FALSO_PARAR_EN_EJECUCION) || 0;
const demoraMs = Number(process.env.FALSO_DEMORA_MS) || 0;
const anotar = (/** @type {Record<string, unknown>} */ e) => { if (registro) appendFileSync(registro, JSON.stringify({ ts: Date.now(), pid: process.pid, ...e }) + "\n", "utf8"); };

let ejecuciones = 0;

/** @type {import("../../core/sandbox/docker-cli.js").Ejecutor} */
const ejecutar = (args) => new Promise((resolver) => {
  const base = { code: 0, stdout: "", stderr: "", timedOut: false };
  if (args[0] !== "run") {
    anotar({ orden: args[0], args });
    // `version` contesta; `image inspect` dice que la imagen está; `ps` no encuentra contenedores
    return resolver({ ...base, stdout: args[0] === "version" ? "0.0.0-falso\n" : "" });
  }

  const n = ++ejecuciones;
  const montaje = String(args[args.indexOf("--mount") + 1]);
  const copia = /source=(.*),target=/.exec(montaje)?.[1] ?? "";
  anotar({ orden: "run", n, copia, nombre: args[args.indexOf("--name") + 1] });
  if (n === pararEn) {
    // El proceso se queda «dentro de la ejecución» hasta que lo maten
    setInterval(() => {}, 60_000);
    return;
  }

  setTimeout(() => {
    // Sin NODE_TEST_CONTEXT: heredado del test que nos lanzó, cambiaría el formato de la salida
    const { NODE_TEST_CONTEXT: _omitida, ...env } = process.env;
    // «El contenedor» ejecuta el comando que se le pidió (node --test con el reporter TAP y, a veces, con cobertura)
    // (`--entrypoint node <imagen> --test ...`; con `npm test` se ejecuta `node --test` a secas)
    const ie = args.indexOf("--entrypoint");
    const restoNode = ie !== -1 && args[ie + 1] === "node" ? args.slice(ie + 3) : ["--test"];
    const p = spawn(process.execPath, restoNode, { cwd: copia, env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let stdout = "";
    let stderr = "";
    p.stdout.on("data", (d) => { stdout += d; });
    p.stderr.on("data", (d) => { stderr += d; });
    p.on("error", (e) => resolver({ ...base, code: null, error: e.message }));
    p.on("close", (code) => { anotar({ orden: "run:fin", n, code }); resolver({ ...base, code, stdout, stderr }); });
  }, demoraMs);
});

process.argv = [process.argv[0], process.argv[1], ...process.argv.slice(2)];
main({ cli: new DockerCli({ ejecutar }) }).catch((e) => { console.error(e); process.exit(1); });
