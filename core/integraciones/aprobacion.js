/**
 * aprobacion.js — Cola de publicaciones pendientes, vista previa y aprobación (F3.1, F3.3, F3.4)
 *
 * Nada se escribe en una plataforma sin pasar por aquí (RF-005, ADR-22):
 *
 *   crearPendiente  guarda lo que `publicacion.js` armó en la cola del USUARIO (fuera del árbol del
 *                   proyecto, ver `estado-usuario.js`), firmado con HMAC-SHA256 con una clave local.
 *                   No usa la red.
 *   vistaPrevia     devuelve el texto EXACTO que se enviaría, el destino, la cuenta (proveedor y modo:
 *                   nunca el token), los archivos con su huella y el comando para aprobar.
 *   aprobar         exige la huella COMPLETA (o un prefijo de ≥ 12) de lo que la persona vio y
 *                   comprueba, en este orden y SIN RED: firma de la cola, coherencia
 *                   destino/referencia/operación, que cada archivo siga siendo publicable (las mismas
 *                   reglas que al preparar), que la huella no haya cambiado, que el texto siga limpio,
 *                   modo suficiente, destino en la lista y alcance del token; después ejecuta la
 *                   operación del proveedor DENTRO de `AuditoriaIntegraciones.ejecutar` (interruptor,
 *                   tope y evento). Es idempotente: si ya se publicó devuelve el resultado guardado.
 *   rechazar        descarta.
 *
 * Revisión independiente 2 (H1, H2, H3, H4, H9): la cola y el bloqueo por alcance YA NO viven en
 * `.sdd/` del proyecto (que controla quien escribió el repositorio). Un pendiente que esté en el árbol
 * o cuya firma no valga se lista como «no autenticado» y NO se aprueba nunca.
 *
 * Un fallo de la plataforma deja el pendiente en `fallido` y reintentable. Este módulo NUNCA escribe
 * en `.sdd/motor/` ni en los archivos de la tarea: la tarea y su evidencia no dependen de la
 * plataforma (CA-005-04).
 *
 * Identificador de sesión del contador de operaciones (`sesionDeIntegraciones`): el `runId` de la
 * sesión del ciclo (`.sdd/motor/sesion.json`) si existe; si no, uno por día UTC (`dia-AAAA-MM-DD`).
 * Como ese archivo lo puede fabricar el repositorio, la auditoría cuenta además por día.
 */

