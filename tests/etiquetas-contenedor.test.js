import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { DockerCli } from "../core/sandbox/docker-cli.js";
import { ETIQUETA, ETIQUETA_ANTIGUA, etiquetaProyecto, etiquetaProyectoAntigua, argvRun } from "../core/sandbox/politica.js";

/** Docker falso: cada `ps --filter label=X` devuelve solo los ids de contenedores que llevan X. */
function dockerFalso(contenedores) {
  const llamadas = [];
  const ejecutar = async (args) => {
    llamadas.push(args);
    if (args[0] === "ps") {
      const etiqueta = args[args.indexOf("--filter") + 1].replace(/^label=/, "");
      const ids = Object.entries(contenedores).filter(([, ls]) => ls.includes(etiqueta)).map(([id]) => id);
      return { code: 0, stdout: ids.join("\n"), stderr: "" };
    }
    return { code: 0, stdout: "", stderr: "", timedOut: false };
  };
  return { ejecutar, llamadas };
}

describe("F4.3 etiquetas de contenedor: la nueva se emite, el barrido reconoce las dos", () => {
  test("los contenedores nuevos llevan solo la etiqueta nueva", () => {
    const argv = argvRun({ imagen: "x", nombre: "n", copia: "C:\tmp\copia", comando: ["true"], proyectoId: "p1" });
    assert.ok(argv.includes(ETIQUETA));
    assert.ok(argv.includes(etiquetaProyecto("p1")));
    assert.ok(!argv.includes(ETIQUETA_ANTIGUA));
    assert.ok(!argv.includes(etiquetaProyectoAntigua("p1")));
    assert.match(ETIQUETA, /^fragua\./);
  });

  test("el barrido por defecto borra los de la etiqueta nueva y los de la antigua", async () => {
    const f = dockerFalso({ nuevo: [ETIQUETA], viejo: [ETIQUETA_ANTIGUA], ajeno: ["otra=1"] });
    const n = await new DockerCli(f).barrerHuerfanos();
    assert.equal(n, 2);
    const rm = f.llamadas.find((l) => l[0] === "rm");
    assert.deepEqual(rm.slice(2).sort(), ["nuevo", "viejo"]);
  });

  test("lo que no lleva ninguna de las dos no se toca (ni se llama a rm)", async () => {
    const f = dockerFalso({ ajeno: ["otra=1"], casi: ["forge.sandbox=2", "fragua.sandbox=0"] });
    assert.equal(await new DockerCli(f).barrerHuerfanos(), 0);
    assert.ok(!f.llamadas.some((l) => l[0] === "rm"));
  });

  test("el barrido por proyecto reconoce la etiqueta de proyecto nueva y la antigua", async () => {
    const f = dockerFalso({ a: [etiquetaProyecto("p")], b: [etiquetaProyectoAntigua("p")], c: [etiquetaProyecto("q")] });
    const n = await new DockerCli(f).barrerHuerfanos([etiquetaProyecto("p"), etiquetaProyectoAntigua("p")]);
    assert.equal(n, 2);
  });
});
