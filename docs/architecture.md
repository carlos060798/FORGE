# Arquitectura

Este documento describe el diseño del sistema FORGE: el modelo de seis capas, cómo se relacionan los componentes y cómo fluyen los datos a través del pipeline.

---

## Visión general del sistema

```mermaid
graph TD
    Usuario["👤 Desarrollador / Usuario"]
    CC["Claude Code\n(CLI / extensión IDE)"]
    FORGE["Plugin FORGE\n(.claude/)"]
    SDD[".sdd/\nEstado del proyecto"]
    Modelos["Modelos base\n(Anthropic / OpenAI / Google)"]
    UI["Dashboard\nlocalhost:3001"]

    Usuario -->|comandos slash| CC
    CC -->|despacha| FORGE
    FORGE -->|lee/escribe| SDD
    FORGE -->|invoca| Modelos
    SDD -->|servido por| UI
    Usuario -->|monitorea| UI
```

FORGE es un **plugin** — corre dentro de Claude Code, no junto a él. No existe un proceso FORGE separado. El plugin consiste en archivos Markdown (comandos, agentes, skills) y hooks JavaScript que Claude Code carga y ejecuta de forma nativa.

---

## El modelo de seis capas

```mermaid
graph BT
    L0["L0 — Modelos base\nClaude Opus · Sonnet · Haiku\nOpenAI GPT-4o · Google Gemini"]
    L1["L1 — Memoria y persistencia\n.sdd/memoria/ · estado.json · consumo.jsonl\nBackend Markdown o SQLite (Node ≥22.5)"]
    L2["L2 — Interfaz agente-computadora\n39 Comandos · 30 Skills\nAPI del pipeline"]
    L3["L3 — Herramientas nativas\nRead · Write · Edit · Bash · Task\n(integradas en Claude Code)"]
    L4["L4 — Orquestación\n14 Agentes especializados\nDespacho secuencial + paralelo"]
    L5["L5 — Gobernanza\npre-tool-guard · agent-memory\npost-write-conventions"]

    L0 --> L1
    L1 --> L2
    L2 --> L3
    L3 --> L4
    L4 --> L5
```

### L0 — Modelos base

Los modelos de lenguaje subyacentes que ejecutan cada tarea. FORGE es agnóstico de modelo en esta capa: los modelos Anthropic son el predeterminado y siempre están disponibles como respaldo, pero los proveedores OpenAI y Google son compatibles si la clave de API correspondiente está presente en el entorno.

La asignación de modelos es por agente y por nivel de esfuerzo. Los agentes estratégicos (arquitecto, crítico, revisor, seguridad) están fijados a Anthropic y siempre usan Opus. Los agentes de implementación usan Sonnet por defecto pero son configurables por proyecto.

### L1 — Memoria y persistencia

Todo el estado duradero vive en `.sdd/`. Hay dos backends de almacenamiento disponibles:

- **Markdown** (predeterminado) — archivos legibles por humanos, funciona con todas las versiones de Node
- **SQLite** (opcional) — requiere Node ≥22.5, habilita consultas indexadas más rápidas

La capa de memoria almacena: registros de actividad por agente, la máquina de estados del pipeline, artefactos JSON de IR y ProductDesign, documentos de especificación, registros ADR y el ledger de observabilidad.

### L2 — Interfaz Agente-Computadora (ACI)

Los 39 comandos y 30 skills forman la API pública de FORGE. Los comandos son archivos `.md` — prompts estructurados que definen una etapa del pipeline. Las skills son capacidades reutilizables que los comandos invocan. Ambos son Markdown; ninguno es código compilado.

### L3 — Herramientas nativas

Claude Code proporciona los primitivos: `Read`, `Write`, `Edit`, `Bash`, `Task`. FORGE no implementa su propio I/O de archivos ni ejecución de shell — los usa a través de los comandos que emite a los agentes. La herramienta `Task` habilita el despacho paralelo de agentes (Programmatic Tool Calling).

