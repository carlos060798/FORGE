/**
 * politica.js — Política de aislamiento → argumentos de `docker run` (ADR-02)
 *
 * Declarativa y sin efectos: se prueba comparando el argv, sin necesitar Docker.
 */

export const ETIQUETA = 'forge.sandbox=1';

/**
 * Etiqueta que identifica los contenedores de un proyecto. El barrido de
 * huérfanos se limita a ella: no debe tocar los de otro proyecto en marcha.
 * @param {string} proyectoId
 */
export function etiquetaProyecto(proyectoId) {
  return `forge.proyecto=${String(proyectoId).replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
}
export const USUARIO  = '1000:1000';
export const DIR_TRABAJO = '/work';

export const LIMITES_POR_DEFECTO = { cpus: 1, memoria: '512m', pids: 256 };

/** Un valor que empieza por "-" se interpretaría como una opción de docker. */
function sinGuion(nombre, valor) {
  if (typeof valor !== 'string' || valor === '' || valor.startsWith('-')) {
    throw new Error(`politica: ${nombre} inválido: "${valor}"`);
  }
  return valor;
}

/**
 * @param {string} runId
 * @param {number} n  ordinal de la ejecución dentro de la sesión
 */
export function nombreContenedor(runId, n) {
  return `forge-sbx-${String(runId).replace(/[^a-zA-Z0-9_.-]/g, '_')}-${n}`;
}

/**
 * - `copia`: ruta absoluta en el anfitrión de la copia de trabajo.
 * - `comando`: ejecutable y argumentos; el primero sustituye al ENTRYPOINT de la imagen.
 * - `dirTrabajo`: dónde se monta la copia dentro del contenedor.
 * - `tmpfsMb`: tamaño de /tmp (memoria del contenedor; 64 por defecto, entre 16 y 512).
 *
 * @param {{
 *   imagen: string,
 *   nombre: string,
 *   copia: string,
 *   comando: string[],
 *   limites?: { cpus?: number, memoria?: string, pids?: number },
 *   dirTrabajo?: string,
 *   env?: Record<string, string>,
 *   proyectoId?: string,
 *   tmpfsMb?: number,
 * }} opciones
 * @returns {string[]} argumentos para `docker`
 */
export function argvRun(opciones) {
  const { imagen, nombre, copia, comando } = opciones;
  const limites = { ...LIMITES_POR_DEFECTO, ...opciones.limites };
  const dirTrabajo = opciones.dirTrabajo ?? DIR_TRABAJO;
  const env = Object.entries(opciones.env ?? {}).flatMap(([k, v]) => {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) throw new Error(`politica: variable de entorno inválida: "${k}"`);
    return ['-e', `${k}=${v}`];
  });

  // /tmp es memoria del contenedor: su tamaño cuenta para el limite de memoria. Go necesita mas por su cache de compilacion
  const tmpfsMb = opciones.tmpfsMb ?? 64;
  if (!Number.isInteger(tmpfsMb) || tmpfsMb < 16 || tmpfsMb > 512) throw new Error('politica: tmpfsMb debe ser un entero entre 16 y 512');

  sinGuion('imagen', imagen);
  sinGuion('nombre', nombre);
  sinGuion('copia', copia);
  // --mount separa sus opciones con comas: una coma en la ruta añadiría opciones ajenas
  if (/[,\r\n]/.test(copia)) throw new Error('politica: la ruta de la copia no puede contener comas ni saltos de línea');
  if (!Array.isArray(comando) || comando.length === 0) throw new Error('politica: comando vacío');
  sinGuion('comando', comando[0]);

  return [
    'run', '--rm',
    '--name', nombre,
    '--label', ETIQUETA,
    ...(opciones.proyectoId ? ['--label', etiquetaProyecto(opciones.proyectoId)] : []),
    '--network', 'none',
    '--user', USUARIO,
    '--cap-drop', 'ALL',
    '--security-opt', 'no-new-privileges',
    '--cpus', String(limites.cpus),
    '--memory', String(limites.memoria),
    '--memory-swap', String(limites.memoria),
    '--pids-limit', String(limites.pids),
    // La imagen ya está preparada: un contenedor del ciclo nunca descarga nada
    '--pull', 'never',
    '--ulimit', 'nofile=1024:1024',
    '--ulimit', 'fsize=104857600',
    '--read-only',
    '--tmpfs', `/tmp:rw,noexec,nosuid,size=${tmpfsMb}m`,
    // --mount, no -v: una ruta con ":" (Linux, macOS) rompería el formato de -v
    '--mount', `type=bind,source=${copia},target=${dirTrabajo}`,
    '-w', dirTrabajo,
    ...env,
    // Entrypoint explícito: con el de la imagen, un comando inexistente puede
    // devolver 1 en lugar de 127 y confundirse con un fallo de las pruebas.
    '--entrypoint', comando[0],
    imagen,
    ...comando.slice(1),
  ];
}
