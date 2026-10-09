/**
 * protocolo.js — Servidor MCP sobre entrada y salida estándar, sin dependencias (ADR-12)
 *
 * JSON-RPC 2.0 con un mensaje por línea. Cubre lo que necesita un servidor de
 * herramientas: initialize, notifications/initialized, ping, tools/list y tools/call.
 * Toma la entrada y la salida como flujos, así que se prueba entero en memoria.
 *
 * Habla las dos épocas del protocolo (spec 2026-10-09-puesta-al-dia, HU-002; informe en
 * .sdd/especificaciones/2026-10-09-puesta-al-dia/spikes/mcp-revision-vigente.md):
 *
 *   - Con saludo (`VERSIONES`, hasta 2025-11-25): el cliente abre con `initialize` y la
 *     versión vale para todo el proceso. Nada cambia respecto a lo que ya había.
 *   - Sin estado (`VERSIONES_SIN_ESTADO`, desde 2026-07-28): no hay saludo. Cada petición
 *     trae su versión y las capacidades del cliente en `params._meta`, y cada resultado
 *     lleva `resultType`. El servidor elige la época petición a petición, según cómo
 *     llegue: es lo que la especificación llama un servidor de las dos épocas.
 *
 * Fuente: https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning
 *
 * Solo los mensajes del protocolo salen por `salida`; los avisos van a `avisar`
 * (stderr en el servidor real): un cliente que lee stdout no debe ver nada más.
 */


/** Revisiones con saludo `initialize`, de la más reciente a la más antigua. */
export const VERSIONES = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];

/** Revisiones sin estado: la versión viaja en cada petición. */
export const VERSIONES_SIN_ESTADO = ['2026-07-28'];

/** Claves reservadas de `_meta` en las revisiones sin estado. */
export const META = {
  VERSION:      'io.modelcontextprotocol/protocolVersion',
  CAPACIDADES:  'io.modelcontextprotocol/clientCapabilities',
  CLIENTE:      'io.modelcontextprotocol/clientInfo',
  SERVIDOR:     'io.modelcontextprotocol/serverInfo',
  SUSCRIPCION:  'io.modelcontextprotocol/subscriptionId',
};

/** Resultado interno: la petición queda abierta y no recibe respuesta (`subscriptions/listen`). */
const SIN_RESPUESTA = Symbol('sin respuesta');

/**
 * Códigos de error de JSON-RPC 2.0 y, de los que reserva el protocolo (-32020 a -32099),
 * el único que este servidor emite: versión no admitida.
 */
export const ERR = { PARSE: -32700, PETICION: -32600, METODO: -32601, PARAMS: -32602, INTERNO: -32603, VERSION: -32022 };

/**
 * Cuánto puede dar por buena un cliente la lista de herramientas (revisiones sin estado).
 * La lista es fija mientras vive el proceso; cinco minutos, como el ejemplo de la especificación.
 */
const TTL_LISTA_MS = 300_000;

/** Una línea mayor que esto se descarta: es un cliente roto o hostil. */
const MAX_LINEA = 10 * 1024 * 1024;

/**
 * @typedef {Object} Herramienta
 * @property {string} name
 * @property {string} description
 * @property {{ type: 'object', properties: Record<string, any>, required?: string[], additionalProperties?: boolean }} inputSchema
 * @property {(args: any) => Promise<{ texto: string, error?: boolean }>} ejecutar
 */

/** Comprueba los argumentos contra el subconjunto de JSON Schema que usan las herramientas. */
export function validarArgumentos(schema, args) {
  if (args === undefined) args = {};
  if (args === null || typeof args !== 'object' || Array.isArray(args)) return 'los argumentos deben ser un objeto';
  for (const campo of schema.required ?? []) {
    if (!(campo in args)) return `falta el argumento "${campo}"`;
  }
  for (const [campo, valor] of Object.entries(args)) {
    const def = schema.properties?.[campo];
    if (!def) return `argumento desconocido: "${campo}"`;
    if (def.type === 'string' && typeof valor !== 'string') return `"${campo}" debe ser texto`;
    if (def.enum && !def.enum.includes(valor)) return `"${campo}" debe ser uno de: ${def.enum.join(', ')}`;
    if (def.maxLength && typeof valor === 'string' && valor.length > def.maxLength) return `"${campo}" supera el máximo de ${def.maxLength} caracteres`;
  }
  return null;
}

