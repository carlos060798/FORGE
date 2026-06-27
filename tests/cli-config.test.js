// @ts-check
/**
 * Tests para cli/index.js — subcomando `config` (B3)
 *
 * Verifica:
 *  1. config show [sección] — muestra yaml o sección
 *  2. config get <clave> — obtiene valor
 *  3. config set <clave> <valor> — modifica y persiste
 *  4. config validate — detecta errores estructurales
 *  5. doctor — verifica hooks en settings.json
 */

import { test, describe, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const __dir = dirname(fileURLToPath(import.meta.url));
const CLI = join(__dir, "../cli/index.js");
const CONFIG_EJEMPLO = join(__dir, "../configuracion-ejemplo/sdd.config.yaml");

const YAML_MINIMO = `
idioma: español
perfil: experto

agentes:
  arquitecto:
    activo: true
    modelo: opus

comportamiento:
  deteccion_tamano_automatica: true

rutas:
  raiz_sdd: ".sdd"

memoria:
  umbral_bytes: 50000

sesion:
  modo: "normal"
  omitir_pasos: []
`.trim();

function runCli(args, cwd) {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    encoding: "utf8",
    cwd,
    timeout: 10000,
  });
  return {
    exitCode: result.status ?? -1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    output: (result.stdout ?? "") + (result.stderr ?? ""),
  };
}

function crearProyectoTest(yaml = YAML_MINIMO) {
  const dir = mkdtempSync(join(tmpdir(), "sdd-cli-test-"));
  mkdirSync(join(dir, ".sdd"), { recursive: true });
  writeFileSync(join(dir, ".sdd", "sdd.config.yaml"), yaml, "utf8");
  return dir;
}

// ── 1. config show ───────────────────────────────────────────────────────────

describe("cli config show", () => {
  let dir;
  beforeEach(() => { dir = crearProyectoTest(); });
  after(() => { try { rmSync(dir, { recursive: true }); } catch { /* */ } });

  test("show sin argumento imprime el yaml completo", () => {
    const r = runCli(["config", "show"], dir);
    assert.equal(r.exitCode, 0);
    assert.ok(r.output.includes("agentes:"), "debe incluir sección agentes");
    assert.ok(r.output.includes("sesion:"), "debe incluir sección sesion");
  });

  test("show [sección] imprime solo esa sección", () => {
    const r = runCli(["config", "show", "sesion"], dir);
    assert.equal(r.exitCode, 0);
    assert.ok(r.output.includes("sesion:"), "debe incluir cabecera de sección");
    assert.ok(r.output.includes("modo:"), "debe incluir la subclave modo");
    assert.ok(!r.output.includes("agentes:"), "NO debe incluir otras secciones");
  });

  test("show sección inexistente avisa", () => {
    const r = runCli(["config", "show", "seccion_que_no_existe"], dir);
    assert.equal(r.exitCode, 0);
    assert.ok(r.output.includes("no encontrada"), "debe indicar que no existe");
  });
});

// ── 2. config get ────────────────────────────────────────────────────────────

describe("cli config get", () => {
  let dir;
  beforeEach(() => { dir = crearProyectoTest(); });
  after(() => { try { rmSync(dir, { recursive: true }); } catch { /* */ } });

  test("get clave de primer nivel", () => {
    const r = runCli(["config", "get", "perfil"], dir);
    assert.equal(r.exitCode, 0);
    assert.ok(r.output.includes("experto"), "debe devolver el valor 'experto'");
  });

  test("get clave de segundo nivel (punto)", () => {
    const r = runCli(["config", "get", "sesion.modo"], dir);
    assert.equal(r.exitCode, 0);
    assert.ok(r.output.includes("normal"), "debe devolver 'normal'");
  });

  test("get clave inexistente avisa", () => {
    const r = runCli(["config", "get", "clave.inexistente"], dir);
    assert.equal(r.exitCode, 0);
    assert.ok(r.output.includes("no encontrada"), "debe avisar que no existe");
  });

  test("get sin clave: error con uso", () => {
    const r = runCli(["config", "get"], dir);
    assert.notEqual(r.exitCode, 0, "debe fallar sin clave");
  });
});

// ── 3. config set ────────────────────────────────────────────────────────────

describe("cli config set", () => {
  let dir;
  beforeEach(() => { dir = crearProyectoTest(); });
  after(() => { try { rmSync(dir, { recursive: true }); } catch { /* */ } });

  test("set modifica clave de segundo nivel y persiste", () => {
    const r = runCli(["config", "set", "sesion.modo", "rapido"], dir);
    assert.equal(r.exitCode, 0);
    assert.ok(r.output.includes("rapido"), "debe confirmar el nuevo valor");

    // Verificar que el archivo fue modificado
    const yaml = readFileSync(join(dir, ".sdd", "sdd.config.yaml"), "utf8");
    assert.ok(yaml.includes("rapido"), "el archivo debe contener el nuevo valor");
    assert.ok(!yaml.includes('"normal"') && !yaml.match(/modo:\s+"normal"/), "el valor viejo no debe estar");
  });

  test("set mismo valor: informa sin cambios", () => {
    const r = runCli(["config", "set", "sesion.modo", "normal"], dir);
    assert.equal(r.exitCode, 0);
    assert.ok(r.output.includes("ya tiene el valor") || r.output.includes("sin cambios"),
      "debe informar que no hay cambios");
  });

  test("set clave inexistente: avisa y sale con error", () => {
    const r = runCli(["config", "set", "seccion.inexistente", "valor"], dir);
    assert.notEqual(r.exitCode, 0, "debe salir con error para clave inexistente");
  });

  test("set memoria.umbral_bytes a número válido", () => {
    const r = runCli(["config", "set", "memoria.umbral_bytes", "40000"], dir);
    assert.equal(r.exitCode, 0);
    const yaml = readFileSync(join(dir, ".sdd", "sdd.config.yaml"), "utf8");
    assert.ok(yaml.includes("40000"), "debe persistir el nuevo umbral");
  });

  test("set sin argumentos suficientes: error con uso", () => {
    const r = runCli(["config", "set", "sesion.modo"], dir);
    assert.notEqual(r.exitCode, 0);
  });
});

