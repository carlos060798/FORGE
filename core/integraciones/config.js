/**
 * config.js — Sección `integraciones:` de .sdd/sdd.config.yaml
 *
 * Claves PLANAS, a un solo nivel (el lector mínimo de core/ciclo/config.js no entiende
 * anidamiento; ver plan.md sección 6):
 *
 *   integraciones:
 *     github_modo: solo_lectura            # apagado | solo_lectura | comentar | proponer
 *     github_token_env: FORGE_GITHUB_TOKEN # NOMBRE de la variable, nunca el valor
 *     github_destinos: org/repo, org/otro  # lista cerrada, separada por comas
 *     gitlab_modo / gitlab_host / gitlab_token_env / gitlab_destinos
 *     jira_modo / jira_sitio / jira_usuario_env / jira_token_env / jira_destinos
 *     topes_operaciones_por_sesion: 20
 *
 * Este módulo NO lee `process.env` al interpretar: solo lee el archivo. El entorno se toca
 * únicamente en `leerToken` y `leerUsuario`, que nombran la variable y solo valen para un
 * proveedor activo. Sin sección, o con todo apagado, no hay lectura alguna (CA-005-01).
 *
 * El lector `leerSeccion` de core/ciclo/config.js se reutiliza para los valores. Como ignora en
 * silencio lo que no entiende (claves anidadas, sangría de 4, claves sin valor), aquí se recorre
 * además la sección para convertir esas líneas en errores: una clave que no se entiende en una
 * configuración de seguridad no puede pasar inadvertida.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { leerSeccion } from '../ciclo/config.js';
import { redactar } from '../ciclo/redactar.js';
import { MODOS } from './puerto.js';

export const SECCION = 'integraciones';
export const TOPE_POR_DEFECTO = 20;
const TOPE_MAXIMO = 1000;

/** Claves permitidas dentro de la sección. Cualquier otra es un error. */
const CLAVES = Object.freeze({
  github: ['github_modo', 'github_token_env', 'github_destinos'],
  gitlab: ['gitlab_modo', 'gitlab_host', 'gitlab_token_env', 'gitlab_destinos'],
  jira: ['jira_modo', 'jira_sitio', 'jira_usuario_env', 'jira_token_env', 'jira_destinos'],
  topes: ['topes_operaciones_por_sesion'],
});
const TODAS = new Set(Object.values(CLAVES).flat());

export class ErrorConfigIntegraciones extends Error {
  /** @param {string[]} problemas */
  constructor(problemas) {
    super(`Configuración de integraciones no válida en .sdd/sdd.config.yaml (sección ${SECCION}):\n${problemas.map((p) => `- ${p}`).join('\n')}`);
    this.name = 'ErrorConfigIntegraciones';
    this.problemas = problemas;
  }
}

/**
 * @typedef {Object} ConfigProveedor
 * @property {'github'|'gitlab'|'jira'} nombre
 * @property {'apagado'|'solo_lectura'|'comentar'|'proponer'} modo
 * @property {string} host            host de la API (HTTPS siempre)
 * @property {string} [tokenEnv]      nombre de la variable de entorno del token
 * @property {string} [usuarioEnv]    solo Jira: variable con el correo del usuario de servicio
 * @property {string[]} destinos      lista cerrada
 *
 * @typedef {Object} ConfigIntegraciones
 * @property {boolean} presente       había sección `integraciones:`
 * @property {boolean} activa         algún proveedor no está apagado
 * @property {{ github: ConfigProveedor, gitlab: ConfigProveedor, jira: ConfigProveedor }} proveedores
 * @property {{ operacionesPorSesion: number }} topes
 * @property {string[]} avisos
 */

// ── Lectura de la sección ───────────────────────────────────────────────────────────────────

/** La misma expresión que `leerSeccion`, para que lo que ella lea y lo que aquí se valide coincidan. */
const ENTRADA = /^\s{2}("[^"]+"|'[^']+'|[\w.-]+)\s*:\s*([^#]+?)\s*(?:#.*)?$/;
const ENTRADA_VACIA = /^\s{2}("[^"]+"|'[^']+'|[\w.-]+)\s*:\s*(?:#.*)?$/;

/**
 * Recorre la sección y devuelve lo que `leerSeccion` descartaría.
 * @param {string} yaml
 */
