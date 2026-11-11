// @ts-check
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { join, dirname, relative, resolve } from "node:path";
import { homedir } from "node:os";
import { generarAgentsMd } from "../../core/agents-md.js";
import { PRODUCTO } from "../../core/nombres.js";
import { detectStack } from "../../core/stack-detector.js";
import { copiarArbol, crearArchivo, ErrorEnlace, escribirArchivo } from "../../core/escritura-segura.js";
import { INTEGRACION_POR_DEFECTO, resolverIntegracion, validarCarpetaSkills } from "../../core/instalacion/herramientas-destino.js";
import { PERFIL_POR_DEFECTO, incluyeComando, resolverPerfil } from "../../core/instalacion/perfiles.js";
import { nombreDeSkill } from "../../core/instalacion/skills-de-comandos.js";
import { PREFIJO_INVOCACION, adaptarSkill, agenteARol } from "../../core/instalacion/adaptar-anfitrion.js";
import { PLANTILLAS_HOOKS, ordenDeGuardian } from "../../core/instalacion/hooks-anfitrion.js";
import { PLUGIN_DIR, c, info, aviso, titulo, error, raices, PROYECTO, sinEscribir, CARPETAS_GLOBALES_ENLAZABLES, fijarRaices, raizPara, protegido, paso, cerrarSiFalto, crearDir, crearNuevo, escribirSeguro, leerSeguro, copyMd, copyDir, copiarSeguro, pluginVersion, claudeEnPath } from "./comun.js";
import { yamlGet } from "./config.js";

// ─── Banner ─────────────────────────────────────────────────────────────────────

export function banner() {
  console.log("");
  console.log("  ╔══════════════════════════════════════════════════════╗");
  console.log("  ║                                                      ║");
  const rotulo = `${PRODUCTO} — Tu equipo técnico en Claude Code`;
  console.log(`  ║${rotulo.padStart(Math.floor((54 + rotulo.length) / 2)).padEnd(54)}║`);
  console.log("  ║                                                      ║");
  console.log("  ╚══════════════════════════════════════════════════════╝");
  console.log("");
}

// ─── Copia núcleo (commands/agents/skills/hooks) ────────────────────────────────

/**
 * Copia los artefactos del plugin a CLAUDE_DIR.
 * @param {string} claudeDir destino (.claude del proyecto o global)
 */
/**
 * Perfil que ya tiene una instalación existente, deducido de los comandos presentes: si hay alguno fuera del perfil
 * esencial, es una instalación completa. Devuelve null si no hay nada que deducir (carpeta ausente, vacía o solo con
 * comandos del perfil esencial). Lo usa `update` cuando ni la línea de comandos ni la configuración fijan un perfil,
 * para no dejar desactualizados comandos que la persona ya tenía (revisión independiente 2026-11-10, hallazgo 1).
 * @param {string} dirComandos
 * @returns {"completo"|null}
 */
function perfilYaInstalado(dirComandos) {
  try {
    const nombres = readdirSync(dirComandos).filter((n) => n.endsWith(".md")).map((n) => n.slice(0, -3));
    return nombres.some((n) => !incluyeComando("esencial", n)) ? "completo" : null;
  } catch { return null; }
}

function copiarNucleo(claudeDir, inst = null, { actualizar = false } = {}) {
  // Otra herramienta: skills y AGENTS.md, sin comandos, agentes ni hooks con cabecera de Claude Code
  if (inst && !inst.integracion.nativa) return copiarSkillsDeIntegracion(inst);
  titulo("Copiando comandos...");
  // Sin opciones ni configuración guardada manda el perfil por defecto (esencial, ADR-24); `completo` copia todo
  let perfilEfectivo = inst ? inst.perfil : PERFIL_POR_DEFECTO;
  if (actualizar && !(inst && inst.perfilFijado)) {
    const previo = perfilYaInstalado(join(claudeDir, "commands"));
    if (previo) {
      perfilEfectivo = previo;
      info("Esta instalación ya tiene comandos fuera del perfil esencial: se actualizan todos (perfil completo). Para limitarla al esencial: forge update --perfil esencial");
    }
  }
  const soloPerfil = perfilEfectivo !== "completo" ? perfilEfectivo : null;
  const nCmd = copyMd(join(PLUGIN_DIR, "commands"), join(claudeDir, "commands"), soloPerfil ? (f) => incluyeComando(soloPerfil, f.slice(0, -3)) : null);
  info(`Comandos instalados (${nCmd} archivos, perfil ${perfilEfectivo})`);

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
  // shared/protegidos.js reexporta core/, que no existe en el proyecto: se sustituye por la fuente (sin dependencias)
  copiarSeguro(join(PLUGIN_DIR, "core", "evidencia", "protegidos.js"), join(hooksDest, "shared", "protegidos.js"));
  copiarSeguro(join(PLUGIN_DIR, "core", "evidencia", "guardian-reglas.js"), join(hooksDest, "shared", "guardian-reglas.js"));
  info(`Hooks instalados (${hooksDest})`);
}

