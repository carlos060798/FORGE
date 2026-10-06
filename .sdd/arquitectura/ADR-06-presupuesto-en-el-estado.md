# ADR-06: Presupuesto como libro de costos dentro del estado del ciclo

> Estado: aceptada  # propuesta | aceptada | obsoleta | reemplazada-por-ADR-XX
> Fecha: 2026-10-03 (aceptada el 2026-10-05, por delegación del dueño)
> Spec relacionada: 2026-10-03-ciclo-verificado
> Autor: Claude (pendiente de aceptación por el dueño)

## Contexto

`SessionBudget` solo avisa: no bloquea ni degrada, vive en memoria y cobra cualquier modelo desconocido a precio de sonnet (`core/session-budget.js:7-15,30-45`). El proveedor Anthropic, sin SDK o sin clave, devuelve un texto de relleno como éxito y sin tokens (`core/llm-providers/anthropic-provider.js:37-40`), lo que en un ciclo gastaría iteraciones sin producir nada. Los documentos de partida proponían LiteLLM, que es Python.

## Decisión

Un módulo puro `core/ciclo/presupuesto.js` lleva el libro de costos dentro de `EstadoCiclo.presupuesto`:

- Tope de $2.00 por sesión y umbral de degradación de $1.50, configurables en `presupuesto:`. `FORGE_BUDGET_USD` se mantiene como override.
- Estados: `ok`, `degradado` (≥ umbral), `agotado` (≥ tope).
- Comprobación previa a cada llamada: en `agotado` no se inicia ninguna.
- En `degradado`, el alias de modelo baja un escalón (`opus → sonnet → haiku`) o cambia al proveedor local configurado.
- La tabla de precios pasa a ser por proveedor: local a 0; modelo desconocido a un precio conservador configurable.
- Una respuesta de un proveedor real sin `usage` es un error.

Al vivir en el estado, el gasto se guarda en cada punto de guardado y sobrevive a la reanudación.

## Alternativas consideradas

- **A. LiteLLM**: rechazada porque es Python y `core/llm-providers` ya enruta cuatro proveedores.
- **B. Mantener solo el aviso actual**: rechazada porque no cumple el Principio VIII.
- **C. Tope por tokens**: rechazada porque el dueño piensa en dinero y los precios difieren entre modelos.
- **D. Libro de costos en el estado, con comprobación previa**: aceptada.

## Consecuencias

### Positivas
- El exceso máximo queda acotado al costo de una llamada (`maxTokens: 8192`, `core/agent-registry.js:149`).
- El gasto es reanudable y auditable.

### Negativas
- La tabla de precios hay que mantenerla a mano.
- Cambia el comportamiento de los proveedores ante la falta de `usage`; hay que proteger el modo clásico.

### Neutrales
- El singleton `SessionBudget` se conserva para `forge status` y el panel.

## Cuándo revisitar

- Cuando el dueño resuelva si el presupuesto es por sesión o por tarea.
- Cuando resuelva si la degradación es al mismo proveedor o a uno local.

## Referencias

- `core/session-budget.js`, `core/llm-providers/index.js:76-118`, `core/llm-providers/anthropic-provider.js:37-40`
- `../doc/documento_de_soporte_t_cnico_y_comercial.md` §2.B
