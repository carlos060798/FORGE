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
import { createHash, randomBytes } from 'node:crypto';
import { parse } from 'acorn';
import { clasificar } from './router.js';
import { redactar, cola } from './redactar.js';
import { validarRuta } from './protocolo-archivos.js';
import { crearCopia, eliminarCopia } from '../sandbox/staging.js';
import { dividirComando } from '../sandbox/sandbox-runner.js';

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

/**
 * Línea `n` (desde 1) de un texto, sin secretos y recortada. Se redacta ANTES de recortar: un
 * secreto partido por el recorte perdería su cabecera y pasaría (H-09). Va al registro, a la
 * revisión y al prompt del agente de pruebas.
 */
function lineaDe(texto, n) {
  const linea = redactar((texto.split('\n')[n - 1] ?? '').replace(/\r$/, '').trim());
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

// ── Alcance: lo que la tarea cambió en un archivo que ya existía ─────────────

/**
 * Por encima de este número de diferencias entre dos versiones no se busca la comparación exacta:
 * el tramo que no se pudo comparar cuenta entero como cambiado (nunca se deja de medir por esto).
 */
const MAX_DIFERENCIAS = 2000;

/** Líneas de un texto sin el retorno de carro final: CRLF y LF son la misma línea. */
const enLineas = (texto) => texto.split('\n').map((l) => (l.endsWith('\r') ? l.slice(0, -1) : l));

/**
 * Comparación de dos listas de líneas (algoritmo de Myers: subsecuencia común máxima), propia,
 * determinista y sin dependencias.
 * @param {string[]} a  versión original
 * @param {string[]} b  versión nueva
 * @returns {{ cambiadas: number[], borradas: number[] }}  `cambiadas`: líneas (desde 1) de `b` que no
 *   están en `a`; `borradas`: líneas de `b` (desde 1; puede ser la siguiente a la última) justo antes
 *   de las cuales se quitaron líneas de `a`
 */
function diferencia(a, b) {
  let ini = 0;
  while (ini < a.length && ini < b.length && a[ini] === b[ini]) ini++;
  let finA = a.length;
  let finB = b.length;
  while (finA > ini && finB > ini && a[finA - 1] === b[finB - 1]) { finA--; finB--; }
  const n = finA - ini;
  const m = finB - ini;
  /** @type {number[]} */
  const cambiadas = [];
  /** @type {number[]} */
  const borradas = [];
  const todoElTramo = () => { for (let j = ini; j < finB; j++) cambiadas.push(j + 1); };
  if (n === 0) { todoElTramo(); return { cambiadas, borradas }; }
  if (m === 0) { borradas.push(ini + 1); return { cambiadas, borradas }; }

  const tope = Math.min(n + m, MAX_DIFERENCIAS);
  const off = tope + 1;
  const v = new Int32Array(2 * tope + 3);
  /** @type {Int32Array[]} */
  const pasos = [];       // pasos[d]: v[-d..d] al terminar el paso d
  let total = -1;
  for (let d = 0; d <= tope && total < 0; d++) {
    for (let k = -d; k <= d; k += 2) {
      let x = (k === -d || (k !== d && v[off + k - 1] < v[off + k + 1])) ? v[off + k + 1] : v[off + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[ini + x] === b[ini + y]) { x++; y++; }
      v[off + k] = x;
      if (x >= n && y >= m) { total = d; break; }
    }
    pasos.push(v.slice(off - d, off + d + 1));
  }
  if (total < 0) {
    // Demasiadas diferencias: el tramo entero cuenta como cambiado
    todoElTramo();
    borradas.push(ini + 1);
    return { cambiadas, borradas };
  }

  // Se desanda el camino: lo que se recorre en diagonal son líneas iguales
  const igual = new Uint8Array(m);
  let x = n;
  let y = m;
  for (let d = total; d > 0; d--) {
    const previo = pasos[d - 1];
    const en = (k) => previo[k + d - 1];
    const k = x - y;
    const esAlta = k === -d || (k !== d && en(k - 1) < en(k + 1));
    const kPrevio = esAlta ? k + 1 : k - 1;
    const xPrevio = en(kPrevio);
    const yPrevio = xPrevio - kPrevio;
    const xMedio = esAlta ? xPrevio : xPrevio + 1;
    while (x > xMedio) { x--; y--; igual[y] = 1; }
    if (!esAlta) borradas.push(ini + yPrevio + 1);
    x = xPrevio;
    y = yPrevio;
  }
  while (x > 0 && y > 0) { x--; y--; igual[y] = 1; }

  for (let j = 0; j < m; j++) if (!igual[j]) cambiadas.push(ini + j + 1);
  return { cambiadas, borradas: [...new Set(borradas)].sort((p, q) => p - q) };
}

/**
 * Líneas (desde 1) de `nuevo` que la tarea cambió o añadió respecto de `original`. Quitar una línea
 * no cambia ninguna de las que quedan.
 * @param {string} original
 * @param {string} nuevo
 * @returns {number[]}  en orden creciente
 */
export function lineasCambiadas(original, nuevo) {
  return diferencia(enLineas(original), enLineas(nuevo)).cambiadas;
}

/**
 * Líneas de `nuevo` en las que se puede alterar cuando el archivo ya existía antes de la tarea: las
 * que la tarea cambió o añadió y, como margen, la función que las contiene. El margen solo se
 * aplica si `acorn` entiende el archivo (JavaScript y TypeScript sin sintaxis de tipos): es la
 * función de varias líneas más pequeña que contiene la línea (una flecha de una sola línea no
 * cuenta). En Python, Go y TypeScript con tipos son solo las líneas cambiadas.
 * @param {string} ruta
 * @param {string} original
 * @param {string} nuevo
 * @returns {number[]}  en orden creciente
 */
export function alcanceDeLaTarea(ruta, original, nuevo) {
  const { cambiadas, borradas } = diferencia(enLineas(original), enLineas(nuevo));
  const alcance = new Set(cambiadas);
  const lenguaje = lenguajeDe(ruta);
  const analizado = (cambiadas.length > 0 || borradas.length > 0) && (lenguaje === 'javascript' || lenguaje === 'typescript') ? analizar(nuevo) : null;
  if (analizado) {
    // Posición de cada salto de línea, para pasar de posición a número de línea
    const saltos = [];
    for (let i = nuevo.indexOf('\n'); i !== -1; i = nuevo.indexOf('\n', i + 1)) saltos.push(i);
    const lineaDePos = (pos) => {
      let lo = 0;
      let hi = saltos.length;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (saltos[mid] < pos) lo = mid + 1; else hi = mid; }
      return lo + 1;
    };
    /** @type {{ desde: number, hasta: number }[]} */
    const funciones = [];
    recorrer(analizado.ast, null, (nodo) => {
      if (nodo.type !== 'FunctionDeclaration' && nodo.type !== 'FunctionExpression' && nodo.type !== 'ArrowFunctionExpression') return;
      const desde = lineaDePos(nodo.start);
      const hasta = lineaDePos(nodo.end - 1);
      if (hasta > desde) funciones.push({ desde, hasta });
    });
    /** La función de varias líneas más pequeña que cumple la condición. */
    const menor = (cumple) => {
      let elegida = null;
      for (const f of funciones) {
        if (cumple(f) && (elegida === null || f.hasta - f.desde < elegida.hasta - elegida.desde)) elegida = f;
      }
      return elegida;
    };
    const incluir = (f) => { if (f) for (let l = f.desde; l <= f.hasta; l++) alcance.add(l); };
    for (const l of cambiadas) incluir(menor((f) => f.desde <= l && l <= f.hasta));
    // Una línea quitada entre la p-1 y la p: cuenta la función que abarca ese hueco
    for (const p of borradas) incluir(menor((f) => f.desde < p && p <= f.hasta));
  }
  return [...alcance].sort((p, q) => p - q);
}

// ── Selección por archivo ────────────────────────────────────────────────────

