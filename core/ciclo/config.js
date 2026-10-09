/**
 * config.js — Secciones motor, sandbox y presupuesto de sdd.config.yaml
 *
 * Lectura simple por líneas, igual que la sección llm: en core/llm-providers/index.js
 * (el proyecto no depende de un parser YAML). Solo claves escalares de un nivel.
 *
 * También las secciones modelos y precios (ADR-19). Como el lector no entiende
 * anidamiento, los precios son claves planas `<identificador>_entrada` y
 * `<identificador>_salida`, en USD por millón de tokens.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const POR_DEFECTO = {
  motor: {
    modo: 'ciclo',              // ciclo (por defecto desde 5.0.0) | clasico
    grafo: 'auto',              // auto | propio (langgraph se retiró en 5.0.0 y se acepta con un aviso)
    recuperador: 'archivos',    // fuente de contexto de los agentes: archivos | semantico
    embeddings: 'hash',         // con recuperador semantico: hash (local, léxico) | ollama
    embeddings_modelo: 'nomic-embed-text',
    nivel_maximo: 'opus',       // nivel de modelo más alto que puede usar un agente: opus (sin límite) | sonnet | haiku
    max_iteraciones: 5,
    sin_progreso: 3,            // ejecuciones fallidas seguidas con la misma salida antes de pedir revisión; 0 lo desactiva
    contexto_max_bytes: 65536,
    implementador: 'bloque',    // forma de trabajar del implementador: bloque (una respuesta con archivos completos) | turnos (ADR-21, con herramientas)
    turnos_max: 30,             // con implementador turnos: respuestas del modelo por intento antes de ejecutar las pruebas finales
    turnos_pruebas_max: 5,      // con implementador turnos: ejecuciones de pruebas que puede pedir el implementador por intento
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
  // ADR-19: vacíos por defecto, es decir, la lista incluida (core/precios.js)
  modelos: /** @type {{ opus?: string, sonnet?: string, haiku?: string }} */ ({}),
  precios: /** @type {Record<string, { input: number, output: number }>} */ ({}),   // USD por token
};

