// @ts-check
/**
 * Tercera revisión independiente (2026-10-10): N-01 y N-03.
 * - N-01: la intención del diario daba por aplicada una edición que no se aplicó si el archivo
 *   cambiaba por otra causa entre el corte y la reanudación.
 * - N-03: el limpiador de secretos por nombre de variable corrompía código legítimo al leerlo,
 *   y el modelo podía acabar escribiendo «[REDACTADO]» en un archivo.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { crearHerramientasCoder } from "../core/ciclo/herramientas-coder.js";
import { redactar, redactarFormatos } from "../core/ciclo/redactar.js";
import { Respaldo } from "../core/ciclo/respaldo.js";

const escribir = (dir, ruta, contenido) => { mkdirSync(join(dir, ruta, ".."), { recursive: true }); writeFileSync(join(dir, ruta), contenido); };

function entorno() {
  const base = mkdtempSync(join(tmpdir(), "forge-rev3-"));
  const dir = join(base, "proy");
  mkdirSync(dir);
  const h = crearHerramientasCoder(/** @type {any} */ ({
    cwd: dir, vetadas: [], pruebas: [], respaldo: new Respaldo(dir, join(base, "respaldo")), taskId: "T1", maxPruebas: 5,
    log: { append: () => {} },
    runner: { test: async () => ({ exitCode: 0, stdout: "", stderr: "", timedOut: false, infraError: false, durationMs: 1 }) },
  }));
  return { dir, h, usar: (nombre, entrada = {}) => h.ejecutar(nombre, entrada) };
}

describe("N-01 — la intención sabe cómo quedará el archivo", () => {
  test("estadoDeEscritura da la huella de antes y la de después de una sustitución", async () => {
    const e = entorno();
    escribir(e.dir, "src/a.js", "export const a = 1;\nexport const b = 2;\n");
    const entrada = { ruta: "src/a.js", buscar: "export const a = 1;", reemplazar: "export const a = 1;\nexport const NUEVO = 9;" };
    const previo = e.h.estadoDeEscritura("editar", entrada);
    assert.ok(previo?.despues, "calcula la huella de después");
    assert.notEqual(previo?.despues, previo?.sha256);

    const r = await e.usar("editar", entrada);
    assert.equal(r.error, false);
    const tras = e.h.estadoDeEscritura("editar", { ruta: "src/a.js" });
    assert.equal(tras?.sha256, previo?.despues, "el archivo quedó exactamente como se predijo");
  });

  test("una sustitución que no se puede aplicar no promete un «después»", () => {
    const e = entorno();
    escribir(e.dir, "src/a.js", "x\nx\n");
    assert.equal(e.h.estadoDeEscritura("editar", { ruta: "src/a.js", buscar: "x", reemplazar: "y" })?.despues, null, "fragmento repetido");
    assert.equal(e.h.estadoDeEscritura("editar", { ruta: "src/a.js", buscar: "zzz", reemplazar: "y" })?.despues, null, "fragmento ausente");
  });

  test("con «contenido», el después es la huella de lo que se va a escribir, también en un archivo nuevo", async () => {
    const e = entorno();
    const previo = e.h.estadoDeEscritura("editar", { ruta: "src/nuevo.js", contenido: "export const n = 1;\n" });
    assert.equal(previo?.sha256, "ausente");
    await e.usar("editar", { ruta: "src/nuevo.js", contenido: "export const n = 1;\n" });
    assert.equal(e.h.estadoDeEscritura("editar", { ruta: "src/nuevo.js" })?.sha256, previo?.despues);
  });
});

