# Agentes

> Tipo: Referencia
> Última revisión: 2026-11-10 contra el commit 7683f83

Catálogo de los 14 agentes de `agents/`. Cada agente es un archivo Markdown con una cabecera (`name`, `description`, `model`, `color`, `tools`, y a veces `goal` y `backstory`) y el texto de sus instrucciones. Lo que dice este documento sale de esas cabeceras y del código que las usa; el contenido de las instrucciones de cada agente se lee en su archivo. Inventario con hallazgos: [INVENTARIO-AGENTES-Y-SKILLS.md](INVENTARIO-AGENTES-Y-SKILLS.md). Estado del proyecto: [ESTADO-ACTUAL.md](ESTADO-ACTUAL.md).

## Catálogo

| Agente | `model` | `tools` | Solo lectura (guardia) | Proveedor fijo en Anthropic (hook) |
|---|---|---|---|---|
| `arquitecto` | opus | Read, Grep, Glob, Bash | sí | sí |
| `architecture-designer` | sonnet | Read, Write | no | no |
| `product-designer` | opus | Read, Write | no | sí |
| `disenador-api` | sonnet | Read, Write, Grep, Glob, Bash | sí | no |
| `asesor-datos` | opus | Read, Grep, Glob, Bash | sí | sí |
| `desarrollador-backend` | sonnet | Read, Write, Grep, Glob, Bash | no | no |
| `desarrollador-frontend` | sonnet | Read, Write, Grep, Glob, Bash | no | no |
| `operaciones` | sonnet | Read, Write, Grep, Glob, Bash | no | no |
| `tester` | sonnet | Read, Write, Grep, Glob, Bash | no | no |
| `revisor` | opus | Read, Grep, Glob, Bash | sí | sí |
| `critico` | opus | Read, Grep, Glob, Bash | sí | sí |
| `seguridad` | opus | Read, Grep, Glob, Bash | sí | sí |
| `documentador` | sonnet | Read, Write, Grep, Glob, Bash | no | no |
| `investigador` | sonnet | Read, Grep, Glob, Bash | sí | no |

Fuentes de cada columna:

- `model` y `tools`: cabecera de `agents/<nombre>.md`.
- Solo lectura: lista `READ_ONLY_AGENTS` de `claude-hooks/pre-tool-guard.js`. Con `CLAUDE_AGENT_NAME` igual a uno de esos nombres, el guardia detiene las herramientas de escritura con código 2. Solo aplica dentro de Claude Code, que es quien fija esa variable. Ojo: `disenador-api` figura como solo lectura aunque su cabecera declare `Write`; dentro de Claude Code manda el guardia.
- Proveedor fijo: lista `ANTHROPIC_ONLY_AGENTS` de `claude-hooks/model-registry.js` (el hook que elige proveedor para el registro de consumo). Es un criterio del hook; **no** se verificó que el motor (`core/llm-providers/`) imponga la misma restricción.
- Ningún agente declara `Edit`.

## Qué hace cada uno

Resumen tomado de la línea `description` de cada cabecera.

| Agente | Descripción |
|---|---|
| `arquitecto` | Arquitecto de software senior: decisiones técnicas de alto nivel, estructuras, trade-offs. Planificador del ciclo verificado (plan técnico, tipos y contratos de cada tarea) |
| `architecture-designer` | Lee el IR y el diseño de producto y recomienda el stack más simple viable (frontend, backend, BD, despliegue). Actúa antes de la spec; el plan técnico del ciclo es del `arquitecto` |
| `product-designer` | Toma el IR, la dirección visual y el `DESIGN.md` activo y genera el diseño de producto (pantallas P0/P1/P2, flujo de usuario, alcance del MVP). Consulta `craft/anti-ai-slop.md` |
| `disenador-api` | Contratos de API (OpenAPI, GraphQL, gRPC o eventos) durante `/sdd.planificar` |
| `asesor-datos` | Esquemas, consultas, índices, migraciones y rendimiento de bases de datos |
| `desarrollador-backend` | Implementador de lógica de servidor, agnóstico al stack; sigue los patrones del proyecto |
| `desarrollador-frontend` | Implementador de interfaces: componentes, estado del cliente, accesibilidad; agnóstico al framework |
| `operaciones` | CI/CD, infraestructura, despliegues, secretos y observabilidad |
| `tester` | Genera pruebas (en el framework que detecte el proyecto). En el ciclo verificado escribe las pruebas de cada tarea |
| `revisor` | Revisa la conformidad del código **construido** con la spec y la constitución |
| `critico` | Abogado del diablo: riesgos, supuestos implícitos y puntos ciegos **antes** de construir |
| `seguridad` | Audita vulnerabilidades reales en cambios sensibles (autenticación, datos personales, APIs externas, archivos, configuración) |
| `documentador` | Documentación técnica; solo documenta lo no obvio. La cabecera lo describe como desactivado por defecto |
| `investigador` | Analiza el proyecto existente (dependencias, patrones, restricciones) antes de especificar; se activa al inicio de `/sdd.descubrir` y `/sdd.especificar` |

