// @ts-check
/**
 * Tests de la spec S0 "Saneamiento" — defectos previos del engine y del instalador.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { safeFiles } from "../core/runners/runner.js";
import { cargarTareas, normalizarTareas, seccionesDeTareas, specActiva } from "../core/tareas.js";
import { PipelineStateMachine } from "../core/state-machine.js";
import { InMemoryStateStore } from "../core/state-store.js";
import { CircuitBreaker } from "../core/execution-context.js";
import { globARegex, scanCodigo } from "../utils/adr-parser.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const CLI = join(ROOT, "cli", "index.js");

function proyectoTemporal(prefijo) {
  const dir = mkdtempSync(join(tmpdir(), prefijo));
  mkdirSync(join(dir, ".sdd"), { recursive: true });
  return dir;
}

describe("S0 — safeFiles confina por ruta, no por prefijo", () => {
  test("descarta un directorio hermano cuyo nombre empieza igual", () => {
    const cwd = join(tmpdir(), "proy");
    const r = safeFiles(cwd, ["../proy-malo/x.js", "a.js", "../fuera.js", "sub/b.js"]);
    assert.deepEqual(r, ["a.js", join("sub", "b.js")]);
  });

  test("descarta rutas absolutas fuera del proyecto", () => {
    const cwd = join(tmpdir(), "proy");
    assert.deepEqual(safeFiles(cwd, [join(tmpdir(), "otro", "c.js")]), []);
  });
});

describe("S0 — el engine lee las tareas que genera /sdd.tareas", () => {
  const TAREAS_MD = [
    "# Tareas: demo",
    "",
    "## Progreso",
    "",
    "## T001 — Crear el esquema",
    "**Agente:** arquitecto",
    "",
    "### Qué hacer",
    "Definir el esquema.",
    "",
    "## T002 — Implementar",
    "**Agente:** desarrollador-backend",
    "",
    "## Matriz de Cobertura de CAs",
    "| CA | Tareas |",
  ].join("\n");

  const ESTADO_OBJETO = {
    spec_id: "2026-01-01-demo",
    tareas: {
      T001: { estado: "completada", agente: "arquitecto", depende_de: [], cubre_cas: ["CA-001-01"] },
      T002: { estado: "pendiente", agente: "desarrollador-backend", depende_de: ["T001"], cubre_cas: ["CA-001-02"] },
    },
  };

  test("seccionesDeTareas corta cada tarea en el siguiente encabezado", () => {
    const s = seccionesDeTareas(TAREAS_MD);
    assert.deepEqual([...s.keys()], ["T001", "T002"]);
    assert.ok(s.get("T001")?.includes("Definir el esquema."));
    assert.ok(!s.get("T002")?.includes("Matriz de Cobertura"));
  });

  test("normalizarTareas convierte el formato objeto y omite las completadas", () => {
    const t = normalizarTareas(ESTADO_OBJETO, TAREAS_MD);
    assert.equal(t.length, 1);
    assert.equal(t[0].id, "T002");
    assert.equal(t[0].agente, "desarrollador-backend");
    assert.deepEqual(t[0].dependencias, ["T001"]);
    assert.ok(t[0].prompt.startsWith("## T002 — Implementar"));
  });

  test("normalizarTareas deja intacto el formato array", () => {
    const tareas = [{ id: "A", agente: "tester", prompt: "x" }];
    assert.deepEqual(normalizarTareas({ tareas }), tareas);
  });

  test("cargarTareas encuentra el archivo de la spec activa con cualquiera de las dos claves", () => {
    for (const clave of ["spec_activa", "especificacion_activa"]) {
      const dir = proyectoTemporal("forge-s0-tareas-");
      const specDir = join(dir, ".sdd", "especificaciones", "2026-01-01-demo");
      mkdirSync(specDir, { recursive: true });
      writeFileSync(join(specDir, ".estado-tareas.json"), JSON.stringify(ESTADO_OBJETO));
      writeFileSync(join(specDir, "tareas.md"), TAREAS_MD);

      const { tareas, origen } = cargarTareas(dir, { [clave]: "2026-01-01-demo" });
      assert.equal(tareas.length, 1, `con ${clave}`);
      assert.ok(origen?.endsWith(".estado-tareas.json"));
    }
  });

  test("cargarTareas prefiere .sdd/estado-tareas.json cuando existe", () => {
    const dir = proyectoTemporal("forge-s0-global-");
    writeFileSync(join(dir, ".sdd", "estado-tareas.json"), JSON.stringify({ tareas: [{ id: "G1", agente: "tester", prompt: "p" }] }));
    assert.equal(cargarTareas(dir, {}).tareas[0].id, "G1");
  });

  test("cargarTareas sin nada devuelve lista vacía", () => {
    assert.deepEqual(cargarTareas(proyectoTemporal("forge-s0-vacio-"), {}), { tareas: [], origen: null });
  });

  test("specActiva acepta las dos claves", () => {
    assert.equal(specActiva({ spec_activa: "a" }), "a");
    assert.equal(specActiva({ especificacion_activa: "b" }), "b");
    assert.equal(specActiva({}), null);
  });
});

describe("S0 — la máquina de estados acepta especificacion_activa", () => {
  const log = { append() {} };

  test("spec → plan avanza con especificacion_activa y spec_aprobado", () => {
    const store = new InMemoryStateStore();
    store.write({ pipeline_step: "spec", especificacion_activa: "x", spec_aprobado: true });
    const r = new PipelineStateMachine(store, /** @type {any} */ (log)).advance("plan");
    assert.equal(r.ok, true, r.error);
  });

  test("spec → plan sigue bloqueado sin aprobación humana", () => {
    const store = new InMemoryStateStore();
    store.write({ pipeline_step: "spec", especificacion_activa: "x" });
    const r = new PipelineStateMachine(store, /** @type {any} */ (log)).advance("plan");
    assert.equal(r.ok, false);
    assert.match(String(r.error), /aprobar/);
  });
});

