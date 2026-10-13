/**
 * publicacion.js — Qué se publica, armado DESDE EL ESTADO del ciclo (F3.2)
 *
 * `prepararPublicacion` no escribe nada, no usa la red y no llama a ningún modelo. Toma el estado
 * final de una tarea (el último punto de guardado válido del ciclo) y construye el contenido de un
 * comentario o de una propuesta de cambio:
 *
 *   - lo que se dice (resultado, iteraciones, gasto, mutación, archivos con su huella) sale del
 *     estado, con una plantilla fija; nunca de la salida de las pruebas ni de texto del modelo;
 *   - lo que se propone son EXACTAMENTE los archivos de `estado.implementacion.archivos` cuya huella
 *     en disco coincide con la que el ciclo registró. Si una no coincide, no se publica nada
 *     (CA-003-02): lo que pasó el ciclo es lo que se publica, no lo que haya en el disco después;
 *   - se EXCLUYEN y se listan aparte, a la espera de aprobación expresa por archivo, los de
 *     dependencias, configuración, CI y vetados: una solicitud en borrador que toca la configuración
 *     de CI ejecuta código en la infraestructura del equipo (CA-003-03, revisor del spike de GitLab);
 *   - solo se publica una tarea con resultado `exito` o `aceptada_por_humano`.
 *
 * Todo texto saliente pasa por `redactar` y se acota. El contenido que devuelve es lo que
 * `aprobacion.js` guarda en la cola y lo que la vista previa muestra, byte a byte.
 */

import { createHash } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { leerArchivo } from '../escritura-segura.js';
import { GuardadorArchivos } from '../ciclo/checkpoint-archivos.js';
import { leerRutasProtegidas } from '../ciclo/config.js';
import { clasificarRuta, huella } from '../ciclo/protocolo-archivos.js';
import { redactar, redactarFormatos } from '../ciclo/redactar.js';
import { PROVEEDORES } from './puerto.js';
import { clasificarManifiesto, motivoRutaVetada } from './rutas.js';

export const PREFIJO_RAMA = 'forge/';
export const BASE_POR_DEFECTO = 'main';
export const RESULTADOS_PUBLICABLES = Object.freeze(['exito', 'aceptada_por_humano']);
export const TIPOS = Object.freeze(['comentario', 'propuesta']);
/** Los adaptadores rechazan más (tope propio): mejor decirlo al preparar que al aprobar. */
export const MAX_ARCHIVOS = 20;
export const MAX_BYTES_ARCHIVOS = 1024 * 1024;
const MAX_BYTES_TEXTO = 6000;
const MAX_ARCHIVOS_EN_TEXTO = 25;
const ID_TAREA = /^\w[\w.-]*$/;
const ID_SESION = /^\w[\w.-]*$/;
const REFERENCIA = {
  github: /^([A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9._-]{1,100})#([1-9][0-9]{0,8})$/,
  gitlab: /^([A-Za-z0-9_][A-Za-z0-9._-]*(?:\/[A-Za-z0-9_][A-Za-z0-9._-]*){1,19})#([1-9][0-9]{0,8})$/,
  jira: /^([A-Z][A-Z0-9_]{1,9})-[1-9][0-9]{0,8}$/,
};
const RAMA_BASE = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/;
// Caracteres de control, de formato (ancho cero, bidireccionales) y separadores de línea o párrafo
const INVISIBLES = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu;
const HAY_INVISIBLES = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;

export class ErrorPublicacion extends Error {
  /** @param {string} codigo @param {string} mensaje */
  constructor(codigo, mensaje) {
    super(mensaje);
    this.name = 'ErrorPublicacion';
    this.codigo = codigo;
  }
}

/**
 * @typedef {Object} ArchivoAPublicar
 * @property {string} ruta
 * @property {string} contenido
 * @property {string} sha256      la del estado del ciclo (y, por construcción, la del disco)
 *
 * @typedef {Object} ArchivoExcluido
 * @property {string} ruta
 * @property {'ruta_vetada'|'ci'|'dependencias'|'configuracion'|'secreto_en_contenido'|'no_es_texto'|'ruta_no_valida'} motivo
 *
 * @typedef {{ tipo: 'comentario', texto: string, marcador: string }} ContenidoComentario
 * @typedef {{ tipo: 'propuesta', marcador: string, rama: string, base: string, titulo: string, descripcion: string,
 *             archivos: ArchivoAPublicar[], excluidos: ArchivoExcluido[] }} ContenidoPropuesta
 *
 * @typedef {Object} Preparada
 * @property {string} proveedor
 * @property {'comentar'|'proponer_cambio'} operacion
 * @property {'comentario'|'propuesta'} tipo
 * @property {string} destino
 * @property {string} referencia
 * @property {string} tareaId
 * @property {string} runId
 * @property {ContenidoComentario | ContenidoPropuesta} contenido
 */

