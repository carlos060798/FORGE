// @ts-check
/**
 * T032 / T033 — El ciclo verificado integrado en el orquestador y en el CLI.
 * Cubre CA-008-01, CA-008-02, CA-008-04, CA-005-03 y los códigos de salida.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { Orchestrator } from "../../core/orchestrator.js";
import { EventLog } from "../../core/event-log.js";
import { InMemoryStateStore } from "../../core/state-store.js";
import { PipelineStateMachine } from "../../core/state-machine.js";
import { CicloVerificado } from "../../core/ciclo/index.js";
import { POR_DEFECTO } from "../../core/ciclo/config.js";
import { circuitBreaker } from "../../core/execution-context.js";
import { DockerCli } from "../../core/sandbox/docker-cli.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI  = join(ROOT, "cli", "index.js");
const json = (o) => "```json\n" + JSON.stringify(o) + "\n```";
const USO  = { inputTokens: 1000, outputTokens: 0, modelo: "claude-sonnet-4-6", proveedor: "anthropic" };

/** Orquestador con un ciclo guionizado: cada tarea pasa a la primera salvo las de `fallan`. */
function montar({ fallan = [], conCiclo = true } = {}) {
  const cwd = mkdtempSync(join(tmpdir(), "forge-e2e-"));
  const log = new EventLog(join(cwd, ".sdd"));
  const store = new InMemoryStateStore();
  /** @type {string[]} */
  const orden = [];
  let actual = "";
  let enCurso = 0;
  let maxSimultaneas = 0;
  let numeroEjecucion = 0;

  const ciclo = new CicloVerificado({
    cwd, runId: "r1", config: { ...POR_DEFECTO, motor: { ...POR_DEFECTO.motor, grafo: process.env.FORGE_MOTOR_GRAFO ?? "propio" } }, log, testCmd: "npm test",
    aliasDe: () => "sonnet",
    llamar: async ({ agente, userPrompt }) => {
      const id = /Tarea (\w+)/.exec(userPrompt)?.[1] ?? actual;
      if (agente === "arquitecto") { actual = id; orden.push(id); enCurso++; maxSimultaneas = Math.max(maxSimultaneas, enCurso); }
      await new Promise((r) => setTimeout(r, 5));
      const salida = agente === "arquitecto" ? json({ pasos: [], archivosObjetivo: [] })
        : agente === "tester" ? json({ archivos: [{ ruta: `tests/${actual}.test.js`, contenido: "// t" }] })
        : json({ archivos: [{ ruta: `src/${actual}.js`, contenido: "// impl" }] });
      return { ok: true, output: salida, ...USO };
    },
    runner: {
      test: async () => {
        const falla = fallan.includes(actual);
        const hayImpl = existsSync(join(cwd, "src", `${actual}.js`));
        if (hayImpl && !falla) enCurso--;
        // Cada ejecución lleva su número: varias salidas fallidas idénticas se pausarían por «sin progreso» (H8)
        return { exitCode: hayImpl && !falla ? 0 : 1, stdout: `# pass 1\n# ejecución ${++numeroEjecucion}\n`, stderr: "", timedOut: false, infraError: false, durationMs: 1 };
      },
    },
  });

  const registry = { get: (n) => ({ name: n, systemPrompt: "", model: "sonnet" }) };
  const fsm = new PipelineStateMachine(/** @type {any} */ (store), log);
  const orch = new Orchestrator(/** @type {any} */ (registry), fsm, log, /** @type {any} */ (store), {
    cwd, parallelThreshold: 2, stopOnFailure: true, ciclo: conCiclo ? ciclo : undefined,
  });
  const tarea = (id, deps = []) => ({ id, agente: "desarrollador-backend", prompt: `Tarea ${id}`, dependencias: deps });
  return { cwd, log, orch, orden, tarea, maxSimultaneas: () => maxSimultaneas };
}

