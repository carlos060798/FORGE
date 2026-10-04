// @ts-check
/**
 * Fase C del ciclo verificado: puntos de guardado (T012/T014), respaldo (T016),
 * copia de trabajo (T015) y recuperador de contexto (T025).
 * Cubre CA-003-08, CA-005-04, CA-006-01, CA-006-02, CA-006-03, CA-007-01, CA-007-02, CA-007-03.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { ErrorHiloEnUso, GuardadorArchivos } from "../core/ciclo/checkpoint-archivos.js";
import { aplicar, estadoInicial } from "../core/ciclo/estado.js";
import { Respaldo } from "../core/ciclo/respaldo.js";
import { crearCopia, eliminarCopia } from "../core/sandbox/staging.js";
import { crearRecuperador, registrarRecuperador } from "../core/recuperacion/recuperador.js";

const tmp = (p) => mkdtempSync(join(tmpdir(), p));
const escribir = (dir, ruta, contenido) => {
  mkdirSync(join(dir, ruta, ".."), { recursive: true });
  writeFileSync(join(dir, ruta), contenido);
};
const HILO = "run1:T018";
const estado0 = () => estadoInicial({ id: "T018", agente: "tester" }, { runId: "run1", cwd: "/p" });

describe("T014 — puntos de guardado", () => {
  test("sin puntos guardados devuelve null", () => {
    assert.deepEqual(new GuardadorArchivos(tmp("forge-cp-")).ultimo(HILO), { punto: null, descartados: [] });
  });

  test("CA-006-01: guarda tras cada nodo y devuelve el último con su nodo siguiente", () => {
    const g = new GuardadorArchivos(tmp("forge-cp-"));
    const e1 = estado0();
    const e2 = aplicar(e1, { iteracion: 1 });
    assert.equal(g.guardar(HILO, { nodo: "planner", siguiente: "retriever", estado: e1 }), 1);
    assert.equal(g.guardar(HILO, { nodo: "sandbox", siguiente: "coder", estado: e2 }), 2);

    const { punto, descartados } = g.ultimo(HILO);
    assert.deepEqual(descartados, []);
    assert.equal(punto?.seq, 2);
    assert.equal(punto?.nodo, "sandbox");
    assert.equal(punto?.siguiente, "coder");
    assert.deepEqual(punto?.estado, e2);
  });

  test("el identificador del hilo no produce nombres de archivo inválidos", () => {
    const g = new GuardadorArchivos(tmp("forge-cp-"));
    g.guardar("run:1/..\\T1", { nodo: "qa", siguiente: "coder", estado: estado0() });
    const [carpeta] = readdirSync(g.dir);
    assert.match(carpeta, /^run_1_\.\._T1-[0-9a-f]{8}$/);
    // "a/b" y "a_b" se limpian igual: la huella evita que compartan carpeta
    g.guardar("run:1/..\\T1".replace("/", "_").replace(":", "_"), { nodo: "qa", siguiente: "coder", estado: estado0() });
    assert.equal(readdirSync(g.dir).length, 2);
  });

  test("no deja archivos temporales", () => {
    const g = new GuardadorArchivos(tmp("forge-cp-"));
    g.guardar(HILO, { nodo: "qa", siguiente: "coder", estado: estado0() });
    assert.deepEqual(readdirSync(g.dirHilo(HILO)), ["000001.json"]);
  });

  test("CA-006-02: un punto truncado se descarta y se usa el anterior válido", () => {
    const g = new GuardadorArchivos(tmp("forge-cp-"));
    g.guardar(HILO, { nodo: "planner", siguiente: "retriever", estado: estado0() });
    g.guardar(HILO, { nodo: "qa", siguiente: "coder", estado: estado0() });
    writeFileSync(join(g.dirHilo(HILO), "000002.json"), '{"seq":2,"estado":{"trunc');

    const { punto, descartados } = g.ultimo(HILO);
    assert.equal(punto?.seq, 1);
    assert.deepEqual(descartados, [{ archivo: "000002.json", motivo: "no es JSON válido" }]);
    assert.ok(existsSync(join(g.dirHilo(HILO), "000001.json")), "el punto válido sigue en disco");
  });

  test("CA-006-02: un punto editado a mano se detecta por su huella", () => {
    const g = new GuardadorArchivos(tmp("forge-cp-"));
    g.guardar(HILO, { nodo: "planner", siguiente: "retriever", estado: estado0() });
    g.guardar(HILO, { nodo: "qa", siguiente: "coder", estado: estado0() });
    const ruta = join(g.dirHilo(HILO), "000002.json");
    const editado = JSON.parse(readFileSync(ruta, "utf8"));
    editado.estado.presupuesto.gastado_usd = 0;
    editado.estado.iteracion = 99;
    writeFileSync(ruta, JSON.stringify(editado));

    const { punto, descartados } = g.ultimo(HILO);
    assert.equal(punto?.seq, 1);
    assert.match(descartados[0].motivo, /huella/);
  });

  test("si todos los puntos están dañados, no hay punto y se informa de cada uno", () => {
    const g = new GuardadorArchivos(tmp("forge-cp-"));
    g.guardar(HILO, { nodo: "planner", siguiente: "retriever", estado: estado0() });
    writeFileSync(join(g.dirHilo(HILO), "000001.json"), "basura");
    const r = g.ultimo(HILO);
    assert.equal(r.punto, null);
    assert.equal(r.descartados.length, 1);
  });

  test("la secuencia continúa tras un punto dañado, sin reutilizar su número", () => {
    const g = new GuardadorArchivos(tmp("forge-cp-"));
    g.guardar(HILO, { nodo: "planner", siguiente: "retriever", estado: estado0() });
    writeFileSync(join(g.dirHilo(HILO), "000002.json"), "basura");
    assert.equal(g.guardar(HILO, { nodo: "qa", siguiente: "coder", estado: estado0() }), 3);
  });

  test("CA-006-03: un hilo bloqueado por un proceso vivo no se puede bloquear otra vez", async () => {
    const g = new GuardadorArchivos(tmp("forge-cp-"));
    const otro = spawn(process.execPath, ["-e", "setTimeout(() => {}, 30000)"], { stdio: "ignore" });
    try {
      mkdirSync(g.dirHilo(HILO), { recursive: true });
      writeFileSync(join(g.dirHilo(HILO), "en-curso.lock"), JSON.stringify({ pid: otro.pid, ts: Date.now() }));
      assert.throws(() => g.bloquear(HILO), ErrorHiloEnUso);
    } finally {
      otro.kill();
    }
  });

  test("bloquear y liberar permite volver a bloquear; otro hilo no se ve afectado", () => {
    const g = new GuardadorArchivos(tmp("forge-cp-"));
    const liberar = g.bloquear(HILO);
    assert.throws(() => g.bloquear(HILO), ErrorHiloEnUso);
    g.bloquear("run1:T019")();
    liberar();
    g.bloquear(HILO)();
  });

  test("un bloqueo de un proceso que ya no existe se retira", () => {
    const g = new GuardadorArchivos(tmp("forge-cp-"));
    mkdirSync(g.dirHilo(HILO), { recursive: true });
    writeFileSync(join(g.dirHilo(HILO), "en-curso.lock"), "2147483646");
    g.bloquear(HILO)();
  });
});

describe("T016 — respaldo y restauración", () => {
  test("CA-005-04: restaurar devuelve los archivos modificados y borra los creados", () => {
    const cwd = tmp("forge-resp-");
    escribir(cwd, "src/a.js", "original");
    const r = new Respaldo(cwd, join(cwd, ".sdd", "motor", "run1", "respaldo", "T1"));

    r.registrar("src/a.js");
    writeFileSync(join(cwd, "src", "a.js"), "versión 1");
    r.registrar("src/nuevo.js");
    escribir(cwd, "src/nuevo.js", "creado por la tarea");

    assert.deepEqual(r.restaurar(), { restaurados: ["src/a.js"], borrados: ["src/nuevo.js"] });
    assert.equal(readFileSync(join(cwd, "src", "a.js"), "utf8"), "original");
    assert.ok(!existsSync(join(cwd, "src", "nuevo.js")));
  });

  test("solo el primer registro de una ruta cuenta: se conserva el estado previo a la tarea", () => {
    const cwd = tmp("forge-resp-");
    escribir(cwd, "a.js", "original");
    const r = new Respaldo(cwd, join(cwd, "respaldo"));
    r.registrar("a.js");
    writeFileSync(join(cwd, "a.js"), "iteración 1");
    r.registrar("a.js");
    writeFileSync(join(cwd, "a.js"), "iteración 2");
    r.restaurar();
    assert.equal(readFileSync(join(cwd, "a.js"), "utf8"), "original");
  });

  test("el respaldo sobrevive a un reinicio del proceso", () => {
    const cwd = tmp("forge-resp-");
    escribir(cwd, "a.js", "original");
    const dir = join(cwd, "respaldo");
    new Respaldo(cwd, dir).registrar("a.js");
    writeFileSync(join(cwd, "a.js"), "cambiado");

    const otro = new Respaldo(cwd, dir);
    otro.registrar("a.js"); // no debe pisar el respaldo con el contenido cambiado
    otro.restaurar();
    assert.equal(readFileSync(join(cwd, "a.js"), "utf8"), "original");
  });

  test("restaurar sin nada registrado no hace nada", () => {
    const cwd = tmp("forge-resp-");
    assert.deepEqual(new Respaldo(cwd, join(cwd, "respaldo")).restaurar(), { restaurados: [], borrados: [] });
  });
});

describe("T015 — copia de trabajo sin secretos", () => {
  function proyectoConSecretos() {
    const cwd = tmp("forge-stg-");
    escribir(cwd, "src/app.js", "app");
    escribir(cwd, "tests/app.test.js", "t");
    escribir(cwd, "package.json", "{}");
    escribir(cwd, ".env", "API_KEY=secreto");
    escribir(cwd, "config/.env.produccion", "DB=secreto");
    escribir(cwd, "claves/servidor.pem", "-----BEGIN");
    escribir(cwd, "secrets/token.txt", "t0k3n");
    escribir(cwd, "src/client_secret.json", "{}");
    escribir(cwd, ".git/config", "[core]");
    escribir(cwd, ".sdd/estado.json", "{}");
    escribir(cwd, "node_modules/x/index.js", "x");
    return cwd;
  }
  const listar = (dir, rel = "") => readdirSync(join(dir, rel), { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? listar(dir, `${rel}${e.name}/`) : [`${rel}${e.name}`])).sort();

  test("CA-003-08: copia el código y deja fuera secretos, git, estado y dependencias", () => {
    const cwd = proyectoConSecretos();
    const destino = join(tmp("forge-stg-dest-"), "copia");
    const r = crearCopia(cwd, destino);

    assert.deepEqual(listar(destino), ["package.json", "src/app.js", "tests/app.test.js"]);
    assert.equal(r.copiados, 3);
    for (const e of [".env", ".git", ".sdd", "node_modules", "secrets", "claves/servidor.pem", "config/.env.produccion", "src/client_secret.json"]) {
      assert.ok(r.excluidos.includes(e), `debería excluir ${e}`);
    }
  });

  test("la copia puede vivir dentro del proyecto sin copiarse a sí misma", () => {
    const cwd = tmp("forge-stg-");
    escribir(cwd, "src/a.js", "a");
    const destino = join(cwd, "copia-de-trabajo");
    crearCopia(cwd, destino);
    assert.deepEqual(listar(destino), ["src/a.js"]);
  });

  test("admite exclusiones adicionales y vacía una copia anterior", () => {
    const cwd = tmp("forge-stg-");
    escribir(cwd, "src/a.js", "a");
    escribir(cwd, "datos/grande.bin", "x");
    const destino = join(tmp("forge-stg-dest-"), "copia");
    escribir(destino, "resto-de-antes.txt", "x");
    crearCopia(cwd, destino, { excluir: ["datos"] });
    assert.deepEqual(listar(destino), ["src/a.js"]);
  });

  test("eliminarCopia no deja residuos y tolera que no exista", () => {
    const cwd = tmp("forge-stg-");
    escribir(cwd, "a.js", "a");
    const destino = join(tmp("forge-stg-dest-"), "copia");
    crearCopia(cwd, destino);
    eliminarCopia(destino);
    eliminarCopia(destino);
    assert.ok(!existsSync(destino));
  });
});

describe("T025 — recuperador de contexto por archivos", () => {
  function proyecto() {
    const cwd = tmp("forge-rec-");
    escribir(cwd, "src/a.js", "A".repeat(100));
    escribir(cwd, "src/b.js", "B".repeat(100));
    escribir(cwd, ".env", "SECRETO=1");
    escribir(cwd, "package.json", '{"name":"x"}');
    escribir(cwd, "spec.md", "- [ ] **CA-001-01**: criterio uno (P1)\n- [ ] **CA-001-02**: criterio dos (P1)\notra línea\n");
    return cwd;
  }

  test("CA-007-03: funciona sin índice y ordena tarea, plan y spec", () => {
    const cwd = proyecto();
    const r = crearRecuperador()({
      cwd, maxBytes: 10_000, specPath: join(cwd, "spec.md"),
      tarea: { archivos: ["src/a.js"], cas: ["CA-001-02"] },
      plan: { archivosObjetivo: ["src/b.js", "src/a.js"] },
    });
    assert.deepEqual(r.contexto.fragmentos.map((f) => [f.ruta, f.origen]), [["src/a.js", "tarea"], ["src/b.js", "plan"], ["spec.md", "spec"]]);
    assert.equal(r.contexto.truncado, false);
    assert.ok(r.texto.includes("criterio dos") && !r.texto.includes("criterio uno"));
  });

  test("CA-007-01: el texto entregado, cabeceras y aviso incluidos, nunca supera el máximo", () => {
    const cwd = proyecto();
    for (const maxBytes of [60, 100, 150, 180, 250, 10_000]) {
      const r = crearRecuperador()({ cwd, maxBytes, tarea: { archivos: ["src/a.js", "src/b.js"] }, plan: null });
      assert.ok(Buffer.byteLength(r.texto) <= maxBytes, `maxBytes ${maxBytes}: ${Buffer.byteLength(r.texto)}`);
      assert.equal(r.contexto.bytesTotales, Buffer.byteLength(r.texto));
    }
    const r = crearRecuperador()({ cwd, maxBytes: 150, tarea: { archivos: ["src/a.js", "src/b.js"] }, plan: null });
    assert.equal(r.contexto.truncado, true);
    assert.ok(r.texto.includes("[contexto recortado"));
    assert.ok(crearRecuperador()({ cwd, maxBytes: 10_000, tarea: { archivos: ["src/a.js"] }, plan: null }).contexto.truncado === false);
  });

  test("al recortar no se parte un carácter de varios bytes", () => {
    const cwd = proyecto();
    escribir(cwd, "src/ñ.js", "ñ".repeat(200));
    const r = crearRecuperador()({ cwd, maxBytes: 120, tarea: { archivos: ["src/ñ.js"] }, plan: null });
    assert.ok(!r.texto.includes("\uFFFD"));
    assert.ok(Buffer.byteLength(r.texto) <= 120);
  });

  test("con el tope ya alcanzado, los archivos restantes se omiten", () => {
    const cwd = proyecto();
    const r = crearRecuperador()({ cwd, maxBytes: 100, tarea: { archivos: ["src/a.js", "src/b.js"] }, plan: null });
    assert.equal(r.contexto.fragmentos.length, 1);
    assert.equal(r.contexto.truncado, true);
  });

  test("no entrega secretos ni archivos de fuera del proyecto, pero sí manifiestos", () => {
    const cwd = proyecto();
    const r = crearRecuperador()({ cwd, maxBytes: 10_000, tarea: { archivos: [".env", "../fuera.js", "no-existe.js", "package.json"] }, plan: null });
    assert.deepEqual(r.contexto.fragmentos.map((f) => f.ruta), ["package.json"]);
    assert.ok(!r.texto.includes("SECRETO"));
  });

  test("una tarea sin archivos produce un contexto vacío", () => {
    const r = crearRecuperador()({ cwd: proyecto(), maxBytes: 100, tarea: {}, plan: null });
    assert.deepEqual(r.contexto, { fragmentos: [], bytesTotales: 0, truncado: false });
    assert.equal(r.texto, "");
  });

  test("el plan de un modelo no consigue leer secretos, repositorios anidados ni enlaces a ellos", (t) => {
    const cwd = proyecto();
    for (const [ruta, contenido] of [
      [".npmrc", "//registry.npmjs.org/:_authToken=TOKEN_NPM"], ["id_rsa", "CLAVE_PRIVADA"], ["sub/.git/config", "GIT_ANIDADO"],
      ["config/credentials.json", "CREDENCIALES"], ["deploy/.ssh/id_rsa", "SSH"], ["terraform.tfstate", "ESTADO_TF"], ["secrets/token.txt", "TOKEN"],
    ]) escribir(cwd, ruta, contenido);
    const r = crearRecuperador()({
      cwd, maxBytes: 10_000, tarea: { archivos: [".npmrc", "id_rsa", "sub/.git/config", "config/credentials.json", "deploy/.ssh/id_rsa", "terraform.tfstate", "secrets/token.txt"] }, plan: null,
    });
    assert.deepEqual(r.contexto.fragmentos, []);
    assert.equal(r.texto, "");
    try {
      symlinkSync(join(cwd, ".npmrc"), join(cwd, "inocente.txt"));
    } catch {
      t.skip("este sistema no permite crear enlaces");
      return;
    }
    const e = crearRecuperador()({ cwd, maxBytes: 10_000, tarea: { archivos: ["inocente.txt"] }, plan: null });
    assert.ok(!e.texto.includes("TOKEN_NPM"));
  });

  test("CA-007-02: se puede registrar otra fuente de contexto sin tocar el ciclo", () => {
    registrarRecuperador("fijo", () => ({ contexto: { fragmentos: [], bytesTotales: 0, truncado: false }, texto: "desde otra fuente" }));
    assert.equal(crearRecuperador("fijo")({}).texto, "desde otra fuente");
    assert.throws(() => crearRecuperador("inexistente"), /Recuperador desconocido/);
  });
});
