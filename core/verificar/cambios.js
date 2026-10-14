/**
 * verificar/cambios.js — archivos cambiados desde una referencia de git SIN ejecutar nada del repositorio
 *
 * Receta del spike S0.2 (spikes/cambios-sin-ejecutar.md). Un repositorio de un tercero puede traer en
 * `.git/config`, `.gitattributes` o `.git/info/attributes` programas que git ejecuta al leer el índice
 * (`core.fsmonitor`) o el contenido filtrado del directorio de trabajo (`filter.*.clean`,
 * `diff.*.textconv`, `diff.external`). Por eso:
 *
 *  - solo se usan órdenes que leen OBJETOS o el índice y que el spike confirmó limpias, con
 *    `core.fsmonitor=false` fijado con `-c`: `rev-parse`, `ls-tree`, `ls-files -z` (solo nombres) y
 *    `cat-file blob`;
 *  - `diff`, `status`, `ls-files -m`, `cat-file --filters` y `show --textconv` NO son seguras y no se usan;
 *  - el directorio de trabajo se compara en Node: el id de blob de git (`sha1("blob <n>\0" + bytes)`)
 *    de cada archivo, sin filtros, contra el del árbol de la referencia;
 *  - `execFile` sin shell, entorno construido desde cero, con tiempo y tope de salida.
 *
 * Con `core.autocrlf` o filtros que cambian bytes puede haber falsos positivos (un archivo «cambiado» que
 * no lo está): solo añaden candidatos, y la medición los acota por líneas con `originalDe`.
 * Los borrados no se devuelven. No se recorren submódulos.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { execFile } from 'child_process';

const NULO = process.platform === 'win32' ? 'NUL' : '/dev/null';
const TIEMPO_MS = 30_000;
const MAX_SALIDA = 64 * 1024 * 1024;
/** Más archivos candidatos con original que esto: el resto se mide enteros (no se lee su original). */
const MAX_ORIGINALES = 200;
const MAX_BYTES_ARCHIVO = 4 * 1024 * 1024;

/** Prefijo fijo de toda invocación: neutraliza lo que `-c` puede neutralizar. */
export const PREFIJO_GIT = Object.freeze([
  '-c', 'core.fsmonitor=false',
  '-c', `core.hooksPath=${NULO}`,
  '-c', `core.attributesFile=${NULO}`,
  '-c', 'core.pager=cat',
  '-c', 'core.quotePath=false',
  '-c', 'core.untrackedCache=false',
  '-c', 'diff.external=',
  '-c', 'core.sshCommand=',
]);

/** Entorno propio: nada de `GIT_DIR`, `GIT_EXTERNAL_DIFF`, `GIT_PAGER`, `GIT_SSH*`, `GIT_ASKPASS` heredados. */
export function entornoGit() {
  /** @type {Record<string, string>} */
  const e = {
    PATH: process.env.PATH ?? process.env.Path ?? '',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: NULO,
    GIT_OPTIONAL_LOCKS: '0',
    GIT_TERMINAL_PROMPT: '0',
    GIT_PAGER: 'cat',
    LC_ALL: 'C',
  };
  for (const k of ['SystemRoot', 'SYSTEMROOT', 'TEMP', 'TMP', 'TMPDIR', 'ComSpec']) {
    if (process.env[k]) e[k] = /** @type {string} */ (process.env[k]);
  }
  return e;
}

/**
 * @param {string} cwd @param {string[]} args
 * @returns {Promise<{ ok: true, stdout: Buffer } | { ok: false, error: string }>}
 */
function git(cwd, args) {
  return new Promise((resolver) => {
    execFile('git', [...PREFIJO_GIT, ...args], {
      cwd, env: entornoGit(), timeout: TIEMPO_MS, maxBuffer: MAX_SALIDA, windowsHide: true, encoding: 'buffer',
    }, (err, stdout, stderr) => {
      if (err) {
        const detalle = Buffer.from(stderr ?? '').toString('utf8').trim().split('\n').slice(-2).join(' ');
        const sinGit = /** @type {any} */ (err).code === 'ENOENT';
        return resolver({ ok: false, error: sinGit ? 'git no está instalado o no está en el PATH' : (detalle || err.message) });
      }
      resolver({ ok: true, stdout: Buffer.from(stdout) });
    });
  });
}

