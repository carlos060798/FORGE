/**
 * ir-to-spec-mapper.js — Maps IR + ProductDesign → sdd-lite spec format
 */

/**
 * @param {import('./ir.types.js').IR} ir
 * @param {import('./ir.types.js').ProductDesign} pd
 */
export function mapIRToSpec(ir, pd) {
  const actors = _extractActors(ir, pd);
  return {
    product_name: pd.product.name,
    version: '1.0.0',
    generated_from: { ir_id: ir.id, product_design_id: pd.id },
    actors,
    user_stories: _mapFeaturesToUserStories(ir, pd, actors),
    functional_requirements: _mapScreensToRF(pd, actors),
    non_functional_requirements: _buildNFR(ir, pd),
    out_of_scope: pd['out_of_scope'] || [],
  };
}

function _extractActors(ir, pd) {
  const actors = [];
  if (ir.product.target_users) actors.push(ir.product.target_users);
  else actors.push('Usuario');
  const hasAdmin = ir.features.core.some(f => /admin|gestión|gestionar|manage|configurar|panel/i.test(f));
  if (hasAdmin) actors.push('Administrador');
  actors.push('Sistema');
  return [...new Set(actors)];
}

function _mapFeaturesToUserStories(ir, pd, actors) {
  const primaryActor = actors[0];
  const stories = [];
  ir.features.core.forEach((feature, index) => {
    const priority = index === 0 ? 'P0' : index < 3 ? 'P1' : 'P2';
    const id = `US-${String(index + 1).padStart(3, '0')}`;
    const relatedScreen = pd.core_screens.find(s =>
      s.description.toLowerCase().includes(feature.toLowerCase().split(' ')[0])
    );
    stories.push({
      id, role: primaryActor,
      action: _featureToAction(feature),
      benefit: _featureToBenefit(feature, ir.product.value_proposition),
      acceptance_criteria: _generateAC(feature, relatedScreen),
      priority,
    });
  });
  (ir.features.nice_to_have || []).forEach((feature, index) => {
    const id = `US-${String(ir.features.core.length + index + 1).padStart(3, '0')}`;
    stories.push({ id, role: primaryActor, action: _featureToAction(feature), benefit: _featureToBenefit(feature, ir.product.value_proposition), acceptance_criteria: _generateAC(feature), priority: 'P2' });
  });
  return stories;
}

function _mapScreensToRF(pd, actors) {
  const primaryActor = actors[0];
  return pd.core_screens.map((screen, index) => ({
    id: `RF-${String(index + 1).padStart(3, '0')}`,
    description: screen.description,
    actors: [primaryActor, 'Sistema'],
    screen_ref: screen.name,
    priority: screen.priority,
  }));
}

function _buildNFR(ir, pd) {
  const nfr = [
    'El sistema debe responder en menos de 2 segundos para operaciones comunes',
    'La interfaz debe ser usable en dispositivos desktop (1280px+)',
  ];
  if (ir.constraints?.timeline) nfr.push(`Tiempo objetivo de entrega: ${ir.constraints.timeline}`);
  if (pd.design_direction === 'bold-brutalist') nfr.push('El diseño debe mantener el esquema bold-brutalist en todas las pantallas');
  return nfr;
}

function _featureToAction(feature) {
  return feature.replace(/^(poder |pueda |quiero |necesito )/i, '').toLowerCase();
}

function _featureToBenefit(feature, valueProp) {
  const vpShort = valueProp?.split('.')[0] || 'lograr mi objetivo';
  return `puedo ${vpShort.toLowerCase()} de manera eficiente`;
}

function _generateAC(feature, screen) {
  const ac = [
    `Dado que el usuario accede a la funcionalidad, cuando realiza la acción "${feature}", entonces el sistema responde correctamente`,
    'El resultado es visible y comprensible para el usuario',
    'El sistema maneja errores con mensajes claros',
  ];
  if (screen) {
    const formElements = screen.elements.filter(e => e.type === 'form');
    if (formElements.length > 0) ac.push('Los campos obligatorios muestran validación en tiempo real');
  }
  return ac;
}

// ── CLI directo ───────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const irPath = join(process.cwd(), '.sdd/ir.json');
  const pdPath = join(process.cwd(), '.sdd/product-design.json');

  if (!existsSync(irPath)) { console.error('Error: .sdd/ir.json no encontrado.'); process.exit(1); }
  if (!existsSync(pdPath)) { console.error('Error: .sdd/product-design.json no encontrado.'); process.exit(1); }

  const ir = JSON.parse(readFileSync(irPath, 'utf8'));
  const pd = JSON.parse(readFileSync(pdPath, 'utf8'));
  const spec = mapIRToSpec(ir, pd);
  const specPath = join(process.cwd(), '.sdd/spec-draft.json');
  writeFileSync(specPath, JSON.stringify(spec, null, 2));
  console.log(`✅ Spec generada en ${specPath}`);
  console.log(`   ${spec.user_stories.length} historias de usuario`);
  console.log(`   ${spec.functional_requirements.length} requerimientos funcionales`);
}
