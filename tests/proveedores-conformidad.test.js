// @ts-check
/**
 * Batería de conformidad de proveedores (spec 2026-10-13-proveedores-agnosticos, HU-001).
 *
 * Una sola batería, parametrizada por proveedor, contra servidores falsos locales (sin red ni
 * claves): Anthropic con su cliente inyectable, OpenAI y Ollama con `tests/fixtures/proveedores/`,
 * y el proveedor de pruebas. Dos partes:
 *   - `complete`: texto, tokens, error del servidor, tiempo agotado, cancelación, respuesta vacía.
 *   - `conversar`: solo para quien declara `admiteHerramientas`. Un proveedor que lo declara y no
 *     la pasa hace fallar la batería (CA-001-04; lo demuestra la prueba del proveedor mentiroso).
 *
 * Para añadir un proveedor: ver docs/guia-anadir-proveedor.md.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { AnthropicProvider, OllamaProvider, OpenAIProvider, StubProvider } from '../core/llm-providers/index.js';
import { servidorFalso } from './fixtures/proveedores/servidor-falso.js';
import { clienteAnthropicFalso } from './fixtures/proveedores/cliente-anthropic-falso.js';

const CLAVE = 'sk-conformidad-0000';

/**
 * Lo que cada proveedor aporta a la batería.
 * @typedef {object} Montaje
 * @property {any} provider
 * @property {() => any[]} peticiones     lo recibido por el servidor falso, en la forma del proveedor
 * @property {() => Promise<void>} cerrar
 *
 * @typedef {object} Adaptador
 * @property {string} nombre
 * @property {boolean} declara            ¿se espera que declare `admiteHerramientas`?
 * @property {boolean} errorServidor      ¿puede el servidor falso devolver un error?
 * @property {boolean} cancelacion        ¿respeta `signal`?
 * @property {boolean} argumentosComoTexto  ¿los argumentos de herramienta llegan como texto JSON?
 * @property {boolean} [sinRechazo]   la API no tiene un motivo de rechazo (Ollama): el caso no aplica
 * @property {boolean} idsEnResultados    ¿el resultado de herramienta lleva el id de la llamada?
 * @property {'devuelve'|'ignora'|null} opaco
 * @property {(escenarios: any[]) => Promise<Montaje>} montar
 * @property {(peticion: any) => { id: string|null, contenido: string, esError: boolean }[]} resultadosEnviados
 */

/** @param {any} t */
const tokens = (t) => t ?? { prompt: 12, completion: 5 };

