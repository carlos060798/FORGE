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
 * @type {[RegExp, string][]}
 */
const PATRONES = [
  // Clave privada completa, o empezada y cortada (el recorte puede haber perdido el final)
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[REDACTADO: clave privada]'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*$/g, '[REDACTADO: clave privada]'],
  // Credenciales dentro de una URL: https://usuario:clave@servidor
  [/(\b[a-z][a-z0-9+.-]{0,30}:\/\/)[^/\s:@]+:[^/\s@]+@/gi, '$1[REDACTADO]@'],
  // JSON: "password": "valor"
  [new RegExp(`("[\\w.-]{0,64}${NOMBRE_SECRETO}[\\w.-]{0,64}"\\s*:\\s*)"[^"]*"`, 'gi'), '$1"[REDACTADO]"'],
  [/\bAuthorization:\s*(?:Basic|Bearer|Token)\s+\S+/gi, 'Authorization: [REDACTADO]'],
  // clave=valor y clave: valor, también con prefijos (DB_PASSWORD, AWS_SECRET_ACCESS_KEY)
  // Valor entre comillas, con espacios: API_KEY="a b c d"
  [new RegExp(`(${NOMBRE_SECRETO}[\\w.-]{0,64}\\s*[:=]\\s*)(["'])[^"'\\n]{1,200}\\2`, 'gi'), '$1$2[REDACTADO]$2'],
  [new RegExp(`(${NOMBRE_SECRETO}[\\w.-]{0,64}\\s*[:=]\\s*)(["']?)[^\\s"',;]{4,}\\2`, 'gi'), '$1[REDACTADO]'],
  [/\b_authToken\s*=\s*\S+/gi, '_authToken=[REDACTADO]'],
  [/\bBearer\s+[A-Za-z0-9._~+/-]{20,}=*/g, 'Bearer [REDACTADO]'],
  // Formatos de token conocidos
  [/\bsk[-_](?:live|test|ant|proj)?[-_]?[A-Za-z0-9_-]{20,}\b/g, '[REDACTADO]'],
  [/\bAKIA[0-9A-Z]{16}\b/g, '[REDACTADO]'],
  [/\bAIza[0-9A-Za-z_-]{35}\b/g, '[REDACTADO]'],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}\b/g, '[REDACTADO]'],
  [/\bgithub_pat_[A-Za-z0-9_]{30,}\b/g, '[REDACTADO]'],
  [/\bglpat-[A-Za-z0-9_-]{20,}\b/g, '[REDACTADO]'],
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g, '[REDACTADO]'],
  [/\bnpm_[A-Za-z0-9]{30,}\b/g, '[REDACTADO]'],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, '[REDACTADO: JWT]'],
];

/** Tope de caracteres que se redactan en `cola`; el resto se descarta por el principio. */
const LIMITE_ENTRADA = 64 * 1024;

/** @param {string} texto */
export function redactar(texto) {
  let limpio = texto;
  for (const [patron, sustitucion] of PATRONES) limpio = limpio.replace(patron, sustitucion);
  return limpio;
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
