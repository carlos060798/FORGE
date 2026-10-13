# Integraciones externas: GitHub, GitLab y Jira

> Fecha: **2026-10-12**. Estado: **en construcción**, en la rama `feature/motor-agentico`, sin publicar (5.0.0 no está publicada). Spec: `.sdd/especificaciones/2026-10-11-integraciones-externas/spec.md` (en implementación por instrucción del dueño, **pendiente de su ratificación formal**). Decisión técnica: ADR-22.
>
> No confundir con [INTEGRACIONES.md](INTEGRACIONES.md), que describe los servidores MCP (Vercel, GitHub, Figma) que usa **Claude Code** junto a FORGE. Este documento trata de lo que **FORGE** hace por su cuenta con tres plataformas de gestión de trabajo, y es otra cosa.

## En una frase

Una tarea puede **nacer de una incidencia o ticket** y su resultado puede **volver como comentario o como solicitud de cambio en borrador**, sin que ningún modelo vea una credencial ni disponga de una herramienta de red, y sin ningún cambio para quien no lo configure.

## Estado de cada pieza

| Pieza | Estado | Dónde |
|---|---|---|
| Configuración `integraciones:` (claves planas, validación, modos, lista cerrada de destinos) | Hecha | `core/integraciones/config.js` |
| Texto de la plataforma como dato no confiable (delimitado, acotado, redactado) | Hecha | `core/integraciones/confianza.js` |
| Cliente HTTP mínimo (solo HTTPS, host en lista, sin redirecciones a otro host, topes) | Hecho | `core/integraciones/http.js` |
| Auditoría, topes por sesión e interruptor de apagado | Hecha | `core/integraciones/auditoria.js` |
| Adaptadores de GitHub, GitLab y Jira Cloud (leer, comentar, proponer, comprobar alcance) | Hechos, **contra servidores simulados**; ninguno se ha ejecutado contra una cuenta real | `core/integraciones/proveedores/` |
| Prueba de contrato común a los tres adaptadores | Hecha | `tests/integraciones-contrato-comun.test.js` |
| Cola de pendientes, vista previa y aprobación (`aprobacion.js`) | **En construcción** (fase F3) | — |
| Armar la publicación desde el estado del ciclo | **En construcción** (F3) | — |
| Comando `forge integraciones` (`leer`, `publicar`, `aprobar`, `estado`, `apagar`) | **En construcción** (F4) | — |
| Comprobaciones de `forge doctor` para integraciones y estado en `forge status` | **En construcción** (F4) | — |
| Prueba de no filtración del token en todo el recorrido, revisión independiente | **Pendientes** (F5) | — |
| Cliente MCP de solo lectura detrás del mismo puerto | **No empezado**; solo con decisión del dueño (F6) | — |

Lo marcado «en construcción» está descrito aquí según `plan.md` y `tareas.md` de la spec. **Hoy no existe el comando `forge integraciones`**: los módulos se pueden importar y probar, pero ninguna orden de la línea de comandos los usa todavía.

## Qué hace

- **Leer** una incidencia (GitHub, GitLab) o un ticket (Jira Cloud): título, descripción, etiquetas y comentarios, normalizados a una forma común.
- **Comentar** en esa incidencia o ticket, con un marcador oculto para no duplicar la publicación.
- **Proponer un cambio** como rama nueva con prefijo `forge/` y solicitud de cambio **en borrador** (GitHub y GitLab). Jira no tiene equivalente: ahí `proponer` se trata como `comentar`.
- **Comprobar el alcance del token** donde la plataforma lo permite (GitLab con token personal).
- **Auditar** cada operación (`integracion:*`: proveedor, operación, destino, resultado y duración; sin contenido ni credenciales) y **cortar** cuando se supera un tope por sesión y por proveedor.

## Qué NO hace

