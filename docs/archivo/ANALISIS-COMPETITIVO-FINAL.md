# Análisis Competitivo — FORGE v4.2.0

> Fecha: 2026-06-27 | Propósito: comparativa honesta de FORGE vs la competencia relevante para el desarrollador técnico individual o equipo pequeño con IA en 2026.

---

## El encuadre correcto: FORGE no compite con agentes de código

FORGE no es un IDE plugin ni un agente de autocompletado. Compite con **el marco de trabajo completo del desarrollador técnico individual o equipo pequeño que usa IA**. Esto incluye tres categorías al mismo tiempo:

| Categoría | Competidores representativos | Lo que FORGE reemplaza |
|---|---|---|
| **Proceso y metodología** | Scrum, Shape Up, Kanban personal, GTD para devs | Pipeline SDD con gates de aprobación — el proceso ya no es manual |
| **Orquestación de agentes** | CrewAI, LangGraph, AutoGPT, AgentOps | 14 agentes con memoria, enforcement y handoff — sin servidor Python |
| **Documentación de especificación** | PRDs en Notion, ADRs en Confluence, GitHub issue templates | `.sdd/` local-first con ir.json, spec.md, ADRs en SQLite — la spec vive con el código |

**La propuesta única de FORGE:** los tres en un solo sistema, local-first, sin servidor, con el LLM ya instalado (Claude Code o handoff portable). Ningún competidor cubre las tres categorías simultáneamente.

```
Scrum/Shape Up    +    CrewAI/LangGraph    +    Notion/Confluence
   (proceso)         (orquestación agentes)      (spec y decisiones)
       │                     │                          │
       └─────────────────────┴──────────────────────────┘
                             │
                           FORGE
```

---

## Tabla comparativa — 8 dimensiones transversales

| Dimensión | FORGE | Scrum / Shape Up | CrewAI | LangGraph | Notion PRDs / Confluence ADRs |
|---|---|---|---|---|---|
| **Cobertura del ciclo** | Completo: spec → agentes → código → deploy | Solo proceso (no ejecuta) | Orquestación (no spec, no proceso) | Orquestación (no spec, no proceso) | Solo documentación (no ejecuta) |
| **Persistencia de decisiones** | SQLite local + JSONL, versionable con git | Slack / notas / memoria humana | In-memory o store vectorial externo | State object (efímero entre deployments) | Notion/Confluence — desconectado del código |
| **Runner sin LLM** | ✅ `forge status/step/validate` sin LLM | ✅ (es proceso humano) | ❌ requiere Python + LLM | ❌ requiere Python + LLM | ✅ (es texto estático) |
| **Portabilidad de artefactos** | ✅ Spec Kit — consumible sin FORGE ni Claude | N/A | ❌ ligado a Python/LangChain | ❌ ligado a Python/LangChain | ✅ (PDF/HTML exportable) |
| **Curva de aprendizaje** | Media — pipeline SDD requiere entender el flujo | Alta (Scrum certification, rituales) | Alta (Python, grafos de agentes) | Muy alta (DAGs tipados, LangSmith) | Baja (interfaz familiar) |
| **Costo total** | Claude Code subscription + zero infra | Licencias Jira/Linear + tiempo de equipo | Python infra + vector DB + LLM API | Python infra + LangSmith opcional + LLM API | Notion/Confluence subscription |
| **Vendor lock-in** | Claude Code para el valor completo; Spec Kit portable | Herramientas del ecosistema (Jira, Linear) | LangChain ecosystem | LangChain/LangSmith ecosystem | Notion/Atlassian |
| **Gobernanza local** | ✅ 100% local-first — sin cloud obligatorio | Variable (Jira Cloud vs Server) | ❌ Cloud por defecto (CrewAI Cloud) | ✅ open-source pero LangSmith es cloud | ❌ Notion es SaaS puro |

---

## FORGE vs metodologías (Scrum, Shape Up, Kanban)

### Qué hacen bien las metodologías que FORGE no hace

- **Comunicación de equipo:** Scrum/Shape Up estructuran cómo un equipo comunica progreso, bloqueos y decisiones. FORGE no reemplaza Slack, Linear ni las reuniones de equipo.
- **Gestión de stakeholders:** Shape Up tiene el concepto de "betting table" y ciclos de 6 semanas con autonomía de equipo. FORGE no tiene ese nivel de gestión de producto.
- **Retrospectivas y mejora de proceso:** Scrum tiene ceremonias de mejora explícitas. FORGE no.

### Dónde FORGE gana a las metodologías

- **Ejecución automática del pipeline:** Scrum define el proceso pero un desarrollador individual todavía tiene que ejecutar cada paso manualmente. FORGE ejecuta spec → plan → tasks → código con agentes.
- **ADRs que no se pierden:** en Scrum, las decisiones de arquitectura viven en Confluence o en la memoria del tech lead. En FORGE, se detectan automáticamente del código y se persisten en SQLite con búsqueda semántica.
- **Estado persistente entre sesiones:** Scrum tiene el backlog como estado. FORGE tiene `estado.json` + toda la historia de mutaciones y consumo. Si paras el trabajo y lo retomas en 3 meses, el pipeline sabe exactamente dónde estaba.
- **Sin rituales de coordinación:** para el desarrollador individual o equipo de 2-3, los rituales de Scrum son overhead. FORGE da estructura sin reuniones.

