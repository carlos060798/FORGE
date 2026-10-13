/**
 * redactar.js — Recorta y limpia la salida de una ejecución antes de guardarla
 *
 * La salida de las pruebas acaba en eventos, puntos de guardado y en el prompt
 * del implementador: no debe llevar secretos ni crecer sin límite.
 *
 * No es una frontera de seguridad: cubre formatos comunes, no todos. La
 * frontera real es qué entra en la copia de trabajo (core/sandbox/staging.js).
 */

const NOMBRE_SECRETO = '(?:api[_-]?key|apikey|secret|token|passw(?:or)?d|passwd|pwd|pass|credential|private[_-]?key|auth(?:orization)?|contrase(?:ñ|n)a)';

/**
 * Cada patrón: [expresión, sustitución]. El orden importa: los bloques largos primero.
 * El tercer elemento, 'nombre', marca los que deciden por el NOMBRE de una variable: sirven para
 * la salida de pruebas y los registros, pero no para texto que el modelo va a editar (ver
 * `redactarFormatos`).
 * @type {([RegExp, string] | [RegExp, string, 'nombre'])[]}
 */
const PATRONES = [
  // Clave privada completa, o empezada y cortada (el recorte puede haber perdido el final)
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[REDACTADO: clave privada]'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*$/g, '[REDACTADO: clave privada]'],
  // Credenciales dentro de una URL: https://usuario:clave@servidor
  [/(\b[a-z][a-z0-9+.-]{0,30}:\/\/)[^/\s:@]*:[^/\s@]+@/gi, '$1[REDACTADO]@'],
  // JSON: "password": "valor"
  [new RegExp(`("[\\w.-]{0,64}${NOMBRE_SECRETO}[\\w.-]{0,64}"\\s*:\\s*)"[^"]*"`, 'gi'), '$1"[REDACTADO]"', 'nombre'],
  [/\bAuthorization:\s*(?:Basic|Bearer|Token)\s+(?![$<{%])\S+/gi, 'Authorization: [REDACTADO]'],
  // clave=valor y clave: valor, también con prefijos (DB_PASSWORD, AWS_SECRET_ACCESS_KEY)
  // Valor entre comillas, con espacios: API_KEY="a b c d"
  [new RegExp(`(${NOMBRE_SECRETO}[\\w.-]{0,64}\\s*[:=]\\s*)(["'])[^"'\\n]{1,200}\\2`, 'gi'), '$1$2[REDACTADO]$2', 'nombre'],
  [new RegExp(`(${NOMBRE_SECRETO}[\\w.-]{0,64}\\s*[:=]\\s*)(["']?)[^\\s"',;]{4,}\\2`, 'gi'), '$1[REDACTADO]', 'nombre'],
  [/\b_authToken\s*=\s*\S+/gi, '_authToken=[REDACTADO]'],
  [/\bBearer\s+[A-Za-z0-9._~+/-]{20,}=*/g, 'Bearer [REDACTADO]'],
  // Formatos de token conocidos
  [/\bsk[-_](?:live|test|ant|proj)?[-_]?[A-Za-z0-9_-]{20,}\b/g, '[REDACTADO]'],
  [/\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, '[REDACTADO]'],
  // Clave secreta de AWS (40 caracteres en base64) tras su nombre, con '=' o sin él.
  // Sin el nombre no se toca: 40 caracteres sueltos pueden ser un SHA-1 u otro identificador legítimo
  [/(\baws[_-]?secret[_-]?(?:access[_-]?)?key\b["']?\s*[:=]?\s*["']?)[A-Za-z0-9/+]{40}(?![A-Za-z0-9/+=])=?/gi, '$1[REDACTADO]'],
  [/\bAIza[0-9A-Za-z_-]{35}\b/g, '[REDACTADO]'],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}\b/g, '[REDACTADO]'],
  [/\bgithub_pat_[A-Za-z0-9_]{30,}\b/g, '[REDACTADO]'],
  [/\bglpat-[A-Za-z0-9_-]{20,}\b/g, '[REDACTADO]'],
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g, '[REDACTADO]'],
  [/\bnpm_[A-Za-z0-9]{30,}\b/g, '[REDACTADO]'],
  [/\bhttps:\/\/hooks\.slack\.com\/(?:services|workflows|triggers)\/[A-Za-z0-9/_-]{8,}/g, 'https://hooks.slack.com/[REDACTADO]'],
  [/\bya29\.[A-Za-z0-9_-]{20,}/g, '[REDACTADO]'],
  [/\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g, '[REDACTADO]'],
  [/\bhf_[A-Za-z0-9]{30,}\b/g, '[REDACTADO]'],
  [/\b[rs]k_(?:live|test)_[A-Za-z0-9]{16,}\b/g, '[REDACTADO]'],
  [/\bSK[0-9a-f]{32}\b/g, '[REDACTADO]'],
  // Azure: cadena de conexión de almacenamiento y de Service Bus
  [/\b(AccountKey|SharedAccessKey)\s*=\s*[A-Za-z0-9+/]{20,}={0,2}/g, '$1=[REDACTADO]'],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, '[REDACTADO: JWT]'],
];

