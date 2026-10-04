# Spike T002 — Aislamiento con Docker Desktop en Windows

> Fecha: 2026-10-03 | Entorno: Windows 11, Docker 29.7.2 (linux/amd64), Node 24.20.0 | Resultado: **viable con montaje bind**
> Código: `T002-docker-windows.mjs` (junto a este archivo). Imagen de prueba: `node:22-alpine`.
> No se probó en Linux: queda para el job de CI (T034).

## Qué se probó

Contenedores lanzados con `spawn` y argv en array, con la política completa de ADR-02, montando una carpeta temporal de Windows en `/work`.

## Resultados

| Comprobación | Resultado | Evidencia |
|---|---|---|
| Montaje bind desde Windows | Funciona. El contenedor lee lo del anfitrión, escribe como uid 1000 y el anfitrión ve lo escrito, incluidas subcarpetas | `1000 desde el host`; `salida.txt` y `sub/x.txt` visibles en Windows |
| Raíz de solo lectura | Escribir en `/etc` da `EROFS` | CA-003-02 |
| `/tmp` | Se puede escribir; ejecutar un script da "Permission denied" | `noexec` efectivo |
| Sin red | Solo existe la interfaz `lo`; `fetch` falla con `EAI_AGAIN` | CA-003-01 |
| Usuario y privilegios | uid y gid 1000, `CapEff: 0000000000000000`, `NoNewPrivs: 1` | CA-003-03 |
| Límite de memoria | Reservar más de 512 MB termina con código **137** | CA-003-05 |
| Límite de procesos | Al llegar al tope: `sh: can't fork: Resource temporarily unavailable`; el contenedor termina y el anfitrión no se ve afectado | CA-003-05 |
| Tiempo agotado | `docker kill <nombre>` funciona; el `docker run` devuelve **137**; `docker rm -f` posterior no falla aunque `--rm` ya lo haya borrado | CA-003-04 |
| Residuos | 0 contenedores con la etiqueta `forge.sandbox=1` tras todas las pruebas | CA-003-06 |
| Tiempo de arranque | Mediana de **2,9 s** por ejecución vacía (2,8 a 3,0 s en 5 muestras); la primera tras descargar la imagen, 5,0 s | Dentro del límite provisional de 5 s |

## Códigos de salida

| Situación | Código |
|---|---|
| Las pruebas pasan | 0 |
| Las pruebas fallan | 1 (el del ejecutor de pruebas) |
| Memoria agotada o contenedor matado | 137 |
| La imagen no existe | 125 |
| El ejecutable no existe | 127 |
| El archivo no es ejecutable | 126 |

**Matiz importante.** 126 y 127 solo aparecen si la imagen no interpone un `ENTRYPOINT`. Con `node:22-alpine`, un comando inexistente devuelve **1**, porque su script de entrada lo pasa a `node`. El router trataría eso como un fallo de las pruebas y gastaría iteraciones. Conclusión: el runner debe lanzar el comando de pruebas con `--entrypoint` explícito (o con `sh -c`), no confiar en el de la imagen.

## Alternativa sin montaje (`create` + `cp` + `start -a`)

Funciona la mecánica, pero lo copiado con `docker cp` queda con dueño root y el proceso con uid 1000 no puede escribir en `/work`: la ejecución terminó con código 1. Haría falta un paso adicional de cambio de dueño. **No se necesita:** el montaje bind funciona en Windows.

## Qué cambia en las decisiones

- **ADR-02 se mantiene**, con montaje bind de la copia de trabajo.
- **Nuevo requisito para T021 y T023:** fijar `--entrypoint` para que 126 y 127 signifiquen lo que el router espera.
- **Métrica de rendimiento de la spec:** el límite de 5 s por ejecución se confirma como alcanzable (2,9 s medidos). El arranque del contenedor es un costo fijo por iteración: 5 iteraciones añaden unos 15 s.
- **Sin verificar:** Linux, rutas de proyecto con espacios o caracteres no ASCII, y proyectos en una unidad distinta de `C:`.
