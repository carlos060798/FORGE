---
spec_id: 2026-10-09-pruebas-confiables
fecha_verificacion: 2026-10-09
veredicto: AUTOEVALUADA  # sin verificación ni revisión de seguridad independientes
---

# Verificación: 2026-10-09-pruebas-confiables

## Veredicto: **AUTOEVALUADA**

La hizo quien implementó. En este proyecto las autoevaluaciones anteriores se rechazaron o se rebajaron al verificarlas de forma independiente: **esto no es una aprobación**. Faltan una verificación independiente, el paso por los agentes `revisor` y `seguridad` que pide la constitución, y una ejecución con un modelo real.

La spec y ADR-20 se aprobaron por delegación del dueño (2026-10-09). No hubo `plan.md` ni `tareas.md`: se implementó a partir de la spec, de ADR-20 y de la FASE 7 de `PLAN-CIERRE-BRECHAS.md`.

Leyenda: ✅ demostrado con un test que se ejecutó y pasó · ⚠️ parcial · ❌ no hecho.

## Criterios de aceptación

Los tests están en `tests/ciclo-rojo-obligatorio.test.js` (rojo) y `tests/ciclo-mutacion.test.js` (mutación). Entre comillas, el nombre del test o del bloque.

| CA | Test | Estado |
|---|---|---|
| CA-001-01 | rojo: «recibe el resultado y sus pruebas; si la segunda versión falla, el ciclo sigue», «unas pruebas que fallan a la primera no provocan ningún reintento» | ✅ |
| CA-001-02 | rojo: «pasan dos veces: la tarea se pausa con pruebas_no_fallan, reanudando en qa» (el implementador no se llama y no se escribe ninguna implementación), «mientras nadie decide, no se gasta nada», «continuar…», «aceptar… y abortar…» | ✅ |
| CA-001-03 | rojo: «no hay reintento ni pausa, y la exención queda anotada en el registro», «el campo se propaga de la tarea al estado…», «normalizarTareas conserva el campo…» | ✅ |
| CA-001-04 | rojo: «no cuenta como "fallan" ni como "pasan"…», «los códigos 125 a 127…», «continuar repite la comprobación sin volver a pagar las pruebas», «si el entorno falla en la comprobación del reintento…» | ✅ |
| CA-001-05 | rojo: «la llamada del reintento se suma al gasto de la sesión» (4 llamadas, 0,12 USD), «con el presupuesto agotado el reintento no se inicia» | ✅ |
| CA-002-01 | mutación: «prueba cada alteración y da puntuación y sobrevivientes…» (una ejecución por cambio, cada una con un código distinto y ninguna con el código sin alterar), «solo se alteran los archivos indicados» | ✅ |
| CA-002-02 | mutación: «el proyecto real queda idéntico (por huellas)…», «la copia se borra… también si el ejecutor lanza un error»; con Docker real: «unas pruebas débiles dejan sobrevivir…; el proyecto queda idéntico» | ✅ con una reserva: que «nunca se ejecuta en el equipo anfitrión» se apoya en que el único ejecutor que recibe el módulo es el `SandboxRunner` (probado en `sandbox-real`); no hay un test que intente lo contrario |
| CA-002-03 | mutación: «prueba cada alteración y da puntuación y sobrevivientes con archivo y línea», «puntuar…» | ✅ |
| CA-002-04 | mutación: «tope de alteraciones → parcial, con salto uniforme», «tope de tiempo → se detiene y la puntuación es parcial», «respeta los topes de la configuración» | ✅ con una reserva: el tope de tiempo se probó con un reloj simulado, y se comprueba antes de empezar cada cambio, no a mitad de una ejecución. La medición puede pasarse del tope en lo que tarde una ejecución (como mucho `sandbox.timeout_s`) |
| CA-002-05 | mutación: «sin ninguna alteración posible devuelve null y no ejecuta nada», «si no hay nada que alterar, la medición se omite y queda anotado» | ✅ |
| CA-002-06 | mutación: «la misma entrada produce las mismas alteraciones», «los archivos se ordenan por ruta…», «por encima del tope, salto uniforme…» | ✅ |
| CA-002-07 | mutación: «la medición no llama a ningún modelo ni cambia el gasto» (3 llamadas en toda la tarea, las mismas que sin medir) | ✅ |
| CA-003-01 | mutación: «valores por defecto: informar…», «tras un pase: con "no" termina en éxito…», «no mide nada: el recorrido y el estado son los de antes» | ✅ con una reserva: «como antes de esta spec» es cierto para la medición; HU-001 cambia el nodo `qa` en los tres modos |
| CA-003-02 | mutación: «mide, guarda la puntuación en el estado y en el registro, y la tarea termina en éxito», «con pruebas que no detectan nada la tarea termina en éxito igual…», «forge status muestra la puntuación de cada tarea medida» | ✅ (la línea de `forge status` se probó llamando a `lineasEstadoCiclo`, no lanzando el comando) |
| CA-003-03 | mutación: «bajo el mínimo, el agente de pruebas recibe la lista de no detectados y refuerza una vez; si basta, éxito» | ✅ |
| CA-003-04 | mutación: «si las pruebas reforzadas fallan contra la implementación, el ciclo vuelve al implementador» | ✅ |
| CA-003-05 | mutación: «si tras el refuerzo sigue bajo el mínimo, revisión humana con motivo pruebas_debiles», «tras la pausa: aceptar…, abortar… y continuar…» | ✅ |
| CA-003-06 | mutación: «tras el refuerzo las huellas se vuelven a tomar…», «si las pruebas reforzadas cambian en disco, no se ejecutan», «en el refuerzo el agente de pruebas no puede escribir la implementación…» (y en «…vuelve al implementador» el implementador intenta sustituir las pruebas reforzadas: se rechaza con `prueba_inmutable` y quedan intactas) | ✅ |
| CA-003-07 | mutación: «decidirTrasMutacion — tabla de verdad» (8 tests), entre ellos «la decisión no mira el texto de los sobrevivientes ni la salida de las ejecuciones» | ✅ |
| CA-004-01 | rojo: «CA-004-01 — los archivos que el ejecutor de pruebas carga solo exigen revisión humana» (5 tests) | ✅ para los cuatro que la guía citaba (`jest.setup.*`, `__mocks__/`, `vitest.workspace.*`, `karma.conf.*`). La lista sigue siendo una lista: `tsconfig.json`, `scripts/*.sh` y otros siguen fuera |

