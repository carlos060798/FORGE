/**
 * github.js — Adaptador de GitHub para el puerto de integraciones (ADR-22, tarea F2.1)
 *
 * Tres operaciones fijas y ninguna genérica, más la comprobación de alcance:
 *
 *   leerElemento(referencia)                    GET incidencia + comentarios (paginados, acotados)
 *   comentar(referencia, texto, { marcador })   idempotente: busca el marcador oculto antes de publicar
 *   proponerCambio({ destino, base, rama, ... }) rama NUEVA `forge/…` + solicitud de cambio en BORRADOR
 *   comprobarAlcance()                          «no_comprobable»: GitHub no permite consultarlo (sin red)
 *
 * Reglas (todas comprobadas ANTES de la primera petición):
 *   - el destino (`owner/repo`) debe estar en la lista cerrada; igualdad exacta, sin comodines;
 *   - cada componente de ruta sale de una expresión regular estricta y pasa por `encodeURIComponent`;
 *   - el token solo viaja en la cabecera `Authorization`, desde `http.js` (que ya lo enmascara);
 *     además, todo mensaje de error de este módulo se enmascara con el token;
 *   - el texto de la plataforma es DATO: se devuelve tal cual, jamás se interpola en rutas,
 *     cabeceras ni mensajes de error, y los enlaces de la respuesta no se siguen: las URL del
 *     resultado se construyen aquí con owner/repo/número ya validados;
 *   - nunca borra, nunca fusiona, nunca escribe en una rama existente ni en la base.
 *
 * Orden al proponer un cambio (decisión de seguridad): se LEE todo primero (repositorio, rama base,
 * que la rama nueva no exista, commit base); se crean blobs, árbol y commit (objetos sin rama: si
 * algo falla ahí no queda ninguna rama) y solo al final se crea la referencia `refs/heads/forge/…`
 * apuntando al commit ya hecho, y la solicitud. Si falla después de crear la rama, NO se borra: el
 * error (código `parcial`) nombra la rama y la causa para que una persona decida.
 */

import { pedir as pedirHttp } from '../http.js';
import { MODOS } from '../puerto.js';
import { exigirHostAutorizado } from '../hosts.js';
import { motivoRutaVetada } from '../rutas.js';
import { derivarMarcador } from '../marcador.js';
import { leerBaseLocal } from '../pruebas-internas.js';

export const PROVEEDOR = 'github';
export const BASE_POR_DEFECTO = 'api.github.com';
export const PREFIJO_RAMA = 'forge/';

/**
 * Tope del texto de un comentario o de la descripción de una solicitud, marcador incluido.
 * La documentación oficial leída NO da el máximo (sin confirmar); informes de la comunidad hablan de
 * 65 536 caracteres. 60 000 deja margen para el marcador y es conservador: preferimos rechazar un
 * texto largo aquí, con un mensaje claro, que dejar que la plataforma devuelva un 422.
 */
export const MAX_TEXTO = 60000;
export const MAX_PAGINAS = 10;                       // 1 000 comentarios como mucho
export const MAX_BYTES_RESPUESTA = 1024 * 1024;      // por respuesta (lo corta http.js)
export const MAX_BYTES_COMENTARIOS = 2 * 1024 * 1024; // suma de todas las páginas
export const MAX_ARCHIVOS = 20;
export const MAX_BYTES_ARCHIVOS = 1024 * 1024;       // suma del contenido de la propuesta
const POR_PAGINA = 100;
const MAX_ETIQUETAS = 100;
const VERSION_API = '2022-11-28';

