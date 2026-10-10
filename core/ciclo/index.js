/**
 * ciclo/index.js — Fachada del ciclo verificado
 *
 * Ejecuta una tarea de código hasta que sus pruebas pasan o hasta que hace
 * falta la decisión de una persona. Reanuda desde el último punto de guardado.
 */

import * as fs from 'fs';
import * as path from 'path';
import { LlmAgentAdapter } from '../agent-registry.js';
import { crearProvider, OllamaProvider } from '../llm-providers/index.js';
import { crearRecuperador } from '../recuperacion/recuperador.js';
import { GuardadorArchivos } from './checkpoint-archivos.js';
import { leerConfigCiclo } from './config.js';
import { Diario, claveDe, LibroDeGasto } from './diario.js';
import { estadoInicial } from './estado.js';
import { INICIO, REVISION } from './grafo.js';
import { elegirMotor } from './motores/index.js';
import { costoDe, estadoDe } from './presupuesto.js';
import { Respaldo } from './respaldo.js';

const ARCHIVO_SESION = 'sesion.json';
const ID_VALIDO = /^\w[\w.-]*$/;

/** @param {string} cwd */
export function dirMotorBase(cwd) {
  return path.join(cwd, '.sdd', 'motor');
}

/**
 * Sesión en curso: la crea `forge run` y la reutiliza `forge resume`.
 * @param {string} cwd
 * @returns {{ runId: string, modo: string, creada: string } | null}
 */
export function sesionActual(cwd) {
  try {
    const sesion = JSON.parse(fs.readFileSync(path.join(dirMotorBase(cwd), ARCHIVO_SESION), 'utf8'));
    // El runId acaba en rutas de disco: un sesion.json ajeno no puede apuntar fuera de .sdd/motor
    return typeof sesion?.runId === 'string' && ID_VALIDO.test(sesion.runId) ? sesion : null;
  } catch {
    return null;
  }
}

/**
 * Tareas del ciclo sin terminar en CUALQUIER sesion del proyecto. Una sesion nueva sobrescribe
 * `sesion.json`, pero el codigo que dejo el modelo sigue en el proyecto: la guarda del modo clasico
 * no puede fiarse solo de la ultima.
 * @param {string} cwd
 * @returns {string[]}
 */
export function tareasSinTerminarEnElProyecto(cwd) {
  const pendientes = [];
  let sesiones = [];
  try { sesiones = fs.readdirSync(dirMotorBase(cwd), { withFileTypes: true }).filter((d) => d.isDirectory() && ID_VALIDO.test(d.name)); } catch { return []; }
  for (const d of sesiones) {
    try {
      const ciclo = new CicloVerificado(/** @type {any} */ ({ cwd, runId: d.name }));
      const resumen = ciclo.resumen();
      for (const t of resumen) {
        if (!RESULTADOS_FINALES.includes(t.resultado)) pendientes.push(t.taskId);
      }
      // Una carpeta de hilo sin ningun punto valido (dañado): no se sabe en que estaba, se trata como sin terminar
      const hilos = fs.existsSync(ciclo.guardador.dir) ? fs.readdirSync(ciclo.guardador.dir).length : 0;
      if (hilos > resumen.length) pendientes.push(`(${hilos - resumen.length} punto(s) de guardado dañado(s) en ${d.name})`);
    } catch { /* una sesion ilegible no impide mirar las demas */ }
  }
  return [...new Set(pendientes)];
}

/** @param {string} cwd */
export function nuevaSesion(cwd) {
  const sesion = { runId: `run-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${process.pid}`, modo: 'ciclo', creada: new Date().toISOString() };
  fs.mkdirSync(dirMotorBase(cwd), { recursive: true });
  fs.writeFileSync(path.join(dirMotorBase(cwd), ARCHIVO_SESION), JSON.stringify(sesion, null, 2), 'utf8');
  return sesion;
}

/**
 * ¿Tiene esta tarea puntos de guardado del ciclo en la sesión? Si los tiene,
 * hay que reanudarla con el ciclo: relanzarla en modo clásico ejecutaría en el
 * equipo anfitrión código que escribió un modelo.
 * @param {string} cwd @param {string} runId @param {string} taskId
 */
