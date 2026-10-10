/**
 * nodos.js — Los nodos del ciclo verificado
 *
 * Los nodos `mutacion` y `refuerzo` (ADR-20) viven en pruebas-confiables.js y se registran aquí.
 *
 * Cada nodo es `(estado, deps) => Promise<Partial<EstadoCiclo>>`. No decide a
 * dónde se va después (eso es grafo.js), salvo cuando no puede continuar: en
 * ese caso devuelve `revision`, y el grafo lleva a revisión humana.
 *
 * `deps`:
 *   llamar({ agente, modeloAlias, proveedorLocal, userPrompt, extraContext })
 *       → { ok, output, inputTokens, outputTokens, modelo, proveedor, error }
 *   aliasDe(agente) → alias de modelo del agente (opus | sonnet | haiku | id)
 *   ajustarGasto?(presupuesto) → el presupuesto con el gasto real de la sesión
 *   runner.test(cwd) → resultado de ejecutar las pruebas en el entorno aislado
 *   recuperar(entrada) → contexto y texto (ver core/recuperacion)
 *   respaldo.registrar(ruta) / respaldo.restaurar()
 *   log.append(tipo, payload, meta)
 *   config   → leerConfigCiclo()
 *   testCmd  → comando de pruebas del proyecto
 *   specPath?, vetadas?
 */

import * as fs from 'fs';
import * as path from 'path';
import { POR_DEFECTO } from './config.js';
import { CONTRATO_CODER, CONTRATO_PLANNER, CONTRATO_QA } from './contratos.js';
import { huellaDeSalida } from './huella.js';
import { ampliar, ErrorConsumo, limitarNivel, modeloEfectivo, puedeLlamar, registrar, sinPrecioConocido } from './presupuesto.js';
import { aplicarArchivos, canonica, extraerBloque, huellasAlteradas, validarRuta } from './protocolo-archivos.js';
import { clasificar, detalleSinPruebas, sinProgreso, sinPruebasEjecutadas } from './router.js';
import { cola, redactar } from './redactar.js';
import { detectarSospecha } from './sospecha.js';
import { coderPorTurnos, modoImplementador } from './turnos.js';
import { DETALLE_PRUEBAS_NO_FALLAN, mutacion, refuerzo, seccionPasabanAntes, seccionPasanSinImplementacion } from './pruebas-confiables.js';
import { listarArchivosIndexables } from '../recuperacion/indice-vectorial.js';

/** @typedef {import('./estado.js').EstadoCiclo} EstadoCiclo */

const DECISIONES = ['continuar', 'aceptar', 'abortar'];

/**
 * @param {string} motivo
 * @param {string} reanudarEn  nodo desde el que se sigue si la persona decide continuar
 * @param {string} [detalle]
 */
export function pedirRevision(motivo, reanudarEn, detalle) {
  return {
    revision: { motivo, reanudarEn, ...(detalle ? { detalle } : {}) },
    resultado: /** @type {const} */ ('revision_pendiente'),
  };
}

/**
 * Llama a un agente contabilizando el gasto. Nunca inicia una llamada con el
 * presupuesto agotado.
 * @returns {Promise<{ salida: string, presupuesto: any } | { fallo: Partial<EstadoCiclo> }>}
 */