### L4 — Orquestación

Cuando un comando como `/sdd.implementar` se ejecuta, despacha tareas a agentes. Cada agente es un prompt de sistema específico de rol que restringe lo que el modelo puede hacer. Los agentes corren secuencialmente por defecto; `/sdd.analizar` y `/sdd.implementar` pueden despachar múltiples agentes en paralelo vía PTC (Programmatic Tool Calling) cuando la skill `orquestacion-ptc` está activa.

### L5 — Gobernanza

Tres hooks imponen restricciones a nivel de llamada a herramientas de Claude Code:

| Hook | Disparador | Acción |
|------|-----------|--------|
| `pre-tool-guard.js` | PreToolUse (Bash, Write, Edit) | Bloquea comandos destructivos; detecta secrets |
| `agent-memory.js` | PostToolUse (Write, Edit) | Registra cambios en memoria por agente |
| `post-write-conventions.js` | PostToolUse (Write, Edit) | Valida el archivo contra las convenciones del proyecto |

Estos hooks corren fuera del control del agente — el agente no puede eludirlos.

---

## Máquina de estados del pipeline

```mermaid
stateDiagram-v2
    [*] --> idea
    idea --> descubrimiento : /sdd.descubrir
    descubrimiento --> ir : /sdd.interpretar
    ir --> diseño : /sdd.diseñar
    diseño --> spec : /sdd.especificar
    spec --> aclaracion : marcas [NECESITA_ACLARACION] presentes
    aclaracion --> spec : /sdd.aclarar
    spec --> plan : /sdd.planificar
    plan --> tareas : /sdd.tareas
    tareas --> codigo : /sdd.implementar
    codigo --> codigo : bucle de tareas (reanudable)
    codigo --> verificacion : /sdd.verificar
    verificacion --> spec : verificación fallida
    verificacion --> despliegue : /sdd.desplegar
    despliegue --> hecho : health check pasado
    hecho --> [*]
```

La etapa actual se almacena en `estado.json → pipeline_step`. Cada transición escribe en disco antes de continuar, haciendo el pipeline reanudable en cualquier punto.

---

## Mapa de dependencias entre componentes

```mermaid
graph LR
    CLI["cli/index.js\nforge / sdd-es"] --> PM["core/project-memory.ts\nForgeEstado · IR · ProductDesign"]
    CLI --> MR["claude-hooks/model-registry.js\nDetección de proveedores · Enrutamiento por nivel"]

    CMD["commands/*.md\n39 comandos del pipeline"] --> PM
    CMD --> SK["skills/*/SKILL.md\n30 skills reutilizables"]
    CMD --> AG["agents/*.md\n14 agentes especializados"]

    AG --> MR
    AG --> TOOLS["Herramientas nativas de Claude Code\nRead · Write · Edit · Bash · Task"]

    HOOKS["claude-hooks/\npre-tool-guard\nagent-memory\npost-write-conventions"] --> PM
    HOOKS --> SDD[".sdd/ directorio de estado"]

    UI["ui/server.js\nlocalhost:3001"] --> SDD
    SK --> SDD
    PM --> SDD
```

---

## Flujo de datos: pipeline de extremo a extremo

