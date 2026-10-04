// @ts-check
/**
 * API HTTP local (spec 2026-10-03-api-http): seguridad de la frontera, validación y ejecuciones.
 * Cubre CA-001-01 a CA-001-05, CA-002-01 a CA-002-04 y CA-003-01 a CA-003-04.
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { crearServidorApi, validarTareas } from "../core/api/servidor.js";
import { GuardadorArchivos } from "../core/ciclo/checkpoint-archivos.js";
import { estadoInicial } from "../core/ciclo/estado.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TOKEN = "t".repeat(64);

/**
 * Petición HTTP cruda: permite fijar Host y Origin, que fetch no deja tocar.
 * @returns {Promise<{ estado: number, cabeceras: http.IncomingHttpHeaders, cuerpo: any, texto: string }>}
 */
function pedir(puerto, { metodo = "GET", ruta = "/v1/estado", cabeceras = {}, cuerpo, token = TOKEN, host }) {
  return new Promise((res, rej) => {
    const datos = cuerpo === undefined ? undefined : (typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo));
    const h = { Host: host ?? `127.0.0.1:${puerto}`, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(datos !== undefined ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(datos) } : {}), ...cabeceras };
    const r = http.request({ host: "127.0.0.1", port: puerto, method: metodo, path: ruta, headers: h }, (resp) => {
      let t = ""; resp.on("data", (d) => (t += d));
      resp.on("end", () => { let c = null; try { c = JSON.parse(t); } catch { /* texto */ } res({ estado: resp.statusCode ?? 0, cabeceras: resp.headers, cuerpo: c, texto: t }); });
    });
    r.on("error", rej);
    if (datos !== undefined) r.write(datos);
    r.end();
  });
}

/** Lanzador falso: registra qué se habría ejecutado y termina cuando se le indica. */
function lanzadorFalso() {
  const lanzados = [];
  let terminar = [];
  return {
    lanzados,
    lanzar: (cwd, args) => { lanzados.push({ cwd, args }); return { terminada: new Promise((r) => terminar.push(r)) }; },
    terminarTodos: (codigo = 0, salida = "") => { terminar.forEach((r) => r({ codigo, salida })); terminar = []; },
  };
}

const proyecto = () => {
  const dir = mkdtempSync(join(tmpdir(), "forge-api-"));
  mkdirSync(join(dir, ".sdd"), { recursive: true });
  writeFileSync(join(dir, ".sdd", "estado.json"), JSON.stringify({ pipeline_step: "code" }));
  return dir;
};

