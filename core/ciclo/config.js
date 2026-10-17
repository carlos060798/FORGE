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
import { validarRuntime } from '../sandbox/politica.js';
import { leerVariable } from '../entorno.js';
import { tablaPorToken } from '../precios.js';
import { esNivel, NOMBRES_DE_NIVEL } from '../llm-providers/niveles.js';

/** Tope de gasto por defecto (USD) y techo de lo que un archivo del proyecto puede declarar. */
export const TOPE_POR_DEFECTO_USD = 2.0;
const topesAvisados = new Set();
/** @param {number} pedido */
function avisarTopeIgnorado(pedido) {
  if (topesAvisados.has(pedido)) return;
  topesAvisados.add(pedido);
  console.warn(`[Fragua] .sdd/sdd.config.yaml pide presupuesto.tope_usd = ${pedido}, por encima del tope por defecto (${TOPE_POR_DEFECTO_USD}): se ignora. Un archivo del proyecto no puede subir tu tope de gasto. Si es tu proyecto, define FRAGUA_BUDGET_USD en tu entorno.`);
}

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
    mutacion: 'informar',       // medir las pruebas por mutación tras un pase (ADR-20): no | informar | exigir
    mutacion_minima: 0.6,       // con exigir: proporción mínima de alteraciones detectadas (0 a 1)
    mutacion_max: 10,           // alteraciones concluyentes por tarea, como mucho
    mutacion_max_archivos: 5,   // archivos que se miden por tarea, como mucho (los de más líneas cambiadas)
    mutacion_min_concluyentes: 3, // con exigir: alteraciones concluyentes mínimas para que la puntuación valga (H-04)
    mutacion_timeout_s: 300,    // tiempo máximo de la medición por tarea
  },
  sandbox: {
    cpus: 1,
    memoria: '512m',
    pids: 256,
    timeout_s: 120,
    salida_max_bytes: 1048576,
    runtime: '',                // mecanismo de aislamiento de Docker (--runtime); vacío = el de Docker por defecto
  },
  presupuesto: {
    tope_usd: TOPE_POR_DEFECTO_USD,
    umbral_degradacion_usd: 1.5,
    degradar_a: 'escalon',      // escalon | local
    sin_precio: 'avisar',       // avisar | rechazar: qué hacer con un modelo sin precio conocido (CA-004-03)
  },
  // ADR-19: vacíos por defecto, es decir, la lista incluida (core/precios.js)
  modelos: /** @type {{ opus?: string, sonnet?: string, haiku?: string }} */ ({}),
  precios: /** @type {Record<string, { input: number, output: number }>} */ ({}),   // USD por token
};

const MODOS = ['clasico', 'ciclo'];
const GRAFOS = ['auto', 'langgraph', 'propio'];
const EMBEDDINGS = ['hash', 'ollama'];
const SIN_PRECIO = ['avisar', 'rechazar'];
const IMPLEMENTADORES = ['bloque', 'turnos'];
const TOPE_TURNOS = 200;
const MUTACION = ['no', 'informar', 'exigir'];

/**
 * ¿Es `clave` una clave que la sección `nombre` reconoce? Solo estas se vigilan por sangría: una
 * clave desconocida no es un fallo de sangría. En `precios` valen las que acaban en un sufijo de precio.
 * @param {string} nombre @param {string} clave
 */
