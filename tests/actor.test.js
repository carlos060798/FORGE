// @ts-check
/** Fase 1 del plan de equipos: identidad del actor (persona, agente o CI) en eventos y en el libro de gasto. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { actorActual } from "../core/actor.js";
import { agenteActivo } from "../core/entorno.js";
import { EventLog } from "../core/event-log.js";
import { LibroDeGasto } from "../core/ciclo/diario.js";
import { revisionHumana } from "../core/ciclo/nodos.js";

const temporal = () => mkdtempSync(join(tmpdir(), "fragua-actor-"));
const lineas = (archivo) => readFileSync(archivo, "utf8").trim().split("\n").map((l) => JSON.parse(l));

describe("actorActual", () => {
  test("sin variables es una persona con el usuario del sistema", () => {
    const a = actorActual({});
    assert.equal(a.tipo, "persona");
    assert.ok(a.id.length > 0 && a.id.length <= 200);
    assert.equal(a.ci, undefined);
  });
  test("FRAGUA_AGENTE, FORGE_AGENTE o CLAUDE_AGENT_NAME lo hacen agente, con la misma regla que el guardián", () => {
    assert.deepEqual(actorActual({ FRAGUA_AGENTE: "tester" }), { tipo: "agente", id: "tester" });
    assert.deepEqual(actorActual({ FORGE_AGENTE: "revisor" }), { tipo: "agente", id: "revisor" });
    assert.deepEqual(actorActual({ CLAUDE_AGENT_NAME: "arquitecto" }), { tipo: "agente", id: "arquitecto" });
    // Misma resolución que agenteActivo: no se inventa otra regla de conflicto
    assert.equal(actorActual({ FRAGUA_AGENTE: "a", FORGE_AGENTE: "c", CLAUDE_AGENT_NAME: "b" }).id, agenteActivo({ FRAGUA_AGENTE: "a", FORGE_AGENTE: "c", CLAUDE_AGENT_NAME: "b" }));
  });
  test("con CI es CI; si además hay agente, manda el agente y conserva ci; las variables GITHUB_* no se leen", () => {
    assert.deepEqual(actorActual({ CI: "true" }), { tipo: "ci", id: "ci", ci: true });
    assert.deepEqual(actorActual({ CI: "1", FRAGUA_AGENTE: "tester" }), { tipo: "agente", id: "tester", ci: true });
    assert.equal(actorActual({ GITHUB_ACTIONS: "true" }).tipo, "persona", "GITHUB_* no cuenta: la CI se detecta solo con CI");
    assert.equal(actorActual({ CI: "false" }).tipo, "persona");
  });
  test("el identificador no lleva caracteres de control ni pasa de 200 caracteres", () => {
    const a = actorActual({ FRAGUA_AGENTE: "x\u0007\n" + "y".repeat(500) });
    assert.doesNotMatch(a.id, /[\u0000-\u001f]/);
    assert.ok(a.id.length <= 200);
  });
});

describe("quien en la decisión de revisión humana", () => {
  const deps = (dir) => ({ log: new EventLog(dir), respaldo: { restaurar: () => ({}) } });
  const estado = () => /** @type {any} */ ({ taskId: "T1", iteracion: 1, maxIteraciones: 3, presupuesto: { estado: "ok" }, revision: { motivo: "iteraciones", reanudarEn: "coder" } });

  test("la decisión guarda quién la tomó en la revisión y en el evento", async () => {
    const dir = temporal();
    const r = await revisionHumana(estado(), deps(dir), { decision: "aceptar" });
    assert.equal(r.resultado, "aceptada_por_humano");
    assert.ok(r.revision.quien && typeof r.revision.quien.id === "string", "la revisión lleva quien");
    const ev = lineas(join(dir, "events.jsonl")).find((e) => e.type === "ciclo:revision_decidida");
    assert.deepEqual(ev.quien, r.revision.quien);
  });
  test("una decisión rechazada no deja rastro ni evento", async () => {
    const dir = temporal();
    await assert.rejects(revisionHumana(estado(), deps(dir), { decision: "inventada" }));
    assert.throws(() => readFileSync(join(dir, "events.jsonl"), "utf8"));
  });
});

describe("quien en los registros", () => {
  test("EventLog.append anota quien; un quien explícito manda sobre el del entorno", () => {
    const dir = temporal();
    const log = new EventLog(dir);
    log.append("custom", { m: 1 });
    log.append("custom", { m: 2 }, { quien: { tipo: "persona", id: "ana" } });
    const [a, b] = lineas(join(dir, "events.jsonl"));
    assert.ok(a.quien && typeof a.quien.id === "string", "primer evento con quien");
    assert.deepEqual(b.quien, { tipo: "persona", id: "ana" });
  });
  test("LibroDeGasto.anotar anota quien y los totales no cambian", () => {
    const dir = join(temporal(), ".sdd", "motor", "run-1");
    const libro = new LibroDeGasto(dir);
    libro.anotar({ taskId: "T1", usd: 0.5, inputTokens: 10, outputTokens: 5 });
    libro.anotar({ taskId: "T1", usd: 0.25, inputTokens: 1, outputTokens: 1, quien: { tipo: "agente", id: "tester" } });
    const [a, b] = lineas(join(dir, "gasto.jsonl"));
    assert.ok(a.quien && typeof a.quien.id === "string");
    assert.deepEqual(b.quien, { tipo: "agente", id: "tester" });
    assert.equal(libro.total().usd, 0.75);
    assert.equal(libro.porTarea().T1.llamadas, 2);
  });
});
