# Verificación: Integraciones con GitHub, GitLab y Jira

> Spec: `spec.md` · Plan: `plan.md` · Tareas: `tareas.md`
> Estado: **fase F1 (núcleo) verificada; F2: solo el adaptador de GitLab (apartado 7); el resto de F2 y F3 a F6 sin empezar.** Este documento solo afirma lo que tiene una prueba corriendo hoy. Lo demás figura como pendiente.

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
- Tras F2.2/F2.5 (GitLab): `npm run typecheck` 0 errores; `node --test tests/*.test.js`: 2458 pruebas, 2446 pasan, 0 fallan, 12 omitidas (la suite opt-in de GitLab figura como omitida a propósito). Pruebas nuevas: GitLab 50. Ver el apartado 7.

## 7. F2.2 y F2.5 — Adaptador de GitLab

> Solo GitLab. GitHub y Jira (F2.1, F2.3) siguen sin empezar.

Archivos: `core/integraciones/proveedores/gitlab.js`, `tests/integraciones-gitlab.test.js` (50 pruebas en marcha y 2 opt-in saltadas), servidor falso `tests/fixtures/integraciones/servidores/gitlab.mjs` (node:http en 127.0.0.1: ninguna llamada de red real ni credencial real; el `fetch` global se bloquea salvo hacia 127.0.0.1 durante la prueba).

| Garantía | Prueba | Estado |
|---|---|---|
| Pasa `validarProveedor`; sin operaciones genéricas ni de fusionar, cerrar o borrar | «contrato del puerto», «no hay operación de fusionar…» | Cubierto |
| Subgrupos anidados: `a/b/c/d` viaja como `a%2Fb%2Fc%2Fd` en cada ruta | «subgrupos anidados…» (todas las rutas comprobadas en el servidor) | Cubierto |
| Referencia estricta `grupo/…/proyecto#N` validada contra `destinos`; fuera de la lista, cero peticiones | «referencias no válidas» (28 formas), «destino fuera de la lista» | Cubierto |
| Notas de sistema filtradas; paginación con tope de 5 páginas × 100 y de bytes; solo se sigue `x-next-page` igual a la página siguiente | «filtra las notas de sistema», «pagina… tope», «paginación inesperada» | Cubierto |
| Los 52 casos de `hostiles.json` como título, cuerpo y nota: devueltos byte a byte; el adaptador solo hace las 2 lecturas previstas, a rutas del proyecto | «los 52 casos hostiles…» | Cubierto |
| Formas inesperadas (incidencia, notas, ámbitos, JSON roto) → `ErrorGitLab` con código `forma`; 401/403/404/5xx tipados sin copiar el cuerpo | «formas inesperadas», «estados HTTP de error» | Cubierto |
| Respuesta enorme cortada por el tope de `http.js` | «una respuesta enorme…» | Cubierto |
| `comentar` idempotente: marcador `<!-- forge:<id> -->`, búsqueda previa, una nota de sistema no cuenta, no publica si no pudo revisar todas las notas | 7 pruebas | Cubierto |
| `proponerCambio`: rama NUEVA con prefijo `forge/`; existente → falla sin escribir; título con `Draft: ` sin duplicar variantes; todas las lecturas antes de la primera escritura; solo `POST` de rama, commit y MR; nada en la base | 19 pruebas | Cubierto |
| Rutas maliciosas (`..`, absolutas, `.git/`, control, invisibles, duplicadas); tope de número (20) y de tamaño (256 KiB por archivo, 1 MiB total) | «rutas maliciosas», «topes…» | Cubierto |
| Fallo tras crear la rama: no se borra y el error dice rama y etapa | «fallo a mitad» ×2 | Cubierto |
| `comprobarAlcance`: `api`, `read_api`, ámbitos de más, 404/401 → `no_comprobable`, formas raras | 5 pruebas | Cubierto contra el servidor falso |
| El token no aparece en errores, valores devueltos ni eventos (centinela en 9 recorridos, incluido un `http` inyectado que lo arrastra) | «el token no aparece en ningún sitio» | Cubierto |
| Interruptor y modo `apagado`: sin peticiones | 2 pruebas | Cubierto |

