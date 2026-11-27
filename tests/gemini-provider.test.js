// @ts-check
/**
 * Proveedor Gemini (spec 2026-10-13-proveedores-agnosticos, HU-007; ADR-27). Lo común lo cubre la batería de
 * `proveedores-conformidad.test.js`; aquí va lo propio de Gemini: forma de la petición, ids por llamada,
 * firmas de pensamiento, nombres de herramienta, paradas, tokens y detección por credenciales.
 *
 * Todo contra un servidor falso local: ni red ni clave reales. La forma de la API sale de la documentación
 * oficial; NO se ha probado con la API real.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';

import { GeminiProvider, crearProvider, proveedorPorCredenciales, sanearConfigDelProyecto } from '../core/llm-providers/index.js';
import { servidorFalso } from './fixtures/proveedores/servidor-falso.js';

const CLAVE = 'AIza-centinela-0000';
const HERR = [{ nombre: 'leer', descripcion: 'Lee', esquema: { type: 'object', properties: { ruta: { type: 'string' } }, additionalProperties: false } }];

/**
 * @param {any[]} escenarios @param {(p: any, s: any) => Promise<void>} fn @param {object} [extra]
 */
async function con(escenarios, fn, extra = {}) {
  const s = await servidorFalso('gemini', escenarios);
  try { await fn(new GeminiProvider({ api_key: CLAVE, base_url: s.url, ...extra }), s); } finally { await s.cerrar(); }
}
const turno = (/** @type {GeminiProvider} */ p, /** @type {any[]} */ mensajes, herramientas = HERR) =>
  p.conversar({ model: 'medio', systemPrompt: 'Sistema.', mensajes, herramientas, maxTokens: 99 });
const partesEnviadas = (/** @type {any} */ cuerpo) => cuerpo.contents.flatMap((/** @type {any} */ c) => c.parts.map((/** @type {any} */ x) => ({ rol: c.role, ...x })));

describe('Gemini: la petición', () => {
  test('va a generateContent del modelo, con la clave en una cabecera y no en la URL', () => con([{ texto: 'hola' }], async (p, s) => {
    await p.complete({ model: 'alto', systemPrompt: 'Eres X.', userPrompt: 'hola', maxTokens: 77 });
    const r = s.peticiones[0];
    assert.match(r.url, /^\/v1beta\/models\/gemini-[\w.-]+:generateContent$/);
    assert.equal(r.headers['x-goog-api-key'], CLAVE);
    assert.ok(!String(r.url).includes(CLAVE));
    assert.deepEqual(r.cuerpo.systemInstruction, { parts: [{ text: 'Eres X.' }] });
    assert.deepEqual(r.cuerpo.contents, [{ role: 'user', parts: [{ text: 'hola' }] }]);
    assert.equal(r.cuerpo.generationConfig.maxOutputTokens, 77);
    assert.equal(r.cuerpo.tools, undefined, 'sin herramientas no se envía el campo');
  }));

  test('las herramientas van como functionDeclarations, sin additionalProperties', () => con([{ texto: 'ok' }], async (p, s) => {
    await turno(p, [{ rol: 'usuario', contenido: 'x' }]);
    const decl = s.peticiones[0].cuerpo.tools[0].functionDeclarations[0];
    assert.equal(decl.name, 'leer');
    assert.equal(decl.description, 'Lee');
    const esquema = decl.parametersJsonSchema ?? decl.parameters;
    assert.equal(esquema.properties.ruta.type, 'string');
    assert.ok(!JSON.stringify(esquema).includes('additionalProperties'));
  }));

  test('el error HTTP no deja la clave ni en el mensaje', () => con([{ http: 400, mensaje: `API key not valid: ${CLAVE}` }], async (p) => {
    await assert.rejects(p.complete({ model: 'medio', systemPrompt: 's', userPrompt: 'u' }), (e) => {
      const m = String(/** @type {Error} */ (e).message);
      return /400/.test(m) && !m.includes(CLAVE);
    });
  }));

  test('un error de red tampoco la deja', async () => {
    const p = new GeminiProvider({ api_key: CLAVE, fetch: async () => { throw new Error(`fallo con ${CLAVE}`); } });
    await assert.rejects(p.complete({ model: 'medio', systemPrompt: 's', userPrompt: 'u' }), (e) => !String(/** @type {Error} */ (e).message).includes(CLAVE));
  });

  test('sin clave ni cliente no declara herramientas y conversar lo dice', async () => {
    const p = new GeminiProvider({ api_key: '' });
    const antes = { g: process.env.GEMINI_API_KEY, o: process.env.GOOGLE_API_KEY };
    delete process.env.GEMINI_API_KEY; delete process.env.GOOGLE_API_KEY;
    try {
      const sin = new GeminiProvider({});
      assert.equal(sin.admiteHerramientas, false);
      await assert.rejects(sin.conversar({ model: 'medio', systemPrompt: 's', mensajes: [], herramientas: [] }), /no admite conversaciones con herramientas.*clave/s);
    } finally {
      if (antes.g !== undefined) process.env.GEMINI_API_KEY = antes.g;
      if (antes.o !== undefined) process.env.GOOGLE_API_KEY = antes.o;
    }
    assert.equal(p.nombre, 'gemini');
  });
});