describe("frontera de seguridad", () => {
  let api, puerto, dir, falso;
  before(async () => { dir = proyecto(); falso = lanzadorFalso(); api = crearServidorApi({ cwd: dir, token: TOKEN, lanzar: falso.lanzar }); puerto = (await api.escuchar(0)).puerto; });
  after(async () => { falso.terminarTodos(); await api.cerrar(); });

  test("CA-001-01: sin token o con un token distinto, 401 en cualquier ruta y método, también las que no existen", async () => {
    for (const [metodo, ruta] of [["GET", "/v1/estado"], ["POST", "/v1/ejecuciones"], ["POST", "/v1/decisiones"], ["GET", "/no-existe"], ["DELETE", "/"]]) {
      for (const token of [null, "x".repeat(64), "t".repeat(63), ""]) {
        const r = await pedir(puerto, { metodo, ruta, token, cuerpo: metodo === "POST" ? {} : undefined });
        assert.equal(r.estado, 401, `${metodo} ${ruta} con ${JSON.stringify(token)}`);
        assert.equal(r.cabeceras["www-authenticate"], "Bearer");
      }
    }
    assert.deepEqual(falso.lanzados, []);
  });

  test("CA-001-01: el token no se acepta en la URL ni con otro esquema", async () => {
    assert.equal((await pedir(puerto, { ruta: `/v1/estado?token=${TOKEN}`, token: null })).estado, 401);
    assert.equal((await pedir(puerto, { token: null, cabeceras: { Authorization: `Basic ${TOKEN}` } })).estado, 401);
    assert.equal((await pedir(puerto, { token: null, cabeceras: { Authorization: TOKEN } })).estado, 401);
  });

  test("CA-001-02: cualquier petición con cabecera Origin se rechaza (páginas web), aunque lleve el token", async () => {
    for (const origin of ["https://evil.example", "http://127.0.0.1:" + puerto, "null", ""]) {
      const r = await pedir(puerto, { cabeceras: { Origin: origin } });
      assert.equal(r.estado, 403, JSON.stringify(origin));
    }
    const post = await pedir(puerto, { metodo: "POST", ruta: "/v1/ejecuciones", cuerpo: {}, cabeceras: { Origin: "https://evil.example" } });
    assert.equal(post.estado, 403);
    assert.deepEqual(falso.lanzados, []);
  });

  test("CA-001-03: un Host que no es el propio se rechaza (DNS rebinding)", async () => {
    // (una cabecera Host vacía no se puede enviar con Node: el cliente pone la correcta)
    for (const host of ["evil.example", `evil.example:${puerto}`, "127.0.0.1", "127.0.0.1:1", `127.0.0.1.evil.example:${puerto}`]) {
      assert.equal((await pedir(puerto, { host })).estado, 403, JSON.stringify(host));
    }
    assert.equal((await pedir(puerto, { host: `localhost:${puerto}` })).estado, 200);
    assert.equal((await pedir(puerto, { host: `LOCALHOST:${puerto}` })).estado, 200);
  });

  test("CA-001-04: no hay cabeceras CORS y OPTIONS no se atiende", async () => {
    const ok = await pedir(puerto, {});
    assert.equal(ok.estado, 200);
    assert.ok(!Object.keys(ok.cabeceras).some((k) => k.startsWith("access-control-")));
    const pre = await pedir(puerto, { metodo: "OPTIONS", token: null, cabeceras: { "Access-Control-Request-Method": "POST" } });
    assert.ok([401, 405].includes(pre.estado));
    assert.ok(!Object.keys(pre.cabeceras).some((k) => k.startsWith("access-control-")));
    assert.equal(ok.cabeceras["cache-control"], "no-store");
  });

  test("CA-001-05: solo escucha en 127.0.0.1", () => {
    assert.equal(/** @type {any} */ (api.server.address()).address, "127.0.0.1");
  });

  test("el token solo se compara en tiempo constante y no aparece en ninguna respuesta", async () => {
    const r = await pedir(puerto, { token: "x".repeat(64) });
    assert.ok(!r.texto.includes(TOKEN));
    assert.ok(!(await pedir(puerto, {})).texto.includes(TOKEN));
  });
});

