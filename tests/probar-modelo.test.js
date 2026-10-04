// @ts-check
/**
 * `forge probar-modelo`: la prueba mínima con un modelo real. Aquí se prueba el mecanismo,
 * no el modelo: sin clave se niega, y con el proveedor de pruebas (y Docker) produce el informe.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { probarModelo, textoDelInforme } from "../core/probar-modelo.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SIN_CLAVE = { ANTHROPIC_API_KEY: "", CLAUDE_API_KEY: "", FORGE_LLM_PROVIDER: "" };

describe("probar-modelo", () => {
  test("sin proveedor real se niega: con el de pruebas no se demuestra nada", async () => {
    const r = await probarModelo({ env: SIN_CLAVE });
    assert.equal(r.ok, false);
    assert.match(String(r.motivoNoEjecutada), /ANTHROPIC_API_KEY/);
    assert.match(textoDelInforme(r), /^No se ejecutó/);
  });

  test("el tope debe ser razonable", async () => {
    for (const tope of [0, -1, NaN, 500]) {
      const r = await probarModelo({ tope, env: { ...SIN_CLAVE, ANTHROPIC_API_KEY: "x" } });
      assert.match(String(r.motivoNoEjecutada), /tope/, String(tope));
    }
  });

  test("el comando sale con 2 y lo explica si no hay clave", () => {
    const r = spawnSync(process.execPath, [join(ROOT, "cli", "index.js"), "probar-modelo"], { encoding: "utf8", env: { ...process.env, ...SIN_CLAVE } });
    assert.equal(r.status, 2, r.stdout + r.stderr);
    assert.match(r.stdout, /No se ejecutó/);
  });

  test("con el proveedor de pruebas y Docker produce un informe con resultado, iteraciones y gasto", { skip: process.env.FORGE_TEST_DOCKER !== "1" && "requiere FORGE_TEST_DOCKER=1" }, async () => {
    const r = await probarModelo({ permitirStub: true, env: { ...SIN_CLAVE, FORGE_LLM_PROVIDER: "stub" }, timeoutMs: 120_000 });
    // El proveedor de pruebas no devuelve el formato pedido: el ciclo debe pausarse por salida inválida
    assert.equal(r.codigoSalida, 3, r.salida);
    assert.equal(r.resultado, "revision_pendiente");
    assert.equal(r.motivoRevision, "salida_invalida");
    assert.ok(r.gasto && r.gasto.llamadas >= 1);
    const t = textoDelInforme(r);
    assert.match(t, /formato de archivos/);
    assert.match(t, /Gasto: \$/);
  });
});
