# Anfitriones: qué recibe cada herramienta de código

> Tipo: Referencia · Última revisión: 2026-11-10 · Plan de origen: [PLAN-AGNOSTICO.md](PLAN-AGNOSTICO.md)

Un **anfitrión** es la herramienta de código donde se usa Fragua (Claude Code, Codex, Cursor…). El motor (`fragua run`, `resume`, `verificar`, el servidor MCP) no depende de ninguno. Lo que cambia entre anfitriones es la capa de metodología: comandos, agentes y guardián.

Esta página describe solo lo que el código hace hoy. Dos palabras de estado:

- **Confirmado en doc**: la carpeta de skills de esa herramienta figura en su documentación oficial (fecha y URL en [herramientas-destino.js](../core/instalacion/herramientas-destino.js) y en el spike `.sdd/especificaciones/2026-10-13-instalacion-agnostica/spikes/carpetas-de-skills.md`).
- **Sin probar**: nadie ha instalado Fragua en esa herramienta y comprobado que invoca una skill. **Ninguna herramienta está «probada»**: la prueba manual por herramienta (tarea F4.2 de esa especificación y fase F5 del plan) sigue pendiente.

## Qué se instala según la integración

`fragua init --integracion <clave>` elige el anfitrión. Sin la opción, la clave es `claude`.

| Pieza | `claude` (nativa) | Resto de claves |
|---|---|---|
| Skills propias (31) | Sí, en `.claude/skills` | Sí, adaptadas (sin `allowed-tools`, sin «Claude Code» en el texto, con nota de equivalencias) |
| Comandos | Sí, `.claude/commands` (formato de Claude Code) | Como skills `sdd-*`, con las órdenes `/sdd.x` reescritas a la forma de invocar de esa herramienta; solo los del perfil elegido |
| Agentes | Sí, `.claude/agents` (subagentes) | Como **roles**: una skill `rol-<agente>` por agente (14), que se carga y se ejecuta en la misma conversación |
| Agentes nativos del anfitrión | No aplica | Sí, en el formato de Copilot, Cursor, Codex, Gemini CLI, opencode y Kiro (14 agentes). No en Windsurf, Zed, Goose, la carpeta común ni la genérica: su formato no está confirmado. Los de solo lectura, salvo `revisor` e `investigador`, no reciben terminal. **Sin probar en la herramienta real** |
| Hooks: guardián | Sí, `PreToolUse` | **Solo con `--con-hooks`**, en Cursor, Copilot, Gemini CLI, Codex, Windsurf y opencode (ver la matriz). **Consultivo, no impuesto, mientras la herramienta falle abierto (Gemini, Codex, Windsurf) o no se haya probado en real.** Kiro, Zed, Goose y las demás: sin adaptador. Sin `--con-hooks`, no instalado |
| Hooks: memoria de agentes y convenciones | Sí, `PostToolUse` | **Solo con `--con-hooks`**, y solo la memoria (no las convenciones), en Cursor, Copilot, Gemini, Codex y Windsurf. opencode no tiene. Nunca bloquea |
| `settings.json`, `CLAUDE.md` | Sí | No |
| `AGENTS.md` | Sí | Sí |

Consecuencias en un anfitrión que no es Claude Code, dichas sin adornos:

- **El guardián no se impone por defecto.** Sin `--con-hooks`, las reglas de `AGENTS.md` se piden al modelo y nada las hace cumplir. Con `--con-hooks` hay un hook en seis herramientas, pero ninguna está probada en real y Gemini, Codex y Windsurf fallan abierto: se lee como consultivo. La defensa que sí vale en cualquier anfitrión es el aislamiento del ciclo verificado (`fragua run`, `fragua verificar`) y el servidor MCP con perfil `verificacion`.
- **La delegación entre agentes pierde el subagente.** Donde un comando dice `Task("agente", …)`, la nota de anfitrión pide cargar la skill del rol y trabajar en la misma conversación; lo paralelo pasa a secuencial. No hay aislamiento de contexto entre roles.
- **La memoria por agente solo se registra sola con `--con-hooks`** (Cursor, Copilot, Gemini, Codex, Windsurf). En los roles se sustituyó la frase del hook por una instrucción de anotar decisiones en `.sdd/memoria/`.
- **Un agente de solo lectura puede escribir por la terminal si conserva el shell y la herramienta no tiene hook.** En los formatos nativos solo `revisor` e `investigador` lo conservan (ejecutan pruebas y consultan versiones); los roles `rol-*` corren en la conversación principal y no tienen esa restricción. Nada de esto es un límite impuesto sin el guardián.
- **La adaptación es textual** (`core/instalacion/adaptar-anfitrion.js`, aplicada al instalar). Las fuentes de `commands/`, `agents/` y `skills/` no cambian, y lo que recibe Claude Code tampoco.

## Matriz por herramienta

