---
spec_id: 2026-10-03-ciclo-verificado
plan_id: 2026-10-03-ciclo-verificado-plan
estado: aprobado  # pendiente_aprobacion | aprobado | obsoleto
creado: 2026-10-03
constitucion_version: 1.0.0
agentes_participantes: [arquitecto, critico, seguridad, desarrollador-backend, tester, operaciones, revisor, documentador]
---

# Plan Técnico: Ciclo Verificado

## 1. Resumen Ejecutivo

Se añade al motor headless de FORGE un ciclo por tarea `planner → retriever → qa → coder → sandbox → router`, que corrige el código hasta que las pruebas pasan, con tope de 5 iteraciones, tope de gasto y revisión humana. El código generado deja de ejecutarse en el equipo anfitrión y pasa a contenedores Docker sin red, lanzados con la CLI. El ciclo vive en tres carpetas nuevas (`core/ciclo/`, `core/sandbox/`, `core/recuperacion/`) y se engancha en `core/orchestrator.js` y `core/engine-cli.js`. Es opt-in (`motor.modo: ciclo`) y se entrega en 4.3.0; el modo clásico no cambia. LangGraph.js es una dependencia opcional detrás de un puerto, con un motor propio de reserva para Node 18.

## 2. Verificación de Constitución (Constitution Check)

| Principio | Cumple | Justificación |
|-----------|--------|--------------|
| I. La especificación manda | ⚠️ | La spec existe y no nombra tecnologías, pero este plan se redactó antes de su aprobación. Ver sección 15. |
| II. La aprobación es humana | ✅ | `spec_aprobado` y `plan_aprobado` están en `false`; este plan queda en `pendiente_aprobacion`; los ADR, en `propuesta`. |
| III. Local primero y sin proveedor fijo | ✅ | Reutiliza `crearProvider` (`core/llm-providers/index.js:76-118`). La degradación puede ir a un proveedor local. |
| IV. Dependencias mínimas | ⚠️ | Añade dependencias opcionales de carga perezosa (ADR-01). El aislamiento no añade ninguna (ADR-02). Ver sección 15. |
| V. Código generado fuera del anfitrión | ✅ | `SandboxRunner` sustituye a `execSync` en modo ciclo. Sin Docker, error; nunca se cae al anfitrión. |
| VI. Decisiones deterministas | ✅ | Router por código de salida y estado (ADR-05). |
| VII. Pruebas antes y por otro rol | ✅ | Nodo `qa` antes de `coder`; pruebas inmutables por ruta y por huella (ADR-07). |
| VIII. Gasto acotado | ✅ | Libro de costos con comprobación previa, degradación y parada (ADR-06). |
| IX. Reanudable y auditable | ✅ | Punto de guardado tras cada nodo (ADR-04); eventos en `events.jsonl`. |
| X. Reusar antes que reescribir | ✅ | Opt-in en versión MENOR; reutiliza orquestador, proveedores, registro de eventos y contrato `Runner`. |
| XI. Honestidad documental | ✅ | Lo no verificado está marcado en la sección 11 y hay dos spikes en la Fase A. |
| XII. Español primero | ✅ | Artefactos, mensajes e identificadores de dominio en español. |

> Si hay ❌ o ⚠️: documentar en sección "Complejidad Justificada" o detener el plan.

## 3. Enfoque Técnico

El ciclo corre **por tarea, dentro de la etapa `code`**. `PipelineStateMachine` no cambia. En `_executeTask` (`core/orchestrator.js:100-174`), si el modo es `ciclo` y la tarea es de código (`_isCodeTask`, líneas 214-217), el bloque `agent.execute` + `_runTests` (líneas 139-169) se sustituye por `CicloVerificado.ejecutar(task)`. Se conservan el orden topológico, el interruptor de circuito por agente y los eventos de tarea. En modo ciclo las tareas de código se ejecutan en secuencia, porque el área de trabajo y el presupuesto son compartidos.

Los nodos y el router son **funciones puras** `(estado, deps) => actualización`. El grafo se declara una vez en `core/ciclo/grafo.js` y lo ejecutan dos motores intercambiables: LangGraph.js (opcional, perezoso, Node ≥20) y un motor propio sin dependencias. Así la lógica se prueba sin framework y la elección del motor es reversible (ADR-01).