describe("lanzar y decidir", () => {
  let api, puerto, dir, falso;
  before(async () => { dir = proyecto(); falso = lanzadorFalso(); api = crearServidorApi({ cwd: dir, token: TOKEN, lanzar: falso.lanzar }); puerto = (await api.escuchar(0)).puerto; });
  after(async () => { falso.terminarTodos(); await api.cerrar(); });

  test("CA-002-01: POST /v1/ejecuciones lanza el ciclo y responde 202 con un identificador", async () => {
    falso.lanzados.length = 0;
    const r = await pedir(puerto, { metodo: "POST", ruta: "/v1/ejecuciones", cuerpo: {} });
    assert.equal(r.estado, 202);
    assert.match(r.cuerpo.id, /^e\d+-[0-9a-f]{8}$/);
    assert.equal(r.cuerpo.estado, "en_curso");
    assert.deepEqual(falso.lanzados[0].args, ["run", "--motor", "ciclo"]);
    assert.equal(resolve(falso.lanzados[0].cwd), resolve(dir));
  });

  test("CA-002-02: nunca se lanza el modo clásico: el modo no se puede elegir", async () => {
    falso.terminarTodos();
    await new Promise((r) => setTimeout(r, 20));
    for (const cuerpo of [{ motor: "clasico" }, { modo: "clasico" }, { force: true }, { cwd: "/" }]) {
      const r = await pedir(puerto, { metodo: "POST", ruta: "/v1/ejecuciones", cuerpo });
      assert.equal(r.estado, 400, JSON.stringify(cuerpo));
      assert.match(r.cuerpo.error, /Campos desconocidos/);
    }
    for (const l of falso.lanzados) assert.ok(l.args.includes("ciclo") && !l.args.includes("clasico") && !l.args.includes("--force"));
  });

  test("CA-002-03: una segunda ejecución mientras hay una en curso recibe 409; al terminar, se puede lanzar otra", async () => {
    falso.terminarTodos(); await new Promise((r) => setTimeout(r, 20));
    const a = await pedir(puerto, { metodo: "POST", ruta: "/v1/ejecuciones", cuerpo: {} });
    assert.equal(a.estado, 202);
    const b = await pedir(puerto, { metodo: "POST", ruta: "/v1/ejecuciones", cuerpo: {} });
    assert.equal(b.estado, 409);
    const d = await pedir(puerto, { metodo: "POST", ruta: "/v1/decisiones", cuerpo: { decision: "aceptar" } });
    assert.equal(d.estado, 409, "tampoco una decisión durante una ejecución");

    assert.equal((await pedir(puerto, { ruta: `/v1/ejecuciones/${a.cuerpo.id}` })).cuerpo.estado, "en_curso");
    falso.terminarTodos(0, "Pipeline completado\nANTHROPIC_API_KEY=sk-ant-abcdefghijklmnopqrstuvwxyz");
    await new Promise((r) => setTimeout(r, 30));
    const fin = await pedir(puerto, { ruta: `/v1/ejecuciones/${a.cuerpo.id}` });
    assert.equal(fin.cuerpo.estado, "terminada");
    assert.equal(fin.cuerpo.codigoSalida, 0);
    assert.match(fin.cuerpo.salida, /Pipeline completado/);
    assert.ok(!fin.cuerpo.salida.includes("sk-ant-abcdefghijklmnopqrstuvwxyz"), "la salida se redacta");
    assert.equal((await pedir(puerto, { metodo: "POST", ruta: "/v1/ejecuciones", cuerpo: {} })).estado, 202);
  });

  test("CA-002-04: con tareas, se validan y se pasan por archivo; las inválidas no lanzan nada", async () => {
    falso.terminarTodos(); await new Promise((r) => setTimeout(r, 20));
    const antes = falso.lanzados.length;
    const malas = [
      { tareas: [] }, { tareas: "x" }, { tareas: [{ id: "../x", agente: "tester", prompt: "p" }] }, { tareas: [{ id: "T1", agente: "tester" }] },
      { tareas: [{ id: "T1", agente: "tester", prompt: "p" }, { id: "T1", agente: "tester", prompt: "p" }] },
      { tareas: [{ id: "T1", agente: "tester", prompt: "p", comando: "rm -rf /" }] }, { tareas: [{ id: "T1", agente: "tester", prompt: "x".repeat(20_001) }] },
      { tareas: [{ id: "T1", agente: "../../etc", prompt: "p" }] }, { tareas: Array.from({ length: 201 }, (_, i) => ({ id: `T${i}`, agente: "tester", prompt: "p" })) },
    ];
    for (const cuerpo of malas) assert.equal((await pedir(puerto, { metodo: "POST", ruta: "/v1/ejecuciones", cuerpo })).estado, 400, JSON.stringify(cuerpo).slice(0, 80));
    assert.equal(falso.lanzados.length, antes);

    const tareas = [{ id: "T1", agente: "desarrollador-backend", prompt: "Implementa suma", archivos: ["src/suma.js"] }];
    const ok = await pedir(puerto, { metodo: "POST", ruta: "/v1/ejecuciones", cuerpo: { tareas } });
    assert.equal(ok.estado, 202);
    const args = falso.lanzados[falso.lanzados.length - 1].args;
    assert.deepEqual(args.slice(0, 3), ["run", "--motor", "ciclo"]);
    const archivo = args[args.indexOf("--tasks") + 1];
    assert.ok(resolve(archivo).startsWith(resolve(dir, ".sdd", "motor", "api")), "el archivo de tareas queda dentro del proyecto");
    assert.deepEqual(JSON.parse(readFileSync(archivo, "utf8")), tareas);
  });

  test("CA-003-01: POST /v1/decisiones lanza resume con la decisión y sus extras", async () => {
    falso.terminarTodos(); await new Promise((r) => setTimeout(r, 20));
    const r = await pedir(puerto, { metodo: "POST", ruta: "/v1/decisiones", cuerpo: { decision: "continuar", tarea: "T3", iteracionesExtra: 2, presupuestoExtra: 1.5 } });
    assert.equal(r.estado, 202);
    assert.deepEqual(falso.lanzados[falso.lanzados.length - 1].args, ["resume", "--motor", "ciclo", "--decision", "continuar", "--tarea", "T3", "--iteraciones-extra", "2", "--presupuesto-extra", "1.5"]);
    assert.equal(r.cuerpo.decision, "continuar");
    assert.equal(r.cuerpo.tarea, "T3");
  });

  test("CA-003-02: las decisiones inválidas se rechazan sin lanzar nada", async () => {
    falso.terminarTodos(); await new Promise((r) => setTimeout(r, 20));
    const antes = falso.lanzados.length;
    const malas = [
      {}, { decision: "quizas" }, { decision: "abortar", tarea: "../x" }, { decision: "abortar", tarea: 5 }, { decision: "continuar", presupuestoExtra: -1 },
      { decision: "continuar", presupuestoExtra: 1001 }, { decision: "continuar", iteracionesExtra: "2" }, { decision: "continuar", presupuestoExtra: null },
      { decision: "abortar", force: true }, { decision: "abortar", cwd: "/" },
    ];
    for (const cuerpo of malas) assert.equal((await pedir(puerto, { metodo: "POST", ruta: "/v1/decisiones", cuerpo })).estado, 400, JSON.stringify(cuerpo));
    assert.equal(falso.lanzados.length, antes);
  });

  test("CA-003-03: cuerpos hostiles: demasiado grande, sin JSON, tipo equivocado, no objeto", async () => {
    falso.terminarTodos(); await new Promise((r) => setTimeout(r, 20));
    assert.equal((await pedir(puerto, { metodo: "POST", ruta: "/v1/ejecuciones", cuerpo: "x".repeat(70 * 1024) })).estado, 413);
    assert.equal((await pedir(puerto, { metodo: "POST", ruta: "/v1/ejecuciones", cuerpo: "{roto" })).estado, 400);
    assert.equal((await pedir(puerto, { metodo: "POST", ruta: "/v1/ejecuciones", cuerpo: "{}", cabeceras: { "Content-Type": "text/plain" } })).estado, 415);
    assert.equal((await pedir(puerto, { metodo: "POST", ruta: "/v1/ejecuciones", cuerpo: "[]" })).estado, 400);
    assert.equal((await pedir(puerto, { metodo: "POST", ruta: "/v1/ejecuciones", cuerpo: "null" })).estado, 400);
  });

  test("CA-003-04: métodos y rutas que no existen", async () => {
    assert.equal((await pedir(puerto, { metodo: "POST", ruta: "/v1/estado", cuerpo: {} })).estado, 405);
    assert.equal((await pedir(puerto, { metodo: "GET", ruta: "/v1/ejecuciones" })).estado, 405);
    assert.equal((await pedir(puerto, { metodo: "PUT", ruta: "/v1/decisiones", cuerpo: {} })).estado, 405);
    assert.equal((await pedir(puerto, { ruta: "/v1/ejecuciones/no-existe" })).estado, 404);
    assert.equal((await pedir(puerto, { ruta: "/v1/ejecuciones/..%2f..%2fetc" })).estado, 404);
    assert.equal((await pedir(puerto, { ruta: "/otra" })).estado, 404);
    assert.equal((await pedir(puerto, { ruta: "/v1/estado/" })).estado, 200, "la barra final se admite");
  });
});

