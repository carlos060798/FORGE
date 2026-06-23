/**
 * Extends .sdd/estado.json with FORGE fields.
 * Manages persistence of IR, ProductDesign, and pipeline state.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export const SCHEMA_VERSION = "1.0" as const;

// Transiciones válidas del pipeline — previene saltos de etapa que omitan pasos obligatorios
const PIPELINE_TRANSITIONS: Record<NonNullable<ForgeEstado['pipeline_step']>, NonNullable<ForgeEstado['pipeline_step']>[]> = {
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

export interface ForgeEstado {
  // Schema contract — required in all new states
  schemaVersion?: typeof SCHEMA_VERSION;

  // Existing sdd-lite fields (preserved as-is)
  spec_activa?: string;
  plan_activo?: string;
  [key: string]: unknown;

  // FORGE extensions
  ir_generado?: boolean;
  ir_path?: string;
  product_design_generado?: boolean;
  product_design_aprobado?: boolean;
  product_design_path?: string;
  design_direction?: string;
  design_system_path?: string;
  spec_draft_path?: string;
  pipeline_step?: 'idea' | 'discovery' | 'ir' | 'design' | 'spec' | 'plan' | 'tasks' | 'code' | 'done';
  ultima_actualizacion?: string;

  // Inter-agent state (A6)
  artefactos_sesion?: {
    ir_confidence?: number | null;
    stack_decidido?: string | null;
    complejidad_estimada?: string | null;
    agentes_activos_ultimo_plan?: string[];
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class ProjectMemory {
  private estadoPath: string;
  private sddDir: string;
  private _cache: ForgeEstado | null = null;
  private _cacheMtime: number = 0;
  private _cacheSize: number = 0;

  constructor(cwd: string = process.cwd()) {
    this.sddDir = path.join(cwd, '.sdd');
    this.estadoPath = path.join(this.sddDir, 'estado.json');
  }

  read(): ForgeEstado {
    this.ensureSddDir();
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
      return this._cache!;
    } catch {
      return {};
    }
  }

  update(fields: Partial<ForgeEstado>): ForgeEstado {
    const current = this.read();
    const updated: ForgeEstado = {
      schemaVersion: SCHEMA_VERSION,
      ...current,
      ...fields,
      ultima_actualizacion: new Date().toISOString(),
    };
    this.ensureSddDir();
    // Escritura atómica: tmp → rename para evitar corrupción si el proceso muere en medio
    const tmpPath = this.estadoPath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(updated, null, 2));
    fs.renameSync(tmpPath, this.estadoPath);
    this._cache = null;
    return updated;
  }

  validate(): ValidationResult {
    const errors: string[] = [];
    if (!fs.existsSync(this.estadoPath)) {
      return { valid: true, errors: [] }; // Sin estado aún es válido (proyecto nuevo)
    }
    let estado: unknown;
    try {
      estado = JSON.parse(fs.readFileSync(this.estadoPath, 'utf8'));
    } catch {
      return { valid: false, errors: ['estado.json no es JSON válido'] };
    }
    if (typeof estado !== 'object' || estado === null) {
      return { valid: false, errors: ['estado.json debe ser un objeto JSON'] };
    }
    const e = estado as Record<string, unknown>;
    if (!e['schemaVersion']) {
      errors.push('schemaVersion ausente — ejecuta `forge doctor` para migrar');
    } else if (e['schemaVersion'] !== SCHEMA_VERSION) {
      errors.push(`schemaVersion "${e['schemaVersion']}" desconocida (esperada: "${SCHEMA_VERSION}")`);
    }
    return { valid: errors.length === 0, errors };
  }

  migrate(): ForgeEstado {
    if (!fs.existsSync(this.estadoPath)) {
      return {};
    }
    let estado: ForgeEstado;
    try {
      estado = JSON.parse(fs.readFileSync(this.estadoPath, 'utf8'));
    } catch {
      return {};
    }
    if (estado.schemaVersion === SCHEMA_VERSION) {
      return estado; // Ya está en la versión actual
    }
    // Migración: legado (sin schemaVersion) → 1.0
    const migrado: ForgeEstado = {
      schemaVersion: SCHEMA_VERSION,
      ...estado,
      ultima_actualizacion: new Date().toISOString(),
    };
    this.ensureSddDir();
    const tmpPath = this.estadoPath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(migrado, null, 2));
    fs.renameSync(tmpPath, this.estadoPath);
    this._cache = null;
    return migrado;
  }

  saveIR(ir: object): string {
    this.ensureSddDir();
    const irPath = path.join(this.sddDir, 'ir.json');
    this.writeAtomic(irPath, JSON.stringify(ir, null, 2));
    this.update({ ir_generado: true, ir_path: '.sdd/ir.json' });
    return irPath;
  }

  saveProductDesign(pd: object): string {
    this.ensureSddDir();
    const pdPath = path.join(this.sddDir, 'product-design.json');
    this.writeAtomic(pdPath, JSON.stringify(pd, null, 2));
    this.update({
      product_design_generado: true,
      product_design_path: '.sdd/product-design.json',
    });
    return pdPath;
  }

  loadIR(): object | null {
    const estado = this.read();
    if (!estado.ir_generado) return null;
    const irPath = path.join(this.sddDir, 'ir.json');
    if (!fs.existsSync(irPath)) return null;
    return JSON.parse(fs.readFileSync(irPath, 'utf8'));
  }

  loadProductDesign(): object | null {
    const estado = this.read();
    if (!estado.product_design_generado) return null;
    const pdPath = path.join(this.sddDir, 'product-design.json');
    if (!fs.existsSync(pdPath)) return null;
    return JSON.parse(fs.readFileSync(pdPath, 'utf8'));
  }

  setPipelineStep(step: ForgeEstado['pipeline_step'], force = false): void {
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

  getActiveDesignSystem(): string {
    const estado = this.read();
    return estado.design_system_path || 'design-systems/neutral-modern/DESIGN.md';
  }

  summary(): string {
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

  private ensureSddDir(): void {
    if (!fs.existsSync(this.sddDir)) {
      fs.mkdirSync(this.sddDir, { recursive: true });
    }
  }

  // Escritura atómica: escribe a .tmp y luego rename para evitar corrupción parcial
  private writeAtomic(filePath: string, content: string): void {
    const tmp = filePath + '.tmp';
    fs.writeFileSync(tmp, content);
    fs.renameSync(tmp, filePath);
  }
}

export const projectMemory = new ProjectMemory();