Cada agente del motor headless es una llamada de completado que devuelve texto. El ciclo añade a cada nodo con modelo un contrato de salida (un bloque JSON de archivos) mediante `extraContext`, sin tocar `agents/*.md`, y un único módulo decide qué se puede escribir y dónde (ADR-07). El contenido de los archivos vive en disco; el estado guarda rutas y huellas, lo que mantiene pequeños los puntos de guardado.

El aislamiento son contenedores Docker lanzados con `spawn` y argv en array. La política es declarativa y se prueba comparando el argv, sin necesitar Docker. Las dependencias se resuelven en dos fases: una imagen preparada con red a partir de los manifiestos, y la ejecución del código generado sin red (ADR-02, ADR-03).

## 4. Decisiones Técnicas

| # | Decisión | Opción elegida | Alternativas descartadas | Razón |
|---|----------|---------------|--------------------------|-------|
| 1 | Motor de grafo | LangGraph.js opcional tras un puerto, con motor propio de reserva | Solo LangGraph subiendo a Node ≥20; solo motor propio; Python | `@langchain/core` exige Node ≥20 y el repo declara ≥18 (ADR-01) |
| 2 | Aislamiento | CLI de Docker con `spawn` y política declarativa | `dockerode`; seguir en el anfitrión | Cero dependencias; argv comprobable en tests (ADR-02) |
| 3 | Dependencias sin red | Imagen preparada por huella de manifiesto; ejecución sin red | Red abierta; proxy; copiar del anfitrión | Separa instalar lo declarado de ejecutar lo generado (ADR-03) |
| 4 | Puntos de guardado | Guardador propio en archivos, atómico | SQLite oficial (addon nativo); `node:sqlite`; memoria | Funciona en Node 18/20/22 (ADR-04) |
| 5 | Router | Categoría por código de salida; éxito antes que topes | Buscar cadena; revisor con modelo | Reproducible y comprobable (ADR-05) |
| 6 | Presupuesto | Libro de costos en el estado, comprobación previa | LiteLLM; solo aviso; tope por tokens | Sobrevive a la reanudación; acota el exceso (ADR-06) |
| 7 | Salida de agentes | Bloque JSON de archivos con escritura confinada | Herramientas del proveedor; bloques con cabecera; diffs | Igual para todos los proveedores (ADR-07) |
| 8 | Retriever | Puerto `Recuperador` con implementación por archivos | Nodo vacío; base vectorial ya | Útil hoy; S3 registra otra implementación (ADR-08) |
| 9 | Activación y versión | Opt-in en 4.3.0; por defecto en 5.0.0 | Por defecto ya; rama aparte | No afecta a quien no lo pide (ADR-09) |
| 10 | Artefactos SDD | `.sdd/` versionada de forma selectiva; `ADR-NN-slug.md` | Carpeta fuera de `.sdd/`; nombre por fecha | Los comandos tienen `.sdd/` fijo (ADR-10) |
| 11 | Revisión humana | Interrupción y `forge resume --decision` | Pregunta interactiva; endpoint HTTP | Funciona en CI (ADR-11) |

> Decisiones no triviales también se documentan como ADR en `.sdd/arquitectura/`.

## 5. Estructura de Carpetas Afectada

