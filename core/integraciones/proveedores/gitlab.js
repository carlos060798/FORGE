/**
 * gitlab.js — Adaptador de GitLab (API REST v4) para el puerto de integraciones
 *
 * Cuatro operaciones fijas y ninguna más (ADR-22): leer una incidencia con sus notas, comentar,
 * proponer un cambio (rama nueva `forge/…` + commit + solicitud de fusión en borrador) y comprobar
 * el alcance del token. No hay forma de «llamar a la API» desde fuera de este módulo.
 *
 * Fuente de rutas, permisos y formas: spikes/permisos-minimos.md y spikes/contratos-respuesta.md.
 * Lo que esos documentos marcan «sin confirmar» se resuelve aquí por la vía más conservadora y lleva
 * un comentario `SIN CONFIRMAR`; las pruebas contra una instancia real son opt-in
 * (`FORGE_TEST_INTEGRACIONES=1`, ver tests/integraciones-gitlab.test.js).
 *
 * Seguridad:
 *   - el token solo viaja en la cabecera `PRIVATE-TOKEN`, y solo a través de `http.js`, que ya exige
 *     HTTPS, host de la lista y enmascara el valor en sus errores. Aquí además ningún mensaje propio
 *     lo incluye y, por si algo lo arrastrara, `proteger` lo enmascara antes de que un error salga;
 *   - cada componente de ruta pasa por una expresión regular acotada y luego por `encodeURIComponent`
 *     (el «/» del espacio de nombres viaja como `%2F`);
 *   - el texto de la plataforma es un DATO: se devuelve tal cual y nunca llega a una ruta, a una
 *     orden ni a una decisión del adaptador;
 *   - nunca borra, nunca escribe en una rama que ya existe ni en la base, nunca fusiona ni cierra.
 */

import { pedir } from '../http.js';
import { destinoPermitido } from '../config.js';

export const NOMBRE = 'gitlab';
/** Prefijo obligatorio de toda rama que FORGE crea. */
export const PREFIJO_RAMA = 'forge/';
/** Prefijo del título que GitLab documenta para marcar una solicitud como borrador. */
export const PREFIJO_BORRADOR = 'Draft: ';

const MAX_PAGINAS = 5;                     // × 100 notas
const POR_PAGINA = 100;
const MAX_BYTES_RESPUESTA = 1024 * 1024;
const MAX_BYTES_NOTAS = 4 * 1024 * 1024;   // suma de todas las páginas de notas
const MAX_TEXTO_COMENTARIO = 60000;        // caracteres; el límite de GitLab es 1 000 000 (conservador a propósito)
const MAX_DESCRIPCION = 60000;
const MAX_TITULO = 200;
const MAX_ARCHIVOS = 20;
const MAX_BYTES_ARCHIVO = 256 * 1024;
const MAX_BYTES_TOTAL = 1024 * 1024;
const MAX_RUTA_ARCHIVO = 255;

const SEGMENTO = '[A-Za-z0-9_][A-Za-z0-9._-]{0,99}';
/** `grupo/subgrupo/proyecto`: de 2 a 20 segmentos, sin `.` ni `..`. */
const RE_DESTINO = new RegExp(`^${SEGMENTO}(?:/${SEGMENTO}){1,19}$`);
const RE_REFERENCIA = new RegExp(`^(${SEGMENTO}(?:/${SEGMENTO}){1,19})#([1-9][0-9]{0,8})$`);
const RE_MARCADOR = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/;
const RE_RAMA_DESTINO = /^forge\/[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;
const RE_RAMA_BASE = /^[A-Za-z0-9][A-Za-z0-9._\/-]{0,199}$/;
const RE_AMBITO = /^[a-z][a-z_]{0,39}$/;
const PROHIBIDOS = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}]/u;

/** Ámbitos que necesita cada modo con un token personal (permisos-minimos.md §2.2 y §2.3). */
const AMBITOS_NECESARIOS = Object.freeze({
  solo_lectura: ['read_api'],
  comentar: ['api'],
  proponer: ['api'],
});

