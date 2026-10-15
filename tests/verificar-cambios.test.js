// @ts-check
/**
 * `forge verificar --desde`: cambios de git sin ejecutar nada del repositorio (spike S0.2).
 * Repositorio temporal creado FUERA del proyecto, con una configuración hostil.
 */

import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync, realpathSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cambiosDesde, idDeBlob, PREFIJO_GIT, entornoGit } from "../core/verificar/cambios.js";

const base = realpathSync(mkdtempSync(join(tmpdir(), "forge-cambios-test-")));
after(() => rmSync(base, { recursive: true, force: true }));
let n = 0;

const GIT = ["-c", "user.email=t@t", "-c", "user.name=t", "-c", "commit.gpgsign=false"];
/** @param {string} dir @param {string[]} args */
const git = (dir, args) => execFileSync("git", [...GIT, ...args], { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const posix = (/** @type {string} */ p) => p.replace(/\\/g, "/");

/**
 * Repositorio con un commit base y cambios sin confirmar, y un `.git/config` hostil: cada mecanismo,
 * si se ejecuta, escribe `PWNED-<nombre>` junto al script.
 */
function repositorioHostil() {
  const dir = join(base, `r${++n}`);
  mkdirSync(dir);
  const guardia = join(base, `g${n}`);
  mkdirSync(guardia);
  const script = join(guardia, "centinela.sh");
  writeFileSync(script, [
    "#!/bin/sh",
    'echo x > "$(dirname "$0")/PWNED-$1"',
    'case "$1" in clean) cat;; textconv) cat "$2";; esac',
    "",
  ].join("\n"));

  git(dir, ["init", "-q"]);
  writeFileSync(join(dir, "a.js"), "export const a = 1;\n");
  writeFileSync(join(dir, "b.js"), "export const b = 1;\n");
  writeFileSync(join(dir, "c.js"), "export const c = 1;\n");
  git(dir, ["add", "-A"]);
  git(dir, ["commit", "-q", "-m", "base"]);
  git(dir, ["tag", "base"]);

  // Cambios sin confirmar: a.js modificado, d.js nuevo, c.js borrado
  writeFileSync(join(dir, "a.js"), "export const a = 2;\n");
  writeFileSync(join(dir, "d.js"), "export const d = 1;\n");
  rmSync(join(dir, "c.js"));

  // Configuración hostil DESPUÉS del commit (el commit no debe verse afectado por ella)
  const s = posix(script);
  const cfg = [
    "[core]",
    `\tfsmonitor = sh "${s}" fsmonitor`,
    `\thooksPath = ${posix(guardia)}`,
    `\tpager = sh "${s}" pager`,
    `\tsshCommand = sh "${s}" ssh`,
    "[diff]",
    `\texternal = sh "${s}" external`,
    '[diff "evil"]',
    `\ttextconv = sh "${s}" textconv`,
    '[filter "evil"]',
    `\tclean = sh "${s}" clean`,
    `\tsmudge = sh "${s}" smudge`,
    "",
  ].join("\n");
  writeFileSync(join(dir, ".git", "config"), readConfig(dir) + cfg);
  writeFileSync(join(dir, ".gitattributes"), "*.js diff=evil filter=evil\n");
  writeFileSync(join(dir, ".git", "info", "attributes"), "*.js diff=evil filter=evil\n");
  return { dir, guardia };
}

/** @param {string} dir */
function readConfig(dir) {
  return execFileSync(process.execPath, ["-e", `process.stdout.write(require("fs").readFileSync(${JSON.stringify(join(dir, ".git", "config"))},"utf8"))`], { encoding: "utf8" });
}

/** @param {string} guardia */
const centinelas = (guardia) => readdirSync(guardia).filter((f) => f.startsWith("PWNED-")).sort();
/** @param {string} guardia */
const limpiar = (guardia) => { for (const f of centinelas(guardia)) rmSync(join(guardia, f)); };

describe("verificar --desde: git neutralizado", () => {
  test("repositorio hostil: lista correcta y NINGÚN centinela se ejecuta", async () => {
    const { dir, guardia } = repositorioHostil();
    const r = await cambiosDesde(dir, "base");
    assert.equal(r.ok, true, JSON.stringify(r));
    if (r.ok === false) return;
    assert.deepEqual(r.archivos, [".gitattributes", "a.js", "d.js"], "modificados y nuevos; el borrado (c.js) no aparece");
    assert.equal(r.originalDe("a.js"), "export const a = 1;\n");
    assert.equal(r.originalDe("d.js"), null, "un archivo nuevo no tiene original");
    assert.deepEqual(centinelas(guardia), [], "git no ejecutó nada del repositorio");
  });

  test("CONTROL NEGATIVO: con git plano la misma configuración SÍ ejecuta el centinela", () => {
    const { dir, guardia } = repositorioHostil();
    assert.deepEqual(centinelas(guardia), []);
    for (const orden of [["diff", "--name-only", "base"], ["status", "--porcelain"], ["ls-files", "-s"]]) {
      try { git(dir, orden); } catch { /* el fallo da igual: importa si se ejecutó */ }
    }
    const vistos = centinelas(guardia);
    assert.ok(vistos.length > 0, "la prueba no demostraría nada: git plano no ejecutó ni un centinela");
    assert.ok(vistos.includes("PWNED-fsmonitor") || vistos.includes("PWNED-clean"), vistos.join(","));
    limpiar(guardia);
  });

  test("el prefijo neutraliza fsmonitor/hooks/atributos y el entorno no hereda variables de git", () => {
    const p = PREFIJO_GIT.join(" ");
    for (const k of ["core.fsmonitor=false", "core.hooksPath=", "core.attributesFile=", "diff.external="]) assert.ok(p.includes(k), k);
    const guardado = { ...process.env };
    process.env.GIT_DIR = "/x"; process.env.GIT_EXTERNAL_DIFF = "evil"; process.env.GIT_SSH_COMMAND = "evil";
    try {
      const e = entornoGit();
      for (const k of Object.keys(e)) assert.ok(!/^GIT_(DIR|EXTERNAL_DIFF|SSH|ASKPASS|WORK_TREE)/.test(k) || false, k);
      assert.equal(e.GIT_CONFIG_NOSYSTEM, "1");
    } finally {
      delete process.env.GIT_DIR; delete process.env.GIT_EXTERNAL_DIFF; delete process.env.GIT_SSH_COMMAND;
      Object.assign(process.env, guardado);
    }
  });

  test("referencia inexistente, con guion inicial, vacía o sin git: error claro", async () => {
    const { dir } = repositorioHostil();
    for (const ref of ["no-existe", "--output=x", "", "base\nmalo"]) {
      const r = await cambiosDesde(dir, ref);
      assert.equal(r.ok, false, ref);
      if (r.ok === false) assert.match(r.error, /--archivos/);
    }
    assert.equal(existsSync(join(dir, "x")), false);
    const sinGit = join(base, "sin-git");
    mkdirSync(sinGit);
    const r = await cambiosDesde(sinGit, "base");
    assert.equal(r.ok, false);
  });

  test("H-3: un git replace del repositorio no oculta archivos cambiados", async () => {
    // C1 tiene a.js = v1; el árbol de trabajo tiene v2 sin confirmar. Un reemplazo C1 -> C2 (cuyo árbol
    // ya trae v2) haría que `ls-tree C1` mostrara v2 y a.js pareciera sin cambios.
    const dir = join(base, `r${++n}`);
    mkdirSync(dir);
    git(dir, ["init", "-q"]);
    writeFileSync(join(dir, "a.js"), "export const a = 1;\n");
    git(dir, ["add", "."]); git(dir, ["commit", "-q", "-m", "c1"]);
    const c1 = git(dir, ["rev-parse", "HEAD"]).trim();
    writeFileSync(join(dir, "a.js"), "export const a = 2;\n");
    git(dir, ["commit", "-q", "-am", "c2"]);
    const c2 = git(dir, ["rev-parse", "HEAD"]).trim();
    git(dir, ["reset", "-q", "--hard", c1]);
    writeFileSync(join(dir, "a.js"), "export const a = 2;\n");   // cambio sin confirmar
    git(dir, ["replace", c1, c2]);
    // Control negativo: con las referencias de reemplazo activas, git sí ve el árbol de C2
    const visto = git(dir, ["ls-tree", c1, "a.js"]);
    const real = execFileSync("git", ["--no-replace-objects", "ls-tree", c1, "a.js"], { cwd: dir, encoding: "utf8" });
    assert.notEqual(visto, real, "el reemplazo cambia lo que git muestra (control negativo)");
    const r = await cambiosDesde(dir, c1);
    assert.equal(r.ok, true);
    assert.deepEqual(/** @type {any} */ (r).archivos, ["a.js"], "a.js sigue apareciendo como cambiado");
  });

  test("idDeBlob coincide con el de git", () => {
    const { dir } = repositorioHostil();
    const git0 = execFileSync("git", ["hash-object", "--no-filters", "a.js"], { cwd: dir, encoding: "utf8", env: { PATH: process.env.PATH ?? "", SystemRoot: process.env.SystemRoot ?? "", GIT_CONFIG_NOSYSTEM: "1" } }).trim();
    assert.equal(idDeBlob(Buffer.from("export const a = 2;\n")), git0);
  });
});
