/**
 * config.js — Secciones motor, sandbox y presupuesto de sdd.config.yaml
 *
 * Lectura simple por líneas, igual que la sección llm: en core/llm-providers/index.js
 * (el proyecto no depende de un parser YAML). Solo claves escalares de un nivel.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const POR_DEFECTO = {
  motor: {
    modo: 'clasico',            // clasico | ciclo
    grafo: 'auto',              // auto | langgraph | propio
    recuperador: 'archivos',    // fuente de contexto de los agentes
    max_iteraciones: 5,
    contexto_max_bytes: 65536,
  },
  sandbox: {
    cpus: 1,
    memoria: '512m',
    pids: 256,
    timeout_s: 120,
    salida_max_bytes: 1048576,
  },
  presupuesto: {
    tope_usd: 2.0,
    umbral_degradacion_usd: 1.5,
    degradar_a: 'escalon',      // escalon | local
  },
};

const MODOS = ['clasico', 'ciclo'];
const GRAFOS = ['auto', 'langgraph', 'propio'];

/**
 * @param {string} yaml
 * @param {string} nombre  clave de primer nivel
 * @returns {Record<string, string>}
 */
export function leerSeccion(yaml, nombre) {
  /** @type {Record<string, string>} */
  const seccion = {};
  let dentro = false;
  const inicio = new RegExp(`^${nombre}\\s*:`);

  for (const linea of yaml.split(/\r?\n/)) {
    if (inicio.test(linea)) { dentro = true; continue; }
    if (dentro && /^\S/.test(linea) && !/^#/.test(linea)) dentro = false;
    if (!dentro) continue;

    const m = linea.match(/^\s{2}(\w+)\s*:\s*([^#]+?)\s*(?:#.*)?$/);
    if (m) seccion[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return seccion;
}

/** Convierte el texto leído al tipo del valor por defecto. */
function convertir(texto, porDefecto) {
  if (typeof porDefecto !== 'number') return texto;
  const n = Number(texto);
  return Number.isFinite(n) ? n : porDefecto;
}

/**
 * @param {string} cwd
 * @param {{ motor?: string }} [overrides]  valores de línea de comandos
 * @returns {typeof POR_DEFECTO}
 */
/**
 * Lista `protecciones.no_tocar_archivos` de sdd.config.yaml (elementos `- "patron"`).
 * @param {string} cwd
 * @returns {string[]}
 */
export function leerRutasProtegidas(cwd) {
  const ruta = join(cwd, '.sdd', 'sdd.config.yaml');
  if (!existsSync(ruta)) return [];
  // Sin BOM y sin lineas de comentario (en cualquier columna)
  const texto = readFileSync(ruta, 'utf8').replace(/^\uFEFF/, '');
  const lineas = texto.split(/\r?\n/).filter((l) => !/^\s*#/.test(l));
  const valor = (v) => (v.match(/"([^"]*)"|'([^']*)'|([^,\]\s#][^,\]#]*)/g) ?? []).map((x) => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean);

  const patrones = [];
  let enSeccion = false;
  let enLista = false;
  let vista = false;
  let vacia = false;
  for (const l of lineas) {
    if (/^\S/.test(l)) { enSeccion = /^["']?protecciones["']?\s*:\s*(#.*)?$/.test(l); enLista = false; continue; }
    if (!enSeccion) continue;
    const clave = /^\s+["']?no_tocar_archivos["']?\s*:\s*(.*)$/.exec(l);
    if (clave) {
      vista = true;
      const resto = clave[1].replace(/\s+#.*$/, '').trim();
      if (resto === '') { enLista = true; continue; }
      enLista = false;
      if (/^\[.*\]$/.test(resto)) {
        const items = valor(resto.slice(1, -1));
        if (items.length === 0) vacia = true;
        patrones.push(...items);
      }
      continue;
    }
    if (enLista) {
      const m = /^\s*-\s*(.*?)\s*$/.exec(l);
      if (m) { patrones.push(...valor(m[1].replace(/\s+#.*$/, '')).slice(0, 1)); continue; }
      enLista = false;
    }
  }
  // Si la lista esta declarada pero no se entendio, mejor parar que dejar rutas sin proteger
  const mencionada = lineas.some((l) => /no_tocar_archivos/.test(l));
  if ((mencionada && !vista) || (vista && patrones.length === 0 && !vacia && lineas.some((l) => /^\s*-\s*\S/.test(l)))) {
    throw new Error('No se pudo leer protecciones.no_tocar_archivos de .sdd/sdd.config.yaml. Usa una lista con "- \"patron\"" o [\"a\", \"b\"] bajo la seccion protecciones, o corrigela: sin ella las rutas no estarian protegidas.');
  }
  return patrones;
}

export function leerConfigCiclo(cwd, overrides = {}) {
  const ruta = join(cwd, '.sdd', 'sdd.config.yaml');
  const yaml = existsSync(ruta) ? readFileSync(ruta, 'utf8') : '';

  const config = /** @type {any} */ ({});
  for (const [nombre, defectos] of Object.entries(POR_DEFECTO)) {
    const leido = leerSeccion(yaml, nombre);
    config[nombre] = { ...defectos };
    for (const [clave, valor] of Object.entries(defectos)) {
      if (clave in leido) config[nombre][clave] = convertir(leido[clave], valor);
    }
  }

  if (overrides.motor) config.motor.modo = overrides.motor;
  if (process.env.FORGE_MOTOR_GRAFO) config.motor.grafo = process.env.FORGE_MOTOR_GRAFO;
  if (!GRAFOS.includes(config.motor.grafo)) {
    throw new Error(`motor.grafo desconocido: "${config.motor.grafo}". Valores válidos: ${GRAFOS.join(', ')}`);
  }
  if (process.env.FORGE_BUDGET_USD) {
    const tope = Number(process.env.FORGE_BUDGET_USD);
    if (Number.isFinite(tope) && tope >= 0) config.presupuesto.tope_usd = tope;
  }

  if (!MODOS.includes(config.motor.modo)) {
    throw new Error(`motor.modo desconocido: "${config.motor.modo}". Valores válidos: ${MODOS.join(', ')}`);
  }
  if (config.presupuesto.umbral_degradacion_usd > config.presupuesto.tope_usd) {
    config.presupuesto.umbral_degradacion_usd = config.presupuesto.tope_usd;
  }
  return config;
}
