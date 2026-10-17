/**
 * herramientas-verificar.js — La herramienta MCP `verificar` (spec 2026-10-14-ciclo-por-mcp, fase 1)
 *
 * Es `forge verificar` visto desde otra herramienta: llama a core/verificar/index.js, el mismo código,
 * y devuelve su resultado (formato 1). Sin modelo, sin gasto, sin red, sin claves: este módulo no
 * importa proveedores de modelo, integraciones ni contrato (lo vigila tests/mcp-verificar.test.js).
 *
 * Diseño: el llamante es un modelo que puede estar leyendo texto hostil, así que el esquema se diseña
 * como si lo rellenara un atacante.
 *   - Único argumento: `mutacion_archivos` (lista de rutas del proyecto). No hay `comando`, `cwd`,
 *     `desde`, ruta absoluta ni nada que llegue a una orden. El proyecto es el del arranque (--cwd).
 *   - `desde` queda fuera a propósito: obliga a ejecutar `git` con un texto del llamante como referencia
 *     y a leer el repositorio (que controla el repo, no el usuario). Con `archivos` el llamante solo
 *     puede nombrar archivos que ya existen en el proyecto y pasan `validarRuta`.
 *   - Nunca descarga ni construye imágenes por orden de un cliente: sin la imagen ya preparada
 *     (`fragua verificar` una vez en el equipo) devuelve un error de infraestructura.
 *   - Límites propios del servidor, del entorno del usuario (limites.js): tiempo, tamaño, cupos.
 *   - Cancelación y tiempo máximo detienen el contenedor por nombre (`kill` + `rm -f`).
 */

import * as fs from 'fs';
import * as path from 'path';
import { ErrorBloqueado } from '../ciclo/candado.js';
import { adquirirProyecto } from './candado-proyecto.js';
import { leerRutasProtegidas } from '../ciclo/config.js';
import { validarRuta } from '../ciclo/protocolo-archivos.js';
import { cola } from '../ciclo/redactar.js';
import { directorioDeEstado } from '../estado-usuario.js';
import { auditar, estadoInterruptor, leerLimites, reservarCupo } from './limites.js';

export const MAX_ARCHIVOS_MUTACION = 5;
const CONSULTA_MS = 15_000;

/** @param {string} codigo @param {string} motivo */
function rechazo(codigo, motivo) {
  return { texto: JSON.stringify({ formato: 1, veredicto: 'no_ejecutada', codigo, motivo }), error: true };
}

/**
 * Cubre a un DockerCli: nunca `pull` ni `build` (red y construcción por orden de un cliente), sigue los
 * contenedores que lanza para poder matarlos, y tras `matar()` no deja lanzar ninguno más.
 * Devuelve un objeto derivado: el DockerCli original no se toca (puede reutilizarse).
 * @param {import('../sandbox/docker-cli.js').DockerCli} cli
 */
export function protegerCli(cli) {
  const base = cli.ejecutar.bind(cli);
  /** @type {Set<string>} */
  const nombres = new Set();
  let cortado = false;
  const derivado = Object.create(cli);
  derivado.ejecutar = async (/** @type {string[]} */ args, /** @type {any} */ opciones) => {
    const orden = args[0];
    if (orden === 'pull' || orden === 'build') {
      return { code: 1, stdout: '', stderr: `El servidor MCP no descarga ni construye imágenes por orden de un cliente: prepara la imagen una vez con "fragua verificar" en tu terminal (orden "${orden}" rechazada).`, timedOut: false };
    }
    if (orden === 'run') {
      if (cortado) return { code: 125, stdout: '', stderr: 'verificación cancelada o fuera de tiempo: no se lanzan más contenedores', timedOut: false };
      const i = args.indexOf('--name');
      if (i !== -1 && args[i + 1]) nombres.add(String(args[i + 1]));
    }
    return base(args, opciones);
  };
  return {
    cli: /** @type {import('../sandbox/docker-cli.js').DockerCli} */ (derivado),
    nombres,
    /** Detiene y elimina por nombre los contenedores lanzados; no deja lanzar más. */
    async matar() {
      cortado = true;
      for (const nombre of nombres) {
        try { await base(['kill', nombre], { timeoutMs: CONSULTA_MS }); } catch { /* ya no está */ }
        try { await base(['rm', '-f', nombre], { timeoutMs: CONSULTA_MS }); } catch { /* ya no está */ }
      }
    },
  };
}

/**
 * Texto de la respuesta, acotado a `max` bytes y siempre JSON válido.
 * @param {Record<string, any>} r  resultado de core/verificar
 * @param {number} max
 */