async function invocar(estado, deps, presupuesto, nodo, { agente, userPrompt, extraContext, clavePrompt }) {
  const efectivo = modeloEfectivo(limitarNivel(deps.aliasDe(agente), deps.config.motor?.nivel_maximo), presupuesto, deps.config.presupuesto.degradar_a);
  // Una respuesta ya pagada y guardada en el diario no cuesta nada: se usa aunque haya agotado el tope
  const yaPagada = deps.respondida?.({ agente, userPrompt, extraContext, ...(clavePrompt ? { clavePrompt } : {}) }) === true;
  if (!yaPagada && !puedeLlamar(presupuesto)) {
    return { fallo: { presupuesto, ...pedirRevision('presupuesto', nodo) } };
  }
  const r = await deps.llamar({ agente, modeloAlias: efectivo.alias, proveedorLocal: efectivo.proveedorLocal, userPrompt, extraContext, ...(clavePrompt ? { clavePrompt } : {}) });
  if (!r.ok) {
    return { fallo: { presupuesto, ...pedirRevision('infraestructura', nodo, `El proveedor de modelos falló: ${cola(String(r.error ?? 'sin detalle'), 600)}`) } };
  }

  let siguiente;
  try {
    siguiente = registrar(presupuesto, { proveedor: r.proveedor, modelo: r.modelo, inputTokens: r.inputTokens, outputTokens: r.outputTokens, cacheCreationTokens: r.cacheCreationTokens, cacheReadTokens: r.cacheReadTokens }, { precios: deps.config.precios });
  } catch (e) {
    if (!(e instanceof ErrorConsumo)) throw e;
    return { fallo: { presupuesto, ...pedirRevision('infraestructura', nodo, cola(String(e.message), 600)) } };
  }
  // Un modelo sin precio se cobra al más caro conocido, y se avisa con su nombre (ADR-19)
  if (sinPrecioConocido(r, deps.config.precios)) {
    deps.log.append('ciclo:precio_desconocido', { modelo: r.modelo, proveedor: r.proveedor, aviso: `El modelo "${r.modelo}" no tiene precio conocido: se cobra al más caro conocido. Indica su precio en precios: de sdd.config.yaml.` }, { taskId: estado.taskId });
  }
  // El gasto de la sesión suma lo de todas las tareas, también las cortadas
  if (deps.ajustarGasto) siguiente = deps.ajustarGasto(siguiente);

  if (presupuesto.estado === 'ok' && siguiente.estado !== 'ok') {
    deps.log.append('ciclo:presupuesto_degradado', { gastado_usd: siguiente.gastado_usd, umbral_usd: siguiente.umbral_degradacion_usd }, { taskId: estado.taskId });
  }
  return { salida: r.output, presupuesto: siguiente };
}

/**
 * Llama al agente y aplica los archivos que devuelve. Si la salida no se puede
 * interpretar, lo intenta una vez más antes de pedir revisión.
 */
export async function generarArchivos(estado, deps, nodo, { agente, userPrompt, contrato, rol, pruebas, clavePrompt }) {
  let presupuesto = estado.presupuesto;
  let error = '';

  for (let intento = 0; intento < 2; intento++) {
    const reintento = intento === 0 ? '' : `\n\n## Tu respuesta anterior no se pudo interpretar\n${error}\nResponde solo con el bloque JSON pedido.`;
    const r = await invocar(estado, deps, presupuesto, nodo, {
      agente, userPrompt: userPrompt + reintento, extraContext: contrato,
      ...(clavePrompt ? { clavePrompt: clavePrompt + reintento } : {}),
    });
    if ('fallo' in r) return { fallo: r.fallo };
    presupuesto = r.presupuesto;

    const bloque = extraerBloque(r.salida);
    if (bloque.ok === false) { error = bloque.error; continue; }

    const aplicado = aplicarArchivos(estado.cwd, bloque.archivos, {
      rol, pruebas, vetadas: deps.vetadas,
      antesDeEscribir: (ruta) => deps.respaldo.registrar(ruta),
    });
    for (const rechazo of aplicado.rechazados) {
      deps.log.append('ciclo:escritura_rechazada', { nodo, ruta: rechazo.ruta, motivo: rechazo.motivo }, { taskId: estado.taskId });
    }
    return { presupuesto, aplicado };
  }

  return { fallo: { presupuesto, ...pedirRevision('salida_invalida', nodo, `El agente "${agente}" no devolvió una salida utilizable: ${error}`) } };
}

async function textoDeContexto(estado, deps) {
  const r = await deps.recuperar({
    cwd: estado.cwd, tarea: estado.tarea, plan: estado.plan,
    maxBytes: deps.config.motor.contexto_max_bytes, specPath: deps.specPath, vetadas: deps.vetadas,
    embeddings: deps.config.motor.embeddings, embeddingsModelo: deps.config.motor.embeddings_modelo,
  });
  // Una búsqueda semántica que falla no detiene el ciclo, pero queda anotada
  if (r.contexto?.aviso) deps.log.append('custom', { message: r.contexto.aviso }, { taskId: estado.taskId });
  return r;
}

function seccionPlan(estado) {
  return estado.plan?.pasos?.length ? `\n\n## Plan\n${estado.plan.pasos.map((p, i) => `${i + 1}. ${p}`).join('\n')}` : '';
}

const MAX_BYTES_PROPIOS = 24 * 1024;

