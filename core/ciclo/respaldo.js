/**
 * respaldo.js — Respaldo de los archivos que toca una tarea y restauración al abortar
 *
 * Antes de la primera escritura sobre una ruta se guarda su contenido previo
 * (o se anota que no existía). `restaurar()` deja el proyecto como estaba.
 */

import * as fs from 'fs';
import * as path from 'path';
import { canonica, validarRuta } from './protocolo-archivos.js';

export class Respaldo {
  /**
   * @param {string} cwd
   * @param {string} dirRespaldo  normalmente <cwd>/.sdd/motor/<runId>/respaldo/<taskId>
   */
  constructor(cwd, dirRespaldo) {
    this.cwd        = path.resolve(cwd);
    this.dir        = dirRespaldo;
    this.manifiesto = path.join(dirRespaldo, 'manifiesto.json');
    /** @type {{ ruta: string, existia: boolean }[]} */
    this.entradas   = fs.existsSync(this.manifiesto)
      ? this._leerManifiesto()
      : [];
  }

  /**
   * El manifiesto vive en disco, dentro del proyecto: lo podria haber escrito otro. Cada entrada
   * se comprueba antes de usarla, para que restaurar nunca toque nada fuera del proyecto.
   */
  _leerManifiesto() {
    const entradas = JSON.parse(fs.readFileSync(this.manifiesto, 'utf8')).entradas;
    if (!Array.isArray(entradas)) throw new Error('Manifiesto de respaldo invalido: entradas no es una lista');
    for (const e of entradas) {
      const ruta = typeof e?.ruta === 'string' ? e.ruta : '';
      const destino = path.resolve(this.cwd, ruta);
      const rel = path.relative(this.cwd, destino);
      if (!ruta || typeof e.existia !== 'boolean' || path.isAbsolute(ruta) || rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
        throw new Error('Manifiesto de respaldo invalido: ruta fuera del proyecto o entrada mal formada');
      }
      // Las mismas reglas que al escribir: nada vetado, ni a traves de enlaces. Las de dependencias y
      // configuracion si pueden figurar (se respaldan antes de que se pida revision)
      const v = validarRuta(this.cwd, ruta);
      if (v.ok === false && v.motivo !== 'dependencias' && v.motivo !== 'configuracion') {
        throw new Error(`Manifiesto de respaldo invalido: ${ruta} (${v.motivo})`);
      }
    }
    return entradas;
  }

  _guardarManifiesto() {
    fs.mkdirSync(this.dir, { recursive: true });
    const tmp = this.manifiesto + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({ entradas: this.entradas }, null, 2), 'utf8');
    fs.renameSync(tmp, this.manifiesto);
  }

  /**
   * Debe llamarse antes de escribir en `rutaPosix`. Solo la primera llamada por
   * ruta tiene efecto: el respaldo conserva el estado previo a la tarea.
   * "src/a.js" y "SRC/A.JS" son el mismo archivo en Windows y macOS: cuentan como una.
   * @param {string} rutaPosix  ruta relativa al proyecto, con "/"
   */
  registrar(rutaPosix) {
    const clave = canonica(rutaPosix);
    if (this.entradas.some((e) => canonica(e.ruta) === clave)) return;

    const origen  = path.join(this.cwd, rutaPosix);
    const existia = fs.existsSync(origen);
    if (existia) {
      const copia = path.join(this.dir, 'archivos', rutaPosix);
      fs.mkdirSync(path.dirname(copia), { recursive: true });
      fs.copyFileSync(origen, copia);
    }
    this.entradas.push({ ruta: rutaPosix, existia });
    this._guardarManifiesto();
  }

  /** @returns {{ restaurados: string[], borrados: string[] }} */
  restaurar() {
    const restaurados = [];
    const borrados    = [];
    for (const { ruta, existia } of this.entradas) {
      const destino = path.join(this.cwd, ruta);
      if (existia) {
        fs.mkdirSync(path.dirname(destino), { recursive: true });
        fs.copyFileSync(path.join(this.dir, 'archivos', ruta), destino);
        restaurados.push(ruta);
      } else if (fs.existsSync(destino)) {
        fs.unlinkSync(destino);
        borrados.push(ruta);
        this._quitarCarpetasVacias(path.dirname(destino));
      }
    }
    return { restaurados, borrados };
  }

  /** Sube desde `dir` borrando las carpetas que el ciclo creó y han quedado vacías. */
  _quitarCarpetasVacias(dir) {
    let actual = dir;
    while (actual !== this.cwd && actual.startsWith(this.cwd + path.sep)) {
      try {
        if (fs.readdirSync(actual).length > 0) return;
        fs.rmdirSync(actual);
      } catch { return; }
      actual = path.dirname(actual);
    }
  }
}
