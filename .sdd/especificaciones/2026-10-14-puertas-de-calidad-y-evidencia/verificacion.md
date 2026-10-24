# Verificación: puertas-de-calidad-y-evidencia

> **Fecha:** 2026-10-24 · **Rama:** `feature/motor-agentico` · **Generado** leyendo `spec.md`, `tareas.md` y `tests/` (no ejecuta nada).

## Cómo leerlo

Un criterio figura como **con prueba citada** cuando algún archivo de prueba de esta especificación contiene su identificador. Eso **no demuestra** que la prueba compruebe el criterio, solo que alguien la enlazó; la calidad de la prueba la mide la mutación. Un criterio **sin prueba citada** puede estar cubierto por una prueba que no lo nombra: en ese caso falta el enlace, no necesariamente la prueba. La columna «Marcado en la spec» es lo que dice el propio `spec.md`, sin contrastar.

## Resumen

- Criterios: 33 · con prueba citada: 19 · sin prueba citada: 14.
- Archivos de prueba atribuidos a esta especificación (nombran su carpeta o su nombre): 12.

## Criterio → pruebas

| Criterio | Marcado en la spec | Prueba citada | Pruebas |
|---|---|---|---|
| CA-001-01 | sí | sí | `tests/criterios-matriz.test.js`, `tests/puertas-config.test.js`, `tests/puertas-sandbox-grafo.test.js` |
| CA-001-02 | sí | sí | `tests/criterios-matriz.test.js`, `tests/puertas-config.test.js` |
| CA-001-03 | sí | sí | `tests/puertas-config.test.js` |
| CA-001-04 | sí | sí | `tests/puertas-config.test.js`, `tests/puertas-sandbox-grafo.test.js`, `tests/puertas-verificar.test.js` |
| CA-001-05 | sí | sí | `tests/puertas-config.test.js` |
| CA-002-01 | sí | sí | `tests/criterios-matriz.test.js`, `tests/puertas-verificar.test.js` |
| CA-002-02 | sí | **no** | — |
| CA-002-03 | sí | sí | `tests/criterios-matriz.test.js` |
| CA-002-04 | sí | **no** | — |
| CA-002-05 | sí | sí | `tests/puertas-verificar.test.js` |
| CA-002-06 | no | **no** | — |
| CA-002-07 | sí | sí | `tests/puertas-verificar.test.js` |
| CA-003-01 | no | sí | `tests/criterios-matriz.test.js` |
| CA-003-02 | no | sí | `tests/criterios-matriz.test.js` |
| CA-003-03 | no | sí | `tests/criterios-matriz.test.js` |
| CA-003-04 | no | sí | `tests/criterios-matriz.test.js` |
| CA-003-05 | no | sí | `tests/criterios-matriz.test.js` |
| CA-004-01 | no | **no** | — |
| CA-004-02 | no | **no** | — |
| CA-004-03 | no | **no** | — |
| CA-004-04 | no | **no** | — |
| CA-004-05 | no | **no** | — |
| CA-004-06 | no | **no** | — |
| CA-005-01 | no | **no** | — |
| CA-005-02 | no | **no** | — |
| CA-005-03 | no | **no** | — |
| CA-005-04 | no | **no** | — |
| CA-005-05 | no | **no** | — |
| CA-006-01 | no | sí | `tests/regresion-no-cambiar.test.js` |
| CA-006-02 | no | sí | `tests/regresion-no-cambiar.test.js` |
| CA-006-03 | no | sí | `tests/regresion-no-cambiar.test.js` |
| CA-006-04 | no | sí | `tests/regresion-no-cambiar.test.js` |
| CA-006-05 | no | sí | `tests/regresion-no-cambiar.test.js` |

## Sin cerrar

- **F4.1** Prueba: extrae los `CA-xxx-yy` de una spec de ejemplo. Cubre CA-003-01.
- **F4.2** Prueba: CA sin tarea y CA con tarea sin prueba citada. Cubre CA-003-02.
- **F4.3** Prueba estática: el módulo no importa proveedores de modelo ni ejecuta procesos. Cubre CA-003-03.
- **F4.4** Salida en `forge status`/`verificar --criterios` y `--exigir-cobertura-de-criterios`. Cubre CA-003-04, CA-003-05.
- **F4.5** Instrucción al agente de pruebas de citar el identificador (cambio en `core/ciclo/contratos.js:34-44`; prueba de regresión del ciclo).
- **F6.7** (fase siguiente) Candado de proyecto (`ciclo/candado.js`) al leer la cabeza y escribir; `ciclo:llamada`/`modeloServido` para poblar `modelos`; `DockerCli.identidadImagen` en `prepararImagen`.
- **F7.1** Prueba y código: campo opcional de tarea y su validación. Cubre CA-006-01, CA-006-05.
- **F7.2** Prueba: línea base verde antes de implementar; si no, revisión humana. Cubre CA-006-02.
- **F7.3** Prueba: regresión tras el cambio da `falla` con la lista. Cubre CA-006-03.
- **F7.4** Prueba: el implementador no puede modificar lo declarado. Cubre CA-006-04.
- **F8.1** Prueba de proyecto hostil: comando de puerta malicioso, salida con secretos, informe retocado.
- **F8.2** Con Docker real, una puerta de tipos y otra de linter (`FORGE_TEST_DOCKER=1`).
- **F8.3** Documentación: `docs/ciclo-verificado.md`, guía, `README.md`, `CHANGELOG.md`, ayuda.
- **F8.4** Suite completa en Windows y en el contenedor Linux; tipos en 0.
- **F8.5** Revisión independiente (ver `plan.md`, sección 9); hallazgos altos corregidos.
- **F8.6** `verificacion.md` con cada criterio y su prueba.

## Límites de este documento

- No hay revisión independiente registrada aquí: si `tareas.md` la lista como abierta, sigue abierta.
- Las pruebas con Docker real (`FORGE_TEST_DOCKER=1`) no se ejecutan en este equipo; lo que dependa de ellas está medido solo con el Docker falso.
- Regenerar este archivo con el mismo método no sustituye leer los criterios sin prueba citada.