export function textoAcotado(r, max) {
  let t = JSON.stringify(r);
  if (Buffer.byteLength(t) <= max) return t;
  /** @type {Record<string, any>} */
  const copia = { ...r, recortado: true };
  const sobra = () => Buffer.byteLength(JSON.stringify(copia)) - max;
  copia.salida = cola(String(copia.salida ?? ''), Math.max(0, Buffer.byteLength(String(copia.salida ?? '')) - sobra() - 64));
  if (sobra() > 0) { copia.avisos = []; copia.mutacion = copia.mutacion ? { veredicto: copia.mutacion.veredicto ?? null, recortado: true } : copia.mutacion; copia.salida = cola(String(copia.salida), 256); }
  t = JSON.stringify(copia);
  if (Buffer.byteLength(t) <= max) return t;
  // Último recurso: lo imprescindible
  return JSON.stringify({
    formato: r.formato, veredicto: r.veredicto, codigoSalida: r.codigoSalida, recortado: true,
    motivo: cola(String(r.motivo ?? ''), Math.max(0, Math.min(200, max - 200))),
  });
}

/**
 * @param {{
 *   cwd: string,
 *   env?: Record<string, string|undefined>,
 *   cli?: import('../sandbox/docker-cli.js').DockerCli,
 *   temporal?: string,
 *   verificarFn?: (o: any) => Promise<Record<string, any>>,
 * }} opciones
 * @returns {import('./protocolo.js').Herramienta}
 */