/** @type {Adaptador[]} */
const ADAPTADORES = [
  {
    nombre: 'anthropic', declara: true, errorServidor: true, cancelacion: true,
    argumentosComoTexto: false, idsEnResultados: true, opaco: 'devuelve',
    async montar(escenarios) {
      const { cliente, peticiones } = clienteAnthropicFalso(escenarios);
      const provider = new AnthropicProvider({ api_key: CLAVE, clienteSdk: cliente, crearCliente: () => cliente });
      return { provider, peticiones: () => peticiones, cerrar: async () => {} };
    },
    resultadosEnviados: (p) => p.messages.flatMap((m) => (Array.isArray(m.content) ? m.content : []))
      .filter((b) => b.type === 'tool_result')
      .map((b) => ({ id: b.tool_use_id, contenido: String(b.content), esError: b.is_error === true })),
  },
  {
    nombre: 'openai', declara: true, errorServidor: true, cancelacion: true,
    argumentosComoTexto: true, idsEnResultados: true, opaco: 'ignora',
    async montar(escenarios) {
      const s = await servidorFalso('openai', escenarios);
      const provider = new OpenAIProvider({ api_key: CLAVE, base_url: s.url });
      return { provider, peticiones: () => s.peticiones.map((p) => p.cuerpo), cerrar: s.cerrar };
    },
    resultadosEnviados: (p) => p.messages.filter((m) => m.role === 'tool')
      .map((m) => ({ id: m.tool_call_id, contenido: String(m.content), esError: String(m.content).startsWith('ERROR: ') })),
  },
  {
    nombre: 'ollama', declara: true, sinRechazo: true, errorServidor: true, cancelacion: true,
    argumentosComoTexto: false, idsEnResultados: false, opaco: 'ignora',
    async montar(escenarios) {
      const s = await servidorFalso('ollama', escenarios);
      const provider = new OllamaProvider({ base_url: s.url });
      return { provider, peticiones: () => s.peticiones.map((p) => p.cuerpo), cerrar: s.cerrar };
    },
    resultadosEnviados: (p) => p.messages.filter((m) => m.role === 'tool')
      .map((m) => ({ id: null, contenido: String(m.content), esError: String(m.content).startsWith('ERROR: ') })),
  },
  {
    nombre: 'stub', declara: true, errorServidor: false, cancelacion: false,
    argumentosComoTexto: false, idsEnResultados: true, opaco: 'devuelve',
    async montar(escenarios) {
      const cola = [...escenarios];
      const t = tokens(escenarios[0]?.tokens);
      let n = 0;
      const provider = new StubProvider({
        completar: [{ si: '.', salida: String(escenarios[0]?.texto ?? ''), inputTokens: t.prompt, outputTokens: t.completion }],
        guion: (/** @type {any} */ _p) => {
          const spec = cola.length > 1 ? cola.shift() : cola[0];
          const tk = tokens(spec.tokens);
          n++;
          return {
            contenido: [
              ...(spec.opacos ?? []).map((/** @type {any} */ crudo) => ({ tipo: 'opaco', crudo })),
              ...(spec.texto ? [{ tipo: 'texto', texto: spec.texto }] : []),
              ...(spec.usos ?? []).map((/** @type {any} */ u, /** @type {number} */ i) => ({ tipo: 'uso_herramienta', id: u.id ?? `stub_${n}_${i}`, nombre: u.nombre, entrada: u.entrada ?? {} })),
            ],
            stopReason: spec.parada === 'longitud' ? 'max_tokens' : spec.parada === 'rechazo' ? 'rechazo' : undefined,
            inputTokens: tk.prompt, outputTokens: tk.completion,
          };
        },
      });
      return { provider, peticiones: () => provider.conversaciones, cerrar: async () => {} };
    },
    resultadosEnviados: (p) => {
      const ultimo = p.mensajes[p.mensajes.length - 1];
      return (Array.isArray(ultimo.contenido) ? ultimo.contenido : []).filter((b) => b.tipo === 'resultado_herramienta')
        .map((b) => ({ id: b.idUso, contenido: String(b.contenido), esError: b.esError === true }));
    },
  },
];

const HERRAMIENTAS = [{ nombre: 'leer', descripcion: 'Lee un archivo', esquema: { type: 'object', properties: { ruta: { type: 'string' } }, required: ['ruta'] } }];
const BASE = { model: 'sonnet', systemPrompt: 'Eres un agente.', herramientas: HERRAMIENTAS, maxTokens: 256 };
const uso = (id, nombre = 'leer', entrada = { ruta: 'a.js' }) => ({ tipo: 'uso_herramienta', id, nombre, entrada });
const res = (idUso, contenido, esError = false) => ({ tipo: 'resultado_herramienta', idUso, contenido, esError });
const PETICION_COMPLETE = { model: 'sonnet', systemPrompt: 'Eres un agente.', userPrompt: 'hola', maxTokens: 256 };

/**
 * @param {Adaptador} a @param {any[]} escenarios
 * @param {(m: Montaje) => Promise<void>} fn
 */
async function con(a, escenarios, fn) {
  const m = await a.montar(escenarios);
  try { await fn(m); } finally { await m.cerrar(); }
}

