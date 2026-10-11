# Spike: permisos mínimos por plataforma y operación

> Fecha de consulta: 2026-10-11. Fuente: solo documentación oficial pública, leída en esta sesión. Sin credenciales y sin llamadas a las plataformas.
> Convención (Principio XI): cada dato lleva su URL. **«sin confirmar»** significa que la documentación oficial leída no lo dice; no se ha rellenado de memoria. **«deducido»** significa que no está declarado para ese endpoint y se infiere de una definición general citada; hay que verificarlo contra una cuenta de prueba antes de fiarse.
> Operaciones del puerto (ADR-22): `leer` (un elemento), `comentar`, `proponer` (rama nueva + solicitud en borrador). En Jira no hay equivalente de `proponer`.
> Nota de método: las tablas de permisos de GitHub y las especificaciones de Jira se leyeron en la fuente oficial; las páginas largas de GitLab se leyeron en el texto que devuelve la herramienta de lectura, que en algunos casos estaba truncado (se indica).
> Nota de alcance: los archivos `plan.md` y `tareas.md` citados en el encargo no existen en esta rama (solo hay `spec.md` y ADR-22). Los spikes se han numerado según el orden del encargo: S0.1 GitHub, S0.2 GitLab, S0.4 Jira, S0.3 batería hostil.

---

## 1. GitHub (S0.1)

### 1.1 Cabeceras comunes

| Dato | Valor | Fuente |
|---|---|---|
| Autenticación | `Authorization: Bearer <TOKEN>` o `Authorization: token <TOKEN>` (con JWT, solo `Bearer`) | https://docs.github.com/en/rest/authentication/authenticating-to-the-rest-api |
| Tipo de contenido recomendado | `Accept: application/vnd.github+json` | https://docs.github.com/en/rest/issues/issues?apiVersion=2022-11-28 |
| Versión de API | `X-GitHub-Api-Version` (los ejemplos de la documentación vigente muestran `2026-03-10`; la ruta de la página aún muestra `apiVersion=2022-11-28`) | https://docs.github.com/en/rest/issues/issues?apiVersion=2022-11-28 |
| `User-Agent` | Obligatorio: «All API requests must include a valid `User-Agent` header» | https://docs.github.com/en/rest/using-the-rest-api/getting-started-with-the-rest-api y https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api |
| Base | `https://api.github.com` (en los ejemplos de curl) | https://docs.github.com/en/rest/issues/comments?apiVersion=2022-11-28 |

### 1.2 Operaciones

Los permisos salen de la tabla oficial de permisos de grano fino (columna «access» de cada endpoint): https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens

| Operación | Método y ruta | Permiso de grano fino mínimo (repositorio) | Estado |
|---|---|---|---|
| Leer incidencia | `GET /repos/{owner}/{repo}/issues/{issue_number}` | **Issues: read** (sin permisos adicionales listados) | confirmado |
| Leer comentarios | `GET /repos/{owner}/{repo}/issues/{issue_number}/comments` | **Issues: read** (también figura bajo Pull requests: read; la tabla marca «additional permissions: ✓») | confirmado el permiso; el significado exacto de la marca de «permisos adicionales» **sin confirmar** |
| Comentar | `POST /repos/{owner}/{repo}/issues/{issue_number}/comments` | **Issues: write** (también figura bajo Pull requests: write; marca de permisos adicionales ✓) | confirmado el permiso; igual salvedad |
| Leer rama base (para crear la rama) | `GET /repos/{owner}/{repo}/git/ref/{ref}` con `ref` = `heads/<rama>` | **Contents: read** | confirmado |
| Crear rama | `POST /repos/{owner}/{repo}/git/refs` | **Contents: write** (también figura bajo Workflows: write; marca ✓) | confirmado; ver 1.4 sobre Workflows |
| Subir archivos a la rama (necesario para que haya cambio) | `POST .../git/blobs`, `POST .../git/trees`, `POST .../git/commits` y `PATCH .../git/refs/{ref}` (o `PUT .../contents/{path}`) | **Contents: write** | confirmado el permiso; el flujo exacto (blobs+trees+commits frente a `contents`) es decisión de diseño, no de la fuente |
| Abrir solicitud en borrador | `POST /repos/{owner}/{repo}/pulls` con `"draft": true` | **Pull requests: write** (sin adicionales) | confirmado |
| Leer una solicitud (opcional, verificar) | `GET /repos/{owner}/{repo}/pulls/{pull_number}` | **Pull requests: read** o **Contents: read** | confirmado |

