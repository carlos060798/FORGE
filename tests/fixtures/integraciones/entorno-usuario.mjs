// @ts-check
/**
 * Entorno del USUARIO para las pruebas de integraciones (revisión 2): aísla el estado del usuario en un
 * directorio temporal propio (nunca %LOCALAPPDATA% ni ~/.forge reales) y concede la escritura que, en
 * la vida real, concede el usuario con FORGE_INTEGRACIONES_ESCRITURA. Se importa por su efecto.
 * Los procesos hijos heredan estas variables.
 */

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

if (!process.env.FORGE_HOME) process.env.FORGE_HOME = mkdtempSync(join(tmpdir(), 'forge-home-prueba-'));
process.env.FORGE_INTEGRACIONES_ESCRITURA = 'github,gitlab,jira';

/** Las variables del usuario que las pruebas con un `env` propio deben añadir. */
export const ENTORNO_USUARIO = Object.freeze({ FORGE_INTEGRACIONES_ESCRITURA: 'github,gitlab,jira', FORGE_HOME: /** @type {string} */ (process.env.FORGE_HOME) });

/**
 * `aprobar <id>` sin `--huella` ya no publica (revisión 2, H1): los ayudantes de las pruebas de flujo
 * añaden la huella que `vista` mostraría, como haría la persona. Otros subcomandos pasan intactos.
 * @param {string} cwd @param {string[]} args @param {Record<string, string|undefined>} [env]
 * @returns {Promise<string[]>}
 */
export async function conHuella(cwd, args, env) {
  if (args[0] !== 'aprobar' || args.includes('--huella') || typeof args[1] !== 'string') return args;
  try {
    const { vistaPrevia } = await import('../../../core/integraciones/aprobacion.js');
    return [...args, '--huella', vistaPrevia(cwd, args[1], { env }).huella];
  } catch { return args; }
}
