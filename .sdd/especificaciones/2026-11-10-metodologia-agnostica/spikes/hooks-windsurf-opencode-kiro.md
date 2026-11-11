# Spike: hooks previos/posteriores a herramienta en Windsurf, opencode y Kiro

Fecha de consulta de todos los datos: 2026-11-11. Fuentes: solo documentación oficial.

**Cautela:** WebFetch devuelve un resumen generado por un modelo pequeño, no el texto íntegro. Cada dato debe verificarse leyendo la página original antes de construir sobre él. Donde dice "no documentado" significa que el resumen no lo mostró, no necesariamente que la documentación no lo contenga. Los datos marcados (búsqueda) vienen de un resumen de WebSearch y son de confianza menor.

## 1. Windsurf (Cascade hooks) / Devin

Windsurf migró a "Devin Desktop"; docs.windsurf.com redirige (307) a docs.devin.ai. Según la búsqueda, un changelog indica que Cascade fue retirado y que Devin Local es el único agente; existe un comando de migración de hooks de Windsurf a hooks de Devin. Hay por tanto dos esquemas: el legado Cascade y el de Devin.

| Aspecto | Dato | URL / fecha |
|---|---|---|
| Config proyecto (Devin) | `.devin/hooks.v1.json` (archivo recomendado, el objeto de hooks es todo el archivo). También clave `"hooks"` en `.devin/config.json`, `.devin/config.local.json`, `.claude/settings.json`, `.claude/settings.local.json`. Se descubren en el directorio de trabajo y ancestros hasta la raíz del repo | https://docs.devin.ai/cli/extensibility/hooks/overview , 2026-11-11 |
| Config usuario (Devin) | `~/.config/devin/config.json` (`%APPDATA%\devin\config.json` en Windows), `~/.claude.json`, `~/.claude/settings.json`, `~/.claude/settings.local.json`. Nivel sistema: no documentado | idem |
| Config proyecto (Cascade legado) | No confirmado. Búsqueda: JSON con clave `hooks` y por evento `command` y `show_output` opcional; la ruta `.windsurf/hooks.json` no se pudo confirmar | https://docs.devin.ai/desktop/cascade/hooks (búsqueda), 2026-11-11 |
| Eventos (Devin) | `PreToolUse`, `PostToolUse`, `PermissionRequest`, `UserPromptSubmit`, `Stop`, `PostCompaction`, `SessionStart`, `SessionEnd` (no se dispara en sesiones cloud) | docs.devin.ai/cli/extensibility/hooks/overview , 2026-11-11 |
| Eventos (Cascade legado) | Previos que pueden bloquear: `pre_user_prompt`, `pre_read_code`, `pre_write_code`, `pre_run_command`, `pre_mcp_tool_use`. Los post no bloquean (nombres de los post no verificados) | https://docs.devin.ai/desktop/cascade/hooks (búsqueda), 2026-11-11 |
| Ejemplo hook previo (Devin) | Ver bloque abajo. Campos: `matcher` (regex sobre `tool_name`, vacío = todos), `type` `"command"` o `"prompt"`, `command`, `timeout` opcional | overview, 2026-11-11 |
| Entrada stdin (Devin) | `{"hook_event_name":"PreToolUse","tool_name":"exec","tool_input":{"command":"rm -rf /"},"session_id":"3f8d1c2a-...","prompt_id":"b71e9d40-..."}`. Esquemas de otros eventos: página Lifecycle Hooks, no consultada | overview, 2026-11-11 |
| Entrada (Cascade legado) | No documentado en lo consultado | - |
| Bloqueo (Devin) | Exit `0` continúa; exit `2` bloquea; otro código = error registrado, NO bloquea. También JSON en stdout: `decision` `"approve"` o `"block"` con `reason` opcional; `hookSpecificOutput.updatedInput` (PreToolUse) fusiona argumentos; `hookSpecificOutput.additionalContext` | overview, 2026-11-11 |
| Bloqueo (Cascade legado) | Exit 2 en un pre-hook bloquea y el agente ve stderr (búsqueda) | https://docs.devin.ai/desktop/cascade/hooks (búsqueda), 2026-11-11 |
| Fallo / timeout | Timeout o salida ilegible = error registrado, no bloquea (fail-open). `timeout` en segundos, valor por defecto no documentado. Fallo al arrancar el comando: no documentado | overview, 2026-11-11 |
| Otros | Los hooks no se cargan ni ejecutan con el workspace en Restricted Mode | https://docs.devin.ai/desktop/cascade/hooks , 2026-11-11 |

