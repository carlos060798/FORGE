# Informe: revisión vigente del protocolo MCP y qué cambia para el servidor de FORGE

> Spec: `2026-10-09-puesta-al-dia`, HU-002 (CA-002-01). Tarea 9.2 de `PLAN-CIERRE-BRECHAS.md`.
> Fecha de la consulta: 2026-10-09.
> Fuente: solo la especificación oficial en `modelcontextprotocol.io`. No se usó ningún blog ni resumen de terceros.

## Conclusión

1. **La última revisión publicada es `2026-07-28`**, marcada como «current» en la página oficial de versiones.
2. Entre ella y la más reciente que aceptaba FORGE (`2025-06-18`) hay otra revisión ya cerrada, **`2025-11-25`**, que FORGE no aceptaba.
3. **`2026-07-28` sí cambia cosas para un servidor por entrada y salida estándar**, y no son menores: desaparece el saludo `initialize`. Un cliente que solo hable esa revisión no puede conectarse a un servidor que solo conozca el saludo.
4. La propia especificación describe cómo un servidor atiende a la vez a clientes de las dos épocas. **Se implementó así**, sin dejar de aceptar ninguna de las tres revisiones anteriores y añadiendo `2025-11-25`.

## Páginas consultadas

| Página | Para qué |
|--------|----------|
| https://modelcontextprotocol.io/specification/latest | Comprobar a qué revisión apunta «latest»: enlaza el esquema y las páginas de `2026-07-28` |
| https://modelcontextprotocol.io/specification/versioning | Estado de las revisiones. Dice textualmente: «The **current** protocol version is **2026-07-28**» |
| https://modelcontextprotocol.io/specification/2026-07-28/changelog | Cambios respecto a `2025-11-25` |
| https://modelcontextprotocol.io/specification/2025-11-25/changelog | Cambios respecto a `2025-06-18` |
| https://modelcontextprotocol.io/specification/2026-07-28/basic | Mensajes, `resultType`, códigos de error, campos obligatorios de `_meta` |
| https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning | Negociación de versión, error de versión no admitida, compatibilidad entre épocas |
| https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio | Transporte por entrada y salida estándar: mensajes, cancelación, cierre, sonda de compatibilidad |
| https://modelcontextprotocol.io/specification/2026-07-28/server/discover | `server/discover` |
| https://modelcontextprotocol.io/specification/2026-07-28/server/tools | `tools/list` y `tools/call` |
| https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/caching | `ttlMs` y `cacheScope` |
| https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/subscriptions | `subscriptions/listen` |
| https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/cancellation | `notifications/cancelled` |

**No se leyó** el esquema completo (`schema.ts`), ni las páginas de recursos, prompts, autorización, HTTP, peticiones de varias vueltas (MRTR), progreso, registro ni extensiones. Lo que se afirma abajo sale de la prosa de las páginas de la tabla.

## Qué cambia en `2025-11-25` (respecto a `2025-06-18`)

Para un servidor por entrada y salida estándar que solo ofrece herramientas, **nada obligatorio**:

- Iconos opcionales en herramientas; campo `description` opcional en la identidad del servidor. FORGE no los usa.
- Guía de nombres de herramientas (letras, cifras, `_`, `-`, `.`; hasta 128 caracteres). Los tres nombres de FORGE ya la cumplen.
- Los errores de validación de los argumentos deben devolverse como error de la herramienta (`isError`), no como error del protocolo. FORGE ya lo hacía.
- JSON Schema 2020-12 como dialecto por defecto. Los esquemas de FORGE son un subconjunto simple, válido en ese dialecto.
- Se aclara que un servidor puede escribir cualquier registro en la salida de errores. FORGE ya lo hacía.
- Lo demás es autorización, HTTP, muestreo, peticiones al usuario y tareas experimentales: no aplica.

Por eso `2025-11-25` se añade a las revisiones con saludo sin más cambio que aceptarla.

## Qué cambia en `2026-07-28` para un servidor por entrada y salida estándar

Citas del registro de cambios oficial («Major changes», salvo que se indique):

| Cambio | Cita | Qué supone para `core/mcp/protocolo.js` |
|--------|------|------------------------------------------|
| Sin saludo | «Make MCP stateless: remove the `initialize`/`notifications/initialized` handshake. Every request now carries its protocol version and client capabilities in `_meta`» | Cada petición se valida sola. `io.modelcontextprotocol/protocolVersion` y `io.modelcontextprotocol/clientCapabilities` son obligatorios; si falta alguno, error `-32602` |
| Versión no admitida | «Version mismatches return `UnsupportedProtocolVersionError`» (código `-32022` tras la renumeración del cambio menor 12) | Error `-32022` con `data: { supported, requested }` |
| Descubrimiento | «Add `server/discover`: servers MUST implement this RPC» | Método nuevo y obligatorio: versiones, capacidades, identidad e instrucciones |
| `resultType` | «All results now carry a required `resultType` field» | Todos los resultados sin estado llevan `resultType: "complete"` |
| Identidad | «servers SHOULD identify themselves in each result's `_meta` (`io.modelcontextprotocol/serverInfo`)» | Se añade a cada resultado |
| Pistas de caché | (menor 5) «Require `ttlMs` and `cacheScope` fields on results returned by `tools/list`…» y, en la página de caché, también `server/discover` | `ttlMs: 300000` y `cacheScope: "public"` en `tools/list` y `server/discover` |
| Orden estable | (menor 3) «Servers SHOULD return tools from `tools/list` in a deterministic order» | Ya era así (orden de registro) |
| Métodos retirados | «Remove `ping`, `logging/setLevel`, and `notifications/roots/list_changed`» | Para un cliente sin estado, `ping` devuelve `-32601`. Con saludo sigue respondiendo |
| Suscripciones | «Replace the HTTP GET endpoint and `resources/subscribe`/`resources/unsubscribe` with `subscriptions/listen`» | Ver «Dudas» |
| Cancelación en stdio | Página de stdio: «Servers SHOULD stop work on a cancelled request as soon as practical and MUST NOT send any further messages for it» | Una petición sin estado cancelada ya no recibe respuesta |
| Peticiones del servidor al cliente | Página de stdio: «The server MUST NOT write JSON-RPC requests to stdout» | FORGE nunca las hizo |
| Códigos reservados | (menor 12) `-32020` a `-32099` reservados para la especificación | FORGE solo emite de ese rango `-32022` |

