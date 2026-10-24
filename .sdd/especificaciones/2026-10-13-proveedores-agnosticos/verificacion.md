# Verificación: proveedores-agnosticos

> **Fecha:** 2026-10-24 · **Rama:** `feature/motor-agentico` · **Generado** leyendo `spec.md`, `tareas.md` y `tests/` (no ejecuta nada).

## Cómo leerlo

Un criterio figura como **con prueba citada** cuando algún archivo de prueba de esta especificación contiene su identificador. Eso **no demuestra** que la prueba compruebe el criterio, solo que alguien la enlazó; la calidad de la prueba la mide la mutación. Un criterio **sin prueba citada** puede estar cubierto por una prueba que no lo nombra: en ese caso falta el enlace, no necesariamente la prueba. La columna «Marcado en la spec» es lo que dice el propio `spec.md`, sin contrastar.

## Resumen

- Criterios: 25 · con prueba citada: 19 · sin prueba citada: 6.
- Archivos de prueba atribuidos a esta especificación (nombran su carpeta o su nombre): 10.

## Criterio → pruebas

| Criterio | Marcado en la spec | Prueba citada | Pruebas |
|---|---|---|---|
| CA-001-01 | no | **no** | — |
| CA-001-02 | no | **no** | — |
| CA-001-03 | no | **no** | — |
| CA-001-04 | no | sí | `tests/ciclo-turnos.test.js`, `tests/proveedores-conformidad.test.js` |
| CA-001-05 | no | **no** | — |
| CA-002-01 | no | **no** | — |
| CA-002-02 | no | sí | `tests/openai-conversar.test.js` |
| CA-002-03 | no | sí | `tests/ciclo-turnos.test.js`, `tests/openai-conversar.test.js` |
| CA-002-04 | no | sí | `tests/ciclo-turnos.test.js` |
| CA-002-05 | no | sí | `tests/openai-conversar.test.js` |
| CA-002-06 | no | sí | `tests/openai-conversar.test.js` |
| CA-003-01 | no | sí | `tests/ciclo-turnos.test.js`, `tests/ollama-conversar.test.js` |
| CA-003-02 | no | sí | `tests/ciclo-turnos.test.js`, `tests/ollama-conversar.test.js` |
| CA-004-01 | no | sí | `tests/ciclo-turnos.test.js`, `tests/gasto-destino-y-sin-precio.test.js`, `tests/gasto-sin-precio.test.js`, `tests/precios-openai-cache.test.js` |
| CA-004-02 | no | sí | `tests/ciclo-turnos.test.js`, `tests/gasto-sin-precio.test.js` |
| CA-004-03 | no | sí | `tests/ciclo-turnos.test.js`, `tests/gasto-destino-y-sin-precio.test.js` |
| CA-004-04 | no | sí | `tests/ciclo-turnos.test.js`, `tests/precios-openai-cache.test.js` |
| CA-004-05 | no | sí | `tests/precios-openai-cache.test.js` |
| CA-005-01 | no | sí | `tests/ciclo-turnos.test.js`, `tests/niveles.test.js` |
| CA-005-02 | no | sí | `tests/niveles.test.js` |
| CA-005-03 | no | sí | `tests/ciclo-turnos.test.js`, `tests/niveles.test.js` |
| CA-005-04 | no | **no** | — |
| CA-006-01 | no | sí | `tests/ciclo-turnos.test.js`, `tests/pruebas-independientes-opciones.test.js` |
| CA-006-02 | no | sí | `tests/ciclo-turnos.test.js` |
| CA-006-03 | no | sí | `tests/ciclo-turnos.test.js` |

## Sin cerrar

- **F6.2** **(Dueño)** Tres proyectos con un segundo proveedor real, con tope; evidencia en la carpeta. Cubre CA-006-02.
- **F6.3** Documentación coherente con lo que se haya probado. Cubre CA-006-03.
- **F7.1** Documentación: guía, `configuration.md`, `CHANGELOG.md`.
- **F7.2** Suite completa en Windows y en el contenedor Linux; tipos en 0.
- **F7.3** Revisión independiente de gasto y credenciales; hallazgos altos corregidos.
- **F7.4** `verificacion.md` con cada criterio y su prueba.

## Límites de este documento

- No hay revisión independiente registrada aquí: si `tareas.md` la lista como abierta, sigue abierta.
- Las pruebas con Docker real (`FORGE_TEST_DOCKER=1`) no se ejecutan en este equipo; lo que dependa de ellas está medido solo con el Docker falso.
- Regenerar este archivo con el mismo método no sustituye leer los criterios sin prueba citada.
