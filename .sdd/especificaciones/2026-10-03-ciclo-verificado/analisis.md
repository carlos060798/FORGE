---
spec_id: 2026-10-03-ciclo-verificado
fecha_analisis: 2026-10-03
veredicto: OBSERVACIONES  # APROBADO | OBSERVACIONES | BLOQUEADO
---

# Análisis de Consistencia: 2026-10-03-ciclo-verificado

## Veredicto: **OBSERVACIONES**

Spec, plan y tareas son coherentes entre sí: los 39 criterios tienen tarea, las dependencias no forman ciclos y cada riesgo tiene mitigación. No hay bloqueantes, pero cinco observaciones condicionan el arranque de la implementación.

## Hallazgos

### 🔴 Bloqueantes

Ninguno.

### 🟡 Observaciones

#### O1 — Docker no está en marcha en este equipo
- **Dimensión:** Tareas
- **Descripción:** el daemon de Docker no respondía el 2026-10-03 (`failed to connect to the docker API`). T002 y T034 no se pueden ejecutar hasta arrancar Docker Desktop.
- **Ubicación:** tareas.md: T002, T034
- **Impacto si se ignora:** el aislamiento quedaría probado solo con un ejecutor falso.
- **Acción sugerida:** arrancar Docker Desktop antes de T002. T021 a T023 pueden avanzar con el ejecutor falso, pero no cerrarse sin T034.

#### O2 — Aprobaciones por delegación
- **Dimensión:** Constitución (Principio II)
- **Descripción:** la spec y el plan se aprobaron por delegación expresa del dueño ("aprobación automática"), y las seis preguntas abiertas se resolvieron con el valor recomendado, sin respuesta individual.
- **Ubicación:** spec.md §14, filas 5 a 12
- **Impacto si se ignora:** una decisión por defecto que el dueño no comparta (por ejemplo, presupuesto por sesión) se descubriría tarde.
- **Acción sugerida:** revisar esas filas; cualquiera se cambia con `/sdd.aclarar` antes de llegar a la Fase D.

#### O3 — Dos decisiones dependen de spikes sin hacer
- **Dimensión:** Plan
- **Descripción:** ADR-01 y ADR-04 (LangGraph.js y guardador propio) descansan en T001; ADR-02 (montajes en Windows), en T002.
- **Ubicación:** plan.md §11, R1, R2 y R4
- **Impacto si se ignora:** T014, T026 y T027 se construirían sobre un contrato sin comprobar.
- **Acción sugerida:** T001 y T002 primero. Si T001 falla, T006 y T027 se omiten y el motor propio es el único.

#### O4 — La etapa del proyecto sigue con dos vocabularios
- **Dimensión:** Dependencias (spec S0, CA-002-04)
- **Descripción:** T028 exige la etapa `code` leyendo `pipeline_step`, pero los comandos de la metodología escriben `fase_actual`.
- **Ubicación:** tareas.md: T028; `2026-10-03-saneamiento/spec.md` §11
- **Impacto si se ignora:** en un proyecto llevado solo con los comandos, `forge run --motor ciclo` pediría `--force true` siempre.
- **Acción sugerida:** decidir el vocabulario en S0 antes de T028, o aceptar `--force` como paso documentado en 4.3.0.

#### O5 — El ciclo no mide la calidad de las pruebas
- **Dimensión:** Riesgos (R3)
- **Descripción:** el router aprueba por código de salida. Unas pruebas triviales que pasan siempre darían un éxito legítimo según la spec. CA-002-04 ("rojo inicial") es P3 y se implementa como aviso.
- **Ubicación:** plan.md §17 (Crítico); tareas.md: T024
- **Impacto si se ignora:** tareas "completadas" con pruebas que no prueban nada.
- **Acción sugerida:** valorar subir CA-002-04 a P1 y hacerlo bloqueante tras las primeras ejecuciones reales.

### 🟢 Buenas señales

- Cobertura completa: 39 de 39 criterios con al menos una tarea, comprobado por script contra `spec.md`.
- Pruebas antes que código: toda tarea de lógica (Fase D) depende de su tarea de pruebas (Fase B).
- El motor ya lee estas tareas: `core/tareas.js` (S0) carga `.estado-tareas.json` y toma el enunciado de `tareas.md`.
- Las cuatro tareas de aislamiento (T020 a T023) llevan revisión de `seguridad`.
- La línea base está en verde (1029 de 1029), así que "sin regresiones" es comprobable.

## Matriz de Cobertura: CAs → Tareas

