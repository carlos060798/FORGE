/**
 * mutacion.js — Medición de las pruebas por mutación propia (ADR-20)
 *
 * Tras un pase, se introducen cambios pequeños y deliberados («alteraciones») en los archivos que
 * escribió el implementador, de uno en uno, y se ejecutan las pruebas contra cada uno. Unas pruebas
 * que comprueban resultados fallan; unas que solo ejecutan el código siguen pasando.
 *
 *  - Generación y selección son funciones puras: la misma entrada da las mismas alteraciones.
 *  - JavaScript se analiza con `acorn` (nunca se toca una cadena ni un comentario). TypeScript que
 *    acorn no entiende, Python y Go usan patrones de texto conservadores sobre una copia del código
 *    con las cadenas y los comentarios tapados.
 *  - La ejecución ocurre sobre una COPIA del proyecto, con el ejecutor aislado de siempre. El
 *    proyecto real no se modifica y nada se ejecuta en el equipo anfitrión.
 *  - No llama a ningún modelo.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { parse } from 'acorn';
import { clasificar } from './router.js';
import { crearCopia, eliminarCopia } from '../sandbox/staging.js';

export const OPERADORES = ['comparacion', 'constante', 'condicion', 'retorno'];

/** Comparaciones y su contraria. */
const INVERSA = { '<': '>=', '>=': '<', '>': '<=', '<=': '>', '===': '!==', '!==': '===', '==': '!=', '!=': '==' };

const MAX_TEXTO_LINEA = 160;

/**
 * @typedef {Object} Alteracion
 * @property {string} ruta       ruta relativa (posix) del archivo alterado
 * @property {number} linea      línea (desde 1) donde empieza el cambio
 * @property {'comparacion'|'constante'|'condicion'|'retorno'} operador
 * @property {string} antes      la línea original, recortada
 * @property {string} despues    la misma línea con el cambio aplicado
 * @property {number} inicio     posición del primer carácter sustituido
 * @property {number} fin        posición siguiente al último carácter sustituido
 * @property {string} texto      texto que sustituye a [inicio, fin)
 */

/**
 * @param {string} ruta
 * @returns {'javascript'|'typescript'|'python'|'go'|null}
 */
export function lenguajeDe(ruta) {
  const m = /\.([a-z]+)$/i.exec(ruta);
  const ext = m ? m[1].toLowerCase() : '';
  if (['js', 'mjs', 'cjs', 'jsx'].includes(ext)) return 'javascript';
  if (['ts', 'mts', 'cts', 'tsx'].includes(ext)) return 'typescript';
  if (ext === 'py') return 'python';
  if (ext === 'go') return 'go';
  return null;
}

/**
 * @param {string} contenido
 * @param {{ inicio: number, fin: number, texto: string }} alteracion
 */
export function aplicarAlteracion(contenido, alteracion) {
  return contenido.slice(0, alteracion.inicio) + alteracion.texto + contenido.slice(alteracion.fin);
}

/** Línea `n` (desde 1) de un texto, recortada. */
function lineaDe(texto, n) {
  const linea = (texto.split('\n')[n - 1] ?? '').replace(/\r$/, '').trim();
  return linea.length > MAX_TEXTO_LINEA ? linea.slice(0, MAX_TEXTO_LINEA) + '…' : linea;
}

/**
 * Completa y ordena las alteraciones crudas de un archivo: línea, texto antes y después,
 * sin duplicados (dos operadores pueden proponer el mismo cambio) y por posición.
 * @param {string} ruta
 * @param {string} contenido
 * @param {{ operador: string, inicio: number, fin: number, texto: string }[]} crudas
 * @returns {Alteracion[]}
 */
function completar(ruta, contenido, crudas) {
  const vistas = new Set();
  /** @type {Alteracion[]} */
  const salida = [];
  const ordenadas = [...crudas].sort((a, b) => a.inicio - b.inicio || a.fin - b.fin
    || OPERADORES.indexOf(a.operador) - OPERADORES.indexOf(b.operador) || (a.texto < b.texto ? -1 : a.texto > b.texto ? 1 : 0));
  for (const c of ordenadas) {
    if (c.inicio < 0 || c.fin <= c.inicio || c.fin > contenido.length) continue;
    if (contenido.slice(c.inicio, c.fin) === c.texto) continue;
    const clave = `${c.inicio}:${c.fin}:${c.texto}`;
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    const linea = contenido.slice(0, c.inicio).split('\n').length;
    salida.push({
      ruta, linea, operador: /** @type {any} */ (c.operador),
      antes: lineaDe(contenido, linea), despues: lineaDe(aplicarAlteracion(contenido, c), linea),
      inicio: c.inicio, fin: c.fin, texto: c.texto,
    });
  }
  return salida;
}

