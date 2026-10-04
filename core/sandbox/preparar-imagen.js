/**
 * preparar-imagen.js — Imagen con las dependencias declaradas del proyecto (ADR-03)
 *
 * Dos fases separadas: aquí se instala, con red, solo lo que declaran los
 * manifiestos (el contexto de construcción no contiene código del proyecto);
 * el código generado se ejecuta después sobre esta imagen, sin red.
 *
 * Las dependencias quedan en /deps y la copia de trabajo se monta en /deps/work:
 * la resolución de módulos sube de carpeta y las encuentra sin tocar la copia.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

export const DIR_DEPS    = '/deps';
export const DIR_TRABAJO = '/deps/work';

export const IMAGENES_BASE = {
  javascript: 'node:22-alpine',
  typescript: 'node:22-alpine',
  python:     'python:3.12-slim',
};

const MANIFIESTOS = {
  javascript: ['package.json', 'package-lock.json'],
  typescript: ['package.json', 'package-lock.json'],
  python:     ['requirements.txt'],
};

export class ErrorPreparacion extends Error {
  /** @param {string} mensaje */
  constructor(mensaje) {
    super(mensaje);
    this.name = 'ErrorPreparacion';
  }
}

/**
 * Problemas que se pueden detectar antes de gastar nada: lenguaje sin soporte, o
 * dependencias declaradas donde la imagen preparada no las lee.
 * @param {string} cwd @param {string} lenguaje
 * @returns {string|null} descripción del problema, o null si todo va bien
 */
export function comprobarProyecto(cwd, lenguaje) {
  if (!lenguajeCubierto(lenguaje)) {
    return `El ciclo verificado no cubre todavía proyectos en "${lenguaje}" (solo JavaScript/TypeScript y Python).`;
  }
  if (lenguaje === 'python' && !fs.existsSync(path.join(cwd, 'requirements.txt')) && fs.existsSync(path.join(cwd, 'pyproject.toml'))) {
    return 'El proyecto Python declara sus dependencias solo en pyproject.toml; el ciclo las instala únicamente desde requirements.txt. Añade un requirements.txt.';
  }
  return null;
}

/** @param {string} lenguaje */
export function lenguajeCubierto(lenguaje) {
  return lenguaje in IMAGENES_BASE;
}

/**
 * @param {string} cwd
 * @param {string} lenguaje
 * @returns {string[]} manifiestos presentes en la raíz del proyecto
 */
export function manifiestosPresentes(cwd, lenguaje) {
  return (MANIFIESTOS[lenguaje] ?? []).filter((m) => fs.existsSync(path.join(cwd, m)));
}

/** ¿Declara el proyecto alguna dependencia que haya que instalar? */
function declaraDependencias(cwd, lenguaje, presentes) {
  if (presentes.length === 0) return false;
  if (lenguaje === 'python') return fs.readFileSync(path.join(cwd, 'requirements.txt'), 'utf8').split(/\r?\n/).some((l) => l.trim() && !l.trim().startsWith('#'));
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
    return Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).length > 0;
  } catch {
    return false;
  }
}

/**
 * @param {string} lenguaje
 * @param {string} base
 * @param {string[]} presentes
 */
export function dockerfile(lenguaje, base, presentes) {
  const lineas = [`FROM ${base}`, `WORKDIR ${DIR_DEPS}`, `COPY ${presentes.join(' ')} ./`];
  if (lenguaje === 'python') {
    lineas.push('RUN pip install --no-cache-dir --disable-pip-version-check -r requirements.txt');
  } else {
    // --ignore-scripts: los scripts de instalación de un paquete son código ajeno con red
    const instalar = presentes.includes('package-lock.json') ? 'npm ci' : 'npm install';
    lineas.push(`RUN ${instalar} --ignore-scripts --no-audit --no-fund`);
    lineas.push(`ENV PATH=${DIR_DEPS}/node_modules/.bin:$PATH`);
  }
  return lineas.join('\n') + '\n';
}

/**
 * `dirConstruccion` es una carpeta temporal para el contexto; se elimina al terminar.
 *
 * @param {{
 *   cwd: string,
 *   lenguaje: string,
 *   cli: import('./docker-cli.js').DockerCli,
 *   dirConstruccion: string,
 *   base?: string,
 * }} opciones
 * @returns {Promise<{ imagen: string, construida: boolean, huella: string|null }>}
 */
export async function prepararImagen(opciones) {
  const { cwd, lenguaje, cli, dirConstruccion } = opciones;
  if (!lenguajeCubierto(lenguaje)) {
    throw new ErrorPreparacion(`El ciclo verificado no cubre todavía proyectos en "${lenguaje}" (solo JavaScript/TypeScript y Python).`);
  }
  const base      = opciones.base ?? IMAGENES_BASE[lenguaje];
  const presentes = manifiestosPresentes(cwd, lenguaje);

  // Sin dependencias declaradas no hay nada que instalar: se usa la imagen base
  if (!declaraDependencias(cwd, lenguaje, presentes)) return { imagen: base, construida: false, huella: null };

  const texto  = dockerfile(lenguaje, base, presentes);
  const hash   = createHash('sha256').update(texto);
  for (const m of presentes) hash.update(m).update(fs.readFileSync(path.join(cwd, m)));
  const huella = hash.digest('hex').slice(0, 16);
  const imagen = `forge-sbx:${lenguaje === 'python' ? 'python' : 'node'}-${huella}`;

  if (await cli.existeImagen(imagen)) return { imagen, construida: false, huella };

  fs.rmSync(dirConstruccion, { recursive: true, force: true });
  fs.mkdirSync(dirConstruccion, { recursive: true });
  try {
    for (const m of presentes) fs.copyFileSync(path.join(cwd, m), path.join(dirConstruccion, m));
    fs.writeFileSync(path.join(dirConstruccion, 'Dockerfile'), texto, 'utf8');
    const r = await cli.build(imagen, dirConstruccion);
    if (!r.ok) throw new ErrorPreparacion(`No se pudo preparar la imagen con las dependencias: ${r.error}`);
  } finally {
    fs.rmSync(dirConstruccion, { recursive: true, force: true });
  }
  return { imagen, construida: true, huella };
}
