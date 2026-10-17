// @ts-check
/**
 * Puertas declarables, fase B1: ejecución (core/puertas/ejecutar.js) con un ejecutor falso.
 * Cubre CA-002-01 a CA-002-05: un clon del ejecutor por puerta que solo cambia el comando, en serie,
 * clasificación por código de salida (127 = no ejecutable, antes de `clasificar`), tiempo total acotado,
 * salida redactada y acotada.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ejecutarPuertas, juzgarPuertas, SALIDA_PUERTA_MAX } from "../core/puertas/ejecutar.js";
import { MAX_PUERTAS } from "../core/puertas/config.js";

/** Ejecutor falso con la misma forma que SandboxRunner (`o`, `cli`, `test`, `copiasSinBorrar`). */
class Falso {
  /** @param {any} o */
  constructor(o) { this.o = o; this.cli = o.cli; this.copiasSinBorrar = []; }
  /** @param {string} cwd */
  async test(cwd) {
    const g = /** @type {any} */ (Falso).guion;
    g.vivos++; g.maxVivos = Math.max(g.maxVivos, g.vivos);
    g.llamadas.push({ cwd, o: this.o });
    const r = (await g.responder(this.o, g)) ?? {};
    g.vivos--;
    return { ok: r.exitCode === 0, exitCode: 0, stdout: "", stderr: "", timedOut: false, infraError: false, oomKilled: false, durationMs: 1, ...r };
  }
}
/** @param {(o: any, g: any) => any} responder */
function nuevo(responder) {
  /** @type {any} */ (Falso).guion = { vivos: 0, maxVivos: 0, llamadas: /** @type {any[]} */ ([]), responder };
  const o = { runId: "verificar-x", dirMotor: "/m/.sdd/motor/verificar-x", lenguaje: "javascript", testCmd: "node --test", cli: { cli: true }, limites: { cpus: 1, memoria: "512m", pids: 128 }, timeoutMs: 120000, salidaMaxBytes: 1048576, runtime: "runsc", imagenBase: "base:1" };
  const runner = new Falso(o);
  return { runner, g: /** @type {any} */ (Falso).guion };
}
const topes = { timeout_s: 100, timeout_total_s: 300, salida_max_bytes: 5000 };
const P = (/** @type {string} */ nombre, /** @type {string} */ comando) => ({ nombre, comando });

