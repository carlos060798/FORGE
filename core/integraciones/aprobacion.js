/**
 * aprobacion.js — Cola de publicaciones pendientes, vista previa y aprobación (F3.1, F3.3, F3.4)
 *
 * Nada se escribe en una plataforma sin pasar por aquí (RF-005, ADR-22):
 *
 *   crearPendiente  guarda en `.sdd/integraciones/pendientes/<id>.json` lo que `publicacion.js` armó,
 *                   con la huella del contenido. No usa la red.
 *   vistaPrevia     devuelve el texto EXACTO que se enviaría, el destino, la cuenta (proveedor y modo:
 *                   nunca el token) y los archivos. No escribe nada.
 *   aprobar         comprueba, en este orden y SIN RED: modo suficiente, destino en la lista,
 *                   alcance del token, que la huella del contenido no haya cambiado, que el texto siga
 *                   limpio de secretos y que no esté ya publicada; después ejecuta la operación del
 *                   proveedor DENTRO de `AuditoriaIntegraciones.ejecutar` (interruptor, tope y evento).
 *                   Es idempotente: si ya se publicó devuelve el resultado guardado sin llamar a nadie.
 *   rechazar        descarta.
 *
 * Un fallo de la plataforma deja el pendiente en `fallido` y reintentable. Este módulo NUNCA escribe
 * en `.sdd/motor/` ni en los archivos de la tarea: la tarea y su evidencia no dependen de la
 * plataforma (CA-005-04).
 *
 * Identificador de sesión del contador de operaciones (`sesionDeIntegraciones`): el `runId` de la
 * sesión del ciclo (`.sdd/motor/sesion.json`) si existe; si no, uno por día UTC (`dia-AAAA-MM-DD`).
 * El tope «operaciones por sesión» cuenta, por tanto, por ejecución de `forge run` o, sin ciclo, por día.
 */

import { createHash } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { escribirArchivo, leerArchivo } from '../escritura-segura.js';
import { redactar, redactarFormatos } from '../ciclo/redactar.js';
import { destinoPermitido } from './config.js';
import { MODOS, PROVEEDORES } from './puerto.js';

export const ESTADOS = Object.freeze(['pendiente', 'aprobado', 'publicado', 'rechazado', 'fallido']);
const OPERACIONES = Object.freeze(['comentar', 'proponer_cambio']);
const ID_PENDIENTE = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const ID_SESION = /^\w[\w.-]*$/;
const MAX_MENSAJE = 300;

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
 * @property {string} huellaContenido
 * @property {'pendiente'|'aprobado'|'publicado'|'rechazado'|'fallido'} estado
 * @property {string} creado
 * @property {string} [aprobadoEn]
 * @property {{ id: string, url?: string, borrador?: boolean, rama?: string, yaExistia: boolean }} [resultado]
 * @property {{ codigo: string, mensaje: string, ts: string }} [error]
 * @property {string} [motivo]       por qué se rechazó
 */

// ── Rutas y disco ───────────────────────────────────────────────────────────────────────────

const dirIntegraciones = (cwd) => join(cwd, '.sdd', 'integraciones');
const dirPendientes = (cwd) => join(dirIntegraciones(cwd), 'pendientes');
const rutaPendiente = (cwd, id) => join(dirPendientes(cwd), `${id}.json`);
const rutaAlcance = (cwd) => join(dirIntegraciones(cwd), 'alcance.json');

/** @param {string} cwd @param {string} ruta @param {unknown} valor */
function guardarJson(cwd, ruta, valor) {
  escribirArchivo(cwd, ruta, `${JSON.stringify(valor, null, 2)}\n`);
}

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

