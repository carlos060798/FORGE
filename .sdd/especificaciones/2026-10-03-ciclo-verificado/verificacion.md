---
spec_id: 2026-10-03-ciclo-verificado
fecha_verificacion: 2026-10-03
veredicto: APROBADA_CON_OBSERVACIONES  # tercera verificación INDEPENDIENTE (sin bloqueantes); las observaciones de esa pasada están corregidas salvo las listadas como abiertas, y esas correcciones NO han pasado una cuarta revisión independiente
---

# Verificación: 2026-10-03-ciclo-verificado

## Veredicto: **APROBADA_CON_OBSERVACIONES** por la tercera verificación independiente

Este documento ha tenido cuatro versiones, y conviene que se vean:

1. **Primera versión, escrita por quien implementó: APROBADA_CON_OBSERVACIONES.** Sobrevendía. Daba por buenos criterios cuyos tests cubrían menos que su enunciado, afirmaba cosas que el código no respaldaba (reanudar sin repetir llamadas, un único proceso por tarea, tope por sesión) y declaraba tareas hechas con archivos que no existían.
2. **Verificación independiente (agente `revisor`, siguiendo `commands/sdd.verificar.md`): RECHAZADA.** 28 de 39 criterios demostrados, 10 parciales y 1 no demostrado; 3 fallos reproducidos en criterios P1 (CA-008-01, CA-006-01, CA-004-02/03). Reprodujo cada uno con scripts propios.
3. **Autoevaluación tras corregir** esos hallazgos: 34 criterios ✅, 5 ⚠️ y 0 ❌. Sobrevendía otra vez.
4. **Tercera verificación independiente (agente `revisor`): APROBADA_CON_OBSERVACIONES.** Sin bloqueantes. De los 17 hallazgos, 12 cerrados, 4 parciales y 1 cerrado con residuo; reconoció que mi autoevaluación era más optimista que el código en tres puntos y que la documentación afirmaba tres cosas falsas. Encontró 8 hallazgos nuevos (N1–N8) y 7 afirmaciones documentales incorrectas (D1–D7). **Esta versión recoge su resultado y las correcciones que hice después**, que no han pasado una cuarta revisión independiente.

### Correcciones tras la tercera verificación

| # | Hallazgo (reproducido por el verificador) | Estado | Prueba |
|---|---|---|---|
| N1 | Un corte tras una respuesta que cruza el umbral de degradación repetía la llamada pagada (la clave del diario incluía el modelo) | **Corregido**: la clave ya no incluye el modelo | `ciclo-tercera-pasada` (N1) |
| N2 | La respuesta que agotaba el tope se descartaba tras el corte | **Corregido**: se consulta el diario antes de comprobar el tope | `ciclo-tercera-pasada` (N2) |
| N3 | Un corte justo antes de guardar el nodo `coder` repite la llamada pagada (el prompt incluye archivos que acaba de reescribir) | **Abierto**, ventana de milisegundos; documentado | — |
| N4 / B2 | Con 3 procesos sobre un candado huérfano, dos dueños a la vez | **Corregido**: reclamación aparte antes de retirar el huérfano. 12 rondas × 3 procesos sin doble dueño | `ciclo-tercera-pasada` (NUEVO-8) |
| N5 | Abortar con éxito terminaba con código 1 y «1 tareas aún fallidas» | **Corregido**: `abortada` no es un fallo; sale con 0 | `e2e/ciclo-flow` |
| N6 | Una copia de trabajo que no se borra bloqueaba la primera ejecución de cada `resume` | **Corregido**: nombre único por proceso, barrido de copias anteriores al arrancar y aviso de las que no se pueden borrar | `ciclo-tercera-pasada` (NUEVO-5, débil: no ejecuta Windows con bloqueo real) |
| N7 | El test del candado huérfano era inestable bajo carga | **Corregido**: el ganador retiene 2,5 s | `ciclo-hallazgos` |
| N8 | `--decision` sin tarea en revisión se ignoraba; `--tarea` sin valor valía para todas (incluida abortar) | **Corregido**: se rechazan | `ciclo-tercera-pasada` |
| D1–D7 | Afirmaciones falsas en `PLAN-MOTOR-AGENTICO.md`, `docs/ciclo-verificado.md`, `CHANGELOG.md` | **Corregidas** (ver esos archivos) | — |
| — | CA-001-05, CA-006-01, CA-006-02, CA-006-03: el verificador los bajó a ⚠️ | **Aceptado** salvo CA-006-03 (corregido, ✅): ver la tabla de criterios. Total actual: 31 ✅, 8 ⚠️, 0 ❌ | — |
| — | `hayPruebas` cuenta archivos escritos: un archivo trivial con salida 0 cuenta como éxito | **Mitigado**: el éxito exige evidencia de pruebas pasadas en la salida y se vigilan las salidas forzadas al cargar (`core/ciclo/sospecha.js`); los tests triviales que imprimen un resumen siguen pasando | `ciclo-tercera-pasada` (éxito sospechoso) |