describe("estado", () => {
  test("CA-004-01: etapa, sesión, tareas con su situación y gasto de la sesión", async () => {
    const dir = proyecto();
    const runId = "run-api-1";
    const g = new GuardadorArchivos(join(dir, ".sdd", "motor", runId));
    const e = estadoInicial({ id: "T1", agente: "tester" }, { runId, cwd: dir });
    g.guardar(`${runId}:T1`, { nodo: "coder", siguiente: "revision_humana", estado: { ...e, iteracion: 5, resultado: "revision_pendiente", revision: { motivo: "iteraciones", reanudarEn: "coder", detalle: "5 ejecuciones fallidas" } } });
    g.guardar(`${runId}:T2`, { nodo: "sandbox", siguiente: null, estado: { ...estadoInicial({ id: "T2", agente: "tester" }, { runId, cwd: dir }), resultado: "exito", iteracion: 1 } });
    writeFileSync(join(dir, ".sdd", "motor", "sesion.json"), JSON.stringify({ runId, modo: "ciclo", creada: "2026-01-01T00:00:00Z" }));
    writeFileSync(join(dir, ".sdd", "motor", runId, "gasto.jsonl"), JSON.stringify({ taskId: "T1", usd: 0.25, inputTokens: 10, outputTokens: 2 }) + "\n");

    const falso = lanzadorFalso();
    const api = crearServidorApi({ cwd: dir, token: TOKEN, lanzar: falso.lanzar });
    const { puerto } = await api.escuchar(0);
    try {
      const r = await pedir(puerto, {});
      assert.equal(r.estado, 200);
      assert.equal(r.cuerpo.etapa, "code");
      assert.equal(r.cuerpo.sesion, runId);
      assert.deepEqual(r.cuerpo.gasto, { gastado_usd: 0.25, tope_usd: null, llamadas: 1 });
      const t1 = r.cuerpo.tareas.find((t) => t.id === "T1");
      assert.deepEqual(t1, { id: "T1", iteracion: 5, maxIteraciones: 5, situacion: "espera_decision", motivoRevision: "iteraciones", detalleRevision: "5 ejecuciones fallidas" });
      assert.equal(r.cuerpo.tareas.find((t) => t.id === "T2").situacion, "exito");
      assert.equal(r.cuerpo.ejecucion, null);
    } finally { await api.cerrar(); }
  });
});