// ── JavaScript (y TypeScript que acorn entiende): árbol sintáctico ───────────

/** @param {string} contenido */
function analizar(contenido) {
  for (const sourceType of /** @type {const} */ (['module', 'script'])) {
    try {
      /** @type {any[]} */
      const tokens = [];
      const ast = parse(contenido, {
        ecmaVersion: 'latest', sourceType, onToken: tokens, allowHashBang: true,
        allowReturnOutsideFunction: sourceType === 'script',
      });
      return { ast, tokens };
    } catch { /* se prueba el siguiente modo */ }
  }
  return null;
}

/** @param {any} nodo @param {any} padre @param {(n: any, p: any) => void} visitar */
function recorrer(nodo, padre, visitar) {
  visitar(nodo, padre);
  for (const clave of Object.keys(nodo)) {
    const valor = nodo[clave];
    if (Array.isArray(valor)) {
      for (const hijo of valor) if (hijo && typeof hijo.type === 'string') recorrer(hijo, nodo, visitar);
    } else if (valor && typeof valor.type === 'string') {
      recorrer(valor, nodo, visitar);
    }
  }
}

/** Valor que sustituye al devuelto: siempre distinto del original. */
function retornoJs(texto) {
  if (texto === 'true') return 'false';
  if (texto === 'false') return 'true';
  if (texto === 'null') return '1';
  return 'null';
}

/**
 * @param {string} contenido
 * @returns {{ operador: string, inicio: number, fin: number, texto: string }[] | null}  null si acorn no puede analizarlo
 */
function crudasJs(contenido) {
  const analizado = analizar(contenido);
  if (!analizado) return null;
  const { ast, tokens } = analizado;
  const crudas = [];

  recorrer(ast, null, (n, padre) => {
    if (n.type === 'BinaryExpression' && INVERSA[n.operator]) {
      // El operador es el token que queda entre los dos operandos (los comentarios no son tokens)
      const tk = tokens.find((t) => t.start >= n.left.end && t.end <= n.right.start && t.value === n.operator);
      if (tk) crudas.push({ operador: 'comparacion', inicio: tk.start, fin: tk.end, texto: INVERSA[n.operator] });
    } else if (n.type === 'Literal') {
      // La clave de una propiedad no es un valor: cambiarla altera el nombre, no una constante
      const esClave = padre && ['Property', 'MethodDefinition', 'PropertyDefinition'].includes(padre.type) && padre.key === n && !padre.computed;
      if (esClave) return;
      if (typeof n.value === 'boolean') {
        crudas.push({ operador: 'constante', inicio: n.start, fin: n.end, texto: String(!n.value) });
      } else if (typeof n.value === 'number' && Number.isFinite(n.value) && n.value + 1 !== n.value) {
        crudas.push({ operador: 'constante', inicio: n.start, fin: n.end, texto: String(n.value + 1) });
      }
    } else if ((n.type === 'IfStatement' || n.type === 'WhileStatement' || n.type === 'DoWhileStatement') && n.test) {
      crudas.push({ operador: 'condicion', inicio: n.test.start, fin: n.test.end, texto: `!(${contenido.slice(n.test.start, n.test.end)})` });
    } else if (n.type === 'ReturnStatement' && n.argument) {
      crudas.push({ operador: 'retorno', inicio: n.argument.start, fin: n.argument.end, texto: retornoJs(contenido.slice(n.argument.start, n.argument.end)) });
    } else if (n.type === 'ArrowFunctionExpression' && n.expression && n.body) {
      // `(a, b) => a + b` devuelve su cuerpo: es un retorno sin la palabra
      const original = contenido.slice(n.body.start, n.body.end);
      crudas.push({ operador: 'retorno', inicio: n.body.start, fin: n.body.end, texto: retornoJs(original) });
    }
  });
  return crudas;
}

// ── Patrones de texto (Python, Go y TypeScript con tipos) ────────────────────

/**
 * Copia del código, de la misma longitud, con los comentarios sustituidos por espacios y el
 * interior de las cadenas por «_». Los patrones se buscan aquí y se aplican sobre el original:
 * así nada de lo que hay en una cadena o en un comentario se puede alterar.
 * @param {string} contenido
 * @param {'python'|'go'|'typescript'} lenguaje
 * @returns {string}
 */
