/**
 * protocolo.js — Servidor MCP sobre entrada y salida estándar, sin dependencias (ADR-12)
 *
 * JSON-RPC 2.0 con un mensaje por línea. Cubre lo que necesita un servidor de
 * herramientas: initialize, notifications/initialized, ping, tools/list y tools/call.
 * Toma la entrada y la salida como flujos, así que se prueba entero en memoria.
 *
 * Solo los mensajes del protocolo salen por `salida`; los avisos van a `avisar`
 * (stderr en el servidor real): un cliente que lee stdout no debe ver nada más.
 */

import { createInterface } from 'node:readline';

export const VERSIONES = ['2025-06-18', '2025-03-26', '2024-11-05'];

/** Códigos de error de JSON-RPC 2.0. */
export const ERR = { PARSE: -32700, PETICION: -32600, METODO: -32601, PARAMS: -32602, INTERNO: -32603 };

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
  }

  /** Empieza a atender. Se resuelve cuando se cierra la entrada y terminan las peticiones en curso. */
  iniciar() {
    return new Promise((resolver) => {
      let descartando = false;
      const rl = createInterface({ input: this.o.entrada, crlfDelay: Infinity, terminal: false });
      rl.on('line', (linea) => {
        if (descartando) { descartando = false; return; }
        if (linea.length > MAX_LINEA) {
          this.avisar(`línea de ${linea.length} bytes descartada`);
          this._enviar({ jsonrpc: '2.0', id: null, error: { code: ERR.PETICION, message: 'Mensaje demasiado grande' } });
          return;
        }
        if (linea.trim() === '') return;
        const p = this._atender(linea).catch((e) => this.avisar(`error interno: ${e instanceof Error ? e.message : e}`));
        this.pendientes.add(p);
        p.finally(() => this.pendientes.delete(p));
      });
      rl.on('close', async () => {
        await Promise.allSettled([...this.pendientes]);
        resolver(undefined);
      });
    });
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

    try {
      const resultado = await this._despachar(msg.method, msg.params, esNotificacion);
      if (!esNotificacion) this._responder(id, resultado);
    } catch (e) {
      if (esNotificacion) { this.avisar(`notificación "${msg.method}" falló: ${e instanceof Error ? e.message : e}`); return; }
      if (e instanceof ErrorProtocolo) this._fallar(id, e.code, e.message, e.data);
      else this._fallar(id, ERR.INTERNO, 'Error interno del servidor');
      if (!(e instanceof ErrorProtocolo)) this.avisar(`error interno en "${msg.method}": ${e instanceof Error ? e.stack : e}`);
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
      case 'notifications/cancelled':
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

export class ErrorProtocolo extends Error {
  /** @param {number} code @param {string} message @param {any} [data] */
  constructor(code, message, data) {
    super(message);
    this.code = code;
    this.data = data;
  }
}