// ── Estado del ciclo ────────────────────────────────────────────────────────────────────────

/**
 * Estado final de una tarea: el último punto de guardado VÁLIDO del hilo (el mismo que el ciclo usa
 * al reanudar, con su huella comprobada). Busca primero en la sesión actual (`sesion.json`) y, si
 * no está, en las demás sesiones del proyecto, tomando la más reciente.
 * @param {string} cwd @param {string} tareaId
 * @returns {{ estado: import('../ciclo/estado.js').EstadoCiclo, runId: string, ts: string }}
 */
export function leerEstadoDeTarea(cwd, tareaId) {
  if (typeof tareaId !== 'string' || tareaId.length > 100 || !ID_TAREA.test(tareaId)) {
    throw new ErrorPublicacion('tarea_no_valida', 'El identificador de tarea no es válido (letras, dígitos, «_», «.» y «-»).');
  }
  const baseMotor = join(cwd, '.sdd', 'motor');

  /** @type {string|null} */
  let actual = null;
  try {
    const s = JSON.parse(leerArchivo(cwd, join(baseMotor, 'sesion.json')) ?? 'null');
    if (typeof s?.runId === 'string' && ID_SESION.test(s.runId)) actual = s.runId;
  } catch { /* sin sesión actual legible: se buscan todas */ }

  /** @type {string[]} */
  let sesiones = [];
  try {
    sesiones = readdirSync(baseMotor, { withFileTypes: true }).filter((d) => d.isDirectory() && ID_SESION.test(d.name)).map((d) => d.name);
  } catch { /* sin motor */ }
  if (actual && !sesiones.includes(actual)) sesiones.push(actual);
  sesiones.sort((a, b) => (a === actual ? -1 : b === actual ? 1 : 0));

  /** @type {{ estado: any, runId: string, ts: string }[]} */
  const hallados = [];
  for (const runId of sesiones) {
    const { punto } = new GuardadorArchivos(join(baseMotor, runId)).ultimo(`${runId}:${tareaId}`);
    if (punto && punto.estado.taskId === tareaId && punto.estado.runId === runId) hallados.push({ estado: punto.estado, runId, ts: String(punto.ts) });
    if (runId === actual && hallados.length > 0) break;      // la sesión actual manda
  }
  if (hallados.length === 0) {
    throw new ErrorPublicacion('tarea_no_encontrada', `No hay un estado guardado de la tarea «${limpiar(tareaId, 60)}» en este proyecto (.sdd/motor). Ejecútala primero con «forge run --motor ciclo».`);
  }
  const elegido = hallados[0].runId === actual ? hallados[0] : hallados.sort((a, b) => b.ts.localeCompare(a.ts))[0];

  // Igual que el ciclo al reanudar: un estado de otro proyecto no se obedece
  if (resolve(String(elegido.estado.cwd)).toLowerCase() !== resolve(cwd).toLowerCase()) {
    throw new ErrorPublicacion('estado_de_otro_proyecto', `El estado guardado de «${limpiar(tareaId, 60)}» pertenece a otro proyecto; no se publica.`);
  }
  return elegido;
}

// ── Texto saliente ──────────────────────────────────────────────────────────────────────────

/**
 * Caracteres con significado para una plataforma (menciones, referencias, imágenes, enlaces, HTML,
 * referencias de GitLab) sustituidos por su forma de ancho completo: se leen igual y ya no son activos
 * (revisión 2, H5). El texto no confiable (nombres de archivo, identificadores) nunca llega crudo.
 */
const INERTES = /** @type {Record<string, string>} */ ({
  '@': '＠', '#': '＃', '!': '！', '&': '＆', '%': '％', '~': '～', '$': '＄', '`': "'",
  '<': '＜', '>': '＞', '[': '［', ']': '］', '|': '｜',
});

