# Spike: carpeta de skills de Zed y Goose

Consultado el 2026-11-11. Solo documentación oficial, leída con WebFetch (resumen de un modelo pequeño, no copia literal). Cierra los «sin confirmar» del spike S0.1 (`carpetas-de-skills.md`).

| Dato | Zed | Goose |
|---|---|---|
| Carpeta de proyecto | `<worktree>/.agents/skills/` («Only the current project») | `.agents/skills/` («Project-level skills, scoped to the current project») |
| Carpeta de usuario | `~/.agents/skills/` | `~/.agents/skills/` |
| Otras carpetas leídas | no consta | `.goose/skills/`, `.claude/skills/`, `~/.claude/skills/` por compatibilidad; recomienda `.agents/skills/` |
| Forma | cada skill es hijo directo de la raíz; no admite subcarpetas anidadas | una subcarpeta por skill con `SKILL.md` |
| Invocación | manual: `/` y elegir la skill, o `@skill`; autónoma: el agente llama a la herramienta `skill` según la descripción (`disable-model-invocation: true` la desactiva) | al iniciar añade nombres y descripciones a sus instrucciones; carga la skill si la petición coincide o se pide («Use the code-review skill…»); en la CLI `goose skills list` y `/skills <nombre>` |
| Lee `AGENTS.md` | no consta en la página | no consta en la página |
| Fuente | https://zed.dev/docs/ai/skills | https://goose-docs.ai/docs/guides/context-engineering/using-skills |

## Decisión

Las dos entran en la tabla de integraciones con la carpeta `.agents/skills`, la misma que `agents` y Codex. Prefijo de invocación: `/` para Zed; vacío para Goose (se pide en lenguaje natural o con `/skills <nombre>`, que no coincide con `/<nombre>`).

## Límites

- Solo se leyó una página por herramienta; no hay hooks ni agentes nativos confirmados para ninguna, así que `--con-hooks` no aplica.
- Que lean `AGENTS.md` no está confirmado; Fragua lo genera igualmente.
- Sin probar en una instalación real de Zed ni de Goose.
