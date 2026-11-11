#!/usr/bin/env node
/**
 * pre-tool-guard.js — Hook PreToolUse global de Claude Code
 *
 * Bloquea operaciones destructivas o fuera del workspace antes
 * de que Claude Code las ejecute. Se registra en settings.json
 * bajo "hooks.PreToolUse".
 *
 * Es una RED DE SEGURIDAD, no un límite: la defensa principal es `permissions.deny` gestionado y el sandbox
 * (SECURITY.md). Falla CERRADO: si no puede leer el evento o no puede cargar sus módulos, bloquea.
 *
 * Protocolo de hooks de Claude Code:
 *   - Lee el evento JSON desde stdin
 *   - Exit 0  → permitir
 *   - Exit 2  → bloquear (Claude Code muestra el stderr al usuario)
 *   - Stderr  → mensaje de error mostrado al usuario
 *
 * Spec 2026-11-06-guardian-endurecido (informe SEGURIDAD-CIBER C-01 a C-07, C-13).
 */

import { createInterface } from "node:readline";
import { existsSync, mkdirSync, appendFileSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve, dirname, relative, isAbsolute } from "node:path";

/** Salida de emergencia: sin módulos no hay análisis, y sin análisis no se deja pasar nada. */
function fallarCerrado(motivo) {
  try { process.stderr.write(`FORGE detuvo esta acción: el guardián no pudo evaluarla (${motivo}).\n`); } catch { /* nada más que hacer */ }
  process.exit(2);
}

/** @type {any} */
let M;
try {
  M = {
    ...(await import("./shared/protegidos.js")),
    ...(await import("./shared/guardian-reglas.js")),
    ...(await import("./shared/config.js")),
    ...(await import("./shared/entorno.js")),
  };
} catch (e) {
  fallarCerrado(`faltan o no cargan sus módulos: ${String(/** @type {any} */ (e)?.message ?? e).slice(0, 160)}`);
}
const { agenteActivo, clasificarConfiguracionProtegida, esConfiguracionProtegida, evaluarComando, escribeAlgo, esRutaCriticaDelGuardian, esSecreto, motivoDestinoProtegido,
  leerForgeConfig, leerNivelEjecucion, dlqAppend } = M;

const FORGE_CONFIG = leerForgeConfig(process.cwd());

const rl = createInterface({ input: process.stdin, terminal: false });
let raw = "";
rl.on("line", (l) => (raw += l + "\n"));
rl.on("close", () => {
  try { main(raw.trim()); } catch (e) { fallarCerrado(`error interno: ${String(/** @type {any} */ (e)?.message ?? e).slice(0, 160)}`); }
});

// ── Helper: bloquear con DLQ ─────────────────────────────────────────────────

/**
 * Escribe el motivo en stderr, registra en DLQ y sale con código 2.
 * @param {string} mensaje  — texto visible para el usuario
 * @param {{ tool?: string, input?: unknown, hook?: string }} meta
 */
function bloquear(mensaje, meta = {}) {
  process.stderr.write(mensaje + "\n");
  dlqAppend(process.cwd(), {
    hook: meta.hook ?? "pre-tool-guard",
    tool: meta.tool ?? "unknown",
    input: meta.input ?? null,
    error: redactarSecretos(mensaje).slice(0, 300),
    retryable: false,
  });
  process.exit(2);
}

/** Ruta relativa al proyecto y con `/`, sea relativa o absoluta, de aquí o de fuera. */
function relativoAlProyecto(ruta) {
  const cwd = process.cwd();
  return relative(cwd, resolve(cwd, String(ruta))).replace(/\\/g, "/");
}

/** ¿Cae fuera del proyecto? (`relative` en vez de `startsWith`: `C:\proyecto-malo` no es hijo de `C:\proyecto`) */
function fueraDelProyecto(ruta) {
  const rel = relative(process.cwd(), resolve(process.cwd(), String(ruta)));
  return rel === ".." || rel.startsWith(".." + "\\") || rel.startsWith("../") || isAbsolute(rel);
}