export function crearHerramientaVerificar(opciones) {
  const env = opciones.env ?? process.env;
  let cwd = path.resolve(opciones.cwd);
  try { cwd = fs.realpathSync(cwd); } catch { /* el proyecto no existe: verificar lo dirá */ }
  let enCurso = false;
  /** @type {string|null} */
  let dirEstado = null;

  return {
    name: 'verificar',
    description:
      'Ejecuta las pruebas del proyecto en un contenedor aislado (sin red, sin privilegios, con límites) y devuelve un veredicto: '
      + 'pasa, falla, sin_pruebas (cero pruebas ejecutadas, no es éxito) o infraestructura (el entorno no pudo ejecutar). '
      + 'No acepta comandos, rutas absolutas ni otro proyecto: usa el comando de pruebas que Fragua detecta en el proyecto de este servidor. '
      + 'No llama a ningún modelo, no escribe en el proyecto, no publica y no gasta. '
      + 'Una verificación a la vez; con límite de tiempo, de tamaño de respuesta y de llamadas por hora y por día. '
      + 'Con `mutacion_archivos` (hasta 5 archivos del proyecto) mide además si las pruebas detectan cambios deliberados en esos archivos.',
    inputSchema: {
      type: 'object',
      properties: {
        mutacion_archivos: {
          type: 'array',
          items: { type: 'string', maxLength: 512 },
          minItems: 1,
          maxItems: MAX_ARCHIVOS_MUTACION,
          description: 'Opcional. Rutas relativas, con "/", de archivos existentes del proyecto cuya cobertura se mide por mutación',
        },
      },
      additionalProperties: false,
    },

    async ejecutar(args, senal) {
      const t0 = Date.now();
      const limites = leerLimites(env);
      /** @type {string[]} */
      let archivos = [];
      let veredicto = 'no_ejecutada';
      const cerrar = (/** @type {{ texto: string, error?: boolean }} */ r, /** @type {string} */ v = veredicto) => {
        if (dirEstado) auditar(dirEstado, { herramienta: 'verificar', argumentos: { mutacion_archivos: archivos.slice(0, MAX_ARCHIVOS_MUTACION).map((a) => String(a).slice(0, 200)) }, veredicto: v, duracionMs: Date.now() - t0 });
        return r;
      };

      try { dirEstado = directorioDeEstado(cwd, env); } catch { dirEstado = null; }

      const apagado = estadoInterruptor(env, dirEstado);
      if (apagado.apagado) return cerrar(rechazo('apagado', `La herramienta está apagada: ${apagado.motivo}.`));

      // 1. Argumentos: ya pasaron el esquema; ahora cada ruta contra las reglas del ciclo
      if (args?.mutacion_archivos !== undefined) {
        let vetadas = [];
        try { vetadas = leerRutasProtegidas(cwd); } catch { /* sin vetos extra del proyecto: los fijos siguen */ }
        const vistos = new Set();
        for (const ruta of args.mutacion_archivos) {
          if (typeof ruta !== 'string' || ruta === '' || ruta !== ruta.trim() || /[\0\r\n]/.test(ruta)) return cerrar(rechazo('ruta_no_valida', 'Una de las rutas de mutacion_archivos no es válida.'));
          const v = validarRuta(cwd, ruta, { vetadas });
          if (v.ok === false) return cerrar(rechazo('ruta_no_valida', `mutacion_archivos: "${ruta.slice(0, 80)}" no se acepta (${v.motivo}).`));
          let info;
          try { info = fs.lstatSync(v.absoluta); } catch { info = null; }
          if (!info || !info.isFile()) return cerrar(rechazo('ruta_no_valida', `mutacion_archivos: "${v.rutaPosix}" no es un archivo existente del proyecto.`));
          if (!vistos.has(v.rutaPosix)) { vistos.add(v.rutaPosix); archivos.push(v.rutaPosix); }
        }
      }

      if (enCurso) return cerrar(rechazo('ocupado', 'Ya hay una verificación en curso en este proyecto. No se encola: espera a que termine.'));

      if (!dirEstado) return cerrar(rechazo('contador_invalido', 'No hay estado del usuario donde llevar el contador de uso; sin contador no se ejecuta nada.'));

      // 2. Candado del proyecto, el mismo que usa `ejecutar_pruebas` y los ciclos. Va ANTES del cupo:
      // un proyecto «ocupado» (o un candado plantado por el repo) no debe gastar el cupo del usuario
      let liberar;
      try {
        liberar = adquirirProyecto(path.join(cwd, '.sdd', 'motor', 'proyecto.lock'), 'El entorno aislado de este proyecto');
      } catch (e) {
        if (e instanceof ErrorBloqueado) return cerrar(rechazo('ocupado', e.message));
        return cerrar(rechazo('ocupado', `No se pudo tomar el candado del proyecto: ${e instanceof Error ? e.message : e}`));
      }

      // 3. Cupo (contador firmado en el estado del usuario). Falla cerrado
      const cupo = reservarCupo(dirEstado, limites);
      if (cupo.ok === false) { liberar(); return cerrar(rechazo(cupo.codigo, cupo.motivo)); }
      enCurso = true;

      // 4. Verificar, con tiempo máximo y cancelación que detienen el contenedor
      let cli = opciones.cli;
      if (!cli) { const { DockerCli } = await import('../sandbox/docker-cli.js'); cli = new DockerCli(); }
      const guardia = protegerCli(cli);
      const verificarFn = opciones.verificarFn ?? (await import('../verificar/index.js')).verificar;
      const trabajo = Promise.resolve()
        .then(() => verificarFn({ cwd, cli: guardia.cli, temporal: opciones.temporal, ...(archivos.length > 0 ? { mutacion: { archivos } } : {}) }))
        .then((r) => ({ r }), (e) => ({ e }));
      const soltar = () => { enCurso = false; liberar(); };

      /** @type {NodeJS.Timeout|undefined} */
      let reloj;
      /** @type {'tiempo'|'cancelada'|null} */
      let corte = null;
      const cortada = new Promise((resolver) => {
        reloj = setTimeout(() => { corte = 'tiempo'; resolver(null); }, limites.timeout_s * 1000);
        if (senal?.aborted) { corte = 'cancelada'; resolver(null); }
        senal?.addEventListener('abort', () => { corte = 'cancelada'; resolver(null); }, { once: true });
      });
      const salida = await Promise.race([trabajo, cortada]);
      clearTimeout(reloj);

      if (salida === null) {
        // Se corta: el contenedor se detiene por nombre y los candados se sueltan cuando el trabajo termine
        await guardia.matar();
        trabajo.then(soltar, soltar);
        return cerrar(
          corte === 'tiempo'
            ? rechazo('tiempo', `La verificación superó el tiempo máximo del servidor (${limites.timeout_s} s) y se detuvo el contenedor. Si las pruebas necesitan más, el usuario puede subir FRAGUA_MCP_TIMEOUT_S.`)
            : rechazo('cancelada', 'Verificación cancelada por el cliente: se detuvo el contenedor.'),
          corte ?? 'cancelada',
        );
      }
      soltar();
      if ('e' in salida) {
        return cerrar(rechazo('fallo_interno', `La verificación falló por dentro: ${cola(String(salida.e instanceof Error ? salida.e.message : salida.e), 300)}`), 'infraestructura');
      }
      const r = salida.r;
      return cerrar({ texto: textoAcotado(r, limites.salida_max_bytes), ...(r.veredicto === 'infraestructura' ? { error: true } : {}) }, String(r.veredicto));
    },
  };
}
