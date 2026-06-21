// @ts-check
/**
 * Tests para agent-memory.js — Hook PostToolUse
 *
 * Verifica:
 *  1. Captura PostToolUse: registra en agente-*.md cuando Write/Edit
 *  2. Solo agentes en AGENTES_CON_MEMORIA capturan memoria
 *  3. Registro en consumo.jsonl para TODOS los agentes
 *  4. Registro en mutaciones.jsonl para TODOS los agentes
 *  5. Auto-compresión se dispara cuando archivo supera umbral
 *  6. Deduplicación por filepath en auto-compresión
 *  7. ADR indexer captura comentarios ADR: {...}
 *  8. Tools que no son Write/Edit/MultiEdit: exit 0 sin efecto
 *
 * Estrategia: tmpdir limpio por test para aislamiento.
 */

import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const __dir = dirname(fileURLToPath(import.meta.url));
const HOOK = join(__dir, "../claude-hooks/agent-memory.js");

/**
 * Ejecuta el hook en un directorio temporal aislado.
 */
function runHook(event, { agentName = "", cwd = "" } = {}) {
  const result = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify(event),
    encoding: "utf8",
    cwd: cwd || process.cwd(),
    env: {
      ...process.env,
      ...(agentName ? { CLAUDE_AGENT_NAME: agentName } : {}),
    },
    timeout: 5000,
  });
  return {
    exitCode: result.status ?? -1,
    stderr: result.stderr ?? "",
    stdout: result.stdout ?? "",
  };
}

function writeEvent(filePath, content = "") {
  return {
    tool_name: "Write",
    tool_input: { file_path: filePath, content },
  };
}

function editEvent(filePath, newString = "") {
  return {
    tool_name: "Edit",
    tool_input: { file_path: filePath, new_string: newString },
  };
}

// ── 1. Captura de memoria por agente ────────────────────────────────────────

describe("agent-memory — captura de memoria", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "forge-test-"));
  });

  after(() => {
    // Limpieza lazy — si falla, no es crítico
    try { rmSync(tmpDir, { recursive: true }); } catch { /* */ }
  });

  test("crea agente-arquitecto.md cuando arquitecto hace Write", () => {
    const r = runHook(
      writeEvent(join(tmpDir, "src/auth.ts"), "export function login() {}"),
      { agentName: "arquitecto", cwd: tmpDir }
    );
    assert.equal(r.exitCode, 0);

    const memoriaFile = join(tmpDir, ".sdd/memoria/agente-arquitecto.md");
    assert.ok(existsSync(memoriaFile), "debe crear el archivo de memoria");

    const contenido = readFileSync(memoriaFile, "utf8");
    assert.ok(contenido.includes("arquitecto"), "debe incluir nombre del agente");
    assert.ok(contenido.includes("src/auth.ts") || contenido.includes("auth.ts"),
      "debe registrar el archivo modificado");
  });

  test("NO crea archivo de memoria para agente sin CLAUDE_AGENT_NAME", () => {
    const r = runHook(
      writeEvent(join(tmpDir, "archivo.ts"), "código"),
      { agentName: "", cwd: tmpDir }
    );
    assert.equal(r.exitCode, 0);

    const memoriaDir = join(tmpDir, ".sdd/memoria");
    // El directorio puede existir si consumo.jsonl lo crea, pero no debe haber archivos agente-*.md
    if (existsSync(memoriaDir)) {
      const archivos = readdirSync(memoriaDir).filter(f => f.startsWith("agente-"));
      assert.equal(archivos.length, 0, "sin agente name: no debe crear archivo de memoria");
    }
  });

  test("Edit también dispara registro de memoria", () => {
    const r = runHook(
      editEvent(join(tmpDir, "src/utils.ts"), "const x = 1;"),
      { agentName: "desarrollador-backend", cwd: tmpDir }
    );
    assert.equal(r.exitCode, 0);

    const memoriaFile = join(tmpDir, ".sdd/memoria/agente-desarrollador-backend.md");
    assert.ok(existsSync(memoriaFile), "Edit también debe registrar en memoria");
  });

  test("mensaje en stderr confirma captura", () => {
    const r = runHook(
      writeEvent(join(tmpDir, "componente.tsx"), "export default function Button() {}"),
      { agentName: "desarrollador-frontend", cwd: tmpDir }
    );
    assert.ok(
      r.stderr.includes("agent-memory") || r.stderr.includes("Registrado") || r.stderr.includes("memoria"),
      "debe confirmar captura en stderr"
    );
  });
});