import { createHash, randomBytes } from 'node:crypto';
import { linkSync, readdirSync, renameSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { crearArchivo, escribirArchivo, leerArchivo } from '../escritura-segura.js';
import { redactar, redactarFormatos } from '../ciclo/redactar.js';
import { destinoPermitido } from './config.js';
import { claveLocal, canonico, directorioDeEstado, existeEstado, firmar, firmaValida } from './estado-usuario.js';
import { MODOS, PROVEEDORES } from './puerto.js';
import { ErrorPublicacion, MAX_ARCHIVOS, PREFIJO_RAMA, archivoPublicable, destinoDeReferencia, vetadasDelProyecto } from './publicacion.js';

export const ESTADOS = Object.freeze(['pendiente', 'aprobado', 'publicado', 'rechazado', 'fallido']);
const OPERACIONES = Object.freeze(['comentar', 'proponer_cambio']);
const ID_PENDIENTE = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const ID_SESION = /^\w[\w.-]*$/;
const MAX_MENSAJE = 300;
/** Longitud mínima del prefijo de la huella que `aprobar` acepta (H1). */
export const MIN_HUELLA = 12;
const MARCADOR = /^[A-Za-z0-9._-]{1,100}$/;
const RAMA = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/;
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

export class ErrorAprobacion extends Error {
  /** @param {string} codigo @param {string} mensaje @param {{ requiereRevisionHumana?: boolean }} [extra] */
  constructor(codigo, mensaje, extra = {}) {
    super(mensaje);
    this.name = 'ErrorAprobacion';
    this.codigo = codigo;
    if (extra.requiereRevisionHumana) this.requiereRevisionHumana = true;
  }
}

/**
 * @typedef {import('./publicacion.js').Preparada} Preparada
 * @typedef {Object} Pendiente
 * @property {string} id
 * @property {string} proveedor
 * @property {'comentar'|'proponer_cambio'} operacion
 * @property {string} destino
 * @property {string} referencia
 * @property {Preparada['contenido']} contenido
 * @property {string} huella             SHA-256 de {proveedor, operacion, destino, referencia, contenido}
 * @property {'pendiente'|'aprobado'|'publicado'|'rechazado'|'fallido'} estado
 * @property {string} creado
 * @property {string} hmac               HMAC-SHA256 de todo lo anterior (y de lo que se añada), con la clave local
 * @property {string} [aprobadoEn]
 * @property {{ id: string, url?: string, borrador?: boolean, rama?: string, yaExistia: boolean }} [resultado]
 * @property {{ codigo: string, mensaje: string, ts: string }} [error]
 * @property {string} [motivo]       por qué se rechazó
 *
 * @typedef {Record<string, string|undefined>} Entorno
 */

// ── Rutas y disco (todo en el directorio de estado del USUARIO) ──────────────────────────────

/** @param {string} cwd @param {Entorno} [env] */
function contexto(cwd, env = process.env) {
  const dir = directorioDeEstado(cwd, env);
  return { dir, clave: claveLocal(dir), pendientes: join(dir, 'pendientes'), alcance: join(dir, 'alcance.json') };
}

const rutaPendiente = (/** @type {string} */ pendientes, /** @type {string} */ id) => join(pendientes, `${id}.json`);
/** Cola ANTIGUA, dentro del árbol del proyecto: solo se lista, nunca se aprueba. */
const dirPendientesDelArbol = (/** @type {string} */ cwd) => join(cwd, '.sdd', 'integraciones', 'pendientes');

/** @param {string} id */
function exigirId(id) {
  if (typeof id !== 'string' || !ID_PENDIENTE.test(id)) {
    throw new ErrorAprobacion('id_no_valido', 'El identificador de la publicación no es válido (minúsculas, dígitos, «_» y «-»). Mira «forge integraciones pendientes».');
  }
  return id;
}

/**
 * Identificador de sesión para el contador de operaciones.
 * @param {string} cwd @param {Date} [ahora]
 */
export function sesionDeIntegraciones(cwd, ahora = new Date()) {
  try {
    const s = JSON.parse(leerArchivo(cwd, join(cwd, '.sdd', 'motor', 'sesion.json')) ?? 'null');
    if (typeof s?.runId === 'string' && s.runId.length <= 100 && ID_SESION.test(s.runId)) return s.runId;
  } catch { /* sin sesión del ciclo */ }
  return `dia-${ahora.toISOString().slice(0, 10)}`;
}

// ── Huella ──────────────────────────────────────────────────────────────────────────────────

/** @param {unknown} contenido */
export function huellaDeContenido(contenido) {
  return createHash('sha256').update(canonico(contenido)).digest('hex');
}

/**
 * La huella que la persona ve y que `aprobar --huella` ata: cubre a dónde va, con qué operación y qué
 * (H3), no solo el contenido.
 * @param {{ proveedor: unknown, operacion: unknown, destino: unknown, referencia: unknown, contenido: unknown }} p
 */
export function huellaDePublicacion(p) {
  return createHash('sha256').update(canonico({
    proveedor: p.proveedor, operacion: p.operacion, destino: p.destino, referencia: p.referencia, contenido: p.contenido,
  })).digest('hex');
}

// ── Forma y coherencia ──────────────────────────────────────────────────────────────────────

/** @param {unknown} v @param {string} id @returns {Pendiente} */
function validarForma(v, id) {
  const p = /** @type {any} */ (v);
  const ok = p && typeof p === 'object'
    && p.id === id
    && (/** @type {readonly string[]} */ (PROVEEDORES)).includes(p.proveedor)
    && (/** @type {readonly string[]} */ (OPERACIONES)).includes(p.operacion)
    && (/** @type {readonly string[]} */ (ESTADOS)).includes(p.estado)
    && typeof p.destino === 'string' && typeof p.referencia === 'string'
    && typeof p.huella === 'string' && /^[0-9a-f]{64}$/.test(p.huella)
    && p.contenido && typeof p.contenido === 'object'
    && typeof p.creado === 'string' && FECHA_ISO.test(p.creado)
    && (p.error === undefined || (p.error && typeof p.error === 'object' && /^[a-z_]{1,30}$/.test(String(p.error.codigo))));
  if (!ok) throw new ErrorAprobacion('pendiente_corrupto', `El pendiente «${id}» no tiene la forma esperada; no se usa. Prepáralo de nuevo con «forge integraciones publicar».`);
  return p;
}

/**
 * Lo que `aprobar` comprueba SIEMPRE sobre un pendiente, vengan de donde vengan sus datos (H1, H2, H3):
 * coherencia destino/referencia/operación/tipo, forma del contenido y, por cada archivo, las mismas
 * exclusiones y el mismo saneado que al preparar. Lanza `ErrorAprobacion`; no escribe nada.
 * @param {string} cwd @param {Pendiente} p
 */
export function validarPublicable(cwd, p) {
  const c = /** @type {any} */ (p.contenido);
  const incoherente = (/** @type {string} */ m) => new ErrorAprobacion('pendiente_incoherente', `El pendiente «${p.id}» no es coherente (${m}); no se publica. Prepáralo de nuevo con «forge integraciones publicar».`);

  let destino;
  try { destino = destinoDeReferencia(p.proveedor, p.referencia); } catch (e) {
    if (e instanceof ErrorPublicacion) throw incoherente('la referencia no tiene la forma del proveedor');
    throw e;
  }
  if (destino !== p.destino) throw incoherente('el destino no es el de la referencia');
  const tipoEsperado = p.operacion === 'proponer_cambio' ? 'propuesta' : 'comentario';
  if (c.tipo !== tipoEsperado) throw incoherente('la operación no corresponde al tipo de contenido');
  if (typeof c.marcador !== 'string' || !MARCADOR.test(c.marcador)) throw incoherente('el identificador de idempotencia no es válido');

  /** @type {unknown[]} */
  let salientes;
  if (c.tipo === 'comentario') {
    if (typeof c.texto !== 'string') throw incoherente('falta el texto');
    salientes = [c.texto];
  } else {
    if (p.proveedor === 'jira') throw incoherente('Jira no tiene solicitudes de cambio');
    if (typeof c.titulo !== 'string' || typeof c.descripcion !== 'string' || typeof c.rama !== 'string' || typeof c.base !== 'string') throw incoherente('faltan campos de la propuesta');
    if (!c.rama.startsWith(PREFIJO_RAMA) || !RAMA.test(c.rama) || !RAMA.test(c.base) || c.rama.includes('..') || c.base.includes('..')) throw incoherente('la rama o la base no son válidas');
    if (!Array.isArray(c.archivos) || c.archivos.length === 0 || c.archivos.length > MAX_ARCHIVOS) throw incoherente('la lista de archivos no es válida');
    const vetadas = vetadasDelProyecto(cwd);
    for (const a of c.archivos) {
      if (!a || typeof a !== 'object') throw incoherente('un archivo no tiene forma válida');
      const r = archivoPublicable(a.ruta, a.contenido, a.sha256, vetadas);
      if ('motivo' in r) {
        throw new ErrorAprobacion('archivo_no_publicable',
          `El archivo «${String(a.ruta).replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, ' ').slice(0, 80)}» de «${p.id}» no se puede publicar (${r.motivo}): se aplican las mismas exclusiones que al preparar. No se publica nada.`);
      }
    }
    salientes = [c.descripcion, c.titulo];
  }
  for (const t of salientes) {
    if (typeof t !== 'string' || redactar(t) !== t || redactarFormatos(t) !== t) {
      throw new ErrorAprobacion('contenido_no_redactado', `El texto de «${p.id}» contiene algo con forma de secreto; no se publica.`);
    }
    if (/^\s*\//m.test(t)) {
      throw new ErrorAprobacion('contenido_con_comandos', `El texto de «${p.id}» tiene una línea que empieza por «/» (acción rápida de la plataforma); no se publica.`);
    }
  }
}

// ── Cola ────────────────────────────────────────────────────────────────────────────────────

/** @param {string} cwd @param {Pendiente|Omit<Pendiente,'hmac'>} p @param {Entorno} [env] */
function guardar(cwd, p, env) {
  const { dir, pendientes, clave } = contexto(cwd, env);
  const { hmac: _h, ...sinFirma } = /** @type {any} */ (p);
  escribirArchivo(dir, rutaPendiente(pendientes, sinFirma.id), `${JSON.stringify({ ...sinFirma, hmac: firmar(clave, sinFirma) }, null, 2)}\n`, 0o600);
}

/**
 * Lee un pendiente AUTENTICADO de la cola del usuario.
 * @param {string} cwd @param {string} id @param {Entorno} [env]
 * @returns {Pendiente}
 */
export function leerPendiente(cwd, id, env = process.env) {
  exigirId(id);
  const { dir, clave, pendientes } = contexto(cwd, env);
  let texto;
  try { texto = leerArchivo(dir, rutaPendiente(pendientes, id), { maxBytes: 4 * 1024 * 1024 }); } catch {
    throw new ErrorAprobacion('pendiente_corrupto', `El pendiente «${id}» no se pudo leer de forma segura.`);
  }
  if (texto === null) {
    let enElArbol = false;
    try { enElArbol = statSync(rutaPendiente(dirPendientesDelArbol(cwd), id)).isFile(); } catch { /* no hay */ }
    if (enElArbol) {
      throw new ErrorAprobacion('pendiente_no_autenticado',
        `«${id}» está en .sdd/integraciones/pendientes/ del proyecto: un archivo del árbol no autoriza nada y no se aprueba nunca. Recréalo con «forge integraciones publicar <tarea> --proveedor <p> --referencia <r>».`);
    }
    throw new ErrorAprobacion('pendiente_no_encontrado', `No hay ninguna publicación pendiente con el identificador «${id}». Mira «forge integraciones pendientes».`);
  }
  let v;
  try { v = JSON.parse(texto); } catch { throw new ErrorAprobacion('pendiente_corrupto', `El pendiente «${id}» no es JSON válido; no se usa.`); }
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new ErrorAprobacion('pendiente_corrupto', `El pendiente «${id}» no tiene la forma esperada; no se usa.`);
  const { hmac, ...sinFirma } = v;
  if (!firmaValida(clave, sinFirma, hmac)) {
    throw new ErrorAprobacion('pendiente_no_autenticado',
      `El pendiente «${id}» no está autenticado (su firma no vale: lo modificaron o no lo creó FORGE en este equipo). No se aprueba. Recréalo con «forge integraciones publicar <tarea> --proveedor <p> --referencia <r>».`);
  }
  return validarForma(v, id);
}

/**
 * Pendientes AUTENTICADOS, del más antiguo al más reciente.
 * @param {string} cwd @param {Entorno} [env] @returns {Pendiente[]}
 */
export function listarPendientes(cwd, env = process.env) {
  // Leer no crea nada: sin estado del usuario no hay nada autenticado que listar
  if (!existeEstado(cwd, env)) return [];
  /** @type {string[]} */
  let nombres = [];
  try { nombres = readdirSync(contexto(cwd, env).pendientes).filter((n) => n.endsWith('.json')).map((n) => n.slice(0, -5)); } catch { return []; }
  /** @type {Pendiente[]} */
  const lista = [];
  for (const id of nombres) {
    try { lista.push(leerPendiente(cwd, id, env)); } catch { /* uno roto o no autenticado no impide ver los demás */ }
  }
  return lista.sort((a, b) => (a.creado < b.creado ? -1 : a.creado > b.creado ? 1 : a.id < b.id ? -1 : 1));
}

/**
 * Lo que está en la cola o en el árbol y NO se puede aprobar: la cola antigua del proyecto (migración)
 * o un archivo del usuario con firma inválida. Solo ids con forma válida; nada de su contenido.
 * @param {string} cwd @param {Entorno} [env]
 * @returns {{ id: string, origen: 'arbol'|'usuario' }[]}
 */
export function listarNoAutenticados(cwd, env = process.env) {
  /** @type {{ id: string, origen: 'arbol'|'usuario' }[]} */
  const r = [];
  const ids = (/** @type {string} */ d) => { try { return readdirSync(d).filter((n) => n.endsWith('.json')).map((n) => n.slice(0, -5)).filter((i) => ID_PENDIENTE.test(i)); } catch { return []; } };
  for (const id of ids(dirPendientesDelArbol(cwd))) r.push({ id, origen: 'arbol' });
  if (!existeEstado(cwd, env)) return r;
  for (const id of ids(contexto(cwd, env).pendientes)) {
    try { leerPendiente(cwd, id, env); } catch (e) {
      if (e instanceof ErrorAprobacion && (e.codigo === 'pendiente_no_autenticado' || e.codigo === 'pendiente_corrupto')) r.push({ id, origen: 'usuario' });
    }
  }
  return r;
}

/**
 * Deja en la cola lo que `prepararPublicacion` armó. Preparar lo mismo dos veces devuelve el mismo
 * pendiente; uno rechazado se reabre como nuevo.
 * @param {string} cwd @param {Preparada} preparada @param {{ ahora?: Date, env?: Entorno }} [o]
 * @returns {{ pendiente: Pendiente, nuevo: boolean }}
 */
export function crearPendiente(cwd, preparada, o = {}) {
  const { env = process.env } = o;
  const huella = huellaDePublicacion(preparada);
  const id = `${preparada.proveedor}-${huella.slice(0, 12)}`;
  try {
    const previo = leerPendiente(cwd, id, env);
    if (previo.estado !== 'rechazado') return { pendiente: previo, nuevo: false };
  } catch (e) {
    if (!(e instanceof ErrorAprobacion) || !['pendiente_no_encontrado', 'pendiente_corrupto', 'pendiente_no_autenticado'].includes(e.codigo)) throw e;
  }
  /** @type {Omit<Pendiente,'hmac'>} */
  const p = {
    id,
    proveedor: preparada.proveedor,
    operacion: preparada.operacion,
    destino: preparada.destino,
    referencia: preparada.referencia,
    contenido: preparada.contenido,
    huella,
    estado: 'pendiente',
    creado: (o.ahora ?? new Date()).toISOString(),
  };
  guardar(cwd, p, env);
  return { pendiente: leerPendiente(cwd, id, env), nuevo: true };
}

// ── Vista previa ────────────────────────────────────────────────────────────────────────────

/**
 * @param {string} cwd @param {string} id
 * @param {{ config?: import('./config.js').ConfigIntegraciones, env?: Entorno }} [o]
 */
export function vistaPrevia(cwd, id, o = {}) {
  const { env = process.env } = o;
  const p = leerPendiente(cwd, id, env);
  const c = /** @type {any} */ (p.contenido);
  const huella = huellaDePublicacion(p);
  const cfg = o.config?.proveedores[/** @type {'github'} */ (p.proveedor)];
  /** @type {string[]} */
  const advertencias = [];
  const integro = huella === p.huella;
  if (!integro) advertencias.push('El contenido del pendiente no coincide con su huella: no se publicará. Prepáralo de nuevo.');
  if (p.estado === 'publicado') advertencias.push('Ya está publicado.');
  if (p.estado === 'rechazado') advertencias.push('Está rechazado: no se publicará.');
  try { validarPublicable(cwd, p); } catch (e) {
    if (e instanceof ErrorAprobacion) advertencias.push(`No se podrá publicar: ${e.message}`);
    else throw e;
  }
  const propuesta = c.tipo === 'propuesta';
  return {
    id: p.id,
    estado: p.estado,
    proveedor: p.proveedor,
    operacion: p.operacion,
    tipo: /** @type {'comentario'|'propuesta'} */ (c.tipo),
    destino: p.destino,
    referencia: p.referencia,
    cuenta: {
      proveedor: p.proveedor,
      modo: cfg?.modo ?? 'desconocido',
      ...(cfg?.modoDelProyecto ? { modoDelProyecto: cfg.modoDelProyecto } : {}),
      ...(cfg?.host ? { host: cfg.host } : {}),
      ...(cfg?.tokenEnv ? { variable: cfg.tokenEnv } : {}),
      ...(cfg?.alcance ? { alcanceDeclarado: cfg.alcance } : {}),
    },
    texto: String(propuesta ? c.descripcion : c.texto),
    marcador: String(c.marcador),
    ...(propuesta ? { titulo: String(c.titulo), rama: String(c.rama), base: String(c.base) } : {}),
    archivos: propuesta && Array.isArray(c.archivos)
      ? c.archivos.map((/** @type {any} */ a) => ({ ruta: String(a.ruta), sha256: String(a.sha256), bytes: Buffer.byteLength(String(a.contenido), 'utf8') }))
      : [],
    excluidos: propuesta && Array.isArray(c.excluidos) ? c.excluidos : [],
    huella,
    comando: `forge integraciones aprobar ${p.id} --huella ${huella}`,
    integro,
    advertencias,
  };
}

// ── Alcance del token (lo escribe `doctor`) ────────────────────────────────────────────────

/**
 * Guarda el resultado de comprobar el alcance de un proveedor, en el estado del USUARIO y firmado. Un
 * alcance que excede bloquea la escritura de ese proveedor hasta que `forge doctor` vuelva a
 * comprobarlo y ya no exceda; vaciar o editar el archivo bloquea, no desbloquea.
 * @param {string} cwd @param {string} proveedor
 * @param {{ exceso: boolean, ambitos?: string[], suficiente?: boolean, motivo?: string }} r
 * @param {Entorno} [env]
 */
export function escribirAlcance(cwd, proveedor, r, env = process.env) {
  const actual = leerAlcance(cwd, env);
  for (const [k, v] of Object.entries(actual)) if (v.noAutenticado) delete actual[k];
  actual[proveedor] = {
    comprobado: new Date().toISOString(),
    ambitos: (r.ambitos ?? []).filter((a) => typeof a === 'string').slice(0, 40).map((a) => a.slice(0, 40)),
    exceso: r.exceso === true,
    suficiente: r.suficiente !== false,
    bloqueaEscritura: r.exceso === true,
    ...(r.motivo ? { motivo: redactar(String(r.motivo)).slice(0, 300) } : {}),
  };
  const { dir, clave, alcance } = contexto(cwd, env);
  escribirArchivo(dir, alcance, `${JSON.stringify({ datos: actual, hmac: firmar(clave, actual) }, null, 2)}\n`, 0o600);
}

/**
 * @param {string} cwd @param {Entorno} [env]
 * @returns {Record<string, { comprobado: string, ambitos: string[], exceso: boolean, suficiente: boolean, bloqueaEscritura: boolean, motivo?: string, noAutenticado?: boolean }>}
 */
export function leerAlcance(cwd, env = process.env) {
  if (!existeEstado(cwd, env)) return {};
  const { dir, clave, alcance } = contexto(cwd, env);
  let texto;
  try { texto = leerArchivo(dir, alcance); } catch { texto = '{'; }
  if (texto === null) return {};
  /** Fallo CERRADO: un archivo ilegible o con la firma rota bloquea la escritura de todos. */
  const bloqueado = () => Object.fromEntries(PROVEEDORES.map((n) => [n, {
    comprobado: 'desconocido', ambitos: [], exceso: true, suficiente: false, bloqueaEscritura: true,
    motivo: 'el archivo de alcance no está autenticado: vuelve a ejecutar «forge doctor --integraciones-red»', noAutenticado: true,
  }]));
  try {
    const v = JSON.parse(texto);
    if (!v || typeof v !== 'object' || !firmaValida(clave, v.datos, v.hmac)) return bloqueado();
    return v.datos && typeof v.datos === 'object' && !Array.isArray(v.datos) ? v.datos : {};
  } catch { return bloqueado(); }
}

// ── Aprobar ─────────────────────────────────────────────────────────────────────────────────

/** @param {unknown} e @param {string[]} secretos */
function mensajeSeguro(e, secretos) {
  let t = e instanceof Error ? e.message : String(e);
  for (const s of secretos) if (typeof s === 'string' && s.length >= 3) t = t.split(s).join('[REDACTADO]');
  return redactar(redactarFormatos(t)).replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_MENSAJE);
}