describe("N-03 — lo que se lee no se corrompe por el nombre de una variable", () => {
  const CODIGO = [
    "const token = jwt.sign({ sub: usuario.id }, clave);",
    "const tokens = texto.split(' ');",
    "const passed = resultados.filter((r) => r.ok);",
    "const config = { auth: true, max_tokens: 4096, author: 'Equipo' };",
    "def conectar(usuario, password=None):",
    "    return Cliente(password=password)",
  ].join("\n");

  test("redactarFormatos deja el código intacto; redactar (salida de pruebas) sigue ocultando por nombre", () => {
    assert.equal(redactarFormatos(CODIGO), CODIGO);
    assert.notEqual(redactar(CODIGO), CODIGO, "la salida de pruebas conserva la protección por nombre");
  });

  test("redactarFormatos sigue ocultando formatos conocidos", () => {
    const ghp = "ghp_" + "a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8";
    const sk = "sk-ant-api03-" + "a".repeat(30);
    const out = redactarFormatos(`x = "${ghp}"\ny = '${sk}'\nz = "AKIA${"A".repeat(16)}"`);
    assert.doesNotMatch(out, /ghp_a1B2/);
    assert.doesNotMatch(out, /sk-ant-api03/);
    assert.doesNotMatch(out, /AKIAAAAA/);
  });

  test("un bloque de clave privada completo se oculta, pero uno sin cierre no oculta el resto del archivo", () => {
    const completo = "antes\n-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----\ndespués";
    assert.match(redactarFormatos(completo), /antes[\s\S]*\[REDACTADO: clave privada\][\s\S]*después/);
    const sinCierre = "const RE = /-----BEGIN RSA PRIVATE KEY-----/;\nfunction importante() {}\n";
    assert.match(redactarFormatos(sinCierre), /function importante\(\) \{\}/, "el resto del archivo sigue visible");
  });

  test("leer_archivo y buscar devuelven el código tal cual y una edición basada en lo leído funciona", async () => {
    const e = entorno();
    escribir(e.dir, "src/auth.js", CODIGO + "\n");
    const leido = await e.usar("leer_archivo", { ruta: "src/auth.js" });
    assert.equal(leido.error, false);
    assert.doesNotMatch(leido.texto, /REDACTADO/);
    assert.match(leido.texto, /const token = jwt\.sign\(\{ sub: usuario\.id \}, clave\);/);

    const hallado = await e.usar("buscar", { texto: "const token" });
    assert.match(hallado.texto, /const token = jwt\.sign/);

    const r = await e.usar("editar", { ruta: "src/auth.js", buscar: "const tokens = texto.split(' ');", reemplazar: "const tokens = texto.split(/\\s+/);" });
    assert.equal(r.error, false, r.texto);
    assert.match(readFileSync(join(e.dir, "src/auth.js"), "utf8"), /split\(\/\\s\+\/\)/);
  });

  test("editar rechaza texto con el marcador de redacción y no toca el archivo", async () => {
    const e = entorno();
    escribir(e.dir, "src/a.js", "const a = 1;\n");
    const antes = readFileSync(join(e.dir, "src/a.js"), "utf8");
    for (const entrada of [
      { ruta: "src/a.js", contenido: "const token = [REDACTADO] sub: x });\n" },
      { ruta: "src/a.js", buscar: "const a = 1;", reemplazar: "const a = [REDACTADO];" },
      { ruta: "src/a.js", buscar: "[REDACTADO]", reemplazar: "x" },
    ]) {
      const r = await e.usar("editar", entrada);
      assert.equal(r.error, true);
      assert.match(r.texto, /\[REDACTADO/);
    }
    assert.equal(readFileSync(join(e.dir, "src/a.js"), "utf8"), antes);
  });
});

describe("N-01 en el ciclo — un cambio ajeno durante la interrupción no se toma por la edición", () => {
  test("el archivo cambió por otra causa: no se repite ni se da por aplicada; el modelo lo recibe como error", async () => {
    const { CicloVerificado } = await import("../core/ciclo/index.js");
    const { POR_DEFECTO } = await import("../core/ciclo/config.js");
    const { Diario } = await import("../core/ciclo/diario.js");
    const { comprobarConversacion } = await import("../core/llm-providers/stub-provider.js");

    const cwd = mkdtempSync(join(tmpdir(), "forge-rev3-ciclo-"));
    mkdirSync(join(cwd, ".sdd", "motor"), { recursive: true });
    writeFileSync(join(cwd, ".sdd", "motor", "sesion.json"), JSON.stringify({ runId: "r1", modo: "ciclo", creada: "2026-10-10T00:00:00Z" }));
    writeFileSync(join(cwd, "package.json"), JSON.stringify({ type: "module", scripts: { test: "node --test" } }));
    mkdirSync(join(cwd, "src"), { recursive: true });
    writeFileSync(join(cwd, "src", "g.js"), Array.from({ length: 20 }, (_, i) => `export const v${i} = ${i};`).join("\n") + "\n");

    let ids = 0;
    const uso = (nombre, entrada) => ({ tipo: "uso_herramienta", id: `u${++ids}`, nombre, entrada });
    const pide = (...usos) => ({ contenido: [{ tipo: "texto", texto: "Sigo." }, ...usos] });
    const E1 = uso("editar", { ruta: "src/g.js", buscar: "export const v5 = 5;", reemplazar: "export const v5 = -5;" });
    const E2 = uso("editar", { ruta: "src/g.js", buscar: "export const v10 = 10;", reemplazar: "export const v10 = -10;" });
    const turnos = [pide(E1, E2), { contenido: [{ tipo: "texto", texto: "He terminado." }] }];
    const conversaciones = [];
    const colaEjec = [{ exitCode: 1 }, { exitCode: 0, stdout: "# tests 1\n# pass 1\n" }];

    const nuevo = () => new CicloVerificado(/** @type {any} */ ({
      cwd, runId: "r1", testCmd: "npm test",
      config: { ...POR_DEFECTO, motor: { ...POR_DEFECTO.motor, grafo: "propio", mutacion: "no", implementador: "turnos" } },
      log: { append: () => {} },
      aliasDe: () => "sonnet",
      llamar: async (p) => {
        const s = { arquitecto: '{"pasos":["x"],"archivosObjetivo":["src/g.js"]}', tester: '```json\n{"archivos":[{"ruta":"tests/g.test.js","contenido":"import \'../src/g.js\';\\n"}]}\n```' }[p.agente];
        if (s === undefined) throw new Error("agente inesperado " + p.agente);
        return { ok: true, output: s, inputTokens: 10, outputTokens: 5, modelo: "claude-sonnet-4-6", proveedor: "anthropic" };
      },
      admiteHerramientas: () => true,
      conversar: async (p) => {
        comprobarConversacion(p.mensajes);
        const paso = turnos.shift();
        if (!paso) throw new Error("turnos agotados");
        conversaciones.push(JSON.parse(JSON.stringify(p)));
        return { ok: true, stopReason: paso.contenido.some((b) => b.tipo === "uso_herramienta") ? "herramientas" : "fin", inputTokens: 100, outputTokens: 10, modelo: "claude-sonnet-4-6", proveedor: "anthropic", ...paso };
      },
      runner: { test: async () => {
        const r = colaEjec.shift();
        if (!r) throw new Error("ejecuciones agotadas");
        return { stdout: "", stderr: "", timedOut: false, infraError: false, durationMs: 1, ...r };
      } },
    }));

    // Primera pasada: corte justo después de anotar la intención de la segunda edición
    const original = Diario.prototype.anotar;
    Diario.prototype.anotar = function (hilo, clave, ...resto) {
      const r = original.call(this, hilo, clave, ...resto);
      if (/:r:1:i$/.test(String(clave))) throw new Error("CORTE");
      return r;
    };
    try {
      await assert.rejects(nuevo().ejecutar({ id: "T1", agente: "desarrollador-backend", prompt: "Cambia v5 y v10", archivos: ["src/g.js"] }), /CORTE/);
    } finally { Diario.prototype.anotar = original; }

    // Entre el corte y la reanudación, algo ajeno cambia el archivo
    appendFileSync(join(cwd, "src", "g.js"), "// formateado por otra herramienta\n");

    turnos.unshift(turnos[0]); // el turno 1 ya está en el diario: no se vuelve a pedir; este es el de cierre
    turnos.shift();
    const r = await nuevo().ejecutar({ id: "T1", agente: "desarrollador-backend", prompt: "Cambia v5 y v10", archivos: ["src/g.js"] });
    const final = readFileSync(join(cwd, "src", "g.js"), "utf8");
    assert.match(final, /export const v5 = -5;/, "la primera edición se aplicó antes del corte");
    assert.match(final, /export const v10 = 10;/, "la segunda NO se aplicó ni se dio por aplicada");
    const ultima = conversaciones[conversaciones.length - 1];
    const resultados = ultima.mensajes[ultima.mensajes.length - 1].contenido.filter((b) => b.tipo === "resultado_herramienta");
    assert.equal(resultados.length, 2);
    assert.equal(resultados[1].esError, true);
    assert.match(resultados[1].contenido, /cambió mientras el trabajo estaba interrumpido/);
    assert.ok(r.estado);
  });
});