## Estado de los hallazgos de la verificación independiente

| # | Hallazgo (reproducido por el verificador) | Estado | Dónde se prueba |
|---|---|---|---|
| 1 | Un `sesion.json` antiguo convertía en ciclo cualquier `forge resume` clásico | **Corregido**: el ciclo se usa solo si la tarea tiene puntos de guardado | `ciclo-hallazgos` (CLI) |
| 2 | Un corte dentro de un nodo repetía la llamada pagada y no la contabilizaba; dejaba pruebas huérfanas | **Corregido**: diario de respuestas | `ciclo-hallazgos` (hallazgo 2) |
| 3 | El gasto de sesión perdía lo gastado por tareas cortadas | **Corregido**: libro de gasto por llamada | `ciclo-hallazgos` (hallazgos 3 y 10) |
| 4 | El barrido de huérfanos mataba el contenedor de otra sesión del mismo proyecto | **Corregido**: candado de proyecto antes del barrido | `e2e/ciclo-flow` (CA-008-04, con Docker) |
| 5 | Carrera al retirar un candado huérfano (27 de 150) | **Corregido con 2 procesos** (enlace duro + `rename`); la tercera verificación encontró dos dueños con 3 procesos → **corregido** con una reclamación aparte | `ciclo-hallazgos` (2 procesos), `ciclo-tercera-pasada` (3 procesos) |
| 6 | Iteración 6 de 5 al ampliar solo el presupuesto | **Corregido** | `ciclo-hallazgos` (hallazgo 6) |
| 7 | Una decisión dada a una tarea no pausada se guardaba para después | **Corregido**: se rechaza | `ciclo-hallazgos` (hallazgo 7) |
| 8 | El implementador anulaba las pruebas con `conftest.py`, `jest.config.js`… | **Corregido** para la configuración y los nombres de prueba. **Abierto**: `process.exit(0)` en el código | `ciclo-hallazgos` (M2 parcial) |
| 9 | El modo clásico cambió sin `--motor ciclo` | **No se revierte**: son correcciones del saneamiento. **Documentado** | `docs/ciclo-verificado.md` |
| 10 | La ampliación del tope era de la tarea, el gasto de la sesión | **Corregido** | `ciclo-hallazgos` (hallazgo 10) |
| 11 | Un lenguaje no cubierto se descubría tras pagar; la revisión no llevaba la causa | **Corregido**: comprobación previa y detalle | `ciclo-hallazgos` (hallazgos 11 y 15) |
| 12 | Una tarea abortada se relanzaba en cada `resume`; la decisión se registraba antes de validarla | **Corregido** | `e2e/ciclo-flow`, `ciclo-hallazgos` |
| 13 | Con una tarea fallida y otra en revisión, `resume` no relanzaba la fallida | **Corregido** (+ `--tarea`) | `ciclo-hallazgos` (CLI) |
| 14 | Sin Docker, la etapa avanzaba de `tasks` a `code` antes de salir con 4 | **Corregido** | `ciclo-hallazgos` (CLI) |
| 15 | `pyproject.toml` sin `requirements.txt`, monorepos, comandos con comillas | **Parcial**: lo primero se detecta antes de gastar. Monorepos y comandos a medida **documentados como límite** | `ciclo-hallazgos` |
| 16 | LangGraph.js a medio integrar, contradiciendo la documentación | **Integrado y probado**: los dos motores pasan `ciclo-motor` y `e2e/ciclo-flow` y se reanudan entre sí. Matiz: `ciclo-hallazgos` (diario, libro, candado, decisiones) fija el motor propio; el verificador lo ejecutó con LangGraph: 91 de 93 | `ciclo-motores` |
| 17 | La reanudación no se probó cortando en cada paso | **Parcial**: cortes probados dentro de `qa` y entre nodos; el verificador cortó en los 7 nodos con los dos motores y halló el hueco N3 | `ciclo-hallazgos`, `ciclo-motor` |