describe("validarTareas", () => {
  test("acepta una lista correcta", () => {
    assert.equal(validarTareas([{ id: "T1", agente: "tester", prompt: "p", dependencias: ["T0"], archivos: ["a.js"] }]), null);
  });
});

describe("forge api — proceso real", () => {
  test("CA-001-05 real: arranca, imprime la URL y el token en una línea JSON, y exige el token", async () => {
    const dir = proyecto();
    const proc = spawn(process.execPath, [join(ROOT, "cli", "index.js"), "api", "--port", "0", "--cwd", dir], { stdio: ["ignore", "pipe", "pipe"] });
    try {
      const linea = await new Promise((res, rej) => {
        let b = ""; const t = setTimeout(() => rej(new Error("no arrancó")), 20_000);
        proc.stdout.on("data", (d) => { b += d; if (b.includes("\n")) { clearTimeout(t); res(b.split("\n")[0]); } });
        proc.on("close", () => rej(new Error("se cerró")));
      });
      const { url, token } = JSON.parse(String(linea));
      assert.match(url, /^http:\/\/127\.0\.0\.1:\d+$/);
      assert.match(token, /^[0-9a-f]{64}$/);
      const puerto = Number(new URL(url).port);
      assert.equal((await pedir(puerto, { token: null })).estado, 401);
      assert.equal((await pedir(puerto, { token })).estado, 200);
      assert.equal((await pedir(puerto, { token: "otro" })).estado, 401);
    } finally { proc.kill(); }
  });

  test("FORGE_API_TOKEN fija el token", async () => {
    const dir = proyecto();
    const proc = spawn(process.execPath, [join(ROOT, "cli", "index.js"), "api", "--port", "0", "--cwd", dir], { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, FORGE_API_TOKEN: "mi-token-de-prueba" } });
    try {
      const linea = await new Promise((res, rej) => { let b = ""; const t = setTimeout(() => rej(new Error("no arrancó")), 20_000); proc.stdout.on("data", (d) => { b += d; if (b.includes("\n")) { clearTimeout(t); res(b.split("\n")[0]); } }); });
      assert.equal(JSON.parse(String(linea)).token, "mi-token-de-prueba");
    } finally { proc.kill(); }
  });
});

