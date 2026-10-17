# Cadena de evidencia

`fragua verificar --registrar` guarda cada verificación en `.sdd/verificaciones/<id>.json`. Desde esta fase, cada archivo lleva un bloque `evidencia` que lo **encadena** con el anterior y, si hay clave local, lo **firma**. Sirve para que alterar, borrar o reordenar informes ya guardados se note. No es una prueba de que lo que dice el informe sea cierto.

## Qué lleva el bloque `evidencia`

| Campo | Contenido |
|---|---|
| `fragua` | versión de Fragua que escribió el informe |
| `spec` | `{ id, sha256, aprobada, fecha }` de la spec activa que declara `.sdd/estado.json`; `null` con motivo si no hay |
| `commit` | `HEAD`, leído sin ejecutar nada del repositorio (solo `git rev-parse` con la receta neutralizada de `core/verificar/cambios.js`) |
| `pruebas` | hash de las rutas y contenidos de los archivos de pruebas |
| `imagen` | `{ etiqueta, id, repoDigests }`: el `Id` local de la imagen; `repoDigests` queda vacío en una imagen construida aquí (no se inventa un digest) |
| `modelos` | pares `{ rol, agente, proveedor, modelo, modeloServido, llamadas }`; `[]` con motivo en `forge verificar`, que no llama a ningún modelo. Es el modelo **pedido**, no una prueba de cuál respondió |
| `aprobador` | siempre `null`: el proyecto no registra quién aprueba |
| `omitidos` | el motivo de cada campo `null` o vacío |
| `anterior`, `sha256`, `firma`, `firmado` | la cadena (abajo) |

El resultado conserva `formato: 1`. El esquema (`docs/contrato/resultado-verificar.schema.json`, versión 1.1) declara `evidencia` como campo opcional; solo aparece en el archivo registrado, no en `--json`.

## Cómo se encadena y se firma

- `sha256` = SHA-256 del informe en JSON canónico (claves ordenadas), sin `evidencia.sha256` ni `evidencia.firma`.
- `anterior` = el `sha256` del informe previo (`null` en el primero).
- `firma` = HMAC-SHA256 con la clave local del usuario (`core/estado-usuario.js`, fuera del proyecto) sobre el informe con su `sha256`. **Se firma siempre que haya clave**; al registrar se crea si no existe. Sin clave no se firma y el informe lo dice (`firmado: false`).
- La **cabeza** (último `sha256`, firmada) se guarda en el estado del usuario: `cadena-cabeza.json`, junto a la clave.

## Comprobarla

```
fragua verificar --comprobar-evidencia [--cwd <dir>] [--json]
```

Solo lee: no crea la clave ni escribe nada. Sale con 0 si la cadena es íntegra y con 1 si está rota; dice qué informe falla y por qué (`alterado`, `borrado`, `bifurcada`, `firma`, `sin_firma`, `truncada`...). Si existe clave en esta máquina, todo informe sin firma es un error.

## Qué detecta y qué no

Detecta: alterar un campo, borrar un informe del medio, reordenar, bifurcar, quitar las firmas donde hay clave, y firmas hechas con otra clave (otra máquina, o la que el proyecto deje en su árbol: ni la clave ni la cabeza del proyecto cuentan).

**No detecta, y conviene saberlo:**

- **Truncar los últimos informes** solo se detecta si en esta máquina existe la cabeza guardada. Sin ella (otra máquina, estado borrado, CI sin perfil persistente), la cadena que queda es válida. Quien tenga el repositorio y no tu estado de usuario puede **reconstruirla entera** con otros datos; con clave local no podrá firmarla, pero sin clave la cadena es solo «encadenada, no firmada».
- La firma es **HMAC simétrico**: solo la comprueba quien tiene la clave. No sirve a un auditor externo (haría falta firma asimétrica con la clave pública anclada fuera).
- Lo que el informe afirma (spec «aprobada», modelo) lo declara el proyecto o el cliente. La cadena prueba que no se retocó después, no que fuera verdad.
- Dos `--registrar` simultáneos pueden bifurcar la cadena: se detecta como error, no se arregla solo.
- Una escritura interrumpida entre el informe y la cabeza deja la cabeza un paso atrás y se avisa como desfase.

Siguiente fase (no hecha): puertas declarables, `modelos` poblados por el ciclo, `DockerCli.identidadImagen`, y bloquear al agente la escritura de `tsconfig*.json`, `mypy.ini`, `ruff.toml`, `biome.json`... (la lista ya existe en `core/evidencia/protegidos.js`, sin cablear).
