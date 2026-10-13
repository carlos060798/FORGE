/**
 * pruebas-internas.js — El interruptor interno de pruebas de los adaptadores (R12)
 *
 * Los adaptadores solo hablan con hosts públicos por HTTPS. Para probarlos contra un servidor de
 * `node:http` en 127.0.0.1, las pruebas pasan la URL local con la clave `BASE_LOCAL`, que es un
 * SÍMBOLO exportado desde aquí: no existe una opción pública de texto (`baseUrl`) que la CLI, la
 * configuración del proyecto o un JSON puedan rellenar. Un `baseUrl` normal se rechaza con un error.
 *
 * Nada en `core/` ni en `cli/` importa este símbolo salvo los propios adaptadores para leerlo.
 */

/** Clave de opción reservada a las pruebas: `{ [BASE_LOCAL]: 'http://127.0.0.1:<puerto>' }`. */
export const BASE_LOCAL = Symbol.for('forge.integraciones.base-local-de-pruebas');

/**
 * @param {Record<string | symbol, unknown>} opciones
 * @param {(mensaje: string) => Error} crearError
 * @returns {{ host: string } | null}  null si no hay base local
 */
export function leerBaseLocal(opciones, crearError) {
  if (opciones && Object.prototype.hasOwnProperty.call(opciones, 'baseUrl') && /** @type {any} */ (opciones).baseUrl !== undefined) {
    throw crearError('baseUrl ya no es una opción: las pruebas usan el interruptor interno (core/integraciones/pruebas-internas.js); en producción solo se habla con hosts públicos por HTTPS.');
  }
  const valor = opciones?.[BASE_LOCAL];
  if (valor === undefined) return null;
  /** @type {URL} */
  let u;
  try { u = new URL(String(valor)); } catch { throw crearError('la base local de pruebas no es una URL válida.'); }
  const limpia = u.protocol === 'http:' && (u.hostname === '127.0.0.1' || u.hostname === 'localhost')
    && !u.username && !u.password && (u.pathname === '/' || u.pathname === '') && !u.search && !u.hash;
  if (!limpia) throw crearError('la base local de pruebas solo admite http://127.0.0.1:<puerto> o http://localhost:<puerto>.');
  return { host: u.host };
}