```
core/
├── ciclo/                          NUEVO
│   ├── index.js                    fachada CicloVerificado
│   ├── estado.js                   esquema EstadoCiclo, valores por defecto, validación
│   ├── router.js                   decidirRuta, guardiaPresupuesto, categoria
│   ├── presupuesto.js              libro de costos puro
│   ├── protocolo-archivos.js       parseo de la salida y escritura confinada
│   ├── grafo.js                    nodos y aristas, sin framework
│   ├── checkpoint-archivos.js      puntos de guardado atómicos
│   ├── respaldo.js                 respaldo y restauración de archivos
│   ├── nodos/
│   │   ├── planner.js   retriever.js   qa.js
│   │   └── coder.js     sandbox.js     revision-humana.js
│   ├── motores/
│   │   ├── langgraph.js            import() perezoso
│   │   └── propio.js
│   └── prompts/
│       └── contrato-planner.md  contrato-qa.md  contrato-coder.md
├── sandbox/                        NUEVO
│   ├── politica.js                 política → argv
│   ├── docker-cli.js               spawn con ejecutor inyectable
│   ├── staging.js                  copia desechable sin secretos
│   ├── preparar-imagen.js          imagen por huella de manifiesto
│   └── sandbox-runner.js           implementa el contrato Runner
├── recuperacion/                   NUEVO
│   ├── recuperador.js              puerto y fábrica
│   └── recuperador-archivos.js
├── orchestrator.js                 MODIFICADO
├── engine-cli.js                   MODIFICADO
├── event-log.js                    MODIFICADO
├── session-budget.js               MODIFICADO
└── llm-providers/                  MODIFICADO
tests/
├── ciclo-*.test.js                 NUEVO
├── sandbox-*.test.js               NUEVO
└── e2e/ciclo-flow.test.js          NUEVO
.sdd/motor/<runId>/                 generado en ejecución (ignorado por git)
├── checkpoints/   staging/   respaldo/
```

## 6. Archivos Afectados

| Acción | Ruta | Propósito | Agente responsable |
|--------|------|-----------|--------------------|
| CREAR | `core/ciclo/estado.js` | Esquema y validación de `EstadoCiclo` | desarrollador-backend |
| CREAR | `core/ciclo/router.js` | Decisión determinista (ADR-05) | desarrollador-backend |
| CREAR | `core/ciclo/presupuesto.js` | Libro de costos (ADR-06) | desarrollador-backend |
| CREAR | `core/ciclo/protocolo-archivos.js` | Parseo y escritura confinada (ADR-07) | desarrollador-backend |
| CREAR | `core/ciclo/grafo.js` | Declaración del grafo | desarrollador-backend |
| CREAR | `core/ciclo/checkpoint-archivos.js` | Puntos de guardado (ADR-04) | desarrollador-backend |
| CREAR | `core/ciclo/respaldo.js` | Respaldo y restauración (CA-005-04) | desarrollador-backend |
| CREAR | `core/ciclo/nodos/*.js` (6) | Un archivo por nodo | desarrollador-backend |
| CREAR | `core/ciclo/motores/langgraph.js` | Motor con LangGraph.js | desarrollador-backend |
| CREAR | `core/ciclo/motores/propio.js` | Motor de reserva | desarrollador-backend |
| CREAR | `core/ciclo/prompts/contrato-*.md` (3) | Contratos de salida por nodo | desarrollador-backend |
| CREAR | `core/ciclo/index.js` | Fachada `CicloVerificado` | desarrollador-backend |
| CREAR | `core/sandbox/politica.js` | Política → argv (ADR-02) | desarrollador-backend |
| CREAR | `core/sandbox/docker-cli.js` | Envoltorio de la CLI | desarrollador-backend |
| CREAR | `core/sandbox/staging.js` | Copia desechable sin secretos | desarrollador-backend |
| CREAR | `core/sandbox/preparar-imagen.js` | Imagen por huella (ADR-03) | desarrollador-backend |
| CREAR | `core/sandbox/sandbox-runner.js` | `Runner` aislado | desarrollador-backend |
| CREAR | `core/recuperacion/recuperador.js` | Puerto y fábrica (ADR-08) | desarrollador-backend |
| CREAR | `core/recuperacion/recuperador-archivos.js` | Contexto por archivos | desarrollador-backend |
| CREAR | `tests/ciclo-*.test.js`, `tests/sandbox-*.test.js`, `tests/e2e/ciclo-flow.test.js` | Suite del ciclo | tester |
| MODIFICAR | `core/orchestrator.js` | Delegar tareas de código al ciclo; secuencialidad en modo ciclo | desarrollador-backend |
| MODIFICAR | `core/engine-cli.js` | `--motor`, `--decision`, extras, comprobación de etapa, estado ampliado | desarrollador-backend |
| MODIFICAR | `core/event-log.js` | Tipos de evento nuevos; estado "en revisión" en `replayTaskStates` | desarrollador-backend |
| MODIFICAR | `core/session-budget.js` | Exportar la tabla de precios, por proveedor | desarrollador-backend |
| MODIFICAR | `core/llm-providers/*.js` | `usage` siempre presente; fallo explícito sin clave en modo ciclo | desarrollador-backend |
| MODIFICAR | `cli/index.js` | Texto de ayuda | desarrollador-backend |
| MODIFICAR | `configuracion-ejemplo/sdd.config.yaml` | Secciones `motor`, `sandbox`, `presupuesto` | desarrollador-backend |
| MODIFICAR | `package.json` | `optionalDependencies`; versión 4.3.0 | operaciones |
| MODIFICAR | `.github/workflows/ci.yml` | Job con Docker real | operaciones |
| MODIFICAR | `docs/runtime.md`, `docs/limitations.md`, `docs/roadmap.md`, `CHANGELOG.md` | Documentar el ciclo y sus límites | documentador |

