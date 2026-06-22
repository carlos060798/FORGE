# Análisis Comparativo: FORGE vs CrewAI vs LangGraph

> Fecha: 2026-06-21 | Propósito: evaluar qué adoptar en FORGE | Sin marketing ni narrativa

---

## 1. Tabla comparativa — 10 dimensiones

| Dimensión | FORGE | CrewAI | LangGraph |
|-----------|-------|--------|-----------|
| **Runtime host** | Claude Code (Anthropic) — sin server propio | Python framework independiente | Python framework independiente |
| **Definición de agentes** | Archivos `.md` con frontmatter YAML | Python class / YAML declarativo | Nodos en grafo Python |
| **Comunicación entre agentes** | Via archivos `.sdd/` — hub-and-spoke | Via manager orchestrator — hub-and-spoke | Via state object central |
| **Enrutamiento de modelo** | Frontmatter `model:` por agente (opus/sonnet/haiku) | Configurable por agente | Configurable por nodo |
| **Estado del pipeline** | `.sdd/estado.json` (JSON plano) | Task output chaining automático | State object tipado, persistente |
| **Memoria entre sesiones** | SQLite (Node ≥22.5) o Markdown append-only | Short-term, long-term, entity, shared | Built-in memory store + checkpoints |
| **Control de flujo** | Secuencial con gates manuales | Sequential / Hierarchical / Consensus | DAG con conditional edges y parallel |
| **Human-in-the-loop** | Gates explícitos por fase (aprobación manual) | Configurable por tarea | Nativo — pausa en cualquier nodo |
| **Gobernanza** | Local-first, self-hosted, sin cloud obligatorio | Cloud opcional (CrewAI Cloud) | Open-source MIT, LangSmith opcional |
| **Extensibilidad** | Archivos `.md` + hooks `.js` — sin compilación | Python class heredada | Nuevo nodo en grafo Python |

---

## 2. Gaps de FORGE respecto a los frameworks comparados

Gaps identificados analizando código real de FORGE (`commands/`, `agents/`, `claude-hooks/`):

| Gap | Evidencia en FORGE | Feature equivalente en competencia |
|-----|-------------------|-------------------------------------|
| **Sin chaining automático** | Usuario debe escribir `/sdd.tareas` manualmente después de `/sdd.planificar` | CrewAI: task output es input automático de la siguiente task |
| **Estado parcial** | `estado.json` no contiene artefactos inter-agente — arquitecto escribe en `.sdd/arquitectura/`, developer lo lee de forma independiente | LangGraph: state object centralizado que todos los nodos leen/escriben |
| **Routing condicional manual** | `ir.json` tiene campo `confidence` pero no hay branching automático basado en él | LangGraph: conditional edges disparan nodos distintos según output anterior |
| **Memoria compartida inexistente** | Cada agente tiene su propia `agente-{nombre}.md` — si `seguridad` necesita ver decisiones de `arquitecto`, debe releer los archivos | CrewAI: shared memory disponible para todos los agentes |
| **Sin durable execution** | Si la sesión se interrumpe en tarea 8 de 20, retomar requiere que el usuario reconstruya el contexto manualmente | LangGraph: continúa desde el checkpoint sin pérdida de estado |
| **Agentes sin goal/backstory** | Frontmatter solo tiene `name`, `model`, `tools`, `color` | CrewAI: `role`, `goal`, `backstory` — mejora coherencia del LLM al dar motivación |

---

## 3. Mejoras adoptables en FORGE

Filtro aplicado: **local-first** (sin server), **Markdown-based** (sin runtime nuevo), **bajo mantenimiento** (proyecto personal).

### PRIORIDAD ALTA

#### Mejora 1 — Chaining automático entre fases
- **Inspiración:** CrewAI task output chaining
- **Implementación:** añadir bloque `## SIGUIENTE PASO SUGERIDO` al final de cada command SDD
  ```markdown
  ## SIGUIENTE PASO SUGERIDO
  El plan está listo. ¿Ejecuto automáticamente `/sdd.tareas`?
  Responde: `sí` para continuar | `no` para revisar primero
  ```
