/**
 * turnos.js — Implementador por turnos con herramientas (ADR-21)
 *
 * Segundo modo del nodo `coder`. En lugar de una respuesta con todos los archivos, el modelo
 * pide acciones (leer, listar, buscar, editar, ejecutar las pruebas) y el motor las ejecuta en
 * este proceso, turno a turno, hasta que el modelo termina sin pedir nada o se alcanza
 * `motor.turnos_max`. Después el grafo sigue igual que siempre: `sandbox` ejecuta las pruebas
 * y el router decide. Lo que el modelo ejecute por su cuenta no decide el éxito.
 *
 * Un turno NO es una iteración: una iteración sigue siendo una ejecución final de pruebas.
 *
 * ── Diario por turno (Principio IX) ─────────────────────────────────────────────────────────
 * El diario de un hilo (diario.js) guarda lo que está en vuelo dentro de un nodo y se vacía al
 * guardar el punto de ese nodo. El modo de bloque lo indexa por la huella del prompt; aquí el
 * prompt de cada turno es toda la conversación, así que la clave es la POSICIÓN del turno:
 *
 *   turno:<iteración>:inicio    { userPrompt }            el primer mensaje, tal como se envió
 *   turno:<iteración>:<n>       la respuesta del modelo   se anota al recibirla, ANTES de ejecutar nada
 *   turno:<iteración>:<n>:r:<i> el resultado de su herramienta i, se anota al terminar de ejecutarla
 *
 * (el hilo no va en la clave porque cada hilo tiene su propio archivo de diario).
 *
 * Al reanudar tras un corte, el nodo empieza otra vez y recorre los mismos turnos: los que
 * están en el diario no se vuelven a pedir al modelo ni a pagar, y sus herramientas NO se
 * vuelven a ejecutar: se reutiliza el resultado anotado. Sin eso, una sustitución ya aplicada
 * no encontraría su fragmento la segunda vez y el modelo recibiría una conversación distinta
 * de la que pagó. La conversación reproducida es idéntica a la original, y el primer turno
 * que falta en el diario es el primero que se pide de verdad.
 *
 * Queda una ventana: un corte entre que una herramienta escribe y que su resultado se anota.
 * Al reanudar se ejecuta otra vez. Escribir un archivo entero da el mismo resultado; una
 * sustitución ya aplicada devuelve «el fragmento no aparece», sin cambiar nada, y el modelo
 * puede leer el archivo y seguir. Ningún caso deja un archivo a medias: la escritura es atómica.
 */

import { CONTRATO_CODER_TURNOS } from './contratos.js';
import { POR_DEFECTO } from './config.js';
import { crearHerramientasCoder } from './herramientas-coder.js';
import { ErrorConsumo, limitarNivel, modeloEfectivo, puedeLlamar, registrar, sinPrecioConocido } from './presupuesto.js';
import { cola } from './redactar.js';

/** @typedef {import('./estado.js').EstadoCiclo} EstadoCiclo */

export const MODOS_IMPLEMENTADOR = ['bloque', 'turnos'];

/** @param {number} iteracion @param {number|string} n */
export const claveTurno = (iteracion, n) => `turno:${iteracion}:${n}`;

const AVISO_CORTADA = 'Tu respuesta anterior se cortó por longitud antes de terminar. Continúa: usa las herramientas con acciones más pequeñas (edita por fragmentos en lugar de reescribir archivos enteros).';

function efectivoDe(estado, deps, presupuesto) {
  return modeloEfectivo(limitarNivel(deps.aliasDe(estado.tarea.agente), deps.config.motor?.nivel_maximo), presupuesto, deps.config.presupuesto?.degradar_a);
}

/**
 * Qué modo usa el nodo `coder` en este hilo, y qué modo queda anotado en su estado.
 *
 * El modo se fija la primera vez que el implementador trabaja en una tarea y se guarda en el
 * estado del hilo (`estado.implementador`): cambiar `motor.implementador` afecta a las tareas
 * nuevas, no a las que ya están en marcha o en pausa (CA-005-03). Orden de decisión:
 *   1. lo anotado en el estado;
 *   2. lo que haya en vuelo en el diario (un corte dentro del primer intento, antes de que
 *      exista ningún punto del nodo): entradas `turno:` → turnos; otras → bloque;
 *   3. un hilo anterior a esta versión que ya tiene implementación o ejecuciones → bloque;
 *   4. `motor.implementador` de la configuración.
 * Si toca `turnos` y el proveedor no admite herramientas, se avisa y se usa `bloque` (CA-006-02).
 *
 * @param {EstadoCiclo & { implementador?: string }} estado
 * @param {any} deps
 * @returns {{ modo: 'bloque'|'turnos', marca: 'bloque'|'turnos' }}
 */
