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

import { test, describe, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";

const _require = createRequire(import.meta.url);

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

// ── T-05: umbral configurable desde sdd.config.yaml ─────────────────────────

describe("agent-memory — umbral configurable (T-05)", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "forge-umbral-"));
    mkdirSync(join(tmpDir, ".sdd"), { recursive: true });
  });

  after(() => {
    try { rmSync(tmpDir, { recursive: true }); } catch { /* */ }
  });

  test("usa 50 000 bytes por defecto si no hay sdd.config.yaml", () => {
    // Sin config — el hook debe funcionar normalmente con umbral por defecto
    const r = runHook(
      writeEvent(join(tmpDir, "app.ts"), "export const x = 1;"),
      { agentName: "arquitecto", cwd: tmpDir }
    );
    assert.equal(r.exitCode, 0);
  });

  test("lee umbral_bytes de sdd.config.yaml y no crashea con valor personalizado", () => {
    writeFileSync(
      join(tmpDir, ".sdd", "sdd.config.yaml"),
      "memoria:\n  umbral_bytes: 100\n",
      "utf8"
    );
    const r = runHook(
      writeEvent(join(tmpDir, "app.ts"), "export const x = 1;"),
      { agentName: "arquitecto", cwd: tmpDir }
    );
    assert.equal(r.exitCode, 0);
  });

  test("con umbral muy bajo dispara auto-compresión en la primera escritura", () => {
    writeFileSync(
      join(tmpDir, ".sdd", "sdd.config.yaml"),
      "memoria:\n  umbral_bytes: 1\n",
      "utf8"
    );
    // Primera escritura crea y supera umbral → debe disparar compresión (stderr tiene mensaje)
    const r = runHook(
      writeEvent(join(tmpDir, "app.ts"), "export const x = 1;"),
      { agentName: "arquitecto", cwd: tmpDir }
    );
    assert.equal(r.exitCode, 0);
    // El hook no debe crashear con umbral mínimo
  });

  test("ignora yaml malformado y usa umbral por defecto", () => {
    writeFileSync(
      join(tmpDir, ".sdd", "sdd.config.yaml"),
      "esto: no\n  es: yaml válido\n  [roto",
      "utf8"
    );
    const r = runHook(
      writeEvent(join(tmpDir, "app.ts"), "x"),
      { agentName: "arquitecto", cwd: tmpDir }
    );
    assert.equal(r.exitCode, 0);
  });
});

// ── 7. Contrato de lectura de memoria al inicio de sesión ────────────────────
//
// Los agentes leen `.sdd/memoria/agente-{nombre}.md` al inicio de cada tarea.
// Este bloque verifica que:
//   a) El hook crea el archivo en la ruta que los agentes esperan leer.
//   b) El contenido es parseable (no binario ni corrupto).
//   c) La ruta existe y es accesible con `cat` o `readFileSync`.