### Decisiones

- **Firma.** La del encargo (`leerElemento(referencia)`, `comentar(referencia, texto, { marcador })`, `proponerCambio({…})`, `comprobarAlcance()`), no la del typedef `ProveedorDeTrabajo` de `puerto.js`, que describe otra. `validarProveedor` solo mira nombres, por eso pasa; el typedef debería actualizarse cuando estén los tres adaptadores.
- **Modo.** `crearProveedorGitLab` recibe además `modo` (por defecto `solo_lectura`) y lo hace cumplir: `comentar` pide `comentar`, `proponerCambio` pide `proponer`, `apagado` rechaza todo sin red.
- **Resultados.** `comentar` y `proponerCambio` devuelven `{ id, url?, borrador?, yaExistia }` (y `rama`); `yaExistia` no está en `ResultadoDePublicacion`. `comprobarAlcance` devuelve `{ estado, ambitos, exceso, suficiente }`; `suficiente` es un añadido (un token `read_api` en modo `comentar` no tiene exceso, pero no sirve).
- **`exceso`.** `solo_lectura` necesita solo `read_api` (un token `api` cuenta como exceso aunque alcance); `comentar` y `proponer`, solo `api`.
- **Auditoría.** Una operación auditada por llamada del puerto, aunque `proponerCambio` haga varias peticiones.
- **Borrador.** La MR siempre lleva `Draft: ` en el título. Si la respuesta no trae `draft` ni `work_in_progress` verdaderos se lanza `no_borrador` en vez de devolver un éxito. `parametroBorrador` (`'draft'` o `'work_in_progress'`) está apagado por defecto.
- **Archivos existentes.** Para elegir `create` o `update` se hace `HEAD /repository/files/:ruta?ref=<base>` de cada archivo, antes de crear la rama.

### Límites y puntos «sin confirmar» (necesitan una cuenta real)

- **Parámetro `draft`** al crear la MR por API: el spike no lo confirma. La prueba opt-in «instancia real» (saltada salvo `FORGE_TEST_INTEGRACIONES=1` con `FORGE_TEST_GITLAB_{HOST,TOKEN,PROYECTO}`) comprueba si basta el prefijo. Escribe de verdad una rama y una MR en borrador en el proyecto de prueba; no borra. **No se ha ejecutado.**
- **`HEAD` sobre archivos** y la forma de la respuesta de creación de nota: no leídos en el spike. El servidor falso sigue `contratos-respuesta.md` (ejemplos inventados, no capturas): que pasen demuestra el adaptador contra ese modelo, no contra GitLab.
- **Ámbito mínimo por endpoint** (`read_api` leer, `api` escribir): deducido, no declarado por la página de cada endpoint; el rol mínimo para comentar tampoco. Un token con menos devolverá 403 («prohibido»).
- **`/personal_access_tokens/self` con token de proyecto o de grupo:** se asume 404/401; una instancia real puede diferir.
- **Notas.** Pasadas 500 notas (o 4 MiB), `leerElemento` devuelve las más antiguas sin avisar en el elemento y `comentar` se niega a publicar. No hay campo `truncado` porque F2.4 pide «sin campos de más».
- **Marcador.** Quien pueda comentar puede pegar `<!-- forge:<id> -->` y evitar la publicación; no puede falsearla. Se podría atar la búsqueda al autor con `GET /user` (sin confirmar con `read_api`).
- **Archivos de CI.** El adaptador no distingue `.gitlab-ci.yml`: una MR en borrador que lo cambie ejecuta pipelines en la rama. Es filtro de F3.2.
- **Auditoría opcional.** Sin `auditoria` inyectada no hay interruptor ni tope; quien lo construya (F4) debe pasarla.
- **Parche a una prueba existente.** `tests/integraciones-aislamiento.test.js` exigía que los módulos de `core/integraciones/` importaran solo `./x.js` o cuatro internos por ruta literal; se cambió a comprobar la ruta resuelta (hermanos del paquete, también desde `proveedores/`, o los mismos cuatro internos). No se tocó ningún módulo del núcleo.


