// @ts-check
/**
 * opciones-independientes.mjs — Opciones de scripts/pruebas-independientes.mjs como funciones puras
 * (spec 2026-10-13-proveedores-agnosticos, F6.1). No lee el entorno real ni sale del proceso:
 * recibe los argumentos y el entorno, y devuelve las opciones o un error con su mensaje.
 */

export const PROVEEDORES = /** @type {const} */ (['anthropic', 'openai', 'ollama', 'stub']);

/** Variable de entorno con la clave de cada proveedor de pago. Ollama (local) y stub no la necesitan. */
export const CLAVE_DE = /** @type {Record<string, string | null>} */ ({
  anthropic: 'ANTHROPIC_API_KEY', openai: 'OPENAI_API_KEY', ollama: null, stub: null,
});

const NIVELES_MODELO = /** @type {const} */ (['alto', 'medio', 'economico']);

/** Opciones que nunca se aceptan: una clave en la línea de comandos queda en el historial y en la lista de procesos. */
const OPCIONES_DE_CLAVE = /^--(clave|api-?key|key|token|secreto|password|contrasena)(=|$)/i;

/** Identificador de modelo: solo caracteres de un identificador (se escribe en un YAML y no puede ser una clave). */
const ID_MODELO = /^[A-Za-z0-9][A-Za-z0-9._:/@-]{0,127}$/;

/**
 * @typedef {object} OpcionesIndependientes
 * @property {'humo'|'real'} modelo
 * @property {string[]|null} proyectos   null = todos
 * @property {number} tope
 * @property {string} nivel
 * @property {string|undefined} salida
 * @property {boolean} conservar
 * @property {boolean} desdeRepo
 * @property {'anthropic'|'openai'|'ollama'|'stub'} proveedor  el que se usa de verdad (en humo, siempre stub)
 * @property {{ alto?: string, medio?: string, economico?: string }} modelos  identificador por nivel; vacío = el del proveedor
 */

/**
 * @param {string[]} args  argumentos sin `node` ni el script
 * @param {Record<string, string|undefined>} env
 * @returns {{ ok: true, opciones: OpcionesIndependientes } | { ok: false, error: string }}
 */
export function analizarOpciones(args, env) {
  for (const a of args) {
    if (OPCIONES_DE_CLAVE.test(a)) return { ok: false, error: 'La clave del proveedor va en el entorno (variable de entorno), nunca en la línea de comandos.' };
  }
  const opt = (/** @type {string} */ n, /** @type {string|undefined} */ d) => { const i = args.indexOf(`--${n}`); return i === -1 ? d : (args[i + 1] ?? d); };
  const flag = (/** @type {string} */ n) => args.includes(`--${n}`);

  const modelo = String(opt('modelo', 'humo'));
  const tope = Number(opt('tope', '0.30'));
  const nivel = String(opt('nivel', 'haiku'));
  if (!['humo', 'real'].includes(modelo)) return { ok: false, error: '--modelo debe ser humo o real' };
  if (!Number.isFinite(tope) || tope <= 0 || tope > 5) return { ok: false, error: '--tope debe ser un número entre 0 y 5 (USD por proyecto)' };
  if (!['haiku', 'sonnet', 'opus'].includes(nivel)) return { ok: false, error: '--nivel debe ser haiku, sonnet u opus' };

  const pedido = opt('proveedor', undefined);
  if (pedido !== undefined && !(/** @type {readonly string[]} */ (PROVEEDORES)).includes(pedido)) {
    return { ok: false, error: `--proveedor debe ser ${PROVEEDORES.join(', ')}` };
  }
  // Sin --proveedor se conserva el comportamiento de siempre: stub en humo, anthropic en real
  const proveedor = /** @type {OpcionesIndependientes['proveedor']} */ (pedido ?? (modelo === 'humo' ? 'stub' : 'anthropic'));
  if (modelo === 'humo' && proveedor !== 'stub') return { ok: false, error: 'El modo humo no gasta ni usa claves: su proveedor es stub. Para usar otro proveedor, --modelo real.' };
  if (modelo === 'real' && proveedor === 'stub') return { ok: false, error: 'El proveedor stub no resuelve tareas: con --modelo real elige anthropic, openai u ollama.' };

  /** @type {OpcionesIndependientes['modelos']} */
  const modelos = {};
  for (const n of NIVELES_MODELO) {
    const v = opt(`modelo-${n}`, undefined);
    if (v === undefined) { if (args.includes(`--modelo-${n}`)) return { ok: false, error: `--modelo-${n} necesita un identificador de modelo` }; continue; }
    if (!ID_MODELO.test(v) || /^sk-/i.test(v)) return { ok: false, error: `--modelo-${n} no es un identificador de modelo válido` };
    modelos[n] = v;
  }

  const variable = CLAVE_DE[proveedor];
  if (modelo === 'real' && variable && !env[variable]) return { ok: false, error: `Con --modelo real y --proveedor ${proveedor} hace falta ${variable} en el entorno.` };

  const lista = opt('proyectos', undefined);
  return {
    ok: true,
    opciones: {
      modelo: /** @type {'humo'|'real'} */ (modelo),
      proyectos: lista === undefined ? null : lista.split(',').map((s) => s.trim()).filter(Boolean),
      tope, nivel,
      salida: opt('salida', undefined),
      conservar: flag('conservar'),
      desdeRepo: flag('desde-repo'),
      proveedor, modelos,
    },
  };
}

/**
 * Entorno con el que se lanza el ciclo. En humo, sin ninguna clave; en real, solo la del proveedor elegido.
 * @param {OpcionesIndependientes} o
 * @param {Record<string, string|undefined>} base
 * @returns {Record<string, string|undefined>}
 */
export function entornoDelCiclo(o, base) {
  const e = { ...base };
  for (const v of Object.values(CLAVE_DE)) if (v && (o.modelo === 'humo' || v !== CLAVE_DE[o.proveedor])) delete e[v];
  e.FORGE_LLM_PROVIDER = o.proveedor;
  if (o.modelo === 'real') {
    e.FORGE_NIVEL_MAXIMO = o.nivel;
    e.FORGE_BUDGET_USD = String(o.tope);
  } else {
    e.FORGE_BUDGET_USD = '0.05';
  }
  return e;
}

/**
 * Contenido de `.sdd/sdd.config.yaml` con la sección `modelos:`, o null si no se pidió ningún modelo.
 * @param {OpcionesIndependientes['modelos']} modelos
 */
export function configDeModelos(modelos) {
  const lineas = NIVELES_MODELO.filter((n) => modelos[n]).map((n) => `  ${n}: ${modelos[n]}`);
  return lineas.length ? `modelos:\n${lineas.join('\n')}\n` : null;
}

/** Cabecera del informe sobre proveedor y modelos. */
export function descripcionDeProveedor(/** @type {OpcionesIndependientes} */ o) {
  const m = NIVELES_MODELO.filter((n) => o.modelos[n]).map((n) => `${n}=${o.modelos[n]}`).join(', ');
  return `${o.proveedor} (${m || 'modelos por defecto del proveedor'})`;
}