Total mínimo para `proponer` según la tabla: Contents (write) + Pull requests (write). Para `comentar`: Issues (write). Para `leer`: Issues (read). Es decir, **un token con Issues read/write, Contents write y Pull requests write por repositorio**, y nada de administración.

Salvedades de la fuente:
- La tabla de permisos **no menciona Metadata** para estos endpoints, ni como implícito (la página dice que Metadata es una sección propia). Si hace falta Metadata: read de forma implícita, es **sin confirmar**. https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens
- La página de «Create a reference» y la de «Create a pull request» no traen sección de permisos en el texto leído; los permisos de esas dos filas salen solo de la tabla de la página de permisos.
- Los pasos para elegir el permiso correcto en un caso real: la cabecera `X-Accepted-GitHub-Permissions` devuelve los permisos que acepta el endpoint; la coma separa permisos que se necesitan todos, y el punto y coma separa conjuntos alternativos. https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api

### 1.3 Forma de la petición, paginación, límites

| Aspecto | Dato | Fuente |
|---|---|---|
| Comentar: cuerpo | `{"body": "<texto>"}` (`body` obligatorio); 201 creado; 403, 404, 410, 422 | https://docs.github.com/en/rest/issues/comments?apiVersion=2022-11-28 |
| Crear rama: cuerpo | `{"ref": "refs/heads/<nombre>", "sha": "<sha>"}`; 201; 409 conflicto; 422. No se pueden crear referencias en repositorios vacíos | https://docs.github.com/en/rest/git/refs?apiVersion=2022-11-28 |
| Abrir solicitud: cuerpo | `title` (obligatorio salvo `issue`), `head` (obligatorio), `base` (obligatorio, debe existir), `body`, `draft` (booleano), `maintainer_can_modify`; 201; 403; 422 | https://docs.github.com/en/rest/pulls/pulls?apiVersion=2022-11-28 |
| Borradores | «Draft pull requests are available in public repositories with GitHub Free» y, según el mismo texto, en privados solo con ciertos planes (Team y Enterprise Cloud). **Un repositorio privado en plan gratuito puede rechazar `draft: true`: sin confirmar el comportamiento exacto de la API** | https://docs.github.com/en/rest/pulls/pulls?apiVersion=2022-11-28 |
| Paginación | `per_page` máximo 100, por defecto 30, `page` por defecto 1; cabecera `Link` con `rel` `next`, `prev`, `first`, `last` | https://docs.github.com/en/rest/issues/comments?apiVersion=2022-11-28 y https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api |
| Listado de incidencias | Los endpoints de incidencias pueden devolver solicitudes de cambio (clave `pull_request`) | https://docs.github.com/en/rest/issues/issues?apiVersion=2022-11-28 |
| Orden de comentarios | Ascendente por ID | https://docs.github.com/en/rest/issues/comments?apiVersion=2022-11-28 |
| Tamaño máximo del cuerpo | La documentación oficial leída **no lo dice**. Informes de la comunidad hablan de «Body is too long (maximum is 65536 characters)». **sin confirmar** en fuente oficial; usar 65 536 como tope conservador propio | https://docs.github.com/en/rest/issues/comments?apiVersion=2022-11-28 (silencio); comunidad (no es fuente oficial, aparece en resultados de búsqueda): https://github.community/t/maximum-length-for-the-comment-body-in-issues-and-pr/148867 |
| Formato del cuerpo | Tipos de medio `raw` (por defecto, `body`), `text`, `html`, `full` | https://docs.github.com/en/rest/issues/comments?apiVersion=2022-11-28 |

### 1.4 Límite de ritmo

Fuente: https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api

