/**
 * jira.js — Adaptador de Jira Cloud (REST v3) para el puerto de integraciones
 *
 * Tres operaciones y una comprobación, nada genérico (ADR-22):
 *
 *   leerElemento      GET  /rest/api/3/issue/{CLAVE}  y  .../comment   (descripción y comentarios ADF → texto)
 *   comentar          POST /rest/api/3/issue/{CLAVE}/comment           (idempotente por marcador `FORGE-ID:`)
 *   proponerCambio    NO EXISTE en Jira: lanza `OperacionNoSoportada`; el modo `proponer` se trata como `comentar`
 *   comprobarAlcance  `no_comprobable`: Jira no documenta cómo ver los ámbitos de un token (spike S0.4)
 *
 * Autenticación: Basic `usuario:token` sobre HTTPS contra `https://<sitio>.atlassian.net`, solo con
 * token SIN ámbitos. Con ámbitos la base de la API cambia (`api.atlassian.com/ex/jira/{cloudId}`) y
 * el `cloudId` está «sin confirmar»: ese caso no se intenta y devuelve `no_soportado`.
 *
 * Seguridad:
 *   - el par usuario/token vive solo en la clausura de `crearProveedorJira`: no es propiedad del
 *     objeto, no entra en ningún mensaje propio y el cliente HTTP enmascara cabeceras y Base64;
 *   - la clave del ticket se valida con una regex estricta y su proyecto debe estar en `destinos`
 *     ANTES de cualquier petición; la ruta se arma con `encodeURIComponent`;
 *   - nada del texto de la plataforma entra en rutas ni cabeceras; los errores llevan solo el
 *     estado HTTP y un código tipado, nunca el cuerpo de la respuesta;
 *   - la URL del elemento se construye aquí (`https://<sitio>/browse/<CLAVE>`), no se copia de la
 *     respuesta, y no se sigue.
 *
 * Las firmas aceptan las dos formas: la del puerto (`destino, referencia, ...`) y la abreviada
 * (`referencia, ...`) en que el proyecto sale de la clave.
 */

import { pedir } from '../http.js';
import { redactar } from '../../ciclo/redactar.js';
import { adfATexto, textoAAdf } from './jira-adf.js';
import { MODOS } from '../puerto.js';
import { exigirHostAutorizado } from '../hosts.js';
import { derivarMarcador } from '../marcador.js';
import { leerBaseLocal } from '../pruebas-internas.js';

export const NOMBRE = 'jira';

const CLAVE = /^[A-Z][A-Z0-9_]{1,19}-\d{1,9}$/;
const PROYECTO = /^[A-Z][A-Z0-9_]{1,9}$/;
const SITIO = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.atlassian\.net$/;
const MARCADOR_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const ID_COMENTARIO = /^\d{1,20}$/;

/** Peticiones de comentarios: 100 por página y 10 páginas como máximo. */
const POR_PAGINA = 100;
const MAX_PAGINAS = 10;
/** Topes de texto: conservadores, la plataforma no documenta un máximo (sin confirmar). */
export const MAX_BYTES_COMENTARIO = 16 * 1024;
const MAX_BYTES_DESCRIPCION = 64 * 1024;
const MAX_BYTES_COMENTARIO_LEIDO = 16 * 1024;
const MAX_BYTES_RESPUESTA = 1024 * 1024;

export class ErrorJira extends Error {
  /**
   * @param {string} codigo  minúsculas y «_», ≤ 30 (el registro de auditoría guarda solo esto)
   * @param {string} mensaje sin credenciales ni texto de la plataforma
   */
  constructor(codigo, mensaje) {
    super(mensaje);
    this.name = 'ErrorJira';
    this.codigo = codigo;
  }
}

/** Jira no tiene solicitudes de cambio: quien llama debe tratar `proponer` como `comentar`. */
export class OperacionNoSoportada extends ErrorJira {
  /** @param {string} [mensaje] */
  constructor(mensaje) {
    super('operacion_no_soportada', mensaje ?? 'Jira no tiene un equivalente de «proponer un cambio» (rama y solicitud): la operación no existe. En el modo «proponer», Jira se trata como «comentar».');
    this.name = 'OperacionNoSoportada';
    this.operacion = 'proponerCambio';
  }
}

