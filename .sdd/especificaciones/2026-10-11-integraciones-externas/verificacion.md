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

(Cifras de la fase F1; las del adaptador de Jira están en la sección 7.5.)

## 7. Adaptador de Jira Cloud y conversor ADF (F2.3, F2.3a, F2.3b; parte de F2.4 y F2.6)

> Fecha: 2026-10-11. Todo contra un servidor `node:http` local falso (`tests/fixtures/integraciones/servidores/jira.mjs`, formas tomadas de `spikes/contratos-respuesta.md`, que son ejemplos construidos a mano). **Ninguna llamada a una cuenta real de Jira**: lo que dependa de la plataforma real figura en 7.4.

### 7.1 Qué hay

| Módulo | Archivo | Pruebas |
|---|---|---|
| Adaptador | `core/integraciones/proveedores/jira.js` (`crearProveedorJira`, `ErrorJira`, `OperacionNoSoportada`) | `tests/integraciones-jira.test.js` (33) |
| Conversor ADF | `core/integraciones/proveedores/jira-adf.js` (`adfATexto`, `textoAAdf`) | `tests/integraciones-jira-adf.test.js` (27) |
| Servidor falso | `tests/fixtures/integraciones/servidores/jira.mjs` | (lo usan las anteriores) |

Cambios en código existente: ninguno en `core/integraciones/{puerto,config,http,confianza,auditoria}.js`. Solo se amplió la lista de módulos internos admitidos en `tests/integraciones-aislamiento.test.js` (`../http.js` y `../../ciclo/redactar.js`, que los adaptadores necesitan). Sin dependencias nuevas.

### 7.2 Qué demuestra cada prueba

| Afirmación | Prueba |
|---|---|
| El adaptador pasa `validarProveedor`, sin operaciones genéricas, y no expone token, usuario ni Base64 (objeto congelado; el par vive en una clausura) | contrato y construcción |
| `leerElemento` normaliza al tipo del puerto con exactamente 8 campos (`proveedor, destino, referencia, titulo, cuerpo, etiquetas, comentarios, url`); descripción y comentarios ADF → texto; comentarios paginados (servidor limitado a 2 por página: 3 peticiones) | leer con comentarios paginados |
| El proyecto de la clave debe estar en `destinos`; referencias con forma rara (23 casos: traversal, `?`, `#`, salto de línea, ancho completo, tipos no string) se rechazan con **cero peticiones** | destino fuera de la lista; referencia rara |
| La URL del elemento la construye el adaptador (`https://<sitio>/browse/CLAVE`); no se copia de la respuesta ni se sigue; un ticket cuya clave en la respuesta es otra (movido) se rechaza | leer; ticket movido |
| `comentar` publica ADF válido con la línea final `FORGE-ID: <id>`; la segunda vez no hace POST y devuelve el id existente (`yaExistia: true`); el marcador se busca en todas las páginas; una línea que solo contiene el marcador en medio no cuenta | idempotencia |
| El texto saliente se redacta; tope de 16 KiB sin recorte silencioso; los 52 casos hostiles como cuerpo publican solo nodos `doc`/`paragraph`/`text` sin `marks` ni `attrs` | comentar |
| `proponerCambio` lanza `OperacionNoSoportada` (código `operacion_no_soportada`, mensaje que remite a «comentar») sin ninguna petición | proponerCambio |
| `comprobarAlcance` devuelve `no_comprobable` sin peticiones; con `conAmbitos` o el sitio `api.atlassian.com` devuelve `no_soportado` y `leerElemento`/`comentar` no intentan nada; no se inventa un `cloudId` | alcance |
| 401/403/404/400/413/429/5xx → códigos tipados; el cuerpo de la respuesta (con texto «INSTRUCCION…» y el token) no entra en el error; JSON inválido → `respuesta_invalida`; respuesta de 3 MiB → `tamano`; 5 formas de ticket y 4 de comentarios inesperadas → `respuesta_inesperada` | errores |
| Token, usuario, Base64 y cabecera `Basic …` ausentes de mensaje, `stack`, `JSON.stringify` e `inspect` de cada error, también cuando el `http` inyectado lanza un error que los contiene | errores y secretos |
| Auditoría: un evento `integracion:leer_elemento` o `integracion:comentar` con solo `{proveedor, operacion, destino, resultado, duracionMs}`; el error aporta su código; con el tope agotado no hay más peticiones | auditoría |
| ADF: documento normal, listas anidadas (viñeta y numeradas), código (como texto, con cercas; lenguaje con forma rara descartado), cita, tabla, tareas, menciones/emoji/enlaces/tarjetas inertes (`hxxps[:]//`), adjuntos solo como nota | `adfATexto` normales |
| ADF: nodos desconocidos conservan el texto de sus hijos; nunca lanza (9 valores no ADF, 8 formas rotas, un objeto cíclico hecho a mano); profundidad 10 000 y 200 000, y 200 000 nodos planos (< 5 s) se recortan con nota; el tope de bytes no parte caracteres | `adfATexto` hostil y topes |
| `textoAAdf`: versión 1, tipo `doc`, un párrafo por línea, solo nodos `text`; ida y vuelta exacta; quita controles e invisibles; acotado con nota; los 52 casos hostiles (título y cuerpo) producen solo `doc`/`paragraph`/`text`, sin marcas ni atributos | `textoAAdf` |
| Los 52 casos hostiles como texto dentro de un ADF (título, párrafo, código, cita, `href`): `adfATexto` devuelve texto y `comoDato` lo delimita con una sola apertura y un solo cierre; ningún `href` queda como URL activa | texto hostil dentro de un ADF |