Total: 20 ✅ (4 con reserva), 0 ⚠️, 0 ❌.

## Requisitos funcionales y no funcionales

| Requisito | Evidencia | Estado |
|---|---|---|
| RF-001 | Tests de HU-001 | ✅ |
| RF-002 | La generación y la decisión son funciones puras con tests; ningún nodo nuevo consulta a un modelo para decidir | ✅ |
| RF-003 | El módulo solo ejecuta a través del `runner` que recibe; en el ciclo es el `SandboxRunner` | ✅ con la reserva de CA-002-02 |
| RF-004 | Comparación de huellas del proyecto antes y después, con ejecutor falso y con Docker real | ✅ |
| RF-005 | mutación: «con un avance guardado no se repiten las alteraciones ya probadas», «un avance de otro código o de otras pruebas no se reutiliza», «el resultado queda en el punto de guardado…», «un corte a mitad de la medición no obliga a repetir las alteraciones ya probadas» | ✅ El cambio que estaba en curso al cortarse sí se repite |
| Rendimiento: como máximo 10 cambios y 5 minutos | Topes por defecto 10 y 300 s, probados | ⚠️ El tope de tiempo puede superarse en una ejecución (ver CA-002-04) |
| Dependencias: ninguna nueva | `git diff package.json` vacío; se usa `acorn`, que ya era dependencia | ✅ (sin test propio) |
| Compatibilidad: suite actual en verde con «no medir» | Ver «Tests existentes modificados» | ⚠️ Un test cambió de significado por HU-001, como la propia spec anuncia |
| Auditabilidad: un evento por cambio | mutación: «un evento por alteración probada» (`ciclo:mutante`) | ✅ |

## Criterios de éxito medibles (sección 12)

