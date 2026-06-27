/**
 * FORGE — Interpreted Requirement (IR) Types
 * Source of truth para la intención del usuario
 */

/**
 * @typedef {Object} IR
 * @property {string} id
 * @property {string} created_at
 * @property {string} raw_input
 * @property {number} confidence — ≥0.7 = "ready" sin preguntas adicionales
 * @property {{ name: string, type: 'saas'|'mobile'|'web'|'api'|'cli'|'other', tagline: string, value_proposition: string, target_users: string }} product
 * @property {{ core: string[], nice_to_have?: string[] }} features
 * @property {{ budget?: string, timeline?: string, team_size?: string, tech_preference?: string }} constraints
 * @property {string[]} assumptions
 * @property {Ambiguity[]} ambiguities
 * @property {boolean} requires_clarification
 * @property {string[]} [questions_for_user]
 */

/**
 * @typedef {Object} Ambiguity
 * @property {string} field
 * @property {string} issue
 * @property {string} resolution
 */

/**
 * @typedef {Object} ProductDesign
 * @property {string} id
 * @property {string} created_at
 * @property {string} ir_id
 * @property {{ name: string, tagline: string, value_proposition: string }} product
 * @property {string[]} user_flow
 * @property {Screen[]} core_screens
 * @property {string[]} mvp_scope
 * @property {'minimal'|'bold'|'warm'|'editorial'|'brutalist'} design_direction
 * @property {string} design_system_ref
 * @property {{ frontend: string, backend: string, database: string, deployment: string, rationale: string, estimated_complexity: 'low'|'medium'|'high' }} [architecture]
 */

/**
 * @typedef {Object} Screen
 * @property {string} name
 * @property {string} description
 * @property {string} purpose
 * @property {UIElement[]} elements
 * @property {'P0'|'P1'|'P2'} priority
 * @property {string} [wireframe_html]
 */

/**
 * @typedef {Object} UIElement
 * @property {string} type
 * @property {string} label
 * @property {string} [description]
 */

/**
 * @typedef {Object} InterpreterOutput
 * @property {IR} ir
 * @property {'confirm'|'clarify'|'proceed'} next_step
 * @property {string} message_to_user
 */

/**
 * @typedef {Object} DesignOutput
 * @property {ProductDesign} product_design
 * @property {{ stack: { frontend: string, backend: string, database: string, deployment: string }, rationale: string, estimated_complexity: 'low'|'medium'|'high' }} architecture_design
 * @property {'approve'|'revise'} next_step
 * @property {string} message_to_user
 * @property {string} [wireframe_html]
 */

/**
 * Validación helper — asegura que el IR cumpla con estándares mínimos
 * @param {IR} ir
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateIR(ir) {
  const errors = [];

  const validTypes = ['saas', 'mobile', 'web', 'api', 'cli', 'other'];
  if (!validTypes.includes(ir.product.type)) {
    errors.push(`product.type debe ser uno de: ${validTypes.join(', ')}`);
  }

  if (!ir.features.core || ir.features.core.length < 2 || ir.features.core.length > 5) {
    errors.push('features.core debe tener 2–5 items');
  }

  if (ir.confidence < 0 || ir.confidence > 1) {
    errors.push('confidence debe estar entre 0 y 1');
  }

  if (!Array.isArray(ir.assumptions)) {
    errors.push('assumptions debe ser un array');
  }
  if (!Array.isArray(ir.ambiguities)) {
    errors.push('ambiguities debe ser un array');
  }

  if (ir.confidence < 0.7 && !ir.requires_clarification) {
    ir.requires_clarification = true;
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validator para ProductDesign
 * @param {ProductDesign} design
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateProductDesign(design) {
  const errors = [];

  if (!design.core_screens || design.core_screens.length < 3 || design.core_screens.length > 5) {
    errors.push('core_screens debe tener 3–5 pantallas');
  }

  const validDirections = ['minimal', 'bold', 'warm', 'editorial', 'brutalist'];
  if (!validDirections.includes(design.design_direction)) {
    errors.push(`design_direction debe ser uno de: ${validDirections.join(', ')}`);
  }

  if (!design.user_flow || design.user_flow.length < 5 || design.user_flow.length > 7) {
    errors.push('user_flow debe tener 5–7 pasos');
  }

  return { valid: errors.length === 0, errors };
}