- Primario: 5 000 solicitudes por hora para un token personal.
- Cabeceras: `x-ratelimit-limit`, `x-ratelimit-remaining`, `x-ratelimit-used`, `x-ratelimit-reset` (segundos epoch UTC), `x-ratelimit-resource`.
- Secundario: máximo 100 solicitudes concurrentes; 900 puntos por minuto en REST (GET/HEAD/OPTIONS cuestan 1, POST/PATCH/PUT/DELETE cuestan 5); en general, máximo 80 solicitudes de creación de contenido por minuto y 500 por hora.
- Al excederlo: 403 o 429. Si hay `retry-after`, esperar esos segundos; si `x-ratelimit-remaining` es 0, esperar a `x-ratelimit-reset`; en otro caso, al menos un minuto, con retroceso exponencial.
- Crear comentarios, ramas y solicitudes «too quickly» puede disparar el límite secundario y las páginas de esos endpoints lo avisan (comments, pulls, refs).
- `GET /rate_limit` no cuenta contra el límite. https://docs.github.com/en/rest/rate-limit/rate-limit

### 1.5 ¿Se puede comprobar el alcance del token sin escribir?

| Pregunta | Respuesta | Fuente |
|---|---|---|
| ¿Hay un endpoint que liste los permisos concedidos a un token de grano fino? | **sin confirmar**: las páginas oficiales leídas no describen ninguno | https://docs.github.com/en/rest/authentication/authenticating-to-the-rest-api («does not say whether any header or endpoint reveals a token's permissions») |
| Tokens clásicos: cabecera de ámbitos | `X-Oauth-Scopes` aparece en un ejemplo de respuesta, sin explicación en esa página. Los tokens de grano fino no son clásicos | https://docs.github.com/en/rest/using-the-rest-api/getting-started-with-the-rest-api |
| Cabecera `X-Accepted-GitHub-Permissions` | Informa de lo que **el endpoint exige**, no de lo que **el token tiene**. Sirve para saber qué pedir, no para auditar el token | https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api |
| Sondeo sin escribir | Una lectura (`GET` de la incidencia y de la referencia) con el token confirma permisos de lectura. Un token sin permiso de escritura **solo se descubre al escribir**; en caso de falta de permiso el texto de error es «Resource not accessible by personal access token» (código sin confirmar) y GitHub puede responder 404 en vez de 403 | https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api |
| Caducidad del token | Cabecera de caducidad **sin confirmar** | — |

Consecuencia para `forge doctor` (CA-004-02): con GitHub **no se puede demostrar** «sin más alcance del necesario» solo con la API documentada; solo se puede comprobar «lo necesario para leer». Ver el informe.

---

## 2. GitLab (S0.2)

### 2.1 Cabeceras y tokens

| Dato | Valor | Fuente |
|---|---|---|
| Base | `https://<host>/api/v4` (los ejemplos usan `gitlab.example.com/api/v4`) | https://docs.gitlab.com/api/issues/ |
| Cabecera de token | `PRIVATE-TOKEN: <token>` (recomendada) o `Authorization: Bearer <token>` | https://docs.gitlab.com/api/rest/authentication/ |
| Tipos de token aceptados | Personal, de proyecto y de grupo. Los tokens de despliegue no valen para la API pública | https://docs.gitlab.com/api/rest/authentication/ |
| Tokens de proyecto: disponibilidad | GitLab.com: Premium y Ultimate; Autoalojado: cualquier licencia. En GitLab.com Free no hay token de proyecto (la página lo implica, no lo afirma de forma literal) | https://docs.gitlab.com/user/project/settings/project_access_tokens/ y https://docs.gitlab.com/api/rest/authentication/ |
| Quién puede crear un token de proyecto | Rol Maintainer u Owner | https://docs.gitlab.com/user/project/settings/project_access_tokens/ |
| Usuario bot | Crear un token de proyecto crea un usuario bot con rol del token; no se puede quitar del proyecto | https://docs.gitlab.com/user/project/settings/project_access_tokens/ |
| Caducidad | Por defecto 365 días; máximo 365 por defecto (400 con un indicador de funcionalidad desactivado) | https://docs.gitlab.com/user/project/settings/project_access_tokens/ |
| Id de proyecto | Entero o ruta con codificación URL (`grupo%2Fproyecto`); sin codificar da 404 | https://docs.gitlab.com/api/rest/ |
| Privado sin credenciales | 404 para un no miembro de un proyecto privado | https://docs.gitlab.com/api/issues/ |

