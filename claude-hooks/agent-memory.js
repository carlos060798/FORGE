#!/usr/bin/env node
/**
 * agent-memory.js — Hook PostToolUse para memoria persistente + ledger de consumo
 *
 * 1. Memoria por agente — dos backends seleccionables en sdd.config.yaml:
 *    - "markdown" (default, Node >= 18): .sdd/memoria/agente-{nombre}.md
 *    - "sqlite"   (Node >= 22.5, nativo): .sdd/memoria/memoria.db
 *      Tabla: entradas(ts, agente, archivo, resumen, bytes)
 *      Ventaja: recuperación selectiva O(log n) sin leer archivos completos.
 *
 * 2. Índice invertido JSONL: .sdd/memoria/indice.jsonl — siempre activo,
 *    independientemente del backend. Habilita query-memory.js.
 *
 * 3. Ledger de consumo: .sdd/observabilidad/consumo.jsonl
 *
 * 4. Alerta MEMORY.md global: avisa al superar 150 líneas.
 *
 * Protocolo de hooks de Claude Code:
 *   - Lee el evento JSON desde stdin
 *   - Exit 0 → continuar normalmente
 *   - Stderr → mensaje visible en el log de Claude Code
 */

import { createInterface } from "node:readline";
import {
  existsSync, mkdirSync, appendFileSync, statSync,
  readFileSync, writeFileSync,
} from "node:fs";
import { join, basename } from "node:path";
import { homedir } from "node:os";

// ── Configuración ────────────────────────────────────────────────────────────

function leerConfig(cwd) {
  const configPath = join(cwd, ".sdd", "sdd.config.yaml");
  const defaults = { umbral_bytes: 50_000, backend: "markdown", recuperacion_por_defecto: 10 };
  if (!existsSync(configPath)) return defaults;
  try {
    const yaml = readFileSync(configPath, "utf8");
    const umbral = yaml.match(/^[ \t]+umbral_bytes:\s*(\d+)/m);
    const backend = yaml.match(/^[ \t]+backend:\s*"?(sqlite|markdown)"?/m);
    const recup = yaml.match(/^[ \t]+recuperacion_por_defecto:\s*(\d+)/m);
    return {
      umbral_bytes: umbral ? parseInt(umbral[1], 10) : defaults.umbral_bytes,
      // SQLite requiere Node >= 22.5 — fallback a markdown en Node < 22
      backend: backend ? backend[1] : defaults.backend,
      recuperacion_por_defecto: recup ? parseInt(recup[1], 10) : defaults.recuperacion_por_defecto,
    };
  } catch { return defaults; }
}

const CONFIG = leerConfig(process.cwd());

// ── Lectura de stdin ─────────────────────────────────────────────────────────

const rl = createInterface({ input: process.stdin, terminal: false });
let raw = "";
rl.on("line", (l) => (raw += l + "\n"));
rl.on("close", () => main(raw.trim()));

// ── Constantes ───────────────────────────────────────────────────────────────

const AGENTES_CON_MEMORIA = new Set([
  "arquitecto", "asesor-datos", "disenador-api", "critico",
  "desarrollador-backend", "desarrollador-frontend",
  "tester", "documentador", "operaciones",
]);

// ── Funciones auxiliares ─────────────────────────────────────────────────────

function detectarAgente() {
  return (process.env.CLAUDE_AGENT_NAME ?? "").toLowerCase().trim();
}

function extraerResumen(contenido) {
  if (!contenido) return "(sin contenido)";
  const lineas = contenido.split("\n").filter((l) => l.trim().length > 10);
  return (lineas[0] ?? "").slice(0, 120).trim();
}

