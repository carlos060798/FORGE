# Changelog

Todos los cambios notables de FORGE se documentan aquí.
Formato: [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).

---

## [4.2.0] — 2026-06-27

### Añadido
- Motor LLM agnóstico (`core/llm-providers/`): Anthropic, OpenAI (+ Azure/GitHub Models/Cursor), Ollama, Stub — auto-detectado por variable de entorno o configuración
- Hooks multi-lenguaje: `pre-tool-guard.sh`, `agent-memory.sh`, `post-write-conventions.sh` — permiten usar FORGE en proyectos Python, Go, Rust, PHP sin `"type":"module"`
- Guard `spec → plan` requiere aprobación humana explícita (`spec_aprobado: true`)
- Comando `forge aprobar spec` — escribe `spec_aprobado: true` en estado; idempotente
- SSE en tiempo real en dashboard (`/events`): emite estado, consumo y eventlog; fallback polling si EventSource no disponible
- Endpoint `GET /eventlog` — últimas 50 entradas de `events.jsonl`
- Memoria compartida entre agentes: `.sdd/memoria/compartida/decisiones-clave.md`
- `forge doctor` con diagnóstico real del LLM: ping, latencia, validación JSON, modelo, SQLite
- `forge run` y `forge resume` expuestos en CLI principal (delegaban a `engine-cli.js` sin exportar)
- Fix bug silencioso: `await` faltante en `_runTests()` del orchestrator

### Tests
- 998 pasando / 0 fallos
- 16 tests nuevos: orchestrator-runner (3), state-machine-aprobacion (9), cli-run (4)
- 24 tests E2E: `tests/e2e/pipeline-flow.test.js` — pipeline completo sin LLM

---

## [4.0.0] — 2026-06-22

### Añadido
- Motor ejecutable completo en `core/` — JS puro con JSDoc, sin compilación TypeScript
- State machine formal (`core/state-machine.js`) con 8 transiciones y guards
- Orchestrator con topological sort de tareas y retry automático (`core/orchestrator.js`)
- Circuit breaker por agente: sandbox / local / confirmado (`core/execution-context.js`)
- Event log append-only (`core/event-log.js`) — registro de todos los eventos del pipeline
- Session budget con precios reales por modelo (`core/session-budget.js`)
- Quality gate automático: tests → lint → criterios de aceptación (`core/quality-gate.js`)
- Stack detector para 18 lenguajes y frameworks (`core/stack-detector.js`)
- Runners para Node.js, Python, Go, Rust (`core/runners/`)
- Decision store SQLite + TF-IDF con búsqueda semántica (`core/decisions/`)
- IR-to-spec mapper: convierte IR + ProductDesign → spec (`core/ir-to-spec-mapper.js`)
- Adaptadores: ClaudeCodeAdapter, SpecKitAdapter (`core/adapters/`)
- Dashboard UI con servidor Node (`ui/server.js`) en localhost:3001
- Agente `architecture-designer` (14 agentes totales)
- Tests E2E del AST indexer: 18 tests, `limpiarTypeScript()` exportada

### Migración
- `core/` migrado de TypeScript a JS puro con JSDoc — no se necesita `npm run build` ni `dist/`

---

## [3.x] — 2026-06 (histórico resumido)

- Pipeline SDD completo: 39 comandos (`commands/`), 30+ skills (`skills/`)
- 13 agentes especializados con enforcement a nivel hook
- `pre-tool-guard.js`: 9 categorías de bloqueo, detección de secrets, ADR violations
- `agent-memory.js`: memoria persistente con SQLite (Node ≥22.5) o Markdown
- Context manager con presupuesto USD (`FORGE_BUDGET_WARN_USD`, `FORGE_BUDGET_BLOCK_USD`)
- Export/import de artefactos portables (formatos: speckit, openspec)
- `forge decisions` con búsqueda semántica TF-IDF
- Dashboard de observabilidad (`consumo.jsonl`, `mutaciones.jsonl`, `agent-tool-audit.jsonl`)
- Presets: lean, startup, enterprise
- Templates: api-rest, cli-tool, saas-mvp
- Integración MCP: Vercel, GitHub (beta)
- Modo guiado y modo experto
