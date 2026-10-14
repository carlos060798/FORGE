# FORGE 5.0 en el mercado de herramientas de ingeniería con IA

> Fecha de consulta: 2026-10-13. Fuentes de terceros: búsqueda web, mayormente agregadores y blogs; ninguna es hoja de precios oficial. Lo no confirmado va marcado «no verificado». Los precios cambian: confirmar en el sitio del proveedor.
> Evidencia propia de FORGE (de `FORGE-5.0-GUIA.md` y `EVALUACION-PUBLICACION.md`): ciclo verificado demostrado en Windows 11 con Docker y modelo Anthropic real, 24 ejecuciones y proyectos pequeños; Linux, OpenAI/Ollama, integraciones GitHub/GitLab/Jira y CI **sin validar**; 5.0.0 **no publicada en npm**; spec 0 de 10 completadas por el dueño.

## 1. Taxonomía del mercado

| Categoría | Qué hace | Ejemplos |
|---|---|---|
| Asistentes en IDE | Autocompletado, chat y edición dentro del editor | Cursor, GitHub Copilot, Windsurf (los dos últimos: no verificado en esta búsqueda) |
| Agentes de código autónomos | Reciben una tarea y la ejecutan de punta a punta | Devin, Claude Code, Cline, Aider |
| Spec-driven development (SDD) | La especificación es el artefacto central; el código se deriva | GitHub Spec Kit, Kiro, OpenSpec, BMAD, Tessl |
| Orquestadores/frameworks de agentes | Librerías para construir sistemas multiagente propios | LangGraph, CrewAI |
| Plataformas de gestión con IA | Planificación/seguimiento con IA | Jira/GitHub con IA (no verificado; FORGE solo se integra, no compite) |

## 2. Competidores

### 2.1 SDD directos

