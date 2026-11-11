---
id: 2026-11-11-aislamiento-usuario-linux
titulo: "Aislamiento en Linux: el contenedor corre con el usuario del anfitrión para que lo que crea se pueda borrar"
tamano: pequeño  # micro | pequeño | mediano | grande
estado: borrador  # borrador | en_revision | aprobada | en_implementacion | completada
creada: 2026-11-11
actualizada: 2026-11-11
autor: humano  # humano | importado
constitucion_version: 1.1.0
etiquetas: [sandbox, linux, docker, ci]
---

# Especificación: usuario del contenedor en Linux

> **Estado (2026-11-11): borrador.** Toca la política de aislamiento (ADR-02), así que la aprueba el dueño. Salió de reproducir en un Docker de Linux limpio los jobs de Docker real de la CI. Matiza ADR-02: el contenedor sigue sin privilegios, sin red y de solo lectura; solo cambia **qué usuario sin privilegios** es.

## 1. Contexto y Motivación

El contenedor corre con `--user 1000:1000` fijo. En Linux, una carpeta montada conserva dueños y permisos. Lo que el código generado crea dentro de la copia montada (cachés de `pytest`, `vitest`, `node_modules`, subcarpetas) queda a nombre del usuario 1000 con permisos normales. Si quien lanzó Fragua es otro usuario (el runner de GitHub es el 1001; cualquier servidor con varios usuarios, también), **no puede borrar la copia**: `rm` da `Permission denied`, el barrido de la copia falla sin avisar y quedan carpetas en `.sdd/motor/<sesión>/staging/`.

Reproducido el 2026-11-11 con `docker:dind`, usuario 1001: un contenedor con `--user 1000:1000` crea `sub/hondo/a.txt` y el usuario 1001 no puede borrarlo. En las pruebas de medición por mutación con Python y TypeScript quedaron decenas de carpetas `staging/*` y fallaron seis pruebas. En Windows y macOS no ocurre (Docker Desktop no traslada los permisos), y en Linux con usuario 1000 tampoco, por eso no se había visto.

## 2. Objetivo

Que lo que el contenedor crea en la copia montada lo pueda borrar quien lanzó Fragua, sin dar privilegios al contenedor.

## 3. Criterios de aceptación

- **CA-001-01** En Linux, si el anfitrión corre con un usuario que no es root, el contenedor corre con ese mismo uid y gid (`--user <uid>:<gid>`).
- **CA-001-02** En Windows y macOS, y en Linux cuando el anfitrión es root, el contenedor sigue corriendo con `1000:1000`. El contenedor nunca corre como root.
- **CA-001-03** Las demás garantías no cambian: `--network none`, `--cap-drop ALL`, `--read-only`, `no-new-privileges`, `--pull never`, límites.
- **CA-002-01** Tras una ejecución en la que el código creó archivos y subcarpetas dentro de la copia, la copia se elimina por completo. Con Docker real en Linux con un usuario distinto de 1000, esto falla antes del cambio.
- **CA-002-02** `HOME` apunta a una ubicación escribible (hoy `/tmp`), de modo que un uid sin entrada en `/etc/passwd` funciona.

## 4. Fuera de alcance

- Cambiar los permisos de la copia (`abrirPermisos`), que sigue abriéndola al contenedor.
- Podman y runtimes rootless.
- Que el barrido avise cuando no puede borrar: es una mejora aparte.

## 5. Cambios de comportamiento visibles

En Linux con un usuario distinto del 1000, los procesos del contenedor corren con ese uid en lugar de 1000. Los archivos que crean en la copia pertenecen a ese usuario. `tests/sandbox-real.test.js` deja de afirmar `uid == 1000` y afirma que es el que la política indica.