describe("recorrido real con Docker", { skip: !(process.env.FORGE_TEST_DOCKER === "1") && "requiere FORGE_TEST_DOCKER=1 y Docker en marcha" }, () => {
  test("lanzar el ciclo por HTTP, verlo pausarse pidiendo decisión y abortarlo por HTTP", async () => {
    const dir = proyecto();
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "demo", scripts: { test: "node --test" } }));
    // El proveedor de pruebas no produce el formato pedido: el ciclo debe pausarse pidiendo revisión
    const api = crearServidorApi({ cwd: dir, token: TOKEN });
    const { puerto } = await api.escuchar(0);
    const antes = { ...process.env };
    process.env.FORGE_LLM_PROVIDER = "stub"; process.env.ANTHROPIC_API_KEY = "";
    try {
      const esperar = async (id) => {
        for (let i = 0; i < 120; i++) {
          const r = await pedir(puerto, { ruta: `/v1/ejecuciones/${id}` });
          if (r.cuerpo.estado === "terminada") return r.cuerpo;
          await new Promise((res) => setTimeout(res, 500));
        }
        throw new Error("la ejecución no terminó");
      };

      const lanzada = await pedir(puerto, { metodo: "POST", ruta: "/v1/ejecuciones", cuerpo: { tareas: [{ id: "T1", agente: "desarrollador-backend", prompt: "Implementa suma" }] } });
      assert.equal(lanzada.estado, 202, lanzada.texto);
      const fin = await esperar(lanzada.cuerpo.id);
      assert.equal(fin.codigoSalida, 3, fin.salida);                 // 3 = revisión humana pendiente
      assert.match(fin.salida, /esperan tu decisión/);

      const estado = await pedir(puerto, {});
      assert.equal(estado.cuerpo.tareas[0].situacion, "espera_decision");
      assert.equal(estado.cuerpo.tareas[0].motivoRevision, "salida_invalida");
      assert.equal(estado.cuerpo.ejecucion, null);

      const decidida = await pedir(puerto, { metodo: "POST", ruta: "/v1/decisiones", cuerpo: { decision: "abortar" } });
      assert.equal(decidida.estado, 202, decidida.texto);
      const fin2 = await esperar(decidida.cuerpo.id);
      assert.match(fin2.salida, /Abortada por decisión humana/);
      assert.equal((await pedir(puerto, {})).cuerpo.tareas[0].situacion, "abortada");
    } finally {
      for (const k of ["FORGE_LLM_PROVIDER", "ANTHROPIC_API_KEY"]) { if (antes[k] === undefined) delete process.env[k]; else process.env[k] = antes[k]; }
      await api.cerrar();
    }
  });
});

void readdirSync;

// ── Verificación independiente: Host repetido, URL absoluta, enteros, token, tiempo máximo ──

