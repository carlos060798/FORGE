#!/usr/bin/env node
/**
 * ast-indexer.js — Genera índice AST de archivos JS/TS del proyecto
 *
 * Produce .sdd/arquitectura/ast-index.jsonl con entradas por símbolo:
 *   {"archivo":"src/auth.ts","tipo":"export","nombre":"login","linea":12,"firma":"async function login(email, password)"}
 *   {"archivo":"src/auth.ts","tipo":"import","de":"./db","nombres":["query"]}
 *   {"archivo":"src/db.ts","tipo":"funcion","nombre":"query","linea":5,"firma":"async function query(sql, params)"}
 *
 * Uso:
 *   node claude-hooks/ast-indexer.js                    # indexa todo el proyecto
 *   node claude-hooks/ast-indexer.js src/auth.ts        # indexa un archivo
 *   node claude-hooks/ast-indexer.js --dir src/         # indexa un directorio
 *
 * Los agentes consultan el índice con ast-query.js en lugar de Read completo.
 * Ahorro estimado: ~60% menos tokens en fase implementar para proyectos JS/TS.
 */

import { parse } from "acorn";
import {
  existsSync, mkdirSync, writeFileSync, readFileSync,
  readdirSync, statSync,
} from "node:fs";
import { join, extname, relative, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const EXTENSIONES_SOPORTADAS = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx"]);

const DIRECTORIOS_EXCLUIDOS = new Set([
  "node_modules", "dist", "build", ".next", ".nuxt",
  ".sdd", ".git", "coverage", "__pycache__",
]);

// ── Parser ───────────────────────────────────────────────────────────────────

function parsearArchivo(codigo, archivo) {
  // acorn no soporta TypeScript nativo — eliminamos anotaciones de tipo antes de parsear
  const codigoLimpio = limpiarTypeScript(codigo);
  try {
    return parse(codigoLimpio, {
      ecmaVersion: "latest",
      sourceType: "module",
      locations: true,
    });
  } catch {
    // Si falla el parse (TS avanzado, decoradores, etc.) devuelve null silenciosamente
    return null;
  }
}

export function limpiarTypeScript(codigo) {
  // Eliminación progresiva de sintaxis TS/JSX que acorn no entiende.
  // El objetivo es que acorn no crashee — no reproducir el compilador TS.
  // Orden importa: de lo más específico a lo más general.
  return codigo
    // 1. Eliminar bloques completos de interface y type alias (multilínea)
    .replace(/\binterface\s+\w+[\w\s,<>]*\s*\{[^}]*\}/gs, "/* interface */")
    .replace(/\btype\s+\w+[\w\s,<>]*\s*=\s*[\s\S]*?;/g, "/* type */")
    // 2. Eliminar decoradores de clase/método (@Component, @Injectable, etc.)
    .replace(/^\s*@\w+(?:\([^)]*\))?\s*$/gm, "")
    // 3. Eliminar modificadores de visibilidad en parámetros de constructor
    .replace(/\b(public|private|protected|readonly)\s+(\w)/g, "$2")
    // 4. Eliminar 'declare' statements
    .replace(/^\s*declare\s+.*$/gm, "")
    // 5. Eliminar anotaciones de tipo en parámetros: (x: string, y: number[])
    //    Cubre tipos primitivos, union, intersection, array, genéricos básicos
    .replace(/:\s*(?:readonly\s+)?[\w.]+(?:<[^>]*>)?(?:\[\])*(?:\s*[|&]\s*[\w.]+(?:<[^>]*>)?(?:\[\])*)*(?=\s*[,)=\n{])/g, "")
    // 6. Eliminar tipo de retorno de función: ): ReturnType {  →  ) {
    .replace(/\)\s*:\s*(?:readonly\s+)?[\w.]+(?:<[^>]*>)?(?:\[\])*(?:\s*[|&]\s*[\w.]+(?:<[^>]*>)?(?:\[\])*)*\s*(?=[{])/g, ") ")
    // 7. Eliminar 'as' type casts: value as string  →  value
    .replace(/\bas\s+[\w.]+(?:<[^>]*>)?(?:\[\])*/g, "")
    // 8. Eliminar genéricos simples en llamadas y declaraciones: Array<string> → Array
    //    Solo genéricos de una palabra para no romper comparadores < >
    .replace(/<\s*[\w.,\s|&?]+\s*>/g, "")
    // 9. Convertir JSX a comentarios (componentes JSX que acorn no puede parsear)
    //    Detecta líneas con <ComponentName o </ComponentName
    .replace(/<[A-Z]\w*(?:\s[^>]*)?\/?>/g, "null /* JSX */")
    .replace(/<\/[A-Z]\w*>/g, "")
    // 10. Eliminar satisfies operator: value satisfies Type
    .replace(/\bsatisfies\s+[\w.]+(?:<[^>]*>)?/g, "");
}