### 2.2 Ámbitos de token

Fuente: https://docs.gitlab.com/security/tokens/access_token_scopes/ (disponibles para token personal, de grupo y de proyecto)

| Ámbito | Definición oficial |
|---|---|
| `api` | «Grants complete read and write access to the API for the token's scope» |
| `read_api` | «Grants read access to the API for the token's scope» |
| `read_repository` | «Grants read access (pull) to repositories for the token's scope» |
| `write_repository` | «Grants read and write access (pull and push) to repositories for the token's scope» |

Un token de proyecto «can access only its project». La página **no** dice que el ámbito esté limitado por el rol; esa relación entre ámbito y rol es **sin confirmar** en esa página. La documentación de la API de archivos dice que para crear un archivo hace falta `api` y que `read_repository` soporta lecturas; https://docs.gitlab.com/api/repository_files/. Una búsqueda secundaria indicó que `write_repository` «no soporta autenticación de API»; **sin confirmar** en la fuente oficial leída.

### 2.3 Operaciones

| Operación | Método y ruta | Ámbito mínimo | Rol mínimo | Estado |
|---|---|---|---|---|
| Leer incidencia | `GET /projects/:id/issues/:issue_iid` (`id` y `issue_iid` obligatorios; `issue_iid` es el ID interno) | `read_api` (deducido de la definición del ámbito; la página del endpoint no declara ámbito) | **sin confirmar**: la tabla de permisos muestra «View issues» con siete marcas (todos los roles) | ámbito deducido; rol según tabla |
| Leer notas | `GET /projects/:id/issues/:issue_iid/notes` (`sort` asc/desc, defecto desc; `order_by` `created_at`/`updated_at`, defecto `created_at`) | `read_api` (deducido) | igual | deducido |
| Comentar | `POST /projects/:id/issues/:issue_iid/notes`, cuerpo `body` (obligatorio, «Limited to 1,000,000 characters»), `internal` (booleano, defecto false) | `api` (deducido) | **sin confirmar**. La página de la API de notas y la de permisos no fijan el rol para comentar en incidencias; la tabla de permisos tiene una fila «Leave comments» (proyecto) con siete marcas, y «Add internal notes» con seis (no se pudo mapear la columna que falta) | rol sin confirmar |
| Crear rama | `POST /projects/:id/repository/branches`, parámetros `branch` y `ref` (rama o SHA de origen) | `api` (deducido) | **Developer** («Create new branches»: Developer, Maintainer, Owner) | rol confirmado en la tabla; ámbito deducido |
| Subir archivos a la rama | `POST /projects/:id/repository/commits` con `branch`, `commit_message`, `start_branch` (opcional, «parent for the new commit») y `actions[]` (`action`: `create`, `delete`, `move`, `update`, `chmod`; `file_path`; `content`; `encoding` `text`/`base64`). Alternativa: `POST /projects/:id/repository/files/:file_path` (`branch`, `commit_message`, `content`, `start_branch`) | `api` (para la API de archivos, confirmado: «Creating a file needs `api`») | Developer («Push to non-protected branches») | ámbito confirmado para archivos; para commits, sin confirmar |
| Abrir solicitud de fusión | `POST /projects/:id/merge_requests` con `source_branch`, `target_branch`, `title` (obligatorios), `description` («Limited to 1,048,576 characters»), `remove_source_branch`, `squash`, etc. | `api` (deducido) | **Developer** («Create merge request») | rol confirmado; ámbito deducido |
| Que sea borrador | La página de la API leída **no** documenta un parámetro `draft` de creación; el campo `draft` aparece en la respuesta y como filtro. La guía de usuario dice que se marca como borrador añadiendo `Draft:`, `[Draft]` o `(Draft)` al principio del título | — | — | **sin confirmar en la API**; el prefijo está documentado en la interfaz. Hay que comprobarlo con una instancia de prueba |

