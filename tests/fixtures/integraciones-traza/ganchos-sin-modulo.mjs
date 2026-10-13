// @ts-check
/** Gancho de resolución: el módulo de integraciones «no existe» (ver sin-modulo.mjs). */

export async function resolve(especificador, contexto, siguiente) {
  const r = await siguiente(especificador, contexto);
  if (/\/core\/integraciones\/|\/cli\/integraciones(?:-activas)?\.js$/.test(r.url)) {
    const e = new Error(`Cannot find module '${especificador}' (simulado: versión sin el módulo de integraciones)`);
    /** @type {any} */ (e).code = 'ERR_MODULE_NOT_FOUND';
    throw e;
  }
  return r;
}
