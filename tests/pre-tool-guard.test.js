// @ts-check
/**
 * Tests para pre-tool-guard.js — Hook PreToolUse
 *
 * Verifica:
 *  1. Bloqueo de comandos destructivos (PROHIBIDOS)
 *  2. Detección de secrets hardcodeados
 *  3. Advertencias (exit 0 con stderr)
 *  4. Permisos por agente (read-only enforcement) — actualmente dead code
 *  5. Pass-through de tools no-Bash (Write, Edit)
 *
 * Nota: el hook se prueba como proceso hijo via child_process.spawnSync
 * para respetar el protocolo stdin/exit code de Claude Code hooks.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const HOOK = join(__dir, "../claude-hooks/pre-tool-guard.js");

/**
 * Ejecuta el hook con el evento dado y devuelve { exitCode, stderr, stdout }
 */
function runHook(event, env = {}) {
  const result = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify(event),
    encoding: "utf8",
    env: { ...process.env, ...env },
    timeout: 5000,
  });
  return {
    exitCode: result.status ?? -1,
    stderr: result.stderr ?? "",
    stdout: result.stdout ?? "",
  };
}

function bashEvent(cmd, agentName = "") {
  return {
    tool_name: "Bash",
    tool_input: { command: cmd },
    ...(agentName ? { agent_name: agentName } : {}),
  };
}

function writeEvent(filePath, content = "", agentName = "") {
  return {
    tool_name: "Write",
    tool_input: { file_path: filePath, content },
    ...(agentName ? { agent_name: agentName } : {}),
  };
}

// ── 1. Comandos destructivos bloqueados ─────────────────────────────────────

describe("pre-tool-guard — comandos destructivos", () => {
  test("bloquea rm -rf /", () => {
    const r = runHook(bashEvent("rm -rf /"));
    assert.equal(r.exitCode, 2, "debe salir con código 2");
    assert.ok(r.stderr.length > 0, "debe escribir mensaje a stderr");
  });

  test("bloquea rm -rf ~", () => {
    const r = runHook(bashEvent("rm -rf ~"));
    assert.equal(r.exitCode, 2);
  });

  test("bloquea rm -rf . (directorio actual)", () => {
    const r = runHook(bashEvent("rm -rf ."));
    assert.equal(r.exitCode, 2);
  });

  test("bloquea git push --force (sin -with-lease)", () => {
    const r = runHook(bashEvent("git push origin main --force"));
    assert.equal(r.exitCode, 2);
  });

  test("permite git push --force-with-lease", () => {
    const r = runHook(bashEvent("git push origin main --force-with-lease"));
    assert.equal(r.exitCode, 0, "force-with-lease es seguro, debe pasar");
  });

  test("bloquea git push -f", () => {
    const r = runHook(bashEvent("git push -f origin main"));
    assert.equal(r.exitCode, 2);
  });

  test("bloquea git reset --hard", () => {
    const r = runHook(bashEvent("git reset --hard HEAD~3"));
    assert.equal(r.exitCode, 2);
  });

  test("bloquea DROP DATABASE", () => {
    const r = runHook(bashEvent("psql -c 'DROP DATABASE produccion'"));
    assert.equal(r.exitCode, 2);
  });

  test("bloquea DROP SCHEMA", () => {
    const r = runHook(bashEvent("psql -c 'DROP SCHEMA public CASCADE'"));
    assert.equal(r.exitCode, 2);
  });

  test("no bloquea rm -rf en subdirectorio normal", () => {
    const r = runHook(bashEvent("rm -rf ./node_modules/temporal-fix"));
    assert.equal(r.exitCode, 0, "borrar subdirectorio específico debe pasar");
  });

  test("no bloquea git reset --soft", () => {
    const r = runHook(bashEvent("git reset --soft HEAD~1"));
    assert.equal(r.exitCode, 0, "reset --soft no destruye historial");
  });
});

// ── 2. Detección de secrets ─────────────────────────────────────────────────

