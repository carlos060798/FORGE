// @ts-check
/**
 * Regresión de los hallazgos de las revisiones independientes (verificación y
 * seguridad, 2026-10-03). Cada test reproduce una entrada que se demostró dañina.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

import { aplicarArchivos, clasificarRuta, esRutaDePrueba, validarRuta } from "../core/ciclo/protocolo-archivos.js";
import { Respaldo } from "../core/ciclo/respaldo.js";
import { cola, redactar } from "../core/ciclo/redactar.js";
import { Diario, claveDe, LibroDeGasto } from "../core/ciclo/diario.js";
import { CicloVerificado } from "../core/ciclo/index.js";
import { GuardadorArchivos } from "../core/ciclo/checkpoint-archivos.js";
import { estadoInicial } from "../core/ciclo/estado.js";
import { POR_DEFECTO } from "../core/ciclo/config.js";
import { crearCopia } from "../core/sandbox/staging.js";
import { comprobarProyecto } from "../core/sandbox/preparar-imagen.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tmp = (p) => mkdtempSync(join(tmpdir(), p));
const escribir = (dir, ruta, contenido) => { mkdirSync(join(dir, ruta, ".."), { recursive: true }); writeFileSync(join(dir, ruta), contenido); };
const motivo = (dir, ruta, o) => /** @type {any} */ (validarRuta(dir, ruta, o)).motivo;

describe("seguridad C1 — vetos por segmento, a cualquier profundidad", () => {
  test("un repositorio git anidado, o un archivo .git, no se puede escribir (ejecutaba comandos del anfitrión)", () => {
    const dir = tmp("forge-h-");
    for (const ruta of ["sub/.git/config", "sub/.git/HEAD", "a/b/c/.git/hooks/pre-commit", ".git", "sub/.git", "tests/.git/config"]) {
      assert.equal(motivo(dir, ruta), "ruta_vetada", ruta);
    }
    const r = aplicarArchivos(dir, [
      { ruta: "sub/.git/config", contenido: '[core]\n  fsmonitor = "echo pwned"' },
      { ruta: "sub/.git/HEAD", contenido: "ref: refs/heads/main" },
      { ruta: ".git", contenido: "gitdir: src/g" },
    ], { rol: "coder" });
    assert.deepEqual(r.escritos, []);
    assert.ok(!existsSync(join(dir, "sub")) && !existsSync(join(dir, ".git")));
  });

  test("tampoco con el rol de pruebas: tests/.git/ cuenta como carpeta de pruebas", () => {
    const dir = tmp("forge-h-");
    const r = aplicarArchivos(dir, [{ ruta: "tests/.git/config", contenido: "x" }], { rol: "qa" });
    assert.deepEqual(r.rechazados.map((x) => x.motivo), ["ruta_vetada"]);
  });

  test("el mismo defecto de anclaje en las demás carpetas vetadas", () => {
    const dir = tmp("forge-h-");
    for (const ruta of ["sub/.claude/settings.json", "sub/node_modules/react/index.js", "config/secrets/prod.json", "deploy/.ssh/authorized_keys", "infra/.aws/config", "x/.kube/config", "x/.docker/config.json", "sub/.sdd/estado.json"]) {
      assert.equal(motivo(dir, ruta), "ruta_vetada", ruta);
    }
  });
});

describe("seguridad A1 — configuración que alguna herramienta ejecuta sola", () => {
  const dir = tmp("forge-h-");

  test("hooks, CI, editor y ejecutor de pruebas exigen revisión humana", () => {
    for (const ruta of [
      ".husky/pre-commit", ".pre-commit-config.yaml", ".yarnrc.yml", ".pnpmfile.cjs", ".mcp.json", ".vscode/tasks.json", ".vscode/settings.json",
      ".eslintrc.js", ".github/workflows/ci.yml", ".devcontainer/devcontainer.json", ".gitignore", ".gitattributes", ".envrc.local",
      "conftest.py", "tests/conftest.py", "sitecustomize.py", "pytest.ini", "tox.ini", "jest.config.js", "vitest.config.ts", "babel.config.js", "eslint.config.mjs",
      "Makefile", "Dockerfile", "docker-compose.yml", "CLAUDE.md", "AGENTS.md", "api/jest.config.cjs",
    ]) {
      const clase = motivo(dir, ruta);
      assert.ok(["configuracion", "ruta_vetada"].includes(clase), `${ruta} → ${clase}`);
    }
  });

  test("más manifiestos de dependencias que antes", () => {
    for (const ruta of ["npm-shrinkwrap.json", "requirements-dev.txt", "setup.cfg", "uv.lock", "bun.lockb", "api/package.json"]) {
      assert.equal(motivo(dir, ruta), "dependencias", ruta);
    }
  });

  test("un cambio de configuración no se aplica y lleva a revisión", () => {
    const d = tmp("forge-h-");
    const r = aplicarArchivos(d, [{ ruta: "src/a.js", contenido: "a" }, { ruta: "conftest.py", contenido: "import pytest; pytest.skip(allow_module_level=True)" }], { rol: "coder" });
    assert.equal(r.requiereRevision, true);
    assert.deepEqual(r.escritos.map((e) => e.ruta), ["src/a.js"]);
    assert.ok(!existsSync(join(d, "conftest.py")));
  });

  test("el código normal se sigue aceptando", () => {
    for (const ruta of ["src/index.js", "src/util/ayuda.ts", "lib/modelo.py", "docs/guia.md", "src/config.js", "src/setup.js"]) {
      assert.equal(validarRuta(dir, ruta).ok, true, ruta);
    }
  });
});

