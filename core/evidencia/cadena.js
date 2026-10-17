/**
 * evidencia/cadena.js — informes de evidencia encadenados por hash y firmados con la clave local
 *
 * Spec 2026-10-14-puertas-de-calidad-y-evidencia, fase A. Cada `forge verificar --registrar` guarda en
 * `.sdd/verificaciones/<id>.json` el resultado más un bloque `evidencia`:
 *
 *   evidencia = { version, fragua, spec, commit, pruebas, imagen, modelos, aprobador, omitidos,
 *                 firmado, anterior, sha256, firma }
 *
 *   sha256 = SHA-256 de canonico(informe SIN evidencia.sha256 ni evidencia.firma)
 *   firma  = HMAC-SHA256 con la clave local del usuario de canonico(informe SIN evidencia.firma, CON sha256)
 *   anterior = sha256 del informe previo de la cadena (o null en el primero)
 *
 * Qué detecta (con pruebas): alterar un campo, borrar un informe del medio, reordenar, bifurcar, quitar
 * firmas donde hay clave, firmas de otra máquina. Qué NO detecta, dicho sin adornos:
 *
 *  - El truncado de los ÚLTIMOS informes solo se detecta con la CABEZA guardada en el estado del usuario
 *    (`<estado>/cadena-cabeza.json`, fuera del proyecto, firmada con la clave). Sin esa cabeza (otra
 *    máquina, estado borrado, CI sin perfil) la cadena restante es perfectamente válida.
 *  - Sin clave local no se firma ni se inventa nada: el informe dice `firmado: false` y la cadena es
 *    «encadenada, no firmada»: quien tenga el repositorio puede reconstruirla entera.
 *  - La firma es HMAC simétrico: solo la verifica quien tiene la clave (esta máquina y este usuario). No
 *    sirve a un tercero.
 *  - Lo que el informe afirma (spec aprobada, modelo) lo declara el proyecto o el cliente; la cadena
 *    prueba que no se retocó DESPUÉS, no que fuera cierto.
 *
 * Lectura del repositorio SIN ejecutar nada suyo: git solo con la receta neutralizada de
 * core/verificar/cambios.js (`rev-parse`), nunca `status`/`diff`. Todo campo de texto se acota y se
 * limpia de caracteres de control. La clave y la cabeza viven solo en el estado del usuario: el
 * proyecto no puede aportar ninguna de las dos (`rutaDeEstado` rechaza una raíz dentro del proyecto).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { canonico, claveLocal, directorioDeEstado, existeEstado, firmar, firmaValida, rutaDeEstado } from '../estado-usuario.js';
import { PREFIJO_GIT, entornoGit } from '../verificar/cambios.js';
import { leerArchivo } from '../escritura-segura.js';

export const VERSION_EVIDENCIA = 1;
export const DIRECTORIO_INFORMES = path.posix.join('.sdd', 'verificaciones');
const ARCHIVO_CABEZA = 'cadena-cabeza.json';
const MAX_INFORMES = 5000;
const MAX_BYTES_INFORME = 2 * 1024 * 1024;
const MAX_CAMPO = 512;
const MAX_ARCHIVOS_PRUEBAS = 2000;
const MAX_BYTES_PRUEBA = 2 * 1024 * 1024;
const HEX64 = /^[0-9a-f]{64}$/;

const sha = (/** @type {string|Buffer} */ x) => createHash('sha256').update(x).digest('hex');

/** Texto acotado y sin caracteres de control. @param {unknown} v @param {number} [max] @returns {string|null} */
export function texto(v, max = MAX_CAMPO) {
  if (typeof v !== 'string') return null;
  return v.replace(/[\u0000-\u001f\u007f]/g, '?').slice(0, max);
}

// ---------------------------------------------------------------- campos del informe

/** @returns {string|null} */
function versionDeFragua() {
  try {
    const p = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'package.json');
    return texto(JSON.parse(fs.readFileSync(p, 'utf8')).version, 64);
  } catch { return null; }
}

/** Identificador de carpeta de spec seguro: nada de separadores ni `..`. @param {unknown} v */
function idSeguro(v) {
  return typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(v) && !v.includes('..') ? v : null;
}

