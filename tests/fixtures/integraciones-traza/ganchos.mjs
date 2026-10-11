// @ts-check
/** Gancho de resolución de módulos de la precarga (ver precarga.mjs). Corre en el hilo de los ganchos. */

import { appendFileSync } from 'node:fs';

let traza = '';

export function initialize(datos) {
  traza = datos.traza;
}

export async function resolve(especificador, contexto, siguiente) {
  const r = await siguiente(especificador, contexto);
  if (/\/core\/integraciones\/|\/cli\/integraciones\.js$/.test(r.url)) {
    appendFileSync(traza, JSON.stringify({ tipo: 'modulo', dato: r.url }) + '\n');
  }
  return r;
}