| Criterio | Estado |
|---|---|
| Los 20 criterios de aceptación tienen test | ✅ |
| En un proyecto de ejemplo con pruebas vacías, 0 tareas terminan en éxito sin intervención | ⚠️ **Solo en parte.** Unas pruebas que pasan sin implementación ya no terminan en éxito (HU-001, probado). Unas pruebas que fallan sin implementación pero no comprueban resultados **siguen terminando en éxito con el modo por defecto** («informar»), con su puntuación baja en el registro; solo con «exigir» se pausan. No se ha ejecutado sobre un proyecto de ejemplo con un modelo real |
| 0 dependencias nuevas | ✅ |
| Tiempo añadido por tarea: como máximo 5 minutos | ⚠️ Medido solo en un proyecto JavaScript mínimo: 40 a 67 s para 9 cambios. Sin medir en un proyecto real |

## Pruebas ejecutadas (2026-10-09, Windows 11, Node 24.20.0, Docker 29.7.2)

| Comando | Resultado |
|---|---|
| `npm test` (sin `FORGE_TEST_DOCKER`) | 1659 tests: 1652 pasan, 0 fallan, 7 omitidos (los que piden Docker) |
| `FORGE_TEST_DOCKER=1 node --test tests/ciclo-mutacion.test.js tests/sandbox-real.test.js tests/e2e/*.test.js` | 127 tests: 127 pasan, 0 fallan, 0 omitidos |
| `FORGE_TEST_DOCKER=1 node --test tests/api-http.test.js tests/mcp-e2e.test.js tests/probar-modelo.test.js` | 38 tests: 38 pasan |

`npm test` se ejecutó entero tres veces con el código final. Dos pasadas dieron el resultado de la tabla. **En la otra falló un test ajeno a esta spec**, «no bloquea git reset --soft» de `tests/pre-tool-guard.test.js`, tras quedarse 491 segundos esperando a un proceso; ese archivo no se ha tocado, pasa solo (38 de 38 en 5 s) y pasó en la pasada siguiente. El equipo ejecutaba otros trabajos a la vez. No se ha investigado la causa.

Antes de esta spec, `npm test` daba 1549 tests (1542 pasan, 7 omitidos). Los tests nuevos son 112: 81 en `ciclo-mutacion.test.js` (2 de ellos con Docker real, que sin `FORGE_TEST_DOCKER` no se cuentan) y 31 en `ciclo-rojo-obligatorio.test.js`.

`npm run typecheck` ya daba errores antes de esta spec; los dos que quedan en `core/ciclo/` (`nodos.js`, función `invocar`) son anteriores. Los archivos nuevos no añaden ninguno.

### Tiempo de la medición con Docker real

Proyecto JavaScript sin dependencias (`node --test`, imagen `node:22-alpine`), 9 cambios, Docker Desktop en Windows:

| Medición | Tiempo |
|---|---|
| Pruebas débiles, 1.ª pasada | 40,6 s |
| Pruebas fuertes, 1.ª pasada | 45,2 s |
| Dentro del ciclo (nodo `mutacion`), 1.ª pasada | 61,4 s (el nodo `sandbox`, una ejecución: 5,5 s) |
| Pruebas débiles, 2.ª pasada | 67,3 s |
| Pruebas fuertes, 2.ª pasada | 50,9 s |
| Dentro del ciclo, 2.ª pasada | 58,4 s (el nodo `sandbox`: 5,4 s) |

Es decir, entre 4,5 y 7,5 s por cambio, lo que tarda una ejecución normal de las pruebas en ese equipo. Con el tope por defecto de 10 cambios, la medición añade alrededor de un minuto por tarea en un proyecto así. La variación entre pasadas es grande; el equipo ejecutaba otros trabajos a la vez.

## Tests existentes modificados

- `tests/ciclo-motor.test.js`: el ayudante `entorno()` fija `mutacion: "no"`. Además, el test «CA-002-04: unas pruebas que pasan sin implementación generan un aviso, no un bloqueo» comprobaba justo lo que esta spec endurece. Ahora usa una tarea con `parte_de_codigo_existente: true`, que es el único caso en que sigue siendo un aviso; su guion de ejecuciones no cambió. **Es el único test cuyo significado cambió.**
- `tests/ciclo-motores.test.js`, `tests/ciclo-sin-progreso.test.js` y `tests/validacion-modelo-real.test.js` (dos ayudantes): se fija `mutacion: "no"`. Sus guiones de ejecuciones terminan en el pase y sus implementaciones tienen código alterable, así que la medición por defecto agotaba el guion. No cambia lo que comprueban.
- Ningún otro test necesitó cambios: `ciclo-hallazgos`, `ciclo-tercera-pasada` y `e2e/ciclo-flow` siguen en verde con la medición por defecto (no se ha mirado en cada uno si la medición se omite o no se llega a ella).
- De los 11 tests que se rompieron al implementar, 10 fue por la medición por defecto y 1 por el rojo obligatorio (el citado). Ningún otro guion que empezara con un pase dependía del comportamiento antiguo.

