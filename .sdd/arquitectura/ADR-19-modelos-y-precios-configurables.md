# ADR-19: Modelos y precios en la configuración, con una tabla incluida y fechada

> Estado: propuesta  # propuesta | aceptada | obsoleta | reemplazada-por-ADR-XX
> Fecha: 2026-10-09
> Spec relacionada: 2026-10-09-validacion-modelo-real
> Autor: Claude (pendiente de aceptación por el dueño)

## Contexto

El tope de gasto (Principio VIII, ADR-06) se calcula multiplicando tokens por un precio. Ese precio sale de una tabla escrita en `core/session-budget.js:7-33`, y los identificadores de modelo de cada nivel están escritos en cada proveedor (`core/llm-providers/anthropic-provider.js:18-22`, y sus equivalentes). Tres problemas:

- La tabla no tiene fecha. Nombra modelos de generaciones anteriores a la actual y nadie puede saber si sus precios siguen vigentes.
- Cambiar un modelo o un precio exige publicar una versión.
- Un modelo desconocido se cobra al precio más caro de la tabla (`PRECIO_DESCONOCIDO`), lo cual es prudente, pero ocurre sin aviso.

La validación con un modelo real (FASE 6) no puede empezar si los identificadores ya no existen en el proveedor, y su comparación de gasto no vale nada con precios sin revisar.

## Decisión

Los modelos de cada nivel y sus precios se leen de `sdd.config.yaml`, y lo que el operador indique manda sobre una tabla incluida que lleva fecha de revisión.

- Sección `modelos:` con una clave por nivel (`opus`, `sonnet`, `haiku`) y sección `precios:` con entrada y salida por millón de tokens para cada identificador.
- La tabla incluida pasa a un único archivo de datos con un campo `revisada: AAAA-MM-DD`. `forge status` y `forge doctor` muestran esa fecha.
- Un modelo sin precio se sigue cobrando al más caro conocido, y además deja un evento en el registro con su nombre.
- Un precio no numérico o negativo impide empezar el ciclo (NO degradar en silencio).
- La tabla incluida se actualiza a los modelos vigentes del proveedor por defecto como parte de esta decisión. Los precios se copian de la página oficial del proveedor el día de la revisión, no de memoria.

## Alternativas consideradas

- **A. Dejar la tabla en el código y actualizarla en cada versión**: rechazada porque ata el tope de gasto al calendario de publicación y no resuelve la falta de fecha.
- **B. Consultar los precios al proveedor en línea**: rechazada porque el núcleo debe funcionar sin red salvo la llamada al modelo (Principio III) y porque no todos los proveedores lo ofrecen.
- **C. Adoptar una biblioteca que mantenga precios**: rechazada por el Principio IV.
- **D. Configuración que manda sobre una tabla incluida y fechada**: propuesta. Funciona sin configurar nada y deja corregir sin esperar una versión.

## Consecuencias

### Positivas
- El gasto calculado se puede corregir el mismo día que cambia un precio.
- La antigüedad de la tabla es visible.

### Negativas
- El lector mínimo de YAML (`core/ciclo/config.js`) solo entiende claves escalares de un nivel: hay que ampliarlo o usar claves planas (`precio_<modelo>_entrada`).
- Un operador puede poner un precio más bajo que el real y gastar más de lo que el ciclo cree. Lo mitiga la comparación con el gasto real de la FASE 6.

### Neutrales
- La caché de prompts (spec `2026-10-09-puesta-al-dia`) añadirá dos precios más por modelo sobre este mismo mecanismo.

## Cuándo revisitar

Si un proveedor ofrece el costo exacto en cada respuesta, se usa ese dato y la tabla queda como respaldo.

## Referencias

- `.sdd/arquitectura/ADR-06-presupuesto-en-el-estado.md`
- `PLAN-CIERRE-BRECHAS.md`, FASE 6 (6.2)
