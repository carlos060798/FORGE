// @ts-check
/**
 * `fragua doctor` no supone Anthropic ni Claude Code (informe de agnosticismo del 2026-11-24, MEDIO-3 y ALTO-2).
 * Criterios: CA-003-07 de la spec 2026-11-11-guardian-fuera-de-claude-code y CA-002-04 y CA-002-05 de la spec
 * 2026-11-12-proveedor-no-fijado.
 *  - el proveedor por defecto sale de la misma detección que usa el motor, no de «anthropic»;
 *  - el `modelo:` del proyecto se valida con los niveles y las tablas de precios, solo en la clave `modelo:` (no en
 *    `embeddings_modelo:`), y la instalación nueva no da un aviso falso;
 *  - el aviso de `CLAUDE_AGENT_NAME` es de Claude Code: en otra herramienta se dice que las guardias de solo lectura no corren;
 *  - con hooks registrados se comprueba el archivo de hooks, no solo que `fragua` esté en el PATH.
 * Sin red ni claves: el proveedor de las pruebas de CLI es Ollama en un puerto local cerrado.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { modelosInvalidos } from "../cli/comandos/doctor.js";
import { ordenDeGuardian, PLANTILLAS_HOOKS } from "../core/instalacion/hooks-anfitrion.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(ROOT, "cli", "index.js");
const EJEMPLO = readFileSync(join(ROOT, "configuracion-ejemplo", "sdd.config.yaml"), "utf8");
const SEÑALES = ["ANTHROPIC_API_KEY", "CLAUDE_API_KEY", "OPENAI_API_KEY", "OLLAMA_BASE_URL", "FORGE_LLM_PROVIDER", "FRAGUA_LLM_PROVIDER", "CLAUDE_AGENT_NAME", "FRAGUA_AGENTE", "FORGE_AGENTE"];

/**
 * Ejecuta `fragua doctor` en un proyecto temporal.
 * @param {{ yaml?: string, archivos?: Record<string,string>, env?: Record<string,string> }} [o]
 */
