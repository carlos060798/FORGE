# Glosario de FORGE

Definiciones canónicas de conceptos clave en FORGE. Cada término aquí es la **fuente única de verdad** y debe usarse consistentemente en toda la documentación.

---

## Agente

Un **agente** es un rol especializado encarnado por un modelo de lenguaje. Cada agente tiene:

- **Nombre único** (ej: `arquitecto`, `tester`, `investigador`)
- **Instrucciones de sistema** (archivo `.md` en `.claude/agents/`)
- **Modelo asignado** (Claude Opus, Sonnet, Haiku, u otro)
- **Herramientas restringidas** (acceso solo a las herramientas necesarias para su rol)
- **Etapas en las que participa** (ej: `/sdd.planificar`, `/sdd.implementar`)

FORGE tiene **14 agentes totales**:
- 4 estratégicos (Opus): arquitecto, critico, revisor, seguridad
- 2 de diseño (Opus): product-designer, asesor-datos
- 4 de implementación (Sonnet): desarrollador-backend, desarrollador-frontend, tester, operaciones
- 4 de soporte (Sonnet): disenador-api, architecture-designer, investigador, documentador

**Ver:** [docs/agents.md](agents.md)

---

## Comando

Un **comando** es una etapa del pipeline invocable por el usuario desde Claude Code.

- **Ubicación:** archivo `.md` en `.claude/commands/`
- **Invocación:** `/sdd.comando-name [argumentos]`
- **Ejemplo:** `/sdd.descubrir crear API REST con autenticación JWT`
- **Estructura:** Markdown con instrucciones de rol y referencias a skills
- **Total en FORGE:** 39 comandos

Los 8 comandos principales que avanzan el pipeline linealmente:
1. `/sdd.descubrir`
2. `/sdd.interpretar`
3. `/sdd.diseñar`
4. `/sdd.especificar`
5. `/sdd.planificar`
6. `/sdd.tareas`
7. `/sdd.implementar`
8. `/sdd.desplegar`

**Ver:** [docs/workflows.md](workflows.md)

---

## Etapa

Una **"etapa"** del pipeline puede referirse a **tres niveles de granularidad distintos** según contexto:

### Nivel 1: Etapa conceptual (5 totales)
Las 5 fases conceptuales del ciclo de desarrollo:
1. Especificación
2. Diseño
3. Implementación
4. Verificación
5. Despliegue

### Nivel 2: Etapa ejecutable (8 totales)
Los 8 comandos principales que invoca el usuario (`/sdd.especificar`, `/sdd.implementar`, etc.)

### Nivel 3: Estado (11 totales)
Los valores posibles de `estado.json → pipeline_step` que registran el progreso exacto:
```
idea → discovery → ir → diseño → spec → aclaracion → plan → tareas → codigo → verificacion → despliegue
```

**Cuando documentación dice "etapa" sin calificar**, se refiere generalmente a **Nivel 2** (Etapa ejecutable).