- **No está encendido**: sin la sección `integraciones:`, o con todo `apagado`, no abre ninguna conexión nueva ni lee ninguna variable de entorno de tokens.
- **No da herramientas de red, credenciales ni URL a ningún modelo.** Toda operación corre en el proceso de FORGE, nunca dentro del contenedor ni en un agente.
- **No fusiona, aprueba, cierra, reabre, asigna, cambia de estado ni borra** nada en ninguna plataforma.
- **No escribe en ramas existentes ni protegidas.**
- **No sigue ni descarga** enlaces, imágenes ni adjuntos del elemento.
- **No admite** Jira Data Center, Bitbucket, Azure DevOps ni Linear; **no recibe eventos** (sin webhooks ni servidor a la escucha); **no hace OAuth interactivo**; **no es un cliente MCP** (usa REST directo, ADR-22).
- **No añade dependencias** al paquete.
- **No detecta inyección de instrucciones.** El texto de la plataforma se trata como dato por estructura (delimitado, acotado, sin autoridad sobre reglas, topes ni herramientas); no hay un filtro que adivine intenciones.
- **No demuestra** que el token tenga el mínimo alcance en GitHub ni en Jira: ninguna de las dos APIs documentadas lo informa.
- **Con las integraciones activas no cambia** `forge run`, `forge resume`, el modo clásico, el servidor MCP ni la API HTTP: los módulos se cargan solo desde su propio comando.

## Configuración

Sección `integraciones:` de `.sdd/sdd.config.yaml`, con **claves planas** (un solo nivel, **exactamente dos espacios** de sangría). Es una decisión del plan, para no tocar el lector mínimo de configuración y evitar el error de sangría que ya mordió en otras secciones. A diferencia de las demás secciones, **aquí una clave mal sangrada, anidada, repetida, sin valor o desconocida es un error** que impide empezar, no se ignora.

```yaml
integraciones:
  github_modo: solo_lectura              # apagado | solo_lectura | comentar | proponer
  github_token_env: FORGE_GITHUB_TOKEN   # NOMBRE de la variable de entorno; nunca el token
  github_destinos: org/repo, org/otro    # lista cerrada, separada por comas

  gitlab_modo: apagado
  gitlab_host: gitlab.com                # por defecto gitlab.com; autoalojado: gitlab.empresa.com
  gitlab_token_env: FORGE_GITLAB_TOKEN
  gitlab_destinos: grupo/proyecto

  jira_modo: apagado
  jira_sitio: ejemplo.atlassian.net      # solo Jira Cloud
  jira_usuario_env: FORGE_JIRA_USUARIO   # variable con el correo del usuario de servicio
  jira_token_env: FORGE_JIRA_TOKEN
  jira_destinos: ABC, DEF                # claves de proyecto

  topes_operaciones_por_sesion: 20       # por proveedor; de 1 a 1000
```

| Clave | Obligatoria con el proveedor activo | Regla |
|---|---|---|
| `<proveedor>_modo` | No (por defecto `apagado`) | Uno de los cuatro modos. Sin ella el proveedor queda apagado aunque tenga otras claves (con un aviso) |
| `<proveedor>_token_env` | Sí | Nombre de variable (`[A-Za-z_][A-Za-z0-9_]*`). **No hay nombre por defecto.** Un valor que parezca un token (formato conocido, más de 64 caracteres, o 20 o más mezclando mayúsculas, minúsculas y cifras) impide empezar, y el mensaje no lo imprime |
| `<proveedor>_destinos` | Sí | Lista cerrada. Sin comodines (`* ? [ ] { }`). Formato: `org/repo` (GitHub), `grupo[/subgrupo]/proyecto` (GitLab), clave en mayúsculas (Jira). No existe «todos» |
| `gitlab_host` | No | Solo nombre de host, sin esquema (siempre HTTPS), sin ruta ni credenciales ni dirección IP |
| `jira_sitio` | Sí en Jira | Debe ser `nombre.atlassian.net` |
| `jira_usuario_env` | Sí en Jira | Variable con el correo del usuario de servicio |
| `topes_operaciones_por_sesion` | No (20) | Entero de 1 a 1000. Cuenta intentos, no éxitos |

El host de GitHub es siempre `api.github.com`.

**Interruptor.** `FORGE_INTEGRACIONES=apagado` en el entorno, o el archivo `.sdd/integraciones/apagado`, detiene toda operación posterior, también las ya aprobadas y aún no publicadas. No cancela una petición que ya salió (ver Límites).

## Modos

