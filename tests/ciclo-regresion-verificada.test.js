// @ts-check
/**
 * Regresión del ciclo verificado (spec 2026-10-14-perfiles-de-agente, CA-005-04 y CA-005-05; tarea F1.1).
 *
 * Con el proveedor de pruebas guionizado y el ejecutor de pruebas falso, el ciclo produce lo mismo antes y
 * después de los perfiles: los mismos archivos (con su sha256), las mismas huellas de pruebas e implementación,
 * las mismas llamadas y prompts, las mismas herramientas ofrecidas, los mismos eventos de diario (salvo los
 * `ciclo:perfil_*`, que son nuevos a propósito) y el mismo veredicto. Los valores esperados se tomaron del
 * código previo a los perfiles (commit 8424922); la prueba solo usa la API pública de CicloVerificado y
 * `POR_DEFECTO`, así que corre igual en ambos.
 *
 * Dos modos del implementador (`bloque` y `turnos`) y tres historias: un implementador que lee y edita, otro que
 * edita directamente, y otro que lee una ruta fuera de las pruebas.
 */

import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";

import { POR_DEFECTO } from "../core/ciclo/config.js";
import { CicloVerificado } from "../core/ciclo/index.js";
import { comprobarConversacion } from "../core/llm-providers/stub-provider.js";
import { sesionSellada } from "../core/ciclo/sello.js";

const PLAN = '{"pasos":["x"],"archivosObjetivo":["src/a.js"]}';
const PRUEBAS = '```json\n{"archivos":[{"ruta":"tests/a.test.js","contenido":"import \'../src/a.js\';\\n"}]}\n```';
const BLOQUE = '```json\n{"archivos":[{"ruta":"src/nuevo.js","contenido":"export const n = 1;\\n"}]}\n```';
const TAREA = { id: "T1", agente: "desarrollador-backend", prompt: "Haz algo", archivos: ["src/a.js"] };
const PASA = { exitCode: 0, stdout: "# tests 1\n# pass 1\n" };
const FALLA = { exitCode: 1, stdout: "# tests 1\n# fail 1\n" };
const MODELO = "claude-sonnet-4-6";
const sha = (/** @type {string} */ t) => createHash("sha256").update(t).digest("hex");

let ids = 0;
const uso = (nombre, entrada = {}) => ({ tipo: "uso_herramienta", id: `uso_${++ids}`, nombre, entrada });
const pide = (...usos) => ({ contenido: [{ tipo: "texto", texto: "Sigo." }, ...usos] });
const TERMINA = { contenido: [{ tipo: "texto", texto: "He terminado." }] };
const EDITA = uso("editar", { ruta: "src/nuevo.js", contenido: "export const n = 1;\n" });

/**
 * Un proyecto con un ciclo guionizado. Sin `perfiles` en `sdd.config.yaml`: es el caso que debe seguir igual.
 * @param {{ turnos?: any[], ejecuciones?: any[], implementador: 'bloque'|'turnos', guionCoder?: string[] }} opciones
 */