export function modoImplementador(estado, deps) {
  let pedido = MODOS_IMPLEMENTADOR.includes(String(estado.implementador)) ? estado.implementador : undefined;
  if (!pedido) {
    const enVuelo = deps.diario?.claves?.() ?? [];
    if (enVuelo.some((c) => c.startsWith('turno:'))) pedido = 'turnos';
    else if (enVuelo.length > 0) pedido = 'bloque';
    else if (estado.implementacion.archivos.length > 0 || estado.ejecuciones.length > 0) pedido = 'bloque';
    else pedido = deps.config.motor?.implementador ?? POR_DEFECTO.motor.implementador;
  }
  if (pedido !== 'turnos') return { modo: 'bloque', marca: 'bloque' };

  const efectivo = efectivoDe(estado, deps, estado.presupuesto);
  const admite = typeof deps.conversar === 'function'
    && deps.admiteHerramientas?.({ agente: estado.tarea.agente, proveedorLocal: efectivo.proveedorLocal }) === true;
  if (!admite) {
    deps.log.append('ciclo:implementador_sin_herramientas', {
      aviso: 'motor.implementador es "turnos", pero el proveedor de modelos configurado no admite conversaciones con herramientas: esta tarea se implementa en modo de bloque.',
      ...(efectivo.proveedorLocal ? { proveedor: 'local' } : {}),
    }, { taskId: estado.taskId });
    return { modo: 'bloque', marca: /** @type {any} */ (estado.implementador ?? 'bloque') };
  }
  return { modo: 'turnos', marca: 'turnos' };
}

/**
 * El primer mensaje de la conversación. No lleva el contexto del recuperador: el implementador
 * recibe el mapa de archivos y lee lo que necesita con sus herramientas.
 * @param {EstadoCiclo} estado
 * @param {any} deps
 * @param {{ seccionPlan: Function, leerPruebas: Function, seccionProyecto: Function, seccionMapa: Function }} ayudas  secciones de nodos.js
 * @param {{ turnosMax: number, pruebasMax: number }} limites
 */
export function promptTurnos(estado, deps, ayudas, limites) {
  const ultima = estado.ejecuciones[estado.ejecuciones.length - 1];
  let p = `## Tarea\n${estado.tarea.descripcion}${ayudas.seccionPlan(estado)}`
    + `\n\n## Pruebas que deben pasar (no puedes modificarlas)\n${ayudas.leerPruebas(estado)}`
    + ayudas.seccionProyecto(estado.cwd, deps.vetadas)
    + ayudas.seccionMapa(estado.cwd, deps.vetadas);
  if (estado.implementacion.archivos.length > 0) {
    p += `\n\n## Archivos que ya escribiste en intentos anteriores\n${estado.implementacion.archivos.map((a) => `- ${a.ruta}`).join('\n')}`
      + '\nSiguen en el proyecto tal como los dejaste: léelos antes de cambiarlos.';
  }
  if (ultima) {
    p += `\n\n## Resultado de la ejecución anterior (iteración ${ultima.iteracion}, ${ultima.categoria})`
      + `\n### Salida\n${ultima.stdoutCola || '(vacía)'}\n### Errores\n${ultima.stderrCola || '(vacío)'}`;
  }
  p += '\n\n## Límites de este intento'
    + `\n- Como máximo ${limites.turnosMax} turnos (cada respuesta tuya es un turno) y ${limites.pruebasMax} ejecuciones de pruebas.`
    + '\n- Cuando termines, responde sin pedir ninguna herramienta: el ciclo ejecutará las pruebas.';
  return p;
}

/**
 * Anota en el presupuesto del estado un turno ya respondido. Mismas funciones y mismos avisos
 * que `invocar` en nodos.js para las llamadas de un solo mensaje.
 * @returns {{ presupuesto: any } | { error: string }}
 */
function contabilizar(estado, deps, presupuesto, r) {
  let siguiente;
  try {
    siguiente = registrar(presupuesto, { proveedor: r.proveedor, modelo: r.modelo, inputTokens: r.inputTokens, outputTokens: r.outputTokens }, { precios: deps.config.precios });
  } catch (e) {
    if (!(e instanceof ErrorConsumo)) throw e;
    return { error: cola(String(e.message), 600) };
  }
  if (!r.delDiario && sinPrecioConocido(r, deps.config.precios)) {
    deps.log.append('ciclo:precio_desconocido', { modelo: r.modelo, proveedor: r.proveedor, aviso: `El modelo "${r.modelo}" no tiene precio conocido: se cobra al más caro conocido. Indica su precio en precios: de sdd.config.yaml.` }, { taskId: estado.taskId });
  }
  // El gasto de la sesión lo lleva el libro, llamada a llamada: un turno reproducido no se suma dos veces
  if (deps.ajustarGasto) siguiente = deps.ajustarGasto(siguiente);
  if (presupuesto.estado === 'ok' && siguiente.estado !== 'ok') {
    deps.log.append('ciclo:presupuesto_degradado', { gastado_usd: siguiente.gastado_usd, umbral_usd: siguiente.umbral_degradacion_usd }, { taskId: estado.taskId });
  }
  return { presupuesto: siguiente };
}