describe('Gemini: ids por llamada y resultados', () => {
  test('sin id en la API: ids propios, únicos, y el resultado vuelve con el nombre y sin id inventado', () => con([
    { usos: [{ nombre: 'leer', entrada: { ruta: 'a' }, sinId: true }, { nombre: 'leer', entrada: { ruta: 'b' }, sinId: true }] },
    { texto: 'Listo.' },
  ], async (p, s) => {
    const r1 = await turno(p, [{ rol: 'usuario', contenido: 'lee' }]);
    const usos = r1.contenido.filter((b) => b.tipo === 'uso_herramienta');
    assert.equal(usos.length, 2);
    assert.ok(usos.every((u) => typeof u.id === 'string' && u.id !== ''));
    assert.notEqual(usos[0].id, usos[1].id);
    await turno(p, [
      { rol: 'usuario', contenido: 'lee' }, { rol: 'asistente', contenido: r1.contenido },
      { rol: 'usuario', contenido: [{ tipo: 'resultado_herramienta', idUso: usos[1].id, contenido: 'B', esError: false }, { tipo: 'resultado_herramienta', idUso: usos[0].id, contenido: 'A', esError: false }] },
    ]);
    const resp = partesEnviadas(s.peticiones[1].cuerpo).filter((x) => x.functionResponse).map((x) => x.functionResponse);
    assert.deepEqual(resp.map((x) => x.name), ['leer', 'leer']);
    assert.deepEqual(resp.map((x) => x.response.output), ['B', 'A']);
    assert.ok(resp.every((x) => x.id === undefined), 'un id que la API no dio no se envía');
    const llamadas = partesEnviadas(s.peticiones[1].cuerpo).filter((x) => x.functionCall);
    assert.ok(llamadas.every((x) => x.functionCall.id === undefined));
    assert.deepEqual(llamadas.map((x) => x.functionCall.args.ruta), ['a', 'b']);
  }));

  test('el resultado con error va en la clave «error» de la respuesta de la función', () => con([{ texto: 'ok' }], async (p, s) => {
    await turno(p, [
      { rol: 'usuario', contenido: 'x' },
      { rol: 'asistente', contenido: [{ tipo: 'uso_herramienta', id: 'u1', nombre: 'leer', entrada: {} }] },
      { rol: 'usuario', contenido: [{ tipo: 'resultado_herramienta', idUso: 'u1', contenido: 'falló', esError: true }] },
    ]);
    const fr = partesEnviadas(s.peticiones[0].cuerpo).find((x) => x.functionResponse).functionResponse;
    assert.deepEqual(fr.response, { error: 'falló' });
    assert.equal(fr.id, 'u1', 'un id que sí vino de la API vuelve');
  }));
});