/**
 * Datos del proyecto que condicionan cómo se escribe el código y que no dependen de la tarea.
 * Sin esto, el agente de pruebas escribía `require` en un proyecto de módulos ES y ninguna
 * implementación podía pasar (hallazgo H6 de la validación con modelo real).
 * Solo se leen campos concretos del manifiesto, nunca su texto completo.
 * @param {string} cwd
 */
export function seccionProyecto(cwd, vetadas = []) {
  /** Lee un manifiesto con las mismas reglas que el recuperador: nada vetado, nada de fuera del proyecto. */
  const leerManifiesto = (ruta) => {
    const v = validarRuta(cwd, ruta, { vetadas });
    if (v.ok === false && v.motivo !== 'dependencias' && v.motivo !== 'configuracion') return null;
    try { return fs.readFileSync(path.resolve(cwd, ruta), 'utf8').replace(/^\uFEFF/, ''); } catch { return null; }
  };
  /** Una sola línea, sin secretos: lo que venga del manifiesto no puede abrir secciones propias en el prompt. */
  const unaLinea = (texto, max) => redactar(String(texto)).replace(/[\s\u0000-\u001f]+/g, ' ').replace(/[#`]/g, '').trim().slice(0, max);

  const lineas = [];
  const crudo = leerManifiesto('package.json');
  if (crudo !== null) {
    try {
      const pkg = JSON.parse(crudo);
      const nombres = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})]
        .filter((d) => /^[@a-z0-9._/-]{1,80}$/i.test(d));
      const esTs = nombres.includes('typescript') || fs.existsSync(path.join(cwd, 'tsconfig.json'));
      if (esTs) lineas.push('- Proyecto TypeScript: usa import/export.');
      else lineas.push(pkg.type === 'module'
        ? '- package.json declara "type": "module": los archivos .js son módulos ES. Usa import/export; `require` no existe.'
        : '- package.json no declara "type": "module": los archivos .js son CommonJS. Usa require/module.exports (o la extensión .mjs para módulos ES).');
      if (typeof pkg.scripts?.test === 'string') lineas.push(`- Script de pruebas: ${unaLinea(pkg.scripts.test, 200)}`);
      lineas.push(nombres.length ? `- Dependencias instaladas: ${nombres.slice(0, 40).join(', ')}` : '- Sin dependencias instaladas: usa solo la biblioteca estándar.');
    } catch { /* package.json ilegible: no se dice nada */ }
  }
  const gomod = leerManifiesto('go.mod');
  if (gomod !== null) {
    const mod = /^module\s+([\w./~-]{1,200})\s*$/m.exec(gomod);
    if (mod) lineas.push(`- Módulo de Go: ${mod[1]}`);
  }
  return lineas.length ? `\n\n## Proyecto\n${lineas.join('\n')}` : '';
}

const MAX_ARCHIVOS_MAPA = 200;

/**
 * Lista de archivos del proyecto, con los mismos vetos que el índice de búsqueda (secretos, rutas
 * protegidas, carpetas internas y enlaces simbólicos quedan fuera). Solo nombres, nunca contenido.
 * Sin ella, el planificador no podía nombrar archivos reales y, si devolvía una lista vacía, el
 * recuperador no aportaba nada: los agentes trabajaban sin ver el proyecto (hallazgo H9).
 * El orden es fijo: la misma carpeta da el mismo texto.
 * @param {string} cwd
 * @param {string[]} [vetadas]
 */
export function seccionMapa(cwd, vetadas = []) {
  let rutas;
  try {
    rutas = listarArchivosIndexables(cwd, vetadas).map((a) => a.ruta)
      .filter((r) => r.length <= 200 && /^[\w@.+\-/ ()\[\]]+$/.test(r))   // un nombre raro no entra en el prompt
      .sort();
  } catch { return ''; }
  if (rutas.length === 0) return '';
  const visibles = rutas.slice(0, MAX_ARCHIVOS_MAPA);
  const resto = rutas.length - visibles.length;
  return `\n\n## Archivos del proyecto\n${visibles.map((r) => `- ${r}`).join('\n')}${resto > 0 ? `\n(y ${resto} más)` : ''}`;
}

/**
 * Lo que el implementador ya escribió en iteraciones anteriores. Sin esto corregía a ciegas:
 * recibía el fallo pero no el código que lo produjo (hallazgo H7).
 * @param {EstadoCiclo} estado
 * @param {Set<string>} yaEnContexto  rutas que el recuperador ya incluyó
 */
