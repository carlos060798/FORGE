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

/**
 * Nombre de un mecanismo de aislamiento (`sandbox.runtime`, lo que Docker llama runtime):
 * solo letras, cifras, guion bajo, punto y guion, y sin empezar por guion. Cualquier otra
 * cosa podría leerse como una opción de docker o como más de un argumento.
 */
const RUNTIME_VALIDO = /^[a-zA-Z0-9_.][a-zA-Z0-9_.-]*$/;

/**
 * Valida `sandbox.runtime`. Vacío (o sin indicar) significa «el de Docker por defecto».
 * @param {unknown} valor
 * @returns {string} el nombre, o '' si no se indicó ninguno
 */
export function validarRuntime(valor) {
  if (valor === undefined || valor === null || valor === '') return '';
  if (typeof valor !== 'string' || !RUNTIME_VALIDO.test(valor)) {
    throw new Error(`sandbox.runtime no válido: "${valor}". Solo admite letras, cifras, "_", "." y "-", y no puede empezar por "-".`);
  }
  return valor;
}

/** Variable de entorno con los mecanismos de aislamiento que el usuario autoriza, separados por comas. */
export const VARIABLE_RUNTIMES = 'FORGE_RUNTIMES_PERMITIDOS';

/** Siempre permitido: es el mecanismo estándar de Docker. Vacío (sin `sandbox.runtime`) es el de por defecto. */
export const RUNTIMES_SIEMPRE_PERMITIDOS = Object.freeze(['runc']);

/**
 * ¿Autoriza el usuario este `sandbox.runtime`? El archivo del proyecto (`.sdd/sdd.config.yaml`)
 * puede venir de un repositorio hostil, así que lo que el proyecto pide no basta: un mecanismo
 * distinto de `runc` y del de Docker por defecto exige estar en la lista del lado del usuario
 * (variable `FORGE_RUNTIMES_PERMITIDOS`, comparación exacta, sin comodines). Revisión H-05.
 * @param {string} runtime  ya validado con `validarRuntime`; '' = el de Docker por defecto
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function runtimePermitido(runtime, env = process.env) {
  if (!runtime || RUNTIMES_SIEMPRE_PERMITIDOS.includes(runtime)) return { ok: true };
  const lista = String(env[VARIABLE_RUNTIMES] ?? '').split(',').map((r) => r.trim()).filter(Boolean);
  if (lista.includes(runtime)) return { ok: true };
  return {
    ok: false,
    error: `El proyecto pide el mecanismo de aislamiento "${runtime}" (sandbox.runtime) y tú no lo has autorizado. `
      + `Ese archivo puede venir de un repositorio ajeno: un mecanismo distinto de "runc" es código de confianza que recibe el contenedor. `
      + `Si lo conoces y lo quieres, autorízalo en tu equipo con ${VARIABLE_RUNTIMES}=${runtime} (varios, separados por comas); `
      + `si no, quita sandbox.runtime de .sdd/sdd.config.yaml.`,
  };
}

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
 * - `runtime`: mecanismo de aislamiento (`--runtime`). Sin indicar, el de Docker por defecto.
 *   Solo AÑADE un argumento: todas las demás restricciones se mantienen con cualquier runtime.
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
 *   runtime?: string,
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
  const runtime = validarRuntime(opciones.runtime);

  return [
    'run', '--rm',
    '--name', nombre,
    '--label', ETIQUETA,
    ...(opciones.proyectoId ? ['--label', etiquetaProyecto(opciones.proyectoId)] : []),
    ...(runtime ? ['--runtime', runtime] : []),
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