// ── Comandos prohibidos — segunda línea: el análisis por argv (shared/guardian-reglas.js) es la primera ──
const PROHIBIDOS = [
  // Eliminación masiva
  /rm\s+-rf?\s+\/(?!\w)/,           // rm -rf /  (raíz)
  /rm\s+-rf?\s+~(?:\s|$)/,          // rm -rf ~
  /rm\s+-rf?\s+\.\s*$/,             // rm -rf .  (cwd)
  /rm\s+-rf?\s+\.\./,               // rm -rf ..
  /Remove-Item\s+.*-Recurse.*-Force\s+[/\\]/, // PowerShell rm raíz

  // Git destructivo remoto
  /git\s+push\s+.*--force(?!-with-lease)/,   // push --force (no --force-with-lease)
  /git\s+push\s+-f\b/,
  /git\s+push\s+\w+\s+:\w+/,        // git push origin :rama (borrar rama remota)

  // Git destructivo local irreversible
  /git\s+reset\s+--hard/,
  /git\s+clean\s+.*-[xf]{1,3}d/,
  /git\s+reflog\s+expire/,
  /git\s+gc\s+.*--prune=now/,

  // Base de datos
  /DROP\s+DATABASE\b/i,
  /DROP\s+SCHEMA\b/i,

  // Credenciales en git config
  /git\s+config\s+.*password/i,
  /git\s+config\s+.*credential.*store/i,

  // Operaciones fuera del workspace — acceso a rutas de sistema
  /rm\s+.*\/etc\//,
  /rm\s+.*\/usr\//,
  /rm\s+.*\/bin\//,
  /rm\s+.*C:\\Windows\\/i,
  /rm\s+.*C:\\Program Files\\/i,

  // Permisos inseguros
  /chmod\s+777\b/,                             // chmod 777 (todos los permisos)
  /chmod\s+-R\s+777\b/,                        // chmod -R 777 (recursivo)
];

// ── Operaciones que requieren confirmación explícita (avisan; NO cortan el resto de comprobaciones) ──
const ADVERTENCIAS = [
  { re: /git\s+push\b/,              msg: "git push — sube código al remoto" },
  { re: /git\s+merge\b/,             msg: "git merge — modifica historial" },
  { re: /git\s+rebase\b/,            msg: "git rebase — reescribe historial" },
  { re: /git\s+reset\b/,             msg: "git reset — descarta cambios" },
  { re: /git\s+branch\s+-D\b/,       msg: "git branch -D — borra rama local" },
  { re: /DROP\s+TABLE\b/i,           msg: "DROP TABLE — elimina tabla de BD" },
  { re: /DELETE\s+FROM\b/i,          msg: "DELETE FROM — elimina filas de BD" },
  { re: /TRUNCATE\b/i,               msg: "TRUNCATE — vacía tabla de BD" },
  { re: /npm\s+publish\b/,           msg: "npm publish — publica al registro público" },
  { re: /terraform\s+apply\b/,       msg: "terraform apply — modifica infraestructura real" },
  { re: /terraform\s+destroy\b/,     msg: "terraform destroy — destruye infraestructura" },
  { re: /kubectl\s+delete\b/,        msg: "kubectl delete — elimina recursos de k8s" },
  { re: /helm\s+uninstall\b/,        msg: "helm uninstall — elimina release de k8s" },
];

