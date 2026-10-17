/**
 * candado-proyecto.js — El candado `.sdd/motor/proyecto.lock` frente a un candado plantado por el repo
 * (revisión independiente nº 1, H-7)
 *
 * `proyecto.lock` vive en el árbol del proyecto, así que un repositorio hostil puede traerlo ya hecho,
 * con un pid vivo (el de cualquier proceso del sistema) y la marca de tiempo «de ahora», y dejar al
 * servidor en «ocupado» hasta que caduque. Un candado que crea `adquirir` se escribe y se enlaza de
 * inmediato: la fecha del archivo y su marca de tiempo coinciden. Uno que salió de un clon tiene la
 * fecha del clon. Si difieren en más de unos minutos, o la marca es del futuro, no lo creó un proceso
 * de Fragua: se retira antes de intentar tomarlo. Un candado real (ciclo, otro servidor) no se toca.
 */

import * as fs from 'node:fs';
import { adquirir } from '../ciclo/candado.js';

/** Un candado real tiene la fecha del archivo pegada a su marca de tiempo; esto da margen a relojes y sistemas de archivos lentos. */
const TOLERANCIA_MS = 5 * 60 * 1000;

/**
 * ¿Lo escribió alguien que no es un proceso de Fragua? (ilegible no cuenta: `adquirir` ya sabe qué hacer)
 * @param {string} archivo
 */
export function candadoPlantado(archivo) {
  try {
    const { pid, ts } = JSON.parse(fs.readFileSync(archivo, 'utf8'));
    if (!Number.isInteger(pid) || typeof ts !== 'number') return false;
    const fecha = fs.statSync(archivo).mtimeMs;
    return ts > Date.now() + 60_000 || Math.abs(fecha - ts) > TOLERANCIA_MS;
  } catch {
    return false;
  }
}

/**
 * @param {string} archivo  ruta del candado del proyecto
 * @param {string} que
 * @returns {() => void}  función que lo libera
 */
export function adquirirProyecto(archivo, que) {
  if (candadoPlantado(archivo)) {
    try { fs.unlinkSync(archivo); } catch { /* ya no está */ }
  }
  return adquirir(archivo, que);
}