## Cumplimiento de Criterios de Aceptación

| CA | Descripción | Archivo(s) | Test(s) | Estado |
|----|-------------|------------|---------|--------|
| CA-001-01 | Si la ejecución de las pruebas termina con éxito, la tarea se marca como completada y no se realizan más iteraciones. | core/ciclo/router.js, grafo.js | ciclo-router.test.js | ✅ |
| CA-001-02 | Si la ejecución falla y quedan iteraciones y presupuesto, el implementador recibe el resultado de esa ejecución y produce una nueva versión. | core/ciclo/router.js, grafo.js | ciclo-motor.test.js | ✅ |
| CA-001-03 | Un éxito en la última iteración permitida se trata como éxito, no como revisión. | core/ciclo/router.js, grafo.js | ciclo-router.test.js, ciclo-motor.test.js | ✅ |
| CA-001-04 | La decisión entre éxito, reintento y parada depende solo del código de resultado de la ejecución y del estado de control, nunca del texto de la salida. | core/ciclo/router.js, grafo.js | ciclo-router.test.js | ✅ |
| CA-001-05 | Una ejecución en la que no hay ninguna prueba presente no cuenta como éxito. | core/ciclo/router.js, grafo.js | ciclo-router.test.js | ⚠️: Solo se prueba la función pura. `hayPruebas` es el número de archivos escritos, así que un archivo trivial con salida 0 cuenta como éxito (verificador independiente) |
| CA-002-01 | Las pruebas de una tarea existen antes de que se produzca la primera versión de la implementación. | core/ciclo/nodos.js, protocolo-archivos.js | ciclo-motor.test.js | ✅ |
| CA-002-02 | Un intento del implementador de modificar o borrar una prueba se rechaza y queda registrado. | core/ciclo/nodos.js, protocolo-archivos.js | ciclo-protocolo.test.js, ciclo-motor.test.js | ✅: Con la reserva de que el implementador aún puede falsear el resultado con `process.exit(0)` en su código (límite documentado) |
| CA-002-03 | Si las pruebas cambiaron respecto a la huella tomada al escribirlas, la ejecución no se realiza. | core/ciclo/nodos.js, protocolo-archivos.js | ciclo-motor.test.js | ✅ |
| CA-002-04 | Las pruebas recién escritas fallan cuando todavía no hay implementación. | core/ciclo/nodos.js, protocolo-archivos.js | ciclo-motor.test.js | ✅ |
| CA-003-01 | El código en ejecución no puede abrir conexiones de red. | core/sandbox/* | sandbox-politica.test.js, sandbox-real.test.js | ✅ Docker real |
| CA-003-02 | El código en ejecución no puede escribir fuera de su área de trabajo ni alterar el proyecto real. | core/sandbox/* | sandbox-real.test.js | ✅ Docker real |
| CA-003-03 | El código en ejecución corre sin privilegios de administrador. | core/sandbox/* | sandbox-politica.test.js, sandbox-real.test.js | ✅ Docker real |
| CA-003-04 | Al superar el tiempo máximo, la ejecución se detiene y se clasifica como tiempo agotado. | core/sandbox/* | sandbox-politica.test.js, sandbox-real.test.js | ✅ Docker real |
| CA-003-05 | Al superar el límite de memoria o de número de procesos, la ejecución se detiene sin afectar al equipo anfitrión. | core/sandbox/* | sandbox-politica.test.js, sandbox-real.test.js | ⚠️ Docker real: Memoria probada con contenedor real. El límite de procesos se midió en el spike T002 (real) y se comprueba en el argv, pero no hay test automático que lo agote |
| CA-003-06 | Tras cada ejecución no queda ningún entorno residual. | core/sandbox/* | sandbox-politica.test.js, sandbox-real.test.js | ⚠️ Docker real: 100 ejecuciones seguidas (5 en paralelo) con 0 residuales, medido con un script puntual, no en la suite; la suite lo comprueba en ~12 ejecuciones. Las imágenes forge-sbx:* se acumulan y ningún código las borra |
| CA-003-07 | Si el aislamiento no está disponible, se informa al operador y no se ejecuta nada en el equipo anfitrión. | core/sandbox/* | ciclo-hallazgos.test.js, sandbox-politica.test.js | ✅ |
| CA-003-08 | Los secretos del proyecto no entran en el área de trabajo aislada. | core/sandbox/* | ciclo-datos.test.js | ✅ |
| CA-003-09 | Las dependencias declaradas por el proyecto están disponibles durante la ejecución, pese a no haber red. | core/sandbox/* | sandbox-politica.test.js, sandbox-real.test.js | ✅ Docker real |
| CA-004-01 | Al alcanzar el umbral de degradación, las llamadas siguientes usan un modelo más barato y el cambio queda registrado. | core/ciclo/presupuesto.js, diario.js (libro), index.js | ciclo-presupuesto.test.js, ciclo-motor.test.js | ✅ |
| CA-004-02 | Alcanzado el tope de gasto, no se inicia ninguna llamada más y la tarea pasa a revisión humana. | core/ciclo/presupuesto.js, diario.js (libro), index.js | ciclo-presupuesto.test.js, ciclo-motor.test.js | ✅ |
| CA-004-03 | El gasto acumulado se conserva tras reanudar una sesión. | core/ciclo/presupuesto.js, diario.js (libro), index.js | ciclo-presupuesto.test.js, ciclo-motor.test.js | ✅ |
| CA-004-04 | El gasto acumulado se puede consultar en cualquier momento. | core/ciclo/presupuesto.js, diario.js (libro), index.js | ciclo-motor.test.js | ⚠️: Probado en la fachada (resumen) y en el e2e con Docker; forge status solo se prueba ahí |
| CA-004-05 | Una respuesta de un proveedor real que no informa de su consumo se trata como error, no como gasto cero. | core/ciclo/presupuesto.js, diario.js (libro), index.js | ciclo-presupuesto.test.js, ciclo-motor.test.js | ✅ |
| CA-005-01 | Tras 5 ejecuciones fallidas, el sistema se pausa y pide revisión indicando el motivo. | core/ciclo/nodos.js, respaldo.js; core/engine-cli.js | ciclo-router.test.js, ciclo-motor.test.js | ✅ |
| CA-005-02 | En la revisión, la persona puede continuar con una ampliación de iteraciones o de presupuesto, aceptar el resultado tal como está, o abortar. | core/ciclo/nodos.js, respaldo.js; core/engine-cli.js | ciclo-motor.test.js | ✅ |
| CA-005-03 | Mientras no haya una decisión explícita, no se consume presupuesto. | core/ciclo/nodos.js, respaldo.js; core/engine-cli.js | ciclo-motor.test.js, e2e/ciclo-flow.test.js | ✅ |
| CA-005-04 | Abortar restaura los archivos del proyecto al estado previo a la tarea. | core/ciclo/nodos.js, respaldo.js; core/engine-cli.js | ciclo-datos.test.js, ciclo-motor.test.js | ✅: Restaura también lo escrito por qa y borra las carpetas vacías que creó la tarea. Un corte entre respaldo y escritura es inocuo |
| CA-005-05 | Un fallo del entorno aislado no consume iteraciones y lleva a revisión con ese motivo. | core/ciclo/nodos.js, respaldo.js; core/engine-cli.js | ciclo-router.test.js, ciclo-motor.test.js | ✅ |
| CA-006-01 | Tras una interrupción, reanudar continúa desde el último paso completado sin repetir las llamadas a modelos ya realizadas. | core/ciclo/checkpoint-archivos.js, diario.js, candado.js | ciclo-datos.test.js, ciclo-motor.test.js, ciclo-tercera-pasada.test.js | ⚠️: N1 y N2 corregidos; queda la ventana de milisegundos del nodo `coder` (N3) |
| CA-006-02 | Un punto de guardado dañado se detecta y se informa, sin perder el anterior válido. | core/ciclo/checkpoint-archivos.js, diario.js, candado.js | ciclo-datos.test.js | ⚠️: el aviso al operador (`log.append` en `index.js`) no tiene test |
| CA-006-03 | Dos reanudaciones simultáneas de la misma tarea no producen estados divergentes. | core/ciclo/checkpoint-archivos.js, diario.js, candado.js | ciclo-datos.test.js, ciclo-motor.test.js, ciclo-tercera-pasada.test.js | ✅ con 2 y con 3 procesos (corregido tras la tercera pasada; sin revisión independiente de la corrección) |
| CA-007-01 | El contexto entregado a un agente nunca supera el tamaño máximo configurado, e indica si se truncó. | core/recuperacion/* | ciclo-datos.test.js | ✅ |
| CA-007-02 | La fuente de contexto se puede sustituir por otra sin modificar el resto del ciclo. | core/recuperacion/* | ciclo-datos.test.js | ✅ |
| CA-007-03 | El ciclo funciona sin ningún índice preparado de antemano. | core/recuperacion/* | ciclo-datos.test.js | ✅ |
| CA-008-01 | Con el ciclo sin activar, el modo clásico se comporta exactamente como antes. | core/orchestrator.js, engine-cli.js; core/ciclo/config.js, candado.js | ciclo-hallazgos.test.js, e2e/ciclo-flow.test.js | ⚠️: Probado: sin --motor no se crea .sdd/motor, no se emiten eventos del ciclo y las tareas se completan. **No es literalmente "exactamente como antes"**: el modo clásico cambió en 7 puntos por el saneamiento (docs/ciclo-verificado.md, "Cambios en el modo clásico") |
| CA-008-02 | El ciclo solo se ejecuta cuando el proyecto está en la etapa de construcción. | core/orchestrator.js, engine-cli.js; core/ciclo/config.js, candado.js | e2e/ciclo-flow.test.js | ✅ |
| CA-008-03 | Cada paso del ciclo queda en el registro de eventos y es visible en el panel. | core/orchestrator.js, engine-cli.js; core/ciclo/config.js, candado.js | ciclo-motor.test.js | ⚠️: Los eventos se prueban. "Visible en el panel" no tiene test: el panel sirve events.jsonl en crudo |
| CA-008-04 | Dos tareas de construcción no se ejecutan a la vez sobre la misma área de trabajo. | core/orchestrator.js, engine-cli.js; core/ciclo/config.js, candado.js | e2e/ciclo-flow.test.js | ✅ |
| CA-008-05 | Un cambio de dependencias propuesto por el implementador no se aplica sin revisión humana. | core/orchestrator.js, engine-cli.js; core/ciclo/config.js, candado.js | ciclo-protocolo.test.js, ciclo-motor.test.js | ✅ |

Las marcas ⚠️ se explican en la propia fila. Las filas "Docker real" se comprobaron además contra contenedores de verdad en Windows 11 con Docker 29.7.2.

## Suite

| Ejecución | Total | Pasan | Fallan | Saltados |
|---|---|---|---|---|
| Windows 11, Node 24, `FORGE_TEST_DOCKER=1` (todo el repositorio, tras las correcciones) | 1381 | 1378 | 0 | 3 |
| Verificador: Windows 11, Node 24, `FORGE_TEST_DOCKER=1` (antes de las correcciones) | 1292 | 1289–1290 | 0–1 | 2 |
| Windows 11, Node 24, sin Docker (antes de las correcciones) | 1281 | 1277 | 0 | 4 |
| Linux (Alpine), Node 18, sin LangGraph instalado | 1274 | 1266 | 0 | 8 |
| Linux (Alpine), Node 20, con LangGraph | 1281 | 1273 | 0 | 8 |
| Linux (Alpine), Node 22, con LangGraph | 1281 | 1279 | 0 | 2 |

Las filas de Linux son anteriores a las correcciones de la tercera pasada y no se han repetido. Línea base antes de empezar: 975 de 1014 en Windows. Errores de tipos: 32 (los 32 previos; ninguno en código nuevo).
Los saltados con Docker (2) son pruebas de enlaces de archivo, que Windows no permite sin privilegios.

## Medidas puntuales (no son tests de la suite)

- **100 ejecuciones aisladas seguidas**, 5 en paralelo, con la política completa: 0 resultados inesperados, 0 errores de infraestructura, **0 contenedores residuales**, 209 s.
- **Arranque de un contenedor con la política completa**: mediana de 2,9 s (spike T002).
- **Condición de carrera del candado**: 12 rondas de dos procesos y, tras la corrección, 12 rondas de tres, disputando un candado huérfano; en ninguna lo tomaron dos. Antes de la corrección el verificador midió 1 de 40 con 3 procesos, y el revisor de seguridad 4 de 120 con 5.

## Lo que esta verificación NO demuestra

- **Las correcciones posteriores a la tercera verificación** (N1, N2, N4–N8 y los hallazgos de seguridad NUEVO-1 a NUEVO-8) las probé yo con los tests nuevos; no las ha revisado nadie independiente.
- **Los números de Linux y de «12 rondas» son míos**: el verificador no pudo reproducirlos aquí.
- **Nada se ha probado con un modelo real.** Ni la frecuencia con que un modelo devuelve el formato pedido, ni el costo real de una tarea, ni la calidad de lo que escribe.
- **Linux con Docker.** La suite pasa en contenedores Linux (Node 18, 20 y 22), pero el aislamiento real solo se ha ejecutado en Windows con Docker Desktop. El job de CI está sin ejecutar: nada está commiteado.
- **`process.exit(0)` falsea un éxito.** Hallazgo de seguridad M2, abierto y documentado.
- **No hay cuota de disco** para la copia de trabajo.
- **Lo que no esté en las listas de rutas** (configuración ejecutable que no conocemos) se escribirá.

## Requisitos Funcionales

| RF | Cumple | Nota |
|----|--------|------|
| RF-001 a RF-009 | ✅ | Con las reservas de las filas de CA |
| RF-010 Sin secretos en copia, registros ni puntos de guardado | ⚠️ | Copia: lista única y ampliada. Registros: `redactar` cubre formatos comunes, no todos |
| RF-011 Gasto por sesión, degradación y parada | ✅ | Libro por llamada |
| RF-012 Revisión humana por cada motivo | ✅ | Cinco motivos; la decisión se valida antes de registrarse |
| RF-013 Continuar, aceptar, abortar; sin decisión no se gasta | ✅ | |
| RF-014 Estado guardado tras cada paso y reanudación | ✅ | Más diario de respuestas dentro de un paso |
| RF-015 Contexto acotado y fuente sustituible | ✅ | Tope incluye cabeceras; fuente por `motor.recuperador` |
| RF-016 Modo clásico intacto | ⚠️ | No cambia por activar el ciclo; sí cambió por el saneamiento (documentado) |

## Cumplimiento de Constitución

| Principio | Cumple | Notas |
|-----------|--------|-------|
| I, II | ⚠️ | Spec y plan aprobados por delegación expresa del dueño |
| III | ✅ | La degradación puede ir a un modelo local |
| IV | ⚠️ | Una dependencia opcional (LangGraph.js, ~59 MB) y de carga perezosa; ADR-01 |
| V | ✅ | Con la reserva del cierre de la vía del modo clásico (ver hallazgo M4 de seguridad) |
| VI a IX | ✅ | |
| X | ✅ | Opt-in; el modo clásico cambió solo por el saneamiento, documentado |
| XI | ⚠️ | La primera versión de esta documentación lo incumplió; esta intenta corregirlo y lista sus límites |
| XII | ✅ | |

## Recomendaciones

1. **Pasar de nuevo `/sdd.verificar` con el agente `revisor` y una tercera revisión del agente `seguridad`.** Esta versión no se ha verificado de forma independiente.
2. Probar una tarea real con un proveedor de pago y un tope bajo (`FORGE_BUDGET_USD=0.50`).
3. Ejecutar el job `aislamiento` de CI cuando haya commit.
4. Decidir qué hacer con `process.exit(0)`: exigir un informe del ejecutor (TAP o JUnit) cambiaría el principio de decidir solo por el código de salida.
