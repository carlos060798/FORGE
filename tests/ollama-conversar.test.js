// @ts-check
/**
 * OllamaProvider.conversar (spec proveedores-agnosticos, F3, CA-003-01 y CA-003-02) contra el
 * servidor falso: forma de la petición, ids sintéticos deterministas y detección de un modelo sin herramientas.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OllamaProvider } from '../core/llm-providers/index.js';
import { servidorFalso } from './fixtures/proveedores/servidor-falso.js';

const HERR = [{ nombre: 'leer', descripcion: 'Lee', esquema: { type: 'object', properties: { ruta: { type: 'string' } } } }];
const BASE = { model: 'sonnet', systemPrompt: 'sys', herramientas: HERR, maxTokens: 64 };

test('CA-003-01: pide stream:false, manda tools y num_predict; arguments objeto; ids deterministas', async () => {
  const s = await servidorFalso('ollama', [{ usos: [{ nombre: 'leer', entrada: { ruta: 'a' } }, { nombre: 'leer', entrada: { ruta: 'b' } }] }]);
  try {
    const p = new OllamaProvider({ base_url: s.url });
    const msgs = [{ rol: 'usuario', contenido: 'lee' }];
    const r1 = await p.conversar({ ...BASE, mensajes: msgs });
    const r2 = await p.conversar({ ...BASE, mensajes: msgs });
    const cuerpo = s.peticiones[0].cuerpo;
    assert.equal(cuerpo.stream, false);
    assert.equal(cuerpo.options.num_predict, 64);
    assert.equal(cuerpo.tools[0].function.name, 'leer');
    assert.deepEqual(r1.contenido.map((b) => b.id), ['ollama-0-0', 'ollama-0-1']);
    assert.deepEqual(r1.contenido, r2.contenido, 'mismo historial, mismos ids');
    assert.equal(r1.stopReason, 'herramientas');
    // El resultado vuelve con el nombre de la herramienta (tool_name), mapeado desde el id sintético
    await p.conversar({ ...BASE, mensajes: [...msgs, { rol: 'asistente', contenido: r1.contenido }, { rol: 'usuario', contenido: [{ tipo: 'resultado_herramienta', idUso: 'ollama-0-1', contenido: 'ok', esError: false }] }] });
    const enviados = s.peticiones[2].cuerpo.messages;
    assert.equal(enviados.find((m) => m.role === 'tool').tool_name, 'leer');
    assert.deepEqual(enviados.find((m) => m.tool_calls).tool_calls[0].function.arguments, { ruta: 'a' });
  } finally { await s.cerrar(); }
});

test('CA-003-02: el primer error de «no admite herramientas» se recuerda y no se vuelve a llamar', async () => {
  const s = await servidorFalso('ollama', [{ http: 400, mensaje: 'registry.ollama.ai/library/gemma:2b does not support tools' }]);
  try {
    const p = new OllamaProvider({ base_url: s.url });
    assert.equal(p.admiteHerramientas, true);
    await assert.rejects(p.conversar({ ...BASE, mensajes: [{ rol: 'usuario', contenido: 'x' }] }), /no admite herramientas/);
    assert.equal(p.admiteHerramientas, false, 'recordado durante la sesión');
    const n = s.peticiones.length;
    await assert.rejects(p.conversar({ ...BASE, mensajes: [{ rol: 'usuario', contenido: 'x' }] }), /no admite herramientas/);
    assert.equal(s.peticiones.length, n, 'sin segunda llamada de red');
  } finally { await s.cerrar(); }
});

test('un error 500 no marca el modelo como sin herramientas', async () => {
  const s = await servidorFalso('ollama', [{ http: 500, mensaje: 'caído' }]);
  try {
    const p = new OllamaProvider({ base_url: s.url });
    await assert.rejects(p.conversar({ ...BASE, mensajes: [{ rol: 'usuario', contenido: 'x' }] }), /500/);
    assert.equal(p.admiteHerramientas, true);
  } finally { await s.cerrar(); }
});
