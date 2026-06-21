# Arquitectura de FORGE

## Arquitectura en 60 segundos

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLAUDE CODE (host)                        │
│                                                                  │
│  ┌──────────────┐    ┌─────────────────────────────────────┐    │
│  │  Usuario     │───▶│           FORGE Hub (/forge)         │    │
│  │  /forge "…"  │    │         commands/forge.md            │    │
│  └──────────────┘    └──────────────────┬──────────────────┘    │
│                                          │                        │
│                           ┌─────────────▼─────────────┐         │
│                           │     38 Comandos SDD        │         │
│                           │  commands/sdd.*.md         │         │
│                           └─────────────┬─────────────┘         │
│                                          │                        │
│          ┌───────────────────────────────▼──────────────────┐   │
│          │              14 Agentes especializados            │   │
│          │  agents/arquitecto.md    agents/tester.md        │   │
│          │  agents/desarrollador-backend.md    …            │   │
│          └───────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────┐    ┌──────────────────────────────┐   │
│  │   Hooks transversales │    │     26 Skills especializadas │   │
│  │  ├ pre-tool-guard.js  │    │  skills/modo-guiado/        │   │
│  │  ├ post-write-conv.js │    │  skills/effort-router/      │   │
│  │  ├ agent-memory.js    │    │  skills/explicame/          │   │
│  │  └ ast-indexer.js     │    │  skills/deploy-vercel/  …   │   │
│  └──────────────────────┘    └──────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                          │
              ┌───────────▼───────────┐
              │      .sdd/ (estado)   │
              │  ├ estado.json        │
              │  ├ ir.json            │
              │  ├ especificaciones/  │
              │  ├ sdd.config.yaml    │
              │  └ observabilidad/    │
              │     ├ consumo.jsonl   │
              │     └ mutaciones.jsonl│
              └───────────────────────┘
