/**
 * hosts.js — Dónde pueden viajar las credenciales (revisión independiente 1, R1)
 *
 * La configuración del proyecto vive en el repositorio y el repositorio NO es de confianza. Ninguna
 * decisión de seguridad depende solo de ese archivo:
 *
 *   - los hosts de defecto son constantes del código: `api.github.com` y `gitlab.com`;
 *   - cualquier otro host (GitLab autoalojado, TODO sitio de Jira: es siempre de un cliente) solo se
 *     acepta si está en `FORGE_INTEGRACIONES_HOSTS`, una variable de entorno del USUARIO (lista
 *     separada por comas, comparación EXACTA, sin comodines ni sufijos);
 *   - hay hosts que se rechazan SIEMPRE, aunque estén en la lista: `localhost`, `*.localhost`,
 *     `*.internal`, `*.local`, direcciones IP literales (también decimales o hexadecimales),
 *     `metadata.*` y todo puerto distinto de 443. La única excepción es el interruptor interno de
 *     pruebas de http.js (`_permitirLocal`), que no es alcanzable desde la configuración ni desde la CLI;
 *   - el token solo se envía al host exacto que pasó estas reglas.
 *
 * Es código puro: sin red y sin disco. Lee el entorno únicamente a través del parámetro `env`.
 */

/** Variable de entorno del usuario con los hosts adicionales autorizados. */
export const VARIABLE_HOSTS = 'FORGE_INTEGRACIONES_HOSTS';

/** Hosts de defecto por proveedor (Jira no tiene: es siempre un sitio de un cliente). */
export const HOSTS_POR_DEFECTO = Object.freeze({ github: 'api.github.com', gitlab: 'gitlab.com' });

const IPV4_DECIMAL = /^\d{1,3}(?:\.\d{1,3}){3}$/;

export class ErrorHostNoAutorizado extends Error {
  /**
   * @param {string} proveedor
   * @param {string} host
   * @param {string} motivo  ya sin credenciales
   */
  constructor(proveedor, host, motivo) {
    super(`El host «${String(host).slice(0, 80)}» de ${proveedor} no está autorizado: ${motivo} No se hizo ninguna petición ni se leyó ningún token.`);
    this.name = 'ErrorHostNoAutorizado';
    this.codigo = 'host_no_autorizado';
    this.proveedor = proveedor;
  }
}

/**
 * Motivo por el que un host se rechaza SIEMPRE, o null. No mira ninguna lista.
 * @param {unknown} host  nombre de host, con `:puerto` opcional, sin esquema
 * @returns {string|null}
 */
export function motivoHostVetado(host) {
  if (typeof host !== 'string' || host === '') return 'el host está vacío.';
  const h = host.trim().toLowerCase();
  if (h !== host.toLowerCase() || /[\s/\\@?#\u0000-\u001F\u007F]/.test(h)) return 'el host contiene caracteres no válidos.';
  if (h.startsWith('[') || (h.match(/:/g) ?? []).length > 1) return 'es una dirección IP; se usan nombres de host.';
  const m = /^([^:]+)(?::(\d{1,5}))?$/.exec(h);
  if (!m) return 'el host no tiene una forma válida.';
  const nombre = m[1].replace(/\.$/, '');
  if (m[2] !== undefined && Number(m[2]) !== 443) return `solo se admite el puerto 443 (se pidió ${m[2]}).`;
  if (nombre === '') return 'el host está vacío.';
  if (nombre === 'localhost' || nombre.endsWith('.localhost')) return 'es un host local.';
  if (nombre.endsWith('.internal') || nombre === 'internal') return 'termina en «.internal» (red interna).';
  if (nombre.endsWith('.local') || nombre === 'local') return 'termina en «.local» (red interna).';
  if (nombre === 'metadata' || nombre.startsWith('metadata.')) return 'es un servicio de metadatos de la nube.';
  const etiquetas = nombre.split('.');
  const ultima = etiquetas[etiquetas.length - 1];
  // 127.0.0.1, 2130706433, 0x7f.1, 017700000001: cualquier forma numérica es una IP escrita de otra manera
  if (IPV4_DECIMAL.test(nombre) || /^\d+$/.test(ultima) || /^0x[0-9a-f]*$/i.test(ultima) || etiquetas.some((e) => /^0x[0-9a-f]+$/i.test(e))) {
    return 'es una dirección IP; se usan nombres de host.';
  }
  return null;
}

/**
 * Hosts autorizados por el usuario. Entradas vacías o vetadas se ignoran (no autorizan nada).
 * @param {Record<string, string|undefined>} [env]
 * @returns {string[]}
 */
export function hostsDelUsuario(env = process.env) {
  const crudo = env?.[VARIABLE_HOSTS];
  if (typeof crudo !== 'string' || crudo.trim() === '') return [];
  const salida = [];
  for (const parte of crudo.split(',')) {
    const h = parte.trim().toLowerCase();
    if (h !== '' && motivoHostVetado(h) === null && !salida.includes(h)) salida.push(h);
  }
  return salida;
}

/**
 * Comprueba que `host` puede recibir las credenciales de `proveedor`. Devuelve el host (en minúsculas)
 * o lanza `ErrorHostNoAutorizado` con lo que hay que definir. No lee ningún token.
 * @param {'github'|'gitlab'|'jira'} proveedor
 * @param {string} host
 * @param {Record<string, string|undefined>} [env]
 * @returns {string}
 */
export function exigirHostAutorizado(proveedor, host, env = process.env) {
  const vetado = motivoHostVetado(host);
  if (vetado !== null) throw new ErrorHostNoAutorizado(proveedor, host, `${vetado} Ese host se rechaza siempre, aunque esté en ${VARIABLE_HOSTS}.`);
  const h = host.toLowerCase();
  if (proveedor === 'github') {
    if (h !== HOSTS_POR_DEFECTO.github) {
      throw new ErrorHostNoAutorizado(proveedor, host, `GitHub solo se habla con ${HOSTS_POR_DEFECTO.github} (GitHub Enterprise no está soportado).`);
    }
    return h;
  }
  if (proveedor === 'gitlab' && h === HOSTS_POR_DEFECTO.gitlab) return h;
  if (proveedor === 'jira' && !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.atlassian\.net$/.test(h)) {
    throw new ErrorHostNoAutorizado(proveedor, host, 'debe ser un sitio de Jira Cloud (nombre.atlassian.net).');
  }
  if (hostsDelUsuario(env).includes(h)) return h;
  throw new ErrorHostNoAutorizado(proveedor, host,
    `no es el host de defecto y el proyecto no puede autorizarlo por su cuenta. Si es tuyo y lo reconoces, define en TU entorno (no en el repositorio) ${VARIABLE_HOSTS}=${h} (lista separada por comas; comparación exacta).`);
}