| Modo | Leer | Comentar | Proponer cambio |
|---|---|---|---|
| `apagado` (por defecto) | No | No | No |
| `solo_lectura` | Sí | No | No |
| `comentar` | Sí | Sí | No |
| `proponer` | Sí | Sí | Sí (rama `forge/…` y solicitud en borrador) |

El modo por defecto al activar un proveedor es `solo_lectura`. En Jira, `proponer` equivale a `comentar`. **Toda escritura exige aprobación humana**: la opción `aprobacion: no_requerida` de la spec original **no existe** en la primera entrega (suposición 5 del plan).

## Modelo de seguridad

1. **El modelo no participa.** Ninguna función del módulo la llama un agente. Lo único que un agente puede recibir es el texto de una incidencia **ya convertido en dato** (delimitado con un marcador aleatorio, acotado en bytes, redactado de secretos, sin caracteres de control ni invisibles, sin los marcadores propios de FORGE y sin enlaces activos).
2. **Conjunto cerrado de operaciones.** El contrato (`puerto.js`) solo admite leer, comentar, proponer y comprobar alcance. Un proveedor que exponga algo genérico («llamar a la API») se rechaza.
3. **El token vive en una variable de entorno** y solo se lee, de una sola función, cuando el proveedor está activo. No se guarda en archivos, no aparece en errores (se enmascara) ni en el registro.
4. **Red estricta.** Solo HTTPS; el host debe estar en la lista; sin redirecciones a otro host (se sigue una sola, a la misma ruta de un host permitido y solo para lecturas); tiempo máximo y tope de bytes por respuesta; reintento acotado solo para 429 y 503.
5. **Lista cerrada de destinos**, comprobada antes de cualquier llamada de red.
6. **La publicación la decide el estado de control, no un texto** (Principio VI): qué se publica y dónde sale del estado del ciclo y de la configuración. *(Esta pieza es parte de F3: en construcción.)*
7. **Aprobación humana con vista previa exacta**, y la solicitud en borrador de la plataforma como segunda barrera. *(En construcción.)*
8. **Idempotencia local**, porque ninguna de las tres APIs documenta una clave de idempotencia: un marcador oculto en el texto y una búsqueda previa.
9. **Topes y apagado**, con el mismo espíritu que el tope de gasto.

## Riesgos agénticos cubiertos y con qué capa

Los nombres ASI01 a ASI10 son los del Top 10 de OWASP para aplicaciones agénticas 2026 **tomados de resúmenes de terceros: no se han confirmado contra el documento original de OWASP** (la spec lo avisa). La columna «Estado» dice si la capa existe hoy.

| Riesgo | Capa | Estado hoy |
|---|---|---|
| **ASI01** secuestro del objetivo | El texto de la plataforma es dato delimitado; ninguna regla, tope ni herramienta depende de él. La defensa es estructural, no un detector | Capa de datos hecha y probada con una batería hostil; la prueba de extremo a extremo con el ciclo (F5.3) **pendiente** |
| **ASI02** mal uso de herramientas | Operaciones cerradas; ningún modelo tiene herramientas de red; tope de operaciones | Capa hecha; la prueba de que no existe ruta del modelo a la red (F5.2) **pendiente** |
| **ASI03** abuso de identidad y privilegios | Token por proveedor en variable de entorno, lista de destinos obligatoria, modo por proveedor | Hecha; comprobación de alcance en `doctor` (F4.2) **en construcción**; prueba de no filtración (F5.1) **pendiente** |
| **ASI04** cadena de suministro | Sin dependencias nuevas, sin descarga de esquemas remotos, versión de API fijada | Hecha |
| **ASI05** ejecución inesperada | La integración corre en el anfitrión y nunca ejecuta lo traído; el código generado sigue en el entorno aislado | Hecha (por diseño); revisión independiente **pendiente** |
| **ASI06** contaminación de contexto | El texto traído no entra en memoria persistente ni en el índice semántico sin marca de origen | **Pendiente** de prueba con la memoria semántica activa |
| **ASI07** comunicación entre agentes | No aplica: no hay mensajes entre agentes; las llamadas son de FORGE a la plataforma con TLS verificado y sin redirecciones a otro host | Hecha; prueba de redirección hecha en `tests/integraciones-http.test.js` |
| **ASI08** fallos en cascada | Tope por sesión y por proveedor, reintento acotado, una plataforma caída no detiene el ciclo | Topes y reintentos hechos; que la publicación quede pendiente y reintentable (F3.4) **en construcción** |
| **ASI09** confianza humano-agente | Vista previa exacta y aprobación explícita; el comentario declara su origen; borrador, nunca fusión | **En construcción** (F3); el borrador sí está en los adaptadores |
| **ASI10** agentes fuera de control | Apagado inmediato, auditoría y modo `apagado` por defecto | Interruptor, auditoría y modo por defecto hechos; `forge integraciones apagar` **en construcción** |