// ── 4. config validate ───────────────────────────────────────────────────────

describe("cli config validate", () => {
  let dir;
  after(() => { try { rmSync(dir, { recursive: true }); } catch { /* */ } });

  test("yaml mínimo válido: sin errores", () => {
    dir = crearProyectoTest(YAML_MINIMO);
    const r = runCli(["config", "validate"], dir);
    assert.equal(r.exitCode, 0);
    assert.ok(r.output.includes("válido"), "debe reportar válido");
    assert.ok(!r.output.includes("Falta"), "no debe reportar faltas");
  });

  test("yaml sin sección agentes: detecta error", () => {
    dir = crearProyectoTest("comportamiento:\n  x: 1\nrutas:\n  y: 2\nmemoria:\n  umbral_bytes: 1000\n");
    const r = runCli(["config", "validate"], dir);
    assert.equal(r.exitCode, 0); // validate no hace exit(1), solo avisa
    assert.ok(r.output.includes("agentes"), "debe detectar que falta agentes:");
  });

  test("yaml con modelo inválido: detecta error", () => {
    const yamlMalo = YAML_MINIMO.replace("modelo: opus", "modelo: gpt-4");
    dir = crearProyectoTest(yamlMalo);
    const r = runCli(["config", "validate"], dir);
    assert.ok(r.output.includes("gpt-4") || r.output.includes("desconocido"),
      "debe detectar modelo desconocido");
  });

  test("yaml del ejemplo real: válido", () => {
    dir = crearProyectoTest(readFileSync(CONFIG_EJEMPLO, "utf8"));
    const r = runCli(["config", "validate"], dir);
    assert.equal(r.exitCode, 0);
    assert.ok(r.output.includes("válido"), "el yaml de ejemplo debe ser válido");
  });
});

// ── 5. doctor — verifica hooks ────────────────────────────────────────────────

describe("cli doctor — verificación de hooks", () => {
  let dir;
  after(() => { try { rmSync(dir, { recursive: true }); } catch { /* */ } });

  test("doctor detecta settings.json con hooks correctos", () => {
    dir = crearProyectoTest();
    mkdirSync(join(dir, ".claude", "hooks"), { recursive: true });
    // Crear archivos de hook vacíos (sintaxis válida) para que doctor no los marque como faltantes
    for (const h of ["pre-tool-guard.js", "agent-memory.js", "post-write-conventions.js"]) {
      writeFileSync(join(dir, ".claude", "hooks", h), "// hook\n", "utf8");
    }
    writeFileSync(join(dir, ".claude", "settings.json"), JSON.stringify({
      hooks: {
        PreToolUse: [{ hooks: [{ command: "node claude-hooks/pre-tool-guard.js" }] }],
        PostToolUse: [{ matcher: "Write|Edit", hooks: [{ command: "node claude-hooks/agent-memory.js" }] }],
      }
    }), "utf8");

    const r = runCli(["doctor"], dir);
    assert.equal(r.exitCode, 0);
    assert.ok(
      r.output.includes("pre-tool-guard") && r.output.includes("✓"),
      "debe confirmar pre-tool-guard registrado"
    );
  });

  test("doctor advierte cuando settings.json no tiene hooks", () => {
    dir = crearProyectoTest();
    mkdirSync(join(dir, ".claude"), { recursive: true });
    writeFileSync(join(dir, ".claude", "settings.json"), JSON.stringify({ hooks: {} }), "utf8");

    const r = runCli(["doctor"], dir);
    // exitCode puede ser 1 porque los archivos de hook tampoco existen en el dir temporal
    assert.ok(r.exitCode === 0 || r.exitCode === 1, "debe terminar con código 0 o 1");
    assert.ok(
      r.output.includes("pre-tool-guard") && r.output.includes("NO"),
      "debe advertir que pre-tool-guard no está registrado"
    );
  });

  test("doctor advierte cuando estado.json está malformado", () => {
    dir = crearProyectoTest();
    mkdirSync(join(dir, ".sdd"), { recursive: true });
    writeFileSync(join(dir, ".sdd", "estado.json"), "{ esto no es json válido", "utf8");

    const r = runCli(["doctor"], dir);
    // exitCode puede ser 1 porque los archivos de hook tampoco existen en el dir temporal
    assert.ok(r.exitCode === 0 || r.exitCode === 1, "debe terminar con código 0 o 1");
    assert.ok(
      r.output.includes("estado.json") && (r.output.includes("malformado") || r.output.includes("⚠")),
      "debe advertir que estado.json está malformado"
    );
  });
});