// ── Extractor de símbolos ─────────────────────────────────────────────────────

function extraerSimbolos(ast, archivo, cwd) {
  const simbolos = [];
  const rutaRelativa = relative(cwd, archivo);

  function visitar(nodo) {
    if (!nodo || typeof nodo !== "object") return;

    switch (nodo.type) {
      // import { a, b } from './mod'
      case "ImportDeclaration": {
        const nombres = nodo.specifiers.map((s) =>
          s.type === "ImportDefaultSpecifier" ? "default" : (s.imported?.name ?? s.local?.name ?? "?")
        );
        simbolos.push({
          archivo: rutaRelativa,
          tipo: "import",
          de: nodo.source?.value ?? "?",
          nombres,
          linea: nodo.loc?.start?.line ?? 0,
        });
        break;
      }

      // export function foo() {}
      // export const bar = ...
      // export default ...
      case "ExportNamedDeclaration": {
        if (nodo.declaration) {
          const decl = nodo.declaration;
          if (decl.type === "FunctionDeclaration" && decl.id) {
            simbolos.push({
              archivo: rutaRelativa,
              tipo: "export",
              nombre: decl.id.name,
              linea: decl.loc?.start?.line ?? 0,
              firma: construirFirma(decl),
            });
          } else if (decl.type === "VariableDeclaration") {
            for (const d of decl.declarations) {
              if (d.id?.name) {
                simbolos.push({
                  archivo: rutaRelativa,
                  tipo: "export",
                  nombre: d.id.name,
                  linea: d.loc?.start?.line ?? 0,
                  firma: `${decl.kind} ${d.id.name}`,
                });
              }
            }
          } else if (decl.type === "ClassDeclaration" && decl.id) {
            simbolos.push({
              archivo: rutaRelativa,
              tipo: "export",
              nombre: decl.id.name,
              linea: decl.loc?.start?.line ?? 0,
              firma: `class ${decl.id.name}`,
            });
          }
        }
        // export { a, b }
        for (const spec of nodo.specifiers ?? []) {
          if (spec.exported?.name) {
            simbolos.push({
              archivo: rutaRelativa,
              tipo: "export",
              nombre: spec.exported.name,
              linea: spec.loc?.start?.line ?? 0,
              firma: spec.local?.name !== spec.exported?.name
                ? `${spec.local?.name} as ${spec.exported?.name}`
                : spec.exported.name,
            });
          }
        }
        break;
      }

      case "ExportDefaultDeclaration": {
        const decl = nodo.declaration;
        const nombre = decl?.id?.name ?? decl?.name ?? "default";
        simbolos.push({
          archivo: rutaRelativa,
          tipo: "export",
          nombre: "default",
          linea: nodo.loc?.start?.line ?? 0,
          firma: decl?.type === "FunctionDeclaration"
            ? construirFirma(decl)
            : `export default ${nombre}`,
        });
        break;
      }

      // Funciones de nivel superior (no exportadas)
      case "FunctionDeclaration": {
        if (nodo.id) {
          simbolos.push({
            archivo: rutaRelativa,
            tipo: "funcion",
            nombre: nodo.id.name,
            linea: nodo.loc?.start?.line ?? 0,
            firma: construirFirma(nodo),
          });
        }
        break;
      }

      default:
        break;
    }

    // Recorrer hijos
    for (const key of Object.keys(nodo)) {
      if (key === "type" || key === "loc" || key === "start" || key === "end") continue;
      const hijo = nodo[key];
      if (Array.isArray(hijo)) {
        hijo.forEach(visitar);
      } else if (hijo && typeof hijo === "object" && hijo.type) {
        visitar(hijo);
      }
    }
  }

  visitar(ast.body ? { type: "Program", body: ast.body } : ast);
  return simbolos;
}

