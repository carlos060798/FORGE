/**
 * escritura-segura.js — Escribir en un proyecto ajeno sin seguir enlaces
 *
 * `forge init` corre dentro de un repositorio que puede ser hostil. Un enlace simbólico (o, en
 * Windows, una unión de directorio) colocado donde `init` va a escribir lo llevaría a crear o
 * pisar un archivo FUERA del proyecto, con un contenido que el atacante influye. Revisión
 * independiente de la fase 9, H-01.
 *
 * Reglas, todas comprobadas con `lstat` (que NO sigue el enlace):
 *   - ningún componente de la ruta, desde la raíz de escritura hasta el destino, es un enlace
 *     (un enlace colgante tampoco: `existsSync` lo ve como «no existe» y `writeFileSync` lo sigue);
 *   - la ruta resuelta con `realpath` queda dentro de la raíz;
 *   - un archivo nuevo se crea con `openSync(ruta, 'wx')` (O_EXCL: no sigue enlaces ni pisa nada);
 *   - un archivo que ya existe y debe actualizarse se borra (si es un archivo normal) y se vuelve
 *     a crear con 'wx': así tampoco se escribe «a través» de un enlace duro hacia otro lugar.
 *
 * Quien llama decide qué hacer con un `ErrorEnlace`: `init` informa y no escribe.
 * Queda una ventana mínima entre la comprobación y la apertura (otro proceso podría cambiar un
 * directorio por un enlace justo en medio); 'wx' la cierra para el último componente y la
 * comprobación posterior con `realpath` para los directorios.
 */

import {
  closeSync, constants, lstatSync, mkdirSync, openSync, readdirSync, readFileSync, realpathSync, renameSync, statSync, unlinkSync, writeSync,
} from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

export class ErrorEnlace extends Error {
  /** @param {string} ruta @param {string} motivo */
  constructor(ruta, motivo) {
    super(`${motivo}: ${ruta}`);
    this.name = 'ErrorEnlace';
    this.ruta = ruta;
  }
}

const minus = (s) => (process.platform === 'win32' ? s.toLowerCase() : s);

/** ¿Está `ruta` dentro de `raiz` (o es ella)? Ambas absolutas y ya resueltas. */
function dentro(raiz, ruta) {
  const r = relative(minus(raiz), minus(ruta));
  return r === '' || (r !== '..' && !r.startsWith('..' + sep) && !isAbsolute(r));
}

/** `lstat` sin lanzar si no existe. @returns {import('node:fs').Stats | null} */
function lstatONulo(ruta) {
  try { return lstatSync(ruta); } catch (e) {
    if (/** @type {any} */ (e).code === 'ENOENT' || /** @type {any} */ (e).code === 'ENOTDIR') return null;
    throw e;
  }
}

/**
 * La raíz de escritura es una ruta, o `{ raiz, enlacesPermitidos }`: con lo segundo, esas rutas
 * concretas (directorios) pueden ser un enlace o una unión que el USUARIO creó antes de que FORGE
 * escribiera, y se sigue por decisión explícita (p. ej. `~/.claude/commands` apuntando a un
 * repositorio de dotfiles). Cualquier otro enlace sigue prohibido, y también uno dentro del destino
 * de uno permitido.
 * @typedef {string | { raiz: string, enlacesPermitidos?: string[] }} Raiz
 * @param {Raiz} r
 * @returns {{ raiz: string, permitidos: string[] }}
 */
function normalizarRaiz(r) {
  if (typeof r === 'string') return { raiz: resolve(r), permitidos: [] };
  return { raiz: resolve(r.raiz), permitidos: (r.enlacesPermitidos ?? []).map((p) => resolve(p)) };
}

/**
 * Comprueba que escribir en `ruta` no sale de `raiz` por un enlace. No crea nada.
 * @param {Raiz} raizArg  directorio donde está permitido escribir
 * @param {string} ruta  destino (archivo o directorio)
 * @returns {string} la ruta absoluta del destino
 */
