// @ts-check
/**
 * F3 (SEGURIDAD-CIBER C-08..C-12) — instalación de dependencias, IPC, redacción de registros y plantilla de permisos.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
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

  // DEUDA (C-09): las bases se identifican por etiqueta, no por digest. Cuando se fijen (node:22-alpine@sha256:…),
  // esta prueba debe pasar de aviso a exigencia. No se inventan digests sin red.
  test("DEUDA: bases sin fijar por digest (aviso, no fallo)", (t) => {
    const sinDigest = Object.entries(IMAGENES_BASE).filter(([, b]) => !b.includes("@sha256:")).map(([l]) => l);
    if (sinDigest.length) t.diagnostic(`bases sin digest: ${sinDigest.join(", ")}`);
    assert.ok(true);
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
