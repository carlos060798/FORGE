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
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { execSync } from "node:child_process";
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

// ─── Utilidades de copia ────────────────────────────────────────────────────────

/** Copia todos los .md de un directorio origen a uno destino. Devuelve cuántos. */
function copyMd(srcDir, destDir) {
  mkdirSync(destDir, { recursive: true });
  const archivos = readdirSync(srcDir).filter((f) => f.endsWith(".md"));
  for (const f of archivos) {
    cpSync(join(srcDir, f), join(destDir, f));
  }
  return archivos.length;
}

/** Copia un directorio completo (recursivo). */
function copyDir(srcDir, destDir) {
  mkdirSync(destDir, { recursive: true });
  cpSync(srcDir, destDir, { recursive: true });
}

/** Lee la versión declarada en package.json del plugin. */
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
  mkdirSync(skillsDest, { recursive: true });
  let nSk = 0;
  for (const entry of readdirSync(skillsSrc, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".md")) {
      cpSync(join(skillsSrc, entry.name), join(skillsDest, entry.name));
      nSk++;
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
  mkdirSync(hooksDest, { recursive: true });
  for (const f of readdirSync(hooksSrc).filter((f) => f.endsWith(".js"))) {
    cpSync(join(hooksSrc, f), join(hooksDest, f));
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
    writeFileSync(dest, settings, "utf8");
    info(`Settings de seguridad instalados (${dest})`);
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
    mkdirSync(join(process.cwd(), ".sdd", d), { recursive: true });
  }

  // Plantillas
  copyMd(join(PLUGIN_DIR, "plantillas"), join(process.cwd(), ".sdd", "plantillas"));
  info("Plantillas copiadas a .sdd/plantillas/");

  // Config (no sobreescribe)
  const configDest = join(process.cwd(), ".sdd", "sdd.config.yaml");
  if (!existsSync(configDest)) {
    cpSync(
      join(PLUGIN_DIR, "configuracion-ejemplo", "sdd.config.yaml"),
      configDest
    );
    info("Configuración por defecto copiada (.sdd/sdd.config.yaml)");
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
    writeFileSync(configDest, yaml, "utf8");
    info("Configuración personalizada aplicada (wizard --guided)");
  }

  // .claudeignore (no sobreescribe — respeta personalizaciones del usuario)
  const claudeignoreDest = join(process.cwd(), ".claudeignore");
  if (!existsSync(claudeignoreDest)) {
    cpSync(
      join(PLUGIN_DIR, "configuracion-ejemplo", ".claudeignore"),
      claudeignoreDest
    );
    info(".claudeignore creado — excluye node_modules, dist, observabilidad FORGE del contexto");
  } else {
    aviso(".claudeignore ya existe — no se sobreescribe");
  }

  // README de hooks (no sobreescribe)
  const hooksReadme = join(process.cwd(), ".sdd", "hooks", "README.md");
  if (!existsSync(hooksReadme)) {
    writeFileSync(hooksReadme, HOOKS_README);
    info("README de hooks creado (.sdd/hooks/README.md)");
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

const CLAUDE_MD_VERSION = "5.0.0";
const CLAUDE_MD_VERSION_TAG = `<!-- forge-version: ${CLAUDE_MD_VERSION} -->`;

function integrarClaudeMd(cwd) {
  const claudeMdPath = join(cwd, "CLAUDE.md");
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
      writeFileSync(claudeMdPath, nuevo, "utf8");
      info(`Sección FORGE en CLAUDE.md actualizada a v${CLAUDE_MD_VERSION}`);
      return;
    }
    // Añadir sección al final del archivo existente
    const nuevo = contenido.trimEnd() + "\n\n" + seccionCompleta;
    writeFileSync(claudeMdPath, nuevo, "utf8");
    info("Sección FORGE añadida a CLAUDE.md existente");
  } else {
    const contenido = `# Instrucciones del proyecto\n` + seccionCompleta;
    writeFileSync(claudeMdPath, contenido, "utf8");
    info("CLAUDE.md creado con sección FORGE");
  }
}

