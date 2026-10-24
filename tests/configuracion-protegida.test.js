// @ts-check
/**
 * F6.6 y F1.5 de `2026-10-14-puertas-de-calidad-y-evidencia` (spike configuracion-protegida.md, S0.6): la
 * configuración de las herramientas de calidad (tsconfig, biome, mypy, ruff…) no la puede reescribir el
 * implementador. Si el modelo la propone, no se escribe, y la tarea se pausa. Leerla sigue permitido: el
 * implementador la necesita para saber cómo está configurado el proyecto.
 *
 * Prueba F8.1-style: «el implementador reescribe tsconfig.json», aunque el modelo lo pida.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { CicloVerificado } from "../core/ciclo/index.js";
import { POR_DEFECTO } from "../core/ciclo/config.js";
import { aplicarArchivos, clasificarRuta } from "../core/ciclo/protocolo-archivos.js";
import { crearHerramientasCoder } from "../core/ciclo/herramientas-coder.js";
import { Respaldo } from "../core/ciclo/respaldo.js";

/** Lo que una herramienta de calidad lee para juzgar el código (una de cada familia de CONFIGURACION_PROTEGIDA). */
const PROTEGIDAS = [
  "tsconfig.json", "tsconfig.base.json", "tsconfig.build.json", "src/tsconfig.json", "jsconfig.json",
  "biome.json", "biome.jsonc", "tslint.json", "mypy.ini", "ruff.toml", "pylintrc", "semgrep.yml", "bandit.yaml",
  "codecov.yml", "sonar-project.properties", "deno.json",
];

/** Nombres parecidos que son código o documentación normal: deben seguir escribiéndose. */
const PARECIDAS = ["src/biome-helpers.js", "src/mypy.md", "docs/tsconfig.md", "src/tsconfigReader.ts", "src/ruff.toml.js", "src/deno.json.ts", "src/semgrep-rules.txt"];

const bloque = (ruta, contenido) => "```json\n" + JSON.stringify({ archivos: [{ ruta, contenido }] }) + "\n```";
const PLAN = '{"pasos":["implementar"],"archivosObjetivo":["src/suma.js"]}';
const PRUEBAS = bloque("tests/suma.test.js", "// prueba de suma\n");
const FALLA = { exitCode: 1, stdout: "# tests 1\n# pass 0\n# fail 1\n", stderr: "Cannot find module '../src/suma.js'\n" };
const USO = { inputTokens: 10_000, outputTokens: 0, modelo: "claude-sonnet-4-6", proveedor: "anthropic" };
const TAREA = { id: "T1", agente: "desarrollador-backend", prompt: "Implementa suma", archivos: ["src/suma.js"] };

describe("clasificación: la configuración de herramientas de calidad es de solo lectura para el implementador", () => {
  test("cada patrón de la lista protegida se clasifica como configuración, a cualquier profundidad", () => {
    for (const ruta of PROTEGIDAS) assert.equal(clasificarRuta(ruta), "configuracion", ruta);
  });

  test("los nombres parecidos siguen siendo código o documentación normal", () => {
    for (const ruta of PARECIDAS) assert.equal(clasificarRuta(ruta), null, ruta);
  });
});