No se elimina ningún archivo.

## 7. Modelo de Datos

### Entidades nuevas

```js
/**
 * @typedef {Object} EstadoCiclo
 * @property {"1.0"} schemaVersion
 * @property {string} runId
 * @property {string} threadId            // `${runId}:${taskId}`
 * @property {string} taskId
 * @property {string} cwd
 * @property {{id:string, descripcion:string, agente:string, archivos:string[], cas:string[], criterioCmd?:string}} tarea
 * @property {{pasos:string[], archivosObjetivo:string[]}|null} plan
 * @property {{fragmentos:{ruta:string, origen:string, bytes:number}[], bytesTotales:number, truncado:boolean}} contexto
 * @property {{archivos:{ruta:string, sha256:string}[], comando:string}} pruebas
 * @property {{archivos:{ruta:string, sha256:string}[]}} implementacion
 * @property {Ejecucion[]} ejecuciones    // reductor: añadir
 * @property {number} iteracion           // empieza en 0
 * @property {number} maxIteraciones      // por defecto 5
 * @property {Presupuesto} presupuesto
 * @property {{motivo:"iteraciones"|"presupuesto"|"infraestructura"|"dependencias", decision?:string, ts?:string}|null} revision
 * @property {"en_curso"|"exito"|"revision_pendiente"|"aceptada_por_humano"|"abortada"} resultado
 *
 * @typedef {Object} Ejecucion
 * @property {number} iteracion
 * @property {"pass"|"fail"|"timeout"|"infra_error"} categoria
 * @property {number|null} exitCode
 * @property {boolean} timedOut
 * @property {boolean} oomKilled
 * @property {number} durationMs
 * @property {string} stdoutCola          // ~8 KiB, con secretos redactados
 * @property {string} stderrCola
 *
 * @typedef {Object} Presupuesto
 * @property {number} tope_usd                 // por defecto 2.00
 * @property {number} umbral_degradacion_usd   // por defecto 1.50
 * @property {number} gastado_usd
 * @property {"ok"|"degradado"|"agotado"} estado
 * @property {number} llamadas
 * @property {number} tokens_in
 * @property {number} tokens_out
 */
```

Configuración nueva en `sdd.config.yaml`:

```yaml
motor:
  modo: clasico            # clasico | ciclo
  max_iteraciones: 5
  contexto_max_bytes: 65536
sandbox:
  cpus: 1
  memoria: 512m
  pids: 256
  timeout_s: 120
  salida_max_bytes: 1048576
  imagenes: {}             # por stack, fijadas por digest
presupuesto:
  tope_usd: 2.00
  umbral_degradacion_usd: 1.50
  degradar_a: escalon      # escalon | local
  precio_desconocido: { in_usd_mtok: 15, out_usd_mtok: 75 }
```

### Cambios en entidades existentes

- `events.jsonl`: tipos nuevos (sección 8). Los existentes no cambian.
- `replayTaskStates` (`core/event-log.js:83-103`): un caso más, `en_revision`.
- Tabla de precios de `core/session-budget.js:7-11`: pasa a indexarse por proveedor y modelo. Sin migración: no se persiste.

