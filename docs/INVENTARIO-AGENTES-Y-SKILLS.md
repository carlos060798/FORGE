# Inventario de agentes, skills y comandos

> Tipo: Referencia
> Última revisión: 2026-11-10 contra el commit 55a9dd9
>
> **Generado con:** `node scripts/inventario-agentes.mjs` (las tablas de la sección 4 son su salida; los hallazgos de la sección 2 se recalculan a mano)
> Lee solo las cabeceras de `agents/`, `skills/` y `commands/`. Las tablas de la sección 4 salen del script; los hallazgos, de ejecutarlo y de leer las cabeceras. La comparación con la industria y las recomendaciones están en `docs/investigacion/` y en `docs/ADECUACION-DEL-CATALOGO.md`.

## 1. Resumen

| Concepto | Cantidad | Para qué sirve |
|---|---|---|
| Agentes (`agents/*.md`) | 14 | Roles con instrucciones, modelo y herramientas; los invoca el flujo SDD y el modo clásico |
| Skills (`skills/*/SKILL.md`) | 31 | Capacidades que se cargan por demanda (formato abierto Agent Skills) |
| Comandos (`commands/*.md`) | 39 | Órdenes `sdd.*` del flujo; hay una skill generada por cada uno en `skills-generadas/` |

El ciclo verificado (`core/ciclo/`) **reutiliza tres de los 14 agentes**: `arquitecto` hace de planificador (`core/ciclo/nodos.js`, nodo con `agente: 'arquitecto'`), `tester` escribe las pruebas (`nodos.js` y `pruebas-confiables.js`, `agente: 'tester'`) y el implementador es el agente que declare la tarea (`nodos.js`: `estado.tarea.agente`; p. ej. `desarrollador-backend`). Su cabecera y su texto son, por tanto, parte de la garantía del ciclo, no solo documentación.

## 2. Hallazgos de las cabeceras

Recalculados el 2026-11-10 con el script (`--json`) y leyendo las cabeceras. Los de la revisión anterior (2026-10-14) que ya no se cumplen figuran como resueltos.

| # | Hallazgo | Estado | Dónde |
|---|---|---|---|
| H1 | Skills sin `name` en la cabecera | Resuelto: las 31 lo tienen | — |
| H2 | Skills sin `description` | Resuelto: las 31 la tienen | — |
| H3 | Dos skills con el mismo propósito | Sigue. `deploy-vercel` es ahora un alias de 13 líneas que apunta a `vercel-deploy` | `deploy-vercel`, `vercel-deploy` |
| H4 | `model` en las skills | 17 de 31 no lo declaran; las 14 que sí lo declaran usan alias (`haiku`, `sonnet`, `opus`); ninguna usa ya un identificador completo | `skills/*/SKILL.md` |
| H5 | Skills sin `allowed-tools` | Resuelto: las 31 lo declaran | — |
| H6 | Agentes de solo lectura con `Bash` | Sigue: tienen `Read, Grep, Glob, Bash`. Un revisor que puede ejecutar órdenes puede alterar lo que revisa | `arquitecto`, `asesor-datos`, `critico`, `investigador`, `revisor`, `seguridad` |
| H7 | Comandos largos | 12 de 39 superan 250 líneas (cada invocación los carga en contexto) | `sdd.implementar` (679), `sdd.planificar` (548), `sdd.compliance` (518), `sdd.constitucion` (508), `sdd.exportar` (341), `sdd.verificar` (328), `sdd.especificar` (316), `sdd.tareas` (303), `sdd.descubrir` (278), `sdd.configurar` (269), `sdd.analizar` (253), `sdd.estado` (252) |
| H8 | Skills largas | 2 superan 250 líneas | `vercel-deploy` (354), `github-connect` (337) |
| H9 | Ningún agente declara `Edit` | Sigue: todos escriben con `Write` (archivo entero) | `agents/*.md` |
| H10 | Herramientas de los comandos | 10 combinaciones distintas de `allowed-tools`, entre ellas `Agent`, `Task` (5 comandos) y `WebFetch` (1) | `commands/*.md` |

## 3. Qué usa cada parte del producto