// ─── Integración por herramienta y perfil (spec 2026-10-13-instalacion-agnostica) ────

/** Opciones de la línea de comandos: `--integracion`, `--perfil`, `--carpeta-skills` (las fija `main`). */
export const OPCIONES_INSTALACION = { integracion: /** @type {string|null} */ (null), perfil: /** @type {string|null} */ (null), carpetaSkills: /** @type {string|null} */ (null), conHooks: false };

/** Lo que dejó la instalación en esta ejecución, para el resumen final. */
export const instalado = { skills: 0, generadas: 0, roles: 0, hooks: "", omitidas: /** @type {string[]} */ ([]), destino: "" };

/** Integración, perfil y carpeta guardados en `.sdd/sdd.config.yaml` (sección `instalacion`). */
export function leerInstalacionGuardada() {
  const ruta = join(PROYECTO, ".sdd", "sdd.config.yaml");
  if (!existsSync(ruta)) return {};
  const yaml = leerSeguro(ruta);
  if (yaml === null) return {};
  return {
    integracion: yamlGet(yaml, "instalacion.integracion") ?? undefined,
    perfil: yamlGet(yaml, "instalacion.perfil") ?? undefined,
    carpeta: yamlGet(yaml, "instalacion.carpeta_skills") ?? undefined,
  };
}

/**
 * Resuelve integración y perfil: opción de la línea de comandos > configuración guardada > por defecto.
 * Devuelve null si no hay ni opciones ni configuración: ese es el camino de siempre, sin cambios.
 * Una clave, perfil o carpeta inválidos paran la ejecución ANTES de escribir nada.
 * @param {boolean} global
 */
function resolverInstalacion(global) {
  const { integracion: oi, perfil: op, carpetaSkills: oc } = OPCIONES_INSTALACION;
  const guardada = global ? {} : leerInstalacionGuardada();
  const clave = oi ?? guardada.integracion ?? null;
  const nombrePerfil = op ?? guardada.perfil ?? null;
  if (clave === null && nombrePerfil === null && oc === null) return null;

  const ri = resolverIntegracion(clave ?? INTEGRACION_POR_DEFECTO);
  if (!ri.ok) error(ri.error);
  const rp = resolverPerfil(nombrePerfil ?? PERFIL_POR_DEFECTO);
  if (!rp.ok) error(rp.error);
  const integracion = /** @type {any} */ (ri).integracion;
  const perfil = /** @type {any} */ (rp).perfil;
  if (global && !integracion.nativa) error(`--global solo admite la integración claude (pediste ${integracion.clave}).`);
  if (oc !== null && integracion.clave !== "generica") error("--carpeta-skills solo se usa con --integracion generica.");

  /** @type {string|null} */ let carpeta = null;
  if (integracion.clave === "generica") {
    // La carpeta guardada en el proyecto (no confiable) solo vale dentro del proyecto; la de la línea
    // de comandos puede estar también bajo la carpeta personal
    const v = validarCarpetaSkills(oc ?? guardada.carpeta, { proyecto: PROYECTO, personal: homedir(), soloProyecto: oc === null });
    if (!v.ok) error(v.error);
    carpeta = /** @type {any} */ (v).ruta;
    // Una carpeta bajo la personal, fuera del proyecto, necesita su propia raíz de escritura
    if (relative(PROYECTO, /** @type {string} */ (carpeta)).startsWith("..")) {
      // Solo llega aquí desde --carpeta-skills (la guardada en el proyecto ya se rechazó arriba). La raíz de
      // escritura es la propia carpeta y debe existir para fijarse como raíz.
      mkdirSync(/** @type {string} */ (carpeta), { recursive: true });
      raices?.push({ raiz: /** @type {any} */ (v).raiz });
    }
  }
  // «previa» desactiva la protección de archivos ajenos solo para el árbol del propio proyecto: un destino
  // fuera de él se protege siempre, aunque la configuración diga que ya hubo una instalación
  const fueraDelProyecto = carpeta !== null && relative(PROYECTO, /** @type {string} */ (carpeta)).startsWith("..");
  const previa = Boolean(guardada.integracion || guardada.perfil) && !fueraDelProyecto;
  // `perfilFijado`: la línea de comandos o la configuración guardada dijeron el perfil (si no, es el de por defecto y `update` mira lo ya instalado)
  return { integracion, perfil, carpeta, previa, explicita: oi !== null || op !== null || oc !== null, perfilFijado: nombrePerfil !== null };
}