export function enmascarar(contenido, lenguaje) {
  const s = contenido.split('');
  const n = s.length;
  const tapar = (i, c) => { if (s[i] !== '\n' && s[i] !== '\r') s[i] = c; };
  let i = 0;
  while (i < n) {
    const c = contenido[i];
    const par = contenido.slice(i, i + 2);
    // Comentarios
    if ((lenguaje === 'python' && c === '#') || (lenguaje !== 'python' && par === '//')) {
      while (i < n && contenido[i] !== '\n') tapar(i++, ' ');
      continue;
    }
    if (lenguaje !== 'python' && par === '/*') {
      const fin = contenido.indexOf('*/', i + 2);
      const hasta = fin === -1 ? n : fin + 2;
      while (i < hasta) tapar(i++, ' ');
      continue;
    }
    // Cadenas
    const triple = lenguaje === 'python' && (contenido.startsWith('"""', i) || contenido.startsWith("'''", i)) ? contenido.slice(i, i + 3) : null;
    if (triple) {
      const fin = contenido.indexOf(triple, i + 3);
      const hasta = fin === -1 ? n : fin;
      for (let k = i + 3; k < hasta; k++) tapar(k, '_');
      i = fin === -1 ? n : fin + 3;
      continue;
    }
    if (c === '"' || c === "'" || (lenguaje !== 'python' && c === '`')) {
      const multilinea = c === '`';
      const sinEscapes = lenguaje === 'go' && c === '`';
      let k = i + 1;
      while (k < n && contenido[k] !== c) {
        if (!multilinea && contenido[k] === '\n') break;   // cadena sin cerrar: no pasa de la línea
        if (!sinEscapes && contenido[k] === '\\' && k + 1 < n) { tapar(k, '_'); k++; }
        tapar(k, '_');
        k++;
      }
      i = k + 1;
      continue;
    }
    i++;
  }
  return s.join('');
}

/** ¿Paréntesis, corchetes y llaves bien cerrados, sin cerrar nada que no se abrió? */
function equilibrado(texto) {
  const pila = [];
  const cierra = { ')': '(', ']': '[', '}': '{' };
  for (const c of texto) {
    if (c === '(' || c === '[' || c === '{') pila.push(c);
    else if (c in cierra && pila.pop() !== cierra[c]) return false;
  }
  return pila.length === 0;
}

const BOOLEANOS = {
  python:     { True: 'False', False: 'True' },
  go:         { true: 'false', false: 'true' },
  typescript: { true: 'false', false: 'true' },
};

/** Líneas que declaran, no calculan: importaciones y tipos. */
const LINEA_DECLARATIVA = {
  python:     /^\s*(?:import|from)\b|^\s*@/,
  go:         /^\s*(?:import|package|type)\b/,
  typescript: /^\s*(?:import|export\s+(?:type|interface|\*)|type|interface|declare)\b|^\s*@/,
};

/**
 * @param {string} contenido
 * @param {'python'|'go'|'typescript'} lenguaje
 * @returns {{ operador: string, inicio: number, fin: number, texto: string }[]}
 */
