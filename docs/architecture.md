# Arquitectura

Este documento describe el diseño del sistema FORGE: el modelo de seis capas, los componentes principales y cómo fluyen los datos a través del pipeline.

---

## Modelo de seis capas

```
┌─────────────────────────────────────────────────────────┐
│  L0 — Providers LLM                                      │
│  core/llm-providers/  (anthropic · openai · ollama · stub)│
├─────────────────────────────────────────────────────────┤
│  L1 — Memoria y estado                                   │
│  .sdd/estado.json  ·  .sdd/memoria/  ·  SQLite          │
│  core/state-store.js  ·  core/decisions/decision-store.js│
├─────────────────────────────────────────────────────────┤
│  L2 — Interfaz de usuario                                │
│  39 commands/*.md  ·  31 skills/*/SKILL.md              │
├─────────────────────────────────────────────────────────┤
│  L3 — Herramientas del host                              │
│  Claude Code nativas: Read · Write · Bash · Task · Edit  │
├─────────────────────────────────────────────────────────┤
│  L4 — Orquestación                                       │
│  core/orchestrator.js  ·  14 agents/*.md                │
│  core/agent-registry.js  ·  core/engine-cli.js          │
├─────────────────────────────────────────────────────────┤
│  L5 — Gobernanza                                         │
│  claude-hooks/pre-tool-guard.js/.sh                      │
│  claude-hooks/agent-memory.js/.sh                        │
│  claude-hooks/post-write-conventions.js/.sh              │
└─────────────────────────────────────────────────────────┘
```

---

## L0 — Providers LLM

**Archivos:** `core/llm-providers/`

FORGE es agnóstico al proveedor de LLM. La resolución es automática:

```
1. Variable FORGE_LLM_PROVIDER
2. llm.provider en .sdd/sdd.config.yaml
3. Detección automática (ANTHROPIC_API_KEY → anthropic, etc.)
4. Fallback: anthropic
```

| Provider | Aliases | Modelos por defecto |
|---|---|---|
| `anthropic` | `claude` | claude-opus-4-8, claude-sonnet-4-6, claude-haiku-4-5-20251001 |
| `openai` | `gpt`, `azure`, `github-models`, `cursor` | gpt-4o, gpt-4o-mini |
| `ollama` | `local`, `llama`, `deepseek` | qwen2.5-coder:7b, llama3, deepseek-r1:14b |
| `stub` | `test` | Respuestas determinísticas para CI |

Los alias de modelos (`opus`, `sonnet`, `haiku`) se resuelven al modelo real de cada proveedor en `core/llm-providers/index.js`.

---

## L1 — Memoria y estado

**Estado del pipeline:** `core/state-store.js` + `core/state-machine.js`

El estado vive en `.sdd/estado.json`. La state machine formal define 9 estados y 8 transiciones con guards:

```
idea → discovery → ir → design → spec → plan → tasks → code → done
                                   ↑
                             [forge aprobar spec]
                              guard: spec_aprobado === true
```

Guards completos:

| Transición | Guard |
|---|---|
| discovery → ir | `ir_generado === true` |
| ir → design | `ir_path` registrado |
| design → spec | `product_design_aprobado === true` |
| spec → plan | `(spec_activa OR spec_draft_path) AND spec_aprobado === true` |
| plan → tasks | `plan_activo` registrado |

**Memoria de agentes:** `core/project-memory.js` + `claude-hooks/agent-memory.js`

Dos backends, auto-detectados:
- **SQLite** (`node:sqlite`, Node ≥22.5): búsqueda TF-IDF semántica, 8 fuentes de recuperación
- **Markdown** (fallback): archivos `.sdd/memoria/agente-{nombre}.md`, índice JSONL

**Decision store:** `core/decisions/decision-store.js`

Almacena ADRs con búsqueda semántica TF-IDF + similitud coseno. Funciona bien hasta cientos de ADRs.

**Memoria compartida:** `.sdd/memoria/compartida/decisiones-clave.md`

Todos los agentes leen y escriben aquí — canal de comunicación asíncrono entre agentes.

---

## L2 — Interfaz

**Comandos** (`commands/`): 39 archivos `.md`. Cada uno es un slash command de Claude Code (`/sdd.descubrir`, `/forge`, etc.). Los comandos son texto puro con instrucciones para el modelo — no son código ejecutable.

**Skills** (`skills/`): 31 directorios, cada uno con un `SKILL.md`. Las skills son capacidades reutilizables invocadas por los comandos.

**Plantillas** (`plantillas/`): 17 archivos `.md`. Esqueletos para artefactos del pipeline (spec, plan, ADR, etc.).

**Presets** (`presets/`): 3 configuraciones predefinidas (lean, startup, enterprise). Definen qué agentes están activos y con qué modelo.

---

## L3 — Herramientas del host

FORGE usa exclusivamente las herramientas nativas de Claude Code: `Read`, `Write`, `Edit`, `Bash`, `Task`, `Glob`, `Grep`. No invoca APIs externas directamente desde los comandos — eso lo hace el motor (L4) o los providers (L0).

---

## L4 — Orquestación

**Motor central:** `core/orchestrator.js`

