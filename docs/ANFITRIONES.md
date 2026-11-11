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
| Agentes nativos del anfitrión | No aplica | **No instalados.** Ningún formato de agente de otra herramienta está confirmado ni generado |
| Hooks: guardián | Sí, `PreToolUse` | **No instalado** |
| Hooks: memoria de agentes y convenciones | Sí, `PostToolUse` | **No instalados** |
| `settings.json`, `CLAUDE.md` | Sí | No |
| `AGENTS.md` | Sí | Sí |

Consecuencias en un anfitrión que no es Claude Code, dichas sin adornos:

- **El guardián no se impone.** Las reglas de `AGENTS.md` se piden al modelo; nada las hace cumplir. La defensa que sí vale en cualquier anfitrión es el aislamiento del ciclo verificado (`fragua run`, `fragua verificar`) y el servidor MCP con perfil `verificacion`.
- **La delegación entre agentes pierde el subagente.** Donde un comando dice `Task("agente", …)`, la nota de anfitrión pide cargar la skill del rol y trabajar en la misma conversación; lo paralelo pasa a secuencial. No hay aislamiento de contexto entre roles.
- **La memoria por agente no se registra sola.** El hook que la escribe es de Claude Code; en los roles se sustituyó la frase por una instrucción de anotar decisiones en `.sdd/memoria/`.
- **La adaptación es textual** (`core/instalacion/adaptar-anfitrion.js`, aplicada al instalar). Las fuentes de `commands/`, `agents/` y `skills/` no cambian, y lo que recibe Claude Code tampoco.

## Matriz por herramienta

| Herramienta (clave) | Carpeta de skills | Skills, comandos adaptados y roles instalados | Agentes nativos | Guardián y memoria | Estado |
|---|---|---|---|---|---|
| Claude Code (`claude`) | `.claude/skills` | Sí (más comandos y agentes en formato nativo) | Sí | Sí, por hooks | Confirmado en doc (2026-10-14); es el camino de siempre |
| Codex CLI (`codex`) | `.agents/skills` | Sí | No | Con `--con-hooks`: guardián en `.codex/hooks.json` (falla abierto; el proyecto debe ser de confianza). Memoria: no | Carpeta confirmada en doc; hook leído en doc, sin probar |
| Carpeta común (`agents`) | `.agents/skills` | Sí | No | No | Carpeta confirmada en doc (Codex y otras la leen); sin probar |
| GitHub Copilot (`copilot`) | `.github/skills` | Sí | No | Con `--con-hooks`: guardián en `.github/hooks/fragua-guardian.json` (falla cerrado ante error). Memoria: no | Carpeta y hook leídos en doc; sin probar |
| Cursor (`cursor`) | `.cursor/skills` | Sí | No | Con `--con-hooks`: guardián en `.cursor/hooks.json` (`failClosed`). Memoria: no | Carpeta y hook leídos en doc; sin probar |
| Gemini CLI (`gemini`) | `.gemini/skills` | Sí | No | Con `--con-hooks`: guardián en `.gemini/settings.json` (falla abierto; si el archivo existe no se toca). Memoria: no | Carpeta y hook leídos en doc; nombres de herramienta y de campos sin confirmar; sin probar |
| Windsurf (`windsurf`) | `.devin/skills` | Sí | No | No | Confirmado en doc; sin probar |
| opencode (`opencode`) | `.opencode/skills` | Sí | No | No | Confirmado en doc; sin probar |
| Kiro (`kiro`) | `.kiro/skills` | Sí | No | No | Confirmado en doc; sin probar |
| Genérica (`generica`) | la que pases con `--carpeta-skills` | Sí | No | No | Sin probar |

Codex tiene clave propia (`codex`) y comparte carpeta con `agents`. Zed y Goose no tienen clave: su carpeta no se pudo confirmar.

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

- **Guardián fuera de los hooks de Claude Code** (fase F3): hecho el contrato de evento ([contrato/evento-herramienta.md](contrato/evento-herramienta.md)), la orden `fragua guardian evaluar --anfitrion <x>` y el registro opcional con `forge init --integracion <x> --con-hooks` para Cursor, Copilot, Gemini y Codex. **Sin probar en una instalación real de ninguna.** Límites: Gemini y Codex dejan pasar la acción si el hook se rompe; el guardián solo conoce las herramientas que traduce (lo desconocido pasa); la **memoria** de agentes no tiene adaptador; la vía MCP consultiva no se hizo porque el perfil `verificacion` expone solo `verificar`.
- **Vocabulario neutral de modelos, `doctor` por proveedor y metadatos** (fase F4): **en curso.**
- **Agentes en el formato nativo de cada herramienta** (spike S0.1 del plan): sin confirmar, no se genera nada.
- **Prueba manual por herramienta** (fase F5): pendiente; hasta entonces ninguna fila de la matriz dirá «probado».

## Dónde mirar

- Qué hace cada hook de Claude Code: [hooks.md](hooks.md) y [COMPATIBILIDAD.md](COMPATIBILIDAD.md).
- Garantías y límites del guardián: [GARANTIAS-Y-LIMITES.md](GARANTIAS-Y-LIMITES.md).
- Tabla de integraciones: [core/instalacion/herramientas-destino.js](../core/instalacion/herramientas-destino.js).
