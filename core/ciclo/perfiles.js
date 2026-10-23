// @ts-check
/**
 * perfiles.js — Perfil de capacidades de cada ROL del ciclo (spec 2026-10-14-perfiles-de-agente, primera entrega)
 *
 * El perfil es del ROL DEL NODO, no del agente (spikes/roles-del-ciclo.md): `planner` (agente `arquitecto`),
 * `qa` (agente `tester`, también en el nodo `refuerzo`) y `coder` (el implementador; su agente lo elige el
 * repositorio con `tarea.agente`, por eso el perfil no depende de él: cierra el hallazgo H-10).
 *
 * Capas, de más a menos fuerte:
 *   1. Código (este archivo). `TECHO` es lo máximo que un rol puede tener; `DEFECTO` es lo que tiene si nadie
 *      dice nada. Hoy `DEFECTO` == `TECHO`: es exactamente lo que el ciclo ya hacía.
 *   2. Usuario (variables de entorno FRAGUA_PERFIL_<ROL>_<CAMPO>, fuera del árbol del proyecto). Puede subir
 *      o bajar dentro del `TECHO`.
 *   3. Proyecto (sección `perfiles:` de `.sdd/sdd.config.yaml`, que está en el árbol y puede ser de un tercero).
 *      SOLO puede APRETAR lo que dejen las capas 1 y 2: lo que intente ampliar se ignora y se avisa.
 *
 * Al reanudar, el perfil efectivo es la INTERSECCIÓN del guardado en el estado y el que se resuelve ahora:
 * nunca se afloja a mitad de una tarea. Un perfil irresoluble falla cerrado (`ErrorPerfil`).
 *
 * Qué NO es: la cabecera `tools:` de `agents/*.md` sigue sin imponerse al ciclo (es una solicitud).
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { leerVariable } from '../entorno.js';
import { leerSeccion } from './config.js';

/** Herramientas que ofrece el implementador por turnos (herramientas-coder.js). */
export const HERRAMIENTAS_CODER = Object.freeze(['leer_archivo', 'listar', 'buscar', 'editar', 'ejecutar_pruebas']);
export const ROLES_DE_PERFIL = Object.freeze(['planner', 'qa', 'coder']);
const CAMPOS = ['herramientas', 'rutas_escribir', 'pasos_max', 'pruebas_max', 'contexto_max_bytes'];

/**
 * @typedef {{ clase: 'ninguna'|'pruebas'|'no_pruebas', prefijos: string[]|null }} RutasEscribir
 *   `clase`: qué rutas puede tocar el rol según la regla de siempre (protocolo-archivos.js); `prefijos`: si no es
 *   null, además la ruta debe estar bajo alguno de ellos (carpeta con «/» final, o archivo exacto).
 * @typedef {{ rol: 'planner'|'qa'|'coder', herramientas: string[], rutasEscribir: RutasEscribir, pasosMax: number, pruebasMax: number, contextoMaxBytes: number }} Perfil
 * @typedef {{ capa: string, rol: string, campo: string, pedido: string, motivo: string }} AvisoPerfil
 */

const MAX_TURNOS = 200;
const MAX_CONTEXTO = 4 * 1024 * 1024;

/** @type {Record<string, Perfil>} */
const TECHO = {
  planner: { rol: 'planner', herramientas: [], rutasEscribir: { clase: 'ninguna', prefijos: [] }, pasosMax: 1, pruebasMax: 0, contextoMaxBytes: MAX_CONTEXTO },
  qa:      { rol: 'qa',      herramientas: [], rutasEscribir: { clase: 'pruebas', prefijos: null }, pasosMax: 1, pruebasMax: 0, contextoMaxBytes: MAX_CONTEXTO },
  coder:   { rol: 'coder',   herramientas: [...HERRAMIENTAS_CODER], rutasEscribir: { clase: 'no_pruebas', prefijos: null }, pasosMax: MAX_TURNOS, pruebasMax: MAX_TURNOS, contextoMaxBytes: MAX_CONTEXTO },
};
/** Lo que tiene cada rol si ninguna capa dice nada: igual que el techo (el comportamiento de siempre). Los topes reales siguen siendo los de `motor.*`. */
const DEFECTO = TECHO;

export class ErrorPerfil extends Error {
  /** @param {string} mensaje */
  constructor(mensaje) { super(mensaje); this.name = 'ErrorPerfil'; }
}