/** Tope de caracteres que se redactan en `cola`; el resto se descarta por el principio. */
const LIMITE_ENTRADA = 64 * 1024;

/** @param {string} texto */
export function redactar(texto) {
  // Un carácter invisible metido dentro de un token lo parte para las expresiones de abajo y el
  // token seguiría valiendo para quien lo copie. Solo se quita entre dos caracteres de token
  // ASCII: no toca los emojis compuestos ni la escritura de otros alfabetos
  let limpio = texto.replace(/(?<=[A-Za-z0-9_-])[\u200B-\u200D\u2060\uFEFF\u00AD]+(?=[A-Za-z0-9_-])/g, '');
  for (const [patron, sustitucion] of PATRONES) limpio = limpio.replace(patron, sustitucion);
  return limpio;
}

/**
 * Para el texto de archivos que se le entrega al modelo (`leer_archivo`, `buscar`): solo formatos de
 * secreto conocidos (claves de proveedores, JWT, URL con credenciales, bloque de clave privada completo).
 * NO redacta solo por nombre de variable: `const token = jwt.sign(...)`, `auth: true` o `password=None`
 * son código legítimo, y si el modelo ve `[REDACTADO]` donde hay código, sus ediciones
 * `buscar/reemplazar` fallan o, peor, escribe `[REDACTADO]` en el archivo (hallazgo N-03 de la
 * tercera revisión independiente). Tampoco recorta desde una cabecera de clave privada sin cierre.
 * Desde la cuarta revisión (N4-03) añade una regla por VALOR (`redactarPorValor`): un nombre de
 * secreto Y un literal con aspecto de secreto (largo, sin espacios, varias clases de caracteres),
 * y las contraseñas de cadenas de conexión. Sigue sin ser una frontera de seguridad: la frontera
 * real son los vetos de nombre de archivo y el aislamiento.
 * @param {string} texto
 */
export function redactarFormatos(texto) {
  let limpio = texto.replace(/(?<=[A-Za-z0-9_-])[\u200B-\u200D\u2060\uFEFF\u00AD]+(?=[A-Za-z0-9_-])/g, '');
  for (const [patron, sustitucion, clase] of PATRONES) {
    if (clase === 'nombre') continue;
    if (patron.source.endsWith('[\\s\\S]*$')) continue;
    limpio = limpio.replace(patron, sustitucion);
  }
  return redactarPorValor(limpio);
}

const MARCA = '[REDACTADO]';
const PALABRAS_NO_SECRETAS = /^(?:none|null|nil|true|false|undefined|empty|changeme|password|secret|token)$/i;

/** Clases de caracteres presentes: minúsculas, mayúsculas, dígitos y símbolos (sin `_ - .`, que separan palabras). */
function clases(v) {
  return (/[a-z]/.test(v) ? 1 : 0) + (/[A-Z]/.test(v) ? 1 : 0) + (/\d/.test(v) ? 1 : 0) + (/[^A-Za-z0-9_.\-]/.test(v) ? 1 : 0);
}

function entropia(v) {
  const n = new Map();
  for (const c of v) n.set(c, (n.get(c) ?? 0) + 1);
  let h = 0;
  for (const k of n.values()) h -= (k / v.length) * Math.log2(k / v.length);
  return h;
}

