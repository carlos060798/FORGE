#!/usr/bin/env node
// @ts-check
/**
 * FORGE UI — servidor local del dashboard (zero-deps, solo loopback).
 *
 * Endpoints:
 *   GET /estado       → .sdd/estado.json
 *   GET /tareas       → .sdd/estado-tareas.json (o vacío si no existe)
 *   GET /verificar    → .sdd/verificacion.json  (o vacío si no existe)
 *   GET /consumo      → últimas 50 líneas de .sdd/observabilidad/consumo.jsonl
 *   GET /eventlog     → últimas 50 entradas de .sdd/events.jsonl (EventLog del engine)
 *   GET /actividad    → últimas 50 entradas de consumo.jsonl en formato legible
 *   GET /agentes      → agentes activos en los últimos 60s (de consumo.jsonl)
 *   GET /agente/:n    → frontmatter + memoria + actividad reciente del agente n
 *   GET /             → sirve ui/index.html
 *   GET /assets/*     → sirve archivos estáticos de ui/assets/
 *
 * Seguridad:
 *   - Solo escucha en 127.0.0.1 (loopback)
 *   - Valida path traversal en rutas estáticas
 *   - Se cierra automáticamente tras 30 minutos sin peticiones
 */

import { createServer } from "node:http";
import { existsSync, readFileSync, watch } from "node:fs";
import { join, resolve, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const UI_DIR    = __dirname;           // directorio ui/
const SDD_DIR   = join(process.cwd(), ".sdd");

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutos
let   idleTimer;

// ─── SSE — clientes suscritos ─────────────────────────────────────────────────
const sseClients = new Set();

function sseEmit(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try { res.write(payload); } catch { sseClients.delete(res); }
  }
}

function iniciarWatchers() {
  const archivosVigilados = [
    join(SDD_DIR, "estado.json"),
    join(SDD_DIR, "observabilidad", "consumo.jsonl"),
  ];
  for (const ruta of archivosVigilados) {
    try {
      watch(ruta, { persistent: false }, (_evt) => {
        const tipo = ruta.endsWith("estado.json") ? "estado" : "consumo";
        const datos = tipo === "estado"
          ? (readJson(ruta) ?? {})
          : readLastJsonlLines(ruta, 1);
        sseEmit(tipo, datos);
      });
    } catch { /* archivo no existe aún — se ignora */ }
  }
}

function resetIdle(server) {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    process.stderr.write("[forge ui] Sin actividad por 30 min — cerrando servidor.\n");
    server.close(() => process.exit(0));
  }, IDLE_TIMEOUT_MS);
}

// ─── Validación de path traversal ────────────────────────────────────────────

