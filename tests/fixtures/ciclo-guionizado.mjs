// @ts-check
/**
 * Utilidades de tests/corte-real.test.js y tests/concurrencia.test.js: un proyecto mínimo, el guion
 * del proveedor de pruebas, y lanzar / matar / reanudar `forge` como proceso hijo.
 *
 * Dos formas de lanzarlo:
 *   - `falso`: tests/fixtures/forge-docker-falso.mjs (el mismo código de `forge run`, con un Docker falso);
 *   - `real`:  cli/index.js, con Docker de verdad (solo con FORGE_TEST_DOCKER=1).
 */

import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { EventLog } from "../../core/event-log.js";

export const ROOT  = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const CLI   = join(ROOT, "cli", "index.js");
export const FALSO = join(ROOT, "tests", "fixtures", "forge-docker-falso.mjs");

/** Con la máquina cargada todo tarda: los topes son contra cuelgues, no medidas. */
export const TOPE_MS = 600_000;

const json = (o) => "```json\n" + JSON.stringify(o) + "\n```";

/**
 * Pruebas que escribe «el agente de pruebas». El archivo `lento.flag` (que pone y quita el test, nunca
 * el modelo) hace que la ejecución se quede dormida dentro del contenedor: `rojo` antes de que exista
 * la implementación, `verde` cuando ya existe. Así el test puede cortar el proceso con un contenedor vivo.
 */
export const PRUEBAS = `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const marca = new URL('../lento.flag', import.meta.url);
const modo = existsSync(marca) ? readFileSync(marca, 'utf8').trim() : '';
const hayImplementacion = existsSync(new URL('../src/suma.js', import.meta.url));
if ((modo === 'rojo' && !hayImplementacion) || (modo === 'verde' && hayImplementacion)) await new Promise((r) => setTimeout(r, 300000));

const { suma, esPar } = await import('../src/suma.js');

test('suma dos números', () => {
  assert.equal(suma(2, 3), 5);
  assert.equal(suma(-1, 1), 0);
  assert.throws(() => suma('2', 3), TypeError);
});
test('esPar', () => {
  assert.equal(esPar(4), true);
  assert.equal(esPar(7), false);
});
`;

export const IMPLEMENTACION = `export function suma(a, b) {
  if (typeof a !== 'number' || typeof b !== 'number') throw new TypeError('suma solo admite números');
  return a + b;
}

export function esPar(n) {
  return n % 2 === 0;
}
`;

/** Índice de cada regla del guion: es lo que anota el registro del proveedor. */
export const REGLA = { planificador: 0, pruebas: 1, implementador: 2 };

/**
 * Reglas del proveedor de pruebas para un ciclo completo que acaba en éxito: plan, pruebas e
 * implementación. `extra` añade campos a una regla (p. ej. `{ pruebas: { hasta: archivo } }`).
 * @param {Partial<Record<keyof typeof REGLA, object>>} [extra]
 */
export function reglas(extra = {}) {
  const uso = { inputTokens: 100, outputTokens: 20 };
  return [
    { si: "Descompón la tarea en pasos pequeños", salida: json({ pasos: ["escribir suma y esPar"], archivosObjetivo: ["src/suma.js"] }), ...uso, ...extra.planificador },
    { si: "Escribe las pruebas automáticas de esta tarea ANTES", salida: json({ archivos: [{ ruta: "tests/suma.test.js", contenido: PRUEBAS }] }), ...uso, ...extra.pruebas },
    { si: "Implementa lo necesario para que las pruebas dadas pasen", salida: json({ archivos: [{ ruta: "src/suma.js", contenido: IMPLEMENTACION }] }), ...uso, ...extra.implementador },
  ];
}

/** Las tres llamadas que cuesta el ciclo de la tarea de ejemplo: plan, pruebas e implementación. */
export const LLAMADAS_DEL_CICLO = 3;

/**
 * Un escenario: el proyecto y, FUERA de él, el guion, los registros y la carpeta temporal del proceso.
 * @param {{ temporal?: string, mutacion?: "no"|"informar", mutacionMax?: number }} [opciones]
 *   `temporal`: compartir la carpeta temporal con otro escenario. `mutacion: "no"`: sin medición por
 *   mutación (cuatro ejecuciones de pruebas menos), para los casos que no tratan de ella.
 */
