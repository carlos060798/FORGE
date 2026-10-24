# Verificación: defensa-inyeccion-y-fuga

> **Fecha:** 2026-10-24 · **Rama:** `feature/motor-agentico` · **Generado** leyendo `spec.md`, `tareas.md` y `tests/` (no ejecuta nada).

## Cómo leerlo

Un criterio figura como **con prueba citada** cuando algún archivo de prueba de esta especificación contiene su identificador. Eso **no demuestra** que la prueba compruebe el criterio, solo que alguien la enlazó; la calidad de la prueba la mide la mutación. Un criterio **sin prueba citada** puede estar cubierto por una prueba que no lo nombra: en ese caso falta el enlace, no necesariamente la prueba. La columna «Marcado en la spec» es lo que dice el propio `spec.md`, sin contrastar.

## Resumen

- Criterios: 22 · con prueba citada: 5 · sin prueba citada: 17.
- Archivos de prueba atribuidos a esta especificación (nombran su carpeta o su nombre): 6.

## Criterio → pruebas

| Criterio | Marcado en la spec | Prueba citada | Pruebas |
|---|---|---|---|
| CA-001-01 | sí | **no** | — |
| CA-001-02 | sí | **no** | — |
| CA-001-03 | sí | **no** | — |
| CA-001-04 | sí | **no** | — |
| CA-001-05 | sí | **no** | — |
| CA-001-06 | sí | **no** | — |
| CA-001-07 | sí | **no** | — |
| CA-002-01 | sí | sí | `tests/defensa-inyeccion.test.js` |
| CA-002-02 | sí | **no** | — |
| CA-002-03 | sí | **no** | — |
| CA-002-04 | sí | sí | `tests/defensa-inyeccion.test.js` |
| CA-002-05 | sí | **no** | — |
| CA-002-06 | sí | sí | `tests/defensa-inyeccion.test.js` |
| CA-003-01 | sí | **no** | — |
| CA-003-02 | sí | **no** | — |
| CA-003-03 | sí | **no** | — |
| CA-003-04 | sí | **no** | — |
| CA-003-05 | sí | **no** | — |
| CA-004-01 | sí | sí | `tests/garantias-documentadas.test.js` |
| CA-004-02 | sí | **no** | — |
| CA-004-03 | sí | **no** | — |
| CA-004-04 | sí | sí | `tests/garantias-documentadas.test.js` |

## Sin cerrar

- **S0.4** Efecto del delimitador con un modelo real. Salida: `spikes/modelo-real.md` con el **protocolo**, **sin ejecutar** (sin credenciales ni presupuesto aprobado). Pendiente del dueño; se ejecuta d
- **F6.1** Suite completa en Windows y en el contenedor Linux; tipos en 0. (Hecho parcialmente: las pruebas afectadas y `npm run typecheck`; la suite completa **no** se ejecutó.)
- **F6.2** Con Docker real la parte hostil (`FORGE_TEST_DOCKER=1`).
- **F6.3** Revisión independiente; hallazgos altos corregidos.
- **F6.4** `verificacion.md` con cada criterio y su prueba.

## Límites de este documento

- No hay revisión independiente registrada aquí: si `tareas.md` la lista como abierta, sigue abierta.
- Las pruebas con Docker real (`FORGE_TEST_DOCKER=1`) no se ejecutan en este equipo; lo que dependa de ellas está medido solo con el Docker falso.
- Regenerar este archivo con el mismo método no sustituye leer los criterios sin prueba citada.