describe("pre-tool-guard — detección de secrets", () => {
  test("bloquea OpenAI key en comando", () => {
    const r = runHook(bashEvent("curl -H 'Authorization: sk-abcdefghij1234567890abcdefghij12'"));
    assert.equal(r.exitCode, 2);
    assert.ok(r.stderr.includes("secret") || r.stderr.includes("clave") || r.stderr.includes("contraseña"),
      "mensaje debe mencionar el problema de secret");
  });

  test("bloquea GitHub PAT en comando", () => {
    // PAT de GitHub: ghp_ + exactamente 36 chars alfanuméricos
    const r = runHook(bashEvent("git clone https://ghp_abcdefghijklmnopqrstuvwxyz1234567890@github.com/user/repo"));
    assert.equal(r.exitCode, 2);
  });

  test("bloquea AWS Access Key en comando", () => {
    const r = runHook(bashEvent("AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE aws s3 ls"));
    assert.equal(r.exitCode, 2);
  });

  test("bloquea password= con valor literal en comando", () => {
    const r = runHook(bashEvent("psql -c \"UPDATE users SET password='MiPassword123'\""));
    assert.equal(r.exitCode, 2);
  });

  test("bloquea RSA private key en comando", () => {
    const r = runHook(bashEvent("echo '-----BEGIN RSA PRIVATE KEY-----' > key.pem"));
    assert.equal(r.exitCode, 2);
  });

  test("no bloquea variable de entorno referenciada (no literal)", () => {
    const r = runHook(bashEvent("curl -H \"Authorization: Bearer $API_TOKEN\" https://api.example.com"));
    assert.equal(r.exitCode, 0, "usar variable de entorno es seguro");
  });

  test("no bloquea token= con valor corto (podría ser ID legítimo)", () => {
    const r = runHook(bashEvent("git config user.token 'abc'")); // < 10 chars
    assert.equal(r.exitCode, 0, "valores cortos no son secrets");
  });
});

// ── 3. Advertencias (exit 0, stderr no vacío) ───────────────────────────────

describe("pre-tool-guard — advertencias", () => {
  test("advierte git push (no bloquea)", () => {
    const r = runHook(bashEvent("git push origin feature-branch"));
    assert.equal(r.exitCode, 0, "advertencia no bloquea");
    assert.ok(r.stderr.length > 0, "debe emitir advertencia a stderr");
    assert.ok(r.stderr.includes("Atención") || r.stderr.includes("push"),
      "stderr debe mencionar el riesgo");
  });

  test("advierte DROP TABLE (no bloquea)", () => {
    const r = runHook(bashEvent("psql -c 'DROP TABLE temporal_test'"));
    assert.equal(r.exitCode, 0);
    assert.ok(r.stderr.length > 0);
  });

  test("advierte terraform apply (no bloquea)", () => {
    const r = runHook(bashEvent("terraform apply -auto-approve"));
    assert.equal(r.exitCode, 0);
    assert.ok(r.stderr.length > 0);
  });

  test("advierte npm publish (no bloquea)", () => {
    const r = runHook(bashEvent("npm publish --access public"));
    assert.equal(r.exitCode, 0);
    assert.ok(r.stderr.length > 0);
  });
});

// ── 4. Pass-through de tools no-Bash ────────────────────────────────────────

describe("pre-tool-guard — pass-through de herramientas no-Bash", () => {
  test("Write tool sin agente ni secrets: exit 0 (permitido)", () => {
    const r = runHook(writeEvent("/ruta/archivo.txt", "contenido normal sin secretos"));
    assert.equal(r.exitCode, 0,
      "Write sin agente read-only y sin secrets debe pasar");
  });

  test("JSON inválido como input: exit 0 (no bloquear por error del hook)", () => {
    const result = spawnSync(process.execPath, [HOOK], {
      input: "esto no es JSON",
      encoding: "utf8",
      timeout: 5000,
    });
    assert.equal(result.status, 0, "JSON inválido debe pasar sin bloquear");
  });

  test("input vacío: exit 0", () => {
    const result = spawnSync(process.execPath, [HOOK], {
      input: "",
      encoding: "utf8",
      timeout: 5000,
    });
    assert.equal(result.status, 0);
  });
});

