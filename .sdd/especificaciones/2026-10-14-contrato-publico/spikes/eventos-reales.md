# Spike S0.2: tipos reales de evento frente a `EventType` y sus lectores

> Lectura y `grep` (2026-10-17). Detalle completo en la spec hermana `2026-10-14-puertas-de-calidad-y-evidencia/spikes/eventos.md`; aquí lo que importa al contrato.

## Hallazgos

- El sobre real: `{ id, type, ts, [agent], [taskId], [pipelineStep], payload, [envelope] }` (`core/event-log.js:57-66`); `payload` es libre. `type` no se valida en ejecución.
- **Derivas contra el typedef** (`event-log.js:9`): se emiten y no están declarados `ciclo:llamada_huerfana` (`core/ciclo/index.js:391`), `ciclo:consumo_estimado` (`:338`) y `verificar:resultado` (`core/verificar/registro.js:35-37`, que además escribe a mano sin pasar por `EventLog`). Los `integracion:*` (cinco) sí están declarados y se emiten con tipo calculado (`core/integraciones/auditoria.js`).
- `ciclo:*` observados por literal: `rojo, implementador_sin_herramientas, presupuesto_degradado, precio_desconocido, escritura_rechazada, nodo_completado, ejecucion, mutante, mutacion, mutacion_omitida, turno, turnos_agotados, herramienta, lectura_rechazada, revision_decidida, llamada_abortada, llamada_huerfana, consumo_estimado`.
- **Dos archivos**: `.sdd/events.jsonl` (`run`, `resume`, API, integraciones, `verificar --registrar`) y `.sdd/observabilidad/events.jsonl` (`status`, `step`, `state`: `cli/runner.js:119,201,244,270`). El contrato debe nombrar cuál.
- Lectores internos: `replayTaskStates` (solo `task_*`, ignora el resto: `event-log.js:90-115`), `lastPipelineStep`. Ninguno enumera `ciclo:*`. No hay lector interno que se rompa con tipos nuevos.
- `id` repetible entre procesos (`Date.now()` + contador por instancia); `verificar/registro.js` usa `Date.now()-pid`. No es clave única.

## Qué cambia en la spec o el plan

- Contrato de eventos: el sobre se fija estricto y `payload` libre (CA-004-01 ya lo dice); se declara qué tipos son contrato (p. ej. `task_*`, `pipeline_step_changed`, `verificar:resultado`) y cuáles internos (resto de `ciclo:*`), con el vocabulario de `payload` de los contractuales.
- Tarea F4.1 (sobre válido por tipo conocido) debe **derivar la lista de tipos del código** (grep de literales en una prueba estática) y comparar con el typedef: la prueba detectará de inmediato los tres tipos que faltan. Decidir: corregir el typedef (recomendado, 3 palabras) como primera tarea.
- Añadir `verificar:resultado` al sobre: hoy su `id` es `<ms>-<pid>` y se escribe sin `EventLog`; el esquema debe aceptar los dos formatos de `id` (cadena libre).

## Riesgos

- Declarar `ciclo:*` como contrato congelaría detalles que cambian cada semana (`mutante`, `turno`); mejor «tipos con prefijo `ciclo:` son internos salvo los listados».