### Queries críticas

No aplica: no hay base de datos. Las lecturas críticas son la del último punto de guardado válido de un hilo (por orden de nombre de archivo) y el barrido de contenedores por la etiqueta `forge.sandbox=1`.

## 8. Contratos de API

### Endpoints / Operaciones nuevas

No hay endpoints HTTP (fuera de alcance, S4). El contrato es de CLI:

```yaml
forge run:
  flags_nuevos:
    --motor: clasico | ciclo        # override de motor.modo
    --force: "true"                 # permite ejecutar fuera de la etapa code
  codigos_de_salida:                # propuestos; se fijan en la Fase E
    0: todas las tareas completadas
    1: fallo
    3: revisión humana pendiente
    4: aislamiento no disponible

forge resume:
  flags_nuevos:
    --decision: continuar | aceptar | abortar
    --iteraciones-extra: N
    --presupuesto-extra: USD
  comportamiento:
    sin_decision_y_revision_pendiente: muestra el motivo, sale con 3, no gasta
    con_punto_de_guardado: reanuda el hilo runId:taskId
    sin_punto_de_guardado: relanza la tarea (comportamiento actual)

forge status:
  campos_nuevos: [iteracion, gastado_usd, estado_presupuesto, revision_pendiente]
```

Contrato de salida de los nodos con modelo:

```json
{ "archivos": [ { "ruta": "relativa/al/proyecto.ext", "contenido": "..." } ] }
```

El `planner` devuelve `{ "pasos": [...], "archivosObjetivo": [...] }`.

Contrato de nodo: `(estado: EstadoCiclo, deps) => Promise<Partial<EstadoCiclo>>`.

| Nodo | Modelo | Lee | Escribe |
|---|---|---|---|
| `planner` | sí (`arquitecto`) | `tarea` | `plan`, `presupuesto` |
| `retriever` | no | `tarea`, `plan` | `contexto` |
| `qa` | sí (`tester`) | `tarea`, `plan`, `contexto` | `pruebas`, `presupuesto` |
| `coder` | sí (`tarea.agente`) | lo anterior y la última ejecución | `implementacion`, `presupuesto` |
| `sandbox` | no | `pruebas`, `implementacion` | `ejecuciones`, `iteracion + 1` |
| `revision_humana` | no | todo | `revision`, `resultado` |

### Cambios en endpoints existentes

Ninguno incompatible. `forge run` y `forge resume` sin flags nuevos y con `motor.modo: clasico` se comportan como hoy.

### Eventos / Mensajes (si aplica)

Tipos nuevos en `events.jsonl`, emitidos con `EventLog.append`:

| Evento | Cuándo | Datos |
|---|---|---|
| `ciclo:nodo_completado` | Tras cada nodo | `taskId`, `nodo`, `iteracion`, `durationMs` |
| `ciclo:ejecucion` | Tras cada ejecución aislada | `categoria`, `exitCode`, `timedOut`, `durationMs` |
| `ciclo:escritura_rechazada` | Ruta vetada o prueba tocada por el implementador | `nodo`, `ruta`, `motivo` |
| `ciclo:presupuesto_degradado` | Al cruzar el umbral | `gastado_usd`, `modelo_anterior`, `modelo_nuevo` |
| `task_paused` | Al entrar en revisión | `taskId`, `motivo` |
| `ciclo:revision_decidida` | Al recibir la decisión | `decision`, `extras` |

Idempotencia: los eventos son informativos. La fuente de verdad para reanudar es el punto de guardado, no el registro.

## 9. Estrategia de Tests