export class ServidorMcp {
  /**
   * @param {{
   *   nombre: string, version: string, instrucciones?: string,
   *   herramientas: Herramienta[],
   *   entrada: import('node:stream').Readable,
   *   salida: import('node:stream').Writable,
   *   avisar?: (mensaje: string) => void,
   * }} opciones
   */
  constructor(opciones) {
    this.o = opciones;
    this.herramientas = new Map(opciones.herramientas.map((h) => [h.name, h]));
    this.avisar = opciones.avisar ?? (() => {});
    this.inicializado = false;
    this.pendientes = new Set();
    /** Peticiones sin estado en curso y las que el cliente canceló: de estas no sale respuesta */
    this.enCurso = new Set();
    this.canceladas = new Set();
    /** Suscripciones abiertas (`subscriptions/listen`), por el id de su petición */
    this.suscripciones = new Set();
  }

  /** Empieza a atender. Se resuelve cuando se cierra la entrada y terminan las peticiones en curso. */
  iniciar() {
    return new Promise((resolver) => {
      const entrada = this.o.entrada;
      entrada.setEncoding?.('utf8');
      let resto = '';
      let descartando = false;   // true mientras se tira el resto de una línea demasiado grande
      let cerrada = false;

      const procesar = (linea) => {
        if (linea.trim() === '') return;
        const p = this._atender(linea).catch((e) => this.avisar('error interno: ' + (e instanceof Error ? e.message : e)));
        this.pendientes.add(p);
        p.finally(() => this.pendientes.delete(p));
      };

      // Se divide por saltos de línea a mano: así una línea sin fin nunca se acumula más allá del tope
      entrada.on('data', (trozo) => {
        let datos = resto + trozo;
        resto = '';
        let i;
        while ((i = datos.indexOf('\n')) !== -1) {
          const linea = datos.slice(0, i).replace(/\r$/, '');
          datos = datos.slice(i + 1);
          if (descartando) { descartando = false; continue; }
          if (linea.length > MAX_LINEA) { this._lineaGrande(linea.length); continue; }
          procesar(linea);
        }
        if (descartando) return;
        if (datos.length > MAX_LINEA) { this._lineaGrande(datos.length); descartando = true; return; }
        resto = datos;
      });

      const cerrar = async () => {
        if (cerrada) return;
        cerrada = true;
        if (resto.trim() !== '' && !descartando) procesar(resto.replace(/\r$/, ''));
        await Promise.allSettled([...this.pendientes]);
        resolver(undefined);
      };
      entrada.on('end', cerrar);
      entrada.on('close', cerrar);
    });
  }

  _lineaGrande(bytes) {
    this.avisar('línea de más de ' + bytes + ' caracteres descartada');
    this._enviar({ jsonrpc: '2.0', id: null, error: { code: ERR.PETICION, message: 'Mensaje demasiado grande' } });
  }

  _enviar(mensaje) {
    this.o.salida.write(JSON.stringify(mensaje) + '\n');
  }

  _responder(id, result) { this._enviar({ jsonrpc: '2.0', id, result }); }
  _fallar(id, code, message, data) { this._enviar({ jsonrpc: '2.0', id, error: { code, message, ...(data === undefined ? {} : { data }) } }); }