```json
{
  "PreToolUse": [
    { "matcher": "exec",
      "hooks": [ { "type": "command", "command": "./scripts/validate.sh", "timeout": 10 } ] }
  ]
}
```

## 2. opencode

La documentación actual (V2) y la anterior (V1) difieren. Los hooks se escriben en código (plugin TypeScript/JS), no hay hooks por comando de shell con stdin.

| Aspecto | Dato | URL / fecha |
|---|---|---|
| Config proyecto | Archivos `.ts`/`.js` y paquetes en `.opencode/plugins/`; o array `plugins` en `opencode.json(c)` (rutas relativas al archivo de config, deben ser directorios). Un directorio `plugins/` junto a `opencode.json` en la raíz NO se autodescubre | https://opencode.ai/docs/plugins/ , 2026-11-11 |
| Eventos V2 | `ctx.tool.hook("execute.before", cb)` y `ctx.tool.hook("execute.after", cb)` dentro de `Plugin.define({ id, async setup(ctx){...} })` | https://opencode.ai/docs/build/plugins/server/ , 2026-11-11 |
| Eventos V1 | Claves `"tool.execute.before"` y `"tool.execute.after"` del objeto devuelto por la función plugin | https://opencode.ai/docs/build/plugins/migrate-v1/ , 2026-11-11 |
| API V2 | `before`: evento mutable con `event.tool` y `event.input` ("inspeccionar o reemplazar la entrada"). `after`: `event.status` (`"completed"` o `"error"`), `event.result`, `event.error.message`. Tipo completo de `ToolExecuteBefore`: no documentado | server, 2026-11-11 |
| API V1 | `before` recibe `(input, output)`: `input.tool`, `output.args`. `after`: no documentado | migrate-v1, 2026-11-11 |
| Bloqueo | V1: `throw new Error("Do not read .env files")` dentro de `tool.execute.before`. V2: lanzar dentro del callback (ejemplo en migrate-v1) o, en la API Effect, `Effect.fail(new Tool.Error({ message: "Writes are disabled" }))` ("los before hooks pueden reemplazar la entrada o fallar con Tool.Error"). Búsqueda: el rechazo lleva el motivo, el modelo lo ve y continúa (no verificado en página). Cómo se muestra el rechazo: no confirmado | https://opencode.ai/docs/build/plugins/effect/ , 2026-11-11 |
| Fallo / timeout | Errores distintos de `Tool.Error`: no documentado. Timeouts de hooks: no documentado. Errores en `execute.after`: no documentado | effect, migrate-v1, 2026-11-11 |
| Alternativa nativa | Reglas de permisos (`deny` para `*.env`) sin plugin | https://opencode.ai/docs/permissions/ (búsqueda), 2026-11-11 |
| Nota | Para `apply_patch` comprobar `input.tool === "apply_patch"`, no `"patch"` | https://opencode.ai/docs/tools/ (búsqueda), 2026-11-11 |

Ejemplo V2 (adaptado del ejemplo de `execute.before`; el bloqueo por `throw` procede del ejemplo de migrate-v1):

```ts
await ctx.tool.hook("execute.before", (event) => {
  if (event.tool === "read" && (event.input as { filePath?: string }).filePath?.includes(".env"))
    throw new Error("Do not read .env files")
})
```

Ejemplo V1: `"tool.execute.before": async (input, output) => { if (input.tool === "read" && output.args.filePath.includes(".env")) throw new Error("Do not read .env files") }` (forma reconstruida a partir de la descripción del resumen; verificar en la página).

## 3. Kiro (IDE y CLI)

Las páginas `kiro.dev/docs/cli/hooks/` y `.../cli/custom-agents/configuration-reference/` solo dicen "esta página se movió" a `/docs/hooks/` y `/docs/custom-agents/configuration-reference/`.