(Cifras de la fase F1; las del adaptador de Jira están en la sección 7.5.)

## 8. Adaptador de Jira Cloud y conversor ADF (F2.3, F2.3a, F2.3b; parte de F2.4 y F2.6)

> Fecha: 2026-10-11. Todo contra un servidor `node:http` local falso (`tests/fixtures/integraciones/servidores/jira.mjs`, formas tomadas de `spikes/contratos-respuesta.md`, que son ejemplos construidos a mano). **Ninguna llamada a una cuenta real de Jira**: lo que dependa de la plataforma real figura en 7.4.

### 8.1 Qué hay

| Módulo | Archivo | Pruebas |
|---|---|---|
| Adaptador | `core/integraciones/proveedores/jira.js` (`crearProveedorJira`, `ErrorJira`, `OperacionNoSoportada`) | `tests/integraciones-jira.test.js` (33) |
| Conversor ADF | `core/integraciones/proveedores/jira-adf.js` (`adfATexto`, `textoAAdf`) | `tests/integraciones-jira-adf.test.js` (27) |
| Servidor falso | `tests/fixtures/integraciones/servidores/jira.mjs` | (lo usan las anteriores) |

Cambios en código existente: ninguno en `core/integraciones/{puerto,config,http,confianza,auditoria}.js`. Solo se amplió la lista de módulos internos admitidos en `tests/integraciones-aislamiento.test.js` (`../http.js` y `../../ciclo/redactar.js`, que los adaptadores necesitan). Sin dependencias nuevas.

### 8.2 Qué demuestra cada prueba

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

### 8.3 Decisiones

- **Firma.** El puerto declara `leerElemento(destino, referencia)` y `comentar(destino, referencia, texto, idempotencia)`. El encargo pidió además `leerElemento(referencia)` y `comentar(referencia, texto, { marcador })`. El adaptador acepta ambas: si llegan dos argumentos strings, el destino debe coincidir con el proyecto de la referencia (si no, `destino_no_coincide`, sin red).
- **El adaptador redacta y acota lo que publica**, además de lo que haga `publicar` (F3): la barrera no depende de quien llame. Un texto que supera 16 KiB se rechaza (`texto_demasiado_grande`), no se recorta en silencio.
- **Idempotencia por búsqueda previa, cerrada hacia el lado seguro**: si el ticket tiene más de 1000 comentarios (10 páginas de 100) y no se encuentra el marcador, NO se publica (`idempotencia_no_verificable`).
- **`comprobarAlcance`** devuelve, además de `estado` y `motivo`, los campos del tipo del puerto con `verificable: false` y `lectura/escritura/excede: false` (significa «no verificado», no «sin acceso»); quien los lea debe mirar `estado`/`verificable` primero.
- **`baseUrl`** existe solo para pruebas y solo admite `http://127.0.0.1:<puerto>` o `http://localhost:<puerto>`; en producción el host es `<sitio>.atlassian.net` y el cliente HTTP exige HTTPS.
- **Defensa en profundidad**: un error de cualquier origen que lleve el token, el usuario o el Base64 se sustituye por un `ErrorJira` limpio antes de salir del adaptador (aunque `http.js` ya enmascara).
- **Referencias fuera de formato no pasan por la auditoría**: no hay operación que contar ni destino que registrar.

### 8.4 Límites y «sin confirmar» que exigen una cuenta real

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

### 8.5 Totales

- `npm run typecheck`: 0 errores.
- `node --test tests/*.test.js`: 2468 pruebas, 2456 pasan, 0 fallan, 12 omitidas (anteriores). La última corrida completa tuvo 1 fallo (la lista de importaciones internas admitidas en la prueba estática, que no incluía `../puerto.js` de un tipo JSDoc); se corrigió y esa prueba se volvió a correr en verde por separado. Una primera corrida, con la máquina saturada por dos suites a la vez, dio 7 fallos por tiempo agotado que no se repitieron.
- Pruebas nuevas: adaptador de Jira 33, conversor ADF 27.

- (Totales de F1. Los de F2.1 están en la sección 7.)

## 9. F2.1: adaptador de GitHub

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