  async _atender(linea) {
    let msg;
    try {
      msg = JSON.parse(linea);
    } catch {
      this._fallar(null, ERR.PARSE, 'JSON no válido');
      return;
    }
    if (Array.isArray(msg)) {
      // El agrupado de mensajes se retiró en la versión 2025-06-18 del protocolo
      this._fallar(null, ERR.PETICION, 'No se admiten mensajes agrupados');
      return;
    }
    if (msg === null || typeof msg !== 'object' || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
      // Una respuesta del cliente (no hacemos peticiones) o un mensaje que no es JSON-RPC
      if (msg && typeof msg === 'object' && ('result' in msg || 'error' in msg)) return;
      this._fallar(msg && typeof msg === 'object' && 'id' in msg ? msg.id : null, ERR.PETICION, 'Petición no válida');
      return;
    }

    const esNotificacion = !('id' in msg);
    const id = msg.id;
    if (!esNotificacion && (typeof id !== 'string' && typeof id !== 'number')) {
      this._fallar(null, ERR.PETICION, 'El id debe ser texto o número');
      return;
    }

    // La época la decide cada petición: con versión en _meta (o server/discover, que solo existe
    // en las revisiones sin estado) se atiende sin estado; `initialize` y todo lo demás, como siempre
    const sinEstado = !esNotificacion && esSinEstado(msg.method, msg.params);
    if (sinEstado) this.enCurso.add(id);

    try {
      const resultado = sinEstado
        ? await this._despacharSinEstado(msg.method, msg.params, id)
        : await this._despachar(msg.method, msg.params, esNotificacion);
      if (resultado === SIN_RESPUESTA) return;
      // Sin estado, una petición cancelada no recibe ningún mensaje más
      if (!esNotificacion && !this.canceladas.has(id)) this._responder(id, resultado);
    } catch (e) {
      if (esNotificacion) { this.avisar(`notificación "${msg.method}" falló: ${e instanceof Error ? e.message : e}`); return; }
      if (!(e instanceof ErrorProtocolo)) this.avisar(`error interno en "${msg.method}": ${e instanceof Error ? e.stack : e}`);
      if (this.canceladas.has(id)) return;
      if (e instanceof ErrorProtocolo) this._fallar(id, e.code, e.message, e.data);
      else this._fallar(id, ERR.INTERNO, 'Error interno del servidor');
    } finally {
      if (sinEstado) { this.enCurso.delete(id); this.canceladas.delete(id); }
    }
  }

  /**
   * Revisiones sin estado (2026-07-28): cada petición se valida y se atiende sola, sin
   * apoyarse en ninguna anterior. No existen `initialize` ni `ping`.
   */
  async _despacharSinEstado(metodo, params, id) {
    const meta = params && typeof params === 'object' && params._meta && typeof params._meta === 'object' ? params._meta : {};
    const pedida = meta[META.VERSION];
    const capacidades = meta[META.CAPACIDADES];
    // Faltar un campo obligatorio de _meta es una petición mal formada: -32602
    if (typeof pedida !== 'string' || capacidades === null || typeof capacidades !== 'object' || Array.isArray(capacidades)) {
      throw new ErrorProtocolo(ERR.PARAMS, `Faltan campos obligatorios en params._meta: "${META.VERSION}" (texto) y "${META.CAPACIDADES}" (objeto)`);
    }
    if (!VERSIONES_SIN_ESTADO.includes(pedida)) {
      // `supported` trae solo las que sirven para reintentar tal cual; las de saludo se nombran en el mensaje
      throw new ErrorProtocolo(
        ERR.VERSION,
        `Versión del protocolo no admitida: "${pedida}". Sin saludo se admite: ${VERSIONES_SIN_ESTADO.join(', ')}. Abriendo con "initialize" se admiten además: ${VERSIONES.join(', ')}`,
        { supported: [...VERSIONES_SIN_ESTADO], requested: pedida },
      );
    }

    const identidad = { _meta: { [META.SERVIDOR]: { name: this.o.nombre, version: this.o.version } } };
    switch (metodo) {
      case 'server/discover':
        return {
          resultType: 'complete',
          supportedVersions: [...VERSIONES_SIN_ESTADO],
          capabilities: { tools: { listChanged: false } },
          ...(this.o.instrucciones ? { instructions: this.o.instrucciones } : {}),
          ttlMs: TTL_LISTA_MS,
          cacheScope: 'public',
          ...identidad,
        };
      case 'tools/list':
        return {
          resultType: 'complete',
          // Siempre en el mismo orden: el cliente puede guardar la lista
          tools: [...this.herramientas.values()].map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
          ttlMs: TTL_LISTA_MS,
          cacheScope: 'public',
          ...identidad,
        };
      case 'tools/call':
        return { resultType: 'complete', ...(await this._llamar(params)), ...identidad };
      case 'subscriptions/listen':
        // La lista de herramientas no cambia mientras vive el proceso (listChanged: false) y no hay
        // recursos ni prompts: se acepta la suscripción con el filtro vacío, que es decirle al cliente
        // que no llegará ningún aviso. Queda abierta, sin respuesta, hasta que el cliente la cancele
        // o cierre la entrada.
        this.suscripciones.add(id);
        this._enviar({ jsonrpc: '2.0', method: 'notifications/subscriptions/acknowledged', params: { _meta: { [META.SUSCRIPCION]: id }, notifications: {} } });
        return SIN_RESPUESTA;
      default:
        throw new ErrorProtocolo(ERR.METODO, `Método no encontrado: ${metodo}`);
    }
  }

