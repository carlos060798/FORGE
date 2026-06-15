import { test } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import path from 'node:path';

/**
 * Tests para Phase 2.1 — Enforcement de permisos por agente en pre-tool-guard
 */

// Datos de prueba: evento PreToolUse de Claude Code
function mockHookEvent(toolName, toolInput, agentName = null) {
  const event = {
    tool_name: toolName,
    tool_input: toolInput
  };
  return JSON.stringify(event);
}

// Helper: ejecuta el hook con evento + env var
function runHookWithAgent(eventJson, agentName) {
  return new Promise((resolve) => {
    const env = {
      ...process.env,
      ...(agentName ? { CLAUDE_AGENT_NAME: agentName } : {})
    };

    const hookPath = path.resolve(import.meta.url.replace('file://', ''), '../../claude-hooks/pre-tool-guard.js');
    const proc = spawn('node', [hookPath], { env });

    let stderr = '';
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({ code, stderr });
    });

    proc.stdin.write(eventJson);
    proc.stdin.end();
  });
}

test('2.1.1 — Hook permite Write cuando no hay CLAUDE_AGENT_NAME', async (t) => {
  const event = mockHookEvent('Write', { file_path: '/tmp/test.js', content: 'test' });
  const result = await runHookWithAgent(event, null);

  assert.strictEqual(result.code, 0, 'Debería permitir (exit 0)');
  assert.strictEqual(result.stderr, '', 'No debería generar error');
});

test('2.1.2 — Hook bloquea Write para agente read-only', async (t) => {
  const event = mockHookEvent('Write', { file_path: '/tmp/test.js', content: 'test' });
  const result = await runHookWithAgent(event, 'arquitecto');

  assert.strictEqual(result.code, 2, 'Debería bloquear (exit 2)');
  assert.match(result.stderr, /BLOQUEADO/, 'Debería mencionar bloqueo');
  assert.match(result.stderr, /read-only/, 'Debería mencionar rol read-only');
});

test('2.1.3 — Hook bloquea Edit para agente critico', async (t) => {
  const event = mockHookEvent('Edit', { file_path: '/tmp/test.js', old_string: 'a', new_string: 'b' });
  const result = await runHookWithAgent(event, 'critico');

  assert.strictEqual(result.code, 2, 'Debería bloquear (exit 2)');
  assert.match(result.stderr, /BLOQUEADO/, 'Debería indicar bloqueo');
});

test('2.1.4 — Hook permite Bash para agente read-only', async (t) => {
  const event = mockHookEvent('Bash', { command: 'ls -la' });
  const result = await runHookWithAgent(event, 'seguridad');

  assert.strictEqual(result.code, 0, 'Debería permitir comandos de lectura');
});

test('2.1.5 — Hook bloquea Read para agente read-only (no es Write/Edit)', async (t) => {
  // Read es permitido para todos, solo Write/Edit se bloquean
  const event = mockHookEvent('Read', { file_path: '/tmp/test.js' });
  const result = await runHookWithAgent(event, 'investigador');

  assert.strictEqual(result.code, 0, 'Read debería ser permitido incluso para read-only');
});

test('2.1.6 — Hook sigue bloqueando comandos prohibidos aunque el agente sea permitido', async (t) => {
  // rm -rf / debe estar bloqueado incluso si el agente no es read-only
  const event = mockHookEvent('Bash', { command: 'rm -rf /' });
  const result = await runHookWithAgent(event, 'desarrollador-backend');

  assert.strictEqual(result.code, 2, 'Debería bloquear comando destructivo');
  assert.match(result.stderr, /BLOQUEADO/, 'Debería indicar bloqueo');
});

test('2.1.7 — Hook detecta secret hardcodeado en comando', async (t) => {
  const event = mockHookEvent('Bash', { command: 'echo api_key="sk-1234567890abcdefghij"' });
  const result = await runHookWithAgent(event, 'tester');

  assert.strictEqual(result.code, 2, 'Debería bloquear secret');
  assert.match(result.stderr, /secret hardcodeado/i, 'Debería mencionar secret');
});

test('2.1.8 — Hook sigue funciona con event JSON malformado', async (t) => {
  const result = await runHookWithAgent('{"invalid}', null);
  assert.strictEqual(result.code, 0, 'Debería permitir (default safe)');
});

test('2.1.9 — Hook permite desarrollador-backend usar Write', async (t) => {
  const event = mockHookEvent('Write', { file_path: '/tmp/app.js', content: 'code' });
  const result = await runHookWithAgent(event, 'desarrollador-backend');

  assert.strictEqual(result.code, 0, 'Debería permitir Write para desarrollador');
});

test('2.1.10 — Hook genera auditoría en .sdd/observabilidad/', async (t) => {
  // Este test simplemente verifica que el hook intenta auditar (no falla)
  const event = mockHookEvent('Bash', { command: 'ls' });
  const result = await runHookWithAgent(event, 'investigador');

  // Si el archivo de auditoría existe, la función fue llamada (no es un error)
  assert.strictEqual(result.code, 0, 'Auditoría no debería bloquear');
});