| Herramienta | Qué es / estado | Modelo y precio | Diferencia con FORGE |
|---|---|---|---|
| GitHub Spec Kit | Kit open source de GitHub, anunciado sept. 2025; flujo Spec→Plan→Tasks→Implement en Markdown; 30 integraciones de agentes. GitHub lo describe como «experimento». [fuente](https://github.github.com/spec-kit/), [VS Magazine](https://visualstudiomagazine.com/articles/2025/09/03/github-open-sources-kit-for-spec-driven-ai-development.aspx) | MIT, gratis | Genera especificación y plan; no ejecuta ni verifica el resultado. FORGE añade ejecución aislada y veredicto. |
| Kiro (AWS) | IDE agéntico sobre Code OSS; spec como fuente de verdad; GA entre marzo y mayo 2026 (fuentes discrepan). [reseña](https://pasqualepillitteri.it/en/news/6370/amazon-kiro-ide-spec-driven-review), [índice](https://theaiagentindex.com/agents/kiro) | Free/Pro 20/Pro Max 100/Power 200 USD al mes según un índice; otras fuentes discrepan (no verificado) | Producto de IDE respaldado por AWS; FORGE no tiene IDE ni empresa detrás. |
| OpenSpec (Fission-AI) | Capa ligera: propuesta, deltas de spec, tareas; npm, Node ≥20.19; 25+ herramientas. Estrellas 43k-50k según fuente. [reseña](https://buildingwithgrace.substack.com/p/the-fork-report-openspec-by-fission), [gittrend](https://gittrend.io/repo/Fission-AI/OpenSpec) | Open source | Mismo stack (Node/npm) y mismo tipo de flujo; mucha más comunidad; no ejecuta ni verifica. |
| BMAD-METHOD | Marco ágil con 21 agentes/roles y 50+ flujos; `npx bmad-method install`; MIT; 37k-49k estrellas según fuente. [Augment](https://www.augmentcode.com/guides/bmad-method-ai-development), [SourcePulse](https://www.sourcepulse.org/projects/2394898) | Open source | Roles y planificación; FORGE separa roles (pruebas vs código) pero además comprueba con ejecución. |
| Tessl | Spec-as-source; 125 M USD recaudados (nov. 2024); reseña de mediados 2026: «la menos probada», aún tesis. [reseña](https://codemyspec.com/blog/tessl-review), [TechCrunch](https://techcrunch.com/2024/11/14/tessl-raises-125m-at-at-500m-valuation-to-build-ai-that-writes-and-maintains-code/) | Gratis con enterprise a medida (no verificado) | Visión más ambiciosa y financiada; FORGE es más modesto y local. |

### 2.2 Adyacentes

| Herramienta | Qué es | Precio (terceros, no oficial) | Relación con FORGE |
|---|---|---|---|
| Claude Code | Agente de código de Anthropic en terminal | Pro 20, Max 100/200 USD/mes o API por token [pricepertoken](https://pricepertoken.com/coding-assistants/compare/claude-code-vs-cursor) | Es el huésped de FORGE: FORGE se apoya en él, no lo sustituye. |
| Cursor | IDE con IA | Hobby gratis, Pro 20, Business 40 USD [aicodereview](https://aicodereview.cc/blog/cursor-pricing) | Asistente interactivo; sin ciclo verificado propio (no verificado). |
| Devin | Agente cloud delegado | ~20 USD + ACU; hasta ~500 USD/mes por agente activo (no verificado) [pricepertoken](https://pricepertoken.com/coding-assistants/devin) | Opuesto: nube y delegación total; FORGE es local con humano al final. |
| Aider, Cline | Agentes open source de terminal/VS Code | No verificado (la búsqueda no los devolvió) | Cercanos en espíritu; sin datos fiables aquí. |
| CrewAI, LangGraph | Frameworks multiagente Python, MIT; ~45.9k y ~24.6k estrellas [comparativa](https://fast.io/resources/langgraph-vs-crewai/) | Gratis; LangSmith/Platform de pago (no verificado) | Construyen agentes; no son un flujo de entrega de software cerrado. FORGE retiró LangGraph.js (ADR-18). |

## 3. Clasificación de FORGE

**Categoría honesta:** SDD con arnés de verificación, ejecutado sobre un agente existente (Claude Code). No es IDE, ni agente autónomo propio, ni orquestador genérico.

**Diferencias reales (según su documentación; solo probadas en Windows/Anthropic, proyectos pequeños):**

| Rasgo | Dentro de los SDD citados |
|---|---|
| Pruebas escritas por otro rol que el implementador | No lo documentan las herramientas citadas (no verificado a fondo) |
| Ejecución en Docker sin red, obligatoria (sale 4 si falta) | No visto en las fuentes consultadas |
| Veredicto por código de salida + detección de «éxito sospechoso» | Idem |
| Tope de gasto con degradación de modelo, reanudación, auditoría | Idem |
| Local-first, 3 dependencias | Compartido con OpenSpec/Spec Kit en parte |

**Lo que NO tiene:** IDE; comunidad (competidores con decenas de miles de estrellas, FORGE sin publicación en npm); respaldo de empresa o soporte; velocidad (el ciclo es lento y gasta tokens); soporte de lenguajes (solo JS/TS, Python, Go); monorepos; validación en Linux/CI/otros proveedores; integraciones probadas; marketplace/plataformas. Además depende de Docker.

## 4. Tendencias

| Tendencia | Efecto | Evidencia |
|---|---|---|
| Seguridad de agentes y gobernanza: OWASP Top 10 for Agentic Applications (publicado 9-dic-2025) | Favorece: aislamiento, aprobación humana, auditoría | [OWASP](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026) |
| Convergencia hacia SDD (Spec Kit con 30 agentes, Kiro, OpenSpec) | Valida la categoría, pero la comoditiza | Fuentes de la sección 2 |
| Costes impredecibles (créditos, ACU) | Favorece el tope de gasto | [pricepertoken](https://pricepertoken.com/coding-assistants/devin) |
| Gigantes integrando SDD en IDE/plataforma | Perjudica: el SDD básico será gratis y nativo | Kiro, Spec Kit |
| Agentes cada vez mejores que verifican solos | Riesgo: la ventaja de verificación podría integrarse en Claude Code (especulación) | — |

## 5. Veredicto

**Hoy:** proyecto de un solo autor en fase beta, no publicado, con una idea técnica concreta (verificación determinista y aislada) demostrada a escala pequeña. No compite en comunidad ni en producto con Spec Kit, Kiro, OpenSpec o BMAD; es un complemento o prototipo de nicho.

**Para un nicho defendible debería ser cierto:**
1. Publicar `5.0.0-beta` y CI Linux verde; validar Docker en Linux/macOS.
2. Medir con benchmark público: tasa de defectos detectados y coste frente a Claude Code solo y a Spec Kit/OpenSpec.
3. Posicionarse como «capa de verificación y gobierno» compatible con otros SDD, no como suite completa.
4. Probar al menos una integración real y un segundo proveedor.
5. Alinear explícitamente con OWASP Agentic (mapeo de controles) para entornos regulados o con requisitos de auditoría.
6. Evidencia de adopción externa (algún usuario o equipo distinto del autor).

No verificado: precios oficiales, estrellas actuales, estado de Aider/Cline, y si los competidores ya incluyen ejecución aislada con veredicto.