export function tienePuntosDeGuardado(cwd, runId, taskId) {
  if (!ID_VALIDO.test(runId)) return false;
  return new GuardadorArchivos(path.join(dirMotorBase(cwd), runId)).ultimo(`${runId}:${taskId}`).punto !== null;
}

/**
 * Llamador por defecto: los agentes de agents/*.md a través del proveedor configurado.
 * @param {import('../agent-registry.js').AgentRegistry} registry
 * @param {string|undefined} apiKey
 * @param {string} cwd
 * @param {{ proveedor?: object }} [opciones]  `proveedor`: uno ya creado, para pruebas (por defecto, el configurado)
 */
export function crearLlamador(registry, apiKey, cwd, opciones = {}) {
  // ADR-21. Un proveedor por cada destino, creado al primer uso: el configurado y el local de la degradación
  /** @type {Record<string, any>} */
  const proveedores = {};
  const proveedorDe = (local) => proveedores[local ? 'local' : 'configurado'] ??= local
    ? new OllamaProvider()
    : (opciones.proveedor ?? crearProvider({ cwd, config: apiKey ? { api_key: apiKey } : {} }));
  return {
    /**
     * ¿Admite conversaciones con herramientas el proveedor que atendería esta llamada?
     * @param {{ agente?: string, proveedorLocal?: boolean }} [peticion]
     */
    admiteHerramientas: ({ proveedorLocal } = {}) => proveedorDe(Boolean(proveedorLocal)).admiteHerramientas === true,
    /**
     * Un turno del implementador por turnos: mismo agente y mismo prompt de sistema que `llamar`.
     * @param {{ agente: string, modeloAlias: string, mensajes: any[], herramientas: any[], extraContext?: string, proveedorLocal?: boolean }} peticion
     */
    conversar: async ({ agente, modeloAlias, mensajes, herramientas, extraContext, proveedorLocal }) => {
      const def = registry.get(agente);
      if (!def) return { ok: false, error: `Agente desconocido: "${agente}"` };
      const adaptador = new LlmAgentAdapter({ ...def, model: modeloAlias }, apiKey, undefined, cwd, proveedorDe(Boolean(proveedorLocal)));
      const r = /** @type {any} */ (await /** @type {any} */ (adaptador).conversar({ mensajes, herramientas, extraContext }));
      const cache = typeof r.cacheCreationTokens === 'number' || typeof r.cacheReadTokens === 'number'
        ? { cacheCreationTokens: r.cacheCreationTokens ?? 0, cacheReadTokens: r.cacheReadTokens ?? 0 }
        : {};
      return { ok: r.ok, contenido: r.contenido, stopReason: r.stopReason, inputTokens: r.inputTokens, outputTokens: r.outputTokens, ...cache, modelo: r.modelo, proveedor: r.provider, error: r.error };
    },
    /** @param {string} agente */
    aliasDe: (agente) => registry.get(agente)?.model ?? 'sonnet',
    /**
     * `proveedorLocal`: usar un modelo local (Ollama) en lugar del proveedor configurado;
     * es a donde lleva la degradación con `presupuesto.degradar_a: local`.
     * @param {{ agente: string, modeloAlias: string, userPrompt: string, extraContext?: string, proveedorLocal?: boolean }} peticion
     */
    llamar: async ({ agente, modeloAlias, userPrompt, extraContext, proveedorLocal }) => {
      const def = registry.get(agente);
      if (!def) return { ok: false, error: `Agente desconocido: "${agente}"` };
      const adaptador = new LlmAgentAdapter({ ...def, model: modeloAlias }, apiKey, undefined, cwd, proveedorDe(Boolean(proveedorLocal)));
      const r = /** @type {any} */ (await adaptador.execute({ cwd, userPrompt, extraContext }));
      // Los tokens de caché solo viajan si el proveedor los informó: sin ellos la respuesta no cambia de forma
      const cache = typeof r.cacheCreationTokens === 'number' || typeof r.cacheReadTokens === 'number'
        ? { cacheCreationTokens: r.cacheCreationTokens ?? 0, cacheReadTokens: r.cacheReadTokens ?? 0 }
        : {};
      return { ok: r.ok, output: r.output, inputTokens: r.inputTokens, outputTokens: r.outputTokens, ...cache, modelo: r.modelo, proveedor: r.provider, error: r.error };
    },
  };
}

