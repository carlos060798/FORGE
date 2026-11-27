// @ts-check
/**
 * Servidores falsos locales para la batería de conformidad de proveedores
 * (spec 2026-10-13-proveedores-agnosticos, F1.1). Sin red ni claves: un `http.Server` en 127.0.0.1
 * que habla la API de chat de OpenAI (`/chat/completions`), la de Ollama (`/api/chat`) o `generateContent` de Gemini.
 *
 * Los escenarios se describen en forma neutra (no en la del proveedor) y el servidor los traduce:
 *   { texto?, usos?: [{ id?, nombre, entrada?, argumentosCrudos?, sinId? }], opacos?: [{ signature }], parada?: 'longitud'|'rechazo',
 *     tokens?: { prompt, completion, cacheados? }, crudo?: object, http?: number, mensaje?: string, colgar?: boolean }
 * Una lista de escenarios se sirve en orden; el último se repite.
 *
 * Las formas de la respuesta son las del spike `herramientas-por-proveedor.md`; lo que ese informe
 * marca «sin confirmar» (OpenAI) está así en el servidor falso y por eso solo prueba la traducción.
 */

import http from 'node:http';

/**
 * Respuesta de `generateContent` de Gemini (forma de ADR-27; sin probar con el servicio real). Una firma de
 * pensamiento (`opacos[0].signature`) va en la misma parte que la primera llamada, o en la del texto si no hay llamadas.
 * @param {any} spec
 */
function cuerpoGemini(spec) {
  const t = spec.tokens ?? { prompt: 12, completion: 5 };
  const usos = spec.usos ?? [];
  const firma = spec.opacos?.length ? String(spec.opacos[0].signature ?? 'firma') : null;
  /** @type {any[]} */
  const partes = [];
  if (spec.texto) partes.push({ text: spec.texto, ...(firma && !usos.length ? { thoughtSignature: firma } : {}) });
  usos.forEach((u, i) => partes.push({
    functionCall: { ...(u.sinId ? {} : { id: u.id ?? `call_${i}` }), name: u.nombre, args: u.entrada ?? {} },
    ...(firma && i === 0 ? { thoughtSignature: firma } : {}),
  }));
  let fin = 'STOP';
  if (spec.parada === 'longitud') fin = 'MAX_TOKENS';
  if (spec.parada === 'rechazo') fin = 'SAFETY';
  return {
    candidates: [{ content: { role: 'model', parts: partes }, finishReason: fin, index: 0 }],
    usageMetadata: {
      promptTokenCount: t.prompt, candidatesTokenCount: t.completion, totalTokenCount: t.prompt + t.completion,
      ...(t.cacheados !== undefined ? { cachedContentTokenCount: t.cacheados } : {}),
      ...(t.pensamiento !== undefined ? { thoughtsTokenCount: t.pensamiento } : {}),
    },
    modelVersion: 'falso',
  };
}

/** @param {any} spec @param {'openai'|'ollama'|'gemini'} formato */
function cuerpo(spec, formato) {
  if (formato === 'gemini') return cuerpoGemini(spec);
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
 * @param {'openai'|'ollama'|'gemini'} formato
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
        res.end(JSON.stringify(formato === 'openai' ? { error: { message: spec.mensaje ?? 'fallo del servidor', type: 'server_error' } } : formato === 'gemini' ? { error: { code: spec.http, message: spec.mensaje ?? 'fallo del servidor', status: 'INTERNAL' } } : { error: spec.mensaje ?? 'fallo del servidor' }));
        return;
      }
      res.end(JSON.stringify(spec.crudo ?? cuerpo(spec, formato)));   // `crudo`: una respuesta tal cual, para casos que la forma neutra no expresa
    });
  });
  return new Promise((resolver) => srv.listen(0, '127.0.0.1', () => resolver({
    url: `http://127.0.0.1:${/** @type {any} */ (srv.address()).port}${formato === 'openai' ? '/v1' : ''}`,
    peticiones,
    cerrar: () => new Promise((r) => { srv.closeAllConnections?.(); srv.close(() => r(undefined)); }),
  })));
}
