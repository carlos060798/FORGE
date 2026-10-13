// @ts-check
/**
 * Corte REAL del proceso.
 *
 * Hasta aquí los cortes se simulaban lanzando una excepción dentro del mismo proceso. Aquí el proceso
 * se mata de verdad (SIGKILL; en Windows, TerminateProcess) y otro proceso reanuda. Se comprueba:
 *   - la tarea termina;
 *   - ninguna llamada ya pagada se repite (líneas de `gasto.jsonl` y registro del proveedor);
 *   - no quedan contenedores con la etiqueta de FORGE, ni copias de trabajo, ni `forge-mutacion-*`;
 *   - el candado de «un ciclo a la vez» no queda bloqueado para siempre.
 *
 * Dos niveles (ver tests/fixtures/ciclo-guionizado.mjs):
 *   1. Sin Docker: el mismo código de `forge run` / `forge resume` con un Docker falso
 *      (tests/fixtures/forge-docker-falso.mjs). El corte es igual de real, y corre siempre.
 *   2. Con FORGE_TEST_DOCKER=1: `node cli/index.js run --motor ciclo` y `forge resume`, con Docker
 *      de verdad. La orden `forge` no admite un ejecutor falso por variable de entorno (sería una
 *      puerta para saltarse el aislamiento), así que este nivel necesita Docker.
 *
 * El modelo es el proveedor de pruebas (`stub`) con un guion por reglas: no depende del orden de las
 * llamadas, así que sirve igual para el proceso cortado y para el que reanuda.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";

import { StubProvider } from "../core/llm-providers/stub-provider.js";
import { barrerCopiasDeSesiones, barrerMutacionesDeProcesosMuertos } from "../core/ciclo/restos.js";
import {
  candadoDeProyecto, candados, comprobarFinal, contenedores, copiasDeMutacion, copiasDeTrabajo, dockerActivo, ejecutar, escenario,
  escribirGuion, esperar, estadoDeTarea, eventos, gasto, lanzar, lineas, LLAMADAS_DEL_CICLO, matar, puntos, REGLA, sesionActual, sesiones,
} from "./fixtures/ciclo-guionizado.mjs";

const tmp = (p) => mkdtempSync(join(tmpdir(), p));

// ─── El proveedor de pruebas, guionizado por reglas ───────────────────────────────────────────

describe("proveedor de pruebas — guion por reglas para `complete`", () => {
  const REGLAS = [
    { si: "Descompón la tarea", salida: "PLAN" },
    { si: "Escribe las pruebas", salida: "PRUEBAS", inputTokens: 7, outputTokens: 3 },
  ];

  test("responde con la primera regla que coincide con el prompt de sistema o con el del usuario, sin depender del orden", async () => {
    const p = new StubProvider({ completar: REGLAS });
    assert.deepEqual(await p.complete({ systemPrompt: "Escribe las pruebas", userPrompt: "x" }), { output: "PRUEBAS", inputTokens: 7, outputTokens: 3 });
    assert.deepEqual(await p.complete({ systemPrompt: "s", userPrompt: "Descompón la tarea en pasos" }), { output: "PLAN", inputTokens: 0, outputTokens: 0 });
    // La misma petición da la misma respuesta las veces que haga falta: un proceso que reanuda no «gasta» el guion
    assert.equal((await p.complete({ systemPrompt: "Escribe las pruebas", userPrompt: "x" })).output, "PRUEBAS");
    assert.equal(p.admiteHerramientas, false, "sin guion de conversación sigue sin admitir herramientas");
  });

  test("sin ninguna regla que coincida, responde como siempre", async () => {
    const p = new StubProvider({ completar: REGLAS });
    assert.match((await p.complete({ systemPrompt: "s", userPrompt: "hola" })).output, /^\[stub\]/);
    assert.match((await new StubProvider().complete({ userPrompt: "hola" })).output, /^\[stub\]/);
  });

  test("anota cada llamada (inicio y fin) en el registro, y la demora deja ver la llamada en curso", async () => {
    const registro = join(tmp("forge-stub-"), "llamadas.jsonl");
    const p = new StubProvider({ completar: [{ si: "lenta", salida: "ok", demoraMs: 150 }], registro });
    const t0 = Date.now();
    const enCurso = p.complete({ systemPrompt: "s", userPrompt: "una llamada lenta" });
    await new Promise((r) => setTimeout(r, 30));
    assert.deepEqual(lineas(registro).map((l) => l.fase), ["inicio"], "la llamada se ve antes de que responda");
    await enCurso;
    assert.ok(Date.now() - t0 >= 140, "la demora se respeta");
    const anotadas = lineas(registro);
    assert.deepEqual(anotadas.map((l) => [l.fase, l.regla, l.pid]), [["inicio", 0, process.pid], ["fin", 0, process.pid]]);
    assert.equal(anotadas[0].huella, anotadas[1].huella);
    assert.ok(!("userPrompt" in anotadas[0]), "los prompts no se guardan si no se pide");
  });

  test("con `registrarPrompts`, el registro guarda lo que recibió el proveedor", async () => {
    const registro = join(tmp("forge-stub-"), "llamadas.jsonl");
    const p = new StubProvider({ completar: [{ si: ".", salida: "ok" }], registro, registrarPrompts: true });
    await p.complete({ systemPrompt: "SISTEMA", userPrompt: "USUARIO" });
    assert.deepEqual([lineas(registro)[0].systemPrompt, lineas(registro)[0].userPrompt], ["SISTEMA", "USUARIO"]);
  });

  test("FORGE_STUB_GUION admite un objeto con las reglas; una lista sigue siendo el guion de conversación", async () => {
    const dir = tmp("forge-stub-");
    const previo = process.env.FORGE_STUB_GUION;
    try {
      const archivo = join(dir, "guion.json");
      const registro = join(dir, "llamadas.jsonl");
      writeFileSync(archivo, JSON.stringify({ completar: REGLAS, registro }));
      process.env.FORGE_STUB_GUION = archivo;
      const p = new StubProvider();
      assert.equal((await p.complete({ systemPrompt: "Descompón la tarea", userPrompt: "" })).output, "PLAN");
      assert.equal(lineas(registro).length, 2);
      assert.equal(p.admiteHerramientas, false);

      writeFileSync(archivo, JSON.stringify([{ contenido: [] }]));
      assert.equal(new StubProvider().admiteHerramientas, true);

      writeFileSync(archivo, JSON.stringify({ conversar: [{ contenido: [] }], completar: REGLAS }));
      assert.equal(new StubProvider().admiteHerramientas, true);

      for (const malo of ['"texto"', "7", JSON.stringify({ conversar: "no es una lista" }), JSON.stringify({ completar: "no es una lista" })]) {
        writeFileSync(archivo, malo);
        assert.throws(() => new StubProvider(), /FORGE_STUB_GUION/, malo);
      }
    } finally {
      if (previo === undefined) delete process.env.FORGE_STUB_GUION; else process.env.FORGE_STUB_GUION = previo;
    }
  });

  test("con `hasta`, la llamada no responde mientras no exista el archivo", async () => {
    const dir = tmp("forge-stub-");
    const registro = join(dir, "llamadas.jsonl");
    const p = new StubProvider({ completar: [{ si: ".", salida: "ok", hasta: join(dir, "ya") }], registro });
    let respondida = false;
    const enCurso = p.complete({ systemPrompt: "s", userPrompt: "u" }).then((r) => { respondida = true; return r; });
    await new Promise((r) => setTimeout(r, 120));
    assert.equal(respondida, false);
    assert.deepEqual(lineas(registro).map((l) => l.fase), ["inicio"]);
    writeFileSync(join(dir, "ya"), "");
    assert.equal((await enCurso).output, "ok");
    assert.deepEqual(lineas(registro).map((l) => l.fase), ["inicio", "fin"]);
  });
});

// ─── Lo que deja un proceso cortado, y quién lo recoge ────────────────────────────────────────

describe("restos de un ciclo cortado — barridos al empezar el siguiente", () => {
  /** Un proceso que ya terminó: su pid no existe. */
  function pidMuerto() {
    const r = spawnSync(process.execPath, ["-e", "process.stdout.write(String(process.pid))"], { encoding: "utf8" });
    return Number(r.stdout);
  }
  /** Carpeta como las que crea la medición por mutación: nombre, marca con el pid y una copia dentro. */
  /** La marca real que escribe la medición: JSON con la clave de FORGE, un nonce y el pid (N4-01). */
  const marcaReal = (pid) => JSON.stringify({ forge: "mutacion", nonce: "0123456789abcdef0123456789abcdef", pid, creada: "2026-10-10T00:00:00.000Z" }) + "\n";
  function copiaDeMutacion(dir, nombre, marca) {
    mkdirSync(join(dir, nombre, "copia", "src"), { recursive: true });
    writeFileSync(join(dir, nombre, "copia", "src", "a.js"), "export const a = 1;\n");
    if (marca !== undefined) writeFileSync(join(dir, nombre, ".forge-mutacion"), marca);
    return join(dir, nombre);
  }

  test("la copia de una medición cuyo proceso murió se borra sin esperar seis horas", () => {
    const dir = tmp("forge-restos-");
    const huerfana = copiaDeMutacion(dir, "forge-mutacion-AbC123", marcaReal(pidMuerto()));
    assert.equal(barrerMutacionesDeProcesosMuertos(dir), 1);
    assert.ok(!existsSync(huerfana));
  });

  test("no toca la copia de un proceso vivo, ni nada que no sea de FORGE", () => {
    const dir = tmp("forge-restos-");
    const fuera = tmp("forge-restos-fuera-");
    writeFileSync(join(fuera, "valioso.txt"), "no me borres");
    const intactas = [
      copiaDeMutacion(dir, "forge-mutacion-Vivo01", marcaReal(process.pid)),          // otra medición en marcha (otro proyecto)
      copiaDeMutacion(dir, "forge-mutacion-SinMar"),                              // sin marca: no se sabe de quién es
      copiaDeMutacion(dir, "forge-mutacion-Vacia1", ""),                          // marca a medio escribir
      copiaDeMutacion(dir, "forge-mutacion-Texto1", "no es un pid\n"),
      copiaDeMutacion(dir, "forge-mutacion-Cero01", "0\n"),
      copiaDeMutacion(dir, "forge-mutacion-Negat1", "-1\n"),
      copiaDeMutacion(dir, "forge-mutacion-demasiado-largo", marcaReal(pidMuerto())), // no es el nombre que crea FORGE
      copiaDeMutacion(dir, "otra-herramienta-AbC123", marcaReal(pidMuerto())),
    ];
    writeFileSync(join(dir, "forge-mutacion-Fich01"), "un archivo, no una carpeta");
    // Un enlace con el nombre de FORGE que apunta fuera: ni se sigue ni se borra su destino
    symlinkSync(fuera, join(dir, "forge-mutacion-Enlac1"), "junction");

    assert.equal(barrerMutacionesDeProcesosMuertos(dir), 0);
    for (const ruta of intactas) assert.ok(existsSync(join(ruta, "copia", "src", "a.js")), ruta);
    assert.equal(readFileSync(join(fuera, "valioso.txt"), "utf8"), "no me borres");
    assert.ok(existsSync(join(dir, "forge-mutacion-Fich01")));
    assert.equal(barrerMutacionesDeProcesosMuertos(join(dir, "no-existe")), 0, "una carpeta temporal que no existe no es un error");
  });

  test("las copias de trabajo de TODAS las sesiones del proyecto se borran, no solo las de la sesión en curso", () => {
    const cwd = tmp("forge-restos-");
    const copia = (sesion, nombre) => { const d = join(cwd, ".sdd", "motor", sesion, "staging", nombre); mkdirSync(join(d, "src"), { recursive: true }); writeFileSync(join(d, "src", "a.js"), "x"); return d; };
    const copias = [copia("run-1", "111-a-1"), copia("run-1", "111-a-2"), copia("run-2", "222-b-1"), copia("mcp-3", "333-c-1")];
    writeFileSync(join(cwd, ".sdd", "motor", "run-1", "gasto.jsonl"), "{}\n");

    assert.deepEqual(barrerCopiasDeSesiones(cwd), []);
    for (const c of copias) assert.ok(!existsSync(c), c);
    assert.ok(existsSync(join(cwd, ".sdd", "motor", "run-1", "gasto.jsonl")), "solo se borran las copias: el resto de la sesión se conserva");
    assert.deepEqual(barrerCopiasDeSesiones(tmp("forge-restos-")), [], "un proyecto sin sesiones no es un error");
  });

  test("una sesión o un `staging` que son enlaces hacia fuera no se recorren: su destino queda intacto", () => {
    const cwd = tmp("forge-restos-");
    const fuera = tmp("forge-restos-fuera-");
    mkdirSync(join(fuera, "staging", "111-a-1"), { recursive: true });
    writeFileSync(join(fuera, "staging", "111-a-1", "valioso.txt"), "no me borres");
    mkdirSync(join(fuera, "copias", "222-b-1"), { recursive: true });
    writeFileSync(join(fuera, "copias", "222-b-1", "valioso.txt"), "no me borres");
    mkdirSync(join(cwd, ".sdd", "motor", "run-2"), { recursive: true });
    symlinkSync(fuera, join(cwd, ".sdd", "motor", "run-1"), "junction");                           // la sesión entera es un enlace
    symlinkSync(join(fuera, "copias"), join(cwd, ".sdd", "motor", "run-2", "staging"), "junction"); // solo su carpeta de copias

    const sinBorrar = barrerCopiasDeSesiones(cwd);
    assert.equal(readFileSync(join(fuera, "staging", "111-a-1", "valioso.txt"), "utf8"), "no me borres");
    assert.equal(readFileSync(join(fuera, "copias", "222-b-1", "valioso.txt"), "utf8"), "no me borres");
    assert.deepEqual(sinBorrar.map((r) => relative(cwd, r).replace(/\\/g, "/")).sort(), [".sdd/motor/run-1", ".sdd/motor/run-2/staging"], "se avisa de lo que no se tocó");
  });
});