function entorno({ turnos = [], ejecuciones = [], implementador, guionCoder = [BLOQUE] }) {
  const cwd = mkdtempSync(join(tmpdir(), "forge-regresion-"));
  writeFileSync(join(cwd, "package.json"), JSON.stringify({ name: "p", type: "module", scripts: { test: "node --test" } }));
  mkdirSync(join(cwd, "src"), { recursive: true });
  writeFileSync(join(cwd, "src", "a.js"), "export const a = 1;\n");
  mkdirSync(join(cwd, ".sdd", "motor"), { recursive: true });
  writeFileSync(join(cwd, ".sdd", "motor", "sesion.json"), JSON.stringify(sesionSellada({ runId: "r1", modo: "ciclo", creada: "2026-10-09T00:00:00Z" })));
  const e = {
    cwd,
    turnos: [...turnos],
    colaEjecuciones: [...ejecuciones],
    /** @type {any[]} */ conversaciones: [],
    /** @type {any[]} */ eventos: [],
    /** @type {{ agente: string, sha256: string }[]} */ llamadas: [],
    guion: { arquitecto: [PLAN], tester: [PRUEBAS], "desarrollador-backend": [...guionCoder] },
    nuevoCiclo() {
      const opciones = {
        cwd, runId: "r1", testCmd: "npm test",
        config: { ...POR_DEFECTO, motor: { ...POR_DEFECTO.motor, grafo: "propio", mutacion: "no", implementador, } },
        log: { append: (/** @type {string} */ type, /** @type {any} */ payload, /** @type {any} */ meta) => { e.eventos.push({ type, payload, meta }); } },
        aliasDe: () => "sonnet",
        llamar: async (/** @type {any} */ p) => {
          const s = e.guion[p.agente]?.shift();
          if (s === undefined) throw new Error(`guion agotado para ${p.agente}`);
          e.llamadas.push({ agente: p.agente, sha256: sha(JSON.stringify(p)) });
          return { ok: true, output: s, inputTokens: 100, outputTokens: 10, modelo: MODELO, proveedor: "anthropic" };
        },
        admiteHerramientas: () => true,
        conversar: async (/** @type {any} */ p) => {
          comprobarConversacion(p.mensajes);
          const paso = e.turnos.shift();
          if (paso === undefined) throw new Error("guion de turnos agotado");
          const r = typeof paso === "function" ? paso(p, e.conversaciones.length + 1) : paso;
          e.conversaciones.push(JSON.parse(JSON.stringify(p)));
          return { ok: true, stopReason: r.contenido?.some((/** @type {any} */ b) => b.tipo === "uso_herramienta") ? "herramientas" : "fin", inputTokens: 1000, outputTokens: 50, modelo: MODELO, proveedor: "anthropic", ...r };
        },
        runner: { test: async () => {
          const r = e.colaEjecuciones.shift();
          if (r === undefined) throw new Error("guion de ejecuciones agotado");
          return { stdout: "", stderr: "", timedOut: false, infraError: false, durationMs: 1, ...r };
        } },
      };
      return new CicloVerificado(/** @type {any} */ (opciones));
    },
  };
  return e;
}

/** Archivos del proyecto (sin `.sdd`) con su sha256: lo que el ciclo deja en disco. */
function archivosDelProyecto(/** @type {string} */ cwd) {
  /** @type {Record<string, string>} */
  const salida = {};
  const recorrer = (/** @type {string} */ dir) => {
    for (const nombre of readdirSync(dir).sort()) {
      const ruta = join(dir, nombre);
      if (statSync(ruta).isDirectory()) { if (nombre !== ".sdd" && nombre !== "node_modules") recorrer(ruta); continue; }
      salida[relative(cwd, ruta).replace(/\\/g, "/")] = sha(readFileSync(ruta, "utf8"));
    }
  };
  recorrer(cwd);
  return salida;
}

/**
 * Lo que el ciclo deja a la vista: archivos, huellas, llamadas, herramientas ofrecidas, eventos de diario y veredicto.
 * Los eventos `ciclo:perfil_*` son nuevos a propósito y no cuentan; el resto debe salir en el mismo orden.
 * @param {ReturnType<typeof entorno>} e @param {any} r
 */
function observar(e, r) {
  const estado = r.estado;
  return {
    veredicto: { resultado: estado.resultado, revision: estado.revision?.motivo ?? null, iteracion: estado.iteracion },
    archivos: archivosDelProyecto(e.cwd),
    huellas: {
      pruebas: estado.pruebas.archivos.map((/** @type {any} */ a) => [a.ruta, a.sha256]),
      implementacion: estado.implementacion.archivos.map((/** @type {any} */ a) => [a.ruta, a.sha256]),
    },
    ejecuciones: estado.ejecuciones.map((/** @type {any} */ x) => ({ exitCode: x.exitCode ?? null, huellaSalida: x.huellaSalida ?? null })),
    llamadas: e.llamadas.map((/** @type {any} */ l) => l.agente),
    prompts: e.llamadas.map((/** @type {any} */ l) => l.sha256),
    herramientasOfrecidas: e.conversaciones.map((/** @type {any} */ c) => (c.herramientas ?? []).map((/** @type {any} */ h) => h.nombre)),
    eventos: e.eventos.filter((/** @type {any} */ ev) => !ev.type.startsWith("ciclo:perfil_")).map((/** @type {any} */ ev) => ev.type),
  };
}

