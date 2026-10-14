// @ts-check
/**
 * Tercera revisión independiente, hallazgos sobre `forge init`/`forge update` y core/escritura-segura.js:
 *
 *   N-04  `update --global`, `init --global --template` e `init --global --ui` ya no escribían, y aun así
 *         decían «Núcleo actualizado» / «FORGE listo»: cada destino con su raíz, y sin éxito si faltó algo.
 *   N-05  «borrar y recrear» perdía el archivo si el proceso moría en medio: temporal + rename.
 *   N-07  `init` LEÍA a través de enlaces (la constitución y el package.json de otro sitio acababan en AGENTS.md).
 *   N-08  el proyecto abierto a través de una unión no recibía CLAUDE.md, AGENTS.md ni .claudeignore.
 *   N-13  `init` no puede acabar con una traza (EISDIR, ENOTDIR...) ni colgarse con una tubería.
 *   N-14  `~/.claude/commands` como unión a los dotfiles del usuario: decisión documentada y probada.
 *
 * Con un HOME falso: nada de esto toca el ~/.claude de quien ejecuta las pruebas.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync, linkSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { ErrorEnlace, escribirArchivo, leerArchivo, verificarRuta, crearArchivo, crearDirectorio } from "../core/escritura-segura.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(ROOT, "cli", "index.js");
const MUERTE = join(ROOT, "tests", "fixtures", "muerte-en-rename.mjs");

const temporal = (p = "forge-global-") => realpathSync(mkdtempSync(join(tmpdir(), p)));
const escribir = (ruta, texto) => { mkdirSync(dirname(ruta), { recursive: true }); writeFileSync(ruta, texto); };
const union = (destino, enlace) => { try { symlinkSync(destino, enlace, "junction"); return true; } catch { return false; } };
const esEnlace = (ruta) => { try { return lstatSync(ruta).isSymbolicLink(); } catch { return false; } };

/** `forge <args>` con un HOME falso. */
function forge(cwd, home, ...args) {
  const env = { ...process.env, HOME: home, USERPROFILE: home, FORGE_LLM_PROVIDER: "stub", ANTHROPIC_API_KEY: "", CLAUDE_API_KEY: "" };
  const r = spawnSync(process.execPath, [CLI, ...args], { cwd, env, encoding: "utf8", timeout: 180_000 });
  return { status: r.status, salida: (r.stdout ?? "") + (r.stderr ?? "") };
}

const proyecto = () => { const d = temporal("forge-proy-"); escribir(join(d, "package.json"), JSON.stringify({ name: "demo", scripts: { test: "node --test" } })); return d; };
const hayTraza = (salida) => /\n\s+at .*\(.*:\d+:\d+\)|ENOTDIR:|EISDIR:|Error: E[A-Z]+:/.test(salida) && /\n\s+at /.test(salida);