| Aspecto | Dato | URL / fecha |
|---|---|---|
| Config proyecto | `.kiro/hooks/<id>.json` (cualquier nombre `.json`); global `~/.kiro/hooks/` (CLI V3). Hooks en línea en perfiles de agente: `.kiro/agents/` (global `~/.kiro/agents/`) | https://kiro.dev/docs/hooks/ y https://kiro.dev/docs/custom-agents/configuration-reference/ , 2026-11-11 |
| Formato | JSON con `version` (`"v1"`) y array `hooks`. Cada hook: `name`, `trigger` (PascalCase), `matcher` opcional, `action` (`type` `"command"` con `command`, o `"agent"` con `prompt`), opcionales `description`, `timeout`, `enabled`, `confirm` | https://kiro.dev/docs/hooks/ , 2026-11-11 |
| Eventos | `PreToolUse`, `PostToolUse`, además de Prompt Submit, Agent Stop (`Stop`), Session Start, Agent Spawn, Session End (solo CLI V3), Pre/Post Compaction, File Create/Save/Delete, Pre/Post Task Execution, Manual. Nombres camelCase heredados de CLI 2.x: `agentSpawn`, `preToolUse`, `postToolUse`. La disponibilidad varía por superficie | https://kiro.dev/docs/hooks/types/ , 2026-11-11 |
| Matcher | ID exacto de herramienta, categoría (`read`, `write`, `shell`, `web`, `spec`), selectores `@mcp`, `@powers`, `@builtin`, `@<server>`, `@<server>/<tool>`, regex, comodines `*` y `?` (solo en JSON); vacío = todas. Herramientas MCP: `mcp_<server>_<tool>` | types, 2026-11-11 |
| Entrada stdin | "Contexto de sesión como JSON en STDIN". Ejemplo PreToolUse: `hook_event_name`, `cwd`, `session_id`, `tool_name`, `tool_input`. Esquema completo: no documentado | types y hooks, 2026-11-11 |
| Bloqueo | Acción de comando: cualquier código de salida distinto de 0 bloquea en PreToolUse (y en Prompt Submit del IDE); stderr se envía al agente. Con exit 0, stdout se añade al contexto del agente. En Pre Compaction, exit 2 cancela. Prompt Submit del CLI no puede bloquear. Salida JSON de decisión: no documentado | https://kiro.dev/docs/hooks/actions/ y types, 2026-11-11 |
| Fallo / timeout | Timeout por defecto 60 s, `0` lo desactiva. Qué ocurre al expirar: no documentado. Fallos distintos de código distinto de 0 (comando inexistente, caída): no documentado. `timeout_ms` y `cache_ttl` de agentes: no documentado (un ejemplo usa `"timeout": 10` sin unidad) | actions y configuration-reference, 2026-11-11 |

Ejemplo (el de la documentación es PostFileSave; el siguiente es PreToolUse con la misma forma y el bloqueo por código distinto de 0 descrito arriba; el script es ilustrativo y no figura en la documentación):

```json
{
  "version": "v1",
  "hooks": [{
    "name": "Guardian shell",
    "trigger": "PreToolUse",
    "matcher": "shell",
    "action": { "type": "command", "command": "./scripts/guardian.sh" }
  }]
}
```

## 4. Resumen para el guardián bloqueante

- Windsurf/Devin: SI admite guardián; PreToolUse con exit 2 o JSON `decision: block`; fail-open ante timeout o error.
- opencode: SI admite guardián, pero por plugin en código (`throw` en `tool.execute.before`); sin stdin ni exit code; fallos y timeouts no documentados.
- Kiro: SI admite guardián; PreToolUse con exit distinto de 0 bloquea; semántica de timeout y esquema stdin sin documentar.
- Ninguna de las tres documenta de forma completa el comportamiento ante timeout; hay que probarlo empíricamente.
- Los post-hooks (PostToolUse, `execute.after`) no bloquean en ninguna: solo observan o añaden contexto.
- Las rutas de configuración y los nombres de evento difieren por herramienta, así que el guardián necesita un adaptador por herramienta.