- **Archivos a editar:** `commands/sdd.planificar.md`, `commands/sdd.tareas.md`, `commands/sdd.especificar.md`
- **Costo de mantenimiento:** bajo — es texto en `.md`, no lógica ejecutable
- **Impacto UX:** elimina la fricción de recordar qué comando sigue

#### Mejora 2 — Routing condicional por `confidence` del IR
- **Inspiración:** LangGraph conditional edges
- **Implementación:** `sdd.diseñar.md` ya lee `ir.json` — añadir condición:
  ```bash
  CONFIDENCE=$(jq -r '.confidence' .sdd/ir.json)
  if (( $(echo "$CONFIDENCE < 0.7" | bc -l) )); then
    # Lanzar preguntas de clarificación antes de diseñar
  else
    # Saltar directo al diseño
  fi
  ```
- **Archivos a editar:** `commands/sdd.diseñar.md`, `commands/sdd.especificar.md`
- **Costo de mantenimiento:** bajo — bash en el command `.md`
- **Impacto:** reduce preguntas innecesarias cuando el IR ya tiene alta confianza

#### Mejora 3 — Memoria compartida entre agentes
- **Inspiración:** CrewAI shared memory
- **Implementación:** convención de archivo compartido en `.sdd/memoria/`:
  ```
  .sdd/memoria/
  ├── agente-arquitecto.md     ← memoria privada de arquitecto
  ├── agente-seguridad.md      ← memoria privada de seguridad
  └── compartida/
      └── decisiones-clave.md  ← NUEVO: cualquier agente puede leer/escribir
  ```
  En `agents/arquitecto.md`, añadir instrucción:
  ```markdown
  Al finalizar cada análisis crítico, escribe las decisiones clave en:
  `.sdd/memoria/compartida/decisiones-clave.md`
  ```
- **Archivos a editar:** 4-5 agents (arquitecto, critico, seguridad, asesor-datos)
- **Costo de mantenimiento:** bajo
- **Impacto:** elimina duplicación de contexto cuando múltiples agentes analizan el mismo artefacto

### PRIORIDAD MEDIA

#### Mejora 4 — Roles verbosos en agentes (goal + backstory)
- **Inspiración:** CrewAI role declaration (`role`, `goal`, `backstory`)
- **Implementación:** añadir campos al frontmatter de agentes:
  ```yaml
  ---
  name: arquitecto
  description: "Diseño técnico y ADRs"
  model: opus
  color: blue
  tools: ["Read", "Grep", "Glob", "Bash"]
  goal: "Producir decisiones técnicas que el equipo pueda implementar sin ambigüedad"
  backstory: "Llevo 10 años diseñando sistemas distribuidos. Priorizo simplicidad sobre elegancia prematura."
  ---
  ```
- **Archivos a editar:** 14 agents (todos)
- **Costo de mantenimiento:** bajo — solo metadata YAML
- **Impacto:** mejora coherencia del LLM al tener un "por qué" además del "qué"

#### Mejora 5 — Durable execution — checkpoint de sesión
- **Inspiración:** LangGraph durable execution
- **Implementación:** añadir campo a `.sdd/especificaciones/{ID}/.estado-tareas.json`:
  ```json
  {
    "ultimo_checkpoint_ts": "2026-06-21T15:30:00Z",
    "ultima_tarea_completada": "T-007",
    "contexto_checkpoint": "arquitectura definida, BD modelada"
  }
  ```
  En `sdd.implementar.md`, añadir paso al inicio:
  ```bash
  CHECKPOINT=$(jq -r '.ultimo_checkpoint_ts' .sdd/especificaciones/.../estado-tareas.json)
  [ -n "$CHECKPOINT" ] && echo "Retomando desde: $CHECKPOINT"
  ```
- **Archivos a editar:** `commands/sdd.implementar.md`, schema de `.estado-tareas.json`
- **Costo de mantenimiento:** bajo
- **Impacto:** el usuario puede retomar una implementación interrumpida sin perder contexto

