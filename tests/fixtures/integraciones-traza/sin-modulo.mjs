// @ts-check
/**
 * Precarga que SIMULA una versión de FORGE sin el módulo de integraciones: cualquier intento de
 * resolver un archivo de core/integraciones/ o cli/integraciones.js falla como si no existiera.
 * Si `forge run` funciona igual con esto puesto, el módulo no interviene en nada (HU-005).
 */
import { register } from 'node:module';

register(new URL('./ganchos-sin-modulo.mjs', import.meta.url));