function cmdInit(global, guided = false, withUi = false, preset = null, template = null) {
  banner();
  const claudeDir = global
    ? join(homedir(), ".claude")
    : join(process.cwd(), ".claude");
  console.log(`  Modo: ${global ? "GLOBAL" : "PROYECTO"} (${claudeDir})`);
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
  mkdirSync(sddDir, { recursive: true });

  // Copiar ir.json
  const irSrc = join(templateSrc, "ir.json");
  if (existsSync(irSrc)) {
    const ir = JSON.parse(readFileSync(irSrc, "utf8"));
    ir.created_at = new Date().toISOString();
    ir.id = `ir-${template}-${Date.now()}`;
    writeFileSync(join(sddDir, "ir.json"), JSON.stringify(ir, null, 2), "utf8");
    info(`IR pre-generado desde template ${template}`);
  }

  // Copiar spec.md a .sdd/especificaciones/
  const specSrc = join(templateSrc, "spec.md");
  if (existsSync(specSrc)) {
    const specId = `template-${template}`;
    const specDir = join(sddDir, "especificaciones", specId);
    mkdirSync(specDir, { recursive: true });
    const specContent = readFileSync(specSrc, "utf8")
      .replace(/creada: TEMPLATE/g, `creada: ${new Date().toISOString().slice(0, 10)}`)
      .replace(/actualizada: TEMPLATE/g, `actualizada: ${new Date().toISOString().slice(0, 10)}`);
    writeFileSync(join(specDir, "spec.md"), specContent, "utf8");
    info(`Spec pre-generada desde template ${template}`);
  }

  // Copiar sdd.config.yaml (sobreescribe el default del init)
  const configSrc = join(templateSrc, "sdd.config.yaml");
  const configDest = join(sddDir, "sdd.config.yaml");
  if (existsSync(configSrc)) {
    cpSync(configSrc, configDest);
    info(`Configuración del template ${template} aplicada`);
  }

  // Inicializar estado.json con schemaVersion
  const estadoDest = join(sddDir, "estado.json");
  if (!existsSync(estadoDest)) {
    writeFileSync(estadoDest, JSON.stringify({
      schemaVersion: "1.0",
      ir_generado: true,
      ir_path: ".sdd/ir.json",
      pipeline_step: "ir",
      ultima_actualizacion: new Date().toISOString(),
    }, null, 2), "utf8");
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
  writeFileSync(configDest, presetContent + (extraContent ? "\n" + extraContent : ""), "utf8");
  info(`Preset "${preset}" aplicado → .sdd/sdd.config.yaml`);
}

function instalarUi() {
  titulo("Instalando dashboard UI...");
  const uiSrc  = join(PLUGIN_DIR, "ui");
  const uiDest = join(process.cwd(), ".forge-ui");
  try {
    cpSync(uiSrc, uiDest, { recursive: true });
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

function cmdDoctor() {
  banner();
  console.log("  Diagnóstico de SDD-ES");
  console.log("");

  let problemas = 0;

  // Node
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  if (nodeMajor >= 18) {
    info(`Node ${process.versions.node} (>=18 requerido) ✓`);
  } else {
    aviso(`Node ${process.versions.node} es < 18. Actualiza Node.`);
    problemas++;
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
  npx forge --version                Muestra la versión

  (También disponible como: npx sdd-es init, npx sdd-es doctor, etc.)

Tras instalar, abre Claude Code y escribe:
  /forge "describe tu idea aquí"
`);
}

// ─── Entry point ────────────────────────────────────────────────────────────────

function main() {
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
      cmdDoctor();
      break;
    case "config":
      cmdConfig(args.slice(1));
      break;
    case "ui":
      cmdUi(args.slice(1)).catch(e => error(e.message));
      break;
    case "--version":
    case "-v":
      console.log(pluginVersion());
      break;
    case "--help":
    case "-h":
    case undefined:
      uso();
      break;
    default:
      error(`Comando desconocido: '${comando}'. Usa 'forge --help'.`);
  }
}

main();
