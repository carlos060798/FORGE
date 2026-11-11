// @ts-check
/**
 * Plan docs/PLAN-AGNOSTICO.md, F2: agentes en el formato propio de cada herramienta, solo donde está confirmado.
 * Los formatos salen de la documentación oficial leída el 2026-11-11; no se probaron en una herramienta real.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { CLAVES_CON_AGENTE_NATIVO, FORMATOS_NATIVOS, SOLO_LECTURA_CON_SHELL, agenteANativo, cuerpoSinShell, herramientasDe } from "../core/instalacion/agentes-nativos.js";
import { INTEGRACIONES } from "../core/instalacion/herramientas-destino.js";
import { AGENTES_SOLO_LECTURA } from "../core/evidencia/guardian-reglas.js";
import { separarCabecera } from "../core/instalacion/skills-de-comandos.js";
import { ROOT, forge } from "./instalacion-ayudas.js";

const agentes = readdirSync(join(ROOT, "agents")).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3));
const comandos = readdirSync(join(ROOT, "commands")).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3));
const opciones = { prefijo: "/", comandos };
const texto = (a) => readFileSync(join(ROOT, "agents", a + ".md"), "utf8");
const temporal = (p) => realpathSync(mkdtempSync(join(tmpdir(), p)));
// Fuente única de «solo lectura»: la lista del guardián (core/evidencia/guardian-reglas.js)
const SOLO_LECTURA = [...AGENTES_SOLO_LECTURA];
const ESCRIBE = ["Write", "Edit", "MultiEdit", "NotebookEdit"];

describe("tabla de formatos", () => {
  test("cada formato cita https y fecha, y es una integración del instalador sin carpeta compartida", () => {
    for (const [clave, f] of Object.entries(FORMATOS_NATIVOS)) {
      assert.ok(Object.hasOwn(INTEGRACIONES, clave), clave);
      assert.match(f.fuente, /^https:\/\//, clave);
      assert.match(f.consultado, /^2026-11-\d\d$/, clave);
      assert.ok(!f.carpeta.startsWith("/") && !f.carpeta.includes(".."), clave);
    }
    assert.deepEqual([...CLAVES_CON_AGENTE_NATIVO].sort(), ["codex", "copilot", "cursor", "gemini", "kiro", "opencode"]);
  });
  test("sin formato confirmado devuelve null (Windsurf, carpeta común, genérica, Claude)", () => {
    for (const c of ["windsurf", "agents", "generica", "claude"]) assert.equal(agenteANativo(c, "revisor", texto("revisor"), opciones), null, c);
  });
});

describe("agenteANativo", () => {
  test("Copilot: .agent.md con name, description y tools como alias documentados", () => {
    const r = /** @type {any} */ (agenteANativo("copilot", "revisor", texto("revisor"), opciones));
    assert.equal(r.ruta, ".github/agents/revisor.agent.md");
    const { campos } = separarCabecera(r.contenido);
    assert.equal(campos.get("name"), '"revisor"');
    assert.equal(campos.get("tools"), '["read","search","execute"]');
    assert.ok(!/^model:/m.test(r.contenido), "sin model: los valores no están documentados");
  });
  test("Cursor: readonly solo para los agentes sin herramientas de escritura", () => {
    for (const a of agentes) {
      const r = /** @type {any} */ (agenteANativo("cursor", a, texto(a), opciones));
      assert.match(r.contenido, new RegExp(`^readonly: ${SOLO_LECTURA.includes(a) ? "true" : "false"}$`, "m"), a);
      assert.match(r.contenido, /^model: inherit$/m);
    }
  });
  test("opencode: mode subagent y permisos edit/shell denegados cuando faltan las herramientas", () => {
    const lectura = /** @type {any} */ (agenteANativo("opencode", "revisor", texto("revisor"), opciones));
    assert.match(lectura.contenido, /mode: subagent/);
    assert.match(lectura.contenido, /action: edit\n\s+resource: "\*"\n\s+effect: deny/);
    const escribe = /** @type {any} */ (agenteANativo("opencode", "tester", texto("tester"), opciones));
    assert.ok(!/action: edit/.test(escribe.contenido));
  });
  test("Kiro: JSON válido con prompt; las herramientas se traducen a read, write y shell", () => {
    for (const a of agentes) {
      const r = /** @type {any} */ (agenteANativo("kiro", a, texto(a), opciones));
      const j = JSON.parse(r.contenido);
      assert.equal(j.name, a);
      assert.ok(j.prompt.length > 100, a);
      assert.ok(j.tools.every((/** @type {string} */ t) => ["read", "write", "shell"].includes(t)), a);
    }
  });
  test("Kiro y Copilot nunca dan MÁS herramientas que el agente original", () => {
    for (const a of SOLO_LECTURA) {
      const k = JSON.parse(/** @type {any} */ (agenteANativo("kiro", a, texto(a), opciones)).contenido);
      assert.ok(!k.tools.includes("write"), `kiro ${a}`);
      const c = /** @type {any} */ (agenteANativo("copilot", a, texto(a), opciones)).contenido;
      assert.ok(!/"edit"/.test(c), `copilot ${a}`);
    }
  });
  test("Gemini: genera los 14 con herramientas de la lista confirmada el 2026-11-11 (geminicli.com/docs/tools)", () => {
    const CONFIRMADAS = ["read_file", "write_file", "replace", "glob", "grep_search", "run_shell_command", "web_fetch", "google_web_search"];
    for (const a of agentes) {
      const r = /** @type {any} */ (agenteANativo("gemini", a, texto(a), opciones));
      assert.equal(r.ruta, `.gemini/agents/${a}.md`, a);
      const tools = [...r.contenido.matchAll(/^ {2}- (\S+)$/gm)].map((/** @type {RegExpMatchArray} */ m) => m[1]);
      assert.ok(tools.length > 0 && tools.every((t) => CONFIRMADAS.includes(t)), `${a}: ${tools}`);
      assert.match(r.contenido, /^kind: local$/m);
    }
  });
  test("Gemini: un agente que escribe recibe write_file, y replace si declara Edit; uno de solo lectura, ninguna", () => {
    const tester = /** @type {any} */ (agenteANativo("gemini", "tester", texto("tester"), opciones)).contenido;
    assert.match(tester, /^ {2}- write_file$/m);
    assert.ok(!/^ {2}- replace$/m.test(tester), "tester declara Write pero no Edit: no recibe replace");
    const conEdit = "---\nname: x\ndescription: d\ntools: [\"Read\", \"Edit\"]\n---\ncuerpo\n";
    assert.match(/** @type {any} */ (agenteANativo("gemini", "x", conEdit, opciones)).contenido, /^ {2}- replace$/m);
    for (const a of SOLO_LECTURA) {
      const c = /** @type {any} */ (agenteANativo("gemini", a, texto(a), opciones)).contenido;
      assert.ok(!/^ {2}- (write_file|replace)$/m.test(c), a);
    }
  });
  test("Codex: TOML con los tres campos obligatorios; solo lectura va como instrucción", () => {
    for (const a of agentes) {
      const r = /** @type {any} */ (agenteANativo("codex", a, texto(a), opciones));
      assert.equal(r.ruta, `.codex/agents/${a}.toml`);
      assert.match(r.contenido, /^name = "/m);
      assert.match(r.contenido, /^description = "/m);
      assert.match(r.contenido, /^developer_instructions = ('''|""")\n/m);
      assert.equal(/solo lectura/.test(r.contenido), SOLO_LECTURA.includes(a), a);
    }
  });
  test("Codex: un cuerpo con ''' o barras se escapa en cadena básica", () => {
    const t = "---\nname: x\ndescription: d\ntools: [\"Read\"]\n---\nUsa ''' y \\n y \"\"\" aquí\n";
    const r = /** @type {any} */ (agenteANativo("codex", "x", t, opciones));
    assert.match(r.contenido, /developer_instructions = """\n/);
    assert.ok(r.contenido.includes('\\"\\"\\"') && r.contenido.includes("\\\\n"));
  });
  test("el cuerpo se adapta: sin «Claude Code» ni órdenes /sdd.x sin traducir", () => {
    for (const c of CLAVES_CON_AGENTE_NATIVO) {
      for (const a of agentes) {
        const r = /** @type {any} */ (agenteANativo(c, a, texto(a), { prefijo: "$", comandos }));
        if ("omitido" in r) continue;
        assert.ok(!/Claude Code|agent-memory\.js/.test(r.contenido), `${c}/${a}`);
      }
    }
  });
});

describe("agentes de solo lectura sin terminal (fuera de Claude Code no hay guardián)", () => {
  const conShell = Object.keys(SOLO_LECTURA_CON_SHELL);
  const sinShell = SOLO_LECTURA.filter((a) => !conShell.includes(a));

  test("la lista de excepciones es exactamente revisor e investigador, son de solo lectura y cada una trae su motivo", () => {
    assert.deepEqual([...conShell].sort(), ["investigador", "revisor"]);
    for (const a of conShell) {
      assert.ok(SOLO_LECTURA.includes(a), a);
      assert.ok(SOLO_LECTURA_CON_SHELL[a].length > 20, `${a}: motivo`);
    }
  });
  test("los motivos son ciertos: esos agentes ejecutan de verdad lo que dice su motivo", () => {
    assert.match(texto("revisor"), /npx jest|pytest/);
    assert.match(texto("investigador"), /node --version/);
  });
  test("los demás agentes de solo lectura solo usaban el shell para leer o anexar a la memoria compartida", () => {
    const EJECUTA = /\b(npx|npm|pytest|jest|git|node --version|python --version)\b/;
    for (const a of sinShell) {
      const bloques = [...texto(a).matchAll(/```bash\r?\n([\s\S]*?)```/g)].map((m) => m[1]).join("\n");
      const comandos = bloques.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith("#"));
      assert.ok(!comandos.some((l) => EJECUTA.test(l)), `${a} ejecuta algo más que lectura`);
    }
  });
  test("en ningún formato nativo reciben shell ni escritura", () => {
    for (const a of sinShell) {
      const kiro = JSON.parse(/** @type {any} */ (agenteANativo("kiro", a, texto(a), opciones)).contenido);
      assert.ok(!kiro.tools.includes("shell") && !kiro.tools.includes("write"), `kiro ${a}`);
      const copilot = /** @type {any} */ (agenteANativo("copilot", a, texto(a), opciones)).contenido;
      assert.ok(!/"execute"|"edit"/.test(copilot), `copilot ${a}`);
      const gemini = /** @type {any} */ (agenteANativo("gemini", a, texto(a), opciones)).contenido;
      assert.ok(!/run_shell_command|write_file|^ {2}- replace$/m.test(gemini), `gemini ${a}`);
      const opencode = /** @type {any} */ (agenteANativo("opencode", a, texto(a), opciones)).contenido;
      assert.match(opencode, /action: shell\n\s+resource: "\*"\n\s+effect: deny/, `opencode ${a}`);
    }
  });
  test("los que conservan el shell lo mantienen (y siguen sin poder escribir archivos)", () => {
    for (const a of conShell) {
      assert.match(/** @type {any} */ (agenteANativo("copilot", a, texto(a), opciones)).contenido, /"execute"/, a);
      assert.match(/** @type {any} */ (agenteANativo("gemini", a, texto(a), opciones)).contenido, /run_shell_command/, a);
      assert.ok(!/action: shell/.test(/** @type {any} */ (agenteANativo("opencode", a, texto(a), opciones)).contenido), a);
      assert.ok(/```bash/.test(/** @type {any} */ (agenteANativo("cursor", a, texto(a), opciones)).contenido), `${a}: conserva sus bloques bash`);
    }
  });
  test("el cuerpo nativo sin terminal no tiene bloques bash ni escrituras por heredoc, y no dice 'anota en memoria'", () => {
    for (const a of sinShell) {
      for (const c of CLAVES_CON_AGENTE_NATIVO) {
        const cuerpo = /** @type {any} */ (agenteANativo(c, a, texto(a), opciones)).contenido;
        assert.ok(!/```bash/.test(cuerpo), `${c}/${a}: bloque bash`);
        assert.ok(!/cat\s*>>/.test(cuerpo), `${c}/${a}: escribe por la terminal`);
        assert.ok(!/anota tus decisiones en `\.sdd\/memoria/.test(cuerpo), `${c}/${a}`);
      }
    }
  });
  test("arquitecto y critico devuelven sus decisiones en la respuesta en vez de anexarlas por la terminal", () => {
    for (const a of ["arquitecto", "critico"]) {
      const cuerpo = /** @type {any} */ (agenteANativo("cursor", a, texto(a), opciones)).contenido;
      assert.match(cuerpo, /incluye al final de tu respuesta este bloque/);
      assert.match(cuerpo, /decisiones-clave\.md/);
      assert.ok(!/\$\(date/.test(cuerpo), a);
    }
  });

  describe("cuerpoSinShell", () => {
    test("un bloque de lectura pasa a lista de archivos; las rutas con ${SPEC_ID} se nombran de forma neutral", () => {
      const r = cuerpoSinShell("Antes:\n```bash\n# cabecera\nSPEC_ID=$(grep x)\ncat .sdd/estado.json 2>/dev/null\n[ -n \"$SPEC_ID\" ] && cat \".sdd/especificaciones/${SPEC_ID}/spec.md\" 2>/dev/null | head -5\nfind src -maxdepth 2 -type d 2>/dev/null | head -20\n```\nDespués");
      assert.ok(!/```bash/.test(r));
      assert.match(r, /- `\.sdd\/estado\.json`/);
      assert.match(r, /- `\.sdd\/especificaciones\/<id-spec-activa>\/spec\.md`/);
      assert.match(r, /- buscar o listar: `find src -maxdepth 2 -type d`/);
      assert.match(r, /^Después$/m);
    });
    test("un texto sin bloques bash no cambia", () => {
      assert.equal(cuerpoSinShell("Solo prosa.\n```js\nx\n```\n"), "Solo prosa.\n```js\nx\n```\n");
    });
    test("el heredoc de anexo se convierte en plantilla sin fecha del sistema", () => {
      const r = cuerpoSinShell("```bash\nmkdir -p a\ncat >> a/b.md << EOF\n\n## $(date -u +%Y) — x\n- Decisión: d\nEOF\n```");
      assert.match(r, /registre en `a\/b\.md`/);
      assert.match(r, /## <fecha UTC> — x/);
      assert.ok(!/EOF|cat >>/.test(r));
    });
  });
});

describe("forge init escribe los agentes nativos", () => {
  /** @type {Record<string, [string, string, number]>} */
  const esperado = {
    copilot: [".github/agents", ".agent.md", 14], cursor: [".cursor/agents", ".md", 14], codex: [".codex/agents", ".toml", 14],
    opencode: [".opencode/agents", ".md", 14], kiro: [".kiro/agents", ".json", 14], gemini: [".gemini/agents", ".md", 14],
  };
  for (const [clave, [carpeta, ext, n]] of Object.entries(esperado)) {
    test(`${clave}: ${n} agentes en ${carpeta}; una segunda pasada no avisa; un archivo ajeno no se pisa`, () => {
      const cwd = temporal("forge-an-"), home = temporal("forge-an-h-");
      const r = forge(cwd, home, "init", "--integracion", clave);
      assert.equal(r.status, 0, r.salida);
      const lista = readdirSync(join(cwd, ...carpeta.split("/"))).filter((x) => x.endsWith(ext));
      assert.equal(lista.length, n);
      assert.match(r.salida, new RegExp(`Agentes nativos de .*: ${n} en`));
      const r2 = forge(cwd, home, "update");
      assert.equal(r2.status, 0, r2.salida);
      assert.ok(!/no es de FORGE, no se pisa/.test(r2.salida), r2.salida);
    });
  }
  test("un archivo ajeno con el mismo nombre en una instalación nueva no se pisa", () => {
    const cwd = temporal("forge-an-"), home = temporal("forge-an-h-");
    mkdirSync(join(cwd, ".cursor", "agents"), { recursive: true });
    writeFileSync(join(cwd, ".cursor", "agents", "revisor.md"), "MIO\n");
    const r = forge(cwd, home, "init", "--integracion", "cursor");
    assert.equal(r.status, 0, r.salida);
    assert.equal(readFileSync(join(cwd, ".cursor", "agents", "revisor.md"), "utf8"), "MIO\n");
    assert.match(r.salida, /no es de FORGE, no se pisa/);
  });
  test("Windsurf y la genérica no generan agentes nativos y lo dicen", () => {
    const cwd = temporal("forge-an-"), home = temporal("forge-an-h-");
    const r = forge(cwd, home, "init", "--integracion", "windsurf");
    assert.equal(r.status, 0, r.salida);
    assert.match(r.salida, /Agentes nativos: no se generan/);
    assert.ok(!existsSync(join(cwd, ".windsurf", "agents")));
  });
});

describe("una sola fuente de «solo lectura»", () => {
  test("la lista del guardián nombra solo agentes que existen y es la que usa pre-tool-guard.js", () => {
    for (const a of SOLO_LECTURA) assert.ok(agentes.includes(a), `${a} no existe en agents/`);
    const guardian = readFileSync(join(ROOT, "claude-hooks", "pre-tool-guard.js"), "utf8");
    assert.ok(guardian.includes("new Set(AGENTES_SOLO_LECTURA)"), "el guardián importa la lista, no la duplica");
    assert.ok(!guardian.includes("'disenador-api'"), "el guardián no repite nombres de agentes");
  });
  test("ningún agente de solo lectura declara herramientas de escritura en su cabecera (14 agentes cruzados)", () => {
    assert.equal(agentes.length, 14);
    for (const a of agentes) {
      const declaradas = herramientasDe(separarCabecera(texto(a)).campos.get("tools"));
      if (SOLO_LECTURA.includes(a)) assert.deepEqual(declaradas.filter((h) => ESCRIBE.includes(h)), [], `${a} es de solo lectura pero declara escritura`);
    }
  });
  test("ningún formato nativo da herramientas de escritura a un agente de solo lectura, ni aunque la cabecera las declarara", () => {
    // Una cabecera que declara escritura no debe llegar a ningún destino: se compara con la misma cabecera sin ella
    for (const a of SOLO_LECTURA) {
      const conEscritura = texto(a).replace(/^tools:.*$/m, 'tools: ["Read", "Write", "Edit", "Grep", "Bash"]');
      const sinEscritura = texto(a).replace(/^tools:.*$/m, 'tools: ["Read", "Grep", "Bash"]');
      for (const clave of CLAVES_CON_AGENTE_NATIVO) {
        const r = agenteANativo(clave, a, conEscritura, opciones);
        const base = agenteANativo(clave, a, sinEscritura, opciones);
        assert.deepEqual(r, base, `${clave}/${a}: la escritura declarada no debe cambiar el resultado`);
        if (r && "contenido" in r && clave === "cursor") assert.match(r.contenido, /^readonly: true$/m, `${clave}/${a}`);
      }
    }
  });
});