/**
 * Spec activa del proyecto: lo que el propio proyecto declara en `.sdd/estado.json`, más el hash del
 * `spec.md` que hay AHORA (no prueba que sea el aprobado). El aprobador no existe: se declara.
 * @param {string} cwd @returns {{ valor: Record<string, any>|null, motivo: string|null }}
 */
function leerSpec(cwd) {
  let estado;
  try {
    const t = leerArchivo(cwd, path.join(cwd, '.sdd', 'estado.json'), { maxBytes: 1024 * 1024 });
    if (t === null) return { valor: null, motivo: 'el proyecto no tiene .sdd/estado.json' };
    estado = JSON.parse(t);
  } catch (e) { return { valor: null, motivo: `no se pudo leer .sdd/estado.json: ${texto(e instanceof Error ? e.message : String(e), 120)}` }; }
  const id = idSeguro(estado?.spec_activa);
  if (id === null) return { valor: null, motivo: 'no hay spec activa válida en .sdd/estado.json' };
  let contenido;
  try { contenido = leerArchivo(cwd, path.join(cwd, '.sdd', 'especificaciones', id, 'spec.md')); } catch { contenido = null; }
  if (contenido === null) return { valor: null, motivo: `la spec activa "${id}" no tiene spec.md legible` };
  return {
    valor: {
      id, sha256: sha(contenido),
      aprobada: typeof estado.spec_aprobado === 'boolean' ? estado.spec_aprobado : null,
      fecha: texto(estado.ultima_actualizacion, 64),
    },
    motivo: null,
  };
}

/**
 * Commit actual SIN ejecutar nada del repositorio (receta de cambios.js; solo `rev-parse`).
 * @param {string} cwd @returns {{ valor: string|null, motivo: string|null }}
 */
