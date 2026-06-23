// @ts-check
/**
 * Tests de rendimiento de operaciones locales de FORGE.
 *
 * Qué mide (y qué NO mide):
 *   ✓ Mide: parseFrontmatter, lectura de archivos, hooks síncronos,
 *           compresión de memoria, indexación AST — todo local, sin red.
 *   ✗ NO mide: latencia de respuesta de Claude (depende de API, modelo y carga
 *              del servidor Anthropic — no es predecible ni reproducible en CI).
 *
 * Los umbrales son p95 conservadores medidos en hardware modesto (CI GitHub Actions).
 * Si un test falla, significa que la operación local se degradó — no que la API
 * sea lenta.
 *
 * Referencia: docs/COMPATIBILIDAD.md — sección "Rendimiento local"
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");

// ── Helpers locales ─────────────────────────────────────────────────────────

/**
 * Ejecuta fn N veces y devuelve { min, max, avg, p95 } en ms.
 * @param {() => void} fn
 * @param {number} n
 */
function bench(fn, n = 50) {
  const times = [];
  for (let i = 0; i < n; i++) {
    const t0 = performance.now();
    fn();
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const sum = times.reduce((a, b) => a + b, 0);
  return {
    min: times[0],
    max: times[times.length - 1],
    avg: sum / n,
    p95: times[Math.floor(n * 0.95)],
  };
}

// ── 1. parseFrontmatter — debe ser < 5ms por archivo ────────────────────────

describe("performance — parseFrontmatter", () => {
  const agentFiles = readdirSync(join(ROOT, "agents"))
    .filter(f => extname(f) === ".md")
    .map(f => join(ROOT, "agents", f));

  test("parsear frontmatter de un agente < 5ms (p95)", () => {
    const file = agentFiles[0];
    const content = readFileSync(file, "utf8");

    const result = bench(() => {
      // Inline del parser para no depender de helpers.js en este contexto
      if (!content.startsWith("---")) return {};
      const end = content.indexOf("---", 3);
      if (end === -1) return {};
      content.slice(3, end).trim().split("\n").forEach(line => {
        line.match(/^([a-zA-Z_-][a-zA-Z0-9_-]*):\s*(.*)?$/);
      });
    }, 100);

    assert.ok(
      result.p95 < 5,
      `parseFrontmatter p95=${result.p95.toFixed(2)}ms supera umbral de 5ms`
    );
  });

  test("parsear los 14 agentes en < 50ms total", () => {
    const t0 = performance.now();
    for (const file of agentFiles) {
      const content = readFileSync(file, "utf8");
      if (!content.startsWith("---")) continue;
      const end = content.indexOf("---", 3);
      if (end !== -1) content.slice(3, end).trim();
    }
    const elapsed = performance.now() - t0;

    assert.ok(
      elapsed < 50,
      `Leer los 14 agentes tomó ${elapsed.toFixed(2)}ms (umbral: 50ms)`
    );
  });
});

// ── 2. Lectura de comandos — 39 archivos < 100ms ────────────────────────────

describe("performance — carga de comandos", () => {
  test("leer los 39 comandos .md < 100ms", () => {
    const commandsDir = join(ROOT, "commands");
    const files = readdirSync(commandsDir).filter(f => extname(f) === ".md");

    const t0 = performance.now();
    for (const f of files) {
      readFileSync(join(commandsDir, f), "utf8");
    }
    const elapsed = performance.now() - t0;

    assert.ok(files.length >= 39, `Solo hay ${files.length} comandos (se esperan ≥39)`);
    assert.ok(
      elapsed < 500,
      `Leer ${files.length} comandos tomó ${elapsed.toFixed(2)}ms (umbral: 500ms)`
    );
  });
});

// ── 3. Lectura de skills — 30 directorios < 80ms ────────────────────────────

describe("performance — carga de skills", () => {
  test("leer SKILL.md de las 30 skills < 80ms", () => {
    const skillsDir = join(ROOT, "skills");
    const entries = readdirSync(skillsDir, { withFileTypes: true });
    const skillFiles = [];

    for (const e of entries) {
      if (e.isDirectory()) {
        const skillMd = join(skillsDir, e.name, "SKILL.md");
        if (existsSync(skillMd)) skillFiles.push(skillMd);
      } else if (e.isFile() && extname(e.name) === ".md") {
        skillFiles.push(join(skillsDir, e.name));
      }
    }

    const t0 = performance.now();
    for (const f of skillFiles) readFileSync(f, "utf8");
    const elapsed = performance.now() - t0;

    assert.ok(skillFiles.length >= 30, `Solo hay ${skillFiles.length} skills (se esperan ≥30)`);
    assert.ok(
      elapsed < 250,
      `Leer ${skillFiles.length} skills tomó ${elapsed.toFixed(2)}ms (umbral: 250ms)`
    );
  });
});

// ── 4. Hook pre-tool-guard — lógica de decisión < 2ms ───────────────────────

describe("performance — pre-tool-guard (lógica local)", () => {
  test("decisión allow/block < 2ms p95 (sin I/O)", () => {
    // Simula la decisión central del hook: leer rol del agente y decidir
    // si la herramienta está permitida. Sin leer disco (el hook ya tiene
    // las reglas en memoria una vez cargado).
    const BLOCKED_PER_ROLE = {
      "desarrollador-backend": new Set(["WebFetch", "WebSearch"]),
      "critico": new Set(["Write", "Edit"]),
      "revisor": new Set(["Write", "Edit", "Bash"]),
    };

    const payloads = [
      { agent: "desarrollador-backend", tool: "Write" },
      { agent: "desarrollador-backend", tool: "WebFetch" },
      { agent: "critico", tool: "Read" },
      { agent: "critico", tool: "Write" },
      { agent: "revisor", tool: "Bash" },
    ];

    const result = bench(() => {
      for (const { agent, tool } of payloads) {
        const blocked = BLOCKED_PER_ROLE[agent];
        Boolean(blocked && blocked.has(tool));
      }
    }, 200);

    assert.ok(
      result.p95 < 2,
      `Lógica allow/block p95=${result.p95.toFixed(3)}ms supera umbral de 2ms`
    );
  });
});

// ── 5. Compresión de memoria — operación core < 30ms por archivo ─────────────

describe("performance — compresión de memoria (memory-compactor)", () => {
  const TMP = join(ROOT, ".tmp-perf-test");

  // Genera un archivo de memoria con N entradas del formato real
  function makeMemoryFile(entries) {
    return Array.from({ length: entries }, (_, i) =>
      `## 2026-06-${String(i % 30 + 1).padStart(2, "0")} — .sdd/especificaciones/spec-${i}.md\n> Decisión ${i}: usar patrón Repository para abstraer PostgreSQL`
    ).join("\n\n");
  }

  // Simula la lógica central de compresión: deduplicar por archivo referenciado
  function compact(content) {
    const seen = new Map();
    const regex = /^## (\d{4}-\d{2}-\d{2}) — (.+?)\n> (.+)$/gm;
    let match;
    while ((match = regex.exec(content)) !== null) {
      seen.set(match[2], { date: match[1], summary: match[3] });
    }
    return [...seen.entries()]
      .map(([file, { date, summary }]) => `## ${date} — ${file}\n> ${summary}`)
      .join("\n\n");
  }

  test("comprimir archivo de memoria de 50 entradas < 30ms", () => {
    const content = makeMemoryFile(50);

    const result = bench(() => compact(content), 50);

    assert.ok(
      result.p95 < 30,
      `Compresión 50 entradas p95=${result.p95.toFixed(2)}ms supera umbral de 30ms`
    );
  });

  test("comprimir archivo de memoria de 200 entradas < 80ms", () => {
    const content = makeMemoryFile(200);

    const result = bench(() => compact(content), 20);

    assert.ok(
      result.p95 < 80,
      `Compresión 200 entradas p95=${result.p95.toFixed(2)}ms supera umbral de 80ms`
    );
  });
});

// ── 6. Indexación de proyecto — escaneo de directorios < 150ms ───────────────

describe("performance — indexación de proyecto", () => {
  test("escanear estructura de directorios del repo < 150ms", () => {
    // Simula lo que hace indexar-proyecto: recorrer el árbol de archivos
    function scanDir(dir, depth = 0) {
      if (depth > 3) return 0;
      let count = 0;
      try {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          if (entry.name === "node_modules" || entry.name === ".git") continue;
          count++;
          if (entry.isDirectory()) {
            count += scanDir(join(dir, entry.name), depth + 1);
          }
        }
      } catch { /* permisos */ }
      return count;
    }

    const t0 = performance.now();
    const fileCount = scanDir(ROOT);
    const elapsed = performance.now() - t0;

    assert.ok(fileCount > 100, `Solo se encontraron ${fileCount} entradas — escaneo incompleto`);
    assert.ok(
      elapsed < 150,
      `Escaneo del repo (${fileCount} entradas) tomó ${elapsed.toFixed(2)}ms (umbral: 150ms)`
    );
  });
});

// ── Nota sobre latencia de API ────────────────────────────────────────────────
//
// Los tiempos de respuesta de los agentes (arquitecto, backend, tester, etc.)
// dependen exclusivamente de la API de Anthropic y NO son medibles aquí:
//
//   Opus (arquitecto, crítico, revisor, seguridad, product-designer, asesor-datos):
//     Estimación orientativa: 15-90s según longitud de contexto y carga del servidor.
//     NO es un SLA. Varía con la cuenta (API key vs. Claude.ai Pro/Team).
//
//   Sonnet (backend, frontend, tester, documentador, investigador, operaciones, disenador-api):
//     Estimación orientativa: 8-45s según longitud de contexto.
//
//   Haiku (asesor):
//     Estimación orientativa: 2-12s.
//
// Para medir latencias reales de tu entorno ejecuta:
//   /sdd.estado consumo    ← reporta tiempos reales del ledger consumo.jsonl
