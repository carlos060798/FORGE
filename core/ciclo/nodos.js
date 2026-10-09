/**
 * nodos.js — Los seis nodos del ciclo verificado
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
import { CONTRATO_CODER, CONTRATO_PLANNER, CONTRATO_QA } from './contratos.js';
import { ampliar, ErrorConsumo, limitarNivel, modeloEfectivo, puedeLlamar, registrar, sinPrecioConocido } from './presupuesto.js';
import { aplicarArchivos, extraerBloque, huellasAlteradas } from './protocolo-archivos.js';
import { clasificar, detalleSinPruebas, sinPruebasEjecutadas } from './router.js';
import { cola } from './redactar.js';
import { detectarSospecha } from './sospecha.js';

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
async function invocar(estado, deps, presupuesto, nodo, { agente, userPrompt, extraContext }) {
  const efectivo = modeloEfectivo(limitarNivel(deps.aliasDe(agente), deps.config.motor?.nivel_maximo), presupuesto, deps.config.presupuesto.degradar_a);
  // Una respuesta ya pagada y guardada en el diario no cuesta nada: se usa aunque haya agotado el tope
  const yaPagada = deps.respondida?.({ agente, userPrompt, extraContext }) === true;
  if (!yaPagada && !puedeLlamar(presupuesto)) {
    return { fallo: { presupuesto, ...pedirRevision('presupuesto', nodo) } };
  }
  const r = await deps.llamar({ agente, modeloAlias: efectivo.alias, proveedorLocal: efectivo.proveedorLocal, userPrompt, extraContext });
  if (!r.ok) {
    return { fallo: { presupuesto, ...pedirRevision('infraestructura', nodo, `El proveedor de modelos falló: ${cola(String(r.error ?? 'sin detalle'), 600)}`) } };
  }

  let siguiente;
  try {
    siguiente = registrar(presupuesto, { proveedor: r.proveedor, modelo: r.modelo, inputTokens: r.inputTokens, outputTokens: r.outputTokens }, { precios: deps.config.precios });
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
async function generarArchivos(estado, deps, nodo, { agente, userPrompt, contrato, rol, pruebas }) {
  let presupuesto = estado.presupuesto;
  let error = '';

  for (let intento = 0; intento < 2; intento++) {
    const prompt = intento === 0 ? userPrompt
      : `${userPrompt}\n\n## Tu respuesta anterior no se pudo interpretar\n${error}\nResponde solo con el bloque JSON pedido.`;
    const r = await invocar(estado, deps, presupuesto, nodo, { agente, userPrompt: prompt, extraContext: contrato });
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
export function seccionProyecto(cwd) {
  const lineas = [];
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
    lineas.push(pkg.type === 'module'
      ? '- package.json declara "type": "module": los archivos .js son módulos ES. Usa import/export; `require` no existe.'
      : '- package.json no declara "type": "module": los archivos .js son CommonJS. Usa require/module.exports (o la extensión .mjs para módulos ES).');
    if (typeof pkg.scripts?.test === 'string') lineas.push(`- Script de pruebas: ${pkg.scripts.test.slice(0, 200)}`);
    const deps = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})]
      .filter((d) => /^[@a-z0-9._/-]{1,80}$/i.test(d)).slice(0, 40);
    lineas.push(deps.length ? `- Dependencias instaladas: ${deps.join(', ')}` : '- Sin dependencias instaladas: usa solo la biblioteca estándar.');
  } catch { /* sin package.json legible */ }
  try {
    const mod = /^module\s+(\S{1,200})/m.exec(fs.readFileSync(path.join(cwd, 'go.mod'), 'utf8'));
    if (mod) lineas.push(`- Módulo de Go: ${mod[1]}`);
  } catch { /* sin go.mod */ }
  return lineas.length ? `\n\n## Proyecto\n${lineas.join('\n')}` : '';
}

/**
 * Lo que el implementador ya escribió en iteraciones anteriores. Sin esto corregía a ciegas:
 * recibía el fallo pero no el código que lo produjo (hallazgo H7).
 * @param {EstadoCiclo} estado
 * @param {Set<string>} yaEnContexto  rutas que el recuperador ya incluyó
 */
function seccionImplementacionActual(estado, yaEnContexto) {
  let restante = MAX_BYTES_PROPIOS;
  const partes = [];
  for (const { ruta } of estado.implementacion.archivos) {
    if (yaEnContexto.has(ruta)) continue;
    let contenido;
    try { contenido = fs.readFileSync(path.resolve(estado.cwd, ruta), 'utf8'); } catch { continue; }
    const bytes = Buffer.byteLength(contenido, 'utf8');
    if (bytes > restante) { partes.push(`### ${ruta}\n(omitido: no cabe en el contexto)`); continue; }
    restante -= bytes;
    partes.push(`### ${ruta}\n${contenido}`);
  }
  return partes.length ? `\n\n## Tu implementación actual (la que produjo el resultado de abajo)\n${partes.join('\n\n')}` : '';
}

// ── planner ──────────────────────────────────────────────────────────────────

