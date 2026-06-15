/**
 * FORGE — Interpreted Requirement (IR) Types
 * Source of truth para la intención del usuario
 */

/**
 * IR — Interpretación estructurada de la idea del usuario
 * Captura: qué tipo de producto, para quién, qué features core, qué restricciones
 */
export interface IR {
  // Metadatos
  id: string;
  created_at: string;
  raw_input: string;

  // Confianza: 0.0 = pura alucinación, 1.0 = certeza absoluta
  // ≥0.7 = "ready" sin preguntas adicionales
  confidence: number;

  // Producto
  product: {
    name: string; // "Sistema de citas para dentistas"
    type: 'saas' | 'mobile' | 'web' | 'api' | 'cli' | 'other';
    tagline: string; // Una línea clara
    value_proposition: string; // Por qué existe
    target_users: string; // "Dueños de clínicas + sus pacientes"
  };

  // Funcionalidad core
  features: {
    core: string[]; // 2–5 items del MVP
    nice_to_have?: string[]; // Futuro
  };

  // Restricciones técnicas y de negocio
  constraints: {
    budget?: string; // "bajo", "medio", "ilimitado"
    timeline?: string; // "ASAP", "2 meses", "flexible"
    team_size?: string; // "1 persona", "equipo de 3"
    tech_preference?: string; // "React", "Python", null = sin preferencia
  };

  // Clarificaciones del sistema
  assumptions: string[]; // Lo que asumimos (ej: "asumimos que es multi-usuario")
  ambiguities: Ambiguity[]; // Lo que era ambiguo, cómo lo resolvimos

  // Flags
  requires_clarification: boolean; // ¿Se necesita una pregunta antes de proceder?
  questions_for_user?: string[]; // Máximo 1–2 si confidence < 0.7
}

export interface Ambiguity {
  field: string; // "scope", "target_users", "timeline"
  issue: string; // "No mencionó si es para una clínica o múltiples"
  resolution: string; // "Asumimos que es para una clínica"
}

/**
 * ProductDesign — Lo que el agente product-designer genera
 * Captura: pantallas, user flow, dirección visual, architecture hint
 */
export interface ProductDesign {
  // Metadatos
  id: string;
  created_at: string;
  ir_id: string; // Relación hacia el IR origen

  // Identidad del producto
  product: {
    name: string;
    tagline: string;
    value_proposition: string;
  };

  // User journey
  user_flow: string[]; // 5–7 pasos narrativos del usuario típico

  // Pantallas del MVP
  core_screens: Screen[]; // 3–5 pantallas
  mvp_scope: string[]; // Resumen de qué entra en V1

  // Dirección visual (elegida en direction-picker)
  design_direction: 'minimal' | 'bold' | 'warm' | 'editorial' | 'brutalist';
  design_system_ref: string; // Path a design-systems/{direction}/DESIGN.md

  // Stack recomendado (del agente architecture-designer)
  architecture?: {
    frontend: string; // "React 19"
    backend: string; // "Node.js + Express"
    database: string; // "SQLite" | "PostgreSQL"
    deployment: string; // "Vercel" | "Heroku" | "Docker"
    rationale: string; // "simple, sin dependencias externas"
    estimated_complexity: 'low' | 'medium' | 'high';
  };
}

/**
 * Screen — Una pantalla del MVP
 */
export interface Screen {
  name: string; // "Ver disponibilidad"
  description: string; // Qué hace el usuario aquí
  purpose: string; // Por qué esta pantalla existe
  elements: UIElement[]; // Componentes principales
  priority: 'P0' | 'P1' | 'P2'; // P0 = entra en V1, P2 = futuro
  wireframe_html?: string; // HTML de la pantalla (si se generó)
}

/**
 * UIElement — Un componente en una pantalla
 */
export interface UIElement {
  type: string; // "form", "table", "card", "button", "input", etc.
  label: string; // "Formulario de cita"
  description?: string; // Descripción de qué hace
}

/**
 * InterpreterOutput — Lo que retorna la skill `interpretar-idea`
 */
export interface InterpreterOutput {
  ir: IR;
  next_step: 'confirm' | 'clarify' | 'proceed';
  message_to_user: string; // Lo que ve el usuario (human-readable)
}

/**
 * DesignOutput — Lo que retorna el agente `product-designer`
 */
export interface DesignOutput {
  product_design: ProductDesign;
  architecture_design: {
    stack: {
      frontend: string;
      backend: string;
      database: string;
      deployment: string;
    };
    rationale: string;
    estimated_complexity: 'low' | 'medium' | 'high';
  };
  next_step: 'approve' | 'revise';
  message_to_user: string;
  wireframe_html?: string; // HTML de la pantalla P0 (wrapped en <artifact>)
}

/**
 * Validación helper — asegura que el IR cumpla con estándares mínimos
 */
export function validateIR(ir: IR): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // product.type debe ser válido
  const validTypes = ['saas', 'mobile', 'web', 'api', 'cli', 'other'];
  if (!validTypes.includes(ir.product.type)) {
    errors.push(`product.type debe ser uno de: ${validTypes.join(', ')}`);
  }

  // features.core debe tener 2–5 items
  if (!ir.features.core || ir.features.core.length < 2 || ir.features.core.length > 5) {
    errors.push('features.core debe tener 2–5 items');
  }

  // confidence debe estar entre 0 y 1
  if (ir.confidence < 0 || ir.confidence > 1) {
    errors.push('confidence debe estar entre 0 y 1');
  }

  // assumptions y ambiguities deben ser arrays
  if (!Array.isArray(ir.assumptions)) {
    errors.push('assumptions debe ser un array');
  }
  if (!Array.isArray(ir.ambiguities)) {
    errors.push('ambiguities debe ser un array');
  }

  // Si confidence < 0.7, debe haber un flag de clarificación
  if (ir.confidence < 0.7 && !ir.requires_clarification) {
    ir.requires_clarification = true;
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validator para ProductDesign
 */
export function validateProductDesign(design: ProductDesign): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // core_screens debe tener 3–5 pantallas
  if (!design.core_screens || design.core_screens.length < 3 || design.core_screens.length > 5) {
    errors.push('core_screens debe tener 3–5 pantallas');
  }

  // design_direction debe ser válido
  const validDirections = ['minimal', 'bold', 'warm', 'editorial', 'brutalist'];
  if (!validDirections.includes(design.design_direction)) {
    errors.push(`design_direction debe ser uno de: ${validDirections.join(', ')}`);
  }

  // user_flow debe tener 5–7 pasos
  if (!design.user_flow || design.user_flow.length < 5 || design.user_flow.length > 7) {
    errors.push('user_flow debe tener 5–7 pasos');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
