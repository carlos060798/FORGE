/**
 * glob.js — Conversión mínima de patrones glob a expresiones regulares
 *
 * Soporta `**`, `*` y `{a,b}`. Las rutas se comparan con "/" como separador.
 */

/** Un patron mas largo que esto no se interpreta: coincide con nada. */
const MAX_PATRON = 256;

/**
 * Un patron mal formado nunca lanza ni se vuelve exponencial: las llaves sin cerrar y las comas
 * fuera de llaves son literales, y `**` + `/` repetidos se colapsan en uno.
 * @param {string} patron
 * @returns {RegExp}
 */
export function globARegex(patron) {
  if (patron.length > MAX_PATRON) return /(?!)/;
  patron = patron.replace(/(\*\*\/){2,}/g, '**/').replace(/\*{3,}/g, '**');
  // Cada `*` suelto es un bucle del regex: con muchos, el coste crece como n^k
  if ((patron.match(/\*/g) ?? []).length > 6) return /(?!)/;
  // Una llave solo abre un grupo si tiene su cierre; si no, es un caracter normal
  const cierre = new Set();
  const pila = [];
  for (let k = 0; k < patron.length; k++) {
    if (patron[k] === '{') pila.push(k);
    else if (patron[k] === '}' && pila.length > 0) { cierre.add(pila.pop()); cierre.add(k); }
  }
  let profundidad = 0;
  let re = '';
  for (let k = 0; k < patron.length; k++) {
    const c = patron[k];
    if (c === '*' && patron[k + 1] === '*') {
      const conBarra = patron[k + 2] === '/';
      re += conBarra ? '(?:.*/)?' : '.*';
      k += conBarra ? 2 : 1;
    } else if (c === '*') re += '[^/]*';
    else if (c === '{' && cierre.has(k)) { re += '(?:'; profundidad++; }
    else if (c === '}' && cierre.has(k)) { re += ')'; profundidad--; }
    else if (c === ',' && profundidad > 0) re += '|';
    else re += c.replace(/[.+^$(){}|[\]\\?]/g, '\\$&');
  }
  return new RegExp('^' + re + '$');
}

/**
 * Compara una ruta relativa con un patrón al estilo .gitignore:
 * un patrón sin "/" se compara con el nombre del archivo en cualquier carpeta.
 *
 * No distingue mayúsculas: se usa para decidir qué rutas están vetadas, y en
 * Windows y macOS ".GIT/config" y ".git/config" son el mismo archivo.
 * @param {string} rutaPosix  ruta relativa con "/"
 * @param {string} patron
 * @returns {boolean}
 */
export function coincide(rutaPosix, patron) {
  const re = new RegExp(globARegex(patron).source, 'i');
  if (!patron.includes('/')) return re.test(rutaPosix.split('/').pop() ?? '');
  return re.test(rutaPosix);
}