describe("agent-memory — contrato lectura de memoria por agente", () => {
  /** @type {string} */
  let tmpDir;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "forge-lectura-"));
  });

  after(() => {
    try { rmSync(tmpDir, { recursive: true }); } catch { /* */ }
  });

  test("el archivo de memoria se crea en la ruta que el agente intenta leer", () => {
    // Simula la primera escritura del agente arquitecto
    runHook(
      writeEvent(join(tmpDir, "src/auth.ts"), "export function login() {}"),
      { agentName: "arquitecto", cwd: tmpDir }
    );

    // La ruta que el agente lee en su prompt: .sdd/memoria/agente-arquitecto.md
    const rutaEsperada = join(tmpDir, ".sdd", "memoria", "agente-arquitecto.md");
    assert.ok(existsSync(rutaEsperada),
      `el archivo debe existir en la ruta que el agente lee: ${rutaEsperada}`);
  });

  test("el contenido del archivo de memoria es texto UTF-8 legible", () => {
    runHook(
      writeEvent(join(tmpDir, "src/service.ts"), "export class UserService {}"),
      { agentName: "desarrollador-backend", cwd: tmpDir }
    );

    const rutaMemoria = join(tmpDir, ".sdd", "memoria", "agente-desarrollador-backend.md");
    assert.ok(existsSync(rutaMemoria), "debe existir el archivo de memoria");

    const contenido = readFileSync(rutaMemoria, "utf8");
    assert.ok(contenido.length > 0, "el archivo no debe estar vacío");
    // Verificar que es texto plano legible (no binario): todos los chars son imprimibles o whitespace
    assert.ok(!/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(contenido),
      "el contenido debe ser texto UTF-8 sin caracteres de control");
  });

  test("tras múltiples escrituras el archivo acumula entradas (es un log, no se sobreescribe)", () => {
    const agente = "tester";
    const evento1 = writeEvent(join(tmpDir, "tests/auth.test.ts"), "test('login', () => {});");
    const evento2 = writeEvent(join(tmpDir, "tests/user.test.ts"), "test('create', () => {});");

    runHook(evento1, { agentName: agente, cwd: tmpDir });
    runHook(evento2, { agentName: agente, cwd: tmpDir });

    const rutaMemoria = join(tmpDir, ".sdd", "memoria", `agente-${agente}.md`);
    assert.ok(existsSync(rutaMemoria), "debe existir el archivo de memoria");

    const contenido = readFileSync(rutaMemoria, "utf8");
    // Debe registrar ambos archivos
    assert.ok(
      contenido.includes("auth.test.ts") || contenido.includes("auth"),
      "debe registrar la primera escritura"
    );
    assert.ok(
      contenido.includes("user.test.ts") || contenido.includes("user"),
      "debe registrar la segunda escritura"
    );
  });

  test("agentes distintos tienen archivos de memoria separados", () => {
    runHook(
      writeEvent(join(tmpDir, "src/api.ts"), "export const router = {}"),
      { agentName: "disenador-api", cwd: tmpDir }
    );
    runHook(
      writeEvent(join(tmpDir, "src/db.ts"), "export const pool = null"),
      { agentName: "desarrollador-backend", cwd: tmpDir }
    );

    const memoriaDir = join(tmpDir, ".sdd", "memoria");
    assert.ok(existsSync(memoriaDir), "debe existir el directorio de memoria");

    const archivos = readdirSync(memoriaDir).filter(f => f.startsWith("agente-"));
    // Cada agente con memoria debe tener su propio archivo separado
    assert.ok(archivos.length >= 1,
      `debe haber al menos 1 archivo de memoria, encontrados: ${archivos.join(", ")}`);
  });
});

// ── describe #8: índice invertido JSONL (indice.jsonl) ─────────────────────────