const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO = /^(?!\.{1,2}$)[A-Za-z0-9._-]{1,100}$/;
const REFERENCIA = /^([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/((?!\.{1,2}#)[A-Za-z0-9._-]{1,100})#([1-9][0-9]{0,8})$/;
const MARCADOR = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const SEGMENTO_RAMA = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const SHA = /^[0-9a-f]{40}$/;
const CONTROL = /[\u0000-\u001F\u007F-\u009F\u2028\u2029]/;
/** Título: ni controles ni formato (bidi, ancho cero) ni rellenos invisibles (R14). */
const TITULO_PROHIBIDO = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}\u2028\u2029\u3164\u2800\u034F\u115F\u1160\uFFA0]/u;

export class ErrorGitHub extends Error {
  /**
   * @param {string} codigo  minúsculas y «_» (la auditoría lo usa como sufijo del resultado)
   * @param {string} mensaje ya enmascarado
   * @param {{ estado?: number, rama?: string, causa?: string }} [extra]
   */
  constructor(codigo, mensaje, extra = {}) {
    super(mensaje);
    this.name = 'ErrorGitHub';
    this.codigo = codigo;
    if (extra.estado !== undefined) this.estado = extra.estado;
    if (extra.rama !== undefined) this.rama = extra.rama;
    if (extra.causa !== undefined) this.causa = extra.causa;
  }
}

/**
 * @typedef {import('../puerto.js').ElementoDeTrabajo & {
 *   estado: string, autor: string, tipo: 'incidencia'|'solicitud_de_cambio', truncado?: boolean,
 * }} ElementoGitHub
 *
 * @typedef {{ id: string, url: string, existente: boolean }} ComentarioPublicado
 * @typedef {{ id: string, url: string, borrador: boolean, rama: string }} CambioPropuesto
 *
 * @typedef {Object} OpcionesGitHub
 * @property {string} token
 * @property {string[]} destinos            `owner/repo`, lista cerrada
 * @property {'apagado'|'solo_lectura'|'comentar'|'proponer'} modo  OBLIGATORIO: cada operación exige su modo mínimo (R4)
 * @property {typeof pedirHttp} [http]      sustituible en pruebas; por defecto el cliente de http.js
 * @property {{ ejecutar: Function, comprobarInterruptor?: Function }} [auditoria]  OBLIGATORIA para escribir (R5)
 * @property {Record<string, string|undefined>} [env]  entorno del que sale FORGE_INTEGRACIONES_HOSTS (por defecto process.env)
 */

// ── Validación (sin red) ────────────────────────────────────────────────────────────────────

/** @param {unknown} v */
const esObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * R1/R12: solo api.github.com por HTTPS; un servidor local únicamente por el interruptor interno de pruebas.
 * @param {Record<string | symbol, unknown>} opciones
 * @param {Record<string, string|undefined>} env
 * @returns {{ host: string, local: boolean }}
 */
function resolverBase(opciones, env) {
  const local = leerBaseLocal(opciones, (m) => new TypeError(m));
  if (local) return { host: local.host, local: true };
  return { host: exigirHostAutorizado('github', BASE_POR_DEFECTO, env), local: false };
}

/**
 * Nombre de rama (base o nueva): segmentos separados por «/», cada uno de un alfabeto cerrado.
 * @param {unknown} nombre
 */
function ramaValida(nombre) {
  if (typeof nombre !== 'string' || nombre.length > 200) return false;
  const partes = nombre.split('/');
  if (partes.length > 5) return false;
  return partes.every((p) => SEGMENTO_RAMA.test(p) && !p.includes('..') && !p.endsWith('.lock') && !p.endsWith('.'));
}

/** Codifica cada segmento de un nombre de rama; la «/» entre segmentos se conserva. @param {string} rama */
const rutaDeRama = (rama) => rama.split('/').map(encodeURIComponent).join('/');

/**
 * @param {unknown} ruta
 * @returns {string|null} motivo del rechazo, o null si es válida
 */
function motivoRutaInvalida(ruta) {
  // Lista COMÚN con GitLab (R3, R8): CI de las plataformas, .git y sus variantes, nombres de Windows…
  return motivoRutaVetada(ruta);
}

// ── Fábrica ─────────────────────────────────────────────────────────────────────────────────

/**
 * @param {OpcionesGitHub} opciones
 */
export function crearProveedorGitHub(opciones = /** @type {any} */ ({})) {
  const { token, destinos, http, auditoria, env = process.env } = opciones ?? {};
  const modo = opciones?.modo;
  if (!(/** @type {readonly string[]} */ (MODOS)).includes(modo)) {
    throw new TypeError(`modo: es obligatorio y debe ser uno de ${MODOS.join(', ')} (sin valor por defecto: ninguno es permisivo por omisión)`);
  }
  if (typeof token !== 'string' || token.trim() === '' || CONTROL.test(token)) {
    throw new TypeError('token: se esperaba el valor del token como texto no vacío, sin caracteres de control');
  }
  if (!Array.isArray(destinos) || destinos.length === 0) throw new TypeError('destinos: se esperaba una lista cerrada no vacía de «owner/repo»');
  /** @type {string[]} */
  const permitidos = [];
  for (const d of destinos) {
    const m = typeof d === 'string' ? /^([^/]+)\/([^/]+)$/.exec(d) : null;
    if (!m || !OWNER.test(m[1]) || !REPO.test(m[2])) throw new TypeError('destinos: cada destino debe tener la forma owner/repo (sin comodines)');
    permitidos.push(d.toLowerCase());
  }
  const base = resolverBase(opciones, env);
  const cliente = http ?? pedirHttp;
  const secreto = token.trim();
  const cabeceras = Object.freeze({
    authorization: `Bearer ${secreto}`,
    accept: 'application/vnd.github+json',
    'x-github-api-version': VERSION_API,
  });

  /** @param {unknown} t */
  const enmascarar = (t) => String(t ?? '').split(secreto).join('[REDACTADO]').replace(CONTROL, ' ').slice(0, 400);
  /** @param {string} codigo @param {string} mensaje @param {{ estado?: number, rama?: string, causa?: string }} [extra] */
  const fallo = (codigo, mensaje, extra) => new ErrorGitHub(codigo, enmascarar(mensaje), extra);

  // ── Validaciones de entrada ──────────────────────────────────────────────────────────────

  /** @param {unknown} destino @returns {{ owner: string, repo: string, destino: string }} */
  function validarDestino(destino) {
    const m = typeof destino === 'string' && destino.length <= 160 ? /^([^/]+)\/([^/]+)$/.exec(destino) : null;
    if (!m || !OWNER.test(m[1]) || !REPO.test(m[2])) throw fallo('destino_no_valido', 'el destino debe tener la forma owner/repo');
    if (!permitidos.includes(`${m[1]}/${m[2]}`.toLowerCase())) {
      throw fallo('destino_no_permitido', 'el destino no está en la lista de destinos permitidos');
    }
    return { owner: m[1], repo: m[2], destino: `${m[1]}/${m[2]}` };
  }

  /** @param {unknown} referencia */
  function validarReferencia(referencia) {
    const m = typeof referencia === 'string' && referencia.length <= 160 ? REFERENCIA.exec(referencia) : null;
    if (!m) throw fallo('referencia_no_valida', 'la referencia debe tener la forma owner/repo#número');
    const d = validarDestino(`${m[1]}/${m[2]}`);
    return { ...d, numero: Number(m[3]), referencia: `${d.destino}#${m[3]}` };
  }

  /** @param {unknown} marcador */
  function validarMarcador(marcador) {
    if (typeof marcador !== 'string' || !MARCADOR.test(marcador)) {
      throw fallo('marcador_no_valido', 'el marcador es obligatorio y solo admite letras, dígitos, «.», «_», «:» y «-» (máx. 64)');
    }
    return marcador;
  }

  /** El comentario HTML oculto que se añade al final del texto. @param {string} marcador */
  const etiqueta = (marcador) => `<!-- forge:${marcador} -->`;

  // ── Red ───────────────────────────────────────────────────────────────────────────────────

  /**
   * @param {string} metodo @param {string} ruta @param {object} [cuerpo]
   */
  async function peticion(metodo, ruta, cuerpo) {
    // R9: el interruptor se mira antes de CADA petición de escritura, no solo al empezar la operación
    if (metodo !== 'GET' && metodo !== 'HEAD') auditoria?.comprobarInterruptor?.();
    return cliente({
      host: base.host,
      ruta,
      metodo,
      cabeceras: { ...cabeceras },
      ...(cuerpo !== undefined ? { cuerpo } : {}),
      permitidos: [base.host],
      maxBytes: MAX_BYTES_RESPUESTA,
      _permitirLocal: base.local,
    });
  }

  /**
   * Traduce un estado HTTP de error a un error tipado. Nunca usa el cuerpo de la respuesta.
   * @param {import('../http.js').RespuestaHttp} r @param {string} que
   */
  function errorDeEstado(r, que) {
    const e = r.estado;
    const conRitmo = r.cabeceras['retry-after'] !== undefined || r.cabeceras['x-ratelimit-remaining'] === '0';
    if (e === 401) return fallo('credencial_invalida', `GitHub rechazó la credencial al ${que} (token caducado, revocado o mal escrito)`, { estado: e });
    if ((e === 403 || e === 429) && conRitmo) return fallo('limite_ritmo', `GitHub aplicó un límite de ritmo al ${que}; espera y reintenta más tarde`, { estado: e });
    if (e === 429) return fallo('limite_ritmo', `GitHub aplicó un límite de ritmo al ${que}; espera y reintenta más tarde`, { estado: e });
    // El spike (permisos-minimos.md §1.5): sin permiso GitHub responde 404 o 403 y no se distinguen de «no existe»
    if (e === 404 || e === 403) return fallo('sin_permiso_o_no_existe', `no hay permiso para ${que} o el recurso no existe (GitHub no distingue ambos casos)`, { estado: e });
    if (e === 410) return fallo('no_disponible', `el recurso ya no está disponible al ${que} (borrado o con las incidencias desactivadas)`, { estado: e });
    if (e === 409) return fallo('conflicto', `GitHub informó de un conflicto al ${que}`, { estado: e });
    if (e === 422) return fallo('rechazado_por_plataforma', `GitHub rechazó la petición al ${que} (validación)`, { estado: e });
    if (e === 503) return fallo('plataforma_no_disponible', `GitHub no está disponible al ${que}`, { estado: e });
    return fallo('error_plataforma', `respuesta inesperada de GitHub (HTTP ${e}) al ${que}`, { estado: e });
  }

  /**
   * Pide, exige 2xx y devuelve el JSON. Un cuerpo que no es JSON es un error tipado, no `undefined`.
   * @param {string} metodo @param {string} ruta @param {string} que @param {object} [cuerpo]
   */
  async function json(metodo, ruta, que, cuerpo) {
    const r = await peticion(metodo, ruta, cuerpo);
    if (!r.ok) throw errorDeEstado(r, que);
    let v;
    try { v = JSON.parse(r.texto); } catch { throw fallo('respuesta_invalida', `la respuesta de GitHub al ${que} no es JSON válido`); }
    return v;
  }

  const invalida = (que) => fallo('respuesta_invalida', `la respuesta de GitHub al ${que} no tiene la forma esperada`);

  /** @param {unknown} v @param {string} que */
  function exigirObjeto(v, que) {
    if (!esObjeto(v)) throw invalida(que);
    return /** @type {Record<string, any>} */ (v);
  }

  /** @param {unknown} v @param {string} que */
  function exigirId(v, que) {
    const o = exigirObjeto(v, que);
    if (!Number.isSafeInteger(o.id) || o.id < 1) throw invalida(que);
    return o;
  }

  /** @param {unknown} v @param {string} que */
  function exigirSha(v, que) {
    if (typeof v !== 'string' || !SHA.test(v)) throw invalida(que);
    return v;
  }

  /** @param {unknown} u */
  const loginDe = (u) => (esObjeto(u) && typeof /** @type {any} */ (u).login === 'string' ? /** @type {any} */ (u).login : 'desconocido');

  const rutaRepo = (d) => `/repos/${encodeURIComponent(d.owner)}/${encodeURIComponent(d.repo)}`;

  /**
   * Lista los comentarios por páginas, con tope de páginas y de bytes. Pagina por número de página:
   * jamás sigue el enlace `Link` de la respuesta.
   * @param {{ owner: string, repo: string, numero: number }} t
   * @returns {Promise<{ items: Array<{ id: number, autor: string, cuerpo: string }>, completo: boolean }>}
   */
  async function listarComentarios(t) {
    const que = 'listar los comentarios';
    /** @type {Array<{ id: number, autor: string, cuerpo: string }>} */
    const items = [];
    let bytes = 0;
    for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
      const ruta = `${rutaRepo(t)}/issues/${t.numero}/comments?per_page=${POR_PAGINA}&page=${pagina}`;
      const r = await peticion('GET', ruta);
      if (!r.ok) throw errorDeEstado(r, que);
      bytes += Buffer.byteLength(r.texto, 'utf8');
      if (bytes > MAX_BYTES_COMENTARIOS) return { items, completo: false };
      let v;
      try { v = JSON.parse(r.texto); } catch { throw fallo('respuesta_invalida', `la respuesta de GitHub al ${que} no es JSON válido`); }
      if (!Array.isArray(v)) throw invalida(que);
      for (const c of v) {
        const o = exigirId(c, que);
        if (o.body !== null && typeof o.body !== 'string') throw invalida(que);
        items.push({ id: o.id, autor: loginDe(o.user), cuerpo: o.body ?? '' });
      }
      if (v.length < POR_PAGINA) return { items, completo: true };
    }
    return { items, completo: false };
  }

  /**
   * Ejecuta bajo la auditoría si la hay. Las validaciones de entrada se hacen ANTES (no cuentan).
   * @template T
   * @param {string} operacion @param {string} destino @param {() => Promise<T>} accion
   * @returns {Promise<T>}
   */
  function auditar(operacion, destino, accion) {
    if (!auditoria) return accion();
    return auditoria.ejecutar({ proveedor: PROVEEDOR, operacion, destino, accion });
  }

  /** R4: cada operación exige su modo mínimo; sin red. @param {'solo_lectura'|'comentar'|'proponer'} minimo */
  function exigirModo(minimo) {
    if (modo === 'apagado') throw fallo('modo', 'la integración con GitHub está apagada');
    if (MODOS.indexOf(modo) < MODOS.indexOf(minimo)) throw fallo('modo', `la operación pide el modo «${minimo}» y GitHub está en «${modo}»`);
  }

  /** R5: escribir sin auditoría (interruptor, tope y registro) no es posible: fallo cerrado. */
  function exigirAuditoria() {
    if (!auditoria || typeof auditoria.ejecutar !== 'function') {
      throw fallo('auditoria_obligatoria', 'escribir en GitHub exige una auditoría (interruptor, tope y registro); no hay ninguna');
    }
  }

  /**
   * Cuenta propia (el dueño del token), en minúsculas, o null si no se puede comprobar. R7.
   * @returns {Promise<string|null>}
   */
  async function cuentaPropia() {
    try {
      const r = await peticion('GET', '/user');
      if (!r.ok) return null;
      const v = JSON.parse(r.texto);
      return esObjeto(v) && typeof v.login === 'string' && v.login !== '' ? v.login.toLowerCase() : null;
    } catch { return null; }
  }

  // ── Operaciones ───────────────────────────────────────────────────────────────────────────

  /**
   * @param {string} referencia  `owner/repo#N`
   * @returns {Promise<ElementoGitHub>}
   */
  async function leerElemento(referencia) {
    exigirModo('solo_lectura');
    const t = validarReferencia(referencia);
    return auditar('leer_elemento', t.destino, async () => {
      const que = 'leer la incidencia';
      const o = exigirObjeto(await json('GET', `${rutaRepo(t)}/issues/${t.numero}`, que), que);
      if (o.number !== t.numero) throw invalida(que);
      if (typeof o.title !== 'string') throw invalida(que);
      if (o.body !== null && o.body !== undefined && typeof o.body !== 'string') throw invalida(que);
      if (typeof o.state !== 'string') throw invalida(que);
      if (o.labels !== undefined && !Array.isArray(o.labels)) throw invalida(que);
      /** @type {string[]} */
      const etiquetas = [];
      for (const l of (o.labels ?? []).slice(0, MAX_ETIQUETAS)) {
        const nombre = typeof l === 'string' ? l : (esObjeto(l) ? l.name : undefined);
        if (typeof nombre !== 'string') throw invalida(que);
        etiquetas.push(nombre);
      }

      let comentarios = [];
      let truncado = false;
      // `comments` es solo una pista para ahorrar una petición: si no es un 0 entero, se pregunta
      if (o.comments !== 0) {
        const lista = await listarComentarios(t);
        comentarios = lista.items.map((c) => ({ autor: c.autor, cuerpo: c.cuerpo }));
        truncado = !lista.completo;
      }

      const esCambio = o.pull_request !== undefined && o.pull_request !== null;
      /** @type {ElementoGitHub} */
      const elemento = {
        proveedor: PROVEEDOR,
        destino: t.destino,
        referencia: t.referencia,
        titulo: o.title,
        cuerpo: o.body ?? '',
        etiquetas,
        comentarios,
        url: `https://github.com/${t.owner}/${t.repo}/${esCambio ? 'pull' : 'issues'}/${t.numero}`,
        estado: /^[a-z_]{1,20}$/.test(o.state) ? o.state : 'desconocido',
        autor: loginDe(o.user),
        tipo: esCambio ? 'solicitud_de_cambio' : 'incidencia',
      };
      if (truncado) elemento.truncado = true;
      return elemento;
    });
  }

  /**
   * @param {string} referencia
   * @param {string} texto
   * @param {{ marcador: string }} opciones
   * @returns {Promise<ComentarioPublicado>}
   */
  async function comentar(referencia, texto, opciones) {
    exigirModo('comentar');
    exigirAuditoria();
    const t = validarReferencia(referencia);
    const marcador = validarMarcador(opciones?.marcador);
    if (typeof texto !== 'string' || texto.trim() === '') throw fallo('texto_no_valido', 'el texto del comentario debe ser un texto no vacío');
    if (/<!--\s*forge:/i.test(texto)) throw fallo('texto_no_valido', 'el comentario no puede traer marcadores propios de FORGE');
    const completoMax = `${texto}\n\n${etiqueta(marcador)}`;
    if (completoMax.length > MAX_TEXTO) {
      throw fallo('texto_demasiado_largo', `el comentario supera ${MAX_TEXTO} caracteres (tope conservador propio; GitHub no documenta el límite)`);
    }
    return auditar('comentar', t.destino, async () => {
      const yo = await cuentaPropia();
      const lista = await listarComentarios(t);
      // R7: solo vale el comentario que escribió la cuenta del propio token. Si el marcador está en un
      // comentario AJENO (o no se sabe de quién es), se publica uno propio con un marcador derivado:
      // quien copia el marcador solo puede provocar una publicación adicional, nunca suprimirla.
      let m = marcador;
      for (let i = 0; i <= lista.items.length; i++) {
        const marca = etiqueta(m);
        // Solo cuenta si el marcador cierra el cuerpo: es donde lo pone este adaptador
        const hallados = lista.items.filter((c) => c.cuerpo.trimEnd().endsWith(marca));
        const previo = yo === null ? undefined : hallados.find((c) => c.autor.toLowerCase() === yo);
        if (previo) {
          return { id: String(previo.id), url: `https://github.com/${t.owner}/${t.repo}/issues/${t.numero}#issuecomment-${previo.id}`, existente: true };
        }
        if (hallados.length === 0) break;
        m = derivarMarcador(m);
      }
      const completo = `${texto}\n\n${etiqueta(m)}`;
      if (!lista.completo) {
        // No se vieron todos los comentarios: publicar podría duplicar
        throw fallo('idempotencia_no_comprobable', 'la incidencia tiene demasiados comentarios para comprobar si ya se publicó; no se publica para no duplicar');
      }
      const que = 'publicar el comentario';
      const c = exigirId(await json('POST', `${rutaRepo(t)}/issues/${t.numero}/comments`, que, { body: completo }), que);
      return { id: String(c.id), url: `https://github.com/${t.owner}/${t.repo}/issues/${t.numero}#issuecomment-${c.id}`, existente: false };
    });
  }

  /**
   * @param {{ destino: string, base: string, rama: string, archivos: Array<{ ruta: string, contenido: string }>,
   *           titulo: string, descripcion?: string, marcador: string }} p
   * @returns {Promise<CambioPropuesto>}
   */
  async function proponerCambio(p) {
    exigirModo('proponer');
    exigirAuditoria();
    if (!esObjeto(p)) throw fallo('propuesta_no_valida', 'la propuesta debe ser un objeto');
    const d = validarDestino(p.destino);
    const marcador = validarMarcador(p.marcador);

    if (!ramaValida(p.base)) throw fallo('base_no_valida', 'la rama base no tiene un nombre válido');
    if (typeof p.rama !== 'string' || !p.rama.startsWith(PREFIJO_RAMA)) {
      throw fallo('prefijo_rama', `la rama nueva debe empezar por «${PREFIJO_RAMA}»`);
    }
    const resto = p.rama.slice(PREFIJO_RAMA.length);
    if (!ramaValida(p.rama) || resto.includes('/')) throw fallo('rama_no_valida', 'el nombre de la rama nueva no es válido (un solo nivel tras «forge/», letras, dígitos, «.», «_», «-»)');
    if (p.rama === p.base) throw fallo('rama_no_valida', 'la rama nueva no puede ser la base');

    if (!Array.isArray(p.archivos) || p.archivos.length === 0) throw fallo('archivos_no_validos', 'hay que proponer al menos un archivo');
    if (p.archivos.length > MAX_ARCHIVOS) throw fallo('archivos_no_validos', `la propuesta supera ${MAX_ARCHIVOS} archivos`);
    const vistas = new Set();
    let bytes = 0;
    for (const a of p.archivos) {
      if (!esObjeto(a)) throw fallo('archivos_no_validos', 'cada archivo debe ser { ruta, contenido }');
      const motivo = motivoRutaInvalida(a.ruta);
      if (motivo) throw fallo('ruta_archivo_no_valida', `ruta de archivo rechazada: ${motivo}`);
      const clave = a.ruta.toLowerCase();
      if (vistas.has(clave)) throw fallo('archivos_no_validos', 'hay dos archivos con la misma ruta');
      vistas.add(clave);
      if (typeof a.contenido !== 'string') throw fallo('archivos_no_validos', 'el contenido de cada archivo debe ser texto');
      bytes += Buffer.byteLength(a.contenido, 'utf8');
    }
    if (bytes > MAX_BYTES_ARCHIVOS) throw fallo('archivos_no_validos', `el contenido total supera ${MAX_BYTES_ARCHIVOS} bytes`);

    if (typeof p.titulo !== 'string' || p.titulo.trim() === '' || p.titulo.length > 256 || TITULO_PROHIBIDO.test(p.titulo)) {
      throw fallo('titulo_no_valido', 'el título debe ser un texto de una línea, de 1 a 256 caracteres, sin controles, bidireccionales ni caracteres de ancho cero');
    }
    const descripcion = typeof p.descripcion === 'string' ? p.descripcion : '';
    if (p.descripcion !== undefined && typeof p.descripcion !== 'string') throw fallo('texto_no_valido', 'la descripción debe ser texto');
    const marca = etiqueta(marcador);
    const cuerpoPr = descripcion === '' ? marca : `${descripcion}\n\n${marca}`;
    if (cuerpoPr.length > MAX_TEXTO) throw fallo('texto_demasiado_largo', `la descripción supera ${MAX_TEXTO} caracteres`);

    const base0 = p.base;
    const rama = p.rama;
    return auditar('proponer_cambio', d.destino, async () => {
      const repo = rutaRepo(d);

      // 1. Solo lecturas: que el repositorio exista y sea legible, y la base
      const r0 = exigirObjeto(await json('GET', repo, 'comprobar el repositorio'), 'comprobar el repositorio');
      if (r0.archived === true) throw fallo('repositorio_archivado', 'el repositorio está archivado: no admite cambios');

      const refBase = exigirObjeto(await json('GET', `${repo}/git/ref/heads/${rutaDeRama(base0)}`, 'leer la rama base'), 'leer la rama base');
      const shaBase = exigirSha(exigirObjeto(refBase.object, 'leer la rama base').sha, 'leer la rama base');

      // 2. La rama nueva NO debe existir (200 = existe: error, sin tocarla). 404 = libre.
      const rRama = await peticion('GET', `${repo}/git/ref/heads/${rutaDeRama(rama)}`);
      if (rRama.ok) throw fallo('rama_existe', `la rama «${rama}» ya existe en ${d.destino}; no se escribe en ramas existentes`);
      if (rRama.estado !== 404) throw errorDeEstado(rRama, 'comprobar que la rama nueva no existe');

      const commitBase = exigirObjeto(await json('GET', `${repo}/git/commits/${shaBase}`, 'leer el commit base'), 'leer el commit base');
      const arbolBase = exigirSha(exigirObjeto(commitBase.tree, 'leer el commit base').sha, 'leer el commit base');

      // 3. Objetos sin rama: si algo falla aquí no queda ninguna rama
      // Cuerpos de blobs/trees/commits: la fuente del spike no los leyó (sin confirmar); forma habitual de la API Git Data.
      /** @type {Array<{ path: string, mode: string, type: string, sha: string }>} */
      const entradas = [];
      for (const a of p.archivos) {
        const b = exigirObjeto(await json('POST', `${repo}/git/blobs`, 'subir un archivo', { content: a.contenido, encoding: 'utf-8' }), 'subir un archivo');
        entradas.push({ path: a.ruta, mode: '100644', type: 'blob', sha: exigirSha(b.sha, 'subir un archivo') });
      }
      const arbol = exigirObjeto(await json('POST', `${repo}/git/trees`, 'crear el árbol', { base_tree: arbolBase, tree: entradas }), 'crear el árbol');
      const arbolNuevo = exigirSha(arbol.sha, 'crear el árbol');
      const mensaje = `${p.titulo}\n\nforge:${marcador}`;
      const commit = exigirObjeto(await json('POST', `${repo}/git/commits`, 'crear el commit', { message: mensaje, tree: arbolNuevo, parents: [shaBase] }), 'crear el commit');
      const shaCommit = exigirSha(commit.sha, 'crear el commit');

      // 4. La rama: es lo primero que deja huella. Si ya existe (carrera), GitHub responde 422 y no se toca.
      const rRef = await peticion('POST', `${repo}/git/refs`, { ref: `refs/heads/${rama}`, sha: shaCommit });
      if (!rRef.ok) {
        if (rRef.estado === 422) throw fallo('rama_existe', `no se pudo crear «${rama}»: ya existe o la plataforma la rechazó; no se tocó ninguna rama`, { estado: 422 });
        throw errorDeEstado(rRef, 'crear la rama');
      }

      // 5. La solicitud en borrador. Si falla, la rama se queda: este módulo nunca borra.
      try {
        const que = 'abrir la solicitud de cambio';
        const pr = exigirObjeto(await json('POST', `${repo}/pulls`, que, { title: p.titulo, head: rama, base: base0, body: cuerpoPr, draft: true }), que);
        if (!Number.isSafeInteger(pr.number) || pr.number < 1) throw invalida(que);
        return {
          id: String(pr.number),
          url: `https://github.com/${d.owner}/${d.repo}/pull/${pr.number}`,
          // La respuesta puede no traer `draft` (sin confirmar): solo se afirma borrador si GitHub lo dice
          borrador: pr.draft === true,
          rama,
        };
      } catch (e) {
        const causa = typeof /** @type {any} */ (e)?.codigo === 'string' ? /** @type {any} */ (e).codigo : 'desconocida';
        throw fallo('parcial',
          `La rama «${rama}» SE CREÓ en ${d.destino} (commit ${shaCommit}) pero no se abrió la solicitud de cambio (causa: ${causa}). FORGE no borra ramas: una persona debe decidir si la abre a mano o la elimina.`,
          { rama, causa });
      }
    });
  }

  /**
   * GitHub no permite consultar el alcance de un token de grano fino (spike S0.2): no se hace
   * ninguna petición y el resultado lo dice con claridad, para que `doctor` lo muestre.
   * @returns {Promise<{ estado: 'no_comprobable', motivo: string }>}
   */
  async function comprobarAlcance() {
    return {
      estado: 'no_comprobable',
      motivo: 'GitHub no ofrece un endpoint para consultar los permisos de un token de grano fino; solo se sabe qué le falta al intentar una operación. Revisa en GitHub que el token tenga únicamente Issues, Contents y Pull requests sobre los repositorios de la lista.',
    };
  }

  return Object.freeze({
    nombre: PROVEEDOR,
    leerElemento,
    comentar,
    proponerCambio,
    comprobarAlcance,
  });
}
