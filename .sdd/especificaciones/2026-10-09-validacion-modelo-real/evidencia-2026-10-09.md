# Evidencia: primeras ejecuciones del ciclo con un modelo real

> Fecha: 2026-10-09 · Windows 11, Docker 29.7.2 · rama `feature/motor-agentico` con cambios locales sin confirmar de otra sesión
> Proveedor: Anthropic por API. Autor: Claude, a petición del dueño.
> **Alcance:** cuatro ejecuciones, una tarea cada una. Es una primera evidencia, no la validación completa que pide la spec (3 tareas por lenguaje y comparación con el gasto facturado).

## Ejecuciones

| # | Tarea | Lenguaje | Modelos | Resultado | Iteraciones | Llamadas | Gasto calculado |
|---|---|---|---|---|---|---|---|
| 1 | `suma` (la de `forge probar-modelo`) | JavaScript | económico en los tres agentes | éxito | 1 | 3 | 0,0102 USD |
| 2 | Clase `Carrito` con cinco reglas | JavaScript | los de cada agente (alto, medio, medio) | éxito | 1 | 3 | 0,1928 USD |
| 3 | `a_romano`, sin `pytest.ini` | Python | los de cada agente | revisión por iteraciones | 5 | 7 | 0,2482 USD |
| 4 | `a_romano`, con `pytest.ini` | Python | económico en los tres agentes | éxito | 1 | 3 | 0,0424 USD |

Gasto calculado total: 0,49 USD. **No está comparado con lo facturado** (CA-003-01 sigue abierto).

El nivel económico se forzó desde fuera del repo, sustituyendo la resolución de alias del proveedor al arrancar el proceso. En las ejecuciones 2 y 3 esa sustitución no se aplicó por un error mío en la ruta, y se usaron los modelos que declara cada agente. El dueño había pedido modelos baratos.

## Lo que demuestra

- **El formato se cumple.** 16 de 16 respuestas se interpretaron al primer intento. Ninguna revisión por `salida_invalida`.
- **Los identificadores de modelo actuales siguen respondiendo**, en los tres niveles.
- **El confinamiento por rol funciona con un modelo real.** El agente de pruebas intentó escribir la implementación (ejecución 1) y el implementador intentó reescribir las pruebas (ejecuciones 1 y 4). Las dos escrituras se rechazaron y quedaron registradas.
- **Las pruebas fallaban antes de implementar** en las cuatro: no apareció el aviso `pruebas_no_fallan`.
- **El tope se respetó** en todas.

## Hallazgos

| # | Hallazgo | Evidencia | Dónde se trata |
|---|---|---|---|
| H1 | **Un proyecto Python con `requirements.txt` y sin `pytest.ini` no puede pasar nunca.** El detector elige `python -m unittest discover` aunque `requirements.txt` declare `pytest`. Ese comando no encuentra pruebas en `tests/` sin `__init__.py`: «Ran 0 tests», código 5. | Ejecución 3; `core/stack-detector.js:96-98`; `core/runners/python-runner.js:45-47` | Defecto nuevo. Corregir antes de publicar |
| H2 | **«Cero pruebas ejecutadas» se trata como un fallo del implementador.** El ciclo gastó las 5 iteraciones en algo que el implementador no puede arreglar. Las tres últimas llamadas fueron idénticas (mismos tokens de entrada y de salida). | Ejecución 3, `gasto.jsonl` | Defecto nuevo. Debería ir a revisión en la primera ejecución |
| H3 | **El implementador devuelve también las pruebas**, que se rechazan. En la ejecución 4 produjo 3215 tokens de salida para un archivo pequeño. | Ejecuciones 1 y 4 | Apoya la spec `2026-10-09-implementador-con-herramientas`; a corto plazo, afinar el contrato |
| H4 | **No hay forma de elegir el nivel de modelo sin editar los agentes.** | `core/ciclo/index.js:99` | ADR-19 |
| H5 | **Los precios de la tabla no se han contrastado.** | `core/session-budget.js:7-11` | ADR-19 y CA-003-02 |

## Lo que no demuestra

- Ninguna tarea necesitó más de una iteración con un fallo real de pruebas: el bucle de corrección con un modelo real sigue sin observarse.
- Go no se probó.
- El job `aislamiento` de CI no se ejecutó: el flujo solo se dispara en `main`, `master`, `develop` y en solicitudes de cambio.
