# Verificación: contrato-publico

> **Fecha:** 2026-10-24 · **Rama:** `feature/motor-agentico` · **Generado** leyendo `spec.md`, `tareas.md` y `tests/` (no ejecuta nada).

## Cómo leerlo

Un criterio figura como **con prueba citada** cuando algún archivo de prueba de esta especificación contiene su identificador. Eso **no demuestra** que la prueba compruebe el criterio, solo que alguien la enlazó; la calidad de la prueba la mide la mutación. Un criterio **sin prueba citada** puede estar cubierto por una prueba que no lo nombra: en ese caso falta el enlace, no necesariamente la prueba. La columna «Marcado en la spec» es lo que dice el propio `spec.md`, sin contrastar.

## Resumen

- Criterios: 22 · con prueba citada: 4 · sin prueba citada: 18.
- Archivos de prueba atribuidos a esta especificación (nombran su carpeta o su nombre): 2.

## Criterio → pruebas

| Criterio | Marcado en la spec | Prueba citada | Pruebas |
|---|---|---|---|
| CA-001-01 | no | sí | `tests/contrato-publico.test.js` |
| CA-001-02 | no | **no** | — |
| CA-001-03 | no | **no** | — |
| CA-001-04 | no | **no** | — |
| CA-001-05 | no | **no** | — |
| CA-001-06 | no | **no** | — |
| CA-001-07 | no | sí | `tests/contrato-publico.test.js` |
| CA-002-01 | no | **no** | — |
| CA-002-02 | no | **no** | — |
| CA-002-03 | no | **no** | — |
| CA-002-04 | no | **no** | — |
| CA-002-05 | no | **no** | — |
| CA-002-06 | no | **no** | — |
| CA-003-01 | no | **no** | — |
| CA-003-02 | no | **no** | — |
| CA-003-03 | no | **no** | — |
| CA-003-04 | no | sí | `tests/contrato-publico.test.js` |
| CA-003-05 | no | **no** | — |
| CA-003-06 | no | sí | `tests/contrato-publico.test.js` |
| CA-004-01 | no | **no** | — |
| CA-004-02 | no | **no** | — |
| CA-004-03 | no | **no** | — |

## Sin cerrar

- **F3.4** Prueba: versión desconocida se rechaza con mensaje que lista las admitidas. Cubre CA-003-06.
- **F6.3** Prueba: las zonas de extensión admiten campos desconocidos. Cubre CA-003-04.
- **F7.2** Comando `esquema` de solo lectura y esquemas en el paquete publicado (P2). Cubre CA-001-07.
- **F7.3** `CHANGELOG.md` y guía.
- **F8.1** Suite completa en Windows y en el contenedor Linux; tipos en 0. Cubre CA-002-06.
- **F8.2** Revisión independiente (ver `plan.md`, sección 9); hallazgos altos corregidos.
- **F8.3** `verificacion.md` con cada criterio y su prueba.

## Límites de este documento

- No hay revisión independiente registrada aquí: si `tareas.md` la lista como abierta, sigue abierta.
- Las pruebas con Docker real (`FORGE_TEST_DOCKER=1`) no se ejecutan en este equipo; lo que dependa de ellas está medido solo con el Docker falso.
- Regenerar este archivo con el mismo método no sustituye leer los criterios sin prueba citada.
