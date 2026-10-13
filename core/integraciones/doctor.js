/**
 * doctor.js — Diagnóstico de las integraciones para `forge doctor` (F4.2, CA-004-02)
 *
 * Por cada proveedor ACTIVO (modo distinto de `apagado`) informa de:
 *   - la variable de entorno del token: definida o no, NUNCA su valor (ni siquiera parcial);
 *   - el host (HTTPS siempre; solo ese host recibe peticiones), el modo y la lista de destinos;
 *   - el alcance del token:
 *       GitLab con token personal  → ámbitos reales (`comprobarAlcance`), SOLO con `red: true`
 *                                    (`forge doctor --integraciones-red`). Si exceden lo que el modo
 *                                    necesita, avisa y BLOQUEA la escritura de ese proveedor hasta
 *                                    que se corrija (`.sdd/integraciones/alcance.json`, que
 *                                    `aprobar` respeta);
 *       GitHub y Jira              → «no comprobable»: ninguna de las dos plataformas ofrece un
 *                                    endpoint que informe del alcance de un token (spikes S0.2).
 *                                    Se dice y se muestra el alcance que el proyecto declaró en
 *                                    `<proveedor>_alcance`, para que una persona lo revise.
 *
 * Sin integraciones activas no hace nada (ni lee el entorno). Por defecto no sale a la red: la única
 * petición posible es `comprobarAlcance` de GitLab con `red: true`, y pasa por la auditoría
 * (interruptor y tope incluidos). Quien llama aporta `crearProveedor`, que construye el adaptador
 * (y es lo único que conoce las URL de prueba).
 */

import { ErrorConfigIntegraciones, leerConfigIntegraciones, leerToken, leerUsuario } from './config.js';
import { AuditoriaIntegraciones, estadoInterruptor } from './auditoria.js';
import { escribirAlcance, leerAlcance, listarPendientes, sesionDeIntegraciones } from './aprobacion.js';

/** @typedef {{ nivel: 'ok'|'aviso'|'error'|'info', texto: string }} LineaDoctor */

/** Ámbitos que necesita cada modo con un token personal de GitLab (informe de spikes §2.2). */
const AMBITO_NECESARIO = { solo_lectura: 'read_api', comentar: 'api', proponer: 'api' };

/** @param {unknown} t */
const seguro = (t) => String(t ?? '').replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);

/**
 * @param {Object} o
 * @param {string} o.cwd
 * @param {Record<string, string|undefined>} [o.env]
 * @param {boolean} [o.red]             permitir la única petición de red del diagnóstico (alcance de GitLab)
 * @param {(cfg: import('./config.js').ConfigProveedor) => import('./puerto.js').ProveedorDeTrabajo} [o.crearProveedor]
 * @param {import('./auditoria.js').AuditoriaIntegraciones} [o.auditoria]
 * @returns {Promise<{ activo: boolean, lineas: LineaDoctor[], problemas: number, bloqueos: string[] }>}
 */
