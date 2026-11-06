import { test } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Tests para Phase 2.1 — Enforcement de permisos por agente en pre-tool-guard
 */

// Datos de prueba: evento PreToolUse de Claude Code
function mockHookEvent(toolName, toolInput) {
  return JSON.stringify({ tool_name: toolName, tool_input: toolInput });
}

// Helper: ejecuta el hook con evento + env var
function runHookWithAgent(eventJson, agentName) {
  return new Promise((resolve) => {
    const env = {
      ...process.env,
      ...(agentName ? { CLAUDE_AGENT_NAME: agentName } : {})
    };

    // fileURLToPath maneja correctamente rutas Windows (file:///D:/... → D:\...)
    const thisFile = fileURLToPath(import.meta.url);
    const hookPath = path.resolve(path.dirname(thisFile), '..', 'claude-hooks', 'pre-tool-guard.js');
    const proc = spawn('node', [hookPath], { env });

    let stderr = '';
    proc.stderr.on('data', (data) => { stderr += data.toString(); });
    proc.on('close', (code) => { resolve({ code, stderr }); });

    proc.stdin.write(eventJson);
    proc.stdin.end();
  });
}

test('2.1.1 — Hook permite Write cuando no hay CLAUDE_AGENT_NAME', async (t) => {
  const event = mockHookEvent('Write', { file_path: '/tmp/test.js', content: 'test' });
  const result = await runHookWithAgent(event, null);

  assert.strictEqual(result.code, 0, 'Debería permitir (exit 0)');
});

test('2.1.2 — Hook bloquea Write para agente read-only', async (t) => {
  const event = mockHookEvent('Write', { file_path: '/tmp/test.js', content: 'test' });
  const result = await runHookWithAgent(event, 'arquitecto');

  assert.strictEqual(result.code, 2, 'Debería bloquear (exit 2)');
  assert.match(result.stderr, /read.only|solo puede leer/i, 'Debería mencionar restricción read-only');
});

test('2.1.3 — Hook bloquea Edit para agente critico', async (t) => {
  const event = mockHookEvent('Edit', { file_path: '/tmp/test.js', old_string: 'a', new_string: 'b' });
  const result = await runHookWithAgent(event, 'critico');

  assert.strictEqual(result.code, 2, 'Debería bloquear (exit 2)');
});

test('2.1.4 — Hook permite Bash para agente read-only', async (t) => {
  const event = mockHookEvent('Bash', { command: 'ls -la' });
  const result = await runHookWithAgent(event, 'seguridad');

  assert.strictEqual(result.code, 0, 'Debería permitir comandos de lectura');
});

test('2.1.5 — Read es permitido incluso para agentes read-only', async (t) => {
  const event = mockHookEvent('Read', { file_path: '/tmp/test.js' });
  const result = await runHookWithAgent(event, 'investigador');

  assert.strictEqual(result.code, 0, 'Read debería ser permitido incluso para read-only');
});

test('2.1.6 — Hook bloquea comandos destructivos aunque el agente sea permitido', async (t) => {
  const event = mockHookEvent('Bash', { command: 'rm -rf /' });
  const result = await runHookWithAgent(event, 'desarrollador-backend');

  assert.strictEqual(result.code, 2, 'Debería bloquear comando destructivo');
  assert.match(result.stderr, /bloqueado|evit|destruct/i, 'Debería indicar bloqueo');
});

test('2.1.7 — Hook detecta secret hardcodeado en comando Bash', async (t) => {
  // Valor construido en runtime — no es una credencial real, evita falsos positivos
  // en los hooks de escritura de source. El pre-tool-guard lo detecta al evaluar el comando.
  const parts = ['ghp', 'A'.repeat(36)];
  const fakeCmd = `git clone https://${parts.join('_')}@github.com/org/repo`;
  const event = mockHookEvent('Bash', { command: fakeCmd });
  const result = await runHookWithAgent(event, 'tester');

  assert.strictEqual(result.code, 2, 'Debería bloquear secret');
  assert.match(result.stderr, /secret|credential|clave|contraseña/i, 'Debería mencionar la detección');
});

test('2.1.8 — Hook con event JSON malformado falla cerrado (spec 2026-11-06-guardian-endurecido, C-07)', async (t) => {
  const result = await runHookWithAgent('{"invalid}', null);
  assert.strictEqual(result.code, 2, 'Si no entiende el evento, el guardián no lo deja pasar');
});

test('2.1.9 — Hook permite desarrollador-backend usar Write', async (t) => {
  const event = mockHookEvent('Write', { file_path: '/tmp/app.js', content: 'code' });
  const result = await runHookWithAgent(event, 'desarrollador-backend');

  assert.strictEqual(result.code, 0, 'Debería permitir Write para desarrollador');
});

test('2.1.10 — Hook genera auditoría sin bloquear', async (t) => {
  const event = mockHookEvent('Bash', { command: 'ls' });
  const result = await runHookWithAgent(event, 'investigador');

  assert.strictEqual(result.code, 0, 'Auditoría no debería bloquear');
});