## 10. F3 (publicación) y F4 (CLI y diagnóstico)

> 2026-10-12. Todo contra los servidores falsos locales y con el ciclo guionizado (modelo y pruebas simulados). Ninguna llamada a una cuenta real.

### 10.1 Qué hay

| Módulo | Archivo | Pruebas |
|---|---|---|
| Qué se publica, desde el estado del ciclo | `core/integraciones/publicacion.js` | `integraciones-publicacion` (26) |
| Cola, vista previa, aprobación, bloqueo por alcance | `core/integraciones/aprobacion.js` | `integraciones-aprobacion` (28) |
| Diagnóstico | `core/integraciones/doctor.js` | `integraciones-doctor` (19), `integraciones-doctor-cli` (2) |
| CLI `forge integraciones` y resumen de `forge status` | `cli/integraciones.js`, `cli/integraciones-activas.js` | `integraciones-cli` (13, con el ciclo real guionizado) |
| `<proveedor>_alcance` en la configuración | `core/integraciones/config.js` | `integraciones-alcance-config` (4) |

Cambios fuera de los archivos nuevos: `cli/index.js` (enrutado `integraciones` y bloque de `doctor`, ambos con import dinámico y tras la puerta `integracionesActivas`), `cli/runner.js` (resumen en `status`), `core/integraciones/config.js` (clave de alcance). `tests/integraciones-aislamiento.test.js`: `cli/index.js` y `cli/runner.js` pasan a la lista de archivos que pueden mencionar integraciones, con una prueba nueva que exige que sea SOLO con `import()` dinámico; y la lista de módulos internos admitidos suma `ciclo/checkpoint-archivos.js`, `ciclo/protocolo-archivos.js` y `ciclo/estado.js` (tipo JSDoc). Adaptadores, `http.js`, `confianza.js` y `auditoria.js` sin tocar. Salida de `forge doctor` sin la sección: byte a byte igual que antes del cambio (captura previa comparada con `fc`).

### 10.2 Criterios

| CA | Estado | Prueba |
|---|---|---|
| CA-002-01 vista previa exacta y ninguna escritura hasta aprobar | Cubierto | `vista`, `publicar` (0 escrituras en el falso) |
| CA-002-02 redactado y acotado | Cubierto | plantilla fija, `redactar`, 6000 bytes; aprobar re-verifica |
| CA-002-03 identificador y origen | Cubierto (enlace a evidencia = ruta local relativa) | texto de la plantilla |
| CA-002-04 no duplica | Cubierto en los 3 | aprobar dos veces; marcador de los adaptadores |
| CA-002-05 modo `solo_lectura` | Cubierto | `publicar` y `aprobar` sin red |
| CA-003-02 huellas del estado | Cubierto | huella de disco distinta → error |
| CA-003-03 CI, dependencias, configuración | Cubierto | excluidos y listados con motivo |
| CA-003-04 sin permiso de escritura | Parcial | el modo y el alcance bloquean antes; el 403 real es del adaptador |
| CA-004-02 `doctor` | Cubierto contra falsos | GitLab con `--red`; GitHub y Jira «no comprobable» |
| CA-004-05 token ausente | Cubierto en pendientes, entradas, eventos, salida y errores (centinelas, 3 proveedores) | `integraciones-cli`; la prueba de prompts y puntos de guardado completa sigue siendo F5.1 |
| CA-005-04 plataforma caída | Cubierto | pendiente `fallido`, reintentable, `.sdd/motor` y archivos intactos |
| CA-006-02/03/04 estado, apagar, tope | Cubierto | `estado`, `apagar`, tope antes de la red |

### 10.3 Decisiones