/**
 * Como `seleccionar`, pero reparte la muestra entre los archivos por rondas: ningún archivo puede
 * quedarse con más de su parte, y lo que un archivo no usa pasa a los demás (H-02). Así un archivo
 * lleno de alteraciones (cables trampa, constantes autocomprobadas) no diluye la puntuación de los
 * demás. Dentro de cada archivo, salto uniforme. El resultado queda ordenado por ruta y posición.
 * @template {{ ruta: string }} T
 * @param {T[]} candidatas  ya ordenadas por archivo y posición
 * @param {number} max
 * @returns {T[]}
 */
export function seleccionarPorArchivo(candidatas, max) {
  const tope = Math.max(0, Math.floor(max));
  /** @type {Map<string, T[]>} */
  const porArchivo = new Map();
  for (const c of candidatas) {
    const lista = porArchivo.get(c.ruta);
    if (lista) lista.push(c); else porArchivo.set(c.ruta, [c]);
  }
  const rutas = [...porArchivo.keys()].sort();
  const cuota = new Map(rutas.map((r) => [r, 0]));
  let restante = Math.min(tope, candidatas.length);
  while (restante > 0) {
    let repartido = false;
    for (const r of rutas) {
      if (restante === 0) break;
      if (/** @type {number} */ (cuota.get(r)) < /** @type {T[]} */ (porArchivo.get(r)).length) {
        cuota.set(r, /** @type {number} */ (cuota.get(r)) + 1);
        restante--;
        repartido = true;
      }
    }
    if (!repartido) break;
  }
  return rutas.flatMap((r) => seleccionar(/** @type {T[]} */ (porArchivo.get(r)), /** @type {number} */ (cuota.get(r))));
}

// ── ¿Qué significa un fallo de las pruebas con la alteración puesta? (H-02, H-03, H-11, N-02) ───

/**
 * Un código de salida distinto de cero no dice que una PRUEBA detectara el cambio: el módulo puede
 * no haberse cargado (cable trampa, importación rota), el código puede no compilar o no parsear,
 * o el contenedor puede haber sido matado. Esas alteraciones no son «detectadas» ni
 * «sobrevivientes»: son no concluyentes y quedan fuera del denominador.
 *
 * N-02: tampoco basta con que una prueba «falle». Una prueba sin aserciones no puede detectar nada:
 * si el código bajo prueba lanza una excepción propia (un `Error` de un cable trampa, un
 * `TypeError`, un `panic`), la prueba fallará con la alteración aunque no compruebe ningún valor.
 * Solo cuenta como detección el fallo de una ASERCIÓN (el ejecutor la clasifica como tal). Una
 * excepción que no es de aserción es `excepcion_no_asercion`: no concluyente, fuera del
 * denominador. Donde la salida no permita distinguirlo con certeza, falla cerrado (no detectada).
 *
 * Límite conocido: una guardia que lance deliberadamente un `AssertionError` (p. ej.
 * `new assert.AssertionError(...)`, o un `assert` de Python en el código bajo prueba) es
 * indistinguible por clase de una aserción de la prueba. Es un implementador adversario deliberado:
 * ver ADR-20.
 *
 * Se reconoce por la forma de la salida del ejecutor (TAP de node:test, jest, vitest, pytest,
 * unittest, go test). Si no se reconoce ningún fallo de prueba, NO se cuenta como detectada.
 *
 * @typedef {'prueba'|'excepcion_no_asercion'|'no_compila'|'no_carga'|'sin_senal'} SenalDeFallo
 */

const ES_ARCHIVO_JS = /\.(?:[cm]?[jt]sx?)$/i;

