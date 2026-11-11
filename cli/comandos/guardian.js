// @ts-check
/**
 * guardian.js — `fragua guardian evaluar` y `fragua memoria registrar`.
 *
 * Punto de entrada neutral al guardián y a la memoria de agentes (plan docs/PLAN-AGNOSTICO.md, F3):
 * leen el evento JSON (contrato en docs/contrato/evento-herramienta.md) por la entrada estándar y
 * ejecutan EXACTAMENTE los mismos scripts que los hooks de Claude Code, sin duplicar reglas.
 * La identidad del agente sale de FRAGUA_AGENTE / FORGE_AGENTE (respaldo: CLAUDE_AGENT_NAME).
 * Salida: 0 permitir, 2 bloquear, 1 uso incorrecto.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PLUGIN_DIR } from "./comun.js";
import { agenteActivo } from "../../claude-hooks/shared/entorno.js";
import { ANFITRIONES_CON_HOOK, traducirEvento } from "../../core/instalacion/hooks-anfitrion.js";

const HOOKS = { guardian: "pre-tool-guard.js", memoria: "agent-memory.js" };

/**
 * @param {"guardian"|"memoria"} cual
 * @param {string} entrada evento JSON
 * @param {{ cwd?: string, env?: Record<string,string|undefined> }} [opc]
 * @returns {{ codigo: number, stderr: string }}
 */
export function ejecutarHook(cual, entrada, { cwd = process.cwd(), env = process.env } = {}) {
  try { JSON.parse(entrada); } catch { return { codigo: 1, stderr: "El evento no es un JSON válido (se espera el contrato de docs/contrato/evento-herramienta.md).\n" }; }
  const script = join(PLUGIN_DIR, "claude-hooks", HOOKS[cual]);
  if (!existsSync(script)) return { codigo: 2, stderr: `FORGE detuvo esta acción: falta ${HOOKS[cual]} (instalación incompleta).\n` };
  const agente = agenteActivo(env);
  const r = spawnSync(process.execPath, [script], { cwd, input: entrada, encoding: "utf8", timeout: 30_000, env: { ...env, ...(agente ? { CLAUDE_AGENT_NAME: agente } : {}) } });
  // Falla cerrado: si el guardián no pudo ejecutarse, se bloquea
  if (r.error || r.status === null) return { codigo: cual === "guardian" ? 2 : 1, stderr: `No se pudo ejecutar ${HOOKS[cual]}: ${r.error?.message ?? "terminó sin código"}\n` };
  return { codigo: r.status, stderr: r.stderr ?? "" };
}

/** @param {string[]} args  p. ej. ["evaluar"] */
export function cmdGuardian(args) {
  const USO = "Uso: fragua guardian evaluar [--anfitrion " + ANFITRIONES_CON_HOOK.join("|") + "]   (evento JSON por la entrada estándar; 0 permite, 2 bloquea)";
  if (args[0] !== "evaluar") { console.error(USO); return 1; }
  const i = args.indexOf("--anfitrion");
  const anfitrion = i === -1 ? "claude" : (args[i + 1] ?? "");
  if (anfitrion !== "claude" && !ANFITRIONES_CON_HOOK.includes(anfitrion)) { console.error(`Anfitrión desconocido: "${anfitrion}". ${USO}`); return 1; }
  return correr("guardian", anfitrion);
}

/** @param {string[]} args  p. ej. ["registrar"] */
export function cmdMemoria(args) {
  if (args[0] !== "registrar") { console.error("Uso: fragua memoria registrar   (evento JSON de PostToolUse por la entrada estándar)"); return 1; }
  return correr("memoria");
}

function correr(/** @type {"guardian"|"memoria"} */ cual, anfitrion = "claude") {
  let entrada = "";
  try { entrada = readFileSync(0, "utf8"); } catch { /* sin entrada */ }
  entrada = entrada.trim();
  if (anfitrion === "claude") {
    const r = ejecutarHook(cual, entrada);
    if (r.stderr) process.stderr.write(r.stderr);
    return r.codigo;
  }
  // Otra herramienta: se traduce su evento al contrato; basta que uno de los eventos bloquee
  let eventos;
  try { eventos = traducirEvento(anfitrion, JSON.parse(entrada)); } catch {
    process.stderr.write("El evento no es un JSON válido.\n");
    return cual === "guardian" ? 2 : 1;
  }
  let codigo = 0;
  for (const ev of eventos) {
    const r = ejecutarHook(cual, JSON.stringify(ev));
    if (r.stderr) process.stderr.write(r.stderr);
    if (r.codigo !== 0 && codigo === 0) codigo = r.codigo;
  }
  return codigo;
}