/**
 * @typedef {import('../puerto.js').ElementoDeTrabajo} ElementoDeTrabajo
 *
 * @typedef {Object} ResultadoJira
 * @property {string} id
 * @property {string} [url]
 * @property {boolean} yaExistia   el marcador ya estaba en un comentario: no se publicó otro
 *
 * @typedef {Object} AlcanceJira
 * @property {'no_comprobable'|'no_soportado'} estado
 * @property {string} motivo
 * @property {boolean} lectura      siempre false: no verificado (ver `verificable`)
 * @property {boolean} escritura    siempre false: no verificado
 * @property {boolean} excede       siempre false: no verificado
 * @property {boolean} verificable  siempre false
 * @property {string} detalle
 *
 * @typedef {Object} OpcionesJira
 * @property {string} sitio                 `nombre.atlassian.net`
 * @property {string} usuario               correo del usuario de servicio
 * @property {string} token                 token de API SIN ámbitos
 * @property {string[]} destinos            claves de proyecto permitidas
 * @property {'apagado'|'solo_lectura'|'comentar'|'proponer'} modo  OBLIGATORIO (R4): cada operación exige su modo mínimo
 * @property {Record<string, string|undefined>} [env]  entorno del que sale FORGE_INTEGRACIONES_HOSTS (por defecto process.env)
 * @property {(o: import('../http.js').OpcionesPedir) => Promise<import('../http.js').RespuestaHttp>} [http]  por defecto `pedir`
 * @property {{ ejecutar: (o: { proveedor: string, operacion: string, destino: string, accion: () => Promise<any> }) => Promise<any>, comprobarInterruptor?: () => void }} [auditoria]  OBLIGATORIA para escribir (R5)
 * @property {boolean} [conAmbitos]         la configuración indica un token con ámbitos: no soportado
 */

// ── Validación de entrada ───────────────────────────────────────────────────────────────────

/**
 * Separa y valida `CLAVE-N`. No lanza datos de entrada en el mensaje.
 * @param {unknown} referencia
 * @returns {{ clave: string, proyecto: string }}
 */
function analizarReferencia(referencia) {
  if (typeof referencia !== 'string' || !CLAVE.test(referencia)) {
    throw new ErrorJira('referencia_no_valida', 'La referencia de Jira debe tener la forma CLAVE-N (por ejemplo ABC-123).');
  }
  return { clave: referencia, proyecto: referencia.slice(0, referencia.lastIndexOf('-')) };
}

/** @param {unknown} v */
const esTextoLimpio = (v, min, max) => typeof v === 'string' && v.length >= min && v.length <= max && !/[\u0000-\u001F\u007F\s]/.test(v);

/**
 * Crea el adaptador de Jira Cloud.
 * @param {OpcionesJira} opciones
 * @returns {import('../puerto.js').ProveedorDeTrabajo & { leerElemento: Function, comentar: Function, proponerCambio: Function, comprobarAlcance: Function }}
 */