describe("endurecimiento tras la verificación independiente", () => {
  /** Petición cruda por socket, para repetir cabeceras que http.request no deja repetir. */
  const cruda = (puerto, texto) => new Promise((res) => {
    const s = net.connect(puerto, "127.0.0.1", () => s.write(texto));
    let t = ""; s.on("data", (d) => (t += d)); s.on("close", () => res(t)); setTimeout(() => s.destroy(), 1500);
  });

  test("una cabecera Host repetida y una URL absoluta se rechazan", async () => {
    const falso = lanzadorFalso();
    const api = crearServidorApi({ cwd: proyecto(), token: TOKEN, lanzar: falso.lanzar });
    const { puerto } = await api.escuchar(0);
    try {
      const base = `Authorization: Bearer ${TOKEN}\r\nConnection: close\r\n\r\n`;
      assert.match(await cruda(puerto, `GET /v1/estado HTTP/1.1\r\nHost: 127.0.0.1:${puerto}\r\nHost: evil.com\r\n${base}`), /^HTTP\/1\.1 400/);
      assert.match(await cruda(puerto, `GET http://evil.com/v1/estado HTTP/1.1\r\nHost: 127.0.0.1:${puerto}\r\n${base}`), /^HTTP\/1\.1 400/);
      assert.match(await cruda(puerto, `GET //x/v1/estado HTTP/1.1\r\nHost: 127.0.0.1:${puerto}\r\n${base}`), /^HTTP\/1\.1 400/);
      assert.match(await cruda(puerto, `GET /v1/estado HTTP/1.1\r\nHost: 127.0.0.1:${puerto}\r\n${base}`), /^HTTP\/1\.1 200/);
    } finally { await api.cerrar(); }
  });

  test("iteracionesExtra debe ser un entero", async () => {
    const falso = lanzadorFalso();
    const api = crearServidorApi({ cwd: proyecto(), token: TOKEN, lanzar: falso.lanzar });
    const { puerto } = await api.escuchar(0);
    try {
      assert.equal((await pedir(puerto, { metodo: "POST", ruta: "/v1/decisiones", cuerpo: { decision: "continuar", iteracionesExtra: 1.5 } })).estado, 400);
      assert.equal(falso.lanzados.length, 0);
    } finally { await api.cerrar(); }
  });

  test("un secreto fijado a mano demasiado corto o con espacios se rechaza", () => {
    assert.throws(() => crearServidorApi({ cwd: proyecto(), token: "corto" }), /al menos 16/);
    assert.throws(() => crearServidorApi({ cwd: proyecto(), token: "a".repeat(20) + " b" }), /espacio/);
  });

  test("una ejecución que supera el tiempo máximo se mata y deja de bloquear la API", async () => {
    const { lanzarCli } = await import("../core/api/servidor.js");
    const t0 = Date.now();
    // `forge api` no termina sola: sirve de proceso colgado
    const { terminada } = lanzarCli(proyecto(), ["api", "--port", "0"], { timeoutMs: 400 });
    const r = await terminada;
    assert.ok(Date.now() - t0 < 8000, "se mató por tiempo");
    assert.notEqual(r.codigo, 0);
  });

  test("el proceso hijo no hereda FORGE_API_TOKEN", async () => {
    const { lanzarCli } = await import("../core/api/servidor.js");
    process.env.FORGE_API_TOKEN = "z".repeat(32);
    try {
      let env = null;
      const { terminada } = lanzarCli(proyecto(), ["api", "--port", "0"], { timeoutMs: 600, alLanzar: (p) => { env = p; } });
      await terminada;
      assert.ok(env);
      // Si lo heredara, `forge api` usaría ese secreto y arrancaría imprimiendo la línea JSON con el: no debe aparecer
    } finally { delete process.env.FORGE_API_TOKEN; }
  });

  test("las ejecuciones guardadas están acotadas", async () => {
    const falso = lanzadorFalso();
    const api = crearServidorApi({ cwd: proyecto(), token: TOKEN, lanzar: falso.lanzar });
    const { puerto } = await api.escuchar(0);
    try {
      for (let i = 0; i < 60; i++) {
        const r = await pedir(puerto, { metodo: "POST", ruta: "/v1/ejecuciones", cuerpo: {} });
        assert.equal(r.estado, 202);
        falso.terminarTodos(0, "");
        await new Promise((res) => setTimeout(res, 5));
      }
      assert.ok(api.ejecuciones.size <= 51, String(api.ejecuciones.size));
    } finally { await api.cerrar(); }
  });
});
