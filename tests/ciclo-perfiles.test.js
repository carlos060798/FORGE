// @ts-check
/**
 * Perfiles de rol del ciclo (spec 2026-10-14-perfiles-de-agente, primera entrega).
 * Un perfil por ROL del nodo (planner, qa, coder), en código; el proyecto solo puede apretar; al reanudar
 * manda la intersección de lo guardado y lo nuevo; el diario no se salta el perfil.
 */

import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { POR_DEFECTO } from "../core/ciclo/config.js";
import { ESQUEMAS_HERRAMIENTAS, crearHerramientasCoder } from "../core/ciclo/herramientas-coder.js";
import { CicloVerificado } from "../core/ciclo/index.js";
import { ErrorPerfil, HERRAMIENTAS_CODER, intersectar, perfilPorDefecto, resolverPerfil } from "../core/ciclo/perfiles.js";
import { aplicarArchivos } from "../core/ciclo/protocolo-archivos.js";
import { validarEstado } from "../core/ciclo/estado.js";
import { comprobarConversacion } from "../core/llm-providers/stub-provider.js";
import { sesionSellada } from "../core/ciclo/sello.js";

const tmp = (p) => mkdtempSync(join(tmpdir(), p));
const escribir = (dir, ruta, contenido) => { mkdirSync(join(dir, ruta, ".."), { recursive: true }); writeFileSync(join(dir, ruta), contenido); };
const leer = (dir, ruta) => readFileSync(join(dir, ruta), "utf8");

const PLAN = '{"pasos":["x"],"archivosObjetivo":["src/a.js"]}';
const PRUEBAS = '```json\n{"archivos":[{"ruta":"tests/a.test.js","contenido":"import \'../src/a.js\';\\n"}]}\n```';
const BLOQUE = '```json\n{"archivos":[{"ruta":"src/nuevo.js","contenido":"export const n = 1;\\n"}]}\n```';
const TAREA = { id: "T1", agente: "desarrollador-backend", prompt: "Haz algo", archivos: ["src/a.js"] };
const PASA = { exitCode: 0, stdout: "# tests 1\n# pass 1\n" };
const FALLA = { exitCode: 1, stdout: "# tests 1\n# fail 1\n" };
const MODELO = "claude-sonnet-4-6";

let ids = 0;
const uso = (nombre, entrada = {}) => ({ tipo: "uso_herramienta", id: `uso_${++ids}`, nombre, entrada });
const pide = (...usos) => ({ contenido: [{ tipo: "texto", texto: "Sigo." }, ...usos] });
const TERMINA = { contenido: [{ tipo: "texto", texto: "He terminado." }] };
const CORTE = () => { throw new Error("CORTE"); };
const EDITA = uso("editar", { ruta: "src/nuevo.js", contenido: "export const n = 1;\n" });

/** Un proyecto con un ciclo guionizado. `yaml`: contenido de .sdd/sdd.config.yaml. */
function entorno({ turnos = [], ejecuciones = [], motor = {}, yaml = "", bloque = [BLOQUE], pruebas = [PRUEBAS] } = {}) {
  const cwd = tmp("forge-perfiles-");
  escribir(cwd, "package.json", JSON.stringify({ name: "p", type: "module", scripts: { test: "node --test" } }));
  escribir(cwd, "src/a.js", "export const a = 1;\n");
  mkdirSync(join(cwd, ".sdd", "motor"), { recursive: true });
  writeFileSync(join(cwd, ".sdd", "motor", "sesion.json"), JSON.stringify(sesionSellada({ runId: "r1", modo: "ciclo", creada: "2026-10-09T00:00:00Z" })));
  if (yaml) escribir(cwd, ".sdd/sdd.config.yaml", yaml);
  const e = {
    cwd, turnos: [...turnos], colaEjecuciones: [...ejecuciones],
    /** @type {any[]} */ conversaciones: [], /** @type {any[]} */ eventos: [],
    guion: { arquitecto: [PLAN], tester: [...pruebas], "desarrollador-backend": [...bloque] },
    nuevoCiclo(/** @type {any} */ cambios = {}) {
      const opciones = {
        cwd, runId: "r1", testCmd: "npm test",
        config: { ...POR_DEFECTO, motor: { ...POR_DEFECTO.motor, grafo: "propio", mutacion: "no", implementador: "turnos", ...motor, ...cambios.motor } },
        log: { append: (type, payload, meta) => { e.eventos.push({ type, payload, meta }); } },
        aliasDe: () => "sonnet",
        llamar: async (p) => {
          const s = e.guion[p.agente]?.shift();
          if (s === undefined) throw new Error(`guion agotado para ${p.agente}`);
          return { ok: true, output: s, inputTokens: 100, outputTokens: 10, modelo: MODELO, proveedor: "anthropic" };
        },
        admiteHerramientas: () => true,
        conversar: async (p) => {
          comprobarConversacion(p.mensajes);
          const paso = e.turnos.shift();
          if (paso === undefined) throw new Error("guion de turnos agotado");
          const r = typeof paso === "function" ? paso(p, e.conversaciones.length + 1) : paso;
          e.conversaciones.push(JSON.parse(JSON.stringify(p)));
          return { ok: true, stopReason: r.contenido?.some((b) => b.tipo === "uso_herramienta") ? "herramientas" : "fin", inputTokens: 1000, outputTokens: 50, modelo: MODELO, proveedor: "anthropic", ...r };
        },
        runner: { test: async () => {
          const r = e.colaEjecuciones.shift();
          if (r === undefined) throw new Error("guion de ejecuciones agotado");
          return { stdout: "", stderr: "", timedOut: false, infraError: false, durationMs: 1, ...r };
        } },
      };
      return new CicloVerificado(/** @type {any} */ (opciones));
    },
  };
  return e;
}
const tipos = (e, tipo) => e.eventos.filter((ev) => ev.type === tipo);
const resultadosDe = (mensaje) => mensaje.contenido.filter((b) => b.tipo === "resultado_herramienta");