/**
 * Estado del ciclo verificado para `forge status`. Vacío si no hay sesión.
 * @param {string} cwd
 * @returns {string[]}
 */
export function lineasEstadoCiclo(cwd) {
  const sesion = sesionActual(cwd);
  if (!sesion) return [];
  const ciclo  = new CicloVerificado(/** @type {any} */ ({ cwd, runId: sesion.runId }));
  const tareas = ciclo.resumen();
  if (tareas.length === 0) return [];

  const gasto  = ciclo.libro.total();
  const tope   = ciclo.libro.tope() ?? tareas[0].presupuesto.tope_usd;
  const lineas = [
    `Ciclo verificado · sesión ${sesion.runId}`,
    `  Gasto: $${gasto.usd.toFixed(4)} de $${tope.toFixed(2)} · ${gasto.llamadas} llamadas`,
  ];
  const exentas = tareas.filter((t) => t.exentaDelRojo);
  if (exentas.length > 0) {
    lineas.push(`  Exentas del rojo obligatorio (parte_de_codigo_existente): ${exentas.length} de ${tareas.length} · ${exentas.map((t) => t.taskId).join(', ')} · sus pruebas pueden pasar antes de implementar; revisa que sea cierto`);
  }
  const porTarea = ciclo.libro.porTarea();
  if ('tokens_cache_escritura' in gasto) {
    lineas.push(`  Caché de prompts: ${gasto.tokens_cache_lectura} tokens reutilizados · ${gasto.tokens_cache_escritura} guardados · ${gasto.tokens_in} a precio normal`);
  }
  for (const t of tareas) {
    const situacion = t.revision && !t.revision.decision
      ? `espera decisión (${t.revision.motivo})`
      : t.siguiente ? `en curso, siguiente paso: ${t.siguiente}` : t.resultado;
    // CA-004-04: con el implementador por turnos, cuántos turnos y cuánto gasto lleva la tarea
    const turnos = t.implementador === 'turnos'
      ? ` · ${t.turnos ?? 0} turno${t.turnos === 1 ? '' : 's'} · $${(porTarea[t.taskId]?.usd ?? 0).toFixed(4)}`
      : '';
    lineas.push(`  ${t.taskId}: iteración ${t.iteracion}/${t.maxIteraciones} · ${situacion}${turnos}${textoMutacion(t.mutacion)}`);
  }
  return lineas;
}

/**
 * Puntuación de la medición por mutación de una tarea, para `forge status`. Vacío si no se midió.
 * @param {import('./estado.js').Mutacion|null|undefined} m
 */
export function textoMutacion(m) {
  if (!m) return '';
  const descartadas = m.noConcluyentes ? `, ${m.noConcluyentes} descartadas por no compilar o no cargar` : '';
  if (typeof m.puntuacion !== 'number') {
    const porque = m.omitida ? 'nada que alterar' : m.motivoParcial === 'linea_base' ? 'las pruebas fallan sin alterar nada' : m.motivoParcial === 'infraestructura' ? 'falló el entorno' : 'ninguna alteración concluyente';
    return ` · mutación: no medida (${porque}${descartadas})`;
  }
  return ` · mutación: ${m.detectadas}/${m.probadas} detectadas (${Math.round(m.puntuacion * 100)} %${m.parcial ? ', parcial' : ''}${descartadas})`;
}

/**
 * Línea de `forge status`: qué mecanismo de aislamiento usará el ciclo (`sandbox.runtime`).
 * No consulta a Docker (eso lo hace `forge doctor`): solo dice lo configurado.
 * @param {string} cwd
 * @returns {string}
 */
export function lineaAislamiento(cwd) {
  try {
    const runtime = leerConfigCiclo(cwd).sandbox.runtime;
    return runtime
      ? `Aislamiento: Docker con el mecanismo "${runtime}" (sandbox.runtime)`
      : 'Aislamiento: Docker con su mecanismo por defecto (sandbox.runtime sin indicar)';
  } catch (e) {
    return `Aislamiento: configuración no válida (${e instanceof Error ? e.message : e})`;
  }
}