describe("seguridad A2 — enlaces", () => {
  test("una carpeta enlazada a .git no sirve para escribir dentro del repositorio", (t) => {
    const dir = tmp("forge-h-");
    mkdirSync(join(dir, ".git", "hooks"), { recursive: true });
    try { symlinkSync(join(dir, ".git"), join(dir, "g"), "junction"); } catch { t.skip("no se pueden crear enlaces"); return; }
    const r = aplicarArchivos(dir, [{ ruta: "g/hooks/pre-commit", contenido: "#!/bin/sh\necho pwned" }], { rol: "coder" });
    assert.deepEqual(r.escritos, []);
    assert.ok(!existsSync(join(dir, ".git", "hooks", "pre-commit")));
  });

  test("una carpeta enlazada fuera del proyecto sigue rechazada", (t) => {
    const base = tmp("forge-h-");
    const dir = join(base, "proy"); mkdirSync(dir);
    mkdirSync(join(base, "fuera"));
    try { symlinkSync(join(base, "fuera"), join(dir, "salida"), "junction"); } catch { t.skip("no se pueden crear enlaces"); return; }
    assert.equal(motivo(dir, "salida/x.js"), "fuera_del_proyecto");
  });

  test("un archivo que es un enlace (también roto) no se escribe a través de él", (t) => {
    const base = tmp("forge-h-");
    const dir = join(base, "proy"); mkdirSync(dir);
    try { symlinkSync(join(base, "fuera", "nuevo.sh"), join(dir, "colgado.txt"), "file"); } catch { t.skip("este sistema no permite enlaces de archivo"); return; }
    assert.equal(motivo(dir, "colgado.txt"), "enlace_simbolico");
    assert.ok(!existsSync(join(base, "fuera")));
  });
});

describe("seguridad M3, M6 y B1", () => {
  test("M3: la misma ruta con otras mayúsculas no corrompe el respaldo", () => {
    const cwd = tmp("forge-h-");
    escribir(cwd, "src/a.js", "ORIGINAL DEL USUARIO");
    const r = new Respaldo(cwd, join(cwd, "respaldo"));
    r.registrar("src/a.js");
    writeFileSync(join(cwd, "src", "a.js"), "MODELO v1");
    r.registrar("SRC/A.JS");
    writeFileSync(join(cwd, "src", "a.js"), "MODELO v2");
    r.restaurar();
    assert.equal(readFileSync(join(cwd, "src", "a.js"), "utf8"), "ORIGINAL DEL USUARIO");
  });

  test("M3: dos rutas que solo difieren en mayúsculas en un mismo bloque: solo se escribe la primera", () => {
    const dir = tmp("forge-h-");
    const r = aplicarArchivos(dir, [{ ruta: "src/a.js", contenido: "v1" }, { ruta: "SRC/A.JS", contenido: "v2" }], { rol: "coder" });
    assert.deepEqual(r.escritos.map((e) => e.ruta), ["src/a.js"]);
    assert.deepEqual(r.rechazados.map((x) => x.motivo), ["ruta_duplicada"]);
  });

  test("restaurar también borra las carpetas que creó la tarea y quedaron vacías", () => {
    const cwd = tmp("forge-h-");
    const r = new Respaldo(cwd, join(cwd, "respaldo"));
    r.registrar("nuevo/profundo/a.js");
    escribir(cwd, "nuevo/profundo/a.js", "x");
    r.restaurar();
    assert.ok(!existsSync(join(cwd, "nuevo")));
  });

  test("M6: el agente de pruebas ya no escribe código de producción bajo src/spec/ o src/test/", () => {
    for (const ruta of ["src/spec/prod.js", "src/test/prod.js", "lib/tests/x.js"]) assert.equal(esRutaDePrueba(ruta), false, ruta);
    for (const ruta of ["tests/a.js", "test/a.py", "spec/a.js", "src/__tests__/a.ts", "src/a.test.ts", "pkg/test_a.py", "test.js", "foo-test.js", "foo_test.js", "tests.py"]) assert.equal(esRutaDePrueba(ruta), true, ruta);
    const dir = tmp("forge-h-");
    const r = aplicarArchivos(dir, [{ ruta: "src/spec/prod.js", contenido: "x" }, { ruta: "tests/conftest.py", contenido: "x" }, { ruta: "tests/.npmrc", contenido: "x" }], { rol: "qa" });
    assert.deepEqual(r.escritos, []);
  });

  test("M2 (parcial): el implementador ya no puede escribir pruebas con nombres como test.js o foo_test.js", () => {
    const dir = tmp("forge-h-");
    const r = aplicarArchivos(dir, [{ ruta: "test.js", contenido: "x" }, { ruta: "foo_test.js", contenido: "x" }, { ruta: "tests.py", contenido: "x" }], { rol: "coder" });
    assert.deepEqual(r.rechazados.map((x) => x.motivo), ["prueba_inmutable", "prueba_inmutable", "prueba_inmutable"]);
  });

  test("B1: una ruta que es un directorio, o que cuelga de un archivo, se rechaza sin lanzar", () => {
    const dir = tmp("forge-h-");
    escribir(dir, "src/a.js", "a");
    const r = aplicarArchivos(dir, [{ ruta: "src", contenido: "x" }, { ruta: "src/a.js/b.js", contenido: "x" }, { ruta: "src/ok.js", contenido: "ok" }], { rol: "coder" });
    assert.deepEqual(r.rechazados.map((x) => x.motivo), ["error_escritura", "error_escritura"]);
    assert.deepEqual(r.escritos.map((e) => e.ruta), ["src/ok.js"]);
  });

  test("clasificarRuta distingue las cuatro clases", () => {
    assert.equal(clasificarRuta("src/a.js"), null);
    assert.equal(clasificarRuta("package.json"), "dependencias");
    assert.equal(clasificarRuta(".husky/pre-commit"), "configuracion");
    assert.equal(clasificarRuta("a/.git/config"), "ruta_vetada");
  });
});