#### Mejora 6 — Estado inter-agente expandido
- **Inspiración:** LangGraph state object central
- **Implementación:** extender `estado.json` con sección `artefactos_sesion`:
  ```json
  {
    "schemaVersion": "1.0",
    "pipeline_step": "plan",
    "artefactos_sesion": {
      "ir_confidence": 0.85,
      "stack_decidido": "Node.js + Express + SQLite",
      "complejidad_estimada": "media",
      "agentes_activos_ultimo_plan": ["arquitecto", "disenador-api", "desarrollador-backend"]
    }
  }
  ```
  Los commands SDD que producen artefactos clave escriben en esta sección. Los commands que los consumen la leen primero.
- **Archivos a editar:** `commands/sdd.interpretar.md`, `sdd.diseñar.md`, `sdd.planificar.md`; `core/project-memory.ts` (añadir campo al interface)
- **Costo de mantenimiento:** bajo-medio
- **Impacto:** reduce el número de archivos que cada agente necesita leer para tener contexto suficiente

---

## 4. Features descartadas (filtro filosófico)

| Feature | Framework | Razón para descartar |
|---------|-----------|---------------------|
| Parallel agent execution | CrewAI / LangGraph | Requiere runtime concurrente — fuera del scope de Claude Code (single-thread por conversación) |
| Event-driven flows (Flows) | CrewAI Enterprise | Requiere servidor de eventos persistente — rompe local-first |
| Graph-based DAG visual | LangGraph | Requiere UI independiente + Python runtime — excede scope de proyecto personal |
| LangSmith observability | LangChain | Cloud vendor obligatorio — contradice gobernanza local (FORGE ya tiene `consumo.jsonl`) |
| CrewAI Cloud deploy | CrewAI | Propietario y cloud — contradice self-hosted |
| Consensus process | CrewAI | Requiere múltiples LLM calls sincrónicos — costoso y fuera del modelo de comandos FORGE |
| WebSocket streaming agents | LangGraph | Depende de infraestructura de servidor — Claude Code controla el output, no FORGE |

---

## 5. Roadmap sugerido de adopción

Las mejoras están ordenadas por impacto/costo y son independientes entre sí — se pueden implementar en cualquier orden.

| Orden | Mejora | Esfuerzo | Impacto | Dependencias |
|-------|--------|----------|---------|--------------|
| 1 | Chaining automático entre fases | 2–3h | Alto | Ninguna |
| 2 | Routing condicional por confidence | 1–2h | Medio-Alto | Ninguna |
| 3 | Memoria compartida entre agentes | 2–3h | Medio | Ninguna |
| 4 | Roles verbosos (goal + backstory) | 1–2h | Medio | Ninguna |
| 5 | Durable execution checkpoint | 2–3h | Medio | Ninguna |
| 6 | Estado inter-agente expandido | 3–4h | Medio | Mejora 1 facilita la adopción |

**Estimación total:** 11–17 horas para las 6 mejoras implementadas y testeadas.

---

## 6. Filosofía de FORGE preservada

Las 6 mejoras respetan las 5 restricciones de diseño de FORGE:

| Restricción | ¿Respetada? | Cómo |
|-------------|-------------|------|
| Local-first | ✅ | Ninguna mejora requiere servidor o cloud |
| Sin runtime propio | ✅ | Todas son convenciones en `.md` o campos JSON |
| Markdown-based | ✅ | Los commands siguen siendo archivos `.md` |
| SDD pipeline intacto | ✅ | Las mejoras aceleran el pipeline, no lo reemplazan |
| Bajo mantenimiento | ✅ | Máximo 4h por mejora, sin dependencias nuevas |

---

*Basado en análisis estático de FORGE v4.0.0 + búsqueda verificada de CrewAI y LangGraph (2026-06-21).*
*Sin contenido inventado. Los gaps están verificados en código real de `commands/` y `agents/`.*