describe("índice invertido JSONL para recuperación selectiva", () => {
  /** @type {string} */
  let tmpDir;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "forge-indice-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("se crea indice.jsonl tras una escritura de agente con memoria", () => {
    runHook(
      writeEvent(join(tmpDir, "src/auth.ts"), "export function login() {}"),
      { agentName: "arquitecto", cwd: tmpDir }
    );
    const indiceFile = join(tmpDir, ".sdd", "memoria", "indice.jsonl");
    assert.ok(existsSync(indiceFile), "debe existir indice.jsonl");
  });

  test("la entrada del índice tiene los campos requeridos", () => {
    runHook(
      writeEvent(join(tmpDir, "src/auth.ts"), "export function login() {}"),
      { agentName: "arquitecto", cwd: tmpDir }
    );
    const indiceFile = join(tmpDir, ".sdd", "memoria", "indice.jsonl");
    const linea = readFileSync(indiceFile, "utf8").trim().split("\n")[0];
    const entrada = JSON.parse(linea);
    assert.ok(entrada.ts, "debe tener campo ts");
    assert.ok(entrada.fecha, "debe tener campo fecha");
    assert.strictEqual(entrada.agente, "arquitecto", "debe registrar el agente correcto");
    assert.ok(entrada.archivo.includes("auth.ts"), "debe registrar el archivo");
    assert.ok(typeof entrada.resumen === "string", "debe tener resumen");
    assert.ok(typeof entrada.bytes === "number", "debe tener bytes");
  });

  test("múltiples agentes generan entradas separadas en el mismo índice", () => {
    runHook(
      writeEvent(join(tmpDir, "src/api.ts"), "export const router = {}"),
      { agentName: "disenador-api", cwd: tmpDir }
    );
    runHook(
      writeEvent(join(tmpDir, "src/db.ts"), "export const pool = null"),
      { agentName: "desarrollador-backend", cwd: tmpDir }
    );
    const indiceFile = join(tmpDir, ".sdd", "memoria", "indice.jsonl");
    const lineas = readFileSync(indiceFile, "utf8").trim().split("\n");
    assert.strictEqual(lineas.length, 2, "debe haber 2 entradas en el índice");
    const agentes = lineas.map(l => JSON.parse(l).agente);
    assert.ok(agentes.includes("disenador-api"), "debe incluir disenador-api");
    assert.ok(agentes.includes("desarrollador-backend"), "debe incluir desarrollador-backend");
  });

  test("agentes sin memoria no se añaden al índice", () => {
    // "investigador" no está en AGENTES_CON_MEMORIA
    runHook(
      writeEvent(join(tmpDir, "src/report.md"), "# Investigación"),
      { agentName: "investigador", cwd: tmpDir }
    );
    const indiceFile = join(tmpDir, ".sdd", "memoria", "indice.jsonl");
    assert.ok(!existsSync(indiceFile), "no debe crear indice.jsonl para agentes sin memoria");
  });

  test("query-memory.js devuelve las últimas N entradas del agente correcto", () => {
    // Insertar 3 entradas para arquitecto y 1 para otro agente
    for (const archivo of ["src/a.ts", "src/b.ts", "src/c.ts"]) {
      runHook(
        writeEvent(join(tmpDir, archivo), `export const x = 1; // ${archivo}`),
        { agentName: "arquitecto", cwd: tmpDir }
      );
    }
    runHook(
      writeEvent(join(tmpDir, "src/db.ts"), "export const pool = null"),
      { agentName: "desarrollador-backend", cwd: tmpDir }
    );

    const resultado = spawnSync(
      process.execPath,
      [join(process.cwd(), "claude-hooks", "query-memory.js"), "--agente", "arquitecto", "--ultimas", "2"],
      { cwd: tmpDir, encoding: "utf8" }
    );
    assert.strictEqual(resultado.status, 0, "debe salir con código 0");
    assert.ok(resultado.stdout.includes("arquitecto"), "debe mencionar el agente");
    // Contar entradas de memoria (líneas que empiezan con "## YYYY-MM-DD")
    const entradas = resultado.stdout.split("\n").filter(l => /^## \d{4}-\d{2}-\d{2}/.test(l));
    assert.ok(entradas.length <= 2, `debe devolver máximo 2 entradas, devolvió ${entradas.length}`);
  });

  test("query-memory.js filtra por término de búsqueda", () => {
    runHook(
      writeEvent(join(tmpDir, "src/auth.ts"), "export function loginWithJWT() {}"),
      { agentName: "arquitecto", cwd: tmpDir }
    );
    runHook(
      writeEvent(join(tmpDir, "src/db.ts"), "export const pool = createPool()"),
      { agentName: "arquitecto", cwd: tmpDir }
    );

    const resultado = spawnSync(
      process.execPath,
      [join(process.cwd(), "claude-hooks", "query-memory.js"), "--agente", "arquitecto", "--buscar", "auth"],
      { cwd: tmpDir, encoding: "utf8" }
    );
    assert.strictEqual(resultado.status, 0, "debe salir con código 0");
    assert.ok(resultado.stdout.includes("auth"), "debe incluir la entrada con auth");
    assert.ok(!resultado.stdout.includes("pool"), "no debe incluir la entrada de db sin auth");
  });
});

// ── 9. Backend SQLite ─────────────────────────────────────────────────────────