describe('Gemini: firma de pensamiento (thoughtSignature)', () => {
  const FIRMA = 'FIRMA_OPACA_1';

  test('con llamadas paralelas la firma queda en la primera parte y se reenvía agrupada y en su sitio', () => con([
    { texto: 'Voy.', opacos: [{ signature: FIRMA }], usos: [{ id: 'a', nombre: 'leer', entrada: { ruta: '1' } }, { id: 'b', nombre: 'leer', entrada: { ruta: '2' } }] },
    { texto: 'Hecho.' },
  ], async (p, s) => {
    const r1 = await turno(p, [{ rol: 'usuario', contenido: 'lee' }]);
    assert.ok(r1.contenido.some((b) => b.tipo === 'opaco'));
    await turno(p, [
      { rol: 'usuario', contenido: 'lee' }, { rol: 'asistente', contenido: r1.contenido },
      { rol: 'usuario', contenido: [{ tipo: 'resultado_herramienta', idUso: 'a', contenido: '1', esError: false }, { tipo: 'resultado_herramienta', idUso: 'b', contenido: '2', esError: false }] },
    ]);
    const modelo = s.peticiones[1].cuerpo.contents.find((/** @type {any} */ c) => c.role === 'model');
    const conFirma = modelo.parts.filter((/** @type {any} */ x) => x.thoughtSignature);
    assert.equal(conFirma.length, 1, 'una sola firma, como la recibió');
    assert.ok(conFirma[0].functionCall, 'va en la parte de la primera llamada');
    assert.equal(conFirma[0].thoughtSignature, FIRMA);
    assert.equal(modelo.parts.filter((/** @type {any} */ x) => x.functionCall).length, 2, 'las dos llamadas, en el mismo mensaje');
    const usuario = s.peticiones[1].cuerpo.contents.at(-1);
    assert.equal(usuario.role, 'user');
    assert.equal(usuario.parts.filter((/** @type {any} */ x) => x.functionResponse).length, 2, 'las dos respuestas, juntas');
  }));

  test('sin firma no se inventa ninguna', () => con([{ usos: [{ id: 'a', nombre: 'leer' }] }, { texto: 'ok' }], async (p, s) => {
    const r1 = await turno(p, [{ rol: 'usuario', contenido: 'lee' }]);
    assert.ok(!r1.contenido.some((b) => b.tipo === 'opaco'));
    await turno(p, [{ rol: 'usuario', contenido: 'lee' }, { rol: 'asistente', contenido: r1.contenido }, { rol: 'usuario', contenido: [{ tipo: 'resultado_herramienta', idUso: 'a', contenido: 'x', esError: false }] }]);
    assert.ok(!JSON.stringify(s.peticiones[1].cuerpo).includes('thoughtSignature'));
  }));

  test('un bloque opaco de otro proveedor no se envía a Gemini', () => con([{ texto: 'ok' }], async (p, s) => {
    await turno(p, [{ rol: 'usuario', contenido: 'x' }, { rol: 'asistente', contenido: [{ tipo: 'opaco', crudo: { type: 'thinking', signature: 'AJENA' } }, { tipo: 'texto', texto: 'hola' }] }, { rol: 'usuario', contenido: 'sigue' }]);
    assert.ok(!JSON.stringify(s.peticiones[0].cuerpo).includes('AJENA'));
  }));

  test('las partes de resumen de pensamiento (thought: true) no son texto de la respuesta', () => con([{ crudo: {
    candidates: [{ content: { role: 'model', parts: [{ text: 'resumen interno', thought: true }, { text: 'respuesta' }] }, finishReason: 'STOP' }],
    usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 },
  } }], async (p) => {
    const r = await p.complete({ model: 'medio', systemPrompt: 's', userPrompt: 'u' });
    assert.equal(r.output, 'respuesta');
  }));
});

describe('Gemini: nombres de herramienta', () => {
  test('un nombre con punto se adapta al enviarlo y se restituye al recibirlo', () => con([
    { usos: [{ id: 'a', nombre: 'fs_leer', entrada: {} }] },
    { texto: 'ok' },
  ], async (p, s) => {
    const herr = [{ nombre: 'fs.leer', descripcion: 'd', esquema: { type: 'object' } }];
    const r1 = await turno(p, [{ rol: 'usuario', contenido: 'x' }], herr);
    assert.equal(s.peticiones[0].cuerpo.tools[0].functionDeclarations[0].name, 'fs_leer');
    const uso = r1.contenido.find((b) => b.tipo === 'uso_herramienta');
    assert.equal(uso.nombre, 'fs.leer', 'el motor ve el nombre original');
    await turno(p, [{ rol: 'usuario', contenido: 'x' }, { rol: 'asistente', contenido: r1.contenido }, { rol: 'usuario', contenido: [{ tipo: 'resultado_herramienta', idUso: 'a', contenido: 'r', esError: false }] }], herr);
    const partes = partesEnviadas(s.peticiones[1].cuerpo);
    assert.equal(partes.find((x) => x.functionCall).functionCall.name, 'fs_leer');
    assert.equal(partes.find((x) => x.functionResponse).functionResponse.name, 'fs_leer');
  }));

  test('nombres que chocan al adaptarlos no se confunden; los caracteres raros y el largo se corrigen', () => con([
    { usos: [{ id: 'a', nombre: 'a_b', entrada: {} }, { id: 'b', nombre: 'a_b_2', entrada: {} }] },
  ], async (p, s) => {
    const largo = 'x'.repeat(100);
    const herr = ['a.b', 'a_b', '9raro nombre!', largo].map((nombre) => ({ nombre, descripcion: 'd', esquema: { type: 'object' } }));
    const r = await turno(p, [{ rol: 'usuario', contenido: 'x' }], herr);
    const nombres = s.peticiones[0].cuerpo.tools[0].functionDeclarations.map((/** @type {any} */ d) => d.name);
    assert.equal(new Set(nombres).size, 4, 'todos distintos');
    assert.ok(nombres.every((/** @type {string} */ n) => /^[A-Za-z_][A-Za-z0-9_-]{0,62}$/.test(n)), nombres.join(','));
    const usos = r.contenido.filter((b) => b.tipo === 'uso_herramienta').map((b) => b.nombre);
    assert.deepEqual(usos.sort(), ['a.b', 'a_b'].sort(), 'cada nombre devuelto vuelve a su original');
  }));
});

