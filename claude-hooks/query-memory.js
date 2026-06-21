#!/usr/bin/env node
/**
 * query-memory.js — CLI de consulta selectiva de memoria de agentes
 *
 * Uso:
 *   node claude-hooks/query-memory.js --agente arquitecto --ultimas 10
 *   node claude-hooks/query-memory.js --agente arquitecto --buscar "auth"
 *   node claude-hooks/query-memory.js --agente arquitecto --archivo "src/auth.ts"
 *   node claude-hooks/query-memory.js --agente arquitecto --stats
 *
 * Implementa el workflow de 3 capas inspirado en claude-mem:
 *   1. Índice JSONL (rápido, grep-friendly, ~50-100 tokens por resultado)
 *   2. Filtrado por agente/término/archivo
 *   3. Salida formateada lista para el contexto del agente
 *
 * Funciona con el backend markdown (indice.jsonl) — no requiere SQLite.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function parsearArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      args[key] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
    }
  }
  return args;
}

function cargarIndice(cwd) {
  const indiceFile = join(cwd, ".sdd", "memoria", "indice.jsonl");
  if (!existsSync(indiceFile)) return [];
  try {
    return readFileSync(indiceFile, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

function formatearEntrada(e) {
  return `## ${e.fecha} — ${e.archivo}\n> ${e.resumen}`;
}

function main() {
  const args = parsearArgs(process.argv);
  const cwd = process.cwd();

  if (!args.agente) {
    process.stderr.write("Error: se requiere --agente <nombre>\n");
    process.stderr.write("Uso: node query-memory.js --agente arquitecto --ultimas 10\n");
    process.exit(1);
  }

  const entradas = cargarIndice(cwd).filter((e) => e.agente === args.agente);

  if (entradas.length === 0) {
    console.log(`(sin memoria previa para el agente "${args.agente}")`);
    process.exit(0);
  }

  // ── Modo stats ────────────────────────────────────────────────────────────
  if (args.stats) {
    const archivosUnicos = new Set(entradas.map((e) => e.archivo)).size;
    const totalBytes = entradas.reduce((s, e) => s + (e.bytes ?? 0), 0);
    console.log(`Agente: ${args.agente}`);
    console.log(`Entradas totales: ${entradas.length}`);
    console.log(`Archivos únicos: ${archivosUnicos}`);
    console.log(`Bytes registrados: ${Math.round(totalBytes / 1024)}KB`);
    console.log(`Primera entrada: ${entradas[0]?.fecha ?? "—"}`);
    console.log(`Última entrada:  ${entradas[entradas.length - 1]?.fecha ?? "—"}`);
    process.exit(0);
  }

  // ── Modo búsqueda por término ─────────────────────────────────────────────
  if (args.buscar) {
    const termino = args.buscar.toLowerCase();
    const resultados = entradas.filter(
      (e) =>
        e.resumen.toLowerCase().includes(termino) ||
        e.archivo.toLowerCase().includes(termino)
    );
    if (resultados.length === 0) {
      console.log(`(sin resultados para "${args.buscar}" en memoria de ${args.agente})`);
    } else {
      const limite = parseInt(args.limite ?? "10", 10);
      resultados.slice(-limite).forEach((e) => console.log(formatearEntrada(e)));
    }
    process.exit(0);
  }

  // ── Modo filtro por archivo ───────────────────────────────────────────────
  if (args.archivo) {
    const resultados = entradas.filter((e) => e.archivo.includes(args.archivo));
    if (resultados.length === 0) {
      console.log(`(sin entradas para "${args.archivo}" en memoria de ${args.agente})`);
    } else {
      resultados.forEach((e) => console.log(formatearEntrada(e)));
    }
    process.exit(0);
  }

  // ── Modo predeterminado: últimas N entradas ───────────────────────────────
  const n = parseInt(args.ultimas ?? "10", 10);
  const ultimas = entradas.slice(-n);
  console.log(`# Memoria reciente: ${args.agente} (últimas ${ultimas.length} entradas)\n`);
  ultimas.forEach((e) => console.log(formatearEntrada(e)));
  process.exit(0);
}

main();