// ─── Cortes ───────────────────────────────────────────────────────────────────────────────────

const RUN = ["run", "--tasks", "tareas.json", "--motor", "ciclo"];
const NODOS_DE_UN_CICLO = ["planner", "retriever", "qa", "coder", "sandbox", "mutacion"];
/** Para los cortes que no tratan de la medición por mutación: sin ella, cuatro ejecuciones de pruebas menos por caso. */
const SIN_MEDIR = { mutacion: /** @type {const} */ ("no") };

/**
 * Las mismas pruebas para los dos niveles. Lo que cambia es cómo se deja al proceso «dentro» de una
 * ejecución de pruebas: con el Docker falso, la ejecución número N no termina; con Docker de verdad,
 * `lento.flag` duerme las pruebas dentro del contenedor y se espera a verlo en `docker ps`.
 * @param {boolean} real
 */
function cortes(real) {
  const opciones = { real };

  /** Tras el corte el candado sigue en el disco, a nombre de un proceso que ya no existe, y la tarea quedó a medias. */
  function comprobarCorte(e, proceso) {
    assert.equal(candadoDeProyecto(e)?.pid, proceso.pid, "el candado del proyecto quedó puesto por el proceso muerto");
    assert.equal(estadoDeTarea(e), "en_progreso");
  }

  /** `forge resume`, ya sin esperas en el guion ni en las pruebas. */
  async function reanudar(e) {
    escribirGuion(e);
    rmSync(join(e.dir, "lento.flag"), { force: true });
    const r = await ejecutar(e, ["resume"], opciones);
    assert.equal(r.codigo, 0, r.salida);
    return r;
  }

  /** Llamadas que el proveedor empezó a atender para una regla, en todos los procesos. */
  const iniciadas = (e, regla) => lineas(e.llamadas).filter((l) => l.fase === "inicio" && l.regla === regla).length;

  /**
   * Lanza `forge run` y lo deja dentro de una ejecución de pruebas: la del rojo obligatorio (`rojo`, aún
   * sin implementación) o la primera con la implementación escrita (`verde`).
   * @param {ReturnType<typeof escenario>} e @param {"rojo"|"verde"} cual
   */
  async function hastaLaEjecucion(e, cual) {
    if (real) {
      writeFileSync(join(e.dir, "lento.flag"), cual);
      const p = lanzar(e, RUN, opciones);
      // En `verde` el contenedor que interesa es el que arranca con la implementación ya escrita (el del rojo dura un instante)
      const listo = () => (cual === "rojo" || existsSync(join(e.dir, "src", "suma.js"))) && contenedores(e, { todos: false }).length > 0;
      await esperar(listo, { que: `el contenedor de la ejecución (${cual})`, proceso: p, cadaMs: 500 });
      return p;
    }
    const n = cual === "rojo" ? 1 : 2;
    const p = lanzar(e, RUN, { env: { FALSO_PARAR_EN_EJECUCION: String(n) } });
    await esperar(() => lineas(e.docker).some((l) => l.orden === "run" && l.n === n), { que: `la ejecución ${n}`, proceso: p });
    return p;
  }

  test("sin cortes: la tarea termina, con tres llamadas pagadas y sin dejar nada detrás", async () => {
    const e = escenario();
    const r = await ejecutar(e, RUN, opciones);
    assert.equal(r.codigo, 0, r.salida);
    comprobarFinal(e, opciones);
    assert.deepEqual(puntos(e).map((p) => p.nodo), NODOS_DE_UN_CICLO);
    const medida = eventos(e).find((ev) => ev.type === "ciclo:mutacion");
    assert.equal(medida?.payload.lineaBase, "ok", JSON.stringify(medida));
    assert.ok(medida.payload.probadas >= 1, "la medición por mutación probó alguna alteración");
  });

  test("corte durante la llamada al planificador (antes del primer punto de guardado)", async () => {
    const e = escenario(SIN_MEDIR);
    escribirGuion(e, { planificador: { hasta: join(e.base, "nunca") } });
    const p = lanzar(e, RUN, opciones);
    await esperar(() => iniciadas(e, REGLA.planificador) > 0, { que: "la llamada al planificador", proceso: p });
    await matar(p);
    comprobarCorte(e, p);
    assert.deepEqual(puntos(e), []);
    assert.equal(gasto(e).length, 0, "la llamada no llegó a responder: no se pagó");

    await reanudar(e);
    comprobarFinal(e, opciones);
    assert.equal(sesiones(e).length, 1, "se reanudó la misma sesión");
  });

  test("corte tras el planificador: su respuesta ya pagada no se vuelve a pedir", async () => {
    const e = escenario(SIN_MEDIR);
    escribirGuion(e, { pruebas: { hasta: join(e.base, "nunca") } });
    const p = lanzar(e, RUN, opciones);
    await esperar(() => iniciadas(e, REGLA.pruebas) > 0, { que: "la llamada al agente de pruebas", proceso: p });
    await matar(p);
    comprobarCorte(e, p);
    assert.deepEqual(puntos(e).map((x) => x.nodo), ["planner", "retriever"]);
    assert.equal(gasto(e).length, 1);

    await reanudar(e);
    comprobarFinal(e, opciones);
    assert.equal(iniciadas(e, REGLA.planificador), 1, "el planificador se llamó una sola vez");
    assert.deepEqual(puntos(e).map((x) => x.nodo), NODOS_DE_UN_CICLO.slice(0, -1), "al reanudar no se repitió ningún nodo ya guardado");
  });

  test("corte tras escribir las pruebas, con la comprobación en rojo en marcha", async () => {
    const e = escenario(SIN_MEDIR);
    const p = await hastaLaEjecucion(e, "rojo");
    await matar(p);
    comprobarCorte(e, p);
    assert.ok(existsSync(join(e.dir, "tests", "suma.test.js")), "las pruebas ya estaban escritas");
    assert.ok(!existsSync(join(e.dir, "src", "suma.js")));
    assert.equal(gasto(e).length, 2);
    assert.deepEqual(puntos(e).map((x) => x.nodo), ["planner", "retriever"], "el nodo de pruebas no llegó a guardarse");
    assert.equal(copiasDeTrabajo(e).length, 1, "quedó la copia de trabajo de la ejecución cortada");
    if (real) assert.equal(contenedores(e, { todos: false }).length, 1, "el contenedor sigue vivo: nadie lo paró");

    await reanudar(e);
    comprobarFinal(e, opciones);
    assert.equal(iniciadas(e, REGLA.pruebas), 1, "las pruebas ya pagadas salieron del diario, no de otra llamada");
  });

  test("corte tras escribir la implementación, con las pruebas ejecutándose", async () => {
    const e = escenario(SIN_MEDIR);
    const p = await hastaLaEjecucion(e, "verde");
    await matar(p);
    comprobarCorte(e, p);
    assert.ok(existsSync(join(e.dir, "src", "suma.js")), "la implementación ya estaba escrita");
    assert.equal(gasto(e).length, LLAMADAS_DEL_CICLO);
    assert.deepEqual(puntos(e).map((x) => x.nodo), ["planner", "retriever", "qa", "coder"]);
    assert.equal(copiasDeTrabajo(e).length, 1);
    if (real) assert.equal(contenedores(e, { todos: false }).length, 1);

    await reanudar(e);
    comprobarFinal(e, opciones);
    assert.equal(iniciadas(e, REGLA.implementador), 1, "el implementador se llamó una sola vez");
  });

  test("corte durante la medición por mutación: no queda su copia temporal", async () => {
    const e = escenario();
    // Con el Docker falso: la ejecución 3 es la línea base de la medición (1: rojo, 2: verde)
    const p = lanzar(e, RUN, real ? opciones : { env: { FALSO_PARAR_EN_EJECUCION: "3" } });
    await esperar(() => copiasDeMutacion(e).length > 0 && (real || lineas(e.docker).some((l) => l.orden === "run" && l.n === 3)), { que: "la copia temporal de la medición", proceso: p });
    await matar(p);
    comprobarCorte(e, p);
    assert.equal(copiasDeMutacion(e).length, 1, "quedó la carpeta forge-mutacion-* del proceso cortado");
    assert.deepEqual(puntos(e).map((x) => x.nodo), ["planner", "retriever", "qa", "coder", "sandbox"]);

    await reanudar(e);
    comprobarFinal(e, opciones);
  });

  test("tras un corte, el candado no impide volver a empezar: `forge run` de nuevo tampoco se rechaza ni deja copias de la sesión muerta", async () => {
    const e = escenario(SIN_MEDIR);
    const p = await hastaLaEjecucion(e, "rojo");
    await matar(p);
    comprobarCorte(e, p);
    const sesionCortada = sesionActual(e);

    escribirGuion(e);
    rmSync(join(e.dir, "lento.flag"), { force: true });
    const r = await ejecutar(e, RUN, opciones);
    assert.equal(r.codigo, 0, r.salida);
    assert.doesNotMatch(r.salida, /ya está en curso/);
    assert.notEqual(sesionActual(e), sesionCortada, "es una sesión nueva");
    assert.equal(estadoDeTarea(e), "completada");
    assert.equal(candadoDeProyecto(e), null);
    assert.deepEqual(copiasDeTrabajo(e), [], "tampoco quedan las copias de trabajo de la sesión que se cortó");
    assert.deepEqual(copiasDeMutacion(e), []);
    if (real) assert.deepEqual(contenedores(e), []);
  });
}

