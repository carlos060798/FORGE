# Spike S0.1 / S0.2: carpetas de skills por herramienta

Consultado el 2026-10-13. Solo documentación oficial; lo no verificado va como «sin confirmar».

## S0.1 Carpetas, AGENTS.md e invocación

| Herramienta | Carpeta proyecto | Carpeta usuario | Lee AGENTS.md | Invocación | Fuente |
|---|---|---|---|---|---|
| Copilot (VS Code) | `.github/skills/`, `.claude/skills/`, `.agents/skills/` | `~/.copilot/skills/`, `~/.claude/skills/`, `~/.agents/skills/` | sin confirmar (la página lo cita solo como formato de instrucciones) | automática por descripción; `/nombre` en el chat | https://code.visualstudio.com/docs/copilot/customization/agent-skills |
| Copilot CLI | `.github/skills`, `.claude/skills`, `.agents/skills` | `~/.copilot/skills`, `~/.agents/skills` | sin confirmar en doc oficial (solo fuente secundaria) | cuando es relevante; comando explícito sin confirmar | https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills y https://docs.github.com/en/copilot/concepts/agents/about-agent-skills |
| Codex CLI | `.agents/skills` (cwd y padres hasta la raíz) | `$HOME/.agents/skills`; admin `/etc/codex/skills` | sin confirmar en esta página | `$nombre` o `/skills`; implícita por descripción | https://developers.openai.com/codex/skills (redirige a https://learn.chatgpt.com/docs/build-skills) |
| Cursor | `.agents/skills/`, `.cursor/skills/` (también `.claude/skills`, `.codex/skills`) | `~/.agents/skills/`, `~/.cursor/skills/` | sin confirmar (la página no lo menciona) | `/nombre` en el chat del agente; automática | https://cursor.com/docs/context/skills |
| Gemini CLI | `.gemini/skills/` o alias `.agents/skills/` | `~/.gemini/skills/` o `~/.agents/skills/` | No: su archivo de contexto es GEMINI.md (según esa página) | herramienta `activate_skill` por descripción, con confirmación; `/skills` gestiona | https://geminicli.com/docs/cli/skills/ |
| Zed | `<proyecto>/.agents/skills/<n>/SKILL.md` | `~/.agents/skills/<n>/SKILL.md` | parcial: release notes de mayo 2026 citan AGENTS.md global; descubrimiento por proyecto sin confirmar | `/nombre` (p. ej. `/create-skill`); automática | https://zed.dev/docs/ai/skills (solo resultado de búsqueda; la página no se pudo abrir; carpetas por fuente secundaria: sin confirmar del todo) |
| Windsurf | `.devin/skills/` (preferida), `.windsurf/skills/` heredada, `.agents/skills/` | `~/.codeium/windsurf/skills/`, `~/.config/devin/skills/`, `~/.agents/skills/` | sin confirmar en esa página (existe página aparte de AGENTS.md) | `@nombre` en Cascade; automática | https://docs.windsurf.com/windsurf/cascade/skills (redirige a https://docs.devin.ai/desktop/cascade/skills) |
| opencode | `.opencode/skills/`, `.claude/skills/`, `.agents/skills/` | `~/.config/opencode/skills/`, `~/.claude/skills/`, `~/.agents/skills/` | sin confirmar (página de Rules aparte) | herramienta `skill({name})`; `/nombre` solo con `opencode/slash: "true"` | https://opencode.ai/docs/skills/ |
| Goose | `.agents/skills/` (también `.goose/skills`, `.claude/skills`) | `~/.agents/skills/` | sin confirmar | se añaden a las instrucciones al iniciar sesión; requiere extensión Summon v1.25.0+ | https://goose-docs.ai/docs/guides/context-engineering/using-skills (por búsqueda; la URL block.github.io dio 404; sin confirmar con fetch directo) |
| Kiro | `.kiro/skills/` | `~/.kiro/skills/` (IDE y CLI) | sin confirmar | `/nombre`; automática | https://kiro.dev/docs/skills/ |