/** @type {Record<string, 'completada'|'en_revision'|'abortada'>} */
const ESTADO_POR_RESULTADO = {
  exito: 'completada',
  aceptada_por_humano: 'completada',
  abortada: 'abortada',
  revision_pendiente: 'en_revision',
  en_curso: 'en_revision',
};

/** Resultados con los que una tarea ya no necesita nada más. */
export const RESULTADOS_FINALES = ['exito', 'aceptada_por_humano', 'abortada'];

export class CicloVerificado {
  /**
   * @param {{
   *   cwd: string,
   *   runId: string,
   *   config: ReturnType<typeof import('./config.js').leerConfigCiclo>,
   *   log: { append: Function },
   *   llamar: Function,
   *   aliasDe: (agente: string) => string,
   *   runner: { test: (cwd: string) => Promise<any> },
   *   testCmd: string,
   *   specPath?: string,
   *   vetadas?: string[],
   *   recuperar?: Function,
   *   conversar?: Function,
   *   admiteHerramientas?: (peticion: { agente: string, proveedorLocal?: boolean }) => boolean,
   * }} opciones
   *   `conversar` y `admiteHerramientas`: solo para el implementador por turnos (ADR-21); sin ellos, modo de bloque.
   */
  constructor(opciones) {
    if (typeof opciones.runId !== 'string' || !ID_VALIDO.test(opciones.runId)) {
      throw new Error(`Identificador de sesión no válido: "${opciones.runId}"`);
    }
    this.o         = opciones;
    this.dirMotor  = path.join(dirMotorBase(opciones.cwd), opciones.runId);
    this.guardador = new GuardadorArchivos(this.dirMotor);
    this.diario    = new Diario(this.dirMotor);
    this.libro     = new LibroDeGasto(this.dirMotor);
    // Un punto guardado cierra lo que había en vuelo: el diario ya no hace falta
    this.guardador.alGuardar = (threadId) => this.diario.limpiar(threadId);
  }

  /**
   * Gasto real de la sesión: lo suma el libro llamada a llamada, así que no depende
   * de que ninguna tarea llegue a guardar su estado.
   */
  _ajustarGasto(presupuesto) {
    const t = this.libro.total();
    const cache = 'tokens_cache_escritura' in t ? { tokens_cache_escritura: t.tokens_cache_escritura, tokens_cache_lectura: t.tokens_cache_lectura } : {};
    const ajustado = { ...presupuesto, gastado_usd: t.usd, llamadas: t.llamadas, tokens_in: t.tokens_in, tokens_out: t.tokens_out, ...cache };
    return { ...ajustado, estado: estadoDe(ajustado) };
  }

  /**
   * Llama al modelo con diario y libro de gasto. Una respuesta ya recibida de una
   * ejecución cortada se recupera del diario: no se vuelve a pagar.
   */
  _llamador(threadId, taskId) {
    return async (peticion) => {
      const clave = claveDe(peticion);
      const previa = this.diario.obtener(threadId, clave);
      if (previa) return previa;

      const r = await this.o.llamar(peticion);
      if (r.ok) {
        const conConsumo = typeof r.inputTokens === 'number' && typeof r.outputTokens === 'number';
        // Cada tipo de token a su precio: entrada normal, escritura de caché, lectura de caché y salida
        const usd = conConsumo ? costoDe(r, { precios: this.o.config?.precios }) : 0;
        // Sin consumo (proveedor que no lo informa) se anota con coste 0: el nodo lo trata como error aparte
        this.libro.anotar({
          taskId, usd, inputTokens: r.inputTokens ?? 0, outputTokens: r.outputTokens ?? 0,
          ...(conConsumo ? { cacheCreationTokens: r.cacheCreationTokens, cacheReadTokens: r.cacheReadTokens } : {}),
        });
        this.diario.anotar(threadId, clave, r);
      }
      return r;
    };
  }

