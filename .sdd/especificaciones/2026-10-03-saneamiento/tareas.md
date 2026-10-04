---
spec_id: 2026-10-03-saneamiento
total_tareas: 11
estado: en_progreso
generado: 2026-10-04
---

# Tareas: Saneamiento del motor y del instalador

Generadas a posteriori, para dejar la trazabilidad que la spec no tenía: el trabajo se hizo antes de que existiera este documento. 10 completadas y 1 bloqueada por una decisión del dueño.

| Tarea | Descripción | Cubre | Estado |
|---|---|---|---|
| T001 | `forge status` desde `core/` (sin `dist/`) | CA-001-02 | completada |
| T002 | `copiarNucleo` copia `shared/config.js` y los `.sh` | CA-001-01 | completada |
| T003 | `package.json` sin `dist/` en `files[]` | CA-001-03 | completada |
| T004 | `core/tareas.js`: leer las tareas de la spec activa (formato objeto) | CA-002-01 | completada |
| T005 | Aceptar `spec_activa` y `especificacion_activa` | CA-002-02 | completada |
| T006 | `--cwd` en el orquestador y en el circuit breaker | CA-002-03 | completada |
| T007 | Resolver la etapa (`pipeline_step` manda; si falta, se traduce `fase_actual`) | CA-002-04 | completada |
| T008 | Suite verde en Windows (38 tests con `/tmp` fijo) | CA-003-01 | completada |
| T009 | `safeFiles` confina por ruta | CA-003-02 | completada |
| T010 | `adr-parser` sin `glob`; variable de ruta del registro de modelos en `agent-memory` | CA-003-03, CA-003-04 | completada |
| T011 | Unificar la convención de ADR en comandos, plantillas y guarda de escritura | CA-004-01 | **bloqueada**: decisión del dueño (la guarda bloquearía escrituras legítimas si se apunta a `.sdd/arquitectura/` sin afinar su heurística) |
