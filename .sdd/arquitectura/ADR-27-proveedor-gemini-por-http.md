# ADR-27: Proveedor Gemini por HTTP directo, sin SDK

> Estado: propuesta (pendiente de aceptación formal del dueño)  # propuesta | aceptada | obsoleta | reemplazada-por-ADR-XX
> Fecha: 2026-11-26
> Spec relacionada: 2026-10-13-proveedores-agnosticos (HU-007)
> Autor: Claude (pendiente de aceptación por el dueño)
> Evidencia: documentación oficial de Gemini consultada el 2026-11-26 (URLs al final). Nada de lo de abajo se ha probado con la API real.

## Contexto

Hay tres proveedores reales (Anthropic, OpenAI, Ollama). El plan de huecos de agnosticismo (fase D1) pide un cuarto, Gemini. El Principio IV prohíbe dependencias nuevas sin ADR, y los otros proveedores HTTP ya usan `fetch`. La documentación oficial de Gemini está migrando a una API nueva («Interactions»); el método `generateContent` sigue documentado en la referencia.

## Decisión

Un `GeminiProvider` en `core/llm-providers/gemini-provider.js`, con `fetch` de Node, sin SDK.

**Forma de la API (`generateContent`).**
- `POST {base}/v1beta/models/{modelo}:generateContent`, con la clave en la cabecera `x-goog-api-key` (nunca en la URL, que acabaría en registros y en mensajes de error). La referencia consultada muestra la clave como parámetro `key` de la URL; la cabecera es la forma habitual de los ejemplos de `curl` de Google y **no se ha confirmado contra el servicio real**.
- Cuerpo: `contents` (lista de `{ role: 'user' | 'model', parts }`), `systemInstruction` (`{ parts: [{ text }] }`), `tools` (`[{ functionDeclarations: [{ name, description, parameters }] }]`) y `generationConfig.maxOutputTokens`. Una lista vacía de herramientas se omite.
- Respuesta: `candidates[0].content.parts[]` con `text`, `functionCall` (`name`, `args`, `id` opcional) o `thoughtSignature`; `candidates[0].finishReason`; `promptFeedback.blockReason` (con `candidates` ausente) cuando se bloquea el prompt; `usageMetadata` con `promptTokenCount`, `cachedContentTokenCount`, `candidatesTokenCount`, `thoughtsTokenCount`, `toolUsePromptTokenCount`.
- Esquema de herramientas: se envía como `parametersJsonSchema` (JSON Schema), sin `additionalProperties`, `$schema` ni `$id` (un informe de usuarios dice que el primero provoca `MALFORMED_FUNCTION_CALL`; no confirmado). El campo `parameters` (subconjunto de OpenAPI) es la alternativa. **Sin confirmar con la API real.**
- Las partes con `thought: true` (resúmenes de pensamiento) no son texto de la respuesta y no se devuelven como tal.

**Paradas.** `STOP` → `fin`; `MAX_TOKENS` → `max_tokens`; `SAFETY`, `PROHIBITED_CONTENT`, `BLOCKLIST`, `SPII`, `RECITATION`, `IMAGE_SAFETY` y un `blockReason` del prompt → `rechazo`; lo demás → `otro`. Si hay `functionCall` y la parada no es `max_tokens` ni `rechazo`, el turno es `herramientas` (Gemini devuelve `STOP` con llamadas).

**Ids por llamada.** La API admite un `id` en `functionCall` y `functionResponse`, pero no siempre lo trae. El proveedor usa el `id` si viene y, si no, genera uno único por respuesta (`gemini-sin-id-<marca>-<n>`). Al devolver resultados, el `functionResponse` lleva el `name` de la llamada original (se busca por `idUso` en el historial del asistente) y el `id` solo si la llamada lo traía de la API; un id inventado por el proveedor no se envía.

**`thoughtSignature`.** Los modelos con razonamiento devuelven una firma opaca en la misma parte que la llamada (en llamadas paralelas, solo en la primera) y exigen devolverla en esa parte exacta, o responden con un error 4xx. El proveedor conserva cada parte con firma como un bloque `{ tipo: 'opaco', crudo: <parte completa> }`, en el mismo orden en que llegó, y al reenviar la historia reproduce esa parte tal cual. Las llamadas paralelas se reenvían agrupadas (todas las `functionCall` en un mensaje `model`, todas las `functionResponse` en un mensaje `user`), sin intercalar, porque intercalarlas devuelve un 400. Una firma que falta no se inventa.