describe("orquestador con ciclo verificado", () => {
  test("las tareas de código pasan por el ciclo y quedan completadas", async () => {
    circuitBreaker.reset();
    const m = montar();
    const r = await m.orch.run([m.tarea("A"), m.tarea("B", ["A"])]);
    assert.equal(r.ok, true);
    assert.deepEqual(r.completedTasks.map((t) => t.taskId), ["A", "B"]);
    assert.equal(r.completedTasks[0].ciclo.resultado, "exito");
    assert.equal(m.log.replayTaskStates().get("B")?.estado, "completada");
    assert.equal(readFileSync(join(m.cwd, "src", "A.js"), "utf8"), "// impl");
  });

  test("CA-008-04: nunca dos tareas a la vez, aunque el umbral de paralelismo lo permita", async () => {
    circuitBreaker.reset();
    const m = montar();
    const r = await m.orch.run([m.tarea("A"), m.tarea("B"), m.tarea("C")]);
    assert.equal(r.ok, true);
    assert.equal(m.maxSimultaneas(), 1);
    assert.deepEqual(m.orden, ["A", "B", "C"]);
  });

  test("una tarea en revisión detiene la ejecución y no se cuenta como fallida", async () => {
    circuitBreaker.reset();
    const m = montar({ fallan: ["A"] });
    const r = await m.orch.run([m.tarea("A"), m.tarea("B", ["A"])]);
    assert.equal(r.ok, false);
    assert.deepEqual(r.pausedTasks.map((t) => t.taskId), ["A"]);
    assert.equal(r.pausedTasks[0].ciclo.revision.motivo, "iteraciones");
    assert.deepEqual(r.failedTasks, []);
    assert.deepEqual(m.orden, ["A"], "B no llegó a empezar");
    assert.deepEqual(m.log.replayTaskStates().get("A"), { estado: "en_revision", motivo: "iteraciones" });
  });

  test("la decisión solo se aplica a las tareas indicadas", async () => {
    circuitBreaker.reset();
    const m = montar({ fallan: ["A"] });
    await m.orch.run([m.tarea("A")]);
    m.orch.options.decision = { decision: "abortar", taskIds: ["A"] };
    const r = await m.orch.run([m.tarea("A"), m.tarea("B")]);
    // Abortar es una decisión, no un fallo: no figura entre las fallidas y el resultado es correcto
    assert.deepEqual(r.failedTasks, []);
    assert.equal(r.ok, true);
    assert.deepEqual(r.abortedTasks.map((t) => [t.taskId, t.error]), [["A", "Abortada por decisión humana; los archivos se restauraron"]]);
    assert.ok(!existsSync(join(m.cwd, "src", "A.js")), "abortar restauró los archivos");
  });
});

