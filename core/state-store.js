/**
 * state-store.js — Port de persistencia del estado FORGE
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * @typedef {Object} StateStore
 * @property {() => import('./project-memory.js').ForgeEstado} read
 * @property {(estado: import('./project-memory.js').ForgeEstado) => void} write
 * @property {() => boolean} exists
 * @property {() => void} clear
 */

export class FileSystemStateStore {
  /** @param {string} sddDir */
  constructor(sddDir) {
    this.sddDir = sddDir;
    this.estadoPath = path.join(sddDir, 'estado.json');
    this._cache = null;
    this._cacheMtime = 0;
    this._cacheSize = 0;
    fs.mkdirSync(sddDir, { recursive: true });
  }

  read() {
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
      const parsed = JSON.parse(fs.readFileSync(this.estadoPath, 'utf8'));
      this._cache = parsed;
      this._cacheMtime = stat.mtimeMs;
      this._cacheSize = stat.size;
      return parsed;
    } catch {
      return {};
    }
  }

  /** @param {object} estado */
  _saveSnapshot(estado) {
    try {
      const snapshotsDir = path.join(this.sddDir, '.snapshots');
      fs.mkdirSync(snapshotsDir, { recursive: true });
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
    } catch { /* no debe fallar el save principal */ }
  }

  /** @param {object} estado */
  write(estado) {
    this._cache = null;
    this._saveSnapshot(estado);
    const tmp = this.estadoPath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(estado, null, 2));
    fs.renameSync(tmp, this.estadoPath);
    this._cache = null;
  }

  exists() { return fs.existsSync(this.estadoPath); }

  clear() {
    if (fs.existsSync(this.estadoPath)) fs.unlinkSync(this.estadoPath);
    this._cache = null;
  }
}

export class InMemoryStateStore {
  constructor() {
    this.estado = {};
  }

  read() { return { ...this.estado }; }

  /** @param {object} estado */
  write(estado) { this.estado = { ...estado }; }

  exists() { return Object.keys(this.estado).length > 0; }

  clear() { this.estado = {}; }
}

/**
 * @param {string} [cwd]
 * @returns {FileSystemStateStore}
 */
export function createStateStore(cwd = process.cwd()) {
  return new FileSystemStateStore(path.join(cwd, '.sdd'));
}
