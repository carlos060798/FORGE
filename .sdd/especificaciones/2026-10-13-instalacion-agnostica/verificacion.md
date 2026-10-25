# Verificación: instalacion-agnostica

> **Fecha:** 2026-10-24 · **Rama:** `feature/motor-agentico` · **Generado** leyendo `spec.md`, `tareas.md` y `tests/` (no ejecuta nada).

## Cómo leerlo

Un criterio figura como **con prueba citada** cuando algún archivo de prueba de esta especificación contiene su identificador (**exacta**) o lo abarca con un rango como «CA-001-01 a CA-001-05» o «CA-001-xx» (**por rango**, más débil: no prueba que ese criterio concreto se compruebe). Eso **no demuestra** que la prueba compruebe el criterio, solo que alguien la enlazó; la calidad de la prueba la mide la mutación. Un criterio **sin prueba citada** puede estar cubierto por una prueba que no lo nombra: en ese caso falta el enlace, no necesariamente la prueba. La columna «Marcado en la spec» es lo que dice el propio `spec.md`, sin contrastar.

## Resumen

- Criterios: 18 · cita exacta: 2 · solo por rango («CA-001-01 a CA-001-05» o «CA-001-xx»): 0 · sin cita: 16.
- Archivos de prueba atribuidos a esta especificación (nombran su carpeta o su nombre): 4.

## Criterio → pruebas

| Criterio | Marcado en la spec | Cita | Pruebas |
|---|---|---|---|
| CA-001-01 | no | **ninguna** | — |
| CA-001-02 | no | **ninguna** | — |
| CA-001-03 | no | **ninguna** | — |
| CA-001-04 | no | **ninguna** | — |
| CA-001-05 | no | exacta | `tests/instalacion-integraciones.test.js` |
| CA-001-06 | no | **ninguna** | — |
| CA-001-07 | no | **ninguna** | — |
| CA-002-01 | no | exacta | `tests/instalacion-equivalencia.test.js` |
| CA-002-02 | no | **ninguna** | — |
| CA-002-03 | no | **ninguna** | — |
| CA-003-01 | no | **ninguna** | — |
| CA-003-02 | no | **ninguna** | — |
| CA-003-03 | no | **ninguna** | — |
| CA-003-04 | no | **ninguna** | — |
| CA-004-01 | no | **ninguna** | — |
| CA-004-02 | no | **ninguna** | — |
| CA-004-03 | no | **ninguna** | — |
| CA-004-04 | no | **ninguna** | — |

## Sin cerrar

- **F4.1** Dos filas nuevas en la tabla, solo con carpeta confirmada en S0.1. Cubre CA-001-07.
- **F4.2** Prueba manual por herramienta, registrada en `verificacion.md`: instalar, invocar una skill y anotar el resultado.
- **F5.3** Suite completa en Windows y en el contenedor Linux; tipos en 0.
- **F5.4** `verificacion.md` con cada criterio y su prueba.

## Límites de este documento

- No hay revisión independiente registrada aquí: si `tareas.md` la lista como abierta, sigue abierta.
- Las pruebas con Docker real (`FORGE_TEST_DOCKER=1`) no se ejecutan en este equipo; lo que dependa de ellas está medido solo con el Docker falso.
- Regenerar este archivo con el mismo método no sustituye leer los criterios sin prueba citada.
