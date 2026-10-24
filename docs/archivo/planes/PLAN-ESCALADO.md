# Plan de escalado — FORGE agnóstico y orquestador

> **Fecha:** 2026-10-13 · **Rama:** `feature/motor-agentico` · **Continúa a:** `PLAN-EJECUCION-FINAL.md`
> Qué hay, qué falta y en qué orden se construye para que FORGE no dependa de un modelo ni de una herramienta, y pueda repartir trabajo. La regla del plan es **reutilizar lo que ya existe**: casi todas las piezas tienen un punto de partida en el código.
> Las estimaciones son orientativas, no medidas. Nada de este plan está implementado.

## 1. Resumen

| Objetivo | Punto de partida que ya existe | Lo que falta de verdad |
|---|---|---|
| Agnóstico de modelo | Interfaz de proveedor con una conversación neutra; cuatro proveedores | OpenAI y Ollama no conversan con herramientas y nunca se probaron con un modelo real; un modelo sin precio se cuenta al más caro conocido, lo que frena a un modelo local |
| Agnóstico de herramienta | Servidor MCP, API HTTP local, adaptadores, exportación a Spec Kit y OpenSpec, `AGENTS.md` | El ciclo verificado no se ofrece por MCP; no hay contrato público versionado; los agentes están en formato de Claude Code |
| Orquestador | Niveles topológicos y ejecución en paralelo en `core/orchestrator.js`; copias de trabajo; candado; registro de eventos | El ciclo fuerza la ejecución en serie porque el área de trabajo y el presupuesto son compartidos; no hay cola ni servicio |

**Orden recomendado:** E0 cierre → E1 modelo → E2 herramienta → E3 orquestador local → E4 servicio → E5 lenguajes. E1 y E2 son baratas y son las que hacen a FORGE agnóstico. E3 y E4 son el salto a orquestador y no conviene empezarlas sin usuarios reales.

## 2. Inventario: lo que hay

| Pieza | Dónde | Estado | Sirve para |
|---|---|---|---|
| Interfaz de proveedor con conversación neutra (`mensajes`, `herramientas`, `Bloque`, `stopReason`) | `core/llm-providers/provider-interface.js` | Hecha; solo Anthropic implementa `conversar` | E1 |
| Proveedor Anthropic con herramientas y caché | `core/llm-providers/anthropic-provider.js` | Validado con modelo real | Referencia de E1 |
| Proveedor OpenAI y compatibles (Azure, GitHub Models, cualquier `base_url`) | `core/llm-providers/openai-provider.js` | Solo `complete`; `admiteHerramientas` es `false`; alias fijados a `gpt-4o` | E1 |
| Proveedor Ollama | `core/llm-providers/ollama-provider.js` | Solo `complete`; sin herramientas | E1 |
| Proveedor de pruebas con guion | `core/llm-providers/stub-provider.js` | Hecho | Pruebas de conformidad de E1 |
| Niveles `modelos:` y `precios:` configurables (ADR-19) | `core/ciclo/config.js`, `core/precios.js` | La lista trae Anthropic y dos modelos de OpenAI (`gpt-4o`, `gpt-4o-mini`); a un modelo sin precio se le aplica el más caro conocido (`precioMasCaro`) | E1 |
| Motor propio del ciclo, sin dependencias | `core/ciclo/`, `core/ciclo/motores/propio.js` | Validado | Base de todo |
| Orquestador con niveles topológicos y `_runParallel` | `core/orchestrator.js:36-102` | El paralelo se desactiva con el ciclo (`orchestrator.js:56`) | E3 |
| Copia de trabajo aislada | `core/sandbox/staging.js` (`crearCopia`, `eliminarCopia`) | Hecha, usada por el sandbox | E3 |
| Candado entre procesos | `core/ciclo/candado.js` | Hecho; hoy bloquea un segundo `forge run` en el mismo proyecto | E3 |
| Libro de gasto y tope | `core/ciclo/presupuesto.js`, `core/session-budget.js` | Hecho; un libro por proyecto | E3 |
| Registro y bus de eventos | `core/event-log.js`, `core/event-bus.js` | Hechos | E2, E4 |
| API HTTP local con token | `core/api/servidor.js` (`/v1/estado`, `/v1/ejecuciones`, `/v1/decisiones`) | Hecha; un proyecto, un usuario, lanza el CLI | E4 |
| Servidor MCP | `core/mcp/` (`ejecutar_pruebas`, `leer_archivo`, `escribir_archivo`) | Hecho; no expone el ciclo | E2 |
| Adaptadores | `core/adapters/` (`claude-code`, `speckit`), `forge dispatch` | Hechos; sin adaptadores para otras herramientas | E2 |
| Exportar e importar | `cli/export.js`, `cli/import.js` (Spec Kit, OpenSpec) | Hechos | E2 |
| Agentes | `agents/*.md` (14), con cabecera de Claude Code (`model`, `tools`) | El registro los carga; el formato no es neutral | E2 |
| `AGENTS.md` generado | `core/agents-md.js` | Hecho | E2 |
| Formatos de tareas | `core/tareas.js` (dos formatos internos) | Sin esquema público | E2 |
| Ejecutores de pruebas | `core/runners/` (Node, Python, Go; Rust solo en el modo clásico) | Tres lenguajes en el ciclo | E5 |
| Integraciones GitHub, GitLab, Jira | `core/integraciones/` | Hechas; sin cuenta real | E4 |

