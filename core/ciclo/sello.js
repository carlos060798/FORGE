// @ts-check
/**
 * sello.js — Sello de autenticidad del estado del ciclo (puntos de guardado y sesión)
 *
 * El estado del ciclo vive en `<proyecto>/.sdd/motor/**`, dentro del árbol del proyecto, y el proyecto
 * puede ser de un repositorio ajeno. Una huella `sha256` solo detecta daños: quien fabrica un archivo
 * calcula también su huella. Sin un sello con un secreto que el repositorio no tiene, un repositorio hostil
 * podría traer un punto de guardado fabricado y, al reanudar, presentar una tarea como verificada sin que
 * se haya ejecutado nada, subir el tope de gasto o apuntar a rutas ajenas.
 *
 * El sello es un HMAC-SHA256 con una clave del USUARIO (`<estado del usuario>/motor/clave`, modo 0600,
 * fuera del proyecto, creada una sola vez). Es una clave por usuario y no por proyecto: así no se crea una
 * carpeta de estado por cada proyecto en el que se reanuda algo. Sin sello válido, el estado se IGNORA
 * (falla cerrado: la tarea empieza de cero), nunca se acepta «por si acaso».
 *
 * Límite conocido: el estado sellado en otro equipo, o tras perder la clave, no se puede reanudar aquí.
 */

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { claveLocal, firmaValida, firmar, raizDeEstado } from '../estado-usuario.js';

/** @returns {Buffer} */
function claveDelMotor() {
  const dir = join(raizDeEstado(), 'motor');
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  return claveLocal(dir);
}

/**
 * @param {unknown} valor  datos a sellar (se serializan de forma canónica)
 * @returns {string} sello (HMAC-SHA256 en hex)
 */
export function sellar(valor) {
  return firmar(claveDelMotor(), valor);
}

/**
 * ¿Es válido este sello para estos datos? Cualquier fallo (sin clave, clave dañada, sello mal formado)
 * es «no válido».
 * @param {unknown} valor
 * @param {unknown} sello
 */
export function selloValido(valor, sello) {
  try {
    return firmaValida(claveDelMotor(), valor, sello);
  } catch {
    return false;
  }
}

/**
 * La sesión del ciclo con su sello, lista para escribirla en `.sdd/motor/sesion.json`.
 * Es el único camino para crear un `sesion.json` válido (`nuevaSesion` y las pruebas lo usan).
 * @param {{ runId: string, modo: string, creada: string }} sesion
 */
export function sesionSellada(sesion) {
  return { ...sesion, sello: sellar({ sesion }) };
}
