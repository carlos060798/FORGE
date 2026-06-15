import { test } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';

/**
 * Tests para Phase 2.2 — AST Compressor
 */

const compressorPath = path.join(process.cwd(), 'utils', 'ast-compressor.js');

// Helper: crea archivo temp y comprime
function compressFile(content, ext) {
  const tempFile = `/tmp/test-compress.${ext}`;
  writeFileSync(tempFile, content);

  try {
    const result = execSync(`node ${compressorPath} ${tempFile}`, { encoding: 'utf8' });
    return result.trim();
  } finally {
    try { unlinkSync(tempFile); } catch { }
  }
}

test('2.2.1 — Comprime JavaScript a esqueleto', (t) => {
  const input = `
function add(a, b) {
  // Suma dos números
  const result = a + b;
  console.log('Resultado:', result);
  return result;
}

class Calculator {
  constructor() {
    this.value = 0;
  }

  add(n) {
    this.value += n;
    return this;
  }
}
`;

  const compressed = compressFile(input, 'js');

  // El esqueleto debería conservar firmas
  assert.match(compressed, /function add/, 'Debe conservar firma de función');
  assert.match(compressed, /class Calculator/, 'Debe conservar clase');

  // Debería eliminar cuerpos y comentarios
  assert.doesNotMatch(compressed, /Suma dos números/, 'No debe incluir comentarios');
  assert.doesNotMatch(compressed, /Resultado:/, 'No debe incluir strings de logging');

  // Tamaño debe ser significativamente menor
  assert.ok(compressed.length < input.length / 2, 'Compresión >= 50%');
});

test('2.2.2 — Comprime TypeScript con tipos', (t) => {
  const input = `
interface User {
  id: number;
  name: string;
  email: string;
}

async function fetchUser(userId: number): Promise<User> {
  const response = await fetch(\`/api/users/\${userId}\`);
  const data = await response.json();
  return data as User;
}

export default fetchUser;
`;

  const compressed = compressFile(input, 'ts');

  // Debe conservar interfaz
  assert.match(compressed, /interface User/, 'Debe conservar interface');
  assert.match(compressed, /async function fetchUser/, 'Debe conservar función async');
  assert.match(compressed, /Promise/, 'Debe conservar tipos');

  // No debería incluir detalles de implementación
  assert.doesNotMatch(compressed, /response\.json/, 'No debe incluir cuerpo');
});

test('2.2.3 — Comprime Python a esqueleto', (t) => {
  const input = `
def calculate_tax(amount, rate):
    """Calcula el impuesto sobre una cantidad."""
    tax = amount * rate
    print(f"Tax: {tax}")
    return tax

class TaxCalculator:
    def __init__(self, default_rate=0.2):
        self.rate = default_rate

    def apply(self, amount):
        return calculate_tax(amount, self.rate)
`;

  const compressed = compressFile(input, 'py');

  // Debe conservar definiciones
  assert.match(compressed, /def calculate_tax/, 'Debe conservar función');
  assert.match(compressed, /class TaxCalculator/, 'Debe conservar clase');
  assert.match(compressed, /def __init__/, 'Debe conservar métodos');

  // No debe incluir docstring ni cuerpo
  assert.doesNotMatch(compressed, /Calcula el impuesto/, 'No debe incluir docstring');
  assert.doesNotMatch(compressed, /print/, 'No debe incluir cuerpo');
});

test('2.2.4 — Maneja imports/exports correctamente', (t) => {
  const input = `
import { useState, useEffect } from 'react';
import axios from 'axios';

export const MyComponent = () => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    console.log('Mounted');
  }, []);

  return <div>{count}</div>;
};
`;

  const compressed = compressFile(input, 'jsx');

  // Debe conservar imports/exports
  assert.match(compressed, /import.*react/, 'Debe conservar imports');
  assert.match(compressed, /export/, 'Debe conservar exports');

  // No debe incluir cuerpo de función
  assert.doesNotMatch(compressed, /Mounted/, 'No debe incluir strings de log');
});

test('2.2.5 — Reduce tokens significativamente en archivo grande', (t) => {
  // Simula un archivo de ~500 líneas
  let largeCode = '';
  for (let i = 0; i < 20; i++) {
    largeCode += `
function func${i}(param1: string, param2: number): boolean {
  const temp = param1 + param2;
  const result = temp > 100;
  console.log('Processing:', result);
  // Muchas líneas de implementación
  if (result) {
    for (let j = 0; j < 100; j++) {
      console.log(j);
    }
  }
  return result;
}
`;
  }

  const compressed = compressFile(largeCode, 'ts');
  const reduction = (1 - compressed.length / largeCode.length) * 100;

  assert.ok(reduction > 60, `Debe reducir >60%, obtuvo ${reduction.toFixed(1)}%`);
});

test('2.2.6 — Maneja archivo vacío sin error', (t) => {
  const compressed = compressFile('', 'js');
  assert.strictEqual(compressed, '', 'Archivo vacío debe devolver vacío');
});

test('2.2.7 — Desconoce tipos de archivo desconocidos (pass-through)', (t) => {
  const input = 'ALGÚN CONTENIDO ARBITRARIO\nQUE NO ES CÓDIGO';
  const compressed = compressFile(input, 'txt');

  // Debe devolver el contenido sin cambios (desconocido)
  assert.strictEqual(compressed.trim(), input.trim(), 'Tipos desconocidos pasan sin comprimir');
});

test('2.2.8 — Conserva múltiples definiciones en el mismo archivo', (t) => {
  const input = `
export function add(a, b) { return a + b; }
export function subtract(a, b) { return a - b; }
export function multiply(a, b) { return a * b; }
export const divide = (a, b) => a / b;
export class Math { static PI = 3.14; }
`;

  const compressed = compressFile(input, 'js');

  // Debe listar todas las funciones
  assert.match(compressed, /function add/, 'Debe incluir add');
  assert.match(compressed, /function subtract/, 'Debe incluir subtract');
  assert.match(compressed, /multiply/, 'Debe incluir multiply');
  assert.match(compressed, /divide/, 'Debe incluir divide');
  assert.match(compressed, /class Math/, 'Debe incluir clase');
});
