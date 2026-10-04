/**
 * staging.js — Copia desechable del proyecto para el entorno aislado (ADR-02)
 *
 * El contenedor monta esta copia, nunca el proyecto real. La copia no lleva
 * secretos, ni el historial de git, ni el estado de FORGE, ni dependencias
 * instaladas (esas vienen de la imagen preparada).
 *
 * Comparte con el protocolo de escritura y el recuperador la misma lista de
 * rutas vetadas (`esVetada`): lo que un modelo no puede leer, tampoco se copia.
 */

import * as fs from 'fs';
import * as path from 'path';
import { coincide } from '../glob.js';
import { esVetada } from '../ciclo/protocolo-archivos.js';

/** Además de lo vetado: carpetas que no aportan nada a las pruebas. */
export const EXCLUIDOS_BASE = ['__pycache__', '.venv', 'venv', '.vscode', '.idea', 'dump.sql', 'config/database.yml', 'token.json'];

/**
 * El contenedor corre con un usuario sin privilegios que no es el dueño de la
 * copia. En Linux necesita permiso de escritura sobre ella; en Windows no aplica.
 * @param {string} ruta
 * @param {boolean} esDirectorio
 */
function abrirPermisos(ruta, esDirectorio) {
  if (process.platform === 'win32') return;
  try {
    fs.chmodSync(ruta, esDirectorio ? 0o777 : (fs.statSync(ruta).mode & 0o111) | 0o666);
  } catch { /* sistema de archivos sin permisos POSIX */ }
}

/**
 * @param {string} cwd       proyecto real
 * @param {string} destino   carpeta de la copia; se vacía si ya existe
 * @param {{ excluir?: string[] }} [opciones]
 * @returns {{ copiados: number, excluidos: string[] }}
 */
export function crearCopia(cwd, destino, opciones = {}) {
  const raiz     = path.resolve(cwd);
  const patrones = [...EXCLUIDOS_BASE, ...(opciones.excluir ?? [])];
  const destinoAbs = path.resolve(destino);

  fs.rmSync(destinoAbs, { recursive: true, force: true });
  fs.mkdirSync(destinoAbs, { recursive: true });
  abrirPermisos(destinoAbs, true);

  let copiados = 0;
  /** @type {string[]} */
  const excluidos = [];

  /** @param {string} rel  ruta relativa con "/" ('' para la raíz) */
  const recorrer = (rel) => {
    for (const entrada of fs.readdirSync(path.join(raiz, rel), { withFileTypes: true })) {
      const hijo = rel ? `${rel}/${entrada.name}` : entrada.name;
      const abs  = path.join(raiz, hijo);

      // La copia puede vivir dentro del proyecto (.sdd/motor/...): nunca copiarse a sí misma
      if (abs === destinoAbs) continue;
      if (esVetada(hijo) || patrones.some((p) => coincide(hijo, p))) { excluidos.push(hijo); continue; }
      // Un enlace simbólico podría apuntar fuera del proyecto
      if (entrada.isSymbolicLink()) { excluidos.push(hijo); continue; }

      if (entrada.isDirectory()) {
        fs.mkdirSync(path.join(destinoAbs, hijo), { recursive: true });
        abrirPermisos(path.join(destinoAbs, hijo), true);
        recorrer(hijo);
      } else if (entrada.isFile()) {
        fs.copyFileSync(abs, path.join(destinoAbs, hijo));
        abrirPermisos(path.join(destinoAbs, hijo), false);
        copiados++;
      }
    }
  };
  recorrer('');

  return { copiados, excluidos };
}

/**
 * Elimina la copia. El código de pruebas pudo crear dentro de ella enlaces o
 * nombres que el anfitrión no consigue borrar: no debe romper la sesión.
 * @param {string} destino
 * @returns {boolean} false si no se pudo borrar del todo
 */
export function eliminarCopia(destino) {
  try {
    fs.rmSync(destino, { recursive: true, force: true, maxRetries: 2 });
    return !fs.existsSync(destino);
  } catch {
    return false;
  }
}