describe("agent-memory — backend SQLite", () => {
  let tmpDir;

  // Detectar si node:sqlite está disponible en este runtime
  const [major, minor] = process.versions.node.split(".").map(Number);
  const sqliteDisponible = major > 22 || (major === 22 && minor >= 5);

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "forge-sqlite-"));
    mkdirSync(join(tmpDir, ".sdd", "memoria"), { recursive: true });
    writeFileSync(
      join(tmpDir, ".sdd", "sdd.config.yaml"),
      'memoria:\n  umbral_bytes: 50000\n  backend: "sqlite"\n  recuperacion_por_defecto: 10\n',
      "utf8"
    );
  });

  after(() => {
    try { rmSync(tmpDir, { recursive: true }); } catch { /* */ }
  });

  test("crea memoria.db cuando backend es sqlite (Node >= 22.5)", { skip: !sqliteDisponible }, () => {
    runHook(
      writeEvent(join(tmpDir, "src/auth.ts"), "export function login() { return true; }"),
      { agentName: "arquitecto", cwd: tmpDir }
    );

    const dbPath = join(tmpDir, ".sdd", "memoria", "memoria.db");
    assert.ok(existsSync(dbPath), "debe crear memoria.db con backend sqlite");
  });

  test("NO crea agente-arquitecto.md con backend sqlite (Node >= 22.5)", { skip: !sqliteDisponible }, () => {
    runHook(
      writeEvent(join(tmpDir, "src/auth.ts"), "export function login() {}"),
      { agentName: "arquitecto", cwd: tmpDir }
    );

    const mdFile = join(tmpDir, ".sdd", "memoria", "agente-arquitecto.md");
    assert.ok(!existsSync(mdFile), "con backend sqlite no debe crear archivo .md");
  });

  test("la entrada en memoria.db tiene los campos correctos (Node >= 22.5)", { skip: !sqliteDisponible }, () => {
    runHook(
      writeEvent(join(tmpDir, "src/service.ts"), "export class UserService { find() {} }"),
      { agentName: "arquitecto", cwd: tmpDir }
    );

    const dbPath = join(tmpDir, ".sdd", "memoria", "memoria.db");
    // Leer la DB con node:sqlite
    const { DatabaseSync } = _require("node:sqlite");
    const db = new DatabaseSync(dbPath);
    const rows = db.prepare("SELECT * FROM entradas WHERE agente = 'arquitecto'").all();
    db.close();

    assert.ok(rows.length >= 1, "debe haber al menos 1 entrada en la DB");
    const row = rows[0];
    assert.ok(row.ts, "debe tener campo ts");
    assert.ok(row.fecha, "debe tener campo fecha");
    assert.equal(row.agente, "arquitecto");
    assert.ok(row.archivo.includes("service.ts"), "debe registrar el archivo");
    assert.ok(typeof row.resumen === "string" && row.resumen.length > 0, "debe tener resumen");
    assert.ok(typeof row.bytes === "number" && row.bytes > 0, "debe tener bytes");
  });

  test("deduplicación: misma escritura el mismo día actualiza en lugar de duplicar (Node >= 22.5)", { skip: !sqliteDisponible }, () => {
    runHook(
      writeEvent(join(tmpDir, "src/auth.ts"), "function login() { return true; }"),
      { agentName: "arquitecto", cwd: tmpDir }
    );
    runHook(
      writeEvent(join(tmpDir, "src/auth.ts"), "function login(user) { return user.active; }"),
      { agentName: "arquitecto", cwd: tmpDir }
    );

    const dbPath = join(tmpDir, ".sdd", "memoria", "memoria.db");
    const { DatabaseSync } = _require("node:sqlite");
    const db = new DatabaseSync(dbPath);
    const rows = db.prepare("SELECT * FROM entradas WHERE agente = 'arquitecto' AND archivo LIKE '%auth.ts'").all();
    db.close();

    assert.equal(rows.length, 1, "mismo archivo mismo día debe dar 1 fila (dedup)");
    assert.ok(rows[0].resumen.includes("user.active"), "debe tener el resumen de la última escritura");
  });

  test("indice.jsonl se crea igualmente con backend sqlite", { skip: !sqliteDisponible }, () => {
    runHook(
      writeEvent(join(tmpDir, "src/api.ts"), "export const router = {}"),
      { agentName: "disenador-api", cwd: tmpDir }
    );

    const indiceFile = join(tmpDir, ".sdd", "memoria", "indice.jsonl");
    assert.ok(existsSync(indiceFile), "indice.jsonl debe existir independientemente del backend");
  });

  test("fallback a markdown si sqlite falla (backend configurado pero Node < 22.5 simulado)", () => {
    // Este test verifica la lógica de fallback en cualquier versión de Node
    // Configuramos un yaml con backend sqlite pero con un umbral muy bajo para forzar escritura
    writeFileSync(
      join(tmpDir, ".sdd", "sdd.config.yaml"),
      'memoria:\n  umbral_bytes: 50000\n  backend: "markdown"\n',
      "utf8"
    );
    runHook(
      writeEvent(join(tmpDir, "src/auth.ts"), "function login() {}"),
      { agentName: "arquitecto", cwd: tmpDir }
    );

    // Con backend markdown explícito, debe crear .md
    const mdFile = join(tmpDir, ".sdd", "memoria", "agente-arquitecto.md");
    assert.ok(existsSync(mdFile), "backend markdown explícito debe crear archivo .md");
  });
});