## Lo que no se ha hecho o no se ha probado

- ❌ **Ninguna ejecución con un modelo real.** No se sabe con qué frecuencia un modelo escribe pruebas que pasan sin implementación, ni si refuerza bien las pruebas a partir de la lista de cambios no detectados, ni cuántos cambios equivalentes aparecen en código real.
- ❌ **Verificación independiente y revisión de seguridad.** El módulo copia el proyecto a una carpeta temporal del sistema y escribe en ella código alterado: merece la revisión de `seguridad`.
- ⚠️ **Python y Go solo se han probado en la generación de cambios** (tests unitarios). No se ha ejecutado una medición con Docker real en esos lenguajes: no se ha comprobado cuántos cambios por patrones dejan de compilar ni cuánto tarda.
- ⚠️ **`forge status` y `forge resume` con los motivos nuevos** se probaron por sus funciones (`lineasEstadoCiclo`, estado de la revisión), no lanzando el comando.
- ⚠️ **La copia temporal** se crea en la carpeta temporal del sistema, fuera de `.sdd/motor/`. Si el proceso muere sin pasar por el bloque de limpieza, queda una carpeta `forge-mutacion-*` que nadie barre al arrancar. No lleva secretos (mismos vetos que la copia de trabajo), pero sí el código del proyecto.
- ❌ **`skills/mutation-detector`** no se ha renombrado ni aclarado (consecuencia neutral de ADR-20).
- ❌ **La constitución no se ha tocado.** La tensión con la letra del Principio VII (el refuerzo ocurre después de implementar) queda resuelta en la spec por delegación, no con una enmienda.
- La pregunta abierta sobre pasar a «exigir» por defecto en la siguiente versión MAYOR sigue abierta.

## Correcciones tras la revisión independiente (2026-10-09)

Informe: `revision-independiente.md` (veredicto `APROBADA_CON_OBSERVACIONES`). H-01 se corrigió antes (commit `fa0f342`). Este bloque cubre H-02 a H-09. Pruebas nuevas en `tests/mutacion-revision.test.js` (35) y 5 en `tests/ciclo-mutacion.test.js`.

| Hallazgo | Estado | Qué se hizo | Prueba |
|---|---|---|---|
| H-02 (alto) | corregido (con límites) | Fallo de carga = no concluyente (se distingue de un fallo de prueba por la forma de la salida); reparto de la muestra por archivo; reserva ordenada | «reproducción de la revisión…» (`node --test` real: antes 9/10 = 90 %, ahora 0/6 con 14 descartadas), «la muestra se reparte por archivo» |
| H-03 (alto) | corregido; Go medido con Docker real | Una alteración que no compila (`[build failed]`, `SyntaxError`, `error TS`) no cuenta como detectada | Docker real (`FORGE_TEST_DOCKER=1`): Go del ejemplo, antes 2/6 = 33 %, ahora 0/4 con 2 no concluyentes; unitarias de salida de Go, Python y TypeScript |
| H-04 (medio) | corregido | Mínimo `motor.mutacion_min_concluyentes` (3); `exigir` pausa con medición vacía, parcial por entorno o por tiempo, línea base en rojo; `t0` tras `crearCopia` | tabla de decisión, transición del grafo, «el tiempo se cuenta desde que la copia está lista», recorridos del ciclo |
| H-05 (medio) | corregido | Línea base antes de alterar; 137/139 = entorno | «la copia sin alterar tiene que pasar…», «137 y 139…», recorrido del ciclo con `exigir` |
| H-06 (medio) | corregido; permisos sin comprobar en Linux real | Carpeta 0700 con marca, copia privada 0700/0600, barrido de huérfanas antiguas; `copiaSinBorrar` se anota | barrido (con marca, nombre exacto, antigüedad, enlace), integración. **El test de permisos POSIX se omite en Windows** (donde se desarrolló) |
| H-07 (medio) | mitigado | `forge status` muestra N de M tareas exentas y cuáles (el registro ya anotaba cada exención aplicada) | recorrido del ciclo con `lineasEstadoCiclo`. No se impide que el agente de `tasks` declare la exención |
| H-08 (bajo) | corregido | `medirMutacion` valida con `validarRuta`; informa `rechazadas` | rutas con `..`, absolutas, vetadas |
| H-09 (bajo) | corregido | `antes`/`despues` se redactan antes de recortar | secreto en el código y secreto en el borde del recorte |
| H-10 (bajo) | abierto | Cambios inútiles (índices, tamaños de tipo), JSX, TS con tipos por patrones: sin cambios | — |
| H-11 (bajo) | corregido | Ver H-03 y H-05 | — |
| H-12 (bajo) | corregido antes (H-01) | — | — |