function claveConocida(nombre, clave) {
  if (nombre === 'modelos') return esNivel(clave);
  if (nombre === 'precios') return Object.keys(SUFIJOS_TODOS).some((s) => clave.endsWith(s) && clave.length > s.length);
  const defectos = /** @type {Record<string, object>} */ (POR_DEFECTO)[nombre];
  return Boolean(defectos) && Object.prototype.hasOwnProperty.call(defectos, clave);
}

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
  const lineas = yaml.split(/\r?\n/);

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];
    if (inicio.test(linea)) { dentro = true; continue; }
    if (dentro && /^\S/.test(linea) && !/^#/.test(linea)) dentro = false;
    if (!dentro) continue;

    // Una clave conocida con otra sangría que dos espacios no la lee este analizador: antes se
    // ignoraba sin avisar (un `mutacion: no` mal sangrado no hacía nada). Ahora se rechaza.
    const mala = linea.match(/^([ \t]+)("[^"]+"|'[^']+'|[\w.-]+)\s*:(?:\s|$)/);
    if (mala && mala[1] !== '  ') {
      const clave = mala[2].replace(/^["']|["']$/g, '');
      if (claveConocida(nombre, clave)) {
        throw new Error(`.sdd/sdd.config.yaml, línea ${i + 1}: la clave "${nombre}.${clave}" tiene una sangría que no se admite (${mala[1].includes('\t') ? 'con tabulación' : `${mala[1].length} espacio(s)`}); usa exactamente 2 espacios. Con otra sangría la clave se ignoraría sin avisar.`);
      }
    }

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
    if (!esNivel(clave)) {
      throw new Error(`modelos.${clave} no es un nivel de modelo en .sdd/sdd.config.yaml. Niveles válidos: ${NOMBRES_DE_NIVEL.join(', ')}`);
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
/** Opcionales (caché de prompts): sin ellos se cobra al precio de entrada, ver `precioCompletoDe`. */
const SUFIJOS_PRECIO_CACHE = { _cache_escritura: 'cacheWrite', _cache_lectura: 'cacheRead' };
const SUFIJOS_TODOS = { ...SUFIJOS_PRECIO_CACHE, ...SUFIJOS_PRECIO };

/**
 * Sección `precios:`: claves planas `<identificador>_entrada` y `<identificador>_salida`
 * en USD por millón de tokens. Un precio no numérico, negativo, vacío o sin su pareja lanza
 * un error que nombra la clave: con un precio mal escrito el tope de gasto no significaría nada.
 * @param {string} yaml
 * @returns {Record<string, { input: number, output: number }>}  USD por token
 */
export function leerPrecios(yaml) {
  /** @type {Record<string, { input?: number, output?: number, cacheWrite?: number, cacheRead?: number }>} */
  const precios = {};
  const leido = leerSeccion(yaml, 'precios');
  // El lector ignora una clave sin valor; aquí no puede pasar inadvertida
  for (const clave of clavesSinValor(yaml, 'precios')) leido[clave] ??= '';

  for (const [clave, texto] of Object.entries(leido)) {
    const sufijo = Object.keys(SUFIJOS_TODOS).find((s) => clave.endsWith(s) && clave.length > s.length);
    if (!sufijo) {
      throw new Error(`precios.${clave} no se entiende en .sdd/sdd.config.yaml: cada clave debe ser <identificador del modelo>_entrada o <identificador del modelo>_salida (y, opcionales, _cache_escritura y _cache_lectura)`);
    }
    const valor = texto.trim() === '' ? NaN : Number(texto);
    if (!Number.isFinite(valor) || valor < 0) {
      throw new Error(`precios.${clave} no es válido en .sdd/sdd.config.yaml: "${texto}". Debe ser un número mayor o igual que 0 (USD por millón de tokens)`);
    }
    const id = clave.slice(0, -sufijo.length);
    (precios[id] ??= {})[SUFIJOS_TODOS[sufijo]] = valor / 1_000_000;
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

const preciosAvisados = new Set();

/**
 * Variable del ENTORNO del usuario: ids de modelo (separados por comas) cuyo precio 0 acepta aunque lo
 * declare el proyecto. Es la forma explícita de decir «este modelo no me cuesta» (CA-004-01).
 */
export const VARIABLE_PRECIOS_CERO = 'PRECIOS_CERO';

/**
 * Aplica «el proyecto puede apretar, nunca aflojar» a los precios declarados:
 *  - modelo de la tabla incluida: vale el MAYOR entre el del proyecto y el de la tabla (entrada y salida);
 *  - modelo que no está en la tabla: un precio 0 se descarta (queda sin precio conocido, y se cuenta al
 *    más caro) salvo que el usuario nombre el modelo en `FRAGUA_PRECIOS_CERO`.
 * @param {Record<string, { input: number, output: number, cacheWrite?: number, cacheRead?: number }>} precios USD por token
 * @param {{ avisar?: (m: string) => void, env?: Record<string, string|undefined> }} [o]
 */
export function limitarPreciosDelProyecto(precios, o = {}) {
  const avisar = o.avisar ?? ((m) => { if (!preciosAvisados.has(m)) { preciosAvisados.add(m); console.warn(m); } });
  const permitidosCero = new Set(String(leerVariable(VARIABLE_PRECIOS_CERO, o.env ?? process.env) ?? '')
    .split(',').map((x) => x.trim()).filter(Boolean));
  const tabla = tablaPorToken();
  const enTabla = (/** @type {string} */ id) => Object.values(tabla).map((m) => m[id]).find(Boolean);
  /** @type {typeof precios} */
  const salida = {};
  for (const [id, p] of Object.entries(precios)) {
    const incluido = enTabla(id);
    if (incluido) {
      const input = Math.max(p.input, incluido.input);
      const output = Math.max(p.output, incluido.output);
      if (input !== p.input || output !== p.output) {
        avisar(`[Fragua] .sdd/sdd.config.yaml: el precio de «${id}» está por debajo de la tabla incluida y se ignora: un archivo del proyecto no puede bajar un precio (el gasto contaría menos del real).`);
      }
      salida[id] = { ...p, input, output };
    } else if ((p.input <= 0 || p.output <= 0) && !permitidosCero.has(id)) {
      avisar(`[Fragua] .sdd/sdd.config.yaml: «${id}» declara precio 0 y no está en la tabla incluida: se ignora (se contará al precio más caro conocido). Si de verdad no te cuesta, nómbralo en FRAGUA_${VARIABLE_PRECIOS_CERO} en tu entorno.`);
    } else {
      salida[id] = p;
    }
  }
  return salida;
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
  // El proyecto (que puede ser de un repositorio ajeno) solo puede SUBIR un precio de la tabla incluida,
  // nunca bajarlo: con un precio 0 declarado el gasto no contaría y el tope no se alcanzaría (revisión H-2)
  config.precios = limitarPreciosDelProyecto(leerPrecios(yaml));

  if (overrides.motor) config.motor.modo = overrides.motor;
  const grafoEnv = leerVariable('MOTOR_GRAFO');
  if (grafoEnv) config.motor.grafo = grafoEnv;
  if (!GRAFOS.includes(config.motor.grafo)) {
    throw new Error(`motor.grafo desconocido: "${config.motor.grafo}". Valores válidos: ${GRAFOS.join(', ')}`);
  }
  const nivelEnv = leerVariable('NIVEL_MAXIMO');
  if (nivelEnv) config.motor.nivel_maximo = nivelEnv;
  if (!esNivel(config.motor.nivel_maximo)) {
    throw new Error(`motor.nivel_maximo desconocido: "${config.motor.nivel_maximo}". Valores válidos: ${NOMBRES_DE_NIVEL.join(', ')}`);
  }
  if (!SIN_PRECIO.includes(config.presupuesto.sin_precio)) {
    throw new Error(`presupuesto.sin_precio desconocido: "${config.presupuesto.sin_precio}". Valores válidos: ${SIN_PRECIO.join(', ')}`);
  }
  // Se mira el texto leído: un valor no numérico no debe convertirse en silencio en el de por defecto
  const sinProgreso = leidos.motor.sin_progreso;
  if ((sinProgreso !== undefined && !/^\d+$/.test(sinProgreso)) || !Number.isInteger(config.motor.sin_progreso) || config.motor.sin_progreso < 0) {
    throw new Error(`motor.sin_progreso no válido: "${sinProgreso ?? config.motor.sin_progreso}". Debe ser un entero ≥ 0 (0 desactiva la detección).`);
  }
  // ADR-21. FORGE_IMPLEMENTADOR permite probar el modo por turnos con un modelo real sin editar el proyecto
  const implEnv = leerVariable('IMPLEMENTADOR');
  if (implEnv) config.motor.implementador = implEnv;
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
  if (!MUTACION.includes(config.motor.mutacion)) {
    throw new Error(`motor.mutacion desconocido: "${config.motor.mutacion}". Valores válidos: ${MUTACION.join(', ')}`);
  }
  // Igual que arriba: un valor mal escrito no puede acabar en silencio en el de por defecto
  const minima = leidos.motor.mutacion_minima;
  if ((minima !== undefined && !/^(?:0(?:\.\d+)?|1(?:\.0+)?|\.\d+)$/.test(minima)) || typeof config.motor.mutacion_minima !== 'number' || !(config.motor.mutacion_minima >= 0 && config.motor.mutacion_minima <= 1)) {
    throw new Error(`motor.mutacion_minima no válido: "${minima ?? config.motor.mutacion_minima}". Debe ser un número entre 0 y 1 (0.6 es el 60 %).`);
  }
  for (const clave of ['mutacion_max', 'mutacion_max_archivos', 'mutacion_min_concluyentes', 'mutacion_timeout_s']) {
    const texto = leidos.motor[clave];
    if ((texto !== undefined && !/^\d+$/.test(texto)) || !Number.isInteger(config.motor[clave]) || config.motor[clave] < 1) {
      throw new Error(`motor.${clave} no válido: "${texto ?? config.motor[clave]}". Debe ser un entero ≥ 1.`);
    }
  }
  const topeEnv = leerVariable('BUDGET_USD');
  let topeDelUsuario = false;
  if (topeEnv) {
    const tope = Number(topeEnv);
    if (Number.isFinite(tope) && tope >= 0) { config.presupuesto.tope_usd = tope; topeDelUsuario = true; }
  }
  // El tope de gasto protege al USUARIO: un archivo del proyecto (que puede ser de un repositorio ajeno)
  // puede BAJARLO, nunca subirlo por encima del valor por defecto. Subirlo lo decide el usuario en su
  // entorno (FRAGUA_BUDGET_USD / FORGE_BUDGET_USD) o con --presupuesto-extra al reanudar.
  if (!topeDelUsuario && config.presupuesto.tope_usd > TOPE_POR_DEFECTO_USD) {
    avisarTopeIgnorado(config.presupuesto.tope_usd);
    config.presupuesto.tope_usd = TOPE_POR_DEFECTO_USD;
  }

  // Un valor que pudiera leerse como una opción de docker se rechaza aquí, antes de empezar nada
  config.sandbox.runtime = validarRuntime(config.sandbox.runtime);

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
