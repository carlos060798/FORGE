/**
 * puerto.js — Contrato de un proveedor de trabajo (GitHub, GitLab, Jira)
 *
 * ADR-22: tres operaciones fijas por proveedor (leer, comentar, proponer un cambio) más la
 * comprobación de alcance del token. NO existe una operación genérica «llamar a la API»: un
 * proveedor que la exponga se rechaza aquí, de modo que ninguna capa superior pueda usarla.
 *
 * Este módulo no hace red ni lee el entorno. Solo tipos y una validación de forma.
 */

/** Nombres de proveedor que FORGE conoce (los adaptadores llegan en la fase F2). */
export const PROVEEDORES = Object.freeze(['github', 'gitlab', 'jira']);

/** Modos de escritura, de menos a más permisivo. */
export const MODOS = Object.freeze(['apagado', 'solo_lectura', 'comentar', 'proponer']);

/** Operaciones del contrato, tal como se llaman en el objeto proveedor. */
export const OPERACIONES = Object.freeze(['leerElemento', 'comentar', 'proponerCambio', 'comprobarAlcance']);

/**
 * Nombres que delatan una operación genérica. Un proveedor que los tenga no cumple el contrato.
 * @type {readonly string[]}
 */
const GENERICAS = Object.freeze([
  'llamar', 'llamarApi', 'api', 'pedir', 'request', 'fetch', 'ejecutar', 'exec', 'invocar', 'raw', 'http',
]);

/**
 * @typedef {'github'|'gitlab'|'jira'} NombreProveedor
 *
 * @typedef {Object} ComentarioDeElemento
 * @property {string} autor
 * @property {string} cuerpo
 *
 * @typedef {Object} ElementoDeTrabajo  Forma común de una incidencia o ticket, ya normalizada.
 * @property {string} proveedor
 * @property {string} destino          repositorio, proyecto o clave de proyecto permitido
 * @property {string} referencia       identificador legible (`org/repo#12`, `ABC-34`)
 * @property {string} titulo
 * @property {string} cuerpo
 * @property {string[]} etiquetas
 * @property {ComentarioDeElemento[]} comentarios
 * @property {string} [url]            solo informativa: nunca se sigue
 * @property {string} [estado]         estado de la plataforma, solo informativo
 * @property {string} [autor]
 * @property {'incidencia'|'solicitud_de_cambio'} [tipo]
 * @property {boolean} [truncado]      se cortó por un tope de páginas o de bytes
 *
 * @typedef {Object} ArchivoPropuesto
 * @property {string} ruta
 * @property {string} contenido
 *
 * @typedef {Object} PropuestaDeCambio
 * @property {string} rama             con el prefijo fijo `forge/`
 * @property {string} titulo
 * @property {string} descripcion
 * @property {ArchivoPropuesto[]} archivos
 *
 * @typedef {Object} ResultadoDePublicacion
 * @property {string} id
 * @property {string} [url]
 * @property {boolean} [borrador]    solo es true si la plataforma lo confirmó en su respuesta
 * @property {boolean} [yaExistia]    el marcador ya estaba publicado: no se escribió nada
 * @property {string} [rama]          rama creada, en `proponerCambio`
 *
 * @typedef {Object} AlcanceDelToken
 * @property {'comprobado'|'no_comprobable'|'no_soportado'} [estado]  `no_comprobable`: la plataforma no permite saberlo (GitHub y Jira)
 * @property {string} [motivo]
 * @property {string[]} [ambitos]      solo con `estado: 'comprobado'` (GitLab con token personal)
 * @property {boolean} [suficiente]
 * @property {boolean} [lectura]
 * @property {boolean} [escritura]
 * @property {boolean} [excede]        el token puede más de lo necesario
 * @property {boolean} [verificable]   false si la plataforma no permite saberlo sin escribir
 * @property {string} [detalle]        sin el valor del token
 *
 * @typedef {Object} ProveedorDeTrabajo
 * @property {string} nombre
 * @property {(referencia: string) => Promise<ElementoDeTrabajo>} leerElemento  la referencia lleva el destino (`org/repo#7`, `ABC-7`) y se valida contra la lista antes de cualquier petición
 * @property {(referencia: string, texto: string, opciones: { marcador: string }) => Promise<ResultadoDePublicacion>} comentar  idempotente por `marcador`
 * @property {(propuesta: PropuestaDeCambio & { destino: string, base: string, marcador: string }) => Promise<ResultadoDePublicacion>} proponerCambio  solo rama nueva `forge/` y solicitud en borrador; en Jira lanza `OperacionNoSoportada`
 * @property {() => Promise<AlcanceDelToken>} comprobarAlcance
 */

/**
 * Comprueba la forma de un proveedor. No lo ejecuta.
 * @param {unknown} obj
 * @returns {{ ok: boolean, faltan: string[], genericas: string[] }}
 */
export function validarProveedor(obj) {
  /** @type {string[]} */
  const faltan = [];
  /** @type {string[]} */
  const genericas = [];
  if (obj === null || typeof obj !== 'object') {
    return { ok: false, faltan: ['nombre', ...OPERACIONES], genericas };
  }
  const p = /** @type {Record<string, unknown>} */ (obj);
  if (typeof p.nombre !== 'string' || !/^[a-z][a-z0-9_-]{0,30}$/.test(p.nombre)) faltan.push('nombre');
  for (const op of OPERACIONES) {
    if (typeof p[op] !== 'function') faltan.push(op);
  }
  // Se mira también la cadena de prototipos: una clase con un método genérico lo tiene ahí
  const vistos = new Set();
  for (let o = /** @type {any} */ (obj); o && o !== Object.prototype; o = Object.getPrototypeOf(o)) {
    for (const k of Object.getOwnPropertyNames(o)) vistos.add(k);
  }
  for (const k of vistos) {
    if (GENERICAS.includes(k) && typeof p[k] === 'function') genericas.push(k);
  }
  return { ok: faltan.length === 0 && genericas.length === 0, faltan, genericas };
}

/**
 * Como `validarProveedor`, pero lanza con un mensaje que dice qué falta.
 * @param {unknown} obj
 * @returns {ProveedorDeTrabajo}
 */
export function exigirProveedor(obj) {
  const r = validarProveedor(obj);
  if (!r.ok) {
    const partes = [];
    if (r.faltan.length) partes.push(`falta: ${r.faltan.join(', ')}`);
    if (r.genericas.length) partes.push(`operación genérica no permitida: ${r.genericas.join(', ')}`);
    throw new TypeError(`El proveedor no cumple el contrato de integraciones (${partes.join('; ')})`);
  }
  return /** @type {ProveedorDeTrabajo} */ (obj);
}
