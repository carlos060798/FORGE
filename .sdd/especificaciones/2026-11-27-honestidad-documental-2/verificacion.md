---
spec_id: 2026-11-27-honestidad-documental-2
fecha_verificacion: pendiente
veredicto: PENDIENTE  # sin implementar; ningún criterio verificado
---

# Verificación: 2026-11-27-honestidad-documental-2

## Veredicto: **PENDIENTE**

La especificación está en borrador y sin aprobar. Ningún criterio se ha verificado.

## Criterios de aceptación

| CA | Test / evidencia | Estado |
|---|---|---|
| CA-001-01 | `docs/FABRICA.md` en `docs/archivo/` con cabecera de visión, texto original intacto | pendiente |
| CA-001-02 | referencias vivas actualizadas (`commands/sdd.ayuda.md`, skill generada regenerada, `docs/0-INDICE.md`) | pendiente |
| CA-001-03 | ningún enlace vivo a `docs/FABRICA.md`; índice sin enlaces rotos | pendiente |
| CA-001-04 | el archivo no es alcanzable sin ver la cabecera | pendiente |
| CA-002-01 | C1-C15 con estado anotado (tabla de abajo) | pendiente |
| CA-002-02 | C3, C5, C6, C7 y C8 comprobadas contra código o ejecución, o marcadas no verificadas | pendiente |
| CA-002-03 | búsqueda de cada cifra o frase devuelve el mismo valor en todos los documentos de entrada | pendiente |
| CA-002-04 | informes con fecha obsoletos remiten a `docs/ESTADO-ACTUAL.md` | pendiente |
| CA-003-01 | promesa única en un archivo fuente, repetida o enlazada | pendiente |
| CA-003-02 | la promesa no afirma lo que ESTADO-ACTUAL declara parcial o pendiente, sin matiz | pendiente |
| CA-003-03 | prueba que compara la promesa de cada documento con la fuente | pendiente |
| CA-003-04 | la parte en inglés solo se publica si se aprueba ADR-35 | pendiente |
| CA-004-01 | I1-I12 con estado anotado (tabla de abajo) | pendiente |
| CA-004-02 | cambios sobre la constitución no aplicados sin aprobación del dueño | pendiente |
| CA-004-03 | prueba de vocabulario de estado de los ADR | pendiente |
| CA-004-04 | prueba de coincidencia INDICE y cabecera de cada especificación | pendiente |
| CA-005-01 | prueba: órdenes `fragua` y `forge` citadas en `commands/` y `skills/` existen en el selector de `cli/index.js` | pendiente |
| CA-005-02 | alias con barra inicial excluidos por forma y comprobados aparte | pendiente |
| CA-005-03 | las cinco órdenes citadas hoy (`status`, `logs`, `doctor`, `ui`, `adr`) pasan sin cambios | pendiente |
| CA-005-04 | una orden inexistente añadida a propósito hace fallar la prueba con archivo, línea y orden | pendiente |
| CA-005-05 | lista de excepciones con justificación; una entrada sobrante hace fallar | pendiente |
| CA-005-06 | la prueba solo lee archivos | pendiente |

## Estado de las contradicciones C1-C15 y de las inconsistencias I1-I12

Ninguna tiene estado todavía. Al implementar, cada fila se anota aquí como resuelta, superada (con fecha) o pendiente de decisión del dueño (con cuál).
