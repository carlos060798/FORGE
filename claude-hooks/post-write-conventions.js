#!/usr/bin/env node
/**
 * post-write-conventions.js — Hook PostToolUse global de Claude Code
 *
 * Se activa después de Write, Edit, o MultiEdit sobre cualquier archivo.
 * Detecta las convenciones del proyecto (dinámicamente + desde la constitución
 * SDD-ES si existe) y valida el archivo recién modificado contra ellas.
 *
 * Resultado:
 *   - Violación bloqueante  → exit 2 + mensaje claro
 *   - Sugerencia            → exit 0 + mensaje a stderr (Claude lo ve y puede corregir)
 *   - OK                    → exit 0 silencioso
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { extname, basename, dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";

// ── Leer evento desde stdin ────────────────────────────────────────────────
const rl = createInterface({ input: process.stdin, terminal: false });
let raw = "";
rl.on("line", (l) => (raw += l + "\n"));
rl.on("close", () => main(raw.trim()));

// ── Helpers ────────────────────────────────────────────────────────────────

function tryRead(path) {
  try { return readFileSync(path, "utf8"); } catch { return ""; }
}

function tryJSON(path) {
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return null; }
}

function findUp(filename, from) {
  let dir = resolve(from);
  for (let i = 0; i < 8; i++) {
    const candidate = join(dir, filename);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function findWorkspaceRoot(startFile) {
  const dir = dirname(resolve(startFile));
  const markers = ["package.json","pyproject.toml","Cargo.toml","go.mod","pom.xml",".git",".sdd"];
  for (const m of markers) {
    const p = findUp(m, dir);
    if (p) return dirname(p);
  }
  return dir;
}

// ── Detección dinámica de convenciones ─────────────────────────────────────

function detectConventions(root, ext) {
  const conv = {
    // Naming
    namingStyle: null,        // "camelCase" | "snake_case" | "PascalCase" | "kebab-case"
    // Indentación
    indentChar: null,         // "space" | "tab"
    indentSize: null,         // 2 | 4
    // Comillas
    quoteStyle: null,         // "single" | "double"
    // Punto y coma
    semicolons: null,         // true | false
    // Longitud máxima de función (desde constitución)
    maxFunctionLines: null,
    // Cobertura mínima (desde constitución)
    minCoverage: null,
    // Prohibidos (desde constitución)
    prohibitedPatterns: [],
    // Fuente de detección
    sources: [],
  };

  // ── 1. Desde constitución SDD-ES ────────────────────────────────────────
  const constitucionPath = join(root, ".sdd", "memoria", "constitucion.md");
  const constitucion = tryRead(constitucionPath);
  if (constitucion) {
    conv.sources.push("constitucion.md");

    const maxFn = constitucion.match(/longitud[_\s-]*función[_\s-]*máxima[:\s]+(\d+)/i)
      || constitucion.match(/max[_\s-]*function[_\s-]*lines?[:\s]+(\d+)/i)
      || constitucion.match(/funciones?\s*[≤<=]\s*(\d+)\s*líneas/i);
    if (maxFn) conv.maxFunctionLines = parseInt(maxFn[1]);

    const cov = constitucion.match(/cobertura[_\s-]*(?:mínima|tests?)[:\s]+(\d+)/i);
    if (cov) conv.minCoverage = parseInt(cov[1]);

    // Patrones prohibidos declarados en constitución
    const prohibited = [...constitucion.matchAll(/(?:NUNCA|PROHIBIDO|NO\s+USAR)[:\s]+`([^`]+)`/gi)];
    conv.prohibitedPatterns = prohibited.map(m => m[1].trim());
  }

  // ── 2. Desde sdd.config.yaml ────────────────────────────────────────────
  const configPath = join(root, ".sdd", "sdd.config.yaml");
  const config = tryRead(configPath);
  if (config) {
    conv.sources.push("sdd.config.yaml");
    const maxFn = config.match(/longitud_funcion_maxima:\s*(\d+)/);
    if (maxFn && !conv.maxFunctionLines) conv.maxFunctionLines = parseInt(maxFn[1]);
    const cov = config.match(/cobertura_tests_minima:\s*(\d+)/);
    if (cov && !conv.minCoverage) conv.minCoverage = parseInt(cov[1]);
  }

  // ── 3. Desde ESLint ─────────────────────────────────────────────────────
  const eslintFiles = [".eslintrc.json",".eslintrc.js",".eslintrc.yml",".eslintrc",
                       "eslint.config.js","eslint.config.mjs"];
  for (const f of eslintFiles) {
    const p = join(root, f);
    if (!existsSync(p)) continue;
    const content = tryRead(p);
    conv.sources.push(f);
    if (content.includes('"quotes"') || content.includes("'quotes'")) {
      conv.quoteStyle = content.includes('"single"') || content.includes("'single'")
        ? "single" : "double";
    }
    if (content.includes('"semi"') || content.includes("'semi'")) {
      conv.semicolons = !content.includes('"never"') && !content.includes("'never'");
    }
    break;
  }

  // ── 4. Desde Prettier ───────────────────────────────────────────────────
  const prettierFiles = [".prettierrc",".prettierrc.json",".prettierrc.js",
                         ".prettierrc.yml","prettier.config.js","prettier.config.mjs"];
  for (const f of prettierFiles) {
    const p = join(root, f);
    if (!existsSync(p)) continue;
    const content = tryRead(p);
    conv.sources.push(f);
    if (content.includes("singleQuote")) {
      conv.quoteStyle = content.includes("true") ? "single" : "double";
    }
    if (content.includes("semi")) {
      conv.semicolons = !content.includes('"semi": false') && !content.includes("semi: false");
    }
    if (content.includes("tabWidth")) {
      const m = content.match(/tabWidth["\s:]+(\d)/);
      if (m) conv.indentSize = parseInt(m[1]);
    }
    if (content.includes("useTabs")) {
      conv.indentChar = content.includes("true") ? "tab" : "space";
    }
    break;
  }

  // ── 5. Desde .editorconfig ──────────────────────────────────────────────
  const editorconfig = tryRead(join(root, ".editorconfig"));
  if (editorconfig) {
    conv.sources.push(".editorconfig");
    if (!conv.indentChar) {
      if (editorconfig.includes("indent_style = tab")) conv.indentChar = "tab";
      if (editorconfig.includes("indent_style = space")) conv.indentChar = "space";
    }
    if (!conv.indentSize) {
      const m = editorconfig.match(/indent_size\s*=\s*(\d)/);
      if (m) conv.indentSize = parseInt(m[1]);
    }
  }

  // ── 6. Desde tsconfig.json ──────────────────────────────────────────────
  if ([".ts",".tsx"].includes(ext)) {
    const tsconfig = tryJSON(join(root, "tsconfig.json"));
    if (tsconfig) {
      conv.sources.push("tsconfig.json");
      // strict mode implica tipos estrictos obligatorios
      if (tsconfig.compilerOptions?.strict) conv.strictTypes = true;
      if (tsconfig.compilerOptions?.noImplicitAny) conv.noImplicitAny = true;
    }
  }

  // ── 7. Desde ruff.toml (Python) ─────────────────────────────────────────
  if (ext === ".py") {
    const ruff = tryRead(join(root, "ruff.toml")) || tryRead(join(root, ".ruff.toml"));
    if (ruff) {
      conv.sources.push("ruff.toml");
      const lineLen = ruff.match(/line-length\s*=\s*(\d+)/);
      if (lineLen) conv.maxLineLength = parseInt(lineLen[1]);
    }
  }

  // ── 8. Inferir desde código existente (si nada detectado aún) ───────────
  if (!conv.namingStyle || !conv.indentChar) {
    inferFromExistingCode(root, ext, conv);
  }

  return conv;
}

function inferFromExistingCode(root, ext, conv) {
  // Busca hasta 3 archivos del mismo tipo para inferir patrones
  const candidates = [];
  try {
    const dirs = ["src","lib","app","pkg","internal"];
    for (const d of dirs) {
      const dp = join(root, d);
      if (!existsSync(dp)) continue;
      const files = readdirSync(dp).filter(f => f.endsWith(ext)).slice(0, 2);
      candidates.push(...files.map(f => join(dp, f)));
      if (candidates.length >= 3) break;
    }
  } catch { /* sin acceso */ }

  for (const f of candidates.slice(0, 3)) {
    const content = tryRead(f);
    if (!content) continue;

    // Indentación: mirar primeras líneas indentadas
    if (!conv.indentChar) {
      const lines = content.split("\n").slice(0, 30);
      const tabLine = lines.find(l => l.startsWith("\t"));
      const spaceLine = lines.find(l => l.match(/^ {2,}/));
      if (tabLine && !spaceLine) conv.indentChar = "tab";
      else if (spaceLine && !tabLine) {
        conv.indentChar = "space";
        const m = spaceLine.match(/^( +)/);
        if (m) conv.indentSize = m[1].length === 2 ? 2 : 4;
      }
    }

    // Comillas JS/TS
    if (!conv.quoteStyle && [".js",".ts",".jsx",".tsx"].includes(ext)) {
      const singleCount = (content.match(/'/g) || []).length;
      const doubleCount = (content.match(/"/g) || []).length;
      if (singleCount > doubleCount * 1.5) conv.quoteStyle = "single";
      else if (doubleCount > singleCount * 1.5) conv.quoteStyle = "double";
    }

    conv.sources.push(`inferido de ${basename(f)}`);
    break;
  }
}

// ── Validación del archivo ─────────────────────────────────────────────────

function validate(filePath, content, conv, ext) {
  const errors   = [];  // bloqueantes
  const warnings = [];  // sugerencias

  const lines = content.split("\n");
  const name  = basename(filePath);

  // ── Indentación ─────────────────────────────────────────────────────────
  if (conv.indentChar === "tab") {
    const spacedLines = lines.filter((l, i) => i < 100 && /^ {2,}/.test(l) && !/^\s*\*/.test(l));
    if (spacedLines.length > 3) {
      errors.push(`indentación: el proyecto usa TABS pero se encontraron ${spacedLines.length} líneas con espacios`);
    }
  } else if (conv.indentChar === "space") {
    const tabbedLines = lines.filter((l, i) => i < 100 && l.startsWith("\t"));
    if (tabbedLines.length > 3) {
      errors.push(`indentación: el proyecto usa ESPACIOS pero se encontraron ${tabbedLines.length} líneas con tabs`);
    }
  }

  // ── Comillas JS/TS ──────────────────────────────────────────────────────
  if (conv.quoteStyle && [".js",".ts",".jsx",".tsx",".mjs",".cjs"].includes(ext)) {
    const wrong = conv.quoteStyle === "single"
      ? lines.filter((l,i) => i < 200 && /"[^"]*"/.test(l) && !l.includes("//") && !l.trim().startsWith("*")).length
      : lines.filter((l,i) => i < 200 && /'[^']*'/.test(l) && !l.includes("//") && !l.trim().startsWith("*")).length;
    if (wrong > 5) {
      const expected = conv.quoteStyle === "single" ? "comillas simples" : "comillas dobles";
      warnings.push(`comillas: el proyecto usa ${expected} pero se encontraron ${wrong} líneas con el estilo opuesto`);
    }
  }

  // ── Longitud de funciones ───────────────────────────────────────────────
  if (conv.maxFunctionLines) {
    const fnStarts = [];
    lines.forEach((l, i) => {
      if (/^\s*(export\s+)?(async\s+)?function\s+\w|=>\s*\{|^\s*(public|private|protected|async)\s+\w+\s*\(/.test(l)) {
        fnStarts.push(i);
      }
    });

    for (const start of fnStarts.slice(0, 20)) {
      let depth = 0, end = start;
      for (let i = start; i < Math.min(start + conv.maxFunctionLines * 2, lines.length); i++) {
        depth += (lines[i].match(/\{/g) || []).length;
        depth -= (lines[i].match(/\}/g) || []).length;
        if (depth <= 0 && i > start) { end = i; break; }
      }
      const len = end - start;
      if (len > conv.maxFunctionLines) {
        warnings.push(`función en línea ${start + 1}: ${len} líneas > límite de ${conv.maxFunctionLines} (constitución)`);
      }
    }
  }

  // ── Patrones prohibidos (desde constitución) ────────────────────────────
  for (const pattern of conv.prohibitedPatterns) {
    if (content.includes(pattern)) {
      errors.push(`patrón prohibido en constitución: \`${pattern}\` encontrado en el archivo`);
    }
  }

  // ── console.log / print de debug en archivos no-test ───────────────────
  const isTest = /\.(test|spec)\.|__tests__|test_/.test(filePath);
  if (!isTest) {
    if ([".ts",".js",".tsx",".jsx"].includes(ext)) {
      const debugLines = lines.filter((l,i) => /console\.(log|warn|error|debug|info)\(/.test(l) && !l.trim().startsWith("//")).length;
      if (debugLines > 2) {
        warnings.push(`${debugLines} llamadas a console.log/warn/error en archivo no-test — ¿son logs de producción o debug olvidado?`);
      }
    }
    if (ext === ".py") {
      const printLines = lines.filter(l => /^\s*print\s*\(/.test(l) && !l.trim().startsWith("#")).length;
      if (printLines > 2) {
        warnings.push(`${printLines} llamadas a print() en archivo no-test — usa logging en lugar de print en producción`);
      }
    }
  }

  // ── TypeScript: any implícito ───────────────────────────────────────────
  if (conv.noImplicitAny || conv.strictTypes) {
    if ([".ts",".tsx"].includes(ext)) {
      const anyCount = lines.filter(l => /:\s*any\b/.test(l) && !l.trim().startsWith("//")).length;
      if (anyCount > 0) {
        warnings.push(`${anyCount} usos de \`any\` en TypeScript estricto — reemplaza con tipos concretos`);
      }
    }
  }

  // ── Secretos hardcodeados ───────────────────────────────────────────────
  const secretPatterns = [
    { re: /password\s*=\s*['"][^'"]{4,}/i,    label: "password hardcodeado" },
    { re: /secret\s*=\s*['"][^'"]{8,}/i,      label: "secret hardcodeado" },
    { re: /api[_-]?key\s*=\s*['"][^'"]{8,}/i, label: "API key hardcodeada" },
    { re: /sk-[a-zA-Z0-9]{20,}/,              label: "OpenAI key" },
    { re: /ghp_[a-zA-Z0-9]{36}/,              label: "GitHub PAT" },
    { re: /AKIA[0-9A-Z]{16}/,                 label: "AWS Access Key" },
    { re: /BEGIN (RSA|EC|OPENSSH) PRIVATE KEY/, label: "clave privada" },
  ];
  for (const { re, label } of secretPatterns) {
    if (re.test(content)) {
      errors.push(`${label} detectado en el archivo — usa variables de entorno`);
    }
  }

  // ── Archivos de test: verificar que tienen al menos una aserción ─────────
  if (isTest) {
    const hasAssertion = /expect\(|assert\.|assertEquals|pytest\.raises|#\[test\]|func Test/.test(content);
    if (!hasAssertion) {
      warnings.push("archivo de test sin aserciones detectadas — ¿el test verifica algo real?");
    }
  }

  return { errors, warnings };
}

// ── Main ───────────────────────────────────────────────────────────────────

function main(raw) {
  let event;
  try { event = JSON.parse(raw); } catch { process.exit(0); }

  const toolName = event?.tool_name ?? "";
  if (!["Write", "Edit", "MultiEdit"].includes(toolName)) process.exit(0);

  // Extraer ruta del archivo
  const filePath = event?.tool_input?.file_path
    ?? event?.tool_input?.path
    ?? event?.tool_response?.file_path
    ?? "";

  if (!filePath) process.exit(0);

  const ext = extname(filePath).toLowerCase();

  // Solo validar archivos de código fuente
  const CODE_EXTS = new Set([
    ".ts",".tsx",".js",".jsx",".mjs",".cjs",
    ".py",".rs",".go",".java",".kt",".cs",
    ".rb",".php",".swift",".cpp",".c",".h",
  ]);
  if (!CODE_EXTS.has(ext)) process.exit(0);

  const content = tryRead(filePath);
  if (!content || content.length < 10) process.exit(0);

  const root = findWorkspaceRoot(filePath);
  const conv = detectConventions(root, ext);
  const { errors, warnings } = validate(filePath, content, conv, ext);

  if (errors.length === 0 && warnings.length === 0) process.exit(0);

  const relPath = filePath.replace(root, "").replace(/^[/\\]/, "");
  const sources = conv.sources.length ? `(fuentes: ${conv.sources.slice(0,3).join(", ")})` : "";

  let msg = `\n── Validación de convenciones: ${relPath} ${sources}\n`;

  if (errors.length > 0) {
    msg += `\n🔴 VIOLACIONES BLOQUEANTES (corregir antes de continuar):\n`;
    errors.forEach((e, i) => { msg += `   ${i+1}. ${e}\n`; });
  }

  if (warnings.length > 0) {
    msg += `\n🟡 SUGERENCIAS (revisar antes del merge):\n`;
    warnings.forEach((w, i) => { msg += `   ${i+1}. ${w}\n`; });
  }

  msg += "\n";
  process.stderr.write(msg);

  // Errores → bloquear; solo warnings → dejar pasar (Claude los ve y puede corregir)
  process.exit(errors.length > 0 ? 2 : 0);
}
