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
| H5 | Los precios de la tabla no están contrastados con lo facturado. | `core/session-budget.js:7-11` | **Abierto** (ADR-19, CA-003-02) |
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