describe("seguridad A3 y M1 — la copia de trabajo y la redacción", () => {
  test("A3: la copia no lleva ninguno de los secretos que antes entraban", () => {
    const cwd = tmp("forge-h-");
    const secretos = [
      ".npmrc", ".netrc", ".pypirc", ".git-credentials", "id_rsa", "id_ed25519", "cert.pfx", "release.jks", "terraform.tfstate", "prod.tfvars",
      ".docker/config.json", ".kube/config", "config/secrets/prod.json", "deploy/.ssh/id_rsa", "infra/.aws/config", "service-account.json",
      "gcp-key.json", ".htpasswd", "token.json", ".dev.vars", "dump.sql", ".claude/settings.local.json", "sub/.git/config", ".vscode/settings.json",
    ];
    for (const s of secretos) escribir(cwd, s, "SECRETO");
    escribir(cwd, "src/app.js", "app");
    const destino = join(tmp("forge-h-dest-"), "copia");
    const r = crearCopia(cwd, destino);
    assert.equal(r.copiados, 1);
    for (const s of secretos) assert.ok(!existsSync(join(destino, s)), `${s} entró en la copia`);
  });

  test("B3: los formatos que antes pasaban sin redactar", () => {
    const casos = [
      "DB_PASSWORD=hunter2hunter2", "AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG", '{"password": "hunter2hunter2"}', '{"apiKey":"abcd1234efgh5678"}',
      ["sk_", "live_abcdefghijklmnopqrstuvwx"].join(""), ["xox", "b-1234567890-abcdefghij"].join(""), ["AIza", "SyA1234567890abcdefghijklmnopqrstuv"].join(""), "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijk",
      ["github_", "pat_11ABCDEFG0123456789abcdefghijklmnop"].join(""), ["glp", "at-abcdefghijklmnopqrst"].join(""), ["np", "m_abcdefghijklmnopqrstuvwxyz0123456789"].join(""), "//registry.npmjs.org/:_authToken=TOKENSECRETO",
      "https://usuario:contrasena@servidor.com/repo.git", "Authorization: Basic dXN1YXJpbzpjbGF2ZQ==",
    ];
    for (const c of casos) {
      const limpio = redactar(c);
      assert.ok(limpio.includes("REDACTADO"), `${c} → ${limpio}`);
      assert.ok(!/hunter2|wJalr|abcd1234|abcdefghijklmnopqrstuvwx|1234567890-abcdef|TOKENSECRETO|contrasena|dXN1YXJpb|AIzaSyA1/.test(limpio), `${c} → ${limpio}`);
    }
    assert.equal(redactar("AssertionError: 3 !== 4 en suma.js:12"), "AssertionError: 3 !== 4 en suma.js:12");
  });

  test("B3: una clave privada cortada por el recorte tampoco pasa", () => {
    const salida = "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA" + "A".repeat(200) + "\n" + "x".repeat(7000);
    const c = cola(salida, 8192);
    assert.ok(!c.includes("MIIEow") && !c.includes("AAAAAAAAAA"));
    // y se redacta antes de recortar: lo que queda del final no deja pasar el cuerpo de la clave
    assert.ok(Buffer.byteLength(cola("y".repeat(20_000), 100)) <= 100);
  });

  test("M1: un fallo al borrar la copia no impide la siguiente ejecución", async () => {
    const { SandboxRunner } = await import("../core/sandbox/sandbox-runner.js");
    const { DockerCli } = await import("../core/sandbox/docker-cli.js");
    const cwd = tmp("forge-h-");
    escribir(cwd, "package.json", "{}");
    const base = { code: 0, stdout: "", stderr: "", timedOut: false };
    const cli = new DockerCli({ ejecutar: async (args) => (args[0] === "version" ? { ...base, stdout: "29.0.0" } : { ...base }) });
    const sr = new SandboxRunner({ runId: "r1", dirMotor: join(cwd, ".sdd", "motor", "r1"), lenguaje: "javascript", testCmd: "npm test", cli });
    const a = await sr.test(cwd);
    const b = await sr.test(cwd);
    assert.equal(a.ok && b.ok, true);
    assert.deepEqual(sr.copiasSinBorrar, []);
  });

  test("15: un proyecto no cubierto se detecta antes de gastar nada", () => {
    const cwd = tmp("forge-h-");
    assert.match(String(comprobarProyecto(cwd, "unknown")), /no cubre todavía/);
    escribir(cwd, "pyproject.toml", "[project]\ndependencies = ['requests']");
    assert.match(String(comprobarProyecto(cwd, "python")), /requirements\.txt/);
    escribir(cwd, "requirements.txt", "requests");
    assert.equal(comprobarProyecto(cwd, "python"), null);
    assert.equal(comprobarProyecto(cwd, "javascript"), null);
  });
});

