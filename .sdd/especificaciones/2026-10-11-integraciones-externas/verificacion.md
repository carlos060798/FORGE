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
