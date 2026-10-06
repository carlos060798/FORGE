# ADR-08: Puerto Recuperador con implementación por archivos

> Estado: aceptada  # propuesta | aceptada | obsoleta | reemplazada-por-ADR-XX
> Fecha: 2026-10-03 (aceptada el 2026-10-05, por delegación del dueño)
> Spec relacionada: 2026-10-03-ciclo-verificado
> Autor: Claude (pendiente de aceptación por el dueño)

## Contexto

El grafo canónico incluye un nodo `retriever`, pero la memoria semántica queda para la spec S3. El repo no tiene base vectorial: los embeddings de `utils/hybrid-indexer.js:46-62` son un mock de 8 dimensiones. `@lancedb/lancedb` exige Node ≥22.

## Decisión

Se define un puerto `Recuperador` en `core/recuperacion/recuperador.js` con una fábrica. La implementación de esta spec, `recuperador-archivos.js`, reúne contexto sin índice previo: los archivos declarados en la tarea, los archivos objetivo del plan y los extractos de spec y plan correspondientes a los criterios de aceptación cubiertos, con un tope de bytes y una marca de truncado.

## Alternativas consideradas

- **A. Nodo vacío que no hace nada**: rechazada porque el implementador necesita contexto ya en esta entrega.
- **B. Base vectorial ahora**: rechazada por alcance y por el requisito de Node ≥22.
- **C. Enviar el proyecto entero**: rechazada por costo; es lo que el documento comercial critica.
- **D. Puerto con implementación por archivos**: aceptada porque es útil hoy y S3 solo registra otra implementación.

## Consecuencias

### Positivas
- CA-007-03: el ciclo funciona sin índice.
- S3 no toca el grafo.

### Negativas
- El contexto por archivos no encuentra código relevante que la tarea no declare.

### Neutrales
- El tope de bytes es configurable.

## Cuándo revisitar

- Al implementar S3.
- Si las tareas reales declaran sus archivos de forma incompleta con frecuencia.

## Referencias

- `utils/hybrid-indexer.js:46-62`, `docs/roadmap.md:49`
- `../doc/plan_de_ejecuci_n_forge_v2.md` Phase 4
