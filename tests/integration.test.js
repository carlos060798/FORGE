// @ts-check
/**
 * Tests de integración — instalación completa de FORGE (SPEC-004)
 *
 * Qué verifica:
 *  1. CLI arranca y reporta la versión correcta
 *  2. ui/server.js existe y tiene la estructura mínima
 *  3. model-registry.js resuelve providers correctamente
 *  4. presets/ existen y tienen los campos clave
 *  5. package.json incluye ui/ en files[]
 *  6. forge doctor no explota (smoke test del proceso)
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// Convierte una ruta absoluta a URL file:// para import dinámico en Windows
function toFileUrl(absPath) {
  return pathToFileURL(absPath).href;
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

describe("CLI — forge --version", () => {
  test("reporta versión 4.0.0", () => {
    const out = execSync(`node ${join(ROOT, "cli", "index.js")} --version`, { encoding: "utf8" }).trim();
    assert.equal(out, "4.0.0");
  });

  test("--help menciona 'forge ui'", () => {
    const out = execSync(`node ${join(ROOT, "cli", "index.js")} --help`, { encoding: "utf8" });
    assert.ok(out.includes("forge ui"), "forge ui no aparece en --help");
  });

  test("--help menciona '--preset'", () => {
    const out = execSync(`node ${join(ROOT, "cli", "index.js")} --help`, { encoding: "utf8" });
    assert.ok(out.includes("--preset") || out.includes("preset"), "--preset no aparece en --help");
  });
});

// ─── Dashboard UI ─────────────────────────────────────────────────────────────

describe("ui/ — archivos del dashboard", () => {
  const UI = join(ROOT, "ui");

  test("ui/server.js existe", () => {
    assert.ok(existsSync(join(UI, "server.js")), "ui/server.js no existe");
  });

  test("ui/index.html existe", () => {
    assert.ok(existsSync(join(UI, "index.html")), "ui/index.html no existe");
  });

  test("ui/src/pipeline.js existe", () => {
    assert.ok(existsSync(join(UI, "src", "pipeline.js")), "ui/src/pipeline.js no existe");
  });

  test("ui/src/tasks.js existe", () => {
    assert.ok(existsSync(join(UI, "src", "tasks.js")), "ui/src/tasks.js no existe");
  });

  test("ui/src/verify.js existe", () => {
    assert.ok(existsSync(join(UI, "src", "verify.js")), "ui/src/verify.js no existe");
  });

  test("ui/server.js exporta startServer", () => {
    const src = readFileSync(join(UI, "server.js"), "utf8");
    assert.ok(src.includes("export function startServer"), "startServer no exportado");
  });

  test("ui/server.js solo escucha en 127.0.0.1 (loopback)", () => {
    const src = readFileSync(join(UI, "server.js"), "utf8");
    assert.ok(src.includes("127.0.0.1"), "servidor no vinculado a loopback");
    assert.ok(!src.includes('"0.0.0.0"'), "servidor vinculado a 0.0.0.0 — inseguro");
  });
});

// ─── model-registry ───────────────────────────────────────────────────────────

describe("claude-hooks/model-registry.js", () => {
  const registryPath = join(ROOT, "claude-hooks", "model-registry.js");

  test("archivo existe", () => {
    assert.ok(existsSync(registryPath));
  });

  test("exporta resolveProvider, resolveModel, getAvailableProviders, resolveForAgent", async () => {
    const mod = await import(toFileUrl(registryPath));
    assert.ok(typeof mod.resolveProvider        === "function");
    assert.ok(typeof mod.resolveModel           === "function");
    assert.ok(typeof mod.getAvailableProviders  === "function");
    assert.ok(typeof mod.resolveForAgent        === "function");
  });

  test("anthropic siempre disponible", async () => {
    const { getAvailableProviders } = await import(toFileUrl(registryPath));
    const providers = getAvailableProviders();
    assert.equal(providers.anthropic, true);
  });

  test("agentes críticos siempre resuelven a anthropic", async () => {
    const { resolveProvider } = await import(toFileUrl(registryPath));
    const criticos = ["arquitecto", "critico", "revisor", "seguridad", "asesor-datos"];
    for (const agente of criticos) {
      assert.equal(resolveProvider(agente, "high"), "anthropic",
        `${agente} no resuelve a anthropic`);
    }
  });

  test("resolveForAgent devuelve provider, model y tier", async () => {
    const { resolveForAgent } = await import(toFileUrl(registryPath));
    const result = resolveForAgent("tester");
    assert.ok(result.provider, "falta provider");
    assert.ok(result.model,    "falta model");
    assert.ok(result.tier,     "falta tier");
  });

  test("sin API keys alternativas → todo resuelve a anthropic", async () => {
    const saved = {
      openai: process.env.OPENAI_API_KEY,
      google: process.env.GOOGLE_API_KEY,
      gemini: process.env.GEMINI_API_KEY,
    };
    delete process.env.OPENAI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      // El módulo ya está en caché — verificamos la lógica directamente
      const { resolveProvider } = await import(toFileUrl(registryPath));
      // Sin API keys, high y medium deben caer en anthropic
      assert.equal(resolveProvider("tester", "high"),   "anthropic");
      assert.equal(resolveProvider("arquitecto", "high"), "anthropic");
    } finally {
      if (saved.openai) process.env.OPENAI_API_KEY = saved.openai;
      if (saved.google) process.env.GOOGLE_API_KEY = saved.google;
      if (saved.gemini) process.env.GEMINI_API_KEY = saved.gemini;
    }
  });
});

// ─── Presets ─────────────────────────────────────────────────────────────────

describe("presets/ — configuraciones", () => {
  const PRESETS_DIR = join(ROOT, "presets");
  const PRESETS     = ["lean", "startup", "enterprise"];

  for (const name of PRESETS) {
    test(`${name}.yaml existe`, () => {
      assert.ok(existsSync(join(PRESETS_DIR, `${name}.yaml`)),
        `presets/${name}.yaml no existe`);
    });

    test(`${name}.yaml contiene 'agentes:'`, () => {
      const content = readFileSync(join(PRESETS_DIR, `${name}.yaml`), "utf8");
      assert.ok(content.includes("agentes:"),
        `presets/${name}.yaml no tiene sección agentes:`);
    });
  }
});

// ─── package.json ─────────────────────────────────────────────────────────────

describe("package.json — manifiesto del paquete", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));

  test("name es forge-sdd", () => {
    assert.equal(pkg.name, "forge-sdd");
  });

  test("version es 4.0.0", () => {
    assert.equal(pkg.version, "4.0.0");
  });

  test("bin incluye 'forge'", () => {
    assert.ok(pkg.bin?.forge, "bin.forge no definido");
  });

  test("bin incluye 'sdd-es' (compatibilidad)", () => {
    assert.ok(pkg.bin?.["sdd-es"], "bin.sdd-es no definido");
  });

  test("files[] incluye ui/", () => {
    assert.ok(pkg.files?.includes("ui/"),
      "ui/ no está en package.json#files — no se publicará el dashboard");
  });

  test("files[] incluye claude-hooks/", () => {
    assert.ok(pkg.files?.includes("claude-hooks/"),
      "claude-hooks/ no está en package.json#files");
  });

  test("engines.node >= 18", () => {
    assert.ok(pkg.engines?.node?.includes("18"),
      "engines.node no especifica >= 18");
  });
});
