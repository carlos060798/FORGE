/**
 * politica-destinos.js — Destinos de red que el USUARIO permite al agente
 *
 * La política viene del entorno del usuario (variable `FRAGUA_DESTINOS_PERMITIDOS`, o la antigua
 * `FORGE_DESTINOS_PERMITIDOS`; si las dos difieren, ningún destino extra), nunca del repositorio: un archivo del proyecto no puede fabricar su propia autorización (ADR-22, revisión 2).
 * Se admiten dominios exactos (`api.a.net`) y comodines de subdominio (`*.a.net`, que cubre
 * `x.a.net` y `y.x.a.net`, no `a.net`).
 *
 * No confundir con `FORGE_INTEGRACIONES_DESTINOS` (adónde se PUBLICA, core/integraciones/config.js):
 * esta política dice a qué destinos puede apuntar el CÓDIGO que escribe el agente.
 */

import { leerVariableRestrictiva } from '../entorno.js';

export const VARIABLE_DESTINOS_PERMITIDOS = 'FRAGUA_DESTINOS_PERMITIDOS';

/**
 * @param {Record<string, string | undefined>} [env]
 * @returns {{ destinos_permitidos: string[] }}
 */
export function leerPoliticaDestinos(env = process.env) {
  // Función única de lectura: con las dos formas distintas gana lo más restrictivo (lista vacía)
  const crudo = leerVariableRestrictiva('DESTINOS_PERMITIDOS', env, '');
  const lista = typeof crudo === 'string'
    ? crudo.split(',').map((x) => x.trim().toLowerCase()).filter((x) => x !== '')
    : [];
  return { destinos_permitidos: lista };
}

/**
 * @param {string} host
 * @param {string[]} permitidos
 */
export function destinoPermitido(host, permitidos) {
  const h = host.toLowerCase();
  return permitidos.some((p) => {
    const q = String(p).toLowerCase();
    if (q.startsWith('*.')) return h.endsWith(q.slice(1)) && h.length > q.length - 1;
    return h === q;
  });
}