/** @param {Perfil} p @returns {Perfil} */
const copiar = (p) => ({ ...p, herramientas: [...p.herramientas], rutasEscribir: { clase: p.rutasEscribir.clase, prefijos: p.rutasEscribir.prefijos === null ? null : [...p.rutasEscribir.prefijos] } });

/** El perfil de un rol sin ninguna capa encima. @param {string} rol */
export function perfilPorDefecto(rol) {
  if (!(rol in DEFECTO)) throw new ErrorPerfil(`rol de perfil desconocido: "${rol}"`);
  return copiar(DEFECTO[rol]);
}

/** @param {string} p carpeta con «/» final o archivo */
const normalizarPrefijo = (p) => p.trim().replace(/\\/g, '/').replace(/^\.\//, '');

/** ¿El prefijo `ancho` cubre al prefijo `estrecho`? */
const cubre = (ancho, estrecho) => estrecho === ancho || (ancho.endsWith('/') && estrecho.startsWith(ancho));

/**
 * Intersección de dos listas de prefijos (null = sin restricción).
 * @param {string[]|null} a @param {string[]|null} b @returns {string[]|null}
 */
function cruzarPrefijos(a, b) {
  if (a === null) return b === null ? null : [...b];
  if (b === null) return [...a];
  const fuera = new Set();
  for (const x of a) if (b.some((y) => cubre(y, x))) fuera.add(x);
  for (const y of b) if (a.some((x) => cubre(x, y))) fuera.add(y);
  return [...fuera].sort();
}

/**
 * Intersección campo a campo: lo que ninguno de los dos prohíbe. Nunca afloja.
 * @param {Perfil} a @param {Perfil} b @returns {Perfil}
 */
export function intersectar(a, b) {
  return {
    rol: a.rol,
    herramientas: a.herramientas.filter((h) => b.herramientas.includes(h)),
    rutasEscribir: { clase: a.rutasEscribir.clase, prefijos: cruzarPrefijos(a.rutasEscribir.prefijos, b.rutasEscribir.prefijos) },
    pasosMax: Math.min(a.pasosMax, b.pasosMax),
    pruebasMax: Math.min(a.pruebasMax, b.pruebasMax),
    contextoMaxBytes: Math.min(a.contextoMaxBytes, b.contextoMaxBytes),
  };
}

/** Forma estable para comparar. @param {Perfil} p */
function canonico(p) {
  return JSON.stringify({ ...p, herramientas: [...p.herramientas].sort(), rutasEscribir: { clase: p.rutasEscribir.clase, prefijos: p.rutasEscribir.prefijos === null ? null : [...p.rutasEscribir.prefijos].sort() } });
}
/** @param {Perfil} a @param {Perfil} b */
export const mismoPerfil = (a, b) => canonico(a) === canonico(b);

/**
 * Qué campos tiene `despues` más estrechos que `antes`.
 * @param {Perfil} antes @param {Perfil} despues @returns {string[]}
 */
export function camposEstrechados(antes, despues) {
  const campos = [];
  const quitadas = antes.herramientas.filter((h) => !despues.herramientas.includes(h));
  if (quitadas.length) campos.push(`herramientas (sin ${quitadas.join(', ')})`);
  if (canonico({ ...antes, herramientas: [], pasosMax: 0, pruebasMax: 0, contextoMaxBytes: 0 }) !== canonico({ ...despues, herramientas: [], pasosMax: 0, pruebasMax: 0, contextoMaxBytes: 0 })) campos.push('rutas escribibles');
  if (despues.pasosMax < antes.pasosMax) campos.push(`pasos_max (${antes.pasosMax} -> ${despues.pasosMax})`);
  if (despues.pruebasMax < antes.pruebasMax) campos.push(`pruebas_max (${antes.pruebasMax} -> ${despues.pruebasMax})`);
  if (despues.contextoMaxBytes < antes.contextoMaxBytes) campos.push(`contexto_max_bytes (${antes.contextoMaxBytes} -> ${despues.contextoMaxBytes})`);
  return campos;
}

/**
 * Aplica una capa que pide valores (texto) sobre `base`. `estricta`: la capa solo puede apretar (proyecto);
 * si no, puede mover dentro del techo (usuario). Lo que sobrepasa el límite se ignora y queda como aviso.
 * @param {Perfil} base @param {Record<string, string>} pedido @param {string} capa @param {boolean} estricta @param {AvisoPerfil[]} avisos
 * @returns {Perfil}
 */
function aplicarCapa(base, pedido, capa, estricta, avisos) {
  const rol = base.rol;
  const techo = TECHO[rol];
  const limite = estricta ? base : techo;
  const p = copiar(base);
  const aviso = (campo, texto, motivo) => avisos.push({ capa, rol, campo, pedido: texto, motivo });
  const donde = (campo) => (capa === 'proyecto' ? `perfiles.${rol}_${campo}` : `FRAGUA_PERFIL_${rol.toUpperCase()}_${campo.toUpperCase()}`);

  for (const [campo, texto] of Object.entries(pedido)) {
    if (campo === 'herramientas') {
      const nombres = texto.split(',').map((s) => s.trim()).filter(Boolean);
      const desconocidas = nombres.filter((n) => !HERRAMIENTAS_CODER.includes(n));
      if (desconocidas.length) throw new ErrorPerfil(`${donde(campo)}: herramienta desconocida "${desconocidas[0].slice(0, 60)}". Las que existen: ${HERRAMIENTAS_CODER.join(', ')}.`);
      const admitidas = nombres.filter((n) => limite.herramientas.includes(n));
      for (const n of nombres) if (!admitidas.includes(n)) aviso(campo, n, 'amplía lo permitido: se ignora');
      p.herramientas = [...new Set(admitidas)];
    } else if (campo === 'rutas_escribir') {
      const prefijos = texto.split(',').map(normalizarPrefijo).filter(Boolean);
      for (const x of prefijos) {
        if (x.startsWith('/') || x.split('/').includes('..') || /^[a-zA-Z]:/.test(x)) throw new ErrorPerfil(`${donde(campo)}: la ruta "${x.slice(0, 80)}" debe ser relativa a la raíz del proyecto y sin «..».`);
      }
      // Lo que pide la capa solo vale si cabe dentro de lo que ya se permite
      const previas = limite.rutasEscribir.prefijos;
      const validas = previas === null ? prefijos : prefijos.filter((x) => previas.some((y) => cubre(y, x)));
      for (const x of prefijos) if (!validas.includes(x)) aviso(campo, x, 'amplía lo permitido: se ignora');
      p.rutasEscribir = { clase: p.rutasEscribir.clase, prefijos: validas };
    } else {
      const [minimo, maximo] = campo === 'pruebas_max' ? [0, MAX_TURNOS] : campo === 'pasos_max' ? [1, MAX_TURNOS] : [1, MAX_CONTEXTO];
      if (!/^\d+$/.test(texto) || Number(texto) < minimo || Number(texto) > Number.MAX_SAFE_INTEGER) throw new ErrorPerfil(`${donde(campo)}: "${texto.slice(0, 40)}" no es un entero >= ${minimo}.`);
      let n = Number(texto);
      const clave = campo === 'pasos_max' ? 'pasosMax' : campo === 'pruebas_max' ? 'pruebasMax' : 'contextoMaxBytes';
      if (n > limite[clave]) { aviso(campo, texto, `supera ${limite[clave]}: se ignora`); n = p[clave]; }
      else if (n > maximo) n = p[clave];
      p[clave] = n;
    }
  }
  // Un rol sin herramientas no las gana por pedirlas: ya quedó filtrado contra `limite`
  return p;
}

/**
 * Lo que la capa de usuario pide (entorno).
 * @param {string} rol @returns {Record<string, string>}
 */
function pedidoDeUsuario(rol) {
  /** @type {Record<string, string>} */
  const pedido = {};
  for (const campo of CAMPOS) {
    const v = leerVariable(`PERFIL_${rol.toUpperCase()}_${campo.toUpperCase()}`);
    if (v !== undefined && v !== '') pedido[campo] = String(v);
  }
  return pedido;
}

/**
 * Lo que la capa de proyecto pide (sección `perfiles:` de sdd.config.yaml), por rol. Una clave desconocida es un error:
 * una errata no puede dejar sin apretar lo que se quería apretar sin que nadie se entere.
 * @param {string} cwd @returns {Record<string, Record<string, string>>}
 */
export function leerPerfilesDeProyecto(cwd) {
  const ruta = join(cwd, '.sdd', 'sdd.config.yaml');
  if (!existsSync(ruta)) return {};
  const seccion = leerSeccion(readFileSync(ruta, 'utf8').replace(/^﻿/, ''), 'perfiles');
  /** @type {Record<string, Record<string, string>>} */
  const porRol = {};
  for (const [clave, valor] of Object.entries(seccion)) {
    const m = /^(planner|qa|coder)_(herramientas|rutas_escribir|pasos_max|pruebas_max|contexto_max_bytes)$/.exec(clave);
    if (!m) throw new ErrorPerfil(`.sdd/sdd.config.yaml, perfiles.${clave.slice(0, 60)}: clave desconocida. Las válidas son <rol>_<campo> con rol en ${ROLES_DE_PERFIL.join('|')} y campo en ${CAMPOS.join('|')}.`);
    (porRol[m[1]] ??= {})[m[2]] = valor;
  }
  return porRol;
}

/**
 * Resuelve el perfil de un rol aplicando las tres capas. Lanza `ErrorPerfil` si no se puede resolver.
 * @param {string} rol @param {{ cwd: string, proyecto?: Record<string, Record<string, string>>, usuario?: Record<string, string> }} fuentes
 * @returns {{ perfil: Perfil, avisos: AvisoPerfil[] }}
 */
export function resolverPerfil(rol, fuentes) {
  const avisos = /** @type {AvisoPerfil[]} */ ([]);
  let perfil = perfilPorDefecto(rol);
  perfil = aplicarCapa(perfil, fuentes.usuario ?? pedidoDeUsuario(rol), 'usuario', false, avisos);
  const proyecto = fuentes.proyecto ?? leerPerfilesDeProyecto(fuentes.cwd);
  perfil = aplicarCapa(perfil, proyecto[rol] ?? {}, 'proyecto', true, avisos);
  return { perfil, avisos };
}

/** ¿Tiene esta forma un perfil guardado en el estado? Devuelve errores. @param {unknown} p */
export function validarPerfilGuardado(p) {
  const x = /** @type {any} */ (p);
  const errores = [];
  if (!x || typeof x !== 'object') return ['no es un objeto'];
  if (!ROLES_DE_PERFIL.includes(x.rol)) errores.push('rol desconocido');
  if (!Array.isArray(x.herramientas) || x.herramientas.some((h) => !HERRAMIENTAS_CODER.includes(h))) errores.push('herramientas no válidas');
  const r = x.rutasEscribir;
  if (!r || !['ninguna', 'pruebas', 'no_pruebas'].includes(r.clase) || !(r.prefijos === null || (Array.isArray(r.prefijos) && r.prefijos.every((s) => typeof s === 'string')))) errores.push('rutasEscribir no válido');
  for (const c of ['pasosMax', 'pruebasMax', 'contextoMaxBytes']) if (!Number.isInteger(x[c]) || x[c] < 0) errores.push(`${c} no válido`);
  return errores;
}

/**
 * Perfil efectivo de un nodo que entra: lo resuelto ahora, intersectado con lo guardado si lo hay.
 * @param {string} rol
 * @param {{ cwd: string, perfiles?: Record<string, Perfil> }} estado
 * @param {{ proyecto?: Record<string, Record<string, string>>, usuario?: Record<string, string> }} [fuentes]
 * @returns {{ perfil: Perfil, guardado: Perfil|null, avisos: AvisoPerfil[], estrechado: string[] }}
 */
export function perfilEfectivo(rol, estado, fuentes = {}) {
  const { perfil: ahora, avisos } = resolverPerfil(rol, { cwd: estado.cwd, ...fuentes });
  const guardado = estado.perfiles?.[rol] ?? null;
  if (guardado === null) return { perfil: ahora, guardado: null, avisos, estrechado: [] };
  const errores = validarPerfilGuardado(guardado);
  if (errores.length) throw new ErrorPerfil(`el perfil guardado de "${rol}" no es válido (${errores.join('; ')}).`);
  const efectivo = intersectar(guardado, ahora);
  // Si lo resuelto ahora es más laxo que lo guardado, lo guardado manda: se avisa
  for (const campo of camposEstrechados(ahora, guardado)) {
    avisos.push({ capa: 'reanudacion', rol, campo, pedido: '', motivo: `el perfil de ahora es más laxo en ${campo}: se conserva el que ya tenía la tarea` });
  }
  return { perfil: efectivo, guardado, avisos, estrechado: camposEstrechados(guardado, efectivo) };
}
