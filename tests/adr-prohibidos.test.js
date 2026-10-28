/**
 * adr-prohibidos.test.js — los patrones que prohíbe un ADR aceptado se hacen cumplir en el motor, con cualquier modelo
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { aplicarArchivos } from '../core/ciclo/protocolo-archivos.js';

function proyecto(adr) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adr-'));
  fs.mkdirSync(path.join(dir, '.sdd', 'arquitectura'), { recursive: true });
  if (adr !== null) fs.writeFileSync(path.join(dir, '.sdd', 'arquitectura', 'ADR-01-sin-moment.md'), adr);
  return dir;
}
const ACEPTADO = '# ADR-01\n\n> Estado: aceptada\n\n## Contexto\nevitar `fechas-viejas` en el texto libre no bloquea\n\n## Patrones prohibidos\n\n- `moment(`\n- `require("request")`\n\n## Consecuencias\nx\n';
const escribir = (dir, ruta, contenido) => aplicarArchivos(dir, [{ ruta, contenido }], { rol: 'coder', politicaDestinos: [] });

describe('ADR aceptado: patrones prohibidos', () => {
  test('escribir un patrón prohibido se rechaza con motivo adr_prohibido y no toca el disco', () => {
    const dir = proyecto(ACEPTADO);
    try {
      const r = escribir(dir, 'src/a.js', 'const f = MOMENT(new Date());\n');
      assert.equal(r.rechazados[0]?.motivo, 'adr_prohibido');
      assert.equal(r.rechazados[0]?.regla, 'moment(');
      assert.equal(fs.existsSync(path.join(dir, 'src', 'a.js')), false);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
  test('un contenido limpio se escribe', () => {
    const dir = proyecto(ACEPTADO);
    try {
      assert.equal(escribir(dir, 'src/a.js', 'const f = new Date();\n').escritos.length, 1);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
  test('el texto libre del ADR («evitar X») no bloquea nada', () => {
    const dir = proyecto(ACEPTADO);
    try {
      assert.equal(escribir(dir, 'src/a.js', 'const fechas-viejas = 1;\n').escritos.length, 1);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
  test('un ADR que no está aceptado no se aplica', () => {
    const dir = proyecto(ACEPTADO.replace('aceptada', 'propuesta'));
    try {
      assert.equal(escribir(dir, 'src/a.js', 'moment(1)\n').escritos.length, 1);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
  test('los artefactos de .sdd/ pueden nombrar el patrón', () => {
    const dir = proyecto(ACEPTADO);
    try {
      // el coder puede no tener permiso para .sdd/ (otro motivo); lo que importa es que no sea el del ADR
      assert.notEqual(escribir(dir, '.sdd/notas.md', 'no usar moment( nunca\n').rechazados[0]?.motivo, 'adr_prohibido');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
  test('sin carpeta de arquitectura no cambia nada', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adr-'));
    try {
      assert.equal(escribir(dir, 'src/a.js', 'moment(1)\n').escritos.length, 1);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});
