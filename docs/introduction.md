# Introducción

FORGE es un **framework de Desarrollo Guiado por Especificaciones (SDD)** que corre completamente dentro de [Claude Code](https://claude.ai/code). Provee un pipeline estructurado, un equipo de 14 agentes de IA especializados, memoria persistente de proyecto y un conjunto de restricciones constitucionales, para que construir software desde una idea en lenguaje natural sea un proceso repetible y auditable, no una conversación improvisada.

**Nota:** Si encuentras términos poco claros (SDD, agente, comando, skill, hook, pipeline, etapa), consulta el [Glosario](GLOSARIO.md) para definiciones canónicas.

---

## El problema que resuelve FORGE

Claude Code es un asistente de programación capaz, pero por defecto no tiene memoria de sesiones anteriores, ni contexto arquitectónico, ni coordinación entre distintos tipos de trabajo (diseño, implementación, testing, seguridad), ni mecanismo para respetar las restricciones que tu equipo ha decidido. Cada sesión empieza desde cero.

Para tareas pequeñas y únicas eso está bien. Para construir software real, genera cuatro problemas que se acumulan:

**1. Pérdida de contexto.** Los requisitos decididos en la sesión uno son desconocidos en la sesión dos. Las decisiones arquitectónicas se vuelven a debatir. El asistente redescubre tu stack desde cero cada vez.

**2. Sin especialización.** El mismo modelo de propósito general escribe código frontend, revisa seguridad, diseña esquemas de base de datos y escribe documentación. No puede estar en el modo correcto para todos ellos al mismo tiempo.

**3. Sin disciplina impuesta.** Sin restricciones, el asistente puede borrar archivos silenciosamente, ignorar tus convenciones de nomenclatura, saltarse los tests cuando hay presión de tiempo, o desviarse de la especificación.

**4. Sin visibilidad.** No puedes ver qué cambió el asistente, por qué lo cambió, qué agente tomó la decisión, ni cómo el proyecto en conjunto está progresando.

FORGE resuelve los cuatro.

---

## Qué es FORGE

FORGE es un **plugin para Claude Code** — un conjunto de comandos, agentes, skills y hooks que instalas una vez y que corren dentro de cada sesión de Claude Code en tu proyecto.

No es un proceso separado. No es un servicio web. No es un wrapper alrededor de la API. Corre completamente dentro del modelo de ejecución de Claude Code, usando el sistema de hooks nativo de Claude Code para interceptar y aumentar cada llamada a herramientas.

Concretamente, FORGE instala:

- **39 [comandos](GLOSARIO.md#comando) slash** (archivos `.md` en `.claude/commands/`) — las etapas del pipeline y operaciones de utilidad
- **14 definiciones de [agentes](GLOSARIO.md#agente)** (archivos `.md` en `.claude/agents/`) — prompts de sistema específicos por rol con restricciones de herramientas
- **30 [skills](GLOSARIO.md#skill)** (archivos `.md` en `.claude/skills/`) — capacidades reutilizables invocadas por los comandos
- **6 [hooks](GLOSARIO.md#hook) de runtime** (archivos `.js` + `.sh` en `.claude/hooks/`) — guardia PreToolUse, memoria PostToolUse, convenciones PostToolUse; cada hook tiene una versión `.sh` que funciona sin Node
- **Un directorio de estado del proyecto** (`.sdd/`) — almacenamiento duradero para todos los artefactos del pipeline

---

## Cómo se relaciona FORGE con SDD

**Desarrollo Guiado por Especificaciones** es la metodología que implementa FORGE. La idea central es que cada pieza de implementación debe ser trazable a una especificación escrita y aprobada por humanos. El flujo es siempre:

```
entender → especificar → [aprobación humana] → planificar → implementar → verificar
```

No:

```
pedir → generar → esperar lo mejor
```

La especificación es un artefacto de primera clase. Contiene criterios de aceptación escritos antes de que se escriba cualquier código. La etapa de verificación al final comprueba el comportamiento real del código contra esos criterios, no contra lo que el agente cree que construyó.

---

## Lo que FORGE no es

**FORGE no es un framework de agentes.** No provee un SDK de Python ni un motor de ejecución de grafos. Es un framework de ingeniería de prompts — sus agentes son archivos Markdown con instrucciones de rol, no objetos con métodos.

**FORGE no es un servicio en la nube.** No existe ningún servidor FORGE. El dashboard en `localhost:3001` lee archivos de tu propio directorio `.sdd/`. Nada sale de tu máquina excepto las llamadas normales a la API de Claude Code que ya estabas haciendo.

**FORGE no reemplaza tus herramientas.** No gestiona tu repositorio Git, tu pipeline de CI ni tu infraestructura de despliegue. Se integra con ellos vía comandos (`/sdd.desplegar`, `/sdd.release`) pero no los posee.

**FORGE no es una plataforma de automatización de propósito general.** Es opinionado sobre el desarrollo de software. Si quieres automatizar algo no relacionado con construir software, FORGE es la herramienta equivocada.

---

## Principios de diseño

Los siguientes principios son observables en todo el código y guiaron cada decisión de diseño:

### Artefactos sobre conversaciones

Cada salida significativa se escribe en disco en `.sdd/`. El IR, el diseño del producto, la spec, el plan, la lista de tareas, las memorias de agentes, los ADRs, el reporte de verificación — todos son archivos que puedes leer, comparar y versionar. La conversación es efímera; los artefactos no lo son.

### Dependencias externas mínimas

FORGE tiene exactamente dos dependencias npm: `acorn` (parser AST de JavaScript) y `@sqlite.org/sqlite-wasm` (backend de memoria opcional). Todo lo demás usa APIs nativas de Node.js. Es una elección deliberada: cuantas menos cosas puedan romperse en la instalación, más confiablemente funciona FORGE en distintos entornos.

### Hooks como gobernanza

En lugar de confiar en que el agente siga instrucciones, FORGE usa los hooks PreToolUse y PostToolUse de Claude Code para imponer restricciones en tiempo de ejecución. `pre-tool-guard.js` bloquea comandos destructivos antes de que se ejecuten. `agent-memory.js` registra cada cambio de archivo después de que ocurre. Estas no son sugerencias — son compuertas duras.

### Reanudabilidad por defecto

Cada etapa del pipeline escribe su checkpoint en `.sdd/`. Si una sesión termina a mitad de la implementación, `/sdd.implementar continuar` lee `.sdd/especificaciones/{id}/.estado-tareas.json` y retoma desde la última tarea completada. No se pierde ningún trabajo.

### Dos modos para dos audiencias

FORGE tiene un modo `guiado` para no-programadores y un modo `experto` para desarrolladores. En modo guiado, las confirmaciones están en lenguaje llano, la jerga técnica se traduce y el pipeline pausa para aprobación humana en cada etapa mayor. En modo experto, el pipeline avanza más rápido y expone más detalle técnico.

---

## Resumen de la arquitectura

FORGE está organizado en seis capas:

| Capa | Contenido |
|------|-----------|
| **L0 — Modelos** | Anthropic (Opus/Sonnet/Haiku), OpenAI, Ollama, Stub — motor agnóstico auto-detectado |
| **L1 — Memoria** | `.sdd/memoria/` — Markdown por agente o SQLite; memoria compartida entre agentes |
| **L2 — Interfaz** | 39 comandos, 30 skills — la API del pipeline |
| **L3 — Herramientas** | Herramientas nativas de Claude Code: Read, Write, Bash, Task |
| **L4 — Orquestación** | 14 agentes despachados secuencialmente o en paralelo |
| **L5 — Gobernanza** | 6 hooks (.js + .sh): pre-tool-guard, agent-memory, post-write-conventions |

→ Ver [Arquitectura](architecture.md) para el diagrama completo y documentación por capa.

---

## Próximos pasos

- [Inicio rápido](getting-started.md) — instala FORGE y ejecuta tu primer pipeline
- [Conceptos fundamentales](core-concepts.md) — entiende el IR, el estado del pipeline, la memoria de agentes y la constitución
- [Arquitectura](architecture.md) — el diagrama completo del sistema