function seccionImplementacionActual(estado, yaEnContexto, vetadas = []) {
  let restante = MAX_BYTES_PROPIOS;
  const partes = [];
  for (const { ruta } of estado.implementacion.archivos) {
    if (yaEnContexto.has(ruta)) continue;
    // La ruta viene de un punto de guardado y el disco pudo cambiar entre iteraciones: se valida otra vez,
    // con las mismas reglas que al escribir (nada vetado, nada fuera del proyecto, enlaces resueltos)
    if (validarRuta(estado.cwd, ruta, { vetadas }).ok !== true) continue;
    let contenido;
    try { contenido = fs.readFileSync(path.resolve(estado.cwd, ruta), 'utf8'); } catch { continue; }
    const bytes = Buffer.byteLength(contenido, 'utf8');
    if (bytes > restante) { partes.push(`### ${ruta}\n(omitido: no cabe en el contexto)`); continue; }
    restante -= bytes;
    partes.push(`### ${ruta}\n${contenido}`);
  }
  return partes.length ? `\n\n## Tu implementación actual (la que produjo el resultado de abajo)\n${partes.join('\n\n')}` : '';
}

/**
 * Cuando el agente de pruebas reescribe tras una pausa por «sin progreso», necesita saber qué
 * escribió y qué salida se repitió: con el mismo prompt devolvería las mismas pruebas (hallazgo H8).
 * @param {EstadoCiclo} estado
 */
function seccionPruebasAnteriores(estado, deps) {
  const n = deps.config.motor?.sin_progreso ?? POR_DEFECTO.motor.sin_progreso;
  if (estado.pruebas.archivos.length === 0 || !sinProgreso(estado, n)) return '';
  const ultima = estado.ejecuciones[estado.ejecuciones.length - 1];
  return `\n\n## Tus pruebas anteriores no dejaron avanzar`
    + `\nLas últimas ${n} ejecuciones fallaron con la misma salida aunque la implementación cambió. `
    + 'Puede que las pruebas estén rotas por sí mismas (no cargan, importan algo que no existe, usan otro sistema de módulos). '
    + 'Reescríbelas de modo que una implementación correcta pueda pasarlas.'
    + `\n${leerPruebas(estado)}`
    + `\n### Salida que se repitió\n${ultima.stdoutCola || '(vacía)'}\n### Errores\n${ultima.stderrCola || '(vacío)'}`;
}

/**
 * Al reescribir las pruebas porque el ejecutor no las encontró: sin esto el prompt era idéntico al
 * primero y el agente devolvería lo mismo (R5 de la revisión independiente).
 * @param {EstadoCiclo} estado
 */
function seccionPruebasNoEncontradas(estado) {
  // La revisión ya se borró al decidir «continuar». Que haya pruebas escritas sin ninguna implementación ni
  // ejecución solo ocurre por ese camino: el ejecutor no las encontró justo después de escribirlas.
  if (estado.pruebas.archivos.length === 0 || estado.implementacion.archivos.length > 0 || estado.ejecuciones.length > 0) return '';
  return '\n\n## El ejecutor no encontró tus pruebas anteriores'
    + `\nEscribiste: ${estado.pruebas.archivos.map((a) => a.ruta).join(', ')}. El comando de pruebas terminó sin encontrar ninguna. `
    + 'Usa los mismos nombres de archivo y corrige lo que impide que el comando las encuentre '
    + '(carpeta, nombre, y con unittest un tests/__init__.py).';
}

// ── planner ──────────────────────────────────────────────────────────────────

/** @param {EstadoCiclo} estado */
export async function planner(estado, deps) {
  const r = await invocar(estado, deps, estado.presupuesto, 'planner', {
    agente: 'arquitecto',
    userPrompt: `## Tarea\n${estado.tarea.descripcion}${seccionMapa(estado.cwd, deps.vetadas)}${seccionProyecto(estado.cwd, deps.vetadas)}`,
    extraContext: CONTRATO_PLANNER,
  });
  if ('fallo' in r) return r.fallo;

  // El plan orienta, no decide: si no se puede interpretar se sigue con los archivos de la tarea
  let plan = { pasos: [], archivosObjetivo: estado.tarea.archivos };
  const ini = r.salida.indexOf('{');
  const fin = r.salida.lastIndexOf('}');
  try {
    const json = JSON.parse(r.salida.slice(ini, fin + 1));
    if (Array.isArray(json.pasos)) {
      plan = {
        pasos: json.pasos.filter((p) => typeof p === 'string'),
        archivosObjetivo: Array.isArray(json.archivosObjetivo) ? json.archivosObjetivo.filter((a) => typeof a === 'string') : estado.tarea.archivos,
      };
    }
  } catch { /* plan por defecto */ }

  return { plan, presupuesto: r.presupuesto };
}