/** Casos de `complete`. Cada uno: [nombre, ¿aplica?, función]. */
const CASOS_COMPLETE = /** @type {[string, (a: Adaptador) => boolean, (a: Adaptador) => Promise<void>][]} */ ([
  ['texto y recuento de tokens', () => true, (a) => con(a, [{ texto: 'hola mundo', tokens: { prompt: 12, completion: 5 } }], async (m) => {
    const r = await m.provider.complete(PETICION_COMPLETE);
    assert.equal(r.output, 'hola mundo');
    assert.equal(r.inputTokens, 12);
    assert.equal(r.outputTokens, 5);
  })],
  ['error del servidor: rechaza con un error, no devuelve texto', (a) => a.errorServidor, (a) => con(a, [{ http: 500, mensaje: 'caído' }], async (m) => {
    await assert.rejects(m.provider.complete(PETICION_COMPLETE), /500|caído/);
  })],
  ['tiempo agotado: una señal con límite aborta la llamada', (a) => a.cancelacion, (a) => con(a, [{ colgar: true }], async (m) => {
    await assert.rejects(m.provider.complete({ ...PETICION_COMPLETE, signal: AbortSignal.timeout(150) }));
  })],
  ['cancelación: abortar con signal corta una llamada en curso', (a) => a.cancelacion, (a) => con(a, [{ colgar: true }], async (m) => {
    const c = new AbortController();
    setTimeout(() => c.abort(), 50);
    await assert.rejects(m.provider.complete({ ...PETICION_COMPLETE, signal: c.signal }));
  })],
  ['cancelación previa: una señal ya abortada no llama', (a) => a.cancelacion, (a) => con(a, [{ texto: 'no debe llegar' }], async (m) => {
    const c = new AbortController();
    c.abort();
    await assert.rejects(m.provider.complete({ ...PETICION_COMPLETE, signal: c.signal }));
  })],
  ['respuesta vacía: texto vacío, sin excepción', () => true, (a) => con(a, [{ texto: '' }], async (m) => {
    const r = await m.provider.complete(PETICION_COMPLETE);
    assert.equal(r.output, '');
  })],
]);

