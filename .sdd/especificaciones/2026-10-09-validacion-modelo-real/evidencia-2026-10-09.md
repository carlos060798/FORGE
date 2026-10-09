# Evidencia: primeras ejecuciones del ciclo con un modelo real

> Fecha: 2026-10-09 · Windows 11, Docker 29.7.2, Node 24.20 · rama `feature/motor-agentico`
> Proveedor: Anthropic por API. Autor: Claude, a petición del dueño.
> **Alcance:** ocho ejecuciones de una tarea cada una, en tres rondas. Es una primera evidencia, no la validación completa que pide la spec: falta comparar el gasto calculado con el facturado (CA-003-01) y la revisión independiente (HU-004).

## Ronda 1 — sobre el código tal como estaba

| # | Tarea | Lenguaje | Modelos | Resultado | Iteraciones | Llamadas | Gasto calculado |
|---|---|---|---|---|---|---|---|
| 1 | `suma` (la de `forge probar-modelo`) | JavaScript | económico | éxito | 1 | 3 | 0,0102 USD |
| 2 | Clase `Carrito` con cinco reglas | JavaScript | los de cada agente | éxito | 1 | 3 | 0,1928 USD |
| 3 | `a_romano`, sin `pytest.ini` | Python | los de cada agente | revisión por iteraciones | 5 | 7 | 0,2482 USD |
| 4 | `a_romano`, con `pytest.ini` | Python | económico | éxito | 1 | 3 | 0,0424 USD |

En las ejecuciones 1 y 4 el nivel económico se forzó desde fuera del repo. En la 2 y la 3 ese forzado no se aplicó por un error mío en una ruta y se usaron los modelos que declara cada agente, aunque el dueño había pedido modelos baratos.

## Ronda 2 — tras corregir H1 a H4, con `FORGE_NIVEL_MAXIMO=haiku`

| # | Tarea | Lenguaje | Resultado | Iteraciones | Llamadas | Gasto calculado |
|---|---|---|---|---|---|---|
| 5 | `a_romano`, con `pytest` solo en `requirements.txt` | Python | éxito | 1 | 3 | 0,0307 USD |
| 6 | `a_romano`, sin pytest declarado (unittest) | Python | revisión por infraestructura, antes de implementar | 0 | 2 | 0,0241 USD |
| 7 | Evaluador de expresiones (`calc`), 20 casos o más | JavaScript | revisión por presupuesto | 5 | 7 | 0,1570 USD |

## Ronda 3 — tras corregir H6 y H7

| # | Tarea | Lenguaje | Resultado | Iteraciones | Llamadas | Gasto calculado |
|---|---|---|---|---|---|---|
| 8 | La misma de la ejecución 7 | JavaScript | **éxito** | 3 | 5 | 0,0969 USD |

Evolución de la ejecución 8: 26 de 27 pruebas, 26 de 27, 27 de 27. Es la primera vez que se observa al bucle de corrección converger con un modelo real.

Gasto calculado total de las ocho ejecuciones de ciclo: 0,80 USD. **No está comparado con lo facturado.**

## Lo que demuestra

- **El formato se cumple.** Las 33 respuestas se interpretaron al primer intento. Ninguna revisión por `salida_invalida`.
- **Los identificadores de modelo actuales siguen respondiendo**, en los tres niveles.
- **El confinamiento por rol funciona con un modelo real.** El agente de pruebas intentó escribir la implementación y el implementador intentó reescribir las pruebas, varias veces. Todas las escrituras se rechazaron y quedaron registradas.
- **El tope de gasto se respetó** en todas; en la 7 detuvo la tarea.
- **El bucle de corrección converge** (ejecución 8).

## Hallazgos

