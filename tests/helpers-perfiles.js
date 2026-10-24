// @ts-check
/**
 * Entorno compartido de las pruebas de perfiles de agente (spec 2026-10-14-perfiles-de-agente): un proyecto mínimo,
 * el proveedor de pruebas guionizado (modelo y conversación) y el ejecutor de pruebas falso. Lo usan
 * tests/ciclo-perfiles-implementador.test.js y tests/ciclo-perfiles-roles.test.js.
 */

import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { POR_DEFECTO } from "../core/ciclo/config.js";
import { CicloVerificado } from "../core/ciclo/index.js";
import { comprobarConversacion } from "../core/llm-providers/stub-provider.js";
import { sesionSellada } from "../core/ciclo/sello.js";

export const PLAN = '{"pasos":["x"],"archivosObjetivo":["src/a.js"]}';
export const PRUEBAS = '```json\n{"archivos":[{"ruta":"tests/a.test.js","contenido":"import \'../src/a.js\';\\n"}]}\n```';
export const BLOQUE = '```json\n{"archivos":[{"ruta":"src/nuevo.js","contenido":"export const n = 1;\\n"}]}\n```';
export const TAREA = { id: "T1", agente: "desarrollador-backend", prompt: "Haz algo", archivos: ["src/a.js"] };
export const PASA = { exitCode: 0, stdout: "# tests 1\n# pass 1\n" };
export const FALLA = { exitCode: 1, stdout: "# tests 1\n# fail 1\n" };
export const MODELO = "claude-sonnet-4-6";
export const TERMINA = { contenido: [{ tipo: "texto", texto: "He terminado." }] };
export const EDITA = { tipo: "uso_herramienta", id: "uso_editar", nombre: "editar", entrada: { ruta: "src/nuevo.js", contenido: "export const n = 1;\n" } };

let ids = 0;
/** @param {string} nombre @param {Record<string, unknown>} [entrada] */
export const uso = (nombre, entrada = {}) => ({ tipo: "uso_herramienta", id: `uso_${++ids}`, nombre, entrada });
/** @param {...any} usos */
export const pide = (...usos) => ({ contenido: [{ tipo: "texto", texto: "Sigo." }, ...usos] });
export const tipos = (/** @type {any} */ e, /** @type {string} */ tipo) => e.eventos.filter((/** @type {any} */ ev) => ev.type === tipo);
/** @param {any} mensaje */
export const resultadosDe = (mensaje) => mensaje.contenido.filter((/** @type {any} */ b) => b.tipo === "resultado_herramienta");

/**
 * Un proyecto con un ciclo guionizado. `yaml`: contenido de .sdd/sdd.config.yaml (vacío: sin perfiles de proyecto).
 * @param {{ turnos?: any[], ejecuciones?: any[], motor?: Record<string, unknown>, yaml?: string, bloque?: string[], pruebas?: string[] }} [opciones]
 */
export function entorno({ turnos = [], ejecuciones = [], motor = {}, yaml = "", bloque = [BLOQUE], pruebas = [PRUEBAS] } = {}) {
  const cwd = mkdtempSync(join(tmpdir(), "forge-perfiles-"));
  writeFileSync(join(cwd, "package.json"), JSON.stringify({ name: "p", type: "module", scripts: { test: "node --test" } }));
  mkdirSync(join(cwd, "src"), { recursive: true });
  writeFileSync(join(cwd, "src", "a.js"), "export const a = 1;\n");
  mkdirSync(join(cwd, ".sdd", "motor"), { recursive: true });
  writeFileSync(join(cwd, ".sdd", "motor", "sesion.json"), JSON.stringify(sesionSellada({ runId: "r1", modo: "ciclo", creada: "2026-10-09T00:00:00Z" })));
  if (yaml) { mkdirSync(join(cwd, ".sdd"), { recursive: true }); writeFileSync(join(cwd, ".sdd", "sdd.config.yaml"), yaml, "utf8"); }
  const e = {
    cwd, turnos: [...turnos], colaEjecuciones: [...ejecuciones],
    /** @type {any[]} */ conversaciones: [], /** @type {any[]} */ eventos: [],
    /** @type {Record<string, string[]>} */ guion: { arquitecto: [PLAN], tester: [...pruebas], "desarrollador-backend": [...bloque] },
    /** @type {any[]} */ llamadas: [],
    nuevoCiclo(/** @type {any} */ cambios = {}) {
      const opciones = {
        cwd, runId: "r1", testCmd: "npm test",
        config: { ...POR_DEFECTO, motor: { ...POR_DEFECTO.motor, grafo: "propio", mutacion: "no", implementador: "turnos", ...motor, ...cambios.motor } },
        log: { append: (/** @type {string} */ type, /** @type {any} */ payload, /** @type {any} */ meta) => { e.eventos.push({ type, payload, meta }); } },
        aliasDe: () => "sonnet",
        llamar: async (/** @type {any} */ p) => {
          const s = e.guion[p.agente]?.shift();
          if (s === undefined) throw new Error(`guion agotado para ${p.agente}`);
          e.llamadas.push({ agente: p.agente, parametros: Object.keys(p) });
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