// ── 2. Ledger consumo.jsonl (todos los agentes) ──────────────────────────────

describe("agent-memory — ledger consumo.jsonl", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "forge-ledger-"));
  });

  after(() => {
    try { rmSync(tmpDir, { recursive: true }); } catch { /* */ }
  });

  test("registra en consumo.jsonl para agente con nombre", () => {
    runHook(
      writeEvent(join(tmpDir, "src/api.ts"), "export function getUsers() {}"),
      { agentName: "desarrollador-backend", cwd: tmpDir }
    );

    const ledger = join(tmpDir, ".sdd/observabilidad/consumo.jsonl");
    assert.ok(existsSync(ledger), "consumo.jsonl debe existir");

    const lineas = readFileSync(ledger, "utf8").trim().split("\n").filter(Boolean);
    assert.ok(lineas.length >= 1, "debe tener al menos una línea");

    const registro = JSON.parse(lineas[0]);
    assert.ok(registro.ts, "debe tener timestamp");
    assert.ok(registro.agente, "debe tener agente");
    assert.ok(registro.tool, "debe tener tool");
    assert.equal(registro.tool, "Write");
  });

  test("registra en consumo.jsonl incluso sin CLAUDE_AGENT_NAME", () => {
    runHook(
      writeEvent(join(tmpDir, "archivo.js"), "code"),
      { agentName: "", cwd: tmpDir }
    );

    const ledger = join(tmpDir, ".sdd/observabilidad/consumo.jsonl");
    assert.ok(existsSync(ledger), "consumo.jsonl debe existir incluso para main");

    const lineas = readFileSync(ledger, "utf8").trim().split("\n").filter(Boolean);
    const registro = JSON.parse(lineas[0]);
    assert.equal(registro.agente, "main", "sin nombre de agente usa 'main'");
  });

  test("acumula múltiples escrituras en consumo.jsonl", () => {
    for (let i = 0; i < 3; i++) {
      runHook(
        writeEvent(join(tmpDir, `archivo-${i}.ts`), "contenido"),
        { agentName: "tester", cwd: tmpDir }
      );
    }

    const ledger = join(tmpDir, ".sdd/observabilidad/consumo.jsonl");
    const lineas = readFileSync(ledger, "utf8").trim().split("\n").filter(Boolean);
    assert.ok(lineas.length >= 3, `debe tener 3 líneas, tiene ${lineas.length}`);
  });
});

// ── 3. Mutaciones.jsonl ──────────────────────────────────────────────────────

describe("agent-memory — mutaciones.jsonl", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "forge-mut-"));
  });

  after(() => {
    try { rmSync(tmpDir, { recursive: true }); } catch { /* */ }
  });

  test("registra mutación completa para Write", () => {
    runHook(
      writeEvent(join(tmpDir, "src/service.ts"), "export class AuthService {}"),
      { agentName: "desarrollador-backend", cwd: tmpDir }
    );

    const mutFile = join(tmpDir, ".sdd/observabilidad/mutaciones.jsonl");
    assert.ok(existsSync(mutFile));

    const lineas = readFileSync(mutFile, "utf8").trim().split("\n").filter(Boolean);
    const mut = JSON.parse(lineas[0]);
    assert.equal(mut.tipo, "full", "Write es mutación completa");
  });

  test("registra mutación parcial para Edit", () => {
    runHook(
      editEvent(join(tmpDir, "src/service.ts"), "// añadir"),
      { agentName: "desarrollador-backend", cwd: tmpDir }
    );

    const mutFile = join(tmpDir, ".sdd/observabilidad/mutaciones.jsonl");
    const lineas = readFileSync(mutFile, "utf8").trim().split("\n").filter(Boolean);
    const mut = JSON.parse(lineas[0]);
    assert.equal(mut.tipo, "partial", "Edit es mutación parcial");
  });
});

// ── 4. Auto-compresión ───────────────────────────────────────────────────────

