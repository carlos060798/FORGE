/**
 * Extends .sdd/estado.json with FORGE fields.
 * Manages persistence of IR, ProductDesign, and pipeline state.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface ForgeEstado {
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
}

export class ProjectMemory {
  private estadoPath: string;
  private sddDir: string;

  constructor(cwd: string = process.cwd()) {
    this.sddDir = path.join(cwd, '.sdd');
    this.estadoPath = path.join(this.sddDir, 'estado.json');
  }

  read(): ForgeEstado {
    this.ensureSddDir();
    if (!fs.existsSync(this.estadoPath)) {
      return {};
    }
    try {
      return JSON.parse(fs.readFileSync(this.estadoPath, 'utf8'));
    } catch {
      return {};
    }
  }

  update(fields: Partial<ForgeEstado>): ForgeEstado {
    const current = this.read();
    const updated: ForgeEstado = {
      ...current,
      ...fields,
      ultima_actualizacion: new Date().toISOString(),
    };
    this.ensureSddDir();
    fs.writeFileSync(this.estadoPath, JSON.stringify(updated, null, 2));
    return updated;
  }

  saveIR(ir: object): string {
    this.ensureSddDir();
    const irPath = path.join(this.sddDir, 'ir.json');
    fs.writeFileSync(irPath, JSON.stringify(ir, null, 2));
    this.update({ ir_generado: true, ir_path: '.sdd/ir.json' });
    return irPath;
  }

  saveProductDesign(pd: object): string {
    this.ensureSddDir();
    const pdPath = path.join(this.sddDir, 'product-design.json');
    fs.writeFileSync(pdPath, JSON.stringify(pd, null, 2));
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

  setPipelineStep(step: ForgeEstado['pipeline_step']): void {
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
}

export const projectMemory = new ProjectMemory();
