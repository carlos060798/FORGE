# Verificación: contrato-publico

> **Fecha:** 2026-10-24 · **Rama:** `feature/motor-agentico` · **Generado** leyendo `spec.md`, `tareas.md` y `tests/` (no ejecuta nada).

## Cómo leerlo

Un criterio figura como **con prueba citada** cuando algún archivo de prueba de esta especificación contiene su identificador (**exacta**) o lo abarca con un rango como «CA-001-01 a CA-001-05» o «CA-001-xx» (**por rango**, más débil: no prueba que ese criterio concreto se compruebe). Eso **no demuestra** que la prueba compruebe el criterio, solo que alguien la enlazó; la calidad de la prueba la mide la mutación. Un criterio **sin prueba citada** puede estar cubierto por una prueba que no lo nombra: en ese caso falta el enlace, no necesariamente la prueba. La columna «Marcado en la spec» es lo que dice el propio `spec.md`, sin contrastar. Los identificadores `CA-xxx-yy` se repiten entre especificaciones: solo se atribuye un archivo de prueba a esta si la nombra en su cabecera (primeras 40 líneas) o en su nombre, y aun así una cita exacta en un archivo compartido puede ser de otro criterio. Además hay pruebas que cubren un criterio sin nombrarlo (p. ej. `tests/integration.test.js` para el binario `fragua`): el recuento de «ninguna» es un máximo, no una medida de falta de pruebas.

## Resumen

- Criterios: 22 · cita exacta: 4 · solo por rango («CA-001-01 a CA-001-05» o «CA-001-xx»): 0 · sin cita: 18.
- Archivos de prueba atribuidos a esta especificación (nombran su carpeta o su nombre): 2.

## Criterio → pruebas

| Criterio | Marcado en la spec | Cita | Pruebas |
|---|---|---|---|
| CA-001-01 | no | exacta | `tests/contrato-publico.test.js` |
| CA-001-02 | no | **ninguna** | — |
| CA-001-03 | no | **ninguna** | — |
| CA-001-04 | no | **ninguna** | — |
| CA-001-05 | no | **ninguna** | — |
| CA-001-06 | no | **ninguna** | — |
| CA-001-07 | no | exacta | `tests/contrato-publico.test.js` |
| CA-002-01 | no | **ninguna** | — |
| CA-002-02 | no | **ninguna** | — |
| CA-002-03 | no | **ninguna** | — |
| CA-002-04 | no | **ninguna** | — |
| CA-002-05 | no | **ninguna** | — |
| CA-002-06 | no | **ninguna** | — |
| CA-003-01 | no | **ninguna** | — |
| CA-003-02 | no | **ninguna** | — |
| CA-003-03 | no | **ninguna** | — |
| CA-003-04 | no | exacta | `tests/contrato-publico.test.js` |
| CA-003-05 | no | **ninguna** | — |
| CA-003-06 | no | exacta | `tests/contrato-publico.test.js` |
| CA-004-01 | no | **ninguna** | — |
| CA-004-02 | no | **ninguna** | — |
| CA-004-03 | no | **ninguna** | — |

## Sin cerrar

> Copiado de `tareas.md` el 2026-10-25: puede estar desactualizado; manda `tareas.md`.

- **F8.1** Suite completa en Windows y en el contenedor Linux; tipos en 0. Cubre CA-002-06.
- **F8.2** Revisión independiente (ver `plan.md`, sección 9); hallazgos altos corregidos.
- **F8.3** `verificacion.md` con cada criterio y su prueba.

## Límites de este documento

- No hay revisión independiente registrada aquí: si `tareas.md` la lista como abierta, sigue abierta.
- Las pruebas con Docker real (`FORGE_TEST_DOCKER=1`) no se ejecutan en este equipo; lo que dependa de ellas está medido solo con el Docker falso.
- Regenerar este archivo con el mismo método no sustituye leer los criterios sin prueba citada.
