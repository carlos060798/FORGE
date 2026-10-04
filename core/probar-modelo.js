/**
 * probar-modelo.js — Prueba mínima del ciclo verificado con un modelo real
 *
 * Crea un proyecto desechable con una tarea trivial (una función `suma` y sus pruebas),
 * lanza `forge run --motor ciclo` con un tope de gasto bajo y resume qué pasó: si el
 * modelo devolvió el formato pedido, cuántas iteraciones hicieron falta y cuánto costó.
 *
 * Es la prueba que falta en la verificación: todo lo demás se probó con respuestas
 * guionizadas. Gasta dinero real si hay una clave de un proveedor de pago.
 */

import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CicloVerificado, sesionActual } from './ciclo/index.js';
import { cola } from './ciclo/redactar.js';

const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'cli', 'index.js');

const TAREA = {
  id: 'T1',
  agente: 'desarrollador-backend',
  prompt: 'Crea src/suma.js con `export const suma = (a, b) => a + b;` y pruebas con node:test en tests/suma.test.js que comprueben suma(1, 2) === 3 y suma(-1, 1) === 0.',
};

/**
 * @param {{ tope?: number, conservar?: boolean, permitirStub?: boolean, timeoutMs?: number, env?: NodeJS.ProcessEnv }} [opciones]
 * @returns {Promise<{ ok: boolean, motivoNoEjecutada?: string, dir?: string, codigoSalida?: number|null, resultado?: string, iteraciones?: number, motivoRevision?: string|null, gasto?: { usd: number, llamadas: number }, tope?: number, salida?: string }>}
 */
export async function probarModelo(opciones = {}) {
  const env = { ...process.env, ...opciones.env };
  const tope = opciones.tope ?? 0.5;
  const proveedor = env.FORGE_LLM_PROVIDER || (env.ANTHROPIC_API_KEY || env.CLAUDE_API_KEY ? 'anthropic' : 'stub');
  if (proveedor === 'stub' && !opciones.permitirStub) {
    return { ok: false, motivoNoEjecutada: 'No hay ningún proveedor de modelos real: define ANTHROPIC_API_KEY (o FORGE_LLM_PROVIDER). Con el proveedor de pruebas no se demuestra nada.' };
  }
  if (!Number.isFinite(tope) || tope <= 0 || tope > 20) {
    return { ok: false, motivoNoEjecutada: 'El tope debe ser un número de dólares entre 0 y 20.' };
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-probar-modelo-'));
  fs.mkdirSync(path.join(dir, '.sdd'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.sdd', 'estado.json'), JSON.stringify({ pipeline_step: 'code' }));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'prueba-modelo', type: 'module', scripts: { test: 'node --test' } }));
  fs.writeFileSync(path.join(dir, 'tareas.json'), JSON.stringify([TAREA]));

  const { codigo, salida } = await new Promise((resolver) => {
    const proc = spawn(process.execPath, [CLI, 'run', '--motor', 'ciclo', '--tasks', 'tareas.json', '--cwd', dir], {
      cwd: dir, env: { ...env, FORGE_BUDGET_USD: String(tope) }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    });
    let texto = '';
    const juntar = (d) => { texto = (texto + d).slice(-64 * 1024); };
    proc.stdout.on('data', juntar);
    proc.stderr.on('data', juntar);
    const reloj = setTimeout(() => { try { proc.kill(); } catch { /* ya termino */ } }, opciones.timeoutMs ?? 15 * 60 * 1000);
    proc.on('error', (e) => { clearTimeout(reloj); resolver({ codigo: null, salida: texto + e.message }); });
    proc.on('close', (c) => { clearTimeout(reloj); resolver({ codigo: c, salida: texto }); });
  });

  /** @type {Awaited<ReturnType<typeof probarModelo>>} */
  const informe = { ok: false, dir, codigoSalida: codigo, tope, salida: cola(salida, 4000) };
  try {
    const sesion = sesionActual(dir);
    if (sesion) {
      const ciclo = new CicloVerificado(/** @type {any} */ ({ cwd: dir, runId: sesion.runId }));
      const t = ciclo.resumen().find((x) => x.taskId === TAREA.id);
      const g = ciclo.libro.total();
      informe.gasto = { usd: Number(g.usd.toFixed(6)), llamadas: g.llamadas };
      if (t) {
        informe.resultado = t.resultado;
        informe.iteraciones = t.iteracion;
        informe.motivoRevision = t.revision && !t.revision.decision ? t.revision.motivo : null;
      }
    }
  } catch { /* sin sesion legible: el informe lleva solo la salida */ }
  informe.ok = informe.resultado === 'exito';

  if (!opciones.conservar) fs.rmSync(dir, { recursive: true, force: true, maxRetries: 2 });
  else informe.dir = dir;
  if (!opciones.conservar) delete informe.dir;
  return informe;
}

/** @param {Awaited<ReturnType<typeof probarModelo>>} i */
export function textoDelInforme(i) {
  if (i.motivoNoEjecutada) return `No se ejecutó: ${i.motivoNoEjecutada}`;
  const lineas = [
    `Resultado: ${i.resultado ?? 'sin sesión (mira la salida)'}${i.motivoRevision ? ` (esperando decisión: ${i.motivoRevision})` : ''}`,
    `Código de salida: ${i.codigoSalida}`,
    `Iteraciones: ${i.iteraciones ?? '—'}`,
    i.gasto ? `Gasto: $${i.gasto.usd.toFixed(4)} en ${i.gasto.llamadas} llamadas (tope $${i.tope?.toFixed(2)})` : 'Gasto: sin datos',
  ];
  if (i.motivoRevision === 'salida_invalida') lineas.push('→ El modelo no devolvió el formato de archivos que el ciclo espera: es el dato más importante de esta prueba.');
  if (i.dir) lineas.push(`Proyecto conservado en: ${i.dir}`);
  if (!i.ok) lineas.push('', 'Salida:', i.salida ?? '');
  return lineas.join('\n');
}