/** Id de blob de git de un contenido, sin filtros. @param {Buffer} bytes */
export function idDeBlob(bytes) {
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

/**
 * @param {string} cwd  carpeta del proyecto (dentro de un repositorio git)
 * @param {string} referencia  rama, etiqueta o hash
 * @param {{ esValida?: (ruta: string) => boolean }} [opciones]  filtro de rutas (validarRuta y lenguaje)
 * @returns {Promise<{ ok: true, archivos: string[], commit: string, originalDe: (ruta: string) => string|null }
 *   | { ok: false, error: string }>}
 */
export async function cambiosDesde(cwd, referencia, opciones = {}) {
  const sugerencia = ' Indica los archivos con --archivos <a,b>.';
  const ref = String(referencia ?? '');
  if (ref === '' || ref.startsWith('-') || /[\u0000-\u001f\u007f]/.test(ref)) {
    return { ok: false, error: `La referencia de --desde no es válida: "${ref.replace(/[\u0000-\u001f\u007f]/g, '?')}".${sugerencia}` };
  }
  const r = await git(cwd, ['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`]);
  if (r.ok === false) return { ok: false, error: `No se pudo resolver la referencia "${ref}" de --desde (¿no es un repositorio git, o no existe?): ${r.error}.${sugerencia}` };
  const commit = r.stdout.toString('utf8').trim();
  if (!/^[0-9a-f]{40,64}$/.test(commit)) return { ok: false, error: `git devolvió un identificador inesperado para "${ref}".${sugerencia}` };

  // Árbol de la referencia (relativo a cwd): { ruta: id de blob }
  const t = await git(cwd, ['ls-tree', '-r', '-z', commit]);
  if (t.ok === false) return { ok: false, error: `No se pudo leer el árbol de "${ref}": ${t.error}.${sugerencia}` };
  /** @type {Map<string, string>} */
  const enReferencia = new Map();
  for (const entrada of t.stdout.toString('utf8').split('\0')) {
    const m = /^(\d+) (\w+) ([0-9a-f]{40,64})\t([\s\S]+)$/.exec(entrada);
    if (m && m[2] === 'blob' && m[1] !== '120000') enReferencia.set(m[4], m[3]);
  }

  // Archivos presentes: versionados y nuevos no ignorados (solo nombres; sin filtros ni contenido)
  const l = await git(cwd, ['ls-files', '-z', '-c', '-o', '--exclude-standard']);
  if (l.ok === false) return { ok: false, error: `No se pudo listar los archivos del proyecto: ${l.error}.${sugerencia}` };
  const presentes = [...new Set(l.stdout.toString('utf8').split('\0').filter(Boolean))].sort();

  /** @type {string[]} */
  const archivos = [];
  for (const ruta of presentes) {
    if (opciones.esValida && !opciones.esValida(ruta)) continue;
    const abs = path.resolve(cwd, ruta);
    let bytes;
    try {
      const st = fs.lstatSync(abs);
      if (!st.isFile() || st.size > MAX_BYTES_ARCHIVO) continue;   // enlaces, carpetas, enormes: fuera
      bytes = fs.readFileSync(abs);
    } catch { continue; }                                          // borrado entre medias
    if (enReferencia.get(ruta) !== idDeBlob(bytes)) archivos.push(ruta);
  }

  // Originales (objetos, sin filtros) de los modificados; los nuevos no tienen
  /** @type {Map<string, string>} */
  const originales = new Map();
  for (const ruta of archivos.filter((a) => enReferencia.has(a)).slice(0, MAX_ORIGINALES)) {
    const id = /** @type {string} */ (enReferencia.get(ruta));
    const c = await git(cwd, ['cat-file', 'blob', id]);
    if (c.ok) originales.set(ruta, c.stdout.toString('utf8'));
  }
  return { ok: true, archivos, commit, originalDe: (ruta) => originales.get(ruta) ?? null };
}
