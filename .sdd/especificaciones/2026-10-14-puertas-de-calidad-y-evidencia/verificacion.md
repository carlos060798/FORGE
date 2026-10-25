# Verificación: puertas-de-calidad-y-evidencia

> **Fecha:** 2026-10-24 · **Rama:** `feature/motor-agentico` · **Generado** leyendo `spec.md`, `tareas.md` y `tests/` (no ejecuta nada).

## Cómo leerlo

Un criterio figura como **con prueba citada** cuando algún archivo de prueba de esta especificación contiene su identificador (**exacta**) o lo abarca con un rango como «CA-001-01 a CA-001-05» o «CA-001-xx» (**por rango**, más débil: no prueba que ese criterio concreto se compruebe). Eso **no demuestra** que la prueba compruebe el criterio, solo que alguien la enlazó; la calidad de la prueba la mide la mutación. Un criterio **sin prueba citada** puede estar cubierto por una prueba que no lo nombra: en ese caso falta el enlace, no necesariamente la prueba. La columna «Marcado en la spec» es lo que dice el propio `spec.md`, sin contrastar.

## Resumen

- Criterios: 33 · cita exacta: 19 · solo por rango («CA-001-01 a CA-001-05» o «CA-001-xx»): 2 · sin cita: 12.
- Archivos de prueba atribuidos a esta especificación (nombran su carpeta o su nombre): 12.

## Criterio → pruebas

| Criterio | Marcado en la spec | Cita | Pruebas |
|---|---|---|---|
| CA-001-01 | sí | exacta | `tests/criterios-matriz.test.js`, `tests/puertas-config.test.js`, `tests/puertas-sandbox-grafo.test.js`, `tests/puertas-verificar.test.js` (rango) |
| CA-001-02 | sí | exacta | `tests/criterios-matriz.test.js`, `tests/puertas-config.test.js`, `tests/puertas-verificar.test.js` (rango) |
| CA-001-03 | sí | exacta | `tests/puertas-config.test.js`, `tests/puertas-verificar.test.js` (rango) |
| CA-001-04 | sí | exacta | `tests/puertas-config.test.js`, `tests/puertas-sandbox-grafo.test.js`, `tests/puertas-verificar.test.js` |
| CA-001-05 | sí | exacta | `tests/puertas-config.test.js`, `tests/puertas-verificar.test.js` (rango) |
| CA-002-01 | sí | exacta | `tests/criterios-matriz.test.js`, `tests/puertas-verificar.test.js` |
| CA-002-02 | sí | por rango | `tests/puertas-verificar.test.js` (rango) |
| CA-002-03 | sí | exacta | `tests/criterios-matriz.test.js`, `tests/puertas-verificar.test.js` (rango) |
| CA-002-04 | sí | por rango | `tests/puertas-verificar.test.js` (rango) |
| CA-002-05 | sí | exacta | `tests/puertas-verificar.test.js` |
| CA-002-06 | no | **ninguna** | — |
| CA-002-07 | sí | exacta | `tests/puertas-verificar.test.js` |
| CA-003-01 | no | exacta | `tests/criterios-matriz.test.js` |
| CA-003-02 | no | exacta | `tests/criterios-matriz.test.js` |
| CA-003-03 | no | exacta | `tests/criterios-matriz.test.js` |
| CA-003-04 | no | exacta | `tests/criterios-matriz.test.js` |
| CA-003-05 | no | exacta | `tests/criterios-matriz.test.js` |
| CA-004-01 | no | **ninguna** | — |
| CA-004-02 | no | **ninguna** | — |
| CA-004-03 | no | **ninguna** | — |
| CA-004-04 | no | **ninguna** | — |
| CA-004-05 | no | **ninguna** | — |
| CA-004-06 | no | **ninguna** | — |
| CA-005-01 | no | **ninguna** | — |
| CA-005-02 | no | **ninguna** | — |
| CA-005-03 | no | **ninguna** | — |
| CA-005-04 | no | **ninguna** | — |
| CA-005-05 | no | **ninguna** | — |
| CA-006-01 | no | exacta | `tests/regresion-no-cambiar.test.js` |
| CA-006-02 | no | exacta | `tests/regresion-no-cambiar.test.js` |
| CA-006-03 | no | exacta | `tests/regresion-no-cambiar.test.js` |
| CA-006-04 | no | exacta | `tests/regresion-no-cambiar.test.js` |
| CA-006-05 | no | exacta | `tests/regresion-no-cambiar.test.js` |

## Sin cerrar

- **F6.7** (fase siguiente) Candado de proyecto (`ciclo/candado.js`) al leer la cabeza y escribir; `ciclo:llamada`/`modeloServido` para poblar `modelos`; `DockerCli.identidadImagen` en `prepararImagen`.
- **F8.2** Con Docker real, una puerta de tipos y otra de linter (`FORGE_TEST_DOCKER=1`).
- **F8.3** Documentación: `docs/ciclo-verificado.md`, guía, `README.md`, `CHANGELOG.md`, ayuda.
- **F8.4** Suite completa en Windows y en el contenedor Linux; tipos en 0.
- **F8.5** Revisión independiente (ver `plan.md`, sección 9); hallazgos altos corregidos.
- **F8.6** `verificacion.md` con cada criterio y su prueba.

## Límites de este documento

- No hay revisión independiente registrada aquí: si `tareas.md` la lista como abierta, sigue abierta.
- Las pruebas con Docker real (`FORGE_TEST_DOCKER=1`) no se ejecutan en este equipo; lo que dependa de ellas está medido solo con el Docker falso.
- Regenerar este archivo con el mismo método no sustituye leer los criterios sin prueba citada.
