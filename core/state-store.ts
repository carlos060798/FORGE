/**
 * state-store.ts — Port de persistencia del estado FORGE
 *
 * Define la interfaz StateStore y el adapter FileSystemStateStore
 * que reusa la lógica atómica de ProjectMemory (tmp → rename).
 *
 * El core depende de StateStore, nunca de fs directamente.
 * Permite sustituir el backend (FS → SQLite → remoto) sin tocar el engine.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ForgeEstado } from './project-memory.js';

// ── Puerto (interfaz) ────────────────────────────────────────────────────────

export interface StateStore {
  read(): ForgeEstado;
  write(estado: ForgeEstado): void;
  exists(): boolean;
  clear(): void;
}

// ── Adapter: FileSystem (comportamiento actual de ProjectMemory) ─────────────

export class FileSystemStateStore implements StateStore {
  private readonly estadoPath: string;
  private readonly sddDir: string;
  private _cache: ForgeEstado | null = null;
  private _cacheMtime: number = 0;
  private _cacheSize: number = 0;

  constructor(sddDir: string) {
    this.sddDir = sddDir;
    this.estadoPath = path.join(sddDir, 'estado.json');
    fs.mkdirSync(sddDir, { recursive: true });
  }

  read(): ForgeEstado {
    if (!fs.existsSync(this.estadoPath)) return {};
    try {
      const stat = fs.statSync(this.estadoPath);
      if (
        this._cache !== null &&
        stat.mtimeMs === this._cacheMtime &&
        stat.size === this._cacheSize
      ) {
        return this._cache;
      }
      const parsed: ForgeEstado = JSON.parse(fs.readFileSync(this.estadoPath, 'utf8'));
      this._cache = parsed;
      this._cacheMtime = stat.mtimeMs;
      this._cacheSize = stat.size;
      return parsed;
    } catch {
      return {};
    }
  }

  private saveSnapshot(estado: ForgeEstado): void {
    try {
      const snapshotsDir = path.join(this.sddDir, '.snapshots');
      fs.mkdirSync(snapshotsDir, { recursive: true });

      // Mantener solo los últimos 5 snapshots
      const existing = fs.readdirSync(snapshotsDir)
        .filter(f => f.startsWith('estado-') && f.endsWith('.json'))
        .sort();
      if (existing.length >= 5) {
        fs.unlinkSync(path.join(snapshotsDir, existing[0]));
      }

      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      fs.writeFileSync(
        path.join(snapshotsDir, `estado-${ts}.json`),
        JSON.stringify(estado, null, 2),
        'utf8'
      );
    } catch {
      // No debe fallar el save principal si el snapshot falla
    }
  }

  write(estado: ForgeEstado): void {
    this._cache = null;
    this.saveSnapshot(estado);
    const tmp = this.estadoPath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(estado, null, 2));
    fs.renameSync(tmp, this.estadoPath); // atómico: falla o completa, nunca parcial
    this._cache = null;
  }

  exists(): boolean {
    return fs.existsSync(this.estadoPath);
  }

  clear(): void {
    if (fs.existsSync(this.estadoPath)) fs.unlinkSync(this.estadoPath);
    this._cache = null;
  }
}

// ── Adapter: InMemory (para tests, sin tocar disco) ─────────────────────────

export class InMemoryStateStore implements StateStore {
  private estado: ForgeEstado = {};

  read(): ForgeEstado {
    return { ...this.estado };
  }

  write(estado: ForgeEstado): void {
    this.estado = { ...estado };
  }

  exists(): boolean {
    return Object.keys(this.estado).length > 0;
  }

  clear(): void {
    this.estado = {};
  }
}

// ── Factory ──────────────────────────────────────────────────────────────────

export function createStateStore(cwd: string = process.cwd()): StateStore {
  return new FileSystemStateStore(path.join(cwd, '.sdd'));
}
