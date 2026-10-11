# Verificación: Integraciones con GitHub, GitLab y Jira

> Spec: `spec.md` · Plan: `plan.md` · Tareas: `tareas.md`
> Estado: **fase F1 (núcleo) verificada; F2 a F6 sin empezar.** Este documento solo afirma lo que tiene una prueba corriendo hoy. Lo demás figura como pendiente.

## 1. Alcance de esta verificación

Se construyó el núcleo, sin adaptadores de proveedor ni CLI:

| Módulo | Archivo | Pruebas |
|---|---|---|
| Puerto (contrato) | `core/integraciones/puerto.js` | `tests/integraciones-puerto.test.js` |
| Configuración | `core/integraciones/config.js` | `tests/integraciones-config.test.js` |
| Texto de terceros como dato | `core/integraciones/confianza.js` | `tests/integraciones-confianza.test.js` |
| Cliente HTTP | `core/integraciones/http.js` | `tests/integraciones-http.test.js` |
| Auditoría, topes, interruptor | `core/integraciones/auditoria.js` | `tests/integraciones-auditoria.test.js` |
| Carga perezosa y aislamiento | (ningún módulo) | `tests/integraciones-aislamiento.test.js`, `tests/fixtures/integraciones-traza/` |

Cambio en código existente: solo el typedef `EventType` de `core/event-log.js` (cinco tipos `integracion:*`). `core/ciclo/config.js` NO se tocó: su `leerSeccion` lee la sección `integraciones:` tal cual, y un test comprueba que `leerConfigCiclo` devuelve lo mismo con y sin ella. Sin dependencias nuevas: `package.json` no cambia y un test comprueba que los módulos nuevos solo importan `node:*` y cuatro módulos internos conocidos.

## 2. Criterios de aceptación tocados por F1

Leyenda: **Cubierto** = hay prueba automática de lo que el criterio dice, en el alcance de F1. **Parcial** = la parte de F1 está probada y falta la que necesita adaptadores, CLI o ciclo. **Pendiente** = no se tocó.

| CA | Estado | Qué hay | Qué falta |
|---|---|---|---|
| CA-001-02 destinos permitidos, rechazo antes de la red | Parcial | `destinoPermitido` (igualdad exacta, sin comodines ni prefijos) y `pedir` (host fuera de la lista: 0 llamadas a `fetch`), en `integraciones-config` e `integraciones-http` | El flujo `forge integraciones leer` que los encadene (F2, F4) |
| CA-001-03 el texto es dato, no instrucción | Parcial | `comoDato`: delimitado con identificador por llamada, cabecera fija, acotado en bytes, redactado, sin marcadores de FORGE (`integraciones-confianza`, 16 casos hostiles × cuerpo, título, comentario y autor) | Que el ciclo lo use de verdad al armar la tarea (F2/F4) y la prueba de que no cambia reglas, topes ni herramientas (F5.3) |
| CA-001-04 texto hostil no cambia el resultado del ciclo | Pendiente | Solo las propiedades estructurales de la fila anterior | Extremo a extremo con el ciclo guionizado (F5.3). Una función pura no demuestra esto |
| CA-001-05 URL, imágenes y adjuntos no se siguen | Parcial | Las URL, enlaces e imágenes del texto pasan a texto inerte (`hxxps[:]//`, `[imagen: alt]`); el cliente HTTP no sigue redirecciones a otra ruta ni a otro host | Adjuntos: no hay adaptadores que los vean. Nada descarga hoy, pero no hay prueba en un adaptador real |
| CA-001-06 plataformas admitidas | Pendiente | Los hosts válidos se validan (Jira solo `*.atlassian.net`; GitLab con host propio) | Adaptadores (F2) |
| CA-002-02 el texto publicado se redacta y acota | Parcial | `comoDato` redacta (`redactarFormatos` y `redactar`) y acota; el mismo código sirve al texto saliente | Usarlo en `publicar` (F3) |
| CA-004-01 sección con el NOMBRE de la variable; un token literal impide empezar | **Cubierto** | `config.js`: 6 formas de token literal rechazadas, el mensaje no imprime el valor ni un trozo; también con el proveedor apagado | — |
| CA-004-02 `forge doctor` | Pendiente | — | F4.2 |
| CA-004-03 destinos obligatorios, sin «todos» | **Cubierto** (en la configuración) | Proveedor activo sin `*_destinos` o con comodín → no empieza | — |
| CA-004-04 modos y modo por defecto | Parcial | Modos `apagado`, `solo_lectura`, `comentar`, `proponer`; sin `*_modo` el proveedor está apagado | Ver duda 1: «el modo por defecto al activarlo es `solo_lectura`» se interpretó como «hay que escribirlo» |
| CA-004-05 el token no aparece en ningún sitio | Parcial | Mensajes de configuración, errores del cliente HTTP (con un `fetch` que nombra el token, en red, redirección y validación) y eventos de auditoría: sin token | Prompts, puntos de guardado, diario y pendientes con un token centinela de punta a punta (F5.1) |
| CA-005-01 sin sección o apagado: 0 conexiones, 0 lecturas de tokens | **Cubierto** | Configuración: 0 lecturas del entorno (proxy contador). CLI real (`help`, `doctor`, `run`, `status`), motor, servidor MCP y API HTTP con credenciales presentes en el entorno: ni una lectura directa de ellas, ni un `fetch`, ni un módulo de `core/integraciones/` resuelto | — |
| CA-005-02 sin dependencias nuevas | **Cubierto** | Prueba de importaciones del paquete; `package.json` sin cambios | — |
| CA-005-03 ni el ciclo, ni MCP, ni la API cambian | Parcial | 5 archivos del ciclo, sin cambios, en verde con `fetch` interceptado; `node --test tests/*.test.js` completo en verde | «De tiempo de arranque de forma medible»: no se midió |
| CA-005-04 una plataforma caída no hace fallar el ciclo | Pendiente | — | F3.4 |
| CA-006-01 evento `integracion:*` por operación | **Cubierto** (módulo) | `{ proveedor, operacion, destino, resultado, duracionMs }` y nada más; el error aporta solo su código | Que los adaptadores pasen siempre por `ejecutar` (F2) |
| CA-006-02 `forge integraciones estado` | Pendiente | `estado()` de la auditoría devuelve contadores e interruptor | CLI (F4.1) |
| CA-006-03 apagado inmediato, incluso lo aprobado | Parcial | Variable y archivo detienen toda operación en mitad de una sesión, también `publicar`; un apagado no consume tope | El comando `forge integraciones apagar` (F4.1; `apagar()`/`encender()` ya existen) |
| CA-006-04 tope por sesión y proveedor, pide revisión humana | Parcial | Error tipado con `requiereRevisionHumana`; por proveedor; persiste entre procesos de la misma sesión | Ligarlo a la sesión del ciclo y a la vista de revisión; ahora la sesión se pasa por parámetro |