---

## FORGE vs orquestadores de agentes (CrewAI, LangGraph)

### Qué hacen bien los orquestadores que FORGE no hace

- **Chaining automático de tareas:** CrewAI encadena el output de un agente como input del siguiente automáticamente. FORGE requiere gates manuales entre fases (intencionalmente, para human-in-the-loop).
- **Routing condicional sofisticado:** LangGraph permite grafos de decisión complejos con conditional edges. FORGE tiene transiciones lineales con guards simples.
- **Paralelismo real:** LangGraph puede ejecutar nodos en paralelo en el grafo. FORGE es secuencial (el PTC de "orquestación paralela" es pseudocódigo, no código ejecutable).
- **Ecosistema Python:** CrewAI/LangGraph tienen acceso a toda la librería Python (numpy, pandas, requests, etc.) para lógica de agente. FORGE está en Node.js ESM.

### Dónde FORGE gana a los orquestadores

**Memoria como ventaja diferencial — local-first es la arquitectura correcta:**

CrewAI y LangGraph, para tener memoria semántica real, necesitan un store vectorial externo: Pinecone, Weaviate, ChromaDB, o pgvector. Esto introduce:
- Latencia de red (cada consulta de memoria va a un servicio remoto)
- Costo adicional (Pinecone cobra por vector + queries)
- Vendor lock-in (si Pinecone cambia precios, tu stack de memoria migra)
- Fallo en modo offline (sin internet, sin memoria)

FORGE usa SQLite local + JSONL. Las decisiones y episodios están en disco, versionables con git, disponibles offline, sin costo extra, deterministas. Para el desarrollador individual, **local-first no es un compromiso técnico — es la arquitectura óptima**. No hay beneficio en escalar a Pinecone cuando el proyecto tiene 200 ADRs.

El TF-IDF léxico de FORGE (sin embeddings LLM) es suficiente para búsqueda de ADRs y episodios porque los documentos de decisión usan vocabulario específico del dominio. No necesitas embeddings semánticos para encontrar "decisión sobre JWT" cuando buscas "autenticación token".

**Sin servidor, sin Python, sin grafo:**

- CrewAI: `pip install crewai`, definir crew en Python, configurar LLM, configurar tools, configurar memoria store. Para un proyecto nuevo: 1-2 horas de setup.
- LangGraph: grafo Python tipado, nodes, edges, state schema, checkpointers. Para un proyecto no trivial: varios días de setup y comprensión de la abstracción.
- FORGE: `npx forge init`, `/forge "mi idea"`. Para un proyecto nuevo: 10 minutos.

**Enforcement real:**

Los orquestadores confían en que los agentes sigan las instrucciones del prompt. FORGE tiene enforcement a nivel de hook del sistema operativo: el agente `arquitecto` **no puede** hacer Write aunque su prompt diga que sí. Esto no es posible con CrewAI o LangGraph sin lógica de validación adicional.

---

## FORGE vs documentación de spec (Notion PRDs, Confluence ADRs, GitHub templates)

### Qué hacen bien las herramientas de doc que FORGE no hace

- **Colaboración en tiempo real:** Notion y Confluence tienen edición colaborativa, comentarios, versiones, permisos por sección. FORGE es single-user local.
- **Búsqueda full-text potente:** Notion tiene búsqueda indexada en toda la workspace. FORGE tiene TF-IDF local.
- **Integración con ecosistema de empresa:** Confluence se integra con Jira. Notion con Slack, GitHub, Linear. FORGE no tiene estas integraciones.

### Dónde FORGE gana a las herramientas de doc

**La spec vive con el código:**

El problema fundamental de Notion PRDs y Confluence ADRs es que son documentos estáticos desconectados del repositorio. La spec de Notion se desactualiza cuando el código cambia. Los ADRs de Confluence se pierden en el tiempo. FORGE mantiene la spec en `.sdd/` dentro del propio repositorio — se versiona con git, siempre está en sync con el estado actual.

**La spec es ejecutable:**

Un PRD en Notion es un documento que un desarrollador lee y luego implementa. El `spec.md` de FORGE es el contrato que los agentes implementan — no hay brecha de interpretación. El agente `arquitecto` lee `ir.json` y genera `spec.md` directamente. El agente `tester` lee `spec.md` y genera los tests de aceptación. La spec no es documentación: es la fuente de verdad del pipeline.

**Decisiones que no se pierden:**

Los ADRs en Confluence son registros históricos que nadie lee. Los ADRs de FORGE en SQLite se buscan semánticamente en tiempo real: cuando el agente `arquitecto` está tomando una decisión sobre autenticación, el sistema recupera automáticamente las decisiones previas relevantes. La memoria no es archivo muerto — es memoria activa consultable.

