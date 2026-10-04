#!/usr/bin/env node
/**
 * adr-parser.js — Batch scan de ADRs en codebase existente
 * Uso: node utils/adr-parser.js . "src/[**]/[*].ts" --update-ledger
 *      (sin los corchetes: aquí evitan cerrar este comentario)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { globARegex } from "../core/glob.js";

const IGNORADOS = new Set(["node_modules", ".git", "dist"]);

export { globARegex };

/** Lista los archivos bajo rootDir, en rutas relativas con "/". */
function listarArchivos(rootDir, rel = "") {
  const salida = [];
  let entradas = [];
  try {
    entradas = fs.readdirSync(path.join(rootDir, rel), { withFileTypes: true });
  } catch {
    return salida;
  }
  for (const e of entradas) {
    if (IGNORADOS.has(e.name)) continue;
    const hijo = rel ? rel + "/" + e.name : e.name;
    if (e.isDirectory()) salida.push(...listarArchivos(rootDir, hijo));
    else if (e.isFile()) salida.push(hijo);
  }
  return salida;
}

function globSync(patron, { cwd }) {
  const re = globARegex(patron);
  return listarArchivos(cwd).filter((f) => re.test(f));
}

const ARGS = process.argv.slice(2);
const POSICIONALES = ARGS.filter((a) => !a.startsWith("--"));
const ROOT_DIR = POSICIONALES[0] || ".";
const PATTERNS = POSICIONALES.slice(1);
const UPDATE_LEDGER = ARGS.includes("--update-ledger");

export function extraerADRsDelArchivo(contenido) {
  const regex = /(?:\/\/|\/\*|#|--|<!--|REM)\s*ADR:\s*({[^}]*})/g;
  const adrs = [];
  let match;
  while ((match = regex.exec(contenido)) !== null) {
    try {
      const json = JSON.parse(match[1]);
      if (json.decision && typeof json.decision === "string") {
        adrs.push(json);
      }
    } catch {
      // Ignorar JSON inválido
    }
  }
  return adrs;
}

export function scanCodigo(rootDir, patterns) {
  const archivos = [];

  if (patterns.length === 0) {
    // Por defecto: código fuente bajo src/
    patterns.push("src/**/*.{ts,js,py,go,java,rs,rb,php,cs}");
  }

  for (const pattern of patterns) {
    const matches = globSync(pattern, { cwd: rootDir });
    archivos.push(...matches);
  }

  const resultados = [];
  const adrsEncontrados = new Set();

  for (const archivo of archivos) {
    const ruta = path.join(rootDir, archivo);
    try {
      const contenido = fs.readFileSync(ruta, "utf8");
      const adrs = extraerADRsDelArchivo(contenido);

      for (const adr of adrs) {
        const id = JSON.stringify(adr); // Deduplicar por contenido
        if (!adrsEncontrados.has(id)) {
          adrsEncontrados.add(id);
          resultados.push({
            archivo: archivo,
            decision: adr.decision,
            context: adr.context || "",
            alternatives: adr.alternatives || [],
            status: adr.status || "accepted",
          });
        }
      }
    } catch {
      // Ignorar archivos que no se pueden leer
    }
  }

  return resultados;
}

function guardarEnLedger(rootDir, adrs) {
  const ledgerFile = path.join(rootDir, ".sdd", "arquitectura", "ADRs.jsonl");
  const ledgerDir = path.dirname(ledgerFile);

  if (!fs.existsSync(ledgerDir)) {
    fs.mkdirSync(ledgerDir, { recursive: true });
  }

  let guardadas = 0;
  for (const adr of adrs) {
    const linea = JSON.stringify({
      ts: new Date().toISOString(),
      decision: adr.decision,
      context: adr.context,
      alternatives: adr.alternatives,
      status: adr.status,
      archivo: adr.archivo,
      agente: "batch-scan",
    });
    fs.appendFileSync(ledgerFile, linea + "\n", "utf8");
    guardadas++;
  }

  return guardadas;
}

function main() {
  console.log(`🔍 Buscando ADRs en ${ROOT_DIR}...`);
  const adrs = scanCodigo(ROOT_DIR, PATTERNS);

  if (adrs.length === 0) {
    console.log("No se encontraron ADRs.");
    return;
  }

  console.log(`\n✅ Encontrados ${adrs.length} ADR(s):\n`);
  for (const adr of adrs) {
    console.log(`  📋 ${adr.decision}`);
    console.log(`     Archivo: ${adr.archivo}`);
    console.log(`     Status: ${adr.status}`);
    console.log();
  }

  if (UPDATE_LEDGER) {
    const guardadas = guardarEnLedger(ROOT_DIR, adrs);
    console.log(`\n💾 ${guardadas} ADR(s) guardado(s) en .sdd/arquitectura/ADRs.jsonl`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