/** Casos de `conversar`: solo para quien declara `admiteHerramientas`. */
const CASOS_CONVERSAR = /** @type {[string, (a: Adaptador) => boolean, (a: Adaptador) => Promise<void>][]} */ ([
  ['una herramienta: bloque uso_herramienta con id, nombre y entrada; parada «herramientas»', () => true, (a) => con(a, [
    { texto: 'Voy a leer.', usos: [{ id: 'u1', nombre: 'leer', entrada: { ruta: 'x.js' } }], tokens: { prompt: 40, completion: 9 } },
  ], async (m) => {
    const r = await m.provider.conversar({ ...BASE, mensajes: [{ rol: 'usuario', contenido: 'lee x.js' }] });
    assert.equal(r.stopReason, 'herramientas');
    const usos = r.contenido.filter((b) => b.tipo === 'uso_herramienta');
    assert.equal(usos.length, 1);
    assert.equal(usos[0].nombre, 'leer');
    assert.deepEqual(usos[0].entrada, { ruta: 'x.js' });
    assert.ok(typeof usos[0].id === 'string' && usos[0].id !== '');
    assert.ok(Number.isInteger(r.inputTokens) && Number.isInteger(r.outputTokens));
    assert.ok(r.contenido.some((b) => b.tipo === 'texto' && b.texto === 'Voy a leer.'));
    assert.ok(JSON.stringify(m.peticiones()[0]).includes('"leer"'), 'la herramienta viaja en la petición');
  })],
  ['varias herramientas en un turno, y sus resultados de vuelta en orden', () => true, (a) => con(a, [
    { usos: [{ id: 'u1', nombre: 'leer', entrada: { ruta: 'a' } }, { id: 'u2', nombre: 'leer', entrada: { ruta: 'b' } }] },
    { texto: 'Listo.' },
  ], async (m) => {
    const r1 = await m.provider.conversar({ ...BASE, mensajes: [{ rol: 'usuario', contenido: 'lee a y b' }] });
    const usos = r1.contenido.filter((b) => b.tipo === 'uso_herramienta');
    assert.equal(usos.length, 2);
    assert.notEqual(usos[0].id, usos[1].id);
    assert.deepEqual(usos.map((u) => u.entrada.ruta), ['a', 'b']);

    const r2 = await m.provider.conversar({
      ...BASE,
      mensajes: [
        { rol: 'usuario', contenido: 'lee a y b' },
        { rol: 'asistente', contenido: r1.contenido },
        { rol: 'usuario', contenido: [res(usos[0].id, 'contenido a'), res(usos[1].id, 'contenido b')] },
      ],
    });
    assert.equal(r2.stopReason, 'fin');
    const enviados = a.resultadosEnviados(m.peticiones()[1]);
    assert.deepEqual(enviados.map((e) => e.contenido), ['contenido a', 'contenido b']);
    if (a.idsEnResultados) assert.deepEqual(enviados.map((e) => e.id), usos.map((u) => u.id));
  })],
  ['argumentos mal formados: no rompen; llegan como entrada que la herramienta rechaza', (a) => a.argumentosComoTexto, (a) => con(a, [
    { usos: [{ id: 'u1', nombre: 'leer', argumentosCrudos: '{"ruta": "a.' }] },
    { texto: 'Corrijo.' },
  ], async (m) => {
    const r1 = await m.provider.conversar({ ...BASE, mensajes: [{ rol: 'usuario', contenido: 'lee' }] });
    const usos = r1.contenido.filter((b) => b.tipo === 'uso_herramienta');
    assert.equal(usos.length, 1, 'la llamada no se pierde: el modelo debe recibir su resultado con error');
    assert.equal(r1.stopReason, 'herramientas');
    assert.ok(typeof usos[0].entrada !== 'object' || usos[0].entrada === null || Array.isArray(usos[0].entrada), 'no es un objeto: el ejecutor lo devuelve como error de herramienta');
    // La conversación sigue: se devuelve el error y el modelo responde
    const r2 = await m.provider.conversar({
      ...BASE,
      mensajes: [
        { rol: 'usuario', contenido: 'lee' },
        { rol: 'asistente', contenido: r1.contenido },
        { rol: 'usuario', contenido: [res(usos[0].id, 'La entrada de "leer" debe ser un objeto.', true)] },
      ],
    });
    assert.equal(r2.stopReason, 'fin');
  })],
  ['resultado con error: el error llega al modelo marcado como tal', () => true, (a) => con(a, [{ texto: 'Entendido.' }], async (m) => {
    await m.provider.conversar({
      ...BASE,
      mensajes: [
        { rol: 'usuario', contenido: 'lee' },
        { rol: 'asistente', contenido: [uso('u1')] },
        { rol: 'usuario', contenido: [res('u1', 'no existe el archivo', true)] },
      ],
    });
    const enviados = a.resultadosEnviados(m.peticiones()[0]);
    assert.equal(enviados.length, 1);
    assert.equal(enviados[0].esError, true);
    assert.match(enviados[0].contenido, /no existe el archivo/);
    if (a.idsEnResultados) assert.equal(enviados[0].id, 'u1');
  })],
  ['corte por longitud: parada «max_tokens»', () => true, (a) => con(a, [{ texto: 'a medias', parada: 'longitud' }], async (m) => {
    const r = await m.provider.conversar({ ...BASE, mensajes: [{ rol: 'usuario', contenido: 'escribe mucho' }] });
    assert.equal(r.stopReason, 'max_tokens');
  })],
  ['rechazo: parada «rechazo»', (a) => !a.sinRechazo, (a) => con(a, [{ parada: 'rechazo', texto: 'No puedo ayudar con eso.' }], async (m) => {
    const r = await m.provider.conversar({ ...BASE, mensajes: [{ rol: 'usuario', contenido: 'haz algo prohibido' }] });
    assert.equal(r.stopReason, 'rechazo');
  })],
  ['bloque opaco: lo que el proveedor exige conservar se devuelve tal cual', (a) => a.opaco === 'devuelve', (a) => con(a, [
    { opacos: [{ type: 'thinking', thinking: 'pienso', signature: 'FIRMA_X' }], texto: 'Voy.', usos: [{ id: 'u1', nombre: 'leer', entrada: { ruta: 'a' } }] },
    { texto: 'Hecho.' },
  ], async (m) => {
    const r1 = await m.provider.conversar({ ...BASE, mensajes: [{ rol: 'usuario', contenido: 'lee' }] });
    assert.ok(r1.contenido.some((b) => b.tipo === 'opaco'), 'el bloque desconocido sale como opaco');
    const id = r1.contenido.find((b) => b.tipo === 'uso_herramienta').id;
    await m.provider.conversar({
      ...BASE,
      mensajes: [{ rol: 'usuario', contenido: 'lee' }, { rol: 'asistente', contenido: r1.contenido }, { rol: 'usuario', contenido: [res(id, 'ok')] }],
    });
    assert.ok(JSON.stringify(m.peticiones()[1]).includes('FIRMA_X'), 'el bloque opaco vuelve intacto');
  })],
  ['bloque opaco ajeno: un proveedor que no lo usa lo ignora sin romper ni enviarlo', (a) => a.opaco === 'ignora', (a) => con(a, [{ texto: 'Bien.' }], async (m) => {
    const r = await m.provider.conversar({
      ...BASE,
      mensajes: [
        { rol: 'usuario', contenido: 'lee' },
        { rol: 'asistente', contenido: [{ tipo: 'opaco', crudo: { marca: 'MARCA_OPACA' } }, uso('u1')] },
        { rol: 'usuario', contenido: [res('u1', 'ok')] },
      ],
    });
    assert.equal(r.stopReason, 'fin');
    assert.ok(!JSON.stringify(m.peticiones()[0]).includes('MARCA_OPACA'));
  })],
]);