describe("CLI — forge run / resume con el ciclo", () => {
  function proyecto(estado, eventos = []) {
    const dir = mkdtempSync(join(tmpdir(), "forge-cli-ciclo-"));
    mkdirSync(join(dir, ".sdd"), { recursive: true });
    writeFileSync(join(dir, ".sdd", "estado.json"), JSON.stringify(estado));
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "demo", type: "module", scripts: { test: "node --test" } }));
    writeFileSync(join(dir, "tareas.json"), JSON.stringify([{ id: "T1", agente: "desarrollador-backend", prompt: "Implementa suma" }]));
    if (eventos.length) {
      const log = new EventLog(join(dir, ".sdd"));
      for (const [type, payload] of eventos) log.append(type, payload, { taskId: "T1" });
    }
    return dir;
  }
  const forge = (dir, ...args) => spawnSync(process.execPath, [CLI, ...args], {
    cwd: dir, encoding: "utf8", env: { ...process.env, FORGE_LLM_PROVIDER: "stub", ANTHROPIC_API_KEY: "" },
  });

  test("CA-008-02: el ciclo no se ejecuta fuera de la etapa de construcción", () => {
    const dir = proyecto({ pipeline_step: "plan" });
    const r = forge(dir, "run", "--tasks", "tareas.json", "--motor", "ciclo");
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stderr, /solo se ejecuta en la etapa "code"/);
    assert.ok(!existsSync(join(dir, ".sdd", "motor")), "no se creó ninguna sesión");
  });

  test("un modo de motor desconocido se rechaza", () => {
    const r = forge(proyecto({ pipeline_step: "code" }), "run", "--tasks", "tareas.json", "--motor", "turbo");
    assert.notEqual(r.status, 0);
    assert.match(r.stdout + r.stderr, /motor\.modo desconocido/);
  });

  test("CA-005-03: resume sin decisión muestra el motivo, sale con 3 y no gasta nada", () => {
    const dir = proyecto({ pipeline_step: "code" }, [["task_started", {}], ["task_paused", { motivo: "presupuesto" }]]);
    const r = forge(dir, "resume");
    assert.equal(r.status, 3, r.stdout + r.stderr);
    assert.match(r.stdout, /T1: se alcanzó el tope de gasto/);
    assert.match(r.stdout, /--decision continuar/);
    assert.ok(!existsSync(join(dir, ".sdd", "motor")), "ni sesión ni llamadas");
  });

  test("una decisión desconocida se rechaza", () => {
    const dir = proyecto({ pipeline_step: "code" }, [["task_started", {}], ["task_paused", { motivo: "iteraciones" }]]);
    const r = forge(dir, "resume", "--decision", "quizas");
    assert.equal(r.status, 1);
    assert.match(r.stderr, /Decisión no válida/);
  });

  test("CA-008-01: con --motor clasico, forge run se comporta como en 4.x", () => {
    const dir = proyecto({ pipeline_step: "plan" });
    const r = forge(dir, "run", "--tasks", "tareas.json", "--motor", "clasico");
    assert.ok(!(r.stdout + r.stderr).includes("ciclo verificado"), r.stdout + r.stderr);
    assert.ok(!existsSync(join(dir, ".sdd", "motor")));
  });

  const dockerActivo = process.env.FORGE_TEST_DOCKER === "1" && (spawnSync("docker", ["version", "--format", "{{.Server.Version}}"], { encoding: "utf8" }).status === 0);

  test("CA-008-04: un segundo ciclo en el mismo proyecto se rechaza mientras el primero siga en marcha", { skip: !dockerActivo && "requiere FORGE_TEST_DOCKER=1 y Docker en marcha" }, () => {
    const dir = proyecto({ pipeline_step: "code" });
    mkdirSync(join(dir, ".sdd", "motor"), { recursive: true });
    const vivo = spawn(process.execPath, ["-e", "setTimeout(() => {}, 30000)"], { stdio: "ignore" });
    try {
      writeFileSync(join(dir, ".sdd", "motor", "proyecto.lock"), JSON.stringify({ pid: vivo.pid, ts: Date.now() }));
      const r = forge(dir, "run", "--tasks", "tareas.json", "--motor", "ciclo");
      assert.equal(r.status, 1, r.stdout + r.stderr);
      assert.match(r.stderr, /ya está en curso en otro proceso/);
    } finally {
      vivo.kill();
    }
  });

  test("recorrido real: run en modo ciclo, pausa, status y abortar", { skip: !dockerActivo && "requiere FORGE_TEST_DOCKER=1 y Docker en marcha" }, () => {
    // El proveedor stub no produce el formato pedido: el ciclo debe pausar pidiendo revisión
    const dir = proyecto({ pipeline_step: "code" });
    const run = forge(dir, "run", "--tasks", "tareas.json", "--motor", "ciclo");
    assert.equal(run.status, 3, run.stdout + run.stderr);
    assert.match(run.stdout, /Motor: ciclo verificado/);
    assert.match(run.stdout, /un agente no devolvió una salida utilizable/);

    const status = forge(dir, "status");
    assert.match(status.stdout, /Ciclo verificado · sesión run-/);
    assert.match(status.stdout, /T1: iteración 0\/5 · espera decisión \(salida_invalida\)/);

    assert.equal(forge(dir, "resume").status, 3);

    const abortar = forge(dir, "resume", "--decision", "abortar");
    assert.match(abortar.stdout, /Abortada por decisión humana/);
    assert.equal(forge(dir, "status").stdout.includes("abortada"), true);
  });
});

// Evita que un DockerCli sin usar se marque como import muerto en la comprobación de tipos
void DockerCli;
