/**
 * verificar/index.js — `forge verificar`: veredicto aislado sobre el código y las pruebas que ya existen
 *
 * Sin modelo y sin gasto: este módulo NO importa proveedores de modelo, integraciones ni lee claves
 * (lo vigila tests/verificar.test.js). Compone piezas del ciclo sin copiarlas: detectores de lenguaje,
 * `comprobarEntorno`/`construirSandbox` (compartidos con `forge run`), `SandboxRunner`, las reglas
 * del enrutador y la redacción.
 *
 * Carpeta de sesión: SIEMPRE fuera del proyecto, en el temporal del sistema, derivada del hash del
 * cwd (`<tmp>/forge-verificar-<hash>/.sdd/motor/<runId>`). Así (spike S0.1) el `proyectoId` del
 * sandbox es propio de las verificaciones de ese proyecto y su barrido de huérfanos no mata los
 * contenedores del ciclo ni de otro proyecto, y no se crea nada dentro de un proyecto ajeno.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createHash, randomBytes } from 'crypto';
import { detectStack } from '../stack-detector.js';
import { leerConfigCiclo, leerRutasProtegidas } from '../ciclo/config.js';
import { redactar } from '../ciclo/redactar.js';
import { clasificar, sinPruebasEjecutadas } from '../ciclo/router.js';
import { adquirir, ErrorBloqueado } from '../ciclo/candado.js';
import { dividirComando } from '../sandbox/sandbox-runner.js';
import { comprobarEntorno, construirSandbox } from '../sandbox/crear-sandbox.js';
import { crearResultado, codigoDeSalida } from './resultado.js';

/**
 * ¿La salida de un comando que terminó con 0 dice que no ejecutó ninguna prueba?
 * Solo sirve para DEGRADAR un «pasa» a «sin pruebas»: nunca convierte un fallo en éxito, así que un
 * texto manipulado no puede mejorar el veredicto. Reconoce el resumen de node:test (`tests 0`) y el
 * de Go (todos los paquetes «[no test files]»). pytest y unittest ya se cubren con el código 5.
 * @param {string} salida
 * @returns {boolean}
 */
