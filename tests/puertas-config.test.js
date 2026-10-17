// @ts-check
/**
 * Puertas declarables (spec 2026-10-14-puertas-de-calidad-y-evidencia, fase B1): lector ESTRICTO de la
 * sección `puertas:` de sdd.config.yaml. Cubre CA-001-01 a CA-001-05 y los defectos del lector plano
 * (spikes/configuracion-protegida.md): clave desconocida sin error, `#` pegado que trunca, comilla final perdida.
 */

import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  leerPuertasDeYaml, leerPuertas, CLAVES_PUERTAS, CLAVES_TOPES, MAX_PUERTAS, TECHOS_PUERTAS, DEFECTOS_PUERTAS,
} from "../core/puertas/config.js";

const base = mkdtempSync(join(tmpdir(), "forge-puertas-config-"));
after(() => rmSync(base, { recursive: true, force: true }));

/** @param {string[]} lineas */
const yaml = (...lineas) => ["puertas:", ...lineas.map((l) => "  " + l)].join("\n") + "\n";
/** @param {string} texto @param {Record<string, string>} [env] */
const leer = (texto, env = {}) => leerPuertasDeYaml(texto, { env });
/** @param {any} r */
const errores = (r) => { assert.equal(r.ok, false, JSON.stringify(r)); return r.errores.join("\n"); };

describe("puertas: lectura válida", () => {
  test("claves fijas: se leen en ORDEN FIJO aunque el archivo las ponga en otro", () => {
    const r = leer(yaml("seguridad: semgrep --config auto", "tipos: tsc --noEmit", "cobertura: c8 --check-coverage --lines 80 node --test", "linter: eslint ."));
    assert.equal(r.ok, true);
    assert.equal(r.declarada, true);
    assert.deepEqual(r.puertas.map((p) => p.nombre), ["tipos", "linter", "seguridad", "cobertura"]);
    assert.equal(r.puertas[0].comando, "tsc --noEmit");
    assert.deepEqual(CLAVES_PUERTAS, ["tipos", "linter", "seguridad", "cobertura"]);
  });

  test("sin sección `puertas:` (o vacía) no hay puertas y el resto no cambia (CA-001-04)", () => {
    for (const t of ["", "motor:\n  modo: ciclo\n", "puertas:\n", "puertas:\n  # nada aún\n\nmotor:\n  modo: ciclo\n"]) {
      const r = leer(t);
      assert.equal(r.ok, true, t);
      assert.equal(r.declarada, false);
      assert.deepEqual(r.puertas, []);
    }
  });

  test("la sección termina en la siguiente clave de primer nivel y no lee las ajenas", () => {
    const r = leer("puertas:\n  tipos: tsc --noEmit\nmotor:\n  linter: ignorado\n  modo: ciclo\n");
    assert.equal(r.ok, true);
    assert.deepEqual(r.puertas.map((p) => p.nombre), ["tipos"]);
  });

  test("terminadores CRLF y comentarios de línea completa", () => {
    const r = leer("puertas:\r\n  # tipos\r\n  tipos: tsc --noEmit\r\n");
    assert.equal(r.ok, true);
    assert.equal(r.puertas[0].comando, "tsc --noEmit");
  });

  test("leerPuertas lee .sdd/sdd.config.yaml; sin archivo, sin puertas", () => {
    const dir = join(base, "proy");
    mkdirSync(join(dir, ".sdd"), { recursive: true });
    assert.equal(leerPuertas(dir, { env: {} }).declarada, false);
    writeFileSync(join(dir, ".sdd", "sdd.config.yaml"), yaml("linter: eslint ."));
    const r = leerPuertas(dir, { env: {} });
    assert.equal(r.ok, true);
    assert.equal(r.puertas[0].comando, "eslint .");
  });
});

