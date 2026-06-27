/**
 * checkpoint.js — Gestión de checkpoints de ejecución de tareas
 *
 * Uso desde CLI:
 *   node core/checkpoint.js read  <estado-tareas.json>
 *   node core/checkpoint.js write <estado-tareas.json> <tarea-id>
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * @typedef {Object} EstadoTareas
 * @property {string} [ultima_tarea_completada]
 * @property {string} [ultimo_checkpoint_ts]
 * @property {Record<string, { estado: string, motivo_bloqueo?: string }>} [tareas]
 */

/**
 * @param {string} estadoTareasPath
 * @returns {{ ultimaTarea: string|null, ts: string|null }}
 */
export function readCheckpoint(estadoTareasPath) {
  try {
    const raw = fs.readFileSync(estadoTareasPath, 'utf8');
    const estado = JSON.parse(raw);
    return {
      ultimaTarea: estado.ultima_tarea_completada ?? null,
      ts: estado.ultimo_checkpoint_ts ?? null,
    };
  } catch {
    return { ultimaTarea: null, ts: null };
  }
}

/**
 * @param {string} estadoTareasPath
 * @param {string} tareaId
 */
export function writeCheckpoint(estadoTareasPath, tareaId) {
  let estado = {};
  try {
    estado = JSON.parse(fs.readFileSync(estadoTareasPath, 'utf8'));
  } catch { /* estado nuevo */ }

  estado.ultima_tarea_completada = tareaId;
  estado.ultimo_checkpoint_ts = new Date().toISOString();

  const tmp = estadoTareasPath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(estado, null, 2));
  fs.renameSync(tmp, estadoTareasPath);
}

/**
 * @param {string} estadoTareasPath
 * @param {string} tareaId
 * @param {'en_progreso'|'completada'|'bloqueada'} nuevoEstado
 * @param {string} [motivoBloqueo]
 */
export function markTaskStatus(estadoTareasPath, tareaId, nuevoEstado, motivoBloqueo) {
  let estado = {};
  try {
    estado = JSON.parse(fs.readFileSync(estadoTareasPath, 'utf8'));
  } catch { /* estado nuevo */ }

  if (!estado.tareas) estado.tareas = {};
  estado.tareas[tareaId] = {
    estado: nuevoEstado,
    ...(motivoBloqueo ? { motivo_bloqueo: motivoBloqueo } : {}),
  };

  if (nuevoEstado === 'completada') {
    estado.ultima_tarea_completada = tareaId;
    estado.ultimo_checkpoint_ts = new Date().toISOString();
  }

  const tmp = estadoTareasPath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(estado, null, 2));
  fs.renameSync(tmp, estadoTareasPath);
}

// ── CLI directo ───────────────────────────────────────────────────────────────

if (process.argv[1] && path.basename(process.argv[1]).startsWith('checkpoint')) {
  const [,, cmd, file, tareaId] = process.argv;
  if (!file) { console.error('Uso: checkpoint.js read|write <archivo> [tarea-id]'); process.exit(1); }

  if (cmd === 'read') {
    const info = readCheckpoint(file);
    if (info.ultimaTarea) {
      console.log(`ultima_tarea=${info.ultimaTarea}`);
      console.log(`ts=${info.ts}`);
    }
  } else if (cmd === 'write' && tareaId) {
    writeCheckpoint(file, tareaId);
  } else {
    console.error('Comando desconocido. Usa: read | write');
    process.exit(1);
  }
}
