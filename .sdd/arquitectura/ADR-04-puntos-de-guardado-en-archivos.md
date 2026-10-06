# ADR-04: Puntos de guardado propios en archivos

> Estado: aceptada  # propuesta | aceptada | obsoleta | reemplazada-por-ADR-XX
> Fecha: 2026-10-03 (aceptada el 2026-10-05, por delegación del dueño)
> Spec relacionada: 2026-10-03-ciclo-verificado
> Autor: Claude (pendiente de aceptación por el dueño)

## Contexto

HU-006 exige reanudar desde el último paso completado. Hoy `forge resume` relanza las tareas desde cero (`core/engine-cli.js:124-127`) y el gasto vive en memoria (`core/session-budget.js`). El checkpointer SQLite oficial de LangGraph.js depende de `better-sqlite3`, un addon nativo; `node:sqlite` solo existe desde Node 22.5.

## Decisión

Un guardador propio, `core/ciclo/checkpoint-archivos.js`, escribe un punto de guardado después de cada nodo en `.sdd/motor/<runId>/checkpoints/`, con escritura atómica (archivo temporal y renombrado, como `core/state-store.js:72-74`). El hilo se identifica como `runId:taskId`. El estado guarda rutas y huellas de archivos, no su contenido. Un archivo de bloqueo por hilo impide dos reanudaciones simultáneas.

**Ajuste tras el spike T001 (2026-10-03).** Para el motor LangGraph, el guardador no implementa `BaseCheckpointSaver` desde cero: hereda de `MemorySaver` y vuelca sus mapas `storage` y `writes` a un archivo tras `put`, `putWrites` y `deleteThread`. El spike comprobó la reanudación en otro proceso y tras un corte. Contrapartida: esos dos campos no son API documentada, así que la versión se fija con `~` y un test debe fallar si cambian. Detalle en `.sdd/especificaciones/2026-10-03-ciclo-verificado/spikes/T001-langgraph.md`.

**Ajuste tras las revisiones independientes (2026-10-03).** El punto de guardado por nodo no bastaba:

- **Un corte dentro de un nodo** (después de pagar la respuesta de un modelo, antes de terminar el nodo) repetía la llamada y no la contabilizaba. Se añadió un **diario** (`core/ciclo/diario.js`): cada respuesta se anota en cuanto llega y, al reanudar, el mismo nodo la recupera en lugar de volver a pagarla. Se vacía al guardar el punto del nodo.
- **El gasto de sesión** dependía de que cada tarea llegara a guardar su estado. Pasa a un **libro** (`gasto.jsonl`) que suma llamada a llamada; el tope ampliado por una persona se guarda aparte (`tope.json`) y vale para toda la sesión.
- **El candado** se retiraba con una carrera (leer, borrar, crear). Pasa a `core/ciclo/candado.js`: se crea con un enlace duro desde un archivo ya completo y un candado huérfano se retira con `rename`, que solo gana uno. Hay además un candado de proyecto: un solo ciclo a la vez.
- Al reanudar se valida que el punto pertenezca a esta sesión y a este proyecto, y que el `runId` no pueda salir de `.sdd/motor`.

## Alternativas consideradas

- **A. Checkpointer SQLite oficial**: rechazada por el addon nativo (Principio IV) y el riesgo de compilación en Windows.
- **B. `node:sqlite`**: rechazada porque excluye Node 18 y 20.
- **C. Guardador en memoria**: rechazada porque no sobrevive a un corte.
- **D. Reutilizar `core/checkpoint.js`**: rechazada porque es de nivel tarea; aquí hace falta nivel nodo.
- **E. Archivos con escritura atómica**: aceptada porque funciona en toda la matriz y es coherente con `.sdd/`.

## Consecuencias

### Positivas
- Sin dependencias ni requisitos de runtime.
- Los puntos de guardado son legibles e inspeccionables.
- El mismo formato sirve a los dos motores (ADR-01).

### Negativas
- Hay que implementar el contrato del guardador de LangGraph.js, cuyo detalle está sin verificar.
- Sin transacciones: la detección de archivos dañados es responsabilidad propia (CA-006-02).

### Neutrales
- `.sdd/motor/` queda ignorado por git.

## Cuándo revisitar

- Si el spike T001 muestra que el contrato del guardador de LangGraph es frágil o cambia entre versiones menores: el motor propio pasa a ser el principal.
- Al retirar Node 18 y 20: valorar `node:sqlite`.

## Referencias

- `core/state-store.js:72-74`, `core/engine-cli.js:124-127`, `core/event-log.js:83-103`
- Registro npm: `@langchain/langgraph-checkpoint-sqlite` (consultado el 2026-10-03)