export function escenario(opciones = {}) {
  const base = realpathSync(mkdtempSync(join(tmpdir(), "forge-corte-")));
  const dir = join(base, "proyecto");
  const temporal = opciones.temporal ?? join(base, "tmp");
  mkdirSync(join(dir, ".sdd"), { recursive: true });
  mkdirSync(temporal, { recursive: true });
  writeFileSync(join(dir, ".sdd", "estado.json"), JSON.stringify({ pipeline_step: "code" }));
  // Pocas alteraciones: aquí se prueba que la medición sobrevive a un corte, no la medición
  writeFileSync(join(dir, ".sdd", "sdd.config.yaml"), `motor:\n  mutacion: ${opciones.mutacion ?? "informar"}\n  mutacion_max: ${opciones.mutacionMax ?? 3}\n`);
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "demo", type: "module", scripts: { test: "node --test" } }));
  writeFileSync(join(dir, "tareas.json"), JSON.stringify([{ id: "T1", agente: "desarrollador-backend", prompt: "Implementa suma(a, b) y esPar(n) en src/suma.js" }]));
  const e = {
    base, dir, temporal,
    guion: join(base, "guion.json"),
    llamadas: join(base, "llamadas.jsonl"),
    docker: join(base, "docker.jsonl"),
    /** Identificador del proyecto en las etiquetas de sus contenedores (ver SandboxRunner). */
    proyectoId: createHash("sha256").update(resolve(dir)).digest("hex").slice(0, 12),
  };
  escribirGuion(e);
  return e;
}

/** @param {ReturnType<typeof escenario>} e @param {Parameters<typeof reglas>[0]} [extra] */
export function escribirGuion(e, extra) {
  writeFileSync(e.guion, JSON.stringify({ completar: reglas(extra), registro: e.llamadas }));
}

/** Líneas de un archivo JSONL; una línea a medio escribir se ignora. */
export function lineas(ruta) {
  let texto;
  try { texto = readFileSync(ruta, "utf8"); } catch { return []; }
  const salida = [];
  for (const l of texto.split("\n")) { if (!l) continue; try { salida.push(JSON.parse(l)); } catch { /* a medias */ } }
  return salida;
}

/**
 * Lanza `forge <args>` en el proyecto.
 * @param {ReturnType<typeof escenario>} e
 * @param {string[]} args
 * @param {{ real?: boolean, env?: Record<string, string> }} [opciones]
 */