## 3. Lo que falta, por objetivo

### 3.1 Agnóstico de modelo

| Brecha | Consecuencia hoy | Solución con lo que hay |
|---|---|---|
| OpenAI y Ollama no implementan `conversar` | Con ellos el implementador por turnos no funciona: el ciclo cae al modo de bloque | Traducir la conversación neutra a `tools` y `tool_calls` de la API de chat, como ya hace `anthropic-provider.js` con `aBloqueApi` y `deBloqueApi` |
| Un modelo sin precio se cuenta al más caro conocido | Es prudente, pero un modelo local sin coste agota el tope sin gastar, y un modelo nuevo se sobrevalora sin avisar | Coste cero solo por declaración explícita en `precios:`, aviso de la clave que falta y una opción para no arrancar sin precio |
| Alias `opus/sonnet/haiku` fijados a `gpt-4o` | Nombres de Anthropic para modelos de otro proveedor; modelos anticuados | Nombrar niveles neutrales (alto, medio, económico) y dejar los actuales como alias; `modelos:` ya permite fijarlos |
| Sin prueba de conformidad | Cada proveedor se prueba aparte | Una sola suite que cualquier proveedor debe pasar, con el proveedor de pruebas como referencia |
| Nunca probados con modelo real | No se sabe si resuelven tareas | `scripts/pruebas-independientes.mjs` con `--proveedor`; hace falta clave del dueño |

### 3.2 Agnóstico de herramienta

| Brecha | Consecuencia hoy | Solución con lo que hay |
|---|---|---|
| El ciclo no está en MCP | Cursor, Codex u otra herramienta no pueden pedirle a FORGE que verifique | Añadir a `core/mcp/herramientas.js` las herramientas `ejecutar_ciclo`, `estado` y `decidir`, que llaman a lo mismo que `forge run` y `/v1/decisiones` |
| Sin contrato público | Quien integre depende de formatos internos que pueden cambiar | Esquemas JSON versionados de tareas, estado, veredicto y eventos, a partir de `core/ciclo/estado.js` y `core/tareas.js` |
| Agentes en formato de Claude Code | Otras herramientas no pueden leerlos | Un formato neutral del que se generen la cabecera de Claude Code y `AGENTS.md` (`core/agents-md.js` ya genera el segundo) |
| Dos adaptadores | `forge dispatch` solo conoce Claude Code y Spec Kit | Adaptadores nuevos sobre `core/adapters/adapter-interface.js` |
| Sin modo «solo verificar» | FORGE obliga a usar su flujo entero | Aceptar pruebas y código ya escritos por otra herramienta y aplicar solo sandbox, veredicto y mutación. Es el posicionamiento de `docs/MERCADO-CLASIFICACION.md` |

### 3.3 Orquestador