### 7.3 Decisiones

- **Firma.** El puerto declara `leerElemento(destino, referencia)` y `comentar(destino, referencia, texto, idempotencia)`. El encargo pidió además `leerElemento(referencia)` y `comentar(referencia, texto, { marcador })`. El adaptador acepta ambas: si llegan dos argumentos strings, el destino debe coincidir con el proyecto de la referencia (si no, `destino_no_coincide`, sin red).
- **El adaptador redacta y acota lo que publica**, además de lo que haga `publicar` (F3): la barrera no depende de quien llame. Un texto que supera 16 KiB se rechaza (`texto_demasiado_grande`), no se recorta en silencio.
- **Idempotencia por búsqueda previa, cerrada hacia el lado seguro**: si el ticket tiene más de 1000 comentarios (10 páginas de 100) y no se encuentra el marcador, NO se publica (`idempotencia_no_verificable`).
- **`comprobarAlcance`** devuelve, además de `estado` y `motivo`, los campos del tipo del puerto con `verificable: false` y `lectura/escritura/excede: false` (significa «no verificado», no «sin acceso»); quien los lea debe mirar `estado`/`verificable` primero.
- **`baseUrl`** existe solo para pruebas y solo admite `http://127.0.0.1:<puerto>` o `http://localhost:<puerto>`; en producción el host es `<sitio>.atlassian.net` y el cliente HTTP exige HTTPS.
- **Defensa en profundidad**: un error de cualquier origen que lleve el token, el usuario o el Base64 se sustituye por un `ErrorJira` limpio antes de salir del adaptador (aunque `http.js` ya enmascara).
- **Referencias fuera de formato no pasan por la auditoría**: no hay operación que contar ni destino que registrar.

### 7.4 Límites y «sin confirmar» que exigen una cuenta real

- **`ADD_COMMENTS` y el permiso real del usuario de servicio**: nada del adaptador lo verifica; un 403 solo se descubre al publicar (el spike indica `mypermissions`, pero el encargo fija `no_comprobable`).
- **El cuerpo mínimo de `POST .../comment` sin `visibility`** se acepta en el servidor falso; que Jira Cloud lo acepte es **sin confirmar por ejecución** (spike 3.3).
- **Máximo de `maxResults` de comentarios y máximo de tamaño de un comentario**: sin confirmar. El adaptador pide 100 por página y asume que el servidor puede devolver menos (avanza por lo recibido); el tope de 16 KiB es propio y conservador.
- **Respuesta 201 del comentario**: se exige solo `id` (cadena o número de 1 a 20 dígitos). Otros campos no se leyeron.
- **Tickets movidos**: Jira devuelve la clave encontrada, no una redirección. El adaptador lo rechaza (clave distinta); un renombrado de proyecto provoca un error claro, no un seguimiento.
- **Marcador plantado**: cualquiera con permiso para comentar puede escribir una línea `FORGE-ID: <id>` en el ticket y hacer que FORGE no publique. El adaptador no comprueba el autor (necesitaría `GET /myself`). Efecto: una publicación omitida, nunca una duplicada.
- **Token con ámbitos**: no soportado hasta confirmar cómo obtener el `cloudId`; el aviso de `doctor` es F4.2.
- **Descripción en formato antiguo (cadena)**: se acepta y se acota, pero la API v3 declarada solo documenta ADF.
- **ADF**: los nodos no listados (`panel`, `decisionList`, `layoutSection`, extensiones…) se tratan como «ignorar el nodo, conservar el texto». Las marcas (negrita, código…) se pierden, salvo el enlace. Una tabla con celdas multilínea se aplana en una línea por fila.
- **Truncado silencioso de comentarios al leer**: el tipo del elemento no tiene un campo «hay más»; con más de 1000 comentarios, `leerElemento` devuelve los primeros 1000 sin avisar.

### 7.5 Totales

- `npm run typecheck`: 0 errores.
- `node --test tests/*.test.js`: 2468 pruebas, 2456 pasan, 0 fallan, 12 omitidas (anteriores). La última corrida completa tuvo 1 fallo (la lista de importaciones internas admitidas en la prueba estática, que no incluía `../puerto.js` de un tipo JSDoc); se corrigió y esa prueba se volvió a correr en verde por separado. Una primera corrida, con la máquina saturada por dos suites a la vez, dio 7 fallos por tiempo agotado que no se repitieron.
- Pruebas nuevas: adaptador de Jira 33, conversor ADF 27.