Riesgo de agentes tocado: ASI07 (sin redirecciones a otro host) con prueba de redirección; ASI08 (tope y reintento acotado) en el módulo; ASI10 (apagado y auditoría) en el módulo. ASI01 a ASI06 y ASI09 dependen de fases posteriores.

## 3. La prueba de carga perezosa y por qué se hizo así

Un test que importa `cli/index.js` y mira qué se cargó no es fiable por sí solo: `cli/index.js` usa `import()` dinámico, y una lista de módulos que solo ve imports estáticos se perdería justo lo que importa. Se usan tres cosas que se refuerzan:

1. **Estática (por construcción).** Recorre `cli/`, `core/`, `utils/`, `bin/`, `scripts/`, `mcp-figma/` y `ui/` y exige que nadie fuera de `core/integraciones/` y `cli/integraciones.js` tenga un `import`, `export … from`, `import()` o `require` cuyo especificador mencione `integraciones`. Comprueba que revisó más de 50 archivos para que un recorrido roto no pase en silencio.
2. **En ejecución (lo que de verdad se carga).** Procesos hijos con `--import` de una precarga (`tests/fixtures/integraciones-traza/`) que registra tres cosas: llamadas a `fetch` (que además lanza), lecturas directas de variables de entorno con pinta de credenciales, y un **gancho de resolución de módulos** (`module.register`) que anota todo lo que se resuelva bajo `core/integraciones/` o `cli/integraciones.js`. El gancho ve también los `import()` dinámicos ejecutados. Se ejecutan: `forge help`, `doctor`, `run`, `status`, `mcp` (con un `initialize` y `tools/list` reales), `core/engine-cli.js run`, y la importación de motor, MCP, herramientas MCP, API (creada, escuchando en el puerto 0 y cerrada) y ciclo. Con un **control positivo** en el mismo archivo: un hijo que importa `puerto.js`, lee `FORGE_GITHUB_TOKEN` y llama a `fetch` debe producir exactamente esas tres clases de traza; sin él, «traza vacía» no probaría nada.
3. **Suite.** `ciclo-motor`, `ciclo-datos`, `ciclo-presupuesto`, `ciclo-router` y `ciclo-fundamentos` corren sin modificar bajo la misma precarga (vía `NODE_OPTIONS`): en verde y sin trazas.

