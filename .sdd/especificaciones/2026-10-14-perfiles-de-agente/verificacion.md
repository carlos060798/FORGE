# Verificación: perfiles-de-agente

> **Fecha:** 2026-10-24 · **Rama:** `feature/motor-agentico` · **Generado** leyendo `spec.md`, `tareas.md` y `tests/` (no ejecuta nada).

## Cómo leerlo

Un criterio figura como **con prueba citada** cuando algún archivo de prueba de esta especificación contiene su identificador. Eso **no demuestra** que la prueba compruebe el criterio, solo que alguien la enlazó; la calidad de la prueba la mide la mutación. Un criterio **sin prueba citada** puede estar cubierto por una prueba que no lo nombra: en ese caso falta el enlace, no necesariamente la prueba. La columna «Marcado en la spec» es lo que dice el propio `spec.md`, sin contrastar.

## Resumen

- Criterios: 23 · con prueba citada: 4 · sin prueba citada: 19.
- Archivos de prueba atribuidos a esta especificación (nombran su carpeta o su nombre): 8.

## Criterio → pruebas

| Criterio | Marcado en la spec | Prueba citada | Pruebas |
|---|---|---|---|
| CA-001-01 | no | **no** | — |
| CA-001-02 | no | sí | `tests/agent-cabecera-tools.test.js`, `tests/ciclo-perfiles-validacion.test.js` |
| CA-001-03 | no | sí | `tests/agent-cabecera-tools.test.js` |
| CA-001-04 | no | **no** | — |
| CA-002-01 | no | **no** | — |
| CA-002-02 | no | **no** | — |
| CA-002-03 | no | **no** | — |
| CA-002-04 | no | **no** | — |
| CA-002-05 | no | **no** | — |
| CA-003-01 | no | **no** | — |
| CA-003-02 | no | **no** | — |
| CA-003-03 | no | **no** | — |
| CA-003-04 | no | **no** | — |
| CA-003-05 | no | **no** | — |
| CA-004-01 | no | **no** | — |
| CA-004-02 | no | **no** | — |
| CA-004-03 | no | **no** | — |
| CA-004-04 | no | **no** | — |
| CA-005-01 | no | **no** | — |
| CA-005-02 | no | **no** | — |
| CA-005-03 | no | **no** | — |
| CA-005-04 | no | sí | `tests/ciclo-regresion-verificada.test.js` |
| CA-005-05 | no | sí | `tests/ciclo-regresion-verificada.test.js` |

## Sin cerrar

- **F6.1** `forge agentes perfil` y aviso en `doctor`. Cubre CA-001-04.
- **F6.2** Documentación: guía, `README.md`, `CHANGELOG.md`; renombrar el concepto «tools» como solicitud.
- **F7.1** Suite completa en Windows y en el contenedor Linux; tipos en 0.
- **F7.2** Revisión independiente; hallazgos altos corregidos.
- **F7.3** `verificacion.md` con cada criterio y su prueba.
- **F7.4** Segunda entrega (aparte): resto del catálogo según `docs/ADECUACION-DEL-CATALOGO.md` §4.

## Límites de este documento

- No hay revisión independiente registrada aquí: si `tareas.md` la lista como abierta, sigue abierta.
- Las pruebas con Docker real (`FORGE_TEST_DOCKER=1`) no se ejecutan en este equipo; lo que dependa de ellas está medido solo con el Docker falso.
- Regenerar este archivo con el mismo método no sustituye leer los criterios sin prueba citada.
