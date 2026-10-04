# API HTTP local — `forge api`

Una API para que un programa de tu equipo lance el ciclo verificado, consulte su estado y decida las revisiones, sin abrir una terminal. Spec `2026-10-03-api-http`, decisión en `ADR-13`.

## Arrancar

```bash
npx forge api [--port 3002] [--cwd <proyecto>]
```

Escribe **una línea JSON** por la salida estándar con la dirección y el secreto, y el resto por la de errores:

```json
{"url":"http://127.0.0.1:3002","token":"…64 caracteres…"}
```

El secreto es aleatorio, se genera en cada arranque y no se guarda en disco. Para fijarlo tú: `FORGE_API_TOKEN=…`. Quien lo conozca (cualquier proceso de tu usuario que lo lea) puede lanzar ejecuciones en tu proyecto: trátalo como una contraseña.

## Protecciones

- Escucha solo en `127.0.0.1`.
- Toda petición, también a rutas que no existen, exige `Authorization: Bearer <secreto>`. No se acepta en la URL.
- Se rechaza (403) toda petición con cabecera `Origin` —la que envía un navegador— aunque lleve el secreto, y toda cuyo `Host` no sea `127.0.0.1:<puerto>` o `localhost:<puerto>` (contra el rebinding de nombres).
- No emite cabeceras CORS y no atiende `OPTIONS`: ninguna página web puede llamarla.
- Los cuerpos están limitados a 64 KB y deben ser JSON de tipo `application/json`; se rechaza todo campo desconocido.
- **Siempre ejecuta el ciclo verificado**: el modo no se puede elegir, así que lo que genere un modelo solo se ejecuta en el contenedor. Sin Docker, la ejecución termina con el código 4.
- Una ejecución a la vez.

## Rutas

| Método y ruta | Cuerpo | Respuesta |
|---|---|---|
| `GET /v1/estado` | — | `{etapa, sesion, tareas[], gasto, ejecucion}`. Cada tarea lleva su situación y, si espera una decisión, `motivoRevision` y detalle |
| `POST /v1/ejecuciones` | `{"tareas":[{id, agente, prompt, dependencias?, archivos?}]}` (opcional: sin él se usan las tareas del proyecto) | `202 {id, …}` |
| `GET /v1/ejecuciones/<id>` | — | `{estado: "en_curso"\|"terminada", codigoSalida, salida}`; la salida es el final de lo que escribió la terminal, sin secretos |
| `POST /v1/decisiones` | `{"decision":"continuar"\|"aceptar"\|"abortar", "tarea"?, "iteracionesExtra"?, "presupuestoExtra"?}` | `202 {id, …}` |

Errores: 400 validación, 401 sin secreto o incorrecto, 403 origen o host, 404, 405, 409 ya hay una ejecución (el mensaje dice cuál), 413 cuerpo grande, 415 tipo de contenido.

El código de salida de una ejecución es el de la terminal: 0 completadas (o abortada por decisión), 1 fallo, 3 hay tareas esperando decisión, 4 sin Docker. Ver `docs/ciclo-verificado.md`.

## Ejemplo

```bash
T=<el secreto>
curl -s -H "Authorization: Bearer $T" http://127.0.0.1:3002/v1/estado
curl -s -H "Authorization: Bearer $T" -H "Content-Type: application/json" \
     -d '{"tareas":[{"id":"T1","agente":"desarrollador-backend","prompt":"Implementa suma"}]}' \
     http://127.0.0.1:3002/v1/ejecuciones
curl -s -H "Authorization: Bearer $T" http://127.0.0.1:3002/v1/ejecuciones/<id>
```

## Límites

- **Solo local y de un usuario.** Sin TLS, sin usuarios ni roles, sin caducidad del secreto, sin límite de intentos fallidos.
- **Sondeo, no streaming**: la salida se consulta con `GET /v1/ejecuciones/<id>`.
- **El panel de solo lectura (`ui/server.js`) no cambia** y sigue respondiendo a cualquier origen; no lo uses para operar.
- Probado con Node y con el ciclo real en Docker (Windows). No probado con clientes externos ni en Linux.
- Hereda todos los límites del ciclo (ver `docs/ciclo-verificado.md`).