export async function diagnosticarIntegraciones(o) {
  const { cwd, env = process.env } = o;
  /** @type {LineaDoctor[]} */
  const lineas = [];
  let problemas = 0;
  const ok = (/** @type {string} */ t) => lineas.push({ nivel: 'ok', texto: t });
  const info = (/** @type {string} */ t) => lineas.push({ nivel: 'info', texto: t });
  const aviso = (/** @type {string} */ t) => { lineas.push({ nivel: 'aviso', texto: t }); };
  const problema = (/** @type {string} */ t) => { problemas++; aviso(t); };

  /** @type {import('./config.js').ConfigIntegraciones} */
  let config;
  try {
    config = leerConfigIntegraciones(cwd);
  } catch (e) {
    if (!(e instanceof ErrorConfigIntegraciones)) throw e;
    problemas++;
    aviso('Configuración de integraciones no válida (las integraciones no arrancarán):');
    for (const p of e.problemas) aviso(`  - ${seguro(p)}`);
    return { activo: true, lineas, problemas, bloqueos: [] };
  }
  if (!config.activa) return { activo: false, lineas: [], problemas: 0, bloqueos: [] };

  for (const a of config.avisos) aviso(seguro(a));

  const auditoria = o.auditoria ?? new AuditoriaIntegraciones({ cwd, tope: config.topes.operacionesPorSesion, sesion: sesionDeIntegraciones(cwd), env });
  const sw = estadoInterruptor(cwd, env);
  if (sw.apagado) aviso(`Interruptor: APAGADO (${sw.origen === 'variable' ? 'FORGE_INTEGRACIONES=apagado' : 'archivo .sdd/integraciones/apagado'}); no se hace ninguna operación.`);
  else info('Interruptor: encendido');
  info(`Tope de operaciones por sesión y proveedor: ${config.topes.operacionesPorSesion}`);

  for (const nombre of /** @type {const} */ (['github', 'gitlab', 'jira'])) {
    const cfg = config.proveedores[nombre];
    if (cfg.modo === 'apagado') continue;
    const p = nombre;
    info(`${p}: modo «${cfg.modo}»${nombre === 'jira' && cfg.modo === 'proponer' ? ' (Jira no tiene solicitudes de cambio: «proponer» se trata como «comentar»)' : ''}`);
    ok(`${p}: host ${cfg.host}, solo HTTPS (únicamente ese host recibe peticiones)`);
    info(`${p}: destinos permitidos (${cfg.destinos.length}): ${cfg.destinos.join(', ')}`);

    // Variables de entorno: el nombre sí, el valor nunca
    let tieneToken = false;
    let tieneUsuario = nombre !== 'jira';
    if (cfg.tokenEnv) {
      tieneToken = leerToken(cfg, env) !== null;
      if (tieneToken) ok(`${p}: variable ${cfg.tokenEnv} definida (no se muestra su valor)`);
      else problema(`${p}: la variable ${cfg.tokenEnv} no está definida: no se podrá leer ni publicar`);
    }
    if (nombre === 'jira' && cfg.usuarioEnv) {
      tieneUsuario = leerUsuario(cfg, env) !== null;
      if (tieneUsuario) ok(`${p}: variable ${cfg.usuarioEnv} definida (usuario de servicio; no se muestra su valor)`);
      else problema(`${p}: la variable ${cfg.usuarioEnv} no está definida: no se podrá leer ni publicar`);
    }
    const credenciales = tieneToken && tieneUsuario;

    // Alcance del token
    if (nombre === 'gitlab') {
      await alcanceGitLab();
    } else {
      /** @type {{ estado?: string, motivo?: string }|null} */
      let a = null;
      if (credenciales && o.crearProveedor) {
        try { a = await o.crearProveedor(cfg).comprobarAlcance(); } catch { a = null; }
      }
      if (a && a.estado && a.estado !== 'no_comprobable') {
        aviso(`${p}: ${seguro(a.motivo ?? 'el alcance del token no se puede comprobar')}`);
      } else {
        info(`${p}: el alcance del token NO se puede comprobar (${nombre === 'github' ? 'GitHub' : 'Jira'} no ofrece ningún endpoint que lo informe): revísalo en la plataforma`);
      }
      if (cfg.alcance) info(`${p}: alcance declarado en ${p}_alcance: «${seguro(cfg.alcance)}» (lo declara el proyecto; FORGE no puede verificarlo)`);
      else aviso(`${p}: no hay alcance declarado; descríbelo en ${p}_alcance (en .sdd/sdd.config.yaml) para que quien revise vea qué permisos se pretendían`);
    }

    if (nombre === 'jira') {
      info('jira: Jira no tiene solicitudes de cambio: el modo «proponer» equivale a «comentar» y una propuesta no se puede publicar allí');
      info('jira: solo se admite un token de API SIN ámbitos contra <sitio>.atlassian.net; un token con ámbitos usa otra base de la API (api.atlassian.com/ex/jira/{cloudId}) y no está soportado en esta entrega');
      if (cfg.alcance && /(?<!\p{L})(?:[áa]mbitos?|scopes?|oauth)(?!\p{L})/iu.test(cfg.alcance) && !/(?<!\p{L})sin\s+(?:[áa]mbitos?|scopes?)(?!\p{L})/iu.test(cfg.alcance)) {
        problema('jira: el alcance declarado parece ser el de un token CON ámbitos, que no está soportado: usa un token de API clásico (sin ámbitos) de un usuario de servicio');
      }
    }

    async function alcanceGitLab() {
      const previo = leerAlcance(cwd).gitlab;
      if (!o.red) {
        info('gitlab: alcance del token sin comprobar (sin red). Para comprobarlo con GitLab: «forge doctor --integraciones-red» (una petición de solo lectura a /personal_access_tokens/self)');
        if (previo?.bloqueaEscritura) aviso(`gitlab: la escritura sigue BLOQUEADA por la comprobación del ${seguro(previo.comprobado)} (el token excedía lo necesario); corrígelo y vuelve a ejecutar «forge doctor --integraciones-red»`);
        return;
      }
      if (!credenciales || !o.crearProveedor) {
        info('gitlab: sin token no se puede comprobar el alcance');
        return;
      }
      if (sw.apagado) {
        info('gitlab: el interruptor está apagado: no se comprueba el alcance');
        return;
      }
      /** @type {any} */
      let r;
      try {
        const prov = o.crearProveedor(cfg);
        r = await auditoria.ejecutar({ proveedor: 'gitlab', operacion: 'comprobar_alcance', destino: 'gitlab', accion: () => prov.comprobarAlcance() });
      } catch (e) {
        problema(`gitlab: no se pudo comprobar el alcance del token (${seguro(/** @type {any} */ (e)?.codigo ?? 'error')}): ${seguro(/** @type {any} */ (e)?.message)}`);
        return;
      }
      if (r?.estado !== 'comprobado') {
        info(`gitlab: el alcance del token no se puede comprobar (${seguro(r?.motivo ?? 'no es un token personal o no admite la consulta')}); revísalo en GitLab`);
        if (cfg.alcance) info(`gitlab: alcance declarado en gitlab_alcance: «${seguro(cfg.alcance)}»`);
        return;
      }
      const ambitos = /** @type {string[]} */ (r.ambitos);
      const necesario = AMBITO_NECESARIO[/** @type {'comentar'} */ (cfg.modo)] ?? 'read_api';
      info(`gitlab: ámbitos del token: ${ambitos.join(', ') || '(ninguno)'} · el modo «${cfg.modo}» necesita: ${necesario}`);
      // Un token que no alcanza para el modo no puede escribir: lo primero que hay que decir es eso.
      // El exceso (más ámbitos de los necesarios) solo se trata como tal cuando el token sí alcanza.
      const insuficiente = r.suficiente === false;
      const exceso = r.exceso === true && !insuficiente;
      if (insuficiente) {
        problema(`gitlab: alcance insuficiente para el modo «${cfg.modo}»: falta ${necesario} (tiene: ${ambitos.join(', ') || 'ninguno'})`);
      } else if (exceso) {
        problema(`gitlab: el token excede lo necesario para el modo «${cfg.modo}» (tiene: ${ambitos.join(', ')}; basta con ${necesario}). La escritura de gitlab queda BLOQUEADA hasta que reduzcas sus ámbitos y vuelvas a comprobar`);
      } else {
        ok(`gitlab: el alcance del token es el justo para el modo «${cfg.modo}»`);
      }
      escribirAlcance(cwd, 'gitlab', {
        exceso, ambitos, suficiente: !insuficiente,
        ...(exceso ? { motivo: `ámbitos de más para el modo ${cfg.modo}` } : {}),
      });
    }
  }

  // Lo que ya está bloqueado por una comprobación anterior
  const activos = new Set(Object.values(config.proveedores).filter((c) => c.modo !== 'apagado').map((c) => c.nombre));
  const bloqueos = Object.entries(leerAlcance(cwd)).filter(([k, v]) => activos.has(/** @type {any} */ (k)) && v.bloqueaEscritura).map(([k]) => k);

  // Publicaciones en cola
  const cola = listarPendientes(cwd);
  const cuenta = (/** @type {string} */ e) => cola.filter((x) => x.estado === e).length;
  info(`Publicaciones: ${cuenta('pendiente')} pendiente(s) de aprobar, ${cuenta('fallido')} fallida(s) reintentable(s), ${cuenta('publicado')} publicada(s)`);
  if (cuenta('fallido') > 0) aviso('Hay publicaciones fallidas: «forge integraciones pendientes» y «forge integraciones aprobar <id>» para reintentar');

  return { activo: true, lineas, problemas, bloqueos };
}