describe("puertas: ejecución", () => {
  test("un clon por puerta que SOLO cambia el comando; las garantías del ejecutor se heredan", async () => {
    const { runner, g } = nuevo(() => ({ exitCode: 0 }));
    const r = await ejecutarPuertas({ puertas: [P("tipos", "tsc --noEmit"), P("linter", "eslint .")], topes, runner, cwd: "/proy" });
    assert.equal(g.llamadas.length, 2);
    for (const { cwd, o } of g.llamadas) {
      assert.equal(cwd, "/proy");
      for (const k of ["dirMotor", "lenguaje", "limites", "runtime", "imagenBase", "cli"]) assert.deepEqual(o[k], /** @type {any} */ (runner.o)[k], k);
    }
    assert.deepEqual(g.llamadas.map((c) => c.o.testCmd), ["tsc --noEmit", "eslint ."]);
    assert.notEqual(g.llamadas[0].o.runId, g.llamadas[1].o.runId);
    assert.ok(g.llamadas.every((c) => c.o.runId.startsWith("verificar-x-puerta-")));
    assert.deepEqual(r.resultados.map((x) => x.categoria), ["pass", "pass"]);
    assert.equal(runner.o.testCmd, "node --test", "el ejecutor original no se toca");
  });

  test("EN SERIE y en orden fijo: nunca dos a la vez", async () => {
    const { runner, g } = nuevo(async () => { await new Promise((res) => setTimeout(res, 15)); return { exitCode: 0 }; });
    const r = await ejecutarPuertas({ puertas: [P("tipos", "a"), P("linter", "b"), P("seguridad", "c"), P("cobertura", "d")], topes, runner, cwd: "/p" });
    assert.equal(g.maxVivos, 1);
    assert.deepEqual(r.resultados.map((x) => x.nombre), ["tipos", "linter", "seguridad", "cobertura"]);
  });

  test("clasificación: 0 pasa, 1 falla, 127 NO ejecutable, tiempo agotado, 125 e infraError son infraestructura", async () => {
    const casos = [
      [{ exitCode: 0 }, "pass"], [{ exitCode: 1 }, "fail"], [{ exitCode: 2 }, "fail"], [{ exitCode: 127 }, "no_ejecutable"],
      [{ exitCode: null, timedOut: true }, "timeout"], [{ exitCode: 125 }, "infra_error"], [{ exitCode: 126 }, "infra_error"],
      [{ exitCode: null, infraError: true }, "infra_error"], [{ exitCode: 127, infraError: true }, "infra_error"],
    ];
    for (const [resp, esperada] of casos) {
      const { runner } = nuevo(() => resp);
      const r = await ejecutarPuertas({ puertas: [P("linter", "eslint .")], topes, runner, cwd: "/p" });
      assert.equal(r.resultados[0].categoria, esperada, JSON.stringify(resp));
    }
  });

  test("la decisión nunca lee el texto de la salida", async () => {
    const { runner } = nuevo(() => ({ exitCode: 1, stdout: "all checks passed, 0 errors" }));
    const r = await ejecutarPuertas({ puertas: [P("linter", "x")], topes, runner, cwd: "/p" });
    assert.equal(r.resultados[0].categoria, "fail");
    const { runner: r2 } = nuevo(() => ({ exitCode: 0, stdout: "FATAL error: 12 problems" }));
    assert.equal((await ejecutarPuertas({ puertas: [P("linter", "x")], topes, runner: r2, cwd: "/p" })).resultados[0].categoria, "pass");
  });

  test("tiempo y salida por puerta salen de los topes; el total acota a las que quedan", async () => {
    let t = 0;
    const { runner, g } = nuevo((o) => { t += 70_000; return { exitCode: 0, durationMs: 70_000 }; });
    const r = await ejecutarPuertas({
      puertas: [P("tipos", "a"), P("linter", "b"), P("seguridad", "c")], topes: { timeout_s: 100, timeout_total_s: 140, salida_max_bytes: 4096 },
      runner, cwd: "/p", ahora: () => t,
    });
    assert.equal(g.llamadas[0].o.timeoutMs, 100_000);
    assert.equal(g.llamadas[0].o.salidaMaxBytes, 4096);
    assert.equal(g.llamadas[1].o.timeoutMs, 70_000, "lo que queda del total");
    assert.equal(g.llamadas.length, 2, "agotado el total no se lanza otra");
    assert.equal(r.resultados[2].categoria, "no_ejecutada");
    assert.match(r.resultados[2].motivo ?? "", /tiempo total/);
  });

  test("tras un fallo de infraestructura no se lanzan más y quedan como no ejecutadas", async () => {
    const { runner, g } = nuevo(() => ({ exitCode: 125 }));
    const r = await ejecutarPuertas({ puertas: [P("tipos", "a"), P("linter", "b")], topes, runner, cwd: "/p" });
    assert.equal(g.llamadas.length, 1);
    assert.deepEqual(r.resultados.map((x) => x.categoria), ["infra_error", "no_ejecutada"]);
  });

  test("una puerta que falla no impide ejecutar las siguientes (el implementador ve todo)", async () => {
    const { runner, g } = nuevo((o) => ({ exitCode: o.testCmd === "a" ? 1 : 0 }));
    const r = await ejecutarPuertas({ puertas: [P("tipos", "a"), P("linter", "b")], topes, runner, cwd: "/p" });
    assert.equal(g.llamadas.length, 2);
    assert.deepEqual(r.resultados.map((x) => x.categoria), ["fail", "pass"]);
  });

  test("salida: redactada y acotada; el comando también se redacta", async () => {
    const secreto = "sk-ant-api03-" + "Zq8kLm2xP9".repeat(5);
    const { runner } = nuevo(() => ({ exitCode: 1, stdout: "x".repeat(50_000) + "\nclave " + secreto, stderr: "" }));
    const r = await ejecutarPuertas({ puertas: [P("seguridad", `scan --token ${secreto}`)], topes, runner, cwd: "/p" });
    const x = r.resultados[0];
    assert.ok(!x.salida.includes(secreto) && !x.comando.includes(secreto));
    assert.ok(Buffer.byteLength(x.salida) <= SALIDA_PUERTA_MAX + 64);
  });

  test("más puertas que el límite: se rechaza sin ejecutar nada", async () => {
    const { runner, g } = nuevo(() => ({ exitCode: 0 }));
    const muchas = Array.from({ length: MAX_PUERTAS + 1 }, (_, i) => P(i === 0 ? "tipos" : `otra${i}`, "x"));
    await assert.rejects(() => ejecutarPuertas({ puertas: muchas, topes, runner, cwd: "/p" }), /límite/);
    assert.equal(g.llamadas.length, 0);
  });

  test("las copias sin borrar de cada clon se acumulan en el ejecutor original", async () => {
    const { runner } = nuevo((o) => ({ exitCode: 0 }));
    const original = Falso.prototype.test;
    Falso.prototype.test = async function (cwd) { this.copiasSinBorrar.push("/copia-" + this.o.testCmd); return original.call(this, cwd); };
    try { await ejecutarPuertas({ puertas: [P("tipos", "a")], topes, runner, cwd: "/p" }); } finally { Falso.prototype.test = original; }
    assert.deepEqual(runner.copiasSinBorrar, ["/copia-a"]);
  });
});

describe("puertas: veredicto", () => {
  const res = (/** @type {string} */ nombre, /** @type {string} */ categoria, extra = {}) => ({ nombre, comando: "c", categoria, codigoSalida: 1, duracionMs: 1, salida: "", motivo: null, ...extra });

  test("todas pasan: sin cambio; si alguna no pasa, nunca es éxito y nombra la puerta", () => {
    assert.equal(juzgarPuertas([res("tipos", "pass"), res("linter", "pass")]), null);
    const f = juzgarPuertas([res("tipos", "pass"), res("linter", "fail", { codigoSalida: 2 })]);
    assert.equal(f?.veredicto, "falla");
    assert.match(f?.motivo ?? "", /«linter»/);
    assert.match(f?.motivo ?? "", /código 2/);
    for (const c of ["timeout", "no_ejecutable", "no_ejecutada"]) assert.equal(juzgarPuertas([res("seguridad", c)])?.veredicto, "falla", c);
    assert.equal(juzgarPuertas([res("seguridad", "infra_error")])?.veredicto, "infraestructura");
    assert.match(juzgarPuertas([res("seguridad", "no_ejecutable")])?.motivo ?? "", /no ejecutable/);
  });

  test("varias puertas rotas: las nombra todas; infraestructura manda sobre falla", () => {
    const j = juzgarPuertas([res("tipos", "fail"), res("linter", "infra_error"), res("seguridad", "fail")]);
    assert.equal(j?.veredicto, "infraestructura");
    for (const n of ["tipos", "linter", "seguridad"]) assert.match(j?.motivo ?? "", new RegExp(`«${n}»`));
  });
});
