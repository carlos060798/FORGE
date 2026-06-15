#!/usr/bin/env node
/**
 * agent-memory.js — Hook PostToolUse para memoria persistente + ledger de consumo
 *
 * 1. Memoria por agente: cuando un agente del Grupo OPUS (arquitecto, asesor-datos,
 *    disenador-api, critico) escribe un archivo, registra la acción en
 *    .sdd/memoria/agente-{nombre}.md para continuidad entre sesiones.
 *
 * 2. Ledger de consumo: para TODOS los agentes, anexa una línea JSONL a
 *    .sdd/observabilidad/consumo.jsonl con ts, agente, tool, archivo y bytes.
 *    Permite detectar fan-out excesivo y picos de actividad sin coste de tokens.
 *
 * Protocolo de hooks de Claude Code:
 *   - Lee el evento JSON desde stdin
 *   - Exit 0 → continuar normalmente
 *   - Stderr → mensaje visible en el log de Claude Code
 */

import { createInterface } from "node:readline";
import { existsSync, mkdirSync, appendFileSync, statSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const MEMORIA_UMBRAL_BYTES = 50_000; // 50KB — alerta cuando se supera

const rl = createInterface({ input: process.stdin, terminal: false });
let raw = "";
rl.on("line", (l) => (raw += l + "\n"));
rl.on("close", () => main(raw.trim()));

// Agentes con memoria persistente activada
const AGENTES_CON_MEMORIA = new Set([
  "arquitecto",
  "asesor-datos",
  "disenador-api",
  "critico",
  "desarrollador-backend",
  "desarrollador-frontend",
  "tester",
  "documentador",
  "operaciones",
]);

function detectarAgente() {
  const agente = process.env.CLAUDE_AGENT_NAME ?? "";
  return agente.toLowerCase().trim();
}

function extraerResumen(contenido) {
  if (!contenido) return "(sin contenido)";
  const lineas = contenido.split("\n").filter((l) => l.trim().length > 10);
  const primera = lineas[0] ?? "";
  return primera.slice(0, 120).trim();
}

function extraerADRsDelContenido(contenido) {
  // Captura comentarios con patrón ADR: {...} en multilenguaje
  // Soporta: //, /*, #, --, <!-- REM
  const regex = /(?:\/\/|\/\*|#|--|<!--|REM)\s*ADR:\s*({[^}]*})/g;
  const adrs = [];
  let match;
  while ((match = regex.exec(contenido)) !== null) {
    try {
      const json = JSON.parse(match[1]);
      // Validar campos mínimos
      if (json.decision && typeof json.decision === "string") {
        adrs.push(json);
      }
    } catch {
      // Ignorar JSON inválido silenciosamente
    }
  }
  return adrs;
}

function registrarADRs(cwd, agente, archivo, adrs) {
  if (adrs.length === 0) return;
  const adrDir = join(cwd, ".sdd", "arquitectura");
  const ledgerFile = join(adrDir, "ADRs.jsonl");

  try {
    if (!existsSync(adrDir)) {
      mkdirSync(adrDir, { recursive: true });
    }

    for (const adr of adrs) {
      const linea = JSON.stringify({
        ts: new Date().toISOString(),
        decision: adr.decision,
        context: adr.context ?? "",
        alternatives: adr.alternatives ?? [],
        status: adr.status ?? "accepted",
        archivo: archivo,
        agente: agente || "main",
      });
      appendFileSync(ledgerFile, linea + "\n", "utf8");
    }

    if (adrs.length > 0) {
      process.stderr.write(
        `📋 [adr-indexer] ${agente}: ${adrs.length} ADR(s) capturado(s) en ${archivo}\n`
      );
    }
  } catch {
    // Silencioso — nunca interrumpir
  }
}

function triggerAutoCompresion(cwd, agente, memoriaFile) {
  // Extrae entradas duplicadas y deduplica por filepath
  try {
    const contenido = readFileSync(memoriaFile, "utf8");
    const lineas = contenido.split("\n");
    const header = lineas
      .slice(0, 6)
      .join("\n")
      .concat("\n\n");

    // Regex para extraer entradas: "## YYYY-MM-DD — filepath"
    const entradas = new Map(); // clave: filepath, valor: {fecha, resumen, linea}
    const regex = /^## (\d{4}-\d{2}-\d{2}) — (.+?)\n> (.+?)(?=\n##|\n$)/gms;
    let match;
    while ((match = regex.exec(contenido)) !== null) {
      const [, fecha, filepath, resumen] = match;
      // Guarda solo la entrada más reciente por filepath
      entradas.set(filepath, { fecha, resumen });
    }

    // Reconstruye archivo con deduplica
    let comprimido = header;
    for (const [filepath, { fecha, resumen }] of entradas) {
      comprimido += `## ${fecha} — ${filepath}\n> ${resumen}\n\n`;
    }

    // Backup antes de sobrescribir
    const backupFile = memoriaFile.replace(".md", ".original.md");
    writeFileSync(backupFile, contenido, "utf8");

    // Sobrescribe archivo deduplicado
    writeFileSync(memoriaFile, comprimido, "utf8");
    const tamanioOriginal = Buffer.byteLength(contenido, "utf8");
    const tamanioComprimido = Buffer.byteLength(comprimido, "utf8");
    const ratio = Math.round((tamanioComprimido / tamanioOriginal) * 100);
    process.stderr.write(
      `✨ [auto-compress] ${agente}: ${Math.round(tamanioOriginal / 1024)}KB → ${Math.round(tamanioComprimido / 1024)}KB (${ratio}%), backup en .original.md\n`
    );
  } catch {
    // Silencioso — no interrumpir
  }
}

function registrarLedger(cwd, agente, toolName, archivoModificado, contenido) {
  const obsDir = join(cwd, ".sdd", "observabilidad");
  const ledgerFile = join(obsDir, "consumo.jsonl");

  try {
    if (!existsSync(obsDir)) {
      mkdirSync(obsDir, { recursive: true });
    }
    const linea = JSON.stringify({
      ts: new Date().toISOString(),
      agente: agente || "main",
      tool: toolName,
      archivo: archivoModificado,
      bytes: Buffer.byteLength(contenido ?? "", "utf8"),
    });
    appendFileSync(ledgerFile, linea + "\n", "utf8");
  } catch {
    // Silencioso — nunca interrumpir el flujo
  }
}

function main(raw) {
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  const toolName = event?.tool_name ?? "";
  if (toolName !== "Write" && toolName !== "Edit" && toolName !== "MultiEdit") {
    process.exit(0);
  }

  const agente = detectarAgente();
  const cwd = process.cwd();
  const archivoModificado =
    event?.tool_input?.file_path ??
    event?.tool_input?.path ??
    "(desconocido)";
  const contenido =
    event?.tool_input?.content ??
    event?.tool_input?.new_string ??
    "";

  // ── Ledger JSONL (aplica a TODOS los agentes) ──────────────────────────────
  registrarLedger(cwd, agente, toolName, archivoModificado, contenido);

  // ── Indexar ADRs (aplica a TODOS los agentes) ──────────────────────────────
  const adrs = extraerADRsDelContenido(contenido);
  registrarADRs(cwd, agente, archivoModificado, adrs);

  // ── Registrar mutaciones (aplica a TODOS los agentes) ──────────────────────
  registrarMutacion(cwd, agente, archivoModificado, toolName);

  // ── Memoria persistente (solo agentes del grupo OPUS) ──────────────────────
  if (!agente || !AGENTES_CON_MEMORIA.has(agente)) {
    process.exit(0);
  }

  const memoriaDir = join(cwd, ".sdd", "memoria");
  const memoriaFile = join(memoriaDir, `agente-${agente}.md`);

  if (!existsSync(memoriaDir)) {
    try {
      mkdirSync(memoriaDir, { recursive: true });
    } catch {
      process.exit(0);
    }
  }

  const fecha = new Date().toISOString().slice(0, 10);
  const resumen = extraerResumen(contenido);

  if (!existsSync(memoriaFile)) {
    const header =
      `# Memoria del agente: ${agente}\n\n` +
      `Este archivo registra automáticamente las decisiones y cambios del agente.\n` +
      `Léelo al inicio de cada sesión para mantener continuidad entre conversaciones.\n\n` +
      `---\n\n`;
    try {
      appendFileSync(memoriaFile, header, "utf8");
    } catch {
      process.exit(0);
    }
  }

  const entrada = `## ${fecha} — ${archivoModificado}\n> ${resumen}\n\n`;

  try {
    appendFileSync(memoriaFile, entrada, "utf8");
    process.stderr.write(
      `🧠 [agent-memory] Registrado en memoria de ${agente}: ${archivoModificado}\n`
    );

    // Alerta de tamaño + trigger auto-compresión
    try {
      const { size } = statSync(memoriaFile);
      if (size > MEMORIA_UMBRAL_BYTES) {
        process.stderr.write(
          `⚠️  [agent-memory] Memoria de ${agente} supera ${Math.round(size / 1024)}KB\n`
        );
        // Trigger automático de compresión (silencioso, no bloquea)
        triggerAutoCompresion(cwd, agente, memoriaFile);
      }
    } catch {
      // Silencioso
    }
  } catch {
    // Silencioso
  }

  process.exit(0);
}

function registrarMutacion(cwd, agente, archivoModificado, toolName) {
  // Registra cada cambio (mutation) de archivo para tracking de calidad
  // Permite medir: "¿este archivo fue reescrito 5 veces? ¿problemas de estabilidad?"
  const mutDir = join(cwd, ".sdd", "observabilidad");
  const mutFile = join(mutDir, "mutaciones.jsonl");

  try {
    if (!existsSync(mutDir)) {
      mkdirSync(mutDir, { recursive: true });
    }

    const linea = JSON.stringify({
      ts: new Date().toISOString(),
      agente: agente || "main",
      archivo: archivoModificado,
      tool: toolName,
      tipo: toolName === "Edit" ? "partial" : "full",
    });
    appendFileSync(mutFile, linea + "\n", "utf8");
  } catch {
    // Silencioso
  }
}