const MODOS = ['clasico', 'ciclo'];
const GRAFOS = ['auto', 'langgraph', 'propio'];
const EMBEDDINGS = ['hash', 'ollama'];
const NIVELES = ['haiku', 'sonnet', 'opus'];
const IMPLEMENTADORES = ['bloque', 'turnos'];
const TOPE_TURNOS = 200;

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

    // La clave admite guiones y puntos (identificadores de modelo: claude-sonnet-4-6, gpt-4.1).
    // Si lleva dos puntos (qwen2.5-coder:7b) tiene que ir entre comillas.
    const m = linea.match(/^\s{2}("[^"]+"|'[^']+'|[\w.-]+)\s*:\s*([^#]+?)\s*(?:#.*)?$/);
    if (m) seccion[m[1].replace(/^["']|["']$/g, '')] = m[2].replace(/^["']|["']$/g, '');
  }
  return seccion;
}

/**
 * Sección `modelos:`: identificador de modelo de cada nivel. Un nivel sin indicar
 * conserva el que trae cada proveedor.
 * @param {string} yaml
 * @returns {{ opus?: string, sonnet?: string, haiku?: string }}
 */
export function leerModelos(yaml) {
  const leido = leerSeccion(yaml, 'modelos');
  for (const clave of Object.keys(leido)) {
    if (!NIVELES.includes(clave)) {
      throw new Error(`modelos.${clave} no es un nivel de modelo en .sdd/sdd.config.yaml. Niveles válidos: ${NIVELES.join(', ')}`);
    }
  }
  return leido;
}

/**
 * Sección `modelos:` del proyecto, para los proveedores.
 * @param {string} cwd
 */
export function leerModelosDe(cwd) {
  const ruta = join(cwd, '.sdd', 'sdd.config.yaml');
  return existsSync(ruta) ? leerModelos(readFileSync(ruta, 'utf8')) : {};
}

const SUFIJOS_PRECIO = { _entrada: 'input', _salida: 'output' };

/**
 * Sección `precios:`: claves planas `<identificador>_entrada` y `<identificador>_salida`
 * en USD por millón de tokens. Un precio no numérico, negativo, vacío o sin su pareja lanza
 * un error que nombra la clave: con un precio mal escrito el tope de gasto no significaría nada.
 * @param {string} yaml
 * @returns {Record<string, { input: number, output: number }>}  USD por token
 */
export function leerPrecios(yaml) {
  /** @type {Record<string, { input?: number, output?: number }>} */
  const precios = {};
  const leido = leerSeccion(yaml, 'precios');
  // El lector ignora una clave sin valor; aquí no puede pasar inadvertida
  for (const clave of clavesSinValor(yaml, 'precios')) leido[clave] ??= '';

  for (const [clave, texto] of Object.entries(leido)) {
    const sufijo = Object.keys(SUFIJOS_PRECIO).find((s) => clave.endsWith(s) && clave.length > s.length);
    if (!sufijo) {
      throw new Error(`precios.${clave} no se entiende en .sdd/sdd.config.yaml: cada clave debe ser <identificador del modelo>_entrada o <identificador del modelo>_salida`);
    }
    const valor = texto.trim() === '' ? NaN : Number(texto);
    if (!Number.isFinite(valor) || valor < 0) {
      throw new Error(`precios.${clave} no es válido en .sdd/sdd.config.yaml: "${texto}". Debe ser un número mayor o igual que 0 (USD por millón de tokens)`);
    }
    const id = clave.slice(0, -sufijo.length);
    (precios[id] ??= {})[SUFIJOS_PRECIO[sufijo]] = valor / 1_000_000;
  }
  for (const [id, p] of Object.entries(precios)) {
    for (const [sufijo, campo] of Object.entries(SUFIJOS_PRECIO)) {
      if (typeof p[campo] !== 'number') {
        throw new Error(`Falta precios.${id}${sufijo} en .sdd/sdd.config.yaml: un modelo necesita precio de entrada y de salida`);
      }
    }
  }
  return /** @type {Record<string, { input: number, output: number }>} */ (precios);
}

/**
 * Claves de una sección escritas sin valor (`clave:` y nada más).
 * @param {string} yaml
 * @param {string} nombre
 * @returns {string[]}
 */
function clavesSinValor(yaml, nombre) {
  const claves = [];
  let dentro = false;
  const inicio = new RegExp(`^${nombre}\\s*:`);
  for (const linea of yaml.split(/\r?\n/)) {
    if (inicio.test(linea)) { dentro = true; continue; }
    if (dentro && /^\S/.test(linea) && !/^#/.test(linea)) dentro = false;
    if (!dentro) continue;
    const m = linea.match(/^\s{2}("[^"]+"|'[^']+'|[\w.-]+)\s*:\s*(?:#.*)?$/);
    if (m) claves.push(m[1].replace(/^["']|["']$/g, ''));
  }
  return claves;
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
  /** @type {Record<string, Record<string, string>>} */
  const leidos = {};
  for (const [nombre, defectos] of Object.entries(POR_DEFECTO)) {
    const leido = leidos[nombre] = leerSeccion(yaml, nombre);
    config[nombre] = { ...defectos };
    for (const [clave, valor] of Object.entries(defectos)) {
      if (clave in leido) config[nombre][clave] = convertir(leido[clave], valor);
    }
  }

  // ADR-19: lo que indique el proyecto manda sobre la lista incluida (core/precios.js)
  config.modelos = leerModelos(yaml);
  config.precios = leerPrecios(yaml);

  if (overrides.motor) config.motor.modo = overrides.motor;
  if (process.env.FORGE_MOTOR_GRAFO) config.motor.grafo = process.env.FORGE_MOTOR_GRAFO;
  if (!GRAFOS.includes(config.motor.grafo)) {
    throw new Error(`motor.grafo desconocido: "${config.motor.grafo}". Valores válidos: ${GRAFOS.join(', ')}`);
  }
  if (process.env.FORGE_NIVEL_MAXIMO) config.motor.nivel_maximo = process.env.FORGE_NIVEL_MAXIMO;
  if (!NIVELES.includes(config.motor.nivel_maximo)) {
    throw new Error(`motor.nivel_maximo desconocido: "${config.motor.nivel_maximo}". Valores válidos: ${NIVELES.join(', ')}`);
  }
  // Se mira el texto leído: un valor no numérico no debe convertirse en silencio en el de por defecto
  const sinProgreso = leidos.motor.sin_progreso;
  if ((sinProgreso !== undefined && !/^\d+$/.test(sinProgreso)) || !Number.isInteger(config.motor.sin_progreso) || config.motor.sin_progreso < 0) {
    throw new Error(`motor.sin_progreso no válido: "${sinProgreso ?? config.motor.sin_progreso}". Debe ser un entero ≥ 0 (0 desactiva la detección).`);
  }
  // ADR-21. FORGE_IMPLEMENTADOR permite probar el modo por turnos con un modelo real sin editar el proyecto
  if (process.env.FORGE_IMPLEMENTADOR) config.motor.implementador = process.env.FORGE_IMPLEMENTADOR;
  if (!IMPLEMENTADORES.includes(config.motor.implementador)) {
    throw new Error(`motor.implementador desconocido: "${config.motor.implementador}". Valores válidos: ${IMPLEMENTADORES.join(', ')}`);
  }
  for (const [clave, minimo, maximo] of /** @type {[string, number, number][]} */ ([['turnos_max', 1, TOPE_TURNOS], ['turnos_pruebas_max', 0, TOPE_TURNOS]])) {
    const leido = leidos.motor[clave];
    const valor = config.motor[clave];
    if ((leido !== undefined && !/^\d+$/.test(leido)) || !Number.isInteger(valor) || valor < minimo || valor > maximo) {
      throw new Error(`motor.${clave} no válido: "${leido ?? valor}". Debe ser un entero entre ${minimo} y ${maximo}.`);
    }
  }
  if (process.env.FORGE_BUDGET_USD) {
    const tope = Number(process.env.FORGE_BUDGET_USD);
    if (Number.isFinite(tope) && tope >= 0) config.presupuesto.tope_usd = tope;
  }

  if (!EMBEDDINGS.includes(config.motor.embeddings)) {
    throw new Error(`motor.embeddings desconocido: "${config.motor.embeddings}". Valores válidos: ${EMBEDDINGS.join(', ')}`);
  }
  if (!MODOS.includes(config.motor.modo)) {
    throw new Error(`motor.modo desconocido: "${config.motor.modo}". Valores válidos: ${MODOS.join(', ')}`);
  }
  if (config.presupuesto.umbral_degradacion_usd > config.presupuesto.tope_usd) {
    config.presupuesto.umbral_degradacion_usd = config.presupuesto.tope_usd;
  }
  return config;
}
