// CA-001-01 CA-001-02 CA-002-01 CA-002-02 CA-003-01 CA-003-02 CA-004-01 (ver la spec y su verificacion.md)
// Recuento visible de las pruebas de enlaces que esta plataforma no puede ejecutar (spec 2026-11-10-enlaces-verificados-en-windows).
// Una prueba de seguridad que se salta en silencio deja de defender nada sin que nadie lo sepa: aquí se cuenta,
// se imprime y se impide volver a saltarlas con un `t.skip` suelto.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { crearEnlace } from "./helpers-enlaces.js";

const AQUI = dirname(fileURLToPath(import.meta.url));
const YO = "enlaces-no-verificados.test.js";
const archivos = readdirSync(AQUI).filter((n) => n.endsWith(".test.js") && n !== YO);

/** @returns {Array<{ archivo: string, linea: number, motivo: string }>} */
function llamadas() {
  const r = [];
  for (const archivo of archivos) {
    readFileSync(join(AQUI, archivo), "utf8").split("\n").forEach((texto, i) => {
      const m = /noVerificado\(t, "([^"]+)"\)/.exec(texto);
      if (m) r.push({ archivo, linea: i + 1, motivo: m[1] });
    });
  }
  return r;
}

/** Qué tipos de enlace deja crear esta plataforma, probados de verdad en un directorio temporal. */
function capacidades() {
  const base = mkdtempSync(join(tmpdir(), "fragua-enl-"));
  try {
    mkdirSync(join(base, "d"));
    writeFileSync(join(base, "a.txt"), "x");
    return {
      dir: crearEnlace(join(base, "d"), join(base, "ld"), "dir"),
      archivo: crearEnlace(join(base, "a.txt"), join(base, "la.txt"), "archivo"),
      duro: crearEnlace(join(base, "a.txt"), join(base, "lh.txt"), "archivo-o-duro"),
    };
  } finally { rmSync(base, { recursive: true, force: true }); }
}

describe("enlaces: lo que esta plataforma no puede verificar", () => {
  test("ninguna prueba se salta por enlaces con un t.skip suelto: usa noVerificado() y queda contada", () => {
    const sueltos = [];
    for (const archivo of archivos) {
      readFileSync(join(AQUI, archivo), "utf8").split("\n").forEach((texto, i) => {
        if (/\bt\.skip\(/.test(texto) && /enlace|uni[oó]n|symlink|EPERM/i.test(texto)) sueltos.push(`${archivo}:${i + 1}`);
      });
    }
    assert.deepEqual(sueltos, [], "usa noVerificado(t, motivo) de tests/helpers-enlaces.js");
  });

  test("cada omisión declarada trae un motivo concreto", () => {
    for (const c of llamadas()) assert.ok(c.motivo.length >= 20, `${c.archivo}:${c.linea}`);
  });

  test("recuento: qué enlaces puede crear este equipo y cuántas pruebas dependen de lo que no puede", (t) => {
    const cap = capacidades();
    const estado = (x) => (x.creado ? `sí (${x.tipo})` : "NO");
    const todas = llamadas();
    // Las omisiones se agrupan por lo que hace falta para ejecutarlas.
    const requierenSymlinkArchivo = todas.filter((c) => /symlink de archivo/.test(c.motivo));
    const requierenDir = todas.filter((c) => !/symlink de archivo/.test(c.motivo) && /enlace simbólico ni unión/.test(c.motivo));
    const requierenDuro = todas.filter((c) => /enlace duro/.test(c.motivo) && !/symlink de archivo/.test(c.motivo));
    t.diagnostic(`enlaces en este equipo: directorio=${estado(cap.dir)}, archivo simbólico=${estado(cap.archivo)}, archivo duro=${estado(cap.duro)}`);
    const saltadas = (lista, ok) => (ok ? 0 : lista.length);
    const total = saltadas(requierenSymlinkArchivo, cap.archivo.creado && cap.archivo.tipo === "symlink")
      + saltadas(requierenDir, cap.dir.creado) + saltadas(requierenDuro, cap.duro.creado);
    t.diagnostic(`pruebas que dependen de un symlink de archivo (NO VERIFICADO si no hay privilegio): ${requierenSymlinkArchivo.length}`);
    for (const c of requierenSymlinkArchivo) t.diagnostic(`  - ${c.archivo}:${c.linea} — ${c.motivo}`);
    t.diagnostic(`pruebas que se saltan en este equipo por falta de enlaces: ${total}`);
    assert.ok(todas.length > 0, "debe haber al menos una omisión declarada");
  });
});