  /**
   * Un turno del implementador por turnos, con diario y libro de gasto. La clave no es la huella
   * del prompt (que aquí es la conversación entera) sino la posición del turno: la pone turnos.js.
   * La respuesta se anota antes de devolverla, es decir, antes de ejecutar ninguna herramienta.
   */
  _conversador(threadId, taskId) {
    return async ({ clave, ...peticion }) => {
      const previa = this.diario.obtener(threadId, clave);
      if (previa) return { ...previa, delDiario: true };
      if (typeof this.o.conversar !== 'function') return { ok: false, error: 'No hay un proveedor de modelos con herramientas configurado.' };

      const r = await this.o.conversar(peticion);
      if (r.ok) {
        const conConsumo = typeof r.inputTokens === 'number' && typeof r.outputTokens === 'number';
        const usd = conConsumo ? costoDe(r, { precios: this.o.config?.precios }) : 0;
        this.libro.anotar({
          taskId, usd, inputTokens: r.inputTokens ?? 0, outputTokens: r.outputTokens ?? 0,
          ...(conConsumo ? { cacheCreationTokens: r.cacheCreationTokens, cacheReadTokens: r.cacheReadTokens } : {}),
        });
        this.diario.anotar(threadId, clave, r);
      }
      return r;
    };
  }

  /**
   * Avance de la medición por mutación de una tarea (ADR-20): el resultado de cada alteración ya
   * probada. Si el proceso se corta a mitad de la medición, al reanudar no se repiten.
   * @param {string} taskId
   */
  _avanceMutacion(taskId) {
    const archivo = path.join(this.dirMotor, 'mutacion', `${taskId.replace(/[^\w.-]/g, '_')}.json`);
    return {
      leer: () => { try { return JSON.parse(fs.readFileSync(archivo, 'utf8')); } catch { return null; } },
      guardar: (dato) => {
        // Escritura atómica: un corte a mitad no deja un archivo a medias
        fs.mkdirSync(path.dirname(archivo), { recursive: true });
        const temporal = `${archivo}.${process.pid}.tmp`;
        fs.writeFileSync(temporal, JSON.stringify(dato), 'utf8');
        fs.renameSync(temporal, archivo);
      },
    };
  }

  /**
   * @param {{ id: string, agente: string, prompt?: string, archivos?: string[], cubre_cas?: string[], parte_de_codigo_existente?: boolean }} tarea
   * @param {{ decision: string, iteracionesExtra?: number, presupuestoExtra?: number }} [decision]
   * @returns {Promise<{ status: 'completada'|'en_revision'|'abortada', estado: import('./estado.js').EstadoCiclo, reanudada: boolean, motor: 'propio' }>}
   */
  async ejecutar(tarea, decision) {
    const { cwd, runId, config, log } = this.o;
    const threadId = `${runId}:${tarea.id}`;
    const liberar  = this.guardador.bloquear(threadId);

    try {
      const { punto, descartados } = this.guardador.ultimo(threadId);
      for (const d of descartados) {
        log.append('custom', { message: `Punto de guardado dañado, se ignora: ${d.archivo} (${d.motivo})` }, { taskId: tarea.id });
      }

      let estado;
      let desde;
      if (punto) {
        // Un punto de guardado de otra sesión o de otro proyecto no se obedece:
        // los nodos usan estado.cwd para leer, copiar y escribir
        const mismoProyecto = path.resolve(punto.estado.cwd).toLowerCase() === path.resolve(cwd).toLowerCase();
        if (!mismoProyecto || punto.estado.runId !== runId || punto.estado.taskId !== tarea.id) {
          throw new Error(`El punto de guardado de "${tarea.id}" no pertenece a esta sesión o a este proyecto: se ignora. Bórralo o inicia una sesión nueva.`);
        }
        estado = punto.estado;
        desde  = punto.siguiente;
      } else {
        estado = estadoInicial(tarea, {
          runId, cwd,
          maxIteraciones: config.motor.max_iteraciones,
          tope_usd: this.libro.tope() ?? config.presupuesto.tope_usd,
          umbral_degradacion_usd: config.presupuesto.umbral_degradacion_usd,
        });
        desde = INICIO;
      }

      // Una decisión solo tiene sentido si la tarea está esperándola
      if (decision && desde !== REVISION) {
        throw new Error(`La tarea "${tarea.id}" no está en revisión: no hay nada que decidir.`);
      }

      // El presupuesto es de la sesión: el gasto y el tope ampliado vienen del libro
      const tope = Math.max(estado.presupuesto.tope_usd, this.libro.tope() ?? 0);
      estado = { ...estado, presupuesto: this._ajustarGasto({ ...estado.presupuesto, tope_usd: tope }) };

      const deps = {
        llamar: this._llamador(threadId, tarea.id),
        respondida: (peticion) => this.diario.obtener(threadId, claveDe(peticion)) !== null,
        // ADR-21: implementador por turnos
        conversar: this._conversador(threadId, tarea.id),
        admiteHerramientas: (peticion) => typeof this.o.conversar === 'function' && this.o.admiteHerramientas?.(peticion) === true,
        diario: {
          obtener: (clave) => this.diario.obtener(threadId, clave),
          anotar: (clave, valor) => this.diario.anotar(threadId, clave, valor),
          claves: () => this.diario.claves(threadId),
        },
        aliasDe: this.o.aliasDe,
        ajustarGasto: (p) => this._ajustarGasto(p),
        runner: this.o.runner,
        recuperar: this.o.recuperar ?? crearRecuperador(config.motor.recuperador),
        respaldo: new Respaldo(cwd, path.join(this.dirMotor, 'respaldo', tarea.id.replace(/[^\w.-]/g, '_'))),
        log, config,
        testCmd: this.o.testCmd,
        avanceMutacion: this._avanceMutacion(tarea.id),
        specPath: this.o.specPath,
        vetadas: this.o.vetadas,
      };

      const motor = await elegirMotor(config.motor.grafo, (aviso) => log.append('custom', { message: aviso }, { taskId: tarea.id }));
      estado = await motor.ejecutar({ estado, desde, deps, guardador: this.guardador, decision });

      // Una ampliación del tope vale para el resto de la sesión, no solo para esta tarea
      if (estado.presupuesto.tope_usd > (this.libro.tope() ?? 0)) this.libro.guardarTope(estado.presupuesto.tope_usd);
      return { status: ESTADO_POR_RESULTADO[estado.resultado], estado, reanudada: Boolean(punto), motor: motor.nombre };
    } finally {
      liberar();
    }
  }