No aplican: sesiones y cabeceras de HTTP, reanudación de flujos SSE, tareas, peticiones de varias vueltas, autorización, recursos y prompts.

### Compatibilidad entre épocas (lo que permite no romper a nadie)

De la página de versiones, sección «Backward Compatibility with Initialization-Based Versions»:

> A server that wishes to support both legacy clients (which expect an `initialize` handshake) and modern clients (which use per-request metadata) **MAY** implement both behaviors.

> A dual-era **server** selects its behavior from how the client opens: a request carrying modern per-request `_meta` is served statelessly according to this revision. An `initialize` request selects legacy semantics, scoped to the stdio process (stdio) […] A dual-era server **MAY** serve both eras concurrently on the same endpoint or process.

Y de la página de stdio: un cliente que hable las dos épocas debería sondear con `server/discover`; si recibe el resultado o un error moderno reconocido (como el de versión no admitida), el servidor es moderno; con cualquier otro error, o sin respuesta, vuelve a `initialize`.

## Qué se hizo en el código

`core/mcp/protocolo.js` atiende las dos épocas y elige petición a petición:

- **Con saludo** (`VERSIONES`): `2025-11-25` (nueva), `2025-06-18`, `2025-03-26` y `2024-11-05`. Las respuestas tienen exactamente la forma de antes: sin `resultType`, sin `_meta`. `ping` sigue respondiendo.
- **Sin estado** (`VERSIONES_SIN_ESTADO`): `2026-07-28`. Una petición es de esta época si trae `io.modelcontextprotocol/protocolVersion` en `params._meta`, o si es `server/discover`. `initialize` siempre es de las de saludo.
- Las tres herramientas, sus reglas de escritura y su aislamiento no cambian: son las mismas funciones.

Pruebas: `tests/mcp-sin-estado.test.js` (protocolo en memoria y `forge mcp` como proceso real) y `tests/mcp-protocolo.test.js` (el de siempre, que ahora recorre también `2025-11-25`).

## Lo que NO está comprobado

- **No se probó con el cliente oficial del protocolo en la revisión nueva.** El paquete oficial no está instalado en este equipo y no se instalan dependencias para esta tarea. Las pruebas usan un cliente mínimo escrito a partir de la especificación: demuestran que el servidor hace lo que la prosa de la especificación pide según quien escribió las pruebas, no que un cliente real se entienda con él. Tampoco se comprobó si el cliente oficial publicado habla ya `2026-07-28`.
- No se validaron las respuestas contra el esquema oficial (`schema.ts` / `schema.json`).
- No se probó con Claude Code ni con ningún otro cliente real, en ninguna de las dos épocas, como parte de esta tarea.

## Dudas de interpretación

1. **Qué va en `supported` del error de versión no admitida.** El ejemplo oficial lista `["2026-07-28", "2025-11-25"]`, es decir, también una revisión con saludo. Pero el texto dice que el cliente «SHOULD select a mutually supported version from the `supported` list and retry the request», y reintentar tal cual con una revisión de saludo no funcionaría. FORGE pone en `supported` solo las revisiones sin estado y nombra las de saludo en el texto del mensaje. Lo mismo en `supportedVersions` de `server/discover`.
2. **Si `subscriptions/listen` es obligatorio** para un servidor que no tiene nada que notificar. La página general dice que toda implementación debe admitir «the message patterns»; la de suscripciones no lo dice de forma expresa. FORGE lo acepta con el filtro vacío (confirma la suscripción con `notifications: {}`, que significa «no llegará ningún aviso») y la deja abierta hasta que el cliente la cancele o cierre la entrada.
3. **Cierre de una suscripción.** La página de cancelación dice que el servidor debe enviar `notifications/cancelled` al desmontar una suscripción; la de suscripciones, que debería responder a la petición original. FORGE nunca las desmonta por su cuenta: terminan cuando el cliente las cancela o cuando se cierra la entrada, que la especificación cuenta como cierre del transporte.
4. **Cancelación con saludo.** No se cambió: la respuesta a una petición cancelada sigue llegando, como antes. Solo las peticiones sin estado dejan de recibirla.

## Cuándo revisar este informe

Cuando la página de versiones marque como «current» una revisión distinta de `2026-07-28`, o cuando se pueda probar con el cliente oficial.
