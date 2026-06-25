/**
 * checkpoint.ts — Gestión de checkpoints de ejecución de tareas
 *
 * Reemplaza los bloques `node -e "...JSON.parse...writeFileSync..."`
 * embebidos en sdd.implementar.md (pasos 5.8 y PASO 1).
 *
 * Uso desde CLI:
 *   node core/checkpoint.js read  <estado-tareas.json>
 *   node core/checkpoint.js write <estado-tareas.json> <tarea-id>
 */

import * as fs from 'fs';
import * as path from 'path';

export interface EstadoTareas {
  ultima_tarea_completada?: string;
  ultimo_checkpoint_ts?: string;
  tareas?: Record<string, { estado: string; motivo_bloqueo?: string }>;
}

export interface CheckpointInfo {
  ultimaTarea: string | null;
  ts: string | null;
}

export function readCheckpoint(estadoTareasPath: string): CheckpointInfo {
  try {
    const raw = fs.readFileSync(estadoTareasPath, 'utf8');
    const estado: EstadoTareas = JSON.parse(raw);
    return {
      ultimaTarea: estado.ultima_tarea_completada ?? null,
      ts: estado.ultimo_checkpoint_ts ?? null,
    };
  } catch {
    return { ultimaTarea: null, ts: null };
  }
}

export function writeCheckpoint(estadoTareasPath: string, tareaId: string): void {
  let estado: EstadoTareas = {};
  try {
    estado = JSON.parse(fs.readFileSync(estadoTareasPath, 'utf8'));
  } catch { /* estado nuevo */ }

  estado.ultima_tarea_completada = tareaId;
  estado.ultimo_checkpoint_ts = new Date().toISOString();

  const tmp = estadoTareasPath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(estado, null, 2));
  fs.renameSync(tmp, estadoTareasPath);
}

export function markTaskStatus(
  estadoTareasPath: string,
  tareaId: string,
  nuevoEstado: 'en_progreso' | 'completada' | 'bloqueada',
  motivoBloqueo?: string
): void {
  let estado: EstadoTareas = {};
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
    // exit 0 silencioso si no hay checkpoint
  } else if (cmd === 'write' && tareaId) {
    writeCheckpoint(file, tareaId);
  } else {
    console.error('Comando desconocido. Usa: read | write');
    process.exit(1);
  }
}
