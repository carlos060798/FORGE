#!/usr/bin/env node
/**
 * shared/config.js — Configuración compartida entre hooks de FORGE
 *
 * Jerarquía de configuración (mayor prioridad primero):
 *   1. sdd.config.yaml  (.sdd/) — configuración del proyecto: memoria, calidad, agentes
 *   2. forge.config.json (raíz) — infraestructura: guardrails, routing, ignore_patterns
 *   3. Defaults hardcodeados     — valores seguros predeterminados
 *
 * Importar en cualquier hook:
 *   import { leerForgeConfig, leerSddConfig } from './shared/config.js';
 */

import { existsSync, readFileSync, mkdirSync, appendFileSync } from "node:fs";

const _fs = { mkdirSync, appendFileSync };
import { join } from "node:path";

// ── Defaults ─────────────────────────────────────────────────────────────────

const FORGE_CONFIG_DEFAULTS = {
  memoria: { umbral_compresion_bytes: 40_000, max_archivos_agente: 3 },
  routing: { usar_complexity_ir: true, complexity_umbral_opus: "high" },
  guardrails: { write_safety: true, verify_local_imports: false },
  ignore_patterns: [],
};

const SDD_CONFIG_DEFAULTS = {
  umbral_bytes: FORGE_CONFIG_DEFAULTS.memoria.umbral_compresion_bytes,
  backend: "markdown",
  recuperacion_por_defecto: 10,
  consumo_max_mb: 10,
};

// ── forge.config.json ─────────────────────────────────────────────────────────

/**
 * Lee forge.config.json desde la raíz del proyecto.
 * Controla: guardrails de escritura, routing, patrones ignorados.
 * @param {string} cwd directorio de trabajo
 */
export function leerForgeConfig(cwd = process.cwd()) {
  const configPath = join(cwd, "forge.config.json");
  if (!existsSync(configPath)) return { ...FORGE_CONFIG_DEFAULTS };
  try {
    const parsed = JSON.parse(readFileSync(configPath, "utf8"));
    return {
      memoria: { ...FORGE_CONFIG_DEFAULTS.memoria, ...(parsed.memoria ?? {}) },
      routing: { ...FORGE_CONFIG_DEFAULTS.routing, ...(parsed.routing ?? {}) },
      guardrails: { ...FORGE_CONFIG_DEFAULTS.guardrails, ...(parsed.guardrails ?? {}) },
      ignore_patterns: parsed.ignore_patterns ?? [],
    };
  } catch {
    return { ...FORGE_CONFIG_DEFAULTS };
  }
}

// ── sdd.config.yaml ───────────────────────────────────────────────────────────

/**
 * Auto-detecta si Node >= 22.5 tiene node:sqlite disponible.
 */
function nodeSoportaSQLite() {
  try {
    const [major, minor] = process.versions.node.split(".").map(Number);
    return major > 22 || (major === 22 && minor >= 5);
  } catch { return false; }
}

/**
 * Lee sdd.config.yaml con regex línea-por-línea (cero dependencias).
 * Controla: backend de memoria, umbral de compresión, consumo_max_mb.
 * @param {string} cwd directorio de trabajo
 */
export function leerSddConfig(cwd = process.cwd()) {
  const forgeConfig = leerForgeConfig(cwd);
  const configPath = join(cwd, ".sdd", "sdd.config.yaml");
  const backendDefault = nodeSoportaSQLite() ? "sqlite" : "markdown";

  const defaults = {
    umbral_bytes: forgeConfig.memoria.umbral_compresion_bytes,
    backend: backendDefault,
    recuperacion_por_defecto: SDD_CONFIG_DEFAULTS.recuperacion_por_defecto,
    consumo_max_mb: SDD_CONFIG_DEFAULTS.consumo_max_mb,
  };

  if (!existsSync(configPath)) return defaults;
  try {
    const yaml = readFileSync(configPath, "utf8");
    const umbral  = yaml.match(/^[ \t]+umbral_bytes:\s*(\d+)/m);
    const backend = yaml.match(/^[ \t]+backend:\s*"?(sqlite|markdown)"?/m);
    const recup   = yaml.match(/^[ \t]+recuperacion_por_defecto:\s*(\d+)/m);
    const maxMb   = yaml.match(/consumo_max_mb:\s*(\d+)/);
    return {
      umbral_bytes: umbral  ? parseInt(umbral[1],  10) : defaults.umbral_bytes,
      backend:      backend ? backend[1]               : defaults.backend,
      recuperacion_por_defecto: recup ? parseInt(recup[1], 10) : defaults.recuperacion_por_defecto,
      consumo_max_mb: maxMb ? parseInt(maxMb[1], 10)  : defaults.consumo_max_mb,
    };
  } catch {
    return defaults;
  }
}

/**
 * Atajo: retorna solo consumo_max_mb (usado frecuentemente en rotación JSONL).
 * @param {string} cwd directorio de trabajo
 */
export function leerMaxMBConsumo(cwd = process.cwd()) {
  return leerSddConfig(cwd).consumo_max_mb;
}

/**
 * Lee el nivel de ejecución actual escrito por CircuitBreaker en .sdd/execution-level.json.
 * Permite que pre-tool-guard conozca el nivel sin importar el módulo TS.
 * @param {string} cwd directorio de trabajo
 * @returns {'sandbox'|'local'|'confirmado'}
 */
/**
 * Dead Letter Queue — registra un fallo de hook para reintento posterior.
 * Escribe en .sdd/observabilidad/dlq.jsonl (append-only).
 *
 * @param {string} cwd directorio de trabajo
 * @param {{ hook: string, tool: string, input: unknown, error: string, retryable?: boolean }} entry
 */
export function dlqAppend(cwd, entry) {
  try {
    const { mkdirSync, appendFileSync } = _fs;
    const dir = join(cwd, ".sdd", "observabilidad");
    mkdirSync(dir, { recursive: true });
    appendFileSync(
      join(dir, "dlq.jsonl"),
      JSON.stringify({ ts: new Date().toISOString(), retryable: true, ...entry }) + "\n",
      "utf8"
    );
  } catch { /* DLQ nunca debe romper el hook padre */ }
}

export function leerNivelEjecucion(cwd = process.cwd()) {
  try {
    const p = join(cwd, '.sdd', 'execution-level.json');
    if (!existsSync(p)) return 'local';
    const { nivel } = JSON.parse(readFileSync(p, 'utf8'));
    return ['sandbox', 'local', 'confirmado'].includes(nivel) ? nivel : 'local';
  } catch { return 'local'; }
}
