/**
 * Re-export de compatibilidad — apunta a la versión compilada en dist/.
 * El archivo fuente es core/ir-to-spec-mapper.ts (compilado por `npm run build`).
 * Los comandos como sdd.construir.md invocan este archivo con `node`.
 */
export * from '../dist/core/ir-to-spec-mapper.js';
