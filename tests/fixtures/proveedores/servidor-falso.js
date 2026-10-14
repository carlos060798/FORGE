// @ts-check
/**
 * Servidores falsos locales para la batería de conformidad de proveedores
 * (spec 2026-10-13-proveedores-agnosticos, F1.1). Sin red ni claves: un `http.Server` en 127.0.0.1
 * que habla la API de chat de OpenAI (`/chat/completions`) o la de Ollama (`/api/chat`).
 *
 * Los escenarios se describen en forma neutra (no en la del proveedor) y el servidor los traduce:
 *   { texto?, usos?: [{ id?, nombre, entrada?, argumentosCrudos? }], parada?: 'longitud'|'rechazo',
 *     tokens?: { prompt, completion, cacheados? }, http?: number, mensaje?: string, colgar?: boolean }
 * Una lista de escenarios se sirve en orden; el último se repite.
 *
 * Las formas de la respuesta son las del spike `herramientas-por-proveedor.md`; lo que ese informe
 * marca «sin confirmar» (OpenAI) está así en el servidor falso y por eso solo prueba la traducción.
 */

import http from 'node:http';

/** @param {any} spec @param {'openai'|'ollama'} formato */
function cuerpo(spec, formato) {
  const t = spec.tokens ?? { prompt: 12, completion: 5 };
  const usos = spec.usos ?? [];
  if (formato === 'openai') {
    const mensaje = /** @type {any} */ ({ role: 'assistant', content: spec.texto ?? (usos.length ? null : '') });
    if (usos.length) {
      mensaje.tool_calls = usos.map((u, i) => ({
        id: u.id ?? `call_${i}`, type: 'function',
        function: { name: u.nombre, arguments: u.argumentosCrudos ?? JSON.stringify(u.entrada ?? {}) },
      }));
    }
    let fin = usos.length ? 'tool_calls' : 'stop';
    if (spec.parada === 'longitud') fin = 'length';
    if (spec.parada === 'rechazo') { mensaje.refusal = spec.texto ?? 'No puedo ayudar con eso.'; mensaje.content = null; fin = 'stop'; }
    return {
      id: 'chatcmpl-falso', object: 'chat.completion',
      choices: [{ index: 0, message: mensaje, finish_reason: fin }],
      usage: {
        prompt_tokens: t.prompt, completion_tokens: t.completion,
        ...(t.cacheados !== undefined ? { prompt_tokens_details: { cached_tokens: t.cacheados } } : {}),
      },
    };
  }
  const mensaje = /** @type {any} */ ({ role: 'assistant', content: spec.texto ?? '' });
  if (usos.length) mensaje.tool_calls = usos.map((u) => ({ function: { name: u.nombre, arguments: u.entrada ?? {} } }));
  return {
    model: 'falso', message: mensaje, done: true,
    done_reason: spec.parada === 'longitud' ? 'length' : 'stop',
    prompt_eval_count: t.prompt, eval_count: t.completion,
  };
}

/**
 * @param {'openai'|'ollama'} formato
 * @param {any[]} escenarios
 * @returns {Promise<{ url: string, peticiones: { url?: string, headers: http.IncomingHttpHeaders, cuerpo: any }[], cerrar: () => Promise<void> }>}
 */
export function servidorFalso(formato, escenarios) {
  const cola = [...escenarios];
  /** @type {{ url?: string, headers: http.IncomingHttpHeaders, cuerpo: any }[]} */
  const peticiones = [];
  const srv = http.createServer((req, res) => {
    let texto = '';
    req.on('data', (d) => { texto += d; });
    req.on('end', () => {
      let json = null;
      try { json = JSON.parse(texto); } catch { /* cuerpo no JSON */ }
      peticiones.push({ url: req.url, headers: req.headers, cuerpo: json });
      const spec = cola.length > 1 ? cola.shift() : cola[0];
      if (spec.colgar) return;   // no responde: la prueba aborta con su `signal`
      res.setHeader('content-type', 'application/json');
      if (spec.http) {
        res.statusCode = spec.http;
        res.end(JSON.stringify(formato === 'openai' ? { error: { message: spec.mensaje ?? 'fallo del servidor', type: 'server_error' } } : { error: spec.mensaje ?? 'fallo del servidor' }));
        return;
      }
      res.end(JSON.stringify(cuerpo(spec, formato)));
    });
  });
  return new Promise((resolver) => srv.listen(0, '127.0.0.1', () => resolver({
    url: `http://127.0.0.1:${/** @type {any} */ (srv.address()).port}${formato === 'openai' ? '/v1' : ''}`,
    peticiones,
    cerrar: () => new Promise((r) => { srv.closeAllConnections?.(); srv.close(() => r(undefined)); }),
  })));
}
