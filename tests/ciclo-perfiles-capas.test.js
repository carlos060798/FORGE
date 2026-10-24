// @ts-check
/**
 * Resolución de las tres capas del perfil (spec 2026-10-14-perfiles-de-agente, HU-003; tareas F3.1, F3.2 y F3.3).
 *   F3.1  Propiedad: para miles de combinaciones de las capas, el efectivo nunca supera a la capa anterior
 *         ni al techo, y lo que el proyecto pide y no está permitido se anota.
 *   F3.2  La política del usuario viene del entorno (fuera del árbol). Lo que hay en el árbol no la fabrica.
 *   F3.3  Un intento de ampliación del proyecto se ignora y se anota con capa, campo y motivo.
 */

import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { HERRAMIENTAS_CODER, perfilPorDefecto, resolverPerfil } from "../core/ciclo/perfiles.js";

/** Generador determinista (mulberry32): las combinaciones son las mismas en cada ejecución. */
function generador(/** @type {number} */ semilla) {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RUTAS = ["src/", "src/a.js", "lib/", "tests/", "tests/unit/", "src/deep/", "src/deep/x.js", "docs/"];

/** Un pedido de una capa con valores al azar, algunos fuera de lo que cabe. @param {() => number} rnd */
function pedidoAlAzar(rnd) {
  /** @type {Record<string, string>} */
  const p = {};
  if (rnd() < 0.7) p.herramientas = HERRAMIENTAS_CODER.filter(() => rnd() < 0.6).join(",");
  if (rnd() < 0.7) p.rutas_escribir = RUTAS.filter(() => rnd() < 0.5).join(",") || "src/";
  if (rnd() < 0.7) p.pasos_max = String(1 + Math.floor(rnd() * 250));
  if (rnd() < 0.7) p.pruebas_max = String(Math.floor(rnd() * 250));
  if (rnd() < 0.7) p.contexto_max_bytes = String(1 + Math.floor(rnd() * 5_000_000));
  return p;
}

/** ¿Cada prefijo de `hijos` queda cubierto por alguno de `padres`? (null = sin restricción) */
function cubiertos(/** @type {string[]|null} */ hijos, /** @type {string[]|null} */ padres) {
  if (padres === null || hijos === null) return padres === null;
  return hijos.every((h) => padres.some((p) => h === p || (p.endsWith("/") && h.startsWith(p))));
}

const ROLES = ["planner", "qa", "coder"];

describe("F3.1 — propiedad: el efectivo nunca afloja ninguna capa", () => {
  test("para miles de combinaciones de usuario y proyecto, el efectivo es subconjunto de cada capa y de los techos", () => {
    const rnd = generador(20261023);
    let comparadas = 0;
    for (let i = 0; i < 1500; i++) {
      const usuario = pedidoAlAzar(rnd);
      for (const rol of ROLES) {
        const pedidoProyecto = pedidoAlAzar(rnd);
        const techo = perfilPorDefecto(rol);
        const soloUsuario = resolverPerfil(rol, { cwd: "x", usuario, proyecto: {} }).perfil;
        const { perfil: efectivo, avisos } = resolverPerfil(rol, { cwd: "x", usuario, proyecto: { [rol]: pedidoProyecto } });
        const caso = `${rol} usuario=${JSON.stringify(usuario)} proyecto=${JSON.stringify(pedidoProyecto)}`;

        // Herramientas y topes: conjunto y mínimo. Rutas: cada prefijo efectivo queda dentro de lo que permite la capa anterior
        assert.ok(efectivo.herramientas.every((h) => soloUsuario.herramientas.includes(h) && techo.herramientas.includes(h)), `${caso}: una herramienta que no permitía el usuario o el techo`);
        assert.ok(efectivo.pasosMax <= soloUsuario.pasosMax && efectivo.pruebasMax <= soloUsuario.pruebasMax && efectivo.contextoMaxBytes <= soloUsuario.contextoMaxBytes, `${caso}: un tope subió`);
        assert.ok(efectivo.pasosMax <= techo.pasosMax && efectivo.pruebasMax <= techo.pruebasMax && efectivo.contextoMaxBytes <= techo.contextoMaxBytes, `${caso}: un tope supera el techo`);
        assert.ok(cubiertos(efectivo.rutasEscribir.prefijos, soloUsuario.rutasEscribir.prefijos), `${caso}: una ruta escribible no la permitía el usuario`);
        assert.ok(cubiertos(efectivo.rutasEscribir.prefijos, techo.rutasEscribir.prefijos), `${caso}: una ruta escribible supera el techo`);
        assert.equal(efectivo.rutasEscribir.clase, techo.rutasEscribir.clase, `${caso}: la regla de rol no se toca`);

        // Lo que el proyecto pide y el usuario no permite tiene que quedar anotado (F3.3)
        const pedidas = pedidoProyecto.herramientas !== undefined ? pedidoProyecto.herramientas.split(",").filter(Boolean) : [];
        for (const h of pedidas) {
          if (!soloUsuario.herramientas.includes(h)) {
            assert.ok(avisos.some((a) => a.capa === "proyecto" && a.campo === "herramientas" && a.pedido === h), `${caso}: herramienta «${h}» pedida sin anotar`);
          }
        }
        if (pedidoProyecto.pasos_max !== undefined && Number(pedidoProyecto.pasos_max) > soloUsuario.pasosMax) {
          assert.ok(avisos.some((a) => a.capa === "proyecto" && a.campo === "pasos_max"), `${caso}: pasos_max pedido sin anotar`);
        }
        comparadas++;
      }
    }
    assert.ok(comparadas >= 4000, `se compararon ${comparadas} combinaciones`);
  });

  test("la resolución es determinista: el mismo pedido da el mismo perfil", () => {
    const rnd = generador(7);
    for (let i = 0; i < 200; i++) {
      const usuario = pedidoAlAzar(rnd);
      const proyecto = { coder: pedidoAlAzar(rnd) };
      const a = resolverPerfil("coder", { cwd: "x", usuario, proyecto });
      const b = resolverPerfil("coder", { cwd: "x", usuario, proyecto });
      assert.deepEqual(a, b);
    }
  });
});

describe("F3.2 — la política del usuario viene del entorno, no del árbol", () => {
  const VARIABLES = ["FRAGUA_PERFIL_CODER_PASOS_MAX", "FRAGUA_PERFIL_CODER_HERRAMIENTAS"];
  afterEach(() => { for (const v of VARIABLES) delete process.env[v]; });

  /** Un proyecto con política fabricada en el árbol: en la configuración, en un archivo propio y en un .env. */
  function proyectoHostil() {
    const cwd = mkdtempSync(join(tmpdir(), "forge-perfil-hostil-"));
    mkdirSync(join(cwd, ".sdd"), { recursive: true });
    writeFileSync(join(cwd, ".sdd", "sdd.config.yaml"), "perfiles:\n  coder_herramientas: leer_archivo\n", "utf8");
    writeFileSync(join(cwd, ".sdd", "politica-usuario.json"), JSON.stringify({ coder: { herramientas: "leer_archivo", pasos_max: "1" } }), "utf8");
    writeFileSync(join(cwd, ".env"), "FRAGUA_PERFIL_CODER_PASOS_MAX=1\nFRAGUA_PERFIL_CODER_HERRAMIENTAS=leer_archivo\n", "utf8");
    return cwd;
  }

  test("un archivo de política dentro del árbol no cambia el perfil: ni el de usuario ni el del proyecto lo leen", () => {
    const { perfil } = resolverPerfil("coder", { cwd: proyectoHostil() });
    assert.deepEqual(perfil.herramientas, ["leer_archivo"], "la herramienta sale de sdd.config.yaml, no del archivo de política");
    assert.equal(perfil.pasosMax, perfilPorDefecto("coder").pasosMax, "pasos_max no lo fijó el archivo de política ni el .env");
  });

  test("el .env del proyecto no se carga: solo cuenta el entorno del proceso", () => {
    const cwd = proyectoHostil();
    assert.equal(resolverPerfil("coder", { cwd, proyecto: {} }).perfil.pasosMax, perfilPorDefecto("coder").pasosMax);
    process.env.FRAGUA_PERFIL_CODER_PASOS_MAX = "7";
    assert.equal(resolverPerfil("coder", { cwd, proyecto: {} }).perfil.pasosMax, 7, "el entorno del usuario sí aplica");
  });

  test("la capa del usuario no puede subir el techo (solo mover dentro de él)", () => {
    process.env.FRAGUA_PERFIL_CODER_PASOS_MAX = "100000";
    const r = resolverPerfil("coder", { cwd: mkdtempSync(join(tmpdir(), "forge-perfil-techo-")), proyecto: {} });
    assert.equal(r.perfil.pasosMax, perfilPorDefecto("coder").pasosMax);
    assert.equal(r.avisos[0].capa, "usuario");
  });
});

describe("F3.3 — una ampliación del proyecto se ignora y se anota", () => {
  test("cada tope y cada ruta que el proyecto amplía queda anotado con su capa, campo y motivo", () => {
    const r = resolverPerfil("coder", {
      cwd: "x",
      usuario: { rutas_escribir: "src/", pasos_max: "10", pruebas_max: "3", contexto_max_bytes: "100000" },
      proyecto: { coder: { rutas_escribir: "src/,lib/", pasos_max: "50", pruebas_max: "500", contexto_max_bytes: "99999999" } },
    });
    assert.deepEqual(r.perfil.rutasEscribir.prefijos, ["src/"], "lib/ no entra: el usuario no la permitía");
    assert.equal(r.perfil.pasosMax, 10);
    assert.equal(r.perfil.pruebasMax, 3);
    assert.equal(r.perfil.contextoMaxBytes, 100000);
    const anotados = r.avisos.filter((a) => a.capa === "proyecto").map((a) => `${a.campo}:${a.pedido}`).sort();
    assert.deepEqual(anotados, ["contexto_max_bytes:99999999", "pasos_max:50", "pruebas_max:500", "rutas_escribir:lib/"]);
    for (const a of r.avisos) assert.match(a.motivo, /se ignora/, `el motivo dice que se ignora: ${a.motivo}`);
  });

  test("una ampliación que no se sale de lo permitido no se anota: no es un intento", () => {
    const r = resolverPerfil("coder", { cwd: "x", usuario: { pasos_max: "10" }, proyecto: { coder: { pasos_max: "5", herramientas: "leer_archivo" } } });
    assert.equal(r.perfil.pasosMax, 5);
    assert.deepEqual(r.avisos, []);
  });
});
