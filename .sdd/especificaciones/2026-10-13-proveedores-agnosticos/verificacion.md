# Verificación: proveedores-agnosticos

> **Fecha:** 2026-10-24 · **Rama:** `feature/motor-agentico` · **Generado** leyendo `spec.md`, `tareas.md` y `tests/` (no ejecuta nada).

## Cómo leerlo

Un criterio figura como **con prueba citada** cuando algún archivo de prueba de esta especificación contiene su identificador (**exacta**) o lo abarca con un rango como «CA-001-01 a CA-001-05» o «CA-001-xx» (**por rango**, más débil: no prueba que ese criterio concreto se compruebe). Eso **no demuestra** que la prueba compruebe el criterio, solo que alguien la enlazó; la calidad de la prueba la mide la mutación. Un criterio **sin prueba citada** puede estar cubierto por una prueba que no lo nombra: en ese caso falta el enlace, no necesariamente la prueba. La columna «Marcado en la spec» es lo que dice el propio `spec.md`, sin contrastar. Los identificadores `CA-xxx-yy` se repiten entre especificaciones: solo se atribuye un archivo de prueba a esta si la nombra en su cabecera (primeras 40 líneas) o en su nombre, y aun así una cita exacta en un archivo compartido puede ser de otro criterio. Además hay pruebas que cubren un criterio sin nombrarlo (p. ej. `tests/integration.test.js` para el binario `fragua`): el recuento de «ninguna» es un máximo, no una medida de falta de pruebas.

## Resumen

- Criterios: 25 · cita exacta: 16 · solo por rango («CA-001-01 a CA-001-05» o «CA-001-xx»): 0 · sin cita: 9.
- Archivos de prueba atribuidos a esta especificación (nombran su carpeta o su nombre): 9.

## Criterio → pruebas

| Criterio | Marcado en la spec | Cita | Pruebas |
|---|---|---|---|
| CA-001-01 | no | **ninguna** | — |
| CA-001-02 | no | **ninguna** | — |
| CA-001-03 | no | **ninguna** | — |
| CA-001-04 | no | exacta | `tests/proveedores-conformidad.test.js` |
| CA-001-05 | no | **ninguna** | — |
| CA-002-01 | no | **ninguna** | — |
| CA-002-02 | no | exacta | `tests/openai-conversar.test.js` |
| CA-002-03 | no | exacta | `tests/openai-conversar.test.js` |
| CA-002-04 | no | **ninguna** | — |
| CA-002-05 | no | exacta | `tests/openai-conversar.test.js` |
| CA-002-06 | no | exacta | `tests/openai-conversar.test.js` |
| CA-003-01 | no | exacta | `tests/ollama-conversar.test.js` |
| CA-003-02 | no | exacta | `tests/ollama-conversar.test.js` |
| CA-004-01 | no | exacta | `tests/gasto-destino-y-sin-precio.test.js`, `tests/gasto-sin-precio.test.js`, `tests/precios-openai-cache.test.js` |
| CA-004-02 | no | exacta | `tests/gasto-sin-precio.test.js` |
| CA-004-03 | no | exacta | `tests/gasto-destino-y-sin-precio.test.js` |
| CA-004-04 | no | exacta | `tests/precios-openai-cache.test.js` |
| CA-004-05 | no | exacta | `tests/precios-openai-cache.test.js` |
| CA-005-01 | no | exacta | `tests/niveles.test.js` |
| CA-005-02 | no | exacta | `tests/niveles.test.js` |
| CA-005-03 | no | exacta | `tests/niveles.test.js` |
| CA-005-04 | no | **ninguna** | — |
| CA-006-01 | no | exacta | `tests/pruebas-independientes-opciones.test.js` |
| CA-006-02 | no | **ninguna** | — |
| CA-006-03 | no | **ninguna** | — |
| CA-007-01 | no (borrador) | exacta por nombre de prueba, no por id | `tests/proveedores-conformidad.test.js` (entrada `gemini`: `complete` y `conversar` contra servidor falso), `tests/gemini-provider.test.js` («la petición»). **Con prueba (servidor falso). Sin probar con la API real** |
| CA-007-02 | no (borrador) | sin id citado | `tests/gemini-provider.test.js` («gemini y google se reconocen y crean un GeminiProvider»); el nombre inválido lo cubren las pruebas de `ErrorProveedorDesconocido`. **Con prueba** |
| CA-007-03 | no (borrador) | sin id citado | `tests/gemini-provider.test.js` («detección por credenciales: Gemini va al final...», «la clave se lee de GEMINI_API_KEY y, si no, de GOOGLE_API_KEY»). **Con prueba** |
| CA-007-04 | no (borrador) | sin id citado | `tests/gemini-provider.test.js` («ids por llamada y resultados»), `tests/proveedores-conformidad.test.js` (`idsEnResultados`). **Con prueba (servidor falso)** |
| CA-007-05 | no (borrador) | sin id citado | `tests/gemini-provider.test.js` («firma de pensamiento (thoughtSignature)», 4 pruebas), `tests/proveedores-conformidad.test.js` (`opaco: 'devuelve'`). **Con prueba (servidor falso)**; que la API real exija o acepte la firma así, **sin probar** |
| CA-007-06 | no (borrador) | sin id citado | `tests/gemini-provider.test.js` («nombres de herramienta», 2 pruebas). **Con prueba (servidor falso)** |
| CA-007-07 | no (borrador) | sin id citado | `tests/gemini-provider.test.js` («el error HTTP no deja la clave ni en el mensaje», «un error de red tampoco la deja», «paradas, tokens y bloqueos»), `tests/proveedores-conformidad.test.js` (`errorServidor`, `cancelacion`). **Con prueba (servidor falso)**; los códigos de error reales de Google, **sin probar** |
| CA-007-08 | no (borrador) | sin id citado | `tests/gemini-provider.test.js` («los niveles resuelven a un modelo de Gemini...», «los modelos por defecto tienen precio en la tabla incluida»). **Con prueba.** Que los modelos fijados existan y que los precios coincidan con la factura: **sin probar con la API real** |
| CA-007-09 | no (borrador) | **ninguna** | Solo documentación (`docs/ESTADO-ACTUAL.md`, `docs/configuration.md`, `docs/guia-anadir-proveedor.md`, `docs/limitations.md`, `docs/roadmap.md`). **Sin prueba automática; cumplido mientras el kit con clave real no se ejecute** |