```mermaid
sequenceDiagram
    actor Usuario
    participant CC as Claude Code
    participant CMD as Comando (.md)
    participant AG as Agente
    participant HOOK as Hooks
    participant SDD as .sdd/

    Usuario->>CC: /sdd.descubrir mi idea
    CC->>CMD: carga sdd.descubrir.md
    CMD->>AG: despacha investigador
    AG->>SDD: lee estado.json
    AG->>SDD: escribe ir.json
    HOOK->>SDD: agent-memory registra escritura
    CMD->>SDD: actualiza pipeline_step → ir
    CC->>Usuario: IR listo (confianza: 0.92)

    Usuario->>CC: /sdd.planificar
    CC->>CMD: carga sdd.planificar.md
    CMD->>AG: despacha arquitecto
    AG->>SDD: lee ir.json, spec.md
    CMD->>AG: despacha critico (paso de crítica)
    CMD->>AG: despacha seguridad (paso de seguridad)
    AG->>SDD: escribe plan.md
    CMD->>SDD: actualiza pipeline_step → plan
    CC->>Usuario: Plan listo — ¿aprobar? (s/n)

    Usuario->>CC: s
    Usuario->>CC: /sdd.implementar
    CC->>CMD: carga sdd.implementar.md
    loop para cada tarea en tareas.md
        CMD->>AG: despacha agente asignado
        AG->>HOOK: Write/Edit dispara hooks
        HOOK->>SDD: registra en consumo.jsonl
        HOOK->>SDD: actualiza agente-{nombre}.md
        AG->>SDD: actualiza .estado-tareas.json
    end
    CC->>Usuario: Implementación completa
```

---

## Estructura del directorio `.sdd/`

```mermaid
graph TD
    SDD[".sdd/"]
    SDD --> CFG["sdd.config.yaml\nConfiguración del proyecto"]
    SDD --> EST["estado.json\nMáquina de estados del pipeline"]
    SDD --> MEM["memoria/\nMemoria por agente"]
    SDD --> ESP["especificaciones/\nUn directorio por spec"]
    SDD --> ARC["arquitectura/\nRegistros ADR"]
    SDD --> DOM["dominio/\nglosario.md"]
    SDD --> OBS["observabilidad/\nconsumo.jsonl · mutaciones.jsonl"]
    SDD --> IR["ir.json\nRequisito interpretado"]
    SDD --> PD["product-design.json\nArtefacto ProductDesign"]
    SDD --> SNAP["SNAPSHOT.md\nInstantánea del estado del producto"]

    MEM --> CONST["constitucion.md\nConstitución del proyecto"]
    MEM --> AGM["agente-{nombre}.md\nRegistros por agente"]
    MEM --> IDX["indice.jsonl\nÍndice invertido para consultas"]
    MEM --> DB["memoria.db\n(SQLite, solo Node ≥22.5)"]

    ESP --> SPEC["spec.md\nCriterios de aceptación"]
    ESP --> PLAN["plan.md\nPlan técnico"]
    ESP --> TASKS["tareas.md\nLista de tareas atómicas"]
    ESP --> ETASKS[".estado-tareas.json\nCheckpoint de tareas"]
    ESP --> QA["qa.md\nResultados de QA"]
    ESP --> VER["verificacion.json\nReporte de verificación"]
```

---

## Modelo de despacho de agentes

```mermaid
graph TD
    CMD["Comando\n(ej. /sdd.planificar)"]
    ROUTER["enrutador-agentes\nskill"]
    SEQ["Despacho secuencial\n(predeterminado)"]
    PAR["Despacho paralelo\n(PTC — skill orquestacion-ptc)"]

    CMD --> ROUTER
    ROUTER --> SEQ
    ROUTER --> PAR

    SEQ --> A1["arquitecto\n(opus)"]
    SEQ --> A2["critico\n(opus)"]
    SEQ --> A3["seguridad\n(opus)"]

    PAR --> B1["desarrollador-backend\n(sonnet)"]
    PAR --> B2["desarrollador-frontend\n(sonnet)"]
    PAR --> B3["tester\n(sonnet)"]
    PAR --> AGGS["Agrega:\nPASA/FALLA + diff mínimo"]
```

El despacho paralelo reduce el uso de tokens en ~85% para la sobrecarga de orquestación — los agentes producen solo un resultado pasa/falla y un diff mínimo en lugar de todo el contexto de conversación.

---

## Modelo de ejecución de hooks