  /**
   * Resumen de cada tarea de la sesión, para `forge status`.
   * @returns {{ taskId: string, nodo: string, siguiente: string|null, iteracion: number, maxIteraciones: number, resultado: string, revision: any, presupuesto: any, implementador?: string, turnos?: number, mutacion: import('./estado.js').Mutacion|null, exentaDelRojo: boolean }[]}
   */
  resumen() {
    if (!fs.existsSync(this.guardador.dir)) return [];
    return fs.readdirSync(this.guardador.dir)
      .map((carpeta) => this._ultimoDeCarpeta(carpeta))
      .filter(Boolean)
      .map((p) => ({
        taskId: p.estado.taskId, nodo: p.nodo, siguiente: p.siguiente,
        iteracion: p.estado.iteracion, maxIteraciones: p.estado.maxIteraciones,
        resultado: p.estado.resultado, revision: p.estado.revision, presupuesto: p.estado.presupuesto,
        // ADR-21: modo del implementador en este hilo y turnos respondidos
        ...(p.estado.implementador ? { implementador: String(p.estado.implementador), turnos: Number(p.estado.turnos ?? 0) } : {}),
        mutacion: p.estado.mutacion ?? null,
        // H-07: la exención del rojo obligatorio la declara quien define la tarea; se muestra para que se vea
        exentaDelRojo: p.estado.tarea?.parte_de_codigo_existente === true,
      }));
  }

  /** Último punto válido de una carpeta de hilo (el nombre de carpeta lleva una huella, no es el threadId). */
  _ultimoDeCarpeta(carpeta) {
    const dir = path.join(this.guardador.dir, carpeta);
    let archivos;
    try { archivos = fs.readdirSync(dir).filter((f) => /^\d{6}\.json$/.test(f)).sort().reverse(); } catch { return null; }
    for (const archivo of archivos) {
      try {
        const punto = JSON.parse(fs.readFileSync(path.join(dir, archivo), 'utf8'));
        const hilo = `${punto.estado.runId}:${punto.estado.taskId}`;
        const valido = this.guardador.ultimo(hilo).punto;
        if (valido) return valido;
      } catch { /* siguiente */ }
    }
    return null;
  }
}