/**
 * Ejecuta casos y devuelve los que fallan (para la prueba del proveedor mentiroso).
 * @param {typeof CASOS_CONVERSAR} casos @param {Adaptador} a
 */
async function ejecutar(casos, a) {
  /** @type {{ nombre: string, error: unknown }[]} */
  const fallos = [];
  for (const [nombre, aplica, fn] of casos) {
    if (!aplica(a)) continue;
    try { await fn(a); } catch (error) { fallos.push({ nombre, error }); }
  }
  return fallos;
}

for (const a of ADAPTADORES) {
  describe(`conformidad: ${a.nombre}`, () => {
    for (const [nombre, aplica, fn] of CASOS_COMPLETE) {
      test(`complete — ${nombre}`, { skip: !aplica(a) && 'no aplica a este proveedor' }, () => fn(a));
    }

    test('declara admiteHerramientas como se espera de él', async () => {
      const m = await a.montar([{ texto: 'x' }]);
      try { assert.equal(m.provider.admiteHerramientas, a.declara); } finally { await m.cerrar(); }
    });

    test('quien no declara herramientas rechaza conversar con un error claro', async (t) => {
      const m = await a.montar([{ texto: 'x' }]);
      try {
        if (m.provider.admiteHerramientas) return t.skip('declara herramientas: se prueban abajo');
        await assert.rejects(m.provider.conversar({ ...BASE, mensajes: [{ rol: 'usuario', contenido: 'x' }] }), /no admite conversaciones con herramientas/);
      } finally { await m.cerrar(); }
    });

    for (const [nombre, aplica, fn] of CASOS_CONVERSAR) {
      // Si el proveedor declara herramientas, no pasar un caso hace fallar la batería (CA-001-04).
      // `a.declara` es lo esperado: un proveedor que dejara de declarar no se saltaría la parte en silencio.
      test(`conversar — ${nombre}`, { skip: (!a.declara || !aplica(a)) && 'sin herramientas o no aplica' }, () => fn(a));
    }
  });
}

describe('la batería hace cumplir la declaración (CA-001-04)', () => {
  /** Un proveedor que presume de herramientas y no las traduce. */
  const mentiroso = /** @type {Adaptador} */ ({
    ...ADAPTADORES.find((x) => x.nombre === 'stub'),
    nombre: 'mentiroso',
    async montar() {
      const p = new (class extends StubProvider {
        async conversar() { return { contenido: [], stopReason: 'fin', inputTokens: 0, outputTokens: 0 }; }
      })({ guion: [] });
      return { provider: p, peticiones: () => [], cerrar: async () => {} };
    },
  });

  test('un proveedor honesto no tiene fallos y uno que declara herramientas sin cumplirlas, sí', async () => {
    const honesto = /** @type {Adaptador} */ (ADAPTADORES.find((x) => x.nombre === 'stub'));
    assert.deepEqual((await ejecutar(CASOS_CONVERSAR, honesto)).map((f) => f.nombre), []);

    const m = await mentiroso.montar([]);
    assert.equal(m.provider.admiteHerramientas, true, 'declara herramientas');
    const fallos = await ejecutar(CASOS_CONVERSAR, mentiroso);
    assert.ok(fallos.length >= 3, `la batería debe detectarlo (fallos: ${fallos.length})`);
  });
});