- **Sesión del contador:** `runId` de `.sdd/motor/sesion.json` si es válido; si no, `dia-AAAA-MM-DD` (UTC).
- **Los adaptadores se construyen SIN `auditoria`**: la capa de aprobación envuelve la operación en `AuditoriaIntegraciones.ejecutar` una sola vez (si no, cada publicación contaría dos).
- **El token se lee tras las comprobaciones** de modo, destino, alcance, interruptor y tope; un token ausente no consume tope ni marca el pendiente como fallido.
- **Bloqueo por alcance persistente** (`.sdd/integraciones/alcance.json`): lo escribe `doctor --integraciones-red` y `aprobar` lo respeta. Solo existe para GitLab; GitHub y Jira no son comprobables.
- **Contenido cambiado** (huella): el pendiente pasa a `rechazado`; `--huella` ata la aprobación a lo visto.
- **Un archivo con formato de secreto** en una propuesta se excluye (no se redacta: cambiaría la huella).
- **Jira + propuesta** se rechaza al preparar, no se degrada en silencio.
- **`forge doctor`** llama a `ejecutarIntegraciones(['doctor'])`, que a su vez usa `doctor.js`.

### 10.4 Límites y sin confirmar

- Dos `aprobar` simultáneos del mismo id no tienen candado: la protección es el marcador de los adaptadores.
- El token faltante cuenta como intento solo si el interruptor y el tope pasaron (no cuenta: se lee antes de `ejecutar`).
- El modo `proponer` no se verifica contra permisos reales; todo lo «sin confirmar» de §7 a §9 sigue igual.
- `forge status` e `integraciones estado` cuentan operaciones de la sesión actual, no históricas.
- El ciclo guionizado de la prueba usa modelo y runner simulados; F5.3 (hostil de extremo a extremo comparando resultados) sigue pendiente.

### 10.5 Totales

`npm run typecheck`: 0 errores. `tests/integraciones-*.test.js`: 454 pruebas, 0 fallos (la suite completa la ejecuta quien integra).


## Correcciones de la revisión independiente 1 (R1 a R15)

Prueba: `tests/integraciones-revision1.test.js` (y los cambios en las pruebas existentes). Todo en local, sin red real.

| Hallazgo | Estado | Prueba |
|---|---|---|
| R1 bloqueante | corregido (variables `FORGE_*`, lista de hosts del usuario, vetos siempre, host validado en adaptadores, doctor) | «R1 el repositorio hostil no elige variable ni host» |
| R2 | corregido (recorridos lineales y presupuesto) | «R2 denegación de servicio por CPU» |
| R3, R8 | corregido (`rutas.js` común) | «R3 y R8 rutas vetadas» |
| R4, R5 | corregido (modo y auditoría obligatorios) | «R4 y R5» |
| R6 | corregido (reserva atómica; 8 procesos, tope 3, 3 ejecuciones) | «R6» |
| R7 | corregido (autor verificado; marcador derivado) | «R7» |
| R9 | corregido (interruptor antes de cada escritura) | «R9» |
| R10 | corregido (solo `normal`/`apagado`) | «R10» |
| R11 | corregido (POST no se reintenta tras 503) | «R11» |
| R12 | corregido (símbolo interno de pruebas) | «R12» |
| R13, R14 | corregido (rellenos invisibles; título rechazado) | «R13 y R14» |
| R15 | corregido (rutas normalizables rechazadas) | «R15» |

Límites abiertos: las nuevas protecciones se probaron con servidores falsos; HTTPS real, DNS y proxies siguen sin comprobarse. Se requiere nueva revisión independiente (la 2) antes de publicar.

## F5.1 a F5.3 y cierres de HU-005 e idempotencia (2026-10-13)

Prueba: `tests/integraciones-extremo-a-extremo.test.js` (19 pruebas). Servidores falsos locales de los tres
proveedores y el ciclo guionizado REAL (`CicloVerificado`, implementador por turnos, modelo y runner
simulados). Ninguna petición sale del equipo; todos los tokens son centinelas con formato reconocible.