## HU-007 (Gemini, añadida el 2026-11-26)

Las nueve filas CA-007 de la tabla se escribieron a mano el 2026-11-26 leyendo `spec.md`, `tests/gemini-provider.test.js` y `tests/proveedores-conformidad.test.js`; no están en el recuento del resumen de arriba, que es del 2026-10-24. **Ningún criterio de HU-007 se ha probado con la API real de Gemini**: el kit de pruebas independientes (`fragua probar-modelo` con `GEMINI_API_KEY`) está sin ejecutar y es una tarea del dueño. ADR-27 sigue en propuesta.

## Sin cerrar

> Copiado de `tareas.md` el 2026-10-25: puede estar desactualizado; manda `tareas.md`.

- **F6.2** **(Dueño)** Tres proyectos con un segundo proveedor real, con tope; evidencia en la carpeta. Cubre CA-006-02.
- **HU-007 con la API real** **(Dueño)**: ejecutar `fragua probar-modelo` con una clave de Gemini y anotar modelo y errores (guion en `2026-11-10-metodologia-agnostica/verificacion.md`, apartado Gemini).
- **F6.3** Documentación coherente con lo que se haya probado. Cubre CA-006-03.
- **F7.1** Documentación: guía, `configuration.md`, `CHANGELOG.md`.
- **F7.2** Suite completa en Windows y en el contenedor Linux; tipos en 0.
- **F7.3** Revisión independiente de gasto y credenciales; hallazgos altos corregidos.
- **F7.4** `verificacion.md` con cada criterio y su prueba.

## Límites de este documento

- No hay revisión independiente registrada aquí: si `tareas.md` la lista como abierta, sigue abierta.
- Las pruebas con Docker real (`FORGE_TEST_DOCKER=1`) no se ejecutan en este equipo; lo que dependa de ellas está medido solo con el Docker falso.
- Regenerar este archivo con el mismo método no sustituye leer los criterios sin prueba citada.
