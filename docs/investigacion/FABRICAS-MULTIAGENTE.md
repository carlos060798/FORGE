# Fábricas de software multiagente: roles, handoffs y controles

Consulta: 2026-10-14. Alcance: contrastar la industria con el inventario de Fragua (14 agentes, 31 skills, 39 comandos; salida de `node scripts/inventario-agentes.mjs`). «No verificado» = no confirmado en la fuente consultada.

## 0. Fuentes

| Fuente | URL | Estado |
|---|---|---|
| Anthropic, Building effective agents | https://www.anthropic.com/engineering/building-effective-agents | verificado |
| Anthropic, Multi-agent research system | https://www.anthropic.com/engineering/multi-agent-research-system | verificado |
| Claude Code, subagentes | https://code.claude.com/docs/en/sub-agents | verificado (leído 100k de 110k caracteres) |
| Cognition, Don't build multi-agents | https://cognition.com/blog/dont-build-multi-agents | verificado (2025) |
| GitHub Copilot cloud agent | https://docs.github.com/en/copilot/concepts/agents/coding-agent/about-coding-agent | verificado (parcial: firewall y aprobación de workflows no aparecen en esa página) |
| Copilot custom agents | https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/create-custom-agents | verificado |
| LangChain multi-agent | https://docs.langchain.com/oss/python/langchain/multi-agent | verificado (no menciona «supervisor» ni «swarm» por nombre) |
| Microsoft Agent Framework | https://learn.microsoft.com/en-us/agent-framework/overview/agent-framework-overview | verificado |
| CrewAI crews | https://docs.crewai.com/en/concepts/crews | verificado (guardrails/max_iter no aparecen en esa página) |
| MetaGPT | https://github.com/FoundationAgents/MetaGPT | verificado (README sin detalle de roles) |
| ChatDev | https://github.com/OpenBMB/ChatDev | verificado |
| BMAD-METHOD | https://github.com/bmad-code-org/BMAD-METHOD | verificado: el README actual NO lista roles nombrados |
| Kiro steering / hooks | https://kiro.dev/docs/steering/ , https://kiro.dev/docs/hooks/ | verificado |
| OpenHands | https://docs.openhands.dev/sdk/guides/agent-delegation | **no verificado** (404) |

## 1. Roles comunes y cobertura de Fragua

La evidencia de roles nombrados es desigual: MetaGPT lista product manager, architect, project manager, engineer (QA no aparece en su README); ChatDev 1.0 usa CEO, CTO, programmer, y reviewer solo como humano en un modo; BMAD actual describe «perspectivas» (producto, arquitectura, UX, desarrollo, pruebas) sin roles fijos en el README. Las listas clásicas de BMAD (analista, PM, arquitecto, SM, dev, QA) son de versiones anteriores: no verificado en esta consulta.

| Rol de la industria | Fuente | Fragua | Observación |
|---|---|---|---|
| Producto/requisitos | MetaGPT, BMAD | Parcial: skills `interpretar-idea`, `descubrir-idea`, comandos `sdd.especificar/descubrir`; agente `product-designer` (diseño, no requisitos) | Requisitos son skills, no agente. Aceptable: etapa interactiva con el usuario |
| Arquitecto | MetaGPT, BMAD | `arquitecto` y `architecture-designer` | Solapamiento (ver §5) |
| Planificador/gestor de proyecto | MetaGPT, CrewAI manager | Skills `enrutador-agentes`, `resource-selector`, `effort-router`, `token-budget`; comando `sdd.construir` | Orquestación repartida en 4 skills + comando; sin rol único |
| Implementador | todos | `desarrollador-backend`, `desarrollador-frontend` | Cubierto |
| Contratos/API, datos | menos común como rol propio | `diseñador-api`, `asesor-datos` | Fragua es más granular que la industria |
| Revisor de código | Claude Code (ejemplo oficial `code-reviewer`) | `revisor` | Cubierto |
| Crítico/evaluador | Anthropic evaluator-optimizer | `crítico` (agente) + skill `critica-diseno` | Cubierto; riesgo de duplicidad con `revisor` |
| QA/tester | ChatDev (testing en seminarios), MetaGPT no verificado | `tester`, skill `verificador-implementacion` | Cubierto |
| Seguridad | Copilot (controles de plataforma) | `seguridad` | Cubierto |
| DevOps | Copilot (Actions) | `operaciones`, skills de deploy, `sdd.canary` | Cubierto |
| Documentación | Kiro (steering), todos | `documentador` (desactivado por defecto) | Correcto como opt-in |
| Investigación/contexto | Anthropic (subagentes de búsqueda) | `investigador` | Cubierto; es el caso donde el multiagente sí rinde |
| Citador/verificador de fuentes | Anthropic (CitationAgent) | No tiene | Solo relevante si `investigador` afirma cosas externas |

