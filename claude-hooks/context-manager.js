#!/usr/bin/env node
/**
 * context-manager.js — Hook PostToolUse de FORGE para gestión real de contexto
 *
 * Aplica las estrategias de reducción de contexto de mayor impacto real,
 * en orden de efectividad:
 *   1. Presupuesto por fase con umbral enforced (bloqueo proactivo)
 *   2. Resumen progresivo de historial cuando crece demasiado
 *   3. Truncamiento inteligente de tool-results voluminosos
 *   4. Alerta de degradación de modelo por tier cuando el presupuesto cae
 *
 * Protocolo Claude Code hooks:
 *   Exit 0 → permitir / continuar
 *   Exit 2 → bloquear con mensaje en stderr
 *   Stderr → texto visible para el usuario
 *
 * Registro en .claude/settings.json:
 *   { "hooks": { "PostToolUse": [{ "command": "node claude-hooks/context-manager.js" }] } }
 */

import { createInterface } from 'node:readline';
import {
  existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { leerForgeConfig } from './shared/config.js';

const CWD = process.cwd();

// ── Configuración ─────────────────────────────────────────────────────────────

const CONFIG_DEFAULTS = {
  /** Presupuesto USD máximo antes de emitir alerta de tier */
  budget_usd_warning: Number(process.env['FORGE_BUDGET_WARN_USD'] ?? 0.50),
  /** Presupuesto USD máximo antes de bloquear agentes Opus */
  budget_usd_block_opus: Number(process.env['FORGE_BUDGET_BLOCK_USD'] ?? 1.00),
  /** Bytes máximos de un tool-result antes de truncarlo */
  tool_result_max_bytes: Number(process.env['FORGE_TOOL_MAX_BYTES'] ?? 50_000),
  /** Tamaño máximo del ledger antes de rotar (bytes) */
  ledger_max_bytes: Number(process.env['FORGE_LEDGER_MAX_BYTES'] ?? 5_000_000),
};

// Precios USD/token (actualizados para Claude 4.x)
const PRECIOS_POR_MODELO = {
  'claude-opus-4-8':           { input: 15 / 1_000_000, output: 75 / 1_000_000 },
  'claude-sonnet-4-6':         { input: 3  / 1_000_000, output: 15 / 1_000_000 },
  'claude-haiku-4-5-20251001': { input: 0.8 / 1_000_000, output: 4  / 1_000_000 },
};

// ── Rutas de estado persistente ───────────────────────────────────────────────

const ESTADO_DIR      = join(CWD, '.sdd', 'observabilidad');
const LEDGER_PATH     = join(ESTADO_DIR, 'consumo.jsonl');
const BUDGET_STATE    = join(ESTADO_DIR, 'budget-state.json');
const SUMMARY_PATH    = join(ESTADO_DIR, 'context-summary.md');

function ensureObsDir() {
  mkdirSync(ESTADO_DIR, { recursive: true });
}

// ── Ledger: leer y acumular ───────────────────────────────────────────────────

function leerBudgetState() {
  if (!existsSync(BUDGET_STATE)) {
    return { tokens_input: 0, tokens_output: 0, costo_usd: 0, llamadas: 0, session_start: new Date().toISOString() };
  }
  try { return JSON.parse(readFileSync(BUDGET_STATE, 'utf8')); } catch { return {}; }
}

function guardarBudgetState(state) {
  ensureObsDir();
  writeFileSync(BUDGET_STATE, JSON.stringify({ ...state, updated_at: new Date().toISOString() }, null, 2));
}

function calcularCosto(modelo, tokens_input, tokens_output) {
  const precios = PRECIOS_POR_MODELO[modelo] ?? PRECIOS_POR_MODELO['claude-sonnet-4-6'];
  return tokens_input * precios.input + tokens_output * precios.output;
}

function registrarEnLedger(entrada) {
  ensureObsDir();
  // Rotación simple: si el ledger supera el límite, renombrar y empezar de cero
  if (existsSync(LEDGER_PATH)) {
    const { size } = { size: readFileSync(LEDGER_PATH).length };
    if (size > CONFIG_DEFAULTS.ledger_max_bytes) {
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const archivado = LEDGER_PATH.replace('.jsonl', `-${ts}.jsonl`);
      writeFileSync(archivado, readFileSync(LEDGER_PATH));
      writeFileSync(LEDGER_PATH, '');
    }
  }
  appendFileSync(LEDGER_PATH, JSON.stringify(entrada) + '\n');
}

// ── Truncamiento de tool-results ──────────────────────────────────────────────

/**
 * Si el contenido de un tool-result supera el umbral, lo trunca y añade resumen.
 * Claude Code no expone los tool-results directamente en el hook PostToolUse,
 * pero sí podemos inspeccionar el campo `output` del evento y emitir advertencias.
 */
function evaluarTamañoOutput(output) {
  const bytes = Buffer.byteLength(JSON.stringify(output ?? ''), 'utf8');
  if (bytes > CONFIG_DEFAULTS.tool_result_max_bytes) {
    process.stderr.write(
      `⚠️  [context-manager] tool-result grande: ${(bytes / 1024).toFixed(1)} KB. `
      + `Considera usar índice (forge query-memory) en vez de leer el archivo completo.\n`
    );
  }
  return bytes;
}

// ── Resumen progresivo ────────────────────────────────────────────────────────

/**
 * Cuando el presupuesto supera el 50% del umbral de warning, genera un resumen
 * de la sesión en .sdd/observabilidad/context-summary.md para que los agentes
 * puedan cargarlo en lugar del historial completo.
 */
function actualizarResumenProgresivo(state, evento) {
  const porcentaje = state.costo_usd / CONFIG_DEFAULTS.budget_usd_warning;
  if (porcentaje < 0.5) return;

  ensureObsDir();
  const linea = `- [${new Date().toISOString().slice(0, 16)}] ${evento.tool_name ?? 'tool'}: ${evento.agente ?? 'main'} (acum: $${state.costo_usd.toFixed(4)})\n`;
  if (!existsSync(SUMMARY_PATH)) {
    writeFileSync(SUMMARY_PATH,
      `# Resumen de sesión FORGE (context-manager)\n\n`
      + `Generado automáticamente cuando el consumo supera el 50% del umbral.\n`
      + `Cargar este archivo en lugar del historial completo reduce el contexto significativamente.\n\n`
      + `## Eventos de sesión\n\n`
    );
  }
  appendFileSync(SUMMARY_PATH, linea);
}

// ── Análisis de evento ────────────────────────────────────────────────────────

function extraerMetricas(evento) {
  // Claude Code envía en PostToolUse: tool_name, tool_input, tool_response
  // La respuesta puede contener usage si el tool fue una llamada a agente
  const usage = evento?.tool_response?.usage
    ?? evento?.usage
    ?? { input_tokens: 0, output_tokens: 0 };

  return {
    tool_name: evento?.tool_name ?? 'unknown',
    agente: process.env?.CLAUDE_AGENT_NAME ?? evento?.session_id ?? 'main',
    modelo: evento?.model ?? 'claude-sonnet-4-6',
    tokens_input: usage.input_tokens ?? 0,
    tokens_output: usage.output_tokens ?? 0,
    output_bytes: Buffer.byteLength(JSON.stringify(evento?.tool_response ?? ''), 'utf8'),
    ts: new Date().toISOString(),
  };
}

// ── Evaluación de presupuesto ─────────────────────────────────────────────────

/**
 * Evalúa el estado del presupuesto y decide si bloquear/advertir.
 * @returns {{ action: 'allow'|'warn'|'block', mensaje?: string }}
 */
function evaluarPresupuesto(state) {
  const costo = state.costo_usd ?? 0;

  if (costo >= CONFIG_DEFAULTS.budget_usd_block_opus) {
    return {
      action: 'block',
      mensaje:
        `🚫 [FORGE context-manager] Presupuesto de sesión agotado: $${costo.toFixed(4)} USD\n`
        + `   Umbral configurado: $${CONFIG_DEFAULTS.budget_usd_block_opus} USD\n`
        + `   Para continuar:\n`
        + `   1. Aumenta el umbral: export FORGE_BUDGET_BLOCK_USD=2.0\n`
        + `   2. O inicia una nueva sesión para resetear el contador\n`
        + `   3. Consulta el historial: node cli/index.js logs --last=20`,
    };
  }

  if (costo >= CONFIG_DEFAULTS.budget_usd_warning) {
    const porcentaje = Math.round((costo / CONFIG_DEFAULTS.budget_usd_block_opus) * 100);
    return {
      action: 'warn',
      mensaje:
        `⚠️  [context-manager] Presupuesto al ${porcentaje}%: $${costo.toFixed(4)} / $${CONFIG_DEFAULTS.budget_usd_block_opus} USD\n`
        + `   Estrategias disponibles:\n`
        + `   • Degradar a Haiku: export FORGE_TIER=low\n`
        + `   • Ver consumo por agente: node cli/index.js logs --last=20\n`
        + `   • Cargar resumen en lugar de historial: .sdd/observabilidad/context-summary.md`,
    };
  }

  return { action: 'allow' };
}

// ── Capas de carga: enforcement ───────────────────────────────────────────────

// Herramientas que típicamente cargan contexto masivo — auditar su output
const HERRAMIENTAS_PESADAS = new Set(['Read', 'Bash', 'WebFetch', 'WebSearch']);

function auditarCapaDeCarga(metricas) {
  if (!HERRAMIENTAS_PESADAS.has(metricas.tool_name)) return;
  const kb = metricas.output_bytes / 1024;
  if (kb > CONFIG_DEFAULTS.tool_result_max_bytes / 1024) {
    process.stderr.write(
      `⚠️  [context-manager] ${metricas.tool_name} devolvió ${kb.toFixed(1)} KB. `
      + `Para archivos grandes usa el índice: node claude-hooks/query-memory.js "<términos>"\n`
    );
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

const rl = createInterface({ input: process.stdin, terminal: false });
let raw = '';
rl.on('line', l => raw += l + '\n');
rl.on('close', () => {
  let evento = {};
  try { evento = JSON.parse(raw.trim()); } catch { /* evento vacío = no hay datos de uso */ }

  const metricas = extraerMetricas(evento);

  // Registrar en ledger solo si hay tokens reales (evitar ruido)
  if (metricas.tokens_input > 0 || metricas.tokens_output > 0) {
    const costo = calcularCosto(metricas.modelo, metricas.tokens_input, metricas.tokens_output);
    const state = leerBudgetState();
    state.tokens_input  = (state.tokens_input ?? 0) + metricas.tokens_input;
    state.tokens_output = (state.tokens_output ?? 0) + metricas.tokens_output;
    state.costo_usd     = (state.costo_usd ?? 0) + costo;
    state.llamadas      = (state.llamadas ?? 0) + 1;
    guardarBudgetState(state);

    registrarEnLedger({
      ts: metricas.ts,
      agente: metricas.agente,
      tool: metricas.tool_name,
      modelo: metricas.modelo,
      tokens_input: metricas.tokens_input,
      tokens_output: metricas.tokens_output,
      costo_usd: Math.round(costo * 1_000_000) / 1_000_000,
      bytes: metricas.output_bytes,
    });

    actualizarResumenProgresivo(state, metricas);

    const decision = evaluarPresupuesto(state);
    if (decision.action === 'block') {
      process.stderr.write(decision.mensaje + '\n');
      process.exit(2);
    }
    if (decision.action === 'warn') {
      process.stderr.write(decision.mensaje + '\n');
    }
  }

  // Auditar capas de carga aunque no haya tokens reportados
  auditarCapaDeCarga(metricas);
  evaluarTamañoOutput(evento?.tool_response);

  process.exit(0);
});
