# Verificación: Revisión publicada

> Spec: `spec.md` · Estado: **borrador y bloqueada. No hay plan, tareas, pruebas ni código.** Bloqueada por la aceptación del ADR-22 y, después, del ADR-37. Este documento solo dice contra qué se verificará.

## 1. Lo que existe hoy (leído el 2026-11-27, sin ejecutar nada)

| Pieza | Dónde | Relación con la spec |
|---|---|---|
| Contrato con 4 operaciones y rechazo de operaciones genéricas | `core/integraciones/puerto.js:18,24-26,90-112` | Hay que ampliarlo (ADR-37); todo proveedor válido debe tener las 4 (`puerto.js:100-102`), lo que rompería a Jira si se añaden sin cuidado |
| Cola autenticada, huella, `aprobar --huella` | `core/integraciones/aprobacion.js:44,49,129,290,451-460,533-538` | Reutilizable; `OPERACIONES` de la línea 44 solo admite `comentar` y `proponer_cambio` |
| Operaciones auditadas (conjunto cerrado) | `core/integraciones/auditoria.js:37` | Hay que añadir 3 |
| Texto de terceros como dato | `core/integraciones/confianza.js:250` | Reutilizable |
| `leerElemento` de GitHub y GitLab: solo título, cuerpo, etiquetas, comentarios; `tipo` informa `solicitud_de_cambio` | `proveedores/github.js:355-408`, `proveedores/gitlab.js:323-364`, `puerto.js:46` | No trae diff, SHA ni CI |
| Referencias por proveedor | `publicacion.js:44-48`, `github.js:57`, `gitlab.js:52` | La de GitLab es `#N` |

No existen `leerCambio`, `leerEstadoCI`, `publicarRevision`, ni nada con `diff_refs` en `core/` [V-código: no hay coincidencias en los adaptadores leídos; búsqueda no exhaustiva sobre el resto del árbol, [NV]].

## 2. Criterios de aceptación

| CA | Estado | Cómo se verificará (propuesta) |
|---|---|---|
| CA-001-01 a CA-001-06 | Pendiente (bloqueado por ADR-37) | Servidor falso por proveedor: metadatos, diff, truncado, destino no permitido sin petición, texto hostil entregado como dato, evento de auditoría |
| CA-002-01 a CA-002-05 | Pendiente (bloqueado por ADR-37) | Servidor falso: CI en curso, falla, pasa, ausente; nombre de comprobación hostil; ninguna petición a registros |
| CA-003-01 a CA-003-10 | Pendiente (bloqueado por ADR-37) | Servidor falso que registra escrituras: 0 escrituras antes de aprobar; huella; cabeza cambiada; HMAC inválido; sin `FORGE_INTEGRACIONES_ESCRITURA`; doble publicación; sin operación de aprobar/fusionar en el contrato |
| CA-004-01 a CA-004-05 | Pendiente | Servidor falso GitLab con `diff_refs` completo, incompleto y con rechazo 400; después **una cuenta real** |
| CA-005-01 a CA-005-03 | Pendiente | Servidor falso GitHub; después **una cuenta real**; reglas de anclaje [NV] |
| CA-006-01 a CA-006-04 | Pendiente | Corpus hostil con respuestas guionizadas; borrador y bifurcación simulados |
| CA-007-01 a CA-007-04 | Pendiente | Pruebas de aislamiento existentes ampliadas (`integraciones-aislamiento`), prueba del contrato con operaciones nuevas, Jira sin petición |

## 3. Qué NO se ha hecho ni comprobado

- Ninguna petición a GitHub ni a GitLab. No se leyó documentación de endpoints de diff, CI ni revisiones en este borrador; todo lo de la API está marcado [NV].
- No se probó el anclaje en GitLab con SHA reales. El plan lo trata como riesgo conocido (SHA abreviados no soportados, 400 por línea, notas que no se ven en la pestaña de cambios) con fuente secundaria [S].
- No hay cuenta real de prueba. La salida de la fase 7 exige una de GitHub y una de GitLab; la aporta el dueño.
- Tamaño real de diffs que las plataformas devuelven y sus límites de paginación: [NV].