/** @param {any} r */
function normalizarResultado(r) {
  const o = r && typeof r === 'object' ? r : {};
  const url = typeof o.url === 'string' && o.url.length <= 500 && !/[\p{Cc}\s]/u.test(o.url) ? o.url : undefined;
  return {
    id: String(o.id ?? '').slice(0, 64),
    ...(url ? { url } : {}),
    ...(typeof o.borrador === 'boolean' ? { borrador: o.borrador } : {}),
    ...(typeof o.rama === 'string' ? { rama: o.rama.slice(0, 200) } : {}),
    yaExistia: o.yaExistia === true || o.existente === true,
  };
}

/**
 * @param {string} cwd
 * @param {string} id
 * @param {Object} o
 * @param {import('./config.js').ConfigIntegraciones} o.config
 * @param {import('./auditoria.js').AuditoriaIntegraciones} o.auditoria
 * @param {(cfg: import('./config.js').ConfigProveedor) => import('./puerto.js').ProveedorDeTrabajo} o.crearProveedor
 *        construye el proveedor (lee el token del entorno); solo se llama cuando todo lo demás pasó
 * @param {string} o.huella       OBLIGATORIA: la huella (o un prefijo de al menos 12) de lo que la persona vio
 * @param {string[]} [o.secretos] valores que no deben salir en ningún mensaje (el token)
 * @param {Entorno} [o.env]
 * @returns {Promise<{ ok: boolean, estado: string, id: string, yaPublicado: boolean, resultado?: any, error?: { codigo: string, mensaje: string } }>}
 */