describe("el implementador no escribe la configuración aunque el modelo la proponga", () => {
  test("aplicarArchivos: ninguna de las rutas protegidas se escribe; el código sí; la respuesta pide revisión", () => {
    const cwd = mkdtempSync(join(tmpdir(), "forge-cfg-"));
    const propuestas = PROTEGIDAS.map((ruta) => ({ ruta, contenido: "{ \"compilerOptions\": { \"strict\": false } }\n" }));
    const r = aplicarArchivos(cwd, [{ ruta: "src/suma.js", contenido: "export const suma = (a, b) => a + b;\n" }, ...propuestas], { rol: "coder" });
    assert.deepEqual(r.escritos.map((a) => a.ruta), ["src/suma.js"]);
    assert.deepEqual(r.rechazados, PROTEGIDAS.map((ruta) => ({ ruta, motivo: "configuracion" })));
    assert.equal(r.requiereRevision, true);
    for (const ruta of PROTEGIDAS) assert.ok(!existsSync(join(cwd, ruta)), ruta);
  });

  test("un tsconfig.json que ya existe no se puede aflojar", () => {
    const cwd = mkdtempSync(join(tmpdir(), "forge-cfg-"));
    writeFileSync(join(cwd, "tsconfig.json"), "{ \"compilerOptions\": { \"strict\": true } }\n");
    const r = aplicarArchivos(cwd, [{ ruta: "tsconfig.json", contenido: "{ \"compilerOptions\": { \"strict\": false } }\n" }], { rol: "coder" });
    assert.deepEqual(r.escritos, []);
    assert.equal(readFileSync(join(cwd, "tsconfig.json"), "utf8"), "{ \"compilerOptions\": { \"strict\": true } }\n");
  });

  test("las rutas parecidas que hoy se permiten siguen escribiéndose (sin cambios para ellas)", () => {
    const cwd = mkdtempSync(join(tmpdir(), "forge-cfg-"));
    const r = aplicarArchivos(cwd, PARECIDAS.map((ruta) => ({ ruta, contenido: "x\n" })), { rol: "coder" });
    assert.deepEqual(r.rechazados, []);
    assert.deepEqual(r.escritos.map((a) => a.ruta).sort(), [...PARECIDAS].sort());
  });

  test("ciclo completo: si el implementador propone tsconfig.json, la tarea se pausa y el archivo no cambia", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "forge-cfg-ciclo-"));
    mkdirSync(join(cwd, "src"), { recursive: true });
    writeFileSync(join(cwd, "tsconfig.json"), "{ \"compilerOptions\": { \"strict\": true } }\n");
    const propuesta = "```json\n" + JSON.stringify({ archivos: [
      { ruta: "src/suma.js", contenido: "export const suma = (a, b) => a + b;\n" },
      { ruta: "tsconfig.json", contenido: "{ \"compilerOptions\": { \"strict\": false } }\n" },
    ] }) + "\n```";
    const guion = { arquitecto: [PLAN], tester: [PRUEBAS], "desarrollador-backend": [propuesta] };
    const cola = [FALLA];
    const eventos = [];
    const ciclo = new CicloVerificado(/** @type {any} */ ({
      cwd, runId: "r1", testCmd: "npm test",
      config: { ...POR_DEFECTO, motor: { ...POR_DEFECTO.motor, grafo: "propio", mutacion: "no" } },
      log: { append: (type, payload, meta) => eventos.push({ type, payload, meta }) },
      aliasDe: () => "sonnet",
      llamar: async (p) => {
        const s = guion[p.agente]?.shift();
        if (s === undefined) throw new Error(`guion agotado para ${p.agente}`);
        return { ok: true, output: s, ...USO };
      },
      runner: { test: async () => {
        const r = cola.shift();
        if (r === undefined) throw new Error("guion de ejecuciones agotado");
        return { stdout: "", stderr: "", timedOut: false, infraError: false, durationMs: 1, ...r };
      } },
    }));
    const r = await ciclo.ejecutar(TAREA);
    assert.equal(r.estado.resultado, "revision_pendiente");
    assert.equal(r.estado.revision?.motivo, "dependencias");
    assert.match(String(r.estado.revision?.detalle), /tsconfig\.json/);
    assert.equal(readFileSync(join(cwd, "tsconfig.json"), "utf8"), "{ \"compilerOptions\": { \"strict\": true } }\n");
  });
});

describe("leer la configuración sigue permitido (no cambia lo que el implementador ve hoy)", () => {
  test("leer_archivo devuelve tsconfig.json aunque no pueda escribirlo", async () => {
    const base = mkdtempSync(join(tmpdir(), "forge-cfg-leer-"));
    const dir = join(base, "proyecto");
    mkdirSync(dir);
    writeFileSync(join(dir, "tsconfig.json"), "{ \"compilerOptions\": { \"strict\": true } }\n");
    const h = crearHerramientasCoder(/** @type {any} */ ({
      cwd: dir, vetadas: [], pruebas: ["tests/suma.test.js"], respaldo: new Respaldo(dir, join(base, "respaldo")),
      taskId: "T1", maxPruebas: 5, log: { append: () => {} },
      runner: { test: async () => ({ exitCode: 1, stdout: "", stderr: "", timedOut: false, infraError: false, durationMs: 1 }) },
    }));
    const r = await h.ejecutar("leer_archivo", { ruta: "tsconfig.json" });
    assert.equal(r.error, false);
    assert.match(r.texto, /"strict": true/);
  });
});
