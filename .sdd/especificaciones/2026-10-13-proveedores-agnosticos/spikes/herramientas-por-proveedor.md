# Spike S0.1 — Herramientas por proveedor (OpenAI chat completions y Ollama /api/chat)

Consultado el 2026-10-13. **[confirmado]** = visto hoy en documentación oficial; **[sin confirmar]** = no verificado en página oficial (la referencia de chat completions de OpenAI devolvió 404 y la guía solo cubre la API de respuestas).

## Fuentes
- OpenAI, guía de function calling: https://developers.openai.com/api/docs/guides/function-calling (2026-10-13).
- OpenAI, referencia chat completions: https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create — 404, no consultada.
- Ollama, tool calling: https://docs.ollama.com/capabilities/tool-calling (2026-10-13).
- Ollama, /api/chat: https://docs.ollama.com/api/chat (2026-10-13).

## Hallazgo importante
La guía de OpenAI dice que GPT-6 Astra y GPT-6.1 Sol requieren la API de respuestas para llamar a herramientas [confirmado]. Con chat completions esos modelos no sirven para `conversar`. La spec excluye la API de respuestas: los niveles por defecto deben ser modelos que sí admitan herramientas en chat (cuáles, sin confirmar) y el proveedor debe dar un error claro si el servidor las rechaza.

## OpenAI chat completions
| Aspecto | Forma |
|---|---|
| Petición | `tools: [{type:'function', function:{name, description, parameters}}]` [sin confirmar la forma exacta] |
| Estricto | `strict: true` opcional; por defecto no estricto en chat [confirmado]. Estricto exige `additionalProperties:false` y todos los campos en `required`, si no se rechaza [confirmado]. FORGE: no usarlo. |
| Paralelas | Varias llamadas por turno; `parallel_tool_calls:false` limita a cero o una [confirmado] |
| `tool_choice` | `auto`, `required`, función concreta, `allowed_tools`, `none` [confirmado que existen; campo exacto sin confirmar]. FORGE: omitir. |
| Respuesta | `choices[0].message.tool_calls[] = {id, type:'function', function:{name, arguments}}`; `content` puede ser null [sin confirmar] |
| Argumentos | Cadena JSON, puede ser inválida o truncada [sin confirmar] |
| Resultado | `{role:'tool', tool_call_id, content: string}`, uno por llamada, tras el mensaje del asistente con `tool_calls` [sin confirmar] |
| Parada | `finish_reason`: `stop`, `length`, `tool_calls`, `content_filter` (y `function_call` heredado) [sin confirmar] |
| Rechazo | `message.refusal` no nulo [sin confirmar] |
| Límite | `max_tokens` obsoleto a favor de `max_completion_tokens`; los modelos de razonamiento rechazan `max_tokens` [sin confirmar]. Hoy `complete()` envía `max_tokens` (openai-provider.js:67). Un punto compatible puede exigir `max_tokens`. |
| Uso | `usage.prompt_tokens`, `completion_tokens`; `prompt_tokens_details.cached_tokens` incluido en `prompt_tokens` [sin confirmar] |
| Errores | HTTP 4xx/5xx con `{error:{message,type,code}}` [sin confirmar] |

## Ollama /api/chat
| Aspecto | Forma |
|---|---|
| Petición | `tools: [{type:'function', function:{name, description?, parameters}}]` [confirmado] |
| `stream` | Por defecto `true` [confirmado]; enviar `stream:false` (ya lo hace `complete`) |
| Respuesta | `message.tool_calls[] = {function:{name, arguments}}`; `arguments` es un objeto, no cadena [confirmado]. Sin `id` documentado [confirmado] |
| Paralelas | Varias `tool_calls` en un mensaje; un mensaje `tool` por llamada [confirmado] |
| Resultado | `{role:'tool', content: string}`; la guía usa `tool_name`, el esquema de /api/chat no lo documenta [confirmado la discrepancia] |
| Parada | `done:true` y `done_reason` (ejemplo `stop`); otros valores no documentados [sin confirmar: en la práctica `length`] |
| Límite | `options.num_predict` [confirmado] |
| Uso | `prompt_eval_count`, `eval_count`, `prompt_eval_cached_count` [confirmado] |
| Errores | JSON de error no documentado; un modelo sin herramientas suele dar HTTP 400 «does not support tools» [sin confirmar] |
| Pensamiento | `message.thinking`, parámetro `think` [confirmado]; ignorar al traducir |

## Tabla de traducción propuesta (neutra a proveedor)
| Neutro | OpenAI | Ollama |
|---|---|---|
| `systemPrompt` | mensaje `{role:'system'}` primero | ídem |
| `herramientas[{nombre,descripcion,esquema}]` | `{type:'function', function:{name:nombre, description:descripcion, parameters:esquema}}` | ídem |
| mensaje `usuario` con texto | `{role:'user', content}` | ídem |
| `asistente` con `uso_herramienta` | `{role:'assistant', content: texto o null, tool_calls:[{id, type:'function', function:{name:nombre, arguments: JSON.stringify(entrada)}}]}` | `{role:'assistant', content, tool_calls:[{function:{name, arguments: entrada}}]}` |
| `resultado_herramienta{idUso, contenido, esError}` | un `{role:'tool', tool_call_id:idUso, content}` por resultado; si `esError`, anteponer «ERROR: » (no hay `is_error`) | `{role:'tool', tool_name, content}`; mapear `idUso` a nombre mediante el id sintético |
| mensaje de usuario con varios resultados | se expande a N mensajes `tool`, en el orden de las llamadas | ídem |
| `uso_herramienta.entrada` | `JSON.parse(arguments)`; si falla, se devuelve al modelo como resultado con error (CA-002-04) | `arguments` tal cual; si no es objeto, error de herramienta |
| `uso_herramienta.id` | `tool_calls[i].id` | sintético (`ollama-<turno>-<i>`) |
| `stopReason` | `tool_calls`=`herramientas`; `stop`=`fin`; `length`=`max_tokens`; `content_filter` o `refusal`=`rechazo`; otro=`otro` | si hay `tool_calls`=`herramientas` (aunque `done_reason` sea `stop`); `stop`=`fin`; `length`=`max_tokens`; otro=`otro` |
| `maxTokens` | `max_completion_tokens` (reserva a `max_tokens` para compatibles) | `options.num_predict` |
| `inputTokens` | `prompt_tokens` menos `cached_tokens`; la caché a `cacheReadTokens` | `prompt_eval_count` |
| `outputTokens` | `completion_tokens` | `eval_count` |
| `opaco` | no hace falta; ignorar | ignorar |

Notas:
- En Ollama decidir «hay herramientas» por la presencia de `tool_calls`, no por `done_reason`.
- `tool_calls` con `finish_reason: length` implica argumentos truncados: tratar como `max_tokens`.
- La clave va solo en `Authorization`; redactar el cuerpo del error antes de lanzarlo (openai-provider.js:73 hoy corta a 200 caracteres sin redactar).
