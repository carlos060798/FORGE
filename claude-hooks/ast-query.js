#!/usr/bin/env node
/**
 * ast-query.js — CLI de consulta del índice AST
 *
 * Uso:
 *   node claude-hooks/ast-query.js --archivo "src/auth.ts" --tipo exports
 *   node claude-hooks/ast-query.js --buscar "login"
 *   node claude-hooks/ast-query.js --archivo "src/auth.ts" --tipo imports
 *   node claude-hooks/ast-query.js --stats
 *
 * Permite a los agentes entender la estructura del proyecto sin leer
 * archivos completos — ~50 tokens por símbolo vs ~2000 tokens por archivo.
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
  const indiceFile = join(cwd, ".sdd", "arquitectura", "ast-index.jsonl");
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

function formatearSimbolo(s) {
  if (s.tipo === "import") {
    return `import { ${s.nombres?.join(", ") ?? "?"} } from "${s.de}"  [${s.archivo}:${s.linea}]`;
  }
  return `${s.tipo} ${s.firma ?? s.nombre}  [${s.archivo}:${s.linea}]`;
}

function main() {
  const args = parsearArgs(process.argv);
  const cwd = process.cwd();
  const indice = cargarIndice(cwd);

  if (indice.length === 0) {
    process.stderr.write(
      "ast-query: índice vacío o no encontrado. Ejecuta primero:\n" +
      "  node claude-hooks/ast-indexer.js\n"
    );
    process.exit(0);
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  if (args.stats) {
    const archivos = new Set(indice.map((s) => s.archivo)).size;
    const exports_ = indice.filter((s) => s.tipo === "export").length;
    const imports_ = indice.filter((s) => s.tipo === "import").length;
    const funciones = indice.filter((s) => s.tipo === "funcion").length;
    console.log(`Símbolos totales: ${indice.length}`);
    console.log(`Archivos indexados: ${archivos}`);
    console.log(`Exports: ${exports_} | Imports: ${imports_} | Funciones: ${funciones}`);
    process.exit(0);
  }

  let resultados = [...indice];

  // ── Filtro por archivo ────────────────────────────────────────────────────
  if (args.archivo) {
    resultados = resultados.filter((s) => s.archivo.includes(args.archivo));
    if (resultados.length === 0) {
      console.log(`(sin símbolos para "${args.archivo}" en el índice AST)`);
      process.exit(0);
    }
  }

  // ── Filtro por tipo ───────────────────────────────────────────────────────
  if (args.tipo) {
    const tipo = args.tipo.toLowerCase();
    if (tipo === "exports") {
      resultados = resultados.filter((s) => s.tipo === "export");
    } else if (tipo === "imports") {
      resultados = resultados.filter((s) => s.tipo === "import");
    } else if (tipo === "funciones") {
      resultados = resultados.filter((s) => s.tipo === "funcion" || s.tipo === "export");
    } else {
      resultados = resultados.filter((s) => s.tipo === tipo);
    }
  }

  // ── Búsqueda por término ──────────────────────────────────────────────────
  if (args.buscar) {
    const termino = args.buscar.toLowerCase();
    resultados = resultados.filter(
      (s) =>
        (s.nombre ?? "").toLowerCase().includes(termino) ||
        (s.firma ?? "").toLowerCase().includes(termino) ||
        (s.de ?? "").toLowerCase().includes(termino) ||
        s.archivo.toLowerCase().includes(termino)
    );
    if (resultados.length === 0) {
      console.log(`(sin resultados para "${args.buscar}" en el índice AST)`);
      process.exit(0);
    }
  }

  if (resultados.length === 0) {
    console.log("(sin resultados con los filtros aplicados)");
    process.exit(0);
  }

  // ── Salida ────────────────────────────────────────────────────────────────
  const limite = parseInt(args.limite ?? "50", 10);
  resultados.slice(0, limite).forEach((s) => console.log(formatearSimbolo(s)));

  if (resultados.length > limite) {
    console.log(`... y ${resultados.length - limite} símbolos más (usa --limite N para ver más)`);
  }

  process.exit(0);
}

main();
