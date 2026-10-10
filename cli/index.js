#!/usr/bin/env node
// @ts-check
/**
 * FORGE — CLI de instalación multiplataforma (Windows / macOS / Linux).
 * (también disponible como sdd-es para compatibilidad)
 *
 * Uso:
 *   npx forge init             instala en el proyecto actual (.claude/ + .sdd/)
 *   npx forge init --global    instala en $HOME/.claude (todos los proyectos)
 *   npx forge update           re-copia commands/agents/skills/hooks sin tocar .sdd/ ni settings
 *   npx forge doctor           diagnostica la instalación
 *   npx forge --version        muestra la versión
 */

import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { execSync } from "node:child_process";
import { generarAgentsMd } from "../core/agents-md.js";
import { detectStack } from "../core/stack-detector.js";
import { copiarArbol, copiarArchivo, crearArchivo, crearDirectorio, ErrorEnlace, escribirArchivo } from "../core/escritura-segura.js";
// ─── Paths ────────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
/** Raíz del plugin (un nivel arriba de cli/). */
const PLUGIN_DIR = join(__dirname, "..");

// ─── Colores (degradan a texto plano si no hay TTY) ─────────────────────────────

const tty = process.stdout.isTTY;
const c = {
  verde: (s) => (tty ? `\x1b[0;32m${s}\x1b[0m` : s),
  amarillo: (s) => (tty ? `\x1b[1;33m${s}\x1b[0m` : s),
  rojo: (s) => (tty ? `\x1b[0;31m${s}\x1b[0m` : s),
  azul: (s) => (tty ? `\x1b[0;34m${s}\x1b[0m` : s),
};

const info = (msg) => console.log(`${c.verde("✓")} ${msg}`);
const aviso = (msg) => console.log(`${c.amarillo("⚠")}  ${msg}`);
const titulo = (msg) => console.log(`${c.azul("❯")} ${msg}`);
function error(msg) {
  console.error(`${c.rojo("✗")} ${msg}`);
  process.exit(1);
}

// ─── Escritura segura (revisión independiente de la fase 9, H-01) ───────────────────
//
// `forge init` corre dentro de un repositorio que puede ser ajeno. Todo lo que escribe pasa por
// core/escritura-segura.js: no sigue enlaces simbólicos ni uniones (tampoco colgantes), no sale de
// la raíz de escritura y no sobrescribe a través de un enlace. Si el destino es un enlace, se
// informa y no se escribe.

/** Directorio fuera del cual `init` no escribe: el proyecto, o ~/.claude con --global. */
let raizEscritura = process.cwd();

/** Ejecuta una escritura; un enlace en el camino se informa y se sigue con lo demás. @returns {any} */
function protegido(fn) {
  try { return fn(); } catch (e) {
    if (e instanceof ErrorEnlace) { aviso(`No se escribe: ${e.message}`); return undefined; }
    throw e;
  }
}

/** Crea un directorio dentro de la raíz de escritura. */
function crearDir(dir) { return protegido(() => crearDirectorio(raizEscritura, dir)); }

/** Crea un archivo que no existe (nunca sobrescribe). true si lo creó. */
function crearNuevo(ruta, contenido) { return protegido(() => crearArchivo(raizEscritura, ruta, contenido)) === true; }

/** Deja el archivo con este contenido (lo crea o lo reemplaza si es un archivo normal). true si lo escribió. */
function escribirSeguro(ruta, contenido) { return protegido(() => { escribirArchivo(raizEscritura, ruta, contenido); return true; }) === true; }

// ─── Utilidades de copia ────────────────────────────────────────────────────────

/** Copia todos los .md de un directorio origen a uno destino. Devuelve cuántos. */
function copyMd(srcDir, destDir) {
  if (crearDir(destDir) === undefined) return 0;
  const archivos = readdirSync(srcDir).filter((f) => f.endsWith(".md"));
  let n = 0;
  for (const f of archivos) {
    if (protegido(() => { copiarArchivo(raizEscritura, join(srcDir, f), join(destDir, f)); return true; })) n++;
  }
  return n;
}

/** Copia un directorio completo (recursivo). */
function copyDir(srcDir, destDir) {
  const { bloqueados } = copiarArbol(raizEscritura, srcDir, destDir);
  for (const b of bloqueados) aviso(`No se escribe: es un enlace o pasa por uno: ${b}`);
}

/** Copia un archivo suelto del plugin. true si lo copió. */
function copiarSeguro(origen, destino) {
  return protegido(() => { copiarArchivo(raizEscritura, origen, destino); return true; }) === true;
}

function pluginVersion() {
  try {
    const pkg = JSON.parse(
      readFileSync(join(PLUGIN_DIR, "package.json"), "utf8")
    );
    return pkg.version || "desconocida";
  } catch {
    return "desconocida";
  }
}