Observación: `.agents/skills/` es leída por Copilot, Codex, Cursor, Gemini, Zed, Windsurf, opencode y Goose (Kiro no). Es la única carpeta común; la propia FORGE para Claude Code usa `.claude/skills/`, que también leen Copilot, Cursor, opencode, Windsurf (condicional) y Goose.

## S0.2 Especificación abierta Agent Skills

Fuente: https://agentskills.io/specification (2026-10-13).

- Estructura: carpeta con `SKILL.md` obligatorio; opcionales `scripts/`, `references/`, `assets/`.
- Cabecera YAML, obligatorios: `name` y `description`.
- `name`: 1-64 caracteres; minúsculas, números y guiones; no empieza ni termina en guion; sin `--`; debe coincidir con el nombre de la carpeta.
- `description`: 1-1024 caracteres, no vacía; qué hace y cuándo usarla.
- Opcionales: `license`; `compatibility` (1-500); `metadata` (mapa cadena a cadena); `allowed-tools` (cadena separada por espacios, **experimental**, soporte variable).
- Recomendaciones: cuerpo < 5000 tokens, `SKILL.md` < 500 líneas.
- Extensiones de herramienta vistas en docs (no son del estándar): `user-invocable`, `disable-model-invocation`, `context: fork` (Copilot/Cursor), `opencode/slash`, `agents/openai.yaml` (Codex).
- Validador de referencia: `skills-ref validate` en https://github.com/agentskills/agentskills (repositorio no abierto en este spike).

## Lectura de código en FORGE

`cli/index.js`:
- `copyMd` línea 175: copia los `.md` de un directorio con `copiarArchivo`.
- `copyDir` línea 186: copia recursivo con `copiarArbol`; avisa de enlaces bloqueados.
- `copiarSeguro` línea 192: copia un archivo suelto vía `protegido`.
- `copiarNucleo` línea 237: copia `commands/`, `agents/`, `skills/` (planas `.md` y carpetas) y `claude-hooks/` a `claudeDir/{commands,agents,skills,hooks}`.
- Destino fijado en línea 87: `o.global ? ~/.claude : PROYECTO/.claude`; llamadas en 572 (init) y 840 (update). Otras referencias a `.claude` en `settings.json` (283-295), `.claudeignore` (375), doctor (1046-1157).

`commands/`: 39 archivos.
- 39/39 con `allowed-tools` (ej. `Read, Bash`; `Read, Write, Edit, Bash`), en formato separado por comas, distinto del formato del estándar (espacios).
- 0/39 usan `$ARGUMENTS`; 3 usan `$1`-`$9` posicionales (aprox., conteo por grep `\$[0-9]`).
- 39/39 con `description`; solo 1 con `name:`; los demás no tienen `name` (obligatorio en SKILL.md: lo debe generar el generador).
- 16 con `handoffs` y 2 con `aliases` (`sdd.comprimir.md`, `sdd.mapear.md`): cabeceras propias, sin equivalente estándar.
- 3 mencionan `mcp__`, `Task(` o subagent.

## Conclusión

Primera entrega con carpeta confirmada en doc oficial: Claude Code, genérica, Codex (`.agents/skills`), Cursor (`.cursor/skills`), Gemini CLI (`.gemini/skills`), Kiro (`.kiro/skills`), opencode (`.opencode/skills`), Copilot VS Code (`.github/skills`), Windsurf (`.devin/skills`). Zed y Goose: sin confirmar con fetch directo.

Cambios sugeridos a la spec:
1. CA-001-07: elegir por doc confirmada; proponer además una clave `agents` (`.agents/skills`) que cubre a ocho herramientas.
2. S0.1 de la spec afirma Codex y Zed `.agents/skills`: Codex confirmado; Zed pendiente.
3. CA-003-01: añadir que el generador crea `name` (falta en 38/39) igual al nombre de carpeta, valida regex y 1024 de descripción.
4. CA-003-03: `allowed-tools` es válido pero experimental y con otra sintaxis; convertir comas a espacios o eliminar.
5. Cabeceras `handoffs`/`aliases`: decidir si se pasan a `metadata` o se descartan.
6. Invocación varía (`$`, `/`, `@`, `activate_skill`): la tabla debe guardarla por herramienta.
