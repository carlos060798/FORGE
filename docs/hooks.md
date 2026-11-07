# Hooks de Fragua

Los 8 archivos `.js` de [claude-hooks/](../claude-hooks/) (verificado por conteo directo, 2026-11). Solo algunos son **hooks** que Claude Code dispara; otros son herramientas de consulta que invocan los agentes.

| Archivo | Tipo | Función | Versión `.sh` |
|---|---|---|---|
| `pre-tool-guard.js` | Hook `PreToolUse` | Guardián: bloquea herramientas, rutas y comandos prohibidos antes de cada llamada | Sí, **solo delega en Node** |
| `agent-memory.js` | Hook `PostToolUse` | Registra decisiones y memoria de agentes | Sí, delega en Node |
| `post-write-conventions.js` | Hook `PostToolUse` (`Write\|Edit`) | Comprueba convenciones tras escribir | Sí, delega en Node |
| `ast-indexer.js` | Hook `PostToolUse` (`Write\|Edit`) | Índice de símbolos JS/TS | No |
| `context-manager.js` | Hook `PostToolUse` | Gestión de contexto | No |
| `ast-query.js` | Herramienta CLI | Consulta el índice AST | No |
| `query-memory.js` | Herramienta CLI | Consulta la memoria de agentes | No |
| `model-registry.js` | Módulo | Registro de modelos | No |

## Requisito: Node ≥ 20

**No existe un modo «sin Node» con lógica reducida.** Los `.sh` buscan Node ≥ 20 y ejecutan el `.js`. Si no lo hay, `pre-tool-guard.sh` **bloquea la acción (código de salida 2)** en vez de dejarla pasar: el análisis de las órdenes se hace en JavaScript y se decidió no adivinar con `grep` (ver `claude-hooks/pre-tool-guard.sh`, informe SEGURIDAD-CIBER C-07).

Consecuencia práctica: usar Fragua en un proyecto Python, Go o Rust exige tener Node 20+ instalado en la máquina, aunque el proyecto no lo use.

## Qué se registra dónde

Hay dos `settings.json` y **no registran lo mismo**:

| Archivo | Hooks registrados |
|---|---|
| `.claude/settings.json` (este repositorio) | `pre-tool-guard`, `agent-memory`, `post-write-conventions`, `ast-indexer` |
| `.claude-plugin/.claude/settings.json` (lo que instala el plugin) | `pre-tool-guard`, `context-manager`, `agent-memory`, `post-write-conventions` |

Pendiente de decidir: unificar ambos y confirmar con `fragua doctor` cuáles exige (la auditoría contó 4 exigidos).

## Variable `FORGE_EDITAR_GUARDIAN`

Por defecto el guardián **impide** editar `.claude/settings*.json`, `.claude/hooks/**`, `claude-hooks/**`, `.sdd/execution-level.json` y `.git/**`. Si eres el dueño y necesitas modificarlos, lanza Claude Code con `FORGE_EDITAR_GUARDIAN=1` en el entorno. Desactiva solo esa protección (no desbloquea secretos) y solo debe fijarla una persona, nunca un agente. Origen: spec `2026-11-06-guardian-endurecido`; también en [SECURITY.md](../SECURITY.md).

Nota: el guardián lee esta variable directamente de `process.env`, y la prueba `tests/entorno-fragua.test.js` la marca como violación de la regla «las variables se leen por un módulo». La propia prueba define una excepción (`EXCEPCION_GUARDIAN`) para este archivo; si esa prueba falla, hay que alinear prueba y código.