describe("candado atómico (hallazgo 5)", () => {
  test("dos procesos que se disputan un candado huérfano: nunca lo toman los dos", async () => {
    const dir = tmp("forge-h-");
    const script = join(dir, "carrera.mjs");
    writeFileSync(script, `
      import { adquirir, ErrorBloqueado } from ${JSON.stringify(pathToFileURL(join(ROOT, "core", "ciclo", "candado.js")).href)};
      const [archivo, inicio] = process.argv.slice(2);
      while (Date.now() < Number(inicio)) { /* espera activa: ambos arrancan a la vez */ }
      try {
        const liberar = adquirir(archivo, "x");
        console.log("OK");
        await new Promise((r) => setTimeout(r, 2500));
        liberar();
      } catch (e) {
        console.log(e instanceof ErrorBloqueado ? "BLOQUEADO" : "ERROR " + e.message);
      }
    `);

    const lanzar = (archivo, inicio) => new Promise((res) => {
      let salida = "";
      const p = spawn(process.execPath, [script, archivo, String(inicio)], { stdio: ["ignore", "pipe", "inherit"] });
      p.stdout.on("data", (d) => (salida += d));
      p.on("close", () => res(salida.trim()));
    });

    for (let ronda = 0; ronda < 8; ronda++) {
      const archivo = join(dir, `candado-${ronda}.lock`);
      writeFileSync(archivo, JSON.stringify({ pid: 2147483646, ts: Date.now() })); // dueño que no existe
      const inicio = Date.now() + 1000;
      const [a, b] = await Promise.all([lanzar(archivo, inicio), lanzar(archivo, inicio)]);
      const tomaron = [a, b].filter((x) => x === "OK").length;
      assert.equal(tomaron, 1, `ronda ${ronda}: ${a} / ${b}`);
      assert.ok([a, b].includes("BLOQUEADO"), `ronda ${ronda}: ${a} / ${b}`);
    }
  });

  test("un candado vacío o dañado se trata como huérfano", async () => {
    const { adquirir } = await import("../core/ciclo/candado.js");
    const dir = tmp("forge-h-");
    for (const contenido of ["", "no es json", '{"pid":"x"}']) {
      const archivo = join(dir, "c.lock");
      writeFileSync(archivo, contenido);
      adquirir(archivo, "x")();
    }
  });

  test("un candado propio de otro proceso vivo no se retira, y soltarlo solo borra el propio", async () => {
    const { adquirir, ErrorBloqueado } = await import("../core/ciclo/candado.js");
    const dir = tmp("forge-h-");
    const archivo = join(dir, "c.lock");
    const liberar = adquirir(archivo, "x");
    assert.throws(() => adquirir(archivo, "x"), ErrorBloqueado);
    writeFileSync(archivo, JSON.stringify({ pid: 999999, ts: Date.now() }));
    liberar();
    assert.ok(existsSync(archivo), "no debe borrar el candado de otro");
  });
});

// ── Reanudación, gasto y decisiones ──────────────────────────────────────────

const json = (o) => "```json\n" + JSON.stringify(o) + "\n```";
const PLAN = json({ pasos: [], archivosObjetivo: ["src/suma.js"] });
const PRUEBAS = json({ archivos: [{ ruta: "tests/suma.test.js", contenido: "// prueba" }] });
const impl = (v) => json({ archivos: [{ ruta: "src/suma.js", contenido: `// v${v}` }] });
const TAREA = { id: "T1", agente: "desarrollador-backend", prompt: "Implementa suma", archivos: ["src/suma.js"] };
const FALLA = { exitCode: 1 };
const PASA = { exitCode: 0 };
/** 10 000 tokens de sonnet = 0,03 USD */
const USO = { inputTokens: 10_000, outputTokens: 0, modelo: "claude-sonnet-4-6", proveedor: "anthropic" };

