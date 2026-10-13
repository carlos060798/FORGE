/**
 * estado-usuario.js — Estado de las integraciones que el REPOSITORIO no puede fabricar (revisión 2, H1/H3/H8/H9)
 *
 * Todo lo que vive en el árbol del proyecto lo controla quien escribió el repositorio que se clonó. Lo
 * que AUTORIZA una escritura en una plataforma (la cola de aprobaciones, el bloqueo por alcance del
 * token, los contadores de operaciones) vive aquí, en un directorio del USUARIO, fuera del árbol:
 *
 *   <FORGE_HOME>/integraciones/<hash>/            si FORGE_HOME está definida (pruebas, o quien quiera moverlo)
 *   %LOCALAPPDATA%\forge\integraciones\<hash>\    en Windows
 *   ~/.forge/integraciones/<hash>/                en el resto
 *
 * `<hash>` es el SHA-256 (32 primeros hex) de la ruta REAL del proyecto (en Windows, sin distinguir
 * mayúsculas). Dentro: `clave` (32 bytes aleatorios en hex, generada la primera vez, modo 0600 donde el
 * sistema lo respeta), `pendientes/`, `alcance.json`, `sesiones/` y `dias/`.
 *
 * Cada pendiente lleva un HMAC-SHA256 con esa clave: un archivo que alguien dejó en la carpeta sin
 * conocer la clave no se aprueba. La clave no se escribe NUNCA en el árbol del proyecto.
 *
 * En Windows el modo 0600 no se aplica; la protección es la ACL heredada de `%LOCALAPPDATA%` (solo el
 * propio usuario, SYSTEM y los administradores). Es código de utilidad: no usa red ni importa nada de
 * proveedores.
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { chmodSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

export const VARIABLE_HOME = 'FORGE_HOME';

/** JSON con las claves ordenadas: la misma cadena para el mismo valor. @param {unknown} v @returns {string} */
export function canonico(v) {
  if (Array.isArray(v)) return `[${v.map(canonico).join(',')}]`;
  if (v !== null && typeof v === 'object') {
    const o = /** @type {Record<string, unknown>} */ (v);
    return `{${Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonico(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

/**
 * Raíz del estado del usuario (sin el hash del proyecto).
 * @param {Record<string, string|undefined>} [env]
 */
export function raizDeEstado(env = process.env) {
  const home = String(env[VARIABLE_HOME] ?? '').trim();
  if (home !== '') return join(resolve(home), 'integraciones');
  if (process.platform === 'win32') {
    const base = String(env.LOCALAPPDATA ?? '').trim() || join(homedir(), 'AppData', 'Local');
    return join(base, 'forge', 'integraciones');
  }
  return join(homedir(), '.forge', 'integraciones');
}

/**
 * Directorio de estado de ESTE proyecto (se crea con modo 0700). La ruta que se hashea es la real, así
 * que un enlace o una unión hacia el mismo proyecto da el mismo directorio.
 * @param {string} cwd
 * @param {Record<string, string|undefined>} [env]
 * @returns {string}
 */
export function directorioDeEstado(cwd, env = process.env) {
  let real;
  try { real = realpathSync(resolve(cwd)); } catch { real = resolve(cwd); }
  if (process.platform === 'win32') real = real.toLowerCase();
  const hash = createHash('sha256').update(real).digest('hex').slice(0, 32);
  const dir = join(raizDeEstado(env), hash);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  try { if (process.platform !== 'win32') chmodSync(dir, 0o700); } catch { /* no es nuestro: se sigue */ }
  const st = lstatSync(dir);
  if (st.isSymbolicLink() || !st.isDirectory()) throw new Error('El directorio de estado de las integraciones no es una carpeta normal; no se usa.');
  return dir;
}

/**
 * Clave local de autenticación (Buffer de 32 bytes). Se crea una sola vez con O_EXCL.
 * @param {string} dir directorio de estado ya creado
 * @returns {Buffer}
 */
export function claveLocal(dir) {
  const ruta = join(dir, 'clave');
  /** @param {string} t */
  const leer = (t) => (/^[0-9a-f]{64}$/.test(t.trim()) ? Buffer.from(t.trim(), 'hex') : null);
  try {
    const st = lstatSync(ruta);
    if (st.isSymbolicLink() || !st.isFile()) throw new Error('La clave local de las integraciones no es un archivo normal.');
    const k = leer(readFileSync(ruta, 'utf8'));
    if (k) return k;
    throw new Error('La clave local de las integraciones está dañada: bórrala (se pierden las aprobaciones pendientes) y vuelve a preparar con «forge integraciones publicar».');
  } catch (e) {
    if (/** @type {any} */ (e)?.code !== 'ENOENT') throw e;
  }
  const nueva = randomBytes(32);
  try {
    writeFileSync(ruta, `${nueva.toString('hex')}\n`, { flag: 'wx', mode: 0o600 });
    return nueva;
  } catch (e) {
    if (/** @type {any} */ (e)?.code !== 'EEXIST') throw e;
    const k = leer(readFileSync(ruta, 'utf8'));
    if (!k) throw new Error('La clave local de las integraciones está dañada.');
    return k;
  }
}

/** @param {Buffer} clave @param {unknown} valor @returns {string} HMAC-SHA256 en hex */
export function firmar(clave, valor) {
  return createHmac('sha256', clave).update(canonico(valor)).digest('hex');
}

/** @param {Buffer} clave @param {unknown} valor @param {unknown} firma */
export function firmaValida(clave, valor, firma) {
  if (typeof firma !== 'string' || !/^[0-9a-f]{64}$/.test(firma)) return false;
  const esperada = Buffer.from(firmar(clave, valor), 'hex');
  return timingSafeEqual(esperada, Buffer.from(firma, 'hex'));
}
