# Plan maestro — FORGE Motor Agéntico (reemplaza a "FORGE v2")

> **Estado:** en ejecución. FASE 0 hecha salvo una decisión (la guarda de ADR del hook). FASE 1 implementada: 38 de 38 tareas, **pero rechazada por las dos revisiones independientes** (verificación y seguridad) en su primera versión; los hallazgos reproducidos están corregidos y falta una nueva pasada independiente. `forge run --motor ciclo` funciona de extremo a extremo con Docker real, en JavaScript y Python, con respuestas guionizadas y con LangGraph.js opcional; **no se ha probado con un modelo de pago**. Ver `.sdd/especificaciones/2026-10-03-ciclo-verificado/verificacion.md` y `revision-seguridad.md`.
> **Fecha:** 2026-10-03
> **Visión:** que FORGE pueda construir una tarea sin supervisión y entregar código que **pasa sus pruebas**, ejecutado **fuera de tu equipo**, con **gasto acotado** y **reanudable**. Como mejora incremental del repo actual, no como reescritura.
> **Reemplaza a:** `../doc/plan_de_ejecuci_n_forge_v2.md` y los otros seis documentos de `../doc/`.

---

## Decisiones de arquitectura tomadas

| Decisión | Elección | Implicación |
|---|---|---|
| **Naturaleza** | **Mejora incremental del repo** | No hay producto nuevo ni reescritura. El plugin, los hooks, los 14 agentes y los tests siguen. |
| **Stack** | **Node.js con equivalentes JS** | LangGraph.js y CLI de Docker. Se reutiliza `core/llm-providers` en lugar de LiteLLM y `ui/server.js` en lugar de FastAPI. Python queda descartado. |
| **Grafo** | **Fusión de los dos diseños** | `planner → retriever → qa → coder → sandbox → router`. El éxito lo decide el código de salida, no un modelo. |
| **Alcance** | **Núcleo primero** | La spec 1 cubre ciclo, aislamiento, presupuesto, reanudación y CLI. MCP, memoria semántica y API HTTP son specs posteriores. |
| **Nombre y versión** | **"Motor Agéntico", 4.3.0** | "v2" choca con el paquete (4.2.0) y con `docs/roadmap.md:50`. Opt-in en 4.3.0; por defecto en 5.0.0. |

Las cuatro primeras las tomaste tú el 2026-10-03. La quinta es una propuesta (ADR-09).

---

## Contexto — la brecha real

El plan v2 partía de una premisa falsa y de dos diseños que no encajan entre sí.

- ✅ **Ya existe:** enrutado de cuatro proveedores, Ollama incluido (`core/llm-providers/index.js:76-118`).
- ✅ **Ya existe:** registro de eventos con reanudación por tarea (`core/event-log.js:83-103`) y panel SSE.
- ✅ **Ya existe:** orden topológico, interruptor de circuito y contrato `Runner` (`core/orchestrator.js:176-208`, `core/runners/runner.js:9-23`).
- ✅ **Ya existe:** contabilidad de gasto, aunque solo avisa (`core/session-budget.js`).
- ✅ **Ya existe:** los prompts de 14 agentes, reutilizables por el motor (`core/agent-registry.js:17-71`).

**Las brechas:**

| # | Brecha | Evidencia |
|---|---|---|
| **B1** | No hay Docker ni aislamiento. El código generado se ejecuta en el equipo anfitrión. El "sandbox" es un nivel del interruptor de circuito. | `core/runners/runner.js:31-51`; `core/execution-context.js:30-36`; ningún `Dockerfile` en el repo |
| **B2** | No hay ciclo de corrección. Una tarea que falla se marca y se detiene. | `core/orchestrator.js:164-168` |
| **B3** | El presupuesto no bloquea ni degrada, y se pierde al reanudar. | `core/session-budget.js:30-45` |
| **B4** | `forge resume` relanza las tareas desde cero. | `core/engine-cli.js:124-127` |
| **B5** | El motor y los comandos SDD usan claves y rutas distintas. `forge run` no puede consumir lo que genera `/sdd.tareas`. | `core/state-machine.js:63`; `core/engine-cli.js:88,135,185`; `commands/sdd.tareas.md:203-223` |
| **B6** | No hay memoria semántica: los embeddings son un mock. | `utils/hybrid-indexer.js:46-62` |
| **B7** | No hay servidor MCP propio ni API de escritura. | `.mcp.json` (solo Playwright); `ui/server.js` (solo lectura) |
| **B8** | Los 7 documentos de `../doc/` describen dos grafos incompatibles y un stack Python. | `../doc/LEEME.md` |