export class ErrorGitLab extends Error {
  /**
   * @param {string} codigo  `[a-z_]{1,30}`: es lo único del error que va al evento de auditoría
   * @param {string} mensaje
   * @param {Record<string, string|number>} [extra]  datos no secretos (rama, etapa…)
   */
  constructor(codigo, mensaje, extra = {}) {
    super(mensaje);
    this.name = 'ErrorGitLab';
    this.codigo = codigo;
    Object.assign(this, extra);
  }
}

const estadoComoCodigo = (s) => (s === 401 ? 'no_autorizado' : s === 403 ? 'prohibido' : s === 404 ? 'no_encontrado' : s === 429 ? 'limite' : 'respuesta_http');

/** @param {unknown} v @returns {v is Record<string, any>} */
const esObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Nombre de rama que se puede usar como base: acotado y sin las formas que Git rechaza.
 * @param {unknown} n
 */
function ramaBaseValida(n) {
  return typeof n === 'string' && RE_RAMA_BASE.test(n) && !n.includes('..') && !n.includes('//') && !n.endsWith('/') && !n.endsWith('.') && !n.endsWith('.lock') && !n.includes('/.') && !n.includes('@{');
}

/**
 * Valida la ruta de un archivo propuesto. Devuelve el motivo del rechazo o null.
 * @param {unknown} ruta
 * @returns {string|null}
 */
function motivoRutaInvalida(ruta) {
  if (typeof ruta !== 'string' || ruta === '') return 'vacía o no es texto';
  if (ruta.length > MAX_RUTA_ARCHIVO) return 'demasiado larga';
  if (PROHIBIDOS.test(ruta)) return 'tiene caracteres de control o invisibles';
  if (ruta.startsWith('/') || /^[A-Za-z]:/.test(ruta) || ruta.includes('\\')) return 'es absoluta o usa «\\» o unidad de disco';
  const segmentos = ruta.split('/');
  for (const s of segmentos) {
    if (s === '') return 'tiene un segmento vacío';
    if (s === '.' || s === '..') return 'sale del proyecto («.» o «..»)';
    if (s.toLowerCase() === '.git') return 'toca el directorio .git';
    if (s !== s.trim() || s.endsWith('.')) return 'un segmento empieza o acaba por espacio, o acaba en «.»';
  }
  return null;
}

/**
 * @typedef {Object} OpcionesGitLab
 * @property {string} token                   valor del token (lo lee quien llama con `leerToken`); nunca se registra
 * @property {string} [host]                  host de la API sin esquema (ya validado por config.js); HTTPS siempre
 * @property {string[]} destinos              lista cerrada `grupo[/subgrupo]/proyecto`
 * @property {'apagado'|'solo_lectura'|'comentar'|'proponer'} [modo]  por defecto `solo_lectura` (lo más estrecho)
 * @property {(o: import('../http.js').OpcionesPedir) => Promise<import('../http.js').RespuestaHttp>} [http]  solo pruebas; por defecto `pedir`
 * @property {import('../auditoria.js').AuditoriaIntegraciones} [auditoria]  si se pasa, toda operación va por ella
 * @property {string} [baseUrl]               SOLO pruebas: `http://127.0.0.1:<puerto>` o `http://localhost:<puerto>`
 * @property {null|'draft'|'work_in_progress'} [parametroBorrador]  además del prefijo del título, envía este parámetro (por defecto no; ver la prueba opt-in)
 * @property {number} [maxBytes]              tope de cada respuesta
 * @property {number} [timeoutMs]
 * @property {(ms: number) => Promise<void>} [_esperar]  solo pruebas
 */

/**
 * @param {OpcionesGitLab} opciones
 */
