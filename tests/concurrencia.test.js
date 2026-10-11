// @ts-check
/**
 * Concurrencia entre procesos de `forge`.
 *
 *   - Dos `forge run --motor ciclo` a la vez sobre el MISMO proyecto: el segundo se rechaza con un
 *     mensaje claro y no daña al primero (sesión, candado, gasto y registro intactos).
 *   - Dos sobre proyectos DISTINTOS a la vez: los dos terminan, sin mezclar sesiones, gasto, copias
 *     de trabajo ni contenedores, aunque compartan la carpeta temporal del equipo.
 *
 * Los procesos son reales. Para que coincidan no se confía en el reloj: el proveedor de pruebas deja
 * una llamada sin responder hasta que el test crea un archivo (`hasta`).
 * Mismos dos niveles que tests/corte-real.test.js: con un Docker falso (siempre) y con Docker de
 * verdad (FORGE_TEST_DOCKER=1).
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  candadoDeProyecto, comprobarFinal, conTope, contenedores, dockerActivo, ejecutar, escenario, escribirGuion, esperar, estadoDeTarea,
  eventos, gasto, lanzar, lineas, REGLA, sesionActual, sesiones,
} from "./fixtures/ciclo-guionizado.mjs";

const RUN = ["run", "--tasks", "tareas.json", "--motor", "ciclo"];
const enLaLlamadaDePruebas = (e) => lineas(e.llamadas).some((l) => l.fase === "inicio" && l.regla === REGLA.pruebas);

/** @param {boolean} real */
function concurrencia(real) {
  const opciones = { real };

  test("mismo proyecto: el segundo `forge run` se rechaza con un mensaje claro y el primero termina sin daños", async () => {
    const e = escenario({ mutacion: "no" });
    const soltar = join(e.base, "soltar");
    escribirGuion(e, { pruebas: { hasta: soltar } });

    // El primero se queda a mitad de la tarea: sesión abierta, candado tomado, una llamada pagada y otra en curso
    const primero = lanzar(e, RUN, opciones);
    await esperar(() => enLaLlamadaDePruebas(e), { que: "que el primero llegue a la llamada del agente de pruebas", proceso: primero });
    const antes = { sesion: sesionActual(e), eventos: eventos(e).length, gasto: gasto(e).length, llamadas: lineas(e.llamadas).length };
    assert.equal(candadoDeProyecto(e)?.pid, primero.pid);
    assert.equal(antes.gasto, 1);

    const rechazo = new RegExp(`El ciclo verificado de este proyecto ya está en curso en otro proceso \\(pid ${primero.pid}\\)`);
    const sinDanos = (que) => {
      assert.equal(primero.fin(), null, `el primero sigue en marcha tras ${que}`);
      assert.equal(sesionActual(e), antes.sesion, `${que} no abrió otra sesión`);
      assert.deepEqual(sesiones(e), [antes.sesion]);
      assert.equal(candadoDeProyecto(e)?.pid, primero.pid, `${que} no tocó el candado del primero`);
      assert.equal(gasto(e).length, antes.gasto, `${que} no gastó nada`);
      assert.equal(lineas(e.llamadas).length, antes.llamadas, `${que} no llamó al modelo`);
      assert.equal(eventos(e).length, antes.eventos, `${que} no escribió en el registro de eventos`);
    };

    const segundo = await ejecutar(e, RUN, opciones);
    assert.equal(segundo.codigo, 1, segundo.salida);
    assert.match(segundo.salida, rechazo);
    sinDanos("el segundo `forge run`");

    // Tampoco `forge resume`: vería la tarea «en progreso» y la relanzaría encima del primero
    const reanudacion = await ejecutar(e, ["resume"], opciones);
    assert.equal(reanudacion.codigo, 1, reanudacion.salida);
    assert.match(reanudacion.salida, rechazo);
    sinDanos("`forge resume`");

    writeFileSync(soltar, "");
    const fin = /** @type {any} */ (await conTope(primero.terminado, "el primer forge run"));
    assert.equal(fin.codigo, 0, fin.salida);
    comprobarFinal(e, opciones);
    assert.deepEqual(sesiones(e), [antes.sesion], "todo ocurrió en la sesión del primero");
  });

  test("proyectos distintos a la vez: los dos terminan, sin mezclar sesiones, gasto, copias ni contenedores", async () => {
    // Comparten la carpeta temporal, como en un equipo de verdad: ahí crea sus copias la medición por mutación
    const a = escenario();
    const b = escenario({ temporal: a.temporal });
    const soltar = join(a.base, "soltar");
    escribirGuion(a, { pruebas: { hasta: soltar } });
    escribirGuion(b, { pruebas: { hasta: soltar } });

    const pa = lanzar(a, RUN, opciones);
    const pb = lanzar(b, RUN, opciones);
    await esperar(() => enLaLlamadaDePruebas(a), { que: "el proyecto A a mitad de tarea", proceso: pa });
    await esperar(() => enLaLlamadaDePruebas(b), { que: "el proyecto B a mitad de tarea", proceso: pb });
    // Los dos están en marcha a la vez, cada uno con su candado y su sesión
    assert.equal(candadoDeProyecto(a)?.pid, pa.pid);
    assert.equal(candadoDeProyecto(b)?.pid, pb.pid);
    assert.notEqual(sesionActual(a), sesionActual(b));

    writeFileSync(soltar, "");
    /** Contenedores vistos de cada proyecto mientras corren (solo con Docker de verdad). */
    const vistos = { a: new Set(), b: new Set() };
    if (real) {
      while (pa.fin() === null || pb.fin() === null) {
        for (const n of contenedores(a, { todos: false })) vistos.a.add(n);
        for (const n of contenedores(b, { todos: false })) vistos.b.add(n);
        await new Promise((r) => setTimeout(r, 300));
      }
    }
    const [fa, fb] = /** @type {any[]} */ (await conTope(Promise.all([pa.terminado, pb.terminado]), "los dos forge run"));
    assert.equal(fa.codigo, 0, fa.salida);
    assert.equal(fb.codigo, 0, fb.salida);

    for (const [e, otro, nombre] of [[a, b, "A"], [b, a, "B"]]) {
      // Cada uno pagó sus tres llamadas y dejó limpio lo suyo (y la carpeta temporal compartida)
      comprobarFinal(e, opciones);
      assert.equal(estadoDeTarea(e), "completada", nombre);
      assert.equal(sesiones(e).length, 1, `${nombre}: una sola sesión, la suya`);
      assert.ok(gasto(e).every((g) => g.taskId === "T1"), nombre);
      // La medición de cada uno llegó a término aunque el otro barriera la carpeta temporal a la vez
      const medida = eventos(e).find((ev) => ev.type === "ciclo:mutacion");
      assert.equal(medida?.payload.lineaBase, "ok", `${nombre}: ${JSON.stringify(medida?.payload)}`);
      assert.ok(medida.payload.probadas >= 1 && !medida.payload.motivoParcial?.startsWith("infra"), nombre);
      if (!real) {
        // Con el Docker falso: cada ejecución montó una copia de su propio proyecto y de su propia sesión
        const montadas = lineas(e.docker).filter((l) => l.orden === "run");
        assert.ok(montadas.length >= 3, nombre);
        for (const m of montadas) {
          assert.ok(String(m.copia).startsWith(join(e.dir, ".sdd", "motor", String(sesionActual(e)), "staging")), `${nombre} montó ${m.copia}`);
          assert.ok(!String(m.copia).startsWith(otro.dir), nombre);
          assert.ok(String(m.nombre).includes(String(sesionActual(e))), `${nombre}: el contenedor ${m.nombre} lleva su sesión`);
        }
      }
    }
    if (real) {
      for (const n of vistos.a) assert.ok(!vistos.b.has(n), `el contenedor ${n} apareció con las etiquetas de los dos proyectos`);
      for (const n of vistos.a) assert.ok(n.includes(String(sesionActual(a))), `A: ${n}`);
      for (const n of vistos.b) assert.ok(n.includes(String(sesionActual(b))), `B: ${n}`);
    }
  });
}

describe("concurrencia — con el Docker falso", () => { concurrencia(false); });

describe("concurrencia — forge run con Docker", { skip: !dockerActivo() && "requiere FORGE_TEST_DOCKER=1 y Docker en marcha" }, () => { concurrencia(true); });
