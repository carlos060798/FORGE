/**
 * estado-usuario.js — Estado de las integraciones que el REPOSITORIO no puede fabricar (revisión 2, H1/H3/H8/H9)
 *
 * Todo lo que vive en el árbol del proyecto lo controla quien escribió el repositorio que se clonó. Lo
 * que AUTORIZA una escritura en una plataforma (la cola de aprobaciones, el bloqueo por alcance del
 * token, los contadores de operaciones) vive aquí, en un directorio del USUARIO, fuera del árbol:
 *
 *   <FORGE_HOME>/integraciones/<hash>/            si FORGE_HOME está definida (pruebas, o quien quiera moverlo)
 *   %LOCALAPPDATA%\fragua\integraciones\<hash>\   en Windows (si solo existe la antigua `forge`, esa)
 *   ~/.fragua/integraciones/<hash>/               en el resto (si solo existe la antigua `.forge`, esa)
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
import { chmodSync, linkSync, lstatSync, mkdirSync, readFileSync, realpathSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { leerVariable } from './entorno.js';
import { isAbsolute, join, resolve, sep } from 'node:path';

export const VARIABLE_HOME = 'FORGE_HOME';

/** JSON con las claves ordenadas: la misma cadena para el mismo valor. @param {unknown} v @returns {string} */
export function canonico(v, prof = 0) {
  // E-2: un informe anidado a miles de niveles desbordaba la pila con un RangeError genérico
  if (prof > 500) throw new Error('El dato es demasiado anidado para sellarlo (más de 500 niveles).');
  if (Array.isArray(v)) return `[${v.map((x) => canonico(x, prof + 1)).join(',')}]`;
  if (v !== null && typeof v === 'object') {
    const o = /** @type {Record<string, unknown>} */ (v);
    return `{${Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonico(o[k], prof + 1)}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

/**
 * Raíz del estado del usuario (sin el hash del proyecto).
 * @param {Record<string, string|undefined>} [env]
 */
export function raizDeEstado(env = process.env) {
  const home = String(leerVariable('HOME', env) ?? '').trim();
  if (home !== '') return join(resolve(home), 'integraciones');
  const { nueva, antigua } = raicesPorDefecto(env);
  // Sin migración: nunca se copia ni se mueve una clave o una cola. Manda la nueva si existe; si solo hay
  // la antigua se sigue usando (para poder aprobar lo ya firmado); en una instalación limpia, la nueva.
  if (esCarpeta(nueva)) return nueva;
  if (esCarpeta(antigua)) return antigua;
  return nueva;
}

/** @param {string} p */
function esCarpeta(p) {
  try { return lstatSync(p).isDirectory(); } catch { return false; }
}

/**
 * Las dos raíces por defecto (nueva «fragua» y antigua «forge») cuando no hay FRAGUA_HOME/FORGE_HOME.
 * @param {Record<string, string|undefined>} [env]
 * @returns {{ nueva: string, antigua: string }}
 */
export function raicesPorDefecto(env = process.env) {
  if (process.platform === 'win32') {
    const declarada = String(env.LOCALAPPDATA ?? '').trim();
    // Una ruta relativa dependería del directorio de trabajo, que puede ser el del proyecto
    const base = declarada !== '' && isAbsolute(declarada) ? declarada : join(homedir(), 'AppData', 'Local');
    return { nueva: join(base, 'fragua', 'integraciones'), antigua: join(base, 'forge', 'integraciones') };
  }
  return { nueva: join(homedir(), '.fragua', 'integraciones'), antigua: join(homedir(), '.forge', 'integraciones') };
}

/**
 * Carpeta de estado antigua que existe pero NO se usa (porque ya existe la nueva), para que `doctor` avise.
 * Solo con la raíz por defecto: con FRAGUA_HOME/FORGE_HOME la elige el usuario.
 * @param {Record<string, string|undefined>} [env]
 * @returns {string|null}
 */
export function estadoAntiguoSinUsar(env = process.env) {
  if (String(leerVariable('HOME', env) ?? '').trim() !== '') return null;
  const { nueva, antigua } = raicesPorDefecto(env);
  return esCarpeta(nueva) && esCarpeta(antigua) ? antigua : null;
}

/**
 * Ruta del estado de ESTE proyecto, SIN crear nada (para lecturas como `forge status`: abrir un
 * repositorio ajeno no debe dejar rastro en el equipo del usuario). Rechaza una raíz que caiga dentro
 * del proyecto: un repositorio no debe poder mover el estado de aprobaciones a su propio árbol.
 * @param {string} cwd
 * @param {Record<string, string|undefined>} [env]
 * @returns {string}
 */
export function rutaDeEstado(cwd, env = process.env) {
  let real;
  try { real = realpathSync(resolve(cwd)); } catch { real = resolve(cwd); }
  const proyecto = process.platform === 'win32' ? real.toLowerCase() : real;
  const hash = createHash('sha256').update(proyecto).digest('hex').slice(0, 32);
  const raiz = raizDeEstado(env);
  let raizReal = raiz;
  try { raizReal = realpathSync(raiz); } catch { /* aún no existe: se compara la ruta declarada */ }
  const norm = (/** @type {string} */ p) => (process.platform === 'win32' ? p.toLowerCase() : p);
  const base = norm(proyecto) + sep;
  if (norm(resolve(raiz)) + sep === base || (norm(resolve(raiz)) + sep).startsWith(base) || (norm(raizReal) + sep).startsWith(base)) {
    throw new Error('El estado de las integraciones (FORGE_HOME o la carpeta de datos de tu usuario) apunta DENTRO del proyecto: un proyecto no puede guardar sus propias aprobaciones. Cámbialo a una carpeta fuera del proyecto.');
  }
  return join(raiz, hash);
}

/**
 * ¿Existe ya el estado de este proyecto? No crea nada.
 * @param {string} cwd @param {Record<string, string|undefined>} [env]
 */
export function existeEstado(cwd, env = process.env) {
  try { return lstatSync(rutaDeEstado(cwd, env)).isDirectory(); } catch { return false; }
}

/**
 * Directorio de estado de ESTE proyecto (se crea con modo 0700). La ruta que se hashea es la real, así
 * que un enlace o una unión hacia el mismo proyecto da el mismo directorio.
 * @param {string} cwd
 * @param {Record<string, string|undefined>} [env]
 * @returns {string}
 */
export function directorioDeEstado(cwd, env = process.env) {
  const dir = rutaDeEstado(cwd, env);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  try { if (process.platform !== 'win32') chmodSync(dir, 0o700); } catch { /* no es nuestro: se sigue */ }
  const st = lstatSync(dir);
  comprobarPropietarioDelEstado(st, typeof process.getuid === 'function' ? process.getuid() : undefined);
  return dir;
}

/**
 * H-5: la carpeta de estado que YA existía debe ser del propio usuario. En un sistema compartido otro
 * usuario podría haberla creado antes (con una clave que él conoce).
 *   - POSIX: el uid del dueño es el propio y el modo no da permisos a grupo ni a otros.
 *   - Windows: no hay uid en Node; solo se comprueba lo posible (no es enlace ni unión, es carpeta). La
 *     protección real es la ACL heredada de %LOCALAPPDATA% (límite conocido y documentado).
 * @param {{ isDirectory(): boolean, isSymbolicLink(): boolean, uid?: number, mode?: number }} st resultado de lstat
 * @param {number|undefined} uidPropio
 * @param {string} [plataforma]
 */
export function comprobarPropietarioDelEstado(st, uidPropio, plataforma = process.platform) {
  if (st.isSymbolicLink() || !st.isDirectory()) throw new Error('El directorio de estado de las integraciones no es una carpeta normal; no se usa.');
  if (plataforma === 'win32' || uidPropio === undefined) return;
  if (st.uid !== uidPropio) throw new Error('El directorio de estado de las integraciones no es tuya (otro usuario la creó); no se usa. Bórrala o define FRAGUA_HOME en una carpeta tuya.');
  if (((st.mode ?? 0) & 0o077) !== 0) throw new Error('El directorio de estado de las integraciones tiene permisos para el grupo u otros usuarios y no se pudo cerrar a 0700; no se usa.');
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
  // Se escribe completa en un temporal y se enlaza al nombre final: `linkSync` es atómico y falla si ya
  // existe, así que un proceso que llega a la vez nunca ve un archivo vacío ni a medias (N3-01)
  const temporal = `${ruta}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  try {
    writeFileSync(temporal, `${nueva.toString('hex')}\n`, { flag: 'wx', mode: 0o600 });
    linkSync(temporal, ruta);
    return nueva;
  } catch (e) {
    if (/** @type {any} */ (e)?.code !== 'EEXIST') throw e;
    const k = leer(readFileSync(ruta, 'utf8'));
    if (!k) throw new Error('La clave local de las integraciones está dañada: bórrala (se pierden las aprobaciones pendientes) y vuelve a preparar con «forge integraciones publicar».');
    return k;
  } finally {
    try { unlinkSync(temporal); } catch { /* ya no está */ }
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