| CA | Descripción | Tareas | Estado |
|----|-------------|--------|--------|
| CA-001-01 | Si la ejecución de las pruebas termina con éxito, la tarea se marca como completada y no se realizan más iteraciones. | T008, T018 | ✅ |
| CA-001-02 | Si la ejecución falla y quedan iteraciones y presupuesto, el implementador recibe el resultado de esa ejecución y produce una nueva versión. | T024, T026, T033 | ✅ |
| CA-001-03 | Un éxito en la última iteración permitida se trata como éxito, no como revisión. | T008, T018 | ✅ |
| CA-001-04 | La decisión entre éxito, reintento y parada depende solo del código de resultado de la ejecución y del estado de control, nunca del texto de la salida. | T008, T018 | ✅ |
| CA-001-05 | Una ejecución en la que no hay ninguna prueba presente no cuenta como éxito. | T008, T018 | ✅ |
| CA-002-01 | Las pruebas de una tarea existen antes de que se produzca la primera versión de la implementación. | T013, T024 | ✅ |
| CA-002-02 | Un intento del implementador de modificar o borrar una prueba se rechaza y queda registrado. | T010, T020 | ✅ |
| CA-002-03 | Si las pruebas cambiaron respecto a la huella tomada al escribirlas, la ejecución no se realiza. | T024 | ✅ |
| CA-002-04 | Las pruebas recién escritas fallan cuando todavía no hay implementación. | T024 | ✅ |
| CA-003-01 | El código en ejecución no puede abrir conexiones de red. | T011, T021, T034 | ✅ |
| CA-003-02 | El código en ejecución no puede escribir fuera de su área de trabajo ni alterar el proyecto real. | T015, T023, T034 | ✅ |
| CA-003-03 | El código en ejecución corre sin privilegios de administrador. | T011, T021, T034 | ✅ |
| CA-003-04 | Al superar el tiempo máximo, la ejecución se detiene y se clasifica como tiempo agotado. | T021, T023, T034 | ✅ |
| CA-003-05 | Al superar el límite de memoria o de número de procesos, la ejecución se detiene sin afectar al equipo anfitrión. | T011, T021, T034 | ✅ |
| CA-003-06 | Tras cada ejecución no queda ningún entorno residual. | T021, T023, T034 | ✅ |
| CA-003-07 | Si el aislamiento no está disponible, se informa al operador y no se ejecuta nada en el equipo anfitrión. | T021, T023, T031 | ✅ |
| CA-003-08 | Los secretos del proyecto no entran en el área de trabajo aislada. | T015, T038 | ✅ |
| CA-003-09 | Las dependencias declaradas por el proyecto están disponibles durante la ejecución, pese a no haber red. | T022 | ✅ |
| CA-004-01 | Al alcanzar el umbral de degradación, las llamadas siguientes usan un modelo más barato y el cambio queda registrado. | T009, T019 | ✅ |
| CA-004-02 | Alcanzado el tope de gasto, no se inicia ninguna llamada más y la tarea pasa a revisión humana. | T009, T019 | ✅ |
| CA-004-03 | El gasto acumulado se conserva tras reanudar una sesión. | T019 | ✅ |
| CA-004-04 | El gasto acumulado se puede consultar en cualquier momento. | T017, T029 | ✅ |
| CA-004-05 | Una respuesta de un proveedor real que no informa de su consumo se trata como error, no como gasto cero. | T009, T019 | ✅ |
| CA-005-01 | Tras 5 ejecuciones fallidas, el sistema se pausa y pide revisión indicando el motivo. | T008, T018, T031 | ✅ |
| CA-005-02 | En la revisión, la persona puede continuar con una ampliación de iteraciones o de presupuesto, aceptar el resultado tal como está, o abortar. | T024, T028 | ✅ |
| CA-005-03 | Mientras no haya una decisión explícita, no se consume presupuesto. | T026, T027, T028 | ✅ |
| CA-005-04 | Abortar restaura los archivos del proyecto al estado previo a la tarea. | T016, T033 | ✅ |
| CA-005-05 | Un fallo del entorno aislado no consume iteraciones y lleva a revisión con ese motivo. | T008, T018 | ✅ |
| CA-006-01 | Tras una interrupción, reanudar continúa desde el último paso completado sin repetir las llamadas a modelos ya realizadas. | T014, T026, T027, T033 | ✅ |
| CA-006-02 | Un punto de guardado dañado se detecta y se informa, sin perder el anterior válido. | T012, T014 | ✅ |
| CA-006-03 | Dos reanudaciones simultáneas de la misma tarea no producen estados divergentes. | T012, T014 | ✅ |
| CA-007-01 | El contexto entregado a un agente nunca supera el tamaño máximo configurado, e indica si se truncó. | T013, T025 | ✅ |
| CA-007-02 | La fuente de contexto se puede sustituir por otra sin modificar el resto del ciclo. | T025 | ✅ |
| CA-007-03 | El ciclo funciona sin ningún índice preparado de antemano. | T025 | ✅ |
| CA-008-01 | Con el ciclo sin activar, el modo clásico se comporta exactamente como antes. | T004, T032, T035 | ✅ |
| CA-008-02 | El ciclo solo se ejecuta cuando el proyecto está en la etapa de construcción. | T028, T032 | ✅ |
| CA-008-03 | Cada paso del ciclo queda en el registro de eventos y es visible en el panel. | T005, T033 | ✅ |
| CA-008-04 | Dos tareas de construcción no se ejecutan a la vez sobre la misma área de trabajo. | T032 | ✅ |
| CA-008-05 | Un cambio de dependencias propuesto por el implementador no se aplica sin revisión humana. | T010, T020 | ✅ |

