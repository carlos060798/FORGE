# ADR-11: Revisión humana por interrupción y decisión en `forge resume`

> Estado: aceptada  # propuesta | aceptada | obsoleta | reemplazada-por-ADR-XX
> Fecha: 2026-10-03 (aceptada el 2026-10-05, por delegación del dueño)
> Spec relacionada: 2026-10-03-ciclo-verificado
> Autor: Claude (pendiente de aceptación por el dueño)

## Contexto

HU-005 exige pausar y pedir decisión a una persona. En el documento de partida, `human_review` era una salida del router sin nodo que la atendiera. El motor corre sin terminal interactiva en CI, y no hay API de escritura (`ui/server.js` es de solo lectura).

## Decisión

Un nodo `revision_humana` interrumpe el ciclo y guarda el motivo y un resumen. El proceso termina con un código de salida propio y el evento `task_paused`. La decisión llega por:

```
forge resume --decision continuar|aceptar|abortar [--iteraciones-extra N] [--presupuesto-extra USD]
```

- `continuar`: amplía los topes y vuelve a `coder`.
- `aceptar`: termina como `aceptada_por_humano`; queda registrado que no pasó las pruebas.
- `abortar`: termina y restaura los archivos desde `.sdd/motor/<runId>/respaldo/`.

Sin `--decision`, `forge resume` muestra el motivo y sale con código distinto de cero sin gastar nada. Con LangGraph.js se usan `interrupt()` y `Command({ resume })`; el nodo no tiene efectos antes de la interrupción, porque al reanudar se vuelve a invocar desde el principio.

## Alternativas consideradas

- **A. Pregunta interactiva en la terminal**: rechazada porque bloquea en CI.
- **B. Endpoint HTTP**: rechazada por alcance; es la spec S4.
- **C. Archivo de decisión que el operador edita**: rechazada por propensa a errores.
- **D. Interrupción y flag en `forge resume`**: aceptada.

## Consecuencias

### Positivas
- Funciona en terminal y en CI.
- Toda decisión queda en el registro de eventos.

### Negativas
- El operador debe relanzar un comando para decidir.
- `replayTaskStates` necesita un estado nuevo, "en revisión" (`core/event-log.js:83-103`).

### Neutrales
- S4 añadirá la misma decisión por HTTP sobre el mismo mecanismo.

## Cuándo revisitar

- Al implementar S4.
- Cuando el dueño decida si "aceptar" exige justificación escrita.

## Referencias

- `core/engine-cli.js:124-127`, `core/event-log.js:83-103`, `ui/server.js`
- `../doc/estructura_de_implementaci_n_para_el_agente_cursor_claude.md` §3