Fuentes: https://docs.gitlab.com/api/issues/ · https://docs.gitlab.com/api/notes/ · https://docs.gitlab.com/api/branches/ · https://docs.gitlab.com/api/repository_files/ · https://docs.gitlab.com/api/commits/ · https://docs.gitlab.com/api/merge_requests/ · https://docs.gitlab.com/user/project/merge_requests/drafts/ · https://docs.gitlab.com/user/permissions/

Nota sobre la tabla de roles: el texto de la herramienta de lectura no mostraba los nombres de las columnas junto a las marcas; los roles se asignaron por posición. Es una lectura indirecta: **verificar en la página** antes de decidir.

Nota de lectura: la página de la API de solicitudes de fusión (224 931 caracteres) se leyó en dos tramos de 100 000; los últimos 24 931 caracteres no se leyeron.

### 2.4 Paginación y tamaños

| Aspecto | Dato | Fuente |
|---|---|---|
| Paginación | Por defecto 20, máximo 100 (`per_page`); por desplazamiento por defecto; cabeceras `Link` (`prev`, `next`, `first`, `last`), `x-next-page`, `x-total`; con más de 10 000 registros no se devuelven algunas cabeceras | https://docs.gitlab.com/api/rest/ |
| Cuerpo de nota | 1 000 000 caracteres | https://docs.gitlab.com/api/notes/ |
| Descripción de solicitud | 1 048 576 caracteres | https://docs.gitlab.com/api/merge_requests/ |
| Tamaño de commit | Las solicitudes mayores de 300 MB por defecto se rechazan | https://docs.gitlab.com/api/commits/ |

### 2.5 Límite de ritmo

Fuente: https://docs.gitlab.com/user/gitlab_com/rate_limits/ (solo GitLab.com; en autoalojado el administrador los fija: **sin confirmar** el valor por defecto)

- 429 «Too Many Requests». Cabeceras: `Retry-After` (segundos), `RateLimit-ResetTime` (fecha), y «All responses include `RateLimit-Limit`, `RateLimit-Remaining`, and related headers». Las API de proyectos, grupos y usuarios no incluyen las cabeceras informativas.
- Tráfico autenticado de API por usuario: 2 000 solicitudes por minuto (vigente). Los límites por hora por plan (5 000, 15 000, 25 000) figuran como **propuestos, aún no en vigor**.
- Creación de notas en incidencias y solicitudes de fusión: 60 por minuto. Creación de incidencias: 200 por minuto.

### 2.6 ¿Se puede comprobar el alcance sin escribir?

| Pregunta | Respuesta | Fuente |
|---|---|---|
| Token personal | `GET /personal_access_tokens/self` devuelve los detalles del token con el que se autentica la solicitud; los atributos incluyen `scopes` (matriz) y `expires_at` | https://docs.gitlab.com/api/personal_access_tokens/ |
| Token de proyecto | La página de tokens de proyecto documenta `GET projects/:id/access_tokens/:token_id` (con `scopes`, `access_level`, `expires_at`, `active`, `revoked`) pero sin rol requerido, y solo la palabra clave `self` para rotar. Si `/personal_access_tokens/self` funciona con tokens de proyecto es **sin confirmar** | https://docs.gitlab.com/api/project_access_tokens/ |
| Rol del token | `access_level` (por ejemplo 40) en el recurso del token de proyecto | https://docs.gitlab.com/api/project_access_tokens/ |

---

## 3. Jira Cloud (S0.4)

Los permisos y esquemas salen de la especificación OpenAPI oficial que publica Atlassian: https://dac-static.atlassian.com/cloud/jira/platform/swagger-v3.v3.json (versión leída `1001.0.0-SNAPSHOT-0c0db68a171663452b321ade8630cf9c8cada05d`). Las páginas HTML de `developer.atlassian.com` llegaron truncadas a la herramienta de lectura, por eso la fuente primaria es ese JSON.

### 3.1 Autenticación y base

