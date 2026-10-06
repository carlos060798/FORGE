/**
 * indice-vectorial.js — Índice de vectores del repositorio, en un archivo (memoria semántica, S3)
 *
 * Recorre el proyecto, parte cada archivo de texto en trozos de líneas, calcula un vector por
 * trozo con un embedder (embeddings.js) y lo guarda en `.sdd/indice/<embedder>.json`. La
 * búsqueda es por similitud del coseno sobre todos los trozos: sin base de datos ni
 * dependencias. Es suficiente para repositorios pequeños y medianos (hasta unos miles de
 * trozos); para más, el puerto `Recuperador` admite sustituirlo por LanceDB.
 *
 * Es incremental: un archivo solo se vuelve a vectorizar si cambió su tamaño o su fecha.
 * Lo que un modelo no puede leer, tampoco se indexa (mismas reglas de rutas vetadas) y los
 * enlaces simbólicos no se siguen.
 */

import * as fs from 'fs';
import * as path from 'path';
import { SEGMENTOS_VETADOS, canonica, esVetada, validarRuta } from '../ciclo/protocolo-archivos.js';
import { similitud } from './embeddings.js';

const VERSION_INDICE = 1;
const LINEAS_POR_TROZO = 40;
const AVANCE = 30;                 // 10 líneas de solape
const MAX_BYTES_ARCHIVO = 200 * 1024;
const MAX_ARCHIVOS = 3000;
const MAX_TROZOS_TOTALES = 20000;  // acota la memoria y el tamaño del índice, sea cual sea el repositorio
const MAX_CARACTERES_TROZO = 2400;
const LOTE = 64;

const EXTENSIONES = new Set([
  '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.py', '.go', '.java', '.rs', '.rb', '.php', '.cs', '.kt', '.swift', '.c', '.h', '.cpp',
  '.sh', '.sql', '.md', '.txt', '.json', '.yml', '.yaml', '.toml', '.html', '.css', '.scss',
]);
const CARPETAS_IGNORADAS = new Set(['dist', 'build', 'coverage', '.next', '__pycache__', '.venv', 'venv', 'target', 'out', '.cache']);
const ARCHIVOS_IGNORADOS = /(?:^|\/)(?:package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|poetry\.lock|Pipfile\.lock|uv\.lock)$/;

/** @param {string} nombre */
const sanear = (nombre) => nombre.replace(/[^\w.-]+/g, '_');

/**
 * @param {string} cwd
 * @param {string[]} vetadas
 * @returns {{ ruta: string, abs: string, size: number, mtimeMs: number }[]}
 */
export function listarArchivosIndexables(cwd, vetadas = []) {
  const raiz = path.resolve(cwd);
  /** @type {{ ruta: string, abs: string, size: number, mtimeMs: number }[]} */
  const salida = [];
  const pila = [''];
  while (pila.length > 0 && salida.length < MAX_ARCHIVOS) {
    const rel = /** @type {string} */ (pila.pop());
    let entradas;
    try { entradas = fs.readdirSync(path.join(raiz, rel), { withFileTypes: true }); } catch { continue; }
    entradas.sort((a, b) => (a.name < b.name ? -1 : 1));
    for (const e of entradas) {
      if (e.isSymbolicLink()) continue;                       // un enlace puede llevar fuera del proyecto
      const hijo = rel === '' ? e.name : rel + '/' + e.name;
      if (e.isDirectory()) {
        const n = e.name.toLowerCase();
        if (SEGMENTOS_VETADOS.includes(n) || CARPETAS_IGNORADAS.has(n)) continue;
        if (esVetada(hijo + '/x', vetadas)) continue;
        pila.push(hijo);
      } else if (e.isFile()) {
        if (!EXTENSIONES.has(path.extname(e.name).toLowerCase())) continue;
        if (ARCHIVOS_IGNORADOS.test(hijo) || esVetada(hijo, vetadas)) continue;
        let st;
        try { st = fs.statSync(path.join(raiz, hijo)); } catch { continue; }
        if (st.size === 0 || st.size > MAX_BYTES_ARCHIVO) continue;
        salida.push({ ruta: hijo, abs: path.join(raiz, hijo), size: st.size, mtimeMs: st.mtimeMs });
        if (salida.length >= MAX_ARCHIVOS) break;
      }
    }
  }
  return salida;
}

