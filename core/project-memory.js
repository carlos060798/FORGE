/**
 * project-memory.js — Gestión de persistencia del estado FORGE (.sdd/estado.json)
 */

import * as fs from 'fs';
import * as path from 'path';

export const SCHEMA_VERSION = '1.0';

/** Transiciones válidas del pipeline */
const PIPELINE_TRANSITIONS = {
  idea:        ['discovery'],
  discovery:   ['ir'],
  ir:          ['design'],
  design:      ['spec'],
  spec:        ['plan'],
  plan:        ['tasks'],
  tasks:       ['code'],
  code:        ['done'],
  done:        [],
};

/**
 * @typedef {Object} ForgeEstado
 * @property {string} [schemaVersion]
 * @property {string} [spec_activa]
 * @property {string} [plan_activo]
 * @property {boolean} [ir_generado]
 * @property {string} [ir_path]
 * @property {boolean} [product_design_generado]
 * @property {boolean} [product_design_aprobado]
 * @property {string} [product_design_path]
 * @property {string} [design_direction]
 * @property {string} [design_system_path]
 * @property {string} [spec_draft_path]
 * @property {'idea'|'discovery'|'ir'|'design'|'spec'|'plan'|'tasks'|'code'|'done'} [pipeline_step]
 * @property {string} [ultima_actualizacion]
 */

export class ProjectMemory {
  /** @param {string} [cwd] */
  constructor(cwd = process.cwd()) {
    this.sddDir = path.join(cwd, '.sdd');
    this.estadoPath = path.join(this.sddDir, 'estado.json');
    this._cache = null;
    this._cacheMtime = 0;
    this._cacheSize = 0;
  }

  /** @returns {ForgeEstado} */
  read() {
    this._ensureSddDir();
    if (!fs.existsSync(this.estadoPath)) {
      this._cache = null;
      return {};
    }
    try {
      const stat = fs.statSync(this.estadoPath);
      if (this._cache !== null && stat.mtimeMs === this._cacheMtime && stat.size === this._cacheSize) {
        return this._cache;
      }
      const parsed = JSON.parse(fs.readFileSync(this.estadoPath, 'utf8'));
      this._cache = parsed;
      this._cacheMtime = stat.mtimeMs;
      this._cacheSize = stat.size;
      return this._cache;
    } catch {
      return {};
    }
  }