describe("S0 — el circuit breaker escribe en el proyecto indicado", () => {
  test("forzarNivel persiste en cwd, no en process.cwd()", () => {
    const dir = proyectoTemporal("forge-s0-cb-");
    const cb = new CircuitBreaker({ cwd: dir });
    cb.forzarNivel("sandbox");
    assert.ok(existsSync(join(dir, ".sdd", "execution-level.json")));
  });
});

describe("S0 — forge status funciona sin dist/", () => {
  test("carga el núcleo desde core/", () => {
    const dir = proyectoTemporal("forge-s0-status-");
    writeFileSync(join(dir, ".sdd", "estado.json"), JSON.stringify({ pipeline_step: "idea" }));
    const r = spawnSync(process.execPath, [CLI, "status"], { cwd: dir, encoding: "utf8" });
    assert.ok(!(r.stdout + r.stderr).includes("no encontrado"), r.stdout + r.stderr);
    assert.equal(r.status, 0, r.stderr);
  });
});

describe("S0 — forge init instala hooks que cargan", () => {
  test("copia shared/config.js y los wrappers .sh", () => {
    const dir = mkdtempSync(join(tmpdir(), "forge-s0-init-"));
    const r = spawnSync(process.execPath, [CLI, "init"], { cwd: dir, encoding: "utf8", input: "" });
    const hooks = join(dir, ".claude", "hooks");
    assert.ok(existsSync(hooks), `no se creó ${hooks}: ${r.stdout}${r.stderr}`);
    assert.ok(existsSync(join(hooks, "shared", "config.js")), "falta shared/config.js");
    assert.ok(readdirSync(hooks).some((f) => f.endsWith(".sh")), "faltan los wrappers .sh");
  });
});

describe("S0 — adr-parser es un módulo ESM sin dependencias", () => {
  test("globARegex soporta **, * y llaves", () => {
    const re = globARegex("src/**/*.{ts,js}");
    assert.ok(re.test("src/a.ts"));
    assert.ok(re.test("src/x/y/b.js"));
    assert.ok(!re.test("src/a.py"));
    assert.ok(!re.test("lib/a.ts"));
  });

  test("scanCodigo encuentra un ADR en un comentario", () => {
    const dir = mkdtempSync(join(tmpdir(), "forge-s0-adr-"));
    mkdirSync(join(dir, "src", "sub"), { recursive: true });
    writeFileSync(join(dir, "src", "sub", "a.js"), '// ADR: {"decision":"usar X","status":"accepted"}\n');
    const r = scanCodigo(dir, []);
    assert.equal(r.length, 1);
    assert.equal(r[0].decision, "usar X");
    assert.equal(r[0].archivo, "src/sub/a.js");
  });
});

describe("S0 — la etapa del proyecto se entiende venga de quien venga", () => {
  const log = { append() {} };
  const etapa = (estado) => {
    const store = new InMemoryStateStore();
    store.write(estado);
    return new PipelineStateMachine(store, /** @type {any} */ (log)).currentStep();
  };

  test("pipeline_step manda sobre fase_actual", () => {
    assert.equal(etapa({ pipeline_step: "plan", fase_actual: "tareas_generadas" }), "plan");
  });

  test("sin pipeline_step, fase_actual de los comandos /sdd.* se traduce", () => {
    assert.equal(etapa({ fase_actual: "descubrimiento" }), "discovery");
    assert.equal(etapa({ fase_actual: "especificacion" }), "spec");
    assert.equal(etapa({ fase_actual: "tareas_generadas" }), "tasks");
    assert.equal(etapa({ fase_actual: "implementacion_completa" }), "done");
  });

  test("una fase sin equivalente o un estado vacío siguen siendo idea", () => {
    assert.equal(etapa({ fase_actual: "constitucion_completa" }), "idea");
    assert.equal(etapa({}), "idea");
  });
});

describe("S0 — CA-003-04: el registro de memoria carga la tabla de modelos", () => {
  test("agent-memory usa una única variable para la ruta de model-registry.js y el archivo existe", async () => {
    const { readFileSync, existsSync } = await import("node:fs");
    const { join, dirname } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "claude-hooks");
    const fuente = readFileSync(join(raiz, "agent-memory.js"), "utf8");
    const usos = [...fuente.matchAll(/\b_{1,2}registryPath\b/g)].map((m) => m[0]);
    assert.ok(usos.length >= 2, "se define y se usa");
    assert.equal(new Set(usos).size, 1, `un solo nombre para la ruta: ${[...new Set(usos)].join(", ")}`);
    assert.ok(existsSync(join(raiz, "model-registry.js")), "el archivo existe");
    // El módulo de la tabla de modelos carga de verdad (antes caía siempre al valor de reserva)
    const { pathToFileURL } = await import("node:url");
    const m = await import(pathToFileURL(join(raiz, "model-registry.js")).href);
    assert.equal(typeof m.resolveForAgent, "function");
  });
});
