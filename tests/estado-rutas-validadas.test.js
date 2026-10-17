// @ts-check
/**
 * Defensa en profundidad de H-1 (revisión independiente): `leerPruebas` (nodos.js) y `textoDeArchivos`
 * (pruebas-confiables.js) leían del disco las rutas guardadas en el estado SIN validarlas. Un estado con
 * `../../.ssh/id_rsa` (o un enlace) habría llevado un archivo ajeno al prompt. El estado ya va sellado,
 * pero una ruta corrupta o un enlace creado después tampoco deben poder leer fuera del proyecto.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { leerArchivosDeEstado } from '../core/ciclo/protocolo-archivos.js';

const SECRETO = 'CONTENIDO-SECRETO-QUE-NO-DEBE-LLEGAR-AL-PROMPT-7f3a';

function escenario() {
  const base = mkdtempSync(join(tmpdir(), 'forge-rutas-'));
  const cwd = join(base, 'proyecto');
  const fuera = join(base, 'fuera');
  mkdirSync(cwd); mkdirSync(fuera);
  writeFileSync(join(fuera, 'id_rsa'), SECRETO);
  writeFileSync(join(cwd, 'bueno.test.js'), 'export const ok = 1;\n');
  return { cwd, fuera };
}

describe('leerArchivosDeEstado', () => {
  test('lee un archivo del proyecto', () => {
    const { cwd } = escenario();
    const r = leerArchivosDeEstado(cwd, [{ ruta: 'bueno.test.js' }]);
    assert.equal(r.length, 1);
    assert.equal(r[0].contenido, 'export const ok = 1;\n');
  });

  test('ATAQUE: una ruta con .. que sale del proyecto no lee nada', () => {
    const { cwd } = escenario();
    const r = leerArchivosDeEstado(cwd, [{ ruta: '../fuera/id_rsa' }]);
    assert.ok(!JSON.stringify(r).includes(SECRETO));
    assert.equal(r[0].contenido, null);
    assert.ok(r[0].rechazo);
  });

  test('ATAQUE: ruta absoluta, UNC y nombres no portables no leen nada', () => {
    const { cwd, fuera } = escenario();
    for (const ruta of [join(fuera, 'id_rsa'), '\\\\servidor\\x\\id_rsa', 'C:\\Windows\\win.ini', 'a/../../fuera/id_rsa']) {
      const r = leerArchivosDeEstado(cwd, [{ ruta }]);
      assert.ok(!JSON.stringify(r).includes(SECRETO), ruta);
      assert.equal(r[0].contenido, null, ruta);
    }
  });

  test('ATAQUE: un enlace dentro del proyecto hacia fuera no se sigue', (t) => {
    const { cwd, fuera } = escenario();
    try { symlinkSync(fuera, join(cwd, 'enlace'), 'junction'); } catch { t.skip('no se pueden crear enlaces'); return; }
    const r = leerArchivosDeEstado(cwd, [{ ruta: 'enlace/id_rsa' }]);
    assert.ok(!JSON.stringify(r).includes(SECRETO));
    assert.equal(r[0].contenido, null);
  });

  test('un archivo que no existe se indica sin error', () => {
    const { cwd } = escenario();
    const r = leerArchivosDeEstado(cwd, [{ ruta: 'no-existe.test.js' }]);
    assert.equal(r[0].contenido, null);
    assert.equal(r[0].rechazo, undefined);
  });
});