export function verificarRuta(raizArg, ruta) {
  const { raiz, permitidos } = normalizarRaiz(raizArg);
  const base = raiz;
  const destino = resolve(ruta);
  if (!dentro(base, destino)) throw new ErrorEnlace(destino, 'La ruta queda fuera del proyecto');

  // La raíz misma se resuelve (el proyecto puede estar en un directorio con enlaces, o ser él mismo una unión: no es asunto nuestro)
  const baseReal = realpathSync(base);
  let actual = base;
  /** @type {string[]} destinos reales de los enlaces permitidos que el camino cruza */
  const cruzados = [];
  const partes = relative(base, destino).split(sep).filter(Boolean);
  for (const parte of partes) {
    actual = join(actual, parte);
    const st = lstatONulo(actual);
    if (st === null) break;                                   // lo que falta lo crearemos nosotros
    if (st.isSymbolicLink()) {
      if (permitidos.some((p) => minus(p) === minus(actual))) {
        let real;
        try { real = realpathSync(actual); if (!statSync(real).isDirectory()) throw new Error('no es un directorio'); } catch {
          throw new ErrorEnlace(actual, 'Es un enlace permitido, pero está roto o no apunta a un directorio');
        }
        cruzados.push(real);
        continue;
      }
      throw new ErrorEnlace(actual, 'Es un enlace simbólico o una unión; no se escribe a través de ellos');
    }
  }
  // El directorio existente más profundo, ya resuelto, tiene que seguir dentro de la raíz (o del destino de un enlace permitido)
  let existente = destino;
  while (lstatONulo(existente) === null && existente !== dirname(existente)) existente = dirname(existente);
  const real = realpathSync(existente);
  if (!dentro(baseReal, real) && !cruzados.some((c) => dentro(c, real))) throw new ErrorEnlace(existente, 'El directorio resuelve fuera del proyecto');
  return destino;
}

/**
 * Crea un directorio (y sus padres) comprobando antes cada componente.
 * @param {Raiz} raiz @param {string} dir
 */
export function crearDirectorio(raiz, dir) {
  const { raiz: base, permitidos } = normalizarRaiz(raiz);
  const d = verificarRuta(raiz, dir);
  mkdirSync(d, { recursive: true });
  verificarRuta(raiz, d);                                     // por si cambió mientras se creaba
  const st = lstatSync(d);
  // La propia raíz, o un enlace permitido, puede ser una unión: se comprueba que lleva a un directorio
  const sePermite = minus(d) === minus(base) || permitidos.some((p) => minus(p) === minus(d));
  if (st.isSymbolicLink()) {
    if (!sePermite || !statSync(d).isDirectory()) throw new ErrorEnlace(d, 'No es un directorio normal');
  } else if (!st.isDirectory()) {
    throw new ErrorEnlace(d, 'No es un directorio normal');
  }
  return d;
}

/** Más que esto no es un archivo de configuración o de manifiesto: no se lee. */
const MAX_LECTURA = 8 * 1024 * 1024;

/**
 * Lee un archivo de texto del proyecto con la misma política que las escrituras: ningún componente
 * es un enlace (así el contenido de un archivo ajeno no acaba en lo que FORGE genera), no sale de la
 * raíz y tiene que ser un archivo normal (una tubería con nombre colgaría la lectura).
 * @param {Raiz} raiz @param {string} ruta @param {{ maxBytes?: number }} [opciones]
 * @returns {string|null} null si no existe
 * @throws {ErrorEnlace} si es un enlace, no es un archivo normal o es demasiado grande
 */
export function leerArchivo(raiz, ruta, opciones = {}) {
  const destino = verificarRuta(raiz, ruta);
  const st = lstatONulo(destino);
  if (st === null) return null;
  if (st.isSymbolicLink()) throw new ErrorEnlace(destino, 'El archivo es un enlace; no se lee a través de él');
  if (!st.isFile()) throw new ErrorEnlace(destino, 'No es un archivo normal (carpeta, tubería o dispositivo): no se lee');
  if (st.size > (opciones.maxBytes ?? MAX_LECTURA)) throw new ErrorEnlace(destino, 'El archivo es demasiado grande: no se lee');
  return readFileSync(destino, 'utf8');
}

/**
 * Crea un archivo que no existe. Nunca sobrescribe.
 * @param {string} raiz @param {string} ruta @param {string|Buffer} contenido
 * @param {number} [modo]
 * @returns {boolean} true si lo creó; false si ya existía un archivo normal
 * @throws {ErrorEnlace} si el destino (o algo en su camino) es un enlace, incluso colgante
 */
