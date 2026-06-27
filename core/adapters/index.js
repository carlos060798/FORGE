/**
 * core/adapters/index.js — Registro y resolución de adaptadores FORGE
 *
 * Importar este módulo inicializa el registro con todos los adaptadores
 * disponibles, en orden de preferencia:
 *   1. Claude Code (si hay señales del host)
 *   2. Spec Kit portable (siempre disponible como fallback)
 */

export { ForgeAdapter, AdapterRegistry, adapterRegistry } from './adapter-interface.js';
export { ClaudeCodeAdapter } from './claude-code-adapter.js';
export { SpecKitAdapter } from './speckit-adapter.js';

import { adapterRegistry } from './adapter-interface.js';
import { ClaudeCodeAdapter } from './claude-code-adapter.js';
import { SpecKitAdapter } from './speckit-adapter.js';

// Registrar en orden de preferencia
adapterRegistry
  .registrar(new ClaudeCodeAdapter())
  .registrar(new SpecKitAdapter());

export { adapterRegistry as registry };
