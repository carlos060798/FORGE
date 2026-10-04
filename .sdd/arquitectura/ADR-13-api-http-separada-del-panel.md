# ADR-13: API HTTP aparte del panel, con secreto y sin acceso entre orígenes

> Estado: propuesta  # propuesta | aceptada | obsoleta | reemplazada-por-ADR-XX
> Fecha: 2026-10-03
> Spec relacionada: 2026-10-03-api-http
> Autor: Claude (pendiente de aceptación por el dueño)

## Contexto

El plan maestro (FASE 4) preveía extender `ui/server.js` con operaciones de escritura. Ese panel responde con `Access-Control-Allow-Origin: *`, no exige ningún secreto y es de solo lectura por diseño. Si se le añadiera escritura, cualquier página web abierta en el navegador del operador podría lanzar ejecuciones en su equipo.

## Decisión

Se crea `core/api/servidor.js` como servidor aparte, sin dependencias (`node:http`):

- Escucha solo en `127.0.0.1`.
- Exige `Authorization: Bearer <secreto>` en toda petición (también en rutas inexistentes), con comparación en tiempo constante. El secreto es aleatorio, se genera al arrancar y se imprime una sola vez por la salida estándar; no se guarda en disco.
- Rechaza toda petición con cabecera `Origin` y toda cuyo `Host` no sea el propio (contra rebinding de nombres).
- No emite cabeceras de acceso entre orígenes ni atiende `OPTIONS`.
- Lanza siempre `forge run|resume --motor ciclo` como proceso aparte; el modo no es un parámetro. Una sola ejecución a la vez.
- El panel de solo lectura queda como está.

## Alternativas consideradas

- **A. Extender `ui/server.js`**: rechazada por el acceso abierto a cualquier origen.
- **B. Endurecer `ui/server.js` y añadirle escritura**: rechazada; mezclaría dos modelos de confianza y rompería a quien use el panel hoy.
- **C. Servidor nuevo y separado**: aceptada.
- **D. Permitir el modo clásico**: rechazada; ejecutaría en el equipo el código que escribió un modelo.

## Consecuencias

### Positivas
- Una página web hostil no puede operar la API (sin secreto, y con `Origin` se rechaza igualmente).
- Cero dependencias nuevas.

### Negativas / Riesgos
- Cualquier proceso del mismo usuario que conozca el secreto puede operar la API; es la confianza que se asume.
- Sin límite de intentos fallidos (fuera de alcance).
- El secreto solo se ve en la salida del arranque; un programa que no la lea no puede usarlo.

## Cumplimiento de la constitución

Principio IV (dependencias): sin dependencias nuevas. Principio de seguridad por defecto: acceso cerrado, solo local, sin escape del aislamiento.
