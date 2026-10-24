// @ts-check
/**
 * Implementador por turnos bajo su perfil (spec 2026-10-14-perfiles-de-agente, HU-004; tareas F4.2 y F4.4).
 *   F4.2  `maxPruebas` (ejecuciones de pruebas) sale del perfil del implementador, acotado por la configuración.
 *   F4.4  Una herramienta que el perfil no ofrece se rechaza aunque el modelo la pida, con motivo, y queda anotada.
 * F4.1 (esquemas filtrados y las cinco de siempre) y F4.3 (rutas escribibles y fuera_de_perfil) están en
 * tests/ciclo-perfiles.test.js.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { EDITA, FALLA, PASA, TAREA, TERMINA, entorno, pide, resultadosDe, tipos, uso } from "./helpers-perfiles.js";

describe("F4.2 — tope de pruebas desde el perfil", () => {
  test("el perfil del implementador fija las ejecuciones de pruebas: el modelo lo lee y el tope se aplica", async () => {
    const e = entorno({
      yaml: "perfiles:\n  coder_pruebas_max: 1\n",
      turnos: [pide(uso("ejecutar_pruebas", {})), pide(uso("ejecutar_pruebas", {})), pide(EDITA), TERMINA],
      ejecuciones: [FALLA, FALLA, PASA],
    });
    const r = await e.nuevoCiclo().ejecutar(TAREA);
    assert.equal(r.estado.resultado, "exito");
    assert.match(e.conversaciones[0].mensajes[0].contenido, /1 ejecuciones de pruebas/, "el prompt dice el tope del perfil");
    const segunda = resultadosDe(e.conversaciones[2].mensajes.at(-1))[0];
    assert.equal(segunda.esError, true);
    assert.match(segunda.contenido, /Ya se alcanzó el máximo de 1 ejecuciones de pruebas/);
  });

  test("manda el más estricto: un tope de la configuración por debajo del perfil gana", async () => {
    const e = entorno({
      motor: { turnos_pruebas_max: 1 },
      turnos: [pide(uso("ejecutar_pruebas", {})), pide(uso("ejecutar_pruebas", {})), pide(EDITA), TERMINA],
      ejecuciones: [FALLA, FALLA, PASA],
    });
    const r = await e.nuevoCiclo().ejecutar(TAREA);
    assert.equal(r.estado.resultado, "exito");
    assert.match(e.conversaciones[0].mensajes[0].contenido, /1 ejecuciones de pruebas/);
    assert.equal(resultadosDe(e.conversaciones[2].mensajes.at(-1))[0].esError, true);
  });

  test("un perfil más laxo que la configuración no sube el tope: la configuración sigue mandando", async () => {
    const e = entorno({
      yaml: "perfiles:\n  coder_pruebas_max: 200\n",
      motor: { turnos_pruebas_max: 2 },
      turnos: [pide(EDITA), TERMINA],
      ejecuciones: [FALLA, PASA],
    });
    await e.nuevoCiclo().ejecutar(TAREA);
    assert.match(e.conversaciones[0].mensajes[0].contenido, /2 ejecuciones de pruebas/);
  });
});

describe("F4.4 — una herramienta que el perfil no ofrece", () => {
  test("pedida igual, se rechaza con motivo y el rechazo queda anotado en el diario del ciclo", async () => {
    const e = entorno({
      yaml: "perfiles:\n  coder_herramientas: leer_archivo,listar,editar,ejecutar_pruebas\n",
      turnos: [pide(uso("buscar", { texto: "a" })), pide(EDITA), TERMINA],
      ejecuciones: [FALLA, PASA],
    });
    const r = await e.nuevoCiclo().ejecutar(TAREA);
    assert.equal(r.estado.resultado, "exito", "el ciclo sigue: la herramienta no ofrecida no lo tumba");
    assert.ok(!e.conversaciones[0].herramientas.some((/** @type {any} */ h) => h.nombre === "buscar"), "no se ofreció");
    const anotado = tipos(e, "ciclo:herramienta").find((/** @type {any} */ ev) => ev.payload.herramienta === "buscar");
    assert.ok(anotado, "la llamada queda en el diario");
    assert.equal(anotado.payload.ok, false);
    assert.equal(anotado.payload.motivo, "herramienta_fuera_de_perfil", "con motivo");
    assert.match(resultadosDe(e.conversaciones[1].mensajes[2])[0].contenido, /no está disponible en tu perfil/);
  });
});