export async function aprobar(cwd, id, o) {
  const { env = process.env } = o;
  leerPendiente(cwd, id, env); // id válido, existe y está AUTENTICADO (no crea nada)
  // Primero la huella: sin ella no se hace nada (H1). Es un uso incorrecto, no un rechazo.
  if (o.huella === undefined || o.huella === null || String(o.huella).trim() === '') {
    throw new ErrorAprobacion('huella_requerida', `Aprobar exige la huella de lo que viste: «forge integraciones aprobar ${String(id).slice(0, 70)} --huella <huella>» (la huella sale de «forge integraciones vista»).`);
  }
  const pedida = String(o.huella).trim().toLowerCase();
  if (!new RegExp(`^[0-9a-f]{${MIN_HUELLA},64}$`).test(pedida)) {
    throw new ErrorAprobacion('huella_no_valida', `La huella debe ser hexadecimal, completa o con al menos ${MIN_HUELLA} caracteres.`);
  }
  // Candado por archivo entre procesos: dos `aprobar` simultáneos del mismo id no pueden ambos
  // buscar el marcador, no encontrarlo y escribir (hallazgo de la prueba de extremo a extremo, H4).
  // Quien llega con el candado puesto falla limpio («en_curso»); quien llega después de que el otro
  // terminó lee el pendiente ya `publicado` y devuelve lo publicado sin llamar a nadie.
  const candado = tomarCandado(cwd, id, env);
  try {
    return await aprobarConCandado(cwd, id, o, pedida, env);
  } finally {
    try { unlinkSync(candado); } catch { /* ya no está */ }
  }
}