Dos observaciones honestas sobre el detector:
- La lectura de entorno solo cuenta si es **directa**. Copiar todo el entorno (`{ ...process.env }`, o `child_process` al lanzar un hijo, que `forge doctor` hace) toca todas las claves; se distingue por la enumeración previa (`ownKeys`). Una enumeración deliberada del entorno para buscar tokens, seguida en el mismo instante de lecturas, no se vería. La prueba estática de `process.env` en `core/integraciones/` cubre ese hueco para el código nuevo.
- Una prueba YA existente de los proveedores de modelos llama a `fetch` hacia `127.0.0.1:9` (puerto cerrado, a propósito, para comprobar el error de conexión). Es el único `fetch` tolerado en la suite del ciclo; se declara explícitamente en el test y no es de integraciones.

## 4. Decisiones de diseño que merecen revisión

- **Delimitador:** `<<<DATO-NO-CONFIABLE:<24 hex aleatorios> inicio>>>` … `… fin>>>`. El identificador se elige de modo que no aparezca en el contenido; la secuencia `<<<`/`>>>` y el texto «DATO-NO-CONFIABLE» se neutralizan en el contenido; si una prueba fuerza un identificador (`_nonce`), se retira del contenido.
- **Cota en bytes sobre el bloque entero** (cabecera y marcadores incluidos), mínimo 1024; por defecto 16384. Se redacta ANTES de recortar.
- **El proveedor del encabezado** sale de `[a-z][a-z0-9_-]{0,20}` o es «desconocido»: nunca texto libre.
- **Cabeceras markdown** se reescriben a `(título) …`; las referencias `#123` al inicio de línea se conservan. Cambia el texto, no solo lo marca: es una elección de seguridad sobre fidelidad.
- **Token por variable explícita:** no hay nombre por defecto (`FORGE_GITHUB_TOKEN` es solo un ejemplo). Sin `*_token_env` el proveedor activo no arranca.
- **Hosts:** solo nombres con al menos un punto y sin IP; `localhost` y direcciones de red interna se rechazan en la configuración y en el cliente. Jira solo `*.atlassian.net`.
- **El tope cuenta intentos**, no éxitos, y es por proveedor.

## 5. Límites conocidos (no resueltos)

- **DNS.** El cliente valida el nombre del host, no la dirección a la que resuelve: un nombre de la lista que apunte a una IP interna llegaría hasta ella. Mitigación posible en F2/F4: verificación explícita en `doctor`.
- **Redirecciones.** Solo se sigue una a la misma ruta de un host permitido. Una plataforma que redirige un repositorio renombrado a otra ruta provocará un error claro, no un seguimiento. Es estricto a propósito.
- **Apagado.** Detiene lo que venga después; no cancela una petición ya enviada. Entre la comprobación y el envío hay una ventana de milisegundos.
- **Sesión.** El contador vale por sesión si quien llama pasa el identificador de sesión del ciclo; sin él, la sesión es el proceso. Nadie lo pasa todavía.
- **Concurrencia.** El contador de operaciones es un archivo de anexado sin candado: dos procesos a la vez pueden pasarse del tope por una unidad.
- **Neutralización de contenido.** No es un detector de inyección ni un filtro semántico: el texto sigue pudiendo pedir cosas; lo que no puede es parecer una instrucción de FORGE, salirse del bloque o traer enlaces activos. Los alfabetos no latinos y los emojis se conservan; los caracteres de formato (incluido el unidor de emojis compuestos) se pierden.
- **Batería hostil.** `tests/fixtures/integraciones/hostiles.json` (S0.3) no existía en esta rama: se usó una lista propia de 16 casos. El test la carga si aparece. Sigue pendiente el criterio de la spec de ≥30 casos.
- **Spikes S0.1, S0.2, S0.4 no hechos:** nada de esta fase depende de rutas REST ni de permisos de tokens.

## 6. Totales

- `npm run typecheck`: 0 errores.
- `node --test tests/*.test.js`: 2345 pruebas, 2333 pasan, 0 fallan, 12 omitidas (las omitidas son anteriores y no son de este trabajo).
- Pruebas nuevas: puerto 7, configuración 25, confianza 41, http 31, auditoría 16, aislamiento 11.
- (Totales de F1. Los de F2.1 están en la sección 7.)

## 7. F2.1: adaptador de GitHub