/** @param {string} texto  @returns {{ ini: number, fin: number, texto: string }[]} (líneas base 1, ambas incluidas) */
export function partirEnTrozos(texto) {
  const lineas = texto.split(/\r?\n/);
  const trozos = [];
  for (let i = 0; i < lineas.length; i += AVANCE) {
    const parte = lineas.slice(i, i + LINEAS_POR_TROZO);
    const contenido = parte.join('\n').slice(0, MAX_CARACTERES_TROZO);
    if (contenido.trim() !== '') trozos.push({ ini: i + 1, fin: i + parte.length, texto: contenido });
    if (i + LINEAS_POR_TROZO >= lineas.length) break;
  }
  return trozos;
}

export class IndiceVectorial {
  /**
   * @param {{ cwd: string, embedder: { nombre: string, embed: (t: string[]) => Promise<number[][]> }, vetadas?: string[] }} o
   */
  constructor(o) {
    this.cwd = path.resolve(o.cwd);
    this.embedder = o.embedder;
    this.vetadas = o.vetadas ?? [];
    this.archivo = path.join(this.cwd, '.sdd', 'indice', sanear(o.embedder.nombre) + '.json');
    /** @type {{ version: number, embedder: string, archivos: Record<string, { size: number, mtimeMs: number, trozos: { ini: number, fin: number, vec: number[] }[] }> }} */
    this.datos = this._leer();
  }

  _leer() {
    try {
      const d = JSON.parse(fs.readFileSync(this.archivo, 'utf8'));
      if (d?.version === VERSION_INDICE && d.embedder === this.embedder.nombre && d.archivos && typeof d.archivos === 'object') {
        // El índice vive dentro del proyecto: lo podria haber escrito otro. Solo se aceptan entradas bien formadas
        for (const [ruta, f] of Object.entries(d.archivos)) {
          const bien = f && Array.isArray(f.trozos) && f.trozos.every((t) => Number.isInteger(t?.ini) && Number.isInteger(t?.fin) && Array.isArray(t?.vec) && t.vec.every((x) => typeof x === 'number'));
          if (!bien) delete d.archivos[ruta];
        }
        return d;
      }
    } catch { /* sin índice o dañado: se reconstruye */ }
    return { version: VERSION_INDICE, embedder: this.embedder.nombre, archivos: {} };
  }