/** Secuencias de color (SGR): vitest y jest las escriben cuando el entorno lo permite, y parten «FAIL » y «Tests ». */
const COLOR_ANSI = /\u001b\[[0-9;]*m/g;

/** Primera línea de un mensaje de fallo de jest o vitest que es de una aserción (no de una excepción). */
const ES_MENSAJE_DE_ASERCION = /^(?:expect\b|assert\b|(?:\w+\.)*(?:Jest)?AssertionError\b|Expected\b|Received\b)/;

/**
 * Fallos de prueba de jest (`● suite › prueba`) y vitest (`FAIL  archivo > prueba`): cuántos hay
 * y si su mensaje es de aserción.
 * @param {string} salida
 * @returns {{ asercion: number, otra: number, sinMensaje: number }}
 */
function fallosJestVitest(salida) {
  const cab = /^[ \t]*(?:● (?!Test suite failed to run|Console\b)\S|FAIL[ \t]+\S+[ \t]+>[ \t]+\S).*$/gm;
  const marcas = [...salida.matchAll(cab)].map((m) => ({ ini: m.index ?? 0, fin: (m.index ?? 0) + m[0].length }));
  const limite = /^[ \t]*(?:Test Suites:|Tests:?[ \t]|Test Files|⎯{3,})/gm;
  const cortes = [...salida.matchAll(limite)].map((m) => m.index ?? 0);
  const r = { asercion: 0, otra: 0, sinMensaje: 0 };
  marcas.forEach((m, i) => {
    const tope = Math.min(marcas[i + 1]?.ini ?? Infinity, cortes.find((c) => c > m.fin) ?? Infinity, salida.length);
    const primera = salida.slice(m.fin, tope).split(/\r?\n/).map((l) => l.trim()).find((l) => l !== '');
    if (primera === undefined) r.sinMensaje++;
    else if (ES_MENSAJE_DE_ASERCION.test(primera)) r.asercion++;
    else r.otra++;
  });
  return r;
}

/**
 * @param {string} salida
 * @returns {SenalDeFallo}
 */
function senalJs(salida) {
  // node:test. La medición ejecuta SIEMPRE con el reporter TAP fijado (`comandoConReporterTap`): el ejecutor
  // antepone `# ` a lo que escribe el módulo, así que este análisis no se puede suplantar con console.log.
  // Se exige la estructura del ejecutor y su resumen (N-09, N4-06):
  //  - bloques `not ok 3 - nombre` seguidos del YAML del ejecutor (`---`, y `duration_ms:` o `failureType:`)
  //  - el resumen `# fail N` con N ≥ 1 y no más que los bloques encontrados
  // El reporter spec, dot o junit NO se reconoce: sin señal (falla cerrado; nada cuenta como detectado).
  // N-02: el YAML del ejecutor lleva `code: 'ERR_ASSERTION'` solo si lo que falló fue una aserción.
  /** @type {{ nombre: string, asercion: boolean }[]} */
  let bloques = [];
  const lineas = salida.split('\n');
  for (let i = 0; i < lineas.length; i++) {
    const m = /^([ \t]*)not ok \d+ - (.+?)(?:[ \t]+#.*)?\r?$/.exec(lineas[i]);
    if (!m || !new RegExp('^' + m[1] + '[ \\t]+---[ \\t]*\\r?$').test(lineas[i + 1] ?? '')) continue;
    /** @type {string[]} */
    const yaml = [];
    const fin = new RegExp('^' + m[1] + '[ \\t]+\\.\\.\\.[ \\t]*\\r?$');
    for (let j = i + 2; j < lineas.length && !fin.test(lineas[j]); j++) {
      if (!lineas[j].startsWith(m[1] + ' ')) break;
      yaml.push(lineas[j].replace(/\r$/, ''));
    }
    if (!yaml.slice(0, 4).some((l) => /^\s*(?:duration_ms|failureType):/.test(l))) continue;
    const clave = m[1] + '  ';
    bloques.push({ nombre: m[2].trim(), asercion: yaml.some((l) => l === clave + "code: 'ERR_ASSERTION'") });
  }
  const resumen = [...salida.matchAll(/^# fail (\d+)[ \t]*$/gm)].pop();
  const falloDelEjecutor = resumen !== undefined && Number(resumen[1]) >= 1 && bloques.length >= Number(resumen[1]);
  if (!falloDelEjecutor) bloques = [];
  // Un fallo de CARGA aparece como una «prueba» que se llama como el archivo: ninguna prueba llegó a ejecutarse
  const deprueba = bloques.filter((b) => !ES_ARCHIVO_JS.test(b.nombre));
  if (deprueba.some((b) => b.asercion)) return 'prueba';
  if (deprueba.length > 0) return 'excepcion_no_asercion';
  // jest: `● suite › prueba` y `Tests: 2 failed`; vitest: `FAIL  archivo > prueba` y `Tests  2 failed`
  const jv = fallosJestVitest(salida);
  if (jv.asercion > 0) return 'prueba';
  if (jv.otra > 0) return 'excepcion_no_asercion';
  if (jv.sinMensaje > 0) return 'sin_senal';
  if (/^[ \t]*Tests:?[ \t]+.*\b[1-9]\d* failed\b/m.test(salida)) return 'sin_senal';
  if (/error TS\d+|\bTS\d{4}:|SyntaxError|Unexpected token|Unexpected identifier/.test(salida)) return 'no_compila';
  if (bloques.length > 0 || /Test suite failed to run|Failed Suites|Cannot find module|ERR_MODULE_NOT_FOUND|ERR_REQUIRE_ESM|Failed to (?:load|resolve)/.test(salida)) return 'no_carga';
  return 'sin_senal';
}

/** @param {string} salida @returns {SenalDeFallo} */
function senalPython(salida) {
  let asercion = 0;
  let otra = 0;
  // pytest: bloques `____ test ____` con la línea `E   <excepción>`; o, sin traza, `FAILED ruta::test - <excepción>`
  const ES_ASERCION_PY = /^(?:assert\b|(?:\w+\.)*AssertionError\b|Failed:)/;
  const cab = [...salida.matchAll(/^_{2,} (?!ERROR collecting)(\S.*?) _{2,}$/gm)];
  cab.forEach((m, i) => {
    const desde = (m.index ?? 0) + m[0].length;
    const resto = salida.slice(desde);
    const corte = resto.search(/^={3,}/m);
    const hasta = Math.min((cab[i + 1]?.index ?? Infinity) - desde, corte >= 0 ? corte : Infinity, resto.length);
    const e = /^E[ \t]+(\S.*)$/m.exec(resto.slice(0, hasta));
    if (!e) return;
    if (ES_ASERCION_PY.test(e[1])) asercion++; else otra++;
  });
  if (asercion + otra === 0) {
    for (const m of salida.matchAll(/^FAILED[ \t]+[^\s(]\S*[ \t]+-[ \t]+(.*)$/gm)) {
      if (ES_ASERCION_PY.test(m[1])) asercion++; else otra++;
    }
  }
  // unittest: `FAIL: test_x (…)` es un AssertionError; `ERROR: test_x (…)` es cualquier otra excepción. Un módulo que no se importa es `_FailedTest`
  for (const m of salida.matchAll(/^(FAIL|ERROR): .*$/gm)) {
    if (/_FailedTest/.test(m[0])) continue;
    if (m[1] === 'FAIL') asercion++; else otra++;
  }
  if (asercion > 0) return 'prueba';
  if (otra > 0) return 'excepcion_no_asercion';
  if (/SyntaxError|IndentationError|TabError/.test(salida)) return 'no_compila';
  if (/ImportError|ModuleNotFoundError|errors? during collection|ERROR collecting|Failed to import test module|_FailedTest/.test(salida)) return 'no_carga';
  return 'sin_senal';
}

/** @param {string} salida @returns {SenalDeFallo} */
function senalGo(salida) {
  // `--- FAIL: Test` con su salida de `t.Error`/`t.Fatal` es una aserción de la prueba; si tras ese bloque viene
  // `panic:`, el fallo es el pánico del código (excepción), no una aserción (N-02)
  const lineas = salida.split('\n');
  let asercion = 0;
  let panico = 0;
  lineas.forEach((l, i) => {
    if (!/^[ \t]*--- FAIL:/.test(l)) return;
    let j = i + 1;
    while (j < lineas.length && /^[ \t]/.test(lineas[j])) j++;
    if (j < lineas.length && /^(?:panic:|fatal error:)/.test(lineas[j])) panico++; else asercion++;
  });
  if (asercion > 0) return 'prueba';
  // Un pánico en un init o en una variable de paquete ocurre en la goroutine 1 antes de que corra ninguna
  // prueba: es una carga que falla (cable trampa), no una prueba que detecta. Las pruebas corren en otras goroutines
  if (/^panic:/m.test(salida)) return /^goroutine 1 \[running\]:/m.test(salida) ? 'no_carga' : 'excepcion_no_asercion';
  if (panico > 0) return 'excepcion_no_asercion';
  if (/\[build failed\]|\[setup failed\]|^# \S+[ \t]*$/m.test(salida)) return 'no_compila';
  // Un paquete que no existe falla al preparar la compilación, sin cabecera «# paquete»
  if (/\bpackage \S+ is not in std\b|no required module provides package|cannot find package/.test(salida)) return 'no_compila';
  return 'sin_senal';
}

/**
 * @param {string} salida
 * @param {'javascript'|'typescript'|'python'|'go'|null} lenguaje
 * @returns {SenalDeFallo}
 */
export function senalDeFallo(salida, lenguaje) {
  salida = salida.replace(COLOR_ANSI, '');
  if (lenguaje === 'python') return senalPython(salida);
  if (lenguaje === 'go') return senalGo(salida);
  return senalJs(salida);
}

/** Códigos de salida de un proceso matado (OOM, SIGSEGV): el entorno, no una prueba. */
const CODIGOS_ENTORNO = new Set([137, 139]);

/** @param {any} ejecucion */
export const esMuerteDeEntorno = (ejecucion) => Boolean(ejecucion?.oomKilled) || CODIGOS_ENTORNO.has(ejecucion?.exitCode);

/**
 * @typedef {'detectada'|'sobrevive'|'no_concluyente'} Veredicto
 * @typedef {{ veredicto: Veredicto, motivo?: string }} Juicio
 */

/**
 * Qué dice una ejecución con la alteración puesta. `categoria` es la de `clasificar` (ni `infra_error`,
 * que corta la medición antes de llegar aquí).
 *
 * Decisión sobre el tiempo agotado: cuenta como detectada solo si el ejecutor lo clasificó como
 * tiempo agotado de las pruebas (`timedOut`, sin error de entorno). Un cambio que provoca un bucle
 * infinito es una diferencia de comportamiento real, y la copia sin alterar ya demostró (línea
 * base) que las pruebas terminan a tiempo con el código original.
 *
 * @param {any} ejecucion
 * @param {'pass'|'fail'|'timeout'} categoria
 * @param {'javascript'|'typescript'|'python'|'go'|null} lenguaje
 * @returns {Juicio}
 */
export function juzgar(ejecucion, categoria, lenguaje) {
  if (categoria === 'pass') return { veredicto: 'sobrevive' };
  if (categoria === 'timeout') return { veredicto: 'detectada', motivo: 'tiempo_agotado' };
  if (esMuerteDeEntorno(ejecucion)) return { veredicto: 'no_concluyente', motivo: 'entorno' };
  const salida = `${ejecucion?.stdout ?? ''}\n${ejecucion?.stderr ?? ''}`;
  const senal = senalDeFallo(salida, lenguaje);
  return senal === 'prueba' ? { veredicto: 'detectada', motivo: 'prueba_fallida' } : { veredicto: 'no_concluyente', motivo: senal };
}

// ── Copias temporales huérfanas ──────────────────────────────────────────────

/** Archivo que marca una carpeta como creada por esta medición: sin él, no se toca. */
const MARCA_COPIA = '.forge-mutacion';
const NONCE_MARCA = /^[0-9a-f]{32}$/;

/**
 * Escribe la marca de una carpeta madre: un JSON con la clave de FORGE y un nonce aleatorio. Una
 * carpeta cuyo nombre coincide por casualidad, o con una marca puesta a mano, no pasa `marcaValida` (N-12).
 * @param {string} madre
 */
export function escribirMarcaCopia(madre) {
  const contenido = JSON.stringify({ forge: 'mutacion', nonce: randomBytes(16).toString('hex'), pid: process.pid, creada: new Date().toISOString() });
  fs.writeFileSync(path.join(madre, MARCA_COPIA), contenido + '\n', { mode: 0o600 });
}

/**
 * La marca de FORGE de una carpeta: un archivo normal (no un directorio ni un enlace) con la clave y un
 * nonce. `null` si no la tiene o no es válida.
 * @param {string} madre
 * @returns {{ pid: number } | null}
 */
export function leerMarca(madre) {
  try {
    const abs = path.join(madre, MARCA_COPIA);
    const st = fs.lstatSync(abs);
    if (!st.isFile() || st.isSymbolicLink() || st.size > 1024) return null;
    const m = JSON.parse(fs.readFileSync(abs, 'utf8'));
    const ok = m !== null && typeof m === 'object' && m.forge === 'mutacion' && typeof m.nonce === 'string' && NONCE_MARCA.test(m.nonce) && Number.isInteger(m.pid);
    return ok ? { pid: m.pid } : null;
  } catch { return null; }
}

/**
 * ¿Sigue vivo el proceso que creó la copia? Ante la duda, sí: no se borra la copia de una medición que
 * pueda estar en marcha. Un pid reutilizado por otro proceso solo retrasa el barrido hasta que la copia envejezca.
 * @param {number} pid
 */
export function procesoVivo(pid) {
  if (pid === process.pid) return true;
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; }
  catch (e) { return /** @type {any} */ (e)?.code === 'EPERM'; }
}
const PATRON_COPIA = /^forge-mutacion-[A-Za-z0-9]{6}$/;
const SEIS_HORAS = 6 * 60 * 60 * 1000;

/**
 * Borra las carpetas `forge-mutacion-*` que dejó un proceso cortado (SIGKILL, corte de luz).
 * Solo borra carpetas con el nombre exacto que crea FORGE, que contienen su marca, que no son
 * enlaces y que, o bien las creó un proceso que ya no existe (el pid de la marca), o bien llevan más
 * de `antiguedadMs` sin tocarse. No toca nada de otra herramienta ni la copia de una medición que
 * siga en marcha, aunque sea de otro proyecto.
 * @param {string} [dir]  carpeta temporal (por defecto la del sistema)
 * @param {{ antiguedadMs?: number, ahora?: () => number }} [opciones]
 * @returns {number} carpetas borradas
 */
export function barrerMutacionesHuerfanas(dir = os.tmpdir(), opciones = {}) {
  const antiguedadMs = opciones.antiguedadMs ?? SEIS_HORAS;
  const ahora = opciones.ahora ?? Date.now;
  let nombres;
  try { nombres = fs.readdirSync(dir); } catch { return 0; }
  let borradas = 0;
  for (const nombre of nombres) {
    if (!PATRON_COPIA.test(nombre)) continue;
    const abs = path.join(dir, nombre);
    try {
      const st = fs.lstatSync(abs);
      if (!st.isDirectory() || st.isSymbolicLink()) continue;
      const marca = leerMarca(abs);
      if (!marca) continue;
      // Un proceso muerto (SIGKILL, corte de luz) no va a terminar su medición: su copia sobra ya
      // Un proceso VIVO no pierde su copia nunca por antigüedad (equipo suspendido, medición lenta): N4-02.
      // Un pid reutilizado por otro programa solo retrasa el barrido hasta que ese programa termine.
      if (procesoVivo(marca.pid)) continue;
      void antiguedadMs; void ahora;
      if (eliminarCopia(abs)) borradas++;
    } catch { /* otro proceso la tocó a la vez: se deja */ }
  }
  return borradas;
}

// ── Cobertura de la línea base (N-02) ────────────────────────────────────────

/**
 * Una alteración en una línea que ninguna prueba ejecuta no puede ser detectada ni puede probar nada:
 * solo diluye la muestra. Con la cobertura de la línea base se descartan esas líneas y los archivos
 * que ninguna prueba carga. La cobertura es la del propio ejecutor (sin dependencias nuevas) y solo
 * si la ofrece; si no, la medición sigue como antes y queda marcada `sinCobertura`.
 *
 * Límite que no se oculta: la cobertura no distingue una línea que comprueba algo de una que solo se
 * ejecuta. Un «cable trampa» dentro de una función que el código bajo prueba llama SÍ está cubierto.
 *
 * Una cobertura se representa por archivo como `{ sin: Set }` (líneas no ejecutadas) o `{ ej: Set }`
 * (líneas ejecutadas); un archivo que no aparece no lo ejecuta ninguna prueba.
 * @typedef {{ sin?: Set<number>, ej?: Set<number> }} CoberturaArchivo
 */

const normalizarRuta = (r) => r.replace(/\\/g, '/').replace(/^\.\//, '');

/** @param {string} texto  `3-5 9` o `3-5, 9` → líneas */
function rangosALineas(texto) {
  const lineas = new Set();
  for (const trozo of texto.split(/[\s,]+/)) {
    if (!trozo || trozo.includes('>')) continue;
    const m = /^(\d+)(?:-(\d+))?$/.exec(trozo);
    if (!m) continue;
    const desde = Number(m[1]);
    const hasta = m[2] ? Number(m[2]) : desde;
    // Un informe absurdo no puede llenar la memoria
    for (let l = desde; l <= hasta && l - desde < 200_000; l++) lineas.add(l);
  }
  return lineas;
}

/**
 * Informe de texto de `node --test --experimental-test-coverage` (reporters spec y TAP; tabla plana o
 * en árbol según la versión de Node).
 * @param {string} salida
 * @returns {Map<string, CoberturaArchivo>|null}  null si la salida no trae el informe
 */
export function parsearCoberturaNode(salida) {
  const mapa = new Map();
  let dentro = false;
  let visto = false;
  /** @type {string[]} */
  const pila = [];
  for (const cruda of salida.replace(COLOR_ANSI, '').split('\n')) {
    const linea = cruda.replace(/\r$/, '').replace(/^(?:ℹ |# )/, '');
    if (/start of coverage report/.test(linea)) { dentro = true; visto = true; continue; }
    if (/end of coverage report/.test(linea)) break;
    if (!dentro || /^[\s-]*$/.test(linea)) continue;
    const celdas = linea.split('|');
    if (celdas.length < 5) continue;
    const nombre = celdas[0].trim();
    if (nombre === '' || nombre === 'file' || nombre === 'all files') continue;
    const nivel = celdas[0].length - celdas[0].trimStart().length;
    if (celdas[1].trim() === '') { pila.length = nivel; pila[nivel] = nombre; continue; }
    const ruta = normalizarRuta([...pila.slice(0, nivel), nombre].join('/'));
    mapa.set(ruta, { sin: rangosALineas(celdas[celdas.length - 1]) });
  }
  return visto ? mapa : null;
}

/**
 * Informe de `coverage report -m` (la tabla `Name Stmts Miss Cover Missing`).
 * @param {string} salida
 * @returns {Map<string, CoberturaArchivo>|null}
 */
export function parsearCoberturaPython(salida) {
  const mapa = new Map();
  let dentro = false;
  for (const cruda of salida.split('\n')) {
    const linea = cruda.replace(/\r$/, '');
    if (/^Name\s+Stmts\s+Miss\b/.test(linea)) { dentro = true; continue; }
    if (!dentro) continue;
    if (/^TOTAL\b/.test(linea)) break;
    const m = /^(\S.*?)\s+(\d+)\s+(\d+)(?:\s+\d+\s+\d+)?\s+\d+%(?:\s+(.*))?$/.exec(linea);
    if (m) mapa.set(normalizarRuta(m[1]), { sin: rangosALineas(m[4] ?? '') });
  }
  return dentro ? mapa : null;
}

/**
 * Perfil de `go test -coverprofile=/dev/stdout`: `modulo/pkg/archivo.go:12.3,14.5 2 1`.
 * Línea ejecutada = alguna de sus partes tiene cuenta > 0.
 * @param {string} salida
 * @param {string} [modulo]  ruta del módulo (go.mod) para pasar de ruta de importación a ruta del proyecto
 * @returns {Map<string, CoberturaArchivo>|null}
 */
export function parsearCoberturaGo(salida, modulo = '') {
  const mapa = new Map();
  let visto = false;
  for (const cruda of salida.split('\n')) {
    const linea = cruda.replace(/\r$/, '');
    if (/^mode: (?:set|count|atomic)$/.test(linea)) { visto = true; continue; }
    const m = /^(\S+\.go):(\d+)\.\d+,(\d+)\.\d+ \d+ (\d+)$/.exec(linea);
    if (!m) continue;
    visto = true;
    let ruta = normalizarRuta(m[1]);
    if (modulo && ruta.startsWith(`${modulo}/`)) ruta = ruta.slice(modulo.length + 1);
    let a = mapa.get(ruta);
    if (!a) { a = { ej: new Set() }; mapa.set(ruta, a); }
    if (Number(m[4]) > 0) for (let l = Number(m[2]); l <= Number(m[3]); l++) /** @type {Set<number>} */ (a.ej).add(l);
  }
  return visto ? mapa : null;
}

/** Texto de un argumento para el comando de pruebas (el ejecutor no usa shell: solo comillas). */
const comillas = (p) => (p !== '' && !/[\s"']/.test(p) ? p : !p.includes('"') ? `"${p}"` : `'${p}'`);

/**
 * Las palabras de un comando `node --test` (directo o por un script de package.json) con el reporter
 * TAP fijado: se quita cualquier `--test-reporter` del proyecto y se pone `--test-reporter=tap`.
 * @param {string[]} partes
 * @param {string} testCmd
 * @param {string|null|undefined} packageJson
 * @returns {{ partes: string[] } | { motivo: string }}
 */
function partesNodeTest(partes, testCmd, packageJson) {
  let p = [...partes];
  if (['npm', 'yarn', 'pnpm'].includes(p[0])) {
    const esTest = p[1] === 'test' || (p[1] === 'run' && p[2] === 'test');
    if (!esTest) return { motivo: `el comando «${testCmd}» no es un script de pruebas conocido` };
    let script = null;
    try { script = JSON.parse(packageJson ?? 'null')?.scripts?.test; } catch { /* sin package.json legible */ }
    if (typeof script !== 'string') return { motivo: 'no se pudo leer el script «test» de package.json' };
    try { p = dividirComando(script); } catch (err) { return { motivo: `el script «test» no se puede analizar: ${err instanceof Error ? err.message : err}` }; }
  }
  if (p[0] === 'npx') return { motivo: `el ejecutor «${p.find((x, i) => i > 0 && !x.startsWith('-')) ?? 'npx'}» no ofrece cobertura sin dependencias adicionales` };
  if (p[0] !== 'node') return { motivo: `el ejecutor «${p[0]}» no es node --test` };
  const i = p.indexOf('--test');
  if (i === -1) return { motivo: 'el comando node no usa --test' };
  const limpio = [];
  for (let k = 0; k < p.length; k++) {
    const x = p[k];
    if (/^--test-reporter(?:-destination)?=/.test(x)) continue;
    if (x === '--test-reporter' || x === '--test-reporter-destination') { k++; continue; }
    limpio.push(x);
  }
  limpio.splice(limpio.indexOf('--test') + 1, 0, '--test-reporter=tap');
  return { partes: limpio };
}

/**
 * El comando de pruebas con el reporter TAP fijado explícitamente (N4-06), si es `node --test`.
 * Con otro ejecutor (jest, vitest, pytest, go) no cambia nada: `{ motivo }`.
 * @param {{ lenguaje?: string, testCmd?: string, packageJson?: string|null }} e
 * @returns {{ comando: string } | { motivo: string }}
 */
export function comandoConReporterTap(e) {
  if (e.lenguaje !== 'javascript' && e.lenguaje !== 'typescript') return { motivo: 'no es node --test' };
  if (typeof e.testCmd !== 'string' || e.testCmd.trim() === '') return { motivo: 'no hay comando de pruebas' };
  let partes;
  try { partes = dividirComando(e.testCmd); } catch (err) { return { motivo: err instanceof Error ? err.message : String(err) }; }
  const n = partesNodeTest(partes, e.testCmd, e.packageJson);
  return 'motivo' in n ? n : { comando: n.partes.map(comillas).join(' ') };
}

/**
 * El comando de pruebas del proyecto pasado a su variante con cobertura, o por qué no hay.
 * Solo se usa lo que el propio ejecutor ya trae: nunca se instala nada.
 *  - `node --test` (también por un script de package.json): `--experimental-test-coverage`;
 *  - `go test`: `-coverprofile=/dev/stdout`;
 *  - Python con pytest o unittest: el módulo `coverage`, si la imagen lo tiene (si no, el comando
 *    falla y la medición queda sin cobertura);
 *  - jest, vitest y demás: sin cobertura (su cobertura exige dependencias que no se instalan).
 *
 * @param {{ lenguaje?: string, testCmd?: string, packageJson?: string|null }} e
 * @returns {{ formato: 'node'|'python'|'go', comando: string } | { motivo: string }}
 */
export function comandoConCobertura(e) {
  const { lenguaje, testCmd } = e;
  if (typeof testCmd !== 'string' || testCmd.trim() === '') return { motivo: 'no hay comando de pruebas' };
  let partes;
  try { partes = dividirComando(testCmd); } catch (err) { return { motivo: err instanceof Error ? err.message : String(err) }; }

  if (lenguaje === 'javascript' || lenguaje === 'typescript') {
    const nodo = partesNodeTest(partes, testCmd, e.packageJson);
    if ('motivo' in nodo) return nodo;
    if (!nodo.partes.includes('--experimental-test-coverage')) nodo.partes.splice(nodo.partes.indexOf('--test-reporter=tap') + 1, 0, '--experimental-test-coverage');
    return { formato: 'node', comando: nodo.partes.map(comillas).join(' ') };
  }

  if (lenguaje === 'python') {
    let resto = [...partes];
    if (/^(?:python3?|py)$/.test(resto[0] ?? '') && resto[1] === '-m') resto = resto.slice(2);
    else if (resto[0] === 'pytest') resto = ['pytest', ...resto.slice(1)];
    const [modulo, ...args] = resto;
    // coverage se arranca antes de importar nada; los argumentos van como sys.argv[1:]
    const cabecera = 'import sys,coverage;c=coverage.Coverage(source=[\'.\']);c.start();';
    const cola = 'c.stop();c.report(show_missing=True)';
    let script;
    if (modulo === 'pytest') script = `${cabecera}import pytest;r=pytest.main(sys.argv[1:]);${cola};sys.exit(int(r))`;
    else if (modulo === 'unittest') script = `${cabecera}import unittest;unittest.main(module=None,argv=['unittest']+sys.argv[1:],exit=False);${cola}`;
    else return { motivo: `el ejecutor «${testCmd}» no es pytest ni unittest` };
    return { formato: 'python', comando: ['python', '-c', script, ...args].map(comillas).join(' ') };
  }

  if (lenguaje === 'go') {
    if (partes[0] !== 'go' || partes[1] !== 'test') return { motivo: 'el comando no es go test' };
    if (partes.some((p) => p.startsWith('-coverprofile'))) return { motivo: 'el comando ya fija su propio perfil de cobertura' };
    return { formato: 'go', comando: [...partes.slice(0, 2), '-coverprofile=/dev/stdout', ...partes.slice(2)].map(comillas).join(' ') };
  }
  return { motivo: 'lenguaje sin cobertura soportada' };
}

/**
 * Un ejecutor igual que `runner` pero con otro comando de pruebas, o null si no se sabe hacer.
 * Un ejecutor propio puede ofrecer `conComando(comando)`; el `SandboxRunner` se copia con sus mismas
 * opciones (mismo aislamiento, límites e imagen) cambiando solo el comando.
 * @param {any} runner
 * @param {string} comando
 */
function ejecutorConComando(runner, comando) {
  if (typeof runner?.conComando === 'function') return runner.conComando(comando);
  const o = runner?.o;
  if (o && typeof o === 'object' && typeof o.testCmd === 'string' && typeof runner.constructor === 'function' && typeof o.runId === 'string') {
    const clon = new runner.constructor({ ...o, testCmd: comando, runId: `${o.runId}-cob`, cli: runner.cli ?? o.cli });
    return clon;
  }
  return null;
}

/**
 * @param {Map<string, CoberturaArchivo>} mapa
 * @param {string} ruta
 * @returns {CoberturaArchivo|null}
 */
function coberturaDe(mapa, ruta) {
  const exacta = mapa.get(ruta);
  if (exacta) return exacta;
  // Un informe con rutas absolutas o con un prefijo (p. ej. «copia/src/a.js»)
  for (const [k, v] of mapa) if (k.endsWith(`/${ruta}`)) return v;
  return null;
}

/** @param {CoberturaArchivo|null|undefined} c @param {number} linea */
const lineaEjecutada = (c, linea) => (!c ? false : c.ej ? c.ej.has(linea) : c.sin ? !c.sin.has(linea) : false);

/**
 * @typedef {Object} Instantanea  cobertura guardada con el avance (JSON)
 * @property {boolean} [sinCobertura]
 * @property {string} [motivo]
 * @property {string} [formato]
 * @property {Record<string, { sin?: number[], ej?: number[] }|null>} [archivos]
 */

// ── Ejecución ────────────────────────────────────────────────────────────────

/** Archivos que se miden por medición, si no se indica otra cosa (motor.mutacion_max_archivos). */
export const MAX_ARCHIVOS = 5;

/**
 * @typedef {Object} ResultadoMutacion
 * @property {number} probadas              alteraciones CONCLUYENTES (detectadas + sobrevivientes): el denominador de la puntuación
 * @property {number} detectadas
 * @property {number} noConcluyentes        alteraciones que no se pueden juzgar (no compilan, no cargan, entorno): fuera del denominador
 * @property {number|null} puntuacion       detectadas / probadas; null si no hubo ninguna concluyente
 * @property {boolean} parcial              no se probaron todas las alteraciones posibles
 * @property {'tope_alteraciones'|'tiempo'|'infraestructura'|'linea_base'} [motivoParcial]
 * @property {'ok'|'falla'|'infraestructura'|'no_medida'} lineaBase  la copia sin alterar: debe pasar para que la medición valga
 * @property {number} candidatas            alteraciones posibles antes de aplicar el tope (ya limitadas a lo que cambió la tarea, a lo que ejecutan las pruebas y a los archivos medidos)
 * @property {number} [fueraDeLoCambiado]   alteraciones posibles descartadas por estar en código que la tarea no tocó (solo si hubo alguna)
 * @property {boolean} [sinCobertura]       el ejecutor no ofreció cobertura: la muestra NO está filtrada por lo que ejecutan las pruebas (N-02); no cuenta como evidencia para `exigir`
 * @property {string} [motivoSinCobertura]  por qué no hubo cobertura
 * @property {number} [fueraDeCobertura]    alteraciones posibles descartadas por estar en líneas o archivos que ninguna prueba ejecuta
 * @property {{ ruta: string, lineas: number }[]} [archivosOmitidos]  archivos que no se midieron por el tope de archivos (`maxArchivos`), con sus líneas cambiadas
 * @property {{ ruta: string, probadas: number, detectadas: number }[]} [porArchivo]  cómo se reparten las alteraciones concluyentes entre los archivos
 * @property {{ ruta: string, linea: number, operador: string, antes: string, despues: string }[]} sobrevivientes
 * @property {{ ruta: string, motivo: string }[]} [rechazadas]  rutas que no se midieron por no ser válidas
 * @property {string} [detalleInfra]        cola del error del entorno o de la línea base, si lo hubo
 * @property {boolean} [copiaSinBorrar]     la copia temporal no se pudo borrar del todo
 * @property {number} [huerfanasBorradas]   copias de mediciones cortadas que se barrieron al empezar
 */

/**
 * Mide cuántas alteraciones detectan las pruebas.
 *
 * Primero se ejecuta la copia SIN alterar (línea base): si no pasa, no se mide. Después, cada
 * alteración se escribe en la copia temporal (con los mismos vetos que la copia de trabajo del
 * entorno aislado, y permisos privados) y se llama a `runner.test(copia)`. La copia se borra siempre.
 *
 * Solo las alteraciones concluyentes cuentan: las que no compilan, las que impiden cargar el módulo
 * y las que matan el contenedor se descartan y se sustituyen por otras de la reserva (como mucho
 * `max` más), de forma determinista.
 *
 * `archivos` son las rutas relativas de los archivos que escribió el implementador; la función las
 * valida otra vez (`validarRuta`) y descarta las que salen del proyecto o están vetadas.
 * `huellasPruebas` evita reutilizar un avance medido con otras pruebas. `avance` guarda el
 * resultado de cada alteración ya probada, para no repetirla si el proceso se corta.
 *
 * Cobertura (N-02): tras la línea base se ejecuta una vez la variante con cobertura del comando de
 * pruebas (`comandoConCobertura`) y se descartan las alteraciones en líneas y archivos que ninguna
 * prueba ejecuta. Después, como mucho `maxArchivos` archivos (por defecto 5), los de más líneas
 * cambiadas. `cobertura: null` no la pide; un objeto `{ formato, test }` sustituye al ejecutor con
 * cobertura (pruebas). Sin cobertura la medición sigue como antes y devuelve `sinCobertura: true`.
 *
 * `originalDe` devuelve el contenido que tenía un archivo ANTES de la tarea, o null si es nuevo.
 * Con un archivo que ya existía, solo se altera lo que la tarea cambió (`alcanceDeLaTarea`): las
 * pruebas de una tarea no tienen por qué cubrir el resto del archivo. Sin `originalDe`, o con un
 * archivo nuevo, se altera el archivo entero. `alAcotar` recibe cuántas alteraciones quedaron fuera
 * (también cuando no queda ninguna dentro y la función devuelve null).
 *
 * @param {{
 *   cwd: string,
 *   archivos: string[],
 *   runner: { test: (cwd: string) => Promise<any> },
 *   max?: number,
 *   maxArchivos?: number,
 *   cobertura?: null | { formato: 'node'|'python'|'go', test: (cwd: string) => Promise<any> },
 *   timeoutMs?: number,
 *   excluir?: string[],
 *   vetadas?: string[],
 *   huellasPruebas?: string[],
 *   alProbar?: (evento: { indice: number, total: number, alteracion: Alteracion, resultado: 'detectada'|'sobrevive'|'no_concluyente'|'sin_resultado', categoria: string, motivo?: string, durationMs: number, reutilizada: boolean }) => void,
 *   avance?: { leer: () => any, guardar: (dato: any) => void },
 *   originalDe?: (ruta: string) => string|null|undefined,
 *   alAcotar?: (dato: { candidatas: number, fueraDeLoCambiado: number, archivos: { ruta: string, lineas: number }[] }) => void,
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
  const dirTemporal = entrada.dirTemporal ?? os.tmpdir();

  // Las rutas se validan aquí, no solo en quien llama: una con «..» escribiría fuera de la copia (H-08)
  /** @type {{ ruta: string, contenido: string }[]} */
  const fuentes = [];
  /** @type {{ ruta: string, motivo: string }[]} */
  const rechazadas = [];
  const vistas = new Set();
  for (const bruta of entrada.archivos) {
    if (typeof bruta !== 'string' || bruta === '') continue;
    const v = validarRuta(cwd, bruta, { vetadas: entrada.vetadas });
    if (v.ok !== true) { rechazadas.push({ ruta: bruta, motivo: v.motivo ?? 'ruta_no_valida' }); continue; }
    const ruta = v.rutaPosix;
    if (vistas.has(ruta) || !lenguajeDe(ruta)) continue;
    vistas.add(ruta);
    try { fuentes.push({ ruta, contenido: fs.readFileSync(path.resolve(cwd, ruta), 'utf8') }); } catch { /* ya no existe: no se mide */ }
  }
  const posibles = alteracionesDe(fuentes);
  // En un archivo que ya existía, las pruebas de la tarea solo responden de lo que la tarea cambió
  /** @type {Map<string, Set<number>>} */
  const alcances = new Map();
  if (typeof entrada.originalDe === 'function') {
    for (const f of fuentes) {
      let original = null;
      try { original = entrada.originalDe(f.ruta); } catch { /* sin original legible: se altera entero, como un archivo nuevo */ }
      if (typeof original === 'string') alcances.set(f.ruta, new Set(alcanceDeLaTarea(f.ruta, original, f.contenido)));
    }
  }
  const candidatas = alcances.size === 0 ? posibles : posibles.filter((c) => alcances.get(c.ruta)?.has(c.linea) ?? true);
  const fueraDeLoCambiado = posibles.length - candidatas.length;
  if (alcances.size > 0) {
    entrada.alAcotar?.({ candidatas: candidatas.length, fueraDeLoCambiado, archivos: [...alcances].map(([ruta, lineas]) => ({ ruta, lineas: lineas.size })) });
  }
  if (candidatas.length === 0) return null;

  const contenidoDe = new Map(fuentes.map((f) => [f.ruta, f.contenido]));
  const lenguajes = new Map(fuentes.map((f) => [f.ruta, lenguajeDe(f.ruta)]));

  // N4-06: con node:test la medición ejecuta siempre con el reporter TAP, que el módulo bajo prueba no puede suplantar
  let medidor = runner;
  const propio = /** @type {any} */ (runner);
  if (propio?.o && typeof propio.o.testCmd === 'string') {
    let packageJson = null;
    try { packageJson = fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'); } catch { /* sin package.json */ }
    const t = comandoConReporterTap({ lenguaje: propio.o.lenguaje, testCmd: propio.o.testCmd, packageJson });
    if ('comando' in t && t.comando !== propio.o.testCmd) {
      try {
        const clon = typeof propio.conComando === 'function' ? propio.conComando(t.comando) : new propio.constructor({ ...propio.o, testCmd: t.comando, runId: `${propio.o.runId}-tap`, cli: propio.cli ?? propio.o.cli });
        if (clon && typeof clon.test === 'function') medidor = clon;
      } catch { /* se mide con el ejecutor tal cual: el reconocimiento por texto falla cerrado */ }
    }
  }
  const maxArchivos = Math.max(1, Math.floor(entrada.maxArchivos ?? MAX_ARCHIVOS));
  /** Líneas que la tarea cambió en un archivo (o las no vacías, si es nuevo): la prioridad para el tope de archivos. */
  const lineasDe = (ruta) => alcances.get(ruta)?.size ?? /** @type {string} */ (contenidoDe.get(ruta)).split('\n').filter((l) => l.trim() !== '').length;

  // Un avance guardado solo vale si se midió exactamente lo mismo: mismo código, mismas pruebas, mismos topes
  const hash = (dato) => createHash('sha256').update(JSON.stringify(dato)).digest('hex');
  const claveBase = hash({
    v: 4,
    fuentes: fuentes.map((f) => [f.ruta, createHash('sha256').update(f.contenido).digest('hex')]),
    pruebas: entrada.huellasPruebas ?? [],
    max, maxArchivos,
  });
  const guardado = entrada.avance?.leer();
  const vigente = guardado && guardado.claveBase === claveBase ? guardado : null;
  /** @type {Instantanea|null} */
  let instantanea = vigente?.cobertura && typeof vigente.cobertura === 'object' ? vigente.cobertura : null;

  /**
   * Qué se mide dado el estado de la cobertura: lo ejecutado por las pruebas, los archivos con más
   * líneas cambiadas (como mucho `maxArchivos`) y, de ahí, la muestra y su reserva.
   * @param {Instantanea} inst
   */
  const planificar = (inst) => {
    let filtradas = candidatas;
    if (!inst.sinCobertura) {
      /** @type {Map<string, CoberturaArchivo|null>} */
      const mapa = new Map();
      for (const [ruta, v] of Object.entries(inst.archivos ?? {})) {
        mapa.set(ruta, v ? { ...(v.sin ? { sin: new Set(v.sin) } : {}), ...(v.ej ? { ej: new Set(v.ej) } : {}) } : null);
      }
      filtradas = candidatas.filter((c) => lineaEjecutada(mapa.get(c.ruta), c.linea));
    }
    const fueraDeCobertura = candidatas.length - filtradas.length;
    const conAlteraciones = [...new Set(filtradas.map((c) => c.ruta))]
      .map((ruta) => ({ ruta, lineas: lineasDe(ruta) }))
      .sort((a, b) => b.lineas - a.lineas || (a.ruta < b.ruta ? -1 : a.ruta > b.ruta ? 1 : 0));
    const medidos = new Set(conAlteraciones.slice(0, maxArchivos).map((x) => x.ruta));
    const archivosOmitidos = conAlteraciones.slice(maxArchivos);
    const finales = filtradas.filter((c) => medidos.has(c.ruta));
    const elegidas = seleccionarPorArchivo(finales, max);
    const elegidasSet = new Set(elegidas);
    // La reserva sustituye a las no concluyentes; el orden es fijo, así que la misma entrada da la misma medición
    const reservas = seleccionarPorArchivo(finales.filter((c) => !elegidasSet.has(c)), max);
    const secuencia = [...elegidas, ...reservas];
    const clave = hash({ claveBase, sinCobertura: Boolean(inst.sinCobertura), secuencia: secuencia.map((a) => [a.ruta, a.inicio, a.fin, a.texto]) });
    return { finales, elegidas, secuencia, clave, fueraDeCobertura, archivosOmitidos, sinCobertura: Boolean(inst.sinCobertura), motivo: inst.motivo };
  };

  /** @type {ReturnType<typeof planificar>|null} */
  let plan = instantanea ? planificar(instantanea) : null;
  /** @type {{ categoria: string, veredicto: Veredicto, motivo?: string, durationMs: number }[]} */
  const hechas = plan && vigente && vigente.clave === plan.clave && Array.isArray(vigente.hechas)
    ? vigente.hechas
      .filter((h) => h && (h.categoria === 'pass' || h.categoria === 'fail' || h.categoria === 'timeout')
        && (h.veredicto === 'detectada' || h.veredicto === 'sobrevive' || h.veredicto === 'no_concluyente'))
      .slice(0, plan.secuencia.length)
    : [];

  /** @type {ResultadoMutacion} */
  const r = {
    probadas: 0, detectadas: 0, noConcluyentes: 0, puntuacion: null, parcial: false, lineaBase: 'no_medida',
    candidatas: candidatas.length, sobrevivientes: [],
    ...(fueraDeLoCambiado > 0 ? { fueraDeLoCambiado } : {}),
    ...(rechazadas.length ? { rechazadas } : {}),
  };
  const aplicarPlan = () => {
    if (!plan) return;
    r.candidatas = plan.finales.length;
    if (plan.sinCobertura) { r.sinCobertura = true; if (plan.motivo) r.motivoSinCobertura = plan.motivo; }
    if (plan.fueraDeCobertura > 0) r.fueraDeCobertura = plan.fueraDeCobertura;
    if (plan.archivosOmitidos.length > 0) r.archivosOmitidos = plan.archivosOmitidos;
  };
  aplicarPlan();

  /** @type {Map<string, { probadas: number, detectadas: number }>} */
  const reparto = new Map();
  const anotar = (indice, h, reutilizada) => {
    const p = /** @type {NonNullable<typeof plan>} */ (plan);
    const a = p.secuencia[indice];
    if (h.veredicto === 'no_concluyente') {
      r.noConcluyentes++;
    } else {
      r.probadas++;
      const c = reparto.get(a.ruta) ?? { probadas: 0, detectadas: 0 };
      c.probadas++;
      if (h.veredicto === 'detectada') { r.detectadas++; c.detectadas++; }
      else r.sobrevivientes.push({ ruta: a.ruta, linea: a.linea, operador: a.operador, antes: a.antes, despues: a.despues });
      reparto.set(a.ruta, c);
    }
    entrada.alProbar?.({
      indice, total: p.elegidas.length, alteracion: a, resultado: h.veredicto, categoria: h.categoria,
      ...(h.motivo ? { motivo: h.motivo } : {}), durationMs: h.durationMs ?? 0, reutilizada,
    });
  };

  hechas.forEach((h, i) => anotar(i, h, true));
  const faltan = () => plan !== null && r.probadas < max && hechas.length < plan.secuencia.length;

  /**
   * Cobertura de la línea base: se ejecuta una vez sobre la copia sin alterar, con el comando de
   * cobertura del propio ejecutor. Cualquier fallo (el ejecutor no la ofrece, el módulo no está en
   * la imagen, el informe no aparece) deja la medición «sin cobertura»: nunca se inventa.
   * @param {string} copia
   * @returns {Promise<Instantanea>}
   */
  const medirCobertura = async (copia) => {
    const sin = (motivo) => ({ sinCobertura: true, motivo: cola(redactar(String(motivo)), 240) });
    if (entrada.cobertura === null) return sin('no se pidió cobertura');
    let ejecutor;
    let formato;
    if (entrada.cobertura && typeof entrada.cobertura.test === 'function') {
      ejecutor = entrada.cobertura;
      formato = entrada.cobertura.formato;
    } else {
      let packageJson = null;
      try { packageJson = fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'); } catch { /* sin package.json */ }
      const propio = /** @type {any} */ (runner);
      const lenguaje = propio?.o?.lenguaje ?? lenguajes.get(fuentes[0]?.ruta) ?? undefined;
      const c = comandoConCobertura({ lenguaje, testCmd: propio?.o?.testCmd, packageJson });
      if ('motivo' in c) return sin(c.motivo);
      try { ejecutor = ejecutorConComando(runner, c.comando); } catch (e) { return sin(`no se pudo preparar el ejecutor con cobertura: ${e instanceof Error ? e.message : e}`); }
      if (!ejecutor) return sin('el ejecutor de pruebas no permite ejecutar otro comando');
      formato = c.formato;
    }
    let ejecucion;
    try { ejecucion = await ejecutor.test(copia); } catch (e) { return sin(`la ejecución con cobertura falló: ${e instanceof Error ? e.message : e}`); }
    if (Array.isArray(ejecutor.copiasSinBorrar) && ejecutor.copiasSinBorrar.length > 0 && Array.isArray(/** @type {any} */ (runner)?.copiasSinBorrar)) /** @type {any} */ (runner).copiasSinBorrar.push(...ejecutor.copiasSinBorrar);
    if (ejecucion?.infraError || ejecucion?.timedOut || esMuerteDeEntorno(ejecucion)) {
      return sin(`el ejecutor falló al medir la cobertura: ${String(ejecucion?.stderr ?? '').slice(-160)}`);
    }
    const salida = `${ejecucion?.stdout ?? ''}\n${ejecucion?.stderr ?? ''}`;
    let mapa = null;
    if (formato === 'node') mapa = parsearCoberturaNode(salida);
    else if (formato === 'python') mapa = parsearCoberturaPython(salida);
    else if (formato === 'go') {
      let modulo = '';
      try { modulo = /^module\s+(\S+)/m.exec(fs.readFileSync(path.join(cwd, 'go.mod'), 'utf8'))?.[1] ?? ''; } catch { /* sin go.mod */ }
      mapa = parsearCoberturaGo(salida, modulo);
    }
    if (mapa === null) {
      const porque = ejecucion?.exitCode ? `el comando con cobertura terminó con código ${ejecucion.exitCode}: ${String(ejecucion?.stderr || ejecucion?.stdout || '').slice(-160)}` : 'el informe de cobertura no apareció en la salida';
      return sin(porque);
    }
    /** @type {Instantanea['archivos']} */
    const archivos = {};
    for (const f of fuentes) {
      const c = coberturaDe(mapa, f.ruta);
      archivos[f.ruta] = c ? { ...(c.sin ? { sin: [...c.sin] } : {}), ...(c.ej ? { ej: [...c.ej] } : {}) } : null;
    }
    return { formato, archivos };
  };

  if (plan === null || faltan()) {
    r.huerfanasBorradas = barrerMutacionesHuerfanas(dirTemporal);
    // La carpeta madre lleva la marca y permisos 0700 (mkdtemp); la copia va dentro, también privada (H-06)
    const madre = fs.mkdtempSync(path.join(dirTemporal, 'forge-mutacion-'));
    try {
      escribirMarcaCopia(madre);
      const copia = path.join(madre, 'copia');
      crearCopia(cwd, copia, { excluir: entrada.excluir, privada: true });
      // El tiempo cuenta desde que la copia está lista: copiar un proyecto grande no gasta el presupuesto de la medición
      const t0 = ahora();

      // Línea base: la copia sin alterar tiene que pasar. Si no, «fallar» no significaría nada (H-05)
      const base = await medidor.test(copia);
      const catBase = clasificar(base, { hayPruebas: true, pruebasIntactas: true });
      if (catBase === 'infra_error' || esMuerteDeEntorno(base)) {
        r.lineaBase = 'infraestructura';
        r.parcial = true;
        r.motivoParcial = 'infraestructura';
        r.detalleInfra = String(base?.stderr ?? '').slice(-400);
      } else if (catBase !== 'pass') {
        r.lineaBase = 'falla';
        r.parcial = true;
        r.motivoParcial = 'linea_base';
        r.detalleInfra = `${catBase === 'timeout' ? 'tiempo agotado' : `código ${base?.exitCode}`} sin alterar nada: ${String(base?.stdout ?? '').slice(-200)} ${String(base?.stderr ?? '').slice(-200)}`.trim();
      } else {
        r.lineaBase = 'ok';
      }

      // Cobertura de esa misma línea base (una vez; con el avance guardado no se repite al reanudar)
      if (r.lineaBase === 'ok' && plan === null) {
        instantanea = await medirCobertura(copia);
        plan = planificar(instantanea);
        aplicarPlan();
        entrada.avance?.guardar({ claveBase, cobertura: instantanea, clave: plan.clave, hechas });
      }

      while (r.lineaBase === 'ok' && faltan()) {
        if (ahora() - t0 >= timeoutMs) { r.parcial = true; r.motivoParcial = 'tiempo'; break; }
        const p = /** @type {NonNullable<typeof plan>} */ (plan);
        const i = hechas.length;
        const a = p.secuencia[i];
        const original = /** @type {string} */ (contenidoDe.get(a.ruta));
        const destino  = path.join(copia, a.ruta);
        let ejecucion;
        fs.mkdirSync(path.dirname(destino), { recursive: true });
        fs.writeFileSync(destino, aplicarAlteracion(original, a), 'utf8');
        try {
          ejecucion = await medidor.test(copia);
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
          entrada.alProbar?.({ indice: i, total: p.elegidas.length, alteracion: a, resultado: 'sin_resultado', categoria, durationMs: ejecucion?.durationMs ?? 0, reutilizada: false });
          break;
        }
        const juicio = juzgar(ejecucion, categoria, lenguajes.get(a.ruta) ?? null);
        const h = { categoria, veredicto: juicio.veredicto, ...(juicio.motivo ? { motivo: juicio.motivo } : {}), durationMs: ejecucion?.durationMs ?? 0 };
        hechas.push(h);
        entrada.avance?.guardar({ claveBase, cobertura: instantanea, clave: p.clave, hechas });
        anotar(i, h, false);
      }
    } finally {
      if (medidor !== runner && Array.isArray(/** @type {any} */ (medidor).copiasSinBorrar) && Array.isArray(propio?.copiasSinBorrar)) propio.copiasSinBorrar.push(.../** @type {any} */ (medidor).copiasSinBorrar);
      if (!eliminarCopia(madre)) r.copiaSinBorrar = true;
    }
  }

  if (!r.motivoParcial && plan && plan.finales.length > r.probadas + r.noConcluyentes) {
    r.parcial = true;
    r.motivoParcial = 'tope_alteraciones';
  }
  r.puntuacion = puntuar(r.probadas, r.detectadas);
  if (reparto.size > 0) r.porArchivo = [...reparto].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([ruta, c]) => ({ ruta, ...c }));
  return r;
}