**Ver:** [docs/core-concepts.md#aclaración-etapas-comandos-y-estados-del-pipeline](core-concepts.md)

---

## Hook

Un **hook** es un script JavaScript ejecutado automáticamente por Claude Code cuando ocurre un evento específico.

FORGE implementa **3 hooks** en `.claude/hooks/`:

1. **pre-tool-guard.js** (evento: PreToolUse)
   - Se ejecuta ANTES de cada llamada a Bash, Write, Edit, MultiEdit
   - Acción: Bloquea comandos destructivos o detecta secrets
   - Código de salida: 0 (permitir) o 2 (bloquear)

2. **agent-memory.js** (evento: PostToolUse)
   - Se ejecuta DESPUÉS de cada Write o Edit
   - Acción: Registra cambios en memoria persistente
   - Código de salida: 0 (continuar)

3. **post-write-conventions.js** (evento: PostToolUse)
   - Se ejecuta DESPUÉS de cada Write o Edit
   - Acción: Valida archivo contra convenciones del proyecto
   - Código de salida: 0 (válido) o 2 (revertir cambio)

**Característica crítica:** Los hooks se ejecutan a nivel de sistema operativo — el modelo NO puede eludirlos ni ignorarlos durante la conversación.

**Ver:** [docs/runtime.md](runtime.md)

---

## Modelo

Un **modelo** es un modelo de lenguaje específico de un proveedor.

Ejemplos:
- Anthropic: Claude Opus, Claude Sonnet, Claude Haiku
- OpenAI: GPT-4o, GPT-4o-mini
- Google: Gemini 2.0 Flash

**Relación con Agente:** Un agente es un ROLE. Un modelo es el LLM que ejecuta ese role.

- Cada agente está asignado a un modelo específico
- Algunos agentes están "fijos" en un proveedor (ej: agentes críticos siempre Anthropic)
- Otros agentes pueden usar múltiples proveedores según configuración

**Ver:** [docs/agents.md](agents.md), [docs/configuration.md](configuration.md)

---

## Pipeline

El **pipeline** es la secuencia completa de etapas para convertir una idea en un producto en producción.

Consta de:
- **8 comandos principales** que avanzan el pipeline de forma lineal
- **1 comando condicional** (`/sdd.aclarar`) que puede ramificarse
- **Múltiples comandos auxiliares** para operaciones especiales (release, despliegue, etc.)

Características:
- Es **reanudable**: si una sesión termina en cualquier punto, la siguiente puede reanudar desde el checkpoint más reciente
- Produce **artefactos duraderos** en `.sdd/` que persisten entre sesiones
- Implementa **SDD** (Spec-Driven Development)

**Cuando dicen "el pipeline"**, generalmente se refieren al Nivel 2 de etapas (8 comandos principales).

**Ver:** [docs/workflows.md](workflows.md), [docs/core-concepts.md#el-pipeline-de-etapas](core-concepts.md)

---

## SDD (Spec-Driven Development)

**SDD** es la **metodología** que FORGE implementa. Establece el principio fundamental:

> **Ningún código se escribe sin que exista primero una especificación escrita y aprobada por un humano.**

### Ciclo SDD

```
entender → especificar → planificar → implementar → verificar
```

### Qué contiene una especificación en FORGE

- **Criterios de aceptación** — condiciones precisas que el sistema debe satisfacer
- **Escenarios de usuario** — flujos concretos descritos desde la perspectiva del usuario
- **Restricciones técnicas** — límites de rendimiento, seguridad, compatibilidad
- **Definición de "hecho"** — qué debe ser verdad para que la feature se considere completada

### Por qué es importante

Un agente que implementa contra una especificación precisa produce código verificable. Un agente que implementa contra instrucciones vagas produce código que parece correcto pero cuyo comportamiento es impredecible.

**Ver:** [docs/core-concepts.md#desarrollo-guiado-por-especificaciones](core-concepts.md)

---

## Skill

Una **skill** es una capacidad reutilizable encapsulada en un prompt estructurado.

Características:
- **Ubicación:** archivo `SKILL.md` en ``.claude/skills/nombre-skill/`
- **Invocación:** Los comandos invocan skills — los usuarios no las invocan directamente
- **Reutilización:** Una skill puede usarse en múltiples comandos; un comando puede usar múltiples skills

**No son:**
- Scripts ejecutables
- Funciones programadas
- Procesos independientes

**Son:**
- Instrucciones de rol especializadas
- Prompts estructurados que un agente ejecuta
- Parte de un comando mayor

FORGE incluye **30 skills** organizadas en 7 categorías:
- Pipeline y orquestación (5)
- Descubrimiento e interpretación (4)
- Diseño (3)
- Calidad y validación (4)
- Memoria e indexación (5)
- Observabilidad (3)
- Compresión y despliegue (3)

**Ver:** [docs/tools.md](tools.md)

---

## Rol

**Rol** es un sinónimo de **Agente** en contextos generales. Se usa para hablar de la FUNCIÓN que desempeña.

Ejemplos:
- "El rol del arquitecto es..."
- "El agente arquitecto es..."
- Ambas frases significan lo mismo

Distinción técnica:
- **Agente** = archivo `.md` definiendo el rol + prompts + herramientas
- **Rol** = descripción de función genérica

En documentación de FORGE, preferimos **"agente"** (término técnico) sobre **"rol"** (término genérico).

**Ver:** [docs/agents.md](agents.md)

---

## Terminología relacionada

### Agente vs Modelo vs Rol

**Ejemplo:** "El agente arquitecto ejecuta Claude Opus en el rol de diseñador de arquitectura"

- **Agente** = arquitecto (nombre del role definido)
- **Modelo** = Claude Opus (LLM que lo ejecuta)
- **Rol** = diseñador de arquitectura (función que desempeña)

### Comando vs Etapa

**Ejemplo:** "La etapa de especificación se invoca con el comando `/sdd.especificar`"

- **Etapa** = especificación (concepto)
- **Comando** = `/sdd.especificar` (forma de invocarlo)

### Pipeline vs Estado vs Máquina de estados

**Ejemplo:** "El pipeline está en estado `codigo` en la máquina de estados del proyecto"

- **Pipeline** = el sistema completo
- **Estado** = el valor actual de `estado.json → pipeline_step`
- **Máquina de estados** = el grafo de transiciones posibles entre estados

---

## Otros términos importantes

### IR (Interpreted Requirement)

El **IR** es la primera transformación estructurada de una idea en lenguaje natural.

- **Producido por:** `/sdd.interpretar`
- **Almacenado en:** `.sdd/ir.json`
- **Contenido:** Requisitos, features, constraints, assumptions, ambigüedades, confidence score
- **Score de confianza:** 0.0–1.0 indicando preparación para proceder

**Ver:** [docs/core-concepts.md#el-requisito-interpretado-ir](core-concepts.md)

---

### Constitución

La **Constitución** del proyecto es el documento de principios.

- **Ubicación:** `.sdd/memoria/constitucion.md`
- **Creada con:** `/sdd.constitucion`
- **Contenido:** Stack tecnológico, principios arquitectónicos, restricciones de seguridad, convenciones de código, criterios de calidad
- **Alcance:** Es una restricción DURA, no una sugerencia

**Ver:** [docs/core-concepts.md#la-constitución-del-proyecto](core-concepts.md)

---

### ADR (Architecture Decision Record)

Un **ADR** es un registro de una decisión arquitectónica significativa.

- **Formato:** Markdown en `.sdd/arquitectura/`
- **Contenido:** Contexto, opciones consideradas, decisión, consecuencias
- **Generados por:** Agentes estratégicos durante planificación y diseño
- **Propósito:** Auditoría de por qué se tomó cada decisión técnica

**Ver:** [docs/architecture.md](architecture.md)

---

## Resumen de términos por categoría

### Metodología
- **SDD** — Spec-Driven Development

### Arquitectura
- **Agente** — Rol especializado (LLM + prompts + herramientas)
- **Modelo** — LLM específico (Opus, Sonnet, etc.)
- **Rol** — Función que desempeña (genérico)
- **Pipeline** — Secuencia de etapas
- **Etapa** — Fase del desarrollo
- **Comando** — Invocación de etapa
- **Skill** — Capacidad reutilizable
- **Hook** — Script que se ejecuta automáticamente

### Artefactos
- **IR** — Requisito Interpretado
- **Constitución** — Documento de principios del proyecto
- **ADR** — Registro de Decisiones Arquitectónicas
- **Especificación** — Criterios de aceptación
- **Plan** — Plan técnico
- **Tareas** — Desglose en tareas atómicas

---

## Cómo usar este glosario

**Si encuentras un término ambiguo en la documentación:**
1. Búscalo aquí
2. Lee la definición canónica
3. Sigue la referencia "Ver:" al documento principal

**Si estás escribiendo documentación:**
1. Usa los términos exactos definidos aquí
2. Si es primera mención en un documento, puedes hacer referencia a este glosario
3. Evita definiciones alternativas o sinónimos

**Si encuentras inconsistencia:**
- Reporta qué documento usa el término de forma distinta
- Este glosario es la fuente de verdad — los documentos deben alinearse con él

---

**Versión:** 1.0  
**Creado:** 2026-06-22  
**Mantenedor:** Principal Documentation Architect
