// Ayudante compartido de pruebas para crear enlaces cuando el sistema no deja crear todos los tipos.
//
// Windows sin modo desarrollador ni administrador devuelve EPERM al crear enlaces simbólicos de archivo y de
// directorio, pero SÍ deja crear uniones (`junction`, solo directorios) y enlaces duros. Una prueba de seguridad
// que se salta en silencio por eso deja de defender nada en ese equipo; este ayudante intenta la alternativa
// equivalente y, si no la hay, la prueba se salta con `noVerificado()` y queda contada.
import { linkSync, symlinkSync } from "node:fs";

/** Errores que significan «este sistema no deja crear este tipo de enlace» (no un fallo de la prueba). */
const SIN_PERMISO = new Set(["EPERM", "EACCES", "ENOSYS", "UNKNOWN"]);

/** @param {unknown} e */
const sinPermiso = (e) => SIN_PERMISO.has(/** @type {any} */ (e)?.code);

/**
 * Crea un enlace en `ruta` que apunta a `destino`. Orden: simbólico; si el sistema lo niega, unión (solo si `tipo`
 * es `"dir"`); si el sistema lo niega y `tipo` es `"archivo-o-duro"`, enlace duro.
 *
 * - `"dir"`: el destino es un directorio. Cae a unión de Windows, que `realpath` resuelve igual que un simbólico.
 * - `"archivo"`: el destino es un archivo y la prueba defiende algo propio del enlace SIMBÓLICO (que se detecte
 *   con `lstat`, que pueda quedar colgante, que `realpath` salga del proyecto). Un enlace duro no lo demuestra:
 *   no hay alternativa, así que devuelve `{ creado: false }` y la prueba debe llamar a `noVerificado()`.
 * - `"archivo-o-duro"`: el destino es un archivo y a la prueba le basta con que la ruta y el destino sean el mismo
 *   archivo (el contenido o la escritura llegan al otro lado). Solo para eso: se decide prueba a prueba.
 *
 * Un error distinto de falta de permiso (p. ej. `EEXIST`, `ENOENT`) se propaga: es un fallo de la prueba.
 *
 * @param {string} destino
 * @param {string} ruta
 * @param {"dir" | "archivo" | "archivo-o-duro"} tipo
 * @returns {{ creado: boolean, tipo: "symlink" | "junction" | "duro" | null }}
 */
export function crearEnlace(destino, ruta, tipo) {
  try {
    symlinkSync(destino, ruta, tipo === "dir" ? "dir" : "file");
    return { creado: true, tipo: "symlink" };
  } catch (e) {
    if (!sinPermiso(e)) throw e;
  }
  if (tipo === "dir") {
    try {
      symlinkSync(destino, ruta, "junction");
      return { creado: true, tipo: "junction" };
    } catch (e) {
      if (!sinPermiso(e)) throw e;
    }
  } else if (tipo === "archivo-o-duro") {
    try {
      linkSync(destino, ruta);
      return { creado: true, tipo: "duro" };
    } catch (e) {
      if (!sinPermiso(e)) throw e;
    }
  }
  return { creado: false, tipo: null };
}

/**
 * Salta la prueba con el texto «NO VERIFICADO en esta plataforma: <motivo>». El recuento lo hace
 * `tests/enlaces-no-verificados.test.js`, que busca estas llamadas en el código (cada archivo de prueba corre en
 * su propio proceso, así que no hay estado compartido). Escribe el motivo como literal en la llamada.
 *
 * @param {import("node:test").TestContext} t
 * @param {string} motivo
 */
export function noVerificado(t, motivo) {
  t.skip(`NO VERIFICADO en esta plataforma: ${motivo}`);
}