La revisión independiente (`revisor` y `seguridad`) con esta lista como guion es la tarea F5.4 y **no se ha hecho**.

## Permisos mínimos por plataforma

Fuente: `.sdd/especificaciones/2026-10-11-integraciones-externas/spikes/permisos-minimos.md`, leído de la documentación oficial el 2026-10-11, sin credenciales ni llamadas a las plataformas. **«Sin confirmar»** significa que la documentación leída no lo dice; **«deducido»**, que se infiere de una definición general. **Nada de esto se ha verificado contra una cuenta real.**

### GitHub (token de grano fino, por repositorio)

| Operación | Ruta | Permiso mínimo | Estado |
|---|---|---|---|
| Leer incidencia y comentarios | `GET /repos/{o}/{r}/issues/{n}` y `.../comments` | Issues: read | Confirmado |
| Comentar | `POST .../issues/{n}/comments` | Issues: write | Confirmado el permiso; el significado de la marca de «permisos adicionales» **sin confirmar** |
| Leer la rama base | `GET .../git/ref/heads/<rama>` | Contents: read | Confirmado |
| Crear rama y subir archivos | `POST .../git/refs`, blobs, trees, commits | Contents: write | Confirmado el permiso; el flujo exacto es decisión de diseño |
| Abrir solicitud en borrador | `POST .../pulls` con `draft: true` | Pull requests: write | Confirmado |

En total, para `proponer`: Issues (write), Contents (write) y Pull requests (write), y nada de administración. **Sin confirmar:** si hace falta Metadata: read; el tamaño máximo del cuerpo de un comentario (se usa un tope propio conservador); qué hace GitHub con `draft: true` en un repositorio privado de plan gratuito; si un permiso que falta devuelve 403 o 404 (puede ser 404). **El alcance de un token de grano fino no se puede consultar** con la API documentada.

### GitLab (token personal o de proyecto)

| Operación | Ruta | Ámbito | Rol mínimo | Estado |
|---|---|---|---|---|
| Leer incidencia y notas | `GET /projects/:id/issues/:iid` y `.../notes` | `read_api` | Sin confirmar | Ámbito **deducido** |
| Comentar | `POST .../issues/:iid/notes` | `api` | **Sin confirmar** | Ámbito deducido |
| Crear rama | `POST .../repository/branches` | `api` | Developer | Rol confirmado, ámbito deducido |
| Subir archivos | `POST .../repository/commits` | `api` | Developer | Ámbito sin confirmar para commits |
| Abrir solicitud de fusión | `POST .../merge_requests` | `api` | Developer | Rol confirmado, ámbito deducido |
| Que sea borrador | prefijo `Draft:` en el título | — | — | El parámetro `draft` de la API **no está confirmado**; el adaptador usa el prefijo y rechaza una respuesta que no venga marcada como borrador |

Notas: en **GitLab.com Free no hay tokens de proyecto** (se usa un token personal de un usuario de servicio con acceso solo a los proyectos permitidos); los tokens de proyecto exigen rol Maintainer u Owner para crearlos. Con un token personal, `GET /personal_access_tokens/self` informa de los ámbitos: es lo único comprobable. La lectura de la tabla de roles del spike fue indirecta (por posición de columnas): hay que verificarla en la página.

### Jira Cloud (token de API de un usuario de servicio, sin ámbitos)