```

## Capas del sistema

### 1. CLI (`cli/index.js`)

Instalador y punto de entrada de terminal. Gestiona:
- `forge init [--template] [--preset] [--guided] [--ui]`
- `forge update` — actualiza el núcleo sin tocar `.sdd/`
- `forge doctor` — diagnóstico del sistema
- `forge ui [--port N]` — arranca el dashboard

**Zero-deps**: No requiere `node_modules` instalados en el proyecto del usuario.

### 2. Comandos SDD (`commands/sdd.*.md`)

38 archivos Markdown con instrucciones para Claude Code. Cada comando implementa una fase del pipeline SDD+TDD.

| Prefijo | Descripción |
|---|---|
| `sdd.interpretar` | Convierte idea → IR (Intermediate Representation) |
| `sdd.especificar` | IR → spec.md con HUs y CAs |
| `sdd.planificar` | Spec → plan de tareas numeradas |
| `sdd.implementar` | Plan → código con TDD |
| `sdd.verificar` | Valida criterios de aceptación |
| `sdd.desplegar` | Prepara para producción |
| `sdd.*` | 32 comandos adicionales de orquestación |

### 3. Agentes (`agents/*.md`)

14 archivos de agente con frontmatter que define modelo, rol y contexto. Claude Code los invoca según el pipeline activo.

| Agente | Modelo por defecto | Rol |
|---|---|---|
| `arquitecto` | claude-opus-4-8 | Diseño técnico de alto nivel |
| `critico` | claude-opus-4-8 | Revisión y detección de problemas |
| `seguridad` | claude-opus-4-8 | Auditoría de seguridad |
| `product-designer` | claude-opus-4-8 | Diseño de producto y UX |
| `desarrollador-backend` | claude-sonnet-4-6 | Implementación backend |
| `desarrollador-frontend` | claude-sonnet-4-6 | Implementación frontend |
| `tester` | claude-sonnet-4-6 | Tests y QA |
| `disenador-api` | claude-sonnet-4-6 | Contratos de API |
| `asesor-datos` | claude-sonnet-4-6 | Modelado de datos |
| `revisor` | claude-sonnet-4-6 | Code review |
| `documentador` | claude-haiku-4-5-20251001 | Documentación técnica |
| `operaciones` | claude-haiku-4-5-20251001 | Configuración de despliegue |
| `disenador-visual` | claude-sonnet-4-6 | CSS y diseño visual |
| `main` | (hereda de Claude Code) | Orquestador general |

### 4. Hooks (`claude-hooks/*.js`)

Hooks de Claude Code que se ejecutan antes/después de cada tool call:

| Hook | Tipo | Función |
|---|---|---|
| `pre-tool-guard.js` | PreToolUse | Bloquea herramientas destructivas peligrosas |
| `post-write-conventions.js` | PostToolUse | Verifica convenciones de código post-escritura |
| `agent-memory.js` | PostToolUse | Persiste estado, registra consumo en JSONL |
| `ast-indexer.js` | PostToolUse | Indexa archivos JS/TS para búsqueda rápida |
| `model-registry.js` | (módulo) | Registra provider/modelo por agente en consumo.jsonl |

**Contrato de hooks:** Ver `docs/COMPATIBILIDAD.md` para el esquema exacto de PreToolUse y PostToolUse.

### 5. Skills (`skills/*/SKILL.md`)

26 habilidades especializadas que los agentes pueden activar. Se invocan como slash commands o desde comandos SDD.

### 6. Core TypeScript (`core/*.ts`)

- `project-memory.ts` — interfaz `ForgeEstado` con tipado estricto
- `ir.types.ts` — tipos del Intermediate Representation
- `ir-to-spec-mapper.ts` — mapeo IR → estructura de spec

Type-check vía `npm run typecheck` (sin compilación — solo verificación).

### 7. Dashboard (`ui/`)

Servidor local Node.js + HTML vanilla:
- `ui/server.js` — endpoints REST `/estado`, `/tareas`, `/verificar`, `/consumo`, `/actividad`
- `ui/index.html` — SPA con 4 vistas (Pipeline, Tareas, Verificación, Actividad)
- `ui/src/*.js` — lógica de cada vista con polling cada 3-5 segundos

### 8. Estado (`.sdd/`)

Directorio de estado del proyecto, creado en el directorio de trabajo del usuario:

```
.sdd/
├ estado.json              # pipeline_step, spec_activa, plan_activo
├ ir.json                  # Intermediate Representation de la idea
├ sdd.config.yaml          # Configuración del proyecto
├ especificaciones/
│  └ <id>/spec.md          # Especificaciones aprobadas
├ observabilidad/
│  ├ consumo.jsonl          # Telemetría de agentes
│  └ mutaciones.jsonl       # Registro de cambios
└ memoria/
   └ *.md                   # Memoria persistente por agente
```

## Flujo de datos

```
Usuario escribe idea
      │
      ▼
/forge → sdd.interpretar → ir.json
                               │
                               ▼
                    sdd.especificar → spec.md
                                          │
                               [Gate: aprobación usuario]
                                          │
                                          ▼
                              sdd.planificar → estado-tareas.json
                                          │
                               [Gate: aprobación usuario]
                                          │
                                          ▼
                              sdd.implementar → código + tests
                                          │
                                          ▼
                              sdd.verificar → verificacion.json
                                          │
                               [Gate: criterios cumplidos]
                                          │
                                          ▼
                              sdd.desplegar → producción
```

En cada paso, `agent-memory.js` registra la actividad en `consumo.jsonl` y actualiza `estado.json`.

## Principios de diseño

1. **Zero-deps en runtime** — CLI y hooks no requieren `node_modules` del usuario
2. **Local-first** — Sin servidores propios. Todo en la máquina del usuario
3. **Contratos versionados** — `estado.json` tiene `schemaVersion` para migraciones
4. **Guardrails en PreToolUse** — Bloqueo en tiempo real, no post-hoc
5. **Observabilidad integrada** — Cada acción queda en `consumo.jsonl`