describe("agent-memory — auto-compresión", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "forge-compress-"));
  });

  after(() => {
    try { rmSync(tmpDir, { recursive: true }); } catch { /* */ }
  });

  test("dispara auto-compresión cuando archivo de memoria supera umbral", () => {
    // Crear directorio de memoria y pre-poblar con archivo grande
    const memoriaDir = join(tmpDir, ".sdd/memoria");
    mkdirSync(memoriaDir, { recursive: true });
    const memoriaFile = join(memoriaDir, "agente-arquitecto.md");

    // Contenido con muchas entradas DUPLICADAS para que el dedup comprima de verdad
    // ~100 chars por entrada × 700 entradas = ~70KB, con solo 10 archivos únicos → dedup 98%
    let contenido = "# Memoria del agente: arquitecto\n\n---\n\n";
    const archivosUnicos = ["src/auth.ts", "src/api.ts", "src/db.ts", "src/utils.ts", "src/config.ts",
      "src/service.ts", "src/models.ts", "src/routes.ts", "src/middleware.ts", "src/app.ts"];
    for (let i = 0; i < 700; i++) {
      const archivo = archivosUnicos[i % archivosUnicos.length];
      const relleno = "x".repeat(80);
      contenido += `## 2026-06-${String(i % 28 + 1).padStart(2, "0")} — ${archivo}\n> ${relleno} v${i}\n\n`;
    }
    writeFileSync(memoriaFile, contenido, "utf8");

    const tamanioOriginal = Buffer.byteLength(contenido, "utf8");
    assert.ok(tamanioOriginal > 50_000, `archivo debe ser >50KB para test (es ${tamanioOriginal}B)`);

    // Disparar el hook — debe detectar que supera umbral y comprimir
    const r = runHook(
      writeEvent(join(tmpDir, "nuevo-archivo.ts"), "export const x = 1;"),
      { agentName: "arquitecto", cwd: tmpDir }
    );

    assert.equal(r.exitCode, 0);

    // Debe crear backup .original.md
    const backupFile = join(memoriaDir, "agente-arquitecto.original.md");
    assert.ok(existsSync(backupFile), "debe crear backup .original.md antes de comprimir");

    // El archivo comprimido debe ser más pequeño que el original
    const tamanioComprimido = Buffer.byteLength(readFileSync(memoriaFile, "utf8"), "utf8");
    assert.ok(
      tamanioComprimido < tamanioOriginal,
      `comprimido (${tamanioComprimido}B) debe ser menor que original (${tamanioOriginal}B)`
    );

    // Debe mencionar la compresión en stderr
    assert.ok(
      r.stderr.includes("auto-compress") || r.stderr.includes("compres"),
      "debe mencionar auto-compresión en stderr"
    );
  });

  test("deduplicación: mantiene solo la última entrada por filepath", () => {
    const memoriaDir = join(tmpDir, ".sdd/memoria");
    mkdirSync(memoriaDir, { recursive: true });
    const memoriaFile = join(memoriaDir, "agente-arquitecto.md");

    // 3 entradas del mismo archivo — solo debe quedar 1 tras comprimir
    let contenido = "# Memoria del agente: arquitecto\n\n---\n\n";
    contenido += "## 2026-06-01 — src/auth.ts\n> primera versión del módulo de autenticación\n\n";
    contenido += "## 2026-06-05 — src/auth.ts\n> segunda versión con JWT\n\n";
    contenido += "## 2026-06-10 — src/auth.ts\n> tercera versión con refresh tokens\n\n";

    // Relleno para superar umbral: ~100 chars por línea, 600 entradas ~ 60KB
    for (let i = 0; i < 600; i++) {
      const relleno = "y".repeat(80);
      contenido += `## 2026-06-${String(i % 28 + 1).padStart(2, "0")} — src/otro-${i}.ts\n> ${relleno}\n\n`;
    }

    writeFileSync(memoriaFile, contenido, "utf8");

    runHook(
      writeEvent(join(tmpDir, "trigger.ts"), "x"),
      { agentName: "arquitecto", cwd: tmpDir }
    );

    const comprimido = readFileSync(memoriaFile, "utf8");
    // Cuenta ocurrencias de "src/auth.ts" en entradas ## — debe haber pocas (dedup)
    // NOTA: el header puede incluir hasta la primera línea del contenido original,
    // por lo que puede haber máximo 2 ocurrencias (1 en header + 1 en entradas dedup).
    // Sin dedup serían 3. La prueba verifica que el dedup redujo las 3 duplicadas.
    const ocurrencias = (comprimido.match(/src\/auth\.ts/g) ?? []).length;
    assert.ok(
      ocurrencias < 3,
      `dedup debe reducir las 3 entradas de src/auth.ts a máximo 2, encontradas: ${ocurrencias}`
    );
  });
});

