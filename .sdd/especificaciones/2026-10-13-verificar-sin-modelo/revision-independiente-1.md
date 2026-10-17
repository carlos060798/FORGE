# Revisión independiente de seguridad 1 (a0a74d9..HEAD)

Revisor independiente, solo lectura. Reproducciones en repositorios temporales fuera del proyecto (centinelas en una carpeta aparte).

## Veredicto: APROBADA_CON_OBSERVACIONES (no fusionar sin corregir H-1 y H-2)

## Hallazgos

| # | Sev. | Archivo:línea | Escenario | Estado | Corrección |
|---|------|---------------|-----------|--------|------------|
| H-1 | ALTA | core/ciclo/diario.js:185-193, core/ciclo/index.js:167,479,491,521 | Un repo hostil trae `.sdd/motor/sesion.json` (`{"runId":"abc",...}`) y `.sdd/motor/abc/tope.json` (`{"tope_usd":1000000}`). `sesionActual` lo acepta (solo valida el patrón del id) y `libro.tope()` devuelve 1000000; el ciclo usa `Math.max(tope_estado, libro.tope())`. Camino de `forge resume` / `status` sobre un proyecto clonado. El tope de config.js solo filtra `sdd.config.yaml`. | CONFIRMADO (tope() = 1000000 con archivos plantados; la ejecución completa de resume, SOSPECHADA) | El tope ampliado debe firmarse con la clave del usuario (`estado-usuario.js`, HMAC) o guardarse fuera del árbol; ignorar `tope.json` sin firma; nunca superar el tope del entorno + `--presupuesto-extra` explícito. `.sdd/motor` aparece en `.gitignore` de este repo, pero un repo ajeno puede versionarlo. |
| H-2 | MEDIA | core/ciclo/config.js:166-177 (`leerPrecios`) | El proyecto declara `gpt-4o_entrada: 0` / `_salida: 0` en `precios:`; se acepta (>= 0) y manda sobre la tabla incluida: el gasto se registra como 0 y el tope nunca se alcanza. Es otro camino para eludir «el proyecto solo puede bajar el tope». | CONFIRMADO en lectura de config (`precios` = {input:0,output:0}); efecto en gasto SOSPECHADO | Precios del proyecto solo pueden SUBIR el precio frente a la tabla incluida (máximo entre ambos), o exigir confirmación del usuario en el entorno para precio 0. |
| H-3 | MEDIA-BAJA | core/verificar/cambios.js:35-44 | Refs de reemplazo: `git replace <HEAD~1> <HEAD>` en el repo hostil hace que `rev-parse`/`ls-tree` devuelvan el árbol sustituido; `c.js`, cambiado desde HEAD~1, no aparece en `archivos`, así que `--desde` omite archivos y la puntuación de mutación se mide sobre un subconjunto elegido por el repo. No ejecuta nada. | CONFIRMADO | Añadir `--no-replace-objects` al prefijo, o `GIT_NO_REPLACE_OBJECTS=1` en `entornoGit()`. |
| H-4 | BAJA | core/llm-providers/openai-provider.js:~30; index.js:117 | `config.base_url` del proyecto (permitido si es loopback) gana sobre `OPENAI_BASE_URL` del usuario: la clave `Authorization: Bearer` va a `http://localhost:<puerto-elegido-por-el-repo>`; en un equipo compartido otro proceso puede escuchar. | SOSPECHADO (por lectura) | Que el entorno del usuario (`OPENAI_BASE_URL`) mande sobre el archivo; o que la clave solo se envíe a hosts de la lista del usuario, no a loopback arbitrario. |
| H-5 | BAJA | core/integraciones/estado-usuario.js:128-135 | `directorioDeEstado` no comprueba el propietario (uid) de la carpeta hash existente. Con `FORGE_HOME` en una ubicación compartida, otro usuario podría haberla creado y fijar la clave. Con la raíz por defecto (home / LOCALAPPDATA) no es alcanzable por un tercero. | SOSPECHADO | Comprobar `st.uid === process.getuid()` y modo sin permisos de grupo/otros, como ya se hace en `verificar/index.js:151`. |

## Revisado sin hallazgo