describe("N-04 — cada destino con su raíz, y sin éxito si faltó algo", () => {
  test("init --global instala en ~/.claude; update --global restaura lo cambiado y dice la verdad", () => {
    const home = temporal("forge-home-"), cwd = proyecto();
    const r1 = forge(cwd, home, "init", "--global");
    assert.equal(r1.status, 0, r1.salida);
    assert.ok(readdirSync(join(home, ".claude", "commands")).length > 10);
    assert.ok(existsSync(join(home, ".claude", "agents")) && existsSync(join(home, ".claude", "hooks")));
    assert.ok(!existsSync(join(cwd, ".sdd")), "lo global no crea .sdd en el proyecto");

    const comando = join(home, ".claude", "commands", "forge.md");
    const original = readFileSync(comando, "utf8");
    writeFileSync(comando, "VIEJO");
    const r2 = forge(cwd, home, "update", "--global");
    assert.equal(r2.status, 0, r2.salida);
    assert.equal(readFileSync(comando, "utf8"), original, "update volvió a escribir el núcleo");
    assert.match(r2.salida, /Núcleo actualizado/);
    assert.doesNotMatch(r2.salida, /No se escribe/);
  });

  test("init --global --template escribe la plantilla en el proyecto, no en ~/.claude", () => {
    const home = temporal("forge-home-"), cwd = proyecto();
    const r = forge(cwd, home, "init", "--global", "--template", "api-rest");
    assert.equal(r.status, 0, r.salida);
    assert.ok(existsSync(join(cwd, ".sdd", "ir.json")), r.salida);
    assert.ok(existsSync(join(cwd, ".sdd", "estado.json")));
    assert.ok(existsSync(join(cwd, ".sdd", "especificaciones", "template-api-rest", "spec.md")));
    assert.ok(!existsSync(join(home, ".claude", ".sdd")));
    assert.match(r.salida, /FORGE listo/);
  });

  test("init --global --ui instala el dashboard en el proyecto", () => {
    const home = temporal("forge-home-"), cwd = proyecto();
    const r = forge(cwd, home, "init", "--global", "--ui");
    assert.equal(r.status, 0, r.salida);
    assert.ok(existsSync(join(cwd, ".forge-ui", "server.js")), r.salida);
    assert.match(r.salida, /Dashboard instalado/);
  });

  test("con algo sin escribir NO dice «Núcleo actualizado», sale con 1 y dice qué faltó", () => {
    const home = temporal("forge-home-"), cwd = proyecto();
    assert.equal(forge(cwd, home, "init", "--global").status, 0);
    // Una carpeta del núcleo que es una unión DENTRO del destino de otra permitida: no se sigue
    const dotfiles = temporal("forge-dotfiles-");
    escribir(join(dotfiles, "x.txt"), "x");
    const hooks = join(home, ".claude", "hooks");
    rmSync(join(hooks, "shared"), { recursive: true, force: true });
    if (!union(dotfiles, join(hooks, "shared"))) return;
    const antes = readdirSync(dotfiles);
    const r = forge(cwd, home, "update", "--global");
    assert.equal(r.status, 1, r.salida);
    assert.match(r.salida, /No se escribe/);
    assert.match(r.salida, /(?:forge|fragua) update NO terminó bien/);
    assert.doesNotMatch(r.salida, /Núcleo actualizado/);
    assert.deepEqual(readdirSync(dotfiles), antes, "no se escribió a través de la unión");
  });
});

describe("N-14 — ~/.claude/commands como unión a los dotfiles del usuario", () => {
  test("se sigue por decisión explícita, solo en lo global, y lo dice", (t) => {
    const home = temporal("forge-home-"), cwd = proyecto(), dotfiles = temporal("forge-dotfiles-");
    mkdirSync(join(home, ".claude"), { recursive: true });
    if (!union(dotfiles, join(home, ".claude", "commands"))) return t.skip("este sistema no permite uniones");
    const r = forge(cwd, home, "init", "--global");
    assert.equal(r.status, 0, r.salida);
    assert.ok(readdirSync(dotfiles).includes("forge.md"), "los comandos están en el repositorio de dotfiles");
    assert.ok(esEnlace(join(home, ".claude", "commands")), "la unión sigue siendo una unión");
    assert.match(r.salida, /es una unión o un enlace tuyo: se escribe en su destino/);
    // Las demás carpetas siguen siendo normales y llevan sus archivos
    assert.ok(readdirSync(join(home, ".claude", "agents")).length > 0);
  });

  test("en un proyecto ningún enlace se sigue, ni siquiera .claude/commands", (t) => {
    const home = temporal("forge-home-"), cwd = proyecto(), fuera = temporal("forge-fuera-");
    mkdirSync(join(cwd, ".claude"), { recursive: true });
    if (!union(fuera, join(cwd, ".claude", "commands"))) return t.skip("este sistema no permite uniones");
    const r = forge(cwd, home, "init");
    assert.equal(r.status, 1, r.salida);
    assert.deepEqual(readdirSync(fuera), []);
  });

  test("solo las cuatro carpetas del núcleo y solo si es un enlace a un directorio que existe", () => {
    const raiz = temporal(), dotfiles = temporal(), fuera = temporal();
    const permitidos = [join(raiz, "commands")];
    const r = { raiz, enlacesPermitidos: permitidos };
    if (!union(dotfiles, join(raiz, "commands")) || !union(fuera, join(raiz, "otra"))) return;
    assert.doesNotThrow(() => crearArchivo(r, join(raiz, "commands", "a.md"), "a"));
    assert.equal(readFileSync(join(dotfiles, "a.md"), "utf8"), "a");
    assert.throws(() => crearArchivo(r, join(raiz, "otra", "b.md"), "b"), ErrorEnlace, "una unión no permitida se rechaza");
    // Un enlace dentro del destino del permitido tampoco
    union(fuera, join(dotfiles, "dentro"));
    assert.throws(() => crearArchivo(r, join(raiz, "commands", "dentro", "c.md"), "c"), ErrorEnlace);
    assert.deepEqual(readdirSync(fuera), []);
    // Sin la lista, ni el permitido
    assert.throws(() => crearArchivo(raiz, join(raiz, "commands", "d.md"), "d"), ErrorEnlace);
    // Roto: no se sigue
    const muerto = temporal();
    union(muerto, join(raiz, "agents"));
    rmSync(muerto, { recursive: true });
    assert.throws(() => crearDirectorio({ raiz, enlacesPermitidos: [join(raiz, "agents")] }, join(raiz, "agents", "x")), ErrorEnlace);
  });
});

