# Fuente de verdad — FORGE v4.2.0

> Archivo interno. Verificado contra el código fuente el 2026-06-27.
> Usar estos datos en TODOS los documentos. No inventar números.

## Identidad del proyecto

| Campo | Valor |
|---|---|
| Versión | 4.2.0 |
| Nombre paquete (`package.json`) | `forja-mvp` |
| Publicado en npm | No |
| Binario CLI | `forge` (alias: `sdd-es`) |
| Instalación | `git clone` + `npm install` |
| Licencia | MIT |

## Capacidades verificadas

| Dato | Valor | Fuente |
|---|---|---|
| Tests | 998 pasando / 0 fallos | `node --test` esta sesión |
| Agentes | 14 | `ls agents/*.md` |
| Agentes opus | 7: arquitecto, asesor-datos, critico, product-designer, revisor, seguridad, architecture-designer | frontmatter de cada .md |
| Agentes sonnet | 7: desarrollador-backend, desarrollador-frontend, disenador-api, documentador, investigador, operaciones, tester | frontmatter de cada .md |
| Comandos | 39 | `ls commands/*.md` |
| Skills | 31 | `ls skills/` |
| Hooks principales | 6 (3 × js+sh): pre-tool-guard, agent-memory, post-write-conventions | `ls claude-hooks/` |
| Hooks utilidades | 5: ast-indexer.js, ast-query.js, context-manager.js, model-registry.js, query-memory.js | `ls claude-hooks/` |

## Preset lean (verificado en presets/lean.yaml)

Agentes activos: **arquitecto, disenador-api, asesor-datos, desarrollador-backend, desarrollador-frontend, tester** (todos con modelo sonnet).

Agentes inactivos: operaciones, revisor, critico, seguridad, documentador, investigador, product-designer, architecture-designer.

## Pipeline — transiciones y guards (verificado en core/state-machine.js)

| Transición | Guard |
|---|---|
| idea → discovery | ninguno |
| discovery → ir | `ir_generado === true` |
| ir → design | `ir_path` registrado |
| design → spec | `product_design_aprobado === true` |
| spec → plan | `(spec_activa OR spec_draft_path) AND spec_aprobado === true` |
| plan → tasks | `plan_activo` registrado |
| tasks → code | ninguno |
| code → done | ninguno |

## Providers LLM (verificado en core/llm-providers/)

| Provider | Alias | Modelos |
|---|---|---|
| anthropic | claude | claude-opus-4-8, claude-sonnet-4-6, claude-haiku-4-5-20251001 |
| openai | gpt, codex, azure, github-models, cursor | gpt-4o, gpt-4o-mini |
| ollama | local, deepseek, llama | qwen2.5-coder:7b, llama3, mistral, deepseek-r1:14b |
| stub | test | respuestas determinísticas para CI |

**NO soportado:** Google/Gemini (no existe en llm-providers/).

Resolución de provider: FORGE_LLM_PROVIDER env → llm.provider en config → auto-detect → fallback anthropic.

## CLI — comandos (verificado en cli/index.js switch)

`init, update, doctor, config, ui, logs, export, import, status, step, state, validate, reset, dispatch, adapters, decisions, aprobar, run, resume`

## Runtime

| Dato | Valor | Fuente |
|---|---|---|
| Dashboard puerto | localhost:3001 | ui/server.js |
| Dashboard idle timeout | 30 min | IDLE_TIMEOUT_MS en ui/server.js |
| Dashboard protocolo | SSE (Server-Sent Events) + fallback polling | ui/server.js |
| SQLite auto-detect | Node ≥22.5 | core/state-store.js |
| Fallback memoria | Markdown | core/project-memory.js |
| core/ compilación | Ninguna — JS puro con JSDoc | package.json build script |
| Observabilidad | consumo.jsonl, mutaciones.jsonl, events.jsonl, agent-tool-audit.jsonl | core/event-log.js + claude-hooks |
| Precios tokens (hardcoded) | opus $15/$75 · sonnet $3/$15 · haiku $0.8/$4 por 1M | core/session-budget.js |

## Dependencias (verificado en package.json)

```
"dependencies": {
  "@sqlite.org/sqlite-wasm": "^3.53.0-build1",
  "acorn": "^8.17.0"
}
```
Dos dependencias — no es estrictamente zero-deps. En Node ≥22.5, sqlite-wasm no se usa (node:sqlite nativo).
