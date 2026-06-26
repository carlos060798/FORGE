// Test manual del flujo event-bus → SessionBudget → CircuitBreaker
import { bus } from '../dist/core/event-bus.js';
import { sessionBudget } from '../dist/core/session-budget.js';
import { circuitBreaker } from '../dist/core/execution-context.js';

console.log('=== Test flujo event-bus ===\n');

// 1. Simular resultado de agente exitoso
await bus.emit('agent:result', {
  agente: 'arquitecto',
  taskId: 'T001',
  tokens_input: 1000,
  tokens_output: 500,
  modelo: 'claude-opus-4-8',
  durationMs: 1200,
  ok: true,
});
console.log('Tras agent:result exitoso:');
console.log(' ', sessionBudget.resumen());
console.log('  Circuit breaker nivel:', circuitBreaker.nivel);

// 2. Simular tarea completada
await bus.emit('task:completed', { taskId: 'T001', agente: 'arquitecto', durationMs: 1200 });
console.log('\nTras task:completed: nivel =', circuitBreaker.nivel, '(debe ser local)');

// 3. Simular 2 fallos consecutivos (umbral default = 2)
await bus.emit('task:failed', { taskId: 'T002', agente: 'tester', error: 'timeout' });
console.log('Tras 1er fallo: nivel =', circuitBreaker.nivel);

await bus.emit('task:failed', { taskId: 'T003', agente: 'tester', error: 'timeout' });
console.log('Tras 2do fallo: nivel =', circuitBreaker.nivel, '(debe ser sandbox)');

// 4. Resumen final
console.log('\n=== Resumen final ===');
console.log(sessionBudget.resumen());
console.log('Nivel circuit breaker:', circuitBreaker.nivel);

// 5. Verificar .sdd/execution-level.json y limpiar estado residual
import { existsSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
const levelFile = join(process.cwd(), '.sdd', 'execution-level.json');
if (existsSync(levelFile)) {
  const data = JSON.parse(readFileSync(levelFile, 'utf8'));
  console.log('execution-level.json:', data);
  // Limpiar estado residual para no afectar hooks del proyecto
  rmSync(levelFile);
  console.log('(archivo eliminado — estado temporal de prueba)');
} else {
  console.log('⚠ execution-level.json no creado');
}
