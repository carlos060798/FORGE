# Spike: contratos de petición y respuesta por plataforma

> Fecha de consulta: 2026-10-11. Solo documentación oficial pública; ninguna llamada real.
> **Todos los JSON de este archivo son EJEMPLOS construidos a mano** con los campos que la documentación declara. Los valores (identificadores, nombres, fechas, SHA) son inventados. Donde la documentación oficial trae un ejemplo literal, se indica. Ningún JSON es una respuesta real capturada.
> Convención (Principio XI): **«sin confirmar»** = la fuente leída no lo dice. Los permisos y límites están en `permisos-minimos.md`; aquí solo la forma.
> Los campos listados como «mínimos que FORGE usaría» son una propuesta de diseño, no un dato de la fuente.

---

## 1. GitHub

### 1.1 Leer incidencia

`GET https://api.github.com/repos/{owner}/{repo}/issues/{issue_number}`
Cabeceras: `Authorization: Bearer <TOKEN>`, `Accept: application/vnd.github+json`, `X-GitHub-Api-Version`, `User-Agent`.
Fuente de ruta y campos: https://docs.github.com/en/rest/issues/issues?apiVersion=2022-11-28 (la página da solo el esquema, «Same response schema as Create an issue»; campos: `id`, `node_id`, `number`, `state`, `title`, `body`, `user`, `labels`, `assignees`, `milestone`, `comments`, `created_at`, `updated_at`, `repository`). Códigos: 200, 301 (transferida), 304, 404, 410 (borrada).
Aviso: los endpoints de incidencias pueden devolver solicitudes de cambio, que se reconocen por la clave `pull_request`. `body` puede ser `null` en la práctica (**sin confirmar** en la fuente leída; el esquema no se leyó con detalle de nulabilidad).

Ejemplo (inventado):

```json
{
  "id": 1000000001,
  "node_id": "I_ejemplo",
  "number": 42,
  "state": "open",
  "title": "Ejemplo: el botón de guardar no responde",
  "body": "Texto de ejemplo escrito por un tercero. NO es de confianza.",
  "user": { "login": "usuario-ejemplo" },
  "labels": [ { "name": "bug" } ],
  "assignees": [],
  "comments": 1,
  "created_at": "2026-10-01T10:00:00Z",
  "updated_at": "2026-10-02T11:30:00Z",
  "author_association": "NONE"
}
```

Campos mínimos que FORGE usaría: `number`, `title`, `body`, `state`, `labels[].name`, `user.login`, `author_association`, `updated_at`, y la presencia de `pull_request`.

### 1.2 Leer comentarios

`GET /repos/{owner}/{repo}/issues/{issue_number}/comments?per_page=100&page=1`
Fuente: https://docs.github.com/en/rest/issues/comments?apiVersion=2022-11-28. Orden ascendente por ID. `since` en ISO 8601. 200, 404, 410. Paginación por cabecera `Link` (`rel="next"`): https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api

Campos del comentario (esquema oficial): `id`, `node_id`, `url`, `body`, `user.login` (`user` puede ser nulo), `created_at`, `updated_at`, `html_url`, `issue_url`, `author_association` (`COLLABORATOR`, `CONTRIBUTOR`, `FIRST_TIMER`, `FIRST_TIME_CONTRIBUTOR`, `MANNEQUIN`, `MEMBER`, `NONE`, `OWNER`). Tipos de medio: `raw` (por defecto), `text`, `html`, `full`.

Ejemplo (inventado):

```json
[
  {
    "id": 2000000001,
    "node_id": "IC_ejemplo",
    "url": "https://api.github.com/repos/org-ejemplo/repo-ejemplo/issues/comments/2000000001",
    "html_url": "https://github.com/org-ejemplo/repo-ejemplo/issues/42#issuecomment-2000000001",
    "issue_url": "https://api.github.com/repos/org-ejemplo/repo-ejemplo/issues/42",
    "body": "Comentario de ejemplo.",
    "user": { "login": "otro-usuario-ejemplo" },
    "created_at": "2026-10-02T09:00:00Z",
    "updated_at": "2026-10-02T09:00:00Z",
    "author_association": "MEMBER"
  }
]
```

### 1.3 Comentar