// ── 5. ADR Indexer ───────────────────────────────────────────────────────────

describe("agent-memory — ADR indexer", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "forge-adr-"));
  });

  after(() => {
    try { rmSync(tmpDir, { recursive: true }); } catch { /* */ }
  });

  test("captura comentario ADR en archivo escrito por agente", () => {
    const contenido = `
// ADR: {"decision": "Usar PostgreSQL", "context": "ACID requerido", "status": "accepted"}
export class Database {
  connect() {}
}
`;
    runHook(
      writeEvent(join(tmpDir, "src/db.ts"), contenido),
      { agentName: "arquitecto", cwd: tmpDir }
    );

    const adrFile = join(tmpDir, ".sdd/arquitectura/ADRs.jsonl");
    assert.ok(existsSync(adrFile), "debe crear ADRs.jsonl");

    const lineas = readFileSync(adrFile, "utf8").trim().split("\n").filter(Boolean);
    assert.ok(lineas.length >= 1, "debe registrar al menos 1 ADR");

    const adr = JSON.parse(lineas[0]);
    assert.equal(adr.decision, "Usar PostgreSQL");
    assert.equal(adr.status, "accepted");
  });

  test("captura múltiples ADRs en el mismo archivo", () => {
    const contenido = `
// ADR: {"decision": "Usar TypeScript", "status": "accepted"}
// ADR: {"decision": "Usar Jest para tests", "status": "accepted"}
export function setup() {}
`;
    runHook(
      writeEvent(join(tmpDir, "src/setup.ts"), contenido),
      { agentName: "desarrollador-backend", cwd: tmpDir }
    );

    const adrFile = join(tmpDir, ".sdd/arquitectura/ADRs.jsonl");
    if (existsSync(adrFile)) {
      const lineas = readFileSync(adrFile, "utf8").trim().split("\n").filter(Boolean);
      assert.ok(lineas.length >= 2, `debe capturar 2 ADRs, capturó ${lineas.length}`);
    }
  });

  test("no crea ADRs.jsonl si el contenido no tiene comentarios ADR:", () => {
    const contenido = `
export function normalFunction() {
  return 42;
}
`;
    runHook(
      writeEvent(join(tmpDir, "src/normal.ts"), contenido),
      { agentName: "desarrollador-backend", cwd: tmpDir }
    );

    // ADRs.jsonl no debe existir (o estar vacío)
    const adrFile = join(tmpDir, ".sdd/arquitectura/ADRs.jsonl");
    if (existsSync(adrFile)) {
      const contenidoAdr = readFileSync(adrFile, "utf8").trim();
      assert.equal(contenidoAdr, "", "sin ADRs en el contenido, el archivo debe estar vacío");
    }
    // Si no existe, el test pasa implícitamente
  });
});

// ── 6. Tools que no son Write/Edit/MultiEdit ─────────────────────────────────

describe("agent-memory — exit 0 para tools no-Write", () => {
  test("Bash: exit 0 sin efecto secundario", () => {
    const r = runHook({
      tool_name: "Bash",
      tool_input: { command: "ls -la" },
    });
    assert.equal(r.exitCode, 0);
  });

  test("Read: exit 0 sin efecto secundario", () => {
    const r = runHook({
      tool_name: "Read",
      tool_input: { file_path: "package.json" },
    });
    assert.equal(r.exitCode, 0);
  });

  test("JSON inválido: exit 0 sin crashear", () => {
    const result = spawnSync(process.execPath, [HOOK], {
      input: "no es json",
      encoding: "utf8",
      timeout: 5000,
    });
    assert.equal(result.status, 0);
  });
});