/** Carpeta donde van las skills de una integración que no es Claude Code. */
function destinoSkills(inst) {
  return inst.carpeta ?? join(PROYECTO, ...inst.integracion.carpetaSkills.split("/"));
}

/** Copia una carpeta de skill archivo a archivo. Un archivo ajeno distinto no se pisa sin avisar. */
function copiarCarpetaSkill(src, dest, proteger, transformar = null) {
  for (const e of readdirSync(src, { withFileTypes: true })) {
    const o = join(src, e.name), d = join(dest, e.name);
    if (e.isDirectory()) { copiarCarpetaSkill(o, d, proteger, transformar); continue; }
    // `transformar` adapta el SKILL.md a la herramienta de destino (adaptar-anfitrion.js)
    const texto = transformar && e.name === "SKILL.md" ? transformar(readFileSync(o, "utf8")) : null;
    if (proteger) {
      let existe = false;
      try { lstatSync(d); existe = true; } catch { /* no existe */ }
      if (existe) {
        let igual = false;
        try { igual = texto === null ? readFileSync(d).equals(readFileSync(o)) : readFileSync(d, "utf8") === texto; } catch { /* ilegible: no se pisa */ }
        if (!igual) { aviso(`Ya existe y no es de FORGE, no se pisa: ${d}`); instalado.omitidas.push(d); continue; }
      }
    }
    if (crearDir(dirname(d)) === undefined) continue;
    if (texto === null) copiarSeguro(o, d); else escribirSeguro(d, texto);
  }
}

/** Skills propias (carpetas de `skills/`) y las generadas de los comandos del perfil, en la carpeta de la herramienta. */
function copiarSkillsDeIntegracion(inst) {
  const destino = destinoSkills(inst);
  instalado.destino = destino;
  titulo(`Copiando skills para ${inst.integracion.nombre}...`);
  if (crearDir(destino) === undefined) return;
  const proteger = !inst.previa;
  const comandos = readdirSync(join(PLUGIN_DIR, "commands")).filter((x) => x.endsWith(".md")).map((x) => x.slice(0, -3));
  const opciones = { prefijo: PREFIJO_INVOCACION[inst.integracion.clave] ?? "", comandos };
  const adaptar = (md) => adaptarSkill(md, opciones);
  const propias = join(PLUGIN_DIR, "skills");
  for (const e of readdirSync(propias, { withFileTypes: true })) {
    if (!e.isDirectory() || !existsSync(join(propias, e.name, "SKILL.md"))) continue;
    copiarCarpetaSkill(join(propias, e.name), join(destino, e.name), proteger, adaptar);
    instalado.skills++;
  }
  const generadas = join(PLUGIN_DIR, "skills-generadas");
  for (const f of readdirSync(join(PLUGIN_DIR, "commands")).filter((x) => x.endsWith(".md"))) {
    const comando = f.slice(0, -3);
    if (!incluyeComando(inst.perfil, comando)) continue;
    const nombre = nombreDeSkill(comando);
    if (!existsSync(join(generadas, nombre, "SKILL.md"))) {
      aviso(`Falta la skill generada de ${comando}: ejecuta 'node scripts/generar-skills.mjs'`);
      sinEscribir.push(join(generadas, nombre));
      continue;
    }
    copiarCarpetaSkill(join(generadas, nombre), join(destino, nombre), proteger, adaptar);
    instalado.generadas++;
  }
  // Agentes como roles: una skill `rol-<agente>` por agente (la herramienta no tiene los subagentes de Claude Code)
  const agentes = join(PLUGIN_DIR, "agents");
  for (const f of readdirSync(agentes).filter((x) => x.endsWith(".md")).sort()) {
    const rol = agenteARol(f.slice(0, -3), readFileSync(join(agentes, f), "utf8"), opciones);
    if (rol.errores.length) { aviso(`Rol omitido (${f}): ${rol.errores.join("; ")}`); continue; }
    const d = join(destino, rol.nombre, "SKILL.md");
    if (proteger && existsSync(d)) {
      let igual = false;
      try { igual = readFileSync(d, "utf8") === rol.skillMd; } catch { /* ilegible: no se pisa */ }
      if (!igual) { aviso(`Ya existe y no es de FORGE, no se pisa: ${d}`); instalado.omitidas.push(d); continue; }
    }
    if (crearDir(dirname(d)) === undefined) continue;
    escribirSeguro(d, rol.skillMd);
    instalado.roles++;
  }
  info(`Skills instaladas en ${destino}: ${instalado.skills} propias + ${instalado.generadas} de comandos + ${instalado.roles} roles`);
  if (OPCIONES_INSTALACION.conHooks) instalarHookDeGuardian(inst);
}