## Dónde se usan

Hay tres formas de ejecución, y no usan los mismos agentes (INVENTARIO-AGENTES-Y-SKILLS.md, apartado 3, y `core/ciclo/nodos.js`):

| Ejecución | Agentes |
|---|---|
| Ciclo verificado (`fragua run`, motor `ciclo`) | `arquitecto` (planifica), `tester` (escribe las pruebas) y el agente que nombre cada tarea (implementa). El resto no se carga |
| Modo clásico (`--motor clasico`) | Los 14 se cargan desde `agents/*.md` con `core/agent-registry.js` |
| Flujo SDD en Claude Code | Los comandos `/sdd.*` invocan a los agentes que mencionan (ver abajo) |
| `fragua verificar` | Ninguno: no llama a modelos |

Comandos de `commands/` que nombran a cada agente en su texto (excluidos `sdd.ayuda`, `sdd.configurar`, `sdd.estado` y `sdd.crear-agente`, que los listan todos). Es una búsqueda de texto: indica que el comando lo menciona, no demuestra que lo invoque siempre.

| Agente | Comandos que lo nombran |
|---|---|
| `arquitecto` | `/sdd.adr`, `/sdd.analizar`, `/sdd.implementar`, `/sdd.planificar`, `/sdd.tareas` |
| `critico` | `/sdd.analizar`, `/sdd.implementar`, `/sdd.planificar` |
| `revisor` | `/sdd.constitucion`, `/sdd.defect-report`, `/sdd.implementar`, `/sdd.planificar`, `/sdd.tareas`, `/sdd.verificar` |
| `seguridad` | `/sdd.adr`, `/sdd.analizar`, `/sdd.compliance`, `/sdd.comprimir`, `/sdd.desplegar`, `/sdd.exportar`, `/sdd.implementar`, `/sdd.modo`, `/sdd.planificar`, `/sdd.release`, `/sdd.retro`, `/sdd.verificar` |
| `product-designer` | `/sdd.diseñar`, `/sdd.exportar`, `/sdd.implementar` |
| `architecture-designer` | `/sdd.diseñar`, `/sdd.exportar`, `/sdd.implementar` |
| `asesor-datos` | `/sdd.implementar`, `/sdd.planificar`, `/sdd.tareas` |
| `desarrollador-backend` | `/sdd.analizar`, `/sdd.crear-app`, `/sdd.crear-mcp`, `/sdd.implementar`, `/sdd.planificar`, `/sdd.tareas` |
| `desarrollador-frontend` | `/sdd.crear-app`, `/sdd.implementar`, `/sdd.planificar`, `/sdd.tareas` |
| `tester` | `/sdd.implementar`, `/sdd.tareas` |
| `operaciones` | `/sdd.desplegar`, `/sdd.implementar`, `/sdd.planificar`, `/sdd.tareas` |
| `disenador-api` | `/sdd.implementar`, `/sdd.planificar`, `/sdd.tareas` |
| `investigador` | `/sdd.descubrir`, `/sdd.implementar` |
| `documentador` | `/sdd.compliance`, `/sdd.implementar`, `/sdd.tareas` |

## Configuración

La sección `agentes:` de `.sdd/sdd.config.yaml` (con `activo`, `modelo`, `descripcion`) **no tiene lector en el código del repositorio**: `fragua config validate` y `fragua doctor` solo comprueban que la clave exista, y el modelo con el que se ejecuta cada agente sale de la cabecera `model:` de su archivo (normalizada a `opus`, `sonnet` o `haiku` por `core/agent-registry.js`). Detalle y matices en [configuration.md](configuration.md#agentes). El preset `lean`, que es el bloque `agentes:` por defecto del archivo de ejemplo, deja activos seis agentes (`arquitecto`, `disenador-api`, `asesor-datos`, `desarrollador-backend`, `desarrollador-frontend`, `tester`), todos en `sonnet`; si ese bloque gobierna de verdad la ejecución es **no verificado**.

Para cambiar el modelo de un agente de forma comprobable, edita la cabecera `model:` de `agents/<nombre>.md`. Los identificadores concretos de cada nivel (`opus`, `sonnet`, `haiku`) se configuran en la sección `modelos` de `sdd.config.yaml`.

Dentro del ciclo verificado, además, cada rol (planificador, QA, implementador) tiene un perfil de herramientas y rutas que el proyecto solo puede apretar: ver la sección `perfiles` en [configuration.md](configuration.md) y [GARANTIAS-Y-LIMITES.md](GARANTIAS-Y-LIMITES.md).

## Crear un agente propio

`/sdd.crear-agente` es un asistente que, según su descripción, genera `agents/{nombre}.md`, lo registra en `plugin.json` y actualiza el enrutador de agentes. Formato de un agente: [extending-forge.md](extending-forge.md).