## 2. Patrones de orquestación (con evidencia)

| Patrón | Evidencia | Cuándo | Equivalente en Fragua |
|---|---|---|---|
| Orquestador-trabajadores | Anthropic: un LLM central decide subtareas en tiempo de ejecución y delega; sistema de investigación con lead Opus 4 + subagentes Sonnet 4 | Subtareas no predecibles | `sdd.construir`, `sdd.diseñar` (usan Agent) |
| Evaluador-optimizador | Anthropic: funciona cuando los criterios son claros y el feedback mejora la salida de forma medible | Criterios claros | `crítico`, `critica-diseno` (score < 4 reintenta) |
| Paralelización (sectioning/voting) | Anthropic; LangChain: Router/Subagents en paralelo ~9K tokens frente a ~15K de Skills en multi-dominio | Subtareas independientes | Skill `orquestacion-ptc` |
| Encadenamiento + verificaciones programáticas | Anthropic prompt chaining; BMAD «Clarify → Plan → Build and verify → Learn» | Subtareas fijas | Flujo SDD (spec → plan → tareas → construir) |
| Handoff (control por tool call) | LangChain: multi-salto pero secuencial, el menos eficiente en su prueba (7+ llamadas, ~14K+ tokens) | Flujos con estado | Campo `Handoffs` en comandos |
| Skills bajo demanda | LangChain Skills; Kiro steering `auto/fileMatch` | Un agente con muchas especialidades | 31 skills de Fragua |
| Manager jerárquico | CrewAI `hierarchical` con `manager_llm`/`manager_agent` que valida resultados | Equipos con validación central | No existe |
| Orquestador aprendido | ChatDev puppeteer (RL, NeurIPS 2025) | Investigación | No aplica |
| SOP codificado | MetaGPT «Code = SOP(Team)» | Procesos estables | Constitución + SDD |

Regla de la industria: flujos deterministas para pasos conocidos, agentes para lo abierto. Microsoft: «If you can write a function to handle the task, do that instead of using an AI agent.»

## 3. Lecciones y fallos documentados

| Fallo / lección | Fuente | Implicación para Fragua |
|---|---|---|
| Multiagente ≈ 15x tokens de un chat; agentes ≈ 4x | Anthropic, research system | Agente nuevo solo si el valor lo justifica |
| Tokens explican ~80% de la varianza de rendimiento en BrowseComp | Anthropic | Parte de la «mejora» es gasto, no organización |
| Dominios con contexto compartido y muchas dependencias, «como la mayoría del código», no encajan | Anthropic | La fase de construcción es el peor caso para paralelizar |
| Fallos: muchos subagentes para consultas simples, delegación vaga que duplica trabajo, subagentes que se distraen, errores acumulados | Anthropic | Tareas con objetivo, formato, herramientas y límites |
| Compartir contexto completo; las acciones llevan decisiones implícitas que chocan entre agentes paralelos | Cognition (2025) | Preferir hilo lineal; subagentes para preguntas acotadas |
| Negociación entre agentes frágil; handoffs con pérdida | Cognition | Pasar artefactos en archivos, no resúmenes |
| Subagentes de Claude Code responden preguntas acotadas en vez de escribir código en paralelo | Cognition | Rol consultivo para agentes de solo lectura |
| Guardar salidas en almacén externo y devolver referencias | Anthropic | Fragua ya usa `.sdd/`; mantener |
| Reescribir descripciones defectuosas de herramientas redujo 40% el tiempo | Anthropic | Autoauditoría de descripciones (`cache-audit`) |
| Un agente con buenas herramientas suele bastar; multiagente para gestionar contexto, concurrencia, exceso de herramientas | LangChain | Criterio de admisión de agente nuevo |
| Los frameworks pueden ocultar prompts y respuestas | Anthropic | Mantener agentes como Markdown legible |

Nota: las cifras de Anthropic son internas de su sistema de investigación, no un benchmark independiente.

## 4. Controles de seguridad y gasto