describe("N-05 — un corte entre escribir y reemplazar no pierde el archivo", () => {
  test("el proceso muere en el rename: el original sigue entero y el nuevo está completo en su temporal", () => {
    const raiz = temporal(), ruta = join(raiz, "CLAUDE.md");
    const original = "# Mi proyecto\n" + "línea del usuario\n".repeat(200);
    writeFileSync(ruta, original);
    const nuevo = "NUEVO\n".repeat(500);
    const r = spawnSync(process.execPath, [MUERTE, raiz, ruta, nuevo], { encoding: "utf8", timeout: 60_000 });
    assert.equal(r.status, 137, r.stdout + r.stderr);
    assert.equal(readFileSync(ruta, "utf8"), original, "el original sigue entero");
    const temporales = readdirSync(raiz).filter((n) => n.startsWith("CLAUDE.md.forge-tmp-"));
    assert.equal(temporales.length, 1);
    assert.equal(readFileSync(join(raiz, temporales[0]), "utf8"), nuevo, "el nuevo está completo");
  });

  test("sin corte: el archivo queda con el contenido nuevo, el mismo modo y sin temporales", () => {
    const raiz = temporal(), ruta = join(raiz, "a.txt");
    writeFileSync(ruta, "viejo", { mode: 0o640 });
    escribirArchivo(raiz, ruta, "nuevo");
    assert.equal(readFileSync(ruta, "utf8"), "nuevo");
    if (process.platform !== "win32") assert.equal(lstatSync(ruta).mode & 0o777, 0o640);
    assert.deepEqual(readdirSync(raiz), ["a.txt"]);
  });

  test("un enlace duro hacia fuera no se escribe: se reemplaza la entrada, no el contenido", () => {
    const raiz = temporal(), fuera = temporal();
    writeFileSync(join(fuera, "v.txt"), "ORIGINAL");
    linkSync(join(fuera, "v.txt"), join(raiz, "d.txt"));
    escribirArchivo(raiz, join(raiz, "d.txt"), "NUEVO");
    assert.equal(readFileSync(join(raiz, "d.txt"), "utf8"), "NUEVO");
    assert.equal(readFileSync(join(fuera, "v.txt"), "utf8"), "ORIGINAL");
    assert.deepEqual(readdirSync(raiz), ["d.txt"]);
  });

  test("si el destino es un enlace, no se crea ni el temporal", (t) => {
    const raiz = temporal(), fuera = temporal();
    const dir = join(raiz, "d");
    if (!union(fuera, dir)) return t.skip("sin uniones");
    assert.throws(() => escribirArchivo(raiz, join(dir, "x.txt"), "x"), ErrorEnlace);
    assert.deepEqual(readdirSync(fuera), []);
  });
});

