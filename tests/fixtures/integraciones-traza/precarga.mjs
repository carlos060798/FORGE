// @ts-check
/**
 * Precarga para tests/integraciones-aislamiento.test.js (se usa con `--import` / NODE_OPTIONS).
 *
 * Deja constancia, en el archivo que indica FORGE_TRAZA_INTEGRACIONES, de tres cosas:
 *   - `fetch`: cualquier llamada al `fetch` global (que además lanza: la suite no toca la red);
 *   - `env`: cualquier lectura de una variable de entorno que parezca de credenciales de una plataforma;
 *   - `modulo`: cualquier módulo de core/integraciones/ o cli/integraciones.js que llegue a resolverse
 *     (un gancho de resolución: ve lo que se importa de verdad, también con import() dinámico).
 */

import { appendFileSync } from 'node:fs';
import { register } from 'node:module';

const traza = process.env.FORGE_TRAZA_INTEGRACIONES;
if (!traza) throw new Error('Falta FORGE_TRAZA_INTEGRACIONES');

const anotar = (tipo, dato) => appendFileSync(traza, JSON.stringify({ tipo, dato }) + '\n');

globalThis.fetch = /** @type {any} */ (async (entrada) => {
  anotar('fetch', String(entrada?.url ?? entrada));
  throw new Error('fetch bloqueado por la prueba de aislamiento');
});

// FORGE_API_TOKEN es del servidor HTTP local de FORGE, anterior a las integraciones: no cuenta
const SOSPECHOSA = /^(?!FORGE_API_TOKEN$)(?:.*TOKEN|.*GITHUB|.*GITLAB|.*JIRA|.*ATLASSIAN|FORGE_INTEGRACIONES)/i;
// Copiar el entorno entero (`{ ...process.env }`, o child_process al lanzar un hijo) toca TODAS las
// claves de forma síncrona tras `ownKeys`. Eso no es leer un token: solo cuenta la lectura directa.
let enumerando = false;
process.env = new Proxy(process.env, {
  ownKeys(objetivo) {
    enumerando = true;
    queueMicrotask(() => { enumerando = false; });
    return Reflect.ownKeys(objetivo);
  },
  get(objetivo, clave, receptor) {
    if (!enumerando && typeof clave === 'string' && SOSPECHOSA.test(clave)) anotar('env', clave);
    return Reflect.get(objetivo, clave, receptor);
  },
  has(objetivo, clave) {
    if (typeof clave === 'string' && SOSPECHOSA.test(clave)) anotar('env', clave);
    return Reflect.has(objetivo, clave);
  },
});

register(new URL('./ganchos.mjs', import.meta.url), { data: { traza } });
