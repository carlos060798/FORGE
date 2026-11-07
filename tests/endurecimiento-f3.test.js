// @ts-check
/**
 * F3 (SEGURIDAD-CIBER C-08..C-12) — instalación de dependencias, IPC, redacción de registros y plantilla de permisos.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { argvRun } from "../core/sandbox/politica.js";
import { dockerfile, IMAGENES_BASE } from "../core/sandbox/preparar-imagen.js";
import { jsonRedactado, redactar } from "../core/ciclo/redactar.js";
import { EventLog } from "../core/event-log.js";

describe("F3: endurecimiento", () => {
  test("pip instala solo ruedas; --require-hashes solo si hay hashes", () => {
    const sinHash = dockerfile("python", "python:3.12-slim", ["requirements.txt"]);
    assert.ok(sinHash.includes("--only-binary=:all:"));
    assert.ok(!sinHash.includes("--require-hashes"));
    const conHash = dockerfile("python", "python:3.12-slim", ["requirements.txt"], true);
    assert.ok(conHash.includes("--only-binary=:all:") && conHash.includes("--require-hashes"));
  });

  test("docker run corta el IPC", () => {
    const argv = argvRun({ imagen: "node:22-alpine", nombre: "forge-sbx-r1-1", copia: "/tmp/copia", comando: ["npm", "test"] });
    assert.equal(argv[argv.indexOf("--ipc") + 1], "none");
  });

  // C-08: las bases van fijadas por digest (`etiqueta@sha256:<64 hex>`): una etiqueta movida en el registro no puede
  // cambiar lo que juzga las pruebas.
  test("las bases del sandbox están fijadas por digest", () => {
    for (const [lenguaje, base] of Object.entries(IMAGENES_BASE)) {
      assert.match(base, /^[a-z0-9./-]+:[\w.-]+@sha256:[0-9a-f]{64}$/, `${lenguaje}: ${base}`);
    }
  });

  test("redactar cubre claves sk-ant", () => {
    const clave = ["sk-ant-", "api03-abcdefghijklmnopqrstuvwxyz0123456789"].join("");
    assert.ok(!redactar(`clave ${clave}`).includes("abcdefghijklmnop"));
  });

  test("jsonRedactado mantiene JSON válido y limpia secretos", () => {
    const clave = ["sk-ant-", "api03-abcdefghijklmnopqrstuvwxyz0123456789"].join("");
    const linea = jsonRedactado({ a: `fallo con ${clave}`, n: 1, o: { password: "hunter2hunter2" } });
    const o = JSON.parse(linea);
    assert.equal(o.n, 1);
    assert.ok(!linea.includes("abcdefghijklmnop") && !linea.includes("hunter2"));
  });

  test("el registro de eventos pasa por redactar", () => {
    const dir = mkdtempSync(join(tmpdir(), "f3-"));
    const log = new EventLog(dir);
    log.append("x", { salida: "token=abcdef123456789SECRETO" });
    assert.ok(!readFileSync(join(dir, "events.jsonl"), "utf8").includes("SECRETO"));
  });

  test("la plantilla de settings que se instala no trae permisos de desarrollo", () => {
    const p = join(import.meta.dirname, "..", ".claude-plugin", ".claude", "settings.json");
    assert.ok(existsSync(p));
    const allow = JSON.parse(readFileSync(p, "utf8")).permissions.allow;
    assert.ok(!allow.includes("WebSearch"));
    assert.ok(!allow.some((/** @type {string} */ x) => x.startsWith("Bash(git commit") || x.startsWith("Bash(git add") || x.startsWith("Bash(git rm") || x.startsWith("Bash(rm ")));
  });
});

describe("instalación de dependencias JavaScript en la imagen", () => {
  test("sin lockfile, npm install se reintenta con --legacy-peer-deps solo si falla (bug de arborist)", () => {
    const d = dockerfile("javascript", IMAGENES_BASE.javascript, ["package.json"]);
    assert.match(d, /RUN npm install --ignore-scripts --no-audit --no-fund \|\| npm install --ignore-scripts --no-audit --no-fund --legacy-peer-deps/);
  });
  test("con lockfile (npm ci) no hay respaldo: no se resuelve nada", () => {
    const d = dockerfile("javascript", IMAGENES_BASE.javascript, ["package.json", "package-lock.json"]);
    assert.match(d, /RUN npm ci --ignore-scripts --no-audit --no-fund\n/);
    assert.doesNotMatch(d, /legacy-peer-deps/);
  });
});

describe("cadena de suministro en CI (C-10)", () => {
  test("toda acción de los workflows va fijada por SHA de commit, no por etiqueta móvil", () => {
    const dir = join(import.meta.dirname, "..", ".github", "workflows");
    const sueltas = [];
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".yml"))) {
      readFileSync(join(dir, f), "utf8").split(/\r?\n/).forEach((l, i) => {
        const m = /uses:\s*([^\s#]+)/.exec(l);
        if (m && !m[1].startsWith("./") && !/@[0-9a-f]{40}$/.test(m[1])) sueltas.push(`${f}:${i + 1}: ${m[1]}`);
      });
    }
    assert.deepEqual(sueltas, []);
  });
});
