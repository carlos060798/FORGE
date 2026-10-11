/**
 * restos.js — Lo que deja en el equipo un ciclo cortado de golpe, y su barrido
 *
 * Un proceso al que matan (SIGKILL, corte de luz, cierre de la terminal) no ejecuta ningún `finally`.
 * Deja copias enteras del proyecto: la copia de trabajo de la ejecución en curso
 * (`.sdd/motor/<sesión>/staging/`) y la copia privada de la medición por mutación
 * (`<carpeta temporal>/forge-mutacion-XXXXXX`). Los contenedores los barre SandboxRunner.
 *
 * Quien llama tiene el candado del proyecto: ningún otro ciclo ni el servidor MCP están usando
 * las copias de trabajo de este proyecto. Las de mutación son de todo el equipo (cualquier proyecto):
 * por eso solo se borran las de procesos que ya no existen.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { procesoVivo } from './candado.js';
import { eliminarCopia } from '../sandbox/staging.js';

const SESION_VALIDA = /^\w[\w.-]*$/;

/** Los mismos que usa core/ciclo/mutacion.js al crear su carpeta (nombre de `mkdtemp` y archivo de marca con el pid). */
const PATRON_MUTACION = /^forge-mutacion-[A-Za-z0-9]{6}$/;
const MARCA_MUTACION = '.forge-mutacion';

/** ¿Es un enlace (simbólico o unión de directorio)? Lo que no se puede mirar se trata como enlace: no se toca. */
function esEnlace(ruta) {
  try { return fs.lstatSync(ruta).isSymbolicLink(); } catch { return true; }
}

/**
 * Borra las copias de trabajo de todas las sesiones del proyecto. `SandboxRunner.barrerCopias` solo
 * mira la sesión en curso: tras un corte, un `forge run` nuevo (otra sesión) dejaba para siempre la
 * copia del proyecto de la sesión cortada.
 * Una sesión o una carpeta `staging` que sea un enlace no se recorre (vaciaría su destino): se devuelve.
 * @param {string} cwd  proyecto
 * @returns {string[]} rutas que no se borraron (enlaces, o copias que el sistema no dejó borrar)
 */
export function barrerCopiasDeSesiones(cwd) {
  const base = path.join(path.resolve(cwd), '.sdd', 'motor');
  /** @type {string[]} */
  const restantes = [];
  let sesiones;
  try { sesiones = fs.readdirSync(base, { withFileTypes: true }); } catch { return restantes; }
  for (const s of sesiones) {
    if (!SESION_VALIDA.test(s.name) || s.isFile()) continue;
    const sesion = path.join(base, s.name);
    if (esEnlace(sesion)) { restantes.push(sesion); continue; }
    const staging = path.join(sesion, 'staging');
    if (!fs.existsSync(staging)) continue;
    if (esEnlace(staging)) { restantes.push(staging); continue; }
    let copias = [];
    try { copias = fs.readdirSync(staging); } catch { continue; }
    for (const n of copias) {
      const copia = path.join(staging, n);
      if (!eliminarCopia(copia)) restantes.push(copia);
    }
  }
  return restantes;
}

/**
 * Borra las carpetas `forge-mutacion-*` cuyo proceso ya no existe. La medición por mutación barre las
 * suyas solo al empezar otra medición y solo si llevan seis horas sin tocarse (no sabe si su dueño
 * vive); aquí se lee el pid de la marca: si ese proceso murió, la copia es basura y se borra ya.
 * No se toca nada sin el nombre exacto, sin marca, con una marca ilegible, que sea un enlace, o cuyo
 * proceso siga vivo (otra medición en marcha, quizá de otro proyecto). Un pid reutilizado por otro
 * programa parece vivo: esa copia espera al barrido de las seis horas.
 * @param {string} [dir]  carpeta temporal (por defecto la del sistema)
 * @returns {number} carpetas borradas
 */
export function barrerMutacionesDeProcesosMuertos(dir = os.tmpdir()) {
  let nombres;
  try { nombres = fs.readdirSync(dir); } catch { return 0; }
  let borradas = 0;
  for (const nombre of nombres) {
    if (!PATRON_MUTACION.test(nombre)) continue;
    const abs = path.join(dir, nombre);
    try {
      const st = fs.lstatSync(abs);
      if (!st.isDirectory() || st.isSymbolicLink()) continue;
      const marca = fs.readFileSync(path.join(abs, MARCA_MUTACION), 'utf8').trim();
      if (!/^[1-9]\d{0,9}$/.test(marca) || procesoVivo(Number(marca))) continue;
      if (eliminarCopia(abs)) borradas++;
    } catch { /* sin marca, o alguien la tocó a la vez: se deja */ }
  }
  return borradas;
}