const VARIABLES = ["FRAGUA_PERFIL_CODER_PASOS_MAX", "FRAGUA_PERFIL_CODER_HERRAMIENTAS", "FRAGUA_PERFIL_QA_RUTAS_ESCRIBIR"];
afterEach(() => { for (const v of VARIABLES) delete process.env[v]; });

describe("Regresión: sin perfiles configurados el ciclo es el de siempre", () => {
  test("los tres roles tienen el perfil del comportamiento actual y el estado lo registra", async () => {
    const e = entorno({ turnos: [pide(EDITA), TERMINA], ejecuciones: [FALLA, PASA] });
    const r = await e.nuevoCiclo().ejecutar(TAREA);
    assert.equal(r.estado.resultado, "exito");
    const p = /** @type {any} */ (r.estado).perfiles;
    assert.deepEqual(Object.keys(p).sort(), ["coder", "planner", "qa"]);
    assert.deepEqual(p.planner.herramientas, []);
    assert.equal(p.planner.rutasEscribir.clase, "ninguna");
    assert.deepEqual(p.qa.herramientas, []);
    assert.equal(p.qa.rutasEscribir.clase, "pruebas");
    assert.deepEqual(p.coder.herramientas, [...HERRAMIENTAS_CODER]);
    assert.equal(p.coder.rutasEscribir.clase, "no_pruebas");
    assert.equal(p.coder.rutasEscribir.prefijos, null);
    assert.deepEqual(validarEstado(r.estado), []);
    // Las cinco herramientas, idénticas a las de siempre
    assert.deepEqual(e.conversaciones[0].herramientas.map((h) => h.nombre), ESQUEMAS_HERRAMIENTAS.map((h) => h.nombre));
    assert.equal(tipos(e, "ciclo:perfil_resuelto").length, 3, "un evento por rol, la primera vez");
    assert.equal(tipos(e, "ciclo:perfil_ampliacion_ignorada").length, 0);
  });

  test("modo de bloque: el mismo resultado", async () => {
    const e = entorno({ motor: { implementador: "bloque" }, ejecuciones: [FALLA, PASA] });
    const r = await e.nuevoCiclo().ejecutar(TAREA);
    assert.equal(r.estado.resultado, "exito");
    assert.equal(leer(e.cwd, "src/nuevo.js"), "export const n = 1;\n");
  });
});