// ── 5. Permisos por agente (fix T-02 aplicado) ──────────────────────────────

describe("pre-tool-guard — permisos por agente", () => {
  test("agente arquitecto bloqueado al intentar Write", () => {
    const r = runHook(
      writeEvent("/proyecto/src/nuevo.ts", "código"),
      { CLAUDE_AGENT_NAME: "arquitecto" }
    );
    assert.equal(r.exitCode, 2, "arquitecto es read-only, Write debe ser bloqueado");
    assert.ok(r.stderr.includes("FORGE") || r.stderr.includes("agente"),
      "stderr debe explicar el motivo del bloqueo");
  });

  test("agente critico bloqueado al intentar Write", () => {
    const r = runHook(
      writeEvent("/proyecto/README.md", "texto"),
      { CLAUDE_AGENT_NAME: "critico" }
    );
    assert.equal(r.exitCode, 2);
  });

  test("agente asesor-datos bloqueado al intentar Write", () => {
    const r = runHook(
      writeEvent("/proyecto/schema.sql", "CREATE TABLE"),
      { CLAUDE_AGENT_NAME: "asesor-datos" }
    );
    assert.equal(r.exitCode, 2);
  });

  test("agente desarrollador-backend puede hacer Write (no es read-only)", () => {
    const r = runHook(
      writeEvent("/proyecto/src/service.ts", "export class AuthService {}"),
      { CLAUDE_AGENT_NAME: "desarrollador-backend" }
    );
    assert.equal(r.exitCode, 0, "desarrollador-backend puede escribir");
  });

  test("sin agente definido: Write permitido", () => {
    const r = runHook(writeEvent("/proyecto/archivo.ts", "código"));
    assert.equal(r.exitCode, 0, "sin nombre de agente: permitir Write");
  });

  test("Bash permitido para agentes read-only (solo Write/Edit bloqueados)", () => {
    const r = runHook(
      bashEvent("cat package.json"),
      { CLAUDE_AGENT_NAME: "arquitecto" }
    );
    assert.equal(r.exitCode, 0, "Bash de lectura siempre se permite incluso para read-only");
  });

  test("secret en contenido de Write: bloqueado", () => {
    const contenidoConSecret = `
const config = {
  apiKey: 'sk-abcdefghijklmnopqrst12345678901234',
  endpoint: 'https://api.example.com'
};`;
    const r = runHook(
      writeEvent("/proyecto/config.ts", contenidoConSecret),
      { CLAUDE_AGENT_NAME: "desarrollador-backend" }
    );
    assert.equal(r.exitCode, 2, "contenido con secret debe ser bloqueado");
    assert.ok(
      r.stderr.includes("secret") || r.stderr.includes("clave") || r.stderr.includes("contraseña"),
      "mensaje debe mencionar el problema"
    );
  });
});

// ── 6. Auditoría JSONL ──────────────────────────────────────────────────────

describe("pre-tool-guard — auditoría de agentes", () => {
  test("comando Bash normal pasa sin bloquear ni dejar stderr relevante", () => {
    const r = runHook(bashEvent("ls -la src/"));
    assert.equal(r.exitCode, 0);
    // No debe emitir advertencias para comandos normales
    const lineasSterrr = r.stderr.split("\n").filter(l => l.includes("Atención") || l.includes("FORGE evitó"));
    assert.equal(lineasSterrr.length, 0, "ls no debe generar advertencias de seguridad");
  });

  test("PowerShell también es interceptado (no solo Bash)", () => {
    const r = runHook({
      tool_name: "PowerShell",
      tool_input: { command: "git push --force origin main" },
    });
    assert.equal(r.exitCode, 2, "PowerShell con push --force también debe ser bloqueado");
  });
});