export function salidaSinPruebas(salida) {
  const texto = String(salida ?? '');
  // node:test: resumen «ℹ tests 0» (reporter spec) o «# tests 0» (TAP)
  const resumen = [...texto.matchAll(/^\s*(?:ℹ|#)\s+tests\s+(\d+)\s*$/gm)];
  if (resumen.length > 0) return resumen.every((m) => Number(m[1]) === 0);
  // Go: ninguna línea «ok» y al menos un «[no test files]»
  const sinArchivos = /\[no test files\]/.test(texto);
  const conPruebas = /^ok\s+\S+/m.test(texto) || /^(?:---\s+)?(?:PASS|FAIL)\b/m.test(texto);
  return sinArchivos && !conPruebas;
}

/**
 * Carpeta propia de las verificaciones de un proyecto, en el temporal del sistema.
 * @param {string} cwd  ruta absoluta del proyecto
 * @param {string} [temporal]
 */
export function carpetaDeVerificacion(cwd, temporal = os.tmpdir()) {
  const hash = createHash('sha256').update(path.resolve(cwd)).digest('hex').slice(0, 16);
  return path.join(temporal, `forge-verificar-${hash}`);
}

/**
 * @typedef {{ cwd?: string, comando?: string, cli?: import('../sandbox/docker-cli.js').DockerCli, temporal?: string,
 *   mutacion?: { archivos?: string[], desde?: string, minima?: number }, registrar?: boolean }} OpcionesVerificar
 */

/**
 * Verifica y, según las opciones, mide por mutación y registra. Con `--mutacion-minima`, una medición
 * por debajo del mínimo o no concluyente convierte «pasa» en «falla» (código 1): falla cerrado.
 * @param {OpcionesVerificar} [opciones]
 * @returns {Promise<ReturnType<typeof crearResultado>>}
 */
export async function verificar(opciones = {}) {
  const r = await ejecutar(opciones);
  const cwd = path.resolve(opciones.cwd ?? process.cwd());
  const pedida = opciones.mutacion !== undefined;
  const minima = typeof opciones.mutacion?.minima === 'number' ? opciones.mutacion.minima : null;
  if (pedida && r.mutacion === null) {
    const { juzgarMedicion } = await import('./mutacion.js');
    r.mutacion = juzgarMedicion(null, {
      minima, minConcluyentes: 0, archivos: opciones.mutacion?.archivos ?? [],
      omitida: `no se midió: la verificación terminó antes con el veredicto "${r.veredicto}"`,
    });
  }
  const m = r.mutacion;
  if (m && minima !== null && r.veredicto === 'pasa' && (m.veredicto === 'no_concluyente' || m.veredicto === 'bajo_el_minimo')) {
    const infra = m.veredicto === 'no_concluyente' && m.infraestructura === true;
    r.veredicto = infra ? 'infraestructura' : 'falla';
    r.codigoSalida = codigoDeSalida(r.veredicto);
    r.motivo = redactar(m.veredicto === 'bajo_el_minimo'
      ? `Las pruebas pasan, pero solo detectan ${m.detectadas} de ${m.probadas} cambios deliberados (${Math.round((m.puntuacion ?? 0) * 100)} %; el mínimo es ${Math.round(minima * 100)} %).`
      : `Las pruebas pasan, pero la medición por mutación no es concluyente y con --mutacion-minima eso no cuenta como éxito: ${(m.motivos ?? []).join('; ')}.`);
  }
  if (opciones.registrar === true) {
    const { registrarVerificacion } = await import('./registro.js');
    const reg = registrarVerificacion(cwd, r);
    r.registro = reg.ok === true ? { id: reg.id, archivo: reg.archivo } : { error: reg.error };
    // Pidió evidencia y no quedó: un éxito sin su registro no es lo que se pidió
    if (!reg.ok && r.codigoSalida === 0) r.codigoSalida = 1;
  }
  return r;
}

/**
 * @param {OpcionesVerificar} opciones
 * @returns {Promise<ReturnType<typeof crearResultado>>}
 */
async function ejecutar(opciones) {
  const t0 = Date.now();
  const cwd = path.resolve(opciones.cwd ?? process.cwd());
  /** @type {string[]} */
  const avisos = [];

  const config = leerConfigCiclo(cwd);
  const stack = detectStack(cwd);
  const lenguaje = stack.lenguaje;
  const comando = (opciones.comando ?? stack.test_cmd ?? '').trim();
  const rechazo = (/** @type {string} */ motivo) => crearResultado({
    veredicto: 'falla', motivo, comando: comando || null, lenguaje, duracionMs: Date.now() - t0, avisos,
  });

  if (!comando) return rechazo('No hay comando de pruebas: el proyecto no declara ninguno que se reconozca. Indícalo con --comando "<comando>".');
  // Sin intérprete de órdenes: un operador (&&, |, ;, >, <) es un error claro, y no se ejecuta nada
  try { dividirComando(comando); } catch (e) { return rechazo(e instanceof Error ? e.message : String(e)); }

  // Archivos a mutar: se resuelven ANTES de tocar Docker, para rechazar rápido y sin ejecutar nada
  /** @type {string[]} */
  let aMutar = [];
  /** @type {((ruta: string) => string|null)|undefined} */
  let originalDe;
  if (opciones.mutacion) {
    const p = await resolverArchivos(cwd, opciones.mutacion);
    if (p.ok === false) return rechazo(p.error);
    aMutar = p.archivos;
    originalDe = p.originalDe;
    if (p.aviso) avisos.push(p.aviso);
  }

  const entorno = await comprobarEntorno({ cwd, lenguaje, testCmd: comando, runtime: config.sandbox.runtime, cli: opciones.cli });
  if (entorno.ok === false) {
    return crearResultado({
      veredicto: entorno.salida === 1 ? 'falla' : 'infraestructura',
      motivo: entorno.error, comando, lenguaje, duracionMs: Date.now() - t0, avisos,
    });
  }

  const raiz = carpetaDeVerificacion(cwd, opciones.temporal);
  const runId = `verificar-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
  const dirMotor = path.join(raiz, '.sdd', 'motor', runId);

  // La carpeta de sesión es predecible (hash del proyecto): se crea privada y se comprueba que no sea un
  // enlace ni de otro usuario, para que nadie la prepare antes en un temporal compartido
  try {
    fs.mkdirSync(raiz, { recursive: true, mode: 0o700 });
    const st = fs.lstatSync(raiz);
    const mio = typeof process.getuid !== 'function' || st.uid === process.getuid();
    if (!st.isDirectory() || st.isSymbolicLink() || !mio) {
      return crearResultado({ veredicto: 'infraestructura', motivo: 'La carpeta temporal de verificación no es segura (es un enlace o pertenece a otro usuario): no se usa.', comando, lenguaje, duracionMs: Date.now() - t0, avisos });
    }
  } catch (e) {
    return crearResultado({ veredicto: 'infraestructura', motivo: `No se pudo preparar la carpeta temporal de verificación: ${e instanceof Error ? e.message : e}`, comando, lenguaje, duracionMs: Date.now() - t0, avisos });
  }

  // Una verificación a la vez por proyecto: comparten el barrido de contenedores huérfanos
  let liberar;
  try {
    liberar = adquirir(path.join(raiz, 'verificar.lock'), 'La verificación de este proyecto');
  } catch (e) {
    if (e instanceof ErrorBloqueado) {
      return crearResultado({ veredicto: 'infraestructura', motivo: e.message, comando, lenguaje, duracionMs: Date.now() - t0, avisos });
    }
    throw e;
  }

  const sandbox = construirSandbox({ runId, dirMotor, cli: entorno.cli, lenguaje, testCmd: comando, sandbox: config.sandbox });
  try {
    const barridos = await sandbox.barrerHuerfanos();
    if (barridos > 0) avisos.push(`Se eliminaron ${barridos} contenedor(es) de una verificación anterior.`);
    const sinBorrar = sandbox.barrerCopias();
    // Carga diferida: restos.js arrastra la medición por mutación, que aquí no se necesita para empezar
    const { barrerMutacionesDeProcesosMuertos } = await import('../ciclo/restos.js');
    barrerMutacionesDeProcesosMuertos();
    if (sinBorrar.length > 0) avisos.push(`No se pudieron borrar ${sinBorrar.length} copia(s) de trabajo anteriores: ${sinBorrar.join(', ')}`);

    const r = await sandbox.test(cwd);
    const pruebas = { hayPruebas: true, pruebasIntactas: true };
    const categoria = clasificar(r, pruebas);
    /** @type {import('./resultado.js').Veredicto} */
    let veredicto;
    let motivo = null;
    if (categoria === 'infra_error') {
      veredicto = 'infraestructura';
      motivo = r.stderr ? String(r.stderr).trim().split('\n').pop() ?? null : 'el entorno de ejecución falló';
    } else if (sinPruebasEjecutadas(r, comando)) {
      veredicto = 'sin_pruebas';
      motivo = 'El comando terminó sin encontrar ninguna prueba (código 5).';
    } else if (categoria === 'pass') {
      if (salidaSinPruebas([r.stdout, r.stderr].filter(Boolean).join('\n'))) {
        veredicto = 'sin_pruebas';
        motivo = 'El comando terminó con 0 pero su salida dice que no ejecutó ninguna prueba.';
      } else {
        veredicto = 'pasa';
      }
    } else {
      veredicto = 'falla';
      if (categoria === 'timeout') motivo = 'Las pruebas superaron el tiempo máximo.';
    }

    /** @type {Record<string, any>|null} */
    let mutacion = null;
    if (opciones.mutacion && veredicto === 'pasa') {
      const { medir, juzgarMedicion } = await import('./mutacion.js');
      const minima = typeof opciones.mutacion.minima === 'number' ? opciones.mutacion.minima : null;
      try {
        mutacion = await medir({
          cwd, archivos: aMutar, runner: sandbox, motor: config.motor,
          vetadas: leerRutasProtegidas(cwd), originalDe, minima, dirTemporal: opciones.temporal,
        });
      } catch (e) {
        mutacion = juzgarMedicion(null, {
          minima, minConcluyentes: config.motor.mutacion_min_concluyentes, archivos: aMutar,
          omitida: `la medición falló: ${e instanceof Error ? e.message : String(e)}`,
        });
      }
      if (mutacion.copiaSinBorrar) avisos.push('La copia temporal de la medición por mutación no se pudo borrar del todo.');
    }

    if (sandbox.copiasSinBorrar.length > 0) avisos.push(`No se pudieron borrar ${sandbox.copiasSinBorrar.length} copia(s) de trabajo: ${sandbox.copiasSinBorrar.join(', ')}`);
    return crearResultado({
      veredicto, motivo,
      codigoPruebas: r.exitCode,
      comando, lenguaje,
      imagen: sandbox.ultimaImagen?.imagen ?? null,
      duracionMs: Date.now() - t0,
      cortePorTiempo: r.timedOut,
      cortePorMemoria: r.oomKilled,
      salida: [r.stdout, r.stderr].filter(Boolean).join('\n'),
      avisos, mutacion,
    });
  } finally {
    liberar();
    // Sin restos en el temporal: la sesión se borra; la carpeta del proyecto solo si quedó vacía
    if (sandbox.copiasSinBorrar.length === 0) {
      try { fs.rmSync(dirMotor, { recursive: true, force: true }); } catch { /* se barre en la próxima */ }
      for (const d of [path.dirname(dirMotor), path.dirname(path.dirname(dirMotor)), raiz]) {
        try { fs.rmdirSync(d); } catch { break; }
      }
    }
  }
}

/**
 * Archivos que se mutan: `--archivos` (vía principal) manda sobre `--desde`; sin ninguno, se rechaza.
 * @param {string} cwd
 * @param {{ archivos?: string[], desde?: string, minima?: number }} m
 * @returns {Promise<{ ok: true, archivos: string[], originalDe?: (ruta: string) => string|null, aviso?: string } | { ok: false, error: string }>}
 */
async function resolverArchivos(cwd, m) {
  const dadas = (m.archivos ?? []).map((a) => String(a).trim().replace(/\\/g, '/')).filter(Boolean);
  if (dadas.length > 0) return { ok: true, archivos: [...new Set(dadas)] };
  if (m.desde === undefined || m.desde === '') {
    return { ok: false, error: '--mutacion necesita saber qué medir: indica los archivos con --archivos <a,b> o los cambiados desde una referencia con --desde <ref>. No se muta el proyecto entero.' };
  }
  const { cambiosDesde } = await import('./cambios.js');
  const { validarRuta } = await import('../ciclo/protocolo-archivos.js');
  const { lenguajeDe } = await import('../ciclo/mutacion.js');
  const vetadas = leerRutasProtegidas(cwd);
  const c = await cambiosDesde(cwd, m.desde, {
    esValida: (ruta) => Boolean(lenguajeDe(ruta)) && validarRuta(cwd, ruta, { vetadas }).ok === true,
  });
  if (c.ok === false) return { ok: false, error: c.error };
  return {
    ok: true, archivos: c.archivos, originalDe: c.originalDe,
    aviso: `--desde ${m.desde} (${c.commit.slice(0, 12)}): ${c.archivos.length} archivo(s) añadidos o modificados; los borrados no se miden. Con core.autocrlf o filtros puede haber archivos de más.`,
  };
}