| Dato | Valor | Fuente |
|---|---|---|
| Esquemas de seguridad declarados | `basicAuth` («You can access this resource via basic auth») y `OAuth2` (3LO) | https://dac-static.atlassian.com/cloud/jira/platform/swagger-v3.v3.json |
| Token de API con Basic | `Authorization: Basic base64("correo:token")`. Ejemplo oficial: `fred:fred` → `ZnJlZDpmcmVk` | https://developer.atlassian.com/cloud/jira/platform/basic-auth-for-rest-apis/ |
| Advertencia oficial | «Basic authentication is not as secure as other methods»; recomendada «for simple scripts and manual calls» | https://developer.atlassian.com/cloud/jira/platform/basic-auth-for-rest-apis/ |
| Base con token sin ámbitos | `https://<dominio>.atlassian.net/rest/api/3/...` | https://developer.atlassian.com/cloud/jira/platform/basic-auth-for-rest-apis/ |
| Token **con ámbitos** | Se llama a `https://api.atlassian.com/ex/jira/{cloudId}`; el ejemplo oficial envía `--user correo:token` a esas URL | https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/ |
| Cómo obtener `cloudId` | **sin confirmar** (no figura en las páginas oficiales leídas) | — |
| Caducidad del token | De 1 a 365 días, por defecto un año. Los tokens con ámbitos se recomiendan frente a los que no tienen ámbitos | https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/ |
| Cuenta de servicio | Hay que crear la cuenta de servicio antes de su token, y su token exige elegir ámbitos | https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/ |
| Ámbitos de Jira (nombres) | `read:jira-work`, `write:jira-work`, `read:jira-user` (clásicos); granulares «Beta» listados abajo | https://dac-static.atlassian.com/cloud/jira/platform/swagger-v3.v3.json |

### 3.2 Operaciones

| Operación | Método y ruta | Permiso de proyecto mínimo | Ámbito OAuth/token (Current) | Ámbitos granulares (Beta, según el JSON) |
|---|---|---|---|---|
| Leer ticket | `GET /rest/api/3/issue/{issueIdOrKey}` | *Browse projects* en el proyecto del ticket; si hay seguridad de nivel de incidencia, permiso sobre esa incidencia | `read:jira-work` | `read:issue-meta:jira`, `read:issue-security-level:jira`, `read:issue.vote:jira`, `read:issue.changelog:jira`, `read:avatar:jira`, `read:issue:jira`, `read:status:jira`, `read:user:jira`, `read:field-configuration:jira` |
| Leer comentarios | `GET /rest/api/3/issue/{issueIdOrKey}/comment` | *Browse projects*; si el comentario tiene visibilidad restringida, pertenecer al grupo o rol | `read:jira-work` | `read:comment:jira`, `read:comment.property:jira`, `read:group:jira`, `read:project:jira`, `read:project-role:jira`, `read:user:jira`, `read:avatar:jira` |
| Comentar | `POST /rest/api/3/issue/{issueIdOrKey}/comment` | *Browse projects* **y** *Add comments*; si hay seguridad de incidencia, permiso sobre ella | `write:jira-work` | `read:comment:jira`, `read:comment.property:jira`, `read:group:jira`, `read:project:jira`, `read:project-role:jira`, `read:user:jira`, `write:comment:jira`, `read:avatar:jira` |
| Proponer cambio | No hay equivalente en Jira (spec lo fija así) | — | — | — |

Descripciones de ámbito oficiales: `read:jira-work` = «Read project and issue data. Search for issues and objects associated with issues»; `write:jira-work` = «Create and edit issues in Jira, post comments, create worklogs, and delete issues». Atención: **`write:jira-work` es más amplio que «comentar»** (incluye crear y editar incidencias y borrar). Con los ámbitos «Beta» se puede acotar a `write:comment:jira`, pero están marcados Beta en la especificación. Fuente de todo el apartado: https://dac-static.atlassian.com/cloud/jira/platform/swagger-v3.v3.json

La API **no tiene permiso más estrecho que «Add comments» a nivel de proyecto**, que lo gobierna el esquema de permisos del proyecto y el usuario del token, no el token.

