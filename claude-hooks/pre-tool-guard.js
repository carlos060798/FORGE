#!/usr/bin/env node
/**
 * pre-tool-guard.js — Hook PreToolUse global de Claude Code
 *
 * Bloquea operaciones destructivas o fuera del workspace antes
 * de que Claude Code las ejecute. Se registra en settings.json
 * bajo "hooks.PreToolUse".
 *
 * Protocolo de hooks de Claude Code:
 *   - Lee el evento JSON desde stdin
 *   - Exit 0  → permitir
 *   - Exit 2  → bloquear (Claude Code muestra el stderr al usuario)
 *   - Stderr  → mensaje de error mostrado al usuario
 */

import { createInterface } from "node:readline";
import { existsSync, mkdirSync, appendFileSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";

// ── Configuración (importada desde módulo compartido) ─────────────────────────
import { leerForgeConfig, leerNivelEjecucion } from "./shared/config.js";

const FORGE_CONFIG = leerForgeConfig(process.cwd());

const rl = createInterface({ input: process.stdin, terminal: false });
let raw = "";
rl.on("line", (l) => (raw += l + "\n"));
rl.on("close", () => main(raw.trim()));

// ── Comandos prohibidos — bloqueo duro, sin confirmación ───────────────────
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

  // Escritura directa en .env — solo ESCRITURA está bloqueada; lectura (grep, cat, less…) está permitida
  // Permitidos: .env.example, .env.template, .env.sample
  /\b(?:echo|printf|tee)\b.*\.env(?!\.(?:example|template|sample)\b)/,           // echo/printf/tee > .env
  /\bcat\s*>+\s*.*\.env(?!\.(?:example|template|sample)\b)/,                     // cat > .env  o  cat >> .env
  /\bcp\s+\S+\s+\.env(?!\.(?:example|template|sample)\b)/,                       // cp archivo .env
  /\bmv\s+\S+\s+\.env(?!\.(?:example|template|sample)\b)/,                       // mv archivo .env
  /\b(?:nano|vim?|vi|emacs|code)\s+.*\.env(?!\.(?:example|template|sample)\b)/i, // editores sobre .env
  /\bSet-Content\s+.*\.env(?!\.(?:example|template|sample)\b)/i,                 // PowerShell Set-Content
  /\bOut-File\s+.*\.env(?!\.(?:example|template|sample)\b)/i,                    // PowerShell Out-File

  // Permisos inseguros
  /chmod\s+777\b/,                             // chmod 777 (todos los permisos)
  /chmod\s+-R\s+777\b/,                        // chmod -R 777 (recursivo)
];

// ── Operaciones que requieren confirmación explícita ───────────────────────
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
  /sk-[a-zA-Z0-9]{20,}/,              // OpenAI key
  /xox[baprs]-[0-9]{10,}/,           // Slack token
  /ghp_[a-zA-Z0-9]{36}/,             // GitHub PAT
  /AKIA[0-9A-Z]{16}/,                 // AWS Access Key
  /BEGIN (RSA|EC|OPENSSH) PRIVATE KEY/,
];

// ── Agentes read-only que NO pueden modificar archivos ────────────────────
const READ_ONLY_AGENTS = new Set([
  'arquitecto', 'asesor-datos', 'critico', 'seguridad',
  'investigador', 'revisor', 'disenador-api'
]);

// ── ADR activo: verificar decisiones arquitectónicas registradas ──────────────
function cargarADRs(cwd) {
  try {
    const adrDir = join(cwd, '.sdd', 'adrs');
    if (!existsSync(adrDir)) return [];
    return readdirSync(adrDir)
      .filter(f => f.endsWith('.md') || f.endsWith('.json'))
      .map(f => {
        try { return readFileSync(join(adrDir, f), 'utf8'); } catch { return ''; }
      })
      .filter(Boolean);
  } catch { return []; }
}