  async _despachar(metodo, params, esNotificacion) {
    switch (metodo) {
      case 'initialize': {
        const pedida = params?.protocolVersion;
        this.inicializado = true;
        return {
          protocolVersion: VERSIONES.includes(pedida) ? pedida : VERSIONES[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: this.o.nombre, version: this.o.version },
          ...(this.o.instrucciones ? { instructions: this.o.instrucciones } : {}),
        };
      }
      case 'notifications/initialized':
        return undefined;
      case 'notifications/cancelled':
        // Solo tiene efecto sobre peticiones sin estado en curso: su respuesta ya no se envía.
        // Con saludo se conserva el comportamiento de siempre (la respuesta llega igual).
        if (this.suscripciones.delete(params?.requestId)) return undefined;
        if (this.enCurso.has(params?.requestId)) this.canceladas.add(params.requestId);
        return undefined;
      case 'ping':
        return {};
      case 'tools/list':
        return {
          tools: [...this.herramientas.values()].map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
        };
      case 'tools/call':
        return this._llamar(params);
      default:
        if (esNotificacion) return undefined;   // una notificación desconocida se ignora
        throw new ErrorProtocolo(ERR.METODO, `Método no encontrado: ${metodo}`);
    }
  }

  async _llamar(params) {
    if (!params || typeof params.name !== 'string') throw new ErrorProtocolo(ERR.PARAMS, 'Falta el nombre de la herramienta');
    const h = this.herramientas.get(params.name);
    if (!h) throw new ErrorProtocolo(ERR.PARAMS, `Herramienta desconocida: ${params.name}`);

    // Los argumentos mal formados son un error de la herramienta, no del protocolo: el agente puede corregirlos
    const problema = validarArgumentos(h.inputSchema, params.arguments);
    if (problema) return { content: [{ type: 'text', text: `Argumentos no válidos: ${problema}` }], isError: true };

    try {
      const r = await h.ejecutar(params.arguments ?? {});
      return { content: [{ type: 'text', text: r.texto }], ...(r.error ? { isError: true } : {}) };
    } catch (e) {
      this.avisar(`la herramienta "${h.name}" lanzó: ${e instanceof Error ? e.stack : e}`);
      return { content: [{ type: 'text', text: `La herramienta falló: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
    }
  }
}

/**
 * ¿Es una petición de las revisiones sin estado? Lo es si declara su versión en
 * `params._meta`, o si es `server/discover`, que no existe en las revisiones con saludo.
 * `initialize` siempre es de las de saludo, lleve lo que lleve.
 * @param {string} metodo
 * @param {any} params
 */
function esSinEstado(metodo, params) {
  if (metodo === 'initialize') return false;
  if (metodo === 'server/discover') return true;
  const meta = params && typeof params === 'object' ? params._meta : undefined;
  return Boolean(meta) && typeof meta === 'object' && META.VERSION in meta;
}

export class ErrorProtocolo extends Error {
  /** @param {number} code @param {string} message @param {any} [data] */
  constructor(code, message, data) {
    super(message);
    this.code = code;
    this.data = data;
  }
}
