// @ts-check
/**
 * Proyectos de prueba con una tarea YA TERMINADA del ciclo, para probar la publicación (F3).
 *
 * `proyectoConTarea` construye a mano un punto de guardado con la forma exacta del ciclo
 * (`estadoInicial` + los campos que el ciclo rellena, guardado con `GuardadorArchivos`, que es lo
 * que `CicloVerificado` usa): `.sdd/motor/<runId>/checkpoints/<hilo>/NNNNNN.json` y `sesion.json`.
 * No ejecuta ningún modelo ni ninguna prueba. La prueba de extremo a extremo con el ciclo guionizado
 * real vive en tests/integraciones-flujo.test.js.
 */

import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

import { estadoInicial } from '../../../core/ciclo/estado.js';
import { GuardadorArchivos } from '../../../core/ciclo/checkpoint-archivos.js';

export const sha256 = (/** @type {string} */ t) => createHash('sha256').update(t).digest('hex');

/**
 * @param {Object} [o]
 * @param {Record<string, string>} [o.archivos]   ruta → contenido: se escriben en disco y se registran en el estado
 * @param {Record<string, string>} [o.soloEnDisco] ruta → contenido: en disco, sin registrar en el estado
 * @param {string} [o.taskId]
 * @param {string} [o.runId]
 * @param {'exito'|'aceptada_por_humano'|'revision_pendiente'|'abortada'|'en_curso'} [o.resultado]
 * @param {Record<string, any>} [o.estado]        campos que sustituyen a los del estado
 * @param {string} [o.cwd]
 * @param {boolean} [o.sesion]                    escribir .sdd/motor/sesion.json (por defecto sí)
 */
export function proyectoConTarea(o = {}) {
  const cwd = o.cwd ?? mkdtempSync(join(tmpdir(), 'forge-pub-'));
  const taskId = o.taskId ?? 'T1';
  const runId = o.runId ?? 'run-20261011120000-4242';
  const archivos = o.archivos ?? { 'src/calc.js': 'export const suma = (a, b) => a + b;\n' };
  const escribir = (/** @type {string} */ ruta, /** @type {string} */ contenido) => {
    mkdirSync(dirname(join(cwd, ruta)), { recursive: true });
    writeFileSync(join(cwd, ruta), contenido, 'utf8');
  };
  mkdirSync(join(cwd, '.sdd'), { recursive: true });
  for (const [ruta, contenido] of Object.entries(archivos)) escribir(ruta, contenido);
  for (const [ruta, contenido] of Object.entries(o.soloEnDisco ?? {})) escribir(ruta, contenido);

  const base = estadoInicial(
    { id: taskId, agente: 'desarrollador-backend', prompt: 'Implementa la suma' },
    { runId, cwd, maxIteraciones: 5, tope_usd: 2, umbral_degradacion_usd: 1.5 },
  );
  /** @type {any} */
  const estado = {
    ...base,
    implementacion: { archivos: Object.entries(archivos).map(([ruta, contenido]) => ({ ruta, sha256: sha256(contenido) })) },
    pruebas: { archivos: [{ ruta: 'tests/calc.test.js', sha256: sha256('x') }], comando: 'node --test' },
    ejecuciones: [
      { iteracion: 1, categoria: 'fail', exitCode: 1, timedOut: false, oomKilled: false, durationMs: 120, stdoutCola: 'SALIDA-DE-PRUEBAS-NO-DEBE-SALIR fallo', stderrCola: '' },
      { iteracion: 2, categoria: 'pass', exitCode: 0, timedOut: false, oomKilled: false, durationMs: 90, stdoutCola: 'SALIDA-DE-PRUEBAS-NO-DEBE-SALIR ok', stderrCola: '' },
    ],
    iteracion: 2,
    presupuesto: { tope_usd: 2, umbral_degradacion_usd: 1.5, gastado_usd: 0.0123, estado: 'ok', llamadas: 4, tokens_in: 1200, tokens_out: 340 },
    resultado: o.resultado ?? 'exito',
    ...(o.estado ?? {}),
  };
  if (estado.resultado === 'aceptada_por_humano' && !estado.revision) {
    estado.revision = { motivo: 'iteraciones', reanudarEn: 'implementacion', decision: 'aceptar' };
  }
  if (estado.resultado === 'revision_pendiente' && !estado.revision) {
    estado.revision = { motivo: 'iteraciones', reanudarEn: 'implementacion' };
  }

  const dirMotor = join(cwd, '.sdd', 'motor', runId);
  const g = new GuardadorArchivos(dirMotor);
  g.guardar(`${runId}:${taskId}`, { nodo: 'ejecutar', siguiente: null, estado });
  if (o.sesion !== false) {
    writeFileSync(join(cwd, '.sdd', 'motor', 'sesion.json'), JSON.stringify({ runId, modo: 'ciclo', creada: '2026-10-11T12:00:00.000Z' }), 'utf8');
  }
  return { cwd, runId, taskId, estado, dirMotor };
}

/** Configuración mínima de integraciones en el proyecto. @param {string} cwd @param {string} yaml */
export function escribirConfig(cwd, yaml) {
  mkdirSync(join(cwd, '.sdd'), { recursive: true });
  writeFileSync(join(cwd, '.sdd', 'sdd.config.yaml'), yaml, 'utf8');
}
