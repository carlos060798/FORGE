/**
 * Maps IR + ProductDesign → sdd-lite spec format.
 * Converts features.core[] to User Stories and core_screens[] to RF + Actors.
 */

import { IR, ProductDesign } from './ir.types';

export interface UserStory {
  id: string;
  role: string;
  action: string;
  benefit: string;
  acceptance_criteria: string[];
  priority: 'P0' | 'P1' | 'P2';
}

export interface FunctionalRequirement {
  id: string;
  description: string;
  actors: string[];
  screen_ref: string;
  priority: 'P0' | 'P1' | 'P2';
}

export interface SddSpec {
  product_name: string;
  version: '1.0.0';
  generated_from: {
    ir_id: string;
    product_design_id: string;
  };
  actors: string[];
  user_stories: UserStory[];
  functional_requirements: FunctionalRequirement[];
  non_functional_requirements: string[];
  out_of_scope: string[];
}

export function mapIRToSpec(ir: IR, pd: ProductDesign): SddSpec {
  const actors = extractActors(ir, pd);
  const userStories = mapFeaturesToUserStories(ir, pd, actors);
  const functionalRequirements = mapScreensToRF(pd, actors);

  return {
    product_name: pd.product.name,
    version: '1.0.0',
    generated_from: {
      ir_id: ir.id,
      product_design_id: pd.id,
    },
    actors,
    user_stories: userStories,
    functional_requirements: functionalRequirements,
    non_functional_requirements: buildNFR(ir, pd),
    out_of_scope: pd.out_of_scope || [],
  };
}

function extractActors(ir: IR, pd: ProductDesign): string[] {
  const actors: string[] = [];

  // Primary user from target_users
  if (ir.product.target_users) {
    actors.push(ir.product.target_users);
  } else {
    actors.push('Usuario');
  }

  // Admin actor if the product has management features
  const hasAdmin = ir.features.core.some(f =>
    /admin|gestión|gestionar|manage|configurar|panel/i.test(f)
  );
  if (hasAdmin) actors.push('Administrador');

  // System actor always present
  actors.push('Sistema');

  return [...new Set(actors)];
}

function mapFeaturesToUserStories(
  ir: IR,
  pd: ProductDesign,
  actors: string[]
): UserStory[] {
  const primaryActor = actors[0];
  const stories: UserStory[] = [];

  ir.features.core.forEach((feature, index) => {
    const priority = index === 0 ? 'P0' : index < 3 ? 'P1' : 'P2';
    const id = `US-${String(index + 1).padStart(3, '0')}`;

    // Find related screen for context
    const relatedScreen = pd.core_screens.find(s =>
      s.description.toLowerCase().includes(feature.toLowerCase().split(' ')[0])
    );

    stories.push({
      id,
      role: primaryActor,
      action: featureToAction(feature),
      benefit: featureToBenefit(feature, ir.product.value_proposition),
      acceptance_criteria: generateAC(feature, relatedScreen),
      priority,
    });
  });

  // Add nice-to-have as P2
  (ir.features.nice_to_have || []).forEach((feature, index) => {
    const id = `US-${String(ir.features.core.length + index + 1).padStart(3, '0')}`;
    stories.push({
      id,
      role: primaryActor,
      action: featureToAction(feature),
      benefit: featureToBenefit(feature, ir.product.value_proposition),
      acceptance_criteria: generateAC(feature),
      priority: 'P2',
    });
  });

  return stories;
}

function mapScreensToRF(
  pd: ProductDesign,
  actors: string[]
): FunctionalRequirement[] {
  const primaryActor = actors[0];

  return pd.core_screens.map((screen, index) => ({
    id: `RF-${String(index + 1).padStart(3, '0')}`,
    description: screen.description,
    actors: [primaryActor, 'Sistema'],
    screen_ref: screen.name,
    priority: screen.priority,
  }));
}

function buildNFR(ir: IR, pd: ProductDesign): string[] {
  const nfr = [
    'El sistema debe responder en menos de 2 segundos para operaciones comunes',
    'La interfaz debe ser usable en dispositivos desktop (1280px+)',
  ];

  if (ir.constraints?.timeline) {
    nfr.push(`Tiempo objetivo de entrega: ${ir.constraints.timeline}`);
  }

  if (pd.design_direction === 'bold-brutalist') {
    nfr.push('El diseño debe mantener el esquema bold-brutalist en todas las pantallas');
  }

  return nfr;
}

function featureToAction(feature: string): string {
  // Remove common prefixes and normalize
  return feature
    .replace(/^(poder |pueda |quiero |necesito )/i, '')
    .toLowerCase();
}

function featureToBenefit(feature: string, valueProp: string): string {
  // Use the first sentence of value_proposition as context
  const vpShort = valueProp?.split('.')[0] || 'lograr mi objetivo';
  return `puedo ${vpShort.toLowerCase()} de manera eficiente`;
}

function generateAC(feature: string, screen?: { name: string; elements: Array<{ type: string; label: string }> }): string[] {
  const ac: string[] = [
    `Dado que el usuario accede a la funcionalidad, cuando realiza la acción "${feature}", entonces el sistema responde correctamente`,
    'El resultado es visible y comprensible para el usuario',
    'El sistema maneja errores con mensajes claros',
  ];

  if (screen) {
    const formElements = screen.elements.filter(e => e.type === 'form');
    if (formElements.length > 0) {
      ac.push('Los campos obligatorios muestran validación en tiempo real');
    }
  }

  return ac;
}

// CLI usage: node ir-to-spec-mapper.js
if (require.main === module) {
  const fs = require('fs');
  const path = require('path');

  const irPath = path.join(process.cwd(), '.sdd/ir.json');
  const pdPath = path.join(process.cwd(), '.sdd/product-design.json');

  if (!fs.existsSync(irPath)) {
    console.error('Error: .sdd/ir.json no encontrado. Ejecuta /sdd.interpretar primero.');
    process.exit(1);
  }

  if (!fs.existsSync(pdPath)) {
    console.error('Error: .sdd/product-design.json no encontrado. Ejecuta /sdd.diseñar primero.');
    process.exit(1);
  }

  const ir: IR = JSON.parse(fs.readFileSync(irPath, 'utf8'));
  const pd: ProductDesign = JSON.parse(fs.readFileSync(pdPath, 'utf8'));
  const spec = mapIRToSpec(ir, pd);

  const specPath = path.join(process.cwd(), '.sdd/spec-draft.json');
  fs.writeFileSync(specPath, JSON.stringify(spec, null, 2));
  console.log(`✅ Spec generada en ${specPath}`);
  console.log(`   ${spec.user_stories.length} historias de usuario`);
  console.log(`   ${spec.functional_requirements.length} requerimientos funcionales`);
}