`POST /repos/{owner}/{repo}/issues/{issue_number}/comments`, cuerpo `{"body": "..."}`. 201; 403, 404, 410, 422. Respuesta: mismo esquema que «Get an issue comment». Genera notificaciones y «creating content too quickly» puede activar el límite secundario. Fuente: https://docs.github.com/en/rest/issues/comments?apiVersion=2022-11-28

Petición (ejemplo; el cuerpo mínimo es el de la documentación, `{ "body": "Me too" }`):

```json
{ "body": "Ejemplo: FORGE terminó la tarea forge-0001. Evidencia: ver la solicitud en borrador." }
```

Respuesta 201 (ejemplo inventado con los campos requeridos del esquema):

```json
{
  "id": 2000000002,
  "node_id": "IC_ejemplo2",
  "url": "https://api.github.com/repos/org-ejemplo/repo-ejemplo/issues/comments/2000000002",
  "html_url": "https://github.com/org-ejemplo/repo-ejemplo/issues/42#issuecomment-2000000002",
  "issue_url": "https://api.github.com/repos/org-ejemplo/repo-ejemplo/issues/42",
  "body": "Ejemplo: FORGE terminó la tarea forge-0001. Evidencia: ver la solicitud en borrador.",
  "created_at": "2026-10-11T12:00:00Z",
  "updated_at": "2026-10-11T12:00:00Z"
}
```

Idempotencia: la documentación leída **no** describe ninguna clave de idempotencia para este endpoint (**sin confirmar**); CA-002-04 tendrá que resolverse en FORGE (registro local del `id` devuelto y/o marcador dentro del texto).

### 1.4 Proponer cambio (rama + solicitud en borrador)

1. `GET /repos/{owner}/{repo}/git/ref/heads/{rama_base}` para obtener el SHA. Esquema 200: `ref`, `node_id`, `url`, `object.type`, `object.sha` (40 caracteres), `object.url`. 404 y 409. Fuente: https://docs.github.com/en/rest/git/refs?apiVersion=2022-11-28
2. `POST /repos/{owner}/{repo}/git/refs`, cuerpo `{"ref":"refs/heads/forge/...","sha":"<sha>"}`. 201; 409 conflicto; 422. No se pueden crear referencias en repositorios sin ramas. Mismo esquema que «Get a reference». Misma fuente.
3. Subir los archivos: la documentación de permisos lista `POST .../git/blobs`, `POST .../git/trees`, `POST .../git/commits` y `PATCH .../git/refs/{ref}` (Contents: write) y `PUT .../contents/{path}`: https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens. **Los cuerpos de estas llamadas no se leyeron en este spike: sin confirmar**; hay que leerlos de https://docs.github.com/en/rest/git/blobs, `.../git/trees`, `.../git/commits` antes de implementar.
4. `POST /repos/{owner}/{repo}/pulls`, cuerpo con `title`, `head`, `base`, `body`, `draft`. 201; 403; 422. Fuente: https://docs.github.com/en/rest/pulls/pulls?apiVersion=2022-11-28. Campos de respuesta nombrados por la fuente: `url`, `id`, `number`, `state`, `title`, `user`, `body`, `head`, `base`, `merged`, `mergeable`.

Ejemplos (inventados):

```json
{ "ref": "refs/heads/forge/forge-0001-ejemplo", "sha": "0000000000000000000000000000000000000000" }
```

```json
{
  "ref": "refs/heads/forge/forge-0001-ejemplo",
  "node_id": "REF_ejemplo",
  "url": "https://api.github.com/repos/org-ejemplo/repo-ejemplo/git/refs/heads/forge/forge-0001-ejemplo",
  "object": { "type": "commit", "sha": "0000000000000000000000000000000000000000", "url": "https://api.github.com/repos/org-ejemplo/repo-ejemplo/git/commits/0000000000000000000000000000000000000000" }
}
```

```json
{
  "title": "forge-0001: propuesta de cambio (ejemplo)",
  "head": "forge/forge-0001-ejemplo",
  "base": "main",
  "body": "Generado por FORGE. Cierra el análisis de #42. Evidencia: ...",
  "draft": true
}
```

