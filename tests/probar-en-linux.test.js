// @ts-check
/**
 * Parte pura de scripts/probar-en-linux.mjs: opciones, órdenes, prerrequisitos
 * y resumen. No ejecuta Docker ni WSL: usa un ejecutor falso.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  parsearOpciones,
  construirOrdenDocker,
  construirOrdenWsl,
  rutaWindowsAWsl,
  listarDistros,
  distroUtilizable,
  comprobarDocker,
  comprobarWsl,
  resumirRegistro,
  principal,
} from "../scripts/probar-en-linux.mjs";

/** Ejecutor falso: responde según una tabla `comando args` -> resultado. */
function falso(tabla) {
  const llamadas = [];
  const f = (cmd, args) => {
    llamadas.push([cmd, ...args]);
    const clave = [cmd, ...args].join(" ");
    for (const [k, v] of Object.entries(tabla)) if (clave.startsWith(k)) return v;
    return { status: 1, stdout: "", stderr: "no responde", error: new Error("ENOENT") };
  };
  f.llamadas = llamadas;
  return f;
}
const salida = () => {
  const l = [];
  return { escribir: (t) => l.push(t), texto: () => l.join("\n") };
};

describe("parsearOpciones", () => {
  test("valores por defecto", () => {
    const o = parsearOpciones([]);
    assert.equal(o.via, "docker");
    assert.equal(o.node, "22");
    assert.equal(o.archivo, null);
    assert.equal(o.soloComprobar, false);
    assert.equal(o.conDockerReal, false);
    assert.deepEqual(o.errores, []);
  });
  test("acepta todas las banderas", () => {
    const o = parsearOpciones(["--via", "wsl", "--archivo", "tests/x.test.js", "--node", "20", "--solo-comprobar", "--con-docker-real"]);
    assert.equal(o.via, "wsl");
    assert.equal(o.archivo, "tests/x.test.js");
    assert.equal(o.node, "20");
    assert.equal(o.soloComprobar, true);
    assert.equal(o.conDockerReal, true);
  });
  test("rechaza valores inválidos", () => {
    assert.ok(parsearOpciones(["--via", "vm"]).errores.length > 0);
    assert.ok(parsearOpciones(["--node", "18"]).errores.length > 0);
    assert.ok(parsearOpciones(["--archivo"]).errores.length > 0);
    assert.ok(parsearOpciones(["--rara"]).errores.length > 0);
  });
  test("rechaza archivo que sale del repositorio o con metacaracteres", () => {
    assert.ok(parsearOpciones(["--archivo", "../x.test.js"]).errores.length > 0);
    assert.ok(parsearOpciones(["--archivo", "a; rm -rf /"]).errores.length > 0);
  });
  test("normaliza separadores de Windows en --archivo", () => {
    assert.equal(parsearOpciones(["--archivo", "tests\\x.test.js"]).archivo, "tests/x.test.js");
  });
});

describe("construirOrdenDocker", () => {
  test("npm ci && npm test, sin socket de Docker", () => {
    const { cmd, args } = construirOrdenDocker({ node: "22", archivo: null, directorioCopia: "C:\\tmp\\copia", conDockerReal: false });
    assert.equal(cmd, "docker");
    assert.deepEqual(args.slice(0, 2), ["run", "--rm"]);
    assert.ok(args.includes("node:22"));
    assert.ok(args.includes("C:\\tmp\\copia:/work"));
    assert.ok(!args.some((a) => a.includes("docker.sock")));
    assert.equal(args.at(-1), "npm ci && npm test");
    assert.equal(args.at(-3), "sh");
  });
  test("archivo concreto usa node --test", () => {
    const { args } = construirOrdenDocker({ node: "20", archivo: "tests/a.test.js", directorioCopia: "/t", conDockerReal: false });
    assert.ok(args.includes("node:20"));
    assert.equal(args.at(-1), "npm ci && node --test tests/a.test.js");
  });
  test("con docker real monta el socket y activa FORGE_TEST_DOCKER", () => {
    const { args } = construirOrdenDocker({ node: "22", archivo: null, directorioCopia: "/t", conDockerReal: true });
    assert.ok(args.includes("/var/run/docker.sock:/var/run/docker.sock"));
    assert.ok(args.includes("FORGE_TEST_DOCKER=1"));
  });
});

