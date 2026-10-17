# Spike S0.3: subconjunto de JSON Schema que cubre los esquemas y un validador sin dependencias

> Experimento ejecutado (2026-10-17): un validador de ~30 líneas (prototipo en el directorio temporal de la sesión, NO añadido al repositorio) validando la salida real de `crearResultado` contra un esquema escrito a mano.

## Qué palabras clave usan hoy `core/schemas/*.json`

Recuento por `grep` en los tres esquemas: `$schema, $id, title, description, type, properties, required, items, enum, const, minimum, maximum, minItems, maxItems, format`. `type` aparece también como unión (`["number","null"]` en `estado.schema.json`). **No** usan `$ref`, `$defs`, `oneOf/anyOf/allOf/not/if`, `pattern`, `additionalProperties`, `patternProperties`. (Contrastado con el ejemplo: ninguna palabra clave de `ir.schema.json` queda fuera del conjunto de abajo.)

## Subconjunto propuesto (validador cerrado: lo que no conoce, lanza)

`type` (cadena o lista; `integer`, `number`, `string`, `boolean`, `object`, `array`, `null`), `properties`, `required`, `additionalProperties` (booleano o esquema), `items` (esquema único), `enum`, `const`, `minimum`, `maximum`, `minLength`, `maxLength`, `minItems`, `maxItems`, `pattern` (solo con `RegExp` de JS, sin banderas), más anotaciones ignoradas: `$schema, $id, title, description, default, format` (anotación, no se valida), y la extensión `x-interno`.

Quedan **fuera a propósito** (la prueba del rechazo): `$ref/$defs`, `oneOf/anyOf/allOf/not/if-then-else`, `patternProperties`, `dependentRequired`, `uniqueItems`, tuplas (`items` array / `prefixItems`). Si un campo necesita una unión de formas (p. ej. `registro` = null | `{id,archivo}` | `{error}`) se modela con `type:["object","null"]` y propiedades opcionales, con las reglas finas como «regla adicional» en código.

## Resultado del prototipo

- Con el esquema a mano de `resultado-verificar`, `crearResultado` real valida sin errores (`[]`).
- Con `{ ...r, veredicto: 'quizas', extra: 1 }` devuelve exactamente dos errores: `$.veredicto: fuera de enum` y `$: campo adicional extra`.
- Con una palabra clave no soportada (`oneOf`) **lanza** `palabra clave no soportada: oneOf en $` (CA-002-01: el esquema con palabra no soportada se rechaza).
- Ya existe un precedente en el repo: `validarArgumentos` (`core/mcp/protocolo.js:81-95`) valida `required`, desconocidos, `type:'string'`, `enum`, `maxLength`. Es más débil (no mira `number/array/object`, ignora `additionalProperties`, no recursa): conviene que el nuevo `core/schemas/validador.js` lo **sustituya** y MCP lo use, para tener una sola implementación (el MCP necesita validar `archivos: array de string` en `verificar`, que `validarArgumentos` no sabe).

## Decisiones

- Posible y barato: el validador sin dependencias cabe en ~80 líneas con mensajes de ruta. Estimación de coste: 1 jornada con pruebas (F1.1-F1.3).
- Mensajes de error con ruta (`$.mutacion.archivos[2]`) y un máximo de errores (p. ej. 20) para que un artefacto enorme no llene la salida.
- El validador lo ejecutan las **pruebas** (CA-002-02/-04) y el comando `esquema`/`validar` de solo lectura; **no** debe validar en caliente en `forge verificar` (añadiría un modo de fallo al veredicto).

## Qué cambia en la spec o el plan

- Spec: fijar esta lista como el «subconjunto», con su prueba de rechazo; los esquemas nuevos no pueden usar nada fuera de ella.
- Plan: `validarArgumentos` del MCP pasa a ser un cliente del nuevo validador (cambio en `core/mcp/protocolo.js`, tarea de `ciclo-por-mcp`, coordinar).
- `format` queda anotación: advertir en la doc que `date-time` NO se valida.

## Riesgos

- Un validador propio es superficie propia: cubrir con pruebas de propiedades pequeñas (los tipos anidados y `additionalProperties:false` son donde más se falla).
- `pattern` con expresiones regulares patológicas (ReDoS) sobre datos del proyecto: límite de longitud de cadena antes de aplicarlo.
