/**
 * core/adapters/adapter-interface.js — Contrato neutral de adaptador de host
 *
 * Define la interfaz que deben implementar todos los adaptadores de host.
 * Un adaptador traduce entre el contrato FORGE (artefactos .sdd/) y el
 * mecanismo de ejecución específico del host (Claude Code, Spec Kit, etc.).
 *
 * Contrato:
 *   Input:  { agente, tarea, contexto, tier, cwd }
 *   Output: { ok, resultado?, artefactos?, estado?, error? }
 *
 * Los adaptadores NO deben lanzar excepciones — siempre retornan { ok: false, error }.
 */

/**
 * @typedef {Object} TareaForge
 * @property {string} agente    — Nombre del agente que ejecuta ('arquitecto', 'main', etc.)
 * @property {string} tarea     — Descripción de la tarea a ejecutar
 * @property {object} [contexto] — Contexto adicional (artefactos .sdd/ relevantes, historial)
 * @property {'low'|'medium'|'high'} [tier] — Tier de modelo (low=Haiku, medium=Sonnet, high=Opus)
 * @property {string} [cwd]     — Directorio de trabajo (default: process.cwd())
 */

/**
 * @typedef {Object} ResultadoForge
 * @property {boolean} ok        — true si la tarea se completó sin errores
 * @property {string}  [resultado] — Texto/resumen del resultado
 * @property {string[]} [artefactos] — Rutas de artefactos .sdd/ generados/modificados
 * @property {object}  [estado]  — Estado del pipeline después de la tarea
 * @property {string}  [error]   — Mensaje de error si ok=false
 * @property {string}  [adapter] — Nombre del adaptador que ejecutó la tarea
 */

/**
 * Clase base que todos los adaptadores deben extender.
 * Proporciona validación de input y estructura de output estandarizada.
 */
export class ForgeAdapter {
  /** @type {string} Nombre único del adaptador */
  get nombre() { throw new Error('ForgeAdapter.nombre debe implementarse'); }

  /** @type {string} Descripción del adaptador */
  get descripcion() { return `Adaptador ${this.nombre}`; }

  /**
   * Verifica si este adaptador está disponible en el entorno actual.
   * @returns {boolean}
   */
  disponible() { return true; }

  /**
   * Ejecuta una tarea y retorna el resultado.
   * @param {TareaForge} tarea
   * @returns {Promise<ResultadoForge>}
   */
  async ejecutar(tarea) {
    throw new Error(`${this.nombre}.ejecutar() debe implementarse`);
  }

  /**
   * Valida que la tarea tenga los campos requeridos.
   * @param {TareaForge} tarea
   * @returns {{ valid: boolean, errors: string[] }}
   */
  validarTarea(tarea) {
    const errors = [];
    if (!tarea || typeof tarea !== 'object') {
      return { valid: false, errors: ['tarea debe ser un objeto'] };
    }
    if (!tarea.agente || typeof tarea.agente !== 'string') {
      errors.push('tarea.agente es requerido (string)');
    }
    if (!tarea.tarea || typeof tarea.tarea !== 'string') {
      errors.push('tarea.tarea es requerido (string)');
    }
    if (tarea.tier && !['low', 'medium', 'high'].includes(tarea.tier)) {
      errors.push(`tarea.tier debe ser 'low', 'medium' o 'high', recibido: "${tarea.tier}"`);
    }
    return { valid: errors.length === 0, errors };
  }

  /**
   * Crea un ResultadoForge de error estandarizado.
   * @param {string} error
   * @returns {ResultadoForge}
   */
  error(error) {
    return { ok: false, error, adapter: this.nombre };
  }

  /**
   * Crea un ResultadoForge de éxito estandarizado.
   * @param {Partial<ResultadoForge>} campos
   * @returns {ResultadoForge}
   */
  exito(campos) {
    return { ok: true, adapter: this.nombre, ...campos };
  }
}

/**
 * Registro de adaptadores disponibles.
 * Los adaptadores se registran en orden de preferencia.
 */
export class AdapterRegistry {
  #adapters = [];

  /** @param {ForgeAdapter} adapter */
  registrar(adapter) {
    if (!(adapter instanceof ForgeAdapter)) {
      throw new TypeError('Solo se pueden registrar instancias de ForgeAdapter');
    }
    this.#adapters.push(adapter);
    return this;
  }

  /**
   * Retorna el primer adaptador disponible.
   * @returns {ForgeAdapter|null}
   */
  resolver() {
    return this.#adapters.find(a => a.disponible()) ?? null;
  }

  /**
   * Retorna un adaptador por nombre.
   * @param {string} nombre
   * @returns {ForgeAdapter|null}
   */
  obtener(nombre) {
    return this.#adapters.find(a => a.nombre === nombre) ?? null;
  }

  /** @returns {string[]} */
  listar() {
    return this.#adapters.map(a => `${a.nombre} (${a.disponible() ? 'disponible' : 'no disponible'})`);
  }
}

/** Instancia global del registro */
export const adapterRegistry = new AdapterRegistry();
