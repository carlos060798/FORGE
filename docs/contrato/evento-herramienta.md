# Contrato de evento de herramienta (guardián y memoria)

> Versión del contrato: 1 · Plan: [PLAN-AGNOSTICO.md](../PLAN-AGNOSTICO.md), F3 · Estado: implementado para la CLI y para Cursor, Copilot, Gemini y Codex (`--anfitrion`); esquemas leídos de la documentación oficial el 2026-11-10 (spike S0.2), **sin probar en una instalación real**.

Una herramienta de código que quiera usar el guardián o la memoria de Fragua traduce su evento a este JSON y lo pasa por la entrada estándar.

```
fragua guardian evaluar    # antes de ejecutar una herramienta (equivale a PreToolUse)
fragua memoria registrar   # después de ejecutarla (equivale a PostToolUse, tras Write/Edit)
```

## Evento

```json
{ "tool_name": "Write", "tool_input": { "file_path": "src/a.js", "content": "..." }, "tool_response": "ok" }
```

| Campo | Tipo | Uso |
|---|---|---|
| `tool_name` | string | `Write`, `Edit`, `MultiEdit`, `NotebookEdit`, `Read`, `Bash`, `PowerShell` |
| `tool_input` | objeto | `file_path` o `path` (escritura y lectura), `content` (Write), `command` (Bash) |
| `tool_response` | string u objeto | solo para `memoria registrar` |

Los nombres de herramienta son los de Claude Code. Una herramienta con otros nombres debe traducirlos antes de llamar.

## Identidad del agente

`FRAGUA_AGENTE` (o `FORGE_AGENTE`); si no hay, `CLAUDE_AGENT_NAME`. Si las dos formas tienen valores distintos no se elige ninguna y no hay identidad. Sin identidad, las guardas de agentes de solo lectura quedan **desactivadas** y el guardián lo avisa.

## Códigos de salida (son contrato)

| Código | Significado |
|---|---|
| 0 | permitir |
| 2 | bloquear; el motivo va por la salida de error. También si el evento no es JSON o está vacío, si `--anfitrion` no se reconoce, o si el guardián no puede ejecutarse (falla cerrado en todos los casos) |
| 1 | uso incorrecto: subcomando desconocido (no es una evaluación). `fragua memoria registrar` no es una barrera y devuelve 1 ante un evento que no es JSON |

## Otras herramientas (`--anfitrion`)

`fragua guardian evaluar --anfitrion cursor|copilot|gemini|codex` recibe el evento propio de la herramienta y lo traduce a este contrato (`core/instalacion/hooks-anfitrion.js`). Un parche `apply_patch` de Codex se evalúa como una escritura por cada archivo que toca. Dentro de un anfitrión conocido, una *herramienta* que no se reconoce pasa tal cual y el guardián no tiene reglas para ella (hueco conocido). Un *anfitrión* que no se reconoce no se evalúa «sin reglas»: falla cerrado (código 2). Si el evento no es JSON, falla cerrado (código 2).

## Alcance honesto

- Es **la misma lógica** que los hooks de Claude Code: la orden ejecuta `claude-hooks/pre-tool-guard.js` y `agent-memory.js`. No hay reglas duplicadas.
- Solo es **impuesto** si la herramienta llama a la orden en un hook que pueda bloquear. Llamada a mano o desde un modelo, es **consultivo**.
- Requiere Node 20 o superior.
- No existe herramienta MCP `guardian_evaluar`: el perfil `verificacion` del servidor MCP expone únicamente `verificar` y se mantiene así.
