// @ts-check
/**
 * Cliente falso del SDK de Anthropic para la batería de conformidad: el proveedor lo recibe por
 * `clienteSdk` (conversar) y por `crearCliente` (complete). Mismos escenarios neutros que
 * `servidor-falso.js`. Respeta `signal`, como el SDK real.
 */

/**
 * @param {any[]} escenarios
 * @returns {{ cliente: any, peticiones: any[] }}
 */
export function clienteAnthropicFalso(escenarios) {
  const cola = [...escenarios];
  /** @type {any[]} */
  const peticiones = [];
  const cliente = {
    messages: {
      /** @param {any} params @param {{ signal?: AbortSignal }} [opciones] */
      async create(params, opciones = {}) {
        peticiones.push(JSON.parse(JSON.stringify(params)));
        const spec = cola.length > 1 ? cola.shift() : cola[0];
        const { signal } = opciones;
        if (signal?.aborted) throw Object.assign(new Error('abortada'), { name: 'AbortError' });
        if (spec.colgar) {
          await new Promise((_, rechazar) => signal?.addEventListener('abort', () => rechazar(Object.assign(new Error('abortada'), { name: 'AbortError' }))));
        }
        if (spec.http) throw Object.assign(new Error(`Anthropic error ${spec.http}: ${spec.mensaje ?? 'fallo del servidor'}`), { status: spec.http });
        const t = spec.tokens ?? { prompt: 12, completion: 5 };
        const content = [];
        for (const o of spec.opacos ?? []) content.push(o);
        if (spec.texto) content.push({ type: 'text', text: spec.texto });
        (spec.usos ?? []).forEach((u, i) => content.push({ type: 'tool_use', id: u.id ?? `toolu_${i}`, name: u.nombre, input: u.entrada ?? {} }));
        let stop = (spec.usos ?? []).length ? 'tool_use' : 'end_turn';
        if (spec.parada === 'longitud') stop = 'max_tokens';
        if (spec.parada === 'rechazo') stop = 'refusal';
        return { content, stop_reason: stop, usage: { input_tokens: t.prompt, output_tokens: t.completion } };
      },
    },
  };
  return { cliente, peticiones };
}