describe("perfiles.js — capas y propiedades", () => {
  test("el perfil por defecto de cada rol es el del código y nadie puede tocar el original", () => {
    const c = perfilPorDefecto("coder");
    c.herramientas.push("x");
    assert.deepEqual(perfilPorDefecto("coder").herramientas, [...HERRAMIENTAS_CODER]);
    assert.throws(() => perfilPorDefecto("arquitecto"), ErrorPerfil);
  });

  test("propiedad: el efectivo nunca supera al techo ni a ninguna capa, pida lo que pida el proyecto", () => {
    const pedidos = [
      { herramientas: "leer_archivo,editar" }, { herramientas: "leer_archivo,editar,buscar,listar,ejecutar_pruebas" },
      { pasos_max: "5" }, { pasos_max: "500" }, { pruebas_max: "0" }, { pruebas_max: "9999" },
      { contexto_max_bytes: "1000" }, { contexto_max_bytes: "999999999" },
      { rutas_escribir: "src/" }, { rutas_escribir: "src/,lib/a.js" },
    ];
    for (const rol of ["planner", "qa", "coder"]) {
      const techo = perfilPorDefecto(rol);
      for (const usuario of [{}, { pasos_max: "10" }, { herramientas: "leer_archivo" }]) {
        for (const pedido of pedidos) {
          const { perfil: base } = resolverPerfil(rol, { cwd: "x", proyecto: {}, usuario });
          const { perfil } = resolverPerfil(rol, { cwd: "x", proyecto: { [rol]: pedido }, usuario });
          const cruce = intersectar(perfil, base);
          assert.deepEqual(cruce, perfil, `${rol} ${JSON.stringify(usuario)} ${JSON.stringify(pedido)}: el proyecto aflojó algo`);
          assert.ok(perfil.herramientas.every((h) => techo.herramientas.includes(h)));
          assert.ok(perfil.pasosMax <= techo.pasosMax && perfil.pruebasMax <= techo.pruebasMax && perfil.contextoMaxBytes <= techo.contextoMaxBytes);
        }
      }
    }
  });

  test("el proyecto no amplía lo que el usuario recortó: se ignora y se avisa", () => {
    const r = resolverPerfil("coder", {
      cwd: "x", usuario: { herramientas: "leer_archivo,editar", pasos_max: "10" },
      proyecto: { coder: { herramientas: "leer_archivo,editar,buscar", pasos_max: "50" } },
    });
    assert.deepEqual(r.perfil.herramientas, ["leer_archivo", "editar"]);
    assert.equal(r.perfil.pasosMax, 10);
    assert.deepEqual(r.avisos.map((a) => `${a.capa}:${a.campo}`).sort(), ["proyecto:herramientas", "proyecto:pasos_max"]);
  });

  test("el usuario (entorno) puede mover dentro del techo, no por encima", () => {
    const r = resolverPerfil("coder", { cwd: "x", proyecto: {}, usuario: { pasos_max: "300" } });
    assert.equal(r.perfil.pasosMax, 200);
    assert.equal(r.avisos[0].capa, "usuario");
  });

  test("falla cerrado: herramienta inexistente, valor mal formado o clave desconocida", () => {
    assert.throws(() => resolverPerfil("coder", { cwd: "x", proyecto: { coder: { herramientas: "leer_archivo,Bash" } } }), /herramienta desconocida "Bash"/);
    assert.throws(() => resolverPerfil("coder", { cwd: "x", proyecto: { coder: { pasos_max: "muchos" } } }), /pasos_max/);
    assert.throws(() => resolverPerfil("coder", { cwd: "x", proyecto: { coder: { rutas_escribir: "../fuera" } } }), /relativa/);
    const cwd = tmp("forge-perfiles-clave-");
    escribir(cwd, ".sdd/sdd.config.yaml", "perfiles:\n  coder_herramientsa: editar\n");
    assert.throws(() => resolverPerfil("coder", { cwd }), /clave desconocida/);
  });
});

