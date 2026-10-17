# Índice de Especificaciones

> **Nombre del proyecto:** el dueño decidió el 2026-10-13 que el proyecto pasa a llamarse **Fragua** (spec `2026-10-13-renombrar-a-fragua`). Los documentos anteriores a esa fecha dicen FORGE y no se reescriben.

> Registro de todas las especificaciones del proyecto, ordenado cronológicamente.

## Estadísticas
- Total: 14
- Completadas: 0
- En progreso: 11
- En borrador: 3

## Especificaciones

| ID | Título | Estado | Tamaño | Spec | Plan | Tareas | Verif | Fecha |
|----|--------|--------|--------|------|------|--------|-------|-------|
| 2026-10-03-saneamiento | Saneamiento del motor y del instalador | en_implementacion (11 de 11 tareas; CA-004-01 resuelto por ADR-16) | pequeño | ✅ | ✅ | ✅ | ⚠️ autoevaluación (12 de 13 criterios) | 2026-10-04 |
| 2026-10-03-ciclo-verificado | Ciclo Verificado | en_implementacion (38 de 38 tareas; tercera verificación independiente: APROBADA_CON_OBSERVACIONES; correcciones posteriores sin revisar) | grande | ✅ | ✅ | ✅ | ⚠️ aprobada con observaciones | 2026-10-03 |
| 2026-10-03-herramientas-mcp | Herramientas de FORGE para agentes externos | en_implementacion (9 de 9 tareas; verificación y revisión de seguridad independientes: aprobada con observaciones) | mediano | ✅ | ✅ | ✅ | ⚠️ aprobada con observaciones | 2026-10-03 |
| 2026-10-03-api-http | API HTTP local del ciclo verificado | en_implementacion (5 de 5 tareas; verificación y revisión de seguridad independientes: aprobada con observaciones, corregidas sin revisar) | mediano | ✅ | ✅ | ✅ | ⚠️ aprobada con observaciones | 2026-10-03 |
| 2026-10-04-memoria-semantica | Memoria semántica del repositorio | en_implementacion (autoevaluada; sin revisión independiente) | pequeño | ✅ | — | — | ⚠️ autoevaluación | 2026-10-04 |

| 2026-10-09-validacion-modelo-real | Validación con un modelo real y gasto bien calculado | en_implementacion (aprobada por delegación del dueño; más de 20 ejecuciones reales registradas; una revisión independiente RECHAZADA y corregida, sin segunda revisión; falta comparar el gasto con lo facturado) | pequeño | ✅ | — | — | ⚠️ evidencia y revisión en la carpeta | 2026-10-09 |
| 2026-10-09-implementador-con-herramientas | Implementador que lee, busca y edita por pasos | en_implementacion (aprobada por delegación del dueño; modo opcional; probada con respuestas guionizadas, sin modelo real ni revisión independiente) | grande | ✅ | — | — | ⚠️ autoevaluación (21 de 24 criterios; costo sin medir) | 2026-10-09 |
| 2026-10-09-pruebas-confiables | Pruebas confiables | en_implementacion (aprobada por delegación del dueño; implementada sin plan ni tareas formales; autoevaluada, sin revisión independiente ni modelo real) | mediano | ✅ | — | — | ⚠️ autoevaluación (20 de 20 criterios con test) | 2026-10-09 |
| 2026-10-09-puesta-al-dia | Puesta al día | en_implementacion (aprobada por delegación del dueño; autoevaluada, sin revisión independiente; ahorro de la caché sin medir y revisión nueva del protocolo sin probar con un cliente real) | mediano | ✅ | — | — | ⚠️ autoevaluación (17 de 19 criterios con prueba) | 2026-10-09 |
| 2026-10-11-integraciones-externas | Integraciones con GitHub, GitLab y Jira con el mínimo privilegio | en_implementacion (por instrucción del dueño; ADR-22 propuesta; spikes primero) | grande | ✅ | ✅ | ✅ | — | 2026-10-11 |
| 2026-10-13-instalacion-agnostica | Instalación agnóstica de herramienta: integraciones por clave y comandos como skills | borrador (redactada por un agente por encargo del dueño; sin aprobar; nada implementado) | mediano | ✅ | ✅ | ✅ | — | 2026-10-13 |
| 2026-10-13-verificar-sin-modelo | `forge verificar`: veredicto aislado sin llamar a un modelo | borrador (redactada por un agente por encargo del dueño; sin aprobar; nada implementado) | mediano | ✅ | ✅ | ✅ | — | 2026-10-13 |
| 2026-10-13-proveedores-agnosticos | Proveedores agnósticos: conformidad, herramientas en OpenAI y Ollama, niveles neutrales | borrador (redactada por un agente por encargo del dueño; sin aprobar; nada implementado) | mediano | ✅ | ✅ | ✅ | — | 2026-10-13 |
| 2026-10-13-renombrar-a-fragua | El proyecto pasa a llamarse Fragua, sin romper a quien ya usa FORGE | en_implementacion (por instrucción del dueño; F1 hecha: orden `fragua`; F3 y F4 tocan seguridad y esperan a los inventarios y a una revisión independiente) | mediano | ✅ | ✅ | ✅ | — | 2026-10-13 |

| 2026-10-14-contrato-publico | Contrato público: esquemas versionados, validador de subconjunto y política de compatibilidad | en_implementacion (aprobada por delegación del dueño el 2026-10-17; esquemas en `docs/contrato/`, validador y pruebas hechos; faltan comando `esquema`, rechazo de versión en lectores, CHANGELOG y revisión independiente) | mediano | ✅ | ✅ | ✅ | — | 2026-10-14 |

## Previstas (sin especificar todavía)

Las tres specs del 2026-10-13 siguen `PLAN-INCREMENTAL.md` (incrementos I1 a I6); las previstas a continuación (el ciclo por MCP, contrato público, paralelismo) están en su sección 6 y en `PLAN-ESCALADO.md`.

Ver el roadmap en `PLAN-MOTOR-AGENTICO.md`: S5 Ciclo por defecto (ya implementado, ADR-17).

Las cuatro specs del 2026-10-09 siguen el roadmap de `PLAN-CIERRE-BRECHAS.md` (FASES 6 a 9). ADR-19, ADR-20 y ADR-21 están aceptadas por delegación del dueño (2026-10-09) y pendientes de su ratificación.

> **Nota (2026-10-14):** el proyecto FORGE pasa a llamarse **Fragua** (paquete `fragua`, orden `fragua`; `forge` y `sdd-es` siguen funcionando). Los documentos de esta carpeta conservan el nombre con el que se escribieron. Ver `especificaciones/2026-10-13-renombrar-a-fragua/`.