function entorno({ salidas = {}, ejecuciones = [], config = {}, uso = USO } = {}) {
  const cwd = tmp("forge-h-motor-");
  escribir(cwd, "src/suma.js", "// original");
  const guion = { arquitecto: [PLAN, PLAN], tester: [PRUEBAS, PRUEBAS], "desarrollador-backend": [], ...salidas };
  const cola = [...ejecuciones];
  const llamadas = [];
  const eventos = [];
  const opciones = {
    cwd, runId: "r1", testCmd: "npm test",
    config: { ...POR_DEFECTO, ...config, motor: { ...POR_DEFECTO.motor, grafo: "propio", ...config.motor }, presupuesto: { ...POR_DEFECTO.presupuesto, ...config.presupuesto } },
    log: { append: (type, payload, meta) => eventos.push({ type, payload, meta }) },
    aliasDe: () => "sonnet",
    llamar: async (p) => {
      llamadas.push(p);
      const s = guion[p.agente]?.shift();
      if (s === undefined) throw new Error(`guion agotado para ${p.agente}`);
      return { ok: true, output: s, ...uso };
    },
    runner: { test: async () => {
      const r = cola.shift();
      if (r === undefined) throw new Error("guion de ejecuciones agotado");
      return { stdout: "# pass 1\n", stderr: "", timedOut: false, infraError: false, durationMs: 1, ...r };
    } },
  };
  return { cwd, opciones, llamadas, eventos, cola, ciclo: () => new CicloVerificado(opciones) };
}

describe("hallazgo 2 — un corte dentro de un nodo no repite ni pierde lo ya pagado", () => {
  test("la respuesta ya recibida se recupera del diario y el gasto cuenta cada llamada una vez", async () => {
    const e = entorno({ salidas: { "desarrollador-backend": [impl(1)] }, ejecuciones: [] });
    // El proceso muere en qa, después de que el modelo respondiera y de escribir las pruebas
    await assert.rejects(e.ciclo().ejecutar(TAREA), /guion de ejecuciones agotado/);
    assert.equal(e.llamadas.length, 2, "planner y tester");

    e.cola.push(FALLA, PASA);
    const r = await e.ciclo().ejecutar(TAREA);
    assert.equal(r.status, "completada");
    assert.equal(e.llamadas.length, 3, "tester no se llamó otra vez; solo se añadió coder");
    assert.equal(r.estado.presupuesto.llamadas, 3);
    assert.ok(Math.abs(r.estado.presupuesto.gastado_usd - 0.09) < 1e-9, String(r.estado.presupuesto.gastado_usd));
  });

  test("no quedan pruebas huérfanas: lo escrito tras el corte coincide con lo registrado", async () => {
    const e = entorno({ salidas: { "desarrollador-backend": [impl(1)] }, ejecuciones: [] });
    await assert.rejects(e.ciclo().ejecutar(TAREA), /guion/);
    e.cola.push(FALLA, PASA);
    const r = await e.ciclo().ejecutar(TAREA);
    assert.deepEqual(r.estado.pruebas.archivos.map((a) => a.ruta), ["tests/suma.test.js"]);
    assert.equal(readFileSync(join(e.cwd, "tests", "suma.test.js"), "utf8"), "// prueba");
  });

  test("el diario solo cubre lo que está en vuelo: una vez guardado el punto, una petición idéntica vuelve a pagarse", async () => {
    const dir = tmp("forge-h-");
    const d = new Diario(dir);
    const clave = claveDe({ agente: "tester", modeloAlias: "sonnet", userPrompt: "x" });
    assert.equal(d.obtener("h", clave), null);
    d.anotar("h", clave, { ok: true, output: "a" });
    assert.deepEqual(d.obtener("h", clave), { ok: true, output: "a" });
    assert.equal(d.obtener("otro", clave), null);
    // El modelo no forma parte de la clave: degradar a otro tras el corte no debe repetir la llamada pagada
    assert.equal(clave, claveDe({ agente: "tester", modeloAlias: "haiku", userPrompt: "x" }));
    assert.notEqual(clave, claveDe({ agente: "tester", userPrompt: "y" }));
    d.limpiar("h");
    assert.equal(d.obtener("h", clave), null);
  });

  test("las respuestas con error no se guardan: al reanudar se vuelve a intentar", async () => {
    const e = entorno({});
    let intentos = 0;
    e.opciones.llamar = async (p) => { e.llamadas.push(p); intentos++; return intentos === 1 ? { ok: false, error: "503" } : { ok: true, output: PLAN, ...USO }; };
    const a = await e.ciclo().ejecutar(TAREA);
    assert.equal(a.estado.revision?.motivo, "infraestructura");
    assert.equal(e.ciclo().libro.total().llamadas, 0, "una llamada fallida no cuesta");
  });
});