| Control | Quién | Detalle verificado | Fragua |
|---|---|---|---|
| Lista de herramientas | Claude Code `tools`/`disallowedTools`; Copilot `tools` | Mínimo privilegio; sin `tools`, Copilot permite todas | Declarado; revisar los que tienen Bash+Write |
| Límite de turnos | Claude Code `maxTurns` | Detiene al subagente | No visible en el inventario (no verificado si se usa) |
| Profundidad y concurrencia | Claude Code | 3 niveles por defecto (`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`); 20 concurrentes (`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`) | Fijar valores explícitos |
| Modelo por coste | Claude Code `model`, `effort` | Haiku para exploración | Skills `effort-router`, `token-budget` |
| Aislamiento | Claude Code `isolation: worktree`; Copilot una rama y un PR por tarea | Cambios fuera del árbol principal | Revisar para agentes que escriben |
| Hooks de bloqueo | Claude Code `PreToolUse` (exit 2 bloquea); Kiro `PreToolUse`, `PostFileSave`, `Stop` | Control determinista, no por prompt | Candidato principal (§5) |
| Contexto declarativo | Kiro steering (`product.md`, `tech.md`, `structure.md`; modos always/fileMatch/manual/auto) | Carga condicional | Equivalente a la constitución |
| Límite de sesión | Copilot: 59 min máx., no ampliable | | Sin límite declarado |
| Rate limit | CrewAI `max_rpm` | Tope por minuto; el de crew prevalece | N/A |
| Humano en el bucle | Anthropic: checkpoints humanos y condiciones de parada | Máximo de iteraciones | `sdd.aclarar`, `sdd.checklist` |
| Protección de ramas | Copilot | Rulesets pueden bloquear al agente | N/A |
| Herramientas poka-yoke | Anthropic | Rutas absolutas eliminaron errores | Revisar |

## 5. Recomendaciones ordenadas para Fragua

Base: 14 agentes es mucho frente a la evidencia, pero la mayoría son de solo lectura y consultivos, el patrón respaldado. El riesgo está en solapamientos y controles solo por prompt.

| # | Acción | Razón | Esfuerzo |
|---|---|---|---|
| 1 | **Cambiar**: hooks `PreToolUse` en frontmatter de los agentes con Bash+Write (backend, frontend, operaciones, tester, documentador, diseñador-api) para bloquear comandos destructivos y escrituras fuera de ruta | Control determinista soportado oficialmente (exit 2) | Bajo |
| 2 | **Cambiar**: fijar `maxTurns`, `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` (1 o 2) y concurrencia; quitar `Agent` a agentes consultivos | Evita cascadas y gasto 15x sin control | Bajo |
| 3 | **Fusionar**: `arquitecto` + `architecture-designer` en un agente con dos modos, o delimitarlos con exclusión mutua en la descripción | La delegación se decide por descripción; hoy mismo dominio, opus 175 líneas y sonnet 205 | Medio |
| 4 | **Delimitar**: `revisor` = conformidad con spec/código; `crítico` = riesgos e hipótesis antes de construir | Dos evaluadores en la misma fase duplican coste; el evaluador-optimizador exige criterios distintos y claros | Bajo |
| 5 | **Fusionar** las 4 skills de enrutado (`enrutador-agentes`, `resource-selector`, `effort-router`, `token-budget`) en 1-2, o pasarlas a script determinista | Microsoft: si puedes escribir una función, hazlo; el enrutado es regla por fase | Medio |
| 6 | **Eliminar/archivar**: `compresion-tokens` (deprecada) y duplicados (`indexador` vs `indexar-proyecto`; `vercel-deploy` vs `deploy-vercel`) | Descripciones sobrantes consumen contexto (aviso a 15k tokens en la doc) | Bajo |
| 7 | **Cambiar**: política de modelo documentada; hoy 6 agentes opus. Opus para arquitecto, crítico, seguridad; probar sonnet en `revisor`, `asesor-datos`, `product-designer` | Coste; medir antes de decidir | Medio |
| 8 | **Mantener**: backend/frontend secuenciales sobre los mismos archivos; paralelizar solo investigación, revisión y seguridad (solo lectura) | Cognition y Anthropic: decisiones implícitas en conflicto, dependencias en código | Nulo |
| 9 | **Añadir** (opcional): verificación de citas como paso de `investigador`, no agente nuevo | Patrón CitationAgent; coste mínimo | Bajo |
| 10 | **No añadir** agente manager/PM | Ya repartido en comandos y skills; el jerárquico añade llamadas | Nulo |
| 11 | **Medir**: ~20 casos con juez de rúbrica antes de añadir o quitar agentes; usar `observabilidad-consumo` | Anthropic: evaluar resultados, no trayectorias | Medio |

Limitaciones: no se leyeron los últimos ~11k caracteres de la doc de subagentes; OpenHands no verificado; AutoGen hoy es sucedido por Microsoft Agent Framework (no se revisó AutoGen aparte); LangGraph cubierto vía la página de LangChain sin los nombres «supervisor»/«swarm».
