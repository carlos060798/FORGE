# Spike S0.2: archivos cambiados desde una referencia de git sin ejecutar nada del repositorio

Fecha: 2026-10-13. Git 2.55.0 (Windows). Pruebas reales en un repositorio temporal creado fuera del proyecto (carpeta temporal del sistema, ya borrada) con un `.git/config` hostil: `core.fsmonitor`, `core.hooksPath`, `core.pager`, `core.sshCommand`, `core.attributesFile`, `diff.external`, `diff.evil.textconv`, `filter.evil.clean/smudge`, y `.gitattributes` y `.git/info/attributes` con `*.js diff=evil filter=evil`. Todos apuntaban a un script que, si se ejecuta, escribe un archivo centinela `PWNED`.

## Resultados (¿se escribió el centinela?)

| Orden | Resultado |
|---|---|
| `git diff base --name-only` (ingenuo) | **EJECUTA** (fsmonitor, filtros, enganche de índice) |
| `git diff-tree -r base HEAD` sin `-c` | **EJECUTA**: `core.fsmonitor` se lanza al leer el índice, incluso en órdenes de solo árbol |
| `git ls-files -s` sin `-c` | **EJECUTA** (fsmonitor) |
| `git ls-tree -r base` sin `-c` | limpio |
| con `-c core.fsmonitor=false -c core.hooksPath=... -c core.attributesFile=...`: `diff --no-ext-diff --no-textconv --name-only base` (contra el directorio de trabajo) | **EJECUTA**: el filtro `clean` se aplica al comparar el contenido del directorio de trabajo. `--no-ext-diff`, `--no-textconv`, `core.attributesFile` y `--attr-source=<árbol vacío>` **no bastan** (`.gitattributes` y `.git/info/attributes` del repositorio siguen activos) |
| ídem con `diff -p`, `status --porcelain`, `ls-files -m`, `cat-file --filters` | **EJECUTA** |
| con `-c core.fsmonitor=false ...`: `diff-tree -r --no-renames --name-only -z base HEAD` | limpio |
| ídem `ls-tree -r -z`, `ls-files -s -z`, `ls-files -o -c --exclude-standard -z`, `diff-index --cached --name-only -z`, `rev-parse --verify`, `cat-file blob`, `show ref:ruta`, `log -1` | limpio |

Del `git-config` y `gitattributes` de la documentación oficial: `core.fsmonitor` es un gancho que git ejecuta al leer el índice; `diff.external`, `textconv` y `filter.<nombre>.clean/smudge` ejecutan el programa configurado cuando una operación necesita el contenido (filtrado) de un archivo. `GIT_CONFIG_NOSYSTEM=1` y `GIT_CONFIG_GLOBAL=/dev/null` excluyen la configuración del sistema y del usuario, **no la del repositorio**. `-c` prevalece sobre `.git/config` para claves conocidas (`core.fsmonitor`, `core.hooksPath`), pero **`filter.<nombre>.*` y `diff.<nombre>.textconv` no se pueden neutralizar: el nombre lo elige el repositorio**.

## Conclusión técnica

- `-c` + `--no-ext-diff` + `--no-textconv` basta para comparar **árbol contra árbol** y leer el índice, y **no basta** para nada que toque el contenido del directorio de trabajo.
- Lo seguro: solo órdenes que leen **objetos o el índice** con `core.fsmonitor=false`, y leer el directorio de trabajo con Node, sin pasar por git.

## Decisión

**Invocación neutralizada de órdenes de lectura de objetos + comparación del directorio de trabajo en Node.** `--archivos` sigue siendo la vía principal; `--desde` queda como comodidad con estas garantías. Si se prefiere cero riesgo, "solo `--archivos`" no rompe nada, pero hay una vía segura y pequeña.

Receta (`core/verificar/cambios.js`):

1. `execFile('git', args)` sin shell, `cwd` = proyecto, con tiempo y tope de salida. Entorno propio: `PATH`, `GIT_CONFIG_NOSYSTEM=1`, `GIT_CONFIG_GLOBAL=<nul|/dev/null>`, `GIT_OPTIONAL_LOCKS=0`, `GIT_TERMINAL_PROMPT=0`; sin heredar `GIT_DIR`, `GIT_EXTERNAL_DIFF`, `GIT_PAGER`, `GIT_SSH*`, `GIT_ASKPASS`.
2. Prefijo fijo: `-c core.fsmonitor=false -c core.hooksPath=<nul|/dev/null> -c core.attributesFile=<nul|/dev/null> -c core.pager=cat -c core.quotePath=false -c core.untrackedCache=false`.
3. Referencia: no vacía, sin `-` inicial ni caracteres de control; resolver con `rev-parse --verify --end-of-options "<ref>^{commit}"` y usar el hash en lo demás.
4. Árbol de la referencia: `ls-tree -r -z --full-tree <hash>` -> `{ruta: blobId}`.
5. Archivos actuales: `ls-files -z -c -o --exclude-standard` (solo nombres). Para cada uno, en Node, id de blob `sha1("blob " + tamaño + "\0" + bytes)` sin filtros, comparado con el de la referencia. Distinto o ausente -> cambiado o nuevo. (Con `core.autocrlf` puede haber falsos positivos: solo añaden candidatos; `originalDe` y `alcanceDeLaTarea` los acotan por líneas. Documentarlo.)
6. Filtrar con `validarRuta` (relativas, sin enlaces, no vetadas) y `lenguajeDe`; descartar borrados.
7. `originalDe(ruta)`: `cat-file blob <hash>:<ruta>` (objeto, sin filtros; probado limpio). Nunca `--filters` ni `show --textconv`.
8. Sin git, sin repositorio o referencia inexistente: error claro, código 1, nada ejecutado; sugerir `--archivos`.

Con `--archivos` y `--desde` a la vez manda `--archivos`. No se recorren submódulos.

## Pruebas a construir (F3.2 / F5.1)

- Repositorio temporal con la configuración hostil de arriba: el centinela **no existe** tras `cambios()` y la lista es la esperada.
- Control negativo (misma configuración, orden ingenua `git diff`): el centinela sí aparece, para que la prueba falle si cambia el comportamiento de git.
- Referencia inexistente, que empieza por `-`, repositorio sin commits, directorio sin git.
- Windows y Linux (`nul` frente a `/dev/null`).

## Cambios que sugiero

- Spec CA-003-01/RF-01: `--desde` calcula archivos añadidos o modificados (no borrados), contra el directorio de trabajo, sin ejecutar nada del repositorio.
- Spec sección 10 (fila git): sustituir "neutralizada o sin git" por la receta; dejar escrito que `diff`, `status` y `ls-files -m` **no** son seguros.
- Spec sección 9: marcar S0.2 resuelto (enlazar este spike).
- Plan 3 y 7: `cambios.js` con la receta; prueba de repositorio hostil y control negativo.
- Tareas F3.2: dividir en (a) `cambios.js` con prueba hostil y (b) integración con `medirMutacion` (`originalDe`).