### Tests unitarios
- **Router**: tabla de verdad completa de categoría × presupuesto × iteración, incluido el pase en la iteración 5 (CA-001-03), cero pruebas (CA-001-05) y `infra_error` sin contar iteración (CA-005-05).
- **Presupuesto**: transiciones `ok → degradado → agotado`, comprobación previa, precios por proveedor, modelo desconocido, respuesta sin `usage`.
- **Protocolo de archivos**: traversal, rutas absolutas, prefijo engañoso (`/proy-malo` frente a `/proy`), rutas vetadas, pruebas inmutables, cambio de manifiesto.
- **Política de aislamiento**: argv exacto (red, usuario, capacidades, límites, solo lectura, etiquetas).
- **Puntos de guardado**: escritura atómica, archivo dañado, bloqueo por hilo.
- **Nodos**: cada uno con un proveedor guionizado.
- Mocks: un `LlmProvider` de test con respuestas y `usage` programables (el stub actual devuelve 0 tokens y no sirve para presupuesto) y un ejecutor de Docker falso inyectado en `docker-cli.js`. Sin simular el sistema de archivos: directorios temporales.

### Tests de integración
- **Aislamiento sin Docker**: el ejecutor falso guioniza códigos 0, 1, 124, 137, 125 y "daemon caído"; se verifica la secuencia `kill` y `rm` en el tiempo agotado.
- **Aislamiento con Docker**: `{ skip: !dockerDisponible }` y `FORGE_TEST_DOCKER=1`. Comprueba red bloqueada, raíz de solo lectura, UID distinto de 0, límite de memoria, límite de procesos y cero contenedores residuales por etiqueta. Corre en un job aparte en `ubuntu-latest`.
- **Reanudación**: matar el proceso entre nodos con `spawnSync` (patrón de `tests/cli-run.test.js`), reanudar y contar las llamadas al proveedor.
- **Los dos motores**: la misma suite de comportamiento contra `propio` y `langgraph`; este último se salta en Node <20.

### Tests E2E (si aplica)
- `tests/e2e/ciclo-flow.test.js`: escenarios 1 a 5 y 9 de la spec con proveedor guionizado y Docker falso.

### Tests de regresión
- `tests/orchestrator-runner.test.js`, `tests/cli-run.test.js` y `tests/e2e/pipeline-flow.test.js` deben seguir en verde con `motor.modo: clasico`.

## 10. Dependencias Nuevas

| Paquete | Versión | Justificación | Alternativas |
|---------|---------|--------------|-------------|
| `@langchain/langgraph` (opcional) | 1.4.x, por fijar en T001 | Ciclos, interrupciones y reanudación del grafo | Motor propio (incluido como reserva) |
| `@langchain/core` (opcional, peer) | La que exija la anterior | Dependencia obligatoria de LangGraph.js; exige Node ≥20 | — |

Van en `optionalDependencies` y se cargan con `import()` perezoso. El aislamiento, los puntos de guardado y el recuperador no añaden dependencias. Docker es un requisito del equipo del operador, no un paquete.

## 11. Riesgos Técnicos

| # | Riesgo | Probabilidad | Impacto | Mitigación |
|---|--------|--------------|---------|-----------|
| R1 | LangGraph.js exige Node ≥20 y rompe la matriz de CI | A | A | Opcional y perezoso, motor propio, ADR-01, spike T001 |
| R2 | El guardador propio no cumple el contrato interno de LangGraph.js (sin verificar) | M | A | Spike T001; si falla, el motor propio pasa a principal con el mismo formato en disco |
| R3 | Falso pase: cero pruebas, pruebas triviales o alteradas | M | A | Huellas, pruebas no vacías, inmutabilidad; "rojo inicial" opcional (CA-002-04) |
| R4 | Montajes y mapeo de usuario en Docker Desktop para Windows (sin verificar) | A | M | Spike T002; alternativa `docker cp`; el job de Linux es la referencia |
| R5 | La fase de preparación con red ejecuta scripts de instalación maliciosos | M | A | Solo manifiestos, scripts desactivados, revisión humana ante cambios de dependencias |
| R6 | Contenedores huérfanos tras un fallo | M | M | Etiqueta y barrido al iniciar y al reanudar; test de limpieza |
| R7 | Proveedor en modo relleno consume iteraciones (`anthropic-provider.js:37-40`) | A | M | Fallo explícito sin `usage` o sin clave, salvo stub declarado |
| R8 | Precios desactualizados o modelos desconocidos | M | M | Tabla configurable; precio conservador por defecto |
| R9 | Fuga de secretos a la copia, los registros o los puntos de guardado | B | A | Lista de exclusión; redacción con `SECRET_PATTERNS` (`claude-hooks/pre-tool-guard.js:117`) |
| R10 | Escritura fuera del proyecto por la salida de un modelo | M | A | Confinamiento con `path.relative`, rutas vetadas, tests de traversal |
| R11 | Los prompts de agentes asumen herramientas de Claude Code | A | M | Contrato de salida por nodo, validación, un reintento |
| R12 | Motor y comandos usan claves y rutas distintas; el ciclo no puede consumir tareas de `/sdd.tareas` | A | A | Spec S0 como prerrequisito; aceptado como dependencia externa de este plan |
| R13 | Crecimiento de dependencias transitivas | A | M | Opcionales; medir el tamaño de instalación en CI |
| R14 | Versionar `.sdd/` filtra estado local | B | M | Excepciones selectivas en `.gitignore`. Comprobado el 2026-10-03: crear `.sdd/` no rompe ningún test |
| R15 | La suite tiene 39 fallos previos en Windows (rutas `/tmp` fijas y `dist/` en `files[]`), así que "sin regresiones" no se puede comprobar ahí | A | M | Arreglarlos en S0; hasta entonces, comparar contra la línea base de 975 de 1014 |