function construirFirma(nodo) {
  const async_ = nodo.async ? "async " : "";
  const nombre = nodo.id?.name ?? "anonymous";
  const params = (nodo.params ?? [])
    .map((p) => p.name ?? p.left?.name ?? "…")
    .join(", ");
  return `${async_}function ${nombre}(${params})`;
}

// ── Descubrimiento de archivos ────────────────────────────────────────────────

function descubrirArchivos(dir, cwd) {
  const archivos = [];
  function recorrer(ruta) {
    try {
      const stat = statSync(ruta);
      if (stat.isDirectory()) {
        const nombre = basename(ruta);
        if (DIRECTORIOS_EXCLUIDOS.has(nombre)) return;
        for (const hijo of readdirSync(ruta)) {
          recorrer(join(ruta, hijo));
        }
      } else if (EXTENSIONES_SOPORTADAS.has(extname(ruta))) {
        archivos.push(ruta);
      }
    } catch { /* Silencioso */ }
  }
  recorrer(dir);
  return archivos;
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const cwd = process.cwd();
  const args = process.argv.slice(2);

  let archivosAIndexar = [];

  if (args.length === 0) {
    // Sin args → indexar todo el proyecto
    archivosAIndexar = descubrirArchivos(cwd, cwd);
  } else if (args[0] === "--dir" && args[1]) {
    archivosAIndexar = descubrirArchivos(join(cwd, args[1]), cwd);
  } else {
    // Archivos específicos
    archivosAIndexar = args.map((a) => join(cwd, a)).filter((a) => existsSync(a));
  }

  if (archivosAIndexar.length === 0) {
    process.stderr.write("ast-indexer: no se encontraron archivos JS/TS para indexar\n");
    process.exit(0);
  }

  const adrDir = join(cwd, ".sdd", "arquitectura");
  if (!existsSync(adrDir)) mkdirSync(adrDir, { recursive: true });

  const indiceFile = join(adrDir, "ast-index.jsonl");
  const simbolosTotales = [];

  let indexados = 0;
  let omitidos = 0;

  for (const archivo of archivosAIndexar) {
    try {
      const codigo = readFileSync(archivo, "utf8");
      const ast = parsearArchivo(codigo, archivo);
      if (!ast) { omitidos++; continue; }
      const simbolos = extraerSimbolos(ast, archivo, cwd);
      simbolosTotales.push(...simbolos);
      indexados++;
    } catch {
      omitidos++;
    }
  }

  // TODO: integrar deltaEncode de core/ cuando el módulo exista
  // Si core/ast-delta.js (o similar) expone deltaEncode(oldIndex, newIndex), llamar:
  //   const oldIndex = existsSync(indiceFile) ? readFileSync(indiceFile, 'utf8') : '';
  //   const delta = deltaEncode(oldIndex, simbolosTotales);
  //   writeFileSync(indiceFile, delta, 'utf8');
  // Hasta entonces, se hace full-rebuild (comportamiento actual).

  // Escribir índice (sobrescribe — el índice es regenerable)
  const lineas = simbolosTotales.map((s) => JSON.stringify(s)).join("\n");
  writeFileSync(indiceFile, lineas + (lineas ? "\n" : ""), "utf8");

  process.stdout.write(
    `✅ ast-indexer: ${indexados} archivos indexados, ${simbolosTotales.length} símbolos → .sdd/arquitectura/ast-index.jsonl\n`
  );
  if (omitidos > 0) {
    process.stdout.write(`   ${omitidos} archivos omitidos (TS avanzado o parse error)\n`);
  }

  process.exit(0);
}

// Solo ejecutar como script directo, no cuando se importa como módulo
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
