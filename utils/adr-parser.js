#!/usr/bin/env node
/**
 * adr-parser.js — Batch scan de ADRs en codebase existente
 * Uso: node utils/adr-parser.js . src/**/*.ts --update-ledger
 */

const fs = require("fs");
const path = require("path");
const { globSync } = require("glob");

const ROOT_DIR = process.argv[2] || ".";
const PATTERNS = process.argv.slice(3, -1);
const UPDATE_LEDGER = process.argv.includes("--update-ledger");

function extraerADRsDelArchivo(contenido) {
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

function scanCodigo(rootDir, patterns) {
  const archivos = [];

  if (patterns.length === 0) {
    // Por defecto: src/**/*.{ts,js,py,go,java,rs,rb,php,cs}
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

main();