| Operación | Ruta | Permiso de proyecto | Estado |
|---|---|---|---|
| Leer ticket y comentarios | `GET /rest/api/3/issue/{clave}` y `.../comment` | Browse projects | Confirmado; ámbito `read:jira-work` |
| Comentar | `POST /rest/api/3/issue/{clave}/comment` | Browse projects y Add comments | Confirmado; ámbito `write:jira-work` |

Autenticación: `Authorization: Basic base64(correo:token)` contra `https://<sitio>.atlassian.net`. **`write:jira-work` es más amplio que «comentar»** (incluye crear, editar y borrar incidencias); con ámbitos granulares (marcados Beta) se podría acotar a `write:comment:jira`. La API **no tiene un permiso más estrecho que «Add comments»** a nivel de proyecto: lo gobierna el esquema de permisos del proyecto, no el token. **La primera entrega solo admite token sin ámbitos**: con ámbitos la base de la API cambia (`api.atlassian.com/ex/jira/{cloudId}`) y cómo obtener el `cloudId` está **sin confirmar**. **El alcance de un token no se puede consultar**; `mypermissions` informa de los permisos del usuario, no de los ámbitos del token. Jira no tiene equivalente a una solicitud de cambio.

## Flujo: leer → ciclo → publicar → aprobar

```
forge integraciones leer github org/repo#123          (en construcción: F4)
  → valida modo y destino ANTES de cualquier red
  → proveedor.leerElemento (HTTPS, host permitido, tope de tamaño)
  → confianza: dato delimitado, redactado y acotado
  → escribe .sdd/integraciones/entrada/<id>.json y un archivo de tareas
  → muestra la descripción que el ciclo usaría; no ejecuta nada

forge run --motor ciclo --tasks .sdd/integraciones/entrada/<id>.tareas.json
  → el ciclo verificado de siempre, sin cambios

forge integraciones publicar <id> --tipo comentario|propuesta   (en construcción: F3 y F4)
  → arma la publicación desde el ESTADO del ciclo (huellas, resultado, evidencia), redactada y acotada
  → la deja en pendientes con vista previa; NO escribe en la plataforma

forge integraciones aprobar <id>                      (en construcción: F3 y F4)
  → comprueba modo, destino, tope y que la vista previa no haya cambiado (huella)
  → proveedor.comentar / proponerCambio, idempotente por identificador
  → evento integracion:publicado
```

Lo que la spec y el plan prometen para ese flujo y **todavía no existe**: la cola de pendientes (`.sdd/integraciones/pendientes/`), la vista previa, la aprobación por línea de comandos, y excluir de lo publicado los archivos de dependencias y configuración que el ciclo pausó. Si una publicación falla (caída, límite de uso, token caducado), la tarea y su evidencia no se pierden: queda pendiente y reintentable (criterio CA-005-04, **sin implementar**).

## Límites

