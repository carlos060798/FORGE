# Contrato de los hooks con Claude Code

> Tipo: Referencia
> Última revisión: 2026-11-10 contra el commit 55a9dd9

Qué espera Fragua de Claude Code en sus hooks, comprobado contra `claude-hooks/` y `tests/hooks-contract.test.js`. Qué hace cada hook: [hooks.md](hooks.md). Qué recibe otra herramienta: [RELACION-CON-CLAUDE-CODE.md](RELACION-CON-CLAUDE-CODE.md).

## Versión de Claude Code

**No verificado.** No hay una versión de Claude Code fijada ni probada: la tabla «CLI ≥ 1.0, verificado 2026-06-21» de la versión anterior no tenía respaldo en el código y se retiró. Fragua no comprueba la versión de Claude Code al ejecutarse. El protocolo de hooks es el de la documentación de Claude Code, que puede cambiar.

## Node

`package.json` declara `"engines": { "node": ">=20.0.0" }`. Los `.sh` de los hooks buscan Node 20 o superior; sin él, `pre-tool-guard.sh` bloquea con código 2 en vez de dejar pasar (ver [hooks.md](hooks.md)). La suite completa se ejecutó en Node 24 (Windows 11) y la CI de Windows usa Node 22 ([ESTADO-ACTUAL.md](ESTADO-ACTUAL.md)). Node 20 no figura como probado en esas fuentes: no verificado.

## Eventos que usa

Los registra el `settings.json` (ver «Qué registra cada `settings.json`» en [hooks.md](hooks.md)):

| Evento | Hooks | Filtro |
|---|---|---|
| `PreToolUse` | `pre-tool-guard.js` | Ninguno (todas las herramientas) |
| `PostToolUse` | `agent-memory.js`, `post-write-conventions.js` | `Write\|Edit` |
| `PostToolUse` | `ast-indexer.js` (solo el `settings.json` de este repositorio) | `Write\|Edit` |
| `PostToolUse` | `context-manager.js` (solo la plantilla que instala el plugin) | Ninguno |

No usa otros eventos de Claude Code (`SessionStart`, `Stop`, etc.): no aparecen en ningún `settings.json` del repositorio.

## Entrada: JSON por stdin

Campos que los hooks leen realmente:

| Campo | Quién lo lee | Notas |
|---|---|---|
| `tool_name` | los hooks de arriba | `pre-tool-guard.js` inspecciona `Write`, `Edit`, `MultiEdit`, `NotebookEdit`, `Read`, `Bash`, `PowerShell` |
| `tool_input.file_path` o `tool_input.path` | guardián, `agent-memory.js`, `post-write-conventions.js` | el guardián también lee `notebook_path` |
| `tool_input.content` / `new_string` | guardián, `agent-memory.js` | contenido propuesto o escrito |
| `tool_input.command` | guardián | para `Bash` y `PowerShell` |
| `tool_response.file_path` | solo `post-write-conventions.js` | como último recurso para hallar la ruta |

`agent-memory.js` no lee `tool_response`: la versión anterior de este documento decía que sí.

Si el evento no es un objeto, el guardián bloquea.

## Códigos de salida

| Código | Efecto | Dónde se emite |
|---|---|---|
| `0` | Permite / continúa | todos |
| `2` | Bloquea; el mensaje de stderr se muestra | `pre-tool-guard.js` (varios puntos, incluido `fallarCerrado`); `post-write-conventions.js` sale con `2` si hay errores (`claude-hooks/post-write-conventions.js:411`) |

En `PostToolUse` la herramienta ya se ejecutó, así que el `2` solo informa al agente. `agent-memory.js` termina con `0` incluso si falla (`main(...).catch(() => process.exit(0))`). Qué hace Claude Code exactamente con otros códigos: no verificado aquí.

## Variables de entorno

| Variable | La lee | Para qué |
|---|---|---|
| `CLAUDE_AGENT_NAME` | `pre-tool-guard.js`, `agent-memory.js` | Identidad del agente. Sin ella, el guardián avisa y las reglas por agente (agentes de solo lectura) no actúan |
| `FORGE_EDITAR_GUARDIAN` | `pre-tool-guard.js` | `1` permite editar los archivos del guardián; la fija el dueño, no un agente |

Que Claude Code entregue `CLAUDE_AGENT_NAME` a los hooks en todas sus versiones: no verificado (el propio guardián emite un aviso para ese caso).

Las demás variables `FORGE_*` y `FRAGUA_*` son del motor, no de Claude Code.

## Qué comprueba la prueba de contrato

`tests/hooks-contract.test.js` valida con ejemplos fijos que el evento tiene `tool_name` y `tool_input` (y `tool_response` en `PostToolUse`) y detecta si esos campos se renombran o desaparecen. **No** ejecuta Claude Code, así que no detecta que un hook haya dejado de invocarse.

Si Claude Code dejara de invocar `PreToolUse`, el guardián dejaría de actuar sin avisar, y la memoria y las convenciones dejarían de actualizarse. `fragua doctor` comprueba que los archivos de hook existan, tengan sintaxis válida y estén registrados en `settings.json`; no comprueba que Claude Code los invoque.

## Si cambia el formato

1. Mira el evento real (añade temporalmente `process.stderr.write(raw)` en el hook).
2. Actualiza los ejemplos de `tests/hooks-contract.test.js` y las tablas de arriba.
3. Ejecuta `npm test` y `fragua doctor`.