export function crearProveedorGitLab(opciones) {
  const o = opciones && typeof opciones === 'object' ? opciones : /** @type {OpcionesGitLab} */ ({});
  const { token, destinos } = o;
  if (typeof token !== 'string' || token.trim() === '' || /[\u0000-\u001F\u007F]/.test(token)) {
    throw new TypeError('GitLab: falta el token o no es válido (no se muestra su valor)');
  }
  if (!Array.isArray(destinos) || destinos.length === 0 || !destinos.every((d) => typeof d === 'string' && RE_DESTINO.test(d))) {
    throw new TypeError('GitLab: «destinos» debe ser una lista no vacía de grupo[/subgrupo]/proyecto');
  }
  const modo = o.modo ?? 'solo_lectura';
  if (!['apagado', 'solo_lectura', 'comentar', 'proponer'].includes(modo)) throw new TypeError('GitLab: modo no válido');

  // Host: el de la configuración, o, solo en pruebas, el de un servidor local
  let host = typeof o.host === 'string' ? o.host.toLowerCase() : '';
  let local = false;
  if (o.baseUrl !== undefined) {
    let u;
    try { u = new URL(o.baseUrl); } catch { throw new TypeError('GitLab: baseUrl no es una URL'); }
    if (u.protocol !== 'http:' || (u.hostname !== '127.0.0.1' && u.hostname !== 'localhost') || u.username || u.password || (u.pathname !== '/' && u.pathname !== '')) {
      throw new TypeError('GitLab: baseUrl solo admite http://127.0.0.1 o http://localhost (uso de pruebas)');
    }
    host = u.host;
    local = true;
  }
  if (host === '') throw new TypeError('GitLab: falta el host');

  const http = o.http ?? pedir;
  const auditoria = o.auditoria;
  const parametroBorrador = o.parametroBorrador ?? null;
  const maxBytes = o.maxBytes ?? MAX_BYTES_RESPUESTA;
  const protocoloUrl = local ? 'http:' : 'https:';
  /** Como `destinoPermitido`, pero con la lista de este adaptador (igualdad exacta, sin mayúsculas). */
  const configLista = { nombre: /** @type {'gitlab'} */ ('gitlab'), modo: /** @type {'solo_lectura'} */ ('solo_lectura'), host, destinos };

  // ── Red ──────────────────────────────────────────────────────────────────────────────────

  /**
   * Ningún error que salga de aquí lleva el token: se enmascara también lo que no viene de http.js.
   * @param {unknown} e
   */
  function proteger(e) {
    if (e instanceof ErrorGitLab) {
      if (e.message.includes(token)) e.message = e.message.split(token).join('[REDACTADO]');
      return e;
    }
    const mensaje = String(/** @type {any} */ (e)?.message ?? e);
    if (mensaje.includes(token) || !(e instanceof Error)) {
      return new ErrorGitLab('interno', mensaje.split(token).join('[REDACTADO]').slice(0, 300));
    }
    return e;
  }

  /**
   * @param {string} metodo @param {string} ruta @param {object} [cuerpo]
   * @returns {Promise<{ estado: number, ok: boolean, cabeceras: Record<string, string>, texto: string }>}
   */
  async function llamar(metodo, ruta, cuerpo) {
    const r = await http({
      host, ruta, metodo,
      cabeceras: { 'PRIVATE-TOKEN': token, accept: 'application/json' },
      cuerpo,
      permitidos: [host],
      maxBytes,
      ...(o.timeoutMs ? { timeoutMs: o.timeoutMs } : {}),
      ...(o._esperar ? { _esperar: o._esperar } : {}),
      ...(local ? { _permitirLocal: true } : {}),
    });
    return r;
  }

  /**
   * JSON de una respuesta; cualquier estado fuera de `esperados` es un error tipado SIN el cuerpo.
   * @param {Awaited<ReturnType<typeof llamar>>} r @param {number[]} esperados @param {string} que
   */
  function json(r, esperados, que) {
    if (!esperados.includes(r.estado)) {
      throw new ErrorGitLab(estadoComoCodigo(r.estado), `GitLab respondió ${r.estado} al ${que}`);
    }
    try { return JSON.parse(r.texto); } catch {
      throw new ErrorGitLab('forma', `GitLab devolvió algo que no es JSON al ${que}`);
    }
  }

  const rutaProyecto = (destino) => `/api/v4/projects/${encodeURIComponent(destino)}`;

  // ── Validación de entradas (antes de cualquier petición) ─────────────────────────────────

  /** @param {unknown} referencia */
  function leerReferencia(referencia) {
    const m = typeof referencia === 'string' ? RE_REFERENCIA.exec(referencia) : null;
    if (!m || /** @type {string} */ (referencia).length > 300) {
      throw new ErrorGitLab('referencia', 'La referencia debe ser grupo[/subgrupo]/proyecto#N');
    }
    const destino = m[1];
    exigirDestino(destino);
    return { destino: nombreCanonico(destino), iid: Number(m[2]) };
  }

  /** Devuelve el destino tal como figura en la lista (mayúsculas de la configuración). */
  function nombreCanonico(destino) {
    return destinos.find((d) => d.toLowerCase() === destino.toLowerCase()) ?? destino;
  }

  /** @param {unknown} destino */
  function exigirDestino(destino) {
    if (typeof destino !== 'string' || !RE_DESTINO.test(destino) || !destinoPermitido(configLista, destino)) {
      throw new ErrorGitLab('destino', 'El destino no está en la lista de destinos permitidos de GitLab');
    }
  }

  /** @param {string} minimo */
  function exigirModo(minimo) {
    const orden = ['apagado', 'solo_lectura', 'comentar', 'proponer'];
    if (modo === 'apagado') throw new ErrorGitLab('modo', 'La integración con GitLab está apagada');
    if (orden.indexOf(modo) < orden.indexOf(minimo)) {
      throw new ErrorGitLab('modo', `La operación pide el modo «${minimo}» y GitLab está en «${modo}»`);
    }
  }

  /** @template T @param {string} operacion @param {string} destino @param {() => Promise<T>} accion @returns {Promise<T>} */
  async function auditada(operacion, destino, accion) {
    try {
      if (!auditoria) return await accion();
      return await auditoria.ejecutar({ proveedor: NOMBRE, operacion, destino, accion });
    } catch (e) {
      throw proteger(e);
    }
  }

  /** URL informativa: solo si es del mismo host y esquema; nunca se sigue. @param {unknown} v */
  function urlPropia(v) {
    if (typeof v !== 'string' || v.length > 2048) return undefined;
    try {
      const u = new URL(v);
      if (u.protocol === protocoloUrl && u.host.toLowerCase() === host && !u.username && !u.password) return u.href;
    } catch { /* no es URL */ }
    return undefined;
  }

  // ── Notas (paginadas, con tope) ──────────────────────────────────────────────────────────

  /**
   * @param {string} destino @param {number} iid
   * @returns {Promise<{ notas: any[], completo: boolean }>}  solo notas de personas; `completo` false si se cortó por el tope
   */
  async function traerNotas(destino, iid) {
    /** @type {any[]} */
    const notas = [];
    let bytes = 0;
    let pagina = 1;
    for (;;) {
      const ruta = `${rutaProyecto(destino)}/issues/${iid}/notes?sort=asc&order_by=created_at&per_page=${POR_PAGINA}&page=${pagina}`;
      const r = await llamar('GET', ruta);
      const lista = json(r, [200], 'leer las notas');
      if (!Array.isArray(lista)) throw new ErrorGitLab('forma', 'GitLab devolvió las notas con una forma inesperada (no es una lista)');
      bytes += Buffer.byteLength(r.texto, 'utf8');
      for (const n of lista) {
        if (!esObjeto(n) || (n.system !== undefined && typeof n.system !== 'boolean') || (n.system !== true && typeof n.body !== 'string')) {
          throw new ErrorGitLab('forma', 'GitLab devolvió una nota con una forma inesperada');
        }
        if (n.system === true) continue;              // notas de sistema: «closed», «changed title»…
        notas.push(n);
      }
      const siguiente = r.cabeceras['x-next-page'] ?? '';
      if (siguiente === '' || lista.length === 0) return { notas, completo: true };
      // Solo se sigue la página inmediatamente posterior: nada que el servidor pueda reorientar
      if (siguiente !== String(pagina + 1)) throw new ErrorGitLab('forma', 'GitLab devolvió una paginación inesperada');
      if (pagina >= MAX_PAGINAS || bytes >= MAX_BYTES_NOTAS) return { notas, completo: false };
      pagina++;
    }
  }

  // ── leerElemento ─────────────────────────────────────────────────────────────────────────

  /**
   * @param {string} referencia  `grupo/subgrupo/proyecto#N`
   * @returns {Promise<import('../puerto.js').ElementoDeTrabajo>}
   */
  async function leerElemento(referencia) {
    exigirModo('solo_lectura');
    const { destino, iid } = leerReferencia(referencia);
    return auditada('leer_elemento', destino, async () => {
      const ri = await llamar('GET', `${rutaProyecto(destino)}/issues/${iid}`);
      const inc = json(ri, [200], 'leer la incidencia');
      if (!esObjeto(inc) || inc.iid !== iid || typeof inc.title !== 'string'
        || !(typeof inc.description === 'string' || inc.description === null || inc.description === undefined)
        || !(inc.labels === undefined || (Array.isArray(inc.labels) && inc.labels.every((e) => typeof e === 'string')))) {
        throw new ErrorGitLab('forma', 'GitLab devolvió la incidencia con una forma inesperada');
      }
      const { notas } = await traerNotas(destino, iid);   // si el tope corta, se devuelven las más antiguas
      const url = urlPropia(inc.web_url);
      return {
        proveedor: NOMBRE,
        destino,
        referencia: `${destino}#${iid}`,
        titulo: inc.title,
        cuerpo: inc.description ?? '',
        etiquetas: [...(inc.labels ?? [])],
        comentarios: notas.map((n) => ({ autor: typeof n.author?.username === 'string' ? n.author.username : '', cuerpo: n.body })),
        ...(url ? { url } : {}),
      };
    });
  }

  // ── comentar ─────────────────────────────────────────────────────────────────────────────

  /** @param {unknown} id */
  function marcadorOculto(id) {
    if (typeof id !== 'string' || !RE_MARCADOR.test(id)) {
      throw new ErrorGitLab('marcador', 'El marcador de idempotencia es obligatorio y debe ser [A-Za-z0-9_.:-], de hasta 64 caracteres');
    }
    return `<!-- forge:${id} -->`;
  }

  /**
   * @param {string} referencia
   * @param {string} texto
   * @param {{ marcador: string }} opciones
   * @returns {Promise<import('../puerto.js').ResultadoDePublicacion & { yaExistia: boolean }>}
   */
  async function comentar(referencia, texto, opciones) {
    exigirModo('comentar');
    const { destino, iid } = leerReferencia(referencia);
    const marca = marcadorOculto(opciones?.marcador);
    if (typeof texto !== 'string' || texto.trim() === '' || texto.length > MAX_TEXTO_COMENTARIO || /\u0000/.test(texto)) {
      throw new ErrorGitLab('texto', `El comentario debe ser texto no vacío de hasta ${MAX_TEXTO_COMENTARIO} caracteres`);
    }
    if (/<!--\s*forge:/i.test(texto)) throw new ErrorGitLab('texto', 'El comentario no puede traer marcadores propios de FORGE');
    if (texto.includes(token)) throw new ErrorGitLab('texto', 'El comentario contiene el valor del token; no se publica');
    return auditada('comentar', destino, async () => {
      // Búsqueda previa: si el marcador ya está en una nota de una persona, no se publica de nuevo.
      // Límite conocido: quien pueda comentar puede pegar el marcador y evitar la publicación (no la falsea).
      const { notas, completo } = await traerNotas(destino, iid);
      const previa = notas.find((n) => n.body.includes(marca));
      if (previa) return { id: String(previa.id), yaExistia: true };
      if (!completo) {
        throw new ErrorGitLab('tope_paginas', 'La incidencia tiene más notas de las que se pueden revisar; no se publica para no arriesgar un duplicado');
      }
      const r = await llamar('POST', `${rutaProyecto(destino)}/issues/${iid}/notes`, { body: `${texto}\n\n${marca}` });
      const nota = json(r, [200, 201], 'publicar el comentario');
      // SIN CONFIRMAR: la página de notas no trae ejemplo de respuesta de creación; se exige solo `id`.
      if (!esObjeto(nota) || !(Number.isSafeInteger(nota.id) || typeof nota.id === 'string')) {
        throw new ErrorGitLab('forma', 'GitLab devolvió la nota creada con una forma inesperada');
      }
      return { id: String(nota.id), yaExistia: false };
    });
  }

  // ── proponerCambio ───────────────────────────────────────────────────────────────────────

  /** @param {unknown} titulo */
  function tituloDeBorrador(titulo) {
    if (typeof titulo !== 'string' || PROHIBIDOS.test(titulo) || titulo.trim() === '') {
      throw new ErrorGitLab('titulo', 'El título debe ser una línea de texto sin caracteres de control');
    }
    // Se quita un prefijo de borrador que ya trajera, para no duplicarlo ni dejar variantes
    const limpio = titulo.trim().replace(/^(?:(?:draft|wip)\s*:\s*|\[(?:draft|wip)\]\s*|\((?:draft|wip)\)\s*)+/i, '').trim();
    if (limpio === '' || limpio.length > MAX_TITULO) throw new ErrorGitLab('titulo', `El título debe tener entre 1 y ${MAX_TITULO} caracteres`);
    return limpio;
  }

  /**
   * @param {unknown} archivos
   * @returns {Array<{ ruta: string, contenido: string }>}
   */
  function validarArchivos(archivos) {
    if (!Array.isArray(archivos) || archivos.length === 0) throw new ErrorGitLab('archivos', 'Hace falta al menos un archivo');
    if (archivos.length > MAX_ARCHIVOS) throw new ErrorGitLab('archivos', `Como máximo ${MAX_ARCHIVOS} archivos por propuesta`);
    const vistas = new Set();
    let total = 0;
    return archivos.map((a, i) => {
      if (!esObjeto(a) || typeof a.contenido !== 'string') throw new ErrorGitLab('archivos', `El archivo ${i + 1} no tiene la forma { ruta, contenido }`);
      const motivo = motivoRutaInvalida(a.ruta);
      if (motivo) throw new ErrorGitLab('ruta', `Ruta no permitida en el archivo ${i + 1}: ${motivo}`);
      const clave = a.ruta.toLowerCase();
      if (vistas.has(clave)) throw new ErrorGitLab('ruta', `Ruta repetida en el archivo ${i + 1}`);
      vistas.add(clave);
      const bytes = Buffer.byteLength(a.contenido, 'utf8');
      if (bytes > MAX_BYTES_ARCHIVO || (total += bytes) > MAX_BYTES_TOTAL) throw new ErrorGitLab('tamano', 'La propuesta supera el tope de tamaño de archivos');
      if (/\u0000/.test(a.contenido)) throw new ErrorGitLab('archivos', `El archivo ${i + 1} contiene un byte nulo (no es texto)`);
      return { ruta: a.ruta, contenido: a.contenido };
    });
  }

  /**
   * @param {{ destino: string, base: string, rama: string, archivos: Array<{ ruta: string, contenido: string }>, titulo: string, descripcion?: string, marcador: string }} p
   * @returns {Promise<import('../puerto.js').ResultadoDePublicacion & { rama: string, yaExistia: boolean }>}
   */
  async function proponerCambio(p) {
    exigirModo('proponer');
    const d = esObjeto(p) ? p : /** @type {any} */ ({});
    exigirDestino(d.destino);
    const destino = nombreCanonico(d.destino);
    if (!ramaBaseValida(d.base)) throw new ErrorGitLab('base', 'El nombre de la rama base no es válido');
    if (typeof d.rama !== 'string' || !d.rama.startsWith(PREFIJO_RAMA)) {
      throw new ErrorGitLab('rama', `La rama debe empezar por «${PREFIJO_RAMA}»; FORGE no escribe en otras`);
    }
    if (!RE_RAMA_DESTINO.test(d.rama)) throw new ErrorGitLab('rama', 'El nombre de la rama no es válido (forge/ + letras, dígitos, «-» y «_»)');
    const archivos = validarArchivos(d.archivos);
    const marca = marcadorOculto(d.marcador);
    const limpio = tituloDeBorrador(d.titulo);
    const descripcion = d.descripcion === undefined ? '' : d.descripcion;
    if (typeof descripcion !== 'string' || descripcion.length > MAX_DESCRIPCION || /\u0000/.test(descripcion) || /<!--\s*forge:/i.test(descripcion)) {
      throw new ErrorGitLab('texto', `La descripción debe ser texto de hasta ${MAX_DESCRIPCION} caracteres y sin marcadores propios`);
    }
    if (descripcion.includes(token) || limpio.includes(token) || archivos.some((a) => a.contenido.includes(token))) {
      throw new ErrorGitLab('texto', 'La propuesta contiene el valor del token; no se publica');
    }
    const base = /** @type {string} */ (d.base);
    const rama = /** @type {string} */ (d.rama);

    return auditada('proponer_cambio', destino, async () => {
      const proy = rutaProyecto(destino);

      // 1. Solo lecturas: si algo no cuadra, no se deja nada a medias
      const rp = json(await llamar('GET', proy), [200], 'leer el proyecto');
      if (!esObjeto(rp) || typeof rp.archived !== 'boolean' && rp.archived !== undefined) throw new ErrorGitLab('forma', 'GitLab devolvió el proyecto con una forma inesperada');
      if (rp.archived === true) throw new ErrorGitLab('proyecto_archivado', 'El proyecto está archivado; no se propone nada');

      const rb = await llamar('GET', `${proy}/repository/branches/${encodeURIComponent(base)}`);
      if (rb.estado === 404) throw new ErrorGitLab('base_inexistente', 'La rama base no existe en el proyecto');
      const jb = json(rb, [200], 'leer la rama base');
      if (!esObjeto(jb) || jb.name !== base) throw new ErrorGitLab('forma', 'GitLab devolvió la rama base con una forma inesperada');

      const rr = await llamar('GET', `${proy}/repository/branches/${encodeURIComponent(rama)}`);
      if (rr.estado === 200) {
        throw new ErrorGitLab('rama_existe', `La rama ${rama} ya existe en ${destino}; no se toca. Si es de un intento anterior, revísala o bórrala a mano y usa otro nombre`, { rama });
      }
      if (rr.estado !== 404) throw new ErrorGitLab(estadoComoCodigo(rr.estado), `GitLab respondió ${rr.estado} al comprobar la rama nueva`);

      // Create o update según exista en la base. SIN CONFIRMAR: HEAD sobre /repository/files/:ruta no se
      // leyó en el spike; si una instancia lo rechazara, la propuesta falla aquí, antes de crear nada.
      /** @type {Array<{ action: 'create'|'update', file_path: string, content: string }>} */
      const acciones = [];
      for (const a of archivos) {
        const rf = await llamar('HEAD', `${proy}/repository/files/${encodeURIComponent(a.ruta)}?ref=${encodeURIComponent(base)}`);
        if (rf.estado !== 200 && rf.estado !== 404) throw new ErrorGitLab(estadoComoCodigo(rf.estado), `GitLab respondió ${rf.estado} al comprobar un archivo`);
        acciones.push({ action: rf.estado === 200 ? 'update' : 'create', file_path: a.ruta, content: a.contenido });
      }

      // 2. Escrituras. Desde aquí, un fallo deja la rama creada: se informa, no se borra
      const rc = await llamar('POST', `${proy}/repository/branches`, { branch: rama, ref: base });
      if (rc.estado === 400 || rc.estado === 409) {
        // Carrera: alguien la creó entre la lectura y la escritura. No se escribe en ella
        throw new ErrorGitLab('rama_existe', `La rama ${rama} ya existe en ${destino}; no se toca`, { rama });
      }
      const jr = json(rc, [201], 'crear la rama');
      if (!esObjeto(jr) || jr.name !== rama) throw new ErrorGitLab('forma', 'GitLab devolvió la rama creada con una forma inesperada');

      /** @param {string} etapa @param {string} codigo @param {string} detalle */
      const parcial = (etapa, codigo, detalle) => new ErrorGitLab('parcial',
        `La rama ${rama} se creó en ${destino} pero falló ${etapa} (${codigo}: ${detalle}). No se borra: revísala o bórrala a mano`, { rama, etapa });

      try {
        const rcm = await llamar('POST', `${proy}/repository/commits`, {
          branch: rama,
          commit_message: `${limpio}\n\nPropuesta generada por FORGE.`,
          actions: acciones,
        });
        const jc = json(rcm, [201], 'crear el commit');
        if (!esObjeto(jc) || typeof jc.id !== 'string') throw new ErrorGitLab('forma', 'GitLab devolvió el commit con una forma inesperada');
      } catch (e) {
        const x = /** @type {any} */ (e);
        throw parcial('el commit', String(x?.codigo ?? 'error'), String(x?.message ?? '').slice(0, 120));
      }

      let mr;
      try {
        // El título lleva SIEMPRE el prefijo `Draft: `. SIN CONFIRMAR: si la API también acepta `draft`/
        // `work_in_progress` al crear; solo se envía si `parametroBorrador` lo pide (prueba opt-in).
        const cuerpoMr = {
          source_branch: rama,
          target_branch: base,
          title: `${PREFIJO_BORRADOR}${limpio}`,
          description: `${descripcion}${descripcion ? '\n\n' : ''}${marca}`,
          remove_source_branch: false,
          squash: false,
          ...(parametroBorrador ? { [parametroBorrador]: true } : {}),
        };
        const rm = await llamar('POST', `${proy}/merge_requests`, cuerpoMr);
        mr = json(rm, [201], 'abrir la solicitud de fusión');
        if (!esObjeto(mr) || !Number.isSafeInteger(mr.iid) || typeof mr.title !== 'string') {
          throw new ErrorGitLab('forma', 'GitLab devolvió la solicitud con una forma inesperada');
        }
      } catch (e) {
        const x = /** @type {any} */ (e);
        throw parcial('la solicitud de fusión', String(x?.codigo ?? 'error'), String(x?.message ?? '').slice(0, 120));
      }

      const borrador = mr.draft === true || mr.work_in_progress === true;
      if (!borrador) {
        // Se creó pero GitLab no la marcó como borrador: no se afirma lo que no es
        throw new ErrorGitLab('no_borrador',
          `La solicitud !${mr.iid} de ${destino} se creó pero GitLab no la marcó como borrador. No se fusiona nada; ciérrala o márcala a mano`, { rama, etapa: 'borrador' });
      }
      const url = urlPropia(mr.web_url);
      return { id: String(mr.iid), ...(url ? { url } : {}), borrador: true, rama, yaExistia: false };
    });
  }

  // ── comprobarAlcance ─────────────────────────────────────────────────────────────────────

  /**
   * @returns {Promise<{ estado: 'comprobado', ambitos: string[], exceso: boolean, suficiente: boolean } | { estado: 'no_comprobable', motivo: string }>}
   */
  async function comprobarAlcance() {
    exigirModo('solo_lectura');
    return auditada('comprobar_alcance', 'gitlab', async () => {
      const r = await llamar('GET', '/api/v4/personal_access_tokens/self');
      // 401/404: token de proyecto o de grupo (no hay `self` para ellos: sin confirmar) o token no válido
      if (r.estado === 401 || r.estado === 404) {
        return {
          estado: /** @type {const} */ ('no_comprobable'),
          motivo: `GitLab respondió ${r.estado}: no es un token personal o no admite esta consulta (token de proyecto, de grupo, o no válido); el alcance no se puede comprobar`,
        };
      }
      const t = json(r, [200], 'comprobar el alcance del token');
      if (!esObjeto(t) || !Array.isArray(t.scopes) || !t.scopes.every((s) => typeof s === 'string' && RE_AMBITO.test(s))) {
        throw new ErrorGitLab('forma', 'GitLab devolvió los ámbitos del token con una forma inesperada');
      }
      /** @type {string[]} */
      const ambitos = [...new Set(/** @type {string[]} */ (t.scopes))].sort();
      const necesarios = AMBITOS_NECESARIOS[modo] ?? [];
      return {
        estado: /** @type {const} */ ('comprobado'),
        ambitos,
        // «exceso»: tiene algún ámbito que el modo no necesita
        exceso: ambitos.some((a) => !necesarios.includes(a)),
        // «suficiente»: tiene lo que el modo pide (`api` también cubre lectura)
        suficiente: necesarios.every((n) => ambitos.includes(n)) || (modo === 'solo_lectura' && ambitos.includes('api')),
      };
    });
  }

  return Object.freeze({ nombre: NOMBRE, leerElemento, comentar, proponerCambio, comprobarAlcance });
}