describe("hallazgos 3 y 10 — el gasto y el tope son de la sesión", () => {
  test("lo gastado por una tarea cortada cuenta para la siguiente", async () => {
    const e = entorno({ salidas: { "desarrollador-backend": [impl(1)] }, ejecuciones: [] });
    await assert.rejects(e.ciclo().ejecutar(TAREA), /guion/);
    e.cola.push(FALLA, PASA);
    const r2 = await e.ciclo().ejecutar({ ...TAREA, id: "T2" });
    assert.equal(r2.status, "completada");
    // T1 gastó 2 llamadas (0,06) antes de cortarse; T2 hizo 3 (0,09)
    assert.equal(r2.estado.presupuesto.llamadas, 5);
    assert.ok(Math.abs(r2.estado.presupuesto.gastado_usd - 0.15) < 1e-9, String(r2.estado.presupuesto.gastado_usd));
  });

  test("el libro suma por llamada y es la fuente de verdad", () => {
    const l = new LibroDeGasto(tmp("forge-h-"));
    l.anotar({ taskId: "T1", usd: 0.1, inputTokens: 5, outputTokens: 1 });
    l.anotar({ taskId: "T2", usd: 0.25, inputTokens: 7, outputTokens: 2 });
    assert.deepEqual(l.total(), { usd: 0.35, llamadas: 2, tokens_in: 12, tokens_out: 3 });
    assert.equal(l.tope(), null);
    l.guardarTope(4);
    assert.equal(l.tope(), 4);
  });

  test("hallazgo 10: ampliar el tope en una tarea vale para las siguientes", async () => {
    // 100 000 tokens de sonnet = 0,30 USD por llamada
    const CARO = { inputTokens: 100_000, outputTokens: 0, modelo: "claude-sonnet-4-6", proveedor: "anthropic" };
    const e = entorno({
      uso: CARO, config: { presupuesto: { tope_usd: 1, umbral_degradacion_usd: 0.8 } },
      salidas: { arquitecto: [PLAN, PLAN], tester: [PRUEBAS, PRUEBAS], "desarrollador-backend": [impl(1), impl(2), impl(3), impl(4)] },
      ejecuciones: [FALLA, FALLA, FALLA, PASA, FALLA, PASA],
    });
    const a = await e.ciclo().ejecutar(TAREA);
    assert.equal(a.estado.revision?.motivo, "presupuesto");
    const b = await e.ciclo().ejecutar(TAREA, { decision: "continuar", presupuestoExtra: 2 });
    assert.equal(b.status, "completada");
    assert.equal(e.ciclo().libro.tope(), 3);

    const c = await e.ciclo().ejecutar({ ...TAREA, id: "T2" });
    assert.equal(c.estado.presupuesto.tope_usd, 3, "la tarea siguiente no vuelve a empezar con el tope original");
    assert.notEqual(c.estado.revision?.motivo, "presupuesto");
  });
});

describe("CA-007-02 — la fuente de contexto se elige por configuración", () => {
  test("el ciclo usa la fuente indicada en motor.recuperador, con el tope de bytes de la configuración", async () => {
    const { registrarRecuperador } = await import("../core/recuperacion/recuperador.js");
    let recibida = /** @type {any} */ (null);
    registrarRecuperador("prueba-config", (entrada) => {
      recibida = entrada;
      return { contexto: { fragmentos: [], bytesTotales: 0, truncado: false }, texto: "CONTEXTO_DE_OTRA_FUENTE" };
    });
    const e = entorno({ salidas: { "desarrollador-backend": [impl(1)] }, ejecuciones: [FALLA, PASA], config: { motor: { recuperador: "prueba-config" } } });
    const prompts = [];
    const original = e.opciones.llamar;
    e.opciones.llamar = async (p) => { prompts.push(p.userPrompt); return original(p); };

    const r = await e.ciclo().ejecutar(TAREA);
    assert.equal(r.status, "completada");
    assert.equal(recibida?.maxBytes, 65536);
    assert.ok(prompts.some((p) => p.includes("CONTEXTO_DE_OTRA_FUENTE")), "los agentes recibieron el contexto de la otra fuente");
  });

  test("una fuente desconocida es un error claro, no un contexto vacío", async () => {
    const e = entorno({ config: { motor: { recuperador: "no-existe" } } });
    await assert.rejects(e.ciclo().ejecutar(TAREA), /Recuperador desconocido/);
  });
});

describe("hallazgos 6 y 7 — las decisiones no se saltan los topes", () => {
  test("6: si el gasto se agota en la última iteración, ampliar solo el presupuesto no regala una iteración", async () => {
    // 33 334 tokens de sonnet ≈ 0,10 USD: planner, qa y 5 implementaciones = 7 llamadas = 0,70
    const e = entorno({
      uso: { inputTokens: 33_334, outputTokens: 0, modelo: "claude-sonnet-4-6", proveedor: "anthropic" },
      config: { presupuesto: { tope_usd: 0.7, umbral_degradacion_usd: 0.65 } },
      salidas: { "desarrollador-backend": [1, 2, 3, 4, 5, 6].map(impl) },
      ejecuciones: [FALLA, FALLA, FALLA, FALLA, FALLA, FALLA, PASA],
    });
    const a = await e.ciclo().ejecutar(TAREA);
    assert.equal(a.estado.iteracion, 5);
    assert.equal(a.estado.revision?.motivo, "presupuesto");

    const antes = e.llamadas.length;
    await assert.rejects(e.ciclo().ejecutar(TAREA, { decision: "continuar", presupuestoExtra: 5 }), /No quedan iteraciones/);
    assert.equal(e.llamadas.length, antes, "no hubo una sexta llamada");
    assert.ok(!e.eventos.some((x) => x.type === "ciclo:revision_decidida"), "una decisión rechazada no deja rastro");

    const b = await e.ciclo().ejecutar(TAREA, { decision: "continuar", presupuestoExtra: 5, iteracionesExtra: 1 });
    assert.equal(b.status, "completada");
    assert.equal(b.estado.iteracion, 6);
  });

  test("7: una decisión para una tarea que no está en revisión se rechaza y no gasta", async () => {
    const e = entorno({ salidas: { "desarrollador-backend": [impl(1)] }, ejecuciones: [] });
    await assert.rejects(e.ciclo().ejecutar(TAREA), /guion/);
    const antes = e.llamadas.length;
    await assert.rejects(e.ciclo().ejecutar(TAREA, { decision: "aceptar" }), /no está en revisión/);
    assert.equal(e.llamadas.length, antes);

    e.cola.push(FALLA, PASA);
    const r = await e.ciclo().ejecutar(TAREA);
    assert.equal(r.estado.resultado, "exito", "no quedó guardada ninguna decisión que se aplicara después");
  });

  test("11: un fallo del entorno lleva su causa en la revisión", async () => {
    const e = entorno({ salidas: { "desarrollador-backend": [impl(1)] }, ejecuciones: [FALLA, { exitCode: null, infraError: true, stderr: "No se pudo preparar la imagen: pip falló" }] });
    const r = await e.ciclo().ejecutar(TAREA);
    assert.equal(r.estado.revision?.motivo, "infraestructura");
    assert.match(String(r.estado.revision?.detalle), /pip falló/);
  });
});