**Resultado buscado:** `forge run --motor ciclo` entrega tareas con sus pruebas pasando o con una decisión humana registrada, sin ejecutar nada generado en el equipo anfitrión y sin superar el tope de gasto.

---

## Arquitectura objetivo

```
forge run --motor ciclo
      │
      ▼
core/orchestrator.js  ── orden topológico, interruptor de circuito (existen)
      │  por cada tarea de código
      ▼
core/ciclo/ ───────────────────────────────────────────────────────────┐
  planner ─▶ retriever ─▶ qa ─▶ coder ─▶ sandbox ─▶ router            │
                                  ▲                    │               │
                                  └──── fail ──────────┤               │
                                                       ├─ pass ─▶ fin  │
                                                       └─ tope / gasto / infra
                                                              ▼        │
                                                       revision_humana │
  punto de guardado tras cada nodo ─▶ .sdd/motor/<runId>/checkpoints/  │
└──────────────────────────────────────────────────────────────────────┘
      │                       │                         │
      ▼                       ▼                         ▼
core/llm-providers/     core/recuperacion/        core/sandbox/
(existe)                puerto Recuperador        Docker por CLI, sin red
                        └ por archivos (S1)       └ imagen preparada por huella
                        └ LanceDB (S3)
```

**Principio rector:** nodos y router son funciones puras; el motor que los ejecuta (LangGraph.js o el propio) es intercambiable.

---

## Principios

1. **Reusar > reescribir.** Se engancha en un punto del orquestador (`_executeTask`). La máquina de estados solo se amplió en el saneamiento, para entender la etapa que escriben los comandos `/sdd.*`.
2. **Aislamiento real o nada.** Sin Docker, el ciclo se detiene. Nunca cae al equipo anfitrión.
3. **El código de salida decide.** Ni búsqueda de texto ni un modelo como juez.
4. **Opt-in hasta 5.0.0.** Activar el ciclo no cambia el modo clásico, pero las correcciones de la spec de saneamiento sí lo cambiaron respecto a 4.2.0 (siete cambios, listados en `docs/ciclo-verificado.md`), y el modo clásico se niega a ejecutar mientras haya tareas del ciclo sin terminar.
5. **Honestidad documental.** Lo no verificado se marca y se resuelve con un spike antes de construir encima.

---

## FASE 0 — Saneamiento (S0, prerrequisito, hito 4.2.1)

> **Estado (2026-10-03): hecha salvo dos decisiones.** Corregidos 0.2 a 0.7, 0.9 y 0.10, y de 0.1 la clave de la spec activa y el archivo de tareas (`core/tareas.js`). Además apareció y se corrigió una ruta partida por `/` en `utils/episodic-memory.js`. Suite: 1029 de 1029 en Windows. La etapa del proyecto quedó resuelta de forma compatible: `pipeline_step` manda y, si falta, se traduce `fase_actual`. Queda para ti 0.8, porque la guarda de ADR del hook bloquearía escrituras legítimas si se apunta a `.sdd/arquitectura/` sin afinar su heurística. Detalle en `.sdd/especificaciones/2026-10-03-saneamiento/spec.md`.

**Objetivo:** que el motor headless y los comandos SDD hablen el mismo idioma, y cerrar defectos que hoy rompen la instalación.

- **0.1** Unificar claves y rutas: `spec_activa` / `especificacion_activa`, `pipeline_step` / `fase_actual`, y `.sdd/estado-tareas.json` (array) frente a `.sdd/especificaciones/{ID}/.estado-tareas.json` (objeto).
- **0.2** `cli/runner.js:34-45` busca `dist/core`, que ya no existe: apuntar a `core/`.
- **0.3** `copiarNucleo` (`cli/index.js:142-144`) no copia `claude-hooks/shared/config.js` ni los `.sh`: los hooks instalados fallan al cargar.
- **0.4** `claude-hooks/agent-memory.js:35-40`: `__registryPath` definido, `_registryPath` usado.
- **0.5** `utils/adr-parser.js:7-9`: `require("glob")` en un paquete ESM, sin la dependencia.
- **0.6** `safeFiles` confina con `startsWith` sin separador (`core/runners/runner.js:58-63`).
- **0.7** El orquestador y el interruptor de circuito leen `process.cwd()` en vez de `--cwd` (`core/orchestrator.js:139`, `core/execution-context.js:64`).
- **0.8** Unificar la convención de ADR en comandos y hook (ADR-10).
- **0.9** 38 tests escriben en `/tmp/...` fijo y fallan en Windows con `ENOENT` (`tests/ast-compressor.test.js`, `delta-encoding.test.js`, `episodic-memory.test.js`, `hybrid-indexer.test.js`): usar `os.tmpdir()`.
- **0.10** `package.json` lista `dist/` en `files[]` pero no existe; `tests/release-safety.test.js:104` falla.

