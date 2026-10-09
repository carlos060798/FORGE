// @ts-check
/**
 * `AGENTS.md`: el archivo de instrucciones que leen los agentes de código
 * (spec 2026-10-09-puesta-al-dia, HU-003). Cubre CA-003-01 a CA-003-04.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { homedir, tmpdir, userInfo } from "node:os";
import { fileURLToPath } from "node:url";

import { MARCA, constitucionUtil, desdeConstitucion, generarAgentsMd, leerConstitucion, limpiar } from "../core/agents-md.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(ROOT, "cli", "index.js");
const PLANTILLA = readFileSync(join(ROOT, "plantillas", "AGENTS.md"), "utf8");
const PLANTILLA_CONSTITUCION = readFileSync(join(ROOT, "plantillas", "constitucion.md"), "utf8");

const CONSTITUCION = `<!--
INFORME DE IMPACTO
  - NO copiar este comentario
-->

# Constitución del Proyecto: Tienda Lila

> **Versión:** 2.3.1 | **Ratificada:** 2026-01-01

## Propósito y Misión

Tienda Lila vende plantas por internet a gente sin jardín.

## Stack Técnico

| Aspecto | Valor |
|---------|-------|
| Lenguaje principal | Python |
| Tests | pytest |

## Principios Fundamentales

### Principio I: El cliente manda

Todo cambio DEBE partir de una necesidad del cliente.

**Razón:** porque sí.

### Principio II: Nada sin pruebas

## Estándares de Calidad

- **Tests:** cobertura mínima 80 %.

## Restricciones Arquitectónicas

- NO guardar tarjetas de pago
- NO llamar a la pasarela desde el navegador

## Convenciones

### Nomenclatura
- Archivos: snake_case

## Gobernanza

- Texto que no hace falta en AGENTS.md
`;

/** Ejecuta `forge init` en un directorio. Sin red, sin claves, sin Claude en el PATH. */
function init(dir) {
  return spawnSync(process.execPath, [CLI, "init"], { cwd: dir, encoding: "utf8", input: "", env: { ...process.env, ANTHROPIC_API_KEY: "" } });
}
function proyecto(archivos = {}) {
  const dir = mkdtempSync(join(tmpdir(), "forge-agentsmd-"));
  for (const [ruta, contenido] of Object.entries(archivos)) {
    mkdirSync(join(dir, ruta, ".."), { recursive: true });
    writeFileSync(join(dir, ruta), contenido);
  }
  return dir;
}

/** Nada que identifique el equipo de quien lo generó. */
function sinDatosDelEquipo(texto, dir) {
  assert.ok(!texto.includes(dir), "contiene la ruta del proyecto");
  assert.ok(!texto.includes(dir.replace(/\\/g, "/")), "contiene la ruta del proyecto");
  assert.ok(!texto.includes(homedir()), "contiene la carpeta personal");
  assert.ok(!texto.includes(tmpdir()), "contiene la carpeta temporal");
  assert.ok(!texto.includes(basename(dir)), "contiene el nombre de la carpeta del proyecto");
  assert.ok(!/[A-Za-z]:\\Users\\/.test(texto) && !/\/(home|Users)\/\w/.test(texto), "contiene una ruta de carpeta personal");
  const usuario = userInfo().username;
  if (usuario.length >= 4) assert.ok(!texto.toLowerCase().includes(usuario.toLowerCase()), "contiene el nombre de usuario");
}