/** Registra `fragua guardian evaluar` en el hook «antes de usar una herramienta» de la herramienta, si tiene adaptador. Nunca pisa un archivo existente. */
function instalarHookDeGuardian(inst) {
  const clave = inst.integracion.clave;
  const plantilla = PLANTILLAS_HOOKS[clave];
  if (!plantilla) { aviso(`--con-hooks: ${inst.integracion.nombre} no tiene adaptador de hook; el guardián no queda registrado (ver docs/ANFITRIONES.md).`); return; }
  const orden = ordenDeGuardian(clave);
  const contenido = plantilla.contenido(orden);
  const destino = join(PROYECTO, ...plantilla.ruta.split("/"));
  if (existsSync(destino)) {
    aviso(`--con-hooks: ya existe ${plantilla.ruta} y no se modifica. Añade tú esta orden al hook de ${plantilla.nombre} antes de usar una herramienta: ${orden}`);
    return;
  }
  if (crearDir(dirname(destino)) === undefined) return;
  if (crearNuevo(destino, contenido)) {
    instalado.hooks = plantilla.ruta;
    info(`Guardián registrado en ${plantilla.ruta} (${plantilla.nombre}). ${plantilla.nota}`);
    aviso("Requiere que la orden `fragua` esté instalada y en el PATH. Sin probar en una instalación real de la herramienta.");
  }
}

/** Guarda integración y perfil en `.sdd/sdd.config.yaml` (sección `instalacion`). */
function guardarInstalacion(inst) {
  const ruta = join(PROYECTO, ".sdd", "sdd.config.yaml");
  if (!existsSync(ruta)) return;
  const yaml = leerSeguro(ruta);
  if (yaml === null) return;
  const carpeta = inst.carpeta ? (relative(PROYECTO, inst.carpeta).startsWith("..") ? inst.carpeta : relative(PROYECTO, inst.carpeta).replaceAll("\\", "/")) : null;
  const bloque = [
    "instalacion:",
    `  integracion: "${inst.integracion.clave}"`,
    `  perfil: "${inst.perfil}"`,
    ...(carpeta ? [`  carpeta_skills: ${JSON.stringify(carpeta)}`] : []),
    "",
  ].join("\n");
  const sin = yaml.replace(/^instalacion:[^\n]*\n(?:[ \t]+[^\n]*\n?)*/m, "");
  escribirSeguro(ruta, sin.replace(/\n*$/, "\n\n") + bloque);
}