### Decisiones de diseño

- **Reconocer la salida del ejecutor**, no validar antes con `go build`/`py_compile`/`tsc`: sin contenedores ni dependencias nuevas y válido para cualquier ejecutor. Si la salida no se reconoce, la alteración es no concluyente (se pierde señal, nunca se infla). Se leen textos de salida solo para decidir qué cuenta como medición; el router sigue sin leer texto.
- **Denominador = concluyentes.** `probadas` ahora significa «alteraciones concluyentes»; `noConcluyentes` es nuevo y opcional en el estado, así que los puntos de guardado anteriores siguen valiendo. El avance guardado con el formato anterior se descarta.
- **Con `exigir`, «nada que alterar» ya no es éxito.** Es un cambio de comportamiento deliberado (H-04); `aceptar` desbloquea.
- **Coste:** una ejecución más de las pruebas por medición (la línea base) y hasta `mutacion_max` más si hay muchas no concluyentes.

### Tests existentes modificados en esta pasada

- `tests/ciclo-mutacion.test.js`: la constante `FALLO` pasa de un resumen sin prueba fallida a un fallo TAP de una prueba con nombre (así es un fallo real de node:test); los recuentos de ejecuciones suman 1 por la línea base; el escenario «sin nada que alterar, exigir no bloquea» ahora comprueba que **sí** pausa con `pruebas_debiles` (cambio de significado legítimo, H-04); `textoMutacion` con `parcial` ahora necesita `motivoParcial`. Ninguna aserción se debilitó.

### Lo que no se ha hecho o no se ha probado en esta pasada

- ⚠️ **Python y TypeScript con Docker real**: solo con salidas de ejecutor sintéticas. El formato de salida de pytest/unittest/jest/vitest se reconoce por patrones escritos de memoria del formato de esas herramientas, no capturados en esta pasada.
- ⚠️ **Permisos 0700/0600 de la copia** sin comprobar en Linux: el desarrollo es en Windows y el test se omite allí.
- ⚠️ **`FORGE_TEST_DOCKER=1` con `tests/e2e`, `sandbox-real`, `api-http` y `mcp-e2e`**: no se volvieron a ejecutar en esta pasada (solo `ciclo-mutacion` y `mutacion-revision`).
- ❌ **Ejecución con un modelo real** sigue pendiente.
- ❌ **H-02 (c)**: no se descartan archivos que las pruebas no llaman (cobertura) y un implementador que detecte el entorno de medición puede sesgar la puntuación.
- ❌ **H-10** (alteraciones inútiles) sin tocar.

## Tercera revisión independiente y cierre de la tanda (2026-10-11)

La tercera pasada (`../2026-10-09-validacion-modelo-real/revision-independiente-3.md`) revisó las correcciones de esta fase y dio **aprobada con observaciones**. Lo que cambió en la medición por mutación desde entonces:

- ✅ **N-09:** el reconocimiento de un fallo de prueba exige la estructura que escribe el ejecutor, no solo el prefijo: un módulo que imprime `not ok 1 - x` con `console.log` ya no cuenta como detectada. Comprobado con 58 salidas reales capturadas de node:test, pytest, unittest, jest, vitest y Go (`tests/mutacion-salidas-reales.test.js`).
- ✅ **N-12:** el barrido de copias huérfanas exige una marca con la clave de FORGE y un nonce, y borra sin esperar a las copias de un proceso que ya no existe (el pid de la marca); una carpeta con marca falsificada, enlace o nombre ajeno no se toca.
- ✅ **H11:** la medición se limita a las líneas que la tarea cambió cuando el archivo ya existía; antes, en un archivo de 1812 líneas, daba 1 de 10 por funciones ajenas. El evento informa de cuántas candidatas se descartaron (`fueraDeLoCambiado`).
- ❌ **N-02 sigue abierto:** pruebas sin aserciones dan hasta 90 % si el código bajo prueba llama a funciones con `if (K !== N) throw` repartidas en muchos archivos. No se filtra por cobertura. `mutacion: exigir` no es una garantía frente a un implementador adversario.
- ⚠️ Python y TypeScript con Docker real: `tests/mutacion-docker-lenguajes.test.js` está escrito; sin resultado confirmado al cerrar la tanda.

## Cobertura y tope de archivos (N-02), reporter fijado (N4-06) y Docker real en Python y TypeScript (2026-10-13)

Windows 11, Node 24.20.0 en el anfitrión, Docker 29.7.2, imágenes `node:22-alpine` y Python de la imagen preparada. Pruebas: `tests/mutacion-cobertura.test.js` (22), y ajustados `ciclo-mutacion`, `mutacion-revision`, `mutacion-lineas-cambiadas`, `corte-real` (274 tests de esos archivos y los de salidas reales: 273 pasan, 1 omitido). No se ejecutó la suite completa.

### Qué cambió

- ✅ **Cobertura de la línea base.** `node --test` (`--experimental-test-coverage`, informe en árbol de Node 24 y plano de Node 22, con prefijo `ℹ ` o `# `), `go test -coverprofile=/dev/stdout` y Python con el módulo `coverage` si la imagen ya lo tiene. Se descartan las alteraciones en líneas y archivos que ninguna prueba ejecuta (`fueraDeCobertura`).
- ✅ **Sin cobertura** (jest, vitest, Python sin `coverage`, o un comando que falle): comportamiento anterior y `sinCobertura: true` en el resultado, el evento `ciclo:mutacion` y `forge status` («SIN COBERTURA: no cuenta como evidencia»). Con `exigir` y una puntuación que antes valía, el nodo guarda `puntuacion: null` y `omitida` con el motivo: el router pide revisión `pruebas_debiles` (insuficiente) con el detalle; nunca éxito.
- ✅ **Tope de archivos** `motor.mutacion_max_archivos` (5, entero ≥ 1 validado): los de más líneas cambiadas; el resto en `archivosOmitidos`. Se añade `porArchivo`.
- ✅ **Avance**: la cobertura se guarda con el avance; reanudar no la repite ni repite la línea base si no falta nada.
- ✅ **N4-06**: la medición ejecuta siempre con `--test-reporter=tap` (se clona el `SandboxRunner` con otro comando) y `senalJs` exige el resumen `# fail N` (N ≥ 1, no más que los bloques `not ok` con su YAML). El reporter spec ya no se reconoce (sin señal).
- ✅ **N4-01**: `restos.js` usa `leerMarca` y `procesoVivo` de `mutacion.js` (la marca JSON real); `corte-real.test.js` usa la marca real. **N4-02**: un pid vivo no se borra nunca por antigüedad. **N4-10**: `MAX_TOKENS_ESTIMADOS` = 2 000 000 en `presupuesto.js` y en `_anotarAbortada` (1e300 no toca el presupuesto).

### El caso de la revisión (N-02) — NO queda resuelto, y no se dice que sí

Nueve archivos `src/g/gN.js` (`const K = N; export function cN() { if (K !== N) throw ... }`) llamados desde `suma()` por `comprobar()`, pruebas sin aserciones, con `node --test` real sobre una copia:

| Configuración | Resultado |
|---|---|
| Sin cobertura, sin tope de archivos | 9/10 = **90 %** (guardias 9/9, `suma.js` 0/1) |
| Con cobertura y tope de 5 archivos | 9/10 = **90 %** (4 guardias 9/9, `suma.js` 0/1; 5 archivos omitidos) |
| Sin cobertura, tope 5 | 9/10 = **90 %** |