---

## ¿FORGE resuelve realmente el problema?

### El problema que FORGE resuelve

**Un desarrollador técnico individual o equipo pequeño (≤5) que quiere construir software con IA de manera estructurada, reproducible y sin perder el contexto entre sesiones.**

Evidencia de que lo resuelve:
- El pipeline SDD garantiza que la idea se especifica antes de implementar — elimina el "vibe coding" sin estructura.
- El estado persiste en `.sdd/` — retomar el trabajo después de semanas es determinista.
- Los ADRs en SQLite garantizan que las decisiones de arquitectura se acumulan y son consultables — no se repiten los mismos errores.
- El enforcement de agentes read-only garantiza que el agente `critico` no modifica código aunque el LLM quisiera hacerlo.
- El runner portable garantiza que el pipeline se puede gestionar sin depender del estado de la sesión de Claude Code.

### El problema que FORGE NO resuelve

- **Colaboración en equipo grande:** `estado.json` no tiene locking distribuido. Dos desarrolladores trabajando en paralelo pueden producir conflictos. FORGE es single-user o se necesita convenio de "una sesión a la vez por feature branch".
- **Velocidad de prototipado extremo:** si quieres un MVP en 2 horas sin estructura, Bolt.new o v0 son más rápidos. FORGE invierte tiempo en spec y planning — ese tiempo se recupera en calidad, no en velocidad inicial.
- **Equipos con proceso establecido:** si el equipo ya tiene Jira + Confluence + sprints funcionando, FORGE añade complejidad sin beneficio claro. No está diseñado para sumarse a un proceso existente — está diseñado para reemplazarlo.

---

## ¿Es fácil de usar FORGE?

### El camino simple (modo plugin)

```bash
npx forge init
# En Claude Code:
/forge "una API para gestionar tareas con autenticación JWT"
```

Esto es genuinamente simple. El pipeline se lanza, los agentes hacen el trabajo, se piden aprobaciones en los gates, y al final hay código. Para alguien familiarizado con Claude Code, la curva de aprendizaje es de horas, no días.

### La curva real (personalización y pipeline completo)

La dificultad aumenta cuando:

1. **Quieres entender qué está pasando:** el pipeline SDD tiene 9 fases con nomenclatura específica (IR, Discovery, spec, plan). Sin leer la documentación, los nombres no son intuitivos.
2. **Algo falla y necesitas recuperar:** `forge reset --force`, `forge step ir --force`, entender qué guard está bloqueando qué transición — requiere conocer la state machine.
3. **Quieres personalizar agentes:** editar frontmatter YAML, entender qué tools están permitidos, añadir a `READ_ONLY_AGENTS` en `pre-tool-guard.js` si es un agente nuevo.
4. **Usas el runner portable:** sin Claude Code, necesitas entender el sistema de adaptadores, Spec Kit, y cómo integrar los artefactos con el agente externo.

**Veredicto de facilidad de uso:**
- `/forge "idea"` → muy fácil (10 min para el primer proyecto)
- Pipeline completo con personalizaciones → medio (1-2 días para dominar)
- Runner portable + adaptadores → medio-avanzado (documentación necesaria, pero funciona)

---

## Para quién ES FORGE

FORGE encaja cuando se cumplen 3+ de estas condiciones:

1. Eres desarrollador técnico individual o equipo ≤5
2. Quieres estructura metodológica sin overhead de Scrum
3. Usas Claude Code (o estás dispuesto a hacerlo)
4. Tus proyectos duran semanas o meses (no prototipos de 2 horas)
5. Quieres que las decisiones de arquitectura se acumulen y sean consultables
6. Valoras el control total sobre el proceso (sin SaaS, sin cloud obligatorio)
7. Quieres que el pipeline sea reproducible entre sesiones

---

## Para quién NO ES FORGE

- **Diseñador no técnico** que quiere código sin entender el pipeline — usa Bolt.new o v0.
- **Equipo grande** (>10 personas) con Jira/Confluence ya funcionando — el overhead no vale.
- **Prototipo de fin de semana** donde la velocidad es más importante que la estructura.
- **Quien necesita colaboración en tiempo real** en los documentos de spec — FORGE es local-first single-user.
- **Quien quiere managed cloud** para todo — FORGE es explícitamente anti-SaaS en su arquitectura.

---

## Cuadro de posicionamiento

```
                        ESTRUCTURA DEL PROCESO
                        Alta ◄─────────────────────► Baja

EJECUCIÓN   Alta │  [FORGE]          LangGraph     
AUTOM.           │  CrewAI           AutoGPT        Bolt.new
                 │                                  v0
            Baja │  Scrum            Notion PRDs    GitHub Issues
                 │  Shape Up         Confluence     
                 └─────────────────────────────────────────────
                   Local-first              Cloud / SaaS
```

FORGE ocupa el cuadrante único: alta estructura de proceso + alta ejecución automática + local-first. Ningún otro sistema está en ese cuadrante.
