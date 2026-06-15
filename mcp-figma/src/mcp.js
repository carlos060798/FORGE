#!/usr/bin/env node
// Implementación mínima del protocolo MCP sobre stdio (JSON-RPC 2.0)
// Sin dependencias externas — solo Node.js built-ins

import { createInterface } from "readline";

/**
 * @typedef {{ name:string, description:string, inputSchema:object, annotations?:object }} ToolDefinition
 * @typedef {(args: Record<string,any>) => Promise<object>} ToolHandler
 */

/**
 * @param {{ name:string, version:string }} serverInfo
 */
export function createServer({ name, version }) {
  /** @type {ToolDefinition[]} */
  const tools = [];
  /** @type {Record<string, ToolHandler>} */
  const handlers = {};

  const rl = createInterface({ input: process.stdin, terminal: false });

  /** @param {object} obj */
  function send(obj) {
    process.stdout.write(JSON.stringify(obj) + "\n");
  }

  /**
   * @param {any} id
   * @param {object} result
   */
  function reply(id, result) {
    send({ jsonrpc: "2.0", id, result });
  }

  /**
   * @param {any} id
   * @param {number} code
   * @param {string} message
   */
  function replyError(id, code, message) {
    send({ jsonrpc: "2.0", id, error: { code, message } });
  }

  rl.on("line", async (line) => {
    /** @type {{ id:any, method:string, params:any }} */
    let msg;
    try { msg = JSON.parse(line); } catch { return; }

    const { id, method, params } = msg;

    if (method === "initialize") {
      reply(id, {
        protocolVersion: "2024-11-05",
        serverInfo: { name, version },
        capabilities: { tools: {} },
      });
      return;
    }

    if (method === "notifications/initialized") return;
    if (method === "ping") { reply(id, {}); return; }

    if (method === "tools/list") {
      reply(id, { tools });
      return;
    }

    if (method === "tools/call") {
      const handler = handlers[params?.name];
      if (!handler) { replyError(id, -32601, `Tool not found: ${params?.name}`); return; }
      try {
        const result = await handler(params?.arguments ?? {});
        reply(id, result);
      } catch (err) {
        reply(id, {
          content: [{ type: "text", text: JSON.stringify({ ok: false, error: /** @type {Error} */ (err).message }) }],
          isError: true,
        });
      }
      return;
    }

    if (id !== undefined) replyError(id, -32601, `Method not found: ${method}`);
  });

  return {
    /**
     * @param {ToolDefinition} definition
     * @param {ToolHandler} handler
     */
    tool(definition, handler) {
      tools.push(definition);
      handlers[definition.name] = handler;
    },
  };
}