// ── Patrones de secrets hardcodeados ──────────────────────────────────────
const SECRET_PATTERNS = [
  /password\s*=\s*['"][^'"]{4,}/i,
  /secret\s*=\s*['"][^'"]{8,}/i,
  /api[_-]?key\s*=\s*['"][^'"]{8,}/i,
  /token\s*=\s*['"][^'"]{10,}/i,
  /sk-ant-[a-zA-Z0-9_-]{20,}/,        // Anthropic key
  /sk-[a-zA-Z0-9]{20,}/,              // OpenAI key
  /xox[baprs]-[0-9]{10,}/,           // Slack token
  /ghp_[a-zA-Z0-9]{36}/,             // GitHub PAT
  /AKIA[0-9A-Z]{16}/,                 // AWS Access Key
  /BEGIN (RSA|EC|OPENSSH) PRIVATE KEY/,
];

/** Tapa lo que parezca un secreto antes de escribirlo en un registro (C-09). */
function redactarSecretos(texto) {
  let t = String(texto);
  for (const re of SECRET_PATTERNS) t = t.replace(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"), "[REDACTADO]");
  return t;
}

// ── Agentes read-only que NO pueden modificar archivos ────────────────────
const READ_ONLY_AGENTS = new Set([
  'arquitecto', 'asesor-datos', 'critico', 'seguridad',
  'investigador', 'revisor', 'disenador-api'
]);

/**
 * ADR de `.sdd/arquitectura/ADR-NN-*.md` (ADR-16): solo los aceptados y solo los términos
 * que declaran en la sección "## Patrones prohibidos", uno por línea y entre comillas
 * invertidas. No se deduce nada del texto libre. (La vía heredada de `.sdd/adrs/` se retiró: C-13.)
 */
function cargarPatronesDeArquitectura(cwd) {
  try {
    const dir = join(cwd, '.sdd', 'arquitectura');
    if (!existsSync(dir)) return [];
    const patrones = [];
    for (const f of readdirSync(dir)) {
      if (!/^ADR-\d+.*\.md$/.test(f)) continue;
      let texto = '';
      try { texto = readFileSync(join(dir, f), 'utf8').replace(/\r\n/g, '\n'); } catch { continue; }
      if (!/^>\s*Estado:\s*aceptada\b/m.test(texto)) continue;
      const seccion = texto.match(/^##\s+Patrones prohibidos\s*\n([\s\S]*?)(?=^##\s|(?![\s\S]))/m);
      if (!seccion) continue;
      for (const m of seccion[1].matchAll(/^\s*[-*]\s+`([^`\n]+)`/gm)) {
        const termino = m[1].trim().toLowerCase();
        if (termino.length > 2 && termino.length < 50) patrones.push(termino);
      }
    }
    return [...new Set(patrones)];
  } catch { return []; }
}

function verificarViolacionADR(contenido, patrones) {
  const contenidoLower = contenido.toLowerCase();
  return patrones.find(p => contenidoLower.includes(p)) ?? null;
}

const OPCIONES_REGLAS = {
  aRelativa: (/** @type {string} */ r) => relativoAlProyecto(r),
  protegidaConfig: (/** @type {string} */ r) => esConfiguracionProtegida(r),
};

function main(raw) {
  /** @type {any} */
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    // Falla cerrado: si el hook no entiende el evento, no puede decir que sea seguro
    bloquear("FORGE detuvo esta acción: el guardián no pudo leer el evento de la herramienta (JSON ilegible).", { tool: "desconocida", input: null });
    return;
  }
  if (event === null || typeof event !== "object" || Array.isArray(event)) {
    bloquear("FORGE detuvo esta acción: el evento de la herramienta no tiene la forma esperada.", { tool: "desconocida", input: null });
    return;
  }

  const toolName = String(event?.tool_name ?? "");
  const toolInput = event?.tool_input ?? {};
  const agentName = agenteActivo();
  const editaGuardian = process.env.FORGE_EDITAR_GUARDIAN === "1";   // lo fija el dueño al lanzar Claude Code; el agente no puede

  // ── CircuitBreaker: el nivel se evalúa ANTES de cualquier salida con exit(0) ──
  const nivel = leerNivelEjecucion(process.cwd());

  // AG-01: Advertir si la variable de identidad del agente no está disponible.
  if (!agentName && (toolName === "Write" || toolName === "Edit" || toolName === "MultiEdit" || toolName === "NotebookEdit")) {
    process.stderr.write(
      `⚠️  [pre-tool-guard] FRAGUA_AGENTE (o CLAUDE_AGENT_NAME) no disponible — los guardias de agentes read-only están desactivados.\n` +
      `   Actualiza Claude Code a la versión que expone esta variable de entorno en hooks.\n`
    );
  }

  // ── 0. Herramientas que escriben: permisos por agente + rutas protegidas + secrets ─
  const isWriteTool = toolName === "Write" || toolName === "Edit" || toolName === "MultiEdit" || toolName === "NotebookEdit";
  if (isWriteTool) {
    const destinoCrudo = String(toolInput?.file_path ?? toolInput?.path ?? toolInput?.notebook_path ?? '');
    const destino = destinoCrudo.replace(/\\/g, '/');
    const esArtefactoSdd = /(^|\/)\.sdd\//.test(destino);

    if (nivel === 'sandbox' && destinoCrudo !== '' && fueraDelProyecto(destinoCrudo)) {
      bloquear(`CircuitBreaker nivel sandbox — escritura fuera del proyecto bloqueada: ${destinoCrudo}`, { tool: toolName, input: { file_path: destinoCrudo } });
    }

    if (destinoCrudo !== '') {
      const relativo = relativoAlProyecto(destinoCrudo);

      // 0a. El propio guardián, su registro, su nivel y .git: reescribirlos apagaría todos los controles (C-01)
      if (esRutaCriticaDelGuardian(relativo) && !editaGuardian) {
        bloquear(
          `FORGE detuvo esta acción: "${relativo}" es parte del guardián (hooks, registro de hooks, nivel de ejecución o .git). ` +
          `Un agente no la modifica; el dueño del proyecto la edita a mano.`,
          { tool: toolName, input: { file_path: relativo }, hook: "pre-tool-guard" }
        );
      }

      // 0b. Secretos y nombres cortos 8.3 que apuntan a otro archivo
      const motivo = motivoDestinoProtegido(destinoCrudo, OPCIONES_REGLAS.aRelativa, undefined);
      if (motivo && !/guardián/.test(motivo)) {
        bloquear(`FORGE detuvo esta acción: "${relativo}" es ${motivo}. Un agente no lo escribe.`, { tool: toolName, input: { file_path: relativo } });
      }

      // 0c. Configuración de calidad protegida (tipos, linter, seguridad, cobertura)
      const { protegida, herramienta } = clasificarConfiguracionProtegida(relativo);
      if (protegida) {
        bloquear(
          `FORGE detuvo esta acción: "${relativo}" es configuración protegida (${herramienta}). ` +
          `Un agente no la modifica; pídele el cambio al dueño del proyecto.`,
          { tool: toolName, input: { file_path: relativo }, hook: "pre-tool-guard" }
        );
      }
    }

    const patronesArquitectura = esArtefactoSdd ? [] : cargarPatronesDeArquitectura(process.cwd());
    if (patronesArquitectura.length > 0) {
      const contenidoPropuesto = String(toolInput?.content ?? toolInput?.new_string ?? '');
      const violacion = verificarViolacionADR(contenidoPropuesto, patronesArquitectura);
      if (violacion) {
        process.stderr.write(JSON.stringify({
          action: 'block',
          message: `Violación de ADR: el contenido contiene "${violacion}" que está marcado como prohibido en un ADR registrado. Revisa .sdd/arquitectura/ antes de continuar.`
        }) + '\n');
        process.exit(2);
      }
    }

    // Agentes read-only no pueden modificar archivos
    if (agentName && READ_ONLY_AGENTS.has(agentName)) {
      process.stderr.write(
        `FORGE detuvo esta acción: el agente "${agentName}" solo puede leer, no modificar archivos.\n` +
        `Si necesitas que este agente escriba código, cambia su rol en la configuración.\n`
      );
      process.exit(2);
    }

    // Edit/MultiEdit sobre archivo inexistente → bloquear con mensaje útil
    if (toolName === "Edit" || toolName === "MultiEdit") {
      const filePath = String(toolInput?.file_path ?? toolInput?.path ?? "");
      if (filePath && filePath !== "(desconocido)" && !existsSync(filePath)) {
        process.stderr.write(
          `FORGE detuvo esta acción: el archivo "${filePath}" no existe.\n` +
          `Usa Write para crear archivos nuevos, o verifica la ruta antes de editar.\n`
        );
        process.exit(2);
      }
    }

    // write-safety — solo para tool Write
    if (toolName === "Write" && FORGE_CONFIG.guardrails.write_safety) {
      const filePath = String(toolInput?.file_path ?? toolInput?.path ?? "");
      if (filePath && existsSync(filePath)) {
        process.stderr.write(`⚠️  [write-safety] El archivo "${filePath}" ya existe y será sobreescrito.\n`);
      }
    }

    // Detectar secrets en el contenido que se va a escribir
    const contenido = String(toolInput?.content ?? toolInput?.new_string ?? "");
    if (contenido) {
      for (const re of SECRET_PATTERNS) {
        if (re.test(contenido)) {
          process.stderr.write(
            `FORGE detectó que el archivo a escribir incluye una contraseña o clave secreta.\n` +
            `Para proteger tu seguridad, usa variables de entorno en lugar de escribir credenciales en el código.\n` +
            `Ejemplo: usa process.env.MI_CLAVE en vez de escribir el valor directamente.\n`
          );
          process.exit(2);
        }
      }
    }

    // verify-imports opt-in
    if (FORGE_CONFIG.guardrails.verify_local_imports && contenido) {
      const filePath = String(toolInput?.file_path ?? toolInput?.path ?? "");
      if (filePath && /\.[jt]sx?$/.test(filePath)) {
        const fileDir = dirname(resolve(filePath));
        const importRe = /from\s+['"](\.[./\\][^'"]+)['"]/g;
        let m;
        while ((m = importRe.exec(contenido)) !== null) {
          const importPath = m[1];
          const candidatos = /\.\w+$/.test(importPath)
            ? [importPath]
            : [importPath, importPath + ".js", importPath + ".ts", importPath + "/index.js", importPath + "/index.ts"];
          const existe = candidatos.some((c) => existsSync(resolve(fileDir, c)));
          if (!existe) {
            process.stderr.write(
              `⚠️  [verify-imports] Import relativo no encontrado: "${importPath}"\n` +
              `   Archivo: ${filePath}\n` +
              `   (Advertencia — no bloquea. Desactiva con guardrails.verify_local_imports: false)\n`
            );
          }
        }
      }
    }

    if (agentName) {
      logAgentToolAttempt(agentName, toolName, String(toolInput?.file_path ?? toolInput?.path ?? toolInput?.notebook_path ?? "(desconocido)"));
    }
    process.exit(0);
  }

  // ── Lectura de secretos con la herramienta Read (C-04: la lectura de .env ya no es libre) ──
  if (toolName === "Read" || toolName === "NotebookRead") {
    const objetivo = String(toolInput?.file_path ?? toolInput?.path ?? toolInput?.notebook_path ?? "");
    if (objetivo && (esSecreto(objetivo) || esSecreto(relativoAlProyecto(objetivo)))) {
      bloquear(
        `FORGE detuvo esta acción: "${relativoAlProyecto(objetivo)}" contiene secretos y un agente no lo lee. ` +
        `Usa ".env.example" para ver qué variables hacen falta.`,
        { tool: toolName, input: { file_path: relativoAlProyecto(objetivo) } }
      );
    }
    process.exit(0);
  }

  // Solo inspeccionamos Bash y PowerShell para el resto
  if (toolName !== "Bash" && toolName !== "PowerShell") {
    process.exit(0);
  }

  const cmd = String(toolInput?.command ?? "").trim();
  if (!cmd) process.exit(0);

  // Auditoría de Bash/PowerShell por agente
  if (agentName) {
    logAgentToolAttempt(agentName, toolName, cmd);
  }

  // ── 1. CircuitBreaker: el nivel manda antes que cualquier otra cosa ─────
  if (nivel === 'sandbox') {
    bloquear(
      `CircuitBreaker activo: nivel sandbox — ${toolName} bloqueado tras fallos consecutivos. Resuelve los errores antes de continuar.`,
      { tool: toolName, input: toolInput }
    );
  } else if (nivel === 'confirmado') {
    process.stderr.write(`[forge] Nivel confirmado — ${toolName} irrestricto activo\n`);
  }

  // ── 2. Agentes de solo lectura tampoco escriben por la shell (C-06) ─────
  if (agentName && READ_ONLY_AGENTS.has(agentName) && escribeAlgo(cmd)) {
    bloquear(
      `FORGE detuvo esta acción: el agente "${agentName}" solo puede leer; este comando escribe o modifica algo.\n` +
      `Comando bloqueado: ${redactarSecretos(cmd).slice(0, 120)}`,
      { tool: toolName, input: { command: redactarSecretos(cmd).slice(0, 200) } }
    );
  }

  // ── 3. Análisis por argv: banderas en cualquier orden, ; && | $(…) bash -c, rutas protegidas ──
  const veredicto = evaluarComando(cmd, OPCIONES_REGLAS);
  if (veredicto && !(editaGuardian && /guardián/.test(veredicto.motivo))) {
    bloquear(
      `FORGE evitó esta acción (${veredicto.motivo}).\n` +
      `Si estás completamente seguro de lo que haces, ejecuta el comando manualmente en tu terminal.\n` +
      `Comando bloqueado: ${redactarSecretos(veredicto.segmento)}`,
      { tool: toolName, input: { command: redactarSecretos(cmd).slice(0, 200) } }
    );
  }

  // ── 4. Segunda línea: las regex de siempre sobre el texto completo ──────
  for (const re of PROHIBIDOS) {
    if (re.test(cmd)) {
      process.stderr.write(
        `FORGE evitó esta acción porque podría borrar o dañar archivos importantes de forma irreversible.\n` +
        `Si estás completamente seguro de lo que haces, ejecuta el comando manualmente en tu terminal.\n` +
        `Comando bloqueado: ${redactarSecretos(cmd).slice(0, 120)}\n`
      );
      process.exit(2);
    }
  }

  // ── 5. Secrets hardcodeados en el comando ──────────────────────────────
  for (const re of SECRET_PATTERNS) {
    if (re.test(cmd)) {
      process.stderr.write(
        `FORGE detectó que este comando incluye una contraseña o clave secreta escrita directamente.\n` +
        `Para proteger tu seguridad, usa variables de entorno en lugar de escribir credenciales en el código.\n` +
        `Ejemplo: usa process.env.MI_CLAVE en vez de escribir el valor directamente.\n`
      );
      process.exit(2);
    }
  }

  // ── 6. Advertencias: avisan, pero ya no cortan la evaluación (C-02) ────
  for (const { re, msg } of ADVERTENCIAS) {
    if (re.test(cmd)) {
      process.stderr.write(
        `Atención: esto va a realizar una acción que no se puede deshacer fácilmente (${msg}).\n` +
        `Revisa el comando antes de confirmar: ${redactarSecretos(cmd).slice(0, 120)}\n`
      );
      break;
    }
  }

  process.exit(0);
}

/**
 * Registra intentos de tool por agente para auditoría (sin secretos: C-09)
 */
function logAgentToolAttempt(agentName, toolName, target) {
  try {
    const auditDir = '.sdd/observabilidad';
    const auditFile = join(auditDir, 'agent-tool-audit.jsonl');

    if (!existsSync(auditDir)) {
      mkdirSync(auditDir, { recursive: true });
    }

    const record = {
      timestamp: new Date().toISOString(),
      agent: agentName,
      tool: toolName,
      cmd_preview: redactarSecretos(target).slice(0, 120),
      pid: process.pid
    };

    appendFileSync(auditFile, JSON.stringify(record) + '\n', 'utf8');
  } catch {
    // Silenciosamente ignorar fallos de auditoría (no bloquear ejecución)
  }
}