function escanear(yaml) {
  /** @type {string[]} */
  const problemas = [];
  /** @type {Map<string, number>} */
  const vistas = new Map();
  let presente = 0;
  let dentro = false;
  const inicio = new RegExp(`^${SECCION}\\s*:(.*)$`);
  const lineas = yaml.replace(/^﻿/, '').split(/\r?\n/);
  lineas.forEach((linea, i) => {
    const n = i + 1;
    const cab = inicio.exec(linea);
    if (cab) {
      presente++;
      dentro = true;
      if (cab[1].replace(/#.*$/, '').trim() !== '') {
        problemas.push(`línea ${n}: «${SECCION}:» debe ser un bloque de claves, no llevar un valor en la misma línea`);
      }
      return;
    }
    if (dentro && /^\S/.test(linea) && !/^#/.test(linea)) dentro = false;
    if (!dentro) return;
    if (/^\s*$/.test(linea) || /^\s*#/.test(linea)) return;
    const vacia = ENTRADA_VACIA.exec(linea);
    if (vacia) {
      problemas.push(`línea ${n}: la clave «${mostrar(limpiaClave(vacia[1]))}» no tiene valor`);
      return;
    }
    const m = ENTRADA.exec(linea);
    if (!m) {
      problemas.push(`línea ${n}: no se entiende; la sección admite solo claves planas «clave: valor» con dos espacios de sangría (sin anidamiento)`);
      return;
    }
    const clave = limpiaClave(m[1]);
    if (vistas.has(clave)) problemas.push(`línea ${n}: la clave «${mostrar(clave)}» está repetida (primera vez en la línea ${vistas.get(clave)})`);
    else vistas.set(clave, n);
  });
  if (presente > 1) problemas.push(`la sección «${SECCION}:» aparece ${presente} veces; debe haber una sola`);
  return { presente: presente > 0, problemas };
}

const limpiaClave = (c) => c.replace(/^["']|["']$/g, '');

// ── Validación de valores ───────────────────────────────────────────────────────────────────

/** Texto seguro para un mensaje: sin formato de secreto, sin controles, acotado. */
function mostrar(valor) {
  if (pareceTokenLiteral(valor)) return '(valor omitido)';
  return redactar(String(valor)).replace(/[\u0000-\u001F\u007F-\u009F]/g, '').slice(0, 40);
}

/**
 * ¿Parece un token y no el nombre de una variable? Usa los formatos de redactar.js y, además,
 * lo que ningún nombre de variable razonable tiene: ser largo o mezclar mayúsculas, minúsculas y dígitos.
 * @param {string} v
 */
export function pareceTokenLiteral(v) {
  if (redactar(v) !== v) return true;
  if (v.length > 64) return true;
  if (v.length >= 20 && /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v)) return true;
  return false;
}

const NOMBRE_VARIABLE = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

const HOST = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,61}[a-z0-9](?::(\d{1,5}))?$/i;
const ESQUEMA = /^[a-z][a-z0-9+.-]*:\/\//i;

const DESTINO = {
  github: /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/(?!\.{1,2}$)[A-Za-z0-9._-]{1,100}$/,
  gitlab: /^[A-Za-z0-9_](?:[A-Za-z0-9._-]*)(?:\/(?!\.{1,2}(?:\/|$))[A-Za-z0-9_][A-Za-z0-9._-]*){1,19}$/,
  jira: /^[A-Z][A-Z0-9_]{1,9}$/,
};
const FORMA_DESTINO = {
  github: 'organizacion/repositorio',
  gitlab: 'grupo[/subgrupo]/proyecto',
  jira: 'clave de proyecto en mayúsculas (por ejemplo ABC)',
};

/**
 * @param {string} clave @param {string} valor @param {string[]} problemas
 * @returns {string|undefined} nombre de variable válido
 */
function validarVariable(clave, valor, problemas) {
  if (pareceTokenLiteral(valor)) {
    problemas.push(`${clave}: el valor parece un token literal. Aquí va el NOMBRE de la variable de entorno que lo contiene, nunca el token (no se imprime el valor; si era real, rótalo)`);
    return undefined;
  }
  if (!NOMBRE_VARIABLE.test(valor)) {
    problemas.push(`${clave}: debe ser el nombre de una variable de entorno (letras, dígitos y «_», sin empezar por dígito)`);
    return undefined;
  }
  return valor;
}

/** @returns {string|undefined} host en minúsculas */
function validarHost(clave, valor, problemas) {
  if (ESQUEMA.test(valor)) {
    problemas.push(`${clave}: debe ser solo el nombre de host, sin esquema (siempre se usa HTTPS): «${mostrar(valor)}»`);
    return undefined;
  }
  const m = HOST.exec(valor);
  const puerto = m?.[1];
  if (!m || (puerto !== undefined && (Number(puerto) < 1 || Number(puerto) > 65535))) {
    problemas.push(`${clave}: debe ser solo un nombre de host (por ejemplo gitlab.empresa.com, con :puerto solo si hace falta): sin ruta, credenciales, consulta ni direcciones IP: «${mostrar(valor)}»`);
    return undefined;
  }
  return valor.toLowerCase();
}

/** @returns {string[]} */
function validarDestinos(proveedor, valor, problemas) {
  const clave = `${proveedor}_destinos`;
  const lista = valor.split(',').map((s) => s.trim()).filter(Boolean);
  if (lista.length === 0) {
    problemas.push(`${clave}: la lista está vacía`);
    return [];
  }
  /** @type {string[]} */
  const ok = [];
  for (const d of lista) {
    if (/[*?[\]{}]/.test(d)) {
      problemas.push(`${clave}: «${mostrar(d)}» lleva un comodín; la lista es cerrada y se nombra cada destino`);
    } else if (!DESTINO[proveedor].test(d)) {
      problemas.push(`${clave}: «${mostrar(d)}» no tiene el formato ${FORMA_DESTINO[proveedor]}`);
    } else if (!ok.includes(d)) {
      ok.push(d);
    }
  }
  return ok;
}

/**
 * Interpreta el texto de sdd.config.yaml. Lanza `ErrorConfigIntegraciones` con TODOS los problemas.
 * @param {string} yaml
 * @returns {ConfigIntegraciones}
 */
export function interpretarIntegraciones(yaml) {
  const { presente, problemas } = escanear(yaml);
  const v = presente ? leerSeccion(yaml.replace(/^﻿/, ''), SECCION) : {};
  /** @type {string[]} */
  const avisos = [];

  for (const clave of Object.keys(v)) {
    if (!TODAS.has(clave)) {
      problemas.push(`clave desconocida «${mostrar(clave)}». Claves válidas: ${[...TODAS].join(', ')}`);
    }
  }

  /** @type {Record<string, ConfigProveedor>} */
  const proveedores = {};
  for (const nombre of /** @type {const} */ (['github', 'gitlab', 'jira'])) {
    const modoTexto = v[`${nombre}_modo`];
    let modo = /** @type {ConfigProveedor['modo']} */ ('apagado');
    if (modoTexto !== undefined) {
      if (/** @type {readonly string[]} */ (MODOS).includes(modoTexto)) modo = /** @type {any} */ (modoTexto);
      else problemas.push(`${nombre}_modo: «${mostrar(modoTexto)}» no es un modo. Valores válidos: ${MODOS.join(', ')}`);
    }
    const activo = modo !== 'apagado';

    const tokenEnv = v[`${nombre}_token_env`] === undefined ? undefined : validarVariable(`${nombre}_token_env`, v[`${nombre}_token_env`], problemas);
    const usuarioEnv = nombre === 'jira' && v.jira_usuario_env !== undefined ? validarVariable('jira_usuario_env', v.jira_usuario_env, problemas) : undefined;

    let host = nombre === 'github' ? 'api.github.com' : '';
    if (nombre === 'gitlab') {
      host = v.gitlab_host === undefined ? 'gitlab.com' : (validarHost('gitlab_host', v.gitlab_host, problemas) ?? '');
    } else if (nombre === 'jira' && v.jira_sitio !== undefined) {
      const h = validarHost('jira_sitio', v.jira_sitio, problemas);
      if (h !== undefined && !/^[a-z0-9-]+\.atlassian\.net$/.test(h)) {
        problemas.push(`jira_sitio: debe ser un sitio de Jira Cloud (nombre.atlassian.net); Jira Data Center no se admite: «${mostrar(v.jira_sitio)}»`);
      } else if (h !== undefined) host = h;
    }

    const destinos = v[`${nombre}_destinos`] === undefined ? [] : validarDestinos(nombre, v[`${nombre}_destinos`], problemas);

    if (activo) {
      if (v[`${nombre}_destinos`] === undefined) problemas.push(`${nombre}_destinos: es obligatoria con el proveedor activo (no existe «todos»)`);
      if (v[`${nombre}_token_env`] === undefined) problemas.push(`${nombre}_token_env: es obligatoria con el proveedor activo (nombre de la variable que contiene el token)`);
      if (nombre === 'jira') {
        if (v.jira_sitio === undefined) problemas.push('jira_sitio: es obligatoria con Jira activo (por ejemplo ejemplo.atlassian.net)');
        if (v.jira_usuario_env === undefined) problemas.push('jira_usuario_env: es obligatoria con Jira activo (variable con el correo del usuario de servicio)');
      }
    } else if (modoTexto === undefined && CLAVES[nombre].some((k) => k !== `${nombre}_modo` && v[k] !== undefined)) {
      avisos.push(`${nombre}_modo no está definido: el proveedor queda apagado aunque tenga otras claves`);
    }

    proveedores[nombre] = { nombre, modo, host, ...(tokenEnv ? { tokenEnv } : {}), ...(usuarioEnv ? { usuarioEnv } : {}), destinos };
  }

  let operacionesPorSesion = TOPE_POR_DEFECTO;
  const t = v.topes_operaciones_por_sesion;
  if (t !== undefined) {
    if (/^\d+$/.test(t) && Number(t) >= 1 && Number(t) <= TOPE_MAXIMO) operacionesPorSesion = Number(t);
    else problemas.push(`topes_operaciones_por_sesion: «${mostrar(t)}» no es válido; debe ser un entero entre 1 y ${TOPE_MAXIMO}`);
  }

  if (problemas.length) throw new ErrorConfigIntegraciones(problemas);

  const cfg = /** @type {ConfigIntegraciones['proveedores']} */ (/** @type {any} */ (proveedores));
  return {
    presente,
    activa: Object.values(cfg).some((p) => p.modo !== 'apagado'),
    proveedores: cfg,
    topes: { operacionesPorSesion },
    avisos,
  };
}

/**
 * Lee `.sdd/sdd.config.yaml` del proyecto. Sin archivo, sin sección o con todo apagado: no hay
 * nada que hacer y no se toca el entorno.
 * @param {string} cwd
 * @param {{ env?: Record<string, string|undefined> }} [_opciones]  solo para que las pruebas demuestren que no se lee
 * @returns {ConfigIntegraciones}
 */
export function leerConfigIntegraciones(cwd, _opciones = {}) {
  const ruta = join(cwd, '.sdd', 'sdd.config.yaml');
  return interpretarIntegraciones(existsSync(ruta) ? readFileSync(ruta, 'utf8') : '');
}

// ── Uso de la configuración ─────────────────────────────────────────────────────────────────

/**
 * ¿Es `destino` uno de los permitidos? Igualdad exacta con la lista: sin comodines ni prefijos.
 * Con el proveedor apagado nada es destino.
 * @param {ConfigProveedor} proveedor
 * @param {string} destino
 */
export function destinoPermitido(proveedor, destino) {
  if (proveedor.modo === 'apagado' || typeof destino !== 'string') return false;
  if (proveedor.nombre === 'jira') return proveedor.destinos.includes(destino);
  const d = destino.toLowerCase();
  return proveedor.destinos.some((x) => x.toLowerCase() === d);
}

/** @param {ConfigProveedor} proveedor @param {string|undefined} nombre @param {Record<string, string|undefined>} env */
function leerVariable(proveedor, nombre, env) {
  if (proveedor.modo === 'apagado') {
    throw new Error(`La integración con ${proveedor.nombre} está apagada: no se leen sus credenciales`);
  }
  if (!nombre) return null;
  const v = env[nombre];
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

/**
 * Valor del token del proveedor, o null si la variable no está definida. Lanza si el proveedor está
 * apagado. Es la ÚNICA lectura del entorno de este paquete para tokens.
 * @param {ConfigProveedor} proveedor
 * @param {Record<string, string|undefined>} [env]
 */
export function leerToken(proveedor, env = process.env) {
  return leerVariable(proveedor, proveedor.tokenEnv, env);
}

/**
 * Usuario de servicio (Jira), o null. Mismas reglas que `leerToken`.
 * @param {ConfigProveedor} proveedor
 * @param {Record<string, string|undefined>} [env]
 */
export function leerUsuario(proveedor, env = process.env) {
  return leerVariable(proveedor, proveedor.usuarioEnv, env);
}
