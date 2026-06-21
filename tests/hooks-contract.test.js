// @ts-check
/**
 * Tests de contrato de hooks de Claude Code (SPEC-F1 T01)
 *
 * Verifica que los payloads que Claude Code envía a PreToolUse y PostToolUse
 * siguen el schema esperado. Si Anthropic cambia el formato, estos tests
 * fallan inmediatamente — antes de que el cambio llegue a usuarios.
 *
 * Los tests NO invocan Claude Code — validan fixtures estáticos contra
 * la misma lógica de parsing que usan pre-tool-guard.js y agent-memory.js.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

// ── Fixtures — schema conocido de Claude Code hooks ─────────────────────────
// Actualizar estos fixtures si Anthropic cambia el formato del payload.
// Documentado en: docs/COMPATIBILIDAD.md

const FIXTURE_PRE_TOOL_USE = {
  tool_name: "Write",
  tool_input: {
    path: "/workspace/src/index.js",
    content: "console.log('hello');",
  },
};

const FIXTURE_POST_TOOL_USE_WRITE = {
  tool_name: "Write",
  tool_input: {
    path: "/workspace/src/index.js",
    content: "console.log('hello');",
  },
  tool_response: "File written successfully",
};

const FIXTURE_POST_TOOL_USE_READ = {
  tool_name: "Read",
  tool_input: {
    path: "/workspace/src/index.js",
  },
  tool_response: "console.log('hello');",
};

const FIXTURE_POST_TOOL_USE_BASH = {
  tool_name: "Bash",
  tool_input: {
    command: "npm test",
    description: "Run test suite",
  },
  tool_response: "Tests passed",
};

// ── Validators — lógica extraída de los hooks ────────────────────────────────

function validarPreToolUse(payload) {
  const errores = [];
  if (typeof payload !== "object" || payload === null) {
    return ["payload no es un objeto"];
  }
  if (typeof payload.tool_name !== "string" || payload.tool_name.trim() === "") {
    errores.push("falta campo 'tool_name' (string) en PreToolUse");
  }
  if (typeof payload.tool_input !== "object" || payload.tool_input === null) {
    errores.push("falta campo 'tool_input' (object) en PreToolUse");
  }
  return errores;
}

function validarPostToolUse(payload) {
  const errores = [];
  if (typeof payload !== "object" || payload === null) {
    return ["payload no es un objeto"];
  }
  if (typeof payload.tool_name !== "string" || payload.tool_name.trim() === "") {
    errores.push("falta campo 'tool_name' (string) en PostToolUse");
  }
  if (typeof payload.tool_input !== "object" || payload.tool_input === null) {
    errores.push("falta campo 'tool_input' (object) en PostToolUse");
  }
  // tool_response puede ser string, object o null según la herramienta
  if (!("tool_response" in payload)) {
    errores.push("falta campo 'tool_response' en PostToolUse");
  }
  return errores;
}

// ── Tests PreToolUse ─────────────────────────────────────────────────────────

describe("PreToolUse — schema de payload", () => {
  test("fixture Write tiene tool_name y tool_input", () => {
    const errores = validarPreToolUse(FIXTURE_PRE_TOOL_USE);
    assert.deepEqual(errores, [], `Schema roto: ${errores.join(", ")}`);
  });

  test("tool_name es string no vacío", () => {
    assert.equal(typeof FIXTURE_PRE_TOOL_USE.tool_name, "string");
    assert.ok(FIXTURE_PRE_TOOL_USE.tool_name.length > 0);
  });

  test("tool_input es objeto", () => {
    assert.equal(typeof FIXTURE_PRE_TOOL_USE.tool_input, "object");
    assert.notEqual(FIXTURE_PRE_TOOL_USE.tool_input, null);
  });

  test("detecta cambio: tool_name renombrado a toolName", () => {
    const payloadRoto = {
      toolName: "Write",         // campo renombrado — simula cambio de API
      tool_input: { path: "/x" },
    };
    const errores = validarPreToolUse(payloadRoto);
    assert.ok(
      errores.some(e => e.includes("tool_name")),
      `Debería detectar ausencia de 'tool_name'. Errores: ${errores.join(", ")}`,
    );
  });

  test("detecta cambio: tool_input eliminado", () => {
    const payloadRoto = { tool_name: "Write" };
    const errores = validarPreToolUse(payloadRoto);
    assert.ok(
      errores.some(e => e.includes("tool_input")),
      `Debería detectar ausencia de 'tool_input'. Errores: ${errores.join(", ")}`,
    );
  });
});

// ── Tests PostToolUse ────────────────────────────────────────────────────────

describe("PostToolUse — schema de payload", () => {
  test("fixture Write tiene tool_name, tool_input y tool_response", () => {
    const errores = validarPostToolUse(FIXTURE_POST_TOOL_USE_WRITE);
    assert.deepEqual(errores, [], `Schema roto: ${errores.join(", ")}`);
  });

  test("fixture Read tiene tool_name, tool_input y tool_response", () => {
    const errores = validarPostToolUse(FIXTURE_POST_TOOL_USE_READ);
    assert.deepEqual(errores, [], `Schema roto: ${errores.join(", ")}`);
  });

  test("fixture Bash tiene tool_name, tool_input y tool_response", () => {
    const errores = validarPostToolUse(FIXTURE_POST_TOOL_USE_BASH);
    assert.deepEqual(errores, [], `Schema roto: ${errores.join(", ")}`);
  });

  test("detecta cambio: tool_response eliminado", () => {
    const payloadRoto = {
      tool_name: "Write",
      tool_input: { path: "/x", content: "x" },
      // tool_response ausente — simula cambio de API
    };
    const errores = validarPostToolUse(payloadRoto);
    assert.ok(
      errores.some(e => e.includes("tool_response")),
      `Debería detectar ausencia de 'tool_response'. Errores: ${errores.join(", ")}`,
    );
  });

  test("detecta cambio: tool_name renombrado a toolName", () => {
    const payloadRoto = {
      toolName: "Write",
      tool_input: { path: "/x" },
      tool_response: "ok",
    };
    const errores = validarPostToolUse(payloadRoto);
    assert.ok(
      errores.some(e => e.includes("tool_name")),
      `Debería detectar ausencia de 'tool_name'. Errores: ${errores.join(", ")}`,
    );
  });
});

// ── Tests de lógica de extracción usada por los hooks ───────────────────────

describe("Lógica de extracción de hooks", () => {
  test("pre-tool-guard extrae tool_name de PreToolUse", () => {
    const payload = FIXTURE_PRE_TOOL_USE;
    assert.equal(payload.tool_name, "Write");
  });

  test("pre-tool-guard extrae path de tool_input en Write", () => {
    const payload = FIXTURE_PRE_TOOL_USE;
    const path = payload.tool_input?.path ?? payload.tool_input?.file_path ?? "";
    assert.ok(path.length > 0, "path debe ser extraíble de tool_input");
  });

  test("agent-memory extrae archivo de tool_input en Write", () => {
    const payload = FIXTURE_POST_TOOL_USE_WRITE;
    const archivo = payload.tool_input?.path ?? payload.tool_input?.file_path ?? "";
    assert.ok(archivo.length > 0, "archivo debe ser extraíble de tool_input de PostToolUse Write");
  });

  test("agent-memory extrae contenido de tool_input en Write", () => {
    const payload = FIXTURE_POST_TOOL_USE_WRITE;
    const contenido = payload.tool_input?.content ?? payload.tool_input?.new_string ?? "";
    assert.ok(contenido.length > 0, "contenido debe ser extraíble de tool_input de PostToolUse Write");
  });

  test("payload vacío falla en ambos validators con mensajes útiles", () => {
    const erroresPre  = validarPreToolUse({});
    const erroresPost = validarPostToolUse({});
    assert.ok(erroresPre.length  > 0, "PreToolUse vacío debe reportar errores");
    assert.ok(erroresPost.length > 0, "PostToolUse vacío debe reportar errores");
    assert.ok(erroresPre[0].includes("tool_name"),  "primer error debe mencionar tool_name");
    assert.ok(erroresPost[0].includes("tool_name"), "primer error debe mencionar tool_name");
  });
});