```mermaid
flowchart TD
    TOOL["Llamada a herramienta\nde Claude Code"]
    PRE{"PreToolUse\npre-tool-guard.js"}
    EXEC["Herramienta se ejecuta"]
    POST{"PostToolUse\nagent-memory.js\npost-write-conventions.js"}
    DONE["Resultado devuelto\nal agente"]

    TOOL --> PRE
    PRE -->|exit 2: bloqueado| BLOCKED["Llamada a herramienta\nbloqueada"]
    PRE -->|exit 0: permitido| EXEC
    EXEC --> POST
    POST -->|exit 2: revertir| REVERTED["Escritura\nrevertida"]
    POST -->|exit 0: ok| DONE
```

Códigos de salida de los hooks:
- `0` — permitir / continuar
- `2` — bloquear / rechazar (la llamada a herramienta no se ejecuta, o la escritura se revierte)

---

## Enrutamiento multi-proveedor de modelos

```mermaid
graph LR
    ENV["Variables de entorno"]
    ENV -->|OPENAI_API_KEY| OAI["OpenAI\ngpt-4o · gpt-4o-mini"]
    ENV -->|GOOGLE_API_KEY\nGEMINI_API_KEY| GOO["Google\ngemini-2.0-flash"]
    ENV -->|siempre disponible| ANT["Anthropic\nOpus · Sonnet · Haiku"]

    MR["model-registry.js"]
    ANT --> MR
    OAI --> MR
    GOO --> MR

    MR -->|nivel: alto| OPUS["opus / gpt-4o / gemini-2.0-flash"]
    MR -->|nivel: medio| SONNET["sonnet / gpt-4o-mini / gemini-2.0-flash"]
    MR -->|nivel: bajo| HAIKU["haiku / gpt-4o-mini / gemini-2.0-flash-lite"]

    CRITICAL["Agentes críticos\narquitecto · critico · revisor · seguridad\nasesor-datos · product-designer"]
    CRITICAL -->|siempre Anthropic| ANT
```

---

## Arquitectura de observabilidad

```mermaid
graph LR
    AG["Agente\n(cualquiera)"]
    HK["agent-memory.js\n(hook PostToolUse)"]
    CONS["consumo.jsonl\n.sdd/observabilidad/"]
    MUT["mutaciones.jsonl"]
    MEM["agente-{nombre}.md\n.sdd/memoria/"]
    SRV["ui/server.js\nGET /consumo\nGET /agentes\nGET /actividad"]
    DASH["Dashboard\nlocalhost:3001"]

    AG -->|Write/Edit| HK
    HK --> CONS
    HK --> MUT
    HK --> MEM
    CONS --> SRV
    MEM --> SRV
    SRV --> DASH
```

---

## Decisiones arquitectónicas clave

### ¿Por qué Markdown para comandos y agentes?

Que los comandos y agentes sean archivos Markdown significa que cualquiera puede editarlos sin escribir JavaScript. Pueden versionarse, compararse y revisarse en un pull request. Son la capa de configuración, no la capa de ejecución.

### ¿Por qué hooks en lugar de instrucciones en el prompt?

Las instrucciones en el prompt ("no borres archivos") pueden ignorarse u olvidarse a medida que el contexto crece. Los hooks se ejecutan a nivel de proceso del sistema operativo — no pueden ser ignorados por el modelo a mitad de una conversación.

### ¿Por qué `.sdd/` en lugar de una base de datos?

Los archivos locales son universalmente accesibles: `cat`, `git diff`, cualquier editor de texto, cualquier pipeline de CI. Una base de datos requeriría un servidor en ejecución y herramientas de migración. `.sdd/` es portable, inspeccionable y versionable.

### ¿Por qué módulos ESM con dependencias mínimas?

FORGE se instala en proyectos que pueden tener cualquier tipo de árbol de dependencias. Dos dependencias pequeñas (`acorn`, `sqlite-wasm`) mantienen `npm install` rápido y eliminan el riesgo de conflictos de versiones. Las APIs nativas de Node (`fs`, `http`, `readline`, `child_process`) son estables y no requieren npm.
