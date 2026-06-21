#!/usr/bin/env node
// @ts-check
/**
 * SDD-ES — CLI de instalación multiplataforma (Windows / macOS / Linux).
 *
 * Reemplaza a instalar.sh (bash-only) con Node puro, cero dependencias.
 * Comparte la misma lógica de copia idempotente.
 *
 * Uso:
 *   npx sdd-es init            instala en el proyecto actual (.claude/ + .sdd/)
 *   npx sdd-es init --global   instala en $HOME/.claude (todos los proyectos)
 *   npx sdd-es update          re-copia commands/agents/skills/hooks sin tocar .sdd/ ni settings
 *   npx sdd-es doctor          diagnostica la instalación
 *   npx sdd-es --version       muestra la versión
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
  console.log("  ║          SDD-ES — Instalación del Plugin v2.0        ║");
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
    cpSync(src, dest);
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

function configurarSdd(claudeDir) {
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
  console.log("  ╔══════════════════════════════════════════════════════╗");
  console.log("  ║              ✅ Instalación completada               ║");
  console.log("  ╠══════════════════════════════════════════════════════╣");
  console.log("  ║   PRÓXIMO PASO:                                      ║");
  console.log("  ║      Abre Claude Code y ejecuta:  /sdd.constitucion  ║");
  console.log("  ║   Para ver todos los comandos:    /sdd.ayuda         ║");
  console.log("  ╚══════════════════════════════════════════════════════╝");
  console.log("");
}

// ─── Comandos ───────────────────────────────────────────────────────────────────

function cmdInit(global) {
  banner();
  const claudeDir = global
    ? join(homedir(), ".claude")
    : join(process.cwd(), ".claude");
  console.log(`  Modo: ${global ? "GLOBAL" : "PROYECTO"} (${claudeDir})`);
  console.log("");

  if (!claudeEnPath()) {
    aviso("Claude Code CLI no detectado en PATH. Los archivos se instalarán de todos modos.");
  }

  copiarNucleo(claudeDir);
  copiarSettings(claudeDir);

  if (!global) {
    configurarSdd(claudeDir);
  }

  pasosFinales();
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

  console.log("");
  if (problemas === 0) {
    info("Diagnóstico OK — sin problemas críticos.");
  } else {
    aviso(`${problemas} problema(s) detectado(s). Revisa arriba.`);
  }
  console.log("");
}

function uso() {
  console.log(`
SDD-ES — CLI (v${pluginVersion()})

Uso:
  npx sdd-es init [--global]   Instala el plugin (proyecto o global)
  npx sdd-es update [--global] Re-copia núcleo sin tocar tu .sdd/ ni settings
  npx sdd-es doctor            Diagnostica la instalación
  npx sdd-es --version         Muestra la versión

Tras instalar, abre Claude Code y ejecuta /sdd.constitucion
`);
}

// ─── Entry point ────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const comando = args[0];
  const global = args.includes("--global") || args.includes("-g");

  switch (comando) {
    case "init":
      cmdInit(global);
      break;
    case "update":
      cmdUpdate(global);
      break;
    case "doctor":
      cmdDoctor();
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
      error(`Comando desconocido: '${comando}'. Usa 'npx sdd-es --help'.`);
  }
}

main();