- **Nada probado contra una plataforma real.** Los adaptadores se probaron contra servidores HTTP falsos locales cuyas respuestas siguen `spikes/contratos-respuesta.md`: **ejemplos inventados, no capturas**. Que pasen demuestra el adaptador contra ese modelo, no contra GitHub, GitLab o Jira. Hay pruebas opt-in con cuentas reales (`FORGE_TEST_INTEGRACIONES=1`, `FORGE_PRUEBA_GITHUB_REAL=1`) escritas y **no ejecutadas**.
- **DNS.** El cliente valida el nombre del host, no la dirección a la que resuelve: un nombre de la lista que apunte a una IP interna llegaría hasta allí.
- **Redirecciones.** Solo una, a la misma ruta de un host permitido. Un repositorio renombrado o transferido da un error claro, no un seguimiento.
- **Apagado.** Detiene lo que venga después; no cancela una petición ya enviada.
- **Contador de operaciones.** Es un archivo de anexado sin candado: dos procesos a la vez pueden pasarse del tope por una unidad. Y vale por sesión solo si quien llama pasa el identificador de sesión del ciclo; hoy nadie lo pasa.
- **Neutralización de texto.** No es un detector de inyección ni un filtro semántico: el texto sigue pudiendo pedir cosas; lo que no puede es parecer una instrucción de FORGE, salirse del bloque ni traer enlaces activos. Se pierden los caracteres de formato (incluido el unidor de emojis compuestos) y las cabeceras markdown se reescriben.
- **Batería hostil.** Hay 52 casos en `tests/fixtures/integraciones/hostiles.json` (la spec pedía al menos 30) y la capa de confianza los recorre. La prueba de extremo a extremo con el ciclo (CA-001-04) está **pendiente**.
- **Marcadores de idempotencia.** Quien pueda comentar puede pegar el marcador y hacer que FORGE **omita** una publicación (nunca duplicarla ni falsearla).
- **Comentarios muy largos o muchos.** Pasados 1000 comentarios (GitHub, Jira) o 500 notas (GitLab), la lectura devuelve los primeros sin avisar en el elemento y la publicación se niega.
- **GitHub.** Máximo 20 archivos y 1 MiB por propuesta, todos con modo `100644` (un ejecutable pierde el modo); `.github/workflows/` rechazado. No se ha confirmado por ejecución la forma de los cuerpos de la API Git Data.
- **GitLab.** El adaptador no distingue `.gitlab-ci.yml`: una solicitud en borrador que lo cambie ejecuta pipelines en la rama (es un filtro de F3.2, **pendiente**).
- **Jira.** Las marcas del formato (negrita, código…) se pierden salvo el enlace; los nodos ADF desconocidos se reducen a su texto. Un 403 por falta de «Add comments» solo se descubre al publicar.
- **Aprobación mecánica.** Un revisor que apruebe sin leer anula la barrera. La vista previa y el borrador en la plataforma reducen el riesgo; no lo eliminan.
- **Sin revisión independiente** de seguridad de este módulo todavía (F5.4).

## Referencias

- `.sdd/especificaciones/2026-10-11-integraciones-externas/`: `spec.md`, `plan.md`, `tareas.md`, `verificacion.md` y `spikes/`.
- `.sdd/arquitectura/ADR-22-integraciones-externas-sin-herramientas-para-el-modelo.md`.
- [PROBLEMAS-CONOCIDOS.md](PROBLEMAS-CONOCIDOS.md), sección «Integraciones externas».
- [INTEGRACIONES.md](INTEGRACIONES.md): los servidores MCP de Claude Code (otro documento).


## Dónde viven las decisiones de seguridad (revisión 1)

La configuración del proyecto no es de confianza. Por eso:

- **Variables**: `*_token_env` y `jira_usuario_env` solo admiten nombres `FORGE_` + mayúsculas, dígitos y `_` (por ejemplo `FORGE_GITHUB_TOKEN`). Se rechazan variables ajenas (`AWS_SECRET_ACCESS_KEY`, `PATH`...) y las que FORGE ya usa (`FORGE_BUDGET_USD`, `FORGE_LLM_PROVIDER`, `FORGE_INTEGRACIONES`...).
- **Hosts**: `api.github.com` y `gitlab.com` son los de defecto. Un GitLab autoalojado o cualquier sitio de Jira solo recibe credenciales si lo autorizas TÚ en tu entorno: `FORGE_INTEGRACIONES_HOSTS=gitlab.empresa.com,tuempresa.atlassian.net` (lista separada por comas, comparación exacta). Si falta, el error dice qué definir y no se lee ningún token ni se hace ninguna petición.
- **Siempre rechazados**, aunque estén en la lista: `localhost`, `*.localhost`, `*.internal`, `*.local`, IP literales, `metadata.*` y puertos distintos de 443.
- **Interruptor**: `FORGE_INTEGRACIONES` solo admite `normal` y `apagado`; cualquier otro valor apaga y avisa.
- **Tope por sesión**: un archivo por sesión y recuento atómico entre procesos; la sesión por defecto es por día.
- **Rutas de `proponerCambio`**: lista común (`.github/`, `.gitlab/`, CI, `.gitmodules`, `.gitattributes`, `.gitignore`, `CODEOWNERS`, `.git` y variantes).
- **Marcador de idempotencia**: solo vale el comentario que escribió la cuenta del propio token; si lo escribió otro (o no se puede comprobar), se publica uno propio con un marcador derivado. Quien copia el marcador solo puede provocar una publicación adicional, nunca suprimirla.