### 3.3 Petición, respuesta, paginación

| Aspecto | Dato |
|---|---|
| Leer: parámetros | `fields` (por defecto devuelve todos), `expand` (`renderedFields`, `names`, `schema`, `transitions`, `editmeta`, `changelog`, `versionedRepresentations`), `fieldsByKeys`, `properties`, `updateHistory`, `failFast` |
| Leer: respuestas | 200; 401 credenciales incorrectas o ausentes; 404 «not found or the user does not have permission to view it» |
| Comentar: cuerpo | `body` en Atlassian Document Format (documento `{"type":"doc","version":1,"content":[...]}`); `visibility` y `properties` opcionales |
| Comentar: respuestas | 201; 400 petición inválida; 401; 404; 413 «if the per-issue limit has been breached» para comentarios o adjuntos |
| Leer comentarios: paginación | `startAt`, `maxResults` (por defecto 100), `orderBy` (solo `created`), `expand=renderedBody`; respuesta con `startAt`, `maxResults`, `total`, `comments` |
| Límite del texto del comentario | **sin confirmar** (la especificación no da un máximo de caracteres; solo el 413 por límite por incidencia, cuyo valor no figura) |
| ADF: nodos de bloque de primer nivel | blockquote, bulletList, codeBlock, expand, heading, mediaGroup, mediaSingle, orderedList, panel, paragraph, rule, table (y otros): https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/ |
| ADF: obligatorios | `version` solo en la raíz, `type` en todo nodo, `content` en los nodos de bloque |

Fuente de la tabla: https://dac-static.atlassian.com/cloud/jira/platform/swagger-v3.v3.json salvo ADF.

### 3.4 Límite de ritmo

Fuente: https://developer.atlassian.com/cloud/jira/platform/rate-limiting/

- Cuota por puntos por hora (reinicio a la hora UTC) para aplicaciones Forge, Connect y OAuth 2.0 (3LO). **«API token-based traffic is not affected by this change»**: el tráfico con token de API sigue bajo los límites de ráfaga existentes.
- Ráfaga por segundo: GET y POST 100 por segundo, PUT y DELETE 50 (por defecto, algunos endpoints tienen otros).
- Escrituras por incidencia: 20 cada 2 segundos y 100 cada 30 segundos.
- 429 con `Retry-After`; `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` (ISO 8601, solo con 429), `X-RateLimit-NearLimit` (`true` con menos del 20 % de capacidad), `RateLimit-Reason` (`jira-quota-global-based`, `jira-quota-tenant-based`, `jira-burst-based`, `jira-per-issue-on-write`).
- Recomendación: respetar `Retry-After`, retroceso exponencial con jitter, tope de reintentos.

### 3.5 ¿Se puede comprobar el alcance sin escribir?

| Pregunta | Respuesta | Fuente |
|---|---|---|
| Identidad del token | `GET /rest/api/3/myself` (permiso: acceso a Jira; ámbito `read:jira-user`) | https://dac-static.atlassian.com/cloud/jira/platform/swagger-v3.v3.json |
| Permisos del usuario en un proyecto o incidencia | `GET /rest/api/3/mypermissions?projectKey=...&permissions=BROWSE_PROJECTS,ADD_COMMENTS` devuelve qué permisos tiene el usuario en ese contexto; no exige permiso (`Permissions required: None`); ámbito `read:jira-work` | https://dac-static.atlassian.com/cloud/jira/platform/swagger-v3.v3.json |
| Ámbitos del token en sí | **sin confirmar**: no hay endpoint documentado que devuelva los ámbitos de un token de API de Jira; `mypermissions` informa de los permisos del **usuario**, no de los ámbitos del token | — |
| Nombre de las claves de permiso (`ADD_COMMENTS`) | El JSON remite a «Get all permissions» para listarlas; el valor literal `ADD_COMMENTS` **sin confirmar** en lo leído (solo se vio `BROWSE_PROJECTS` y `EDIT_ISSUES` citados en la descripción) | https://dac-static.atlassian.com/cloud/jira/platform/swagger-v3.v3.json |