El orchestrator ejecuta tareas con estas garantías:
- Orden topológico respetando dependencias entre tareas
- Retry automático en caso de fallo
- Circuit breaker por agente (sandbox / local / confirmado)
- Checkpoint persistente — reanudable tras interrupción

**Agentes:** `agents/*.md` (14 archivos)

Cada agente es un prompt de sistema fijo con restricciones de herramientas. No son clases ni objetos — son instrucciones de rol en Markdown.

| Grupo | Agentes | Modelo |
|---|---|---|
| Estratégico | arquitecto, asesor-datos, critico, seguridad | opus |
| Diseño | product-designer, revisor | opus |
| Implementación | desarrollador-backend, desarrollador-frontend, disenador-api, tester, documentador, investigador, operaciones, architecture-designer | sonnet |

7 agentes son estrictamente read-only (enforced en `pre-tool-guard.js`): arquitecto, asesor-datos, critico, seguridad, investigador, revisor, disenador-api.

**Registro de agentes:** `core/agent-registry.js`

Carga los `.md` de agentes, parsea el frontmatter (model, name, description, tools), instancia el provider LLM correspondiente, ejecuta el prompt y retorna el resultado.

**CLI del engine:** `core/engine-cli.js`

Entry point para `forge run` / `forge resume` / `forge status` / `forge validate`. Expone `main()` para que `cli/index.js` lo llame.

---

## L5 — Gobernanza

Tres hooks de Claude Code, cada uno con versión `.js` (lógica completa) y `.sh` (lógica mínima Bash para proyectos sin Node):

### `pre-tool-guard.js` (PreToolUse)

Se ejecuta antes de cada llamada a herramienta. Bloquea:
- Comandos destructivos en agentes read-only (Write, Edit, Bash con rm/drop/delete)
- Comandos que tocan archivos protegidos (`.env`, secrets, ramas protegidas)
- Operaciones que violan ADRs registrados
- Nivel de ejecución según circuit breaker (`sandbox` bloquea Bash, `local` restringe writes fuera de cwd)

### `agent-memory.js` (PostToolUse)

Se ejecuta después de cada write/edit. Registra:
- El artefacto escrito, el agente que lo escribió y el timestamp
- Decisiones arquitectónicas detectadas como ADRs
- Entrada en memoria compartida cuando el agente registra una decisión clave

### `post-write-conventions.js` (PostToolUse)

Se ejecuta después de writes. Verifica convenciones de código (imports relativos existentes, encoding, formato).

---

## Observabilidad

Cuatro archivos JSONL en `.sdd/`:

| Archivo | Contenido |
|---|---|
| `consumo.jsonl` | Tokens y USD por operación, modelo usado |
| `mutaciones.jsonl` | Cada write/edit con agente, archivo y timestamp |
| `events.jsonl` | Transiciones de pipeline, eventos del orchestrator |
| `agent-tool-audit.jsonl` | Cada herramienta invocada por cada agente |

El dashboard (`ui/server.js`, localhost:3001) lee estos archivos y emite actualizaciones por SSE. Se cierra automáticamente tras 30 minutos sin peticiones.

---

## Flujo de datos completo

```
Usuario escribe /forge
    ↓
Claude Code ejecuta commands/forge.md
    ↓
Llama a skills/descubrir-idea/SKILL.md
    ↓
El agente product-designer genera discovery
    ↓
pre-tool-guard.js verifica (L5) → permite Write
    ↓
Artefacto escrito en .sdd/discovery/
    ↓
agent-memory.js registra la mutación (L5)
    ↓
state-store.js actualiza estado.json
    ↓
SSE emite evento al dashboard (L1)
    ↓
Siguiente etapa...
```

---

## Directorio de archivos clave

```
core/
├── state-machine.js      FSM formal — 9 estados, 8 transiciones, guards
├── state-store.js        Persistencia estado.json
├── orchestrator.js       Motor de ejecución de tareas
├── agent-registry.js     Carga y ejecuta agentes
├── engine-cli.js         CLI del motor (run/resume/status/validate)
├── event-log.js          Log append-only de eventos
├── execution-context.js  Circuit breaker por agente
├── session-budget.js     Acumulador de costo USD por sesión
├── quality-gate.js       Gate de calidad (tests + lint + criterios)
├── stack-detector.js     Detección de lenguaje/framework (18 lenguajes)
├── project-memory.js     Persistencia de memoria de agentes
├── decisions/            Decision store SQLite + TF-IDF
├── llm-providers/        Anthropic, OpenAI, Ollama, Stub
├── runners/              Node, Python, Go, Rust
└── adapters/             ClaudeCodeAdapter, SpecKitAdapter

claude-hooks/
├── pre-tool-guard.js/.sh     Guard PreToolUse
├── agent-memory.js/.sh       Memoria PostToolUse
├── post-write-conventions.js/.sh  Convenciones PostToolUse
├── ast-indexer.js            Índice AST de símbolos JS/TS
├── ast-query.js              Queries sobre el índice AST
├── context-manager.js        Gestión de contexto
├── model-registry.js         Registro de modelos (observabilidad)
└── query-memory.js           Queries sobre memoria de agentes
```