/** @param {EstadoCiclo} estado */
export async function planner(estado, deps) {
  const r = await invocar(estado, deps, estado.presupuesto, 'planner', {
    agente: 'arquitecto', userPrompt: `## Tarea\n${estado.tarea.descripcion}`, extraContext: CONTRATO_PLANNER,
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

/** @param {EstadoCiclo} estado */
export async function qa(estado, deps) {
  const contexto = (await textoDeContexto(estado, deps)).texto;
  const userPrompt = `## Tarea\n${estado.tarea.descripcion}${seccionPlan(estado)}`
    + (contexto ? `\n\n## Contexto del proyecto\n${contexto}` : '')
    + seccionProyecto(estado.cwd)
    + `\n\n## Comando de pruebas del proyecto\n${deps.testCmd}`;

  const r = await generarArchivos(estado, deps, 'qa', { agente: 'tester', userPrompt, contrato: CONTRATO_QA, rol: 'qa', pruebas: [] });
  if ('fallo' in r) return r.fallo;

  if (r.aplicado.escritos.length === 0) {
    return { presupuesto: r.presupuesto, ...pedirRevision('salida_invalida', 'qa', 'El agente de pruebas no escribió ninguna prueba válida.') };
  }

  // Aviso, no bloqueo: unas pruebas que ya pasan sin implementación no prueban nada (CA-002-04)
  const previa = await deps.runner.test(estado.cwd);
  // Si el ejecutor no encuentra las pruebas recién escritas, implementar sería pagar por nada
  if (sinPruebasEjecutadas(previa, deps.testCmd)) {
    return { pruebas: { archivos: r.aplicado.escritos, comando: deps.testCmd }, presupuesto: r.presupuesto,
      ...pedirRevision('infraestructura', 'qa', detalleSinPruebas(deps.testCmd)) };
  }
  if (clasificar(previa, { hayPruebas: true, pruebasIntactas: true }) === 'pass') {
    deps.log.append('custom', { message: 'Aviso: las pruebas recién escritas pasan sin implementación', aviso: 'pruebas_no_fallan' }, { taskId: estado.taskId });
  }

  return { pruebas: { archivos: r.aplicado.escritos, comando: deps.testCmd }, presupuesto: r.presupuesto };
}

// ── coder ────────────────────────────────────────────────────────────────────

function leerPruebas(estado) {
  return estado.pruebas.archivos.map(({ ruta }) => {
    const abs = path.resolve(estado.cwd, ruta);
    return `### ${ruta}\n${fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : '(no existe)'}`;
  }).join('\n\n');
}

/** @param {EstadoCiclo} estado */
export async function coder(estado, deps) {
  const recuperado = await textoDeContexto(estado, deps);
  const contexto = recuperado.texto;
  const ultima   = estado.ejecuciones[estado.ejecuciones.length - 1];

  let userPrompt = `## Tarea\n${estado.tarea.descripcion}${seccionPlan(estado)}`
    + `\n\n## Pruebas que deben pasar (no puedes modificarlas)\n${leerPruebas(estado)}`
    + (contexto ? `\n\n## Contexto del proyecto\n${contexto}` : '')
    + seccionProyecto(estado.cwd);
  if (ultima) {
    const yaEnContexto = new Set((recuperado.contexto?.fragmentos ?? []).map((f) => f.ruta));
    userPrompt += seccionImplementacionActual(estado, yaEnContexto);
    userPrompt += `\n\n## Resultado de la ejecución anterior (iteración ${ultima.iteracion}, ${ultima.categoria})`
      + `\n### Salida\n${ultima.stdoutCola || '(vacía)'}\n### Errores\n${ultima.stderrCola || '(vacío)'}`;
  }

  const r = await generarArchivos(estado, deps, 'coder', {
    agente: estado.tarea.agente, userPrompt, contrato: CONTRATO_CODER, rol: 'coder',
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
  // Ninguna prueba encontrada: no consume iteraciones ni vuelve al implementador
  if (sinPruebasEjecutadas(r, deps.testCmd)) {
    deps.log.append('ciclo:ejecucion', { categoria: 'sin_pruebas', exitCode: r.exitCode, timedOut: false, durationMs: r.durationMs ?? 0, iteracion: estado.iteracion }, { taskId: estado.taskId });
    return pedirRevision('infraestructura', 'qa', detalleSinPruebas(deps.testCmd));
  }
  const categoria = clasificar(r, { hayPruebas: estado.pruebas.archivos.length > 0, pruebasIntactas: true });

  // Un fallo del entorno no consume iteraciones (CA-005-05)
  const iteracion = categoria === 'infra_error' ? estado.iteracion : estado.iteracion + 1;
  const ejecucion = {
    iteracion, categoria,
    exitCode: r.exitCode ?? null, timedOut: Boolean(r.timedOut), oomKilled: Boolean(r.oomKilled),
    durationMs: r.durationMs ?? 0, stdoutCola: cola(r.stdout), stderrCola: cola(r.stderr),
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

export const NODOS = { planner, retriever, qa, coder, sandbox, revision_humana: revisionHumana };
