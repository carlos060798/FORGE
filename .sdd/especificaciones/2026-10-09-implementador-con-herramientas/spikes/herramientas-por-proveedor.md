# Spike: llamada con herramientas en cada proveedor

> Fecha: 2026-10-09 · Spec: `2026-10-09-implementador-con-herramientas` · ADR-21 · FASE 8.1 de `PLAN-CIERRE-BRECHAS.md`
>
> Pregunta: qué forma tiene una conversación con herramientas en cada proveedor de `core/llm-providers/`, y cuáles la van a admitir en esta entrega.
>
> Método: lectura de la documentación oficial de Anthropic el 2026-10-09 (URLs abajo) y del código de los cuatro proveedores. **No se llamó a ninguna API**: nada de lo que sigue se ha comprobado contra un modelo real.

## 1. Anthropic (API de mensajes)

Fuentes consultadas el 2026-10-09:

- Definir herramientas: <https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools>
- Bloques `tool_use` y `tool_result`: <https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls>
- Motivos de parada: <https://platform.claude.com/docs/en/api/handling-stop-reasons>

### Petición

Las herramientas van en el parámetro `tools` de `messages.create`. Cada una:

| Campo | Qué es |
|---|---|
| `name` | Debe cumplir `^[a-zA-Z0-9_-]{1,128}$` |
| `description` | Texto: qué hace, cuándo usarla, qué devuelve. La documentación insiste en que sea detallada |
| `input_schema` | JSON Schema de la entrada |

`tool_choice` es `auto` por defecto cuando hay herramientas: el modelo decide si pide una o responde. No se fuerza ninguna (los modelos más recientes rechazan `any` y `tool` con un error 400, según esa misma página).

### Respuesta

Cuando el modelo pide una acción, `stop_reason` es `tool_use` y `content` trae uno o más bloques:

```json
{ "type": "tool_use", "id": "toolu_01A09q90qw90lq917835lq9", "name": "get_weather", "input": { "location": "San Francisco, CA" } }
```

Pueden ir precedidos de bloques `text`. Un turno puede pedir varias herramientas.

### Devolver el resultado

En un mensaje nuevo con `role: "user"`, un bloque por herramienta pedida:

```json
{ "type": "tool_result", "tool_use_id": "toolu_01A09q90qw90lq917835lq9", "content": "15 degrees", "is_error": true }
```

`content` puede ser un texto; `is_error` es opcional. Reglas que la documentación marca como obligatorias:

- El mensaje con los resultados va **inmediatamente después** del mensaje del asistente que pidió las herramientas.
- Los bloques `tool_result` van **primero** en ese mensaje; cualquier texto, después. Lo contrario es un error 400.
- La página de motivos de parada desaconseja añadir texto tras los resultados: el modelo aprende a esperar una intervención y puede cerrar el turno vacío. El bucle envía solo los resultados.

Sobre el contenido no fiable, la documentación dice que debe ir dentro de bloques `tool_result` y no en el prompt de sistema ni en texto del usuario. Es lo que hace el bucle con el contenido de los archivos leídos. No es la frontera de seguridad: la frontera son las reglas de ruta y el aislamiento (HU-007).

### Motivos de parada

| `stop_reason` | Qué significa | Qué hace el bucle |
|---|---|---|
| `tool_use` | Pide una o más herramientas | Las ejecuta y devuelve los resultados |
| `end_turn` | Terminó | Fin del intento: pruebas finales |
| `max_tokens` | Se alcanzó `max_tokens`; el último bloque `tool_use` puede estar incompleto | No ejecuta las herramientas de esa respuesta; devuelve un error por cada una y el modelo repite con algo más pequeño. Si no pedía ninguna, le pide continuar |
| `stop_sequence` | Emitió una secuencia de parada | No se usan: se trata como fin |
| `refusal` | Se negó a responder | Sin herramientas pedidas: fin del intento |
| `pause_turn`, `model_context_window_exceeded` | Herramientas de servidor / ventana llena | Sin herramientas pedidas: fin del intento |

La documentación propone, ante `max_tokens` con un `tool_use` cortado, reintentar la petición con un `max_tokens` mayor. Aquí no se hace: reintentar es pagar otra vez la misma respuesta, y pedir al modelo una acción más pequeña cuesta un turno, que ya está acotado.

### Bloques que no son texto ni herramienta

Una respuesta puede traer otros bloques (por ejemplo, de razonamiento). Hay que devolverlos tal cual en el historial. El proveedor los conserva como bloques `opaco` y los reenvía sin tocarlos. **No probado contra la API**: el proveedor no activa el razonamiento y no se ha visto ninguna respuesta real con esos bloques.

