# Verificación: ciclo-por-mcp

> **Fecha:** 2026-10-24 · **Rama:** `feature/motor-agentico` · **Generado** leyendo `spec.md`, `tareas.md` y `tests/` (no ejecuta nada).

## Cómo leerlo

Un criterio figura como **con prueba citada** cuando algún archivo de prueba de esta especificación contiene su identificador (**exacta**) o lo abarca con un rango como «CA-001-01 a CA-001-05» o «CA-001-xx» (**por rango**, más débil: no prueba que ese criterio concreto se compruebe). Eso **no demuestra** que la prueba compruebe el criterio, solo que alguien la enlazó; la calidad de la prueba la mide la mutación. Un criterio **sin prueba citada** puede estar cubierto por una prueba que no lo nombra: en ese caso falta el enlace, no necesariamente la prueba. La columna «Marcado en la spec» es lo que dice el propio `spec.md`, sin contrastar. Los identificadores `CA-xxx-yy` se repiten entre especificaciones: solo se atribuye un archivo de prueba a esta si la nombra en su cabecera (primeras 40 líneas) o en su nombre, y aun así una cita exacta en un archivo compartido puede ser de otro criterio. Además hay pruebas que cubren un criterio sin nombrarlo (p. ej. `tests/integration.test.js` para el binario `fragua`): el recuento de «ninguna» es un máximo, no una medida de falta de pruebas.

## Resumen

- Criterios: 32 · cita exacta: 1 · solo por rango («CA-001-01 a CA-001-05» o «CA-001-xx»): 0 · sin cita: 31.
- Archivos de prueba atribuidos a esta especificación (nombran su carpeta o su nombre): 3.

## Criterio → pruebas

| Criterio | Marcado en la spec | Cita | Pruebas |
|---|---|---|---|
| CA-001-01 | no | **ninguna** | — |
| CA-001-02 | no | **ninguna** | — |
| CA-001-03 | no | **ninguna** | — |
| CA-001-04 | no | **ninguna** | — |
| CA-001-05 | no | **ninguna** | — |
| CA-001-06 | no | **ninguna** | — |
| CA-001-07 | sí | **ninguna** | — |
| CA-002-01 | no | **ninguna** | — |
| CA-002-02 | no | **ninguna** | — |
| CA-002-03 | no | **ninguna** | — |
| CA-002-04 | no | **ninguna** | — |
| CA-002-05 | no | exacta | `tests/doctor-mcp-perfil.test.js` |
| CA-003-01 | no | **ninguna** | — |
| CA-003-02 | no | **ninguna** | — |
| CA-003-03 | no | **ninguna** | — |
| CA-003-04 | no | **ninguna** | — |
| CA-004-01 | no | **ninguna** | — |
| CA-004-02 | no | **ninguna** | — |
| CA-004-03 | no | **ninguna** | — |
| CA-004-04 | no | **ninguna** | — |
| CA-004-05 | no | **ninguna** | — |
| CA-005-01 | no | **ninguna** | — |
| CA-005-02 | no | **ninguna** | — |
| CA-005-03 | no | **ninguna** | — |
| CA-006-01 | no | **ninguna** | — |
| CA-006-02 | no | **ninguna** | — |
| CA-006-03 | no | **ninguna** | — |
| CA-006-04 | no | **ninguna** | — |
| CA-006-05 | no | **ninguna** | — |
| CA-006-06 | no | **ninguna** | — |
| CA-006-07 | no | **ninguna** | — |
| CA-006-08 | no | **ninguna** | — |

## Sin cerrar

> Copiado de `tareas.md` el 2026-10-25: puede estar desactualizado; manda `tareas.md`.

- **F3.2** Cliente MCP real de extremo a extremo, en Windows y Linux.
- **F3.5** Revisión independiente (OWASP agentes); hallazgos altos corregidos.
- **F3.6** `verificacion.md` con cada criterio y su prueba.
- **F4.1** `estado_ciclo` solo lectura; sin `.sdd/motor/` ni rutas. Cubre CA-005-01, CA-005-02, CA-005-03.
- **F5.1** Cola firmada y huella. Tests: sin firma, huella ajena, caducada, de un solo uso. Cubre CA-006-01, CA-006-07.
- **F5.2** Tope efectivo `min()`; sin `FRAGUA_MCP_TOPE_USD` apagado. Cubre CA-006-04.
- **F5.3** Tarea como dato no confiable. Cubre CA-006-02.
- **F5.4** `fragua ciclo vista|aprobar|rechazar|pendientes`; la aprobación no es herramienta. Cubre CA-006-03, CA-006-05, CA-006-06.
- **F5.5** Máximo de pendientes. Cubre CA-006-08.
- **F6.1** Prueba de extremo a extremo con ciclo real y tope de 1 USD.
- **F6.2** Revisión independiente de la fase 3.
- **F6.3** `CHANGELOG.md`, guía y `verificacion.md`.

## Límites de este documento

- No hay revisión independiente registrada aquí: si `tareas.md` la lista como abierta, sigue abierta.
- Las pruebas con Docker real (`FORGE_TEST_DOCKER=1`) no se ejecutan en este equipo; lo que dependa de ellas está medido solo con el Docker falso.
- Regenerar este archivo con el mismo método no sustituye leer los criterios sin prueba citada.