| Criterio | Qué demuestra | Qué NO demuestra |
|---|---|---|
| CA-004-05 (F5.1) | Con token y usuario centinela en `FORGE_*`, el recorrido `leer` → tareas → ciclo → `publicar` → `vista` → `aprobar` en los tres proveedores deja a los centinelas (y el Base64 de la cabecera Basic, en tres alineaciones) fuera de todos los prompts y `extraContext` de todas las llamadas, de los eventos del ciclo, del estado final, de TODO el árbol `.sdd/` (events.jsonl, motor/**, diario, libro de gasto, integraciones/**) y de stdout y stderr. Con control positivo del buscador y comprobación de que la credencial sí viajó por el cable. Mismos controles en 401 (los tres), destino fuera de la lista, 500 de los tres con el token en el cuerpo, 403 al leer y al escribir, 503 al aprobar y un proceso real de la CLI. Un tercero que pega el token en la incidencia tampoco lo filtra. | Plataformas reales: sus mensajes de error pueden tener otra forma. El enmascarado depende de reconocer el formato del token. |
| RF-001, RF-002 (F5.2) | (a) Ningún archivo de `agents/`, `contratos.js`, `herramientas-coder.js`, `turnos.js`, `core/mcp/herramientas.js` ni `core/mcp/servidor.js` menciona el módulo, `fetch(`, hosts de plataformas ni variables de token; (b) con `fetch` interceptado, un modelo guionizado que pide `fetch`, `http_get`, `publicar_comentario`, `leer_incidencia` y `ejecutar` con URL recibe cinco «Herramienta desconocida», cero intentos de `fetch` y cero peticiones a los servidores; (c) `tools/list` del servidor MCP devuelve exactamente `ejecutar_pruebas`, `leer_archivo`, `escribir_archivo`, y llamar a una operación de integraciones es un error de protocolo. | Un modelo real que invente herramientas distintas: la defensa es que la lista cerrada de herramientas no tiene ninguna de red, no el nombre concreto. |
| CA-001-03, CA-001-04 (F5.3) | Para cada uno de los 52 casos de `hostiles.json` como cuerpo de una incidencia: `leer` → ciclo con las MISMAS respuestas del modelo que con un cuerpo limpio. Idénticos al control: resultado, iteraciones, archivos y huellas, gasto (estado y libro), llamadas, eventos por tipo, eventos de rechazo de escritura (0), lecturas rechazadas (0), peticiones durante el ciclo (0) y `fetch` (0). **Sin hallazgos.** | Que un modelo real no obedezca el texto: aquí el modelo es un guion, así que prueba que el texto hostil no cambia NADA de lo que el sistema decide por su cuenta, no que el modelo resista. |
| HU-005 | `forge run --motor clasico` con el proveedor de pruebas: sin sección, con todo apagado y sin archivo de configuración, cero `fetch`, ninguna lectura de variables de token, ningún módulo de integraciones cargado, y stdout, stderr, código de salida, eventos y archivos creados idénticos a una ejecución con un gancho de resolución que hace que el módulo «no exista». | No es una versión sin el código fuente del módulo, sino su ausencia simulada. `--motor ciclo` exige Docker y no se ejecutó aquí. |
| Idempotencia entre procesos | Dos `aprobar` simultáneos del mismo id, como procesos hijos, contra el mismo servidor falso, 4 rondas con espera tras cada respuesta para ensanchar la ventana: una sola escritura efectiva; el otro proceso falla con «Otro proceso está aprobando…» o devuelve lo ya publicado. | Un candado por archivo no cubre dos máquinas sobre un directorio compartido sin semántica `O_EXCL`. |

### Hallazgo corregido: doble escritura entre procesos

Reproducción (antes del cambio): publicación pendiente de comentario en GitHub; dos procesos
`forge integraciones aprobar <id>` lanzados a la vez (barrera por reloj) contra el mismo servidor falso.
Ambos buscaban el marcador, no lo encontraban y escribían: **2 `POST .../issues/7/comments`**. Causa: el
estado `publicado` se escribe al terminar, y la búsqueda del marcador y la escritura no son atómicas.

Corrección (`core/integraciones/aprobacion.js`): `aprobar` toma `<id>.lock` con creación exclusiva
(`crearArchivo`, `O_EXCL`) antes de hacer nada y lo suelta al terminar. Con el candado puesto, el segundo
proceso falla limpio con código `en_curso` (salida 1). Si llegó justo después, relee el pendiente ya
`publicado` y devuelve lo publicado sin llamar a la plataforma. Un candado cuyo proceso murió o de más de
10 minutos se retira. Un id inexistente no crea nada.