| Brecha | Consecuencia hoy | Solución con lo que hay |
|---|---|---|
| El ciclo corre en serie | Diez tareas independientes tardan diez veces | Un área de trabajo por tarea con `crearCopia`, ejecución con el `_runParallel` existente y fusión ordenada al terminar |
| Presupuesto por proyecto, sin reparto | En paralelo dos tareas podrían superar el tope | Reserva previa en el libro de gasto bajo candado: una tarea solo arranca si su reserva cabe |
| Conflictos entre tareas paralelas | Dos tareas pueden tocar el mismo archivo | La tarea ya admite una lista de archivos: paralelizar solo las que no se solapan y dejar en serie las demás. Falta comprobar si esa lista basta o si el planificador añade archivos después |
| Sin cola ni servicio | Cada ejecución es una orden manual | Cola persistente sobre el registro de eventos, servida por `core/api/servidor.js` |
| Un usuario, una terminal | No hay equipo ni aprobación por persona | Identidad, roles y aprobación por persona. Es el cambio más grande y toca el Principio III |
| Sin datos para enrutar | El nivel de modelo se elige con reglas fijas | Métricas de éxito, coste y duración por modelo y tipo de tarea, sacadas del libro de gasto y de los eventos |

## 4. Plan por etapas

### E0 — Cierre de lo actual (requisito previo)

Viene de `PLAN-EJECUCION-FINAL.md`. No se construye encima de algo sin validar.

| Tarea | Quién | Criterio de hecho |
|---|---|---|
| Abrir la solicitud de cambio y dejar la integración continua en verde en Linux | Dueño | Los jobs `tipos`, `pruebas-docker` y `aislamiento` pasan |
| Publicar `5.0.0-beta.1` con la etiqueta `next` | Dueño | El paquete se instala con `npm install forja-mvp@next` |
| Retirar cifras sin respaldo de `PLAN-GO-TO-MARKET.md` y `ANALISIS-COMPETITIVO-FINAL.md` | Agente | La prueba de consistencia pasa |

### E1 — Agnóstico de modelo (1 a 2 semanas)

| Tarea | Reutiliza | Criterio de hecho |
|---|---|---|
| E1.1 Suite de conformidad de proveedores | `stub-provider.js` | Una misma suite pasa con los cuatro proveedores contra servidores falsos |
| E1.2 `conversar` en OpenAI | La forma neutra y el patrón de `anthropic-provider.js` | El implementador por turnos completa una tarea con un servidor falso de la API de chat |
| E1.3 `conversar` en Ollama | Igual | Igual; si el modelo local no admite herramientas, se avisa y se usa el modo de bloque |
| E1.4 Gasto fuera de Anthropic | `core/precios.js`, `precios:` | Coste cero explícito para modelos locales; aviso de modelo sin precio; opción para no arrancar sin precio |
| E1.5 Niveles neutrales | `modelos:` (ADR-19) | `alto`, `medio` y `economico` funcionan; los alias antiguos siguen valiendo |
| E1.6 Validación con modelo real | `scripts/pruebas-independientes.mjs` | Tres proyectos en éxito con un segundo proveedor; evidencia registrada. Necesita clave y presupuesto del dueño |

**Riesgo:** los modelos difieren en cómo piden herramientas; la suite de conformidad debe cubrir llamadas en paralelo, argumentos mal formados y cortes por longitud.

### E2 — Agnóstico de herramienta (2 a 3 semanas)

| Tarea | Reutiliza | Criterio de hecho |
|---|---|---|
| E2.1 Contrato público versionado | `core/ciclo/estado.js`, `core/tareas.js`, `core/ciclo/contratos.js` | Esquemas publicados en `docs/contrato/`; una prueba falla si el código se aparta del esquema |
| E2.2 El ciclo como herramientas MCP | `core/mcp/`, `core/engine-cli.js` | Un cliente MCP lanza un ciclo, consulta el estado y envía una decisión, con las mismas garantías que el CLI |
| E2.3 Modo «solo verificar» | Sandbox, enrutador y mutación | `forge verificar` recibe pruebas y código de otra herramienta y devuelve veredicto, sin llamar a un modelo |
| E2.4 Formato neutral de agentes | `core/agent-registry.js`, `core/agents-md.js` | Una sola fuente genera la cabecera de Claude Code y `AGENTS.md` |
| E2.5 Guías de uso con otras herramientas | `cli/export.js`, `cli/import.js` | Guía probada de punta a punta con una herramienta que no sea Claude Code |