/** Qué se instaló, qué no y cómo invocar la primera skill. */
function resumenInstalacion(inst) {
  const i = inst.integracion;
  console.log("");
  titulo(`FORGE para ${i.nombre} — perfil ${inst.perfil}`);
  if (i.nativa) {
    const lista = inst.perfil === "completo" ? "todos los comandos" : "los comandos del perfil esencial";
    info(`Instalado: ${lista}, agentes, skills, hooks, settings.json y CLAUDE.md en .claude/`);
    info("No instalado: nada omitido.");
  } else {
    info(`Instalado: ${instalado.skills} skills propias, ${instalado.generadas} skills de comandos y ${instalado.roles} roles (los agentes, como skills rol-*) en ${instalado.destino || destinoSkills(inst)}; AGENTS.md.`);
    info("No instalado: hooks (guardián, memoria de agentes), settings.json ni CLAUDE.md, que son de Claude Code. Sin el guardián, las reglas de AGENTS.md se piden, no se imponen.");
    info("Delegación entre agentes: sin subagentes, un rol se carga y se ejecuta en la misma conversación; lo paralelo pasa a secuencial.");
    if (instalado.omitidas.length) aviso(`${instalado.omitidas.length} archivo(s) ya existían y no se pisaron.`);
  }
  info(`Cómo invocar: ${i.invocacion}. Ejemplo: ${i.ejemplo}`);
  console.log("");
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
    crearDir(join(PROYECTO, ".sdd", d));
  }

  // Plantillas
  copyMd(join(PLUGIN_DIR, "plantillas"), join(PROYECTO, ".sdd", "plantillas"));
  info("Plantillas copiadas a .sdd/plantillas/");

  // Config (no sobreescribe)
  const configDest = join(PROYECTO, ".sdd", "sdd.config.yaml");
  if (!existsSync(configDest)) {
    if (crearNuevo(configDest, readFileSync(join(PLUGIN_DIR, "configuracion-ejemplo", "sdd.config.yaml")))) {
      info("Configuración por defecto copiada (.sdd/sdd.config.yaml)");
    }
  } else {
    aviso("Configuración ya existe — no se sobreescribe");
  }

  // Aplicar overrides del wizard --guided
  const yamlActual = Object.keys(overrides).length > 0 ? leerSeguro(configDest) : null;
  if (yamlActual !== null) {
    let yaml = yamlActual;
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
  const claudeignoreDest = join(PROYECTO, ".claudeignore");
  if (!existsSync(claudeignoreDest)) {
    if (copiarSeguro(join(PLUGIN_DIR, "configuracion-ejemplo", ".claudeignore"), claudeignoreDest)) info(".claudeignore creado — excluye node_modules, dist, observabilidad FORGE del contexto");
  } else {
    aviso(".claudeignore ya existe — no se sobreescribe");
  }

  // README de hooks (no sobreescribe)
  const hooksReadme = join(PROYECTO, ".sdd", "hooks", "README.md");
  if (!existsSync(hooksReadme)) {
    if (crearNuevo(hooksReadme, HOOKS_README)) info("README de hooks creado (.sdd/hooks/README.md)");
  }

  // Documentación local (opcional)
  const docsDest = join(PROYECTO, ".sdd", "docs");
  if (!existsSync(docsDest)) {
    copyMd(join(PLUGIN_DIR, "docs"), docsDest);
    info("Documentación copiada a .sdd/docs/");
  }
}

// ─── Fin ─────────────────────────────────────────────────────────────────────────