### Lo que NO se hace en esta entrega

- **Caché de prompts.** El prompt de sistema, las herramientas y el historial se reenvían enteros en cada turno. La caché es de otra spec (`2026-10-09-puesta-al-dia`) y otro agente la está añadiendo a `complete`; `conversar` no la usa. Consecuencia: los tokens de entrada crecen con cada turno.
- **`strict: true`** en las herramientas (entradas garantizadas contra el esquema). Las herramientas validan su entrada y devuelven el error al modelo.
- **Streaming** y herramientas de servidor.

## 2. OpenAI y compatibles

`core/llm-providers/openai-provider.js` usa `fetch` contra `/chat/completions` con un mensaje de sistema y otro de usuario. La API tiene su propia forma de llamar funciones (lista de funciones en la petición, llamadas en el mensaje del asistente y un rol aparte para los resultados), distinta de la de Anthropic, y el proveedor sirve además a Azure, GitHub Models y cualquier endpoint compatible, cada uno con su grado de soporte.

**Decisión: no la admite en esta entrega.** `admiteHerramientas` devuelve `false`. No se consultó su documentación ni se probó nada: la forma exacta queda por comprobar cuando se implemente.

## 3. Ollama

`core/llm-providers/ollama-provider.js` usa `/api/chat`. Qué modelos locales admiten herramientas y con qué fiabilidad es la asunción sin comprobar de la spec (§9), y sigue sin comprobar.

**Decisión: no la admite en esta entrega.** `admiteHerramientas` devuelve `false`. Consecuencia para `presupuesto.degradar_a: local`: al cruzar el umbral, el implementador por turnos no puede seguir con el modelo local. Si ya escribió algo, se ejecutan las pruebas finales; si no, se pide revisión y al continuar trabaja en modo de bloque.

## 4. Proveedor de pruebas (`stub`)

Guionizable: `new StubProvider({ guion: [...] })`, o `FORGE_STUB_GUION=<archivo.json>` cuando lo crea `crearProvider`. Cada elemento es una respuesta de `conversar` en la forma neutra. Sin guion, `admiteHerramientas` es `false` y todo sigue como antes. Antes de responder comprueba que la conversación recibida cumple las reglas de la sección 1 (roles alternos, cada herramienta pedida con su resultado en el mensaje siguiente, resultados primero): un bucle mal formado falla en los tests en lugar de fallar contra la API.

## 5. Contrato resultante

Método nuevo y opcional en `LlmProvider`; `complete` no cambia.

```
admiteHerramientas → boolean                     (por defecto, false)
conversar({ model, systemPrompt, mensajes, herramientas, maxTokens, signal })
    → { contenido: Bloque[], stopReason, inputTokens, outputTokens }

mensajes      [{ rol: 'usuario' | 'asistente', contenido: string | Bloque[] }]
herramientas  [{ nombre, descripcion, esquema }]
Bloque        { tipo: 'texto', texto }
            | { tipo: 'uso_herramienta', id, nombre, entrada }
            | { tipo: 'resultado_herramienta', idUso, contenido, esError }
            | { tipo: 'opaco', crudo }
stopReason    'herramientas' | 'fin' | 'max_tokens' | 'rechazo' | 'otro'
```

La forma es neutra a propósito (Principio III): el bucle de `core/ciclo/turnos.js` no conoce la de ningún proveedor.

| Proveedor | `admiteHerramientas` | Probado |
|---|---|---|
| `anthropic` | Sí, con clave de API (o con un cliente del SDK inyectado, en tests) | Solo con un cliente falso del SDK: se comprueba la traducción en los dos sentidos, no la API |
| `stub` | Sí, con guion | Sí |
| `openai` (y compatibles) | No | Se comprueba que lo declara y que el ciclo usa el modo de bloque |
| `ollama` | No | Ídem |

## 6. Segundo spike del plan: reanudar a mitad de una conversación

Se resolvió con el diseño y sus tests, no con un documento aparte. Está descrito en la cabecera de `core/ciclo/turnos.js`, en ADR-21 («Cómo quedó implementada») y probado en `tests/ciclo-turnos.test.js` («HU-005 — reanudar sin pagar dos veces»).

## Preguntas que deja abiertas

- ¿Cuántos tokens de entrada cuesta de verdad una tarea por turnos sin caché? Solo se sabrá con un modelo de pago (ver `verificacion.md`).
- ¿Devuelve la API bloques de razonamiento con los modelos configurados por defecto? Si los devuelve, el reenvío como `opaco` es lo previsto, pero no está probado.
- Forma exacta y fiabilidad de las herramientas en OpenAI y en modelos locales.
