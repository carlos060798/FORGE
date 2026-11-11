// @ts-check
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { execFileSync } from "node:child_process";
import { leerVariable } from "../../core/entorno.js";
import { PRODUCTO } from "../../core/nombres.js";
import { INTEGRACION_POR_DEFECTO, resolverIntegracion } from "../../core/instalacion/herramientas-destino.js";
import { PERFIL_POR_DEFECTO, resolverPerfil } from "../../core/instalacion/perfiles.js";
import { PLUGIN_DIR, c, info, aviso, titulo, error, pluginVersion, claudeEnPath } from "./comun.js";
import { banner, instalado, leerInstalacionGuardada, CLAUDE_MD_VERSION } from "./instalar.js";

/** Variables de entorno con la clave de cada proveedor (los que no figuran no usan clave). */
const VARIABLES_DE_CLAVE = { anthropic: ["ANTHROPIC_API_KEY", "CLAUDE_API_KEY"], openai: ["OPENAI_API_KEY"] };

/**
 * Herramienta de código desde la que se usa Fragua: la integración guardada si hay una, o las señales de Claude Code.
 * @param {string|undefined} guardada clave de `instalacion.integracion`
 * @returns {{ nombre: string, claude: boolean } | null}
 */
function detectarAnfitrion(guardada) {
  const ri = guardada ? resolverIntegracion(guardada) : null;
  if (ri?.ok && !ri.integracion.nativa) return { nombre: ri.integracion.nombre, claude: false };
  const señales = !!(
    process.env.CLAUDE_AGENT_NAME ||
    process.env.CLAUDE_SESSION_ID ||
    existsSync(join(process.cwd(), ".claude", "settings.json")) ||
    existsSync(join(process.cwd(), ".claude-plugin", ".claude", "settings.json"))
  );
  return señales || ri?.ok ? { nombre: "Claude Code", claude: true } : null;
}