describe("aplicarArchivos — rutas escribibles del perfil", () => {
  const prep = () => { const cwd = tmp("forge-perfiles-ap-"); escribir(cwd, "src/a.js", "x\n"); return cwd; };
  const sin = { politicaDestinos: [] };

  test("un tester que intenta escribir una ruta que no es de pruebas es rechazado", () => {
    const cwd = prep();
    const r = aplicarArchivos(cwd, [{ ruta: "src/a.js", contenido: "hack\n" }, { ruta: "tests/a.test.js", contenido: "ok\n" }], { rol: "qa", ...sin });
    assert.deepEqual(r.rechazados.map((x) => `${x.ruta}:${x.motivo}`), ["src/a.js:no_es_prueba"]);
    assert.equal(leer(cwd, "src/a.js"), "x\n");
    assert.equal(r.escritos.length, 1);
  });

  test("rutasEscribir: lo que queda fuera del perfil se rechaza con fuera_de_perfil, y [] no deja escribir nada", () => {
    const cwd = prep();
    const r = aplicarArchivos(cwd, [{ ruta: "src/b.js", contenido: "1\n" }, { ruta: "lib/c.js", contenido: "2\n" }], { rol: "coder", rutasEscribir: ["src/"], ...sin });
    assert.deepEqual(r.escritos.map((x) => x.ruta), ["src/b.js"]);
    assert.deepEqual(r.rechazados.map((x) => `${x.ruta}:${x.motivo}`), ["lib/c.js:fuera_de_perfil"]);
    const v = aplicarArchivos(cwd, [{ ruta: "src/d.js", contenido: "1\n" }], { rol: "coder", rutasEscribir: [], ...sin });
    assert.deepEqual(v.rechazados.map((x) => x.motivo), ["fuera_de_perfil"]);
    assert.ok(!existsSync(join(cwd, "src/d.js")));
  });

  test("un prefijo sin barra final es un archivo exacto, no una carpeta con ese prefijo", () => {
    const cwd = prep();
    const r = aplicarArchivos(cwd, [{ ruta: "src/a.js.bak", contenido: "1\n" }, { ruta: "src/a.js", contenido: "2\n" }], { rol: "coder", rutasEscribir: ["src/a.js"], ...sin });
    assert.deepEqual(r.escritos.map((x) => x.ruta), ["src/a.js"]);
    assert.deepEqual(r.rechazados.map((x) => x.motivo), ["fuera_de_perfil"]);
  });
});

describe("herramientas-coder — el perfil las hace imposibles", () => {
  const base = (cwd, extra = {}) => crearHerramientasCoder({ cwd, respaldo: { registrar() {} }, runner: { test: async () => ({ exitCode: 0 }) }, log: { append() {} }, politicaDestinos: [], ...extra });

  test("sin perfil: las cinco herramientas de siempre", () => {
    assert.deepEqual(base(tmp("forge-perfiles-h-")).esquemas.map((x) => x.nombre), ESQUEMAS_HERRAMIENTAS.map((x) => x.nombre));
  });

  test("con un perfil que prohíbe buscar y editar: no se ofrecen y ejecutar las rechaza aunque el modelo las pida", async () => {
    const cwd = tmp("forge-perfiles-h-");
    escribir(cwd, "src/a.js", "export const a = 1;\n");
    const h = base(cwd, { perfil: { herramientas: ["leer_archivo", "listar"], rutasEscribir: null } });
    assert.deepEqual(h.esquemas.map((x) => x.nombre), ["leer_archivo", "listar"]);
    const r = await h.ejecutar("buscar", { texto: "a" });
    assert.equal(r.error, true);
    assert.match(r.texto, /no está disponible/);
    const w = await h.ejecutar("editar", { ruta: "src/a.js", contenido: "hack\n" });
    assert.equal(w.error, true);
    assert.equal(leer(cwd, "src/a.js"), "export const a = 1;\n");
    assert.equal((await h.ejecutar("leer_archivo", { ruta: "src/a.js" })).error, false);
  });

  test("editar respeta las rutas escribibles del perfil", async () => {
    const cwd = tmp("forge-perfiles-h-");
    const h = base(cwd, { perfil: { herramientas: [...HERRAMIENTAS_CODER], rutasEscribir: ["src/"] } });
    assert.equal((await h.ejecutar("editar", { ruta: "src/ok.js", contenido: "1\n" })).error, false);
    const r = await h.ejecutar("editar", { ruta: "lib/no.js", contenido: "2\n" });
    assert.equal(r.error, true);
    assert.match(r.texto, /perfil/);
    assert.ok(!existsSync(join(cwd, "lib/no.js")));
  });
});