| Parte | Roles que carga | Observación |
|---|---|---|
| Ciclo verificado (`forge run --motor ciclo`) | `arquitecto` (planifica), `tester` (pruebas), el agente de la tarea (implementa) | Cargados con `registry.get` (`core/ciclo/index.js`); el nivel de modelo sale de la cabecera `model` normalizada y de `motor.nivel_maximo` |
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
| disenador-api | sonnet | Read, Grep, Glob, Bash | sí | 114 | Especialista en diseño de contratos de API. Crea OpenAPI, GraphQL, gRPC o eventos según e… |
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
| adr-indexer | haiku | Read, Write, Bash | 0 | 176 | Indexa decisiones arquitectónicas (ADR) escritas como comentarios en el código en .sdd/ar… |
| cache-audit | haiku | Read, Bash | 0 | 159 | Audita los archivos de agentes (.claude/agents/*.md) para detectar bloques estables susce… |
| compresion-tokens | — | Read | 0 | 74 | DEPRECADO — La compresión gramatical del español fue reemplazada por el context manager r… |
| constitucion-constraint | — | Read, Bash | 0 | 76 | Verifica que cualquier artefacto generado (spec, plan, código) cumple los principios de l… |
| critica-diseno | sonnet | Read, Write | 0 | 189 | Auto-crítica del wireframe generado. Evalúa en 5 dimensiones con score 1-5. Si score < 4 … |
| decompose-to-ui-kit | — | Read, Write | 0 | 141 | Descompone una imagen o descripción de UI en componentes reutilizables del design system … |
| deploy-vercel | — | Read, Bash | 0 | 13 | Alias de vercel-deploy. Úsala igual que esa skill cuando el usuario pida /forge.deploy o … |
| descubrir-idea | opus | Write | 0 | 129 | Discovery form de 5 preguntas para entender la idea del usuario antes de interpretar. Gen… |
| deteccion-stack | — | Read, Bash | 0 | 173 | Detecta automáticamente el stack del proyecto (lenguaje, framework, BD, tests, build) ana… |
| effort-router | haiku | Read | 0 | 145 | Dado el nombre de la fase SDD actual, recomienda effort (low/medium/high/max) y modelo (H… |
| elegir-direccion | sonnet | Read, Write | 0 | 180 | Direction picker inspirado en open-design. Selecciona 3 de las 5 direcciones visuales dis… |
| enrutador-agentes | — | Read, Bash | 0 | 83 | Decide qué agente especializado activar para cada tarea según su tipo, fase y la configur… |
| explicame | — | Read | 0 | 112 | Lee el estado actual del proyecto y explica en lenguaje no técnico qué hizo Fragua, por q… |
| gestion-estado | — | Read, Write, Bash | 0 | 112 | Gestiona el estado persistente del flujo SDD entre sesiones. Lee y escribe estado.json y … |
| github-connect | — | Bash, Read, Edit, Grep | 9 | 337 | Conecta el proyecto a GitHub automáticamente. Crea repo, configura remote, hace push inic… |
| indexador | — | Read, Write, Bash | 0 | 197 | Detecta lenguajes del proyecto y genera mapas estáticos (estructura, símbolos, dependenci… |
| indexar-proyecto | haiku | Bash, Read | 0 | 86 | Genera un índice AST de los archivos JS/TS para navegar la estructura del código sin leer… |
| interpretar-idea | opus | Read, Write | 0 | 250 | Convierte una idea en texto libre a un IR (Interpreted Requirement) JSON validado. Trabaj… |
| mejorar-prompt | sonnet | Read, Bash | 0 | 231 | Transforma un prompt vago en versión profesional siguiendo los 7 patrones de prompting pa… |
| memory-compactor | haiku | Read, Write, Bash | 0 | 63 | Comprime los archivos de memoria de agentes cuando superan el umbral de 50 KB, deduplican… |
| modo-guiado | — | Read | 0 | 122 | Conduce el flujo SDD-ES para personas que no programan (perfil guiado). Define cómo habla… |
| mutation-detector | haiku | Read, Bash | 0 | 129 | Detecta mutaciones (cambios) en archivos del proyecto para el seguimiento de calidad. Úsa… |
| observabilidad-consumo | haiku | Read, Bash | 0 | 160 | Lee .sdd/observabilidad/consumo.jsonl y genera un reporte de actividad de agentes — invoc… |
| orquestacion-ptc | — | Read, Task | 0 | 93 | Patrón Programmatic Tool Calling para despachar subagentes en paralelo y agregar solo res… |
| resource-selector | — | Read, Bash | 0 | 179 | Decide autónomamente qué agentes y skills son necesarios para la spec activa, basándose e… |
| share-progress | — | Read, Bash | 0 | 147 | Genera un resumen compartible en Markdown del estado del pipeline Fragua con estadísticas… |
| token-budget | haiku | Read | 0 | 173 | Dado el estado actual del proyecto (fase, tareas pendientes, historial de consumo), estim… |
| validacion-spec | — | Read, Bash | 0 | 50 | Valida silenciosamente que la spec activa cumple el mínimo de calidad antes de pasar a la… |
| vercel-deploy | — | Bash | 12 | 354 | Despliega automáticamente a Vercel. Pre-checks, build, health checks, rollback si falla. |
| verificador-implementacion | — | Read, Bash | 0 | 69 | Verifica que el código implementado cumple los criterios de aceptación de la spec. Lee có… |
| wireframe-mvp | sonnet | Read, Write, Bash | 0 | 153 | Genera un wireframe HTML de la pantalla P0 del MVP. Usa el DESIGN.md activo para colores,… |

### Comandos (39)

| Comando | Herramientas | Handoffs | Líneas | Descripción |
|---|---|---|---|---|
| compact | Read, Bash | 0 | 16 | Alias de /sdd.comprimir — comprime el contexto de la sesión actual. Úsalo cuando el indic… |
| forge | Read, Write, Bash | 0 | 136 | Punto de entrada principal de Fragua. Di tu idea en lenguaje natural — Fragua la especifi… |
| sdd.aclarar | Read, Write, Edit, Bash | 2 | 192 | Identifica y resuelve marcadores [NECESITA_ACLARACION] y ambigüedades en la spec activa. … |
| sdd.adr | Read, Write, Bash | 0 | 193 | Indexar, listar y gestionar decisiones arquitectónicas (ADRs) |
| sdd.analizar | Read, Write, Bash | 2 | 253 | Verifica consistencia y cobertura cruzada entre constitución, spec, plan y tareas. Detect… |
| sdd.ayuda | Read | 0 | 246 | Guía completa del plugin SDD-ES con todos los comandos, flujos, agentes y referencias de … |
| sdd.canary | Read, Bash | 1 | 54 | Vigila un servicio recién desplegado consultando su health endpoint a intervalos y report… |
| sdd.checklist | Read, Write, Bash | 2 | 166 | Aplica un checklist de calidad formal a la spec activa — verifica completitud, claridad, … |
| sdd.compliance | Read, Bash | 0 | 518 | Genera reporte de cumplimiento regulatorio (GDPR, SOC2, ISO 27001, HIPAA) contra el estad… |
| sdd.comprimir | Read, Write, Edit, Bash | 0 | 162 | Comprime archivos para ahorrar input tokens usando reglas caveman-like adaptadas al españ… |
| sdd.configurar | Read, Write, Edit, Bash | 0 | 269 | Ajusta la configuración de SDD-ES — activar/desactivar agentes, cambiar el modelo asignad… |
| sdd.constitucion | Read, Write, Edit, Bash | 2 | 508 | Crea o actualiza la constitución del proyecto — el documento fundacional con los principi… |
| sdd.construir | Read, Write, Bash, Agent | 0 | 215 | Pipeline completo de Fragua. Si no hay IR, interpreta primero. Si no hay diseño, diseña. … |
| sdd.crear-agente | Read, Write, Edit, Bash | 0 | 146 | Wizard interactivo para crear un nuevo agente SDD-ES. Genera agents/{nombre}.md, lo regis… |
| sdd.crear-app | Read, Write, Edit, Bash, Task | 3 | 158 | Convierte una descripción en lenguaje natural en una app web o CLI mínima con stack detec… |
| sdd.crear-mcp | Read, Write, Edit, Bash, Task | 2 | 168 | Convierte una descripción en lenguaje natural en un servidor MCP funcional, empaquetado c… |
| sdd.defect-report | Read, Bash | 0 | 131 | Generar reporte de calidad con escape rate y mutaciones |
| sdd.descubrir | Read, Write, Bash | 2 | 278 | Extrae contexto mínimo cuando el usuario describe algo vagamente. Hace preguntas concreta… |
| sdd.desplegar | Read, Write, Edit, Bash | 2 | 146 | Despliega el producto a su plataforma con verificación previa y health check posterior. G… |
| sdd.diseñar | Read, Write, Bash, Agent | 0 | 235 | Fase de diseño de Fragua. Orquesta direction picker → product-designer → architecture-des… |
| sdd.especificar | Read, Write, Bash | 3 | 316 | Convierte una intención del usuario en una especificación estructurada con criterios de a… |
| sdd.estado | Read, Bash | 0 | 252 | Dashboard del estado actual del flujo SDD — qué fase, qué spec activa, progreso de tareas… |
| sdd.exportar | Read, Write, Bash | 0 | 341 | Exporta el proyecto como bundle portable. Detecta qué agentes/skills/comandos se usaron d… |
| sdd.glosario | Read, Write, Edit, Bash | 0 | 105 | Gestiona el glosario del dominio. Añade, edita o consulta términos del dominio del proyec… |
| sdd.implementar | Read, Write, Edit, Bash, Task, TodoWrite | 2 | 679 | Ejecuta las tareas con los agentes especializados configurados. Modos: todas en secuencia… |
| sdd.importar | Read, Write, Bash, WebFetch | 0 | 88 | Importa una especificación externa (Markdown, issue de GitHub/GitLab, doc compartido) y l… |
| sdd.interpretar | Read, Write, Bash | 0 | 241 | Punto de entrada de Fragua. Convierte una idea en texto libre a un IR JSON validado. Orqu… |
| sdd.mapear | Read, Write, Bash | 0 | 116 | Indexa la estructura del proyecto, símbolos públicos y dependencias. Genera mapas estátic… |
| sdd | Read, Write, Bash | 0 | 214 | Hub central de SDD-ES. Lee el estado del proyecto y guía al usuario al siguiente paso. Ac… |
| sdd.modo | Read, Edit, Bash | 0 | 77 | Cambia o muestra el modo de trabajo de la sesión (normal/rapido/prototipo). Modifica sesi… |
| sdd.optimizar-memoria | Read, Bash | 0 | 11 | Alias de /sdd.comprimir — comprime y deduplica la memoria de agentes (.sdd/memoria/agente… |
| sdd.optimizar | Read, Bash | 0 | 16 | Alias de /sdd.comprimir — ciclo de ahorro de tokens (fan-out, modelo por fase, compresión… |
| sdd.planificar | Read, Write, Edit, Bash, Task | 3 | 548 | Genera el plan técnico de implementación desde la spec — arquitectura, contratos de API, … |
| sdd.qa | Read, Write, Edit, Bash | 2 | 100 | Prueba el producto en un navegador real generando casos E2E a partir de los Criterios de … |
| sdd.release | Read, Write, Edit, Bash | 1 | 246 | Genera una nueva versión semántica del proyecto. Detecta el tipo de cambio (major/minor/p… |
| sdd.retro | Read, Write, Edit, Bash | 2 | 148 | Retrospectiva ligera tras completar una feature o despliegue. Captura qué funcionó, qué c… |
| sdd.snapshot | Read, Write, Bash | 0 | 119 | Actualiza el SNAPSHOT.md del producto con las funcionalidades activas. Se ejecuta después… |
| sdd.tareas | Read, Write, Edit, Bash | 2 | 303 | Desglosa el plan en tareas atómicas, ordenadas por dependencias, con criterios de verific… |
| sdd.verificar | Read, Write, Bash, Task, Grep, Glob | 0 | 328 | Verifica que el código implementado cumple TODOS los criterios de aceptación de la spec o… |
