# Spike S0.2: digest de la imagen construida en local

> Solo lectura (2026-10-17). Sin Docker en el equipo: lo que dice Docker aquí es conocimiento de la herramienta, **sin confirmar ejecutándolo**.

## Lo que hay hoy

- `DockerCli.existeImagen` ya hace `docker image inspect --format '{{.Id}}' <imagen>` y descarta el valor (`core/sandbox/docker-cli.js:214-217`). Pedir el id no necesita red: `inspect` es local.
- `prepararImagen` devuelve `{ imagen, construida, huella }` (`core/sandbox/preparar-imagen.js:137,155,164,176`); `SandboxRunner` lo guarda en `ultimaImagen` (`sandbox-runner.js:133,159`). El resultado de `verificar` solo lleva la etiqueta (`verificar/index.js:228`, `resultado.js:63`).
- Tres casos de imagen:
  1. Imagen base sin dependencias (`node:22-alpine`, `python:3.12-slim`): `huella: null`, etiqueta mutable (`preparar-imagen.js:149-155`).
  2. Imagen propia `forge-sbx:<lenguaje>-<huella>` construida en local (`:162-176`). La `huella` cubre el texto del Dockerfile y los manifiestos (`:159-161`) pero NO la imagen base (la etiqueta `node:22-alpine` se mueve) ni lo que `npm ci` baje si no hay `package-lock.json` (`:119`).
  3. Go: siempre propia (`:149`).

## Qué identificador usar

- `{{.Id}}` es el identificador del contenido de la imagen local (`sha256:...`, el de la configuración con el motor clásico; con el almacén de imágenes containerd de Docker Desktop recientes puede ser el del manifiesto, sin confirmar). Existe siempre para una imagen local y cambia si cambia el contenido: es lo único estable para el caso 2.
- `RepoDigests` solo se rellena para imágenes que vienen de un registro (caso 1, base descargada con `docker pull`, `docker-cli.js:208`). Una imagen construida en local tiene la lista **vacía**; no hay que esperar un digest de registro de lo que se construyó aquí.

## Recomendación

- Registrar siempre `imagen: { etiqueta, id, repoDigests }`, con `id` de `{{.Id}}` y `repoDigests` de `docker image inspect --format '{{json .RepoDigests}}'` (lista, posiblemente vacía). Una sola llamada: `--format '{{.Id}}|{{json .RepoDigests}}'`, con el mismo `_consultar` (reintento y tiempo acotado).
- `digest: null` con motivo solo si `inspect` falla; no inventar un digest de registro para imágenes locales.
- Nombre de campo: la spec habla de `digest`; conviene `id` + `repoDigests` y llamar «digest» solo al de registro, para no prometer un anclaje que no existe.
- Hay que tomar el `id` **antes** de `docker run` y comprobar que la etiqueta no se movió entre medias (carrera pequeña: reconstruir la misma etiqueta). Alternativa más fuerte: ejecutar con `id` en lugar de la etiqueta; `argvRun` acepta cualquier referencia sin guion (`politica.js:363`), pero cambiaría el nombre que ven los logs (sin confirmar el efecto en el barrido por etiqueta, que usa labels, no nombre de imagen).

## Qué cambia en la spec o el plan

- Plan §5, campo `imagen{etiqueta,digest}` pasa a `imagen{etiqueta,id,repoDigests}`.
- Nuevo método `DockerCli.identidadImagen(ref)` (30 líneas) y `prepararImagen` lo llama al terminar; no cambia la firma de lo existente (campo añadido a `ultimaImagen`).
- Riesgo del plan «Digest no disponible en imágenes locales» queda resuelto: `id` siempre; `repoDigests` vacío es normal, no fallo.

## Riesgos

- La cadena de evidencia puede decir «mismas dependencias» por `huella` y distinta imagen por `id`: son dos cosas, no mezclarlas.
- Sin confirmar el comportamiento con containerd; fijarlo con Docker real en F8.2.