describe("En el ciclo: lo que el proyecto aprieta se cumple", () => {
  test("un perfil que prohíbe una herramienta la hace imposible aunque el modelo la pida", async () => {
    const e = entorno({
      yaml: "perfiles:\n  coder_herramientas: leer_archivo,listar,editar,ejecutar_pruebas\n",
      turnos: [pide(uso("buscar", { texto: "a" })), pide(EDITA), TERMINA], ejecuciones: [FALLA, PASA],
    });
    const r = await e.nuevoCiclo().ejecutar(TAREA);
    assert.equal(r.estado.resultado, "exito");
    assert.ok(!e.conversaciones[0].herramientas.some((h) => h.nombre === "buscar"), "no se ofreció");
    const res = resultadosDe(e.conversaciones[1].mensajes[2])[0];
    assert.equal(res.esError, true);
    assert.match(res.contenido, /no está disponible/);
  });

  test("motor.turnos_max y el perfil: manda el más estricto", async () => {
    const e = entorno({
      yaml: "perfiles:\n  coder_pasos_max: 2\n",
      turnos: [pide(EDITA), pide(uso("listar", {})), pide(uso("listar", {})), TERMINA], ejecuciones: [FALLA, PASA],
    });
    const r = await e.nuevoCiclo().ejecutar(TAREA);
    assert.equal(r.estado.resultado, "exito");
    assert.equal(e.conversaciones.length, 2, "dos turnos como mucho");
    assert.match(e.conversaciones[0].mensajes[0].contenido, /Como máximo 2 turnos/);
    assert.equal(tipos(e, "ciclo:turnos_agotados").length, 1);
  });

  test("un proyecto que intenta AFLOJAR (más pasos que el techo, más herramientas que el usuario) se ignora con aviso", async () => {
    process.env.FRAGUA_PERFIL_CODER_HERRAMIENTAS = "leer_archivo,editar,ejecutar_pruebas";
    const e = entorno({
      yaml: "perfiles:\n  coder_pasos_max: 500\n  coder_herramientas: leer_archivo,editar,buscar,ejecutar_pruebas\n",
      turnos: [pide(EDITA), TERMINA], ejecuciones: [FALLA, PASA],
    });
    const r = await e.nuevoCiclo().ejecutar(TAREA);
    assert.equal(r.estado.resultado, "exito");
    assert.deepEqual(e.conversaciones[0].herramientas.map((h) => h.nombre), ["leer_archivo", "editar", "ejecutar_pruebas"]);
    assert.match(e.conversaciones[0].mensajes[0].contenido, /Como máximo 30 turnos/, "motor.turnos_max sigue mandando");
    const avisos = tipos(e, "ciclo:perfil_ampliacion_ignorada").map((ev) => `${ev.payload.capa}:${ev.payload.campo}`).sort();
    assert.deepEqual(avisos, ["proyecto:herramientas", "proyecto:pasos_max"]);
  });

  test("un tester no escribe fuera de las rutas de pruebas que el perfil le deja (modo de bloque)", async () => {
    const MALA = '```json\n{"archivos":[{"ruta":"src/a.js","contenido":"hack\\n"}]}\n```';
    const e = entorno({ motor: { implementador: "bloque" }, pruebas: [MALA] });
    const r = await e.nuevoCiclo().ejecutar(TAREA);
    assert.equal(r.estado.resultado, "revision_pendiente");
    assert.equal(r.estado.revision?.motivo, "salida_invalida");
    assert.equal(leer(e.cwd, "src/a.js"), "export const a = 1;\n");
    assert.deepEqual(tipos(e, "ciclo:escritura_rechazada").map((x) => x.payload.motivo), ["no_es_prueba"]);

    const e2 = entorno({
      motor: { implementador: "bloque" }, yaml: "perfiles:\n  qa_rutas_escribir: tests/unitarias/\n", ejecuciones: [],
    });
    const r2 = await e2.nuevoCiclo().ejecutar(TAREA);
    assert.equal(r2.estado.revision?.motivo, "salida_invalida");
    assert.deepEqual(tipos(e2, "ciclo:escritura_rechazada").map((x) => x.payload.motivo), ["fuera_de_perfil"]);
  });

  test("un implementador en modo de bloque no escribe fuera de las rutas del perfil", async () => {
    const e = entorno({ motor: { implementador: "bloque" }, yaml: "perfiles:\n  coder_rutas_escribir: lib/\n", ejecuciones: [FALLA] });
    const r = await e.nuevoCiclo().ejecutar(TAREA);
    assert.equal(r.estado.revision?.motivo, "salida_invalida");
    assert.deepEqual(tipos(e, "ciclo:escritura_rechazada").map((x) => x.payload), [{ nodo: "coder", ruta: "src/nuevo.js", motivo: "fuera_de_perfil" }]);
    assert.ok(!existsSync(join(e.cwd, "src/nuevo.js")));
  });

  test("un perfil irresoluble falla cerrado: revisión antes de llamar a ningún modelo", async () => {
    const e = entorno({ yaml: "perfiles:\n  planner_herramientsa: editar\n" });
    const r = await e.nuevoCiclo().ejecutar(TAREA);
    assert.equal(r.estado.resultado, "revision_pendiente");
    assert.equal(r.estado.revision?.motivo, "perfil");
    assert.match(String(r.estado.revision?.detalle), /clave desconocida/);
    assert.equal(e.guion.arquitecto.length, 1, "no se gastó ninguna llamada");
  });
});