/** @param {string} [perfil] perfil de instalación efectivo (CA-001-04) */
function pasosFinales(perfil = PERFIL_POR_DEFECTO) {
  console.log("");
  console.log("  ╔══════════════════════════════════════════════════════════════╗");
  console.log("  ║                  ✅  FORGE instalado                         ║");
  console.log("  ╠══════════════════════════════════════════════════════════════╣");
  console.log("  ║                                                              ║");
  console.log("  ║   1. Comprueba el entorno:   fragua doctor                   ║");
  console.log("  ║                                                              ║");
  console.log("  ║   2. Abre Claude Code y escribe:                             ║");
  console.log('  ║      /forge "describe tu idea aquí"                          ║');
  console.log("  ║                                                              ║");
  console.log("  ║   El camino de cinco comandos:                               ║");
  console.log("  ║      /sdd.especificar → /sdd.planificar → /sdd.tareas        ║");
  console.log("  ║      → /sdd.implementar → /sdd.estado                        ║");
  console.log("  ║                                                              ║");
  console.log("  ║   ¿Necesitas ayuda? Escribe:  /forge ayuda                   ║");
  console.log("  ╚══════════════════════════════════════════════════════════════╝");
  console.log("");
  if (perfil === "completo") {
    info("Perfil completo: los 39 comandos están en el menú «/».");
  } else {
    info(`Perfil ${perfil}: solo el camino principal en el menú «/». Para todos los comandos: forge init --perfil completo`);
  }
  info("Guía de 15 minutos: docs/PRIMEROS-15-MINUTOS.md");
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

export const CLAUDE_MD_VERSION = pluginVersion();
const CLAUDE_MD_VERSION_TAG = `<!-- forge-version: ${CLAUDE_MD_VERSION} -->`;

function integrarClaudeMd(cwd) {
  const claudeMdPath = join(cwd, "CLAUDE.md");
  // Un enlace (a otro archivo, a una carpeta o colgante) no se sigue ni para leer ni para escribir
  try {
    if (lstatSync(claudeMdPath).isSymbolicLink()) {
      aviso("CLAUDE.md es un enlace simbólico o una unión — no se modifica (no se escribe a través de enlaces)");
      sinEscribir.push(claudeMdPath);
      return;
    }
  } catch { /* no existe: se crea */ }
  const MARCADOR_INICIO = "## FORGE";

  const seccionCompleta = CLAUDE_MD_SECCION.trimEnd() + "\n" + CLAUDE_MD_VERSION_TAG + "\n";

  let existe = false;
  try { lstatSync(claudeMdPath); existe = true; } catch { /* no existe */ }
  if (existe) {
    // `leerSeguro`: una carpeta o una tubería con nombre no se lee (la tubería colgaba `init`)
    const contenido = leerSeguro(claudeMdPath);
    if (contenido === null) { sinEscribir.push(claudeMdPath); return; }
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
  // Las lecturas de insumos pasan por la misma política que las escrituras: el contenido de un archivo enlazado a fuera no entra en AGENTS.md (N-07)
  const constitucion = leerSeguro(rutaConstitucion);
  const plantilla = readFileSync(join(PLUGIN_DIR, "plantillas", "AGENTS.md"), "utf8");

  // Solo datos del propio proyecto y nunca su ruta: el nombre de su manifiesto y su comando de pruebas
  let nombre;
  try { nombre = JSON.parse(leerSeguro(join(cwd, "package.json")) ?? "").name; } catch { /* sin manifiesto de Node */ }
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
    sinEscribir.push(enlace);
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
      aviso(`AGENTS.md no se escribe: ${e.message}`);
      sinEscribir.push(e.ruta);
    }
  }
  const actual = leerSeguro(destino);
  if (actual === null) { sinEscribir.push(destino); return "enlace"; }
  if (actual.replace(/\r\n/g, "\n") === contenido) {
    info("AGENTS.md ya está al día");
    return "al_dia";
  }
  const propuesta = join(cwd, ".sdd", "AGENTS.propuesto.md");
  try {
    escribirArchivo(cwd, propuesta, contenido);
  } catch (e) {
    if (!(e instanceof ErrorEnlace)) throw e;
    aviso(`La propuesta de AGENTS.md no se escribe: ${e.message}`);
    sinEscribir.push(e.ruta);
    return "enlace";
  }
  aviso("AGENTS.md ya existe — no se sobreescribe");
  aviso(`  Propuesta generada de ${de}: .sdd/AGENTS.propuesto.md (compárala y copia lo que quieras)`);
  return "propuesto";
}