// ── retriever ────────────────────────────────────────────────────────────────

/** @param {EstadoCiclo} estado */
export async function retriever(estado, deps) {
  return { contexto: (await textoDeContexto(estado, deps)).contexto };
}

// ── qa ───────────────────────────────────────────────────────────────────────

/**
 * Escribe las pruebas y comprueba que fallan antes de que exista la implementación («rojo
 * obligatorio», ADR-20). Si pasan, el agente de pruebas lo intenta una vez más sabiendo por qué;
 * si vuelven a pasar, la tarea se pausa con el motivo `pruebas_no_fallan` y el implementador no
 * se ejecuta. Una tarea que declara partir de código existente queda exenta.
 * @param {EstadoCiclo} estado
 */
export async function qa(estado, deps) {
  const meta = { taskId: estado.taskId };
  // Un fallo del entorno dejó las pruebas escritas y sin comprobar: al continuar se comprueban, sin volver a pagarlas
  const soloComprobar = estado.rojo?.estado === 'sin_comprobar' && estado.pruebas.archivos.length > 0
    && huellasAlteradas(estado.cwd, estado.pruebas.archivos).length === 0;
  const exenta = estado.tarea.parte_de_codigo_existente === true;

  const contexto = (await textoDeContexto(estado, deps)).texto;
  const partes = (mapa, extra = '') => `## Tarea\n${estado.tarea.descripcion}${seccionPlan(estado)}`
    + (contexto ? `\n\n## Contexto del proyecto\n${contexto}` : mapa)
    + seccionProyecto(estado.cwd, deps.vetadas)
    + `\n\n## Comando de pruebas del proyecto\n${deps.testCmd}`
    + seccionPruebasAnteriores(estado, deps)
    // Tras una pausa por «pruebas_no_fallan» el agente necesita saber qué pasó: con el mismo prompt devolvería lo mismo
    + (estado.rojo?.estado === 'pasan' ? seccionPasabanAntes(estado) : seccionPruebasNoEncontradas(estado))
    + extra;

  let presupuesto = estado.presupuesto;
  /** Pide las pruebas al agente; `extra` es lo que se le añade en el reintento. */
  const pedir = (extra = '') => generarArchivos({ ...estado, presupuesto }, deps, 'qa', {
    agente: 'tester', userPrompt: partes(seccionMapa(estado.cwd, deps.vetadas), extra), contrato: CONTRATO_QA, rol: 'qa', pruebas: [],
    // El mapa cambia cuando este mismo nodo escribe las pruebas: fuera de la clave del diario
    clavePrompt: partes('', extra),
  });

  let archivos    = soloComprobar ? estado.pruebas.archivos : [];
  let reintentado = soloComprobar && estado.rojo?.reintentado === true;

  if (!soloComprobar) {
    const r = await pedir();
    if ('fallo' in r) return r.fallo;
    presupuesto = r.presupuesto;
    if (r.aplicado.escritos.length === 0) {
      return { presupuesto, ...pedirRevision('salida_invalida', 'qa', 'El agente de pruebas no escribió ninguna prueba válida.') };
    }
    archivos = r.aplicado.escritos;
  }

  for (;;) {
    const pruebas = { archivos, comando: deps.testCmd };
    const previa  = await deps.runner.test(estado.cwd);
    // Si el ejecutor no encuentra las pruebas recién escritas, implementar sería pagar por nada
    if (sinPruebasEjecutadas(previa, deps.testCmd)) {
      return { pruebas, presupuesto, rojo: null, ...pedirRevision('infraestructura', 'qa', detalleSinPruebas(deps.testCmd)) };
    }
    const categoria = clasificar(previa, { hayPruebas: true, pruebasIntactas: true });

    // Un fallo del entorno no dice ni «fallan» ni «pasan» (CA-001-04): decide una persona, sin gastar más
    if (categoria === 'infra_error') {
      deps.log.append('ciclo:rojo', { resultado: 'sin_comprobar', exitCode: previa.exitCode ?? null }, meta);
      return { pruebas, presupuesto, rojo: { estado: 'sin_comprobar', reintentado },
        ...pedirRevision('infraestructura', 'qa', `No se pudo comprobar que las pruebas fallan sin implementación porque el entorno falló: ${cola(String(previa.stderr ?? ''), 400) || 'sin detalle'}. «continuar» repite la comprobación sin volver a pedir las pruebas.`) };
    }
    // Fallar o agotar el tiempo sin implementación es el rojo que se espera
    if (categoria !== 'pass') {
      deps.log.append('ciclo:rojo', { resultado: 'fallan', categoria, reintentado }, meta);
      return { pruebas, presupuesto, rojo: { estado: 'fallan', reintentado } };
    }

    deps.log.append('custom', { message: 'Aviso: las pruebas recién escritas pasan sin implementación', aviso: 'pruebas_no_fallan' }, meta);
    // Reanudar qa con la implementación ya escrita (sin_progreso) hace que unas pruebas correctas pasen: eso no es «pasan sin implementación»
    const yaImplementado = (estado.implementacion?.archivos?.length ?? 0) > 0;
    if (exenta || yaImplementado) {
      deps.log.append('ciclo:rojo', { resultado: 'exenta', motivo: yaImplementado ? 'ya hay implementación: las pruebas reescritas pasan contra ella' : 'la tarea declara parte_de_codigo_existente: las pruebas pueden pasar antes de implementar' }, meta);
      return { pruebas, presupuesto, rojo: { estado: 'exenta', reintentado } };
    }
    if (reintentado) {
      deps.log.append('ciclo:rojo', { resultado: 'pasan', reintentado: true }, meta);
      return { pruebas, presupuesto, rojo: { estado: 'pasan', reintentado: true }, ...pedirRevision('pruebas_no_fallan', 'qa', DETALLE_PRUEBAS_NO_FALLAN) };
    }

    // Un solo reintento, y cuenta para el presupuesto como cualquier otra llamada (CA-001-05)
    deps.log.append('ciclo:rojo', { resultado: 'pasan', reintentado: false }, meta);
    reintentado = true;
    const r = await pedir(seccionPasanSinImplementacion(estado.cwd, archivos));
    // Si el reintento no se pudo hacer, al reanudar el agente de pruebas sabrá que las anteriores pasaban
    if ('fallo' in r) return { pruebas, rojo: { estado: 'pasan', reintentado: false }, ...r.fallo };
    presupuesto = r.presupuesto;
    if (r.aplicado.escritos.length === 0) {
      return { pruebas, presupuesto, rojo: { estado: 'pasan', reintentado: false }, ...pedirRevision('salida_invalida', 'qa', 'El agente de pruebas no escribió ninguna prueba válida al corregir unas pruebas que pasaban sin implementación.') };
    }
    const porRuta = new Map(archivos.map((a) => [canonica(a.ruta), a]));
    for (const a of r.aplicado.escritos) porRuta.set(canonica(a.ruta), a);
    archivos = [...porRuta.values()];
  }
}