afterEach(() => { ids = 0; });

describe("Regresión del ciclo verificado: mismo resultado antes y después de los perfiles", () => {
  test("implementador por turnos: lee, edita y las pruebas pasan a la segunda", async () => {
    const e = entorno({
      implementador: "turnos",
      turnos: [pide(uso("leer_archivo", { ruta: "src/a.js" })), pide(EDITA), TERMINA],
      ejecuciones: [FALLA, PASA],
    });
    const r = await e.nuevoCiclo().ejecutar(TAREA);
    const observado = observar(e, r);
    assert.deepEqual(observado, ESPERADO.turnos, "el ciclo por turnos cambió respecto al código previo a los perfiles");
  });

  test("implementador en bloque: escribe el bloque y las pruebas pasan a la segunda", async () => {
    const e = entorno({ implementador: "bloque", ejecuciones: [FALLA, PASA] });
    const r = await e.nuevoCiclo().ejecutar(TAREA);
    const observado = observar(e, r);
    assert.deepEqual(observado, ESPERADO.bloque, "el ciclo en bloque cambió respecto al código previo a los perfiles");
  });

  test("implementador por turnos: una ruta fuera de las pruebas se lee, y la escritura sigue por las mismas reglas", async () => {
    const e = entorno({
      implementador: "turnos",
      turnos: [pide(uso("listar", {}), uso("buscar", { texto: "a" })), pide(EDITA), TERMINA],
      ejecuciones: [FALLA, PASA],
    });
    const r = await e.nuevoCiclo().ejecutar(TAREA);
    const observado = observar(e, r);
    assert.deepEqual(observado, ESPERADO.busqueda, "el ciclo con listar y buscar cambió respecto al código previo a los perfiles");
  });
});