Archivos: `core/integraciones/proveedores/github.js`, `tests/integraciones-github.test.js`, `tests/fixtures/integraciones/servidores/github.mjs` (servidor falso de node:http, con la forma de `spikes/contratos-respuesta.md` §1). Ninguna prueba toca la red ni usa credenciales reales; el token es un centinela inventado. Único cambio en un archivo existente: la prueba de importaciones de `tests/integraciones-aislamiento.test.js` admite que `proveedores/` importe `../puerto.js`, `../http.js`, `../config.js`, `../confianza.js` y `../auditoria.js`.

### Qué demuestran las pruebas (49 casos corriendo hoy, más 1 opt-in omitido)

| Propiedad | Bloque |
|---|---|
| El objeto cumple `validarProveedor`, sin operaciones genéricas, congelado | contrato |
| Token vacío, destinos vacíos o con comodín, `baseUrl` distinta de `https://api.github.com` o `http://127.0.0.1:<puerto>`: no se construye; el mensaje no repite la URL | contrato |
| `comprobarAlcance` devuelve `{ estado: 'no_comprobable', motivo }` y hace 0 peticiones | contrato |
| Destino fuera de la lista (leer, comentar, proponer): 0 peticiones; comparación exacta sin prefijos | destino |
| 18 referencias mal formadas (recorrido de rutas, `?`, `#`, saltos, longitud, `\`, URL completa): 0 peticiones | referencia |
| Leer sin y con comentarios; autor o cuerpo nulos; etiquetas como texto u objeto; solicitud de cambio marcada | leer |
| Paginación por número de página (nunca el enlace `Link`, que el servidor falso apunta a otro host), tope de 10 páginas y de 2 MiB acumulados con marca `truncado`, tope de 1 MiB por respuesta | leer |
| Forma inesperada, JSON inválido, `null`, arreglo donde va un objeto, respuesta de 3 MiB: error tipado (`respuesta_invalida`, `tamano`), nunca `undefined` | leer |
| Los 52 casos de `hostiles.json` como título, cuerpo, etiqueta, comentario y autor: se devuelven idénticos y las 104 peticiones solo van a `/repos/org/repo/issues/N[/comments?per_page=100&page=1]` | hostil |
| `comentar` idempotente: la segunda llamada con el mismo marcador no publica y devuelve el existente; el marcador se busca en páginas posteriores; uno citado a mitad de un comentario ajeno no cuenta; si no se pueden ver todos los comentarios, NO publica | F2.6 |
| `proponerCambio`: rama nueva; todas las lecturas antes de la primera escritura; la referencia se crea después del commit; solicitud con `draft: true`; base intacta; nunca PATCH, PUT ni DELETE | proponer |
| Rama existente (también en una segunda llamada idéntica): `rama_existe` y 0 escrituras | proponer |
| 16 nombres de rama dudosos y prefijos distintos de `forge/`; 22 rutas de archivo maliciosas (`..`, absolutas, `.git`, control, `\`, `.github/workflows`, vacías, largas); límites de archivos y de tamaño: 0 peticiones | proponer |
| Sin permiso (404 y 403) al leer y al escribir: `sin_permiso_o_no_existe`, sin distinguirlos; no queda rama ni solicitud | proponer |
| Fallo después de crear la rama (la solicitud devuelve 422): código `parcial`, la rama sigue, el error la nombra y dice que no se borra; fallo antes (commit 500): ninguna rama | proponer |
| Token centinela ausente de mensaje, pila, propiedades y causa de 10 errores (también cuando la plataforma lo repite en su cuerpo o en `Location`), de los resultados y de todos los archivos `.sdd/` de eventos y sesión; viaja solo en `Authorization` | CA-004-05 (GitHub) |
| 401, 404, 410, 422, 500 y 409 → códigos tipados sin usar el cuerpo; 429 con `Retry-After` reintenta (núcleo); 403 con `Retry-After` o `x-ratelimit-remaining: 0` es `limite_ritmo` sin reintento | ritmo |
| Con `auditoria`: un evento `integracion:<operacion>` por operación, el tope corta antes de la red, el interruptor apagado deja 0 peticiones, el evento lleva el código tipado y no el mensaje | CA-006-01 |

### Criterios de la spec que esto mueve

- CA-001-02 (destinos, rechazo antes de la red) y CA-001-05 (no se siguen URL ni enlaces): de parcial a **cubierto para GitHub**.
- CA-001-06 (plataformas admitidas): GitHub hecho; GitLab y Jira pendientes.
- CA-002-04 (idempotencia): GitHub cubierto con servidor falso; GitLab y Jira pendientes. F2.6 y F2.4 NO se marcan como hechas porque son «de los tres».
- CA-004-05 (token ausente): cubierto en el recorrido del adaptador; el recorrido completo (prompts, puntos de guardado, diario) sigue siendo F5.1.

### Decisiones propias del adaptador (revisables)

- **La rama se crea la última.** Se lee, se suben blobs, árbol y commit (objetos sin rama) y solo entonces `POST git/refs` con el commit ya hecho. Un fallo de permiso o de forma no deja una rama a medias; un fallo posterior a la rama (la solicitud) la deja y lo informa. Difiere del orden «crear rama y luego commits» del encargo: es más conservador.
- **Un archivo, un blob.** Máximo 20 archivos y 1 MiB en total, todos con modo `100644`: un archivo ejecutable existente perdería ese modo (no se lee el árbol base para conservarlo).
- **`.github/workflows/` rechazado.** No lo pedía el encargo; cambiar CI con un agente es una escalada clásica. Se relaja quitando una condición de `motivoRutaInvalida`.
- **`borrador` solo si GitHub lo confirma.** La respuesta de la solicitud puede no traer `draft` (sin confirmar en el spike); si no es `true`, el resultado dice `borrador: false` y quien llama debe tratarlo.
- **El marcador se busca solo al final del cuerpo** (donde lo pone el adaptador). Un tercero que conozca el identificador y escriba un comentario que termine con él puede suprimir una publicación (denegación, no suplantación). Mitigación posible con una petición más: comparar el autor con `GET /user`. No hecha.
- **`403` con `Retry-After` o `x-ratelimit-remaining: 0` no se reintenta** (el núcleo solo reintenta 429 y 503); se informa como `limite_ritmo`.
- **Firma del encargo, no la del typedef del puerto:** `leerElemento(referencia)`, `comentar(referencia, texto, { marcador })`, `proponerCambio({ destino, base, rama, ... })`, `comprobarAlcance()`. `puerto.js` solo valida que existan las cuatro funciones; su typedef describe otra firma y otro `AlcanceDelToken`. Hay que unificarlos antes de F3 (propuesta de parche en el informe de F2.1).

### Lo que sigue «sin confirmar» y exige una cuenta real

La prueba opt-in (`FORGE_PRUEBA_GITHUB_REAL=1` con token, destino e incidencia de PRUEBA) cubre el flujo, se omite por defecto y NO se ha ejecutado:

1. Los cuerpos de `POST git/blobs` (`content`, `encoding`), `git/trees` (`base_tree`, `tree[]` con `sha`), `git/commits` (`message`, `tree`, `parents`) y `git/refs` (`ref`, `sha`): el spike no los leyó; se usó la forma habitual de la API Git Data.
2. Que la respuesta de `POST pulls` traiga `draft: true`, y qué ocurre con `draft: true` en un repositorio privado de plan gratuito (¿422 o una solicitud normal?).
3. El código HTTP exacto (403 o 404) de un token sin permiso, y el texto «Resource not accessible by personal access token».
4. Que `GET git/ref/heads/<rama con />` acepte los segmentos codificados uno a uno (así se envían) y que un 404 sea siempre «la rama no existe».
5. El máximo real del cuerpo de un comentario (se usa 60 000 caracteres, conservador).
6. Si Metadata: read hace falta además de Issues, Contents y Pull requests.
7. Que `GET /repos/{owner}/{repo}` sea legible con solo esos tres permisos (el adaptador lo usa para comprobar que el repositorio existe antes de escribir).

### Límites conocidos de este adaptador

- No comprueba el alcance del token (imposible por API): `no_comprobable` es la respuesta honesta.
- Una incidencia con más de 1 000 comentarios o 2 MiB de comentarios se devuelve truncada (`truncado: true`) y se pierden los últimos; `comentar` en ese caso se niega a publicar.
- Repositorio renombrado o transferido: GitHub responde 301; el cliente HTTP lo rechaza (otra ruta) y el error es de red tipado, no un seguimiento.
- Sin prueba de concurrencia: dos procesos que propongan la misma rama a la vez dependen de que GitHub rechace la segunda creación de referencia (422, `rama_existe`).

### Totales de F2.1

- `npm run typecheck`: 0 errores.
- `node --test tests/*.test.js`: 2457 pruebas, 2445 pasan, 0 fallan, 12 omitidas (anteriores). Pruebas nuevas de F2.1: 49 en `integraciones-github.test.js` (más la suite opt-in, omitida).
- Una corrida anterior bajo carga fuerte de la máquina falló `proyecto-hostil` («5000 archivos pequeños», tope de tiempo); aislada y en la corrida completa siguiente pasó. No es de este trabajo.
