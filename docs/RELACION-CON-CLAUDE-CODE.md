# Relación con Claude Code

> Tipo: Explicación
> Última revisión: 2026-11-10 contra el commit 55a9dd9

Qué usa Fragua de Claude Code, qué no, y qué funciona sin él. Detalle por herramienta: [ANFITRIONES.md](ANFITRIONES.md). El plan de volver el resto agnóstico es una propuesta sin aprobar ([PLAN-AGNOSTICO.md](PLAN-AGNOSTICO.md)); este documento describe solo lo que el código hace hoy.

## Dos capas

- **Motor** (`core/`, `cli/`): ciclo verificado, aislamiento, proveedores de modelo, servidor MCP, API local. No depende de Claude Code. Admite los proveedores Anthropic, OpenAI y Ollama, y uno simulado para pruebas.
- **Metodología** (`commands/`, `agents/`, `skills/`, `claude-hooks/`): escrita para Claude Code.

## Primitivas de Claude Code que usa

| Primitiva | Uso en Fragua | Dónde |
|---|---|---|
| Comandos (slash) | 39 comandos `/sdd.*` | `commands/`, instalados en `.claude/commands` |
| Subagentes | 14 agentes con cabecera propia de Claude Code | `agents/`, instalados en `.claude/agents`; los comandos los invocan con `Task` |
| Hooks `PreToolUse` y `PostToolUse` | Guardián, memoria de agentes, convenciones | `claude-hooks/`; contrato en [COMPATIBILIDAD.md](COMPATIBILIDAD.md) |
| Skills | 31 skills propias (formato `SKILL.md`) | `skills/`, instaladas en `.claude/skills` |
| `CLAUDE.md` y `settings.json` | Se instalan en el proyecto | `forge init` ([ANFITRIONES.md](ANFITRIONES.md)) |
| Servidores MCP del plugin | `playwright` y `github` declarados para Claude Code | `.mcp.json`, referenciado por `.claude-plugin/plugin.json` |

## Qué no usa

- Otros eventos de hook además de `PreToolUse` y `PostToolUse` ([COMPATIBILIDAD.md](COMPATIBILIDAD.md)).
- Ningún formato de agente de otra herramienta: no se genera ninguno (sin confirmar).
- Claude Code no ejecuta el ciclo verificado: `fragua run` es el motor de Fragua, que llama al modelo por su cuenta.

## Qué recibe otra herramienta

Con `fragua init --integracion <clave>` distinta de `claude` (tabla en `core/instalacion/herramientas-destino.js`): las skills propias adaptadas, los comandos convertidos en skills `sdd-*`, los 14 agentes como skills de rol `rol-*` y `AGENTS.md`. **No** recibe guardián, memoria de agentes, validación de convenciones, `settings.json` ni `CLAUDE.md`, ni subagentes: lo que un comando delega con `Task` pasa a hacerse en la misma conversación. Ninguna de esas herramientas está probada en uso real (estado «Confirmado en doc; sin probar» en [ANFITRIONES.md](ANFITRIONES.md)).

## Qué funciona sin Claude Code

| Capacidad | Cómo | Estado |
|---|---|---|
| Ciclo verificado | `fragua run`, `fragua resume`; aislamiento Docker | Docker real probado solo en Windows ([SEGURIDAD-PARA-NOTECNICOS.md](SEGURIDAD-PARA-NOTECNICOS.md)) |
| Veredicto de pruebas sin modelo | `fragua verificar` | Igual |
| Servidor MCP | `fragua mcp` con `--perfil completo` o `--perfil verificacion` ([mcp-verificar.md](mcp-verificar.md), [servidor-mcp.md](servidor-mcp.md)) | Cómo lo consume cada cliente MCP real: no verificado |
| CLI de gestión | `init`, `doctor`, `config`, `status`, `export`, `import`… | Ver `fragua help` |

Lo que no existe fuera de Claude Code es el guardián como hook. Sus reglas viven en `core/evidencia/` y el motor aplica otros controles propios (aislamiento, perfiles, estado sellado), pero el filtro de órdenes en otra herramienta existe solo como orden (`fragua guardian evaluar`) y como plantilla de hook opcional (`--con-hooks`) para Cursor, Copilot, Gemini y Codex: sin probar en una herramienta real y consultivo donde la herramienta falla abierto (spec `2026-11-11-guardian-fuera-de-claude-code`, en borrador).
