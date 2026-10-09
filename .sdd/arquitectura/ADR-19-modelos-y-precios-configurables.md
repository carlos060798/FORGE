# ADR-19: Modelos y precios en la configuración, con una tabla incluida y fechada

> Estado: aceptada  # propuesta | aceptada | obsoleta | reemplazada-por-ADR-XX
> Fecha: 2026-10-09 (aceptada por delegación del dueño el 2026-10-09)
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
- **D. Configuración que manda sobre una tabla incluida y fechada**: aceptada. Funciona sin configurar nada y deja corregir sin esperar una versión.

## Consecuencias

### Positivas
- El gasto calculado se puede corregir el mismo día que cambia un precio.
- La antigüedad de la tabla es visible.

### Negativas
- El lector mínimo de YAML (`core/ciclo/config.js`) solo entiende claves escalares de un nivel: hay que ampliarlo o usar claves planas (`precio_<modelo>_entrada`).
- Un operador puede poner un precio más bajo que el real y gastar más de lo que el ciclo cree. Lo mitiga la comparación con el gasto real de la FASE 6.

### Neutrales
- La caché de prompts (spec `2026-10-09-puesta-al-dia`) añadirá dos precios más por modelo sobre este mismo mecanismo.

## Cómo quedó implementada

- Datos: `core/precios.js` (`REVISADA`, `FUENTE`, `TABLA` en USD por millón de tokens, con los precios de caché ya anotados). `core/session-budget.js` lee de ahí y conserva sus exportaciones.
- Formato elegido para los precios: claves planas `<identificador>_entrada` y `<identificador>_salida` dentro de `precios:`. Para ello `leerSeccion` acepta claves con guiones y puntos, y claves entre comillas (necesarias si el identificador lleva dos puntos).
- `modelos:` llega a los proveedores por `crearProvider`, que lo pasa en `config.modelos`; `resolveModelId` lo consulta antes que su lista propia. El proveedor de pruebas no lo usa.
- Validación en `leerConfigCiclo`: se lanza un error que nombra la clave.
- Aviso de modelo sin precio: evento `ciclo:precio_desconocido` desde `invocar` (`core/ciclo/nodos.js`).
- «El más caro conocido» toma por separado la entrada más cara y la salida más cara de la lista incluida y de lo configurado.

Caché de prompts (spec `2026-10-09-puesta-al-dia`): el gasto del ciclo cobra además la escritura (caché de 5 minutos) y la lectura de caché con `cache_escritura_5m` y `cache_lectura` de la tabla (`preciosCache`, `precioCompletoDe`). Claves opcionales en `precios:`: `<identificador>_cache_escritura` y `<identificador>_cache_lectura`. Un modelo sin ellas cobra la lectura al precio de entrada y la escritura a 1,25 veces.

Pendiente: los precios de OpenAI no se contrastaron; el tramo caro de Claude Haiku 5.5 (más de 100 000 tokens de entrada) no se contempla; el acumulador `SessionBudget` del modo clásico sigue usando solo la lista incluida.

## Cuándo revisitar

Si un proveedor ofrece el costo exacto en cada respuesta, se usa ese dato y la tabla queda como respaldo.

## Referencias

- `.sdd/arquitectura/ADR-06-presupuesto-en-el-estado.md`
- `PLAN-CIERRE-BRECHAS.md`, FASE 6 (6.2)