| Punto | Resultado | Prueba |
|-------|-----------|--------|
| Ejecución por git (`.git/config` con `core.fsmonitor`, `sshCommand`, `gitProxy`, `alternateRefsCommand`, `editor`, `filter.*.clean`, `diff.*.textconv`, `include.path`, `includeIf`, `uploadpack.packObjectsHook`, hook `post-checkout`, `.gitattributes` con filtros) | Ningún centinela se creó. `-c` gana sobre include; solo `rev-parse`, `ls-tree`, `ls-files`, `cat-file blob`. | CONFIRMADO (ejecutado en Windows) |
| `git.exe` plantado en la raíz del proyecto (búsqueda en cwd de Windows) | Se ejecutó el git real del PATH, no el plantado. | CONFIRMADO |
| Entorno heredado (`GIT_DIR`, `GIT_EXTERNAL_DIFF`, etc.), `GIT_CONFIG_GLOBAL/NOSYSTEM`, `HOME` ausente | Entorno construido desde cero; `safe.directory` no se honra, falla cerrado. | Leído |
| `.git` como archivo `gitdir:`, alternates, submódulos | Solo lectura de objetos; gitlinks se saltan por `isFile()`. | Leído |
| `--archivos`: `..`, absolutas, UNC (`//` y `\`), `C:`, CON/NUL, `::$DATA`, `:ads`, `~1`, punto/espacio final, unión (`mklink /J`) hacia fuera, `.git`, `.sdd/motor` | Todas rechazadas por `validarRuta`. `SRC/A.JS` (mayúsculas) pasa pero queda dentro del proyecto. | CONFIRMADO |
| `--registrar` | Ids generados (fecha + 4 bytes aleatorios), `crearArchivo` exclusivo y `verificarRuta` anti-enlaces; `events.jsonl` rechaza enlaces. Sin escritura fuera del proyecto (solo TOCTOU teórico entre `lstat` y `appendFileSync`). | Leído |
| Carpeta temporal por proyecto | `mkdir 0700`, `lstat`, comprobación de uid (en Windows el temporal es por usuario). Un tercero solo puede causar denegación de servicio, no desviar. | Leído |
| OpenAI `conversar`: argumentos manipulados | `entradaDe` nunca lanza; texto inválido se trunca a 2000 y el ejecutor lo rechaza; `length` no ejecuta llamadas. | Leído |
| Caché de OpenAI | `inputTokens = prompt - cacheados`, lectura al precio de entrada (OpenAI no trae precio de caché en la tabla; el defecto es el de entrada): sin doble conteo y sin quedar por debajo. Sin `usage` válido: `ErrorConsumo`. | Leído |
| Fuga de la clave | `redirect:'error'`, `_redactar` en errores y en el fallo de red; `api_key`/`api_version`/`base_url` no permitidos del proyecto se descartan. Observación: `_redactar` solo cubre `sk-...` y la clave exacta; una `base_url` con credenciales ya la rechaza `destinoDeModeloPermitido`. | Leído |
| Modo de bloque de reserva (`caerABloque`) | Solo en el primer turno, sin turnos respondidos ni archivos escritos, y tras rechazo registrado; reutiliza `coderEnBloque` con los mismos controles. | Leído |
| Barrido de contenedores | Filtra por `fragua.proyecto=<hash>` y `forge.proyecto=<hash>`; el valor por defecto (solo etiqueta global) no lo usa ningún llamador. No toca contenedores de otro proyecto de la misma cuenta. Un tercero con acceso al mismo demonio Docker ya tiene control total. | Leído |
| `estado-usuario.js` | Rechaza raíz dentro del proyecto, hash de ruta real, clave 0600 por `link` atómico. Que exista la carpeta `fragua` antes solo cambia de qué carpeta se lee (y falla cerrado: sin clave no hay aprobaciones). | Leído |
| `--presupuesto-extra` / API | Se pasa por la CLI del usuario; la API lo limita a 0-1000 y es una decisión explícita del usuario. | Leído |
| `tope_usd` no numérico en el archivo | Cae a 2.0 (probado con `abc`). | CONFIRMADO |

## Antes de fusionar
1. Corregir H-1 (tope y sesión plantados en `.sdd/motor`): es el único camino confirmado por el que el repo sube el tope.
2. Corregir H-2 (precios en 0) o documentarlo como límite aceptado en PROBLEMAS-CONOCIDOS.
3. H-3 es una línea; recomendable ahora. H-4 y H-5 pueden ir en una iteración posterior.