**Riesgo de seguridad:** exponer el ciclo por MCP abre una vía nueva para que un texto no confiable lance ejecuciones y gasto. Debe pasar por el tope de gasto, el candado y la aprobación humana existentes, y por una revisión independiente como las anteriores.

### E3 — Orquestador local (3 a 5 semanas)

| Tarea | Reutiliza | Criterio de hecho |
|---|---|---|
| E3.1 Área de trabajo por tarea | `core/sandbox/staging.js` | Dos tareas corren a la vez sin ver los cambios de la otra |
| E3.2 Reserva de presupuesto | `core/ciclo/presupuesto.js`, `core/ciclo/candado.js` | Con N tareas en paralelo el gasto nunca supera el tope, tampoco con un corte en mitad |
| E3.3 Paralelismo en el ciclo | `core/orchestrator.js` (`_topologicalLevels`, `_runParallel`) | Tareas sin archivos en común corren en paralelo; las que se solapan, en serie |
| E3.4 Fusión ordenada y conflictos | `core/ciclo/respaldo.js` | Un conflicto pausa con motivo y deja el proyecto como estaba |
| E3.5 Reanudación con varias tareas a medias | `core/ciclo/diario.js`, `checkpoint-archivos.js` | Un corte con tres tareas en curso se reanuda sin repetir llamadas pagadas |
| E3.6 Métricas por modelo y tipo de tarea | Libro de gasto y eventos | `forge logs` muestra éxito, coste y duración por modelo |

**Riesgo:** es el cambio que más toca las garantías ya revisadas (aislamiento, gasto, reanudación). Necesita su propia especificación, un ADR y una revisión independiente antes de fusionar.

### E4 — Servicio y equipo (más de 6 semanas; decisión del dueño)

| Tarea | Reutiliza | Decisión que requiere |
|---|---|---|
| E4.1 Cola persistente y varios proyectos | `core/api/servidor.js`, `core/event-log.js` | Dónde vive el estado si deja de ser local |
| E4.2 Eventos hacia fuera | `core/event-bus.js`, `core/integraciones/` | Enmienda del Principio III (local-first) |
| E4.3 Identidad, roles y aprobación por persona | La cola firmada de integraciones | Modelo de permisos; quién aprueba qué |
| E4.4 Integraciones con cuentas reales | `core/integraciones/` | Cuentas de prueba; REST o cliente MCP |

Esta etapa cambia qué es FORGE: de herramienta local a servicio. No se empieza sin uso real de E1 a E3.

### E5 — Más lenguajes (por demanda)

Cada lenguaje nuevo necesita cuatro piezas: imagen de contenedor (`core/sandbox/preparar-imagen.js`), ejecutor (`core/runners/`), detector de pruebas y medición de mutación (`core/ciclo/mutacion.js`). El orden lo marca lo que pidan los usuarios de la beta. Rust requiere revisar el ADR-18.

## 5. Decisiones que son del dueño

| Decisión | Afecta a | Por qué no la toma un agente |
|---|---|---|
| Claves y presupuesto para probar otros proveedores | E1.6 | Gasto real |
| Nombres de los niveles de modelo | E1.5 | Cambia la configuración que ven los usuarios |
| Exponer el ciclo por MCP | E2.2 | Abre una superficie de ataque nueva |
| Paralelismo en el ciclo | E3 | Modifica garantías ya revisadas |
| De herramienta local a servicio | E4 | Toca los Principios III y IV de la constitución |
| Qué lenguajes se añaden | E5 | Compromiso de mantenimiento |

## 6. Lo que no cambia

El plan mantiene lo que diferencia a FORGE, según `docs/MERCADO-CLASIFICACION.md`: el veredicto lo da el código de salida y no un modelo, el código generado solo corre aislado, hay un tope de gasto y una persona aprueba al final. Una etapa que debilite alguna de estas cuatro cosas no se fusiona.

## 7. Siguiente paso

Lo que puede empezar ya, sin coste y sin esperar decisiones: **E1.1 a E1.5** y **E2.1**. Lo primero que necesita al dueño es **E0** (solicitud de cambio) y, después, la clave para **E1.6**.