describe("corte real del proceso — con el Docker falso", () => {
  cortes(false);

  test("corte a mitad de la medición por mutación: las alteraciones ya probadas no se repiten", async () => {
    const referencia = escenario();
    assert.equal((await ejecutar(referencia, RUN)).codigo, 0);
    const medidas = (e) => eventos(e).filter((ev) => ev.type === "ciclo:mutante");
    const total = medidas(referencia).length;
    assert.ok(total >= 2, `hacen falta al menos dos alteraciones para cortar entre ellas (hay ${total})`);

    // Ejecuciones: 1 rojo, 2 verde, 3 línea base, 4 cobertura, 5 primera alteración, 6 segunda (aquí se corta)
    const e = escenario();
    const p = lanzar(e, RUN, { env: { FALSO_PARAR_EN_EJECUCION: "6" } });
    await esperar(() => lineas(e.docker).some((l) => l.orden === "run" && l.n === 6), { que: "la segunda alteración", proceso: p });
    await matar(p);
    assert.equal(medidas(e).length, 1, "una alteración quedó medida antes del corte");

    escribirGuion(e);
    assert.equal((await ejecutar(e, ["resume"])).codigo, 0);
    comprobarFinal(e);
    const tras = medidas(e);
    assert.equal(tras.filter((ev) => !ev.payload.reutilizada).length, total, "cada alteración se ejecutó una sola vez entre los dos procesos");
    assert.equal(tras.filter((ev) => ev.payload.reutilizada).length, 1, "la ya medida se reutilizó");
    assert.deepEqual(candados(e), []);
  });
});

describe("corte real del proceso — forge run / forge resume con Docker", { skip: !dockerActivo() && "requiere FORGE_TEST_DOCKER=1 y Docker en marcha" }, () => {
  cortes(true);
});