describe("N-07 — init no lee a través de enlaces", () => {
  test("leerArchivo: enlace, carpeta, tubería o demasiado grande se rechazan; ausente es null", (t) => {
    const raiz = temporal(), fuera = temporal();
    escribir(join(fuera, "ajeno.txt"), "PRIVADO");
    escribir(join(raiz, "bueno.txt"), "hola");
    mkdirSync(join(raiz, "carpeta"));
    assert.equal(leerArchivo(raiz, join(raiz, "bueno.txt")), "hola");
    assert.equal(leerArchivo(raiz, join(raiz, "no-existe.txt")), null);
    assert.throws(() => leerArchivo(raiz, join(raiz, "carpeta")), ErrorEnlace);
    writeFileSync(join(raiz, "grande.txt"), "x".repeat(1000));
    assert.throws(() => leerArchivo(raiz, join(raiz, "grande.txt"), { maxBytes: 100 }), ErrorEnlace);
    if (union(fuera, join(raiz, "union"))) assert.throws(() => leerArchivo(raiz, join(raiz, "union", "ajeno.txt")), ErrorEnlace);
    try { symlinkSync(join(fuera, "ajeno.txt"), join(raiz, "enlace.txt"), "file"); } catch { return; }
    assert.throws(() => leerArchivo(raiz, join(raiz, "enlace.txt")), ErrorEnlace);
    void t;
  });

  test("una constitución que llega por una unión no entra en AGENTS.md", (t) => {
    const home = temporal("forge-home-"), cwd = proyecto(), fuera = temporal("forge-fuera-");
    escribir(join(fuera, "constitucion.md"), "# Constitución\n\n## Principios\n\n- PRIVADO-DE-FUERA\n");
    mkdirSync(join(cwd, ".sdd"), { recursive: true });
    if (!union(fuera, join(cwd, ".sdd", "memoria"))) return t.skip("sin uniones");
    const r = forge(cwd, home, "init");
    assert.ok(!/PRIVADO-DE-FUERA/.test(readFileSync(join(cwd, "AGENTS.md"), "utf8")), "el contenido ajeno no está en AGENTS.md");
    assert.match(r.salida, /No se lee|enlace|unión/i);
  });

  test("un package.json enlazado a otro de fuera no pone su nombre en AGENTS.md", (t) => {
    const home = temporal("forge-home-"), cwd = temporal("forge-proy-"), fuera = temporal("forge-fuera-");
    escribir(join(fuera, "package.json"), JSON.stringify({ name: "NOMBRE-PRIVADO-DE-FUERA", scripts: { test: "node --test" } }));
    try { symlinkSync(join(fuera, "package.json"), join(cwd, "package.json"), "file"); } catch { return t.skip("sin enlaces simbólicos a archivo (EPERM)"); }
    forge(cwd, home, "init");
    assert.ok(!/NOMBRE-PRIVADO-DE-FUERA/.test(readFileSync(join(cwd, "AGENTS.md"), "utf8")));
  });
});

describe("N-08 — el proyecto abierto a través de una unión se inicializa entero", () => {
  test("CLAUDE.md, AGENTS.md y .claudeignore se crean en el proyecto real", (t) => {
    const home = temporal("forge-home-"), real = proyecto(), base = temporal("forge-via-");
    const via = join(base, "via");
    if (!union(real, via)) return t.skip("sin uniones");
    const r = forge(via, home, "init");
    assert.equal(r.status, 0, r.salida);
    for (const f of ["CLAUDE.md", "AGENTS.md", ".claudeignore", join(".sdd", "sdd.config.yaml"), join(".claude", "commands", "forge.md")]) {
      assert.ok(existsSync(join(real, f)), `falta ${f}\n${r.salida}`);
    }
    assert.doesNotMatch(r.salida, /No es un directorio normal|No se escribe/);
  });

  test("crearDirectorio acepta como raíz una unión", (t) => {
    const real = temporal(), base = temporal();
    if (!union(real, join(base, "via"))) return t.skip("sin uniones");
    assert.doesNotThrow(() => crearDirectorio(join(base, "via"), join(base, "via")));
    assert.doesNotThrow(() => crearArchivo(join(base, "via"), join(base, "via", "a", "b.txt"), "x"));
    assert.equal(readFileSync(join(real, "a", "b.txt"), "utf8"), "x");
    assert.throws(() => verificarRuta(join(base, "via"), join(base, "otra", "x")), ErrorEnlace);
  });
});