function safeStaticPath(urlPath, baseDir) {
  const rel  = urlPath.replace(/^\//, "");
  const abs  = resolve(join(baseDir, rel));
  const base = resolve(baseDir);
  if (!abs.startsWith(base + "/") && abs !== base) return null;
  return abs;
}

// ─── Lectores de datos SDD ────────────────────────────────────────────────────

function readJson(filePath) {
  if (!existsSync(filePath)) return null;
  try { return JSON.parse(readFileSync(filePath, "utf8")); }
  catch { return null; }
}

function readLastJsonlLines(filePath, n = 50) {
  if (!existsSync(filePath)) return [];
  try {
    const lines = readFileSync(filePath, "utf8").trim().split("\n").filter(Boolean);
    return lines.slice(-n).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}

// ─── Respuestas HTTP ──────────────────────────────────────────────────────────

function json(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type":  "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(body);
}

function notFound(res, msg = "Not found") {
  json(res, { error: msg }, 404);
}

function staticFile(res, filePath) {
  if (!existsSync(filePath)) return false;
  const ext  = filePath.split(".").pop() ?? "";
  const mime = { html: "text/html", css: "text/css", js: "application/javascript", svg: "image/svg+xml" };
  const type = mime[ext] ?? "application/octet-stream";
  const body = readFileSync(filePath);
  res.writeHead(200, { "Content-Type": type + (type.startsWith("text") ? "; charset=utf-8" : "") });
  res.end(body);
  return true;
}

// ─── Router ───────────────────────────────────────────────────────────────────

function handleRequest(req, res) {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = url.pathname;

  if (req.method !== "GET") {
    json(res, { error: "Method not allowed" }, 405);
    return;
  }

  // API endpoints
  if (path === "/estado") {
    const estado = readJson(join(SDD_DIR, "estado.json"));
    json(res, estado ?? {});
    return;
  }
  if (path === "/tareas") {
    const tareas = readJson(join(SDD_DIR, "estado-tareas.json"));
    json(res, tareas ?? { tareas: [] });
    return;
  }
  if (path === "/verificar") {
    const verif = readJson(join(SDD_DIR, "verificacion.json"));
    json(res, verif ?? null);
    return;
  }
  if (path === "/consumo") {
    const lines = readLastJsonlLines(join(SDD_DIR, "observabilidad", "consumo.jsonl"));
    json(res, lines);
    return;
  }
  if (path === "/eventlog") {
    const lines = readLastJsonlLines(join(SDD_DIR, "events.jsonl"), 50);
    json(res, lines);
    return;
  }
  if (path === "/actividad") {
    const entries = readLastJsonlLines(join(SDD_DIR, "observabilidad", "consumo.jsonl"), 50);
    const actividad = entries.map(e => ({
      ts: e.ts,
      hora: e.ts ? new Date(e.ts).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "--:--:--",
      agente: e.agente || "main",
      tool: e.tool || "–",
      archivo: e.archivo ? e.archivo.split(/[\\/]/).pop() : "–",
      bytes: e.bytes || 0,
      provider: e.provider || "anthropic",
    }));
    json(res, actividad);
    return;
  }
  if (path === "/agentes") {
    const entries = readLastJsonlLines(join(SDD_DIR, "observabilidad", "consumo.jsonl"), 100);
    const now = Date.now();
    const recientes = entries.filter(e => e.ts && (now - new Date(e.ts).getTime()) < 60_000);
    const porAgente = {};
    recientes.forEach(e => {
      if (!e.agente) return;
      if (!porAgente[e.agente] || e.ts > porAgente[e.agente].ts) porAgente[e.agente] = e;
    });
    const resultado = Object.values(porAgente).map(e => ({
      nombre: e.agente,
      tool: e.tool || "–",
      archivo: e.archivo ? e.archivo.split(/[\\/]/).pop() : "–",
      bytes: e.bytes || 0,
      modelo: e.modelo || "–",
      ts: e.ts,
    }));
    json(res, resultado);
    return;
  }
  if (path.startsWith("/agente/")) {
    const nombre = decodeURIComponent(path.slice("/agente/".length));
    if (!nombre || nombre.includes("..") || nombre.includes("/")) {
      notFound(res);
      return;
    }
    // Buscar en .claude/agents/ (directorio global de Claude Code)
    const globalAgentPath = join(process.env.USERPROFILE ?? process.env.HOME ?? "", ".claude", "agents", nombre + ".md");
    const localAgentPath  = join(process.cwd(), "FORGE", "agents", nombre + ".md");
    const agentPath = existsSync(localAgentPath) ? localAgentPath : existsSync(globalAgentPath) ? globalAgentPath : null;
    let frontmatter = null;
    if (agentPath) {
      const md = readFileSync(agentPath, "utf8");
      const match = md.match(/^---\n([\s\S]*?)\n---/);
      if (match) {
        frontmatter = {};
        match[1].split("\n").forEach(line => {
          const [k, ...v] = line.split(":");
          if (k && v.length) frontmatter[k.trim()] = v.join(":").trim().replace(/^"|"$/g, "");
        });
      }
    }
    const memoriaPath = join(SDD_DIR, "memoria", `agente-${nombre}.md`);
    const memoria = existsSync(memoriaPath)
      ? readFileSync(memoriaPath, "utf8").split("\n").slice(0, 25).join("\n")
      : null;
    // Última actividad del agente
    const entries = readLastJsonlLines(join(SDD_DIR, "observabilidad", "consumo.jsonl"), 100);
    const ultimaActividad = entries.filter(e => e.agente === nombre).slice(-5);
    json(res, { nombre, frontmatter, memoria, ultimaActividad });
    return;
  }

  // SSE — stream de eventos en tiempo real
  if (path === "/events") {
    res.writeHead(200, {
      "Content-Type":  "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      "Connection":    "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    // Enviar estado inicial inmediatamente
    const estadoActual = readJson(join(SDD_DIR, "estado.json"));
    if (estadoActual) {
      res.write(`event: estado\ndata: ${JSON.stringify(estadoActual)}\n\n`);
    }
    res.write(`: conectado\n\n`); // comentario SSE para keep-alive inicial

    sseClients.add(res);

    // Limpiar cuando el cliente desconecta
    req.on("close", () => sseClients.delete(res));
    req.on("error", () => sseClients.delete(res));
    return; // no cerrar la respuesta — SSE es long-lived
  }

  // Archivos estáticos — solo desde ui/
  if (path === "/" || path === "/index.html") {
    staticFile(res, join(UI_DIR, "index.html"));
    return;
  }

  // Hoja de estilos compartida de docs-site (si existe)
  if (path === "/assets/styles.css") {
    const shared = join(UI_DIR, "..", "docs-site", "assets", "styles.css");
    const local  = join(UI_DIR, "assets", "styles.css");
    if (!staticFile(res, existsSync(shared) ? shared : local)) {
      notFound(res);
    }
    return;
  }

  if (path.startsWith("/assets/") || path.startsWith("/src/")) {
    const safe = safeStaticPath(path, UI_DIR);
    if (!safe || !staticFile(res, safe)) {
      notFound(res);
    }
    return;
  }

  notFound(res);
}

// ─── Arranque ─────────────────────────────────────────────────────────────────

export function startServer(port = 3001) {
  const server = createServer((req, res) => {
    resetIdle(server);
    handleRequest(req, res);
  });

  server.listen(port, "127.0.0.1", () => {
    const addr = server.address();
    const p = typeof addr === "object" ? addr?.port : port;
    process.stdout.write(`[forge ui] Dashboard en http://localhost:${p}\n`);
    process.stdout.write(`[forge ui] SSE activo en http://localhost:${p}/events\n`);
    resetIdle(server);
    iniciarWatchers(); // arrancar fs.watch una vez que el servidor está listo
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      process.stderr.write(`[forge ui] Puerto ${port} ocupado — prueba: forge ui --port ${port + 1}\n`);
    } else {
      process.stderr.write(`[forge ui] Error: ${err.message}\n`);
    }
    process.exit(1);
  });

  return server;
}

// ─── Arranque directo (node ui/server.js [port]) ─────────────────────────────

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const port = parseInt(process.env.FORGE_UI_PORT ?? process.argv[2] ?? "3001", 10);
  startServer(port);
}