/**
 * El nodo `coder` en modo por turnos. Devuelve lo mismo que el modo de bloque
 * (`implementacion.archivos` con ruta y huella de lo escrito, y `presupuesto`), más el modo y
 * el número de turnos acumulado de la tarea.
 *
 * @param {EstadoCiclo & { implementador?: string, turnos?: number }} estado
 * @param {any} deps  las de nodos.js, más:
 *   conversar({ clave, agente, modeloAlias, proveedorLocal, extraContext, mensajes, herramientas })
 *       → { ok, contenido, stopReason, inputTokens, outputTokens, modelo, proveedor, error, delDiario? }
 *   admiteHerramientas({ agente, proveedorLocal }) → boolean
 *   diario?.obtener(clave) / diario?.anotar(clave, valor) / diario?.claves()
 * @param {{ seccionPlan: Function, leerPruebas: Function, seccionProyecto: Function, seccionMapa: Function, pedirRevision: Function }} ayudas
 * @returns {Promise<Partial<EstadoCiclo>>}
 */
export async function coderPorTurnos(estado, deps, ayudas) {
  const it         = estado.iteracion;
  const meta       = { taskId: estado.taskId };
  const turnosMax  = deps.config.motor?.turnos_max ?? POR_DEFECTO.motor.turnos_max;
  const pruebasMax = deps.config.motor?.turnos_pruebas_max ?? POR_DEFECTO.motor.turnos_pruebas_max;
  const agente     = estado.tarea.agente;

  // El primer mensaje se guarda: al reanudar, el mapa de archivos ya no sería el mismo
  const claveInicio = claveTurno(it, 'inicio');
  let inicio = deps.diario?.obtener(claveInicio);
  if (!inicio) {
    inicio = { userPrompt: promptTurnos(estado, deps, ayudas, { turnosMax, pruebasMax }) };
    deps.diario?.anotar(claveInicio, inicio);
  }
  /** @type {{ rol: string, contenido: any }[]} */
  const mensajes = [{ rol: 'usuario', contenido: inicio.userPrompt }];

  const herramientas = crearHerramientasCoder({
    cwd: estado.cwd, vetadas: deps.vetadas, pruebas: estado.pruebas.archivos.map((a) => a.ruta),
    respaldo: deps.respaldo, runner: deps.runner, log: deps.log, taskId: estado.taskId, maxPruebas: pruebasMax,
  });

  let presupuesto = estado.presupuesto;
  /** @type {Map<string, { ruta: string, sha256: string }>} */
  const escritos = new Map();
  /** @type {string[]} */
  const propuestos = [];
  let respondidos = 0;
  /** @type {'terminado'|'dependencias'|'presupuesto'|'sin_herramientas'|'turnos_agotados'|null} */
  let fin = null;
  /** @type {string|null} */
  let errorInfra = null;

  for (let n = 1; n <= turnosMax && !fin; n++) {
    const clave    = claveTurno(it, n);
    const yaPagada = deps.diario?.obtener(clave) != null;
    const efectivo = efectivoDe(estado, deps, presupuesto);
    if (!yaPagada) {
      // Igual que en una llamada suelta: con el presupuesto agotado no se inicia ningún turno
      if (!puedeLlamar(presupuesto)) { fin = 'presupuesto'; break; }
      if (deps.admiteHerramientas?.({ agente, proveedorLocal: efectivo.proveedorLocal }) !== true) { fin = 'sin_herramientas'; break; }
    }

    const r = await deps.conversar({
      clave, agente, modeloAlias: efectivo.alias, proveedorLocal: efectivo.proveedorLocal,
      extraContext: CONTRATO_CODER_TURNOS, mensajes, herramientas: herramientas.esquemas,
    });
    if (!r.ok) { errorInfra = `El proveedor de modelos falló en el turno ${n}: ${cola(String(r.error ?? 'sin detalle'), 600)}`; break; }

    const cuenta = contabilizar(estado, deps, presupuesto, r);
    if ('error' in cuenta) { errorInfra = cuenta.error; break; }
    presupuesto = cuenta.presupuesto;
    respondidos++;

    const contenido = Array.isArray(r.contenido) ? r.contenido : [];
    const usos = contenido.filter((b) => b?.tipo === 'uso_herramienta');
    mensajes.push({ rol: 'asistente', contenido });
    if (!r.delDiario) {
      deps.log.append('ciclo:turno', {
        iteracion: it, turno: n, stopReason: r.stopReason, herramientas: usos.map((u) => u.nombre),
        inputTokens: r.inputTokens, outputTokens: r.outputTokens, modelo: r.modelo,
      }, meta);
    }

    const cortada = r.stopReason === 'max_tokens';
    if (usos.length === 0) {
      // Una respuesta cortada no es «he terminado»
      if (cortada) { mensajes.push({ rol: 'usuario', contenido: AVISO_CORTADA }); continue; }
      fin = 'terminado';
      break;
    }

    const resultados = [];
    for (let i = 0; i < usos.length; i++) {
      const uso = usos[i];
      const claveResultado = `${clave}:r:${i}`;
      let res = deps.diario?.obtener(claveResultado);
      if (res) {
        // Ya se ejecutó antes del corte: se reutiliza el resultado, no se repite la acción
        if (res.pruebas) herramientas.contarPrueba();
      } else {
        // Una respuesta cortada por longitud puede traer la entrada de la herramienta a medias: no se ejecuta
        res = cortada
          ? { texto: `No se ejecutó: ${AVISO_CORTADA}`, error: true }
          : await herramientas.ejecutar(uso.nombre, uso.entrada);
        deps.diario?.anotar(claveResultado, res);
        deps.log.append('ciclo:herramienta', {
          iteracion: it, turno: n, herramienta: String(uso.nombre).slice(0, 80), ok: !res.error,
          ...(typeof uso.entrada?.ruta === 'string' ? { ruta: uso.entrada.ruta.slice(0, 300) } : {}),
          ...(res.rechazo ? { motivo: res.rechazo.motivo } : {}),
        }, meta);
      }
      for (const e of res.escritos ?? []) escritos.set(e.ruta, e);
      if (res.requiereRevision && res.rechazo) propuestos.push(res.rechazo.ruta);
      resultados.push({ tipo: 'resultado_herramienta', idUso: uso.id, contenido: res.texto, esError: Boolean(res.error) });
    }
    mensajes.push({ rol: 'usuario', contenido: resultados });
    // Igual que en modo de bloque: tocar dependencias o configuración termina el intento
    if (propuestos.length > 0) fin = 'dependencias';
  }

  if (!fin && !errorInfra) {
    fin = 'turnos_agotados';
    deps.log.append('ciclo:turnos_agotados', { iteracion: it, turnos: turnosMax, aviso: `El implementador alcanzó el máximo de ${turnosMax} turnos: se ejecutan las pruebas con lo que haya escrito.` }, meta);
  }

  // Se conserva lo ya escrito en iteraciones anteriores; lo nuevo sustituye por ruta
  const porRuta = new Map(estado.implementacion.archivos.map((a) => [a.ruta, a]));
  for (const a of escritos.values()) porRuta.set(a.ruta, a);
  const parcial = {
    implementacion: { archivos: [...porRuta.values()] },
    presupuesto,
    implementador: 'turnos',
    turnos: (estado.turnos ?? 0) + respondidos,
  };
  const revision = (motivo, detalle) => /** @type {any} */ ({ ...parcial, ...ayudas.pedirRevision(motivo, 'coder', detalle) });

  if (errorInfra) return revision('infraestructura', errorInfra);
  switch (fin) {
    case 'dependencias':
      return revision('dependencias',
        `El implementador propone cambiar dependencias o configuración que alguna herramienta ejecuta sola (${[...new Set(propuestos)].join(', ')}). El cambio no se aplicó: revísalo y hazlo tú si es correcto.`);
    case 'presupuesto':
      // Con algo escrito, las pruebas finales no cuestan dinero y pueden dar el trabajo por bueno
      return escritos.size > 0 ? /** @type {any} */ (parcial) : revision('presupuesto');
    case 'sin_herramientas':
      deps.log.append('ciclo:implementador_sin_herramientas', { iteracion: it, aviso: 'El modelo al que se degradó por gasto no admite herramientas: el trabajo por turnos se detiene aquí.' }, meta);
      return escritos.size > 0 ? /** @type {any} */ (parcial)
        : revision('presupuesto', 'El gasto alcanzó el umbral de degradación y el modelo local no admite herramientas. Si continúas, el implementador trabajará en modo de bloque.');
    case 'terminado':
      return escritos.size > 0 ? /** @type {any} */ (parcial)
        : revision('salida_invalida', 'El implementador terminó sin modificar ningún archivo.');
    default:
      return /** @type {any} */ (parcial);   // turnos agotados: pruebas finales con lo que haya (CA-004-02)
  }
}