function doctor({ yaml = EJEMPLO, archivos = {}, env = {} } = {}) {
  const cwd = realpathSync(mkdtempSync(join(tmpdir(), "forge-docagn-")));
  const home = realpathSync(mkdtempSync(join(tmpdir(), "forge-docagn-home-")));
  try {
    mkdirSync(join(cwd, ".sdd"), { recursive: true });
    writeFileSync(join(cwd, ".sdd", "sdd.config.yaml"), yaml);
    for (const [ruta, contenido] of Object.entries(archivos)) {
      mkdirSync(dirname(join(cwd, ruta)), { recursive: true });
      writeFileSync(join(cwd, ruta), contenido);
    }
    const e = { ...process.env, HOME: home, USERPROFILE: home };
    for (const v of SEÑALES) delete e[v];
    const r = spawnSync(process.execPath, [CLI, "doctor"], { cwd, env: { ...e, ...env }, encoding: "utf8", timeout: 100_000 });
    return (r.stdout ?? "") + (r.stderr ?? "");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
}

/** Un `instalacion:` guardado para una integración, con o sin hooks. */
const instalacion = (clave, conHooks) => `${EJEMPLO}\ninstalacion:\n  integracion: "${clave}"\n  perfil: "esencial"\n${conHooks ? "  con_hooks: true\n" : ""}`;
// Ollama en un puerto local cerrado: se detecta como proveedor sin necesitar clave y el ping falla al instante, sin red
const OLLAMA_CERRADO = { OLLAMA_BASE_URL: "http://127.0.0.1:1" };

describe("modelosInvalidos: el modelo: del proyecto se valida con los niveles y las tablas de precios", () => {
  const con = (valor) => `agentes:\n  arquitecto:\n    modelo: ${valor}\n`;
  test("niveles neutrales, alias heredados y modelos de cualquier proveedor son válidos", () => {
    for (const v of ["alto", "medio", "economico", "opus", "sonnet", "haiku", "gpt-4.1", "gpt-4o", "claude-sonnet-4-6", "claude-opus-4-8", "claude-haiku-4-5-20251001"]) {
      assert.deepEqual(modelosInvalidos(con(v)), [], v);
    }
  });
  test("comillas y comentarios al final no cuentan", () => {
    assert.deepEqual(modelosInvalidos(con(`"sonnet"  # nota`)), []);
    assert.deepEqual(modelosInvalidos(con(`'alto'`)), []);
    assert.deepEqual(modelosInvalidos(con(`economico   # el más barato`)), []);
  });
  test("lo que no es un nivel ni está en ninguna tabla se lista, una vez cada uno y en orden", () => {
    assert.deepEqual(modelosInvalidos(con("sonet")), ["sonet"]);
    assert.deepEqual(modelosInvalidos("agentes:\n  a:\n    modelo: sonet\n  b:\n    modelo: alto\n  c:\n    modelo: gpt-9000\n  d:\n    modelo: sonet\n"), ["sonet", "gpt-9000"]);
  });
  test("solo cuenta la clave `modelo:`: `embeddings_modelo`, `modelos:`, comentarios y valores vacíos no", () => {
    assert.deepEqual(modelosInvalidos("memoria:\n  embeddings_modelo: nomic-embed-text\n"), []);
    assert.deepEqual(modelosInvalidos("modelos:\n  opus: claude-opus-4-8\n  raro: lo-que-sea\n"), []);
    assert.deepEqual(modelosInvalidos("# modelo: inventado\n"), []);
    assert.deepEqual(modelosInvalidos("agentes:\n  a:\n    modelo:\n"), []);
    assert.deepEqual(modelosInvalidos("agentes:\n  a:\n    modelo:   \n"), []);
  });
  test("la configuración de ejemplo que instala `init` no da ningún aviso (antes: «nomic-embed-text»)", () => {
    assert.deepEqual(modelosInvalidos(EJEMPLO), []);
  });
});

describe("doctor por la CLI", () => {
  test("una instalación nueva no avisa de modelos desconocidos", () => {
    const s = doctor();
    assert.doesNotMatch(s, /modelo desconocido/);
    assert.match(s, /modelos válidos ✓/);
  });
  test("un modelo mal escrito se avisa, con los niveles válidos, y cuenta como problema", () => {
    const s = doctor({ yaml: EJEMPLO.replace(/modelo: sonnet/, "modelo: sonet") });
    assert.match(s, /modelo desconocido "sonet"/);
    assert.match(s, /alto \| medio \| economico/);
  });
  test("un nivel neutral o un modelo de OpenAI en el proyecto no se avisan", () => {
    const s = doctor({ yaml: EJEMPLO.replace(/modelo: sonnet/, "modelo: alto").replace(/modelo: opus/, "modelo: gpt-4.1") });
    assert.doesNotMatch(s, /modelo desconocido/);
  });

  test("sin ninguna señal de proveedor, el comportamiento de siempre: Anthropic y su clave", () => {
    assert.match(doctor(), /ANTHROPIC_API_KEY no está definida/);
  });
  test("solo OLLAMA_BASE_URL: el proveedor es Ollama y no se pide la clave de Anthropic", () => {
    const s = doctor({ env: OLLAMA_CERRADO });
    assert.doesNotMatch(s, /ANTHROPIC_API_KEY no está definida/);
    assert.match(s, /ollama/i);
  });

  test("fuera de Claude Code no se manda «actualizar Claude Code» y se dice que las guardias de solo lectura no corren", () => {
    const s = doctor({ yaml: instalacion("codex", false) });
    assert.doesNotMatch(s, /actualiza Claude Code/);
    assert.match(s, /FRAGUA_AGENTE/);
    assert.match(s, /solo lectura/);
  });
  test("con Claude Code (sin integración guardada) el aviso de CLAUDE_AGENT_NAME sigue", () => {
    assert.match(doctor(), /CLAUDE_AGENT_NAME no encontrada/);
  });
});

describe("doctor comprueba el archivo de hooks cuando la instalación los registró", () => {
  const ruta = PLANTILLAS_HOOKS.codex.ruta;
  const orden = ordenDeGuardian("codex");
  test("el archivo contiene la orden del guardián: se confirma", () => {
    const s = doctor({ yaml: instalacion("codex", true), archivos: { [ruta]: JSON.stringify({ hooks: { PreToolUse: [{ hooks: [{ type: "command", command: orden }] }] } }) } });
    assert.match(s, new RegExp(`${ruta.replace(".", "\\.")}.*orden del guardián ✓`));
  });
  test("el archivo no existe: se avisa y se dice cómo repetir la instalación", () => {
    const s = doctor({ yaml: instalacion("codex", true) });
    assert.match(s, new RegExp(`falta ${ruta.replace(".", "\\.")}`));
    assert.match(s, /--integracion codex --con-hooks/);
  });
  test("el archivo existe pero sin la orden (init no pisa uno ajeno): se avisa de añadirla a mano", () => {
    const s = doctor({ yaml: instalacion("codex", true), archivos: { [ruta]: "{}" } });
    assert.match(s, /no contiene la orden del guardián/);
    assert.match(s, /fragua guardian evaluar --anfitrion codex/);
  });
  test("sin hooks registrados no se comprueba ningún archivo de hooks", () => {
    const s = doctor({ yaml: instalacion("codex", false) });
    assert.doesNotMatch(s, /orden del guardián/);
    assert.doesNotMatch(s, new RegExp(`falta ${ruta.replace(".", "\\.")}`));
  });
  test("una herramienta sin adaptador de hook (kiro) con con_hooks no inventa un archivo", () => {
    const s = doctor({ yaml: instalacion("kiro", true) });
    assert.doesNotMatch(s, /orden del guardián/);
  });
});