function crudasTexto(contenido, lenguaje) {
  const tapado = enmascarar(contenido, lenguaje);
  const crudas = [];
  let base = 0;

  for (const linea of tapado.split('\n')) {
    const inicioLinea = base;
    base += linea.length + 1;
    if (linea.trim() === '' || LINEA_DECLARATIVA[lenguaje].test(linea)) continue;

    // Comparaciones: solo con espacio a los dos lados (deja fuera genéricos, flechas y desplazamientos)
    for (const m of linea.matchAll(/(?<=\s)(===|!==|==|!=|<=|>=|<|>)(?=\s)/g)) {
      if (lenguaje !== 'typescript' && m[1].length === 3) continue;
      crudas.push({ operador: 'comparacion', inicio: inicioLinea + m.index, fin: inicioLinea + m.index + m[1].length, texto: INVERSA[m[1]] });
    }
    // Constantes: enteros sueltos (ni decimales, ni hexadecimales, ni parte de un nombre) y booleanos
    for (const m of linea.matchAll(/(?<![\w.])\d+(?![\w.])/g)) {
      const valor = Number(m[0]);
      if (!Number.isSafeInteger(valor) || (m[0].length > 1 && m[0].startsWith('0'))) continue;
      crudas.push({ operador: 'constante', inicio: inicioLinea + m.index, fin: inicioLinea + m.index + m[0].length, texto: String(valor + 1) });
    }
    for (const m of linea.matchAll(/(?<![\w.])(?:True|False|true|false)(?![\w.(])/g)) {
      const contrario = BOOLEANOS[lenguaje][m[0]];
      if (contrario) crudas.push({ operador: 'constante', inicio: inicioLinea + m.index, fin: inicioLinea + m.index + m[0].length, texto: contrario });
    }

    // Condición de un if o un while, solo si cabe entera en la línea
    const cond = condicionEn(linea, lenguaje);
    if (cond) {
      const original = contenido.slice(inicioLinea + cond.inicio, inicioLinea + cond.fin);
      crudas.push({ operador: 'condicion', inicio: inicioLinea + cond.inicio, fin: inicioLinea + cond.fin, texto: lenguaje === 'python' ? `not (${original})` : `!(${original})` });
    }

    // Valor devuelto, solo si cabe entero en la línea
    const ret = retornoEn(linea, lenguaje);
    if (ret) {
      const original = contenido.slice(inicioLinea + ret.inicio, inicioLinea + ret.fin);
      const texto = retornoTexto(original, lenguaje);
      if (texto !== null) crudas.push({ operador: 'retorno', inicio: inicioLinea + ret.inicio, fin: inicioLinea + ret.fin, texto });
    }
  }
  return crudas;
}

/** @returns {{ inicio: number, fin: number } | null}  posición de la condición dentro de la línea */
function condicionEn(linea, lenguaje) {
  let m;
  if (lenguaje === 'python') {
    m = /^\s*(?:if|elif|while)\s+(.*\S)\s*:\s*$/d.exec(linea);
  } else if (lenguaje === 'go') {
    m = /^\s*(?:\}\s*else\s+)?if\s+(.*\S)\s*\{\s*$/d.exec(linea);
    if (!m) {
      // `for cond {` es el while de Go; con `;`, `range` o una asignación es otro tipo de bucle
      m = /^\s*for\s+(.*\S)\s*\{\s*$/d.exec(linea);
      if (m && /;|\brange\b|:=/.test(m[1])) m = null;
    }
  } else {
    m = /^\s*(?:\}\s*else\s+)?(?:if|while)\s*\((.*)\)\s*\{?\s*$/d.exec(linea);
  }
  if (!m || !m.indices) return null;
  let [inicio, fin] = m.indices[1];
  // Go: `if v, ok := m[k]; ok {` — la condición es lo que sigue al último punto y coma
  if (lenguaje === 'go') {
    const corte = linea.lastIndexOf(';', fin - 1);
    if (corte >= inicio) { inicio = corte + 1; while (inicio < fin && /\s/.test(linea[inicio])) inicio++; }
    if (/:=/.test(linea.slice(inicio, fin))) return null;
  }
  const texto = linea.slice(inicio, fin);
  if (texto.trim() === '' || !equilibrado(texto)) return null;
  return { inicio, fin };
}

/** @returns {{ inicio: number, fin: number } | null}  posición del valor devuelto dentro de la línea */
function retornoEn(linea, lenguaje) {
  const m = lenguaje === 'typescript'
    ? /^\s*return[ \t]+(\S.*?)\s*;?\s*$/d.exec(linea)
    : /^\s*return[ \t]+(\S.*?)\s*$/d.exec(linea);
  if (!m || !m.indices) return null;
  const [inicio, fin] = m.indices[1];
  if (!equilibrado(linea.slice(inicio, fin))) return null;
  return { inicio, fin };
}

/** Texto que sustituye al valor devuelto, o null si en ese lenguaje no se puede sustituir con seguridad. */
function retornoTexto(original, lenguaje) {
  if (lenguaje === 'python') {
    if (original === 'True') return 'False';
    if (original === 'False') return 'True';
    return original === 'None' ? '1' : 'None';
  }
  if (lenguaje === 'go') {
    // Go tiene tipos: sin conocer el del resultado solo se puede invertir un booleano
    if (original === 'true') return 'false';
    if (original === 'false') return 'true';
    return null;
  }
  return retornoJs(original);
}

// ── Generación y selección ───────────────────────────────────────────────────

/**
 * Todas las alteraciones posibles de un archivo, por orden de posición.
 * Un archivo de un lenguaje no cubierto, o que no se puede analizar, no da ninguna.
 * @param {string} ruta
 * @param {string} contenido
 * @returns {Alteracion[]}
 */
export function generarAlteraciones(ruta, contenido) {
  const lenguaje = lenguajeDe(ruta);
  if (!lenguaje || typeof contenido !== 'string' || contenido === '') return [];
  let crudas = null;
  if (lenguaje === 'javascript' || lenguaje === 'typescript') crudas = crudasJs(contenido);
  // JavaScript que acorn no entiende (JSX, sintaxis rota) no se altera a ciegas; TypeScript con tipos sí, por patrones
  if (crudas === null) crudas = lenguaje === 'javascript' ? [] : crudasTexto(contenido, /** @type {any} */ (lenguaje));
  return completar(ruta, contenido, crudas);
}

/**
 * Elige como mucho `max` alteraciones con un salto uniforme: reparte la muestra por todos los
 * archivos y posiciones en lugar de quedarse con las primeras.
 * @template T
 * @param {T[]} candidatas  ya ordenadas
 * @param {number} max
 * @returns {T[]}
 */
export function seleccionar(candidatas, max) {
  const tope = Math.max(0, Math.floor(max));
  if (candidatas.length <= tope) return [...candidatas];
  const elegidas = [];
  for (let i = 0; i < tope; i++) elegidas.push(candidatas[Math.floor((i * candidatas.length) / tope)]);
  return elegidas;
}

/**
 * Alteraciones candidatas de un conjunto de archivos, ordenadas por archivo y posición.
 * @param {{ ruta: string, contenido: string }[]} archivos
 * @returns {Alteracion[]}
 */
export function alteracionesDe(archivos) {
  return [...archivos]
    .sort((a, b) => (a.ruta < b.ruta ? -1 : a.ruta > b.ruta ? 1 : 0))
    .flatMap((a) => generarAlteraciones(a.ruta, a.contenido));
}

/**
 * @param {number} probadas
 * @param {number} detectadas
 * @returns {number|null}  null si no se probó ninguna: no se inventa una puntuación
 */
export function puntuar(probadas, detectadas) {
  return probadas > 0 ? detectadas / probadas : null;
}

// ── Ejecución ────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ResultadoMutacion
 * @property {number} probadas
 * @property {number} detectadas
 * @property {number|null} puntuacion       detectadas / probadas; null si no se llegó a probar ninguna
 * @property {boolean} parcial              no se probaron todas las alteraciones posibles
 * @property {'tope_alteraciones'|'tiempo'|'infraestructura'} [motivoParcial]
 * @property {number} candidatas            alteraciones posibles antes de aplicar el tope
 * @property {{ ruta: string, linea: number, operador: string, antes: string, despues: string }[]} sobrevivientes
 * @property {string} [detalleInfra]        cola del error del entorno, si lo hubo
 */

/**
 * Mide cuántas alteraciones detectan las pruebas.
 *
 * Cada alteración se escribe en una copia temporal del proyecto (con los mismos vetos que la copia
 * de trabajo del entorno aislado) y se llama a `runner.test(copia)`. La copia se borra siempre.
 *
 * `archivos` son las rutas relativas de los archivos que escribió el implementador. `huellasPruebas`
 * evita reutilizar un avance medido con otras pruebas. `avance` guarda el resultado de cada
 * alteración ya probada, para no repetirla si el proceso se corta.
 *
 * @param {{
 *   cwd: string,
 *   archivos: string[],
 *   runner: { test: (cwd: string) => Promise<any> },
 *   max?: number,
 *   timeoutMs?: number,
 *   excluir?: string[],
 *   huellasPruebas?: string[],
 *   alProbar?: (evento: { indice: number, total: number, alteracion: Alteracion, resultado: 'detectada'|'sobrevive'|'sin_resultado', categoria: string, durationMs: number, reutilizada: boolean }) => void,
 *   avance?: { leer: () => any, guardar: (dato: any) => void },
 *   ahora?: () => number,
 *   dirTemporal?: string,
 * }} entrada
 * @returns {Promise<ResultadoMutacion|null>}  null si no hay ninguna alteración posible
 */
export async function medirMutacion(entrada) {
  const { cwd, runner } = entrada;
  const max       = entrada.max ?? 10;
  const timeoutMs = entrada.timeoutMs ?? 300_000;
  const ahora     = entrada.ahora ?? Date.now;

  /** @type {{ ruta: string, contenido: string }[]} */
  const fuentes = [];
  for (const ruta of [...new Set(entrada.archivos)]) {
    if (!lenguajeDe(ruta)) continue;
    try { fuentes.push({ ruta, contenido: fs.readFileSync(path.resolve(cwd, ruta), 'utf8') }); } catch { /* ya no existe: no se mide */ }
  }
  const candidatas = alteracionesDe(fuentes);
  if (candidatas.length === 0) return null;
  const elegidas = seleccionar(candidatas, max);
  const contenidoDe = new Map(fuentes.map((f) => [f.ruta, f.contenido]));

  // Un avance guardado solo vale si se midió exactamente lo mismo: mismo código, mismas pruebas, misma muestra
  const clave = createHash('sha256').update(JSON.stringify({
    fuentes: fuentes.map((f) => [f.ruta, createHash('sha256').update(f.contenido).digest('hex')]),
    pruebas: entrada.huellasPruebas ?? [],
    elegidas: elegidas.map((a) => [a.ruta, a.inicio, a.fin, a.texto]),
  })).digest('hex');
  const guardado = entrada.avance?.leer();
  /** @type {{ categoria: string, durationMs: number }[]} */
  const hechas = guardado && guardado.clave === clave && Array.isArray(guardado.hechas)
    ? guardado.hechas.filter((h) => h && (h.categoria === 'pass' || h.categoria === 'fail' || h.categoria === 'timeout')).slice(0, elegidas.length)
    : [];

  /** @type {ResultadoMutacion} */
  const r = { probadas: 0, detectadas: 0, puntuacion: null, parcial: candidatas.length > elegidas.length, candidatas: candidatas.length, sobrevivientes: [] };
  if (r.parcial) r.motivoParcial = 'tope_alteraciones';

  const anotar = (indice, categoria, durationMs, reutilizada) => {
    const a = elegidas[indice];
    const detectada = categoria === 'fail' || categoria === 'timeout';
    r.probadas++;
    if (detectada) r.detectadas++;
    else r.sobrevivientes.push({ ruta: a.ruta, linea: a.linea, operador: a.operador, antes: a.antes, despues: a.despues });
    entrada.alProbar?.({ indice, total: elegidas.length, alteracion: a, resultado: detectada ? 'detectada' : 'sobrevive', categoria, durationMs, reutilizada });
  };

  hechas.forEach((h, i) => anotar(i, h.categoria, h.durationMs ?? 0, true));

  if (hechas.length < elegidas.length) {
    const t0 = ahora();
    const copia = fs.mkdtempSync(path.join(entrada.dirTemporal ?? os.tmpdir(), 'forge-mutacion-'));
    try {
      crearCopia(cwd, copia, { excluir: entrada.excluir });
      for (let i = hechas.length; i < elegidas.length; i++) {
        if (ahora() - t0 >= timeoutMs) { r.parcial = true; r.motivoParcial = 'tiempo'; break; }
        const a = elegidas[i];
        const original = /** @type {string} */ (contenidoDe.get(a.ruta));
        const destino  = path.join(copia, a.ruta);
        let ejecucion;
        fs.mkdirSync(path.dirname(destino), { recursive: true });
        fs.writeFileSync(destino, aplicarAlteracion(original, a), 'utf8');
        try {
          ejecucion = await runner.test(copia);
        } finally {
          // La copia vuelve a quedar como el proyecto: la siguiente alteración parte de código sin alterar
          fs.writeFileSync(destino, original, 'utf8');
        }
        const categoria = clasificar(ejecucion, { hayPruebas: true, pruebasIntactas: true });
        if (categoria === 'infra_error') {
          // Ni a favor ni en contra: no se cuenta, y lo medido hasta aquí queda como parcial
          r.parcial = true;
          r.motivoParcial = 'infraestructura';
          r.detalleInfra = String(ejecucion?.stderr ?? '').slice(-400);
          entrada.alProbar?.({ indice: i, total: elegidas.length, alteracion: a, resultado: 'sin_resultado', categoria, durationMs: ejecucion?.durationMs ?? 0, reutilizada: false });
          break;
        }
        hechas.push({ categoria, durationMs: ejecucion?.durationMs ?? 0 });
        entrada.avance?.guardar({ clave, hechas });
        anotar(i, categoria, ejecucion?.durationMs ?? 0, false);
      }
    } finally {
      eliminarCopia(copia);
    }
  }

  r.puntuacion = puntuar(r.probadas, r.detectadas);
  return r;
}