describe('Gemini: paradas, tokens y bloqueos', () => {
  test('tokens: la caché se separa de la entrada y el razonamiento cuenta como salida', () => con([
    { texto: 'x', tokens: { prompt: 100, completion: 10, cacheados: 30, pensamiento: 7 } },
  ], async (p) => {
    const r = await turno(p, [{ rol: 'usuario', contenido: 'x' }]);
    assert.equal(r.inputTokens, 70);
    assert.equal(r.cacheReadTokens, 30);
    assert.equal(r.cacheCreationTokens, 0);
    assert.equal(r.outputTokens, 17);
    const c = await p.complete({ model: 'medio', systemPrompt: 's', userPrompt: 'u' });
    assert.equal(c.inputTokens, 70);
    assert.equal(c.outputTokens, 17);
    assert.equal(c.cacheReadTokens, 30);
  }));

  test('un prompt bloqueado (sin candidatos) es «rechazo» en conversar y un error en complete', () => con([{ crudo: {
    promptFeedback: { blockReason: 'PROHIBITED_CONTENT' }, usageMetadata: { promptTokenCount: 3 },
  } }], async (p) => {
    const r = await turno(p, [{ rol: 'usuario', contenido: 'x' }]);
    assert.equal(r.stopReason, 'rechazo');
    await assert.rejects(p.complete({ model: 'medio', systemPrompt: 's', userPrompt: 'u' }), /PROHIBITED_CONTENT/);
  }));

  test('un motivo de parada desconocido es «otro»; con llamadas sigue siendo «herramientas»', () => con([
    { crudo: { candidates: [{ content: { role: 'model', parts: [{ text: 'x' }] }, finishReason: 'ALGO_NUEVO' }], usageMetadata: {} } },
    { crudo: { candidates: [{ content: { role: 'model', parts: [{ functionCall: { name: 'leer', args: {} } }] }, finishReason: 'FINISH_REASON_UNSPECIFIED' }], usageMetadata: {} } },
  ], async (p) => {
    assert.equal((await turno(p, [{ rol: 'usuario', contenido: 'x' }])).stopReason, 'otro');
    assert.equal((await turno(p, [{ rol: 'usuario', contenido: 'x' }])).stopReason, 'herramientas');
  }));

  test('una respuesta con MAX_TOKENS y una llamada trunca: no se ejecuta (parada «max_tokens»)', () => con([
    { crudo: { candidates: [{ content: { role: 'model', parts: [{ functionCall: { name: 'leer', args: { ruta: 'a' } } }] }, finishReason: 'MAX_TOKENS' }], usageMetadata: {} } },
  ], async (p) => {
    assert.equal((await turno(p, [{ rol: 'usuario', contenido: 'x' }])).stopReason, 'max_tokens');
  }));
});

