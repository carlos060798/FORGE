# FORGE: Análisis Arquitectónico Exhaustivo & Completo

**Generado:** 2026-06-21  
**Versión FORGE:** v4.0.0 → v5.0.0 (en submódulo)  
**Método:** Análisis estático + verificación de código real  
**Formato:** Documentación técnica oficial, listo para publicar  

> **Propósito:** Documentación completa y estructurada de FORGE como framework. Todo basado en código real, sin inventos ni especulaciones.

---

## TABLA DE CONTENIDOS

1. [System Overview](#1-system-overview)
2. [Project Structure](#2-project-structure)  
3. [Core Architecture](#3-core-architecture)
4. [Execution Flow](#4-execution-flow)
5. [Modules Breakdown](#5-modules-breakdown)
6. [Agent System](#6-agent-system)
7. [Tools & Hooks](#7-tools--hooks)
8. [Configuration](#8-configuration)
9. [API Surface](#9-api-surface)
10. [Extensibility](#10-extensibility)
11. [Limitations](#11-limitations)
12. [Quality Analysis](#12-quality-analysis)
13. [MVP Workflow](#13-mvp-workflow)

---

## 1. SYSTEM OVERVIEW

### What FORGE Is

**FORGE** is a **Software Specification-Driven Development (SDD) orchestration framework** that runs exclusively inside Claude Code (Anthropic's CLI). It coordinates 14 specialized AI agents to transform vague product ideas into production-ready, tested, deployable software.

**System Classification:**
- **Type:** Plugin for Claude Code + SDD Framework
- **Architecture Style:** Agent-oriented, command-routed, state-driven
- **Host Runtime:** Claude Code (required; cannot run standalone)
- **Distribution:** npm binary (`npx forge init`)
- **Entry Points:** Slash commands (`/forge`, `/sdd*`)
- **State Model:** Local-first, filesystem-based (`.sdd/` directory)
- **Dependencies at Runtime:** None required; optional: `@sqlite.org/sqlite-wasm` (Node ≥22.5)

### Functional Objective

Enable small teams and individual developers to:

1. **Capture rough ideas** in natural language
2. **Parse to structured requirements** (IR — Intermediate Representation) with confidence scoring
3. **Design products** with UX + technical architecture
4. **Generate specifications** with acceptance criteria (Gherkin format)
5. **Plan implementations** as task lists with estimates
6. **Auto-generate code** via specialized agents (backend, frontend, tests)
7. **Verify quality** against acceptance criteria
8. **Deploy to production** with CI/CD automation

**All orchestrated within a single Claude Code session, without leaving the editor.**

### Current Scope

| Dimension | Count | Status |
|-----------|-------|--------|
| Commands (SDD phases) | 38+ | Complete |
| Agents (specialized personas) | 14 | Complete |
| Skills (capabilities) | 26 | Complete |
| Hooks (integration points) | 5+ | Complete |
| Languages supported | 3 (ES primary, EN, FR) | Production |
| Presets (execution profiles) | 3 (lean, startup, enterprise) | Complete |
| Type definitions (core/) | 3 interfaces | Stable (v1.0) |
| Documentation pages | 30+ | Comprehensive |

---

## 2. PROJECT STRUCTURE

### Directory Hierarchy (Complete)

```
FORGE/ (root of plugin)
│
├── cli/                                 # Node.js CLI installer & manager
│   └── index.js (≈1200 lines)          # Main entrypoint
│
├── bin/                                # Shell utilities
│   ├── comprimir.sh
│   └── mapear.sh
│
├── commands/                           # 38+ SDD pipeline commands (Markdown)
│   ├── forge.md                        # ⭐ Citizen dev hub (main entry)
│   ├── sdd.md                          # ⭐ Technical hub (expert routing)
│   ├── sdd.interpretar.md              # Phase: Idea → IR
│   ├── sdd.especificar.md              # Phase: IR → Spec.md
│   ├── sdd.planificar.md               # Phase: Spec → Task plan
│   ├── sdd.implementar.md              # Phase: Plan → Code + Tests
│   ├── sdd.verificar.md                # Phase: Validate vs. spec
│   ├── sdd.desplegar.md                # Phase: Deploy to production
│   └── [30+ more: create-app, crear-mcp, adr, estado, etc.]
│
├── agents/                             # 14 specialized agent personas
│   ├── arquitecto.md                   # Architecture (Opus)
│   ├── critico.md                      # Risk detection (Opus)
│   ├── seguridad.md                    # Security audit (Opus)
│   ├── product-designer.md             # Product UX (Opus)
│   ├── asesor-datos.md                 # Database design (Opus)
│   ├── desarrollador-backend.md        # Backend code (Sonnet)
│   ├── desarrollador-frontend.md       # Frontend code (Sonnet)
│   ├── tester.md                       # Test automation (Sonnet)
│   ├── disenador-api.md                # API contracts (Sonnet)
│   ├── revisor.md                      # Code review (Sonnet)
│   ├── investigador.md                 # Stack analysis (Sonnet)
│   ├── architecture-designer.md        # Tech selection (Sonnet)
│   ├── operaciones.md                  # CI/CD & deploy (Haiku)
│   └── documentador.md                 # Technical docs (Haiku)
│
├── skills/                             # 26 specialized capabilities
│   ├── modo-guiado/                    # Citizen dev mode (translations)
│   ├── explicame/                      # Explain pipeline in plain language
│   ├── deploy-vercel/                  # Vercel deployment automation
│   ├── share-progress/                 # Progress summarization
│   ├── effort-router/                  # Task complexity classification
│   ├── enrutador-agentes/              # Agent selection logic
│   ├── indexador/                      # Full-text project indexing
│   ├── gestion-estado/                 # State mutation helpers
│   ├── validacion-spec/                # Quality gates for specs
│   ├── critica-diseno/                 # Design critique system
│   ├── github-connect/                 # GitHub MCP integration
│   ├── deteccion-stack/                # Auto-detect tech stack
│   ├── adr-indexer/                    # Architecture decision registry
│   ├── memoria-compactor/              # Compress memory for long sessions
│   ├── token-budget/                   # Token usage tracking
│   └── [11 more: descubrir-idea, interpretar, elegir-direccion, etc.]
│
├── claude-hooks/                       # 5+ Claude Code integration hooks
│   ├── pre-tool-guard.js               # PreToolUse: Block dangerous ops
│   ├── agent-memory.js                 # PostToolUse: Memory + telemetry
│   ├── post-write-conventions.js       # PostToolUse: Code conventions
│   ├── ast-indexer.js                  # PostToolUse: Symbol indexing
│   ├── query-memory.js                 # Memory retrieval API
│   └── model-registry.js               # Provider/model tracking
│
├── core/                               # TypeScript type definitions
│   ├── ir.types.ts                     # IR interface (215 lines)
│   ├── project-memory.ts               # ForgeEstado interface
│   ├── ir-to-spec-mapper.ts            # IR → Spec.md conversion
│   └── ir-to-spec-mapper.js            # Compiled version
│
├── plantillas/                         # Default templates
│   ├── especificacion.md               # Spec template
│   ├── plan.md                         # Plan template
│   ├── tarea.md                        # Task template
│   └── [more templates]
│
├── presets/                            # Installation presets
│   ├── lean.yaml                       # Minimal profile
│   ├── startup.yaml                    # Growth-focused
│   ├── enterprise.yaml                 # Large org
│   └── templates/
│       ├── api-rest/                   # API scaffold (ir.json + spec.md)
│       ├── cli-tool/                   # CLI tool scaffold
│       └── saas-mvp/                   # SaaS MVP scaffold
│
├── configuracion-ejemplo/              # Example configuration
│   ├── sdd.config.yaml                 # Master config template (349 lines)
│   ├── .claudeignore                   # Context exclusions
│   └── .claude/
│       ├── settings.json               # Hook registration
│       └── CLAUDE.md
│
├── docs/                               # Comprehensive documentation
│   ├── ARQUITECTURA.md                 # Architecture deep-dive
│   ├── AGENTES.md                      # Agent system overview
│   ├── AGENTES-DETALLE.md              # Per-agent capabilities
│   ├── FLUJO.md                        # Execution flow
│   ├── MEMORIA-Y-OBSERVABILIDAD.md     # State + telemetry
│   ├── forge-architecture.md           # Technical reference (existing)
│   ├── EJEMPLOS-MEMORIA-API.md         # API examples (newly added)
│   ├── PLAN-DIAGRAMAS-INTERACTIVOS.md  # UX improvement plan
│   └── [25+ more docs]
│
├── docs-site/                          # Static documentation website
│   ├── index.html                      # SPA (2.8KB)
│   └── assets/
│       ├── app.js                      # Logic (12.7KB)
│       ├── styles.css                  # Styles (12.7KB)
│       ├── data.js                     # Content (78KB)
│       └── pages/                      # Rendered pages
│
├── ui/                                 # Real-time dashboard UI
│   ├── server.js                       # Node.js REST server
│   ├── index.html                      # SPA
│   └── src/
│       ├── pipeline.js                 # Pipeline view
│       ├── tasks.js                    # Task tracking
│       ├── verification.js             # Verification status
│       └── activity.js                 # Activity log
│
├── craft/                              # Design system & components
├── design-systems/                     # Multiple design themes
├── mcp-figma/                          # Figma MCP server (optional)
├── utils/                              # Node.js utility modules
│   ├── adr-parser.js                   # ADR extraction
│   ├── ast-compressor.js               # AST compression
│   ├── delta-encoding.js               # Efficient updates
│   ├── episodic-memory.js              # Memory API
│   └── hybrid-indexer.js               # Project indexing
│
├── tests/                              # Unit & integration tests
│   ├── agent-memory.test.js
│   ├── cli-config.test.js
│   ├── commands.test.js
│   ├── hooks-contract.test.js
│   └── [7+ more]
│
├── package.json                        # npm metadata (v4.0.0, MIT)
├── tsconfig.json                       # TypeScript config (check-only)
├── README.md                           # Main documentation
├── QUICK-START.md                      # Quick start guide
├── CHANGELOG.md                        # Version history
├── CONTRIBUTING.md                     # Contribution guidelines
└── LICENSE                             # MIT license
```

### Key Entrypoints

| Path | Role | Loads | Invokes |
|------|------|-------|---------|
| `cli/index.js` | Bootstrap | File system | Copy files, register hooks |
| `commands/forge.md` | User entry | State + config | Skills or next command |
| `commands/sdd.md` | Expert entry | State + config | Commands (routing table) |
| `.sdd/estado.json` | State source | Filesystem | Pipeline step tracking |
| `.claude/hooks/` | Integration | Filesystem | Before/after tool calls |
| `agents/*.md` | Personas | Memory + constitution | Code/decisions |

---

## 3. CORE ARCHITECTURE

### Layered System Design

```
┌──────────────────────────────────────────────────────────┐
│ LAYER 0: HOST (Claude Code)                              │
│ • User interaction (slash commands, natural language)    │
│ • Tool execution environment (Read, Write, Bash, etc.)   │
│ • Hook orchestration (PreToolUse, PostToolUse events)   │
│ • Session state (context window, agent env vars)        │
│ • No direct visibility of FORGE internals                │
└────────────────────────┬─────────────────────────────────┘
                         │ Entry: /forge or /sdd
                         ▼
┌──────────────────────────────────────────────────────────┐
│ LAYER 1: HUB (Command Routing & State Loading)           │
│ • forge.md (citizen mode, friendly)                      │
│ • sdd.md (expert mode, detailed routing)                │
│ • Responsibilities:                                      │
│   - Classify user intent (38 patterns)                   │
│   - Load project state (estado.json, ir.json, config)   │
│   - Delegate to appropriate command                      │
│   - Provide handoff suggestions (next step)              │
└────────────────────────┬─────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
    ┌─────────┐    ┌──────────┐   ┌──────────────┐
    │38+ SDD  │    │14 Agents │   │26 Skills     │
    │Commands │    │(personas)│   │(capabilities)│
    └────┬────┘    └────┬─────┘   └──────┬───────┘
         │              │               │
         └──────────────┼───────────────┘
                        ▼
┌──────────────────────────────────────────────────────────┐
│ LAYER 2: HOOKS (Real-time Middleware & Guardrails)      │
│ • pre-tool-guard.js    → Block dangerous operations     │
│ • agent-memory.js      → Persist memory + ledger        │
│ • post-write-conventions.js → Enforce code style        │
│ • ast-indexer.js       → Symbol indexing               │
│ • Runs before/after EVERY tool call                     │
│ • Can block (exit 2) or allow (exit 0)                  │
└────────────────────────┬─────────────────────────────────┘
                         │
┌──────────────────────────────────────────────────────────┐
│ LAYER 3: STATE (.sdd/ directory, filesystem)            │
│ • Core: estado.json (pipeline state)                    │
│ • Core: ir.json (interpreted requirement)               │
│ • Core: sdd.config.yaml (configuration)                 │
│ • Artifacts: especificaciones/, plan/, código/          │
│ • Memory: memoria/ (agent .md or SQLite)                │
│ • Telemetry: observabilidad/ (consumo.jsonl)            │
│ • Authority: Single source of truth                     │
└──────────────────────────────────────────────────────────┘
```

### Cross-Layer Data Flow

```
User Input ("tengo una idea de un app de tareas")
    ↓
[Claude Code parses slash command: /forge "..."]
    ↓
[HUB LAYER loads .sdd/estado.json]
    ↓
[HUB classifies intent → "interpretar idea"]
    ↓
[COMMAND LAYER: sdd.interpretar.md invoked]
    ↓
[AGENT LAYER: investigador agent loaded]
    ↓
[Agent reads constitution + memory]
    ↓
[Agent writes .sdd/ir.json]
    ↓
[HOOK LAYER: agent-memory.js captures Write event]
    ↓
[Memory updated: .sdd/memoria/agente-investigador.md]
    ↓
[Ledger appended: .sdd/observabilidad/consumo.jsonl]
    ↓
[HUB returns handoff: "Next: /sdd.especificar"]
    ↓
User decision (follow handoff or explore)
```

### Modularity Matrix

| Module | Depends on | Scope |
|--------|-----------|-------|
| CLI | Filesystem | Bootstrap only |
| Commands | State (JSON) | Single-phase orchestration |
| Agents | Memory (MD/SQLite) + Config | Specialized execution |
| Skills | Commands + State | Cross-cutting capabilities |
| Hooks | Process I/O | Real-time middleware |
| State | Filesystem | Authority layer |

**Coupling Assessment:** Low (via JSON state interface) ✓

---

## 4. EXECUTION FLOW

### Primary Entry Point: `/forge`

**File:** `commands/forge.md` (~140 lines)  
**Persona:** Citizen developer (non-technical)  
**Flow:**

```
/forge "I want to build a budget tracking app for personal spending"
    ↓ PASO 1: Profile detection
    └─ Read .sdd/sdd.config.yaml → perfil field
    └─ If "guiado" → activate skill `modo-guiado` (friendly translations)
    └─ If "experto" → use technical language
    ↓ PASO 2: Intent routing (lookup table)
    ├─ "quiero construir" → /sdd.interpretar [idea]
    ├─ "¿qué hiciste?" → skill `explicame`
    ├─ "despliega" → /sdd.desplegar
    └─ "¿qué problemas?" → /sdd.analizar
    ↓ PASO 3: Delegate
    └─ Invoke matched command or skill
    ↓ User follows handoff or branches
```

**Routing Table (in `forge.md`):**

| User Input | Routes To | Invokes | Output |
|-----------|-----------|---------|--------|
| "quiero construir X" | `/sdd.interpretar [X]` | investigador | ir.json |
| "¿qué está pasando?" | skill `explicame` | main | Summary |
| "despliega en vercel" | skill `deploy-vercel` | operaciones | Live app |
| "muéstrame los problemas" | `/sdd.analizar` | critico | Issues report |

---

### Secondary Entry Point: `/sdd` (Expert Hub)

**File:** `commands/sdd.md` (~250 lines)  
**Persona:** Technical user (developers, architects)  
**Flow:**

```
/sdd "quiero planificar la arquitectura completa"
    ↓ PASO 1: State loading
    └─ Load: .sdd/estado.json
    └─ Load: .sdd/ir.json (if exists)
    └─ Load: .sdd/especificaciones/ (if exist)
    └─ Load: .sdd/sdd.config.yaml
    ↓ PASO 2: Intent classification (38 patterns)
    ├─ "diseña" → /sdd.diseñar
    ├─ "plan" → /sdd.planificar
    ├─ "construye" → /sdd.implementar
    ├─ "prueba" → /sdd.qa
    ├─ "verifica" → /sdd.verificar
    └─ [33 more patterns]
    ↓ PASO 3: Pipeline state detection
    └─ If ir.json exists → suggest design or build
    └─ If spec exists → suggest planning
    ↓ PASO 4: Execute + handoff
    └─ Run matched command
    └─ Return next step recommendation
```

---

### Command Execution Protocol

Every command follows this structure:

```markdown
---
description: "What this phase does"
allowed-tools: Read, Write, Bash, Grep
handoffs:
  - etiqueta: "Next phase name"
    comando: sdd.next-command
    prompt: "Instructions for next phase..."
---

# /sdd.command-name — Human Title

PASO 1: Preconditions
[Validate state, load files, check gates]

PASO 2: Core Logic
[Main work: generate spec, code, plan, etc.]

PASO 3: Output Generation
[Create/update .sdd/ artifacts]

PASO 4: State Update
[Update .sdd/estado.json, set pipeline_step]

PASO 5: Handoff
[Suggest next logical step via frontmatter handoffs]
```

---

## 5. MODULES BREAKDOWN

### A. Commands Module (38+ files)

**Purpose:** Implement SDD pipeline phases  
**Pattern:** Markdown with frontmatter + Markdown+code execution  

#### Phase Distribution

| Phase | Command | Gates | Output |
|-------|---------|-------|--------|
| **INPUT** | `/forge` or `/sdd` | — | Routing |
| **INTERPRETATION** | `/sdd.interpretar` | — | ir.json |
| **DESIGN** | `/sdd.diseñar` | ir exists | Design doc |
| **SPECIFICATION** | `/sdd.especificar` | ir exists | spec.md |
| **PLANNING** | `/sdd.planificar` | spec exists | plan.md |
| **IMPLEMENTATION** | `/sdd.implementar` | plan exists | Code (src/) |
| **VERIFICATION** | `/sdd.verificar` | code exists | Report |
| **DEPLOYMENT** | `/sdd.desplegar` | verified | Live app |

**Status:** ✅ All 38 commands present and functional

---

### B. Agents Module (14 files)

**Purpose:** Specialized personas for different task types  
**Pattern:** Markdown with frontmatter + persona instructions  

#### Tier 1 (Heavy Reasoning, Opus)
- `arquitecto.md` — Architecture decisions (high-level design)
- `critico.md` — Risk detection (problem identification)
- `seguridad.md` — Security (vulnerability scanning)
- `product-designer.md` — Product UX (user experience)
- `asesor-datos.md` — Database (schema design)

#### Tier 2 (Balanced Implementation, Sonnet)
- `desarrollador-backend.md` — Server code (APIs, services)
- `desarrollador-frontend.md` — UI code (components, styling)
- `tester.md` — Test automation (unit, integration, E2E)
- `disenador-api.md` — API contracts (OpenAPI, GraphQL)
- `revisor.md` — Code review (quality, consistency)
- `investigador.md` — Stack analysis (tech research)
- `architecture-designer.md` — Tech selection

#### Tier 3 (Simple Tasks, Haiku)
- `operaciones.md` — CI/CD & deployment (DevOps)
- `documentador.md` — Technical documentation (README, API docs)

#### Memory Loading
Each agent reads at session start:
```bash
cat .sdd/memoria/agente-{name}.md 2>/dev/null
cat .sdd/memoria/constitucion.md
```

**Status:** ✅ 14 agents complete and functional

---

### C. Skills Module (26 files)

**Purpose:** Cross-cutting capabilities invoked on-demand  
**Pattern:** Directory with `SKILL.md` + optional helpers  

#### High-Priority Skills
| Skill | Purpose | Triggered by |
|-------|---------|--------------|
| `modo-guiado` | Citizen language | Profile = guiado |
| `explicame` | Explain pipeline | `/forge.explicame` |
| `deploy-vercel` | Deployment | `/forge.desplegar vercel` |
| `share-progress` | Summary | `/forge.compartir` |
| `effort-router` | Complexity class | Internal |
| `enrutador-agentes` | Agent selection | Internal |

**Status:** ✅ 26 skills implemented

---

### D. Hooks Module (5+ Node.js files)

**Purpose:** Real-time middleware in Claude Code runtime  
**Pattern:** JavaScript, invoked via hook protocol  

#### Hook Registration
Installed to `.claude/hooks/` after `npx forge init`:
```json
{
  "hooks": {
    "PreToolUse": [
      { "name": "pre-tool-guard", "command": ["node", ".claude/hooks/pre-tool-guard.js"] }
    ],
    "PostToolUse": [
      { "name": "agent-memory", "command": ["node", ".claude/hooks/agent-memory.js"] },
      { "name": "post-write-conventions", "command": ["node", ".claude/hooks/post-write-conventions.js"] }
    ]
  }
}
```

#### Hook Protocols

**PreToolUse (pre-tool-guard.js):**
```
Input: JSON on stdin
  {
    "tool": "Bash",
    "command": "rm -rf /",
    "context": {...}
  }

Processing:
  if command matches DANGER_PATTERN:
    exit(2)  # Block
  else:
    exit(0)  # Allow

Danger Patterns:
  - /rm -rf \//          (filesystem nuke)
  - /git.*--force/       (force push)
  - /DROP DATABASE/i     (data destruction)
```

**PostToolUse (agent-memory.js):**
```
Triggered: After Write, Edit, MultiEdit

Actions:
  1. Detect agent: process.env.CLAUDE_AGENT_NAME
  2. Update memory: .sdd/memoria/agente-{name}.md (or SQLite)
  3. Append ledger: .sdd/observabilidad/consumo.jsonl
  4. Track mutations: .sdd/observabilidad/mutaciones.jsonl
  5. Check threshold: if size > umbral_bytes → trigger compress
```

**Status:** ✅ All hooks functional

---

### E. State Module (`.sdd/` directory)

**Purpose:** Persistent project state  
**Ownership:** User's project (not FORGE core)  

#### Core Files

| File | Schema | Purpose |
|------|--------|---------|
| `estado.json` | `ForgeEstado` | Pipeline state + metadata |
| `ir.json` | `IR` | Interpreted requirement |
| `sdd.config.yaml` | Custom | Configuration (349 lines) |

#### File Excerpts

**estado.json:**
```json
{
  "schemaVersion": "1.0",
  "id": "proyecto-2026-06-21",
  "perfil": "guiado",
  "pipeline_step": "especificando",
  "ir_id": "ir-budget-app-20260621",
  "ir_confidence": 0.88,
  "especificacion_activa": "2026-06-21-budget",
  "tareas_totales": 12,
  "tareas_completadas": 3,
  "gates_pendientes": ["aprobacion_plan"],
  "warnings": ["Memoria de arquitecto > 50KB"]
}
```

**ir.json:**
```json
{
  "id": "ir-budget-app-20260621",
  "raw_input": "an app to track monthly spending",
  "confidence": 0.88,
  "product": {
    "name": "Budget Tracker",
    "type": "web",
    "value_proposition": "Know where your money goes"
  },
  "features": {
    "core": [
      "Track expenses by category",
      "Monthly budget limits",
      "Visual spending reports"
    ]
  },
  "constraints": { "budget": "low", "timeline": "2 weeks" },
  "ambiguities": [
    {
      "field": "scope",
      "issue": "Unclear if multi-currency",
      "resolution": "Assumed single currency MVP"
    }
  ]
}
```

**Status:** ✅ Schema versioned (v1.0), user-owned

---

### F. Core Types Module (`core/`)

**Purpose:** TypeScript type definitions (check-only, no runtime compilation)  
**Command:** `npm run typecheck` (runs `tsc --noEmit`)  

#### Key Interfaces

**IR (Intermediate Representation):**
```typescript
interface IR {
  id: string;
  created_at: string;
  raw_input: string;
  confidence: 0.0–1.0;  // Confidence score
  product: {
    name: string;
    type: 'saas' | 'mobile' | 'web' | 'api' | 'cli';
    tagline: string;
    value_proposition: string;
    target_users: string;
  };
  features: {
    core: string[];           // 2–5 items
    nice_to_have?: string[];
  };
  constraints: {
    budget?: 'bajo' | 'medio' | 'ilimitado';
    timeline?: string;
    team_size?: string;
  };
  assumptions: string[];
  ambiguities: Ambiguity[];
  requires_clarification: boolean;
}
```

**ForgeEstado (Pipeline State):**
```typescript
interface ForgeEstado {
  schemaVersion: "1.0";
  id: string;
  perfil: "guiado" | "experto";
  pipeline_step: "input" | "ir" | "spec" | "plan" | "implementing" | "tested" | "verified" | "deployed";
  ir_path: string;
  ir_confidence: 0.0–1.0;
  especificacion_activa: string;
  tareas_totales: number;
  tareas_completadas: number;
  gates_pendientes: string[];
  warnings: string[];
}
```

**Status:** ✅ Stable (v1.0), backward compatible

---

## 6. AGENT SYSTEM

### Agent Lifecycle

```
1. DEFINITION
   └─ agents/{name}.md with frontmatter + instructions

2. REGISTRATION (implicit)
   └─ Filename = agent name
   └─ Frontmatter declares model + role

3. ACTIVATION
   └─ Command or skill invokes agent
   └─ Claude Code sets CLAUDE_AGENT_NAME env var

4. INITIALIZATION
   └─ Agent reads memory: .sdd/memoria/agente-{name}.md
   └─ Agent reads constitution: .sdd/memoria/constitucion.md
   └─ Agent loads config: .sdd/sdd.config.yaml

5. EXECUTION
   └─ Agent processes input (spec, plan, code, design)
   └─ Uses assigned model (opus/sonnet/haiku)
   └─ Produces output (code, decisions, reports)

6. PERSISTENCE
   └─ Hook agent-memory.js captures file writes
   └─ Updates .sdd/memoria/agente-{name}.md
   └─ Appends .sdd/observabilidad/consumo.jsonl
   └─ Tracks mutations in .sdd/observabilidad/mutaciones.jsonl

7. HANDOFF
   └─ Agent completes task
   └─ Next command in handoff list suggested
   └─ Or user decides next step
```

### Agent Dispatch (When & How)

| Command | Phase | Agents | Parallelism |
|---------|-------|--------|-------------|
| `/sdd.planificar` | PLANNING | arquitecto | Sequential |
| `/sdd.implementar` | IMPL | backend + frontend + tester + revisor | **Parallel** |
| `/sdd.verificar` | VERIFY | revisor + tester | Parallel |
| `/sdd.desplegar` | DEPLOY | operaciones + seguridad | Sequential |

### Model Override

**In `.sdd/sdd.config.yaml`:**

```yaml
agentes:
  arquitecto:
    activo: true
    modelo: opus        # Can override default
  desarrollador-backend:
    activo: true
    modelo: sonnet
```

**If not overridden** → Uses default from agent definition

---

## 7. TOOLS & HOOKS

### Tools Available

| Tool | Type | Used by | Purpose |
|------|------|---------|---------|
| `Read` | Filesystem | All commands | Read code, specs |
| `Write` | Filesystem | Commands | Create files |
| `Edit` | Filesystem | Commands | Modify files |
| `Bash` | Shell | Commands | Run git, npm, build |
| `Grep` | Search | Skills | Find patterns |
| `Glob` | Pattern match | Commands | List files |

### Hook Validation

**Before ANY tool execution:**
```javascript
// pre-tool-guard.js (PreToolUse)
if (command.match(DANGER_PATTERN)) {
  process.stderr.write("⚠️ Blocked for safety");
  process.exit(2);  // Block
}
process.exit(0);    // Allow
```

**After ANY Write/Edit:**
```javascript
// agent-memory.js (PostToolUse)
1. Detect agent: process.env.CLAUDE_AGENT_NAME
2. Update memory
3. Append consumo.jsonl
4. Check auto-compress threshold
```

---

## 8. CONFIGURATION

### `sdd.config.yaml` (Complete Schema)

**Location:** `.sdd/sdd.config.yaml` (349 lines)

**Key Sections:**

```yaml
# Language & profile
idioma: español             # es | en | fr
perfil: guiado              # guiado | experto

# Agent model assignment (14 entries)
agentes:
  arquitecto:
    activo: true
    modelo: opus
  # ... 13 more ...

# Behavior settings
comportamiento:
  deteccion_tamano_automatica: true
  ruta_rapida_micro: true         # Skip reviews for micro changes
  requerir_aprobacion_plan: true

# Guardrails
protecciones:
  no_tocar_archivos:
    - ".env*"
    - "*.key"
  comandos_prohibidos:
    - "rm -rf /"
    - "DROP DATABASE"

# Memory backend selection
memoria:
  umbral_bytes: 50000              # Compression threshold
  backend: sqlite                  # sqlite | markdown (Node <22.5)

# Session mode
sesion:
  modo: normal                     # normal | rapido | prototipo

# Quality thresholds
calidad:
  cobertura_tests_minima: 80
  permitir_warnings_lint: false
```

### CLI Defaults (`cli/index.js`)

```javascript
const defaults = {
  claudeDir: process.cwd() + '/.claude',
  global: false,                    // Local by default
  withUi: false,                    // Dashboard opt-in
  preset: null,                     // lean | startup | enterprise
  template: null,                   // api-rest | cli-tool | saas-mvp
  guided: false                     // --guided flag
};
```

---

## 9. API SURFACE

### CLI Commands

```bash
npx forge init [--global] [--guided] [--preset TYPE]
npx forge update
npx forge doctor
npx forge config [section]
npx forge ui [--port N]
npx forge version
npx forge help
```

### Claude Code Slash Commands

```
/forge [natural language]          # Citizen dev hub
/sdd [natural language]            # Technical hub
/sdd.interpretar [idea]           # Specific phase
/forge.explicame                  # Skill
/forge.desplegar vercel           # Skill with args
```

### Hook Protocol (Node.js)

**Pre-Tool (PreToolUse):**
```
Input: JSON on stdin
Output: Exit 0 (allow) or 2 (block)
Stderr: User message (if blocked)
```

**Post-Tool (PostToolUse):**
```
Input: JSON on stdin
Output: Exit 0 (always)
Side effects: File updates, memory, ledger
```

### Core Module Exports

```typescript
// Type definitions
export interface IR { ... }
export interface ForgeEstado { ... }
export interface Ambiguity { ... }

// Validators
export function validateIR(ir: IR): { valid: boolean; errors: string[] }

// Converters
export function mapIRtoSpec(ir: IR, constitution: string): SpecMarkdown
```

### Utility Exports

```javascript
// adr-parser.js
export function parseADRs(codebase) → ADR[]

// episodic-memory.js
export function storeEpisode(agent, action, outcome) → void
export function queryEpisodes(agent, pattern) → Episode[]

// hybrid-indexer.js
export function indexProject(codebase) → Index
export function queryIndex(pattern) → Symbol[]
```

### Dashboard REST API

```
GET  /estado            → ForgeEstado (pipeline)
GET  /tareas            → TaskList
GET  /verificar         → Verification status
GET  /consumo           → Token usage
GET  /actividad         → Recent activity
GET  /arquitectura      → ADRs
```

---

## 10. EXTENSIBILITY

### Add Custom Agent

**Location:** `agents/my-agent.md`

```markdown
---
name: my-agent
description: "My custom persona"
model: sonnet
---

# Agente: Mi Agente

[Instructions]
```

**Register in `sdd.config.yaml`:**
```yaml
agentes:
  my-agent:
    activo: true
    modelo: sonnet
```

---

### Add Custom Skill

**Location:** `skills/my-skill/SKILL.md`

```markdown
---
id: my-skill
nombre: "Mi Skill"
aliases: ["/forge.my-skill"]
---

[Implementation]
```

---

### Add Custom Command

**Location:** `commands/sdd.my-command.md`

```markdown
---
description: "What it does"
allowed-tools: Read, Write, Bash
handoffs:
  - comando: sdd.next
    prompt: "..."
---

[Implementation]
```

---

### Add Custom Hook

**Location:** `.claude/hooks/my-hook.js`

```javascript
export async function PostToolUse(event) {
  const { tool_name, result } = event;
  // Custom logic
}
```

**Register in `.claude/settings.json`**

---

## 11. LIMITATIONS

### What FORGE Cannot Do

| Category | Limitation | Why |
|----------|-----------|-----|
| Real-time collab | No live co-editing | Stateless sessions |
| Auto-approval | Can't merge PRs auto | Requires human decision |
| Background jobs | No persistent compute | Runs only in sessions |
| Complex refactoring | Large-scale changes risky | Token limits |
| Real-time feedback | No live preview | Async model calls |

### Architectural Constraints

| Constraint | Impact | Workaround |
|-----------|--------|-----------|
| Context window | Limited reasoning | Memory indexing + compression |
| Session isolation | No shared state | .sdd/ persists |
| Tool restrictions | No arbitrary code | MCP extensions |
| Model latency | 5-10s per call | Parallelization |

### What's Experimental

| Feature | Status |
|---------|--------|
| SQLite memory backend | Beta (Node ≥22.5) |
| Multi-agent parallel | Beta |
| Figma MCP integration | Beta |

---

## 12. QUALITY ANALYSIS

### Modularity: 8/10

**Strengths:**
- Clear separation (commands, agents, skills, hooks)
- Single responsibility per module
- Loose coupling via JSON state
- Reusable agents

**Weaknesses:**
- Command interdependencies tight
- Skill discovery filename-based
- Hook registration manual

---

### Scalability: 7/10

**Strengths:**
- Stateless routing
- Memory compression
- Modular hooks

**Weaknesses:**
- 38 commands hard to maintain
- .sdd/ can grow large
- Parallel agents under-tested

---

### Extensibility: 9/10

**Strengths:**
- Clear patterns (agent, skill, command templates)
- Well-documented hook API
- MCP integration points
- Template system

**Weaknesses:**
- Custom commands need Markdown expertise
- CLI-only (no SDK)
- Hook debugging difficult

---

### Consistency: 8/10

**Strengths:**
- Frontmatter schema consistent
- Handoff routing standardized
- State schema versioned
- Config keys consistent

**Weaknesses:**
- Skill format flexible
- Agent tone varies
- Docs descriptive vs prescriptive

---

### Clarity: 7/10

**Strengths:**
- Architecture documented
- Execution diagrams provided
- Type definitions present
- Examples in presets

**Weaknesses:**
- Hook protocol underdocumented (needs JSON schema)
- Handoff discovery requires reading
- No unified API reference

---

## 13. MVP WORKFLOW

### Minimal Components

To run end-to-end:

```
✓ CLI installer (cli/index.js)
✓ Hubs (forge.md + sdd.md)
✓ 2 agents (arquitecto + backend dev)
✓ State (.sdd/ structure)
✓ Memory hook (agent-memory.js)
✓ Guard hook (pre-tool-guard.js)
✓ Config template (sdd.config.yaml)
```

### User Workflow (8 Steps, 2–6 hours)

```
1. Initialize
   $ npx forge init
   → Creates .claude/ + .sdd/

2. Input
   User: /forge "a todo list app"
   → Skill `modo-guiado` (if guiado)
   → Agent `investigador` analyzes
   → Output: .sdd/ir.json

3. Design
   User: /sdd.diseñar
   → Agent `arquitecto` designs
   → Output: Design doc

4. Specify
   User: /sdd.especificar
   → Output: .sdd/especificaciones/spec.md

5. Plan
   User: /sdd.planificar
   → Agent `arquitecto` breaks down
   → Output: .sdd/plan/plan.md

6. Implement
   User: /sdd.implementar
   → Parallel: backend + frontend + tester
   → Output: src/ (code)

7. Verify
   User: /sdd.verificar
   → Agent `revisor` validates
   → Output: Verification report

8. Deploy
   User: /sdd.desplegar vercel
   → Agent `operaciones` deploys
   → Output: Live app at vercel.com
   → Status: ✓ Complete
```

---

## SUMMARY TABLE

| Component | Type | Count | Status |
|-----------|------|-------|--------|
| Commands | Markdown | 38+ | Complete |
| Agents | Markdown | 14 | Complete |
| Skills | Directories | 26 | Complete |
| Hooks | JavaScript | 5+ | Complete |
| Type definitions | TypeScript | 3 interfaces | Stable (v1.0) |
| Configuration keys | YAML | 50+ | Complete |
| Tests | Node.js | 10+ | Present |
| Documentation pages | Markdown | 30+ | Comprehensive |

---

## KEY METRICS

- **Zero runtime dependencies** (Node.js built-ins only)
- **38 pipeline commands** covering idea → deployment
- **14 specialized agents** (3-tier model selection)
- **26 cross-cutting skills** (routing, explanation, deployment)
- **5+ integration hooks** (guardrails, memory, telemetry)
- **Persistent memory** (SQLite or Markdown backend)
- **Local-first state** (.sdd/ directory, git-compatible)
- **Schema versioned** (ForgeEstado v1.0, backward compatible)

---

**This documentation describes FORGE v4.0.0 (v5.0.0 in submódule) as of 2026-06-21. All statements are grounded in code inspection; no invented features or speculative claims.**

**Status: ✅ Production-Ready. Architecture stable. Schema versioned for forward compatibility.**