## 12. Plan de Implementación en Fases

Las tareas definitivas se generan con `/sdd.tareas` después de aprobar este plan. Lo que sigue es la previsión.

### Fase A: Fundamentos
T001 spike de guardador e interrupción con LangGraph.js en Node 20 · T002 spike de montaje en Windows y Linux · T003 `estado.js` · T004 secciones de configuración y su lector · T005 tipos de evento nuevos · T006 `optionalDependencies` · T007 arreglo de `parseArgs` para flags. Agentes: `arquitecto`, `desarrollador-backend`.

**Puerta:** los dos spikes tienen conclusión escrita y, si cambian una decisión, el ADR correspondiente se actualiza antes de seguir.

### Fase B: Tests primero (si TDD)
T008 router · T009 presupuesto · T010 protocolo y confinamiento · T011 argv de la política · T012 puntos de guardado · T013 nodos con proveedor guionizado. Todos en rojo. Agente: `tester`. Depende de A.

### Fase C: Capa de datos
T014 `checkpoint-archivos.js` · T015 `staging.js` con exclusión de secretos · T016 `respaldo.js` · T017 tabla de precios por proveedor. Agente: `desarrollador-backend`. Depende de B.

### Fase D: Lógica de negocio
T018 `router.js` · T019 `presupuesto.js` · T020 `protocolo-archivos.js` · T021 `politica.js` y `docker-cli.js` · T022 `preparar-imagen.js` · T023 `sandbox-runner.js` · T024 los seis nodos · T025 `recuperador-archivos.js` · T026 `grafo.js` y motor propio · T027 motor LangGraph. Agente: `desarrollador-backend`; `seguridad` revisa T020 a T023. Depende de C.

### Fase E: Interfaz / API
T028 flags y `--decision` en `engine-cli.js` · T029 `forge status` ampliado · T030 ayuda en `cli/index.js` · T031 códigos de salida. Agente: `desarrollador-backend`. Depende de D.

### Fase F: UI (si aplica)
No aplica. El panel ya lee `events.jsonl`; la comprobación de que muestra los eventos nuevos va en la Fase G.

### Fase G: Integración
T032 delegación en `orchestrator.js` y secuencialidad · T033 E2E con proveedor guionizado y Docker falso · T034 job de CI con Docker real · T035 matriz Node 18/20/22 con saltos condicionales. Agentes: `desarrollador-backend`, `tester`, `operaciones`. Depende de E.

### Fase H: Verificación
T036 verificación criterio por criterio (39 CAs) · T037 documentación y `CHANGELOG.md` · T038 revisión de `seguridad` y `revisor`. Agentes: `revisor`, `documentador`, `seguridad`. Depende de G.

## 13. Cambios Breaking

Ninguno con `motor.modo: clasico` (valor por defecto).

Cambio de comportamiento a vigilar: los proveedores pasan a fallar de forma explícita cuando no hay clave o falta `usage`. Se limita al modo ciclo para no alterar el modo clásico, donde el texto de relleno se trata hoy como éxito.