## Matriz de Cobertura: Riesgos → Mitigaciones

| Riesgo | Prob × Imp | Mitigación | Estado |
|--------|-----------|-----------|--------|
| R1 LangGraph.js exige Node ≥20 | A × A | T001, T006, T027, T035 | ✅ |
| R2 Contrato del guardador sin verificar | M × A | T001, T014 | ✅ |
| R3 Falso pase | M × A | T008, T018, T024 | ⚠️ parcial (O5) |
| R4 Montajes en Windows | A × M | T002 | ✅ |
| R5 Scripts de instalación maliciosos | M × A | T020, T022, T038 | ✅ |
| R6 Contenedores huérfanos | M × M | T021, T034 | ✅ |
| R7 Proveedor en modo relleno | A × M | T019 | ✅ |
| R8 Precios desactualizados | M × M | T017 | ✅ |
| R9 Fuga de secretos | B × A | T015, T038 | ✅ |
| R10 Escritura fuera del proyecto | M × A | T010, T020 | ✅ |
| R11 Prompts que asumen herramientas | A × M | T013, T024 | ✅ |
| R12 Claves y rutas distintas entre motor y comandos | A × A | Spec S0 (hecho salvo la etapa, O4) | ⚠️ parcial |
| R13 Dependencias transitivas | A × M | T006 | ✅ |
| R14 `.sdd/` versionada | B × M | Hecho: `.gitignore` selectivo, suite en verde | ✅ |
| R15 Fallos previos de la suite en Windows | A × M | Hecho en S0: 1029 de 1029 | ✅ |

## Cumplimiento de Constitución

| Principio | Plan | Tareas | Notas |
|-----------|------|--------|-------|
| I. La especificación manda | ⚠️ | ✅ | El plan se redactó antes de aprobar la spec (plan §15) |
| II. La aprobación es humana | ⚠️ | ✅ | Aprobación por delegación (O2) |
| III. Local primero | ✅ | ✅ | T019 permite degradar a un proveedor local |
| IV. Dependencias mínimas | ⚠️ | ✅ | Solo dependencias opcionales (T006) |
| V. Código generado fuera del anfitrión | ✅ | ✅ | T021 a T023, T034 |
| VI. Decisiones deterministas | ✅ | ✅ | T008, T018 |
| VII. Pruebas antes y por otro rol | ✅ | ✅ | T020, T024; y la propia Fase B precede a C y D |
| VIII. Gasto acotado | ✅ | ✅ | T009, T017, T019 |
| IX. Reanudable y auditable | ✅ | ✅ | T005, T014, T026 |
| X. Reusar antes que reescribir | ✅ | ✅ | T032 toca un solo punto del orquestador |
| XI. Honestidad documental | ✅ | ✅ | T001, T002, T037 |
| XII. Español primero | ✅ | ✅ | — |

## Distribución de Agentes

| Agente | Tareas | % |
|--------|--------|---|
| desarrollador-backend | 23 | 61 % |
| tester | 7 | 18 % |
| operaciones | 3 | 8 % |
| arquitecto | 2 | 5 % |
| revisor | 1 | 3 % |
| documentador | 1 | 3 % |
| seguridad | 1 | 3 % |

`desarrollador-backend` concentra el 61 %. Es esperable: la spec es de motor, sin interfaz ni base de datos. `seguridad` y `operaciones` están inactivos en la configuración de ejemplo y hay que activarlos.

## Recomendaciones

1. Arrancar Docker Desktop y ejecutar T001 y T002 antes que nada.
2. Revisar las decisiones por defecto de spec.md §14 (O2).
3. Resolver el vocabulario de la etapa en S0 antes de T028 (O4).
4. Pasar `/sdd.analizar` con el agente `critico` real: este análisis lo hizo el mismo asistente que redactó el plan.

## Siguiente comando sugerido
`/sdd.implementar` (empezando por T001 y T002)