describe("WSL", () => {
  test("rutaWindowsAWsl", () => {
    assert.equal(rutaWindowsAWsl("C:\\Users\\a b\\x.tar"), "/mnt/c/Users/a b/x.tar");
    assert.equal(rutaWindowsAWsl("/tmp/x.tar"), "/tmp/x.tar");
  });
  test("listarDistros tolera UTF-16 mal leído y vacíos", () => {
    assert.deepEqual(listarDistros("U\0b\0u\0n\0t\0u\0\r\0\n\0d\0o\0c\0k\0e\0r\0-\0d\0e\0s\0k\0t\0o\0p\0\r\0\n\0"), ["Ubuntu", "docker-desktop"]);
    assert.deepEqual(listarDistros(""), []);
  });
  test("distroUtilizable ignora docker-desktop*", () => {
    assert.equal(distroUtilizable(["docker-desktop", "docker-desktop-data"]), null);
    assert.equal(distroUtilizable(["docker-desktop", "Ubuntu-22.04"]), "Ubuntu-22.04");
  });
  test("construirOrdenWsl copia el tar a ~ y ejecuta", () => {
    const { cmd, args } = construirOrdenWsl({ distro: "Ubuntu", archivo: null, rutaTar: "C:\\t\\r.tar" });
    assert.equal(cmd, "wsl");
    assert.deepEqual(args.slice(0, 3), ["-d", "Ubuntu", "--"]);
    const guion = args.at(-1);
    assert.match(guion, /\/mnt\/c\/t\/r\.tar/);
    assert.match(guion, /npm ci && npm test$/);
    assert.match(guion, /\$HOME\/fragua-prueba/);
  });
});

describe("prerrequisitos", () => {
  test("docker apagado: código 2 y mensaje de arrancar Docker Desktop", () => {
    const r = comprobarDocker(falso({ "docker info": { status: 1, stdout: "", stderr: "cannot connect" } }));
    assert.equal(r.ok, false);
    assert.equal(r.codigo, 2);
    assert.match(r.mensaje, /Arranca Docker Desktop/);
  });
  test("docker ausente", () => {
    const r = comprobarDocker(falso({}));
    assert.equal(r.ok, false);
    assert.equal(r.codigo, 2);
  });
  test("docker responde", () => {
    assert.equal(comprobarDocker(falso({ "docker info": { status: 0, stdout: "ok", stderr: "" } })).ok, true);
  });
  test("wsl sin distro útil explica wsl --install -d Ubuntu", () => {
    const r = comprobarWsl(falso({ "wsl -l -q": { status: 0, stdout: "docker-desktop\n", stderr: "" } }));
    assert.equal(r.ok, false);
    assert.equal(r.codigo, 2);
    assert.match(r.mensaje, /wsl --install -d Ubuntu/);
  });
  test("wsl con distro", () => {
    const r = comprobarWsl(falso({ "wsl -l -q": { status: 0, stdout: "Ubuntu\n", stderr: "" } }));
    assert.equal(r.ok, true);
    assert.equal(r.distro, "Ubuntu");
  });
});

describe("resumirRegistro", () => {
  test("extrae totales", () => {
    assert.deepEqual(resumirRegistro("ℹ tests 120\nℹ pass 115\nℹ fail 2\nℹ skipped 3\n"), { tests: 120, pass: 115, fail: 2, skipped: 3 });
  });
  test("formato TAP", () => {
    assert.equal(resumirRegistro("# tests 5\n# pass 5\n# fail 0\n")?.pass, 5);
  });
  test("sin datos devuelve null", () => assert.equal(resumirRegistro("nada"), null));
});

describe("principal", () => {
  test("--solo-comprobar con Docker apagado sale 2 sin ejecutar nada más", async () => {
    const ej = falso({ "docker info": { status: 1, stdout: "", stderr: "x" } });
    const o = salida();
    const cod = await principal(["--solo-comprobar"], { ejecutor: ej, salida: o });
    assert.equal(cod, 2);
    assert.match(o.texto(), /Arranca Docker Desktop/);
    assert.equal(ej.llamadas.length, 1);
  });
  test("--solo-comprobar con Docker listo sale 0", async () => {
    const ej = falso({ "docker info": { status: 0, stdout: "", stderr: "" } });
    assert.equal(await principal(["--solo-comprobar"], { ejecutor: ej, salida: salida() }), 0);
  });
  test("opciones inválidas salen 64", async () => {
    assert.equal(await principal(["--via", "vm"], { ejecutor: falso({}), salida: salida() }), 64);
  });
  test("ejecución: copia, lanza el contenedor y devuelve su código", async () => {
    const ej = falso({ "docker info": { status: 0, stdout: "", stderr: "" } });
    let orden = null;
    const o = salida();
    const cod = await principal([], {
      ejecutor: ej,
      salida: o,
      prepararCopia: () => ({ directorio: "/t/copia", tar: "/t/r.tar", limpiar() {} }),
      ejecutarLargo: async (cmd, args, { registro }) => {
        orden = [cmd, ...args];
        return { status: 1, registro };
      },
      leerRegistro: () => "ℹ tests 10\nℹ pass 9\nℹ fail 1\nℹ skipped 0\n",
    });
    assert.equal(cod, 1);
    assert.equal(orden?.[0], "docker");
    assert.match(o.texto(), /Pruebas: 10/);
  });
});
