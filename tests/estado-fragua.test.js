/** F4.1/F4.2/F4.4 — carpeta de estado nueva/antigua sin migración y valores publicados que no cambian. */
import { describe, test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { directorioDeEstado, claveLocal, firmar, firmaValida, rutaDeEstado, estadoAntiguoSinUsar, raicesPorDefecto } from "../core/integraciones/estado-usuario.js";

const RAIZ = join(import.meta.dirname, "..");
const limpiar = [];
const sinHome = (env) => ({ ...env, FORGE_HOME: undefined, FRAGUA_HOME: undefined });
const ESQUELETO = "integraciones";
afterEach(() => { for (const d of limpiar.splice(0)) { try { rmSync(d, { recursive: true, force: true }); } catch { /* ya no está */ } } });

/** Entorno aislado: LOCALAPPDATA (Windows) y HOME (Unix) apuntan a una carpeta de pruebas. */
function entorno({ nueva = false, antigua = false } = {}) {
  const base = realpathSync(mkdtempSync(join(tmpdir(), "fragua-estado-")));
  limpiar.push(base);
  const proyecto = join(base, "proyecto"); mkdirSync(proyecto);
  const casa = join(base, "casa"); mkdirSync(casa);
  const guardado = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE, FORGE_HOME: process.env.FORGE_HOME, FRAGUA_HOME: process.env.FRAGUA_HOME };
  process.env.HOME = casa; process.env.USERPROFILE = casa;
  delete process.env.FORGE_HOME; delete process.env.FRAGUA_HOME;
  afterRestore(() => { for (const [k, v] of Object.entries(guardado)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });
  const env = sinHome({ LOCALAPPDATA: join(casa, "AppData", "Local") });
  const { nueva: rn, antigua: ra } = raicesPorDefecto(env);
  if (nueva) mkdirSync(rn, { recursive: true });
  if (antigua) mkdirSync(ra, { recursive: true });
  return { env, proyecto, rn, ra, casa };
}
const restaurar = [];
function afterRestore(f) { restaurar.push(f); }
afterEach(() => { for (const f of restaurar.splice(0)) f(); });

describe("F4.1 carpeta de estado: nueva / antigua, sin migrar", () => {
  test("instalación limpia: carpeta nueva «fragua»", () => {
    const { env, proyecto, rn } = entorno();
    assert.ok(rutaDeEstado(proyecto, env).startsWith(rn));
    assert.match(rn, /fragua/i);
  });

  test("solo existe la antigua: se sigue usando, y no se crea la nueva", () => {
    const { env, proyecto, ra, rn } = entorno({ antigua: true });
    const dir = directorioDeEstado(proyecto, env);
    assert.ok(dir.startsWith(ra));
    assert.equal(existsSync(rn), false, "no se crea la carpeta nueva");
  });

  test("solo existe la nueva: se usa la nueva", () => {
    const { env, proyecto, rn } = entorno({ nueva: true });
    assert.ok(rutaDeEstado(proyecto, env).startsWith(rn));
    assert.equal(estadoAntiguoSinUsar(env), null);
  });

  test("existen las dos: manda la nueva, la antigua no se toca y se avisa de ella", () => {
    const { env, proyecto, ra, rn } = entorno({ nueva: true, antigua: true });
    const dir = directorioDeEstado(proyecto, env);
    assert.ok(dir.startsWith(rn));
    claveLocal(dir);
    assert.deepEqual(readdirSync(ra), [], "la antigua sigue intacta: nada se copia ni se mueve");
    assert.equal(estadoAntiguoSinUsar(env), ra);
  });

  test("una cola firmada con la clave antigua se sigue pudiendo verificar (y aprobar)", () => {
    const { env, proyecto, ra, rn } = entorno({ antigua: true });
    const dir = directorioDeEstado(proyecto, env);
    const clave = claveLocal(dir);
    const pendiente = { id: "p1", rama: "forge/x", titulo: "t" };
    const firma = firmar(clave, pendiente);
    // Otro proceso (otra versión) vuelve a resolver el estado: sigue siendo la antigua, con la misma clave
    const otra = claveLocal(directorioDeEstado(proyecto, env));
    assert.ok(firmaValida(otra, pendiente, firma));
    assert.ok(dir.startsWith(ra));
    assert.equal(existsSync(rn), false);
  });

  test("las comprobaciones de seguridad valen para la raíz antigua y la nueva (fuera del proyecto)", () => {
    const { env, proyecto } = entorno({ antigua: true });
    // Un LOCALAPPDATA relativo o dentro del proyecto no se acepta para ninguna de las dos
    if (process.platform === "win32") {
      const dentro = { ...env, LOCALAPPDATA: join(proyecto, "AppData") };
      assert.throws(() => rutaDeEstado(proyecto, dentro), /DENTRO del proyecto/);
      const relativo = { ...env, LOCALAPPDATA: "relativa" };
      const r = rutaDeEstado(proyecto, relativo);
      assert.ok(!r.startsWith(proyecto) && /^[A-Za-z]:\\/.test(r));
    }
    assert.throws(() => rutaDeEstado(proyecto, { ...env, FRAGUA_HOME: join(proyecto, "x") }), /DENTRO del proyecto/);
    assert.throws(() => rutaDeEstado(proyecto, { ...env, FORGE_HOME: join(proyecto, "x") }), /DENTRO del proyecto/);
  });
});

describe("F4.4 lo ya publicado no cambia (CA-005-02)", () => {
  const leer = (r) => readFileSync(join(RAIZ, r), "utf8");
  test("prefijo de rama «forge/» y marcadores «forge:» / «FORGE-ID:» siguen emitiéndose igual", () => {
    assert.match(leer("core/integraciones/publicacion.js"), /PREFIJO_RAMA\s*=\s*'forge\/'/);
    assert.match(leer("core/integraciones/proveedores/github.js"), /<!-- forge:\$\{/);
    assert.match(leer("core/integraciones/proveedores/gitlab.js"), /<!-- forge:\$\{/);
    assert.match(leer("core/integraciones/proveedores/jira.js"), /FORGE-ID: /);
    assert.match(leer("core/integraciones/marcador.js"), /forge-derivado:/);
    assert.match(leer("core/integraciones/proveedores/github.js"), /\\n\\nforge:\$\{marcador\}/);
  });
  test("las barreras anti-inyección siguen vetando el marcador antiguo", () => {
    assert.match(leer("core/integraciones/proveedores/github.js"), /\/<!--\\s\*forge:\/i/);
    assert.match(leer("core/integraciones/proveedores/jira.js"), /\^\\s\*FORGE-ID\\s\*:/);
  });
  test("ninguna rama publicada pasa a «fragua/»", () => {
    for (const f of ["publicacion.js", "proveedores/github.js", "proveedores/gitlab.js", "aprobacion.js"]) assert.doesNotMatch(leer(`core/integraciones/${f}`), /['"`]fragua\//);
  });
});

describe("F4.2 doctor avisa del estado antiguo sin usar", async () => {
  const { diagnosticarIntegraciones } = await import("../core/integraciones/doctor.js");
  const { escribirConfig } = await import("./fixtures/integraciones/estado-ciclo.mjs");
  const YAML = "integraciones:\n  github_modo: comentar\n  github_token_env: FORGE_GITHUB_TOKEN\n  github_destinos: org/repo\n";
  const correr = (e) => { escribirConfig(e.proyecto, YAML); return diagnosticarIntegraciones({ cwd: e.proyecto, env: e.env, crearProveedor: () => { throw new Error("no"); } }); };
  const textos = (r) => r.lineas.map((l) => l.texto).join("\n");

  test("con las dos carpetas, aviso con la ruta de la antigua", async () => {
    const e = entorno({ nueva: true, antigua: true });
    const r = await correr(e);
    assert.ok(r.lineas.some((l) => l.nivel === "aviso" && l.texto.includes(e.ra)), textos(r));
  });
  test("con solo una de las dos, sin ese aviso", async () => {
    for (const cfg of [{ nueva: true }, { antigua: true }, {}]) {
      const e = entorno(cfg);
      assert.doesNotMatch(textos(await correr(e)), /instalación antigua sin usar/);
    }
  });
});