/** JSON con las claves ordenadas: la misma huella para el mismo contenido. @param {unknown} v @returns {string} */
function canonico(v) {
  if (Array.isArray(v)) return `[${v.map(canonico).join(',')}]`;
  if (v !== null && typeof v === 'object') {
    const o = /** @type {Record<string, unknown>} */ (v);
    return `{${Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonico(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

/** @param {unknown} contenido */
export function huellaDeContenido(contenido) {
  return createHash('sha256').update(canonico(contenido)).digest('hex');
}

// ── Cola ────────────────────────────────────────────────────────────────────────────────────

/** @param {unknown} v @param {string} id @returns {Pendiente} */
function validarForma(v, id) {
  const p = /** @type {any} */ (v);
  const ok = p && typeof p === 'object'
    && p.id === id
    && (/** @type {readonly string[]} */ (PROVEEDORES)).includes(p.proveedor)
    && (/** @type {readonly string[]} */ (OPERACIONES)).includes(p.operacion)
    && (/** @type {readonly string[]} */ (ESTADOS)).includes(p.estado)
    && typeof p.destino === 'string' && typeof p.referencia === 'string'
    && typeof p.huellaContenido === 'string' && /^[0-9a-f]{64}$/.test(p.huellaContenido)
    && p.contenido && typeof p.contenido === 'object'
    && typeof p.creado === 'string';
  if (!ok) throw new ErrorAprobacion('pendiente_corrupto', `El pendiente «${id}» no tiene la forma esperada; no se usa. Prepáralo de nuevo con «forge integraciones publicar».`);
  return p;
}

/**
 * @param {string} cwd @param {string} id
 * @returns {Pendiente}
 */
export function leerPendiente(cwd, id) {
  exigirId(id);
  let texto;
  try { texto = leerArchivo(cwd, rutaPendiente(cwd, id), { maxBytes: 4 * 1024 * 1024 }); } catch {
    throw new ErrorAprobacion('pendiente_corrupto', `El pendiente «${id}» no se pudo leer de forma segura.`);
  }
  if (texto === null) throw new ErrorAprobacion('pendiente_no_encontrado', `No hay ninguna publicación pendiente con el identificador «${id}». Mira «forge integraciones pendientes».`);
  let v;
  try { v = JSON.parse(texto); } catch { throw new ErrorAprobacion('pendiente_corrupto', `El pendiente «${id}» no es JSON válido; no se usa.`); }
  return validarForma(v, id);
}

/** @param {string} cwd @returns {Pendiente[]} del más antiguo al más reciente */
export function listarPendientes(cwd) {
  /** @type {string[]} */
  let nombres = [];
  try { nombres = readdirSync(dirPendientes(cwd)).filter((n) => n.endsWith('.json')).map((n) => n.slice(0, -5)); } catch { return []; }
  /** @type {Pendiente[]} */
  const lista = [];
  for (const id of nombres) {
    try { lista.push(leerPendiente(cwd, id)); } catch { /* uno roto no impide ver los demás */ }
  }
  return lista.sort((a, b) => (a.creado < b.creado ? -1 : a.creado > b.creado ? 1 : a.id < b.id ? -1 : 1));
}

/**
 * Deja en la cola lo que `prepararPublicacion` armó. Preparar lo mismo dos veces devuelve el mismo
 * pendiente; uno rechazado se reabre como nuevo.
 * @param {string} cwd @param {Preparada} preparada @param {{ ahora?: Date }} [o]
 * @returns {{ pendiente: Pendiente, nuevo: boolean }}
 */
export function crearPendiente(cwd, preparada, o = {}) {
  const huella = huellaDeContenido(preparada.contenido);
  const id = `${preparada.proveedor}-${huella.slice(0, 12)}`;
  try {
    const previo = leerPendiente(cwd, id);
    if (previo.estado !== 'rechazado') return { pendiente: previo, nuevo: false };
  } catch (e) {
    if (!(e instanceof ErrorAprobacion) || (e.codigo !== 'pendiente_no_encontrado' && e.codigo !== 'pendiente_corrupto')) throw e;
  }
  /** @type {Pendiente} */
  const p = {
    id,
    proveedor: preparada.proveedor,
    operacion: preparada.operacion,
    destino: preparada.destino,
    referencia: preparada.referencia,
    contenido: preparada.contenido,
    huellaContenido: huella,
    estado: 'pendiente',
    creado: (o.ahora ?? new Date()).toISOString(),
  };
  guardarJson(cwd, rutaPendiente(cwd, id), p);
  return { pendiente: p, nuevo: true };
}

// ── Vista previa ────────────────────────────────────────────────────────────────────────────

/**
 * @param {string} cwd @param {string} id
 * @param {{ config?: import('./config.js').ConfigIntegraciones }} [o]
 */
export function vistaPrevia(cwd, id, o = {}) {
  const p = leerPendiente(cwd, id);
  const c = /** @type {any} */ (p.contenido);
  const huella = huellaDeContenido(c);
  const cfg = o.config?.proveedores[/** @type {'github'} */ (p.proveedor)];
  /** @type {string[]} */
  const advertencias = [];
  const integro = huella === p.huellaContenido;
  if (!integro) advertencias.push('El contenido del pendiente cambió desde que se preparó: no se publicará. Prepáralo de nuevo.');
  if (p.estado === 'publicado') advertencias.push('Ya está publicado.');
  if (p.estado === 'rechazado') advertencias.push('Está rechazado: no se publicará.');
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
      ...(cfg?.host ? { host: cfg.host } : {}),
      ...(cfg?.tokenEnv ? { variable: cfg.tokenEnv } : {}),
      ...(cfg?.alcance ? { alcanceDeclarado: cfg.alcance } : {}),
    },
    texto: String(propuesta ? c.descripcion : c.texto),
    marcador: String(c.marcador),
    ...(propuesta ? { titulo: String(c.titulo), rama: String(c.rama), base: String(c.base) } : {}),
    archivos: propuesta ? c.archivos.map((/** @type {any} */ a) => ({ ruta: a.ruta, sha256: a.sha256, bytes: Buffer.byteLength(a.contenido, 'utf8') })) : [],
    excluidos: propuesta ? c.excluidos : [],
    huella,
    integro,
    advertencias,
  };
}

// ── Alcance del token (lo escribe `doctor`) ────────────────────────────────────────────────

/**
 * Guarda el resultado de comprobar el alcance de un proveedor. Un alcance que excede bloquea la
 * escritura de ese proveedor hasta que `forge doctor` vuelva a comprobarlo y ya no exceda.
 * @param {string} cwd @param {string} proveedor
 * @param {{ exceso: boolean, ambitos?: string[], suficiente?: boolean, motivo?: string }} r
 */
export function escribirAlcance(cwd, proveedor, r) {
  const actual = leerAlcance(cwd);
  actual[proveedor] = {
    comprobado: new Date().toISOString(),
    ambitos: (r.ambitos ?? []).filter((a) => typeof a === 'string').slice(0, 40).map((a) => a.slice(0, 40)),
    exceso: r.exceso === true,
    suficiente: r.suficiente !== false,
    bloqueaEscritura: r.exceso === true,
    ...(r.motivo ? { motivo: redactar(String(r.motivo)).slice(0, 300) } : {}),
  };
  guardarJson(cwd, rutaAlcance(cwd), actual);
}

/** @param {string} cwd @returns {Record<string, { comprobado: string, ambitos: string[], exceso: boolean, suficiente: boolean, bloqueaEscritura: boolean, motivo?: string }>} */
export function leerAlcance(cwd) {
  try {
    const v = JSON.parse(leerArchivo(cwd, rutaAlcance(cwd)) ?? '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch { return {}; }
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
 * @param {string} [o.huella]     huella (o prefijo de al menos 8) de lo que la persona vio: si no coincide, no se publica
 * @param {string[]} [o.secretos] valores que no deben salir en ningún mensaje (el token)
 * @returns {Promise<{ ok: boolean, estado: string, id: string, yaPublicado: boolean, resultado?: any, error?: { codigo: string, mensaje: string } }>}
 */
export async function aprobar(cwd, id, o) {
  const p = leerPendiente(cwd, id);
  const secretos = o.secretos ?? [];

  if (p.estado === 'publicado') {
    return { ok: true, estado: 'publicado', id: p.id, yaPublicado: true, resultado: p.resultado };
  }
  if (p.estado === 'rechazado') {
    throw new ErrorAprobacion('rechazado', `La publicación «${p.id}» está rechazada: no se publica. Prepárala de nuevo con «forge integraciones publicar».`);
  }

  // 1. Integridad: lo que se publica es lo que se vio
  const huella = huellaDeContenido(p.contenido);
  if (huella !== p.huellaContenido) {
    guardarJson(cwd, rutaPendiente(cwd, p.id), { ...p, estado: 'rechazado', motivo: 'contenido_cambiado' });
    throw new ErrorAprobacion('contenido_cambiado', `El contenido de «${p.id}» cambió después de prepararlo (la huella no coincide). Queda rechazado; prepáralo de nuevo y revisa la vista previa.`);
  }
  if (o.huella !== undefined) {
    const pedida = String(o.huella).toLowerCase();
    if (!/^[0-9a-f]{8,64}$/.test(pedida) || !huella.startsWith(pedida)) {
      throw new ErrorAprobacion('huella_distinta', 'La huella indicada no es la de este contenido: no se publica. Mira la vista previa («forge integraciones vista <id>») y usa su huella.');
    }
  }
  const c = /** @type {any} */ (p.contenido);
  const saliente = c.tipo === 'propuesta' ? [c.descripcion, c.titulo] : [c.texto];
  if (saliente.some((t) => typeof t !== 'string' || redactar(t) !== t || redactarFormatos(t) !== t)) {
    throw new ErrorAprobacion('contenido_no_redactado', `El texto de «${p.id}» contiene algo con forma de secreto; no se publica.`);
  }

  // 2. Configuración: proveedor, modo, destino (todo sin red y sin leer el token)
  const cfg = o.config.proveedores[/** @type {'github'} */ (p.proveedor)];
  if (!cfg || cfg.modo === 'apagado') {
    throw new ErrorAprobacion('proveedor_apagado', `La integración con ${p.proveedor} está apagada: ${p.proveedor}_modo no está definido o vale «apagado» en la sección integraciones de .sdd/sdd.config.yaml.`);
  }
  const necesario = p.operacion === 'proponer_cambio' ? 'proponer' : 'comentar';
  if (MODOS.indexOf(/** @type {any} */ (cfg.modo)) < MODOS.indexOf(necesario)) {
    throw new ErrorAprobacion('modo_insuficiente',
      `${p.proveedor}_modo es «${cfg.modo}» y publicar ${necesario === 'proponer' ? 'una propuesta de cambio' : 'un comentario'} necesita «${necesario}». Cámbialo en la sección integraciones de .sdd/sdd.config.yaml (${p.proveedor}_modo: ${necesario}) si de verdad quieres que FORGE escriba allí.`);
  }
  if (!destinoPermitido(cfg, p.destino)) {
    throw new ErrorAprobacion('destino_no_permitido', `El destino ${p.destino} ya no está en ${p.proveedor}_destinos: no se publica.`);
  }
  const alcance = leerAlcance(cwd)[p.proveedor];
  if (alcance?.bloqueaEscritura) {
    throw new ErrorAprobacion('alcance_excedido', `El token de ${p.proveedor} tiene más alcance del necesario (comprobado ${alcance.comprobado}); la escritura queda bloqueada. Reduce sus permisos y vuelve a ejecutar «forge doctor --integraciones-red».`);
  }

  // 3. Credencial: solo si el interruptor y el tope dejan pasar (si no, `ejecutar` lo dirá y registrará)
  const { interruptor, contadores, tope } = o.auditoria.estado();
  /** @type {import('./puerto.js').ProveedorDeTrabajo|null} */
  let proveedor = null;
  if (!interruptor.apagado && (contadores[p.proveedor] ?? 0) < tope) proveedor = o.crearProveedor(cfg);

  // 4. La operación, bajo el interruptor, el tope y la auditoría. Marcar «aprobado» solo cuando ya va a salir.
  const previo = p;
  try {
    const bruto = await o.auditoria.ejecutar({
      proveedor: p.proveedor,
      operacion: p.operacion,
      destino: p.destino,
      accion: async () => {
        if (!proveedor) throw new ErrorAprobacion('sin_proveedor', 'El proveedor no estaba disponible.');
        guardarJson(cwd, rutaPendiente(cwd, p.id), { ...p, estado: 'aprobado', aprobadoEn: new Date().toISOString() });
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
    guardarJson(cwd, rutaPendiente(cwd, p.id), { ...base, estado: 'publicado', aprobadoEn: new Date().toISOString(), resultado });
    return { ok: true, estado: 'publicado', id: p.id, yaPublicado: false, resultado };
  } catch (e) {
    const codigo = /** @type {any} */ (e)?.codigo;
    // Ni el interruptor ni el tope ni un error de configuración son un fallo de la plataforma
    if (e instanceof ErrorAprobacion || codigo === 'apagado' || codigo === 'tope_operaciones') {
      if (leerPendiente(cwd, p.id).estado === 'aprobado') guardarJson(cwd, rutaPendiente(cwd, p.id), previo);
      throw e;
    }
    const error = {
      codigo: typeof codigo === 'string' && /^[a-z_]{1,30}$/.test(codigo) ? codigo : 'error',
      mensaje: mensajeSeguro(e, secretos),
      ts: new Date().toISOString(),
    };
    guardarJson(cwd, rutaPendiente(cwd, p.id), { ...previo, estado: 'fallido', error });
    return { ok: false, estado: 'fallido', id: p.id, yaPublicado: false, error: { codigo: error.codigo, mensaje: error.mensaje } };
  }
}

/**
 * @param {string} cwd @param {string} id @param {string} [motivo]
 * @returns {Pendiente}
 */
export function rechazar(cwd, id, motivo) {
  const p = leerPendiente(cwd, id);
  if (p.estado === 'publicado') {
    throw new ErrorAprobacion('ya_publicado', `«${p.id}» ya está publicado: no se puede rechazar (FORGE no borra nada en las plataformas).`);
  }
  const nuevo = {
    ...p,
    estado: /** @type {'rechazado'} */ ('rechazado'),
    ...(motivo ? { motivo: mensajeSeguro(motivo, []).slice(0, 200) } : {}),
  };
  guardarJson(cwd, rutaPendiente(cwd, p.id), nuevo);
  return nuevo;
}