function leerCommit(cwd) {
  try {
    const out = execFileSync('git', [...PREFIJO_GIT, 'rev-parse', '--verify', '--end-of-options', 'HEAD^{commit}'], {
      cwd, env: entornoGit(), timeout: 15_000, maxBuffer: 1024 * 1024, windowsHide: true, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    return /^[0-9a-f]{40,64}$/.test(out) ? { valor: out, motivo: null } : { valor: null, motivo: 'git devolvió un identificador inesperado' };
  } catch (e) {
    const sinGit = /** @type {any} */ (e)?.code === 'ENOENT';
    return { valor: null, motivo: sinGit ? 'git no está instalado' : 'no es un repositorio git o no tiene commits' };
  }
}

const ES_PRUEBA = /(^|\/)(tests?|__tests__)\/|\.(test|spec)\.[cm]?[jt]sx?$|(^|\/)test_[^/]*\.py$|_test\.(py|go)$/i;
const SALTAR = new Set(['node_modules', '.git', '.sdd', 'dist', 'build', '.venv', 'venv', '__pycache__', 'target', 'vendor']);

/**
 * Hash de los archivos de pruebas (ruta + contenido), sin seguir enlaces y con topes.
 * @param {string} cwd @returns {{ valor: { sha256: string, archivos: number, truncado: boolean }|null, motivo: string|null }}
 */
function hashDePruebas(cwd) {
  /** @type {string[]} */ const rutas = [];
  let truncado = false;
  /** @param {string} dir @param {string} rel @param {number} prof */
  const recorrer = (dir, rel, prof) => {
    if (prof > 12 || truncado) return;
    let ents;
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    ents.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const e of ents) {
      if (e.isSymbolicLink()) continue;
      const r = rel === '' ? e.name : `${rel}/${e.name}`;
      if (e.isDirectory()) { if (!SALTAR.has(e.name)) recorrer(path.join(dir, e.name), r, prof + 1); }
      else if (e.isFile() && ES_PRUEBA.test(r)) {
        if (rutas.length >= MAX_ARCHIVOS_PRUEBAS) { truncado = true; return; }
        rutas.push(r);
      }
    }
  };
  recorrer(cwd, '', 0);
  if (rutas.length === 0) return { valor: null, motivo: 'no se encontraron archivos de pruebas' };
  const h = createHash('sha256');
  for (const r of rutas) {
    h.update(`${r}\0`);
    try {
      const st = fs.lstatSync(path.join(cwd, r));
      h.update(st.isFile() && st.size <= MAX_BYTES_PRUEBA ? sha(fs.readFileSync(path.join(cwd, r))) : 'omitido');
    } catch { h.update('ilegible'); }
    h.update('\n');
  }
  return { valor: { sha256: h.digest('hex'), archivos: rutas.length, truncado }, motivo: null };
}

/**
 * Identidad de la imagen LOCAL: `Id` y `RepoDigests` (vacía si se construyó aquí; no se inventa un digest).
 * @param {string|null} etiqueta @param {string} bin
 * @returns {{ valor: { etiqueta: string, id: string|null, repoDigests: string[] }|null, motivo: string|null }}
 */
function identidadDeImagen(etiqueta, bin) {
  const et = texto(etiqueta, 200);
  if (et === null || et === '' || et.startsWith('-')) return { valor: null, motivo: 'la verificación no usó una imagen' };
  try {
    const out = execFileSync(bin, ['image', 'inspect', '--format', '{{.Id}}|{{json .RepoDigests}}', et], {
      timeout: 15_000, maxBuffer: 1024 * 1024, windowsHide: true, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    }).trim().split(/\r?\n/)[0] ?? '';
    const i = out.indexOf('|');
    const id = i > 0 ? out.slice(0, i) : out;
    let repo = [];
    try { const j = JSON.parse(i > 0 ? out.slice(i + 1) : '[]'); if (Array.isArray(j)) repo = j.filter((x) => typeof x === 'string').slice(0, 20).map((x) => texto(x, 300) ?? ''); } catch { /* sin digests */ }
    if (!/^(sha256:)?[0-9a-f]{12,128}$/i.test(id)) return { valor: { etiqueta: et, id: null, repoDigests: [] }, motivo: 'docker devolvió un identificador de imagen que no se reconoce' };
    return { valor: { etiqueta: et, id, repoDigests: repo }, motivo: null };
  } catch {
    return { valor: { etiqueta: et, id: null, repoDigests: [] }, motivo: 'no se pudo consultar la imagen (¿docker no disponible?)' };
  }
}

/**
 * Lista de modelos usados, ya saneada: solo identidad y conteos, nunca texto de prompts ni respuestas.
 * @param {unknown} modelos @returns {Array<Record<string, any>>}
 */
function sanearModelos(modelos) {
  if (!Array.isArray(modelos)) return [];
  return modelos.slice(0, 50).map((m) => ({
    rol: texto(m?.rol, 64), agente: texto(m?.agente, 128), proveedor: texto(m?.proveedor, 64),
    modelo: texto(m?.modelo, 128), modeloServido: texto(m?.modeloServido, 128),
    llamadas: Number.isInteger(m?.llamadas) && m.llamadas >= 0 ? m.llamadas : null,
  }));
}

// ---------------------------------------------------------------- sellado

/** El informe sin lo que no entra en cada hash. @param {Record<string, any>} informe @param {boolean} conSha */
function sinSello(informe, conSha) {
  const { sha256: s, firma: _f, ...ev } = informe.evidencia ?? {};
  return { ...informe, evidencia: conSha ? { ...ev, sha256: s } : ev };
}
export const hashDeInforme = (/** @type {Record<string, any>} */ informe) => sha(canonico(sinSello(informe, false)));
const firmaDeInforme = (/** @type {Buffer} */ clave, /** @type {Record<string, any>} */ informe) => firmar(clave, sinSello(informe, true));

/**
 * Clave local SOLO si ya existe en el estado del usuario (leer o comprobar no crea nada).
 * @param {string} cwd @param {Record<string, string|undefined>} env
 * @returns {{ clave: Buffer|null, dir: string|null, motivo: string|null }}
 */
function claveExistente(cwd, env) {
  try {
    if (!existeEstado(cwd, env)) return { clave: null, dir: null, motivo: 'no hay estado de usuario para este proyecto' };
    const dir = rutaDeEstado(cwd, env);
    if (!fs.existsSync(path.join(dir, 'clave'))) return { clave: null, dir, motivo: 'no hay clave local' };
    return { clave: claveLocal(dir), dir, motivo: null };
  } catch (e) { return { clave: null, dir: null, motivo: texto(e instanceof Error ? e.message : String(e), 160) }; }
}

/** Clave local, CREÁNDOLA si hace falta (solo al registrar). @param {string} cwd @param {Record<string, string|undefined>} env */
function claveParaFirmar(cwd, env) {
  try {
    const dir = directorioDeEstado(cwd, env);
    return { clave: claveLocal(dir), dir, motivo: null };
  } catch (e) { return { clave: null, dir: null, motivo: texto(e instanceof Error ? e.message : String(e), 160) }; }
}

// ---------------------------------------------------------------- lectura de la cadena

/**
 * Lee los informes de la carpeta (sin seguir enlaces, con topes). No lanza.
 * @param {string} cwd
 * @returns {{ informes: Array<{ nombre: string, json: any }>, ilegibles: string[], error: string|null }}
 */
function leerInformes(cwd) {
  const raiz = path.resolve(cwd);
  const dir = path.join(raiz, '.sdd', 'verificaciones');
  /** @type {Array<{ nombre: string, json: any }>} */ const informes = [];
  /** @type {string[]} */ const ilegibles = [];
  let nombres;
  try {
    const st = fs.lstatSync(dir);
    if (st.isSymbolicLink() || !st.isDirectory()) return { informes, ilegibles, error: `${DIRECTORIO_INFORMES} no es una carpeta normal` };
    nombres = fs.readdirSync(dir).filter((n) => n.endsWith('.json')).sort();
  } catch (e) { return { informes, ilegibles, error: /** @type {any} */ (e)?.code === 'ENOENT' ? null : 'no se pudo leer la carpeta de informes' }; }
  for (const nombre of nombres.slice(0, MAX_INFORMES)) {
    try {
      const t = leerArchivo(raiz, path.join(dir, nombre), { maxBytes: MAX_BYTES_INFORME });
      const json = JSON.parse(/** @type {string} */ (t));
      if (json === null || typeof json !== 'object' || Array.isArray(json)) throw new Error('no es un objeto');
      informes.push({ nombre, json });
    } catch { ilegibles.push(texto(nombre, 100) ?? '?'); }
  }
  if (nombres.length > MAX_INFORMES) ilegibles.push(`(hay más de ${MAX_INFORMES} informes: no se leen los demás)`);
  return { informes, ilegibles, error: null };
}

/** @param {any} j */
const idDe = (j) => (typeof j?.id === 'string' ? j.id : '');
/** @param {any} j */
const evDe = (j) => (j && typeof j.evidencia === 'object' && j.evidencia !== null && !Array.isArray(j.evidencia) ? j.evidencia : null);

/** Cabeza guardada en el estado del usuario. @param {string|null} dir @param {Buffer|null} clave */
function leerCabeza(dir, clave) {
  if (dir === null) return { estado: /** @type {const} */ ('ausente'), cabeza: null };
  let t;
  try {
    const ruta = path.join(dir, ARCHIVO_CABEZA);
    const st = fs.lstatSync(ruta);
    if (st.isSymbolicLink() || !st.isFile() || st.size > 4096) return { estado: /** @type {const} */ ('invalida'), cabeza: null };
    t = fs.readFileSync(ruta, 'utf8');
  } catch { return { estado: /** @type {const} */ ('ausente'), cabeza: null }; }
  try {
    const c = JSON.parse(t);
    if (typeof c?.cabeza !== 'string' || !HEX64.test(c.cabeza) || !Number.isInteger(c.n) || c.n < 1) return { estado: /** @type {const} */ ('invalida'), cabeza: null };
    if (clave === null) return { estado: /** @type {const} */ ('sin_clave'), cabeza: c };
    return firmaValida(clave, { cabeza: c.cabeza, id: c.id, n: c.n }, c.firma)
      ? { estado: /** @type {const} */ ('valida'), cabeza: c }
      : { estado: /** @type {const} */ ('invalida'), cabeza: null };
  } catch { return { estado: /** @type {const} */ ('invalida'), cabeza: null }; }
}

/**
 * @typedef {{ tipo: string, id: string|null, detalle: string }} Hallazgo
 * @typedef {{ ok: boolean, nivel: 'firmada'|'encadenada_sin_firma'|'firmas_no_verificables'|'rota'|'vacia',
 *   informes: number, cabeza: string|null, cabezaGuardada: 'coincide'|'no_coincide'|'ausente'|'invalida'|'no_comprobable',
 *   rotura: Hallazgo|null, errores: Hallazgo[], avisos: string[] }} ResultadoComprobacion
 */

/**
 * Recorre la cadena. SOLO LECTURA: no crea la clave ni la cabeza, no escribe nada.
 * @param {string} cwd @param {{ env?: Record<string, string|undefined> }} [opciones]
 * @returns {ResultadoComprobacion & { tip: any }}
 */
function recorrer(cwd, opciones = {}) {
  const env = opciones.env ?? process.env;
  /** @type {Hallazgo[]} */ const errores = [];
  /** @type {string[]} */ const avisos = [];
  const err = (/** @type {string} */ tipo, /** @type {any} */ j, /** @type {string} */ detalle) => errores.push({ tipo, id: j ? (texto(idDe(j), 80) || null) : null, detalle });

  const { informes, ilegibles, error } = leerInformes(cwd);
  if (error) errores.push({ tipo: 'carpeta', id: null, detalle: error });
  for (const n of ilegibles) errores.push({ tipo: 'ilegible', id: null, detalle: `informe ilegible o demasiado grande: ${n}` });

  const { clave, dir, motivo: motivoClave } = claveExistente(cwd, env);
  const encadenados = informes.filter((i) => evDe(i.json) !== null);
  const previos = informes.filter((i) => evDe(i.json) === null);

  if (encadenados.length === 0) {
    if (previos.length > 0) avisos.push(`${previos.length} informe(s) anteriores a la cadena de evidencia (sin bloque «evidencia»)`);
    // Con cabeza guardada y ninguna cadena: todo borrado
    const h = leerCabeza(dir, clave);
    if (h.estado === 'valida' || h.estado === 'sin_clave') errores.push({ tipo: 'truncada', id: null, detalle: 'hay una cabeza guardada en tu estado de usuario pero no queda ningún informe encadenado: la cadena se borró' });
    return { ok: errores.length === 0, nivel: errores.length ? 'rota' : 'vacia', informes: 0, cabeza: null, cabezaGuardada: h.estado === 'ausente' ? 'ausente' : 'no_coincide', rotura: errores[0] ?? null, errores, avisos, tip: null };
  }

  // 1) integridad de cada informe
  const exigeFirma = clave !== null || encadenados.some((i) => typeof evDe(i.json).firma === 'string');
  let firmados = 0;
  /** @type {Map<string, any>} */ const porHash = new Map();
  for (const { nombre, json } of encadenados) {
    const ev = evDe(json);
    if (nombre !== `${idDe(json)}.json`) err('id', json, `el nombre del archivo (${texto(nombre, 100)}) no coincide con el id del informe`);
    if (!HEX64.test(String(ev.sha256 ?? '')) || hashDeInforme(json) !== ev.sha256) { err('alterado', json, 'el contenido no coincide con su sha256 (informe alterado)'); continue; }
    if (porHash.has(ev.sha256)) { err('duplicado', json, 'dos informes con el mismo sha256'); continue; }
    porHash.set(ev.sha256, json);
    if (ev.anterior !== null && !HEX64.test(String(ev.anterior))) err('anterior', json, 'el campo anterior no es un hash ni null');
    if (typeof ev.firma === 'string') {
      if (clave === null) { /* no verificable aquí */ }
      else if (!firmaValida(clave, sinSello(json, true), ev.firma)) err('firma', json, 'la firma no es válida con la clave local (alterado, o firmado en otra máquina o por quien no tiene la clave)');
      else firmados += 1;
    } else if (exigeFirma) {
      err('sin_firma', json, clave !== null ? 'informe sin firma y esta máquina tiene clave local: se exige firma' : 'informe sin firma en una cadena con informes firmados');
    }
  }

  // 2) estructura: una sola raíz, sucesores únicos, todo alcanzable
  /** @type {Map<string, any[]>} */ const sucesores = new Map();
  /** @type {any[]} */ const raices = [];
  for (const j of porHash.values()) {
    const ant = evDe(j).anterior;
    if (ant === null) { raices.push(j); continue; }
    if (!porHash.has(ant)) { err('borrado', j, 'su informe anterior no está (borrado o reordenado): la cadena se rompe aquí'); continue; }
    sucesores.set(ant, [...(sucesores.get(ant) ?? []), j]);
  }
  if (raices.length > 1) err('bifurcada', raices[1], `hay ${raices.length} informes iniciales (cadena bifurcada)`);
  for (const [ant, l] of sucesores) if (l.length > 1) err('bifurcada', l[1], `${l.length} informes comparten el mismo anterior (${ant.slice(0, 12)}): cadena bifurcada`);

  /** @type {any[]} */ const orden = [];
  const vistos = new Set();
  let actual = raices.sort((a, b) => (idDe(a) < idDe(b) ? -1 : 1))[0] ?? null;
  while (actual && !vistos.has(evDe(actual).sha256)) {
    vistos.add(evDe(actual).sha256); orden.push(actual);
    const sig = (sucesores.get(evDe(actual).sha256) ?? []).sort((a, b) => (idDe(a) < idDe(b) ? -1 : 1));
    actual = sig[0] ?? null;
  }
  if (orden.length < porHash.size && errores.length === 0) err('huerfano', null, `${porHash.size - orden.length} informe(s) no enlazan con la cadena`);
  // El orden lo da `anterior` (dentro del hash): reordenar obliga a cambiar `anterior` o el contenido, y eso
  // rompe el sha256 (arriba). No se ordena por id: dos informes del mismo segundo tienen sufijo aleatorio.

  // 3) informes sin evidencia posteriores al inicio de la cadena: no pueden ser «anteriores»
  const primero = orden[0] ? idDe(orden[0]) : null;
  const marca = (/** @type {string} */ i) => i.slice(0, 15);   // AAAAMMDD-HHMMSS: el sufijo es aleatorio
  const previosLegitimos = previos.filter((p) => primero === null || marca(idDe(p.json)) <= marca(primero));
  for (const p of previos) {
    if (!previosLegitimos.includes(p)) err('sin_evidencia', p.json, 'informe sin bloque «evidencia» posterior al inicio de la cadena (¿se le quitó?)');
  }
  if (previosLegitimos.length > 0) avisos.push(`${previosLegitimos.length} informe(s) anteriores a la cadena de evidencia (sin bloque «evidencia»)`);

  const tip = orden[orden.length - 1] ?? null;
  const cabeza = tip ? evDe(tip).sha256 : null;

  // 4) cabeza guardada en el estado del usuario
  const h = leerCabeza(dir, clave);
  /** @type {ResultadoComprobacion['cabezaGuardada']} */
  let cabezaGuardada;
  if (h.estado === 'ausente') {
    cabezaGuardada = clave === null ? 'no_comprobable' : 'ausente';
    avisos.push('no hay cabeza guardada en tu estado de usuario: el truncado de los últimos informes NO se puede detectar');
  } else if (h.estado === 'invalida') {
    cabezaGuardada = 'invalida';
    errores.push({ tipo: 'cabeza', id: null, detalle: 'la cabeza guardada en tu estado de usuario es inválida o su firma no vale' });
  } else if (h.estado === 'sin_clave') {
    cabezaGuardada = 'no_comprobable';
    avisos.push('la cabeza guardada no se puede verificar sin la clave local');
  } else {
    const c = /** @type {any} */ (h.cabeza);
    if (c.cabeza === cabeza) cabezaGuardada = 'coincide';
    else {
      cabezaGuardada = 'no_coincide';
      const pos = orden.findIndex((j) => evDe(j).sha256 === c.cabeza);
      errores.push({
        tipo: 'truncada', id: null,
        detalle: pos >= 0
          ? `la cabeza guardada es el informe n.º ${pos + 1} de ${orden.length}: hay ${orden.length - pos - 1} informe(s) más reciente(s) que ella (cabeza desfasada, p. ej. por una escritura interrumpida; vuelve a registrar)`
          : `la cabeza guardada (${String(c.cabeza).slice(0, 12)}) no está en la cadena: se borraron o sustituyeron los últimos informes`,
      });
    }
    if (cabezaGuardada === 'coincide' && orden.length < c.n) errores.push({ tipo: 'truncada', id: null, detalle: `la cabeza dice ${c.n} informes y hay ${orden.length}` });
  }

  const hayErrores = errores.length > 0;
  /** @type {ResultadoComprobacion['nivel']} */
  const nivel = hayErrores ? 'rota' : clave !== null && firmados === porHash.size ? 'firmada' : encadenados.some((i) => typeof evDe(i.json).firma === 'string') ? 'firmas_no_verificables' : 'encadenada_sin_firma';
  if (nivel === 'encadenada_sin_firma') avisos.push(`encadenada, NO firmada (${motivoClave ?? 'sin clave'}): quien tenga el repositorio puede reconstruirla`);
  if (nivel === 'firmas_no_verificables') avisos.push('hay firmas pero esta máquina no tiene la clave: no se pueden comprobar');
  return { ok: !hayErrores, nivel, informes: orden.length, cabeza, cabezaGuardada, rotura: errores[0] ?? null, errores, avisos, tip };
}

/**
 * Comprueba la cadena de evidencia de un proyecto. Solo lectura.
 * @param {string} cwd @param {{ env?: Record<string, string|undefined> }} [opciones]
 * @returns {ResultadoComprobacion}
 */
export function comprobarEvidencia(cwd, opciones = {}) {
  const { tip: _t, ...r } = recorrer(cwd, opciones);
  return r;
}

// ---------------------------------------------------------------- escritura

/**
 * Resumen de las puertas declaradas para el bloque `evidencia` (spec puertas, fase B1): una entrada por puerta con
 * su categoría y código de salida. Solo existe si el proyecto declara puertas; el detalle (salida acotada) va en
 * `puertas` del informe y entra igual en el hash. Una puerta que no se llegó a ejecutar consta como `no_ejecutada`.
 * @param {any} p  `resultado.puertas`
 * @returns {{ puertas?: { nombre: string, comando: string, categoria: string, codigoSalida: number|null }[] }}
 */
function resumenDePuertas(p) {
  if (!p || !Array.isArray(p.declaradas)) return {};
  const hechos = new Map((Array.isArray(p.resultados) ? p.resultados : []).map((/** @type {any} */ r) => [r.nombre, r]));
  return {
    puertas: p.declaradas.map((/** @type {any} */ d) => {
      const r = hechos.get(d.nombre);
      return {
        nombre: texto(d.nombre, 40) ?? '', comando: texto(d.comando, 300) ?? '',
        categoria: r ? (texto(r.categoria, 40) ?? 'no_ejecutada') : 'no_ejecutada',
        codigoSalida: r && typeof r.codigoSalida === 'number' ? r.codigoSalida : null,
      };
    }),
  };
}

/**
 * Construye el bloque de evidencia de un resultado ya redactado, lo encadena al último informe y lo sella.
 * No escribe el informe: devuelve el objeto completo para que `registro.js` lo cree en exclusiva; luego
 * `guardarCabeza`. Si no hay clave, no se firma y se dice.
 * @param {string} cwd @param {string} id @param {Record<string, any>} resultado  ya redactado
 * @param {{ env?: Record<string, string|undefined>, modelos?: unknown, dockerBin?: string }} [opciones]
 * @returns {{ informe: Record<string, any>, clave: Buffer|null, estadoDir: string|null }}
 */
export function construirInforme(cwd, id, resultado, opciones = {}) {
  const env = opciones.env ?? process.env;
  const raiz = path.resolve(cwd);
  /** @type {Record<string, string>} */ const omitidos = {};
  const nota = (/** @type {string} */ campo, /** @type {{ valor: any, motivo: string|null }} */ r) => { if (r.motivo) omitidos[campo] = r.motivo; return r.valor; };

  const modelos = sanearModelos(opciones.modelos);
  if (modelos.length === 0) omitidos.modelos = 'sin modelo: forge verificar no llama a ningún modelo';
  omitidos.aprobador = 'el proyecto no registra quién aprueba la spec';

  const { clave, dir, motivo: motivoClave } = claveParaFirmar(raiz, env);
  const previa = recorrer(raiz, { env });
  const anterior = previa.tip ? evDe(previa.tip).sha256 : null;
  if (previa.tip && !previa.ok) omitidos.cadenaPrevia = 'la cadena anterior no pasa la comprobación: este informe se encadena al último informe legible';

  const ev = {
    version: VERSION_EVIDENCIA,
    fragua: versionDeFragua(),
    spec: nota('spec', leerSpec(raiz)),
    commit: nota('commit', leerCommit(raiz)),
    pruebas: nota('pruebas', hashDePruebas(raiz)),
    imagen: nota('imagen', identidadDeImagen(typeof resultado.imagen === 'string' ? resultado.imagen : null, opciones.dockerBin ?? 'docker')),
    modelos,
    ...resumenDePuertas(resultado.puertas),
    aprobador: null,
    omitidos,
    firmado: clave !== null,
    anterior,
    sha256: /** @type {string|undefined} */ (undefined),
    firma: /** @type {string|null} */ (null),
  };
  if (clave === null) ev.omitidos.firma = `sin firma: ${motivoClave ?? 'no hay clave local'}`;
  /** @type {Record<string, any>} */
  const informe = { id, ...resultado, evidencia: ev };
  ev.sha256 = hashDeInforme(informe);
  if (clave !== null) ev.firma = firmaDeInforme(clave, informe);
  return { informe, clave, estadoDir: dir };
}

/**
 * Guarda la cabeza (firmada) en el estado del usuario. Sin clave no se guarda nada.
 * @param {string|null} dir @param {Buffer|null} clave @param {Record<string, any>} informe @param {number} n  largo de la cadena con este informe
 * @returns {{ ok: boolean, motivo: string|null }}
 */
export function guardarCabeza(dir, clave, informe, n) {
  if (dir === null || clave === null) return { ok: false, motivo: 'sin clave local: no se guarda la cabeza' };
  try {
    const cuerpo = { cabeza: informe.evidencia.sha256, id: informe.id, n };
    const ruta = path.join(dir, ARCHIVO_CABEZA);
    const tmp = `${ruta}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ ...cuerpo, firma: firmar(clave, cuerpo) }) + '\n', { flag: 'w', mode: 0o600 });
    fs.renameSync(tmp, ruta);
    return { ok: true, motivo: null };
  } catch (e) { return { ok: false, motivo: texto(e instanceof Error ? e.message : String(e), 160) }; }
}

/**
 * Registro completo: construye, crea el archivo en exclusiva y guarda la cabeza.
 * @param {string} cwd @param {string} id @param {Record<string, any>} resultado
 * @param {(informe: Record<string, any>) => boolean} crear  crea el archivo (false si ya existía)
 * @param {{ env?: Record<string, string|undefined>, modelos?: unknown, dockerBin?: string }} [opciones]
 * @returns {{ informe: Record<string, any>, firmado: boolean, cabeza: { ok: boolean, motivo: string|null } }}
 */
export function registrarEncadenado(cwd, id, resultado, crear, opciones = {}) {
  const { informe, clave, estadoDir } = construirInforme(cwd, id, resultado, opciones);
  if (crear(informe) !== true) throw new Error(`No se pudo crear el informe ${texto(id, 80)}: ya existe.`);
  const total = recorrer(cwd, { env: opciones.env });
  const cabeza = guardarCabeza(estadoDir, clave, informe, total.informes);
  return { informe, firmado: clave !== null, cabeza };
}