describe("CA-003-01 — el repositorio de FORGE tiene su archivo de instrucciones", () => {
  const agents = readFileSync(join(ROOT, "AGENTS.md"), "utf8");
  const constitucion = leerConstitucion(readFileSync(join(ROOT, ".sdd", "memoria", "constitucion.md"), "utf8"));

  test("dice cómo ejecutar las pruebas, también las de Docker", () => {
    assert.match(agents, /npm test/);
    assert.match(agents, /FORGE_TEST_DOCKER=1/);
  });

  test("dice dónde están la constitución, las especificaciones y las decisiones, y enlaza la constitución", () => {
    assert.match(agents, /\]\(\.sdd\/memoria\/constitucion\.md\)/);
    assert.match(agents, /\.sdd\/especificaciones\//);
    assert.match(agents, /\.sdd\/arquitectura\//);
    for (const enlace of agents.matchAll(/\]\(([^)#]+)\)/g)) assert.ok(existsSync(join(ROOT, enlace[1])), `enlace roto: ${enlace[1]}`);
  });

  test("recoge TODAS las restricciones arquitectónicas de la constitución", () => {
    const restricciones = (constitucion.secciones.get("Restricciones Arquitectónicas") ?? "").split("\n").filter((l) => l.startsWith("- NO "));
    assert.ok(restricciones.length >= 8, "la constitución ya no tiene la lista de restricciones donde se esperaba");
    const plano = agents.replace(/\s+/g, " ");
    // Cada restricción aparece por sus palabras clave (el archivo resume, no copia)
    const CLAVES = [
      [/código generado/, /anfitrión/], [/dependencias nuevas/, /ADR/], [/versión mínima del runtime/, /MAYOR/],
      [/secretos/, /registros/], [/\.git\//, /\.env/], [/degradar en silencio/], [/forge run/, /forge resume/], [/interfaz pública/, /MAYOR/],
    ];
    assert.equal(CLAVES.length, restricciones.length, "la constitución cambió de número de restricciones: revisa AGENTS.md");
    for (const [i, claves] of CLAVES.entries()) {
      for (const clave of claves) {
        assert.match(restricciones[i], clave, `la restricción ${i + 1} de la constitución ya no es la que AGENTS.md resume`);
        assert.match(plano, clave, `AGENTS.md no recoge la restricción: ${restricciones[i]}`);
      }
    }
  });

  test("dice la regla de que todo cambio empieza por una especificación y la estructura de carpetas", () => {
    assert.match(agents, /Todo cambio empieza por una especificación/);
    for (const carpeta of ["core/", "cli/", "claude-hooks/", "tests/", ".sdd/"]) assert.ok(agents.includes("`" + carpeta + "`"), carpeta);
  });

  test("CA-003-04: no contiene secretos ni rutas del equipo", () => {
    assert.equal(limpiar(agents), agents, "el limpiador de secretos y rutas locales no encuentra nada que quitar");
    assert.ok(!agents.includes(homedir()));
    assert.ok(!/[A-Za-z]:\\/.test(agents), "ninguna ruta absoluta de Windows");
    assert.ok(!/sk-ant-|ANTHROPIC_API_KEY\s*=/.test(agents));
  });
});

describe("CA-003-02 — generar el archivo a partir de la constitución", () => {
  const texto = desdeConstitucion({ constitucion: CONSTITUCION, pruebas: "pytest -q" });

  test("lleva el nombre, el propósito, el stack, las restricciones, las convenciones y los estándares", () => {
    assert.match(texto, /^# AGENTS\.md — Tienda Lila\n/);
    assert.match(texto, /vende plantas por internet/);
    assert.match(texto, /\| Lenguaje principal \| Python \|/);
    assert.match(texto, /## Restricciones \(no negociables\)\n\n- NO guardar tarjetas de pago\n- NO llamar a la pasarela desde el navegador/);
    assert.match(texto, /- Archivos: snake_case/);
    assert.match(texto, /cobertura mínima 80 %/);
  });

  test("de los principios, solo el enunciado; el resto de la constitución no se copia", () => {
    assert.match(texto, /- Principio I: El cliente manda\n- Principio II: Nada sin pruebas/);
    assert.ok(!texto.includes("porque sí"));
    assert.ok(!texto.includes("Texto que no hace falta"));
    assert.ok(!texto.includes("NO copiar este comentario"), "el comentario inicial de la constitución no se copia");
  });

  test("dice de dónde sale, cómo ejecutar las pruebas, dónde están los artefactos y la regla de la especificación", () => {
    assert.ok(texto.includes(MARCA));
    assert.match(texto, /constitucion\.md \(versión 2\.3\.1\)/);
    assert.match(texto, /```\npytest -q\n```/);
    assert.match(texto, /\.sdd\/especificaciones\/<id>\/spec\.md/);
    assert.match(texto, /\.sdd\/arquitectura\/ADR-NN/);
    assert.match(texto, /Todo cambio empieza por una especificación/);
  });

  test("es determinista: la misma constitución da el mismo archivo", () => {
    assert.equal(desdeConstitucion({ constitucion: CONSTITUCION, pruebas: "pytest -q" }), texto);
    assert.equal(desdeConstitucion({ constitucion: CONSTITUCION.replace(/\n/g, "\r\n"), pruebas: "pytest -q" }), texto, "con finales de línea de Windows, igual");
  });

  test("la plantilla de constitución sin rellenar no sirve: se usa la plantilla mínima, sin huecos", () => {
    assert.equal(constitucionUtil(PLANTILLA_CONSTITUCION), false);
    assert.equal(constitucionUtil(CONSTITUCION), true);
    const r = generarAgentsMd({ constitucion: PLANTILLA_CONSTITUCION, plantilla: PLANTILLA, nombre: "demo", pruebas: "npm test" });
    assert.equal(r.origen, "plantilla");
    assert.match(r.contenido, /^# AGENTS\.md — demo\n/);
    assert.ok(!/\{\{|\[NOMBRE|\[LENGUAJE/.test(r.contenido), "quedan huecos sin rellenar");
    assert.equal(generarAgentsMd({ constitucion: null, plantilla: PLANTILLA }).origen, "plantilla");
    assert.equal(generarAgentsMd({ constitucion: CONSTITUCION, plantilla: PLANTILLA }).origen, "constitucion");
  });

  test("una constitución a medio rellenar: se copia lo escrito y se omiten los huecos", () => {
    const aMedias = PLANTILLA_CONSTITUCION
      .replace("[NOMBRE_PROYECTO]", "Medio Hecho")
      .replace(/\[Descripción del propósito[^\]]*\]/, "Sirve para probar.");
    const r = generarAgentsMd({ constitucion: aMedias, plantilla: PLANTILLA });
    assert.equal(r.origen, "constitucion");
    assert.match(r.contenido, /# AGENTS\.md — Medio Hecho/);
    assert.match(r.contenido, /Sirve para probar\./);
    assert.match(r.contenido, /- NO agregar dependencias nuevas sin ADR/);
    assert.ok(!/\[[A-ZÁÉÍÓÚ_]{4,}[^\]]*\]/.test(r.contenido), "quedó un hueco de la plantilla: " + r.contenido);
  });

  test("`forge init` crea AGENTS.md desde la constitución del proyecto, si la hay", () => {
    const dir = proyecto({ ".sdd/memoria/constitucion.md": CONSTITUCION, "requirements.txt": "pytest\n" });
    const r = init(dir);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const texto = readFileSync(join(dir, "AGENTS.md"), "utf8");
    assert.match(texto, /# AGENTS\.md — Tienda Lila/);
    assert.match(texto, /- NO guardar tarjetas de pago/);
    assert.match(r.stdout, /AGENTS\.md creado a partir de la constitución del proyecto/);
    assert.ok(!existsSync(join(dir, ".sdd", "AGENTS.propuesto.md")), "sin archivo previo no hay propuesta aparte");
  });

  test("`forge init` en un proyecto sin constitución crea AGENTS.md desde la plantilla mínima", () => {
    const dir = proyecto({ "package.json": JSON.stringify({ name: "mi-api", scripts: { test: "node --test" } }) });
    const r = init(dir);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const texto = readFileSync(join(dir, "AGENTS.md"), "utf8");
    assert.match(texto, /^# AGENTS\.md — mi-api\n/);
    assert.match(texto, /```\nnpm test\n```/);
    assert.match(texto, /Todo cambio empieza por una especificación/);
    assert.ok(!texto.includes("{{"), "quedan marcas de la plantilla");
    assert.match(r.stdout, /plantilla mínima/);
  });

  test("ejecutar `forge init` dos veces no cambia nada ni deja una propuesta", () => {
    const dir = proyecto({ ".sdd/memoria/constitucion.md": CONSTITUCION });
    init(dir);
    const primero = readFileSync(join(dir, "AGENTS.md"), "utf8");
    const r = init(dir);
    assert.equal(readFileSync(join(dir, "AGENTS.md"), "utf8"), primero);
    assert.match(r.stdout, /AGENTS\.md ya está al día/);
    assert.ok(!existsSync(join(dir, ".sdd", "AGENTS.propuesto.md")));
  });
});

describe("CA-003-03 — si el archivo ya existe, no se sobrescribe", () => {
  const PROPIO = "# Mis reglas\r\n\r\nEscritas a mano. No tocar.\r\n";

  test("queda intacto, byte a byte; se informa y la propuesta se deja aparte", () => {
    const dir = proyecto({ "AGENTS.md": PROPIO, ".sdd/memoria/constitucion.md": CONSTITUCION });
    const antes = readFileSync(join(dir, "AGENTS.md"));
    const r = init(dir);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.ok(readFileSync(join(dir, "AGENTS.md")).equals(antes), "AGENTS.md cambió");
    assert.match(r.stdout, /AGENTS\.md ya existe — no se sobreescribe/);
    assert.match(r.stdout, /\.sdd\/AGENTS\.propuesto\.md/);
    const propuesta = readFileSync(join(dir, ".sdd", "AGENTS.propuesto.md"), "utf8");
    assert.match(propuesta, /# AGENTS\.md — Tienda Lila/);
    assert.match(propuesta, /- NO guardar tarjetas de pago/);
  });

  test("también sin constitución: el archivo propio se respeta y la propuesta sale de la plantilla", () => {
    const dir = proyecto({ "AGENTS.md": PROPIO });
    init(dir);
    assert.equal(readFileSync(join(dir, "AGENTS.md"), "utf8"), PROPIO);
    assert.match(readFileSync(join(dir, ".sdd", "AGENTS.propuesto.md"), "utf8"), /Todo cambio empieza por una especificación/);
  });

  test("un archivo vacío también es del usuario: no se rellena", () => {
    const dir = proyecto({ "AGENTS.md": "" });
    init(dir);
    assert.equal(readFileSync(join(dir, "AGENTS.md"), "utf8"), "");
    assert.ok(existsSync(join(dir, ".sdd", "AGENTS.propuesto.md")));
  });

  test("si la constitución cambia después, el archivo ya creado no se regenera: la novedad va a la propuesta", () => {
    const dir = proyecto({ ".sdd/memoria/constitucion.md": CONSTITUCION });
    init(dir);
    const creado = readFileSync(join(dir, "AGENTS.md"), "utf8");
    writeFileSync(join(dir, ".sdd", "memoria", "constitucion.md"), CONSTITUCION.replace("- NO guardar tarjetas de pago", "- NO guardar tarjetas de pago\n- NO enviar correos sin permiso"));
    const r = init(dir);
    assert.equal(readFileSync(join(dir, "AGENTS.md"), "utf8"), creado, "el archivo existente no se toca");
    assert.match(readFileSync(join(dir, ".sdd", "AGENTS.propuesto.md"), "utf8"), /- NO enviar correos sin permiso/);
    assert.match(r.stdout, /no se sobreescribe/);
  });

  test("`forge init --global` no crea AGENTS.md en el directorio actual", () => {
    const dir = proyecto();
    const casa = proyecto();
    spawnSync(process.execPath, [CLI, "init", "--global"], { cwd: dir, encoding: "utf8", input: "", env: { ...process.env, HOME: casa, USERPROFILE: casa } });
    assert.ok(!existsSync(join(dir, "AGENTS.md")));
  });
});

describe("CA-003-04 — el archivo no contiene secretos ni rutas del equipo", () => {
  test("lo generado por `forge init` no menciona la ruta del proyecto, la carpeta personal ni el usuario", () => {
    for (const archivos of [{ ".sdd/memoria/constitucion.md": CONSTITUCION }, { "package.json": JSON.stringify({ name: "mi-api" }) }, {}]) {
      const dir = proyecto(archivos);
      init(dir);
      sinDatosDelEquipo(readFileSync(join(dir, "AGENTS.md"), "utf8"), dir);
    }
    const dir = proyecto({ "AGENTS.md": "mío", ".sdd/memoria/constitucion.md": CONSTITUCION });
    init(dir);
    sinDatosDelEquipo(readFileSync(join(dir, ".sdd", "AGENTS.propuesto.md"), "utf8"), dir);
  });

  test("un secreto o una ruta personal escritos en la constitución no pasan al archivo", () => {
    const sucia = CONSTITUCION
      .replace("- NO guardar tarjetas de pago", "- NO guardar tarjetas de pago (la clave es API_KEY=abcd1234efgh5678 y el token sk-ant-api03-AAAAAAAAAAAAAAAAAAAAAAAA)")
      .replace("- Archivos: snake_case", "- Archivos: snake_case, como en C:\\Users\\maria\\proyectos\\tienda y /home/maria/tienda/src o ~/tienda");
    const texto = desdeConstitucion({ constitucion: sucia });
    for (const fuga of ["abcd1234efgh5678", "sk-ant-api03", "maria", "C:\\Users"]) assert.ok(!texto.includes(fuga), `se coló: ${fuga}`);
    assert.match(texto, /NO guardar tarjetas de pago/, "la regla sigue ahí, sin el secreto");
    assert.match(texto, /\[ruta local omitida\]/);
  });

  test("las rutas relativas del proyecto y las de los artefactos no se tocan", () => {
    const texto = "Mira `.sdd/especificaciones/x/spec.md`, `src/home/index.js`, docs/Users/guia.md y https://example.com/home/pagina.";
    assert.equal(limpiar(texto), texto);
  });

  test("la plantilla mínima tampoco trae rutas ni secretos", () => {
    assert.equal(limpiar(PLANTILLA), PLANTILLA);
  });
});