export function lanzar(e, args, opciones = {}) {
  const { NODE_TEST_CONTEXT: _omitida, ...heredado } = process.env;
  const env = {
    ...heredado,
    // Nunca un modelo de pago: proveedor de pruebas y ninguna clave
    FORGE_LLM_PROVIDER: "stub", FORGE_STUB_GUION: e.guion, ANTHROPIC_API_KEY: "", CLAUDE_API_KEY: "", OPENAI_API_KEY: "",
    // La medición por mutación crea sus copias en la carpeta temporal: una propia, para poder mirarla
    TEMP: e.temporal, TMP: e.temporal, TMPDIR: e.temporal,
    FALSO_REGISTRO: e.docker,
    // Con Docker de verdad y la suite en paralelo, las consultas a Docker tardan: aquí no se mide eso
    FORGE_DOCKER_TIMEOUT_S: process.env.FORGE_DOCKER_TIMEOUT_S ?? "180",
    ...opciones.env,
  };
  const proc = spawn(process.execPath, [opciones.real ? CLI : FALSO, ...args], { cwd: e.dir, env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  let salida = "";
  proc.stdout.on("data", (d) => { salida += d; });
  proc.stderr.on("data", (d) => { salida += d; });
  let fin = null;
  const terminado = new Promise((res) => proc.on("close", (codigo, senal) => { fin = { codigo, senal, salida }; res(fin); }));
  return { proc, pid: /** @type {number} */ (proc.pid), terminado, salida: () => salida, fin: () => fin };
}

/** Lanza y espera a que termine. @returns {Promise<{ codigo: number|null, senal: string|null, salida: string }>} */
export async function ejecutar(e, args, opciones) {
  return /** @type {any} */ (await conTope(lanzar(e, args, opciones).terminado, `forge ${args.join(" ")}`));
}

/** @template T @param {Promise<T>} promesa @param {string} que @returns {Promise<T>} */
export function conTope(promesa, que) {
  let reloj;
  const tope = new Promise((_, rej) => { reloj = setTimeout(() => rej(new Error(`no terminó a tiempo: ${que}`)), TOPE_MS); });
  return Promise.race([promesa, tope]).finally(() => clearTimeout(reloj));
}

/**
 * Espera a que `condicion()` sea cierta mirando el disco. Si el proceso termina antes, el corte ya
 * no se puede hacer donde se quería: falla con su salida.
 * @param {() => unknown | Promise<unknown>} condicion
 * @param {{ que: string, proceso?: ReturnType<typeof lanzar>, cadaMs?: number }} opciones
 */
export async function esperar(condicion, { que, proceso, cadaMs = 20 }) {
  const limite = Date.now() + TOPE_MS;
  for (;;) {
    const valor = await condicion();
    if (valor) return valor;
    if (proceso?.fin()) throw new Error(`el proceso terminó (código ${proceso.fin().codigo}) antes de: ${que}\n${proceso.salida()}`);
    if (Date.now() > limite) throw new Error(`no ocurrió a tiempo: ${que}\n${proceso?.salida() ?? ""}`);
    await new Promise((r) => setTimeout(r, cadaMs));
  }
}

/**
 * Mata el proceso sin darle ocasión de limpiar nada: SIGKILL (en Windows, `kill` termina el proceso
 * con TerminateProcess, que tampoco avisa). Los procesos que él lanzó (el cliente de docker) no mueren con él.
 * @param {ReturnType<typeof lanzar>} proceso
 */
export async function matar(proceso) {
  assert.equal(proceso.fin(), null, `el proceso ya había terminado antes del corte:\n${proceso.salida()}`);
  proceso.proc.kill("SIGKILL");
  const fin = /** @type {any} */ (await conTope(proceso.terminado, "muerte del proceso"));
  assert.notEqual(fin.codigo, 0, "el proceso no terminó por sí mismo");
  return fin;
}

// ─── Lo que queda en el disco ─────────────────────────────────────────────────────────────────

const dirMotor = (e) => join(e.dir, ".sdd", "motor");
/** Carpetas de sesión del proyecto. */
export function sesiones(e) {
  try { return readdirSync(dirMotor(e), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch { return []; }
}
/** Líneas de `gasto.jsonl` de todas las sesiones: cada una es una llamada pagada. */
export const gasto = (e) => sesiones(e).flatMap((s) => lineas(join(dirMotor(e), s, "gasto.jsonl")));
/** Copias de trabajo que hay ahora mismo, en cualquier sesión. */
export function copiasDeTrabajo(e) {
  return sesiones(e).flatMap((s) => { try { return readdirSync(join(dirMotor(e), s, "staging")).map((n) => join(s, "staging", n)); } catch { return []; } });
}
/** Carpetas `forge-mutacion-*` en la carpeta temporal del escenario. */
export function copiasDeMutacion(e) {
  try { return readdirSync(e.temporal).filter((n) => n.startsWith("forge-mutacion-")); } catch { return []; }
}
/** Candados puestos: el de proyecto y los de cada tarea. */
export function candados(e) {
  const encontrados = [];
  const mirar = (dir, rel) => {
    let entradas;
    try { entradas = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const d of entradas) {
      if (d.isDirectory()) { if (d.name !== "staging" && d.name !== "respaldo") mirar(join(dir, d.name), `${rel}${d.name}/`); }
      else if (/\.lock(\.|$)/.test(d.name)) encontrados.push(rel + d.name);
    }
  };
  mirar(dirMotor(e), "");
  return encontrados;
}
export const candadoDeProyecto = (e) => { try { return JSON.parse(readFileSync(join(dirMotor(e), "proyecto.lock"), "utf8")); } catch { return null; } };
export const eventos = (e) => lineas(join(e.dir, ".sdd", "events.jsonl"));
export const estadoDeTarea = (e, id = "T1") => new EventLog(join(e.dir, ".sdd")).replayTaskStates().get(id)?.estado;
export const sesionActual = (e) => { try { return JSON.parse(readFileSync(join(dirMotor(e), "sesion.json"), "utf8")).runId; } catch { return null; } };
/** Puntos de guardado de la tarea T1 en la sesión dada: [{ nodo, siguiente }]. */
export function puntos(e, runId = sesionActual(e)) {
  const dir = join(dirMotor(e), String(runId), "checkpoints");
  try {
    return readdirSync(dir).flatMap((hilo) => readdirSync(join(dir, hilo)).filter((f) => /^\d{6}\.json$/.test(f)).sort()
      .map((f) => { const p = JSON.parse(readFileSync(join(dir, hilo, f), "utf8")); return { nodo: p.nodo, siguiente: p.siguiente }; }));
  } catch { return []; }
}

// ─── Docker de verdad ─────────────────────────────────────────────────────────────────────────

/** ¿Se pidieron las pruebas con Docker y Docker contesta? */
export function dockerActivo() {
  if (process.env.FORGE_TEST_DOCKER !== "1") return false;
  return spawnSync("docker", ["version", "--format", "{{.Server.Version}}"], { encoding: "utf8", timeout: 180_000 }).status === 0;
}

/**
 * Contenedores de FORGE de ESTE proyecto (con las dos etiquetas: la general y la del proyecto). Se filtra
 * por proyecto porque otras pruebas con Docker pueden estar corriendo a la vez en el mismo equipo.
 * @param {ReturnType<typeof escenario>} e @param {{ todos?: boolean }} [opciones]  `todos`: también los parados
 * @returns {string[]} nombres
 */
export function contenedores(e, { todos = true } = {}) {
  const r = spawnSync("docker", ["ps", ...(todos ? ["-a"] : []), "--filter", "label=forge.sandbox=1", "--filter", `label=forge.proyecto=${e.proyectoId}`, "--format", "{{.Names}}"], { encoding: "utf8", timeout: 180_000 });
  assert.equal(r.status, 0, `docker ps falló: ${r.stderr}`);
  return r.stdout.split(/\s+/).filter(Boolean);
}

// ─── Comprobaciones comunes ───────────────────────────────────────────────────────────────────

/**
 * Lo que debe cumplirse cuando la tarea ha terminado, la hayan cortado o no.
 * @param {ReturnType<typeof escenario>} e
 * @param {{ real?: boolean, pagadas?: number }} [opciones]
 */
export function comprobarFinal(e, { real = false, pagadas = LLAMADAS_DEL_CICLO } = {}) {
  assert.equal(estadoDeTarea(e), "completada", "la tarea termina");
  assert.equal(readFileSync(join(e.dir, "src", "suma.js"), "utf8"), IMPLEMENTACION);
  assert.equal(readFileSync(join(e.dir, "tests", "suma.test.js"), "utf8"), PRUEBAS);

  // Ninguna llamada pagada se repite: el libro de gasto tiene las del ciclo y ni una más…
  assert.equal(gasto(e).length, pagadas, `líneas de gasto.jsonl: ${JSON.stringify(gasto(e))}`);
  // …y el proveedor respondió exactamente esas (lo que cuenta es la respuesta: una llamada cortada a medias no se cobró)
  const respondidas = lineas(e.llamadas).filter((l) => l.fase === "fin");
  assert.equal(respondidas.length, pagadas, `llamadas respondidas por el proveedor: ${JSON.stringify(respondidas)}`);
  assert.equal(new Set(respondidas.map((l) => l.huella)).size, respondidas.length, "ninguna petición se respondió dos veces");

  assert.deepEqual(copiasDeTrabajo(e), [], "no quedan copias de trabajo");
  assert.deepEqual(copiasDeMutacion(e), [], "no quedan carpetas forge-mutacion-*");
  assert.deepEqual(candados(e), [], "no queda ningún candado puesto");
  if (real) assert.deepEqual(contenedores(e), [], "no quedan contenedores de FORGE de este proyecto");
}
