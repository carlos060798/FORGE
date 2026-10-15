# Inventario de agentes, skills y comandos

> **Fecha:** 2026-10-14 · **Rama:** `feature/motor-agentico` · **Generado con:** `node scripts/inventario-agentes.mjs`
> Lee solo las cabeceras de `agents/`, `skills/` y `commands/`. Las tablas de abajo salen del script; los hallazgos, de ejecutarlo y de leer el resultado. La comparación con la industria y las recomendaciones están en `docs/investigacion/` y en `docs/ADECUACION-DEL-CATALOGO.md`.

## 1. Resumen

| Concepto | Cantidad | Para qué sirve |
|---|---|---|
| Agentes (`agents/*.md`) | 14 | Roles con instrucciones, modelo y herramientas; los invoca el flujo SDD y el modo clásico |
| Skills (`skills/*/SKILL.md`) | 31 | Capacidades que se cargan por demanda (formato abierto Agent Skills) |
| Comandos (`commands/*.md`) | 39 | Órdenes `sdd.*` del flujo; hay una skill generada por cada uno en `skills-generadas/` |

El ciclo verificado (`core/ciclo/`) **reutiliza tres de los 14 agentes**: `arquitecto` hace de planificador (`nodos.js:307`), `tester` escribe las pruebas (`nodos.js:366` y `pruebas-confiables.js:185`) y el implementador es el agente que declare la tarea (`nodos.js:482`, p. ej. `desarrollador-backend`). Su cabecera y su texto son, por tanto, parte de la garantía del ciclo, no solo documentación.

## 2. Hallazgos de las cabeceras

| # | Hallazgo | Dónde | Por qué importa |
|---|---|---|---|
| H1 | **22 de 31 skills no tienen `name`** en la cabecera | `cache-audit`, `compresion-tokens`, `constitucion-constraint`, `critica-diseno`, `deploy-vercel`, `descubrir-idea`, `deteccion-stack`, `effort-router`, `elegir-direccion`, `enrutador-agentes`, `explicame`, `gestion-estado`, `indexador`, `interpretar-idea`, `mejorar-prompt`, `observabilidad-consumo`, `resource-selector`, `share-progress`, `token-budget`, `validacion-spec`, `verificador-implementacion`, `wireframe-mvp` | `name` y `description` son obligatorios en la especificación abierta de Agent Skills: sin `name`, otras herramientas pueden no cargarlas |
| H2 | **3 skills sin `description`** | `deploy-vercel`, `explicame`, `share-progress` | La descripción es lo que decide cuándo se activa una skill |
| H3 | **Dos skills duplicadas** | `deploy-vercel` y `vercel-deploy` | Mismo propósito con dos nombres; confunde y duplica contexto |
| H4 | **Modelo declarado de tres formas** | 17 skills sin `model`; 4 con un identificador completo (`claude-haiku-4-5`: `adr-indexer`, `indexar-proyecto`, `memory-compactor`, `mutation-detector`); el resto con alias (`sonnet`, `opus`, `haiku`) | Con proveedores distintos de Anthropic el identificador completo no resuelve; hace falta niveles neutrales (spec `proveedores-agnosticos`) |
| H5 | **17 skills sin `allowed-tools`** | `compresion-tokens`, `constitucion-constraint`, `decompose-to-ui-kit`, `deploy-vercel`, `deteccion-stack`, `enrutador-agentes`, `explicame`, `gestion-estado`, `github-connect`, `indexador`, `modo-guiado`, `orquestacion-ptc`, `resource-selector`, `share-progress`, `validacion-spec`, `vercel-deploy`, `verificador-implementacion` | Sin lista cerrada de herramientas hereda las del agente que la usa: contra el principio de mínimo privilegio |
| H6 | **Roles de solo lectura con `Bash`** | `arquitecto`, `asesor-datos`, `critico`, `investigador`, `revisor`, `seguridad` tienen `Read, Grep, Glob, Bash` | Un revisor que puede ejecutar órdenes puede alterar lo que revisa; ver la spec `perfiles-de-agente` |
| H7 | **Comandos muy largos** | 12 de 39 superan 250 líneas: `sdd.implementar` (679), `sdd.planificar` (548), `sdd.compliance` (518), `sdd.constitucion` (508), `sdd.exportar` (341), `sdd.verificar` (328), `sdd.especificar` (316), `sdd.tareas` (303), `sdd.descubrir` (278), `sdd.configurar` (269), `sdd.analizar` (253), `sdd.estado` (252) | Consumen contexto en cada invocación; la guía de skills recomienda cuerpos cortos con material en archivos aparte |
| H8 | **Dos skills grandes** | `vercel-deploy` (352), `github-connect` (337) | Igual que H7; además `github-connect` solapa con el módulo de integraciones |
| H9 | **Ningún agente declara `Edit`** | Todos escriben con `Write` | Reescribir archivos enteros aumenta el riesgo de pisar cambios; el implementador por turnos sí usa edición dirigida |
| H10 | **Comandos con herramientas heterogéneas** | 10 combinaciones distintas de `allowed-tools`, incluidas `Agent`, `Task` y `WebFetch` | No hay política común; ver `perfiles-de-agente` |