// ── coder ────────────────────────────────────────────────────────────────────

function leerPruebas(estado) {
  return estado.pruebas.archivos.map(({ ruta }) => {
    const abs = path.resolve(estado.cwd, ruta);
    return `### ${ruta}\n${fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : '(no existe)'}`;
  }).join('\n\n');
}

/**
 * Dos modos (ADR-21): `bloque`, el de siempre, y `turnos`, con herramientas (core/ciclo/turnos.js).
 * El modo usado queda anotado en el estado del hilo: lo empezado en un modo sigue en ese modo.
 * @param {EstadoCiclo} estado
 */
export async function coder(estado, deps) {
  const { modo, marca } = modoImplementador(estado, deps);
  if (modo === 'turnos') return coderPorTurnos(estado, deps, { seccionPlan, leerPruebas, seccionProyecto, seccionMapa, pedirRevision });
  return { ...(await coderEnBloque(estado, deps)), implementador: marca };
}

/** @param {EstadoCiclo} estado */
async function coderEnBloque(estado, deps) {
  const recuperado = await textoDeContexto(estado, deps);
  const contexto = recuperado.texto;
  const ultima   = estado.ejecuciones[estado.ejecuciones.length - 1];

  // `volatil`: lo que este mismo nodo cambia en el disco al escribir (el mapa de archivos y su propia
  // versión anterior). Va en el prompt, pero no en la clave del diario (R3).
  const partes = (volatil) => {
    let p = `## Tarea\n${estado.tarea.descripcion}${seccionPlan(estado)}`
      + `\n\n## Pruebas que deben pasar (no puedes modificarlas)\n${leerPruebas(estado)}`
      + (contexto ? `\n\n## Contexto del proyecto\n${contexto}` : (volatil ? seccionMapa(estado.cwd, deps.vetadas) : ''))
      + seccionProyecto(estado.cwd, deps.vetadas);
    if (ultima) {
      const yaEnContexto = new Set((recuperado.contexto?.fragmentos ?? []).map((f) => f.ruta));
      if (volatil) p += seccionImplementacionActual(estado, yaEnContexto, deps.vetadas);
      p += `\n\n## Resultado de la ejecución anterior (iteración ${ultima.iteracion}, ${ultima.categoria})`
        + `\n### Salida\n${ultima.stdoutCola || '(vacía)'}\n### Errores\n${ultima.stderrCola || '(vacío)'}`;
    }
    return p;
  };
  const userPrompt = partes(true);

  const r = await generarArchivos(estado, deps, 'coder', {
    agente: estado.tarea.agente, userPrompt, contrato: CONTRATO_CODER, rol: 'coder', clavePrompt: partes(false),
    pruebas: estado.pruebas.archivos.map((a) => a.ruta),
  });
  if ('fallo' in r) return r.fallo;

  // Se conserva lo ya escrito en iteraciones anteriores; lo nuevo sustituye por ruta
  const porRuta = new Map(estado.implementacion.archivos.map((a) => [a.ruta, a]));
  for (const a of r.aplicado.escritos) porRuta.set(a.ruta, a);
  const parcial = { implementacion: { archivos: [...porRuta.values()] }, presupuesto: r.presupuesto };

  if (r.aplicado.requiereRevision) {
    const propuestos = r.aplicado.rechazados
      .filter((x) => x.motivo === 'dependencias' || x.motivo === 'configuracion')
      .map((x) => x.ruta).join(', ');
    return { ...parcial, ...pedirRevision('dependencias', 'coder',
      `El implementador propone cambiar dependencias o configuración que alguna herramienta ejecuta sola (${propuestos}). El cambio no se aplicó: revísalo y hazlo tú si es correcto.`) };
  }
  if (r.aplicado.escritos.length === 0) {
    return { ...parcial, ...pedirRevision('salida_invalida', 'coder', 'El implementador no escribió ningún archivo válido.') };
  }
  return parcial;
}