  _guardar() {
    fs.mkdirSync(path.dirname(this.archivo), { recursive: true });
    const tmp = this.archivo + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.datos), 'utf8');
    fs.renameSync(tmp, this.archivo);
  }

  /** Pone el índice al día. @returns {Promise<{ archivos: number, trozos: number, reindexados: number }>} */
  async actualizar() {
    const actuales = listarArchivosIndexables(this.cwd, this.vetadas);
    const vigentes = new Set(actuales.map((a) => a.ruta));
    let cambios = false;
    for (const ruta of Object.keys(this.datos.archivos)) {
      if (!vigentes.has(ruta)) { delete this.datos.archivos[ruta]; cambios = true; }
    }

    const pendientes = [];
    let acumulados = 0;
    for (const a of actuales) {
      const previo = this.datos.archivos[a.ruta];
      if (previo && previo.size === a.size && previo.mtimeMs === a.mtimeMs) { acumulados += previo.trozos.length; continue; }
      let texto;
      try { texto = fs.readFileSync(a.abs, 'utf8'); } catch { continue; }
      if (texto.includes('\0')) continue;                          // binario
      const trozos = partirEnTrozos(texto);
      // Tope global: lo que no cabe no se indexa (y si ya lo estaba, se quita para no dejar vectores viejos)
      if (acumulados + trozos.length > MAX_TROZOS_TOTALES) { if (previo) { delete this.datos.archivos[a.ruta]; cambios = true; } continue; }
      acumulados += trozos.length;
      pendientes.push({ a, trozos });
    }

    // Se vectoriza por lotes: un proveedor remoto o local no recibe todo de golpe
    const todos = pendientes.flatMap((p) => p.trozos.map((t) => ({ p, t })));
    for (let i = 0; i < todos.length; i += LOTE) {
      const lote = todos.slice(i, i + LOTE);
      const vectores = await this.embedder.embed(lote.map((x) => x.t.texto));
      lote.forEach((x, j) => { /** @type {any} */ (x.t).vec = vectores[j].map((n) => Math.round(n * 1e5) / 1e5); });
    }
    for (const { a, trozos } of pendientes) {
      this.datos.archivos[a.ruta] = { size: a.size, mtimeMs: a.mtimeMs, trozos: /** @type {any} */ (trozos).map(({ ini, fin, vec }) => ({ ini, fin, vec })) };
      cambios = true;
    }
    if (cambios) this._guardar();

    const total = Object.values(this.datos.archivos).reduce((s, f) => s + f.trozos.length, 0);
    return { archivos: Object.keys(this.datos.archivos).length, trozos: total, reindexados: pendientes.length };
  }

  /**
   * @param {string} consulta
   * @param {{ k?: number, excluir?: Set<string>, minimo?: number }} [opciones]
   * @returns {Promise<{ ruta: string, ini: number, fin: number, texto: string, puntuacion: number }[]>}
   */
  async buscar(consulta, opciones = {}) {
    const k = opciones.k ?? 8;
    const minimo = opciones.minimo ?? 0.05;
    const [vq] = await this.embedder.embed([consulta]);
    const candidatos = [];
    for (const [ruta, f] of Object.entries(this.datos.archivos)) {
      if (opciones.excluir?.has(canonica(ruta))) continue;
      for (const t of f.trozos) {
        const puntuacion = similitud(vq, t.vec);
        if (puntuacion >= minimo) candidatos.push({ ruta, ini: t.ini, fin: t.fin, puntuacion });
      }
    }
    candidatos.sort((a, b) => b.puntuacion - a.puntuacion || (a.ruta < b.ruta ? -1 : 1) || a.ini - b.ini);

    const resultado = [];
    for (const c of candidatos) {
      if (resultado.length >= k) break;
      // Dos trozos del mismo archivo que se solapan repetirían líneas: se queda el de mejor puntuación
      if (resultado.some((r) => r.ruta === c.ruta && c.ini <= r.fin && r.ini <= c.fin)) continue;
      // El texto se lee del archivo en este momento: el índice solo guarda vectores. La ruta se vuelve a
      // validar con las reglas de lectura: un índice manipulado no puede apuntar a lo vetado ni fuera del proyecto
      const v = validarRuta(this.cwd, c.ruta, { vetadas: this.vetadas });
      if (v.ok === false && v.motivo !== 'dependencias' && v.motivo !== 'configuracion') continue;
      let lineas;
      try {
        const abs = path.join(this.cwd, c.ruta);
        // Un archivo que creció desde que se indexó no se lee entero
        if (fs.statSync(abs).size > MAX_BYTES_ARCHIVO) continue;
        lineas = fs.readFileSync(abs, 'utf8').split(/\r?\n/);
      } catch { continue; }
      const texto = lineas.slice(c.ini - 1, c.fin).join('\n').slice(0, MAX_CARACTERES_TROZO);
      if (texto.trim() !== '') resultado.push({ ...c, texto });
    }
    return resultado;
  }
}