## 3. Qué usa cada parte del producto

| Parte | Roles que carga | Observación |
|---|---|---|
| Ciclo verificado (`forge run --motor ciclo`) | `arquitecto` (planifica), `tester` (pruebas), el agente de la tarea (implementa) | Cargados con `registry.get` (`core/ciclo/index.js:116`); el nivel de modelo sale de la cabecera `model` normalizada y de `motor.nivel_maximo` |
| Modo clásico (`--motor clasico`) | Los 14 de `agents/*.md` vía `core/agent-registry.js` | La cabecera `model` se normaliza a `opus`, `sonnet` o `haiku` (todo lo demás cae a `sonnet`) |
| Flujo SDD en Claude Code | Comandos `sdd.*` y los agentes que invocan | Es la parte que más contexto consume |
| `forge verificar` | Ninguno | No llama a modelos |

**Consecuencia:** tres agentes (`arquitecto`, `tester` y el implementador de cada tarea) forman parte del ciclo verificado, así que un cambio en sus textos o en su lista de herramientas cambia el comportamiento garantizado y exige pruebas. Los otros once solo intervienen en el flujo SDD y el modo clásico. `revisor` y `seguridad` **no** participan en el ciclo: la revisión de calidad del ciclo es la mutación y la aprobación humana.

## 4. Tablas generadas

### Agentes (14)

| Agente | Modelo | Herramientas | Meta | Líneas | Descripción |
|---|---|---|---|---|---|
| architecture-designer | sonnet | Read, Write | sí | 205 | Agente de arquitectura técnica. Lee IR + ProductDesign y recomienda el stack más simple v… |
| arquitecto | opus | Read, Grep, Glob, Bash | sí | 175 | Arquitecto de software senior. Toma decisiones técnicas de alto nivel, diseña estructuras… |
| asesor-datos | opus | Read, Grep, Glob, Bash | sí | 177 | Especialista en bases de datos y almacenamiento. Diseña esquemas, queries, índices, migra… |
| critico | opus | Read, Grep, Glob, Bash | sí | 191 | Abogado del diablo del equipo. Identifica riesgos, asunciones implícitas y puntos ciegos … |
| desarrollador-backend | sonnet | Read, Write, Grep, Glob, Bash | sí | 244 | Implementador senior de lógica de servidor. Escribe código de producción agnóstico al sta… |
| desarrollador-frontend | sonnet | Read, Write, Grep, Glob, Bash | sí | 109 | Implementador senior de interfaces de usuario. Componentes, estado del cliente, accesibil… |
| disenador-api | sonnet | Read, Write, Grep, Glob, Bash | sí | 114 | Especialista en diseño de contratos de API. Crea OpenAPI, GraphQL, gRPC o eventos según e… |
| documentador | sonnet | Read, Write, Grep, Glob, Bash | sí | 173 | Generador de documentación técnica útil. Solo documenta lo no obvio. Desactivado por defe… |
| investigador | sonnet | Read, Grep, Glob, Bash | sí | 170 | Agente de investigación y recopilación de contexto. Analiza el proyecto existente, depend… |
| operaciones | sonnet | Read, Write, Grep, Glob, Bash | sí | 101 | Especialista en CI/CD, infraestructura y despliegues. Configuración, secrets, observabili… |
| product-designer | opus | Read, Write | sí | 270 | Agente de diseño de producto. Toma el IR + dirección visual + DESIGN.md activo y genera e… |
| revisor | opus | Read, Grep, Glob, Bash | sí | 174 | Revisor de código senior. Verifica calidad, cumplimiento de spec/constitución, patrones d… |
| seguridad | opus | Read, Grep, Glob, Bash | sí | 220 | Especialista en seguridad de aplicaciones. Audita vulnerabilidades reales (no teóricas) e… |
| tester | sonnet | Read, Write, Grep, Glob, Bash | sí | 282 | Ingeniero de calidad. Genera tests útiles (que atrapan bugs reales) en cualquier framewor… |

