// @ts-check
/**
 * Revisión independiente nº 1, H-7 y H-8:
 *   H-7  un `proyecto.lock` plantado por el repo no deja el servidor «ocupado» ni gasta cupo
 *   H-8  el contador de cupos tiene candado propio: dos procesos a la vez no cuentan de menos
 */
import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync, utimesSync, realpathSync } from "node:fs";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { crearHerramientas } from "../core/mcp/herramientas.js";
import { crearHerramientaVerificar } from "../core/mcp/herramientas-verificar.js";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const base = realpathSync(mkdtempSync(join(tmpdir(), "forge-mcp-candado-")));
after(() => rmSync(base, { recursive: true, force: true }));
let n = 0;
const nuevoProyecto = () => { const d = join(base, `p${++n}`, "proyecto"); mkdirSync(join(d, ".sdd", "motor"), { recursive: true }); return d; };
const plantar = (cwd, cuerpo, mtimeMs) => {
  const ruta = join(cwd, ".sdd", "motor", "proyecto.lock");
  writeFileSync(ruta, JSON.stringify(cuerpo));
  const t = new Date(mtimeMs);
  utimesSync(ruta, t, t);
};
/** @returns {string|null} */
const buscar = (d) => { if (!existsSync(d)) return null; for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) { const r = buscar(p); if (r) return r; } else if (e.name === "cupos.json") return p; } return null; };
const runnerOk = { test: async () => ({ exitCode: 0, stdout: "", stderr: "", timedOut: false, infraError: false, durationMs: 5 }) };

describe("H-7: un candado plantado por el repo", () => {
  test("ejecutar_pruebas: un candado con pid vivo cuyo archivo es mucho más viejo que su marca de tiempo es falso y se retira", async () => {
    const cwd = nuevoProyecto();
    // El repo lo trae con la marca «de ahora», pero el archivo salió del clon hace una hora
    plantar(cwd, { pid: process.ppid, ts: Date.now() }, Date.now() - 3_600_000);
    const h = Object.fromEntries(crearHerramientas({ cwd, runner: runnerOk }).map((x) => [x.name, x]));
    const r = await h.ejecutar_pruebas.ejecutar({});
    assert.equal(r.error, undefined, r.texto);
    assert.match(r.texto, /PASAN/);
  });

  test("un candado real de otro proceso vivo (archivo y marca coinciden) sigue respondiendo «ocupado»", async () => {
    const cwd = nuevoProyecto();
    const vivo = spawn(process.execPath, ["-e", "setTimeout(() => {}, 30000)"], { stdio: "ignore" });
    try {
      plantar(cwd, { pid: vivo.pid, ts: Date.now() }, Date.now());
      const h = Object.fromEntries(crearHerramientas({ cwd, runner: runnerOk }).map((x) => [x.name, x]));
      const r = await h.ejecutar_pruebas.ejecutar({});
      assert.equal(r.error, true);
      assert.match(r.texto, /ocupado/);
    } finally { vivo.kill(); }
  });

  test("verificar: un candado falso no deja «ocupado»; uno real ocupado NO gasta cupo", async () => {
    const cwd = nuevoProyecto();
    const home = join(dirname(cwd), "home");
    const env = { FRAGUA_HOME: home, FRAGUA_MCP_POR_HORA: "5", PATH: process.env.PATH };
    let corridas = 0;
    const herr = crearHerramientaVerificar({ cwd, env, verificarFn: async () => { corridas++; return { formato: 1, veredicto: "pasa", codigoSalida: 0, salida: "" }; }, cli: /** @type {any} */ ({ ejecutar: async () => ({}) }) });
    const cupos = () => { const f = buscar(home); return f ? JSON.parse(readFileSync(f, "utf8")).horas.n : 0; };

    plantar(cwd, { pid: process.ppid, ts: Date.now() }, Date.now() - 3_600_000);
    const falso = await herr.ejecutar({});
    assert.equal(corridas, 1, falso.texto);
    assert.equal(cupos(), 1);

    const vivo = spawn(process.execPath, ["-e", "setTimeout(() => {}, 30000)"], { stdio: "ignore" });
    try {
      plantar(cwd, { pid: vivo.pid, ts: Date.now() }, Date.now());
      const ocupado = await herr.ejecutar({});
      assert.equal(ocupado.error, true);
      assert.match(ocupado.texto, /ocupado/);
      assert.equal(corridas, 1);
      assert.equal(cupos(), 1, "un «ocupado» no gasta cupo");
    } finally { vivo.kill(); }
  });
});

describe("H-8: el contador de cupos tiene candado propio", () => {
  test("varios procesos reservando a la vez no cuentan de menos", async () => {
    const home = join(base, "estado-concurrente");
    mkdirSync(home, { recursive: true });
    const guion = join(base, "hijo-cupos.mjs");
    writeFileSync(guion, [
      `import { reservarCupo } from ${JSON.stringify(pathToFileURL(join(RAIZ, "core", "mcp", "limites.js")).href)};`,
      `let ok = 0;`,
      `for (let i = 0; i < 6; i++) { const r = reservarCupo(process.argv[2], { por_hora: 1000, por_dia: 1000 }); if (r.ok) ok++; }`,
      `console.log(ok);`,
    ].join("\n"));
    const hijo = () => new Promise((res) => {
      let salida = "";
      const p = spawn(process.execPath, [guion, home], { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, FRAGUA_HOME: home } });
      p.stdout.on("data", (d) => { salida += d; });
      p.on("close", () => res(Number(salida.trim()) || 0));
    });
    const concedidos = (await Promise.all(Array.from({ length: 6 }, hijo))).reduce((a, b) => a + b, 0);
    const guardado = JSON.parse(readFileSync(join(home, "mcp", "cupos.json"), "utf8")).horas.n;
    assert.equal(guardado, concedidos, "cada cupo concedido queda contado");
    assert.equal(concedidos, 36, "ninguna reserva se pierde");
  });
});