function extraerADRsDelContenido(contenido) {
  const regex = /(?:\/\/|\/\*|#|--|<!--|REM)\s*ADR:\s*({[^}]*})/g;
  const adrs = [];
  let match;
  while ((match = regex.exec(contenido)) !== null) {
    try {
      const json = JSON.parse(match[1]);
      if (json.decision && typeof json.decision === "string") adrs.push(json);
    } catch { /* JSON inválido — ignorar */ }
  }
  return adrs;
}

// ── Funciones de escritura ───────────────────────────────────────────────────

function registrarADRs(cwd, agente, archivo, adrs) {
  if (adrs.length === 0) return;
  const adrDir = join(cwd, ".sdd", "arquitectura");
  const ledgerFile = join(adrDir, "ADRs.jsonl");
  try {
    if (!existsSync(adrDir)) mkdirSync(adrDir, { recursive: true });
    for (const adr of adrs) {
      const linea = JSON.stringify({
        ts: new Date().toISOString(),
        decision: adr.decision,
        context: adr.context ?? "",
        alternatives: adr.alternatives ?? [],
        status: adr.status ?? "accepted",
        archivo,
        agente: agente || "main",
      });
      appendFileSync(ledgerFile, linea + "\n", "utf8");
    }
    process.stderr.write(`📋 [adr-indexer] ${agente}: ${adrs.length} ADR(s) capturado(s) en ${archivo}\n`);
  } catch { /* Silencioso */ }
}

function registrarLedger(cwd, agente, toolName, archivoModificado, contenido) {
  const obsDir = join(cwd, ".sdd", "observabilidad");
  const ledgerFile = join(obsDir, "consumo.jsonl");
  try {
    if (!existsSync(obsDir)) mkdirSync(obsDir, { recursive: true });
    const linea = JSON.stringify({
      ts: new Date().toISOString(),
      agente: agente || "main",
      tool: toolName,
      archivo: archivoModificado,
      bytes: Buffer.byteLength(contenido ?? "", "utf8"),
    });
    appendFileSync(ledgerFile, linea + "\n", "utf8");
  } catch { /* Silencioso */ }
}

function registrarMutacion(cwd, agente, archivoModificado, toolName) {
  const mutDir = join(cwd, ".sdd", "observabilidad");
  const mutFile = join(mutDir, "mutaciones.jsonl");
  try {
    if (!existsSync(mutDir)) mkdirSync(mutDir, { recursive: true });
    const linea = JSON.stringify({
      ts: new Date().toISOString(),
      agente: agente || "main",
      archivo: archivoModificado,
      tool: toolName,
      tipo: toolName === "Edit" ? "partial" : "full",
    });
    appendFileSync(mutFile, linea + "\n", "utf8");
  } catch { /* Silencioso */ }
}

// ── Índice invertido JSONL ────────────────────────────────────────────────────

function actualizarIndice(cwd, agente, archivo, resumen, bytes) {
  // Índice ligero append-only para grep rápido: los agentes usan query-memory.js
  // en lugar de cat del archivo .md completo — ahorro ~90% de tokens en sesiones largas
  const memoriaDir = join(cwd, ".sdd", "memoria");
  const indiceFile = join(memoriaDir, "indice.jsonl");
  try {
    if (!existsSync(memoriaDir)) mkdirSync(memoriaDir, { recursive: true });
    const linea = JSON.stringify({
      ts: new Date().toISOString(),
      fecha: new Date().toISOString().slice(0, 10),
      agente,
      archivo,
      resumen,
      bytes,
    });
    appendFileSync(indiceFile, linea + "\n", "utf8");
  } catch { /* Silencioso */ }
}

// ── Backend SQLite ────────────────────────────────────────────────────────────

/**
 * Abre (o crea) la base de datos SQLite de memoria.
 * Requiere Node >= 22.5 con node:sqlite experimental.
 * @param {string} memoriaDir
 * @returns {import('node:sqlite').DatabaseSync|null}
 */
function abrirDB(memoriaDir) {
  try {
    const sqlite = cargarSQLite();
    if (!sqlite) return null;
    const { DatabaseSync } = sqlite;
    const dbPath = join(memoriaDir, "memoria.db");
    const db = new DatabaseSync(dbPath);
    db.exec(`
      CREATE TABLE IF NOT EXISTS entradas (
        id    INTEGER PRIMARY KEY AUTOINCREMENT,
        ts    TEXT NOT NULL,
        fecha TEXT NOT NULL,
        agente TEXT NOT NULL,
        archivo TEXT NOT NULL,
        resumen TEXT NOT NULL,
        bytes INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_agente ON entradas(agente);
      CREATE INDEX IF NOT EXISTS idx_fecha  ON entradas(fecha);
      CREATE INDEX IF NOT EXISTS idx_archivo ON entradas(archivo);
    `);
    return db;
  } catch {
    return null;
  }
}

// node:sqlite es experimental y solo disponible en Node >= 22.5.
// Se carga síncronamente via createRequire (ESM → CJS bridge).
// Resultado cacheado para no repetir la detección en cada llamada.
import { createRequire } from "node:module";
const _require = createRequire(import.meta.url);

let _sqliteModule = undefined;
function cargarSQLite() {
  if (_sqliteModule !== undefined) return _sqliteModule;
  try {
    const [major, minor] = process.versions.node.split(".").map(Number);
    if (major < 22 || (major === 22 && minor < 5)) { _sqliteModule = null; return null; }
    _sqliteModule = _require("node:sqlite");
    return _sqliteModule;
  } catch {
    _sqliteModule = null;
    return null;
  }
}

function escribirMemoriaSQLite(memoriaDir, agente, archivo, resumen, bytes) {
  try {
    const db = abrirDB(memoriaDir);
    if (!db) return false;

    const ts = new Date().toISOString();
    const fecha = ts.slice(0, 10);

    // Deduplicación: actualiza resumen si el mismo (agente, archivo) ya existe hoy
    const existing = db.prepare(
      "SELECT id FROM entradas WHERE agente = ? AND archivo = ? AND fecha = ?"
    ).get(agente, archivo, fecha);

    if (existing) {
      db.prepare(
        "UPDATE entradas SET ts = ?, resumen = ?, bytes = ? WHERE id = ?"
      ).run(ts, resumen, bytes, existing.id);
    } else {
      db.prepare(
        "INSERT INTO entradas (ts, fecha, agente, archivo, resumen, bytes) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(ts, fecha, agente, archivo, resumen, bytes);
    }

    // Auto-compresión: elimina entradas antiguas del mismo archivo si hay > N duplicados
    const count = db.prepare(
      "SELECT COUNT(*) as n FROM entradas WHERE agente = ? AND archivo = ?"
    ).get(agente, archivo);
    if (count.n > 10) {
      // Conserva solo las 5 más recientes por archivo+agente
      db.exec(`
        DELETE FROM entradas
        WHERE agente = '${agente.replace(/'/g, "''")}' AND archivo = '${archivo.replace(/'/g, "''")}'
        AND id NOT IN (
          SELECT id FROM entradas
          WHERE agente = '${agente.replace(/'/g, "''")}' AND archivo = '${archivo.replace(/'/g, "''")}'
          ORDER BY ts DESC LIMIT 5
        )
      `);
    }

    db.close();
    return true;
  } catch {
    return false;
  }
}

// ── Backend markdown ──────────────────────────────────────────────────────────

function escribirMemoriaMarkdown(cwd, agente, archivo, resumen) {
  const memoriaDir = join(cwd, ".sdd", "memoria");
  const memoriaFile = join(memoriaDir, `agente-${agente}.md`);
  try {
    if (!existsSync(memoriaDir)) mkdirSync(memoriaDir, { recursive: true });
    if (!existsSync(memoriaFile)) {
      const header =
        `# Memoria del agente: ${agente}\n\n` +
        `Este archivo registra automáticamente las decisiones y cambios del agente.\n` +
        `Léelo al inicio de cada sesión para mantener continuidad entre conversaciones.\n\n` +
        `---\n\n`;
      appendFileSync(memoriaFile, header, "utf8");
    }
    const fecha = new Date().toISOString().slice(0, 10);
    appendFileSync(memoriaFile, `## ${fecha} — ${archivo}\n> ${resumen}\n\n`, "utf8");

    // Auto-compresión si supera umbral
    try {
      const { size } = statSync(memoriaFile);
      if (size > CONFIG.umbral_bytes) {
        process.stderr.write(`⚠️  [agent-memory] Memoria de ${agente} supera ${Math.round(size / 1024)}KB\n`);
        triggerAutoCompresion(cwd, agente, memoriaFile);
      }
    } catch { /* Silencioso */ }
    return true;
  } catch {
    return false;
  }
}

function triggerAutoCompresion(cwd, agente, memoriaFile) {
  try {
    const contenido = readFileSync(memoriaFile, "utf8");
    const lineas = contenido.split("\n");
    const header = lineas.slice(0, 6).join("\n").concat("\n\n");

    const entradas = new Map();
    const regex = /^## (\d{4}-\d{2}-\d{2}) — (.+?)\n> (.+?)(?=\n##|\n$)/gms;
    let match;
    while ((match = regex.exec(contenido)) !== null) {
      const [, fecha, filepath, resumen] = match;
      entradas.set(filepath, { fecha, resumen });
    }

    let comprimido = header;
    for (const [filepath, { fecha, resumen }] of entradas) {
      comprimido += `## ${fecha} — ${filepath}\n> ${resumen}\n\n`;
    }

    writeFileSync(memoriaFile.replace(".md", ".original.md"), contenido, "utf8");
    writeFileSync(memoriaFile, comprimido, "utf8");

    const orig = Buffer.byteLength(contenido, "utf8");
    const comp = Buffer.byteLength(comprimido, "utf8");
    process.stderr.write(
      `✨ [auto-compress] ${agente}: ${Math.round(orig / 1024)}KB → ${Math.round(comp / 1024)}KB (${Math.round(comp / orig * 100)}%), backup en .original.md\n`
    );
  } catch { /* Silencioso */ }
}

// ── Alerta MEMORY.md global ──────────────────────────────────────────────────

function alertarMemoryMdGlobal(cwd) {
  // Límite oficial Claude Code: 200 líneas / 25KB — truncación silenciosa sin aviso
  try {
    const proyectoNombre = basename(cwd);
    const memoryIdx = join(homedir(), ".claude", "projects", proyectoNombre, "memory", "MEMORY.md");
    if (!existsSync(memoryIdx)) return;
    const lineas = readFileSync(memoryIdx, "utf8").split("\n").length;
    if (lineas > 150) {
      process.stderr.write(
        `⚠️  [agent-memory] MEMORY.md tiene ${lineas}/200 líneas — Claude Code truncará al llegar a 200. Reorganiza en archivos temáticos.\n`
      );
    }
  } catch { /* Silencioso */ }
}

// ── Main ─────────────────────────────────────────────────────────────────────

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
  const bytes = Buffer.byteLength(contenido ?? "", "utf8");

  // ── Ledger JSONL (todos los agentes) ───────────────────────────────────────
  registrarLedger(cwd, agente, toolName, archivoModificado, contenido);

  // ── Indexar ADRs (todos los agentes) ───────────────────────────────────────
  registrarADRs(cwd, agente, archivoModificado, extraerADRsDelContenido(contenido));

  // ── Registrar mutaciones (todos los agentes) ────────────────────────────────
  registrarMutacion(cwd, agente, archivoModificado, toolName);

  // ── Alerta MEMORY.md global (todos los agentes) ─────────────────────────────
  alertarMemoryMdGlobal(cwd);

  // ── Memoria persistente (solo agentes del grupo) ───────────────────────────
  if (!agente || !AGENTES_CON_MEMORIA.has(agente)) {
    process.exit(0);
  }

  const resumen = extraerResumen(contenido);

  // Índice invertido JSONL (siempre — habilita query-memory.js independientemente del backend)
  actualizarIndice(cwd, agente, archivoModificado, resumen, bytes);

  // Escritura de memoria según backend configurado
  const memoriaDir = join(cwd, ".sdd", "memoria");
  if (CONFIG.backend === "sqlite") {
    const ok = escribirMemoriaSQLite(memoriaDir, agente, archivoModificado, resumen, bytes);
    if (!ok) {
      // Fallback a markdown si SQLite falla (Node < 22.5 o error de runtime)
      process.stderr.write(`⚠️  [agent-memory] SQLite no disponible, usando markdown como fallback\n`);
      escribirMemoriaMarkdown(cwd, agente, archivoModificado, resumen);
    }
  } else {
    escribirMemoriaMarkdown(cwd, agente, archivoModificado, resumen);
  }

  process.stderr.write(`🧠 [agent-memory] ${agente} → ${archivoModificado}\n`);

  process.exit(0);
}
