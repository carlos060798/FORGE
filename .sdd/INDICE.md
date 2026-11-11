# Índice de Especificaciones

> **Nombre del proyecto:** el dueño decidió el 2026-10-13 que el proyecto pasa a llamarse **Fragua** (spec `2026-10-13-renombrar-a-fragua`). Los documentos anteriores a esa fecha dicen FORGE y no se reescriben.

> Registro de todas las especificaciones del proyecto, ordenado cronológicamente.

## Estadísticas
- Total: 33
- Completadas: 0
- En progreso: 18
- En borrador: 15

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
| 2026-10-13-instalacion-agnostica | Instalación agnóstica de herramienta: integraciones por clave y comandos como skills | en_implementacion (aprobada por delegación del dueño el 2026-11-11, pendiente de ratificación; F1 a F3 y F5.1 a F5.3 hechas; faltan pruebas manuales por herramienta) | mediano | ✅ | ✅ | ✅ | — | 2026-10-13 |
| 2026-10-13-verificar-sin-modelo | `forge verificar`: veredicto aislado sin llamar a un modelo | borrador (redactada por un agente por encargo del dueño; sin aprobar; nada implementado) | mediano | ✅ | ✅ | ✅ | — | 2026-10-13 |
| 2026-10-13-proveedores-agnosticos | Proveedores agnósticos: conformidad, herramientas en OpenAI y Ollama, niveles neutrales | borrador (redactada por un agente por encargo del dueño; sin aprobar; nada implementado) | mediano | ✅ | ✅ | ✅ | — | 2026-10-13 |
| 2026-10-13-renombrar-a-fragua | El proyecto pasa a llamarse Fragua, sin romper a quien ya usa FORGE | en_implementacion (por instrucción del dueño; F1 hecha: orden `fragua`; F3 y F4 tocan seguridad y esperan a los inventarios y a una revisión independiente) | mediano | ✅ | ✅ | ✅ | — | 2026-10-13 |
| 2026-10-14-ciclo-por-mcp | Ciclo por MCP: otra herramienta delega en Fragua la verificación sin gastar ni escribir | en_implementacion (aprobada por delegación del dueño el 2026-10-17; SOLO la fase 1 (`verificar` por MCP, sin gasto); fases 2 y 3 sin implementar; sin revisión independiente todavía) | grande | ✅ | ✅ | ✅ | — | 2026-10-17 |
| 2026-10-14-contrato-publico | Contrato público: esquemas versionados, validador de subconjunto y política de compatibilidad | en_implementacion (aprobada por delegación del dueño el 2026-10-17; esquemas en `docs/contrato/`, validador y pruebas hechos; faltan comando `esquema`, rechazo de versión en lectores, CHANGELOG y revisión independiente) | mediano | ✅ | ✅ | ✅ | — | 2026-10-14 |
| 2026-10-14-defensa-inyeccion-y-fuga | Defensa frente a inyección y fuga: contenido del proyecto como dato, control de salida y batería de ataques | en_implementacion (aprobada **por delegación del dueño**, 2026-10-17; F1 a F5 hechas: 16 puntos de entrada delimitados con identificador derivado del contenido, control de salida de secretos y destinos, batería permanente y documento de garantías; **pendientes** S0.4 con modelo real (no ejecutado) y F6: revisión independiente, suite completa y Docker real) | grande | ✅ | ✅ | ✅ | ⚠️ autoevaluación (pruebas afectadas y tipos; sin revisión independiente) | 2026-10-14 |
| 2026-10-14-puertas-de-calidad-y-evidencia | Puertas de calidad declarables, criterios enlazados e informe de evidencia a prueba de alteraciones | en_implementacion (aprobada por delegación del dueño el 2026-10-17; fase A: evidencia encadenada y firmada con la clave local, `verificar --comprobar-evidencia`, lista de configuración protegida; fase B1: puertas declarables en `fragua verificar` (`core/puertas/`, `docs/puertas-de-calidad.md`); la integración con el ciclo y el enrutador espera a los perfiles; autoevaluada, sin revisión independiente) | grande | ✅ | ✅ | ✅ | — | 2026-10-14 |
| 2026-10-27-flujo-nativo-de-ia | Flujo nativo de IA: barreras en el guardián, revisión en capas, evals, mantenimiento por señal e indicadores | en_implementacion (por instrucción del dueño; autoevaluada, sin revisión independiente; instalación de hooks y job de CI sin probar en real) | mediano | ✅ | — | ✅ | ⚠️ autoevaluación | 2026-10-27 |
| 2026-11-06-guardian-endurecido | Guardián endurecido: análisis por argv, falla cerrado y registro propio protegido | borrador (implementada por instrucción del dueño; sin aprobación ni revisión independiente) | mediano | ✅ | — | ✅ | ⚠️ autoevaluación | 2026-11-06 |
| 2026-11-06-aprobaciones-con-identidad | Aprobaciones con identidad: terminal real, código de un solo uso y registro firmado | borrador (implementada por instrucción del dueño; sin aprobación ni revisión independiente; no probada en un TTY real) | mediano | ✅ | — | ✅ | ⚠️ autoevaluación | 2026-11-06 |
| 2026-11-06-aislamiento-opcional | Aislamiento opcional: nivel base sin Docker y nivel aislado, con el nivel usado visible en cada veredicto | borrador (solo especificación; cambia una garantía y espera la decisión del dueño; nada implementado) | mediano | ✅ | — | — | — | 2026-11-06 |
| 2026-11-09-ci-verde-y-cuarentena | CI verde en Linux y Windows: cuarentena honesta de pruebas inestables y pata de Windows en la matriz | borrador (implementada dentro del plan MVP; sin aprobación del dueño; ADR-23 propuesta; T8 a T10 del dueño) | pequeño | ✅ | — | ✅ | — | 2026-11-09 |
| 2026-11-09-puerta-de-entrada-solo-dev | Puerta de entrada para el desarrollador individual: perfil esencial y preset lean por defecto, doctor con siguiente paso, catálogo sin duplicados | borrador (implementada en la rama `fase-2-puerta-de-entrada`; sin aprobación del dueño; ADR-24 propuesta; no se fusiona hasta que la CI esté verde) | pequeño | ✅ | — | ✅ | — | 2026-11-09 |
| 2026-11-10-enlaces-verificados-en-windows | Pruebas de enlaces que se ejecutan en Windows y omisiones honestas («NO VERIFICADO») | borrador (redactada por un agente; sin aprobar; pruebas ya migradas) | pequeño | ✅ | — | ✅ | ✅ | 2026-11-10 |
| 2026-11-11-correcciones-de-precision | Correcciones de precisión halladas al documentar: versión que estampa export y tipo del estado | borrador (implementada; la aprueba el dueño; micro) | micro | ✅ | — | ✅ | — | 2026-11-11 |
| 2026-11-11-sitio-generado-desde-docs | Sitio de documentación generado desde docs/ con enlaces comprobados | borrador (solo especificación; ADR-25 propuesta; cuatro decisiones del dueño; nada implementado) | mediano | ✅ | — | ✅ | — | 2026-11-11 |
| 2026-11-11-aislamiento-usuario-linux | Aislamiento en Linux: el contenedor corre con el usuario del anfitrión para que lo que crea se pueda borrar | borrador (implementada y verificada en un Docker de Linux limpio; toca ADR-02; la aprueba el dueño) | pequeño | ✅ | — | ✅ | — | 2026-11-11 |
| 2026-11-10-equipos-y-ciclo-en-ci | Equipos pequeños: aprobaciones atribuibles, estado compartible y ciclo verificado en CI | borrador (solo especificación, Fase 4 del plan MVP; cinco decisiones abiertas del dueño; nada implementado) | grande | ✅ | — | — | — | 2026-11-10 |
| 2026-11-10-metodologia-agnostica | Metodología agnóstica del anfitrión: comandos y agentes utilizables fuera de Claude Code | en_implementacion (aprobada por delegación del dueño el 2026-11-11, pendiente de ratificación; F1 y F2 implementadas por adaptación al instalar, sin probar en herramientas reales) | grande | ✅ | — | — | — | 2026-11-10 |
| 2026-11-11-guardian-fuera-de-claude-code | Guardián y memoria fuera de Claude Code: orden `fragua guardian`, traducción del evento por anfitrión y plantillas de hook | borrador (código F3 implementado por instrucción del dueño antes de la spec; redactada a posteriori; **sin aprobar**; CA-001-03 y CA-002-03 corregidos con prueba el 2026-11-11; CA-002-04, CA-003-02 y CA-004-01 pendientes; sin probar en herramienta real) | mediano | ✅ | — | — | — | 2026-11-11 |
| 2026-10-14-despliegue-con-aprobacion | Despliegue con aprobación: puerto de despliegue con un adaptador de AWS; el modelo propone, una persona aprueb | borrador (fila añadida al revisar el índice; el estado es el de su spec.md) | grande | ✅ | — | — | — | 2026-10-14 |
| 2026-10-14-perfiles-de-agente | Perfiles de agente: herramientas, rutas, contexto y pasos por rol, impuestos por el motor | borrador (fila añadida al revisar el índice; el estado es el de su spec.md) | grande | ✅ | — | — | — | 2026-10-14 |

## Previstas (sin especificar todavía)

Las tres specs del 2026-10-13 siguen `PLAN-INCREMENTAL.md` (incrementos I1 a I6); las previstas a continuación (el ciclo por MCP, contrato público, paralelismo) están en su sección 6 y en `PLAN-ESCALADO.md`.

Ver el roadmap en `PLAN-MOTOR-AGENTICO.md`: S5 Ciclo por defecto (ya implementado, ADR-17).

Las cuatro specs del 2026-10-09 siguen el roadmap de `PLAN-CIERRE-BRECHAS.md` (FASES 6 a 9). ADR-19, ADR-20 y ADR-21 están aceptadas por delegación del dueño (2026-10-09) y pendientes de su ratificación.

> **Nota (2026-10-14):** el proyecto FORGE pasa a llamarse **Fragua** (paquete `fragua`, orden `fragua`; `forge` y `sdd-es` siguen funcionando). Los documentos de esta carpeta conservan el nombre con el que se escribieron. Ver `especificaciones/2026-10-13-renombrar-a-fragua/`.