describe("N-13 — destinos raros: aviso y se sigue, nunca una traza ni un cuelgue", () => {
  /** Ejecuta `init` y comprueba que termina bien (con 1, sin traza) y que lo demás se instaló. */
  function raro(preparar, esperado) {
    const home = temporal("forge-home-"), cwd = proyecto();
    preparar(cwd);
    const r = forge(cwd, home, "init");
    assert.equal(r.status, 1, r.salida);
    assert.ok(!hayTraza(r.salida), "sin traza:\n" + r.salida);
    assert.match(r.salida, /NO terminó bien/);
    assert.doesNotMatch(r.salida, /FORGE instalado/);
    // Lo que no depende del destino raro sí se hizo
    assert.ok(existsSync(join(cwd, ".claude", "commands", "forge.md")) || existsSync(join(cwd, ".sdd")), r.salida);
    esperado?.(cwd, r);
    return r;
  }

  test("CLAUDE.md es una carpeta", () => raro((cwd) => mkdirSync(join(cwd, "CLAUDE.md")), (cwd) => {
    assert.ok(existsSync(join(cwd, "AGENTS.md")), "AGENTS.md se creó igualmente");
    assert.ok(lstatSync(join(cwd, "CLAUDE.md")).isDirectory());
  }));

  test("AGENTS.md es una carpeta", () => raro((cwd) => mkdirSync(join(cwd, "AGENTS.md")), (cwd) => {
    assert.ok(existsSync(join(cwd, "CLAUDE.md")), "CLAUDE.md se creó igualmente");
  }));

  test(".sdd es un archivo", () => raro((cwd) => writeFileSync(join(cwd, ".sdd"), "no soy una carpeta"), (cwd) => {
    assert.equal(readFileSync(join(cwd, ".sdd"), "utf8"), "no soy una carpeta");
    assert.ok(existsSync(join(cwd, "CLAUDE.md")));
  }));

  test(".claude es un archivo", () => raro((cwd) => writeFileSync(join(cwd, ".claude"), "x"), (cwd) => {
    assert.ok(existsSync(join(cwd, ".sdd", "sdd.config.yaml")));
  }));

  test("una tubería con nombre en CLAUDE.md no cuelga init", (t) => {
    if (process.platform === "win32") return t.skip("las tuberías con nombre de Unix no existen en Windows");
    const home = temporal("forge-home-"), cwd = proyecto();
    const m = spawnSync("mkfifo", [join(cwd, "CLAUDE.md")]);
    if (m.status !== 0) return t.skip("mkfifo no disponible");
    const t0 = Date.now();
    const r = forge(cwd, home, "init");
    assert.ok(Date.now() - t0 < 120_000, "terminó");
    assert.equal(r.status, 1, r.salida);
    assert.ok(!hayTraza(r.salida), r.salida);
  });

  test("un archivo que no se puede escribir (solo lectura) no tumba init", (t) => {
    if (process.platform === "win32") return t.skip("los permisos POSIX no aplican");
    if (typeof process.getuid === "function" && process.getuid() === 0) return t.skip("root escribe en cualquier sitio");
    raro((cwd) => { escribir(join(cwd, ".claudeignore"), "mío"); spawnSync("chmod", ["444", join(cwd, ".claudeignore")]); void cwd; });
  });
});
