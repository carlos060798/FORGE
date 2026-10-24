# Archivo: documentos superados

Estos documentos ya no describen Fragua. Se conservan para no perder la historia de las decisiones, no para orientarse. **Nada de la suite de pruebas ni del código los lee.** Si buscas el estado actual, empieza por [../ESTADO-ACTUAL.md](../ESTADO-ACTUAL.md).

Advertencia: los enlaces dentro de estos archivos apuntan a rutas de cuando se escribieron (por ejemplo, `PLAN-CIERRE-BRECHAS.md` en la raíz). Muchos ya no existen tal cual. El contenido sí es válido como registro de lo que se decidió en su momento.

## Planes de trabajo (`planes/`)

| Documento | Qué era | Sustituido por |
|---|---|---|
| `planes/PLAN-CIERRE-BRECHAS.md` | Plan maestro de cierre de brechas del motor agéntico, con las revisiones independientes | [ESTADO-ACTUAL.md](../ESTADO-ACTUAL.md) y `.sdd/especificaciones/` |
| `planes/PLAN-EJECUCION-FINAL.md` | Lista de tareas para terminar el proyecto (versión 4.x) | ESTADO-ACTUAL.md y [RELEASE-CHECKLIST.md](../../RELEASE-CHECKLIST.md) |
| `planes/PLAN-ESCALADO.md` | Plan de FORGE agnóstico y orquestador | Las especificaciones de instalación agnóstica en `.sdd/especificaciones/` |
| `planes/PLAN-INCREMENTAL.md` | Qué tomar de herramientas parecidas y por dónde empezar | Sin sustituto: decisiones ya tomadas en el código |
| `planes/PLAN-MAESTRO.md` | Plan frente al mercado y trabajo agrupado (versión 4.2) | ESTADO-ACTUAL.md |
| `planes/PLAN-MIGRACION-NUCLEO-REAL.md` | Plan de migración a un framework agnóstico | Las especificaciones de 2026-10-13 y 2026-10-14 |
| `planes/PLAN-MOTOR-AGENTICO.md` | Plan maestro del motor agéntico (antes «FORGE v2») | ESTADO-ACTUAL.md y `.sdd/INDICE.md` |
| `planes/PLAN-V280-V300.md` | Plan de las fases B y C de la versión 2.8 y 3.0 | Superado por las versiones posteriores |

## Análisis, informes y comparativas

| Documento | Qué era | Por qué se aparta |
|---|---|---|
| `ANALISIS-COMPARATIVO-FRAMEWORKS.md` | FORGE frente a CrewAI y LangGraph (junio) | Comparativa de la versión 4.x, sin fuentes actualizadas |
| `ANALISIS-COMPETITIVO-FINAL.md` | Análisis competitivo de FORGE 4.2.0 | Cifras de la 4.2.0 que el repositorio no respalda |
| `INFORME-CONSENSO-FINAL.md` | Informe de consenso de FORGE 4.2.0 | Mismo motivo: versión y cifras anteriores |
| `INFORME-MEMORIA-OSS.md` | Investigación sobre gestión de memoria en el ecosistema de Claude Code | Investigación previa; la memoria que describe no es la de 5.0 |
| `EVALUACION-PUBLICACION.md` | Evaluación para publicar la 5.0.0 (13 de octubre) | Sustituida por ESTADO-ACTUAL.md y RELEASE-CHECKLIST.md |
| `FUENTE-DE-VERDAD.md` | Qué es la fuente de verdad de FORGE 4.2.0 | Mezcla el nombre antiguo del paquete y cifras de la 4.2.0 |
| `MATRIZ-TRAZABILIDAD.md` | Matriz de trazabilidad de la 4.0.0 | Identificadores y archivos de la 4.0.0 |
| `ESTADO-IMPLEMENTACION.md` | Estado por área escrito para la 4.3.0 | Sustituido por ESTADO-ACTUAL.md |
| `VERIFICACION-SQLITE-AUTODETECT.md` | Verificación de la detección automática de SQLite | Describe una API de memoria que ya no existe en el código |

## Guías de funciones que ya no existen

| Documento | Qué describía | Por qué se aparta |
|---|---|---|
| `MEMORIA-Y-OBSERVABILIDAD.md` | API de memoria persistente, SQLite y compresión | No hay código que implemente esa API |
| `QUICK-REFERENCE-API-MEMORIA.md` | Referencia rápida de esa API | Igual que la anterior |
| `EJEMPLOS-MEMORIA-API.md` | Código de ejemplo de esa API | Igual que la anterior |
| `COMPRESION.md` | Compresión de tokens «caveman-lite» | No hay código que implemente la técnica |
| `MAPAS.md` | Mapas estáticos para ahorrar tokens | No hay código que los genere |
| `OPTIMIZACION-ENTORNO.md` | Ajustes del entorno de Claude Code anteriores a 5.0 | Escrito para la 4.x; no se ha vuelto a comprobar contra 5.0 |
| `ESTANDAR-EJEMPLOS-CODIGO.md` | Formato de ejemplos de código de la 4.0.0 | Sin uso en los documentos actuales |
| `PLAN-GO-TO-MARKET.md` | Plan de validación de SDD-ES (nombre anterior) | Describe la versión 4.2 con cifras sin respaldo |
| `PLAN-DIAGRAMAS-INTERACTIVOS.md` | Plan de diagramas para el sitio de documentación | Plan; no hay registro de que se ejecutara |

## Lo que queda fuera de este archivo

- `FABRICA.md` sigue en `docs/`: el comando `sdd.ayuda` y su skill generada lo enlazan. Pendiente de revisar sus nombres antiguos.
- Las especificaciones de `.sdd/especificaciones/` que citan `PLAN-MAESTRO.md` o `PLAN-MIGRACION-NUCLEO-REAL.md` no se han reescrito: son registros aprobados o en revisión, y cambiarlos sin el dueño no procede.
- La constitución del proyecto (`.sdd/memoria/constitucion.md`) menciona `PLAN-MIGRACION-NUCLEO-REAL.md` como origen de un principio. Mismo criterio.
