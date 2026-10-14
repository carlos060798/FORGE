<div align="center">

# FORGE

**Desarrollo Guiado por Especificaciones para Claude Code**

*De una idea en lenguaje natural a producción — un comando a la vez.*

[![Versión](https://img.shields.io/badge/versión-5.0.0-blue)](CHANGELOG.md)
[![Licencia](https://img.shields.io/badge/licencia-MIT-green)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](package.json)
[![Tests](https://img.shields.io/badge/tests-m%C3%A1s%20de%202000-brightgreen)](docs/COBERTURA.md)

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

## Estado

> A fecha de **2026-10-12**. La versión **5.0.0 no está publicada**: en npm, `forja-mvp` sigue en 4.2.0. Lo que sigue describe la rama `feature/motor-agentico`.

**Qué es.** Un framework de desarrollo guiado por especificaciones para Claude Code. Desde 5.0.0, las tareas de código pasan por un **ciclo verificado**:

1. Un agente escribe las pruebas antes de que exista el código, y tienen que fallar.
2. Otro agente implementa. No puede tocar las pruebas.
3. Las pruebas se ejecutan en un contenedor Docker sin red, no en tu equipo.
4. El resultado lo decide el código de salida de las pruebas, no un modelo.
5. Hay un tope de gasto por sesión (2 USD por defecto).
6. Cuando el ciclo no puede terminar solo, se detiene y decides tú.

Necesita Docker en marcha y Node ≥20, y cubre proyectos en JavaScript/TypeScript, Python y Go. Sin Docker, `forge run --motor clasico` vuelve al modo de 4.x, que ejecuta en tu equipo sin aislamiento.

**Qué es opcional** (no actúa si no lo activas):

| Opción | Qué hace | Estado |
|---|---|---|
| `motor.implementador: turnos` | El implementador lee, busca y edita por pasos en vez de devolver archivos enteros | Solo con Anthropic. Probado con un modelo real en una tarea |
| `motor.mutacion: exigir` | Pausa la tarea si las pruebas detectan pocos cambios deliberados en el código | Sin ejecutar con un modelo real. Por defecto la medición solo informa |
| `sandbox.runtime` | Elige un mecanismo de aislamiento de Docker más estricto | Probado solo con `runc` |
| `forge mcp`, `forge api` | Servidor MCP y API HTTP local | Ver sus guías |
| Integraciones externas (`integraciones:` en `sdd.config.yaml`) | Traer una incidencia o ticket de GitHub, GitLab o Jira Cloud como tarea y devolver el resultado como comentario o solicitud de cambio en borrador, con aprobación humana | **En construcción y apagadas por defecto.** Hechos el núcleo y los tres adaptadores, probados contra servidores simulados; faltan la publicación con aprobación y el comando `forge integraciones`. Nunca se ejecutaron contra una plataforma real. Ver [integraciones-externas.md](docs/integraciones-externas.md) |

**Qué está probado y qué no.**

| Probado | Evidencia |
|---|---|
| `npm test` sin Docker en Windows 11 con Node 24.20: 2055 pruebas, 2045 pasan, 0 fallan, 10 omitidas el 2026-10-10 (`9180814`); 2214 pruebas, 2202 pasan, 0 fallan, 12 omitidas el 2026-10-11 (`27ea407`, según PLAN). Las de integraciones se añadieron después sin una pasada completa registrada sobre el commit actual | [docs/COBERTURA.md](docs/COBERTURA.md), [PLAN-CIERRE-BRECHAS.md](PLAN-CIERRE-BRECHAS.md) |
| Cobertura de líneas del 87,49 % de lo que cargan las pruebas de `tests/` | [docs/COBERTURA.md](docs/COBERTURA.md) |
| El ciclo con un modelo real: 24 ejecuciones de tareas pequeñas en JavaScript, Python y Go, con Anthropic (2026-10-09 y 2026-10-10) | [evidencia-2026-10-09.md](.sdd/especificaciones/2026-10-09-validacion-modelo-real/evidencia-2026-10-09.md) |
| El aislamiento con Docker real en Windows (Docker Desktop) | `verificacion.md` de cada spec en [.sdd/especificaciones/](.sdd/especificaciones/) |
| Cuatro revisiones independientes del 2026-10-09, una segunda pasada y una tercera (2026-10-11) sobre las correcciones | `revision-independiente*.md` en esas mismas carpetas |
| La comprobación de tipos (`npm run typecheck`): 0 errores (TypeScript 6.0.3; eran 36 el 2026-10-10) | PL-4 |

| No probado o pendiente | Dónde se explica |
|---|---|
| El aislamiento en Linux con Docker real: los jobs `aislamiento` y `pruebas-docker` de la integración continua no han corrido nunca, ni la matriz ni el job `tipos`. Nada en macOS | [PROBLEMAS-CONOCIDOS.md](docs/PROBLEMAS-CONOCIDOS.md), A-1 y PL-1 |
| El gasto calculado frente a lo que factura el proveedor | G-1 |
| Proyectos grandes; todo se probó en proyectos de pocos archivos | C-15 |
| Un modelo real con OpenAI u Ollama. La llamada de OpenAI no tiene ninguna prueba automática | G-3 |
| La medición por mutación con Docker real en Python y TypeScript | P-5 |
| Una cuarta revisión independiente de lo corregido en la tercera pasada, y la primera de las integraciones externas | [PLAN-CIERRE-BRECHAS.md](PLAN-CIERRE-BRECHAS.md), I-2 |
| Las integraciones externas contra GitHub, GitLab y Jira reales; la puntuación de mutación como garantía frente a un implementador adversario (N-02) | I-1, P-10 |

Antes de usarlo: [problemas conocidos](docs/PROBLEMAS-CONOCIDOS.md), [migración desde 4.2.0](docs/MIGRACION-5.0.md) y [criterios para una beta](RELEASE-CHECKLIST.md). Las rutas de `.sdd/`, los planes y `RELEASE-CHECKLIST.md` están en el repositorio; el paquete de npm no los incluye.

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
# Desde npm (el paquete se llama forja-mvp; el comando, forge)
npm install -g forja-mvp

# O clonando el repositorio
git clone https://github.com/carlos060798/FORGE && cd FORGE && npm install

# Verificar instalación
forge doctor

# En Claude Code, dentro de tu proyecto:
/forge
```

> **Instala antes de usar `npx forge …`.** El paquete es `forja-mvp`: sin instalarlo, `npx forge` descargaría otro paquete de npm llamado `forge`. Si no quieres instalarlo, usa `npx -p forja-mvp forge <comando>`. Es un paquete de línea de comandos y plugin, no una librería: no tiene API para `import`.

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

> **Seguridad:** las claves (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`) van siempre en tu entorno; «api_key» en el archivo del proyecto se ignora. Un `base_url` solo vale si es de tu propia máquina o si tu entorno lo permite con `FORGE_LLM_HOSTS` (o lo fijas con `OPENAI_BASE_URL`/`OLLAMA_BASE_URL`). Así un repositorio ajeno no puede dirigir tu clave a otro servidor.

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

- **Con Node ≥20:** ejecuta el `.js` original (lógica completa: SQLite, 8 fuentes de memoria, regex)
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

## Motor agéntico (por defecto desde 5.0.0)

Para tareas de código, FORGE puede corregirlas solo hasta que sus pruebas pasan, **ejecutando el código generado en un contenedor Docker sin red** (nunca en tu equipo), con un tope de gasto y una persona que decide cuando el ciclo no basta:

```bash
npx forge run                   # el ciclo verificado (necesita Docker)
npx forge run --motor clasico   # el modo de 4.x: ejecuta en tu equipo, sin aislamiento
npx forge probar-modelo         # prueba mínima con un modelo real, gasta como máximo 0,50 USD
npx forge mcp                   # servidor MCP: ejecutar pruebas aisladas, leer y escribir con las mismas reglas
npx forge api                   # API HTTP local con secreto
```

Desde 5.0.0 es el modo por defecto; si no puedes usar Docker, `--motor clasico` (o `motor.modo: clasico`) vuelve al comportamiento de 4.x, con su falta de aislamiento. Qué cambia al actualizar: [MIGRACION-5.0.md](docs/MIGRACION-5.0.md). Qué está probado y qué no: sección [Estado](#estado) y [PROBLEMAS-CONOCIDOS.md](docs/PROBLEMAS-CONOCIDOS.md). Guías: [ciclo verificado](docs/ciclo-verificado.md), [servidor MCP](docs/servidor-mcp.md) y [API HTTP](docs/api-http.md). Plan y estado: [PLAN-MOTOR-AGENTICO.md](PLAN-MOTOR-AGENTICO.md) y [PLAN-CIERRE-BRECHAS.md](PLAN-CIERRE-BRECHAS.md).

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
| [PROBLEMAS-CONOCIDOS.md](docs/PROBLEMAS-CONOCIDOS.md) | Límites conocidos: qué pasa, a quién afecta, cómo evitarlo y dónde está la evidencia |
| [MIGRACION-5.0.md](docs/MIGRACION-5.0.md) | Qué cambia al actualizar desde 4.2.0 sin tocar la configuración, y cómo desactivarlo |
| [COBERTURA.md](docs/COBERTURA.md) | Cobertura de pruebas por archivo, con fecha, versión de Node y comando |
| [ciclo-verificado.md](docs/ciclo-verificado.md) | Guía del ciclo verificado: configuración, aislamiento, presupuesto, pausas |
| [ESTADO-IMPLEMENTACION.md](docs/ESTADO-IMPLEMENTACION.md) | Estado por área, escrito para 4.3.0 (solo sus cifras están al día) |
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