```json
{
  "id": 3000000001,
  "number": 43,
  "state": "open",
  "title": "forge-0001: propuesta de cambio (ejemplo)",
  "draft": true,
  "head": { "ref": "forge/forge-0001-ejemplo" },
  "base": { "ref": "main" },
  "merged": false,
  "html_url": "https://github.com/org-ejemplo/repo-ejemplo/pull/43"
}
```

La presencia de `draft` en la respuesta no se vio en el esquema leído; **sin confirmar** (el cuerpo de la petición sí lo documenta). Comprobar `draft: true` en la respuesta no se puede dar por hecho.

### 1.5 Errores y cabeceras de límite

- 404 en lugar de 403 para no confirmar la existencia de repositorios privados; con faltas de permiso de grano fino el texto es «Resource not accessible by personal access token» (código HTTP **sin confirmar**). https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api
- Cabeceras de ritmo: `x-ratelimit-limit`, `x-ratelimit-remaining`, `x-ratelimit-used`, `x-ratelimit-reset`, `x-ratelimit-resource`, `retry-after`. https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api

---

## 2. GitLab (API REST v4)

### 2.1 Leer incidencia

`GET {host}/api/v4/projects/:id/issues/:issue_iid` con `PRIVATE-TOKEN: <TOKEN>`. `:id` es el ID global o la ruta con codificación URL; `:issue_iid` es el ID interno de proyecto. Fuente: https://docs.gitlab.com/api/issues/. La página llama a la sección «Retrieve a project issue». Ejemplo oficial recortado de la documentación: `project_id`, `iid`, `id`, `title`, `state` (`closed` en el ejemplo), `labels`, `confidential`, `discussion_locked`, `issue_type`, `web_url`.
Aviso: el campo del texto es `description` según la sección de creación (https://docs.gitlab.com/api/issues/), que lista `description` y `labels`; en la lectura el ejemplo recortado no lo muestra: se asume `description` presente (**sin confirmar** en el ejemplo literal).

Ejemplo (inventado, a partir de los campos anteriores):

```json
{
  "id": 41,
  "iid": 7,
  "project_id": 4,
  "title": "Ejemplo: el botón de guardar no responde",
  "description": "Texto de ejemplo escrito por un tercero. NO es de confianza.",
  "state": "opened",
  "labels": ["bug"],
  "confidential": false,
  "discussion_locked": false,
  "issue_type": "issue",
  "author": { "username": "usuario-ejemplo" },
  "web_url": "https://gitlab.example.com/grupo/proyecto/-/issues/7"
}
```

`author` no se verificó en el ejemplo oficial recortado (**sin confirmar**).

### 2.2 Leer notas

`GET /projects/:id/issues/:issue_iid/notes?sort=asc&order_by=created_at&per_page=100`. Por defecto 20 por página, máximo 100; cabeceras `Link`, `x-next-page`, `x-total`. Fuentes: https://docs.gitlab.com/api/notes/ y https://docs.gitlab.com/api/rest/. La página muestra una lista de notas con `"body": "closed"` y `"system": true`, es decir, **las notas de sistema aparecen en la misma lista que las de personas** y hay que filtrarlas por `system`.

Ejemplo (inventado):

```json
[
  { "id": 301, "type": null, "body": "Nota de ejemplo escrita por un tercero.", "author": { "username": "otro-usuario-ejemplo" }, "created_at": "2026-10-02T09:00:00.000Z", "system": false, "internal": false },
  { "id": 302, "body": "closed", "system": true, "created_at": "2026-10-03T09:00:00.000Z" }
]
```

### 2.3 Comentar

`POST /projects/:id/issues/:issue_iid/notes`, parámetros `body` (obligatorio; «Limited to 1,000,000 characters»), `internal` (defecto false; «overrides `confidential`»), `created_at` (exige administrador o propietario). La página **no** trae ejemplo de respuesta para la creación (se asume que devuelve la nota creada, **sin confirmar**). Fuente: https://docs.gitlab.com/api/notes/

```json
{ "body": "Ejemplo: FORGE terminó la tarea forge-0001. Evidencia: ..." }
```

Respuesta 201 (ejemplo inventado; forma supuesta, no verificada):

```json
{ "id": 303, "body": "Ejemplo: FORGE terminó la tarea forge-0001. Evidencia: ...", "author": { "username": "forge-bot-ejemplo" }, "system": false, "created_at": "2026-10-11T12:00:00.000Z" }
```

### 2.4 Proponer cambio

1. Crear rama: `POST /projects/:id/repository/branches` con `branch` (sin espacios ni caracteres especiales salvo guion y guion bajo) y `ref` (rama o SHA de origen). 201 con `name`, `protected`, `default`, `can_push` y un objeto `commit`. Fuente: https://docs.gitlab.com/api/branches/
2. Subir archivos: `POST /projects/:id/repository/commits` con `branch`, `commit_message`, `start_branch` y `actions[]`. La respuesta documentada incluye `id`, `short_id`, `title`, `message`, `committed_date`, `web_url`. Fuente: https://docs.gitlab.com/api/commits/. Alternativa para un archivo: `POST /projects/:id/repository/files/:file_path` (201 con `branch` y `file_path`): https://docs.gitlab.com/api/repository_files/
3. Abrir la solicitud: `POST /projects/:id/merge_requests` con `source_branch`, `target_branch`, `title`, `description` (máx. 1 048 576), etc. La respuesta incluye `id`, `iid`, `project_id`, `title`, `description`, `state`, `source_branch`, `target_branch`, `draft`. Fuente: https://docs.gitlab.com/api/merge_requests/ (tramo leído; los últimos 24 931 caracteres de la página no se leyeron).

Borrador: la guía de usuario indica el prefijo `Draft:` en el título (https://docs.gitlab.com/user/project/merge_requests/drafts/). La sección de creación de la API leída **no documenta** un parámetro `draft` ni el prefijo: **sin confirmar para la API**. Plan B: tras crear, comprobar `draft: true` en la respuesta y, si no lo es, no declararlo borrador.

Ejemplos (inventados):

```json
{ "branch": "forge/forge-0001-ejemplo", "ref": "main" }
```

```json
{
  "branch": "forge/forge-0001-ejemplo",
  "start_branch": "main",
  "commit_message": "forge-0001: cambio de ejemplo",
  "actions": [
    { "action": "update", "file_path": "src/ejemplo.js", "content": "// contenido de ejemplo\n" }
  ]
}
```

```json
{
  "source_branch": "forge/forge-0001-ejemplo",
  "target_branch": "main",
  "title": "Draft: forge-0001: propuesta de cambio (ejemplo)",
  "description": "Generado por FORGE. Relacionado con #7."
}
```

```json
{
  "id": 501,
  "iid": 12,
  "project_id": 4,
  "title": "Draft: forge-0001: propuesta de cambio (ejemplo)",
  "state": "opened",
  "source_branch": "forge/forge-0001-ejemplo",
  "target_branch": "main",
  "draft": true,
  "web_url": "https://gitlab.example.com/grupo/proyecto/-/merge_requests/12"
}
```

### 2.5 Errores y cabeceras de límite

- 404 para quien no es miembro de un proyecto privado; 404 si la ruta no está codificada. https://docs.gitlab.com/api/issues/ · https://docs.gitlab.com/api/rest/
- 429 con `Retry-After` y `RateLimit-ResetTime`; `RateLimit-Limit` y `RateLimit-Remaining` en las respuestas; las API de proyectos, grupos y usuarios no las incluyen. https://docs.gitlab.com/user/gitlab_com/rate_limits/

---

## 3. Jira Cloud (REST v3)

Fuente primaria de rutas, permisos, parámetros y ejemplos: https://dac-static.atlassian.com/cloud/jira/platform/swagger-v3.v3.json (OpenAPI oficial, versión `1001.0.0-SNAPSHOT-0c0db68a...`). Los ejemplos de ese archivo usan `your-domain.atlassian.net`.

### 3.1 Leer ticket

`GET https://<dominio>.atlassian.net/rest/api/3/issue/{issueIdOrKey}?fields=summary,description,labels,status,comment` con `Authorization: Basic base64(correo:token)`. Con un token **con ámbitos**, la base es `https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/...` (https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/).
200, 401, 404 («not found or the user does not have permission to view it»). Si la clave no coincide, hace búsqueda sin distinguir mayúsculas y comprueba incidencias movidas, y devuelve la clave encontrada, no una redirección. `IssueBean` tiene `id`, `key`, `self`, `fields`, `expand`, `names`, `renderedFields`, `changelog`, `transitions`, etc.

**La descripción llega en formato de documento de Atlassian (ADF), no en texto plano**: el ejemplo oficial trae `"description":{"type":"doc","version":1,"content":[{"type":"paragraph","content":[{"type":"text","text":"Main order flow broken"}]}]}`. FORGE tendría que convertir ADF a texto (el conversor es trabajo nuevo; los nodos de bloque están en https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/) o pedir `expand=renderedFields` (HTML, que también es entrada no confiable).

Ejemplo (inventado, con la forma de los campos del ejemplo oficial):

```json
{
  "id": "10010",
  "key": "EJ-1",
  "self": "https://your-domain.atlassian.net/rest/api/3/issue/10010",
  "fields": {
    "summary": "Ejemplo: el botón de guardar no responde",
    "description": {
      "type": "doc",
      "version": 1,
      "content": [
        { "type": "paragraph", "content": [ { "type": "text", "text": "Texto de ejemplo escrito por un tercero. NO es de confianza." } ] }
      ]
    },
    "labels": ["bug"],
    "status": { "name": "Open" }
  }
}
```

La forma de `fields.comment` (objeto con `comments`, `total`, etc.) no se verificó en el ejemplo; para comentarios usar el endpoint propio.

### 3.2 Leer comentarios

`GET /rest/api/3/issue/{issueIdOrKey}/comment?startAt=0&maxResults=100&orderBy=created`. `maxResults` por defecto 100 (en la especificación); `orderBy` solo acepta `created` (otro valor da 400). Respuesta `PageOfComments`: `startAt`, `maxResults`, `total`, `comments[]`. Máximo de `maxResults`: **sin confirmar**.

```json
{
  "startAt": 0,
  "maxResults": 100,
  "total": 1,
  "comments": [
    {
      "id": "10000",
      "self": "https://your-domain.atlassian.net/rest/api/3/issue/10010/comment/10000",
      "author": { "accountId": "5b10a2844c20165700ede21g", "displayName": "Mia Krystof", "active": false },
      "body": { "type": "doc", "version": 1, "content": [ { "type": "paragraph", "content": [ { "type": "text", "text": "Comentario de ejemplo." } ] } ] },
      "created": "2021-01-17T12:34:00.000+0000",
      "updated": "2021-01-18T23:45:00.000+0000"
    }
  ]
}
```

(Los campos del comentario `id`, `self`, `author`, `body`, `created`, `updated`, `visibility`, `jsdPublic` son los del esquema `Comment`.)

### 3.3 Comentar

`POST /rest/api/3/issue/{issueIdOrKey}/comment`, `Content-Type: application/json`. **El cuerpo `body` debe ser un documento ADF**; el ejemplo oficial es:

```json
{
  "body": {
    "type": "doc",
    "version": 1,
    "content": [
      { "type": "paragraph", "content": [ { "type": "text", "text": "Lorem ipsum dolor sit amet, ..." } ] }
    ]
  },
  "visibility": { "type": "role", "value": "Administrators", "identifier": "Administrators" }
}
```

Mínimo que FORGE usaría: el mismo sin `visibility` (la especificación marca `visibility` como «Optional on create and update»; que el cuerpo mínimo se acepte sin ella no se probó, **sin confirmar** por ejecución). Respuestas: 201; 400; 401; 404; 413 («per-issue limit has been breached» para comentarios o adjuntos). La respuesta 201 del ejemplo oficial trae `author`, `body`, `created`, `id`, `self`, `updateAuthor`, `updated`, `visibility`.

Idempotencia: no documentada (**sin confirmar**). Un comentario repetido se duplica; la defensa debe ser local.

### 3.4 Errores y cabeceras de límite

- `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `X-RateLimit-NearLimit`, `RateLimit-Reason`. El tráfico con token de API «is not affected» por el modelo de puntos por hora, pero sí por los límites de ráfaga. https://developer.atlassian.com/cloud/jira/platform/rate-limiting/