export function crearProveedorJira(opciones) {
  const o = opciones && typeof opciones === 'object' ? opciones : /** @type {OpcionesJira} */ ({});
  const modo = o.modo;
  if (!(/** @type {readonly string[]} */ (MODOS)).includes(/** @type {string} */ (modo))) {
    throw new ErrorJira('modo_no_valido', 'El modo de Jira es obligatorio y debe ser apagado, solo_lectura, comentar o proponer (sin valor por defecto).');
  }
  const { env = process.env } = o;

  // ── Sitio y soporte ───────────────────────────────────────────────────────────────────────
  const sitio = typeof o.sitio === 'string' ? o.sitio.trim().toLowerCase() : '';
  const esAtlassianNet = SITIO.test(sitio);
  const parecenAmbitos = /^(?:https?:\/\/)?api\.atlassian\.com(?:\/.*)?$/.test(sitio);
  if (!esAtlassianNet && !parecenAmbitos) {
    throw new ErrorJira('sitio_no_valido', 'El sitio de Jira debe ser nombre.atlassian.net (Jira Cloud; Data Center no se admite).');
  }
  /** @type {string|null} motivo por el que no se soporta, o null */
  const noSoportado = o.conAmbitos === true
    ? 'Un token de Jira CON ámbitos usa otra base de la API (api.atlassian.com/ex/jira/{cloudId}) y el cloudId está sin confirmar en la documentación: esta entrega solo admite un token sin ámbitos contra <sitio>.atlassian.net.'
    : (parecenAmbitos ? 'El sitio indica la API con ámbitos (api.atlassian.com): esta entrega solo admite un token sin ámbitos contra <sitio>.atlassian.net.' : null);

  // ── Credenciales (solo en la clausura) ────────────────────────────────────────────────────
  const usuario = o.usuario;
  const token = o.token;
  if (!esTextoLimpio(usuario, 3, 254) || String(usuario).includes(':')) {
    throw new ErrorJira('credenciales_no_validas', 'El usuario de Jira falta o no tiene un formato válido (correo sin espacios ni «:»).');
  }
  if (!esTextoLimpio(token, 8, 512)) {
    throw new ErrorJira('credenciales_no_validas', 'El token de Jira falta o no tiene un formato válido.');
  }
  const autorizacion = 'Basic ' + Buffer.from(`${usuario}:${token}`, 'utf8').toString('base64');

  // ── Destinos ──────────────────────────────────────────────────────────────────────────────
  if (!Array.isArray(o.destinos) || o.destinos.length === 0 || !o.destinos.every((d) => typeof d === 'string' && PROYECTO.test(d))) {
    throw new ErrorJira('destinos_no_validos', 'Los destinos de Jira son una lista no vacía de claves de proyecto en mayúsculas (por ejemplo ABC).');
  }
  const destinos = Object.freeze([...new Set(o.destinos)]);

  // ── Conexión ──────────────────────────────────────────────────────────────────────────────
  // R1: un sitio de Jira es siempre de un cliente: solo se acepta si está en FORGE_INTEGRACIONES_HOSTS (variable
  // del USUARIO). R12: un servidor local solo existe en el interruptor interno de pruebas.
  let host = sitio;
  let local = false;
  const base = leerBaseLocal(/** @type {any} */ (o), (m) => new ErrorJira('base_no_valida', m));
  if (base) {
    host = base.host;
    local = true;
  } else if (esAtlassianNet) {
    try { host = exigirHostAutorizado('jira', sitio, env); } catch (e) {
      throw new ErrorJira('host_no_autorizado', e instanceof Error ? e.message : 'host no autorizado');
    }
  }
  const http = typeof o.http === 'function' ? o.http : pedir;
  const auditoria = o.auditoria;
  const urlVisible = (clave) => `https://${esAtlassianNet ? sitio : 'jira.invalid'}/browse/${encodeURIComponent(clave)}`;

  // ── Utilidades internas ───────────────────────────────────────────────────────────────────

  /**
   * @param {string} operacion @param {string} destino @param {() => Promise<any>} accion
   */
  const auditar = (operacion, destino, accion) => (auditoria
    ? auditoria.ejecutar({ proveedor: NOMBRE, operacion, destino, accion })
    : accion());

  /** R4: cada operación exige su modo mínimo; sin red. @param {'solo_lectura'|'comentar'|'proponer'} minimo */
  function exigirModo(minimo) {
    if (modo === 'apagado') throw new ErrorJira('modo', 'La integración con Jira está apagada.');
    if (MODOS.indexOf(modo) < MODOS.indexOf(minimo)) throw new ErrorJira('modo', `La operación pide el modo «${minimo}» y Jira está en «${modo}».`);
  }

  /** R5: escribir sin auditoría (interruptor, tope y registro) no es posible: fallo cerrado. */
  function exigirAuditoria() {
    if (!auditoria || typeof auditoria.ejecutar !== 'function') {
      throw new ErrorJira('auditoria_obligatoria', 'Escribir en Jira exige una auditoría (interruptor, tope y registro); no hay ninguna.');
    }
  }

  /**
   * Una petición a la API. El estado HTTP no OK se convierte en un error tipado SIN cuerpo.
   * @param {string} ruta @param {'GET'|'POST'} metodo @param {object} [cuerpo]
   * @returns {Promise<unknown>}  JSON ya interpretado
   */
  async function llamar(ruta, metodo, cuerpo) {
    // R9: el interruptor se mira antes de CADA petición de escritura, no solo al empezar la operación
    if (metodo !== 'GET') auditoria?.comprobarInterruptor?.();
    /** @type {Record<string, string>} */
    const cabeceras = { Authorization: autorizacion, Accept: 'application/json' };
    /** @type {import('../http.js').RespuestaHttp} */
    let r;
    try {
      r = await http({
        host, ruta, metodo, cabeceras,
        ...(cuerpo !== undefined ? { cuerpo } : {}),
        permitidos: [host], maxBytes: MAX_BYTES_RESPUESTA,
        ...(local ? { _permitirLocal: true } : {}),
      });
    } catch (e) {
      throw enmascararError(e);
    }
    if (!r.ok) throw errorDeEstado(r.estado);
    try {
      return JSON.parse(r.texto);
    } catch {
      throw new ErrorJira('respuesta_invalida', 'Jira devolvió una respuesta que no es JSON válido.');
    }
  }

  /**
   * Defensa en profundidad: aunque `http.js` ya enmascara, un error de cualquier origen que lleve
   * el token, el usuario o el Base64 se reemplaza por uno limpio antes de salir del adaptador.
   * @param {unknown} e
   */
  function enmascararError(e) {
    const secretos = [autorizacion, autorizacion.slice(6), `${usuario}:${token}`, String(token), String(usuario)].filter((x) => x.length >= 3).sort((a, b) => b.length - a.length);
    const mensaje = e instanceof Error ? e.message : String(e);
    let limpio = mensaje;
    for (const x of secretos) limpio = limpio.split(x).join('[REDACTADO]');
    limpio = redactar(limpio).slice(0, 300);
    if (e instanceof Error && limpio === mensaje && !secretos.some((x) => String(e.stack ?? '').includes(x))) return e;
    const codigo = e && typeof /** @type {any} */ (e).codigo === 'string' && /^[a-z_]{1,30}$/.test(/** @type {any} */ (e).codigo) ? /** @type {any} */ (e).codigo : 'error_red';
    return new ErrorJira(codigo, limpio);
  }

  /** @param {number} estado */
  function errorDeEstado(estado) {
    const e = Number.isInteger(estado) ? estado : 0;
    if (e === 401) return new ErrorJira('no_autenticado', 'Jira rechazó las credenciales (401). Revisa el usuario y el token de servicio.');
    if (e === 403) return new ErrorJira('sin_permiso', 'Jira respondió 403: el usuario de servicio no tiene permiso para esta operación.');
    if (e === 404) return new ErrorJira('no_encontrado', 'Jira respondió 404: el ticket no existe o el usuario de servicio no tiene permiso para verlo.');
    if (e === 400) return new ErrorJira('peticion_invalida', 'Jira respondió 400: petición no válida.');
    if (e === 413) return new ErrorJira('demasiado_grande', 'Jira respondió 413: se superó el límite por ticket.');
    if (e === 429) return new ErrorJira('limite_ritmo', 'Jira respondió 429: límite de ritmo; reintenta más tarde.');
    if (e >= 500) return new ErrorJira('error_plataforma', `Jira respondió ${e}: error de la plataforma.`);
    return new ErrorJira('estado_inesperado', `Jira respondió con un estado inesperado (${e}).`);
  }

  /** Acepta (referencia) o (destino, referencia) y comprueba el destino ANTES de cualquier red. @param {string} clave */
  function exigirDestino(clave) {
    const { proyecto } = analizarReferencia(clave);
    if (!destinos.includes(proyecto)) {
      throw new ErrorJira('destino_no_permitido', 'El proyecto del ticket no está en la lista de destinos permitidos de Jira.');
    }
    return proyecto;
  }

  function exigirSoporte() {
    if (noSoportado) throw new ErrorJira('no_soportado', noSoportado);
  }

  /** @param {unknown} v @returns {v is Record<string, any>} */
  const esObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

  /**
   * Comentarios de un ticket, paginados con tope, ya como texto.
   * @param {string} clave
   * @returns {Promise<{ comentarios: Array<{ id: string, autor: string, cuenta: string, cuerpo: string }>, completo: boolean }>}
   */
  async function leerComentarios(clave) {
    const base = `/rest/api/3/issue/${encodeURIComponent(clave)}/comment`;
    /** @type {Array<{ id: string, autor: string, cuenta: string, cuerpo: string }>} */
    const salida = [];
    let inicio = 0;
    let total = Infinity;
    for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
      const p = await llamar(`${base}?startAt=${inicio}&maxResults=${POR_PAGINA}&orderBy=created`, 'GET');
      if (!esObj(p) || !Array.isArray(p.comments) || !Number.isInteger(p.total) || p.total < 0) {
        throw new ErrorJira('respuesta_inesperada', 'La lista de comentarios de Jira no tiene la forma esperada.');
      }
      for (const c of p.comments) {
        if (!esObj(c)) throw new ErrorJira('respuesta_inesperada', 'Un comentario de Jira no tiene la forma esperada.');
        const id = typeof c.id === 'string' || typeof c.id === 'number' ? String(c.id) : '';
        if (!ID_COMENTARIO.test(id)) throw new ErrorJira('respuesta_inesperada', 'Un comentario de Jira trae un identificador inesperado.');
        const autor = esObj(c.author) && typeof c.author.displayName === 'string' ? c.author.displayName.slice(0, 120) : '';
        const cuerpo = typeof c.body === 'string' ? c.body.slice(0, MAX_BYTES_COMENTARIO_LEIDO) : adfATexto(c.body, { maxBytes: MAX_BYTES_COMENTARIO_LEIDO });
        const cuenta = esObj(c.author) && typeof c.author.accountId === 'string' ? c.author.accountId : '';
        salida.push({ id, autor: autor || 'desconocido', cuenta, cuerpo });
      }
      total = p.total;
      inicio += p.comments.length;
      if (p.comments.length === 0 || inicio >= total) return { comentarios: salida, completo: true };
    }
    return { comentarios: salida, completo: inicio >= total };
  }

  /**
   * Normaliza los argumentos de `leerElemento`: (referencia) o (destino, referencia).
   * @param {unknown[]} a @returns {string}
   */
  function referenciaDe(a) {
    if (a.length >= 2 && typeof a[1] === 'string') {
      const clave = a[1];
      const { proyecto } = analizarReferencia(clave);
      if (a[0] !== proyecto) throw new ErrorJira('destino_no_coincide', 'El destino indicado no coincide con el proyecto de la referencia.');
      return clave;
    }
    return /** @type {string} */ (a[0]);
  }

  // ── Operaciones ───────────────────────────────────────────────────────────────────────────

  /**
   * Trae el ticket y sus comentarios, normalizados al tipo del puerto.
   * @param {...unknown} args  (referencia) | (destino, referencia)
   * @returns {Promise<ElementoDeTrabajo>}
   */
  async function leerElemento(...args) {
    exigirModo('solo_lectura');
    const clave = referenciaDe(args);
    const proyecto = exigirDestino(clave);
    exigirSoporte();
    return auditar('leer_elemento', proyecto, async () => {
      const t = await llamar(`/rest/api/3/issue/${encodeURIComponent(clave)}?fields=summary,description,labels`, 'GET');
      if (!esObj(t) || !esObj(t.fields) || t.key !== clave || typeof t.fields.summary !== 'string') {
        throw new ErrorJira('respuesta_inesperada', 'El ticket de Jira no tiene la forma esperada (o es otra clave: tickets movidos no se siguen).');
      }
      const f = t.fields;
      const d = f.description;
      if (d !== null && d !== undefined && typeof d !== 'string' && !esObj(d)) {
        throw new ErrorJira('respuesta_inesperada', 'La descripción del ticket de Jira no tiene la forma esperada.');
      }
      const etiquetas = Array.isArray(f.labels) ? f.labels.filter((x) => typeof x === 'string').map((x) => x.slice(0, 100)).slice(0, 50) : [];
      const { comentarios } = await leerComentarios(clave);
      return {
        proveedor: NOMBRE,
        destino: proyecto,
        referencia: clave,
        titulo: f.summary.slice(0, 1000),
        cuerpo: typeof d === 'string' ? d.slice(0, MAX_BYTES_DESCRIPCION) : adfATexto(d, { maxBytes: MAX_BYTES_DESCRIPCION }),
        etiquetas,
        comentarios: comentarios.map((c) => ({ autor: c.autor, cuerpo: c.cuerpo })),
        url: urlVisible(clave),
      };
    });
  }

  /**
   * Publica un comentario, una sola vez por marcador.
   * Formas: `(referencia, texto, { marcador })` y la del puerto `(destino, referencia, texto, idempotencia)`.
   * @param {...unknown} args
   * @returns {Promise<ResultadoJira>}
   */
  async function comentar(...args) {
    /** @type {unknown} */ let referencia;
    /** @type {unknown} */ let texto;
    /** @type {unknown} */ let marcador;
    if (args.length >= 4 || (args.length === 3 && typeof args[2] === 'string')) {
      referencia = referenciaDe([args[0], args[1]]);
      texto = args[2];
      marcador = args[3];
    } else {
      referencia = args[0];
      texto = args[1];
      marcador = esObj(args[2]) ? args[2].marcador : undefined;
    }
    exigirModo('comentar');
    exigirAuditoria();
    const { clave } = analizarReferencia(referencia);
    const proyecto = exigirDestino(clave);
    exigirSoporte();
    if (typeof marcador !== 'string' || !MARCADOR_ID.test(marcador)) {
      throw new ErrorJira('marcador_no_valido', 'Falta el marcador de idempotencia o no es válido (letras, dígitos, «.», «_», «:» o «-», hasta 64).');
    }
    if (typeof texto !== 'string' || texto.trim() === '') {
      throw new ErrorJira('texto_vacio', 'El texto del comentario está vacío.');
    }
    // Antes de redactar: el trabajo de redactar no puede depender de un texto sin tope (R2)
    if (texto.length > MAX_BYTES_COMENTARIO * 4) {
      throw new ErrorJira('texto_demasiado_grande', `El comentario supera el tope de ${MAX_BYTES_COMENTARIO} bytes; no se recorta en silencio.`);
    }
    // El texto saliente no puede traer líneas de idempotencia propias: envenenarían otra tarea (R7)
    if (/^\s*FORGE-ID\s*:/im.test(texto)) {
      throw new ErrorJira('texto_no_valido', 'El comentario no puede traer líneas «FORGE-ID:» propias de FORGE.');
    }
    // Lo saliente también se redacta: la barrera de FORGE no depende de quien llame
    const limpio = redactar(texto);
    if (Buffer.byteLength(limpio, 'utf8') > MAX_BYTES_COMENTARIO) {
      throw new ErrorJira('texto_demasiado_grande', `El comentario supera el tope de ${MAX_BYTES_COMENTARIO} bytes; no se recorta en silencio.`);
    }

    return auditar('comentar', proyecto, async () => {
      // R7: solo vale el comentario que escribió la cuenta del propio token (GET /myself). Si el marcador
      // está en un comentario AJENO (o no se sabe de quién es), se publica uno propio con un marcador
      // derivado: quien copia el marcador solo puede provocar una publicación adicional, no suprimirla.
      let yo = null;
      try {
        const me = await llamar('/rest/api/3/myself', 'GET');
        if (esObj(me) && typeof me.accountId === 'string' && me.accountId !== '') yo = me.accountId;
      } catch { yo = null; }
      const previos = await leerComentarios(clave);
      let m = marcador;
      for (let i = 0; i <= previos.comentarios.length; i++) {
        const lineaM = `FORGE-ID: ${m}`;
        const hallados = previos.comentarios.filter((c) => c.cuerpo.split('\n').some((l) => l.trim() === lineaM));
        const propio = yo === null ? undefined : hallados.find((c) => c.cuenta === yo);
        if (propio) {
          return /** @type {ResultadoJira} */ ({ id: propio.id, url: `${urlVisible(clave)}?focusedCommentId=${propio.id}`, yaExistia: true });
        }
        if (hallados.length === 0) break;
        m = derivarMarcador(m);
      }
      const linea = `FORGE-ID: ${m}`;
      if (!previos.completo) {
        throw new ErrorJira('idempotencia_no_verificable', 'El ticket tiene más comentarios de los que se revisan; no se publica sin poder comprobar el marcador.');
      }
      const r = await llamar(`/rest/api/3/issue/${encodeURIComponent(clave)}/comment`, 'POST', {
        body: textoAAdf(`${limpio.trimEnd()}\n\n${linea}`, { maxBytes: MAX_BYTES_COMENTARIO + 512 }),
      });
      const id = esObj(r) && (typeof r.id === 'string' || typeof r.id === 'number') ? String(r.id) : '';
      if (!ID_COMENTARIO.test(id)) {
        throw new ErrorJira('respuesta_inesperada', 'La respuesta de Jira al comentar no trae un identificador válido.');
      }
      return /** @type {ResultadoJira} */ ({ id, url: `${urlVisible(clave)}?focusedCommentId=${id}`, yaExistia: false });
    });
  }

  /**
   * Jira no tiene solicitudes de cambio. Siempre lanza `OperacionNoSoportada`, sin red.
   * @returns {Promise<never>}
   */
  async function proponerCambio() {
    throw new OperacionNoSoportada();
  }

  /**
   * Jira no documenta cómo ver los ámbitos de un token; no hay petición (spike S0.4).
   * @returns {Promise<AlcanceJira>}
   */
  async function comprobarAlcance() {
    const estado = noSoportado ? 'no_soportado' : 'no_comprobable';
    const motivo = noSoportado
      ?? 'Jira no ofrece un endpoint documentado que devuelva los ámbitos de un token de API (GET /mypermissions informa de los permisos del usuario, no del token). El control real es el modo y la lista de destinos; declara el alcance del token en la configuración.';
    return { estado, motivo, lectura: false, escritura: false, excede: false, verificable: false, detalle: motivo };
  }

  return Object.freeze({
    nombre: NOMBRE,
    leerElemento,
    comentar,
    proponerCambio,
    comprobarAlcance,
  });
}