/**
 * ¿Un literal de cadena tiene aspecto de secreto? Largo (≥ 12), sin espacios, ni URL sin credenciales, ni
 * plantilla, y con mezcla de clases (≥ 3) o, si es largo, hexadecimal/base64 con dígitos y entropía alta.
 * Un identificador (`my_secret_key_name`, `getUserToken`), un nombre de variable de entorno
 * (`DB_PASSWORD`) o un mensaje con espacios no lo son.
 * @param {string} v
 */
export function pareceSecreto(v) {
  if (v.length < 12 || v.length > 200 || /\s/.test(v)) return false;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(v) || /^[./~]/.test(v)) return false;
  if (/\$\{|\{\{|<%|%[sd]|^\$|^<.*>$|^\[.*\]$/.test(v)) return false;
  const k = clases(v);
  if (k >= 3 && entropia(v) >= 3) return true;
  if (v.length >= 32 && /^[A-Fa-f0-9]+$/.test(v)) return true;
  return v.length >= 32 && /^[A-Za-z0-9+/=_-]+$/.test(v) && /\d/.test(v) && k >= 2 && entropia(v) >= 4;
}

const PREFIJO_NOMBRE = '[\\w.$-]{0,64}';
/** nombre + separador (`=`, `:`, `:=`, `=>`) + literal entre comillas */
const RE_LITERAL = new RegExp(
  `(${PREFIJO_NOMBRE}${NOMBRE_SECRETO}[\\w.-]{0,64})(["'\`]?\\s*(?::=|=>|[:=])\\s*)(["'\`])([^"'\`\\n]{12,200})\\3`, 'gi');
/** nombre=valor sin comillas, con símbolos (export DB_PASSWORD=Zq8!kLm2#xP9, \`const password = Zq8!kLm2#xP9;\`) */
const RE_SIN_COMILLAS = new RegExp(
  `(${PREFIJO_NOMBRE}${NOMBRE_SECRETO}[\\w.-]{0,64}\\s*(?::=|[:=])\\s*)([^\\s"'\`,;(){}<>=\\[\\]]{12,200})`, 'gi');
/** línea de entorno: NOMBRE=valor, sin espacios y sin nada más */
const RE_ENTORNO = new RegExp(
  `^(\\s*(?:export\\s+)?${PREFIJO_NOMBRE}${NOMBRE_SECRETO}[\\w.-]{0,64}=)([^\\s"'\`$<{(]{12,200})\\s*$`, 'gim');
const RE_AUTORIZACION = /(\bAuthorization["']?\s*[:=]\s*["']?\s*)(Basic|Bearer|Token)(\s+)([A-Za-z0-9+/=._~-]{8,})/gi;
const RE_CONEXION = /(\b(?:password|pwd|passwd)\s*=\s*)([^;\s"'`<>${}(),]{3,})/gi;

/**
 * Regla por valor (N4-03): redacta solo el VALOR, deja el nombre y las comillas. No toca `jwt.sign(...)`,
 * identificadores, llamadas, números ni valores cortos.
 * @param {string} texto
 */
export function redactarPorValor(texto) {
  let t = texto;
  t = t.replace(RE_LITERAL, (m, nombre, sep, q, valor) => (pareceSecreto(valor) ? `${nombre}${sep}${q}${MARCA}${q}` : m));
  t = t.replace(RE_SIN_COMILLAS, (m, cab, valor) => (
    /^[A-Fa-f0-9]{32,}$/.test(valor) || (clases(valor) >= 3 && /[^A-Za-z0-9_.\-]/.test(valor) && !/^[$%@]/.test(valor) && entropia(valor) >= 3) ?`${cab}${MARCA}` : m));
  t = t.replace(RE_ENTORNO, (m, cab, valor) => (
    !/\.[A-Za-z_]\w*\(/.test(valor) && clases(valor) >= 3 && entropia(valor) >= 3 ? `${cab}${MARCA}` : m));
  t = t.replace(RE_AUTORIZACION, (m, cab, esq, sp) => `${cab}${esq}${sp}${MARCA}`);
  // Contraseña en cadena de conexión: tiene que venir tras otro par clave=valor de la misma cadena
  t = t.replace(RE_CONEXION, (m, cab, valor, desde, todo) => {
    const antes = todo.slice(Math.max(0, desde - 200), desde);
    if (!/[A-Za-z_][\w ]*=\s*[^=;\s,()]+[;\s]\s*$/.test(antes.slice(antes.lastIndexOf('\n') + 1))) return m;
    if (PALABRAS_NO_SECRETAS.test(valor) || /[.[]/.test(valor) && /^[\w.[\]]+$/.test(valor) && !/\d/.test(valor)) return m;
    return `${cab}${MARCA}`;
  });
  return t;
}

const MARCA_CLAVE = '[REDACTADO: clave privada]';
const RE_CABECERA_CLAVE = /-----BEGIN [A-Z ]*PRIVATE KEY[A-Z ]*-----/;
const RE_FIN_CLAVE = /-----END [A-Z ]*PRIVATE KEY[A-Z ]*-----/;
const RE_LINEA_BASE64 = /^[\s"'`+,]*[A-Za-z0-9+/]{4,}={0,2}(?:\\n)?[\s"'`+,;]*$/;
const RE_CABECERA_PEM = /^\s*[A-Za-z][A-Za-z-]*:\s/;

/**
 * Oculta el CUERPO de las claves privadas de un archivo completo (N4-04), línea a línea y sin cambiar
 * el número de líneas, para que cualquier tramo o búsqueda posterior sea coherente: desde la cabecera
 * `-----BEGIN ... PRIVATE KEY-----` hasta el `END` o, si falta, hasta la primera línea que no sea
 * base64 (así no se come el resto del archivo). Hay que llamarla sobre el archivo ENTERO, antes de
 * tomar un tramo.
 * @param {string[]} lineas
 * @returns {{ lineas: string[], ocultas: Set<number> }}  índices (desde 0) de las líneas del cuerpo
 */
export function ocultarCuerposDeClave(lineas) {
  const ocultas = new Set();
  const salida = [...lineas];
  for (let i = 0; i < salida.length; i++) {
    const m = RE_CABECERA_CLAVE.exec(salida[i]);
    if (!m) continue;
    const resto = salida[i].slice(m.index + m[0].length);
    if (RE_FIN_CLAVE.test(resto)) {          // todo en la misma línea
      salida[i] = salida[i].replace(new RegExp(RE_CABECERA_CLAVE.source + '[\\s\\S]*?' + RE_FIN_CLAVE.source, 'g'), MARCA_CLAVE);
      ocultas.add(i);
      continue;
    }
    if (resto.trim() !== '') { salida[i] = salida[i].slice(0, m.index + m[0].length) + MARCA_CLAVE; ocultas.add(i); }
    let j = i + 1;
    let hayCuerpo = false;
    for (; j < salida.length; j++) {
      const l = salida[j];
      if (RE_FIN_CLAVE.test(l)) break;
      if (!hayCuerpo && (l.trim() === '' || RE_CABECERA_PEM.test(l))) { ocultas.add(j); continue; }
      if (RE_LINEA_BASE64.test(l)) { hayCuerpo = true; salida[j] = MARCA_CLAVE; ocultas.add(j); continue; }
      break;
    }
    i = j;
  }
  return { lineas: salida, ocultas };
}

/**
 * Últimos `maxBytes` de la salida, sin secretos. Se redacta ANTES de recortar:
 * si no, un secreto partido por el recorte perdería su cabecera y pasaría.
 * @param {string} texto
 * @param {number} [maxBytes]
 */
export function cola(texto, maxBytes = 8192) {
  // Se acota antes de redactar: la salida la controla el codigo bajo prueba y una linea
  // enorme no debe bloquear el proceso. Se corta por una frontera de linea si la hay.
  let entrada = texto ?? '';
  if (entrada.length > LIMITE_ENTRADA) {
    entrada = entrada.slice(entrada.length - LIMITE_ENTRADA);
    const salto = entrada.indexOf('\n');
    if (salto !== -1 && salto < 4096) entrada = entrada.slice(salto + 1);
  }
  const buffer = Buffer.from(redactar(entrada), 'utf8');
  if (buffer.length <= maxBytes) return buffer.toString('utf8');
  return buffer.subarray(buffer.length - maxBytes).toString('utf8').replace(/^�+/, '');
}