/** Un candado de más de esto es de un proceso que murió sin soltarlo. */
const EDAD_CANDADO_HUERFANO_MS = 10 * 60 * 1000;

/**
 * Toma `<id>.lock` con creación exclusiva (O_EXCL, `crearArchivo`) en el estado del usuario. Si ya
 * existe y su dueño murió o es muy viejo, lo retira y lo intenta una vez más; si no, el otro proceso
 * está publicando.
 * @param {string} cwd @param {string} id @param {Entorno} env @returns {string} ruta del candado
 */
function tomarCandado(cwd, id, env) {
  const { dir, pendientes } = contexto(cwd, env);
  const ruta = join(pendientes, `${id}.lock`);
  for (let intento = 0; intento < 2; intento++) {
    if (crearArchivo(dir, ruta, `${JSON.stringify({ pid: process.pid, ts: new Date().toISOString() })}\n`, 0o600)) return ruta;
    let huerfano = false;
    /** @type {string|null} */
    let juzgado = null;
    try {
      juzgado = leerArchivo(dir, ruta);
      const dueno = JSON.parse(juzgado ?? 'null');
      const viejo = Date.now() - statSync(ruta).mtimeMs > EDAD_CANDADO_HUERFANO_MS;
      let vivo = true;
      if (Number.isInteger(dueno?.pid)) { try { process.kill(dueno.pid, 0); } catch (e) { vivo = /** @type {any} */ (e).code === 'EPERM'; } }
      huerfano = viejo || !vivo;
    } catch { huerfano = false; }
    if (!huerfano) break;
    // Se retira moviéndolo (atómico) y se comprueba que era el candado juzgado: si otro proceso lo
    // retiró y tomó uno nuevo entre medias, se devuelve y se espera (N3-08)
    const apartado = `${ruta}.${process.pid}.${randomBytes(4).toString('hex')}.huerfano`;
    try {
      renameSync(ruta, apartado);
      let leido = null;
      try { leido = leerArchivo(dir, apartado); } catch { /* ilegible */ }
      if (leido !== juzgado) {
        try { linkSync(apartado, ruta); } catch { /* ya hay otro */ }
        try { unlinkSync(apartado); } catch { /* nada */ }
        break;
      }
      try { unlinkSync(apartado); } catch { /* nada */ }
    } catch { /* otro proceso lo retiró primero */ }
  }
  throw new ErrorAprobacion('en_curso', `Otro proceso está aprobando «${id}» ahora mismo: no se publica dos veces. Espera a que termine y mira «forge integraciones pendientes».`);
}