La cobertura no ayuda: las guardias se ejecutan y su fallo es un fallo de prueba real. El tope tampoco, porque el código real solo tiene una alteración y las guardias rellenan la muestra. Lo que sí queda: el reparto `porArchivo` deja ver que todo lo detectado sale de archivos de guardia y que `suma.js` tiene 0 detectadas; la prueba fija este límite. `mutacion: exigir` **no es una garantía frente a un implementador adversario** (ADR-20 y `docs/ciclo-verificado.md`).

### Docker real (`FORGE_TEST_DOCKER=1 node --test tests/mutacion-docker-lenguajes.test.js`)

13 alteraciones posibles por módulo, tope por defecto 10. Tiempos en un equipo con otras cargas.

| Caso | Con aserciones | Sin aserciones | Medición | Cobertura |
|---|---|---|---|---|
| Python con pytest | 10/10 (100 %) | 0/10 (0 %) | 52 s y 54 s (11 ejecuciones, ~4,7 s cada una) | sin cobertura: `coverage` no está en la imagen |
| Python con pytest y `coverage` | 10/10 | 0/10 | 61 s y 59 s (~5,5 s cada una) | sí (13 candidatas, 0 fuera) |
| TypeScript con vitest | 10/10 | 0/10 | 65 s y 61 s (~5,9 s cada una) | sin cobertura: vitest no ofrece cobertura sin dependencias |
| TypeScript con `node --test` (`npm test`, sin dependencias) | 10/10 | 0/10 | 52 s y 51 s (~4,8 s cada una) | sí (13 candidatas) |
| TypeScript con jest y ts-jest | 8/8, 5 no concluyentes (`return null` no pasa TS2322) | 0/8, 5 no concluyentes | 193 s y 175 s (~13,8 s cada una, 14 ejecuciones) | sin cobertura |
| Ciclo completo Python, `informar` | éxito con 10/10 | — | tarea 59,3 s; nodo `sandbox` 4,2 s; nodo `mutacion` 50,4 s | — |

No hubo que corregir patrones de salida ni la preparación de imagen: los 9 tests (y los dos de cobertura añadidos) pasan. TypeScript tiene formas soportadas en el entorno aislado (vitest, `node --test` con Node ≥ 22.18, jest + ts-jest); no se probó `tsc` ni otro transformador.

### Tests existentes modificados

- `tests/ciclo-mutacion.test.js`: `ejecutorFalso()` ofrece cobertura (`o` + `conComando`) y tres ejecutores envueltos usan `{ ...base, test }`: con `exigir`, un ejecutor falso sin cobertura ya no da éxito.
- `tests/mutacion-lineas-cambiadas.test.js`: el ejecutor del ciclo con `exigir` ofrece cobertura.
- `tests/mutacion-revision.test.js`: el spec ya no es `prueba` (N4-06) y el TAP necesita su resumen; las carpetas de prueba del barrido usan un pid muerto, y una de proceso vivo antigua ya no se borra (N4-02).
- `tests/corte-real.test.js` y `tests/fixtures/forge-docker-falso.mjs`: marca real (N4-01); el Docker falso ejecuta el comando pedido (`--entrypoint node` con TAP y cobertura) y la ejecución del corte a mitad de medición pasa de la 5 a la 6 (la cobertura es la 4).

### Lo que queda sin hacer o sin comprobar

- ❌ N-02 en su forma de cables trampa dentro de funciones: sin solución con cobertura; haría falta distinguir fallos de aserción de excepciones o revisión humana.
- ⚠️ `go test` con cobertura: el analizador y el comando se prueban con salidas escritas a mano, **no** con Docker real (la compilación de Go tarda ~13 min por caso).
- ⚠️ jest y vitest sin cobertura (exigirían dependencias que no se instalan).
- ⚠️ La cobertura añade una ejecución por medición (un contenedor más).
- ⚠️ `forge status` se probó por su función `textoMutacion`, no lanzando el comando.
- ⚠️ N4-10: no se acotó a la ventana de contexto real de cada modelo, solo a 2 000 000.