### Skills (31)

| Skill | Modelo | Herramientas | Recursos | Líneas | Descripción |
|---|---|---|---|---|---|
| adr-indexer | claude-haiku-4-5 | Read, Write, Bash | 0 | 176 | Indexa decisiones arquitectónicas (ADR) desde comentarios en código |
| cache-audit | haiku | Read, Bash | 0 | 159 | Audita los archivos de agentes (.claude/agents/*.md) para detectar bloques estables susce… |
| compresion-tokens | — | — | 0 | 74 | DEPRECADO — La compresión gramatical del español fue reemplazada por el context manager r… |
| constitucion-constraint | — | — | 0 | 76 | Verifica que cualquier artefacto generado (spec, plan, código) cumple los principios de l… |
| critica-diseno | sonnet | Read, Write | 0 | 189 | Auto-crítica del wireframe generado. Evalúa en 5 dimensiones con score 1-5. Si score < 4 … |
| decompose-to-ui-kit | — | — | 0 | 141 | Descompone una imagen o descripción de UI en componentes reutilizables del design system … |
| deploy-vercel | — | — | 0 | 113 |  |
| descubrir-idea | opus | Write | 0 | 129 | Discovery form de 5 preguntas para entender la idea del usuario antes de interpretar. Gen… |
| deteccion-stack | — | — | 0 | 173 | Detecta automáticamente el stack del proyecto (lenguaje, framework, BD, tests, build) ana… |
| effort-router | haiku | Read | 0 | 145 | Dado el nombre de la fase SDD actual, recomienda effort (low/medium/high/max) y modelo (H… |
| elegir-direccion | sonnet | Read, Write | 0 | 180 | Direction picker inspirado en open-design. Selecciona 3 de las 5 direcciones visuales dis… |
| enrutador-agentes | — | — | 0 | 83 | Decide qué agente especializado activar para cada tarea según su tipo, fase y la configur… |
| explicame | — | — | 0 | 112 |  |
| gestion-estado | — | — | 0 | 112 | Gestiona el estado persistente del flujo SDD entre sesiones. Lee y escribe estado.json y … |
| github-connect | — | — | 9 | 337 | Conecta el proyecto a GitHub automáticamente. Crea repo, configura remote, hace push inic… |
| indexador | — | — | 0 | 197 | Detecta lenguajes del proyecto y genera mapas estáticos (estructura, símbolos, dependenci… |
| indexar-proyecto | claude-haiku-4-5 | Bash, Read | 0 | 86 | Genera índice AST de archivos JS/TS para navegación estructural sin leer archivos complet… |
| interpretar-idea | opus | Read, Write | 0 | 250 | Convierte una idea en texto libre a un IR (Interpreted Requirement) JSON validado. Trabaj… |
| mejorar-prompt | sonnet | Read, Bash | 0 | 231 | Transforma un prompt vago en versión profesional siguiendo los 7 patrones |
| memory-compactor | claude-haiku-4-5 | Read, Write, Bash | 0 | 63 | Comprime archivos de memoria de agentes cuando superan umbral (>50KB) |
| modo-guiado | — | — | 0 | 122 | Conduce el flujo SDD-ES para personas que no programan (perfil guiado). Define cómo habla… |
| mutation-detector | claude-haiku-4-5 | Read, Bash | 0 | 129 | Detecta mutaciones (cambios) en archivos para tracking de calidad |
| observabilidad-consumo | haiku | Read, Bash | 0 | 160 | Lee .sdd/observabilidad/consumo.jsonl y genera un reporte de actividad de agentes — invoc… |
| orquestacion-ptc | — | — | 0 | 93 | Patrón Programmatic Tool Calling para despachar subagentes en paralelo y agregar solo res… |
| resource-selector | — | — | 0 | 179 | Decide autónomamente qué agentes y skills son necesarios para la spec activa, basándose e… |
| share-progress | — | — | 0 | 147 |  |
| token-budget | haiku | Read | 0 | 173 | Dado el estado actual del proyecto (fase, tareas pendientes, historial de consumo), estim… |
| validacion-spec | — | — | 0 | 50 | Valida silenciosamente que la spec activa cumple el mínimo de calidad antes de pasar a la… |
| vercel-deploy | — | — | 12 | 352 | Despliega automáticamente a Vercel. Pre-checks, build, health checks, rollback si falla. |
| verificador-implementacion | — | — | 0 | 69 | Verifica que el código implementado cumple los criterios de aceptación de la spec. Lee có… |
| wireframe-mvp | sonnet | Read, Write, Bash | 0 | 153 | Genera un wireframe HTML de la pantalla P0 del MVP. Usa el DESIGN.md activo para colores,… |

### Comandos (39)

| Comando | Herramientas | Handoffs | Líneas | Descripción |
|---|---|---|---|---|
| compact | Read, Bash | 0 | 16 | Alias de /sdd.comprimir — comprime el contexto de la sesión actual. Úsalo cuando el indic… |
| forge | Read, Write, Bash | 0 | 136 | Punto de entrada principal de FORGE. Di tu idea en lenguaje natural — FORGE la especifica… |
| sdd.aclarar | Read, Write, Edit, Bash | 2 | 192 | Identifica y resuelve marcadores [NECESITA_ACLARACION] y ambigüedades en la spec activa. … |
| sdd.adr | Read, Write, Bash | 0 | 193 | Indexar, listar y gestionar decisiones arquitectónicas (ADRs) |
| sdd.analizar | Read, Write, Bash | 2 | 253 | Verifica consistencia y cobertura cruzada entre constitución, spec, plan y tareas. Detect… |
| sdd.ayuda | Read | 0 | 245 | Guía completa del plugin SDD-ES con todos los comandos, flujos, agentes y referencias de … |
| sdd.canary | Read, Bash | 1 | 54 | Vigila un servicio recién desplegado consultando su health endpoint a intervalos y report… |
| sdd.checklist | Read, Write, Bash | 2 | 166 | Aplica un checklist de calidad formal a la spec activa — verifica completitud, claridad, … |
| sdd.compliance | Read, Bash | 0 | 518 | Genera reporte de cumplimiento regulatorio (GDPR, SOC2, ISO 27001, HIPAA) contra el estad… |
| sdd.comprimir | Read, Write, Edit, Bash | 0 | 162 | Comprime archivos para ahorrar input tokens usando reglas caveman-like adaptadas al españ… |
| sdd.configurar | Read, Write, Edit, Bash | 0 | 269 | Ajusta la configuración de SDD-ES — activar/desactivar agentes, cambiar el modelo asignad… |
| sdd.constitucion | Read, Write, Edit, Bash | 2 | 508 | Crea o actualiza la constitución del proyecto — el documento fundacional con los principi… |
| sdd.construir | Read, Write, Bash, Agent | 0 | 215 | Pipeline completo de FORGE. Si no hay IR, interpreta primero. Si no hay diseño, diseña. L… |
| sdd.crear-agente | Read, Write, Edit, Bash | 0 | 146 | Wizard interactivo para crear un nuevo agente SDD-ES. Genera agents/{nombre}.md, lo regis… |
| sdd.crear-app | Read, Write, Edit, Bash, Task | 3 | 158 | Convierte una descripción en lenguaje natural en una app web o CLI mínima con stack detec… |
| sdd.crear-mcp | Read, Write, Edit, Bash, Task | 2 | 168 | Convierte una descripción en lenguaje natural en un servidor MCP funcional, empaquetado c… |
| sdd.defect-report | Read, Bash | 0 | 131 | Generar reporte de calidad con escape rate y mutaciones |
| sdd.descubrir | Read, Write, Bash | 2 | 278 | Extrae contexto mínimo cuando el usuario describe algo vagamente. Hace preguntas concreta… |
| sdd.desplegar | Read, Write, Edit, Bash | 2 | 146 | Despliega el producto a su plataforma con verificación previa y health check posterior. G… |
| sdd.diseñar | Read, Write, Bash, Agent | 0 | 235 | Fase de diseño de FORGE. Orquesta direction picker → product-designer → architecture-desi… |
| sdd.especificar | Read, Write, Bash | 3 | 316 | Convierte una intención del usuario en una especificación estructurada con criterios de a… |
| sdd.estado | Read, Bash | 0 | 252 | Dashboard del estado actual del flujo SDD — qué fase, qué spec activa, progreso de tareas… |
| sdd.exportar | Read, Write, Bash | 0 | 341 | Exporta el proyecto como bundle portable. Detecta qué agentes/skills/comandos se usaron d… |
| sdd.glosario | Read, Write, Edit, Bash | 0 | 105 | Gestiona el glosario del dominio. Añade, edita o consulta términos del dominio del proyec… |
| sdd.implementar | Read, Write, Edit, Bash, Task, TodoWrite | 2 | 679 | Ejecuta las tareas con los agentes especializados configurados. Modos: todas en secuencia… |
| sdd.importar | Read, Write, Bash, WebFetch | 0 | 88 | Importa una especificación externa (Markdown, issue de GitHub/GitLab, doc compartido) y l… |
| sdd.interpretar | Read, Write, Bash | 0 | 241 | Punto de entrada de FORGE. Convierte una idea en texto libre a un IR JSON validado. Orque… |
| sdd.mapear | Read, Write, Bash | 0 | 116 | Indexa la estructura del proyecto, símbolos públicos y dependencias. Genera mapas estátic… |
| sdd | Read, Write, Bash | 0 | 214 | Hub central de SDD-ES. Lee el estado del proyecto y guía al usuario al siguiente paso. Ac… |
| sdd.modo | Read, Edit, Bash | 0 | 77 | Cambia o muestra el modo de trabajo de la sesión (normal/rapido/prototipo). Modifica sesi… |
| sdd.optimizar-memoria | Read, Write, Bash | 0 | 44 | Comprimir manualmente la memoria de agentes (deduplicación + compresión) |
| sdd.optimizar | Read, Bash | 0 | 161 | Ciclo completo de optimización de tokens para la sesión actual — detecta fan-out, recomie… |
| sdd.planificar | Read, Write, Edit, Bash, Task | 3 | 548 | Genera el plan técnico de implementación desde la spec — arquitectura, contratos de API, … |
| sdd.qa | Read, Write, Edit, Bash | 2 | 100 | Prueba el producto en un navegador real generando casos E2E a partir de los Criterios de … |
| sdd.release | Read, Write, Edit, Bash | 1 | 246 | Genera una nueva versión semántica del proyecto. Detecta el tipo de cambio (major/minor/p… |
| sdd.retro | Read, Write, Edit, Bash | 2 | 148 | Retrospectiva ligera tras completar una feature o despliegue. Captura qué funcionó, qué c… |
| sdd.snapshot | Read, Write, Bash | 0 | 119 | Actualiza el SNAPSHOT.md del producto con las funcionalidades activas. Se ejecuta después… |
| sdd.tareas | Read, Write, Edit, Bash | 2 | 303 | Desglosa el plan en tareas atómicas, ordenadas por dependencias, con criterios de verific… |
| sdd.verificar | Read, Write, Bash, Task, Grep, Glob | 0 | 328 | Verifica que el código implementado cumple TODOS los criterios de aceptación de la spec o… |