describe("puertas: lector estricto (CA-001-02)", () => {
  test("clave desconocida: error claro con su línea, no se ignora", () => {
    const m = errores(leer(yaml("tipos: tsc --noEmit", "pruebas: node --test")));
    assert.match(m, /línea 3/);
    assert.match(m, /«pruebas»/);
    assert.match(m, /tipos, linter, seguridad, cobertura/);
  });

  test("cobertura_minima no existe en esta versión y dice qué hacer", () => {
    const m = errores(leer(yaml("cobertura: c8 node --test", "cobertura_minima: 80")));
    assert.match(m, /cobertura_minima/);
    assert.match(m, /umbral/);
  });

  test("`#` pegado a texto: error, NO se trunca en silencio", () => {
    const m = errores(leer(yaml("seguridad: semgrep --config a#b")));
    assert.match(m, /línea 2/);
    assert.match(m, /#/);
    // Con el valor entero entre comillas sí se admite y se conserva intacto
    const ok = leer(yaml(`seguridad: 'semgrep --config a#b'`));
    assert.equal(ok.ok, true);
    assert.equal(ok.puertas[0].comando, "semgrep --config a#b");
  });

  test("comentario separado por espacio: se descarta y el comando queda entero", () => {
    const r = leer(yaml("linter: eslint . # nota para humanos"));
    assert.equal(r.ok, true);
    assert.equal(r.puertas[0].comando, "eslint .");
  });

  test("comilla final: un comando legítimo con argumento entrecomillado no pierde la comilla", () => {
    const r = leer(yaml(`tipos: tsc -p "dir con espacios/tsconfig.json"`));
    assert.equal(r.ok, true);
    assert.equal(r.puertas[0].comando, `tsc -p "dir con espacios/tsconfig.json"`);
    const q = leer(yaml(`linter: "eslint . --max-warnings 0"`));
    assert.equal(q.puertas[0].comando, "eslint . --max-warnings 0");
    const s = leer(yaml(`linter: 'eslint "a b"'`));
    assert.equal(s.puertas[0].comando, `eslint "a b"`);
  });

  test("comilla sin cerrar, valor vacío, clave repetida, sangría mala y valor en línea: errores", () => {
    assert.match(errores(leer(yaml(`tipos: tsc -p "a b`))), /comilla/);
    assert.match(errores(leer("puertas:\n  tipos:\n")), /sin comando/);
    assert.match(errores(leer(yaml("tipos: tsc", "tipos: tsc -b"))), /dos veces/);
    assert.match(errores(leer("puertas:\n    tipos: tsc\n")), /sangría/);
    assert.match(errores(leer("puertas:\n\ttipos: tsc\n")), /sangría/);
    assert.match(errores(leer("puertas: tsc --noEmit\n")), /puertas/);
    assert.match(errores(leer("puertas:\n  esto no es clave\n")), /línea 2/);
    assert.match(errores(leer("puertas:\n  tipos: tsc\npuertas:\n  linter: eslint .\n")), /dos veces|más de una/);
  });
});

describe("puertas: comando sin intérprete de órdenes (CA-001-05)", () => {
  for (const [nombre, comando] of [["&&", "eslint . && rm -rf x"], ["|", "eslint . | tee x"], [";", "eslint . ; ls"], [">", "eslint . > x"], ["<", "eslint . < x"], ["&", "eslint . & ls"]]) {
    test(`el operador «${nombre}» se rechaza con su línea`, () => {
      const m = errores(leer(yaml(`linter: ${comando}`)));
      assert.match(m, /línea 2/);
      assert.match(m, /operador de shell/);
    });
  }

  test("un intérprete como primera palabra se rechaza aunque agrupe con comillas (sh -c «a && b»)", () => {
    for (const c of [`sh -c "a && b"`, `bash -lc "tsc"`, "cmd /c tsc", "powershell -c tsc", "npx sh -c x", "/bin/sh x", "pwsh -File x.ps1"]) {
      assert.match(errores(leer(yaml(`tipos: ${c}`))), /intérprete/, c);
    }
  });
});

describe("puertas: solo se aprieta, nunca se afloja (CA-001-03)", () => {
  test("ninguna clave que nombre una garantía fija se acepta", () => {
    const fijas = ["pruebas", "test", "tests", "comando_pruebas", "red", "network", "runtime", "sandbox", "usuario", "privilegios", "rojo",
      "rojo_obligatorio", "redaccion", "tope_usd", "presupuesto", "mutacion", "desactivar", "omitir", "ignorar", "deshabilitar", "enabled", "activa",
      "imagen", "env", "limites", "cpus", "memoria", "pids", "opcional", "permitir_fallo", "salvo", "continuar_si_falla", "timeout"];
    for (const k of fijas) {
      const r = leer(yaml(`${k}: true`));
      assert.equal(r.ok, false, `«${k}» no debería aceptarse`);
    }
  });

  test("las claves aceptadas son EXACTAMENTE las cuatro de comando y los tres topes que solo bajan", () => {
    assert.deepEqual([...CLAVES_PUERTAS, ...CLAVES_TOPES].sort(), ["cobertura", "linter", "salida_max_bytes", "seguridad", "timeout_s", "timeout_total_s", "tipos"]);
    assert.ok(MAX_PUERTAS === CLAVES_PUERTAS.length && MAX_PUERTAS <= 4);
    // Ninguna combinación de claves aceptadas produce más puertas que el límite ni un campo de política
    const todas = [...CLAVES_PUERTAS.map((k) => `${k}: tool`), ...CLAVES_TOPES.map((k) => `${k}: 5`)];
    const r = leer(yaml(...todas));
    assert.equal(r.ok, true);
    assert.ok(r.puertas.length <= MAX_PUERTAS);
    assert.deepEqual(Object.keys(r).sort(), ["avisos", "declarada", "ok", "puertas", "topes"]);
    assert.deepEqual(Object.keys(r.puertas[0]).sort(), ["comando", "nombre"]);
  });

  test("un tope del proyecto puede BAJAR el valor, nunca subirlo (se ignora con aviso)", () => {
    const baja = leer(yaml("tipos: tsc", "timeout_s: 30", "timeout_total_s: 60", "salida_max_bytes: 1000"));
    assert.deepEqual(baja.topes, { timeout_s: 30, timeout_total_s: 60, salida_max_bytes: 1000 });
    const sube = leer(yaml("tipos: tsc", "timeout_s: 99999", "timeout_total_s: 99999", "salida_max_bytes: 999999999"));
    assert.deepEqual(sube.topes, { ...DEFECTOS_PUERTAS });
    assert.equal(sube.avisos.length, 3);
    assert.match(sube.avisos[0], /no puede subir/);
  });

  test("el entorno del usuario fija el tope por defecto, con techo", () => {
    const r = leer(yaml("tipos: tsc"), { FRAGUA_PUERTAS_TIMEOUT_S: "200", FORGE_PUERTAS_SALIDA_MAX_BYTES: "500000" });
    assert.equal(r.topes.timeout_s, 200);
    assert.equal(r.topes.salida_max_bytes, 500000);
    const techo = leer(yaml("tipos: tsc"), { FRAGUA_PUERTAS_TIMEOUT_S: "100000", FRAGUA_PUERTAS_TIMEOUT_TOTAL_S: "100000", FRAGUA_PUERTAS_SALIDA_MAX_BYTES: "999999999999" });
    assert.deepEqual(techo.topes, { ...TECHOS_PUERTAS });
    // el proyecto baja lo que el usuario dejó
    const baja = leer(yaml("tipos: tsc", "timeout_s: 50"), { FRAGUA_PUERTAS_TIMEOUT_S: "200" });
    assert.equal(baja.topes.timeout_s, 50);
    // un valor del entorno que no es número se ignora con aviso
    const mala = leer(yaml("tipos: tsc"), { FRAGUA_PUERTAS_TIMEOUT_S: "mucho" });
    assert.equal(mala.topes.timeout_s, DEFECTOS_PUERTAS.timeout_s);
    assert.match(mala.avisos.join("\n"), /PUERTAS_TIMEOUT_S/);
  });

  test("topes mal escritos son error (no se convierten en el valor por defecto en silencio)", () => {
    for (const v of ["0", "-5", "abc", "1.5", "10s"]) assert.match(errores(leer(yaml("tipos: tsc", `timeout_s: ${v}`))), /timeout_s/, v);
  });
});