/** Valores tomados del código previo a los perfiles (commit 8424922). */
const ESPERADO = {
  turnos: {
    veredicto: {"resultado":"exito","revision":null,"iteracion":1},
    archivos: {"package.json":"597d71e6aa3d58992e7686fe97b8406715af58b1c8886f41ec760053c962d274","src/a.js":"037ecd1db38c230c248787e60fd7bfc0cb0101b187b59535b6e7483be762d350","src/nuevo.js":"e22445c7c5ef7b19b64996dfd7c78b39a0f9436fb265185ae056d4f7b93f51a2","tests/a.test.js":"985f30dabe6fb4f8625c541fea11a1a99973c12c0fcb6134bb68f37d05989fd9"},
    huellas: {"pruebas":[["tests/a.test.js","985f30dabe6fb4f8625c541fea11a1a99973c12c0fcb6134bb68f37d05989fd9"]],"implementacion":[["src/nuevo.js","e22445c7c5ef7b19b64996dfd7c78b39a0f9436fb265185ae056d4f7b93f51a2"]]},
    ejecuciones: [{"exitCode":0,"huellaSalida":"9352b04d423cad7c3b833c7063e9c24f3e970870a1ff31aba1cb7452929ae63a"}],
    llamadas: ["arquitecto","tester"],
    prompts: ["f8809ff07efac3fd1eddeec1731a74cb356c65fe50e8e1421d5c769d0378b807","18dec58219a0005fe275366c1468269d632f61ec5e5fea27aa51efe4d90a90d7"],
    herramientasOfrecidas: [["leer_archivo","listar","buscar","editar","ejecutar_pruebas"],["leer_archivo","listar","buscar","editar","ejecutar_pruebas"],["leer_archivo","listar","buscar","editar","ejecutar_pruebas"]],
    eventos: ["ciclo:nodo_completado","ciclo:nodo_completado","ciclo:rojo","ciclo:nodo_completado","ciclo:turno","ciclo:herramienta","ciclo:turno","ciclo:herramienta","ciclo:turno","ciclo:nodo_completado","ciclo:ejecucion","ciclo:nodo_completado"],
  },
  bloque: {
    veredicto: {"resultado":"exito","revision":null,"iteracion":1},
    archivos: {"package.json":"597d71e6aa3d58992e7686fe97b8406715af58b1c8886f41ec760053c962d274","src/a.js":"037ecd1db38c230c248787e60fd7bfc0cb0101b187b59535b6e7483be762d350","src/nuevo.js":"e22445c7c5ef7b19b64996dfd7c78b39a0f9436fb265185ae056d4f7b93f51a2","tests/a.test.js":"985f30dabe6fb4f8625c541fea11a1a99973c12c0fcb6134bb68f37d05989fd9"},
    huellas: {"pruebas":[["tests/a.test.js","985f30dabe6fb4f8625c541fea11a1a99973c12c0fcb6134bb68f37d05989fd9"]],"implementacion":[["src/nuevo.js","e22445c7c5ef7b19b64996dfd7c78b39a0f9436fb265185ae056d4f7b93f51a2"]]},
    ejecuciones: [{"exitCode":0,"huellaSalida":"9352b04d423cad7c3b833c7063e9c24f3e970870a1ff31aba1cb7452929ae63a"}],
    llamadas: ["arquitecto","tester","desarrollador-backend"],
    prompts: ["f8809ff07efac3fd1eddeec1731a74cb356c65fe50e8e1421d5c769d0378b807","18dec58219a0005fe275366c1468269d632f61ec5e5fea27aa51efe4d90a90d7","574d2c8269ed03c4101189cfdee2590b57a28f03bf94b09d086a752e66f6567c"],
    herramientasOfrecidas: [],
    eventos: ["ciclo:nodo_completado","ciclo:nodo_completado","ciclo:rojo","ciclo:nodo_completado","ciclo:nodo_completado","ciclo:ejecucion","ciclo:nodo_completado"],
  },
  busqueda: {
    veredicto: {"resultado":"exito","revision":null,"iteracion":1},
    archivos: {"package.json":"597d71e6aa3d58992e7686fe97b8406715af58b1c8886f41ec760053c962d274","src/a.js":"037ecd1db38c230c248787e60fd7bfc0cb0101b187b59535b6e7483be762d350","src/nuevo.js":"e22445c7c5ef7b19b64996dfd7c78b39a0f9436fb265185ae056d4f7b93f51a2","tests/a.test.js":"985f30dabe6fb4f8625c541fea11a1a99973c12c0fcb6134bb68f37d05989fd9"},
    huellas: {"pruebas":[["tests/a.test.js","985f30dabe6fb4f8625c541fea11a1a99973c12c0fcb6134bb68f37d05989fd9"]],"implementacion":[["src/nuevo.js","e22445c7c5ef7b19b64996dfd7c78b39a0f9436fb265185ae056d4f7b93f51a2"]]},
    ejecuciones: [{"exitCode":0,"huellaSalida":"9352b04d423cad7c3b833c7063e9c24f3e970870a1ff31aba1cb7452929ae63a"}],
    llamadas: ["arquitecto","tester"],
    prompts: ["f8809ff07efac3fd1eddeec1731a74cb356c65fe50e8e1421d5c769d0378b807","18dec58219a0005fe275366c1468269d632f61ec5e5fea27aa51efe4d90a90d7"],
    herramientasOfrecidas: [["leer_archivo","listar","buscar","editar","ejecutar_pruebas"],["leer_archivo","listar","buscar","editar","ejecutar_pruebas"],["leer_archivo","listar","buscar","editar","ejecutar_pruebas"]],
    eventos: ["ciclo:nodo_completado","ciclo:nodo_completado","ciclo:rojo","ciclo:nodo_completado","ciclo:turno","ciclo:herramienta","ciclo:herramienta","ciclo:turno","ciclo:herramienta","ciclo:turno","ciclo:nodo_completado","ciclo:ejecucion","ciclo:nodo_completado"],
  },
};
