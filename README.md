<div align="center">

# FORGE

**Desarrollo Guiado por Especificaciones para Claude Code**

*De una idea en lenguaje natural a producción — un comando a la vez.*

[![Versión](https://img.shields.io/badge/versión-4.2.0-blue)](CHANGELOG.md)
[![Licencia](https://img.shields.io/badge/licencia-MIT-green)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](package.json)
[![Tests](https://img.shields.io/badge/tests-998%20pasando-brightgreen)](tests/)

</div>

---

**FORGE** es un framework de Desarrollo Guiado por Especificaciones (SDD) para Claude Code. Convierte ideas en productos implementados, probados y desplegados — orquestando un equipo de 14 agentes especializados a través de un pipeline estructurado de 39 comandos.

```
Tú: "Necesito una API REST con autenticación JWT y PostgreSQL"

FORGE:
  ✦ Descubre requisitos      → ir.json
  ✦ Diseña el producto       → product-design.json
  ✦ Genera la especificación → spec.md (con criterios de aceptación)
  ✦ Aprobación humana        → forge aprobar spec
  ✦ Planifica                → plan.md + tareas.md
  ✦ Ejecuta con agentes      → backend, tester, revisor, seguridad
  ✦ Verifica contra la spec  → verificacion.json
  ✦ Despliega                → health check pasado ✓
```

---

## ¿Por qué FORGE?

| Sin FORGE | Con FORGE |
|---|---|
| Cada sesión de Claude empieza en blanco | Estado persistente entre sesiones vía `.sdd/` |
| Sin memoria de decisiones anteriores | Memoria de agentes + ADRs + memoria compartida entre agentes |
| Coordinación manual de tareas | 14 agentes orquestados automáticamente |
| Sin límites sobre qué toca Claude | Guardia pre-tool enforced a nivel hook (JS + Bash) |
| El pipeline avanza sin revisión humana | Aprobación explícita requerida antes de planificar |
| Atado a un solo proveedor de LLM | Motor agnóstico: Anthropic, OpenAI, Ollama, Stub |
| Sin visibilidad de lo que ocurrió | Dashboard SSE en tiempo real en `localhost:3001` |

---

## Inicio rápido

```bash
# Clonar e instalar
git clone https://github.com/carlos060798/FORGE && cd FORGE && npm install

# Verificar instalación
forge doctor

# En Claude Code, dentro de tu proyecto:
/forge
```

→ Ver la [Guía de inicio](docs/getting-started.md) para un recorrido completo.

---

## Cómo funciona

FORGE implementa un **pipeline de 9 etapas** con transiciones guardadas:

```
idea → discovery → ir → design → spec → [aprobación] → plan → tasks → code → done
```

Cada etapa produce un **artefacto duradero** en `.sdd/`. Las etapas son reanudables: si una sesión termina a mitad de la implementación, `/sdd.implementar continuar` retoma exactamente donde se quedó.

El pipeline tiene **guards de transición**: no se puede avanzar de `spec` a `plan` sin ejecutar `forge aprobar spec`. Esto garantiza que una persona revisó y aprobó la especificación antes de que los agentes empiecen a escribir código.

→ Ver [Arquitectura](docs/architecture.md) para el diagrama completo del sistema.

---

## Módulos del runtime

| Módulo | Archivo | Función |
|---|---|---|
| State machine | `core/state-machine.js` | Transiciones con guards — ir_generado, spec_aprobado, plan_activo |
| Orchestrator | `core/orchestrator.js` | Ejecuta tareas con agentes, retry, circuit breaker |
| Motor LLM | `core/llm-providers/` | Anthropic / OpenAI / Ollama / Stub — auto-detectado |
| Decision store | `core/decisions/` | SQLite + TF-IDF, búsqueda semántica de ADRs |
| Event log | `core/event-log.js` | Registro append-only de eventos del pipeline |
| Agent registry | `core/agent-registry.js` | Resuelve qué agente ejecuta cada tarea |
| CLI runner | `cli/index.js` | `forge status/run/resume/aprobar/doctor` |
| Guardia pre-tool | `claude-hooks/pre-tool-guard.js` + `.sh` | Bloquea herramientas prohibidas antes de cada llamada |
| Memoria de agentes | `claude-hooks/agent-memory.js` + `.sh` | Registra decisiones, ADRs y memoria compartida |
| AST indexer | `claude-hooks/ast-indexer.js` | Índice de símbolos JS/TS para recuperación eficiente |
| Dashboard | `ui/server.js` | SSE tiempo real — estado, consumo, eventlog |

---

## Agentes

FORGE despacha trabajo a **14 agentes especializados**. Cada agente tiene un rol fijo, un modelo configurado y acceso solo a las herramientas que necesita.

**Niveles:** Estratégico (Opus), Diseño (Opus), Implementación (Sonnet), Soporte (Sonnet)

**Preset lean** (por defecto): activa **6 agentes** — arquitecto, asesor-datos, disenador-api, desarrollador-backend, desarrollador-frontend, tester — todos con modelo sonnet. Los 8 restantes se activan individualmente.

→ [Ver tabla completa en Agentes](docs/agents.md)

---

## Motor LLM agnóstico

FORGE funciona con cualquier proveedor compatible. El proveedor se resuelve automáticamente:

```bash
# Variable de entorno
FORGE_LLM_PROVIDER=openai forge run

# O en sdd.config.yaml
llm:
  provider: ollama
  base_url: http://localhost:11434
  model: sonnet   # alias → qwen2.5-coder:7b
```

Proveedores soportados: **Anthropic** (por defecto), **OpenAI** (y compatibles: Azure, GitHub Models), **Ollama** (modelos locales), **Stub** (determinístico, para CI).

`forge doctor` valida la conexión al proveedor activo, mide latencia y verifica el formato de respuesta.

---

## Aprobación humana en el pipeline

El pipeline tiene un punto de control obligatorio entre `spec` y `plan`:

```bash
# Después de que FORGE genera la spec, la revisas y apruebas
forge aprobar spec

# Solo entonces el pipeline puede avanzar a planificación
/sdd.planificar
```

Sin esta aprobación, el guard de la state machine bloquea el avance. Esto no es configurable — es una decisión de diseño deliberada para mantener al humano en el bucle antes de que los agentes empiecen a escribir código.

---

## Observabilidad

```bash
forge ui            # dashboard en localhost:3001 (SSE tiempo real)
forge status        # presupuesto USD y nivel del circuit breaker
forge logs          # historial consumo.jsonl
forge doctor        # verifica API key, hooks, LLM y SQLite
```

El dashboard recibe actualizaciones por SSE en tiempo real — estado del pipeline, consumo de tokens, event log — sin polling. Los datos vienen de cuatro archivos JSONL en `.sdd/`:

- `consumo.jsonl` — tokens y USD por operación
- `mutaciones.jsonl` — cada write/edit con qué agente lo hizo
- `events.jsonl` — transiciones del pipeline y eventos del orchestrator
- `agent-tool-audit.jsonl` — auditoría de cada herramienta invocada por cada agente

---

## Hooks multi-lenguaje

Los hooks funcionan en proyectos de cualquier stack — no solo Node.js:

- **Con Node ≥18:** ejecuta el `.js` original (lógica completa: SQLite, 8 fuentes de memoria, regex)
- **Sin Node:** ejecuta el `.sh` equivalente (lógica mínima en Bash: bloqueos críticos + Markdown)

Esto permite usar FORGE en proyectos Python, Go, Rust, PHP o cualquier lenguaje sin dependencia de Node en el proyecto destino.

---

## Configuración

```yaml
# .sdd/sdd.config.yaml
perfil: guiado          # guiado | experto

llm:
  provider: anthropic   # anthropic | openai | ollama | stub
  model: sonnet

agentes:
  arquitecto:
    activo: true
    modelo: opus

calidad:
  cobertura_tests_minima: 80

memoria:
  backend: sqlite       # sqlite (Node ≥22.5) | markdown
```

→ Ver [Configuración](docs/configuration.md) para todas las opciones.

---

## Extender FORGE

```bash
/sdd.crear-agente    # nuevo agente con rol y herramientas específicas
/sdd.crear-mcp       # integración MCP personalizada
```

O manualmente: añade archivos `.md` a `commands/`, `agents/` o `skills/` y regístralos en `.claude-plugin/plugin.json`.

→ Ver [Extender FORGE](docs/extending-forge.md).

---

## Documentación

### Principal

| Documento | Descripción |
|---|---|
| [Introducción](docs/introduction.md) | Qué es FORGE y por qué existe |
| [Inicio rápido](docs/getting-started.md) | Primera ejecución, recorrido guiado |
| [Arquitectura](docs/architecture.md) | Diseño del sistema, capas, diagramas |
| [Conceptos fundamentales](docs/core-concepts.md) | SDD, IR, pipeline, estado, memoria |
| [Runtime](docs/runtime.md) | Hooks, guardias, memoria, registro de modelos |
| [Agentes](docs/agents.md) | Los 14 agentes, roles, modelos, herramientas |
| [Flujos de trabajo](docs/workflows.md) | Etapas del pipeline, flags, ejemplos |
| [Configuración](docs/configuration.md) | Referencia de sdd.config.yaml |
| [Extender FORGE](docs/extending-forge.md) | Agentes, comandos y hooks personalizados |
| [Referencia de API](docs/api-reference.md) | CLI, ProjectMemory, tipos IR |
| [Limitaciones](docs/limitations.md) | Restricciones conocidas y compromisos de diseño |
| [Ejemplos](docs/examples.md) | Recorridos completos de extremo a extremo |

### Guías especializadas

| Documento | Descripción |
|---|---|
| [ESTADO-IMPLEMENTACION.md](docs/ESTADO-IMPLEMENTACION.md) | Qué funciona hoy, qué no, checklist de prerequisitos |
| [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Errores por fase con solución paso a paso |
| [EJEMPLO-API-REST.md](docs/EJEMPLO-API-REST.md) | Walkthrough API REST + JWT + PostgreSQL |
| [MEMORIA-Y-OBSERVABILIDAD.md](docs/MEMORIA-Y-OBSERVABILIDAD.md) | API de memoria persistente, SQLite, compresión |
| [RELACION-CON-CLAUDE-CODE.md](docs/RELACION-CON-CLAUDE-CODE.md) | Mapping FORGE ↔ primitivas nativas de Claude Code |
| [COMPATIBILIDAD.md](docs/COMPATIBILIDAD.md) | Contrato de hooks — versiones verificadas |
| [ANALISIS-COMPARATIVO-FRAMEWORKS.md](docs/ANALISIS-COMPARATIVO-FRAMEWORKS.md) | FORGE vs CrewAI vs LangGraph — 10 dimensiones |
| [SEGURIDAD-PARA-NOTECNICOS.md](docs/SEGURIDAD-PARA-NOTECNICOS.md) | Seguridad explicada sin jerga técnica |
| [QUE-PASA-SI-FALLA.md](docs/QUE-PASA-SI-FALLA.md) | Recuperación cuando algo sale mal |
| [INTEGRACIONES.md](docs/INTEGRACIONES.md) | MCPs: Vercel, GitHub, Figma |

---

## Contribuir

Ver [CONTRIBUTING.md](CONTRIBUTING.md). Reportes de bugs y propuestas de agentes bienvenidos vía GitHub Issues.

---

## Licencia

MIT — ver [LICENSE](LICENSE).