async function cmdDoctorLlm({ problemas }) {
  // 0. Provider activo
  const providerActivo = leerVariable('LLM_PROVIDER') ?? 'anthropic (default)';
  info(`Provider LLM activo: ${providerActivo}`);
  info("  Cambiar: FORGE_LLM_PROVIDER=anthropic|openai|ollama|stub  o  llm.provider en sdd.config.yaml");
  const { lineaRevision } = await import("../../core/precios.js");
  info(lineaRevision());
  try {
    const { lineasDeNiveles } = await import("../../core/llm-providers/niveles.js");
    const { AnthropicProvider, OpenAIProvider, OllamaProvider } = await import("../../core/llm-providers/index.js");
    const { leerModelosDe } = await import("../../core/ciclo/config.js");
    const modelos = leerModelosDe(process.cwd());
    info("Modelo de cada nivel por proveedor (modelos: del proyecto manda sobre los de la tabla):");
    for (const l of lineasDeNiveles([new AnthropicProvider({ modelos }), new OpenAIProvider({ modelos }), new OllamaProvider({ modelos })])) info(l);
  } catch (e) {
    aviso(`No se pudieron leer los niveles de modelo: ${e?.message ?? e}`);
  }

  // 1. Anfitrión: la herramienta de código desde la que se usa Fragua. No decide qué proveedor llama al modelo.
  const g = leerInstalacionGuardada();
  const anfitrion = detectarAnfitrion(g.integracion);
  if (anfitrion) {
    info(`Anfitrión detectado: ${anfitrion.nombre} ✓`);
  } else {
    info("Anfitrión: ninguno detectado — Fragua llamará al proveedor de modelos directamente");
  }

  // 2. Proveedor de modelos configurado (FORGE_LLM_PROVIDER, sdd.config.yaml o la clave presente)
  let proveedor;
  try {
    const { crearProvider } = await import("../../core/llm-providers/index.js");
    proveedor = crearProvider({ cwd: process.cwd() });
  } catch (e) {
    aviso(`No se pudo crear el proveedor de modelos: ${e?.message ?? e}`);
    problemas(1);
    return;
  }
  const nombreProveedor = proveedor.nombre;
  info(`Proveedor en uso: ${nombreProveedor}`);
  if (nombreProveedor === "stub") {
    info("Proveedor de pruebas: se omite el ping (no demostraría nada)");
    return;
  }

  // 3. Clave del proveedor activo (Ollama y compatibles no usan clave)
  const variables = VARIABLES_DE_CLAVE[nombreProveedor] ?? [];
  const clave = variables.map((v) => process.env[v]).find(Boolean);
  if (variables.length && !clave) {
    if (anfitrion) {
      aviso(`${variables[0]} no definida — se omite el ping. Si usas ${anfitrion.nombre} con su propia cuenta, es normal; el ciclo de Fragua (fragua run) sí la necesita.`);
    } else {
      aviso(`Sin ${variables[0]} — se omite el ping al proveedor ${nombreProveedor}`);
      problemas(1);
    }
    return;
  }

  // 4. Ping real con un mensaje mínimo, con el nivel económico del proveedor configurado
  const modelo = proveedor.resolveModelId("economico");
  titulo(`Ping al LLM (proveedor: ${nombreProveedor}, modelo: ${modelo})...`);
  const PING_PROMPT = "Responde exactamente con el JSON: {\"ok\":true}";
  const PING_TIMEOUT_MS = 10_000;
  let respuestaRaw = "";
  const t0 = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
    try {
      const res = await proveedor.complete({ model: modelo, systemPrompt: "", userPrompt: PING_PROMPT, maxTokens: 32, signal: controller.signal });
      respuestaRaw = res.output ?? "";
      info(`LLM responde ✓ (${res.outputTokens ?? "?"} tokens de salida)`);
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    if (e?.name === "AbortError" || e?.code === "UND_ERR_CONNECT_TIMEOUT") {
      aviso(`LLM no respondió en ${PING_TIMEOUT_MS / 1000}s — posible problema de red o de clave`);
    } else if (e?.status === 401) {
      aviso(`Clave rechazada (401 Unauthorized) — verifica ${variables[0] ?? "la clave del proveedor"}`);
    } else if (e?.status === 429) {
      aviso("Rate limit alcanzado (429) — espera unos segundos y vuelve a intentarlo");
    } else if (e?.status >= 500) {
      aviso(`Error del servidor del proveedor ${nombreProveedor} (${e.status}) — reintenta más tarde`);
    } else {
      aviso(`Error inesperado al contactar el LLM: ${e?.message ?? e}`);
    }
    problemas(1);
    return;
  }

  // 5. La respuesta debe ser JSON parseable
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

  // Latencia orientativa (la del ping ya hecho)
  const latencia = Date.now() - t0;
  if (latencia < 3000) {
    info(`Latencia de red: ~${latencia}ms ✓`);
  } else {
    aviso(`Latencia alta: ~${latencia}ms — el pipeline puede ser lento`);
  }

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

export async function cmdDoctor() {
  banner();
  console.log(`  Diagnóstico de ${PRODUCTO}`);
  console.log("");

  let problemas = 0;
  /** Para la sección «Siguiente paso»: si Docker respondió (CA-002-01) */
  let dockerOk = false;

  // Servidor MCP propio: perfil y límites efectivos (solo del entorno del usuario; carga perezosa, sin integraciones)
  try {
    const { resolverPerfil } = await import("../../core/mcp/perfiles.js");
    const { leerLimites, estadoInterruptor } = await import("../../core/mcp/limites.js");
    const p = resolverPerfil({ env: process.env });
    const l = leerLimites(process.env);
    const apagado = estadoInterruptor(process.env);
    if (p.ok) {
      info(`MCP: perfil ${p.perfil} (${p.herramientas.join(", ")}) · ciclo ${apagado.apagado ? "apagado" : "activo"} · ${l.timeout_s} s por llamada, ${l.salida_max_bytes} bytes de salida, ${l.por_hora}/hora, ${l.por_dia}/día ✓`);
    } else {
      aviso(`MCP: perfil no válido en FRAGUA_MCP_PERFIL; ${p.error}`);
      problemas++;
    }
  } catch (e) {
    aviso(`MCP: no se pudo leer el perfil (${e instanceof Error ? e.message : e})`);
  }

  // Node
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  if (nodeMajor >= 20) {
    info(`Node ${process.versions.node} (>=20 requerido) ✓`);
  } else {
    aviso(`Node ${process.versions.node} es < 20. Actualiza Node.`);
    problemas++;
  }

  // Clave del proveedor activo (el detalle y el ping están en el diagnóstico del LLM, más abajo)
  const proveedorActivo = (leerVariable("LLM_PROVIDER") ?? "anthropic").toLowerCase();
  const variablesClave = VARIABLES_DE_CLAVE[proveedorActivo === "claude" ? "anthropic" : proveedorActivo === "gpt" ? "openai" : proveedorActivo] ?? [];
  if (variablesClave.length) {
    const apiKey = variablesClave.map((v) => process.env[v]).find(Boolean);
    if (!apiKey) {
      problemas++;
      aviso(`${variablesClave[0]} no está definida — los agentes LLM no funcionarán con el proveedor ${proveedorActivo}`);
      aviso(`  Solución: export ${variablesClave[0]}=... (o cambia de proveedor con FORGE_LLM_PROVIDER)`);
    } else {
      const preview = apiKey.slice(0, 4) + "..." + apiKey.slice(-4);
      info(`${variablesClave[0]} presente (${preview}) ✓`);
    }
  } else {
    info(`Proveedor ${proveedorActivo}: no usa clave en el entorno ✓`);
  }

  // CLI de Claude Code: solo informativo, Fragua no la necesita para su motor
  if (claudeEnPath()) {
    info("Claude Code CLI detectado en PATH ✓");
  } else {
    info("Claude Code CLI no está en PATH (solo hace falta si lo usas como anfitrión: claude.ai/code)");
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
  const instGuardada = leerInstalacionGuardada();
  const integracionEsClaude = !instGuardada.integracion || resolverIntegracion(instGuardada.integracion).integracion?.nativa === true;
  titulo("Auditoría de instrucciones (límites oficiales de la herramienta)...");
  const claudeMdLocal = join(process.cwd(), ".claude", "CLAUDE.md");
  if (!integracionEsClaude) {
    info("Auditoría de CLAUDE.md omitida: la integración instalada no es Claude Code (sus instrucciones van en AGENTS.md)");
  } else if (existsSync(claudeMdLocal)) {
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

  // ── Integración y perfil instalados (RF-06) ────────────────────────────────
  titulo("Integración y perfil instalados...");
  {
    const g = leerInstalacionGuardada();
    const ri = resolverIntegracion(g.integracion ?? INTEGRACION_POR_DEFECTO);
    const rp = resolverPerfil(g.perfil ?? PERFIL_POR_DEFECTO);
    if (!g.integracion && !g.perfil) {
      info(`Integración: ${INTEGRACION_POR_DEFECTO} · perfil: ${PERFIL_POR_DEFECTO} (sin configuración guardada)`);
    } else {
      info(`Integración: ${ri.ok ? ri.integracion.clave : JSON.stringify(g.integracion)} · perfil: ${rp.ok ? rp.perfil : JSON.stringify(g.perfil)}`);
      if (g.carpeta) info(`Carpeta de skills: ${JSON.stringify(g.carpeta)}`);
      if (!ri.ok) { aviso(ri.error); problemas++; }
      if (!rp.ok) { aviso(rp.error); problemas++; }
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
            // Sin shell: una ruta con comillas o metacaracteres no puede inyectar comandos
            execFileSync(process.execPath, ["--check", hookPath], { stdio: "pipe" });
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
  if (!integracionEsClaude) {
    info("CLAUDE.md omitido: la integración instalada no es Claude Code");
  } else if (existsSync(claudeMdProyecto)) {
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
  info("El proveedor de modelos se comprueba más abajo (Anthropic, OpenAI u Ollama, según la configuración)");

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
    // Docker es obligatorio para el ciclo: se comprueba siempre, con o sin sandbox.runtime
    const { diagnosticarDocker } = await import("../../core/sandbox/diagnostico.js");
    const diag = await diagnosticarDocker();
    dockerOk = diag.ok;
    for (const l of diag.lineas) {
      (l.nivel === "info" ? info : aviso)(l.texto);
      if (l.problema) problemas++;
    }
    const { leerConfigCiclo } = await import("../../core/ciclo/config.js");
    const runtime = leerConfigCiclo(process.cwd()).sandbox.runtime;
    /** @type {{ ok: true } | { ok: false, error: string }} */
    let permitido;
    if (!runtime) {
      // Sin mecanismo pedido no hay nada que comprobar aquí: no se consulta a Docker
      info("Mecanismo de aislamiento: el de Docker por defecto (sandbox.runtime sin indicar)");
    } else if ((permitido = (await import("../../core/sandbox/politica.js")).runtimePermitido(runtime)).ok === false) {
      // El runtime lo escribe el archivo del proyecto: sin autorización del usuario el ciclo no empieza
      aviso(`${permitido.error} — el ciclo verificado no empezará (código de salida 4)`);
      problemas++;
    } else {
      // Con uno pedido, se pregunta a Docker si lo conoce: es lo que decidirá si el ciclo empieza
      const { DockerCli } = await import("../../core/sandbox/docker-cli.js");
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

  // ── Integraciones externas: solo si hay alguna activa (carga perezosa; sin sección no se importa nada) ──
  if ((await import("../integraciones-activas.js")).integracionesActivas(process.cwd())) {
    titulo("Verificando integraciones externas...");
    const { ejecutarIntegraciones } = await import("../integraciones.js");
    const extra = process.argv.includes("--integraciones-red") ? ["--red"] : [];
    if (await ejecutarIntegraciones(["doctor", ...extra]) !== 0) problemas++;
  }

  // ── Diagnóstico del LLM ──────────────────────────────────────────────────────
  titulo("Diagnosticando conexión con el LLM...");
  await cmdDoctorLlm({ problemas: (n) => { problemas += n; } });

  console.log("");
  if (problemas === 0) {
    info("Diagnóstico OK — sin problemas críticos.");
  } else {
    aviso(`${problemas} problema(s) detectado(s). Revisa arriba.`);
  }

  // ── Siguiente paso (spec 2026-11-09-puerta-de-entrada-solo-dev, CA-002-01) ──
  titulo("Siguiente paso");
  const { textoSiguientePaso } = await import("../../core/sandbox/diagnostico.js");
  for (const l of textoSiguientePaso({ dockerOk })) console.log(`  ${l}`);
  console.log("");
}