/** @param {string} cwd @param {string} id @param {Parameters<typeof aprobar>[2]} o @param {string} pedida @param {Entorno} env */
async function aprobarConCandado(cwd, id, o, pedida, env) {
  const p = leerPendiente(cwd, id, env);
  const secretos = o.secretos ?? [];

  if (p.estado === 'publicado') {
    return { ok: true, estado: 'publicado', id: p.id, yaPublicado: true, resultado: p.resultado };
  }
  if (p.estado === 'rechazado') {
    throw new ErrorAprobacion('rechazado', `La publicación «${p.id}» está rechazada: no se publica. Prepárala de nuevo con «forge integraciones publicar».`);
  }

  // 1. Lo que se publica es coherente, publicable (mismas reglas que al preparar) y es lo que se vio
  validarPublicable(cwd, p);
  const huella = huellaDePublicacion(p);
  if (huella !== p.huella) {
    guardar(cwd, { ...p, estado: 'rechazado', motivo: 'contenido_cambiado' }, env);
    throw new ErrorAprobacion('contenido_cambiado', `El contenido de «${p.id}» cambió después de prepararlo (la huella no coincide). Queda rechazado; prepáralo de nuevo y revisa la vista previa.`);
  }
  if (!huella.startsWith(pedida)) {
    throw new ErrorAprobacion('huella_distinta', 'La huella indicada no es la de este contenido: no se publica. Mira la vista previa («forge integraciones vista <id>») y usa su huella.');
  }
  const c = /** @type {any} */ (p.contenido);

  // 2. Configuración: proveedor, modo, destino (todo sin red y sin leer el token)
  const cfg = o.config.proveedores[/** @type {'github'} */ (p.proveedor)];
  if (!cfg || cfg.modo === 'apagado') {
    throw new ErrorAprobacion('proveedor_apagado', `La integración con ${p.proveedor} está apagada: ${p.proveedor}_modo no está definido o vale «apagado» en la sección integraciones de .sdd/sdd.config.yaml.`);
  }
  const necesario = p.operacion === 'proponer_cambio' ? 'proponer' : 'comentar';
  if (MODOS.indexOf(/** @type {any} */ (cfg.modo)) < MODOS.indexOf(necesario)) {
    throw new ErrorAprobacion('modo_insuficiente',
      `${p.proveedor}: el modo efectivo es «${cfg.modo}» y publicar ${necesario === 'proponer' ? 'una propuesta de cambio' : 'un comentario'} necesita «${necesario}». El proyecto pide el modo en ${p.proveedor}_modo (sdd.config.yaml) y TÚ lo concedes con FORGE_INTEGRACIONES_ESCRITURA=${p.proveedor} en tu entorno: el proyecto no puede concedérselo.`);
  }
  if (!destinoPermitido(cfg, p.destino)) {
    throw new ErrorAprobacion('destino_no_permitido', `El destino ${p.destino} no está permitido (${p.proveedor}_destinos del proyecto y, si la defines, FORGE_INTEGRACIONES_DESTINOS): no se publica.`);
  }
  const alcance = leerAlcance(cwd, env)[p.proveedor];
  if (alcance?.bloqueaEscritura) {
    throw new ErrorAprobacion('alcance_excedido', `El token de ${p.proveedor} tiene más alcance del necesario (comprobado ${alcance.comprobado}); la escritura queda bloqueada. Reduce sus permisos y vuelve a ejecutar «forge doctor --integraciones-red».`);
  }

  // 3. Credencial: solo si el interruptor y el tope dejan pasar (si no, `ejecutar` lo dirá y registrará)
  const { interruptor, contadores, tope, contadoresDia, topeDiario } = o.auditoria.estado();
  /** @type {import('./puerto.js').ProveedorDeTrabajo|null} */
  let proveedor = null;
  if (!interruptor.apagado && (contadores[p.proveedor] ?? 0) < tope && (contadoresDia[p.proveedor] ?? 0) < topeDiario) proveedor = o.crearProveedor(cfg);

  // 4. La operación, bajo el interruptor, el tope y la auditoría. Marcar «aprobado» solo cuando ya va a salir.
  const previo = p;
  try {
    const bruto = await o.auditoria.ejecutar({
      proveedor: p.proveedor,
      operacion: p.operacion,
      destino: p.destino,
      accion: async () => {
        if (!proveedor) throw new ErrorAprobacion('sin_proveedor', 'El proveedor no estaba disponible.');
        guardar(cwd, { ...p, estado: 'aprobado', aprobadoEn: new Date().toISOString() }, env);
        if (c.tipo === 'propuesta') {
          return proveedor.proponerCambio({
            destino: p.destino, base: c.base, rama: c.rama, titulo: c.titulo, descripcion: c.descripcion, marcador: c.marcador,
            archivos: c.archivos.map((/** @type {any} */ a) => ({ ruta: a.ruta, contenido: a.contenido })),
          });
        }
        return proveedor.comentar(p.referencia, c.texto, { marcador: c.marcador });
      },
    });
    const resultado = normalizarResultado(bruto);
    const { error: _e, motivo: _m, ...base } = p;
    guardar(cwd, { ...base, estado: 'publicado', aprobadoEn: new Date().toISOString(), resultado }, env);
    return { ok: true, estado: 'publicado', id: p.id, yaPublicado: false, resultado };
  } catch (e) {
    const codigo = /** @type {any} */ (e)?.codigo;
    // Ni el interruptor ni el tope ni un error de configuración son un fallo de la plataforma
    if (e instanceof ErrorAprobacion || codigo === 'apagado' || codigo === 'tope_operaciones') {
      if (leerPendiente(cwd, p.id, env).estado === 'aprobado') guardar(cwd, previo, env);
      throw e;
    }
    const error = {
      codigo: typeof codigo === 'string' && /^[a-z_]{1,30}$/.test(codigo) ? codigo : 'error',
      mensaje: mensajeSeguro(e, secretos),
      ts: new Date().toISOString(),
    };
    guardar(cwd, { ...previo, estado: 'fallido', error }, env);
    return { ok: false, estado: 'fallido', id: p.id, yaPublicado: false, error: { codigo: error.codigo, mensaje: error.mensaje } };
  }
}

/**
 * @param {string} cwd @param {string} id @param {string} [motivo] @param {Entorno} [env]
 * @returns {Pendiente}
 */
export function rechazar(cwd, id, motivo, env = process.env) {
  const p = leerPendiente(cwd, id, env);
  if (p.estado === 'publicado') {
    throw new ErrorAprobacion('ya_publicado', `«${p.id}» ya está publicado: no se puede rechazar (FORGE no borra nada en las plataformas).`);
  }
  guardar(cwd, {
    ...p,
    estado: 'rechazado',
    ...(motivo ? { motivo: mensajeSeguro(motivo, []).slice(0, 200) } : {}),
  }, env);
  return leerPendiente(cwd, id, env);
}