/** ¿Está `claude` en el PATH? */
function claudeEnPath() {
  try {
    execSync(process.platform === "win32" ? "where claude" : "command -v claude", {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

// ─── Banner ─────────────────────────────────────────────────────────────────────

function banner() {
  console.log("");
  console.log("  ╔══════════════════════════════════════════════════════╗");
  console.log("  ║                                                      ║");
  console.log("  ║              FORGE — Tu equipo técnico en Claude Code ║");
  console.log("  ║                                                      ║");
  console.log("  ╚══════════════════════════════════════════════════════╝");
  console.log("");
}

// ─── Copia núcleo (commands/agents/skills/hooks) ────────────────────────────────

/**
 * Copia los artefactos del plugin a CLAUDE_DIR.
 * @param {string} claudeDir destino (.claude del proyecto o global)
 */
function copiarNucleo(claudeDir) {
  titulo("Copiando comandos...");
  const nCmd = copyMd(join(PLUGIN_DIR, "commands"), join(claudeDir, "commands"));
  info(`Comandos instalados (${nCmd} archivos)`);

  titulo("Copiando agentes...");
  const nAg = copyMd(join(PLUGIN_DIR, "agents"), join(claudeDir, "agents"));
  info(`Agentes instalados (${nAg} archivos)`);

  titulo("Copiando skills...");
  // Skills planas (.md) + skills en formato carpeta (SKILL.md)
  const skillsSrc = join(PLUGIN_DIR, "skills");
  const skillsDest = join(claudeDir, "skills");
  crearDir(skillsDest);
  let nSk = 0;
  for (const entry of readdirSync(skillsSrc, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".md")) {
      if (copiarSeguro(join(skillsSrc, entry.name), join(skillsDest, entry.name))) nSk++;
    } else if (entry.isDirectory()) {
      // skill en formato carpeta (contiene SKILL.md + recursos)
      copyDir(join(skillsSrc, entry.name), join(skillsDest, entry.name));
      nSk++;
    }
  }
  info(`Skills instaladas (${nSk} entradas)`);

  titulo("Instalando hooks de Claude Code...");
  const hooksSrc = join(PLUGIN_DIR, "claude-hooks");
  const hooksDest = join(claudeDir, "hooks");
  crearDir(hooksDest);
  // Los hooks importan ./shared/config.js y los wrappers .sh delegan en los .js:
  // hay que copiar ambos, no solo los .js del primer nivel.
  for (const entry of readdirSync(hooksSrc, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      copyDir(join(hooksSrc, entry.name), join(hooksDest, entry.name));
    } else if (entry.name.endsWith(".js") || entry.name.endsWith(".sh")) {
      copiarSeguro(join(hooksSrc, entry.name), join(hooksDest, entry.name));
    }
  }
  info(`Hooks instalados (${hooksDest})`);
}

// ─── settings.json (no sobreescribe) ────────────────────────────────────────────

function copiarSettings(claudeDir) {
  const dest = join(claudeDir, "settings.json");
  const src = join(PLUGIN_DIR, ".claude-plugin", ".claude", "settings.json");
  if (!existsSync(src)) {
    aviso(`No se encontró settings.json de plantilla en ${src} — se omite`);
    return;
  }
  if (!existsSync(dest)) {
    // Reescribir rutas de hooks: la plantilla usa "claude-hooks/" (válida en el repo
    // del plugin), pero los hooks se instalan en "<claudeDir>/hooks/".
    // Claude Code ejecuta los hooks con CWD = proyecto del usuario, así que la ruta
    // debe ser relativa a .claude/ o absoluta. Usamos ".claude/hooks/" (relativa a CWD
    // del proyecto) que es el destino real donde el instalador los deja.
    let settings = readFileSync(src, "utf8");
    settings = settings.replaceAll("claude-hooks/", ".claude/hooks/");
    if (crearNuevo(dest, settings)) info(`Settings de seguridad instalados (${dest})`);
  } else {
    aviso(`settings.json ya existe en ${claudeDir} — no se sobreescribe`);
    aviso(`Revisa manualmente: ${src}`);
  }
}

// ─── Estructura .sdd/ del proyecto ──────────────────────────────────────────────

const HOOKS_README = `# Hooks personalizados de SDD-ES

Coloca aquí tus scripts ejecutables para integrar tu workflow con SDD.

## Hooks por fase

- \`antes_constitucion.sh\`    \`despues_constitucion.sh\`
- \`antes_especificar.sh\`     \`despues_especificar.sh\`
- \`antes_aclarar.sh\`         \`despues_aclarar.sh\`
- \`antes_planificar.sh\`      \`despues_planificar.sh\`
- \`antes_tareas.sh\`          \`despues_tareas.sh\`
- \`antes_analizar.sh\`        \`despues_analizar.sh\`
- \`antes_implementar.sh\`     \`despues_implementar.sh\`
- \`antes_cada_tarea.sh\`      \`despues_cada_tarea.sh\`  (recibe T_ID como arg)
- \`antes_verificar.sh\`       \`despues_verificar.sh\`
- \`antes_importar.sh\`

Recuerda dar permiso de ejecución a tus hooks en sistemas Unix:
\`chmod +x .sdd/hooks/tu-hook.sh\`

Ver más ejemplos en docs/EJEMPLOS.md del plugin.
`;

function configurarSdd(claudeDir, overrides = {}) {
  titulo("Configurando estructura .sdd/ del proyecto...");

  const sub = [
    "memoria",
    "especificaciones",
    "cambios",
    "arquitectura",
    join("dominio", "definiciones"),
    "hooks",
    "plantillas",
  ];
  for (const d of sub) {
    crearDir(join(process.cwd(), ".sdd", d));
  }

  // Plantillas
  copyMd(join(PLUGIN_DIR, "plantillas"), join(process.cwd(), ".sdd", "plantillas"));
  info("Plantillas copiadas a .sdd/plantillas/");

  // Config (no sobreescribe)
  const configDest = join(process.cwd(), ".sdd", "sdd.config.yaml");
  if (!existsSync(configDest)) {
    if (crearNuevo(configDest, readFileSync(join(PLUGIN_DIR, "configuracion-ejemplo", "sdd.config.yaml")))) {
      info("Configuración por defecto copiada (.sdd/sdd.config.yaml)");
    }
  } else {
    aviso("Configuración ya existe — no se sobreescribe");
  }

  // Aplicar overrides del wizard --guided
  if (Object.keys(overrides).length > 0 && existsSync(configDest)) {
    let yaml = readFileSync(configDest, "utf8");
    if (overrides.perfil) {
      yaml = yaml.replace(/^(\s*perfil_default:\s*).*$/m, `$1"${overrides.perfil}"`);
    }
    if (overrides.modelo) {
      yaml = yaml.replace(/^(\s*modelo:\s*claude-)[^\s"#]*/gm, `$1${overrides.modelo.replace("claude-", "")}`);
    }
    if (overrides.sesionModo) {
      yaml = yaml.replace(/^(\s*modo:\s*).*$/m, `$1"${overrides.sesionModo}"`);
    }
    if (escribirSeguro(configDest, yaml)) info("Configuración personalizada aplicada (wizard --guided)");
  }

  // .claudeignore (no sobreescribe — respeta personalizaciones del usuario)
  const claudeignoreDest = join(process.cwd(), ".claudeignore");
  if (!existsSync(claudeignoreDest)) {
    if (copiarSeguro(join(PLUGIN_DIR, "configuracion-ejemplo", ".claudeignore"), claudeignoreDest)) info(".claudeignore creado — excluye node_modules, dist, observabilidad FORGE del contexto");
  } else {
    aviso(".claudeignore ya existe — no se sobreescribe");
  }

  // README de hooks (no sobreescribe)
  const hooksReadme = join(process.cwd(), ".sdd", "hooks", "README.md");
  if (!existsSync(hooksReadme)) {
    if (crearNuevo(hooksReadme, HOOKS_README)) info("README de hooks creado (.sdd/hooks/README.md)");
  }

  // Documentación local (opcional)
  const docsDest = join(process.cwd(), ".sdd", "docs");
  if (!existsSync(docsDest)) {
    copyMd(join(PLUGIN_DIR, "docs"), docsDest);
    info("Documentación copiada a .sdd/docs/");
  }
}

// ─── Fin ─────────────────────────────────────────────────────────────────────────

function pasosFinales() {
  console.log("");
  console.log("  ╔══════════════════════════════════════════════════════════════╗");
  console.log("  ║                  ✅  FORGE instalado                         ║");
  console.log("  ╠══════════════════════════════════════════════════════════════╣");
  console.log("  ║                                                              ║");
  console.log("  ║   Abre Claude Code y escribe:                                ║");
  console.log("  ║                                                              ║");
  console.log('  ║      /forge "describe tu idea aquí"                          ║');
  console.log("  ║                                                              ║");
  console.log("  ║   Ejemplo:                                                   ║");
  console.log('  ║      /forge "una app para registrar mis gastos diarios"      ║');
  console.log("  ║                                                              ║");
  console.log("  ║   ¿Necesitas ayuda? Escribe:  /forge ayuda                   ║");
  console.log("  ╚══════════════════════════════════════════════════════════════╝");
  console.log("");
}

// ─── Comandos ───────────────────────────────────────────────────────────────────

const CLAUDE_MD_SECCION = `
## FORGE

FORGE está activo en este proyecto. Es tu equipo de ingeniería en Claude Code.

### Comandos principales
- \`/forge "tu idea"\` — Inicia o continúa el pipeline SDD+TDD
- \`/forge.explicame\` — Explica en lenguaje humano qué está pasando
- \`forge ui\` — Abre el dashboard de progreso en el navegador

### Archivos del sistema FORGE (no editar manualmente)
- \`.sdd/estado.json\` — Estado del pipeline
- \`.sdd/observabilidad/consumo.jsonl\` — Telemetría de agentes
- \`.sdd/sdd.config.yaml\` — Configuración del proyecto

### Cómo interpretar \`.sdd/\`
- \`pipeline_step\`: fase actual (input → ir → spec → plan → implementando → verificado)
- \`spec_activa\`: spec aprobada en uso
- \`plan_activo\`: plan de tareas generado

Para modo avanzado: usa \`/sdd\` en lugar de \`/forge\`.
`;

const CLAUDE_MD_VERSION = pluginVersion();
const CLAUDE_MD_VERSION_TAG = `<!-- forge-version: ${CLAUDE_MD_VERSION} -->`;

function integrarClaudeMd(cwd) {
  const claudeMdPath = join(cwd, "CLAUDE.md");
  // Un enlace (a otro archivo, a una carpeta o colgante) no se sigue ni para leer ni para escribir
  try {
    if (lstatSync(claudeMdPath).isSymbolicLink()) {
      aviso("CLAUDE.md es un enlace simbólico o una unión — no se modifica (no se escribe a través de enlaces)");
      return;
    }
  } catch { /* no existe: se crea */ }
  const MARCADOR_INICIO = "## FORGE";

  const seccionCompleta = CLAUDE_MD_SECCION.trimEnd() + "\n" + CLAUDE_MD_VERSION_TAG + "\n";

  if (existsSync(claudeMdPath)) {
    const contenido = readFileSync(claudeMdPath, "utf8");
    if (contenido.includes(MARCADOR_INICIO)) {
      // Actualizar sección existente — reemplazar desde ## FORGE hasta el tag de versión o fin del bloque
      const idx = contenido.indexOf(MARCADOR_INICIO);
      // Encuentra el fin de la sección FORGE: próximo ## de nivel 2 (no ##) o fin de archivo
      const resto = contenido.slice(idx);
      const sigSeccion = resto.search(/\n## [^F]/);
      const fin = sigSeccion === -1 ? contenido.length : idx + sigSeccion;
      const antes = contenido.slice(0, idx).trimEnd();
      const despues = contenido.slice(fin).replace(/^\n+/, "");
      const nuevo = antes + "\n" + seccionCompleta + (despues ? "\n" + despues : "");
      if (escribirSeguro(claudeMdPath, nuevo)) info(`Sección FORGE en CLAUDE.md actualizada a v${CLAUDE_MD_VERSION}`);
      return;
    }
    // Añadir sección al final del archivo existente
    const nuevo = contenido.trimEnd() + "\n\n" + seccionCompleta;
    if (escribirSeguro(claudeMdPath, nuevo)) info("Sección FORGE añadida a CLAUDE.md existente");
  } else {
    const contenido = `# Instrucciones del proyecto\n` + seccionCompleta;
    if (crearNuevo(claudeMdPath, contenido)) info("CLAUDE.md creado con sección FORGE");
  }
}

/**
 * `AGENTS.md`: el archivo de instrucciones que leen los agentes de código (spec
 * 2026-10-09-puesta-al-dia, HU-003). Se genera de la constitución del proyecto o, si aún no
 * la tiene, de la plantilla mínima.
 *
 * Si el proyecto ya tiene uno, NO se toca: la propuesta se deja en `.sdd/AGENTS.propuesto.md`.
 * @param {string} cwd
 * @returns {"creado"|"propuesto"|"al_dia"}
 */
function integrarAgentsMd(cwd) {
  const destino = join(cwd, "AGENTS.md");
  const rutaConstitucion = join(cwd, ".sdd", "memoria", "constitucion.md");
  const constitucion = existsSync(rutaConstitucion) ? readFileSync(rutaConstitucion, "utf8") : null;
  const plantilla = readFileSync(join(PLUGIN_DIR, "plantillas", "AGENTS.md"), "utf8");

  // Solo datos del propio proyecto y nunca su ruta: el nombre de su manifiesto y su comando de pruebas
  let nombre;
  try { nombre = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8")).name; } catch { /* sin manifiesto de Node */ }
  let pruebas;
  try { pruebas = detectStack(cwd).test_cmd || undefined; } catch { /* sin stack reconocible */ }

  const { contenido, origen } = generarAgentsMd({ constitucion, plantilla, nombre: typeof nombre === "string" ? nombre : undefined, pruebas });
  const de = origen === "constitucion" ? "la constitución del proyecto" : "la plantilla mínima (el proyecto aún no tiene constitución)";

  // Un enlace (también colgante) no se sigue: `existsSync` lo vería «no existe» y se escribiría al otro lado
  let enlace = null;
  for (const ruta of [destino, join(cwd, ".sdd"), join(cwd, ".sdd", "AGENTS.propuesto.md")]) {
    try { if (lstatSync(ruta).isSymbolicLink()) { enlace = ruta; break; } } catch { /* no existe */ }
  }
  if (enlace) {
    aviso(`AGENTS.md no se escribe: ${enlace} es un enlace simbólico o una unión (no se escribe a través de ellos).`);
    return "enlace";
  }

  let existe = false;
  try { lstatSync(destino); existe = true; } catch { /* no existe */ }
  if (!existe) {
    try {
      if (crearArchivo(cwd, destino, contenido)) {
        info(`AGENTS.md creado a partir de ${de}`);
        return "creado";
      }
    } catch (e) {
      if (!(e instanceof ErrorEnlace)) throw e;
      aviso(`AGENTS.md no se escribe: ${e.message}`);
      return "enlace";
    }
  }
  if (readFileSync(destino, "utf8").replace(/\r\n/g, "\n") === contenido) {
    info("AGENTS.md ya está al día");
    return "al_dia";
  }
  const propuesta = join(cwd, ".sdd", "AGENTS.propuesto.md");
  try {
    escribirArchivo(cwd, propuesta, contenido);
  } catch (e) {
    if (!(e instanceof ErrorEnlace)) throw e;
    aviso(`La propuesta de AGENTS.md no se escribe: ${e.message}`);
    return "enlace";
  }
  aviso("AGENTS.md ya existe — no se sobreescribe");
  aviso(`  Propuesta generada de ${de}: .sdd/AGENTS.propuesto.md (compárala y copia lo que quieras)`);
  return "propuesto";
}

function cmdInit(global, guided = false, withUi = false, preset = null, template = null) {
  banner();
  const claudeDir = global
    ? join(homedir(), ".claude")
    : join(process.cwd(), ".claude");
  console.log(`  Modo: ${global ? "GLOBAL" : "PROYECTO"} (${claudeDir})`);
  // Con --global se escribe en ~/.claude; en un proyecto, dentro del proyecto y de ningún otro sitio
  if (global) mkdirSync(claudeDir, { recursive: true });
  raizEscritura = global ? claudeDir : process.cwd();
  if (template) console.log(`  Template: ${template}`);
  console.log("");

  if (!claudeEnPath()) {
    aviso("Claude Code CLI no detectado en PATH. Los archivos se instalarán de todos modos.");
  }

  copiarNucleo(claudeDir);
  copiarSettings(claudeDir);

  if (!global) {
    const overrides = guided ? wizardGuiado() : {};
    configurarSdd(claudeDir, overrides);
  }

  if (template) {
    aplicarTemplate(template);
  }

  if (preset) {
    aplicarPreset(preset);
  }

  if (!global) {
    integrarClaudeMd(process.cwd());
    integrarAgentsMd(process.cwd());
  }

  if (withUi) {
    instalarUi();
  }

  if (template) {
    pasosFinalesConTemplate(template);
  } else {
    pasosFinales();
  }
}

const TEMPLATES_DISPONIBLES = ["api-rest", "cli-tool", "saas-mvp"];

const TEMPLATE_EJEMPLOS = {
  "api-rest":  '/forge "añade endpoint para listar usuarios con paginación"',
  "cli-tool":  '/forge "añade subcomando deploy que sube los archivos a producción"',
  "saas-mvp":  '/forge "añade la gestión de equipos con invitación por email"',
};

const TEMPLATE_DESCRIPCION = {
  "api-rest":  "API REST con autenticación JWT y CRUD",
  "cli-tool":  "CLI con subcomandos y UX profesional",
  "saas-mvp":  "SaaS MVP con autenticación, dashboard y CRUD",
};

function aplicarTemplate(template) {
  if (!TEMPLATES_DISPONIBLES.includes(template)) {
    error(
      `Template '${template}' no existe. Templates disponibles: ${TEMPLATES_DISPONIBLES.join(", ")}.\n` +
      `  Uso: forge init --template api-rest`
    );
  }
  const templateSrc = join(PLUGIN_DIR, "presets", "templates", template);
  if (!existsSync(templateSrc)) {
    aviso(`Directorio de template no encontrado: ${templateSrc}`);
    return null;
  }
  const sddDir = join(process.cwd(), ".sdd");
  if (crearDir(sddDir) === undefined) return null;

  // Copiar ir.json
  const irSrc = join(templateSrc, "ir.json");
  if (existsSync(irSrc)) {
    const ir = JSON.parse(readFileSync(irSrc, "utf8"));
    ir.created_at = new Date().toISOString();
    ir.id = `ir-${template}-${Date.now()}`;
    if (escribirSeguro(join(sddDir, "ir.json"), JSON.stringify(ir, null, 2))) info(`IR pre-generado desde template ${template}`);
  }

  // Copiar spec.md a .sdd/especificaciones/
  const specSrc = join(templateSrc, "spec.md");
  if (existsSync(specSrc)) {
    const specId = `template-${template}`;
    const specDir = join(sddDir, "especificaciones", specId);
    crearDir(specDir);
    const specContent = readFileSync(specSrc, "utf8")
      .replace(/creada: TEMPLATE/g, `creada: ${new Date().toISOString().slice(0, 10)}`)
      .replace(/actualizada: TEMPLATE/g, `actualizada: ${new Date().toISOString().slice(0, 10)}`);
    if (escribirSeguro(join(specDir, "spec.md"), specContent)) info(`Spec pre-generada desde template ${template}`);
  }

  // Copiar sdd.config.yaml (sobreescribe el default del init)
  const configSrc = join(templateSrc, "sdd.config.yaml");
  const configDest = join(sddDir, "sdd.config.yaml");
  if (existsSync(configSrc)) {
    if (copiarSeguro(configSrc, configDest)) info(`Configuración del template ${template} aplicada`);
  }

  // Inicializar estado.json con schemaVersion
  const estadoDest = join(sddDir, "estado.json");
  if (!existsSync(estadoDest)) {
    crearNuevo(estadoDest, JSON.stringify({
      schemaVersion: "1.0",
      ir_generado: true,
      ir_path: ".sdd/ir.json",
      pipeline_step: "ir",
      ultima_actualizacion: new Date().toISOString(),
    }, null, 2));
  }

  return template;
}

function pasosFinalesConTemplate(template) {
  const desc = TEMPLATE_DESCRIPCION[template] || template;
  const ejemplo = TEMPLATE_EJEMPLOS[template] || '/forge "describe tu idea"';
  console.log("");
  console.log("  ╔══════════════════════════════════════════════════════════════╗");
  console.log(`  ║   ✅  FORGE listo — Template: ${desc.padEnd(30)}║`);
  console.log("  ╠══════════════════════════════════════════════════════════════╣");
  console.log("  ║                                                              ║");
  console.log("  ║   Tu proyecto ya tiene una spec pre-generada.                ║");
  console.log("  ║   Abre Claude Code y escribe tu primera idea:                ║");
  console.log("  ║                                                              ║");
  console.log(`  ║   ${ejemplo.padEnd(60)}║`);
  console.log("  ║                                                              ║");
  console.log("  ║   O personaliza desde cero:                                  ║");
  console.log('  ║      /forge "describe tu idea aquí"                          ║');
  console.log("  ║                                                              ║");
  console.log("  ╚══════════════════════════════════════════════════════════════╝");
  console.log("");
}

function aplicarPreset(preset) {
  const presets = ["lean", "startup", "enterprise"];
  if (!presets.includes(preset)) {
    aviso(`Preset desconocido: "${preset}". Opciones: lean, startup, enterprise`);
    return;
  }
  const presetSrc  = join(PLUGIN_DIR, "presets", `${preset}.yaml`);
  const configDest = join(process.cwd(), ".sdd", "sdd.config.yaml");
  if (!existsSync(presetSrc)) {
    aviso(`Archivo de preset no encontrado: ${presetSrc}`);
    return;
  }
  if (!existsSync(join(process.cwd(), ".sdd"))) {
    aviso(".sdd/ no existe — ejecuta forge init primero");
    return;
  }
  const presetContent = readFileSync(presetSrc, "utf8");
  // Preserva los bloques de rutas, protecciones y figma del config actual
  let current = existsSync(configDest) ? readFileSync(configDest, "utf8") : "";
  const bloques = ["rutas:", "protecciones:", "figma:", "mapeos:", "memoria:", "compresion:", "control_versiones:"];
  let extraContent = "";
  for (const bloque of bloques) {
    const idx = current.indexOf(`\n${bloque}`);
    if (idx !== -1) {
      // Extrae el bloque hasta el próximo bloque de nivel 0 o fin de archivo
      const rest = current.slice(idx);
      const nextBloque = rest.slice(1).search(/\n[a-z]/);
      extraContent += (nextBloque === -1 ? rest : rest.slice(0, nextBloque + 1)) + "\n";
    }
  }
  if (escribirSeguro(configDest, presetContent + (extraContent ? "\n" + extraContent : ""))) info(`Preset "${preset}" aplicado → .sdd/sdd.config.yaml`);
}

function instalarUi() {
  titulo("Instalando dashboard UI...");
  const uiSrc  = join(PLUGIN_DIR, "ui");
  const uiDest = join(process.cwd(), ".forge-ui");
  try {
    const { bloqueados } = copiarArbol(raizEscritura, uiSrc, uiDest);
    for (const b of bloqueados) aviso(`No se escribe: es un enlace o pasa por uno: ${b}`);
    if (bloqueados.length > 0) return;
    info(`Dashboard instalado en ${uiDest}`);
    info("Usa 'forge ui' para abrirlo en tu navegador");
  } catch (e) {
    aviso(`No se pudo instalar el dashboard: ${e.message}`);
  }
}

/**
 * Wizard interactivo --guided: pregunta 4 cuestiones clave y devuelve
 * overrides para aplicar sobre sdd.config.yaml.
 * @returns {{ perfil?: string, modo?: string, modelo?: string, sesionModo?: string }}
 */
function wizardGuiado() {
  // Lee una línea de stdin de forma síncrona (TTY interactivo)
  function preguntar(pregunta, opciones, defaultIdx = 0) {
    const opcionesStr = opciones.map((o, i) => `  ${i + 1}. ${o}`).join("\n");
    process.stdout.write(`\n${pregunta}\n${opcionesStr}\n  [${defaultIdx + 1}]: `);
    const buf = Buffer.alloc(16);
    let respuesta = "";
    try {
      // En Windows stdin es el fd 0 directamente
      const n = (/** @type {any} */ (process.stdin.fd !== undefined))
        ? readFileSync("/dev/stdin").toString().slice(0, 2)
        : "";
      respuesta = n.trim();
    } catch {
      // stdin no disponible (pipes, CI) — usa default silenciosamente
    }
    const idx = parseInt(respuesta, 10) - 1;
    return (idx >= 0 && idx < opciones.length) ? idx : defaultIdx;
  }

  console.log("\n  ╔══════════════════════════════════════╗");
  console.log("  ║   SDD-ES — Configuración guiada      ║");
  console.log("  ╚══════════════════════════════════════╝");
  console.log("  Responde con el número de tu elección (Enter = opción 1)\n");

  const perfilIdx = preguntar(
    "¿Cómo prefieres trabajar?",
    ["experto — flujo técnico directo", "guiado — el hub /sdd te conduce paso a paso"],
    0
  );
  const perfil = perfilIdx === 1 ? "guiado" : "experto";

  const modeloIdx = preguntar(
    "¿Qué balance calidad/costo prefieres para los agentes de decisión?",
    [
      "calidad alta — opus para arquitecto, crítico, seguridad",
      "balanceado — sonnet para todos",
      "económico — haiku para todos"
    ],
    0
  );
  const modeloMap = ["claude-opus-4-8", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"];
  const modelo = modeloMap[modeloIdx];

  const modoIdx = preguntar(
    "¿Modo de sesión por defecto?",
    [
      "normal — flujo completo con crítico, seguridad y ADR",
      "rapido — sin crítico (ahorra ~30% tokens)",
      "prototipo — solo implementar, sin revisores"
    ],
    0
  );
  const sesionModo = ["normal", "rapido", "prototipo"][modoIdx];

  console.log("\n  Configuración elegida:");
  console.log(`    Perfil:      ${perfil}`);
  console.log(`    Modelo:      ${modelo}`);
  console.log(`    Modo sesión: ${sesionModo}`);
  console.log("");

  return { perfil, modelo, sesionModo };
}

function cmdUpdate(global) {
  banner();
  const claudeDir = global
    ? join(homedir(), ".claude")
    : join(process.cwd(), ".claude");
  console.log(`  Actualizando núcleo en: ${claudeDir}`);
  console.log("  (.sdd/ y settings.json del usuario NO se tocan)");
  console.log("");

  if (!existsSync(claudeDir)) {
    error(`No existe ${claudeDir}. Ejecuta 'npx sdd-es init' primero.`);
  }

  copiarNucleo(claudeDir);
  info("Núcleo actualizado. Tu .sdd/ y settings.json se conservan.");
  console.log("");
}

async function cmdDoctorLlm(apiKey, { problemas }) {
  // 0. Provider activo
  const providerActivo = process.env.FORGE_LLM_PROVIDER ?? 'anthropic (default)';
  info(`Provider LLM activo: ${providerActivo}`);
  info("  Cambiar: FORGE_LLM_PROVIDER=ollama|openai|stub  o  llm.provider en sdd.config.yaml");
  const { lineaRevision } = await import("../core/precios.js");
  info(lineaRevision());

  // 1. Detectar modo de ejecución: Claude Code (hooks) vs API directa
  const enClaudeCode = !!(
    process.env.CLAUDE_AGENT_NAME ||
    process.env.CLAUDE_SESSION_ID ||
    existsSync(join(process.cwd(), ".claude", "settings.json")) ||
    existsSync(join(process.cwd(), ".claude-plugin", ".claude", "settings.json"))
  );

  if (enClaudeCode) {
    info("Modo Claude Code detectado — el LLM lo gestiona Claude Code, no FORGE directamente ✓");
    info("  El SDK @anthropic-ai/sdk no es necesario en este modo");
  } else {
    info("Modo API directa — FORGE llamará al LLM vía @anthropic-ai/sdk");
  }

  // 2. SDK disponible (solo necesario en modo API directa)
  let sdk = null;
  try {
    sdk = await import('@anthropic-ai/sdk');
    info("SDK @anthropic-ai/sdk disponible ✓");
  } catch {
    if (enClaudeCode) {
      info("SDK @anthropic-ai/sdk no instalado — no es necesario en modo Claude Code ✓");
    } else {
      aviso("@anthropic-ai/sdk no instalado — necesario para modo API directa");
      aviso("  Solución: npm install @anthropic-ai/sdk");
      problemas(1);
    }
    // En modo Claude Code podemos hacer diagnóstico parcial sin SDK
    if (!enClaudeCode) return;
  }

  // 3. API key presente (necesaria para el ping)
  if (!apiKey) {
    if (enClaudeCode) {
      aviso("ANTHROPIC_API_KEY no definida — Claude Code la gestiona internamente");
      aviso("  Si los agentes fallan, verifica que Claude Code tiene la key configurada");
    } else {
      aviso("Sin API key — se omite el ping al LLM");
      problemas(1);
    }
    // Sin key no podemos hacer ping
    if (!apiKey) return;
  }

  // 3. Ping real al LLM con mensaje mínimo
  titulo("Ping al LLM (modelo: claude-haiku-4-5-20251001)...");
  const PING_PROMPT = "Responde exactamente con el JSON: {\"ok\":true}";
  const PING_TIMEOUT_MS = 10_000;
  let respuestaRaw = "";
  try {
    const client = new sdk.default({ apiKey });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
    const res = await client.messages.create(
      {
        model: "claude-haiku-4-5-20251001",
        max_tokens: 32,
        messages: [{ role: "user", content: PING_PROMPT }],
      },
      { signal: controller.signal }
    );
    clearTimeout(timer);
    respuestaRaw = res.content?.[0]?.text ?? "";
    info(`LLM responde ✓ (${res.usage?.output_tokens ?? "?"} tokens de salida)`);
  } catch (e) {
    if (e?.name === "AbortError" || e?.code === "UND_ERR_CONNECT_TIMEOUT") {
      aviso(`LLM no respondió en ${PING_TIMEOUT_MS / 1000}s — posible problema de red o API key inválida`);
    } else if (e?.status === 401) {
      aviso("API key rechazada (401 Unauthorized) — verifica ANTHROPIC_API_KEY");
    } else if (e?.status === 429) {
      aviso("Rate limit alcanzado (429) — espera unos segundos y vuelve a intentarlo");
    } else if (e?.status >= 500) {
      aviso(`Error del servidor Anthropic (${e.status}) — reintenta más tarde`);
    } else {
      aviso(`Error inesperado al contactar el LLM: ${e?.message ?? e}`);
    }
    problemas(1);
    return;
  }

  // 4. Validar que la respuesta es JSON parseable
  try {
    const parsed = JSON.parse(respuestaRaw.match(/\{[\s\S]*\}/)?.[0] ?? "");
    if (parsed?.ok === true) {
      info("LLM devuelve JSON válido ✓");
    } else {
      aviso(`LLM respondió JSON pero sin {ok:true}: ${respuestaRaw.slice(0, 80)}`);
    }
  } catch {
    aviso(`LLM no devolvió JSON parseable — respuesta: ${respuestaRaw.slice(0, 120)}`);
    aviso("  Esto puede causar fallos silenciosos en ir.json y spec.md");
    problemas(1);
  }

  // 5. Latencia orientativa
  const t0 = Date.now();
  try {
    const client = new sdk.default({ apiKey });
    await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1,
      messages: [{ role: "user", content: "di: ok" }],
    });
    const latencia = Date.now() - t0;
    if (latencia < 3000) {
      info(`Latencia de red: ~${latencia}ms ✓`);
    } else {
      aviso(`Latencia alta: ~${latencia}ms — el pipeline puede ser lento`);
    }
  } catch { /* no bloquear por latencia */ }

  // 6. Modelo configurado en sdd.config.yaml
  const configPath = join(process.cwd(), ".sdd", "sdd.config.yaml");
  if (existsSync(configPath)) {
    const yaml = readFileSync(configPath, "utf8");
    const modeloMatch = yaml.match(/modelo:\s*(\S+)/);
    const modeloConfig = modeloMatch?.[1] ?? "sonnet";
    const modelosValidos = ["opus", "sonnet", "haiku",
      "claude-opus-4-8", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"];
    if (modelosValidos.includes(modeloConfig)) {
      info(`Modelo configurado: "${modeloConfig}" ✓`);
    } else {
      aviso(`Modelo desconocido en sdd.config.yaml: "${modeloConfig}"`);
      aviso("  Válidos: opus | sonnet | haiku");
      problemas(1);
    }
  }

  // 7. Capacidad de SQLite para el decision store
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  const nodeMinor = Number(process.versions.node.split(".")[1] ?? "0");
  if (nodeMajor > 22 || (nodeMajor === 22 && nodeMinor >= 5)) {
    info("node:sqlite nativo disponible — decision store con búsqueda semántica ✓");
  } else {
    aviso(`Node ${process.versions.node} < 22.5 — decision store usa JSONL sin búsqueda semántica`);
    aviso("  Actualiza a Node ≥22.5 para SQLite nativo");
  }
}

async function cmdDoctor() {
  banner();
  console.log("  Diagnóstico de SDD-ES");
  console.log("");

  let problemas = 0;

  // Node
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  if (nodeMajor >= 20) {
    info(`Node ${process.versions.node} (>=20 requerido) ✓`);
  } else {
    aviso(`Node ${process.versions.node} es < 20. Actualiza Node.`);
    problemas++;
  }

  // ANTHROPIC_API_KEY
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    problemas++;
    aviso("ANTHROPIC_API_KEY no está definida — los agentes LLM no funcionarán");
    aviso("  Solución: export ANTHROPIC_API_KEY=sk-ant-... (o añádela a tu .env)");
  } else {
    const preview = apiKey.slice(0, 8) + "..." + apiKey.slice(-4);
    info(`ANTHROPIC_API_KEY presente (${preview}) ✓`);
  }

  // Claude CLI
  if (claudeEnPath()) {
    info("Claude Code CLI detectado en PATH ✓");
  } else {
    aviso("Claude Code CLI no está en PATH (instala desde claude.ai/code)");
  }

  // Versión del plugin
  info(`Versión del plugin: ${pluginVersion()}`);

  // Integridad del plugin
  titulo("Verificando integridad del plugin...");
  for (const dir of ["commands", "agents", "skills", "plantillas", "claude-hooks"]) {
    const p = join(PLUGIN_DIR, dir);
    if (existsSync(p)) {
      const n = readdirSync(p).length;
      info(`${dir}/ (${n} entradas)`);
    } else {
      aviso(`falta ${dir}/ en el plugin`);
      problemas++;
    }
  }

  // ¿Instalado en el proyecto actual?
  titulo("Instalación en el proyecto actual...");
  const localClaude = join(process.cwd(), ".claude", "commands");
  const localSdd = join(process.cwd(), ".sdd");
  if (existsSync(localClaude)) {
    info(`.claude/commands/ presente (${readdirSync(localClaude).length} comandos)`);
  } else {
    aviso(".claude/commands/ no encontrado — ejecuta 'npx sdd-es init'");
  }
  if (existsSync(localSdd)) {
    info(".sdd/ presente");
  } else {
    aviso(".sdd/ no encontrado — ejecuta 'npx sdd-es init'");
  }

  // ── Auditoría CLAUDE.md (límite oficial: 4,000 chars por archivo) ───────────
  titulo("Auditoría de instrucciones (límites oficiales Claude Code)...");
  const claudeMdLocal = join(process.cwd(), ".claude", "CLAUDE.md");
  if (existsSync(claudeMdLocal)) {
    const size = readFileSync(claudeMdLocal, "utf8").length;
    if (size > 3500) {
      aviso(`CLAUDE.md: ${size} chars — cerca del límite silencioso de 4,000 chars`);
      problemas++;
    } else {
      info(`CLAUDE.md: ${size} chars (límite: 4,000) ✓`);
    }
  } else {
    info("CLAUDE.md local: no encontrado (opcional)");
  }

  // ── Validación básica de sdd.config.yaml ─────────────────────────────────
  if (existsSync(localSdd)) {
    titulo("Validando sdd.config.yaml...");
    const configPath = join(process.cwd(), ".sdd", "sdd.config.yaml");
    if (!existsSync(configPath)) {
      aviso("sdd.config.yaml no encontrado en .sdd/ — ejecuta 'npx sdd-es init'");
      problemas++;
    } else {
      const yaml = readFileSync(configPath, "utf8");
      if (!yaml.includes("agentes:")) {
        aviso("sdd.config.yaml: falta la clave obligatoria 'agentes:'"); problemas++;
      } else {
        info("sdd.config.yaml: clave 'agentes:' presente ✓");
      }
      if (!yaml.includes("comportamiento:")) {
        aviso("sdd.config.yaml: falta la clave obligatoria 'comportamiento:'"); problemas++;
      } else {
        info("sdd.config.yaml: clave 'comportamiento:' presente ✓");
      }
      const umbral = yaml.match(/umbral_bytes:\s*(\d+)/);
      if (umbral && parseInt(umbral[1], 10) <= 0) {
        aviso(`sdd.config.yaml: memoria.umbral_bytes debe ser un número positivo`);
        problemas++;
      }
      const modeloInvalido = yaml.match(/modelo:\s*((?!opus|sonnet|haiku)\S+)/);
      if (modeloInvalido) {
        aviso(`sdd.config.yaml: modelo desconocido "${modeloInvalido[1]}" (válidos: opus, sonnet, haiku)`);
        problemas++;
      } else {
        info("sdd.config.yaml: modelos válidos ✓");
      }
    }
  }

  // ── Verificar hooks registrados en settings.json ──────────────────────────
  titulo("Verificando hooks en settings.json...");
  const settingsPaths = [
    join(process.cwd(), ".claude", "settings.json"),
    join(homedir(), ".claude", "settings.json"),
  ];
  let hooksVerificados = false;
  for (const sp of settingsPaths) {
    if (!existsSync(sp)) continue;
    try {
      const settings = JSON.parse(readFileSync(sp, "utf8"));
      const hooks = settings?.hooks ?? {};
      const preHooks = hooks?.PreToolUse ?? [];
      const postHooks = hooks?.PostToolUse ?? [];

      const tienePreGuard = preHooks.some((h) =>
        JSON.stringify(h).includes("pre-tool-guard")
      );
      const tieneMemory = postHooks.some((h) =>
        JSON.stringify(h).includes("agent-memory")
      );

      if (tienePreGuard) {
        info(`pre-tool-guard registrado en ${sp.replace(process.cwd(), ".")} ✓`);
      } else {
        aviso(`pre-tool-guard NO encontrado en ${sp.replace(process.cwd(), ".")} — seguridad reducida`);
        problemas++;
      }
      if (tieneMemory) {
        info(`agent-memory registrado en ${sp.replace(process.cwd(), ".")} ✓`);
      } else {
        aviso(`agent-memory NO encontrado en ${sp.replace(process.cwd(), ".")} — memoria de agentes inactiva`);
      }

      // Verificar que los archivos de hook existen físicamente y tienen sintaxis válida
      const hooksDir = join(process.cwd(), ".claude", "hooks");
      const hooksRequeridos = ["pre-tool-guard.js", "agent-memory.js", "post-write-conventions.js", "context-manager.js"];
      for (const hookFile of hooksRequeridos) {
        const hookPath = join(hooksDir, hookFile);
        if (!existsSync(hookPath)) {
          problemas++;
          aviso(`Hook no encontrado en disco: .claude/hooks/${hookFile}`);
          info(`  Ejecuta: npx forge init  para reinstalar los hooks`);
        } else {
          try {
            execSync(`node --check "${hookPath}"`, { stdio: "pipe" });
            info(`Hook válido: .claude/hooks/${hookFile} ✓`);
          } catch {
            problemas++;
            aviso(`Hook con error de sintaxis: .claude/hooks/${hookFile}`);
          }
        }
      }

      // Validar estado.json si existe
      const estadoPath = join(process.cwd(), ".sdd", "estado.json");
      if (existsSync(estadoPath)) {
        try {
          JSON.parse(readFileSync(estadoPath, "utf8"));
          info("estado.json válido (JSON parseable) ✓");
        } catch {
          aviso("estado.json malformado — borra o regenera con /sdd.estado"); problemas++;
        }
      }

      hooksVerificados = true;
      break;
    } catch {
      aviso(`settings.json malformado en ${sp}`); problemas++;
    }
  }
  if (!hooksVerificados && settingsPaths.every((p) => !existsSync(p))) {
    aviso("settings.json no encontrado — los hooks no están activos. Ejecuta 'npx sdd-es init'");
    problemas++;
  }

  // ── Contrato de hooks ──────────────────────────────────────────────────────
  titulo("Contrato de hooks Claude Code...");
  const hooksContractTest = join(PLUGIN_DIR, "tests", "hooks-contract.test.js");
  if (existsSync(hooksContractTest)) {
    info("Contrato de hooks: ✅ tests/hooks-contract.test.js presente — ejecuta npm test para verificar");
  } else {
    aviso("Contrato de hooks: ⚠️ no verificado — falta tests/hooks-contract.test.js");
  }

  // ── CLAUDE.md del proyecto ─────────────────────────────────────────────────
  titulo("Verificando CLAUDE.md del proyecto...");
  const claudeMdProyecto = join(process.cwd(), "CLAUDE.md");
  if (existsSync(claudeMdProyecto)) {
    const claudeMdContenido = readFileSync(claudeMdProyecto, "utf8");
    if (claudeMdContenido.includes("## FORGE")) {
      const tieneVersion = claudeMdContenido.includes(`forge-version: ${CLAUDE_MD_VERSION}`);
      if (tieneVersion) {
        info(`CLAUDE.md: ✅ FORGE v${CLAUDE_MD_VERSION} registrado`);
      } else {
        aviso(`CLAUDE.md: ⚠️ sección FORGE desactualizada — ejecuta 'forge init' para actualizar`);
      }
    } else {
      aviso("CLAUDE.md: ⚠️ sección FORGE no encontrada — ejecuta 'forge init' para añadirla");
    }
  } else {
    aviso("CLAUDE.md: ⚠️ no existe en el directorio actual — ejecuta 'forge init'");
  }

  // ── CLAUDE_AGENT_NAME (AG-01) ──────────────────────────────────────────────
  titulo("Verificando variable de identidad de agentes...");
  // Esta variable la inyecta Claude Code en cada hook — determina qué agente ejecuta cada tool.
  // Si no está disponible, los guardias read-only y la memoria por agente quedan desactivados.
  const agentNameEnv = process.env.CLAUDE_AGENT_NAME;
  if (agentNameEnv !== undefined) {
    info(`CLAUDE_AGENT_NAME disponible ✓ (valor actual: "${agentNameEnv || '<vacío en contexto doctor>'}")`);
  } else {
    aviso(
      "CLAUDE_AGENT_NAME no encontrada en este entorno (normal fuera de un hook activo).\n" +
      "   Esta variable la inyecta Claude Code automáticamente durante la ejecución de hooks.\n" +
      "   Si los agentes read-only no están bloqueando escrituras, actualiza Claude Code."
    );
  }
  info("Provider: Claude Code (Anthropic) — provider único de FORGE");

  // ── schemaVersion del estado ────────────────────────────────────────────────
  titulo("Verificando esquema .sdd/estado.json...");
  const estadoPath = join(process.cwd(), ".sdd", "estado.json");
  if (!existsSync(estadoPath)) {
    aviso(".sdd/estado.json no existe — se creará al ejecutar el primer comando /forge");
  } else {
    try {
      const estado = JSON.parse(readFileSync(estadoPath, "utf8"));
      if (estado.schemaVersion === "1.0") {
        info(`estado.json schemaVersion: ${estado.schemaVersion} ✓`);
      } else if (!estado.schemaVersion) {
        aviso(`estado.json sin schemaVersion — legado. Ejecuta /sdd.estado para migrar.`);
        problemas++;
      } else {
        aviso(`estado.json schemaVersion desconocida: ${estado.schemaVersion}`);
        problemas++;
      }
    } catch {
      aviso("estado.json malformado — no es JSON válido");
      problemas++;
    }
  }

  // ── MCPs disponibles ───────────────────────────────────────────────────────
  titulo("Verificando MCPs integrados...");
  const mcpConfigPaths = [
    join(process.cwd(), ".mcp.json"),
    join(process.cwd(), "mcp.json"),
    join(homedir(), ".claude", "mcp.json"),
  ];
  let mcpVercel = false;
  let mcpGithub = false;
  let mcpFigma  = false;
  for (const mcpPath of mcpConfigPaths) {
    if (!existsSync(mcpPath)) continue;
    try {
      const mcp = JSON.parse(readFileSync(mcpPath, "utf8"));
      const keys = Object.keys(mcp?.mcpServers ?? mcp ?? {}).join(" ").toLowerCase();
      if (keys.includes("vercel")) mcpVercel = true;
      if (keys.includes("github")) mcpGithub = true;
      if (keys.includes("figma"))  mcpFigma  = true;
    } catch { /* ignora JSON inválido */ }
  }
  if (mcpVercel) info("MCP Vercel: ✅ disponible  →  /forge.desplegar vercel");
  else           aviso("MCP Vercel: ⚠️  no instalado (opcional)  →  úsalo para desplegar con /forge.desplegar vercel");
  if (mcpGithub) info("MCP GitHub: ✅ disponible  →  /sdd.github.pr");
  else           aviso("MCP GitHub: ⚠️  no instalado (opcional)");
  if (mcpFigma)  info("MCP Figma:  ✅ disponible  →  /forge.diseño <url>");
  else           aviso("MCP Figma:  ⚠️  no instalado (opcional)");

  // ── Dashboard UI ────────────────────────────────────────────────────────────
  titulo("Verificando dashboard UI...");
  const localUiServer  = join(process.cwd(), ".forge-ui", "server.js");
  const bundleUiServer = join(PLUGIN_DIR, "ui", "server.js");
  if (existsSync(localUiServer)) {
    info("Dashboard instalado en .forge-ui/ ✓  →  forge ui");
  } else if (existsSync(bundleUiServer)) {
    info("Dashboard disponible en el paquete ✓  →  forge ui");
  } else {
    aviso("Dashboard no disponible — instala con: forge init --ui");
  }

  // ── Aislamiento del ciclo verificado ─────────────────────────────────────────
  titulo("Verificando el aislamiento del ciclo verificado...");
  try {
    const { leerConfigCiclo } = await import("../core/ciclo/config.js");
    const runtime = leerConfigCiclo(process.cwd()).sandbox.runtime;
    /** @type {{ ok: true } | { ok: false, error: string }} */
    let permitido;
    if (!runtime) {
      // Sin mecanismo pedido no hay nada que comprobar aquí: no se consulta a Docker
      info("Mecanismo de aislamiento: el de Docker por defecto (sandbox.runtime sin indicar)");
    } else if ((permitido = (await import("../core/sandbox/politica.js")).runtimePermitido(runtime)).ok === false) {
      // El runtime lo escribe el archivo del proyecto: sin autorización del usuario el ciclo no empieza
      aviso(`${permitido.error} — el ciclo verificado no empezará (código de salida 4)`);
      problemas++;
    } else {
      // Con uno pedido, se pregunta a Docker si lo conoce: es lo que decidirá si el ciclo empieza
      const { DockerCli } = await import("../core/sandbox/docker-cli.js");
      const docker = new DockerCli();
      const disp = await docker.disponible();
      if (disp.ok === false) {
        aviso(`Mecanismo de aislamiento pedido: "${runtime}" (sandbox.runtime) — sin Docker no se puede comprobar (${disp.error})`);
      } else {
        const rt = await docker.runtimeDisponible(runtime);
        if (rt.ok) {
          info(`Mecanismo de aislamiento: "${runtime}" (sandbox.runtime) ✓ (Docker ${disp.version})`);
        } else {
          aviso(`${rt.error} — el ciclo verificado no empezará (código de salida 4)`);
          problemas++;
        }
      }
    }
  } catch (e) {
    aviso(`Configuración del ciclo no válida: ${e instanceof Error ? e.message : e}`);
    problemas++;
  }

  // ── Diagnóstico del LLM ──────────────────────────────────────────────────────
  titulo("Diagnosticando conexión con el LLM...");
  await cmdDoctorLlm(apiKey, { problemas: (n) => { problemas += n; } });

  console.log("");
  if (problemas === 0) {
    info("Diagnóstico OK — sin problemas críticos.");
  } else {
    aviso(`${problemas} problema(s) detectado(s). Revisa arriba.`);
  }
  console.log("");
}

// ─── Config CLI (B3) ───────────────────────────────────────────────────────────

/**
 * Lee sdd.config.yaml como texto plano (sin parser YAML — cero deps).
 * @returns {string} contenido del archivo
 */
function leerConfigYaml() {
  const configPath = join(process.cwd(), ".sdd", "sdd.config.yaml");
  if (!existsSync(configPath)) {
    error("No se encontró .sdd/sdd.config.yaml — ejecuta 'npx sdd-es init' primero.");
  }
  return readFileSync(configPath, "utf8");
}

/**
 * Extrae el bloque de una sección YAML dado su nombre (línea a línea).
 * Funciona incluso si la sección es la última del archivo.
 * @param {string[]} lineas
 * @param {string} seccion
 * @returns {string[]} líneas del bloque (sin la cabecera de sección)
 */
function extraerBloqueSeccion(lineas, seccion) {
  const inicio = lineas.findIndex((l) => l.match(new RegExp(`^${seccion}:\\s*$`)) ||
    l.match(new RegExp(`^${seccion}:\\s+`)));
  if (inicio === -1) return [];
  const bloque = [];
  for (let i = inicio + 1; i < lineas.length; i++) {
    const l = lineas[i];
    if (l.length > 0 && !l.startsWith(" ") && !l.startsWith("\t") && !l.startsWith("#")) break;
    bloque.push(l);
  }
  return bloque;
}

/**
 * Extrae el valor de una clave YAML simple (un nivel o dos niveles separados por punto).
 * Soporta: "sesion.modo", "memoria.umbral_bytes", "perfil"
 * @param {string} yaml
 * @param {string} clave  e.g. "sesion.modo" o "perfil"
 * @returns {string|null}
 */
function yamlGet(yaml, clave) {
  const lineas = yaml.split("\n");
  const partes = clave.split(".");
  if (partes.length === 1) {
    const m = yaml.match(new RegExp(`^${partes[0]}:\\s*(.+)$`, "m"));
    return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
  }
  const [seccion, sub] = partes;
  const bloque = extraerBloqueSeccion(lineas, seccion);
  if (!bloque.length) return null;
  const subRe = new RegExp(`^\\s+${sub}:\\s*(.+)$`);
  for (const l of bloque) {
    const m = subRe.exec(l);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return null;
}

/**
 * Cambia el valor de una clave YAML de uno o dos niveles.
 * Estrategia: reemplazo línea a línea, preserva indentación y comentarios.
 * @param {string} yaml
 * @param {string} clave
 * @param {string} valor
 * @returns {string|null} yaml modificado, o null si clave no encontrada
 */
function yamlSet(yaml, clave, valor) {
  const partes = clave.split(".");
  if (partes.length === 1) {
    const re = new RegExp(`^(${partes[0]}:\\s*).*$`, "m");
    if (!re.test(yaml)) return null;
    return yaml.replace(re, `$1${valor}`);
  }
  const [seccion, sub] = partes;
  const lineas = yaml.split("\n");
  const inicioSeccion = lineas.findIndex((l) =>
    l.match(new RegExp(`^${seccion}:\\s*$`)) || l.match(new RegExp(`^${seccion}:\\s+`))
  );
  if (inicioSeccion === -1) return null;
  const subRe = new RegExp(`^(\\s+${sub}:\\s*)(.+)$`);
  for (let i = inicioSeccion + 1; i < lineas.length; i++) {
    const l = lineas[i];
    // Si llegamos a otra sección de nivel raíz, no encontramos la subclave
    if (l.length > 0 && !l.startsWith(" ") && !l.startsWith("\t") && !l.startsWith("#")) break;
    const m = subRe.exec(l);
    if (m) {
      lineas[i] = `${m[1]}${valor}`;
      return lineas.join("\n");
    }
  }
  return null; // subclave no encontrada en la sección
}

/**
 * Extrae y muestra una sección del YAML de forma legible.
 * Una sección va desde "nombre:" hasta la siguiente línea no indentada.
 */
function mostrarSeccion(yaml, seccion) {
  const lineas = yaml.split("\n");
  const inicio = lineas.findIndex((l) => l.match(new RegExp(`^${seccion}:\\s*`)));
  if (inicio === -1) {
    console.log(`(sección "${seccion}" no encontrada en sdd.config.yaml)`);
    return;
  }
  const bloque = [lineas[inicio]];
  for (let i = inicio + 1; i < lineas.length; i++) {
    const l = lineas[i];
    // Una nueva sección de nivel raíz empieza con un carácter no-espacio y no-#
    if (l.length > 0 && !l.startsWith(" ") && !l.startsWith("\t") && !l.startsWith("#")) break;
    bloque.push(l);
  }
  console.log(bloque.join("\n").trimEnd());
}

function cmdConfig(args) {
  const sub = args[0] ?? "show";
  const configPath = join(process.cwd(), ".sdd", "sdd.config.yaml");

  if (sub === "show") {
    const yaml = leerConfigYaml();
    const seccion = args[1];
    if (seccion) {
      titulo(`Sección: ${seccion}`);
      mostrarSeccion(yaml, seccion);
    } else {
      titulo("sdd.config.yaml completo:");
      console.log(yaml);
    }
    return;
  }

  if (sub === "get") {
    const clave = args[1];
    if (!clave) { error("Uso: npx sdd-es config get <clave>  (ej: sesion.modo)"); }
    const yaml = leerConfigYaml();
    const valor = yamlGet(yaml, clave);
    if (valor === null) {
      aviso(`Clave "${clave}" no encontrada en sdd.config.yaml`);
    } else {
      console.log(`${clave}: ${c.verde(valor)}`);
    }
    return;
  }

  if (sub === "set") {
    const clave = args[1];
    const valor = args[2];
    if (!clave || valor === undefined) {
      error("Uso: npx sdd-es config set <clave> <valor>  (ej: sesion.modo rapido)");
    }
    const yaml = leerConfigYaml();
    const actual = yamlGet(yaml, clave);
    if (actual === null) {
      aviso(`Clave "${clave}" no encontrada — verifica el nombre exacto con 'npx sdd-es config show'`);
      process.exit(1);
    }
    if (actual === valor) {
      info(`"${clave}" ya tiene el valor "${valor}" — sin cambios.`);
      return;
    }
    const yamlNuevo = yamlSet(yaml, clave, valor);
    if (!yamlNuevo) {
      error(`No se pudo actualizar "${clave}". Verifica que la clave existe en sdd.config.yaml`);
    }
    console.log(`${c.amarillo("~")}  ${clave}: ${c.rojo(actual)} → ${c.verde(valor)}`);
    writeFileSync(configPath, yamlNuevo, "utf8");
    info(`Actualizado en .sdd/sdd.config.yaml`);
    return;
  }

  if (sub === "validate") {
    const yaml = leerConfigYaml();
    titulo("Validando sdd.config.yaml...");
    let ok = true;
    const obligatorias = ["agentes:", "comportamiento:", "rutas:", "memoria:"];
    for (const clave of obligatorias) {
      if (yaml.includes(clave)) {
        info(`${clave} presente ✓`);
      } else {
        aviso(`Falta clave obligatoria: ${clave}`); ok = false;
      }
    }
    const umbral = yaml.match(/umbral_bytes:\s*(\d+)/);
    if (umbral && parseInt(umbral[1], 10) <= 0) {
      aviso("memoria.umbral_bytes debe ser > 0"); ok = false;
    }
    const modeloInvalido = yaml.match(/modelo:\s*((?!opus|sonnet|haiku)\S+)/);
    if (modeloInvalido) {
      aviso(`modelo desconocido: "${modeloInvalido[1]}" (válidos: opus, sonnet, haiku)`); ok = false;
    }
    console.log("");
    if (ok) info("sdd.config.yaml válido ✓");
    else aviso("Hay errores en sdd.config.yaml — revisa arriba");
    return;
  }

  // subcomando desconocido
  console.log(`
Uso: npx sdd-es config <subcomando>

  show [sección]         Muestra la config completa o solo una sección
                         Ej: npx sdd-es config show agentes
  get <clave>            Obtiene el valor de una clave
                         Ej: npx sdd-es config get sesion.modo
  set <clave> <valor>    Cambia el valor de una clave
                         Ej: npx sdd-es config set sesion.modo rapido
                         Ej: npx sdd-es config set memoria.umbral_bytes 40000
  validate               Valida la estructura del archivo
`);
}

async function cmdUi(args) {
  const portArg  = args.find(a => a.startsWith("--port"));
  const noOpen   = args.includes("--no-open");
  const port     = portArg
    ? parseInt(portArg.split("=")[1] ?? args[args.indexOf(portArg) + 1] ?? "3001", 10)
    : 3001;

  // Busca server.js: primero en .forge-ui/ (instalado con --ui), luego en el paquete
  const localUi  = join(process.cwd(), ".forge-ui", "server.js");
  const bundleUi = join(PLUGIN_DIR, "ui", "server.js");
  const serverJs = existsSync(localUi) ? localUi : existsSync(bundleUi) ? bundleUi : null;

  if (!serverJs) {
    console.log("");
    aviso("El dashboard no está instalado.");
    console.log("  Instálalo con:  npx forge init --ui");
    console.log("");
    process.exit(1);
  }

  console.log("");
  titulo(`Iniciando FORGE Dashboard en http://localhost:${port}`);
  console.log("  Presiona Ctrl+C para detener.");
  console.log("");

  // Importa y arranca el servidor
  const { startServer } = await import(serverJs);
  startServer(port);

  if (!noOpen) {
    const url = `http://localhost:${port}`;
    // Abrir navegador multiplataforma
    const { platform } = await import("node:os");
    const { spawn }    = await import("node:child_process");
    const cmds = { win32: ["cmd", ["/c", "start", url]], darwin: ["open", [url]], linux: ["xdg-open", [url]] };
    const [cmd, cmdArgs] = cmds[platform()] ?? cmds.linux;
    spawn(cmd, cmdArgs, { stdio: "ignore", detached: true }).unref();
  }
}

function cmdLogs(args) {
  // Parsear --last N (default 20)
  const lastIdx = args.findIndex(a => a === "--last" || a.startsWith("--last="));
  let last = 20;
  if (lastIdx !== -1) {
    const raw = args[lastIdx].includes("=")
      ? args[lastIdx].split("=")[1]
      : args[lastIdx + 1];
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n > 0) last = n;
  }

  const ledgerPath = join(process.cwd(), ".sdd", "observabilidad", "consumo.jsonl");

  console.log("");
  titulo("FORGE — Historial de consumo (.sdd/observabilidad/consumo.jsonl)");

  if (!existsSync(ledgerPath)) {
    aviso("El archivo consumo.jsonl no existe todavía.");
    aviso("Se crea automáticamente cuando los agentes FORGE ejecutan tareas.");
    console.log("");
    return;
  }

  // Parsear JSONL
  const lineas = readFileSync(ledgerPath, "utf8")
    .split("\n")
    .filter(l => l.trim().length > 0);

  const entradas = [];
  for (const linea of lineas) {
    try {
      entradas.push(JSON.parse(linea));
    } catch {
      // Ignora líneas malformadas
    }
  }

  if (entradas.length === 0) {
    aviso("El archivo consumo.jsonl existe pero no contiene entradas válidas.");
    console.log("");
    return;
  }

  // Tomar las últimas N
  const muestra = entradas.slice(-last);

  // Anchos de columna fijos
  const COL = { hora: 8, agente: 20, inp: 7, out: 7, est: 7, usd: 8, archivo: 24 };

  function pad(s, w) { return String(s ?? "").padEnd(w).slice(0, w); }
  function padL(s, w) { return String(s ?? "").padStart(w).slice(-w); }

  const sep = "─".repeat(
    2 + COL.hora + 1 + COL.agente + 1 + COL.inp + 1 + COL.out + 1 + COL.est + 1 + COL.usd + 1 + COL.archivo
  );

  console.log(sep);
  console.log(
    "  " +
    pad("Hora", COL.hora) + " " +
    pad("Agente", COL.agente) + " " +
    padL("In", COL.inp) + " " +
    padL("Out", COL.out) + " " +
    padL("Est", COL.est) + " " +
    padL("USD", COL.usd) + " " +
    pad("Archivo", COL.archivo)
  );
  console.log(sep);

  let totalIn = 0, totalOut = 0, totalEst = 0, totalUsd = 0;

  for (const e of muestra) {
    // Timestamp abreviado: HH:MM:SS
    let hora = "";
    if (e.timestamp) {
      try {
        const d = new Date(e.timestamp);
        hora = d.toTimeString().slice(0, 8);
      } catch { hora = String(e.timestamp).slice(0, 8); }
    }

    const agente   = e.agente ?? e.agent ?? "";
    const inp      = e.tokens_input  ?? e.input_tokens  ?? 0;
    const out      = e.tokens_output ?? e.output_tokens ?? 0;
    const est      = e.tokens_est    ?? e.estimated_tokens ?? 0;
    const usd      = e.costo_usd     ?? e.cost_usd ?? null;
    const archivo  = e.archivo ?? e.file ?? "";

    totalIn  += Number(inp)  || 0;
    totalOut += Number(out)  || 0;
    totalEst += Number(est)  || 0;
    totalUsd += Number(usd)  || 0;

    const usdStr = usd != null ? `$${Number(usd).toFixed(3)}` : "";

    console.log(
      "  " +
      pad(hora, COL.hora) + " " +
      pad(agente, COL.agente) + " " +
      padL(inp || "", COL.inp) + " " +
      padL(out || "", COL.out) + " " +
      padL(est || "", COL.est) + " " +
      padL(usdStr, COL.usd) + " " +
      pad(archivo, COL.archivo)
    );
  }

  console.log(sep);

  const totalUsdStr = totalUsd > 0 ? `$${totalUsd.toFixed(3)}` : "";
  const label = `Total (${muestra.length} entrada${muestra.length !== 1 ? "s" : ""})`;
  console.log(
    "  " +
    pad(label, COL.hora + 1 + COL.agente) + " " +
    padL(totalIn  || "", COL.inp) + " " +
    padL(totalOut || "", COL.out) + " " +
    padL(totalEst || "", COL.est) + " " +
    padL(totalUsdStr, COL.usd)
  );
  console.log(sep);

  if (entradas.length > last) {
    console.log(`  (mostrando últimas ${last} de ${entradas.length} entradas — usa --last N para ver más)`);
  }
  console.log("");
}

function uso() {
  console.log(`
FORGE — CLI (v${pluginVersion()})

Uso:
  npx forge init [--global] [--preset lean|startup|enterprise] [--ui]
                 [--template api-rest|cli-tool|saas-mvp]
                                     Instala FORGE (proyecto actual o global)
  npx forge update [--global]        Re-copia núcleo sin tocar tu .sdd/ ni settings
  npx forge doctor                   Diagnostica la instalación y providers disponibles
  npx forge ui [--port N] [--no-open]  Abre el dashboard en el navegador
  npx forge config show [sección]    Muestra sdd.config.yaml o una sección
  npx forge config get <clave>       Obtiene el valor de una clave
  npx forge config set <clave> <v>   Cambia un valor en sdd.config.yaml
  npx forge config validate          Valida la estructura del config
  npx forge logs [--last N]          Historial de consumo de tokens (default: 20 entradas)
  npx forge export [--format=speckit|openspec] [--out=dir]
                                     Exporta .sdd/ a formato portable (Spec Kit / OpenSpec)
  npx forge import --from=speckit --dir=<dir> [--merge]
  npx forge import --from=openspec --file=<file.json> [--merge]
                                     Importa artefactos portables de vuelta a .sdd/
  npx forge status                   Estado del pipeline + transiciones disponibles
  npx forge step <paso> [--force]    Avanzar el pipeline al paso indicado (sin LLM)
  npx forge state                    Volcar estado.json formateado
  npx forge validate                 Verificar precondiciones del paso actual
  npx forge reset --force            Resetear pipeline a 'idea'
  npx forge adr <raíz> "<glob>" [--update-ledger]
                                     Busca ADRs en el código y, con --update-ledger, los añade al registro
  npx forge probar-modelo [--tope USD] [--conservar]
                                     Prueba mínima del ciclo con un modelo real (necesita ANTHROPIC_API_KEY); gasta
                                     como máximo el tope (0,50 USD por defecto) y resume formato, iteraciones y coste
  npx forge api [--port N] [--cwd <ruta>]
                                     API HTTP local (127.0.0.1) con token: lanzar el ciclo verificado, ver su
                                     estado y decidir las revisiones. Escribe en una sola línea JSON la URL y el token
  npx forge mcp [--cwd <ruta>]       Servidor MCP por stdin/stdout con tres herramientas: ejecutar pruebas
                                     en el entorno aislado, leer y escribir archivos con las reglas del ciclo.
                                     Configúralo en tu cliente: {"mcpServers":{"forge":{"command":"npx","args":["forge","mcp"]}}}
  npx forge run [--tasks <json>] [--motor clasico|ciclo] [--force]
                                     Ejecuta las tareas. Con --motor ciclo, cada tarea de código
                                     se corrige hasta que sus pruebas pasan, en Docker y sin red
  npx forge resume [--decision continuar|aceptar|abortar]
                   [--iteraciones-extra N] [--presupuesto-extra USD]
                                     Retoma lo interrumpido. Si una tarea espera tu decisión,
                                     la muestra sin gastar nada hasta que indiques --decision
                                     Códigos de salida: 0 completado · 1 fallo ·
                                     3 revisión pendiente · 4 Docker no disponible
  npx forge --version                Muestra la versión

  (También disponible como: npx sdd-es init, npx sdd-es doctor, etc.)

Tras instalar, abre Claude Code y escribe:
  /forge "describe tu idea aquí"
`);
}

// ─── Entry point ────────────────────────────────────────────────────────────────

function cmdAprobar(subArgs) {
  const objetivo = subArgs[0];
  if (objetivo !== "spec") {
    aviso("Uso: forge aprobar spec");
    aviso("  Aprueba la spec activa para permitir avanzar a la fase de planificación.");
    return;
  }
  const estadoPath = join(process.cwd(), ".sdd", "estado.json");
  if (!existsSync(estadoPath)) {
    aviso("No existe .sdd/estado.json — ejecuta primero 'forge init' y luego /forge en Claude Code");
    return;
  }
  let estado;
  try { estado = JSON.parse(readFileSync(estadoPath, "utf8")); } catch {
    aviso("estado.json malformado — borra o regenera con /sdd.estado"); return;
  }
  if (!estado.spec_activa && !estado.spec_draft_path) {
    aviso("No hay spec activa ni draft para aprobar.");
    aviso("  Ejecuta primero /sdd.diseñar en Claude Code para generar la spec.");
    return;
  }
  if (estado.spec_aprobado) {
    info("La spec ya está aprobada ✓ — puedes avanzar a la planificación.");
    return;
  }
  const nuevo = { ...estado, spec_aprobado: true, ultima_actualizacion: new Date().toISOString() };
  writeFileSync(estadoPath, JSON.stringify(nuevo, null, 2), "utf8");
  info("✅ Spec aprobada. Ahora puedes avanzar a la fase de planificación.");
  info("   Siguiente paso: /sdd.planificar en Claude Code");
}

async function main() {
  const args    = process.argv.slice(2);
  const comando = args[0];
  const global  = args.includes("--global") || args.includes("-g");
  const guided  = args.includes("--guided");
  const withUi  = args.includes("--ui");
  const presetIdx = args.findIndex(a => a === "--preset" || a.startsWith("--preset="));
  const preset  = presetIdx !== -1
    ? (args[presetIdx].includes("=") ? args[presetIdx].split("=")[1] : args[presetIdx + 1])
    : null;
  const templateIdx = args.findIndex(a => a === "--template" || a.startsWith("--template="));
  const template = templateIdx !== -1
    ? (args[templateIdx].includes("=") ? args[templateIdx].split("=")[1] : args[templateIdx + 1])
    : null;

  switch (comando) {
    case "init":
      cmdInit(global, guided, withUi, preset, template);
      break;
    case "update":
      cmdUpdate(global);
      break;
    case "doctor":
      await cmdDoctor();
      break;
    case "config":
      cmdConfig(args.slice(1));
      break;
    case "ui":
      cmdUi(args.slice(1)).catch(e => error(e.message));
      break;
    case "logs":
      cmdLogs(args.slice(1));
      break;
    case "export":
      import("./export.js").then(({ cmdExport }) => cmdExport(args.slice(1))).catch(e => error(e.message));
      break;
    case "import":
      import("./import.js").then(({ cmdImport }) => cmdImport(args.slice(1))).catch(e => error(e.message));
      break;
    case "status":
    case "step":
    case "state":
    case "validate":
    case "reset":
      import("./runner.js").then(({ runForgeCommand }) => runForgeCommand(comando, args.slice(1))).catch(e => error(e.message));
      break;
    case "dispatch":
      import("./dispatch.js").then(({ cmdDispatch }) => cmdDispatch(args.slice(1))).catch(e => error(e.message));
      break;
    case "adapters":
      import("./dispatch.js").then(({ cmdAdapters }) => cmdAdapters()).catch(e => error(e.message));
      break;
    case "decisions":
      import("./decisions.js").then(({ cmdDecisions }) => cmdDecisions(args.slice(1))).catch(e => error(e.message));
      break;
    case "aprobar":
      cmdAprobar(args.slice(1));
      break;
    case "api": {
      // API HTTP local con token (spec 2026-10-03-api-http). Por stdout sale una sola línea JSON con la URL y el token.
      const valor = (flag) => { const i = args.indexOf(flag); return i !== -1 && args[i + 1] ? args[i + 1] : undefined; };
      const { crearServidorApi } = await import("../core/api/servidor.js");
      const api = crearServidorApi({ cwd: valor("--cwd") ?? process.cwd(), token: process.env.FORGE_API_TOKEN || undefined });
      const { url } = await api.escuchar(valor("--port") === undefined ? 3002 : Number(valor("--port")));
      console.log(JSON.stringify({ url, token: api.token }));
      process.stderr.write(`FORGE API en ${url}. Envía el token en la cabecera "Authorization: Bearer ...". Ctrl+C para parar.\n`);
      await new Promise((resolver) => { process.on("SIGINT", resolver); process.on("SIGTERM", resolver); });
      await api.cerrar();
      break;
    }
    case "probar-modelo": {
      // Prueba mínima del ciclo con un modelo real y un tope de gasto bajo (ver core/probar-modelo.js)
      const valor = (flag) => { const i = args.indexOf(flag); return i !== -1 && args[i + 1] ? args[i + 1] : undefined; };
      const { probarModelo, textoDelInforme } = await import("../core/probar-modelo.js");
      const informe = await probarModelo({
        tope: valor("--tope") === undefined ? undefined : Number(valor("--tope")),
        conservar: args.includes("--conservar"),
      });
      console.log(textoDelInforme(informe));
      process.exit(informe.ok ? 0 : informe.motivoNoEjecutada ? 2 : 1);
      break;
    }
    case "mcp": {
      // Servidor MCP por stdin/stdout: nada más que mensajes del protocolo debe salir por stdout
      const i = args.indexOf("--cwd");
      const { iniciarServidor } = await import("../core/mcp/servidor.js");
      await iniciarServidor({ cwd: i !== -1 && args[i + 1] ? args[i + 1] : undefined });
      break;
    }
    case "adr": {
      // forge adr <raíz> <glob> [--update-ledger]: busca ADRs en el código. Los comandos y skills del plugin
      // llaman a esto en lugar de a una ruta relativa que no existe en el proyecto del usuario.
      const { spawnSync } = await import("node:child_process");
      const script = fileURLToPath(new URL("../utils/adr-parser.js", import.meta.url));
      const r = spawnSync(process.execPath, [script, ...args.slice(1)], { stdio: "inherit" });
      process.exit(r.status ?? 1);
      break;
    }
    case "run":
    case "resume": {
      if (args.includes("--help") || args.includes("-h")) { uso(); break; }
      const { main: engineMain } = await import("../core/engine-cli.js");
      process.argv = [process.argv[0], process.argv[1], comando, ...args.slice(1)];
      await engineMain();
      break;
    }
    case "--version":
    case "-v":
      console.log(pluginVersion());
      break;
    case "--help":
    case "-h":
    case "help":
    case undefined:
      uso();
      break;
    default:
      error(`Comando desconocido: '${comando}'. Usa 'forge --help'.`);
  }
}

main();