| # | Hallazgo | Evidencia | Estado |
|---|---|---|---|
| H1 | Un proyecto Python con `pytest` solo en `requirements.txt` se probaba con `unittest discover`, que no encuentra pruebas en `tests/` sin `__init__.py`. No podía pasar nunca. | Ejecución 3 | **Corregido** (`core/stack-detector.js`, `core/runners/python-runner.js`). Comprobado con la ejecución 5 |
| H2 | «Ninguna prueba ejecutada» (código 5) se trataba como fallo del implementador: gastó las 5 iteraciones, las tres últimas con llamadas idénticas. | Ejecución 3 | **Corregido** (`core/ciclo/router.js`, `nodos.js`): revisión inmediata, sin gastar iteraciones. Comprobado con la ejecución 6: 2 llamadas en lugar de 7 |
| H3 | El implementador devolvía también las pruebas, que se rechazaban, y el agente de pruebas escribía la implementación. Tokens de salida pagados para nada. | Ejecuciones 1, 4, 5 | **Mitigado** en los contratos. En la ejecución 8 el implementador ya no las devolvió; el agente de pruebas siguió intentando escribir la implementación |
| H4 | No se podía elegir el nivel de modelo sin editar los agentes. | — | **Corregido**: `motor.nivel_maximo` y `FORGE_NIVEL_MAXIMO`. ADR-19 sigue en propuesta para modelos y precios |
| H5 | Los precios de la tabla no están contrastados con lo facturado. | `core/session-budget.js:7-11` | **Corregido en parte** (ADR-19 aceptada). La tabla (`core/precios.js`) se contrastó el 2026-10-09 con la tarifa publicada (https://platform.claude.com/docs/en/about-claude/pricing) y dos precios estaban mal: `claude-opus-4-8` se cobraba a 15/75 y cuesta 5/25; `claude-haiku-4-5-20251001` se cobraba a 0,80/4 y cuesta 1/5. **El gasto de las ejecuciones de este informe se calculó con la tabla antigua**: lo hecho con el nivel económico está infravalorado un 20 % y lo hecho con el nivel alto, sobrevalorado. **Sigue abierto** contrastar con lo realmente facturado (CA-003-02): no se ha hecho ninguna llamada de pago para ello |
| H6 | Los agentes no sabían qué sistema de módulos usa el proyecto. El agente de pruebas escribió `require` en un proyecto de módulos ES: el archivo de pruebas no cargaba y ninguna implementación podía pasar. | Ejecución 7 | **Corregido**: sección «Proyecto» en los prompts (`seccionProyecto`). Comprobado con la ejecución 8 |
| H7 | Al corregir, el implementador no recibía su propia versión anterior: solo el fallo. Reescribía a ciegas. | Ejecución 7: contexto vacío, tokens de entrada idénticos en cuatro iteraciones | **Corregido**: sección «Tu implementación actual» |
| H8 | Unas pruebas rotas por sí mismas gastan todas las iteraciones: el implementador no puede tocarlas y no hay detección de «sin progreso». | Ejecución 7 | **Corregido** (`core/ciclo/huella.js`, `router.js`, `grafo.js`, `nodos.js`): tres ejecuciones fallidas seguidas con la misma salida pausan la tarea con el motivo `sin_progreso`, y `continuar` vuelve al agente de pruebas. Configurable con `motor.sin_progreso` (0 lo desactiva). Cambia cuándo se pide revisión. Comprobado con pruebas automáticas (`tests/ciclo-sin-progreso.test.js`); falta repetir la ejecución 7 con un modelo real |
| H9 | El planificador devolvió `archivosObjetivo` vacío, de modo que el recuperador no aportó ningún contexto. | Ejecución 7 | **Abierto.** Lo compensa H7 para el implementador, no para el agente de pruebas |

Regresión: `tests/validacion-modelo-real.test.js` (20 pruebas) y, para H8, `tests/ciclo-sin-progreso.test.js` (32 pruebas).

## Lo que no demuestra

- Go no se probó.
- Todas las tareas fueron de un solo archivo en un proyecto vacío. No hay evidencia sobre código existente ni sobre tareas de varios archivos.
- Casi todo se ejecutó con el nivel económico. Los niveles altos solo se usaron en las ejecuciones 2 y 3.
- El job `aislamiento` de CI no se ejecutó: el flujo solo se dispara en `main`, `master`, `develop` y en solicitudes de cambio.

---

# Segunda jornada de ejecuciones (2026-10-09, tarde)

> Añadido tras integrar H8 (sin progreso), ADR-19 (precios) y las correcciones de la revisión independiente. Lo de arriba describe la primera jornada y se conserva como estaba; donde dice «Go no se probó» o «todas las tareas fueron de un solo archivo», ya no es cierto: ver abajo.

## Ronda 4 — flujos que nunca se habían ejecutado con un modelo real

Nivel económico salvo donde se indica. Gasto calculado con la tabla anterior a ADR-19.

| # | Qué se probó | Resultado | Iteraciones | Llamadas | Gasto calculado |
|---|---|---|---|---|---|
| 9 | Proyecto JavaScript **con código existente**, cambio en **dos archivos** nombrados por la tarea | éxito | 2 (1 de 2 pruebas, luego 12 de 12) | 5 | 0,0605 USD |
| 10 | **Go**, nivel económico | revisión por iteraciones | 5 | 8 | 0,0689 USD |
| 11 | **Go**, nivel medio | éxito | 1 | 3 | 0,0752 USD |
| 12 | **Corte y reanudación**: proceso matado a los 12 s, tras la primera llamada pagada | éxito al reanudar | 1 | 3 en total | 0,0167 USD |
| 13 | **Tope mínimo** (0,012 USD) → pausa por presupuesto → `continuar --presupuesto-extra` | éxito tras continuar | 3 (18, 19 y 22 de 22 pruebas) | 6 | 0,0406 USD |

- **12:** la llamada pagada antes del corte no se repitió: el libro de gasto tiene tres líneas, no cuatro, y el tope de la sesión se conservó.
- **10:** el ciclo funcionó (devolvió al implementador un error de compilación y una dependencia inexistente, y los corrigió), pero el agente de pruebas del nivel económico escribió valores esperados erróneos (`Invertir("hola mundo")` «debía» dar `"odnum alohan"`). Ninguna implementación correcta puede pasar unas pruebas equivocadas. Con el nivel medio (11) la misma tarea pasó a la primera.

## Ronda 5 — sobre el código final (commit `3da91d3`)

Gasto calculado con la tabla de ADR-19.

| # | Qué se probó | Resultado | Iteraciones | Llamadas | Gasto calculado |
|---|---|---|---|---|---|
| 14 | Python con `pytest` solo en `requirements-dev.txt` | **el ciclo se niega a empezar** y dice qué añadir | — | 0 | 0 USD |
| 15 | Proyecto existente, la tarea **no nombra archivos** | éxito (15 de 15 pruebas, incluidas las que ya había) | 1 | 3 | 0,0454 USD |
| 16 | **Dos tareas encadenadas** en una sesión; la segunda usa el módulo de la primera | T1 éxito; T2 **pausa por sin progreso**, dos veces | 1 y 6 | 13 | 0,2220 USD |
| 17 | `forge probar-modelo` **con los niveles por defecto** (alto, medio, medio) | éxito | 1 | 3 | 0,0470 USD |

- **14** confirma R1 corregido: antes habría gastado siete llamadas.
- **15:** el planificador devolvió otra vez `archivosObjetivo` vacío, pero ahora el agente de pruebas y el implementador recibieron el mapa del proyecto (H9) y la tarea pasó sin romper las pruebas existentes.
- **16:** es la primera vez que la detección de «sin progreso» (H8) actúa con un modelo real. T2 falló tres veces con la misma salida (60 de 62 pruebas) y se pausó en la tercera en lugar de la quinta. Con `continuar`, el agente de pruebas reescribió sus pruebas (66 en total) y el implementador volvió a quedarse en 62 de 66, tres veces. La pausa es correcta; que el nivel económico no resuelva la tarea es el mismo límite que en la ejecución 10.

**Gasto calculado total de las 17 ejecuciones: unos 1,38 USD**, sumando líneas calculadas con dos tablas distintas. La tabla antigua cobraba el nivel económico un 20 % por debajo del precio publicado y el nivel alto al triple. **Sigue sin compararse con lo facturado.**

## Revisión independiente del commit `bd7cd9f`

Veredicto: **RECHAZADA**, por un bloqueante. Informe completo y scripts de reproducción en `revision-independiente.md`. Respuesta, hallazgo por hallazgo:

| Id | Gravedad | Hallazgo | Estado |
|---|---|---|---|
| R1 | bloqueante | Se elegía pytest por una subcadena en seis archivos, pero la imagen solo instala `requirements.txt`: cinco iteraciones de «No module named pytest». | **Corregido** (`core/pytest-deteccion.js`): líneas reales en vez de subcadenas, y el ciclo no empieza si `requirements.txt` no instala pytest. Comprobado con la ejecución 14 |
| R2 | alta | La sección «Proyecto» leía `package.json` aunque el usuario lo hubiera protegido. | **Corregido**: pasa por `validarRuta` con las rutas protegidas |
| R3 | media | La versión anterior del implementador en el prompt cambiaba la clave del diario: un corte tras escribir pagaba la llamada dos veces. | **Corregido**: la clave ya no incluye lo que el propio nodo cambia en el disco (`clavePrompt`). Con test que corta en ese punto |
| R4 | media | El implementador podía forzar el código 5 (`os._exit(5)`) y eximirse de las iteraciones. | **Corregido**: el código 5 solo se interpreta como «sin pruebas» al escribirlas, antes de que exista implementación |
| R5 | media | Al reescribir pruebas no encontradas, el prompt era idéntico al primero. | **Corregido en parte**: el agente recibe el motivo. **Abierto**: si responde con otro nombre de archivo, el anterior queda huérfano |
| R6 | media | La versión anterior se leía sin revalidar la ruta. | **Corregido**: se revalida con las reglas de escritura |
| R7 | media | `scripts.test` entraba en el prompt con saltos de línea y sin redactar. | **Corregido**: una línea, sin cabeceras, redactado |
| R8 | media | TypeScript recibía «usa require»; un BOM hacía desaparecer la sección. | **Corregido** |
| R9 | baja | El detalle de revisión lleva el comando de pruebas sin redactar. | **Abierto** (latente: hoy los comandos son fijos) |
| R10 | baja | `nivel_maximo` mal sangrado o mal escrito queda en `opus` sin aviso; el modo clásico no lo aplica. | **Abierto** |
| R11 | baja | `aceptar` en la revisión de pruebas no encontradas completa la tarea sin implementación. | **Abierto**: es una decisión humana explícita, pero conviene avisarlo en el mensaje |
| R12 | baja | La expresión no reconoce `tox`, `make test` ni `python -mpytest`. | **Abierto** (no alcanzable desde la CLI) |

**Estas correcciones no han pasado una segunda revisión independiente.** Regresión: `tests/validacion-modelo-real.test.js` (34 pruebas).

## Estado de los hallazgos de la primera jornada

- **H8** (sin progreso): corregido y visto en acción (ejecución 16).
- **H9** (contexto vacío): corregido con el mapa del proyecto (ejecución 15).
- **H5** (precios): tabla contrastada con la tarifa publicada (ADR-19); falta compararla con lo facturado.

## Hallazgo nuevo

| # | Hallazgo | Evidencia | Estado |
|---|---|---|---|
| H10 | **Con el nivel económico, el agente de pruebas escribe a veces pruebas con valores esperados erróneos**, y el ciclo no puede distinguirlas de una implementación que falla. La detección de «sin progreso» acota el gasto, pero no lo resuelve. | Ejecuciones 10 y 16 | **Abierto.** Mitigación disponible hoy: no limitar al nivel económico el agente de pruebas. Lo trata la spec `2026-10-09-pruebas-confiables` |

## Lo que sigue sin demostrarse

- El gasto calculado frente al facturado.
- El job `aislamiento` de CI (Linux): no se ha ejecutado nunca.
- Una tarea real resuelta con el nivel alto en más de una iteración.
- Proyectos grandes: todo se probó en proyectos de pocos archivos.

## Ronda 6 — implementador por turnos frente a bloque (commit `075e38d`)

La misma tarea en los dos modos, con el nivel económico y un tope de 0,35 USD: en un archivo de 1812 líneas (52 KB, 151 funciones), cambiar **solo** la función `precioFinal` (descuento por tramos y un error nuevo) sin tocar las otras 150.

| # | Modo | Resultado | Iteraciones | Llamadas | Tokens de salida del implementador | Gasto calculado |
|---|---|---|---|---|---|---|
| 18 | `bloque` | **revisión por salida inválida** | 0 | 4 | 16 384 (dos respuestas cortadas en el máximo de 8192) | 0,1695 USD |
| 19 | `turnos` | **éxito**, 19 de 19 pruebas | 1 | 10 (8 turnos) | 2823 | 0,2052 USD |

- **18:** el implementador intentó devolver el archivo entero, las dos veces se cortó en el máximo de salida y el JSON quedó sin cerrar. En modo de bloque esta tarea **no se puede hacer**, con ningún número de iteraciones. Es la brecha C7 del plan, reproducida.
- **19:** leyó el archivo por tramos, hizo una sustitución acotada, intentó escribir una prueba (rechazado y registrado: `prueba_inmutable`), ejecutó las pruebas en el entorno aislado, releyó y terminó. Las 150 funciones restantes quedaron intactas (el archivo creció 10 líneas).
- **Costo:** los tokens de salida bajan un 83 % (criterio de la spec: al menos 50 %). El gasto total **no** baja: cada turno reenvía la conversación entera (unos 20 000 tokens de entrada por turno) y el modo por turnos no usa caché de prompts. La entrada del implementador es tres cuartas partes del gasto de la ejecución 19. La caché (FASE 9) es lo que decide si este modo sale más barato.

Es una sola tarea, con un solo modelo. Demuestra que el modo funciona de extremo a extremo con la API real y que resuelve un caso que el modo de bloque no puede; no demuestra que sea mejor en general.

Gasto calculado acumulado de las 19 ejecuciones: unos 1,75 USD.