  /**
   * @param {Partial<ForgeEstado>} fields
   * @returns {ForgeEstado}
   */
  update(fields) {
    const current = this.read();
    const updated = {
      schemaVersion: SCHEMA_VERSION,
      ...current,
      ...fields,
      ultima_actualizacion: new Date().toISOString(),
    };
    this._ensureSddDir();
    const tmpPath = this.estadoPath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(updated, null, 2));
    fs.renameSync(tmpPath, this.estadoPath);
    this._cache = null;
    return updated;
  }

  /** @returns {{ valid: boolean, errors: string[] }} */
  validate() {
    if (!fs.existsSync(this.estadoPath)) return { valid: true, errors: [] };
    let estado;
    try {
      estado = JSON.parse(fs.readFileSync(this.estadoPath, 'utf8'));
    } catch {
      return { valid: false, errors: ['estado.json no es JSON válido'] };
    }
    if (typeof estado !== 'object' || estado === null) {
      return { valid: false, errors: ['estado.json debe ser un objeto JSON'] };
    }
    const errors = [];
    if (!estado['schemaVersion']) {
      errors.push('schemaVersion ausente — ejecuta `forge doctor` para migrar');
    } else if (estado['schemaVersion'] !== SCHEMA_VERSION) {
      errors.push(`schemaVersion "${estado['schemaVersion']}" desconocida (esperada: "${SCHEMA_VERSION}")`);
    }
    return { valid: errors.length === 0, errors };
  }

  /** @returns {ForgeEstado} */
  migrate() {
    if (!fs.existsSync(this.estadoPath)) return {};
    let estado;
    try {
      estado = JSON.parse(fs.readFileSync(this.estadoPath, 'utf8'));
    } catch {
      return {};
    }
    if (estado.schemaVersion === SCHEMA_VERSION) return estado;
    const migrado = {
      schemaVersion: SCHEMA_VERSION,
      ...estado,
      ultima_actualizacion: new Date().toISOString(),
    };
    this._ensureSddDir();
    const tmpPath = this.estadoPath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(migrado, null, 2));
    fs.renameSync(tmpPath, this.estadoPath);
    this._cache = null;
    return migrado;
  }

  /** @param {object} ir @returns {string} */
  saveIR(ir) {
    this._ensureSddDir();
    const irPath = path.join(this.sddDir, 'ir.json');
    this._writeAtomic(irPath, JSON.stringify(ir, null, 2));
    this.update({ ir_generado: true, ir_path: '.sdd/ir.json' });
    return irPath;
  }

  /** @param {object} pd @returns {string} */
  saveProductDesign(pd) {
    this._ensureSddDir();
    const pdPath = path.join(this.sddDir, 'product-design.json');
    this._writeAtomic(pdPath, JSON.stringify(pd, null, 2));
    this.update({ product_design_generado: true, product_design_path: '.sdd/product-design.json' });
    return pdPath;
  }

  /** @returns {object|null} */
  loadIR() {
    const estado = this.read();
    if (!estado.ir_generado) return null;
    const irPath = path.join(this.sddDir, 'ir.json');
    if (!fs.existsSync(irPath)) return null;
    return JSON.parse(fs.readFileSync(irPath, 'utf8'));
  }

  /** @returns {object|null} */
  loadProductDesign() {
    const estado = this.read();
    if (!estado.product_design_generado) return null;
    const pdPath = path.join(this.sddDir, 'product-design.json');
    if (!fs.existsSync(pdPath)) return null;
    return JSON.parse(fs.readFileSync(pdPath, 'utf8'));
  }

  /**
   * @param {ForgeEstado['pipeline_step']} step
   * @param {boolean} [force]
   */
  setPipelineStep(step, force = false) {
    if (!force && step) {
      const current = this.read().pipeline_step;
      if (current && current !== step) {
        const allowed = PIPELINE_TRANSITIONS[current] ?? [];
        if (!allowed.includes(step)) {
          throw new Error(
            `Transición de pipeline inválida: "${current}" → "${step}". ` +
            `Pasos permitidos desde "${current}": [${allowed.join(', ') || 'ninguno'}]. ` +
            `Usa force=true para forzar si es intencional.`
          );
        }
      }
    }
    this.update({ pipeline_step: step });
  }

  /** @returns {string} */
  getActiveDesignSystem() {
    const estado = this.read();
    return estado.design_system_path || 'design-systems/neutral-modern/DESIGN.md';
  }

  /** @returns {string} */
  summary() {
    const e = this.read();
    const lines = ['Estado del proyecto FORGE:'];
    if (e.ir_generado) lines.push('  ✅ IR generado');
    else lines.push('  ⭕ Sin IR — ejecuta /sdd.interpretar');
    if (e.product_design_aprobado) lines.push('  ✅ Diseño aprobado');
    else if (e.product_design_generado) lines.push('  🔄 Diseño generado (pendiente aprobación)');
    else lines.push('  ⭕ Sin diseño — ejecuta /sdd.diseñar');
    if (e.design_direction) lines.push(`  🎨 Dirección visual: ${e.design_direction}`);
    if (e.pipeline_step) lines.push(`  📍 Paso actual: ${e.pipeline_step}`);
    if (e.spec_activa) lines.push(`  📋 Spec activa: ${e.spec_activa}`);
    return lines.join('\n');
  }

  _ensureSddDir() {
    if (!fs.existsSync(this.sddDir)) fs.mkdirSync(this.sddDir, { recursive: true });
  }

  _writeAtomic(filePath, content) {
    const tmp = filePath + '.tmp';
    fs.writeFileSync(tmp, content);
    fs.renameSync(tmp, filePath);
  }
}

export const projectMemory = new ProjectMemory();