// ── sandbox ──────────────────────────────────────────────────────────────────

/** @param {EstadoCiclo} estado */
export async function sandbox(estado, deps) {
  // Si las pruebas cambiaron desde que se escribieron, la ejecución no se realiza (CA-002-03)
  const alteradas = huellasAlteradas(estado.cwd, estado.pruebas.archivos);
  if (alteradas.length > 0) {
    // Reanudar en "sandbox" repetiría el mismo error sin salida: "continuar" vuelve a pedir las pruebas al agente de pruebas
    return pedirRevision('infraestructura', 'qa', `Las pruebas cambiaron desde que se escribieron: ${alteradas.join(', ')}. No se ejecutan. Si continúas, el agente de pruebas las vuelve a escribir; si las cambiaste tú y están bien, acepta.`);
  }

  const r = await deps.runner.test(estado.cwd);
  // Aquí un código 5 NO se trata como «ninguna prueba encontrada»: esa comprobación ya se hizo al escribir
  // las pruebas, antes de que existiera la implementación. Después, el 5 lo puede provocar el propio código
  // (os._exit(5)), y eximirlo de las iteraciones sería un hueco (R4 de la revisión independiente).
  const categoria = clasificar(r, { hayPruebas: estado.pruebas.archivos.length > 0, pruebasIntactas: true });

  // Un fallo del entorno no consume iteraciones (CA-005-05)
  const iteracion = categoria === 'infra_error' ? estado.iteracion : estado.iteracion + 1;
  const ejecucion = {
    iteracion, categoria,
    exitCode: r.exitCode ?? null, timedOut: Boolean(r.timedOut), oomKilled: Boolean(r.oomKilled),
    durationMs: r.durationMs ?? 0, stdoutCola: cola(r.stdout), stderrCola: cola(r.stderr),
    // Para detectar que varias ejecuciones seguidas fallan igual (router.sinProgreso)
    huellaSalida: huellaDeSalida(r.stdout, r.stderr),
  };
  // Un pase solo se da por bueno si la salida lo confirma y el codigo escrito no corta el proceso al cargarse
  if (categoria === 'pass') {
    const archivos = estado.implementacion.archivos.map(({ ruta }) => {
      try { return { ruta, contenido: fs.readFileSync(path.resolve(estado.cwd, ruta), 'utf8') }; } catch { return { ruta, contenido: '' }; }
    });
    const pruebas = estado.pruebas.archivos.map(({ ruta }) => {
      try { return { ruta, contenido: fs.readFileSync(path.resolve(estado.cwd, ruta), 'utf8') }; } catch { return { ruta, contenido: '' }; }
    });
    const sospecha = detectarSospecha({ stdout: r.stdout, stderr: r.stderr, archivos, pruebas });
    if (sospecha.length > 0) ejecucion.sospecha = sospecha;
  }
  deps.log.append('ciclo:ejecucion', { categoria, exitCode: ejecucion.exitCode, timedOut: ejecucion.timedOut, durationMs: ejecucion.durationMs, iteracion }, { taskId: estado.taskId });

  return { iteracion, ejecuciones: [ejecucion] };
}

