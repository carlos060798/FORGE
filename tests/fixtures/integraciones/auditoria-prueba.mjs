// @ts-check
/**
 * Una auditoría de integraciones sobre un directorio temporal, para las pruebas de los adaptadores.
 * Desde la revisión 1 (R5) los adaptadores EXIGEN auditoría para escribir: las pruebas que no ejercitan
 * la auditoría pasan esta, con un tope alto y un interruptor leído de un entorno vacío (no del real).
 */

import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AuditoriaIntegraciones } from '../../../core/integraciones/auditoria.js';

/**
 * @param {{ tope?: number, sesion?: string, env?: Record<string, string|undefined> }} [o]
 * @returns {AuditoriaIntegraciones}
 */
export function auditoriaDePrueba(o = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'forge-aud-'));
  mkdirSync(join(dir, '.sdd'), { recursive: true });
  return new AuditoriaIntegraciones({ cwd: dir, tope: o.tope ?? 1000, sesion: o.sesion ?? 'prueba', env: o.env ?? {} });
}