export function crearArchivo(raiz, ruta, contenido, modo = 0o644) {
  const destino = verificarRuta(raiz, ruta);
  const st = lstatONulo(destino);
  if (st !== null) {
    if (st.isSymbolicLink()) throw new ErrorEnlace(destino, 'El destino es un enlace; no se escribe a través de él');
    if (!st.isFile()) throw new ErrorEnlace(destino, 'El destino existe y no es un archivo normal');
    return false;
  }
  crearDirectorio(raiz, dirname(destino));
  let fd;
  try {
    fd = openSync(destino, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, modo);
  } catch (e) {
    // 'wx' falla con EEXIST también si alguien puso un enlace entre la comprobación y la apertura
    if (/** @type {any} */ (e).code === 'EEXIST') {
      const ahora = lstatONulo(destino);
      if (ahora?.isSymbolicLink()) throw new ErrorEnlace(destino, 'El destino es un enlace; no se escribe a través de él');
      return false;
    }
    throw e;
  }
  try {
    const buf = typeof contenido === 'string' ? Buffer.from(contenido, 'utf8') : contenido;
    let escrito = 0;
    while (escrito < buf.length) escrito += writeSync(fd, buf, escrito);
  } finally {
    closeSync(fd);
  }
  return true;
}

/**
 * Deja `ruta` con este contenido: la crea o la reemplaza, pero solo si ya es un archivo normal.
 * El reemplazo borra el archivo y lo crea de nuevo con 'wx', de modo que no se escribe sobre un
 * enlace duro que apunte a otro lugar ni se sigue un enlace puesto a medias.
 * @param {string} raiz @param {string} ruta @param {string|Buffer} contenido
 * @param {number} [modo]
 */
export function escribirArchivo(raiz, ruta, contenido, modo) {
  const destino = verificarRuta(raiz, ruta);
  const st = lstatONulo(destino);
  if (st !== null) {
    if (st.isSymbolicLink()) throw new ErrorEnlace(destino, 'El destino es un enlace; no se escribe a través de él');
    if (!st.isFile()) throw new ErrorEnlace(destino, 'El destino existe y no es un archivo normal');
    const m = modo ?? (st.mode & 0o777);
    // Temporal exclusivo ('wx') en la misma carpeta y `rename` encima: si el proceso muere en medio, el
    // original sigue entero o el nuevo está completo (borrar y recrear perdía el archivo en esa ventana).
    // `rename` reemplaza la ENTRADA, no el contenido: un enlace duro hacia otro lugar no se escribe.
    const temporal = `${destino}.forge-tmp-${process.pid}-${randomBytes(4).toString('hex')}`;
    crearArchivo(raiz, temporal, contenido, m);
    try {
      // Entre la comprobación y el reemplazo, el destino pudo cambiar a un enlace
      const ahora = lstatONulo(destino);
      if (ahora === null || ahora.isSymbolicLink() || !ahora.isFile()) throw new ErrorEnlace(destino, 'El destino cambió mientras se escribía; no se reemplaza');
      renameSync(temporal, destino);
    } catch (e) {
      try { unlinkSync(temporal); } catch { /* ya no está */ }
      throw e;
    }
    return true;
  }
  return crearArchivo(raiz, destino, contenido, modo);
}

/**
 * Copia un archivo del plugin (de confianza) a un destino del proyecto, conservando su modo.
 * @param {string} raiz @param {string} origen @param {string} destino
 */
export function copiarArchivo(raiz, origen, destino) {
  return escribirArchivo(raiz, destino, readFileSync(origen), statSync(origen).mode & 0o777);
}

/**
 * Copia un árbol del plugin al proyecto. Un destino que sea un enlace se omite y se anota en
 * `bloqueados`; el resto se copia. Los enlaces dentro del ORIGEN (el plugin) se ignoran.
 * @param {string} raiz @param {string} origen @param {string} destino
 * @returns {{ copiados: number, bloqueados: string[] }}
 */
export function copiarArbol(raiz, origen, destino) {
  const r = { copiados: 0, bloqueados: /** @type {string[]} */ ([]) };
  try { crearDirectorio(raiz, destino); } catch (e) {
    if (e instanceof ErrorEnlace) { r.bloqueados.push(e.ruta); return r; }
    throw e;
  }
  for (const entrada of readdirSync(origen, { withFileTypes: true })) {
    const o = join(origen, entrada.name);
    const d = join(destino, entrada.name);
    if (entrada.isSymbolicLink()) continue;
    if (entrada.isDirectory()) {
      const sub = copiarArbol(raiz, o, d);
      r.copiados += sub.copiados;
      r.bloqueados.push(...sub.bloqueados);
    } else if (entrada.isFile()) {
      try { copiarArchivo(raiz, o, d); r.copiados++; } catch (e) {
        if (e instanceof ErrorEnlace) r.bloqueados.push(e.ruta); else throw e;
      }
    }
  }
  return r;
}