describe('Gemini: nombres, modelos y detección', () => {
  test('gemini y google se reconocen y crean un GeminiProvider', () => {
    const vars = ['FORGE_LLM_PROVIDER', 'FRAGUA_LLM_PROVIDER'];
    const antes = vars.map((v) => process.env[v]);
    vars.forEach((v) => delete process.env[v]);
    try {
      for (const nombre of ['gemini', 'google']) {
        const p = crearProvider({ cwd: tmpdir(), config: { provider: nombre, api_key: 'k' } });
        assert.equal(p.nombre, 'gemini', nombre);
        assert.ok(p instanceof GeminiProvider);
      }
    } finally { vars.forEach((v, i) => { if (antes[i] === undefined) delete process.env[v]; else process.env[v] = antes[i]; }); }
  });

  test('los niveles resuelven a un modelo de Gemini, en los dos juegos de nombres, y `modelos:` manda', () => {
    const p = new GeminiProvider({ api_key: 'k' });
    const por = (/** @type {string} */ n) => p.resolveModelId(n);
    for (const n of ['alto', 'medio', 'economico', 'opus', 'sonnet', 'haiku']) assert.match(por(n), /^gemini-/, n);
    assert.equal(por('alto'), por('opus'));
    assert.equal(por('medio'), por('sonnet'));
    assert.equal(por('economico'), por('haiku'));
    assert.equal(por('gemini-2.5-flash'), 'gemini-2.5-flash', 'un identificador directo no se toca');
    assert.equal(new GeminiProvider({ api_key: 'k', modelos: { medio: 'gemini-propio' } }).resolveModelId('medio'), 'gemini-propio');
  });

  test('los modelos por defecto tienen precio en la tabla incluida', async () => {
    const { TABLA } = await import('../core/precios.js');
    const p = new GeminiProvider({ api_key: 'k' });
    for (const n of ['alto', 'medio', 'economico']) assert.ok(TABLA.gemini?.[p.resolveModelId(n)], `sin precio: ${p.resolveModelId(n)}`);
  });

  test('detección por credenciales: Gemini va al final y no cambia ninguna elección anterior', () => {
    assert.equal(proveedorPorCredenciales({ GEMINI_API_KEY: 'k' }), 'gemini');
    assert.equal(proveedorPorCredenciales({ GOOGLE_API_KEY: 'k' }), 'gemini');
    assert.equal(proveedorPorCredenciales({ GEMINI_API_KEY: 'k', ANTHROPIC_API_KEY: 'a' }), 'anthropic');
    assert.equal(proveedorPorCredenciales({ GEMINI_API_KEY: 'k', OPENAI_API_KEY: 'o' }), 'openai');
    assert.equal(proveedorPorCredenciales({ GEMINI_API_KEY: 'k', OLLAMA_BASE_URL: 'http://127.0.0.1:11434' }), 'ollama');
    assert.equal(proveedorPorCredenciales({}), null);
  });

  test('la clave se lee de GEMINI_API_KEY y, si no, de GOOGLE_API_KEY', () => {
    const antes = { g: process.env.GEMINI_API_KEY, o: process.env.GOOGLE_API_KEY };
    try {
      delete process.env.GEMINI_API_KEY; process.env.GOOGLE_API_KEY = 'de-google';
      assert.equal(new GeminiProvider({}).apiKey, 'de-google');
      process.env.GEMINI_API_KEY = 'de-gemini';
      assert.equal(new GeminiProvider({}).apiKey, 'de-gemini');
    } finally {
      for (const [v, k] of /** @type {[string, string|undefined][]} */ ([['GEMINI_API_KEY', antes.g], ['GOOGLE_API_KEY', antes.o]])) { if (k === undefined) delete process.env[v]; else process.env[v] = k; }
    }
  });
});

describe('Gemini: el proyecto no dirige la clave a otro servidor', () => {
  test('la dirección del proyecto se ignora si el usuario fijó GEMINI_BASE_URL, y el aviso nombra esa variable', () => {
    const avisos = /** @type {string[]} */ ([]);
    const limpia = sanearConfigDelProyecto({ provider: 'gemini', base_url: 'https://otro.example.com' }, { GEMINI_BASE_URL: 'https://mio.example.com' }, (m) => avisos.push(m));
    assert.equal(limpia.base_url, undefined);
    assert.match(avisos.join(' '), /GEMINI_BASE_URL/);
  });
  test('una dirección remota no permitida del proyecto se ignora; una clave en el archivo también', () => {
    const avisos = /** @type {string[]} */ ([]);
    const limpia = sanearConfigDelProyecto({ provider: 'gemini', base_url: 'https://otro.example.com', api_key: 'AIza-robada' }, {}, (m) => avisos.push(m));
    assert.equal(limpia.base_url, undefined);
    assert.equal(limpia.api_key, undefined);
    assert.match(avisos.join(' '), /GEMINI_API_KEY/);
  });
});
