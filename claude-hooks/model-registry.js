#!/usr/bin/env node
// @ts-check
/**
 * model-registry.js — Detección y resolución de providers LLM para FORGE.
 *
 * Detecta automáticamente qué providers están disponibles en el entorno
 * via variables de entorno. El usuario nunca configura esto manualmente.
 *
 * Uso interno (importado por agent-memory.js y forge doctor):
 *   import { resolveProvider, resolveModel, getAvailableProviders } from "./model-registry.js";
 *
 * Tiers de esfuerzo:
 *   high   → decisiones arquitectónicas, revisión, seguridad (Opus / GPT-4o / Gemini Ultra)
 *   medium → implementación, tests, docs (Sonnet / GPT-4o-mini / Gemini Pro)
 *   low    → verificaciones rápidas, formateo (Haiku / GPT-4o-mini / Gemini Flash)
 *
 * Principios:
 *   - Anthropic (Claude Code) es SIEMPRE el provider de fallback garantizado
 *   - Nunca se expone al usuario en la UI — solo en `forge doctor`
 *   - No se intenta llamar a providers que no estén en el entorno
 */

/** @typedef {"high" | "medium" | "low"} EffortTier */
/** @typedef {"anthropic" | "openai" | "google"} Provider */

// ─── Tabla de modelos por provider y tier ────────────────────────────────────

const MODEL_TABLE = {
  anthropic: {
    high:   "claude-opus-4-8",
    medium: "claude-sonnet-4-6",
    low:    "claude-haiku-4-5-20251001",
  },
  openai: {
    high:   "gpt-4o",
    medium: "gpt-4o-mini",
    low:    "gpt-4o-mini",
  },
  google: {
    high:   "gemini-2.0-flash",
    medium: "gemini-2.0-flash",
    low:    "gemini-2.0-flash-lite",
  },
};

// ─── Agentes de alta criticidad: siempre usan Anthropic ─────────────────────
// Decisiones de arquitectura, seguridad y revisión no se delegan a providers
// alternativos en v1 — el costo de un error aquí es demasiado alto.

const ANTHROPIC_ONLY_AGENTS = new Set([
  "arquitecto",
  "critico",
  "revisor",
  "seguridad",
  "asesor-datos",
  "product-designer",
]);

// ─── Detección de providers disponibles ──────────────────────────────────────

/**
 * Devuelve un mapa de providers disponibles según las variables de entorno.
 * @returns {{ anthropic: boolean, openai: boolean, google: boolean }}
 */
export function getAvailableProviders() {
  return {
    anthropic: true, // Claude Code siempre está disponible como host
    openai:    !!(process.env.OPENAI_API_KEY),
    google:    !!(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY),
  };
}

// ─── Resolución de provider para un agente y tier ────────────────────────────

/**
 * Determina qué provider usar para un agente dado su tier de esfuerzo.
 * Regla: agentes críticos → siempre anthropic. Los demás → primer provider
 * disponible para el tier (anthropic como fallback garantizado).
 *
 * @param {string | null | undefined} agente
 * @param {EffortTier} [tier]
 * @returns {Provider}
 */
export function resolveProvider(agente, tier = "medium") {
  // Agentes críticos: siempre Anthropic sin importar el entorno
  if (agente && ANTHROPIC_ONLY_AGENTS.has(agente)) return "anthropic";

  const available = getAvailableProviders();

  // Para tier "low", si hay OpenAI o Google disponibles, los usa
  // (reducción de costo en tareas simples)
  if (tier === "low") {
    if (available.openai)  return "openai";
    if (available.google)  return "google";
  }

  // Para tier "medium", OpenAI como alternativa si está disponible
  if (tier === "medium") {
    if (available.openai) return "openai";
  }

  // "high" siempre Anthropic — y fallback universal
  return "anthropic";
}

/**
 * Devuelve el ID de modelo concreto para un provider y tier.
 * @param {Provider} provider
 * @param {EffortTier} [tier]
 * @returns {string}
 */
export function resolveModel(provider, tier = "medium") {
  return MODEL_TABLE[provider]?.[tier] ?? MODEL_TABLE.anthropic[tier];
}

/**
 * Convierte el nombre de un agente al tier de esfuerzo correspondiente.
 * @param {string | null | undefined} agente
 * @returns {EffortTier}
 */
export function agentToTier(agente) {
  const HIGH = new Set(["arquitecto", "critico", "revisor", "seguridad", "asesor-datos", "product-designer"]);
  const LOW  = new Set(["documentador"]);
  if (!agente || agente === "main") return "medium";
  if (HIGH.has(agente)) return "high";
  if (LOW.has(agente))  return "low";
  return "medium";
}

/**
 * Resuelve provider + modelo para un agente en un solo paso.
 * @param {string | null | undefined} agente
 * @returns {{ provider: Provider, model: string, tier: EffortTier }}
 */
export function resolveForAgent(agente) {
  const tier     = agentToTier(agente);
  const provider = resolveProvider(agente, tier);
  const model    = resolveModel(provider, tier);
  return { provider, model, tier };
}