describe("Reanudación", () => {
  /** Primera vuelta completa del implementador (que falla) y corte a mitad de la segunda. */
  const cortado = (extra = {}) => entorno({
    turnos: [pide(EDITA), TERMINA, pide(uso("buscar", { texto: "n" })), CORTE, pide(uso("editar", { ruta: "src/nuevo.js", contenido: "export const n = 2;\n" })), TERMINA],
    ejecuciones: [FALLA, FALLA, PASA], ...extra,
  });

  test("reanudar con un perfil más estrecho pide revisión (motivo perfil) y deja guardado el estrecho", async () => {
    const e = cortado();
    await assert.rejects(e.nuevoCiclo().ejecutar(TAREA), /CORTE/);
    const llamadas = e.conversaciones.length;
    escribir(e.cwd, ".sdd/sdd.config.yaml", "perfiles:\n  coder_herramientas: leer_archivo,editar\n");
    const r = await e.nuevoCiclo().ejecutar(TAREA);
    assert.equal(r.estado.resultado, "revision_pendiente");
    assert.equal(r.estado.revision?.motivo, "perfil");
    assert.equal(r.estado.revision?.reanudarEn, "coder");
    assert.match(String(r.estado.revision?.detalle), /herramientas/);
    assert.equal(e.conversaciones.length, llamadas, "no se pidió ningún turno más");
    assert.deepEqual(/** @type {any} */ (r.estado).perfiles.coder.herramientas, ["leer_archivo", "editar"]);
    assert.equal(tipos(e, "ciclo:perfil_cambiado").length, 1);
  });

  test("un proyecto que afloja entre cortes no consigue nada: manda lo guardado, con aviso", async () => {
    const e = cortado({ yaml: "perfiles:\n  coder_pasos_max: 5\n" });
    await assert.rejects(e.nuevoCiclo().ejecutar(TAREA), /CORTE/);
    writeFileSync(join(e.cwd, ".sdd", "sdd.config.yaml"), "perfiles:\n  coder_pasos_max: 100\n");
    const r = await e.nuevoCiclo().ejecutar(TAREA);
    assert.equal(r.estado.resultado, "exito");
    assert.equal(/** @type {any} */ (r.estado).perfiles.coder.pasosMax, 5);
    assert.ok(tipos(e, "ciclo:perfil_ampliacion_ignorada").some((ev) => ev.payload.capa === "reanudacion" || ev.payload.capa === "proyecto"));
  });

  test("reanudar desde el diario no se salta el perfil: un uso ya anotado que el perfil nuevo prohíbe pide revisión", async () => {
    // Corte en el primer intento del implementador: aún no hay punto guardado del nodo, solo el diario
    const e = entorno({ turnos: [pide(uso("buscar", { texto: "a" })), CORTE, TERMINA], ejecuciones: [FALLA] });
    await assert.rejects(e.nuevoCiclo().ejecutar(TAREA), /CORTE/);
    escribir(e.cwd, ".sdd/sdd.config.yaml", "perfiles:\n  coder_herramientas: leer_archivo,listar,editar,ejecutar_pruebas\n");
    const antes = e.conversaciones.length;
    const r = await e.nuevoCiclo().ejecutar(TAREA);
    assert.equal(r.estado.resultado, "revision_pendiente");
    assert.equal(r.estado.revision?.motivo, "perfil");
    assert.match(String(r.estado.revision?.detalle), /buscar/);
    assert.equal(e.conversaciones.length, antes, "no se pidió otro turno al modelo");
  });

  test("un hilo guardado sin perfiles (anterior a esta entrega) sigue como siempre", () => {
    assert.deepEqual(validarEstado({ ...estadoMinimo() }), []);
  });
});

function estadoMinimo() {
  return {
    schemaVersion: "1.0", runId: "r", threadId: "t", taskId: "T1", cwd: "/x",
    tarea: { id: "T1", descripcion: "x", agente: "a", archivos: [], cas: [] }, plan: null, contexto: null,
    pruebas: { archivos: [], comando: "" }, implementacion: { archivos: [] }, ejecuciones: [], iteracion: 0, maxIteraciones: 3,
    presupuesto: { tope_usd: 2, umbral_degradacion_usd: 1.5, gastado_usd: 0, estado: "ok", llamadas: 0, tokens_in: 0, tokens_out: 0 },
    revision: null, resultado: "en_curso",
  };
}