**Reuso:** todo es corrección sobre archivos existentes.

**Verificación:** `npm test` verde; `npx forge init` en un directorio temporal y los hooks cargan; `forge run` ejecuta un `.estado-tareas.json` generado por `/sdd.tareas`.

> Los defectos 0.2 a 0.5 salen de lectura de código, no de ejecución. Confirmarlos es el primer paso de S0. Los defectos 0.9 y 0.10 sí están confirmados por ejecución.

**Línea base medida (2026-10-03, Windows 11, Node 24.20):** `npm test` da 1014 tests, 975 en verde y 39 fallidos: los 38 de 0.9 y el de 0.10. Ninguno se debe a la `.sdd/` nueva. El README dice "998 tests pasando"; en Windows no es cierto.

---

## FASE 1 — Ciclo Verificado (S1, hito 4.3.0)

**Objetivo:** el ciclo completo, aislado, con presupuesto y reanudable. Es la spec `2026-10-03-ciclo-verificado`.

- **1.1** Dos spikes: guardador e interrupciones con LangGraph.js en Node 20; montajes en Docker Desktop para Windows.
- **1.2** Tests primero: router, presupuesto, confinamiento, política, puntos de guardado.
- **1.3** `core/sandbox/`: política → argv, CLI de Docker, copia desechable, imagen preparada.
- **1.4** `core/ciclo/`: estado, router, presupuesto, protocolo de archivos, seis nodos, grafo, dos motores.
- **1.5** `core/recuperacion/`: puerto y recuperador por archivos.
- **1.6** CLI: `--motor`, `--decision`, extras, códigos de salida, `forge status`.
- **1.7** Integración en `core/orchestrator.js` y job de CI con Docker real.

**Reuso:** `crearProvider`, `LlmAgentAdapter.execute` (`core/agent-registry.js:84-98`), `EventLog`, `detectStack`, contrato `Runner`, `QualityGate`, escritura atómica (`core/state-store.js:72-74`).

**Verificación:** los 39 criterios de aceptación con test; suite existente verde con `motor.modo: clasico`; job de Docker verde en `ubuntu-latest`; `docker ps -a --filter label=forge.sandbox=1` vacío tras la suite.

Detalle: `.sdd/especificaciones/2026-10-03-ciclo-verificado/` (spec, checklist, plan) y `.sdd/arquitectura/ADR-01` a `ADR-11`.

---

## FASE 2 — Herramientas MCP (S2, hito 4.4.0)

> **Estado (2026-10-03): implementada, sin verificación independiente.** `forge mcp` con tres herramientas, sin dependencias nuevas (ADR-12), probado con el cliente oficial del SDK y con Docker real. Spec, plan, tareas y verificación en `.sdd/especificaciones/2026-10-03-herramientas-mcp/`; guía en `docs/servidor-mcp.md`. Falta probarlo con Claude Code y una revisión independiente.

**Objetivo:** exponer el aislamiento y la escritura confinada como servidor MCP propio, y consumirlos desde los nodos.

- **2.1** Servidor con tres herramientas: ejecutar en el entorno aislado, leer archivo, escribir archivo confinado.
- **2.2** Cliente en los nodos, conservando las reglas de confinamiento de ADR-07.

**Reuso:** `core/sandbox/` y `core/ciclo/protocolo-archivos.js` de S1; plantilla `plantillas/mcp-server.md`.

**Verificación:** las herramientas rechazan las mismas rutas que el protocolo de archivos; la suite de aislamiento pasa a través del servidor.

---

## FASE 3 — Memoria semántica (S3, hito 4.5.0)

**Objetivo:** una implementación del puerto `Recuperador` con búsqueda por similitud.

- **3.1** Indexador del repositorio con embeddings reales, que sustituye el mock de `utils/hybrid-indexer.js`.
- **3.2** Recuperador sobre LanceDB, opcional: su SDK exige Node ≥22.
- **3.3** Modo totalmente local, con embeddings de un proveedor local.