/** @param {string} t */
export function neutralizar(t) {
  let r = String(t).replace(/[@#!&%~$`<>[\]|]/g, (c) => INERTES[c]);
  r = r.replace(/:\/\//g, '：//').replace(/\bGH-(?=\d)/gi, 'GH‑');
  if (r.startsWith('/')) r = `∕${r.slice(1)}`;
  return r;
}

/** Ninguna línea del cuerpo empieza por «/» (acciones rápidas de GitLab, comandos de bots). @param {string} t */
function sinComandos(t) {
  return t.split('\n').map((l) => l.replace(/^(\s*)\//, '$1∕')).join('\n');
}

/** Una línea, sin invisibles, redactada, neutralizada, sin rutas locales y acotada. @param {unknown} valor @param {number} max */
function limpiar(valor, max) {
  let t = String(valor ?? '').replace(INVISIBLES, ' ').replace(/\s+/g, ' ').trim();
  t = neutralizar(redactar(redactarFormatos(t)));
  t = t.replace(/(?:[A-Za-z]:[\\/]|\\\\|\/(?:home|Users|root|tmp|var|etc|mnt)\/)[^\s)»"']*/g, '[ruta local]');
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** @param {unknown} n @param {number} [dec] */
const num = (n, dec = 0) => (typeof n === 'number' && Number.isFinite(n) ? n.toFixed(dec) : '—');

/** @param {unknown} ruta */
function rutaValida(ruta) {
  if (typeof ruta !== 'string' || ruta === '' || ruta.length > 255) return false;
  if (HAY_INVISIBLES.test(ruta)) return false;
  if (ruta.includes('\\') || ruta.startsWith('/') || /^[A-Za-z]:/.test(ruta)) return false;
  return !ruta.split('/').some((s) => s === '' || s === '.' || s === '..');
}

/**
 * Archivos de integración continua, a cualquier profundidad. Distintos de «configuración» solo en
 * el motivo que se da: una propuesta que los toca ejecuta código en la infraestructura del equipo.
 */
const NOMBRES_CI = [/^jenkinsfile/i, /^\.gitlab-ci\.ya?ml$/i, /^azure-pipelines.*\.ya?ml$/i, /^bitbucket-pipelines\.ya?ml$/i, /^\.travis\.ya?ml$/i, /^cloudbuild\.ya?ml$/i, /^appveyor\.ya?ml$/i, /^buildkite.*\.ya?ml$/i];
const CARPETAS_CI = new Set(['.github', '.gitlab', '.circleci', '.buildkite', '.azure-pipelines', '.drone']);

/**
 * ¿Por qué no se publica esta ruta sin una aprobación expresa por archivo?
 * @param {string} ruta  relativa y con «/»
 * @param {string[]} [vetadasExtra]
 * @returns {null | 'ruta_vetada'|'ci'|'dependencias'|'configuracion'|'ruta_no_valida'}
 */
export function motivoDeExclusion(ruta, vetadasExtra = []) {
  const clase = clasificarRuta(ruta, vetadasExtra);
  if (clase === 'ruta_vetada') return 'ruta_vetada';
  const segmentos = ruta.split('/');
  const nombre = segmentos[segmentos.length - 1];
  if (segmentos.some((s) => CARPETAS_CI.has(s.toLowerCase())) || NOMBRES_CI.some((r) => r.test(nombre))) return 'ci';
  if (clase) return clase;
  const manifiesto = clasificarManifiesto(ruta);
  if (manifiesto) return manifiesto;
  // Lo que el adaptador rechaza SIEMPRE (CODEOWNERS, .husky, nombres reservados…) no se prepara (H10)
  if (motivoRutaVetada(ruta) !== null) return 'ruta_no_valida';
  return null;
}

/**
 * ¿Se puede publicar este archivo? UNA sola función para `prepararPublicacion` y para `aprobar`
 * (revisión 2, H2): ruta válida, no excluida (dependencias, configuración, CI, vetados, rutas que el
 * adaptador rechaza), tamaño acotado, texto sin NUL, sin secretos por formato y con el `sha256` que el
 * ciclo registró coincidiendo con su contenido.
 * @param {string} ruta @param {unknown} contenido @param {string} sha256
 * @param {string[]} [vetadas] patrones adicionales de la configuración del proyecto
 * @returns {{ publicable: true } | { publicable: false, motivo: ArchivoExcluido['motivo'] | 'sha256_no_coincide' | 'demasiado_grande' | 'forma_no_valida' }}
 */
export function archivoPublicable(ruta, contenido, sha256, vetadas = []) {
  if (typeof ruta !== 'string' || typeof contenido !== 'string' || typeof sha256 !== 'string') return { publicable: false, motivo: 'forma_no_valida' };
  if (!rutaValida(ruta)) return { publicable: false, motivo: 'ruta_no_valida' };
  const motivo = motivoDeExclusion(ruta, vetadas);
  if (motivo) return { publicable: false, motivo };
  if (Buffer.byteLength(contenido, 'utf8') > MAX_BYTES_ARCHIVOS) return { publicable: false, motivo: 'demasiado_grande' };
  if (huella(contenido) !== sha256) return { publicable: false, motivo: 'sha256_no_coincide' };
  if (contenido.includes('\u0000')) return { publicable: false, motivo: 'no_es_texto' };
  if (redactarFormatos(contenido) !== contenido) return { publicable: false, motivo: 'secreto_en_contenido' };
  return { publicable: true };
}

/** Vetadas del proyecto (solo pueden AÑADIR vetos). @param {string} cwd @returns {string[]} */
export function vetadasDelProyecto(cwd) {
  try { return leerRutasProtegidas(cwd); } catch { return []; }
}

const slugMarcador = (/** @type {string} */ id) => id.replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 47);
const slugRama = (/** @type {string} */ id) => id.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'tarea';

/** @param {{ ruta: string, sha256: string }[]} archivos */
function listaDeArchivos(archivos) {
  const validos = archivos.filter((a) => rutaValida(a.ruta));
  const lineas = validos.slice(0, MAX_ARCHIVOS_EN_TEXTO).map((a) => `  - ${limpiar(a.ruta, 120)} (sha256 ${String(a.sha256).replace(/[^0-9a-f]/gi, '').slice(0, 12)})`);
  if (validos.length > MAX_ARCHIVOS_EN_TEXTO) lineas.push(`  - … y ${validos.length - MAX_ARCHIVOS_EN_TEXTO} más`);
  return { lineas, total: validos.length };
}

/**
 * Plantilla fija. Solo datos del estado, ya validados por forma; nada del modelo ni de las pruebas.
 * @param {any} estado @param {{ marcador: string, runId: string, excluidos?: ArchivoExcluido[], archivosTexto?: { ruta: string, sha256: string }[] }} o
 */
function textoDeResultado(estado, o) {
  const humano = estado.resultado === 'aceptada_por_humano';
  const ejecs = Array.isArray(estado.ejecuciones) ? estado.ejecuciones : [];
  const ultima = ejecs[ejecs.length - 1];
  const categoria = ultima && /^[a-z_]{1,20}$/.test(String(ultima.categoria)) ? String(ultima.categoria) : 'desconocida';
  const p = estado.presupuesto ?? {};
  const archivos = listaDeArchivos(o.archivosTexto ?? estado.implementacion?.archivos ?? []);
  const l = [];
  l.push(`FORGE · resultado de la tarea «${limpiar(estado.taskId, 60)}»`);
  l.push('');
  l.push(`- Resultado: ${humano ? 'aceptada por una persona tras revisión (las pruebas no pasaron por sí solas)' : 'pruebas en verde'}`);
  if (humano && /^[a-z_]{1,30}$/.test(String(estado.revision?.motivo))) l.push(`- Motivo de la revisión: ${estado.revision.motivo}`);
  l.push(`- Iteraciones: ${num(estado.iteracion)} de ${num(estado.maxIteraciones)}`);
  l.push(`- Ejecuciones de pruebas: ${ejecs.length} (última: ${categoria})`);
  l.push(`- Gasto del modelo: ${num(p.gastado_usd, 4)} USD en ${num(p.llamadas)} llamadas (${num(p.tokens_in)} tokens de entrada, ${num(p.tokens_out)} de salida)`);
  const m = estado.mutacion;
  if (m && typeof m.puntuacion === 'number') {
    l.push(`- Mutación: ${num(m.detectadas)} de ${num(m.probadas)} alteraciones detectadas (${Math.round(m.puntuacion * 100)} %${m.parcial ? ', medición parcial' : ''})`);
  }
  l.push(`- Archivos de la implementación (${archivos.total}):`);
  l.push(...archivos.lineas);
  if (o.excluidos && o.excluidos.length > 0) {
    l.push('');
    l.push('A la espera de aprobación expresa por archivo (NO incluidos en esta propuesta):');
    for (const e of o.excluidos.slice(0, MAX_ARCHIVOS_EN_TEXTO)) l.push(`  - ${limpiar(e.ruta, 120)} (${e.motivo})`);
    if (o.excluidos.length > MAX_ARCHIVOS_EN_TEXTO) l.push(`  - … y ${o.excluidos.length - MAX_ARCHIVOS_EN_TEXTO} más`);
  }
  l.push('');
  l.push('Generado por FORGE a partir del estado del ciclo verificado; no es una revisión humana.');
  l.push(`Evidencia local: .sdd/motor/${limpiar(o.runId, 80)}/`);
  l.push(`Identificador: ${o.marcador}`);
  let t = sinComandos(redactar(l.join('\n')));
  if (Buffer.byteLength(t, 'utf8') > MAX_BYTES_TEXTO) {
    // Nunca ocurre con las listas acotadas; si pasara, se recorta por líneas, conservando el pie
    const pie = l.slice(-4).join('\n');
    t = sinComandos(redactar(`${l.slice(0, 12).join('\n')}\n[… recortado]\n\n${pie}`));
  }
  return t;
}

// ── API ─────────────────────────────────────────────────────────────────────────────────────

/**
 * Destino (repositorio, proyecto o clave de proyecto) de una referencia. Lanza si la forma no es la
 * del proveedor: así se rechaza antes de leer la configuración, el entorno o la red.
 * @param {string} proveedor @param {string} referencia @returns {string} destino
 */
export function destinoDeReferencia(proveedor, referencia) {
  if (!(/** @type {readonly string[]} */ (PROVEEDORES)).includes(proveedor)) {
    throw new ErrorPublicacion('proveedor_no_valido', `Proveedor desconocido. Proveedores: ${PROVEEDORES.join(', ')}.`);
  }
  const re = REFERENCIA[/** @type {'github'} */ (proveedor)];
  const m = typeof referencia === 'string' && referencia.length <= 300 ? re.exec(referencia) : null;
  if (!m) {
    const forma = proveedor === 'jira' ? 'CLAVE-N (por ejemplo ABC-12)' : proveedor === 'gitlab' ? 'grupo[/subgrupo]/proyecto#N' : 'organizacion/repositorio#N';
    throw new ErrorPublicacion('referencia_no_valida', `La referencia de ${proveedor} debe tener la forma ${forma}.`);
  }
  return m[1];
}

/**
 * Arma lo que se publicaría. No escribe nada ni toca la red.
 * @param {{ cwd: string, tareaId: string, proveedor: string, referencia: string, destino?: string,
 *           tipo?: 'comentario'|'propuesta', base?: string, vetadas?: string[] }} o
 * @returns {Preparada}
 */
export function prepararPublicacion(o) {
  const { cwd, tareaId, proveedor, referencia } = o;
  const tipo = o.tipo ?? 'comentario';
  if (!(/** @type {readonly string[]} */ (PROVEEDORES)).includes(proveedor)) {
    throw new ErrorPublicacion('proveedor_no_valido', `Proveedor desconocido. Proveedores: ${PROVEEDORES.join(', ')}.`);
  }
  if (!(/** @type {readonly string[]} */ (TIPOS)).includes(tipo)) {
    throw new ErrorPublicacion('tipo_no_valido', `El tipo debe ser uno de: ${TIPOS.join(', ')}.`);
  }
  const destino = destinoDeReferencia(proveedor, referencia);
  if (o.destino !== undefined && o.destino !== destino) {
    throw new ErrorPublicacion('destino_no_coincide', 'El destino indicado no coincide con el de la referencia.');
  }
  if (proveedor === 'jira' && tipo === 'propuesta') {
    throw new ErrorPublicacion('operacion_no_soportada', 'Jira no tiene solicitudes de cambio: no se puede proponer un cambio allí. Usa --tipo comentario (en el modo «proponer», Jira se trata como «comentar»).');
  }
  const base = o.base ?? BASE_POR_DEFECTO;
  if (tipo === 'propuesta' && (typeof base !== 'string' || !RAMA_BASE.test(base) || base.includes('..') || base.includes('//') || base.endsWith('/') || base.endsWith('.'))) {
    throw new ErrorPublicacion('base_no_valida', 'El nombre de la rama base no es válido.');
  }

  const { estado, runId } = leerEstadoDeTarea(cwd, tareaId);
  if (!(/** @type {readonly string[]} */ (RESULTADOS_PUBLICABLES)).includes(estado.resultado)) {
    throw new ErrorPublicacion('tarea_no_publicable', `La tarea «${limpiar(tareaId, 60)}» está en «${limpiar(estado.resultado, 30)}»: solo se publica una tarea con resultado exito o aceptada_por_humano.`);
  }
  const registrados = Array.isArray(estado.implementacion?.archivos) ? estado.implementacion.archivos : [];
  /** @type {{ ruta: string, sha256: string }[]} */
  const delEstado = registrados
    .filter((a) => a && typeof a.ruta === 'string' && typeof a.sha256 === 'string')
    .map((a) => ({ ruta: a.ruta, sha256: a.sha256 }));

  // Identificador de idempotencia: de la tarea, de lo publicado y del destino. Sale del estado.
  const h = createHash('sha256').update(JSON.stringify({
    v: 1, tarea: tareaId, tipo, proveedor, referencia, resultado: estado.resultado,
    archivos: delEstado.map((a) => [a.ruta, a.sha256]).sort(),
  })).digest('hex');
  const marcador = `tarea-${slugMarcador(tareaId)}-${h.slice(0, 10)}`;

  if (tipo === 'comentario') {
    return {
      proveedor, operacion: 'comentar', tipo, destino, referencia, tareaId, runId,
      contenido: { tipo: 'comentario', texto: textoDeResultado(estado, { marcador, runId }), marcador },
    };
  }

  // Propuesta: archivos del estado, excluidos aparte, huella en disco comprobada
  const vetadas = o.vetadas ?? (() => { try { return leerRutasProtegidas(cwd); } catch { return []; } })();
  /** @type {ArchivoAPublicar[]} */
  const archivos = [];
  /** @type {ArchivoExcluido[]} */
  const excluidos = [];
  /** @type {string[]} */
  const alteradas = [];
  for (const a of delEstado) {
    if (!rutaValida(a.ruta)) { excluidos.push({ ruta: limpiar(a.ruta, 120), motivo: 'ruta_no_valida' }); continue; }
    const motivo = motivoDeExclusion(a.ruta, vetadas);
    if (motivo) { excluidos.push({ ruta: a.ruta, motivo }); continue; }
    let contenido;
    try {
      contenido = leerArchivo(cwd, join(cwd, ...a.ruta.split('/')), { maxBytes: MAX_BYTES_ARCHIVOS });
    } catch {
      throw new ErrorPublicacion('archivo_no_legible', `No se pudo leer «${limpiar(a.ruta, 120)}» de forma segura (enlace, no es un archivo normal o es demasiado grande). No se publica nada.`);
    }
    if (contenido === null || huella(contenido) !== a.sha256) { alteradas.push(a.ruta); continue; }
    const veredicto = archivoPublicable(a.ruta, contenido, a.sha256, vetadas);
    if ('motivo' in veredicto) { excluidos.push({ ruta: a.ruta, motivo: /** @type {any} */ (veredicto.motivo) }); continue; }
    archivos.push({ ruta: a.ruta, contenido, sha256: a.sha256 });
  }
  if (alteradas.length > 0) {
    throw new ErrorPublicacion('huella_distinta',
      `El contenido en disco de ${alteradas.length} archivo(s) ya no coincide con lo que el ciclo verificó: ${alteradas.slice(0, 5).map((r) => limpiar(r, 120)).join(', ')}. No se publica nada: repite la tarea con «forge run --motor ciclo» o restaura los archivos.`);
  }
  if (archivos.length === 0) {
    const lista = excluidos.slice(0, 5).map((e) => `${e.ruta} (${e.motivo})`).join(', ');
    throw new ErrorPublicacion('sin_archivos', `Ningún archivo de la tarea se puede proponer sin aprobación expresa por archivo${lista ? `: ${lista}` : ''}. Publica un comentario en su lugar.`);
  }
  if (archivos.length > MAX_ARCHIVOS || archivos.reduce((s, a) => s + Buffer.byteLength(a.contenido, 'utf8'), 0) > MAX_BYTES_ARCHIVOS) {
    throw new ErrorPublicacion('demasiados_archivos', `La propuesta supera el tope (${MAX_ARCHIVOS} archivos y 1 MiB en total). Divide la tarea.`);
  }
  archivos.sort((a, b) => (a.ruta < b.ruta ? -1 : a.ruta > b.ruta ? 1 : 0));

  const rama = `${PREFIJO_RAMA}tarea-${slugRama(tareaId)}-${h.slice(0, 8)}`;
  const titulo = `FORGE: tarea ${limpiar(tareaId, 60)}`;
  const descripcion = textoDeResultado(estado, { marcador, runId, excluidos, archivosTexto: archivos });
  return {
    proveedor, operacion: 'proponer_cambio', tipo, destino, referencia, tareaId, runId,
    contenido: { tipo: 'propuesta', marcador, rama, base, titulo, descripcion, archivos, excluidos },
  };
}