| Herramienta (clave) | Carpeta de skills | Skills, comandos adaptados y roles instalados | Agentes nativos | Guardián y memoria | Estado |
|---|---|---|---|---|---|
| Claude Code (`claude`) | `.claude/skills` | Sí (más comandos y agentes en formato nativo) | Sí | Sí, por hooks | Confirmado en doc (2026-10-14); es el camino de siempre |
| Codex CLI (`codex`) | `.agents/skills` | Sí | Sí (TOML) | Con `--con-hooks`: guardián y memoria en `.codex/hooks.json` (falla abierto; el proyecto debe ser de confianza) | Carpeta y hook leídos en doc; sin probar |
| Carpeta común (`agents`) | `.agents/skills` | Sí | No | No | Carpeta confirmada en doc (Codex y otras la leen); sin probar |
| GitHub Copilot (`copilot`) | `.github/skills` | Sí | Sí | Con `--con-hooks`: guardián y memoria en `.github/hooks/fragua-guardian.json` (falla cerrado ante error; usa `bash`/`powershell`, no `command`) | Carpeta y hook leídos en doc; sin probar |
| Cursor (`cursor`) | `.cursor/skills` | Sí | Sí | Con `--con-hooks`: guardián y memoria en `.cursor/hooks.json` (`failClosed` en el guardián) | Carpeta y hook leídos en doc; sin probar |
| Gemini CLI (`gemini`) | `.gemini/skills` | Sí | Sí (14) | Con `--con-hooks`: guardián y memoria en `.gemini/settings.json` (falla abierto; si el archivo existe no se toca) | Carpeta, hook y herramientas leídos en doc; sin probar |
| Windsurf (`windsurf`) | `.devin/skills` | Sí | No | Con `--con-hooks`: guardián en `.devin/hooks.v1.json` (falla abierto) que evalúa terminal, lectura, escritura, edición y parches, y memoria tras escribir o editar. Solo la terminal tiene claves de entrada documentadas: en las de archivo la ruta se busca por heurística y, si usan otra clave, la acción pasa sin evaluar | Carpeta y hook leídos en doc; sin probar |
| opencode (`opencode`) | `.opencode/skills` | Sí | Sí | Con `--con-hooks`: plugin `.opencode/plugins/fragua-guardian.js` (falla cerrado) que evalúa `read`, `edit`, `write`, `patch` y `shell`. **Sin confirmar:** la forma del evento de `tool.execute.before` y que un plugin pueda lanzar un proceso externo; si fallan, el plugin bloquea toda herramienta. Sin memoria | Carpeta y herramientas leídas en doc; plugin sin probar |
| Kiro (`kiro`) | `.kiro/skills` | Sí | Sí (JSON) | **Sin adaptador:** la documentación da el formato del archivo de hooks y los campos de entrada, pero no los nombres de las herramientas integradas ni qué código bloquea en `PreToolUse`; un guardián ahí dejaría pasar todo sin avisar | Carpeta confirmada en doc; sin probar |
| Zed (`zed`) | `.agents/skills` | Sí | No | No (sin hooks ni agentes confirmados) | Carpeta confirmada en doc (2026-11-11); sin probar |
| Goose (`goose`) | `.agents/skills` | Sí | No | No (sin hooks ni agentes confirmados) | Carpeta confirmada en doc (2026-11-11); sin probar |
| Genérica (`generica`) | la que pases con `--carpeta-skills` | Sí | No | No | Sin probar |

Codex, Zed y Goose tienen clave propia y comparten carpeta (`.agents/skills`) con la clave `agents`. Ninguna de las páginas de Zed y Goose menciona `AGENTS.md`.

## Cómo se invoca cada skill

La forma de invocar sale de la tabla de integraciones y se usa al reescribir las órdenes `/sdd.x`:

| Herramienta | Prefijo usado en el texto adaptado | Ejemplo para `sdd.planificar` |
|---|---|---|
| Cursor, Copilot, Kiro | `/` | `/sdd-planificar` |
| Carpeta común (Codex) | `$` | `$sdd-planificar` |
| Windsurf | `@` | `@sdd-planificar` |
| Gemini CLI, opencode, genérica | sin prefijo | «la skill `sdd-planificar`» |

En Claude Code los comandos conservan su nombre con punto (`/sdd.planificar`).

## Lo que está en curso

- **Guardián y memoria fuera de Claude Code:** hechos con `--con-hooks` ([contrato](contrato/evento-herramienta.md), `fragua guardian evaluar --anfitrion <x>`, `fragua memoria registrar --anfitrion <x>`, perfil MCP `guardian`). **Sin probar en una instalación real de ninguna.** Pendiente por falta de documentación: Kiro, y la forma exacta del evento y el proceso externo en opencode.
- **Evaluación independiente:** [informes/EVALUACION-AGNOSTICISMO.md](informes/EVALUACION-AGNOSTICISMO.md) (veredicto «parcialmente»). Es una fotografía de un momento: varios hallazgos se corrigieron después.
- **Prueba manual por herramienta** (fase F5): pendiente; hasta entonces ninguna fila de la matriz dirá «probado».

## Dónde mirar

- Qué hace cada hook de Claude Code: [hooks.md](hooks.md) y [COMPATIBILIDAD.md](COMPATIBILIDAD.md).
- Garantías y límites del guardián: [GARANTIAS-Y-LIMITES.md](GARANTIAS-Y-LIMITES.md).
- Tabla de integraciones: [core/instalacion/herramientas-destino.js](../core/instalacion/herramientas-destino.js).