**Reuso:** puerto `Recuperador` de S1; `core/decisions/decision-store.js` como referencia.

**Verificación:** el ciclo funciona igual con el recuperador por archivos y con el semántico; el contexto respeta el tope de bytes.

---

## FASE 4 — API HTTP (S4, hito 4.6.0)

**Objetivo:** lanzar tareas, consultar estado y decidir revisiones por red local.

- **4.1** ~~Extender `ui/server.js`~~ **Cambio de decisión (ADR-13):** servidor aparte, `core/api/servidor.js`, en loopback, con secreto, sin CORS y rechazando `Origin` y `Host` ajeno. `ui/server.js` queda de solo lectura.
- **4.2** La decisión de revisión reutiliza el mecanismo de `forge resume --decision`: la API lanza `forge run|resume --motor ciclo` como proceso aparte; el modo no se puede elegir.

**Estado:** implementada y autoevaluada (spec `2026-10-03-api-http`, `docs/api-http.md`); sin revisión independiente.

**Reuso:** puntos de guardado y revisión de S1.

**Verificación:** una revisión decidida por HTTP produce el mismo estado que por CLI; sin token, 401.

---

## FASE 5 — Ciclo por defecto (S5, hito 5.0.0)

**Objetivo:** activar el ciclo por defecto y simplificar.

- **5.1** `motor.modo: ciclo` por defecto.
- **5.2** Retirar Node 18; decidir si queda un solo motor (ADR-01).
- **5.3** Declarar el SDK del proveedor en `dependencies`.

**Verificación:** matriz de CI en verde sin Node 18; guía de migración en `CHANGELOG.md`.

---

## Orden y dependencias

```
FASE 0 (S0 Saneamiento) ──▶ FASE 1 (S1 Ciclo Verificado) ──┬──▶ FASE 2 (S2 MCP) ──┐
                                                            ├──▶ FASE 3 (S3 Memoria)├──▶ FASE 5 (S5)
                                                            └──▶ FASE 4 (S4 API) ───┘
```

S2, S3 y S4 son independientes entre sí. S4 es más útil después de S2.

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| LangGraph.js exige Node ≥20 | Dependencia opcional con carga perezosa y motor propio de reserva (ADR-01). Comprobado: en Node 18 `npm install` solo avisa y se usa el motor propio |
| El guardador de LangGraph.js depende de campos internos de `MemorySaver` | Versión fijada con `~`; los dos motores comparten puntos de guardado y hay test de reanudación cruzada |
| Docker Desktop para Windows: montajes y usuario sin verificar | Spike 1.1; alternativa `docker cp` |
| Falso pase con pruebas triviales | Huellas, pruebas no vacías; el router no mide la calidad de las pruebas |
| Sin S0, el ciclo no sirve para el flujo real | S0 es prerrequisito, no opcional |
| La promesa comercial "ningún código malicioso puede afectar al host" es absoluta | Matizarla: un contenedor reduce el riesgo, no lo elimina |
| La suite no está en verde en Windows (39 fallos previos) | Arreglarlos en S0 (0.9 y 0.10) para que "sin regresiones" sea comprobable |

---

## Verificación global (end-to-end)

1. `npm test` en verde tras S0, también en Windows (hoy: 975 de 1014).
2. S0: `forge run` ejecuta tareas generadas por `/sdd.tareas`.
3. S1: en un proyecto de ejemplo, `forge run --motor ciclo` completa una tarea cuya primera implementación falla.
4. S1: con Docker detenido, el mismo comando termina con el código de "aislamiento no disponible" y no ejecuta nada.
5. S1: cortar el proceso a mitad y `forge resume` continúa sin repetir llamadas.
6. S1: con un tope de $0.01, la tarea pasa a revisión por presupuesto.
7. Con `motor.modo: clasico` el ciclo no interviene, pero el modo clásico no es idéntico a 4.2.0: ver los cambios del saneamiento en `docs/ciclo-verificado.md`.

---

## Qué te toca a ti

1. Responder las 6 preguntas abiertas de la spec (sección 11).
2. Ratificar la constitución (`.sdd/memoria/constitucion.md`).
3. Aprobar la spec (`forge aprobar spec`) y el plan (`/sdd.planificar aprobar`).
4. Aceptar o rechazar los 11 ADR.

Después se generan `tareas.md`, `.estado-tareas.json` y `analisis.md`.