describe("seguridad M5 — el estado de .sdd/motor no se obedece sin validar", () => {
  test("un identificador de sesión que sale de .sdd/motor se rechaza", () => {
    const e = entorno();
    for (const runId of ["../../..", "..", "a/b", "a\\b", "", "x y"]) {
      assert.throws(() => new CicloVerificado({ ...e.opciones, runId }), /Identificador de sesión no válido/, JSON.stringify(runId));
    }
  });

  test("un punto de guardado de otro proyecto o de otra tarea no se obedece", async () => {
    const e = entorno();
    const otro = estadoInicial(TAREA, { runId: "r1", cwd: tmp("forge-h-otro-") });
    const g = new GuardadorArchivos(join(e.cwd, ".sdd", "motor", "r1"));
    g.guardar("r1:T1", { nodo: "planner", siguiente: "retriever", estado: otro });
    await assert.rejects(e.ciclo().ejecutar(TAREA), /no pertenece a esta sesión o a este proyecto/);
    assert.equal(e.llamadas.length, 0);
  });
});

// ── CLI ──────────────────────────────────────────────────────────────────────

describe("CLI — hallazgos 1, 13, 14 y modo clásico", () => {
  const CLI = join(ROOT, "cli", "index.js");
  const { spawnSync } = require_child();

  /** Entorno sin docker en el PATH y con el proveedor de pruebas. */
  function entornoSinDocker() {
    const env = { ...process.env, FORGE_LLM_PROVIDER: "stub", ANTHROPIC_API_KEY: "" };
    for (const k of Object.keys(env)) if (/^path$/i.test(k)) delete env[k];
    env.PATH = dirname(process.execPath);
    return env;
  }
  const forge = (dir, args) => spawnSync(process.execPath, [CLI, ...args], { cwd: dir, encoding: "utf8", env: entornoSinDocker() });

  function proyecto({ estado = { pipeline_step: "code" }, tareas, eventos = [], sesion } = {}) {
    const dir = tmp("forge-h-cli-");
    mkdirSync(join(dir, ".sdd"), { recursive: true });
    writeFileSync(join(dir, ".sdd", "estado.json"), JSON.stringify(estado));
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "demo", scripts: { test: "node --test" } }));
    if (tareas) writeFileSync(join(dir, ".sdd", "estado-tareas.json"), JSON.stringify({ tareas }));
    if (eventos.length) {
      const lineas = eventos.map(([type, taskId, payload], i) => JSON.stringify({ id: `${i}`, type, ts: new Date().toISOString(), taskId, payload: payload ?? {} }));
      writeFileSync(join(dir, ".sdd", "events.jsonl"), lineas.join("\n") + "\n");
    }
    if (sesion) { mkdirSync(join(dir, ".sdd", "motor"), { recursive: true }); writeFileSync(join(dir, ".sdd", "motor", "sesion.json"), JSON.stringify(sesion)); }
    return dir;
  }
  const T = (id) => ({ id, agente: "arquitecto", prompt: `Tarea ${id}` });

  test("CA-003-07: sin Docker, el ciclo sale con el código 4 y no cambia nada", () => {
    const dir = proyecto({ estado: { pipeline_step: "tasks" }, tareas: [T("T1")] });
    const r = forge(dir, ["run", "--motor", "ciclo"]);
    assert.equal(r.status, 4, r.stdout + r.stderr);
    assert.match(r.stderr, /Docker no está disponible/);
    assert.match(r.stderr, /no ejecuta código generado fuera del entorno aislado/);
  });

  test("14: sin Docker, la etapa del proyecto no llega a avanzar de tasks a code", () => {
    const dir = proyecto({ estado: { pipeline_step: "tasks" }, tareas: [T("T1")] });
    forge(dir, ["run", "--motor", "ciclo"]);
    assert.equal(JSON.parse(readFileSync(join(dir, ".sdd", "estado.json"), "utf8")).pipeline_step, "tasks");
  });

  test("1: un sesion.json antiguo no convierte en ciclo un resume clásico", () => {
    const dir = proyecto({
      tareas: [T("T1")],
      eventos: [["task_started", "T1"], ["task_failed", "T1", { error: "falló" }]],
      sesion: { runId: "run-antigua-1", modo: "ciclo", creada: "2026-01-01T00:00:00Z" },
    });
    const r = forge(dir, ["resume"]);
    assert.notEqual(r.status, 4, "no debe exigir Docker: " + r.stdout + r.stderr);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.ok(!(r.stdout + r.stderr).includes("ciclo verificado"));
  });

  test("13: con una tarea fallida y otra en revisión, resume relanza la fallida y avisa de la otra", () => {
    const dir = proyecto({
      tareas: [T("T1"), T("T2")],
      eventos: [["task_started", "T1"], ["task_failed", "T1", { error: "falló" }], ["task_started", "T2"], ["task_paused", "T2", { motivo: "presupuesto" }]],
    });
    const r = forge(dir, ["resume"]);
    assert.equal(r.status, 3, r.stdout + r.stderr);
    assert.match(r.stdout, /Relanzando 1 tarea/);
    assert.match(r.stdout, /T2: se alcanzó el tope de gasto/);
    const estados = readFileSync(join(dir, ".sdd", "events.jsonl"), "utf8");
    assert.ok(estados.includes('"type":"task_completed"'), "T1 se relanzó y terminó");
  });

  test("13: --tarea limita la decisión a una; una tarea que no existe se rechaza", () => {
    const dir = proyecto({
      tareas: [T("T1"), T("T2")],
      eventos: [["task_started", "T1"], ["task_paused", "T1", { motivo: "iteraciones" }], ["task_started", "T2"], ["task_paused", "T2", { motivo: "presupuesto" }]],
    });
    const r = forge(dir, ["resume", "--decision", "abortar", "--tarea", "T9"]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /No hay ninguna tarea en revisión llamada: T9/);
  });

  test("M4: el modo clásico se niega a ejecutar sobre una sesión del ciclo sin terminar", () => {
    const dir = proyecto({ tareas: [T("T1")] });
    const runId = "run-pausada-1";
    const g = new GuardadorArchivos(join(dir, ".sdd", "motor", runId));
    const e = estadoInicial({ id: "T1", agente: "arquitecto" }, { runId, cwd: dir });
    g.guardar(`${runId}:T1`, { nodo: "coder", siguiente: "revision_humana", estado: { ...e, resultado: "revision_pendiente", revision: { motivo: "iteraciones", reanudarEn: "coder" } } });
    writeFileSync(join(dir, ".sdd", "motor", "sesion.json"), JSON.stringify({ runId, modo: "ciclo", creada: "2026-01-01T00:00:00Z" }));

    const r = forge(dir, ["run"]);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stderr, /tareas del ciclo verificado sin terminar \(T1\)/);

    assert.equal(forge(dir, ["run", "--force", "true"]).status, 0, "con --force el usuario lo asume");
  });

  test("M4: relanzar en clásico una tarea con puntos de guardado del ciclo se rechaza", () => {
    const dir = proyecto({ tareas: [T("T1")], eventos: [["task_started", "T1"], ["task_failed", "T1", { error: "x" }]] });
    const runId = "run-pausada-2";
    const g = new GuardadorArchivos(join(dir, ".sdd", "motor", runId));
    g.guardar(`${runId}:T1`, { nodo: "coder", siguiente: "sandbox", estado: estadoInicial({ id: "T1", agente: "arquitecto" }, { runId, cwd: dir }) });
    writeFileSync(join(dir, ".sdd", "motor", "sesion.json"), JSON.stringify({ runId, modo: "ciclo", creada: "2026-01-01T00:00:00Z" }));

    const r = forge(dir, ["resume", "--motor", "clasico"]);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stderr, /ejecutaría en tu equipo, sin aislamiento/);
    // sin pedir nada, resume usa el ciclo (y sin Docker sale con 4, no ejecuta en el anfitrión)
    assert.equal(forge(dir, ["resume"]).status, 4);
  });

  test("CA-008-01: sin --motor, forge run completa las tareas como siempre y no toca .sdd/motor", () => {
    const dir = proyecto({ tareas: [T("T1"), { ...T("T2"), dependencias: ["T1"] }] });
    const r = forge(dir, ["run"]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /Pipeline completado: 2 tareas/);
    assert.ok(!existsSync(join(dir, ".sdd", "motor")));
    const tipos = readFileSync(join(dir, ".sdd", "events.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).type);
    assert.equal(tipos.filter((t) => t === "task_completed").length, 2);
    assert.ok(!tipos.some((t) => t.startsWith("ciclo:")));
  });
});

function require_child() {
  // import dinámico síncrono no existe en ESM: se usa createRequire
  return createRequire(import.meta.url)("node:child_process");
}
import { createRequire } from "node:module";