export function cmdInit(global, guided = false, withUi = false, preset = null, template = null) {
  banner();
  // Cada destino con su raíz: ~/.claude para lo global, el proyecto (ya sin uniones) para lo local
  const claudeDir = fijarRaices({ global });
  // Integración y perfil: sin opciones ni configuración guardada es null y todo sigue como siempre.
  // Se valida antes de escribir nada: una clave o carpeta inválida no deja rastro.
  const inst = resolverInstalacion(global);
  const esClaude = !inst || inst.integracion.nativa;
  console.log(`  Modo: ${global ? "GLOBAL" : "PROYECTO"} (${claudeDir})`);
  if (global) paso("crear ~/.claude", () => mkdirSync(claudeDir, { recursive: true }));
  if (template) console.log(`  Template: ${template}`);
  console.log("");

  if (!claudeEnPath()) {
    aviso("Claude Code CLI no detectado en PATH. Los archivos se instalarán de todos modos.");
  }
  if (global) avisarEnlacesGlobales(claudeDir);

  // Un destino raro (carpeta donde va un archivo, tubería, archivo en uso) no puede tumbar el resto
  paso("copiar el núcleo", () => copiarNucleo(claudeDir, inst));
  if (esClaude) paso("settings.json", () => copiarSettings(claudeDir));

  if (!global) {
    const overrides = guided ? wizardGuiado() : {};
    paso("estructura .sdd/", () => configurarSdd(claudeDir, overrides));
  }

  if (template) {
    paso(`template ${template}`, () => aplicarTemplate(template));
  }

  if (preset) {
    paso(`preset ${preset}`, () => aplicarPreset(preset));
  }

  if (inst && !global) paso("guardar integración y perfil", () => guardarInstalacion(inst));

  if (!global) {
    if (esClaude) paso("CLAUDE.md", () => integrarClaudeMd(PROYECTO));
    paso("AGENTS.md", () => integrarAgentsMd(PROYECTO));
  }

  if (withUi) {
    paso("dashboard UI", () => instalarUi());
  }

  // Con algo sin escribir no se dice «instalado»: sale con código 1 y dice qué faltó
  if (!cerrarSiFalto("forge init")) return;

  if (inst && (!inst.integracion.nativa || inst.explicita)) {
    resumenInstalacion(inst);
  } else if (template) {
    pasosFinalesConTemplate(template);
  } else {
    pasosFinales(inst ? inst.perfil : PERFIL_POR_DEFECTO);
  }
}

/** Dice, una vez, qué carpetas globales son una unión del usuario y a dónde se va a escribir. */
function avisarEnlacesGlobales(claudeDir) {
  for (const d of CARPETAS_GLOBALES_ENLAZABLES) {
    const ruta = join(claudeDir, d);
    try {
      if (lstatSync(ruta).isSymbolicLink()) info(`${ruta} es una unión o un enlace tuyo: se escribe en su destino (${realpathSync(ruta)}) por decisión explícita.`);
    } catch { /* no existe o está roto: lo dirá la escritura */ }
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
  const sddDir = join(PROYECTO, ".sdd");
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
  const configDest = join(PROYECTO, ".sdd", "sdd.config.yaml");
  if (!existsSync(presetSrc)) {
    aviso(`Archivo de preset no encontrado: ${presetSrc}`);
    return;
  }
  if (!existsSync(join(PROYECTO, ".sdd"))) {
    aviso(".sdd/ no existe — ejecuta forge init primero");
    return;
  }
  const presetContent = readFileSync(presetSrc, "utf8");
  // Preserva los bloques de rutas, protecciones y figma del config actual
  let current = leerSeguro(configDest) ?? "";
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
  const uiDest = join(PROYECTO, ".forge-ui");
  try {
    const { bloqueados } = copiarArbol(raizPara(uiDest), uiSrc, uiDest);
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
  console.log("  ║   Fragua — Configuración guiada      ║");
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

export function cmdUpdate(global) {
  banner();
  // Antes `update` no fijaba la raíz de escritura: con --global todo quedaba «fuera del proyecto» y se
  // descartaba con decenas de avisos, y aun así imprimía «Núcleo actualizado» (N-04)
  const claudeDir = fijarRaices({ global });
  console.log(`  Actualizando núcleo en: ${claudeDir}`);
  console.log("  (.sdd/ y settings.json del usuario NO se tocan)");
  console.log("");

  const inst = resolverInstalacion(global);
  const esClaude = !inst || inst.integracion.nativa;
  const carpetaNucleo = esClaude ? claudeDir : destinoSkills(inst);
  if (!existsSync(carpetaNucleo)) {
    error(`No existe ${carpetaNucleo}. Ejecuta 'npx sdd-es init' primero.`);
  }
  if (global) avisarEnlacesGlobales(claudeDir);

  paso("copiar el núcleo", () => copiarNucleo(claudeDir, inst, { actualizar: true }));
  // Solo si pidieron integración o perfil en esta ejecución: una instalación existente no cambia sola
  if (inst && inst.explicita && !global) paso("guardar integración y perfil", () => guardarInstalacion(inst));
  if (!cerrarSiFalto("forge update")) return;
  info("Núcleo actualizado. Tu .sdd/ y settings.json se conservan.");
  if (inst && !esClaude) resumenInstalacion(inst);
  console.log("");
}