function extraerPatronesProhibidos(adrs) {
  const patrones = [];
  for (const adr of adrs) {
    // Buscar líneas con "NO usar X", "prohibido X", "evitar X", "banned: X"
    const matches = adr.matchAll(/(?:NO usar|prohibido|evitar|banned?|no\s+use?)\s*[:\-]?\s*`?([^`\n,]+)`?/gi);
    for (const m of matches) {
      const término = m[1].trim();
      if (término.length > 2 && término.length < 50) {
        patrones.push(término.toLowerCase());
      }
    }
  }
  return [...new Set(patrones)];
}

function verificarViolacionADR(contenido, patrones) {
  const contenidoLower = contenido.toLowerCase();
  return patrones.find(p => contenidoLower.includes(p)) ?? null;
}

function main(raw) {
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    // Si no podemos parsear, dejamos pasar (no bloquear por error del hook)
    process.exit(0);
  }

  const toolName = event?.tool_name ?? "";
  const toolInput = event?.tool_input ?? {};
  const agentName = process.env.CLAUDE_AGENT_NAME ?? "";

  // ── CircuitBreaker: leer nivel de ejecución actual ─────────────────────
  const nivel = leerNivelEjecucion(process.cwd());

  // AG-01: Advertir si la variable de identidad del agente no está disponible.
  // Cuando está vacía, los guardias de agentes read-only quedan desactivados.
  if (!agentName && (toolName === "Write" || toolName === "Edit" || toolName === "MultiEdit")) {
    process.stderr.write(
      `⚠️  [pre-tool-guard] CLAUDE_AGENT_NAME no disponible — los guardias de agentes read-only están desactivados.\n` +
      `   Actualiza Claude Code a la versión que expone esta variable de entorno en hooks.\n`
    );
  }

  // ── 0. Write/Edit/MultiEdit: permisos por agente + secrets en contenido ─
  const isWriteTool = toolName === "Write" || toolName === "Edit" || toolName === "MultiEdit";
  if (isWriteTool) {
    // 0aa. Verificación ADR activo
    const adrs = cargarADRs(process.cwd());
    if (adrs.length > 0) {
      const patrones = extraerPatronesProhibidos(adrs);
      const contenidoPropuesto = String(toolInput?.content ?? toolInput?.new_string ?? '');
      const violacion = verificarViolacionADR(contenidoPropuesto, patrones);
      if (violacion) {
        process.stderr.write(JSON.stringify({
          action: 'block',
          message: `Violación de ADR: el contenido contiene "${violacion}" que está marcado como prohibido en un ADR registrado. Revisa .sdd/adrs/ antes de continuar.`
        }) + '\n');
        process.exit(2);
      }
    }

    // 0a. Agentes read-only no pueden modificar archivos
    if (agentName && READ_ONLY_AGENTS.has(agentName)) {
      process.stderr.write(
        `FORGE detuvo esta acción: el agente "${agentName}" solo puede leer, no modificar archivos.\n` +
        `Si necesitas que este agente escriba código, cambia su rol en la configuración.\n`
      );
      process.exit(2);
    }

    // 0b. Edit/MultiEdit sobre archivo inexistente → bloquear con mensaje útil
    // Write sí puede crear archivos nuevos — solo bloqueamos Edit
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

    // 0c. write-safety — solo para tool Write (Edit ya está cubierto en 0b)
    if (toolName === "Write" && FORGE_CONFIG.guardrails.write_safety) {
      const filePath = String(toolInput?.file_path ?? toolInput?.path ?? "");
      if (filePath && existsSync(filePath)) {
        // El archivo ya existe → advertir (no bloquear — puede ser intencional)
        process.stderr.write(
          `⚠️  [write-safety] El archivo "${filePath}" ya existe y será sobreescrito.\n`
        );
      }
    }

    // 0e. Detectar secrets en el contenido que se va a escribir
    const contenido = String(
      toolInput?.content ?? toolInput?.new_string ?? ""
    );
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

    // 0f. verify-imports opt-in — solo si está activado en forge.config.json
    if (FORGE_CONFIG.guardrails.verify_local_imports && contenido) {
      const filePath = String(toolInput?.file_path ?? toolInput?.path ?? "");
      if (filePath && /\.[jt]sx?$/.test(filePath)) {
        const fileDir = dirname(resolve(filePath));
        const importRe = /from\s+['"](\.[./\\][^'"]+)['"]/g;
        let m;
        while ((m = importRe.exec(contenido)) !== null) {
          const importPath = m[1];
          // Intentar con extensiones comunes si no tiene extensión
          const candidatos = /\.\w+$/.test(importPath)
            ? [importPath]
            : [importPath, importPath + ".js", importPath + ".ts",
               importPath + "/index.js", importPath + "/index.ts"];
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

    // Auditoría de Write tools con agente identificado
    if (agentName) {
      const filePath = String(toolInput?.file_path ?? toolInput?.path ?? "(desconocido)");
      logAgentToolAttempt(agentName, toolName, filePath);
    }

    // Write/Edit sin problemas detectados → permitir
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

  // ── 1. Verificar prohibidos ─────────────────────────────────────────────
  // Patrones de escritura en .env — mensaje de error específico
  const ENV_WRITE_PATTERNS = PROHIBIDOS.slice(
    PROHIBIDOS.findIndex((r) => r.toString().includes("echo|printf|tee")),
    PROHIBIDOS.findIndex((r) => r.toString().includes("Out-File")) + 1
  );
  for (const re of ENV_WRITE_PATTERNS) {
    if (re.test(cmd)) {
      process.stderr.write(
        `Escritura directa en .env bloqueada — usa variables de entorno o un gestor de secretos.\n` +
        `Ejemplo: exporta la variable en tu shell o usa un servicio como Doppler, 1Password CLI o Vault.\n` +
        `Comando bloqueado: ${cmd.slice(0, 120)}\n`
      );
      process.exit(2);
    }
  }

  for (const re of PROHIBIDOS) {
    if (re.test(cmd)) {
      process.stderr.write(
        `FORGE evitó esta acción porque podría borrar o dañar archivos importantes de forma irreversible.\n` +
        `Si estás completamente seguro de lo que haces, ejecuta el comando manualmente en tu terminal.\n` +
        `Comando bloqueado: ${cmd.slice(0, 120)}\n`
      );
      process.exit(2);
    }
  }

  // ── 2. Verificar secrets hardcodeados en el comando ────────────────────
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

  // ── 3. Advertencias (no bloquean, pero se loguean) ─────────────────────
  for (const { re, msg } of ADVERTENCIAS) {
    if (re.test(cmd)) {
      // Escribir a stderr — Claude Code lo muestra como contexto antes de pedir permiso
      process.stderr.write(
        `Atención: esto va a realizar una acción que no se puede deshacer fácilmente (${msg}).\n` +
        `Revisa el comando antes de confirmar: ${cmd.slice(0, 120)}\n`
      );
      // Exit 0 — dejamos que el flujo normal de permisos de Claude Code actúe
      process.exit(0);
    }
  }

  // ── 4. Restricciones dinámicas según nivel del CircuitBreaker ──────────
  if (nivel === 'sandbox') {
    if (toolName === 'Bash') {
      console.log(JSON.stringify({
        action: 'block',
        message: 'CircuitBreaker activo: nivel sandbox — Bash bloqueado tras fallos consecutivos. Resuelve los errores antes de continuar.'
      }));
      process.exit(2);
    }
    // Bloquear Write/Edit fuera del cwd
    if (toolName === 'Write' || toolName === 'Edit') {
      const filePath = toolInput?.file_path || toolInput?.path || '';
      const cwd = process.cwd();
      if (filePath && !filePath.startsWith(cwd)) {
        console.log(JSON.stringify({
          action: 'block',
          message: `CircuitBreaker nivel sandbox — escritura fuera del proyecto bloqueada: ${filePath}`
        }));
        process.exit(2);
      }
    }
  } else if (nivel === 'confirmado') {
    // En nivel confirmado, solo advertir (no bloquear)
    if (toolName === 'Bash') {
      process.stderr.write(`[forge] Nivel confirmado — Bash irrestricto activo\n`);
    }
  }

  // Todo bien
  process.exit(0);
}

/**
 * Registra intentos de tool por agente para auditoría
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
      cmd_preview: target.slice(0, 120),
      pid: process.pid
    };

    appendFileSync(auditFile, JSON.stringify(record) + '\n', 'utf8');
  } catch {
    // Silenciosamente ignorar fallos de auditoría (no bloquear ejecución)
  }
}