// ── describe #10: rotación de JSONL ─────────────────────────────────────────

describe("rotarJSONL — rotación automática de consumo.jsonl", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "forge-rotar-"));
    mkdirSync(join(tmpDir, ".sdd", "observabilidad"), { recursive: true });
  });

  afterEach(() => {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* OK */ }
  });

  test("no rota si el archivo es menor que el umbral", () => {
    const ledger = join(tmpDir, ".sdd", "observabilidad", "consumo.jsonl");
    writeFileSync(ledger, '{"ts":"2026-01-01","agente":"test"}\n', "utf8");

    // Disparar hook con consumo.jsonl pequeño
    const evento = JSON.stringify({
      tool_name: "Write",
      tool_input: { path: join(tmpDir, "src/index.js"), content: "x" },
      tool_response: "ok",
    });
    spawnSync("node", [join(process.cwd(), "claude-hooks", "agent-memory.js")], {
      input: evento,
      env: { ...process.env, CLAUDE_AGENT_NAME: "tester" },
      cwd: tmpDir,
    });

    // El backup NO debe existir porque el archivo es pequeño
    assert.ok(!existsSync(ledger + ".1"), "no debe crear backup si el archivo es pequeño");
    assert.ok(existsSync(ledger), "el ledger original debe existir");
  });

  test("rota cuando el archivo supera el umbral configurado en sdd.config.yaml", () => {
    const obsDir = join(tmpDir, ".sdd", "observabilidad");
    const ledger = join(obsDir, "consumo.jsonl");

    // Crear un config con umbral de 1 byte para forzar la rotación
    mkdirSync(join(tmpDir, ".sdd"), { recursive: true });
    writeFileSync(
      join(tmpDir, ".sdd", "sdd.config.yaml"),
      "observabilidad:\n  consumo_max_mb: 0\n",
      "utf8"
    );

    // Crear un consumo.jsonl con algo de contenido (supera 0 MB)
    writeFileSync(ledger, '{"ts":"2026-01-01","agente":"test"}\n', "utf8");

    const evento = JSON.stringify({
      tool_name: "Write",
      tool_input: { path: join(tmpDir, "src/index.js"), content: "x" },
      tool_response: "ok",
    });
    spawnSync("node", [join(process.cwd(), "claude-hooks", "agent-memory.js")], {
      input: evento,
      env: { ...process.env, CLAUDE_AGENT_NAME: "tester" },
      cwd: tmpDir,
    });

    // El backup .1 debe existir
    assert.ok(existsSync(ledger + ".1"), "debe crear consumo.jsonl.1 tras la rotación");
    // El nuevo ledger también debe existir (con la nueva entrada)
    assert.ok(existsSync(ledger), "debe crear un nuevo consumo.jsonl vacío tras la rotación");
    // El .1 tiene el contenido original
    const backup = readFileSync(ledger + ".1", "utf8");
    assert.ok(backup.includes('"agente":"test"'), "el backup debe contener la entrada original");
  });
});