// ── revision_humana ──────────────────────────────────────────────────────────

/**
 * Aplica la decisión de una persona. Sin decisión no se ejecuta (el motor se
 * detiene antes): mientras no la haya, no se gasta nada.
 *
 * @param {EstadoCiclo} estado
 * @param {any} deps
 * @param {{ decision: string, iteracionesExtra?: number, presupuestoExtra?: number }} decision
 */
export async function revisionHumana(estado, deps, decision) {
  if (!estado.revision) throw new Error('revision_humana: no hay ninguna revisión pendiente');
  if (!decision || !DECISIONES.includes(decision.decision)) {
    throw new Error(`Decisión no válida. Opciones: ${DECISIONES.join(', ')}`);
  }

  const revision = { ...estado.revision, decision: decision.decision, ts: new Date().toISOString() };

  // Se valida ANTES de registrar nada: una decisión rechazada no deja rastro
  let presupuesto = estado.presupuesto;
  let maxIteraciones = estado.maxIteraciones;
  if (decision.decision === 'continuar') {
    if (decision.presupuestoExtra) presupuesto = ampliar(presupuesto, decision.presupuestoExtra);
    if (decision.iteracionesExtra) maxIteraciones += Math.max(0, Math.floor(decision.iteracionesExtra));

    if (presupuesto.estado === 'agotado') {
      throw new Error('El presupuesto sigue agotado: indica cuánto ampliarlo con --presupuesto-extra <USD>.');
    }
    // Siempre que se vuelva al implementador: si el motivo fue el gasto en la última iteración,
    // ampliar solo el presupuesto no puede regalar una iteración más
    if (estado.revision.reanudarEn === 'coder' && estado.iteracion >= maxIteraciones) {
      throw new Error('No quedan iteraciones: indica cuántas añadir con --iteraciones-extra <N>.');
    }
    // Reescribir las pruebas acaba en otra llamada al implementador y otra ejecución: tampoco se regala
    if (estado.revision.motivo === 'sin_progreso' && estado.iteracion >= maxIteraciones) {
      throw new Error('No quedan iteraciones para probar las pruebas reescritas: indica cuántas añadir con --iteraciones-extra <N>.');
    }
  }

  deps.log.append('ciclo:revision_decidida', { decision: decision.decision, motivo: revision.motivo, iteracionesExtra: decision.iteracionesExtra, presupuestoExtra: decision.presupuestoExtra }, { taskId: estado.taskId });

  if (decision.decision === 'abortar') {
    const restaurado = deps.respaldo.restaurar();
    deps.log.append('custom', { message: 'Tarea abortada: archivos restaurados', ...restaurado }, { taskId: estado.taskId });
    return { revision, resultado: 'abortada' };
  }
  if (decision.decision === 'aceptar') {
    return { revision, resultado: 'aceptada_por_humano' };
  }
  return { revision, presupuesto, maxIteraciones, resultado: 'en_curso' };
}

export const NODOS = { planner, retriever, qa, coder, sandbox, mutacion, refuerzo, revision_humana: revisionHumana };
