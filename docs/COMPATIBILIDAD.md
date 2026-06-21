# FORGE — Compatibilidad con Claude Code

## Versión de Claude Code verificada

| Versión Claude Code | Estado | Fecha verificación |
|---|---|---|
| CLI ≥ 1.0 (any) | ✅ Verificado | 2026-06-21 |

## Schema de hooks de Claude Code

FORGE usa dos hooks del sistema de Claude Code. El schema de sus payloads está documentado aquí como contrato formal. Si el test `tests/hooks-contract.test.js` falla, es porque Claude Code cambió el formato.

### PreToolUse

Recibido por `claude-hooks/pre-tool-guard.js` via stdin como JSON:

```json
{
  "tool_name": "Write",
  "tool_input": {
    "path": "/workspace/src/index.js",
    "content": "..."
  }
}
```

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `tool_name` | `string` | ✅ | Nombre de la herramienta que Claude Code va a ejecutar |
| `tool_input` | `object` | ✅ | Argumentos de la herramienta |
| `tool_input.path` | `string` | Para Write/Edit/Read | Ruta del archivo afectado |
| `tool_input.content` | `string` | Para Write | Contenido completo a escribir |
| `tool_input.command` | `string` | Para Bash | Comando a ejecutar |

### PostToolUse

Recibido por `claude-hooks/agent-memory.js` via stdin como JSON:

```json
{
  "tool_name": "Write",
  "tool_input": {
    "path": "/workspace/src/index.js",
    "content": "..."
  },
  "tool_response": "File written successfully"
}
```

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `tool_name` | `string` | ✅ | Nombre de la herramienta que se ejecutó |
| `tool_input` | `object` | ✅ | Argumentos originales de la herramienta |
| `tool_response` | `string \| object \| null` | ✅ | Respuesta de la herramienta (varía según la herramienta) |

## Protocolo de salida de hooks

| Exit code | Significado | Dónde aplica |
|---|---|---|
| `0` | Permitir / continuar normalmente | PreToolUse + PostToolUse |
| `2` | Bloquear (Claude Code muestra stderr al usuario) | Solo PreToolUse |
| Stderr | Mensaje visible en el log de Claude Code | PreToolUse + PostToolUse |

## Cómo actualizar este documento

Si `npm test` falla en `tests/hooks-contract.test.js` después de actualizar Claude Code:

1. Inspeccionar el payload real que llega al hook (añadir `process.stderr.write(raw)` temporalmente)
2. Actualizar los fixtures en `tests/hooks-contract.test.js`
3. Actualizar las tablas de esta sección
4. Actualizar la versión verificada en la tabla superior

## Variables de entorno de Claude Code relevantes

| Variable | Usado en | Descripción |
|---|---|---|
| `CLAUDE_AGENT_NAME` | `agent-memory.js` | Nombre del agente activo en la sesión |

## Notas sobre dependencia de plataforma

FORGE no verifica la versión de Claude Code en tiempo de ejecución. El sistema de hooks (PreToolUse/PostToolUse) es una API no documentada públicamente de Claude Code — FORGE la usa porque es la única forma de implementar guardrails y memoria persistente dentro del ecosistema.

Si Anthropic cambia el sistema de hooks en una versión futura, el impacto potencial es:
- `pre-tool-guard.js` deja de recibir eventos → los guardrails de seguridad no se aplican (silencioso)  
- `agent-memory.js` deja de recibir eventos → la memoria y el ledger no se actualizan (silencioso)

El test `tests/hooks-contract.test.js` detecta cambios en el schema pero no puede detectar si los hooks dejaron de invocarse. Para verificación completa: ejecutar `forge doctor` después de actualizar Claude Code.
