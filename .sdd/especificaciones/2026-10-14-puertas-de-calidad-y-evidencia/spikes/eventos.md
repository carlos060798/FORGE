# Spike S0.5: formato de `events.jsonl`, tipos admitidos y consumidores

> Solo lectura + un recuento por `grep` (2026-10-17).

## Formato

- Una línea JSON por evento: `{ id, type, ts, [agent], [taskId], [pipelineStep], payload, [envelope] }` (`core/event-log.js:20-27,57-66`). `id = Date.now()-contador`; el contador es por instancia (`:36,57`), por lo que dos procesos pueden repetir id. Se escribe con `appendFileSync` (una escritura por línea). `readAll` ignora líneas corruptas (`:77-87`).
- **No hay validación del tipo en ejecución**: `EventType` es un `@typedef` (`event-log.js:9`); `append` acepta cualquier cadena. Por eso los tipos reales y los declarados ya difieren: se emiten pero **no están en el typedef** `ciclo:llamada_huerfana` (`core/ciclo/index.js:391`), `ciclo:consumo_estimado` (`:338`) y `verificar:resultado` (`core/verificar/registro.js:35-37`, escrito a mano sin `EventLog`).
- Recuento de tipos por literal en `core/` y `cli/` (grep): `custom` 11, `ciclo:rojo` 5, `task_failed` 3, `agent_invoked` 3, `ciclo:implementador_sin_herramientas` 3, y 1-2 cada uno de `ciclo:nodo_completado`, `ciclo:ejecucion`, `ciclo:mutacion`, `ciclo:mutante`, `ciclo:mutacion_omitida`, `ciclo:escritura_rechazada`, `ciclo:lectura_rechazada`, `ciclo:herramienta`, `ciclo:turno`, `ciclo:turnos_agotados`, `ciclo:revision_decidida`, `ciclo:presupuesto_degradado`, `ciclo:precio_desconocido`, `ciclo:llamada_abortada`, `task_*`, `runner_*`, `agent_result`, `pipeline_step_changed`. Los `integracion:*` los emite `auditoria.js` con tipo calculado (no aparecen en el grep literal).

## Dos archivos de eventos distintos

- `.sdd/events.jsonl`: `core/engine-cli.js:90` (`run`/`resume`), `core/api/servidor.js:154`, `core/integraciones/auditoria.js:132`, `verificar/registro.js:25`.
- `.sdd/observabilidad/events.jsonl`: `cli/runner.js:119,201,244,270` (`status`, `step`, `state`…). Los docs mencionan `events.jsonl` sin decir cuál (`docs/PROBLEMAS-CONOCIDOS.md:231` apunta a `.sdd/events.jsonl`). Para evidencia y contrato hay que **nombrar el archivo**; los eventos del ciclo y de `verificar` van al primero.

## Quién lee los tipos

- `replayTaskStates` (`event-log.js:90-115`) hace `switch` solo sobre `task_started|completed|failed|skipped|paused`; un tipo desconocido se ignora sin error. Lo usan `core/engine-cli.js:232,266` y `core/orchestrator.js:43`. `lastPipelineStep` usa `pipeline_step_changed` (`engine-cli.js:268`).
- Ningún consumidor del repositorio enumera `ciclo:*` ni `verificar:*` (grep de `.type ===`, `case 'ciclo:`: sin resultados fuera de `event-log.js`). Los lee una persona, o herramientas externas (no medible).
- Conclusión: añadir tipos (`ciclo:puerta`, `ciclo:evidencia`, `ciclo:llamada`) **no rompe a ningún lector interno**; el riesgo de «ampliar EventType rompe consumidores» (plan §8) se reduce a consumidores externos, y se gestiona con la política del contrato público (campos nuevos opcionales, tipos nuevos permitidos).

## Qué cambia en la spec o el plan

- Plan §3 `core/event-log.js`: añadir al typedef los tipos nuevos **y** los tres que faltan (`ciclo:llamada_huerfana`, `ciclo:consumo_estimado`, `verificar:resultado`); una prueba estática que compare los literales emitidos con el typedef evitaría la deriva (también la pide el contrato público, S0.2).
- La cadena de evidencia NO debe vivir en `events.jsonl`: es append sin firma ni orden garantizado entre procesos, con ids repetibles. Los eventos solo apuntan (`id`, `sha256` del informe) como hace `verificar:resultado`.
- Evento `ciclo:puerta` con `{ nombre, comando(redactado), categoria, exitCode, durationMs }`, sin salida (la salida va en el informe, redactada y acotada).
- Decir en la spec qué archivo de eventos se usa (`.sdd/events.jsonl`).

## Riesgos

- Concurrencia: `id` repetible entre procesos (verificar y ciclo a la vez); no usar `id` como clave única de cadena.
- `custom` (11 usos) es un cajón de sastre: no usarlo para evidencia.