**Nombres de herramienta.** La documentación consultada da reglas distintas (letras, dígitos, guion bajo y guion; algunas fuentes añaden punto y dos puntos; máximo 64, y un foro dice 63). Se toma lo más estricto: todo carácter fuera de `[A-Za-z0-9_-]` pasa a `_`, el nombre empieza por letra o `_`, y se corta a 63. Si dos nombres distintos dan el mismo adaptado, el segundo recibe un sufijo numérico. El proveedor guarda la tabla adaptado → original por petición y traduce de vuelta el nombre que devuelve el modelo.

**Niveles y modelos.** `alto`, `medio` y `economico` (con `opus`, `sonnet`, `haiku` como alias, `niveles.js`) resuelven por defecto a `gemini-3.1-pro-preview`, `gemini-3.6-flash` y `gemini-3.1-flash-lite`, identificadores con precio en la tabla oficial del 2026-11-26; se pueden fijar con `modelos:` (ADR-19). `-preview` puede cambiar o retirarse con poco aviso. **Sin confirmar con la API real** que esos identificadores respondan por `generateContent` con una clave normal.

**Precios.** En `core/precios.js`, con fecha (`REVISADA_GEMINI`) y URL. Los Pro con tarifa por tramos (más de 200 000 tokens de entrada) se registran al tramo inferior, como Haiku 5.5 en Anthropic: FORGE no contempla el tramo alto. Hay subidas anunciadas (`gemini-3.8-flash` el 2027-01-01) que la tabla no recoge; la fecha de revisión lo dice y por eso el nivel medio no apunta a ese modelo. Los modelos `gemini-4-*` quedan fuera: su precio cambia el 2026-12-01.

**Caché y razonamiento.** Gemini cuenta `cachedContentTokenCount` dentro de `promptTokenCount` (como OpenAI): se separan para no contar dos veces. FORGE no crea cachés de Gemini. La salida suma `thoughtsTokenCount`, que se cobra como salida; `toolUsePromptTokenCount` se suma a la entrada.

**Detección por credenciales.** Solo `GEMINI_API_KEY` elige `gemini` **al final**: el orden es Anthropic, OpenAI, Ollama, Gemini. `GOOGLE_API_KEY` es la variable genérica de Google (Maps, Cloud, otros SDK) y **no** elige proveedor: sigue valiendo como clave una vez elegido `gemini` (corrección tras el juicio del 2026-11-26; decisión del dueño pendiente). Así nadie que hoy tenga otra señal cambia de proveedor. Quien tenga varias fija el proveedor con `FRAGUA_LLM_PROVIDER`.

**Dirección del servidor.** Por defecto `https://generativelanguage.googleapis.com`. `base_url` del proyecto sigue pasando por `sanearConfigDelProyecto` (solo loopback o un host permitido por el usuario); `GEMINI_BASE_URL` del entorno del usuario manda sobre el archivo. `redirect: 'error'` en cada llamada: una redirección no puede llevar la clave a otro servidor.

## Alternativas consideradas

- **A. SDK oficial (`@google/genai`)**: rechazada. Dependencia nueva sin necesidad (Principio IV); los otros proveedores HTTP no la tienen.
- **B. El endpoint compatible con OpenAI de Gemini, con `OpenAIProvider`**: rechazada como camino principal. Funciona con una `base_url`, pero pierde los precios y los motivos de parada propios, y la gestión de `thoughtSignature` en ese endpoint no está confirmada. Sigue siendo un uso posible que no se prohíbe.
- **C. API «Interactions»**: rechazada por ahora. La documentación la pone primero, pero `generateContent` es la documentada para herramientas con `thoughtSignature`; se reconsidera si Google retira `generateContent`.
- **D. HTTP directo con `generateContent` (elegida).**

## Consecuencias

### Positivas
- Cuarto proveedor sin dependencias; la batería común lo vigila.
- `ErrorProveedorDesconocido` sigue protegiendo los nombres mal escritos (`gemini` y `google` dejan de serlo).

### Negativas
- Todo lo de la API está contrastado solo con documentación y un servidor falso: **sin probar con la API real**. La documentación cambia (las páginas migraron de dominio durante la consulta).
- Los identificadores de modelo por defecto pueden dejar de existir.
- Cambio menor de comportamiento: quien tenga `GEMINI_API_KEY` y ninguna otra señal pasa del respaldo «Anthropic» a `gemini`. Se anota en el CHANGELOG.

## Fuentes (consultadas el 2026-11-26)

- https://aistudio.google.com/api-reference/generate-content (método, partes, `finishReason`, `usageMetadata`; antes https://ai.google.dev/api/generate-content)
- https://aistudio.google.com/docs/thought-signatures (firma en la misma parte; solo en la primera llamada paralela; 400 si falta)
- https://aistudio.google.com/docs/pricing (precios; antes https://ai.google.dev/gemini-api/docs/pricing)
- https://docs.cloud.google.com/gemini-enterprise-agent-platform/reference/models/function-calling (reglas de nombre de función)