## 14. Métricas y Observabilidad

- **Registro**: los seis tipos de evento de la sección 8 en `.sdd/events.jsonl`, visibles en el panel por SSE sin cambios en `ui/`.
- **Métricas por tarea**: iteraciones usadas, gasto, duración por nodo, categoría de cada ejecución, motivo de revisión.
- **Métricas por sesión**: gasto total, número de degradaciones, tareas terminadas por éxito frente a decisión humana.
- **Avisos al operador**: degradación de modelo, uso del motor propio por versión de Node, contenedores huérfanos barridos.
- **Redacción**: las colas de salida pasan por `SECRET_PATTERNS` antes de escribirse en eventos o puntos de guardado.

## 15. Complejidad Justificada

| Desviación | Principio | Justificación |
|---|---|---|
| Este plan y los ADR se redactaron con la spec en `borrador`, sin `spec_aprobado` | I, II | El dueño pidió en una sola sesión el plan, las specs y el resto de artefactos. Se entregan sin aprobar y marcados como tales. No se generan tareas ni análisis hasta que apruebe spec y plan (`commands/sdd.tareas.md:33-38`). |
| Se añaden dependencias opcionales cuyo requisito de runtime (Node ≥20) supera el mínimo del producto | IV | Son opcionales, de carga perezosa, y existe un motor propio que funciona en Node 18. La decisión es reversible (ADR-01). |
| Dos motores para un mismo grafo | X (simplicidad) | Es el costo de no subir `engines` en una versión MENOR. Se revisa tras el spike T001 y al retirar Node 18. |
| El plan depende de una spec no escrita (S0) | I | Los defectos de S0 son previos e independientes de este diseño. Se registran como dependencia y riesgo R12, no se resuelven aquí. |

## Cambios durante la implementación

Lo que el plan no preveía y se añadió, casi todo tras las revisiones independientes: `core/ciclo/candado.js`, `diario.js` (diario de respuestas y libro de gasto), `contratos.js`, `redactar.js`, `nodos.js` y `grafo.js` en lugar de una carpeta `nodos/`, `core/ciclo/motores/index.js` y `core/glob.js`. Ver el apartado de ajustes de ADR-02, ADR-04 y ADR-07.

## 16. Estimación

- Complejidad global: Alta
- Tareas estimadas: 38
- Sin estimación de tiempo: depende del resultado de los dos spikes de la Fase A.

## 17. Aportes por Agente

Este plan lo redactó un único asistente en una sesión, no los agentes de FORGE por separado. Las subsecciones recogen el análisis desde cada rol; conviene pasar `/sdd.planificar` con los agentes reales antes de aprobar.

### Arquitecto
Nodos y router como funciones puras, grafo declarado una vez y motor intercambiable. El ciclo se engancha en un único punto del orquestador y no toca la máquina de estados. Todo lo nuevo vive en tres carpetas.

### Diseñador de API
Sin API HTTP en esta spec. El contrato es de CLI, con códigos de salida propios para que CI distinga "revisión pendiente" y "aislamiento no disponible" de un fallo. La decisión humana usa el mismo mecanismo que S4 expondrá por red.

### Asesor de datos
Sin base de datos. Los puntos de guardado son archivos con escritura atómica; el estado guarda rutas y huellas, no contenidos. El registro de eventos es informativo y no se usa para reanudar.

### Crítico
Los tres mayores riesgos son R12 (sin S0 el ciclo no se puede usar con el flujo real), R1/R2 (la elección de LangGraph.js descansa en un spike) y R3 (un ciclo que solo comprueba el código de salida puede aprobar pruebas triviales). El plan no mide la calidad de las pruebas que escribe `qa`.

### Seguridad
El contenedor reduce el riesgo; no lo elimina, y la documentación comercial debe decirlo. Puntos a revisar en la implementación: la fase de preparación con red (R5), el confinamiento de escrituras (R10), la exclusión de secretos de la copia (R9) y que no exista ningún camino de código que caiga al anfitrión cuando Docker falla.
